import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  loadOrCreateSecret,
  secretPath,
  isLoopback,
  issueSessionCookie,
  clearSessionCookieHeader,
  verifySessionCookie,
  isAuthorized,
  _resetSecretCacheForTests,
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
