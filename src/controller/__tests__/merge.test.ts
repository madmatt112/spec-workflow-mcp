import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync,
} from 'fs';
import { promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  readMergeRules, findPullRequest, evaluate, runMergeStage, branchForcePushedByHuman,
  MERGE_POLL_INTERVAL_MS, type PullRequest, type MergeRules, type MergeStageDeps,
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

describe('branchForcePushedByHuman', () => {
  let pr: PullRequest;
  beforeEach(() => { pr = { number: 42, repoDir: tmp('ctrl-merge-repo-'), branch: 'feat/thing' }; });

  it('returns the actor of the newest head_ref_force_pushed event on the timeline', async () => {
    useGhScript([{ argvIncludes: ['api'], stdout: [
      { event: 'committed' },
      { event: 'head_ref_force_pushed', actor: { login: 'madmatt112' }, created_at: '2026-10-15T23:11:00Z' },
      { event: 'labeled' },
    ] }]);
    expect(await branchForcePushedByHuman(pr)).toBe('madmatt112');
  });

  it('returns undefined when the timeline has no force-push', async () => {
    useGhScript([{ argvIncludes: ['api'], stdout: [{ event: 'committed' }, { event: 'reviewed' }] }]);
    expect(await branchForcePushedByHuman(pr)).toBeUndefined();
  });

  it('reads as none (undefined) when gh fails, never throwing', async () => {
    useGhScript([{ argvIncludes: ['api'], exitCode: 1, stderr: 'HTTP 404' }]);
    expect(await branchForcePushedByHuman(pr)).toBeUndefined();
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
