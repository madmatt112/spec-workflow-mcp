import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse, ReviewFinding } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { TaskReviewManager, validateVerdictConsistency } from '../core/task-review-manager.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';

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
        description: 'Absolute path to the project root (optional - uses server context path if not provided)'
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
  const projectPath = args.projectPath || context.projectPath;

  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required but not provided in context or arguments'
    };
  }

  const specPath = PathUtils.getSpecPath(projectPath, specName);

  if (action === 'prepare') {
    return handlePrepare(specPath, specName, taskId, projectPath, context);
  } else if (action === 'record') {
    return handleRecord(specPath, specName, taskId, args, projectPath, context);
  } else {
    return {
      success: false,
      message: `Unknown action: ${action}. Use "prepare" or "record".`
    };
  }
}

async function handlePrepare(
  specPath: string,
  specName: string,
  taskId: string,
  projectPath: string,
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

    // 6. Build methodology
    const methodology = buildReviewMethodology(taskContext, steeringExcerpt !== null, hasPriorReviews);

    return {
      success: true,
      message: `Review context prepared for task '${taskId}'. Read the implementation files and evaluate against the methodology, then call review-task with action: "record".`,
      data: {
        taskContext,
        implementationSummary,
        steeringExcerpt,
        filesToReview: allFiles,
        methodology,
      },
      nextSteps: [
        'Read all files listed in filesToReview',
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

function buildReviewMethodology(
  taskContext: { description: string; requirements: string[]; leverage: string | null; prompt: string | null; promptStructured: any[] | null },
  hasTechSteering: boolean,
  hasPriorReviews: boolean
): string {
  const sections: string[] = [];

  sections.push('# Review Methodology');
  sections.push('');
  sections.push('You are a senior code reviewer whose job is to find problems, not to validate. Assume the implementation has issues until proven otherwise. Be skeptical of convenient shortcuts, missing edge cases, and requirements that were "close enough" but not fully met.');
  sections.push('');
  sections.push('Read ALL files listed in filesToReview before evaluating. For each item below, actively look for violations — do not just confirm compliance. State what you checked, what evidence you found, and whether it passes or fails. If something is genuinely fine, say so briefly and move on.');
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
  sections.push('9. **Hygiene**: Hardcoded secrets, leftover debug code (console.log, TODO/FIXME from this task), commented-out code, unused imports or variables introduced by this task. Mark findings from items 7-9 with category: "hygiene".');

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
