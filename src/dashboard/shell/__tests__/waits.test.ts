import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, statSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { gateOrRuling, deriveProjectWaits, orderWaits } from '../waits.js';
import type { Wait } from '../types.js';
import type { LedgerEvent } from '../../../watch/ledger.js';
import type { ProjectContext } from '../../project-manager.js';
import type { LaunchRecord, PointerLine } from '../../harness/types.js';

// Contract for src/dashboard/shell/waits.ts (design.md C3; task 2 _Prompt;
// Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8, 2.10, 2.11, 3.6).
//
// === gateOrRuling (pure) ===
//
// Criterion "gate A and gate B hold" (design.md C3: "the newest phase.end
//   with result gate-a/gate-b gives gate ... only with no later phase.start
//   of that run"; Req 2.1):
//   Pre-condition: a ledger with one run.start and a phase.end whose result
//   is 'gate-a' (resp. 'gate-b') and no later phase.start.
//   Test: gateOrRuling(ledger).
//   Observable result: { kind: 'gate', row: <that phase.end event> } for
//   both the gate-a and the gate-b fixture.
//   Expected-value source: design.md C3's gateOrRuling sentence; the row
//   identity is the fixture's own phase.end object.
//
// Criterion "a later phase.start clears" (design.md C3, same sentence,
//   "only with no later phase.start of that run"; Req 2.1):
//   Pre-condition: the gate-a ledger above plus one more phase.start row
//   after the gate-a phase.end, same run.
//   Test: gateOrRuling(ledger).
//   Observable result: null.
//   Expected-value source: the design sentence's "no later phase.start"
//   clause.
//
// Criterion "a gate row of an earlier run gives nothing" (design.md C3:
//   "scopes to the last run.start's rows as buildModel does", citing
//   src/watch/ledger.ts:256-261; Req 2.1):
//   Pre-condition: a ledger with run r1 ending on a gate-a phase.end, then a
//   second run.start (run r2) and a phase.start of r2 with no phase.end.
//   Test: gateOrRuling(ledger).
//   Observable result: null (r2's rows hold no phase.end at all).
//   Expected-value source: src/watch/ledger.ts:256-261's current-run scoping
//   rule, applied per the design sentence.
//
// Criterion "escalate gives ruling" (design.md C3: "escalate gives ruling";
//   Req 2.2):
//   Pre-condition: a ledger whose newest phase.end has result 'escalate' and
//   no later phase.start.
//   Test: gateOrRuling(ledger).
//   Observable result: { kind: 'ruling', row: <that phase.end event> }.
//   Expected-value source: design.md C3's gateOrRuling sentence.
//
// === deriveProjectWaits ===
//
// Criterion "gate wait detail" (task 2 _Prompt: "detail gate A or B, items
//   from the spec's gate-a.json or gate-b.json items array (null when
//   missing or unparsable), questions from parseGateSections for that gate;
//   since is the row ts"; Req 2.1, 3.6):
//   Pre-condition: a project with a pointer naming a spec whose ledger ends
//   on an un-followed gate-a phase.end, a gate-a.json holding one items
//   entry, and a questions.md with a '## Gate A' section. A second spec
//   whose ledger ends on an un-followed gate-b phase.end, an unparsable
//   gate-b.json, and a '## Gate B' questions.md section.
//   Test: deriveProjectWaits(project, pointer, null, now) for each spec's
//   pointer.
//   Observable result: a Wait with kind 'gate', spec the fixture spec name,
//   since the phase.end's ts, and detail { kind:'gate', gate:'A', items:
//   <the gate-a.json items array>, questions: <the Gate A section text> }
//   for the first; detail.gate 'B', items null (unparsable JSON), questions
//   <the Gate B section text> for the second.
//   Expected-value source: the fixture's own ts, gate-a.json/gate-b.json and
//   questions.md content, combined per the _Prompt sentence; design.md C3
//   also folds Req 3.6 (the Now panel's gate detail is this same object).
//
// Criterion "ruling wait detail" (task 2 _Prompt: "detail phase, state and
//   note of the row"; Req 2.2, 3.6):
//   Pre-condition: a project with a pointer naming a spec whose ledger ends
//   on an un-followed escalate phase.end with phase 'implementation', state
//   'blocked' and note 'needs human ruling'.
//   Test: deriveProjectWaits(project, pointer, null, now).
//   Observable result: a Wait with kind 'ruling', spec the fixture spec
//   name, since the phase.end's ts, detail { kind:'ruling',
//   phase:'implementation', state:'blocked', note:'needs human ruling' }.
//   Expected-value source: the fixture row's own phase/state/note fields.
//
// Criterion "retro: absent, DRAFT, APPROVED and CLOSED plans, the count,
//   and every spec directory" (task 2 _Prompt: "for every directory under
//   specs/, retrospective-proposals.md exists and retrospective-plan.md is
//   absent or its first Status: value starts with DRAFT ... detail count
//   and lines are the trimmed lines matching DECISION NEEDED: yes; since is
//   the proposals file's mtime"; Req 2.3, 2.7, 3.6):
//   Pre-condition: one project with four sibling spec directories: one with
//   proposals.md (two 'DECISION NEEDED: yes' lines, one 'no') and no plan;
//   one with proposals.md (one 'yes' line) and a DRAFT plan; one with
//   proposals.md and an APPROVED plan; one with proposals.md and a CLOSED
//   plan.
//   Test: one deriveProjectWaits(project, undefined, null, now) call.
//   Observable result: retro Waits exist for the absent-plan and DRAFT-plan
//   directories only (spec names matching those directories), each with
//   since the proposals file's actual mtime (ISO) and detail.count/lines
//   matching the fixture's own 'yes' lines (2 and ['...','...'] for the
//   first, 1 and [the single line] for the second); no retro Wait names the
//   APPROVED- or CLOSED-plan directories.
//   Expected-value source: the fixtures' own proposal line counts/text and
//   actual on-disk mtimes, per the _Prompt sentence; one call over four
//   directories also exercises Req 2.7's "every spec directory" clause,
//   folded into this same test (no separate test covers 2.7's retro
//   clause).
//
// Criterion "exited: null run id, run id with no run.end, run id with
//   run.end" (task 2 _Prompt: "launch.state is exited and launch.runId is
//   null or no run.end row of that run is in
//   specs/<launch.spec>/harness-events.jsonl; detail exit code, signal,
//   endedAt and logPath; since is endedAt, else launchedAt"; Req 2.4, 3.6):
//   Pre-condition: a launch record with state 'exited', runId null, endedAt
//   null (no spec directory at all); a second launch record naming a spec
//   whose ledger has a run.start of the launch's runId but no run.end,
//   endedAt set; a third launch record naming a spec whose ledger has both
//   a run.start and a run.end of the launch's runId.
//   Test: deriveProjectWaits(project, undefined, launch, now) for each.
//   Observable result: an exited Wait for the first (since the launchedAt
//   fallback, detail exitCode/signal/endedAt/logPath from the record) and
//   the second (since the endedAt value, detail from that record); no
//   exited Wait for the third.
//   Expected-value source: the fixture launch records' own fields, per the
//   _Prompt sentence's since/detail rule.
//
// Criterion "quiet: 14 and 16 minutes, without an open spawn, without a
//   pointer" (task 2 _Prompt: "a pointer exists, buildModel(...) has a
//   spawn with no endedAt, and the spec's harness-activity.jsonl mtime is
//   more than 15 minutes before now ... detail agent of the newest open
//   spawn, lastTool of that agent's newest tool row, lastActivityAt the
//   mtime as ISO; since is the same mtime"; Req 2.5, 3.6):
//   Pre-condition: a project with a pointer naming a spec whose ledger has
//   an open spawn.start (no spawn.end) and an activity file with 'tool'
//   rows, its mtime forced 14 minutes, then 16 minutes, before a fixed
//   `now`; a variant whose ledger instead pairs the spawn.start with a
//   spawn.end (closed) at 16 minutes old; a variant with the 16-minute-old
//   open-spawn spec resolved only through a HANDOFF routing header (no
//   pointer).
//   Test: deriveProjectWaits(project, pointer-or-undefined, null, now).
//   Observable result: no quiet Wait at 14 minutes; a quiet Wait at 16
//   minutes with since and detail.lastActivityAt equal to the activity
//   file's actual mtime (ISO), detail.agent the open spawn's agent, and
//   detail.lastTool the newest 'tool' row's tool field; no quiet Wait
//   without an open spawn; no quiet Wait without a pointer line.
//   Expected-value source: the fixture's own agent name and tool rows, and
//   the activity file's actual on-disk mtime, per the _Prompt sentence.
//
// Criterion "a missing, an empty and a torn ledger give no wait and do not
//   throw" (Req 2.10: "IF a file the derivation reads is missing, empty or
//   holds a torn line THEN the system SHALL derive no wait from it and
//   SHALL raise no error"; the torn-line skip of src/watch/ledger.ts:186-
//   199):
//   Pre-condition: three specs pointed at in turn: one whose directory has
//   no harness-events.jsonl at all; one whose harness-events.jsonl is zero
//   bytes; one whose harness-events.jsonl holds a well-formed phase.start
//   line followed by a truncated, non-JSON phase.end line (no trailing
//   newline) that would otherwise have been a gate-a result.
//   Test: deriveProjectWaits(project, pointer, null, now) for each.
//   Observable result: none throws; none produces a gate, ruling or quiet
//   Wait for that spec.
//   Expected-value source: Req 2.10 and the parseJsonl torn-line skip it
//   cites.
//
// === orderWaits ===
//
// Criterion "orders by kind, then since ascending" (design.md C3:
//   "kinds gate, ruling, retro, exited, quiet, then since ascending"; Req
//   2.8):
//   Pre-condition: six Wait fixtures in scrambled input order: two of kind
//   'gate' at different since values, one each of 'ruling', 'retro',
//   'exited' and 'quiet', with since values that would NOT already sort
//   this way by since alone.
//   Test: orderWaits(waits).
//   Observable result: the returned array's spec sequence is
//   ['gate-early','gate-late','ruling','retro','exited','quiet'] — kind
//   order first, then the two gates ordered oldest-since first.
//   Expected-value source: design.md C3's orderWaits sentence.

