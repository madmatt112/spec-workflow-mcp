// src/controller/phases/document.ts
//
// T5a of the controller (docs/controller-tasks.md "T5a `document-loop`",
// docs/controller-design.md §5 "Documents"). The document phase loop in code:
// draft v1, lint, adversarial review rounds, revision, and approval with
// cleanup — every mechanical step in code, only the five role steps as model
// calls. The rule source is `harness/skills/sdd-document-phase/SKILL.md` and its
// references (`convergence.md`, `cleanup.md`, `revision.md`); the rule-to-code
// mapping is in the function doc comments.
//
// What is still T5b (the gates, the v4 cap and adjudication): gate A after
// requirements v1, gate B after tasks approval, the Cap convergence check, the
// post-cap adjudicator/checker corrective pass, and the circling/standoff
// rulings. The `gates` hook is the extension point for A/B; at the v4 cap this
// loop returns `{ result: 'error', reason: 'cap' }` (see the TODO below). T6
// owns pausing on a usage limit and retrying a step.
import { randomUUID } from 'crypto';
import {
  existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync, mkdirSync,
} from 'fs';
import { join, relative, dirname } from 'path';
import { execFileSync } from 'child_process';
import {
  runStep, loadRole, type StepResult, type StepSpec, type ActivityEvent, type RateLimitWindows,
} from '../step.js';
import { type RunRecord, withStoreLock } from '../state.js';
import { checkpoint, type RunLedger, type Serialize } from '../ledger.js';
import { BRIEF_TEMPLATES } from '../../tools/brief-templates.js';
import { specLintHandler } from '../../tools/spec-lint.js';
import { adversarialReviewHandler } from '../../tools/adversarial-review.js';
import { approvalsHandler } from '../../tools/approvals.js';
import { harnessHandler } from '../../tools/harness.js';
import { PathUtils } from '../../core/path-utils.js';
import { handoffPath } from '../../watch/index.js';
import { scrubbedGitEnv } from '../../core/git-utils.js';
import type { ToolContext } from '../../types.js';

export type DocumentPhase = 'requirements' | 'design' | 'tasks';

/** The v4 cap (SKILL.md Step 2 item 9; convergence.md "Cap convergence check"). */
const V_CAP = 4;

/** `--max-turns` for a step; a backstop, not a budget (design §4). */
const STEP_TURN_CAP = 80;

// ---------------------------------------------------------------------------
// The gate seam (design §5, §7). `createDocumentGates` (gates.ts) builds the real
// implementation; T6 passes it in `ctx.gates` and reads `outcome.waitId` to watch
// the wait. On the answer it calls `runDocumentPhase` again (optionally with
// `ctx.gateAnswers`); the loop finds the answered gate wait and resumes.
// ---------------------------------------------------------------------------

/** One decision the drafter recorded (gate A ranks and asks these). */
export interface GateDecision {
  id: string;
  text: string;
  options?: string[];
  recommended?: string;
}

/** Fresh gate A: the drafter's decisions at v1. */
export interface GateAInput {
  run: RunRecord;
  specDir: string;
  version: number;
  decisions: GateDecision[];
}

/** Resume gate A: the operator's answers (from the answered wait or `gateAnswers`). */
export interface GateAResumeInput {
  run: RunRecord;
  specDir: string;
  version: number;
  answers: Record<string, string>;
}

/** Gate B after tasks approval: the veto list is built from the spec store. */
export interface GateBInput {
  run: RunRecord;
  specDir: string;
  specStoreRoot: string;
  codeRoot: string;
  version: number;
}

/** Resume gate B: the operator's approve/annotate reply. */
export interface GateBResumeInput {
  run: RunRecord;
  specDir: string;
  version: number;
  answers: Record<string, string>;
}

/** A gate hook's instruction back to the loop. */
export type GateDirective =
  | { kind: 'waiting'; waitId: string }
  | { kind: 'proceed' }
  | { kind: 'revise'; findings: string }
  /** Gate A "do nothing": end the run and defer the spec; `reason` may be empty. */
  | { kind: 'defer'; reason: string };

/** An open or answered gate wait found on re-entry (drives resume routing). */
export interface PendingGate {
  waitId: string;
  kind: 'gate-a' | 'gate-b';
  answered: boolean;
  /** The document version the gate was raised at (gate A: always 1). */
  version: number;
  answers?: Record<string, string>;
}

/**
 * The two document-phase gates (design §5). T5a runs with {@link NO_OP_GATES},
 * which always proceeds; T5b's {@link import('./gates.js').createDocumentGates}
 * writes a `gate-a`/`gate-b` wait and resumes on the answer.
 */
export interface DocumentGates {
  gateA(input: GateAInput): Promise<GateDirective>;
  resumeAfterGateA(input: GateAResumeInput): Promise<GateDirective>;
  gateB(input: GateBInput): Promise<GateDirective>;
  resumeAfterGateB(input: GateBResumeInput): Promise<GateDirective>;
  pendingGate(run: RunRecord, phase: DocumentPhase): Promise<PendingGate | undefined>;
}

/** The no-op gates T5a runs with: every gate proceeds, no wait is ever open. */
export const NO_OP_GATES: DocumentGates = {
  async gateA() { return { kind: 'proceed' }; },
  async resumeAfterGateA() { return { kind: 'proceed' }; },
  async gateB() { return { kind: 'proceed' }; },
  async resumeAfterGateB() { return { kind: 'proceed' }; },
  async pendingGate() { return undefined; },
};

// ---------------------------------------------------------------------------
// Context and outcome.
// ---------------------------------------------------------------------------

