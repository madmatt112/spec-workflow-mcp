import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { loadOrCreateSecret } from '../../controller/access.js';
import { writeRun, writeRateLimit, type RunRecord } from '../../controller/state.js';
import { stepLogDir } from '../../controller/runs.js';

// Contract for the T10 dashboard routes (controller-tasks.md "T10 dashboard";
// controller-design.md §9, §4). Same shape as controller-waits-routes.test.ts:
// a real MultiProjectDashboardServer over fetch(), with temp SPEC_WORKFLOW_HOME,
// XDG_STATE_HOME and SDD_HOME so the real homes are untouched. The three routes:
// GET /api/controller/rate-limit, GET /api/controller/runs/:id/log, and the
// controller's Launch guards folded into GET /api/projects/:id/harness/setup.

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

function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 5000, intervalMs = 25): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (await predicate()) { resolve(); return; }
      if (Date.now() > deadline) { reject(new Error('waitFor: timed out')); return; }
      setTimeout(check, intervalMs);
    };
    void check();
  });
}

describe('controller dashboard routes (T10)', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  let secret: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `ctrl-dash-routes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stateHomeDir = join(tempDir, '.xdg-state');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;
    process.env.SDD_HOME = join(tempDir, '.sdd-home');

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });
  });

  afterEach(async () => {
    if (server) { await server.stop(); server = null; }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  async function startServer(): Promise<string> {
    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    // Controller routes require the shared secret even for a loopback GET
    // (access control, controller-design.md §17).
    secret = await loadOrCreateSecret();
    _resetMultiServerWarningsForTests();
    return `http://127.0.0.1:${port}`;
  }

  // Add the shared secret as a bearer header for the /api/controller/ routes.
  function auth(init: RequestInit = {}): RequestInit {
    return {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${secret}` },
    };
  }

  it('GET /api/controller/rate-limit returns null when absent, then the file once written', async () => {
    const base = await startServer();

    const first = await realFetch(`${base}/api/controller/rate-limit`, auth());
    expect(first.status).toBe(200);
    expect(await first.json()).toBeNull();

    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.42, resetsAt: '2026-10-12T15:00:00.000Z' },
      sevenDay: { utilization: 0.8, resetsAt: '2026-10-18T00:00:00.000Z' },
      updated: '2026-10-12T10:00:00.000Z',
    });

    const second = await realFetch(`${base}/api/controller/rate-limit`, auth());
    const body: any = await second.json();
    expect(body.fiveHour.utilization).toBe(0.42);
    expect(body.sevenDay.resetsAt).toBe('2026-10-18T00:00:00.000Z');
  });

  it('GET /api/controller/runs/:id/log returns the last N lines of the in-flight step log, and 404s for an unknown run', async () => {
    const base = await startServer();

    const specStore = join(tempDir, 'store');
    const spec = 'controller-dashboard';
    const run: RunRecord = {
      v: 1, id: 'run-log-1', project: 'proj-1', codeRoot: specStore, specStore, spec,
      worktree: specStore, branch: 'feat/x', status: 'running',
      inFlight: { id: 'drafter', pid: 999999, startTime: 0 },
      created: '2026-10-12T10:00:00.000Z', updated: '2026-10-12T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    await writeRun(run);

    const dir = stepLogDir(run.id);
    mkdirSync(dir, { recursive: true });
    const lines = Array.from({ length: 120 }, (_, i) => JSON.stringify({ type: 'line', n: i }));
    writeFileSync(join(dir, 'drafter.jsonl'), lines.join('\n') + '\n');

    const res = await realFetch(`${base}/api/controller/runs/${run.id}/log?tail=50`, auth());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const text = await res.text();
    const out = text.split('\n').filter((l) => l.length > 0);
    expect(out).toHaveLength(50);
    expect(out[out.length - 1]).toContain('"n":119');
    expect(out[0]).toContain('"n":70');

    const missing = await realFetch(`${base}/api/controller/runs/run-nope/log`, auth());
    expect(missing.status).toBe(404);
  });

  it("GET /harness/setup folds the controller's live-run guard into the disabled reason", async () => {
    // A registered project with one not-started spec so routing is `active`.
    const workspace = join(tempDir, 'workspace');
    const workflowRoot = join(tempDir, 'project');
    const spec = 'controller-dashboard';
    const specDir = join(workflowRoot, '.spec-workflow', 'specs', spec);
    mkdirSync(specDir, { recursive: true });
    // The workspace path must exist on disk, or the startup missing-path prune
    // (R4 AC1) drops the registration before the server lists it.
    mkdirSync(workspace, { recursive: true });
    writeFileSync(join(specDir, 'requirements.md'), '# Requirements\n\nDraft.\n');

    const registry = new ProjectRegistry();
    await registry.registerProject(workspace, process.pid, { workflowRootPath: workflowRoot });
    const projectId = generateProjectId(workspace);

    const base = await startServer();
    const setupUrl = `${base}/api/projects/${projectId}/harness/setup`;

    // The project is visible and the spec is launchable before any run.
    await waitFor(async () => {
      const r = await realFetch(setupUrl);
      if (!r.ok) return false;
      const v: any = await r.json();
      return v.launchable === spec;
    });

    // Seed a live (waiting) run on this store AFTER start, so the controller's
    // recovery does not drive it; the setup route must now disable launch.
    const run: RunRecord = {
      v: 1, id: 'run-live-1', project: projectId, codeRoot: workspace, specStore: workflowRoot, spec,
      worktree: workspace, branch: 'feat/x', status: 'waiting',
      created: '2026-10-12T10:00:00.000Z', updated: '2026-10-12T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    await writeRun(run);

    const res = await realFetch(setupUrl);
    const view: any = await res.json();
    expect(view.launchable).toBeNull();
    expect(view.disabledReason).toMatch(/queued or live run/i);
  });

  // Contract for task 6 (design C2, C7; run-pause requirements 1.1, 1.3, 1.4,
  // 1.5, 1.6, 4.6, 6.7, NFR Security). Pre-condition: a run paused for a usage
  // reason with a future resumeAt, and a done run, seeded after the server
  // starts so the live controller never drives them. Call through the seam:
  // fetch POST .../pause and GET /api/controller/runs. Observable result and
  // its source: 200 { ok: true } and a wire row with status paused,
  // pauseReason 'operator' (OPERATOR_PAUSE, design C1/C4) and pauseRequested
  // set, no resumeAt — design C4 pause() post-condition 2, C7's toRow copy;
  // the idempotent repeat's unchanged `updated` — design C4 post-condition 1
  // (Requirement 1 AC 5); 404 `run-not-found` and 409 `not-pausable` with an
  // unchanged record — design C2's three-way handler (Requirement 1 AC 3/4);
  // no path field on the row — NFR Security (`src/controller/runs.ts:1333-1334`
  // area, ControllerRunRow). The trailing 401 and resume-409 assertions are
  // regression guards (task 6 Note): makeRequireAccess already rejects every
  // non-GET under /api/controller/ with no secret, and resumeNow already
  // answers null for a done run (controller.test.ts:295); they hold at base.
  it('POST /api/controller/runs/:id/pause pauses, is idempotent, and 404s/409s; the row carries pauseRequested and no path', async () => {
    const base = await startServer();

    const specStore = join(tempDir, 'store');
    const spec = 'controller-dashboard';
    const resumeAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const usageRun: RunRecord = {
      v: 1, id: 'run-pause-usage', project: 'proj-1', codeRoot: specStore, specStore, spec,
      worktree: specStore, branch: 'feat/x', status: 'paused', pauseReason: 'usage-limit', resumeAt,
      created: '2026-10-29T10:00:00.000Z', updated: '2026-10-29T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    await writeRun(usageRun);

    const doneRun: RunRecord = {
      v: 1, id: 'run-pause-done', project: 'proj-1', codeRoot: specStore, specStore, spec,
      worktree: specStore, branch: 'feat/y', status: 'done',
      created: '2026-10-29T10:00:00.000Z', updated: '2026-10-29T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    await writeRun(doneRun);

    async function getRow(id: string): Promise<any> {
      const listRes = await realFetch(`${base}/api/controller/runs`, auth());
      const body: any = await listRes.json();
      return (body.runs as any[]).find((r) => r.id === id);
    }

    // AC1, AC5, AC7, NFR Security: pausing a usage-paused run replaces the
    // reason with `operator`, clears `resumeAt`, and the wire row carries
    // `pauseRequested` with no path field.
    const first = await realFetch(`${base}/api/controller/runs/${usageRun.id}/pause`, auth({ method: 'POST' }));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });

    const rowAfterFirst = await getRow(usageRun.id);
    expect(rowAfterFirst.status).toBe('paused');
    expect(rowAfterFirst.pauseReason).toBe('operator');
    expect(rowAfterFirst.pauseRequested).toBeTruthy();
    expect(rowAfterFirst.resumeAt).toBeUndefined();
    expect(rowAfterFirst.codeRoot).toBeUndefined();
    expect(rowAfterFirst.specStore).toBeUndefined();
    expect(rowAfterFirst.worktree).toBeUndefined();

    // AC5 (idempotent): a second pause answers 200 and writes nothing new.
    const second = await realFetch(`${base}/api/controller/runs/${usageRun.id}/pause`, auth({ method: 'POST' }));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true });
    const rowAfterSecond = await getRow(usageRun.id);
    expect(rowAfterSecond.updated).toBe(rowAfterFirst.updated);

    // AC3: no run has the id.
    const missing = await realFetch(`${base}/api/controller/runs/run-nope/pause`, auth({ method: 'POST' }));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'run-not-found' });

    // AC4: a terminal run is refused and left unchanged.
    const doneBefore = await getRow(doneRun.id);
    const terminal = await realFetch(`${base}/api/controller/runs/${doneRun.id}/pause`, auth({ method: 'POST' }));
    expect(terminal.status).toBe(409);
    expect(await terminal.json()).toEqual({ error: 'not-pausable' });
    const doneAfter = await getRow(doneRun.id);
    expect(doneAfter).toEqual(doneBefore);

    // Regression guards (hold at base; task 6 Note).
    const noAuth = await realFetch(`${base}/api/controller/runs/${usageRun.id}/pause`, { method: 'POST' });
    expect(noAuth.status).toBe(401);
    const resumeDone = await realFetch(`${base}/api/controller/runs/${doneRun.id}/resume`, auth({ method: 'POST' }));
    expect(resumeDone.status).toBe(409);
    expect(await resumeDone.json()).toEqual({ error: 'not-paused' });
  });
});
