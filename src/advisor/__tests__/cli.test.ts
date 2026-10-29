import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { existsSync, readFileSync, statSync, mkdtempSync, chmodSync, writeFileSync } from 'fs';
import { execFileSync, spawn } from 'child_process';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

import { runAdvisorCommand, openAdvisorSession } from '../cli.js';
import { advisorHomeDir, advisorNotesDir, advisorSessionPath } from '../home.js';
import { readSources } from '../sources.js';
import { ADVISOR_MCP_PATH, secretPath, loadOrCreateAdvisorSecret } from '../../controller/access.js';
import { loadRole } from '../../controller/step.js';
import { processStartTime } from '../../controller/state.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';

// Contract for src/advisor/cli.ts (design.md C10; requirements.md Requirement
// 1.1-1.6, 9.1, 9.2, NFR Security; task 16 _Prompt). Every test runs against a
// fresh temp SDD_HOME and SPEC_WORKFLOW_HOME so the real home is never
// touched. No collaborator inside cli.ts is mocked: `peekDashboardSession`
// (src/core/dashboard-session.ts) reads a real `activeSession.json` fixture
// the same way src/core/__tests__/dashboard-session-peek.test.ts does;
// `loadRole`, `loadOrCreateAdvisorSecret`, `secretPath` and `checkpoint`/
// `withStoreLock` all run for real against these temp dirs; the model process
// is a purpose-built stub (helpers/stub-interactive-claude.mjs, chosen over
// reusing scripts/stub-claude.mjs because that one is built for a headless
// `-p` run read back over stdout, while cli.ts spawns an *interactive*
// session with stdio inherited — unreadable from the parent test — so this
// stub instead reports the argv and cwd it received by writing them to a file
// named by STUB_ARGV_OUT, then stays alive until killed or STUB_ALIVE_MS
// elapses, so the test controls exactly when the "conversation" ends).
//
// Probes recorded (task 16 Restrictions: "Probe claude 2.1.311 ... and record
// each probe in the test"):
//   - mcp.json `headers` key: `claude --mcp-config <file> --strict-mcp-config
//     -p ... ` with a server entry `{ "type": "http", "url": "...", "headers":
//     { "Authorization": "Bearer ...", "x-sdd-conversation": "..." } }` ran to
//     completion with no mcp-config validation error, on claude 2.1.311
//     (`claude --version` => "2.1.311 (Claude Code)"); the binary's own
//     strings confirm `"type": "http"` + `"url"` as the remote-server shape
//     ("...has a \"url\" but no \"type\"; add \"type\": \"http\"...").
//   - Bash/Read deny-rule form: `claude --help`'s own permission-rule example
//     is `["Bash(npm run build)", "Edit(docs/**)", "Read(~/.zshrc)"]`
//     (confirmed in the binary's strings); for denying a *specific file* via
//     Bash, the prefix-rule suffix the binary's own hover text documents is
//     `:*` (as in "Bash(npm *)"/"...fix before :*"). `claude doctor` (which
//     "[r]eads settings files in the current directory without a trust
//     prompt") reported "No installation issues found" for a project
//     `.claude/settings.json` holding
//     `{"permissions":{"deny":["Read(<path>)","Bash(cat <path>:*)"]}}`. This
//     file pins those two exact forms as the probed, confirmed-valid shape;
//     the implementer must match them (`secretPath()` substituted in).
//
// Criterion "no dashboard exits 1" (design C10 "exits 1 without a running
//   dashboard"; design Error Handling #1):
//   Pre-condition: SPEC_WORKFLOW_HOME has no activeSession.json.
//   Test: runAdvisorCommand([]).
//   Observable result: resolves to 1; advisor/session.json is never created.
//   Expected-value source: design C10 / Error Handling #1's literal "exit 1".
//
// Criterion "the spawned argv carries every listed flag" (design C10's flag
//   list; Requirement 1.1, 1.2, NFR Security):
//   Pre-condition: a live dashboard session fixture; CONTROLLER_CLAUDE_BIN
//   pointed at the interactive stub.
//   Test: runAdvisorCommand([]), then read the stub's argv-dump file.
//   Observable result: argv holds (in the design-cited order) `--model
//   claude-opus-5-5 --effort high` (from the real harness/agents/sdd-advisor.md
//   + agent-profiles.json, read independently via loadRole, not hardcoded),
//   `--append-system-prompt-file <advisor/system.md>`, `--mcp-config
//   <advisor/mcp.json> --strict-mcp-config`, `--settings <advisor/settings.json>`,
//   `--session-id <uuid>`, `-n advisor`, the trailing prompt "Give me the
//   hello summary.", and cwd is advisor/.
//   Expected-value source: design C10's flag list; loadRole('sdd-advisor')
//   for model/effort/body; the literal prompt text design C10 quotes.
//
// Criterion "--remote-control is passed through" (Requirement 1.3):
//   Pre-condition: as above.
//   Test: runAdvisorCommand(['--remote-control']).
//   Observable result: argv contains `--remote-control advisor`.
//   Expected-value source: design C10 "`--remote-control advisor` when asked".
//
// Criterion "mcp.json and settings.json are 0600 with the probed forms"
//   (NFR Security):
//   Pre-condition: as above.
//   Test: runAdvisorCommand([]), then read advisor/mcp.json and
//   advisor/settings.json from disk.
//   Observable result: both files are mode 0600; mcp.json has exactly one MCP
//   server entry whose `url` is `<dashboardUrl><ADVISOR_MCP_PATH>` and whose
//   `headers` carry `Authorization: Bearer <the real advisor secret>` (read
//   independently via loadOrCreateAdvisorSecret) and `x-sdd-conversation`
//   equal to the same conversation id recorded in session.json and sent as
//   `--session-id`; settings.json's `permissions.deny` contains the two
//   probed forms naming `secretPath()` (the operator secret file).
//   Expected-value source: design C10's parenthetical; the probes above.
//
// Criterion "session.json exists while the child lives and is gone after"
//   (Requirement 1.5 folds in here — see report):
//   Pre-condition: as above.
//   Test: runAdvisorCommand([]); read session.json once the stub has started;
//   then SIGTERM the recorded pid and await the command's own promise.
//   Observable result: while alive, session.json parses to `{v:1, pid,
//   startTime, name: 'advisor', conversation, remote: false, started}` with
//   `pid` equal to the stub's own pid; after the promise resolves,
//   advisor/session.json no longer exists.
//   Expected-value source: design C10 "writes advisor/session.json after the
//   spawn, deletes it on child exit"; the AdvisorSession shape in design.md
//   Data Models.
//
// Criterion "advisor commit makes one commit" (Requirement 9.1, 9.2):
//   Pre-condition: a scratch git repo (one initial commit) with a file
//   already modified on disk (standing in for a decision the conversation
//   already wrote, per design: the conversation writes the file itself;
//   `advisor commit` only stages and commits it).
//   Test: runAdvisorCommand(['commit', '--store', repoPath, '-m', message,
//   '--', 'NOTE.md']).
//   Observable result: resolves to 0; `git log` in that repo gains exactly
//   one commit whose subject is the given message; advisor/notes/ exists
//   (Requirement 9.1, created on any invocation, not gated on a dashboard).
//   Expected-value source: design C10 "runs checkpoint inside withStoreLock,
//   how the advisor commits decisions"; the literal message this test passes.
//
// Criterion "the open route returns the live session without a second spawn"
//   (Requirement 1.4):
//   Pre-condition: session.json names this test process's own pid/startTime
//   (so `isProcessAlive` reads it as live) with a known `name`.
//   Test: openAdvisorSession({ spawnDetached: () => { throw new
//   Error('must not spawn'); } }).
//   Observable result: resolves to `{ state: 'live', name }` with the
//   session's own name, and spawnDetached is never called (it would have
//   thrown and failed the test otherwise).
//   Expected-value source: Requirement 1.4 "SHALL show that session and
//   SHALL NOT start a second one"; design C10 "a live session.json process
//   ... is returned as is".
//
// Criterion "not live, the relaunched process survives the check -> live"
//   (Requirement 1.3, design D16):
//   Pre-condition: no session.json (or a dead one).
//   Test: openAdvisorSession({ spawnDetached: <spawns a process that outlives
//   checkDelayMs>, checkDelayMs: <a short test override, the same kind of
//   test-fixed knob push.test.ts's retryDelayMs is> }).
//   Observable result: resolves to `{ state: 'live', name: 'advisor' }`.
//   Expected-value source: design C10 "checks liveness once after 10 seconds,
//   returns live"; design D16.
//
// Criterion "not live, the relaunched process exits before the check ->
//   command" (Requirement 1.3, design D7):
//   Pre-condition: as above.
//   Test: openAdvisorSession({ spawnDetached: <spawns a process that exits
//   immediately>, checkDelayMs: <short> }).
//   Observable result: resolves to `{ state: 'command', command:
//   'spec-workflow-mcp advisor --remote-control' }`.
//   Expected-value source: design C10 "returns live or, if it exited,
//   command (requirements D7)"; package.json's bin name
//   ("spec-workflow-mcp": "dist/index.js") plus the `--remote-control` flag
//   design C10 names.

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB_CLAUDE = join(HERE, 'helpers', 'stub-interactive-claude.mjs');

