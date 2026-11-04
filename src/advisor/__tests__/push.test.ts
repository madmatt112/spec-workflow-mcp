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
import { createWait, listOpenWaits, type ControllerWaitRecord } from '../../controller/waits.js';
import { writeProjects, controllerHome, type WaitRecord, type KnownProject } from '../../controller/state.js';

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

    await waitFor(async () => (await readEventRows()).some((r) => r.type === 'push.failure'), 5000);
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
  }, 10000);

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
