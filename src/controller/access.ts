// src/controller/access.ts
//
// Access control for the dashboard and the controller API (controller-design.md
// §17; foundation-review-adversarial.md "No authentication" blocker). The
// dashboard binds to 127.0.0.1 by default; exposure on the LAN is opt-in. A
// shared secret, generated on first start and kept in the harness home, guards
// every mutating route, every request under `/api/controller/`, and every
// request from a non-loopback address. Read routes stay open on loopback. The
// browser authenticates with a session cookie set by `POST /api/login`; the
// advisor and other programmatic clients send `Authorization: Bearer <secret>`
// (and `?token=<secret>` for the WebSocket upgrade, which a browser cannot carry
// a header on). There is no second user and no roles.
import { promises as fs } from 'fs';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { join } from 'path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { controllerHome } from './state.js';

const SECRET_FILE = 'secret';
const ADVISOR_SECRET_FILE = 'advisor-secret';
const COOKIE_NAME = 'sdd_session';

/** The path under which the advisor's MCP endpoint is mounted; the advisor
 *  secret authorizes exactly this path and nothing else. */
export const ADVISOR_MCP_PATH = '/api/controller/advisor/mcp';

/** The secret file, keyed by path so a per-home test resolves its own secret. */
const secretCache = new Map<string, string>();

/** The shared secret's path: the file `secret` in the controller home. */
export function secretPath(): string {
  return join(controllerHome(), SECRET_FILE);
}

/** The advisor secret's path: the file `advisor-secret` in the controller home. */
export function advisorSecretPath(): string {
  return join(controllerHome(), ADVISOR_SECRET_FILE);
}

/** Clear the in-process secret cache. Tests swap the home between cases. */
export function _resetSecretCacheForTests(): void {
  secretCache.clear();
}

/**
 * Read the shared secret, creating it on the first call: 32 random bytes as hex,
 * written mode 0600. Cached for the process. A concurrent creator is tolerated:
 * the exclusive write loses the race and the file is re-read.
 */
async function loadOrCreateSecretAt(path: string): Promise<string> {
  const cached = secretCache.get(path);
  if (cached) return cached;

  try {
    const existing = (await fs.readFile(path, 'utf-8')).trim();
    if (existing) {
      secretCache.set(path, existing);
      return existing;
    }
  } catch {
    // Absent: create it below.
  }

  const secret = randomBytes(32).toString('hex');
  await fs.mkdir(controllerHome(), { recursive: true });
  try {
    await fs.writeFile(path, secret, { mode: 0o600, flag: 'wx' });
    await fs.chmod(path, 0o600); // Defeat a lenient umask.
    secretCache.set(path, secret);
    return secret;
  } catch {
    const existing = (await fs.readFile(path, 'utf-8')).trim();
    secretCache.set(path, existing);
    return existing;
  }
}

export async function loadOrCreateSecret(): Promise<string> {
  return loadOrCreateSecretAt(secretPath());
}

/** The advisor secret: created the same way as the operator secret, in its
 *  own file, so the two never collide. */
export async function loadOrCreateAdvisorSecret(): Promise<string> {
  return loadOrCreateSecretAt(advisorSecretPath());
}

/** True for any 127.0.0.0/8 or IPv6 loopback address (incl. IPv4-mapped). */
export function isLoopback(ip: string | undefined): boolean {
  if (!ip) return false;
  const addr = ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
  if (addr === '::1') return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(addr);
}

/** Constant-time string compare; a length mismatch returns false immediately. */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function sign(sessionId: string, secret: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('hex');
}

/**
 * A session cookie: a random session id and its HMAC under the secret. HttpOnly,
 * SameSite strict, path /, no expiry beyond the browser session.
 */
export function issueSessionCookie(secret: string): { value: string; header: string } {
  const sessionId = randomBytes(18).toString('hex');
  const value = `${sessionId}.${sign(sessionId, secret)}`;
  const header = `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Strict; Path=/`;
  return { value, header };
}

/** The Set-Cookie header that clears the session cookie. */
export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}

/** Verify a session cookie value against the secret (constant-time on the MAC). */
export function verifySessionCookie(value: string | undefined, secret: string): boolean {
  if (!value) return false;
  const dot = value.lastIndexOf('.');
  if (dot <= 0 || dot === value.length - 1) return false;
  const sessionId = value.slice(0, dot);
  const mac = value.slice(dot + 1);
  return constantTimeEqual(mac, sign(sessionId, secret));
}

