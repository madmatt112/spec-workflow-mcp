import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, existsSync, chmodSync, rmSync, readFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawn } from 'child_process';
import {
  routeRun, parseProposals, buildRetroPlanMarkdown, runOnce, cancelRun, discardRun,
  withPrRead, listRunsForWire, setRunHeartbeat, runEvents, stepLifecycle,
  type RunDeps, type CancelDeps,
} from '../runs.js';
import { branchPresent, type BranchRead } from '../branch-presence.js';
import { NO_OP_GATES } from '../phases/document.js';
import { createDocumentGates } from '../phases/gates.js';
import {
  writeRun, readRun, readRunSync, listWaits, processStartTime, isProcessAlive, writeLastActivity,
  type RunRecord, type PrRead,
} from '../state.js';
import { answerWait } from '../waits.js';
import { approvalsHandler } from '../../tools/approvals.js';
import { openRunLedger } from '../ledger.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-claude.mjs');
const STUB_GH = join(HERE, '..', '..', '..', 'scripts', 'stub-gh.mjs');
const SPEC = 'ctrl-runs';

const savedEnv = { ...process.env };

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

/** A short, lint-clean document carrying a v1..version Revision History. */
function cleanDoc(title: string, version: number): string {
  const history = ['- **v1** (2026-10-11) — Initial draft.'];
  for (let v = 2; v <= version; v++) history.push(`- **v${v}** (2026-10-11) — Round response.`);
  return [
    `# ${title}`, '',
    '## Introduction',
    'The controller drafts documents. It serves the operator. It changes nothing else.', '',
    '## Requirements',
    'The controller SHALL draft, review and approve each document in order.', '',
    '## Revision History', ...history, '',
  ].join('\n');
}

const USAGE = {
  input_tokens: 5, output_tokens: 50, cache_read_input_tokens: 10,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 },
};

interface StubRun { edits?: { path: string; content: string }[]; appends?: { path: string; content: string }[]; result: Record<string, unknown>; stream?: unknown[]; exitCode?: number; eventDelayMs?: number; }

interface Fixture { base: string; repo: string; specDir: string; home: string; logs: string; }

function setup(): Fixture {
  const base = mkdtempSync(join(tmpdir(), 'ctrl-runs-'));
  const repo = join(base, 'repo');
  const specDir = join(repo, '.spec-workflow', 'specs', SPEC);
  mkdirSync(specDir, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 't@test']);
  git(repo, ['config', 'user.name', 'Tester']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(repo, 'README.md'), 'init\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'init']);
  const home = join(base, 'home');
  const logs = join(base, 'logs');
  mkdirSync(home, { recursive: true });
  mkdirSync(logs, { recursive: true });
  return { base, repo, specDir, home, logs };
}

function writeScript(fx: Fixture, runs: StubRun[]): void {
  const scriptPath = join(fx.base, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
  process.env.SDD_HOME = fx.home;
}

async function approve(fx: Fixture, doc: 'requirements' | 'design' | 'tasks'): Promise<void> {
  const ctx = { projectPath: fx.repo, workspacePath: fx.repo };
  writeFileSync(join(fx.specDir, `${doc}.md`), cleanDoc(doc, 1));
  const req = await approvalsHandler({
    action: 'request', title: `${SPEC} ${doc}`, filePath: `.spec-workflow/specs/${SPEC}/${doc}.md`,
    type: 'document', category: 'spec', categoryName: SPEC,
  }, ctx);
  const approvalId = (req.data as { approvalId: string }).approvalId;
  await approvalsHandler({ action: 'approve', approvalId, response: 'ok' }, ctx);
}

function seedRun(fx: Fixture, patch: Partial<RunRecord> = {}): RunRecord {
  const iso = '2026-10-11T00:00:00.000Z';
  return {
    v: 1, id: 'run-20261011-000000', project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
    worktree: fx.repo, branch: 'main', status: 'running', created: iso, updated: iso,
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }, ...patch,
  };
}

function deps(fx: Fixture, over: Partial<RunDeps> = {}): RunDeps {
  return {
    gates: NO_OP_GATES,
    now: () => new Date('2026-10-11T00:00:00.000Z'),
    mergeRules: () => ({ method: 'merge', postMerge: null, merge: 'auto' }),
    mergePollMs: 0,
    mcpConfigFor: () => ({ mcpServers: {} }),
    ensureWorktree: async (run) => ({ worktree: run.codeRoot, branch: 'main' }),
    tokenCap: () => undefined,
    windowBlock: () => ({ blocked: false }),
    onRateLimit: () => { /* ignore */ },
    isCancelled: () => false,
    setInFlight: () => { /* noop */ },
    ...over,
  };
}

let fx: Fixture;
beforeEach(() => {
  chmodSync(STUB, 0o755); chmodSync(STUB_GH, 0o755); fx = setup();
  // Isolate the controller home so writeRun/writeWait never touch the real
  // home; tests that spawn a claude stub re-set this in writeScript.
  process.env.SDD_HOME = fx.home;
});
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('routeRun', () => {
  it('routes to each document phase in order, then implementation, retrospective, close-out, done', async () => {
    process.env.SDD_HOME = fx.home;
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'document', phase: 'requirements' });

    await approve(fx, 'requirements');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'document', phase: 'design' });

    await approve(fx, 'design');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'document', phase: 'tasks' });

    await approve(fx, 'tasks');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'implementation' });

    writeFileSync(join(fx.specDir, 'retrospective-proposals.md'), '# proposals\n');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'retro-plan' });

    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: APPROVED\n');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'closeout' });

    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: CLOSED\n');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'done' });
  });
});

describe('parseProposals and buildRetroPlanMarkdown', () => {
  const md = [
    '# Retrospective proposals — x', '',
    '## Proposals',
    '- **P1 (F1) — Ship the thing.** Do it.',
    '  Target: harness skills or agents.',
    '  DECISION NEEDED: yes. Ship it? Options: ship | hold. Recommend ship.',
    '- **P2 (F2) — Drop this.** Maybe not.',
    '  Target: product code.',
    '  DECISION NEEDED: no.', '',
    '## Graduation candidates',
    'None found.', '',
  ].join('\n');

  it('parses proposal blocks and their decision questions', () => {
    const proposals = parseProposals(md);
    expect(proposals.map((p) => p.id)).toEqual(['P1', 'P2']);
    expect(proposals[0].question).toBe('Ship it?');
    expect(proposals[0].options).toEqual(['ship', 'hold']);
    expect(proposals[1].question).toBeUndefined();
  });

  it('writes an APPROVED plan with approvals, decisions and drops', () => {
    const proposals = parseProposals(md);
    const plan = buildRetroPlanMarkdown('x', proposals, { P1: 'ship', 'proposal:0': 'approve', 'proposal:1': 'drop' }, '2026-10-11');
    expect(plan).toContain('Status: APPROVED');
    expect(plan).toContain('- **P1 (F1) — Ship the thing.**');
    expect(plan).toContain('P1: Ship it? → ship');
    expect(plan).toContain('## Rejected proposals');
    expect(plan).toContain('P2: dropped at retro-plan.');
    // The dropped proposal is not under Approved proposals.
    const approvedSection = plan.split('## Decisions')[0];
    expect(approvedSection).not.toContain('Drop this');
  });
});

describe('parseProposals on the real greeting-endpoint fixture', () => {
  const fixture = readFileSync(join(HERE, 'fixtures', 'retrospective-proposals.md'), 'utf-8');
  const proposals = parseProposals(fixture);
  const byId = Object.fromEntries(proposals.map((p) => [p.id, p]));

  it('parses every P<n> proposal block', () => {
    expect(proposals.map((p) => p.id)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
  });

  it('joins a question that wraps across lines and keeps the full text', () => {
    expect(byId.P1.question).toBe('Should `{ hour: null }` keep throwing, or be normalised to "no hour"?');
  });

  it('reads the `- Option …` lines as options with the recommended one marked', () => {
    expect(byId.P1.options).toHaveLength(2);
    expect(byId.P1.options?.[0]).toMatch(/^keep throwing; document both branches and add tests\./);
    expect(byId.P1.options?.[1]).toMatch(/^normalise `null`\/`undefined` hour to "no hour"/);
    expect(byId.P1.recommended).toBe(byId.P1.options?.[0]);
  });

  it('joins option text that wraps across lines', () => {
    expect(byId.P1.options?.[0]).toContain('preserves the "explicit invalid hour is an error" invariant.');
    // P7 Option C wraps and carries an inner colon in a code span.
    expect(byId.P7.options?.[2]).toContain('pr-on-auth-fail: ship | halt');
  });

  it('handles a three-option decision', () => {
    expect(byId.P2.question).toBe('Add real static checking, or declare none?');
    expect(byId.P2.options).toHaveLength(3);
    expect(byId.P2.recommended).toMatch(/^declare `typecheck: none`/);
  });

  it('leaves a DECISION NEEDED: no proposal free of a question and options', () => {
    expect(byId.P3.question).toBeUndefined();
    expect(byId.P3.options).toBeUndefined();
    expect(byId.P6.question).toBeUndefined();
  });

  it('keeps the bold title as the label and the rest as the body', () => {
    expect(byId.P1.label).toBe('P1 (F1) — Disambiguate `{ hour: null }` from a missing hour.');
    expect(byId.P1.body).toMatch(/^Today a missing/);
    expect(byId.P1.body).not.toContain('**');
    // A title that itself wraps across two lines joins into one label.
    expect(byId.P2.label).toBe('P2 (F2) — Declare "no typecheck configured" so the gate stops recording a degraded state.');
  });

  it('builds wait questions with options and a pre-selected recommendation', () => {
    const wait = parseProposals(fixture);
    // Mirror proposalWaitQuestions indirectly via buildRetroPlanMarkdown's inputs:
    const decisions = wait.filter((p) => p.question);
    expect(decisions.map((p) => p.id)).toEqual(['P1', 'P2', 'P7']);
    expect(decisions.every((p) => (p.options?.length ?? 0) >= 2)).toBe(true);
    expect(decisions.every((p) => p.recommended && p.options?.includes(p.recommended))).toBe(true);
  });
});

describe('runOnce done', () => {
  it('commits the ledger with the run.end row when the spec is closed', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: CLOSED\n');
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', 'docs(sdd): closed']);
    await writeRun(seedRun(fx));

    await runOnce(deps(fx), 'run-20261011-000000');

    expect((await readRun('run-20261011-000000'))?.status).toBe('done');
    expect(git(fx.repo, ['log', '-1', '--format=%s']).trim()).toBe(`docs(sdd): ${SPEC} harness ledger — controller run end`);
    expect(git(fx.repo, ['status', '--short']).trim()).toBe('');
    const rows = readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8').trim().split('\n');
    expect(JSON.parse(rows[rows.length - 1]).type).toBe('run.end');
  });
});

describe('runOnce in-flight step record', () => {
  it('records the live step process in run.json while it runs and clears it after', async () => {
    writeScript(fx, [{
      edits: [{ path: `.spec-workflow/specs/${SPEC}/requirements.md`, content: cleanDoc('requirements', 1) }],
      result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'drafted', structured_output: { wordCount: 1, decisions: [], contextFileWritten: true }, usage: {} },
      // The stub pauses before it answers, long enough to read run.json meanwhile.
      ...({ delayMs: 1500 } as object),
    } as StubRun, {
      result: { subtype: 'error_during_execution', is_error: true, num_turns: 0, session_id: 's', result: 'stop here', usage: {} },
    }]);
    await writeRun(seedRun(fx, { status: 'queued', worktree: '' }));

    const driving = runOnce(deps(fx), 'run-20261011-000000');
    let seen: RunRecord | undefined;
    for (let i = 0; i < 100 && !seen?.inFlight; i++) {
      await new Promise((r) => setTimeout(r, 25));
      seen = await readRun('run-20261011-000000');
    }
    expect(seen?.inFlight?.id).toBe('drafter');
    expect(seen?.inFlight?.pid).toBeGreaterThan(0);
    expect(isProcessAlive(seen!.inFlight!.pid, seen!.inFlight!.startTime)).toBe(true);

    await driving;
    const after = await readRun('run-20261011-000000');
    expect(after?.inFlight).toBeUndefined();
  }, 30000);
});

