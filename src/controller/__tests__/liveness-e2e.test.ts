// src/controller/__tests__/liveness-e2e.test.ts
//
// Design end-to-end scenario 1 (design.md "Testing Strategy"): a stub step
// streams lines, `lastActivity` appears, is absent within 1 second of the
// end, and a cancel mid-step leaves the run `abandoned` with the field
// absent. Task 4 Success (c)-(e). Fixture setup copied from
// `controller.test.ts:95-117` (`setup`) and `:163-172` (`makeController`).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, chmodSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { Controller } from '../controller.js';
import { readRun, writeRun, readWait, type RunRecord } from '../state.js';
import { listOpenWaits, createWait, DRIVE_CRASH_QUESTION, type ControllerWaitRecord } from '../waits.js';
import { approvalsHandler } from '../../tools/approvals.js';
import { launchSpec } from '../../dashboard/multi-server.js';
import { buildSetupView, defaultSetupInput } from '../../dashboard/harness/run-setup.js';
import type { ProjectContext } from '../../dashboard/project-manager.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-claude.mjs');
const STUB_GH = join(HERE, '..', '..', '..', 'scripts', 'stub-gh.mjs');
const SPEC = 'ctrl-live';
const savedEnv = { ...process.env };

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

function cleanDoc(title: string): string {
  return [
    `# ${title}`, '',
    '## Introduction',
    'The controller drafts documents. It serves the operator. It changes nothing else.', '',
    '## Requirements',
    'The controller SHALL draft, review and approve each document in order.', '',
    '## Revision History', '- **v1** (2026-10-11) — Initial draft.', '',
  ].join('\n');
}

const USAGE = {
  input_tokens: 5, output_tokens: 50, cache_read_input_tokens: 10,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 },
};

interface StubRun {
  edits?: { path: string; content: string }[];
  result: Record<string, unknown>;
  stream?: unknown[];
  eventDelayMs?: number;
  commands?: string[];
}

/**
 * The requirements draft step, scripted to stream `count` plain assistant
 * events (none of them `tool_use`, so this also exercises Requirement 1 AC 2 —
 * every parsed line is activity, not only tool use) with `eventDelayMs`
 * between each printed line, so a test can observe the step mid-stream.
 */
function streamingDraftRun(doc: string, count: number, eventDelayMs: number): StubRun {
  const stream = Array.from({ length: count }, (_, i) => ({
    type: 'assistant',
    message: { content: [{ type: 'text', text: `thinking ${i}` }] },
  }));
  return {
    stream,
    eventDelayMs,
    edits: [
      { path: `.spec-workflow/specs/${SPEC}/${doc}.md`, content: cleanDoc(doc) },
      { path: `.spec-workflow/specs/${SPEC}/codebase-context.md`, content: '# ctx\n' },
    ],
    result: {
      subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'drafted',
      structured_output: { wordCount: 40, decisions: [], contextFileWritten: true }, usage: USAGE,
    },
  };
}

