import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { ProjectManager } from '../project-manager.js';
import { ProjectRegistry } from '../../core/project-registry.js';
import { readProjects } from '../../controller/state.js';

// Contract for the durable project list (controller-design.md §3): a project the
// dashboard has seen stays listed across a restart of the dashboard process and
// after its last MCP server process exits, with no instances; removing it from
// the dashboard forgets it. SDD_HOME and SPEC_WORKFLOW_HOME are per-worker temp
// dirs (vitest.setup.ts), so the registry and the home are isolated here.

function makeRepo(base: string, name: string): string {
  const repo = join(base, name);
  mkdirSync(join(repo, '.spec-workflow', 'specs'), { recursive: true });
  execFileSync('git', ['-C', repo, 'init', '-q']);
  writeFileSync(join(repo, 'README.md'), 'x\n');
  return repo;
}

let base: string;
let managers: ProjectManager[] = [];
const savedEnv = { SDD_HOME: process.env.SDD_HOME, SPEC_WORKFLOW_HOME: process.env.SPEC_WORKFLOW_HOME };

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'pm-durable-'));
  // The global setup isolates the home per worker; these tests need it per test,
  // since the list under test is exactly what survives between managers.
  process.env.SDD_HOME = join(base, 'sdd-home');
  process.env.SPEC_WORKFLOW_HOME = join(base, 'global');
});
afterEach(async () => {
  for (const m of managers) await m.stop();
  managers = [];
  process.env.SDD_HOME = savedEnv.SDD_HOME;
  process.env.SPEC_WORKFLOW_HOME = savedEnv.SPEC_WORKFLOW_HOME;
  rmSync(base, { recursive: true, force: true });
});

async function start(): Promise<ProjectManager> {
  const m = new ProjectManager();
  await m.initialize();
  managers.push(m);
  return m;
}

