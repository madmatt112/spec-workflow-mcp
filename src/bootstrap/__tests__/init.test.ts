// Contract for src/bootstrap/init.ts (design C3; Req 1 AC 7-8; Req 2; Req 3;
// Req 4 AC 2, 6, 8; Req 5 AC 1, 7; Req 6; Reliability and Security NFRs). One
// export under test: runInit(args, io, entryPath, timeoutMs). No collaborator
// inside the module is mocked: a real temporary git repository stands in for
// the repository, a real bare Fastify app with the real installAccessControl
// hook stands in for the controller (per the brief: "fake controller (Fastify,
// installAccessControl, stub add route, SDD_PORT)"), and a real secret file
// under a per-test SDD_HOME stands in for the shared secret. `entryPath` is
// passed explicitly (a fixed string, never resolved or checked for existence
// by runInit itself).
//
// Phase 1 — validate, nothing written (Req 1 AC 7; Req 2 AC 3; Req 3 AC 5; Req 6 AC 2).
// 1. A missing repository path -> exit 1, no file written.
//    Pre:  repoPath is an absolute path that does not exist.
//    Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//    Want: 1; io.err contains `error: ${repoPath}: does not exist`; no
//          .mcp.json or agent-rules.md appears anywhere under repoPath's parent.
//    Src:  design.md C3 phase 1 step 1 "Absent: `error: <path>: does not
//          exist`, return 1"; requirements.md Req 1 AC 7.
// 2. A path that exists but is not inside a git work tree -> exit 1, no file written.
//    Pre:  repoPath is a real, existing directory with no `.git`.
//    Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//    Want: 1; io.err contains `error: ${repoPath}: not inside a git work tree`;
//          no .mcp.json or .spec-workflow created under repoPath.
//    Src:  design.md C3 phase 1 step 1 "null: `error: <path>: not inside a git
//          work tree`, return 1 (Req 1 AC 7-8, D5)".
// 3. A --store path that does not exist -> exit 1, no file written.
//    Pre:  repoPath is a valid git repository; store is an absolute path that
//          does not exist.
//    Call: runInit({ repoPath, store, ... }, io, ENTRY_PATH)
//    Want: 1; io.err has a line naming `store`; no .mcp.json or .spec-workflow
//          appears under the repository top level, and `store` itself is never
//          created.
//    Src:  requirements.md Req 2 AC 3 "does not exist or is not a directory ...
//          one line naming it and ... exit 1 without writing a file".
// 4. A malformed existing .mcp.json -> exit 1, the file is left untouched, no
//    agent-rules.md is written.
//    Pre:  repoPath is a valid git repository whose top level already holds an
//          `.mcp.json` containing invalid JSON text.
//    Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//    Want: 1; io.err has a line naming the `.mcp.json` path; the file's bytes
//          are unchanged; no `agent-rules.md` appears under the store.
//    Src:  requirements.md Req 3 AC 5 "not valid JSON ... print one line naming
//          the file and ... exit 1 without writing any file".
//
// Path resolution (Req 1 AC 8; Req 2 AC 1-2).
// 5. A path inside the repository resolves to its git top level.
//    Pre:  repoPath is a nested subdirectory of a valid git repository.
//    Call: runInit({ repoPath: nestedDir, ... }, io, ENTRY_PATH)
//    Want: 0; `.mcp.json` is written at the repository top level, not inside
//          the nested subdirectory; io.out's `wrote`/`updated`/`kept` line for
//          it names the top-level path.
//    Src:  design.md C3 phase 1 step 1 "top = gitTopLevel(dir)"; requirements.md
//          Req 1 AC 8.
// 6. No --store: the store root is the repository top level, the entry's env
//    is `{}`, and the only directory init creates is `.spec-workflow`, holding
//    only `agent-rules.md`.
//    Pre:  a fresh, otherwise-empty valid git repository, no --store.
//    Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//    Want: 0; the new top-level entries after the run are exactly `.mcp.json`
//          and `.spec-workflow`; `.spec-workflow`'s only entry is
//          `agent-rules.md`; the written `spec-workflow` entry's `env` is `{}`.
//    Src:  requirements.md Req 2 AC 1 "store root SHALL be the repository's git
//          top level"; Req 2 AC 4 "create no other directory of the store
//          layout"; Req 3 AC 2 "WHEN it is not given THEN ... env SHALL be {}".
// 7. --store given: the store root is that path (realpath), the entry's env
//    carries it, and the store layout is written there instead of under the
//    repository.
//    Pre:  a fresh, empty, existing sibling directory as --store; a valid git
//          repository as repoPath.
//    Call: runInit({ repoPath, store: storePath, ... }, io, ENTRY_PATH)
//    Want: 0; the written `spec-workflow` entry's `env` is
//          `{ SPEC_WORKFLOW_SHARED_ROOT: realpath(storePath) }`; `storePath`'s
//          only new entry is `.spec-workflow`, holding only `agent-rules.md`;
//          the repository top level gains only `.mcp.json` (no `.spec-workflow`
//          there).
//    Src:  requirements.md Req 2 AC 2 "resolved to absolute, with the same
//          meaning as SPEC_WORKFLOW_SHARED_ROOT"; Req 3 AC 2 "WHEN --store is
//          given THEN the entry's env SHALL be { SPEC_WORKFLOW_SHARED_ROOT:
//          <store root> }"; design.md D9 (realpath).
//
// .mcp.json content (Req 3 AC 1, 3, 4, 6).
// 8. A fresh repository with no existing .mcp.json gets the exact entry shape,
//    two-space indented JSON, one trailing newline.
//    Pre:  a fresh valid git repository, no .mcp.json.
//    Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//    Want: the parsed file equals
//          `{ mcpServers: { 'spec-workflow': { type: 'stdio', command: 'node',
//          args: [ENTRY_PATH], env: {} } } }`; the raw text contains a
//          two-space-indented `"mcpServers": {` line; the raw text ends in
//          exactly one `\n`.
//    Src:  design.md C3 phase 2 step 2; requirements.md Req 3 AC 1, 6.
// 9. An existing .mcp.json with another top-level key and another server
//    entry keeps both, with their original value and key order.
//    Pre:  .mcp.json pre-written with `customTopLevelKey`, `mcpServers['other-
//          server']` and `mcpServers['spec-workflow']` (an old entry), in that
//          key order.
//    Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//    Want: `customTopLevelKey` unchanged; `mcpServers['other-server']` deep-
//          equal to its original value; `Object.keys(mcpServers)` still
//          `['other-server', 'spec-workflow']`; `mcpServers['spec-workflow']`
//          replaced with the new entry.
//    Src:  requirements.md Req 3 AC 3 "SHALL replace only the mcpServers.spec-
//          workflow entry and SHALL keep every other key and every other
//          server entry with its value unchanged"; design.md C3 "Assignment
//          keeps an existing key's position".
// 10. An existing .mcp.json with no mcpServers key gets one added, holding
//     only the spec-workflow entry; other keys are kept.
//     Pre:  .mcp.json pre-written as `{ "customTopLevelKey": "keep-me" }`.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: `mcpServers` is `{ 'spec-workflow': <the new entry> }` (only key);
//           `customTopLevelKey` is still `'keep-me'`.
//     Src:  requirements.md Req 3 AC 3 "WHEN the file has no mcpServers key
//           THEN init SHALL add one holding only the spec-workflow entry".
// 11. A differing existing spec-workflow entry is reported with a `was:`
//     clause naming only its command and args, never its env; no output line
//     anywhere leaks the real secret or the old entry's env value.
//     Pre:  .mcp.json pre-written with `mcpServers['spec-workflow']` =
//           `{ command: 'npx', args: ['-y', 'spec-workflow-mcp@latest'],
//           env: { SPEC_WORKFLOW_SHARED_ROOT: 'leak-path-marker' } }`; a real
//           secret written to the per-test SDD_HOME; a fake controller started
//           with the same secret, SDD_PORT pointed at it.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: 0; one io.out line matches
//           `/updated .*\(was: npx -y spec-workflow-mcp@latest\)/`; no line in
//           io.out or io.err contains `'leak-path-marker'` or the real secret
//           string.
//     Src:  requirements.md Req 3 AC 4 "SHALL print the previous entry's
//           command and args ... SHALL NOT print the previous env values";
//           design.md C3 phase 2 step 2 "append ... and never its env";
//           Security NFR "SHALL NOT print, log or write ... any env value of
//           an existing .mcp.json server entry"; brief Restrictions "never
//           print the secret or an env value".
//
// agent-rules.md (Req 4 AC 2, 6, 8).
// 12. A store with no agent-rules.md gets one written with the three facts
//     filled in.
//     Pre:  a fresh store (no agent-rules.md); args carry explicit
//           testCommand, worktreeSetup and mergeMethod overrides.
//     Call: runInit({ repoPath, testCommand: 'npx vitest run {files}',
//             worktreeSetup: 'npm ci', mergeMethod: 'squash' }, io, ENTRY_PATH)
//     Want: the written file contains `worktree-per-change: required`,
//           `` worktree-setup: `npm ci` ``, `` tdd-test-command: `npx vitest
//           run {files}` ``, `merge-method: squash`, `merge: auto`.
//     Src:  requirements.md Req 4 AC 2 "init SHALL write ... from the template,
//           with the three facts of AC 3 to 5 filled in".
// 13. When a fact cannot be detected and no override is given, init prints a
//     note naming the key and the option that sets it, for every left-out fact.
//     Pre:  a fresh, empty repository (no lockfile, no package.json); no
//           testCommand/worktreeSetup override.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: io.out contains
//           `'note: tdd-test-command not detected; set it with --test-command'`
//           and
//           `'note: worktree-setup not detected; set it with --worktree-setup'`.
//     Src:  requirements.md Req 4 AC 6 "SHALL print one line naming the key and
//           the option that sets it"; design.md C3 phase 2 step 3 "per left-out
//           fact print `note: <key> not detected; set it with <option>`".
// 14. An existing agent-rules.md is left byte-for-byte unchanged and reported
//     as kept.
//     Pre:  the store's `.spec-workflow/agent-rules.md` pre-written with
//           arbitrary hand-written text.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: the file's bytes after the run equal the pre-written bytes exactly;
//           io.out contains `kept <agentRulesPath>`.
//     Src:  requirements.md Req 4 AC 8 "SHALL leave it byte-for-byte unchanged
//           and SHALL print that it kept it".
//
// Registration (Req 5 AC 1, 7).
// 15. init never writes projects.json or the MCP process registry file itself;
//     only the HTTP call can do that, and the stub route here does not.
//     Pre:  a fresh repository and store; a fake controller reachable with the
//           matching secret; its stub add route only replies 200, it writes
//           nothing to disk.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: 0; `${SDD_HOME}/projects.json` and
//           `${SPEC_WORKFLOW_HOME}/activeProjects.json` both still do not exist
//           after the run.
//     Src:  requirements.md Req 5 AC 1 "init SHALL NOT write projects.json or
//           the MCP process registry itself".
// 16. No shared secret on disk -> exit 2, the written files are kept, and the
//     failure line names the controller start command.
//     Pre:  a fresh repository and store; SDD_HOME has no `secret` file.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: 2; `.mcp.json` and `agent-rules.md` both exist with valid content
//           after the run; io.out has a line containing
//           `'scripts/sdd-service.sh install'`.
//     Src:  requirements.md Req 5 AC 7 "the secret file is missing ... init
//           SHALL keep the files it wrote, SHALL print one line naming the
//           failure and the command that starts the controller ... and SHALL
//           exit 2".
// 17. The controller is not reachable (nothing listens on the resolved port)
//     -> exit 2, files kept.
//     Pre:  a fresh repository and store; a real secret on disk; SDD_PORT set
//           to a port nothing listens on.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: 2; `.mcp.json` and `agent-rules.md` both exist after the run.
//     Src:  requirements.md Req 5 AC 7 "the controller does not answer ...".
// 18. The controller answers non-2xx (the real access hook rejects a secret
//     mismatch) -> exit 2, files kept.
//     Pre:  a fresh repository and store; a real secret on disk; a fake
//           controller started with a *different* secret, so the real
//           installAccessControl hook answers 401 to init's Bearer header.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: 2; `.mcp.json` and `agent-rules.md` both exist after the run.
//     Src:  requirements.md Req 5 AC 7 "the API returns a non-2xx status ...".
//
// Output, idempotence, exit codes (Req 6 AC 1, 3, 4, 5).
// 19. A registration failure on a re-run of an already-set-up repository still
//     exits 2, and both files are reported kept with unchanged bytes.
//     Pre:  a successful first run (controller reachable); the controller is
//           then stopped; the same args are run again.
//     Call: runInit(sameArgs, io2, ENTRY_PATH) [second run]
//     Want: 2; io2.out contains `kept <mcpJsonPath>` and `kept
//           <agentRulesPath>`; both files' bytes equal the bytes captured
//           right after the first run.
//     Src:  requirements.md Req 6 AC 3 "a registration failure on that re-run
//           still exits 2 (Requirement 5 AC 7)".
// 20. A fresh successful run prints `wrote` for both files, then `registered
//     <id>`, in that order, and exits 0.
//     Pre:  a fresh repository and store; a reachable fake controller with the
//           matching secret, its stub route replying `{ projectId:
//           'stub-project-id' }`.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: 0; io.out contains, in index order, a line starting
//           `wrote ${mcpJsonPath}`, then one starting `wrote
//           ${agentRulesPath}`, then `registered stub-project-id`.
//     Src:  requirements.md Req 6 AC 1 "init SHALL print one line per file it
//           touched ... and one line registered followed by the project id";
//           design.md C3 phase ordering (phase 2 writes, then phase 3
//           registers).
// 21. A byte-identical re-run with the same arguments changes no file byte,
//     prints `kept` for both files, still registers, and exits 0.
//     Pre:  the successful run of scenario 20, then the identical args run
//           again against the same reachable controller.
//     Call: runInit(sameArgs, io2, ENTRY_PATH) [second run]
//     Want: 0; io2.out contains `kept <mcpJsonPath>` and `kept
//           <agentRulesPath>`, and a `registered ...` line; both files' bytes
//           equal the bytes captured after the first run.
//     Src:  requirements.md Req 6 AC 3 "it SHALL change no file byte and SHALL
//           print kept for every file; WHEN the controller is also reachable
//           and registration succeeds THEN it SHALL exit 0".
// 22. On a successful run (exit 0), the last printed line states the files are
//     not committed and names doctor as the next command.
//     Pre:  the successful run of scenario 20.
//     Call: (same run)
//     Want: the last element of io.out matches `/not committed/i` and contains
//           `'doctor'` and the repository top-level path.
//     Src:  requirements.md Req 6 AC 5 "its last line SHALL say that the
//           written files are not committed and SHALL name doctor as the next
//           command"; design.md D8.
// 23. On a registration failure (exit 2), the last printed line states the
//     same thing.
//     Pre:  the no-secret run of scenario 16.
//     Call: (same run)
//     Want: the last element of io.out matches `/not committed/i` and contains
//           `'doctor'`.
//     Src:  requirements.md Req 6 AC 5 (same text, "on exit 0 and 2");
//           design.md D8 "the not-committed line on exit 0 and 2".
//
// Reliability NFR.
// 24. Each file write goes through a same-directory temporary file and a
//     rename, never a direct write to the final path.
//     Pre:  a fresh repository and store; `fs.promises.rename` spied on.
//     Call: runInit({ repoPath, ... }, io, ENTRY_PATH)
//     Want: the spy was called at least twice; for each call, the temp path's
//           `dirname` equals the destination's `dirname`, the destination is
//           either `mcpJsonPath` or `agentRulesPath`, and the temp path differs
//           from the destination.
//     Src:  requirements.md Reliability NFR "init SHALL write each file
//           through a temporary file in the same directory and a rename";
//           design.md C3 phase 2 "each write is a same-directory temp file and
//           a rename".

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs, realpathSync } from 'fs';
import fastify, { FastifyInstance } from 'fastify';
import { execFileSync } from 'child_process';
import net from 'net';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { runInit, type InitArgs } from '../init.js';
import { installAccessControl } from '../../controller/access.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';

