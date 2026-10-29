import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { Controller } from '../controller.js';
import { writeRun, readRun, writeRateLimit, readRateLimit, type RunRecord } from '../state.js';
import { listOpenWaits, answerWait, createWait } from '../waits.js';
import { approvalsHandler } from '../../tools/approvals.js';
import { runEvents } from '../runs.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-claude.mjs');
const STUB_GH = join(HERE, '..', '..', '..', 'scripts', 'stub-gh.mjs');
const SPEC = 'ctrl-ctl';
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
interface StubRun { edits?: { path: string; content: string }[]; commands?: string[]; result: Record<string, unknown>; }

function drafterRun(doc: string): StubRun {
  return {
    edits: [
      { path: `.spec-workflow/specs/${SPEC}/${doc}.md`, content: cleanDoc(doc) },
      { path: `.spec-workflow/specs/${SPEC}/codebase-context.md`, content: `# ctx\n` },
    ],
    result: { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'drafted', structured_output: { wordCount: 40, decisions: [], contextFileWritten: true }, usage: USAGE },
  };
}
function reviewerRun(suffix: string): StubRun {
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
function e2eRun(): StubRun {
  return {
    result: {
      subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'VERIFY: pass',
      structured_output: { verify: 'pass', deferredCommand: '', findings: '', retro: 'none' }, usage: USAGE,
    },
  };
}
/** The retrospective in code: the compile step writes the findings, the analyst the proposals. */
function compileRun(): StubRun {
  return {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/retrospective.md`, content: ['# Retrospective — ' + SPEC, '', '## Gotchas', '- **F1 — x.** y. Evidence: z. Frequency: once. Cost: 1.', '', '## Proposal format (for the analyst)', '', 'One per finding.', ''].join('\n') }],
    result: { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'compiled', structured_output: { findings: 1, path: 'retrospective.md' }, usage: USAGE },
  };
}
function analystRun(): StubRun {
  return {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/retrospective-proposals.md`, content: PROPOSALS }],
    result: { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'proposed', structured_output: { proposals: 1 }, usage: USAGE },
  };
}
/** Close-out in code: one implementer batch for the plan's harness item, landed in the retro worktree. */
function closeoutBatchRun(): StubRun {
  return {
    commands: [`echo note >> harness-note.md && git add harness-note.md && git commit -qm "chore(retro): ${SPEC} P1 tidy"`],
    result: { subtype: 'success', is_error: false, num_turns: 4, session_id: 's', result: 'P1: done', structured_output: { items: [{ id: 'P1', status: 'done', commit: 'none', reason: '' }], retro: 'none' }, usage: USAGE },
  };
}

interface Fixture { base: string; repo: string; specDir: string; home: string; }

function setup(): Fixture {
  const base = mkdtempSync(join(tmpdir(), 'ctrl-ctl-'));
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
  // Close-out lands harness items in a retro worktree of this fixture repo, never the real checkout.
  process.env.CONTROLLER_HARNESS_REPO = repo;
  // The merge stage shells out to `gh`; the stub with no script reports no open
  // PR (empty stdout), so the merge step is a no-op unless a test scripts it.
  process.env.CONTROLLER_GH_BIN = STUB_GH;
  return { base, repo, specDir, home };
}

function writeScript(fx: Fixture, runs: StubRun[]): void {
  const scriptPath = join(fx.base, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
}

/**
 * Script `gh` to present one green, mergeable PR on `branch` so the merge stage
 * merges it: a completed implementation must reach a merged PR before the retro
 * (no silent skip when there is no PR).
 */
/** The two CI reads that follow every `pr view`: one green workflow run, no commit status. */
const GH_RUNS_OK = { argvIncludes: ['api'], stdout: { total_count: 1, workflow_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }] } };
const GH_STATUS_OK = { argvIncludes: ['api'], stdout: { state: 'pending', total_count: 0, statuses: [] } };

