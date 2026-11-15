import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { DeferralStorage } from '../../core/deferral-storage.js';
import { loadOrCreateSecret } from '../../controller/access.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';

// Contract for task 8 (design.md C7 "POST /api/projects/:projectId/deferrals
// /:deferralId/resolve", D19's check order; task 8 _Prompt; Requirements 7.4,
// 7.5, 7.6). Every test drives a real, locally-started
// MultiProjectDashboardServer through realFetch() against one registered
// project, with a temp SPEC_WORKFLOW_HOME/XDG_STATE_HOME/SDD_HOME. Fixture
// records are seeded through the real DeferralStorage (the pattern of
// shell-routes.test.ts:324-332), never mocked. The pre-existing `openId`
// record is read back for byte-identity after every error case, folding
// the task's "each error case leaves the record file bytes unchanged"
// clause into each error test below rather than a standalone test.
//
// Criterion "a valid request answers 200 { ok: true } and the record file
// holds status: resolved, the trimmed text as resolution and a resolvedAt"
// (task 8 Success; Requirement 7.4):
//   Pre-condition: a registered project with one `deferred` record (openId).
//   Test: POST .../deferrals/<openId>/resolve { resolution: '  Fixed in spec
//   X.  ' }.
//   Observable result: 200 { ok: true }; storage.get(openId) afterward has
//   status 'resolved', resolution 'Fixed in spec X.' (trimmed), and a
//   non-null resolvedAt.
//   Expected-value source: design C7 interface line and Requirement 7.4's
//   literal field list.
//
// Criterion "a 2,000-character resolution is accepted" (task 8 Success;
// Requirement 7.5's boundary):
//   Pre-condition: same fixture, a fresh deferred record.
//   Test: POST with a 2,000-character resolution string.
//   Observable result: 200; storage.get afterward has a resolution of length
//   2,000.
//   Expected-value source: the literal "2,000" boundary in Requirement 7.5
//   and the task 8 _Prompt Success line.
//
// Criteria "an empty / whitespace-only / non-string / 2,001-character
// resolution each answer 400" (task 8 Success; Requirement 7.5) — four
// separate tests, each folding "writes nothing" (task 8 Success) by reading
// openId's file bytes before and after:
//   Pre-condition (each): same fixture.
//   Test (each): POST with the named bad `resolution` value.
//   Observable result (each): 400 { error: 'invalid-resolution' }; openId's
//   file bytes are unchanged.
//   Expected-value source: design C7 check 1's literal 400 body; Requirement
//   7.5's "empty or longer than 2,000 characters".
//
// Criteria "an unknown project, an unknown id and an id holding an encoded
// slash each answer 404 with an error" (task 8 Success; Requirement 7.6) —
// three separate tests (design C7 checks 2, 4 and 3 respectively), each
// folding "writes nothing" by reading openId's file bytes before and after:
//   Pre-condition (each): same fixture.
//   Test (unknown project): POST to a project id that was never registered.
//   Test (unknown id): POST to the known project with deferral id
//   'does-not-exist'.
//   Test (encoded slash): POST to the known project with deferral id
//   encodeURIComponent(`${openId}/x`) (a literal '/' percent-encoded so it
//   reaches the route param as one segment, the pattern of
//   shell-routes.test.ts:397-407).
//   Observable result (each): 404 with the design C7 literal error body
//   ('Project not found' / 'Deferral not found' / 'Deferral not found');
//   openId's file bytes are unchanged.
//   Expected-value source: design C7 checks 2-4's literal error bodies.
//
// Criterion "an already resolved record answers 409 naming its status"
// (task 8 Success; Requirement 7.6), folding "writes nothing" by reading
// the record's own file bytes before and after:
//   Pre-condition: a record already resolved via the real
//   DeferralStorage.resolve (design C7 check 5).
//   Test: POST .../deferrals/<resolvedId>/resolve with a valid resolution.
//   Observable result: 409 { error: 'Deferral <resolvedId> is already
//   resolved' }; the record's file bytes are unchanged.
//   Expected-value source: design C7 check 5's literal error template.
//
// Criterion "a corrupt record file answers 409 with the reindex message"
// (task 8 Success; Requirement 7.6), folding "writes nothing" by reading the
// record's own file bytes before and after:
//   Pre-condition: a record file written with no parseable frontmatter
//   (design C7 check 4's second branch).
//   Test: POST .../deferrals/<corruptId>/resolve with a valid resolution.
//   Observable result: 409 with the exact reindex message of
//   src/core/deferral-storage.ts:196-199; the file bytes are unchanged.
//   Expected-value source: design C7 check 4 ("409 with the reindex message
//   of src/core/deferral-storage.ts:196-199") and that message's literal text.

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

