// src/controller/merge.ts
//
// T7 of the controller (docs/controller-tasks.md "T7 `merge`", design §10,
// docs/adr/0003-merge-by-rule.md). The merge rule: after the implementation
// phase reports complete, the controller (never a model) reads the PR, decides
// by a fixed rule whether it is ready, and either merges it or opens a `merge`
// wait for the operator. No model runs in this code path.
//
// `gh` is the only external process. Its binary name comes from
// `CONTROLLER_GH_BIN` (default `gh`), which is how the tests swap in
// `scripts/stub-gh.mjs`. The merge rules come from one parser: `readAgentRules`
// in `run-setup.ts` owns `agent-rules.md`; `readMergeRules` picks the three
// merge keys from it.
import { execFile, execFileSync } from 'child_process';
import { appendFileSync, mkdirSync, readdirSync } from 'fs';
import { basename, join } from 'path';
import { scrubbedGitEnv } from '../core/git-utils.js';
import { readAgentRules } from '../dashboard/harness/run-setup.js';
import { createWait, type ControllerWaitRecord } from './waits.js';
import { listWaits, type RunRecord } from './state.js';
import type { RunLedger } from './ledger.js';

/** The suggested interval between `runMergeStage` polls while `not-ready`. */
export const MERGE_POLL_INTERVAL_MS = 30_000;

/** The question id of the run's own PR's `merge` wait; a close-out PR's is `merge:<repo>#<n>`. */
const MERGE_QUESTION_ID = 'merge';

/** The post-merge command's wall-clock budget (design §10: ten minutes). */
const POST_MERGE_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The `gh pr view` fields the readiness rule reads. CI is not among them: a
 * fine-grained token cannot read `statusCheckRollup` on a private repository
 * (the Checks permission is not offered to personal access tokens), so the
 * rule reads workflow runs and commit statuses for the head sha instead.
 */
const PR_VIEW_FIELDS =
  'mergeable,mergeStateStatus,headRefName,headRefOid,body,commits,author';

/**
 * A head commit younger than this with no workflow run yet is read as pending,
 * not as "no CI": a run takes a few seconds to appear after a push.
 */
const FRESH_HEAD_MS = 5 * 60 * 1000;

/** The binary name, overridable so tests swap in `scripts/stub-gh.mjs`. */
function ghBin(): string {
  return process.env.CONTROLLER_GH_BIN || 'gh';
}

// ---------------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------------

/** The three merge keys of `agent-rules.md` (design §10). */
export interface MergeRules {
  /** `gh pr merge --<method>`. */
  method: 'merge' | 'squash';
  /** The command run after a successful merge, else null. */
  postMerge: string | null;
  /** Merge by rule (`auto`) or ask the operator first (`ask`). */
  merge: 'auto' | 'ask';
}

/** A pull request located for a run, carrying what `evaluate` and `merge` need. */
export interface PullRequest {
  number: number;
  /** The code repo where `gh` runs. */
  repoDir: string;
  /** The run's branch; the PR head must equal this (design §10). */
  branch: string;
  url?: string;
}

/** The readiness verdict and the reasons it is (not) ready. */
export interface MergeEvaluation {
  ready: boolean;
  reasons: string[];
  /**
   * Something is still in flight: a workflow run or a commit status pending, a
   * head too fresh for its run to show, or mergeability not yet computed. A
   * later poll may read differently. Not ready and not pending means nothing
   * changes by itself; a caller must not poll on it.
   */
  pending?: boolean;
  /**
   * The PR's state could not be read at all (`gh pr view` failed or returned
   * no JSON), as opposed to read and found not ready. A caller must not poll
   * on this: nothing changes until the operator fixes the token or the PR.
   */
  unreadable?: boolean;
}

export type MergeStageStatus = 'merged' | 'waiting' | 'not-ready' | 'blocked' | 'unreadable' | 'failed';

/** What one run of the merge stage tells the caller (T6/T10). */
export interface MergeStageResult {
  status: MergeStageStatus;
  reasons: string[];
  /** The PR number, once found. */
  number?: number;
  /** The merge commit sha, when merged. */
  sha?: string;
  /** The open `merge` wait's id, when `waiting` for an `ask`. */
  waitId?: string;
}

