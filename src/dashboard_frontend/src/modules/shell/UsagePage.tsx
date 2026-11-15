import React, { useEffect, useState } from 'react';
import { useShell } from './ShellProvider';
import { ui } from '../ui/ui';
import type { UsageRunLine, UsageView } from './types';

/**
 * Usage (design C9; Requirement 4, 5). How much of the week is left, how
 * fast it is going, and whether each live run's remaining tasks fit before
 * the reset — all computed by the server (`GET /api/shell/usage`) and
 * refetched on mount and on every `controller-runs` push (design C9); the
 * frontend reads no log.
 */

/** Human time remaining to an instant, e.g. `2h 5m`. */
function timeTo(atMs: number, nowMs: number): string {
  const secs = Math.max(0, Math.floor((atMs - nowMs) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return `${secs}s`;
}

/** "fits before the reset" / "does not fit before the reset" / "not known yet" (design D20). */
function fitText(fit: UsageRunLine['fit']): string {
  if (fit === 'fits') return 'fits before the reset';
  if (fit === 'does-not-fit') return 'does not fit before the reset';
  return 'not known yet';
}

function burnText(burn: number | null): string {
  return burn === null ? 'not known yet' : `${burn.toFixed(1)} pts in 24 h`;
}

export function UsagePage() {
  const { controllerRuns } = useShell();
  const [view, setView] = useState<UsageView | null>(null);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    let alive = true;
    fetch('/api/shell/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data) setView(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [controllerRuns]);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const rateWindow = view?.window ?? null;
  const resetAtMs = rateWindow ? Date.parse(rateWindow.resetsAt) : NaN;
  const windowReset = rateWindow !== null && Number.isFinite(resetAtMs) && resetAtMs <= tick;

  return (
    <div className="space-y-4" data-testid="usage-window">
      <h1 className="text-base font-semibold text-[var(--text-primary)]">{'Usage'}</h1>

      {rateWindow === null ? (
        <p data-testid="usage-no-window" className="text-sm text-[var(--text-muted)]">
          {'No usage window seen yet'}
        </p>
      ) : windowReset ? (
        <div className={`${ui.panel} p-4`}>
          <p data-testid="usage-left" className="text-sm text-[var(--text-primary)]">
            {'window reset — no reading since'}
          </p>
        </div>
      ) : (
        <div className={`${ui.panel} space-y-2 p-4`}>
          <p data-testid="usage-left" className="text-display tabular-nums text-[var(--text-primary)]">
            {`${100 - Math.round(rateWindow.utilization * 100)}% left`}
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-inset)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, Math.round(rateWindow.utilization * 100)))}%`,
                backgroundColor: 'var(--accent)',
              }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {`resets ${new Date(resetAtMs).toLocaleString()} (${timeTo(resetAtMs, tick)})`}
          </p>
        </div>
      )}

      <p data-testid="usage-burn" className="text-sm text-[var(--text-secondary)]">
        {burnText(view?.burn ?? null)}
      </p>

      {view && view.runs.length > 0 && (
        <div className="space-y-2">
          {view.runs.map((run) => (
            <div key={run.runId} className={`${ui.panel} p-3`} data-testid={`usage-run-${run.runId}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-[var(--text-primary)]">{run.projectName}</span>
                <span className="text-[var(--text-secondary)]">{run.spec}</span>
                <span className="text-[var(--text-muted)]">{run.phase ?? '—'}</span>
                <span className="tabular-nums text-[var(--text-secondary)]">{run.tokens.toLocaleString('en-US')}</span>
              </div>
              <p data-testid={`usage-fit-${run.runId}`} className="mt-1 text-xs text-[var(--text-muted)]">
                {run.remaining !== null ? `${run.remaining} tasks remaining — ${fitText(run.fit)}` : fitText(run.fit)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
