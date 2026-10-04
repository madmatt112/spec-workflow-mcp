import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { harnessHandler, harnessTool, codeGraphSection } from '../harness.js';
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
  const writeDecomposition = async (content: string) => {
    const dir = join(tempDir, '.spec-workflow', 'spec-decomposition');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, 'decomposition.md'), content);
  };

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
    // No ledger: nothing to drain (retro P4).
    expect(res.data.inFlightReports).toEqual([]);
  });

  it('(5b) implementation resume returns the undrained worker report (retro P4)', async () => {
    await writeDoc('tasks.md', [
      '# Tasks', '',
      '- [-] 1. First task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_', '',
    ].join('\n'));
    // A worker finished (the hook wrote spawn.report) after the last spawn.usage, so the
    // resuming orchestrator must drain it before it spawns anew.
    await writeDoc('harness-events.jsonl', [
      JSON.stringify({ ts: '2026-09-20T10:00:00.000Z', run: 'r1', spec: SPEC, type: 'run.start' }),
      JSON.stringify({ ts: '2026-09-20T10:05:00.000Z', run: 'r1', spec: SPEC, type: 'spawn.report', agent: 'sdd-implementer', agentId: 'a1', report: 'task 1 done; logged: yes/1; commit: abc123' }),
      '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'implementation' }, context);
    expect(res.success).toBe(true);
    expect(res.data.nextStep).toBe('Per-task loop: resume task 1');
    expect(res.data.inFlightReports).toEqual([
      { agent: 'sdd-implementer', agentId: 'a1', report: 'task 1 done; logged: yes/1; commit: abc123', ts: '2026-09-20T10:05:00.000Z' },
    ]);
  });

  // Requirement 4 criteria 2 and 3 — orient's implementation `queue`, `nextTask` and
  // `decomposition` (design C5), so the orchestrator picks tasks and reads the
  // scenario without a whole-file read.

  it('(5c) implementation queue: the [-] task first, then [ ] tasks in file order; nextTask is queue[0]', async () => {
    await writeDoc('tasks.md', [
      '# Tasks', '',
      '- [-] 1. First task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_',
      '- [ ] 2. Second task',
      '  - File: src/a.ts',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_',
      '- [ ] 3. Third task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_', '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'implementation' }, context);
    expect(res.success).toBe(true);
    expect(res.data.queue).toEqual([
      { id: '1', title: 'First task', status: 'in-progress', files: [] },
      { id: '2', title: 'Second task', status: 'pending', files: ['src/a.ts'] },
      { id: '3', title: 'Third task', status: 'pending', files: [] },
    ]);
    expect(res.data.nextTask).toEqual({ id: '1', title: 'First task', status: 'in-progress', files: [] });
    // Mid-loop (not the completion gate or repair): no decomposition key (design C5).
    expect(res.data.decomposition).toBeUndefined();
  });

  it('(5d) implementation queue drops header tasks (no implementation details)', async () => {
    await writeDoc('tasks.md', [
      '# Tasks', '',
      '- [ ] 1. Group header, no details',
      '- [ ] 1.1 Real task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_', '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'implementation' }, context);
    expect(res.success).toBe(true);
    expect(res.data.queue).toEqual([
      { id: '1.1', title: 'Real task', status: 'pending', files: [] },
    ]);
    expect(res.data.nextTask).toEqual({ id: '1.1', title: 'Real task', status: 'pending', files: [] });
  });

  it('(5e) completion gate: decomposition entry read with the "." label form', async () => {
    await writeDoc('tasks.md', [
      '# Tasks', '',
      '- [x] 1. Done task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_', '',
    ].join('\n'));
    await writeDecomposition([
      '## Specs', '',
      '### 7. `my-spec` — Example title (active)', '',
      'Some body text describing the spec.', '',
      '**End-to-end verification.** Do the thing and check it works.',
      '**Depends on** nothing.', '',
      '### 8. `other-spec` — Other title (active)', '',
      'Other body.', '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'implementation' }, context);
    expect(res.success).toBe(true);
    expect(res.data.nextStep).toBe('Completion gate');
    expect(res.data.decomposition).toEqual({
      title: 'Example title (active)',
      scenario: '**End-to-end verification.** Do the thing and check it works.',
    });
  });

  it('(5f) completion gate: decomposition entry read with the "**:" label form', async () => {
    await writeDoc('tasks.md', [
      '# Tasks', '',
      '- [x] 1. Done task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_', '',
    ].join('\n'));
    await writeDecomposition([
      '## Specs', '',
      '### 7. `my-spec` — Example title (active)', '',
      'Some body text describing the spec.', '',
      '**End-to-end verification**: Do the other thing.',
      '**Depends on** nothing.', '',
      '### 8. `other-spec` — Other title (active)', '',
      'Other body.', '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'implementation' }, context);
    expect(res.success).toBe(true);
    expect(res.data.decomposition).toEqual({
      title: 'Example title (active)',
      scenario: '**End-to-end verification**: Do the other thing.',
    });
  });

  it('(5g) completion gate: decomposition file missing gives nulls, orient still succeeds', async () => {
    await writeDoc('tasks.md', [
      '# Tasks', '',
      '- [x] 1. Done task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_', '',
    ].join('\n'));
    // No decomposition.md written.
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'implementation' }, context);
    expect(res.success).toBe(true);
    expect(res.data.nextStep).toBe('Completion gate');
    expect(res.data.decomposition).toEqual({ title: null, scenario: null });
  });

  it('(5h) completion gate: no matching decomposition entry gives nulls, orient still succeeds', async () => {
    await writeDoc('tasks.md', [
      '# Tasks', '',
      '- [x] 1. Done task',
      '  _Prompt: Task: do it | Restrictions: none | Success: works_', '',
    ].join('\n'));
    await writeDecomposition([
      '## Specs', '',
      '### 7. `other-spec` — Other title (active)', '',
      '**End-to-end verification.** Something else entirely.', '',
    ].join('\n'));
    const res = await harnessHandler({ action: 'orient', specName: SPEC, phase: 'implementation' }, context);
    expect(res.success).toBe(true);
    expect(res.data.decomposition).toEqual({ title: null, scenario: null });
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

  // A tasks fixture whose task 1 carries a `- Test:` seam and whose task 2 does
  // not, for the test-author no-Test guard (design Component 4).
  const TASKS_TDD = [
    '# Tasks',
    'Document version: v1',
    '',
    '- [ ] 1. Task with a test seam',
    '  - File: src/foo.ts',
    '  - Test: tests/foo.test.ts — foo()',
    '  _Prompt: Task: a | Restrictions: none | Success: ok_',
    '',
    '- [ ] 2. Task without a test seam',
    '  - File: src/bar.ts',
    '  _Prompt: Task: b | Restrictions: none | Success: ok_',
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

  it('brief resolves a relative output path under the spec dir, not the spec-store root (retro P14)', async () => {
    await writeAgentRules();
    const relPath = join('reviews', 'drafter-brief-requirements.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'drafter', values: { path: relPath, title: 'Draft', job: 'write it' } },
      context,
    );
    expect(res.success).toBe(true);
    // A bare reviews/x.md lands in specs/<SPEC>/reviews/, not directly under .spec-workflow/.
    expect(res.data.path).toBe(join(specDir, relPath));
    expect(res.data.path.startsWith(tempDir)).toBe(true);
    const written = await fs.readFile(join(specDir, relPath), 'utf-8');
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

  // Component 4 — the test-author template and its no-Test guard.

  it('brief test-author writes the job and the task block for a task with a Test line', async () => {
    await writeDoc('tasks.md', TASKS_TDD);
    await writeAgentRules();
    const outPath = join(tempDir, 'author-brief-task-1.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'test-author', taskId: '1',
        values: { path: outPath, title: 'Author 1', job: 'write the red tests' } },
      context,
    );
    expect(res.success).toBe(true);

    const written = await fs.readFile(outPath, 'utf-8');
    // The task block is carried byte for byte and the job appears under ## Job.
    expect(written).toContain(taskBlock(TASKS_TDD, '1')!);
    expect(written).toContain('write the red tests');
    expect(written).toMatch(/Read and obey .*[/\\]agent-rules\.md first\./);
  });

  it('brief test-author fails and writes no file when the task has no Test line', async () => {
    await writeDoc('tasks.md', TASKS_TDD);
    await writeAgentRules();
    const outPath = join(tempDir, 'author-brief-task-2.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'test-author', taskId: '2',
        values: { path: outPath, title: 'Author 2', job: 'write the red tests' } },
      context,
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('has no Test: line');
    await expect(fs.access(outPath)).rejects.toThrow();
  });

  it('brief test-author names a missing job even when the task carries a Test line', async () => {
    await writeDoc('tasks.md', TASKS_TDD);
    await writeAgentRules();
    const outPath = join(tempDir, 'author-brief-nojob.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'test-author', taskId: '1',
        values: { path: outPath, title: 'Author 1' } },
      context,
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('job');
    await expect(fs.access(outPath)).rejects.toThrow();
  });

  // Component 5 — the implementer red-tests slot.

  it('brief implementer carries the redTests text after the task block', async () => {
    await writeDoc('tasks.md', TASKS);
    await writeAgentRules();
    const outPath = join(tempDir, 'impl-redtests.md');
    const redTests = '## Red tests (from the test author)\nfoo.test.ts fails as expected.';

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'implementer', taskId: '3',
        values: { path: outPath, title: 'Task 3', redTests } },
      context,
    );
    expect(res.success).toBe(true);

    const written = await fs.readFile(outPath, 'utf-8');
    const block = taskBlock(TASKS, '3')!;
    expect(written).toContain(redTests);
    // The red-tests section follows the task block.
    expect(written.indexOf(redTests)).toBeGreaterThan(written.indexOf(block));
  });

  it('brief implementer still succeeds when redTests is omitted', async () => {
    await writeDoc('tasks.md', TASKS);
    await writeAgentRules();
    const outPath = join(tempDir, 'impl-noredtests.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'implementer', taskId: '3',
        values: { path: outPath, title: 'Task 3' } },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');
    // The absent optional key leaks no literal 'undefined'.
    expect(written).not.toContain('undefined');
  });

  // retro P8 — redTests is required only when the task carries a TDD marker (a `- Test:` seam).

  it('brief implementer fails and writes no file when a TDD-marked task omits redTests', async () => {
    await writeDoc('tasks.md', TASKS_TDD);
    await writeAgentRules();
    const outPath = join(tempDir, 'impl-tdd-noredtests.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'implementer', taskId: '1',
        values: { path: outPath, title: 'Task 1' } },
      context,
    );
    expect(res.success).toBe(false);
    expect(res.message).toContain('redTests');
    await expect(fs.access(outPath)).rejects.toThrow();
  });

  it('brief implementer succeeds for a TDD-marked task when redTests is supplied', async () => {
    await writeDoc('tasks.md', TASKS_TDD);
    await writeAgentRules();
    const outPath = join(tempDir, 'impl-tdd-redtests.md');
    const redTests = '## Red tests (from the test author)\nfoo.test.ts fails as expected.';

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'implementer', taskId: '1',
        values: { path: outPath, title: 'Task 1', redTests } },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');
    expect(written).toContain(redTests);
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

  // Task 8 — document-phase brief kinds (`drafter`, `gate-a`, `reviewer`, `reviser`,
  // `adjudicator`, `checker`) ported verbatim from
  // harness/skills/sdd-document-phase/references/briefs.md, plus `reviewer` append mode
  // (design C6 table, Requirement 3 criterion 3; Requirement 5 criteria 1 and 2).

  // The C9 block sentence every report-ending sentence is replaced with (design C9).
  const C9_SENTENCE =
    'End with this block, at most 8 lines; the whole report is at most 80 words; ' +
    'put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.';

  it('brief drafter (requirements phase) renders the requirements Job/Load/Size branches and the C9 report block', async () => {
    await writeAgentRules();
    const outPath = join(tempDir, 'drafter-requirements.md');
    const docPath = join(specDir, 'requirements.md');
    const specStoreRoot = join(tempDir, '.spec-workflow');

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'drafter',
        values: {
          path: outPath,
          phase: 'requirements',
          docPath,
          specDir,
          specStoreRoot,
          codeRoot: tempDir,
          carried: 'none',
        },
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    // Job sentence, verbatim briefs.md:13-16.
    expect(written).toContain(`Write v1 of \`${docPath}\` in place`);
    // Requirements has no context file to start from yet (briefs.md:21).
    expect(written).toContain('nothing yet; you write the context file');
    // Requirements steering load (briefs.md:22).
    expect(written).toContain('steering/product.md');
    // Requirements word cap (briefs.md:42).
    expect(written).toContain('Cap: 3,500 words');
    // No earlier documents for requirements (briefs.md:30).
    expect(written).toContain('## Carried from');

    // The old free-text report sentence is gone; the C9 block sentence and the
    // drafter's own report keys (design C9 table) replace it (Requirement 5.1, 5.2).
    expect(written).not.toContain('report in 150 words or fewer: files touched');
    expect(written).toContain(C9_SENTENCE);
    for (const key of ['doc:', 'words:', 'context:', 're-decided:', 'scope-cut:', 'gate-a:', 'flags:']) {
      expect(written).toContain(key);
    }
  });

  it('brief drafter (design phase) renders the design Load/Size branches', async () => {
    await writeAgentRules();
    const outPath = join(tempDir, 'drafter-design.md');
    const docPath = join(specDir, 'design.md');

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'drafter',
        values: {
          path: outPath,
          phase: 'design',
          docPath,
          specDir,
          specStoreRoot: join(tempDir, '.spec-workflow'),
          codeRoot: tempDir,
          carried: 'none',
        },
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    expect(written).toContain(`Write v1 of \`${docPath}\` in place`);
    // Design and tasks start from the context file (briefs.md:19-20).
    expect(written).toContain('it maps the code the');
    expect(written).toContain('Start from it instead of exploring from cold');
    // Design steering load (briefs.md:23).
    expect(written).toContain('steering/tech.md');
    expect(written).toContain('design-system.md');
    // Design word cap (briefs.md:42).
    expect(written).toContain('Cap: 4,000 words');
    // Design's only earlier document is requirements.md (briefs.md:30-31).
    expect(written).toContain(`${specDir}/requirements.md`.replace(/\\/g, '/'));
  });

  it('brief drafter (tasks phase) renders the tasks Size cap, the tasks-only Rules bullet and carried items', async () => {
    await writeAgentRules();
    const outPath = join(tempDir, 'drafter-tasks.md');
    const docPath = join(specDir, 'tasks.md');
    const carried = 'R2-3 — Baseline persistence: ruled out, superseded by D15';

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'drafter',
        values: {
          path: outPath,
          phase: 'tasks',
          docPath,
          specDir,
          specStoreRoot: join(tempDir, '.spec-workflow'),
          codeRoot: tempDir,
          carried,
        },
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    // Tasks word cap, per task block (briefs.md:42-43).
    expect(written).toContain('Cap: 150 words per task block');
    // Tasks-only Rules bullet (briefs.md:101, :133).
    expect(written).toContain('tasks.md only: follow');
    expect(written).toContain('templates/tasks-template.md` exactly');
    expect(written).toContain('Document version: v1');
    // The carried item is listed and must be addressed (briefs.md:36-39).
    expect(written).toContain(carried);
    expect(written).toContain('Address each carried item in this document');
  });

  it('brief gate-a renders the gate-A re-spawn job pointing at the gate put call', async () => {
    const outPath = join(tempDir, 'gate-a-brief.md');
    const docPath = join(specDir, 'requirements.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'gate-a', values: { path: outPath, docPath } },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    // Verbatim briefs.md:150-157.
    expect(written).toContain('Do only your gate-A step again');
    expect(written).toContain('`op: put`, `slot: a`');
    expect(written).toContain('Report in 40 words or fewer');
  });

  // The reviewer kind appends the "## This round" section to an existing scaffold at
  // `values.path` (design C6 table, "append to promptOutputPath"; Error Handling 5).

  const REVIEWER_VALUES = (overrides: Record<string, unknown>) => ({
    phase: 'design',
    specDir,
    lintChecks: '',
    lintOpen: 'none',
    reDecided: 'none',
    overCap: 'none',
    lens: 'a cold read for internal contradictions and a truth table of the stated cases',
    closedByRuling: 'none',
    memoryPath: join(specDir, 'reviews', 'memory-design.md'),
    codeRoot: tempDir,
    specStoreRoot: join(tempDir, '.spec-workflow'),
    ...overrides,
  });

  const writeScaffold = (name: string) =>
    fs.writeFile(join(specDir, 'reviews', name), '# Scaffold\n\nStanding directives here.\n');

  it('brief reviewer (D=1) renders the first-review bullet and the default requirements lens, not the D>1 recap', async () => {
    await writeScaffold('adversarial-prompt-requirements.md');
    const target = join(specDir, 'reviews', 'adversarial-prompt-requirements.md');

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'reviewer',
        values: REVIEWER_VALUES({ path: target, phase: 'requirements', D: '1' }),
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(target, 'utf-8');

    // D=1 first-review branch (briefs.md:180-183).
    expect(written).toContain('First review. Read the decomposition entry for');
    // Default first lens for requirements at D=1 (briefs.md:208-210).
    expect(written).toContain('the default first lens for requirements');
    // The D>1 recap branch must not appear.
    expect(written).not.toContain('Read the Revision History line for v1 first');

    // Report block replaced with the C9 sentence and the reviewer's own keys (design C9).
    expect(written).toContain(C9_SENTENCE);
    for (const key of ['verdict:', 'escalate:', 'analysis:']) {
      expect(written).toContain(key);
    }
  });

  it('brief reviewer (D=2) renders the Revision-History recap bullet and the caller-given lens, not the D=1 branch', async () => {
    await writeScaffold('adversarial-prompt-requirements-r2.md');
    const target = join(specDir, 'reviews', 'adversarial-prompt-requirements-r2.md');

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'reviewer',
        values: REVIEWER_VALUES({
          path: target, phase: 'requirements', D: '2',
          lens: 'vendor or format facts checked against their source',
        }),
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(target, 'utf-8');

    // D>1 recap branch (briefs.md:191-193).
    expect(written).toContain('Read the Revision History line for v2 first and attack those changes');
    expect(written).not.toContain('First review. Read the decomposition entry for');
    // The caller-given lens is used verbatim, not the requirements default.
    expect(written).toContain('vendor or format facts checked against their source');
    expect(written).not.toContain('the default first lens for requirements');
  });

  it('brief reviewer omits the Machine-verified bullet when lintChecks is empty (lint skipped)', async () => {
    await writeScaffold('adversarial-prompt-design.md');
    const target = join(specDir, 'reviews', 'adversarial-prompt-design.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'reviewer', values: REVIEWER_VALUES({ path: target, D: '1', lintChecks: '' }) },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(target, 'utf-8');
    expect(written).not.toContain('Machine-verified:');
  });

  it('brief reviewer renders the Machine-verified bullet with the lint checks and open findings when lintChecks is set', async () => {
    await writeScaffold('adversarial-prompt-design-r2.md');
    const target = join(specDir, 'reviews', 'adversarial-prompt-design-r2.md');

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'reviewer',
        values: REVIEWER_VALUES({
          path: target, D: '2',
          lintChecks: 'L-1, L-2, L-3',
          lintOpen: 'L-2 (warning, prose-cap, line 40): over cap.',
        }),
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(target, 'utf-8');
    // Verbatim briefs.md:171-176.
    expect(written).toContain('Machine-verified:');
    expect(written).toContain('`spec-lint` ran');
    expect(written).toContain('L-1, L-2, L-3');
    expect(written).toContain('L-2 (warning, prose-cap, line 40): over cap.');
  });

  it('brief reviewer appends the round section after the existing scaffold content, keeping it intact', async () => {
    await writeScaffold('adversarial-prompt-tasks.md');
    const target = join(specDir, 'reviews', 'adversarial-prompt-tasks.md');
    const before = await fs.readFile(target, 'utf-8');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'reviewer', values: REVIEWER_VALUES({ path: target, phase: 'tasks', D: '1' }) },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(target, 'utf-8');

    // The existing scaffold survives byte for byte, with the new section appended after it.
    expect(written.startsWith(before)).toBe(true);
    expect(written).toContain('## This round');
    expect(written.indexOf('## This round')).toBeGreaterThan(before.length - 1);
  });

  it('brief reviewer fails naming the missing target and writes nothing when promptOutputPath does not exist', async () => {
    const target = join(specDir, 'reviews', 'adversarial-prompt-missing.md');

    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'reviewer', values: REVIEWER_VALUES({ path: target, D: '1' }) },
      context,
    );
    // Error Handling 5: a missing append target fails naming it and writes nothing.
    expect(res.success).toBe(false);
    expect(res.message).toBe(`brief: ${target} missing; nothing appended`);
    await expect(fs.access(target)).rejects.toThrow();
  });

  // The reviser kind's four variants (design C6 table): `round`, `should-fix-only`,
  // `revision` (Step R) and `lint-fix` (the lint brief, briefs.md:361-417).

  const reviserBase = () => ({
    phase: 'design',
    specDir,
    memoryPath: join(specDir, 'reviews', 'memory-design.md'),
    closedByRuling: 'none',
  });

  it('brief reviser (variant: round) renders the Round-<A> adversarial-response Revision History instruction', async () => {
    const outPath = join(tempDir, 'reviser-round.md');
    const docPath = join(specDir, 'design.md');
    const findings = join(specDir, 'reviews', 'adversarial-analysis-design.md');

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'reviser',
        values: { ...reviserBase(), path: outPath, docPath, D: '2', findings, variant: 'round' },
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    // Header and Job sentence filled with D+1 (briefs.md:267, :272).
    expect(written).toContain(`# Reviser brief — ${SPEC} design v3`);
    expect(written).toContain('Produce v3 of');
    // The findings path is carried through (briefs.md:285).
    expect(written).toContain(findings);
    // The round variant leaves the reviser's own fill-in placeholder untouched (briefs.md:306-308).
    expect(written).toContain('Round-<A> adversarial response');
    expect(written).toContain('Cap: 4,000 words');

    // Report block replaced with the C9 sentence and the reviser's own keys.
    expect(written).toContain(C9_SENTENCE);
    for (const key of ['version:', 'words:', 'accepted:', 'partial:', 'rejected:', 'cut-scope:', 'flags:']) {
      expect(written).toContain(key);
    }
  });

  it('brief reviser (variant: should-fix-only) tells the reviser to end the Revision History line "SHOULD_FIX-only corrective pass" instead', async () => {
    const outPath = join(tempDir, 'reviser-sfo.md');
    const docPath = join(specDir, 'design.md');
    const findings = join(specDir, 'reviews', 'adversarial-analysis-design-r2.md');

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'reviser',
        values: { ...reviserBase(), path: outPath, docPath, D: '2', findings, variant: 'should-fix-only' },
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    // SKILL.md:201-204: the SHOULD_FIX-only pass ends the Revision History line this way.
    expect(written).toContain('SHOULD_FIX-only corrective pass');
    expect(written).not.toContain('Round-<A> adversarial response');
  });

  it('brief reviser (variant: revision) renders the ## Revision input section from RI items instead of an analysis path', async () => {
    const outPath = join(tempDir, 'reviser-revision.md');
    const docPath = join(specDir, 'design.md');
    const findings = 'RI-1: Clarify the retry budget.\nRI-2: Add the missing error code.';

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'reviser',
        values: { ...reviserBase(), path: outPath, docPath, D: '3', findings, variant: 'revision' },
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    // briefs.md:285, :294-296: revision input replaces the analysis-path Findings line.
    expect(written).toContain('the list below (revision input)');
    expect(written).toContain('## Revision input');
    expect(written).toContain('RI-1: Clarify the retry budget.');
    expect(written).toContain('RI-2: Add the missing error code.');
  });

  it('brief reviser (variant: lint-fix) renders the Lint brief job, header and "Add no version line" rule', async () => {
    const outPath = join(tempDir, 'reviser-lintfix.md');
    const docPath = join(specDir, 'design.md');
    const findings = 'L-1 (error, citation-identifier, line 42): bad citation.\nL-2 (warning, prose-cap, line 10): over cap.';

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'reviser',
        values: { ...reviserBase(), path: outPath, docPath, D: '3', findings, variant: 'lint-fix' },
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    // briefs.md:364, :369, :386, :398-399.
    expect(written).toContain(`# Lint brief — ${SPEC} design v3`);
    expect(written).toContain('Fix the lint findings below in v3 of');
    expect(written).toContain('## Revision input');
    expect(written).toContain('L-1 (error, citation-identifier, line 42): bad citation.');
    expect(written).toContain('Add no version line');
    expect(written).toContain('**Lint pass.**');
  });

  it('brief adjudicator (docPath form) renders the post-cap corrective-pass job and the C9 report block', async () => {
    const outPath = join(tempDir, 'adjudication-brief.md');
    const docPath = join(specDir, 'design.md');
    const items = '1 — Missing field (MUST_FIX)\n2 — Ambiguous enum (SHOULD_FIX)';

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'adjudicator',
        values: { path: outPath, items, phase: 'design', docPath },
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    // Verbatim briefs.md:421, :425-427, :432-433, :446-450.
    expect(written).toContain('post-cap corrective pass');
    expect(written).toContain('## Open items');
    expect(written).toContain(items);
    expect(written).toContain('Post-cap corrective pass');
    expect(written).toContain('150 words or fewer');

    expect(written).toContain(C9_SENTENCE);
    for (const key of ['fixed:', 'ruled-out:', 'notes:', 'flags:']) {
      expect(written).toContain(key);
    }
  });

  it('brief checker renders the narrow-check prompt (not a review) and the C9 report block', async () => {
    const outPath = join(tempDir, 'narrow-check.md');
    const items = '1 — Gate B tag missing\n2 — Success-clause gap';

    const res = await harnessHandler(
      {
        action: 'brief', specName: SPEC, template: 'checker',
        values: { path: outPath, phase: 'tasks', items, specDir, codeRoot: tempDir },
      },
      context,
    );
    expect(res.success).toBe(true);
    const written = await fs.readFile(outPath, 'utf-8');

    // Verbatim briefs.md:460-477.
    expect(written).toContain('This is not a review');
    expect(written).toContain('## Items');
    expect(written).toContain(items);
    expect(written).toContain('VERIFIED: <k>/<n>');
    expect(written).toContain('Do not write a verdict block. Do not update the memory file. Do not edit the document.');

    expect(written).toContain(C9_SENTENCE);
    for (const key of ['verified:', 'deferred:', 'analysis:']) {
      expect(written).toContain(key);
    }
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
    expect(res.data.report.total).toEqual({ spawns: 1, tokens: 1000, unknown: 0, w: 0, wUnknown: 1, cacheWrite5m: 0, cacheWrite1h: 0, gapRewrites: 0, cacheUnknownWrite: 1, cacheUnknownGap: 0, graph: 0 });
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
    expect(reqDelta).toMatchObject({ phase: 'requirements', spawns: 0, tokens: 2000, w: 0 });
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
    expect(res.data.report.providers.deepseek).toEqual({ spawns: 0, tokens: 0, unknown: 0, w: 0, wUnknown: 0, cacheWrite5m: 0, cacheWrite1h: 0, gapRewrites: 0, cacheUnknownWrite: 0, cacheUnknownGap: 0, graph: 0 });
    expect(res.data.report.total).toEqual({ spawns: 1, tokens: 50000, unknown: 0, w: 0, wUnknown: 1, cacheWrite5m: 0, cacheWrite1h: 0, gapRewrites: 0, cacheUnknownWrite: 1, cacheUnknownGap: 0, graph: 0 });
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

  // Requirement 1 criteria 2, 7, 8, 9 — the `sources` option of `usage` (design C4).

  describe('usage sources', () => {
    let cfgDir: string;
    let origCfgDir: string | undefined;

    beforeEach(() => {
      origCfgDir = process.env.CLAUDE_CONFIG_DIR;
      cfgDir = join(tempDir, 'claude-config');
      process.env.CLAUDE_CONFIG_DIR = cfgDir;
    });

    afterEach(() => {
      if (origCfgDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = origCfgDir;
    });

    const writeTranscript = async (project: string, session: string, agentId: string, lines: unknown[]) => {
      const dir = join(cfgDir, 'projects', project, session, 'subagents');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(join(dir, `agent-${agentId}.jsonl`), lines.map(l => JSON.stringify(l)).join('\n') + '\n');
    };

    it('prints one block per orchestrator spawn with its per-source breakdown (Req 1.2)', async () => {
      await writeLedger([
        { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
        { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-document-orchestrator', phase: 'design' },
        {
          ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-document-orchestrator',
          agentId: 'ag1', tokens: '150', input: '100', output: '10', cacheRead: '0', cacheWrite5m: '0', cacheWrite1h: '0',
        },
      ]);
      await writeSpecActivity(SPEC, [
        { ts: '2026-09-20T10:00:03Z', agent: 'sdd-document-orchestrator', event: 'tool', agentId: 'ag1', session: 'sess1' },
      ]);
      // One call, no preceding context: ctx = 100, base sizing = 100 (no chars to subtract),
      // so the whole input W (100) goes to `base` and 5*output (50) goes to `own-output`;
      // w = 150, matching the ledger W exactly (design C2 algorithm).
      await writeTranscript('proj1', 'sess1', 'ag1', [
        { type: 'assistant', message: { id: 'm1', content: [{ type: 'text', text: 'hi' }], usage: { input_tokens: 100, output_tokens: 10 } } },
      ]);

      const res = await harnessHandler({ action: 'usage', specName: SPEC, sources: true }, context);
      expect(res.success).toBe(true);
      const report = res.data.sources;
      expect(report.spec).toBe(SPEC);
      const found = report.spawns.find((s: any) => s.agentId === 'ag1');
      expect(found.ok).toBe(true);
      expect(found.phase).toBe('design');
      expect(found.agent).toBe('sdd-document-orchestrator');
      expect(found.ledgerW).toBeCloseTo(150);
      expect(found.diff).toBeCloseTo(0);
      expect(found.breakdown.calls).toBe(1);
      expect(found.breakdown.peak).toBe(100);
      expect(found.breakdown.w).toBeCloseTo(150);
      const baseRow = found.breakdown.rows.find((r: any) => r.source === 'base');
      expect(baseRow.w).toBeCloseTo(100);
      const outRow = found.breakdown.rows.find((r: any) => r.source === 'own-output');
      expect(outRow.w).toBeCloseTo(50);
      // The block names the spawn (phase, agent, agentId) and its sources.
      expect(res.message).toContain('design');
      expect(res.message).toContain('sdd-document-orchestrator');
      expect(res.message).toContain('ag1');
      expect(res.message).toContain('base');
      expect(res.message).toContain('own-output');
    });

    it('never fails on a spawn with no resolvable transcript: sources unknown with the ledger W (Req 1.7)', async () => {
      await writeLedger([
        { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
        { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-implementation-orchestrator', phase: 'implementation' },
        {
          ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-implementation-orchestrator',
          agentId: 'ag2', tokens: '550', input: '500', output: '10', cacheRead: '0', cacheWrite5m: '0', cacheWrite1h: '0',
        },
      ]);
      await writeSpecActivity(SPEC, [
        { ts: '2026-09-20T10:00:03Z', agent: 'sdd-implementation-orchestrator', event: 'tool', agentId: 'ag2', session: 'sess2' },
      ]);
      // No transcript file (and no projects directory at all) for sess2/ag2.

      const res = await harnessHandler({ action: 'usage', specName: SPEC, sources: true }, context);
      expect(res.success).toBe(true);
      const report = res.data.sources;
      expect(report.unknown).toBe(1);
      const found = report.spawns.find((s: any) => s.agentId === 'ag2');
      expect(found.ok).toBe(false);
      expect(found.reason).toBe('missing');
      expect(found.ledgerW).toBeCloseTo(550);
      expect(res.message).toContain('sources unknown (missing)');
      expect(res.message).toContain('550');
    });

    it('prints orch W per unit on the phase total when sources is true (Req 1.8)', async () => {
      await writeLedger([
        { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
        { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-document-orchestrator', phase: 'design' },
        {
          ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-document-orchestrator',
          tokens: '600', input: '100', output: '20', cacheRead: '0', cacheWrite5m: '0', cacheWrite1h: '0',
        },
        { ts: '2026-09-20T10:00:03Z', type: 'round', run: 'r1', spec: SPEC, phase: 'design', round: '1', verdict: 'approve' },
        { ts: '2026-09-20T10:00:04Z', type: 'round', run: 'r1', spec: SPEC, phase: 'design', round: '2', verdict: 'approve' },
      ]);

      const res = await harnessHandler({ action: 'usage', specName: SPEC, sources: true }, context);
      expect(res.success).toBe(true);
      // orchW 200 (100 input + 5*20 output) over 2 rounds = 100 W/round.
      expect(res.message).toContain('orch W/round 100');
    });

    it('prints both specs per-unit W and the delta on the compare table when sources is true (Req 1.8)', async () => {
      await writeLedger([
        { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r1', spec: SPEC },
        { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r1', spec: SPEC, agent: 'sdd-document-orchestrator', phase: 'design' },
        {
          ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r1', spec: SPEC, agent: 'sdd-document-orchestrator',
          tokens: '600', input: '100', output: '20', cacheRead: '0', cacheWrite5m: '0', cacheWrite1h: '0',
        },
        { ts: '2026-09-20T10:00:03Z', type: 'round', run: 'r1', spec: SPEC, phase: 'design', round: '1', verdict: 'approve' },
        { ts: '2026-09-20T10:00:04Z', type: 'round', run: 'r1', spec: SPEC, phase: 'design', round: '2', verdict: 'approve' },
      ]);
      await writeSpecLedger('other-spec', [
        { ts: '2026-09-20T10:00:00Z', type: 'run.start', run: 'r9', spec: 'other-spec' },
        { ts: '2026-09-20T10:00:01Z', type: 'spawn.start', run: 'r9', spec: 'other-spec', agent: 'sdd-document-orchestrator', phase: 'design' },
        {
          ts: '2026-09-20T10:00:02Z', type: 'spawn.end', run: 'r9', spec: 'other-spec', agent: 'sdd-document-orchestrator',
          tokens: '600', input: '100', output: '100', cacheRead: '0', cacheWrite5m: '0', cacheWrite1h: '0',
        },
        { ts: '2026-09-20T10:00:03Z', type: 'round', run: 'r9', spec: 'other-spec', phase: 'design', round: '1', verdict: 'approve' },
        { ts: '2026-09-20T10:00:04Z', type: 'round', run: 'r9', spec: 'other-spec', phase: 'design', round: '2', verdict: 'approve' },
      ]);

      const res = await harnessHandler(
        { action: 'usage', specName: SPEC, compareSpecName: 'other-spec', sources: true }, context,
      );
      expect(res.success).toBe(true);
      // Primary 100 W/round, compare 300 W/round (100 input + 5*100 output = 600 / 2 rounds), delta 200.
      expect(res.message).toContain('orch W/round 100 | 300  delta 200');
    });
  });

  it('usage schema and description add a sources option naming the transcript read (Req 1.9)', () => {
    const props = (harnessTool.inputSchema as any).properties;
    expect(props.sources).toEqual({ type: 'boolean' });
    expect(harnessTool.description).toContain(
      "Pass `sources: true` to also read each document and implementation orchestrator spawn's subagent "
      + 'transcript under `$CLAUDE_CONFIG_DIR/projects`, else `~/.claude/projects`, and print its W by context '
      + 'source. Without it the action reads only the spec store.',
    );
    expect(harnessTool.description).toContain('never spawns a process');
  });
});
