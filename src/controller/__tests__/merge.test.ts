import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync,
} from 'fs';
import { promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import {
  readMergeRules, findPullRequest, evaluate, evaluatePullRequest, runMergeStage,
  mergeByRule, closeoutMergeTarget, readCiState,
  MERGE_POLL_INTERVAL_MS, type PullRequest, type MergeRules, type MergeStageDeps, type MergeTarget,
} from '../merge.js';
import { openRunLedger } from '../ledger.js';
import { answerWait } from '../waits.js';
import { listWaits, type RunRecord } from '../state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-gh.mjs');

beforeAll(() => {
  // The stub is executed directly via its shebang; guarantee the mode.
  chmodSync(STUB, 0o755);
});

const savedEnv = { ...process.env };

beforeEach(() => {
  process.env.CONTROLLER_GH_BIN = STUB;
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(savedEnv)) {
    process.env[key] = value;
  }
});

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Write a gh stub script and point the env at it. Returns the script path. */
function useGhScript(runs: unknown[]): string {
  const scriptPath = join(tmp('ctrl-merge-gh-'), 'gh-script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.STUB_GH_SCRIPT = scriptPath;
  return scriptPath;
}

/** Every invocation's argv the stub recorded, in order. */
function recordedArgv(scriptPath: string): string[][] {
  const raw = readFileSync(`${scriptPath}.argv`, 'utf8').trim();
  return raw ? raw.split('\n').map((l) => JSON.parse(l) as string[]) : [];
}

const READY_VIEW = {
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  headRefName: 'feat/thing',
  headRefOid: 'deadbeefcafe0001',
  body: 'A clean PR body with no trailers.',
  commits: [{ oid: 'deadbeefcafe0001', messageHeadline: 'feat: do the thing', messageBody: 'Body line.', committedDate: '2026-10-11T11:00:00.000Z' }],
  author: { login: 'someone' },
};

/** The two CI reads that follow every `pr view`: workflow runs for the head sha, then commit statuses. */
function runsOf(...runs: Record<string, unknown>[]) {
  return { argvIncludes: ['api'], stdout: { total_count: runs.length, workflow_runs: runs } };
}
function statusesOf(...statuses: Record<string, unknown>[]) {
  // The combined `state` is "pending" whenever the list is empty, as GitHub returns it.
  return { argvIncludes: ['api'], stdout: { state: statuses.length ? 'success' : 'pending', total_count: statuses.length, statuses } };
}
const RUNS_OK = runsOf({ name: 'test', event: 'pull_request', status: 'completed', conclusion: 'success' });
const STATUS_OK = statusesOf();

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    v: 1,
    id: 'run-20261011-120000',
    project: 'proj-1',
    codeRoot: tmp('ctrl-merge-repo-'),
    specStore: '/store',
    spec: 's',
    worktree: '/wt',
    branch: 'feat/thing',
    pr: 42,
    status: 'running',
    created: '2026-10-11T12:00:00.000Z',
    updated: '2026-10-11T12:00:00.000Z',
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    ...overrides,
  };
}

