import { gitIn } from './shared.js';
import type { GradeInput, GradeResult } from './shared.js';

/** Passes when `repo`'s HEAD still equals its recorded base (Component 5). */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const repo = String(args.repo);
  const base = input.fixture.bases[repo];
  const head = gitIn(input.fixture, repo, ['rev-parse', 'HEAD']);
  if (head === base) {
    return { pass: true, reason: `HEAD ${head.slice(0, 7)} still equals base` };
  }
  return { pass: false, reason: `HEAD ${head.slice(0, 7)} is ahead of base ${base.slice(0, 7)}` };
}
