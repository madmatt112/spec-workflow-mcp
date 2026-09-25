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

  it('resolves a steering citation against the spec-store root (retro P2)', async () => {
    // `steering/structure.md:N` lives under the `.spec-workflow` root, not the
    // project dir; the spec-store-root base makes the shorthand resolve.
    await fs.mkdir(join(workflowRoot, 'steering'), { recursive: true });
    await fs.writeFile(join(workflowRoot, 'steering', 'structure.md'), '# Structure\n\nLayout.\n');
    await writeDoc('requirements', '# Requirements\n\nSee steering/structure.md:1 for the layout.\n');
    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(true);
    expect(res.data.findings.filter((f: any) => f.rule === 'citation-path')).toHaveLength(0);
  });

  it('renders the requirement 1.8 message', async () => {
    await writeDoc('requirements', '# Requirements\n\nHello world.\n');
    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    const s = res.data.summary;
    expect(res.message).toBe(
      `spec-lint ${SPEC}/requirements.md: ${s.total} findings (${s.error} error, ${s.warning} warning, ${s.info} info)`,
    );
  });

  // retro P10 — suppress a citation-identifier warning whose token already
  // fired on a prior version that was rejected.

  // A doc whose second block cites a real line that lacks `missingId`, so the
  // identifier check warns for `missingId`.
  const IDENT_DOC = [
    '# Requirements',
    '',
    '`PathUtils.getWorkflowRoot` lives at `d/real.ts:1`',
    '',
    '`missingId` is at `d/real.ts:2`',
  ].join('\n');

  // Write an approval snapshot for the spec's requirements doc with a chosen
  // trigger and content, so the handler can read the prior version's state.
  const writeSnapshot = async (phase: string, trigger: string, content: string) => {
    const dir = join(workflowRoot, 'approvals', SPEC, '.snapshots', `${phase}.md`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      join(dir, 'metadata.json'),
      JSON.stringify({
        filePath: `.spec-workflow/specs/${SPEC}/${phase}.md`,
        currentVersion: 1,
        snapshots: [{ version: 1, filename: 'snapshot-001.json', timestamp: '2026-01-01T00:00:00.000Z', trigger }],
      }),
    );
    await fs.writeFile(
      join(dir, 'snapshot-001.json'),
      JSON.stringify({ version: 1, timestamp: '2026-01-01T00:00:00.000Z', trigger, status: 'pending', content }),
    );
  };

  const identFindings = (res: any) => res.data.findings.filter((f: any) => f.rule === 'citation-identifier');

  it('suppresses a citation-identifier warning whose token was rejected in a prior version (P10)', async () => {
    await fs.mkdir(join(tempDir, 'd'), { recursive: true });
    await fs.writeFile(join(tempDir, 'd', 'real.ts'), 'function getWorkflowRoot() {}\nother stuff here\n');
    await writeDoc('requirements', IDENT_DOC);
    // The prior version was rejected (revision requested) and flagged the same token.
    await writeSnapshot('requirements', 'revision_requested', IDENT_DOC);

    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(true);
    expect(identFindings(res)).toHaveLength(0);
  });

  it('still warns when the prior version was approved, not rejected (P10)', async () => {
    await fs.mkdir(join(tempDir, 'd'), { recursive: true });
    await fs.writeFile(join(tempDir, 'd', 'real.ts'), 'function getWorkflowRoot() {}\nother stuff here\n');
    await writeDoc('requirements', IDENT_DOC);
    // An approved snapshot is not a rejection, so the token is not suppressed.
    await writeSnapshot('requirements', 'approved', IDENT_DOC);

    const res = await specLintHandler({ specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(true);
    const ident = identFindings(res);
    expect(ident).toHaveLength(1);
    expect(ident[0].message).toContain('missingId');
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
