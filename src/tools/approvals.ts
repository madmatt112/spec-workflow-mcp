import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { ApprovalStorage, ApprovalRequest } from '../dashboard/approval-storage.js';
import { join, isAbsolute } from 'path';
import { validateProjectPath, PathUtils } from '../core/path-utils.js';
import { readFile } from 'fs/promises';
import { validateTasksMarkdown, formatValidationErrors } from '../core/task-validator.js';
import { validateMarkdownForMdx, formatMdxValidationIssues } from '../core/mdx-validator.js';
import { normalizeApprovalFilePath } from '../core/approval-records.js';

/**
 * Safely translate a path, with defensive checks to provide better error messages
 * in case of module loading issues.
 * 
 * Note: The original issue reported "PathUtils.translatePath is not a function" on Windows.
 * While we couldn't reproduce it, this defensive check ensures a clear error message
 * is provided if such edge cases occur.
 */
function safeTranslatePath(path: string): string {
  // Defensive check: ensure translatePath method exists and is callable
  // This handles edge cases where the class might be partially initialized
  if (typeof PathUtils?.translatePath !== 'function') {
    throw new Error(
      `PathUtils.translatePath is not available (got ${typeof PathUtils?.translatePath}). ` +
      'This may indicate a module loading issue. Please reinstall the package with: ' +
      'npm uninstall @madmatt112org/spec-workflow-mcp && npm install @madmatt112org/spec-workflow-mcp'
    );
  }
  return PathUtils.translatePath(path);
}

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'needs-revision'] as const;
type ApprovalStatus = typeof APPROVAL_STATUSES[number];

export const approvalsTool: Tool = {
  name: 'approvals',
  description: `Manage approval requests.

# Instructions
Use this tool to request, check, list, decide and clean up approval requests. The action parameter determines the operation:
- 'request': Create a new approval request after creating each document
- 'status': Check the current status of an approval request
- 'delete': Remove an approved, rejected, or needs-revision request (cannot delete pending requests)
- 'list': List approval records, newest first, with optional categoryName, filePath and status filters
- 'approve': Set a pending or needs-revision request to approved
- 'reject': Set a pending or needs-revision request to rejected, with a reason
- 'prune': Keep one approved record for a document and delete every other record for the same filePath in its category, together with their snapshots

'approve', 'reject', 'list' and 'prune' exist for autonomous harnesses that own the approval decision themselves. Interactive workflows must not call 'approve' or 'reject': the human decides in the dashboard or the VS Code extension.

CRITICAL: Only provide filePath parameter for requests - the dashboard reads files directly. Never include document content. In an interactive workflow, wait for the user to review and approve before continuing.`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['request', 'status', 'delete', 'list', 'approve', 'reject', 'prune'],
        description: 'The action to perform: request, status, delete, list, approve, reject, or prune'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root (optional - uses server context path if not provided)'
      },
      approvalId: {
        type: 'string',
        description: 'The ID of the approval request (required for status, delete, approve and reject actions)'
      },
      title: {
        type: 'string',
        description: 'Brief title describing what needs approval (required for request action)'
      },
      filePath: {
        type: 'string',
        description: 'Path to the file, relative to project root. Required for request (the file that needs approval) and prune (the document whose records are pruned); optional filter for list.'
      },
      type: {
        type: 'string',
        enum: ['document', 'action'],
        description: 'Type of approval request - "document" for content approval, "action" for action approval (required for request)'
      },
      category: {
        type: 'string',
        enum: ['spec', 'steering', 'decomposition'],
        description: 'Category of the approval request - "spec" for specifications, "steering" for steering documents, "decomposition" for decomposition documents (required for request)'
      },
      categoryName: {
        type: 'string',
        description: 'Name of the spec or "steering" for steering documents. Required for request and prune; optional filter for list.'
      },
      response: {
        type: 'string',
        description: 'Decision text recorded on the approval. Required for reject; optional for approve (defaults to a standard note).'
      },
      status: {
        type: 'string',
        enum: [...APPROVAL_STATUSES],
        description: 'Optional status filter for list'
      },
      keepApprovalId: {
        type: 'string',
        description: 'For prune: the ID of the approved record to keep. It must exist, be approved, and belong to the given categoryName and filePath.'
      }
    },
    required: ['action']
  },
  annotations: {
    title: 'Approvals',
    destructiveHint: true,
  }
};