// Contract (task 1, requirement 12 AC 2):
// - AC: onStepSpawn given a task writes inFlight.startedAt (the injected
//   clock's ISO string) and inFlight.task (that task). Pre: a run record
//   exists on disk. Call: stepLifecycle(deps, runId).onStepSpawn({ id, pid,
//   startTime, task }). Observe: readRun(runId).inFlight.{startedAt,task}.
//   Expected values: deps(fx).now() ISO string and the literal task string
//   passed to the call.
// - AC: onStepSpawn given no task writes startedAt and no task key. Same
//   call/observe, omitting `task`; expected: inFlight has no `task` property.
// - AC (regression guard, holds at base): onStepEnd clears inFlight (so both
//   fields clear) — already asserted at `runOnce in-flight step record`
//   above (`after?.inFlight` toBeUndefined, :296); unchanged by this task.
describe('stepLifecycle onStepSpawn task and startedAt', () => {
  it('writes startedAt from the clock and the given task', async () => {
    await writeRun(seedRun(fx));
    await stepLifecycle(deps(fx), 'run-20261011-000000').onStepSpawn({ id: 's1', pid: 123, startTime: 456, task: '3' });
    const run = await readRun('run-20261011-000000');
    expect(run?.inFlight?.startedAt).toBe('2026-10-11T00:00:00.000Z');
    expect(run?.inFlight?.task).toBe('3');
  });

  it('writes startedAt and no task key when no task is given', async () => {
    await writeRun(seedRun(fx));
    await stepLifecycle(deps(fx), 'run-20261011-000000').onStepSpawn({ id: 's1', pid: 123, startTime: 456 });
    const run = await readRun('run-20261011-000000');
    expect(run?.inFlight?.startedAt).toBe('2026-10-11T00:00:00.000Z');
    expect(run?.inFlight && 'task' in run.inFlight).toBe(false);
  });
});

// Contract (design C7 "Spawn race", Requirement 7 AC 4; tasks.md task 16):
// "stepLifecycle.onStepSpawn ... signals the new pid and records nothing
// when the run is cancelled, for a cancel landing between the guard and the
// spawn." Two sub-cases, each its own test per the task's Success line ("for
// isCancelled true and for disk abandoned with isCancelled false"):
// `deps.isCancelled` reporting true, and `deps.isCancelled` reporting false
// but the disk record already reading `abandoned`. Pre-condition in both: a
// real, live child process standing in for the just-spawned step. Test:
// stepLifecycle(deps, runId).onStepSpawn({ id, pid, startTime }). Observable
// result: the pid is signalled (the same process-gone check cancelRun's
// tests use) and the run's `inFlight` on disk stays absent. Expected value
// source: the quoted design clause and the task's Success line.
describe('stepLifecycle onStepSpawn cancel guard (design C7 Spawn race, Requirement 7 AC 4)', () => {
  it('signals the pid and writes no inFlight when deps.isCancelled is true', async () => {
    await writeRun(seedRun(fx, { status: 'running' }));
    const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    const pid = child.pid as number;
    const startTime = processStartTime(pid) ?? 0;

    const { onStepSpawn } = stepLifecycle(deps(fx, { isCancelled: () => true }), 'run-20261011-000000');
    await onStepSpawn({ id: 's1', pid, startTime });

    expect(() => process.kill(pid, 0)).toThrow();
    expect((await readRun('run-20261011-000000'))?.inFlight).toBeUndefined();
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  });

  it('signals the pid and writes no inFlight when disk is abandoned though deps.isCancelled is false', async () => {
    await writeRun(seedRun(fx, { status: 'abandoned' }));
    const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    const pid = child.pid as number;
    const startTime = processStartTime(pid) ?? 0;

    const { onStepSpawn } = stepLifecycle(deps(fx, { isCancelled: () => false }), 'run-20261011-000000');
    await onStepSpawn({ id: 's1', pid, startTime });

    expect(() => process.kill(pid, 0)).toThrow();
    expect((await readRun('run-20261011-000000'))?.inFlight).toBeUndefined();
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  });
});

describe('runOnce gate-B annotation routing', () => {
  /** Approved requirements, design and tasks, and a gate-b wait answered with `reply`. */
  async function seedAnsweredGateB(reply: string, tasksMd?: string): Promise<RunRecord> {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    if (tasksMd) writeFileSync(join(fx.specDir, 'tasks.md'), tasksMd);
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', 'seed approved documents']);
    const run = seedRun(fx);
    await writeRun(run);
    const dir = await createDocumentGates().gateB({
      run, specDir: fx.specDir, specStoreRoot: fx.repo, codeRoot: fx.repo, version: 1,
    });
    await answerWait((dir as { waitId: string }).waitId, { 'gate-b': reply }, 'tester');
    return run;
  }
  function reviserSpawns(): number {
    const path = join(fx.specDir, 'harness-events.jsonl');
    if (!existsSync(path)) return 0;
    const rows = readFileSync(path, 'utf8')
      .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l) as Record<string, string>);
    return rows.filter((r) => r.type === 'spawn.start' && r.agent === 'sdd-reviser').length;
  }

  it('sends an approved run back to the tasks phase for the annotation reviser round', async () => {
    writeScript(fx, [{
      edits: [{ path: `.spec-workflow/specs/${SPEC}/tasks.md`, content: cleanDoc('tasks', 2) }],
      result: { subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'revised', usage: USAGE },
    }]);
    await seedAnsweredGateB('Split task 1 into two tasks.');

    // The token cap stops the loop on the pass after the reviser step spent tokens.
    await runOnce(deps(fx, { gates: createDocumentGates(), tokenCap: () => 1 }), 'run-20261011-000000');

    expect(reviserSpawns()).toBe(1);
    expect(git(fx.repo, ['log', '--format=%s'])).toContain(`docs(sdd): ${SPEC} tasks v2 gate-B annotation`);
  });

  it('does not send the run back once a task has started', async () => {
    writeScript(fx, []);
    await seedAnsweredGateB('Split task 1 into two tasks.', `${cleanDoc('tasks', 1)}\n- [x] 1. Done task\n`);

    await runOnce(deps(fx, { gates: createDocumentGates(), isCancelled: () => true }), 'run-20261011-000000');

    expect(reviserSpawns()).toBe(0);
  });
});

describe('runOnce usage-limit pause', () => {
  it('pauses the run when a document step hits the usage limit', async () => {
    writeScript(fx, [{
      edits: [{ path: `.spec-workflow/specs/${SPEC}/requirements.md`, content: cleanDoc('requirements', 1) }],
      stream: [{
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected', unifiedWindows: { five_hour: { utilization: 0.99, resetsAt: 1 }, seven_day: { utilization: 0.5, resetsAt: 2 } } },
      }],
      result: { subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 's', result: '', usage: {} },
    }]);
    await writeRun(seedRun(fx, { status: 'queued', worktree: '' }));

    await runOnce(deps(fx, { now: () => new Date('2026-10-11T00:00:00.000Z') }), 'run-20261011-000000');

    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('paused');
    expect(run?.pauseReason).toBe('usage-limit');
    expect(run?.resumeAt).toBeTruthy();
  });

  it('turns a usage-limit pause into an operator pause when the run is held (R2 AC 6)', async () => {
    writeScript(fx, [{
      edits: [{ path: `.spec-workflow/specs/${SPEC}/requirements.md`, content: cleanDoc('requirements', 1) }],
      stream: [{
        type: 'rate_limit_event',
        rate_limit_info: { status: 'rejected', unifiedWindows: { five_hour: { utilization: 0.99, resetsAt: 1 }, seven_day: { utilization: 0.5, resetsAt: 2 } } },
      }],
      result: { subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 's', result: '', usage: {} },
    }]);
    await writeRun(seedRun(fx, { status: 'queued', worktree: '' }));
    // Unheld at the loop top (the step must still run); held by the time `pause`
    // classifies the step's usage-limit outcome.
    let calls = 0;
    const isPauseRequested = () => { calls += 1; return calls > 1; };

    await runOnce(deps(fx, { now: () => new Date('2026-10-11T00:00:00.000Z'), isPauseRequested }), 'run-20261011-000000');

    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('paused');
    expect(run?.pauseReason).toBe('operator');
    expect(run?.resumeAt).toBeUndefined();
  });
});

describe('runOnce operator pause (RunDeps.isPauseRequested, design C3 point 1)', () => {
  it('pauses a held running run at the loop top before routing, consuming no step', async () => {
    // Only exercised if the hold does not intercept (the red/base case): a
    // real document step would otherwise try to spawn the actual `claude` CLI.
    writeScript(fx, [{
      edits: [{ path: `.spec-workflow/specs/${SPEC}/requirements.md`, content: cleanDoc('requirements', 1) }],
      result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'drafted', usage: USAGE },
    }]);
    await writeRun(seedRun(fx));

    await runOnce(deps(fx, { isPauseRequested: () => true }), 'run-20261011-000000');

    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('paused');
    expect(run?.pauseReason).toBe('operator');
    expect(run?.resumeAt).toBeUndefined();
    expect(run?.inFlight).toBeUndefined();
    const ledgerPath = join(fx.specDir, 'harness-events.jsonl');
    const rows = readFileSync(ledgerPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, string>);
    expect(rows.some((r) => r.type === 'spawn.start')).toBe(false);
  });
});

describe('runOnce document-phase stop (design C6)', () => {
  it('stops at the review-round top when held, after the drafter commits, with no reviewer spawned', async () => {
    await approve(fx, 'requirements');
    writeScript(fx, [{
      edits: [{ path: `.spec-workflow/specs/${SPEC}/design.md`, content: cleanDoc('design', 1) }],
      result: {
        subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'drafted',
        structured_output: { wordCount: 1, decisions: [], contextFileWritten: true }, usage: USAGE,
      },
    }]);
    await writeRun(seedRun(fx));
    // Unheld at the loop top (the drafter must still run); held by the time the
    // document phase checks the first review-round top.
    let calls = 0;
    const isPauseRequested = () => { calls += 1; return calls > 1; };

    await runOnce(deps(fx, { isPauseRequested }), 'run-20261011-000000');

    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('paused');
    expect(run?.pauseReason).toBe('operator');
    expect(run?.resumeAt).toBeUndefined();
    expect(git(fx.repo, ['log', '--format=%s'])).toContain(`docs(sdd): ${SPEC} design v1`);
    const rows = readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8')
      .trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, string>);
    expect(rows.filter((r) => r.type === 'spawn.start').map((r) => r.agent)).toEqual(['sdd-drafter']);
  });
});

// Contract for the abandoned-final status guard on the driver path (design
// C7 "Status guard", D10; requirement 7 AC 3). Per success criterion: a run
// abandoned on disk during `ensureWorktree` stays abandoned, with no
// `change` event carrying `running`. Pre: a run on disk at `queued` with no
// worktree. Call: `runOnce(deps(fx, { ensureWorktree }), runId)` where
// `ensureWorktree` writes the run `abandoned` on disk before it returns (a
// cancel landing while the worktree is being resolved). Result: the
// run stays `abandoned` on disk and no `change` event ever carries
// `status: 'running'`. Source: design C7 "Status guard"; Requirement 7 AC 3.
// `isCancelled` is forced `true` only so the loop top (a later, unrelated
// check) stops the drive right after the guarded write is observed, instead
// of falling through to a real step spawn when the guard is missing.
describe('runOnce keeps a run abandoned during ensureWorktree (design C7, Requirement 7 AC 3)', () => {
  it('a run abandoned on disk during ensureWorktree stays abandoned, with no change event carrying running', async () => {
    await writeRun(seedRun(fx, { status: 'queued', worktree: '' }));
    const statuses: string[] = [];
    const onChange = (r: RunRecord) => statuses.push(r.status);
    runEvents.on('change', onChange);

    try {
      await runOnce(deps(fx, {
        isCancelled: () => true,
        ensureWorktree: async (run) => {
          await writeRun({ ...run, status: 'abandoned' });
          return { worktree: run.codeRoot, branch: 'main' };
        },
      }), 'run-20261011-000000');
    } finally {
      runEvents.off('change', onChange);
    }

    expect((await readRun('run-20261011-000000'))?.status).toBe('abandoned');
    expect(statuses).not.toContain('running');
  });
});

// Contract for the driver's early-return on an already-abandoned run (design
// C7 "Driver checks", Requirement 7 AC 3). Per success criterion: "runOnce on
// an abandoned run calls no ensureWorktree and writes no running." Pre: a run
// on disk already `abandoned`, with no worktree so the base code's
// `!run.worktree` branch would otherwise call `ensureWorktree` unconditionally
// (`src/controller/runs.ts`, the block before the for-loop). Call:
// `runOnce(deps(fx, { ensureWorktree }), runId)`. Result: `ensureWorktree` is
// never invoked and no `change` event ever carries `status: 'running'`.
// Expected value source: the task's own Success line and design C7 "Driver
// checks" ("`runOnce` returns after its first read for an `abandoned` run,
// before `ensureWorktree` and the `running` write").
describe('runOnce returns before ensureWorktree for an already-abandoned run (design C7 "Driver checks", Requirement 7 AC 3)', () => {
  it('calls no ensureWorktree and writes no running for a run already abandoned at the first read', async () => {
    await writeRun(seedRun(fx, { status: 'abandoned', worktree: '' }));
    const ensureWorktree = vi.fn(async (run: RunRecord) => ({ worktree: run.codeRoot, branch: 'main' }));
    const statuses: string[] = [];
    const onChange = (r: RunRecord) => statuses.push(r.status);
    runEvents.on('change', onChange);

    try {
      await runOnce(deps(fx, { ensureWorktree }), 'run-20261011-000000');
    } finally {
      runEvents.off('change', onChange);
    }

    expect(ensureWorktree).not.toHaveBeenCalled();
    expect(statuses).not.toContain('running');
    expect((await readRun('run-20261011-000000'))?.status).toBe('abandoned');
  });
});