const ENTRY_PATH = '/fake-checkout/dist/index.js';

function makeIo(): { out(line: string): void; err(line: string): void; outLines: string[]; errLines: string[] } {
  const outLines: string[] = [];
  const errLines: string[] = [];
  return {
    outLines,
    errLines,
    out: (line: string) => outLines.push(line),
    err: (line: string) => errLines.push(line),
  };
}

function baseArgs(repoPath: string, extra: Partial<InitArgs> = {}): InitArgs {
  return {
    repoPath,
    testCommand: 'npx vitest run {files}',
    worktreeSetup: 'npm ci',
    mergeMethod: 'merge',
    ...extra,
  };
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

async function startFakeController(secret: string): Promise<{ url: string; port: number; close(): Promise<void> }> {
  const app: FastifyInstance = fastify({ logger: false });
  installAccessControl(app, secret);
  app.post('/api/projects/add', async (_request, reply) => {
    return reply.code(200).send({ projectId: 'stub-project-id', success: true });
  });
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const url = address.replace('[::1]', '127.0.0.1');
  const port = Number(new URL(url).port);
  return { url, port, close: () => app.close() };
}

async function makeRepo(base: string, name: string): Promise<string> {
  const repo = join(base, name);
  await fs.mkdir(repo, { recursive: true });
  execFileSync('git', ['-C', repo, 'init', '-q']);
  return realpathSync(repo);
}

async function writeSecret(sddHome: string, secret: string): Promise<void> {
  await fs.mkdir(sddHome, { recursive: true });
  await fs.writeFile(join(sddHome, 'secret'), secret, 'utf-8');
}

describe('runInit', () => {
  let base: string;
  let sddHome: string;
  let specWorkflowHome: string;
  const originalEnv = { ...process.env };
  const servers: Array<{ close(): Promise<void> }> = [];

  beforeEach(async () => {
    base = join(tmpdir(), `bootstrap-init-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await fs.mkdir(base, { recursive: true });
    sddHome = join(base, 'sdd-home');
    specWorkflowHome = join(base, 'spec-workflow-home');
    process.env.SDD_HOME = sddHome;
    process.env[SPEC_WORKFLOW_HOME_ENV] = specWorkflowHome;
    delete process.env.SDD_PORT;
  });

  afterEach(async () => {
    await Promise.all(servers.map((s) => s.close().catch(() => {})));
    servers.length = 0;
    process.env = { ...originalEnv };
    await fs.rm(base, { recursive: true, force: true });
  });

  // --- Phase 1: validate, nothing written -----------------------------------

  it('a missing repository path exits 1 with no file written', async () => {
    const repoPath = join(base, 'does-not-exist');
    const io = makeIo();

    const code = await runInit(baseArgs(repoPath), io, ENTRY_PATH);

    expect(code).toBe(1);
    expect(io.errLines).toContain(`error: ${repoPath}: does not exist`);
    await expect(fs.access(join(base, '.mcp.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('a path that is not inside a git work tree exits 1 with no file written', async () => {
    const notARepo = join(base, 'plain-dir');
    await fs.mkdir(notARepo, { recursive: true });
    const io = makeIo();

    const code = await runInit(baseArgs(notARepo), io, ENTRY_PATH);

    expect(code).toBe(1);
    expect(io.errLines).toContain(`error: ${notARepo}: not inside a git work tree`);
    await expect(fs.access(join(notARepo, '.mcp.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(join(notARepo, '.spec-workflow'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('a non-existent --store path exits 1 with no file written', async () => {
    const repo = await makeRepo(base, 'repo-bad-store');
    const badStore = join(base, 'nonexistent-store');
    const io = makeIo();

    const code = await runInit(baseArgs(repo, { store: badStore }), io, ENTRY_PATH);

    expect(code).toBe(1);
    expect(io.errLines.join('\n')).toContain(badStore);
    await expect(fs.access(join(repo, '.mcp.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(join(repo, '.spec-workflow'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(badStore)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('a malformed existing .mcp.json exits 1, leaving the file untouched and writing no agent-rules.md', async () => {
    const repo = await makeRepo(base, 'repo-malformed-mcp');
    const mcpJsonPath = join(repo, '.mcp.json');
    const malformed = 'not valid json {{{';
    await fs.writeFile(mcpJsonPath, malformed, 'utf-8');
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(1);
    expect(io.errLines.join('\n')).toContain(mcpJsonPath);
    expect(await fs.readFile(mcpJsonPath, 'utf-8')).toBe(malformed);
    await expect(fs.access(join(repo, '.spec-workflow', 'agent-rules.md'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  // --- Path resolution -------------------------------------------------------

  it('resolves a nested subdirectory to the repository top level', async () => {
    const repo = await makeRepo(base, 'repo-nested');
    const nested = join(repo, 'a', 'b', 'c');
    await fs.mkdir(nested, { recursive: true });
    const io = makeIo();

    const code = await runInit(baseArgs(nested), io, ENTRY_PATH);

    expect(code).toBe(0);
    const topMcpJson = join(repo, '.mcp.json');
    await expect(fs.access(topMcpJson)).resolves.toBeUndefined();
    await expect(fs.access(join(nested, '.mcp.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(io.outLines.some((l) => l.includes(topMcpJson))).toBe(true);
  });

  it('with no --store, the store root is the repository top level, env is {}, and only .spec-workflow is created', async () => {
    const repo = await makeRepo(base, 'repo-no-store');
    const before = (await fs.readdir(repo)).sort();
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(0);
    const after = (await fs.readdir(repo)).sort();
    const added = after.filter((e) => !before.includes(e)).sort();
    expect(added).toEqual(['.mcp.json', '.spec-workflow']);
    expect(await fs.readdir(join(repo, '.spec-workflow'))).toEqual(['agent-rules.md']);

    const mcpJson = JSON.parse(await fs.readFile(join(repo, '.mcp.json'), 'utf-8'));
    expect(mcpJson.mcpServers['spec-workflow'].env).toEqual({});
  });

  it('with --store, the store root is the given path (realpath) and the layout is written there, not at the repository top', async () => {
    const repo = await makeRepo(base, 'repo-with-store');
    const store = join(base, 'separate-store');
    await fs.mkdir(store, { recursive: true });
    const expectedStoreRoot = realpathSync(store);
    const repoBefore = (await fs.readdir(repo)).sort();
    const io = makeIo();

    const code = await runInit(baseArgs(repo, { store }), io, ENTRY_PATH);

    expect(code).toBe(0);
    const mcpJson = JSON.parse(await fs.readFile(join(repo, '.mcp.json'), 'utf-8'));
    expect(mcpJson.mcpServers['spec-workflow'].env).toEqual({ SPEC_WORKFLOW_SHARED_ROOT: expectedStoreRoot });

    expect(await fs.readdir(store)).toEqual(['.spec-workflow']);
    expect(await fs.readdir(join(store, '.spec-workflow'))).toEqual(['agent-rules.md']);

    const repoAfter = (await fs.readdir(repo)).sort();
    const repoAdded = repoAfter.filter((e) => !repoBefore.includes(e)).sort();
    expect(repoAdded).toEqual(['.mcp.json']);
  });

  // --- .mcp.json content -------------------------------------------------------

  it('writes a fresh .mcp.json with the exact entry shape, two-space indent and one trailing newline', async () => {
    const repo = await makeRepo(base, 'repo-fresh-mcp');
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(0);
    const mcpJsonPath = join(repo, '.mcp.json');
    const raw = await fs.readFile(mcpJsonPath, 'utf-8');
    expect(JSON.parse(raw)).toEqual({
      mcpServers: { 'spec-workflow': { type: 'stdio', command: 'node', args: [ENTRY_PATH], env: {} } },
    });
    expect(raw).toContain('  "mcpServers": {');
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw.endsWith('\n\n')).toBe(false);
  });

  it('keeps another top-level key and another server entry, with their original value and key order', async () => {
    const repo = await makeRepo(base, 'repo-other-keys');
    const original = {
      customTopLevelKey: 'should-stay',
      mcpServers: {
        'other-server': { type: 'stdio', command: 'foo', args: ['bar'] },
        'spec-workflow': { type: 'stdio', command: 'old-node', args: ['/old/path.js'] },
      },
    };
    await fs.writeFile(join(repo, '.mcp.json'), JSON.stringify(original, null, 2) + '\n', 'utf-8');
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(0);
    const parsed = JSON.parse(await fs.readFile(join(repo, '.mcp.json'), 'utf-8'));
    expect(parsed.customTopLevelKey).toBe('should-stay');
    expect(parsed.mcpServers['other-server']).toEqual(original.mcpServers['other-server']);
    expect(Object.keys(parsed.mcpServers)).toEqual(['other-server', 'spec-workflow']);
    expect(parsed.mcpServers['spec-workflow']).toEqual({
      type: 'stdio', command: 'node', args: [ENTRY_PATH], env: {},
    });
  });

  it('adds a missing mcpServers key holding only the spec-workflow entry, keeping other keys', async () => {
    const repo = await makeRepo(base, 'repo-no-mcpservers');
    await fs.writeFile(join(repo, '.mcp.json'), JSON.stringify({ customTopLevelKey: 'keep-me' }, null, 2) + '\n', 'utf-8');
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(0);
    const parsed = JSON.parse(await fs.readFile(join(repo, '.mcp.json'), 'utf-8'));
    expect(parsed.customTopLevelKey).toBe('keep-me');
    expect(Object.keys(parsed.mcpServers)).toEqual(['spec-workflow']);
  });

  it('reports a differing existing entry with a was: clause naming command and args but never env, and leaks neither the secret nor the old env value', async () => {
    const repo = await makeRepo(base, 'repo-differing-entry');
    const original = {
      mcpServers: {
        'spec-workflow': {
          type: 'stdio',
          command: 'npx',
          args: ['-y', 'spec-workflow-mcp@latest'],
          env: { SPEC_WORKFLOW_SHARED_ROOT: 'leak-path-marker' },
        },
      },
    };
    await fs.writeFile(join(repo, '.mcp.json'), JSON.stringify(original, null, 2) + '\n', 'utf-8');

    const secret = 'top-secret-value';
    await writeSecret(sddHome, secret);
    const controller = await startFakeController(secret);
    servers.push(controller);
    process.env.SDD_PORT = String(controller.port);
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(0);
    const combined = [...io.outLines, ...io.errLines];
    expect(combined.some((l) => /updated .*\(was: npx -y spec-workflow-mcp@latest\)/.test(l))).toBe(true);
    const joined = combined.join('\n');
    expect(joined).not.toContain('leak-path-marker');
    expect(joined).not.toContain(secret);
  });

  // --- agent-rules.md ----------------------------------------------------------

  it('writes a fresh agent-rules.md with the three facts filled in', async () => {
    const repo = await makeRepo(base, 'repo-fresh-rules');
    const io = makeIo();

    const code = await runInit(
      baseArgs(repo, { testCommand: 'npx vitest run {files}', worktreeSetup: 'npm ci', mergeMethod: 'squash' }),
      io,
      ENTRY_PATH,
    );

    expect(code).toBe(0);
    const text = await fs.readFile(join(repo, '.spec-workflow', 'agent-rules.md'), 'utf-8');
    expect(text).toContain('worktree-per-change: required');
    expect(text).toContain('worktree-setup: `npm ci`');
    expect(text).toContain('tdd-test-command: `npx vitest run {files}`');
    expect(text).toContain('merge-method: squash');
    expect(text).toContain('merge: auto');
  });

  it('prints a note naming the key and option for every fact that cannot be detected', async () => {
    const repo = await makeRepo(base, 'repo-no-facts');
    const io = makeIo();

    const code = await runInit({ repoPath: repo, mergeMethod: 'merge' }, io, ENTRY_PATH);

    expect(code).toBe(0);
    expect(io.outLines).toContain('note: tdd-test-command not detected; set it with --test-command');
    expect(io.outLines).toContain('note: worktree-setup not detected; set it with --worktree-setup');
  });

  it('leaves an existing agent-rules.md byte-for-byte unchanged and reports it kept', async () => {
    const repo = await makeRepo(base, 'repo-existing-rules');
    await fs.mkdir(join(repo, '.spec-workflow'), { recursive: true });
    const handWritten = '# Hand-written rules\nworktree-per-change: required\ncustom: yes\n';
    const agentRulesPath = join(repo, '.spec-workflow', 'agent-rules.md');
    await fs.writeFile(agentRulesPath, handWritten, 'utf-8');
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(0);
    expect(await fs.readFile(agentRulesPath, 'utf-8')).toBe(handWritten);
    expect(io.outLines).toContain(`kept ${agentRulesPath}`);
  });

  // --- Registration --------------------------------------------------------

  it('never writes projects.json or the process registry file itself', async () => {
    const repo = await makeRepo(base, 'repo-no-direct-write');
    const secret = 'the-secret';
    await writeSecret(sddHome, secret);
    const controller = await startFakeController(secret);
    servers.push(controller);
    process.env.SDD_PORT = String(controller.port);
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(0);
    await expect(fs.access(join(sddHome, 'projects.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.access(join(specWorkflowHome, 'activeProjects.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('exits 2 with the files kept and names the controller start command when there is no shared secret', async () => {
    const repo = await makeRepo(base, 'repo-no-secret');
    process.env.SDD_PORT = '1';
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(2);
    await expect(fs.access(join(repo, '.mcp.json'))).resolves.toBeUndefined();
    await expect(fs.access(join(repo, '.spec-workflow', 'agent-rules.md'))).resolves.toBeUndefined();
    expect(io.outLines.join('\n')).toContain('scripts/sdd-service.sh install');
  });

  it('exits 2 with the files kept when the controller is not reachable', async () => {
    const repo = await makeRepo(base, 'repo-unreachable');
    await writeSecret(sddHome, 'the-secret');
    const freePort = await getFreePort();
    process.env.SDD_PORT = String(freePort);
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(2);
    await expect(fs.access(join(repo, '.mcp.json'))).resolves.toBeUndefined();
    await expect(fs.access(join(repo, '.spec-workflow', 'agent-rules.md'))).resolves.toBeUndefined();
  });

  it('exits 2 with the files kept when the controller answers non-2xx', async () => {
    const repo = await makeRepo(base, 'repo-non-2xx');
    await writeSecret(sddHome, 'real-secret');
    const controller = await startFakeController('a-different-secret');
    servers.push(controller);
    process.env.SDD_PORT = String(controller.port);
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(2);
    await expect(fs.access(join(repo, '.mcp.json'))).resolves.toBeUndefined();
    await expect(fs.access(join(repo, '.spec-workflow', 'agent-rules.md'))).resolves.toBeUndefined();
  });

  // --- Output, idempotence, exit codes --------------------------------------

  it('prints wrote for both files then registered, in that order, on a fresh successful run', async () => {
    const repo = await makeRepo(base, 'repo-fresh-order');
    const secret = 'the-secret';
    await writeSecret(sddHome, secret);
    const controller = await startFakeController(secret);
    servers.push(controller);
    process.env.SDD_PORT = String(controller.port);
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(0);
    const mcpJsonPath = join(repo, '.mcp.json');
    const agentRulesPath = join(repo, '.spec-workflow', 'agent-rules.md');
    const mcpIdx = io.outLines.findIndex((l) => l.startsWith(`wrote ${mcpJsonPath}`));
    const rulesIdx = io.outLines.findIndex((l) => l.startsWith(`wrote ${agentRulesPath}`));
    const registeredIdx = io.outLines.findIndex((l) => l === 'registered stub-project-id');
    expect(mcpIdx).toBeGreaterThanOrEqual(0);
    expect(rulesIdx).toBeGreaterThan(mcpIdx);
    expect(registeredIdx).toBeGreaterThan(rulesIdx);
  });

  it('a byte-identical re-run changes no byte, prints kept for both files, still registers, and exits 0', async () => {
    const repo = await makeRepo(base, 'repo-idempotent');
    const secret = 'the-secret';
    await writeSecret(sddHome, secret);
    const controller = await startFakeController(secret);
    servers.push(controller);
    process.env.SDD_PORT = String(controller.port);
    const args = baseArgs(repo);

    const first = await runInit(args, makeIo(), ENTRY_PATH);
    expect(first).toBe(0);
    const mcpJsonPath = join(repo, '.mcp.json');
    const agentRulesPath = join(repo, '.spec-workflow', 'agent-rules.md');
    const mcpBytesBefore = await fs.readFile(mcpJsonPath);
    const rulesBytesBefore = await fs.readFile(agentRulesPath);

    const io2 = makeIo();
    const second = await runInit(args, io2, ENTRY_PATH);

    expect(second).toBe(0);
    expect(io2.outLines).toContain(`kept ${mcpJsonPath}`);
    expect(io2.outLines).toContain(`kept ${agentRulesPath}`);
    expect(io2.outLines.some((l) => l.startsWith('registered '))).toBe(true);
    expect(await fs.readFile(mcpJsonPath)).toEqual(mcpBytesBefore);
    expect(await fs.readFile(agentRulesPath)).toEqual(rulesBytesBefore);
  });

  it('a registration failure on a re-run of an already-set-up repository still exits 2, with both files kept unchanged', async () => {
    const repo = await makeRepo(base, 'repo-rerun-fails');
    const secret = 'the-secret';
    await writeSecret(sddHome, secret);
    const controller = await startFakeController(secret);
    process.env.SDD_PORT = String(controller.port);
    const args = baseArgs(repo);

    const first = await runInit(args, makeIo(), ENTRY_PATH);
    expect(first).toBe(0);
    const mcpJsonPath = join(repo, '.mcp.json');
    const agentRulesPath = join(repo, '.spec-workflow', 'agent-rules.md');
    const mcpBytesBefore = await fs.readFile(mcpJsonPath);
    const rulesBytesBefore = await fs.readFile(agentRulesPath);

    await controller.close();

    const io2 = makeIo();
    const second = await runInit(args, io2, ENTRY_PATH);

    expect(second).toBe(2);
    expect(io2.outLines).toContain(`kept ${mcpJsonPath}`);
    expect(io2.outLines).toContain(`kept ${agentRulesPath}`);
    expect(await fs.readFile(mcpJsonPath)).toEqual(mcpBytesBefore);
    expect(await fs.readFile(agentRulesPath)).toEqual(rulesBytesBefore);
  });

  it('the last line on a successful run (exit 0) states the files are not committed and names doctor', async () => {
    const repo = await makeRepo(base, 'repo-last-line-0');
    const secret = 'the-secret';
    await writeSecret(sddHome, secret);
    const controller = await startFakeController(secret);
    servers.push(controller);
    process.env.SDD_PORT = String(controller.port);
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(0);
    const last = io.outLines[io.outLines.length - 1];
    expect(last).toMatch(/not committed/i);
    expect(last).toContain('doctor');
    expect(last).toContain(repo);
  });

  it('the last line on a registration failure (exit 2) states the files are not committed and names doctor', async () => {
    const repo = await makeRepo(base, 'repo-last-line-2');
    process.env.SDD_PORT = '1';
    const io = makeIo();

    const code = await runInit(baseArgs(repo), io, ENTRY_PATH);

    expect(code).toBe(2);
    const last = io.outLines[io.outLines.length - 1];
    expect(last).toMatch(/not committed/i);
    expect(last).toContain('doctor');
  });

  // --- Reliability NFR -------------------------------------------------------

  it('writes each file through a same-directory temporary file and a rename', async () => {
    const repo = await makeRepo(base, 'repo-rename-spy');
    const secret = 'the-secret';
    await writeSecret(sddHome, secret);
    const controller = await startFakeController(secret);
    servers.push(controller);
    process.env.SDD_PORT = String(controller.port);

    const calls: Array<[string, string]> = [];
    const realRename = fs.rename.bind(fs);
    const spy = vi.spyOn(fs, 'rename').mockImplementation(async (...args: any[]) => {
      calls.push([String(args[0]), String(args[1])]);
      return (realRename as any)(...args);
    });

    try {
      const io = makeIo();
      const code = await runInit(baseArgs(repo), io, ENTRY_PATH);
      expect(code).toBe(0);
    } finally {
      spy.mockRestore();
    }

    const mcpJsonPath = join(repo, '.mcp.json');
    const agentRulesPath = join(repo, '.spec-workflow', 'agent-rules.md');
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const [tmp, dest] of calls) {
      expect(dirname(tmp)).toBe(dirname(dest));
      expect(tmp).not.toBe(dest);
      expect([mcpJsonPath, agentRulesPath]).toContain(dest);
    }
    const destinations = calls.map(([, dest]) => dest);
    expect(destinations).toContain(mcpJsonPath);
    expect(destinations).toContain(agentRulesPath);
  });
});
