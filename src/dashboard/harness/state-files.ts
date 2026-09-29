// src/dashboard/harness/state-files.ts
//
// The machine-wide state files of the harness control pane (design.md C2). The
// active-run pointer and the overwatch HUD resolve under the XDG state home; the
// launch records and logs resolve under the global directory. Every path function
// reads the environment when called, never at module load, so a test's temporary
// XDG_STATE_HOME and SPEC_WORKFLOW_HOME apply.
import { readFileSync, writeFileSync, rmSync, renameSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { getGlobalDir } from '../../core/global-dir.js';
import type { PointerLine, Todo } from './types.js';

/** `$XDG_STATE_HOME` when it is a non-empty string, else `~/.local/state`
 *  (the default of harness/hooks/sdd-activity.sh:11). */
export function stateHome(): string {
  const env = process.env.XDG_STATE_HOME;
  return env && env.length > 0 ? env : join(homedir(), '.local', 'state');
}

/** The shared active-run pointer: `<state home>/sdd/active-run`. */
export function pointerPath(): string {
  return join(stateHome(), 'sdd', 'active-run');
}

/** The overwatch HUD: `<state home>/sdd/overwatch-hud.json`. */
export function hudPath(): string {
  return join(stateHome(), 'sdd', 'overwatch-hud.json');
}

/** `<global dir>/harness` (src/core/global-dir.ts:40-51). */
export function harnessStateDir(): string {
  return join(getGlobalDir(), 'harness');
}

/** The launch records directory: `<harness state dir>/launches`. */
export function launchesDir(): string {
  return join(harnessStateDir(), 'launches');
}

/** The run logs directory: `<harness state dir>/logs`. */
export function logsDir(): string {
  return join(harnessStateDir(), 'logs');
}

/**
 * Read the shared pointer file into one entry per tab-separated line. A line
 * without three non-empty fields is dropped; a missing file gives `[]`.
 */
export function readPointer(path: string): PointerLine[] {
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return [];
  }
  const out: PointerLine[] = [];
  for (const line of text.split('\n')) {
    const parts = line.split('\t');
    const mainCheckout = parts[0];
    const specDir = parts[1];
    const runId = parts[2];
    if (!mainCheckout || !specDir || !runId) continue;
    out.push({ mainCheckout, specDir, runId });
  }
  return out;
}

const MAX_REMOVE_TRIES = 5;

/**
 * Remove this run's line from the shared pointer file, matching on the run id in
 * the third tab-separated field (the algorithm of
 * harness/skills/sdd-continue/references/formats.md:266-281: filter, `rmSync` at
 * zero kept lines, else a pid-named temp file then `renameSync`). Before the
 * write it re-reads the file and, when the text changed since the first read,
 * restarts the filter from the new text, up to five tries, so a line a concurrent
 * run appends is kept. Idempotent: a missing file or no match returns 0 and
 * writes nothing. The `read` seam serves the tests and defaults to `readFileSync`.
 */
export function removePointerLine(
  path: string,
  runId: string,
  read: (p: string) => string = (p) => readFileSync(p, 'utf-8'),
): number {
  for (let attempt = 1; attempt <= MAX_REMOVE_TRIES; attempt++) {
    let text: string;
    try {
      text = read(path);
    } catch {
      return 0; // no pointer file: nothing to remove
    }
    const lines = text.split('\n').filter((l) => l.length > 0);
    const kept = lines.filter((l) => l.split('\t')[2] !== runId);
    const removed = lines.length - kept.length;
    if (removed === 0) return 0; // no match: write nothing

    if (attempt < MAX_REMOVE_TRIES) {
      let current: string;
      try {
        current = read(path);
      } catch {
        return 0; // vanished under us: nothing to remove
      }
      if (current !== text) continue; // changed: restart the filter from the new text
    }

    if (kept.length === 0) {
      rmSync(path, { force: true });
    } else {
      const tmp = `${path}.${process.pid}.tmp`;
      writeFileSync(tmp, kept.join('\n') + '\n');
      renameSync(tmp, path); // atomic replace on the same filesystem
    }
    return removed;
  }
  return 0;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Read the `todos` array from the HUD file, coercing each plain-object item to the
 * to-do shape (a missing string field becomes empty, `done` becomes a boolean) and
 * dropping non-object items. A missing file, bad JSON or a `todos` that is not an
 * array gives `[]` (Req 5 AC 7).
 */
export function readTodos(path: string): Todo[] {
  let text: string;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const todos = (parsed as { todos?: unknown } | null)?.todos;
  if (!Array.isArray(todos)) return [];
  const out: Todo[] = [];
  for (const item of todos) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const t = item as Record<string, unknown>;
    out.push({
      id: asString(t.id),
      title: asString(t.title),
      owner: asString(t.owner),
      blocks: asString(t.blocks),
      note: asString(t.note),
      since: asString(t.since),
      done: t.done === true,
      priority: asString(t.priority),
    });
  }
  return out;
}
