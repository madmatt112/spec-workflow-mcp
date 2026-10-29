// src/advisor/cli.ts
//
// Conversation entry and decision commits (design.md C10; requirements.md
// Requirement 1.1-1.6, 9.1, 9.2, NFR Security). `runAdvisorCommand` is the
// `advisor` subcommand's body: with no running dashboard it exits 1; else it
// creates `advisor/` and `advisor/notes/`, seeds the sources file, makes a
// conversation UUID, writes mode-0600 `mcp.json` and `settings.json`, writes
// the role body to `system.md`, and spawns an interactive `claude` session in
// `advisor/` with stdio inherited. `advisor commit` runs `checkpoint` inside
// `withStoreLock`, the mechanism Requirement 9 AC 2 names for a decision
// commit. `openAdvisorSession` backs `POST /api/controller/advisor/open`
// (src/dashboard/multi-server.ts): a live `session.json` process is returned
// as is; otherwise it spawns a detached conversation and checks once after
// `checkDelayMs` (design D16).
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { spawn, type ChildProcess } from 'child_process';
import { dirname, join } from 'path';
import { DashboardSessionManager } from '../core/dashboard-session.js';
import { advisorHomeDir, advisorNotesDir, advisorSessionPath } from './home.js';
import { seedSources } from './sources.js';
import { ADVISOR_MCP_PATH, secretPath, loadOrCreateAdvisorSecret } from '../controller/access.js';
import { loadRole } from '../controller/step.js';
import { isProcessAlive, processStartTime, writeJsonAtomic } from '../controller/state.js';
import { withStoreLock } from '../controller/state.js';
import { checkpoint } from '../controller/ledger.js';

const DEFAULT_OPEN_CHECK_DELAY_MS = 10000;
const OPEN_COMMAND = 'spec-workflow-mcp advisor --remote-control';

interface AdvisorSession {
  v: 1;
  pid: number;
  startTime: number;
  name: string;
  conversation: string;
  remote: boolean;
  started: string;
}

/** The binary name, overridable so tests swap in the interactive stub. */
function claudeBin(): string {
  return process.env.CONTROLLER_CLAUDE_BIN || 'claude';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Write JSON mode 0600, defeating a lenient umask (the pattern of `access.ts`). */
async function writeSecureJson(path: string, data: unknown): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.writeFile(path, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  await fs.chmod(path, 0o600);
}

/** Parse `advisor commit --store <path> -m <message> -- <paths...>`. */
function parseCommitArgs(
  rest: string[],
): { store: string; message: string; paths: string[] } | { error: string } {
  let store: string | undefined;
  let message: string | undefined;
  let paths: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === '--store') {
      store = rest[++i];
    } else if (token === '-m' || token === '--message') {
      message = rest[++i];
    } else if (token === '--') {
      paths = rest.slice(i + 1);
      break;
    }
  }

  if (!store) return { error: 'advisor commit needs --store <path>' };
  if (!message) return { error: 'advisor commit needs -m <message>' };
  return { store, message, paths };
}

async function runAdvisorCommitCommand(rest: string[]): Promise<number> {
  await fs.mkdir(advisorNotesDir(), { recursive: true });

  const parsed = parseCommitArgs(rest);
  if ('error' in parsed) {
    console.error(parsed.error);
    return 1;
  }

  try {
    await withStoreLock(parsed.store, () =>
      checkpoint({ specStoreRoot: parsed.store, message: parsed.message, paths: parsed.paths }),
    );
    return 0;
  } catch (error: any) {
    console.error(`error: ${error?.message ?? error}`);
    return 1;
  }
}

/**
 * The `advisor` subcommand: `advisor commit ...` (Requirement 9 AC 2), else
 * conversation entry (design C10). Resolves with the process exit code.
 */
