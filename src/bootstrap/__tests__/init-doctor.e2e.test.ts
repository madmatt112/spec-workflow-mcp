// End-to-end test for the bootstrap `init` then `doctor` flow (design.md
// "Testing Strategy", Req 7 AC 7). Nothing in the path is mocked: a real
// MultiProjectDashboardServer stands in for the controller (started as in
// src/dashboard/__tests__/health-route.test.ts:49-71), its session file naming
// the URL that controllerUrl() discovers; a real temporary git repository with
// a github.com origin, a package-lock.json and vitest in devDependencies; a
// real `projects.json` under a per-test SDD_HOME; and scripts/stub-gh.mjs (via
// CONTROLLER_GH_BIN) answering permissions.push true for the token check.
//
// The global `fetch` is left real on purpose: init and doctor reach the
// controller through it (src/bootstrap/controller-client.ts), so this exercises
// the real route and the real project list. runInit writes .mcp.json and
// agent-rules.md, registers with the controller and exits 0; runDoctor then
// prints seven `ok` lines and exits 0 — once with `--store` on a sibling
// directory, once without — and projects.json holds the repository top level and
// the store root as the entry's two paths.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs, writeFileSync, chmodSync } from 'fs';
import { execFileSync } from 'child_process';
import net from 'net';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../../dashboard/multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { readProjects } from '../../controller/state.js';
import { runInit } from '../init.js';
import { runDoctor } from '../doctor.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-gh.mjs');

const SEVEN_OK = ['ok mcp', 'ok store', 'ok agent-rules', 'ok controller', 'ok registered', 'ok remote', 'ok token'];

const originalEnv = { ...process.env };
let base: string;
let server: MultiProjectDashboardServer | null = null;
let port: number;

async function getFreePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      if (!a || typeof a === 'string') { s.close(); reject(new Error('no port')); return; }
      const p = a.port;
      s.close(() => resolvePort(p));
    });
    s.on('error', reject);
  });
}

function makeIo(): { out(line: string): void; err(line: string): void; outLines: string[]; errLines: string[] } {
  const outLines: string[] = [];
  const errLines: string[] = [];
  return { outLines, errLines, out: (l) => outLines.push(l), err: (l) => errLines.push(l) };
}

/** A temp repo with a github.com origin, a package-lock.json and vitest in devDependencies. */
async function buildRepo(name: string): Promise<string> {
  const repo = join(base, name);
  await fs.mkdir(repo, { recursive: true });
  execFileSync('git', ['-C', repo, 'init', '-q']);
  execFileSync('git', ['-C', repo, 'remote', 'add', 'origin', 'https://github.com/acme/widget.git']);
  await fs.writeFile(join(repo, 'package.json'), JSON.stringify({ name, devDependencies: { vitest: '^1.0.0' } }), 'utf-8');
  await fs.writeFile(join(repo, 'package-lock.json'), '{}\n', 'utf-8');
  return repo;
}

/** An existing temp `dist/index.js` for `init`'s entryPath. */
async function makeEntryPath(): Promise<string> {
  const entryDir = join(base, 'fake-checkout', 'dist');
  await fs.mkdir(entryDir, { recursive: true });
  const entryPath = join(entryDir, 'index.js');
  await fs.writeFile(entryPath, '// fake entry\n', 'utf-8');
  return entryPath;
}

/** The gh stub, answering permissions.push true to the one `api repos/acme/widget` call. */
function useGhScript(): void {
  const scriptPath = join(base, `gh-${Math.random().toString(36).slice(2, 9)}.json`);
  writeFileSync(scriptPath, JSON.stringify([
    { argvIncludes: ['api', 'repos/acme/widget'], stdout: { permissions: { push: true } } },
  ]));
  process.env.CONTROLLER_GH_BIN = STUB;
  process.env.STUB_GH_SCRIPT = scriptPath;
}

describe('init then doctor, end to end (Req 7 AC 7)', () => {
  beforeEach(async () => {
    base = join(tmpdir(), `init-doctor-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await fs.mkdir(base, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(base, 'spec-workflow-home');
    process.env.XDG_STATE_HOME = join(base, 'xdg-state');
    process.env.SDD_HOME = join(base, 'sdd-home');
    await fs.mkdir(process.env[SPEC_WORKFLOW_HOME_ENV], { recursive: true });
    await fs.mkdir(process.env.SDD_HOME, { recursive: true });
    delete process.env.SDD_PORT;
    delete process.env.CONTROLLER_GH_BIN;
    delete process.env.STUB_GH_SCRIPT;

    chmodSync(STUB, 0o755);
    // A real controller: its session file names the URL controllerUrl() reads,
    // and loadOrCreateSecret() writes the secret init reads from the same home.
    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    _resetMultiServerWarningsForTests();
  });

  afterEach(async () => {
    if (server) { await server.stop(); server = null; }
    process.env = { ...originalEnv };
    await fs.rm(base, { recursive: true, force: true });
  });

  it('init exits 0 and doctor prints seven ok lines, with --store on a sibling directory', async () => {
    const repo = await buildRepo('repo-store');
    const store = join(base, 'store-sibling');
    await fs.mkdir(store, { recursive: true });
    const entryPath = await makeEntryPath();
    useGhScript();

    const initIo = makeIo();
    const initCode = await runInit({ repoPath: repo, store }, initIo, entryPath, 5000);
    expect(initCode).toBe(0);

    const doctorIo = makeIo();
    const doctorCode = await runDoctor(repo, doctorIo, 5000);
    expect(doctorCode).toBe(0);
    expect(doctorIo.outLines).toEqual(SEVEN_OK);

    const realTop = await fs.realpath(repo);
    const realStore = await fs.realpath(store);
    const file = await readProjects();
    expect(file.projects).toEqual([
      expect.objectContaining({ workspacePath: realTop, workflowRootPath: realStore }),
    ]);
  });

  it('init exits 0 and doctor prints seven ok lines, without --store', async () => {
    const repo = await buildRepo('repo-no-store');
    const entryPath = await makeEntryPath();
    useGhScript();

    const initIo = makeIo();
    const initCode = await runInit({ repoPath: repo }, initIo, entryPath, 5000);
    expect(initCode).toBe(0);

    const doctorIo = makeIo();
    const doctorCode = await runDoctor(repo, doctorIo, 5000);
    expect(doctorCode).toBe(0);
    expect(doctorIo.outLines).toEqual(SEVEN_OK);

    const realTop = await fs.realpath(repo);
    const file = await readProjects();
    expect(file.projects).toEqual([
      expect.objectContaining({ workspacePath: realTop, workflowRootPath: realTop }),
    ]);
  });
});