function reviewerRun(suffix: string): { edits: { path: string; content: string }[]; result: Record<string, unknown> } {
  return {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/reviews/adversarial-analysis-${suffix}.md`, content: 'ok\nVERDICT: converged\n' }],
    result: { subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'reviewed', structured_output: { verdict: 'converged', mustFix: [], shouldFix: [], recurring: [], escalate: 'none', analysisPath: '' }, usage: USAGE },
  };
}
const PROPOSALS = [
  `# Retrospective proposals — ${SPEC}`, '',
  '## Proposals',
  '- **P1 (F1) — Tidy the ledger.** Make it nicer.',
  '  Target: harness skills or agents.',
  '  DECISION NEEDED: no.', '',
  '## Graduation candidates', 'None found.', '',
].join('\n');
/** The in-code implementation phase on an empty tasks document: one end-to-end verifier step. */
function e2eRun(): { result: Record<string, unknown> } {
  return {
    result: {
      subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'VERIFY: pass',
      structured_output: { verify: 'pass', deferredCommand: '', findings: '', retro: 'none' }, usage: USAGE,
    },
  };
}
/** The retrospective in code: the compile step writes the findings, the analyst the proposals. */
function compileRun(): { edits: { path: string; content: string }[]; result: Record<string, unknown> } {
  return {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/retrospective.md`, content: ['# Retrospective — ' + SPEC, '', '## Gotchas', '- **F1 — x.** y. Evidence: z. Frequency: once. Cost: 1.', '', '## Proposal format (for the analyst)', '', 'One per finding.', ''].join('\n') }],
    result: { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'compiled', structured_output: { findings: 1, path: 'retrospective.md' }, usage: USAGE },
  };
}
function analystRun(): { edits: { path: string; content: string }[]; result: Record<string, unknown> } {
  return {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/retrospective-proposals.md`, content: PROPOSALS }],
    result: { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'proposed', structured_output: { proposals: 1 }, usage: USAGE },
  };
}
/** Close-out in code: one implementer batch for the plan's harness item, landed in the retro worktree. */
function closeoutBatchRun(): { commands: string[]; result: Record<string, unknown> } {
  return {
    commands: [`echo note >> harness-note.md && git add harness-note.md && git commit -qm "chore(retro): ${SPEC} P1 tidy"`],
    result: { subtype: 'success', is_error: false, num_turns: 4, session_id: 's', result: 'P1: done', structured_output: { items: [{ id: 'P1', status: 'done', commit: 'none', reason: '' }], retro: 'none' }, usage: USAGE },
  };
}

interface Fixture { base: string; repo: string; specDir: string; home: string; }

function setup(): Fixture {
  const base = mkdtempSync(join(tmpdir(), 'ctrl-live-'));
  const repo = join(base, 'repo');
  const specDir = join(repo, '.spec-workflow', 'specs', SPEC);
  mkdirSync(specDir, { recursive: true });
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 't@test']);
  git(repo, ['config', 'user.name', 'Tester']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(repo, 'README.md'), 'init\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'init']);
  const home = join(base, 'home');
  mkdirSync(home, { recursive: true });
  process.env.SDD_HOME = home;
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.CONTROLLER_HARNESS_REPO = repo;
  process.env.CONTROLLER_GH_BIN = STUB_GH;
  return { base, repo, specDir, home };
}

function writeScript(fx: Fixture, runs: StubRun[]): void {
  const scriptPath = join(fx.base, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
}

function makeController(fx: Fixture): Controller {
  return new Controller({
    resolveProject: () => ({ projectPath: fx.repo, workspacePath: fx.repo }),
    mcpConfigFor: () => ({ mcpServers: {} }),
    ensureWorktree: async () => ({ worktree: fx.repo, branch: 'main' }),
    claudeBin: () => STUB,
    tickMs: 25,
    graceMs: 1500,
  });
}

/** A controller whose `mcpConfigFor` is the test's crash seam (design D15). */
function makeCrashingController(
  fx: Fixture, mcpConfigFor: () => string | Record<string, unknown> | undefined,
): Controller {
  return new Controller({
    resolveProject: () => ({ projectPath: fx.repo, workspacePath: fx.repo }),
    mcpConfigFor,
    ensureWorktree: async () => ({ worktree: fx.repo, branch: 'main' }),
    claudeBin: () => STUB,
    tickMs: 25,
    graceMs: 1500,
  });
}

/**
 * Script `gh` to present one green, mergeable PR on `branch` so the merge stage
 * merges it: a completed implementation must reach a merged PR before the retro.
 */
const GH_RUNS_OK = { argvIncludes: ['api'], stdout: { total_count: 1, workflow_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }] } };
const GH_STATUS_OK = { argvIncludes: ['api'], stdout: { state: 'pending', total_count: 0, statuses: [] } };

