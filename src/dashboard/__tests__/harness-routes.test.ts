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
import { connect, collect, send, withoutConnectPush } from './ws-test-utils.js';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { AGENT_PROFILES } from '../../watch/ledger.js';
import { loadOrCreateSecret } from '../../controller/access.js';
import { writeRun, type RunRecord } from '../../controller/state.js';

// Real fetch, captured before any test below monkeypatches globalThis.fetch to
// stub the dashboard's npm-version check (task 9's and task 10's beforeEach
// both do this). Task 10's tests use this reference for every request against
// a real, locally started MultiProjectDashboardServer.
const realFetch: typeof fetch = globalThis.fetch;

// Contract for the task 9 hub/websocket wiring (design.md C7; task 9 _Prompt;
// Requirements 3.12, 5.9, 5.10), as cut down by task 19 (design C6; R2 AC 2,
// 3, 4): the harness per-project view and its messages are gone, so a
// `harness-subscribe` is now inert. Every test drives the server only
// through a real `ws` client on the `/ws` endpoint, with a temp
// SPEC_WORKFLOW_HOME (registry, launch records) and a temp XDG_STATE_HOME
// (pointer file, HUD file) — never the real state home.
//
// Criterion "a harness-subscribe message changes nothing and sends no
// reply" (task 19 Success line; R2 AC 2, 3):
//   Pre-condition: project alpha registered with a ledger holding only a
//   `run.start` row; a ws client connected to `/ws`.
//   Test: send `{ type: 'harness-subscribe', projectId: alphaId }`, then
//   wait 300ms.
//   Observable result: the client's collected messages are empty.
//   Expected-value source: the task 19 Success line — the per-project
//   harness view and its reply are gone, so the message is a no-op.
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
    // The workspace path must exist on disk, or the startup missing-path prune
    // (R4 AC1) drops the registration before the server lists it.
    await fsp.mkdir(alphaWorkspace, { recursive: true });
    writeFileSync(join(alphaWorkflowRoot, '.spec-workflow', 'HANDOFF.md'), handoffFixture('spec-a'));
    alphaLedgerPath = join(alphaSpecDir, 'harness-events.jsonl');
    writeFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-alpha-1', spec: 'spec-a',
    }) + '\n');

    // Project beta: HANDOFF routes to spec-b; no ledger at all (idle).
    const betaWorkspace = join(tempDir, 'beta-workspace');
    const betaWorkflowRoot = join(tempDir, 'beta-project');
    await fsp.mkdir(join(betaWorkflowRoot, '.spec-workflow'), { recursive: true });
    await fsp.mkdir(betaWorkspace, { recursive: true });
    writeFileSync(join(betaWorkflowRoot, '.spec-workflow', 'HANDOFF.md'), handoffFixture('spec-b'));

    const registry = new ProjectRegistry();
    await registry.registerProject(alphaWorkspace, process.pid, { workflowRootPath: alphaWorkflowRoot });
    await registry.registerProject(betaWorkspace, process.pid, { workflowRootPath: betaWorkflowRoot });
    alphaId = generateProjectId(alphaWorkspace);
    betaId = generateProjectId(betaWorkspace);

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
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

  it('changes nothing and sends no reply to a harness-subscribe message', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);

    send(ws, { type: 'harness-subscribe', projectId: alphaId });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Every socket gets a `projects-update` on connect regardless of view
    // (multi-server.ts's connection handler); that push races with this
    // 300ms wait and is unrelated to harness-subscribe, so the shared helper
    // drops it rather than asserting on raw length.
    expect(withoutConnectPush(messages)).toHaveLength(0);
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

