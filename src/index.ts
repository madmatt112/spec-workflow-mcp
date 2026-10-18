#!/usr/bin/env node

import { SpecWorkflowMCPServer } from './server.js';
import { MultiProjectDashboardServer } from './dashboard/multi-server.js';
import { DashboardSessionManager } from './core/dashboard-session.js';
import { isLocalhostAddress } from './core/security-utils.js';
import { homedir, tmpdir } from 'os';
import {
  resolveGitWorkspaceRoot,
  resolveWorkspaceRoots,
  SPEC_WORKFLOW_WORKSPACE_ENV
} from './core/git-utils.js';
import type { WorkspaceSource } from './core/git-utils.js';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { realpathSync } from 'fs';
import { mkdtemp } from 'fs/promises';

// Default dashboard port
const DEFAULT_DASHBOARD_PORT = 5000;

export function showHelp() {
  console.error(`
Spec Workflow MCP Server - A Model Context Protocol server for spec-driven development

USAGE:
  spec-workflow-mcp [path] [options]

ARGUMENTS:
  path                    Project path (defaults to current directory)
                         Supports ~ for home directory

OPTIONS:
  --help                  Show this help message
  --dashboard             Run dashboard-only mode (no MCP server)
  --port <number>         Specify dashboard port (1024-65535)
                         Default: 5000
                         Only use if port 5000 is unavailable
  --host <address>        Bind address for the dashboard
                         Default: 127.0.0.1 (localhost only)
                         A non-localhost address opts in to LAN access; the
                         shared secret is then required on every request
  --no-shared-worktree-specs
                         Disable shared .spec-workflow in git worktrees
                         Use workspace-local .spec-workflow instead of main repo
  --no-workspace-inference
                         Don't infer the workspace from the current directory
                         Use the project path argument's git top-level instead.
                         The escape hatch when the launch directory is not the
                         checkout you want reviewed.
  --watch                 Watch the SDD harness run of the active spec in the
                         terminal (no MCP server, no dashboard). The path is
                         the spec store repo or its .spec-workflow directory.
  --spec <name>           With --watch: the spec to show (default: the active
                         spec named in HANDOFF.md, else the newest run)
  --once                  With --watch: render one frame and exit
  --smoke                 With --dashboard: start on an isolated session,
                          request /api/health once, print it and exit 0; any
                          failure exits 1 within 30 seconds. The staged
                          self-update boots a new build this way before it
                          swaps dist/ in.

ENVIRONMENT:
  SPEC_WORKFLOW_WORKSPACE Explicit workspace path, overriding inference
  SPEC_WORKFLOW_SHARED_ROOT
                         Explicit .spec-workflow root, overriding the git root

IMPORTANT:
  Only ONE dashboard instance runs at a time. All MCP servers connect to the
  same dashboard. The dashboard runs on port 5000 by default.

MODES OF OPERATION:

1. MCP Server Only (default):
   spec-workflow-mcp
   spec-workflow-mcp ~/my-project

   Starts MCP server without dashboard. Dashboard can be started separately.

2. Dashboard Only Mode:
   spec-workflow-mcp --dashboard
   spec-workflow-mcp --dashboard --port 8080

   Runs only the web dashboard without MCP server (default port: 5000).
   Projects will automatically appear in the dashboard as MCP servers register.
   Only one dashboard instance is needed for all your projects.

EXAMPLES:
  # Start MCP server in current directory (no dashboard)
  spec-workflow-mcp

  # Start MCP server in a specific project directory
  spec-workflow-mcp ~/projects/my-app

  # Run dashboard (default port 5000) - START THIS FIRST
  spec-workflow-mcp --dashboard

  # Run dashboard on custom port (if 5000 is unavailable)
  spec-workflow-mcp --dashboard --port 8080

TYPICAL WORKFLOW:
  1. Start the dashboard once:
     spec-workflow-mcp --dashboard

  2. Start MCP servers for your projects (in separate terminals):
     spec-workflow-mcp ~/project1
     spec-workflow-mcp ~/project2
     spec-workflow-mcp ~/project3

  All projects will appear in the same dashboard at http://localhost:5000

PARAMETER FORMATS:
  --port 3456             Space-separated format
  --port=3456             Equals format

For more information, visit: https://github.com/madmatt112/spec-workflow-mcp
`);
}

function expandTildePath(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace('~', homedir());
  }
  return path;
}

