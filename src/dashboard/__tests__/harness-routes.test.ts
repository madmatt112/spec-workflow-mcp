import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp, writeFileSync, appendFileSync, unlinkSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';
import { WebSocket } from 'ws';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { hudPath } from '../harness/state-files.js';

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
//
// Criterion "a HUD rewrite and delete push to-dos" (task 9 _Prompt literal
// test name; Req 5.9, 5.10):
//   Pre-condition: an overview subscriber connected; no HUD file yet.
//   Test: write the HUD file with one to-do, then delete it.
//   Observable result: an `overview-todos` message arrives whose
//   `data.todos` holds exactly the written to-do, then a later
//   `overview-todos` message arrives whose `data.todos` is empty.
//   Expected-value source: the literal to-do fields written into the HUD
//   fixture, and Req 5.7 (a missing HUD file gives an empty list).

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

  it('pushes to-dos on a HUD rewrite, then again on a HUD delete', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });
    await waitFor(() => messages.some((m) => m.type === 'overview-todos'));

    const todosMsgs = () => messages.filter((m) => m.type === 'overview-todos');
    const baselineCount = todosMsgs().length;

    writeFileSync(hudPath(), JSON.stringify({
      todos: [{
        id: 'todo-1', title: 'Check something', owner: 'matthew', blocks: '',
        note: '', since: '2026-01-01', done: false, priority: 'P1',
      }],
    }));

    await waitFor(() => {
      const msgs = todosMsgs();
      if (msgs.length <= baselineCount) return false;
      const last = msgs[msgs.length - 1];
      return last.data.todos.length === 1 && last.data.todos[0].id === 'todo-1';
    }, 5000);
    const afterWriteCount = todosMsgs().length;

    unlinkSync(hudPath());

    await waitFor(() => {
      const msgs = todosMsgs();
      if (msgs.length <= afterWriteCount) return false;
      const last = msgs[msgs.length - 1];
      return last.data.todos.length === 0;
    }, 5000);
  });
});
