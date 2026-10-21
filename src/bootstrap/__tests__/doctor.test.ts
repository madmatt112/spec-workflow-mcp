// Contract for src/bootstrap/doctor.ts (design C4; Req 7 AC 1-6). Three
// exports under test: runChecks(top, timeoutMs), runDoctor(repoPath, io,
// timeoutMs) and serviceEnv(). No collaborator inside the module is mocked: a
// real temporary git repository stands in for the repository, a real plain-http
// server for the controller, a real `projects.json` under a per-test SDD_HOME
// for the registry, and `scripts/stub-gh.mjs` (via CONTROLLER_GH_BIN) for `gh`.
//
// Clause 1 ("each check passes, fails with its fix and skips per its
// dependency", Req 7 AC 1-2, design C4 checks 1-6, D6):
// 1. A fully valid repository: all seven checks read `ok`, in Req 7 AC 1 order;
//    runDoctor on the same repository exits 0 (folds clause 2's "else 0" branch
//    here, same scenario).
//    Pre:  valid .mcp.json, store with agent-rules.md, a live controller, a
//          matching projects.json entry, a github.com origin, gh answering
//          permissions.push true.
//    Call: await runChecks(top, 5000); await runDoctor(repoPath, io, 5000)
//    Want: runChecks names in order ['mcp','store','agent-rules','controller',
//          'registered','remote','token'], every status 'ok'; runDoctor returns 0.
//    Src:  design.md C4 checks list order and "**Output**"; Req 7 AC 1, 3.
// 2. `mcp` fails -> `store`, `agent-rules`, `registered` all `skip`;
//    `controller`, `remote`, `token` are unaffected.
//    Pre:  malformed `.mcp.json`; otherwise the valid fixture of test 1.
//    Call: await runChecks(top, 2000)
//    Want: mcp = { status: 'fail', fix: `run init ${top}` }; store, agent-rules,
//          registered = 'skip'; controller, remote, token = 'ok'.
//    Src:  design.md C4 check 1 Fix; Req 7 AC 2 ("store and agent-rules depend
//          on mcp ... registered depends on store").
// 3. `store` fails (no `.spec-workflow` directory) -> `agent-rules` and
//    `registered` `skip`; `mcp` still `ok`.
//    Pre:  valid `.mcp.json`; no `.spec-workflow` directory under the store root.
//    Call: await runChecks(top, 500)
//    Want: mcp = 'ok'; store = { status: 'fail', fix: <non-empty string> };
//          agent-rules = 'skip'; registered = 'skip'.
//    Src:  design.md C4 check 2; Req 7 AC 2 ("agent-rules depends on store ...
//          registered depends on store").
// 4. `agent-rules` fails (file missing) with no cascade, `store` still `ok`.
//    Pre:  `.spec-workflow` exists; no `agent-rules.md` inside it.
//    Call: await runChecks(top, 500)
//    Want: store = 'ok'; agent-rules = { status: 'fail', fix: <non-empty string> }.
//    Src:  design.md C4 check 3; Req 7 AC 2 (nothing depends on agent-rules).
// 5. `controller` fails independently of `registered`.
//    Pre:  every other check's input valid; no controller listening on the
//          configured port.
//    Call: await runChecks(top, 500)
//    Want: controller = { status: 'fail', fix: 'start the controller with
//          scripts/sdd-service.sh install' }; registered = 'ok' (not skipped).
//    Src:  design.md C4 check 4 Fix; Req 7 AC 2 (registered depends only on store).
// 6. `registered` fails (no matching `projects.json` entry), `store` still `ok`.
//    Pre:  valid store; `projects.json` has no entry for this workspace/store.
//    Call: await runChecks(top, 2000)
//    Want: store = 'ok'; registered = { status: 'fail', fix: `run init ${top}` }.
//    Src:  design.md C4 check 5 Fix.
// 7. `remote` fails (no `origin` remote) -> `token` `skip`.
//    Pre:  a git repository with no `origin` remote.
//    Call: await runChecks(top, 500)
//    Want: remote = { status: 'fail', fix: 'add a github.com origin remote' };
//          token = 'skip'.
//    Src:  design.md C4 check 6 Fix; Req 7 AC 2 ("token depends on remote").
//
// Clause 2, exit-1 branch ("the last line names the first failure and the
// exit is 1"):
// 8. A failing repository -> runDoctor exits 1 and its last output line names
//    the first failure and its fix.
//    Pre:  malformed `.mcp.json`; otherwise valid.
//    Call: await runDoctor(repoPath, io, 2000)
//    Want: return value 1; io.outLines.at(-1) === `first failure: mcp — run init ${top}`.
//    Src:  design.md C4 "**Output**" ("the last line is `first failure: <name>
//          — <fix>`"); Req 7 AC 3.
//
// Clause 3 ("the stub's argv sidecar shows api and the owner/repo path"):
// 9. A passing token check's `gh` invocation carries exactly `['api',
//    'repos/acme/widget']`.
//    Pre:  origin `https://github.com/acme/widget.git`; gh stub answering
//          permissions.push true.
//    Call: await runChecks(top, 2000)
//    Want: the stub's `.argv` sidecar's one recorded line equals
//          `['api', 'repos/acme/widget']`.
//    Src:  design.md C4 check 7 `execFile(ghBin(), ['api', 'repos/<owner>/<repo>'], ...)`.
//
// Clause 4 ("a push false, a non-JSON stdout, a non-zero exit and a missing
// binary each fail token with a distinct reason"):
// 10. `permissions.push: false` -> reason 'no push permission'.
// 11. Non-JSON stdout -> reason 'unreadable gh output'.
// 12. Non-zero exit code -> reason 'gh exited 1'.
// 13. Missing `gh` binary -> reason 'gh exited ENOENT'.
//    Pre (each): a valid repository through `remote`; CONTROLLER_GH_BIN set to
//        the stub (10-12) or a nonexistent path (13); the stub script (10-12)
//        answering accordingly.
//    Call: await runChecks(top, 2000)
//    Want: token = { status: 'fail', reason: <the string above>, fix: 're-run
//          scripts/sdd-service.sh install with GH_TOKEN set, or gh auth login' }.
//    Src:  design.md C4 check 7 "From node-20 fields: ... gives `gh timed out`;
//          else `gh exited <error.code>` ...; exit 0 with non-JSON stdout gives
//          `unreadable gh output`; JSON without `permissions.push === true`
//          gives `no push permission`"; Req 7 AC 4-5.
//
// Clause 5 (`serviceEnv()`):
// 14. A `service.env` key replaces the same-named process key.
//     Pre:  process.env.SDD_DOCTOR_TEST_KEY = 'from-process'; `service.env`
//           holds `SDD_DOCTOR_TEST_KEY=from-file`.
//     Call: serviceEnv()
//     Want: result.SDD_DOCTOR_TEST_KEY === 'from-file'.
//     Src:  design.md C4 `serviceEnv` "process.env overlaid with service.env".
// 15. A process key absent from `service.env` is kept.
//     Pre:  process.env.SDD_DOCTOR_KEEP_KEY = 'keep-me'; `service.env` holds an
//           unrelated key only.
//     Call: serviceEnv()
//     Want: result.SDD_DOCTOR_KEEP_KEY === 'keep-me'.
//     Src:  design.md C4 `serviceEnv` comment; brief Success clause "keeps
//           other keys".
// 16. No `service.env` file -> the process env is returned unchanged.
//     Pre:  controller home has no `service.env`; process.env.SDD_DOCTOR_NOFILE_KEY = 'plain'.
//     Call: serviceEnv()
//     Want: result.SDD_DOCTOR_NOFILE_KEY === 'plain'.
//     Src:  brief Success clause "returns the process env with no file".
//
// Clause 6 ("https, git@ and ssh origins parse"):
// 17-19. Each origin form resolves to the same `owner/repo`, proven by the gh
//    stub's `argvIncludes` rejecting any other value (an exit code 3 would make
//    `token` fail if parsing were wrong).
//    Pre:  origin set to, respectively, `https://github.com/acme/widget.git`,
//          `git@github.com:acme/widget.git`, `ssh://git@github.com/acme/widget.git`.
//    Call: await runChecks(top, 2000)
//    Want: remote = 'ok'; token = 'ok' (the stub's argvIncludes: ['api',
//          'repos/acme/widget'] passed).
//    Src:  design.md C4 check 6 "This covers https, `git@` and `ssh://`."
//
// Clause 7 ("mtimes and listings ... are unchanged ... with a dead-pid session
// file present"):
// 20. runDoctor creates, writes, renames and deletes nothing anywhere under the
//     repository, the store, SDD_HOME or SPEC_WORKFLOW_HOME, including a
//     dead-pid `activeSession.json`.
//     Pre:  a repository with no controller reachable (so a fail path runs
//           too); a dead-pid `activeSession.json` under SPEC_WORKFLOW_HOME.
//     Call: await runDoctor(repoPath, io, 300)
//     Want: the mtimeMs and the sorted directory listing of the repository top,
//           the store root, SDD_HOME and SPEC_WORKFLOW_HOME are identical before
//           and after the call.
//     Src:  design.md C4 "**Post-conditions**: ... creates, writes, renames or
//           deletes no file or directory"; Req 7 AC 6.
//
// Clause 8 ("a 200 ms timeout against a silent server fails within 1 second"):
// 21. A 200 ms timeout against a silent controller fails fast.
//     Pre:  a server that accepts the connection and never responds; mcp fails
//           immediately (no .mcp.json) and remote has no origin, so no other
//           check waits on the network.
//     Call: const started = Date.now(); await runChecks(top, 200); const elapsed = Date.now() - started
//     Want: controller = 'fail'; elapsed < 1000.
//     Src:  brief Success clause "a 200 ms timeout against a silent server
//           fails within 1 second"; design.md C4 `timeoutMs` default/Performance NFR.

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { promises as fs, chmodSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { createServer, type Server } from 'http';
import { execFileSync, spawnSync } from 'child_process';
import net from 'net';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { runChecks, runDoctor, serviceEnv } from '../doctor.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-gh.mjs');