/**
 * Every flag the CLI accepts, and whether it takes a value. Single source of
 * truth: the valid-flag list, the boolean reads, the `--flag=value` rejection
 * set (requirement 1.17) and the project-path filter are all derived from this
 * map, so a boolean flag cannot be registered in one place and forgotten in
 * the others. A hand-written boolean list came up short here once already —
 * `--dashboard=true` was accepted, read as `false`, and became the project
 * path, silently flipping the run mode.
 *
 * Boolean flags are read by exact string match and therefore MUST be rejected
 * in `--flag=value` form. Merely stripping the `=value` would be worse: the
 * reads are exact-string matches, so `--no-workspace-inference=true` would be
 * removed from the path position and read as `false` — silently discarding the
 * opt-out whose entire purpose is escaping a bad inference. Failing loudly is
 * the only outcome that does not mislead.
 */
const CLI_FLAGS = {
  '--dashboard': 'boolean',
  '--help': 'boolean',
  '-h': 'boolean',
  '--host': 'value',
  '--no-open': 'boolean',
  '--no-shared-worktree-specs': 'boolean',
  '--no-workspace-inference': 'boolean',
  '--once': 'boolean',
  '--port': 'value',
  '--smoke': 'boolean',
  '--spec': 'value',
  '--watch': 'boolean'
} as const;

type CliFlag = keyof typeof CLI_FLAGS;
type BooleanFlag = { [K in CliFlag]: (typeof CLI_FLAGS)[K] extends 'boolean' ? K : never }[CliFlag];
type ValueFlag = { [K in CliFlag]: (typeof CLI_FLAGS)[K] extends 'value' ? K : never }[CliFlag];

const VALID_FLAGS: readonly string[] = Object.keys(CLI_FLAGS);

/** Exported so tests enumerate the boolean flags from the registry, not by hand. */
export const BOOLEAN_FLAGS: readonly BooleanFlag[] = (Object.keys(CLI_FLAGS) as CliFlag[])
  .filter((flag): flag is BooleanFlag => CLI_FLAGS[flag] === 'boolean');

/** Exported for the same reason as `BOOLEAN_FLAGS`: the path filter must drop a
 * value flag *and its value* without anyone remembering to name it there. */
export const VALUE_FLAGS: readonly ValueFlag[] = (Object.keys(CLI_FLAGS) as CliFlag[])
  .filter((flag): flag is ValueFlag => CLI_FLAGS[flag] === 'value');

/**
 * Reads every boolean flag in one pass. Reading through this record is what
 * ties a boolean to the registry: `flags['--whatever']` does not compile unless
 * `--whatever` is registered above as a boolean, so a new boolean flag cannot
 * skip the rejection set or the path filter.
 */
function readBooleanFlags(args: string[]): Record<BooleanFlag, boolean> {
  return Object.fromEntries(
    BOOLEAN_FLAGS.map((flag) => [flag, args.includes(flag)])
  ) as Record<BooleanFlag, boolean>;
}

