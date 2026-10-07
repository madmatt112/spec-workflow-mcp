import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { buildSpecRows, buildSpecDetail } from '../spec-rows.js';
import type { LedgerEvent } from '../../../watch/ledger.js';
import type { ProjectContext } from '../../project-manager.js';
import type { PointerLine } from '../../harness/types.js';
import { DeferralStorage } from '../../../core/deferral-storage.js';

// Contract for src/dashboard/shell/spec-rows.ts (design.md C5; task 4 _Prompt;
// Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 2.11).
//
// Reached only through buildSpecRows(project, pointers, cache?) and
// buildSpecDetail(project, spec).
//
// === buildSpecRows — state and precedence (Req 5.2) ===
//
// Criterion "live wins over a closed closeout row and a deferred marker"
//   (task 4 _Prompt: "`live` when a pointer line's `specDir` base name is the
//   spec ... first match wins (design D10)"):
//   Pre-condition: one spec with a pointer naming it, a HANDOFF closeout/
//   closed row for it, and a deferred.json marker for it.
//   Test: buildSpecRows(project, [pointer]).
//   Observable result: that spec's row has state 'live'.
//   Expected-value source: design D10's precedence order (live first), the
//   _Prompt's live rule.
//
// Criterion "closed (via a closeout row) wins over a deferred marker"
//   (task 4 _Prompt: "`closed` when its HANDOFF phase log holds a `closeout`
//   row with result `closed` ... `deferred` when the entry's `deferred` is
//   true", first match wins):
//   Pre-condition: a spec with no pointer, a HANDOFF closeout/closed row, and
//   a deferred.json marker.
//   Test: buildSpecRows(project, []).
//   Observable result: that spec's row has state 'closed'.
//   Expected-value source: design D10's precedence (closed before deferred).
//
// Criterion "closed (via a CLOSED retrospective plan, no closeout row) wins
//   over a deferred marker" (task 4 _Prompt: "... or the first `Status:`
//   value of `retrospective-plan.md` is `CLOSED`"):
//   Pre-condition: a spec with no pointer, no closeout row, a
//   retrospective-plan.md whose first Status: value is CLOSED, and a
//   deferred.json marker.
//   Test: buildSpecRows(project, []).
//   Observable result: that spec's row has state 'closed'.
//   Expected-value source: the _Prompt's alternate closed condition.
//
// Criterion "deferred wins over not-started" (task 4 _Prompt: "`deferred`
//   when the entry's `deferred` is true; `not-started` when the spec
//   directory has no requirements.md, design.md, tasks.md or
//   harness-events.jsonl"):
//   Pre-condition: a spec directory with no documents and no ledger, but a
//   deferred.json marker, no pointer, no closed markers.
//   Test: buildSpecRows(project, []).
//   Observable result: that spec's row has state 'deferred'.
//   Expected-value source: design D10's precedence (deferred before
//   not-started).
//
// Criterion "not-started with no documents and no ledger" (task 4 _Prompt,
//   same sentence):
//   Pre-condition: an empty spec directory (no documents, no ledger), no
//   pointer, no closed or deferred markers.
//   Test: buildSpecRows(project, []).
//   Observable result: that spec's row has state 'not-started'; `updated` is
//   null (no ledger ts and no phase-log date to compare); `phase` is
//   'requirements' (the snapshot entry's own currentPhase fallback, since
//   there is no live phase and no phase-log row).
//   Expected-value source: the _Prompt's not-started rule and its phase
//   fallback ("else the entry's `currentPhase`"); 'requirements' is
//   src/core/spec-status-deriver.ts's branch for a spec with no
//   requirements.md.
//
// Criterion "in-progress otherwise" (task 4 _Prompt: "else `in-progress`"):
//   Pre-condition: a spec directory holding only requirements.md, no
//   pointer, no closed or deferred markers.
//   Test: buildSpecRows(project, []).
//   Observable result: that spec's row has state 'in-progress'.
//   Expected-value source: the _Prompt's else-branch rule.
//
// === buildSpecRows — versions (Req 5.3) ===
//
// Criterion "versions is the newest v-plus-digits phase-log State per
//   document phase, else null" (task 4 _Prompt: "`versions`: per document
//   phase, the newest phase-log `State` matching `/^v\\d+$/`, else null"):
//   Pre-condition: a HANDOFF phase log with two requirements rows (State
//   'v1' then, dated later, 'v2'), one design row (State 'in-progress', no
//   match), and no tasks rows.
//   Test: buildSpecRows(project, []).
//   Observable result: that spec's row has versions.requirements 'v2',
//   versions.design null, versions.tasks null.
//   Expected-value source: the fixture's own phase-log State values.
//
// === buildSpecRows — PRs (Req 5.3) ===
//
// Criterion "prs is the distinct PR numbers in phase-log notes, ascending"
//   (task 4 _Prompt: "`prs`: distinct numbers of `PR #N` in its phase-log
//   notes, ascending"):
//   Pre-condition: a HANDOFF phase log with two rows for the spec whose
//   notes mention "PR #12", "PR #3" and "PR #12" again.
//   Test: buildSpecRows(project, []).
//   Observable result: that spec's row has prs [3, 12].
//   Expected-value source: the fixture's own note text, deduplicated and
//   sorted per the _Prompt sentence.
//
// === buildSpecRows — deferral count (Req 5.3) ===
//
// Criterion "deferrals is the count of deferred records whose originSpec is
//   the spec" (task 4 _Prompt: "`deferrals`: `new
//   DeferralStorage(project.projectPath).list({ status: 'deferred',
//   originSpec: spec })` length"):
//   Pre-condition: two 'deferred' records with originSpec the target spec,
//   one record for the same spec later resolved (so its status is no longer
//   'deferred'), and one 'deferred' record for a different spec.
//   Test: buildSpecRows(project, []).
//   Observable result: the target spec's row has deferrals === 2.
//   Expected-value source: the fixture's own record count, per the quoted
//   DeferralStorage.list call.
//
// === buildSpecRows — retro word (Req 5.3) ===
//
// Criterion "retro is the first word of the plan's Status value" (task 4
//   _Prompt: "`retro`: the first word of the plan's `Status:` value, else
//   null"):
//   Pre-condition: a retrospective-plan.md whose first Status: line reads
//   "Status: APPROVED — all decisions made".
//   Test: buildSpecRows(project, []).
//   Observable result: that spec's row has retro === 'APPROVED'.
//   Expected-value source: the fixture's own Status: line, per the quoted
//   first-word rule.
//
// === buildSpecRows — updated (Req 5.3) ===
//
// Criterion "updated is the newer of the newest ledger ts and the newest
//   phase-log date" (task 4 _Prompt: "`updated`: the newer of the newest
//   ledger `ts` and the newest phase-log date, else null"):
//   Pre-condition: spec 'upd-a' has a ledger row timestamped in 2030 and a
//   phase-log row dated in 2020; spec 'upd-b' has a ledger row timestamped
//   in 2000 and a phase-log row dated in 2099.
//   Test: buildSpecRows(project, []).
//   Observable result: 'upd-a' row's updated equals the ledger row's own ts
//   string; 'upd-b' row's updated equals the phase-log row's own date
//   string.
//   Expected-value source: the fixtures' own ts/date values, whichever is
//   chronologically newer per the quoted rule.
//
// === buildSpecDetail — null cases (Req 5.4) ===
//
// Criterion "null for a spec name with a path segment, and for a missing
//   directory" (task 4 _Prompt: "null when `spec` fails
//   `/^[A-Za-z0-9._-]+$/` ... or is no directory under the specs directory"):
//   Pre-condition: a project whose specs directory exists but holds none of
//   the three names used below.
//   Test: buildSpecDetail(project, '../x'); buildSpecDetail(project, 'a/b');
//   buildSpecDetail(project, 'no-such-spec').
//   Observable result: null for all three calls.
//   Expected-value source: the quoted regex/existence rule, applied to these
//   literal names named by the _Prompt.
//
// === buildSpecDetail — order and dependsOn (Req 5.4) ===
//
// Criterion "order is the decomposition heading number naming the spec in
//   backticks, and dependsOn is its Depends-on paragraph with the marker
//   removed and lines joined by one space; both null when the spec is not
//   named" (task 4 _Prompt: "`order`: N of the `### N.` heading ... that
//   names the spec in backticks, else null; `dependsOn`: that entry's
//   paragraph that starts with `**Depends on**`, marker removed, lines
//   joined with one space, else null"):
//   Pre-condition: a decomposition.md with "### 7. `my-spec` — ..." followed
//   by a two-line "**Depends on** ..." paragraph, and a second heading "### 8.
//   `other-spec` — ..." with no Depends-on paragraph at all.
//   Test: buildSpecDetail(project, 'my-spec'); buildSpecDetail(project,
//   'other-spec').
//   Observable result: 'my-spec' detail has order 7 and dependsOn equal to
//   the fixture's own two lines, marker removed, joined by a single space;
//   'other-spec' detail has order 8 and dependsOn null.
//   Expected-value source: the fixture's own heading number and paragraph
//   text.
//
// === buildSpecDetail — two runs with tokens (Req 5.4) ===
//
// Criterion "runs holds one row per run.start, end/status from its run.end,
//   and tokens from buildModel's tokensTotal over only that run's rows"
//   (task 4 _Prompt: "`runs`: one per `run.start` in file order, `end` and
//   `status` from that run's `run.end`, `tokens` the `tokensTotal` of
//   `buildModel` over only that run's rows"):
//   Pre-condition: a ledger with two runs, each a run.start, one spawn.start/
//   spawn.end pair carrying its own tokens value, and a run.end with its own
//   status.
//   Test: buildSpecDetail(project, spec).
//   Observable result: detail.runs has one entry per runId with start equal
//   to that run's run.start ts, end equal to its run.end ts, status equal to
//   its run.end status, and tokens equal to that run's own spawn.end tokens
//   value.
//   Expected-value source: the fixture's own two runs' ts/status/tokens
//   values.
//
// === buildSpecDetail — file paths and no content (Req 5.5, 5.6, D9) ===
//
// Criterion "files are top-level regular files with paths built on
//   project.workflowRootPath, and no detail field holds file content" (task
//   4 _Prompt: "`files`: each top-level regular file ... `path` joined on
//   `project.workflowRootPath` plus `.spec-workflow/specs/SPEC/NAME`"; "Write
//   the design Testing Strategy spec-rows cases: ... no detail field holds
//   file content"):
//   Pre-condition: a spec directory with two top-level files (one holding a
//   unique content marker) and one subdirectory, under a project whose
//   `workflowRootPath` is a different string from its `projectPath`.
//   Test: buildSpecDetail(project, spec).
//   Observable result: detail.files has exactly two entries (the
//   subdirectory is excluded), each with `path` starting with the project's
//   `workflowRootPath` (not its `projectPath`) and ending in
//   `.spec-workflow/specs/SPEC/<name>`; `JSON.stringify(detail)` does not
//   contain the unique content marker.
//   Expected-value source: the fixture's own file names and
//   `workflowRootPath` string, per the quoted path rule; the no-content
//   check is the Testing Strategy's own literal requirement.