// -----------------------------------------------------------------------------
// Contract for task 3 (design.md C1 "Interfaces"; D2; task 3 _Prompt;
// Requirement 1 AC 7). Every test below drives the server only through real
// fetch() calls against a fresh MultiProjectDashboardServer, with a fixture
// registry holding two live projects: `solo` (workspace and workflow root are
// the same directory, so `ProjectManager.addProject` remembers it —
// `src/dashboard/project-manager.ts:236` — giving it a `projects.json` row)
// and `transient` (workspace and workflow root differ, the worktree shape
// that same line never remembers — live, but no row). No collaborator inside
// multi-server.ts is mocked.
//
// Criterion "a string answers 200 `{ success: true }` and `/api/projects/list`
//   shows it" (task 3 _Prompt; design Data Models row 1; Req 1.7):
//   Pre-condition: `solo` registered, no display name set yet.
//   Test: `POST .../solo/display-name` with `{ displayName: 'tradr app' }`.
//   Observable result: 200; body deep-equals `{ success: true }`; a
//   following `GET /api/projects/list` row for `solo` has
//   `projectName === 'tradr app'`.
//   Expected-value source: the literal body this test sends, surfaced by
//   `ProjectManager.getProjectsList()` reading the saved name back.
//
// Criterion "`null` ... each answer 200 and clear it" (null case) (task 3
//   _Prompt; design Data Models row 1; Req 1.7):
//   Pre-condition: `solo` already has a saved display name.
//   Test: `POST .../solo/display-name` with `{ displayName: null }`.
//   Observable result: 200; body deep-equals `{ success: true }`; the
//   following list row's `projectName` equals `solo`'s generated name (the
//   value the list showed before any display name was ever set).
//   Expected-value source: design C1 post-condition ("`null` removes the key
//   entirely", `src/controller/state.ts:644-658`) and the generated name read
//   from the list before the test set anything.
//
// Criterion "... a blank string each answer 200 and clear it" (blank-string
//   case) (task 3 _Prompt; design Data Models row 1; Req 1.7):
//   Pre-condition: `solo` already has a saved display name.
//   Test: `POST .../solo/display-name` with `{ displayName: '   ' }`.
//   Observable result: 200; body deep-equals `{ success: true }`; the
//   following list row's `projectName` equals `solo`'s generated name.
//   Expected-value source: the task 3 _Prompt ("Trim a string body; an empty
//   result clears the name") and the generated name read before the test.
//
// Criterion "a number answers 400 `display-name-invalid`" (task 3 _Prompt;
//   design Data Models row 2; Req 1.7):
//   Pre-condition: `solo` registered.
//   Test: `POST .../solo/display-name` with `{ displayName: 42 }`.
//   Observable result: 400; `body.error === 'display-name-invalid'`.
//   Expected-value source: design Data Models row 2 ("not a string or null
//   ... gives 400 `display-name-invalid`").
//
// Criterion "61 characters after trim answer 400" (task 3 _Prompt; design
//   Data Models row 2; Req 1.7):
//   Pre-condition: `solo` registered.
//   Test: `POST .../solo/display-name` with a body whose `displayName` is
//   61 `'a'` characters padded with leading/trailing spaces (trim leaves 61).
//   Observable result: 400; `body.error === 'display-name-invalid'`.
//   Expected-value source: design Data Models row 2 ("over 60 characters
//   after trim").
//
// Criterion "60 [characters after trim] answer 200" (task 3 _Prompt; design
//   Data Models row 1; Req 1.7):
//   Pre-condition: `solo` registered.
//   Test: `POST .../solo/display-name` with a body whose `displayName` is
//   60 `'a'` characters padded with leading/trailing spaces (trim leaves 60).
//   Observable result: 200; body deep-equals `{ success: true }`.
//   Expected-value source: design Data Models row 1 vs row 2's 60/61
//   boundary.
//
// Criterion "a control character answers 400" (task 3 _Prompt; design Data
//   Models row 2; Req 1.7):
//   Pre-condition: `solo` registered.
//   Test: `POST .../solo/display-name` with `{ displayName: 'bad\u0007name' }`.
//   Observable result: 400; `body.error === 'display-name-invalid'`.
//   Expected-value source: design Data Models row 2 ("or a control
//   character").
//
// Criterion "an unknown id answers 404 `project-not-found`" (task 3 _Prompt;
//   design Data Models row 3; Req 1.7):
//   Pre-condition: no project registered with id `nonexistent-project-id`.
//   Test: `POST .../nonexistent-project-id/display-name` with
//   `{ displayName: 'x' }`.
//   Observable result: 404; `body.error === 'project-not-found'`.
//   Expected-value source: design Data Models row 3 ("no live context").
//
// Criterion "a live project with no `projects.json` row answers 404
//   `project-not-remembered`" (task 3 _Prompt; design Data Models row 4; Req
//   1.7):
//   Pre-condition: `transient` registered (live context, no durable row).
//   Test: `POST .../transient/display-name` with `{ displayName: 'x' }`.
//   Observable result: 404; `body.error === 'project-not-remembered'`.
//   Expected-value source: design Data Models row 4 ("no `projects.json` row
//   (a transient worktree project)").

