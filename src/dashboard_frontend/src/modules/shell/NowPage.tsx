import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { PageLayout } from './PageLayout';
import { Group, Row } from './primitives';
import { formatDate } from '../../lib/dateUtils';
import type { Wait } from './types';

const KIND_LABELS: Record<string, string> = {
  gate: 'Gate', ruling: 'Ruling', retro: 'Retro', exited: 'Exited', quiet: 'Quiet',
};

/**
 * The Now page (design C10 Now; Requirement 3). The home page of waits, live
 * runs, idle projects and recently closed specs over the NowModel the task 8
 * provider exposes, filtered to enabled projects. Four groups in a fixed order
 * (Waiting on you, Live runs, Idle projects, Recently closed), Recently closed
 * collapsed by default. Read-only: selecting a wait shows its `detail` in the
 * panel; selecting a live run opens that project's run page. No control answers a
 * gate, approves a plan, dismisses a wait or relaunches a run (Requirement 3
 * AC 7), and no HUD to-do list (AC 10).
 */

/** Human age of an ISO timestamp relative to `now`, ticking each second. */
function fmtAge(iso: string | null, now: number): string | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  let total = Math.floor((now - then) / 1000);
  if (total < 0) total = 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Stable identity of a wait so the open panel re-derives across pushes. */
function waitKey(w: Wait): string {
  return `${w.kind}::${w.projectId}::${w.spec ?? ''}::${w.since}`;
}

function KindBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
      {label}
    </span>
  );
}

function PhaseChip({ phase }: { phase: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[color-mix(in_srgb,var(--accent-primary,#2563eb)_15%,transparent)] px-2 py-0.5 text-xs font-medium text-[var(--accent-primary,#2563eb)]">
      {phase}
    </span>
  );
}

function Age({ value }: { value: string | null }) {
  if (!value) return null;
  return <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{value}</span>;
}

export function NowPage() {
  const navigate = useNavigate();
  const { enabled } = useProjects();
  const { now } = useShell();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());

  // Tick ages every second, as OverviewPage does at :73-77.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const waits = useMemo(() => (now?.waits ?? []).filter((w) => enabled(w.projectId)), [now, enabled]);
  const live = useMemo(() => (now?.live ?? []).filter((r) => enabled(r.projectId)), [now, enabled]);
  const idle = useMemo(() => (now?.idle ?? []).filter((r) => enabled(r.projectId)), [now, enabled]);
  const closed = useMemo(() => (now?.closed ?? []).filter((r) => enabled(r.projectId)), [now, enabled]);

  // Re-derive the selected wait from current data so a push refreshes the panel.
  const selected = useMemo<Wait | null>(
    () => (selectedKey ? waits.find((w) => waitKey(w) === selectedKey) ?? null : null),
    [selectedKey, waits]
  );

  const dash = '—';

  const list = (
    <div>
      <Group name="now-waits" title={'Waiting on you'} count={waits.length}>
        {waits.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'Nothing waiting on you.'}</p>
        ) : (
          waits.map((w) => (
            <Row
              key={waitKey(w)}
              testId={`wait-row-${w.kind}-${w.projectId}`}
              selected={selectedKey === waitKey(w)}
              onClick={() => setSelectedKey(waitKey(w))}
            >
              <KindBadge label={KIND_LABELS[w.kind] ?? w.kind} />
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{w.projectName}</span>
              <span className="shrink-0 font-medium text-[var(--text-primary)]">{w.spec ?? dash}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{w.summary}</span>
              <Age value={fmtAge(w.since, tick)} />
            </Row>
          ))
        )}
      </Group>

      <Group name="now-live" title={'Live runs'} count={live.length}>
        {live.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'No live runs.'}</p>
        ) : (
          live.map((r) => (
            <Row
              key={`${r.projectId}:${r.runId}`}
              testId={`live-row-${r.projectId}`}
              onClick={() => navigate(`/runs/${r.projectId}`)}
            >
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{r.projectName}</span>
              <span className="shrink-0 font-medium text-[var(--text-primary)]">{r.spec}</span>
              {r.phase && <PhaseChip phase={r.phase} />}
              <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{r.detail}</span>
              <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                {r.tokens.toLocaleString()} {'tok'}
              </span>
              <Age value={fmtAge(r.startedAt, tick)} />
            </Row>
          ))
        )}
      </Group>

      <Group name="now-idle" title={'Idle projects'} count={idle.length}>
        {idle.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'No idle projects.'}</p>
        ) : (
          idle.map((r) => (
            <Row key={r.projectId} testId={`idle-row-${r.projectId}`}>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{r.projectName}</span>
              {r.launchable ? (
                <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{r.launchable}</span>
              ) : (
                <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">
                  {r.disabledReason ?? 'No launchable spec'}
                </span>
              )}
            </Row>
          ))
        )}
      </Group>

      <Group name="now-closed" title={'Recently closed'} count={closed.length} defaultCollapsed>
        {closed.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'Nothing closed recently.'}</p>
        ) : (
          closed.map((r) => (
            <Row key={`${r.projectId}:${r.spec}`} testId={`closed-row-${r.projectId}-${r.spec}`}>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{r.projectName}</span>
              <span className="min-w-0 flex-1 truncate text-[var(--text-primary)]">{r.spec}</span>
              <span className="shrink-0 text-xs text-[var(--text-muted)]">{formatDate(r.closedOn)}</span>
            </Row>
          ))
        )}
      </Group>
    </div>
  );

  return <PageLayout list={list} panel={selected ? <WaitPanel wait={selected} /> : undefined} />;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function DetailText({ heading, body }: { heading: string; body?: string | null }) {
  if (!body || !body.trim()) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{heading}</h4>
      <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{body}</p>
    </div>
  );
}

