import type { ControllerRun } from './types';

/** A run still paused this long after its resume time reads as overdue. */
export const OVERDUE_GRACE_MS = 5 * 60 * 1000;

/** A span of milliseconds as "2d 3h", "1h 4m", "4m 10s" or "10s". */
export function fmtSpan(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export interface PauseNote {
  /** e.g. "usage-window 1h 45m · resumes in 1h 4m" or "usage-window 20h · overdue 14h". */
  text: string;
  /** Paused and past its resume time by more than the grace: it should have resumed. */
  overdue: boolean;
}

/** Held by the operator: a pause applied now, or requested and still pending. */
export function isOperatorHeld(run: ControllerRun): boolean {
  return run.pauseRequested !== undefined || (run.status === 'paused' && run.pauseReason === 'operator');
}

/** How long a paused or waiting run has been stopped, and when it resumes. */
export function pauseNote(run: ControllerRun, now: number): PauseNote | null {
  if (run.status === 'paused' && run.pauseReason === 'operator') {
    const since = run.pausedAt ? Date.parse(run.pausedAt) : NaN;
    const text = Number.isFinite(since) ? `paused by you ${fmtSpan(now - since)}` : 'paused by you';
    return { text, overdue: false };
  }
  if (run.pauseRequested !== undefined && run.status !== 'paused') {
    if (run.status !== 'waiting') return { text: 'pause requested', overdue: false };
    const waiting = pausedOrWaitingNote(run, now);
    return { text: `${waiting!.text} · pause requested`, overdue: waiting!.overdue };
  }
  return pausedOrWaitingNote(run, now);
}

function pausedOrWaitingNote(run: ControllerRun, now: number): PauseNote | null {
  if (run.status !== 'paused' && run.status !== 'waiting') return null;
  const parts: string[] = [];
  const since = run.pausedAt ? Date.parse(run.pausedAt) : NaN;
  const label = run.pauseReason ?? run.status;
  parts.push(Number.isFinite(since) ? `${label} ${fmtSpan(now - since)}` : label);
  let overdue = false;
  const at = run.resumeAt ? Date.parse(run.resumeAt) : NaN;
  if (run.status === 'paused' && Number.isFinite(at)) {
    if (at > now) {
      parts.push(`resumes in ${fmtSpan(at - now)}`);
    } else {
      overdue = now - at > OVERDUE_GRACE_MS;
      parts.push(overdue ? `overdue ${fmtSpan(now - at)}` : 'resuming');
    }
  }
  return { text: parts.join(' · '), overdue };
}

/** Text colour for a pause note: the warning tone while stopped, the danger tone once overdue. */
export function pauseNoteClass(note: PauseNote): string {
  return note.overdue ? 'text-(--tone-danger-fg)' : 'text-(--tone-warning-fg)';
}
