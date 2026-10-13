// src/controller/runs.ts
//
// T6 of the controller (docs/controller-tasks.md "T6 `runs`", design §5
// "Between phases", §6, §8, §9, §13). The per-run driver: resolve the roots and
// the worktree, route from the spec store state with `harness orient`'s logic,
// run a document phase in-process (T5) or spawn today's supervisor for the other
// phases, turn a DRAFT retro plan into a `retro-plan` wait and its answer into an
// APPROVED plan, and carry the run to `done`, pausing on a usage window and
// retrying or escalating a failed step. The scheduler, the queue, crash recovery
// and the controller lock live in `controller.ts`; this module is the run logic
// those drive, plus the cancel/discard git+gh surface and the `controller-runs`
// wire shape.
//
// No model runs in this code path; the only model is the `claude` a step or the
// supervisor spawn starts. The routing, the retro-plan parser and the plan
// writer are deterministic code (the memory rule: mechanics in code, LLM only for
// judgement and prose).
import { spawn, execFileSync } from 'child_process';
import {
  existsSync, readFileSync, createWriteStream, mkdirSync, readdirSync, writeFileSync, renameSync,
  statSync,
} from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import {
  SPEC_WORKFLOW_WORKSPACE_ENV, SPEC_WORKFLOW_SHARED_ROOT_ENV, scrubbedGitEnv,
} from '../core/git-utils.js';
import { PathUtils } from '../core/path-utils.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';
import { deriveDocumentApprovalStates } from '../core/approval-records.js';
import { parseJsonl } from '../watch/ledger.js';
import { removePointerLine } from '../dashboard/harness/state-files.js';
import {
  type RunRecord, type RunStatus, type TokenTotals, writeRun, readRun, listRuns, listWaits,
  processStartTime, isProcessAlive,
} from './state.js';
import { openRunLedger, type RunLedger } from './ledger.js';
import type { ControllerActivity } from './activity.js';
import { createWait, type ControllerWaitRecord } from './waits.js';
import {
  runMergeStage, findPullRequest, MERGE_POLL_INTERVAL_MS, type MergeRules,
} from './merge.js';
import {
  runDocumentPhase, NO_OP_GATES,
  type DocumentPhase, type DocumentGates, type DocumentPhaseContext, type DocumentPhaseOutcome,
} from './phases/document.js';
import type { RateLimitWindows } from './step.js';

/**
 * Emits `change` with a `RunRecord` after every status change, so the dashboard
 * server rebroadcasts the `controller-runs` topic the way it rebroadcasts
 * `controller-waits` (one shared emitter for the one in-process controller).
 */
export const runEvents = new EventEmitter();

// ---------------------------------------------------------------------------
// Routing (design §5 "Between phases"). A function of the spec store state, the
// same inputs `harness orient` reads: the approval records, `tasks.md` and the
// retro plan's `Status:` line. First match wins.
// ---------------------------------------------------------------------------

export type RunDecision =
  | { kind: 'document'; phase: DocumentPhase }
  | { kind: 'supervisor'; phase: 'implementation' | 'closeout' }
  | { kind: 'retro-plan' }
  | { kind: 'done' };

/** The `Status:` word of `retrospective-plan.md`, or `undefined` when absent. */
function planStatus(specDir: string): 'DRAFT' | 'APPROVED' | 'CLOSED' | undefined {
  let text: string;
  try {
    text = readFileSync(join(specDir, 'retrospective-plan.md'), 'utf-8');
  } catch {
    return undefined;
  }
  const m = text.match(/^Status:\s*([A-Za-z]+)/m);
  const word = m?.[1]?.toUpperCase();
  return word === 'DRAFT' || word === 'APPROVED' || word === 'CLOSED' ? word : undefined;
}

/** Task progress from `tasks.md`, or zero counts when it is absent/unreadable. */
function taskProgress(specDir: string): { completed: number; inProgress: number; open: number } {
  try {
    const parsed = parseTasksFromMarkdown(readFileSync(join(specDir, 'tasks.md'), 'utf-8'));
    return {
      completed: parsed.summary.completed,
      inProgress: parsed.summary.inProgress,
      open: parsed.summary.pending,
    };
  } catch {
    return { completed: 0, inProgress: 0, open: 0 };
  }
}

/**
 * Route one spec from its spec store state. `specStoreRoot` is the project root
 * that holds `.spec-workflow`.
 */
export async function routeRun(specStoreRoot: string, spec: string): Promise<RunDecision> {
  const specDir = PathUtils.getSpecPath(specStoreRoot, spec);
  const approvals = await deriveDocumentApprovalStates(specStoreRoot, spec);

  if (!approvals.requirements.approved) return { kind: 'document', phase: 'requirements' };
  if (!approvals.design.approved) return { kind: 'document', phase: 'design' };

  if (!approvals.tasks.approved) {
    // The "implementation began under the old convention" exception (sdd-continue
    // step 3 rule 6): treat tasks as approved once a task has run.
    const tp = taskProgress(specDir);
    if (tp.completed === 0 && tp.inProgress === 0) return { kind: 'document', phase: 'tasks' };
  }

  const status = planStatus(specDir);
  if (status === 'CLOSED') return { kind: 'done' };
  if (status === 'APPROVED') return { kind: 'supervisor', phase: 'closeout' };
  if (status === 'DRAFT' || existsSync(join(specDir, 'retrospective-proposals.md'))) {
    return { kind: 'retro-plan' };
  }
  return { kind: 'supervisor', phase: 'implementation' };
}

/** A short fingerprint of a spec's routable state, to detect a no-progress step. */
function routeSignature(specStoreRoot: string, spec: string): string {
  const specDir = PathUtils.getSpecPath(specStoreRoot, spec);
  const tp = taskProgress(specDir);
  return [
    planStatus(specDir) ?? 'none',
    existsSync(join(specDir, 'retrospective-proposals.md')) ? 'prop' : '-',
    `${tp.completed}/${tp.inProgress}/${tp.open}`,
  ].join(':');
}

