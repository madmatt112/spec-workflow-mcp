import path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse, ReviewFinding, PromptSection, ImplementationLogEntry } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { resolveLoggedFiles, type DropCause, type ResolvedFile } from '../core/file-resolution.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { TaskReviewManager, validateVerdictConsistency } from '../core/task-review-manager.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';
import { computeHygieneSignals, HygieneSignal } from '../core/hygiene-signals.js';
import { runProjectTypecheck, TypecheckResult } from '../core/typecheck.js';
import { loadSettings, isTypecheckEnabled } from '../core/adversarial-settings.js';
import { computeTaskDiff, isAncestorOfHead, TaskDiffResult, type AncestryResult } from '../core/task-diff.js';
import { selectRoots } from './root-selection.js';
import { handleGate } from './review-gate.js';
import { TaskStateStore, type TaskStateRecord } from '../core/task-state-store.js';
import { normalizeIdentityPath } from '../core/git-utils.js';

const reviewWarnedKeys = new Set<string>();

/** Test-only: clears this module's warn-once ledger. */
export function _resetReviewWarnings(): void {
  reviewWarnedKeys.clear();
}

function warnOnce(key: string, message: string): void {
  if (reviewWarnedKeys.has(key)) return;
  reviewWarnedKeys.add(key);
  console.warn(message);
}

type HygieneResult = { signals: HygieneSignal[]; rejection?: { message: string } };

/**
 * The tech steering document is inlined into the prepare response as
 * `steeringExcerpt`. Over this many bytes it is NOT inlined (retro P5): a large
 * page (a 74 KB methodology page in the trust-pages run) forced the reviewer to
 * re-extract it from disk, so past the cap the response carries the file's path
 * and byte size instead of its contents and the reviewer reads it from disk.
 */
export const STEERING_INLINE_CAP_BYTES = 32 * 1024;

export type DiffMethodologyState =
  | { kind: 'present' }
  | { kind: 'present-truncated' }
  | { kind: 'empty' }
  | { kind: 'no-files' }
  | { kind: 'rejected'; message: string };

/**
 * `noReviewableFiles` (from `hasNoReviewableFiles`, not from `computeTaskDiff`'s
 * empty-`kept` return — design D14) yields the `no-files` kind. Precedence:
 * rejection, then no-files, then empty, then truncation. A containment or
 * git-failure rejection therefore keeps the `rejected` kind and its own message
 * (requirement 5.6) even when the file set is empty.
 */
export function computeDiffMethodologyState(
  result: TaskDiffResult,
  noReviewableFiles = false
): DiffMethodologyState {
  if (result.rejection !== undefined) {
    return { kind: 'rejected', message: result.rejection.message };
  }
  if (noReviewableFiles) return { kind: 'no-files' };
  if (result.diff === '') return { kind: 'empty' };
  if (result.truncated) return { kind: 'present-truncated' };
  return { kind: 'present' };
}

export type TypecheckMethodologyState =
  | { kind: 'success-clean-full' }
  | { kind: 'success-with-diagnostics'; truncated: boolean }
  | { kind: 'success-partial-coverage' }
  | { kind: 'success-with-diagnostics-and-partial-coverage'; truncated: boolean }
  | { kind: 'unavailable-feature-disabled' }
  | { kind: 'unavailable-other'; reason: string }
  | { kind: 'timeout' };

export function computeTypecheckMethodologyState(
  result: TypecheckResult
): TypecheckMethodologyState {
  if (result.status === 'timeout') return { kind: 'timeout' };
  if (result.status === 'unavailable') {
    if (result.reason === 'feature-disabled') {
      return { kind: 'unavailable-feature-disabled' };
    }
    return { kind: 'unavailable-other', reason: result.reason };
  }
  const hasDiagnostics = result.diagnostics.length > 0;
  const partialCoverage = result.coverage.excluded.length > 0;
  const truncated = result.truncated === true;
  if (hasDiagnostics && partialCoverage) {
    return { kind: 'success-with-diagnostics-and-partial-coverage', truncated };
  }
  if (hasDiagnostics) return { kind: 'success-with-diagnostics', truncated };
  if (partialCoverage) return { kind: 'success-partial-coverage' };
  return { kind: 'success-clean-full' };
}

function rejectionMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function unwrapTypecheck(
  settled: PromiseSettledResult<TypecheckResult[]>,
  /**
   * The compiled tree (requirement 4.2). `tsconfigPath` must name the same file
   * on this arm as on the ones `runProjectTypecheck` returns itself; reporting
   * the workflow root here would make the rejection arm describe a different
   * tree than the success arm.
   */
  workspacePath: string
): TypecheckResult[] {
  if (settled.status === 'fulfilled') return settled.value;
  const message = rejectionMessage(settled.reason);
  warnOnce(
    `unwrap:typecheck:${message}`,
    `[spec-workflow] handlePrepare: typecheck rejected unexpectedly: ${message}`
  );
  return [{
    tsconfigPath: path.join(workspacePath, 'tsconfig.json'),
    status: 'unavailable',
    reason: 'rejection',
    observed: `the typecheck promise rejected: \`${message}\``,
    rejectionMessage: message,
  }];
}

export function unwrapHygiene(
  settled: PromiseSettledResult<HygieneSignal[]>
): HygieneResult {
  if (settled.status === 'fulfilled') return { signals: settled.value };
  const message = rejectionMessage(settled.reason);
  warnOnce(
    `unwrap:hygiene:${message}`,
    `[spec-workflow] handlePrepare: hygiene rejected unexpectedly: ${message}`
  );
  return { signals: [], rejection: { message } };
}

/**
 * One of TWO producers of `TaskDiffResult.rejection`.
 *
 * This arm carries a thrown exception's `.message`. The other is
 * `computeTaskDiff`'s containment assertion (requirement 4.23), which fills the
 * same field with its own stated text (`containmentRejectionMessage`) rather
 * than inheriting the wording used here or in `R4_2B_DIFF_REJECTED` — a
 * mis-partitioned pathspec is not an unexpected exception (requirement 4.24).
 * One field, two producers, on purpose: `computeDiffMethodologyState` classifies
 * both as `rejected`, which is what keeps either from being read as the `empty`
 * diff — "the task changes were already committed" — that a discarded pathspec
 * would otherwise produce.
 *
 * Either message is READ by the agent only on the direct-call path, as
 * `data.diffRejection.message`. `TaskReviewRunner` names no diff field in its
 * destructure of `prepareResponse.data`, so on the dashboard-spawned path the
 * classification above is all that survives — the wording does not. Residual,
 * deferred as `d-6e59490b`.
 */
