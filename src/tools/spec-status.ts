import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { SpecParser } from '../core/parser.js';
import { TaskReviewManager } from '../core/task-review-manager.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';

export const specStatusTool: Tool = {
  name: 'spec-status',
  description: `Display comprehensive specification progress overview.

# Instructions
Call when resuming work on a spec or checking overall completion status. Shows which phases are complete and task implementation progress. After viewing status, read tasks.md directly to see all tasks and their status markers ([ ] pending, [-] in-progress, [x] completed).`,
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
          'Check spec name',
          'Use spec-list for available specs',
          'Create spec with create-spec-doc'
        ]
      };
    }

    // Determine current phase and overall status
    let currentPhase = 'not-started';
    let overallStatus = 'not-started';
    
    if (!spec.phases.requirements.exists) {
      currentPhase = 'requirements';
      overallStatus = 'requirements-needed';
    } else if (!spec.phases.design.exists) {
      currentPhase = 'design';
      overallStatus = 'design-needed';
    } else if (!spec.phases.tasks.exists) {
      currentPhase = 'tasks';
      overallStatus = 'tasks-needed';
    } else if (spec.taskProgress && spec.taskProgress.pending > 0) {
      currentPhase = 'implementation';
      overallStatus = 'implementing';
    } else if (spec.taskProgress && spec.taskProgress.total > 0 && spec.taskProgress.completed === spec.taskProgress.total) {
      currentPhase = 'completed';
      overallStatus = 'completed';
    } else {
      currentPhase = 'implementation';
      overallStatus = 'ready-for-implementation';
    }

    // Phase details
    const phaseDetails = [
      {
        name: 'Requirements',
        status: spec.phases.requirements.exists ? (spec.phases.requirements.approved ? 'approved' : 'created') : 'missing',
        lastModified: spec.phases.requirements.lastModified
      },
      {
        name: 'Design',
        status: spec.phases.design.exists ? (spec.phases.design.approved ? 'approved' : 'created') : 'missing',
        lastModified: spec.phases.design.lastModified
      },
      {
        name: 'Tasks',
        status: spec.phases.tasks.exists ? (spec.phases.tasks.approved ? 'approved' : 'created') : 'missing',
        lastModified: spec.phases.tasks.lastModified
      },
      {
        name: 'Implementation',
        status: spec.phases.implementation.exists ? 'in-progress' : 'not-started',
        progress: spec.taskProgress
      }
    ];

    // Next steps based on current phase
    const nextSteps = [];
    switch (currentPhase) {
      case 'requirements':
        nextSteps.push('Read template: .spec-workflow/templates/requirements-template-v*.md');
        nextSteps.push('Create: .spec-workflow/specs/{name}/requirements.md');
        nextSteps.push('Request approval');
        break;
      case 'design':
        nextSteps.push('Read template: .spec-workflow/templates/design-template-v*.md');
        nextSteps.push('Create: .spec-workflow/specs/{name}/design.md');
        nextSteps.push('Request approval');
        break;
      case 'tasks':
        nextSteps.push('Read template: .spec-workflow/templates/tasks-template-v*.md');
        nextSteps.push('Create: .spec-workflow/specs/{name}/tasks.md');
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

        for (const task of completedTasks) {
          const latest = await reviewManager.getLatestReview(task.id);
          if (latest) {
            reviewed++;
          } else {
            unreviewed.push(task.id);
          }
        }

        reviewCoverage = { reviewed, unreviewed };
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
        reviewCoverage
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