function tmpBase(): string {
  return mkdtempSync(join(tmpdir(), 'sdd-spec-rows-test-'));
}

function makeProject(base: string, name = 'Project One'): { project: ProjectContext; workflowRoot: string; specsDir: string } {
  const projectPath = mkdtempSync(join(base, 'proj-'));
  const workflowRoot = join(projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');
  mkdirSync(specsDir, { recursive: true });
  const project = {
    projectId: randomUUID(),
    projectName: name,
    projectPath,
    workspacePath: projectPath,
    workflowRootPath: projectPath,
  } as ProjectContext;
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

function writeLedger(specDir: string, events: LedgerEvent[]): void {
  writeFileSync(join(specDir, 'harness-events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

interface PhaseLogRow { date: string; spec: string; phase: string; state: string; result: string; note: string }

function phaseLogTable(rows: PhaseLogRow[]): string {
  return [
    '## Phase log',
    '',
    '| Date | Spec | Stage | State | Result | Note |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.date} | ${r.spec} | ${r.phase} | ${r.state} | ${r.result} | ${r.note} |`),
    '',
  ].join('\n');
}

function writeHandoff(workflowRoot: string, rows: PhaseLogRow[]): void {
  writeFileSync(join(workflowRoot, 'HANDOFF.md'), phaseLogTable(rows));
}

function writeDeferredMarker(specsDir: string, spec: string): void {
  writeFileSync(
    join(specsDir, spec, 'deferred.json'),
    JSON.stringify({ deferred: true, reason: 'postponed for the test', deferredAt: '2026-01-01T00:00:00.000Z' }),
  );
}

function writeRetroPlan(specsDir: string, spec: string, statusLine: string): void {
  writeFileSync(
    join(specsDir, spec, 'retrospective-plan.md'),
    `# Retrospective plan — ${spec}\n${statusLine}\n`,
  );
}

describe('buildSpecRows', () => {
  let base: string;

  beforeEach(() => { base = tmpBase(); });
  afterEach(() => { rmSync(base, { recursive: true, force: true }); });

  it('gives state live, overriding a closed closeout row and a deferred marker', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'live-spec');
    writeHandoff(workflowRoot, [
      { date: '2026-01-01', spec: 'live-spec', phase: 'closeout', state: 'complete', result: 'closed', note: 'closed' },
    ]);
    writeDeferredMarker(specsDir, 'live-spec');

    const rows = await buildSpecRows(project, [pointerFor(project, 'live-spec')]);
    const row = rows.find((r) => r.spec === 'live-spec');
    expect(row?.state).toBe('live');
  });

  it('gives state closed (via a closeout row), overriding a deferred marker', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'closed-row-spec');
    writeHandoff(workflowRoot, [
      { date: '2026-01-01', spec: 'closed-row-spec', phase: 'closeout', state: 'complete', result: 'closed', note: 'closed' },
    ]);
    writeDeferredMarker(specsDir, 'closed-row-spec');

    const rows = await buildSpecRows(project, []);
    const row = rows.find((r) => r.spec === 'closed-row-spec');
    expect(row?.state).toBe('closed');
  });

  it('gives state closed (via a CLOSED retrospective plan, no closeout row), overriding a deferred marker', async () => {
    const { project, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'closed-plan-spec');
    writeRetroPlan(specsDir, 'closed-plan-spec', 'Status: CLOSED');
    writeDeferredMarker(specsDir, 'closed-plan-spec');

    const rows = await buildSpecRows(project, []);
    const row = rows.find((r) => r.spec === 'closed-plan-spec');
    expect(row?.state).toBe('closed');
  });

  it('gives state deferred, overriding not-started, when the entry has no documents and no ledger', async () => {
    const { project, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'deferred-spec');
    writeDeferredMarker(specsDir, 'deferred-spec');

    const rows = await buildSpecRows(project, []);
    const row = rows.find((r) => r.spec === 'deferred-spec');
    expect(row?.state).toBe('deferred');
  });

  it('gives state not-started with no documents and no ledger, falling back to the entry\'s currentPhase and a null updated', async () => {
    const { project, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'empty-spec');

    const rows = await buildSpecRows(project, []);
    const row = rows.find((r) => r.spec === 'empty-spec');
    expect(row?.state).toBe('not-started');
    expect(row?.phase).toBe('requirements');
    expect(row?.updated).toBeNull();
  });

  it('gives state in-progress otherwise', async () => {
    const { project, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'wip-spec');
    writeFileSync(join(dir, 'requirements.md'), '# Requirements\n');

    const rows = await buildSpecRows(project, []);
    const row = rows.find((r) => r.spec === 'wip-spec');
    expect(row?.state).toBe('in-progress');
  });

  it('gives versions the newest v-plus-digits phase-log State per document phase, else null', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'ver-spec');
    writeHandoff(workflowRoot, [
      { date: '2026-01-01', spec: 'ver-spec', phase: 'requirements', state: 'v1', result: 'approved', note: 'first' },
      { date: '2026-01-05', spec: 'ver-spec', phase: 'requirements', state: 'v2', result: 'approved', note: 'second' },
      { date: '2026-01-02', spec: 'ver-spec', phase: 'design', state: 'in-progress', result: 'pending', note: 'wip' },
    ]);

    const rows = await buildSpecRows(project, []);
    const row = rows.find((r) => r.spec === 'ver-spec');
    expect(row?.versions.requirements).toBe('v2');
    expect(row?.versions.design).toBeNull();
    expect(row?.versions.tasks).toBeNull();
  });

  it('gives prs the distinct PR numbers in phase-log notes, ascending', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'pr-spec');
    writeHandoff(workflowRoot, [
      { date: '2026-01-01', spec: 'pr-spec', phase: 'tasks', state: 'v1', result: 'approved', note: 'merged PR #12' },
      { date: '2026-01-02', spec: 'pr-spec', phase: 'implementation', state: 'v1', result: 'approved', note: 'see PR #3 and PR #12 again' },
    ]);

    const rows = await buildSpecRows(project, []);
    const row = rows.find((r) => r.spec === 'pr-spec');
    expect(row?.prs).toEqual([3, 12]);
  });

  it('gives deferrals the count of deferred records whose originSpec is the spec', async () => {
    const { project, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'def-spec');
    makeSpecDir(specsDir, 'other-spec');
    const storage = new DeferralStorage(project.projectPath);
    const body = { context: 'c', decision: 'd', revisitCriteria: 'r' };
    const common: { originPhase: null; revisitTrigger: string; tags: string[]; body: typeof body; supersedes: null } =
      { originPhase: null, revisitTrigger: 't', tags: [], body, supersedes: null };

    await storage.create({ title: 'D1', originSpec: 'def-spec', ...common });
    await storage.create({ title: 'D2', originSpec: 'def-spec', ...common });
    const resolvedId = await storage.create({ title: 'D3', originSpec: 'def-spec', ...common });
    await storage.resolve(resolvedId, 'done');
    await storage.create({ title: 'D4', originSpec: 'other-spec', ...common });

    const rows = await buildSpecRows(project, []);
    const row = rows.find((r) => r.spec === 'def-spec');
    expect(row?.deferrals).toBe(2);
  });

  it('gives retro the first word of the plan\'s Status value', async () => {
    const { project, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'retro-spec');
    writeRetroPlan(specsDir, 'retro-spec', 'Status: APPROVED — all decisions made');

    const rows = await buildSpecRows(project, []);
    const row = rows.find((r) => r.spec === 'retro-spec');
    expect(row?.retro).toBe('APPROVED');
  });

  it('gives updated the newer of the newest ledger ts and the newest phase-log date', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    const dirA = makeSpecDir(specsDir, 'upd-a');
    writeLedger(dirA, [{ ts: '2030-06-01T00:00:00.000Z', type: 'run.start', run: 'r1' }]);
    const dirB = makeSpecDir(specsDir, 'upd-b');
    writeLedger(dirB, [{ ts: '2000-06-01T00:00:00.000Z', type: 'run.start', run: 'r2' }]);
    writeHandoff(workflowRoot, [
      { date: '2020-01-01', spec: 'upd-a', phase: 'requirements', state: 'v1', result: 'approved', note: 'old' },
      { date: '2099-01-01', spec: 'upd-b', phase: 'requirements', state: 'v1', result: 'approved', note: 'future' },
    ]);

    const rows = await buildSpecRows(project, []);
    const rowA = rows.find((r) => r.spec === 'upd-a');
    const rowB = rows.find((r) => r.spec === 'upd-b');
    expect(rowA?.updated).toBe('2030-06-01T00:00:00.000Z');
    expect(rowB?.updated).toBe('2099-01-01');
  });
});

