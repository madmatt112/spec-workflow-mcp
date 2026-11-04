// src/advisor/home.ts
//
// Advisor home layout (design.md C1; requirements.md NFR Reliability). Every
// path sits under controllerHome() (src/controller/state.ts:238-243). The
// event log is appended one line at a time, never through writeJsonAtomic,
// because push failures are written from a separate process.
import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { controllerHome } from '../controller/state.js';

export function advisorHomeDir(): string {
  return join(controllerHome(), 'advisor');
}

export function advisorNotesDir(): string {
  return join(advisorHomeDir(), 'notes');
}

export function advisorActionsDir(): string {
  return join(advisorHomeDir(), 'actions');
}

export function advisorOpinionsDir(): string {
  return join(advisorHomeDir(), 'opinions');
}

export function advisorIndexDir(): string {
  return join(advisorHomeDir(), 'index');
}

export function advisorSessionPath(): string {
  return join(advisorHomeDir(), 'session.json');
}

export function sourcesPath(): string {
  return join(controllerHome(), 'sources.json');
}

export function notifyConfigPath(): string {
  return join(controllerHome(), 'notify.json');
}

export interface NotifyConfig {
  v: 1;
  ntfy: { url: string; topic: string; token?: string };
}

function isValidNotifyConfig(value: unknown): value is NotifyConfig {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as { v?: unknown; ntfy?: unknown };
  if (row.v !== 1) return false;
  if (typeof row.ntfy !== 'object' || row.ntfy === null) return false;
  const ntfy = row.ntfy as { url?: unknown; topic?: unknown; token?: unknown };
  if (typeof ntfy.url !== 'string' || ntfy.url.length === 0) return false;
  if (typeof ntfy.topic !== 'string' || ntfy.topic.length === 0) return false;
  if (ntfy.token !== undefined && typeof ntfy.token !== 'string') return false;
  return true;
}

/** Returns undefined for a missing or unparsable file, `v` not 1, or a missing/invalid `ntfy` field. */
export async function readNotifyConfig(): Promise<NotifyConfig | undefined> {
  try {
    const parsed = JSON.parse(await fs.readFile(notifyConfigPath(), 'utf-8'));
    return isValidNotifyConfig(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** True when the file's mode has any group/other bit set; false when it cannot be read. */
export async function notifyConfigIsLoose(): Promise<boolean> {
  try {
    const stat = await fs.stat(notifyConfigPath());
    return (stat.mode & 0o077) !== 0;
  } catch {
    return false;
  }
}

export function searchPath(): string {
  return join(controllerHome(), 'search.json');
}

export function pushedPath(): string {
  return join(controllerHome(), 'pushed.json');
}

export function eventsPath(): string {
  return join(controllerHome(), 'events.jsonl');
}

type ActionKind = 'merge' | 'deploy' | 'launch' | 'answer' | 'deferral' | 'decomposition' | 'backlog';

export type HomeEvent =
  | { v: 1; ts: string; type: 'advisor.opinion'; wait: string; outcome: string; input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }
  | { v: 1; ts: string; type: 'advisor.action'; action: string; kind: ActionKind; target: object; conversation: string; outcome: string; detail?: string }
  | { v: 1; ts: string; type: 'push.failure'; wait: string; detail: string };

const MAX_LINE_BYTES = 4096;

function encodeLine(row: HomeEvent): string {
  const line = JSON.stringify(row) + '\n';
  if (Buffer.byteLength(line, 'utf-8') <= MAX_LINE_BYTES) return line;
  if (typeof (row as { detail?: unknown }).detail !== 'string') return line;

  let detail = (row as { detail: string }).detail;
  let candidateLine = line;
  while (detail.length > 0) {
    const over = Buffer.byteLength(candidateLine, 'utf-8') - MAX_LINE_BYTES;
    if (over <= 0) break;
    detail = detail.slice(0, Math.max(0, detail.length - over));
    candidateLine = JSON.stringify({ ...row, detail }) + '\n';
  }
  return candidateLine;
}

/** Append one event as a JSON line; a row over 4,096 bytes has its `detail` cut to fit. */
export async function appendEvent(row: HomeEvent): Promise<void> {
  const path = eventsPath();
  await fs.mkdir(dirname(path), { recursive: true });
  await fs.appendFile(path, encodeLine(row), 'utf-8');
}