// Contract for the document-phase retry's own cancel check (design C7 "Driver
// checks", Requirement 7 AC 1, AC 2). Per success criterion: "a cancel during
// a document step leaves abandoned, one claude -p spawn, no wait and no
// retry". Pre: a fresh run (no requirements.md yet), a scripted drafter step
// that fails. Call: `runOnce(deps(fx, { isCancelled, onActivity }), runId)`,
// where `onActivity` (fired while the drafter step streams, before its
// failing result is read) flips `isCancelled` true — a cancel landing while
// the step the retry would redo is still in flight. Result: `runOnce`
// resolves with no second drafter spawn and no wait opened. Expected value
// source: design C7 "Driver checks" ("The four handle*Outcome functions
// return 'stop' first when runCancelled: no retry, no wait (AC 2)") and the
// task's own Success line. At base `handleDocumentOutcome`'s retry branch
// (`src/controller/runs.ts`, the fresh-retry block) calls `runDocumentPhase`
// again with no cancel check, reaching the review round (the drafted
// `requirements.md` already exists from the first step's edits) and a second
// real `spawn.start` row, then the final `error` wait.
describe('runOnce document-phase cancel suppresses the fresh retry (design C7 "Driver checks", Requirement 7 AC 1, AC 2)', () => {
  it('a cancel detected after the drafter fails starts no second drafter and opens no wait', async () => {
    writeScript(fx, [{
      stream: [{ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] } }],
      edits: [{ path: `.spec-workflow/specs/${SPEC}/requirements.md`, content: cleanDoc('requirements', 1) }],
      result: { subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 's', result: 'boom', usage: USAGE },
    }]);
    await writeRun(seedRun(fx));
    let cancelled = false;
    const onActivity = () => { cancelled = true; };

    await expect(runOnce(deps(fx, { isCancelled: () => cancelled, onActivity }), 'run-20261011-000000')).resolves.toBeUndefined();

    expect((await listWaits()).filter((w) => w.run === 'run-20261011-000000')).toHaveLength(0);
    const rows = readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8')
      .trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, string>);
    expect(rows.filter((r) => r.type === 'spawn.start')).toHaveLength(1);
  });
});

// Contract for the same check firing from the disk read alone (design C7
// "Driver checks", Requirement 7 AC 4): "the same holds with the in-memory
// set empty (isCancelled false, disk abandoned)." Pre/Call: identical to the
// test above, except `isCancelled` always returns `false` (an empty in-memory
// set, as after a controller restart) and the cancel signal is instead a real
// disk write of `status: 'abandoned'`, made from the same `onActivity` hook.
// Result: `runOnce` still resolves with no throw and the run still reads
// `abandoned` with no wait opened. Expected value source: Requirement 7 AC 4
// ("AC 1 to AC 3 SHALL hold after a controller restart, when the in-memory
// set is empty") read against design C7's `runCancelled` helper, which ORs
// `deps.isCancelled` with the disk read — at base `handleDocumentOutcome`'s
// retry branch has no such check at all, so its final `waitAnd` call reaches
// `createWait`'s abandoned-run guard (task 17) and `runOnce` rejects instead
// of resolving.
describe('runOnce document-phase cancel via disk alone, no in-memory flag (design C7 "Driver checks", Requirement 7 AC 4)', () => {
  it('the same holds with isCancelled always false once disk already reads abandoned', async () => {
    writeScript(fx, [{
      stream: [
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] } },
        { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] } },
      ],
      eventDelayMs: 150,
      edits: [{ path: `.spec-workflow/specs/${SPEC}/requirements.md`, content: cleanDoc('requirements', 1) }],
      result: { subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 's', result: 'boom', usage: USAGE },
    }]);
    await writeRun(seedRun(fx));
    let flipped = false;
    const onActivity = () => {
      if (flipped) return;
      flipped = true;
      void (async () => {
        const current = await readRun('run-20261011-000000');
        if (current) await writeRun({ ...current, status: 'abandoned', inFlight: undefined });
      })();
    };

    await expect(runOnce(deps(fx, { isCancelled: () => false, onActivity }), 'run-20261011-000000')).resolves.toBeUndefined();

    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('abandoned');
    expect((await listWaits()).filter((w) => w.run === 'run-20261011-000000')).toHaveLength(0);
  });
});

describe('cancelRun and discardRun', () => {
  function cancelDeps(fx: Fixture): CancelDeps {
    return { now: () => new Date(), ghBin: () => STUB_GH, graceMs: 2000 };
  }

  it('cancel signals the in-flight step and abandons the run', async () => {
    const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    const pid = child.pid as number;
    const startTime = processStartTime(pid) ?? 0;
    await writeRun(seedRun(fx, { inFlight: { id: 's1', pid, startTime } }));

    const run = await cancelRun(cancelDeps(fx), 'run-20261011-000000');
    expect(run?.status).toBe('abandoned');
    // The process group is gone.
    expect(() => process.kill(pid, 0)).toThrow();
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  });

  // Contract (design C7 "Order change", Requirement 7 AC 1/4; tasks.md task
  // 16). Pre-condition: a run with a real, live `inFlight` process.
  // Test: cancelRun(deps, runId), with `process.kill` spied so the test
  // reads the on-disk run record (via `readRunSync`, a synchronous read)
  // the instant the first `process.kill` call fires, before letting the
  // real signal through. Observable result: at that instant the disk
  // record already reads `status: 'abandoned'` with `inFlight` absent, and
  // the live step is still stopped afterward (the same process-gone check
  // the preceding test uses). Expected value source: design C7 "Order
  // change" ("`cancelRun` ... writes `abandoned` first, then signals the
  // pid it read, so a step killed by the signal always finds `abandoned`
  // on disk") and the task's own Success line.
  it('writes abandoned with no inFlight before the first process.kill, and still stops the live step', async () => {
    const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    const pid = child.pid as number;
    const startTime = processStartTime(pid) ?? 0;
    await writeRun(seedRun(fx, { inFlight: { id: 's1', pid, startTime } }));

    const realKill = process.kill.bind(process);
    let diskAtFirstKill: RunRecord | undefined;
    let killCalls = 0;
    const spy = vi.spyOn(process, 'kill').mockImplementation((killPid: number, signal?: string | number) => {
      if (killCalls === 0) diskAtFirstKill = readRunSync('run-20261011-000000');
      killCalls += 1;
      return realKill(killPid, signal as NodeJS.Signals | number | undefined);
    });

    try {
      const run = await cancelRun(cancelDeps(fx), 'run-20261011-000000');
      expect(run?.status).toBe('abandoned');
    } finally {
      spy.mockRestore();
    }

    expect(killCalls).toBeGreaterThan(0);
    expect(diskAtFirstKill?.status).toBe('abandoned');
    expect(diskAtFirstKill?.inFlight).toBeUndefined();
    // The process group is gone.
    expect(() => process.kill(pid, 0)).toThrow();
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  });

  // [regression guard] Requirement 7 AC 6: "A cancel SHALL keep the
  // worktree, branch and PR" (invariant, verified, not red-first per
  // requirements.md). Holds at base because `cancelRun` spreads the run it
  // read into its write. No existing assertion in this describe block
  // checks `worktree`/`branch` on a cancelled run's returned record; named
  // here per the implementer brief (agent-rules P10/P12).
  it('[regression guard] cancel keeps the worktree and branch unchanged', async () => {
    await writeRun(seedRun(fx, { worktree: fx.repo, branch: 'feat/keep-me' }));

    const run = await cancelRun(cancelDeps(fx), 'run-20261011-000000');

    expect(run?.worktree).toBe(fx.repo);
    expect(run?.branch).toBe('feat/keep-me');
  });

  it('discard removes the worktree, deletes the branch and closes the PR with gh', async () => {
    // A real worktree on a feat branch to remove.
    git(fx.repo, ['branch', 'feat/x']);
    const worktree = join(fx.repo, '.claude', 'worktrees', 'x');
    git(fx.repo, ['worktree', 'add', worktree, 'feat/x']);
    expect(existsSync(worktree)).toBe(true);

    const ghLog = join(fx.base, 'gh.log');
    process.env.STUB_GH_LOG = ghLog;
    await writeRun(seedRun(fx, { worktree, branch: 'feat/x' }));

    const run = await discardRun(cancelDeps(fx), 'run-20261011-000000');
    expect(run?.status).toBe('abandoned');
    expect(existsSync(worktree)).toBe(false);
    // The branch is gone.
    expect(() => git(fx.repo, ['rev-parse', '--verify', 'feat/x'])).toThrow();
    // gh pr close was invoked for the branch.
    const log = readFileSync(ghLog, 'utf8');
    expect(log).toContain('"pr"');
    expect(log).toContain('"close"');
    expect(log).toContain('feat/x');
  });

  // Source: task 4 Success (design C4 "Discard"; requirement 7 AC7, AC8).
  // Four criteria through this seam. Two sub-cases named in the task text
  // as regression guards are handled below without forcing a red test;
  // the "running ends abandoned as today" sub-case is already covered,
  // branch-exact, by the "discard removes the worktree, deletes the
  // branch and closes the PR with gh" test above (its seeded run defaults
  // to status `running`, and its `expect(run?.status).toBe('abandoned')`
  // is the same branch) — no new test added for it.
  //
  // Criterion "a done run discarded stays done, with its worktree and
  // branch gone": Pre-condition: a `done` run with a real worktree and
  // branch. Test: discardRun(deps, runId). Observable result: the
  // returned record's `status` is `'done'`, the worktree directory is
  // gone and the branch no longer resolves. Expected-value source: design
  // C4 ("discardRun skips cancelRun when the run is done, so status stays
  // done"), requirement 7 AC8.
  it('discard on a done run keeps it done, with the worktree and branch gone', async () => {
    git(fx.repo, ['branch', 'feat/done']);
    const worktree = join(fx.repo, '.claude', 'worktrees', 'done-run');
    git(fx.repo, ['worktree', 'add', worktree, 'feat/done']);
    expect(existsSync(worktree)).toBe(true);

    await writeRun(seedRun(fx, { status: 'done', worktree, branch: 'feat/done' }));

    const run = await discardRun(cancelDeps(fx), 'run-20261011-000000');

    expect(run?.status).toBe('done');
    expect(existsSync(worktree)).toBe(false);
    expect(() => git(fx.repo, ['rev-parse', '--verify', 'feat/done'])).toThrow();
  });

  // Criterion "an abandoned run discarded stays abandoned" (regression
  // guard: `cancelRun`'s unconditional write already re-writes the same
  // status on a run that starts abandoned, so this holds at base; named
  // here for the implementer brief since no existing assertion discards a
  // run that starts abandoned).
  it('[regression guard] discard on an already-abandoned run leaves it abandoned', async () => {
    await writeRun(seedRun(fx, { status: 'abandoned' }));

    const run = await discardRun(cancelDeps(fx), 'run-20261011-000000');

    expect(run?.status).toBe('abandoned');
  });

  // Criterion "change fires after the cleanup, seen as the branch already
  // gone when the listener runs": Pre-condition: a `done` run with a real
  // branch. Test: discardRun(deps, runId), with a `runEvents.once(
  // 'change', ...)` listener registered first. Observable result: when
  // the listener runs, `git rev-parse --verify` on the branch already
  // throws. Expected-value source: design C4 ("After the git and gh
  // cleanup, discardRun calls forgetBranchPresence(runId), then emits
  // runEvents change").
  it('emits change only after cleanup, so the branch is already gone when the listener runs', async () => {
    git(fx.repo, ['branch', 'feat/emit']);
    const worktree = join(fx.repo, '.claude', 'worktrees', 'emit');
    git(fx.repo, ['worktree', 'add', worktree, 'feat/emit']);
    await writeRun(seedRun(fx, { status: 'done', worktree, branch: 'feat/emit' }));

    let branchGoneWhenEmitted = false;
    runEvents.once('change', () => {
      branchGoneWhenEmitted = (() => {
        try { git(fx.repo, ['rev-parse', '--verify', 'feat/emit']); return false; } catch { return true; }
      })();
    });

    await discardRun(cancelDeps(fx), 'run-20261011-000000');

    expect(branchGoneWhenEmitted).toBe(true);
  });

  // Criterion "the next presence read after discard calls the read
  // again": Pre-condition: a `done` run whose `branchPresent` has already
  // been read and cached. Test: discardRun(deps, runId), then
  // branchPresent(run, read, now) again inside the same 60s window.
  // Observable result: the read function runs a second time. Expected-
  // value source: design C4's `forgetBranchPresence(runId)` call.
  it('forgets the cached branch presence after discard, so the next read runs again', async () => {
    const run = seedRun(fx, { id: 'run-discard-forgets', status: 'done', branch: 'main' });
    await writeRun(run);

    let calls = 0;
    const read: BranchRead = async () => { calls += 1; return true; };
    const at = () => 1_000;
    await branchPresent(run, read, at);
    expect(calls).toBe(1);
    await branchPresent(run, read, at);
    expect(calls).toBe(1);

    await discardRun(cancelDeps(fx), run.id);

    await branchPresent(run, read, at);
    expect(calls).toBe(2);
  });
});

