// src/controller/merge-fix.ts
//
// The merge fix round (design C3, R1 AC 1-10): one capped implementer fix round
// on the run's own blocked PR branch that never rewrites history. The run loop
// calls it (through `runMergeStageStep`) when every blocking reason is a red
// check or a merge conflict and the cap has room. The module is pure code; the
// only model is the one `sdd-implementer` step, run at the profile model and
// effort (R2 AC 10).
//
// The three pure functions (`mergeFixHistory`, `mergeFixEligible`) decide whether
// a round runs and how many have run; `runMergeFixRound` runs one and reports its
// ending, written to the ledger as the resume contract (Data Models).
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { execFile, execFileSync } from 'child_process';
import {
  runStep, loadRole, type StepResult, type StepSpec, type RateLimitWindows,
} from './step.js';
import type { RunRecord } from './state.js';
import type { RunLedger } from './ledger.js';
import type { BlockingReason, MergeStageResult } from './merge.js';
import { IMPLEMENTER_SCHEMA } from './phases/implementation.js';
import { scrubbedGitEnv } from '../core/git-utils.js';
import { PathUtils } from '../core/path-utils.js';
import { harnessHandler } from '../tools/harness.js';
import type { ToolContext } from '../types.js';

/** Fix rounds on a blocked PR before the `error` wait (design C3, D3). */
export const MERGE_FIX_CAP = 2;
/** `--max-turns` for the implementer step, as `TURN_CAP['sdd-implementer']`. */
const IMPLEMENTER_TURN_CAP = 150;
/** Lines of a failing run's log kept for the brief, as the reconcile loop keeps. */
const CI_LOG_TAIL = 80;

/** Everything one merge fix round needs. The four callbacks match {@link ImplementationPhaseContext}. */
export interface MergeFixContext {
  run: RunRecord;
  /** The run's worktree: on the PR branch, where the step and the push happen. */
  worktree: string;
  /** The project root that holds `.spec-workflow`. */
  specStoreRoot: string;
  /** `<specStoreRoot>/.spec-workflow/specs/<spec>`. */
  specDir: string;
  ledger: RunLedger;
  stepLogDir: string;
  mcpConfig?: string | Record<string, unknown>;
  onStepActivity?: (e: { stepId: string; role: string; tool: string; inputSummary: string; ts?: string }) => void;
  onRateLimit?: (w: RateLimitWindows) => void;
  onStepSpawn?: (s: { id: string; pid: number; startTime: number }) => Promise<void> | void;
  onStepEnd?: (id: string) => Promise<void> | void;
  /** Where briefs and the standing file go; defaults to `/tmp/scratchpad/sdd/<spec>`. */
  scratchDir?: string;
}

/** What one merge fix round tells the run loop (design C3). */
export interface MergeFixOutcome {
  kind: 'pushed' | 'rechecked' | 'ended' | 'usage-limit';
  ending: string;
}

/**
 * This run's merge fix rounds so far (design C3, D3). `used` counts every end note
 * except a `step usage-limit` ending (an interrupted round runs again); `endings`
 * lists every end note's ending, in order, for the `error` wait's summary.
 */
export function mergeFixHistory(rows: Record<string, string>[], runId: string): { used: number; endings: string[] } {
  const endings: string[] = [];
  for (const r of rows) {
    if (r.run !== runId || r.type !== 'note') continue;
    const m = /^merge fix round \d+ end: (.*)$/.exec(r.text ?? '');
    if (m) endings.push(m[1]);
  }
  const used = endings.filter((e) => e !== 'step usage-limit').length;
  return { used, endings };
}

/**
 * Whether a merge fix round may run (design C3): the result is `blocked`, every
 * blocking reason is a `check` or a `conflict`, and the cap has room.
 */
export function mergeFixEligible(result: MergeStageResult, used: number): boolean {
  if (result.status !== 'blocked') return false;
  const blocking = result.blocking;
  if (!blocking || blocking.length === 0) return false;
  if (!blocking.every((b) => b.kind === 'check' || b.kind === 'conflict')) return false;
  return used < MERGE_FIX_CAP;
}

interface CommandResult { code: number | null; stdout: string; stderr: string }