export function unwrapDiff(
  settled: PromiseSettledResult<TaskDiffResult>
): TaskDiffResult {
  if (settled.status === 'fulfilled') return settled.value;
  const message = rejectionMessage(settled.reason);
  warnOnce(
    `unwrap:diff:${message}`,
    `[spec-workflow] handlePrepare: diff rejected unexpectedly: ${message}`
  );
  return {
    diff: '',
    stats: undefined,
    skippedPaths: [],
    truncated: false,
    rejection: { message },
  };
}

export const reviewTaskTool: Tool = {
  name: 'review-task',
  description: `Review a task's implementation against its spec. Typically called before marking a task complete, but also supported for retroactive review of already-completed tasks.

# Instructions

Call after log-implementation succeeds. The task may be in-progress [-] or already completed [x] — reviews work for both. Task status is not modified by reviewing.

Three actions:
- **prepare**: Gathers task context (requirements, restrictions, success criteria), implementation log summary, and tech steering. Returns a review methodology to evaluate the implementation against. Also writes a prepare marker to gate the record action.
- **record**: Persists review findings. Requires prepare to have been called first.
- **gate**: Runs the deterministic mechanical checks (project typecheck, hygiene scan, diff statistics and the task's named checks) and returns a pass/fail verdict with a low/high risk score, recording a passing review for a low-risk task gate. No LLM review.

# Verdicts
- **pass**: Clean review, no findings at all
- **fail**: At least one critical finding (blocks completion)
- **findings**: Warnings/info only, no criticals (advisory)

# Workflow
1. Call with action: "prepare" to get review context and methodology
2. Read all implementation files listed in the response
3. Evaluate implementation against the methodology checklist
4. Call with action: "record" to persist findings

Note: If a review was triggered from the dashboard (fresh-context review), use get-task-review to retrieve the findings instead.`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['prepare', 'record', 'gate'],
        description: 'Action to perform'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the workspace under review (optional - uses the server context roots if not provided). When provided it replaces the context workspace, and the shared workflow root holding .spec-workflow is derived from it.'
      },
      specName: {
        type: 'string',
        description: 'Name of the specification (kebab-case)'
      },
      taskId: {
        type: 'string',
        description: 'Task ID (e.g., "1", "1.2", "3.1.4")'
      },
      // record-only fields
      verdict: {
        type: 'string',
        enum: ['pass', 'fail', 'findings'],
        description: 'Review verdict (record action only)'
      },
      summary: {
        type: 'string',
        description: 'Brief summary of review outcome (record action only)'
      },
      findings: {
        type: 'array',
        description: 'Array of review findings (record action only)',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
            title: { type: 'string' },
            file: { type: 'string' },
            line: { type: 'number' },
            description: { type: 'string' },
            taskRequirement: { type: 'string' },
            category: { type: 'string', enum: ['spec-compliance', 'hygiene'] }
          },
          required: ['severity', 'title', 'description']
        }
      },
      // gate-only fields
      baseRef: {
        type: 'string',
        description: 'A git revision; the change is everything after it (gate action only)'
      },
      commit: {
        type: 'string',
        description: 'One commit sha; the change is that commit alone (gate action only)'
      },
      checks: {
        type: 'array',
        description: "Shell command strings to run in order — the task's named checks (gate action only)",
        items: { type: 'string' }
      },
      files: {
        type: 'array',
        description: 'Paths relative to root the change should stay within (gate action only)',
        items: { type: 'string' }
      },
      root: {
        type: 'string',
        description: "Absolute directory; the pre-computations' working tree, defaulting to the workspace under review (gate action only)"
      }
    },
    required: ['action', 'specName', 'taskId']
  },
  annotations: {
    title: 'Review Task',
    readOnlyHint: false,
  }
};

export async function reviewTaskHandler(
  args: any,
  context: ToolContext
): Promise<ToolResponse> {
  const { action, specName, taskId } = args;
  // An explicit `projectPath` argument is the workspace under review; the
  // workflow root is derived from it rather than taken verbatim (requirements
  // 3.5-3.7). With no override both roots come off the context unchanged.
  const { workflowRoot: projectPath, workspacePath } = selectRoots(args, context);

  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required but not provided in context or arguments'
    };
  }

  const specPath = PathUtils.getSpecPath(projectPath, specName);

  if (action === 'prepare') {
    return handlePrepare(specPath, specName, taskId, projectPath, workspacePath, context);
  } else if (action === 'record') {
    return handleRecord(specPath, specName, taskId, args, projectPath, context);
  } else if (action === 'gate') {
    return handleGate(args, specPath, specName, taskId, projectPath, workspacePath, context);
  } else {
    return {
      success: false,
      message: `Unknown action: ${action}. Use "prepare", "record", or "gate".`
    };
  }
}

/**
 * The file-resolution counts published with the prepare response (requirement
 * 4.19), so the reviewing agent learns how many logged paths actually resolved
 * and how many were dropped, by cause.
 *
 * They reach the dashboard-spawned reviewer only because `TaskReviewRunner`
 * names the field in its destructure of `prepareResponse.data`, which is typed
 * `any`: every field it does not name is silently discarded, with no compiler
 * error.
 */
export interface FileResolutionCounts {
  workspaceCount: number;
  workflowCount: number;
  drops: Record<DropCause, number>;
}

/**
 * The base, typecheck and attribution facts `handlePrepare` produces once and
 * both review paths carry verbatim to the reviewing agent (requirement 4.1).
 *
 * The two root meanings never share a field name (design D18): `workflowRoot` is
 * `ToolContext.projectPath`, the directory that CONTAINS `.spec-workflow`;
 * `specWorkflowDir` is `PathUtils.getWorkflowRoot(projectPath)`, the
 * `.spec-workflow` directory itself — the same value `projectContext.workflowRoot`
 * carries under a different name.
 *
 * `diffBase.commit` is the recorded sha only for `recorded`; for both fallbacks
 * it is the ref `HEAD`, not its sha (design D3). `notes` states, per state, the
 * one degraded fact the methodology cannot; every instruction stays in the
 * methodology (requirement 4.6).
 */
