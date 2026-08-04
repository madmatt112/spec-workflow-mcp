import path from 'path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse, ReviewFinding } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { resolveLoggedFiles, type DropCause } from '../core/file-resolution.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { TaskReviewManager, validateVerdictConsistency } from '../core/task-review-manager.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';
import { computeHygieneSignals, HygieneSignal } from '../core/hygiene-signals.js';
import { runProjectTypecheck, TypecheckResult } from '../core/typecheck.js';
import { loadSettings, isTypecheckEnabled } from '../core/adversarial-settings.js';
import { computeTaskDiff, TaskDiffResult } from '../core/task-diff.js';
import { selectRoots } from './root-selection.js';

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

export type DiffMethodologyState =
  | { kind: 'present' }
  | { kind: 'present-truncated' }
  | { kind: 'empty' }
  | { kind: 'rejected'; message: string };

export function computeDiffMethodologyState(result: TaskDiffResult): DiffMethodologyState {
  if (result.rejection !== undefined) {
    return { kind: 'rejected', message: result.rejection.message };
  }
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

Two actions:
- **prepare**: Gathers task context (requirements, restrictions, success criteria), implementation log summary, and tech steering. Returns a review methodology to evaluate the implementation against. Also writes a prepare marker to gate the record action.
- **record**: Persists review findings. Requires prepare to have been called first.

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
        enum: ['prepare', 'record'],
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
  } else {
    return {
      success: false,
      message: `Unknown action: ${action}. Use "prepare" or "record".`
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
 * RESIDUAL (requirement 4.21, deferral `d-f3cb6fd8`): two further instructions
 * to read every listed file survive this replacement and are deliberately NOT
 * changed here — the unconditional methodology header (`buildReviewMethodology`,
 * this file) and `R4_2A_DIFF_EMPTY`. Both are byte-pinned, by the seventeen
 * committed fixtures under `src/tools/__tests__/__fixtures__/methodology/` and by
 * a drift test comparing against a *different* spec's requirements document, so
 * changing them is cross-spec work this spec does not carry. `R4_2A_DIFF_EMPTY`
 * additionally fires NECESSARILY on this path: an empty workspace file set
 * yields an empty diff with no rejection (`src/core/task-diff.ts:41-43`), so its
 * fabricated "already committed before review" explanation is present alongside
 * this statement in every all-drop review. The last sentence of the text names
 * that contradiction rather than leaving the agent to resolve it — but the
 * contradiction itself is real, and this constant is not a complete closure of
 * the harm.
 */
export const NO_REVIEWABLE_FILES_DISCLOSURE =
  'NO REVIEWABLE FILES WERE RESOLVED. The implementation log listed files, but none of them resolved inside the workspace under review (see the fileResolution counts: workspaceCount is 0), so the implementation itself is not available to read. Do NOT return a "pass" verdict on that basis — a pass would assert that code was examined when none was read. Report the unresolved files as a critical finding instead. Any entries still shown in filesToReview are shared .spec-workflow documents, not the implementation. Other guidance in this review context still instructs you to read every listed file, and the empty-diff guidance may explain the missing diff as "the task changes were already committed before review"; neither holds here — the diff is empty and the list has no workspace files because resolution dropped them all.';

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

    // 3. Read tech.md steering doc if it exists
    let steeringExcerpt: string | null = null;
    const steeringPath = PathUtils.getSteeringPath(projectPath);
    try {
      steeringExcerpt = await fs.readFile(`${steeringPath}/tech.md`, 'utf-8');
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
      computeHygieneSignals(workspaceFiles),
      computeTaskDiff(workspacePath, workspaceFiles),
    ]);
    const typecheckResults = unwrapTypecheck(settled[0], workspacePath);
    const hygieneResult = unwrapHygiene(settled[1]);
    const diffResult = unwrapDiff(settled[2]);

    // 8. Build methodology
    const typecheckState = computeTypecheckMethodologyState(typecheckResults[0]);
    const diffState = computeDiffMethodologyState(diffResult);
    const methodology = buildReviewMethodology(
      taskContext,
      steeringExcerpt !== null,
      hasPriorReviews,
      hygieneResult.signals.length > 0,
      diffState,
      typecheckState
    );

    return {
      success: true,
      message: `Review context prepared for task '${taskId}'. Read the implementation files and evaluate against the methodology, then call review-task with action: "record".`,
      data: {
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
        diffStats: diffResult.stats,
        skippedPaths: diffResult.skippedPaths,
        diffTruncated: diffResult.truncated,
        ...(diffResult.rejection !== undefined ? { diffRejection: diffResult.rejection } : {}),
        ...(hygieneResult.rejection !== undefined ? { hygieneRejection: hygieneResult.rejection } : {}),
      },
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
  sections.push('Read ALL files listed in filesToReview before evaluating. For each item below, actively look for violations — do not just confirm compliance. State what you checked, what evidence you found, and whether it passes or fails. If something is genuinely fine, say so briefly and move on.');
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