beforeAll(() => {
  chmodSync(STUB, 0o755);
});

const originalEnv = { ...process.env };
const servers: Array<{ close(): Promise<void> }> = [];
let base: string;
let sddHome: string;
let specWorkflowHome: string;

beforeEach(async () => {
  base = join(tmpdir(), `bootstrap-doctor-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  await fs.mkdir(base, { recursive: true });
  sddHome = join(base, 'sdd-home');
  specWorkflowHome = join(base, 'spec-workflow-home');
  await fs.mkdir(sddHome, { recursive: true });
  await fs.mkdir(specWorkflowHome, { recursive: true });
  process.env.SDD_HOME = sddHome;
  process.env[SPEC_WORKFLOW_HOME_ENV] = specWorkflowHome;
  delete process.env.SDD_PORT;
  delete process.env.CONTROLLER_GH_BIN;
  delete process.env.STUB_GH_SCRIPT;
});

afterEach(async () => {
  await Promise.all(servers.map((s) => s.close().catch(() => {})));
  servers.length = 0;
  process.env = { ...originalEnv };
  await fs.rm(base, { recursive: true, force: true });
});

function makeIo(): { out(line: string): void; err(line: string): void; outLines: string[]; errLines: string[] } {
  const outLines: string[] = [];
  const errLines: string[] = [];
  return { outLines, errLines, out: (l) => outLines.push(l), err: (l) => errLines.push(l) };
}

async function getFreePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      if (!a || typeof a === 'string') { s.close(); reject(new Error('no port')); return; }
      const port = a.port;
      s.close(() => resolvePort(port));
    });
    s.on('error', reject);
  });
}

async function startHealthServer(ok = true): Promise<{ port: number; close(): Promise<void> }> {
  const port = await getFreePort();
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok }));
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { port, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

async function startSilentServer(): Promise<{ port: number; close(): Promise<void> }> {
  const port = await getFreePort();
  const server: Server = createServer(() => {
    // Accept the connection, never respond: the client hangs until it times out.
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { port, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

async function makeRepo(name: string): Promise<string> {
  const repo = join(base, name);
  await fs.mkdir(repo, { recursive: true });
  execFileSync('git', ['-C', repo, 'init', '-q']);
  return (await fs.realpath(repo));
}

async function makeEntryPath(): Promise<string> {
  const entryDir = join(base, 'fake-checkout', 'dist');
  await fs.mkdir(entryDir, { recursive: true });
  const entryPath = join(entryDir, 'index.js');
  await fs.writeFile(entryPath, '// fake entry\n', 'utf-8');
  return entryPath;
}

async function writeMcpJson(top: string, entryPath: string, env: Record<string, string> = {}): Promise<void> {
  const content = {
    mcpServers: { 'spec-workflow': { type: 'stdio', command: 'node', args: [entryPath], env } },
  };
  await fs.writeFile(join(top, '.mcp.json'), JSON.stringify(content, null, 2) + '\n', 'utf-8');
}

async function writeAgentRules(specWorkflowDir: string, extra = ''): Promise<void> {
  await fs.mkdir(specWorkflowDir, { recursive: true });
  await fs.writeFile(
    join(specWorkflowDir, 'agent-rules.md'),
    `# Agent rules\nworktree-per-change: required\nmerge-method: merge\n${extra}`,
    'utf-8',
  );
}

async function writeProjects(top: string, storeRoot: string): Promise<void> {
  const file = {
    v: 1,
    projects: [{ id: 'proj-1', workspacePath: top, workflowRootPath: storeRoot, name: 'test', seen: new Date().toISOString() }],
  };
  await fs.writeFile(join(sddHome, 'projects.json'), JSON.stringify(file), 'utf-8');
}

function addOrigin(top: string, url: string): void {
  execFileSync('git', ['-C', top, 'remote', 'add', 'origin', url]);
}

/** Write a gh stub script and point the env at it. Returns the script path. */
function useGhScript(runs: unknown[]): string {
  const scriptPath = join(base, `gh-script-${Math.random().toString(36).slice(2, 9)}.json`);
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_GH_BIN = STUB;
  process.env.STUB_GH_SCRIPT = scriptPath;
  return scriptPath;
}

function recordedArgv(scriptPath: string): string[][] {
  const raw = readFileSync(`${scriptPath}.argv`, 'utf8').trim();
  return raw ? raw.split('\n').map((l) => JSON.parse(l) as string[]) : [];
}

/** Builds a fully valid fixture: every check should read 'ok'. */
async function makeValidFixture(name: string, options: { controller?: boolean } = {}): Promise<{ top: string; specWorkflowDir: string }> {
  const top = await makeRepo(name);
  const entryPath = await makeEntryPath();
  await writeMcpJson(top, entryPath);
  const specWorkflowDir = join(top, '.spec-workflow');
  await writeAgentRules(specWorkflowDir);
  await writeProjects(top, top);
  addOrigin(top, 'https://github.com/acme/widget.git');
  useGhScript([{ argvIncludes: ['api', 'repos/acme/widget'], stdout: { permissions: { push: true } } }]);
  if (options.controller !== false) {
    const health = await startHealthServer(true);
    servers.push(health);
    process.env.SDD_PORT = String(health.port);
  }
  return { top, specWorkflowDir };
}

function findCheck(results: Awaited<ReturnType<typeof runChecks>>, name: string) {
  const found = results.find((r) => r.name === name);
  if (!found) throw new Error(`no check named ${name}`);
  return found;
}

describe('runChecks', () => {
  it('reads all seven checks ok, in Req 7 AC 1 order, and runDoctor exits 0 on the same repository', async () => {
    const { top } = await makeValidFixture('repo-happy');

    const results = await runChecks(top, 5000);

    expect(results.map((r) => r.name)).toEqual(['mcp', 'store', 'agent-rules', 'controller', 'registered', 'remote', 'token']);
    expect(results.map((r) => r.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok']);

    const io = makeIo();
    const code = await runDoctor(top, io, 5000);
    expect(code).toBe(0);
  });

  it('skips store, agent-rules and registered when mcp fails, leaving controller, remote and token unaffected', async () => {
    const { top } = await makeValidFixture('repo-mcp-fail');
    await fs.writeFile(join(top, '.mcp.json'), 'not valid json {{{', 'utf-8');

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'mcp')).toMatchObject({ status: 'fail', fix: `run init ${top}` });
    expect(findCheck(results, 'store').status).toBe('skip');
    expect(findCheck(results, 'agent-rules').status).toBe('skip');
    expect(findCheck(results, 'registered').status).toBe('skip');
    expect(findCheck(results, 'controller').status).toBe('ok');
    expect(findCheck(results, 'remote').status).toBe('ok');
    expect(findCheck(results, 'token').status).toBe('ok');
  });

  it('skips agent-rules and registered when store fails, leaving mcp ok', async () => {
    const top = await makeRepo('repo-store-fail');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    // No .spec-workflow directory created at all.
    process.env.SDD_PORT = String(await getFreePort());

    const results = await runChecks(top, 500);

    expect(findCheck(results, 'mcp').status).toBe('ok');
    const store = findCheck(results, 'store');
    expect(store.status).toBe('fail');
    expect(typeof store.fix).toBe('string');
    expect((store.fix as string).length).toBeGreaterThan(0);
    expect(findCheck(results, 'agent-rules').status).toBe('skip');
    expect(findCheck(results, 'registered').status).toBe('skip');
  });

  it('fails agent-rules with no cascade when agent-rules.md is missing, leaving store ok', async () => {
    const top = await makeRepo('repo-agent-rules-fail');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await fs.mkdir(join(top, '.spec-workflow'), { recursive: true });
    // No agent-rules.md written inside it.
    process.env.SDD_PORT = String(await getFreePort());

    const results = await runChecks(top, 500);

    expect(findCheck(results, 'store').status).toBe('ok');
    const agentRules = findCheck(results, 'agent-rules');
    expect(agentRules.status).toBe('fail');
    expect(typeof agentRules.fix).toBe('string');
    expect((agentRules.fix as string).length).toBeGreaterThan(0);
  });

  it('fails controller independently, leaving registered ok (not skipped)', async () => {
    const { top } = await makeValidFixture('repo-controller-fail', { controller: false });
    const freePort = await getFreePort();
    process.env.SDD_PORT = String(freePort);

    const results = await runChecks(top, 500);

    expect(findCheck(results, 'controller')).toMatchObject({
      status: 'fail',
      fix: 'start the controller with scripts/sdd-service.sh install',
    });
    expect(findCheck(results, 'registered').status).toBe('ok');
  });

  it('fails registered when no matching projects.json entry exists, leaving store ok', async () => {
    const top = await makeRepo('repo-registered-fail');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await writeAgentRules(join(top, '.spec-workflow'));
    // No projects.json entry written for this workspace.
    process.env.SDD_PORT = String(await getFreePort());

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'store').status).toBe('ok');
    expect(findCheck(results, 'registered')).toMatchObject({ status: 'fail', fix: `run init ${top}` });
  });

  it('fails remote when there is no origin remote, skipping token', async () => {
    const top = await makeRepo('repo-no-origin');
    process.env.SDD_PORT = String(await getFreePort());

    const results = await runChecks(top, 500);

    expect(findCheck(results, 'remote')).toMatchObject({
      status: 'fail',
      fix: 'add a github.com origin remote',
    });
    expect(findCheck(results, 'token').status).toBe('skip');
  });

  it("records exactly ['api', 'repos/acme/widget'] in the stub's argv sidecar for a passing token check", async () => {
    const { top } = await makeValidFixture('repo-argv');
    const scriptPath = process.env.STUB_GH_SCRIPT as string;

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'token').status).toBe('ok');
    expect(recordedArgv(scriptPath)).toEqual([['api', 'repos/acme/widget']]);
  });

  it("fails token with reason 'no push permission' when gh reports permissions.push false", async () => {
    const top = await makeRepo('repo-token-push-false');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await writeAgentRules(join(top, '.spec-workflow'));
    addOrigin(top, 'https://github.com/acme/widget.git');
    process.env.SDD_PORT = String(await getFreePort());
    useGhScript([{ stdout: { permissions: { push: false } } }]);

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'token')).toMatchObject({
      status: 'fail',
      reason: 'no push permission',
      fix: 're-run scripts/sdd-service.sh install with GH_TOKEN set, or gh auth login',
    });
  });

  it("fails token with reason 'unreadable gh output' for non-JSON stdout", async () => {
    const top = await makeRepo('repo-token-bad-json');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await writeAgentRules(join(top, '.spec-workflow'));
    addOrigin(top, 'https://github.com/acme/widget.git');
    process.env.SDD_PORT = String(await getFreePort());
    useGhScript([{ stdout: 'not json at all' }]);

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'token')).toMatchObject({ status: 'fail', reason: 'unreadable gh output' });
  });

  it("fails token with reason 'gh exited 1' for a non-zero exit code", async () => {
    const top = await makeRepo('repo-token-exit-1');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await writeAgentRules(join(top, '.spec-workflow'));
    addOrigin(top, 'https://github.com/acme/widget.git');
    process.env.SDD_PORT = String(await getFreePort());
    useGhScript([{ exitCode: 1, stderr: 'boom' }]);

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'token')).toMatchObject({ status: 'fail', reason: 'gh exited 1' });
  });

  it("fails token with reason 'gh exited ENOENT' for a missing gh binary", async () => {
    const top = await makeRepo('repo-token-missing-binary');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await writeAgentRules(join(top, '.spec-workflow'));
    addOrigin(top, 'https://github.com/acme/widget.git');
    process.env.SDD_PORT = String(await getFreePort());
    process.env.CONTROLLER_GH_BIN = join(base, 'definitely-not-a-real-gh-binary');

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'token')).toMatchObject({ status: 'fail', reason: 'gh exited ENOENT' });
  });

  it('parses an https origin and reaches token with the right owner/repo', async () => {
    const top = await makeRepo('repo-remote-https');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await writeAgentRules(join(top, '.spec-workflow'));
    addOrigin(top, 'https://github.com/acme/widget.git');
    process.env.SDD_PORT = String(await getFreePort());
    useGhScript([{ argvIncludes: ['api', 'repos/acme/widget'], stdout: { permissions: { push: true } } }]);

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'remote').status).toBe('ok');
    expect(findCheck(results, 'token').status).toBe('ok');
  });

  it('parses a git@ origin and reaches token with the right owner/repo', async () => {
    const top = await makeRepo('repo-remote-git-at');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await writeAgentRules(join(top, '.spec-workflow'));
    addOrigin(top, 'git@github.com:acme/widget.git');
    process.env.SDD_PORT = String(await getFreePort());
    useGhScript([{ argvIncludes: ['api', 'repos/acme/widget'], stdout: { permissions: { push: true } } }]);

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'remote').status).toBe('ok');
    expect(findCheck(results, 'token').status).toBe('ok');
  });

  it('parses an ssh:// origin and reaches token with the right owner/repo', async () => {
    const top = await makeRepo('repo-remote-ssh');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await writeAgentRules(join(top, '.spec-workflow'));
    addOrigin(top, 'ssh://git@github.com/acme/widget.git');
    process.env.SDD_PORT = String(await getFreePort());
    useGhScript([{ argvIncludes: ['api', 'repos/acme/widget'], stdout: { permissions: { push: true } } }]);

    const results = await runChecks(top, 2000);

    expect(findCheck(results, 'remote').status).toBe('ok');
    expect(findCheck(results, 'token').status).toBe('ok');
  });

  it('fails controller within 1 second against a 200 ms timeout and a silent server', async () => {
    const top = await makeRepo('repo-silent-timeout');
    // mcp fails immediately (no file), remote fails immediately (no origin):
    // neither waits on the network, isolating the controller check's timing.
    const silent = await startSilentServer();
    servers.push(silent);
    process.env.SDD_PORT = String(silent.port);

    const started = Date.now();
    const results = await runChecks(top, 200);
    const elapsed = Date.now() - started;

    expect(findCheck(results, 'controller').status).toBe('fail');
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('runDoctor', () => {
  it('exits 1 and names the first failure and its fix on the last output line', async () => {
    const { top } = await makeValidFixture('repo-last-line');
    await fs.writeFile(join(top, '.mcp.json'), 'not valid json {{{', 'utf-8');
    const io = makeIo();

    const code = await runDoctor(top, io, 2000);

    expect(code).toBe(1);
    expect(io.outLines.at(-1)).toBe(`first failure: mcp — run init ${top}`);
  });

  it('creates, writes, renames and deletes nothing, with a dead-pid session file present', async () => {
    const top = await makeRepo('repo-no-side-effects');
    const entryPath = await makeEntryPath();
    await writeMcpJson(top, entryPath);
    await writeAgentRules(join(top, '.spec-workflow'));
    await writeProjects(top, top);
    addOrigin(top, 'https://github.com/acme/widget.git');
    // No controller listening: this check fails, exercising the fail path too.
    process.env.SDD_PORT = String(await getFreePort());

    const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    const deadPid = dead.pid as number;
    const sessionPath = join(specWorkflowHome, 'activeSession.json');
    await fs.writeFile(
      sessionPath,
      JSON.stringify({ url: 'http://localhost:4000', port: 4000, pid: deadPid, startedAt: '2026-01-01T00:00:00.000Z' }),
      'utf-8',
    );

    const dirsToCheck = [top, join(top, '.spec-workflow'), sddHome, specWorkflowHome];
    async function snapshot(): Promise<Array<{ dir: string; listing: string[]; mtimes: number[] }>> {
      const out = [];
      for (const dir of dirsToCheck) {
        const listing = (await fs.readdir(dir)).sort();
        const mtimes = await Promise.all(listing.map(async (name) => (await fs.stat(join(dir, name))).mtimeMs));
        out.push({ dir, listing, mtimes });
      }
      return out;
    }

    const before = await snapshot();
    const io = makeIo();
    await runDoctor(top, io, 300);
    const after = await snapshot();

    expect(after).toEqual(before);
    await expect(fs.access(sessionPath)).resolves.toBeUndefined();
  });
});

describe('serviceEnv', () => {
  const marker1 = `SDD_DOCTOR_TEST_KEY_${Math.random().toString(36).slice(2, 9)}`;
  const marker2 = `SDD_DOCTOR_KEEP_KEY_${Math.random().toString(36).slice(2, 9)}`;
  const marker3 = `SDD_DOCTOR_NOFILE_KEY_${Math.random().toString(36).slice(2, 9)}`;

  it('lets a service.env key replace the same-named process key', async () => {
    process.env[marker1] = 'from-process';
    await fs.writeFile(join(sddHome, 'service.env'), `${marker1}=from-file\n`, 'utf-8');

    const result = serviceEnv();

    expect(result[marker1]).toBe('from-file');
  });

  it('keeps a process key that service.env does not mention', async () => {
    process.env[marker2] = 'keep-me';
    await fs.writeFile(join(sddHome, 'service.env'), 'UNRELATED_KEY=whatever\n', 'utf-8');

    const result = serviceEnv();

    expect(result[marker2]).toBe('keep-me');
  });

  it('returns the process env unchanged when service.env does not exist', () => {
    process.env[marker3] = 'plain';
    expect(existsSync(join(sddHome, 'service.env'))).toBe(false);

    const result = serviceEnv();

    expect(result[marker3]).toBe('plain');
  });
});
