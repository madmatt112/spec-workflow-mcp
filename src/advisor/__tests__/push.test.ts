import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { createServer, type Server } from 'http';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { WaitPusher, buildMessage } from '../push.js';
import { notifyConfigPath, pushedPath, eventsPath } from '../home.js';
import { createWait, listOpenWaits, answerWait, expireWait, type ControllerWaitRecord } from '../../controller/waits.js';
import { writeProjects, writeWait, controllerHome, type WaitRecord, type KnownProject } from '../../controller/state.js';

// Contract for `buildMessage` (src/advisor/push.ts, design.md C9, D12;
// requirements.md 4.3, 4.8, 5.1; task 11 _Prompt). Pure: no fs, no fetch, no
// clock; every case below calls `buildMessage` directly on a plain
// `WaitRecord` literal, never through the pusher.
//
// Criterion (a) "body line 1 holds kind, project name and spec" (4.3):
//   Pre-condition: a wait with kind 'question', spec 'spec-a'.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: body's first line is exactly
//   'question | Acme Project | spec-a'.
//   Expected-value source: design C9 "Body line 1: `${kind} | ${projectName}
//   | ${spec}`".
//
// Criterion (b) "the title is `SDD ` plus the kind" (4.3):
//   Pre-condition: a wait with kind 'escalation'.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: title === 'SDD escalation'.
//   Expected-value source: design C9 "Title: `SDD ${kind}`".
//
// Criterion (c) "a reminder prefixes body line 1 and uses the reminder
//   title" (5.1):
//   Pre-condition: the same wait as (a)/(b), kind 'question', spec 'spec-a'.
//   Test: buildMessage(wait, 'Acme Project', true).
//   Observable result: body's first line is exactly
//   'Reminder: question | Acme Project | spec-a'; title ===
//   'SDD reminder: question'.
//   Expected-value source: design C9 "prefixed `Reminder: ` for a reminder"
//   and "Title: ... or `SDD reminder: ${kind}`".
//
// Criterion (d) "body line 2 is the trimmed first line of the first
//   question" (4.3):
//   Pre-condition: a wait whose first question's text is
//   '  hello operator  '.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: body's second line is exactly 'hello operator'.
//   Expected-value source: design C9 "Body line 2:
//   `wait.questions[0].text.trim()` cut at the first line break".
//
// Criterion (e) "multi-line text keeps only that line" (4.3):
//   Pre-condition: a wait whose first question's text is
//   'first line\nsecond line\nthird line'.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: body's second line is exactly 'first line'; the body
//   has exactly two lines.
//   Expected-value source: design C9 "cut at the first line break".
//
// Criterion (f) "a wait with no question has no line 2" (4.3):
//   Pre-condition: a wait whose questions array is empty.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: body has no newline and equals line 1 alone.
//   Expected-value source: design C9 "left out when the wait has no
//   question".
//
// Criterion (g) "an absolute path redacts to `[path]`" (4.8):
//   Pre-condition: a wait whose first question's text is
//   '/home/mcf/repo/x.ts failed to load'.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: body's second line is exactly '[path] failed to
//   load'.
//   Expected-value source: design C9 "Redaction: ... an absolute path ...
//   `/home/mcf/repo/x.ts` ... all redact (D12)".
//
// Criterion (h) "a `~/` path redacts" (4.8):
//   Pre-condition: a wait whose first question's text is
//   '~/notify.json is missing'.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: body's second line is exactly '[path] is missing'.
//   Expected-value source: design C9 "a `~/` path ... `~/notify.json` ...
//   all redact (D12)".
//
// Criterion (i) "a slash-relative path redacts" (4.8):
//   Pre-condition: a wait whose first question's text is
//   'src/controller/step.ts broke'.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: body's second line is exactly '[path] broke'.
//   Expected-value source: design C9 "any token with a `/` ...
//   `src/controller/step.ts`, `src/controller` ... all redact (D12)".
//
// Criterion (j) "a single-segment filename redacts" (4.8):
//   Pre-condition: a wait whose first question's text is
//   'see notify.json for detail'.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: body's second line is exactly 'see [path] for
//   detail'.
//   Expected-value source: design C9 "any token with a file extension ...
//   `notify.json` ... redact (D12)".
//
// Criterion (k) "plain words stay" (4.8):
//   Pre-condition: a wait whose first question's text is
//   'the crash happened again'.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: body's second line is exactly 'the crash happened
//   again', unchanged.
//   Expected-value source: design C9's residual: "a bare slashless,
//   extensionless token ... indistinguishable from a plain word", i.e. none
//   of these tokens redact.
//
// Criterion (l) "answer, advice and later questions never appear" (4.3, NFR
//   Security):
//   Pre-condition: a wait with an `answer` record, an `advice` string, and a
//   second question, each holding a distinctive secret string not present in
//   the first question's text.
//   Test: buildMessage(wait, 'Acme Project', false).
//   Observable result: none of the three secret strings appear anywhere in
//   `title` or `body`.
//   Expected-value source: requirements.md 4.3 "and nothing else: no answer,
//   no advice, no path, no file content"; design C9 reads only
//   `wait.questions[0]`.
function makeWait(overrides: Partial<WaitRecord> = {}): WaitRecord {
  return {
    v: 1,
    id: 'w1',
    kind: 'question',
    run: 'run-1',
    project: 'proj-1',
    spec: 'spec-a',
    created: '2026-11-03T00:00:00.000Z',
    questions: [{ id: 'q1', text: 'a question' }],
    state: 'open',
    ...overrides,
  };
}