export interface ExecutionContext {
  workspacePath: string;
  workflowRoot: string;
  specWorkflowDir: string;
  diffBase: { commit: string; provenance: 'recorded' | 'head-expected' | 'head-degraded'; detail: string };
  typecheck: { status: 'success' | 'unavailable' | 'timeout'; reason: string | null; observed: string | null };
  attribution: { state: 'match' | 'mismatch' | 'unknown'; workspacePath: string | null; commit: string | null; source: 'context' | 'override' | null };
  notes: string[];
}

/**
 * The prepare response `data` (requirement 4.1). Typed so a field renamed here
 * fails to compile in `TaskReviewRunner`'s read of the same object (design D16);
 * `taskContext`/`implementationSummary` mirror the literals built below.
 */
export interface PrepareData {
  taskContext: { description: string; requirements: string[]; leverage: string | null; prompt: string | null; promptStructured: PromptSection[] | null };
  implementationSummary: { summary: string; filesModified: string[]; filesCreated: string[]; statistics: ImplementationLogEntry['statistics']; artifacts: ImplementationLogEntry['artifacts'] };
  steeringExcerpt: string | null;
  filesToReview: ResolvedFile[];
  fileResolution: FileResolutionCounts;
  hygieneSignals: HygieneSignal[];
  methodology: string;
  typecheckResults: TypecheckResult[];
  diff: string;
  diffStats: NonNullable<TaskDiffResult['stats']> | null;
  skippedPaths: string[];
  diffTruncated: boolean;
  diffRejection?: { message: string };
  hygieneRejection?: { message: string };
  executionContext: ExecutionContext;
}

/**
 * True when the task logged files and NONE of them resolved inside the
 * workspace under review — the case requirement 4.20 makes actionable.
 *
 * Stated in terms of the three published counts alone, so the runner can decide
 * it without a fourth field: every logged entry either resolves (into
 * `workspaceCount` or `workflowCount`) or increments a drop, and the realpath
 * dedupe only ever collapses entries that resolved. `workflowCount > 0 ||
 * totalDrops > 0` is therefore exactly "the log listed at least one file". A log
 * with no files at all yields zeros throughout and is not a disclosure case.
 */
export function hasNoReviewableFiles(counts: FileResolutionCounts | undefined | null): boolean {
  if (!counts || counts.workspaceCount !== 0) return false;
  const dropped = Object.values(counts.drops ?? {}).reduce((sum, n) => sum + n, 0);
  return counts.workflowCount > 0 || dropped > 0;
}

/**
 * The all-drop disclosure (requirement 4.20). It REPLACES — never annotates —
 * the two read-every-file instructions this spec owns: the first `nextSteps`
 * entry below and the runner's first numbered prompt instruction. Annotating
 * them would leave the stated harm (a passing verdict over unexamined code)
 * fully intact.
 *
 * Requirement 5 (Component 5) closes the residual that requirement 4.21
 * (deferral `d-f3cb6fd8`) left open. On the `no-files` diff state the two
 * further read-every-file instructions are SELECTED AWAY, not edited: the
 * methodology header (`buildReviewMethodology`, this file) emits
 * `NO_FILES_METHODOLOGY_HEADER` and `renderDiffPreamble` emits
 * `NO_FILES_DIFF_PREAMBLE` in place of `R4_2A_DIFF_EMPTY`, so the byte-pinned R4
 * blocks and the seventeen committed fixtures under
 * `src/tools/__tests__/__fixtures__/methodology/` are untouched. The last
 * sentence below now states that both sites agree with this disclosure — no
 * workspace files resolved and no diff was computed.
 */
export const NO_REVIEWABLE_FILES_DISCLOSURE =
  'NO REVIEWABLE FILES WERE RESOLVED. The implementation log listed files, but none of them resolved inside the workspace under review (see the fileResolution counts: workspaceCount is 0), so the implementation itself is not available to read. Do NOT return a "pass" verdict on that basis — a pass would assert that code was examined when none was read. Report the unresolved files as a critical finding instead. Any entries still shown in filesToReview are shared .spec-workflow documents, not the implementation. The methodology header and the diff preamble in this review context state the same: no workspace files resolved and no diff was computed.';

/**
 * Replaces the unconditional "Read ALL files listed in filesToReview" header
 * (`buildReviewMethodology`, this file) when `diffState.kind === 'no-files'`
 * (requirement 5.2). Selecting it instead of the R4-pinned sentence touches no
 * committed fixture.
 */
export const NO_FILES_METHODOLOGY_HEADER =
  'No workspace files are available for this review: none of the files in the implementation log resolved inside the workspace under review, and no diff was computed. For each item below, state what you could and could not check; an absent file is not a pass.';

/**
 * The diff base and its provenance for this prepare (design Component 4, D3).
 * `head-expected` when no record holds a base for the reviewing workspace;
 * `recorded` when the recorded commit is still an ancestor of HEAD (one git
 * spawn, bounded by `runGit`'s timeout); `head-degraded` when git says it is
 * not, or when git gave no answer (`ancestry: 'unknown'`: a hang, a missing
 * binary, a vanished workspace) — the detail and the note say which, so an
 * infrastructure fault is never reported as a rejected base (design R2-4).
 * `commit` is the recorded sha only for `recorded`; both fallbacks diff from
 * the ref `HEAD`.
 */
async function resolveDiffBase(
  record: TaskStateRecord | null,
  workspacePath: string
): Promise<{ diffBase: ExecutionContext['diffBase']; ancestry: AncestryResult | null }> {
  const entry = record?.bases[normalizeIdentityPath(workspacePath)];
  if (!entry) {
    return {
      ancestry: null,
      diffBase: {
        commit: 'HEAD',
        provenance: 'head-expected',
        detail: 'No diff base is recorded for this workspace; the diff spans HEAD to the working tree, so committed changes are not shown.',
      },
    };
  }
  const ancestry = await isAncestorOfHead(workspacePath, entry.commit);
  if (ancestry === 'ancestor') {
    return {
      ancestry,
      diffBase: {
        commit: entry.commit,
        provenance: 'recorded',
        detail: `Recorded when the task was set in-progress from the dashboard at \`${entry.recordedAt}\`. The diff spans this commit to the working tree, so changes to the same files committed between it and HEAD are included.`,
      },
    };
  }
  const why = ancestry === 'unknown'
    ? `could not be validated against HEAD in this workspace (git gave no answer) and was not used`
    : `is not an ancestor of HEAD in this workspace and was rejected`;
  return {
    ancestry,
    diffBase: {
      commit: 'HEAD',
      provenance: 'head-degraded',
      detail: `The recorded base \`${entry.commit}\` ${why}; the diff spans HEAD to the working tree, so committed changes are not shown.`,
    },
  };
}