describe('ProjectManager durable project list', () => {
  it('keeps a manually added project across a restart with no live MCP instance', async () => {
    const repo = makeRepo(base, 'alpha');
    const first = await start();
    const id = await first.addProjectByPath(repo);
    expect(first.getProject(id)).toBeDefined();
    const remembered = await readProjects();
    expect(remembered.projects.map((p) => p.id)).toEqual([id]);
    await first.stop();
    managers = [];

    // The manual add registered this process's pid; a fresh registry cleanup
    // would keep it only because this process is alive. Simulate the MCP (or
    // dashboard) process being gone by unregistering it outright.
    await new ProjectRegistry().unregisterProjectById(id);

    const second = await start();
    const project = second.getProject(id);
    expect(project).toBeDefined();
    expect(project?.instances).toEqual([]);
    expect(second.getProjectsList().map((p) => p.projectId)).toEqual([id]);
  });

  it('does not remember a worktree project (a run\'s transient MCP server)', async () => {
    const repo = makeRepo(base, 'delta');
    execFileSync('git', ['-C', repo, 'add', '-A']);
    execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init']);
    const wt = join(base, 'delta-wt');
    execFileSync('git', ['-C', repo, 'worktree', 'add', '-q', wt]);
    const first = await start();
    const mainId = await first.addProjectByPath(repo);
    // A worktree registers through the registry as its MCP server would: workspace = the
    // worktree, workflow root = the main checkout.
    await new ProjectRegistry().registerProject(wt, process.pid, { workflowRootPath: repo });
    await (first as unknown as { syncWithRegistry(): Promise<void> }).syncWithRegistry();
    const ids = (await readProjects()).projects.map((p) => p.id);
    expect(ids).toEqual([mainId]);
    // Folds into the main project while its instance is alive (R1 AC1).
    expect(first.getProjectsList().length).toBe(1);
    expect(first.getProjectsList()[0]?.projectId).toBe(mainId);
  });

  it('forgets a project the operator removes', async () => {
    const repo = makeRepo(base, 'beta');
    const first = await start();
    const id = await first.addProjectByPath(repo);
    await first.removeProjectById(id);
    expect((await readProjects()).projects).toEqual([]);
    await first.stop();
    managers = [];

    const second = await start();
    expect(second.getProject(id)).toBeUndefined();
  });

  it('prunes a remembered project at startup once its directory is gone (R4 AC2)', async () => {
    const repo = makeRepo(base, 'gamma');
    const first = await start();
    const id = await first.addProjectByPath(repo);
    await first.stop();
    managers = [];
    await new ProjectRegistry().unregisterProjectById(id);
    rmSync(repo, { recursive: true, force: true });

    const second = await start();
    // Pruned at startup: its workspace directory is gone, so it is dropped
    // from the durable list (R4 AC2) and its row is gone (R7 AC3).
    expect((await readProjects()).projects.map((p) => p.id)).toEqual([]);
    expect(second.getProjectsList().some((p) => p.projectId === id)).toBe(false);
  });

  it('removes a registry entry whose workspace is gone even though its pid is alive (R4 AC1)', async () => {
    const repo = makeRepo(base, 'deadpath');
    const id = await new ProjectRegistry().registerProject(repo, process.pid);
    rmSync(repo, { recursive: true, force: true });

    const first = await start();

    expect(await new ProjectRegistry().getProjectById(id)).toBeNull();
    expect(first.getProjectsList().some((p) => p.projectId === id)).toBe(false);
  });

  it("lists each project's workflowRootPath on getProjectsList (R2 AC8)", async () => {
    const repo = makeRepo(base, 'wfroot');
    const storeRoot = join(base, 'wfroot-store');
    mkdirSync(storeRoot, { recursive: true });
    const first = await start();

    const id = await first.addProjectByPath(repo, storeRoot);

    const item = first.getProjectsList().find((p) => p.projectId === id);
    expect(item).toMatchObject({
      projectPath: realpathSync(repo),
      workflowRootPath: realpathSync(storeRoot),
    });
  });

  it('folds the worktree into its parent, relists it when the parent is removed, and folds it again (R1 AC1, AC2, AC3, AC4, AC5)', async () => {
    const repo = makeRepo(base, 'wtree-main');
    execFileSync('git', ['-C', repo, 'add', '-A']);
    execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init']);
    const wt = join(base, 'wtree-main-wt');
    execFileSync('git', ['-C', repo, 'worktree', 'add', '-q', wt]);

    const first = await start();
    const wtId = await new ProjectRegistry().registerProject(wt, process.pid, { workflowRootPath: repo });
    await (first as unknown as { syncWithRegistry(): Promise<void> }).syncWithRegistry();

    // No parent registered yet: the worktree is listed as its own project (R1 AC3).
    expect(first.getProjectsList().map((p) => p.projectId)).toEqual([wtId]);
    expect(first.getProject(wtId)).toBeDefined();

    // The parent appears: the worktree folds into it, holding no context of
    // its own (R1 AC1, AC4, AC5).
    const mainId = await first.addProjectByPath(repo);
    expect(first.getProjectsList().map((p) => p.projectId)).toEqual([mainId]);
    expect(first.getProject(wtId)).toBeUndefined();

    // The parent is removed: the worktree relists, unfolded again (R1 AC5).
    await first.removeProjectById(mainId);
    expect(first.getProjectsList().map((p) => p.projectId)).toEqual([wtId]);
    expect(first.getProject(wtId)).toBeDefined();

    // The parent comes back: it folds again.
    const mainId2 = await first.addProjectByPath(repo);
    expect(first.getProjectsList().map((p) => p.projectId)).toEqual([mainId2]);
    expect(first.getProject(wtId)).toBeUndefined();
  });

  it('two concurrent syncWithRegistry calls add a new candidate only once (design C3 serialization)', async () => {
    const repo = makeRepo(base, 'concur');
    const first = await start();
    const id = await new ProjectRegistry().registerProject(repo, process.pid);

    let addedCount = 0;
    first.on('project-added', (addedId: string) => {
      if (addedId === id) addedCount++;
    });

    const manager = first as unknown as { syncWithRegistry(): Promise<void> };
    await Promise.all([manager.syncWithRegistry(), manager.syncWithRegistry()]);

    expect(addedCount).toBe(1);
    expect(first.getProject(id)).toBeDefined();
  });

  it('a burst of five registry writes within 100ms runs one reconcile (design C3 debounce)', async () => {
    const first = await start();
    let updates = 0;
    first.on('projects-update', () => { updates++; });

    const registry = new ProjectRegistry();
    const repos = ['b1', 'b2', 'b3', 'b4', 'b5'].map((name) => makeRepo(base, name));
    await Promise.all(repos.map((repo) => registry.registerProject(repo, process.pid)));

    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(updates).toBe(1);
    expect(first.getProjectsList().length).toBe(5);
  });

  it(
    'rejects removeProjectById on a forgetProject lock miss, removing nothing (design C3 removeProjectById ordering)',
    async () => {
      const repo = makeRepo(base, 'lockmiss');
      const first = await start();
      const id = await first.addProjectByPath(repo);

      const sddHomeDir = join(base, 'sdd-home');
      mkdirSync(sddHomeDir, { recursive: true });
      const lockPath = join(sddHomeDir, 'projects.json.lock');
      writeFileSync(lockPath, JSON.stringify({ pid: 999999, hostname: 'other-host', token: 'other' }), 'utf-8');

      await expect(first.removeProjectById(id)).rejects.toThrow();

      expect(first.getProject(id)).toBeDefined();
      expect((await readProjects()).projects.map((p) => p.id)).toEqual([id]);
      expect(await new ProjectRegistry().getProjectById(id)).not.toBeNull();
    },
    15000
  );
});

