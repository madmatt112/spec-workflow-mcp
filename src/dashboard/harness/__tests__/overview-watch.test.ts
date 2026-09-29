import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp, writeFileSync, appendFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { buildOverviewRow, OverviewWatch } from '../overview-watch.js';
import { pointerPath, hudPath } from '../state-files.js';
import type { ProjectContext } from '../../project-manager.js';
import type { ProjectManager } from '../../project-manager.js';
import type { HarnessMessage, PointerLine } from '../types.js';

// Contract for src/dashboard/harness/overview-watch.ts (design.md C6; task 8
// _Prompt; Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.9).
//
// Criterion "running row" (task 8 _Prompt: "A row is running with the spec
//   (the spec dir's base name) and run id of a pointer line whose spec dir is
//   inside projectPath/.spec-workflow/specs/"; Req 5.2):
//   Pre-condition: a project whose projectPath is a temp dir; a PointerLine
//   whose specDir is <projectPath>/.spec-workflow/specs/my-spec and whose
//   runId is 'run-123'.
//   Test: buildOverviewRow(project, pointer).
//   Observable result: row.state === 'running', row.spec === 'my-spec',
//   row.runId === 'run-123'.
//   Expected-value source: the literal spec name and run id written into the
//   fixture pointer, per the _Prompt sentence.
//
// Criterion "idle row" (task 8 _Prompt: "else idle with the HANDOFF spec from
//   parseHandoffRouting (task 3) and a null run id"; Req 5.2):
//   Pre-condition: a project with a HANDOFF.md whose routing header names
//   active spec 'other-spec'; no pointer line (undefined).
//   Test: buildOverviewRow(project, undefined).
//   Observable result: row.state === 'idle', row.spec === 'other-spec',
//   row.runId === null.
//   Expected-value source: the literal spec name in the fixture HANDOFF
//   header, per the _Prompt sentence and Req 5.2's "no pointer line" clause.
//
// Criterion "lastRow: newest phase row, text is phase and result" (task 8
//   _Prompt: "lastRow is the newest phase.start, phase.end, or note ...; with
//   text the phase and result for a phase row"; Req 5.1):
//   Pre-condition: a ledger with a run.start, a phase.start, then a newest
//   phase.end with phase 'document' and result 'gate-a'.
//   Test: buildOverviewRow(project, pointer).
//   Observable result: row.lastRow deep-equals { ts: <the phase.end's ts>,
//   type: 'phase.end', text: 'document gate-a' }.
//   Expected-value source: the fixture's own phase/result values, combined
//   per the _Prompt sentence ("text the phase and result for a phase row").
//
// Criterion "lastRow skips a note that does not mention a gate" (task 8
//   _Prompt: "note whose text matches gate A or gate B (case-insensitive)";
//   Req 5.1's "gate-related ledger row"):
//   Pre-condition: a ledger whose newest row is a note with text 'Retro not
//   yet scheduled' (no gate mention), preceded by a note mentioning 'GATE A'
//   and, earlier still, a phase.end row.
//   Test: buildOverviewRow(project, pointer).
//   Observable result: row.lastRow deep-equals the gate-mentioning note ({
//   ts, type: 'note', text: 'Operator confirmed GATE A pass' }), not the
//   newer non-gate note.
//   Expected-value source: the fixture note text, per the _Prompt sentence
//   (only a note whose text matches gate A/B qualifies).
//
// Criterion "livePhase from buildModel" (task 8 _Prompt: "livePhase is the
//   buildModel live phase with no activity"; Req 5.1):
//   Pre-condition: a ledger with a run.start and an open phase.start (phase
//   'implementation') with no matching phase.end.
//   Test: buildOverviewRow(project, pointer).
//   Observable result: row.livePhase === 'implementation'.
//   Expected-value source: src/watch/ledger.ts:271-279 (buildModel's live-
//   phase rule: last phase.start with no later phase.end), per the _Prompt
//   sentence.
//
// Criterion "livePhase falls back to the HANDOFF phase" (task 8 _Prompt:
//   "else the HANDOFF phase"; Req 5.1):
//   Pre-condition: no harness-events.jsonl for the spec at all (buildModel
//   has no open phase); a HANDOFF whose live-phase line names phase
//   'closeout' for that same spec.
//   Test: buildOverviewRow(project, pointer).
//   Observable result: row.livePhase === 'closeout'.
//   Expected-value source: the fixture HANDOFF's phase field, per the
//   _Prompt sentence.
//
// Criterion "waiting holds" (task 8 _Prompt: "waiting holds when ... the
//   newest phase.end has result gate-a, retro-ready or escalate and no
//   phase.start follows it"; tasks D7; Req 5.3):
//   Pre-condition: a ledger whose newest row is a phase.end with result
//   'gate-a' and no later phase.start.
//   Test: buildOverviewRow(project, pointer).
//   Observable result: row.waiting === true.
//   Expected-value source: tasks.md D7 and the _Prompt sentence.
//
// Criterion "waiting clears" (same _Prompt sentence; tasks D7; Req 5.3):
//   Pre-condition: the same ledger as above, plus a later phase.start row
//   after the gate-a phase.end.
//   Test: buildOverviewRow(project, pointer).
//   Observable result: row.waiting === false.
//   Expected-value source: tasks.md D7 ("no phase.start follows it").
//
// Criterion "newestTs is the newest row's ts" (task 8 _Prompt: "newestTs is
//   the newest row's ts"; Req 5.1):
//   Pre-condition: a ledger whose newest row overall is a spawn.start (which
//   does not qualify as lastRow), later than the ledger's phase.end row.
//   Test: buildOverviewRow(project, pointer).
//   Observable result: row.newestTs equals the spawn.start row's ts, which
//   differs from row.lastRow's ts (the earlier phase.end).
//   Expected-value source: the fixture's own timestamps, per the _Prompt
//   sentence (newestTs over every row; lastRow only phase/gate rows).
//
// Criterion "pointer/idle mix across projects, one watcher set" (task 8
//   _Prompt Tests item 1; Req 5.2, 5.9):
//   Pre-condition: two stub projects behind one stub project manager (cast
//   through unknown); a shared pointer file naming only the first project's
//   spec dir; a HANDOFF for the second project naming its own spec.
//   Test: new OverviewWatch(stubManager, send).start(), then read the
//   captured overview-rows message.
//   Observable result: the row for project A has state 'running' and runId
//   'run-live-1'; the row for project B has state 'idle' and spec
//   'spec-idle'.
//   Expected-value source: the fixture pointer's run id and the fixture
//   HANDOFF's spec name.
//
// Criterion "a gate-a phase.end append marks waiting within five seconds,
//   and a later phase.start clears it" (task 8 _Prompt Tests item 2; Req
//   5.4; tasks D7):
//   Pre-condition: a started watch over a project the pointer names running.
//   Test: append a phase.end (result gate-a) to the ledger, poll captured
//   overview-rows for that project's waiting flag; then append a phase.start
//   and poll again.
//   Observable result: within five seconds a row with waiting === true
//   appears; within a further five seconds a row with waiting === false
//   appears.
//   Expected-value source: Req 5.4 ("within five seconds") and tasks D7.
//
// Criterion "HUD write pushes to-dos open first, file order" (task 8 _Prompt
//   Tests item 3; Req 5.5):
//   Pre-condition: a HUD file whose todos array holds one done item, then
//   two open items, in that file order.
//   Test: start the watch, read the captured overview-todos message.
//   Observable result: the todos array's ids are ['t-open-1', 't-open-2',
//   't-done'] — open items first, in their original file order.
//   Expected-value source: the fixture's own ids, reordered per the _Prompt
//   sentence ("open items first in file order").
//
// Criterion "HUD delete and bad JSON push an empty list" (task 8 _Prompt
//   Tests item 4; Req 5.7):
//   Pre-condition: a started watch that has already pushed a non-empty
//   to-do list from an existing HUD file.
//   Test: delete the HUD file, poll for an overview-todos push; then write
//   invalid JSON to the same path, poll for a further push.
//   Observable result: both pushes carry todos: [].
//   Expected-value source: Req 5.7 ("missing, unreadable ... an empty list").
//
// Criterion "a HUD created after start() when sdd did not exist is picked
//   up" (task 8 _Prompt Tests item 5; Req 5.6; tasks D9):
//   Pre-condition: a fresh XDG_STATE_HOME with no sdd subdirectory.
//   Test: new OverviewWatch(stubManager, send).start(), then write the HUD
//   file at hudPath() and poll for its content.
//   Observable result: right after start() the sdd directory exists; an
//   overview-todos push later carries the written todo's id.
//   Expected-value source: tasks D9 ("create the directories ... before it
//   watches") and Req 5.6.
//
// Criterion "snapshot() returns both messages" (design.md C6 interfaces:
//   "the snapshot emits both overview-rows and overview-todos"):
//   Pre-condition: a started watch over one project, with a HUD file
//   present.
//   Test: watch.snapshot().
//   Observable result: the returned array holds exactly one overview-rows
//   message (whose rows include the project) and exactly one overview-todos
//   message (whose todos match the fixture).
//   Expected-value source: design.md C6's snapshot() interface sentence.
//
// Criterion "close() stops further sends" (design.md C6 interfaces:
//   "close(): closes the watchers and timers"):
//   Pre-condition: a started watch that has sent at least one overview-rows
//   message.
//   Test: watch.close(), then append to the ledger and write the HUD file,
//   and wait past the debounce window.
//   Observable result: the captured message count is unchanged from
//   immediately after close().
//   Expected-value source: design.md C6's close() interface sentence.