describe('buildMessage', () => {
  it('(a) body line 1 holds kind, project name and spec (4.3)', () => {
    const wait = makeWait({ kind: 'question', spec: 'spec-a' });
    const { body } = buildMessage(wait, 'Acme Project', false);
    expect(body.split('\n')[0]).toBe('question | Acme Project | spec-a');
  });

  it('(b) the title is `SDD ` plus the kind (4.3)', () => {
    const wait = makeWait({ kind: 'escalation' });
    const { title } = buildMessage(wait, 'Acme Project', false);
    expect(title).toBe('SDD escalation');
  });

  it('(c) a reminder prefixes body line 1 and uses the reminder title (5.1)', () => {
    const wait = makeWait({ kind: 'question', spec: 'spec-a' });
    const { title, body } = buildMessage(wait, 'Acme Project', true);
    expect(body.split('\n')[0]).toBe('Reminder: question | Acme Project | spec-a');
    expect(title).toBe('SDD reminder: question');
  });

  it('(d) body line 2 is the trimmed first line of the first question (4.3)', () => {
    const wait = makeWait({ questions: [{ id: 'q1', text: '  hello operator  ' }] });
    const { body } = buildMessage(wait, 'Acme Project', false);
    expect(body.split('\n')[1]).toBe('hello operator');
  });

  it('(e) multi-line text keeps only that line (4.3)', () => {
    const wait = makeWait({ questions: [{ id: 'q1', text: 'first line\nsecond line\nthird line' }] });
    const { body } = buildMessage(wait, 'Acme Project', false);
    const lines = body.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('first line');
  });

  it('(f) a wait with no question has no line 2 (4.3)', () => {
    const wait = makeWait({ questions: [] });
    const { body } = buildMessage(wait, 'Acme Project', false);
    expect(body).not.toContain('\n');
    expect(body).toBe(body.split('\n')[0]);
  });

  it('(g) an absolute path redacts to [path] (4.8)', () => {
    const wait = makeWait({ questions: [{ id: 'q1', text: '/home/mcf/repo/x.ts failed to load' }] });
    const { body } = buildMessage(wait, 'Acme Project', false);
    expect(body.split('\n')[1]).toBe('[path] failed to load');
  });

  it('(h) a ~/ path redacts (4.8)', () => {
    const wait = makeWait({ questions: [{ id: 'q1', text: '~/notify.json is missing' }] });
    const { body } = buildMessage(wait, 'Acme Project', false);
    expect(body.split('\n')[1]).toBe('[path] is missing');
  });

  it('(i) a slash-relative path redacts (4.8)', () => {
    const wait = makeWait({ questions: [{ id: 'q1', text: 'src/controller/step.ts broke' }] });
    const { body } = buildMessage(wait, 'Acme Project', false);
    expect(body.split('\n')[1]).toBe('[path] broke');
  });

  it('(j) a single-segment filename redacts (4.8)', () => {
    const wait = makeWait({ questions: [{ id: 'q1', text: 'see notify.json for detail' }] });
    const { body } = buildMessage(wait, 'Acme Project', false);
    expect(body.split('\n')[1]).toBe('see [path] for detail');
  });

  it('(k) plain words stay (4.8)', () => {
    const wait = makeWait({ questions: [{ id: 'q1', text: 'the crash happened again' }] });
    const { body } = buildMessage(wait, 'Acme Project', false);
    expect(body.split('\n')[1]).toBe('the crash happened again');
  });

  it('(l) answer, advice and later questions never appear (4.3, NFR Security)', () => {
    const wait = makeWait({
      questions: [
        { id: 'q1', text: 'first question text' },
        { id: 'q2', text: 'SECRET-LATER-QUESTION' },
      ],
      answer: { q1: { value: 'SECRET-ANSWER', by: 'operator', answered: '2026-11-03T00:00:00.000Z' } },
      advice: 'SECRET-ADVICE',
    });
    const { title, body } = buildMessage(wait, 'Acme Project', false);
    expect(title + body).not.toContain('SECRET-ANSWER');
    expect(title + body).not.toContain('SECRET-ADVICE');
    expect(title + body).not.toContain('SECRET-LATER-QUESTION');
  });
});