/** Everything `runMergeStage` needs besides the run record. */
export interface MergeStageDeps {
  /** The project's merge rules (see {@link readMergeRules}). */
  rules: MergeRules;
  /** The spec dir, for the `merge` wait's receipt and `note` row. */
  specDir: string;
  /** The run's step log dir; the post-merge command's output is appended here. */
  stepLogDir: string;
  /** The run ledger; `pr.merged` is written through it. */
  ledger: Pick<RunLedger, 'prMerged'>;
  /** Clock seam for tests; defaults to the wall clock. */
  now?: () => Date;
}

// ---------------------------------------------------------------------------
// Rules.
// ---------------------------------------------------------------------------

/**
 * The three merge keys from `agent-rules.md`, via the one parser that owns the
 * file (`readAgentRules`). A missing file gives `merge`, null and `auto`.
 */
export function readMergeRules(workflowRoot: string): MergeRules {
  const rules = readAgentRules(workflowRoot);
  return { method: rules.mergeMethod, postMerge: rules.postMerge, merge: rules.merge };
}

// ---------------------------------------------------------------------------
// Running `gh` and the post-merge command.
// ---------------------------------------------------------------------------

interface CommandResult {
  /** The exit code, or null for a spawn error or a timeout kill. */
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function runCommand(
  bin: string,
  args: string[],
  opts: { cwd: string; timeoutMs?: number },
): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      { cwd: opts.cwd, timeout: opts.timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const e = err as (NodeJS.ErrnoException & { killed?: boolean }) | null;
        const code = e && typeof e.code === 'number' ? e.code : e ? null : 0;
        resolve({
          code,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          timedOut: !!e && e.killed === true,
        });
      },
    );
  });
}

/** The last `lines` non-empty lines of some command output. */
function tail(text: string, lines: number): string {
  const kept = text.replace(/\s+$/, '').split('\n');
  return kept.slice(-lines).join('\n');
}

// ---------------------------------------------------------------------------
// Finding the PR.
// ---------------------------------------------------------------------------

/**
 * The open PR for a branch, or the one whose number the run already recorded.
 * With `number` set, it is trusted without a `gh` call; otherwise `gh pr list
 * --head <branch> --state open` is read and its first row returned. `undefined`
 * when there is no open PR.
 */
export async function findPullRequest(opts: {
  repoDir: string;
  branch: string;
  number?: number;
}): Promise<PullRequest | undefined> {
  const { repoDir, branch, number } = opts;
  if (typeof number === 'number') {
    return { number, repoDir, branch };
  }
  const res = await runCommand(
    ghBin(),
    ['pr', 'list', '--head', branch, '--state', 'open', '--json', 'number,headRefName,baseRefName,url'],
    { cwd: repoDir },
  );
  if (res.code !== 0) return undefined;
  let list: unknown;
  try {
    list = JSON.parse(res.stdout);
  } catch {
    return undefined;
  }
  if (!Array.isArray(list) || list.length === 0) return undefined;
  const first = list[0] as { number?: unknown; url?: unknown };
  return {
    number: Number(first.number),
    repoDir,
    branch,
    url: typeof first.url === 'string' ? first.url : undefined,
  };
}

// ---------------------------------------------------------------------------
// Readiness.
// ---------------------------------------------------------------------------

const ATTRIBUTION_PATTERNS: RegExp[] = [
  /Co-Authored-By:\s*Claude/i,
  /Generated with \[Claude Code\]/i,
  /Claude-Session:/i,
];

function hasAttribution(text: string): boolean {
  return ATTRIBUTION_PATTERNS.some((re) => re.test(text));
}

type CheckState = 'success' | 'pending' | 'failed';

/** Classify one GitHub Actions workflow run for the head sha. */
function classifyWorkflowRun(r: Record<string, unknown>): CheckState {
  const status = String(r.status ?? '').toLowerCase();
  if (status !== 'completed') return 'pending'; // queued, in_progress, waiting, pending, requested
  const conclusion = String(r.conclusion ?? '').toLowerCase();
  if (conclusion === 'success' || conclusion === 'skipped' || conclusion === 'neutral') return 'success';
  return 'failed'; // failure, cancelled, timed_out, action_required, stale, startup_failure
}