function waitFor(predicate: () => boolean, timeoutMs = 5000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) { resolve(); return; }
      if (Date.now() > deadline) { reject(new Error('waitFor: timed out')); return; }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ofType<T extends HarnessMessage['type']>(
  messages: HarnessMessage[],
  type: T,
): Extract<HarnessMessage, { type: T }>[] {
  return messages.filter((m): m is Extract<HarnessMessage, { type: T }> => m.type === type);
}

function handoffFixture(spec: string, phase = 'document', state = 'in-progress', result = 'gate-a'): string {
  return [
    `> **READ FIRST — SDD routing.** Active spec **\`${spec}\`**.`,
    `> Live phase **${phase}**, state **${state}**, last result **${result}**.`,
  ].join('\n');
}

async function makeProject(base: string, spec: string, name = spec): Promise<{ project: ProjectContext; workflowRoot: string; specDir: string }> {
  const projectPath = await fsp.mkdtemp(join(base, 'proj-'));
  const workflowRoot = join(projectPath, '.spec-workflow');
  const specDir = join(workflowRoot, 'specs', spec);
  mkdirSync(specDir, { recursive: true });
  const project = { projectId: randomUUID(), projectName: name, projectPath, workspacePath: projectPath } as ProjectContext;
  return { project, workflowRoot, specDir };
}

