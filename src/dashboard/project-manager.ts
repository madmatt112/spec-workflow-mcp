import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { SpecParser } from './parser.js';
import { SpecWatcher } from './watcher.js';
import { ApprovalStorage } from './approval-storage.js';
import { ProjectRegistry, ProjectRegistryEntry, ProjectInstance } from '../core/project-registry.js';
import { PathUtils } from '../core/path-utils.js';
import { resolveGitRoot, resolveGitWorkspaceRoot, normalizeIdentityPath, linkedWorktreeInfo } from '../core/git-utils.js';
import { readProjects, rememberProject, forgetProject, pruneMissingProjects } from '../controller/state.js';
import { isPathMissing } from './path-missing.js';
import { computeFolds, FoldCandidate } from './project-folding.js';

/** Logs a fold-classification failure once per project id per process. */
const loggedFoldErrors = new Set<string>();
function onFoldError(projectId: string, error: unknown): void {
  if (loggedFoldErrors.has(projectId)) return;
  loggedFoldErrors.add(projectId);
  console.error(`Could not classify project ${projectId} as a worktree:`, error);
}

export interface ProjectContext {
  projectId: string;
  projectPath: string;           // Translated workflow root path for specs/.spec-workflow access
  workspacePath: string;         // Translated workspace/worktree path for file artifact resolution
  originalProjectPath: string;   // Original workspace path for display/registry
  workflowRootPath: string;      // Original workflow root path for display/debugging
  projectName: string;
  instances: ProjectInstance[];  // Active MCP server instances for this project
  parser: SpecParser;
  watcher: SpecWatcher;
  approvalStorage: ApprovalStorage;
}

export class ProjectManager extends EventEmitter {
  private registry: ProjectRegistry;
  private projects: Map<string, ProjectContext> = new Map();
  private registryWatcher?: chokidar.FSWatcher;
  private watcherDebounceTimer?: NodeJS.Timeout;
  private syncChain: Promise<void> = Promise.resolve();

  constructor() {
    super();
    this.registry = new ProjectRegistry();
  }

  /**
   * Initialize the project manager: prune stale/missing entries, run one full
   * reconcile, then start watching the registry for changes. Note: MCP
   * servers handle their own lifecycle cleanup via stop().
   */
  async initialize(): Promise<void> {
    // Clean up stale instances and missing paths once at startup (self-healing
    // for crashes and for a workspace removed while nothing was running).
    await this.registry.cleanupStaleProjects(isPathMissing);
    await pruneMissingProjects(isPathMissing);

    await this.syncWithRegistry();

    // Watch registry file for changes
    this.startRegistryWatcher();
  }

  /**
   * Start watching the registry file for changes. Change/add events are
   * debounced 100ms (trailing) so a burst of registry writes runs one
   * reconcile instead of one per write (design C3).
   */
  private startRegistryWatcher(): void {
    const registryPath = this.registry.getRegistryPath();

    this.registryWatcher = chokidar.watch(registryPath, {
      ignoreInitial: true,
      persistent: true,
      ignorePermissionErrors: true
    });

    this.registryWatcher.on('change', () => this.scheduleSync());
    this.registryWatcher.on('add', () => this.scheduleSync());

    // Add error handler to prevent watcher crashes
    this.registryWatcher.on('error', (error) => {
      console.error('Registry watcher error:', error);
      // Don't propagate error to prevent system crash
    });
  }

  private scheduleSync(): void {
    if (this.watcherDebounceTimer) clearTimeout(this.watcherDebounceTimer);
    this.watcherDebounceTimer = setTimeout(() => {
      this.watcherDebounceTimer = undefined;
      void this.syncWithRegistry();
    }, 100);
  }

  /**
   * The one reconcile (design C3, C1/C2 folding): candidates are every
   * registry entry plus every durable-list entry the registry lacks
   * (instances empty), each file read once. Folded and absent candidates
   * hold no context; every other candidate gets one (a new context via
   * `addProject`, or an in-place update). Emits one `projects-update`.
   *
   * Serialized: a call waits for the one already running, then makes its own
   * full pass, so a sync started while another is mid-flight still observes
   * whatever state existed when it was called, not a stale snapshot.
   */
  private async syncWithRegistry(): Promise<void> {
    const run = this.syncChain.then(() => this.syncOnce(), () => this.syncOnce());
    this.syncChain = run;
    return run;
  }