function scriptMergeablePR(fx: Fixture, branch: string, oid: string): void {
  const view = {
    mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
    headRefName: branch, headRefOid: 'deadbeefcafe', body: 'Clean body.',
    commits: [{ oid: 'deadbeefcafe', messageHeadline: 'feat: do it', messageBody: '', committedDate: '2026-11-03T11:00:00.000Z' }],
    author: { login: 'someone' },
  };
  const ghScript = join(fx.base, 'gh-script.json');
  writeFileSync(ghScript, JSON.stringify([
    { argvIncludes: ['pr', 'list'], stdout: [{ number: 7, headRefName: branch, baseRefName: 'main', url: 'x' }] },
    { argvIncludes: ['pr', 'view'], stdout: view },
    GH_RUNS_OK, GH_STATUS_OK,
    { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
    { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid } } },
  ]));
  process.env.STUB_GH_SCRIPT = ghScript;
}

async function approve(fx: Fixture, doc: 'requirements' | 'design' | 'tasks'): Promise<void> {
  const ctx = { projectPath: fx.repo, workspacePath: fx.repo };
  writeFileSync(join(fx.specDir, `${doc}.md`), cleanDoc(doc));
  const req = await approvalsHandler({
    action: 'request', title: `${SPEC} ${doc}`, filePath: `.spec-workflow/specs/${SPEC}/${doc}.md`,
    type: 'document', category: 'spec', categoryName: SPEC,
  }, ctx);
  const approvalId = (req.data as { approvalId: string }).approvalId;
  await approvalsHandler({ action: 'approve', approvalId, response: 'ok' }, ctx);
}

/** A `running` run with no live step, for crash recovery (or `redrive`) to pick up. */
async function seedRunningRun(fx: Fixture, id: string, extra: Partial<RunRecord> = {}): Promise<void> {
  const iso = new Date().toISOString();
  await writeRun({
    v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
    worktree: fx.repo, branch: 'main', status: 'running', created: iso, updated: iso,
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    ...extra,
  });
}

/** The open drive-crash wait for a run, by its question id (design C6). */
function crashWaitFor(waits: ControllerWaitRecord[], id: string): ControllerWaitRecord | undefined {
  return waits.find((w) => w.run === id && w.questions.some((q) => q.id === DRIVE_CRASH_QUESTION));
}