/** Classify one commit status context for the head sha. */
function classifyStatusContext(c: Record<string, unknown>): CheckState {
  const state = String(c.state ?? '').toLowerCase();
  if (state === 'success') return 'success';
  if (state === 'pending') return 'pending';
  return 'failed'; // error, failure
}

/** `gh api <path>` parsed as JSON, or the reason it could not be read. */
async function ghApiJson(
  repoDir: string, path: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; reason: string }> {
  const res = await runCommand(ghBin(), ['api', path], { cwd: repoDir });
  if (res.code !== 0) {
    return { ok: false, reason: `gh api ${path} failed (exit ${res.code}): ${tail(res.stderr || res.stdout, 5)}` };
  }
  try {
    return { ok: true, data: JSON.parse(res.stdout) as Record<string, unknown> };
  } catch (err) {
    return { ok: false, reason: `could not parse gh api ${path}: ${(err as Error).message}` };
  }
}

/** Does the checkout carry any GitHub Actions workflow file? */
function hasWorkflowFiles(repoDir: string): boolean {
  try {
    return readdirSync(join(repoDir, '.github', 'workflows')).some((f) => /\.ya?ml$/i.test(f));
  } catch {
    return false;
  }
}

function shortOid(oid: unknown): string {
  return typeof oid === 'string' && oid.length > 0 ? oid.slice(0, 7) : '(unknown)';
}

/**
 * The merge rule, read-only (design §10): every workflow run for the head sha
 * completed with success, skipped or neutral and every commit status is
 * success (none pending or failed; a head younger than five minutes with no
 * run yet, in a checkout that has workflow files, is pending); `mergeable`
 * MERGEABLE; no Claude attribution trailer in any commit message or the body;
 * the head branch equals the run's branch. A `gh` failure is reported as
 * unreadable (and not ready), never a throw. `pending` is set when any reason
 * is one that resolves by itself (a run or status still pending, a fresh head,
 * mergeability not yet computed); a not-ready result without it is settled.
 */
export async function evaluate(pr: PullRequest, now: () => Date = () => new Date()): Promise<MergeEvaluation> {
  const res = await runCommand(
    ghBin(),
    ['pr', 'view', String(pr.number), '--json', PR_VIEW_FIELDS],
    { cwd: pr.repoDir },
  );
  if (res.code !== 0) {
    return { ready: false, unreadable: true, reasons: [`gh pr view #${pr.number} failed (exit ${res.code}): ${tail(res.stderr || res.stdout, 5)}`] };
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(res.stdout) as Record<string, unknown>;
  } catch (err) {
    return { ready: false, unreadable: true, reasons: [`could not parse gh pr view #${pr.number}: ${(err as Error).message}`] };
  }

  const reasons: string[] = [];
  let pending = false;

  const headOid = String(data.headRefOid ?? '');
  if (!headOid) {
    return { ready: false, unreadable: true, reasons: [`gh pr view #${pr.number} returned no headRefOid`] };
  }
  const runsRead = await ghApiJson(pr.repoDir, `repos/{owner}/{repo}/actions/runs?head_sha=${headOid}&per_page=100`);
  if (!runsRead.ok) {
    return { ready: false, unreadable: true, reasons: [`could not read the workflow runs of ${shortOid(headOid)}: ${runsRead.reason}`] };
  }
  const statusRead = await ghApiJson(pr.repoDir, `repos/{owner}/{repo}/commits/${headOid}/status`);
  if (!statusRead.ok) {
    return { ready: false, unreadable: true, reasons: [`could not read the commit statuses of ${shortOid(headOid)}: ${statusRead.reason}`] };
  }

  const runs = Array.isArray(runsRead.data.workflow_runs) ? (runsRead.data.workflow_runs as Record<string, unknown>[]) : [];
  for (const r of runs) {
    const name = String(r.name ?? 'workflow');
    const state = classifyWorkflowRun(r);
    if (state === 'pending') { reasons.push(`workflow ${name} is still running`); pending = true; }
    else if (state === 'failed') reasons.push(`workflow ${name} did not pass`);
  }
  // The combined `state` reads "pending" with zero statuses, so only the list counts.
  const statuses = Array.isArray(statusRead.data.statuses) ? (statusRead.data.statuses as Record<string, unknown>[]) : [];
  for (const c of statuses) {
    const name = String(c.context ?? 'status');
    const state = classifyStatusContext(c);
    if (state === 'pending') { reasons.push(`status ${name} is still pending`); pending = true; }
    else if (state === 'failed') reasons.push(`status ${name} did not pass`);
  }
  const commits = Array.isArray(data.commits) ? (data.commits as Record<string, unknown>[]) : [];
  if (runs.length === 0 && statuses.length === 0 && hasWorkflowFiles(pr.repoDir)) {
    const committed = Date.parse(String(commits[commits.length - 1]?.committedDate ?? ''));
    if (Number.isFinite(committed) && now().getTime() - committed < FRESH_HEAD_MS) {
      reasons.push(`no workflow run yet for ${shortOid(headOid)} (head committed less than five minutes ago)`);
      pending = true;
    }
  }

  // GitHub computes mergeability after a push; UNKNOWN is a state in flight.
  const mergeable = String(data.mergeable ?? '').toUpperCase();
  if (mergeable === 'UNKNOWN') {
    reasons.push('mergeability not yet computed (mergeable=UNKNOWN)');
    pending = true;
  } else if (mergeable !== 'MERGEABLE') {
    reasons.push(`not mergeable (mergeable=${String(data.mergeable ?? 'unknown')})`);
  }

  if (String(data.headRefName ?? '') !== pr.branch) {
    reasons.push(`head branch is ${String(data.headRefName ?? '(none)')}, expected ${pr.branch}`);
  }

  for (const commit of commits) {
    const message = `${String(commit.messageHeadline ?? '')}\n${String(commit.messageBody ?? '')}`;
    if (hasAttribution(message)) {
      reasons.push(`commit ${shortOid(commit.oid)} carries a Claude attribution trailer`);
    }
  }
  if (hasAttribution(String(data.body ?? ''))) {
    reasons.push('the PR body carries a Claude attribution trailer');
  }

  if (pending) return { ready: false, reasons, pending: true };
  return { ready: reasons.length === 0, reasons };
}

