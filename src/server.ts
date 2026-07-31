import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  ErrorCode
} from '@modelcontextprotocol/sdk/types.js';
import { registerTools, handleToolCall } from './tools/index.js';
import { registerPrompts, handlePromptList, handlePromptGet } from './prompts/index.js';
import { validateProjectPath } from './core/path-utils.js';
import { WorkspaceInitializer } from './core/workspace-initializer.js';
import { ProjectRegistry } from './core/project-registry.js';
import { DashboardSessionManager } from './core/dashboard-session.js';
import { ToolContext } from './types.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Returns `workspacePath` when it passes `validateProjectPath`, otherwise logs
 * and returns `fallbackPath` (requirement 1.8).
 *
 * Falls back rather than throwing: `initialize` runs before the transport
 * connects, so a rejected inference must not be able to kill the MCP handshake.
 * `fallbackPath` is the configured path's git top-level — the value resolution
 * would have produced with inference off — not the raw configured path
 * (requirement 1.2).
 */
export async function validateInferredWorkspace(
  workspacePath: string,
  fallbackPath: string
): Promise<string> {
  try {
    await validateProjectPath(workspacePath);
    return workspacePath;
  } catch (error: any) {
    console.error(
      `Inferred workspace path "${workspacePath}" was rejected: ${error?.message ?? error}. ` +
      `Falling back to the configured project path "${fallbackPath}".`
    );
    return fallbackPath;
  }
}

/** Both roots, once the inferred workspace has had its validation. */
export interface SettledRoots {
  workflowRootPath: string;
  workspacePath: string;
}

/**
 * Settles **both** roots together after a rejected inference (requirements 1.8,
 * 2.8).
 *
 * The workspace falls back to the configured path's git top-level. The workflow
 * root has to move with it whenever it *is* the workspace — which is what
 * `--no-shared-worktree-specs` makes it (requirement 2.8) — because otherwise
 * the workflow root keeps the path validation just rejected, and the
 * `validateProjectPath(this.projectPath)` in `initialize` throws on it: the
 * startup abort requirement 1.8 exists to prevent, reached through the other
 * root. A workflow root that resolves independently (the shared main-repo root,
 * or an explicit `SPEC_WORKFLOW_SHARED_ROOT`) is left alone.
 */
export async function settleWorkspaceRoots(
  workflowRootPath: string,
  workspacePath: string,
  inferredWorkspaceFallback?: string
): Promise<SettledRoots> {
  if (inferredWorkspaceFallback === undefined) {
    return { workflowRootPath, workspacePath };
  }

  const settledWorkspacePath = await validateInferredWorkspace(workspacePath, inferredWorkspaceFallback);

  return {
    workflowRootPath: workflowRootPath === workspacePath ? settledWorkspacePath : workflowRootPath,
    workspacePath: settledWorkspacePath
  };
}

export class SpecWorkflowMCPServer {
  private server: Server;
  private projectPath!: string;   // workflowRootPath for .spec-workflow operations
  private workspacePath!: string; // workspace/worktree path for identity in registry
  private projectRegistry: ProjectRegistry;
  private lang?: string;

  constructor() {
    // Get version from package.json
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

    // Get all registered tools and prompts
    const tools = registerTools();
    const prompts = registerPrompts();

    // Create tools capability object with each tool name
    const toolsCapability = tools.reduce((acc, tool) => {
      acc[tool.name] = {};
      return acc;
    }, {} as Record<string, {}>);

    this.server = new Server({
      name: 'spec-workflow-mcp',
      version: packageJson.version
    }, {
      capabilities: {
        tools: toolsCapability,
        prompts: {
          listChanged: true
        }
      }
    });

    this.projectRegistry = new ProjectRegistry();
  }

  /**
   * The roots in force, or `undefined` before `initialize` has settled them.
   *
   * `initialize` assigns both before it can throw, so the caller's `finally`
   * reports the settled state rather than the provisional one it passed in
   * (requirement 1.18: one emission, and a true one).
   */
  get settledWorkflowRootPath(): string | undefined {
    return this.projectPath;
  }

  get settledWorkspacePath(): string | undefined {
    return this.workspacePath;
  }

