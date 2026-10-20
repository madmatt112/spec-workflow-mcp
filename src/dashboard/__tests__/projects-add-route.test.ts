import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import { realpathSync, mkdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execFileSync } from 'child_process';
import net from 'net';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { loadOrCreateSecret } from '../../controller/access.js';
import { readProjects } from '../../controller/state.js';

// Contract for design C7 / Req 5 AC 1,4,6 — `POST /api/projects/add` with a
// real MultiProjectDashboardServer (the pattern of health-route.test.ts:49-71):
//
// - AC: pre-condition a running server, a temp git repo as projectPath and a
//   non-string workflowRootPath (a number). Test: POST with the secret.
//   Observable: 400, body.error names "workflowRootPath". Expected value
//   from design C7 ("not a string ... gets 400 with an error naming the
//   field").
// - AC: same pre-condition, workflowRootPath a relative string. Test: POST.
//   Observable: 400, body.error names "workflowRootPath". Expected value
//   from design C7 ("not absolute ... gets 400").
// - AC: same pre-condition, workflowRootPath an absolute path to a directory
//   that does not exist. Test: POST. Observable: 400, body.error names
//   "workflowRootPath". Expected value from design C7 ("not ... an existing
//   directory gets 400").
// - AC (Req 5 AC 4): pre-condition a temp repo and a separate, existing temp
//   directory as workflowRootPath. Test: POST with both fields and the
//   secret. Observable: 200 with a string projectId; readProjects() holds
//   one entry whose workspacePath and workflowRootPath are the realpath of
//   the repo and of the given directory. Expected value from design C7
//   ("calls addProjectByPath(projectPath, workflowRootPath)") and Req 5 AC 3
//   ("workspacePath is the repository's git top level ... workflowRootPath
//   is the store root").
// - AC (Req 5 AC 6, invariant — regression guard, not red-first: the base
//   route already behaves this way before this task's change). Test: POST
//   with only projectPath. Observable: 200 with exactly
//   { projectId, success: true }.
// - AC (access control, unchanged by this task — regression guard, not
//   red-first). Test: POST with projectPath and no Authorization header.
//   Observable: 401.

const realFetch: typeof fetch = globalThis.fetch;

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

function makeRepo(base: string, name: string): string {
  const repo = join(base, name);
  mkdirSync(repo, { recursive: true });
  execFileSync('git', ['-C', repo, 'init', '-q']);
  return repo;
}

describe('POST /api/projects/add (design C7)', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  let secret: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `projects-add-route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fsp.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = join(tempDir, '.xdg-state');
    process.env.SDD_HOME = join(tempDir, 'sdd-home');
    delete process.env.SDD_SLOTS;

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    secret = await loadOrCreateSecret();
    _resetMultiServerWarningsForTests();
  });

  afterEach(async () => {
    if (server) { await server.stop(); server = null; }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  function url(): string {
    return `http://127.0.0.1:${port}/api/projects/add`;
  }

  async function postJson(body: object, withAuth = true): Promise<{ status: number; body: any }> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (withAuth) headers.authorization = `Bearer ${secret}`;
    const res = await realFetch(url(), { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  }

  it('400s naming the field when workflowRootPath is not a string', async () => {
    const repo = makeRepo(tempDir, 'repo-non-string');
    const { status, body } = await postJson({ projectPath: repo, workflowRootPath: 42 });
    expect(status).toBe(400);
    expect(body.error).toContain('workflowRootPath');
  });

  it('400s naming the field when workflowRootPath is relative', async () => {
    const repo = makeRepo(tempDir, 'repo-relative');
    const { status, body } = await postJson({ projectPath: repo, workflowRootPath: 'relative/store' });
    expect(status).toBe(400);
    expect(body.error).toContain('workflowRootPath');
  });

  it('400s naming the field when workflowRootPath does not exist', async () => {
    const repo = makeRepo(tempDir, 'repo-missing-dir');
    const missing = join(tempDir, 'no-such-store-dir');
    const { status, body } = await postJson({ projectPath: repo, workflowRootPath: missing });
    expect(status).toBe(400);
    expect(body.error).toContain('workflowRootPath');
  });

  it('200s with projectId and remembers both paths for a valid workflowRootPath (Req 5 AC 4)', async () => {
    const repo = makeRepo(tempDir, 'repo-valid-store');
    const storeRoot = join(tempDir, 'separate-store');
    mkdirSync(storeRoot, { recursive: true });

    const { status, body } = await postJson({ projectPath: repo, workflowRootPath: storeRoot });
    expect(status).toBe(200);
    expect(typeof body.projectId).toBe('string');

    const remembered = await readProjects();
    expect(remembered.projects).toEqual([
      expect.objectContaining({
        id: body.projectId,
        workspacePath: realpathSync(repo),
        workflowRootPath: realpathSync(storeRoot),
      }),
    ]);
  });

  it('200s with the base shape when workflowRootPath is left out (Req 5 AC 6, invariant)', async () => {
    const repo = makeRepo(tempDir, 'repo-base-shape');
    const { status, body } = await postJson({ projectPath: repo });
    expect(status).toBe(200);
    expect(body).toEqual({ projectId: expect.any(String), success: true });
  });

  it('401s without the shared secret', async () => {
    const repo = makeRepo(tempDir, 'repo-no-secret');
    const { status } = await postJson({ projectPath: repo }, false);
    expect(status).toBe(401);
  });
});
