import { readFileSync } from 'fs';
import { join } from 'path';
import { parseTasksFromMarkdown, type ParsedTask } from '../../core/task-parser.js';
import type { GradeInput, GradeResult } from './shared.js';

/** The task's `Success:` clause, from the structured prompt or a raw-prompt fallback. */
function successClause(t: ParsedTask): string | undefined {
  const structured = t.promptStructured?.find((s) => s.key === 'Success')?.value;
  if (typeof structured === 'string' && structured.length > 0) return structured;
  const m = (t.prompt ?? '').match(/\bSuccess:\s*([^|]*)/);
  return m ? m[1].replace(/_+\s*$/, '').trim() : undefined;
}

/**
 * Fails when a task's `Success:` clause runs vitest against a directory broad enough
 * to sweep in `flakyTest` (a known concurrency-heavy DB route test), or when no
 * Success clause names the narrow subtree/file `narrow` the task touches. The drafter
 * must scope the command to the touched subtree, not the parent feature directory, so
 * an unrelated flake cannot red the task gate (retro P1).
 */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const doc = String(args.doc);
  const flakyTest = String(args.flakyTest);
  const narrow = String(args.narrow);
  let content: string;
  try {
    content = readFileSync(join(input.fixture.root, doc), 'utf-8');
  } catch {
    return { pass: false, reason: `${doc} is missing from the fixture root` };
  }

  const { tasks } = parseTasksFromMarkdown(content);
  const clauses = tasks
    .map(successClause)
    .filter((v): v is string => typeof v === 'string' && v.length > 0);
  if (clauses.length === 0) {
    return { pass: false, reason: `no task in ${doc} carries a Success clause to grade` };
  }

  const sweeps = (token: string): boolean => {
    const prefix = token.endsWith('/') ? token : token + '/';
    return flakyTest === token || flakyTest.startsWith(prefix);
  };

  for (const clause of clauses) {
    for (const raw of clause.split(/\s+/)) {
      const token = raw.replace(/^[`'"]+/, '').replace(/[`'",.;]+$/, '');
      if (token.includes('/') && sweeps(token)) {
        return {
          pass: false,
          reason: `a Success clause runs vitest against ${token}, which sweeps the flaky route test ${flakyTest} (retro P1)`,
        };
      }
    }
  }

  if (!clauses.join('\n').includes(narrow)) {
    return { pass: false, reason: `no Success clause names the narrow subtree/file ${narrow} (retro P1)` };
  }
  return { pass: true, reason: `Success clauses scope to ${narrow}, not a parent dir sweeping ${flakyTest}` };
}
