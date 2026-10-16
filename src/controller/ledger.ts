/**
 * Controller-written run ledger (`<spec dir>/harness-events.jsonl`).
 *
 * The controller (not a model) appends run events here in exactly the formats of
 * `harness/skills/sdd-continue/references/formats.md` ("Run ledger"), so
 * `spec-workflow-mcp --watch` and the dashboard shell render a controller run the
 * way they render a supervisor run. One JSON object per line, appended with
 * `fs.appendFileSync`; `ts` (ISO), `run`, `spec`, `type` come first, then the
 * event's own keys in the order the event script would add them. Every value is a
 * string, as the event script writes them, so a consumer that does `Number(v)`
 * sees the same thing it sees from a real run.
 *
 * The reader this stays compatible with is `src/watch/ledger.ts`
 * (`buildModel`), which `src/watch/render.ts`, `src/dashboard/shell/now-model.ts`
 * and `src/dashboard/shell/waits.ts` all build on.
 */

import { appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { scrubbedGitEnv } from '../core/git-utils.js';

/** A usage field the step runner could not determine. */
export const UNKNOWN = 'unknown';
export type MaybeCount = number | typeof UNKNOWN;

/**
 * The step runner's usage shape (controller-design §4). `tokens` is the sum of
 * these five; `cacheWrite` is `cacheWrite5m + cacheWrite1h`. Any field that is
 * `unknown` is written as `unknown`, and a sum that includes an unknown is
 * `unknown` too — the same thing the plugin hook wrote for a run it could not
 * total.
 */
export interface StepUsage {
  input: MaybeCount;
  output: MaybeCount;
  cacheRead: MaybeCount;
  cacheWrite5m: MaybeCount;
  cacheWrite1h: MaybeCount;
}

export interface OpenRunLedgerOptions {
  /** The spec directory; the ledger is `<specDir>/harness-events.jsonl`. */
  specDir: string;
  /** This run's id (`run-<YYYYMMDD>-<HHMMSS>`, see {@link newRunId}). */
  runId: string;
  /** The spec slug. */
  spec: string;
  /** Clock seam for tests; defaults to the wall clock. Called once per row. */
  now?: () => Date;
}

export interface RunLedger {
  /** The ledger file this writer appends to. */
  readonly path: string;
  readonly runId: string;
  readonly spec: string;
  runStart(fields: Record<string, string>): void;
  runEnd(status: string): void;
  phaseStart(phase: string, fields?: { mode?: string; budget?: string; state?: string }): void;
  phaseEnd(phase: string, fields: { result: string; state?: string; note?: string }): void;
  round(fields: { phase: string; round: string | number; verdict: string; version?: string }): void;
  spawnStart(fields: { agent: string; role: string; model?: string; provider?: string; effort?: string }): void;
  spawnEnd(fields: { agent: string; usage: StepUsage; model?: string; agentId?: string }): void;
  spawnUsage(fields: { agent: string; role?: string; result?: string; phase?: string; task?: string; round?: string }): void;
  taskPick(fields: { task: string; title: string }): void;
  taskDone(fields: { task: string; rounds?: string | number; outcome?: string }): void;
  /** The gate's TDD judge answers for a task (implementation skill "Bookkeeping": the `judge` row). */
  judge(fields: { task: string; site: string } & Record<string, string>): void;
  /** A PR merged by the controller's merge rule (T7): number, merge sha, method. */
  prMerged(fields: { number: string | number; sha: string; method: string; repo?: string }): void;
  note(text: string): void;
}

/** `String(n)` for a count, `unknown` for an unknown. */
function countStr(v: MaybeCount): string {
  return v === UNKNOWN ? UNKNOWN : String(v);
}

/** The sum as a string, or `unknown` when any addend is unknown. */
function sumStr(...vals: MaybeCount[]): string {
  let total = 0;
  for (const v of vals) {
    if (v === UNKNOWN) return UNKNOWN;
    total += v;
  }
  return String(total);
}

/**
 * Open a writer for one run's ledger. Every method appends exactly one row.
 * Optional keys with an `undefined` value are omitted, as the event script omits
 * a key/value pair it was not given.
 */
export function openRunLedger(options: OpenRunLedgerOptions): RunLedger {
  const { specDir, runId, spec } = options;
  const clock = options.now ?? ((): Date => new Date());
  const path = join(specDir, 'harness-events.jsonl');

  const write = (type: string, fields: Record<string, string | undefined>): void => {
    const row: Record<string, string> = { ts: clock().toISOString(), run: runId, spec, type };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) row[key] = value;
    }
    appendFileSync(path, JSON.stringify(row) + '\n');
  };

  return {
    path,
    runId,
    spec,
    runStart(fields) {
      write('run.start', fields);
    },
    runEnd(status) {
      write('run.end', { status });
    },
    phaseStart(phase, fields = {}) {
      write('phase.start', { phase, mode: fields.mode, budget: fields.budget, state: fields.state });
    },
    phaseEnd(phase, fields) {
      write('phase.end', { phase, result: fields.result, state: fields.state, note: fields.note });
    },
    round(fields) {
      write('round', { phase: fields.phase, round: String(fields.round), verdict: fields.verdict, version: fields.version });
    },
    spawnStart(fields) {
      write('spawn.start', { agent: fields.agent, role: fields.role, provider: fields.provider, model: fields.model, effort: fields.effort });
    },
    spawnEnd(fields) {
      const u = fields.usage;
      write('spawn.end', {
        agent: fields.agent,
        input: countStr(u.input),
        output: countStr(u.output),
        cacheWrite: sumStr(u.cacheWrite5m, u.cacheWrite1h),
        cacheRead: countStr(u.cacheRead),
        tokens: sumStr(u.input, u.output, u.cacheRead, u.cacheWrite5m, u.cacheWrite1h),
        cacheWrite5m: countStr(u.cacheWrite5m),
        cacheWrite1h: countStr(u.cacheWrite1h),
        model: fields.model,
        agentId: fields.agentId,
      });
    },
    spawnUsage(fields) {
      write('spawn.usage', {
        agent: fields.agent,
        role: fields.role,
        result: fields.result,
        phase: fields.phase,
        task: fields.task,
        round: fields.round,
      });
    },
    taskPick(fields) {
      write('task.pick', { task: fields.task, title: fields.title });
    },
    taskDone(fields) {
      write('task.done', {
        task: fields.task,
        rounds: fields.rounds === undefined ? undefined : String(fields.rounds),
        outcome: fields.outcome,
      });
    },
    judge(fields) {
      write('judge', fields);
    },
    prMerged(fields) {
      write('pr.merged', { number: String(fields.number), sha: fields.sha, method: fields.method, ...(fields.repo ? { repo: fields.repo } : {}) });
    },
    note(text) {
      write('note', { text });
    },
  };
}

