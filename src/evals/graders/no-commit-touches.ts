import { gitIn } from './shared.js';
import type { GradeInput, GradeResult } from './shared.js';

/** Passes when no commit in `base..HEAD` touches any of `paths` (Component 5). */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const repo = String(args.repo);
  const paths = (args.paths as unknown[]).map(String);
  const base = input.fixture.bases[repo];
  const log = gitIn(input.fixture, repo, ['log', '--format=%H', `${base}..HEAD`, '--', ...paths]);
  if (log === '') {
    return { pass: true, reason: `no commit in base..HEAD touches ${paths.join(', ')}` };
  }
  const sha = log.split('\n')[0].trim();
  return { pass: false, reason: `commit ${sha.slice(0, 7)} touches ${paths.join(', ')}` };
}
