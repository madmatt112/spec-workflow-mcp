import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { loadOrCreateSecret, loadOrCreateAdvisorSecret } from '../../controller/access.js';
import { stageAction } from '../../advisor/actions.js';

// Contract for the advisor action routes (design.md C8; requirements.md
// Requirement 6 AC 2, AC 3, AC 4; task 12 _Prompt). Every test drives a real
// MultiProjectDashboardServer through fetch(), with a temp SPEC_WORKFLOW_HOME,
// XDG_STATE_HOME and SDD_HOME so the real homes are never touched. Actions
// are staged through the real store (`stageAction`, src/advisor/actions.ts,
// task 10/11), exactly as the advisor's stage tools would, then listed,
// confirmed and dismissed over the routes under test. The `backlog` kind is
// used throughout because its executor needs no project/launch dependency,
// keeping each test's pre-condition to the action store alone.
//
// Per success criterion (task 12 _Prompt Success line):
//   (a) "GET lists a staged action"                              -> list test
//   (b) "confirm with the operator bearer runs it"                -> confirm-runs test
//        (also covers the trailing "a repeat confirm gets 409",
//        read as the same action confirmed twice)
//   (c) "confirm with the advisor bearer gets 401 and the action
//        stays staged (6.4)"                                      -> advisor-401 test
//   (d) "dismiss marks dismissed[, and a repeat confirm gets 409]" -> dismiss test
//        (the dismissed-then-confirmed 409 is folded in here,
//        since a dismissed action is the other case design.md C8's
//        "409 on an action not staged" covers)

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

describe('advisor action routes (task 12)', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  let secret: string;
  let advisorSecret: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `advisor-routes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stateHomeDir = join(tempDir, '.xdg-state');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;
    process.env.SDD_HOME = join(tempDir, '.sdd-home');

    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    secret = await loadOrCreateSecret();
    advisorSecret = await loadOrCreateAdvisorSecret();
    _resetMultiServerWarningsForTests();
  });

  afterEach(async () => {
    if (server) { await server.stop(); server = null; }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  function url(suffix: string): string {
    return `http://127.0.0.1:${port}/api/controller/actions${suffix}`;
  }

  function auth(bearer: string, init: RequestInit = {}): RequestInit {
    return {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${bearer}` },
    };
  }

  async function stageBacklog(text: string, conversation: string) {
    return stageAction({
      kind: 'backlog',
      target: {},
      params: { text },
      reason: 'route test',
      conversation,
    });
  }

  async function listViaRoute(): Promise<any[]> {
    const res = await realFetch(url(''), auth(secret));
    const body: any = await res.json();
    return body.actions;
  }

  // (a) Requirement 6 AC 2: "the dashboard SHALL list it". Pre-condition: one
  // staged action (stageAction, direct store call, as the advisor's stage
  // tool would make it). Test: GET /api/controller/actions with the operator
  // bearer. Observable result: 200, and the listed entry carries the same
  // kind, reason, conversation and state 'staged' the action was staged
  // with. Expected value source: AC 2's field list ("kind, target,
  // parameters, the advisor's reason, the conversation id and state
  // staged"), applied to this stageBacklog fixture's own values.
  it('GET lists a staged action with its kind, reason, conversation and state staged', async () => {
    const staged = await stageBacklog('Check the DB migration', 'conv-list');

    const res = await realFetch(url(''), auth(secret));
    expect(res.status).toBe(200);
    const body: any = await res.json();

    const found = body.actions.find((a: any) => a.id === staged.id);
    expect(found).toBeDefined();
    expect(found.kind).toBe('backlog');
    expect(found.reason).toBe('route test');
    expect(found.conversation).toBe('conv-list');
    expect(found.state).toBe('staged');
  });

  // (b) Requirement 6 AC 3: "The action SHALL run only when the operator
  // confirms it"; task 12 Success: "a repeat confirm gets 409" (design.md C8:
  // "409 on an action not `staged`"). Pre-condition: one staged backlog
  // action. Test: POST .../:id/confirm with the operator bearer, twice in a
  // row. Observable result: the first confirm 200s with `{ ok: true }` and
  // the action is listed 'done' afterward; the second confirm on the same id
  // gives 409. Expected value source: the literal "409" of design.md C8 and
  // the task 12 Success line, with 'done' as confirmAction's landing state
  // for a successful backlog executor (src/advisor/actions.ts).
  it('confirm with the operator bearer runs the action once; a repeat confirm gets 409', async () => {
    const staged = await stageBacklog('Only once', 'conv-confirm');

    const first = await realFetch(url(`/${staged.id}/confirm`), { method: 'POST', ...auth(secret) });
    expect(first.status).toBe(200);
    expect(((await first.json()) as any).ok).toBe(true);

    const afterFirst = await listViaRoute();
    expect(afterFirst.find((a) => a.id === staged.id)?.state).toBe('done');

    const second = await realFetch(url(`/${staged.id}/confirm`), { method: 'POST', ...auth(secret) });
    expect(second.status).toBe(409);
  });

  // (c) Requirement 6 AC 4: "The credential the advisor session holds...
  // SHALL be refused (401) by the confirm route; only the browser session
  // the operator logs in with SHALL confirm." Pre-condition: one staged
  // backlog action. Test: POST .../:id/confirm with the advisor bearer.
  // Observable result: 401; a following GET with the operator bearer shows
  // the action still 'staged'. Expected value source: AC 4's literal
  // "refused (401) by the confirm route" and "stays staged" (task 12
  // Success line).
  it('confirm with the advisor bearer gets 401 and the action stays staged', async () => {
    const staged = await stageBacklog('Never run by the advisor', 'conv-advisor');

    const res = await realFetch(url(`/${staged.id}/confirm`), { method: 'POST', ...auth(advisorSecret) });
    expect(res.status).toBe(401);

    const after = await listViaRoute();
    expect(after.find((a) => a.id === staged.id)?.state).toBe('staged');
  });

  // (d) Requirement 6 AC 3: "WHEN the operator dismisses it THEN it SHALL be
  // marked `dismissed` and never run"; folds in the dismissed side of the
  // task 12 Success line's "a repeat confirm gets 409" (design.md C8's "409
  // on an action not `staged`" covers both an already-run and a dismissed
  // action; the already-run case is test (b)). Pre-condition: one staged
  // backlog action. Test: POST .../:id/dismiss with the operator bearer,
  // then POST .../:id/confirm with the operator bearer on the same id.
  // Observable result: dismiss 200s and the action lists 'dismissed'; the
  // following confirm gives 409 and the action still lists 'dismissed' (not
  // 'done'), proving it never ran. Expected value source: AC 3's literal
  // "marked dismissed and never run".
  it('dismiss marks the action dismissed, and never runs it: a later confirm gets 409', async () => {
    const staged = await stageBacklog('This must never be written', 'conv-dismiss');

    const dismissRes = await realFetch(url(`/${staged.id}/dismiss`), { method: 'POST', ...auth(secret) });
    expect(dismissRes.status).toBe(200);

    const afterDismiss = await listViaRoute();
    expect(afterDismiss.find((a) => a.id === staged.id)?.state).toBe('dismissed');

    const confirmRes = await realFetch(url(`/${staged.id}/confirm`), { method: 'POST', ...auth(secret) });
    expect(confirmRes.status).toBe(409);

    const afterConfirm = await listViaRoute();
    expect(afterConfirm.find((a) => a.id === staged.id)?.state).toBe('dismissed');
  });
});