describe('buildSpecDetail', () => {
  let base: string;

  beforeEach(() => { base = tmpBase(); });
  afterEach(() => { rmSync(base, { recursive: true, force: true }); });

  it('returns null for a spec name with a path segment, and for a missing directory', async () => {
    const { project } = makeProject(base);

    expect(await buildSpecDetail(project, '../x')).toBeNull();
    expect(await buildSpecDetail(project, 'a/b')).toBeNull();
    expect(await buildSpecDetail(project, 'no-such-spec')).toBeNull();
  });

  it('gives order the decomposition heading number and dependsOn the Depends-on paragraph with the marker removed and lines joined, null for a spec with no such paragraph', async () => {
    const { project, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'my-spec');
    makeSpecDir(specsDir, 'other-spec');
    const decompDir = join(project.projectPath, '.spec-workflow', 'spec-decomposition');
    mkdirSync(decompDir, { recursive: true });
    writeFileSync(join(decompDir, 'decomposition.md'), [
      '### 7. `my-spec` — the test fixture spec (active)',
      '',
      'Some prose about the spec.',
      '',
      '**Depends on** spec 9 for the harness watchers, the launcher, the setup file and the run',
      'model wiring, and on spec 6 for the pointer file and the hook events.',
      '',
      '### 8. `other-spec` — a spec with no dependency paragraph (active)',
      '',
      'Some other prose, with no Depends-on paragraph at all.',
      '',
    ].join('\n'));

    const detail = await buildSpecDetail(project, 'my-spec');
    expect(detail?.order).toBe(7);
    expect(detail?.dependsOn).toBe(
      'spec 9 for the harness watchers, the launcher, the setup file and the run model wiring, and on spec 6 for the pointer file and the hook events.',
    );

    const otherDetail = await buildSpecDetail(project, 'other-spec');
    expect(otherDetail?.order).toBe(8);
    expect(otherDetail?.dependsOn).toBeNull();
  });

  it('gives runs one row per run.start with end/status from its run.end and tokens from buildModel over only that run\'s rows', async () => {
    const { project, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'two-run-spec');
    writeLedger(dir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'spawn.start', run: 'r1', agent: 'sdd-worker' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'spawn.end', run: 'r1', agent: 'sdd-worker', result: 'approved', tokens: '100' },
      { ts: '2026-01-01T00:03:00.000Z', type: 'run.end', run: 'r1', status: 'done' },
      { ts: '2026-02-01T00:00:00.000Z', type: 'run.start', run: 'r2' },
      { ts: '2026-02-01T00:01:00.000Z', type: 'spawn.start', run: 'r2', agent: 'sdd-worker2' },
      { ts: '2026-02-01T00:02:00.000Z', type: 'spawn.end', run: 'r2', agent: 'sdd-worker2', result: 'approved', tokens: '250' },
      { ts: '2026-02-01T00:03:00.000Z', type: 'run.end', run: 'r2', status: 'stopped' },
    ]);

    const detail = await buildSpecDetail(project, 'two-run-spec');
    expect(detail?.runs).toHaveLength(2);

    const run1 = detail?.runs.find((r) => r.runId === 'r1');
    expect(run1?.start).toBe('2026-01-01T00:00:00.000Z');
    expect(run1?.end).toBe('2026-01-01T00:03:00.000Z');
    expect(run1?.status).toBe('done');
    expect(run1?.tokens).toBe(100);

    const run2 = detail?.runs.find((r) => r.runId === 'r2');
    expect(run2?.start).toBe('2026-02-01T00:00:00.000Z');
    expect(run2?.end).toBe('2026-02-01T00:03:00.000Z');
    expect(run2?.status).toBe('stopped');
    expect(run2?.tokens).toBe(250);
  });

  it('gives files top-level regular files with paths built on workflowRootPath, and no detail field holds file content', async () => {
    const { project, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'file-spec');
    const marker = 'UNIQUE_CONTENT_MARKER_7f3a1c';
    writeFileSync(join(dir, 'requirements.md'), `# Requirements\n${marker}\n`);
    utimesSync(join(dir, 'requirements.md'), new Date('2026-03-01T00:00:00.000Z'), new Date('2026-03-01T00:00:00.000Z'));
    writeFileSync(join(dir, 'design.md'), '# Design\n');
    utimesSync(join(dir, 'design.md'), new Date('2026-03-02T00:00:00.000Z'), new Date('2026-03-02T00:00:00.000Z'));
    mkdirSync(join(dir, 'subdir'));

    const projectWithDifferentRoot: ProjectContext = { ...project, workflowRootPath: '/original/workspace-root' };

    const detail = await buildSpecDetail(projectWithDifferentRoot, 'file-spec');
    expect(detail?.files).toHaveLength(2);

    const req = detail?.files.find((f) => f.name === 'requirements.md');
    expect(req?.path).toBe(join('/original/workspace-root', '.spec-workflow', 'specs', 'file-spec', 'requirements.md'));
    expect(req?.modified).toBe('2026-03-01T00:00:00.000Z');

    const design = detail?.files.find((f) => f.name === 'design.md');
    expect(design?.path).toBe(join('/original/workspace-root', '.spec-workflow', 'specs', 'file-spec', 'design.md'));

    for (const f of detail?.files ?? []) {
      expect(f.path.startsWith(project.projectPath)).toBe(false);
    }

    expect(JSON.stringify(detail)).not.toContain(marker);
  });
});