export function parseArguments(args: string[]): {
  workspacePath: string;
  workflowRootPath: string;
  expandedPath: string;
  isDashboardMode: boolean;
  isSmokeMode: boolean;
  isWatchMode: boolean;
  watchOnce: boolean;
  specName?: string;
  noSharedWorktreeSpecs: boolean;
  noWorkspaceInference: boolean;
  workspaceSource: WorkspaceSource;
  port?: number;
  host?: string;
  lang?: string;
} {
  const flags = readBooleanFlags(args);
  const isDashboardMode = flags['--dashboard'];
  const isSmokeMode = flags['--smoke'];
  const isWatchMode = flags['--watch'];
  const watchOnce = flags['--once'];
  let specName: string | undefined;
  const noSharedWorktreeSpecs = flags['--no-shared-worktree-specs'];
  const noWorkspaceInference = flags['--no-workspace-inference'];
  let customPort: number | undefined;
  let customHost: string | undefined;

  // Check for invalid flags
  for (const arg of args) {
    const equalsIndex = arg.indexOf('=');
    const flagName = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);

    // The boolean check is not conditioned on a `--` prefix: `-h=true` carries
    // a value on a boolean flag just as `--help=true` does (requirement 1.17).
    if (equalsIndex !== -1 && (BOOLEAN_FLAGS as readonly string[]).includes(flagName)) {
      throw new Error(
        `Unknown option: ${arg}\n${flagName} is a boolean flag and takes no value. ` +
        `Pass it as ${flagName} on its own.\nUse --help to see available options.`
      );
    }

    if (arg.startsWith('--') && !VALID_FLAGS.includes(flagName)) {
      throw new Error(`Unknown option: ${flagName}\nUse --help to see available options.`);
    }
  }

  // Parse --port parameter (supports --port 3000 and --port=3000 formats)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--port=')) {
      // Handle --port=3000 format
      const portStr = arg.split('=')[1];
      if (portStr) {
        const parsed = parseInt(portStr, 10);
        if (isNaN(parsed)) {
          throw new Error(`Invalid port number: ${portStr}. Port must be a number.`);
        }
        if (parsed < 1024 || parsed > 65535) {
          throw new Error(`Port ${parsed} is out of range. Port must be between 1024 and 65535.`);
        }
        customPort = parsed;
      } else {
        throw new Error('--port parameter requires a value (e.g., --port=3000)');
      }
    } else if (arg === '--port' && i + 1 < args.length) {
      // Handle --port 3000 format
      const portStr = args[i + 1];
      const parsed = parseInt(portStr, 10);
      if (isNaN(parsed)) {
        throw new Error(`Invalid port number: ${portStr}. Port must be a number.`);
      }
      if (parsed < 1024 || parsed > 65535) {
        throw new Error(`Port ${parsed} is out of range. Port must be between 1024 and 65535.`);
      }
      customPort = parsed;
      i++; // Skip the next argument as it's the port value
    } else if (arg === '--port') {
      throw new Error('--port parameter requires a value (e.g., --port 3000)');
    } else if (arg.startsWith('--spec=')) {
      specName = arg.slice('--spec='.length);
      if (!specName) throw new Error('--spec parameter requires a value (e.g., --spec my-feature)');
    } else if (arg === '--spec' && i + 1 < args.length) {
      specName = args[i + 1];
      i++;
    } else if (arg === '--spec') {
      throw new Error('--spec parameter requires a value (e.g., --spec my-feature)');
    } else if (arg.startsWith('--host=')) {
      customHost = arg.slice('--host='.length);
      if (!customHost) throw new Error('--host parameter requires a value (e.g., --host 0.0.0.0)');
    } else if (arg === '--host' && i + 1 < args.length) {
      customHost = args[i + 1];
      i++;
    } else if (arg === '--host') {
      throw new Error('--host parameter requires a value (e.g., --host 0.0.0.0)');
    }
  }

  // Get project path (filter out flags and their values)
  const filteredArgs = args.filter((arg, index) => {
    // Wholly derived from the registry so a newly registered flag — boolean or
    // value-taking — is filtered out of the path position without a second
    // edit. Naming `--port` by hand here is what let this defect class recur.
    // The boolean `--flag=value` form never reaches here — it was rejected above.
    if ((BOOLEAN_FLAGS as readonly string[]).includes(arg)) return false;
    if (VALUE_FLAGS.some((flag) => arg === flag || arg.startsWith(`${flag}=`))) return false;
    // ...and the separate-token value that follows a value flag.
    if (index > 0 && (VALUE_FLAGS as readonly string[]).includes(args[index - 1])) return false;
    return true;
  });

  // For dashboard-only mode, use cwd as default (dashboard doesn't need it)
  const rawProjectPath = filteredArgs[0] || process.cwd();
  const expandedPath = expandTildePath(rawProjectPath);
  // One decision point for both roots (requirements 1.1-1.3, 2.1-2.11).
  const { workspacePath, workflowRootPath, source: workspaceSource } = resolveWorkspaceRoots({
    configuredPath: expandedPath,
    cwd: process.cwd(),
    // Watch mode reads the spec store only, so like the dashboard it skips inference.
    dashboardMode: isDashboardMode || isWatchMode,
    noInference: noWorkspaceInference,
    noSharedWorktreeSpecs
  });

  // Warn if no explicit path was provided and we're using cwd (but only for MCP server mode)
  if (!filteredArgs[0] && !isDashboardMode && !isWatchMode) {
    console.warn(`Warning: No project path specified, using current directory: ${workspacePath}`);
    console.warn('Consider specifying an explicit path for better clarity.');
  }

  return {
    workspacePath,
    workflowRootPath,
    expandedPath,
    isDashboardMode,
    isSmokeMode,
    isWatchMode,
    watchOnce,
    specName,
    noSharedWorktreeSpecs,
    noWorkspaceInference,
    workspaceSource,
    port: customPort,
    host: customHost,
    lang: undefined
  };
}