  private async syncOnce(): Promise<void> {
    try {
      const entries = await this.registry.getAllProjects();
      const remembered = (await readProjects()).projects;

      const fullEntries = new Map<string, ProjectRegistryEntry>();
      for (const entry of entries) {
        fullEntries.set(entry.projectId, entry);
      }
      for (const p of remembered) {
        if (fullEntries.has(p.id)) continue;
        fullEntries.set(p.id, {
          projectId: p.id,
          projectPath: p.workspacePath,
          workflowRootPath: p.workflowRootPath,
          projectName: p.name,
          instances: [],
        });
      }

      const candidates: FoldCandidate[] = Array.from(fullEntries.values()).map((e) => ({
        projectId: e.projectId,
        projectPath: e.projectPath,
        workflowRootPath: e.workflowRootPath,
      }));

      const folds = computeFolds(candidates, linkedWorktreeInfo, onFoldError);

      for (const candidate of candidates) {
        if (folds.has(candidate.projectId)) continue;
        const entry = fullEntries.get(candidate.projectId)!;
        const existing = this.projects.get(entry.projectId);
        if (existing) {
          existing.projectName = entry.projectName;
          existing.originalProjectPath = entry.projectPath;
          existing.workflowRootPath = entry.workflowRootPath;
          existing.projectPath = PathUtils.translatePath(entry.workflowRootPath);
          existing.workspacePath = PathUtils.translatePath(entry.projectPath);
          existing.instances = entry.instances || [];
        } else {
          await this.addProject(entry);
        }
      }

      for (const projectId of Array.from(this.projects.keys())) {
        if (folds.has(projectId) || !fullEntries.has(projectId)) {
          await this.removeProject(projectId);
        }
      }

      // Emit projects update event
      this.emit('projects-update', this.getProjectsList());
    } catch (error) {
      console.error('Error syncing with registry:', error);
    }
  }

  /**
   * Add a project context
   */
  private async addProject(entry: ProjectRegistryEntry): Promise<void> {
    try {
      // Translate paths once at entry point (components should not know about Docker)
      const translatedWorkspacePath = PathUtils.translatePath(entry.projectPath);
      const translatedWorkflowRootPath = PathUtils.translatePath(entry.workflowRootPath);

      const parser = new SpecParser(translatedWorkflowRootPath);
      const watcher = new SpecWatcher(translatedWorkflowRootPath, parser);
      const approvalStorage = new ApprovalStorage(translatedWorkflowRootPath, {
        originalPath: entry.workflowRootPath,
        fileResolutionPath: translatedWorkspacePath
      });

      // Start watchers
      await watcher.start();
      await approvalStorage.start();

      // Forward events with projectId
      watcher.on('change', (event) => {
        this.emit('spec-change', { projectId: entry.projectId, ...event });
      });

      watcher.on('task-update', (event) => {
        this.emit('task-update', { projectId: entry.projectId, ...event });
      });

      watcher.on('steering-change', (event) => {
        this.emit('steering-change', { projectId: entry.projectId, ...event });
      });

      watcher.on('deferral-change', (event) => {
        this.emit('deferral-change', { projectId: entry.projectId, ...event });
      });

      approvalStorage.on('approval-change', () => {
        this.emit('approval-change', { projectId: entry.projectId });
      });

      const context: ProjectContext = {
        projectId: entry.projectId,
        projectPath: translatedWorkflowRootPath,
        workspacePath: translatedWorkspacePath,
        originalProjectPath: entry.projectPath, // Keep workspace path for display/registry
        workflowRootPath: entry.workflowRootPath,
        projectName: entry.projectName,
        instances: entry.instances || [],       // Track MCP server instances
        parser,
        watcher,
        approvalStorage
      };

      this.projects.set(entry.projectId, context);
      console.error(`Project added: ${entry.projectName} (${entry.projectId})`);

      // Remember it in the harness home so it survives the MCP process and
      // the controller restarting (best effort; a failed write is logged). A
      // worktree project (workspace under a different root than its spec store)
      // is a run's transient MCP server, never a launch target: listed while it
      // is alive, not remembered.
      if (entry.projectPath === entry.workflowRootPath) {
        try {
          await rememberProject({
            id: entry.projectId, workspacePath: entry.projectPath,
            workflowRootPath: entry.workflowRootPath, name: entry.projectName,
          });
        } catch (error) {
          console.error(`Could not remember project ${entry.projectId}:`, error);
        }
      }

      // Emit project added event
      this.emit('project-added', entry.projectId);
    } catch (error) {
      console.error(`Failed to add project ${entry.projectName}:`, error);
    }
  }

