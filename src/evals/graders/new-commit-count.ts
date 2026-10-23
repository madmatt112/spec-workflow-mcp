import { gitIn } from './shared.js';
import type { GradeInput, GradeResult } from './shared.js';

/** Passes when `base..HEAD` in `repo` holds exactly `count` commits (Component 5). */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const repo = String(args.repo);
  const count = Number(args.count);
  const base = input.fixture.bases[repo];
  const shas = gitIn(input.fixture, repo, ['log', '--format=%H', `${base}..HEAD`])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    pass: shas.length === count,
    reason: `base..HEAD holds ${shas.length} commit(s), expected ${count}`,
  };
}
