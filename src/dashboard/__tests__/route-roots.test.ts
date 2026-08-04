/**
 * Regression coverage for the two "SHALL continue" criteria of requirement 5
 * (requirement 7.9).
 *
 * Requirement 5 renames and splits the roots that the dashboard routes and the
 * runners carry. Two sites are supposed to come through that unchanged:
 *
 *   - R5 AC 9  — `loadSettings(project.projectPath)` on both adversarial
 *                routes (`multi-server.ts`, the primary route and the retry
 *                route) still loads from the WORKFLOW root.
 *   - R5 AC 10 — `cleanupSpecs` / `cleanupArchivedSpecs` in
 *                `job-scheduler.ts` are still handed the WORKFLOW root.
 *
 * Both take a plain `string` and both sit next to a `workspacePath` of the same
 * type, so swapping one for the other — which is exactly what a sweeping rename
 * of a runner's `projectPath` field does — type-checks, runs, and silently
 * reads or deletes from the wrong checkout. Nothing but an explicit assertion
 * catches it, so each case below asserts the right root was used AND that the
 * workspace path was not.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import net from 'net';
import { join } from 'path';
import { tmpdir } from 'os';

const hoisted = vi.hoisted(() => ({ loadSettingsCalls: [] as string[] }));

// Wrap, do not stub: the routes feed the result straight into
// `resolveRunnerModel`, so the real settings still have to come back.
vi.mock('../../core/adversarial-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/adversarial-settings.js')>();
  return {
    ...actual,
    loadSettings: (projectPath: string) => {
      hoisted.loadSettingsCalls.push(projectPath);
      return actual.loadSettings(projectPath);
    },
  };
});

import { MultiProjectDashboardServer } from '../multi-server.js';
import { ApprovalStorage } from '../approval-storage.js';
import { JobScheduler } from '../job-scheduler.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { AutomationJob } from '../../types.js';

async function getFreePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to get free port'));
        return;
      }
      const port = address.port;
      server.close(() => resolvePort(port));
    });
    server.on('error', reject);
  });
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('R5 AC 9 — adversarial routes still load settings from the workflow root', () => {
  let tempDir: string;
  let workspacePath: string;
  let workflowRootPath: string;
  let server: MultiProjectDashboardServer | null = null;
  let projectId: string;
  let realFetch: typeof fetch;
  let port: number;

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `specwf-route-roots-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    workspacePath = join(tempDir, 'worktree');
    workflowRootPath = join(tempDir, 'main-checkout');
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(workflowRootPath, { recursive: true });

    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    projectId = generateProjectId(workspacePath);
    realFetch = globalThis.fetch;
    hoisted.loadSettingsCalls.length = 0;

    // The two roots differ, so a call made with the wrong one is visible.
    const registry = new ProjectRegistry();
    await registry.registerProject(workspacePath, process.pid, { workflowRootPath });

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({})
      }))
    );

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ autoOpen: false, port });
    await server.start();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function approvalUrl(approvalId: string, action: string): string {
    return `http://127.0.0.1:${port}/api/projects/${projectId}/approvals/${approvalId}/${action}`;
  }

  function newApprovalStorage(): ApprovalStorage {
    return new ApprovalStorage(workflowRootPath, {
      originalPath: workflowRootPath,
      fileResolutionPath: workspacePath,
    });
  }

  async function seedSpec(specName: string, phaseFile: string): Promise<void> {
    const specDir = join(workflowRootPath, '.spec-workflow', 'specs', specName);
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, phaseFile), '# Doc\nContent.', 'utf-8');
  }

  it('loads settings from the workflow root on the primary route', async () => {
    await seedSpec('settings-feat', 'requirements.md');

    const approvalStorage = newApprovalStorage();
    const approvalId = await approvalStorage.createApproval(
      'Review requirements',
      'requirements.md',
      'spec',
      'settings-feat',
    );

    const res = await realFetch(approvalUrl(approvalId, 'adversarial-review'), { method: 'POST' });
    expect(res.status).toBe(200);

    expect(hoisted.loadSettingsCalls).toEqual([workflowRootPath]);
    expect(hoisted.loadSettingsCalls).not.toContain(workspacePath);
  });

  it('loads settings from the workflow root on the retry route', async () => {
    await seedSpec('retry-settings-feat', 'design.md');

    const approvalStorage = newApprovalStorage();
    const approvalId = await approvalStorage.createApproval(
      'Review design',
      'design.md',
      'spec',
      'retry-settings-feat',
    );

    // Annotate directly rather than running the primary route first: the retry
    // route only needs `trigger`, `specName` and `phase` to proceed, and this
    // keeps the assertion below to exactly one route's call.
    await approvalStorage.updateApproval(
      approvalId,
      'needs-revision',
      'Adversarial review requested.',
      JSON.stringify({
        decision: 'needs-revision',
        trigger: 'adversarial-review',
        specName: 'retry-settings-feat',
        phase: 'design',
        analysisVersion: 1,
      }),
    );

    const res = await realFetch(approvalUrl(approvalId, 'adversarial-retry'), { method: 'POST' });
    expect(res.status).toBe(200);

    expect(hoisted.loadSettingsCalls).toEqual([workflowRootPath]);
    expect(hoisted.loadSettingsCalls).not.toContain(workspacePath);
  });
});

describe('R5 AC 10 — the job scheduler still passes the workflow root to the cleanup jobs', () => {
  let tempDir: string;
  let workspacePath: string;
  let workflowRootPath: string;

  const originalEnv = { ...process.env };
  const staleTimestamp = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  beforeEach(async () => {
    tempDir = join(tmpdir(), `specwf-scheduler-roots-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    workspacePath = join(tempDir, 'worktree');
    workflowRootPath = join(tempDir, 'main-checkout');
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(workflowRootPath, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function buildScheduler(job: AutomationJob, parser: unknown): JobScheduler {
    const projectContext = {
      projectId: 'proj-1',
      projectPath: workflowRootPath,
      workspacePath,
      parser,
      approvalStorage: { getAllApprovals: async () => [] },
    };
    const projectManager = {
      getProjectsList: () => [{
        projectId: 'proj-1',
        projectName: 'proj',
        projectPath: workspacePath,
        instances: [],
      }],
      getProject: (id: string) => (id === 'proj-1' ? projectContext : undefined),
    };

    const scheduler = new JobScheduler(projectManager as any);
    // Both managers write into the global directory; neither is under test.
    (scheduler as any).settingsManager = {
      getJob: async () => job,
      updateJob: async () => {},
    };
    (scheduler as any).historyManager = { recordExecution: async () => {} };
    return scheduler;
  }

  it('deletes a stale spec from the workflow root, leaving the workspace copy', async () => {
    // The same spec name exists under both roots. Only the workflow root's
    // copy is the shared one the parser enumerated, so only it may be removed.
    const onWorkflowRoot = join(workflowRootPath, '.spec-workflow', 'specs', 'stale-spec');
    const inWorkspace = join(workspacePath, '.spec-workflow', 'specs', 'stale-spec');
    await fs.mkdir(onWorkflowRoot, { recursive: true });
    await fs.mkdir(inWorkspace, { recursive: true });
    await fs.writeFile(join(onWorkflowRoot, 'requirements.md'), '# Shared', 'utf-8');
    await fs.writeFile(join(inWorkspace, 'requirements.md'), '# Worktree', 'utf-8');

    const job: AutomationJob = {
      id: 'job-specs',
      name: 'cleanup specs',
      type: 'cleanup-specs',
      enabled: true,
      config: { daysOld: 30 },
      schedule: '0 2 * * *',
      createdAt: new Date().toISOString(),
    };
    const parser = {
      getAllSpecs: async () => [{ name: 'stale-spec', createdAt: staleTimestamp }],
      getAllArchivedSpecs: async () => [],
    };

    const result = await buildScheduler(job, parser).runJobManually('job-specs');

    expect(result.success).toBe(true);
    expect(result.itemsDeleted).toBe(1);
    expect(await exists(onWorkflowRoot)).toBe(false);
    expect(await exists(inWorkspace)).toBe(true);
  });

  it('deletes a stale archived spec from the workflow root, leaving the workspace copy', async () => {
    const onWorkflowRoot = join(workflowRootPath, '.spec-workflow', 'archive', 'specs', 'stale-archived');
    const inWorkspace = join(workspacePath, '.spec-workflow', 'archive', 'specs', 'stale-archived');
    await fs.mkdir(onWorkflowRoot, { recursive: true });
    await fs.mkdir(inWorkspace, { recursive: true });
    await fs.writeFile(join(onWorkflowRoot, 'requirements.md'), '# Shared', 'utf-8');
    await fs.writeFile(join(inWorkspace, 'requirements.md'), '# Worktree', 'utf-8');

    const job: AutomationJob = {
      id: 'job-archived',
      name: 'cleanup archived specs',
      type: 'cleanup-archived-specs',
      enabled: true,
      config: { daysOld: 30 },
      schedule: '0 3 * * *',
      createdAt: new Date().toISOString(),
    };
    const parser = {
      getAllSpecs: async () => [],
      getAllArchivedSpecs: async () => [{ name: 'stale-archived', createdAt: staleTimestamp }],
    };

    const result = await buildScheduler(job, parser).runJobManually('job-archived');

    expect(result.success).toBe(true);
    expect(result.itemsDeleted).toBe(1);
    expect(await exists(onWorkflowRoot)).toBe(false);
    expect(await exists(inWorkspace)).toBe(true);
  });
});
