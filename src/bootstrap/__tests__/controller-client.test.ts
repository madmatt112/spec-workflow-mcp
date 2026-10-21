// Contract for src/bootstrap/controller-client.ts (design C6, Req 5 AC 1, 2, 7;
// Req 7 AC 1, 4; Security and Performance NFRs). Four exports: controllerUrl,
// readSecret, registerWithController, checkHealth. No collaborator inside the
// module is mocked: a real DashboardSessionManager session file, a real secret
// file under a per-test SDD_HOME, and a real local HTTP server on a free port
// stand in for the controller.
//
// controllerUrl(env):
// 1. A live dashboard session -> its url, regardless of env.SDD_PORT.
//    Pre:  SPEC_WORKFLOW_HOME is a per-test temp dir holding activeSession.json
//          with pid: process.pid (alive) and url: 'http://localhost:4321'.
//    Call: await controllerUrl({ SDD_PORT: '9999' })
//    Want: 'http://localhost:4321'
//    Src:  design.md C6 "the url of peekDashboardSession() ... when non-null".
// 2. No live session, a valid SDD_PORT -> http://127.0.0.1:<port>.
//    Pre:  SPEC_WORKFLOW_HOME has no activeSession.json.
//    Call: await controllerUrl({ SDD_PORT: '6001' })
//    Want: 'http://127.0.0.1:6001'
//    Src:  design.md C6 "else http://127.0.0.1: and SDD_PORT when it is a valid port".
// 3. No live session, no SDD_PORT -> http://127.0.0.1:5000 (the default).
//    Pre:  SPEC_WORKFLOW_HOME has no activeSession.json.
//    Call: await controllerUrl({})
//    Want: 'http://127.0.0.1:5000'
//    Src:  design.md C6 "else port 5000"; requirements.md Req 5 AC 2.
// 4. No live session, a non-numeric SDD_PORT -> ignored, falls back to 5000.
//    Pre:  SPEC_WORKFLOW_HOME has no activeSession.json.
//    Call: await controllerUrl({ SDD_PORT: 'not-a-port' })
//    Want: 'http://127.0.0.1:5000'
//    Src:  brief Success clause "ignores a non-numeric SDD_PORT".
//
// readSecret():
// 5. Missing secret file -> null, and the file is never created.
//    Pre:  SDD_HOME is a fresh per-test temp dir; no `secret` file under it.
//    Call: await readSecret()
//    Want: null; a later fs.access on secretPath() still rejects ENOENT.
//    Src:  brief Success clause "readSecret returns null for a missing or
//          empty file and never creates one"; design.md C6 "It never calls
//          loadOrCreateSecret, which creates one".
// 6. Empty secret file -> null.
//    Pre:  secretPath() holds a zero-byte file.
//    Call: await readSecret()
//    Want: null
//    Src:  design.md C6 "missing or empty gives null".
//
// registerWithController(url, secret, body, timeoutMs):
// 7. No shared secret -> a distinct reason, no network call required.
//    Pre:  none (secret argument is null).
//    Call: await registerWithController('http://127.0.0.1:1', null, body)
//    Want: { ok: false, reason: /no shared secret/ }
//    Src:  brief Success clause "reports no shared secret ... as distinct reasons".
// 8. 2xx with a string projectId -> ok true, with the Bearer header and JSON body sent.
//    Pre:  a local HTTP server on a free port answers 200 { projectId: 'proj-1' }
//          and records the request it received.
//    Call: await registerWithController(url, 'sekrit', body)
//    Want: { ok: true, projectId: 'proj-1' }; the server saw
//          authorization: 'Bearer sekrit' and the JSON body.
//    Src:  design.md C6 "succeeds on 2xx with a string projectId"; "posts JSON
//          ... with authorization: Bearer <secret>".
// 9. Controller not answering (nothing listening on the port) -> a distinct reason.
//    Pre:  a free port with no server listening on it.
//    Call: await registerWithController(url, 'sekrit', body)
//    Want: { ok: false, reason: /not answering/ }
//    Src:  brief Success clause "not answering ... as distinct reasons".
// 10. Timed out -> a distinct reason, within the test's time bound.
//     Pre:  a server that accepts the connection and never responds.
//     Call: await registerWithController(url, 'sekrit', body, 200)
//     Want: { ok: false, reason: /timed out/ }, resolving in under 1000 ms.
//     Src:  brief Success clause "timed out ... as distinct reasons"; "a 200 ms
//           timeout against a silent server fails within 1 second".
// 11. Non-2xx status -> a distinct reason naming the status, never the response body or the secret.
//     Pre:  a server answers 500 with a body containing a marker string that
//           must never leak into the reason.
//     Call: await registerWithController(url, 'sekrit', body)
//     Want: { ok: false, reason: /500/ }; reason contains neither the marker
//           body text nor the secret 'sekrit'.
//     Src:  brief Success clause "the non-2xx status as distinct reasons";
//           restriction "no reason string contains the secret or a response body".
//
// checkHealth(url, timeoutMs):
// 12. 200 with ok true -> ok true.
//     Pre:  a server answers 200 { ok: true }.
//     Call: await checkHealth(url)
//     Want: { ok: true }
//     Src:  design.md C6 "Health succeeds on 200 with body.ok === true".
// 13. 200 with ok false -> fails (passes only on 200 with ok true).
//     Pre:  a server answers 200 { ok: false }.
//     Call: await checkHealth(url)
//     Want: { ok: false, reason: expect.any(String) }
//     Src:  brief Success clause "checkHealth passes only on 200 with ok true".
// 14. A 200 ms timeout against a silent server fails within 1 second.
//     Pre:  a server that accepts the connection and never responds.
//     Call: await checkHealth(url, 200)
//     Want: { ok: false }, resolving in under 1000 ms.
//     Src:  brief Success clause "a 200 ms timeout against a silent server
//           fails within 1 second".

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { createServer, type Server } from 'http';
import net from 'net';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  controllerUrl,
  readSecret,
  registerWithController,
  checkHealth,
} from '../controller-client.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { secretPath } from '../../controller/access.js';

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

