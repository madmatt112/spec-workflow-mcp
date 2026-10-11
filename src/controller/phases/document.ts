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
// The gate hook (T5b extension point).
// ---------------------------------------------------------------------------

/** Info a gate hook receives when the loop reaches it. */
export interface GateAInput {
  version: number;
  /** The drafter's `decisions` report field (gate A's questions in T5b). */
  decisions: unknown[];
}
export interface GateBInput {
  version: number;
}

/** A gate either lets the loop proceed, or hands back an outcome (a `waiting`). */
export type GateResult =
  | { proceed: true }
  | { proceed: false; outcome: DocumentPhaseOutcome };

/**
 * The two document-phase gates (design §5). T5a calls them at the gate points
 * but the defaults always proceed; T5b supplies real hooks that write a `gate-a`
 * or `gate-b` wait and return `{ proceed: false, outcome: { result: 'waiting' } }`.
 */
export interface DocumentGates {
  gateA(input: GateAInput): Promise<GateResult>;
  gateB(input: GateBInput): Promise<GateResult>;
}

/** The no-op gates T5a runs with: both proceed. */
export const NO_OP_GATES: DocumentGates = {
  async gateA() { return { proceed: true }; },
  async gateB() { return { proceed: true }; },
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
  onRateLimit?: (w: RateLimitWindows) => void;
  /** Gate A/B hooks; defaults to {@link NO_OP_GATES} (T5b supplies real ones). */
  gates?: DocumentGates;
  /** Serialises spec-store commits; defaults to the T2 per-store lock. */
  serialize?: Serialize;
  /** Clock seam for tests. */
  now?: () => Date;
}