export interface DocumentPhaseContext {
  run: RunRecord;
  phase: DocumentPhase;
  /** The project root that holds `.spec-workflow` and is the git repo to commit. */
  specStoreRoot: string;
  /** `<specStoreRoot>/.spec-workflow/specs/<spec>`. */
  specDir: string;
  /** The run's worktree / code root (what a step reads and cites). */
  codeRoot: string;
  /** This run's ledger writer (T3). */
  ledger: RunLedger;
  /** Where each step's raw stream log is written. */
  stepLogDir: string;
  /** `--mcp-config` for every step (the spec-workflow server for this project). */
  mcpConfig?: string | Record<string, unknown>;
  onActivity?: (a: ActivityEvent) => void;
  /**
   * A step's tool activity enriched with the step id and role (T6/T10 forward it
   * to the controller's `controller-activity` feed). The loop knows the step id
   * and role; the controller stamps the run id.
   */
  onStepActivity?: (e: { stepId: string; role: string; tool: string; inputSummary: string; ts?: string }) => void;
  onRateLimit?: (w: RateLimitWindows) => void;
  /** A step process started (the controller records it as the run's in-flight step). */
  onStepSpawn?: (s: { id: string; pid: number; startTime: number }) => Promise<void> | void;
  /** A step process ended (the controller clears the in-flight step); awaited before the step's result is acted on. */
  onStepEnd?: (id: string) => Promise<void> | void;
  /** Gate A/B hooks; defaults to {@link NO_OP_GATES} (T5b supplies real ones). */
  gates?: DocumentGates;
  /**
   * On a gate resume, the operator's answers keyed by question id (T6 sets this
   * when it re-invokes after answering). When unset the loop reads the answered
   * gate wait itself, so either path resumes.
   */
  gateAnswers?: Record<string, string>;
  /** Serialises spec-store commits; defaults to the T2 per-store lock. */
  serialize?: Serialize;
  /** Clock seam for tests. */
  now?: () => Date;
}

export interface DocumentPhaseOutcome {
  /**
   * `waiting` means a gate wait is open; T6 watches {@link waitId}. `deferred`
   * means gate A chose "do nothing": the run ends without design/tasks/impl.
   */
  result: 'approved' | 'escalate' | 'error' | 'waiting' | 'deferred';
  /** The final document version D. */
  version: number;
  /** Review rounds run (reviewer spawns plus the narrow check when it ran). */
  rounds: number;
  reason?: string;
  /** The open gate wait, set only when `result` is `waiting`. */
  waitId?: string;
}

// ---------------------------------------------------------------------------
// Report schemas for the three role steps that return one (design §5).
// The stub ignores them; a real `claude` validates its structured output.
// ---------------------------------------------------------------------------

export const DRAFTER_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['wordCount', 'decisions', 'contextFileWritten'],
  properties: {
    wordCount: { type: 'number' },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'text'],
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          recommended: { type: 'string' },
        },
      },
    },
    contextFileWritten: { type: 'boolean' },
  },
} as const;

const REVIEWER_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['verdict', 'mustFix', 'shouldFix', 'recurring', 'analysisPath'],
  properties: {
    verdict: { type: 'string', enum: ['converged', 'iterate'] },
    mustFix: { type: 'array', items: { type: 'string' } },
    shouldFix: { type: 'array', items: { type: 'string' } },
    recurring: { type: 'array', items: { type: 'string' } },
    escalate: { type: 'string' },
    analysisPath: { type: 'string' },
  },
} as const;

const CHECKER_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['verified', 'items'],
  properties: {
    verified: { type: 'boolean' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['item', 'status'],
        properties: { item: { type: 'string' }, status: { type: 'string' } },
      },
    },
  },
} as const;

/** The adjudicator's post-cap report (convergence.md Step 4a; T5b cap). */
const ADJUDICATOR_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['fixed', 'ruledOut', 'carried'],
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    ruledOut: {
      type: 'array',
      items: {
        type: 'object',
        required: ['item', 'reason'],
        properties: { item: { type: 'string' }, reason: { type: 'string' } },
      },
    },
    carried: { type: 'array', items: { type: 'string' } },
  },
} as const;

interface DrafterReport { wordCount?: number; decisions?: GateDecision[]; contextFileWritten?: boolean }
interface AdjudicatorReport {
  fixed?: string[];
  ruledOut?: { item: string; reason: string }[];
  carried?: string[];
}
interface CheckerReport { verified?: boolean; items?: { item: string; status: string }[] }
interface ReviewerReport {
  verdict: 'converged' | 'iterate';
  mustFix?: string[];
  shouldFix?: string[];
  recurring?: string[];
  escalate?: string;
  analysisPath?: string;
}

// ---------------------------------------------------------------------------
// The loop.
// ---------------------------------------------------------------------------

/**
 * Run one document phase to agent-side approval, following the document-phase
 * skill with every mechanical step in code (design §5 "Documents"). Returns the
 * outcome; never throws for a step that merely fails — a failed step is a
 * classified `error` outcome (T6 refines the per-class response).
 */
