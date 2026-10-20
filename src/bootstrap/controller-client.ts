// src/bootstrap/controller-client.ts
//
// One module for every controller call `init` and `doctor` make (design C6),
// so the secret handling and the timeouts live in one place. Four exports:
// controllerUrl, readSecret, registerWithController, checkHealth.
//
// Both network calls use the global `fetch` with `signal:
// AbortSignal.timeout(timeoutMs)`, the pattern of `src/dashboard/utils.ts:71-73`.
// The URL sources are loopback by construction (Req 5 AC 2), so there is no host
// check. No reason string ever contains the shared secret or a response body
// (Security NFR).
import { promises as fs } from 'fs';
import { DashboardSessionManager } from '../core/dashboard-session.js';
import { secretPath } from '../controller/access.js';

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_PORT = 5000;

/** Parse an SDD_PORT value: an integer in the 1-65535 range, else null. */
function parsePort(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 65535) return null;
  return n;
}

/**
 * The controller URL: the `url` of the live dashboard session when there is one
 * (peekDashboardSession reads it with no writes), else `http://127.0.0.1:` and a
 * valid SDD_PORT, else port 5000 (design C6, Req 5 AC 2).
 */
export async function controllerUrl(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const session = await new DashboardSessionManager().peekDashboardSession();
  if (session) {
    return session.url;
  }
  const port = parsePort(env.SDD_PORT) ?? DEFAULT_PORT;
  return `http://127.0.0.1:${port}`;
}

/**
 * Read and trim the shared secret at `secretPath()`; a missing or empty file
 * gives null. It never calls `loadOrCreateSecret`, so it never creates the file
 * (design C6, Req 7 AC 4).
 */
export async function readSecret(): Promise<string | null> {
  try {
    const secret = (await fs.readFile(secretPath(), 'utf-8')).trim();
    return secret || null;
  } catch {
    return null;
  }
}

/**
 * Register the project with the controller: POST JSON to `<url>/api/projects/add`
 * with `authorization: Bearer <secret>`. Succeeds on 2xx with a string
 * `projectId`. Failures report distinct reasons, none carrying the secret or the
 * response body (design C6, Req 5 AC 1, 7).
 */
export async function registerWithController(
  url: string,
  secret: string,
  body: { projectPath: string; workflowRootPath: string },
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ ok: true; projectId: string } | { ok: false; reason: string }> {
  if (!secret) {
    return { ok: false, reason: `no shared secret at ${secretPath()}` };
  }

  let response: Response;
  try {
    response = await fetch(`${url}/api/projects/add`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if ((error as { name?: string })?.name === 'TimeoutError') {
      return { ok: false, reason: `timed out after ${timeoutMs} ms` };
    }
    return { ok: false, reason: `controller not answering at ${url}` };
  }

  if (!response.ok) {
    return { ok: false, reason: `controller returned ${response.status}` };
  }

  let data: { projectId?: unknown };
  try {
    data = (await response.json()) as { projectId?: unknown };
  } catch {
    return { ok: false, reason: 'controller returned an unreadable response' };
  }
  if (typeof data.projectId !== 'string') {
    return { ok: false, reason: 'controller returned no projectId' };
  }
  return { ok: true, projectId: data.projectId };
}

/**
 * Check the controller's health: GET `<url>/api/health`. Passes only on 200 with
 * `body.ok === true` (design C6).
 */
export async function checkHealth(
  url: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let response: Response;
  try {
    response = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if ((error as { name?: string })?.name === 'TimeoutError') {
      return { ok: false, reason: `timed out after ${timeoutMs} ms` };
    }
    return { ok: false, reason: `controller not answering at ${url}` };
  }

  if (response.status !== 200) {
    return { ok: false, reason: `controller returned ${response.status}` };
  }

  let data: { ok?: unknown };
  try {
    data = (await response.json()) as { ok?: unknown };
  } catch {
    return { ok: false, reason: 'controller returned an unreadable response' };
  }
  if (data.ok !== true) {
    return { ok: false, reason: 'controller health reported not ok' };
  }
  return { ok: true };
}
