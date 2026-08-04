import { join } from 'path';
import { promises as fs } from 'fs';
import { basename, resolve } from 'path';
import { createHash } from 'crypto';
import { getGlobalDir, getPermissionErrorHelp } from './global-dir.js';
import { withRegistryLock, uniqueTempPath } from './registry-lock.js';
import { normalizeIdentityPath } from './git-utils.js';

export interface ProjectInstance {
  pid: number;
  registeredAt: string;
}

export interface ProjectRegistryEntry {
  projectId: string;
  projectPath: string;       // Workspace path (identity)
  workflowRootPath: string;  // Path where .spec-workflow is stored (shared root)
  projectName: string;
  instances: ProjectInstance[];
}

export interface RegisterProjectOptions {
  workflowRootPath?: string;
  projectName?: string;
}

/**
 * Maximum number of paths kept in the identity-fallback warn-once ledger.
 *
 * Same bound and same reason as `ROOT_SELECTION_CACHE_LIMIT` in
 * `tools/root-selection.ts`: the ledger is keyed by a path that can arrive from
 * outside — the dashboard's manual-add route calls {@link generateProjectId}
 * with whatever the user typed — so an unbounded ledger leaks an entry per
 * distinct bad path for the lifetime of the process. Eviction is FIFO (a `Map`
 * iterates in insertion order, so the first key is the oldest), which costs at
 * most a repeated log line for a path that has aged out, never a wrong id.
 */
export const IDENTITY_FALLBACK_LEDGER_LIMIT = 32;

/**
 * Absolute paths already reported as un-normalizable, so requirement 1.12's log
 * is emitted once per distinct path per process rather than once per call.
 *
 * {@link generateProjectId} is called on registry *read* paths — `getProject`,
 * `isProjectRegistered`, `unregisterProject` — and a registry entry whose
 * directory has been removed hits the fallback on every one of them. Without
 * this ledger a dashboard with one dead worktree in its registry would print a
 * line per request forever, which is how a diagnostic becomes noise nobody
 * reads.
 */
const loggedIdentityFallbacks = new Map<string, true>();

function remember<V>(store: Map<string, V>, key: string, value: V): void {
  if (!store.has(key) && store.size >= IDENTITY_FALLBACK_LEDGER_LIMIT) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) {
      store.delete(oldest);
    }
  }
  store.set(key, value);
}

/** Test-only: current number of paths in the identity-fallback warn ledger. */
export function _identityFallbackLedgerSize(): number {
  return loggedIdentityFallbacks.size;
}

/** Test-only: clears the identity-fallback warn ledger. */
export function _resetIdentityFallbackLedger(): void {
  loggedIdentityFallbacks.clear();
}

/**
 * Requirement 1.12's log. The fallback itself lives in
 * {@link normalizeIdentityPath} and is deterministic; this only reports it.
 */
function logIdentityFallback(error: unknown, absolutePath: string): void {
  if (loggedIdentityFallbacks.has(absolutePath)) {
    return;
  }
  remember(loggedIdentityFallbacks, absolutePath, true);
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `[ProjectRegistry] Could not realpath ${absolutePath} (${message}); ` +
    `using the un-normalized absolute path for its identity. This is expected ` +
    `for a directory that has been removed.`
  );
}

/**
 * Generate a stable projectId from a path.
 * The path is `realpath`-normalized first; the id is a SHA-1 hash of the
 * normalized string, encoded as base64url and truncated to 16 characters.
 *
 * **The normalization is inside this function, deliberately** (requirement
 * 1.10). Normalizing at the register site only would be worse than not
 * normalizing at all: the server unregisters by path, so a symlinked workspace
 * would register under the physical id and unregister under the link id,
 * stranding its entry forever. Inside, every call site normalizes by
 * construction — including the dashboard's manual-add path
 * (`project-manager.ts:263`), which never goes through `registerProject`'s
 * resolution at all.
 *
 * **The cost.** This was a pure hash of its argument; it is now
 * filesystem-dependent — one `realpathSync` per call, and a value that can
 * change if the filesystem does. Both are accepted knowingly:
 *
 * - The syscall is per *call*, not per registry entry. {@link readRegistry}
 *   does not call this function (it uses the ids already stored as map keys),
 *   so reading a registry of N entries still costs zero `realpath` calls. The
 *   per-request read paths the dashboard exercises pay one syscall each.
 * - The value can move when a directory is removed, because `realpath` then
 *   fails and the deterministic fallback returns the un-normalized absolute
 *   path — a different string, hence a different id. That is precisely why
 *   requirement 1.13 forbids recomputing an id in order to unregister:
 *   {@link unregisterProjectById} takes the id cached at registration.
 */