// Type definitions for discriminated unions
type RequestApprovalArgs = {
  action: 'request';
  projectPath?: string;
  title: string;
  filePath: string;
  type: 'document' | 'action';
  category: 'spec' | 'steering' | 'decomposition';
  categoryName: string;
};

type StatusApprovalArgs = {
  action: 'status';
  projectPath?: string;
  approvalId: string;
};

type DeleteApprovalArgs = {
  action: 'delete';
  projectPath?: string;
  approvalId: string;
};

type ListApprovalsArgs = {
  action: 'list';
  projectPath?: string;
  categoryName?: string;
  filePath?: string;
  status?: ApprovalStatus;
};

type DecideApprovalArgs = {
  action: 'approve' | 'reject';
  projectPath?: string;
  approvalId: string;
  response?: string;
};

type PruneApprovalsArgs = {
  action: 'prune';
  projectPath?: string;
  categoryName: string;
  filePath: string;
  keepApprovalId: string;
};

type ApprovalArgs =
  | RequestApprovalArgs
  | StatusApprovalArgs
  | DeleteApprovalArgs
  | ListApprovalsArgs
  | DecideApprovalArgs
  | PruneApprovalsArgs;

// Type guard functions
function isRequestApproval(args: ApprovalArgs): args is RequestApprovalArgs {
  return args.action === 'request';
}

function isStatusApproval(args: ApprovalArgs): args is StatusApprovalArgs {
  return args.action === 'status';
}

function isDeleteApproval(args: ApprovalArgs): args is DeleteApprovalArgs {
  return args.action === 'delete';
}

export async function approvalsHandler(
  args: {
    action: 'request' | 'status' | 'delete' | 'list' | 'approve' | 'reject' | 'prune';
    projectPath?: string;
    approvalId?: string;
    title?: string;
    filePath?: string;
    type?: 'document' | 'action';
    category?: 'spec' | 'steering' | 'decomposition';
    categoryName?: string;
    response?: string;
    status?: ApprovalStatus;
    keepApprovalId?: string;
  },
  context: ToolContext
): Promise<ToolResponse> {
  // Cast to discriminated union type
  const typedArgs = args as ApprovalArgs;

  switch (typedArgs.action) {
    case 'request':
      if (isRequestApproval(typedArgs)) {
        // Validate required fields for request
        if (!args.title || !args.filePath || !args.type || !args.category || !args.categoryName) {
          return {
            success: false,
            message: 'Missing required fields for request action. Required: title, filePath, type, category, categoryName'
          };
        }
        return handleRequestApproval(typedArgs, context);
      }
      break;
    case 'status':
      if (isStatusApproval(typedArgs)) {
        // Validate required fields for status
        if (!args.approvalId) {
          return {
            success: false,
            message: 'Missing required field for status action. Required: approvalId'
          };
        }
        return handleGetApprovalStatus(typedArgs, context);
      }
      break;
    case 'delete':
      if (isDeleteApproval(typedArgs)) {
        // Validate required fields for delete
        if (!args.approvalId) {
          return {
            success: false,
            message: 'Missing required field for delete action. Required: approvalId'
          };
        }
        return handleDeleteApproval(typedArgs, context);
      }
      break;
    case 'list':
      if (args.status && !APPROVAL_STATUSES.includes(args.status)) {
        return {
          success: false,
          message: `Invalid status filter "${args.status}". Use one of: ${APPROVAL_STATUSES.join(', ')}`
        };
      }
      return handleListApprovals(typedArgs as ListApprovalsArgs, context);
    case 'approve':
    case 'reject':
      if (!args.approvalId) {
        return {
          success: false,
          message: `Missing required field for ${typedArgs.action} action. Required: approvalId`
        };
      }
      if (typedArgs.action === 'reject' && !args.response) {
        return {
          success: false,
          message: 'Missing required field for reject action. Required: response (the reason)'
        };
      }
      return handleDecideApproval(typedArgs as DecideApprovalArgs, context);
    case 'prune':
      if (!args.categoryName || !args.filePath || !args.keepApprovalId) {
        return {
          success: false,
          message: 'Missing required fields for prune action. Required: categoryName, filePath, keepApprovalId'
        };
      }
      return handlePruneApprovals(typedArgs as PruneApprovalsArgs, context);
    default:
      return {
        success: false,
        message: `Unknown action: ${(args as any).action}. Use 'request', 'status', 'delete', 'list', 'approve', 'reject', or 'prune'.`
      };
  }

  // This should never be reached due to exhaustive type checking
  return {
    success: false,
    message: 'Invalid action configuration'
  };
}