function tmpBase(): string {
  return mkdtempSync(join(tmpdir(), 'sdd-waits-test-'));
}

function makeProject(base: string, name = 'Project One'): { project: ProjectContext; workflowRoot: string; specsDir: string } {
  const projectPath = mkdtempSync(join(base, 'proj-'));
  const workflowRoot = join(projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');
  mkdirSync(specsDir, { recursive: true });
  const project = { projectId: randomUUID(), projectName: name, projectPath, workspacePath: projectPath } as ProjectContext;
  return { project, workflowRoot, specsDir };
}

function makeSpecDir(specsDir: string, spec: string): string {
  const dir = join(specsDir, spec);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function pointerFor(project: ProjectContext, spec: string, runId = 'run-1'): PointerLine {
  return { mainCheckout: '/main/checkout', specDir: join(project.projectPath, '.spec-workflow', 'specs', spec), runId };
}

function writeLedger(specDir: string, events: LedgerEvent[]): string {
  const path = join(specDir, 'harness-events.jsonl');
  writeFileSync(path, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return path;
}

function mtimeIso(path: string): string {
  return new Date(statSync(path).mtimeMs).toISOString();
}

function handoffFixture(spec: string): string {
  return [
    `> **READ FIRST — SDD routing.** Active spec **\`${spec}\`**.`,
    `> Live phase **implementation**, state **in-progress**, last result **pending**.`,
  ].join('\n');
}

function baseLaunch(overrides: Partial<LaunchRecord>): LaunchRecord {
  return {
    projectId: 'p1', workflowRoot: '/wf', spec: 'spec', pid: 111, pgid: 111, cwd: '/wf', worktree: 'no',
    logPath: '/tmp/log.log', launchedAt: '2026-01-01T00:00:00.000Z', setupWrittenAt: '2026-01-01T00:00:00.000Z',
    runId: null, state: 'exited', exitCode: null, signal: null, stopRequestedAt: null, endedAt: null, note: null,
    ...overrides,
  };
}

describe('gateOrRuling', () => {
  it('gives a gate result for a trailing gate-a phase.end and for a trailing gate-b phase.end', () => {
    const gateA: LedgerEvent[] = [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'document' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'phase.end', run: 'r1', phase: 'document', result: 'gate-a' },
    ];
    expect(gateOrRuling(gateA)).toEqual({ kind: 'gate', row: gateA[2] });

    const gateB: LedgerEvent[] = [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'tasks' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'phase.end', run: 'r1', phase: 'tasks', result: 'gate-b' },
    ];
    expect(gateOrRuling(gateB)).toEqual({ kind: 'gate', row: gateB[2] });
  });

  it('gives null once a later phase.start of the same run follows the gate-a phase.end', () => {
    const ledger: LedgerEvent[] = [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'document' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'phase.end', run: 'r1', phase: 'document', result: 'gate-a' },
      { ts: '2026-01-01T00:03:00.000Z', type: 'phase.start', run: 'r1', phase: 'implementation' },
    ];
    expect(gateOrRuling(ledger)).toBeNull();
  });

  it('gives null for a gate-a phase.end that belongs to an earlier run than the last run.start', () => {
    const ledger: LedgerEvent[] = [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.end', run: 'r1', phase: 'document', result: 'gate-a' },
      { ts: '2026-01-02T00:00:00.000Z', type: 'run.start', run: 'r2' },
      { ts: '2026-01-02T00:01:00.000Z', type: 'phase.start', run: 'r2', phase: 'implementation' },
    ];
    expect(gateOrRuling(ledger)).toBeNull();
  });

  it('gives a ruling result for a trailing escalate phase.end', () => {
    const ledger: LedgerEvent[] = [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'implementation' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'phase.end', run: 'r1', phase: 'implementation', result: 'escalate', state: 'blocked', note: 'needs human ruling' },
    ];
    expect(gateOrRuling(ledger)).toEqual({ kind: 'ruling', row: ledger[2] });
  });
});

