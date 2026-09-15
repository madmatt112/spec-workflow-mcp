import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// The lint modules are pure and spawn nothing (requirement 1.9). Mock
// `node:child_process` with a spy so a test can prove `execFile` is never
// called on the whole handler path.
const { execFileSpy } = vi.hoisted(() => ({ execFileSpy: vi.fn() }));
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, execFile: execFileSpy, execFileSync: execFileSpy };
});

import { specLintHandler } from '../spec-lint.js';
import { CHECKS_BY_PHASE } from '../../core/lint-types.js';
import { ToolContext } from '../../types.js';

const SPEC = 'my-spec';

describe('specLintHandler', () => {
  let tempDir: string;
  let specDir: string;
  let workflowRoot: string;
  let context: ToolContext;

  beforeEach(async () => {
    execFileSpy.mockReset();
    tempDir = await fs.mkdtemp(join(tmpdir(), 'spec-lint-test-'));
    workflowRoot = join(tempDir, '.spec-workflow');
    specDir = join(workflowRoot, 'specs', SPEC);
    await fs.mkdir(specDir, { recursive: true });
    // One temp dir is both the workspace and the workflow root.
    context = { projectPath: tempDir, workspacePath: tempDir };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const writeDoc = (phase: string, content: string) =>
    fs.writeFile(join(specDir, `${phase}.md`), content);

  it('rejects a phase outside the three-value enum', async () => {
    const res = await specLintHandler({ specName: SPEC, phase: 'bogus' }, context);
    expect(res.success).toBe(false);
    expect(res.message).toContain('requirements');
    expect(res.message).toContain('design');
    expect(res.message).toContain('tasks');
  });

  it('fails naming the path when the document is missing', async () => {
    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(false);
    expect(res.message).toContain(join(specDir, 'requirements.md'));
  });

  it('fails when agent-rules.md cannot be read (a directory in its place)', async () => {
    await writeDoc('requirements', '# Requirements\n\nHello world.\n');
    await fs.mkdir(join(workflowRoot, 'agent-rules.md'));
    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Failed to read agent-rules.md');
  });

  it('returns the gate projectContext shape on success', async () => {
    await writeDoc('requirements', '# Requirements\n\nHello world.\n');
    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(true);
    expect(res.nextSteps).toBeUndefined();
    expect(res.projectContext).toEqual({
      projectPath: tempDir,
      workflowRoot,
      specName: SPEC,
      dashboardUrl: undefined,
    });
  });

  it('lists the checks for the requirements phase', async () => {
    await writeDoc('requirements', '# Requirements\n\nHello world.\n');
    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(true);
    expect(res.data.checks).toEqual(CHECKS_BY_PHASE.requirements);
  });

  it('lists the checks for the design phase', async () => {
    await writeDoc('design', '# Design\n\nHello world.\n');
    const res = await specLintHandler({ specName: SPEC, phase: 'design' }, context);
    expect(res.success).toBe(true);
    expect(res.data.checks).toEqual(CHECKS_BY_PHASE.design);
  });

  it('lists the checks for the tasks phase', async () => {
    await writeDoc(
      'tasks',
      [
        '# Tasks',
        '',
        '- [ ] 1. Do the thing',
        '  - Purpose: something',
        '  _Prompt: Task: do it | Restrictions: none | Success: works_',
        '',
      ].join('\n'),
    );
    const res = await specLintHandler({ specName: SPEC, phase: 'tasks' }, context);
    expect(res.success).toBe(true);
    expect(res.data.checks).toEqual(CHECKS_BY_PHASE.tasks);
  });

  it('sorts findings by line then rule', async () => {
    // Cap requirements at 1 word (doc-words on line 1) and add an invalid
    // `design` cap (caps-invalid on line 1); a bad citation lands on line 5.
    await fs.writeFile(
      join(workflowRoot, 'agent-rules.md'),
      ['# Agent rules', '', '## Word caps', '', '- requirements: 1', '- design: abc', ''].join('\n'),
    );
    await writeDoc(
      'requirements',
      ['# Requirements', '', 'Intro paragraph here.', '', 'See `missing.ts:9` for detail.'].join('\n'),
    );
    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(true);
    expect(res.data.findings.map((f: any) => [f.line, f.rule])).toEqual([
      [1, 'caps-invalid'],
      [1, 'doc-words'],
      [5, 'citation-path'],
    ]);
    // Every finding's file is the phase document, relative to the spec dir.
    for (const f of res.data.findings) expect(f.file).toBe('requirements.md');
  });

  it('renders the requirement 1.8 message', async () => {
    await writeDoc('requirements', '# Requirements\n\nHello world.\n');
    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    const s = res.data.summary;
    expect(res.message).toBe(
      `spec-lint ${SPEC}/requirements.md: ${s.total} findings (${s.error} error, ${s.warning} warning, ${s.info} info)`,
    );
  });

  it('spawns no child process', async () => {
    await writeDoc(
      'tasks',
      ['# Tasks', '', '- [ ] 1. Do the thing', '  _Prompt: Task: do it | Restrictions: none | Success: works_', ''].join('\n'),
    );
    const res = await specLintHandler({ specName: SPEC, phase: 'tasks' }, context);
    expect(res.success).toBe(true);
    expect(execFileSpy).not.toHaveBeenCalled();
  });
});