// Contract for the sender in src/advisor/push.ts (design.md C9; task 12
// _Prompt; requirements.md 4.1-4.7, 5.1, NFR Security). design.md pins only
// `WaitPusher { start(); stop() }`; this file fixes the constructor's
// `retryDelayMs` knob the retry test needs, the same way the buildMessage
// contract above fixes shapes design.md leaves as shorthand.
//
// No collaborator inside push.ts is mocked: every wait is written through the
// real `createWait` (src/controller/waits.ts), read back through the real
// `listOpenWaits`, and a push is a real HTTP POST from push.ts to a plain
// `http.createServer` standing in for the operator's ntfy server (the same
// "local capture server" pattern src/advisor/__tests__/search.test.ts uses
// for its fake Ollama). Each test runs against a fresh temp SDD_HOME.
//
// Criterion (a) "a new open wait POSTs once to url/topic" (4.3), folded with
//   requirement 4.2's "a wait written by another process is seen":
//   Pre-condition: a started WaitPusher, notify.json naming the capture
//   server and a topic.
//   Test: a separate `node --import tsx` child process calls the real
//   `createWait` (write-wait-child.ts).
//   Observable result: the capture server receives exactly one request whose
//   path is `/<topic>`.
//   Expected-value source: design C9 "POST: fetch(url... + '/' + topic ...)".
//
// Criterion (b) "a trailing slash on url is trimmed" (4.3):
//   Pre-condition: notify.json's url carries a trailing slash.
//   Test: a wait is created in-process after start.
//   Observable result: the request path is still exactly `/<topic>`, not
//   `//<topic>`.
//   Expected-value source: design C9 "POST: ... url.replace(/\/+$/, '') +
//   '/' + topic".
//
// Criteria (c) and (f) "the body and Title come from the builder, with
//   Priority: 4" and "no JSON content-type is set" (4.3, 4.4), folded into
//   one test:
//   Pre-condition: a started WaitPusher, no project list (project name falls
//   back to the wait's project id).
//   Test: a wait is created in-process; buildMessage(wait, id, false) (task
//   11, already proven correct) computes the expected title/body in the test
//   itself.
//   Observable result: the request body equals buildMessage's `body`; the
//   `title` header equals buildMessage's `title`; the `priority` header is
//   '4'; the `content-type` header is `text/plain;charset=UTF-8` (design C9
//   Probe), never `application/json`.
//   Expected-value source: design C9 "Headers: Title, Priority: 4 ..." and
//   "Body line 1/2" (task 11), and the Probe's recorded content-type.
//
// Criterion (d) "a token sends Authorization: Bearer" (4.4):
//   Pre-condition: notify.json's ntfy.token is set.
//   Test: a wait is created in-process.
//   Observable result: the request's `authorization` header is
//   `Bearer <token>`.
//   Expected-value source: design C9 "Headers: ... Authorization: Bearer
//   <token> only when token is present".
//
// Criterion (e) "no token sends no such header" (4.4):
//   Pre-condition: notify.json has no ntfy.token.
//   Test: a wait is created in-process.
//   Observable result: the request has no `authorization` header.
//   Expected-value source: design C9, same sentence as (d), negated.
//
// Criterion (g) "the project name comes from the project list" (4.3):
//   Pre-condition: `projects.json` holds an entry whose id matches the
//   wait's project, with a distinct `name`.
//   Test: a wait is created in-process for that project id.
//   Observable result: the request body equals buildMessage(wait, name,
//   false).
//   Expected-value source: design C9 "Project name: readProjects() ..., the
//   entry whose id equals wait.project, its name".
//
// Criterion (h) "an unknown project uses its id" (4.3):
//   Pre-condition: `projects.json` holds only unrelated entries.
//   Test: a wait is created in-process for a project id absent from the list.
//   Observable result: the request body equals buildMessage(wait, id,
//   false).
//   Expected-value source: design C9, same sentence as (g), "else ...
//   wait.project".
//
// Criterion (i) "an unreadable list uses the id" (4.3):
//   Pre-condition: `projects.json` holds unparsable text.
//   Test: a wait is created in-process.
//   Observable result: the pusher does not throw; the request body equals
//   buildMessage(wait, id, false).
//   Expected-value source: design C9 "... else, or on a read failure,
//   wait.project".
//
// Criteria (j) "a missing or malformed file sends nothing and logs one
//   push-off line per start, and the wait is still written" (4.1), split
//   into its two sub-cases:
//   Pre-condition (missing): no notify.json at all.
//   Pre-condition (malformed): notify.json holds unparsable text.
//   Test (each): new WaitPusher({}).start(), then a wait is written.
//   Observable result (each): console.error is called exactly once during
//   start(); no push.failure row is logged; listOpenWaits() still carries the
//   wait, state 'open'.
//   Expected-value source: design C9 "Start: ... Missing or invalid: one
//   console.error saying push is off" and requirements.md 4.1 "no message is
//   sent ... log once per start that push is off".
//
// Criterion (k) "a loose file logs one warning and still sends" (NFR
//   Security):
//   Pre-condition: a valid notify.json at mode 0640 (group-readable).
//   Test: new WaitPusher({}).start(), then a wait is written.
//   Observable result: exactly one console.error/warn call total during
//   start(), whose text excludes the configured topic; the wait is still
//   pushed (one request).
//   Expected-value source: requirements.md NFR Security "log one warning per
//   start and still send" and "never ... log the topic or token".
//
// Criterion (l) "a file added after start sends with no restart" (design C9
//   Start):
//   Pre-condition: a started WaitPusher with no notify.json yet.
//   Test: a wait is written (nothing sent, no config); notify.json is then
//   written; a second wait is written, with no stop()/start() call in
//   between.
//   Observable result: zero requests after the first wait; exactly one
//   request, for the second wait, with no restart.
//   Expected-value source: design C9 "attemptPush still reads the config at
//   each send, so a file added later needs no restart".
//
// Criteria (n) and (m) "a failed POST retries once, then logs one
//   push.failure row and leaves the wait open" (4.5, regression guard) and
//   "neither log nor push.failure row holds the topic or token" (NFR
//   Security), folded into one test:
//   Pre-condition: notify.json names a topic and a token, both distinctive
//   strings, pointed at a server that destroys every connection; a small
//   `retryDelayMs`.
//   Test: a child process writes one open wait.
//   Observable result: the server is hit exactly twice; events.jsonl gains
//   exactly one `push.failure` row, whose serialised form contains neither
//   the topic nor the token string; the wait stays `open`, unanswered.
//   Expected-value source: requirements.md 4.5 ("retry once ... then append
//   one push.failure row ... never block, delay or change the wait") and NFR
//   Security ("never write, copy or log the topic or token").
//
// Criterion (o) "first start sends nothing" (4.6, regression guard — this
//   branch does not read any config at all, so it already holds at base;
//   kept here, adapted off push.json, as the implementer brief's named
//   coverage for this branch):
//   Pre-condition: one open wait already on disk before any WaitPusher has
//   ever run (no pushed.json yet).
//   Test: new WaitPusher({}).start().
//   Observable result: the capture server receives zero requests;
//   pushed.json ends up holding the wait's id.
//   Expected-value source: design C9 "First start (no readable record): ids
//   and reminded both take every open wait; nothing is sent".
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const CHILD_SCRIPT = join(HERE, 'helpers', 'write-wait-child.ts');

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
  vi.restoreAllMocks();
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

interface CapturedRequest {
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

/** A capture server standing in for the operator's ntfy server. */
async function startCaptureServer(): Promise<{ url: string; requests: CapturedRequest[]; close(): Promise<void> }> {
  const requests: CapturedRequest[] = [];
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      requests.push({ path: req.url ?? '', headers: req.headers, body: raw });
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('OK');
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

async function writeNotifyConfig(url: string, topic: string, token?: string): Promise<void> {
  await fs.mkdir(dirname(notifyConfigPath()), { recursive: true });
  const ntfy = token ? { url, topic, token } : { url, topic };
  await fs.writeFile(notifyConfigPath(), JSON.stringify({ v: 1, ntfy }), 'utf-8');
}

function makeProject(id: string, name: string): KnownProject {
  return {
    id,
    workspacePath: `/tmp/${id}`,
    workflowRootPath: `/tmp/${id}/.spec-workflow`,
    name,
    seen: '2026-11-03T00:00:00.000Z',
  };
}

async function writeProjectList(projects: KnownProject[]): Promise<void> {
  await writeProjects({ v: 1, projects });
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

async function makeOpenWait(spec: string, project: string, questionText = 'question text'): Promise<ControllerWaitRecord> {
  return createWait({
    kind: 'question',
    runId: 'in-process-run',
    projectId: project,
    spec,
    specDir: join(home, 'spec-dir'),
    questions: [{ id: 'q1', text: questionText, options: ['A', 'B'] }],
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
  it('(a) a new open wait written by a separate process POSTs exactly once to url/topic (4.2, 4.3)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    const result = await writeWaitFromChildProcess('question', 'proj-a', 'spec-a', 'q1', 'question text');
    expect(result.code).toBe(0);

    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    expect(capture.requests[0].path).toBe('/sdd-ops');
  }, 10000);

  it('(b) a trailing slash on the configured url is trimmed before the topic is appended (4.3)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(`${capture.url}/`, 'sdd-ops');

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    await makeOpenWait('spec-b', 'proj-b');
    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    expect(capture.requests[0].path).toBe('/sdd-ops');
  });

  it('(c, f) the body and Title come from the builder, with Priority: 4, and no JSON content-type is set (4.3, 4.4)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    const wait = await makeOpenWait('spec-c', 'proj-c', 'question text for c');
    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    const req = capture.requests[0];
    const expected = buildMessage(wait, 'proj-c', false);
    expect(req.body).toBe(expected.body);
    expect(req.headers['title']).toBe(expected.title);
    expect(req.headers['priority']).toBe('4');
    expect(req.headers['content-type']).toBe('text/plain;charset=UTF-8');
  });

  it('(d) a token in notify.json sends an Authorization: Bearer header (4.4)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops', 'tok_abc123');

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    await makeOpenWait('spec-d', 'proj-d');
    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    expect(capture.requests[0].headers['authorization']).toBe('Bearer tok_abc123');
  });