describe('deriveProjectWaits', () => {
  let base: string;

  beforeEach(() => { base = tmpBase(); });
  afterEach(() => { rmSync(base, { recursive: true, force: true }); });

  it('derives a gate wait naming gate A with its items and questions, and gate B with null items from unparsable JSON', () => {
    const { project, specsDir } = makeProject(base);

    const dirA = makeSpecDir(specsDir, 'gate-a-spec');
    const endA = '2026-01-01T00:02:00.000Z';
    writeLedger(dirA, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'document' },
      { ts: endA, type: 'phase.end', run: 'r1', phase: 'document', result: 'gate-a' },
    ]);
    writeFileSync(join(dirA, 'gate-a.json'), JSON.stringify({ items: [{ header: 'H', question: 'Q?', options: ['opt1', 'opt2'] }] }));
    writeFileSync(join(dirA, 'questions.md'), '## Gate A\nSome question text\n');

    const waitsA = deriveProjectWaits(project, pointerFor(project, 'gate-a-spec'), null, Date.now());
    const gateA = waitsA.find((w) => w.kind === 'gate');
    expect(gateA?.spec).toBe('gate-a-spec');
    expect(gateA?.since).toBe(endA);
    expect(gateA?.detail).toEqual({ kind: 'gate', gate: 'A', items: [{ header: 'H', question: 'Q?', options: ['opt1', 'opt2'] }], questions: 'Some question text' });
    expect(gateA?.summary.length).toBeGreaterThan(0);

    const dirB = makeSpecDir(specsDir, 'gate-b-spec');
    const endB = '2026-01-01T00:02:00.000Z';
    writeLedger(dirB, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'tasks' },
      { ts: endB, type: 'phase.end', run: 'r1', phase: 'tasks', result: 'gate-b' },
    ]);
    writeFileSync(join(dirB, 'gate-b.json'), '{ not valid json');
    writeFileSync(join(dirB, 'questions.md'), '## Gate B\nB text\n');

    const waitsB = deriveProjectWaits(project, pointerFor(project, 'gate-b-spec'), null, Date.now());
    const gateB = waitsB.find((w) => w.kind === 'gate');
    expect(gateB?.spec).toBe('gate-b-spec');
    expect(gateB?.since).toBe(endB);
    expect(gateB?.detail).toEqual({ kind: 'gate', gate: 'B', items: null, questions: 'B text' });
  });

  it('derives a ruling wait with the phase, state and note of the escalate row', () => {
    const { project, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'ruling-spec');
    const end = '2026-01-01T00:02:00.000Z';
    writeLedger(dir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'implementation' },
      { ts: end, type: 'phase.end', run: 'r1', phase: 'implementation', result: 'escalate', state: 'blocked', note: 'needs human ruling' },
    ]);

    const waits = deriveProjectWaits(project, pointerFor(project, 'ruling-spec'), null, Date.now());
    const ruling = waits.find((w) => w.kind === 'ruling');
    expect(ruling?.spec).toBe('ruling-spec');
    expect(ruling?.since).toBe(end);
    expect(ruling?.detail).toEqual({ kind: 'ruling', phase: 'implementation', state: 'blocked', note: 'needs human ruling' });
    expect(ruling?.summary.length).toBeGreaterThan(0);
  });

  it('derives a retro wait only for a directory whose plan is absent or DRAFT, across every spec directory, with the DECISION NEEDED: yes count', () => {
    const { project, specsDir } = makeProject(base);

    const absentDir = makeSpecDir(specsDir, 'retro-absent');
    writeFileSync(join(absentDir, 'retrospective-proposals.md'), [
      '## Finding 1', 'Some analysis text here.', 'DECISION NEEDED: yes — pick between A and B.', '',
      '## Finding 2', 'Some other analysis.', 'DECISION NEEDED: no.', '',
      '## Finding 3', 'Third analysis text.', '  DECISION NEEDED: yes — pick between C and D.',
    ].join('\n'));

    const draftDir = makeSpecDir(specsDir, 'retro-draft');
    writeFileSync(join(draftDir, 'retrospective-proposals.md'), [
      '## Finding 1', 'Only finding.', 'DECISION NEEDED: yes — pick one.',
    ].join('\n'));
    writeFileSync(join(draftDir, 'retrospective-plan.md'), 'Status: DRAFT — decisions needed\n\nOpen questions...\n');

    const approvedDir = makeSpecDir(specsDir, 'retro-approved');
    writeFileSync(join(approvedDir, 'retrospective-proposals.md'), '## Finding 1\nDECISION NEEDED: yes — moot.\n');
    writeFileSync(join(approvedDir, 'retrospective-plan.md'), 'Status: APPROVED\n\n## Approved proposals\n');

    const closedDir = makeSpecDir(specsDir, 'retro-closed');
    writeFileSync(join(closedDir, 'retrospective-proposals.md'), '## Finding 1\nDECISION NEEDED: yes — moot.\n');
    writeFileSync(join(closedDir, 'retrospective-plan.md'), 'Status: CLOSED\n');

    const waits = deriveProjectWaits(project, undefined, null, Date.now());
    const retroWaits = waits.filter((w) => w.kind === 'retro');
    expect(retroWaits.map((w) => w.spec).sort()).toEqual(['retro-absent', 'retro-draft']);

    const absentWait = retroWaits.find((w) => w.spec === 'retro-absent');
    expect(absentWait?.since).toBe(mtimeIso(join(absentDir, 'retrospective-proposals.md')));
    expect(absentWait?.detail).toEqual({
      kind: 'retro',
      count: 2,
      lines: ['DECISION NEEDED: yes — pick between A and B.', 'DECISION NEEDED: yes — pick between C and D.'],
    });

    const draftWait = retroWaits.find((w) => w.spec === 'retro-draft');
    expect(draftWait?.since).toBe(mtimeIso(join(draftDir, 'retrospective-proposals.md')));
    expect(draftWait?.detail).toEqual({ kind: 'retro', count: 1, lines: ['DECISION NEEDED: yes — pick one.'] });
  });

  it('derives an exited wait for a null run id and for a run id with no run.end, and none once a run.end exists', () => {
    const { project, specsDir } = makeProject(base);

    const nullRunLaunch = baseLaunch({ spec: 'exited-spec-1', runId: null, exitCode: 1, signal: null, endedAt: null, launchedAt: '2026-01-01T00:00:00.000Z', logPath: '/tmp/log1.log' });
    const waits1 = deriveProjectWaits(project, undefined, nullRunLaunch, Date.now());
    const exited1 = waits1.find((w) => w.kind === 'exited');
    expect(exited1?.spec).toBe('exited-spec-1');
    expect(exited1?.since).toBe('2026-01-01T00:00:00.000Z');
    expect(exited1?.detail).toEqual({ kind: 'exited', exitCode: 1, signal: null, endedAt: null, logPath: '/tmp/log1.log' });

    const dir2 = makeSpecDir(specsDir, 'exited-spec-2');
    writeLedger(dir2, [{ ts: '2026-01-01T23:00:00.000Z', type: 'run.start', run: 'run-7' }]);
    const noEndLaunch = baseLaunch({ spec: 'exited-spec-2', runId: 'run-7', exitCode: null, signal: 'SIGTERM', endedAt: '2026-01-02T00:00:00.000Z', launchedAt: '2026-01-01T23:00:00.000Z', logPath: '/tmp/log2.log' });
    const waits2 = deriveProjectWaits(project, undefined, noEndLaunch, Date.now());
    const exited2 = waits2.find((w) => w.kind === 'exited');
    expect(exited2?.spec).toBe('exited-spec-2');
    expect(exited2?.since).toBe('2026-01-02T00:00:00.000Z');
    expect(exited2?.detail).toEqual({ kind: 'exited', exitCode: null, signal: 'SIGTERM', endedAt: '2026-01-02T00:00:00.000Z', logPath: '/tmp/log2.log' });

    const dir3 = makeSpecDir(specsDir, 'exited-spec-3');
    writeLedger(dir3, [
      { ts: '2026-01-01T23:00:00.000Z', type: 'run.start', run: 'run-9' },
      { ts: '2026-01-02T00:00:00.000Z', type: 'run.end', run: 'run-9', status: 'done' },
    ]);
    const endedLaunch = baseLaunch({ spec: 'exited-spec-3', runId: 'run-9', endedAt: '2026-01-02T00:00:00.000Z', launchedAt: '2026-01-01T23:00:00.000Z', logPath: '/tmp/log3.log' });
    const waits3 = deriveProjectWaits(project, undefined, endedLaunch, Date.now());
    expect(waits3.find((w) => w.kind === 'exited')).toBeUndefined();
  });

  it('derives a quiet wait only past fifteen minutes with an open spawn and a pointer line', () => {
    const now = Date.now();
    const { project, specsDir } = makeProject(base);

    function quietFixture(spec: string, open: boolean): string {
      const dir = makeSpecDir(specsDir, spec);
      const events: LedgerEvent[] = [
        { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
        { ts: '2026-01-01T00:01:00.000Z', type: 'spawn.start', run: 'r1', agent: 'sdd-implementation-orchestrator', role: 'implementation phase, spawn 1' },
      ];
      if (!open) events.push({ ts: '2026-01-01T00:05:00.000Z', type: 'spawn.end', run: 'r1', agent: 'sdd-implementation-orchestrator', result: 'approved' });
      writeLedger(dir, events);
      const activityPath = join(dir, 'harness-activity.jsonl');
      writeFileSync(activityPath, [
        JSON.stringify({ ts: '2026-01-01T00:01:00.000Z', agent: 'sdd-implementation-orchestrator', event: 'agent.start' }),
        JSON.stringify({ ts: '2026-01-01T00:02:00.000Z', agent: 'sdd-implementation-orchestrator', event: 'tool', tool: 'Read' }),
        JSON.stringify({ ts: '2026-01-01T00:03:00.000Z', agent: 'sdd-implementation-orchestrator', event: 'tool', tool: 'Bash' }),
      ].join('\n') + '\n');
      return activityPath;
    }

    // 14 minutes old: not yet quiet.
    const activity14 = quietFixture('quiet-14', true);
    const t14 = new Date(now - 14 * 60 * 1000);
    utimesSync(activity14, t14, t14);
    const waits14 = deriveProjectWaits(project, pointerFor(project, 'quiet-14'), null, now);
    expect(waits14.find((w) => w.kind === 'quiet')).toBeUndefined();

    // 16 minutes old, open spawn, pointer present: quiet.
    const activity16 = quietFixture('quiet-16', true);
    const t16 = new Date(now - 16 * 60 * 1000);
    utimesSync(activity16, t16, t16);
    const waits16 = deriveProjectWaits(project, pointerFor(project, 'quiet-16'), null, now);
    const quiet = waits16.find((w) => w.kind === 'quiet');
    const expectedIso = mtimeIso(activity16);
    expect(quiet?.spec).toBe('quiet-16');
    expect(quiet?.since).toBe(expectedIso);
    expect(quiet?.detail).toEqual({ kind: 'quiet', agent: 'sdd-implementation-orchestrator', lastTool: 'Bash', lastActivityAt: expectedIso });

    // 16 minutes old, but the spawn is closed: no quiet wait.
    const activityClosed = quietFixture('quiet-closed', false);
    utimesSync(activityClosed, t16, t16);
    const waitsClosed = deriveProjectWaits(project, pointerFor(project, 'quiet-closed'), null, now);
    expect(waitsClosed.find((w) => w.kind === 'quiet')).toBeUndefined();

    // 16 minutes old, open spawn, but no pointer (HANDOFF-resolved spec only): no quiet wait.
    const activityNoPointer = quietFixture('quiet-no-pointer', true);
    utimesSync(activityNoPointer, t16, t16);
    writeFileSync(join(project.projectPath, '.spec-workflow', 'HANDOFF.md'), handoffFixture('quiet-no-pointer'));
    const waitsNoPointer = deriveProjectWaits(project, undefined, null, now);
    expect(waitsNoPointer.find((w) => w.kind === 'quiet')).toBeUndefined();
  });

  it('raises no error and derives no gate, ruling or quiet wait for a missing, an empty or a torn ledger', () => {
    const { project, specsDir } = makeProject(base);

    // Missing: the spec directory exists but harness-events.jsonl does not.
    makeSpecDir(specsDir, 'missing-ledger');
    expect(() => deriveProjectWaits(project, pointerFor(project, 'missing-ledger'), null, Date.now())).not.toThrow();
    const waitsMissing = deriveProjectWaits(project, pointerFor(project, 'missing-ledger'), null, Date.now());
    expect(waitsMissing.find((w) => w.kind === 'gate' || w.kind === 'ruling' || w.kind === 'quiet')).toBeUndefined();

    // Empty: a zero-byte harness-events.jsonl.
    const emptyDir = makeSpecDir(specsDir, 'empty-ledger');
    writeFileSync(join(emptyDir, 'harness-events.jsonl'), '');
    expect(() => deriveProjectWaits(project, pointerFor(project, 'empty-ledger'), null, Date.now())).not.toThrow();
    const waitsEmpty = deriveProjectWaits(project, pointerFor(project, 'empty-ledger'), null, Date.now());
    expect(waitsEmpty.find((w) => w.kind === 'gate' || w.kind === 'ruling' || w.kind === 'quiet')).toBeUndefined();

    // Torn: a well-formed phase.start followed by a truncated, non-JSON tail
    // that would otherwise have been the deciding gate-a phase.end.
    const tornDir = makeSpecDir(specsDir, 'torn-ledger');
    writeFileSync(
      join(tornDir, 'harness-events.jsonl'),
      '{"ts":"2026-01-01T00:00:00.000Z","type":"run.start","run":"r1"}\n' +
      '{"ts":"2026-01-01T00:01:00.000Z","type":"phase.start","run":"r1","phase":"document"}\n' +
      '{"ts":"2026-01-01T00:02:00.000Z","type":"phase.end","run":"r1","phase":"document","result":"gate-a"',
    );
    expect(() => deriveProjectWaits(project, pointerFor(project, 'torn-ledger'), null, Date.now())).not.toThrow();
    const waitsTorn = deriveProjectWaits(project, pointerFor(project, 'torn-ledger'), null, Date.now());
    expect(waitsTorn.find((w) => w.kind === 'gate' || w.kind === 'ruling' || w.kind === 'quiet')).toBeUndefined();
  });
});