describe('harness routes: display-name (task 3)', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  let soloId: string;
  let transientId: string;
  let secret: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `harness-routes-display-name-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stateHomeDir = join(tempDir, '.xdg-state');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;
    // The real Controller the server starts writes run/wait records under the
    // controller home; isolate it so a late async write never hits the real home.
    process.env.SDD_HOME = join(tempDir, '.sdd-home');

    // `solo`: workspace and workflow root are the same directory, so
    // ProjectManager remembers it (src/dashboard/project-manager.ts:236),
    // giving it a `projects.json` row.
    const soloRoot = join(tempDir, 'solo-project');
    await fsp.mkdir(join(soloRoot, '.spec-workflow'), { recursive: true });

    // `transient`: workspace and workflow root differ, the worktree shape
    // the same line never remembers — live, but no durable row.
    const transientWorkspace = join(tempDir, 'transient-workspace');
    const transientWorkflowRoot = join(tempDir, 'transient-project');
    await fsp.mkdir(join(transientWorkflowRoot, '.spec-workflow'), { recursive: true });
    await fsp.mkdir(transientWorkspace, { recursive: true });

    const registry = new ProjectRegistry();
    await registry.registerProject(soloRoot, process.pid, {});
    await registry.registerProject(transientWorkspace, process.pid, { workflowRootPath: transientWorkflowRoot });
    soloId = generateProjectId(soloRoot);
    transientId = generateProjectId(transientWorkspace);

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    // A mutating route needs the shared secret (access control,
    // controller-design.md §17).
    secret = await loadOrCreateSecret();
    _resetMultiServerWarningsForTests();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  async function postDisplayName(id: string, body: unknown): Promise<{ status: number; body: any }> {
    const res = await realFetch(`http://127.0.0.1:${port}/api/projects/${id}/display-name`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  async function listProjectName(id: string): Promise<string> {
    const res = await realFetch(`http://127.0.0.1:${port}/api/projects/list`);
    const rows = await res.json() as any[];
    return rows.find((p) => p.projectId === id).projectName;
  }

  it('saves a string, answers 200, and /api/projects/list shows it', async () => {
    const { status, body } = await postDisplayName(soloId, { displayName: 'tradr app' });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(await listProjectName(soloId)).toBe('tradr app');
  });

  it('null clears a saved name back to the generated one', async () => {
    const generated = await listProjectName(soloId);
    await postDisplayName(soloId, { displayName: 'tradr app' });
    expect(await listProjectName(soloId)).toBe('tradr app');

    const { status, body } = await postDisplayName(soloId, { displayName: null });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(await listProjectName(soloId)).toBe(generated);
  });

  it('a blank string clears a saved name back to the generated one', async () => {
    const generated = await listProjectName(soloId);
    await postDisplayName(soloId, { displayName: 'tradr app' });
    expect(await listProjectName(soloId)).toBe('tradr app');

    const { status, body } = await postDisplayName(soloId, { displayName: '   ' });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(await listProjectName(soloId)).toBe(generated);
  });

  it('a number gives 400 display-name-invalid', async () => {
    const { status, body } = await postDisplayName(soloId, { displayName: 42 });
    expect(status).toBe(400);
    expect(body.error).toBe('display-name-invalid');
  });

  it('61 characters after trim gives 400 display-name-invalid', async () => {
    const { status, body } = await postDisplayName(soloId, { displayName: `  ${'a'.repeat(61)}  ` });
    expect(status).toBe(400);
    expect(body.error).toBe('display-name-invalid');
  });

  it('60 characters after trim gives 200', async () => {
    const { status, body } = await postDisplayName(soloId, { displayName: `  ${'a'.repeat(60)}  ` });
    expect(status).toBe(200);
    expect(body).toEqual({ success: true });
  });

  it('a control character gives 400 display-name-invalid', async () => {
    const { status, body } = await postDisplayName(soloId, { displayName: 'bad\u0007name' });
    expect(status).toBe(400);
    expect(body.error).toBe('display-name-invalid');
  });

  it('an unknown id gives 404 project-not-found', async () => {
    const { status, body } = await postDisplayName('nonexistent-project-id', { displayName: 'x' });
    expect(status).toBe(404);
    expect(body.error).toBe('project-not-found');
  });

  it('a live project with no projects.json row gives 404 project-not-remembered', async () => {
    const { status, body } = await postDisplayName(transientId, { displayName: 'x' });
    expect(status).toBe(404);
    expect(body.error).toBe('project-not-remembered');
  });
});

