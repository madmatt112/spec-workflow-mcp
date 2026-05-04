// Track-C integration tests: per-runner model selection + per-job storage retry consistency.
// Uses a partial mock factory so the spy is import-shape-agnostic — works with both
// named imports and namespace imports in multi-server.ts.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

vi.mock('../../core/adversarial-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/adversarial-settings.js')>();
  return {
    ...actual,
    resolveRunnerModel: vi.fn(actual.resolveRunnerModel),
  };
});

import { promises as fs } from 'fs';
import net from 'net';
import { join } from 'path';
import { tmpdir } from 'os';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { ApprovalStorage } from '../approval-storage.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import * as adversarialSettings from '../../core/adversarial-settings.js';
import type { TaskReviewJob } from '../task-review-runner.js';
import type { AdversarialJob } from '../adversarial-runner.js';

const resolveRunnerModelMock = vi.mocked(adversarialSettings.resolveRunnerModel);

async function getFreePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      if (!a || typeof a === 'string') {
        s.close();
        reject(new Error('Failed to get free port'));
        return;
      }
      const port = a.port;
      s.close(() => resolvePort(port));
    });
    s.on('error', reject);
  });
}

async function writeSettings(workflowRootPath: string, body: object): Promise<void> {
  const dir = join(workflowRootPath, '.spec-workflow');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(join(dir, 'adversarial-settings.json'), JSON.stringify(body), 'utf-8');
}

async function waitFor<T>(fn: () => T | undefined, timeoutMs = 2000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = fn();
    if (v !== undefined && v !== false) return v as T;
    await new Promise(r => setTimeout(r, 10));
  }
  throw new Error('waitFor timed out');
}

