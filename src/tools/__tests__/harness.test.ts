import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { harnessHandler, codeGraphSection } from '../harness.js';
import { taskBlock } from '../../core/task-parser.js';
import { ToolContext } from '../../types.js';

const SPEC = 'my-spec';

describe('harnessHandler', () => {
  let tempDir: string;
  let specDir: string;
  let context: ToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'harness-test-'));
    specDir = join(tempDir, '.spec-workflow', 'specs', SPEC);
    await fs.mkdir(join(specDir, 'reviews'), { recursive: true });
    context = { projectPath: tempDir, workspacePath: tempDir };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const writeDoc = (name: string, content: string) => fs.writeFile(join(specDir, name), content);
  const writeReview = (name: string, content: string) => fs.writeFile(join(specDir, 'reviews', name), content);

  it('requires specName', async () => {
    const res = await harnessHandler({ action: 'orient', phase: 'requirements' }, context);
    expect(res.success).toBe(false);
    expect(res.message).toContain('specName');
  });

  it('brief now requires a template', async () => {
    const brief = await harnessHandler({ action: 'brief', specName: SPEC }, context);
    expect(brief.success).toBe(false);
    expect(brief.message).toContain('template');
  });

  it('fails naming the spec dir when it is missing', async () => {
    const res = await harnessHandler({ action: 'orient', specName: 'ghost', phase: 'requirements' }, context);
    expect(res.success).toBe(false);
    expect(res.message).toContain('ghost');
  });

  // The six fixture states of Requirement 1.7: each returned nextStep equals the
  // step the corresponding skill's Step 0 chooses.

  it('(1) no document → Step 1', async () => {
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(true);
    expect(res.data.D).toBe(0);
    expect(res.data.nextStep).toBe('Step 1');
  });

  it('(2) mid-review (A < D) → Step 2', async () => {
    await writeDoc('requirements.md', [
      '# Requirements', '', '## Revision History',
      '- **v1** (2026-09-15) — Initial draft.',
      '- **v2** (2026-09-15) — Round-1 response.', '',
    ].join('\n'));
    await writeReview('adversarial-analysis-requirements.md', [
      'analysis body', '', 'VERDICT: iterate', 'MUST_FIX: 1', 'SHOULD_FIX: 2', 'MINOR: 0', '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'requirements' }, context);
    expect(res.success).toBe(true);
    expect(res.data.D).toBe(2);
    expect(res.data.A).toBe(1);
    expect(res.data.nextStep).toBe('Step 2');
  });

  it('(3) post-cap without a narrow check → Step 4b', async () => {
    await writeDoc('design.md', [
      '# Design', '', '## Revision History',
      '- **v1** (2026-09-15) — Initial draft.',
      '- **v2** (2026-09-15) — Round-1 response.',
      '- **v3** (2026-09-15) — Post-cap corrective pass (verdict iterate).', '',
    ].join('\n'));
    await writeReview('adversarial-analysis-design-r3.md', [
      'analysis body', '', 'VERDICT: iterate', 'MUST_FIX: 0', 'SHOULD_FIX: 1', 'MINOR: 0', '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'design' }, context);
    expect(res.success).toBe(true);
    expect(res.data.P).toBe(true);
    expect(res.data.narrowCheck).toBe(false);
    expect(res.data.nextStep).toBe('Step 4b');
  });

  it('(4) mode: revision → Step R', async () => {
    await writeDoc('requirements.md', ['# Requirements', '', '## Revision History', '- **v1** — Initial.', ''].join('\n'));
    const res = await harnessHandler(
      { action: 'orient', specName: SPEC, phase: 'requirements', mode: 'revision' }, context,
    );
    expect(res.success).toBe(true);
    expect(res.data.nextStep).toBe('Step R');
  });

  it('(5) implementation with a [-] task → resume that task', async () => {
    await writeDoc('tasks.md', [
      '# Tasks', '',
      '- [-] 1. First task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_',
      '- [ ] 2. Second task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_', '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'implementation' }, context);
    expect(res.success).toBe(true);
    expect(res.data.tasks).toEqual({ total: 2, done: 0, inProgress: 1, open: 1 });
    expect(res.data.nextStep).toBe('Per-task loop: resume task 1');
  });

  it('(6) close-out with open items → Step 2, open by class', async () => {
    await writeDoc('retrospective-plan.md', [
      '# Retrospective plan', '', 'Status: APPROVED', '',
      '## Approved proposals',
      '- **P1** — Nothing to land',
      '  - Target: none (ratified)',
      '  - Decision: no change',
      '- **P2** — A harness change',
      '  - Target: harness skills and hooks',
      '- **G1** — A code change',
      '  - Target: product code under src/foo.ts', '',
      '## Close-out',
      '- P1: done, nothing to land', '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'closeout' }, context);
    expect(res.success).toBe(true);
    expect(res.data.items).toEqual({ total: 3, done: 1, open: 2 });
    expect(res.data.byClass).toEqual({ none: 0, store: 0, harness: 1, code: 1, home: 0 });
    expect(res.data.nextStep).toBe('Step 2');
  });

  // Requirement 2 — the `brief` action.

  // A tasks fixture whose task-3 block runs to the next checkbox and so includes
  // an intervening `##` heading (requirements Scope notes / design D5).
  const TASKS = [
    '# Tasks',
    'Document version: v1',
    '',
    '- [ ] 1. First task',
    '  _Prompt: Task: a | Restrictions: none | Success: ok_',
    '',
    '- [ ] 2. Second task',
    '  _Prompt: Task: b | Restrictions: none | Success: ok_',
    '',
    '- [ ] 3. Third task',
    '  - File: src/foo.ts',
    '  _Prompt: Task: c | Restrictions: none | Success: ok_',
    '',
    '## A heading inside the task 3 block',
    '',
    '- [ ] 4. Fourth task',
    '  _Prompt: Task: d | Restrictions: none | Success: ok_',
    '',
  ].join('\n');

  const writeAgentRules = () =>
    fs.writeFile(join(tempDir, '.spec-workflow', 'agent-rules.md'), '# rules\n');

  it('brief writes the implementer task block byte for byte, with the read-and-obey first line', async () => {
    await writeDoc('tasks.md', TASKS);
    await writeAgentRules();
    const outPath = join(tempDir, 'impl-brief-task-3.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'implementer', taskId: '3', values: { path: outPath, title: 'Task 3' } },
      context,
    );
    expect(res.success).toBe(true);
    expect(res.data.path).toBe(outPath);

    const written = await fs.readFile(outPath, 'utf-8');
    const expected = taskBlock(TASKS, '3')!;
    // The parser block includes the intervening `##` heading.
    expect(expected).toContain('## A heading inside the task 3 block');
    // The brief carries that block byte for byte.
    expect(written).toContain(expected);
    // The first instruction line reads and obeys the spec-store agent-rules.md.
    expect(written).toMatch(/Read and obey .*[/\\]agent-rules\.md first\./);
  });

  it('brief reports every missing required value in one message and writes no file', async () => {
    await writeAgentRules();
    const outPath = join(tempDir, 'verifier-brief.md');

    // The verifier template requires both `title` and `job`; omit both.
    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'verifier', values: { path: outPath } },
      context,
    );
    expect(res.success).toBe(false);
    // Both missing keys are named together in the one message.
    expect(res.message).toContain('title');
    expect(res.message).toContain('job');
    await expect(fs.access(outPath)).rejects.toThrow();
  });

  it('brief drops the read-and-obey line when agent-rules.md is absent', async () => {
    const outPath = join(tempDir, 'drafter-brief.md');
    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'drafter', values: { path: outPath, title: 'Draft', job: 'write it' } },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');
    expect(written).not.toContain('Read and obey');
    expect(written).toContain('write it');
  });

  it('brief resolves a relative output path under the spec-store root, not the code workspace', async () => {
    await writeAgentRules();
    const specStoreRoot = join(tempDir, '.spec-workflow');
    const relPath = join('reviews', 'drafter-brief-requirements.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'drafter', values: { path: relPath, title: 'Draft', job: 'write it' } },
      context,
    );
    expect(res.success).toBe(true);
    // The output root is the spec-store root, not the process cwd (code workspace).
    expect(res.data.path).toBe(join(specStoreRoot, relPath));
    expect(res.data.path.startsWith(tempDir)).toBe(true);
    const written = await fs.readFile(join(specStoreRoot, relPath), 'utf-8');
    expect(written).toContain('write it');
  });

  it('brief fails naming an unknown template and writes no file', async () => {
    const outPath = join(tempDir, 'nope.md');
    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'nope', values: { path: outPath } },
      context,
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('nope');
    await expect(fs.access(outPath)).rejects.toThrow();
  });

  // Requirement 3 — the `## Code graph` brief section by tooling.

  const GRAPH = '/code/graphify-out/graph.json';

  // The non-graph required values for each of the five templates.
  const GRAPH_BASE_VALUES: Record<string, Record<string, unknown>> = {
    drafter: { title: 'T', job: 'do it' },
    reviser: { title: 'T', job: 'do it', findings: 'the findings' },
    adjudicator: { title: 'T', items: 'the items' },
    verifier: { title: 'T', job: 'do it' },
    implementer: { title: 'T' },
  };

  for (const template of Object.keys(GRAPH_BASE_VALUES)) {
    it(`brief appends the ## Code graph section to a ${template} brief`, async () => {
      await writeAgentRules();
      if (template === 'implementer') await writeDoc('tasks.md', TASKS);
      const outPath = join(tempDir, `${template}-graph-brief.md`);
      const args: Record<string, unknown> = {
        action: 'brief', specName: SPEC, template,
        values: { ...GRAPH_BASE_VALUES[template], path: outPath, graph: GRAPH, graphBuiltAt: 'abc1234', graphBehind: '3' },
      };
      if (template === 'implementer') args.taskId = '3';

      const res = await harnessHandler(args, context);
      expect(res.success).toBe(true);

      const written = await fs.readFile(outPath, 'utf-8');
      const section = codeGraphSection(GRAPH, 'abc1234', '3');
      // One blank line, then the section verbatim, hint line included (behind !== '0').
      expect(written.endsWith('\n\n' + section)).toBe(true);
      expect(section).toContain('A `file:line` from the graph is a hint to confirm');
    });
  }

  it('brief drops the hint line when graphBehind is 0', async () => {
    await writeAgentRules();
    const outPath = join(tempDir, 'drafter-graph0.md');
    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'drafter',
        values: { title: 'T', job: 'do it', path: outPath, graph: GRAPH, graphBuiltAt: 'abc1234', graphBehind: '0' } },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');
    expect(written).toContain('## Code graph');
    expect(written).toContain('Freshness: built at abc1234, 0 commits behind HEAD.');
    expect(written).not.toContain('A `file:line` from the graph');
  });

  it('brief with no graph values and graph none give byte-identical files without a section', async () => {
    await writeAgentRules();
    const noGraphPath = join(tempDir, 'drafter-nograph.md');
    const nonePath = join(tempDir, 'drafter-none.md');
    const base = { title: 'T', job: 'do it' };

    const r1 = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'drafter', values: { ...base, path: noGraphPath } },
      context,
    );
    const r2 = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'drafter', values: { ...base, path: nonePath, graph: 'none' } },
      context,
    );
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);

    const a = await fs.readFile(noGraphPath, 'utf-8');
    const b = await fs.readFile(nonePath, 'utf-8');
    expect(a).toBe(b);
    expect(a).not.toContain('## Code graph');
  });

  it('brief with a graph path but no graphBehind fails naming it and writes no file', async () => {
    await writeAgentRules();
    const outPath = join(tempDir, 'drafter-missing-behind.md');
    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'drafter',
        values: { title: 'T', job: 'do it', path: outPath, graph: GRAPH, graphBuiltAt: 'abc1234' } },
      context,
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('graphBehind');
    expect(res.message).not.toContain('graphBuiltAt');
    await expect(fs.access(outPath)).rejects.toThrow();
  });

  it('the briefs.md Code graph block mirrors codeGraphSection (drift guard)', async () => {
    const briefsPath = fileURLToPath(
      new URL('../../../harness/skills/sdd-document-phase/references/briefs.md', import.meta.url),
    );
    const lines = (await fs.readFile(briefsPath, 'utf-8')).split('\n');
    const heading = lines.indexOf('## Code graph block');
    expect(heading).toBeGreaterThan(-1);
    const open = lines.indexOf('```', heading);
    const close = lines.indexOf('```', open + 1);
    expect(open).toBeGreaterThan(heading);
    expect(close).toBeGreaterThan(open);
    const block = lines.slice(open + 1, close).join('\n') + '\n';
    expect(block).toBe(codeGraphSection('<GRAPH>', '<GRAPH_BUILT_AT>', '<GRAPH_BEHIND>'));
  });

  // Requirement 5 — the `phase-log` action.

  const handoffPathFile = () => join(tempDir, '.spec-workflow', 'HANDOFF.md');
  const writeHandoff = (content: string) => fs.writeFile(handoffPathFile(), content);
  const readHandoff = () => fs.readFile(handoffPathFile(), 'utf-8');
  const writeLedger = (events: Record<string, unknown>[]) =>
    fs.writeFile(join(specDir, 'harness-events.jsonl'), events.map(e => JSON.stringify(e)).join('\n') + '\n');

  const HANDOFF_HEADER = [
    '> **READ FIRST — SDD routing (2026-09-15, harness v4).** Active spec **`my-spec`**.',
    '',
    '## Phase log',
    '',
    '| Date | Spec | Stage | State | Result | Note |',
    '| --- | --- | --- | --- | --- | --- |',
    '| 2026-09-10 | other-spec | design | v2 | approved | keep me verbatim |',
    '',
    '## my-spec — implementation',
    '',
    'State: tasks 1/3 done.',
    '',
  ].join('\n');

  it('phase-log preserves another spec row and adds a phase.end row', async () => {
    await writeHandoff(HANDOFF_HEADER);
    await writeLedger([
      { ts: '2026-09-15T10:00:00Z', type: 'run.start', run: 'run-1', spec: SPEC },
      { ts: '2026-09-15T10:01:00Z', type: 'phase.start', run: 'run-1', spec: SPEC, phase: 'requirements', state: 'v0' },
      { ts: '2026-09-15T10:30:00Z', type: 'phase.end', run: 'run-1', spec: SPEC, phase: 'requirements', state: 'v2', result: 'approved', note: 'converged' },
      { ts: '2026-09-15T10:31:00Z', type: 'run.end', run: 'run-1', spec: SPEC, status: 'approved' },
    ]);

    const res = await harnessHandler({ action: 'phase-log', specName: SPEC }, context);
    expect(res.success).toBe(true);

    const out = await readHandoff();
    // The other spec's row survives byte for byte.
    expect(out).toContain('| 2026-09-10 | other-spec | design | v2 | approved | keep me verbatim |');
    // A row for this spec's phase.end is added.
    expect(out).toContain('| 2026-09-15 | my-spec | requirements | v2 | approved | converged |');
    // The routing header and the orchestrator section are untouched.
    expect(out).toContain('Active spec **`my-spec`**');
    expect(out).toContain('## my-spec — implementation');
    expect(out).toContain('State: tasks 1/3 done.');
  });

  it('phase-log emits an interrupted row for an unclosed not-live phase', async () => {
    await writeHandoff(HANDOFF_HEADER);
    await writeLedger([
      { ts: '2026-09-15T09:00:00Z', type: 'run.start', run: 'run-1', spec: SPEC },
      { ts: '2026-09-15T09:01:00Z', type: 'phase.start', run: 'run-1', spec: SPEC, phase: 'design', state: 'v3' },
      { ts: '2026-09-15T09:05:00Z', type: 'run.end', run: 'run-1', spec: SPEC, status: 'escalated' },
    ]);

    const res = await harnessHandler({ action: 'phase-log', specName: SPEC }, context);
    expect(res.success).toBe(true);

    const out = await readHandoff();
    expect(out).toContain('| 2026-09-15 | my-spec | design | v3 | interrupted |');
    // The other spec's row is still preserved alongside it.
    expect(out).toContain('| 2026-09-10 | other-spec | design | v2 | approved | keep me verbatim |');
  });

  it('phase-log never stamps the live phase interrupted', async () => {
    await writeHandoff(HANDOFF_HEADER);
    await writeLedger([
      { ts: '2026-09-15T11:00:00Z', type: 'run.start', run: 'run-2', spec: SPEC },
      { ts: '2026-09-15T11:01:00Z', type: 'phase.start', run: 'run-2', spec: SPEC, phase: 'tasks', state: 'v1' },
    ]);

    const res = await harnessHandler({ action: 'phase-log', specName: SPEC }, context);
    expect(res.success).toBe(true);
    expect(res.data.added).toBe(0);

    const out = await readHandoff();
    expect(out).not.toContain('interrupted');
  });

  it('phase-log keeps a pre-ledger hand-written row with no matching phase.end', async () => {
    const handoff = HANDOFF_HEADER.replace(
      '| 2026-09-10 | other-spec | design | v2 | approved | keep me verbatim |',
      [
        '| 2026-09-10 | other-spec | design | v2 | approved | keep me verbatim |',
        '| 2026-09-08 | my-spec | requirements | v1 | approved | pre-ledger row |',
      ].join('\n'),
    );
    await writeHandoff(handoff);
    await writeLedger([
      { ts: '2026-09-15T10:00:00Z', type: 'run.start', run: 'run-1', spec: SPEC },
      { ts: '2026-09-15T10:01:00Z', type: 'phase.end', run: 'run-1', spec: SPEC, phase: 'design', state: 'v2', result: 'approved', note: 'ok' },
    ]);

    const res = await harnessHandler({ action: 'phase-log', specName: SPEC }, context);
    expect(res.success).toBe(true);

    const out = await readHandoff();
    // The hand-written pre-ledger row is untouched.
    expect(out).toContain('| 2026-09-08 | my-spec | requirements | v1 | approved | pre-ledger row |');
    // The new ledger-derived design row is added.
    expect(out).toContain('| 2026-09-15 | my-spec | design | v2 | approved | ok |');
  });

  it('phase-log fails naming HANDOFF when it is missing', async () => {
    await writeLedger([{ ts: '2026-09-15T10:00:00Z', type: 'run.start', run: 'run-1', spec: SPEC }]);
    const res = await harnessHandler({ action: 'phase-log', specName: SPEC }, context);
    expect(res.success).toBe(false);
    expect(res.message).toContain('HANDOFF.md');
  });

  // Requirements 4-5 — the `gate` action (design Component 2).

  const writeSensitiveRules = (paths: string[]) =>
    fs.writeFile(
      join(tempDir, '.spec-workflow', 'agent-rules.md'),
      ['# rules', '', '## Sensitive paths', '', ...paths.map(p => `- \`${p}\``), ''].join('\n'),
    );

  it('gate put then get round-trips the payload', async () => {
    const payload = { items: [{ header: 'H', question: 'Q?', options: ['x', 'y'] }] };
    const put = await harnessHandler({ action: 'gate', specName: SPEC, op: 'put', slot: 'a', payload }, context);
    expect(put.success).toBe(true);

    const get = await harnessHandler({ action: 'gate', specName: SPEC, op: 'get', slot: 'a' }, context);
    expect(get.success).toBe(true);
    expect(get.data.present).toBe(true);
    expect(get.data.payload).toEqual(payload);
  });

  it('gate delete then get returns present false', async () => {
    await harnessHandler(
      { action: 'gate', specName: SPEC, op: 'put', slot: 'b', payload: { tasks: [], veto: [] } }, context,
    );
    const del = await harnessHandler({ action: 'gate', specName: SPEC, op: 'delete', slot: 'b' }, context);
    expect(del.success).toBe(true);

    const get = await harnessHandler({ action: 'gate', specName: SPEC, op: 'get', slot: 'b' }, context);
    expect(get.success).toBe(true);
    expect(get.data.present).toBe(false);
  });

  it('gate get on an absent file returns present false', async () => {
    const get = await harnessHandler({ action: 'gate', specName: SPEC, op: 'get', slot: 'a' }, context);
    expect(get.success).toBe(true);
    expect(get.data.present).toBe(false);
    expect(get.data.payload).toBe(null);
  });

  it('gate put fails naming a missing payload and writes nothing', async () => {
    const put = await harnessHandler({ action: 'gate', specName: SPEC, op: 'put', slot: 'a' }, context);
    expect(put.success).toBe(false);
    expect(put.message).toContain('payload');
    const get = await harnessHandler({ action: 'gate', specName: SPEC, op: 'get', slot: 'a' }, context);
    expect(get.data.present).toBe(false);
  });

  // A class-(a) fixture: task 1 declares a sensitive path with no keyword prose,
  // task 2 fires the `auth` keyword, task 3 is neither.
  const CLASS_A_TASKS = [
    '# Tasks', '',
    '- [ ] 1. Rework the path helper',
    '  - File: src/core/path-utils.ts',
    '  _Prompt: Task: adjust the helper | Restrictions: none | Success: ok_',
    '',
    '- [ ] 2. Add token check',
    '  - File: src/tools/widget.ts',
    '  _Prompt: Task: add auth handling | Restrictions: none | Success: ok_',
    '',
    '- [ ] 3. Plain refactor',
    '  - File: src/tools/plain.ts',
    '  _Prompt: Task: rename things | Restrictions: none | Success: ok_',
    '',
  ].join('\n');

  it('gate class-a ranks a sensitive-path task above a keyword task', async () => {
    await writeDoc('tasks.md', CLASS_A_TASKS);
    await writeSensitiveRules(['src/core/path-utils.ts']);

    const res = await harnessHandler({ action: 'gate', specName: SPEC, op: 'class-a' }, context);
    expect(res.success).toBe(true);
    const items = res.data.items;
    expect(items[0].kind).toBe('sensitive-path');
    expect(items[0].taskId).toBe('1');
    expect(items[0].score).toBe(2);
    // The keyword task ranks below the sensitive-path task.
    const kw = items.find((i: any) => i.taskId === '2' && i.kind === 'keyword');
    expect(kw).toBeDefined();
    expect(items[0].score).toBeGreaterThanOrEqual(items[items.length - 1].score);
  });

  // A header row (no detail lines) whose title carries keywords still gets scanned.
  const HEADER_TASKS = [
    '# Tasks', '',
    '- [ ] 1. Billing migration umbrella',
    '',
    '- [ ] 1.1 Do a small thing',
    '  _Prompt: Task: small | Restrictions: none | Success: ok_',
    '',
  ].join('\n');

  it('gate class-a fires a keyword on a header row', async () => {
    await writeDoc('tasks.md', HEADER_TASKS);
    await writeAgentRules(); // no `## Sensitive paths` list
    const res = await harnessHandler({ action: 'gate', specName: SPEC, op: 'class-a' }, context);
    expect(res.success).toBe(true);
    const fired = res.data.items.filter((i: any) => i.taskId === '1' && i.kind === 'keyword');
    expect(fired.length).toBeGreaterThan(0);
  });

  // Task 1 has no `- File:` line — its `files` coalesce to []. Tasks 2-3 are
  // plain, so only one of three tasks matches a keyword (below the 60% class-a
  // saturation threshold, so the keyword scan is not dropped, retro P15).
  const EMPTY_FILES_TASKS = [
    '# Tasks', '',
    '- [ ] 1. A config change with no file line',
    '  _Prompt: Task: tweak config | Restrictions: none | Success: ok_',
    '',
    '- [ ] 2. Plain refactor',
    '  _Prompt: Task: rename things | Restrictions: none | Success: ok_',
    '',
    '- [ ] 3. Another plain step',
    '  _Prompt: Task: adjust wording | Restrictions: none | Success: ok_',
    '',
  ].join('\n');

  it('gate class-a does not crash on a task with no files', async () => {
    await writeDoc('tasks.md', EMPTY_FILES_TASKS);
    await writeSensitiveRules(['src/core/path-utils.ts']);
    const res = await harnessHandler({ action: 'gate', specName: SPEC, op: 'class-a' }, context);
    expect(res.success).toBe(true);
    // No file means no path item, but the `config` keyword still fires.
    expect(res.data.items.every((i: any) => i.kind === 'keyword')).toBe(true);
    expect(res.data.items.some((i: any) => i.reason.includes('config'))).toBe(true);
  });

  it('gate class-a does not fail when the sensitive list is missing', async () => {
    await writeDoc('tasks.md', EMPTY_FILES_TASKS); // no agent-rules.md written ⇒ ENOENT
    const res = await harnessHandler({ action: 'gate', specName: SPEC, op: 'class-a' }, context);
    expect(res.success).toBe(true);
    // Keywords still fire with no sensitive list.
    expect(res.data.items.some((i: any) => i.kind === 'keyword')).toBe(true);
  });

  // Every task fires a keyword (100% > 60%), so the keyword net is dropped and
  // only the one task with a destructive verb is flagged (retro P15).
  const SATURATED_TASKS = [
    '# Tasks', '',
    '- [ ] 1. Add auth handling',
    '  _Prompt: Task: wire the auth middleware | Restrictions: none | Success: ok_',
    '',
    '- [ ] 2. Run the billing migration',
    '  _Prompt: Task: run the billing migration | Restrictions: none | Success: ok_',
    '',
    '- [ ] 3. Drop the legacy accounts table',
    '  _Prompt: Task: drop the legacy accounts table | Restrictions: none | Success: ok_',
    '',
  ].join('\n');

  it('gate class-a drops the keyword net past 60% and keeps destructive verbs only (retro P15)', async () => {
    await writeDoc('tasks.md', SATURATED_TASKS);
    await writeAgentRules(); // no `## Sensitive paths` list
    const res = await harnessHandler({ action: 'gate', specName: SPEC, op: 'class-a' }, context);
    expect(res.success).toBe(true);
    const items = res.data.items;
    // Only the destructive-verb task survives; the auth and billing/migration
    // keyword items are dropped.
    expect(items).toHaveLength(1);
    expect(items[0].taskId).toBe('3');
    expect(items[0].kind).toBe('keyword');
    expect(items[0].reason).toBe('destructive: drop');
    expect(items.some((i: any) => i.taskId === '1' || i.taskId === '2')).toBe(false);
  });

  // Requirement 5 — the `usage` action (design Component 6).

  const writeSpecLedger = async (spec: string, events: Record<string, unknown>[]) => {
    const dir = join(tempDir, '.spec-workflow', 'specs', spec);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, 'harness-events.jsonl'), events.map(e => JSON.stringify(e)).join('\n') + '\n');
  };

  const writeSpecActivity = async (spec: string, rows: Record<string, unknown>[]) => {
    const dir = join(tempDir, '.spec-workflow', 'specs', spec);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, 'harness-activity.jsonl'), rows.map(r => JSON.stringify(r)).join('\n') + '\n');
  };

  it('usage folds one spec: report totals and the phase row in the message', async () => {
    await writeLedger([
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
      { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-drafter', phase: 'requirements' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-drafter', tokens: '1000' },
    ]);

    const res = await harnessHandler({ action: 'usage', specName: SPEC }, context);
    expect(res.success).toBe(true);
    expect(res.data.report.runs).toBe(1);
    expect(res.data.report.total).toEqual({ spawns: 1, tokens: 1000, unknown: 0, cacheWrite5m: 0, cacheWrite1h: 0, gapRewrites: 0, cacheUnknownWrite: 1, cacheUnknownGap: 0, graph: 0 });
    expect(res.message).toContain('requirements | sdd-drafter | 1 | 1,000');
    // One spec ⇒ no compare, no delta.
    expect(res.data.compare).toBeUndefined();
    expect(res.data.delta).toBeUndefined();
  });

  it('usage compares two specs and returns a per-phase delta', async () => {
    await writeLedger([
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
      { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-drafter', phase: 'requirements' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-drafter', tokens: '1000' },
    ]);
    await writeSpecLedger('other-spec', [
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r9', spec: 'other-spec' },
      { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r9', spec: 'other-spec', agent: 'sdd-drafter', phase: 'requirements' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r9', spec: 'other-spec', agent: 'sdd-drafter', tokens: '3000' },
    ]);

    const res = await harnessHandler({ action: 'usage', specName: SPEC, compareSpecName: 'other-spec' }, context);
    expect(res.success).toBe(true);
    expect(res.data.compare.spec).toBe('other-spec');
    expect(res.message).toContain('usage my-spec');
    expect(res.message).toContain('usage other-spec');
    const reqDelta = res.data.delta.find((d: any) => d.phase === 'requirements');
    expect(reqDelta).toEqual({ phase: 'requirements', spawns: 0, tokens: 2000 });
  });

  it('usage marks an unknown cell', async () => {
    await writeLedger([
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
      { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-reviewer', phase: 'requirements' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-reviewer', tokens: 'unknown' },
    ]);

    const res = await harnessHandler({ action: 'usage', specName: SPEC }, context);
    expect(res.success).toBe(true);
    expect(res.data.report.total.unknown).toBe(1);
    expect(res.message).toContain('(+1 unknown)');
  });

  it('usage reads an old review-gate-shape ledger (digit tokens on spawn.end)', async () => {
    await writeLedger([
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
      { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-implementer', phase: 'implementation' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-implementer', tokens: '50000' },
    ]);

    const res = await harnessHandler({ action: 'usage', specName: SPEC }, context);
    expect(res.success).toBe(true);
    expect(res.data.report.total.tokens).toBe(50000);
    expect(res.data.report.total.unknown).toBe(0);
  });

  it('usage carries zero deepseek cells on a provider-less ledger', async () => {
    await writeLedger([
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
      { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-implementer', phase: 'implementation' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-implementer', tokens: '50000' },
    ]);

    const res = await harnessHandler({ action: 'usage', specName: SPEC }, context);
    expect(res.success).toBe(true);
    expect(res.data.report.providers.deepseek).toEqual({ spawns: 0, tokens: 0, unknown: 0, cacheWrite5m: 0, cacheWrite1h: 0, gapRewrites: 0, cacheUnknownWrite: 0, cacheUnknownGap: 0, graph: 0 });
    expect(res.data.report.total).toEqual({ spawns: 1, tokens: 50000, unknown: 0, cacheWrite5m: 0, cacheWrite1h: 0, gapRewrites: 0, cacheUnknownWrite: 1, cacheUnknownGap: 0, graph: 0 });
  });

  it('usage folds the committed fixture ledger (runs 2, 5 spawns, 4,554,189)', async () => {
    const fixture = fileURLToPath(new URL('../../__tests__/fixtures/usage-ledger.jsonl', import.meta.url));
    await fs.writeFile(join(specDir, 'harness-events.jsonl'), await fs.readFile(fixture, 'utf-8'));

    const res = await harnessHandler({ action: 'usage', specName: SPEC }, context);
    expect(res.success).toBe(true);
    expect(res.data.report.runs).toBe(2);
    expect(res.data.report.total.spawns).toBe(5);
    expect(res.data.report.total.tokens).toBe(4554189);
  });

  it('usage counts a second run id that has no run.start', async () => {
    await writeLedger([
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
      { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-drafter', phase: 'requirements' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-drafter', tokens: '1000' },
      { ts: '2026-09-20T11:00:01Z', type: 'spawn.start', run: 'r2', spec: SPEC, agent: 'sdd-reviser', phase: 'design' },
      { ts: '2026-09-20T11:00:02Z', type: 'spawn.end', run: 'r2', spec: SPEC, agent: 'sdd-reviser', tokens: '2000' },
    ]);

    const res = await harnessHandler({ action: 'usage', specName: SPEC }, context);
    expect(res.success).toBe(true);
    expect(res.data.report.runs).toBe(2);
    expect(res.data.report.total.spawns).toBe(2);
  });

  it('usage fails naming an unknown spec dir', async () => {
    const res = await harnessHandler({ action: 'usage', specName: 'ghost' }, context);
    expect(res.success).toBe(false);
    expect(res.message).toContain('ghost');
  });

  it('usage on a spec with no ledger gives runs 0 with success', async () => {
    const res = await harnessHandler({ action: 'usage', specName: SPEC }, context);
    expect(res.success).toBe(true);
    expect(res.data.report.runs).toBe(0);
    expect(res.data.report.total.spawns).toBe(0);
  });

  // Requirement 6 — the activity join (design C5).

  it('usage joins the spec activity: graph counts per agent and phase, graph header', async () => {
    await writeLedger([
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
      { ts: '2026-09-20T10:00:01Z', type: 'phase.start', run: 'r1', spec: SPEC, phase: 'requirements' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-drafter', phase: 'requirements' },
      { ts: '2026-09-20T10:00:03Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-drafter', tokens: '1000' },
    ]);
    await writeSpecActivity(SPEC, [
      { ts: '2026-09-20T10:00:04Z', agent: 'sdd-drafter', event: 'tool', tool: 'Bash', summary: 'graphify explain "x"' },
      { ts: '2026-09-20T10:00:05Z', agent: 'sdd-drafter', event: 'tool', tool: 'Bash', summary: 'graphify query t' },
      { ts: '2026-09-20T10:00:06Z', agent: 'sdd-drafter', event: 'tool', tool: 'Bash', summary: 'graphify update .' },
    ]);

    const res = await harnessHandler({ action: 'usage', specName: SPEC }, context);
    expect(res.success).toBe(true);
    const req = res.data.report.phases.find((p: any) => p.phase === 'requirements');
    expect(req.agents['sdd-drafter'].graph).toBe(2);
    expect(req.total.graph).toBe(2);
    expect(res.data.report.total.graph).toBe(2);
    expect(res.message).toContain('| gapRewrites | graph');
  });

  it('usage compare reads each spec graph count from its own activity file', async () => {
    await writeLedger([
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
      { ts: '2026-09-20T10:00:01Z', type: 'phase.start', run: 'r1', spec: SPEC, phase: 'requirements' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-drafter', phase: 'requirements' },
      { ts: '2026-09-20T10:00:03Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-drafter', tokens: '1000' },
    ]);
    await writeSpecActivity(SPEC, [
      { ts: '2026-09-20T10:00:04Z', agent: 'sdd-drafter', event: 'tool', tool: 'Bash', summary: 'graphify explain "x"' },
    ]);
    await writeSpecLedger('other-spec', [
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r9', spec: 'other-spec' },
      { ts: '2026-09-20T10:00:01Z', type: 'phase.start', run: 'r9', spec: 'other-spec', phase: 'requirements' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.start', run: 'r9', spec: 'other-spec', agent: 'sdd-drafter', phase: 'requirements' },
      { ts: '2026-09-20T10:00:03Z', type: 'spawn.end', run: 'r9', spec: 'other-spec', agent: 'sdd-drafter', tokens: '3000' },
    ]);
    await writeSpecActivity('other-spec', [
      { ts: '2026-09-20T10:00:04Z', agent: 'sdd-drafter', event: 'tool', tool: 'Bash', summary: 'graphify query a' },
      { ts: '2026-09-20T10:00:05Z', agent: 'sdd-drafter', event: 'tool', tool: 'Bash', summary: 'graphify path "A" "B"' },
      { ts: '2026-09-20T10:00:06Z', agent: 'sdd-drafter', event: 'tool', tool: 'Bash', summary: 'graphify explain z' },
    ]);

    const res = await harnessHandler({ action: 'usage', specName: SPEC, compareSpecName: 'other-spec' }, context);
    expect(res.success).toBe(true);
    expect(res.data.report.total.graph).toBe(1);
    expect(res.data.compare.total.graph).toBe(3);
  });

  it('usage with a ledger but no activity file reports 0 graph', async () => {
    await writeLedger([
      { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
      { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-drafter', phase: 'requirements' },
      { ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-drafter', tokens: '1000' },
    ]);

    const res = await harnessHandler({ action: 'usage', specName: SPEC }, context);
    expect(res.success).toBe(true);
    expect(res.data.report.total.graph).toBe(0);
  });
});