/** Poll `predicate` against the run on disk every 5ms until it is true or `ms` elapses. */
async function waitForRun(
  id: string, predicate: (run: RunRecord | undefined) => boolean, ms: number, onTimeout: string,
): Promise<RunRecord | undefined> {
  const deadline = Date.now() + ms;
  for (;;) {
    const run = await readRun(id);
    if (predicate(run)) return run;
    if (Date.now() > deadline) throw new Error(onTimeout);
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** Poll until the run reaches `status`, or throw after `ms`. */
async function waitForStatus(id: string, status: RunRecord['status'], ms = 15000): Promise<RunRecord> {
  const run = await waitForRun(id, (r) => r?.status === status, ms, `run ${id} never reached ${status}`);
  return run as RunRecord;
}

let fx: Fixture;
let controller: Controller | null;
beforeEach(() => { chmodSync(STUB, 0o755); chmodSync(STUB_GH, 0o755); fx = setup(); controller = null; });
afterEach(async () => {
  if (controller) { try { await controller.stop(); } catch { /* ignore */ } controller = null; }
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ }
});

// Source: tasks.md task 4 Success (c)-(e); design C3, "Testing Strategy"
// end-to-end scenario 1; Requirements 1.2, 1.4, 1.7.
describe('liveness e2e: Controller.enqueue with a stub step that streams lines', () => {
  it('writes lastActivity to run.json while the stub step streams', async () => {
    writeScript(fx, [streamingDraftRun('requirements', 6, 80)]);
    controller = makeController(fx);
    await controller.start();

    // Test: Controller.enqueue with a stub step that streams lines.
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    // Observable result: while the step is still running, `lastActivity` is a
    // string on the record. Source: task 4 Success (c), Requirement 1 AC 2-3.
    const seen = await waitForRun(
      id,
      (run) => run?.status === 'running' && typeof run.lastActivity === 'string',
      3000,
      'lastActivity never appeared on a running run',
    );
    expect(seen?.status).toBe('running');
    expect(typeof seen?.lastActivity).toBe('string');
  });

  it('clears lastActivity within 1 second of the step ending', async () => {
    writeScript(fx, [streamingDraftRun('requirements', 6, 80)]);
    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    // Pre-condition: the step is actually streaming and writing the field
    // (otherwise "absent" below would hold trivially, with nothing to clear).
    await waitForRun(
      id,
      (run) => typeof run?.lastActivity === 'string',
      3000,
      'lastActivity never appeared before the step ended',
    );

    // Test: continue driving until the step itself ends (`inFlight` clears;
    // by this point in the run `inFlight` is already known set, so this is
    // the step's end, not the pre-spawn state).
    // Observable result: by then `lastActivity` is already absent — the
    // writer task 1 orders the heartbeat's clear before the end-of-step
    // write, so this holds well inside the 1-second budget. Source: task 4
    // Success (d), Requirement 1 AC 4.
    const ended = await waitForRun(
      id,
      (run) => run != null && run.inFlight === undefined,
      3000,
      'the step never ended with inFlight cleared',
    );
    expect(ended?.lastActivity).toBeUndefined();
  });

  it('leaves status abandoned with lastActivity absent when cancelled during the step', async () => {
    writeScript(fx, [streamingDraftRun('requirements', 20, 150)]);
    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    // Pre-condition: the step is actually streaming and writing the field.
    await waitForRun(
      id,
      (run) => typeof run?.lastActivity === 'string',
      3000,
      'lastActivity never appeared before cancel',
    );

    // Test: cancel the run while its step is still in flight.
    await controller.cancel(id);

    // Observable result: `abandoned`, with the field absent. Source: task 4
    // Success (e), Requirement 1 AC 7.
    const run = await readRun(id);
    expect(run?.status).toBe('abandoned');
    expect(run?.lastActivity).toBeUndefined();
  });
});

// Contract for `controller.cancel` leaving the driver final on every cancel
// path (design C7 "Driver checks", Requirement 7 AC 1, AC 2; the design
// Verification line: "a cancel during a live step leaves the run abandoned,
// with no second claude -p, no new wait and no status change in the next 60
// seconds"). Pre: a live drafter step streaming, a second scripted run that
// would be a second drafter if the fix is missing. Test: `controller.cancel(id)`
// while the step is in flight. Observable result: the signalled step's
// `error` classification reaches `handleDocumentOutcome`'s fresh-retry
// branch; the run is `abandoned` with exactly one `spawn.start` row (no
// second drafter), no wait open, and the status still reads `abandoned` on a
// later read. Expected value source: the task's own Success line and design
// C7 "Driver checks" ("The four handle*Outcome functions return 'stop' first
// when runCancelled: no retry, no wait").
describe('liveness e2e: a cancel during a document step leaves the driver final (design C7 "Driver checks", Requirement 7 AC 1, AC 2)', () => {
  it('controller.cancel during the drafter step spawns no second drafter and opens no wait', async () => {
    writeScript(fx, [
      streamingDraftRun('requirements', 20, 150),
      streamingDraftRun('requirements', 1, 0), // the second drafter, if the fix is missing
    ]);
    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    await waitForRun(
      id,
      (run) => typeof run?.lastActivity === 'string',
      3000,
      'lastActivity never appeared before cancel',
    );

    await controller.cancel(id);

    // Let the driver finish processing the killed step's outcome.
    await new Promise((r) => setTimeout(r, 1000));

    const run = await readRun(id);
    expect(run?.status).toBe('abandoned');
    expect((await listOpenWaits()).filter((w) => w.run === id)).toHaveLength(0);
    const rows = readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8')
      .trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, string>);
    expect(rows.filter((r) => r.type === 'spawn.start')).toHaveLength(1);

    // The status holds at a later read (the design Verification window).
    await new Promise((r) => setTimeout(r, 500));
    expect((await readRun(id))?.status).toBe('abandoned');
  }, 15000);
});

