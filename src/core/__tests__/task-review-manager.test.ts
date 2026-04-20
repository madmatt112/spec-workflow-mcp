import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { TaskReviewManager } from '../task-review-manager.js';

describe('TaskReviewManager', () => {
  let tempDir: string;
  let manager: TaskReviewManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'review-manager-test-'));
    manager = new TaskReviewManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('prepare marker', () => {
    it('should write and detect a prepare marker', async () => {
      expect(await manager.hasPrepareMarker('1.2')).toBe(false);
      await manager.writePrepareMarker('1.2');
      expect(await manager.hasPrepareMarker('1.2')).toBe(true);
    });

    it('should remove a prepare marker', async () => {
      await manager.writePrepareMarker('1');
      await manager.removePrepareMarker('1');
      expect(await manager.hasPrepareMarker('1')).toBe(false);
    });

    it('should not error when removing non-existent marker', async () => {
      await expect(manager.removePrepareMarker('999')).resolves.not.toThrow();
    });
  });

  describe('saveReview', () => {
    it('should save a passing review as v1', async () => {
      const review = await manager.saveReview({
        taskId: '1',
        specName: 'test-spec',
        verdict: 'pass',
        summary: 'All good',
        findings: [],
      });

      expect(review.id).toBeTruthy();
      expect(review.version).toBe(1);
      expect(review.verdict).toBe('pass');
      expect(review.timestamp).toBeTruthy();
    });

    it('should increment version on re-review', async () => {
      await manager.saveReview({
        taskId: '1',
        specName: 'test-spec',
        verdict: 'fail',
        summary: 'Has criticals',
        findings: [{ severity: 'critical', title: 'Bug', description: 'Bad code' }],
      });

      const v2 = await manager.saveReview({
        taskId: '1',
        specName: 'test-spec',
        verdict: 'pass',
        summary: 'Fixed',
        findings: [],
      });

      expect(v2.version).toBe(2);
    });

    it('should save findings with all fields', async () => {
      const review = await manager.saveReview({
        taskId: '2.1',
        specName: 'test-spec',
        verdict: 'fail',
        summary: 'Critical issue found',
        findings: [
          {
            severity: 'critical',
            title: 'Missing auth check',
            file: 'src/handler.ts',
            line: 42,
            description: 'No authentication on endpoint',
            taskRequirement: 'REQ-001',
            category: 'spec-compliance',
          },
          {
            severity: 'info',
            title: 'Debug log left in',
            description: 'console.log statement',
            category: 'hygiene',
          },
        ],
      });

      expect(review.findings).toHaveLength(2);
      expect(review.findings[0].severity).toBe('critical');
      expect(review.findings[1].category).toBe('hygiene');
    });

    it('should remove prepare marker after saving', async () => {
      await manager.writePrepareMarker('1');
      await manager.saveReview({
        taskId: '1',
        specName: 'test-spec',
        verdict: 'pass',
        summary: 'Clean',
        findings: [],
      });
      expect(await manager.hasPrepareMarker('1')).toBe(false);
    });
  });

  describe('getReviewsForTask', () => {
    it('should return empty for unknown task', async () => {
      const reviews = await manager.getReviewsForTask('999');
      expect(reviews).toHaveLength(0);
    });

    it('should return reviews sorted by version', async () => {
      await manager.saveReview({ taskId: '1', specName: 's', verdict: 'fail', summary: 'v1', findings: [{ severity: 'critical', title: 'x', description: 'y' }] });
      await manager.saveReview({ taskId: '1', specName: 's', verdict: 'pass', summary: 'v2', findings: [] });

      const reviews = await manager.getReviewsForTask('1');
      expect(reviews).toHaveLength(2);
      expect(reviews[0].version).toBe(1);
      expect(reviews[1].version).toBe(2);
    });
  });

  describe('getLatestReview', () => {
    it('should return null for unknown task', async () => {
      expect(await manager.getLatestReview('999')).toBeNull();
    });

    it('should return the highest version', async () => {
      await manager.saveReview({ taskId: '1', specName: 's', verdict: 'fail', summary: 'v1', findings: [{ severity: 'critical', title: 'x', description: 'y' }] });
      await manager.saveReview({ taskId: '1', specName: 's', verdict: 'pass', summary: 'v2', findings: [] });

      const latest = await manager.getLatestReview('1');
      expect(latest?.version).toBe(2);
      expect(latest?.verdict).toBe('pass');
    });
  });

  describe('markdown round-trip', () => {
    it('should persist and reload review with findings', async () => {
      await manager.saveReview({
        taskId: '3.1',
        specName: 'my-feature',
        verdict: 'findings',
        summary: 'Some warnings found',
        findings: [
          {
            severity: 'warning',
            title: 'Unused import',
            file: 'src/util.ts',
            line: 5,
            description: 'Import is never used',
            taskRequirement: 'REQ-003',
          },
        ],
      });

      const loaded = await manager.getLatestReview('3.1');
      expect(loaded).not.toBeNull();
      expect(loaded!.taskId).toBe('3.1');
      expect(loaded!.specName).toBe('my-feature');
      expect(loaded!.verdict).toBe('findings');
      expect(loaded!.version).toBe(1);
      expect(loaded!.findings).toHaveLength(1);
      expect(loaded!.findings[0].severity).toBe('warning');
      expect(loaded!.findings[0].title).toBe('Unused import');
      expect(loaded!.findings[0].file).toBe('src/util.ts');
      expect(loaded!.findings[0].line).toBe(5);
    });

    it('should round-trip YAML frontmatter fields', async () => {
      await manager.saveReview({
        taskId: '1',
        specName: 'test',
        verdict: 'fail',
        summary: 'Bad',
        findings: [
          { severity: 'critical', title: 'A', description: 'desc' },
          { severity: 'warning', title: 'B', description: 'desc' },
          { severity: 'info', title: 'C', description: 'desc' },
        ],
      });

      // Read raw file to check frontmatter
      const reviewsDir = manager.getReviewsDir();
      const files = await fs.readdir(reviewsDir);
      const mdFile = files.find(f => f.startsWith('review-'));
      const content = await fs.readFile(join(reviewsDir, mdFile!), 'utf-8');

      expect(content).toContain('criticalCount: 1');
      expect(content).toContain('warningCount: 1');
      expect(content).toContain('infoCount: 1');
      expect(content).toContain('verdict: fail');
    });
  });

  describe('classification field round-trip', () => {
    it('should round-trip classification through save/load', async () => {
      await manager.saveReview({
        taskId: '1',
        specName: 'my-feature',
        verdict: 'findings',
        summary: 'Iterative review findings',
        findings: [
          { severity: 'warning', title: 'Still here', description: 'Same as before', classification: 'recurring' },
          { severity: 'info', title: 'New thing', description: 'Just noticed', classification: 'novel' },
          { severity: 'warning', title: 'Deeper issue', description: 'Builds on v1', classification: 'compounding' },
        ],
      });

      const loaded = await manager.getLatestReview('1');
      expect(loaded).not.toBeNull();
      expect(loaded!.findings).toHaveLength(3);
      expect(loaded!.findings.find(f => f.title === 'Still here')?.classification).toBe('recurring');
      expect(loaded!.findings.find(f => f.title === 'New thing')?.classification).toBe('novel');
      expect(loaded!.findings.find(f => f.title === 'Deeper issue')?.classification).toBe('compounding');
    });

    it('should load findings without classification as undefined (backward compat)', async () => {
      await manager.saveReview({
        taskId: '1',
        specName: 'my-feature',
        verdict: 'findings',
        summary: 'Old-style review',
        findings: [
          { severity: 'warning', title: 'No classification here', description: 'Just a warning' },
        ],
      });

      const loaded = await manager.getLatestReview('1');
      expect(loaded!.findings[0].classification).toBeUndefined();
    });

    it('should not emit classification line when finding has no classification', async () => {
      await manager.saveReview({
        taskId: '1',
        specName: 'my-feature',
        verdict: 'findings',
        summary: 'Mixed review',
        findings: [
          { severity: 'warning', title: 'With class', description: 'x', classification: 'novel' },
          { severity: 'info', title: 'Without class', description: 'y' },
        ],
      });

      const reviewsDir = manager.getReviewsDir();
      const files = await fs.readdir(reviewsDir);
      const mdFile = files.find(f => f.startsWith('review-'));
      const content = await fs.readFile(join(reviewsDir, mdFile!), 'utf-8');

      // Count how many Classification lines exist — should be exactly 1
      const matches = content.match(/- \*\*Classification:\*\*/g) || [];
      expect(matches.length).toBe(1);
    });
  });
});
