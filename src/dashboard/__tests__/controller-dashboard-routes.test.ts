import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp, mkdirSync, writeFileSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { loadOrCreateSecret } from '../../controller/access.js';
import { writeRun, readRun, writeJsonAtomic, type RunRecord, writeRateLimit } from '../../controller/state.js';
import { stepLogDir } from '../../controller/runs.js';
import { createWait, DRIVE_CRASH_QUESTION } from '../../controller/waits.js';
import { deployRecordPath, readDeployRecord, type DeployUnit, type UnitState } from '../../controller/deploy.js';

const STUB_CLAUDE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'stub-claude.mjs');

/** A generic one-run script for the claude stub (task 9 restriction: every test
 * that starts a drive sets CONTROLLER_CLAUDE_BIN to this stub with a script, so
 * no real `claude` ever spawns). `delayMs` keeps the stub process (and so
 * `inFlight`) alive long enough to observe `driven: true` before it exits. */
function writeClaudeScript(path: string, delayMs = 0): void {
  writeFileSync(path, JSON.stringify([{
    result: {
      subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'ok',
      structured_output: {}, usage: {},
    },
    delayMs,
  }]));
}

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

  // `unit` (task 9): every test that presses or cancels a deploy passes a
  // fake `DeployUnit` here, so the live controller's own 1-second tick can
  // never shell out to a real `systemd-run`/`systemctl`.
  async function startServer(unit?: DeployUnit): Promise<string> {
    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port, ...(unit ? { deployUnit: unit } : {}) });
    await server.start();
    // Controller routes require the shared secret even for a loopback GET
    // (access control, controller-design.md §17).
    secret = await loadOrCreateSecret();
    _resetMultiServerWarningsForTests();
    return `http://127.0.0.1:${port}`;
  }

  // A stateful fake unit (task 9 Restrictions): `live` starts at `initialLive`
  // and only changes on `start`/`stop`, so a record left at a non-`wait`
  // stage never looks unit-gone to the controller's own tick while a test is
  // mid-flight (design C1 "tick": a non-`wait` stage with the unit gone is
  // written `failed` at once).
  function fakeDeployUnit(initialLive = false): DeployUnit {
    let live = initialLive;
    return {
      async start() { live = true; },
      async state(): Promise<UnitState> { return live ? 'live' : 'gone'; },
      async stop() { live = false; },
    };
  }

  // Add the shared secret as a bearer header for the /api/controller/ routes.
  function auth(init: RequestInit = {}): RequestInit {
    return {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${secret}` },
    };
  }

  // Register a project whose spec is the one launchable thing on disk, via a
  // HANDOFF naming it in progress (as the GET /harness/setup test above
  // does). The registration must land on disk before the server (and so its
  // ProjectManager) starts, as every other registered-project test in this
  // suite family does.
  async function prepareLaunchableProject(spec: string): Promise<string> {
    const workspace = join(tempDir, `ws-${spec}`);
    const workflowRoot = join(tempDir, `proj-${spec}`);
    const specDir = join(workflowRoot, '.spec-workflow', 'specs', spec);
    await fsp.mkdir(specDir, { recursive: true });
    await fsp.mkdir(workspace, { recursive: true });
    writeFileSync(join(workflowRoot, '.spec-workflow', 'HANDOFF.md'), [
      `> **READ FIRST — SDD routing.** Active spec **\`${spec}\`**.`,
      '> Live phase **document**, state **in-progress**, last result **gate-a**.',
      '',
    ].join('\n'));

    const registry = new ProjectRegistry();
    await registry.registerProject(workspace, process.pid, { workflowRootPath: workflowRoot });
    return generateProjectId(workspace);
  }

  async function launchViaRoute(base: string, projectId: string, spec: string): Promise<string> {
    const res = await realFetch(`${base}/api/projects/${projectId}/harness/launch`, auth({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        spec, supervisorModel: 'claude-opus-5-5', worktree: 'no', gates: 'block', roles: {},
      }),
    }));
    const body: any = await res.json();
    if (res.status !== 200) throw new Error(`launch failed: ${res.status} ${JSON.stringify(body)}`);
    return body.runId as string;
  }

  /** Poll `readRun` until `inFlight` is set, so a scripted drive is caught mid-step. */
  async function waitForInFlight(id: string, ms = 5000): Promise<RunRecord> {
    const deadline = Date.now() + ms;
    for (;;) {
      const run = await readRun(id);
      if (run?.inFlight) return run;
      if (Date.now() > deadline) throw new Error(`run ${id} never went in flight`);
      await new Promise((r) => setTimeout(r, 25));
    }
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

  // Contract for task 19 (design C6; R2 AC 2). Pre-condition: a real run on
  // disk with an in-flight step log (the exact fixture the deleted log route
  // used to serve). Test: GET the log route for that run, and GET a
  // sibling path under the same /api/controller/ prefix that no route
  // matches. Observable result: both answer with the same status and the
  // same fastify not-found error/statusCode fields (the `message` field is
  // excluded because it echoes the request path, not the route's shape).
  // Expected-value source: the route being gone leaves fastify's own
  // default not-found handling as the only answer, identical for any
  // unmatched /api/controller/ path.
  it('GET /api/controller/runs/:id/log answers exactly as an unknown control path under /api does', async () => {
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
    const unknown = await realFetch(`${base}/api/controller/runs/${run.id}/does-not-exist`, auth());

    expect(res.status).toBe(unknown.status);
    const resBody: any = await res.json();
    const unknownBody: any = await unknown.json();
    expect(resBody.statusCode).toBe(unknownBody.statusCode);
    expect(resBody.error).toBe(unknownBody.error);
  });

  // Contract for task 19 (design C6; R2 AC 2). Pre-condition: a real
  // registered project with a spec directory on disk (the exact fixture the
  // deleted summary route used to serve). Test: GET the summary route for
  // that project/spec, and GET a sibling path under the same project/spec
  // prefix that no route matches. Observable result and expected-value
  // source: same as the log-route criterion above — identical status and
  // not-found shape, because the route is gone and fastify answers both
  // the same way.
  it('GET /api/projects/:projectId/specs/:specName/task-reviews/summary answers exactly as an unknown control path under /api does', async () => {
    const spec = 'controller-dashboard';
    const projectId = await prepareLaunchableProject(spec);
    const base = await startServer();

    const res = await realFetch(`${base}/api/projects/${projectId}/specs/${spec}/task-reviews/summary`);
    const unknown = await realFetch(`${base}/api/projects/${projectId}/specs/${spec}/does-not-exist`);

    expect(res.status).toBe(unknown.status);
    const resBody: any = await res.json();
    const unknownBody: any = await unknown.json();
    expect(resBody.statusCode).toBe(unknownBody.statusCode);
    expect(resBody.error).toBe(unknownBody.error);
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

  // Contract for task 9 (design C7, C4, C5 "redrive"; Requirements 2.1, 3.1,
  // 3.2, 3.3, 3.4, 3.5). Per success criterion in the task 9 _Prompt. Every
  // test that starts a drive points CONTROLLER_CLAUDE_BIN at the stub with a
  // script (the task's own restriction), so no real `claude` ever spawns.
  describe('POST /api/controller/runs/:id/redrive and GET /api/controller/runs (driven) — task 9', () => {
    // (a): an unknown id. Pre: no such run. Call: POST .../redrive. Result:
    // 404 { error: 'run-not-found' }. Source: design C7 "not-found" -> 404;
    // Requirement 3 AC 2.
    it('(a) an unknown run answers 404 run-not-found', async () => {
      const base = await startServer();
      const res = await realFetch(`${base}/api/controller/runs/run-nope/redrive`, auth({ method: 'POST' }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'run-not-found' });
    });

    // (b): a currently-driven run. Pre: a run launched through the real
    // harness launch route, scripted with a delayed stub step and polled
    // until `inFlight` is set (so `controller.drivenRuns()` holds its id).
    // Call: POST .../redrive while it is in flight. Result: 409
    // { error: 'not-stalled' }, with `updated` unchanged. Source: design C5
    // "redrive" post-condition 2 via C7's 409 mapping; Requirement 3 AC 5.
    it('(b) a driven run answers 409 not-stalled and changes nothing', async () => {
      const projectId = await prepareLaunchableProject('ctrl-redrive-b');
      const base = await startServer();
      chmodSync(STUB_CLAUDE, 0o755);
      const scriptPath = join(tempDir, 'claude-script-b.json');
      writeClaudeScript(scriptPath, 800);
      process.env.CONTROLLER_CLAUDE_BIN = STUB_CLAUDE;
      process.env.STUB_CLAUDE_SCRIPT = scriptPath;

      const runId = await launchViaRoute(base, projectId, 'ctrl-redrive-b');
      const before = await waitForInFlight(runId);

      const res = await realFetch(`${base}/api/controller/runs/${runId}/redrive`, auth({ method: 'POST' }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'not-stalled' });

      const after = await readRun(runId);
      expect(after?.updated).toBe(before.updated);
    }, 15000);

    // (c): a done run. Pre: a `done` run written directly to disk. Call:
    // POST .../redrive. Result: 409 { error: 'not-stalled' }, record
    // unchanged. Source: design C5 "redrive" post-condition 5 via C7's 409
    // mapping; Requirement 3 AC 5.
    it('(c) a done run answers 409 not-stalled and changes nothing', async () => {
      const base = await startServer();
      const specStore = join(tempDir, 'store-c');
      const spec = 'ctrl-redrive-c';
      const id = 'run-redrive-done';
      const iso = '2026-11-03T10:00:00.000Z';
      await writeRun({
        v: 1, id, project: 'proj-1', codeRoot: specStore, specStore, spec,
        worktree: specStore, branch: 'feat/x', status: 'done', created: iso, updated: iso,
        tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      });

      const res = await realFetch(`${base}/api/controller/runs/${id}/redrive`, auth({ method: 'POST' }));
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'not-stalled' });

      const after = await readRun(id);
      expect(after?.status).toBe('done');
      expect(after?.updated).toBe(iso);
    });

    // (d): a stalled `running` run. Pre: a `running` record written directly
    // to disk after the server (and so its controller's recovery) started, so
    // it is genuinely undriven. Call: POST .../redrive. Result: 200
    // { ok: true }. Source: design C5 "redrive" post-condition 3 via C7's 200
    // mapping; Requirement 3 AC 3.
    it('(d) a stalled running run answers 200 ok and starts a drive', async () => {
      const base = await startServer();
      chmodSync(STUB_CLAUDE, 0o755);
      const scriptPath = join(tempDir, 'claude-script-d.json');
      writeClaudeScript(scriptPath, 300);
      process.env.CONTROLLER_CLAUDE_BIN = STUB_CLAUDE;
      process.env.STUB_CLAUDE_SCRIPT = scriptPath;

      const specStore = join(tempDir, 'store-d');
      const spec = 'ctrl-redrive-d';
      mkdirSync(join(specStore, '.spec-workflow', 'specs', spec), { recursive: true });
      const id = 'run-redrive-stalled';
      const iso = '2026-11-03T10:00:00.000Z';
      await writeRun({
        v: 1, id, project: 'proj-1', codeRoot: specStore, specStore, spec,
        worktree: specStore, branch: 'feat/x', status: 'running', created: iso, updated: iso,
        tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      });

      const res = await realFetch(`${base}/api/controller/runs/${id}/redrive`, auth({ method: 'POST' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    // (e): a run `waiting` on an open drive-crash wait. Pre: a `waiting`
    // record and an open `error` wait carrying the `DRIVE_CRASH_QUESTION`
    // question, both written directly after the server started. Call: POST
    // .../redrive. Result: 200 { ok: true }. Source: design C5 "redrive"
    // post-condition 4 via C7's 200 mapping; Requirement 3 AC 4.
    it('(e) a run waiting on an open drive-crash wait answers 200 ok', async () => {
      const base = await startServer();
      chmodSync(STUB_CLAUDE, 0o755);
      const scriptPath = join(tempDir, 'claude-script-e.json');
      writeClaudeScript(scriptPath, 300);
      process.env.CONTROLLER_CLAUDE_BIN = STUB_CLAUDE;
      process.env.STUB_CLAUDE_SCRIPT = scriptPath;

      const specStore = join(tempDir, 'store-e');
      const spec = 'ctrl-redrive-e';
      const specDir = join(specStore, '.spec-workflow', 'specs', spec);
      mkdirSync(specDir, { recursive: true });
      const id = 'run-redrive-crash-wait';
      const iso = '2026-11-03T10:00:00.000Z';
      await writeRun({
        v: 1, id, project: 'proj-1', codeRoot: specStore, specStore, spec,
        worktree: specStore, branch: 'feat/x', status: 'waiting', created: iso, updated: iso,
        tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      });
      await createWait({
        kind: 'error', runId: id, projectId: 'proj-1', spec, specDir,
        questions: [{
          id: DRIVE_CRASH_QUESTION, text: 'step drafter failed inside the controller: boom',
          options: ['retry', 'abandon'], recommended: 'retry',
        }],
      });

      const res = await realFetch(`${base}/api/controller/runs/${id}/redrive`, auth({ method: 'POST' }));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    // (f): a run the controller is currently driving. Pre: the same
    // launched-and-polled-in-flight setup as (b). Call: GET
    // /api/controller/runs. Result: the row for that id reads `driven: true`.
    // Source: design C4 "the GET route ... calls listRunsForWire(this
    // .controller.drivenRuns())"; Requirement 2 AC 1.
    it('(f) the GET row reads driven: true for a run the controller is driving', async () => {
      const projectId = await prepareLaunchableProject('ctrl-redrive-f');
      const base = await startServer();
      chmodSync(STUB_CLAUDE, 0o755);
      const scriptPath = join(tempDir, 'claude-script-f.json');
      writeClaudeScript(scriptPath, 800);
      process.env.CONTROLLER_CLAUDE_BIN = STUB_CLAUDE;
      process.env.STUB_CLAUDE_SCRIPT = scriptPath;

      const runId = await launchViaRoute(base, projectId, 'ctrl-redrive-f');
      await waitForInFlight(runId);

      const listRes = await realFetch(`${base}/api/controller/runs`, auth());
      const body: any = await listRes.json();
      const row = (body.runs as any[]).find((r) => r.id === runId);
      expect(row?.driven).toBe(true);
    }, 15000);

    // (g) regression guard: an undriven run. Pre: a `running` record written
    // directly to disk after the server started (so recovery never touched
    // it, and it starts no step of its own). Call: GET
    // /api/controller/runs. Result: the row for that id reads
    // `driven: false`. Source: design C4 "driven: driven.has(run.id)" with an
    // id outside the set; Requirement 2 AC 1. This already holds at base
    // (task 6 wires the GET route with no caller passing a set, so every row
    // reads false); written here as the regression guard the real wiring
    // must not break.
    it('(g) regression guard: an undriven run reads driven: false on the GET row', async () => {
      const base = await startServer();
      const specStore = join(tempDir, 'store-g');
      const spec = 'ctrl-redrive-g';
      const id = 'run-redrive-undriven';
      const iso = '2026-11-03T10:00:00.000Z';
      await writeRun({
        v: 1, id, project: 'proj-1', codeRoot: specStore, specStore, spec,
        worktree: specStore, branch: 'feat/x', status: 'running', created: iso, updated: iso,
        tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      });

      const listRes = await realFetch(`${base}/api/controller/runs`, auth());
      const body: any = await listRes.json();
      const row = (body.runs as any[]).find((r) => r.id === id);
      expect(row?.driven).toBe(false);
    });

    // (i) regression guard: no secret. Pre: a started server, no run needed.
    // Call: POST .../redrive with no Authorization header. Result: 401.
    // Source: the app-level `onRequest` access-control hook
    // (`makeRequireAccess`, installed before every route) already rejects
    // every non-GET under /api/controller/ with no secret; holds at base.
    it('(i) regression guard: POST redrive with no secret answers 401', async () => {
      const base = await startServer();
      const res = await realFetch(`${base}/api/controller/runs/anything/redrive`, { method: 'POST' });
      expect(res.status).toBe(401);
    });
  });

  // Contract for task 9 (design C6; Requirements 1.1, 1.8, 1.9, 3.8, 4.8,
  // 5.1, 5.3, NFR Security). Per success criterion in the task 9 _Prompt.
  // Every test that presses or cancels passes a fake `DeployUnit` through
  // `startServer`, so no test can start a real `systemd-run`.
  describe('POST /api/controller/deploy and /api/controller/deploy/cancel — task 9', () => {
    // Pre: no open record. Call: fetch POST .../deploy. Result: 202
    // { ok: true } and `deploy.json` written with stage 'wait'. Source:
    // design C6 "202 { ok: true }"; controller `pressDeploy` -> coordinator
    // `press`; Requirement 1 AC 1.
    it('a press with no open record answers 202 ok and writes deploy.json', async () => {
      const base = await startServer(fakeDeployUnit());

      const res = await realFetch(`${base}/api/controller/deploy`, auth({ method: 'POST' }));

      expect(res.status).toBe(202);
      expect(await res.json()).toEqual({ ok: true });
      const record = await readDeployRecord();
      expect(record?.stage).toBe('wait');
    });

    // Pre: a record already open at 'wait' from a first press. Call: a
    // second fetch POST .../deploy. Result: 409 { error: 'deploy-open',
    // stage: 'wait' }. Source: design C6 "409 { error: 'deploy-open',
    // stage }"; Requirement 1 AC 8.
    it('a press with an open record answers 409 deploy-open with the stage', async () => {
      const base = await startServer(fakeDeployUnit());

      const first = await realFetch(`${base}/api/controller/deploy`, auth({ method: 'POST' }));
      expect(first.status).toBe(202);

      const second = await realFetch(`${base}/api/controller/deploy`, auth({ method: 'POST' }));

      expect(second.status).toBe(409);
      expect(await second.json()).toEqual({ error: 'deploy-open', stage: 'wait' });
    });

    // Pre: no open record. Call: two concurrent fetch POSTs .../deploy.
    // Result: exactly one 202 and one 409 deploy-open. Source: design C6
    // routes over the coordinator's one lock; Requirement 1 AC 9.
    it('two presses together give one 202 and one 409 deploy-open', async () => {
      const base = await startServer(fakeDeployUnit());

      const [a, b] = await Promise.all([
        realFetch(`${base}/api/controller/deploy`, auth({ method: 'POST' })),
        realFetch(`${base}/api/controller/deploy`, auth({ method: 'POST' })),
      ]);

      expect([a.status, b.status].sort()).toEqual([202, 409]);
      const open = a.status === 409 ? a : b;
      expect(await open.json()).toEqual({ error: 'deploy-open', stage: 'wait' });
    });

    // Pre: a record written directly at stage 'build', `unitStarted: false`,
    // with a fake unit left `live` so the controller's own tick never marks
    // it `failed` first. Call: fetch POST .../deploy/cancel. Result: 200
    // { ok: true } and the record removed. Source: design C6 "200
    // { ok: true }"; coordinator `cancel`'s stop path (the fake unit's
    // `live` state makes `shouldStop` true; `stop` then takes it gone, so no
    // 500 and the record removal proceeds); Requirement 5 AC 1.
    it('a cancel at build answers 200 ok and removes the record', async () => {
      const unit = fakeDeployUnit(true);
      const base = await startServer(unit);
      await writeJsonAtomic(deployRecordPath(), {
        v: 1, stage: 'build', runs: [], started: new Date().toISOString(), unitStarted: false,
      });

      const res = await realFetch(`${base}/api/controller/deploy/cancel`, auth({ method: 'POST' }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(await readDeployRecord()).toBeUndefined();
    });

    // Pre: no record. Call: fetch POST .../deploy/cancel. Result: 404
    // { error: 'no-deploy' }. Source: design C6 "404 { error: 'no-deploy' }";
    // coordinator `cancel`'s `{ status: 404 }" mapped by the route;
    // Requirement 5 AC 3 ("no record exists").
    it('a cancel with no record answers 404 no-deploy', async () => {
      const base = await startServer(fakeDeployUnit());

      const res = await realFetch(`${base}/api/controller/deploy/cancel`, auth({ method: 'POST' }));

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'no-deploy' });
    });

    // Pre: a record written directly at stage 'swap', with a fake unit left
    // `live` so the tick never touches it. Call: fetch POST
    // .../deploy/cancel. Result: 409 { error: 'deploy-past-swap',
    // stage: 'swap' }, record unchanged. Source: design C6 "409
    // { error: 'deploy-past-swap', stage }"; Requirement 5 AC 3.
    it('a cancel at swap answers 409 deploy-past-swap with the stage, changing nothing', async () => {
      const base = await startServer(fakeDeployUnit(true));
      await writeJsonAtomic(deployRecordPath(), {
        v: 1, stage: 'swap', runs: [], started: new Date().toISOString(),
      });

      const res = await realFetch(`${base}/api/controller/deploy/cancel`, auth({ method: 'POST' }));

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'deploy-past-swap', stage: 'swap' });
      expect((await readDeployRecord())?.stage).toBe('swap');
    });

    // Pre: the server's controller stubbed so `cancelDeploy` resolves the
    // stop-timeout outcome without the real 30-second wait. Call: fetch POST
    // .../deploy/cancel. Result: 500 { error: 'deploy-stop-failed' }.
    // Source: design C6 "500 { error: 'deploy-stop-failed' }"; task 9
    // Restrictions ("the 500 case stubs the controller's cancel on the test
    // server, because the real limit is 30 seconds").
    it('a stubbed stop failure answers 500 deploy-stop-failed', async () => {
      const base = await startServer(fakeDeployUnit());
      (server as any).controller.cancelDeploy = async () => ({ status: 500, error: 'deploy-stop-failed' });

      const res = await realFetch(`${base}/api/controller/deploy/cancel`, auth({ method: 'POST' }));

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'deploy-stop-failed' });
    });

    // Pre: a run written directly to disk, after the server started, with
    // `holdBy: 'deploy'` and `pauseRequested` set. Call: fetch POST
    // .../runs/:id/resume. Result: 409 { error: 'deploy-open' }, run
    // unchanged. Source: task 9 _Prompt ("Map the sentinel task 6 adds to
    // 409 { error: 'deploy-open' } in the resume route"); controller
    // `resumeNow` already answers the `'deploy-open'` sentinel for a
    // deploy-held run (`src/controller/controller.ts:343-345`); Requirement
    // 4 AC 8.
    it('a resume on a deploy-held run answers 409 deploy-open and changes nothing', async () => {
      const base = await startServer(fakeDeployUnit());
      const iso = '2026-11-05T10:00:00.000Z';
      const run: RunRecord = {
        v: 1, id: 'run-deploy-held', project: 'proj-1', codeRoot: '/c', specStore: '/s', spec: 's',
        worktree: '/w', branch: 'feat/x', status: 'queued', holdBy: 'deploy', pauseRequested: iso,
        created: iso, updated: iso, tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      };
      await writeRun(run, { ownsPauseRequest: true });
      const before = await readRun(run.id);

      const res = await realFetch(`${base}/api/controller/runs/${run.id}/resume`, auth({ method: 'POST' }));

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'deploy-open' });
      expect(await readRun(run.id)).toEqual(before);
    });

    // Regression guard (task 9 Note): the global `onRequest` access-control
    // hook already 401s any mutating `/api/controller/` request with no
    // bearer, for any path under that prefix, whether or not a handler is
    // registered for it; holds at base.
    it('(regression guard) both new deploy routes answer 401 with no bearer', async () => {
      const base = await startServer();

      const pressNoAuth = await realFetch(`${base}/api/controller/deploy`, { method: 'POST' });
      expect(pressNoAuth.status).toBe(401);

      const cancelNoAuth = await realFetch(`${base}/api/controller/deploy/cancel`, { method: 'POST' });
      expect(cancelNoAuth.status).toBe(401);
    });

    // Pre: a record written directly at stage 'restart', before the server
    // starts. Call: construct the server with `smoke: true` and `start()`
    // it. Result: the record is still at `restart` after start (the
    // controller never ran its deploy `onStart`, which would otherwise move
    // a `restart`/`done` record to `done`). Source: design C3
    // "`deployDisabled`, `start()` skips `onStart`"; task 9 _Prompt ("The
    // disabled option is true when `smoke` is set"); Requirement 3 AC 8.
    it('a server with smoke: true leaves a seeded restart record at restart after start', async () => {
      await writeJsonAtomic(deployRecordPath(), {
        v: 1, stage: 'restart', runs: [], started: new Date().toISOString(),
      });
      port = await getFreePort();
      server = new MultiProjectDashboardServer({ port, smoke: true, deployUnit: fakeDeployUnit() });

      await server.start();

      expect((await readDeployRecord())?.stage).toBe('restart');
    });

    // Pre: a record written directly at stage 'restart', before the server
    // starts, and `SDD_DEPLOY_DISABLED=1` in the environment. Call:
    // construct the server with no `smoke` option and `start()` it. Result:
    // the record is still at `restart` after start. Source: task 9 _Prompt
    // ("or `process.env.SDD_DEPLOY_DISABLED` is `1`"); Requirement 3 AC 8.
    it('a server with SDD_DEPLOY_DISABLED=1 leaves a seeded restart record at restart after start', async () => {
      process.env.SDD_DEPLOY_DISABLED = '1';
      await writeJsonAtomic(deployRecordPath(), {
        v: 1, stage: 'restart', runs: [], started: new Date().toISOString(),
      });
      port = await getFreePort();
      server = new MultiProjectDashboardServer({ port, deployUnit: fakeDeployUnit() });

      await server.start();

      expect((await readDeployRecord())?.stage).toBe('restart');
    });
  });

  // Source: task 4 Success (design C4 "Discard"; requirement 7 AC7). Pre-
  // condition for both: a `running` run and a `done` run seeded after the
  // server starts (so the live controller never drives either), sharing
  // `codeRoot`.
  describe('POST /api/controller/runs/:id/discard — task 4', () => {
    // Criterion "the route answers 409 with that body" (and the record
    // underneath is untouched): Pre-condition: the `running` run holds the
    // same non-empty `branch` as the `done` run. Call: fetch POST
    // .../discard on the done run's id. Observable result: 409
    // { error: 'branch-in-use' }, and `readRun` on the done run's id is
    // unchanged. Expected-value source: design C4 ("the discard route
    // answers 409 { error: 'branch-in-use' } on the sentinel"; "On
    // branch-in-use nothing changes ... no write").
    it('answers 409 branch-in-use when a moving run holds the branch, and changes nothing', async () => {
      const base = await startServer();
      const specStore = join(tempDir, 'store-discard-409');
      const spec = 'controller-dashboard';
      const movingRun: RunRecord = {
        v: 1, id: 'run-discard-moving', project: 'proj-1', codeRoot: specStore, specStore, spec,
        worktree: specStore, branch: 'feat/shared', status: 'running',
        created: '2026-11-06T10:00:00.000Z', updated: '2026-11-06T10:00:00.000Z',
        tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      };
      await writeRun(movingRun);
      const doneRun: RunRecord = {
        v: 1, id: 'run-discard-done', project: 'proj-1', codeRoot: specStore, specStore, spec,
        worktree: specStore, branch: 'feat/shared', status: 'done',
        created: '2026-11-06T10:00:00.000Z', updated: '2026-11-06T10:00:00.000Z',
        tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      };
      await writeRun(doneRun);
      const before = await readRun(doneRun.id);

      const res = await realFetch(`${base}/api/controller/runs/${doneRun.id}/discard`, auth({ method: 'POST' }));

      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'branch-in-use' });
      expect(await readRun(doneRun.id)).toEqual(before);
    });

    // Criterion "a missing id answers 404" (regression guard:
    // `controller.discard` already returns `undefined` for an unknown id
    // at base, and the route already 404s on that; holds with no change).
    // Pre-condition: no run with this id. Call: fetch POST .../discard.
    // Observable result: 404 { error: 'run-not-found' }. Expected-value
    // source: the existing route body (`src/dashboard/multi-server.ts:859-864`).
    it('[regression guard] answers 404 for a missing run id', async () => {
      const base = await startServer();

      const res = await realFetch(`${base}/api/controller/runs/run-nope/discard`, auth({ method: 'POST' }));

      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'run-not-found' });
    });
  });
});
