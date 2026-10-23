import { gitIn } from './shared.js';
import type { GradeInput, GradeResult } from './shared.js';

/** Passes when `repo`'s working tree has no pending changes, tracked or untracked (Component 5). */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const repo = String(args.repo);
  const status = gitIn(input.fixture, repo, ['status', '--porcelain', '--untracked-files=all']);
  if (status === '') {
    return { pass: true, reason: `${repo} has no pending changes` };
  }
  return { pass: false, reason: `${repo} has pending changes: ${status.split('\n')[0]}` };
}