  it('(e) no token in notify.json sends no Authorization header (4.4)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    await makeOpenWait('spec-e', 'proj-e');
    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    expect(capture.requests[0].headers['authorization']).toBeUndefined();
  });

  it('(g) the project name in the pushed body comes from the durable project list (4.3)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');
    await writeProjectList([makeProject('proj-g', 'Acme Project')]);

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    const wait = await makeOpenWait('spec-g', 'proj-g', 'question text for g');
    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    const expected = buildMessage(wait, 'Acme Project', false);
    expect(capture.requests[0].body).toBe(expected.body);
  });

  it('(h) an unknown project (not in the list) uses its id as the name (4.3)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');
    await writeProjectList([makeProject('some-other-project', 'Someone Else')]);

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    const wait = await makeOpenWait('spec-h', 'proj-h', 'question text for h');
    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    const expected = buildMessage(wait, 'proj-h', false);
    expect(capture.requests[0].body).toBe(expected.body);
  });

  it('(i) an unreadable (malformed) project list uses the project id as the name (4.3)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');
    await fs.mkdir(controllerHome(), { recursive: true });
    await fs.writeFile(join(controllerHome(), 'projects.json'), '{not json', 'utf-8');

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    const wait = await makeOpenWait('spec-i', 'proj-i', 'question text for i');
    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    const expected = buildMessage(wait, 'proj-i', false);
    expect(capture.requests[0].body).toBe(expected.body);
  });

  it('(j) with no notify.json in the home, start logs one push-off line, sends nothing, and the wait is still written (4.1)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    expect(errorSpy).toHaveBeenCalledTimes(1);

    const result = await writeWaitFromChildProcess('question', 'proj-j1', 'spec-j1', 'q1', 'question text');
    expect(result.code).toBe(0);
    await sleep(400);

    const failureRows = (await readEventRows()).filter((r) => r.type === 'push.failure');
    expect(failureRows).toHaveLength(0);

    const wait = (await listOpenWaits()).find((w) => w.project === 'proj-j1');
    expect(wait).toBeDefined();
    expect(wait!.state).toBe('open');
  }, 10000);

  it('(j) a malformed notify.json also logs one push-off line, sends nothing, and the wait is still written (4.1)', async () => {
    await fs.mkdir(dirname(notifyConfigPath()), { recursive: true });
    await fs.writeFile(notifyConfigPath(), '{not json', 'utf-8');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    expect(errorSpy).toHaveBeenCalledTimes(1);

    const result = await writeWaitFromChildProcess('question', 'proj-j2', 'spec-j2', 'q1', 'question text');
    expect(result.code).toBe(0);
    await sleep(400);

    const failureRows = (await readEventRows()).filter((r) => r.type === 'push.failure');
    expect(failureRows).toHaveLength(0);

    const wait = (await listOpenWaits()).find((w) => w.project === 'proj-j2');
    expect(wait).toBeDefined();
    expect(wait!.state).toBe('open');
  }, 10000);

  it('(k) a notify.json with loose file permissions logs one warning and still sends (NFR Security)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops-loose');
    await fs.chmod(notifyConfigPath(), 0o640);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    const loggedCalls = [...errorSpy.mock.calls, ...warnSpy.mock.calls];
    expect(loggedCalls).toHaveLength(1);
    expect(loggedCalls.map((c) => c.join(' ')).join('\n')).not.toContain('sdd-ops-loose');

    await makeOpenWait('spec-k', 'proj-k');
    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
  });

  it('(l) a notify.json written after start sends a later wait with no restart (design C9 Start)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    await makeOpenWait('spec-l1', 'proj-l1');
    await sleep(300);
    expect(capture.requests).toHaveLength(0);

    await writeNotifyConfig(capture.url, 'sdd-ops');

    await makeOpenWait('spec-l2', 'proj-l2');
    await waitFor(() => capture.requests.length > 0);
    await sleep(300);

    expect(capture.requests).toHaveLength(1);
    expect(capture.requests[0].path).toBe('/sdd-ops');
  });

  it('(n, m) a failing POST retries once, then logs exactly one push.failure row with no topic or token leaked, and leaves the wait open (4.5, NFR Security)', async () => {
    const failing = await startFailingServer();
    servers.push(failing);
    const topic = 'secret-topic-xyz';
    const token = 'secret-token-abc';
    await writeNotifyConfig(failing.url, topic, token);

    const pusher = new WaitPusher({ retryDelayMs: 30 });
    pushers.push(pusher);
    await pusher.start();

    const result = await writeWaitFromChildProcess('question', 'proj-n', 'spec-n', 'q1', 'question text');
    expect(result.code).toBe(0);

    // The two failing fetches + retry delay + file-watch + append must all run
    // after the wait lands. On a loaded CI runner (node 20, 2 cores, the whole
    // suite in parallel) the event loop is starved, so `waitFor`'s wall-clock
    // deadline needs headroom far beyond the ~600ms this takes unloaded: 15s
    // still timed out here, so the budget is 30s (test timeout raised to match).
    await waitFor(async () => (await readEventRows()).some((r) => r.type === 'push.failure'), 30000);
    await sleep(200);

    expect(failing.counter.count).toBe(2);

    const failureRows = (await readEventRows()).filter((r) => r.type === 'push.failure');
    expect(failureRows).toHaveLength(1);
    expect(JSON.stringify(failureRows[0])).not.toContain(topic);
    expect(JSON.stringify(failureRows[0])).not.toContain(token);

    const wait = (await listOpenWaits()).find((w) => w.project === 'proj-n');
    expect(wait).toBeDefined();
    expect(wait!.state).toBe('open');
    expect(wait!.answer).toBeUndefined();
    expect(wait!.advice).toBeUndefined();

    expect(await readPushedIds()).toContain(wait!.id);
  }, 45000);

  it('(o) regression guard: on the very first start, with an open wait already on disk and no pushed.json, records the id but sends nothing (4.6)', async () => {
    const wait = await makeOpenWait('spec-o', 'proj-o');
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();
    await sleep(300);

    expect(capture.requests).toHaveLength(0);
    expect(await readPushedIds()).toContain(wait.id);
  });
});