function WaitDetail({ wait }: { wait: Wait }) {
  const d = wait.detail;
  switch (d.kind) {
    case 'gate':
      if (d.items && d.items.length > 0) {
        return (
          <div className="space-y-3">
            {d.items.map((it, i) => (
              <div key={i}>
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">{it.header}</h4>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{it.question}</p>
                {it.options.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-sm text-[var(--text-primary)]">
                    {it.options.map((o, j) => (
                      <li key={j}>{o}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        );
      }
      if (d.questions && d.questions.trim()) {
        return <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{d.questions}</p>;
      }
      return <p className="text-sm text-[var(--text-muted)]">{'no gate payload'}</p>;
    case 'ruling':
      return (
        <div className="space-y-1.5">
          <Field label={'Phase'} value={d.phase} />
          <Field label={'State'} value={d.state} />
          <DetailText heading={'Note'} body={d.note} />
        </div>
      );
    case 'retro':
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--text-primary)]">
          {d.lines.map((line, i) => (
            <li key={i} className="whitespace-pre-wrap">{line}</li>
          ))}
        </ul>
      );
    case 'exited':
      return (
        <div className="space-y-1.5">
          <Field label={'Exit code'} value={d.exitCode === null ? '—' : String(d.exitCode)} />
          <Field label={'Signal'} value={d.signal ?? '—'} />
          <Field label={'End time'} value={formatDate(d.endedAt ?? undefined)} />
          <Field label={'Log path'} value={<span className="font-mono text-xs">{d.logPath}</span>} />
        </div>
      );
    case 'quiet':
      return (
        <div className="space-y-1.5">
          <Field label={'Agent'} value={d.agent} />
          <Field label={'Last tool'} value={d.lastTool ?? '—'} />
          <Field label={'Last activity'} value={formatDate(d.lastActivityAt)} />
        </div>
      );
    default:
      return null;
  }
}

function WaitPanel({ wait }: { wait: Wait }) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4" data-testid="now-panel">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <KindBadge label={KIND_LABELS[wait.kind] ?? wait.kind} />
          <span className="text-xs text-[var(--text-muted)]">{wait.projectName}</span>
        </div>
        <h2 className="mt-1 break-words text-base font-semibold text-[var(--text-primary)]">
          {wait.spec ?? '—'}
        </h2>
      </div>
      <div className="border-t border-[var(--border-default)] pt-3">
        <WaitDetail wait={wait} />
      </div>
    </div>
  );
}
