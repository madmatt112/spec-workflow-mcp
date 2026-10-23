import { findReportItem } from './shared.js';
import type { GradeInput, GradeResult } from './shared.js';

/** Passes when the report item named by `item` has `status` (Component 5). */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const itemId = String(args.item);
  const status = String(args.status);
  const item = findReportItem(input.report, itemId);
  if (!item) {
    return { pass: false, reason: `item "${itemId}" is not in the report` };
  }
  if (item.status === status) {
    return { pass: true, reason: `item "${itemId}" has status "${status}"` };
  }
  return { pass: false, reason: `item "${itemId}" has status "${item.status}", expected "${status}"` };
}