/**
 * The single workspace-resolution emission (requirement 1.18). One event
 * produces one log: these are mutually exclusive arms of a chain rather than
 * independent blocks, so an inferred workspace does not print alongside the
 * worktree notice it almost always implies, and the final arm carries the
 * paths for the ordinary case so no run emits them twice or not at all.
 *
 * It takes the **settled** roots — the values in force once `initialize` has
 * had its say. Emitting before `initialize` would be emitting a claim that
 * `validateInferredWorkspace` can still overturn, and a later correction would
 * put two contradictory `workspacePath=` lines on stderr. Its single MCP-mode
 * call site therefore sits in a `finally`, which reaches both outcomes with one
 * emission; when `initialize` throws, the caller reads the settled roots off the
 * server, which assigns them before anything else there can fail, so the
 * throwing path reports the same truth as the returning one.
 */
export function logWorkspaceResolution(resolution: {
  workspacePath: string;
  workflowRootPath: string;
  source: WorkspaceSource;
  noSharedWorktreeSpecs: boolean;
  noWorkspaceInference: boolean;
}): void {
  const { workspacePath, workflowRootPath, source, noSharedWorktreeSpecs, noWorkspaceInference } = resolution;

  if (source === 'inference') {
    console.error('Workspace inferred from the working directory. Pass --no-workspace-inference to disable.');
  } else if (source === 'env') {
    console.error(`Workspace set by ${SPEC_WORKFLOW_WORKSPACE_ENV}.`);
  } else if (workspacePath !== workflowRootPath) {
    console.error('Git worktree detected.');
  } else if (noSharedWorktreeSpecs) {
    console.error('Shared worktree specs disabled. Using workspace-local .spec-workflow.');
  } else if (noWorkspaceInference) {
    console.error('Workspace inference disabled. Using the project path argument.');
  }

  console.error(`workspacePath=${workspacePath}`);
  console.error(`workflowRootPath=${workflowRootPath}`);
}