function scriptMergeablePR(fx: Fixture, branch: string, oid: string): void {
  const view = {
    mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
    headRefName: branch, headRefOid: 'deadbeefcafe', body: 'Clean body.',
    commits: [{ oid: 'deadbeefcafe', messageHeadline: 'feat: do it', messageBody: '', committedDate: '2026-10-11T11:00:00.000Z' }],
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

async function waitForStatus(id: string, status: RunRecord['status'], ms = 15000): Promise<RunRecord> {
  const deadline = Date.now() + ms;
  for (;;) {
    const run = await readRun(id);
    if (run && run.status === status) return run;
    if (Date.now() > deadline) throw new Error(`run ${id} never reached ${status}; last: ${run?.status}`);
    await new Promise((r) => setTimeout(r, 20));
  }
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

describe('Controller.enqueue validation', () => {
  it('rejects an unknown project, a missing spec, and a second live run', async () => {
    controller = new Controller({ resolveProject: (id) => (id === 'p' ? { projectPath: fx.repo, workspacePath: fx.repo } : undefined) });
    await expect(controller.enqueue({ projectId: 'nope', spec: SPEC })).rejects.toThrow(/unknown project/);
    await expect(controller.enqueue({ projectId: 'p', spec: 'no-such-spec' })).rejects.toThrow(/no directory/);

    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });
    expect(id).toMatch(/^run-/);
    await expect(controller.enqueue({ projectId: 'p', spec: SPEC })).rejects.toThrow(/already live/);
  });
});

describe('Controller full run', () => {
  it('drives requirements and design, the implementation phase, the retrospective, a retro-plan wait, close-out, done', async () => {
    writeScript(fx, [
      drafterRun('requirements'), reviewerRun('requirements'),
      drafterRun('design'), reviewerRun('design'),
      e2eRun(), compileRun(), analystRun(), closeoutBatchRun(),
    ]);
    await approve(fx, 'tasks');
    // The implementation ends at a PR the merge stage merges before the retro.
    scriptMergeablePR(fx, 'main', 'c0ffee000001');

    controller = makeController(fx);
    expect(await controller.start()).toBe(true);
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    const waiting = await waitForStatus(id, 'waiting');
    expect(waiting.phase).toBe('retrospective');

    const open = await listOpenWaits();
    const retro = open.find((w) => w.run === id && w.kind === 'retro-plan');
    expect(retro).toBeTruthy();
    expect(retro!.proposals?.length).toBe(1);

    await answerWait(retro!.id, { 'proposal:0': 'approve' }, 'matthew');

    await waitForStatus(id, 'done');
  });
});

describe('Controller usage window', () => {
  it('parks a run while a window is over the threshold and releases it when it falls', async () => {
    // Routing resolves straight to done, so the run needs no claude step.
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: CLOSED\n');

    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.99, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      sevenDay: { utilization: 0.1, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      updated: new Date().toISOString(),
    });

    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    const paused = await waitForStatus(id, 'paused');
    expect(paused.pauseReason).toBe('usage-window');

    // The window falls; the next tick releases the run and it completes.
    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.1, resetsAt: new Date().toISOString() },
      sevenDay: { utilization: 0.1, resetsAt: new Date().toISOString() },
      updated: new Date().toISOString(),
    });
    await controller.pump();
    const done = await waitForStatus(id, 'done');
    expect(done.pauseReason).toBeUndefined();
    expect(done.resumeAt).toBeUndefined();
  });

  it('resumeNow releases a run parked on a window the file still reports as full', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: CLOSED\n');

    // A stale reading: the window reset early (a plan upgrade) but no step ran since.
    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.97, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      sevenDay: { utilization: 0.4, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      updated: new Date().toISOString(),
    });

    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });
    await waitForStatus(id, 'paused');

    expect(await controller.resumeNow('run-nope')).toBeUndefined();
    expect(await controller.resumeNow(id)).toBeTruthy();
    await waitForStatus(id, 'done');
    const file = await readRateLimit();
    expect(file?.fiveHour.utilization).toBe(0);
    expect(file?.sevenDay.utilization).toBe(0.4); // under the threshold: left as read
    expect(await controller.resumeNow(id)).toBeNull(); // done, not paused
  });

  it('reads a window whose reset time has passed as reset, whatever its stale utilization', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: CLOSED\n');

    // Written before the reset; no step ran since, so nothing refreshed it.
    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.99, resetsAt: new Date(Date.now() - 60_000).toISOString() },
      sevenDay: { utilization: 0.1, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      updated: new Date(Date.now() - 120_000).toISOString(),
    });

    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    await waitForStatus(id, 'done');
  });
});