let home: string;
let specHome: string;
let savedSddHome: string | undefined;
let savedSpecWorkflowHome: string | undefined;
let savedClaudeBin: string | undefined;
let savedArgvOut: string | undefined;
let savedAliveMs: string | undefined;
const pidsToKill: number[] = [];

beforeAll(() => {
  chmodSync(STUB_CLAUDE, 0o755);
});

beforeEach(async () => {
  savedSddHome = process.env.SDD_HOME;
  savedSpecWorkflowHome = process.env[SPEC_WORKFLOW_HOME_ENV];
  savedClaudeBin = process.env.CONTROLLER_CLAUDE_BIN;
  savedArgvOut = process.env.STUB_ARGV_OUT;
  savedAliveMs = process.env.STUB_ALIVE_MS;
  home = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-cli-'));
  specHome = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-cli-spec-home-'));
  process.env.SDD_HOME = home;
  process.env[SPEC_WORKFLOW_HOME_ENV] = specHome;
});

afterEach(async () => {
  for (const pid of pidsToKill.splice(0)) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  if (savedSpecWorkflowHome === undefined) delete process.env[SPEC_WORKFLOW_HOME_ENV];
  else process.env[SPEC_WORKFLOW_HOME_ENV] = savedSpecWorkflowHome;
  if (savedClaudeBin === undefined) delete process.env.CONTROLLER_CLAUDE_BIN;
  else process.env.CONTROLLER_CLAUDE_BIN = savedClaudeBin;
  if (savedArgvOut === undefined) delete process.env.STUB_ARGV_OUT;
  else process.env.STUB_ARGV_OUT = savedArgvOut;
  if (savedAliveMs === undefined) delete process.env.STUB_ALIVE_MS;
  else process.env.STUB_ALIVE_MS = savedAliveMs;
  await fs.rm(home, { recursive: true, force: true });
  await fs.rm(specHome, { recursive: true, force: true });
});

