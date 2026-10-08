import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { buildNowModel } from '../now-model.js';
import type { LedgerEvent } from '../../../watch/ledger.js';
import type { ProjectContext } from '../../project-manager.js';
import type { LaunchRecord, PointerLine } from '../../harness/types.js';

// Contract for src/dashboard/shell/now-model.ts (design.md C4; task 3 _Prompt;
// Requirements 2.7, 2.8, 3.2, 3.3, 3.4, 3.5, 4.1, 4.12).
//
// Reached only through buildNowModel(projects, pointers, launchOf, now, cache?).
//
// === live row detail ===
//
// Criterion "live detail with an open round spawn" (task 3 _Prompt: "detail
//   the newest open level-2 spawn's agent plus `round N` ... when that
//   project has a gate wait"; Req 3.3):
//   Pre-condition: one project with a pointer naming a spec whose ledger has
//   an open (no spawn.end) spawn.start of a non-orchestrator agent carrying
//   `round: '3'`, and no phase.end that would produce a gate wait.
//   Test: buildNowModel([project], [pointer], () => null, now).
//   Observable result: the live row for that project has detail containing
//   both the fixture's own agent name and the literal substring "round 3".
//   Expected-value source: the fixture's own agent/round fields, combined
//   per the quoted "round N" template of the _Prompt sentence.
//
// Criterion "live detail with an open task spawn" (task 3 _Prompt: "...or
//   `task N`"; Req 3.3):
//   Pre-condition: as above but the open spawn.start carries `task: '5'`
//   instead of `round`.
//   Test: buildNowModel([project], [pointer], () => null, now).
//   Observable result: the live row's detail contains the fixture's agent
//   name and the literal substring "task 5".
//   Expected-value source: the fixture's own agent/task fields, combined per
//   the quoted "task N" template.
//
// Criterion "the gate fallback" (task 3 _Prompt: "else `waits on gate A` or
//   `waits on gate B` when that project has a gate wait, else the live
//   phase"; Req 3.3, 2.7, 2.8):
//   Pre-condition: one project with a pointer naming a spec whose ledger has
//   no spawns at all and ends on an un-followed gate-a phase.end (so
//   deriveProjectWaits gives that project a 'gate' wait).
//   Test: buildNowModel([project], [pointer], () => null, now).
//   Observable result: the live row's detail is exactly the literal string
//   "waits on gate A"; the model's `waits` array also carries a 'gate' wait
//   for that project's spec (the same per-project wait the detail fallback
//   reads), folding Req 2.7/2.8's plumbing of the task-2 wait functions
//   through this builder — the pure ordering and derivation rules themselves
//   are covered by src/dashboard/shell/__tests__/waits.test.ts.
//   Expected-value source: the literal quoted template of the _Prompt
//   sentence.
//
// === live row tokens ===
//
// Criterion "tokens" (task 3 _Prompt: "`tokens` is `tokensTotal`"; Req 3.3):
//   Pre-condition: one project with a pointer naming a spec whose ledger has
//   two closed spawns whose spawn.end rows carry tokens '1500' and '500'.
//   Test: buildNowModel([project], [pointer], () => null, now).
//   Observable result: the live row's `tokens` field is 2000.
//   Expected-value source: the sum of the fixture's own two spawn.end
//   `tokens` values, per buildModel's tokensTotal rule the _Prompt cites.
//
// === idle rows ===
//
// Criterion "idle with a launchable spec" and "idle with a disabled reason"
//   (task 3 _Prompt: "`idle`: one row per project with no pointer;
//   `launchable` and `disabledReason` from `new
//   IndexGenerator(project.projectPath).snapshot()` routing by the rule of
//   src/dashboard/harness/run-setup.ts:167-168"; Req 3.4, 4.12 — one idle row
//   feeds both the Now idle group and the Runs/Launch-card idle state, so
//   one test covers both requirement ids):
//   Pre-condition: project A has one spec directory with no documents and no
//   decomposition.md (routing picks it as the only not-complete entry);
//   project B has an empty, existing specs directory (no spec at all).
//   Test: buildNowModel([projectA, projectB], [], () => null, now).
//   Observable result: project A's idle row has `launchable` equal to that
//   spec directory's name and `disabledReason` null; project B's idle row
//   has `launchable` null and `disabledReason` equal to the routing reason
//   string for the no-specs state.
//   Expected-value source: the fixtures' own spec-directory names, and the
//   literal reason string of src/core/spec-routing-deriver.ts's 'no-specs'
//   branch ("No specs exist yet."), read via run-setup.ts:167-168's rule.
//
// === closed rows ===
//
// Criterion "closed at 6 days kept and at 8 days dropped" (task 3 _Prompt:
//   "`closed`: one row per spec whose HANDOFF phase log
//   (`parseHandoffPhaseRows`) holds a `closeout` row with result `closed`
//   dated within 7 days before `now`; `closedOn` is that date"; Req 3.5):
//   Pre-condition: one project with two spec directories, 'closed-6' and
//   'closed-8', and a HANDOFF.md whose `## Phase log` table has a `closeout`
//   row with result `closed` for each, dated 6 and 8 days respectively
//   before a fixed `now`.
//   Test: buildNowModel([project], [], () => null, now).
//   Observable result: a closed row exists for 'closed-6' with `closedOn`
//   equal to its own fixture date; no closed row exists for 'closed-8'.
//   Expected-value source: the fixture's own phase-log dates, computed from
//   the fixed `now` the test passes in.
//
// === runs rows ===
//
// Criterion "run states live, stopped, exited and ended" (task 3 _Prompt:
//   "`runs`: ... state `live` with a pointer, else the launch record's
//   `stopped` or `exited` when the record's `spec` is that spec, else
//   `ended`; `phase` is the live phase, else the phase of the newest ledger
//   `phase.end`, else null"; Req 4.1):
//   Pre-condition: four projects, each with a HANDOFF naming its own spec so
//   `resolveSpec` resolves it, and each spec with a `harness-events.jsonl`:
//   (1) a pointer naming the spec, ledger with an open phase.start (no
//   phase.end) — live phase 'implementation'; (2) no pointer, `launchOf`
//   returns a 'stopped' launch record whose `spec` matches, ledger closed on
//   a phase.end of phase 'design'; (3) no pointer, `launchOf` returns an
//   'exited' launch record whose `spec` matches, ledger closed on a
//   phase.end of phase 'tasks'; (4) no pointer, `launchOf` returns null,
//   ledger closed on a phase.end of phase 'retrospective'.
//   Test: buildNowModel(projects, [pointer for (1)], launchOf, now).
//   Observable result: the runs row state is 'live'/'stopped'/'exited'/
//   'ended' for projects (1)-(4) respectively; phase is 'implementation' for
//   (1) (the live phase) and 'design'/'tasks'/'retrospective' for (2)-(4)
//   (the newest ledger phase.end's phase, since none has a live phase).
//   Expected-value source: the fixtures' own launch-record states and
//   ledger phase values, per the _Prompt sentence's state/phase rule.
//
// === omitted project ===
//
// Criterion "a project whose `launchOf` throws is omitted while the other
//   project's rows remain" (task 3 _Prompt: "A project whose read throws is
//   left out of every group and logged once with `console.error`"):
//   Pre-condition: project Bad has a pointer and a valid ledger (so it would
//   otherwise produce a live row), but the injected `launchOf` throws for
//   its id; project Good has no pointer and one launchable spec directory
//   (so it would produce an idle row).
//   Test: buildNowModel([projectBad, projectGood], [pointer for Bad],
//   launchOf, now).
//   Observable result: the call resolves; no row in `waits`, `live`, `idle`,
//   `closed` or `runs`, and no key in `launches`, names project Bad's id;
//   project Good's idle row is present with its launchable spec name;
//   `console.error` was called exactly once.
//   Expected-value source: the _Prompt sentence quoted above.