function makeDeps(overrides: Partial<MergeStageDeps> = {}): MergeStageDeps {
  const specDir = tmp('ctrl-merge-spec-');
  return {
    rules: { method: 'merge', postMerge: null, merge: 'auto' },
    specDir,
    stepLogDir: tmp('ctrl-merge-steps-'),
    ledger: openRunLedger({ specDir, runId: 'run-20261011-120000', spec: 's' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe('readMergeRules', () => {
  it('reads merge-method, post-merge and merge from the file', async () => {
    const root = tmp('ctrl-merge-rules-');
    await fsp.writeFile(
      join(root, 'agent-rules.md'),
      ['worktree-per-change: required', 'merge-method: squash', 'post-merge: `npm run deploy`', 'merge: ask', ''].join('\n'),
    );
    const rules = readMergeRules(root);
    expect(rules).toEqual({ method: 'squash', postMerge: 'npm run deploy', merge: 'ask' });
  });

  it('defaults to merge / null / auto when the keys (or file) are absent', async () => {
    const root = tmp('ctrl-merge-rules-');
    // No file at all.
    expect(readMergeRules(root)).toEqual({ method: 'merge', postMerge: null, merge: 'auto' });
    // A file without any merge key.
    await fsp.writeFile(join(root, 'agent-rules.md'), 'worktree-per-change: required\n');
    expect(readMergeRules(root)).toEqual({ method: 'merge', postMerge: null, merge: 'auto' });
  });
});

describe('findPullRequest', () => {
  let repo: string;
  beforeEach(() => { repo = tmp('ctrl-merge-repo-'); });

  it('trusts a recorded PR number without a gh call', async () => {
    const script = useGhScript([]);
    const pr = await findPullRequest({ repoDir: repo, branch: 'feat/thing', number: 7 });
    expect(pr).toEqual({ number: 7, repoDir: repo, branch: 'feat/thing' });
    expect(existsSync(`${script}.argv`)).toBe(false); // gh never ran
  });

  it('reads the open PR for a branch from gh pr list', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'list'], stdout: [{ number: 99, headRefName: 'feat/thing', baseRefName: 'main', url: 'https://x/99' }] },
    ]);
    const pr = await findPullRequest({ repoDir: repo, branch: 'feat/thing' });
    expect(pr).toEqual({ number: 99, repoDir: repo, branch: 'feat/thing', url: 'https://x/99' });
  });

  it('returns undefined when there is no open PR', async () => {
    useGhScript([{ argvIncludes: ['pr', 'list'], stdout: [] }]);
    expect(await findPullRequest({ repoDir: repo, branch: 'feat/none' })).toBeUndefined();
  });
});

