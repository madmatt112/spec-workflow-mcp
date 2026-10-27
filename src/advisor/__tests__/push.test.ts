import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { createServer, type Server } from 'http';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { WaitPusher } from '../push.js';
import { pushConfigPath, pushedPath, eventsPath } from '../home.js';
import { createWait, answerWait, attachAdvice, listOpenWaits, type ControllerWaitRecord } from '../../controller/waits.js';

// Contract for src/advisor/push.ts (design.md C11, D2, D3; requirements.md
// Requirement 10.1-10.5, NFR Security; task 15 _Prompt). design.md pins only
// `WaitPusher { start(); stop() }`; the constructor's options are not shown
// beyond that, so this file fixes the one knob the tests need —
// `retryDelayMs`, overriding the production one-minute delay (Requirement
// 10.5) so the retry test does not really wait 60 seconds — the same way
// opinion.test.ts and overview-watch.test.ts each fix a shape design.md left
// as shorthand.
//
// No collaborator inside push.ts is mocked: every wait is written through the
// real `createWait`/`answerWait`/`attachAdvice` (src/controller/waits.ts),
// read back through the real `listOpenWaits`, and a push is a real HTTP POST
// from push.ts to a plain `http.createServer` standing in for the operator's
// ntfy-style endpoint (the same "local capture server" pattern
// src/advisor/__tests__/search.test.ts uses for its fake Ollama). Each test
// runs against a fresh temp SDD_HOME so the real home is never touched.
//
// Criterion "first start pushes nothing" (design D3, C11 "On start: no
//   pushed.json -> record every open wait id, push none"; Requirement 10.3):
//   Pre-condition: one open wait already on disk before any WaitPusher has
//   ever run (no pushed.json yet); a working push.json pointing at a capture
//   server.
//   Test: new WaitPusher({}).start().
//   Observable result: the capture server receives zero requests; pushed.json
//   ends up holding the wait's id.
//   Expected-value source: design C11's "record every open wait id, push
//   none" sentence, cited directly to D3.
//
// Criterion "a wait file written by a child node process pushes once, body
//   has exactly the four keys" (Requirement 10.1, 10.2; NFR Security):
//   Pre-condition: a started WaitPusher with no waits yet on disk; a push.json
//   naming the capture server and a dashboardUrl.
//   Test: a separate `node --import tsx` child process calls the real
//   `createWait` directly (write-wait-child.ts), writing one open wait with a
//   distinctive question text; then new WaitPusher({}).start() having already
//   run, waitFor the capture server to receive a request.
//   Observable result: the capture server receives exactly one request,
//   whose JSON body's keys are exactly `kind`, `project`, `spec`,
//   `dashboardUrl`, with the wait's own kind/project/spec and the configured
//   dashboardUrl, and whose serialised body never contains the question text.
//   Expected-value source: design C11 "Body: kind, project name, spec and
//   dashboardUrl from push.json, nothing else" and requirements.md NFR
//   Security "no question text ... "; the literal kind/project/spec/text
//   values are the ones this test's own fixture and child-process args set.
//
// Criterion "answering or attaching advice does not repush" (Requirement
//   10.3):
//   Pre-condition: a wait already pushed once (via the child-process route
//   above).
//   Test: answerWait(id, ...) then attachAdvice(id, ...) on that same id,
//   each of which rewrites the wait file chokidar is watching.
//   Observable result: the capture server's request count stays at 1 after
//   both calls settle.
//   Expected-value source: design C11 "an open wait not yet recorded is
//   added to pushed.json" (recorded means never pushed twice), Requirement
//   10.3's "an answer or an advice attach SHALL NOT push again".
//
// Criterion "a restart does not repush" (Requirement 10.3):
//   Pre-condition: a first WaitPusher that has already run its first-start
//   baseline over one open wait (recording it without pushing, D3), then
//   stopped.
//   Test: a second, independent `new WaitPusher({}).start()` against the same
//   home (standing in for a process restart) while that wait is still open.
//   Observable result: the capture server still receives zero requests after
//   the second start settles.
//   Expected-value source: design C11's "else push each open wait not in it"
//   branch combined with D3 (the first pusher already recorded the id without
//   pushing), cited to Requirement 10.3's "a restart ... SHALL NOT push
//   again".
//
// Criterion "a failing endpoint gives one retry then one push.failure row;
//   the wait is unaffected" (Requirement 10.5; error handling #8 "the id
//   stays in pushed.json, so it never repeats"):
//   Pre-condition: push.json points at a server that destroys the connection
//   on every request (an unambiguous POST failure); a started WaitPusher with
//   `retryDelayMs` set small for the test.
//   Test: a child process writes one open wait, so the pusher attempts to
//   push it.
//   Observable result: the server is hit exactly twice (the attempt and its
//   one retry); events.jsonl gains exactly one `push.failure` row naming the
//   wait; pushed.json still holds the wait's id; the wait record read back
//   through listOpenWaits is still `state: 'open'` with no `answer` or
//   `advice`.
//   Expected-value source: requirements.md 10.5 ("retry once after one
//   minute, then log the failure ... the wait and the run SHALL be
//   unaffected") and design error handling #8, combined with this test's own
//   fixture values (which kind/project/spec it wrote, so nothing else could
//   have produced them).
//
// Criterion "no config sends nothing" (Requirement 10.4):
//   Pre-condition: no push.json file in the home at all.
//   Test: a started WaitPusher, then a child process writes one open wait.
//   Observable result: events.jsonl gains no `push.failure` row (nothing was
//   even attempted, so nothing could have failed either).
//   Expected-value source: requirements.md 10.4 "IF push.json is absent THEN
//   no push SHALL be sent", and design error handling #8 (a failure is what
//   produces a `push.failure` row; absent config produces neither a send nor
//   that row).
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const CHILD_SCRIPT = join(HERE, 'helpers', 'write-wait-child.ts');
const DASHBOARD_URL = 'http://localhost:4321/p/testproj';

