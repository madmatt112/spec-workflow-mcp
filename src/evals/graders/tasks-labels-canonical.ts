import { readFileSync } from 'fs';
import { join } from 'path';
import { validateTasksMarkdown } from '../../core/task-validator.js';
import type { GradeInput, GradeResult } from './shared.js';

/** Fails when `doc` is missing or carries a near-miss `Test`/`File` label (Component 5). */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const doc = String(args.doc);
  let content: string;
  try {
    content = readFileSync(join(input.fixture.root, doc), 'utf-8');
  } catch {
    return { pass: false, reason: `${doc} is missing from the fixture root` };
  }

  const result = validateTasksMarkdown(content);
  const labelError = result.errors.find((e) => e.message.includes('is not canonical'));
  if (labelError) {
    return { pass: false, reason: labelError.message };
  }
  return { pass: true, reason: `${doc} carries only canonical Test/File labels` };
}