/**
 * The attribution facts (requirement 3.6). `unknown` with no record; else
 * `match` when the logged path equals the reviewing workspace after
 * `normalizeIdentityPath` on both sides (design D12), otherwise `mismatch`. Read
 * regardless of which workspace is reviewing.
 */
function resolveAttribution(
  record: TaskStateRecord | null,
  workspacePath: string
): ExecutionContext['attribution'] {
  const a = record?.attribution;
  if (!a) {
    return { state: 'unknown', workspacePath: null, commit: null, source: null };
  }
  const state = normalizeIdentityPath(a.workspacePath) === normalizeIdentityPath(workspacePath)
    ? 'match'
    : 'mismatch';
  return { state, workspacePath: a.workspacePath, commit: a.commit, source: a.source };
}

/**
 * The typecheck facts (Data Models). `observed` is the result's own text for
 * `unavailable`, a fixed sentence for `timeout`, and null for `success`; the
 * methodology (item 10) owns every directive, this states the fact (4.6).
 */
function buildTypecheckContext(result: TypecheckResult): ExecutionContext['typecheck'] {
  if (result.status === 'success') {
    return { status: 'success', reason: null, observed: null };
  }
  if (result.status === 'timeout') {
    return {
      status: 'timeout',
      reason: null,
      observed: `\`tsc\` at \`${result.tsconfigPath}\` did not finish within 30 s`,
    };
  }
  return { status: 'unavailable', reason: result.reason, observed: result.observed };
}

/**
 * The degraded-fact notes (design Component 4, D10/D11/D12). One per fact the
 * methodology cannot name: the rejected base, the mismatched log workspace, and
 * the typecheck degradation (every `unavailable` reason but `feature-disabled`,
 * and `timeout`). No note for `head-expected`, `recorded`, `match`, `unknown`,
 * `success` or `feature-disabled`.
 */
function buildExecutionNotes(
  record: TaskStateRecord | null,
  workspacePath: string,
  diffBase: ExecutionContext['diffBase'],
  ancestry: AncestryResult | null,
  attribution: ExecutionContext['attribution'],
  typecheck: ExecutionContext['typecheck']
): string[] {
  const notes: string[] = [];
  if (diffBase.provenance === 'head-degraded') {
    const rejected = record?.bases[normalizeIdentityPath(workspacePath)]?.commit ?? diffBase.commit;
    const outcome = ancestry === 'unknown' ? 'could not be validated' : 'was rejected';
    notes.push(
      `Name in your review summary that the recorded diff base \`${rejected}\` ${outcome} and the diff was taken from HEAD.`
    );
  }
  if (attribution.state === 'mismatch') {
    notes.push(
      `Name in your review summary that this work was logged from \`${attribution.workspacePath}\`, not from the workspace under review.`
    );
  }
  if (
    typecheck.status === 'timeout' ||
    (typecheck.status === 'unavailable' && typecheck.reason !== 'feature-disabled')
  ) {
    notes.push(
      "Quote `executionContext.typecheck.observed` where the methodology's item 10 asks you to surface the typecheck degradation."
    );
  }
  return notes;
}