describe('Controller merge stage', () => {
  const BRANCH = 'feat/ctl';
  const readyView = {
    mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
    headRefName: BRANCH, headRefOid: 'deadbeefcafe', body: 'Clean body.',
    commits: [{ oid: 'deadbeefcafe', messageHeadline: 'feat: do it', messageBody: '', committedDate: '2026-10-11T11:00:00.000Z' }],
    author: { login: 'someone' },
  };
  const runsPending = { argvIncludes: ['api'], stdout: { total_count: 1, workflow_runs: [{ name: 'build', status: 'in_progress', conclusion: null }] } };


  it('merges a completed implementation by rule (scheduler re-enters the merging run), then runs the retro', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    // The run works on its feature branch (the worktree's real state), so the
    // merge stage looks for the PR rather than skipping as a default-branch run.
    git(fx.repo, ['checkout', '-q', '-b', BRANCH]);
    writeScript(fx, [e2eRun(), compileRun(), analystRun()]);

    const ghScript = join(fx.base, 'gh-script.json');
    writeFileSync(ghScript, JSON.stringify([
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 7, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsPending, GH_STATUS_OK,
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      GH_RUNS_OK, GH_STATUS_OK,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'c0ffee123456' } } },
    ]));
    process.env.STUB_GH_SCRIPT = ghScript;

    controller = new Controller({
      resolveProject: () => ({ projectPath: fx.repo, workspacePath: fx.repo }),
      mcpConfigFor: () => ({ mcpServers: {} }),
      ensureWorktree: async () => ({ worktree: fx.repo, branch: BRANCH }),
      claudeBin: () => STUB,
      tickMs: 25,
      mergePollMs: 10,
    });
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    const waiting = await waitForStatus(id, 'waiting');
    expect(waiting.phase).toBe('retrospective');
    expect(waiting.pr).toBe(7);

    const rows = readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8')
      .trim().split('\n').map((l: string) => JSON.parse(l) as Record<string, string>);
    expect(rows.find((r: Record<string, string>) => r.type === 'pr.merged')).toMatchObject({ number: '7', sha: 'c0ffee123456', method: 'merge' });

    const retro = (await listOpenWaits()).find((w) => w.run === id && w.kind === 'retro-plan');
    expect(retro).toBeTruthy();
  }, 20000);
});

describe('Controller merge stage: unreadable PR', () => {
  const BRANCH = 'feat/ctl';

  it('writes an error wait with the merge cursor when gh cannot read the PR, instead of polling', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    // A feature-branch run: an unreadable PR is an error, not a default-branch skip.
    git(fx.repo, ['checkout', '-q', '-b', BRANCH]);
    writeScript(fx, [e2eRun()]);

    const ghScript = join(fx.base, 'gh-script.json');
    writeFileSync(ghScript, JSON.stringify([
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 7, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], exitCode: 1, stderr: 'GraphQL: Resource not accessible by personal access token' },
    ]));
    process.env.STUB_GH_SCRIPT = ghScript;

    controller = new Controller({
      resolveProject: () => ({ projectPath: fx.repo, workspacePath: fx.repo }),
      mcpConfigFor: () => ({ mcpServers: {} }),
      ensureWorktree: async () => ({ worktree: fx.repo, branch: BRANCH }),
      claudeBin: () => STUB,
      tickMs: 25,
      mergePollMs: 10,
    });
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    const waiting = await waitForStatus(id, 'waiting');
    expect(waiting.pr).toBe(7);
    expect(waiting.cursor?.stepKind).toBe('merge');

    const wait = (await listOpenWaits()).find((w) => w.run === id && w.kind === 'error');
    expect(wait).toBeTruthy();
    expect(wait!.questions[0].text).toMatch(/PR #7 could not be read.*Resource not accessible.*Checks: read/s);
  }, 20000);
});

