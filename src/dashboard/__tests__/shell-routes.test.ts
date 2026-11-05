import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp, writeFileSync, appendFileSync, chmodSync, mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import net from 'net';
import { WebSocket } from 'ws';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { HarnessHub } from '../harness/hub.js';
import type { ProjectManager } from '../project-manager.js';
import { ProjectRegistry, generateProjectId } from '../../core/project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { DeferralStorage } from '../../core/deferral-storage.js';
import { loadOrCreateSecret } from '../../controller/access.js';
import { readRun, writeJsonAtomic } from '../../controller/state.js';
import { deployEvents, deployRecordPath, type ControllerDeploy } from '../../controller/deploy.js';

const STUB_CLAUDE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'stub-claude.mjs');

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
//
// Contract addition for task 10 (design.md C7; task 10 _Prompt; Requirement
// 6 AC 9). Reached through the same real server/ws fixture as the rest of
// this file; the record is seeded directly on disk with `writeJsonAtomic`
// (task 2's writer), the same way the self-update script would.
//
// Criterion "an overview subscriber's first messages carry a seeded record"
//   (task 10 _Prompt Success: "an overview subscriber's first messages
//   carry a seeded record"; Requirement 6 AC 9 "the page reconnects ...
//   receives the current record with the first feed flush" — a fresh
//   subscribe rides the same `overview-subscribe` -> `overviewSnapshot()`
//   path a reconnect does):
//   Pre-condition: `deploy.json` written directly at stage 'build' before
//   any client connects.
//   Test: connect a ws client, send `{ type: 'overview-subscribe' }`.
//   Observable result: within five seconds a `controller-deploy` message
//   arrives whose `data` is `{ deploy: { stage: 'build', runs: ['run-x'],
//   started } }`.
//   Expected-value source: the literal stage/runs/started fields written
//   into the seeded record.

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
  let betaWorkflowRoot: string;
  let secret: string;
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
    // The workspace path must exist on disk, or the startup missing-path prune
    // (R4 AC1) drops the registration before the server lists it.
    await fsp.mkdir(alphaWorkspace, { recursive: true });
    alphaWorkflowRoot = join(tempDir, 'alpha-project');
    alphaSpecDir = join(alphaWorkflowRoot, '.spec-workflow', 'specs', 'spec-a');
    await fsp.mkdir(alphaSpecDir, { recursive: true });
    // Pre-create the deferrals directory so the project watcher's
    // `${workflowRoot}/deferrals/*.md` glob sees a later deferral create. The
    // watcher does not detect files in a deferrals dir that did not exist when
    // it started (chokidar glob limitation), so without this the project
    // manager's `deferral-change` event never fires.
    await fsp.mkdir(join(alphaWorkflowRoot, '.spec-workflow', 'deferrals'), { recursive: true });
    alphaHandoffPath = join(alphaWorkflowRoot, '.spec-workflow', 'HANDOFF.md');
    // Two extra closed specs for the usage route (task 12): one with a
    // closeout/closed row (a close date), one closed only via the retro plan
    // (no closeout row, no ledger — a null close date). spec-a itself stays
    // open (run.start only), unaffected by these extra phase-log rows, which
    // are keyed to different spec names.
    await fsp.mkdir(join(alphaWorkflowRoot, '.spec-workflow', 'specs', 'spec-alpha-recent'), { recursive: true });
    await fsp.mkdir(join(alphaWorkflowRoot, '.spec-workflow', 'specs', 'spec-alpha-none'), { recursive: true });
    writeFileSync(
      join(alphaWorkflowRoot, '.spec-workflow', 'specs', 'spec-alpha-none', 'retrospective-plan.md'),
      'Status: CLOSED — all decisions made\n',
    );
    writeFileSync(alphaHandoffPath, [
      handoffFixture('spec-a'),
      '',
      '## Phase log',
      '',
      '| Date | Spec | Stage | State | Result | Note |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 2026-03-15 | spec-alpha-recent | closeout | complete | closed | done |',
      '',
    ].join('\n'));
    // alpha's agent-rules.md is a directory, not a file (task 12 success
    // clause): readAgentRules must still give no baseline, never throw.
    await fsp.mkdir(join(alphaWorkflowRoot, '.spec-workflow', 'agent-rules.md'), { recursive: true });
    alphaLedgerPath = join(alphaSpecDir, 'harness-events.jsonl');
    writeFileSync(alphaLedgerPath, JSON.stringify({
      ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'run-alpha-1', spec: 'spec-a',
    }) + '\n');

    // Project beta: HANDOFF routes to spec-b; no ledger for spec-b (idle). One
    // closed spec (spec-beta-mid) for the usage route.
    const betaWorkspace = join(tempDir, 'beta-workspace');
    await fsp.mkdir(betaWorkspace, { recursive: true });
    betaWorkflowRoot = join(tempDir, 'beta-project');
    await fsp.mkdir(join(betaWorkflowRoot, '.spec-workflow', 'specs', 'spec-beta-mid'), { recursive: true });
    writeFileSync(join(betaWorkflowRoot, '.spec-workflow', 'HANDOFF.md'), [
      handoffFixture('spec-b'),
      '',
      '## Phase log',
      '',
      '| Date | Spec | Stage | State | Result | Note |',
      '| --- | --- | --- | --- | --- | --- |',
      '| 2026-02-10 | spec-beta-mid | closeout | complete | closed | done |',
      '',
    ].join('\n'));

    const registry = new ProjectRegistry();
    await registry.registerProject(alphaWorkspace, process.pid, { workflowRootPath: alphaWorkflowRoot });
    await registry.registerProject(betaWorkspace, process.pid, { workflowRootPath: betaWorkflowRoot });
    alphaId = generateProjectId(alphaWorkspace);
    betaId = generateProjectId(betaWorkspace);

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    // The mutating harness launch route (used by the task 9 driven-row test
    // below) needs the shared secret (access control, controller-design.md §17).
    secret = await loadOrCreateSecret();
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

  it('GET spec detail returns 404 for an encoded traversal spec name', async () => {
    // %2e%2e%2fsecret is a percent-encoded '../secret'. A standalone encoded
    // '..' segment is dot-segment collapsed by the WHATWG URL layer (undici's
    // fetch) before the request is sent, so it never reaches the route; keeping
    // the encoded '/' (%2f) makes it a single path segment that reaches the
    // route param as '../secret', which the detail builder's name guard rejects.
    const res = await realFetch(`http://127.0.0.1:${port}/api/shell/projects/${alphaId}/specs/%2e%2e%2fsecret`);
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

  // Contract for task 12 (design.md C10; Requirement 3 AC1, AC10).
  //
  // Criterion "the route returns 200 with the rows of two projects in the
  // stated order" (task 12 _Prompt Success clause; design C10 post-condition
  // "sorted by projectName, then by closeDate newest first with null last"):
  //   Pre-condition: the fixture's three closed specs — alpha's
  //   spec-alpha-recent (closeout/closed 2026-03-15), alpha's spec-alpha-none
  //   (closed via the retro plan, no closeout row, no ledger — a null close
  //   date) and beta's spec-beta-mid (closeout/closed 2026-02-10); alpha's
  //   projectName sorts before beta's (both are "<repo> . <workspace>", and
  //   "alpha-project" < "beta-project"); spec-a (alpha, open) and spec-b
  //   (beta, never created) are not closed and carry no row.
  //   Test: `GET /api/shell/usage/closed-specs`.
  //   Observable result: status 200; `body.rows` has exactly three entries, in
  //   the order spec-alpha-recent (closeDate '2026-03-15'), spec-alpha-none
  //   (closeDate null), spec-beta-mid (closeDate '2026-02-10') — alpha's rows
  //   first (projectName), newest close date first within alpha with the null
  //   row last, then beta's row.
  //   Expected-value source: the literal dates and spec names written into
  //   each project's HANDOFF phase log and retro plan in `beforeEach`, folded
  //   by the route's stated sort (design C10).
  it('returns the closed-spec rows of two projects sorted by project then close date, null last', async () => {
    const res = await realFetch(`http://127.0.0.1:${port}/api/shell/usage/closed-specs`);
    expect(res.status).toBe(200);
    const body: any = await res.json();

    expect(body.rows.map((r: any) => r.spec)).toEqual([
      'spec-alpha-recent',
      'spec-alpha-none',
      'spec-beta-mid',
    ]);
    expect(body.rows.map((r: any) => r.closeDate)).toEqual([
      '2026-03-15',
      null,
      '2026-02-10',
    ]);
    expect(body.rows.every((r: any) => r.projectId === alphaId || r.projectId === betaId)).toBe(true);
  });

  // Criterion "a project whose agent-rules.md path is a directory still
  // yields rows with baseline: null" (task 12 _Prompt Success clause):
  //   Pre-condition: alpha's `.spec-workflow/agent-rules.md` is a directory,
  //   not a file (`beforeEach`), and alpha has a closed spec
  //   (spec-alpha-recent).
  //   Test: `GET /api/shell/usage/closed-specs`.
  //   Observable result: status 200 (not an error response), and the row for
  //   spec-alpha-recent has `baseline: null`.
  //   Expected-value source: `readAgentRules`'s directory-read catch
  //   (`src/dashboard/harness/run-setup.ts:49-55`, EISDIR giving `undefined`)
  //   gives no `baseline-w-per-task` key, which `buildUsageRows`
  //   (`src/dashboard/shell/usage-rows.ts:41`) reads as `baseline: null`; the
  //   route must reach this through the full request without an error status
  //   (NFR Reliability, task 12 Restrictions).
  it('still returns 200 with baseline null for a project whose agent-rules.md path is a directory', async () => {
    const res = await realFetch(`http://127.0.0.1:${port}/api/shell/usage/closed-specs`);
    expect(res.status).toBe(200);
    const body: any = await res.json();

    const row = body.rows.find((r: any) => r.spec === 'spec-alpha-recent');
    expect(row).toBeDefined();
    expect(row.baseline).toBeNull();
  });

  // Contract for task 9 (design C4, C7 hub bullet "`src/dashboard/multi-server
  // .ts:165-169` passes `{ drivenRuns: () => this.controller.drivenRuns() }`";
  // Requirements 2.1, 3.1). Pre-condition: alpha's already-registered spec-a
  // (routed `active` by alphaHandoffPath) is launched for real through
  // `POST /api/projects/:alphaId/harness/launch`, scripted with a delayed
  // claude stub (the task's restriction: no real `claude` ever spawns) and
  // polled until `inFlight` is set. Call: an overview-subscribed ws client's
  // `controller-runs` messages. Observable result: within five seconds a
  // `controller-runs` message carries a row for that run id with
  // `driven: true`. Expected-value source: design C4's "`driven:
  // driven.has(run.id)`" with the real controller's own live id in the set,
  // which only reaches the overview feed once `HarnessHub` is built with the
  // `drivenRuns` closure (the bridge task 9 removes).
  it('a controller-runs row on an overview socket reads driven: true during a drive', async () => {
    chmodSync(STUB_CLAUDE, 0o755);
    const scriptPath = join(tempDir, 'claude-script-h.json');
    writeFileSync(scriptPath, JSON.stringify([{
      result: {
        subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'ok',
        structured_output: {}, usage: {},
      },
      delayMs: 800,
    }]));
    process.env.CONTROLLER_CLAUDE_BIN = STUB_CLAUDE;
    process.env.STUB_CLAUDE_SCRIPT = scriptPath;

    const launchRes = await realFetch(`http://127.0.0.1:${port}/api/projects/${alphaId}/harness/launch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({
        spec: 'spec-a', supervisorModel: 'claude-opus-5-5', worktree: 'no', gates: 'block', roles: {},
      }),
    });
    const launchBody: any = await launchRes.json();
    expect(launchRes.status).toBe(200);
    const runId = launchBody.runId as string;

    const deadline = Date.now() + 5000;
    for (;;) {
      const run = await readRun(runId);
      if (run?.inFlight) break;
      if (Date.now() > deadline) throw new Error(`run ${runId} never went in flight`);
      await new Promise((r) => setTimeout(r, 25));
    }

    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });

    await waitFor(() => messages
      .filter((m) => m.type === 'controller-runs')
      .some((m) => m.data.runs.some((r: any) => r.id === runId && r.driven === true)), 5000);
  }, 15000);

  it('carries a seeded deploy record on an overview subscriber\'s first controller-deploy message', async () => {
    const started = '2026-11-05T09:00:00.000Z';
    await writeJsonAtomic(deployRecordPath(), {
      v: 1, stage: 'build', runs: ['run-x'], started, unitStarted: true,
    });

    const ws = await connect(port);
    sockets.push(ws);
    const messages = collect(ws);
    send(ws, { type: 'overview-subscribe' });

    await waitFor(() => messages.some((m) => m.type === 'controller-deploy'), 5000);
    const msg = messages.find((m) => m.type === 'controller-deploy');
    expect(msg.data).toEqual({ deploy: { stage: 'build', runs: ['run-x'], started } });
  });
});

// Contract additions for task 10 (design.md C7 hub bullet; task 10 _Prompt;
// NFR Performance). Reached only through `new HarnessHub(...)`, `.reconcile()`
// and `.close()`; `deployEvents` (task 2's real, non-mocked EventEmitter) is
// the event source, so these tests exercise the actual listener HarnessHub
// adds and removes, not a stub of it.
//
// Criterion "a change event reaches an overview subscriber within 2 seconds"
//   (task 10 _Prompt Success: "a change event on the hub reaches an
//   overview subscriber within 2 seconds"; NFR Performance "a stage ...
//   SHALL reach a connected page within 2 seconds"):
//   Pre-condition: a HarnessHub reconciled with one overview-view client
//   (no project, no harness view), so its ShellFeed and overview watch are
//   live.
//   Test: `deployEvents.emit('change', deploy)`, timed from emission.
//   Observable result: within 2000 ms the hub's `sendOverview` callback is
//   called with `{ type: 'controller-deploy', data: { deploy } }`.
//   Expected-value source: the literal "within 2 seconds" of the NFR
//   Performance requirement, and the deploy payload given to `emit`.
//
// Criterion "after the hub closes, a change event sends nothing" (task 10
//   _Prompt Success: "after the hub closes, a change event sends
//   nothing"):
//   Pre-condition: the same reconciled hub, then `hub.close()`.
//   Test: `deployEvents.emit('change', deploy)` after `close()`.
//   Observable result: the `sendOverview` callback is not called again
//   within 200 ms.
//   Expected-value source: the literal "sends nothing" of the _Prompt
//   sentence, which pins `HarnessHub` removing its `deployEvents` listener
//   in `close()` (design C7, hub.ts:139-154).
describe('controller-deploy change events on the harness hub (task 10)', () => {
  const hubs: HarnessHub[] = [];
  const projectDirs: string[] = [];

  // One real project directory, so the overview watch's handoff glob
  // (`handoffPaths()`) is non-empty: chokidar never emits `ready` for an
  // empty path list, which would hang `OverviewWatch.start()`'s
  // `whenReady()` forever (overview-watch.ts:254-255 notes the same gap for
  // the ledger watcher).
  function stubProjectManager(): ProjectManager {
    const projectPath = mkdtempSync(join(tmpdir(), 'hub-task10-proj-'));
    mkdirSync(join(projectPath, '.spec-workflow'), { recursive: true });
    projectDirs.push(projectPath);
    const project = {
      projectId: 'proj-task10', projectName: 'Task10 Project', projectPath, workspacePath: projectPath,
      workflowRootPath: projectPath,
    };
    const pm = new EventEmitter();
    (pm as unknown as { getAllProjects: () => unknown[] }).getAllProjects = () => [project];
    return pm as unknown as ProjectManager;
  }

  async function reconciledHub(onOverview: (m: unknown) => void): Promise<HarnessHub> {
    const hub = new HarnessHub(stubProjectManager(), () => { /* no harness subscribers */ }, onOverview);
    hubs.push(hub);
    await hub.reconcile([{ views: new Set(['overview']) }]);
    return hub;
  }

  afterEach(() => {
    for (const hub of hubs.splice(0)) hub.close();
    for (const dir of projectDirs.splice(0)) {
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* already gone */ }
    }
  });

  it('forwards a deployEvents change to an overview subscriber within 2 seconds', async () => {
    const sends: any[] = [];
    await reconciledHub((m) => sends.push(m));
    sends.length = 0;

    const deploy: ControllerDeploy = { stage: 'build', runs: ['run-1'], started: '2026-11-05T09:00:00.000Z' };
    const t0 = Date.now();
    deployEvents.emit('change', deploy);

    await waitFor(() => sends.some((m) => m.type === 'controller-deploy'), 2000, 5);
    expect(Date.now() - t0).toBeLessThan(2000);
    const msg = sends.find((m) => m.type === 'controller-deploy');
    expect(msg.data).toEqual({ deploy });
  });

  it('sends nothing on a deployEvents change after the hub closes', async () => {
    const sends: any[] = [];
    const hub = await reconciledHub((m) => sends.push(m));
    hub.close();
    sends.length = 0;

    deployEvents.emit('change', { stage: 'done', runs: [], started: '2026-11-05T09:00:00.000Z' });
    await sleep(200);

    expect(sends.length).toBe(0);
  });
});