function pointerFor(project: ProjectContext, spec: string, runId: string): PointerLine {
  return { mainCheckout: '/main/checkout', specDir: join(project.projectPath, '.spec-workflow', 'specs', spec), runId };
}

function writeLedger(specDir: string, events: Record<string, string>[]): string {
  const path = join(specDir, 'harness-events.jsonl');
  writeFileSync(path, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return path;
}

describe('buildOverviewRow', () => {
  let base: string;

  beforeEach(async () => {
    base = await fsp.mkdtemp(join(tmpdir(), 'overview-row-test-'));
  });

  afterEach(async () => {
    await fsp.rm(base, { recursive: true, force: true });
  });

  it('marks a project running with the spec dir base name and run id when the pointer specDir is inside its specs directory', async () => {
    const { project } = await makeProject(base, 'my-spec');
    const pointer = pointerFor(project, 'my-spec', 'run-123');

    const row = buildOverviewRow(project, pointer);

    expect(row.state).toBe('running');
    expect(row.spec).toBe('my-spec');
    expect(row.runId).toBe('run-123');
  });

  it('marks a project idle with the HANDOFF spec and a null run id when there is no pointer line', async () => {
    const { project, workflowRoot } = await makeProject(base, 'unused-spec');
    writeFileSync(join(workflowRoot, 'HANDOFF.md'), handoffFixture('other-spec', 'design', 'in-progress', 'converged'));

    const row = buildOverviewRow(project, undefined);

    expect(row.state).toBe('idle');
    expect(row.spec).toBe('other-spec');
    expect(row.runId).toBeNull();
  });

  it('sets lastRow to the newest phase row with text as "<phase> <result>"', async () => {
    const { project, specDir } = await makeProject(base, 'spec-lr1');
    const pointer = pointerFor(project, 'spec-lr1', 'run-1');
    writeLedger(specDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-1', spec: 'spec-lr1' },
      { ts: '2026-01-01T00:00:05.000Z', type: 'phase.start', run: 'run-1', phase: 'document', mode: 'auto', state: 'v1' },
      { ts: '2026-01-01T00:00:10.000Z', type: 'phase.end', run: 'run-1', phase: 'document', result: 'gate-a', state: 'v1', note: 'ready' },
    ]);

    const row = buildOverviewRow(project, pointer);

    expect(row.lastRow).toEqual({ ts: '2026-01-01T00:00:10.000Z', type: 'phase.end', text: 'document gate-a' });
  });

  it('sets lastRow to the newest note whose text mentions a gate, case-insensitively, skipping a newer non-gate note', async () => {
    const { project, specDir } = await makeProject(base, 'spec-lr2');
    const pointer = pointerFor(project, 'spec-lr2', 'run-2');
    writeLedger(specDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-2', spec: 'spec-lr2' },
      { ts: '2026-01-01T00:00:05.000Z', type: 'phase.end', run: 'run-2', phase: 'design', result: 'converged', state: 'v1' },
      { ts: '2026-01-01T00:00:10.000Z', type: 'note', run: 'run-2', text: 'Operator confirmed GATE A pass' },
      { ts: '2026-01-01T00:00:15.000Z', type: 'note', run: 'run-2', text: 'Retro not yet scheduled' },
    ]);

    const row = buildOverviewRow(project, pointer);

    expect(row.lastRow).toEqual({ ts: '2026-01-01T00:00:10.000Z', type: 'note', text: 'Operator confirmed GATE A pass' });
  });

  it("sets livePhase from buildModel's live phase when the ledger has an open phase", async () => {
    const { project, specDir } = await makeProject(base, 'spec-lp1');
    const pointer = pointerFor(project, 'spec-lp1', 'run-3');
    writeLedger(specDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-3', spec: 'spec-lp1' },
      { ts: '2026-01-01T00:00:05.000Z', type: 'phase.start', run: 'run-3', phase: 'implementation', mode: 'auto', state: 'v1' },
    ]);

    const row = buildOverviewRow(project, pointer);

    expect(row.livePhase).toBe('implementation');
  });

  it('falls back to the HANDOFF live phase when the ledger has no open phase', async () => {
    const { project, workflowRoot } = await makeProject(base, 'spec-lp2');
    const pointer = pointerFor(project, 'spec-lp2', 'run-4');
    writeFileSync(join(workflowRoot, 'HANDOFF.md'), handoffFixture('spec-lp2', 'closeout', 'in-progress', 'pass'));

    const row = buildOverviewRow(project, pointer);

    expect(row.livePhase).toBe('closeout');
  });

  it('marks waiting true when the newest phase.end result is gate-a and no later phase.start follows', async () => {
    const { project, specDir } = await makeProject(base, 'spec-w1');
    const pointer = pointerFor(project, 'spec-w1', 'run-5');
    writeLedger(specDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-5', spec: 'spec-w1' },
      { ts: '2026-01-01T00:00:05.000Z', type: 'phase.start', run: 'run-5', phase: 'document', mode: 'auto', state: 'v1' },
      { ts: '2026-01-01T00:00:10.000Z', type: 'phase.end', run: 'run-5', phase: 'document', result: 'gate-a', state: 'v1' },
    ]);

    const row = buildOverviewRow(project, pointer);

    expect(row.waiting).toBe(true);
  });

  it('clears waiting once a later phase.start follows the gate-a phase.end', async () => {
    const { project, specDir } = await makeProject(base, 'spec-w2');
    const pointer = pointerFor(project, 'spec-w2', 'run-6');
    writeLedger(specDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-6', spec: 'spec-w2' },
      { ts: '2026-01-01T00:00:05.000Z', type: 'phase.start', run: 'run-6', phase: 'document', mode: 'auto', state: 'v1' },
      { ts: '2026-01-01T00:00:10.000Z', type: 'phase.end', run: 'run-6', phase: 'document', result: 'gate-a', state: 'v1' },
      { ts: '2026-01-01T00:00:15.000Z', type: 'phase.start', run: 'run-6', phase: 'implementation', mode: 'auto', state: 'v1' },
    ]);

    const row = buildOverviewRow(project, pointer);

    expect(row.waiting).toBe(false);
  });

  it("sets newestTs to the newest row's ts even when that row is not the lastRow", async () => {
    const { project, specDir } = await makeProject(base, 'spec-nt');
    const pointer = pointerFor(project, 'spec-nt', 'run-7');
    writeLedger(specDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-7', spec: 'spec-nt' },
      { ts: '2026-01-01T00:00:05.000Z', type: 'phase.end', run: 'run-7', phase: 'design', result: 'converged', state: 'v1' },
      { ts: '2026-01-01T00:00:10.000Z', type: 'spawn.start', run: 'run-7', agent: 'sdd-reviewer', role: 'review' },
    ]);

    const row = buildOverviewRow(project, pointer);

    expect(row.newestTs).toBe('2026-01-01T00:00:10.000Z');
    expect(row.lastRow?.ts).toBe('2026-01-01T00:00:05.000Z');
  });
});