describe('Controller crash recovery', () => {
  it('resumes a run left running mid document phase and finishes it', async () => {
    // Requirements v1 committed but not approved (mid review round); design and
    // tasks already approved; no retro files yet.
    writeFileSync(join(fx.specDir, 'requirements.md'), cleanDoc('requirements'));
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', `docs(sdd): ${SPEC} requirements v1`]);
    await approve(fx, 'design');
    await approve(fx, 'tasks');

    writeScript(fx, [
      reviewerRun('requirements'), e2eRun(), compileRun(), analystRun(), closeoutBatchRun(),
    ]);
    // The implementation ends at a PR the merge stage merges before the retro.
    scriptMergeablePR(fx, 'main', 'c0ffee000002');

    // A run record left `running` by a crashed controller (no live step).
    const id = 'run-20261011-010101';
    const iso = '2026-10-11T01:01:01.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: fx.repo, branch: 'main', status: 'running', created: iso, updated: iso,
      phase: 'requirements', cursor: { phase: 'requirements', stepKind: 'reviewer', attempt: 1 },
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    controller = makeController(fx);
    await controller.start(); // recovery drives the running run

    const waiting = await waitForStatus(id, 'waiting');
    expect(waiting.phase).toBe('retrospective');
    const retro = (await listOpenWaits()).find((w) => w.run === id && w.kind === 'retro-plan');
    await answerWait(retro!.id, {}, 'matthew');

    await waitForStatus(id, 'done');
  });
});