describe('evaluate', () => {
  let pr: PullRequest;
  beforeEach(() => { pr = { number: 42, repoDir: tmp('ctrl-merge-repo-'), branch: 'feat/thing' }; });

  it('is ready when the workflow runs are green (incl. skipped) and statuses success, mergeable, clean and the head matches', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf(
        { name: 'test', status: 'completed', conclusion: 'success' },
        { name: 'lint', status: 'completed', conclusion: 'skipped' },
      ),
      statusesOf({ context: 'ci/legacy', state: 'success' }),
    ]);
    const result = await evaluate(pr);
    expect(result).toEqual({ ready: true, reasons: [] });
  });

  it('is not ready while a workflow run is still running', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf({ name: 'build', status: 'in_progress', conclusion: null }),
      STATUS_OK,
    ]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.pending).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/workflow build is still running/);
  });

  it('is pending, not settled, while GitHub has not computed mergeability', async () => {
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, mergeable: 'UNKNOWN' } }, RUNS_OK, STATUS_OK]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.pending).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/mergeability not yet computed/);
  });

  it('is settled (not pending) when the PR has a conflict', async () => {
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, mergeable: 'CONFLICTING' } }, RUNS_OK, STATUS_OK]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.pending).toBeUndefined();
    expect(result.reasons.join(' ')).toMatch(/not mergeable \(mergeable=CONFLICTING\)/);
  });

  it('is not ready when a workflow run failed or a status is pending', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf({ name: 'build', status: 'completed', conclusion: 'failure' }),
      statusesOf({ context: 'ci/legacy', state: 'pending' }),
    ]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/workflow build did not pass/);
    expect(result.reasons.join(' ')).toMatch(/status ci\/legacy is still pending/);
  });

  it('is pending while a fresh head has no workflow run yet in a checkout with workflow files', async () => {
    mkdirSync(join(pr.repoDir, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(pr.repoDir, '.github', 'workflows', 'test.yml'), 'name: test\n');
    const justNow = new Date(Date.now() - 60_000).toISOString();
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, commits: [{ ...READY_VIEW.commits[0], committedDate: justNow }] } },
      runsOf(),
      statusesOf(),
    ]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/no workflow run yet for deadbee/);
  });

  it('is pending while a fresh PR on an old head has no workflow run yet', async () => {
    mkdirSync(join(pr.repoDir, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(pr.repoDir, '.github', 'workflows', 'test.yml'), 'name: test\n');
    const justNow = new Date(Date.now() - 60_000).toISOString();
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, createdAt: justNow } },
      runsOf(),
      statusesOf(),
    ]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/no workflow run yet for deadbee/);
  });

  it('reads a just-pushed old head with no workflow run as pending, not green', async () => {
    mkdirSync(join(pr.repoDir, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(pr.repoDir, '.github', 'workflows', 'test.yml'), 'name: test\n');
    useGhScript([runsOf(), statusesOf(), runsOf(), statusesOf()]);
    expect((await readCiState(pr.repoDir, 'deadbeefcafe0001', undefined, Date.now() - 60_000)).state).toBe('pending');
    expect((await readCiState(pr.repoDir, 'deadbeefcafe0001')).state).toBe('green');
  });

  it('is ready with no runs and no statuses when the checkout has no workflow files', async () => {
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf(), statusesOf()]);
    const result = await evaluate(pr);
    expect(result).toEqual({ ready: true, reasons: [] });
  });

  it('is unreadable when the workflow runs cannot be read', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      { argvIncludes: ['api'], exitCode: 1, stderr: 'HTTP 403: Resource not accessible by personal access token' },
    ]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.unreadable).toBe(true);
    expect(result.reasons.join(' ')).toMatch(/could not read the workflow runs of deadbee.*403/);
  });

  it('is not ready when a commit message carries an attribution trailer', async () => {
    useGhScript([{ stdout: {
      ...READY_VIEW,
      commits: [{ oid: 'abcdef1234', messageHeadline: 'feat: x', messageBody: 'Co-authored-by: Claude <noreply@anthropic.com>' }],
    } }, RUNS_OK, STATUS_OK]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.pending).toBeUndefined(); // settled: nothing in flight will fix it
    expect(result.reasons.join(' ')).toMatch(/commit abcdef1 carries a Claude attribution trailer/);
  });

  it('is not ready when the PR body carries an attribution trailer', async () => {
    useGhScript([{ stdout: { ...READY_VIEW, body: 'Summary.\n\n🤖 Generated with [Claude Code](https://claude.com)' } }, RUNS_OK, STATUS_OK]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/PR body carries a Claude attribution trailer/);
  });

  it('is not ready when the head branch is not the run\'s branch', async () => {
    useGhScript([{ stdout: { ...READY_VIEW, headRefName: 'feat/other' } }, RUNS_OK, STATUS_OK]);
    const result = await evaluate(pr);
    expect(result.ready).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/head branch is feat\/other, expected feat\/thing/);
  });
});

