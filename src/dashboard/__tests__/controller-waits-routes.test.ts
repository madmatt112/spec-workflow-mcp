import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { createWait } from '../../controller/waits.js';

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
    server = new MultiProjectDashboardServer({ autoOpen: false, port });
    await server.start();
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

  it('GET lists open and answered waits, newest first, with no specDir on the wire', async () => {
    const older = await seedGateA();
    await new Promise((r) => setTimeout(r, 5));
    const newer = await seedGateA();

    const res = await realFetch(url(''));
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
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: { q1: 'Yes' }, by: 'matthew' }),
    });
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).ok).toBe(true);

    const list: any = await (await realFetch(url(''))).json();
    const answered = list.waits.find((w: any) => w.id === wait.id);
    expect(answered.state).toBe('answered');
    expect(answered.answer.q1.value).toBe('Yes');
    expect(answered.answer.q1.by).toBe('matthew');

    const receipt = await fsp.readFile(join(specDir, 'questions.md'), 'utf-8');
    expect(receipt).toContain('## Gate A');
    expect(receipt).toContain('Answer: Yes');
  });

  it('POST advice attaches advice and 200s', async () => {
    const wait = await seedGateA();
    const res = await realFetch(url(`/${wait.id}/advice`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ advice: 'Looks fine.' }),
    });
    expect(res.status).toBe(200);

    const list: any = await (await realFetch(url(''))).json();
    expect(list.waits.find((w: any) => w.id === wait.id).advice).toBe('Looks fine.');
  });

  it('POST answer on an unknown id gives 404', async () => {
    const res = await realFetch(url('/w-deadbeef/answer'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers: {}, by: 'operator' }),
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as any).error).toBe('wait-not-found');
  });
});
