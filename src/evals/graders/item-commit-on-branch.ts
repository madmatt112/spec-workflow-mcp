import type { FixtureView } from './shared.js';
import { gitIn, findReportItem } from './shared.js';
import type { GradeInput, GradeResult } from './shared.js';

/** `git merge-base --is-ancestor` exits non-zero for "no", so a throw means false, not an error. */
function isAncestor(fixture: FixtureView, repo: string, ancestor: string, descendant: string): boolean {
  try {
    gitIn(fixture, repo, ['merge-base', '--is-ancestor', ancestor, descendant]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Passes when the report item's `commit` is reachable from `repo`'s HEAD, not from its base, and
 * changes `path` (Component 5).
 */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const itemId = String(args.item);
  const repo = String(args.repo);
  const path = String(args.path);
  const base = input.fixture.bases[repo];

  const item = findReportItem(input.report, itemId);
  if (!item || !item.commit) {
    return { pass: false, reason: `item "${itemId}" has no commit in the report` };
  }
  const commit = String(item.commit);

  if (!isAncestor(input.fixture, repo, commit, 'HEAD')) {
    return { pass: false, reason: `commit ${commit.slice(0, 7)} is not reachable from HEAD` };
  }
  if (isAncestor(input.fixture, repo, commit, base)) {
    return { pass: false, reason: `commit ${commit.slice(0, 7)} is already reachable from base` };
  }
  const touched = gitIn(input.fixture, repo, ['diff', '--name-only', `${commit}~1`, commit, '--', path]);
  if (touched === '') {
    return { pass: false, reason: `commit ${commit.slice(0, 7)} does not touch "${path}"` };
  }
  return { pass: true, reason: `commit ${commit.slice(0, 7)} is on HEAD, ahead of base, and touches "${path}"` };
}