describe('orderWaits', () => {
  it('orders by kind (gate, ruling, retro, exited, quiet), then since ascending within a kind', () => {
    const wait = (kind: Wait['kind'], spec: string, since: string): Wait => ({
      kind, projectId: 'p1', projectName: 'Project One', spec, since, summary: 'x',
      detail:
        kind === 'gate' ? { kind: 'gate', gate: 'A', items: null, questions: null } :
        kind === 'ruling' ? { kind: 'ruling', phase: 'implementation', state: 's', note: 'n' } :
        kind === 'retro' ? { kind: 'retro', count: 0, lines: [] } :
        kind === 'exited' ? { kind: 'exited', exitCode: null, signal: null, endedAt: null, logPath: '/tmp/x.log' } :
        { kind: 'quiet', agent: 'a', lastTool: null, lastActivityAt: since },
    });

    const gateEarly = wait('gate', 'gate-early', '2026-01-01T00:01:00.000Z');
    const gateLate = wait('gate', 'gate-late', '2026-01-01T00:05:00.000Z');
    const ruling = wait('ruling', 'ruling', '2026-01-01T00:03:00.000Z');
    const retro = wait('retro', 'retro', '2026-01-01T00:02:00.000Z');
    const exited = wait('exited', 'exited', '2026-01-01T00:04:00.000Z');
    const quiet = wait('quiet', 'quiet', '2026-01-01T00:00:00.000Z');

    const ordered = orderWaits([quiet, exited, retro, ruling, gateLate, gateEarly]);

    expect(ordered.map((w) => w.spec)).toEqual(['gate-early', 'gate-late', 'ruling', 'retro', 'exited', 'quiet']);
  });
});