/** A plain-http test double for the controller, not Fastify, per the brief. */
async function startServer(
  handler: (req: import('http').IncomingMessage, res: import('http').ServerResponse) => void,
): Promise<{ url: string; close: () => Promise<void> }> {
  const port = await getFreePort();
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Accepts the connection and never writes a response. */
async function startSilentServer(): Promise<{ url: string; close: () => Promise<void> }> {
  return startServer(() => {
    // Never call res.end() or res.write(): the client hangs until it times out.
  });
}

const body = { projectPath: '/repo', workflowRootPath: '/store' };

describe('controllerUrl', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `controller-client-url-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = tempDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('picks the live dashboard session url over SDD_PORT', async () => {
    const entry = {
      url: 'http://localhost:4321',
      port: 4321,
      pid: process.pid,
      startedAt: '2026-01-01T00:00:00.000Z',
    };
    await fs.writeFile(join(tempDir, 'activeSession.json'), JSON.stringify(entry), 'utf-8');

    const result = await controllerUrl({ SDD_PORT: '9999' });

    expect(result).toBe('http://localhost:4321');
  });

  it('falls back to a valid SDD_PORT when there is no live session', async () => {
    const result = await controllerUrl({ SDD_PORT: '6001' });

    expect(result).toBe('http://127.0.0.1:6001');
  });

  it('falls back to port 5000 when there is no live session and no SDD_PORT', async () => {
    const result = await controllerUrl({});

    expect(result).toBe('http://127.0.0.1:5000');
  });

  it('ignores a non-numeric SDD_PORT and falls back to port 5000', async () => {
    const result = await controllerUrl({ SDD_PORT: 'not-a-port' });

    expect(result).toBe('http://127.0.0.1:5000');
  });
});

describe('readSecret', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `controller-client-secret-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.env.SDD_HOME = tempDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns null for a missing secret file and never creates one', async () => {
    const result = await readSecret();

    expect(result).toBeNull();
    await expect(fs.access(secretPath())).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns null for an empty secret file', async () => {
    await fs.writeFile(secretPath(), '', 'utf-8');

    const result = await readSecret();

    expect(result).toBeNull();
  });
});

describe('registerWithController', () => {
  it('reports "no shared secret" as a distinct reason when the secret is null', async () => {
    const result = await registerWithController('http://127.0.0.1:1', null as unknown as string, body);

    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toMatch(/no shared secret/i);
  });

  it('succeeds on 2xx with a string projectId, sending the Bearer header and the JSON body', async () => {
    let seenAuth: string | undefined;
    let seenBody: unknown;
    const srv = await startServer((req, res) => {
      seenAuth = req.headers.authorization;
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        seenBody = JSON.parse(raw);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ projectId: 'proj-1' }));
      });
    });

    try {
      const result = await registerWithController(srv.url, 'sekrit', body);

      expect(result).toEqual({ ok: true, projectId: 'proj-1' });
      expect(seenAuth).toBe('Bearer sekrit');
      expect(seenBody).toEqual(body);
    } finally {
      await srv.close();
    }
  });

  it('reports "not answering" as a distinct reason when nothing listens on the port', async () => {
    const port = await getFreePort(); // freed immediately after; nothing listens on it

    const result = await registerWithController(`http://127.0.0.1:${port}`, 'sekrit', body);

    expect(result.ok).toBe(false);
    expect((result as { reason: string }).reason).toMatch(/not answering/i);
  });

  it('reports "timed out" as a distinct reason within 1 second against a silent server', async () => {
    const srv = await startSilentServer();
    try {
      const started = Date.now();
      const result = await registerWithController(srv.url, 'sekrit', body, 200);
      const elapsed = Date.now() - started;

      expect(result.ok).toBe(false);
      expect((result as { reason: string }).reason).toMatch(/timed out/i);
      expect(elapsed).toBeLessThan(1000);
    } finally {
      await srv.close();
    }
  });

  it('reports a non-2xx status as a distinct reason, never the response body or the secret', async () => {
    const marker = 'super-secret-body-marker';
    const srv = await startServer((_req, res) => {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(marker);
    });

    try {
      const result = await registerWithController(srv.url, 'sekrit', body);

      expect(result.ok).toBe(false);
      const reason = (result as { reason: string }).reason;
      expect(reason).toMatch(/500/);
      expect(reason).not.toContain(marker);
      expect(reason).not.toContain('sekrit');
    } finally {
      await srv.close();
    }
  });
});

describe('checkHealth', () => {
  it('passes on 200 with ok true', async () => {
    const srv = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });

    try {
      const result = await checkHealth(srv.url);

      expect(result).toEqual({ ok: true });
    } finally {
      await srv.close();
    }
  });

  it('fails on 200 with ok false', async () => {
    const srv = await startServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false }));
    });

    try {
      const result = await checkHealth(srv.url);

      expect(result.ok).toBe(false);
    } finally {
      await srv.close();
    }
  });

  it('a 200 ms timeout against a silent server fails within 1 second', async () => {
    const srv = await startSilentServer();
    try {
      const started = Date.now();
      const result = await checkHealth(srv.url, 200);
      const elapsed = Date.now() - started;

      expect(result.ok).toBe(false);
      expect(elapsed).toBeLessThan(1000);
    } finally {
      await srv.close();
    }
  });
});
