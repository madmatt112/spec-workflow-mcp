import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { specIndexHandler } from '../spec-index.js';
import { ToolContext } from '../../types.js';

describe('specIndexHandler', () => {
  let tempDir: string;
  let context: ToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'spec-index-tool-test-'));
    await fs.mkdir(join(tempDir, '.spec-workflow', 'specs', 'alpha'), { recursive: true });
    await fs.writeFile(join(tempDir, '.spec-workflow', 'specs', 'alpha', 'requirements.md'), '# R\n');
    context = { projectPath: tempDir };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function indexExists(): Promise<boolean> {
    try {
      await fs.access(join(tempDir, '.spec-workflow', 'spec-decomposition', 'INDEX.md'));
      return true;
    } catch {
      return false;
    }
  }

  it('generates INDEX.md', async () => {
    const result = await specIndexHandler({ action: 'generate' }, context);
    expect(result.success).toBe(true);
    expect(result.data?.active).toBe(1);
    expect(await indexExists()).toBe(true);
  });

  it('defers a spec and regenerates', async () => {
    const result = await specIndexHandler(
      { action: 'defer', specName: 'alpha', reason: 'later' },
      context
    );
    expect(result.success).toBe(true);
    expect(result.data?.deferred).toBe(1);
    expect(result.data?.active).toBe(0);
  });

  it('undefers a spec and regenerates', async () => {
    await specIndexHandler({ action: 'defer', specName: 'alpha', reason: 'later' }, context);
    const result = await specIndexHandler({ action: 'undefer', specName: 'alpha' }, context);
    expect(result.success).toBe(true);
    expect(result.data?.deferred).toBe(0);
    expect(result.data?.active).toBe(1);
  });

  it('rejects defer without a reason', async () => {
    const result = await specIndexHandler({ action: 'defer', specName: 'alpha' }, context);
    expect(result.success).toBe(false);
    expect(result.message).toContain('reason');
  });

  it('rejects defer for a missing spec', async () => {
    const result = await specIndexHandler(
      { action: 'defer', specName: 'ghost', reason: 'x' },
      context
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });

  it('rejects an unknown action', async () => {
    const result = await specIndexHandler({ action: 'frobnicate' }, context);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unknown action');
  });

  it('fails when no project path is available', async () => {
    const result = await specIndexHandler({ action: 'generate' }, {} as ToolContext);
    expect(result.success).toBe(false);
    expect(result.message).toContain('Project path is required');
  });
});