/**
 * Validate and translate the project path, then open an ApprovalStorage on it.
 * The caller must `stop()` the storage when done.
 */
async function openApprovalStorage(
  projectPath: string
): Promise<{ storage: ApprovalStorage; validatedProjectPath: string }> {
  const validatedProjectPath = await validateProjectPath(projectPath);
  // Translate path at tool entry point (ApprovalStorage expects pre-translated paths)
  const translatedPath = safeTranslatePath(validatedProjectPath);

  const storage = new ApprovalStorage(translatedPath, {
    originalPath: validatedProjectPath,
    fileResolutionPath: translatedPath
  });
  await storage.start();
  return { storage, validatedProjectPath };
}

function summarizeApproval(approval: ApprovalRequest) {
  return {
    id: approval.id,
    title: approval.title,
    filePath: approval.filePath,
    status: approval.status,
    createdAt: approval.createdAt,
    respondedAt: approval.respondedAt,
    response: approval.response
  };
}

async function handleRequestApproval(
  args: RequestApprovalArgs,
  context: ToolContext
): Promise<ToolResponse> {
  // Use context projectPath as default, allow override via args
  const projectPath = args.projectPath || context.projectPath;

  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required but not provided in context or arguments'
    };
  }

  try {
    // Validate and resolve project path
    const validatedProjectPath = await validateProjectPath(projectPath);
    // Translate path at tool entry point (ApprovalStorage expects pre-translated paths)
    const translatedPath = safeTranslatePath(validatedProjectPath);

    const approvalStorage = new ApprovalStorage(translatedPath, {
      originalPath: validatedProjectPath,
      fileResolutionPath: translatedPath
    });
    await approvalStorage.start();

    // Security: Validate filePath to prevent arbitrary file reads
    if (isAbsolute(args.filePath)) {
      await approvalStorage.stop();
      return {
        success: false,
        message: 'Security error: absolute paths are not allowed for filePath. Use a path relative to the project root.'
      };
    }
    if (args.filePath.includes('..')) {
      await approvalStorage.stop();
      return {
        success: false,
        message: 'Security error: path traversal (..) is not allowed in filePath. Use a path relative to the project root.'
      };
    }

    const isMarkdownFile = args.filePath.toLowerCase().endsWith('.md');
    let markdownContent: string | undefined;

    if (isMarkdownFile) {
      try {
        const fullPath = PathUtils.safeJoin(validatedProjectPath, args.filePath);
        markdownContent = await readFile(fullPath, 'utf-8');
      } catch (fileError) {
        await approvalStorage.stop();
        const errorMessage = fileError instanceof Error ? fileError.message : String(fileError);
        return {
          success: false,
          message: `Failed to read markdown file for validation: ${errorMessage}`
        };
      }

      const mdxValidation = await validateMarkdownForMdx(markdownContent);
      if (!mdxValidation.valid) {
        await approvalStorage.stop();
        const formattedIssues = formatMdxValidationIssues(mdxValidation.issues);

        return {
          success: false,
          message: 'Markdown file has MDX compatibility errors that must be fixed before approval',
          data: {
            errorCount: mdxValidation.issues.length,
            summary: {
              totalIssues: mdxValidation.issues.length,
              rules: [...new Set(mdxValidation.issues.map(issue => issue.ruleId))]
            }
          },
          nextSteps: [
            'Fix MDX compatibility issues listed below',
            'For literal comparisons (for example "<5%"), use "&lt;5%" or inline code (`<5%`)',
            'Re-request approval after fixing',
            ...formattedIssues
          ]
        };
      }
    }

    // Validate tasks.md format before allowing approval request
    if (args.filePath.endsWith('tasks.md')) {
      const content = markdownContent ?? await readFile(PathUtils.safeJoin(validatedProjectPath, args.filePath), 'utf-8');
      const validationResult = validateTasksMarkdown(content);

      if (!validationResult.valid) {
        await approvalStorage.stop();

        const errorMessages = formatValidationErrors(validationResult);

        return {
          success: false,
          message: 'Tasks document has format errors that must be fixed before approval',
          data: {
            errorCount: validationResult.errors.length,
            warningCount: validationResult.warnings.length,
            summary: validationResult.summary
          },
          nextSteps: [
            'Fix the format errors listed below',
            'Ensure each task has: checkbox (- [ ]), numeric ID (1.1), description',
            'Ensure metadata uses underscores: _Requirements: ..._',
            'Ensure _Prompt ends with underscore',
            'Re-request approval after fixing',
            ...errorMessages
          ]
        };
      }

      // If there are warnings, include them but allow approval to proceed
      if (validationResult.warnings.length > 0) {
        // Warnings don't block approval, but will be included in the response
        // This allows the user to see potential issues while still proceeding
      }
    }

    const approvalId = await approvalStorage.createApproval(
      args.title,
      args.filePath,
      args.category,
      args.categoryName,
      args.type
    );

    await approvalStorage.stop();

    // Build deeplink URL that navigates directly to this specific approval
    const deeplink = context.dashboardUrl
      ? `${context.dashboardUrl}/approvals?id=${encodeURIComponent(approvalId)}`
      : undefined;

    return {
      success: true,
      message: `Approval request created successfully. Please review in dashboard: ${deeplink || 'Start with: spec-workflow-mcp --dashboard'}`,
      data: {
        approvalId,
        title: args.title,
        filePath: args.filePath,
        type: args.type,
        status: 'pending',
        dashboardUrl: deeplink
      },
      nextSteps: [
        'BLOCKING - Dashboard approval required',
        'VERBAL APPROVAL NOT ACCEPTED',
        'Do not proceed on verbal confirmation',
        deeplink ? `Use dashboard: ${deeplink}` : 'Start the dashboard with: spec-workflow-mcp --dashboard',
        `Poll status with: approvals action:"status" approvalId:"${approvalId}"`
      ],
      projectContext: {
        projectPath: validatedProjectPath,
        workflowRoot: join(validatedProjectPath, '.spec-workflow'),
        dashboardUrl: deeplink
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to create approval request: ${errorMessage}`
    };
  }
}

async function handleGetApprovalStatus(
  args: StatusApprovalArgs,
  context: ToolContext
): Promise<ToolResponse> {
  // approvalId is guaranteed by type

  try {
    // Use provided projectPath or fall back to context
    const projectPath = args.projectPath || context.projectPath;
    if (!projectPath) {
      return {
        success: false,
        message: 'Project path is required. Please provide projectPath parameter.'
      };
    }

    // Validate and resolve project path
    const validatedProjectPath = await validateProjectPath(projectPath);
    // Translate path at tool entry point (ApprovalStorage expects pre-translated paths)
    const translatedPath = safeTranslatePath(validatedProjectPath);

    const approvalStorage = new ApprovalStorage(translatedPath, {
      originalPath: validatedProjectPath,
      fileResolutionPath: translatedPath
    });
    await approvalStorage.start();

    const approval = await approvalStorage.getApproval(args.approvalId);

    if (!approval) {
      await approvalStorage.stop();
      return {
        success: false,
        message: `Approval request not found: ${args.approvalId}`
      };
    }

    await approvalStorage.stop();

    const isCompleted = approval.status === 'approved' || approval.status === 'rejected';
    const canProceed = approval.status === 'approved';
    const mustWait = approval.status !== 'approved';
    const nextSteps: string[] = [];

    if (approval.status === 'pending') {
      nextSteps.push('BLOCKED - Do not proceed');
      nextSteps.push('VERBAL APPROVAL NOT ACCEPTED - Use dashboard or VS Code extension only');
      nextSteps.push('Approval must be done via dashboard or VS Code extension');
      nextSteps.push('Continue polling with approvals action:"status"');
    } else if (approval.status === 'approved') {
      nextSteps.push('APPROVED - Can proceed');
      nextSteps.push('Run approvals action:"delete" before continuing');
      if (approval.response) {
        nextSteps.push(`Response: ${approval.response}`);
      }
    } else if (approval.status === 'rejected') {
      nextSteps.push('BLOCKED - REJECTED');
      nextSteps.push('Do not proceed');
      nextSteps.push('Review feedback and revise');
      if (approval.response) {
        nextSteps.push(`Reason: ${approval.response}`);
      }
      if (approval.annotations) {
        nextSteps.push(`Notes: ${approval.annotations}`);
      }
    } else if (approval.status === 'needs-revision') {
      nextSteps.push('BLOCKED - Do not proceed');
      nextSteps.push('Update document with feedback');
      nextSteps.push('Create NEW approval request');
      if (approval.response) {
        nextSteps.push(`Feedback: ${approval.response}`);
      }
      if (approval.annotations) {
        nextSteps.push(`Notes: ${approval.annotations}`);
      }
      if (approval.comments && approval.comments.length > 0) {
        nextSteps.push(`${approval.comments.length} comments for targeted fixes:`);
        // Add each comment to nextSteps for visibility
        approval.comments.forEach((comment, index) => {
          if (comment.type === 'selection' && comment.selectedText) {
            nextSteps.push(`  Comment ${index + 1} on "${comment.selectedText.substring(0, 50)}...": ${comment.comment}`);
          } else {
            nextSteps.push(`  Comment ${index + 1} (general): ${comment.comment}`);
          }
        });
      }
    }

    return {
      success: true,
      message: approval.status === 'pending'
        ? `BLOCKED: Status is ${approval.status}. Verbal approval is NOT accepted. Use dashboard or VS Code extension only.`
        : `Approval status: ${approval.status}`,
      data: {
        approvalId: args.approvalId,
        title: approval.title,
        type: approval.type,
        status: approval.status,
        createdAt: approval.createdAt,
        respondedAt: approval.respondedAt,
        response: approval.response,
        annotations: approval.annotations,
        comments: approval.comments,
        isCompleted,
        canProceed,
        mustWait,
        blockNext: !canProceed,
        dashboardUrl: context.dashboardUrl
      },
      nextSteps,
      projectContext: {
        projectPath: validatedProjectPath,
        workflowRoot: join(validatedProjectPath, '.spec-workflow'),
        dashboardUrl: context.dashboardUrl
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to check approval status: ${errorMessage}`
    };
  }
}