describe('withPrRead', () => {
  const read = (patch: Partial<PrRead>): PrRead => ({
    kind: 'closeout', repo: 'repo-a', number: 1, ci: 'green', verdict: 'merged', reasons: [],
    at: '2026-10-11T00:00:00.000Z', ...patch,
  });

  it('replaces the entry with the same repo and number, keeps the others, and puts run first', () => {
    const other = read({ repo: 'repo-b', number: 2, kind: 'closeout', verdict: 'waiting' });
    const stale = read({ repo: 'repo-a', number: 1, kind: 'closeout', verdict: 'not-ready' });
    const fresh = read({ repo: 'repo-a', number: 1, kind: 'run', verdict: 'merged', sha: 'cafef00d' });

    const result = withPrRead([other, stale], fresh);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ repo: 'repo-a', number: 1, kind: 'run', verdict: 'merged', sha: 'cafef00d' });
    expect(result[1]).toMatchObject({ repo: 'repo-b', number: 2, kind: 'closeout', verdict: 'waiting' });
  });
});

describe('listRunsForWire', () => {
  it('carries prReads on the row, with no repoDir key', async () => {
    const pr: PrRead = {
      kind: 'run', repo: 'repo-a', number: 1, ci: 'green', verdict: 'merged', reasons: [],
      sha: 'abc1234', at: '2026-10-11T00:00:00.000Z',
    };
    await writeRun(seedRun(fx, { prReads: [pr] } as Partial<RunRecord>));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-20261011-000000');

    expect(row?.prReads).toEqual([pr]);
    expect(row).not.toHaveProperty('repoDir');
  });

  it('lists a record written without prReads with the field undefined', async () => {
    await writeRun(seedRun(fx));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-20261011-000000');

    expect(row?.prReads).toBeUndefined();
  });

  // Source: tasks.md task 6, Success (a)-(e); design C4 `listRunsForWire`/`toRow`.
  //
  // Criterion (a) "lastActivity carried": Pre-condition: a run record with
  //   `lastActivity` set. Test: listRunsForWire(). Observable result: the
  //   row's `lastActivity` equals the record's value. Expected-value source:
  //   design C4's `toRow` adding `lastActivity: run.lastActivity`.
  it('carries lastActivity on the row when the record has it', async () => {
    // Seeded through `writeLastActivity`, not `writeRun`: design C1 makes
    // `writeRun` always take `lastActivity` from disk (its one writer is
    // `writeLastActivity`), so a value passed through `seedRun`/`writeRun`
    // on a run's first write is discarded.
    await writeRun(seedRun(fx));
    await writeLastActivity('run-20261011-000000', '2026-10-11T00:00:05.000Z', '2026-10-11T00:00:05.000Z');

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-20261011-000000');

    expect(row?.lastActivity).toBe('2026-10-11T00:00:05.000Z');
  });

  // Criterion (b) "lastActivity omitted" (regression guard, named for the
  //   implementer brief: this branch already holds at base because `toRow`
  //   carries no `lastActivity` key at all today, so a record with none
  //   already produces a row with none): Pre-condition: a run record with no
  //   `lastActivity`. Test: listRunsForWire(). Observable result: the row's
  //   `lastActivity` is undefined. Expected-value source: design C4.
  it('omits lastActivity on the row when the record has none', async () => {
    await writeRun(seedRun(fx));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-20261011-000000');

    expect(row?.lastActivity).toBeUndefined();
  });

  // Criterion (c) "driven: true for a member of the set": Pre-condition: a
  //   run record. Test: listRunsForWire(driven) with a set holding the run's
  //   id. Observable result: the row reads `driven: true`. Expected-value
  //   source: design C4's `driven: driven.has(run.id)`.
  it('reads driven: true for a run id in the given set', async () => {
    await writeRun(seedRun(fx));

    const rows = await listRunsForWire(new Set(['run-20261011-000000']));
    const row = rows.find((r) => r.id === 'run-20261011-000000');

    expect(row?.driven).toBe(true);
  });

  // Criterion (d) "driven: false for a run outside the set": Pre-condition:
  //   a run record. Test: listRunsForWire(driven) with a set holding a
  //   different id. Observable result: the row reads `driven: false`.
  //   Expected-value source: design C4's `driven: driven.has(run.id)`.
  it('reads driven: false for a run id outside the given set', async () => {
    await writeRun(seedRun(fx));

    const rows = await listRunsForWire(new Set(['some-other-run']));
    const row = rows.find((r) => r.id === 'run-20261011-000000');

    expect(row?.driven).toBe(false);
  });

  // Criterion (e) "driven: false with no set given": Pre-condition: a run
  //   record. Test: listRunsForWire() with no argument. Observable result:
  //   the row reads `driven: false`. Expected-value source: design C4's
  //   default `= new Set()` and Requirement 2 AC 1 "a dashboard process that
  //   does not hold the controller lock ... SHALL report driven: false".
  it('reads driven: false for every row when no set is given', async () => {
    await writeRun(seedRun(fx));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-20261011-000000');

    expect(row?.driven).toBe(false);
  });

  // Source: task 10 _Prompt Success ("A row for a held run carries holdBy,
  //   and a row with none has it undefined"); R4 AC12; design C8
  //   ("ControllerRunRow, toRow ... gain holdBy?: 'operator' | 'deploy'").
  //
  // Criterion "holdBy carried for a held run": Pre-condition: a run record
  //   written with holdBy: 'deploy'. Test: listRunsForWire(). Observable
  //   result: the row's holdBy equals 'deploy'. Expected-value source: the
  //   literal 'deploy' value seeded into the record.
  it('carries holdBy on the row for a run held by a deploy', async () => {
    await writeRun(seedRun(fx, { holdBy: 'deploy', pauseRequested: '2026-10-11T00:00:00.000Z' }), { ownsPauseRequest: true });

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-20261011-000000');

    expect(row?.holdBy).toBe('deploy');
  });

  // Criterion "holdBy undefined for a run with none": Pre-condition: a run
  //   record written with no holdBy. Test: listRunsForWire(). Observable
  //   result: the row's holdBy is undefined. Expected-value source: the
  //   _Prompt's "a row with none has it undefined".
  it('leaves holdBy undefined on the row for a run with none', async () => {
    await writeRun(seedRun(fx));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-20261011-000000');

    expect(row?.holdBy).toBeUndefined();
  });

  // Source: task 3 Success "A row with `inFlight` set reads `inFlight:
  // true`, and one without reads `false`"; R12 AC 1; design C3's Data
  // Models (`inFlight: boolean; // run.inFlight !== undefined`).
  //
  // Criterion "inFlight: true when the record has one": Pre-condition: a
  // run record with `inFlight` set. Test: listRunsForWire(). Observable
  // result: the row's `inFlight` is `true`. Expected-value source: the
  // Data Models comment above.
  it('reads inFlight: true for a run with an in-flight step', async () => {
    await writeRun(seedRun(fx, {
      id: 'run-inflight-true',
      inFlight: { id: 's1', pid: 1, startTime: 0 },
    }));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-inflight-true');

    expect(row?.inFlight).toBe(true);
  });

  // Criterion "inFlight: false when the record has none": Pre-condition: a
  // run record with no `inFlight`. Test: listRunsForWire(). Observable
  // result: the row's `inFlight` is `false`. Expected-value source: the
  // same Data Models comment.
  it('reads inFlight: false for a run with no in-flight step', async () => {
    await writeRun(seedRun(fx, { id: 'run-inflight-false' }));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-inflight-false');

    expect(row?.inFlight).toBe(false);
  });

  // Source: task 3 Success "`stepStarted` and `task` come from the
  // record's `inFlight`"; R12 AC 1, AC 2; design C3's Data Models
  // (`stepStarted?: string; // run.inFlight?.startedAt`, `task?: string;
  // // run.inFlight?.task`).
  //
  // Criterion "stepStarted and task carried": Pre-condition: a run record
  // whose `inFlight` has both `startedAt` and `task`. Test:
  // listRunsForWire(). Observable result: the row's `stepStarted` equals
  // `inFlight.startedAt` and `task` equals `inFlight.task`. Expected-value
  // source: the literal values seeded into the record.
  it('carries stepStarted and task from the in-flight record', async () => {
    await writeRun(seedRun(fx, {
      id: 'run-inflight-fields',
      inFlight: { id: 's1', pid: 1, startTime: 0, startedAt: '2026-11-06T00:00:00.000Z', task: 'task-1' },
    }));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-inflight-fields');

    expect(row?.stepStarted).toBe('2026-11-06T00:00:00.000Z');
    expect(row?.task).toBe('task-1');
  });

  // Source: task 3 Success "an `inFlight` with no `startedAt` gives no
  // `stepStarted`"; R12 AC 3 ("an in-flight record predates these fields
  // ... the row shall report no start time").
  //
  // Criterion "stepStarted omitted when startedAt is absent": Pre-
  // condition: a run record whose `inFlight` has `task` but no
  // `startedAt` (a record predating the fields). Test: listRunsForWire().
  // Observable result: the row's `inFlight` is `true`, `task` carries the
  // seeded value (proving the row reflects this record, not a default),
  // and `stepStarted` is undefined. Expected-value source: R12 AC 3.
  it('omits stepStarted for an in-flight record with no startedAt', async () => {
    await writeRun(seedRun(fx, {
      id: 'run-inflight-no-start',
      inFlight: { id: 's1', pid: 1, startTime: 0, task: 'task-2' },
    }));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-inflight-no-start');

    expect(row?.inFlight).toBe(true);
    expect(row?.task).toBe('task-2');
    expect(row?.stepStarted).toBeUndefined();
  });

  // Source: task 3 Success "a stopped run's `branchPresent` is the read's
  // value for each of `done`, `abandoned` and `error`"; R12 AC 1; design C3
  // ("`branchPresent` is the C2 read for `done`, `abandoned` and
  // `error`").
  //
  // Criterion "branchPresent for a done run": Pre-condition: a `done` run
  // record with a non-empty branch. Test: listRunsForWire(driven,
  // branchRead) with a `branchRead` resolving `true`. Observable result:
  // the row's `branchPresent` is `true`. Expected-value source: the stub's
  // return value.
  it('reads branchPresent from the given read for a done run', async () => {
    await writeRun(seedRun(fx, { id: 'run-done-present', status: 'done', branch: 'feat/x' }));

    const rows = await listRunsForWire(new Set(), async () => true);
    const row = rows.find((r) => r.id === 'run-done-present');

    expect(row?.branchPresent).toBe(true);
  });

  // Criterion "branchPresent for an abandoned run": same shape as above
  // with `status: 'abandoned'`.
  it('reads branchPresent from the given read for an abandoned run', async () => {
    await writeRun(seedRun(fx, { id: 'run-abandoned-present', status: 'abandoned', branch: 'feat/x' }));

    const rows = await listRunsForWire(new Set(), async () => true);
    const row = rows.find((r) => r.id === 'run-abandoned-present');

    expect(row?.branchPresent).toBe(true);
  });

  // Criterion "branchPresent for an error run": same shape as above with
  // `status: 'error'`.
  it('reads branchPresent from the given read for an error run', async () => {
    await writeRun(seedRun(fx, { id: 'run-error-present', status: 'error', branch: 'feat/x' }));

    const rows = await listRunsForWire(new Set(), async () => true);
    const row = rows.find((r) => r.id === 'run-error-present');

    expect(row?.branchPresent).toBe(true);
  });

  // Source: task 3 Success "a rejected read gives `false`"; design C2
  // post-conditions ("A rejected read gives `false`"), carried through C3.
  //
  // Criterion "rejected read gives false": Pre-condition: a `done` run
  // record. Test: listRunsForWire(driven, branchRead) with a `branchRead`
  // that rejects. Observable result: the row's `branchPresent` is `false`.
  // Expected-value source: design C2's fail-safe.
  it('reads branchPresent as false when the given read rejects', async () => {
    await writeRun(seedRun(fx, { id: 'run-done-rejects', status: 'done', branch: 'feat/x' }));

    const rows = await listRunsForWire(new Set(), async () => { throw new Error('git failed'); });
    const row = rows.find((r) => r.id === 'run-done-rejects');

    expect(row?.branchPresent).toBe(false);
  });

  // Source: task 3 Success "a moving run with a branch gives `true` and a
  // moving run with `branch: ''` gives `false`, each with the read not
  // called"; R12 AC 1; design C3 ("a moving run reports `run.branch !==
  // ''` with no read").
  //
  // Criterion "moving run with a branch: true, no read": Pre-condition: a
  // `running` run record with a non-empty branch. Test: listRunsForWire(
  // driven, branchRead) with a `branchRead` spy. Observable result: the
  // row's `branchPresent` is `true` and the spy was never called.
  // Expected-value source: design C3.
  it('reads branchPresent: true for a moving run with a branch, with no read', async () => {
    await writeRun(seedRun(fx, { id: 'run-moving-branch', status: 'running', branch: 'feat/x' }));
    const read = vi.fn(async () => false);

    const rows = await listRunsForWire(new Set(), read);
    const row = rows.find((r) => r.id === 'run-moving-branch');

    expect(row?.branchPresent).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  // Criterion "moving run with branch '': false, no read": Pre-condition:
  // a `running` run record with `branch: ''` (a queued relaunch, design
  // C3/controller.ts:231-261). Test: listRunsForWire(driven, branchRead)
  // with a `branchRead` spy. Observable result: the row's `branchPresent`
  // is `false` and the spy was never called. Expected-value source:
  // design C3.
  it('reads branchPresent: false for a moving run with an empty branch, with no read', async () => {
    await writeRun(seedRun(fx, { id: 'run-moving-no-branch', status: 'running', branch: '' }));
    const read = vi.fn(async () => true);

    const rows = await listRunsForWire(new Set(), read);
    const row = rows.find((r) => r.id === 'run-moving-no-branch');

    expect(row?.branchPresent).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  // Source: task 3 Success "`branchHeld` is true for another moving run
  // with the same `codeRoot` and branch"; design C3 (`branchHeld(run,
  // runs)`). The row's `discardAllowed` (`!branchHeld(run, allRuns)`, same
  // clause) is the observable, since `branchHeld` is only reached through
  // `listRunsForWire` per the task's seam.
  //
  // Criterion "held: same codeRoot and branch, other run moving":
  // Pre-condition: a stopped run and another `running` run sharing
  // `codeRoot` and `branch`. Test: listRunsForWire(). Observable result:
  // the stopped run's row reads `discardAllowed: false`. Expected-value
  // source: design C3.
  it('discardAllowed is false when another moving run shares codeRoot and branch', async () => {
    await writeRun(seedRun(fx, { id: 'run-held-a', status: 'done', branch: 'feat/x', codeRoot: fx.repo }));
    await writeRun(seedRun(fx, { id: 'run-held-b', status: 'running', branch: 'feat/x', codeRoot: fx.repo }));

    const rows = await listRunsForWire(new Set(), async () => false);
    const row = rows.find((r) => r.id === 'run-held-a');

    expect(row?.discardAllowed).toBe(false);
  });

  // Source: task 3 Success "true for a moving run with an empty branch,
  // the same `codeRoot` and the same spec (D25)"; design D25 (a queued
  // relaunch matches on spec, not branch, because it has none yet). Folds
  // in the "`discardAllowed` is its negation" criterion, observed in the
  // same assertion.
  //
  // Criterion "held: empty-branch relaunch, same codeRoot and spec":
  // Pre-condition: a stopped run and another `queued` run sharing
  // `codeRoot` and `spec`, the other's `branch` empty. Test:
  // listRunsForWire(). Observable result: the stopped run's row reads
  // `discardAllowed: false`. Expected-value source: design D25.
  it('discardAllowed is false when a queued relaunch shares codeRoot and spec with no branch yet', async () => {
    await writeRun(seedRun(fx, { id: 'run-relaunch-a', status: 'abandoned', branch: 'feat/y', codeRoot: fx.repo, spec: SPEC }));
    await writeRun(seedRun(fx, { id: 'run-relaunch-b', status: 'queued', branch: '', codeRoot: fx.repo, spec: SPEC }));

    const rows = await listRunsForWire(new Set(), async () => false);
    const row = rows.find((r) => r.id === 'run-relaunch-a');

    expect(row?.discardAllowed).toBe(false);
  });

  // Source: task 3 Success "false for a different `codeRoot`"; design C3.
  //
  // Criterion "not held: different codeRoot": Pre-condition: a stopped run
  // and another `running` run sharing `branch` but not `codeRoot`. Test:
  // listRunsForWire(). Observable result: the stopped run's row reads
  // `discardAllowed: true`. Expected-value source: design C3.
  it('discardAllowed is true when the other moving run has a different codeRoot', async () => {
    await writeRun(seedRun(fx, { id: 'run-diffroot-a', status: 'done', branch: 'feat/x', codeRoot: fx.repo }));
    await writeRun(seedRun(fx, { id: 'run-diffroot-b', status: 'running', branch: 'feat/x', codeRoot: `${fx.repo}-other` }));

    const rows = await listRunsForWire(new Set(), async () => false);
    const row = rows.find((r) => r.id === 'run-diffroot-a');

    expect(row?.discardAllowed).toBe(true);
  });

  // Source: task 3 Success "false for ... a stopped other run"; design C3
  // ("another run has a moving status").
  //
  // Criterion "not held: other run stopped": Pre-condition: a stopped run
  // and another stopped run sharing `codeRoot` and `branch`. Test:
  // listRunsForWire(). Observable result: the first row reads
  // `discardAllowed: true`. Expected-value source: design C3.
  it('discardAllowed is true when the other run sharing the branch is stopped', async () => {
    await writeRun(seedRun(fx, { id: 'run-stopped-other-a', status: 'done', branch: 'feat/x', codeRoot: fx.repo }));
    await writeRun(seedRun(fx, { id: 'run-stopped-other-b', status: 'done', branch: 'feat/x', codeRoot: fx.repo }));

    const rows = await listRunsForWire(new Set(), async () => false);
    const row = rows.find((r) => r.id === 'run-stopped-other-a');

    expect(row?.discardAllowed).toBe(true);
  });

  // Source: task 3 Success "false for ... the run itself"; design C3
  // (`branchHeld`'s "another run" wording).
  //
  // Criterion "not held: matches only itself": Pre-condition: one moving
  // run, no other run on record, sharing its own codeRoot/branch/spec with
  // itself. Test: listRunsForWire(). Observable result: its row reads
  // `discardAllowed: true`, because the only codeRoot/branch match in the
  // full run list is the run itself. Expected-value source: design C3's
  // "another run" wording.
  it('discardAllowed is true when the run only matches itself', async () => {
    await writeRun(seedRun(fx, { id: 'run-self-only', status: 'running', branch: 'feat/x', codeRoot: fx.repo, spec: SPEC }));

    const rows = await listRunsForWire(new Set(), async () => false);
    const row = rows.find((r) => r.id === 'run-self-only');

    expect(row?.discardAllowed).toBe(true);
  });

  // Source: task 3 Success "`JSON.stringify(row)` holds neither `codeRoot`
  // nor `worktree`"; NFR Security ("The run row SHALL carry no filesystem
  // path", `src/controller/runs.ts:1425`). RED-IMPOSSIBLE as a whole:
  // `toRow` already omits both keys at base; kept here as a regression
  // guard (retro P10/P12) since no existing assertion names this pair and
  // this task edits `toRow` directly.
  //
  // Criterion "row carries no path": Pre-condition: a run record (codeRoot
  // and worktree set to real filesystem paths). Test: listRunsForWire().
  // Observable result: `JSON.stringify(row)` contains neither the
  // substring "codeRoot" nor "worktree". Expected-value source: NFR
  // Security.
  it('carries no codeRoot or worktree in the serialized row', async () => {
    await writeRun(seedRun(fx, { id: 'run-no-path' }));

    const rows = await listRunsForWire();
    const row = rows.find((r) => r.id === 'run-no-path');
    const json = JSON.stringify(row);

    expect(json).not.toContain('codeRoot');
    expect(json).not.toContain('worktree');
  });
});

// Contract for the implementation-phase final error wait's own cancel check
// (design C7 "Driver checks", Requirement 7 AC 2). Per success criterion: "a
// step failure after a cancel opens no error or escalation wait in each of
// the four phases." Pre: approved requirements/design/tasks (no tasks, so the
// phase runs one step: the end-to-end verifier), the run's cursor already at
// attempt 2 (the one fresh retry already spent), so a failing step falls
// straight to `handleImplementationOutcome`'s final `error` wait — a branch
// the loop-top's own abandoned/cancel check never reaches (that check only
// intercepts the next loop iteration, not this direct call within the
// current one). Call: `runOnce(deps(fx, { isCancelled, onActivity }),
// runId)`, with `onActivity` (fired on the verifier step's `tool_use`
// activity, before its failing result is read) flipping `isCancelled` true.
// Result: no `error` wait opens for this run. Expected value source: design
// C7 "Driver checks" ("The four handle*Outcome functions return 'stop' first
// when runCancelled: no retry, no wait (AC 2)") and the task's own Success
// line; at base `handleImplementationOutcome`'s final branch
// (`src/controller/runs.ts`, after the exhausted-retry check) calls
// `waitAnd` unconditionally.
describe('runOnce implementation-phase cancel suppresses the final error wait (design C7 "Driver checks", Requirement 7 AC 2)', () => {
  it('a step failure after a cancel opens no error wait', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeScript(fx, [{
      stream: [{ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] } }],
      result: { subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 's', result: 'boom', usage: {} },
    }]);
    await writeRun(seedRun(fx, { cursor: { phase: 'implementation', stepKind: 'implementation', attempt: 2 } }));
    let cancelled = false;
    const onActivity = () => { cancelled = true; };

    await runOnce(deps(fx, { isCancelled: () => cancelled, onActivity }), 'run-20261011-000000');

    expect((await listWaits()).filter((w) => w.run === 'run-20261011-000000' && w.kind === 'error')).toHaveLength(0);
  }, 30000);
});

// Same contract, the retrospective phase (design C7 "Driver checks",
// Requirement 7 AC 2). Pre: approved documents, implementation already
// marked complete on the ledger (so `routeRun` resolves `retrospective`), the
// cursor already at attempt 2. Call/Result: as the implementation-phase test
// above, for the compile step. Expected value source: the same design C7
// text and task Success line; at base `handleRetrospectiveOutcome`'s final
// branch (`src/controller/runs.ts`, after the exhausted-retry check) calls
// `waitAnd` unconditionally.
describe('runOnce retrospective-phase cancel suppresses the final error wait (design C7 "Driver checks", Requirement 7 AC 2)', () => {
  it('a step failure after a cancel opens no error wait', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    openRunLedger({ specDir: fx.specDir, runId: 'run-20261011-000000', spec: SPEC }).phaseEnd('implementation', { result: 'complete' });
    writeFileSync(join(fx.specDir, 'retrospective-log.md'), `# Retrospective log — ${SPEC}\n`);
    writeScript(fx, [{
      stream: [{ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] } }],
      result: { subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 's', result: 'boom', usage: {} },
    }]);
    await writeRun(seedRun(fx, { cursor: { phase: 'retrospective', stepKind: 'retrospective', attempt: 2 } }));
    let cancelled = false;
    const onActivity = () => { cancelled = true; };

    await runOnce(deps(fx, { isCancelled: () => cancelled, onActivity }), 'run-20261011-000000');

    expect((await listWaits()).filter((w) => w.run === 'run-20261011-000000' && w.kind === 'error')).toHaveLength(0);
  }, 30000);
});

