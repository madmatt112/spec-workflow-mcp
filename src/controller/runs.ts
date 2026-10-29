// src/controller/runs.ts
//
// T6 of the controller (docs/controller-tasks.md "T6 `runs`", design §5
// "Between phases", §6, §8, §9, §13). The per-run driver: resolve the roots and
// the worktree, route from the spec store state with `harness orient`'s logic,
// run every phase in-process (the document loop T5, implementation c2, the
// retrospective and close-out c3), turn the proposals into a `retro-plan` wait
// and its answer into an
// APPROVED plan, and carry the run to `done`, pausing on a usage window and
// retrying or escalating a failed step. The scheduler, the queue, crash recovery
// and the controller lock live in `controller.ts`; this module is the run logic
// those drive, plus the cancel/discard git+gh surface and the `controller-runs`
// wire shape.
//
// No model runs in this code path; the only model is the `claude` a step
// starts. The routing, the retro-plan parser and the plan writer are
// deterministic code (the memory rule: mechanics in code, LLM only for judgement
// and prose).
import { execFileSync } from 'child_process';
import {
  existsSync, readFileSync, mkdirSync, readdirSync, writeFileSync, statSync,
} from 'fs';
import { basename, join } from 'path';
import { EventEmitter } from 'events';
import { scrubbedGitEnv, defaultBranchIfOnIt } from '../core/git-utils.js';
import { PathUtils } from '../core/path-utils.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';
import { deriveDocumentApprovalStates } from '../core/approval-records.js';
import { parseJsonl } from '../watch/ledger.js';
import {
  type RunRecord, type RunStatus, type TokenTotals, type PrRead,
  writeRun, readRun, listRuns, listWaits,
  isProcessAlive, runStepsDir, withStoreLock, OPERATOR_PAUSE,
} from './state.js';
import { openRunLedger, commitSpecStore, pushSpecStore, type RunLedger } from './ledger.js';
import type { ControllerActivity } from './activity.js';
import { createWait, type ControllerWaitRecord } from './waits.js';
import {
  runMergeStage, findPullRequest, mergeByRule, closeoutMergeTarget, readMergeRules,
  MERGE_POLL_INTERVAL_MS, type MergeRules, type MergeStageResult,
} from './merge.js';
import { mergeFixHistory, mergeFixEligible, runMergeFixRound } from './merge-fix.js';
import {
  runDocumentPhase, NO_OP_GATES, gateBAnnotationPending,
  type DocumentPhase, type DocumentGates, type DocumentPhaseContext, type DocumentPhaseOutcome,
} from './phases/document.js';
import { runImplementationPhase, type ImplementationPhaseOutcome } from './phases/implementation.js';
import { runRetrospectivePhase, type RetrospectivePhaseOutcome } from './phases/retrospective.js';
import { runCloseoutPhase, type CloseoutPhaseOutcome } from './phases/closeout.js';
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
  | { kind: 'implementation' }
  | { kind: 'retrospective' }
  | { kind: 'closeout' }
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
  if (status === 'APPROVED') return { kind: 'closeout' };
  if (status === 'DRAFT' || existsSync(join(specDir, 'retrospective-proposals.md'))) {
    return { kind: 'retro-plan' };
  }
  if (implementationComplete(specDir)) return { kind: 'retrospective' };
  return { kind: 'implementation' };
}

/**
 * Is the implementation phase complete? No open or in-progress task, and the
 * ledger's newest implementation phase row is a `phase.end` with result
 * `complete` (the completion gate passed and nothing reopened the phase). The
 * same inputs the supervisor's step-3 rule 1 and `spec-status` read.
 */
export function implementationComplete(specDir: string): boolean {
  const tp = taskProgress(specDir);
  if (tp.open > 0 || tp.inProgress > 0) return false;
  let events: { type?: string; phase?: string; result?: string }[];
  try {
    events = parseJsonl(readFileSync(ledgerPath(specDir), 'utf-8'));
  } catch {
    return false;
  }
  const rows = events.filter((e) => e.phase === 'implementation' && (e.type === 'phase.start' || e.type === 'phase.end'));
  const last = rows[rows.length - 1];
  return !!last && last.type === 'phase.end' && last.result === 'complete';
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
  /** The bold `**P<n> (F<m>) — …**` title text, wrapped lines joined. */
  label: string;
  /** The block after the title: the proposal's prose (the disclosure body). */
  body: string;
  /** The `DECISION NEEDED: yes` question, joined across wrapped lines. */
  question?: string;
  /** The options read from the `- Option …` lines, when present. */
  options?: string[];
  /** The option marked `(recommended)`, when present. */
  recommended?: string;
}

/** True for a `- Option …` list item under a `DECISION NEEDED` block. */
function isOptionLine(line: string): boolean {
  return /^\s*-\s*Option\b/i.test(line);
}

/** Split a proposal block into its bold title and the prose that follows it. */
function splitProposalTitle(block: string): { label: string; body: string } {
  const m = block.match(/\*\*([\s\S]*?)\*\*/);
  if (!m) return { label: block.replace(/^-\s*/, '').trim(), body: '' };
  const label = m[1].replace(/\s+/g, ' ').trim();
  const body = block.slice((m.index ?? 0) + m[0].length).trim();
  return { label, body };
}

/**
 * Read the `DECISION NEEDED: yes` question and its options off a proposal's
 * lines. The question runs from after `DECISION NEEDED: yes.` to the first `?`,
 * wrapped lines joined with single spaces. Each following `- Option X
 * (recommended): …` line becomes an option (the text after the colon, its own
 * wrapped lines joined); the `(recommended)` marker sets `recommended`. A block
 * with no `- Option` lines falls back to the legacy inline `Options:` form, and
 * failing that stays free text.
 */