export function generateProjectId(projectPath: string): string {
  const identityPath = normalizeIdentityPath(projectPath, logIdentityFallback);
  const hash = createHash('sha1').update(identityPath).digest('base64url');
  // Take first 16 characters for readability
  return hash.substring(0, 16);
}

/**
 * Build display name for a workspace.
 * - Main repo: "repo"
 * - Worktree: "repo · worktree"
 */
export function generateProjectDisplayName(workspacePath: string, workflowRootPath: string): string {
  const workspaceName = basename(workspacePath);
  const repoName = basename(workflowRootPath);

  if (workspacePath === workflowRootPath) {
    return repoName;
  }

  return `${repoName} · ${workspaceName}`;
}

export class ProjectRegistry {
  private registryPath: string;
  private registryDir: string;
  private lockPath: string;
  private needsInitialization: boolean = false;

  constructor() {
    this.registryDir = getGlobalDir();
    this.registryPath = join(this.registryDir, 'activeProjects.json');
    this.lockPath = `${this.registryPath}.lock`;
  }

  /**
   * Ensure the registry directory exists
   */
  private async ensureRegistryDir(): Promise<void> {
    try {
      await fs.mkdir(this.registryDir, { recursive: true });
    } catch (error: any) {
      // Directory might already exist, ignore EEXIST errors
      if (error.code === 'EEXIST') {
        return;
      }
      // For permission errors, provide helpful guidance
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.error(getPermissionErrorHelp('create directory', this.registryDir));
        throw error;
      }
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Read the registry file with atomic operations
   * Returns a map keyed by projectId
   *
   * **This method normalizes on write only. It does NOT `realpath` stored paths
   * on read** — it applies `resolve()`, exactly as before, which is pure and
   * touches no filesystem. Requirement 1.11's "identity and stored path are the
   * same spelling" is established in {@link registerProjectLocked}, where both
   * come off one {@link normalizeIdentityPath} call. The alternative —
   * `realpath`-ing every stored path on every read — was considered and
   * rejected; the two differ observably, so the choice is recorded here:
   *
   * - **Entries written before this change** carry a link spelling under a link
   *   spelling's id. `realpath`-on-read would rewrite the *value* to the
   *   physical path while the map *key* stayed the link-spelling id, because
   *   ids are stored data and are not recomputed on read. That makes identity
   *   and stored path disagree — the exact condition 1.11 exists to forbid —
   *   and it makes it worse, not better. Genuinely repairing such an entry
   *   means re-keying the map, which is a migration; a read path must not
   *   silently rewrite identities. Left alone, the entry is replaced the next
   *   time that workspace registers, and `cleanupStaleProjects` removes the old
   *   one once its instances die.
   * - **A removed worktree** (`git worktree remove`) has no `realpath`, so
   *   `realpath`-on-read would return whatever the stored string resolves to
   *   and callers would see the served spelling depend on filesystem state at
   *   read time. Normalizing on write means a read returns the same string
   *   before and after the directory disappears, which is what lets the
   *   dashboard list and serve the surviving projects unchanged.
   * - **Cost**: reads are the hot path (every dashboard request, every registry
   *   watcher event), and `realpath`-on-read is O(entries) synchronous syscalls
   *   per read on a path that today performs none — and blocks the event loop
   *   if one of those paths sits on an unresponsive mount.
   */
  private async readRegistry(): Promise<Map<string, ProjectRegistryEntry>> {
    await this.ensureRegistryDir();

    try {
      const content = await fs.readFile(this.registryPath, 'utf-8');
      // Handle empty or whitespace-only files
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        console.error(`[ProjectRegistry] Warning: ${this.registryPath} is empty, initializing with empty registry`);
        // Mark that we need to write the file
        this.needsInitialization = true;
        return new Map();
      }
      const data = JSON.parse(trimmedContent) as Record<string, ProjectRegistryEntry>;
      const registry = new Map<string, ProjectRegistryEntry>();

      // Ensure backward compatibility with older formats:
      // - instances may be missing
      // - workflowRootPath may be missing
      for (const [projectId, entry] of Object.entries(data)) {
        const normalizedProjectPath = resolve(entry.projectPath);
        const normalizedWorkflowRootPath = resolve(entry.workflowRootPath || entry.projectPath);

        registry.set(projectId, {
          ...entry,
          projectPath: normalizedProjectPath,
          workflowRootPath: normalizedWorkflowRootPath,
          projectName: entry.projectName || generateProjectDisplayName(normalizedProjectPath, normalizedWorkflowRootPath),
          instances: Array.isArray(entry.instances) ? entry.instances : []
        });
      }

      return registry;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty map
        this.needsInitialization = true;
        return new Map();
      }
      if (error instanceof SyntaxError) {
        // JSON parsing error - file is corrupted or invalid
        console.error(`[ProjectRegistry] Error: Failed to parse ${this.registryPath}: ${error.message}`);
        console.error(`[ProjectRegistry] The file may be corrupted. Initializing with empty registry.`);
        // Back up the corrupted file
        try {
          const backupPath = `${this.registryPath}.corrupted.${Date.now()}`;
          await fs.copyFile(this.registryPath, backupPath);
          console.error(`[ProjectRegistry] Corrupted file backed up to: ${backupPath}`);
        } catch (backupError) {
          // Ignore backup errors
        }
        this.needsInitialization = true;
        return new Map();
      }
      throw error;
    }
  }

  /**
   * Write the registry file atomically
   */
  private async writeRegistry(registry: Map<string, ProjectRegistryEntry>): Promise<void> {
    await this.ensureRegistryDir();

    const data = Object.fromEntries(registry);
    const content = JSON.stringify(data, null, 2);

    // Write to temporary file first, then rename for atomic operation.
    // The temp name is unique to this process (requirement 6.3) so two
    // concurrent writers cannot interleave bytes into one shared temp file.
    const tempPath = uniqueTempPath(this.registryPath);
    await fs.writeFile(tempPath, content, 'utf-8');
    await fs.rename(tempPath, this.registryPath);
  }

  /**
   * Check if a process is still running
   * Note: When running in Docker with path translation, we can't check host PIDs,
   * so we assume processes are alive if path translation is enabled.
   */
  private isProcessAlive(pid: number): boolean {
    // If path translation is enabled, we're in Docker and can't check host PIDs
    const hostPrefix = process.env.SPEC_WORKFLOW_HOST_PATH_PREFIX;
    const containerPrefix = process.env.SPEC_WORKFLOW_CONTAINER_PATH_PREFIX;
    if (hostPrefix && containerPrefix) {
      // Can't verify host PIDs from inside Docker, assume alive
      return true;
    }

    try {
      // Sending signal 0 checks if process exists without actually sending a signal
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Register a project in the global registry
   * Self-healing: If a project exists with dead PIDs, cleans them up and adds new PID
   * Multi-instance: Allows unlimited MCP server instances per project
   *
   * The read-modify-write runs under an exclusive lock (requirement 6.1): with
   * per-worktree identity, N worktrees compute N ids, so two servers starting
   * together each read a registry without the other and the second write erases
   * the first. If the lock cannot be acquired within its budget the server logs
   * prominently and continues UNREGISTERED (requirement 6.4) — this call is
   * awaited before the MCP transport connects, so throwing kills the handshake.
   */
  async registerProject(projectPath: string, pid: number, options: RegisterProjectOptions = {}): Promise<string> {
    const result = await withRegistryLock(
      this.lockPath,
      () => this.registerProjectLocked(projectPath, pid, options)
    );

    if (result.acquired) {
      return result.value;
    }

    const workspacePath = normalizeIdentityPath(projectPath, logIdentityFallback);
    const projectId = generateProjectId(workspacePath);
    console.error(
      `[ProjectRegistry] ================================================================\n` +
      `[ProjectRegistry] WARNING: could not acquire the registry lock at ${this.lockPath}.\n` +
      `[ProjectRegistry] Continuing UNREGISTERED: ${workspacePath} will not appear in the dashboard.\n` +
      `[ProjectRegistry] Remove the lock file if no other instance is running, then restart.\n` +
      `[ProjectRegistry] ================================================================`
    );
    return projectId;
  }

  /**
   * The registry read-modify-write. Callers must hold the registry lock.
   *
   * Both stored paths are `realpath`-normalized, not merely `resolve`d
   * (requirement 1.11): the id below is computed from `workspacePath`, so
   * storing a different spelling of the same directory would put the symlink
   * spelling into every downstream consumer — the spawn cwd, the git cwd and
   * the containment base — while identity used the physical one.
   *
   * `workflowRootPath` is normalized the same way, and not as an afterthought:
   * {@link generateProjectDisplayName} decides between "repo" and
   * "repo · worktree" by comparing the two strings, so normalizing one and not
   * the other would name a symlinked main checkout as if it were a worktree of
   * itself. It is also the root the dashboard runs git in.
   */
  private async registerProjectLocked(projectPath: string, pid: number, options: RegisterProjectOptions = {}): Promise<string> {
    const registry = await this.readRegistry();

    const workspacePath = normalizeIdentityPath(projectPath, logIdentityFallback);
    const workflowRootPath = normalizeIdentityPath(options.workflowRootPath || projectPath, logIdentityFallback);
    const projectId = generateProjectId(workspacePath);
    const projectName = options.projectName || generateProjectDisplayName(workspacePath, workflowRootPath);

    const existing = registry.get(projectId);

    if (existing) {
      // Self-healing: Filter out dead PIDs
      const liveInstances = existing.instances.filter(i => this.isProcessAlive(i.pid));

      // Check if this PID is already registered (avoid duplicates)
      if (!liveInstances.some(i => i.pid === pid)) {
        liveInstances.push({ pid, registeredAt: new Date().toISOString() });
      }

      // Update with live instances (no limit on number of instances)
      existing.projectPath = workspacePath;
      existing.workflowRootPath = workflowRootPath;
      existing.projectName = projectName;
      existing.instances = liveInstances;
      registry.set(projectId, existing);
    } else {
      // New project
      const entry: ProjectRegistryEntry = {
        projectId,
        projectPath: workspacePath,
        workflowRootPath,
        projectName,
        instances: [{ pid, registeredAt: new Date().toISOString() }]
      };
      registry.set(projectId, entry);
    }

    await this.writeRegistry(registry);
    return projectId;
  }

  /**
   * Unregister a project from the global registry by path
   * If pid is provided, only removes that specific instance
   * If no pid provided, removes the entire project (backwards compat)
   *
   * **Prefer {@link unregisterProjectById} with the id cached at registration**
   * (requirement 1.13). This overload recomputes the id from the path, and
   * `realpath` fails once the directory is gone — so after `git worktree
   * remove` the recomputed id is the fallback's id, not the one the entry was
   * written under, and the entry is never deleted. That is a real shutdown
   * ordering, not a hypothetical: the worktree can be removed while the server
   * that registered it is still running.
   */
  async unregisterProject(projectPath: string, pid?: number): Promise<void> {
    await this.unregisterProjectById(generateProjectId(projectPath), pid);
  }

  /**
   * Unregister a project by projectId
   * If pid is provided, only removes that specific instance
   * If no pid provided, removes the entire project
   *
   * The optional-pid convention is the same one {@link unregisterProject}
   * carries, deliberately: a second method name for "by id, but only this
   * instance" would leave two near-identical removal paths to keep in step.
   */
  async unregisterProjectById(projectId: string, pid?: number): Promise<void> {
    const registry = await this.readRegistry();

    const entry = registry.get(projectId);
    if (!entry) return;

    if (pid !== undefined) {
      // Remove only this PID's instance
      entry.instances = entry.instances.filter(i => i.pid !== pid);
      if (entry.instances.length === 0) {
        registry.delete(projectId);
      } else {
        registry.set(projectId, entry);
      }
    } else {
      // Remove entire project
      registry.delete(projectId);
    }

    await this.writeRegistry(registry);
  }

  /**
   * Get all active projects from the registry
   */
  async getAllProjects(): Promise<ProjectRegistryEntry[]> {
    const registry = await this.readRegistry();
    return Array.from(registry.values());
  }

  /**
   * Get a specific project by path
   */
  async getProject(projectPath: string): Promise<ProjectRegistryEntry | null> {
    const registry = await this.readRegistry();
    // generateProjectId resolves and realpath-normalizes its argument itself.
    const projectId = generateProjectId(projectPath);
    return registry.get(projectId) || null;
  }

  /**
   * Get a specific project by projectId
   */
  async getProjectById(projectId: string): Promise<ProjectRegistryEntry | null> {
    const registry = await this.readRegistry();
    return registry.get(projectId) || null;
  }

  /**
   * Clean up stale instances (where the process is no longer running)
   * Projects with no live instances are removed entirely
   * Returns the count of removed instances
   */
  async cleanupStaleProjects(): Promise<number> {
    const registry = await this.readRegistry();
    let removedInstanceCount = 0;
    let needsWrite = this.needsInitialization; // Write if file needs initialization

    for (const [projectId, entry] of registry.entries()) {
      const liveInstances = entry.instances.filter(i => this.isProcessAlive(i.pid));
      const deadCount = entry.instances.length - liveInstances.length;

      if (deadCount > 0) {
        removedInstanceCount += deadCount;
        needsWrite = true;

        if (liveInstances.length === 0) {
          // No live instances, remove entire project
          registry.delete(projectId);
        } else {
          // Keep project with only live instances
          entry.instances = liveInstances;
          registry.set(projectId, entry);
        }
      }
    }

    if (needsWrite) {
      await this.writeRegistry(registry);
      this.needsInitialization = false; // Reset flag after successful write
    }

    return removedInstanceCount;
  }

  /**
   * Check if a project is registered by path
   */
  async isProjectRegistered(projectPath: string): Promise<boolean> {
    const registry = await this.readRegistry();
    // generateProjectId resolves and realpath-normalizes its argument itself.
    const projectId = generateProjectId(projectPath);
    return registry.has(projectId);
  }

  /**
   * Get the registry file path for watching
   */
  getRegistryPath(): string {
    return this.registryPath;
  }
}