describe('Track-C: per-runner model + per-job storage retry consistency', () => {
  let tempDir: string;
  let workspacePath: string;
  let workflowRootPath: string;
  let server: MultiProjectDashboardServer | null = null;
  let projectId: string;
  let realFetch: typeof fetch;
  let port: number;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `specwf-trackc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    workspacePath = join(tempDir, 'workspace');
    workflowRootPath = join(tempDir, 'project');
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(workflowRootPath, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    projectId = generateProjectId(workspacePath);
    realFetch = globalThis.fetch;

    const registry = new ProjectRegistry();
    await registry.registerProject(workspacePath, process.pid, { workflowRootPath });

    // Stub the npm-version fetch so server.start() doesn't hit the network
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ autoOpen: false, port });
    await server.start();

    resolveRunnerModelMock.mockClear();
    _resetMultiServerWarningsForTests();
    adversarialSettings.__resetForTests();
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
  function taskReviewUrl(specName: string, taskId: string, suffix: 'review' | 'review-retry'): string {
    return `http://127.0.0.1:${port}/api/projects/${projectId}/specs/${specName}/tasks/${taskId}/${suffix}`;
  }

  function getAdversarialRunner(): { jobs: Map<string, AdversarialJob> } {
    return (server as any).adversarialRunner;
  }
  function getTaskReviewRunner(): { jobs: Map<string, TaskReviewJob> } {
    return (server as any).taskReviewRunner;
  }

  // ============== TASK-REVIEW PATH ==============

  describe('task-review handlers', () => {
    it('initial+retry sequence: resolveRunnerModel called exactly once (initial only)', async () => {
      await writeSettings(workflowRootPath, { taskReview: { model: 'sonnet-4-6' } });

      const initial = await realFetch(taskReviewUrl('feat-a', '1', 'review'), { method: 'POST' });
      expect(initial.status).toBe(200);
      const initialBody = await initial.json() as any;
      expect(initialBody.jobId).toBeTruthy();

      // Force the prior job into 'failed' so retry can find it.
      const runner = getTaskReviewRunner();
      const initialJob = runner.jobs.get(initialBody.jobId)!;
      initialJob.status = 'failed';
      initialJob.completedAt = new Date().toISOString();
      expect(initialJob.model).toBe('sonnet-4-6');

      // Mutate settings file between runs — retry must NOT pick this up for model.
      await writeSettings(workflowRootPath, { taskReview: { model: 'opus-4-7' } });
      adversarialSettings.__resetForTests();

      const retry = await realFetch(taskReviewUrl('feat-a', '1', 'review-retry'), { method: 'POST' });
      expect(retry.status).toBe(200);
      const retryBody = await retry.json() as any;

      // Spy: only the initial handler invoked resolveRunnerModel.
      expect(resolveRunnerModelMock.mock.calls.length).toBe(1);

      // Retry job pinned to the initial's model, not the edited setting.
      const retryJob = runner.jobs.get(retryBody.jobId)!;
      expect(retryJob.model).toBe('sonnet-4-6');
    });

    it('multi-historical retry uses the MOST RECENT failed job model (sort by startedAt DESC)', async () => {
      // Inject two historical failed jobs for (specName, taskId) with different models + timestamps.
      const runner = getTaskReviewRunner();
      runner.jobs.set('older', {
        id: 'older',
        projectId,
        specName: 'feat-b',
        taskId: '2',
        status: 'failed',
        startedAt: '2026-01-01T00:00:00.000Z',
        model: 'opus-4-7',
      });
      runner.jobs.set('newer', {
        id: 'newer',
        projectId,
        specName: 'feat-b',
        taskId: '2',
        status: 'failed',
        startedAt: '2026-04-01T00:00:00.000Z',
        model: 'sonnet-4-6',
      });

      // Settings exist, but should NOT be consulted — prior job's model wins.
      await writeSettings(workflowRootPath, { taskReview: { model: 'should-not-appear' } });

      const retry = await realFetch(taskReviewUrl('feat-b', '2', 'review-retry'), { method: 'POST' });
      expect(retry.status).toBe(200);
      const body = await retry.json() as any;

      // Most recent (sonnet-4-6) wins, NOT insertion-order-first (opus-4-7).
      const retryJob = runner.jobs.get(body.jobId)!;
      expect(retryJob.model).toBe('sonnet-4-6');
      expect(resolveRunnerModelMock.mock.calls.length).toBe(0);
    });

    it('whitespace-only model in failed job: filter rejects, falls back to resolveRunnerModel + warn-once', async () => {
      const runner = getTaskReviewRunner();
      runner.jobs.set('ws', {
        id: 'ws',
        projectId,
        specName: 'feat-c',
        taskId: '3',
        status: 'failed',
        startedAt: new Date().toISOString(),
        model: '   ',
      });

      await writeSettings(workflowRootPath, { taskReview: { model: 'fallback-model' } });

      const retry = await realFetch(taskReviewUrl('feat-c', '3', 'review-retry'), { method: 'POST' });
      expect(retry.status).toBe(200);
      const body = await retry.json() as any;

      const retryJob = runner.jobs.get(body.jobId)!;
      expect(retryJob.model).toBe('fallback-model');
      expect(resolveRunnerModelMock.mock.calls.length).toBe(1);
    });

    it('empty-string model in failed job: filter rejects, falls back', async () => {
      const runner = getTaskReviewRunner();
      runner.jobs.set('empty', {
        id: 'empty',
        projectId,
        specName: 'feat-d',
        taskId: '4',
        status: 'failed',
        startedAt: new Date().toISOString(),
        model: '',
      });
      await writeSettings(workflowRootPath, { taskReview: { model: 'fallback-model' } });

      const retry = await realFetch(taskReviewUrl('feat-d', '4', 'review-retry'), { method: 'POST' });
      expect(retry.status).toBe(200);
      const body = await retry.json() as any;
      const retryJob = runner.jobs.get(body.jobId)!;
      expect(retryJob.model).toBe('fallback-model');
      expect(resolveRunnerModelMock.mock.calls.length).toBe(1);
    });

    it('non-string model in failed job: filter rejects, falls back', async () => {
      const runner = getTaskReviewRunner();
      runner.jobs.set('nonstr', {
        id: 'nonstr',
        projectId,
        specName: 'feat-e',
        taskId: '5',
        status: 'failed',
        startedAt: new Date().toISOString(),
        // Force a non-string into the typed slot — simulates corrupted in-memory state.
        model: 42 as unknown as string,
      });
      await writeSettings(workflowRootPath, { taskReview: { model: 'fallback-model' } });

      const retry = await realFetch(taskReviewUrl('feat-e', '5', 'review-retry'), { method: 'POST' });
      expect(retry.status).toBe(200);
      const body = await retry.json() as any;
      const retryJob = runner.jobs.get(body.jobId)!;
      expect(retryJob.model).toBe('fallback-model');
      expect(resolveRunnerModelMock.mock.calls.length).toBe(1);
    });

    it('undefined model in failed job: filter rejects, falls back', async () => {
      const runner = getTaskReviewRunner();
      runner.jobs.set('undef', {
        id: 'undef',
        projectId,
        specName: 'feat-undef',
        taskId: '6',
        status: 'failed',
        startedAt: new Date().toISOString(),
        // model intentionally omitted
      });
      await writeSettings(workflowRootPath, { taskReview: { model: 'fallback-model' } });

      const retry = await realFetch(taskReviewUrl('feat-undef', '6', 'review-retry'), { method: 'POST' });
      expect(retry.status).toBe(200);
      const body = await retry.json() as any;
      const retryJob = runner.jobs.get(body.jobId)!;
      expect(retryJob.model).toBe('fallback-model');
      expect(resolveRunnerModelMock.mock.calls.length).toBe(1);
    });

    it('server-restart simulation: jobs map empty → retry returns 404', async () => {
      // Clearing the runner's map mirrors a process restart between initial and retry.
      const runner = getTaskReviewRunner();
      runner.jobs.clear();
      const retry = await realFetch(taskReviewUrl('feat-restart', '7', 'review-retry'), { method: 'POST' });
      expect(retry.status).toBe(404);
    });

    it('concurrent-initial 409: duplicate (specName, taskId) translates to in-flight-spec-task', async () => {
      // Pre-inject a running job so the duplicate guard fires deterministically
      // (in this test env the executeJob path fails fast — pending state is too
      // fleeting to race against another HTTP request).
      const runner = getTaskReviewRunner();
      runner.jobs.set('blocking', {
        id: 'blocking',
        projectId,
        specName: 'feat-conc',
        taskId: '8',
        status: 'running',
        startedAt: new Date().toISOString(),
      });

      const r = await realFetch(taskReviewUrl('feat-conc', '8', 'review'), { method: 'POST' });
      expect(r.status).toBe(409);
      const body = await r.json() as any;
      expect(body.error).toBe('in-flight-spec-task');
      expect(body.specName).toBe('feat-conc');
      expect(body.taskId).toBe('8');
    });

    it('non-duplicate runner error (max-concurrent) is NOT translated to 409', async () => {
      // Saturate concurrency with two unrelated active jobs to trigger the
      // max-concurrent error on a third request. Handler must NOT translate it.
      const runner = getTaskReviewRunner();
      runner.jobs.set('a', {
        id: 'a', projectId, specName: 'feat-x', taskId: '1',
        status: 'running', startedAt: new Date().toISOString(),
      });
      runner.jobs.set('b', {
        id: 'b', projectId, specName: 'feat-y', taskId: '2',
        status: 'running', startedAt: new Date().toISOString(),
      });

      const r = await realFetch(taskReviewUrl('feat-z', '3', 'review'), { method: 'POST' });
      expect(r.status).toBe(400);
      const body = await r.json() as any;
      expect(body.error).toContain('Maximum 2 concurrent');
      expect(body.error).not.toBe('in-flight-spec-task');
    });
  });

  // ============== ADVERSARIAL PATH ==============

  describe('adversarial handlers', () => {
    async function setupApproval(specName: string, phase: string): Promise<{ approvalId: string; approvalStorage: ApprovalStorage }> {
      const specDir = join(workspacePath, '.spec-workflow', 'specs', specName);
      await fs.mkdir(specDir, { recursive: true });
      await fs.writeFile(join(specDir, `${phase}.md`), `# ${phase}\nbody`, 'utf-8');
      const approvalStorage = new ApprovalStorage(workflowRootPath, {
        originalPath: workflowRootPath,
        fileResolutionPath: workspacePath,
      });
      const approvalId = await approvalStorage.createApproval(`Review ${phase}`, `${phase}.md`, 'spec', specName);
      return { approvalId, approvalStorage };
    }

    it('initial+retry: resolveRunnerModel called exactly once (initial only); retry uses prior job model', async () => {
      await writeSettings(workflowRootPath, { adversarial: { model: 'sonnet-4-6' } });
      const { approvalId } = await setupApproval('adv-feat', 'requirements');

      const initial = await realFetch(approvalUrl(approvalId, 'adversarial-review'), { method: 'POST' });
      expect(initial.status).toBe(200);
      const initialBody = await initial.json() as any;
      const initialJobId = initialBody.jobId;

      const runner = getAdversarialRunner();
      const initialJob = runner.jobs.get(initialJobId)!;
      expect(initialJob.model).toBe('sonnet-4-6');
      // Force terminal so the retry doesn't trip the duplicate guard.
      initialJob.status = 'failed';
      initialJob.completedAt = new Date().toISOString();

      // Edit settings between calls; retry must keep prior job's model.
      await writeSettings(workflowRootPath, { adversarial: { model: 'opus-4-7' } });
      adversarialSettings.__resetForTests();

      const retry = await realFetch(approvalUrl(approvalId, 'adversarial-retry'), { method: 'POST' });
      expect(retry.status).toBe(200);
      const retryBody = await retry.json() as any;
      const retryJob = runner.jobs.get(retryBody.jobId)!;

      expect(retryJob.model).toBe('sonnet-4-6');
      expect(resolveRunnerModelMock.mock.calls.length).toBe(1);
    });

    it('server-restart: priorJobId in annotation but missing from runner → falls back + warn-once', async () => {
      await writeSettings(workflowRootPath, { adversarial: { model: 'fallback-model' } });
      const { approvalId } = await setupApproval('adv-restart', 'design');

      const initial = await realFetch(approvalUrl(approvalId, 'adversarial-review'), { method: 'POST' });
      expect(initial.status).toBe(200);
      const initialBody = await initial.json() as any;

      // Simulate restart: clear runner state. Annotation still has stale jobId.
      const runner = getAdversarialRunner();
      runner.jobs.clear();

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const retry = await realFetch(approvalUrl(approvalId, 'adversarial-retry'), { method: 'POST' });
        expect(retry.status).toBe(200);
        const retryBody = await retry.json() as any;
        const retryJob = runner.jobs.get(retryBody.jobId)!;

        expect(retryJob.model).toBe('fallback-model');
        // initial: 1 call; retry: 1 call (job-not-found fallback) → 2 total
        expect(resolveRunnerModelMock.mock.calls.length).toBe(2);

        const warnedRetry = warnSpy.mock.calls.some(args =>
          typeof args[0] === 'string' && args[0].includes('multi-server:retry-prior-job-not-found')
        );
        expect(warnedRetry).toBe(true);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('whitespace-only model in prior adversarial job: filter rejects, falls back', async () => {
      await writeSettings(workflowRootPath, { adversarial: { model: 'fallback-model' } });
      const { approvalId } = await setupApproval('adv-ws', 'tasks');

      const initial = await realFetch(approvalUrl(approvalId, 'adversarial-review'), { method: 'POST' });
      expect(initial.status).toBe(200);
      const initialBody = await initial.json() as any;
      const runner = getAdversarialRunner();
      const initialJob = runner.jobs.get(initialBody.jobId)!;
      initialJob.status = 'failed';
      initialJob.completedAt = new Date().toISOString();
      // Stomp the model with whitespace-only — emulates corrupted state.
      initialJob.model = '   ';

      const retry = await realFetch(approvalUrl(approvalId, 'adversarial-retry'), { method: 'POST' });
      expect(retry.status).toBe(200);
      const retryBody = await retry.json() as any;
      const retryJob = runner.jobs.get(retryBody.jobId)!;
      expect(retryJob.model).toBe('fallback-model');
      // initial: 1; retry filter rejects → fallback resolves: 2
      expect(resolveRunnerModelMock.mock.calls.length).toBe(2);
    });

    it('concurrent-initial 409: duplicate (specName, phase) translates to in-flight-spec-phase', async () => {
      const { approvalId } = await setupApproval('adv-conc', 'requirements');

      // Pre-inject a running job so the duplicate guard fires deterministically.
      const runner = getAdversarialRunner();
      runner.jobs.set('blocking', {
        id: 'blocking',
        projectId,
        specName: 'adv-conc',
        phase: 'requirements',
        status: 'running-review',
        startedAt: new Date().toISOString(),
        analysisOutputPath: '',
        promptOutputPath: '',
        targetFile: '',
      });

      const r = await realFetch(approvalUrl(approvalId, 'adversarial-review'), { method: 'POST' });
      expect(r.status).toBe(409);
      const body = await r.json() as any;
      expect(body.error).toBe('in-flight-spec-phase');
      expect(body.specName).toBe('adv-conc');
      expect(body.phase).toBe('requirements');
    });
  });
});