// -----------------------------------------------------------------------------
// Contract for task 6 (design.md C2 "Route"; task 6 _Prompt; Requirements
// 2.3, 2.7, 2.9). Every test below drives the server only through real
// fetch() calls against a fresh MultiProjectDashboardServer, with a fixture
// spec store. No collaborator inside multi-server.ts is mocked — a blocked
// launch is produced by writing a real run record through the controller's
// own `writeRun` (src/controller/state.ts), the same helper `writeRunLocked`
// uses, not by stubbing `Controller.launchBlock`.
//
// Requirement 2 AC 10 ("The launch route, launchSpec and enqueue admission
// SHALL not change") is itself marked "invariant, verified, not red-first"
// in requirements.md, and the task 6 brief's own Note repeats this: the
// task 10 launch tests above (lines 439-477) already assert the launch POST
// body and result and are this criterion's regression-guard coverage; no
// new red test is written for it here.
//
// Criterion "the tile missing the spec's files warns and names the tile
//   that holds them, read from the decomposition entry when tasks.md is
//   absent" (task 6 _Prompt; design C2 "Route"/"File list, by
//   source"/"Compare rule"; Req 2.3, 2.7; Requirement 2's Verification note
//   and design.md's Testing Strategy literal no-`tasks.md` check):
//   Pre-condition: two projects, `app` and `infra`, registered with the
//   same `workflowRootPath` (one shared `.spec-workflow` store); no
//   `specs/myspec` directory; the store's
//   `spec-decomposition/decomposition.md` names `myspec` with one
//   backticked repository path in its body; that path exists only under
//   `app`'s workspace.
//   Test: `GET /api/projects/:infraId/harness/setup`, then `GET
//   /api/projects/:appId/harness/setup`.
//   Observable result: infra's `body.guard` deep-equals `{ state: 'warn',
//   source: 'decomposition', listed: 1, compared: 1, held: 0, useProject:
//   appId }`; app's `body.guard` matches `{ state: 'clear', held: 1 }`.
//   Expected-value source: the literal field values Requirement 2's
//   Verification note and design.md's Testing Strategy give for this exact
//   scenario, and design.md C2 Data Models's `LaunchGuard` shape.
//
// Criterion "an existing tasks.md reads its File: entries, source 'tasks',
//   not the decomposition" (task 6 _Prompt; design C2 "File list, by
//   source" item 1; Req 2.7):
//   Pre-condition: the same two-project store; `specs/myspec` with
//   requirements.md, design.md and a tasks.md whose one task's `File:` line
//   names a path that exists only under `app`'s workspace; no
//   decomposition.md.
//   Test: `GET /api/projects/:infraId/harness/setup`.
//   Observable result: `body.guard.state === 'warn'` and `body.guard.source
//   === 'tasks'`.
//   Expected-value source: design.md C2 "File list, by source" item 1 ("the
//   union of task.files ... source tasks").
//
// Criterion "a guard read that fails still renders the view, with no
//   warning" (task 6 _Prompt Restrictions/Success: "A try/catch leaves
//   `guard` unset" / "a tasks.md that cannot be read ... answers 200 with
//   `guard` unset"; design C2 "Route", Error Handling 1; Req 2.9):
//   Pre-condition: one project with a launchable `myspec` (requirements.md,
//   design.md, a real tasks.md naming a `File:` path under its own
//   workspace, so a first read succeeds).
//   Test: `GET .../setup` (first, a working tasks.md — proves the guard is
//   really computed, since at base no code path ever sets it); then replace
//   `tasks.md` with a directory at the same path and `GET .../setup` again.
//   Observable result: the first call's `body.guard` deep-equals `{ state:
//   'clear', source: 'tasks', listed: 1, compared: 1, held: 1 }`; the second
//   call is 200, `body.launchable === 'myspec'` still, and `body.guard` is
//   `undefined`.
//   Expected-value source: design.md C2 Route ("A try/catch leaves `guard`
//   unset on failure (AC 9)") and Error Handling 1 ("the tile shows its code
//   root, no warning, one press").
//
// Criterion "a blocked launch carries no guard" (task 6 _Prompt Success: "a
//   blocked launch has no guard"; design C2 "Route": "sets view.guard ...
//   only while view.launchable is set"):
//   Pre-condition: one project with a launchable `myspec` (same shape as
//   above, tasks.md a real file naming a path under its own workspace, so a
//   first read succeeds).
//   Test: `GET .../setup` (first, launchable — proves the guard is really
//   computed); then write a `running` run record whose `specStore` equals
//   this project's store, through the real `writeRun`, and `GET .../setup`
//   again.
//   Observable result: the first call's `body.guard` deep-equals the same
//   `clear` object as above; the second call has `body.launchable === null`
//   and `body.guard` is `undefined`.
//   Expected-value source: design.md C2 Route's literal "only while
//   view.launchable is set" and the real `Controller.launchBlock`'s "This
//   store already has a queued or live run" refusal
//   (src/controller/controller.ts:403-419).

