// src/dashboard/shell/ruling-rows.ts
//
// Live task-row read for the ruling view (design.md C5, Data Models;
// Requirement 3 AC 2, AC 3, AC 5). Reads only `tasks.md` and
// `harness-events.jsonl` under the given spec dir; the returned row holds no
// path, only the task's own `Files` entries.
import { readFileSync } from 'fs';
import { join } from 'path';
import { parseTasksFromMarkdown, taskBlock } from '../../core/task-parser.js';
import { isTddMarked } from '../../controller/phases/implementation.js';
import type { WaitTaskRow } from './types.js';

/**
 * The risk of the newest `note` row in `ledgerText` whose text matches
 * `gate: task <taskId> <gate> risk <risk>` for this task id, across any run.
 * A line that fails to parse as JSON is skipped. `null` when no row matches.
 */
export function riskFromLedger(ledgerText: string, taskId: string): 'low' | 'medium' | 'high' | null {
  const escapedId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^gate: task ${escapedId} \\S+ risk (low|medium|high)\\b`);
  let risk: 'low' | 'medium' | 'high' | null = null;

  for (const line of ledgerText.split('\n')) {
    if (!line.trim()) continue;
    let row: unknown;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof row !== 'object' || row === null) continue;
    const { type, text } = row as Record<string, unknown>;
    if (type !== 'note' || typeof text !== 'string') continue;
    const match = text.match(re);
    if (match) risk = match[1] as 'low' | 'medium' | 'high';
  }

  return risk;
}

/**
 * The live task row for `taskId` from `specDir`'s `tasks.md` and
 * `harness-events.jsonl` (design C5). A missing `tasks.md` or an id absent
 * from it gives `{ state: 'not-found', id }`.
 */
export function readTaskRow(specDir: string, taskId: string): WaitTaskRow {
  let tasksText: string;
  try {
    tasksText = readFileSync(join(specDir, 'tasks.md'), 'utf-8');
  } catch {
    return { state: 'not-found', id: taskId };
  }

  const { tasks } = parseTasksFromMarkdown(tasksText);
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return { state: 'not-found', id: taskId };

  const block = taskBlock(tasksText, taskId) ?? '';
  const success = task.promptStructured?.find((s) => s.key === 'Success')?.value ?? null;

  let ledgerText = '';
  try {
    ledgerText = readFileSync(join(specDir, 'harness-events.jsonl'), 'utf-8');
  } catch {
    ledgerText = '';
  }

  return {
    state: 'ok',
    id: task.id,
    title: task.description,
    success,
    tdd: isTddMarked(task, block),
    risk: riskFromLedger(ledgerText, taskId),
    files: task.files ?? [],
  };
}