describe('POST /api/projects/:projectId/deferrals/:deferralId/resolve (task 8)', () => {
  let tempDir: string;
  let workflowRoot: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  let projectId: string;
  let secret: string;
  let storage: DeferralStorage;
  let openId: string;
  let openFilePath: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `deferral-resolve-route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stateHomeDir = join(tempDir, '.xdg-state');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;
    process.env.SDD_HOME = join(tempDir, '.sdd-home');

    const workspace = join(tempDir, 'workspace');
    // The workspace path must exist on disk, or the startup missing-path
    // prune drops the registration before the server lists it.
    await fsp.mkdir(workspace, { recursive: true });
    workflowRoot = join(tempDir, 'project');

    const registry = new ProjectRegistry();
    await registry.registerProject(workspace, process.pid, { workflowRootPath: workflowRoot });
    projectId = generateProjectId(workspace);

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    secret = await loadOrCreateSecret();
    _resetMultiServerWarningsForTests();

    storage = new DeferralStorage(workflowRoot);
    openId = await storage.create({
      title: 'An open item',
      originSpec: null,
      originPhase: null,
      revisitTrigger: 'later',
      tags: [],
      supersedes: null,
      body: { context: 'ctx', decision: 'dec', revisitCriteria: 'crit' },
    });
    openFilePath = join(workflowRoot, '.spec-workflow', 'deferrals', `${openId}.md`);
  });

  afterEach(async () => {
    if (server) { await server.stop(); server = null; }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  function resolveUrl(id: string, projId: string = projectId): string {
    return `http://127.0.0.1:${port}/api/projects/${projId}/deferrals/${id}/resolve`;
  }

  function auth(init: RequestInit = {}): RequestInit {
    return {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${secret}` },
    };
  }

  async function post(id: string, body: unknown, projId: string = projectId): Promise<Response> {
    return realFetch(resolveUrl(id, projId), auth({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }));
  }

  it('answers 200 and writes status, resolution and resolvedAt', async () => {
    const res = await post(openId, { resolution: '  Fixed in spec X.  ' });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body).toEqual({ ok: true });

    const updated = await storage.get(openId);
    expect(updated?.status).toBe('resolved');
    expect(updated?.resolution).toBe('Fixed in spec X.');
    expect(updated?.resolvedAt).not.toBeNull();
  });

  it('accepts a 2,000-character resolution', async () => {
    const text = 'x'.repeat(2000);
    const res = await post(openId, { resolution: text });
    expect(res.status).toBe(200);

    const updated = await storage.get(openId);
    expect(updated?.resolution).toHaveLength(2000);
  });

  it('answers 400 and writes nothing for an empty resolution', async () => {
    const before = await fsp.readFile(openFilePath, 'utf-8');
    const res = await post(openId, { resolution: '' });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBe('invalid-resolution');
    expect(await fsp.readFile(openFilePath, 'utf-8')).toBe(before);
  });

  it('answers 400 and writes nothing for a whitespace-only resolution', async () => {
    const before = await fsp.readFile(openFilePath, 'utf-8');
    const res = await post(openId, { resolution: '   \n\t  ' });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBe('invalid-resolution');
    expect(await fsp.readFile(openFilePath, 'utf-8')).toBe(before);
  });

  it('answers 400 and writes nothing for a non-string resolution', async () => {
    const before = await fsp.readFile(openFilePath, 'utf-8');
    const res = await post(openId, { resolution: 12345 });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBe('invalid-resolution');
    expect(await fsp.readFile(openFilePath, 'utf-8')).toBe(before);
  });

  it('answers 400 and writes nothing for a 2,001-character resolution', async () => {
    const before = await fsp.readFile(openFilePath, 'utf-8');
    const text = 'x'.repeat(2001);
    const res = await post(openId, { resolution: text });
    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.error).toBe('invalid-resolution');
    expect(await fsp.readFile(openFilePath, 'utf-8')).toBe(before);
  });

  it('answers 404 with an error and writes nothing for an unknown project', async () => {
    const before = await fsp.readFile(openFilePath, 'utf-8');
    const res = await post(openId, { resolution: 'valid text' }, 'does-not-exist');
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body).toEqual({ error: 'Project not found' });
    expect(await fsp.readFile(openFilePath, 'utf-8')).toBe(before);
  });

  it('answers 404 with an error and writes nothing for an unknown id', async () => {
    const before = await fsp.readFile(openFilePath, 'utf-8');
    const res = await post('does-not-exist', { resolution: 'valid text' });
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body).toEqual({ error: 'Deferral not found' });
    expect(await fsp.readFile(openFilePath, 'utf-8')).toBe(before);
  });

  it('answers 404 with an error and writes nothing for an id holding an encoded slash', async () => {
    const before = await fsp.readFile(openFilePath, 'utf-8');
    const res = await post(encodeURIComponent(`${openId}/x`), { resolution: 'valid text' });
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body).toEqual({ error: 'Deferral not found' });
    expect(await fsp.readFile(openFilePath, 'utf-8')).toBe(before);
  });

  it('answers 409 naming the status and writes nothing for an already resolved record', async () => {
    const resolvedId = await storage.create({
      title: 'Already resolved',
      originSpec: null,
      originPhase: null,
      revisitTrigger: 'later',
      tags: [],
      supersedes: null,
      body: { context: 'ctx', decision: 'dec', revisitCriteria: 'crit' },
    });
    await storage.resolve(resolvedId, 'first resolution');
    const filePath = join(workflowRoot, '.spec-workflow', 'deferrals', `${resolvedId}.md`);
    const before = await fsp.readFile(filePath, 'utf-8');

    const res = await post(resolvedId, { resolution: 'second attempt' });
    expect(res.status).toBe(409);
    const body: any = await res.json();
    expect(body).toEqual({ error: `Deferral ${resolvedId} is already resolved` });
    expect(await fsp.readFile(filePath, 'utf-8')).toBe(before);
  });

  it('answers 409 with the reindex message and writes nothing for a corrupt record file', async () => {
    const corruptId = 'd-corrupt1';
    const filePath = join(workflowRoot, '.spec-workflow', 'deferrals', `${corruptId}.md`);
    await fsp.writeFile(filePath, 'not a parseable deferral file\n', 'utf-8');
    const before = await fsp.readFile(filePath, 'utf-8');

    const res = await post(corruptId, { resolution: 'valid text' });
    expect(res.status).toBe(409);
    const body: any = await res.json();
    expect(body).toEqual({
      error: `Deferral ${corruptId} exists on disk but its frontmatter could not be parsed. ` +
        `Run the deferrals 'reindex' action to normalize the store, then retry.`,
    });
    expect(await fsp.readFile(filePath, 'utf-8')).toBe(before);
  });
});
