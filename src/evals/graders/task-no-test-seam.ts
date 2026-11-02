import { readFileSync } from 'fs';
import { join } from 'path';
import { parseTasksFromMarkdown } from '../../core/task-parser.js';
import type { GradeInput, GradeResult } from './shared.js';

/**
 * Fails when the guard task — the task whose `- File:` names `file` — is missing,
 * or carries a `- Test:` seam. A schema or structural guard task has no behavioural
 * seam: it must be authored implementer-only (no `- Test:`), so the router skips the
 * test author and no red test is forced onto a file the task never declared (retro P6).
 */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const doc = String(args.doc);
  const file = String(args.file);
  let content: string;
  try {
    content = readFileSync(join(input.fixture.root, doc), 'utf-8');
  } catch {
    return { pass: false, reason: `${doc} is missing from the fixture root` };
  }

  const norm = (p: string) => p.replace(/^\.\//, '');
  const target = norm(file);
  const { tasks } = parseTasksFromMarkdown(content);
  const guard = tasks.find((t) => (t.files ?? []).some((f) => norm(f) === target));
  if (!guard) {
    return { pass: false, reason: `no task in ${doc} declares File ${file}` };
  }
  if ((guard.tests?.length ?? 0) > 0) {
    return {
      pass: false,
      reason: `guard task ${guard.id} (${file}) carries a - Test: seam; a schema/structural guard must be implementer-only (retro P6)`,
    };
  }
  return { pass: true, reason: `guard task ${guard.id} (${file}) carries no - Test: seam` };
}
