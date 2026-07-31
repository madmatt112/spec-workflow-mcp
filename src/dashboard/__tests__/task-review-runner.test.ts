import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TaskReviewRunner } from '../task-review-runner.js';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock the review-task handler
vi.mock('../../tools/review-task.js', () => ({
  reviewTaskHandler: vi.fn(),
}));

import { spawn } from 'child_process';
import { reviewTaskHandler } from '../../tools/review-task.js';

describe('TaskReviewRunner', () => {
  let runner: TaskReviewRunner;

  beforeEach(() => {
    runner = new TaskReviewRunner();
    vi.clearAllMocks();
  });

  afterEach(() => {
    runner.shutdown();
  });

  describe('job management', () => {
    it('should reject when max concurrent jobs exceeded', async () => {
      // Mock prepare to hang
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '' },
        projectContext: { projectPath: '/tmp', workflowRoot: '/tmp/.spec-workflow' },
      });
      const mockProcess = createMockProcess();
      (spawn as any).mockReturnValue(mockProcess);

      // Start 2 jobs (max)
      await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp' });
      await runner.run({ projectId: 'p1', specName: 's1', taskId: '2', workflowRoot: '/tmp', workspacePath: '/tmp' });

      // 3rd should fail
      await expect(
        runner.run({ projectId: 'p1', specName: 's1', taskId: '3', workflowRoot: '/tmp', workspacePath: '/tmp' })
      ).rejects.toThrow('Maximum 2 concurrent');
    });

    it('should reject duplicate specName+taskId', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '' },
        projectContext: {},
      });
      const mockProcess = createMockProcess();
      (spawn as any).mockReturnValue(mockProcess);

      await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp' });

      await expect(
        runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp' })
      ).rejects.toThrow('already running');
    });

    it('should return a job ID', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '' },
        projectContext: {},
      });
      const mockProcess = createMockProcess();
      (spawn as any).mockReturnValue(mockProcess);

      const jobId = await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp' });
      expect(jobId).toBeTruthy();
      expect(runner.getJob(jobId)).toBeDefined();
    });

    it('should cancel a running job', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '' },
        projectContext: {},
      });
      const mockProcess = createMockProcess();
      (spawn as any).mockReturnValue(mockProcess);

      const jobId = await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp' });
      const cancelled = runner.cancelJob(jobId);
      expect(cancelled).toBe(true);
      expect(runner.getJob(jobId)?.status).toBe('failed');
      expect(runner.getJob(jobId)?.error).toBe('Cancelled by user');
    });
  });

  describe('prepare failure', () => {
    it('should mark job as failed when prepare returns success: false', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: false,
        message: 'No implementation log found',
      });

      const updates: any[] = [];
      runner.on('job-update', (job) => updates.push({ ...job }));

      const jobId = await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp' });

      // Wait for async execution
      await new Promise(r => setTimeout(r, 50));

      const job = runner.getJob(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.error).toContain('Prepare failed');
    });
  });

  describe('emit job-update events', () => {
    it('should emit pending on creation', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '' },
        projectContext: {},
      });
      const mockProcess = createMockProcess();
      (spawn as any).mockReturnValue(mockProcess);

      const updates: any[] = [];
      runner.on('job-update', (job) => updates.push({ ...job }));

      await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp' });

      expect(updates[0]?.status).toBe('pending');
    });
  });

  describe('stripMarkdownFences (via lenient parsing)', () => {
    it('should handle JSON wrapped in markdown fences', () => {
      // Access private method indirectly through the class
      const runner2 = new TaskReviewRunner();
      const strip = (runner2 as any).stripMarkdownFences.bind(runner2);

      expect(JSON.parse(strip('```json\n{"verdict":"pass"}\n```'))).toEqual({ verdict: 'pass' });
      expect(JSON.parse(strip('```\n{"verdict":"fail"}\n```'))).toEqual({ verdict: 'fail' });
      expect(JSON.parse(strip('{"verdict":"findings"}'))).toEqual({ verdict: 'findings' });
    });
  });

  describe('prompt building (prior review context)', () => {
    it('should omit Prior Review Context on v1 (no priors)', () => {
      const runner2 = new TaskReviewRunner();
      const build = (runner2 as any).buildPrompt.bind(runner2);
      const prompt = build(
        'test-spec', '1',
        { description: 'test task' },
        { filesModified: [] },
        null,
        ['src/file.ts'],
        '# Methodology',
        '/tmp/output.json',
        null, null, null
      );
      expect(prompt).not.toContain('## Prior Review Context');
      expect(prompt).not.toContain('## Prior Review Memory');
      expect(prompt).not.toContain('## Memory File Update');
      expect(prompt).not.toContain('classification');
    });

    it('should include Prior Review Context and Memory sections on v2+', () => {
      const runner2 = new TaskReviewRunner();
      const build = (runner2 as any).buildPrompt.bind(runner2);
      const priorContext = '### Version 1 (findings): v1 summary\n- [warning] Some warning (file.ts:10)\n';
      const prompt = build(
        'test-spec', '1',
        { description: 'test task' },
        { filesModified: [] },
        null,
        ['src/file.ts'],
        '# Methodology',
        '/tmp/output.json',
        priorContext, null, '/tmp/memory-task-1.md'
      );
      expect(prompt).toContain('## Prior Review Context');
      expect(prompt).toContain('Some warning');
      expect(prompt).toContain('## Prior Review Memory');
      expect(prompt).toContain('## Memory File Update');
      expect(prompt).toContain('/tmp/memory-task-1.md');
      expect(prompt).toContain('classification');
    });

    it('should include existing memory content when provided', () => {
      const runner2 = new TaskReviewRunner();
      const build = (runner2 as any).buildPrompt.bind(runner2);
      const memoryContent = '# Task Review Memory\n## Existing content from prior iterations';
      const prompt = build(
        'test-spec', '1',
        { description: 'test' },
        { filesModified: [] },
        null, [], '# M', '/tmp/out.json',
        'context', memoryContent, '/tmp/memory.md'
      );
      expect(prompt).toContain('Existing content from prior iterations');
    });

    it('should show default memory text when no prior memory exists', () => {
      const runner2 = new TaskReviewRunner();
      const build = (runner2 as any).buildPrompt.bind(runner2);
      const prompt = build(
        'test-spec', '1',
        { description: 'test' },
        { filesModified: [] },
        null, [], '# M', '/tmp/out.json',
        'context', null, '/tmp/memory.md'
      );
      expect(prompt).toContain('No memory file yet');
    });
  });

  describe('formatPriorReviewContext', () => {
    it('should format prior reviews with findings by version', () => {
      const runner2 = new TaskReviewRunner();
      const format = (runner2 as any).formatPriorReviewContext.bind(runner2);
      const reviews = [
        {
          version: 1,
          verdict: 'findings',
          summary: 'First review',
          findings: [
            { severity: 'warning', title: 'Issue A', file: 'a.ts', line: 10, category: 'spec-compliance' },
          ],
        },
        {
          version: 2,
          verdict: 'fail',
          summary: 'Second review',
          findings: [
            { severity: 'critical', title: 'Issue B', file: 'b.ts', category: 'hygiene' },
          ],
        },
      ];
      const output = format(reviews);
      expect(output).toContain('Version 1');
      expect(output).toContain('Issue A');
      expect(output).toContain('a.ts:10');
      expect(output).toContain('Version 2');
      expect(output).toContain('Issue B');
      expect(output).toContain('[hygiene]');
    });

    it('should handle reviews with no findings', () => {
      const runner2 = new TaskReviewRunner();
      const format = (runner2 as any).formatPriorReviewContext.bind(runner2);
      const output = format([{ version: 1, verdict: 'pass', summary: 'Clean', findings: [] }]);
      expect(output).toContain('_No findings_');
    });
  });

  describe('per-job model storage', () => {
    it('stores opts.model on the constructed job (getJob.model === opts.model)', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '' },
        projectContext: {},
      });
      const mockProcess = createMockProcess();
      (spawn as any).mockReturnValue(mockProcess);

      const jobId = await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp', model: 'opus-4-7' });

      const job = runner.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.model).toBe('opus-4-7');
    });

    it('leaves job.model undefined when opts.model is not set', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '' },
        projectContext: {},
      });
      const mockProcess = createMockProcess();
      (spawn as any).mockReturnValue(mockProcess);

      const jobId = await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp' });

      const job = runner.getJob(jobId);
      expect(job).toBeDefined();
      expect(job!.model).toBeUndefined();
    });

    it('does not break getJobsForProject consumers when model is set', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '' },
        projectContext: {},
      });
      const mockProcess = createMockProcess();
      (spawn as any).mockReturnValue(mockProcess);

      await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', workflowRoot: '/tmp', workspacePath: '/tmp', model: 'sonnet' });
      await runner.run({ projectId: 'p1', specName: 's1', taskId: '2', workflowRoot: '/tmp', workspacePath: '/tmp' });

      const jobs = runner.getJobsForProject('p1');
      expect(jobs.length).toBe(2);
      const withModel = jobs.find(j => j.taskId === '1');
      const withoutModel = jobs.find(j => j.taskId === '2');
      expect(withModel!.model).toBe('sonnet');
      expect(withoutModel!.model).toBeUndefined();
    });
  });

  // The two roots are GENUINELY DISTINCT here. Every other fixture in this file
  // passes the same directory as both roots, which cannot detect the two being
  // swapped — the defect this spec exists to prevent.
  describe('root separation: workflow root vs workspace (requirements 5.2, 5.3, 5.4)', () => {
    let rootsDir: string;
    let workflowRoot: string;  // shared checkout that holds `.spec-workflow`
    let workspacePath: string; // the worktree whose code is under review
    const SPEC = 'root-split';

    let spawnCalls: Array<{ cli: string; args: string[]; opts: any }>;

    beforeAll(async () => {
      rootsDir = join(tmpdir(), `specwf-trr-roots-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      workflowRoot = join(rootsDir, 'repo');
      workspacePath = join(rootsDir, 'repo-wt-a');
      await fs.mkdir(join(workflowRoot, '.spec-workflow', 'specs', SPEC), { recursive: true });
      await fs.mkdir(workspacePath, { recursive: true });
    });

    // Explicit teardown: vitest workers never emit process `exit`.
    afterAll(async () => {
      await fs.rm(rootsDir, { recursive: true, force: true });
    });

    beforeEach(() => {
      spawnCalls = [];
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: {
          taskContext: { description: 'root split' },
          implementationSummary: { filesModified: [] },
          steeringExcerpt: null,
          filesToReview: ['src/a.ts'],
          methodology: '# Methodology',
        },
      });
      // Stand-in review agent: honours the prompt's output-path contract so the
      // job reaches `saveReview`, which is what makes the spec path observable.
      (spawn as any).mockImplementation((cli: string, args: string[], opts: any) => {
        spawnCalls.push({ cli, args, opts });
        const handlers: Record<string, Function[]> = {};
        const child: any = {
          pid: 4242,
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          on: (event: string, cb: Function) => { (handlers[event] ||= []).push(cb); },
          kill: vi.fn(),
        };
        const prompt = String(args[args.length - 1]);
        const outputPath = prompt.match(/Write your results as JSON to: (\S+)/)?.[1];
        setTimeout(() => {
          const write = outputPath
            ? fs.writeFile(outputPath, JSON.stringify({ verdict: 'pass', summary: 'clean', findings: [] }), 'utf-8')
            : Promise.resolve();
          write.finally(() => (handlers['close'] || []).forEach(cb => cb(0)));
        }, 0);
        return child;
      });
    });

    afterEach(() => {
      (spawn as any).mockReset();
      (reviewTaskHandler as any).mockReset();
    });

    async function runToCompletion(taskId: string): Promise<void> {
      const jobId = await runner.run({ projectId: 'p-roots', specName: SPEC, taskId, workflowRoot, workspacePath });
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const job = runner.getJob(jobId);
        if (job?.status === 'completed') return;
        if (job?.status === 'failed') throw new Error(`job failed: ${job.error}`);
        await new Promise(r => setTimeout(r, 5));
      }
      throw new Error('job never reached a terminal state');
    }

    it('resolves the spec path from the workflow root, not the workspace (5.2)', async () => {
      await runToCompletion('1');

      const reviewsDir = join(workflowRoot, '.spec-workflow', 'specs', SPEC, 'reviews');
      const saved = await fs.readdir(reviewsDir).catch(() => [] as string[]);
      expect(
        saved.filter(f => f.startsWith('review-1_')),
        'getSpecPath must resolve against the WORKFLOW ROOT (opts.workflowRoot): no review was saved under <workflowRoot>/.spec-workflow — the roots look swapped, so the spec path landed inside the workspace/worktree'
      ).toHaveLength(1);

      const strayed = await fs.stat(join(workspacePath, '.spec-workflow')).then(() => true, () => false);
      expect(
        strayed,
        'the WORKSPACE (worktree) must never receive a `.spec-workflow` directory: it did, so the spec path was resolved from opts.workspacePath instead of opts.workflowRoot'
      ).toBe(false);
    });

    it('names the prior-review memory file on the workflow root (5.2)', async () => {
      await runToCompletion('2'); // v1 — creates the prior review the next run reads
      await runToCompletion('2'); // v2 — prompt must now carry the memory path

      const prompt = String(spawnCalls[1].args[spawnCalls[1].args.length - 1]);
      expect(
        prompt,
        'the prior-review memory path is derived from the spec path, so it must sit under the WORKFLOW ROOT; a swap sends it into the workspace/worktree (or loses the priors entirely)'
      ).toContain(join(workflowRoot, '.spec-workflow', 'specs', SPEC, 'reviews', 'memory-task-2.md'));
    });

    it('hands the tool a ToolContext with projectPath = workflow root and workspacePath = workspace (5.3)', async () => {
      await runToCompletion('3');

      const context = (reviewTaskHandler as any).mock.calls[0][1];
      expect(
        context.projectPath,
        'ToolContext.projectPath must be the WORKFLOW ROOT (it is what locates `.spec-workflow`); the workspace path is here instead, so the two roots are swapped'
      ).toBe(workflowRoot);
      expect(
        context.workspacePath,
        'ToolContext.workspacePath must be the WORKSPACE (the worktree whose code is diffed and typechecked); the workflow root is here instead, so the two roots are swapped'
      ).toBe(workspacePath);
    });

    it('spawns the review agent with cwd = the workspace, not the workflow root (5.4)', async () => {
      await runToCompletion('4');

      expect(spawnCalls).toHaveLength(1);
      expect(
        spawnCalls[0].opts.cwd,
        'the review agent must be spawned with cwd = the WORKSPACE (the worktree under review); the workflow root is here instead, which silently produces a confident review of the wrong checkout'
      ).toBe(workspacePath);
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
        await runToCompletion('5');

        const env = spawnCalls[0].opts.env as NodeJS.ProcessEnv;
        for (const name of SCRUBBED) {
          expect(env[name], `the review agent inherited ${name}, so its git can read another repository`).toBeUndefined();
        }
        expect(
          env.SPEC_WORKFLOW_WORKSPACE,
          'SPEC_WORKFLOW_WORKSPACE must be set to this job\'s workspace, not inherited from the dashboard process'
        ).toBe(workspacePath);
        expect(
          env.SPEC_WORKFLOW_SHARED_ROOT,
          'SPEC_WORKFLOW_SHARED_ROOT must be set to this job\'s workflow root, not inherited from the dashboard process'
        ).toBe(workflowRoot);
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

  describe('memory file naming', () => {
    it('should use a prefix that does not collide with review files', () => {
      // This is a contract test: the memory file prefix `memory-task-` must NOT
      // match the `review-` prefix used by loadAllReviews to filter review files.
      const reviewPrefix = 'review-';
      const memoryPrefix = 'memory-task-';
      expect(memoryPrefix.startsWith(reviewPrefix)).toBe(false);
    });
  });
});

function createMockProcess() {
  const proc: any = {
    pid: 12345,
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
  };
  return proc;
}
