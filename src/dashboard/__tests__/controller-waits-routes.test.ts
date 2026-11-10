import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { createWait } from '../../controller/waits.js';
import { writeRun, type RunRecord } from '../../controller/state.js';
import { loadOrCreateSecret } from '../../controller/access.js';

// Contract for the controller wait routes (controller-tasks.md "T4 waits";
// controller-design.md §7). Every test drives a real MultiProjectDashboardServer
// through fetch(), with a temp SPEC_WORKFLOW_HOME, XDG_STATE_HOME and SDD_HOME so
// the real homes are never touched. The waits are seeded through the real waits
// module (as the controller would), then read and answered over the routes.

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

describe('controller wait routes (T4)', () => {
  let tempDir: string;
  let specDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  let secret: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `ctrl-waits-routes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stateHomeDir = join(tempDir, '.xdg-state');
    specDir = join(tempDir, 'spec-dir');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    await fsp.mkdir(specDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;
    process.env.SDD_HOME = join(tempDir, '.sdd-home');

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    // Controller routes require the shared secret even for a loopback GET
    // (access control, controller-design.md §17).
    secret = await loadOrCreateSecret();
    _resetMultiServerWarningsForTests();
  });

  afterEach(async () => {
    if (server) { await server.stop(); server = null; }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  function url(suffix: string): string {
    return `http://127.0.0.1:${port}/api/controller/waits${suffix}`;
  }

  // Add the shared secret as a bearer header to a request's init.
  function auth(init: RequestInit = {}): RequestInit {
    return {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${secret}` },
    };
  }

  async function seedGateA() {
    return createWait({
      kind: 'gate-a',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [
        { id: 'q1', text: 'Merge by rule?', options: ['Yes', 'No'], recommended: 'Yes' },
        { id: 'q2', text: 'Any scope to cut?', options: ['Keep all', 'Cut retro'] },
      ],
    });
  }

  // Task-tagged escalation wait, for the task 9 (task/diff) route cases.
  async function seedEscalationWait(opts: { task?: string; commits?: string[]; runId?: string } = {}) {
    const question: { id: string; text: string; task?: string } = { id: 'ruling', text: 'Rule on this?' };
    if (opts.task) question.task = opts.task;
    return createWait({
      kind: 'escalation',
      runId: opts.runId ?? 'run-1',
      projectId: 'proj-1',
      spec: 'controller-waits',
      specDir,
      questions: [question],
      ...(opts.commits ? { commits: opts.commits } : {}),
    });
  }

  async function seedRunRecord(id: string, patch: Partial<RunRecord> = {}): Promise<void> {
    const iso = '2026-11-09T00:00:00.000Z';
    await writeRun({
      v: 1,
      id,
      project: 'proj-1',
      codeRoot: tempDir,
      specStore: tempDir,
      spec: 'controller-waits',
      worktree: join(tempDir, 'worktree'),
      branch: 'main',
      status: 'running',
      created: iso,
      updated: iso,
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      ...patch,
    });
  }

  const TASK_1 = `- [ ] 1. Build the thing
  - File: src/thing.ts
  - Test: src/__tests__/thing.test.ts — \`thing()\`
  - Purpose: it does the thing.
  - _Prompt: Task: Build the thing | Restrictions: none | Success: the thing works_
`;

  it('GET lists open and answered waits, newest first, with no specDir on the wire', async () => {
    const older = await seedGateA();
    await new Promise((r) => setTimeout(r, 5));
    const newer = await seedGateA();

    const res = await realFetch(url(''), auth());
    expect(res.status).toBe(200);
    const body: any = await res.json();

    expect(body.waits.map((w: any) => w.id)).toEqual([newer.id, older.id]);
    expect(body.waits[0].specDir).toBeUndefined();
    expect(body.waits[0].kind).toBe('gate-a');
    expect(body.waits[0].state).toBe('open');
  });

  it('POST answer records the answer, renders the receipt and 200s', async () => {
    const wait = await seedGateA();

    const res = await realFetch(url(`/${wait.id}/answer`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ answers: { q1: 'Yes' }, by: 'matthew' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).ok).toBe(true);

    const list: any = await (await realFetch(url(''), auth())).json();
    const answered = list.waits.find((w: any) => w.id === wait.id);
    expect(answered.state).toBe('answered');
    expect(answered.answer.q1.value).toBe('Yes');
    expect(answered.answer.q1.by).toBe('matthew');

    const receipt = await fsp.readFile(join(specDir, 'questions.md'), 'utf-8');
    expect(receipt).toContain('## Gate A');
    expect(receipt).toContain('Answer: Yes');
  });

  it('POST answer under a question id the wait never asked gives 400 and leaves it open', async () => {
    const wait = await seedGateA();

    const res = await realFetch(url(`/${wait.id}/answer`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ answers: { merge: 'merge' }, by: 'operator' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe('unknown-question');
    expect(body.unknown).toEqual(['merge']);

    const list: any = await (await realFetch(url(''), auth())).json();
    expect(list.waits.find((w: any) => w.id === wait.id).state).toBe('open');
  });

  // ---------------------------------------------------------------------------
  // dashboard-ruling-view task 5 — the answer route's trailing `note` field
  // (design C4; Requirement 6 AC 5, AC 7).
  //
  // Contract:
  // - "the route with a note answers 200 and the receipt carries it" — Pre:
  //   an open gate-a wait (seedGateA). Call: `POST .../answer` with body
  //   `{ answers: { q1: 'Yes' }, by: 'operator', note: 'watch the budget' }`.
  //   Observable: the response is 200 `{ ok: true }` (so `note` is never
  //   refused as an unknown answer key — `checkAnswerKeys` only sees
  //   `body.answers`), and `<specDir>/questions.md` contains `Notes: watch
  //   the budget`. Source: design C4 ("a string `note` non-empty after trim
  //   goes to `answerWait`"), Requirement 6 AC 5, AC 7.
  // - "a blank note writes no Notes: line" — Pre: the same kind of wait.
  //   Call: `POST .../answer` with `note: '   '` (whitespace only).
  //   Observable: 200, and `questions.md` has no `Notes:` line. Source:
  //   design C4 ("trims it, and passes it on only when non-empty"); this
  //   already holds at base today (the route reads no `note` field at all,
  //   so a Notes line never appears regardless of its value) — no existing
  //   assertion in this file sends a `note` key at all, so this is a fresh
  //   regression guard for the trim-then-conditional-pass branch, not a red
  //   test (see the report).
  it('POST answer with a note answers 200 and the receipt carries it', async () => {
    const wait = await seedGateA();

    const res = await realFetch(url(`/${wait.id}/answer`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ answers: { q1: 'Yes' }, by: 'operator', note: 'watch the budget' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).ok).toBe(true);

    const receipt = await fsp.readFile(join(specDir, 'questions.md'), 'utf-8');
    expect(receipt).toContain('Notes: watch the budget');
  });

  it('POST answer with a blank note writes the receipt with no Notes: line (regression guard)', async () => {
    const wait = await seedGateA();

    const res = await realFetch(url(`/${wait.id}/answer`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ answers: { q1: 'Yes' }, by: 'operator', note: '   ' }),
    });
    expect(res.status).toBe(200);

    const receipt = await fsp.readFile(join(specDir, 'questions.md'), 'utf-8');
    expect(receipt).not.toContain('Notes:');
  });

  it('POST advice attaches advice and 200s', async () => {
    const wait = await seedGateA();
    const res = await realFetch(url(`/${wait.id}/advice`), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ advice: 'Looks fine.' }),
    });
    expect(res.status).toBe(200);

    const list: any = await (await realFetch(url(''), auth())).json();
    expect(list.waits.find((w: any) => w.id === wait.id).advice).toBe('Looks fine.');
  });

  it('POST answer on an unknown id gives 404', async () => {
    const res = await realFetch(url('/w-deadbeef/answer'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ answers: {}, by: 'operator' }),
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error).toBe('wait-not-found');
  });

  // ---------------------------------------------------------------------------
  // dashboard-ruling-view task 9 — `GET /api/controller/waits/:id/task` and
  // `GET /api/controller/waits/:id/diff` (design C5, C6; Requirement 3 AC 4,
  // Requirement 4 AC 1, AC 11).
  //
  // Contract — `GET .../task`:
  // - "404 for an unknown wait id" — Pre: no wait with this id. Call: GET
  //   `.../w-deadbeef/task` with the bearer. Observable: 404
  //   `{ error: 'wait-not-found' }`. Source: task 9 Success line.
  // - "no-task for an untagged wait" — Pre: an escalation wait whose only
  //   question carries no `task`. Call: GET `.../:id/task`. Observable: 200
  //   `{ state: 'no-task' }`. Source: task 9 Success line; design C5 ("no tag
  //   gives `{ state: 'no-task' }`").
  // - "ok with the row, and no specDir on the wire" — Pre: an escalation wait
  //   tagged `task: '1'`, `specDir/tasks.md` holding task 1. Call: GET
  //   `.../:id/task`. Observable: 200 with the `readTaskRow` row for task 1
  //   (id, title, success, tdd, risk, files), and the raw response body text
  //   never contains `specDir`. Source: task 9 Success line; design C5
  //   ("reads the record with `readWait`... calls the reader task 7
  //   exports"); Requirement 3 AC 4 ("The browser SHALL never receive the
  //   spec directory path").
  // - "not-found for an id missing from tasks.md" — Pre: an escalation wait
  //   tagged `task: '9'`, `specDir/tasks.md` holding only task 1. Call: GET
  //   `.../:id/task`. Observable: 200 `{ state: 'not-found', id: '9' }`.
  //   Source: task 9 Success line.
  // - "401 without a session (regression guard)" — Pre: a tagged escalation
  //   wait. Call: GET `.../:id/task` with no Authorization header.
  //   Observable: 401. Source: task 9 Success line ("each route answers 401
  //   without a session"); this already holds at base — the global
  //   `requireAccess` hook (`src/controller/access.ts:198-208`) 401s any
  //   request under `/api/controller/` with no bearer or session cookie
  //   before Fastify ever resolves the route, so the check does not depend
  //   on the new route existing. Kept as a regression guard, not a red test.
  //
  // Contract — `GET .../diff`:
  // - "run-gone with no run record" — Pre: an escalation wait with commits,
  //   whose `runId` has no written run record. Call: GET `.../:id/diff`.
  //   Observable: 200 `{ state: 'run-gone' }`. Source: task 9 Success line;
  //   design C6 ("reads the record with `readWait` and the run with
  //   `readRun`").
  // - "no-commits for a wait with none" — Pre: an escalation wait with no
  //   `commits`, whose `runId` has a written run record. Call: GET
  //   `.../:id/diff`. Observable: 200 `{ state: 'no-commits' }`. Source: task
  //   9 Success line.
  // - "404 for an unknown wait id" — same shape as the task route's case.
  // - "401 without a session (regression guard)" — same shape as the task
  //   route's case, same base invariant (`requireAccess` 401s first).
  describe('GET .../:id/task', () => {
    it('answers 404 wait-not-found for an unknown id', async () => {
      const res = await realFetch(url('/w-deadbeef/task'), auth());
      expect(res.status).toBe(404);
      expect(((await res.json()) as any).error).toBe('wait-not-found');
    });

    it('answers no-task for a wait whose question carries no task tag', async () => {
      const wait = await seedEscalationWait();

      const res = await realFetch(url(`/${wait.id}/task`), auth());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ state: 'no-task' });
    });

    it('answers ok with the task row, and leaks no specDir', async () => {
      await fsp.writeFile(join(specDir, 'tasks.md'), TASK_1);
      const wait = await seedEscalationWait({ task: '1' });

      const res = await realFetch(url(`/${wait.id}/task`), auth());
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).not.toContain(specDir);
      expect(JSON.parse(text)).toEqual({
        state: 'ok',
        id: '1',
        title: 'Build the thing',
        success: 'the thing works',
        tdd: true,
        risk: null,
        files: ['src/thing.ts'],
      });
    });

    it('answers not-found for a tagged id missing from tasks.md', async () => {
      await fsp.writeFile(join(specDir, 'tasks.md'), TASK_1);
      const wait = await seedEscalationWait({ task: '9' });

      const res = await realFetch(url(`/${wait.id}/task`), auth());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ state: 'not-found', id: '9' });
    });

    it('answers 401 without a session (regression guard)', async () => {
      const wait = await seedEscalationWait({ task: '1' });

      const res = await realFetch(url(`/${wait.id}/task`));
      expect(res.status).toBe(401);
    });
  });

  describe('GET .../:id/diff', () => {
    it('answers 404 wait-not-found for an unknown id', async () => {
      const res = await realFetch(url('/w-deadbeef/diff'), auth());
      expect(res.status).toBe(404);
      expect(((await res.json()) as any).error).toBe('wait-not-found');
    });

    it('answers run-gone when the run has no record', async () => {
      const wait = await seedEscalationWait({ commits: ['abc1234'], runId: 'run-missing' });

      const res = await realFetch(url(`/${wait.id}/diff`), auth());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ state: 'run-gone' });
    });

    it('answers no-commits for a wait with none', async () => {
      await seedRunRecord('run-nc-1');
      const wait = await seedEscalationWait({ runId: 'run-nc-1' });

      const res = await realFetch(url(`/${wait.id}/diff`), auth());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ state: 'no-commits' });
    });

    it('answers 401 without a session (regression guard)', async () => {
      const wait = await seedEscalationWait({ commits: ['abc1234'], runId: 'run-missing' });

      const res = await realFetch(url(`/${wait.id}/diff`));
      expect(res.status).toBe(401);
    });
  });
});
