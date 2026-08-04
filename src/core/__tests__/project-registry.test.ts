import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import {
  ProjectRegistry,
  generateProjectId,
  IDENTITY_FALLBACK_LEDGER_LIMIT,
  _identityFallbackLedgerSize,
  _resetIdentityFallbackLedger
} from '../project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../global-dir.js';

describe('ProjectRegistry worktree identity', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `spec-workflow-registry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = tempDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('stores workspace identity and workflow root separately', async () => {
    const registry = new ProjectRegistry();
    const workspacePath = '/tmp/worktrees/feature-auth';
    const workflowRootPath = '/tmp/my-repo';

    const projectId = await registry.registerProject(workspacePath, process.pid, { workflowRootPath });
    const entry = await registry.getProjectById(projectId);

    expect(entry).not.toBeNull();
    expect(entry?.projectPath).toBe(workspacePath);
    expect(entry?.workflowRootPath).toBe(workflowRootPath);
    expect(entry?.projectName).toBe('my-repo · feature-auth');
  });

  it('generates different project IDs for different worktrees of same repo', async () => {
    const registry = new ProjectRegistry();
    const workflowRootPath = '/tmp/my-repo';

    const projectIdA = await registry.registerProject('/tmp/worktrees/feature-a', process.pid, { workflowRootPath });
    const projectIdB = await registry.registerProject('/tmp/worktrees/feature-b', process.pid, { workflowRootPath });

    expect(projectIdA).not.toBe(projectIdB);
  });

  it('normalizes legacy entries without workflowRootPath', async () => {
    const workspacePath = '/tmp/my-repo';
    const projectId = generateProjectId(workspacePath);
    const registryPath = join(tempDir, 'activeProjects.json');

    const legacyData = {
      [projectId]: {
        projectId,
        projectPath: workspacePath,
        projectName: 'my-repo',
        instances: [{ pid: process.pid, registeredAt: new Date().toISOString() }]
      }
    };

    await fs.writeFile(registryPath, JSON.stringify(legacyData, null, 2), 'utf-8');

    const registry = new ProjectRegistry();
    const projects = await registry.getAllProjects();

    expect(projects).toHaveLength(1);
    expect(projects[0].workflowRootPath).toBe(workspacePath);
    expect(projects[0].projectPath).toBe(workspacePath);
  });
});

/**
 * Requirements 1.10-1.13 — one directory to one identity, and a removed
 * worktree that actually unregisters.
 *
 * Every path here is built under a `realpath`-normalized temp root, so the only
 * symlinks in play are the ones a test creates deliberately. Without that, the
 * macOS `/var` -> `/private/var` link would make `resolve` and `realpath`
 * disagree everywhere and the assertions would stop meaning what they say.
 */
describe.skipIf(process.platform === 'win32')('ProjectRegistry identity normalization', () => {
  const PID = 424242;
  let root: string;      // realpath-normalized temp root
  let globalDir: string; // SPEC_WORKFLOW_HOME for this test
  const roots: string[] = [];
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    const created = await fs.mkdtemp(join(tmpdir(), 'specwf-registry-identity-'));
    root = await fs.realpath(created);
    roots.push(root);
    globalDir = join(root, 'global');
    await fs.mkdir(globalDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = globalDir;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Vitest workers never emit a process `exit`, so teardown must be explicit.
  afterAll(async () => {
    for (const dir of roots) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  /** `<root>/real/<name>` with `<root>/link` -> `<root>/real`. */
  async function symlinkedWorkspace(name: string): Promise<{ physical: string; viaLink: string }> {
    const realParent = join(root, 'real');
    const physical = join(realParent, name);
    await fs.mkdir(physical, { recursive: true });
    const linkParent = join(root, 'link');
    await fs.symlink(realParent, linkParent, 'dir').catch((error: any) => {
      if (error.code !== 'EEXIST') throw error;
    });
    return { physical, viaLink: join(linkParent, name) };
  }

  describe('requirement 1.10 — one directory, one identity', () => {
    it('computes the same id for a link spelling and its physical path', async () => {
      const { physical, viaLink } = await symlinkedWorkspace('repo');

      expect(generateProjectId(viaLink)).toBe(generateProjectId(physical));
    });

    it('normalizes inside generateProjectId, so a bare call site needs no help', async () => {
      // The guard against "normalize at the register site only". The dashboard's
      // manual-add path and the registry's own read paths call this function
      // directly; if normalization lived in registerProject, this would fail.
      const { physical, viaLink } = await symlinkedWorkspace('repo');
      const registry = new ProjectRegistry();

      const projectId = await registry.registerProject(viaLink, PID, { workflowRootPath: viaLink });

      expect(projectId).toBe(generateProjectId(physical));
      expect(await registry.isProjectRegistered(physical)).toBe(true);
      expect(await registry.isProjectRegistered(viaLink)).toBe(true);
    });

    it('registers and unregisters a symlinked path under one id', async () => {
      // The whole point of putting normalization inside generateProjectId: the
      // path-based unregister recomputes the id, and it must land on the entry
      // that registration wrote.
      const { viaLink } = await symlinkedWorkspace('repo');
      const registry = new ProjectRegistry();

      await registry.registerProject(viaLink, PID, { workflowRootPath: viaLink });
      await registry.unregisterProject(viaLink, PID);

      expect(await registry.getAllProjects()).toHaveLength(0);
    });
  });

  describe('requirement 1.11 — identity and stored path are the same spelling', () => {
    it('stores the physical spelling of both roots', async () => {
      const { physical, viaLink } = await symlinkedWorkspace('repo');
      const registry = new ProjectRegistry();

      const projectId = await registry.registerProject(viaLink, PID, { workflowRootPath: viaLink });
      const entry = await registry.getProjectById(projectId);

      expect(entry?.projectPath).toBe(physical);
      expect(entry?.workflowRootPath).toBe(physical);
      // And the id is the id of exactly that stored spelling.
      expect(entry?.projectId).toBe(generateProjectId(entry!.projectPath));
    });

    it('names a symlinked main checkout "repo", not "repo · repo"', async () => {
      // generateProjectDisplayName branches on workspacePath === workflowRootPath.
      // Normalizing one root and not the other makes a main checkout reached
      // through a symlink look like a worktree of itself.
      const { viaLink } = await symlinkedWorkspace('repo');
      const registry = new ProjectRegistry();

      const projectId = await registry.registerProject(viaLink, PID, { workflowRootPath: viaLink });

      expect((await registry.getProjectById(projectId))?.projectName).toBe('repo');
    });

    it('stores the physical workspace under a physical workflow root for a worktree', async () => {
      const mainRepo = join(root, 'real', 'main-repo');
      await fs.mkdir(mainRepo, { recursive: true });
      const { physical, viaLink } = await symlinkedWorkspace('feature-a');
      const registry = new ProjectRegistry();

      const projectId = await registry.registerProject(viaLink, PID, { workflowRootPath: mainRepo });
      const entry = await registry.getProjectById(projectId);

      expect(entry?.projectPath).toBe(physical);
      expect(entry?.workflowRootPath).toBe(mainRepo);
      expect(entry?.projectName).toBe('main-repo · feature-a');
    });
  });

  describe('requirement 1.12 — deterministic fallback when realpath fails', () => {
    it('falls back to the un-normalized absolute path and agrees with itself', async () => {
      const missing = join(root, 'never-created');

      expect(generateProjectId(missing)).toBe(generateProjectId(missing));
      expect(generateProjectId(missing)).toBe(generateProjectId(resolve(missing)));
    });

    it('reads back an entry whose directory has been removed, without throwing', async () => {
      // A removed worktree must not stop the dashboard starting or serving the
      // projects that survive. readRegistry normalizes on write only, so a read
      // of a dead entry performs no realpath and cannot fail on one.
      const { physical } = await symlinkedWorkspace('doomed');
      const survivor = join(root, 'real', 'survivor');
      await fs.mkdir(survivor, { recursive: true });
      const registry = new ProjectRegistry();

      const doomedId = await registry.registerProject(physical, PID, { workflowRootPath: physical });
      await registry.registerProject(survivor, PID, { workflowRootPath: survivor });
      await fs.rm(physical, { recursive: true, force: true });

      const projects = await registry.getAllProjects();
      expect(projects).toHaveLength(2);
      // The stored spelling did not move when the directory went away.
      expect(projects.find(p => p.projectId === doomedId)?.projectPath).toBe(physical);
    });
  });

  describe('requirement 1.13 — unregister by the id cached at registration', () => {
    it('recomputes a DIFFERENT id once a symlinked worktree is removed', async () => {
      // The premise. If this ever stops holding, the cached-id requirement has
      // lost its reason and this suite is testing nothing.
      const { physical, viaLink } = await symlinkedWorkspace('gone');
      const registeredId = generateProjectId(viaLink);

      await fs.rm(physical, { recursive: true, force: true });

      expect(generateProjectId(viaLink)).not.toBe(registeredId);
    });

    it('deletes the instance by cached id after the worktree is removed', async () => {
      const { physical, viaLink } = await symlinkedWorkspace('gone');
      const registry = new ProjectRegistry();
      const cachedId = await registry.registerProject(viaLink, PID, { workflowRootPath: viaLink });

      await fs.rm(physical, { recursive: true, force: true });
      await registry.unregisterProjectById(cachedId, PID);

      expect(await registry.getProjectById(cachedId)).toBeNull();
      expect(await registry.getAllProjects()).toHaveLength(0);
    });

    it('leaves the entry behind when the id is recomputed from the removed path', async () => {
      // What server.stop() used to do. Kept as a live demonstration of the bug
      // requirement 1.13 closes, so a revert to path-based unregistration is
      // caught here rather than in production.
      const { physical, viaLink } = await symlinkedWorkspace('gone');
      const registry = new ProjectRegistry();
      const cachedId = await registry.registerProject(viaLink, PID, { workflowRootPath: viaLink });

      await fs.rm(physical, { recursive: true, force: true });
      await registry.unregisterProject(viaLink, PID);

      expect(await registry.getProjectById(cachedId)).not.toBeNull();
    });

    it('removes only the named instance when a pid is passed, and the entry when it is not', async () => {
      // Two instances have to be written directly: registerProject filters dead
      // pids as it goes, and only one live pid exists inside a test process.
      const { physical } = await symlinkedWorkspace('multi');
      const projectId = generateProjectId(physical);
      const registeredAt = new Date().toISOString();
      await fs.writeFile(
        join(globalDir, 'activeProjects.json'),
        JSON.stringify({
          [projectId]: {
            projectId,
            projectPath: physical,
            workflowRootPath: physical,
            projectName: 'multi',
            instances: [{ pid: PID, registeredAt }, { pid: process.pid, registeredAt }]
          }
        }, null, 2),
        'utf-8'
      );
      const registry = new ProjectRegistry();

      await registry.unregisterProjectById(projectId, PID);

      const entry = await registry.getProjectById(projectId);
      expect(entry?.instances.map(i => i.pid)).toEqual([process.pid]);

      await registry.unregisterProjectById(projectId);
      expect(await registry.getProjectById(projectId)).toBeNull();
    });

    it('is a no-op for an unknown id', async () => {
      const { physical } = await symlinkedWorkspace('keep');
      const registry = new ProjectRegistry();
      const projectId = await registry.registerProject(physical, PID, { workflowRootPath: physical });

      await registry.unregisterProjectById('no-such-id-000');

      expect(await registry.getProjectById(projectId)).not.toBeNull();
    });
  });
});

/**
 * Requirement 1.12's warn-once ledger and its bound.
 *
 * The ledger is keyed by the path `generateProjectId` was handed, and that path
 * can come from outside the process: the dashboard's manual-add route passes
 * whatever the user typed. Unbounded, a caller supplying a fresh unresolvable
 * path each time leaks a key per call for the lifetime of the process — the
 * same leak `ROOT_SELECTION_CACHE_LIMIT` bounds in `tools/root-selection.ts`,
 * so the bound here is the same one and these tests mirror those.
 *
 * No directory is created: `realpath` fails on a path that does not exist,
 * which is exactly the fallback under test.
 */
describe('requirement 1.12 — the identity-fallback ledger and its bound', () => {
  let base: string;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  function errors(): string[] {
    return errorSpy.mock.calls.map((call: unknown[]) => String(call[0]));
  }

  beforeEach(() => {
    base = join(tmpdir(), `specwf-identity-ledger-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    _resetIdentityFallbackLedger();
  });

  afterEach(() => {
    errorSpy.mockRestore();
    _resetIdentityFallbackLedger();
  });

  it('logs a given path once, however many times its id is computed', () => {
    const missing = join(base, 'never-created');

    generateProjectId(missing);
    generateProjectId(missing);
    generateProjectId(missing);

    expect(errors().filter((message) => message.includes(missing))).toHaveLength(1);
  });

  it('caps the ledger, so a caller varying the path cannot grow it without bound', () => {
    const extra = 8;
    for (let i = 0; i < IDENTITY_FALLBACK_LEDGER_LIMIT + extra; i++) {
      generateProjectId(join(base, `missing-${i}`));
    }

    expect(_identityFallbackLedgerSize()).toBe(IDENTITY_FALLBACK_LEDGER_LIMIT);
  });

  it('evicts oldest-first, so an aged-out path logs again', () => {
    const aged = join(base, 'aged-out');
    generateProjectId(aged);
    expect(errors().filter((message) => message.includes(aged))).toHaveLength(1);

    for (let i = 0; i < IDENTITY_FALLBACK_LEDGER_LIMIT; i++) {
      generateProjectId(join(base, `filler-${i}`));
    }
    generateProjectId(aged);

    // The id is unchanged — only the ledger moved — so a second line for the
    // same path can only mean its key was evicted.
    expect(errors().filter((message) => message.includes(aged))).toHaveLength(2);
    expect(_identityFallbackLedgerSize()).toBe(IDENTITY_FALLBACK_LEDGER_LIMIT);
  });
});