describe('evaluatePullRequest', () => {
  // Contract per test: pre-condition (gh stub script) -> call evaluatePullRequest(pr, now)
  // -> observable result (ci / mergeable / url / evaluation) -> expected value source
  // (requirement 1 AC3, AC4; design C1 post-conditions, src/controller/merge.ts:390-430
  // readCiState's rule, applied here from the reads evaluate already makes).
  let pr: PullRequest;
  beforeEach(() => { pr = { number: 42, repoDir: tmp('ctrl-merge-repo-'), branch: 'feat/thing' }; });

  it('is ci green when every workflow run and status is passing (AC3)', async () => {
    // Pre: view ready/mergeable, one successful run, no failing/pending statuses.
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: READY_VIEW }, RUNS_OK, STATUS_OK]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('green');
    expect(result.mergeable).toBe('MERGEABLE');
  });

  it('is ci pending while a workflow run is still in progress (AC3)', async () => {
    // Pre: one run status=in_progress (classifyWorkflowRun -> pending), no statuses.
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf({ name: 'build', status: 'in_progress', conclusion: null }),
      STATUS_OK,
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('pending');
  });

  it('is ci pending for a fresh head with no workflow run yet (AC3)', async () => {
    // Pre: checkout has workflow files, head committed under FRESH_HEAD_MS ago, no runs/statuses.
    mkdirSync(join(pr.repoDir, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(pr.repoDir, '.github', 'workflows', 'test.yml'), 'name: test\n');
    const justNow = new Date(Date.now() - 60_000).toISOString();
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, commits: [{ ...READY_VIEW.commits[0], committedDate: justNow }] } },
      runsOf(),
      statusesOf(),
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('pending');
  });

  it('is ci red when a workflow run failed (AC3)', async () => {
    // Pre: one run conclusion=failure (classifyWorkflowRun -> failed).
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf({ name: 'build', status: 'completed', conclusion: 'failure' }),
      STATUS_OK,
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('red');
  });

  it('is ci unreadable and mergeable absent when gh pr view fails (AC3, AC4)', async () => {
    // Pre: the view call itself fails (exit 1), so no JSON ever parses.
    useGhScript([{ argvIncludes: ['pr', 'view'], exitCode: 1, stderr: 'boom' }]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('unreadable');
    expect(result.mergeable).toBeUndefined();
  });

  it('is ci unreadable and mergeable absent when gh pr view returns unparsable output (AC3, AC4)', async () => {
    // Pre: the view call exits 0 but its stdout is not JSON.
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: 'not json {' }]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('unreadable');
    expect(result.mergeable).toBeUndefined();
  });

  it('is ci unreadable with mergeable present when the view has no headRefOid (AC3, AC4)', async () => {
    // Pre: the view JSON parses but headRefOid is empty; mergeable is read before that check.
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, headRefOid: '' } }]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('unreadable');
    expect(result.mergeable).toBe('MERGEABLE');
  });

  it('is ci unreadable with mergeable present when the workflow runs cannot be read (AC3, AC4)', async () => {
    // Pre: the view parses (mergeable known), then the runs read fails.
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      { argvIncludes: ['api'], exitCode: 1, stderr: 'HTTP 403: Resource not accessible by personal access token' },
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('unreadable');
    expect(result.mergeable).toBe('MERGEABLE');
  });

  it('is ci unreadable with mergeable present when the commit statuses cannot be read (AC3, AC4)', async () => {
    // Pre: the view and runs read succeed, then the status read fails.
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      RUNS_OK,
      { argvIncludes: ['api'], exitCode: 1, stderr: 'HTTP 403: Resource not accessible by personal access token' },
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('unreadable');
    expect(result.mergeable).toBe('MERGEABLE');
  });

  it('is ci green with evaluation.pending true when mergeable is UNKNOWN (AC3)', async () => {
    // Pre: mergeable=UNKNOWN sets the evaluation pending but not ciPending (design C1 post-conditions).
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, mergeable: 'UNKNOWN' } }, RUNS_OK, STATUS_OK]);
    const result = await evaluatePullRequest(pr);
    expect(result.ci).toBe('green');
    expect(result.mergeable).toBe('UNKNOWN');
    expect(result.evaluation.pending).toBe(true);
  });

  it('reads url from the view data when pr.url is unset (design C1 post-conditions)', async () => {
    // Pre: pr.url is unset; the view's data carries url.
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, url: 'https://github.com/x/pull/42' } }, RUNS_OK, STATUS_OK]);
    const result = await evaluatePullRequest(pr);
    expect(result.url).toBe('https://github.com/x/pull/42');
  });
});