// Same contract, the close-out phase (design C7 "Driver checks", Requirement
// 7 AC 2). Pre: approved documents, an `APPROVED` retrospective-plan.md with
// one `store`-class item (lands as a commit in the spec store itself, no
// retro worktree needed), the cursor already at attempt 2. Call/Result: as
// the implementation-phase test above, for the close-out implementer batch.
// Expected value source: the same design C7 text and task Success line; at
// base `handleCloseoutOutcome`'s final branch (`src/controller/runs.ts`,
// after the exhausted-retry check) calls `waitAnd` unconditionally.
describe('runOnce close-out-phase cancel suppresses the final error wait (design C7 "Driver checks", Requirement 7 AC 2)', () => {
  it('a step failure after a cancel opens no error wait', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeFileSync(join(fx.repo, '.spec-workflow', 'agent-rules.md'), '# Agent rules\n\nmerge: auto\n\n## Sensitive paths\n\n- package.json\n');
    writeFileSync(join(fx.repo, '.spec-workflow', 'HANDOFF.md'), '# H\n\n## Phase log\n\n| Date | Spec | Stage | State | Result | Note |\n| --- | --- | --- | --- | --- | --- |\n');
    writeFileSync(join(fx.specDir, 'retrospective-log.md'), `# Retrospective log — ${SPEC}\n`);
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), [
      `# Retrospective plan — ${SPEC}`, '', 'Status: APPROVED', 'Date: 2026-10-11', '',
      '## Approved proposals', '',
      '- **P1 (F1) — Tidy the ledger.** Make it nicer.',
      '  Target: steering (`.spec-workflow/agent-rules.md`).', '  Decision: do it.', '',
      '## Decisions', 'None.', '', '## Rejected proposals', 'None.', '',
    ].join('\n'));
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', 'seed close-out plan']);
    writeScript(fx, [{
      stream: [{ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: {} }] } }],
      result: { subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 's', result: 'boom', usage: {} },
    }]);
    await writeRun(seedRun(fx, { cursor: { phase: 'closeout', stepKind: 'closeout', attempt: 2 } }));
    let cancelled = false;
    const onActivity = () => { cancelled = true; };

    await runOnce(deps(fx, { isCancelled: () => cancelled, onActivity }), 'run-20261011-000000');

    expect((await listWaits()).filter((w) => w.run === 'run-20261011-000000' && w.kind === 'error')).toHaveLength(0);
  }, 30000);
});

