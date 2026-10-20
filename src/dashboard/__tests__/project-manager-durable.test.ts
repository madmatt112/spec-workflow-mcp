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
    expect(first.getProjectsList().length).toBe(2); // still listed while its instance is alive
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

  it('lists a remembered project whose directory is gone without failing', async () => {
    const repo = makeRepo(base, 'gamma');
    const first = await start();
    const id = await first.addProjectByPath(repo);
    await first.stop();
    managers = [];
    await new ProjectRegistry().unregisterProjectById(id);
    rmSync(repo, { recursive: true, force: true });

    const second = await start();
    // Still remembered; whether the watcher could start on a missing dir is
    // the registry's existing behaviour, not this list's concern.
    expect((await readProjects()).projects.map((p) => p.id)).toEqual([id]);
    expect(second).toBeDefined();
  });
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