// Contract for Controller.pause/resumeNow (design C4, C5; task 4 success
// criteria). Per success criterion:
// - Pause on a queued run applies at once and `pump()` does not start it.
//   Pre: a `queued` run, controller not yet started. Call: `controller.pause(id)`,
//   then `controller.start()` + `controller.pump()`. Result: the record stays
//   `paused`/`operator` with no `inFlight`; the pause write also fires a
//   `runEvents` `change` event. Source: design C4 post-conditions 2-3;
//   Requirement 1 AC 7, Requirement 3 AC 1, Requirement 5 AC 2 (the `isStartable`
//   gate this exercises is the same one a restart relies on).
// - Pause on a usage-reason paused run with a future `resumeAt` sets
//   `pauseReason: 'operator'` and clears `resumeAt`. Source: design C4
//   post-condition 2; Requirement 3 AC 2.
// - Pause during a delayed stub step answers before the step ends; the step's
//   result is acted on; the run ends `paused`/`operator` with no `inFlight` and
//   no further stub run consumed. Source: design C4 post-condition 3 (NFR
//   Performance); Requirement 1 AC 2; Testing Strategy "Integration" bullet 1.
// - Pause on a `merging` run applies with the `merge` cursor; Resume re-enters
//   the merge stage with no implementation step. Source: design C4 post-condition
//   2, C5; Requirement 3 AC 3, Requirement 4 AC 2.
// - An operator-paused run stays paused while a window goes over the threshold
//   and recovers. Source: design "Scheduler changes" item 1; Requirement 3 AC 6
//   (the recovery half; the blocked half is an invariant already covered at
//   controller.ts:306-313).
// - Resume of an applied pause starts the next step. Source: design C4
//   `resumeNow` branch 1; Requirement 4 AC 1.
// - Resume under a full window leaves it `paused`/`usage-window` with
//   `rate-limit.json` unchanged. Source: design C4 `resumeNow` branch 1;
//   Requirement 4 AC 3.
// - Resume of a pending pause clears the field and the run finishes. Source:
//   design C4 `resumeNow` branch 2; Requirement 4 AC 4.
// - `pause` returns `undefined`, `null`, and the unchanged record (same
//   `updated`) for an unknown, a `done`, and an already-held run. Source: design
//   C4 interface line; Requirement 1 AC 5 (the already-held case).
describe('Controller.pause and resumeNow (design C4, C5)', () => {
  it('applies a pause to a queued run at once, fires a runEvents change, and pump() does not start it', async () => {
    const id = 'run-20261011-050505';
    const iso = '2026-10-11T05:05:05.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'queued', created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    const seen: RunRecord[] = [];
    const onChange = (r: RunRecord): void => { if (r.id === id) seen.push(r); };
    runEvents.on('change', onChange);

    controller = makeController(fx);
    let paused: RunRecord | null | undefined;
    try {
      paused = await controller.pause(id);
    } finally {
      runEvents.removeListener('change', onChange);
    }

    expect(paused?.status).toBe('paused');
    expect(paused?.pauseReason).toBe('operator');
    expect(paused?.resumeAt).toBeUndefined();
    expect(paused?.inFlight).toBeUndefined();
    expect(paused?.pauseRequested).toBeTruthy();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1].status).toBe('paused');

    await controller.start();
    await controller.pump();

    const after = await readRun(id);
    expect(after?.status).toBe('paused');
    expect(after?.pauseReason).toBe('operator');
    expect(after?.inFlight).toBeUndefined();
  });

  it('replaces a usage-reason pause with operator and clears resumeAt', async () => {
    const id = 'run-20261011-050506';
    const iso = '2026-10-11T05:05:06.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'paused', pauseReason: 'usage-limit',
      resumeAt: new Date(Date.now() + 3_600_000).toISOString(),
      created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    controller = makeController(fx);
    const result = await controller.pause(id);

    expect(result?.status).toBe('paused');
    expect(result?.pauseReason).toBe('operator');
    expect(result?.resumeAt).toBeUndefined();
    expect(result?.pauseRequested).toBeTruthy();
  });

  it('answers before a delayed in-flight step ends, acts on its result, and ends paused/operator with no further stub run consumed', async () => {
    const scriptPath = join(fx.base, 'script.json');
    writeScript(fx, [{ ...drafterRun('requirements'), delayMs: 1500 } as StubRun]);

    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    let seen: RunRecord | undefined;
    for (let i = 0; i < 100 && !seen?.inFlight; i++) {
      await new Promise((r) => setTimeout(r, 25));
      seen = await readRun(id);
    }
    expect(seen?.inFlight).toBeTruthy();

    const started = Date.now();
    const result = await controller.pause(id);
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(500); // answers long before the 1500ms step ends
    expect(result?.status).toBe('running'); // still in flight: the pause is pending
    expect(result?.pauseRequested).toBeTruthy();

    const final = await waitForStatus(id, 'paused');
    expect(final.pauseReason).toBe('operator');
    expect(final.inFlight).toBeUndefined();
    expect(final.resumeAt).toBeUndefined();
    expect(readFileSync(join(fx.specDir, 'requirements.md'), 'utf8')).toBe(cleanDoc('requirements'));
    expect(readFileSync(`${scriptPath}.counter`, 'utf8').trim()).toBe('1'); // no reviewer run consumed
  }, 20000);

  it('applies a pause on a merging run with the merge cursor; Resume re-enters the merge stage with no implementation step', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: CLOSED\n');

    const BRANCH = 'feat/ctl-pause-merge';
    git(fx.repo, ['checkout', '-q', '-b', BRANCH]);

    const id = 'run-20261011-050507';
    const iso = '2026-10-11T05:05:07.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: fx.repo, branch: BRANCH, status: 'merging', phase: 'implementation',
      cursor: { phase: 'implementation', stepKind: 'implementation', attempt: 1 },
      created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    controller = makeController(fx);
    const paused = await controller.pause(id);
    expect(paused?.status).toBe('paused');
    expect(paused?.pauseReason).toBe('operator');
    expect(paused?.resumeAt).toBeUndefined();
    expect(paused?.cursor).toEqual({ phase: 'implementation', stepKind: 'merge', attempt: 1 });
    expect(paused?.pauseRequested).toBeTruthy();

    await controller.start();
    const scriptPath = join(fx.base, 'script.json');
    writeScript(fx, []); // no claude step is expected on this path
    scriptMergeablePR(fx, BRANCH, 'c0ffee050507');

    const resumed = await controller.resumeNow(id);
    expect(resumed?.status).toBe('queued');
    expect(resumed?.pauseRequested).toBeUndefined();
    expect(resumed?.pauseReason).toBeUndefined();
    expect(resumed?.resumeAt).toBeUndefined();
    expect(resumed?.cursor).toEqual({ phase: 'implementation', stepKind: 'merge', attempt: 1 });

    await waitForStatus(id, 'done');
    expect(existsSync(`${scriptPath}.counter`)).toBe(false); // claude never invoked
    const rows = readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8')
      .trim().split('\n').map((l) => JSON.parse(l) as Record<string, string>);
    expect(rows.find((r) => r.type === 'pr.merged')).toMatchObject({ run: id, number: '7' });
  }, 20000);

  it('keeps an operator-paused run paused while a usage window goes over the threshold and recovers', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: CLOSED\n');

    const id = 'run-20261011-050508';
    const iso = '2026-10-11T05:05:08.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'queued', created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    controller = makeController(fx);
    const paused = await controller.pause(id);
    expect(paused?.status).toBe('paused');
    await controller.start();

    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.99, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      sevenDay: { utilization: 0.1, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      updated: new Date().toISOString(),
    });
    await controller.pump();
    const mid = await readRun(id);
    expect(mid?.status).toBe('paused');
    expect(mid?.pauseReason).toBe('operator');

    // The window recovers: the old `isStartable` would treat a no-`resumeAt`
    // paused/operator run as startable once the window stops blocking.
    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.1, resetsAt: new Date().toISOString() },
      sevenDay: { utilization: 0.1, resetsAt: new Date().toISOString() },
      updated: new Date().toISOString(),
    });
    await controller.pump();
    await new Promise((r) => setTimeout(r, 500));

    const after = await readRun(id);
    expect(after?.status).toBe('paused');
    expect(after?.pauseReason).toBe('operator');
    expect(after?.pauseRequested).toBeTruthy();
    expect(after?.inFlight).toBeUndefined();
  });

  it('starts the next step when Resume clears an applied pause', async () => {
    const id = 'run-20261011-050509';
    const iso = '2026-10-11T05:05:09.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'queued', created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    controller = makeController(fx);
    const paused = await controller.pause(id);
    expect(paused?.status).toBe('paused');
    await controller.start();

    writeScript(fx, [{ ...drafterRun('requirements'), delayMs: 1200 } as StubRun]);
    const resumed = await controller.resumeNow(id);
    expect(resumed?.status).toBe('queued');
    expect(resumed?.pauseRequested).toBeUndefined();

    let seen: RunRecord | undefined;
    for (let i = 0; i < 100 && !seen?.inFlight; i++) {
      await new Promise((r) => setTimeout(r, 25));
      seen = await readRun(id);
    }
    expect(seen?.inFlight).toBeTruthy(); // Resume started the drafter, the run's next step

    // Hold it again so the run parks cleanly after this one step, with no reviewer run.
    const result2 = await controller.pause(id);
    expect(result2?.status).toBe('running');

    const final = await waitForStatus(id, 'paused');
    expect(final.pauseReason).toBe('operator');
    expect(readFileSync(join(fx.specDir, 'requirements.md'), 'utf8')).toBe(cleanDoc('requirements'));
    expect(existsSync(join(fx.specDir, 'reviews', 'adversarial-analysis-requirements.md'))).toBe(false);
  }, 20000);

  it('parks an operator-paused run on the usage window on Resume, leaving rate-limit.json unchanged', async () => {
    const id = 'run-20261011-050510';
    const iso = '2026-10-11T05:05:10.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'queued', created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    controller = makeController(fx);
    const paused = await controller.pause(id);
    expect(paused?.status).toBe('paused');
    expect(paused?.pauseReason).toBe('operator');

    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.99, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      sevenDay: { utilization: 0.4, resetsAt: new Date(Date.now() + 3_600_000).toISOString() },
      updated: new Date().toISOString(),
    });

    await controller.start();
    const resumed = await controller.resumeNow(id);
    expect(resumed?.status).toBe('queued');
    expect(resumed?.pauseRequested).toBeUndefined();

    const parked = await waitForStatus(id, 'paused');
    expect(parked.pauseReason).toBe('usage-window');
    expect(parked.resumeAt).toBeTruthy();
    expect(parked.pauseRequested).toBeUndefined();

    const file = await readRateLimit();
    expect(file?.fiveHour.utilization).toBe(0.99); // unchanged: Resume never resets the window file
    expect(file?.sevenDay.utilization).toBe(0.4);
  });

  it('withdraws a pending pause on a waiting run and lets it finish normally', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeFileSync(join(fx.specDir, 'retrospective-proposals.md'), PROPOSALS);

    const id = 'run-20261011-050511';
    const iso = '2026-10-11T05:05:11.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'queued', created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    controller = makeController(fx);
    await controller.start();

    const waiting = await waitForStatus(id, 'waiting');
    expect(waiting.phase).toBe('retrospective');

    const held = await controller.pause(id);
    expect(held?.status).toBe('waiting');
    expect(held?.pauseReason).toBeUndefined();
    expect(held?.pauseRequested).toBeTruthy();

    const resumed = await controller.resumeNow(id);
    expect(resumed?.status).toBe('waiting');
    expect(resumed?.pauseRequested).toBeUndefined();

    writeScript(fx, [closeoutBatchRun()]);
    scriptMergeablePR(fx, 'main', 'c0ffee050511');

    const open = await listOpenWaits();
    const retro = open.find((w) => w.run === id && w.kind === 'retro-plan');
    expect(retro).toBeTruthy();
    await answerWait(retro!.id, { 'proposal:0': 'approve' }, 'matthew');

    const done = await waitForStatus(id, 'done');
    expect(done.pauseRequested).toBeUndefined();
  }, 20000);

  it('pause returns undefined for an unknown run, null for a done run, and the unchanged record for an already-held run', async () => {
    controller = makeController(fx);

    expect(await controller.pause('run-nope')).toBeUndefined();

    const doneId = 'run-20261011-050512';
    const iso = '2026-10-11T05:05:12.000Z';
    await writeRun({
      v: 1, id: doneId, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'done', created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });
    expect(await controller.pause(doneId)).toBeNull();
    const untouched = await readRun(doneId);
    expect(untouched?.pauseRequested).toBeUndefined();

    const heldId = 'run-20261011-050513';
    await writeRun({
      v: 1, id: heldId, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'queued', created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });
    const first = await controller.pause(heldId);
    expect(first?.pauseRequested).toBeTruthy();
    const second = await controller.pause(heldId);
    expect(second?.updated).toBe(first?.updated);
    expect(second?.pauseRequested).toBe(first?.pauseRequested);
  });
});

