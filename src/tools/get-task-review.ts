import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { TaskReviewManager } from '../core/task-review-manager.js';

export const getTaskReviewTool: Tool = {
  name: 'get-task-review',
  description: `Retrieve the findings from a completed task review.

# Instructions

Call this to read review findings after a dashboard-triggered or CLI-triggered review has completed for a task. Returns the full review including verdict, summary, and structured findings with severity, file locations, and categories.

By default returns the latest review version. Pass a specific version number to retrieve an older review.`,
  inputSchema: {
    type: 'object',
    properties: {
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
      version: {
        type: 'integer',
        minimum: 1,
        description: 'Specific review version to retrieve (optional - defaults to latest)'
      }
    },
    required: ['specName', 'taskId']
  },
  annotations: {
    title: 'Get Task Review',
    readOnlyHint: true,
  }
};

export async function getTaskReviewHandler(
  args: any,
  context: ToolContext
): Promise<ToolResponse> {
  const { specName, taskId, version } = args;
  const projectPath = args.projectPath || context.projectPath;

  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required but not provided in context or arguments'
    };
  }

  const specPath = PathUtils.getSpecPath(projectPath, specName);

  // Validate spec exists before touching TaskReviewManager (avoids phantom directory creation)
  const { promises: fs } = await import('fs');
  try {
    await fs.stat(specPath);
  } catch {
    return {
      success: false,
      message: `Spec '${specName}' not found at ${specPath}`,
      nextSteps: ['Check the spec name and try again']
    };
  }

  try {
    const reviewManager = new TaskReviewManager(specPath);

    if (version !== undefined) {
      // Validate version is a positive integer
      const v = parseInt(version);
      if (!Number.isInteger(v) || v < 1) {
        return {
          success: false,
          message: 'Version must be a positive integer (1 or greater)'
        };
      }

      const reviews = await reviewManager.getReviewsForTask(taskId);
      const review = reviews.find(r => r.version === v);
      if (!review) {
        if (reviews.length === 0) {
          return {
            success: false,
            message: `No reviews found for task '${taskId}' in spec '${specName}'`,
            nextSteps: ['Run a review first using review-task or the dashboard Review button']
          };
        }
        const available = reviews.map(r => r.version).join(', ');
        return {
          success: false,
          message: `Review version ${v} not found for task '${taskId}'. Available versions: ${available}`,
          nextSteps: [`Use one of the available versions: ${available}`]
        };
      }

      return {
        success: true,
        message: `Review v${review.version} for task '${taskId}': ${review.verdict}`,
        data: { review },
        projectContext: {
          projectPath,
          workflowRoot: PathUtils.getWorkflowRoot(projectPath),
          specName,
          dashboardUrl: context.dashboardUrl
        }
      };
    }

    // Default: get latest review
    const review = await reviewManager.getLatestReview(taskId);
    if (!review) {
      return {
        success: false,
        message: `No reviews found for task '${taskId}' in spec '${specName}'`,
        nextSteps: ['Run a review first using review-task or the dashboard Review button']
      };
    }

    return {
      success: true,
      message: `Latest review (v${review.version}) for task '${taskId}': ${review.verdict}`,
      data: { review },
      nextSteps: review.verdict === 'fail'
        ? ['Address the critical findings', 'Re-review after fixes using the dashboard Review button']
        : review.verdict === 'findings'
        ? ['Consider addressing the warnings', 'Mark task [x] complete when satisfied']
        : ['Task review passed — mark task [x] complete'],
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
      message: `Failed to retrieve review: ${errorMessage}`
    };
  }
}
