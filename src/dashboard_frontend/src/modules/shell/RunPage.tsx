import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useWs } from '../ws/WebSocketProvider';
import { Group, Chips, Pager, ROWS_PER_PAGE, type Chip } from './primitives';
import { PageLayout, ScrollBox } from './PageLayout';
import { callHarness, present, type OpError, OpErrorView } from './harness';
import { formatDate } from '../../lib/dateUtils';
import type {
  RunModel, AgentProfile, LaunchRecord, SpawnNode, SetupView,
} from '../harness/types';
import type { RunDetail, LedgerEvent, ActivityEvent } from './types';

/**
 * The run page (design C10 Runs, D6, D11; Requirement 4 AC 2 to 8, 13). Holds the
 * `harness` view for the route's project only while mounted and renders, from
 * `harness-model` and `harness-run-detail`: the phase strip; each open spawn; the
 * task table (verdict and tdd from the task-review summary route polled every 5 s);
 * rounds and spawns as two collapsed tables; and tabbed Ledger, Activity and
 * Process logs, each with a filter and a follow toggle. The panel shows the run's
 * properties, a Stop button on the existing stop route, and the saved setup as a
 * collapsed table. A project with no ledger shows "no run for this project".
 */

const STALE_MS = 15 * 60 * 1000;
const TASK_STATUSES = ['done', 'in-progress', 'open'] as const;

type TaskReviewSummary = Record<string, { verdict: string; version: number; tdd?: any }>;

function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function RunPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { subscribe, unsubscribe, watchView } = useWs();

  const [model, setModel] = useState<RunModel | null>(null);
  const [profiles, setProfiles] = useState<Record<string, AgentProfile>>({});
  const [launch, setLaunch] = useState<LaunchRecord | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [summary, setSummary] = useState<TaskReviewSummary>({});
  const [view, setView] = useState<SetupView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<OpError | null>(null);

  const launchRef = useRef<LaunchRecord | null>(null);
  const prefix = projectId ? `/api/projects/${encodeURIComponent(projectId)}` : '';

  // Hold the harness view for this project alone while mounted (design D11).
  useEffect(() => {
    if (!projectId) return;
    setModel(null); setDetail(null); setLaunch(null); launchRef.current = null;
    setLogLines([]); setSummary({}); setLoaded(false);
    const release = watchView({ kind: 'harness', projectId });

    const onModel = (d: { model: RunModel | null; profiles: Record<string, AgentProfile>; launch: LaunchRecord | null }) => {
      setModel(d.model);
      setProfiles(d.profiles || {});
      setLaunch(d.launch);
      launchRef.current = d.launch;
      setLoaded(true);
    };
    const onDetail = (d: RunDetail | null) => setDetail(d);
    const onLog = (d: { launchedAt: string; lines: string[]; reset: boolean }) => {
      setLogLines((prev) => {
        const current = launchRef.current?.launchedAt;
        if (current && d.launchedAt !== current) return prev;
        const base = d.reset ? [] : prev;
        const next = base.concat(d.lines || []);
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    };

    subscribe('harness-model', onModel);
    subscribe('harness-run-detail', onDetail);
    subscribe('harness-log', onLog);
    return () => {
      unsubscribe('harness-model', onModel);
      unsubscribe('harness-run-detail', onDetail);
      unsubscribe('harness-log', onLog);
      release();
    };
  }, [projectId, watchView, subscribe, unsubscribe]);

  // The setup view for the panel's saved/defaults table.
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    fetch(`${prefix}/harness/setup`)
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => { if (alive) setView(v); })
      .catch(() => { /* a panel without a setup view just omits the table */ });
    return () => { alive = false; };
  }, [projectId, prefix]);

  // Tick ages and elapsed times every second.
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Poll the task-review summary every 5 s while the spec has tasks.
  const spec = model?.spec || null;
  const hasTasks = (model?.tasks?.length ?? 0) > 0;
  useEffect(() => {
    if (!projectId || !spec || !hasTasks) { setSummary({}); return; }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`${prefix}/specs/${encodeURIComponent(spec)}/task-reviews/summary`);
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setSummary(data.summary || {});
      } catch { /* a missing summary just shows no verdicts */ }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [projectId, prefix, spec, hasTasks]);

  const stop = useCallback(async () => {
    if (!projectId) return;
    setBusy(true);
    setOpError(null);
    const res = await callHarness(`${prefix}/harness/stop`, 'POST');
    setBusy(false);
    if (!res.ok) setOpError({ status: res.status, body: res.data });
  }, [projectId, prefix]);

  const hasRun = !!model && (
    !!model.runId || model.phases.length > 0 || model.spawns.length > 0 ||
    model.tasks.length > 0 || model.rounds.length > 0 || (detail?.ledgerRows.length ?? 0) > 0
  );

  const openSpawns = useMemo(() => (model?.spawns ?? []).filter((s) => !s.endedAt), [model]);

  const list = (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate('/runs')}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          {t('shell.runs.run.back', '← Runs')}
        </button>
        {spec && <h1 className="min-w-0 break-words text-base font-semibold text-[var(--text-primary)]">{spec}</h1>}
      </div>

      {loaded && !hasRun ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] p-8 text-center text-sm text-[var(--text-secondary)]" data-testid="run-empty">
          {t('shell.runs.run.noRun', 'no run for this project')}
        </div>
      ) : (
        <>
          {detail && <PhaseStrip strip={detail.phaseStrip} />}
          <OpenSpawns spawns={openSpawns} profiles={profiles} now={tick} />
          {hasTasks && model && <TaskTable model={model} detail={detail} summary={summary} />}
          <CollapsedTables model={model} profiles={profiles} now={tick} />
          <LogTabs detail={detail} logLines={logLines} />
        </>
      )}
    </div>
  );

  const panel = (
    <RunPanel
      model={model}
      launch={launch}
      view={view}
      busy={busy}
      opError={opError}
      onStop={stop}
    />
  );

  return <PageLayout list={list} panel={panel} />;
}