// Contract for the settle pass, wait answers and restart (design C4
// "Scheduler changes" item 2, "Waits", "Recovery"; task 5 success criteria).
// Per success criterion:
// - A held `queued` record parks `paused`/`operator` on `pump()`. Pre: a
//   `queued` run seeded with `pauseRequested` set (owned write), controller
//   started. Call: `controller.pump()`. Result: `status: 'paused'`,
//   `pauseReason: 'operator'`, no `resumeAt`, no `inFlight`. Source: design
//   C4 scheduler item 2; Requirement 3 AC 5 (parked while idle, the general
//   case AC 3 covers for `merging`).
// - A held `merging` record parks `paused`/`operator` with the `merge`
//   cursor. Pre: a `merging` run with an `implementation` cursor and
//   `pauseRequested` set, controller started. Call: `controller.pump()`.
//   Result: `status: 'paused'`, `pauseReason: 'operator'`, no `resumeAt`,
//   cursor `{ phase, stepKind: 'merge', attempt: 1 }`. Source: design C4
//   scheduler item 2, C5; Requirement 3 AC 3.
// - Pausing a `waiting` run leaves it `waiting` and held; answering the
//   wait parks it `paused`/`operator` with the answer written to
//   `retrospective-plan.md` as today. Pre: a run driven to `waiting` at the
//   retrospective's retro-plan wait. Call: `controller.pause(id)`, then
//   `answerWait(retro.id, { 'proposal:0': 'approve' }, 'matthew')`. Result:
//   `pause` returns `status: 'waiting'`, `pauseRequested` set; after the
//   answer the run is `paused`/`operator`, no `resumeAt`, and
//   `retrospective-plan.md` reads `Status: APPROVED`. Source: design C4
//   "Waits"; Requirement 3 AC 4.
// - Restart: `start()` on records seeded `paused`/`operator`, `running`
//   with a dead pid, and `waiting` with an answered wait leaves all three
//   `paused`/`operator`, with no stub step consumed. Source: design C4
//   "Recovery", "Waits"; Requirement 5 AC 2, AC 4, AC 5.
describe('Controller settle pass, wait answers and restart (design C4 item 2, Waits, Recovery)', () => {
  it('settle pass parks a held queued record paused/operator on pump()', async () => {
    const id = 'run-20261011-050515';
    const iso = '2026-10-11T05:05:15.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'queued', pauseRequested: iso,
      created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    }, { ownsPauseRequest: true });

    controller = makeController(fx);
    await controller.start();
    await controller.pump();

    const after = await readRun(id);
    expect(after?.status).toBe('paused');
    expect(after?.pauseReason).toBe('operator');
    expect(after?.resumeAt).toBeUndefined();
    expect(after?.inFlight).toBeUndefined();
  });

  it('settle pass parks a held merging record paused/operator with the merge cursor', async () => {
    const id = 'run-20261011-050516';
    const iso = '2026-10-11T05:05:16.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: fx.repo, branch: 'main', status: 'merging', phase: 'implementation',
      cursor: { phase: 'implementation', stepKind: 'implementation', attempt: 1 },
      pauseRequested: iso, created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    }, { ownsPauseRequest: true });

    controller = makeController(fx);
    await controller.start();
    await controller.pump();

    const after = await readRun(id);
    expect(after?.status).toBe('paused');
    expect(after?.pauseReason).toBe('operator');
    expect(after?.resumeAt).toBeUndefined();
    expect(after?.cursor).toEqual({ phase: 'implementation', stepKind: 'merge', attempt: 1 });
  });

  it('leaves a paused waiting run held and open, then parks it paused/operator with the answer on disk', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeFileSync(join(fx.specDir, 'retrospective-proposals.md'), PROPOSALS);

    const id = 'run-20261011-050517';
    const iso = '2026-10-11T05:05:17.000Z';
    await writeRun({
      v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'queued', created: iso, updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    controller = makeController(fx);
    await controller.start();

    const waiting = await waitForStatus(id, 'waiting');
    expect(waiting.phase).toBe('retrospective');

    const held = await controller.pause(id);
    expect(held?.status).toBe('waiting');
    expect(held?.pauseReason).toBeUndefined();
    expect(held?.pauseRequested).toBeTruthy();

    const open = await listOpenWaits();
    const retro = open.find((w) => w.run === id && w.kind === 'retro-plan');
    expect(retro).toBeTruthy();
    await answerWait(retro!.id, { 'proposal:0': 'approve' }, 'matthew');

    const parked = await waitForStatus(id, 'paused');
    expect(parked.pauseReason).toBe('operator');
    expect(parked.resumeAt).toBeUndefined();
    expect(parked.pauseRequested).toBeTruthy();
    expect(readFileSync(join(fx.specDir, 'retrospective-plan.md'), 'utf8')).toMatch(/Status: APPROVED/);
  }, 20000);

  it('restart parks a held paused/operator record, a held running record with a dead pid, and a held waiting record with an answered wait, all paused/operator with no stub step consumed', async () => {
    const scriptPath = join(fx.base, 'script.json');

    const idA = 'run-20261011-050518';
    const isoA = '2026-10-11T05:05:18.000Z';
    await writeRun({
      v: 1, id: idA, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'paused', pauseReason: 'operator', pauseRequested: isoA,
      created: isoA, updated: isoA,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    }, { ownsPauseRequest: true });

    const idB = 'run-20261011-050519';
    const isoB = '2026-10-11T05:05:19.000Z';
    await writeRun({
      v: 1, id: idB, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: fx.repo, branch: 'main', status: 'running', pauseRequested: isoB,
      phase: 'requirements', cursor: { phase: 'requirements', stepKind: 'reviewer', attempt: 1 },
      inFlight: { id: 's-dead', pid: 999999, startTime: 0 },
      created: isoB, updated: isoB,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    }, { ownsPauseRequest: true });

    const idC = 'run-20261011-050520';
    const isoC = '2026-10-11T05:05:20.000Z';
    const wait = await createWait({
      kind: 'question', runId: idC, projectId: 'p', spec: SPEC, specDir: fx.specDir,
      questions: [{ id: 'q', text: 'q?' }],
    });
    await answerWait(wait.id, { q: 'ok' }, 'matthew');
    await writeRun({
      v: 1, id: idC, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: '', branch: '', status: 'waiting', pauseRequested: isoC,
      created: isoC, updated: isoC,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    }, { ownsPauseRequest: true });

    controller = makeController(fx);
    await controller.start();

    const a = await waitForStatus(idA, 'paused');
    expect(a.pauseReason).toBe('operator');

    const b = await waitForStatus(idB, 'paused');
    expect(b.pauseReason).toBe('operator');
    expect(b.inFlight).toBeUndefined();

    const c = await waitForStatus(idC, 'paused');
    expect(c.pauseReason).toBe('operator');
    expect(c.resumeAt).toBeUndefined();

    expect(existsSync(`${scriptPath}.counter`)).toBe(false);
  }, 20000);
});