  /**
   * @param inferredWorkspaceFallback - Set only when `workspacePath` was
   *   **inferred** from the launch directory (requirement 1.8). Inference
   *   derives the workspace from `process.cwd()`, which the user did not
   *   choose, and `validateProjectPath` rejects non-directories, paths without
   *   write access, and `/var`-prefixed paths — any of which would turn a
   *   working setup into a failed startup. The check lives here because that
   *   predicate is async and `resolveWorkspaceRoots` is not.
   * @returns the **settled** workspace path — `workspacePath` itself, or
   *   `inferredWorkspaceFallback` when the inferred path was rejected. The
   *   caller logs the resolution (requirement 1.18) and can only tell the truth
   *   about which path is in force once this has returned — or, when this
   *   throws, by reading {@link settledWorkspacePath} and
   *   {@link settledWorkflowRootPath}, which are assigned before anything below
   *   can fail.
   */
  async initialize(
    projectPath: string,
    workspacePath: string,
    lang?: string,
    inferredWorkspaceFallback?: string
  ): Promise<string> {
    // Both roots settle here, together: a fallback that moved only the
    // workspace would leave the workflow root on the rejected path.
    const settled = await settleWorkspaceRoots(projectPath, workspacePath, inferredWorkspaceFallback);
    this.projectPath = settled.workflowRootPath;
    this.workspacePath = settled.workspacePath;
    this.lang = lang;

    try {
      // Validate project path
      await validateProjectPath(this.projectPath);
      await validateProjectPath(this.workspacePath);

      // Initialize workspace
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const packageJsonPath = join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const workspaceInitializer = new WorkspaceInitializer(this.projectPath, packageJson.version);
      await workspaceInitializer.initializeWorkspace();

      // Register this project in the global registry
      const projectId = await this.projectRegistry.registerProject(this.workspacePath, process.pid, {
        workflowRootPath: this.projectPath
      });
      // Requirement 6.4: on lock-budget exhaustion `registerProject` still returns
      // the id but logs that it is continuing UNREGISTERED, so claiming success
      // here unconditionally would contradict that banner. Report what the
      // registry actually holds.
      const registered = await this.projectRegistry.getProjectById(projectId);
      console.error(registered ? `Project registered: ${projectId}` : `Project NOT registered: ${projectId}`);

      // Try to get the dashboard URL from session manager
      let dashboardUrl: string | undefined = undefined;
      try {
        const sessionManager = new DashboardSessionManager();
        const dashboardSession = await sessionManager.getDashboardSession();
        if (dashboardSession) {
          dashboardUrl = dashboardSession.url;
        }
      } catch (error) {
        // Dashboard not running, continue without it
      }

      // Create context for tools. The annotation is load-bearing: without it
      // `setupHandlers(context: any)` launders this literal and the compiler
      // never reports it as a construction site (requirement 3.2).
      const context: ToolContext = {
        projectPath: this.projectPath,
        workspacePath: this.workspacePath,
        dashboardUrl: dashboardUrl,
        lang: this.lang
      };

      // Register handlers
      this.setupHandlers(context);

      // Connect to stdio transport
      const transport = new StdioServerTransport();

      // Handle client disconnection - exit gracefully when transport closes
      transport.onclose = async () => {
        await this.stop();
        process.exit(0);
      };

      await this.server.connect(transport);

      // Monitor stdin for client disconnection (additional safety net)
      process.stdin.on('end', async () => {
        await this.stop();
        process.exit(0);
      });

      // Handle stdin errors
      process.stdin.on('error', async (error) => {
        console.error('stdin error:', error);
        await this.stop();
        process.exit(1);
      });

      // MCP server initialized successfully

      return this.workspacePath;

    } catch (error) {
      throw error;
    }
  }

  private setupHandlers(context: ToolContext) {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: registerTools()
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        return await handleToolCall(request.params.name, request.params.arguments || {}, context);
      } catch (error: any) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });

    // Prompt handlers
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      try {
        return await handlePromptList();
      } catch (error: any) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      try {
        return await handlePromptGet(
          request.params.name,
          request.params.arguments || {},
          context
        );
      } catch (error: any) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });
  }

  /**
   * Check if running in Docker mode (path translation enabled)
   * When in Docker, we can't verify host PIDs and want projects to persist
   */
  private isDockerMode(): boolean {
    const hostPrefix = process.env.SPEC_WORKFLOW_HOST_PATH_PREFIX;
    const containerPrefix = process.env.SPEC_WORKFLOW_CONTAINER_PATH_PREFIX;
    return !!(hostPrefix && containerPrefix);
  }

  async stop() {
    try {
      // Only unregister when NOT in Docker mode
      // In Docker, projects should persist across sessions since we can't verify host PIDs
      if (!this.isDockerMode()) {
        try {
          // Pass current PID to only remove this specific instance
          await this.projectRegistry.unregisterProject(this.workspacePath, process.pid);
          console.error('Project instance unregistered from global registry');
        } catch (error) {
          // Ignore errors during cleanup
        }
      } else {
        console.error('Docker mode: skipping project unregistration (projects persist across sessions)');
      }

      // Stop MCP server
      await this.server.close();
    } catch (error) {
      console.error('Error during shutdown:', error);
      // Continue with shutdown even if there are errors
    }
  }
}