  /**
   * Remove a project context
   */
  private async removeProject(projectId: string): Promise<void> {
    const context = this.projects.get(projectId);
    if (!context) return;

    try {
      // Stop watchers
      await context.watcher.stop();
      await context.approvalStorage.stop();

      // Remove all listeners
      context.watcher.removeAllListeners();
      context.approvalStorage.removeAllListeners();

      this.projects.delete(projectId);
      console.error(`Project removed: ${context.projectName} (${projectId})`);

      // Emit project removed event
      this.emit('project-removed', projectId);
    } catch (error) {
      console.error(`Failed to remove project ${projectId}:`, error);
    }
  }

  /**
   * Get a project context by ID
   */
  getProject(projectId: string): ProjectContext | undefined {
    return this.projects.get(projectId);
  }

  /**
   * Get all project contexts
   */
  getAllProjects(): ProjectContext[] {
    return Array.from(this.projects.values());
  }

  /**
   * Get projects list for API
   */
  getProjectsList(): Array<{
    projectId: string;
    projectName: string;
    projectPath: string;
    workflowRootPath: string;
    instances: ProjectInstance[];
  }> {
    return Array.from(this.projects.values()).map(p => ({
      projectId: p.projectId,
      projectName: p.projectName,
      projectPath: p.originalProjectPath,  // Return original path for display
      workflowRootPath: p.workflowRootPath, // Untranslated workflow root, for display/debugging
      instances: p.instances
    }));
  }

  /**
   * Manually add a project by path.
   *
   * With an explicit `workflowRootPath` (design C7), the store root is that value
   * rather than `resolveGitRoot`, and the project is remembered even though its
   * two paths differ: an explicit root marks an operator registration, not a
   * run's transient worktree server (D3). A failed durable write rejects.
   */
  async addProjectByPath(projectPath: string, workflowRootPath?: string): Promise<string> {
    const workspacePath = resolveGitWorkspaceRoot(projectPath);

    if (workflowRootPath === undefined) {
      const storeRoot = resolveGitRoot(workspacePath);

      const entry = await this.registry.getProject(workspacePath);
      if (entry) {
        // Already registered
        await this.syncWithRegistry();
        return entry.projectId;
      }

      // Register new project (with dummy PID since it's manual)
      const projectId = await this.registry.registerProject(workspacePath, process.pid, {
        workflowRootPath: storeRoot
      });

      await this.syncWithRegistry();
      return projectId;
    }

    // Explicit store root: canonicalise it the way the registry stores paths
    // (D9), reuse an entry that already points at it, else register — which
    // updates an existing entry in place under the same id.
    const storeRoot = normalizeIdentityPath(workflowRootPath);
    const existing = await this.registry.getProject(workspacePath);
    const projectId = existing && existing.workflowRootPath === storeRoot
      ? existing.projectId
      : await this.registry.registerProject(workspacePath, process.pid, { workflowRootPath: storeRoot });

    const entry = await this.registry.getProjectById(projectId);
    if (!entry) {
      await this.syncWithRegistry();
      return projectId;
    }

    // Remember it even though the two paths differ; a failed write rejects so
    // the route answers 500 (gap 1, D3).
    await rememberProject({
      id: entry.projectId,
      workspacePath: entry.projectPath,
      workflowRootPath: entry.workflowRootPath,
      name: entry.projectName,
    });

    await this.syncWithRegistry();
    return entry.projectId;
  }

  /**
   * Manually remove a project: forget it (a lock miss rejects, removing
   * nothing), unregister it, then let the reconcile drop its context.
   */
  async removeProjectById(projectId: string): Promise<void> {
    await forgetProject(projectId);
    await this.registry.unregisterProjectById(projectId);
    await this.syncWithRegistry();
  }

  /**
   * Stop the project manager
   */
  async stop(): Promise<void> {
    if (this.watcherDebounceTimer) {
      clearTimeout(this.watcherDebounceTimer);
      this.watcherDebounceTimer = undefined;
    }

    // Stop registry watcher
    if (this.registryWatcher) {
      this.registryWatcher.removeAllListeners();
      await this.registryWatcher.close();
      this.registryWatcher = undefined;
    }

    // Stop all projects
    const projectIds = Array.from(this.projects.keys());
    for (const projectId of projectIds) {
      await this.removeProject(projectId);
    }

    // Remove all listeners
    this.removeAllListeners();
  }
}