// Design end-to-end scenario 2 (design.md "Testing Strategy"): a throw through
// `mcpConfigFor` gives `driven: false` within 5 seconds, the wait names the
// cursor's step and the error message, `redrive` resumes from the cursor, and
// a restart drives the run with no operator action. Task 8 Success (m).
describe('liveness e2e: scenario 2 — redrive and restart recovery after a crashed drive', () => {
  it('a crashed drive reads undriven within 5s and names the step and message; redrive resumes it from the cursor', async () => {
    writeFileSync(join(fx.specDir, 'requirements.md'), cleanDoc('requirements'));
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', `docs(sdd): ${SPEC} requirements v1`]);
    await approve(fx, 'design');
    await approve(fx, 'tasks');

    writeScript(fx, [
      reviewerRun('requirements'), e2eRun(), compileRun(), analystRun(), closeoutBatchRun(),
    ] as StubRun[]);
    scriptMergeablePR(fx, 'main', 'c0ffee100001');

    const id = 'run-20261103-e2e0001';
    const iso = '2026-11-03T05:05:05.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: fx.repo, branch: 'main', status: 'running', created: iso, updated: iso,
      phase: 'requirements', cursor: { phase: 'requirements', stepKind: 'reviewer', attempt: 1 },
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    let throwOnce = true;
    controller = makeCrashingController(fx, () => {
      if (throwOnce) { throwOnce = false; throw new Error('boom'); }
      return { mcpServers: {} };
    });
    await controller.start();

    const crashed = await waitForStatus(id, 'waiting');
    expect(crashed.inFlight).toBeUndefined();

    // Test: `driven` reads false within 5 seconds (Requirement 2 AC 5).
    const deadline = Date.now() + 5000;
    while (controller.drivenRuns().has(id) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(controller.drivenRuns().has(id)).toBe(false);

    const wait = crashWaitFor(await listOpenWaits(), id);
    expect(wait).toBeTruthy();
    expect(wait!.questions[0].text).toBe('step reviewer failed inside the controller: boom');

    // Test: `controller.redrive(id)`.
    expect(await controller.redrive(id)).toBe('ok');

    // Observable result: the run resumes from its cursor and finishes the
    // document, implementation and retro phases through to the retro-plan
    // wait, proving the resume actually ran rather than silently no-op-ing.
    await waitForRun(
      id, (run) => run?.status === 'waiting' && run.phase === 'retrospective', 15000,
      'the redriven run never reached the retro-plan wait',
    );
    const retro = (await listOpenWaits()).find((w) => w.run === id && w.kind === 'retro-plan');
    expect(retro).toBeTruthy();
  }, 20000);

  it('a restart expires the open crash wait and redrives the run with no operator action', async () => {
    writeFileSync(join(fx.specDir, 'requirements.md'), cleanDoc('requirements'));
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', `docs(sdd): ${SPEC} requirements v1`]);
    await approve(fx, 'design');
    await approve(fx, 'tasks');

    writeScript(fx, [
      reviewerRun('requirements'), e2eRun(), compileRun(), analystRun(), closeoutBatchRun(),
    ] as StubRun[]);
    scriptMergeablePR(fx, 'main', 'c0ffee100002');

    const id = 'run-20261103-e2e0002';
    const iso = '2026-11-03T06:06:06.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: fx.repo, branch: 'main', status: 'running', created: iso, updated: iso,
      phase: 'requirements', cursor: { phase: 'requirements', stepKind: 'reviewer', attempt: 1 },
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    // The controller crashes once and is stopped (simulating it dying) before
    // anyone — human or `redrive` — answers the crash wait it left open.
    const crashing = makeCrashingController(fx, () => { throw new Error('boom'); });
    await crashing.start();
    await waitForStatus(id, 'waiting');
    const wait = crashWaitFor(await listOpenWaits(), id);
    expect(wait).toBeTruthy();
    await crashing.stop();

    // Test: `controller.start()` recovery, on a fresh controller instance
    // (the restart) whose `mcpConfigFor` no longer throws, with no operator
    // action taken on the open wait.
    controller = makeController(fx);
    await controller.start();

    await waitForRun(
      id, (run) => run?.status === 'waiting' && run.phase === 'retrospective', 15000,
      'the restarted run never reached the retro-plan wait',
    );
    const retro = (await listOpenWaits()).find((w) => w.run === id && w.kind === 'retro-plan');
    expect(retro).toBeTruthy();
    expect((await readWait(wait!.id))?.state).toBe('expired');
  }, 20000);
});

// Design end-to-end scenario 3 (design.md "Testing Strategy"): a stub step
// killed by signal retries as today, with `drivenRuns()` true throughout —
// a regression guard, Requirement 2 AC 7 (holds at base: the kill-and-retry
// classification in `step.ts`/`runs.ts` and `drivenRuns()` from task 7 are
// both already shipped; task 8 adds nothing this scenario exercises). Task 8
// Success (n).
describe('liveness e2e: scenario 3 — a killed stub step retries with driven true throughout (regression guard)', () => {
  it('regression guard: a step killed by signal is retried, with drivenRuns() reading true at every poll', async () => {
    writeScript(fx, [
      streamingDraftRun('requirements', 40, 50), // long enough to kill mid-stream
      streamingDraftRun('requirements', 1, 0), // the one fresh retry succeeds
    ]);
    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    const firstFlight = await waitForRun(
      id, (run) => run?.inFlight != null, 3000, 'the step never reported inFlight',
    );
    expect(controller.drivenRuns().has(id)).toBe(true);
    const firstPid = firstFlight!.inFlight!.pid;

    const seenDriven: boolean[] = [];
    const pollTimer = setInterval(() => { seenDriven.push(controller!.drivenRuns().has(id)); }, 5);
    try {
      process.kill(firstPid, 'SIGTERM');

      // Observable result: the controller classifies the kill and retries
      // once (`RUN_FRESH_RETRY`), spawning a fresh step (a new pid).
      const retried = await waitForRun(
        id,
        (run) => run?.inFlight != null && run.inFlight.pid !== firstPid,
        5000,
        'the killed step was never retried',
      );
      expect(retried).toBeTruthy();
    } finally {
      clearInterval(pollTimer);
    }

    expect(seenDriven.length).toBeGreaterThan(0);
    expect(seenDriven.every(Boolean)).toBe(true);
  }, 15000);
});

// Design end-to-end scenario 5 (design.md "Testing Strategy", C10): launch
// routing widens to every state that names no spec, so an `ambiguous` store
// with a decomposition-named-but-not-yet-created spec still launches —
// `launchSpec` creates that spec's directory before it enqueues, as it
// already does today (multi-server.ts:118-123); only the routing guard that
// makes the spec launchable in the first place is new (task 14, Requirement
// 6 AC 5).
describe('liveness e2e: scenario 5 — launch routes to an unstarted decomposition spec, creating its directory', () => {
  it('launchSpec creates the directory and enqueues when ambiguous routing names an unstarted decomposition spec', async () => {
    const decompDir = join(fx.repo, '.spec-workflow', 'spec-decomposition');
    mkdirSync(decompDir, { recursive: true });
    writeFileSync(join(decompDir, 'decomposition.md'), '# Plan\n\n### 1. `spec-next` — next\n');
    mkdirSync(join(fx.repo, '.spec-workflow', 'specs', 'spec-extra'), { recursive: true });

    const project = { projectId: 'p', projectPath: fx.repo } as ProjectContext;

    // Test: buildSetupView(project, {}) — confirm the fixture is the intended
    // ambiguous, no-directory-yet state before exercising launchSpec.
    const view = await buildSetupView(project);
    expect(view.routing.state).toBe('ambiguous');
    expect(view.launchable).toBe('spec-next');

    controller = makeController(fx);
    const specDir = join(fx.repo, '.spec-workflow', 'specs', 'spec-next');
    expect(existsSync(specDir)).toBe(false);

    // Test: launchSpec(project, input, controller).
    const result = await launchSpec(project, defaultSetupInput(view), controller);

    // Observable result: the directory is created and the run is enqueued.
    // Source: task 14 Success (c), Requirement 6 AC 5.
    expect(result.ok).toBe(true);
    expect(existsSync(specDir)).toBe(true);
    if (result.ok) {
      const run = await readRun(result.runId);
      expect(run?.status).toBe('queued');
    }
  });
});