// Source: tasks.md task 4, Success (a)-(b); design C3 `setRunHeartbeat`.
describe('setRunHeartbeat', () => {
  const RUN_ID = 'run-20261011-000000';
  const clock = (): Date => new Date('2026-10-11T00:00:10.000Z');

  it('writes the value and emits one change', async () => {
    // Pre-condition: a non-terminal run record exists on disk.
    await writeRun(seedRun(fx));
    const seen: RunRecord[] = [];
    const onChange = (r: RunRecord): void => { if (r.id === RUN_ID) seen.push(r); };
    runEvents.on('change', onChange);

    // Test: setRunHeartbeat(now, runId, value).
    try {
      await setRunHeartbeat(clock, RUN_ID, '2026-10-11T00:00:05.000Z');
    } finally {
      runEvents.removeListener('change', onChange);
    }

    // Observable result: the record on disk carries the value, and exactly one
    // `change` fired with that same value. Source: task 4 Success (a).
    const run = await readRun(RUN_ID);
    expect(run?.lastActivity).toBe('2026-10-11T00:00:05.000Z');
    expect(seen).toHaveLength(1);
    expect(seen[0].lastActivity).toBe('2026-10-11T00:00:05.000Z');
  });

  it('emits nothing when no record was written', async () => {
    // Pre-condition: no run exists at this id, so `writeLastActivity` resolves
    // undefined (design C1 post-condition (g)) and nothing was written.
    const seen: RunRecord[] = [];
    const onChange = (r: RunRecord): void => { seen.push(r); };
    runEvents.on('change', onChange);

    // Test: setRunHeartbeat(now, runId, value) against a missing run.
    try {
      await setRunHeartbeat(clock, 'run-does-not-exist', '2026-10-11T00:00:05.000Z');
    } finally {
      runEvents.removeListener('change', onChange);
    }

    // Observable result: no `change` event fired. Source: task 4 Success (b).
    expect(seen).toHaveLength(0);
  });
});

