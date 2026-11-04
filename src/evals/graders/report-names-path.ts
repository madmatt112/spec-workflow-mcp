import type { GradeInput, GradeResult } from './shared.js';

/**
 * Passes when the report's `key` names `path` (contains it as a substring). Used for the
 * implementer's `amendedTests` key: an implementer that edits an author test file names it
 * in its report so the orchestrator sees the amendment in the round it happened (retro P12).
 */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const key = String(args.key);
  const path = String(args.path);
  const value = String((input.report as Record<string, unknown> | null)?.[key] ?? '');
  if (value.includes(path)) {
    return { pass: true, reason: `report.${key} "${value}" names ${path}` };
  }
  return { pass: false, reason: `report.${key} "${value}" does not name ${path}` };
}