// Contract for the reminder sweep in src/advisor/push.ts (design.md C9 "sweepReminders
// post-conditions", D8-D10, the `pushed.json` Data Model; task 13 _Prompt;
// requirements.md 5.1-5.6). The `WaitPusherOptions.now` and `sweepMs` seams and the public
// `sweepReminders()` entry do not exist yet (task 12 left them); every case below reaches
// the behaviour only by constructing `new WaitPusher({ now, sweepMs })` and calling
// `start()` / `sweepReminders()` / `stop()`, never a private member. No collaborator inside
// push.ts is mocked: waits are written through the real `createWait`/`writeWait`
// (src/controller/waits.ts, src/controller/state.ts) and a push is a real HTTP POST to a
// plain `http.createServer` capture server, same pattern as the WaitPusher block above.
//
// Criteria (a) and (e), folded into one test ("a wait open one hour after its first push
//   gets one reminder with the marker" and "a first push on a live wait arms it", 5.1):
//   Pre-condition: a started WaitPusher with an injected `now`; a wait created in-process
//   after start (so the live `handleWait` path, not the start scan, records `firstPush`).
//   Test: after the first push lands, advance the injected clock by exactly one hour and
//   call `await pusher.sweepReminders()`.
//   Observable result: a second request arrives whose body equals
//   `buildMessage(wait, projectId, true).body` (the reminder marker). (e)'s coverage is
//   this same test's first phase: the reminder firing at all proves `firstPush` was armed
//   when the wait was created live.
//   Expected-value source: design C9 "sweepReminders post-conditions: ... POST with
//   reminder: true" and "Recording a new wait ... handleWait ...: ... set firstPush[id] to
//   now()".
//
// Criterion (b) "none before the hour" (5.1):
//   Pre-condition: same as (a), one first push landed.
//   Test: advance the clock by one hour minus one second, call `sweepReminders()`.
//   Observable result: no second request arrives.
//   Expected-value source: design C9 "with now() - firstPush[id] >= 3_600_000".
//
// Criterion (c) "the hour runs from the first push, so a wait created long before it gets
//   no immediate reminder" (5.1):
//   Pre-condition: a wait written directly (bypassing `createWait`) with `created` two
//   hours before the pusher's injected `now`; the live file-watch path performs its first
//   push for it at that `now`.
//   Test: immediately after that first push (no clock advance), call `sweepReminders()`.
//   Observable result: no second request arrives, despite `created` being two hours in the
//   past.
//   Expected-value source: requirements.md 5.1 "The hour runs from that first push, never
//   from created"; design "Reminder anchor: ... times the reminder from the first push, not
//   the wait's created time".
//
// Criterion (d) "a first push on the start scan arms the reminder" (5.1):
//   Pre-condition: an existing (non-first-start) `pushed.json` that already names one
//   unrelated wait id; a second, new open wait on disk before the pusher starts.
//   Test: `pusher.start()` (the start scan pushes the new wait, not the live file-watch
//   path), then advance the clock by one hour and call `sweepReminders()`.
//   Observable result: a reminder request arrives for the new wait.
//   Expected-value source: design C9 "Recording a new wait (runStartupScan loop and
//   handleWait ...): ... set firstPush[id] to now()" — the scan loop shares this step with
//   the live path.
//
// Criterion (f) "none after an answer" (5.3):
//   Pre-condition: a wait pushed once, then answered before the hour is up.
//   Test: advance the clock by one hour, call `sweepReminders()`.
//   Observable result: no second request arrives.
//   Expected-value source: requirements.md 5.3; design "POST with reminder: true only if
//   the wait is open".
//
// Criterion (g) "none after expiry" (5.3):
//   Pre-condition: a wait pushed once, then expired before the hour is up.
//   Test: advance the clock by one hour, call `sweepReminders()`.
//   Observable result: no second request arrives.
//   Expected-value source: requirements.md 5.3; design, same sentence as (f).
//
// Criterion (h) "a failed reminder retries once, logs one push.failure row and is never
//   rescheduled" (5.2):
//   Pre-condition: a server that answers the first request (the initial push) with 200 and
//   destroys every connection after that; a wait pushed once successfully.
//   Test: advance the clock by one hour, call `sweepReminders()` (the reminder's own POST
//   fails and retries once), then call `sweepReminders()` again.
//   Observable result: exactly two more requests land after the first (the reminder's
//   attempt and its one retry); exactly one `push.failure` row is appended, whose `detail`
//   names it a reminder; the second `sweepReminders()` call sends no further request.
//   Expected-value source: requirements.md 5.2 "A failed reminder SHALL follow Requirement 4
//   AC 5 and SHALL not be rescheduled"; design C9 "the id is recorded before the POST, so a
//   failed reminder is not rescheduled" and "detail names ... whether it was a reminder".
//
// Criterion (i) "a failed first POST leaves the reminder armed" (D10, 5.1):
//   Pre-condition: a wait's first push POST fails twice (a server that destroys every
//   connection); the config is then repointed at a working capture server before the hour
//   is up.
//   Test: advance the clock by one hour, call `sweepReminders()`.
//   Observable result: one reminder request lands at the working server.
//   Expected-value source: design D10 "A failed first POST still arms the reminder" and C9
//   "The record is written before the POST, so a crash cannot double-send" (recording
//   precedes the send attempt either way).
//
// Criterion (j) "a wait seen with no config never gets one" (D10, 5.1):
//   Pre-condition: a wait created while no `notify.json` exists at all; a working capture
//   server and config are added afterwards.
//   Test: advance the clock by one hour, call `sweepReminders()`.
//   Observable result: `pushed.json`'s `reminded` list already names the wait right after
//   creation; no request ever lands at the capture server.
//   Expected-value source: design C9 "Recording a new wait ...: ... Without one, add it to
//   ids and reminded" and D10 "a wait seen with no config never does".
//
// Criterion (k) "a restart past the hour sends at the start sweep" (5.4):
//   Pre-condition: a `pushed.json` naming a wait's `firstPush` time two hours before a new
//   pusher instance's injected `now` (simulating a restart long after the original push).
//   Test: `pusher.start()` alone (no explicit `sweepReminders()` call).
//   Observable result: one reminder request lands, sent by the sweep `start()` enqueues.
//   Expected-value source: design C9 "A restart past the hour sends through the sweep
//   start() enqueues."; requirements.md 5.4.
//
// Criterion (l) "a restart inside the hour sends only after it" (5.4):
//   Pre-condition: a `pushed.json` naming a wait's `firstPush` time thirty minutes before a
//   new pusher instance's injected `now`.
//   Test: `pusher.start()`, confirm nothing arrives, then advance the clock to the hour mark
//   and call `sweepReminders()`.
//   Observable result: no request after `start()`; one reminder request after the clock
//   reaches the hour and the sweep runs.
//   Expected-value source: requirements.md 5.4 "schedule the reminder for that time plus one
//   hour, or send it at once if that time has passed" (negated: it has not passed yet).
//
// Criterion (m) "a restart after a reminder sends no second one" (5.2, 5.4):
//   Pre-condition: a `pushed.json` already naming the wait's id as `reminded`, with a
//   `firstPush` time two hours before a new pusher instance's injected `now`.
//   Test: `pusher.start()`, then call `sweepReminders()` again for good measure.
//   Observable result: no request ever lands.
//   Expected-value source: requirements.md 5.4 "It SHALL record which waits it has
//   reminded, so a restart never sends a second reminder."
//
// Criterion (n) "first start marks every open wait reminded and sends nothing" (5.5):
//   Pre-condition: one open wait on disk, no readable `pushed.json` at all, a working
//   config.
//   Test: `pusher.start()`, then advance the clock by over an hour and call
//   `sweepReminders()`.
//   Observable result: no request ever lands; `pushed.json`'s `ids` and `reminded` both
//   name the wait right after `start()`.
//   Expected-value source: requirements.md 5.5; design C9 "First start (no readable
//   record): ids and reminded both take every open wait; nothing is sent".
//
// Criterion (o) "a legacy record gets no reminder and still reads" (D9):
//   Pre-condition: a `pushed.json` written in today's shape (`{ v: 1, ids: [id] }`, no
//   `firstPush`/`reminded` fields) naming an open wait's id.
//   Test: `pusher.start()` (must not throw), then advance the clock and call
//   `sweepReminders()`.
//   Observable result: `start()` completes with no new push (the id is already in `ids`);
//   no reminder request ever lands (the id is absent from `firstPush`).
//   Expected-value source: design D9 "The pushed record stays version 1 and gains two
//   optional fields ... an old file then reads correctly with no migration" and the Data
//   Models note "ids never get a reminder and no migration runs".
//
// Criterion (p) "a file with no ids array counts as a first start" (design C9 pushed.json):
//   Pre-condition: a `pushed.json` holding `{ v: 1 }` (no `ids` field at all); one open wait
//   on disk; a working config.
//   Test: `pusher.start()`.
//   Observable result: no request lands (unlike a normal non-first-start scan, which would
//   push the unseen wait); `pushed.json`'s `ids` and `reminded` both name the wait.
//   Expected-value source: design C9 pushed.json "A file with no ids array counts as
//   unreadable (a first start)."
//
// Criterion (q) "a write prunes a gone wait from all three fields" (design C9 pushed.json):
//   Pre-condition: a `pushed.json` naming an id in `ids`, `firstPush` and `reminded` whose
//   wait file does not exist on disk.
//   Test: trigger one write (a new live wait pushed through the real flow).
//   Observable result: the written `pushed.json` has that gone id absent from `ids`, from
//   the `firstPush` keys and from `reminded`.
//   Expected-value source: design C9 pushed.json "Each write drops, from all three fields,
//   any id whose wait file is gone."
//
// Criterion (r) "stop() clears the sweep timer" (design C9 Start):
//   Pre-condition: a `WaitPusher` constructed with a distinctive `sweepMs`.
//   Test: `pusher.start()`, then `pusher.stop()`.
//   Observable result: `start()` armed one `setInterval` at that distinctive delay; `stop()`
//   cleared that same interval handle.
//   Expected-value source: design C9 "start() enqueues one sweep and arms an unref'd
//   setInterval of sweepMs; stop() clears it."
//
// Criteria (s) and (t), design Testing Strategy #4 ("a capture server stands in for ntfy:
//   one message, then one reminder on the injected clock, then nothing"; "nothing after an
//   early answer"):
//   (s) Pre-condition/Test: as (a), plus a second `sweepReminders()` call one more hour
//     later. Observable result: still exactly two requests total, ever.
//   (t) Pre-condition/Test: as (f). Observable result: exactly one request, ever.
//   Expected-value source: design "Testing Strategy" end-to-end item 4.
const HOUR_MS = 3_600_000;