async function handleDeleteApproval(
  args: DeleteApprovalArgs,
  context: ToolContext
): Promise<ToolResponse> {
  // approvalId is guaranteed by type

  try {
    // Use provided projectPath or fall back to context
    const projectPath = args.projectPath || context.projectPath;
    if (!projectPath) {
      return {
        success: false,
        message: 'Project path is required. Please provide projectPath parameter.'
      };
    }

    // Validate and resolve project path
    const validatedProjectPath = await validateProjectPath(projectPath);
    // Translate path at tool entry point (ApprovalStorage expects pre-translated paths)
    const translatedPath = safeTranslatePath(validatedProjectPath);

    const approvalStorage = new ApprovalStorage(translatedPath, {
      originalPath: validatedProjectPath,
      fileResolutionPath: translatedPath
    });
    await approvalStorage.start();

    // Check if approval exists and its status
    const approval = await approvalStorage.getApproval(args.approvalId);
    if (!approval) {
      await approvalStorage.stop();
      return {
        success: false,
        message: `Approval request "${args.approvalId}" not found`,
        nextSteps: [
          'Verify approval ID',
          'Check status with approvals action:"status"'
        ]
      };
    }

    // Only block deletion of pending requests (still awaiting approval)
    // Allow deletion of: approved, needs-revision, rejected
    if (approval.status === 'pending') {
      await approvalStorage.stop();
      return {
        success: false,
        message: `BLOCKED: Cannot delete - status is "${approval.status}". This approval is still awaiting review. VERBAL APPROVAL NOT ACCEPTED. Use dashboard or VS Code extension.`,
        data: {
          approvalId: args.approvalId,
          currentStatus: approval.status,
          title: approval.title,
          blockProgress: true,
          canProceed: false
        },
        nextSteps: [
          'STOP - Cannot delete pending approval',
          'Wait for approval or rejection',
          'Poll with approvals action:"status"',
          'Delete only after status changes to approved, rejected, or needs-revision'
        ]
      };
    }

    // Delete the approval
    const deleted = await approvalStorage.deleteApproval(args.approvalId);
    await approvalStorage.stop();

    if (deleted) {
      return {
        success: true,
        message: `Approval request "${args.approvalId}" deleted successfully`,
        data: {
          deletedApprovalId: args.approvalId,
          title: approval.title,
          category: approval.category,
          categoryName: approval.categoryName
        },
        nextSteps: [
          'Cleanup complete',
          'Continue to next phase'
        ],
        projectContext: {
          projectPath: validatedProjectPath,
          workflowRoot: join(validatedProjectPath, '.spec-workflow'),
          dashboardUrl: context.dashboardUrl
        }
      };
    } else {
      return {
        success: false,
        message: `Failed to delete approval request "${args.approvalId}"`,
        nextSteps: [
          'Check file permissions',
          'Verify approval exists',
          'Retry'
        ]
      };
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to delete approval: ${errorMessage}`,
      nextSteps: [
        'Check project path',
        'Verify permissions',
        'Check approval system'
      ]
    };
  }
}

async function handleListApprovals(
  args: ListApprovalsArgs,
  context: ToolContext
): Promise<ToolResponse> {
  const projectPath = args.projectPath || context.projectPath;
  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required. Please provide projectPath parameter.'
    };
  }

  try {
    const { storage, validatedProjectPath } = await openApprovalStorage(projectPath);
    try {
      const wantedPath = args.filePath ? normalizeApprovalFilePath(args.filePath) : null;
      // getAllApprovals returns newest first
      const all = await storage.getAllApprovals();
      const approvals = all.filter(approval =>
        (!args.categoryName || approval.categoryName === args.categoryName) &&
        (!wantedPath || normalizeApprovalFilePath(approval.filePath) === wantedPath) &&
        (!args.status || approval.status === args.status)
      );

      return {
        success: true,
        message: `${approvals.length} approval record(s) found`,
        data: {
          count: approvals.length,
          filters: {
            categoryName: args.categoryName,
            filePath: args.filePath,
            status: args.status
          },
          approvals: approvals.map(summarizeApproval)
        },
        projectContext: {
          projectPath: validatedProjectPath,
          workflowRoot: join(validatedProjectPath, '.spec-workflow'),
          dashboardUrl: context.dashboardUrl
        }
      };
    } finally {
      await storage.stop();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to list approvals: ${errorMessage}`
    };
  }
}