export async function runDocumentPhase(ctx: DocumentPhaseContext): Promise<DocumentPhaseOutcome> {
  const specName = ctx.run.spec;
  const phase = ctx.phase;
  const workflowRoot = PathUtils.getWorkflowRoot(ctx.specStoreRoot); // the `.spec-workflow` dir
  const docPath = join(ctx.specDir, `${phase}.md`);
  const docRelPath = relative(ctx.specStoreRoot, docPath); // `.spec-workflow/specs/<spec>/<phase>.md`
  const reviewsDir = join(ctx.specDir, 'reviews');
  const memoryPath = join(reviewsDir, `adversarial-memory-${phase}.md`);
  const toolContext: ToolContext = { projectPath: ctx.specStoreRoot, workspacePath: ctx.codeRoot };
  const gates = ctx.gates ?? NO_OP_GATES;
  const serialize: Serialize = ctx.serialize ?? ((fn) => withStoreLock(ctx.specStoreRoot, fn));
  const now = ctx.now ?? (() => new Date());
  const agentRules = existsSync(join(workflowRoot, 'agent-rules.md'))
    ? join(workflowRoot, 'agent-rules.md')
    : undefined;

  let reviewRounds = 0;
  let narrowCheckRan = false;
  let lintChecks = '';
  // T5b state: the cap's one extra round (convergence.md "Cap convergence
  // check"), the ruled-out items and rulings carried to approval and HANDOFF,
  // and the per-round findings the standoff/circling checks read.
  let capExtraRoundSpent = false;
  let carriedItems: string[] = [];
  const rulings: string[] = [];
  const ruledOut = new Set<string>();
  const roundFindings: { mustFix: string[]; shouldFix: string[]; recurring: string[] }[] = [];

  // --- a model step: the spawn boundary rows plus the classified result -----
  // Rule: SKILL.md "Bookkeeping" (a `spawn.usage` after each worker) and
  // design §4 (the controller writes `spawn.start`/`spawn.end`/`spawn.usage`
  // from the step result). A step classified anything but `ok` ends the phase
  // with that classification as the reason (design §4; T6 adds pause/retry).
  const stepUsageRow = (kind: 'start' | 'end' | 'usage', role: string, label: string,
    result?: StepResult, resultText?: string, round?: string): void => {
    const profile = loadRole(role);
    if (kind === 'start') {
      ctx.ledger.spawnStart({ agent: role, role: label, model: profile.model, effort: profile.effort });
    } else if (kind === 'end' && result) {
      ctx.ledger.spawnEnd({ agent: role, model: profile.model, usage: result.usage });
    } else {
      ctx.ledger.spawnUsage({ agent: role, role: label, result: resultText, phase, round });
    }
  };

  const runModelStep = async (opts: {
    role: string; label: string; briefPath: string; stepId: string;
    schema?: Record<string, unknown>; round?: string;
  }): Promise<{ result: StepResult; error?: DocumentPhaseOutcome }> => {
    stepUsageRow('start', opts.role, opts.label);
    let spawnWrite: Promise<void> | void = undefined;
    const spec: StepSpec = {
      role: opts.role,
      briefPath: opts.briefPath,
      worktree: ctx.codeRoot,
      logPath: join(ctx.stepLogDir, `${opts.stepId}.jsonl`),
      maxTurns: STEP_TURN_CAP,
      sessionId: randomUUID(),
      mcpConfig: ctx.mcpConfig,
      schema: opts.schema,
      runId: ctx.run.id,
      stepId: opts.stepId,
      onActivity: (a) => {
        ctx.onActivity?.(a);
        ctx.onStepActivity?.({
          stepId: opts.stepId, role: opts.role, tool: a.tool, inputSummary: a.inputSummary, ts: a.ts,
        });
      },
      onRateLimit: ctx.onRateLimit,
      onSpawn: (pid, startTime) => { spawnWrite = ctx.onStepSpawn?.({ id: opts.stepId, pid, startTime }); },
    };
    const result = await runStep(spec);
    // Both record writes land before the result is acted on, so a status the
    // caller writes next is never overwritten by a late in-flight update.
    await spawnWrite;
    await ctx.onStepEnd?.(opts.stepId);
    stepUsageRow('end', opts.role, opts.label, result);
    stepUsageRow('usage', opts.role, opts.label, result, result.subtype ?? 'ok', opts.round);
    if (result.classification !== 'ok') {
      return {
        result,
        error: { result: 'error', version: 0, rounds: reviewRounds, reason: result.classification },
      };
    }
    return { result };
  };

  // --- the lint step (SKILL.md "Lint step") ---------------------------------
  // Runs once per version right after its checkpoint, before any reviewer
  // spawn; error/warning findings go to a reviser lint-fix step and a
  // `v<D> lint` commit (consuming no version). Info-only findings spawn
  // nothing. A failed/absent tool is a skipped lint (a `note`), never a stop.
  const lintStep = async (D: number): Promise<DocumentPhaseOutcome | null> => {
    const res = await specLintHandler({ specName, phase }, toolContext);
    if (!res.success) {
      ctx.ledger.note('spec-lint unavailable; lint skipped');
      lintChecks = '';
      return null;
    }
    const data = res.data as { summary: { error: number; warning: number }; checks: string[]; findings: LintFinding[] };
    lintChecks = (data.checks ?? []).join(', ');
    if ((data.summary.error + data.summary.warning) === 0) return null;

    const findings = (data.findings ?? [])
      .map((f, i) => `L-${i + 1} (${f.severity}, ${f.rule}, line ${f.line}): ${f.message}`)
      .join('\n');
    const briefPath = join(reviewsDir, `lint-brief-${phase}-v${D}.md`);
    writeBrief(briefPath, 'reviser', {
      variant: 'lint-fix', phase, D: String(D), docPath, specDir: ctx.specDir,
      findings, memoryPath, closedByRuling: 'none', spec: specName, agentRules,
    });
    const step = await runModelStep({
      role: 'sdd-reviser', label: `lint v${D}`, briefPath, stepId: `reviser-lint-v${D}`,
    });
    if (step.error) return step.error;
    await checkpoint({ specStoreRoot: ctx.specStoreRoot, spec: specName, message: `docs(sdd): ${specName} ${phase} v${D} lint` }, serialize);
    return null;
  };

  // --- a reviser step to v(D+1) (SKILL.md Step 3 / Step 2 item 9; revision.md
  // Step R for the `revision` variant, where `findings` is the revision comments
  // text rather than an analysis path).
  const reviserStep = async (
    variant: 'round' | 'should-fix-only' | 'revision', D: number, findings: string, commitMsg: string,
  ): Promise<DocumentPhaseOutcome | null> => {
    const briefPath = join(reviewsDir, `reviser-brief-${phase}-v${D + 1}.md`);
    writeBrief(briefPath, 'reviser', {
      variant, phase, D: String(D), docPath, specDir: ctx.specDir, findings,
      memoryPath, closedByRuling: rulings.length > 0 ? rulings.join('; ') : 'none',
      spec: specName, agentRules,
    });
    const step = await runModelStep({
      role: 'sdd-reviser', label: `revise v${D + 1}`, briefPath, stepId: `reviser-v${D + 1}`,
      round: String(reviewRounds),
    });
    if (step.error) return step.error;
    await checkpoint({ specStoreRoot: ctx.specStoreRoot, spec: specName, message: `docs(sdd): ${specName} ${phase} ${commitMsg}` }, serialize);
    return null;
  };

  // --- the narrow check (convergence.md Step 4b) ----------------------------
  // A fresh adversarial-review scaffold (no verdict block) whose prompt is
  // overwritten with the checker brief; the checker verifies only that each
  // listed item was addressed, then approval follows whatever k/n says.
  let lastCheckerVerified = { k: 0, n: 0 };
  const narrowCheck = async (
    D: number, reviewerAnalysisPath: string, items: string[],
  ): Promise<DocumentPhaseOutcome | null> => {
    const adv = await adversarialReviewHandler({ specName, phase }, toolContext); // no verdictBlock
    if (!adv.success) {
      return { result: 'error', version: D, rounds: reviewRounds, reason: `narrow-check review failed: ${adv.message}` };
    }
    const advData = adv.data as { promptOutputPath: string; analysisOutputPath: string };
    writeBrief(advData.promptOutputPath, 'checker', {
      phase, D: String(D), docPath, analysisPath: reviewerAnalysisPath,
      items: items.map((s, i) => `S-${i + 1} — ${s}`).join('\n'),
      specDir: ctx.specDir, codeRoot: ctx.codeRoot, analysisOutputPath: advData.analysisOutputPath,
      spec: specName,
    });
    const step = await runModelStep({
      role: 'sdd-checker', label: `narrow check v${D}`, briefPath: advData.promptOutputPath,
      stepId: `checker-v${D}`, schema: CHECKER_SCHEMA,
    });
    if (step.error) return step.error;
    const report = (step.result.structuredOutput ?? {}) as CheckerReport;
    const checked = report.items ?? [];
    lastCheckerVerified = {
      k: checked.filter((it) => /addressed|verified|fixed|ruled|pass|ok/i.test(it.status)).length,
      n: items.length,
    };
    return null;
  };

  // --- ledger readers (resume idempotency) ----------------------------------
  // The controller re-enters `runDocumentPhase` on restart; these read this run's
  // own rows so a re-entry does not duplicate phase.start or re-run a finished
  // phase, and so the approval response/HANDOFF count rounds from the ledger (the
  // source of truth across invocations), not a counter reset to 0 on resume.
  const readLedgerRows = (): Record<string, unknown>[] => {
    let text: string;
    try {
      text = readFileSync(ctx.ledger.path, 'utf-8');
    } catch {
      return [];
    }
    const rows: Record<string, unknown>[] = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line) as Record<string, unknown>); } catch { /* torn tail */ }
    }
    return rows.filter((r) => r.run === ctx.run.id);
  };
  const ledgerRoundCount = (): number =>
    readLedgerRows().filter((r) => r.type === 'round' && r.phase === phase).length;
  const totalRoundsNow = (): number => ledgerRoundCount() + (narrowCheckRan ? 1 : 0);

  /** The id of the newest approved record for this document, or undefined. */
  const currentApprovedId = async (): Promise<string | undefined> => {
    const res = await approvalsHandler({
      action: 'list', categoryName: specName, filePath: docRelPath, status: 'approved',
    }, toolContext);
    if (!res.success) return undefined;
    const approvals = (res.data as { approvals: { id: string }[] }).approvals;
    return approvals[0]?.id;
  };

  // --- approval request + approve + prune (SKILL.md Step 5; cleanup.md step 1).
  const createApproval = async (
    D: number, response: string,
  ): Promise<{ approvalId: string } | { error: DocumentPhaseOutcome }> => {
    const req = await approvalsHandler({
      action: 'request', title: `${specName} ${phase} v${D}`, filePath: docRelPath,
      type: 'document', category: 'spec', categoryName: specName,
    }, toolContext);
    if (!req.success) {
      return { error: { result: 'error', version: D, rounds: totalRoundsNow(), reason: `approval request failed: ${req.message}` } };
    }
    const approvalId = (req.data as { approvalId: string }).approvalId;
    const app = await approvalsHandler({ action: 'approve', approvalId, response }, toolContext);
    if (!app.success) {
      return { error: { result: 'error', version: D, rounds: totalRoundsNow(), reason: `approval approve failed: ${app.message}` } };
    }
    await approvalsHandler({
      action: 'prune', categoryName: specName, filePath: docRelPath, keepApprovalId: approvalId,
    }, toolContext);
    return { approvalId };
  };

  // phase.end=approved, written at most once per phase (P4). The tasks phase is
  // approved the moment its document is approved; gate B is a separate human veto
  // surface, not an unfinished phase. The row is recorded as soon as the phase is
  // approved — before gate B parks the run — so the phase-log reflects the
  // converged version/approved instead of reconstructing a false `interrupted`
  // row. The guard keeps a later finalize (or a resume) from writing a second end
  // row for the same phase.
  const recordApprovedPhaseEnd = (D: number, note: string): void => {
    const already = readLedgerRows().some(
      (r) => r.type === 'phase.end' && (r as { phase?: string }).phase === phase
        && (r as { result?: string }).result === 'approved',
    );
    if (!already) ctx.ledger.phaseEnd(phase, { result: 'approved', state: `v${D}`, note });
  };

  // --- cleanup, HANDOFF, phase.end, phase-log, checkpoint (SKILL.md Step 5/6).
  const finalizeApproved = async (
    D: number, approvalId: string | undefined, trajectory: string, cap?: { verified: string },
  ): Promise<DocumentPhaseOutcome> => {
    const totalRounds = totalRoundsNow();
    cleanupReviews(reviewsDir, phase);
    const hoFile = handoffPath(workflowRoot);
    writeHandoffSection(hoFile, specName, phase, {
      state: `approved at v${D} on ${now().toISOString().slice(0, 10)}`,
      rounds: `${totalRounds}; verdicts ${trajectory}`,
      approval: approvalId ?? 'unknown',
      rulings: rulings.length > 0 ? rulings.join('; ') : 'none',
      carried: carriedItems.length > 0 ? carriedItems.join('; ') : 'none',
    });
    recordApprovedPhaseEnd(D, `${totalRounds} rounds`);
    await harnessHandler({ action: 'phase-log', specName }, toolContext);
    await checkpoint({ specStoreRoot: ctx.specStoreRoot, spec: specName, message: `docs(sdd): ${specName} ${phase} approved at v${D}` }, serialize);
    void cap;
    return { result: 'approved', version: D, rounds: totalRounds };
  };

  /** The approval response line (formats.md "Approval response"). */
  const approvalResponse = (D: number, trajectory: string, cap?: { verified: string }): string => {
    const total = totalRoundsNow();
    const capText = cap ? `hit, adjudicated at v${D}, VERIFIED ${cap.verified}` : 'not hit';
    return `v${D}; ${total} review rounds; final verdict ${trajectory}; ` +
      `rulings: ${rulings.length > 0 ? rulings.join('; ') : 'none'}; cap: ${capText}`;
  };

  // --- approve: request+approve+prune, then gate B (tasks) or finalize -------
  const approve = async (
    D: number, trajectory: string, cap?: { verified: string },
  ): Promise<DocumentPhaseOutcome> => {
    const created = await createApproval(D, approvalResponse(D, 'MUST_FIX 0 / SHOULD_FIX 0 / MINOR 0', cap));
    if ('error' in created) return created.error;

    // Gate B after tasks approval (design §5). The controller always waits; on the
    // answer, `runDocumentPhase` re-enters and resolves gate B (see the top of the
    // loop). NO_OP proceeds straight to finalize.
    if (phase === 'tasks') {
      const g = await gates.gateB({
        run: ctx.run, specDir: ctx.specDir, specStoreRoot: ctx.specStoreRoot,
        codeRoot: ctx.codeRoot, version: D,
      });
      if (g.kind === 'waiting') {
        // The tasks document is approved; record phase.end before the gate parks
        // the run so the phase-log reflects v<D>/approved, not a false interrupted
        // row (retro P4). `routeRun` does not re-enter this phase once it is
        // approved, so finalizeApproved never runs here; the guard also prevents a
        // second end row on any direct re-entry.
        recordApprovedPhaseEnd(D, `${totalRoundsNow()} rounds`);
        return { result: 'waiting', version: D, rounds: totalRoundsNow(), waitId: g.waitId };
      }
    }
    return finalizeApproved(D, created.approvalId, trajectory, cap);
  };

  // --- the post-cap adjudicator (convergence.md Step 4a) ---------------------
  // Fix or rule out every open item, write v(D+1), carry the ruled-out SHOULD_FIX
  // (and MINOR left for the word cap) into the next phase's drafter via HANDOFF.
  const adjudicate = async (
    D: number, analysisPath: string, mustFix: string[], shouldFix: string[],
  ): Promise<{ carried: string[] } | { error: DocumentPhaseOutcome }> => {
    const items = [
      ...mustFix.map((s, i) => `M-${i + 1} (MUST_FIX) — ${s}`),
      ...shouldFix.map((s, i) => `S-${i + 1} (SHOULD_FIX) — ${s}`),
    ].join('\n');
    const briefPath = join(reviewsDir, `adjudication-brief-${phase}.md`);
    writeBrief(briefPath, 'adjudicator', {
      items, phase, docPath, D: String(D), analysisPath,
      mustFix: String(mustFix.length), shouldFix: String(shouldFix.length),
      specDir: ctx.specDir, memoryPath, codeRoot: ctx.codeRoot, spec: specName, agentRules,
    });
    const step = await runModelStep({
      role: 'sdd-adjudicator', label: `adjudicate v${D}`, briefPath,
      stepId: `adjudicator-v${D}`, schema: ADJUDICATOR_SCHEMA,
    });
    if (step.error) return { error: step.error };
    await checkpoint({ specStoreRoot: ctx.specStoreRoot, spec: specName, message: `docs(sdd): ${specName} ${phase} v${D + 1} post-cap corrective pass` }, serialize);
    const report = (step.result.structuredOutput ?? {}) as AdjudicatorReport;
    const carried = [
      ...(report.ruledOut ?? []).map((r) => `${r.item} — ${r.reason}`),
      ...(report.carried ?? []),
    ];
    return { carried };
  };

  /**
   * The v4-cap corrective pass (convergence.md Step 4a → 4b → Step 5): adjudicate
   * the open items at v(D) into v(D+1), narrow-check the listed items, then
   * approve whatever k/n says, carrying the ruled-out SHOULD_FIX into HANDOFF.
   */
  const capCorrectivePass = async (
    D: number, analysisPath: string, mustFix: string[], shouldFix: string[],
  ): Promise<DocumentPhaseOutcome> => {
    const adj = await adjudicate(D, analysisPath, mustFix, shouldFix);
    if ('error' in adj) return adj.error;
    carriedItems = adj.carried;
    const correctiveD = D + 1; // the adjudicator wrote v(D+1)
    const checkErr = await narrowCheck(correctiveD, analysisPath, [...mustFix, ...shouldFix]);
    if (checkErr) return checkErr;
    narrowCheckRan = true;
    const verified = `${lastCheckerVerified.k}/${lastCheckerVerified.n}`;
    return approve(correctiveD, 'adjudicated', { verified });
  };

  // --- gate A "do nothing" (gates.md "Gate A"): end the run, tag the spec's
  // decomposition heading `(deferred)` and commit it, keep the drafted
  // requirements. No design, tasks or implementation step runs.
  const deferSpec = async (reason: string): Promise<DocumentPhaseOutcome> => {
    const r = reason.trim();
    ctx.ledger.note(`gate A: do nothing${r ? ` — ${r}` : ''}`);
    const decompPath = join(workflowRoot, 'spec-decomposition', 'decomposition.md');
    if (deferInDecomposition(decompPath, specName, r)) {
      await checkpoint({
        specStoreRoot: ctx.specStoreRoot,
        paths: [relative(ctx.specStoreRoot, decompPath)],
        message: `docs(sdd): ${specName} deferred at gate A`,
      }, serialize);
    }
    return { result: 'deferred', version: D, rounds: 0, reason: r || undefined };
  };

  // =========================================================================
  // Step 0 — orient and phase.start (idempotent on re-entry, design §5).
  // =========================================================================
  const orient = await harnessHandler({ action: 'orient', specName, phase }, toolContext);
  if (!orient.success) {
    return { result: 'error', version: 0, rounds: 0, reason: `orient failed: ${orient.message}` };
  }
  let D = Number((orient.data as { D: number }).D);

  const existingRows = readLedgerRows();
  const hasRow = (type: string): boolean =>
    existingRows.some((r) => r.type === type && (r as { phase?: string }).phase === phase);

  // Idempotent completion: a re-entry after the phase already approved returns the
  // approved outcome without re-running the phase (restart safety, design §5/§8).
  if (existingRows.some((r) =>
    r.type === 'phase.end' && (r as { phase?: string }).phase === phase &&
    (r as { result?: string }).result === 'approved')) {
    return { result: 'approved', version: D, rounds: totalRoundsNow() };
  }
  // phase.start once per run; a resume that already wrote it does not duplicate.
  if (!hasRow('phase.start')) {
    ctx.ledger.phaseStart(phase, { mode: 'normal', state: `v${D}` });
  }
  const roundsStarted = hasRow('round');

  // =========================================================================
  // Gate B resume (tasks): the tasks document is approved and a gate-b wait is
  // open or answered — resolve it here rather than re-run the phase (design §5).
  // =========================================================================
  if (phase === 'tasks') {
    const pg = await gates.pendingGate(ctx.run, 'tasks');
    if (pg) {
      const answers = ctx.gateAnswers ?? pg.answers;
      if (!answers) return { result: 'waiting', version: D, rounds: totalRoundsNow(), waitId: pg.waitId };
      const dir = await gates.resumeAfterGateB({ run: ctx.run, specDir: ctx.specDir, version: pg.version, answers });
      if (dir.kind === 'revise') {
        // Annotation: one advisory reviser round, then re-approve (not re-gated).
        if (D === pg.version) {
          const err = await reviserStep('revision', D, dir.findings, `v${D + 1} gate-B annotation`);
          if (err) return err;
          D += 1;
          const lintErr = await lintStep(D);
          if (lintErr) return lintErr;
        }
        const created = await createApproval(D, approvalResponse(D, 'MUST_FIX 0 / SHOULD_FIX 0 / MINOR 0'));
        if ('error' in created) return created.error;
        return finalizeApproved(D, created.approvalId, 'gate-b annotation');
      }
      return finalizeApproved(D, await currentApprovedId(), 'converged');
    }
  }

  // =========================================================================
  // Gate A resume (requirements): a gate-a wait is open or answered and the
  // review rounds have not started — resolve it before the rounds loop.
  // =========================================================================
  let gateAResolved = roundsStarted; // rounds already started ⇒ gate A is behind us
  if (phase === 'requirements' && !roundsStarted) {
    const pg = await gates.pendingGate(ctx.run, 'requirements');
    if (pg) {
      const answers = ctx.gateAnswers ?? pg.answers;
      if (!answers) return { result: 'waiting', version: D, rounds: 0, waitId: pg.waitId };
      const dir = await gates.resumeAfterGateA({ run: ctx.run, specDir: ctx.specDir, version: D, answers });
      // "Do nothing": end the run here, before any further document step.
      if (dir.kind === 'defer') return deferSpec(dir.reason);
      // A changed answer is a reviser revision at v(D+1) (revision.md), run once:
      // only when it has not already landed (D still at the gate version).
      if (dir.kind === 'revise' && D === pg.version) {
        const err = await reviserStep('revision', D, dir.findings, `v${D + 1} gate-A revision`);
        if (err) return err;
        D += 1;
        const lintErr = await lintStep(D);
        if (lintErr) return lintErr;
      }
      gateAResolved = true;
    }
  }

  // =========================================================================
  // Step 1 — draft v1 when the document does not exist (SKILL.md Step 1).
  // =========================================================================
  if (D === 0) {
    const briefPath = join(reviewsDir, `drafter-brief-${phase}.md`);
    writeBrief(briefPath, 'drafter', {
      phase, docPath, specDir: ctx.specDir, specStoreRoot: workflowRoot, codeRoot: ctx.codeRoot,
      carried: readCarriedFromHandoff(handoffPath(workflowRoot), specName, phase), spec: specName, agentRules,
    });
    const draft = await runModelStep({
      role: 'sdd-drafter', label: 'draft v1', briefPath, stepId: 'drafter', schema: DRAFTER_SCHEMA, round: '1',
    });
    if (draft.error) return draft.error;
    if (!existsSync(docPath)) {
      return { result: 'error', version: 0, rounds: 0, reason: `drafter wrote no ${phase}.md` };
    }
    await checkpoint({ specStoreRoot: ctx.specStoreRoot, spec: specName, message: `docs(sdd): ${specName} ${phase} v1` }, serialize);
    D = 1;

    const lintErr = await lintStep(D);
    if (lintErr) return lintErr;

    // Gate A after v1 and the lint step (design §5; gates.md "Gate A"): rank the
    // drafter's decisions, write the wait, park. NO_OP proceeds.
    if (phase === 'requirements' && !gateAResolved) {
      const report = (draft.result.structuredOutput ?? {}) as DrafterReport;
      const g = await gates.gateA({ run: ctx.run, specDir: ctx.specDir, version: 1, decisions: report.decisions ?? [] });
      if (g.kind === 'waiting') return { result: 'waiting', version: 1, rounds: 0, waitId: g.waitId };
    }
  }

  // =========================================================================
  // Step 2/3 — the review rounds (SKILL.md Step 2 item 9 routing).
  // =========================================================================
  for (;;) {
    // Build the adversarial prompt with the generator (verdictBlock: true),
    // then append the reviewer round section (the machine-verified bullet, the
    // lens, the closed-by-ruling line) and the `## Changes since v<N-1>` diff.
    const adv = await adversarialReviewHandler({ specName, phase, verdictBlock: true }, toolContext);
    if (!adv.success) {
      return { result: 'error', version: D, rounds: reviewRounds, reason: `adversarial-review failed: ${adv.message}` };
    }
    const advData = adv.data as { promptOutputPath: string; analysisOutputPath: string };
    const promptPath = advData.promptOutputPath;
    const analysisOutputPath = advData.analysisOutputPath;

    const reviewerSection = renderBrief('reviewer', {
      phase, D: String(D), specDir: ctx.specDir, lintChecks, lintOpen: '', reDecided: 'none',
      overCap: 'none', lens: 'none', closedByRuling: 'none', memoryPath,
      codeRoot: ctx.codeRoot, specStoreRoot: workflowRoot, spec: specName, agentRules,
    });
    appendFileSync(promptPath, '\n' + reviewerSection);
    appendChangesDiff(promptPath, ctx.specStoreRoot, docRelPath, specName, phase, D);

    reviewRounds += 1;
    const review = await runModelStep({
      role: 'sdd-reviewer', label: `review v${D}`, briefPath: promptPath,
      stepId: `reviewer-r${reviewRounds}`, schema: REVIEWER_SCHEMA, round: String(reviewRounds),
    });
    if (review.error) return review.error;

    const report = (review.result.structuredOutput ?? {}) as ReviewerReport;
    const mustFix = report.mustFix ?? [];
    const shouldFix = report.shouldFix ?? [];
    const verdict = report.verdict;
    const escalate = report.escalate ?? 'none';
    const analysisPath = report.analysisPath && report.analysisPath.length > 0
      ? report.analysisPath : analysisOutputPath;

    ctx.ledger.round({
      phase, round: reviewRounds, version: `v${D}`,
      verdict: `${verdict} ${mustFix.length}/${shouldFix.length}/0`,
    });

    // ESCALATE (SKILL.md Step 2 item 6): a `note`, then stop.
    if (escalate && escalate !== 'none') {
      ctx.ledger.note(`escalate: ${escalate}`);
      return { result: 'escalate', version: D, rounds: reviewRounds, reason: escalate };
    }

    const recurring = report.recurring ?? [];
    roundFindings.push({ mustFix, shouldFix, recurring });

    // Standoff (convergence.md "Standoff check", round 2+; T5b rule): a Recurring
    // MUST_FIX the reviewer re-raised in the two most recent consecutive rounds is
    // ruled rejected — accept the reviser's rejection, write a `note`, and drop it
    // from the open set so it no longer forces a round.
    if (reviewRounds >= 2) {
      const prev = roundFindings[roundFindings.length - 2];
      for (const f of mustFix) {
        if (recurring.includes(f) && prev.mustFix.includes(f) && !ruledOut.has(f)) {
          ctx.ledger.note(`ruling: ${f} — rejected (standoff: Recurring MUST_FIX rejected twice)`);
          rulings.push(`${f}: rejected (standoff)`);
          ruledOut.add(f);
        }
      }
    }
    const openMustFix = mustFix.filter((f) => !ruledOut.has(f));

    // Converged, or MINOR-only (open MUST_FIX 0 and SHOULD_FIX 0) ⇒ approve.
    if (verdict === 'converged' || (openMustFix.length === 0 && shouldFix.length === 0)) {
      return approve(D, 'converged');
    }

    // SHOULD_FIX-only pass (convergence.md Step 4b): a corrective reviser version,
    // lint, a narrow check, then approve with no further review round.
    if (openMustFix.length === 0 && shouldFix.length > 0 && D >= 2) {
      const reviseErr = await reviserStep('should-fix-only', D, analysisPath, `v${D + 1} SHOULD_FIX-only corrective pass`);
      if (reviseErr) return reviseErr;
      D += 1;
      const lintErr = await lintStep(D);
      if (lintErr) return lintErr;

      const checkErr = await narrowCheck(D, analysisPath, shouldFix);
      if (checkErr) return checkErr;
      narrowCheckRan = true;
      return approve(D, 'should-fix-only → converged');
    }

    // Circling (convergence.md "Circling check", round 2+): the two most recent
    // rounds re-litigate one single item ⇒ adjudicate it now rather than spawn
    // another review round (may fire before the v4 cap).
    if (reviewRounds >= 2 && D < V_CAP && isCircling(roundFindings)) {
      return capCorrectivePass(D, analysisPath, openMustFix, shouldFix);
    }

    // The v4 cap (convergence.md "Cap convergence check" / Step 4a). A converging
    // run earns one more review round, once per phase, when the last round's
    // MUST_FIX strictly decreased; otherwise the adjudicator corrective pass runs.
    if (D >= V_CAP) {
      if (!capExtraRoundSpent && mustFixStrictlyDecreased(roundFindings)) {
        capExtraRoundSpent = true; // spend the one extra round, then revise + review
      } else {
        return capCorrectivePass(D, analysisPath, openMustFix, shouldFix);
      }
    }

    // `iterate` with fuel: revise, lint, review the next version (SKILL.md Step 3).
    const reviseErr = await reviserStep('round', D, analysisPath, `v${D + 1} after round ${reviewRounds}`);
    if (reviseErr) return reviseErr;
    D += 1;
    const lintErr = await lintStep(D);
    if (lintErr) return lintErr;
  }
}