function parseDecision(lines: string[], proposal: ParsedProposal): void {
  const dn = lines.findIndex((l) => /DECISION NEEDED:\s*yes/i.test(l));
  if (dn < 0) return;

  let q = lines[dn].replace(/^.*?DECISION NEEDED:\s*yes\.?\s*/i, '');
  for (let i = dn; q.indexOf('?') < 0 && i + 1 < lines.length; i += 1) {
    const next = lines[i + 1];
    if (isOptionLine(next) || next.trim() === '') break;
    q += ' ' + next.trim();
  }
  const end = q.indexOf('?');
  const question = (end >= 0 ? q.slice(0, end + 1) : q).replace(/\s+/g, ' ').trim();
  if (question) proposal.question = question;

  const options: string[] = [];
  let recommended: string | undefined;
  let text: string | null = null;
  let isRec = false;
  const commit = (): void => {
    if (text === null) return;
    const t = text.replace(/\s+/g, ' ').trim();
    if (t) {
      options.push(t);
      if (isRec) recommended = t;
    }
    text = null;
    isRec = false;
  };
  for (let i = dn; i < lines.length; i += 1) {
    const m = lines[i].match(/^\s*-\s*Option\b[^:(]*(\(recommended\))?\s*:\s*(.*)$/i);
    if (m) {
      commit();
      isRec = Boolean(m[1]);
      text = m[2];
    } else if (text !== null) {
      if (lines[i].trim() === '') {
        commit();
        continue;
      }
      text += ' ' + lines[i].trim();
    }
  }
  commit();

  if (options.length > 0) {
    proposal.options = options;
    proposal.recommended = recommended;
    return;
  }
  // Legacy inline form: `… Options: a | b. Recommend a.`
  const inline = lines.slice(dn).join(' ').match(/Options?:\s*(.+?)(?:\.\s*Recommend\w*\b.*)?$/i);
  if (inline) {
    const opts = inline[1].split(/\s*\|\s*|\s*,\s*/).map((o) => o.trim()).filter(Boolean);
    if (opts.length > 0) proposal.options = opts;
  }
}

/**
 * Parse `retrospective-proposals.md` into its `- **P<n>`/`- **G<n>` blocks under
 * the `## Proposals` and `## Graduation candidates` headings, keeping each block
 * verbatim and reading its title, body, and `DECISION NEEDED: yes` question and
 * options (the "DECISION NEEDED questions, then the proposals as a ticked list"
 * sheet described in the dashboard-gates decomposition entry).
 */
export function parseProposals(proposalsMd: string): ParsedProposal[] {
  const lines = proposalsMd.split('\n');
  const out: ParsedProposal[] = [];
  let inSection = false;
  let current: { id: string; lines: string[] } | null = null;

  const flush = (): void => {
    if (!current) return;
    const block = current.lines.join('\n').replace(/\s+$/, '');
    const { label, body } = splitProposalTitle(block);
    const proposal: ParsedProposal = { id: current.id, block, label, body };
    parseDecision(current.lines, proposal);
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
export function proposalWaitQuestions(proposals: ParsedProposal[]): ControllerWaitRecord['questions'] {
  const questions: ControllerWaitRecord['questions'] = [];
  proposals.forEach((p) => {
    if (p.question) {
      questions.push({
        id: p.id,
        text: p.question,
        options: p.options,
        free: !p.options || p.options.length === 0,
        recommended: p.recommended ?? p.options?.[0],
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
  /** Has the operator cancelled this run? Checked between steps. */
  isCancelled(runId: string): boolean;
  /** Record an in-flight step process so cancel/crash-recovery can find it. */
  setInFlight(pid: number, startTime: number): void;
  /** Is the operator holding this run? Checked between steps. Absent means never held. */
  isPauseRequested?(runId: string): boolean;
}

/** `cancelled` first, then `operator` when held, then `usage-window`, else `null` (design C3). */
function stopReason(deps: RunDeps, runId: string): string | null {
  if (deps.isCancelled(runId)) return 'cancelled';
  if (deps.isPauseRequested?.(runId)) return 'operator';
  if (deps.windowBlock().blocked) return 'usage-window';
  return null;
}

/**
 * Read-modify-write one field set of a run: the record on disk may have moved
 * on (a cancel, a wait) since the caller read it, so never write a stale copy.
 */
async function patchRun(deps: RunDeps, runId: string, patch: Partial<RunRecord>): Promise<void> {
  const current = await readRun(runId);
  if (!current) return;
  const next: RunRecord = { ...current, ...patch, updated: deps.now().toISOString() };
  await writeRun(next);
  runEvents.emit('change', next);
}

/** The in-flight step record callbacks every in-code phase gets (design §8). */
function stepLifecycle(deps: RunDeps, runId: string): {
  onStepSpawn: (s: { id: string; pid: number; startTime: number }) => Promise<void>;
  onStepEnd: (id: string) => Promise<void>;
} {
  return {
    onStepSpawn: (s) => {
      deps.setInFlight(s.pid, s.startTime);
      return patchRun(deps, runId, { inFlight: { id: s.id, pid: s.pid, startTime: s.startTime } });
    },
    onStepEnd: () => patchRun(deps, runId, { inFlight: undefined }),
  };
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

/** Has the ledger a `run.end` row for this run (a retried run end must not write a second)? */
function runEnded(specDir: string, runId: string): boolean {
  try {
    const events = parseJsonl<{ type?: string; run?: string }>(readFileSync(ledgerPath(specDir), 'utf-8'));
    return events.some((e) => e.type === 'run.end' && e.run === runId);
  } catch {
    return false;
  }
}

/** Has this run merged the close-out PR `number` of `repoDir` (a `pr.merged` row carrying the repo)? */
function hasMergedPr(specDir: string, runId: string, repoDir: string, number: number): boolean {
  try {
    const events = parseJsonl<{ type?: string; run?: string; repo?: string; number?: string }>(readFileSync(ledgerPath(specDir), 'utf-8'));
    return events.some((e) => e.type === 'pr.merged' && e.run === runId && e.repo === basename(repoDir) && e.number === String(number));
  } catch {
    return false;
  }
}

/** This run's ledger rows as plain records (the merge-fix history read). */
function ledgerRows(specDir: string): Record<string, string>[] {
  try {
    return parseJsonl<Record<string, string>>(readFileSync(ledgerPath(specDir), 'utf-8'));
  } catch {
    return [];
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

/**
 * Park the run on the usage window or a usage-limit step (design §9). While
 * the operator holds the run, every pause becomes an operator pause with no
 * `resumeAt`, whatever `reason` and `resumeAt` the caller passed (design C3,
 * Requirement 2 AC 6).
 */
async function pause(deps: RunDeps, run: RunRecord, reason: string, resumeAt?: string): Promise<void> {
  const held = deps.isPauseRequested?.(run.id) === true;
  await save(deps, run, {
    status: 'paused',
    pauseReason: held ? OPERATOR_PAUSE : reason,
    resumeAt: held ? undefined : resumeAt,
    inFlight: undefined,
  });
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
    // The run's own PR's wait asks `merge`; a close-out PR's wait asks `merge:<repo>#<n>`
    // and is the done branch's business, not the implementation merge stage's.
    const waits = await listWaits();
    return waits.some((w) => w.kind === 'merge' && w.run === runId && w.questions.some((q) => q.id === 'merge'));
  } catch {
    return false;
  }
}

/** The next merge re-check time while `not-ready` (design §10: don't busy-wait). */
function nextMergeCheck(deps: RunDeps): string {
  return new Date(deps.now().getTime() + (deps.mergePollMs ?? MERGE_POLL_INTERVAL_MS)).toISOString();
}

/**
 * Fold one PR read into a run's reads (design D4): replace the entry with the
 * same `repo` and `number`, else append, then stable-sort the run's own PR
 * (`kind: 'run'`) first. `Array.prototype.sort` is stable, so reads of the
 * same kind keep their order.
 */
export function withPrRead(reads: PrRead[] | undefined, read: PrRead): PrRead[] {
  const kept = (reads ?? []).filter((r) => !(r.repo === read.repo && r.number === read.number));
  return [...kept, read].sort((a, b) => (a.kind === 'run' ? 0 : 1) - (b.kind === 'run' ? 0 : 1));
}

/**
 * Run one pass of the merge stage. Finds the run's open PR (recording `run.pr`),
 * runs the merge rule, and maps its status to a run-status change: `not-ready` ⇒
 * status `merging` with a re-check time (the scheduler tick re-enters, no slot
 * busy-wait); `blocked` ⇒ an `error` wait with the reasons (the PR fails the
 * rule and nothing is in flight, so no re-check); `waiting` ⇒ the `merge` wait is open, status `waiting` (an answer
 * resumes the run); `merged` ⇒ `pr.merged` is already written, continue to the
 * retrospective; `unreadable` ⇒ an `error` wait naming why `gh` could not read
 * the PR (no re-check: nothing changes by itself); `failed` ⇒ an `error` wait
 * with the reasons. No open PR when
 * the implementation reported complete ⇒ status `waiting` on an `error` wait and
 * `stop` (the branch was pushed but no PR was opened). Returns `none` only when
 * the PR is already merged (re-route to the retrospective).
 */
async function runMergeStageStep(
  deps: RunDeps, run: RunRecord, ledger: RunLedger, specDir: string,
): Promise<MergeStepOutcome> {
  if (hasMerged(specDir, run.id)) return 'none';

  // The implementation phase exits into the merge stage by a direct call that
  // bypasses the loop-top stop, so a held run is caught here first (design C3
  // point 4): park it on the merge cursor before `runMergeStage` can merge the
  // PR. This also covers the merge-resume re-entry, which reaches here unheld
  // only because the loop top already intercepted a held one.
  if (deps.isPauseRequested?.(run.id)) {
    run = await save(deps, run, {
      cursor: { phase: run.phase ?? 'implementation', stepKind: 'merge', attempt: 1 },
    });
    await pause(deps, run, OPERATOR_PAUSE);
    return 'stop';
  }

  // A run on the repository's default branch (a project without
  // `worktree-per-change: required`, so the work and the PR branch are the
  // default branch itself) has no PR by design: `pushAndOpenPr` already noted
  // "nothing pushed, no PR" and opened none. Skip the merge stage and route to
  // the retrospective, as when the PR is already merged. The branch is checked
  // in the worktree the work ran in (equal to `codeRoot` without a worktree),
  // the same directory `pushAndOpenPr` checks. The spec-store push at run end
  // already pushes the branch; nothing to push here.
  // An unset worktree would read the controller's own cwd: never skip then.
  const onDefault = run.worktree ? defaultBranchIfOnIt(run.worktree) : undefined;
  if (onDefault) {
    ledger.note(`merge: run on the default branch ${onDefault}; no PR, skipping the merge stage`);
    return 'none';
  }

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
    stepLogDir: stepLogDir(run.id),
    ledger,
    now: deps.now,
  });
  if (result.read) run = await save(deps, run, { prReads: withPrRead(run.prReads, result.read) });

  switch (result.status) {
    case 'merged':
      await save(deps, run, { status: 'running', pauseReason: undefined, resumeAt: undefined, inFlight: undefined });
      return 'merged';
    case 'not-ready':
      await save(deps, run, { status: 'merging', pauseReason: undefined, resumeAt: nextMergeCheck(deps), inFlight: undefined });
      return 'stop';
    case 'blocked': {
      // The PR fails the rule and nothing is in flight (a red check, a conflict,
      // an attribution trailer, a wrong head branch). When every reason is a red
      // check or a conflict and the cap has room, the run fixes its own PR before
      // it asks the operator (design C3); otherwise it opens the `error` wait as
      // before. The `merge` cursor makes a "retry" re-enter the merge stage and
      // read the same round count from the ledger.
      const { used, endings } = mergeFixHistory(ledgerRows(specDir), run.id);
      // Set before every wait and pause below, so a "retry" on the cap wait or a
      // resume after the window re-enters the merge stage, not the whole phase.
      run = await save(deps, run, {
        cursor: { phase: run.phase ?? 'implementation', stepKind: 'merge', attempt: 1 },
      });
      if (mergeFixEligible(result, used)) {
        // The merge resume path runs before `runOnce`'s own cancel, cap and
        // window checks, so guard the round here: a cancelled run stops, a full
        // cap opens the cap wait and a blocked window pauses, each with no round.
        if (deps.isCancelled(run.id)) return 'stop';
        if (deps.isPauseRequested?.(run.id)) {
          await pause(deps, run, OPERATOR_PAUSE);
          return 'stop';
        }
        const cap = deps.tokenCap(run);
        const w = totalW(runTokens(specDir, run.id));
        if (cap !== undefined && w >= cap) {
          await waitAnd(deps, run, ledger, 'error', specDir, [{
            id: 'cap', text: `This run used ${w} W, at or over its cap of ${cap}. Raise the cap or abandon.`,
            options: ['retry', 'abandon'], recommended: 'abandon',
          }]);
          return 'stop';
        }
        const window = deps.windowBlock();
        if (window.blocked) {
          await pause(deps, run, 'usage-window', window.resumeAt);
          return 'stop';
        }
        const outcome = await runMergeFixRound({
          run, worktree: run.worktree ?? run.codeRoot, specStoreRoot: run.specStore, specDir, ledger,
          stepLogDir: stepLogDir(run.id), mcpConfig: deps.mcpConfigFor(run),
          onRateLimit: deps.onRateLimit, onStepActivity: stepActivityForwarder(deps, run.id),
          ...stepLifecycle(deps, run.id),
        }, {
          round: used + 1, pr: result.number ?? run.pr ?? 0,
          blocking: result.blocking ?? [], base: result.base ?? 'main',
        });
        if (outcome.kind === 'usage-limit') {
          await pause(deps, run, 'usage-limit', deps.windowBlock().resumeAt ?? fifteenMinutes(deps));
          return 'stop';
        }
        // The round ran (or the round could not start past its branch guard): a
        // re-check picks up the new state (a pushed fix, a rerun check).
        await save(deps, run, { status: 'merging', pauseReason: undefined, resumeAt: nextMergeCheck(deps), inFlight: undefined });
        return 'stop';
      }
      // Not eligible: the `error` wait as before, naming any rounds that ran.
      const ran = used > 0
        ? ` ${used} fix round(s) ran: ${endings.map((e, i) => `round ${i + 1} ${e}`).join('; ')}.`
        : '';
      await waitAnd(deps, run, ledger, 'error', specDir, [{
        id: 'merge',
        text: `PR #${result.number ?? run.pr ?? '?'} cannot merge by rule and nothing is in flight: ${result.reasons.join('; ')}.${ran} `
          + 'Fix the PR (rewrite the commit, resolve the conflict, fix the check), then answer "Retry", or abandon.',
        options: ['retry', 'abandon'], recommended: 'retry',
      }]);
      return 'stop';
    }
    case 'waiting':
      // `runMergeStage` opened (or reused) the `merge` wait; just park the run.
      await save(deps, run, { status: 'waiting', inFlight: undefined });
      return 'stop';
    case 'unreadable':
      // `gh` could not read the PR at all; polling would never change that. The
      // `merge` cursor makes a "retry" re-enter the merge stage.
      run = await save(deps, run, {
        cursor: { phase: run.phase ?? 'implementation', stepKind: 'merge', attempt: 1 },
      });
      await waitAnd(deps, run, ledger, 'error', specDir, [{
        id: 'merge',
        text: `The state of PR #${result.number ?? run.pr ?? '?'} could not be read: ${result.reasons.join('; ')}. `
          + "Probable cause: the controller's gh token cannot read checks (a fine-grained token needs Checks: read). "
          + 'Fix the token, or merge the PR by hand, then answer "Retry".',
        options: ['retry', 'abandon'], recommended: 'retry',
      }]);
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

  for (;;) {
    run = (await readRun(runId)) ?? run;
    if (run.status === 'abandoned' || deps.isCancelled(runId)) return;

    // The loop-top stop (design C3 point 1): a held run parks before the merge
    // resume, the cap and the window check, covering every routed phase and a
    // run re-driven after a restart. A merge left mid-flight saves the merge
    // cursor first (C5), so the resume lands back in the merge stage.
    if (deps.isPauseRequested?.(runId)) {
      if (resumingMerge) {
        run = await save(deps, run, {
          cursor: { phase: run.phase ?? 'implementation', stepKind: 'merge', attempt: 1 },
        });
      }
      await pause(deps, run, OPERATOR_PAUSE);
      return;
    }

    // Resume a merge left mid-flight (merging re-check, or an answered merge wait).
    if (resumingMerge) {
      resumingMerge = false;
      const outcome = await runMergeStageStep(deps, run, ledger, specDir);
      run = (await readRun(runId)) ?? run;
      if (outcome === 'stop') return;
      if (outcome === 'merged') continue;
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

    let decision = await routeRun(specStoreRoot, run.spec);
    // A gate-B annotation answered before any task ran sends the run back to the
    // tasks phase for its reviser round (the tasks document is already approved,
    // so routeRun alone never returns there).
    if (decision.kind === 'implementation') {
      const tp = taskProgress(specDir);
      if (tp.completed === 0 && tp.inProgress === 0
        && await gateBAnnotationPending(deps.gates ?? NO_OP_GATES, run, specStoreRoot, specDir)) {
        decision = { kind: 'document', phase: 'tasks' };
      }
    }

    if (decision.kind === 'done') {
      // The close-out's PRs merge by rule before the run ends (T14); a stuck one
      // parks the run on a wait and "Retry" comes back here through routing.
      const pending = (run.closeoutPrs ?? []).filter((p) => typeof p.number === 'number' && !hasMergedPr(specDir, runId, p.repoDir, p.number));
      if (pending.length > 0) {
        const out = await runCloseoutMergeStep(deps, run, ledger, specDir, pending);
        if (out === 'stop') return;
        run = (await readRun(runId)) ?? run;
      }
      if (!runEnded(specDir, run.id)) ledger.runEnd('done');
      // The run's last rows (the close-out's and this `run.end`) are history too:
      // commit them, as the supervisor's deregister step did by hand.
      try {
        await commitSpecStore(
          { specStoreRoot, spec: run.spec, message: `docs(sdd): ${run.spec} harness ledger — controller run end` },
          (fn) => withStoreLock(specStoreRoot, fn),
        );
      } catch (err) {
        ledger.note(`run-end commit failed: ${(err as Error).message}`);
      }
      // The store's commits are only history once they are on the remote: rebase
      // onto origin (a run's PR merged there meanwhile) and push. A failure is a
      // wait, not a silent drift; "Retry" comes back here through routing.
      const pushed = await withStoreLock(specStoreRoot, async () => pushSpecStore(specStoreRoot));
      if (!pushed.ok) {
        ledger.note(`spec store push failed: ${pushed.note}`);
        run = await save(deps, run, { cursor: { phase: 'closeout', stepKind: 'store-push', attempt: 1 } });
        await waitAnd(deps, run, ledger, 'error', specDir, [{
          id: 'push',
          text: `The run is complete but the spec store at ${specStoreRoot} could not be pushed (${pushed.note}). `
            + 'Push it by hand or fix the remote, then answer "Retry" to push again; "Abandon" leaves it unpushed.',
          options: ['retry', 'abandon'], recommended: 'retry',
        }]);
        return;
      }
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
        ledger, stepLogDir: stepLogDir(run.id),
        mcpConfig, gates: deps.gates ?? NO_OP_GATES,
        onRateLimit: deps.onRateLimit, onStepActivity: stepActivityForwarder(deps, run.id),
        ...stepLifecycle(deps, run.id),
        now: deps.now,
        shouldStop: () => (deps.isPauseRequested?.(runId) ? 'operator' : null),
      };
      const outcome = await runDocumentPhase(ctx);
      const handled = await handleDocumentOutcome(deps, run, ledger, specDir, decision.phase, outcome);
      if (handled === 'stop') return;
      continue; // approved ⇒ re-route
    }

    if (decision.kind === 'implementation') {
      // The implementation loop in code (step c2, design §5). It resumes from
      // `tasks.md` and the ledger, so a re-entry after a wait, a pause or a
      // restart carries on from the last `[x]`.
      const prior = run.cursor;
      const attempt = prior?.stepKind === 'implementation' ? prior.attempt : 1;
      run = await save(deps, run, { phase: 'implementation', cursor: { phase: 'implementation', stepKind: 'implementation', attempt } });
      const outcome = await runImplementationPhase({
        run, specStoreRoot, specDir, codeRoot: run.worktree, mainCheckout: run.codeRoot,
        ledger, stepLogDir: stepLogDir(run.id), mcpConfig,
        onRateLimit: deps.onRateLimit, onStepActivity: stepActivityForwarder(deps, run.id),
        ...stepLifecycle(deps, run.id),
        now: deps.now,
        shouldStop: () => stopReason(deps, runId),
        operatorRulings: await escalationRulings(runId),
        securityAnswers: await securityAnswers(runId),
      });
      run = (await readRun(runId)) ?? run;
      const handled = await handleImplementationOutcome(deps, run, ledger, specDir, outcome);
      if (handled === 'stop') return;
      if (handled === 'retry') continue;
      run = (await readRun(runId)) ?? run;

      // Implementation ends at the pull request (design §6): merge it by rule
      // before the retrospective starts (the retro reads the merged state). A
      // completed implementation with no open PR is an `error` wait, not a
      // silent skip to the retro (`runMergeStageStep` returns `stop`).
      const merge = await runMergeStageStep(deps, run, ledger, specDir);
      if (merge === 'stop') return;
      continue; // merged, or already merged: re-route (to the retrospective)
    }

    if (decision.kind === 'retrospective') {
      // The retrospective in code (step c3): the compile and analyst steps, then
      // the proposals file routes to the `retro-plan` wait on the next pass.
      const prior = run.cursor;
      const attempt = prior?.stepKind === 'retrospective' ? prior.attempt : 1;
      run = await save(deps, run, { phase: 'retrospective', cursor: { phase: 'retrospective', stepKind: 'retrospective', attempt } });
      const outcome = await runRetrospectivePhase({
        run, specStoreRoot, specDir, codeRoot: run.worktree, mainCheckout: run.codeRoot,
        ledger, stepLogDir: stepLogDir(run.id), mcpConfig,
        onRateLimit: deps.onRateLimit, onStepActivity: stepActivityForwarder(deps, run.id),
        ...stepLifecycle(deps, run.id),
        now: deps.now,
        shouldStop: () => stopReason(deps, runId),
      });
      run = (await readRun(runId)) ?? run;
      const handled = await handleRetrospectiveOutcome(deps, run, ledger, specDir, outcome);
      if (handled === 'stop') return;
      continue; // retro-ready or a retry: re-route
    }

    // decision.kind === 'closeout': the approved plan, landed in code (step c3).
    const prior = run.cursor;
    const attempt = prior?.stepKind === 'closeout' ? prior.attempt : 1;
    run = await save(deps, run, { phase: 'closeout', cursor: { phase: 'closeout', stepKind: 'closeout', attempt } });
    const outcome = await runCloseoutPhase({
      run, specStoreRoot, specDir, codeRoot: run.worktree, mainCheckout: run.codeRoot,
      ledger, stepLogDir: stepLogDir(run.id), mcpConfig,
      onRateLimit: deps.onRateLimit, onStepActivity: stepActivityForwarder(deps, run.id),
      ...stepLifecycle(deps, run.id),
      now: deps.now,
      shouldStop: () => stopReason(deps, runId),
    });
    run = (await readRun(runId)) ?? run;
    const handled = await handleCloseoutOutcome(deps, run, ledger, specDir, outcome);
    if (handled === 'stop') return;
    continue; // closed or a retry: re-route (a CLOSED plan is `done`)
  }
}

/**
 * Merge the close-out PRs a CLOSED plan left open, by each repository's rule
 * (design §10, controller-tasks T14): the project's merge rules for the code
 * repository, the repository's own `agent-rules.md` for any other (the harness
 * repository says `ask`). Each PR gets its own `merge` wait. The worst outcome
 * decides: a failed, unreadable or blocked PR ⇒ an `error` wait with a `merge`
 * cursor ("Retry" re-enters here through routing); an `ask` ⇒ `waiting`; a
 * check in flight ⇒ `merging` with a re-check time; all merged ⇒ `go`.
 */
async function runCloseoutMergeStep(
  deps: RunDeps, run: RunRecord, ledger: RunLedger, specDir: string,
  pending: NonNullable<RunRecord['closeoutPrs']>,
): Promise<'stop' | 'go'> {
  const results: { label: string; result: MergeStageResult }[] = [];
  for (const p of pending) {
    if (typeof p.number !== 'number') continue;
    const target = closeoutMergeTarget(run, { number: p.number, repoDir: p.repoDir, branch: p.branch, url: p.url });
    const rules = p.repoDir === run.codeRoot ? deps.mergeRules(run) : readMergeRules(join(p.repoDir, '.spec-workflow'));
    const result = await mergeByRule(target, { rules, specDir, stepLogDir: stepLogDir(run.id), ledger, now: deps.now });
    if (result.read) run = await save(deps, run, { prReads: withPrRead(run.prReads, result.read) });
    ledger.note(`close-out merge: ${target.label} ${result.status}${result.reasons.length ? ` (${result.reasons.join('; ')})` : ''}`);
    results.push({ label: target.label, result });
  }
  const of = (status: MergeStageResult['status']) => results.filter((r) => r.result.status === status);
  const stuck = [...of('failed'), ...of('unreadable'), ...of('blocked')];
  if (stuck.length > 0) {
    run = await save(deps, run, { cursor: { phase: 'closeout', stepKind: 'merge', attempt: 1 } });
    await waitAnd(deps, run, ledger, 'error', specDir, [{
      id: 'merge',
      text: `${stuck.map((s) => `${s.label}: ${s.result.status} (${s.result.reasons.join('; ')})`).join('. ')}. `
        + 'Fix or merge the PR by hand, then answer "Retry"; "Abandon" leaves it open.',
      options: ['retry', 'abandon'], recommended: 'retry',
    }]);
    return 'stop';
  }
  if (of('waiting').length > 0) {
    await save(deps, run, { status: 'waiting', inFlight: undefined });
    return 'stop';
  }
  if (of('not-ready').length > 0) {
    await save(deps, run, { status: 'merging', pauseReason: undefined, resumeAt: nextMergeCheck(deps), inFlight: undefined });
    return 'stop';
  }
  return 'go';
}

/** Map a close-out outcome to a run-status change: `go` re-routes (a CLOSED plan is `done`). */
async function handleCloseoutOutcome(
  deps: RunDeps, run: RunRecord, ledger: RunLedger, specDir: string, outcome: CloseoutPhaseOutcome,
): Promise<'stop' | 'go'> {
  if (outcome.result === 'closed') {
    if (outcome.prs.length > 0) await save(deps, run, { closeoutPrs: outcome.prs });
    return 'go';
  }
  if (outcome.result === 'stopped') {
    if (outcome.reason === 'usage-window') await pause(deps, run, 'usage-window', deps.windowBlock().resumeAt);
    else if (outcome.reason === 'operator') await pause(deps, run, OPERATOR_PAUSE);
    return 'stop';
  }
  if (outcome.reason === 'usage-limit') {
    await pause(deps, run, 'usage-limit', deps.windowBlock().resumeAt ?? fifteenMinutes(deps));
    return 'stop';
  }
  const attempt = run.cursor?.attempt ?? 1;
  if (attempt <= RUN_FRESH_RETRY) {
    await save(deps, run, { cursor: { phase: 'closeout', stepKind: 'closeout', attempt: attempt + 1 } });
    return 'go'; // one fresh retry: the phase resumes from the plan's close-out lines
  }
  await waitAnd(deps, run, ledger, 'error', specDir, [{
    id: 'error', text: `Close-out failed (${outcome.items.done + outcome.items.todo + outcome.items.skipped}/${outcome.items.total} items closed): ${outcome.reason ?? 'unknown'}. Retry or abandon.`,
    options: ['retry', 'abandon'], recommended: 'retry',
  }]);
  return 'stop';
}

/**
 * The operator's answers to this run's answered `escalation` waits, oldest first.
 * Skips `security` waits: their `accept`/`retry` answer reaches the phase through
 * `securityAnswers`, never a brief as a ruling (design C7).
 */
async function escalationRulings(runId: string): Promise<string[]> {
  let waits: ControllerWaitRecord[];
  try {
    waits = (await listWaits()) as ControllerWaitRecord[];
  } catch {
    return [];
  }
  return waits
    .filter((w) => w.kind === 'escalation' && w.run === runId && w.state === 'answered'
      && !w.questions.some((q) => q.id === 'security'))
    .sort((a, b) => a.created.localeCompare(b.created))
    .flatMap((w) => Object.values(w.answer ?? {}).map((a) => a.value));
}

/**
 * The operator's answers to this run's answered `security` escalation waits,
 * oldest first (design C7). The completion gate's security loop consumes each
 * unanswered entry in turn (`accept` records the findings, `retry` re-runs the pass).
 */
async function securityAnswers(runId: string): Promise<{ waitId: string; value: string }[]> {
  let waits: ControllerWaitRecord[];
  try {
    waits = (await listWaits()) as ControllerWaitRecord[];
  } catch {
    return [];
  }
  return waits
    .filter((w) => w.kind === 'escalation' && w.run === runId && w.state === 'answered'
      && w.questions.some((q) => q.id === 'security'))
    .sort((a, b) => a.created.localeCompare(b.created))
    .map((w) => ({ waitId: w.id, value: w.answer?.security?.value ?? '' }));
}

/** True when an open `security` escalation wait is already parked on this run (design C7). */
async function hasOpenSecurityWait(runId: string): Promise<boolean> {
  let waits: ControllerWaitRecord[];
  try {
    waits = (await listWaits()) as ControllerWaitRecord[];
  } catch {
    return false;
  }
  return waits.some((w) => w.kind === 'escalation' && w.run === runId && w.state === 'open'
    && w.questions.some((q) => q.id === 'security'));
}

/**
 * Map an implementation-phase outcome to a run-status change. `go` means the
 * phase is complete (the merge stage follows); `retry` re-routes once after a
 * step error; `stop` parked the run (a wait or a pause) or it was cancelled.
 */
async function handleImplementationOutcome(
  deps: RunDeps, run: RunRecord, ledger: RunLedger, specDir: string, outcome: ImplementationPhaseOutcome,
): Promise<'stop' | 'go' | 'retry'> {
  if (outcome.result === 'complete') {
    if (outcome.pr && run.pr !== outcome.pr.number) await save(deps, run, { pr: outcome.pr.number });
    return 'go';
  }
  if (outcome.result === 'stopped') {
    if (outcome.reason === 'usage-window') {
      await pause(deps, run, 'usage-window', deps.windowBlock().resumeAt);
    } else if (outcome.reason === 'operator') {
      await pause(deps, run, OPERATOR_PAUSE);
    }
    return 'stop'; // cancelled: the cancel path already marked the run
  }
  if (outcome.result === 'design-defect' || outcome.result === 'escalate') {
    // The task is back to `[ ]`; the operator's ruling reaches the next
    // implementer brief (design §7: a wait is the only way to the operator).
    await waitAnd(deps, run, ledger, 'escalation', specDir, [{
      id: 'ruling',
      text: `${outcome.result === 'design-defect' ? 'Design defect' : 'Escalation'} (tasks ${outcome.tasks.done}/${outcome.tasks.total}): `
        + `${outcome.reason ?? 'no reason given'}. Rule on it; your answer goes into the next implementer brief.`,
      free: true,
    }]);
    return 'stop';
  }
  if (outcome.result === 'security-open') {
    // The operator rules on findings that survived the security loop (R3 AC 8):
    // one `escalation` wait, question id `security`, options accept/retry/abandon,
    // no recommendation; `text` lists each open finding (design C7). A second pass
    // while the wait is open parks the run without a second wait; `abandon` takes
    // the existing cancel path (controller.ts `onWaitChange`).
    if (await hasOpenSecurityWait(run.id)) {
      await save(deps, run, { status: 'waiting', inFlight: undefined });
      return 'stop';
    }
    const findings = outcome.findings ?? [];
    await waitAnd(deps, run, ledger, 'escalation', specDir, [{
      id: 'security',
      text: `Security findings survived the loop (tasks ${outcome.tasks.done}/${outcome.tasks.total}):\n`
        + findings.map((f) => `${f.title} (${f.file}): ${f.command}`).join('\n')
        + '\nAccept to record them, retry the pass, or abandon the run.',
      options: ['accept', 'retry', 'abandon'],
    }]);
    return 'stop';
  }
  if (outcome.result === 'error' && outcome.reason === 'usage-limit') {
    await pause(deps, run, 'usage-limit', deps.windowBlock().resumeAt ?? fifteenMinutes(deps));
    return 'stop';
  }
  if (outcome.result === 'error') {
    const attempt = run.cursor?.attempt ?? 1;
    if (attempt <= RUN_FRESH_RETRY) {
      await save(deps, run, { cursor: { phase: 'implementation', stepKind: 'implementation', attempt: attempt + 1 } });
      return 'retry';
    }
  }
  await waitAnd(deps, run, ledger, 'error', specDir, [{
    id: 'error',
    text: `Implementation ${outcome.result} (tasks ${outcome.tasks.done}/${outcome.tasks.total}): ${outcome.reason ?? 'unknown'}. Retry or abandon.`,
    options: ['retry', 'abandon'], recommended: 'retry',
  }]);
  return 'stop';
}

/** Map a retrospective outcome to a run-status change: `go` re-routes (to the retro-plan wait). */
async function handleRetrospectiveOutcome(
  deps: RunDeps, run: RunRecord, ledger: RunLedger, specDir: string, outcome: RetrospectivePhaseOutcome,
): Promise<'stop' | 'go'> {
  if (outcome.result === 'retro-ready') return 'go';
  if (outcome.result === 'stopped') {
    if (outcome.reason === 'usage-window') await pause(deps, run, 'usage-window', deps.windowBlock().resumeAt);
    else if (outcome.reason === 'operator') await pause(deps, run, OPERATOR_PAUSE);
    return 'stop';
  }
  if (outcome.reason === 'usage-limit') {
    await pause(deps, run, 'usage-limit', deps.windowBlock().resumeAt ?? fifteenMinutes(deps));
    return 'stop';
  }
  const attempt = run.cursor?.attempt ?? 1;
  if (attempt <= RUN_FRESH_RETRY) {
    await save(deps, run, { cursor: { phase: 'retrospective', stepKind: 'retrospective', attempt: attempt + 1 } });
    return 'go'; // one fresh retry: the phase resumes from the files it already wrote
  }
  await waitAnd(deps, run, ledger, 'error', specDir, [{
    id: 'error', text: `Retrospective failed: ${outcome.reason ?? 'unknown'}. Retry or abandon.`,
    options: ['retry', 'abandon'], recommended: 'retry',
  }]);
  return 'stop';
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
  if (outcome.result === 'deferred') {
    // Gate A "do nothing": the document phase wrote the ledger note and tagged the
    // decomposition heading `(deferred)`. The run finishes with no implementation.
    if (!runEnded(specDir, run.id)) ledger.runEnd('done');
    await save(deps, run, { status: 'done', phase: undefined, inFlight: undefined });
    return 'stop';
  }
  if (outcome.result === 'escalate') {
    await waitAnd(deps, run, ledger, 'escalation', specDir, [{
      id: 'escalation', text: outcome.reason ?? `${phase} escalated`, free: true,
    }]);
    return 'stop';
  }
  if (outcome.result === 'stopped') {
    await pause(deps, run, OPERATOR_PAUSE);
    return 'stop';
  }
  // outcome.result === 'error'.
  if (outcome.reason === 'usage-limit') {
    const window = deps.windowBlock();
    await pause(deps, run, 'usage-limit', window.resumeAt ?? fifteenMinutes(deps));
    return 'stop';
  }
  // One fresh retry, then an `error` wait (design §4). A held run pauses here
  // instead, without bumping the attempt (design C6).
  const attempt = run.cursor?.attempt ?? 1;
  if (attempt <= RUN_FRESH_RETRY) {
    if (deps.isPauseRequested?.(run.id)) {
      await pause(deps, run, OPERATOR_PAUSE);
      return 'stop';
    }
    await save(deps, run, { cursor: { phase, stepKind: 'document', attempt: attempt + 1 } });
    const retry = await runDocumentPhase({
      run, phase, specStoreRoot: run.specStore, specDir, codeRoot: run.worktree,
      ledger, stepLogDir: stepLogDir(run.id),
      mcpConfig: deps.mcpConfigFor(run), gates: deps.gates ?? NO_OP_GATES,
      onRateLimit: deps.onRateLimit, onStepActivity: stepActivityForwarder(deps, run.id),
      ...stepLifecycle(deps, run.id),
      now: deps.now,
      shouldStop: () => (deps.isPauseRequested?.(run.id) ? 'operator' : null),
    });
    if (retry.result === 'approved') return 'go';
    if (retry.result === 'waiting') { await save(deps, run, { status: 'waiting', inFlight: undefined }); return 'stop'; }
    if (retry.result === 'stopped') { await pause(deps, run, OPERATOR_PAUSE); return 'stop'; }
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

// ---------------------------------------------------------------------------
// Cancel and discard (design §13).
// ---------------------------------------------------------------------------

export interface CancelDeps {
  now(): Date;
  ghBin(): string;
  graceMs?: number;
}

/**
 * Cancel a run: signal the in-flight step (SIGTERM, then SIGKILL after the
 * grace), mark the run `abandoned`, and keep the worktree, branch and PR. The phase loop stops at its next step boundary.
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
  /** When the run stopped; a run stopped before `pausedAt` existed falls back to `updated`. */
  pausedAt?: string;
  tokens: number;
  created: string;
  updated: string;
  /** One read per PR for the dashboard (design D5); undefined when the record has none. */
  prReads?: PrRead[];
}

function toRow(run: RunRecord): ControllerRunRow {
  return {
    id: run.id, project: run.project, spec: run.spec, status: run.status,
    phase: run.phase, stepKind: run.cursor?.stepKind,
    pauseReason: run.pauseReason, resumeAt: run.resumeAt,
    pausedAt: run.status === 'paused' || run.status === 'waiting' ? (run.pausedAt ?? run.updated) : undefined,
    tokens: run.tokens ? totalW(run.tokens) : 0, created: run.created, updated: run.updated,
    prReads: run.prReads,
  };
}

/** Every run as a path-free wire row, newest first (the GET route and WS payload). */
export async function listRunsForWire(): Promise<ControllerRunRow[]> {
  const runs = await listRuns();
  return runs.sort((a, b) => b.created.localeCompare(a.created)).map(toRow);
}

/** The step-log directory for a run (where supervisor/step streams are written). */
export function stepLogDir(runId: string): string {
  return runStepsDir(runId);
}

// A readdir re-export kept local so the controller can scan step logs if needed.
export function listStepLogs(runId: string): string[] {
  try {
    return readdirSync(stepLogDir(runId));
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
  const dir = stepLogDir(runId);

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
