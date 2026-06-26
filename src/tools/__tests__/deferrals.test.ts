import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { deferralsHandler } from '../deferrals.js';
import { ToolContext } from '../../types.js';

describe('deferrals tool handler', () => {
  let tempDir: string;
  let context: ToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'deferrals-tool-test-'));
    await fs.mkdir(join(tempDir, '.spec-workflow', 'deferrals'), { recursive: true });
    context = { projectPath: tempDir };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const addArgs = {
    action: 'add',
    title: 'Test deferral',
    context: 'Test context',
    decision: 'Test decision',
    revisitTrigger: 'Later',
  };

  describe('add action', () => {
    it('should create a deferral', async () => {
      const result = await deferralsHandler(addArgs, context);
      expect(result.success).toBe(true);
      expect(result.data.id).toMatch(/^d-[0-9a-f]{8}$/);
    });

    it('should fail with missing required fields', async () => {
      const result = await deferralsHandler({ action: 'add', title: 'Only title' }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required fields');
    });
  });

  describe('list action', () => {
    it('should list deferrals', async () => {
      await deferralsHandler(addArgs, context);
      await deferralsHandler({ ...addArgs, title: 'Second' }, context);

      const result = await deferralsHandler({ action: 'list' }, context);
      expect(result.success).toBe(true);
      expect(result.data.total).toBe(2);
    });

    it('should filter by status', async () => {
      const addResult = await deferralsHandler(addArgs, context);
      await deferralsHandler({
        action: 'resolve',
        id: addResult.data.id,
        resolution: 'Done',
      }, context);

      const result = await deferralsHandler({ action: 'list', status: 'deferred' }, context);
      expect(result.data.total).toBe(0);
    });
  });

  describe('get action', () => {
    it('should get deferral details', async () => {
      const addResult = await deferralsHandler(addArgs, context);
      const result = await deferralsHandler({ action: 'get', id: addResult.data.id }, context);
      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Test deferral');
    });

    it('should fail for missing id', async () => {
      const result = await deferralsHandler({ action: 'get' }, context);
      expect(result.success).toBe(false);
    });

    it('should fail for non-existent id', async () => {
      const result = await deferralsHandler({ action: 'get', id: 'd-nonexist' }, context);
      expect(result.success).toBe(false);
    });
  });

  describe('resolve action', () => {
    it('should resolve a deferral', async () => {
      const addResult = await deferralsHandler(addArgs, context);
      const result = await deferralsHandler({
        action: 'resolve',
        id: addResult.data.id,
        resolution: 'Implemented',
        resolvedInSpec: 'mobile-app',
      }, context);
      expect(result.success).toBe(true);
    });

    it('should fail with missing fields', async () => {
      const result = await deferralsHandler({ action: 'resolve', id: 'd-123' }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required fields');
    });
  });

  describe('update action', () => {
    it('should update a deferral', async () => {
      const addResult = await deferralsHandler(addArgs, context);
      const result = await deferralsHandler({
        action: 'update',
        id: addResult.data.id,
        title: 'Updated title',
        tags: ['new-tag'],
      }, context);
      expect(result.success).toBe(true);
      expect(result.data.updatedFields).toContain('title');
    });

    it('should fail with no fields to update', async () => {
      const addResult = await deferralsHandler(addArgs, context);
      const result = await deferralsHandler({
        action: 'update',
        id: addResult.data.id,
      }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('No fields to update');
    });
  });

  describe('delete action', () => {
    it('should delete a deferral', async () => {
      const addResult = await deferralsHandler(addArgs, context);
      const result = await deferralsHandler({ action: 'delete', id: addResult.data.id }, context);
      expect(result.success).toBe(true);
    });

    it('should fail for missing id', async () => {
      const result = await deferralsHandler({ action: 'delete' }, context);
      expect(result.success).toBe(false);
    });
  });

  describe('supersede flow', () => {
    it('should supersede and block delete of referenced deferral', async () => {
      const addResult = await deferralsHandler(addArgs, context);
      const oldId = addResult.data.id;

      const newResult = await deferralsHandler({
        ...addArgs,
        title: 'Replacement',
        supersedes: oldId,
      }, context);
      expect(newResult.success).toBe(true);

      // Old one should be superseded
      const getOld = await deferralsHandler({ action: 'get', id: oldId }, context);
      expect(getOld.data.status).toBe('superseded');

      // Delete of old should fail (referenced by new)
      const deleteResult = await deferralsHandler({ action: 'delete', id: oldId }, context);
      expect(deleteResult.success).toBe(false);
    });
  });

  describe('duplicate detection on add', () => {
    it('warns when a near-duplicate already exists for the same originSpec', async () => {
      const first = await deferralsHandler({
        ...addArgs,
        title: 'Streaming market data / live feeds',
        originSpec: 'market-feed',
      }, context);

      const second = await deferralsHandler({
        ...addArgs,
        title: 'Streaming market data / live price feeds',
        originSpec: 'market-feed',
      }, context);

      expect(second.success).toBe(true);
      expect(second.message).toContain('WARNING');
      expect(second.message).toContain(first.data.id);
      expect(second.data.duplicates).toHaveLength(1);
      expect(second.data.duplicates[0].id).toBe(first.data.id);
    });

    it('does not warn when explicitly superseding', async () => {
      const first = await deferralsHandler({
        ...addArgs,
        title: 'Streaming market data / live feeds',
        originSpec: 'market-feed',
      }, context);

      const second = await deferralsHandler({
        ...addArgs,
        title: 'Streaming market data / live price feeds',
        originSpec: 'market-feed',
        supersedes: first.data.id,
      }, context);

      expect(second.success).toBe(true);
      expect(second.message).not.toContain('WARNING');
    });
  });

  describe('merge action', () => {
    it('folds a duplicate into a canonical record', async () => {
      const canonical = await deferralsHandler({ ...addArgs, title: 'Canonical decision' }, context);
      const dup = await deferralsHandler({ ...addArgs, title: 'Canonical decisions' }, context);

      const result = await deferralsHandler({
        action: 'merge',
        id: dup.data.id,
        into: canonical.data.id,
      }, context);
      expect(result.success).toBe(true);

      const dupGet = await deferralsHandler({ action: 'get', id: dup.data.id }, context);
      expect(dupGet.data.status).toBe('superseded');
      expect(dupGet.data.supersededBy).toBe(canonical.data.id);
    });

    it('fails with missing fields', async () => {
      const result = await deferralsHandler({ action: 'merge', id: 'd-123' }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required fields');
    });
  });

  describe('reindex action', () => {
    it('normalizes a legacy single-quoted file so get works again', async () => {
      const legacy = [
        "---",
        "id: 'd-legacy01'",
        "status: 'deferred'",
        "title: 'Legacy single-quoted'",
        "tags: ['legacy']",
        "---",
        "",
        "## Context",
        "legacy",
        "",
        "## Decision Deferred",
        "legacy",
        "",
        "## Revisit Criteria",
        "legacy",
        "",
      ].join('\n');
      await fs.writeFile(join(tempDir, '.spec-workflow', 'deferrals', 'd-legacy01.md'), legacy, 'utf-8');

      const reindex = await deferralsHandler({ action: 'reindex' }, context);
      expect(reindex.success).toBe(true);
      expect(reindex.data.total).toBe(1);

      const got = await deferralsHandler({ action: 'get', id: 'd-legacy01' }, context);
      expect(got.success).toBe(true);
      expect(got.data.title).toBe('Legacy single-quoted');
    });
  });

  describe('actionable get error for corrupt files', () => {
    it('points at reindex when a file exists but cannot be parsed', async () => {
      await fs.writeFile(join(tempDir, '.spec-workflow', 'deferrals', 'd-corrupt1.md'), 'garbage', 'utf-8');
      const result = await deferralsHandler({ action: 'get', id: 'd-corrupt1' }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('reindex');
    });
  });

  describe('error handling', () => {
    it('should fail with unknown action', async () => {
      const result = await deferralsHandler({ action: 'unknown' }, context);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown action');
    });

    it('should fail without project path', async () => {
      const result = await deferralsHandler({ action: 'list' }, { projectPath: '' });
      expect(result.success).toBe(false);
    });
  });
});