describe('harness routes: launch guard (task 6)', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `harness-routes-guard-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stateHomeDir = join(tempDir, '.xdg-state');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;
    // Isolates the real Controller's run/wait records the server starts, and
    // the run record the "blocked launch" test below writes directly.
    process.env.SDD_HOME = join(tempDir, '.sdd-home');
    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  async function startServer(): Promise<number> {
    const port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    _resetMultiServerWarningsForTests();
    return port;
  }

  it('warns the tile missing the spec files and names the one that holds them, from the decomposition entry', async () => {
    const storeRoot = join(tempDir, 'store');
    const appWorkspace = join(tempDir, 'app-workspace');
    const infraWorkspace = join(tempDir, 'infra-workspace');
    await fsp.mkdir(join(storeRoot, '.spec-workflow', 'spec-decomposition'), { recursive: true });
    await fsp.mkdir(join(appWorkspace, 'src', 'shared'), { recursive: true });
    await fsp.mkdir(infraWorkspace, { recursive: true });
    writeFileSync(
      join(storeRoot, '.spec-workflow', 'spec-decomposition', 'decomposition.md'),
      '### 1. `myspec`\n\nBuilds `src/shared/widget.ts`.\n',
    );
    writeFileSync(join(appWorkspace, 'src', 'shared', 'widget.ts'), '// x\n');

    const registry = new ProjectRegistry();
    await registry.registerProject(appWorkspace, process.pid, { workflowRootPath: storeRoot });
    await registry.registerProject(infraWorkspace, process.pid, { workflowRootPath: storeRoot });
    const appId = generateProjectId(appWorkspace);
    const infraId = generateProjectId(infraWorkspace);

    const port = await startServer();

    const infraBody: any = await (await realFetch(`http://127.0.0.1:${port}/api/projects/${infraId}/harness/setup`)).json();
    expect(infraBody.guard).toEqual({
      state: 'warn', source: 'decomposition', listed: 1, compared: 1, held: 0, useProject: appId,
    });

    const appBody: any = await (await realFetch(`http://127.0.0.1:${port}/api/projects/${appId}/harness/setup`)).json();
    expect(appBody.guard).toMatchObject({ state: 'clear', held: 1 });
  });

  it('reads an existing tasks.md File: list instead of the decomposition, source tasks', async () => {
    const storeRoot = join(tempDir, 'store');
    const appWorkspace = join(tempDir, 'app-workspace');
    const infraWorkspace = join(tempDir, 'infra-workspace');
    const specDir = join(storeRoot, '.spec-workflow', 'specs', 'myspec');
    await fsp.mkdir(specDir, { recursive: true });
    await fsp.mkdir(join(appWorkspace, 'src'), { recursive: true });
    await fsp.mkdir(infraWorkspace, { recursive: true });
    writeFileSync(join(specDir, 'requirements.md'), '# R\n');
    writeFileSync(join(specDir, 'design.md'), '# D\n');
    writeFileSync(join(specDir, 'tasks.md'), '- [ ] 1. a\n  - File: src/only-app.ts\n');
    writeFileSync(join(appWorkspace, 'src', 'only-app.ts'), '// x\n');

    const registry = new ProjectRegistry();
    await registry.registerProject(appWorkspace, process.pid, { workflowRootPath: storeRoot });
    await registry.registerProject(infraWorkspace, process.pid, { workflowRootPath: storeRoot });
    const infraId = generateProjectId(infraWorkspace);

    const port = await startServer();

    const infraBody: any = await (await realFetch(`http://127.0.0.1:${port}/api/projects/${infraId}/harness/setup`)).json();
    expect(infraBody.guard.state).toBe('warn');
    expect(infraBody.guard.source).toBe('tasks');
  });

  it('leaves guard unset and still renders 200 when the file list cannot be read', async () => {
    const projectRoot = join(tempDir, 'project');
    const workspace = join(tempDir, 'workspace');
    const specDir = join(projectRoot, '.spec-workflow', 'specs', 'myspec');
    await fsp.mkdir(specDir, { recursive: true });
    await fsp.mkdir(join(workspace, 'src'), { recursive: true });
    writeFileSync(join(specDir, 'requirements.md'), '# R\n');
    writeFileSync(join(specDir, 'design.md'), '# D\n');
    writeFileSync(join(specDir, 'tasks.md'), '- [ ] 1. a\n  - File: src/x.ts\n');
    writeFileSync(join(workspace, 'src', 'x.ts'), '// x\n');

    const registry = new ProjectRegistry();
    await registry.registerProject(workspace, process.pid, { workflowRootPath: projectRoot });
    const projectId = generateProjectId(workspace);

    const port = await startServer();
    const setupUrl = `http://127.0.0.1:${port}/api/projects/${projectId}/harness/setup`;

    const firstBody: any = await (await realFetch(setupUrl)).json();
    expect(firstBody.guard).toEqual({ state: 'clear', source: 'tasks', listed: 1, compared: 1, held: 1 });

    await fsp.rm(join(specDir, 'tasks.md'));
    mkdirSync(join(specDir, 'tasks.md'));

    const secondRes = await realFetch(setupUrl);
    expect(secondRes.status).toBe(200);
    const secondBody: any = await secondRes.json();
    expect(secondBody.launchable).toBe('myspec');
    expect(secondBody.guard).toBeUndefined();
  });

  it('a blocked launch carries no guard', async () => {
    const projectRoot = join(tempDir, 'project');
    const workspace = join(tempDir, 'workspace');
    const specDir = join(projectRoot, '.spec-workflow', 'specs', 'myspec');
    await fsp.mkdir(specDir, { recursive: true });
    await fsp.mkdir(join(workspace, 'src'), { recursive: true });
    writeFileSync(join(specDir, 'requirements.md'), '# R\n');
    writeFileSync(join(specDir, 'design.md'), '# D\n');
    writeFileSync(join(specDir, 'tasks.md'), '- [ ] 1. a\n  - File: src/x.ts\n');
    writeFileSync(join(workspace, 'src', 'x.ts'), '// x\n');

    const registry = new ProjectRegistry();
    await registry.registerProject(workspace, process.pid, { workflowRootPath: projectRoot });
    const projectId = generateProjectId(workspace);

    const port = await startServer();
    const setupUrl = `http://127.0.0.1:${port}/api/projects/${projectId}/harness/setup`;

    const firstBody: any = await (await realFetch(setupUrl)).json();
    expect(firstBody.guard).toEqual({ state: 'clear', source: 'tasks', listed: 1, compared: 1, held: 1 });

    await writeRun({
      v: 1, id: 'run-blocked-1', project: projectId, codeRoot: workspace, specStore: projectRoot,
      spec: 'myspec', worktree: '', branch: 'run-blocked-1', status: 'running',
      created: new Date().toISOString(), updated: new Date().toISOString(),
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    } as RunRecord);

    const secondBody: any = await (await realFetch(setupUrl)).json();
    expect(secondBody.launchable).toBeNull();
    expect(secondBody.guard).toBeUndefined();
  });
});
