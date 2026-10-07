import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp, writeFileSync, appendFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';
import { WebSocket } from 'ws';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { DeferralStorage } from '../../core/deferral-storage.js';
import type { LaunchRecord } from '../harness/types.js';

// Real fetch, captured before any test below monkeypatches globalThis.fetch to
// stub the dashboard's npm-version check (as harness-routes.test.ts does).
const realFetch: typeof fetch = globalThis.fetch;

// Contract for task 7 (design.md C7 hub bullet, C8; task 7 _Prompt;
// Requirements 2.9, 3.9, 5.4, 5.7, 7.2). Every test drives a real,
// locally-started MultiProjectDashboardServer only through a real `ws`
// client on `/ws` or a real `fetch()` call, with a temp SPEC_WORKFLOW_HOME
// (registry) and a temp XDG_STATE_HOME (pointer/HUD, unused by these tests).
// No collaborator inside hub.ts or multi-server.ts is mocked.
//
// Two requirement ids are invariants verified at the merge gate, not
// red-first per `tdd-regression-guard` (.spec-workflow/agent-rules.md), and
// carry no test here: Requirement 6 AC 6 (every base route still registered)
// and Requirement 8 AC 2 (the watch sets and WATCHED_FILES are unchanged).
//
// Criterion "an overview subscriber gets shell-now and shell-specs after
// subscribing" (task 7 _Prompt literal test; design C7 "`start` computes and
// sends both messages"):
//   Pre-condition: two registered projects (alpha routed to spec-a with a
//   ledger holding only `run.start`; beta idle, no ledger); a ws client
//   connected to `/ws`.
//   Test: send `{ type: 'overview-subscribe' }`.
//   Observable result: within five seconds the client's collected messages
//   include at least one `shell-now` message and at least one `shell-specs`
//   message.
//   Expected-value source: the task 7 _Prompt sentence ("Tests ...: an
//   overview subscriber gets shell-now and shell-specs after subscribing"),
//   which this criterion's bounded-latency cases (2.9, 3.9, 5.7) all presume.
//
// Criterion "a gate-a phase.end gives a gate wait within five seconds" (task
// 7 _Prompt; Requirement 2 AC 9):
//   Pre-condition: the same fixture; an overview subscriber already
//   collecting `shell-now` messages.
//   Test: append a `phase.start` then a `phase.end` row with
//   `result: 'gate-a'` to alpha's ledger.
//   Observable result: within five seconds a `shell-now` message arrives
//   whose `data.waits` holds an entry with `kind === 'gate'`,
//   `projectId === alphaId` and `spec === 'spec-a'`.
//   Expected-value source: the literal `result: 'gate-a'` value written into
//   the appended row, folded by the already-tested `deriveProjectWaits`
//   (task 2) that C7's feed reuses.
//
// Criterion "a retrospective-proposals write gives a retro wait within five
// seconds, and an APPROVED plan clears it within five seconds" (task 7
// _Prompt; Requirement 3 AC 9):
//   Pre-condition: the same fixture; an overview subscriber already
//   collecting `shell-now` messages; no retro files yet under spec-a.
//   Test: write `retrospective-proposals.md` under spec-a, wait for the
//   wait to appear, then write `retrospective-plan.md` with a `Status:
//   APPROVED` line.
//   Observable result: within five seconds of the first write, a
//   `shell-now` message arrives whose `data.waits` holds a `kind ===
//   'retro'`, `projectId === alphaId` entry; within five seconds of the
//   second write, a later `shell-now` message arrives whose `data.waits`
//   holds no such entry.
//   Expected-value source: the literal absent/DRAFT-vs-APPROVED `Status:`
//   values written into the two files, folded by the already-tested
//   `deriveProjectWaits` retro branch (task 2).
//
// Criterion "an exited launch-update gives an exited wait within five
// seconds" (task 7 _Prompt; Requirement 3 AC 9):
//   Pre-condition: the same fixture; an overview subscriber already
//   collecting `shell-now` messages; no exited wait yet.
//   Test: set an exited `LaunchRecord` for alpha directly on the real
//   `harnessLauncher`'s record map (a cast to reach it, as the task 7
//   _Prompt allows), then `harnessLauncher.emit('launch-update', record)`.
//   Observable result: within five seconds a `shell-now` message arrives
//   whose `data.waits` holds an entry with `kind === 'exited'`,
//   `projectId === alphaId` and `detail.exitCode === 7`.
//   Expected-value source: the literal `exitCode: 7`, `runId: null` and
//   `state: 'exited'` fields written into the record, folded by the
//   already-tested `deriveProjectWaits` exited branch (task 2, D7).
//
// Criterion "a spec markdown write, a deferral record write and a HANDOFF
// write each give a new shell-specs within five seconds" (task 7 _Prompt;
// Requirement 5 AC 7) — three separate tests, one per trigger:
//   Pre-condition (each): the same fixture; an overview subscriber already
//   collecting `shell-specs` messages; a baseline count taken.
//   Test (markdown): write a new `.md` file under alpha's spec-a directory.
//   Test (deferral): `new DeferralStorage(alphaWorkflowRoot).create(...)`.
//   Test (HANDOFF): overwrite alpha's `HANDOFF.md` with different routing
//   text.
//   Observable result (each): within five seconds the count of collected
//   `shell-specs` messages exceeds the baseline.
//   Expected-value source: the task 7 _Prompt sentence naming the three
//   triggers; the count increase is the push itself, which Requirement 5 AC
//   7 requires with no reload.
//
// Criterion "a deferral write reaches an overview-only socket exactly once
// and a socket holding both views of that project exactly once" (task 7
// _Prompt; design D12, Requirement 7 AC 2):
//   Pre-condition: socket A sends only `{ type: 'overview-subscribe' }`
//   (views holds only `overview`, no bound project); socket B sends
//   `{ type: 'overview-subscribe' }` then `{ type: 'harness-subscribe',
//   projectId: alphaId }` (views holds `overview` and `harness`, projectId
//   alphaId — so it matches D12's rule on both grounds at once).
//   Test: `new DeferralStorage(alphaWorkflowRoot).create(...)`.
//   Observable result: within five seconds each socket's collected messages
//   contain exactly one `deferrals-update` message for alphaId; after a
//   further 500 ms wait each socket still holds exactly one.
//   Expected-value source: the task 7 _Prompt sentence ("sends the message
//   once to each open client whose projectId matches or whose views hold
//   overview") — "once" is the literal value under test, not a count this
//   test derives from the implementation.
//
// Criterion "the detail route gives 200 with no file content for a real
// spec, 404 for an encoded `..` spec name and 404 for an unknown project"
// (task 7 _Prompt; Requirement 5 AC 4) — three separate tests:
//   Pre-condition (each): the same fixture; server started.
//   Test (real spec): `GET /api/shell/projects/:alphaId/specs/spec-a`.
//   Test (encoded ..): `GET /api/shell/projects/:alphaId/specs/%2e%2e` (a
//   percent-encoded `..`, which the URL layer does not dot-segment-collapse,
//   unlike a literal `..`).
//   Test (unknown project): `GET /api/shell/projects/does-not-exist/specs/spec-a`.
//   Observable result: real spec gives 200 with exactly the SpecDetail keys
//   (`order`, `dependsOn`, `runs`, `phases`, `deferrals`, `files`) and no
//   `files` entry holding a `content` key; the other two give 404 with
//   `{ error: 'Spec not found' }` and `{ error: 'Project not found' }`.
//   Expected-value source: the task 7 _Prompt sentence giving the literal
//   404 bodies, and the `SpecDetail` interface (task 1, src/dashboard/shell
//   /types.ts) naming exactly those six keys with no content field.

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

