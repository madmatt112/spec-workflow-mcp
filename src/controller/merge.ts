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
import { execFile } from 'child_process';
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { readAgentRules } from '../dashboard/harness/run-setup.js';
import { createWait, type ControllerWaitRecord } from './waits.js';
import { listWaits, type RunRecord } from './state.js';
import type { RunLedger } from './ledger.js';

/** The suggested interval between `runMergeStage` polls while `not-ready`. */
export const MERGE_POLL_INTERVAL_MS = 30_000;

/** The single question id of a `merge` wait. */
const MERGE_QUESTION_ID = 'merge';

/** The post-merge command's wall-clock budget (design §10: ten minutes). */
const POST_MERGE_TIMEOUT_MS = 10 * 60 * 1000;

/** The `gh pr view` fields the readiness rule reads. */
const PR_VIEW_FIELDS =
  'mergeable,mergeStateStatus,statusCheckRollup,headRefName,body,commits,author';

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
   * The PR's state could not be read at all (`gh pr view` failed or returned
   * no JSON), as opposed to read and found not ready. A caller must not poll
   * on this: nothing changes until the operator fixes the token or the PR.
   */
  unreadable?: boolean;
}

export type MergeStageStatus = 'merged' | 'waiting' | 'not-ready' | 'unreadable' | 'failed';

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

/** Classify one `statusCheckRollup` entry (a CheckRun or a StatusContext). */
function classifyCheck(c: Record<string, unknown>): CheckState {
  const typename = typeof c.__typename === 'string' ? c.__typename : '';
  const usesState = typename === 'StatusContext' || (typename !== 'CheckRun' && c.state !== undefined);
  if (usesState) {
    const s = String(c.state ?? '').toUpperCase();
    if (s === 'SUCCESS') return 'success';
    if (s === 'PENDING' || s === 'EXPECTED') return 'pending';
    return 'failed'; // ERROR, FAILURE
  }
  const status = String(c.status ?? '').toUpperCase();
  if (status && status !== 'COMPLETED') return 'pending'; // QUEUED, IN_PROGRESS, …
  const conclusion = String(c.conclusion ?? '').toUpperCase();
  if (conclusion === 'SUCCESS' || conclusion === 'SKIPPED' || conclusion === 'NEUTRAL') return 'success';
  if (!conclusion && !status) return 'pending'; // an unexpected shape: do not merge on it
  return 'failed'; // FAILURE, CANCELLED, TIMED_OUT, ACTION_REQUIRED, STALE, STARTUP_FAILURE
}

function checkName(c: Record<string, unknown>): string {
  return String(c.name ?? c.context ?? 'check');
}

function shortOid(oid: unknown): string {
  return typeof oid === 'string' && oid.length > 0 ? oid.slice(0, 7) : '(unknown)';
}

/**
 * The merge rule, read-only (design §10): every check concluded SUCCESS,
 * SKIPPED or NEUTRAL (none pending or failed); `mergeable` MERGEABLE; no Claude
 * attribution trailer in any commit message or the body; the head branch equals
 * the run's branch. A `gh` failure is reported as not-ready, never a throw.
 */
export async function evaluate(pr: PullRequest): Promise<MergeEvaluation> {
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

  const rollup = Array.isArray(data.statusCheckRollup) ? (data.statusCheckRollup as Record<string, unknown>[]) : [];
  for (const c of rollup) {
    const state = classifyCheck(c);
    if (state === 'pending') reasons.push(`check ${checkName(c)} is still running`);
    else if (state === 'failed') reasons.push(`check ${checkName(c)} did not pass`);
  }

  if (String(data.mergeable ?? '').toUpperCase() !== 'MERGEABLE') {
    reasons.push(`not mergeable (mergeable=${String(data.mergeable ?? 'unknown')})`);
  }

  if (String(data.headRefName ?? '') !== pr.branch) {
    reasons.push(`head branch is ${String(data.headRefName ?? '(none)')}, expected ${pr.branch}`);
  }

  const commits = Array.isArray(data.commits) ? (data.commits as Record<string, unknown>[]) : [];
  for (const commit of commits) {
    const message = `${String(commit.messageHeadline ?? '')}\n${String(commit.messageBody ?? '')}`;
    if (hasAttribution(message)) {
      reasons.push(`commit ${shortOid(commit.oid)} carries a Claude attribution trailer`);
    }
  }
  if (hasAttribution(String(data.body ?? ''))) {
    reasons.push('the PR body carries a Claude attribution trailer');
  }

  return { ready: reasons.length === 0, reasons };
}

// ---------------------------------------------------------------------------
// The merge wait (ask-me-first).
// ---------------------------------------------------------------------------

/** The newest `merge` wait for a run, open or answered, else undefined. */
async function findMergeWait(runId: string): Promise<ControllerWaitRecord | undefined> {
  const all = (await listWaits()) as ControllerWaitRecord[];
  return all
    .filter((w) => w.kind === 'merge' && w.run === runId)
    .sort((a, b) => b.created.localeCompare(a.created))[0];
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
 * ({@link MERGE_POLL_INTERVAL_MS}). On an `ask` project it opens one `merge`
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
  const repoDir = run.codeRoot;
  const now = deps.now ?? ((): Date => new Date());

  const pr = await findPullRequest({ repoDir, branch: run.branch, number: run.pr });
  if (!pr) {
    return { status: 'not-ready', reasons: [`no open pull request for branch ${run.branch}`] };
  }

  const evaluation = await evaluate(pr);
  if (evaluation.unreadable) {
    return { status: 'unreadable', reasons: evaluation.reasons, number: pr.number };
  }
  if (!evaluation.ready) {
    return { status: 'not-ready', reasons: evaluation.reasons, number: pr.number };
  }

  if (deps.rules.merge === 'ask') {
    const existing = await findMergeWait(run.id);
    if (!existing) {
      const wait = await createWait({
        kind: 'merge',
        runId: run.id,
        projectId: run.project,
        spec: run.spec,
        specDir: deps.specDir,
        questions: [{ id: MERGE_QUESTION_ID, text: `Merge PR #${pr.number}?`, options: ['merge', 'hold'], recommended: 'merge' }],
      });
      return { status: 'waiting', reasons: [`waiting for the operator to approve merging PR #${pr.number}`], number: pr.number, waitId: wait.id };
    }
    const decision = existing.state === 'answered' ? existing.answer?.[MERGE_QUESTION_ID]?.value : undefined;
    if (!decision) {
      return { status: 'waiting', reasons: [`waiting for the operator to approve merging PR #${pr.number}`], number: pr.number, waitId: existing.id };
    }
    if (decision !== 'merge') {
      return { status: 'waiting', reasons: [`the operator held PR #${pr.number}`], number: pr.number, waitId: existing.id };
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

  deps.ledger.prMerged({ number: pr.number, sha, method });
  return { status: 'merged', reasons: [`merged PR #${pr.number} via ${method}`], number: pr.number, sha };
}