export async function runAdvisorCommand(args: string[]): Promise<number> {
  if (args[0] === 'commit') {
    return runAdvisorCommitCommand(args.slice(1));
  }

  const remote = args.includes('--remote-control');

  const session = await new DashboardSessionManager().peekDashboardSession();
  if (!session) {
    console.error('No dashboard is running. Start one with: spec-workflow-mcp --dashboard');
    return 1;
  }

  await fs.mkdir(advisorNotesDir(), { recursive: true });
  await seedSources();

  const conversation = randomUUID();
  const role = loadRole('sdd-advisor');
  const advisorSecret = await loadOrCreateAdvisorSecret();

  const mcpConfigPath = join(advisorHomeDir(), 'mcp.json');
  await writeSecureJson(mcpConfigPath, {
    mcpServers: {
      advisor: {
        type: 'http',
        url: `${session.url}${ADVISOR_MCP_PATH}`,
        headers: {
          Authorization: `Bearer ${advisorSecret}`,
          'x-sdd-conversation': conversation,
        },
      },
    },
  });

  const settingsPath = join(advisorHomeDir(), 'settings.json');
  await writeSecureJson(settingsPath, {
    permissions: {
      deny: [`Read(${secretPath()})`, `Bash(cat ${secretPath()}:*)`],
    },
  });

  const systemPromptFile = join(advisorHomeDir(), 'system.md');
  await fs.writeFile(systemPromptFile, role.body, 'utf-8');

  const argv: string[] = [
    '--model', role.model,
    '--effort', role.effort,
    '--append-system-prompt-file', systemPromptFile,
    '--mcp-config', mcpConfigPath,
    '--strict-mcp-config',
    '--settings', settingsPath,
    '--session-id', conversation,
    '-n', 'advisor',
  ];
  if (remote) argv.push('--remote-control', 'advisor');
  argv.push('Give me the hello summary.');

  const child = spawn(claudeBin(), argv, {
    cwd: advisorHomeDir(),
    stdio: 'inherit',
  });

  const pid = child.pid as number;
  const advisorSession: AdvisorSession = {
    v: 1,
    pid,
    startTime: processStartTime(pid) ?? 0,
    name: 'advisor',
    conversation,
    remote,
    started: new Date().toISOString(),
  };
  await writeJsonAtomic(advisorSessionPath(), advisorSession);

  return new Promise<number>((resolve) => {
    child.on('exit', (code) => {
      fs.rm(advisorSessionPath(), { force: true }).finally(() => resolve(code ?? 0));
    });
  });
}

/** What `openAdvisorSession` needs, injected for the tests (the shape of `SecondOpinionDeps`/`WaitPusherOptions.retryDelayMs`). */
export interface OpenAdvisorDeps {
  spawnDetached: () => ChildProcess;
  checkDelayMs?: number;
}

export type OpenAdvisorResult = { state: 'live'; name: string } | { state: 'command'; command: string };

async function readAdvisorSession(): Promise<AdvisorSession | null> {
  try {
    return JSON.parse(await fs.readFile(advisorSessionPath(), 'utf-8')) as AdvisorSession;
  } catch {
    return null;
  }
}

/**
 * `POST /api/controller/advisor/open`'s logic (design C10, D16; Requirement 1
 * AC 3, AC 4): a live session is returned as is, with no second spawn. Else a
 * detached conversation is spawned and checked once after `checkDelayMs`
 * (default ten seconds); still running is `live`, already exited is `command`.
 */
export async function openAdvisorSession(deps: OpenAdvisorDeps): Promise<OpenAdvisorResult> {
  const existing = await readAdvisorSession();
  if (existing && isProcessAlive(existing.pid, existing.startTime)) {
    return { state: 'live', name: existing.name };
  }

  const child = deps.spawnDetached();
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  // A spawn that fails (ENOENT: the command is not on PATH) emits 'error', not
  // 'exit'; unhandled, that event kills the dashboard process.
  child.once('error', () => {
    exited = true;
  });

  await sleep(deps.checkDelayMs ?? DEFAULT_OPEN_CHECK_DELAY_MS);

  if (!exited) {
    return { state: 'live', name: 'advisor' };
  }
  return { state: 'command', command: OPEN_COMMAND };
}
