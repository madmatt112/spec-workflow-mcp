import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse, TddCoverage, BaseOutcome } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { SpecParser } from '../core/parser.js';
import { TaskReviewManager } from '../core/task-review-manager.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';
import { deriveSpecStatus } from '../core/spec-status-deriver.js';
import { hasUnresolvedCompletionGate } from '../core/completion-gate.js';
import { deriveDocumentApprovalStates } from '../core/approval-records.js';
import { parseAgentRuleKey } from '../core/gate-rules.js';

export const specStatusTool: Tool = {
  name: 'spec-status',
  description: `Display comprehensive specification progress overview.

# Instructions
Call when resuming work on a spec or checking overall completion status. Shows which phases are complete and task implementation progress. Each document phase (Requirements, Design, Tasks) reports its approval state from the approval records: status "approved" means the newest approval record for that document is approved; "created" means the document exists but its newest record is pending, rejected, needs-revision, or absent. After viewing status, read tasks.md directly to see all tasks and their status markers ([ ] pending, [-] in-progress, [x] completed).`,
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root (optional - uses server context path if not provided)'
      },
      specName: {
        type: 'string',
        description: 'Name of the specification'
      }
    },
    required: ['specName']
  },
  annotations: {
    title: 'Spec Status',
    readOnlyHint: true,
  }
};

