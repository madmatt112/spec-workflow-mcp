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
import { writeRun, readRun, listWaits, processStartTime, type RunRecord } from '../state.js';
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

interface StubRun { edits?: { path: string; content: string }[]; result: Record<string, unknown>; stream?: unknown[]; exitCode?: number; }

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
    claudeBin: () => STUB,
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
  it('routes to each document phase in order, then supervisor, then done', async () => {
    process.env.SDD_HOME = fx.home;
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'document', phase: 'requirements' });

    await approve(fx, 'requirements');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'document', phase: 'design' });

    await approve(fx, 'design');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'document', phase: 'tasks' });

    await approve(fx, 'tasks');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'supervisor', phase: 'implementation' });

    writeFileSync(join(fx.specDir, 'retrospective-proposals.md'), '# proposals\n');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'retro-plan' });

    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), 'Status: APPROVED\n');
    expect(await routeRun(fx.repo, SPEC)).toEqual({ kind: 'supervisor', phase: 'closeout' });

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
    statusCheckRollup: [{ __typename: 'CheckRun', name: 'build', status: 'COMPLETED', conclusion: 'SUCCESS' }],
    headRefName: BRANCH, body: 'Clean body.',
    commits: [{ oid: 'deadbeefcafe', messageHeadline: 'feat: do it', messageBody: '' }],
    author: { login: 'someone' },
  };
  const pendingView = { ...readyView, statusCheckRollup: [{ __typename: 'CheckRun', name: 'build', status: 'IN_PROGRESS', conclusion: null }] };

  /** Point stub-gh at a scripted sequence of responses. */
  function writeGhScript(fx: Fixture, runs: unknown[]): void {
    const scriptPath = join(fx.base, 'gh-script.json');
    writeFileSync(scriptPath, JSON.stringify(runs));
    process.env.CONTROLLER_GH_BIN = STUB_GH;
    process.env.STUB_GH_SCRIPT = scriptPath;
  }

  /** A supervisor stub run that completes without touching the spec store. */
  const implRun: StubRun = {
    result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'impl', usage: {} },
  };
  /** A supervisor stub run that writes the retro proposals and a DRAFT plan. */
  const retroRun: StubRun = {
    edits: [
      { path: `.spec-workflow/specs/${SPEC}/retrospective-proposals.md`, content: ['# proposals', '', '## Proposals', '- **P1 — Tidy.** Do it.', '  DECISION NEEDED: no.', ''].join('\n') },
      { path: `.spec-workflow/specs/${SPEC}/retrospective-plan.md`, content: 'Status: DRAFT\n' },
    ],
    result: { subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'retro', usage: {} },
  };

  function mergedRows(fx: Fixture): Record<string, string>[] {
    return readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8')
      .trim().split('\n').map((l) => JSON.parse(l) as Record<string, string>);
  }

  it('auto: not-ready once, then merged, then the retro step runs', async () => {
    await approve(fx, 'requirements');
    await approve(fx, 'design');
    await approve(fx, 'tasks');
    writeScript(fx, [implRun, retroRun]);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: pendingView },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'cafef00d1234' } } },
    ]);
    await writeRun(seedRun(fx, { branch: BRANCH }));

    // First pass: implementation runs, the PR is found and parked `merging`.
    await runOnce(deps(fx), 'run-20261011-000000');
    let run = await readRun('run-20261011-000000');
    expect(run?.status).toBe('merging');
    expect(run?.pr).toBe(42);

    // Second pass (the scheduler re-enters): the check is green, so it merges,
    // writes pr.merged, then runs the retro step and parks at the retro plan.
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
    writeScript(fx, [implRun, retroRun]);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
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
    writeScript(fx, [implRun]);
    writeGhScript(fx, [
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 42, headRefName: BRANCH, baseRefName: 'main', url: 'x' }] },
      { argvIncludes: ['pr', 'view'], stdout: readyView },
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
});