// ---------------------------------------------------------------------------
// Brief rendering (call the `brief-templates` render functions directly).
// ---------------------------------------------------------------------------

interface LintFinding { severity: string; rule: string; line: number; message: string }

/**
 * Render a brief the way `harness brief` fills it, but in-process: default the
 * template's optional keys to '' and drop `agentRules` when it is unset (so the
 * read-and-obey line is omitted), exactly as `briefAction` does.
 */
function renderBrief(name: string, values: Record<string, string | undefined>): string {
  const tmpl = BRIEF_TEMPLATES[name];
  if (!tmpl) throw new Error(`renderBrief: unknown template '${name}'`);
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) merged[k] = v;
  }
  for (const key of tmpl.optional ?? []) {
    if (merged[key] === undefined) merged[key] = '';
  }
  return tmpl.render(merged);
}

/** Render a brief and write it to its file (write-mode briefs). */
function writeBrief(path: string, name: string, values: Record<string, string | undefined>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, renderBrief(name, values), 'utf-8');
}

// ---------------------------------------------------------------------------
// The `## Changes since <sha>` round-prompt diff (cleanup.md "Round prompt
// changes"): the diff of the document since its last checkpoint commit.
// ---------------------------------------------------------------------------

function appendChangesDiff(
  promptPath: string, repoRoot: string, docRelPath: string, spec: string, phase: string, D: number,
): void {
  const want = D === 1 ? 1 : D - 1;
  const pattern = D === 1
    ? `^docs\\(sdd\\): ${spec} ${phase} v1$`
    : `^docs\\(sdd\\): ${spec} ${phase} v${want}( |$)`;
  const git = (args: string[]): string =>
    execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf-8', env: scrubbedGitEnv() });

  let base = '';
  try {
    base = git(['log', '-1', '--format=%H', '-E', '--grep', pattern, '--', docRelPath]).trim();
  } catch {
    base = '';
  }
  if (!base) {
    appendFileSync(promptPath, `\n## Changes: no checkpoint commit found for v${want}\n`);
    return;
  }
  const short = git(['rev-parse', '--short', base]).trim();
  const body = git(['diff', base, '--', docRelPath]).split('\n');
  const cap = 500;
  let out = `\n## Changes since ${short}\n\n\`\`\`\`diff\n` + body.slice(0, cap).join('\n') + '\n';
  if (body.length > cap) out += `[truncated at ${cap} lines; read the document]\n`;
  out += '````\n';
  appendFileSync(promptPath, out);
}