export async function specStatusHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName } = args;
  
  // Use context projectPath as default, allow override via args
  const projectPath = args.projectPath || context.projectPath;
  
  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required but not provided in context or arguments'
    };
  }

  try {
    // Translate path at tool entry point (components expect pre-translated paths)
    const translatedPath = PathUtils.translatePath(projectPath);
    const parser = new SpecParser(translatedPath);
    const spec = await parser.getSpec(specName);
    
    if (!spec) {
      return {
        success: false,
        message: `Specification '${specName}' not found`,
        nextSteps: [
          'Check the spec name (kebab-case)',
          'List existing specs by reading .spec-workflow/specs/',
          'To create a new spec, call spec-workflow-guide and follow the workflow'
        ]
      };
    }

    // Determine current phase and overall status (shared with the INDEX roll-up generator)
    let { currentPhase, overallStatus } = deriveSpecStatus(spec);

    // Completion gate: an unresolved completion-gate escalation blocks "completed"
    // regardless of task count (retro mobile-pwa F5). When every task reads [x] but
    // the run ledger ends on an unresolved `escalate` phase.end, implementation is
    // not finished — report it as still implementing so routing stays on the spec.
    if (overallStatus === 'completed' && await hasUnresolvedCompletionGate(translatedPath, specName)) {
      currentPhase = 'implementation';
      overallStatus = 'implementing';
    }

    // Approval state per document, from the approval records on disk. The
    // phase/status derivation above deliberately ignores approvals (file
    // existence and task checkboxes only); this is the routing signal an
    // autonomous harness reads to tell "written" from "approved".
    const approvals = await deriveDocumentApprovalStates(translatedPath, specName);
    spec.phases.requirements.approved = approvals.requirements.approved;
    spec.phases.design.approved = approvals.design.approved;
    spec.phases.tasks.approved = approvals.tasks.approved;

    // Phase details
    const phaseDetails = [
      {
        name: 'Requirements',
        status: spec.phases.requirements.exists ? (spec.phases.requirements.approved ? 'approved' : 'created') : 'missing',
        lastModified: spec.phases.requirements.lastModified,
        approved: approvals.requirements.approved,
        approvalId: approvals.requirements.approvalId,
        approvalStatus: approvals.requirements.approvalStatus,
        approvedAt: approvals.requirements.approvedAt
      },
      {
        name: 'Design',
        status: spec.phases.design.exists ? (spec.phases.design.approved ? 'approved' : 'created') : 'missing',
        lastModified: spec.phases.design.lastModified,
        approved: approvals.design.approved,
        approvalId: approvals.design.approvalId,
        approvalStatus: approvals.design.approvalStatus,
        approvedAt: approvals.design.approvedAt
      },
      {
        name: 'Tasks',
        status: spec.phases.tasks.exists ? (spec.phases.tasks.approved ? 'approved' : 'created') : 'missing',
        lastModified: spec.phases.tasks.lastModified,
        approved: approvals.tasks.approved,
        approvalId: approvals.tasks.approvalId,
        approvalStatus: approvals.tasks.approvalStatus,
        approvedAt: approvals.tasks.approvedAt
      },
      {
        name: 'Implementation',
        status: currentPhase === 'completed' ? 'completed' : (spec.phases.implementation.exists ? 'in-progress' : 'not-started'),
        progress: spec.taskProgress
      }
    ];

    // Next steps based on current phase
    const nextSteps = [];
    switch (currentPhase) {
      case 'requirements':
        nextSteps.push('Read template: .spec-workflow/user-templates/requirements-template.md (fallback: .spec-workflow/templates/requirements-template.md)');
        nextSteps.push(`Create: .spec-workflow/specs/${specName}/requirements.md`);
        nextSteps.push('Request approval');
        break;
      case 'design':
        nextSteps.push('Read template: .spec-workflow/user-templates/design-template.md (fallback: .spec-workflow/templates/design-template.md)');
        nextSteps.push(`Create: .spec-workflow/specs/${specName}/design.md`);
        nextSteps.push('Request approval');
        break;
      case 'tasks':
        nextSteps.push('Read template: .spec-workflow/user-templates/tasks-template.md (fallback: .spec-workflow/templates/tasks-template.md)');
        nextSteps.push(`Create: .spec-workflow/specs/${specName}/tasks.md`);
        nextSteps.push('Request approval');
        break;
      case 'implementation':
        if (spec.taskProgress && spec.taskProgress.pending > 0) {
          nextSteps.push(`Read tasks: .spec-workflow/specs/${specName}/tasks.md`);
          nextSteps.push('Edit tasks.md: Change [ ] to [-] for task you start');
          nextSteps.push('Implement the task code');
          nextSteps.push('MANDATORY: Call log-implementation before marking complete');
          nextSteps.push('Review implementation (dashboard Review button or review-task tool)');
          nextSteps.push('Only then: Edit tasks.md: Change [-] to [x]');
        } else {
          nextSteps.push(`Read tasks: .spec-workflow/specs/${specName}/tasks.md`);
          nextSteps.push('Begin implementation by marking first task [-]');
        }
        break;
      case 'completed':
        nextSteps.push('All tasks completed (marked [x])');
        nextSteps.push('Run tests');
        break;
    }

    // Check implementation log and review coverage for completed tasks
    let reviewCoverage: { reviewed: number; unreviewed: string[] } | undefined;
    let logCoverage: { logged: number; unlogged: string[] } | undefined;
    let tddCoverage: TddCoverage | undefined;
    if (spec.taskProgress && spec.taskProgress.completed > 0) {
      try {
        const specPath = PathUtils.getSpecPath(translatedPath, specName);
        const { promises: fsPromises } = await import('fs');
        const tasksContent = await fsPromises.readFile(`${specPath}/tasks.md`, 'utf-8');
        const parseResult = parseTasksFromMarkdown(tasksContent);
        const completedTasks = parseResult.tasks.filter(t => t.status === 'completed');

        // Check implementation log coverage
        const logManager = new ImplementationLogManager(specPath);
        const taskIdsWithLogs = await logManager.getTaskIdsWithLogs();
        const unlogged: string[] = [];
        let logged = 0;

        for (const task of completedTasks) {
          if (taskIdsWithLogs.has(task.id)) {
            logged++;
          } else {
            unlogged.push(task.id);
          }
        }
        logCoverage = { logged, unlogged };

        // Check review coverage
        const reviewManager = new TaskReviewManager(specPath);
        const unreviewed: string[] = [];
        let reviewed = 0;

        // TDD coverage: count each completed task whose latest review carries a
        // `tdd` block, split by base outcome (all four keys present).
        const tddBase: Record<BaseOutcome, number> = {
          'assertion-red': 0,
          'structural-red': 0,
          'vacuous': 0,
          'inconclusive': 0,
        };
        let tddTasks = 0;
        let tddAmended = 0;

        for (const task of completedTasks) {
          const latest = await reviewManager.getLatestReview(task.id);
          if (latest) {
            reviewed++;
            if (latest.tdd) {
              tddTasks++;
              tddBase[latest.tdd.base]++;
              if (latest.tdd.amended) tddAmended++;
            }
          } else {
            unreviewed.push(task.id);
          }
        }

        reviewCoverage = { reviewed, unreviewed };
        if (tddTasks > 0) {
          // No wired `tdd-test-command` means every base run was skipped as
          // inconclusive, so the red/green metric is N/A, not a signal (retro
          // canonical-link F6). A missing agent-rules.md counts as not wired.
          let tddTestCommandWired = false;
          try {
            const agentRulesPath = `${PathUtils.getWorkflowRoot(translatedPath)}/agent-rules.md`;
            const agentRules = await fsPromises.readFile(agentRulesPath, 'utf-8');
            tddTestCommandWired = parseAgentRuleKey(agentRules, 'tdd-test-command') !== null;
          } catch {
            tddTestCommandWired = false;
          }
          tddCoverage = { tasks: tddTasks, base: tddBase, amended: tddAmended, tddTestCommandWired };
        }
      } catch {
        // Coverage checks are best-effort
      }
    }

    // Flag completed tasks missing logs or reviews
    if (logCoverage && logCoverage.unlogged.length > 0) {
      nextSteps.push(`WARNING: ${logCoverage.unlogged.length} completed task(s) missing implementation logs: ${logCoverage.unlogged.join(', ')}. Run log-implementation for each.`);
    }
    if (reviewCoverage && reviewCoverage.unreviewed.length > 0) {
      nextSteps.push(`${reviewCoverage.unreviewed.length} completed task(s) without reviews: ${reviewCoverage.unreviewed.join(', ')}. Reviews can be run retroactively — ask user to trigger from dashboard.`);
    }

    return {
      success: true,
      message: `Specification '${specName}' status: ${overallStatus}`,
      data: {
        name: specName,
        description: spec.description,
        currentPhase,
        overallStatus,
        createdAt: spec.createdAt,
        lastModified: spec.lastModified,
        phases: phaseDetails,
        taskProgress: spec.taskProgress || {
          total: 0,
          completed: 0,
          pending: 0
        },
        logCoverage,
        reviewCoverage,
        ...(tddCoverage ? { tddCoverage } : {})
      },
      nextSteps,
      projectContext: {
        projectPath,
        workflowRoot: PathUtils.getWorkflowRoot(projectPath),
        currentPhase,
        dashboardUrl: context.dashboardUrl
      }
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to get specification status: ${errorMessage}`,
      nextSteps: [
        'Check if the specification exists',
        'Verify the project path',
        'List directory .spec-workflow/specs/ to see available specifications'
      ]
    };
  }
}