function runCommand(bin: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(bin, args, { cwd, env: bin === 'git' ? scrubbedGitEnv() : process.env, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as NodeJS.ErrnoException | null;
      const code = e && typeof e.code === 'number' ? e.code : e ? null : 0;
      resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });
}

/** `git` in the worktree, synchronous, with the scrubbed env. */
function git(cwd: string, args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf-8', env: scrubbedGitEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** `git merge-base --is-ancestor <a> <b>`: is `a` an ancestor of `b`? */
function isAncestor(cwd: string, a: string, b: string): boolean {
  try {
    execFileSync('git', ['-C', cwd, 'merge-base', '--is-ancestor', a, b], { env: scrubbedGitEnv(), stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** The `gh` binary, overridable so tests swap in `scripts/stub-gh.mjs`. */
function ghBin(): string {
  return process.env.CONTROLLER_GH_BIN || 'gh';
}

/** The text after `<FLAG>:` in the report field or text, or undefined. */
function flagText(flag: string, ...sources: (string | null | undefined)[]): string | undefined {
  const re = new RegExp(`${flag}:\\s*([^\\n]+)`);
  for (const s of sources) {
    if (!s) continue;
    const m = s.match(re);
    if (m) return m[1].trim();
  }
  return undefined;
}

function tail(text: string, lines: number): string {
  return text.replace(/\s+$/, '').split('\n').slice(-lines).join('\n');
}

interface ImplementerReport { flag?: string }

/**
 * Run one merge fix round on the PR branch, in the order design C3 names: the
 * start note, the branch guard, the standing brief, each failing run's log tail,
 * the merge-fix brief, one `sdd-implementer` step, then the ending — and the
 * controller pushes only a fast-forward commit, never `--force`, never a
 * rewritten history (R1 AC 3-4).
 */
export async function runMergeFixRound(
  ctx: MergeFixContext,
  input: { round: number; pr: number; blocking: BlockingReason[]; base: string },
): Promise<MergeFixOutcome> {
  const { round, pr, blocking, base } = input;
  const specName = ctx.run.spec;
  const scratch = ctx.scratchDir ?? join('/tmp/scratchpad/sdd', specName);
  const toolContext: ToolContext = { projectPath: ctx.specStoreRoot, workspacePath: ctx.worktree };
  const workflowRoot = PathUtils.getWorkflowRoot(ctx.specStoreRoot);

  const brief = async (template: string, path: string, values: Record<string, string>): Promise<string> => {
    const res = await harnessHandler({ action: 'brief', template, specName, values: { ...values, path } }, toolContext);
    if (!res.success) throw new Error(`brief ${template} failed: ${res.message}`);
    return (res.data as { path: string }).path;
  };

  const end = (kind: MergeFixOutcome['kind'], ending: string): MergeFixOutcome => {
    ctx.ledger.note(`merge fix round ${round} end: ${ending}`);
    return { kind, ending };
  };

  // 1. The start note (R1 AC 10): the resume contract's start marker.
  ctx.ledger.note(`merge fix round ${round} start: ${blocking.map((b) => b.text).join('; ')}`);

  // 2. The branch guard: a worktree off the PR branch never spawns or pushes.
  if (git(ctx.worktree, ['rev-parse', '--abbrev-ref', 'HEAD']) !== ctx.run.branch) {
    return end('ended', 'not on the PR branch');
  }

  // 3. The standing brief, as the per-task loop writes it.
  const stdValues = {
    codeRoot: ctx.worktree, mainCheckout: ctx.worktree, specStoreRoot: workflowRoot, specDir: ctx.specDir,
  };
  await brief('impl-standing', join(scratch, 'impl-standing.md'), stdValues);

  // 4. The log tail of each failing workflow run, saved for the brief.
  const checks = blocking.filter((b) => b.kind === 'check' && b.check);
  const checkNames = checks.map((b) => b.check!.name).join(', ');
  const logPaths: string[] = [];
  for (const b of checks) {
    const runId = b.check!.runId;
    if (runId === undefined) continue;
    const log = await runCommand(ghBin(), ['run', 'view', String(runId), '--log-failed'], ctx.worktree);
    const name = b.check!.name.replace(/[^A-Za-z0-9_.-]+/g, '_');
    const path = join(scratch, `merge-ci-${name}-r${round}.log`);
    writeFileSync(path, tail(log.stdout || log.stderr, CI_LOG_TAIL) + '\n', 'utf-8');
    logPaths.push(path);
  }

  // 5. The merge-fix brief (template `fix`, variant `merge`).
  const fixBrief = await brief('fix', join(scratch, `merge-fix-brief-r${round}.md`), {
    variant: 'merge', round: String(round), pr: String(pr), base,
    checkNames, logPaths: logPaths.join(', '), taskId: 'merge', findings: '', commit: 'none',
  });

  // 6. One step on `sdd-implementer` at the profile model and effort (R2 AC 10).
  const label = `merge fix round ${round}`;
  const profile = loadRole('sdd-implementer');
  const before = git(ctx.worktree, ['rev-parse', 'HEAD']);
  const stepId = `implementer-merge-r${round}`;
  ctx.ledger.spawnStart({ agent: 'sdd-implementer', role: label, model: profile.model, effort: profile.effort });
  let spawnWrite: Promise<void> | void = undefined;
  const spec: StepSpec = {
    role: 'sdd-implementer',
    briefPath: fixBrief,
    worktree: ctx.worktree,
    logPath: join(ctx.stepLogDir, `${stepId}.jsonl`),
    maxTurns: IMPLEMENTER_TURN_CAP,
    sessionId: randomUUID(),
    mcpConfig: ctx.mcpConfig,
    schema: IMPLEMENTER_SCHEMA,
    runId: ctx.run.id,
    stepId,
    workspace: ctx.worktree,
    sharedRoot: ctx.specStoreRoot,
    onActivity: (a) => ctx.onStepActivity?.({ stepId, role: 'sdd-implementer', tool: a.tool, inputSummary: a.inputSummary, ts: a.ts }),
    onRateLimit: ctx.onRateLimit,
    onSpawn: (pid, startTime) => { spawnWrite = ctx.onStepSpawn?.({ id: stepId, pid, startTime }); },
  };
  const result: StepResult = await runStep(spec);
  await spawnWrite;
  await ctx.onStepEnd?.(stepId);
  ctx.ledger.spawnEnd({ agent: 'sdd-implementer', model: profile.model, usage: result.usage });
  const resultLine = result.classification === 'ok' ? 'ok' : result.classification;
  ctx.ledger.spawnUsage({ agent: 'sdd-implementer', role: label, result: resultLine, phase: 'implementation', round: String(round) });

  // 7. The ending, written as `merge fix round <k> end: <ending>`.
  if (result.classification !== 'ok') {
    const kind = result.classification === 'usage-limit' ? 'usage-limit' : 'ended';
    return end(kind, `step ${result.classification}`);
  }
  const report = (result.structuredOutput ?? {}) as ImplementerReport;
  const infra = flagText('INFRA', report.flag, result.resultText);
  if (infra) {
    const seen = new Set<number>();
    for (const b of checks) {
      const rid = b.check!.runId;
      if (rid === undefined || seen.has(rid)) continue;
      seen.add(rid);
      await runCommand(ghBin(), ['run', 'rerun', String(rid), '--failed'], ctx.worktree);
    }
    return end('rechecked', `infra: ${infra}`);
  }
  const designDefect = flagText('DESIGN-DEFECT', report.flag, result.resultText);
  if (designDefect) return end('ended', `design-defect: ${designDefect}`);
  const escalate = flagText('ESCALATE', report.flag, result.resultText);
  if (escalate) return end('ended', `escalate: ${escalate}`);

  const after = git(ctx.worktree, ['rev-parse', 'HEAD']);
  if (after === before) return end('ended', 'no commit');
  if (!isAncestor(ctx.worktree, before, after)) return end('ended', 'history rewritten; not pushed');

  const push = await runCommand('git', ['push', 'origin', 'HEAD'], ctx.worktree);
  if (push.code === 0) return end('pushed', `pushed ${after.slice(0, 7)}`);
  const line = (push.stderr || push.stdout).split('\n').find((l) => l.trim().length > 0) ?? 'push failed';
  return end('ended', `push failed: ${line.trim()}`);
}