// ---------------------------------------------------------------------------
// Cleanup: delete only this phase's per-round prompts and briefs (cleanup.md
// step 2); analyses, the memory file and `codebase-context.md` are kept.
// ---------------------------------------------------------------------------

function cleanupReviews(reviewsDir: string, phase: string): void {
  let files: string[];
  try {
    files = readdirSync(reviewsDir);
  } catch {
    return;
  }
  const patterns = [
    new RegExp(`^adversarial-prompt-${phase}(-r\\d+)?\\.md$`),
    new RegExp(`^drafter-brief-${phase}\\.md$`),
    new RegExp(`^reviser-brief-${phase}-v\\d+\\.md$`),
    new RegExp(`^lint-brief-${phase}-v\\d+\\.md$`),
    new RegExp(`^adjudication-brief-${phase}(-r\\d+)?\\.md$`),
  ];
  for (const f of files) {
    if (patterns.some((p) => p.test(f))) {
      try { unlinkSync(join(reviewsDir, f)); } catch { /* already gone */ }
    }
  }
}

// ---------------------------------------------------------------------------
// The HANDOFF `## <spec> — <phase>` section (cleanup.md step 5). Replaces the
// section in place, or creates the file/section when absent. The routing header
// and the `## Phase log` table (owned by `phase-log`) are left untouched.
// ---------------------------------------------------------------------------