describe('evaluatePullRequest blocking kinds (design C1, R1 AC 1, AC 11)', () => {
  // Contract per test: pre-condition (gh stub view/runs/statuses) -> call
  // evaluatePullRequest(pr) -> observable result (evaluation.blocking,
  // .head, .base) -> expected value source (design C1 post-conditions:
  // "a failed workflow run gives check with name and runId ... a head
  // branch mismatch gives head; an attribution trailer gives trailer").
  let pr: PullRequest;
  beforeEach(() => { pr = { number: 42, repoDir: tmp('ctrl-merge-repo-'), branch: 'feat/thing' }; });

  it('tags a failed workflow run as check with its name and numeric runId', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf({ name: 'build', status: 'completed', conclusion: 'failure', id: 555 }),
      STATUS_OK,
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.evaluation.blocking).toEqual([
      { kind: 'check', text: 'workflow build did not pass', check: { name: 'build', runId: 555 } },
    ]);
  });

  it('tags a failed commit status as check with its name and no runId', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      RUNS_OK,
      statusesOf({ context: 'ci/legacy', state: 'failure' }),
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.evaluation.blocking).toEqual([
      { kind: 'check', text: 'status ci/legacy did not pass', check: { name: 'ci/legacy' } },
    ]);
    expect(result.evaluation.blocking![0].check!.runId).toBeUndefined();
  });

  it('tags a merge conflict as conflict', async () => {
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, mergeable: 'CONFLICTING' } }, RUNS_OK, STATUS_OK]);
    const result = await evaluatePullRequest(pr);
    expect(result.evaluation.blocking).toEqual([
      { kind: 'conflict', text: 'not mergeable (mergeable=CONFLICTING)' },
    ]);
  });

  it('tags any other non-MERGEABLE, non-UNKNOWN mergeable value as other', async () => {
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, mergeable: 'DIRTY' } }, RUNS_OK, STATUS_OK]);
    const result = await evaluatePullRequest(pr);
    expect(result.evaluation.blocking).toEqual([
      { kind: 'other', text: 'not mergeable (mergeable=DIRTY)' },
    ]);
  });

  it('tags a head branch mismatch as head', async () => {
    useGhScript([{ argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, headRefName: 'feat/other' } }, RUNS_OK, STATUS_OK]);
    const result = await evaluatePullRequest(pr);
    expect(result.evaluation.blocking).toEqual([
      { kind: 'head', text: 'head branch is feat/other, expected feat/thing' },
    ]);
  });

  it('tags a PR body attribution trailer as trailer', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, body: 'Summary.\n\n🤖 Generated with [Claude Code](https://claude.com)' } },
      RUNS_OK, STATUS_OK,
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.evaluation.blocking).toEqual([
      { kind: 'trailer', text: 'the PR body carries a Claude attribution trailer' },
    ]);
  });

  it('gives a pending-only result no blocking entries', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf({ name: 'build', status: 'in_progress', conclusion: null }),
      STATUS_OK,
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.evaluation.pending).toBe(true);
    expect(result.evaluation.blocking).toBeUndefined();
  });

  it('reads head and base from the view\'s headRefOid and baseRefName', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, baseRefName: 'main' } },
      RUNS_OK, STATUS_OK,
    ]);
    const result = await evaluatePullRequest(pr);
    expect(result.head).toBe('deadbeefcafe0001');
    expect(result.base).toBe('main');
  });
});

