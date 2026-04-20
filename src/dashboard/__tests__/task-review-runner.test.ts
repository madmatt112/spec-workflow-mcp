import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
      await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', projectPath: '/tmp' });
      await runner.run({ projectId: 'p1', specName: 's1', taskId: '2', projectPath: '/tmp' });

      // 3rd should fail
      await expect(
        runner.run({ projectId: 'p1', specName: 's1', taskId: '3', projectPath: '/tmp' })
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

      await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', projectPath: '/tmp' });

      await expect(
        runner.run({ projectId: 'p1', specName: 's1', taskId: '1', projectPath: '/tmp' })
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

      const jobId = await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', projectPath: '/tmp' });
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

      const jobId = await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', projectPath: '/tmp' });
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

      const jobId = await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', projectPath: '/tmp' });

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

      await runner.run({ projectId: 'p1', specName: 's1', taskId: '1', projectPath: '/tmp' });

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