function writeHandoffSection(
  hoFile: string, spec: string, phase: string,
  fields: { state: string; rounds: string; approval: string; rulings?: string; carried?: string },
): void {
  const header = `## ${spec} — ${phase}`;
  const block = [
    header,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| State | ${fields.state} |`,
    `| Rounds | ${fields.rounds} |`,
    `| Approval | \`${fields.approval}\` |`,
    `| Rulings | ${fields.rulings ?? 'none'} |`,
    '| Cut scope | none |',
    `| Carried items | ${fields.carried ?? 'none'} |`,
    '| Next phase loads | codebase-context.md |',
    '',
  ].join('\n');

  let content = '';
  try {
    content = readFileSync(hoFile, 'utf-8');
  } catch {
    content = '';
  }

  const lines = content.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === header) { start = i; break; }
  }
  if (start === -1) {
    const sep = content.length === 0 ? '' : (content.endsWith('\n') ? '\n' : '\n\n');
    writeFileSync(hoFile, content + sep + block + '\n', 'utf-8');
    return;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  const rebuilt = [...lines.slice(0, start), ...block.split('\n'), ...lines.slice(end)];
  writeFileSync(hoFile, rebuilt.join('\n'), 'utf-8');
}

// ---------------------------------------------------------------------------
// T5b convergence predicates (convergence.md). Pure functions over the per-round
// findings the rounds loop records, so the controller never reads a model.
// ---------------------------------------------------------------------------

