// src/dashboard_frontend/src/modules/shell/ruling.ts
//
// Design C8 "Ruling view (frontend)" (R1, R3, R5, R6). Pure layout, form and
// answer-payload rules for the ruling view; type-only imports, no React —
// `RulingView.tsx` is the stateful caller.
import type { ControllerWait, ControllerWaitQuestion } from './types';

/** The body layout for a wait, per design C8's rulingLayout table. */
export function rulingLayout(wait: ControllerWait): string {
  if (wait.questions.some((q) => q.id === 'security')) return 'security';
  if (wait.kind === 'escalation' || wait.kind === 'error') {
    return wait.questions[0]?.task ? 'task' : 'taskless';
  }
  if (wait.kind === 'gate-a' || wait.kind === 'gate-b') return 'gate';
  return wait.kind;
}

/** Each question's `recommended`, else `''`. */
export function initialValues(wait: ControllerWait): Record<string, string> {
  const values: Record<string, string> = {};
  for (const q of wait.questions) values[q.id] = q.recommended ?? '';
  return values;
}

/** Options and free give the typed text when non-empty, else the pick; options alone give the pick; otherwise the typed text. */
export function answerOf(q: ControllerWaitQuestion, pick: string, text: string): string {
  if (q.options && q.options.length > 0) {
    if (q.free) {
      const trimmed = text.trim();
      return trimmed !== '' ? trimmed : pick;
    }
    return pick;
  }
  return text;
}

/** False while a radio question has no pick (and no typed text when free), or while a `ruling` question's text is empty after trim. */
export function canSubmit(
  wait: ControllerWait,
  picks: Record<string, string>,
  texts: Record<string, string>,
): boolean {
  for (const q of wait.questions) {
    if (q.options && q.options.length > 0) {
      const hasPick = !!picks[q.id];
      const hasText = !!q.free && (texts[q.id] ?? '').trim() !== '';
      if (!hasPick && !hasText) return false;
    }
    if (q.id === 'ruling' && (texts[q.id] ?? '').trim() === '') return false;
  }
  return true;
}

/** Whether `q`'s answer, as computed by `answerOf`, came from typed text rather than a pick. */
function isTypedAnswer(q: ControllerWaitQuestion, text: string): boolean {
  const hasOptions = !!q.options && q.options.length > 0;
  return !hasOptions || (!!q.free && text.trim() !== '');
}

/**
 * Builds the answer body: with non-empty notes and at least one typed-text
 * answer, the first typed-text answer (in question order) gets a blank
 * line, `Notes: ` and the notes, and `note` stays absent; with only picked
 * answers, the notes travel in `note`. A `retro-plan` wait carries forward
 * the `proposal:<i>` keys from `picks`.
 */
export function answerPayload(
  wait: ControllerWait,
  picks: Record<string, string>,
  texts: Record<string, string>,
  notes: string,
): { answers: Record<string, string>; note?: string } {
  const answers: Record<string, string> = {};
  const typedIds: string[] = [];
  for (const q of wait.questions) {
    const pick = picks[q.id] ?? '';
    const text = texts[q.id] ?? '';
    answers[q.id] = answerOf(q, pick, text);
    if (isTypedAnswer(q, text)) typedIds.push(q.id);
  }
  if (wait.kind === 'retro-plan') {
    (wait.proposals ?? []).forEach((_, i) => {
      const key = `proposal:${i}`;
      if (key in picks) answers[key] = picks[key];
    });
  }
  if (notes && typedIds.length > 0) {
    const firstId = typedIds[0];
    answers[firstId] = `${answers[firstId]}\n\nNotes: ${notes}`;
    return { answers };
  }
  if (notes) return { answers, note: notes };
  return { answers };
}

/** Splits a security wait's text into its header line, finding lines and closing line (`runs.ts:1285-1289`). */
export function securityLines(text: string): { lead: string; findings: string[]; tail: string } {
  const lines = text.split('\n');
  return { lead: lines[0], findings: lines.slice(1, -1), tail: lines[lines.length - 1] };
}

/** True for an `escalation` or `error` whose first question has no `abandon` option. */
export function offersAbandon(wait: ControllerWait): boolean {
  if (wait.kind !== 'escalation' && wait.kind !== 'error') return false;
  const options = wait.questions[0]?.options ?? [];
  return !options.includes('abandon');
}