describe('shell hub wiring and routes (task 7)', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  let alphaId: string;
  let betaId: string;
  let alphaWorkflowRoot: string;
  let alphaSpecDir: string;
  let alphaHandoffPath: string;
  let alphaLedgerPath: string;
  const sockets: WebSocket[] = [];
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `shell-routes-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stateHomeDir = join(tempDir, '.xdg-state');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;

    // Project alpha: HANDOFF routes to spec-a; ledger starts with only a
    // run.start row (no open phase yet).
    const alphaWorkspace = join(tempDir, 'alpha-workspace');
    alphaWorkflowRoot = join(tempDir, 'alpha-project');
    alphaSpecDir = join(alphaWorkflowRoot, '.spec-workflow', 'specs', 'spec-a');
    await fsp.mkdir(alphaSpecDir, { recursive: true });
    alphaHandoffPath = join(alphaWorkflowRoot, '.spec-workflow', 'HANDOFF.md');
    writeFileSync(alphaHandoffPath, handoffFixture('spec-a'));
    alphaLedgerPath = join(alphaSpecDir, 'harness-events.jsonl');
    writeFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-alpha-1', spec: 'spec-a',
    }) + '\n');

    // Project beta: HANDOFF routes to spec-b; no ledger, no specs dir at all (idle).
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

  it('sends shell-now and shell-specs to an overview subscriber', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);

    send(ws, { type: 'overview-subscribe' });

    await waitFor(() => messages.some((m) => m.type === 'shell-now'));
    await waitFor(() => messages.some((m) => m.type === 'shell-specs'));
  });

  it('shows a gate wait within five seconds of a gate-a phase.end append', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });
    await waitFor(() => messages.some((m) => m.type === 'shell-now'));

    appendFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:05.000Z', type: 'phase.start', run: 'run-alpha-1', phase: 'document', mode: 'auto', state: 'in-progress',
    }) + '\n');
    appendFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:10.000Z', type: 'phase.end', run: 'run-alpha-1', phase: 'document', result: 'gate-a',
    }) + '\n');

    await waitFor(() => {
      const last = messages.filter((m) => m.type === 'shell-now').pop();
      if (!last) return false;
      return last.data.waits.some((w: any) => w.kind === 'gate' && w.projectId === alphaId && w.spec === 'spec-a');
    }, 5000);
  });

  it('shows a retro wait within five seconds of a proposals write, cleared by an APPROVED plan', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });
    await waitFor(() => messages.some((m) => m.type === 'shell-now'));

    writeFileSync(join(alphaSpecDir, 'retrospective-proposals.md'), '- DECISION NEEDED: yes — pick a thing\n');

    await waitFor(() => {
      const last = messages.filter((m) => m.type === 'shell-now').pop();
      if (!last) return false;
      return last.data.waits.some((w: any) => w.kind === 'retro' && w.projectId === alphaId);
    }, 5000);

    writeFileSync(join(alphaSpecDir, 'retrospective-plan.md'), 'Status: APPROVED\n');

    await waitFor(() => {
      const last = messages.filter((m) => m.type === 'shell-now').pop();
      if (!last) return false;
      return !last.data.waits.some((w: any) => w.kind === 'retro' && w.projectId === alphaId);
    }, 5000);
  });

  it('shows an exited wait within five seconds of a launch-update for an exited record', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });
    await waitFor(() => messages.some((m) => m.type === 'shell-now'));

    const launcher: any = (server as any).harnessLauncher;
    const record: LaunchRecord = {
      projectId: alphaId,
      workflowRoot: join(alphaWorkflowRoot, '.spec-workflow'),
      spec: 'spec-a',
      pid: 424242,
      pgid: 424242,
      cwd: alphaWorkflowRoot,
      worktree: 'no',
      logPath: join(tempDir, 'fake-launch.log'),
      launchedAt: '2026-01-01T00:00:00.000Z',
      setupWrittenAt: '2026-01-01T00:00:00.000Z',
      runId: null,
      state: 'exited',
      exitCode: 7,
      signal: null,
      stopRequestedAt: null,
      endedAt: '2026-01-01T00:10:00.000Z',
      note: null,
    };
    launcher.records.set(alphaId, record);
    launcher.emit('launch-update', record);

    await waitFor(() => {
      const last = messages.filter((m) => m.type === 'shell-now').pop();
      if (!last) return false;
      return last.data.waits.some((w: any) =>
        w.kind === 'exited' && w.projectId === alphaId && w.detail.exitCode === 7
      );
    }, 5000);
  });

  it('gives a new shell-specs within five seconds of a spec markdown write', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });
    await waitFor(() => messages.some((m) => m.type === 'shell-specs'));
    const baseline = messages.filter((m) => m.type === 'shell-specs').length;

    writeFileSync(join(alphaSpecDir, 'design.md'), '# Design\n');

    await waitFor(() => messages.filter((m) => m.type === 'shell-specs').length > baseline, 5000);
  });

  it('gives a new shell-specs within five seconds of a deferral record write', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });
    await waitFor(() => messages.some((m) => m.type === 'shell-specs'));
    const baseline = messages.filter((m) => m.type === 'shell-specs').length;

    await new DeferralStorage(alphaWorkflowRoot).create({
      title: 'A deferred decision',
      originSpec: 'spec-a',
      originPhase: 'design',
      revisitTrigger: 'later',
      tags: [],
      supersedes: null,
      body: { context: 'ctx', decision: 'dec', revisitCriteria: 'crit' },
    });

    await waitFor(() => messages.filter((m) => m.type === 'shell-specs').length > baseline, 5000);
  });

  it('gives a new shell-specs within five seconds of a HANDOFF write', async () => {
    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });
    await waitFor(() => messages.some((m) => m.type === 'shell-specs'));
    const baseline = messages.filter((m) => m.type === 'shell-specs').length;

    writeFileSync(alphaHandoffPath, handoffFixture('spec-a') + '\n> re-routed.\n');

    await waitFor(() => messages.filter((m) => m.type === 'shell-specs').length > baseline, 5000);
  });

  it('sends a deferral push exactly once to an overview-only socket and once to a dual-view socket', async () => {
    const overviewOnly = await connect(port);
    sockets.push(overviewOnly);
    const overviewOnlyMessages = collect(overviewOnly);
    send(overviewOnly, { type: 'overview-subscribe' });
    await waitFor(() => overviewOnlyMessages.some((m) => m.type === 'shell-now'));

    const dualView = await connect(port);
    sockets.push(dualView);
    const dualViewMessages = collect(dualView);
    send(dualView, { type: 'overview-subscribe' });
    send(dualView, { type: 'harness-subscribe', projectId: alphaId });
    await waitFor(() => dualViewMessages.some((m) => m.type === 'harness-model' && m.projectId === alphaId));

    await new DeferralStorage(alphaWorkflowRoot).create({
      title: 'Another deferred decision',
      originSpec: 'spec-a',
      originPhase: 'design',
      revisitTrigger: 'later',
      tags: [],
      supersedes: null,
      body: { context: 'ctx', decision: 'dec', revisitCriteria: 'crit' },
    });

    const countFor = (msgs: any[]) =>
      msgs.filter((m) => m.type === 'deferrals-update' && m.projectId === alphaId).length;

    await waitFor(() => countFor(overviewOnlyMessages) === 1 && countFor(dualViewMessages) === 1, 5000);

    // Give any duplicate send a chance to land before asserting it stayed at one.
    await sleep(500);
    expect(countFor(overviewOnlyMessages)).toBe(1);
    expect(countFor(dualViewMessages)).toBe(1);
  });

  it('GET spec detail returns 200 with no file content for a real spec', async () => {
    const res = await realFetch(`http://127.0.0.1:${port}/api/shell/projects/${alphaId}/specs/spec-a`);
    expect(res.status).toBe(200);
    const body: any = await res.json();

    expect(Object.keys(body).sort()).toEqual(
      ['deferrals', 'dependsOn', 'files', 'order', 'phases', 'runs'].sort()
    );
    for (const file of body.files) {
      expect(Object.prototype.hasOwnProperty.call(file, 'content')).toBe(false);
    }
  });

  it('GET spec detail returns 404 for an encoded .. spec name', async () => {
    // %2e%2e is a percent-encoded '..': the URL layer does not dot-segment
    // collapse it, so it reaches the server as the literal path segment
    // '%2e%2e', which Fastify decodes back to '..' for the route param.
    const res = await realFetch(`http://127.0.0.1:${port}/api/shell/projects/${alphaId}/specs/%2e%2e`);
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body).toEqual({ error: 'Spec not found' });
  });

  it('GET spec detail returns 404 for an unknown project', async () => {
    const res = await realFetch(`http://127.0.0.1:${port}/api/shell/projects/does-not-exist/specs/spec-a`);
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body).toEqual({ error: 'Project not found' });
  });
});
