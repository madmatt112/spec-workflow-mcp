import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildUsageView } from '../usage-view.js';
import { computeBurn, type UsageLogLine } from '../../../controller/usage-log.js';
import type { ProjectContext } from '../../project-manager.js';
import type { RunRecord } from '../../../controller/state.js';

// Contract for src/dashboard/shell/usage-view.ts (design.md C6; task 6 _Prompt;
// Requirement 4 AC4-5, Requirement 5 AC1-5). Reached only through
// buildUsageView(projects, nowMs).
//
// 1. "fits"
//    pre: implementation run, 3 distinct task.done rows, log lines attributing
//      use to the run, a future reset; tokens of all four kinds
//    call: buildUsageView([project], nowMs)
//    result: the run's line has fit 'fits'; tokens equals the sum of the four
//      kinds; projectName is the given project's name
//    source: _Prompt Success "reads fits when use per task times remaining is
//      within the headroom"; "tokens is the sum of the four kinds" (folded in:
//      same fixture, no separate case needed)
// 2. "does-not-fit"
//    pre: as above but use/done*remaining exceeds the headroom
//    call: buildUsageView([project], nowMs)
//    result: fit 'does-not-fit'
//    source: _Prompt Success "does-not-fit when not"
// 3. fit null — document-phase run
//    pre: run.phase is not 'implementation'
//    call: buildUsageView([project], nowMs)
//    result: fit null; remaining null
//    source: _Prompt Success "the fit is null for a document-phase run";
//      design Data Models "remaining ... null outside the implementation phase"
// 4. fit null — zero tasks done
//    pre: implementation run with no task.done row in its spec's ledger
//    call: buildUsageView([project], nowMs)
//    result: fit null
//    source: _Prompt Success "for zero tasks done"
// 5. fit null — no attributed line
//    pre: implementation run, done >= 1, but the log holds no line whose run
//      is this run's id
//    call: buildUsageView([project], nowMs)
//    result: fit null
//    source: _Prompt Success "for no attributed line"
// 6. fit null — passed reset
//    pre: implementation run, done >= 1, attributed use > 0, window present
//      but resetsAt before nowMs
//    call: buildUsageView([project], nowMs)
//    result: fit null
//    source: _Prompt Success "for a passed reset"
// 7. fit null — missing tasks.md
//    pre: implementation run, done >= 1, attributed use > 0, window present,
//      but the spec directory holds no tasks.md
//    call: buildUsageView([project], nowMs)
//    result: fit null; remaining null
//    source: _Prompt Success "for a missing tasks.md"
// 8. window null, fit null — no rate-limit.json
//    pre: no rate-limit.json; otherwise every other fit condition holds
//    call: buildUsageView([project], nowMs)
//    result: view.window is null; the run's fit is null
//    source: _Prompt Success "no rate-limit.json gives window: null" and
//      "for a null window (no rate-limit.json)" (folded: one fixture proves
//      both the top-level window field and the dependent fit)
// 9. done counted once per distinct task id, and only for this run
//    pre: one ledger with a duplicated task.done row for one task id on this
//      run and a task.done row for another task id on a different run id;
//      headroom and use chosen so a correct done=3 reads does-not-fit while a
//      miscount (double-counting the duplicate, or counting the other run's
//      row) would read fits
//    call: buildUsageView([project], nowMs)
//    result: fit 'does-not-fit'
//    source: _Prompt Success "a repeated task.done row for one task counts
//      once" and "a row of another run does not count" (folded: one fixture,
//      one boundary, proves both — either bug flips the same assertion)
// 10. burn passthrough
//    pre: two usage-log lines exactly 24h apart
//    call: buildUsageView([], nowMs) with nowMs at the second line's time
//    result: view.burn equals computeBurn (task 1's own function) over the
//      identical lines and nowMs
//    source: _Prompt Success "burn equals the task 1 burn of the same lines"
// 11. project absent from `projects`
//    pre: a live run whose project id is not in the given projects array
//    call: buildUsageView([], nowMs)
//    result: the run's line has projectName equal to the run's project id
//    source: _Prompt Success "a live run of a project absent from projects is
//      listed with its project id as name"
// 12. done and abandoned runs excluded
//    pre: one run with status 'done', one with status 'abandoned', no other
//      runs
//    call: buildUsageView([], nowMs)
//    result: view.runs is []
//    source: _Prompt Success "done and abandoned runs are not listed"

let sddHome: string;
let savedSddHome: string | undefined;
const stores: string[] = [];

beforeEach(() => {
  savedSddHome = process.env.SDD_HOME;
  sddHome = mkdtempSync(join(tmpdir(), 'sdd-usage-view-'));
  process.env.SDD_HOME = sddHome;
});