function waitFor(predicate: () => boolean, timeoutMs = 5000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error('waitFor: timed out'));
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

/** Writes activeSession.json so peekDashboardSession reads a live dashboard. */
async function writeFakeDashboard(url: string): Promise<void> {
  await fs.mkdir(specHome, { recursive: true });
  await fs.writeFile(
    join(specHome, 'activeSession.json'),
    JSON.stringify({ url, port: 4999, pid: process.pid, startedAt: new Date().toISOString() }),
    'utf-8',
  );
}

/** Starts a conversation-entry run against the interactive stub, waiting for its argv dump. */
async function startEntry(args: string[]): Promise<{
  promise: Promise<number>;
  argvData: { argv: string[]; cwd: string };
  pid: number;
}> {
  process.env.CONTROLLER_CLAUDE_BIN = STUB_CLAUDE;
  const argvOut = join(home, `argv-${Math.random().toString(36).slice(2)}.json`);
  process.env.STUB_ARGV_OUT = argvOut;
  process.env.STUB_ALIVE_MS = '1500';

  const promise = runAdvisorCommand(args);
  await waitFor(() => existsSync(argvOut));
  const argvData = JSON.parse(readFileSync(argvOut, 'utf-8')) as { argv: string[]; cwd: string };

  await waitFor(() => existsSync(advisorSessionPath()));
  const session = JSON.parse(readFileSync(advisorSessionPath(), 'utf-8')) as { pid: number };
  pidsToKill.push(session.pid);

  return { promise, argvData, pid: session.pid };
}

function flagValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('runAdvisorCommand', () => {
  it('exits 1 without a running dashboard', async () => {
    const code = await runAdvisorCommand([]);
    expect(code).toBe(1);
    expect(existsSync(advisorSessionPath())).toBe(false);
  });

  it('spawns claude with every flag design C10 lists', async () => {
    await writeFakeDashboard('http://127.0.0.1:4999/p/proj');
    const { promise, argvData, pid } = await startEntry([]);

    const role = loadRole('sdd-advisor');
    expect(flagValue(argvData.argv, '--model')).toBe(role.model);
    expect(flagValue(argvData.argv, '--effort')).toBe(role.effort);
    expect(flagValue(argvData.argv, '-n')).toBe('advisor');
    expect(argvData.argv).toContain('--strict-mcp-config');
    expect(argvData.cwd).toBe(advisorHomeDir());
    expect(argvData.argv[argvData.argv.length - 1]).toBe('Give me the hello summary.');

    const systemPromptFile = flagValue(argvData.argv, '--append-system-prompt-file');
    expect(systemPromptFile).toBeTruthy();
    expect(readFileSync(systemPromptFile as string, 'utf-8')).toBe(role.body);

    const mcpConfigFile = flagValue(argvData.argv, '--mcp-config');
    expect(mcpConfigFile).toBe(join(advisorHomeDir(), 'mcp.json'));

    const settingsFile = flagValue(argvData.argv, '--settings');
    expect(settingsFile).toBe(join(advisorHomeDir(), 'settings.json'));

    const sessionId = flagValue(argvData.argv, '--session-id');
    expect(sessionId).toMatch(UUID_RE);

    expect(argvData.argv).not.toContain('--remote-control');

    process.kill(pid, 'SIGTERM');
    await promise;
  });

  it('passes --remote-control advisor when invoked with --remote-control', async () => {
    await writeFakeDashboard('http://127.0.0.1:4999/p/proj');
    const { promise, argvData, pid } = await startEntry(['--remote-control']);

    const i = argvData.argv.indexOf('--remote-control');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(argvData.argv[i + 1]).toBe('advisor');

    process.kill(pid, 'SIGTERM');
    await promise;
  });

  it('writes mcp.json and settings.json 0600 with the probed forms', async () => {
    const dashboardUrl = 'http://127.0.0.1:4999/p/proj';
    await writeFakeDashboard(dashboardUrl);
    const { promise, argvData, pid } = await startEntry([]);

    const mcpConfigFile = flagValue(argvData.argv, '--mcp-config') as string;
    const settingsFile = flagValue(argvData.argv, '--settings') as string;

    expect(statSync(mcpConfigFile).mode & 0o777).toBe(0o600);
    expect(statSync(settingsFile).mode & 0o777).toBe(0o600);

    const mcpConfig = JSON.parse(readFileSync(mcpConfigFile, 'utf-8'));
    const servers = Object.values(mcpConfig.mcpServers ?? {}) as Array<{
      type: string;
      url: string;
      headers: Record<string, string>;
    }>;
    expect(servers).toHaveLength(1);
    const server = servers[0];
    expect(server.type).toBe('http');
    expect(server.url).toBe(`${dashboardUrl}${ADVISOR_MCP_PATH}`);

    const advisorSecret = await loadOrCreateAdvisorSecret();
    expect(server.headers.Authorization).toBe(`Bearer ${advisorSecret}`);
    const sessionIdFlag = flagValue(argvData.argv, '--session-id');
    expect(server.headers['x-sdd-conversation']).toBe(sessionIdFlag);

    const settings = JSON.parse(readFileSync(settingsFile, 'utf-8'));
    const deny: string[] = settings.permissions?.deny ?? [];
    expect(deny).toContain(`Read(${secretPath()})`);
    expect(deny).toContain(`Bash(cat ${secretPath()}:*)`);

    process.kill(pid, 'SIGTERM');
    await promise;
  });

  it('session.json exists while the child lives and is gone after it exits', async () => {
    await writeFakeDashboard('http://127.0.0.1:4999/p/proj');
    const { promise, argvData, pid } = await startEntry([]);

    const sessionRaw = readFileSync(advisorSessionPath(), 'utf-8');
    const session = JSON.parse(sessionRaw) as {
      v: number;
      pid: number;
      startTime: number;
      name: string;
      conversation: string;
      remote: boolean;
      started: string;
    };
    expect(session.v).toBe(1);
    expect(session.pid).toBe(pid);
    expect(session.name).toBe('advisor');
    expect(session.remote).toBe(false);
    expect(session.conversation).toBe(flagValue(argvData.argv, '--session-id'));
    expect(typeof session.startTime).toBe('number');
    expect(typeof session.started).toBe('string');

    process.kill(pid, 'SIGTERM');
    await promise;

    expect(existsSync(advisorSessionPath())).toBe(false);
  });

  it('creates advisor/ and advisor/notes/ and seeds sources on any invocation', async () => {
    await writeFakeDashboard('http://127.0.0.1:4999/p/proj');
    const { promise, pid } = await startEntry([]);

    expect(existsSync(advisorHomeDir())).toBe(true);
    expect(existsSync(advisorNotesDir())).toBe(true);
    const sources = await readSources();
    expect(sources.map((s) => s.name).sort()).toEqual(['JobSync', 'matthew-field.ca']);

    process.kill(pid, 'SIGTERM');
    await promise;
  });

  it('advisor commit makes one commit', async () => {
    const repoPath = mkdtempSync(join(tmpdir(), 'sdd-advisor-cli-repo-'));
    execFileSync('git', ['init', '-q'], { cwd: repoPath });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repoPath });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: repoPath });
    writeFileSync(join(repoPath, 'NOTE.md'), 'initial\n');
    execFileSync('git', ['add', '-A'], { cwd: repoPath });
    execFileSync('git', ['commit', '-q', '-m', 'initial'], { cwd: repoPath });

    writeFileSync(join(repoPath, 'NOTE.md'), 'decision: use approach B\n');

    const before = execFileSync('git', ['log', '--oneline'], { cwd: repoPath, encoding: 'utf-8' })
      .trim().split('\n').length;

    const code = await runAdvisorCommand(['commit', '--store', repoPath, '-m', 'decision: use approach B', '--', 'NOTE.md']);
    expect(code).toBe(0);

    const after = execFileSync('git', ['log', '--oneline'], { cwd: repoPath, encoding: 'utf-8' })
      .trim().split('\n').length;
    expect(after).toBe(before + 1);

    const subject = execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: repoPath, encoding: 'utf-8' }).trim();
    expect(subject).toBe('decision: use approach B');
  });
});

