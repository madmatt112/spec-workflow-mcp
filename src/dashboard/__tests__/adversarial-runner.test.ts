import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { AdversarialRunner, AdversarialJob } from '../adversarial-runner.js';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock fs.promises
vi.mock('fs', () => ({
  promises: {
    access: vi.fn(),
  },
}));

import { spawn } from 'child_process';
import { promises as fs } from 'fs';

const mockedSpawn = vi.mocked(spawn);
const mockedAccess = vi.mocked(fs.access);

function createFakeChild() {
  const child = new EventEmitter() as EventEmitter & {
    kill: ReturnType<typeof vi.fn>;
    stderr: EventEmitter;
    stdout: EventEmitter;
    pid: number;
  };
  child.kill = vi.fn();
  child.stderr = new EventEmitter();
  child.stdout = new EventEmitter();
  child.pid = 12345;
  return child;
}

// Worktree fixture: the two roots are GENUINELY DISTINCT, so a swap of them is
// observable. Equal roots — which every fixture here used to pass — cannot
// detect the swap this spec exists to prevent.
const WORKFLOW_ROOT = '/tmp/project';        // shared checkout holding `.spec-workflow`
const WORKSPACE_PATH = '/tmp/project-wt-a';  // worktree the review agent runs in

function baseOpts(overrides: Partial<Parameters<AdversarialRunner['run']>[0]> = {}) {
  return {
    projectId: 'proj-1',
    specName: 'my-spec',
    phase: 'requirements',
    workspacePath: WORKSPACE_PATH,
    targetFile: '/tmp/project/.spec-workflow/specs/my-spec/requirements.md',
    promptOutputPath: '/tmp/project/.spec-workflow/specs/my-spec/reviews/adversarial-prompt-requirements.md',
    analysisOutputPath: '/tmp/project/.spec-workflow/specs/my-spec/reviews/adversarial-analysis-requirements.md',
    version: 1,
    ...overrides,
  };
}