afterEach(() => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  rmSync(sddHome, { recursive: true, force: true });
  for (const store of stores.splice(0)) rmSync(store, { recursive: true, force: true });
});

function newStore(): string {
  const dir = mkdtempSync(join(tmpdir(), 'sdd-usage-view-store-'));
  stores.push(dir);
  return dir;
}

function project(id: string, name: string): ProjectContext {
  return { projectId: id, projectName: name } as ProjectContext;
}

function run(fields: Pick<RunRecord, 'id' | 'project' | 'specStore' | 'spec'> & Partial<RunRecord>): RunRecord {
  return {
    v: 1,
    codeRoot: '/tmp/code-root',
    worktree: '',
    branch: '',
    status: 'waiting',
    created: '2026-11-13T00:00:00.000Z',
    updated: '2026-11-13T00:00:00.000Z',
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    ...fields,
  };
}

function writeRun(record: RunRecord): void {
  const dir = join(sddHome, 'runs', record.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'run.json'), JSON.stringify(record));
}

function writeRateLimit(utilization: number, resetsAt: string): void {
  writeFileSync(
    join(sddHome, 'rate-limit.json'),
    JSON.stringify({
      v: 1,
      fiveHour: { utilization: 0, resetsAt: '2026-12-01T00:00:00.000Z' },
      sevenDay: { utilization, resetsAt },
      updated: '2026-11-13T00:00:00.000Z',
    }),
  );
}

function logLine(ts: string, utilization: number, runId: string | null): UsageLogLine {
  return { v: 1, ts, sevenDay: { utilization }, run: runId };
}