describe('runMergeStage', () => {
  let home: string;
  beforeEach(async () => {
    home = await fsp.mkdtemp(join(tmpdir(), 'ctrl-merge-home-'));
    process.env.SDD_HOME = home;
  });
  afterEach(async () => {
    await fsp.rm(home, { recursive: true, force: true });
  });

  it('exports a suggested poll interval', () => {
    expect(MERGE_POLL_INTERVAL_MS).toBeGreaterThan(0);
  });

  it('auto: merges, runs the post-merge command and writes pr.merged', async () => {
    const script = useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      RUNS_OK, STATUS_OK,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'f00dc0ffee1234567890' } } },
    ]);
    const run = makeRun();
    const deps = makeDeps({
      rules: { method: 'merge', postMerge: 'echo post-merge-ok && echo written > post-marker.txt', merge: 'auto' },
    });

    const result = await runMergeStage(run, deps);

    expect(result.status).toBe('merged');
    expect(result.number).toBe(42);
    expect(result.sha).toBe('f00dc0ffee1234567890');

    // The post-merge command ran in the code root and its output was logged.
    expect(existsSync(join(run.codeRoot, 'post-marker.txt'))).toBe(true);
    const logged = readFileSync(join(deps.stepLogDir, 'post-merge.log'), 'utf8');
    expect(logged).toContain('post-merge-ok');

    // The pr.merged ledger row carries number, sha and method.
    const rows = readFileSync(join(deps.specDir, 'harness-events.jsonl'), 'utf8')
      .trim().split('\n').map((l) => JSON.parse(l));
    const merged = rows.find((r) => r.type === 'pr.merged');
    expect(merged).toMatchObject({ number: '42', sha: 'f00dc0ffee1234567890', method: 'merge' });

    // The merge used --merge and never deleted the branch.
    const argv = recordedArgv(script);
    const mergeCall = argv.find((a) => a.includes('merge') && a.includes('--merge'));
    expect(mergeCall).toBeDefined();
    expect(mergeCall!.some((a) => a === '--delete-branch')).toBe(false);
  });

  it('not-ready when a check is still pending, without merging', async () => {
    const script = useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf({ name: 'build', status: 'queued', conclusion: null }),
      STATUS_OK,
    ]);
    const result = await runMergeStage(makeRun(), makeDeps());
    expect(result.status).toBe('not-ready');
    expect(result.reasons.join(' ')).toMatch(/still running/);
    // Only the evaluate reads ran (view, runs, statuses); no merge.
    expect(recordedArgv(script)).toHaveLength(3);
  });

  it('blocked when the PR fails the rule and nothing is in flight, without merging', async () => {
    const script = useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: {
        ...READY_VIEW,
        commits: [{ oid: 'abcdef1234', messageHeadline: 'test(s): task 1 red', messageBody: 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>' }],
      } },
      RUNS_OK, STATUS_OK,
    ]);
    const result = await runMergeStage(makeRun(), makeDeps());
    expect(result.status).toBe('blocked');
    expect(result.number).toBe(42);
    expect(result.reasons.join(' ')).toMatch(/commit abcdef1 carries a Claude attribution trailer/);
    expect(recordedArgv(script)).toHaveLength(3); // no merge attempted
  });

  it('blocked result carries the structured blocking reason and the base branch (design C1)', async () => {
    // Pre: an attribution trailer (kind trailer) and a baseRefName on the view.
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: {
        ...READY_VIEW,
        baseRefName: 'main',
        commits: [{ oid: 'abcdef1234', messageHeadline: 'test(s): task 1 red', messageBody: 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>' }],
      } },
      RUNS_OK, STATUS_OK,
    ]);
    const result = await runMergeStage(makeRun(), makeDeps());
    expect(result.status).toBe('blocked');
    expect(result.blocking).toEqual([
      { kind: 'trailer', text: 'commit abcdef1 carries a Claude attribution trailer' },
    ]);
    expect(result.base).toBe('main');
  });

  it('unreadable when gh pr view fails, without merging (a token that cannot read checks)', async () => {
    const script = useGhScript([
      { argvIncludes: ['pr', 'view'], exitCode: 1, stderr: 'GraphQL: Resource not accessible by personal access token (statusCheckRollup)' },
    ]);
    const result = await runMergeStage(makeRun(), makeDeps());
    expect(result.status).toBe('unreadable');
    expect(result.number).toBe(42);
    expect(result.reasons.join(' ')).toMatch(/gh pr view #42 failed \(exit 1\).*Resource not accessible/);
    expect(recordedArgv(script)).toHaveLength(1); // no merge attempted
  });

  it('ask: opens one wait, re-entry reuses it, an answer of merge then merges', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW }, // re-entry 1 evaluate
      RUNS_OK, STATUS_OK,
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW }, // re-entry 2 evaluate
      RUNS_OK, STATUS_OK,
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW }, // re-entry 3 evaluate
      RUNS_OK, STATUS_OK,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'aa11bb22' } } },
    ]);
    const run = makeRun();
    const deps = makeDeps({ rules: { method: 'merge', postMerge: null, merge: 'ask' } });

    const first = await runMergeStage(run, deps);
    expect(first.status).toBe('waiting');
    expect(first.waitId).toBeDefined();

    const second = await runMergeStage(run, deps);
    expect(second.status).toBe('waiting');
    expect(second.waitId).toBe(first.waitId); // the same wait, not a new one

    const mergeWaits = (await listWaits()).filter((w) => w.kind === 'merge');
    expect(mergeWaits).toHaveLength(1);

    await answerWait(first.waitId!, { merge: 'merge' }, 'operator');
    const third = await runMergeStage(run, deps);
    expect(third.status).toBe('merged');
    expect(third.sha).toBe('aa11bb22');

    // Still only one merge wait was ever created.
    expect((await listWaits()).filter((w) => w.kind === 'merge')).toHaveLength(1);
  });

  it('ask: an answer of hold keeps the stage waiting', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      RUNS_OK, STATUS_OK,
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      RUNS_OK, STATUS_OK,
    ]);
    const run = makeRun();
    const deps = makeDeps({ rules: { method: 'merge', postMerge: null, merge: 'ask' } });

    const first = await runMergeStage(run, deps);
    await answerWait(first.waitId!, { merge: 'hold' }, 'operator');
    const second = await runMergeStage(run, deps);
    expect(second.status).toBe('waiting');
    expect(second.reasons.join(' ')).toMatch(/held/);
  });

  it('failed: a failing gh pr merge returns failed with the output tail', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      RUNS_OK, STATUS_OK,
      { argvIncludes: ['pr', 'merge'], stderr: 'failed to merge: the base branch has moved\n', exitCode: 1 },
    ]);
    const result = await runMergeStage(makeRun(), makeDeps());
    expect(result.status).toBe('failed');
    expect(result.reasons.join('\n')).toMatch(/the base branch has moved/);
    expect(result.number).toBe(42);
  });
});

