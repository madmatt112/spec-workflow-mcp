import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  promises as fsp, writeFileSync, appendFileSync, mkdirSync,
  chmodSync, readFileSync, readdirSync, existsSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import { WebSocket } from 'ws';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { AGENT_PROFILES } from '../../watch/ledger.js';
import { loadOrCreateSecret } from '../../controller/access.js';

// Real fetch, captured before any test below monkeypatches globalThis.fetch to
// stub the dashboard's npm-version check (task 9's and task 10's beforeEach
// both do this). Task 10's tests use this reference for every request against
// a real, locally started MultiProjectDashboardServer.
const realFetch: typeof fetch = globalThis.fetch;

// Contract for the task 9 hub/websocket wiring (design.md C7; task 9 _Prompt;
// Requirements 3.12, 4.2, 4.7, 4.8, 4.9, 5.9, 5.10). Every test drives the
// server only through a real `ws` client on the `/ws` endpoint, with a temp
// SPEC_WORKFLOW_HOME (registry, launch records) and a temp XDG_STATE_HOME
// (pointer file, HUD file) — never the real state home.
//
// Criterion "harness subscriber gets the snapshot, then a fresh harness-model
// within five seconds of a ledger append" (task 9 _Prompt: "a harness
// subscriber gets the snapshot, then a harness-model within five seconds of a
// ledger append"; Req 4.2, 4.8):
//   Pre-condition: project alpha registered with a ledger holding only a
//   `run.start` row (no open phase); a ws client connected to `/ws`.
//   Test: send `{ type: 'harness-subscribe', projectId: alphaId }`, wait for
//   a `harness-model` message (the snapshot), then append a `phase.start`
//   row (phase `document`) to alpha's ledger file.
//   Observable result: within five seconds a `harness-model` message for
//   alphaId arrives whose `data.model.livePhase.phase === 'document'`.
//   Expected-value source: the literal `phase: 'document'` value written
//   into the appended ledger row, folded by the existing model builder
//   (src/watch/ledger.ts:243-457) that C5 already reuses.
//
// Criterion "a Specs-page (`subscribe`-only) client gets no harness-*
// message" (task 9 _Prompt: "a second client with only subscribe on the
// same project gets no harness-* message"; Req 4.9):
//   Pre-condition: one harness subscriber and one `subscribe`-only client
//   both on project alpha.
//   Test: append a `phase.start` row to alpha's ledger, and wait until the
//   harness subscriber's collected messages show the updated model.
//   Observable result: the `subscribe`-only client's collected messages
//   contain zero entries whose `type` starts with `harness-`.
//   Expected-value source: the _Prompt sentence — harness pushes are filtered
//   on the harness view, never broadcast to every client of the project.
//
// Criterion "watchedProjects() empties after the last harness subscriber
// closes" (task 9 _Prompt literal test name; Req 4.7):
//   Pre-condition: one harness subscriber on project alpha, confirmed by
//   `hub.watchedProjects()` containing alphaId.
//   Test: close that client's socket.
//   Observable result: within five seconds `hub.watchedProjects()` no
//   longer contains alphaId.
//   Expected-value source: the _Prompt sentence ("watchedProjects() empties
//   after the last harness subscriber closes").
//
// Criterion "with two registered projects, an overview subscriber sees a
// gate-a row as waiting within five seconds" (task 9 _Prompt; Req 5.9, 5.10):
//   Pre-condition: two registered projects (alpha, beta); an overview
//   subscriber connected.
//   Test: append a `phase.start` then a `phase.end` row with
//   `result: 'gate-a'` to alpha's ledger.
//   Observable result: within five seconds an `overview-rows` message
//   arrives whose row for alphaId has `waiting === true`.
//   Expected-value source: the literal `result: 'gate-a'` value written into
//   the appended row, folded by the existing D7 waiting rule (task 8,
//   overview-watch.ts `computeWaiting`) that C6 already implements.