function writeUsageLog(lines: UsageLogLine[]): void {
  writeFileSync(join(sddHome, 'usage-log.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

function specDir(store: string, spec: string): string {
  return join(store, '.spec-workflow', 'specs', spec);
}

function writeTasksMd(store: string, spec: string, lines: string[]): void {
  const dir = specDir(store, spec);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'tasks.md'), lines.join('\n') + '\n');
}

function writeHarnessEvents(store: string, spec: string, rows: Record<string, unknown>[]): void {
  const dir = specDir(store, spec);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'harness-events.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

function taskDone(runId: string, spec: string, task: string): Record<string, unknown> {
  return { ts: '2026-11-13T00:00:00.000Z', run: runId, spec, type: 'task.done', task };
}

const TASKS_3_OF_7 = [
  '- [x] 1. a',
  '- [x] 2. b',
  '- [x] 3. c',
  '- [ ] 4. d',
  '- [ ] 5. e',
  '- [ ] 6. f',
  '- [ ] 7. g',
];

const NOW_MS = Date.parse('2026-11-13T12:00:00.000Z');
const FUTURE_RESET = '2026-11-20T00:00:00.000Z';
const PAST_RESET = '2026-11-10T00:00:00.000Z';

describe('buildUsageView', () => {
  it('reads fits when use per task times remaining is within the headroom, and sums tokens across the four kinds', async () => {
    const store = newStore();
    writeTasksMd(store, 'spec-x', TASKS_3_OF_7);
    writeHarnessEvents(store, 'spec-x', [
      taskDone('run-fits', 'spec-x', '1'),
      taskDone('run-fits', 'spec-x', '2'),
      taskDone('run-fits', 'spec-x', '3'),
    ]);
    writeUsageLog([
      logLine('2026-11-13T10:00:00.000Z', 0.1, null),
      logLine('2026-11-13T11:00:00.000Z', 0.13, 'run-fits'),
    ]);
    writeRateLimit(0.13, FUTURE_RESET);
    writeRun(
      run({
        id: 'run-fits', project: 'proj-a', specStore: store, spec: 'spec-x',
        phase: 'implementation',
        tokens: { input: 1, output: 2, cacheWrite: 3, cacheRead: 4 },
      }),
    );

    const view = await buildUsageView([project('proj-a', 'Project A')], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-fits');

    expect(line?.fit).toBe('fits');
    expect(line?.tokens).toBe(10);
    expect(line?.projectName).toBe('Project A');
  });

  it('reads does-not-fit when use per task times remaining exceeds the headroom', async () => {
    const store = newStore();
    writeTasksMd(store, 'spec-y', TASKS_3_OF_7);
    writeHarnessEvents(store, 'spec-y', [
      taskDone('run-nofit', 'spec-y', '1'),
      taskDone('run-nofit', 'spec-y', '2'),
      taskDone('run-nofit', 'spec-y', '3'),
    ]);
    writeUsageLog([
      logLine('2026-11-13T10:00:00.000Z', 0.5, null),
      logLine('2026-11-13T11:00:00.000Z', 0.8, 'run-nofit'),
    ]);
    writeRateLimit(0.8, FUTURE_RESET);
    writeRun(run({ id: 'run-nofit', project: 'proj-b', specStore: store, spec: 'spec-y', phase: 'implementation' }));

    const view = await buildUsageView([project('proj-b', 'Project B')], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-nofit');

    expect(line?.fit).toBe('does-not-fit');
  });

  it('gives a null fit, and a null remaining, for a document-phase run', async () => {
    const store = newStore();
    writeTasksMd(store, 'spec-doc', TASKS_3_OF_7);
    writeHarnessEvents(store, 'spec-doc', [
      taskDone('run-doc', 'spec-doc', '1'),
      taskDone('run-doc', 'spec-doc', '2'),
      taskDone('run-doc', 'spec-doc', '3'),
    ]);
    writeUsageLog([
      logLine('2026-11-13T10:00:00.000Z', 0.1, null),
      logLine('2026-11-13T11:00:00.000Z', 0.13, 'run-doc'),
    ]);
    writeRateLimit(0.13, FUTURE_RESET);
    writeRun(run({ id: 'run-doc', project: 'proj-c', specStore: store, spec: 'spec-doc', phase: 'document' }));

    const view = await buildUsageView([project('proj-c', 'Project C')], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-doc');

    expect(line?.fit).toBeNull();
    expect(line?.remaining).toBeNull();
  });

  it('gives a null fit when the run has finished no task', async () => {
    const store = newStore();
    writeTasksMd(store, 'spec-zero', TASKS_3_OF_7);
    writeHarnessEvents(store, 'spec-zero', [taskDone('some-other-run', 'spec-zero', '1')]);
    writeUsageLog([
      logLine('2026-11-13T10:00:00.000Z', 0.1, null),
      logLine('2026-11-13T11:00:00.000Z', 0.13, 'run-zero'),
    ]);
    writeRateLimit(0.13, FUTURE_RESET);
    writeRun(run({ id: 'run-zero', project: 'proj-d', specStore: store, spec: 'spec-zero', phase: 'implementation' }));

    const view = await buildUsageView([project('proj-d', 'Project D')], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-zero');

    expect(line?.fit).toBeNull();
  });

  it('gives a null fit when the log holds no line for the run', async () => {
    const store = newStore();
    writeTasksMd(store, 'spec-noattr', TASKS_3_OF_7);
    writeHarnessEvents(store, 'spec-noattr', [
      taskDone('run-noattr', 'spec-noattr', '1'),
      taskDone('run-noattr', 'spec-noattr', '2'),
      taskDone('run-noattr', 'spec-noattr', '3'),
    ]);
    writeUsageLog([
      logLine('2026-11-13T10:00:00.000Z', 0.1, null),
      logLine('2026-11-13T11:00:00.000Z', 0.13, null),
    ]);
    writeRateLimit(0.13, FUTURE_RESET);
    writeRun(run({ id: 'run-noattr', project: 'proj-e', specStore: store, spec: 'spec-noattr', phase: 'implementation' }));

    const view = await buildUsageView([project('proj-e', 'Project E')], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-noattr');

    expect(line?.fit).toBeNull();
  });

  it('gives a null fit when the window has already reset', async () => {
    const store = newStore();
    writeTasksMd(store, 'spec-passed', TASKS_3_OF_7);
    writeHarnessEvents(store, 'spec-passed', [
      taskDone('run-passed', 'spec-passed', '1'),
      taskDone('run-passed', 'spec-passed', '2'),
      taskDone('run-passed', 'spec-passed', '3'),
    ]);
    writeUsageLog([
      logLine('2026-11-13T10:00:00.000Z', 0.1, null),
      logLine('2026-11-13T11:00:00.000Z', 0.13, 'run-passed'),
    ]);
    writeRateLimit(0.13, PAST_RESET);
    writeRun(run({ id: 'run-passed', project: 'proj-f', specStore: store, spec: 'spec-passed', phase: 'implementation' }));

    const view = await buildUsageView([project('proj-f', 'Project F')], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-passed');

    expect(line?.fit).toBeNull();
  });

  it('gives a null fit, and a null remaining, when the spec has no tasks.md', async () => {
    const store = newStore();
    // No tasks.md written for this spec at all.
    mkdirSync(specDir(store, 'spec-notasks'), { recursive: true });
    writeHarnessEvents(store, 'spec-notasks', [
      taskDone('run-notasks', 'spec-notasks', '1'),
      taskDone('run-notasks', 'spec-notasks', '2'),
      taskDone('run-notasks', 'spec-notasks', '3'),
    ]);
    writeUsageLog([
      logLine('2026-11-13T10:00:00.000Z', 0.1, null),
      logLine('2026-11-13T11:00:00.000Z', 0.13, 'run-notasks'),
    ]);
    writeRateLimit(0.13, FUTURE_RESET);
    writeRun(run({ id: 'run-notasks', project: 'proj-g', specStore: store, spec: 'spec-notasks', phase: 'implementation' }));

    const view = await buildUsageView([project('proj-g', 'Project G')], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-notasks');

    expect(line?.fit).toBeNull();
    expect(line?.remaining).toBeNull();
  });

  it('gives window null, and every fit null, when rate-limit.json is absent', async () => {
    const store = newStore();
    writeTasksMd(store, 'spec-nowindow', TASKS_3_OF_7);
    writeHarnessEvents(store, 'spec-nowindow', [
      taskDone('run-nowindow', 'spec-nowindow', '1'),
      taskDone('run-nowindow', 'spec-nowindow', '2'),
      taskDone('run-nowindow', 'spec-nowindow', '3'),
    ]);
    writeUsageLog([
      logLine('2026-11-13T10:00:00.000Z', 0.1, null),
      logLine('2026-11-13T11:00:00.000Z', 0.13, 'run-nowindow'),
    ]);
    // No rate-limit.json written.
    writeRun(run({ id: 'run-nowindow', project: 'proj-h', specStore: store, spec: 'spec-nowindow', phase: 'implementation' }));

    const view = await buildUsageView([project('proj-h', 'Project H')], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-nowindow');

    expect(view.window).toBeNull();
    expect(line?.fit).toBeNull();
  });

  it('counts a distinct task once and excludes another run\'s row, reading does-not-fit at a boundary a miscount would flip', async () => {
    const store = newStore();
    writeTasksMd(store, 'spec-dup', TASKS_3_OF_7);
    writeHarnessEvents(store, 'spec-dup', [
      taskDone('run-dup', 'spec-dup', '1'),
      taskDone('run-dup', 'spec-dup', '1'), // duplicate of the same task: must count once
      taskDone('run-dup', 'spec-dup', '2'),
      taskDone('run-dup', 'spec-dup', '3'),
      taskDone('other-run', 'spec-dup', '4'), // another run's row: must not count
    ]);
    writeUsageLog([
      logLine('2026-11-13T10:00:00.000Z', 0.935, null),
      logLine('2026-11-13T11:00:00.000Z', 0.965, 'run-dup'),
    ]);
    writeRateLimit(0.965, FUTURE_RESET);
    writeRun(run({ id: 'run-dup', project: 'proj-i', specStore: store, spec: 'spec-dup', phase: 'implementation' }));

    const view = await buildUsageView([project('proj-i', 'Project I')], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-dup');

    // done=3 (correct): use/done*remaining = 0.03/3*4 = 0.04 > headroom 0.035 -> does-not-fit.
    // done=4 (either bug): 0.03/4*4 = 0.03 <= 0.035 -> would wrongly read fits.
    expect(line?.fit).toBe('does-not-fit');
  });

  it('computes the burn equal to the task 1 burn function over the same lines', async () => {
    const lines = [
      logLine('2026-11-13T00:00:00.000Z', 0.3, null),
      logLine('2026-11-14T00:00:00.000Z', 0.45, null),
    ];
    writeUsageLog(lines);
    const nowMs = Date.parse('2026-11-14T00:00:00.000Z');

    const view = await buildUsageView([], nowMs);

    expect(view.burn).toBe(computeBurn(lines, nowMs));
    expect(view.burn).not.toBeNull();
  });

  it('lists a live run of a project absent from `projects` with its project id as the name', async () => {
    writeRun(run({ id: 'run-orphan', project: 'proj-missing', specStore: '/tmp/unused-store', spec: 'spec-orphan', phase: 'document' }));

    const view = await buildUsageView([], NOW_MS);
    const line = view.runs.find((r) => r.runId === 'run-orphan');

    expect(line?.projectName).toBe('proj-missing');
  });

  it('does not list a done or an abandoned run', async () => {
    writeRun(run({ id: 'run-done', project: 'proj-j', specStore: '/tmp/unused-store', spec: 'spec-done', status: 'done' }));
    writeRun(run({ id: 'run-abandoned', project: 'proj-j', specStore: '/tmp/unused-store', spec: 'spec-abandoned', status: 'abandoned' }));

    const view = await buildUsageView([], NOW_MS);

    expect(view.runs).toEqual([]);
  });
});
