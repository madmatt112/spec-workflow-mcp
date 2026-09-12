import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  normalizeApprovalFilePath,
  readApprovalRecords,
  findLatestApprovalForFile,
  deriveDocumentApprovalStates,
} from '../approval-records.js';

describe('approval-records', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'approval-records-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function writeRecord(category: string, record: Record<string, unknown>): Promise<void> {
    const dir = join(tempDir, '.spec-workflow', 'approvals', category);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, `${record.id}.json`), JSON.stringify(record), 'utf-8');
  }

  function record(id: string, filePath: string, status: string, createdAt: string, extra: Record<string, unknown> = {}) {
    return {
      id,
      title: id,
      filePath,
      type: 'document',
      status,
      createdAt,
      category: 'spec',
      categoryName: 'alpha',
      ...extra,
    };
  }

  describe('normalizeApprovalFilePath', () => {
    it('strips leading ./ and / and converts backslashes', () => {
      expect(normalizeApprovalFilePath('./.spec-workflow/specs/a/requirements.md')).toBe('.spec-workflow/specs/a/requirements.md');
      expect(normalizeApprovalFilePath('/.spec-workflow/specs/a/requirements.md')).toBe('.spec-workflow/specs/a/requirements.md');
      expect(normalizeApprovalFilePath('.spec-workflow\\specs\\a\\design.md')).toBe('.spec-workflow/specs/a/design.md');
      expect(normalizeApprovalFilePath('.spec-workflow/specs/a/tasks.md')).toBe('.spec-workflow/specs/a/tasks.md');
    });
  });

  describe('readApprovalRecords', () => {
    it('returns an empty list when the approvals directory is missing', async () => {
      expect(await readApprovalRecords(tempDir)).toEqual([]);
    });

    it('reads every category, skips hidden directories and malformed files, newest first', async () => {
      await writeRecord('alpha', record('a1', '.spec-workflow/specs/alpha/requirements.md', 'pending', '2026-01-01T00:00:00.000Z'));
      await writeRecord('alpha', record('a2', '.spec-workflow/specs/alpha/requirements.md', 'approved', '2026-01-03T00:00:00.000Z'));
      await writeRecord('beta', record('b1', '.spec-workflow/specs/beta/design.md', 'rejected', '2026-01-02T00:00:00.000Z'));

      const snapshots = join(tempDir, '.spec-workflow', 'approvals', 'alpha', '.snapshots', 'requirements.md');
      await fs.mkdir(snapshots, { recursive: true });
      await fs.writeFile(join(snapshots, 'metadata.json'), JSON.stringify({ filePath: 'x', currentVersion: 1, snapshots: [] }), 'utf-8');
      await fs.writeFile(join(tempDir, '.spec-workflow', 'approvals', 'alpha', 'broken.json'), '{not json', 'utf-8');
      await fs.writeFile(join(tempDir, '.spec-workflow', 'approvals', 'alpha', 'notes.txt'), 'ignored', 'utf-8');

      const records = await readApprovalRecords(tempDir);
      expect(records.map(r => r.id)).toEqual(['a2', 'b1', 'a1']);
    });
  });

  describe('findLatestApprovalForFile', () => {
    it('picks the newest record by createdAt regardless of array order', () => {
      const records: any[] = [
        record('old', '.spec-workflow/specs/alpha/requirements.md', 'approved', '2026-01-01T00:00:00.000Z'),
        record('new', './.spec-workflow/specs/alpha/requirements.md', 'pending', '2026-01-05T00:00:00.000Z'),
        record('other', '.spec-workflow/specs/alpha/design.md', 'approved', '2026-01-09T00:00:00.000Z'),
      ];
      expect(findLatestApprovalForFile(records, '.spec-workflow/specs/alpha/requirements.md')?.id).toBe('new');
      expect(findLatestApprovalForFile(records, '.spec-workflow/specs/alpha/tasks.md')).toBeNull();
    });
  });

  describe('deriveDocumentApprovalStates', () => {
    it('reports the newest record per document', async () => {
      await writeRecord('alpha', record('r1', '.spec-workflow/specs/alpha/requirements.md', 'approved', '2026-01-01T00:00:00.000Z', { respondedAt: '2026-01-01T01:00:00.000Z' }));
      await writeRecord('alpha', record('r2', '.spec-workflow/specs/alpha/requirements.md', 'pending', '2026-01-02T00:00:00.000Z'));
      await writeRecord('alpha', record('d1', '.spec-workflow/specs/alpha/design.md', 'approved', '2026-01-03T00:00:00.000Z', { respondedAt: '2026-01-03T01:00:00.000Z' }));
      // A record for another spec must not leak in
      await writeRecord('beta', record('t1', '.spec-workflow/specs/beta/tasks.md', 'approved', '2026-01-04T00:00:00.000Z', { respondedAt: '2026-01-04T01:00:00.000Z' }));

      const states = await deriveDocumentApprovalStates(tempDir, 'alpha');
      expect(states.requirements).toEqual({ approved: false, approvalId: 'r2', approvalStatus: 'pending', approvedAt: undefined });
      expect(states.design).toEqual({ approved: true, approvalId: 'd1', approvalStatus: 'approved', approvedAt: '2026-01-03T01:00:00.000Z' });
      expect(states.tasks).toEqual({ approved: false });
    });

    it('reports nothing approved when there are no records', async () => {
      const states = await deriveDocumentApprovalStates(tempDir, 'alpha');
      expect(states.requirements.approved).toBe(false);
      expect(states.design.approved).toBe(false);
      expect(states.tasks.approved).toBe(false);
    });
  });
});