/** One failing check of a head sha, with the workflow run to read its log from. */
export interface CiFailing {
  name: string;
  /** The GitHub Actions run id, when the check is a workflow run. */
  runId?: number;
  /** A saved log tail, once the reconcile loop fetched it. */
  log?: string;
}

/** The CI state of one head sha, as the implementation phase's checks gate reads it. */
export interface CiState {
  state: 'green' | 'pending' | 'red' | 'unreadable';
  failing: CiFailing[];
  reason?: string;
}

/**
 * The checks of a head sha by the same rule `evaluate` applies (workflow runs
 * and commit statuses through `gh api`; a head under five minutes old with no
 * run yet in a checkout with workflow files is pending), shaped for the
 * implementation phase's PR checks gate: which checks fail and which run holds
 * each one's log. A `gh` failure is `unreadable`, never a throw.
 */
export async function readCiState(repoDir: string, headSha: string, now: () => Date = () => new Date()): Promise<CiState> {
  if (!headSha) return { state: 'unreadable', failing: [], reason: 'no head sha' };
  const runsRead = await ghApiJson(repoDir, `repos/{owner}/{repo}/actions/runs?head_sha=${headSha}&per_page=100`);
  if (!runsRead.ok) return { state: 'unreadable', failing: [], reason: runsRead.reason };
  const statusRead = await ghApiJson(repoDir, `repos/{owner}/{repo}/commits/${headSha}/status`);
  if (!statusRead.ok) return { state: 'unreadable', failing: [], reason: statusRead.reason };

  const runs = Array.isArray(runsRead.data.workflow_runs) ? (runsRead.data.workflow_runs as Record<string, unknown>[]) : [];
  const statuses = Array.isArray(statusRead.data.statuses) ? (statusRead.data.statuses as Record<string, unknown>[]) : [];
  const failing: CiFailing[] = [];
  let pending = false;
  for (const r of runs) {
    const state = classifyWorkflowRun(r);
    if (state === 'pending') pending = true;
    else if (state === 'failed') failing.push({ name: String(r.name ?? 'workflow'), runId: Number(r.id) || undefined });
  }
  for (const c of statuses) {
    const state = classifyStatusContext(c);
    if (state === 'pending') pending = true;
    else if (state === 'failed') failing.push({ name: String(c.context ?? 'status') });
  }
  if (runs.length === 0 && statuses.length === 0 && hasWorkflowFiles(repoDir)) {
    let committed = NaN;
    try {
      committed = Date.parse(execFileSync('git', ['-C', repoDir, 'show', '-s', '--format=%cI', headSha], { encoding: 'utf-8', env: scrubbedGitEnv() }).trim());
    } catch {
      committed = NaN;
    }
    if (Number.isFinite(committed) && now().getTime() - committed < FRESH_HEAD_MS) pending = true;
  }
  if (failing.length > 0) return { state: 'red', failing };
  if (pending) return { state: 'pending', failing: [] };
  return { state: 'green', failing: [] };
}