async function handleDecideApproval(
  args: DecideApprovalArgs,
  context: ToolContext
): Promise<ToolResponse> {
  const target: 'approved' | 'rejected' = args.action === 'approve' ? 'approved' : 'rejected';
  const projectPath = args.projectPath || context.projectPath;
  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required. Please provide projectPath parameter.'
    };
  }

  try {
    const { storage, validatedProjectPath } = await openApprovalStorage(projectPath);
    try {
      const approval = await storage.getApproval(args.approvalId);
      if (!approval) {
        return {
          success: false,
          message: `Approval request not found: ${args.approvalId}`
        };
      }

      const projectContext = {
        projectPath: validatedProjectPath,
        workflowRoot: join(validatedProjectPath, '.spec-workflow'),
        dashboardUrl: context.dashboardUrl
      };

      // Idempotent: the record already has the requested status
      if (approval.status === target) {
        return {
          success: true,
          message: `Approval request "${args.approvalId}" is already ${target}`,
          data: { ...summarizeApproval(approval), unchanged: true },
          projectContext
        };
      }

      if (approval.status !== 'pending' && approval.status !== 'needs-revision') {
        return {
          success: false,
          message: `Cannot ${args.action} approval request "${args.approvalId}": its status is "${approval.status}". Only pending or needs-revision requests can be ${target}.`,
          data: summarizeApproval(approval)
        };
      }

      const response = target === 'approved'
        ? (args.response || 'Approved by the autonomous harness')
        : (args.response as string);

      // Same path as the dashboard route: snapshots and record fields behave identically
      await storage.updateApproval(args.approvalId, target, response);
      const updated = await storage.getApproval(args.approvalId);

      return {
        success: true,
        message: `Approval request "${args.approvalId}" ${target}`,
        data: summarizeApproval(updated ?? { ...approval, status: target, response }),
        nextSteps: target === 'approved'
          ? [`Run approvals action:"prune" with keepApprovalId:"${args.approvalId}" to remove superseded records for this document`]
          : ['Revise the document and request a new approval'],
        projectContext
      };
    } finally {
      await storage.stop();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to ${args.action} approval: ${errorMessage}`
    };
  }
}

async function handlePruneApprovals(
  args: PruneApprovalsArgs,
  context: ToolContext
): Promise<ToolResponse> {
  const projectPath = args.projectPath || context.projectPath;
  if (!projectPath) {
    return {
      success: false,
      message: 'Project path is required. Please provide projectPath parameter.'
    };
  }

  if (args.categoryName.includes('/') || args.categoryName.includes('\\') || args.categoryName.includes('..')) {
    return {
      success: false,
      message: 'Security error: categoryName must be a plain directory name'
    };
  }
  if (isAbsolute(args.filePath) || args.filePath.includes('..')) {
    return {
      success: false,
      message: 'Security error: filePath must be relative to the project root and must not contain ".."'
    };
  }

  try {
    const { storage, validatedProjectPath } = await openApprovalStorage(projectPath);
    try {
      const keeper = await storage.getApproval(args.keepApprovalId);
      if (!keeper) {
        return {
          success: false,
          message: `Keeper approval request not found: ${args.keepApprovalId}`
        };
      }
      if (keeper.status !== 'approved') {
        return {
          success: false,
          message: `Keeper approval request "${args.keepApprovalId}" has status "${keeper.status}", not "approved". Approve it first, or choose an approved record.`,
          data: summarizeApproval(keeper)
        };
      }

      const wantedPath = normalizeApprovalFilePath(args.filePath);
      if (keeper.categoryName !== args.categoryName || normalizeApprovalFilePath(keeper.filePath) !== wantedPath) {
        return {
          success: false,
          message: `Keeper approval request "${args.keepApprovalId}" belongs to category "${keeper.categoryName}" and file "${keeper.filePath}", not to "${args.categoryName}" / "${args.filePath}".`,
          data: summarizeApproval(keeper)
        };
      }

      const all = await storage.getAllApprovals();
      const others = all.filter(approval =>
        approval.id !== keeper.id &&
        approval.categoryName === args.categoryName &&
        normalizeApprovalFilePath(approval.filePath) === wantedPath
      );

      let recordsRejected = 0;
      let recordsDeleted = 0;
      const recordsFailed: string[] = [];

      for (const record of others) {
        if (record.status === 'pending' || record.status === 'needs-revision') {
          await storage.updateApproval(record.id, 'rejected', `Superseded by ${keeper.title} (${keeper.id})`);
          recordsRejected++;
        }
        const deleted = await storage.deleteApproval(record.id);
        if (deleted) {
          recordsDeleted++;
        } else {
          recordsFailed.push(record.id);
        }
      }

      const snapshots = await storage.pruneSnapshots(args.categoryName, args.filePath, keeper.id);

      return {
        success: recordsFailed.length === 0,
        message: recordsFailed.length === 0
          ? `Pruned ${recordsDeleted} approval record(s) for ${args.filePath} in ${args.categoryName} (${recordsRejected} rejected first); ${snapshots.deleted} snapshot(s) deleted, ${snapshots.kept} kept`
          : `Prune incomplete: ${recordsFailed.length} record(s) could not be deleted (${recordsFailed.join(', ')})`,
        data: {
          keepApprovalId: keeper.id,
          keeperTitle: keeper.title,
          categoryName: args.categoryName,
          filePath: args.filePath,
          recordsRejected,
          recordsDeleted,
          recordsFailed,
          snapshotsDeleted: snapshots.deleted,
          snapshotsKept: snapshots.kept
        },
        projectContext: {
          projectPath: validatedProjectPath,
          workflowRoot: join(validatedProjectPath, '.spec-workflow'),
          dashboardUrl: context.dashboardUrl
        }
      };
    } finally {
      await storage.stop();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to prune approvals: ${errorMessage}`
    };
  }
}