async function main() {
  try {
    const args = process.argv.slice(2);

    // Check for help flag. Read through the registry like every other boolean,
    // so `--help`/`-h` cannot drift out of the rejection set or the path filter.
    const helpFlags = readBooleanFlags(args);
    if (helpFlags['--help'] || helpFlags['-h']) {
      showHelp();
      process.exit(0);
    }

    // Parse command-line arguments
    const cliArgs = parseArguments(args);
    const workspacePath = cliArgs.workspacePath;
    const workflowRootPath = cliArgs.workflowRootPath;
    const noSharedWorktreeSpecs = cliArgs.noSharedWorktreeSpecs;
    const noWorkspaceInference = cliArgs.noWorkspaceInference;
    const workspaceSource = cliArgs.workspaceSource;

    // Apply configuration from CLI args
    const isDashboardMode = cliArgs.isDashboardMode || false;
    const port = cliArgs.port;
    const host = cliArgs.host;
    const lang = cliArgs.lang;

    if (cliArgs.isWatchMode) {
      const { runWatch } = await import('./watch/index.js');
      const { PathUtils } = await import('./core/path-utils.js');
      const root = workflowRootPath.endsWith('.spec-workflow') ? workflowRootPath : PathUtils.getWorkflowRoot(workflowRootPath);
      await runWatch({ workflowRoot: root, specName: cliArgs.specName, once: cliArgs.watchOnce });
      return;
    }

    const isSmokeMode = cliArgs.isSmokeMode || false;

    if (isDashboardMode) {
      // --smoke is a scratch boot the staged self-update runs to prove a new
      // build serves its health route before it swaps dist/ in (design §2).
      // Isolate the global session dir to a throwaway so the boot never finds,
      // overwrites or deletes the live dashboard's session, and arm a hard
      // 30-second timeout so a hang (e.g. the npm version fetch) still exits 1.
      if (isSmokeMode) {
        const smokeHome = await mkdtemp(join(tmpdir(), 'sdd-smoke-home-'));
        process.env.SPEC_WORKFLOW_HOME = smokeHome;
        setTimeout(() => {
          console.error('Smoke check timed out after 30 seconds');
          process.exit(1);
        }, 30000);
      }

      // Dashboard mode skips inference (requirement 1.14) and never validates a
      // workspace, so the resolution is already settled here.
      logWorkspaceResolution({
        workspacePath,
        workflowRootPath,
        source: workspaceSource,
        noSharedWorktreeSpecs,
        noWorkspaceInference
      });

      // Check if a dashboard is already running (always check, regardless of port)
      const sessionManager = new DashboardSessionManager();
      const existingSession = await sessionManager.getDashboardSession();

      if (existingSession) {
        console.error(`Dashboard is already running at: ${existingSession.url}`);
        console.error('');
        console.error('You can:');
        console.error(`  1. Use the existing dashboard at: ${existingSession.url}`);
        console.error(`  2. Stop it first (Ctrl+C or kill ${existingSession.pid}), then start a new one`);
        console.error('');
        console.error('Note: Only one dashboard instance is needed for all your projects.');
        process.exit(1);
      }

      // Use specified port or default
      const dashboardPort = port || DEFAULT_DASHBOARD_PORT;

      // Dashboard only mode - use new multi-project dashboard
      console.error(`Starting Unified Multi-Project Dashboard`);
      if (port) {
        console.error(`Using custom port: ${port}`);
      } else {
        console.error(`Using default port: ${DEFAULT_DASHBOARD_PORT}`);
      }

      // Load configuration from environment variables
      let bindAddress: string | undefined;
      let allowExternalAccess: boolean | undefined;
      const securityConfig: any = {};
      
      // Network binding configuration
      if (process.env.SPEC_WORKFLOW_BIND_ADDRESS) {
        bindAddress = process.env.SPEC_WORKFLOW_BIND_ADDRESS;
      }

      // An explicit --host wins over the environment. A non-localhost address is
      // itself the opt-in to LAN access (design §17: exposure is opt-in); the
      // environment guardrail still fires for a bind address set without intent.
      if (host) {
        bindAddress = host;
        if (!isLocalhostAddress(host)) {
          allowExternalAccess = true;
        }
      }

      // External access opt-in (only override if explicitly set to true or false)
      if (process.env.SPEC_WORKFLOW_ALLOW_EXTERNAL_ACCESS !== undefined) {
        const allowExternal = process.env.SPEC_WORKFLOW_ALLOW_EXTERNAL_ACCESS.toLowerCase();
        if (allowExternal === 'true') {
          allowExternalAccess = true;
        } else if (allowExternal === 'false') {
          allowExternalAccess = false;
        }
        // If invalid value, ignore and use default
      }
      
      // Security features configuration
      
      // Rate limiting toggle (only override if explicitly set to true or false)
      if (process.env.SPEC_WORKFLOW_RATE_LIMIT_ENABLED !== undefined) {
        const rateLimitEnabled = process.env.SPEC_WORKFLOW_RATE_LIMIT_ENABLED.toLowerCase();
        if (rateLimitEnabled === 'true') {
          securityConfig.rateLimitEnabled = true;
        } else if (rateLimitEnabled === 'false') {
          securityConfig.rateLimitEnabled = false;
        }
        // If invalid value, ignore and use default
      }
      
      // CORS toggle (only override if explicitly set to true or false)
      if (process.env.SPEC_WORKFLOW_CORS_ENABLED !== undefined) {
        const corsEnabled = process.env.SPEC_WORKFLOW_CORS_ENABLED.toLowerCase();
        if (corsEnabled === 'true') {
          securityConfig.corsEnabled = true;
        } else if (corsEnabled === 'false') {
          securityConfig.corsEnabled = false;
        }
        // If invalid value, ignore and use default
      }

      // Create dashboard server (network binding validation happens in constructor)
      let dashboardServer: MultiProjectDashboardServer;
      try {
        dashboardServer = new MultiProjectDashboardServer({
          port: dashboardPort,
          bindAddress,
          allowExternalAccess,
          security: securityConfig
        });
      } catch (error: any) {
        // Provide user-friendly error message with environment variable names
        if (error.message.includes('SECURITY ERROR') || error.message.includes('non-localhost')) {
          console.error('');
          console.error('❌ Security Configuration Error:');
          console.error(error.message);
          console.error('');
          console.error('To fix this, either:');
          console.error('  1. Use localhost binding (secure):');
          console.error('     export SPEC_WORKFLOW_BIND_ADDRESS=127.0.0.1');
          console.error('');
          console.error('  2. Explicitly allow external access (insecure):');
          console.error('     export SPEC_WORKFLOW_ALLOW_EXTERNAL_ACCESS=true');
          console.error('');
          process.exit(1);
        }
        throw error; // Re-throw other errors
      }

      try {
        const dashboardUrl = await dashboardServer.start();
        console.error(`Dashboard started at: ${dashboardUrl}`);

        if (isSmokeMode) {
          // Prove the health route answers, print it, and exit. Any failure
          // (unreachable, non-200, or `ok !== true`) exits 1.
          try {
            const response = await fetch(`${dashboardUrl}/api/health`);
            const body = await response.json() as { ok?: boolean };
            if (!response.ok || body.ok !== true) {
              console.error(`Smoke check failed: /api/health returned ${response.status}`);
              process.exit(1);
            }
            console.log(JSON.stringify(body));
            try { await dashboardServer.stop(); } catch { /* best effort */ }
            process.exit(0);
          } catch (error: any) {
            console.error(`Smoke check failed: ${error?.message ?? error}`);
            process.exit(1);
          }
        }

        console.error('Projects will automatically appear as MCP servers register.');
        console.error('Press Ctrl+C to stop the dashboard');
      } catch (error: any) {
        console.error(`Failed to start dashboard: ${error.message}`);
        process.exit(1);
      }

      // Handle graceful shutdown
      const shutdown = async () => {
        console.error('\nShutting down dashboard...');
        await dashboardServer.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

    } else {
      // MCP server mode
      //
      // Pathless on purpose. This is the banner, not the resolution: it prints
      // before `initialize`, and `workflowRootPath` here is still provisional —
      // under `--no-shared-worktree-specs` it is the inferred workspace, which
      // a rejected inference moves three lines later (requirements 1.8, 2.8).
      // Naming it would put a stale path on stderr that the resolution block
      // then contradicts. That block is the one place the roots are reported
      // (requirement 1.18), and it reports them settled.
      console.error('Starting Spec Workflow MCP Server');
      console.error(`Working directory: ${process.cwd()}`);

      const server = new SpecWorkflowMCPServer();

      // Requirement 1.8: an *inferred* workspace derives from `process.cwd()`,
      // which the user did not choose, so it is validated inside `initialize`
      // where `validateProjectPath` is already awaited. The fallback is the
      // configured path's git toplevel — the same value resolution would have
      // produced with inference off — not the raw configured path.
      const inferredWorkspaceFallback = workspaceSource === 'inference'
        ? resolveGitWorkspaceRoot(cliArgs.expandedPath)
        : undefined;

      // Requirement 1.18: exactly one emission, from a `finally` so it happens
      // on both the returning and the throwing path.
      //
      // Not before `initialize`, because `validateInferredWorkspace` can still
      // reject an inferred path and fall back, and a pre-emission would then be
      // contradicted by a second one — the duplicate this requirement exists to
      // remove. Not only after, either: a throwing `initialize` would then emit
      // nothing, and a failed startup is exactly when the resolved workspace
      // most needs to be visible. The `finally` runs once either way, so the
      // count is one whatever happens.
      //
      // The values printed are the settled roots on both paths: `initialize`
      // assigns them before anything there can throw, so a throwing startup
      // reports what is in force rather than the provisional inference the
      // preceding rejection notice already contradicted. When the fallback
      // fires the workspace is the configured path's toplevel, which is what
      // `argument` means, so the arm reported matches the path printed.
      try {
        await server.initialize(
          workflowRootPath,
          workspacePath,
          lang,
          inferredWorkspaceFallback
        );
      } finally {
        const settledWorkspacePath = server.settledWorkspacePath ?? workspacePath;
        logWorkspaceResolution({
          workspacePath: settledWorkspacePath,
          workflowRootPath: server.settledWorkflowRootPath ?? workflowRootPath,
          source: settledWorkspacePath === workspacePath ? workspaceSource : 'argument',
          noSharedWorktreeSpecs,
          noWorkspaceInference
        });
      }

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        await server.stop();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
      });
    }

  } catch (error: any) {
    console.error('Error:', error.message);

    // Provide additional context for common path-related issues
    if (error.message.includes('ENOENT') || error.message.includes('path') || error.message.includes('directory')) {
      console.error('\nProject path troubleshooting:');
      console.error('- Verify the project path exists and is accessible');
      console.error('- For Claude CLI users, ensure you used: claude mcp add spec-workflow npx -y @madmatt112org/spec-workflow-mcp@latest -- /path/to/your/project');
      console.error('- Check that the path doesn\'t contain special characters that need escaping');
      console.error(`- Current working directory: ${process.cwd()}`);
    }

    process.exit(1);
  }
}

export function resolveEntrypoint(pathValue: string | undefined): string | undefined {
  if (!pathValue) return undefined;

  try {
    return realpathSync(pathValue);
  } catch {
    return resolve(pathValue);
  }
}

const entrypoint = resolveEntrypoint(process.argv[1]);
const currentFile = resolveEntrypoint(fileURLToPath(import.meta.url));

if (entrypoint && currentFile && currentFile === entrypoint) {
  main().catch(() => process.exit(1));
}