// --- Phase strip -----------------------------------------------------------

function PhaseStrip({ strip }: { strip: RunDetail['phaseStrip'] }) {
  const { t } = useTranslation();
  if (!strip || strip.length === 0) return null;
  return (
    <ScrollBox>
      <div className="flex gap-2" data-testid="phase-strip">
        {strip.map((p) => (
          <div
            key={p.phase}
            className={`min-w-[7rem] flex-1 rounded border p-2 text-xs ${
              p.live
                ? 'border-[var(--interactive-primary)] bg-[color-mix(in_srgb,var(--interactive-primary)_12%,transparent)]'
                : 'border-[var(--border-default)]'
            }`}
          >
            <div className="font-medium text-[var(--text-primary)] break-words">{p.phase}</div>
            <div className="text-[var(--text-muted)]">{p.version ?? t('shell.runs.none', '—')}</div>
            <div className="text-[var(--text-muted)]">{t('shell.runs.run.rounds', 'Rounds')}: {p.rounds}</div>
            {p.approvedOn && <div className="text-[var(--text-muted)]">{formatDate(p.approvedOn)}</div>}
          </div>
        ))}
      </div>
    </ScrollBox>
  );
}

// --- Open spawns -----------------------------------------------------------

function OpenSpawns({ spawns, profiles, now }: { spawns: SpawnNode[]; profiles: Record<string, AgentProfile>; now: number }) {
  const { t } = useTranslation();
  return (
    <div className="min-w-0">
      <div className="mb-1 text-sm font-medium text-[var(--text-primary)]">{t('shell.runs.run.openSpawns', 'Open spawns')}</div>
      {spawns.length === 0 ? (
        <p className="px-2 py-1 text-sm text-[var(--text-muted)]">{t('shell.runs.run.noOpenSpawns', 'No open spawns.')}</p>
      ) : (
        <div className="space-y-1">
          {spawns.map((s, i) => {
            const profile = profiles[s.agent];
            const declared = profile ? `${profile.model} / ${profile.effort}` : null;
            const elapsed = fmtDuration(now - Date.parse(s.startedAt));
            const idleMs = s.lastActivityAt ? now - Date.parse(s.lastActivityAt) : NaN;
            const stale = Number.isFinite(idleMs) && idleMs > STALE_MS;
            return (
              <div key={i} className="rounded border border-[var(--border-default)] p-2 text-sm min-w-0" data-testid={`spawn-open-${s.agent}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--text-primary)] break-words">{s.role || s.agent}</span>
                  <span className="text-xs text-[var(--text-muted)]">{s.agent}</span>
                  {present(s.lastActivityAt) && (
                    <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                      stale ? 'bg-[color-mix(in_srgb,var(--status-error)_15%,transparent)] text-[var(--status-error)]' : 'bg-[var(--surface-inset)] text-[var(--text-muted)]'
                    }`}>
                      {fmtDuration(idleMs)}{stale ? ` ${t('shell.runs.run.stale', 'idle >15m')}` : ''}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-[var(--text-secondary)] break-words">
                  {present(declared) && <>{t('shell.runs.run.declared', 'declared')}: {declared} · </>}
                  {present(s.model) && <>{t('shell.runs.run.actual', 'actual')}: {s.model} · </>}
                  {t('shell.runs.run.elapsed', 'elapsed')}: {elapsed}
                  {present(s.lastTool) && <> · {t('shell.runs.run.lastTool', 'last tool')}: {s.lastTool}</>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Task table ------------------------------------------------------------

const TASK_STATUS_STYLES: Record<string, string> = {
  done: 'bg-[color-mix(in_srgb,#22c55e_18%,transparent)] text-green-600 dark:text-green-400',
  'in-progress': 'bg-[color-mix(in_srgb,var(--interactive-primary)_15%,transparent)] text-[var(--interactive-primary)]',
  open: 'bg-[var(--surface-inset)] text-[var(--text-muted)]',
};

function TaskTable({ model, detail, summary }: { model: RunModel; detail: RunDetail | null; summary: TaskReviewSummary }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const counts = useMemo(() => {
    const c: Record<string, number> = { done: 0, 'in-progress': 0, open: 0 };
    for (const task of model.tasks) if (c[task.status] !== undefined) c[task.status] += 1;
    return c;
  }, [model.tasks]);

  const filtered = useMemo(
    () => model.tasks.filter((task) => active.length === 0 || active.includes(task.status)),
    [model.tasks, active]
  );
  useEffect(() => { setPage(0); }, [active]);

  const pageRows = filtered.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);
  const chips: Chip[] = TASK_STATUSES.map((s) => ({ value: s, label: t(`shell.runs.run.status.${s}`, s), count: counts[s] }));
  const toggle = (v: string) => setActive((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const dash = t('shell.runs.none', '—');

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-[var(--text-primary)]">{t('shell.runs.run.tasks', 'Tasks')}</div>
        <Chips chips={chips} active={active} onToggle={toggle} />
      </div>
      <ScrollBox>
        <table className="w-full border-collapse text-sm" data-testid="task-table">
          <thead>
            <tr className="text-left text-xs text-[var(--text-muted)]">
              <th className="py-1 pr-3 font-medium">{t('shell.runs.run.task.id', 'ID')}</th>
              <th className="py-1 pr-3 font-medium">{t('shell.runs.run.task.title', 'Title')}</th>
              <th className="py-1 pr-3 font-medium">{t('shell.runs.run.task.status', 'Status')}</th>
              <th className="py-1 pr-3 font-medium">{t('shell.runs.run.task.verdict', 'Verdict')}</th>
              <th className="py-1 pr-3 font-medium">{t('shell.runs.run.task.tdd', 'TDD')}</th>
              <th className="py-1 pr-3 font-medium">{t('shell.runs.run.task.risk', 'Risk')}</th>
              <th className="py-1 font-medium">{t('shell.runs.run.task.fixRounds', 'Fix rounds')}</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((task) => {
              const rev = summary[task.id];
              const meta = detail?.taskMeta?.[task.id];
              const tdd = rev?.tdd ? (typeof rev.tdd === 'string' ? rev.tdd : JSON.stringify(rev.tdd)) : null;
              return (
                <tr key={task.id} className="border-t border-[var(--border-default)]" data-testid={`task-row-${task.id}`}>
                  <td className="py-1 pr-3 font-mono text-xs text-[var(--text-muted)]">{task.id}</td>
                  <td className="py-1 pr-3 text-[var(--text-primary)]">{task.title}</td>
                  <td className="py-1 pr-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TASK_STATUS_STYLES[task.status] ?? TASK_STATUS_STYLES.open}`}>
                      {task.status}
                    </span>
                  </td>
                  <td className="py-1 pr-3 text-[var(--text-secondary)]">{rev?.verdict ?? dash}</td>
                  <td className="py-1 pr-3 text-[var(--text-secondary)] break-words">{tdd ?? dash}</td>
                  <td className="py-1 pr-3 text-[var(--text-secondary)]">{meta?.risk ?? dash}</td>
                  <td className="py-1 text-[var(--text-secondary)]">{meta?.fixRounds ?? dash}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollBox>
      <Pager total={filtered.length} page={page} onPage={setPage} />
    </div>
  );
}

// --- Rounds and spawns, two collapsed tables -------------------------------

function CollapsedTables({ model, profiles, now }: { model: RunModel | null; profiles: Record<string, AgentProfile>; now: number }) {
  const { t } = useTranslation();
  if (!model) return null;
  const dash = t('shell.runs.none', '—');
  return (
    <div className="min-w-0">
      <Group name="run-rounds" title={t('shell.runs.run.rounds', 'Rounds')} count={model.rounds.length} defaultCollapsed>
        {model.rounds.length === 0 ? (
          <p className="px-2 py-1 text-sm text-[var(--text-muted)]">{t('shell.runs.run.noRounds', 'No rounds.')}</p>
        ) : (
          <ScrollBox>
            <table className="w-full border-collapse text-sm" data-testid="rounds-table">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)]">
                  <th className="py-1 pr-3 font-medium">{t('shell.runs.run.round.phase', 'Phase')}</th>
                  <th className="py-1 pr-3 font-medium">{t('shell.runs.run.round.round', 'Round')}</th>
                  <th className="py-1 pr-3 font-medium">{t('shell.runs.run.round.verdict', 'Verdict')}</th>
                  <th className="py-1 font-medium">{t('shell.runs.run.round.version', 'Version')}</th>
                </tr>
              </thead>
              <tbody>
                {model.rounds.map((r, i) => (
                  <tr key={i} className="border-t border-[var(--border-default)]">
                    <td className="py-1 pr-3 text-[var(--text-primary)]">{r.phase}</td>
                    <td className="py-1 pr-3 text-[var(--text-secondary)]">{r.round}</td>
                    <td className="py-1 pr-3 text-[var(--text-secondary)]">{r.verdict}</td>
                    <td className="py-1 text-[var(--text-secondary)]">{r.version ?? dash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBox>
        )}
      </Group>

      <Group name="run-spawns" title={t('shell.runs.run.spawns', 'Spawns')} count={model.spawns.length} defaultCollapsed>
        {model.spawns.length === 0 ? (
          <p className="px-2 py-1 text-sm text-[var(--text-muted)]">{t('shell.runs.run.noSpawns', 'No spawns.')}</p>
        ) : (
          <ScrollBox>
            <table className="w-full border-collapse text-sm" data-testid="spawns-table">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)]">
                  <th className="py-1 pr-3 font-medium">{t('shell.runs.run.spawn.role', 'Role')}</th>
                  <th className="py-1 pr-3 font-medium">{t('shell.runs.run.spawn.declared', 'Declared')}</th>
                  <th className="py-1 pr-3 font-medium">{t('shell.runs.run.spawn.actual', 'Actual')}</th>
                  <th className="py-1 pr-3 font-medium">{t('shell.runs.run.spawn.tokens', 'Tokens')}</th>
                  <th className="py-1 font-medium">{t('shell.runs.run.spawn.elapsed', 'Elapsed')}</th>
                </tr>
              </thead>
              <tbody>
                {model.spawns.map((s, i) => {
                  const profile = profiles[s.agent];
                  const declared = profile ? `${profile.model} / ${profile.effort}` : dash;
                  const end = s.endedAt ? Date.parse(s.endedAt) : now;
                  return (
                    <tr key={i} className="border-t border-[var(--border-default)]">
                      <td className="py-1 pr-3 text-[var(--text-primary)]">
                        {s.role || s.agent}
                        <span className="ml-1 text-xs text-[var(--text-muted)]">{s.level === 2 ? '·' : ''}</span>
                      </td>
                      <td className="py-1 pr-3 text-[var(--text-secondary)] break-words">{declared}</td>
                      <td className="py-1 pr-3 text-[var(--text-secondary)]">{s.model ?? dash}{s.provider ? ` (${s.provider})` : ''}</td>
                      <td className="py-1 pr-3 text-[var(--text-secondary)] tabular-nums">{s.tokens ?? dash}</td>
                      <td className="py-1 text-[var(--text-secondary)] tabular-nums">{fmtDuration(end - Date.parse(s.startedAt))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollBox>
        )}
      </Group>
    </div>
  );
}

// --- Log tabs --------------------------------------------------------------

function ledgerLine(e: LedgerEvent): string {
  const parts = [e.ts, e.type];
  for (const [k, v] of Object.entries(e)) {
    if (k === 'ts' || k === 'type' || v === undefined) continue;
    parts.push(`${k}=${v}`);
  }
  return parts.join(' ');
}

function activityLine(a: ActivityEvent): string {
  const parts = [a.ts, a.agent, a.event];
  if (a.tool) parts.push(a.tool);
  if (a.summary) parts.push(a.summary);
  if (typeof a.tokens === 'number') parts.push(`${a.tokens}t`);
  return parts.join(' ');
}

function LogTabs({ detail, logLines }: { detail: RunDetail | null; logLines: string[] }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'ledger' | 'activity' | 'process'>('ledger');

  const lines = useMemo(() => {
    if (tab === 'ledger') return (detail?.ledgerRows ?? []).map(ledgerLine);
    if (tab === 'activity') return (detail?.activityRows ?? []).map(activityLine);
    return logLines;
  }, [tab, detail, logLines]);

  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'ledger', label: t('shell.runs.run.tab.ledger', 'Ledger') },
    { id: 'activity', label: t('shell.runs.run.tab.activity', 'Activity') },
    { id: 'process', label: t('shell.runs.run.tab.process', 'Process log') },
  ];

  return (
    <div className="min-w-0">
      <div className="flex gap-1 border-b border-[var(--border-default)]" role="tablist">
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            data-testid={`log-tab-${tb.id}`}
            className={`px-3 py-1.5 text-sm ${tab === tb.id ? 'border-b-2 border-[var(--interactive-primary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <LogView key={tab} lines={lines} />
    </div>
  );
}

function LogView({ lines }: { lines: string[] }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [follow, setFollow] = useState(true);
  const boxRef = useRef<HTMLPreElement>(null);

  const q = filter.trim().toLowerCase();
  const shown = q ? lines.filter((l) => l.toLowerCase().includes(q)) : lines;

  // With follow on, a new row scrolls the box to the bottom.
  useEffect(() => {
    if (follow && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [shown.length, follow]);

  return (
    <div>
      <div className="my-2 flex items-center gap-3">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={t('shell.runs.run.filter', 'Filter')}
          data-testid="log-filter"
          className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-1 text-sm text-[var(--text-primary)]"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} data-testid="log-follow" />
          {t('shell.runs.run.follow', 'Follow')}
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="px-2 py-1 text-sm text-[var(--text-muted)]">{t('shell.runs.run.noRows', 'No rows.')}</p>
      ) : (
        <pre ref={boxRef} className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--border-default)] bg-[var(--surface-inset)] p-2 text-xs text-[var(--text-secondary)]">
          {shown.join('\n')}
        </pre>
      )}
    </div>
  );
}

// --- Run panel -------------------------------------------------------------

function PanelField({ label, value }: { label: string; value: React.ReactNode }) {
  if (!present(value)) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[var(--text-primary)]">{String(value)}</span>
    </div>
  );
}

function RunPanel({
  model, launch, view, busy, opError, onStop,
}: {
  model: RunModel | null;
  launch: LaunchRecord | null;
  view: SetupView | null;
  busy: boolean;
  opError: OpError | null;
  onStop: () => void;
}) {
  const { t } = useTranslation();
  const canStop = launch?.state === 'running' || launch?.state === 'stopping';
  const saved = view?.saved ?? null;

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4" data-testid="run-panel">
      <div className="space-y-1">
        <PanelField label={t('shell.runs.run.panel.runId', 'Run id')} value={model?.runId ?? launch?.runId ?? undefined} />
        <PanelField label={t('shell.runs.run.panel.start', 'Start')} value={model?.runStartedAt ? formatDate(model.runStartedAt) : undefined} />
        <PanelField label={t('shell.runs.run.panel.codeRoot', 'Code root')} value={model?.codeRoot} />
        <PanelField label={t('shell.runs.run.panel.worktree', 'Worktree')} value={model?.worktree} />
        <PanelField label={t('shell.runs.run.panel.headless', 'Headless')} value={model?.headless} />
        <PanelField label={t('shell.runs.run.panel.providers', 'Providers')} value={model?.providers} />
        <PanelField label={t('shell.runs.run.panel.tokens', 'Tokens')} value={typeof model?.tokensTotal === 'number' ? model.tokensTotal.toLocaleString() : undefined} />
        <PanelField label={t('shell.runs.run.panel.pid', 'Launch PID')} value={launch?.pid} />
      </div>

      <button
        type="button"
        onClick={onStop}
        disabled={!canStop || busy}
        data-testid="run-stop"
        className="mt-3 rounded-md bg-[var(--status-error)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {launch?.state === 'stopping' ? t('shell.runs.run.stopping', 'Stopping…') : t('shell.runs.run.stop', 'Stop')}
      </button>

      {opError && (
        <div className="mt-3 rounded border border-[var(--status-error)] bg-[color-mix(in_srgb,var(--status-error)_10%,transparent)] p-3 min-w-0">
          <OpErrorView error={opError} />
        </div>
      )}

      {view && (
        <div className="mt-4">
          <Group name="run-setup" title={saved ? t('shell.runs.run.savedSetup', 'Saved setup') : t('shell.runs.run.defaults', 'Defaults')} defaultCollapsed>
            <table className="w-full border-collapse text-sm" data-testid="run-setup-table">
              <tbody>
                <tr className="border-b border-[var(--border-default)]">
                  <td className="py-1 pr-3 text-[var(--text-muted)]">{t('shell.runs.card.supervisor', 'Supervisor')}</td>
                  <td className="py-1 break-words text-[var(--text-primary)]">{saved?.supervisorModel ?? view.supervisor.model}</td>
                </tr>
                {view.roles.map((r) => {
                  const sv = saved?.roles?.[r.agent];
                  const modelVal = sv?.model ?? r.defaultModel;
                  const provider = sv?.provider ?? r.defaultProvider;
                  return (
                    <tr key={r.agent} className="border-b border-[var(--border-default)]">
                      <td className="py-1 pr-3 align-top text-[var(--text-muted)] break-words">{r.agent}</td>
                      <td className="py-1 break-words text-[var(--text-primary)]">
                        {modelVal}{r.providerEditable ? ` (${provider})` : ''}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-b border-[var(--border-default)]">
                  <td className="py-1 pr-3 text-[var(--text-muted)]">{t('shell.runs.card.worktree', 'Worktree')}</td>
                  <td className="py-1 text-[var(--text-primary)]">{saved?.worktree ?? view.worktree}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3 text-[var(--text-muted)]">{t('shell.runs.card.gates', 'Gates')}</td>
                  <td className="py-1 text-[var(--text-primary)]">{saved?.gates ?? view.gates}</td>
                </tr>
              </tbody>
            </table>
          </Group>
        </div>
      )}
    </div>
  );
}