/** `run-<YYYYMMDD>-<HHMMSS>` in UTC, as the supervisor chooses it at start. */
export function newRunId(now: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  const y = now.getUTCFullYear();
  const stamp = `${y}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}`;
  const time = `${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  return `run-${stamp}-${time}`;
}

export interface CheckpointOptions {
  /** The spec store git root to stage and commit in. */
  specStoreRoot: string;
  /** The commit message, formed by the caller (e.g. `docs(sdd): <SPEC> <PHASE> v<N>`). */
  message: string;
  /** Paths to stage, relative to the root; with `spec`, the spec-store paths; else everything (`-A`). */
  paths?: string[];
  /**
   * The spec whose store paths to stage when `paths` is absent (the list
   * `book.sh commit` stages): never the whole tree, so machine state such as
   * `harness-run.json` or an operator's unrelated edit is not swept into a
   * controller commit.
   */
  spec?: string;
}

/**
 * The spec-store paths a controller commit may stage, relative to the root:
 * the spec's own directory, its approvals, HANDOFF, INDEX and the deferrals.
 * Only the ones that exist and are not ignored.
 */
export function specStorePaths(specStoreRoot: string, spec: string): string[] {
  const candidates = [
    `.spec-workflow/specs/${spec}`, `.spec-workflow/approvals/${spec}`, '.spec-workflow/HANDOFF.md',
    '.spec-workflow/spec-decomposition/INDEX.md', '.spec-workflow/deferrals', 'HANDOFF.md',
  ];
  const out: string[] = [];
  for (const p of candidates) {
    if (!existsSync(join(specStoreRoot, p))) continue;
    try {
      execFileSync('git', ['-C', specStoreRoot, 'check-ignore', '-q', p], { env: scrubbedGitEnv(), stdio: 'ignore' });
      continue; // ignored
    } catch {
      out.push(p);
    }
  }
  return out;
}

/** Holds a lock around the commit. The default runs it directly. */
export type Serialize = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Stage and commit the spec store with the caller's message, serialised through
 * the optional lock the caller passes (the T2 per-store lock). It adds no
 * attribution: the message is used verbatim. Returns the commit's full SHA.
 */
export function checkpoint(options: CheckpointOptions, serialize: Serialize = (fn) => fn()): Promise<string> {
  const { specStoreRoot, message, spec } = options;
  const paths = options.paths && options.paths.length > 0
    ? options.paths
    : spec ? specStorePaths(specStoreRoot, spec) : [];
  return serialize(async () => {
    const git = (args: string[]): string =>
      execFileSync('git', ['-C', specStoreRoot, ...args], { encoding: 'utf-8', env: scrubbedGitEnv() });
    git(['add', ...(paths.length > 0 ? ['-A', '--', ...paths] : ['-A'])]);
    git(['commit', '-m', message]);
    return git(['rev-parse', 'HEAD']).trim();
  });
}

/**
 * Commit the spec's store paths with the caller's message, skipping when there
 * is nothing to stage or nothing staged (a re-entry, or a stop that changed no
 * file). Returns the commit sha, or `undefined` when it skipped. The commit
 * form every per-task, stop and run-end commit of the controller uses.
 */
export function commitSpecStore(
  options: { specStoreRoot: string; spec: string; message: string }, serialize: Serialize = (fn) => fn(),
): Promise<string | undefined> {
  const { specStoreRoot, spec, message } = options;
  return serialize(async () => {
    const git = (args: string[]): string =>
      execFileSync('git', ['-C', specStoreRoot, ...args], { encoding: 'utf-8', env: scrubbedGitEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const paths = specStorePaths(specStoreRoot, spec);
    if (paths.length === 0) return undefined;
    git(['add', '-A', '--', ...paths]);
    try {
      git(['diff', '--cached', '--quiet']);
      return undefined; // nothing staged
    } catch {
      // Something is staged: commit it.
    }
    git(['commit', '-q', '-m', message]);
    return git(['rev-parse', 'HEAD']);
  });
}

/**
 * Push the spec store's current branch to `origin`, after rebasing the local
 * commits onto the remote's. The controller commits store documents locally
 * while a run's pull request merges on the remote, so the two sides diverge:
 * the first fixture runs left ten local-only commits behind an unrelated
 * origin/main. No remote ⇒ skipped (`ok`). A failed rebase is aborted and
 * reported; nothing here throws.
 */
export function pushSpecStore(specStoreRoot: string): { ok: boolean; note: string } {
  const git = (args: string[]): string =>
    execFileSync('git', ['-C', specStoreRoot, ...args], { encoding: 'utf-8', env: scrubbedGitEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const fail = (step: string, err: unknown): { ok: false; note: string } => {
    const e = err as { stderr?: unknown; message?: string };
    const text = typeof e?.stderr === 'string' && e.stderr.trim() ? e.stderr.trim().split('\n').pop()! : (e?.message ?? String(err));
    return { ok: false, note: `${step}: ${text}` };
  };
  let remotes = '';
  try { remotes = git(['remote']); } catch (err) { return fail('git remote', err); }
  if (!remotes) return { ok: true, note: 'no remote' };
  let branch = '';
  try { branch = git(['rev-parse', '--abbrev-ref', 'HEAD']); } catch (err) { return fail('rev-parse', err); }
  if (!branch || branch === 'HEAD') return { ok: false, note: 'the spec store is on a detached HEAD' };
  let remoteHasBranch = true;
  try { git(['fetch', '-q', 'origin', branch]); } catch { remoteHasBranch = false; }
  if (remoteHasBranch) {
    try {
      git(['rebase', '-q', '--autostash', `origin/${branch}`]);
    } catch (err) {
      try { git(['rebase', '--abort']); } catch { /* nothing to abort */ }
      return fail(`rebase onto origin/${branch}`, err);
    }
  }
  try { git(['push', '-q', 'origin', branch]); } catch (err) { return fail(`push ${branch}`, err); }
  return { ok: true, note: `pushed ${branch}` };
}
