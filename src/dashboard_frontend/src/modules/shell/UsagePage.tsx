import React, { useEffect, useState } from 'react';
import { useShell } from './ShellProvider';

/**
 * Usage (controller-tasks.md T10; controller-design.md §9). The two subscription
 * windows — five-hour and seven-day — as utilisation bars with their reset time,
 * read from `/api/controller/rate-limit` and refreshed on every `controller-runs`
 * push (a run's token write is a cue the windows moved). The rest of the page is
 * still the placeholder for the live/per-spec/trend views of a later release.
 */

interface RateWindow {
  utilization: number; // 0..1
  resetsAt: string;    // ISO
}

interface RateLimitFile {
  v: number;
  fiveHour: RateWindow;
  sevenDay: RateWindow;
  updated: string;
}

/** Human time remaining until an ISO reset, e.g. `resets in 2h 5m`. */
function fmtReset(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return 'reset time unknown';
  const secs = Math.max(0, Math.floor((at - now) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (secs === 0) return 'resetting now';
  if (h) return `resets in ${h}h ${m}m`;
  if (m) return `resets in ${m}m`;
  return `resets in ${secs}s`;
}

function UsageBar({ title, window, now }: { title: string; window: RateWindow; now: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(window.utilization * 100)));
  const hot = window.utilization >= 0.95;
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4" data-testid={`usage-window-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
        <span className="text-sm tabular-nums text-[var(--text-secondary)]">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-inset)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: hot ? 'var(--status-error)' : 'var(--interactive-primary)',
          }}
          data-testid={`usage-bar-${title.toLowerCase().replace(/\s+/g, '-')}`}
        />
      </div>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{fmtReset(window.resetsAt, now)}</p>
    </div>
  );
}

export function UsagePage() {
  const { controllerRuns } = useShell();
  const [rate, setRate] = useState<RateLimitFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(Date.now());

  // Refetch on mount and whenever a `controller-runs` push changes the list.
  useEffect(() => {
    let alive = true;
    fetch('/api/controller/rate-limit')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive) { setRate(data); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [controllerRuns]);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-[var(--text-primary)]">{'Usage'}</h1>

      {loaded && !rate ? (
        <p data-testid="usage-no-windows" className="text-sm text-[var(--text-muted)]">
          {'No usage window seen yet — it appears once a run reports one.'}
        </p>
      ) : rate ? (
        <div className="space-y-3" data-testid="usage-windows">
          <UsageBar title={'Five hour'} window={rate.fiveHour} now={tick} />
          <UsageBar title={'Seven day'} window={rate.sevenDay} now={tick} />
        </div>
      ) : null}

      <p data-testid="usage-placeholder" className="text-sm text-[var(--text-secondary)]">
        {'The live, per-spec and trend usage views arrive in a later release.'}
      </p>
    </div>
  );
}
