import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { specStatusHandler } from '../spec-status.js';
import { ToolContext } from '../../types.js';

describe('specStatusHandler — approval state', () => {
  let tempDir: string;
  let context: ToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'spec-status-tool-test-'));
    const specDir = join(tempDir, '.spec-workflow', 'specs', 'alpha');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# R\n', 'utf-8');
    await fs.writeFile(join(specDir, 'design.md'), '# D\n', 'utf-8');
    context = { projectPath: tempDir, workspacePath: tempDir };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function writeRecord(id: string, doc: string, status: string, createdAt: string, respondedAt?: string): Promise<void> {
    const dir = join(tempDir, '.spec-workflow', 'approvals', 'alpha');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, `${id}.json`), JSON.stringify({
      id,
      title: id,
      filePath: `.spec-workflow/specs/alpha/${doc}`,
      type: 'document',
      status,
      createdAt,
      respondedAt,
      category: 'spec',
      categoryName: 'alpha',
    }), 'utf-8');
  }

  it('reports created, not approved, when no records exist', async () => {
    const result = await specStatusHandler({ specName: 'alpha' }, context);
    expect(result.success).toBe(true);
    expect(result.data.currentPhase).toBe('tasks');
    const [requirements, design, tasks] = result.data.phases;
    expect(requirements).toMatchObject({ name: 'Requirements', status: 'created', approved: false });
    expect(requirements.approvalId).toBeUndefined();
    expect(design).toMatchObject({ name: 'Design', status: 'created', approved: false });
    expect(tasks).toMatchObject({ name: 'Tasks', status: 'missing', approved: false });
  });

  it('derives approval from the newest record per document', async () => {
    await writeRecord('r1', 'requirements.md', 'approved', '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z');
    await writeRecord('d1', 'design.md', 'approved', '2026-01-02T00:00:00.000Z', '2026-01-02T01:00:00.000Z');
    await writeRecord('d2', 'design.md', 'needs-revision', '2026-01-03T00:00:00.000Z', '2026-01-03T01:00:00.000Z');

    const result = await specStatusHandler({ specName: 'alpha' }, context);
    expect(result.success).toBe(true);
    // Phase derivation is unchanged by approvals: design exists, tasks does not
    expect(result.data.currentPhase).toBe('tasks');
    expect(result.data.overallStatus).toBe('tasks-needed');

    const [requirements, design] = result.data.phases;
    expect(requirements).toMatchObject({
      status: 'approved',
      approved: true,
      approvalId: 'r1',
      approvalStatus: 'approved',
      approvedAt: '2026-01-01T01:00:00.000Z'
    });
    expect(design).toMatchObject({
      status: 'created',
      approved: false,
      approvalId: 'd2',
      approvalStatus: 'needs-revision'
    });
    expect(design.approvedAt).toBeUndefined();
  });

  it('reports Implementation as completed when every task is done', async () => {
    const specDir = join(tempDir, '.spec-workflow', 'specs', 'alpha');
    await fs.writeFile(join(specDir, 'tasks.md'), '# Tasks\n\n- [x] 1. Task one\n- [x] 2. Task two\n', 'utf-8');

    const result = await specStatusHandler({ specName: 'alpha' }, context);
    expect(result.success).toBe(true);
    expect(result.data.currentPhase).toBe('completed');
    const implementation = result.data.phases[3];
    expect(implementation).toMatchObject({ name: 'Implementation', status: 'completed' });
  });
});
