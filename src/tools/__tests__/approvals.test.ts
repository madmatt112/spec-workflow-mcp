import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { approvalsHandler } from '../approvals.js';
import { ApprovalStorage } from '../../dashboard/approval-storage.js';
import { ToolContext } from '../../types.js';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('approvals tool — approve, reject, list, prune', () => {
  let tempDir: string;
  let context: ToolContext;
  const docPath = '.spec-workflow/specs/alpha/requirements.md';
  const designPath = '.spec-workflow/specs/alpha/design.md';

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'approvals-tool-test-'));
    const specDir = join(tempDir, '.spec-workflow', 'specs', 'alpha');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Requirements\n\nv1\n', 'utf-8');
    await fs.writeFile(join(specDir, 'design.md'), '# Design\n\nv1\n', 'utf-8');
    context = { projectPath: tempDir, workspacePath: tempDir };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function request(title: string, filePath: string = docPath): Promise<string> {
    // Records are ordered by createdAt (ms resolution); keep them distinct.
    await sleep(5);
    const result = await approvalsHandler(
      { action: 'request', title, filePath, type: 'document', category: 'spec', categoryName: 'alpha' },
      context
    );
    expect(result.success).toBe(true);
    return result.data.approvalId as string;
  }

  function recordPath(id: string): string {
    return join(tempDir, '.spec-workflow', 'approvals', 'alpha', `${id}.json`);
  }

  async function readRecord(id: string): Promise<any> {
    return JSON.parse(await fs.readFile(recordPath(id), 'utf-8'));
  }

  async function exists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  function snapshotsDir(basename: string = 'requirements.md'): string {
    return join(tempDir, '.spec-workflow', 'approvals', 'alpha', '.snapshots', basename);
  }

  async function snapshotMetadata(): Promise<any> {
    return JSON.parse(await fs.readFile(join(snapshotsDir(), 'metadata.json'), 'utf-8'));
  }

  describe('approve', () => {
    it('moves a pending record to approved and captures a snapshot', async () => {
      const id = await request('alpha requirements v1');

      const result = await approvalsHandler({ action: 'approve', approvalId: id }, context);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('approved');
      expect(result.data.response).toBe('Approved by the autonomous harness');

      const record = await readRecord(id);
      expect(record.status).toBe('approved');
      expect(record.respondedAt).toBeTruthy();

      const metadata = await snapshotMetadata();
      const approvedSnapshot = metadata.snapshots.find((s: any) => s.trigger === 'approved');
      expect(approvedSnapshot).toBeTruthy();
      expect(approvedSnapshot.approvalId).toBe(id);
    });

    it('records the given response', async () => {
      const id = await request('alpha requirements v1');
      const result = await approvalsHandler(
        { action: 'approve', approvalId: id, response: 'v3, 2 rounds, converged 0/0/1' },
        context
      );
      expect(result.success).toBe(true);
      expect((await readRecord(id)).response).toBe('v3, 2 rounds, converged 0/0/1');
    });

    it('is idempotent on an already approved record', async () => {
      const id = await request('alpha requirements v1');
      await approvalsHandler({ action: 'approve', approvalId: id, response: 'first' }, context);
      const before = await readRecord(id);

      const again = await approvalsHandler({ action: 'approve', approvalId: id, response: 'second' }, context);
      expect(again.success).toBe(true);
      expect(again.data.unchanged).toBe(true);
      expect(await readRecord(id)).toEqual(before);
    });

    it('accepts a needs-revision record', async () => {
      const id = await request('alpha requirements v1');
      const storage = new ApprovalStorage(tempDir);
      await storage.updateApproval(id, 'needs-revision', 'please fix');
      await storage.stop();

      const result = await approvalsHandler({ action: 'approve', approvalId: id }, context);
      expect(result.success).toBe(true);
      expect((await readRecord(id)).status).toBe('approved');
    });

    it('refuses a rejected record', async () => {
      const id = await request('alpha requirements v1');
      await approvalsHandler({ action: 'reject', approvalId: id, response: 'no' }, context);

      const result = await approvalsHandler({ action: 'approve', approvalId: id }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('"rejected"');
      expect((await readRecord(id)).status).toBe('rejected');
    });

    it('fails for an unknown id', async () => {
      const result = await approvalsHandler({ action: 'approve', approvalId: 'approval_0_missing' }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('requires approvalId', async () => {
      const result = await approvalsHandler({ action: 'approve' }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('approvalId');
    });
  });

  describe('reject', () => {
    it('requires a response', async () => {
      const id = await request('alpha requirements v1');
      const result = await approvalsHandler({ action: 'reject', approvalId: id }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('response');
      expect((await readRecord(id)).status).toBe('pending');
    });

    it('moves a pending record to rejected with the reason', async () => {
      const id = await request('alpha requirements v1');
      const result = await approvalsHandler(
        { action: 'reject', approvalId: id, response: 'superseded by v2' },
        context
      );
      expect(result.success).toBe(true);
      const record = await readRecord(id);
      expect(record.status).toBe('rejected');
      expect(record.response).toBe('superseded by v2');
      expect(record.respondedAt).toBeTruthy();
    });

    it('is idempotent on an already rejected record', async () => {
      const id = await request('alpha requirements v1');
      await approvalsHandler({ action: 'reject', approvalId: id, response: 'first' }, context);
      const again = await approvalsHandler({ action: 'reject', approvalId: id, response: 'second' }, context);
      expect(again.success).toBe(true);
      expect(again.data.unchanged).toBe(true);
      expect((await readRecord(id)).response).toBe('first');
    });

    it('refuses an approved record', async () => {
      const id = await request('alpha requirements v1');
      await approvalsHandler({ action: 'approve', approvalId: id }, context);
      const result = await approvalsHandler({ action: 'reject', approvalId: id, response: 'no' }, context);
      expect(result.success).toBe(false);
      expect((await readRecord(id)).status).toBe('approved');
    });
  });

  describe('list', () => {
    it('returns records newest first with the summary fields', async () => {
      const v1 = await request('alpha requirements v1');
      const v2 = await request('alpha requirements v2');
      const v3 = await request('alpha requirements v3');
      await approvalsHandler({ action: 'approve', approvalId: v3, response: 'done' }, context);

      const result = await approvalsHandler({ action: 'list' }, context);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(3);
      expect(result.data.approvals.map((a: any) => a.id)).toEqual([v3, v2, v1]);
      expect(Object.keys(result.data.approvals[0]).sort()).toEqual(
        ['createdAt', 'filePath', 'id', 'respondedAt', 'response', 'status', 'title']
      );
      expect(result.data.approvals[0].status).toBe('approved');
      expect(result.data.approvals[0].response).toBe('done');
    });

    it('filters by status, categoryName and normalised filePath', async () => {
      await request('alpha requirements v1');
      const v2 = await request('alpha requirements v2');
      await request('alpha design v1', designPath);
      await approvalsHandler({ action: 'approve', approvalId: v2 }, context);

      const approved = await approvalsHandler({ action: 'list', status: 'approved' }, context);
      expect(approved.data.approvals.map((a: any) => a.id)).toEqual([v2]);

      const byFile = await approvalsHandler({ action: 'list', filePath: `./${docPath}` }, context);
      expect(byFile.data.count).toBe(2);

      const byCategory = await approvalsHandler({ action: 'list', categoryName: 'alpha' }, context);
      expect(byCategory.data.count).toBe(3);

      const other = await approvalsHandler({ action: 'list', categoryName: 'beta' }, context);
      expect(other.data.count).toBe(0);
    });

    it('rejects an unknown status filter', async () => {
      const result = await approvalsHandler({ action: 'list', status: 'bogus' as any }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid status');
    });

    it('returns an empty list when there are no records', async () => {
      const result = await approvalsHandler({ action: 'list' }, context);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(0);
    });
  });

  describe('prune', () => {
    it('requires categoryName, filePath and keepApprovalId', async () => {
      const result = await approvalsHandler({ action: 'prune', categoryName: 'alpha' }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('keepApprovalId');
    });

    it('fails when the keeper does not exist', async () => {
      const result = await approvalsHandler(
        { action: 'prune', categoryName: 'alpha', filePath: docPath, keepApprovalId: 'approval_0_missing' },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('fails when the keeper is not approved', async () => {
      const v1 = await request('alpha requirements v1');
      const result = await approvalsHandler(
        { action: 'prune', categoryName: 'alpha', filePath: docPath, keepApprovalId: v1 },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('not "approved"');
      expect(await exists(recordPath(v1))).toBe(true);
    });

    it('fails when the keeper belongs to another document', async () => {
      const req = await request('alpha requirements v1');
      const design = await request('alpha design v1', designPath);
      await approvalsHandler({ action: 'approve', approvalId: design }, context);

      const result = await approvalsHandler(
        { action: 'prune', categoryName: 'alpha', filePath: docPath, keepApprovalId: design },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('belongs to');
      expect(await exists(recordPath(req))).toBe(true);
    });

    it('rejects pending and needs-revision records, deletes every other record, and rewrites the snapshots', async () => {
      const v1 = await request('alpha requirements v1');
      const v2 = await request('alpha requirements v2');
      const v3 = await request('alpha requirements v3');
      const v4 = await request('alpha requirements v4');
      const design = await request('alpha design v1', designPath);

      // v2 needs-revision (captures a revision snapshot), v3 rejected, v4 approved (captures an approved snapshot)
      const storage = new ApprovalStorage(tempDir);
      await storage.updateApproval(v2, 'needs-revision', 'fix it');
      await storage.stop();
      await approvalsHandler({ action: 'reject', approvalId: v3, response: 'superseded' }, context);
      await approvalsHandler({ action: 'approve', approvalId: v4, response: 'final' }, context);

      const before = await snapshotMetadata();
      expect(before.snapshots.map((s: any) => s.trigger)).toEqual(['initial', 'revision_requested', 'approved']);
      expect(before.currentVersion).toBe(3);

      const result = await approvalsHandler(
        { action: 'prune', categoryName: 'alpha', filePath: docPath, keepApprovalId: v4 },
        context
      );
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        keepApprovalId: v4,
        recordsRejected: 2,
        recordsDeleted: 3,
        recordsFailed: [],
        snapshotsDeleted: 2,
        snapshotsKept: 1
      });

      expect(await exists(recordPath(v1))).toBe(false);
      expect(await exists(recordPath(v2))).toBe(false);
      expect(await exists(recordPath(v3))).toBe(false);
      expect(await exists(recordPath(v4))).toBe(true);
      expect((await readRecord(v4)).status).toBe('approved');
      // The other document is untouched
      expect(await exists(recordPath(design))).toBe(true);

      const after = await snapshotMetadata();
      expect(after.snapshots).toHaveLength(1);
      expect(after.snapshots[0].approvalId).toBe(v4);
      expect(after.snapshots[0].trigger).toBe('approved');
      expect(after.currentVersion).toBe(3);

      const files = (await fs.readdir(snapshotsDir())).sort();
      expect(files).toEqual(['metadata.json', after.snapshots[0].filename]);

      // The design document's snapshots survive
      expect(await exists(join(snapshotsDir('design.md'), 'metadata.json'))).toBe(true);
    });

    it('is a no-op when the keeper is the only record', async () => {
      const v1 = await request('alpha requirements v1');
      await approvalsHandler({ action: 'approve', approvalId: v1 }, context);

      const result = await approvalsHandler(
        { action: 'prune', categoryName: 'alpha', filePath: docPath, keepApprovalId: v1 },
        context
      );
      expect(result.success).toBe(true);
      expect(result.data.recordsDeleted).toBe(0);
      // Only the initial snapshot (captured for v1) plus the approved one, both the keeper's
      expect(result.data.snapshotsDeleted).toBe(0);
      expect(result.data.snapshotsKept).toBe(2);
    });

    it('rejects a categoryName that is not a plain directory name', async () => {
      const result = await approvalsHandler(
        { action: 'prune', categoryName: '../alpha', filePath: docPath, keepApprovalId: 'x' },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('categoryName');
    });
  });

  describe('existing actions', () => {
    it('delete still refuses a pending record', async () => {
      const id = await request('alpha requirements v1');
      const result = await approvalsHandler({ action: 'delete', approvalId: id }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('BLOCKED');
      expect(await exists(recordPath(id))).toBe(true);
    });

    it('delete removes an approved record but keeps its snapshots', async () => {
      const id = await request('alpha requirements v1');
      await approvalsHandler({ action: 'approve', approvalId: id }, context);
      const result = await approvalsHandler({ action: 'delete', approvalId: id }, context);
      expect(result.success).toBe(true);
      expect(await exists(recordPath(id))).toBe(false);
      expect((await snapshotMetadata()).snapshots).toHaveLength(2);
    });

    it('rejects an unknown action', async () => {
      const result = await approvalsHandler({ action: 'frobnicate' as any }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown action');
    });
  });
});