function clockBox(initial: Date) {
  let current = initial;
  return {
    now: () => current,
    set(value: Date) {
      current = value;
    },
    advanceMs(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

async function writeRawWait(overrides: Partial<WaitRecord> & { id: string }): Promise<WaitRecord> {
  const record: WaitRecord = {
    v: 1,
    kind: 'question',
    run: 'run-raw',
    project: 'proj-raw',
    spec: 'spec-raw',
    created: new Date().toISOString(),
    questions: [{ id: 'q1', text: 'raw question text' }],
    state: 'open',
    ...overrides,
  };
  await writeWait(record);
  return record;
}

interface PushedRaw {
  v: 1;
  ids: string[];
  firstPush?: Record<string, string>;
  reminded?: string[];
}

async function writePushedRaw(file: PushedRaw): Promise<void> {
  await fs.mkdir(dirname(pushedPath()), { recursive: true });
  await fs.writeFile(pushedPath(), JSON.stringify(file), 'utf-8');
}

async function readPushedRaw(): Promise<PushedRaw | undefined> {
  try {
    const raw = await fs.readFile(pushedPath(), 'utf-8');
    return JSON.parse(raw) as PushedRaw;
  } catch {
    return undefined;
  }
}

/** A server that answers the first request with 200 and destroys every connection after. */
async function startServerThatFailsAfterFirst(): Promise<{ url: string; calls: { count: number }; close(): Promise<void> }> {
  const calls = { count: 0 };
  const server: Server = createServer((req, res) => {
    calls.count += 1;
    if (calls.count === 1) {
      req.on('data', () => {});
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('OK');
      });
    } else {
      req.socket.destroy();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    calls,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

describe('sweepReminders', () => {
  it('(a, e) a wait open one hour after its first push gets one reminder, armed by firstPush on a live wait (5.1)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();

    const wait = await makeOpenWait('spec-rem-a', 'proj-rem-a');
    await waitFor(() => capture.requests.length > 0);
    await sleep(200);
    expect(capture.requests).toHaveLength(1);

    box.advanceMs(HOUR_MS);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();

    expect(capture.requests).toHaveLength(2);
    const expected = buildMessage(wait, 'proj-rem-a', true);
    expect(capture.requests[1].body).toBe(expected.body);
  });

  it('(b) sends no reminder before the hour elapses (5.1)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();

    await makeOpenWait('spec-rem-b', 'proj-rem-b');
    await waitFor(() => capture.requests.length > 0);
    await sleep(200);
    expect(capture.requests).toHaveLength(1);

    box.advanceMs(HOUR_MS - 1000);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();

    expect(capture.requests).toHaveLength(1);
  });

  it("(c) the hour runs from the first push, not from created, so a long-past created time gets no immediate reminder (5.1)", async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const t0 = new Date('2026-11-04T00:00:00.000Z');
    const box = clockBox(t0);
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();

    await writeRawWait({
      id: 'w-old-created',
      created: new Date(t0.getTime() - 2 * HOUR_MS).toISOString(),
      project: 'proj-rem-c',
      spec: 'spec-rem-c',
      state: 'open',
    });
    await waitFor(() => capture.requests.length > 0);
    await sleep(200);
    expect(capture.requests).toHaveLength(1);

    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();

    expect(capture.requests).toHaveLength(1);
  });

  it('(d) a first push performed during the start scan arms the reminder (5.1)', async () => {
    const seedWait = await makeOpenWait('spec-rem-seed', 'proj-rem-seed');
    await writePushedRaw({ v: 1, ids: [seedWait.id], firstPush: {}, reminded: [] });
    const newWait = await makeOpenWait('spec-rem-d', 'proj-rem-d');

    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();

    await waitFor(() => capture.requests.length > 0);
    await sleep(200);
    expect(capture.requests).toHaveLength(1);
    expect(capture.requests[0].path).toBe('/sdd-ops');

    box.advanceMs(HOUR_MS);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();

    expect(capture.requests).toHaveLength(2);
    const expected = buildMessage(newWait, 'proj-rem-d', true);
    expect(capture.requests[1].body).toBe(expected.body);
  });

  it('(f) a wait answered before the hour gets no reminder (5.3)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();

    const wait = await makeOpenWait('spec-rem-f', 'proj-rem-f');
    await waitFor(() => capture.requests.length > 0);
    await sleep(200);
    expect(capture.requests).toHaveLength(1);

    await answerWait(wait.id, { q1: 'A' }, 'operator');

    box.advanceMs(HOUR_MS);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();

    expect(capture.requests).toHaveLength(1);
  });

  it('(g) a wait expired before the hour gets no reminder (5.3)', async () => {
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();

    const wait = await makeOpenWait('spec-rem-g', 'proj-rem-g');
    await waitFor(() => capture.requests.length > 0);
    await sleep(200);
    expect(capture.requests).toHaveLength(1);

    await expireWait(wait.id);

    box.advanceMs(HOUR_MS);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();

    expect(capture.requests).toHaveLength(1);
  });

  it('(h) a failed reminder retries once, logs one push.failure row naming it a reminder, and is never rescheduled (5.2)', async () => {
    const server = await startServerThatFailsAfterFirst();
    servers.push(server);
    await writeNotifyConfig(server.url, 'sdd-ops');

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now, retryDelayMs: 20 } as never);
    pushers.push(pusher);
    await pusher.start();

    await makeOpenWait('spec-rem-h', 'proj-rem-h');
    await waitFor(() => server.calls.count > 0);
    await sleep(200);
    expect(server.calls.count).toBe(1);

    box.advanceMs(HOUR_MS);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();
    await sleep(200);

    expect(server.calls.count).toBe(3);

    const failureRows = (await readEventRows()).filter((r) => r.type === 'push.failure');
    expect(failureRows).toHaveLength(1);
    expect(String(failureRows[0].detail).toLowerCase()).toContain('reminder');

    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();
    await sleep(100);
    expect(server.calls.count).toBe(3);
  }, 10000);

  it('(i) a failed first POST still leaves the reminder armed (D10, 5.1)', async () => {
    const failing = await startFailingServer();
    servers.push(failing);
    await writeNotifyConfig(failing.url, 'sdd-ops-i');

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now, retryDelayMs: 20 } as never);
    pushers.push(pusher);
    await pusher.start();

    await makeOpenWait('spec-rem-i', 'proj-rem-i');
    await waitFor(async () => (await readEventRows()).some((r) => r.type === 'push.failure'));
    await sleep(100);
    expect(failing.counter.count).toBe(2);

    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops-i');

    box.advanceMs(HOUR_MS);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();

    await waitFor(() => capture.requests.length > 0);
    await sleep(200);
    expect(capture.requests).toHaveLength(1);
    expect(capture.requests[0].body.startsWith('Reminder:')).toBe(true);
  }, 10000);

  it('(j) a wait seen with no config never gets a reminder (D10, 5.1)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const wait = await makeOpenWait('spec-rem-j', 'proj-rem-j');
    await sleep(200);

    const raw = await readPushedRaw();
    expect(raw?.reminded).toContain(wait.id);

    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    box.advanceMs(HOUR_MS);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();
    await sleep(200);

    expect(capture.requests).toHaveLength(0);
  });

  it('(k) a restart past the hour sends the reminder at the start sweep (5.4)', async () => {
    const wait = await makeOpenWait('spec-rem-k', 'proj-rem-k');
    const tOld = new Date('2026-11-04T00:00:00.000Z');
    await writePushedRaw({ v: 1, ids: [wait.id], firstPush: { [wait.id]: tOld.toISOString() }, reminded: [] });

    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const tNew = new Date(tOld.getTime() + 2 * HOUR_MS);
    const pusher = new WaitPusher({ now: () => tNew } as never);
    pushers.push(pusher);
    await pusher.start();

    await waitFor(() => capture.requests.length > 0, 2000);
    await sleep(200);
    expect(capture.requests).toHaveLength(1);
    expect(capture.requests[0].body.startsWith('Reminder:')).toBe(true);
  });

  it('(l) a restart inside the hour withholds the reminder until it is due (5.4)', async () => {
    const wait = await makeOpenWait('spec-rem-l', 'proj-rem-l');
    const tOld = new Date('2026-11-04T00:00:00.000Z');
    await writePushedRaw({ v: 1, ids: [wait.id], firstPush: { [wait.id]: tOld.toISOString() }, reminded: [] });

    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const box = clockBox(new Date(tOld.getTime() + 30 * 60 * 1000));
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();
    await sleep(300);
    expect(capture.requests).toHaveLength(0);

    box.set(new Date(tOld.getTime() + HOUR_MS));
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();

    expect(capture.requests).toHaveLength(1);
  });

  it('(m) a restart after the reminder already sent never sends a second one (5.2, 5.4)', async () => {
    const wait = await makeOpenWait('spec-rem-m', 'proj-rem-m');
    const tOld = new Date('2026-11-04T00:00:00.000Z');
    await writePushedRaw({ v: 1, ids: [wait.id], firstPush: { [wait.id]: tOld.toISOString() }, reminded: [wait.id] });

    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const tNew = new Date(tOld.getTime() + 2 * HOUR_MS);
    const pusher = new WaitPusher({ now: () => tNew } as never);
    pushers.push(pusher);
    await pusher.start();
    await sleep(300);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();
    await sleep(100);

    expect(capture.requests).toHaveLength(0);
  });

  it('(n) first start marks every open wait reminded and sends nothing (5.5)', async () => {
    const wait = await makeOpenWait('spec-rem-n', 'proj-rem-n');
    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();
    await sleep(300);

    expect(capture.requests).toHaveLength(0);
    const raw = await readPushedRaw();
    expect(raw?.ids).toContain(wait.id);
    expect(raw?.reminded).toContain(wait.id);

    box.advanceMs(HOUR_MS + 1000);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();
    await sleep(100);
    expect(capture.requests).toHaveLength(0);
  });

  it('(o) a legacy pushed.json record with no firstPush/reminded fields gets no reminder and still reads (D9)', async () => {
    const wait = await makeOpenWait('spec-rem-o', 'proj-rem-o');
    await writePushedRaw({ v: 1, ids: [wait.id] });

    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
    const pusher = new WaitPusher({ now: box.now } as never);
    pushers.push(pusher);
    await pusher.start();
    await sleep(200);
    expect(capture.requests).toHaveLength(0);

    box.advanceMs(HOUR_MS + 1000);
    await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();
    await sleep(100);
    expect(capture.requests).toHaveLength(0);
  });

  it('(p) a pushed.json file with no ids array counts as a first start (design C9 pushed.json)', async () => {
    const wait = await makeOpenWait('spec-rem-p', 'proj-rem-p');
    await fs.mkdir(dirname(pushedPath()), { recursive: true });
    await fs.writeFile(pushedPath(), JSON.stringify({ v: 1 }), 'utf-8');

    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();
    await sleep(300);

    expect(capture.requests).toHaveLength(0);
    const raw = await readPushedRaw();
    expect(raw?.ids).toContain(wait.id);
    expect(raw?.reminded).toContain(wait.id);
  });

  it('(q) a write prunes a gone wait from ids, firstPush and reminded alike (design C9 pushed.json)', async () => {
    await writePushedRaw({
      v: 1,
      ids: ['gone-id'],
      firstPush: { 'gone-id': new Date().toISOString() },
      reminded: ['gone-id'],
    });

    const capture = await startCaptureServer();
    servers.push(capture);
    await writeNotifyConfig(capture.url, 'sdd-ops');

    const pusher = new WaitPusher({});
    pushers.push(pusher);
    await pusher.start();

    await makeOpenWait('spec-rem-q', 'proj-rem-q');
    await waitFor(() => capture.requests.length > 0);
    await sleep(200);

    const raw = await readPushedRaw();
    expect(raw?.ids).not.toContain('gone-id');
    expect(raw?.firstPush).toBeDefined();
    expect(Object.keys(raw!.firstPush!)).not.toContain('gone-id');
    expect(raw?.reminded).toBeDefined();
    expect(raw!.reminded).not.toContain('gone-id');
  });

  it('(r) stop() clears the sweep timer armed by start() (design C9 Start)', async () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const pusher = new WaitPusher({ sweepMs: 1234567 } as never);
    pushers.push(pusher);
    await pusher.start();

    const sweepCallIndex = setIntervalSpy.mock.calls.findIndex((call) => call[1] === 1234567);
    expect(sweepCallIndex).toBeGreaterThanOrEqual(0);
    const handle = setIntervalSpy.mock.results[sweepCallIndex]!.value;

    pusher.stop();

    expect(clearIntervalSpy.mock.calls.some((call) => call[0] === handle)).toBe(true);
  });

  describe('scenario 4: reminder end-to-end against a capture server (design Testing Strategy #4)', () => {
    it('(s) one message, then one reminder on the injected clock, then nothing more (5.1, 5.2)', async () => {
      const capture = await startCaptureServer();
      servers.push(capture);
      await writeNotifyConfig(capture.url, 'sdd-ops');

      const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
      const pusher = new WaitPusher({ now: box.now } as never);
      pushers.push(pusher);
      await pusher.start();

      await makeOpenWait('spec-rem-s', 'proj-rem-s');
      await waitFor(() => capture.requests.length > 0);
      await sleep(200);
      expect(capture.requests).toHaveLength(1);

      box.advanceMs(HOUR_MS);
      await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();
      await sleep(100);
      expect(capture.requests).toHaveLength(2);
      expect(capture.requests[1].body.startsWith('Reminder:')).toBe(true);

      box.advanceMs(HOUR_MS);
      await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();
      await sleep(100);
      expect(capture.requests).toHaveLength(2);
    });

    it('(t) a wait answered early gets no reminder (5.3)', async () => {
      const capture = await startCaptureServer();
      servers.push(capture);
      await writeNotifyConfig(capture.url, 'sdd-ops');

      const box = clockBox(new Date('2026-11-04T00:00:00.000Z'));
      const pusher = new WaitPusher({ now: box.now } as never);
      pushers.push(pusher);
      await pusher.start();

      const wait = await makeOpenWait('spec-rem-t', 'proj-rem-t');
      await waitFor(() => capture.requests.length > 0);
      await sleep(200);
      expect(capture.requests).toHaveLength(1);

      await answerWait(wait.id, { q1: 'A' }, 'operator');

      box.advanceMs(HOUR_MS);
      await (pusher as unknown as { sweepReminders(): Promise<void> }).sweepReminders();
      await sleep(100);
      expect(capture.requests).toHaveLength(1);
    });
  });
});
