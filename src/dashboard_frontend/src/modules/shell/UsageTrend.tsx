import React from 'react';
import type { UsageSpecRow } from './types';

/**
 * Plain-SVG trend of W per task per closed spec (design C11). No charting
 * package (NFR Performance): one polyline per project through its plottable
 * rows in close-date order, a dashed baseline line per project that has one,
 * a legend, and a native title per point for the hover value (design D14).
 * Series colours come from a fixed six-colour list cycled by project name
 * order (design D13).
 */

const SERIES = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];

const VIEW_W = 800;
const VIEW_H = 300;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 32;

interface Point {
  spec: string;
  ts: number;
  wPerTask: number;
}

interface Series {
  projectId: string;
  projectName: string;
  colour: string;
  points: Point[];
  baseline: number | null;
}

export function UsageTrend({ rows }: { rows: UsageSpecRow[] }) {
  // Projects in projectName order; index i takes SERIES[i % 6] (design D13).
  const byProject = new Map<string, UsageSpecRow[]>();
  for (const r of rows) {
    const list = byProject.get(r.projectId);
    if (list) list.push(r);
    else byProject.set(r.projectId, [r]);
  }
  const projectIds = [...byProject.keys()].sort((a, b) =>
    (byProject.get(a)![0].projectName).localeCompare(byProject.get(b)![0].projectName)
  );

  const series: Series[] = [];
  projectIds.forEach((id, i) => {
    const projectRows = byProject.get(id)!;
    const points: Point[] = projectRows
      .filter((r) => r.wPerTask !== null && r.closeDate !== null)
      .map((r) => ({ spec: r.spec, ts: Date.parse(r.closeDate as string), wPerTask: r.wPerTask as number }))
      .filter((p) => Number.isFinite(p.ts))
      .sort((a, b) => a.ts - b.ts);
    if (points.length === 0) return; // only plotted projects carry a series
    const baselineRow = projectRows.find((r) => r.baseline !== null && r.baseline > 0);
    series.push({
      projectId: id,
      projectName: projectRows[0].projectName,
      colour: SERIES[i % SERIES.length],
      points,
      baseline: baselineRow ? baselineRow.baseline : null,
    });
  });

  if (series.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">{'No plotted points yet.'}</p>;
  }

  const allTs = series.flatMap((s) => s.points.map((p) => p.ts));
  const xMin = Math.min(...allTs);
  const xMax = Math.max(...allTs);
  const maxVal = Math.max(
    ...series.flatMap((s) => s.points.map((p) => p.wPerTask)),
    ...series.map((s) => s.baseline ?? 0)
  );
  const yMax = maxVal > 0 ? maxVal * 1.1 : 1;

  const xOf = (ts: number) =>
    xMax === xMin ? (PAD_L + (VIEW_W - PAD_R)) / 2 : PAD_L + ((ts - xMin) / (xMax - xMin)) * (VIEW_W - PAD_R - PAD_L);
  const yOf = (v: number) => VIEW_H - PAD_B - (v / yMax) * (VIEW_H - PAD_B - PAD_T);

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto" role="img" aria-label="W per task trend">
        {/* baseline then plot axis */}
        <line x1={PAD_L} y1={yOf(0)} x2={VIEW_W - PAD_R} y2={yOf(0)} style={{ stroke: 'var(--border-default)' }} strokeWidth={1} />
        {series.map((s) =>
          s.baseline !== null ? (
            <line
              key={`base-${s.projectId}`}
              data-testid={`trend-baseline-${s.projectId}`}
              x1={PAD_L}
              y1={yOf(s.baseline)}
              x2={VIEW_W - PAD_R}
              y2={yOf(s.baseline)}
              style={{ stroke: s.colour }}
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          ) : null
        )}
        {series.map((s) => (
          <polyline
            key={`line-${s.projectId}`}
            data-testid={`trend-line-${s.projectId}`}
            fill="none"
            style={{ stroke: s.colour }}
            strokeWidth={2}
            points={s.points.map((p) => `${xOf(p.ts)},${yOf(p.wPerTask)}`).join(' ')}
          />
        ))}
        {series.flatMap((s) =>
          s.points.map((p) => (
            <circle key={`pt-${s.projectId}-${p.spec}`} cx={xOf(p.ts)} cy={yOf(p.wPerTask)} r={3} style={{ fill: s.colour }}>
              <title>{`${p.spec}: ${Math.round(p.wPerTask).toLocaleString('en-US')}`}</title>
            </circle>
          ))
        )}
      </svg>
      <ul data-testid="trend-legend" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
        {series.map((s) => (
          <li key={`legend-${s.projectId}`} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: s.colour }} />
            {s.projectName}
          </li>
        ))}
      </ul>
    </div>
  );
}