interface RoundFinding { mustFix: string[]; shouldFix: string[]; recurring: string[] }

/**
 * The cap's "MUST_FIX strictly decreased" test (convergence.md "Cap convergence
 * check"): the last round's MUST_FIX count is strictly below the round before it.
 */
function mustFixStrictlyDecreased(rounds: RoundFinding[]): boolean {
  if (rounds.length < 2) return false;
  const last = rounds[rounds.length - 1];
  const prev = rounds[rounds.length - 2];
  return last.mustFix.length < prev.mustFix.length;
}

/**
 * Circling (convergence.md "Circling check"): the two most recent rounds both
 * re-litigate one single item and nothing else. The controller has no model to
 * group findings by the requirement they name, so it detects the deterministic
 * case: each of the last two rounds carries exactly one substantive finding
 * (MUST_FIX or SHOULD_FIX) and it is the same string. A conservative proxy — it
 * never fires on a genuinely multi-item round.
 */
function isCircling(rounds: RoundFinding[]): boolean {
  if (rounds.length < 2) return false;
  const subst = (r: RoundFinding): string[] => [...r.mustFix, ...r.shouldFix];
  const a = subst(rounds[rounds.length - 1]);
  const b = subst(rounds[rounds.length - 2]);
  return a.length === 1 && b.length === 1 && a[0] === b[0];
}

