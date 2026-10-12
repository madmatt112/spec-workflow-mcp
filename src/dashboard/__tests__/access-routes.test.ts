import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import { installAccessControl } from '../../controller/access.js';

// Route-level coverage for the shared-secret rule table (controller-design.md
// §17; foundation-review-adversarial.md "No authentication"). The access hook
// and the login/logout routes are installed on a bare Fastify app with routes
// that mirror the real server's shapes, then driven with `inject` and a set
// `remoteAddress` so loopback and a LAN address are both exercised without a
// real socket. `/api/health` is T9's route; here a stub stands in so the
// exemption can be asserted.

const SECRET = 'a'.repeat(64);
const LOOPBACK = '127.0.0.1';
const LAN = '192.168.1.10';

function buildApp(): FastifyInstance {
  const app = fastify({ logger: false });
  installAccessControl(app, SECRET);
  app.get('/api/projects/list', async () => ({ ok: true }));
  app.post('/api/projects/add', async () => ({ ok: true }));
  app.get('/api/controller/waits', async () => ({ waits: [] }));
  app.get('/api/health', async () => ({ ok: true }));
  app.get('/', async (_req, reply) => reply.type('text/html').send('<html></html>'));
  return app;
}

/** The `name=value` of the session cookie from a login response's Set-Cookie. */
function sessionCookie(setCookie: string | string[] | undefined): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  if (!header) throw new Error('no Set-Cookie on the login response');
  return header.split(';')[0];
}

let app: FastifyInstance;

beforeEach(async () => {
  app = buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('access control hook', () => {
  it('allows a loopback GET without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/list', remoteAddress: LOOPBACK });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a loopback POST without auth', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/projects/add', remoteAddress: LOOPBACK });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'unauthorized' });
  });

  it('allows a POST carrying the bearer secret', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects/add',
      remoteAddress: LOOPBACK,
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('rejects a LAN GET without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/list', remoteAddress: LAN });
    expect(res.statusCode).toBe(401);
  });

  it('serves the SPA shell to the LAN so the login box can render', async () => {
    const res = await app.inject({ method: 'GET', url: '/', remoteAddress: LAN });
    expect(res.statusCode).toBe(200);
  });

  it('requires auth for a loopback GET under /api/controller/', async () => {
    const without = await app.inject({ method: 'GET', url: '/api/controller/waits', remoteAddress: LOOPBACK });
    expect(without.statusCode).toBe(401);

    const withBearer = await app.inject({
      method: 'GET',
      url: '/api/controller/waits',
      remoteAddress: LOOPBACK,
      headers: { authorization: `Bearer ${SECRET}` },
    });
    expect(withBearer.statusCode).toBe(200);
  });

  it('exempts GET /api/health even from the LAN', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health', remoteAddress: LAN });
    expect(res.statusCode).toBe(200);
  });
});

describe('login and logout', () => {
  it('sets a cookie that then authorizes reads and writes', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/login',
      remoteAddress: LAN,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ secret: SECRET }),
    });
    expect(login.statusCode).toBe(204);

    const cookie = sessionCookie(login.headers['set-cookie']);

    const lanRead = await app.inject({
      method: 'GET',
      url: '/api/projects/list',
      remoteAddress: LAN,
      headers: { cookie },
    });
    expect(lanRead.statusCode).toBe(200);

    const write = await app.inject({
      method: 'POST',
      url: '/api/projects/add',
      remoteAddress: LOOPBACK,
      headers: { cookie },
    });
    expect(write.statusCode).toBe(200);
  });

  it('rejects a wrong secret with 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/login',
      remoteAddress: LOOPBACK,
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ secret: 'wrong' }),
    });
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body)).toEqual({ error: 'unauthorized' });
  });

  it('clears the cookie on logout', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/logout', remoteAddress: LOOPBACK });
    expect(res.statusCode).toBe(204);
    expect(String(res.headers['set-cookie'])).toContain('Max-Age=0');
  });
});
