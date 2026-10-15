import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
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
