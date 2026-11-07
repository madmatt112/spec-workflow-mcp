// src/controller/branch-presence.ts
//
// Answer "does this run's branch exist" at most once per stopped run per 60 s
// (design C2, D28). Shared by the feed and the GET route so they spend one
// read budget instead of two.
import type { RunRecord } from './state.js';
import { branchExists } from '../dashboard/harness/worktree.js';

export type BranchRead = (codeRoot: string, branch: string) => Promise<boolean>;

const CACHE_MS = 60_000;

interface CacheEntry {
  at: number;
  value: Promise<boolean>;
}

const cache = new Map<string, CacheEntry>();

export function forgetBranchPresence(runId: string): void {
  cache.delete(runId);
}

export function branchPresent(
  run: Pick<RunRecord, 'id' | 'branch' | 'codeRoot'>,
  read: BranchRead = branchExists,
  now: () => number = Date.now,
): Promise<boolean> {
  if (run.branch === '') return Promise.resolve(false);

  const at = now();
  const existing = cache.get(run.id);
  if (existing && at - existing.at < CACHE_MS) {
    return existing.value;
  }

  const value = read(run.codeRoot, run.branch).catch(() => false);
  cache.set(run.id, { at, value });
  return value;
}
