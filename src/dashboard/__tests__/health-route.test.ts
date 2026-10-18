import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import net from 'net';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { writeRun, writeRateLimit, type RunRecord } from '../../controller/state.js';

// Contract for controller-tasks.md T9: GET /api/health returns the shape
// { ok, version, uptimeSeconds, pid, slots:{inUse,total}, windows, builtAt },
// answers with no auth header (T8's auth layer exempts it), reports the latest
// rate-limit windows when rate-limit.json is present and null when it is not,
// and counts running runs into slots.inUse. The server is a real, locally
// started MultiProjectDashboardServer driven through a real fetch; nothing in
// multi-server.ts is mocked except the npm-version lookup start() does.

// Real fetch captured before the npm-version stub below replaces globalThis.fetch.
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

function runRecord(id: string, status: RunRecord['status']): RunRecord {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    v: 1, id, project: 'proj', codeRoot: '/code', specStore: '/store', spec: 'spec-a',
    worktree: '/wt', branch: 'feat/x', status, created: now, updated: now,
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  };
}

describe('GET /api/health (controller T9)', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let port: number;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `health-route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fsp.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = join(tempDir, '.xdg-state');
    process.env.SDD_HOME = join(tempDir, 'sdd-home');
    delete process.env.SDD_SLOTS;

    // Make start()'s npm-version check fail so it falls back to the local
    // package.json version, deterministically, and never hits the network.
    (globalThis as any).fetch = async () => ({ ok: false, json: async () => ({}) });

    port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    _resetMultiServerWarningsForTests();
  });

  afterEach(async () => {
    if (server) { await server.stop(); server = null; }
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('answers with the full shape, no auth header, when the home is empty', async () => {
    const res = await realFetch(`http://127.0.0.1:${port}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe('string');
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.pid).toBe(process.pid);
    expect(body.slots).toEqual({ inUse: 0, total: 2 });
    expect(body.windows).toBeNull();
    // builtAt is a string from dist/build-info.json, or null under a dev build.
    expect(body.builtAt === null || typeof body.builtAt === 'string').toBe(true);
  });

  it('reports the rate-limit windows and counts running runs into slots.inUse', async () => {
    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.42, resetsAt: '2026-01-01T05:00:00.000Z' },
      sevenDay: { utilization: 0.1, resetsAt: '2026-01-08T00:00:00.000Z' },
      updated: '2026-01-01T00:30:00.000Z',
    });
    await writeRun(runRecord('run-1', 'running'));
    await writeRun(runRecord('run-2', 'running'));
    await writeRun(runRecord('run-3', 'paused'));

    const res = await realFetch(`http://127.0.0.1:${port}/api/health`);
    const body = await res.json() as any;
    expect(body.slots.inUse).toBe(2);
    expect(body.windows.fiveHour.utilization).toBe(0.42);
    expect(body.windows.sevenDay.resetsAt).toBe('2026-01-08T00:00:00.000Z');
  });
});