describe('OverviewWatch', () => {
  let base: string;
  let xdgBase: string;
  let prevXdg: string | undefined;
  const watches: { close: () => void }[] = [];

  beforeEach(async () => {
    base = await fsp.mkdtemp(join(tmpdir(), 'overview-watch-test-'));
    xdgBase = await fsp.mkdtemp(join(tmpdir(), 'overview-watch-xdg-'));
    prevXdg = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = xdgBase;
  });

  afterEach(async () => {
    for (const w of watches.splice(0)) {
      try { w.close(); } catch { /* already closed */ }
    }
    if (prevXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = prevXdg;
    await fsp.rm(base, { recursive: true, force: true });
    await fsp.rm(xdgBase, { recursive: true, force: true });
  });

  it('shows one project running with its pointer run id and the other idle with its HANDOFF spec', async () => {
    const { project: projectA, workflowRoot: rootA } = await makeProject(base, 'spec-run', 'Project A');
    const { project: projectB, workflowRoot: rootB } = await makeProject(base, 'spec-idle', 'Project B');
    writeFileSync(join(rootB, 'HANDOFF.md'), handoffFixture('spec-idle', 'design', 'in-progress', 'converged'));

    mkdirSync(join(xdgBase, 'sdd'), { recursive: true });
    writeFileSync(pointerPath(), `/main/checkout\t${join(rootA, 'specs', 'spec-run')}\trun-live-1\n`);

    const messages: HarnessMessage[] = [];
    const stubManager = { getAllProjects: () => [projectA, projectB] } as unknown as ProjectManager;
    const watch = new OverviewWatch(stubManager, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);

    await watch.start();
    await waitFor(() => ofType(messages, 'overview-rows').length > 0);

    const rows = ofType(messages, 'overview-rows').slice(-1)[0].data.rows;
    const rowA = rows.find((r) => r.projectId === projectA.projectId);
    const rowB = rows.find((r) => r.projectId === projectB.projectId);

    expect(rowA?.state).toBe('running');
    expect(rowA?.runId).toBe('run-live-1');
    expect(rowB?.state).toBe('idle');
    expect(rowB?.spec).toBe('spec-idle');
  }, 15000);

  it('shows a project waiting within five seconds of a gate-a phase.end append, then clears it on a later phase.start', async () => {
    const { project, specDir } = await makeProject(base, 'spec-wait', 'Project W');
    const runId = 'run-wait';
    mkdirSync(join(xdgBase, 'sdd'), { recursive: true });
    writeFileSync(pointerPath(), `/main/checkout\t${specDir}\t${runId}\n`);
    const ledgerPath = writeLedger(specDir, [
      { ts: new Date(Date.now() - 60000).toISOString(), type: 'run.start', run: runId, spec: 'spec-wait' },
      { ts: new Date(Date.now() - 50000).toISOString(), type: 'phase.start', run: runId, phase: 'document', mode: 'auto', state: 'v1' },
    ]);

    const messages: HarnessMessage[] = [];
    const stubManager = { getAllProjects: () => [project] } as unknown as ProjectManager;
    const watch = new OverviewWatch(stubManager, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);
    await watch.start();
    await waitFor(() => ofType(messages, 'overview-rows').length > 0);

    appendFileSync(ledgerPath, JSON.stringify({ ts: new Date().toISOString(), type: 'phase.end', run: runId, phase: 'document', result: 'gate-a', state: 'v1' }) + '\n');
    await waitFor(() => {
      const latest = ofType(messages, 'overview-rows').slice(-1)[0];
      return latest?.data.rows.find((r) => r.projectId === project.projectId)?.waiting === true;
    }, 5000);

    appendFileSync(ledgerPath, JSON.stringify({ ts: new Date().toISOString(), type: 'phase.start', run: runId, phase: 'implementation', mode: 'auto', state: 'v1' }) + '\n');
    await waitFor(() => {
      const latest = ofType(messages, 'overview-rows').slice(-1)[0];
      return latest?.data.rows.find((r) => r.projectId === project.projectId)?.waiting === false;
    }, 5000);
  }, 20000);

  it('pushes the HUD todos with open items first in file order', async () => {
    const { project } = await makeProject(base, 'spec-hud1', 'Project H1');
    mkdirSync(join(xdgBase, 'sdd'), { recursive: true });
    writeFileSync(hudPath(), JSON.stringify({
      todos: [
        { id: 't-done', title: 'Done item', owner: 'a', blocks: '', note: '', since: '2026-01-01', done: true, priority: 'low' },
        { id: 't-open-1', title: 'Open item one', owner: 'a', blocks: '', note: '', since: '2026-01-01', done: false, priority: 'high' },
        { id: 't-open-2', title: 'Open item two', owner: 'a', blocks: '', note: '', since: '2026-01-02', done: false, priority: 'low' },
      ],
    }));

    const messages: HarnessMessage[] = [];
    const stubManager = { getAllProjects: () => [project] } as unknown as ProjectManager;
    const watch = new OverviewWatch(stubManager, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);

    await watch.start();
    await waitFor(() => ofType(messages, 'overview-todos').length > 0);

    const todos = ofType(messages, 'overview-todos').slice(-1)[0].data.todos;
    expect(todos.map((t) => t.id)).toEqual(['t-open-1', 't-open-2', 't-done']);
  }, 15000);

  it('pushes an empty todos list when the HUD file is deleted, and again when it holds invalid JSON', async () => {
    const { project } = await makeProject(base, 'spec-hud2', 'Project H2');
    mkdirSync(join(xdgBase, 'sdd'), { recursive: true });
    writeFileSync(hudPath(), JSON.stringify({ todos: [{ id: 't1', title: 'x', owner: '', blocks: '', note: '', since: '', done: false, priority: '' }] }));

    const messages: HarnessMessage[] = [];
    const stubManager = { getAllProjects: () => [project] } as unknown as ProjectManager;
    const watch = new OverviewWatch(stubManager, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);
    await watch.start();
    await waitFor(() => {
      const latest = ofType(messages, 'overview-todos').slice(-1)[0];
      return !!latest && latest.data.todos.length > 0;
    });

    unlinkSync(hudPath());
    await waitFor(() => {
      const latest = ofType(messages, 'overview-todos').slice(-1)[0];
      return latest.data.todos.length === 0;
    }, 5000);

    writeFileSync(hudPath(), '{ not valid json');
    const beforeBad = ofType(messages, 'overview-todos').length;
    await waitFor(() => ofType(messages, 'overview-todos').length > beforeBad, 5000);
    expect(ofType(messages, 'overview-todos').slice(-1)[0].data.todos).toEqual([]);
  }, 20000);

  it('picks up a HUD file created after start() when the sdd directory did not exist yet', async () => {
    const { project } = await makeProject(base, 'spec-hud3', 'Project H3');
    expect(existsSync(join(xdgBase, 'sdd'))).toBe(false);

    const messages: HarnessMessage[] = [];
    const stubManager = { getAllProjects: () => [project] } as unknown as ProjectManager;
    const watch = new OverviewWatch(stubManager, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);
    await watch.start();

    expect(existsSync(join(xdgBase, 'sdd'))).toBe(true);

    writeFileSync(hudPath(), JSON.stringify({ todos: [{ id: 't-new', title: 'New', owner: '', blocks: '', note: '', since: '', done: false, priority: '' }] }));

    await waitFor(() => {
      const latest = ofType(messages, 'overview-todos').slice(-1)[0];
      return !!latest && latest.data.todos.some((t) => t.id === 't-new');
    }, 5000);
  }, 15000);

  it('snapshot() returns one overview-rows and one overview-todos message reflecting current state', async () => {
    const { project } = await makeProject(base, 'spec-snap', 'Project S');
    mkdirSync(join(xdgBase, 'sdd'), { recursive: true });
    writeFileSync(hudPath(), JSON.stringify({ todos: [{ id: 't-s', title: 'S', owner: '', blocks: '', note: '', since: '', done: false, priority: '' }] }));

    const stubManager = { getAllProjects: () => [project] } as unknown as ProjectManager;
    const watch = new OverviewWatch(stubManager, () => {}, { debounceMs: 50 });
    watches.push(watch);
    await watch.start();
    await sleep(200);

    const snap = watch.snapshot();

    expect(ofType(snap, 'overview-rows').length).toBe(1);
    expect(ofType(snap, 'overview-todos').length).toBe(1);
    expect(ofType(snap, 'overview-rows')[0].data.rows.some((r) => r.projectId === project.projectId)).toBe(true);
    expect(ofType(snap, 'overview-todos')[0].data.todos.map((t) => t.id)).toEqual(['t-s']);
  }, 15000);

  it('sends nothing further after close()', async () => {
    const { project, specDir } = await makeProject(base, 'spec-close', 'Project C');
    const runId = 'run-close';
    const ledgerPath = writeLedger(specDir, [
      { ts: new Date(Date.now() - 60000).toISOString(), type: 'run.start', run: runId, spec: 'spec-close' },
    ]);
    mkdirSync(join(xdgBase, 'sdd'), { recursive: true });
    writeFileSync(pointerPath(), `/main/checkout\t${specDir}\t${runId}\n`);

    const messages: HarnessMessage[] = [];
    const stubManager = { getAllProjects: () => [project] } as unknown as ProjectManager;
    const watch = new OverviewWatch(stubManager, (m) => messages.push(m), { debounceMs: 50 });
    await watch.start();
    await waitFor(() => ofType(messages, 'overview-rows').length > 0);

    watch.close();
    const countAfterClose = messages.length;

    appendFileSync(ledgerPath, JSON.stringify({ ts: new Date().toISOString(), type: 'phase.start', run: runId, phase: 'document', mode: 'auto', state: 'v1' }) + '\n');
    writeFileSync(hudPath(), JSON.stringify({ todos: [] }));
    await sleep(600);

    expect(messages.length).toBe(countAfterClose);
  }, 15000);
});
