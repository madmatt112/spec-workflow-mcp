import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logImplementationTool, logImplementationHandler } from '../log-implementation.js';
import { _resetRootSelection } from '../root-selection.js';
import { TASK_STATE_FILE, type TaskAttribution } from '../../core/task-state-store.js';
import {
  GitFixture,
  cleanupAllGitFixtures,
} from '../../core/__tests__/helpers/git-fixture.js';
import { ToolContext } from '../../types.js';

describe('log-implementation tool schema', () => {
  it('requires every field on an integrations item', () => {
    const integrations = (logImplementationTool.inputSchema as any)
      .properties.artifacts.properties.integrations;
    expect(integrations.items.required).toEqual([
      'description',
      'frontendComponent',
      'backendEndpoint',
      'dataFlow',
    ]);
  });
});

// Attribution (design Component 7, requirements 3.1, 3.2, 3.4, 3.5): after the
// log entry is written, the handler records the workspace and its HEAD in the
// per-task state file under the workflow root. These cases assert the record;
// the `readHeadCommit` HEAD read touches only fields node 20 documents.
describe('log-implementation attribution', () => {
  let fixture: GitFixture;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    fixture = await GitFixture.create('specwf-log-impl-attr-');
    // selectRoots warns once per override; silence it rather than let it print
    // through the suite.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(async () => {
    warnSpy?.mockRestore();
    _resetRootSelection();
    await fixture?.cleanup();
    await cleanupAllGitFixtures();
  });

  async function seedSpec(root: string, specName: string): Promise<string> {
    const specDir = join(root, '.spec-workflow', 'specs', specName);
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'tasks.md'), '# Tasks\n\n- [ ] 1. Do the thing\n', 'utf-8');
    return specDir;
  }

  function baseArgs(specName: string, extra: Record<string, unknown> = {}) {
    return {
      specName,
      taskId: '1',
      summary: 'Attribution test entry',
      filesModified: [],
      filesCreated: [],
      statistics: { linesAdded: 1, linesRemoved: 0 },
      artifacts: { functions: [] },
      ...extra,
    };
  }

  async function readAttribution(specDir: string): Promise<TaskAttribution | undefined> {
    const raw = await fs.readFile(join(specDir, TASK_STATE_FILE), 'utf-8');
    return JSON.parse(raw).tasks['1'].attribution;
  }

  it('records source "context" and the workspace HEAD when there is no override', async () => {
    _resetRootSelection();
    const repo = await fixture.createRepo('context-workspace');
    const specDir = await seedSpec(repo.path, 'ctx-spec');
    const head = await repo.git(['rev-parse', 'HEAD']);
    const context: ToolContext = {
      projectPath: repo.path,
      workspacePath: repo.path,
      dashboardUrl: 'http://localhost:5000',
    };

    const result = await logImplementationHandler(baseArgs('ctx-spec'), context);
    expect(result.success).toBe(true);

    const attribution = await readAttribution(specDir);
    expect(attribution).toMatchObject({
      workspacePath: repo.path,
      commit: head,
      source: 'context',
    });
    expect(typeof attribution?.loggedAt).toBe('string');
  });

  it('records source "override" when args.projectPath is provided', async () => {
    _resetRootSelection();
    const repo = await fixture.createRepo('override-workspace');
    const specDir = await seedSpec(repo.path, 'ovr-spec');
    const head = await repo.git(['rev-parse', 'HEAD']);
    // A context whose roots point elsewhere: the override must win.
    const context: ToolContext = {
      projectPath: join(fixture.root, 'unused-context-root'),
      workspacePath: join(fixture.root, 'unused-context-root'),
      dashboardUrl: 'http://localhost:5000',
    };

    const result = await logImplementationHandler(
      baseArgs('ovr-spec', { projectPath: repo.path }),
      context
    );
    expect(result.success).toBe(true);

    const attribution = await readAttribution(specDir);
    expect(attribution).toMatchObject({
      workspacePath: repo.path,
      commit: head,
      source: 'override',
    });
  });

  it('records a null commit for a non-repository workspace and still writes the log entry', async () => {
    _resetRootSelection();
    const dir = await fixture.createNonGitDirectory('no-repo-workspace');
    const specDir = await seedSpec(dir, 'norepo-spec');
    const context: ToolContext = {
      projectPath: dir,
      workspacePath: dir,
      dashboardUrl: 'http://localhost:5000',
    };

    const result = await logImplementationHandler(baseArgs('norepo-spec'), context);
    expect(result.success).toBe(true);

    const attribution = await readAttribution(specDir);
    expect(attribution?.commit).toBeNull();
    expect(attribution?.workspacePath).toBe(dir);

    // Requirement 3.5: the log entry is written regardless of the HEAD read.
    const logs = await fs.readdir(join(specDir, 'Implementation Logs'));
    expect(logs).toHaveLength(1);
  });
});
