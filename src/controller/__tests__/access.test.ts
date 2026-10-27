import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import fastify, { FastifyInstance } from 'fastify';
import {
  loadOrCreateSecret,
  secretPath,
  isLoopback,
  issueSessionCookie,
  clearSessionCookieHeader,
  verifySessionCookie,
  isAuthorized,
  _resetSecretCacheForTests,
  loadOrCreateAdvisorSecret,
  advisorSecretPath,
  ADVISOR_MCP_PATH,
  installAccessControl,
} from '../access.js';

// Unit coverage for the access primitives (controller-design.md §17): the secret
// file (created once, mode 0600), the loopback test, the session cookie round
// trip, and the authorization decision for a bearer header and a cookie.

let home: string;
let prevHome: string | undefined;

beforeEach(() => {
  prevHome = process.env.SDD_HOME;
  home = mkdtempSync(join(tmpdir(), 'sdd-access-'));
  process.env.SDD_HOME = home;
  _resetSecretCacheForTests();
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = prevHome;
  rmSync(home, { recursive: true, force: true });
});

describe('loadOrCreateSecret', () => {
  it('creates the secret once as 32 bytes of hex with mode 0600', async () => {
    const first = await loadOrCreateSecret();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(statSync(secretPath()).mode & 0o777).toBe(0o600);

    // A fresh read (cache cleared) returns the same value: not regenerated.
    _resetSecretCacheForTests();
    const second = await loadOrCreateSecret();
    expect(second).toBe(first);
  });
});

describe('isLoopback', () => {
  it('accepts IPv4, IPv6 and IPv4-mapped loopback and rejects a LAN address', () => {
    expect(isLoopback('127.0.0.1')).toBe(true);
    expect(isLoopback('127.0.0.5')).toBe(true);
    expect(isLoopback('::1')).toBe(true);
    expect(isLoopback('::ffff:127.0.0.1')).toBe(true);
    expect(isLoopback('192.168.1.10')).toBe(false);
    expect(isLoopback(undefined)).toBe(false);
  });
});

describe('session cookie', () => {
  it('issues a cookie that verifies only under its own secret', async () => {
    const secret = await loadOrCreateSecret();
    const { value, header } = issueSessionCookie(secret);

    expect(verifySessionCookie(value, secret)).toBe(true);
    expect(verifySessionCookie(value, 'other-secret')).toBe(false);
    expect(verifySessionCookie(`${value}x`, secret)).toBe(false);
    expect(verifySessionCookie(undefined, secret)).toBe(false);

    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Strict');
    expect(header).toContain('Path=/');
    expect(header).not.toMatch(/Max-Age|Expires/);

    expect(clearSessionCookieHeader()).toContain('Max-Age=0');
  });
});

describe('isAuthorized', () => {
  it('accepts a matching bearer header or a valid cookie, rejects the rest', async () => {
    const secret = await loadOrCreateSecret();
    const { value } = issueSessionCookie(secret);

    const bearer = { headers: { authorization: `Bearer ${secret}` } } as any;
    const badBearer = { headers: { authorization: 'Bearer nope' } } as any;
    const cookie = { headers: { cookie: `sdd_session=${value}` } } as any;
    const none = { headers: {} } as any;

    expect(isAuthorized(bearer, secret)).toBe(true);
    expect(isAuthorized(cookie, secret)).toBe(true);
    expect(isAuthorized(badBearer, secret)).toBe(false);
    expect(isAuthorized(none, secret)).toBe(false);
  });
});

// C2 (controller-design.md / design.md §C2, task 4): the advisor holds a second
// credential, created like the operator secret but distinct from it, and scoped
// by the hook to exactly ADVISOR_MCP_PATH (_Requirements: 6.4, 7.2).

describe('loadOrCreateAdvisorSecret', () => {
  it('creates the advisor secret once as 32 bytes of hex with mode 0600, distinct from the operator secret', async () => {
    const operatorSecret = await loadOrCreateSecret();
    const first = await loadOrCreateAdvisorSecret();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(operatorSecret);
    expect(statSync(advisorSecretPath()).mode & 0o777).toBe(0o600);

    // A fresh read (cache cleared) returns the same value: not regenerated.
    _resetSecretCacheForTests();
    const second = await loadOrCreateAdvisorSecret();
    expect(second).toBe(first);
  });
});

describe('advisor credential scope', () => {
  let app: FastifyInstance;
  let operatorSecret: string;
  let advisorSecret: string;

  beforeEach(async () => {
    operatorSecret = await loadOrCreateSecret();
    advisorSecret = await loadOrCreateAdvisorSecret();
    app = fastify({ logger: false });
    installAccessControl(app, operatorSecret, advisorSecret);
    app.get(ADVISOR_MCP_PATH, async () => ({ ok: true }));
    app.get('/api/controller/waits', async () => ({ waits: [] }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lets the advisor bearer reach exactly the advisor endpoint, nowhere else, and keeps the operator bearer working everywhere', async () => {
    const advisorOnAdvisorRoute = await app.inject({
      method: 'GET',
      url: ADVISOR_MCP_PATH,
      remoteAddress: '127.0.0.1',
      headers: { authorization: `Bearer ${advisorSecret}` },
    });
    expect(advisorOnAdvisorRoute.statusCode).toBe(200);

    const advisorOnWaits = await app.inject({
      method: 'GET',
      url: '/api/controller/waits',
      remoteAddress: '127.0.0.1',
      headers: { authorization: `Bearer ${advisorSecret}` },
    });
    expect(advisorOnWaits.statusCode).toBe(401);

    const advisorAtLogin = await app.inject({
      method: 'POST',
      url: '/api/login',
      remoteAddress: '127.0.0.1',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ secret: advisorSecret }),
    });
    expect(advisorAtLogin.statusCode).toBe(401);

    const operatorOnAdvisorRoute = await app.inject({
      method: 'GET',
      url: ADVISOR_MCP_PATH,
      remoteAddress: '127.0.0.1',
      headers: { authorization: `Bearer ${operatorSecret}` },
    });
    expect(operatorOnAdvisorRoute.statusCode).toBe(200);

    const operatorOnWaits = await app.inject({
      method: 'GET',
      url: '/api/controller/waits',
      remoteAddress: '127.0.0.1',
      headers: { authorization: `Bearer ${operatorSecret}` },
    });
    expect(operatorOnWaits.statusCode).toBe(200);
  });
});
