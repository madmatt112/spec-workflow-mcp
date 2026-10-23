import { ATTRIBUTION_PATTERNS } from '../../controller/merge.js';
import { gitIn } from './shared.js';
import type { GradeInput, GradeResult } from './shared.js';

/** Fails when a commit message in `base..HEAD` matches `ATTRIBUTION_PATTERNS` (Component 5). */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const repo = String(args.repo);
  const base = input.fixture.bases[repo];
  const shas = gitIn(input.fixture, repo, ['log', '--format=%H', `${base}..HEAD`])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  for (const sha of shas) {
    const message = gitIn(input.fixture, repo, ['log', '-1', '--format=%B', sha]);
    if (ATTRIBUTION_PATTERNS.some((re) => re.test(message))) {
      return { pass: false, reason: `commit ${sha.slice(0, 7)} carries an attribution trailer` };
    }
  }
  return { pass: true, reason: `no commit in base..HEAD carries an attribution trailer` };
}
