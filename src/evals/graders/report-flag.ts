import type { GradeInput, GradeResult } from './shared.js';

/** Passes when the report's `flag` starts with `prefix` (Component 5). */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const prefix = String(args.prefix);
  const flag = String((input.report as { flag?: unknown } | null)?.flag ?? '');
  if (flag.startsWith(prefix)) {
    return { pass: true, reason: `flag "${flag}" starts with "${prefix}"` };
  }
  return { pass: false, reason: `flag "${flag}" does not start with "${prefix}"` };
}