async function getFreePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      if (!a || typeof a === 'string') {
        s.close();
        reject(new Error('Failed to get free port'));
        return;
      }
      const port = a.port;
      s.close(() => resolvePort(port));
    });
    s.on('error', reject);
  });
}

function waitFor(predicate: () => boolean, timeoutMs = 5000, intervalMs = 20): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) { resolve(); return; }
      if (Date.now() > deadline) { reject(new Error('waitFor: timed out')); return; }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

function handoffFixture(spec: string): string {
  return [
    `> **READ FIRST — SDD routing.** Active spec **\`${spec}\`**.`,
    `> Live phase **document**, state **in-progress**, last result **gate-a**.`,
  ].join('\n');
}

function connect(port: number): Promise<WebSocket> {
  return new Promise((resolvePromise, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    ws.once('open', () => resolvePromise(ws));
    ws.once('error', reject);
  });
}

function collect(ws: WebSocket): any[] {
  const messages: any[] = [];
  ws.on('message', (data: Buffer) => {
    try { messages.push(JSON.parse(data.toString())); } catch { /* ignore */ }
  });
  return messages;
}

function send(ws: WebSocket, msg: object): void {
  ws.send(JSON.stringify(msg));
}

describe('harness hub and websocket wiring (task 9)', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  let alphaId: string;
  let betaId: string;
  let alphaLedgerPath: string;
  const sockets: WebSocket[] = [];
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `harness-routes-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stateHomeDir = join(tempDir, '.xdg-state');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;
    // The real Controller the server starts writes run/wait records under the
    // controller home; isolate it so a late async write never hits the real home.
    process.env.SDD_HOME = join(tempDir, '.sdd-home');

    // Project alpha: HANDOFF routes to spec-a; ledger starts with only a
    // run.start row (no open phase yet).
    const alphaWorkspace = join(tempDir, 'alpha-workspace');
    const alphaWorkflowRoot = join(tempDir, 'alpha-project');
    const alphaSpecDir = join(alphaWorkflowRoot, '.spec-workflow', 'specs', 'spec-a');
    await fsp.mkdir(alphaSpecDir, { recursive: true });
    writeFileSync(join(alphaWorkflowRoot, '.spec-workflow', 'HANDOFF.md'), handoffFixture('spec-a'));
    alphaLedgerPath = join(alphaSpecDir, 'harness-events.jsonl');
    writeFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-alpha-1', spec: 'spec-a',
    }) + '\n');

    // Project beta: HANDOFF routes to spec-b; no ledger at all (idle).
    const betaWorkspace = join(tempDir, 'beta-workspace');
    const betaWorkflowRoot = join(tempDir, 'beta-project');
    await fsp.mkdir(join(betaWorkflowRoot, '.spec-workflow'), { recursive: true });
    writeFileSync(join(betaWorkflowRoot, '.spec-workflow', 'HANDOFF.md'), handoffFixture('spec-b'));

    const registry = new ProjectRegistry();
    await registry.registerProject(alphaWorkspace, process.pid, { workflowRootPath: alphaWorkflowRoot });
    await registry.registerProject(betaWorkspace, process.pid, { workflowRootPath: betaWorkflowRoot });
    alphaId = generateProjectId(alphaWorkspace);
    betaId = generateProjectId(betaWorkspace);

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ autoOpen: false, port });
    await server.start();
    _resetMultiServerWarningsForTests();
  });

  afterEach(async () => {
    for (const ws of sockets.splice(0)) {
      try { ws.close(); } catch { /* already closed */ }
    }
    if (server) {
      await server.stop();
      server = null;
    }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  function getHub(): { watchedProjects: () => Iterable<string> } {
    return (server as any).harnessHub;
  }

  it('sends the snapshot, then a fresh harness-model within five seconds of a ledger append', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);

    send(ws, { type: 'harness-subscribe', projectId: alphaId });
    await waitFor(() => messages.some((m) => m.type === 'harness-model' && m.projectId === alphaId));

    appendFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:05.000Z', type: 'phase.start', run: 'run-alpha-1', phase: 'document', mode: 'auto', state: 'in-progress',
    }) + '\n');

    await waitFor(() => messages.some((m) =>
      m.type === 'harness-model' && m.projectId === alphaId && m.data?.model?.livePhase?.phase === 'document'
    ), 5000);

    const updated = messages.filter((m) => m.type === 'harness-model' && m.projectId === alphaId).pop();
    expect(updated.data.model.livePhase.phase).toBe('document');
  });

  it('sends no harness-* message to a client that only sent subscribe', async () => {
    const harnessWs = await connect(port);
    sockets.push(harnessWs);
    const harnessMessages = collect(harnessWs);
    send(harnessWs, { type: 'harness-subscribe', projectId: alphaId });
    await waitFor(() => harnessMessages.some((m) => m.type === 'harness-model' && m.projectId === alphaId));

    const specsWs = await connect(port);
    sockets.push(specsWs);
    const specsMessages = collect(specsWs);
    send(specsWs, { type: 'subscribe', projectId: alphaId });

    appendFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:05.000Z', type: 'phase.start', run: 'run-alpha-1', phase: 'document', mode: 'auto', state: 'in-progress',
    }) + '\n');

    await waitFor(() => harnessMessages.some((m) =>
      m.type === 'harness-model' && m.projectId === alphaId && m.data?.model?.livePhase?.phase === 'document'
    ), 5000);

    expect(specsMessages.some((m) => typeof m.type === 'string' && m.type.startsWith('harness-'))).toBe(false);
  });

  it('empties watchedProjects() after the last harness subscriber closes', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'harness-subscribe', projectId: alphaId });
    await waitFor(() => messages.some((m) => m.type === 'harness-model' && m.projectId === alphaId));

    const hub = getHub();
    await waitFor(() => Array.from(hub.watchedProjects()).includes(alphaId));

    ws.close();
    sockets.splice(sockets.indexOf(ws), 1);

    await waitFor(() => !Array.from(hub.watchedProjects()).includes(alphaId));
  });

  it('shows a gate-a row as waiting within five seconds, with two registered projects', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });
    await waitFor(() => messages.some((m) => m.type === 'overview-rows'));

    appendFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:05.000Z', type: 'phase.start', run: 'run-alpha-1', phase: 'document', mode: 'auto', state: 'in-progress',
    }) + '\n');
    appendFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:10.000Z', type: 'phase.end', run: 'run-alpha-1', phase: 'document', result: 'gate-a',
    }) + '\n');

    await waitFor(() => {
      const last = messages.filter((m) => m.type === 'overview-rows').pop();
      if (!last) return false;
      const row = last.data.rows.find((r: any) => r.projectId === alphaId);
      return !!row && row.waiting === true;
    }, 5000);

    // Two registered projects are visible on the same shared watch (Req 5.9).
    const finalRows = messages.filter((m) => m.type === 'overview-rows').pop().data.rows;
    expect(finalRows.map((r: any) => r.projectId).sort()).toEqual([alphaId, betaId].sort());
  });
});

// -----------------------------------------------------------------------------
// Contract for task 10 (design.md C7 routes; task 10 _Prompt; Requirements
// 1.10, 1.11, 3.1, 3.7, 3.8, 3.9, 3.14). Every test below drives the server
// only through real fetch() calls against a fresh MultiProjectDashboardServer
// built with `harness: { cli: fakeCli, stopGraceMs: 300, pollMs: 50 }`, a
// task-5-style fake cli script, and a fixture spec store with one spec
// (`alpha`, one incomplete task, no decomposition.md) whose routing is
// `active`. No collaborator inside multi-server.ts is mocked.
//
// Criterion "GET returns one row per profile and the supervisor" (task 10
//   _Prompt: "GET .../harness/setup returns buildSetupView"; Req 1.4, 1.5):
//   Pre-condition: the fixture project registered; server started with the
//   fake cli.
//   Test: `GET /api/projects/:projectId/harness/setup`.
//   Observable result: 200; `body.roles.length` equals the number of keys of
//   the real `AGENT_PROFILES` map; `body.supervisor` deep-equals `{ model:
//   'claude-opus-5-5', effort: 'high' }`.
//   Expected-value source: the real `AGENT_PROFILES` map (src/watch/ledger.ts,
//   loaded from harness/agent-profiles.json) and design.md C3's fixed
//   supervisor row.
//
// Criterion "PUT with a bad model gives 400 naming the field" (task 10
//   _Prompt: "a validateSetup error gives 400 with that object"; Req 1.6):
//   Pre-condition: same fixture; a PUT body whose supervisorModel is 'gpt-4'
//   (neither an alias nor a claude- id).
//   Test: `PUT /api/projects/:projectId/harness/setup` with that body.
//   Observable result: 400; `body.field === 'supervisorModel'`; `body.value
//   === 'gpt-4'`; `body.error` a non-empty string.
//   Expected-value source: task 3's already-implemented `validateSetup`
//   (checkAnthropicModel), reached through the route.
//
// Criterion "PUT for another spec gives 409" (task 10 _Prompt: "when
//   launchable is null or differs from the body spec, 409 { error:
//   'not-launchable', reason } ... a sentence naming both specs"; Req 1.10):
//   Pre-condition: same fixture (launchable spec 'alpha'); a PUT body naming
//   spec 'bogus-spec'.
//   Test: `PUT /api/projects/:projectId/harness/setup` with that body.
//   Observable result: 409; `body.error === 'not-launchable'`; `body.reason`
//   a string containing both 'alpha' and 'bogus-spec'.
//   Expected-value source: the task 10 _Prompt sentence ("a sentence naming
//   both specs").
//
// Criterion "launch gives 200, the record, a live group and a run file with
//   gates record" (task 10 _Prompt; design Carried R3-minor-2; Req 3.1, 3.8):
//   Pre-condition: same fixture; a valid launch body whose `gates` is
//   'block'.
//   Test: `POST /api/projects/:projectId/harness/launch` with that body.
//   Observable result: 200; `body.launch.state === 'running'`; `body.launch
//   .pid`/`.pgid` are numbers; `process.kill(-body.launch.pgid, 0)` does not
//   throw; the on-disk `harness-run.json`'s `gates` is `'record'` even though
//   the request body asked for `'block'`.
//   Expected-value source: design Carried R3-minor-2 ("Launch always writes
//   gates: 'record' ... overwriting a block setup") and the real spawned
//   fake-cli process group's liveness.
//
// Criterion "a second launch gives 409 with the run id" (task 10 _Prompt;
//   design C4 "Admission"; Req 3.7, 3.8):
//   Pre-condition: a first launch already running; its record's `runId` set
//   to 'run-fixed-1' via the real `harnessLauncher.noteRunId` (the C5 hookup,
//   called directly here since no websocket subscriber is watching the
//   ledger in this test).
//   Test: `POST /api/projects/:projectId/harness/launch` a second time.
//   Observable result: 409; `body.error === 'run-live'`; `body.runId ===
//   'run-fixed-1'`.
//   Expected-value source: the literal run id passed to `noteRunId`, surfaced
//   by the real `admission()` refusal (design C4 "Admission").
//
// Criterion "a pointer line in the project gives 409 naming it" (task 10
//   _Prompt; design C4 "Admission"; Req 3.7):
//   Pre-condition: no launch yet; a hand-written line at `pointerPath()`
//   whose spec dir sits inside this project's specs directory, run id
//   'run-existing-42'.
//   Test: `POST /api/projects/:projectId/harness/launch`.
//   Observable result: 409; `body.error === 'run-live'`; `body.runId ===
//   'run-existing-42'`; `body.reason` contains the pointer line's spec dir.
//   Expected-value source: the literal pointer-line fields the test writes,
//   surfaced by the real `admission()` refusal.
//
// Criterion "two concurrent launch posts give one 200 and one 409, never
//   500" (task 10 _Prompt; design C4 "Launch" step 1; Req 3.8):
//   Pre-condition: no launch yet.
//   Test: two `POST /api/projects/:projectId/harness/launch` requests fired
//   together with `Promise.all`, neither awaited before the other starts.
//   Observable result: the two response statuses, sorted ascending, equal
//   `[200, 409]`.
//   Expected-value source: design C4 "Launch" step 1 ("Check-and-set the
//   in-flight flag synchronously, before any await, so two concurrent
//   launch() calls cannot both pass").
//
// Criterion "a missing cli gives 500 step spawn and no record" (task 10
//   _Prompt: "any other step gives 500 { error, step, detail }"; design Error
//   Handling 2; Req 3.14):
//   Pre-condition: a second server on the same fixture project, built with
//   `harness.cli` pointing at a path that does not exist.
//   Test: `POST /api/projects/:projectId/harness/launch` against that
//   server.
//   Observable result: 500; `body.step === 'spawn'`; `body.detail` a
//   non-empty string; `launchesDir()` holds no `<projectId>.json` file.
//   Expected-value source: design C4 "Launch" step 5 ("Any failure throws
//   LaunchError ... writes no record") and the Testing Strategy's confirmed
//   `ENOENT` on a missing binary.
//
// Criterion "stop gives 200 and stopped" (task 10 _Prompt; design C4 "Stop";
//   Req 3.9):
//   Pre-condition: a launch already running with the fake cli, which dies on
//   SIGTERM.
//   Test: `POST /api/projects/:projectId/harness/stop`.
//   Observable result: 200; `body.launch.state === 'stopped'`.
//   Expected-value source: design C4 "Stop"/"Finalise" (`state: 'stopped'`
//   once the group is gone).
//
// Criterion "a second stop gives 404" (task 10 _Prompt: "when launcher.get is
//   null or its state is neither running nor stopping, 404 { error:
//   'not-running' }"; Req 3.9):
//   Pre-condition: the run from the previous criterion already stopped.
//   Test: `POST /api/projects/:projectId/harness/stop` a second time.
//   Observable result: 404; `body.error === 'not-running'`.
//   Expected-value source: the task 10 _Prompt sentence.

const ROUTE_FAKE_CLI_SCRIPT = `#!/usr/bin/env bash
echo "$@"
sleep 30 &
wait
`;

describe('harness routes: setup and launch (task 10)', () => {
  let tempDir: string;
  let stateHomeDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  let projectId: string;
  let projectRoot: string;
  let workflowRoot: string;
  let fakeCli: string;
  let secret: string;
  const launchedPgids: number[] = [];
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `harness-route-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    stateHomeDir = join(tempDir, '.xdg-state');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;
    // The real Controller the server starts writes run/wait records under the
    // controller home; isolate it so a late async write never hits the real home.
    process.env.SDD_HOME = join(tempDir, '.sdd-home');

    // Point the controller's steps at the stub with an empty script, so a run the
    // launch route enqueues fails its first step fast instead of spawning the real
    // `claude` or the long-sleeping fake cli while these route tests run.
    const controllerStub = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'stub-claude.mjs');
    const emptyScript = join(tempDir, 'empty-claude-script.json');
    writeFileSync(emptyScript, '[]');
    process.env.CONTROLLER_CLAUDE_BIN = controllerStub;
    process.env.STUB_CLAUDE_SCRIPT = emptyScript;

    const workspace = join(tempDir, 'workspace');
    projectRoot = join(tempDir, 'project'); // becomes project.projectPath
    workflowRoot = join(projectRoot, '.spec-workflow');
    const specDir = join(workflowRoot, 'specs', 'alpha');
    await fsp.mkdir(specDir, { recursive: true });
    // A worktree:'no' launch spawns the run in the workspace, so the real
    // (unmocked) spawn needs the workspace directory to exist as its cwd.
    await fsp.mkdir(workspace, { recursive: true });
    writeFileSync(join(specDir, 'requirements.md'), '# R\n');
    writeFileSync(join(specDir, 'design.md'), '# D\n');
    writeFileSync(join(specDir, 'tasks.md'), '- [ ] 1. a\n');

    const registry = new ProjectRegistry();
    await registry.registerProject(workspace, process.pid, { workflowRootPath: projectRoot });
    projectId = generateProjectId(workspace);

    fakeCli = join(tempDir, 'fake-cli.sh');
    writeFileSync(fakeCli, ROUTE_FAKE_CLI_SCRIPT);
    chmodSync(fakeCli, 0o755);

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({
      autoOpen: false,
      port,
      harness: { cli: fakeCli, stopGraceMs: 300, pollMs: 50 },
    });
    await server.start();
    // A mutating harness route now needs the shared secret (access control,
    // controller-design.md §17); the server created it under this test's home.
    secret = await loadOrCreateSecret();
    _resetMultiServerWarningsForTests();
  });

  afterEach(async () => {
    for (const pgid of launchedPgids.splice(0)) {
      try { process.kill(-pgid, 'SIGKILL'); } catch { /* already gone */ }
    }
    if (server) {
      await server.stop();
      server = null;
    }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  function routeUrl(suffix: string): string {
    return `http://127.0.0.1:${port}/api/projects/${projectId}/harness/${suffix}`;
  }

  function baseInput(overrides: Record<string, any> = {}): Record<string, any> {
    return {
      spec: 'alpha',
      supervisorModel: 'claude-opus-5-5',
      worktree: 'no',
      gates: 'block',
      roles: {},
      ...overrides,
    };
  }

  async function postJson(path: string, body: object): Promise<{ status: number; body: any }> {
    const res = await realFetch(routeUrl(path), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  it('GET setup returns one row per profile and the supervisor row', async () => {
    const res = await realFetch(routeUrl('setup'));
    expect(res.status).toBe(200);
    const body: any = await res.json();

    expect(body.roles.length).toBe(Object.keys(AGENT_PROFILES).length);
    expect(body.supervisor).toEqual({ model: 'claude-opus-5-5', effort: 'high' });
  });

  // Launch enqueues to the controller (controller-tasks.md T6): the route keeps
  // the launchability/routed-spec check, then the controller owns the run. The
  // setup file the supervisor launcher read went with step (d).
  it('launch enqueues, returns a runId, and writes no setup file', async () => {
    const { status, body } = await postJson('launch', baseInput({ gates: 'block' }));
    expect(status).toBe(200);
    expect(typeof body.runId).toBe('string');
    expect(body.runId).toMatch(/^run-/);
    expect(existsSync(join(workflowRoot, 'harness-run.json'))).toBe(false);

    // The run is recorded and shows on the controller runs route.
    const runs: any = await (await realFetch(`http://127.0.0.1:${port}/api/controller/runs`, {
      headers: { authorization: `Bearer ${secret}` },
    })).json();
    expect(runs.runs.some((r: any) => r.id === body.runId)).toBe(true);
  });

  it('a second launch for the same spec store gives 409', async () => {
    const first = await postJson('launch', baseInput());
    expect(first.status).toBe(200);

    const second = await postJson('launch', baseInput());
    expect(second.status).toBe(409);
    expect(second.body.error).toBe('run-live');
  });

  it('two concurrent launch posts give one 200 and one 409, never 500', async () => {
    const [a, b] = await Promise.all([
      postJson('launch', baseInput()),
      postJson('launch', baseInput()),
    ]);
    const statuses = [a.status, b.status].sort((x, y) => x - y);
    expect(statuses).toEqual([200, 409]);
  });

  it('launch for another spec gives 409 not-launchable', async () => {
    const { status, body } = await postJson('launch', baseInput({ spec: 'bogus-spec' }));
    expect(status).toBe(409);
    expect(body.error).toBe('not-launchable');
    expect(body.reason).toContain('alpha');
    expect(body.reason).toContain('bogus-spec');
  });
});
