import { gitIn } from './shared.js';
import type { GradeInput, GradeResult } from './shared.js';

/**
 * Passes when the lines `base..HEAD` adds in `repo` contain every string in
 * `needles` (Component 5). Used to pin a test author's red tests: each numbered
 * design post-condition id, or each shipped config constant's value, must appear
 * in the new test commit before any implementation exists.
 */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const repo = String(args.repo);
  const needles = (args.needles as unknown[]).map(String);
  const base = input.fixture.bases[repo];
  const diff = gitIn(input.fixture, repo, ['diff', '--unified=0', `${base}..HEAD`]);
  const added = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .join('\n');
  const missing = needles.filter((needle) => !added.includes(needle));
  if (missing.length === 0) {
    return { pass: true, reason: `added lines contain all ${needles.length} needle(s)` };
  }
  return { pass: false, reason: `added lines miss: ${missing.join(', ')}` };
}