// ---------------------------------------------------------------------------
// The merge wait (ask-me-first).
// ---------------------------------------------------------------------------

/** The newest `merge` wait for a run that asks `questionId`, open or answered, else undefined. */
async function findMergeWait(runId: string, questionId: string): Promise<ControllerWaitRecord | undefined> {
  const all = (await listWaits()) as ControllerWaitRecord[];
  return all
    .filter((w) => w.kind === 'merge' && w.run === runId && w.questions.some((q) => q.id === questionId))
    .sort((a, b) => b.created.localeCompare(a.created))[0];
}

/** One pull request to merge by rule, with the identity its `merge` wait carries. */
export interface MergeTarget {
  pr: PullRequest;
  runId: string;
  projectId: string;
  spec: string;
  /** The merge wait's question id: `merge` for the run's own PR, `merge:<repo>#<n>` for a close-out PR. */
  questionId: string;
  /** How the wait names the PR: `PR #3`, or `close-out PR #134 of spec-workflow-mcp`. */
  label: string;
}

/** The question id and label of a close-out PR's merge wait. */
export function closeoutMergeTarget(run: Pick<RunRecord, 'id' | 'project' | 'spec'>, pr: PullRequest): MergeTarget {
  const repo = basename(pr.repoDir);
  return { pr, runId: run.id, projectId: run.project, spec: run.spec, questionId: `merge:${repo}#${pr.number}`, label: `close-out PR #${pr.number} of ${repo}` };
}

// ---------------------------------------------------------------------------
// The post-merge command's output log.
// ---------------------------------------------------------------------------

function appendPostMergeLog(
  stepLogDir: string,
  command: string,
  output: string,
  result: CommandResult,
  at: Date,
): void {
  mkdirSync(stepLogDir, { recursive: true });
  const status = result.timedOut ? 'timed out' : `exit ${result.code}`;
  const header = `\n=== post-merge (${at.toISOString()}) ${status} ===\n$ ${command}\n`;
  appendFileSync(join(stepLogDir, 'post-merge.log'), header + output);
}

// ---------------------------------------------------------------------------
// The merge stage.
// ---------------------------------------------------------------------------

/** `gh pr view <n> --json mergeCommit` ⇒ the merge commit oid, or ''. */
async function readMergeSha(pr: PullRequest): Promise<string> {
  const res = await runCommand(ghBin(), ['pr', 'view', String(pr.number), '--json', 'mergeCommit'], { cwd: pr.repoDir });
  if (res.code !== 0) return '';
  try {
    const data = JSON.parse(res.stdout) as { mergeCommit?: { oid?: unknown } };
    return typeof data.mergeCommit?.oid === 'string' ? data.mergeCommit.oid : '';
  } catch {
    return '';
  }
}

/**
 * Run the merge stage once for a run. The caller polls while `not-ready`
 * ({@link MERGE_POLL_INTERVAL_MS}): something is in flight. A PR that fails the
 * rule with nothing in flight (a red check, a conflict, a wrong head branch, an
 * attribution trailer) is `blocked`, which the caller turns into an `error`
 * wait: polling would never change it (the first in-code fixture run sat in
 * `merging` for two hours on a `Co-Authored-By` trailer in one commit, with no
 * visible reason). On an `ask` project it opens one `merge`
 * wait per run and reuses it on re-entry; an answer of "merge" proceeds, "hold"
 * stays `waiting`. When ready (and allowed) it runs `gh pr merge --<method>`
 * with no branch delete, then the post-merge command via `bash -lc` in the code
 * root (ten-minute timeout, output appended to the step log dir), then writes
 * `pr.merged`. A failed merge or post-merge command returns `failed` with the
 * output tail; the caller turns that into an `error` wait. A PR whose state
 * `gh` cannot read returns `unreadable`, which the caller also turns into an
 * `error` wait rather than polling (the first fixture run with a fine-grained
 * token lacking Checks: read sat in `merging` with no visible reason).
 */