export interface DocumentPhaseOutcome {
  /** `waiting` is reserved for T5b's gate A/B. */
  result: 'approved' | 'escalate' | 'error' | 'waiting';
  /** The final document version D. */
  version: number;
  /** Review rounds run (reviewer spawns plus the narrow check when it ran). */
  rounds: number;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Report schemas for the three role steps that return one (design §5).
// The stub ignores them; a real `claude` validates its structured output.
// ---------------------------------------------------------------------------

const DRAFTER_SCHEMA = {
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

interface DrafterReport { wordCount?: number; decisions?: unknown[]; contextFileWritten?: boolean }
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
      onActivity: ctx.onActivity,
      onRateLimit: ctx.onRateLimit,
    };
    const result = await runStep(spec);
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
    await checkpoint({ specStoreRoot: ctx.specStoreRoot, message: `docs(sdd): ${specName} ${phase} v${D} lint` }, serialize);
    return null;
  };

  // --- a reviser step to v(D+1) (SKILL.md Step 3 / Step 2 item 9) -----------
  const reviserStep = async (
    variant: 'round' | 'should-fix-only', D: number, analysisPath: string, commitMsg: string,
  ): Promise<DocumentPhaseOutcome | null> => {
    const briefPath = join(reviewsDir, `reviser-brief-${phase}-v${D + 1}.md`);
    writeBrief(briefPath, 'reviser', {
      variant, phase, D: String(D), docPath, specDir: ctx.specDir, findings: analysisPath,
      memoryPath, closedByRuling: 'none', spec: specName, agentRules,
    });
    const step = await runModelStep({
      role: 'sdd-reviser', label: `revise v${D + 1}`, briefPath, stepId: `reviser-v${D + 1}`,
      round: String(reviewRounds),
    });
    if (step.error) return step.error;
    await checkpoint({ specStoreRoot: ctx.specStoreRoot, message: `docs(sdd): ${specName} ${phase} ${commitMsg}` }, serialize);
    return null;
  };

  // --- the narrow check (convergence.md Step 4b) ----------------------------
  // A fresh adversarial-review scaffold (no verdict block) whose prompt is
  // overwritten with the checker brief; the checker verifies only that each
  // listed item was addressed, then approval follows whatever k/n says.
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
    return null;
  };

  // --- approve, prune, clean, HANDOFF, phase.end (SKILL.md Step 5/6) --------
  const approve = async (D: number, trajectory: string): Promise<DocumentPhaseOutcome> => {
    const totalRounds = reviewRounds + (narrowCheckRan ? 1 : 0);
    const response =
      `v${D}; ${totalRounds} review rounds; final verdict MUST_FIX 0 / SHOULD_FIX 0 / MINOR 0; ` +
      `rulings: none; cap: not hit`;

    const req = await approvalsHandler({
      action: 'request', title: `${specName} ${phase} v${D}`, filePath: docRelPath,
      type: 'document', category: 'spec', categoryName: specName,
    }, toolContext);
    if (!req.success) {
      return { result: 'error', version: D, rounds: totalRounds, reason: `approval request failed: ${req.message}` };
    }
    const approvalId = (req.data as { approvalId: string }).approvalId;

    const app = await approvalsHandler({ action: 'approve', approvalId, response }, toolContext);
    if (!app.success) {
      return { result: 'error', version: D, rounds: totalRounds, reason: `approval approve failed: ${app.message}` };
    }

    // Prune superseded records and their snapshots (cleanup.md step 1).
    await approvalsHandler({
      action: 'prune', categoryName: specName, filePath: docRelPath, keepApprovalId: approvalId,
    }, toolContext);

    // Gate B after tasks approval (design §5; T5b). Default: proceed.
    if (phase === 'tasks') {
      const g = await gates.gateB({ version: D });
      if (!g.proceed) return g.outcome;
    }

    // Delete per-round prompts and briefs; keep analyses, memory and the
    // context file (cleanup.md steps 2-3).
    cleanupReviews(reviewsDir, phase);

    // HANDOFF `## <spec> — <phase>` section (cleanup.md step 5), then the
    // phase-log row via the `phase-log` action.
    const hoFile = handoffPath(workflowRoot);
    writeHandoffSection(hoFile, specName, phase, {
      state: `approved at v${D} on ${now().toISOString().slice(0, 10)}`,
      rounds: `${totalRounds}; verdicts ${trajectory}`,
      approval: approvalId,
    });

    // phase.end is written before phase-log so the row renders from the ledger
    // (phase-log derives `## Phase log` rows from `phase.end` events).
    ctx.ledger.phaseEnd(phase, { result: 'approved', state: `v${D}`, note: `${totalRounds} rounds` });
    await harnessHandler({ action: 'phase-log', specName }, toolContext);

    await checkpoint({ specStoreRoot: ctx.specStoreRoot, message: `docs(sdd): ${specName} ${phase} approved at v${D}` }, serialize);
    return { result: 'approved', version: D, rounds: totalRounds };
  };

  // =========================================================================
  // Step 1 — orient, then v1 when the document does not exist (SKILL.md Step 0/1).
  // =========================================================================
  const orient = await harnessHandler({ action: 'orient', specName, phase }, toolContext);
  if (!orient.success) {
    return { result: 'error', version: 0, rounds: 0, reason: `orient failed: ${orient.message}` };
  }
  let D = Number((orient.data as { D: number }).D);

  // phase.start at phase entry (SKILL.md Step 0: "record phase.start at the end
  // of Step 0"), state = the orient D (v0 when the document does not yet exist).
  ctx.ledger.phaseStart(phase, { mode: 'normal', state: `v${D}` });

  if (D === 0) {
    const briefPath = join(reviewsDir, `drafter-brief-${phase}.md`);
    writeBrief(briefPath, 'drafter', {
      phase, docPath, specDir: ctx.specDir, specStoreRoot: workflowRoot, codeRoot: ctx.codeRoot,
      carried: 'none', spec: specName, agentRules,
    });
    const draft = await runModelStep({
      role: 'sdd-drafter', label: 'draft v1', briefPath, stepId: 'drafter', schema: DRAFTER_SCHEMA, round: '1',
    });
    if (draft.error) return draft.error;
    if (!existsSync(docPath)) {
      return { result: 'error', version: 0, rounds: 0, reason: `drafter wrote no ${phase}.md` };
    }
    await checkpoint({ specStoreRoot: ctx.specStoreRoot, message: `docs(sdd): ${specName} ${phase} v1` }, serialize);
    D = 1;

    // Gate A after requirements v1 (design §5; T5b). Default: proceed.
    if (phase === 'requirements') {
      const report = (draft.result.structuredOutput ?? {}) as DrafterReport;
      const g = await gates.gateA({ version: 1, decisions: report.decisions ?? [] });
      if (!g.proceed) return g.outcome;
    }

    const lintErr = await lintStep(D);
    if (lintErr) return lintErr;
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

    // Converged, or an `iterate` with MUST_FIX 0 and SHOULD_FIX 0 (MINOR-only,
    // treated as converged — convergence.md) ⇒ approve.
    if (verdict === 'converged' || (mustFix.length === 0 && shouldFix.length === 0)) {
      return approve(D, 'converged');
    }

    // SHOULD_FIX-only pass (SKILL.md Step 2 item 9; convergence.md Step 4b):
    // a corrective reviser version, lint, a narrow check, then approve with no
    // further review round.
    if (mustFix.length === 0 && shouldFix.length > 0 && D >= 2) {
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

    // The v4 cap (SKILL.md Step 2 item 9; convergence.md Step 4a). Adjudication
    // is T5b: for now, stop with a cap error.
    // TODO(T5b): Cap convergence check, then the adjudicator + checker corrective
    // pass, then approve, carrying ruled-out SHOULD_FIX into the next drafter.
    if (D >= V_CAP) {
      return { result: 'error', version: D, rounds: reviewRounds, reason: 'cap' };
    }

    // `iterate` with fuel: revise, lint, review the next version (SKILL.md Step 3).
    // Note: the round-2+ circling and standoff checks are T5b (they adjudicate).
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
  fields: { state: string; rounds: string; approval: string },
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
    '| Rulings | none |',
    '| Cut scope | none |',
    '| Carried items | none |',
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
