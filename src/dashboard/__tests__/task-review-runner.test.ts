import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TaskReviewRunner, type BuildPromptOptions } from '../task-review-runner.js';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock the review-task handler. The rest of the module is passed through: the
// runner also imports `hasNoReviewableFiles` and NO_REVIEWABLE_FILES_DISCLOSURE
// from it (requirement 4.20), and stubbing those would let the prompt assertions
// below pass against text the tool never emits.
vi.mock('../../tools/review-task.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../tools/review-task.js')>()),
  reviewTaskHandler: vi.fn(),
}));

import { spawn } from 'child_process';
import { reviewTaskHandler, NO_REVIEWABLE_FILES_DISCLOSURE, type ExecutionContext } from '../../tools/review-task.js';
import { containmentRejectionMessage } from '../../core/task-diff.js';

// Defaults for the execution-context object and the diff fields task 9 carries
// into the prompt. Spread into every reviewTaskHandler mock and buildPrompt call
// so the renderer never dereferences an undefined executionContext.
const DEFAULT_EXECUTION_CONTEXT: ExecutionContext = {
  workspacePath: '/ws',
  workflowRoot: '/root',
  specWorkflowDir: '/root/.spec-workflow',
  diffBase: {
    commit: 'HEAD',
    provenance: 'head-expected',
    detail: 'No diff base is recorded for this workspace; the diff spans HEAD to the working tree, so committed changes are not shown.',
  },
  typecheck: { status: 'success', reason: null, observed: null },
  attribution: { state: 'unknown', workspacePath: null, commit: null, source: null },
  notes: [],
};