describe('AdversarialRunner', () => {
  let runner: AdversarialRunner;

  beforeEach(() => {
    vi.useFakeTimers();
    runner = new AdversarialRunner();
    mockedSpawn.mockReset();
    mockedAccess.mockReset();
  });

  afterEach(() => {
    runner.shutdown();
    vi.useRealTimers();
  });

  describe('run()', () => {
    it('creates job and returns jobId', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);
      expect(jobId).toBeTruthy();

      const job = runner.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.projectId).toBe('proj-1');
      expect(job!.specName).toBe('my-spec');
    });

    it('emits job-update with pending as first status', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);

      const updates: AdversarialJob[] = [];
      runner.on('job-update', (job) => updates.push({ ...job }));

      await runner.run(baseOpts(), WORKFLOW_ROOT);

      expect(updates.length).toBeGreaterThanOrEqual(1);
      expect(updates[0].status).toBe('pending');
    });

    it('throws when max 2 concurrent jobs reached', async () => {
      const child1 = createFakeChild();
      const child2 = createFakeChild();
      const child3 = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child1 as any).mockReturnValueOnce(child2 as any).mockReturnValueOnce(child3 as any);

      await runner.run(baseOpts({ specName: 'spec-a', phase: 'requirements' }), WORKFLOW_ROOT);
      await runner.run(baseOpts({ specName: 'spec-b', phase: 'design' }), WORKFLOW_ROOT);

      await expect(runner.run(baseOpts({ specName: 'spec-c', phase: 'tasks' }), WORKFLOW_ROOT)).rejects.toThrow('Maximum 2 concurrent');
    });

    it('throws for duplicate spec+phase', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);

      await runner.run(baseOpts(), WORKFLOW_ROOT);

      await expect(runner.run(baseOpts(), WORKFLOW_ROOT)).rejects.toThrow('already running for my-spec/requirements');
    });

    it('allows same spec+phase for different projects', async () => {
      const child1 = createFakeChild();
      const child2 = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child1 as any).mockReturnValueOnce(child2 as any);

      const jobId1 = await runner.run(baseOpts({ projectId: 'proj-1' }), WORKFLOW_ROOT);
      const jobId2 = await runner.run(baseOpts({ projectId: 'proj-2' }), WORKFLOW_ROOT);

      expect(jobId1).not.toBe(jobId2);
    });
  });

  describe('queries', () => {
    it('getJob returns undefined for unknown id', () => {
      expect(runner.getJob('nonexistent')).toBeUndefined();
    });

    it('getJobsForProject filters by projectId', async () => {
      const child1 = createFakeChild();
      const child2 = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child1 as any).mockReturnValueOnce(child2 as any);

      await runner.run(baseOpts({ projectId: 'proj-1', specName: 'a' }), WORKFLOW_ROOT);
      await runner.run(baseOpts({ projectId: 'proj-2', specName: 'b' }), WORKFLOW_ROOT);

      expect(runner.getJobsForProject('proj-1').length).toBe(1);
      expect(runner.getJobsForProject('proj-2').length).toBe(1);
      expect(runner.getJobsForProject('proj-3').length).toBe(0);
    });

    it('getActiveJobsForProject excludes completed/failed jobs', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);
      mockedAccess.mockResolvedValue(undefined);

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);

      await vi.waitFor(() => {
        expect(mockedSpawn).toHaveBeenCalled();
      });

      child.emit('close', 0);

      await vi.waitFor(() => {
        expect(runner.getJob(jobId)!.status).toBe('completed');
      });

      expect(runner.getActiveJobsForProject('proj-1').length).toBe(0);
    });
  });

  describe('execution lifecycle', () => {
    it('transitions pending → running-review → completed in a single agent run', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child as any);
      mockedAccess.mockResolvedValue(undefined); // prompt file exists, analysis file exists

      const updates: string[] = [];
      runner.on('job-update', (job: AdversarialJob) => updates.push(job.status));

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);

      await vi.waitFor(() => {
        expect(updates).toContain('running-review');
      });

      child.emit('close', 0);

      await vi.waitFor(() => {
        expect(updates).toContain('completed');
      });

      expect(updates).toEqual(['pending', 'running-review', 'completed']);
      // Only one spawn call — no separate prompt-generation step.
      expect(mockedSpawn).toHaveBeenCalledTimes(1);
      const job = runner.getJob(jobId);
      expect(job!.status).toBe('completed');
      expect(job!.completedAt).toBeTruthy();
    });

    it('sets failed with error on non-zero exit', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child as any);
      mockedAccess.mockResolvedValue(undefined);

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);

      await vi.waitFor(() => {
        expect(mockedSpawn).toHaveBeenCalled();
      });

      child.stderr.emit('data', Buffer.from('something went wrong'));
      child.emit('close', 1);

      await vi.waitFor(() => {
        const job = runner.getJob(jobId);
        expect(job!.status).toBe('failed');
      });

      const job = runner.getJob(jobId);
      expect(job!.error).toContain('exited with code 1');
      expect(job!.error).toContain('something went wrong');
    });

    it('fails when scaffold prompt file is missing on disk', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child as any);
      mockedAccess.mockRejectedValue(new Error('ENOENT'));

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);

      await vi.waitFor(() => {
        const job = runner.getJob(jobId);
        expect(job!.status).toBe('failed');
      });

      const job = runner.getJob(jobId);
      expect(job!.error).toContain('Adversarial prompt file not found');
      // Runner must not spawn an agent if the prompt is missing.
      expect(mockedSpawn).not.toHaveBeenCalled();
    });

    it('fails when analysis file is not produced by the agent', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child as any);
      // First access (prompt) succeeds; second access (analysis) fails.
      mockedAccess
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('ENOENT'));

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);

      await vi.waitFor(() => {
        expect(mockedSpawn).toHaveBeenCalled();
      });
      child.emit('close', 0);

      await vi.waitFor(() => {
        const job = runner.getJob(jobId);
        expect(job!.status).toBe('failed');
      });

      const job = runner.getJob(jobId);
      expect(job!.error).toContain('analysis file was not created');
    });
  });

  describe('CLI config', () => {
    it('uses default cli/cliArgs when not specified', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);

      await runner.run(baseOpts(), WORKFLOW_ROOT);

      expect(mockedSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--print', '--dangerously-skip-permissions']),
        expect.any(Object)
      );
    });

    it('passes custom cli and cliArgs to spawn', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);

      await runner.run(baseOpts({
        cli: 'custom-cli',
        cliArgs: ['--custom-arg'],
      }), WORKFLOW_ROOT);

      expect(mockedSpawn).toHaveBeenCalledWith(
        'custom-cli',
        expect.arrayContaining(['--custom-arg']),
        expect.any(Object)
      );
    });

    it('passes --model flag when model set', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);

      await runner.run(baseOpts({ model: 'sonnet' }), WORKFLOW_ROOT);

      expect(mockedSpawn).toHaveBeenCalledWith(
        'claude',
        expect.arrayContaining(['--model', 'sonnet']),
        expect.any(Object)
      );
    });
  });

  describe('per-job model storage', () => {
    it('stores opts.model on the constructed job (getJob.model === opts.model)', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);

      const jobId = await runner.run(baseOpts({ model: 'opus-4-7' }), WORKFLOW_ROOT);

      const job = runner.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.model).toBe('opus-4-7');
    });

    it('leaves job.model undefined when opts.model is not set', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);

      const job = runner.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.model).toBeUndefined();
    });

    it('does not break getJobsForProject consumers when model is set', async () => {
      const child1 = createFakeChild();
      const child2 = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child1 as any).mockReturnValueOnce(child2 as any);

      await runner.run(baseOpts({ projectId: 'proj-1', specName: 'a', model: 'sonnet' }), WORKFLOW_ROOT);
      await runner.run(baseOpts({ projectId: 'proj-1', specName: 'b' }), WORKFLOW_ROOT);

      const jobs = runner.getJobsForProject('proj-1');
      expect(jobs.length).toBe(2);
      const withModel = jobs.find(j => j.specName === 'a');
      const withoutModel = jobs.find(j => j.specName === 'b');
      expect(withModel!.model).toBe('sonnet');
      expect(withoutModel!.model).toBeUndefined();
    });
  });

  describe('cancelJob', () => {
    it('sets failed with "Cancelled by user" and returns true', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);
      const result = runner.cancelJob(jobId);

      expect(result).toBe(true);
      const job = runner.getJob(jobId);
      expect(job!.status).toBe('failed');
      expect(job!.error).toBe('Cancelled by user');
      expect(job!.completedAt).toBeTruthy();
      expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('returns false for completed job', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child as any);
      mockedAccess.mockResolvedValue(undefined);

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);

      await vi.waitFor(() => expect(mockedSpawn).toHaveBeenCalled());
      child.emit('close', 0);
      await vi.waitFor(() => expect(runner.getJob(jobId)!.status).toBe('completed'));

      expect(runner.cancelJob(jobId)).toBe(false);
    });

    it('returns false for non-existent job', () => {
      expect(runner.cancelJob('nonexistent')).toBe(false);
    });
  });

  describe('error handling', () => {
    it('reports ENOENT as CLI not found', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);
      mockedAccess.mockResolvedValue(undefined);

      const jobId = await runner.run(baseOpts(), WORKFLOW_ROOT);

      await vi.waitFor(() => {
        expect(mockedSpawn).toHaveBeenCalled();
      });

      const err = new Error('spawn claude ENOENT') as Error & { code: string };
      err.code = 'ENOENT';
      child.emit('error', err);

      await vi.waitFor(() => {
        const job = runner.getJob(jobId);
        expect(job!.status).toBe('failed');
      });

      const job = runner.getJob(jobId);
      expect(job!.error).toContain('not found');
    });
  });

  describe('root separation: workspace vs workflow root (requirement 5.5)', () => {
    it('spawns the agent with cwd = the workspace, not the workflow root', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);
      mockedAccess.mockResolvedValue(undefined);

      await runner.run(baseOpts(), WORKFLOW_ROOT);

      await vi.waitFor(() => expect(mockedSpawn).toHaveBeenCalled());

      const spawnOptions = mockedSpawn.mock.calls[0][2] as { cwd?: string };
      expect(
        spawnOptions.cwd,
        'the adversarial agent must be spawned with cwd = the WORKSPACE (the worktree under review); the workflow root is here instead, which silently reviews the wrong checkout'
      ).toBe(WORKSPACE_PATH);
    });

    it('passes the workflow root to the spawn helper as its own argument', async () => {
      const child = createFakeChild();
      mockedSpawn.mockReturnValue(child as any);
      mockedAccess.mockResolvedValue(undefined);

      // Requirement 5.5 keeps `RunOptions` single-rooted, so the workflow root
      // reaches the spawn only as an argument — pin its position and value.
      const runAgentSpy = vi.spyOn(runner as any, 'runAgent');

      await runner.run(baseOpts(), WORKFLOW_ROOT);

      await vi.waitFor(() => expect(runAgentSpy).toHaveBeenCalled());

      const args = runAgentSpy.mock.calls[0] as unknown[];
      expect(
        args[1],
        'runAgent argument 2 must be the WORKSPACE (spawn cwd); the workflow root is here instead, so the two roots are swapped at the call site'
      ).toBe(WORKSPACE_PATH);
      expect(
        args[2],
        'runAgent argument 3 must be the WORKFLOW ROOT (it becomes SPEC_WORKFLOW_SHARED_ROOT); the workspace is here instead, so the two roots are swapped at the call site'
      ).toBe(WORKFLOW_ROOT);

      runAgentSpy.mockRestore();
    });

    // Requirement 2.12/2.13: an inherited GIT_DIR makes the review agent's git
    // read another repository, and inherited roots make it disagree with the
    // job it was spawned for.
    it('scrubs the four GIT_* variables and states both roots on the agent env (2.12, 2.13)', async () => {
      const SCRUBBED = ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'];
      const saved: Record<string, string | undefined> = {};
      const hostile: Record<string, string> = {
        GIT_DIR: '/elsewhere/.git',
        GIT_COMMON_DIR: '/elsewhere/.git',
        GIT_WORK_TREE: '/elsewhere',
        GIT_INDEX_FILE: '/elsewhere/.git/index',
        SPEC_WORKFLOW_WORKSPACE: '/stale/workspace',
        SPEC_WORKFLOW_SHARED_ROOT: '/stale/root',
        SPEC_WORKFLOW_HOST_PATH_PREFIX: '/Users/dev',
        SPEC_WORKFLOW_CONTAINER_PATH_PREFIX: '/projects',
      };
      for (const [name, value] of Object.entries(hostile)) {
        saved[name] = process.env[name];
        process.env[name] = value;
      }

      try {
        const child = createFakeChild();
        mockedSpawn.mockReturnValue(child as any);
        mockedAccess.mockResolvedValue(undefined);

        await runner.run(baseOpts(), WORKFLOW_ROOT);
        await vi.waitFor(() => expect(mockedSpawn).toHaveBeenCalled());

        const env = (mockedSpawn.mock.calls[0][2] as { env?: NodeJS.ProcessEnv }).env!;
        for (const name of SCRUBBED) {
          expect(env[name], `the adversarial agent inherited ${name}, so its git can read another repository`).toBeUndefined();
        }
        expect(
          env.SPEC_WORKFLOW_WORKSPACE,
          'SPEC_WORKFLOW_WORKSPACE must be set to this job\'s workspace, not inherited from the dashboard process'
        ).toBe(WORKSPACE_PATH);
        expect(
          env.SPEC_WORKFLOW_SHARED_ROOT,
          'SPEC_WORKFLOW_SHARED_ROOT must be set to the workflow root argument, not inherited from the dashboard process'
        ).toBe(WORKFLOW_ROOT);
        // Dropping these breaks Docker path translation (requirement 2.13).
        expect(env.SPEC_WORKFLOW_HOST_PATH_PREFIX).toBe('/Users/dev');
        expect(env.SPEC_WORKFLOW_CONTAINER_PATH_PREFIX).toBe('/projects');
        expect(env.PATH).toBe(process.env.PATH);
      } finally {
        for (const [name, value] of Object.entries(saved)) {
          if (value === undefined) delete process.env[name];
          else process.env[name] = value;
        }
      }
    });
  });

  describe('shutdown', () => {
    it('kills all running processes', async () => {
      const child1 = createFakeChild();
      const child2 = createFakeChild();
      mockedSpawn.mockReturnValueOnce(child1 as any).mockReturnValueOnce(child2 as any);
      mockedAccess.mockResolvedValue(undefined);

      await runner.run(baseOpts({ specName: 'spec-a' }), WORKFLOW_ROOT);
      await runner.run(baseOpts({ specName: 'spec-b', phase: 'design' }), WORKFLOW_ROOT);

      // Wait for both children to be spawned before shutdown
      await vi.waitFor(() => expect(mockedSpawn).toHaveBeenCalledTimes(2));

      runner.shutdown();

      expect(child1.kill).toHaveBeenCalledWith('SIGTERM');
      expect(child2.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });
});