describe('runOnce merge stage', () => {
  const BRANCH = 'feat/x';

  /**
   * Check the fixture repo out onto the run's feature branch, the real state of
   * a `worktree-per-change` run: the merge stage reads the worktree's branch and
   * must see a feature branch, not the default branch, to look for the PR.
   */
  function onFeatureBranch(fx: Fixture): void {
    git(fx.repo, ['checkout', '-q', '-b', BRANCH]);
  }

  /** A `gh pr view` payload that passes the merge rule for branch `feat/x`. */
  const readyView = {
    mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
    headRefName: BRANCH, headRefOid: 'deadbeefcafe', body: 'Clean body.',
    commits: [{ oid: 'deadbeefcafe', messageHeadline: 'feat: do it', messageBody: '', committedDate: '2026-10-11T11:00:00.000Z' }],
    author: { login: 'someone' },
  };
  /** The two CI reads that follow every `pr view`: workflow runs for the head sha, then commit statuses. */
  const runsOk = { argvIncludes: ['api'], stdout: { total_count: 1, workflow_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }] } };
  const runsPending = { argvIncludes: ['api'], stdout: { total_count: 1, workflow_runs: [{ name: 'build', status: 'in_progress', conclusion: null }] } };
  const statusOk = { argvIncludes: ['api'], stdout: { state: 'pending', total_count: 0, statuses: [] } };

  /** Point stub-gh at a scripted sequence of responses. */
  function writeGhScript(fx: Fixture, runs: unknown[]): void {
    const scriptPath = join(fx.base, 'gh-script.json');
    writeFileSync(scriptPath, JSON.stringify(runs));
    process.env.CONTROLLER_GH_BIN = STUB_GH;
    process.env.STUB_GH_SCRIPT = scriptPath;
  }

  /**
   * The in-code implementation phase on a tasks document with no tasks runs one
   * step: the end-to-end verifier. This stub passes it; no remote ⇒ no PR step.
   */
  const e2eRun: StubRun = {
    result: {
      subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'VERIFY: pass',
      structured_output: { verify: 'pass', deferredCommand: '', findings: '', retro: 'none' }, usage: {},
    },
  };
  /** The retrospective in code: the compile step writes the findings, the analyst the proposals. */
  const compileRun: StubRun = {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/retrospective.md`, content: ['# Retrospective — ' + SPEC, '', '## Gotchas', '- **F1 — x.** y. Evidence: z. Frequency: once. Cost: 1.', '', '## Proposal format (for the analyst)', '', 'One per finding.', ''].join('\n') }],
    result: { subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'compiled', structured_output: { findings: 1, path: 'retrospective.md' }, usage: {} },
  };
  const analystRun: StubRun = {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/retrospective-proposals.md`, content: ['# proposals', '', '## Proposals', '- **P1 (F1) — Tidy.** Do it.', '  DECISION NEEDED: no.', '', '## Graduation candidates', 'None found.', ''].join('\n') }],
    result: { subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'proposed', structured_output: { proposals: 1 }, usage: {} },
  };

  function mergedRows(fx: Fixture): Record<string, string>[] {
    return readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8')
      .trim().split('\n').map((l) => JSON.parse(l) as Record<string, string>);
  }

  /** A plan whose close-out is done: `Status: CLOSED` routes the run to `done`. */
  function closePlan(fx: Fixture): void {
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), ['# Retrospective plan — ' + SPEC, '', 'Status: CLOSED', '', '## Approved proposals', '', '## Close-out', '- P1: skipped — none', ''].join('\n'));
  }
  const RETRO_BRANCH = `chore/${SPEC}-retro`;

  it('merges an unmerged close-out PR by rule before the run ends, recording it with its repo', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    closePlan(fx);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'view'], stdout: { ...readyView, headRefName: RETRO_BRANCH } },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'c105e0a7' } } },
    ]);
    await writeRun(seedRun(fx, { closeoutPrs: [{ repoDir: fx.repo, branch: RETRO_BRANCH, number: 7 }] }));

    await runOnce(deps(fx), 'run-20261011-000000');

    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('done');
    const rows = mergedRows(fx);
    expect(rows.find((r) => r.type === 'pr.merged')).toMatchObject({ number: '7', sha: 'c105e0a7', method: 'merge', repo: basename(fx.repo) });
    expect(rows.filter((r) => r.type === 'run.end')).toHaveLength(1);
    expect(run?.prReads).toHaveLength(1);
    expect(run?.prReads?.[0]).toMatchObject({ kind: 'closeout', verdict: 'merged', repo: basename(fx.repo), sha: 'c105e0a7' });
    // The store is committed and clean at the end; no remote, so nothing was pushed.
    expect(rows[rows.length - 1].type).toBe('run.end');
    expect(git(fx.repo, ['status', '--short']).trim()).toBe('');
  }, 30000);

  it('ask: a close-out PR opens its own merge wait, and an answer of merge ends the run done', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    closePlan(fx);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'view'], stdout: { ...readyView, headRefName: RETRO_BRANCH } },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'view'], stdout: { ...readyView, headRefName: RETRO_BRANCH } },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'ab12cd34' } } },
    ]);
    await writeRun(seedRun(fx, { closeoutPrs: [{ repoDir: fx.repo, branch: RETRO_BRANCH, number: 7 }] }));
    const ask = { mergeRules: () => ({ method: 'merge' as const, postMerge: null, merge: 'ask' as const }) };

    await runOnce(deps(fx, ask), 'run-20261011-000000');
    let run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    const wait = (await listWaits()).find((w) => w.kind === 'merge' && w.run === 'run-20261011-000000');
    expect(wait?.questions[0]).toMatchObject({ id: `merge:${basename(fx.repo)}#7`, text: `Merge close-out PR #7 of ${basename(fx.repo)}?` });

    await answerWait(wait!.id, { [`merge:${basename(fx.repo)}#7`]: 'merge' }, 'matthew');
    await runOnce(deps(fx, ask), 'run-20261011-000000');
    run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('done');
    expect(mergedRows(fx).find((r) => r.type === 'pr.merged')).toMatchObject({ number: '7', repo: basename(fx.repo) });
  }, 30000);

  it('auto: not-ready once, then merged, then the retro step runs', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    onFeatureBranch(fx);
    writeScript(fx, [e2eRun, compileRun, analystRun]);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsPending, statusOk,
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'cafef00d1234' } } },
    ]);
    await writeRun(seedRun(fx, { branch: BRANCH }));

    // First pass: the implementation phase completes, the PR is found and parked `merging`.
    await runOnce(deps(fx), 'run-20261011-000000');
    let run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('merging');
    expect(run?.pr).toBe(42);
    expect(run?.prReads).toHaveLength(1);
    expect(run?.prReads?.[0]).toMatchObject({ verdict: 'not-ready', ci: 'pending' });

    // Second pass (the scheduler re-enters): the check is green, so it merges,
    // writes pr.merged, then runs the retrospective and parks at the retro plan.
    await runOnce(deps(fx), 'run-20261011-000000');
    run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    expect(run?.phase).toBe('retrospective');
    expect(run?.prReads).toHaveLength(1);
    expect(run?.prReads?.[0]).toMatchObject({ verdict: 'merged', sha: 'cafef00d1234' });

    const merged = mergedRows(fx).find((r) => r.type === 'pr.merged');
    expect(merged).toMatchObject({ number: '42', sha: 'cafef00d1234', method: 'merge' });

    const retro = (await listWaits()).find((w) => w.kind === 'retro-plan' && w.run === 'run-20261011-000000');
    expect(retro).toBeTruthy();
  }, 30000);

  it('a held run resuming the merge stage pauses at the loop top before any re-check or merge (design C3 point 1, C5)', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    closePlan(fx);
    onFeatureBranch(fx);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'cafef00d1234' } } },
    ]);
    await writeRun(seedRun(fx, {
      status: 'merging', branch: BRANCH, pr: 42,
      cursor: { phase: 'implementation', stepKind: 'implementation', attempt: 1 },
    }));

    await runOnce(deps(fx, { isPauseRequested: () => true }), 'run-20261011-000000');

    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('paused');
    expect(run?.pauseReason).toBe('operator');
    expect(run?.resumeAt).toBeUndefined();
    expect(run?.cursor).toMatchObject({ stepKind: 'merge' });
    expect(mergedRows(fx).some((r) => r.type === 'pr.merged')).toBe(false);
  }, 30000);

  it('a hold set while the last implementation step runs leaves its PR unmerged and parks the run operator-paused (design C3 point 4)', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    onFeatureBranch(fx);
    writeScript(fx, [e2eRun]);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'cafef00d1234' } } },
    ]);
    await writeRun(seedRun(fx, { branch: BRANCH }));
    // The operator pauses while the only (last) implementation step is in
    // flight: the hold flips true the moment the step reports its pid.
    let held = false;

    await runOnce(deps(fx, {
      isPauseRequested: () => held,
      setInFlight: () => { held = true; },
    }), 'run-20261011-000000');

    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('paused');
    expect(run?.pauseReason).toBe('operator');
    expect(mergedRows(fx).some((r) => r.type === 'pr.merged')).toBe(false);
  }, 30000);

  it('ask: opens a merge wait, an answer of merge proceeds to the retro', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    onFeatureBranch(fx);
    writeScript(fx, [e2eRun, compileRun, analystRun]);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'ab12cd34' } } },
    ]);
    await writeRun(seedRun(fx, { branch: BRANCH }));

    await runOnce(deps(fx, { mergeRules: () => ({ method: 'merge', postMerge: null, merge: 'ask' }) }), 'run-20261011-000000');
    let run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    const wait = (await listWaits()).find((w) => w.kind === 'merge' && w.run === 'run-20261011-000000');
    expect(wait).toBeTruthy();

    await answerWait(wait!.id, { merge: 'merge' }, 'matthew');

    await runOnce(deps(fx, { mergeRules: () => ({ method: 'merge', postMerge: null, merge: 'ask' }) }), 'run-20261011-000000');
    run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    expect(run?.phase).toBe('retrospective');
    expect(mergedRows(fx).some((r) => r.type === 'pr.merged')).toBe(true);
    // Only ever one merge wait.
    expect((await listWaits()).filter((w) => w.kind === 'merge')).toHaveLength(1);
  }, 30000);

  it('failed: a failing merge writes an error wait', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    onFeatureBranch(fx);
    writeScript(fx, [e2eRun]);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge'], stderr: 'the base branch has moved\n', exitCode: 1 },
    ]);
    await writeRun(seedRun(fx, { branch: BRANCH }));

    await runOnce(deps(fx), 'run-20261011-000000');
    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    const err = (await listWaits()).find((w) => w.kind === 'error' && w.run === 'run-20261011-000000');
    expect(err).toBeTruthy();
    expect(err!.questions[0].text).toMatch(/the base branch has moved/);
    expect(mergedRows(fx).some((r) => r.type === 'pr.merged')).toBe(false);
  }, 30000);

  it('no PR after a completed implementation is an error wait, not a skip to the retro', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    onFeatureBranch(fx); // a feature-branch run: a missing PR is an error, not a skip
    writeScript(fx, [e2eRun]); // the phase completes; with no remote it opens no PR
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [] }, // an empty open-PR list
    ]);
    await writeRun(seedRun(fx, { branch: BRANCH }));

    await runOnce(deps(fx), 'run-20261011-000000');
    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    // A `merge` cursor so a "retry" re-enters the merge stage, not the supervisor.
    expect(run?.cursor?.stepKind).toBe('merge');

    const err = (await listWaits()).find((w) => w.kind === 'error' && w.run === 'run-20261011-000000');
    expect(err).toBeTruthy();
    expect(err!.questions[0].text).toMatch(/no pull request exists/i);

    // It did not proceed to the retrospective, and nothing was merged.
    expect((await listWaits()).some((w) => w.kind === 'retro-plan')).toBe(false);
    expect(mergedRows(fx).some((r) => r.type === 'pr.merged')).toBe(false);
  }, 30000);

  it('a run on the default branch has no PR by design: it skips the merge stage to the retro with a note, no error wait', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    // The fixture repo stays on `main`, its default branch (a project without
    // `worktree-per-change: required`): the implementation opens no PR and the
    // merge stage must route to the retrospective, not raise a no-PR error.
    writeScript(fx, [e2eRun, compileRun, analystRun]);
    await writeRun(seedRun(fx, { branch: 'main' }));

    await runOnce(deps(fx), 'run-20261011-000000');

    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    expect(run?.phase).toBe('retrospective');
    // Routed to the retro-plan wait, with no error wait from the missing PR.
    expect((await listWaits()).some((w) => w.kind === 'retro-plan' && w.run === 'run-20261011-000000')).toBe(true);
    expect((await listWaits()).some((w) => w.kind === 'error' && w.run === 'run-20261011-000000')).toBe(false);
    // The merge stage wrote its skip note and merged nothing.
    const rows = mergedRows(fx);
    expect(rows.some((r) => r.type === 'note'
      && /run on the default branch main; no PR, skipping the merge stage/.test(r.text ?? ''))).toBe(true);
    expect(rows.some((r) => r.type === 'pr.merged')).toBe(false);
  }, 30000);

  it('a "retry" on the no-PR error re-enters the merge stage and finds the PR', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    onFeatureBranch(fx);
    // As if the supervisor had already written the retro files; after the merge
    // the run routes straight to the retro-plan wait (no supervisor step needed).
    writeFileSync(join(fx.specDir, 'retrospective-proposals.md'),
      ['# proposals', '', '## Proposals', '- **P1 — Tidy.** Do it.', '  DECISION NEEDED: no.', ''].join('\n'));
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: DRAFT\n');
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'beefcafe1234' } } },
    ]);
    // The run was parked on a no-PR error wait: a `merge` cursor, status running
    // after the operator answered "retry".
    await writeRun(seedRun(fx, {
      branch: BRANCH, status: 'running', cursor: { phase: 'implementation', stepKind: 'merge', attempt: 1 },
    }));

    await runOnce(deps(fx), 'run-20261011-000000');
    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    expect(run?.phase).toBe('retrospective');
    expect(mergedRows(fx).some((r) => r.type === 'pr.merged')).toBe(true);
  }, 30000);

  it('writes the implementation phase rows itself: one phase.start, one phase.end complete', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    onFeatureBranch(fx);
    writeScript(fx, [e2eRun]);
    writeGhScript(fx, [{ argvIncludes: ['pr', 'list'], stdout: [] }]); // parks on the no-PR error wait
    await writeRun(seedRun(fx, { branch: BRANCH }));

    await runOnce(deps(fx), 'run-20261011-000000');

    const rows = mergedRows(fx);
    expect(rows.filter((r) => r.type === 'phase.start' && r.phase === 'implementation')).toHaveLength(1);
    const implEnds = rows.filter((r) => r.type === 'phase.end' && r.phase === 'implementation');
    expect(implEnds).toHaveLength(1);
    expect(implEnds[0].result).toBe('complete');
    // The run routes to the retrospective once the PR is merged, never back to implementation.
    expect(rows.some((r) => r.type === 'spawn.usage' && r.role === 'end-to-end verification')).toBe(true);
  }, 30000);

  // Contract (design C3 "Wiring", R1 AC 1, AC 4-9, AC 12):
  //
  // T1 a blocked `check` kind under the cap runs one fix round and leaves the
  //    run `merging` with a `resumeAt`.
  //    Pre: run.status 'merging' (resumes straight into the merge stage), a
  //    stubbed `gh` reporting a failing commit status, a stubbed implementer
  //    that makes no commit.
  //    Test: runOnce(deps, runId).
  //    Observable: run.status, run.resumeAt, one `spawn.start` row with role
  //    'merge fix round 1', the round's start/end notes, no `error` wait.
  //    Source: design C3 Wiring ("every other kind saves status merging with
  //    resumeAt"); R1 AC 1, AC 4, AC 10.
  //
  // T2 after two rounds end, the third pass is not eligible and the `error`
  //    wait text names both rounds' endings.
  //    Pre: three sequential runOnce calls, each with a fresh failing-check
  //    evaluate; the first two spawn a no-commit implementer round.
  //    Test: runOnce(deps, runId) x3.
  //    Observable: the third pass's `error` wait text.
  //    Source: design C3 Wiring ("its text adds ... round 1 <ending>; round 2
  //    <ending>"); R1 AC 7.
  //
  // T3 a `trailer` kind opens the `error` wait with no implementer spawn.
  //    Pre: a PR blocked only by an attribution-trailer commit.
  //    Test: runOnce(deps, runId).
  //    Observable: the `error` wait opens; no `spawn.start` row is written.
  //    Source: design C3 Wiring ("When not eligible: the error wait as
  //    today"); R1 AC 8.
  //
  // T4 a "retry" re-entry after the cap is already used reads the round count
  //    from the ledger and opens the `error` wait with no spawn.
  //    Pre: the ledger already carries two `merge fix round N end:` notes for
  //    this run; the run is seeded as an answered-retry re-entry (status
  //    'running', a `merge` cursor), matching the no-PR retry test above.
  //    Test: runOnce(deps, runId).
  //    Observable: the `error` wait text names both endings; no new
  //    `spawn.start` row.
  //    Source: design C3 Wiring; R1 AC 9 ("read from this run's ledger... a
  //    'retry' does not reset it").
  //
  // T5 (regression guard, R1 AC 12 — already true at base: `runCloseoutMergeStep`,
  //    :931-966, is untouched by this task) a blocked close-out PR opens the
  //    `error` wait with no fix round, so a later change to the `blocked`
  //    switch-case cannot accidentally start wiring fix rounds into the
  //    close-out merge path too.
  //    Pre: a CLOSED retrospective plan with one pending close-out PR whose
  //    check fails.
  //    Test: runOnce(deps, runId).
  //    Observable: the `error` wait opens; no `spawn.start` row.
  //    Source: R1 AC 12; src/controller/runs.ts:931-966 unchanged.
  describe('merge fix round in the blocked case (R1 AC 1, 4-9, AC 12)', () => {
    /** A commit status failure: blocking kind `check`, no `runId` (no `gh run view` needed). */
    const statusFailing = {
      argvIncludes: ['api'],
      stdout: { state: 'failure', total_count: 1, statuses: [{ context: 'ci/legacy', state: 'failure' }] },
    };

    /** A stubbed `sdd-implementer` step that reports success but makes no commit. */
    const mergeFixNoCommit: StubRun = {
      result: {
        subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: '',
        structured_output: { logged: 'n/a', commit: 'none', checks: '', checksFile: '', green: '', flag: 'none', retro: 'none' },
        usage: {},
      },
    };

    it('T1: a blocked red check runs one round and leaves the run merging with a resumeAt', async () => {
      onFeatureBranch(fx);
      writeScript(fx, [mergeFixNoCommit]);
      writeGhScript(fx, [
        { argvIncludes: ['pr', 'view'], stdout: readyView },
        runsOk, statusFailing,
      ]);
      await writeRun(seedRun(fx, { branch: BRANCH, pr: 42, status: 'merging' }));

      await runOnce(deps(fx), 'run-20261011-000000');

      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('merging');
      expect(run?.resumeAt).toBeTruthy();

      const rows = mergedRows(fx);
      expect(rows.filter((r) => r.type === 'spawn.start' && r.role === 'merge fix round 1')).toHaveLength(1);
      expect(rows.some((r) => r.type === 'note' && r.text === 'merge fix round 1 end: no commit')).toBe(true);
      expect((await listWaits()).some((w) => w.kind === 'error' && w.run === 'run-20261011-000000')).toBe(false);
    }, 30000);

    it('a run held just before the fix-round guard pauses operator instead of spawning the round (design C3 point 3)', async () => {
      onFeatureBranch(fx);
      writeScript(fx, [mergeFixNoCommit]);
      writeGhScript(fx, [
        { argvIncludes: ['pr', 'view'], stdout: readyView },
        runsOk, statusFailing,
      ]);
      await writeRun(seedRun(fx, { branch: BRANCH, pr: 42, status: 'merging' }));
      // Unheld entering the merge stage (loop top, then the merge-stage-entry
      // check); held by the time the blocked branch reaches the fix-round guard.
      let calls = 0;
      const isPauseRequested = () => { calls += 1; return calls > 2; };

      await runOnce(deps(fx, { isPauseRequested }), 'run-20261011-000000');

      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('paused');
      expect(run?.pauseReason).toBe('operator');
      expect(run?.resumeAt).toBeUndefined();
      expect(run?.cursor).toMatchObject({ stepKind: 'merge' });
      const rows = mergedRows(fx);
      expect(rows.some((r) => r.type === 'note' && /^merge fix round \d+ (start|end):/.test(r.text ?? ''))).toBe(false);
    }, 30000);

    it('an eligible PR over the token cap opens the cap wait with the merge cursor, so a retry re-enters the merge stage', async () => {
      onFeatureBranch(fx);
      writeScript(fx, []);
      writeGhScript(fx, [
        { argvIncludes: ['pr', 'view'], stdout: readyView },
        runsOk, statusFailing,
      ]);
      await writeRun(seedRun(fx, { branch: BRANCH, pr: 42, status: 'merging' }));

      await runOnce({ ...deps(fx), tokenCap: () => 0 }, 'run-20261011-000000');

      const run = await readRun('run-20261011-000000');
      expect(run?.cursor?.stepKind).toBe('merge');
      const wait = (await listWaits()).find((w) => w.kind === 'error' && w.run === 'run-20261011-000000');
      expect(wait?.questions[0].id).toBe('cap');
      expect(mergedRows(fx).some((r) => r.type === 'spawn.start' && r.role === 'merge fix round 1')).toBe(false);
    }, 30000);

    it('T2: after two rounds end, the error wait text names both endings', async () => {
      onFeatureBranch(fx);
      writeScript(fx, [mergeFixNoCommit, mergeFixNoCommit]);
      writeGhScript(fx, [
        { argvIncludes: ['pr', 'view'], stdout: readyView }, runsOk, statusFailing, // round 1 evaluate
        { argvIncludes: ['pr', 'view'], stdout: readyView }, runsOk, statusFailing, // round 2 evaluate
        { argvIncludes: ['pr', 'view'], stdout: readyView }, runsOk, statusFailing, // round 3 evaluate: cap reached
      ]);
      await writeRun(seedRun(fx, { branch: BRANCH, pr: 42, status: 'merging' }));

      await runOnce(deps(fx), 'run-20261011-000000'); // round 1: merging
      await runOnce(deps(fx), 'run-20261011-000000'); // round 2: merging
      await runOnce(deps(fx), 'run-20261011-000000'); // round 3: cap reached, error wait

      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('waiting');
      const err = (await listWaits()).find((w) => w.kind === 'error' && w.run === 'run-20261011-000000');
      expect(err).toBeTruthy();
      const text = err!.questions[0].text;
      expect(text).toContain('2 fix round(s) ran');
      expect(text).toContain('round 1 no commit');
      expect(text).toContain('round 2 no commit');

      expect(mergedRows(fx).filter((r) => r.type === 'spawn.start' && r.agent === 'sdd-implementer')).toHaveLength(2);
    }, 30000);

    it('T3: a trailer opens the error wait with no implementer spawn', async () => {
      onFeatureBranch(fx);
      writeGhScript(fx, [
        { argvIncludes: ['pr', 'view'], stdout: {
          ...readyView,
          commits: [{
            oid: 'deadbeefcafe', messageHeadline: 'feat: do it',
            messageBody: 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>',
            committedDate: '2026-10-11T11:00:00.000Z',
          }],
        } },
        runsOk, statusOk,
      ]);
      await writeRun(seedRun(fx, { branch: BRANCH, pr: 42, status: 'merging' }));

      await runOnce(deps(fx), 'run-20261011-000000');

      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('waiting');
      const err = (await listWaits()).find((w) => w.kind === 'error' && w.run === 'run-20261011-000000');
      expect(err).toBeTruthy();
      expect(mergedRows(fx).some((r) => r.type === 'spawn.start')).toBe(false);
    }, 30000);

    it('T4: a retry re-entry after the cap reads the round count from the ledger and opens the error wait with no spawn', async () => {
      onFeatureBranch(fx);
      const seedLedger = openRunLedger({
        specDir: fx.specDir, runId: 'run-20261011-000000', spec: SPEC, now: () => new Date('2026-10-11T00:00:00.000Z'),
      });
      seedLedger.note('merge fix round 1 end: no commit');
      seedLedger.note('merge fix round 2 end: no commit');
      writeGhScript(fx, [
        { argvIncludes: ['pr', 'view'], stdout: readyView }, runsOk, statusFailing,
      ]);
      await writeRun(seedRun(fx, {
        branch: BRANCH, pr: 42, status: 'running',
        cursor: { phase: 'implementation', stepKind: 'merge', attempt: 1 },
      }));

      await runOnce(deps(fx), 'run-20261011-000000');

      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('waiting');
      const err = (await listWaits()).find((w) => w.kind === 'error' && w.run === 'run-20261011-000000');
      expect(err).toBeTruthy();
      const text = err!.questions[0].text;
      expect(text).toContain('round 1 no commit');
      expect(text).toContain('round 2 no commit');
      expect(mergedRows(fx).some((r) => r.type === 'spawn.start')).toBe(false);
    }, 30000);

    it('T5 (regression guard, R1 AC 12): a blocked close-out PR opens the error wait with no implementer spawn', async () => {
      await approve(fx, 'requirements');
      await approve(fx, 'design');
      await approve(fx, 'tasks');
      closePlan(fx);
      writeGhScript(fx, [
        { argvIncludes: ['pr', 'view'], stdout: { ...readyView, headRefName: RETRO_BRANCH } },
        runsOk, statusFailing,
      ]);
      await writeRun(seedRun(fx, { closeoutPrs: [{ repoDir: fx.repo, branch: RETRO_BRANCH, number: 7 }] }));

      await runOnce(deps(fx), 'run-20261011-000000');

      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('waiting');
      const err = (await listWaits()).find((w) => w.kind === 'error' && w.run === 'run-20261011-000000');
      expect(err).toBeTruthy();
      expect(mergedRows(fx).some((r) => r.type === 'spawn.start')).toBe(false);
    }, 30000);
  });

  // Contract (design C7; R3 AC 8-9):
  //
  // T1 a `security-open` implementation outcome maps to one `escalation` wait,
  //    question id `security`, options accept/retry/abandon, no recommendation,
  //    listing the open finding's title, file and command.
  //    Pre: a sensitive-path task already `[x]`; the ledger already carries the
  //    e2e pass and a security state that resolves to `escalate` with one open
  //    finding (design C6 Data Models note shapes), so the completion gate's
  //    security pass reaches `escalate` with no spawn.
  //    Test: runOnce(deps, runId).
  //    Observable: run.status 'waiting'; exactly one `escalation` wait for the
  //    run; its question id, options, absent `recommended`, and text.
  //    Source: design C7 ("maps `security-open`... to one `escalation` wait
  //    with one question `{ id: 'security', text, options: [...] }` and no
  //    `recommended`; `text` lists each open finding as `<title> (<file>):
  //    <command>`"); R3 AC 8.
  //
  // T2 a second pass while that wait is still open opens no second wait.
  //    Pre: same as T1.
  //    Test: runOnce(deps, runId) x2.
  //    Observable: still exactly one `escalation` wait with question id
  //    `security` for the run.
  //    Source: design C7 ("When an open escalation wait with question id
  //    `security` exists for the run, it parks the run without a second
  //    wait.").
  //
  // T3 an answered `accept` reaches the phase as a security answer (not an
  //    operator ruling): the run resumes past the security wait instead of
  //    reopening it.
  //    Pre: same as T1; the wait is answered `accept` after the first pass.
  //    Test: runOnce(deps, runId) x2 (open, then answer and resume).
  //    Observable: the ledger carries `security: answer <waitId> accept`; no
  //    second `escalation` wait with question id `security` was opened; the
  //    run proceeds to the retrospective's `retro-plan` wait.
  //    Source: design C7 ("A new `securityAnswers(runId)`... `runOnce` passes
  //    it to `runImplementationPhase`"; "`escalationRulings`... skips waits
  //    with question id `security`, so `accept` never reaches a brief as a
  //    ruling"); R3 AC 9's `accept` clause.
  describe('security escalation wait (design C7, R3 AC 8-9)', () => {
    /** The one open finding this run's completion gate already escalated on. */
    const finding = {
      title: 'Hardcoded secret', file: 'package.json',
      command: 'grep -n SECRET package.json', output: 'SECRET_KEY=abc123',
    };

    /** A sensitive-path task, already `[x]`, so the task loop spawns nothing. */
    function seedSensitiveTasks(fx: Fixture): void {
      writeFileSync(join(fx.repo, '.spec-workflow', 'agent-rules.md'), [
        '# Agent rules', '', '## Sensitive paths', '', '- package.json', '',
      ].join('\n'));
      writeFileSync(join(fx.specDir, 'tasks.md'), [
        '# Tasks Document', '',
        '- [x] 1. Touch the manifest',
        '  - File: package.json',
        '  - Purpose: do the thing.',
        '  - _Requirements: 1.1_',
        '  - _Prompt: Task: do it | Restrictions: none | Success: it works_',
        '',
      ].join('\n'));
    }

    /**
     * The ledger state the completion gate already reached: the e2e pass
     * stands, and the security loop's `recheck adjudicated` stage left one
     * finding open, so `readSecurityState` resolves straight to `escalate`
     * with no further spawn (design C6 `nextFor`).
     */
    function seedEscalatedLedger(fx: Fixture): void {
      const ledger = openRunLedger({
        specDir: fx.specDir, runId: 'run-20261011-000000', spec: SPEC,
        now: () => new Date('2026-10-11T00:00:00.000Z'),
      });
      ledger.note('e2e verification passed');
      ledger.note('security: epoch 1');
      ledger.note('security: recheck adjudicated: findings 1, suspicions 0');
      ledger.note(`security: open ${JSON.stringify([finding])}`);
    }

    it('T1: security-open opens one escalation wait, question id security, options accept/retry/abandon, no recommendation', async () => {
      await approve(fx, 'requirements');
      await approve(fx, 'design');
      seedSensitiveTasks(fx);
      seedEscalatedLedger(fx);
      await writeRun(seedRun(fx));

      await runOnce(deps(fx), 'run-20261011-000000');

      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('waiting');
      const waits = (await listWaits()).filter((w) => w.kind === 'escalation' && w.run === 'run-20261011-000000');
      expect(waits).toHaveLength(1);
      const q = waits[0].questions[0];
      expect(q.id).toBe('security');
      expect(q.options).toEqual(['accept', 'retry', 'abandon']);
      expect(q.recommended).toBeUndefined();
      expect(q.text).toContain(finding.title);
      expect(q.text).toContain(finding.file);
      expect(q.text).toContain(finding.command);
    }, 30000);

    it('T2: a second pass with the wait still open opens no second escalation wait', async () => {
      await approve(fx, 'requirements');
      await approve(fx, 'design');
      seedSensitiveTasks(fx);
      seedEscalatedLedger(fx);
      await writeRun(seedRun(fx));

      await runOnce(deps(fx), 'run-20261011-000000');
      await runOnce(deps(fx), 'run-20261011-000000');

      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('waiting');
      const waits = (await listWaits()).filter(
        (w) => w.kind === 'escalation' && w.run === 'run-20261011-000000' && w.questions.some((q) => q.id === 'security'),
      );
      expect(waits).toHaveLength(1);
    }, 30000);

    it('T3: an answered accept reaches the phase as a security answer and is absent from the rulings', async () => {
      await approve(fx, 'requirements');
      await approve(fx, 'design');
      seedSensitiveTasks(fx);
      seedEscalatedLedger(fx);
      writeScript(fx, [compileRun, analystRun]);
      await writeRun(seedRun(fx));

      await runOnce(deps(fx), 'run-20261011-000000');
      const wait = (await listWaits()).find((w) => w.kind === 'escalation' && w.run === 'run-20261011-000000');
      expect(wait).toBeTruthy();
      await answerWait(wait!.id, { security: 'accept' }, 'matthew');

      await runOnce(deps(fx), 'run-20261011-000000');

      expect(mergedRows(fx).some((r) => r.type === 'note' && r.text === `security: answer ${wait!.id} accept`)).toBe(true);
      // Reached the phase as a security answer, not an operator ruling: the
      // run resumed past the wait instead of reopening the same question.
      const secWaits = (await listWaits()).filter((w) => w.kind === 'escalation' && w.questions.some((q) => q.id === 'security'));
      expect(secWaits).toHaveLength(1);
      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('waiting');
      expect(run?.phase).toBe('retrospective');
      expect((await listWaits()).some((w) => w.kind === 'retro-plan' && w.run === 'run-20261011-000000')).toBe(true);
    }, 30000);
  });

  // Contract for `runMergeStageStep`'s own cancel check on entry (design C7
  // "Driver checks", Requirement 7 AC 5). Per success criterion: "a run
  // cancelled at the merge stage opens no wait and writes no status". Pre: a
  // run on disk at `merging` (so `resumingMerge` is true at the top of the
  // loop) on a feature branch with no open PR. Call: `runOnce(deps(fx, {
  // isCancelled }), runId)`, where `isCancelled` is a counter that reads
  // `false` on its first call (the loop-top abandoned/cancel check, which
  // must still let the resume through) and `true` on every call after (the
  // merge-stage entry check, called immediately next with no step run and no
  // other `isCancelled` read in between). Result: the run's status is left
  // at `running` (the pre-loop resume write, unaffected by the fix) with no
  // `cursor` and no wait opened — not `waiting` with a `merge` error wait, as
  // the base `findPullRequest`/`waitAnd` path produces. Expected value
  // source: design C7 "Driver checks" ("runMergeStageStep on entry") and the
  // task's own Success line; at base `runMergeStageStep`
  // (`src/controller/runs.ts`) has no cancel check before its "no PR" branch
  // saves a `merge` cursor and opens an `error` wait.
  describe('runMergeStageStep cancel entry check (design C7 "Driver checks", Requirement 7 AC 5)', () => {
    it('a run cancelled while resuming the merge stage opens no wait and writes no status', async () => {
      onFeatureBranch(fx);
      writeGhScript(fx, [{ argvIncludes: ['pr', 'list'], stdout: [] }]);
      await writeRun(seedRun(fx, { status: 'merging', branch: BRANCH, worktree: fx.repo }));
      let calls = 0;
      const isCancelled = () => { calls += 1; return calls > 1; };

      await runOnce(deps(fx, { isCancelled }), 'run-20261011-000000');

      const run = await readRun('run-20261011-000000');
      expect(run?.status).toBe('running');
      expect(run?.cursor).toBeUndefined();
      expect((await listWaits()).filter((w) => w.run === 'run-20261011-000000')).toHaveLength(0);
    }, 30000);
  });
});
