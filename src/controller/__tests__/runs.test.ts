import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, existsSync, chmodSync, rmSync, readFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawn } from 'child_process';
import {
  routeRun, parseProposals, buildRetroPlanMarkdown, runOnce, cancelRun, discardRun,
  withPrRead, listRunsForWire,
  type RunDeps, type CancelDeps,
} from '../runs.js';
import { NO_OP_GATES } from '../phases/document.js';
import { createDocumentGates } from '../phases/gates.js';
import {
  writeRun, readRun, listWaits, processStartTime, isProcessAlive, type RunRecord, type PrRead,
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

interface StubRun { edits?: { path: string; content: string }[]; appends?: { path: string; content: string }[]; result: Record<string, unknown>; stream?: unknown[]; exitCode?: number; }

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
});