// Contract for addProjectByPath(repo, storeRoot) (design C7, Req 5 AC 3-5):
// - AC3: pre-condition a fresh manager, a workspace repo and a separate,
//   already-existing store-root directory, neither registered before. Call
//   addProjectByPath(repo, storeRoot). Observable: readProjects() holds one
//   entry whose workspacePath and workflowRootPath are the realpath of repo
//   and of storeRoot. Expected value from Req 5 AC 3 ("workspacePath is the
//   repository's git top level ... whose workflowRootPath is the store
//   root") and design D9 (realpath canonicalisation).
// - AC4: pre-condition the AC3 entry exists, the manager stops and its
//   registry entry is unregistered (process-death simulation, the pattern at
//   lines 51-71 above). Call: start a second manager. Observable: the second
//   manager lists the project under the same id with the same
//   workflowRootPath. Expected value from Req 5 AC 4 ("still be in
//   projects.json after the controller restarts").
// - AC5: pre-condition a fresh manager, repo and store root, neither
//   registered. Call addProjectByPath(repo, storeRoot) twice. Observable:
//   both calls return the same id and projects.json holds exactly one entry.
//   Expected value from Req 5 AC 5 ("leave one entry, not two, and ... report
//   the existing project id").
// - D12 (folded under AC3/AC5; no standalone Req 5 AC names this): the
//   project is already registered with one store root. Call
//   addProjectByPath(repo, a second store root). Observable: the same id,
//   still one entry, and the registry's/context's workflowRootPath updated
//   to the second root. Expected value from design C7/D12 ("updated in
//   place ... An in-memory context with a different store root is removed
//   and added again").
describe('ProjectManager.addProjectByPath with an explicit store root', () => {
  it('remembers a separate-store project with both realpath paths (Req 5 AC 3)', async () => {
    const repo = makeRepo(base, 'epsilon');
    const storeRoot = join(base, 'epsilon-store');
    mkdirSync(storeRoot, { recursive: true });
    const first = await start();

    const id = await first.addProjectByPath(repo, storeRoot);

    const remembered = await readProjects();
    expect(remembered.projects).toEqual([
      expect.objectContaining({
        id,
        workspacePath: realpathSync(repo),
        workflowRootPath: realpathSync(storeRoot),
      }),
    ]);
  });

  it('survives a restart with a separate store root (Req 5 AC 4)', async () => {
    const repo = makeRepo(base, 'zeta');
    const storeRoot = join(base, 'zeta-store');
    mkdirSync(storeRoot, { recursive: true });
    const first = await start();
    const id = await first.addProjectByPath(repo, storeRoot);
    expect(first.getProject(id)).toBeDefined();
    await first.stop();
    managers = [];

    // Simulate the registering process being gone, as the restart-survival
    // test above does.
    await new ProjectRegistry().unregisterProjectById(id);

    const second = await start();
    const project = second.getProject(id);
    expect(project).toBeDefined();
    expect(project?.workflowRootPath).toBe(realpathSync(storeRoot));
    expect(second.getProjectsList().map((p) => p.projectId)).toEqual([id]);
  });

  it('leaves one entry and returns the same id on a second identical add (Req 5 AC 5)', async () => {
    const repo = makeRepo(base, 'eta');
    const storeRoot = join(base, 'eta-store');
    mkdirSync(storeRoot, { recursive: true });
    const first = await start();

    const id1 = await first.addProjectByPath(repo, storeRoot);
    const id2 = await first.addProjectByPath(repo, storeRoot);

    expect(id2).toBe(id1);
    const remembered = await readProjects();
    expect(remembered.projects).toEqual([
      expect.objectContaining({ id: id1, workflowRootPath: realpathSync(storeRoot) }),
    ]);
  });

  it('updates the entry and the context in place on a re-add with a different store root (design D12)', async () => {
    const repo = makeRepo(base, 'theta');
    const storeRoot1 = join(base, 'theta-store-1');
    const storeRoot2 = join(base, 'theta-store-2');
    mkdirSync(storeRoot1, { recursive: true });
    mkdirSync(storeRoot2, { recursive: true });
    const first = await start();

    const id1 = await first.addProjectByPath(repo, storeRoot1);
    expect(first.getProject(id1)?.workflowRootPath).toBe(realpathSync(storeRoot1));

    const id2 = await first.addProjectByPath(repo, storeRoot2);

    expect(id2).toBe(id1);
    expect(first.getProject(id1)?.workflowRootPath).toBe(realpathSync(storeRoot2));
    expect(first.getAllProjects().filter((p) => p.projectId === id1).length).toBe(1);
    const remembered = await readProjects();
    expect(remembered.projects).toEqual([
      expect.objectContaining({ id: id1, workflowRootPath: realpathSync(storeRoot2) }),
    ]);
  });
});