async function handlePrepare(
  specPath: string,
  specName: string,
  taskId: string,
  /** Shared workflow root: specs, steering, settings and the workflow-root report. */
  projectPath: string,
  /** The checkout whose code is read, diffed and typechecked. */
  workspacePath: string,
  context: ToolContext
): Promise<ToolResponse> {
  const { promises: fs } = await import('fs');

  // The reviewing agent runs in the worktree the harness names in `CODE_ROOT`,
  // but the derived workspace can still be the main checkout (its parent). That
  // reads a stale copy of a file the worktree changed — the 1752-line
  // main-checkout `accounting.test.ts` in place of the 2103-line worktree copy.
  // Prefer `CODE_ROOT` when it names a real directory (retro P5). Scoped to
  // prepare — the path that reads, diffs and typechecks code.
  const codeRootEnv = process.env.CODE_ROOT?.trim();
  if (codeRootEnv) {
    try {
      if ((await fs.stat(codeRootEnv)).isDirectory()) {
        workspacePath = codeRootEnv;
      }
    } catch {
      // CODE_ROOT names nothing readable: keep the derived workspace.
    }
  }

  try {
    // 1. Parse task metadata from tasks.md
    const tasksFile = `${specPath}/tasks.md`;
    let tasksContent: string;
    try {
      tasksContent = await fs.readFile(tasksFile, 'utf-8');
    } catch {
      return {
        success: false,
        message: `tasks.md not found for spec '${specName}'`,
        nextSteps: ['Ensure the spec has a tasks.md file']
      };
    }

    const parseResult = parseTasksFromMarkdown(tasksContent);
    const task = parseResult.tasks.find(t => t.id === taskId);
    if (!task) {
      return {
        success: false,
        message: `Task '${taskId}' not found in tasks.md`,
        nextSteps: ['Check the task ID and try again']
      };
    }

    // 2. Load implementation log for this task
    const logManager = new ImplementationLogManager(specPath);
    const taskLogs = await logManager.getTaskLogs(taskId);
    if (taskLogs.length === 0) {
      return {
        success: false,
        message: `No implementation log found for task '${taskId}'. Must call log-implementation before review-task.`,
        nextSteps: ['Call log-implementation to record what was implemented', 'Then call review-task with action: "prepare"']
      };
    }

    // 3. Read tech.md steering doc if it exists. Over the inline cap (retro P5)
    // carry its path and byte size instead of its contents, so the reviewer reads
    // a large page from disk rather than the tool re-inlining it.
    let steeringExcerpt: string | null = null;
    const steeringPath = PathUtils.getSteeringPath(projectPath);
    const techPath = `${steeringPath}/tech.md`;
    try {
      const techContent = await fs.readFile(techPath, 'utf-8');
      const techBytes = Buffer.byteLength(techContent, 'utf-8');
      steeringExcerpt = techBytes > STEERING_INLINE_CAP_BYTES
        ? `The tech steering document was not inlined: it is ${techBytes} bytes at \`${techPath}\`, over the ${STEERING_INLINE_CAP_BYTES}-byte inline cap. Read it from disk at that path.`
        : techContent;
    } catch {
      // No tech steering doc — that's fine
    }

    // 4. Write prepare marker and check for prior reviews
    const reviewManager = new TaskReviewManager(specPath);
    await reviewManager.writePrepareMarker(taskId);
    const priorReviews = await reviewManager.getReviewsForTask(taskId);
    const hasPriorReviews = priorReviews.length > 0;

    // 5. Build task context
    //
    // The entries stay RAW (requirement 4.7): pre-absolutizing them against the
    // workflow root makes two-root resolution impossible — every relative entry
    // would be anchored to the wrong tree and then dropped on containment. The
    // `new Set` stays: it dedupes raw strings, which is a different job from the
    // resolver's realpath dedupe (requirement 4.11).
    const latestLog = taskLogs[0]; // Sorted newest first
    const allFiles = [...new Set([...latestLog.filesModified, ...latestLog.filesCreated])];

    const taskContext = {
      description: task.description,
      requirements: task.requirements || [],
      leverage: task.leverage || null,
      prompt: task.prompt || null,
      promptStructured: task.promptStructured || null,
    };

    const implementationSummary = {
      summary: latestLog.summary,
      filesModified: latestLog.filesModified,
      filesCreated: latestLog.filesCreated,
      statistics: latestLog.statistics,
      artifacts: latestLog.artifacts,
    };

    // 6. Resolve logged paths and load settings (synchronous prelude).
    // Relative entries anchor against the workspace first and the shared
    // workflow root second; settings still load from the workflow root
    // (requirement 4.27).
    const fileResolution = resolveLoggedFiles(allFiles, {
      workspacePath,
      workflowRoot: projectPath,
    });
    // Every code operation below reads the WORKSPACE set only: a path that
    // resolved under the workflow root is a `.spec-workflow` document, which
    // does not belong in the worktree's diff (4.1/4.23), must not count against
    // typecheck coverage (4.25), and is not a hygiene subject (4.26). The
    // reviewer-facing list keeps both, labelled with the root that resolved it.
    const workspaceFiles = fileResolution.workspaceFiles;
    // Requirement 4.19: the counts travel with the response, on both review
    // paths. `drops` is the resolver's per-cause tally, not a total.
    const fileResolutionCounts: FileResolutionCounts = {
      workspaceCount: fileResolution.workspaceFiles.length,
      workflowCount: fileResolution.workflowFiles.length,
      drops: fileResolution.drops,
    };
    const noReviewableFiles = hasNoReviewableFiles(fileResolutionCounts);
    const settings = loadSettings(projectPath);
    const typecheckEnabled = isTypecheckEnabled(settings);

    // 6b. Read the per-task record (never throws, never written here) and resolve
    // the diff base and attribution before the concurrent block. The base feeds
    // `computeTaskDiff`; a missing, unreadable or malformed record degrades to
    // `head-expected` + `unknown` and prepare still succeeds (requirement 3.9).
    const record = await new TaskStateStore(specPath).read(taskId);
    const { diffBase, ancestry } = await resolveDiffBase(record, workspacePath);
    const attribution = resolveAttribution(record, workspacePath);

    // 7. Run typecheck + hygiene + diff concurrently; convert rejections to degraded states.
    // Diff is APPENDED at index 2 — typecheck stays at 0, hygiene at 1.
    // `computeTaskDiff` runs against the workspace (requirement 4.1), and so
    // does everything in `runProjectTypecheck` that decides which tree is
    // compiled (requirement 4.2); the workflow root it takes second owns only
    // the shared cache directory and the `.gitignore` entry (requirement 4.3).
    const settled = await Promise.allSettled([
      runProjectTypecheck(workspacePath, projectPath, workspaceFiles, {
        enabled: typecheckEnabled,
      }),
      computeHygieneSignals(workspaceFiles, { root: workspacePath, base: ['HEAD'] }),

      computeTaskDiff(workspacePath, workspaceFiles, diffBase.commit),
    ]);
    const typecheckResults = unwrapTypecheck(settled[0], workspacePath);
    const hygieneResult = unwrapHygiene(settled[1]);
    const diffResult = unwrapDiff(settled[2]);

    // 8. Build methodology
    const typecheckState = computeTypecheckMethodologyState(typecheckResults[0]);
    const diffState = computeDiffMethodologyState(diffResult, noReviewableFiles);
    const methodology = buildReviewMethodology(
      taskContext,
      steeringExcerpt !== null,
      hasPriorReviews,
      hygieneResult.signals.length > 0,
      diffState,
      typecheckState
    );

    // 9. Build the one execution-context object both review paths carry
    // (requirement 4.1). Produced once here; the direct caller reads
    // `data.executionContext`, the runner renders the same object.
    const typecheck = buildTypecheckContext(typecheckResults[0]);
    const executionContext: ExecutionContext = {
      workspacePath,
      workflowRoot: projectPath,
      specWorkflowDir: PathUtils.getWorkflowRoot(projectPath),
      diffBase,
      typecheck,
      attribution,
      notes: buildExecutionNotes(record, workspacePath, diffBase, ancestry, attribution, typecheck),
    };

    const data: PrepareData = {
      taskContext,
      implementationSummary,
      steeringExcerpt,
      // Labelled `{ path, root, ambiguous }` (requirement 4.18): the reviewer
      // is told which tree each file came from, not merely handed a path.
      filesToReview: fileResolution.files,
      fileResolution: fileResolutionCounts,
      hygieneSignals: hygieneResult.signals,
      methodology,
      typecheckResults,
      diff: diffResult.diff,
      diffStats: diffResult.stats ?? null,
      skippedPaths: diffResult.skippedPaths,
      diffTruncated: diffResult.truncated,
      ...(diffResult.rejection !== undefined ? { diffRejection: diffResult.rejection } : {}),
      ...(hygieneResult.rejection !== undefined ? { hygieneRejection: hygieneResult.rejection } : {}),
      executionContext,
    };

    return {
      success: true,
      message: `Review context prepared for task '${taskId}'. Read the implementation files and evaluate against the methodology, then call review-task with action: "record".`,
      data,
      nextSteps: [
        // Requirement 4.20: on the all-drop path the read-every-file step is
        // REPLACED by the disclosure, not preceded by it.
        noReviewableFiles
          ? NO_REVIEWABLE_FILES_DISCLOSURE
          : 'Read all files listed in filesToReview',
        'Evaluate implementation against the methodology checklist',
        'Call review-task with action: "record", verdict, summary, and findings'
      ],
      projectContext: {
        projectPath,
        workflowRoot: PathUtils.getWorkflowRoot(projectPath),
        specName,
        dashboardUrl: context.dashboardUrl
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to prepare review: ${errorMessage}`,
      nextSteps: ['Check that the spec and task exist', 'Ensure log-implementation was called first']
    };
  }
}

async function handleRecord(
  specPath: string,
  specName: string,
  taskId: string,
  args: any,
  projectPath: string,
  context: ToolContext
): Promise<ToolResponse> {
  const { verdict, summary, findings = [] } = args;
  const { promises: fs } = await import('fs');

  if (!verdict) {
    return { success: false, message: 'verdict is required for record action' };
  }
  if (!summary) {
    return { success: false, message: 'summary is required for record action' };
  }

  try {
    const reviewManager = new TaskReviewManager(specPath);

    // Validation: prepare marker must exist
    const hasPrepare = await reviewManager.hasPrepareMarker(taskId);
    if (!hasPrepare) {
      return {
        success: false,
        message: 'Must call review-task with action: "prepare" before recording a review.',
        nextSteps: ['Call review-task with action: "prepare" first', 'Review the implementation files', 'Then call review-task with action: "record"']
      };
    }

    // Validation: task must exist
    const tasksFile = `${specPath}/tasks.md`;
    try {
      const tasksContent = await fs.readFile(tasksFile, 'utf-8');
      const parseResult = parseTasksFromMarkdown(tasksContent);
      const task = parseResult.tasks.find(t => t.id === taskId);
      if (!task) {
        return { success: false, message: `Task '${taskId}' not found in tasks.md` };
      }
    } catch {
      return { success: false, message: `tasks.md not found for spec '${specName}'` };
    }

    // Validation: implementation log must exist
    const logManager = new ImplementationLogManager(specPath);
    const taskLogs = await logManager.getTaskLogs(taskId);
    if (taskLogs.length === 0) {
      return {
        success: false,
        message: `No implementation log found for task '${taskId}'.`
      };
    }

    // Validation: verdict/findings consistency
    const typedFindings: ReviewFinding[] = findings;
    const validation = validateVerdictConsistency(verdict, typedFindings);
    if (!validation.valid) {
      return { success: false, message: validation.error! };
    }

    const criticalCount = typedFindings.filter(f => f.severity === 'critical').length;
    const warningCount = typedFindings.filter(f => f.severity === 'warning').length;
    const infoCount = typedFindings.filter(f => f.severity === 'info').length;

    // Save the review
    const review = await reviewManager.saveReview({
      taskId,
      specName,
      verdict,
      summary,
      findings: typedFindings,
    });

    // Build next steps based on verdict
    let nextSteps: string[];
    if (verdict === 'pass') {
      nextSteps = [
        'Mark task as completed in tasks.md by changing [-] to [x]',
        'Continue with next pending task'
      ];
    } else if (verdict === 'fail') {
      nextSteps = [
        'Address the critical findings listed above',
        'After fixing, call review-task with action: "prepare" to re-review',
        'Do NOT mark task [x] until critical findings are resolved'
      ];
    } else {
      nextSteps = [
        'Consider addressing the warnings listed above',
        'Mark task as completed in tasks.md by changing [-] to [x] when satisfied',
        'Continue with next pending task'
      ];
    }

    return {
      success: true,
      message: `Review recorded for task '${taskId}' (v${review.version}): ${verdict}`,
      data: {
        reviewId: review.id,
        version: review.version,
        verdict,
        criticalCount,
        warningCount,
        infoCount,
      },
      nextSteps,
      projectContext: {
        projectPath,
        workflowRoot: PathUtils.getWorkflowRoot(projectPath),
        specName,
        dashboardUrl: context.dashboardUrl
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to record review: ${errorMessage}`
    };
  }
}

export function buildReviewMethodology(
  taskContext: { description: string; requirements: string[]; leverage: string | null; prompt: string | null; promptStructured: any[] | null },
  hasTechSteering: boolean,
  hasPriorReviews: boolean,
  hasHygieneSignals: boolean,
  diffState: DiffMethodologyState,
  typecheckState: TypecheckMethodologyState
): string {
  const sections: string[] = [];

  sections.push('# Review Methodology');
  sections.push('');
  sections.push('Find problems in this implementation. Do not validate it. Assume the implementation has issues until proven otherwise. Be skeptical of convenient shortcuts, missing edge cases, and requirements that were "close enough" but not fully met.');
  sections.push('');
  // Requirement 5.2: the all-drop path SELECTS the no-files header instead of
  // the R4-pinned read-every-file sentence, leaving the pinned byte in place.
  if (diffState.kind === 'no-files') {
    sections.push(NO_FILES_METHODOLOGY_HEADER);
  } else {
    sections.push('Read ALL files listed in filesToReview before evaluating. For each item below, actively look for violations — do not just confirm compliance. State what you checked, what evidence you found, and whether it passes or fails. If something is genuinely fine, say so briefly and move on.');
  }
  sections.push('');

  // Diff preamble (R4.1 / R4.2a / R4.2b). The `**Read first:**` label is
  // emitted as its own paragraph so task 17's drift extractor keys on it; the
  // R4.x verbatim prose follows in the next paragraph (Direction A pins it as
  // a contiguous substring; Direction B's per-paragraph filter excludes it).
  for (const line of renderDiffPreamble(diffState)) sections.push(line);
  sections.push('');

  sections.push('## Primary: Spec Compliance');
  sections.push('');

  // 1. Requirements compliance
  if (taskContext.requirements && taskContext.requirements.length > 0) {
    sections.push(`1. **Requirements compliance**: Verify each referenced requirement is fully implemented: ${taskContext.requirements.join(', ')}. For each one, trace from the requirement to the specific code that fulfills it. Flag any requirement that is partially met, interpreted loosely, or silently dropped. Check the task description line by line — identify anything promised but not delivered.`);
  } else {
    sections.push('1. **Requirements compliance**: Read the task description line by line. Identify anything described that is not implemented, partially implemented, or implemented differently than specified. Look for gaps between what was asked and what was built.');
  }

  // 2. Restriction adherence
  const restrictions = taskContext.promptStructured?.find(s => s.key.toLowerCase() === 'restrictions');
  if (restrictions) {
    sections.push(`2. **Restriction adherence**: These restrictions were specified: ${restrictions.value}. Check each one for violations. Look for workarounds that technically comply but violate the spirit. Check imports, dependencies, and patterns that may circumvent restrictions.`);
  } else {
    sections.push('2. **Restriction adherence**: No explicit restrictions defined. Skip.');
  }

  // 3. Success criteria
  const success = taskContext.promptStructured?.find(s => s.key.toLowerCase() === 'success');
  if (success) {
    sections.push(`3. **Success criteria**: The success criteria are: ${success.value}. For each criterion, find concrete evidence in the code that it is met. If a criterion is ambiguous, interpret it strictly. Flag criteria that would fail under edge cases or with unexpected input.`);
  } else {
    sections.push('3. **Success criteria**: No explicit success criteria. Evaluate against the task description — would a user consider this task genuinely complete?');
  }

  // 4. File scope
  sections.push('4. **File scope**: Compare the files actually modified/created against what the task specifies. Flag any files touched that are outside the task\'s scope (scope creep). Flag any files that should have been modified but weren\'t (incomplete implementation). Look for changes that introduce coupling to unrelated modules.');

  // 5. Leverage check
  if (taskContext.leverage) {
    sections.push(`5. **Leverage check**: The task specified reusing: ${taskContext.leverage}. Verify this code was actually used, not reimplemented. Check for duplicate logic that already exists in the leverage targets. If the leverage was ignored, flag it as a finding — reimplementation creates maintenance burden.`);
  } else {
    sections.push('5. **Leverage check**: No leverage specified. Skip.');
  }

  // 6. Tech stack
  if (hasTechSteering) {
    sections.push('6. **Tech stack compliance**: Read the tech steering document (in steeringExcerpt) and check the implementation against its conventions. Look for: wrong patterns, deprecated approaches, inconsistent naming, missing error handling conventions, deviations from stated architecture. The steering doc represents project-level decisions — violations are findings even if the code "works".');
  } else {
    sections.push('6. **Tech stack compliance**: No tech steering doc found. Skip.');
  }

  sections.push('');
  sections.push('## Secondary: Correctness & Hygiene');
  sections.push('');
  sections.push('7. **Error handling**: Check for unhandled error paths, missing try/catch around I/O or network calls, errors that are silently swallowed, and error messages that leak internals. Flag missing validation at system boundaries (user input, API parameters).');
  sections.push('8. **Edge cases**: Look for off-by-one errors, null/undefined handling, empty array/string cases, concurrent access issues, and boundary conditions the implementation ignores.');
  if (hasHygieneSignals) {
    sections.push('9. **Hygiene**: Pre-computed hygiene signals are attached in `hygieneSignals` (file, line, pattern). For each: confirm whether it is a genuine leftover vs. intentional (e.g., an error-path `console.error`). Promote real leftovers to findings with `category: \'hygiene\'`. Also check for hygiene issues the grep cannot find: hardcoded secrets, commented-out code, unused imports or variables introduced by this task.');
  } else {
    sections.push('9. **Hygiene**: Hardcoded secrets, leftover debug code (console.log, TODO/FIXME from this task), commented-out code, unused imports or variables introduced by this task. Mark findings from items 7-9 with category: "hygiene".');
  }

  // 10. Typecheck (R4.4–R4.7)
  const typecheckDirective = renderTypecheckDirective(typecheckState);
  if (typecheckDirective !== null) {
    sections.push(typecheckDirective);
  }

  if (hasPriorReviews) {
    sections.push('');
    sections.push('## Classification (for iterative reviews)');
    sections.push('');
    sections.push('Prior reviews have identified findings (shown in Prior Review Context). For each NEW finding you report, assign a `classification`:');
    sections.push('- **novel**: Not identified in any prior review — a genuinely new issue');
    sections.push('- **compounding**: Builds on or deepens a prior finding (same area, deeper implication)');
    sections.push('- **recurring**: The same issue from a prior review is still present');
    sections.push('');
    sections.push('Do NOT escalate severity — report the finding at its correct severity regardless of recurrence. Focus your effort on novel issues; do not re-discover well-covered ground unless a finding has persisted.');
  }

  sections.push('');
  sections.push('## Recording Results');
  sections.push('');
  sections.push('After evaluating, call review-task with action: "record" providing:');
  sections.push('- verdict: "pass" (no findings), "fail" (any critical), or "findings" (warnings/info only)');
  sections.push('- summary: 1-2 sentence summary of the review outcome');
  sections.push('- findings: array of { severity, title, description, file?, line?, taskRequirement?, category? }');

  return sections.join('\n');
}

// R4.1, R4.2a, R4.2b verbatim prose from requirements.md. The `**Read first:**`
// label is emitted as a separate paragraph by renderDiffPreamble so these
// constants stay byte-identical to R4 (drift test, Direction A).
const R4_1_DIFF_PRESENT =
  "**Read the diff first.** `data.diff` contains a unified diff (10 lines of context per hunk, rename-detected via `-M`) of the task's uncommitted changes vs. the last commit. Read it before opening any file from `filesToReview`. Open files from `filesToReview` only when (a) hunks span more than half the file — measured as `(addedLines + removedLines) / max(preEditLines, postEditLines)` — (b) you need surrounding invariants the hunks don't show, or (c) `data.skippedPaths` lists a file relevant to the task. If `data.diffTruncated` is true, read the full file for the truncated paths. Do NOT rely on the diff to surface renames — explicit pathspec defeats git's rename detection; suspect renames must be verified by reading both files.";

const R4_2A_DIFF_EMPTY =
  "**No diff available — read full files.** Either the task changes were already committed before review (inspect recent commits on the branch via `filesToReview` content compared against the implementation log's described changes), the implementation log is out of sync with the working tree, or this is not a git repository. Read every file in `filesToReview` and evaluate against the task's described changes from the implementation log.";

const R4_2B_DIFF_REJECTED =
  "**Diff utility rejected unexpectedly — read full files.** `data.diffRejection.message` contains the rejection reason. The diff was NOT computed because the utility threw an unexpected exception; this is a degraded review surface, not a benign empty diff. Read every file in `filesToReview` and evaluate against the task's described changes from the implementation log. **Surface the rejection in your review summary** (quote `data.diffRejection.message`) so the human reviewer knows the diff path failed and can investigate the underlying cause.";

const DIFF_TRUNCATION_NOTE =
  "**Note:** `data.diffTruncated` is true — at least one file's hunks were replaced by a truncation marker (look for `<diff truncated: ...>` lines in `data.diff`).";

// The `no-files` preamble (requirement 5.2). It is a NEW constant, not an R4.x
// block: on the all-drop path `renderDiffPreamble` emits it in place of
// `R4_2A_DIFF_EMPTY`, so no committed fixture moves.
export const NO_FILES_DIFF_PREAMBLE =
  "**No diff and no workspace files.** The implementation log's files did not resolve in the workspace under review, so no pathspec reached git. This is not an empty diff of an unchanged tree and is not evidence that the changes were committed; the implementation is not available to read. Report the unresolved files as a critical finding (see the fileResolution counts).";

function renderDiffPreamble(state: DiffMethodologyState): string[] {
  const lines: string[] = ['**Read first:**', ''];
  switch (state.kind) {
    case 'present':
      lines.push(R4_1_DIFF_PRESENT);
      break;
    case 'present-truncated':
      lines.push(R4_1_DIFF_PRESENT);
      lines.push('');
      lines.push(DIFF_TRUNCATION_NOTE);
      break;
    case 'empty':
      lines.push(R4_2A_DIFF_EMPTY);
      break;
    case 'no-files':
      lines.push(NO_FILES_DIFF_PREAMBLE);
      break;
    case 'rejected':
      lines.push(R4_2B_DIFF_REJECTED);
      break;
  }
  return lines;
}

// R4.4–R4.7 verbatim prose from requirements.md. Item 10 prefix is applied by
// renderTypecheckDirective so the prose remains byte-identical to R4 (drift test).
const R4_4_TYPECHECK_PRESENT =
  "**Triage the typecheck diagnostics.** `data.typecheckResults[0].diagnostics` lists `tsc --noEmit` errors. Focus on entries with `inScope: true` — these touch files this task modified or created. For each in-scope diagnostic: confirm whether it is (a) a real bug introduced by this task → promote to a finding with `category: 'hygiene'`, or (b) pre-existing → note in summary, do not file as a finding. Treat `inScope: false` entries as upstream context for in-scope diagnostics. Also check for type-system smells tsc can't catch: unsound `any`, type assertions hiding real mismatches, narrowed types that lose information. If `truncated: true`, the diagnostic list is incomplete (capped at 100 entries) — note this gap explicitly in your review summary so the human reviewer knows to check the omitted entries manually; do not assume the truncated entries are pre-existing or unrelated.";

const R4_5_TYPECHECK_PARTIAL_COVERAGE =
  "**Partial typecheck coverage — degraded review surface.** `data.typecheckResults[0].coverage.excluded` lists files this task modified that tsc did NOT compile (excluded by tsconfig's `exclude` or never reached via `include`). For these files, the absence of diagnostics is meaningless — they were never checked. **You are operating in pre-spec methodology mode for the excluded files**; manually scan them for type errors and structural issues (missing return types, implicit `any`, mismatched property shapes, unsafe casts). The `compiled` list is the trustworthy coverage set. **Surface this per-file coverage gap in your review summary** so the human reviewer knows the scope of the gap.";

const R4_6A_TYPECHECK_DISABLED =
  "**Typecheck pre-computation is disabled for this project.** `data.typecheckResults[0].reason` is `'feature-disabled'` — the project's `.spec-workflow/adversarial-settings.json` sets `features.typecheck: false`. Proceed with the review as you normally would; do not perform additional manual type-checking unless a finding specifically warrants it. If you observe what looks like a type-system bug while reviewing, flag it as a finding with `category: 'hygiene'` and let the human reviewer decide whether to re-enable typecheck pre-computation.";

const R4_6B_TYPECHECK_UNAVAILABLE =
  "**Typecheck did not run for this review.** `data.typecheckResults[0].reason` says why (e.g. `'project-references'`, `'no-tsconfig'`, `'tsc-not-found'`, `'no-parseable-output'`, `'output-overflow'`, `'rejection'`). **This is a degraded review surface** — the type-error coverage promised by this MCP is unverified. You are operating in pre-spec methodology mode for type-checking; manually scan the modified TypeScript files for type errors and structural problems (missing return types, implicit `any`, mismatched property shapes, unsafe casts). Surface this degradation in your review summary so the human reviewer knows the scope of the gap.";

const R4_7_TYPECHECK_TIMEOUT =
  "**Typecheck timed out at 30 seconds.** The project is large enough that `tsc --noEmit` did not complete within the budget. Pre-computed diagnostics are NOT available for this review. **This is a degraded review surface** — type-error coverage is unverified. Operate in pre-spec methodology mode for type-checking; manually scan the modified TypeScript files. Surface this degradation in your review summary. If this timeout recurs, set `features.typecheck: false` in `.spec-workflow/adversarial-settings.json` to disable typecheck pre-computation; the review proceeds without it.";

function renderTypecheckDirective(state: TypecheckMethodologyState): string | null {
  switch (state.kind) {
    case 'success-clean-full':
      return null;
    case 'success-with-diagnostics':
      return `10. ${R4_4_TYPECHECK_PRESENT}`;
    case 'success-partial-coverage':
      return `10. ${R4_5_TYPECHECK_PARTIAL_COVERAGE}`;
    case 'success-with-diagnostics-and-partial-coverage':
      return `10. ${R4_4_TYPECHECK_PRESENT}\n\n${R4_5_TYPECHECK_PARTIAL_COVERAGE}`;
    case 'unavailable-feature-disabled':
      return `10. ${R4_6A_TYPECHECK_DISABLED}`;
    case 'unavailable-other':
      return `10. ${R4_6B_TYPECHECK_UNAVAILABLE}`;
    case 'timeout':
      return `10. ${R4_7_TYPECHECK_TIMEOUT}`;
  }
}
