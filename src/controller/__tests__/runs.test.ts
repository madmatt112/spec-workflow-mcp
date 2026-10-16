import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, existsSync, chmodSync, rmSync, readFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawn } from 'child_process';
import {
  routeRun, parseProposals, buildRetroPlanMarkdown, runOnce, cancelRun, discardRun,
  type RunDeps, type CancelDeps,
} from '../runs.js';
import { NO_OP_GATES } from '../phases/document.js';
import { writeRun, readRun, listWaits, processStartTime, isProcessAlive, type RunRecord } from '../state.js';
import { answerWait } from '../waits.js';
import { approvalsHandler } from '../../tools/approvals.js';

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
  git(repo, ['init', '-q']);
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
    pointerFile: () => join(fx.home, 'active-run'),
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
});

describe('cancelRun and discardRun', () => {
  function cancelDeps(fx: Fixture): CancelDeps {
    return { now: () => new Date(), pointerFile: () => join(fx.home, 'active-run'), ghBin: () => STUB_GH, graceMs: 2000 };
  }

  it('cancel signals the in-flight step, drops the pointer line and abandons the run', async () => {
    const child = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
    const pid = child.pid as number;
    const startTime = processStartTime(pid) ?? 0;
    const pointer = join(fx.home, 'active-run');
    writeFileSync(pointer, `${fx.repo}\t${fx.specDir}\trun-20261011-000000\n`);
    await writeRun(seedRun(fx, { inFlight: { id: 's1', pid, startTime } }));

    const run = await cancelRun(cancelDeps(fx), 'run-20261011-000000');
    expect(run?.status).toBe('abandoned');
    // The process group is gone.
    expect(() => process.kill(pid, 0)).toThrow();
    expect(existsSync(pointer)).toBe(false);
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

describe('runOnce merge stage', () => {
  const BRANCH = 'feat/x';

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

  it('auto: not-ready once, then merged, then the retro step runs', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
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

    // Second pass (the scheduler re-enters): the check is green, so it merges,
    // writes pr.merged, then runs the retrospective and parks at the retro plan.
    await runOnce(deps(fx), 'run-20261011-000000');
    run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    expect(run?.phase).toBe('retrospective');

    const merged = mergedRows(fx).find((r) => r.type === 'pr.merged');
    expect(merged).toMatchObject({ number: '42', sha: 'cafef00d1234', method: 'merge' });

    const retro = (await listWaits()).find((w) => w.kind === 'retro-plan' && w.run === 'run-20261011-000000');
    expect(retro).toBeTruthy();
  }, 30000);

  it('ask: opens a merge wait, an answer of merge proceeds to the retro', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
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

  it('failed: a failing merge writes an error wait that recommends retry (no human force-push)', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeScript(fx, [e2eRun]);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge'], stderr: 'the base branch has moved\n', exitCode: 1 },
      { argvIncludes: ['api'], stdout: [{ event: 'committed' }] }, // the force-push check: none
    ]);
    await writeRun(seedRun(fx, { branch: BRANCH }));

    await runOnce(deps(fx), 'run-20261011-000000');
    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    const err = (await listWaits()).find((w) => w.kind === 'error' && w.run === 'run-20261011-000000');
    expect(err).toBeTruthy();
    expect(err!.questions[0].text).toMatch(/the base branch has moved/);
    expect(err!.questions[0].recommended).toBe('retry');
    expect(mergedRows(fx).some((r) => r.type === 'pr.merged')).toBe(false);
  }, 30000);

  it('failed after a human force-push: the error wait halts and asks (no recommendation)', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeScript(fx, [e2eRun]);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      runsOk, statusOk,
      { argvIncludes: ['pr', 'merge'], stderr: 'the base branch has moved\n', exitCode: 1 },
      { argvIncludes: ['api'], stdout: [
        { event: 'head_ref_force_pushed', actor: { login: 'madmatt112' }, created_at: '2026-10-15T23:11:00Z' },
      ] },
    ]);
    await writeRun(seedRun(fx, { branch: BRANCH }));

    await runOnce(deps(fx), 'run-20261011-000000');
    const run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('waiting');
    const err = (await listWaits()).find((w) => w.kind === 'error' && w.run === 'run-20261011-000000');
    expect(err).toBeTruthy();
    expect(err!.questions[0].recommended).toBeUndefined(); // halts for the human
    expect(err!.questions[0].text).toMatch(/madmatt112 force-pushed the branch after the PR opened/);
    expect(mergedRows(fx).some((r) => r.type === 'pr.merged')).toBe(false);
  }, 30000);

  it('no PR after a completed implementation is an error wait, not a skip to the retro', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
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

  it('a "retry" on the no-PR error re-enters the merge stage and finds the PR', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
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
});