// ---------------------------------------------------------------------------
// The retro-plan parser and the APPROVED plan writer. The supervisor's
// retrospective stops headless at a DRAFT plan (sdd-continue step 5); the
// controller turns `retrospective-proposals.md` into a `retro-plan` wait and its
// answers into `retrospective-plan.md` `Status: APPROVED` (sdd-retrospective
// references/formats.md). The parser is deliberately small.
// ---------------------------------------------------------------------------

export interface ParsedProposal {
  /** `P<n>` or `G<n>`. */
  id: string;
  /** The verbatim bullet block (written into the plan when approved). */
  block: string;
  /** The `DECISION NEEDED: yes` question, when present. */
  question?: string;
  /** The options parsed off the question line, when present. */
  options?: string[];
}

/**
 * Parse `retrospective-proposals.md` into its `- **P<n>`/`- **G<n>` blocks under
 * the `## Proposals` and `## Graduation candidates` headings, keeping each block
 * verbatim and reading its `DECISION NEEDED: yes` question and options (the
 * "DECISION NEEDED questions, then the proposals as a ticked list" sheet described
 * in the dashboard-gates decomposition entry).
 */
export function parseProposals(proposalsMd: string): ParsedProposal[] {
  const lines = proposalsMd.split('\n');
  const out: ParsedProposal[] = [];
  let inSection = false;
  let current: { id: string; lines: string[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    const block = current.lines.join('\n').replace(/\s+$/, '');
    const proposal: ParsedProposal = { id: current.id, block };
    const dn = block.match(/DECISION NEEDED:\s*yes\.?\s*(.*)/i);
    if (dn && dn[1].trim()) {
      const rest = dn[1].trim();
      const opt = rest.match(/Options?:\s*(.+?)(?:\.\s*(?:Recommend|Recommendation).*)?$/i);
      if (opt) {
        proposal.question = rest.slice(0, rest.toLowerCase().indexOf('option')).trim() || rest;
        proposal.options = opt[1].split(/\s*\|\s*|\s*,\s*/).map((o) => o.trim()).filter(Boolean);
      } else {
        proposal.question = rest;
      }
    }
    out.push(proposal);
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      flush();
      const title = heading[1].trim();
      inSection = title === 'Proposals' || title === 'Graduation candidates';
      continue;
    }
    const item = line.match(/^- \*\*(P\d+|G\d+)/);
    if (inSection && item) {
      flush();
      current = { id: item[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return out;
}

/**
 * Build a `retro-plan` wait's questions from the parsed proposals: one decision
 * question per `DECISION NEEDED: yes` proposal (id = the proposal id), then one
 * `proposal:<i>` approve/drop toggle per proposal, ticked (recommended `approve`).
 * T6 writes the plan from these answers (answers are question ids plus
 * `proposal:<i>` ⇒ approve/drop, controller-tasks.md T4).
 */
function proposalWaitQuestions(proposals: ParsedProposal[]): ControllerWaitRecord['questions'] {
  const questions: ControllerWaitRecord['questions'] = [];
  proposals.forEach((p) => {
    if (p.question) {
      questions.push({
        id: p.id,
        text: p.question,
        options: p.options,
        free: !p.options || p.options.length === 0,
        recommended: p.options?.[0],
      });
    }
  });
  proposals.forEach((p, i) => {
    questions.push({
      id: `proposal:${i}`,
      text: `Approve ${p.id}?`,
      options: ['approve', 'drop'],
      recommended: 'approve',
    });
  });
  return questions;
}

/** A proposal is dropped only when its toggle answer is an explicit "drop". */
function isDropped(value: string | undefined): boolean {
  return (value ?? 'approve').trim().toLowerCase() === 'drop';
}

/**
 * Render `retrospective-plan.md` as `Status: APPROVED` from a `retro-plan` wait's
 * answers, in the sdd-retrospective skill's format (references/formats.md): the
 * approved proposal blocks verbatim under `## Approved proposals`, each decision
 * under `## Decisions`, and the dropped proposals under `## Rejected proposals`.
 */
export function buildRetroPlanMarkdown(
  spec: string, proposals: ParsedProposal[], answers: Record<string, string>, date: string,
): string {
  const approved: ParsedProposal[] = [];
  const dropped: ParsedProposal[] = [];
  proposals.forEach((p, i) => {
    (isDropped(answers[`proposal:${i}`]) ? dropped : approved).push(p);
  });

  const out: string[] = [`# Retrospective plan — ${spec}`, '', 'Status: APPROVED', `Date: ${date}`, ''];
  out.push('## Approved proposals', '');
  out.push(approved.length ? approved.map((p) => p.block).join('\n\n') : 'None.', '');
  out.push('## Decisions', '');
  const decisions = proposals.filter((p) => p.question);
  out.push(
    decisions.length
      ? decisions.map((p) => `- ${p.id}: ${p.question} → ${answers[p.id] ?? 'no answer'}`).join('\n')
      : 'None.',
    '',
  );
  out.push('## Rejected proposals', '');
  out.push(dropped.length ? dropped.map((p) => `- ${p.id}: dropped at retro-plan.`).join('\n') : 'None.', '');
  return out.join('\n') + '\n';
}

/**
 * Write the APPROVED plan from an answered `retro-plan` wait and its stored
 * proposal blocks (`createWait` kept them). Commits are left to the close-out
 * supervisor; this only writes the file so routing moves to close-out.
 */
export function writeApprovedRetroPlan(
  wait: ControllerWaitRecord, now: () => Date,
): void {
  const proposals = (wait.proposals ?? []).map((block) => {
    const id = block.match(/\*\*(P\d+|G\d+)/)?.[1] ?? 'P?';
    const parsed = parseProposals(`## Proposals\n${block}\n`)[0];
    return parsed ?? { id, block };
  });
  const answers: Record<string, string> = {};
  for (const [qid, a] of Object.entries(wait.answer ?? {})) answers[qid] = a.value;
  const md = buildRetroPlanMarkdown(wait.spec, proposals, answers, now().toISOString().slice(0, 10));
  writeFileSync(join(wait.specDir, 'retrospective-plan.md'), md, 'utf-8');
}

// ---------------------------------------------------------------------------
// The driver's dependency surface. The controller (`controller.ts`) implements
// it; a test builds a minimal one. Keeping it an interface lets `runOnce` be the
// pure run logic and the controller own the lock, queue and scheduler.
// ---------------------------------------------------------------------------

export interface RunDeps {
  gates: DocumentGates;
  now(): Date;
  /** The project's merge rules for the merge stage (design §10, T7). */
  mergeRules(run: RunRecord): MergeRules;
  /** The re-check delay while a merge is `not-ready` (ms); default `MERGE_POLL_INTERVAL_MS`. */
  mergePollMs?: number;
  /** `--mcp-config` for every step: the spec-workflow server for this project. */
  mcpConfigFor(run: RunRecord): string | Record<string, unknown> | undefined;
  /** Resolve (and create) the run's worktree and branch. */
  ensureWorktree(run: RunRecord): Promise<{ worktree: string; branch: string }>;
  /** The per-run token cap (W), or `undefined` for no cap. */
  tokenCap(run: RunRecord): number | undefined;
  /** Is a usage window above the threshold now? `resumeAt` is its ISO reset. */
  windowBlock(): { blocked: boolean; resumeAt?: string };
  /** Persist the latest windows from a step or the supervisor stream. */
  onRateLimit(windows: RateLimitWindows): void;
  /** Forward a step's live tool activity for the Run page's "Live now" line. */
  onActivity?(activity: ControllerActivity): void;
  /** The `claude` binary (overridable so tests swap in the stub). */
  claudeBin(): string;
  /** The active-run pointer file the supervisor's hook still needs. */
  pointerFile(): string;
  /** Has the operator cancelled this run? Checked between steps. */
  isCancelled(runId: string): boolean;
  /** Record an in-flight supervisor step so cancel/crash-recovery can find it. */
  setInFlight(pid: number, startTime: number): void;
}

/**
 * Wrap `deps.onActivity` as the document loop's `onStepActivity`: the loop
 * supplies the step id, role and tool; this stamps the run id and forwards it as
 * one {@link ControllerActivity}. Returns `undefined` when no sink is wired.
 */
function stepActivityForwarder(
  deps: RunDeps, runId: string,
): DocumentPhaseContext['onStepActivity'] {
  const sink = deps.onActivity;
  if (!sink) return undefined;
  return (e) => sink({ runId, stepId: e.stepId, role: e.role, tool: e.tool, inputSummary: e.inputSummary, ts: e.ts });
}

// ---------------------------------------------------------------------------
// Ledger helpers.
// ---------------------------------------------------------------------------

function ledgerPath(specDir: string): string {
  return join(specDir, 'harness-events.jsonl');
}

/** Has this run's ledger already carried a `run.start`? */
function runStarted(specDir: string, runId: string): boolean {
  try {
    const events = parseJsonl<{ type?: string; run?: string }>(readFileSync(ledgerPath(specDir), 'utf-8'));
    return events.some((e) => e.type === 'run.start' && e.run === runId);
  } catch {
    return false;
  }
}

/** The run's token totals so far, summed from its `spawn.end` rows. */
function runTokens(specDir: string, runId: string): TokenTotals {
  const totals: TokenTotals = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
  try {
    const events = parseJsonl<Record<string, string>>(readFileSync(ledgerPath(specDir), 'utf-8'));
    const add = (v: string | undefined): number => (v && v !== 'unknown' ? Number(v) || 0 : 0);
    for (const e of events) {
      if (e.type === 'spawn.end' && e.run === runId) {
        totals.input += add(e.input);
        totals.output += add(e.output);
        totals.cacheWrite += add(e.cacheWrite);
        totals.cacheRead += add(e.cacheRead);
      }
    }
  } catch {
    // No ledger yet: zero.
  }
  return totals;
}

/** Total W (all four token kinds) of a run's totals. */
function totalW(t: TokenTotals): number {
  return t.input + t.output + t.cacheWrite + t.cacheRead;
}

// ---------------------------------------------------------------------------
// The supervisor step (design §6). Implementation and close-out run today's
// supervisor unchanged: one headless `claude -p "continue the sdd process"` per
// phase, with `--permission-mode auto` and the launcher's environment (it must be
// the subscription session the skills expect). `runStep` is not reused: it hard-
// codes the "Read and execute the instructions in <brief>" prompt and requires a
// role agent file (`loadRole`), neither of which fits the supervisor (its own
// skill decides, role body none). `launcher.spawnRun` is private and bound to the
// launcher's records/pointer/liveness machinery, so a dedicated spawn that reuses
// the launcher's env conventions is cleaner and keeps step.ts and launcher.ts
// unedited.
// ---------------------------------------------------------------------------

export const SUPERVISOR_PROMPT = 'continue the sdd process';

export interface SupervisorResult {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  /** `ok`, `usage-limit` (a rejecting rate_limit_event or a limit result), or `error`. */
  classification: 'ok' | 'usage-limit' | 'error';
}

interface SupervisorSpec {
  claudeBin: string;
  model: string;
  effort: string;
  worktree: string;
  specStoreRoot: string;
  runId: string;
  stepId: string;
  logPath: string;
  onRateLimit(windows: RateLimitWindows): void;
  onPid(pid: number, startTime: number): void;
}

/** Spawn the supervisor, parse its stream for the usage window, resolve on exit. */
function spawnSupervisor(spec: SupervisorSpec): Promise<SupervisorResult> {
  mkdirSync(dirname(spec.logPath), { recursive: true });
  const env: NodeJS.ProcessEnv = {
    ...scrubbedGitEnv(),
    [SPEC_WORKFLOW_WORKSPACE_ENV]: spec.worktree,
    [SPEC_WORKFLOW_SHARED_ROOT_ENV]: spec.specStoreRoot,
    SDD_RUN_ID: spec.runId,
    SDD_STEP_ID: spec.stepId,
  };
  const args = [
    '-p', SUPERVISOR_PROMPT,
    '--model', spec.model,
    '--effort', spec.effort,
    '--permission-mode', 'auto',
    '--output-format', 'stream-json', '--verbose',
  ];

  return new Promise<SupervisorResult>((resolvePromise) => {
    const log = createWriteStream(spec.logPath, { flags: 'a' });
    let limited = false;
    let buffer = '';
    let settled = false;

    const handleLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        return;
      }
      if (event.type === 'rate_limit_event') {
        const info = (event.rate_limit_info ?? {}) as Record<string, unknown>;
        const windows = (info.unifiedWindows ?? {}) as Record<string, unknown>;
        const win = (w: unknown): { utilization: number; resetsAt: number } => {
          const o = (w ?? {}) as Record<string, unknown>;
          return {
            utilization: typeof o.utilization === 'number' ? o.utilization : 0,
            resetsAt: typeof o.resetsAt === 'number' ? o.resetsAt : 0,
          };
        };
        const status = typeof info.status === 'string' ? info.status : 'unknown';
        if (status.length > 0 && !status.startsWith('allowed')) limited = true;
        spec.onRateLimit({
          status,
          overageStatus: typeof info.overageStatus === 'string' ? info.overageStatus : undefined,
          fiveHour: win(windows.five_hour),
          sevenDay: win(windows.seven_day),
        });
      } else if (event.type === 'result') {
        const subtype = typeof event.subtype === 'string' ? event.subtype : '';
        if (/usage|limit/i.test(subtype)) limited = true;
      }
    };

    const child = spawn(spec.claudeBin, args, {
      cwd: spec.worktree,
      detached: true,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const pid = child.pid;
    if (typeof pid === 'number') spec.onPid(pid, processStartTime(pid) ?? 0);

    child.stdout.on('data', (chunk: Buffer) => {
      log.write(chunk);
      buffer += chunk.toString('utf8');
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        handleLine(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
      }
    });
    child.stderr.on('data', (chunk: Buffer) => log.write(chunk));

    const finish = (exitCode: number | null, signal: NodeJS.Signals | null): void => {
      if (settled) return;
      settled = true;
      if (buffer.length > 0) handleLine(buffer);
      log.end();
      const classification: SupervisorResult['classification'] = limited
        ? 'usage-limit'
        : (exitCode === 0 ? 'ok' : 'error');
      resolvePromise({ exitCode, signal, classification });
    };

    child.on('error', (err) => {
      log.write(`supervisor spawn error: ${err.message}\n`);
      finish(null, null);
    });
    child.on('close', (code, signal) => finish(code, signal));
  });
}

// ---------------------------------------------------------------------------
// runOnce — drive one run until it parks (waiting/paused), finishes (done) or is
// cancelled/abandoned (design §5, §9, §13). Never throws for a step that merely
// fails; a failed step is a classified pause, retry or wait.
// ---------------------------------------------------------------------------

const RUN_FRESH_RETRY = 1; // one fresh retry for a non-usage step error (design §4).

async function save(deps: RunDeps, run: RunRecord, patch: Partial<RunRecord>): Promise<RunRecord> {
  const next: RunRecord = { ...run, ...patch, updated: deps.now().toISOString() };
  await writeRun(next);
  runEvents.emit('change', next);
  return next;
}

/** Park the run on the usage window or a usage-limit step (design §9). */
async function pause(deps: RunDeps, run: RunRecord, reason: string, resumeAt?: string): Promise<void> {
  await save(deps, run, { status: 'paused', pauseReason: reason, resumeAt, inFlight: undefined });
}

/** Open a wait and mark the run `waiting` (its answer resumes it). */
async function waitAnd(
  deps: RunDeps, run: RunRecord, ledger: RunLedger,
  kind: ControllerWaitRecord['kind'], specDir: string,
  questions: ControllerWaitRecord['questions'], proposals?: string[],
): Promise<void> {
  await createWait({
    kind, runId: run.id, projectId: run.project, spec: run.spec, specDir, questions, proposals,
  });
  await save(deps, run, { status: 'waiting', inFlight: undefined });
}

// ---------------------------------------------------------------------------
// The merge stage (design §6 "Between phases", §10; T7 `merge.ts`). After the
// implementation supervisor step opens the PR the loop merges it by rule before
// the retrospective starts (the retro reads the merged state). Runs once per
// run; `runMergeStage` (never a model) does the gh work and writes `pr.merged`.
// ---------------------------------------------------------------------------

/** What one pass of the merge stage tells `runOnce`. */
type MergeStepOutcome =
  | 'stop'    // the run parked (merging re-check, a merge wait, or an error wait)
  | 'merged'  // the PR is merged; re-route to the retrospective
  | 'none';   // the PR is already merged: re-route to the retrospective

/** Has this run already merged its PR (a `pr.merged` row on the ledger)? */
function hasMerged(specDir: string, runId: string): boolean {
  try {
    const events = parseJsonl<{ type?: string; run?: string }>(readFileSync(ledgerPath(specDir), 'utf-8'));
    return events.some((e) => e.type === 'pr.merged' && e.run === runId);
  } catch {
    return false;
  }
}

/** Is there a `merge` wait for this run (the ask-me-first path is in progress)? */
async function hasMergeWait(runId: string): Promise<boolean> {
  try {
    const waits = await listWaits();
    return waits.some((w) => w.kind === 'merge' && w.run === runId);
  } catch {
    return false;
  }
}

/** The next merge re-check time while `not-ready` (design §10: don't busy-wait). */
function nextMergeCheck(deps: RunDeps): string {
  return new Date(deps.now().getTime() + (deps.mergePollMs ?? MERGE_POLL_INTERVAL_MS)).toISOString();
}

/**
 * Run one pass of the merge stage. Finds the run's open PR (recording `run.pr`),
 * runs the merge rule, and maps its status to a run-status change: `not-ready` ⇒
 * status `merging` with a re-check time (the scheduler tick re-enters, no slot
 * busy-wait); `waiting` ⇒ the `merge` wait is open, status `waiting` (an answer
 * resumes the run); `merged` ⇒ `pr.merged` is already written, continue to the
 * retrospective; `failed` ⇒ an `error` wait with the reasons. No open PR when
 * the implementation reported complete ⇒ status `waiting` on an `error` wait and
 * `stop` (the branch was pushed but no PR was opened). Returns `none` only when
 * the PR is already merged (re-route to the retrospective).
 */
async function runMergeStageStep(
  deps: RunDeps, run: RunRecord, ledger: RunLedger, specDir: string,
): Promise<MergeStepOutcome> {
  if (hasMerged(specDir, run.id)) return 'none';

  const pr = await findPullRequest({ repoDir: run.codeRoot, branch: run.branch, number: run.pr });
  if (!pr) {
    // The implementation phase reported complete but no open PR exists for the
    // branch (probable cause: gh unauthenticated in the controller's
    // environment). Stop with an `error` wait rather than silently proceeding
    // to the retrospective (design §6, §10). The `merge` cursor makes a "retry"
    // re-enter the merge stage and find the hand-opened PR, instead of re-running
    // the implementation supervisor step.
    run = await save(deps, run, {
      cursor: { phase: run.phase ?? 'implementation', stepKind: 'merge', attempt: 1 },
    });
    await waitAnd(deps, run, ledger, 'error', specDir, [{
      id: 'merge',
      text: `The ${run.branch} branch was pushed but no pull request exists for it. `
        + "Probable cause: gh is unauthenticated in the controller's environment. "
        + 'Open the PR by hand then answer "Retry", or fix the service env file and "Retry".',
      options: ['retry', 'abandon'], recommended: 'retry',
    }]);
    return 'stop';
  }
  if (run.pr !== pr.number) run = await save(deps, run, { pr: pr.number });

  const result = await runMergeStage(run, {
    rules: deps.mergeRules(run),
    specDir,
    stepLogDir: stepLogDir(specDir, run.id),
    ledger,
    now: deps.now,
  });

  switch (result.status) {
    case 'merged':
      await save(deps, run, { status: 'running', pauseReason: undefined, resumeAt: undefined, inFlight: undefined });
      return 'merged';
    case 'not-ready':
      await save(deps, run, { status: 'merging', pauseReason: undefined, resumeAt: nextMergeCheck(deps), inFlight: undefined });
      return 'stop';
    case 'waiting':
      // `runMergeStage` opened (or reused) the `merge` wait; just park the run.
      await save(deps, run, { status: 'waiting', inFlight: undefined });
      return 'stop';
    case 'failed':
    default:
      await waitAnd(deps, run, ledger, 'error', specDir, [{
        id: 'merge',
        text: `Merge of PR #${result.number ?? run.pr ?? '?'} failed: ${result.reasons.join('; ')}. Retry or abandon.`,
        options: ['retry', 'abandon'], recommended: 'retry',
      }]);
      return 'stop';
  }
}

export async function runOnce(deps: RunDeps, runId: string): Promise<void> {
  let run = await readRun(runId);
  if (!run) return;

  // The merge stage may be mid-flight on this re-entry: a `merging` status (an
  // auto re-check after `not-ready`) or an open `merge` wait (the ask path just
  // answered). Resume it before routing, so the implementation supervisor step
  // is not re-run (design §6, §10).
  const specDirForResume = PathUtils.getSpecPath(run.specStore, run.spec);
  let resumingMerge = run.status === 'merging'
    || (!hasMerged(specDirForResume, run.id)
        && (run.cursor?.stepKind === 'merge' || (await hasMergeWait(run.id))));

  // Resolve the worktree once (reuse the launcher's `ensureWorktree`).
  if (!run.worktree) {
    const { worktree, branch } = await deps.ensureWorktree(run);
    run = await save(deps, run, { worktree, branch, status: 'running' });
  } else if (run.status !== 'running') {
    run = await save(deps, run, { status: 'running' });
  }

  const specStoreRoot = run.specStore;
  const specDir = PathUtils.getSpecPath(specStoreRoot, run.spec);
  const ledger = openRunLedger({ specDir, runId: run.id, spec: run.spec, now: deps.now });
  const mcpConfig = deps.mcpConfigFor(run);

  if (!runStarted(specDir, run.id)) {
    mkdirSync(specDir, { recursive: true });
    ledger.runStart({
      model: 'controller', setup: 'controller', headless: 'yes',
      specStore: specStoreRoot, codeRoot: run.worktree, worktree: run.worktree === run.codeRoot ? 'no' : 'yes',
    });
  }

  let lastSignature: string | null = null;

  for (;;) {
    run = (await readRun(runId)) ?? run;
    if (run.status === 'abandoned' || deps.isCancelled(runId)) return;

    // Resume a merge left mid-flight (merging re-check, or an answered merge wait).
    if (resumingMerge) {
      resumingMerge = false;
      const outcome = await runMergeStageStep(deps, run, ledger, specDir);
      run = (await readRun(runId)) ?? run;
      if (outcome === 'stop') return;
      if (outcome === 'merged') { lastSignature = null; continue; }
      // `none`: the PR is gone or already merged — fall through to routing.
    }

    // The per-run token cap (design §9): at the cap, stop and write an `error` wait.
    const cap = deps.tokenCap(run);
    const tokens = runTokens(specDir, run.id);
    run = await save(deps, run, { tokens });
    const w = totalW(tokens);
    if (cap !== undefined && w >= cap) {
      await waitAnd(deps, run, ledger, 'error', specDir, [{
        id: 'cap', text: `This run used ${w} W, at or over its cap of ${cap}. Raise the cap or abandon.`,
        options: ['retry', 'abandon'], recommended: 'abandon',
      }]);
      return;
    }

    // Refuse to start a step while a usage window is over the threshold (design §9).
    const window = deps.windowBlock();
    if (window.blocked) {
      await pause(deps, run, 'usage-window', window.resumeAt);
      return;
    }

    const decision = await routeRun(specStoreRoot, run.spec);

    if (decision.kind === 'done') {
      ledger.runEnd('done');
      await save(deps, run, { status: 'done', phase: undefined, inFlight: undefined });
      return;
    }

    if (decision.kind === 'retro-plan') {
      let proposals: ParsedProposal[] = [];
      try {
        proposals = parseProposals(readFileSync(join(specDir, 'retrospective-proposals.md'), 'utf-8'));
      } catch {
        proposals = [];
      }
      run = await save(deps, run, { phase: 'retrospective' });
      await waitAnd(
        deps, run, ledger, 'retro-plan', specDir,
        proposalWaitQuestions(proposals), proposals.map((p) => p.block),
      );
      return;
    }

    if (decision.kind === 'document') {
      run = await save(deps, run, { phase: decision.phase, cursor: { phase: decision.phase, stepKind: 'document', attempt: 1 } });
      const ctx: DocumentPhaseContext = {
        run, phase: decision.phase, specStoreRoot, specDir, codeRoot: run.worktree,
        ledger, stepLogDir: stepLogDir(specDir, run.id),
        mcpConfig, gates: deps.gates ?? NO_OP_GATES,
        onRateLimit: deps.onRateLimit, onStepActivity: stepActivityForwarder(deps, run.id),
        now: deps.now,
      };
      const outcome = await runDocumentPhase(ctx);
      const handled = await handleDocumentOutcome(deps, run, ledger, specDir, decision.phase, outcome);
      if (handled === 'stop') return;
      continue; // approved ⇒ re-route
    }

    // decision.kind === 'supervisor' (implementation or close-out).
    const signature = routeSignature(specStoreRoot, run.spec);
    const outcome = await runSupervisorStep(deps, run, ledger, specDir, decision.phase);
    run = (await readRun(runId)) ?? run;
    if (outcome === 'stop') return;
    if (outcome === 'retry') continue; // fresh retry: re-route and re-run the supervisor

    // `outcome === 'complete'`: the supervisor reported the phase done.
    // Implementation ends at the pull request (design §6): merge it by rule
    // before the retrospective starts (the retro reads the merged state). A
    // completed implementation with no open PR is an `error` wait, not a silent
    // skip to the retro (`runMergeStageStep` returns `stop`).
    if (decision.phase === 'implementation') {
      const merge = await runMergeStageStep(deps, run, ledger, specDir);
      run = (await readRun(runId)) ?? run;
      if (merge === 'stop') return;
      if (merge === 'merged') { lastSignature = null; continue; }
      // `none`: the PR is already merged — fall through and re-route to the retro.
    }

    // No-progress guard: a supervisor step that exits cleanly but leaves the
    // routable state unchanged would loop forever; escalate instead.
    const after = routeSignature(specStoreRoot, run.spec);
    if (after === signature && signature === lastSignature) {
      await waitAnd(deps, run, ledger, 'error', specDir, [{
        id: 'no-progress',
        text: `The ${decision.phase} supervisor step made no progress twice. Retry or abandon.`,
        options: ['retry', 'abandon'], recommended: 'abandon',
      }]);
      return;
    }
    lastSignature = signature;
  }
}

/** Map a document-phase outcome to a run-status change. Returns `stop` or `go`. */
async function handleDocumentOutcome(
  deps: RunDeps, run: RunRecord, ledger: RunLedger, specDir: string,
  phase: DocumentPhase, outcome: DocumentPhaseOutcome,
): Promise<'stop' | 'go'> {
  if (outcome.result === 'approved') return 'go';
  if (outcome.result === 'waiting') {
    // T5b's gate A/B already wrote the wait; the controller only parks the run.
    await save(deps, run, { status: 'waiting', inFlight: undefined });
    return 'stop';
  }
  if (outcome.result === 'escalate') {
    await waitAnd(deps, run, ledger, 'escalation', specDir, [{
      id: 'escalation', text: outcome.reason ?? `${phase} escalated`, free: true,
    }]);
    return 'stop';
  }
  // outcome.result === 'error'.
  if (outcome.reason === 'usage-limit') {
    const window = deps.windowBlock();
    await pause(deps, run, 'usage-limit', window.resumeAt ?? fifteenMinutes(deps));
    return 'stop';
  }
  // One fresh retry, then an `error` wait (design §4).
  const attempt = run.cursor?.attempt ?? 1;
  if (attempt <= RUN_FRESH_RETRY) {
    await save(deps, run, { cursor: { phase, stepKind: 'document', attempt: attempt + 1 } });
    const retry = await runDocumentPhase({
      run, phase, specStoreRoot: run.specStore, specDir, codeRoot: run.worktree,
      ledger, stepLogDir: stepLogDir(specDir, run.id),
      mcpConfig: deps.mcpConfigFor(run), gates: deps.gates ?? NO_OP_GATES,
      onRateLimit: deps.onRateLimit, onStepActivity: stepActivityForwarder(deps, run.id),
      now: deps.now,
    });
    if (retry.result === 'approved') return 'go';
    if (retry.result === 'waiting') { await save(deps, run, { status: 'waiting', inFlight: undefined }); return 'stop'; }
    if (retry.result === 'error' && retry.reason === 'usage-limit') {
      await pause(deps, run, 'usage-limit', deps.windowBlock().resumeAt ?? fifteenMinutes(deps));
      return 'stop';
    }
  }
  await waitAnd(deps, run, ledger, 'error', specDir, [{
    id: 'error', text: `${phase} failed: ${outcome.reason ?? 'unknown'}. Retry or abandon.`,
    options: ['retry', 'abandon'], recommended: 'retry',
  }]);
  return 'stop';
}

function fifteenMinutes(deps: RunDeps): string {
  return new Date(deps.now().getTime() + 15 * 60 * 1000).toISOString();
}

/** What one supervisor step tells `runOnce`. */
type SupervisorStepOutcome =
  | 'stop'      // the run parked (paused, cancelled, or an error wait)
  | 'retry'     // a fresh retry: re-route and re-run the supervisor once
  | 'complete'; // the phase reported done; re-route (implementation runs merge first)

/**
 * Run one supervisor step (implementation or close-out). Writes the pointer line
 * the hook needs, writes `harness-run.json` with `gates: record` and the saved
 * setup, spawns the supervisor, and removes the pointer line on exit.
 *
 * The controller writes no `phase.start`/`phase.end` rows here: the supervisor
 * owns the phase rows of a phase it runs (the implementation and close-out phase
 * skills write them), so writing them here would duplicate them. The controller
 * writes phase rows only for the phases it runs itself (the document loop).
 */
async function runSupervisorStep(
  deps: RunDeps, run: RunRecord, ledger: RunLedger, specDir: string,
  phase: 'implementation' | 'closeout',
): Promise<SupervisorStepOutcome> {
  const stepId = `supervisor-${phase}-${randomUUID().slice(0, 8)}`;
  const setup = readOrDefaultRunFile(run);
  writeRunFileWithRecordGates(run, setup);

  const pointer = deps.pointerFile();
  appendPointerLine(pointer, run.codeRoot, specDir, run.id);

  // Keep the attempt count only across retries of this same supervisor phase; a
  // fresh phase (arriving from a document cursor) starts at attempt 1.
  const prior = run.cursor;
  const attempt = prior?.stepKind === 'supervisor' && prior.phase === phase ? prior.attempt : 1;
  run = await save(deps, run, { phase, cursor: { phase, stepKind: 'supervisor', attempt } });

  let result: SupervisorResult;
  try {
    result = await spawnSupervisor({
      claudeBin: deps.claudeBin(),
      model: setup.supervisorModel,
      effort: 'high',
      worktree: run.worktree,
      specStoreRoot: run.specStore,
      runId: run.id,
      stepId,
      logPath: join(stepLogDir(specDir, run.id), `${stepId}.jsonl`),
      onRateLimit: deps.onRateLimit,
      onPid: (pid, startTime) => {
        deps.setInFlight(pid, startTime);
        void save(deps, run, { inFlight: { id: stepId, pid, startTime } });
      },
    });
  } finally {
    removePointerLineSafe(pointer, run.id);
  }

  run = (await readRun(run.id)) ?? run;
  await save(deps, run, { inFlight: undefined });

  if (deps.isCancelled(run.id) || run.status === 'abandoned') {
    return 'stop';
  }

  if (result.classification === 'usage-limit') {
    const window = deps.windowBlock();
    await pause(deps, run, 'usage-limit', window.resumeAt ?? fifteenMinutes(deps));
    return 'stop';
  }

  if (result.classification === 'error') {
    const attempt = run.cursor?.attempt ?? 1;
    if (attempt <= RUN_FRESH_RETRY) {
      await save(deps, run, { cursor: { phase, stepKind: 'supervisor', attempt: attempt + 1 } });
      return 'retry';
    }
    await waitAnd(deps, run, ledger, 'error', specDir, [{
      id: 'error', text: `${phase} supervisor exited ${result.exitCode}. Retry or abandon.`,
      options: ['retry', 'abandon'], recommended: 'retry',
    }]);
    return 'stop';
  }

  return 'complete';
}

// ---------------------------------------------------------------------------
// harness-run.json and the pointer line (the supervisor's hook still needs it).
// ---------------------------------------------------------------------------

interface SavedSetup {
  spec: string;
  supervisorModel: string;
  worktree: 'yes' | 'no';
  gates: 'block' | 'record';
  roles: Record<string, { model: string; provider: string }>;
}

const DEFAULT_SUPERVISOR_MODEL = 'claude-opus-5-5';

function readOrDefaultRunFile(run: RunRecord): SavedSetup {
  const path = join(PathUtils.getWorkflowRoot(run.specStore), 'harness-run.json');
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<SavedSetup>;
    if (parsed && parsed.spec === run.spec) {
      return {
        spec: run.spec,
        supervisorModel: parsed.supervisorModel || DEFAULT_SUPERVISOR_MODEL,
        worktree: run.worktree === run.codeRoot ? 'no' : 'yes',
        gates: 'record',
        roles: parsed.roles ?? {},
      };
    }
  } catch {
    // No saved file: synthesise a default below.
  }
  return {
    spec: run.spec, supervisorModel: DEFAULT_SUPERVISOR_MODEL,
    worktree: run.worktree === run.codeRoot ? 'no' : 'yes', gates: 'record', roles: {},
  };
}

/** Write `harness-run.json` with `gates: record` and the saved setup (atomic). */
function writeRunFileWithRecordGates(run: RunRecord, setup: SavedSetup): void {
  const workflowRoot = PathUtils.getWorkflowRoot(run.specStore);
  mkdirSync(workflowRoot, { recursive: true });
  const file = {
    spec: setup.spec, writtenAt: new Date().toISOString(), supervisorModel: setup.supervisorModel,
    worktree: setup.worktree, gates: 'record' as const, roles: setup.roles,
  };
  const path = join(workflowRoot, 'harness-run.json');
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(file, null, 2) + '\n');
  renameSync(tmp, path);
}

/** Append this run's `<main checkout>\t<spec dir>\t<run id>` pointer line. */
export function appendPointerLine(pointer: string, mainCheckout: string, specDir: string, runId: string): void {
  mkdirSync(dirname(pointer), { recursive: true });
  const line = `${mainCheckout}\t${specDir}\t${runId}\n`;
  let existing = '';
  try {
    existing = readFileSync(pointer, 'utf-8');
  } catch {
    existing = '';
  }
  if (existing.split('\n').some((l) => l.split('\t')[2] === runId)) return; // already present
  writeFileSync(pointer, existing + (existing && !existing.endsWith('\n') ? '\n' : '') + line);
}

function removePointerLineSafe(pointer: string, runId: string): void {
  try {
    removePointerLine(pointer, runId);
  } catch {
    // Best effort: the hook tolerates a stale line (it checks the spec dir exists).
  }
}

// ---------------------------------------------------------------------------
// Cancel and discard (design §13).
// ---------------------------------------------------------------------------

export interface CancelDeps {
  now(): Date;
  pointerFile(): string;
  ghBin(): string;
  graceMs?: number;
}

/**
 * Cancel a run: signal the in-flight supervisor step (SIGTERM, then SIGKILL after
 * the grace), remove the pointer line, mark the run `abandoned`, and keep the
 * worktree, branch and PR. A document step runs as the controller's own child and
 * ends with the controller; the loop stops once it returns.
 */
export async function cancelRun(deps: CancelDeps, runId: string): Promise<RunRecord | undefined> {
  const run = await readRun(runId);
  if (!run) return undefined;
  if (run.inFlight && isProcessAlive(run.inFlight.pid, run.inFlight.startTime)) {
    const pid = run.inFlight.pid;
    try { process.kill(-pid, 'SIGTERM'); } catch { try { process.kill(pid, 'SIGTERM'); } catch { /* gone */ } }
    const grace = deps.graceMs ?? 10000;
    const deadline = Date.now() + grace;
    while (isProcessAlive(run.inFlight.pid, run.inFlight.startTime)) {
      if (Date.now() >= deadline) {
        try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  removePointerLineSafe(deps.pointerFile(), runId);
  const next: RunRecord = { ...run, status: 'abandoned' as RunStatus, inFlight: undefined, updated: deps.now().toISOString() };
  await writeRun(next);
  runEvents.emit('change', next);
  return next;
}

/**
 * Discard a run: cancel it, then remove the worktree, delete the branch and close
 * the PR with `gh`. Each cleanup is best-effort; a failure is logged, not thrown.
 */
export async function discardRun(deps: CancelDeps, runId: string): Promise<RunRecord | undefined> {
  const run = await cancelRun(deps, runId);
  if (!run) return undefined;

  const git = (cwd: string, args: string[]): void => {
    try { execFileSync('git', args, { cwd, env: scrubbedGitEnv(), stdio: 'ignore' }); } catch { /* best effort */ }
  };
  // Remove the worktree only when it is a real worktree, not the main checkout.
  if (run.worktree && run.worktree !== run.codeRoot) {
    git(run.codeRoot, ['worktree', 'remove', '--force', run.worktree]);
  }
  if (run.branch && run.branch !== 'main' && run.branch !== 'master') {
    git(run.codeRoot, ['branch', '-D', run.branch]);
  }
  if (run.branch) {
    try {
      execFileSync(deps.ghBin(), ['pr', 'close', run.branch, '--delete-branch'], {
        cwd: run.codeRoot, env: process.env, stdio: 'ignore',
      });
    } catch { /* no PR, or gh unavailable: best effort */ }
  }
  return run;
}

// ---------------------------------------------------------------------------
// The `controller-runs` wire shape (design §17 keeps paths off the LAN).
// ---------------------------------------------------------------------------

export interface ControllerRunRow {
  id: string;
  project: string;
  spec: string;
  status: RunStatus;
  phase?: string;
  stepKind?: string;
  pauseReason?: string;
  resumeAt?: string;
  tokens: number;
  created: string;
  updated: string;
}

function toRow(run: RunRecord): ControllerRunRow {
  return {
    id: run.id, project: run.project, spec: run.spec, status: run.status,
    phase: run.phase, stepKind: run.cursor?.stepKind,
    pauseReason: run.pauseReason, resumeAt: run.resumeAt,
    tokens: run.tokens ? totalW(run.tokens) : 0, created: run.created, updated: run.updated,
  };
}

/** Every run as a path-free wire row, newest first (the GET route and WS payload). */
export async function listRunsForWire(): Promise<ControllerRunRow[]> {
  const runs = await listRuns();
  return runs.sort((a, b) => b.created.localeCompare(a.created)).map(toRow);
}

/** The step-log directory for a run (where supervisor/step streams are written). */
export function stepLogDir(specDir: string, runId: string): string {
  return join(dirname(ledgerPath(specDir)), 'controller-steps', runId);
}

// A readdir re-export kept local so the controller can scan step logs if needed.
export function listStepLogs(specDir: string, runId: string): string[] {
  try {
    return readdirSync(stepLogDir(specDir, runId));
  } catch {
    return [];
  }
}

/**
 * The last `tail` lines of a run's in-flight (or, with none, most recently
 * written) step stream log, as plain text (T10; the Run page's "Live now" log
 * tail). `null` when the run does not exist; `''` when it has no step log yet.
 * The in-flight step is `run.inFlight.id`; otherwise the newest `.jsonl` in the
 * run's step-log directory.
 */
export async function readRunLogTail(runId: string, tail: number): Promise<string | null> {
  const run = await readRun(runId);
  if (!run) return null;
  const specDir = PathUtils.getSpecPath(run.specStore, run.spec);
  const dir = stepLogDir(specDir, runId);

  let file: string | undefined;
  if (run.inFlight?.id) {
    const candidate = join(dir, `${run.inFlight.id}.jsonl`);
    if (existsSync(candidate)) file = candidate;
  }
  if (!file) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return ''; // no step-log directory yet
    }
    const logs = entries
      .filter((e) => e.endsWith('.jsonl'))
      .map((e) => ({ path: join(dir, e), mtime: safeMtime(join(dir, e)) }))
      .sort((a, b) => b.mtime - a.mtime);
    if (logs.length === 0) return '';
    file = logs[0].path;
  }

  let text: string;
  try {
    text = readFileSync(file, 'utf-8');
  } catch {
    return '';
  }
  const lines = text.split('\n').filter((l) => l.length > 0);
  const n = Number.isFinite(tail) && tail > 0 ? Math.floor(tail) : 50;
  return lines.slice(-n).join('\n');
}

function safeMtime(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}
