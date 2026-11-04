import { readFileSync } from 'fs';
import { join } from 'path';
import { parseTasksFromMarkdown, type ParsedTask } from '../../core/task-parser.js';
import type { GradeInput, GradeResult } from './shared.js';

/** The task's `Success:` clause, from the structured prompt or a raw-prompt fallback. */
function successClause(t: ParsedTask): string {
  const structured = t.promptStructured?.find((s) => s.key === 'Success')?.value;
  if (typeof structured === 'string' && structured.length > 0) return structured;
  const m = (t.prompt ?? '').match(/\bSuccess:\s*([^|]*)/);
  return m ? m[1].replace(/_+\s*$/, '').trim() : '';
}

/** Whether a `- File:` entry is a TypeScript source file the ESLint rule covers. */
function isTsFile(f: string): boolean {
  return f.endsWith('.ts') || f.endsWith('.tsx');
}

/**
 * Fails when a task that edits a `.ts`/`.tsx` file omits the worktree-root ESLint binary
 * (`./node_modules/.bin/eslint`) from its `Success:` checks. Every TS-touching task must
 * lint its files at the task gate, so a lint error (for example `import-x/order`) reds
 * there rather than later at the phase-completion gate (retro P2).
 */
export function grade(input: GradeInput, args: Record<string, unknown>): GradeResult {
  const doc = String(args.doc);
  let content: string;
  try {
    content = readFileSync(join(input.fixture.root, doc), 'utf-8');
  } catch {
    return { pass: false, reason: `${doc} is missing from the fixture root` };
  }

  const { tasks } = parseTasksFromMarkdown(content);
  const tsTasks = tasks.filter((t) => (t.files ?? []).some(isTsFile));
  if (tsTasks.length === 0) {
    return { pass: false, reason: `no task in ${doc} edits a .ts/.tsx file to grade` };
  }

  for (const t of tsTasks) {
    if (!/node_modules\/\.bin\/eslint/.test(successClause(t))) {
      return {
        pass: false,
        reason: `task ${t.id} edits a .ts/.tsx file but its Success checks omit ./node_modules/.bin/eslint (retro P2)`,
      };
    }
  }
  return { pass: true, reason: `every TS-touching task lints its files with the worktree-root eslint binary` };
}