/** Parse a Cookie header into a name→value map. */
function parseCookie(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

/** A valid `Authorization: Bearer <secret>` header or a valid session cookie. */
export function isAuthorized(request: FastifyRequest, secret: string): boolean {
  const auth = request.headers['authorization'];
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    if (constantTimeEqual(auth.slice('Bearer '.length), secret)) return true;
  }
  const cookie = parseCookie(request.headers['cookie'])[COOKIE_NAME];
  return verifySessionCookie(cookie, secret);
}

/** A valid `?token=<secret>` query parameter (the WebSocket upgrade's path). */
function tokenAuthorized(request: FastifyRequest, secret: string): boolean {
  const query = (request.query ?? {}) as Record<string, unknown>;
  const token = query.token;
  return typeof token === 'string' && constantTimeEqual(token, secret);
}

/** A valid `Authorization: Bearer <secret>` header; no cookie, no query token. */
function bearerAuthorized(request: FastifyRequest, secret: string): boolean {
  const auth = request.headers['authorization'];
  return typeof auth === 'string' && auth.startsWith('Bearer ') &&
    constantTimeEqual(auth.slice('Bearer '.length), secret);
}

function pathOf(request: FastifyRequest): string {
  return (request.url || '').split('?')[0];
}

/**
 * The `onRequest` hook. It lets a loopback GET/HEAD through, requires the secret
 * for every mutating request, for every request under `/api/controller/`, and
 * for every request from a non-loopback address, and exempts the endpoints and
 * static assets the login box needs. A rejected request gets 401 JSON.
 *
 * The optional advisor secret, when given, additionally authorizes a bearer
 * request to exactly `ADVISOR_MCP_PATH` — nowhere else, and only via the
 * bearer header (never a cookie or the `/ws` query token).
 */
export function makeRequireAccess(secret: string, advisorSecret?: string) {
  return async function requireAccess(request: FastifyRequest, reply: FastifyReply) {
    const method = request.method.toUpperCase();
    const path = pathOf(request);
    const isRead = method === 'GET' || method === 'HEAD';

    // Exempt: authenticate, log out, health, and the assets that render the
    // login box (any read that is not an API call or the WebSocket upgrade).
    if (method === 'POST' && (path === '/api/login' || path === '/api/logout')) return;
    if (isRead && path === '/api/health') return;
    if (isRead && path !== '/ws' && !path.startsWith('/api/')) return;

    const underController = path.startsWith('/api/controller/');

    // Open: a GET/HEAD from loopback to a non-controller route.
    if (isRead && !underController && isLoopback(request.ip)) return;

    // Everything else needs the secret.
    if (isAuthorized(request, secret)) return;
    if (path === '/ws' && tokenAuthorized(request, secret)) return;
    if (path === ADVISOR_MCP_PATH && advisorSecret !== undefined && bearerAuthorized(request, advisorSecret)) return;

    reply.code(401).send({ error: 'unauthorized' });
    return reply;
  };
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Install the access-control hook and the login/logout routes on a Fastify app.
 * Call it before the static, WebSocket and API routes are registered so the
 * hook covers them. `POST /api/login` takes `{ secret }`, compares it in
 * constant time, sets the session cookie and answers 204; a wrong secret waits
 * one second and answers 401. `POST /api/logout` clears the cookie. The
 * optional advisor secret only ever authorizes `ADVISOR_MCP_PATH` — login
 * keeps comparing against the operator secret alone.
 */
export function installAccessControl(app: FastifyInstance, secret: string, advisorSecret?: string): void {
  app.addHook('onRequest', makeRequireAccess(secret, advisorSecret));

  app.post('/api/login', async (request, reply) => {
    const body = (request.body ?? {}) as { secret?: unknown };
    const provided = typeof body.secret === 'string' ? body.secret : '';
    if (constantTimeEqual(provided, secret)) {
      reply.header('set-cookie', issueSessionCookie(secret).header);
      return reply.code(204).send();
    }
    await delay(1000);
    return reply.code(401).send({ error: 'unauthorized' });
  });

  app.post('/api/logout', async (_request, reply) => {
    reply.header('set-cookie', clearSessionCookieHeader());
    return reply.code(204).send();
  });
}