export async function runMergeStage(run: RunRecord, deps: MergeStageDeps): Promise<MergeStageResult> {
  const pr = await findPullRequest({ repoDir: run.codeRoot, branch: run.branch, number: run.pr });
  if (!pr) {
    return { status: 'not-ready', reasons: [`no open pull request for branch ${run.branch}`] };
  }
  return mergeByRule({ pr, runId: run.id, projectId: run.project, spec: run.spec, questionId: MERGE_QUESTION_ID, label: `PR #${pr.number}` }, deps);
}

/**
 * The merge rule applied to one pull request (the run's own, or a close-out
 * PR of any repository): the body of {@link runMergeStage}, with the wait
 * identity taken from `target` so each PR has its own `merge` wait.
 */
export async function mergeByRule(target: MergeTarget, deps: MergeStageDeps): Promise<MergeStageResult> {
  const { pr } = target;
  const repoDir = pr.repoDir;
  const now = deps.now ?? ((): Date => new Date());

  const evaluation = await evaluate(pr);
  if (evaluation.unreadable) {
    return { status: 'unreadable', reasons: evaluation.reasons, number: pr.number };
  }
  if (!evaluation.ready) {
    return { status: evaluation.pending ? 'not-ready' : 'blocked', reasons: evaluation.reasons, number: pr.number };
  }

  if (deps.rules.merge === 'ask') {
    const existing = await findMergeWait(target.runId, target.questionId);
    if (!existing) {
      const wait = await createWait({
        kind: 'merge',
        runId: target.runId,
        projectId: target.projectId,
        spec: target.spec,
        specDir: deps.specDir,
        questions: [{ id: target.questionId, text: `Merge ${target.label}?`, options: ['merge', 'hold'], recommended: 'merge' }],
      });
      return { status: 'waiting', reasons: [`waiting for the operator to approve merging ${target.label}`], number: pr.number, waitId: wait.id };
    }
    const decision = existing.state === 'answered' ? existing.answer?.[target.questionId]?.value : undefined;
    if (!decision) {
      return { status: 'waiting', reasons: [`waiting for the operator to approve merging ${target.label}`], number: pr.number, waitId: existing.id };
    }
    if (decision !== 'merge') {
      return { status: 'waiting', reasons: [`the operator held ${target.label}`], number: pr.number, waitId: existing.id };
    }
    // decision === 'merge': fall through and merge.
  }

  const method = deps.rules.method;
  const mergeRes = await runCommand(ghBin(), ['pr', 'merge', String(pr.number), `--${method}`], { cwd: repoDir });
  if (mergeRes.code !== 0) {
    return {
      status: 'failed',
      reasons: [`gh pr merge #${pr.number} failed (exit ${mergeRes.code})`, tail(mergeRes.stderr || mergeRes.stdout, 20)],
      number: pr.number,
    };
  }

  const sha = await readMergeSha(pr);

  if (deps.rules.postMerge) {
    const postRes = await runCommand('bash', ['-lc', deps.rules.postMerge], { cwd: repoDir, timeoutMs: POST_MERGE_TIMEOUT_MS });
    const output = `${postRes.stdout}${postRes.stderr}`;
    appendPostMergeLog(deps.stepLogDir, deps.rules.postMerge, output, postRes, now());
    if (postRes.code !== 0 || postRes.timedOut) {
      const why = postRes.timedOut ? 'timed out' : `exit ${postRes.code}`;
      return { status: 'failed', reasons: [`post-merge command ${why}`, tail(output, 20)], number: pr.number, sha };
    }
  }

  deps.ledger.prMerged({ number: pr.number, sha, method, repo: basename(repoDir) });
  return { status: 'merged', reasons: [`merged ${target.label} via ${method}`], number: pr.number, sha };
}