let home: string;
let savedSddHome: string | undefined;
let pushers: WaitPusher[];
let servers: { close(): Promise<void> }[];

beforeEach(() => {
  savedSddHome = process.env.SDD_HOME;
  home = mkdtempSync(join(tmpdir(), 'sdd-advisor-push-'));
  process.env.SDD_HOME = home;
  pushers = [];
  servers = [];
});

afterEach(async () => {
  for (const pusher of pushers) {
    try {
      pusher.stop();
    } catch {
      // best effort
    }
  }
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  await Promise.all(servers.map((s) => s.close()));
  rmSync(home, { recursive: true, force: true });
});

function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 5000, intervalMs = 25): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = async () => {
      if (await predicate()) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error('waitFor: timed out'));
        return;
      }
      setTimeout(check, intervalMs);
    };
    void check();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** A capture server standing in for the operator's ntfy-style push.json url. */
async function startCaptureServer(): Promise<{ url: string; requests: unknown[]; close(): Promise<void> }> {
  const requests: unknown[] = [];
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      try {
        requests.push(JSON.parse(raw));
      } catch {
        requests.push(raw);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/** A server that destroys the connection on every request: an unambiguous POST failure. */
async function startFailingServer(): Promise<{ url: string; counter: { count: number }; close(): Promise<void> }> {
  const counter = { count: 0 };
  const server: Server = createServer((req) => {
    counter.count += 1;
    req.socket.destroy();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    counter,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

async function writePushConfig(url: string, dashboardUrl: string): Promise<void> {
  await fs.mkdir(dirname(pushConfigPath()), { recursive: true });
  await fs.writeFile(pushConfigPath(), JSON.stringify({ v: 1, url, dashboardUrl }), 'utf-8');
}

async function readPushedIds(): Promise<string[]> {
  try {
    const raw = await fs.readFile(pushedPath(), 'utf-8');
    return (JSON.parse(raw) as { v: 1; ids: string[] }).ids;
  } catch {
    return [];
  }
}

async function readEventRows(): Promise<Array<Record<string, unknown>>> {
  try {
    const raw = await fs.readFile(eventsPath(), 'utf-8');
    return raw
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
  } catch {
    return [];
  }
}

async function makeOpenWait(spec: string, project: string): Promise<ControllerWaitRecord> {
  return createWait({
    kind: 'question',
    runId: 'in-process-run',
    projectId: project,
    spec,
    specDir: join(home, 'spec-dir'),
    questions: [{ id: 'q1', text: 'local-process question text', options: ['A', 'B'] }],
  });
}

/** Spawn the write-wait-child.ts helper against this test's SDD_HOME; resolves on exit. */
function writeWaitFromChildProcess(
  kind: string,
  projectId: string,
  spec: string,
  questionId: string,
  questionText: string,
): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', CHILD_SCRIPT, kind, projectId, spec, questionId, questionText],
      { cwd: REPO_ROOT, env: { ...process.env, SDD_HOME: home }, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stderr = '';
    child.stderr!.on('data', (c) => {
      stderr += c;
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve({ code, stderr }));
  });
}

describe('WaitPusher', () => {
  it('on the very first start, with an open wait already on disk and no pushed.json, records the id but pushes nothing (D3, 10.3)', async () => {
    const wait = await makeOpenWait('spec-a', 'proj-a');
    const capture = await startCaptureServer();
    servers.push(capture);
    await writePushConfig(capture.url, DASHBOARD_URL);

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();
    await sleep(300);

    expect(capture.requests).toHaveLength(0);
    expect(await readPushedIds()).toContain(wait.id);
  });

  it('a wait file written by a separate child process is pushed exactly once, with a body of exactly the four keys and no leaked text (10.1, 10.2, NFR Security)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writePushConfig(capture.url, DASHBOARD_URL);

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    const secretQuestion = 'This question text must never leave the machine';
    const result = await writeWaitFromChildProcess('question', 'proj-child', 'spec-child', 'q1', secretQuestion);
    expect(result.code).toBe(0);

    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    const body = capture.requests[0] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['dashboardUrl', 'kind', 'project', 'spec']);
    expect(body).toEqual({ kind: 'question', project: 'proj-child', spec: 'spec-child', dashboardUrl: DASHBOARD_URL });
    expect(JSON.stringify(body)).not.toContain(secretQuestion);
  }, 10000);

  it('answering a wait or attaching advice after it has already been pushed does not push it again (10.3)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writePushConfig(capture.url, DASHBOARD_URL);

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    const result = await writeWaitFromChildProcess('question', 'proj-c', 'spec-c', 'q1', 'question text');
    expect(result.code).toBe(0);
    await waitFor(() => capture.requests.length > 0);
    expect(capture.requests).toHaveLength(1);

    const wait = (await listOpenWaits()).find((w) => w.project === 'proj-c');
    expect(wait).toBeDefined();

    await answerWait(wait!.id, { q1: 'A' }, 'operator');
    await attachAdvice(wait!.id, 'advice text', {
      picks: [{ question: 'q1', pick: 'A', reason: 'reason' }],
      summary: 'summary',
    });
    await sleep(400);

    expect(capture.requests).toHaveLength(1);
  }, 10000);

  it('a restart (a second, independent WaitPusher against the same home) does not repush an already-recorded, still-open wait (10.3)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writePushConfig(capture.url, DASHBOARD_URL);

    const wait = await makeOpenWait('spec-d', 'proj-d');

    const firstPusher = new WaitPusher({});
    pushers.push(firstPusher);
    await firstPusher.start();
    await sleep(300);
    expect(capture.requests).toHaveLength(0);
    expect(await readPushedIds()).toContain(wait.id);
    firstPusher.stop();

    const secondPusher = new WaitPusher({});
    pushers.push(secondPusher);
    await secondPusher.start();
    await sleep(300);

    expect(capture.requests).toHaveLength(0);
  });

  it('a push that fails retries exactly once, then logs one push.failure row; the wait stays open and unmodified (10.5)', async () => {
    const failing = await startFailingServer();
    servers.push(failing);
    await writePushConfig(failing.url, DASHBOARD_URL);

    const pusher = new WaitPusher({ retryDelayMs: 30 });
    pushers.push(pusher);
    await pusher.start();

    const result = await writeWaitFromChildProcess('question', 'proj-e', 'spec-e', 'q1', 'question text');
    expect(result.code).toBe(0);

    await waitFor(async () => (await readEventRows()).some((r) => r.type === 'push.failure'), 5000);
    await sleep(200);

    expect(failing.counter.count).toBe(2);

    const failureRows = (await readEventRows()).filter((r) => r.type === 'push.failure');
    expect(failureRows).toHaveLength(1);
    expect(typeof failureRows[0].wait).toBe('string');
    expect((failureRows[0].wait as string).length).toBeGreaterThan(0);

    const wait = (await listOpenWaits()).find((w) => w.project === 'proj-e');
    expect(wait).toBeDefined();
    expect(wait!.state).toBe('open');
    expect(wait!.answer).toBeUndefined();
    expect(wait!.advice).toBeUndefined();

    expect(await readPushedIds()).toContain(wait!.id);
  }, 10000);

  it('with no push.json in the home at all, nothing is attempted and no push.failure is logged (10.4)', async () => {
    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    const result = await writeWaitFromChildProcess('question', 'proj-f', 'spec-f', 'q1', 'question text');
    expect(result.code).toBe(0);
    await sleep(400);

    const failureRows = (await readEventRows()).filter((r) => r.type === 'push.failure');
    expect(failureRows).toHaveLength(0);
  }, 10000);
});