describe('PR read on every merge-stage result', () => {
  // Contract per test: pre-condition (gh stub script / target) -> call runMergeStage(run,
  // deps) or mergeByRule(target, deps) -> observable `.read` on the returned
  // MergeStageResult -> expected value source (requirement 1 AC1, AC2; design C1
  // post-conditions, src/controller/merge.ts:526-586 mergeByRule, :457-460 closeoutMergeTarget).
  beforeEach(async () => {
    process.env.SDD_HOME = await fsp.mkdtemp(join(tmpdir(), 'ctrl-merge-read-home-'));
  });

  it('merged: read.verdict equals status, reasons is the same array, kind is run, repo is the basename, and sha/at are set (AC1, AC2)', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      RUNS_OK, STATUS_OK,
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'f00dc0ffee1234567890' } } },
    ]);
    const run = makeRun();
    const now = () => new Date('2026-10-19T08:00:00.000Z');
    const result = await runMergeStage(run, makeDeps({ now }));

    expect(result.status).toBe('merged');
    expect(result.read).toBeDefined();
    expect(result.read!.verdict).toBe(result.status);
    expect(result.read!.reasons).toBe(result.reasons);
    expect(result.read!.kind).toBe('run');
    expect(result.read!.repo).toBe(basename(run.codeRoot));
    expect(result.read!.sha).toBe(result.sha);
    expect(result.read!.at).toBe(now().toISOString());
  });

  it('not-ready: read.verdict equals status, reasons is the same array, kind is run, repo is the basename (AC1, AC2)', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf({ name: 'build', status: 'queued', conclusion: null }),
      STATUS_OK,
    ]);
    const run = makeRun();
    const result = await runMergeStage(run, makeDeps());

    expect(result.status).toBe('not-ready');
    expect(result.read!.verdict).toBe(result.status);
    expect(result.read!.reasons).toBe(result.reasons);
    expect(result.read!.kind).toBe('run');
    expect(result.read!.repo).toBe(basename(run.codeRoot));
  });

  it('blocked: read.verdict equals status, reasons is the same array, kind is run, repo is the basename (AC1, AC2)', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: {
        ...READY_VIEW,
        commits: [{ oid: 'abcdef1234', messageHeadline: 'test(s): task 1 red', messageBody: 'Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>' }],
      } },
      RUNS_OK, STATUS_OK,
    ]);
    const run = makeRun();
    const result = await runMergeStage(run, makeDeps());

    expect(result.status).toBe('blocked');
    expect(result.read!.verdict).toBe(result.status);
    expect(result.read!.reasons).toBe(result.reasons);
    expect(result.read!.kind).toBe('run');
    expect(result.read!.repo).toBe(basename(run.codeRoot));
  });

  it('unreadable: read.verdict equals status, reasons is the same array, ci is unreadable and mergeable absent (AC1, AC2, carrying AC3/AC4)', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], exitCode: 1, stderr: 'GraphQL: Resource not accessible by personal access token (statusCheckRollup)' },
    ]);
    const run = makeRun();
    const result = await runMergeStage(run, makeDeps());

    expect(result.status).toBe('unreadable');
    expect(result.read!.verdict).toBe(result.status);
    expect(result.read!.reasons).toBe(result.reasons);
    expect(result.read!.kind).toBe('run');
    expect(result.read!.ci).toBe('unreadable');
    expect(result.read!.mergeable).toBeUndefined();
  });

  it('drops a non-https view url from the read (NFR Security)', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, url: 'http://insecure.example/pull/42' } },
      runsOf({ name: 'build', status: 'in_progress', conclusion: null }),
      STATUS_OK,
    ]);
    const pr: PullRequest = { number: 42, repoDir: tmp('ctrl-merge-repo-'), branch: 'feat/thing' };
    const target: MergeTarget = { pr, runId: 'run-x', projectId: 'proj-1', spec: 's', questionId: 'merge', label: 'PR #42' };
    const result = await mergeByRule(target, makeDeps());

    expect(result.read!.url).toBeUndefined();
  });

  it('keeps an https view url in the read (NFR Security)', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: { ...READY_VIEW, url: 'https://github.com/x/pull/42' } },
      runsOf({ name: 'build', status: 'in_progress', conclusion: null }),
      STATUS_OK,
    ]);
    const pr: PullRequest = { number: 42, repoDir: tmp('ctrl-merge-repo-'), branch: 'feat/thing' };
    const target: MergeTarget = { pr, runId: 'run-x', projectId: 'proj-1', spec: 's', questionId: 'merge', label: 'PR #42' };
    const result = await mergeByRule(target, makeDeps());

    expect(result.read!.url).toBe('https://github.com/x/pull/42');
  });

  it('mergeByRule with a closeoutMergeTarget target gives kind closeout, repo the basename (design D-closeout, AC1/AC2 carried)', async () => {
    useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: READY_VIEW },
      runsOf({ name: 'build', status: 'in_progress', conclusion: null }),
      STATUS_OK,
    ]);
    const repoDir = tmp('ctrl-merge-repo-');
    const pr: PullRequest = { number: 7, repoDir, branch: 'feat/thing' };
    const run = makeRun();
    const target = closeoutMergeTarget(run, pr);
    const result = await mergeByRule(target, makeDeps());

    expect(result.read!.kind).toBe('closeout');
    expect(result.read!.repo).toBe(basename(repoDir));
  });

  it('runMergeStage with no open PR has no read (regression guard; holds at base)', async () => {
    useGhScript([{ argvIncludes: ['pr', 'list'], stdout: [] }]);
    const run = makeRun({ pr: undefined, branch: 'feat/none' });
    const result = await runMergeStage(run, makeDeps());

    expect(result.status).toBe('not-ready');
    expect(result.read).toBeUndefined();
  });
});