const DEFAULT_DIFF_FIELDS = {
  diff: '',
  diffStats: null,
  diffTruncated: false,
  skippedPaths: [],
};

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
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '', executionContext: DEFAULT_EXECUTION_CONTEXT, ...DEFAULT_DIFF_FIELDS },
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
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '', executionContext: DEFAULT_EXECUTION_CONTEXT, ...DEFAULT_DIFF_FIELDS },
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
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '', executionContext: DEFAULT_EXECUTION_CONTEXT, ...DEFAULT_DIFF_FIELDS },
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
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '', executionContext: DEFAULT_EXECUTION_CONTEXT, ...DEFAULT_DIFF_FIELDS },
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
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '', executionContext: DEFAULT_EXECUTION_CONTEXT, ...DEFAULT_DIFF_FIELDS },
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
      const prompt = build({
        specName: 'test-spec',
        taskId: '1',
        taskContext: { description: 'test task' },
        implementationSummary: { filesModified: [] },
        steeringExcerpt: null,
        filesToReview: [{ path: 'src/file.ts', root: 'workspace', ambiguous: false }],
        methodology: '# Methodology',
        outputPath: '/tmp/output.json',
        priorReviewContext: null,
        priorMemoryContent: null,
        memoryFilePath: null,
        executionContext: DEFAULT_EXECUTION_CONTEXT,
        ...DEFAULT_DIFF_FIELDS,
        diffPath: null,
      });
      expect(prompt).not.toContain('## Prior Review Context');
      expect(prompt).not.toContain('## Prior Review Memory');
      expect(prompt).not.toContain('## Memory File Update');
      expect(prompt).not.toContain('classification');
    });

    it('should include Prior Review Context and Memory sections on v2+', () => {
      const runner2 = new TaskReviewRunner();
      const build = (runner2 as any).buildPrompt.bind(runner2);
      const priorContext = '### Version 1 (findings): v1 summary\n- [warning] Some warning (file.ts:10)\n';
      const prompt = build({
        specName: 'test-spec',
        taskId: '1',
        taskContext: { description: 'test task' },
        implementationSummary: { filesModified: [] },
        steeringExcerpt: null,
        filesToReview: [{ path: 'src/file.ts', root: 'workspace', ambiguous: false }],
        methodology: '# Methodology',
        outputPath: '/tmp/output.json',
        priorReviewContext: priorContext,
        priorMemoryContent: null,
        memoryFilePath: '/tmp/memory-task-1.md',
        executionContext: DEFAULT_EXECUTION_CONTEXT,
        ...DEFAULT_DIFF_FIELDS,
        diffPath: null,
      });
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
      const prompt = build({
        specName: 'test-spec',
        taskId: '1',
        taskContext: { description: 'test' },
        implementationSummary: { filesModified: [] },
        steeringExcerpt: null,
        filesToReview: [],
        methodology: '# M',
        outputPath: '/tmp/out.json',
        priorReviewContext: 'context',
        priorMemoryContent: memoryContent,
        memoryFilePath: '/tmp/memory.md',
        executionContext: DEFAULT_EXECUTION_CONTEXT,
        ...DEFAULT_DIFF_FIELDS,
        diffPath: null,
      });
      expect(prompt).toContain('Existing content from prior iterations');
    });

    it('should show default memory text when no prior memory exists', () => {
      const runner2 = new TaskReviewRunner();
      const build = (runner2 as any).buildPrompt.bind(runner2);
      const prompt = build({
        specName: 'test-spec',
        taskId: '1',
        taskContext: { description: 'test' },
        implementationSummary: { filesModified: [] },
        steeringExcerpt: null,
        filesToReview: [],
        methodology: '# M',
        outputPath: '/tmp/out.json',
        priorReviewContext: 'context',
        priorMemoryContent: null,
        memoryFilePath: '/tmp/memory.md',
        executionContext: DEFAULT_EXECUTION_CONTEXT,
        ...DEFAULT_DIFF_FIELDS,
        diffPath: null,
      });
      expect(prompt).toContain('No memory file yet');
    });

    it('renders the labelled file list as "- <path> (<root>)" with no object placeholders', () => {
      const runner2 = new TaskReviewRunner();
      const build = (runner2 as any).buildPrompt.bind(runner2);
      const prompt = build({
        specName: 'test-spec',
        taskId: '1',
        taskContext: { description: 'test' },
        implementationSummary: { filesModified: [] },
        steeringExcerpt: null,
        filesToReview: [
          { path: '/ws/src/file.ts', root: 'workspace', ambiguous: false },
          { path: '/root/.spec-workflow/notes.md', root: 'workflow', ambiguous: false },
        ],
        methodology: '# M',
        outputPath: '/tmp/out.json',
        executionContext: DEFAULT_EXECUTION_CONTEXT,
        ...DEFAULT_DIFF_FIELDS,
        diffPath: null,
      });
      expect(prompt).not.toContain('[object Object]');
      expect(prompt).toContain('- /ws/src/file.ts (workspace)');
      expect(prompt).toContain('- /root/.spec-workflow/notes.md (workflow)');
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
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '', executionContext: DEFAULT_EXECUTION_CONTEXT, ...DEFAULT_DIFF_FIELDS },
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
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '', executionContext: DEFAULT_EXECUTION_CONTEXT, ...DEFAULT_DIFF_FIELDS },
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
        data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null, filesToReview: [], methodology: '', executionContext: DEFAULT_EXECUTION_CONTEXT, ...DEFAULT_DIFF_FIELDS },
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
          filesToReview: [{ path: 'src/a.ts', root: 'workspace', ambiguous: false }],
          methodology: '# Methodology',
          executionContext: DEFAULT_EXECUTION_CONTEXT,
          ...DEFAULT_DIFF_FIELDS,
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

    // Requirement 4.22: the file list reaches the agent through an `any`-typed
    // destructure, so nothing but this assertion catches a renderer that still
    // interpolates the record.
    it('renders each reviewable file with its root in the spawned prompt (4.18, 4.22)', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: {
          taskContext: { description: 'root split' },
          implementationSummary: { filesModified: [] },
          steeringExcerpt: null,
          filesToReview: [
            { path: join(workspacePath, 'src', 'a.ts'), root: 'workspace', ambiguous: false },
            { path: join(workflowRoot, '.spec-workflow', 'notes.md'), root: 'workflow', ambiguous: false },
          ],
          methodology: '# Methodology',
          executionContext: DEFAULT_EXECUTION_CONTEXT,
          ...DEFAULT_DIFF_FIELDS,
        },
      });

      await runToCompletion('5');

      const prompt = String(spawnCalls[0].args[spawnCalls[0].args.length - 1]);
      expect(
        prompt,
        'the labelled file record was interpolated whole: the renderer must read `.path`, not the object'
      ).not.toContain('[object Object]');
      expect(prompt).toContain(`- ${join(workspacePath, 'src', 'a.ts')} (workspace)`);
      expect(prompt).toContain(`- ${join(workflowRoot, '.spec-workflow', 'notes.md')} (workflow)`);
    });

    // Requirement 4.22: `methodology` and `outputPath` are the two fields the
    // old positional list could silently shift into each other's slots. The
    // output path is pinned by the stand-in agent above (it parses the prompt to
    // learn where to write, so a wrong value fails the job). This is the
    // equivalent pin for the methodology: it is asserted INSIDE its own section,
    // because a bare whole-prompt search still passes when the methodology has
    // merely swapped places with another rendered field.
    it('renders the methodology returned by prepare under "## Review Methodology" (4.22)', async () => {
      const METHODOLOGY = [
        '# Task Review Methodology',
        '',
        '- [ ] R4_22_METHODOLOGY_MARKER: the checklist prepare selected for this review.',
      ].join('\n');
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: {
          taskContext: { description: 'root split' },
          implementationSummary: { filesModified: [] },
          steeringExcerpt: '## Steering excerpt R4_22_STEERING_MARKER',
          filesToReview: [{ path: join(workspacePath, 'src', 'a.ts'), root: 'workspace', ambiguous: false }],
          methodology: METHODOLOGY,
          executionContext: DEFAULT_EXECUTION_CONTEXT,
          ...DEFAULT_DIFF_FIELDS,
        },
      });

      await runToCompletion('6');

      const prompt = String(spawnCalls[0].args[spawnCalls[0].args.length - 1]);
      const section = prompt.slice(
        prompt.indexOf('## Review Methodology'),
        prompt.indexOf('## Instructions')
      );
      expect(
        section,
        'the methodology prepare selected must be what is rendered under "## Review Methodology": it is not there, so the `methodology` slot received something else — a constant, or a neighbouring field (steeringExcerpt, filesToReview, outputPath) shifted into it'
      ).toContain('R4_22_METHODOLOGY_MARKER');
      expect(
        section,
        'the steering excerpt is rendered in the methodology slot: `methodology` and `steeringExcerpt` have swapped places'
      ).not.toContain('R4_22_STEERING_MARKER');
    });

    // Requirements 4.19/4.20: the counts and the all-drop disclosure reach the
    // spawned reviewer only if `fileResolution` survives the `any`-typed
    // destructure of `prepareResponse.data`. Dropping it there produces no
    // compiler error and no test failure anywhere else.
    it('replaces the read-every-file instruction with the all-drop disclosure in the spawned prompt (4.19, 4.20)', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: {
          taskContext: { description: 'root split' },
          implementationSummary: { filesModified: ['src/gone.ts'] },
          steeringExcerpt: null,
          filesToReview: [],
          fileResolution: {
            workspaceCount: 0,
            workflowCount: 0,
            drops: { 'not-array': 0, 'not-string': 0, 'resolve-threw': 0, missing: 1, 'realpath-failed': 0, 'outside-roots': 1 },
          },
          methodology: '# Methodology',
          executionContext: DEFAULT_EXECUTION_CONTEXT,
          ...DEFAULT_DIFF_FIELDS,
        },
      });

      await runToCompletion('7');

      const prompt = String(spawnCalls[0].args[spawnCalls[0].args.length - 1]);
      expect(
        prompt,
        'the counts must be stated to the reviewer: `fileResolution` was dropped by the runner\'s any-typed destructure of prepareResponse.data'
      ).toContain('File resolution: 0 resolved in the workspace, 0 under the shared .spec-workflow root, 2 dropped (missing: 1, outside-roots: 1).');
      expect(prompt).toContain(`1. ${NO_REVIEWABLE_FILES_DISCLOSURE}`);
      expect(
        prompt,
        'the read-every-file instruction must be REPLACED, not merely preceded by a note: leaving it renders a pass over unexamined code as the compliant outcome'
      ).not.toContain('1. Read every file listed in "Files to Review".');
    });

    it('keeps the read-every-file instruction when files did resolve in the workspace (4.20)', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: {
          taskContext: { description: 'root split' },
          implementationSummary: { filesModified: ['src/a.ts'] },
          steeringExcerpt: null,
          filesToReview: [{ path: join(workspacePath, 'src', 'a.ts'), root: 'workspace', ambiguous: false }],
          fileResolution: {
            workspaceCount: 1,
            workflowCount: 0,
            drops: { 'not-array': 0, 'not-string': 0, 'resolve-threw': 0, missing: 0, 'realpath-failed': 0, 'outside-roots': 0 },
          },
          methodology: '# Methodology',
          executionContext: DEFAULT_EXECUTION_CONTEXT,
          ...DEFAULT_DIFF_FIELDS,
        },
      });

      await runToCompletion('8');

      const prompt = String(spawnCalls[0].args[spawnCalls[0].args.length - 1]);
      expect(prompt).toContain('1. Read every file listed in "Files to Review".');
      expect(prompt).not.toContain(NO_REVIEWABLE_FILES_DISCLOSURE);
      expect(prompt).toContain('File resolution: 1 resolved in the workspace, 0 under the shared .spec-workflow root, 0 dropped.');
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

  // Design Component 8: the runner renders the execution context and the diff
  // state that `handlePrepare` produced, facts only (requirements 4.2–4.5, 4.6).
  describe('execution context and diff sections (4.2, 4.3, 4.4, 4.5)', () => {
    function build(overrides: Record<string, any> = {}): string {
      const r = new TaskReviewRunner();
      return (r as any).buildPrompt.bind(r)({
        specName: 'test-spec',
        taskId: '1',
        taskContext: { description: 'test' },
        implementationSummary: { filesModified: [] },
        steeringExcerpt: null,
        filesToReview: [],
        methodology: '# M',
        outputPath: '/tmp/out.json',
        executionContext: DEFAULT_EXECUTION_CONTEXT,
        ...DEFAULT_DIFF_FIELDS,
        diffPath: null,
        ...overrides,
      });
    }

    it('renders the execution-context section with base, typecheck and attribution facts (4.2)', () => {
      const prompt = build();
      expect(prompt).toContain('## Execution Context');
      expect(prompt).toContain('- Workspace: /ws');
      expect(prompt).toContain('- Workflow root: /root (spec store: /root/.spec-workflow)');
      expect(prompt).toContain('- Diff base: HEAD (head-expected). No diff base is recorded for this workspace');
      expect(prompt).toContain('- Typecheck: success');
      expect(prompt).toContain('- Attribution: unknown');
    });

    it('renders a degraded typecheck with its reason and observed text (4.2)', () => {
      const prompt = build({
        executionContext: {
          ...DEFAULT_EXECUTION_CONTEXT,
          typecheck: { status: 'unavailable', reason: 'no-tsconfig', observed: 'no `tsconfig.json` at `/ws/tsconfig.json`' },
        },
      });
      expect(prompt).toContain('- Typecheck: unavailable, reason no-tsconfig. no `tsconfig.json` at `/ws/tsconfig.json`');
    });

    it('renders the attribution mismatch line and its note verbatim (7.3)', () => {
      const note = 'Name in your review summary that this work was logged from `/other/ws`, not from the workspace under review.';
      const prompt = build({
        executionContext: {
          ...DEFAULT_EXECUTION_CONTEXT,
          attribution: { state: 'mismatch', workspacePath: '/other/ws', commit: 'abc123', source: 'context' },
          notes: [note],
        },
      });
      expect(prompt).toContain('- Attribution: mismatch. Logged from /other/ws at abc123 (context)');
      expect(prompt).toContain(note);
    });

    it('writes "unknown commit" when a matched attribution has no commit', () => {
      const prompt = build({
        executionContext: {
          ...DEFAULT_EXECUTION_CONTEXT,
          attribution: { state: 'match', workspacePath: '/ws', commit: null, source: 'override' },
        },
      });
      expect(prompt).toContain('- Attribution: match. Logged from /ws at unknown commit (override)');
    });

    it('states the containment rejection message verbatim when the diff was rejected (7.5)', () => {
      const message = containmentRejectionMessage(['/outside/x.ts'], '/ws');
      const prompt = build({ diffRejection: { message } });
      expect(prompt).toContain('## Diff');
      expect(prompt).toContain(`No diff was computed. ${message}`);
      expect(prompt).toContain('DIFF CONTAINMENT ASSERTION FAILED.');
    });

    it('states an empty diff with the "empty" state word', () => {
      const prompt = build();
      expect(prompt).toContain('The diff is empty (state: empty).');
    });

    it('states the "no-files" diff state when no workspace files resolved (5.4)', () => {
      const prompt = build({
        fileResolution: { workspaceCount: 0, workflowCount: 1, drops: { missing: 0 } },
      });
      expect(prompt).toContain('The diff is empty (state: no-files).');
    });

    it('names the diff file, its byte size and its stats when a diff is present (4.4)', () => {
      const diff = 'diff --git a/x b/x\n+added\n';
      const prompt = build({
        diff,
        diffStats: { filesChanged: 1, linesAdded: 1, linesRemoved: 0 },
        diffPath: '/tmp/task-review-test-spec-1.diff',
      });
      expect(prompt).toContain(
        `\`data.diff\` named by the methodology is the file /tmp/task-review-test-spec-1.diff (${Buffer.byteLength(diff)} bytes; 1 files, +1 -0).`
      );
      // The body is never inlined (requirement 4.4, E2BIG).
      expect(prompt).not.toContain('+added\n');
    });

    it('marks a truncated diff (4.4)', () => {
      const prompt = build({
        diff: 'x',
        diffStats: { filesChanged: 2, linesAdded: 5, linesRemoved: 3 },
        diffTruncated: true,
        diffPath: '/tmp/t.diff',
      });
      expect(prompt).toContain('2 files, +5 -3, truncated).');
    });

    it('lists denylisted skipped paths (4.3)', () => {
      const prompt = build({ skippedPaths: ['a.env', 'b.key'] });
      expect(prompt).toContain('Skipped paths (denylisted): a.env, b.key');
    });

    it('rejects a BuildPromptOptions literal without executionContext (tsc)', () => {
      // Omitting the now-required executionContext must not type-check. If this
      // literal ever compiles, `@ts-expect-error` fails `npx tsc --noEmit` as an
      // unused directive — which is the assertion (requirement 4.1, design D16).
      // @ts-expect-error executionContext is required
      const badOpts: BuildPromptOptions = {
        specName: 's',
        taskId: '1',
        taskContext: {},
        implementationSummary: {},
        steeringExcerpt: null,
        filesToReview: [],
        methodology: '',
        outputPath: '/tmp/o.json',
        diff: '',
        diffStats: null,
        diffTruncated: false,
        skippedPaths: [],
        diffPath: null,
      };
      expect(badOpts).toBeDefined();
    });
  });

  // Requirement 4.4: the diff body travels as a file beside the output file and
  // is removed with it — the same lifecycle the output file already has.
  describe('diff file lifecycle (4.4)', () => {
    let dir: string;
    let workflowRoot: string;
    let workspacePath: string;
    const SPEC = 'diff-life';
    let spawnCalls: Array<{ args: string[] }>;
    let diffPathAtSpawn: string | null;
    let diffFilePresentAtSpawn: boolean | null;

    beforeAll(async () => {
      dir = join(tmpdir(), `specwf-trr-diff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
      workflowRoot = join(dir, 'repo');
      workspacePath = join(dir, 'repo-wt-a');
      await fs.mkdir(join(workflowRoot, '.spec-workflow', 'specs', SPEC), { recursive: true });
      await fs.mkdir(workspacePath, { recursive: true });
    });

    afterAll(async () => {
      await fs.rm(dir, { recursive: true, force: true });
    });

    beforeEach(() => {
      spawnCalls = [];
      diffPathAtSpawn = null;
      diffFilePresentAtSpawn = null;
      (spawn as any).mockImplementation((_cli: string, args: string[]) => {
        spawnCalls.push({ args });
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
        diffPathAtSpawn = prompt.match(/is the file (\S+\.diff) /)?.[1] ?? null;
        setTimeout(async () => {
          if (diffPathAtSpawn) {
            diffFilePresentAtSpawn = await fs.stat(diffPathAtSpawn).then(() => true, () => false);
          }
          if (outputPath) {
            await fs.writeFile(outputPath, JSON.stringify({ verdict: 'pass', summary: 'clean', findings: [] }), 'utf-8');
          }
          (handlers['close'] || []).forEach(cb => cb(0));
        }, 0);
        return child;
      });
    });

    afterEach(() => {
      (spawn as any).mockReset();
      (reviewTaskHandler as any).mockReset();
    });

    async function runToCompletion(taskId: string): Promise<void> {
      const jobId = await runner.run({ projectId: 'p-diff', specName: SPEC, taskId, workflowRoot, workspacePath });
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        const job = runner.getJob(jobId);
        if (job?.status === 'completed') return;
        if (job?.status === 'failed') throw new Error(`job failed: ${job.error}`);
        await new Promise(r => setTimeout(r, 5));
      }
      throw new Error('job never reached a terminal state');
    }

    it('writes the diff file, names it in the prompt, and removes it after the job (4.4)', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: {
          taskContext: { description: 'd' },
          implementationSummary: { filesModified: ['src/a.ts'] },
          steeringExcerpt: null,
          filesToReview: [{ path: join(workspacePath, 'src', 'a.ts'), root: 'workspace', ambiguous: false }],
          methodology: '# Methodology',
          executionContext: DEFAULT_EXECUTION_CONTEXT,
          diff: 'diff --git a/src/a.ts b/src/a.ts\n+added line\n',
          diffStats: { filesChanged: 1, linesAdded: 1, linesRemoved: 0 },
          diffTruncated: false,
          skippedPaths: [],
        },
      });

      await runToCompletion('1');

      const prompt = String(spawnCalls[0].args[spawnCalls[0].args.length - 1]);
      expect(diffPathAtSpawn).toBeTruthy();
      expect(prompt).toContain(diffPathAtSpawn!);
      expect(diffFilePresentAtSpawn, 'the diff file must exist while the agent runs').toBe(true);

      // The unlink runs after the status flips to completed; wait for it.
      const goneDeadline = Date.now() + 2000;
      let stillThere = true;
      while (Date.now() < goneDeadline) {
        stillThere = await fs.stat(diffPathAtSpawn!).then(() => true, () => false);
        if (!stillThere) break;
        await new Promise(r => setTimeout(r, 5));
      }
      expect(stillThere, 'the diff file must be removed with the output file').toBe(false);
    });

    it('writes no diff file for an empty diff (4.4)', async () => {
      (reviewTaskHandler as any).mockResolvedValue({
        success: true,
        data: {
          taskContext: { description: 'd' },
          implementationSummary: { filesModified: [] },
          steeringExcerpt: null,
          filesToReview: [{ path: join(workspacePath, 'src', 'a.ts'), root: 'workspace', ambiguous: false }],
          methodology: '# Methodology',
          executionContext: DEFAULT_EXECUTION_CONTEXT,
          diff: '',
          diffStats: null,
          diffTruncated: false,
          skippedPaths: [],
        },
      });

      await runToCompletion('2');

      const prompt = String(spawnCalls[0].args[spawnCalls[0].args.length - 1]);
      expect(prompt).toContain('The diff is empty (state: empty).');
      expect(diffPathAtSpawn, 'no .diff file path should appear for an empty diff').toBeNull();
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