describe('openAdvisorSession', () => {
  it('returns the live session as is and never spawns a second one', async () => {
    await fs.mkdir(advisorHomeDir(), { recursive: true });
    // isProcessAlive compares /proc/<pid>/stat field 22; use this test
    // process's own real pid/start time so the fixture reads as genuinely
    // live (the same technique src/core/__tests__/dashboard-session-peek.test.ts
    // uses with process.pid for its "live-pid session file" case).
    await fs.writeFile(
      advisorSessionPath(),
      JSON.stringify({
        v: 1,
        pid: process.pid,
        startTime: processStartTime(process.pid),
        name: 'advisor',
        conversation: 'existing-conversation',
        remote: true,
        started: new Date().toISOString(),
      }),
      'utf-8',
    );

    const result = await openAdvisorSession({
      spawnDetached: () => {
        throw new Error('must not spawn a second advisor session');
      },
    });

    expect(result).toEqual({ state: 'live', name: 'advisor' });
  });

  it('returns command, without throwing, when the spawn itself fails (ENOENT)', async () => {
    const result = await openAdvisorSession({
      spawnDetached: () => spawn('spec-workflow-mcp-does-not-exist', [], { stdio: 'ignore' }),
      checkDelayMs: 150,
    });

    expect(result.state).toBe('command');
  });

  it('spawns detached and returns live when the process survives the check', async () => {
    const survivor = spawn(
      process.execPath,
      ['-e', 'setTimeout(() => {}, 60000)'],
      { stdio: 'ignore' },
    );
    pidsToKill.push(survivor.pid as number);

    const result = await openAdvisorSession({
      spawnDetached: () => survivor,
      checkDelayMs: 150,
    });

    expect(result).toEqual({ state: 'live', name: 'advisor' });
  });

  it('spawns detached and returns the command when the process exits before the check', async () => {
    const dying = spawn(
      process.execPath,
      ['-e', 'process.exit(0)'],
      { stdio: 'ignore' },
    );

    const result = await openAdvisorSession({
      spawnDetached: () => dying,
      checkDelayMs: 150,
    });

    expect(result).toEqual({ state: 'command', command: 'spec-workflow-mcp advisor --remote-control' });
  });
});