function tmpBase(): string {
  return mkdtempSync(join(tmpdir(), 'sdd-now-model-test-'));
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

describe('buildNowModel', () => {
  let base: string;

  beforeEach(() => { base = tmpBase(); });
  afterEach(() => { rmSync(base, { recursive: true, force: true }); });

  it('gives a live row whose detail names the open level-2 spawn\'s agent and round', async () => {
    const { project, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'live-round');
    writeLedger(dir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'implementation' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'spawn.start', run: 'r1', agent: 'sdd-reviewer', role: 'task review', round: '3' },
    ]);

    const model = await buildNowModel([project], [pointerFor(project, 'live-round')], () => null, Date.now());
    const row = model.live.find((r) => r.projectId === project.projectId);
    expect(row?.spec).toBe('live-round');
    expect(row?.detail).toContain('sdd-reviewer');
    expect(row?.detail).toContain('round 3');
  });

  it('gives a live row whose detail names the open level-2 spawn\'s agent and task', async () => {
    const { project, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'live-task');
    writeLedger(dir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'implementation' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'spawn.start', run: 'r1', agent: 'sdd-implementer', role: 'implementation work', task: '5' },
    ]);

    const model = await buildNowModel([project], [pointerFor(project, 'live-task')], () => null, Date.now());
    const row = model.live.find((r) => r.projectId === project.projectId);
    expect(row?.spec).toBe('live-task');
    expect(row?.detail).toContain('sdd-implementer');
    expect(row?.detail).toContain('task 5');
  });

  it('falls back to "waits on gate A" when there is no open spawn and the project has a gate wait', async () => {
    const { project, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'live-gate');
    writeLedger(dir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'document' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'phase.end', run: 'r1', phase: 'document', result: 'gate-a' },
    ]);

    const model = await buildNowModel([project], [pointerFor(project, 'live-gate')], () => null, Date.now());
    const row = model.live.find((r) => r.projectId === project.projectId);
    expect(row?.spec).toBe('live-gate');
    expect(row?.detail).toBe('waits on gate A');
    expect(model.waits.some((w) => w.kind === 'gate' && w.projectId === project.projectId && w.spec === 'live-gate')).toBe(true);
  });

  it('gives a live row whose tokens is buildModel\'s tokensTotal', async () => {
    const { project, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'live-tokens');
    writeLedger(dir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'implementation' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'spawn.start', run: 'r1', agent: 'sdd-reviewer', role: 'review' },
      { ts: '2026-01-01T00:03:00.000Z', type: 'spawn.end', run: 'r1', agent: 'sdd-reviewer', result: 'approved', tokens: '1500' },
      { ts: '2026-01-01T00:04:00.000Z', type: 'spawn.start', run: 'r1', agent: 'sdd-checker', role: 'check' },
      { ts: '2026-01-01T00:05:00.000Z', type: 'spawn.end', run: 'r1', agent: 'sdd-checker', result: 'approved', tokens: '500' },
    ]);

    const model = await buildNowModel([project], [pointerFor(project, 'live-tokens')], () => null, Date.now());
    const row = model.live.find((r) => r.projectId === project.projectId);
    expect(row?.tokens).toBe(2000);
  });

  it('gives an idle row with a launchable spec, and one with a disabled reason', async () => {
    const { project: projectA, specsDir: specsDirA } = makeProject(base, 'Project A');
    makeSpecDir(specsDirA, 'idle-spec');
    const { project: projectB } = makeProject(base, 'Project B');

    const model = await buildNowModel([projectA, projectB], [], () => null, Date.now());

    const idleA = model.idle.find((r) => r.projectId === projectA.projectId);
    expect(idleA?.launchable).toBe('idle-spec');
    expect(idleA?.disabledReason).toBeNull();

    const idleB = model.idle.find((r) => r.projectId === projectB.projectId);
    expect(idleB?.launchable).toBeNull();
    expect(idleB?.disabledReason).toBe('No specs exist yet.');
  });

  it('keeps a closed row dated 6 days before now and drops one dated 8 days before now', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'closed-6');
    makeSpecDir(specsDir, 'closed-8');

    const now = Date.parse('2026-02-10T00:00:00.000Z');
    const day = 24 * 60 * 60 * 1000;
    const date6 = new Date(now - 6 * day).toISOString().slice(0, 10);
    const date8 = new Date(now - 8 * day).toISOString().slice(0, 10);

    writeFileSync(join(workflowRoot, 'HANDOFF.md'), [
      '## Phase log',
      '',
      '| Date | Spec | Stage | State | Result | Note |',
      '| --- | --- | --- | --- | --- | --- |',
      `| ${date6} | closed-6 | closeout | complete | closed | closed six days ago |`,
      `| ${date8} | closed-8 | closeout | complete | closed | closed eight days ago |`,
      '',
    ].join('\n'));

    const model = await buildNowModel([project], [], () => null, now);

    const c6 = model.closed.find((r) => r.spec === 'closed-6');
    expect(c6).toBeDefined();
    expect(c6?.projectId).toBe(project.projectId);
    expect(c6?.closedOn).toBe(date6);

    const c8 = model.closed.find((r) => r.spec === 'closed-8');
    expect(c8).toBeUndefined();
  });

  it('gives a runs row the state live, stopped, exited or ended, with the matching phase', async () => {
    const now = Date.now();

    // (1) live: a pointer, open phase.start, no phase.end — live phase 'implementation'.
    const { project: live, specsDir: liveSpecsDir, workflowRoot: liveRoot } = makeProject(base, 'Live Project');
    const liveDir = makeSpecDir(liveSpecsDir, 'run-live');
    writeFileSync(join(liveRoot, 'HANDOFF.md'), handoffFixture('run-live'));
    writeLedger(liveDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'implementation' },
    ]);

    // (2) stopped: no pointer; launchOf gives a 'stopped' record for this spec; closed ledger.
    const { project: stopped, specsDir: stoppedSpecsDir, workflowRoot: stoppedRoot } = makeProject(base, 'Stopped Project');
    const stoppedDir = makeSpecDir(stoppedSpecsDir, 'run-stopped');
    writeFileSync(join(stoppedRoot, 'HANDOFF.md'), handoffFixture('run-stopped'));
    writeLedger(stoppedDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r2' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r2', phase: 'design' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'phase.end', run: 'r2', phase: 'design', result: 'approved' },
      { ts: '2026-01-01T00:03:00.000Z', type: 'run.end', run: 'r2', status: 'stopped' },
    ]);
    const stoppedLaunch = baseLaunch({ projectId: stopped.projectId, spec: 'run-stopped', state: 'stopped' });

    // (3) exited: no pointer; launchOf gives an 'exited' record for this spec; closed ledger.
    const { project: exited, specsDir: exitedSpecsDir, workflowRoot: exitedRoot } = makeProject(base, 'Exited Project');
    const exitedDir = makeSpecDir(exitedSpecsDir, 'run-exited');
    writeFileSync(join(exitedRoot, 'HANDOFF.md'), handoffFixture('run-exited'));
    writeLedger(exitedDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r3' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r3', phase: 'tasks' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'phase.end', run: 'r3', phase: 'tasks', result: 'gate-b' },
      { ts: '2026-01-01T00:03:00.000Z', type: 'run.end', run: 'r3', status: 'exited' },
    ]);
    const exitedLaunch = baseLaunch({ projectId: exited.projectId, spec: 'run-exited', state: 'exited', runId: 'r3' });

    // (4) ended: no pointer, launchOf null, closed ledger.
    const { project: ended, specsDir: endedSpecsDir, workflowRoot: endedRoot } = makeProject(base, 'Ended Project');
    const endedDir = makeSpecDir(endedSpecsDir, 'run-ended');
    writeFileSync(join(endedRoot, 'HANDOFF.md'), handoffFixture('run-ended'));
    writeLedger(endedDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r4' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r4', phase: 'retrospective' },
      { ts: '2026-01-01T00:02:00.000Z', type: 'phase.end', run: 'r4', phase: 'retrospective', result: 'approved' },
      { ts: '2026-01-01T00:03:00.000Z', type: 'run.end', run: 'r4', status: 'done' },
    ]);

    const launchOf = (projectId: string): LaunchRecord | null => {
      if (projectId === stopped.projectId) return stoppedLaunch;
      if (projectId === exited.projectId) return exitedLaunch;
      return null;
    };

    const model = await buildNowModel(
      [live, stopped, exited, ended],
      [pointerFor(live, 'run-live')],
      launchOf,
      now,
    );

    const liveRow = model.runs.find((r) => r.projectId === live.projectId);
    expect(liveRow?.state).toBe('live');
    expect(liveRow?.phase).toBe('implementation');

    const stoppedRow = model.runs.find((r) => r.projectId === stopped.projectId);
    expect(stoppedRow?.state).toBe('stopped');
    expect(stoppedRow?.phase).toBe('design');

    const exitedRow = model.runs.find((r) => r.projectId === exited.projectId);
    expect(exitedRow?.state).toBe('exited');
    expect(exitedRow?.phase).toBe('tasks');

    const endedRow = model.runs.find((r) => r.projectId === ended.projectId);
    expect(endedRow?.state).toBe('ended');
    expect(endedRow?.phase).toBe('retrospective');
  });

  it('labels the live runs row with the pointer\'s spec when HANDOFF names a different spec', async () => {
    // The pointer and the HANDOFF disagree: resolveSpec names 'spec-handoff'
    // but the active-run pointer names 'spec-pointer' with runId 'run-ptr'. The
    // live runs row's runId comes from the pointer, so its spec label must come
    // from the same source — the pointer's spec, not the HANDOFF spec.
    const { project, specsDir, workflowRoot } = makeProject(base, 'Mismatch Project');
    const handoffDir = makeSpecDir(specsDir, 'spec-handoff');
    const pointerDir = makeSpecDir(specsDir, 'spec-pointer');
    writeFileSync(join(workflowRoot, 'HANDOFF.md'), handoffFixture('spec-handoff'));
    writeLedger(handoffDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-handoff' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'run-handoff', phase: 'implementation' },
    ]);
    writeLedger(pointerDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-ptr' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'run-ptr', phase: 'implementation' },
    ]);

    const model = await buildNowModel(
      [project],
      [pointerFor(project, 'spec-pointer', 'run-ptr')],
      () => null,
      Date.now(),
    );

    const runsRow = model.runs.find((r) => r.projectId === project.projectId);
    expect(runsRow?.state).toBe('live');
    expect(runsRow?.runId).toBe('run-ptr');
    expect(runsRow?.spec).toBe('spec-pointer');
  });

  it('omits a project whose launchOf throws from every group, logging once, while the other project\'s rows remain', async () => {
    const { project: bad, specsDir: badSpecsDir } = makeProject(base, 'Bad Project');
    const badDir = makeSpecDir(badSpecsDir, 'bad-spec');
    writeLedger(badDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
      { ts: '2026-01-01T00:01:00.000Z', type: 'phase.start', run: 'r1', phase: 'implementation' },
    ]);

    const { project: good, specsDir: goodSpecsDir } = makeProject(base, 'Good Project');
    makeSpecDir(goodSpecsDir, 'good-spec');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const launchOf = (projectId: string): LaunchRecord | null => {
      if (projectId === bad.projectId) throw new Error('boom');
      return null;
    };

    try {
      const model = await buildNowModel([bad, good], [pointerFor(bad, 'bad-spec')], launchOf, Date.now());

      expect(model.waits.some((w) => w.projectId === bad.projectId)).toBe(false);
      expect(model.live.some((r) => r.projectId === bad.projectId)).toBe(false);
      expect(model.idle.some((r) => r.projectId === bad.projectId)).toBe(false);
      expect(model.closed.some((r) => r.projectId === bad.projectId)).toBe(false);
      expect(model.runs.some((r) => r.projectId === bad.projectId)).toBe(false);
      expect(model.launches[bad.projectId]).toBeUndefined();

      const goodIdle = model.idle.find((r) => r.projectId === good.projectId);
      expect(goodIdle?.launchable).toBe('good-spec');

      expect(errorSpy).toHaveBeenCalledTimes(1);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
