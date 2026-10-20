import React, { useEffect, useState } from 'react';
import { useShell } from './ShellProvider';
import { Group, Row } from './primitives';
import { UsageTrend } from './UsageTrend';
import type { UsageSpecRow } from './types';

/**
 * Usage (controller-tasks.md T10; controller-design.md §9). The two subscription
 * windows — five-hour and seven-day — as utilisation bars with their reset time,
 * read from `/api/controller/rate-limit` and refreshed on every `controller-runs`
 * push (a run's token write is a cue the windows moved). Below them, W per task
 * per closed spec as a grouped table and a plain-SVG trend (design C11), read
 * from `/api/shell/usage/closed-specs` on the same refetch cue.
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

/** Table cell text per design C11. */
function wText(r: UsageSpecRow): string {
  if (r.w === null) return 'no usage recorded';
  const prefix = r.wUnknown > 0 ? '≥ ' : '';
  const suffix = r.wUnknown > 0 ? ` (${r.wUnknown} unknown)` : '';
  return `${prefix}${Math.round(r.w).toLocaleString('en-US')}${suffix}`;
}

function wPerTaskText(r: UsageSpecRow): string {
  if (r.wPerTask === null) return r.w === null ? 'no usage recorded' : 'no tasks';
  const prefix = r.wUnknown > 0 ? '≥ ' : '';
  return `${prefix}${Math.round(r.wPerTask).toLocaleString('en-US')}`;
}

function pctText(r: UsageSpecRow): string {
  if (r.baseline === null || r.baseline === 0) return 'no baseline';
  if (r.pctOfBaseline === null) return '—';
  return `${Math.round(r.pctOfBaseline).toLocaleString('en-US')}%`;
}

export function UsagePage() {
  const { controllerRuns } = useShell();
  const [rate, setRate] = useState<RateLimitFile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [rows, setRows] = useState<UsageSpecRow[]>([]);
  const [rowsLoaded, setRowsLoaded] = useState(false);

  // Refetch on mount and whenever a `controller-runs` push changes the list.
  useEffect(() => {
    let alive = true;
    fetch('/api/controller/rate-limit')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive) { setRate(data); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [controllerRuns]);

  // Closed-spec rows on the same cue; a failed fetch keeps the last rows.
  useEffect(() => {
    let alive = true;
    fetch('/api/shell/usage/closed-specs')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data && Array.isArray(data.rows)) { setRows(data.rows); setRowsLoaded(true); }
        else if (alive) setRowsLoaded(true);
      })
      .catch(() => { if (alive) setRowsLoaded(true); });
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

      {rowsLoaded && rows.length === 0 ? (
        <p data-testid="usage-no-closed" className="text-sm text-[var(--text-muted)]">
          {'No closed specs yet.'}
        </p>
      ) : rows.length > 0 ? (
        <div className="space-y-4" data-testid="usage-closed-specs">
          <UsageTrend rows={rows} />
          {groupByProject(rows).map(({ projectId, projectName, rows: projectRows }) => (
            <Group key={projectId} name={`usage-${projectId}`} title={projectName} count={projectRows.length}>
              <Row>
                <span className="min-w-0 flex-1 text-xs font-medium text-[var(--text-muted)]">{'Spec'}</span>
                <span className="hidden w-24 shrink-0 text-xs text-[var(--text-muted)] sm:inline">{'Closed'}</span>
                <span className="w-28 shrink-0 text-right text-xs text-[var(--text-muted)]">{'W'}</span>
                <span className="hidden w-14 shrink-0 text-right text-xs text-[var(--text-muted)] sm:inline">{'Tasks'}</span>
                <span className="w-24 shrink-0 text-right text-xs text-[var(--text-muted)]">{'W/task'}</span>
                <span className="hidden w-24 shrink-0 text-right text-xs text-[var(--text-muted)] md:inline">{'% baseline'}</span>
              </Row>
              {projectRows.map((r) => (
                <Row key={r.spec} testId={`usage-row-${projectId}-${r.spec}`}>
                  <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{r.spec}</span>
                  <span className="hidden w-24 shrink-0 text-xs text-[var(--text-secondary)] sm:inline">
                    {r.closeDate ? r.closeDate.slice(0, 10) : '—'}
                  </span>
                  <span className="w-28 shrink-0 text-right tabular-nums text-[var(--text-secondary)]">{wText(r)}</span>
                  <span className="hidden w-14 shrink-0 text-right tabular-nums text-[var(--text-secondary)] sm:inline">
                    {r.tasks === 0 ? 'no tasks' : r.tasks}
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums text-[var(--text-secondary)]">{wPerTaskText(r)}</span>
                  <span className="hidden w-24 shrink-0 text-right tabular-nums text-[var(--text-secondary)] md:inline">{pctText(r)}</span>
                </Row>
              ))}
            </Group>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Group rows by project, preserving the server's project and close-date order. */
function groupByProject(rows: UsageSpecRow[]): { projectId: string; projectName: string; rows: UsageSpecRow[] }[] {
  const out: { projectId: string; projectName: string; rows: UsageSpecRow[] }[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.projectId === r.projectId) last.rows.push(r);
    else out.push({ projectId: r.projectId, projectName: r.projectName, rows: [r] });
  }
  return out;
}
