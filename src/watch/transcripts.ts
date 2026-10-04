/**
 * Transcript locator (design C3).
 *
 * Finds a spawn's subagent transcript under the Claude Code projects directory without
 * reading outside it. The hook writes a transcript at
 * `<projects>/<project>/<session>/subagents/agent-<agentId>.jsonl`
 * (`harness/hooks/sdd-activity.sh:135-142`); this module resolves the session from the
 * activity rows and searches the project directories for that segment, skipping any
 * candidate that a symlink would take outside the projects directory (Security NFR).
 */

import { readdir, realpath, access } from 'fs/promises';
import { constants } from 'fs';
import { homedir } from 'os';
import { join, sep } from 'path';
import type { ActivityEvent } from './ledger.js';

/** Ids that may appear in a filesystem path segment: letters, digits and dashes only. */
const ID_PATTERN = /^[A-Za-z0-9-]+$/;

export type TranscriptLookup =
  | { ok: true; path: string }
  | { ok: false; reason: 'invalid-id' | 'missing' };

/**
 * The Claude Code projects directory: `$CLAUDE_CONFIG_DIR/projects` when the variable is
 * set, else `<home>/.claude/projects`.
 */
export function projectsDir(env: NodeJS.ProcessEnv = process.env, home: string = homedir()): string {
  const cfg = env.CLAUDE_CONFIG_DIR;
  return cfg ? join(cfg, 'projects') : join(home, '.claude', 'projects');
}

/** The `session` of the first activity row carrying this `agentId` (`src/watch/ledger.ts:26-36`). */
export function resolveSession(activity: ActivityEvent[], agentId: string): string | undefined {
  return activity.find(a => a.agentId === agentId)?.session;
}

/**
 * The subagent transcript for a spawn, or why it could not be found.
 *
 * Either id failing `^[A-Za-z0-9-]+$` gives `invalid-id` before any filesystem read. Then
 * each directory entry of `dir` (symlinked entries report `isDirectory()` false under
 * `withFileTypes`, so they are skipped) is tried as
 * `<dir>/<entry>/<session>/subagents/agent-<agentId>.jsonl`. A candidate whose realpath is
 * not under `realpath(dir)` is skipped, so an escaping session symlink cannot read outside
 * the projects directory. The first readable candidate wins; a missing `dir` or no match
 * gives `missing`.
 */
export async function findTranscript(
  session: string,
  agentId: string,
  dir: string = projectsDir(),
): Promise<TranscriptLookup> {
  if (!ID_PATTERN.test(session) || !ID_PATTERN.test(agentId)) {
    return { ok: false, reason: 'invalid-id' };
  }

  let entries;
  let root: string;
  try {
    entries = await readdir(dir, { withFileTypes: true });
    root = await realpath(dir);
  } catch {
    return { ok: false, reason: 'missing' };
  }

  for (const entry of entries) {
    // A symlinked project entry reports isDirectory() false under withFileTypes, so a
    // symlink can never widen the search (design probe).
    if (!entry.isDirectory()) continue;
    const candidate = join(dir, entry.name, session, 'subagents', `agent-${agentId}.jsonl`);
    let real: string;
    try {
      real = await realpath(candidate);
    } catch {
      continue;
    }
    // realpath exposes an escaping link: a candidate that resolves outside the projects
    // directory is skipped (design probe).
    if (!real.startsWith(root + sep)) continue;
    try {
      await access(candidate, constants.R_OK);
    } catch {
      continue;
    }
    return { ok: true, path: candidate };
  }

  return { ok: false, reason: 'missing' };
}