/**
 * Mark the spec's decomposition heading deferred (gate A "do nothing"): on the
 * `### N. \`<spec>\` — title` line append ` (deferred)` (what `nextUnstartedSpec`
 * skips on), and, when a reason is given, insert it as an italic line under the
 * heading. Both are idempotent. Returns true when the file was changed; a missing
 * file, missing heading or already-deferred-and-noted heading returns false.
 */
function deferInDecomposition(decompPath: string, spec: string, reason: string): boolean {
  let text: string;
  try {
    text = readFileSync(decompPath, 'utf-8');
  } catch {
    return false;
  }
  const lines = text.split('\n');
  const note = reason.length > 0 ? `_Deferred: ${reason}_` : '';
  for (let i = 0; i < lines.length; i++) {
    const m = /^###\s+\d+\.\s+`([\w.-]+)`(.*)$/.exec(lines[i]);
    if (!m || m[1] !== spec) continue;
    let changed = false;
    if (!/\(deferred\)/i.test(lines[i])) {
      lines[i] = lines[i].replace(/\s*$/, '') + ' (deferred)';
      changed = true;
    }
    if (note && lines[i + 1]?.trim() !== note) {
      lines.splice(i + 1, 0, note);
      changed = true;
    }
    if (changed) writeFileSync(decompPath, lines.join('\n'), 'utf-8');
    return changed;
  }
  return false;
}

/**
 * The `| Carried items |` row of the previous phase's HANDOFF section, filling the
 * drafter brief's `## Carried from <prevPhase>` (the field the drafter template
 * reads; convergence.md Step 4a carry). `none` when there is no previous phase,
 * no HANDOFF, or no row.
 */
function readCarriedFromHandoff(hoFile: string, spec: string, phase: DocumentPhase): string {
  const prev = phase === 'design' ? 'requirements' : phase === 'tasks' ? 'design' : null;
  if (!prev) return 'none';
  let content: string;
  try {
    content = readFileSync(hoFile, 'utf-8');
  } catch {
    return 'none';
  }
  const lines = content.split('\n');
  const header = `## ${spec} — ${prev}`;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === header) { start = i; break; }
  }
  if (start === -1) return 'none';
  for (let i = start + 1; i < lines.length && !lines[i].startsWith('## '); i++) {
    const m = /^\|\s*Carried items\s*\|\s*(.+?)\s*\|/.exec(lines[i]);
    if (m) return m[1].trim().length > 0 ? m[1].trim() : 'none';
  }
  return 'none';
}
