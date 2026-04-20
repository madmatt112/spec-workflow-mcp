import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { getTaskReviewHandler } from '../get-task-review.js';
import { ToolContext } from '../../types.js';
import { TaskReviewManager } from '../../core/task-review-manager.js';

describe('get-task-review handler', () => {
  let tempDir: string;
  let context: ToolContext;
  let specPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'get-task-review-test-'));
    specPath = join(tempDir, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specPath, { recursive: true });
    context = { projectPath: tempDir };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createReview(taskId: string, verdict: 'pass' | 'fail' | 'findings', findings: any[] = []) {
    const manager = new TaskReviewManager(specPath);
    return manager.saveReview({ taskId, specName: 'test-spec', verdict, summary: `Review of task ${taskId}`, findings });
  }

  it('should return latest review when one exists', async () => {
    await createReview('1', 'pass');
    const result = await getTaskReviewHandler({ specName: 'test-spec', taskId: '1' }, context);
    expect(result.success).toBe(true);
    expect(result.data.review.verdict).toBe('pass');
    expect(result.data.review.version).toBe(1);
    expect(result.data.review.taskId).toBe('1');
  });

  it('should return error when no review exists', async () => {
    const result = await getTaskReviewHandler({ specName: 'test-spec', taskId: '999' }, context);
    expect(result.success).toBe(false);
    expect(result.message).toContain('No reviews found');
  });

  it('should return specific version when requested', async () => {
    await createReview('1', 'fail', [{ severity: 'critical', title: 'Bug', description: 'Bad' }]);
    await createReview('1', 'pass');

    const result = await getTaskReviewHandler({ specName: 'test-spec', taskId: '1', version: 1 }, context);
    expect(result.success).toBe(true);
    expect(result.data.review.version).toBe(1);
    expect(result.data.review.verdict).toBe('fail');
  });

  it('should return distinct error when requested version does not exist', async () => {
    await createReview('1', 'pass');

    const result = await getTaskReviewHandler({ specName: 'test-spec', taskId: '1', version: 99 }, context);
    expect(result.success).toBe(false);
    expect(result.message).toContain('version 99 not found');
    expect(result.message).toContain('Available versions: 1');
  });

  it('should return error when spec does not exist', async () => {
    const result = await getTaskReviewHandler({ specName: 'nonexistent-spec', taskId: '1' }, context);
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');

    // Verify no phantom directory was created
    const phantomPath = join(tempDir, '.spec-workflow', 'specs', 'nonexistent-spec', 'reviews');
    await expect(fs.stat(phantomPath)).rejects.toThrow();
  });

  it('should return latest version when multiple exist', async () => {
    await createReview('1', 'fail', [{ severity: 'critical', title: 'Bug', description: 'Bad' }]);
    await createReview('1', 'findings', [{ severity: 'warning', title: 'Warn', description: 'Meh' }]);
    await createReview('1', 'pass');

    const result = await getTaskReviewHandler({ specName: 'test-spec', taskId: '1' }, context);
    expect(result.success).toBe(true);
    expect(result.data.review.version).toBe(3);
    expect(result.data.review.verdict).toBe('pass');
  });

  it('should include findings in the response', async () => {
    await createReview('1', 'findings', [
      { severity: 'warning', title: 'Missing check', file: 'src/handler.ts', line: 42, description: 'No null check', category: 'spec-compliance' },
    ]);

    const result = await getTaskReviewHandler({ specName: 'test-spec', taskId: '1' }, context);
    expect(result.success).toBe(true);
    expect(result.data.review.findings).toHaveLength(1);
    expect(result.data.review.findings[0].severity).toBe('warning');
    expect(result.data.review.findings[0].file).toBe('src/handler.ts');
    expect(result.data.review.findings[0].line).toBe(42);
  });
});
