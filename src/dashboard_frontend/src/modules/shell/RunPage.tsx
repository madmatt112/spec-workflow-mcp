import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWs } from '../ws/WebSocketProvider';
import { useShell } from './ShellProvider';
import { Group, Chips, Pager, Row, ROWS_PER_PAGE, type Chip } from './primitives';
import { PageLayout, ScrollBox } from './PageLayout';
import { present } from './harness';
import { formatDate } from '../../lib/dateUtils';
import type {
  RunModel, AgentProfile, SpawnNode, SetupView,
} from '../harness/types';
import type {
  RunDetail, LedgerEvent, ActivityEvent, ControllerRun, ControllerActivity, ControllerWait, ControllerPrRead,
} from './types';

const TASK_STATUS_LABELS: Record<string, string> = {
  done: 'Done', 'in-progress': 'In progress', open: 'Open',
};

/**
 * The run page (design C10 Runs, D6, D11; Requirement 4 AC 2 to 8, 13). Holds the
 * `harness` view for the route's project only while mounted and renders, from
 * `harness-model` and `harness-run-detail`: the phase strip; each open spawn; the
 * task table (verdict and tdd from the task-review summary route polled every 5 s);
 * rounds and spawns as two collapsed tables; and tabbed Ledger, Activity and
 * Process logs, each with a filter and a follow toggle. The panel shows the run's
 * read-only properties and the setup defaults (supervisor, role models, worktree,
 * gates) as a collapsed table. A project with no ledger shows "no run for this project".
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
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { subscribe, unsubscribe, watchView } = useWs();
  const { controllerRuns, controllerActivity, controllerWaits } = useShell();

  const [model, setModel] = useState<RunModel | null>(null);
  const [profiles, setProfiles] = useState<Record<string, AgentProfile>>({});
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [summary, setSummary] = useState<TaskReviewSummary>({});
  const [view, setView] = useState<SetupView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tick, setTick] = useState(Date.now());

  const prefix = projectId ? `/api/projects/${encodeURIComponent(projectId)}` : '';

  // Hold the harness view for this project alone while mounted (design D11).
  useEffect(() => {
    if (!projectId) return;
    setModel(null); setDetail(null); setSummary({}); setLoaded(false);
    const release = watchView({ kind: 'harness', projectId });

    const onModel = (d: { model: RunModel | null; profiles: Record<string, AgentProfile> }) => {
      setModel(d.model);
      setProfiles(d.profiles || {});
      setLoaded(true);
    };
    const onDetail = (d: RunDetail | null) => setDetail(d);

    subscribe('harness-model', onModel);
    subscribe('harness-run-detail', onDetail);
    return () => {
      unsubscribe('harness-model', onModel);
      unsubscribe('harness-run-detail', onDetail);
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

  // The controller run for this project (T10): its in-flight step's "Live now".
  const ctrlRun = useMemo<ControllerRun | null>(
    () => controllerRuns.find((r) => r.project === projectId) ?? null,
    [controllerRuns, projectId],
  );
  const ctrlActivity = useMemo<ControllerActivity | null>(
    () => (ctrlRun ? controllerActivity.find((a) => a.runId === ctrlRun.id) ?? null : null),
    [controllerActivity, ctrlRun],
  );
  const ctrlWaits = useMemo<ControllerWait[]>(
    () => (ctrlRun ? controllerWaits.filter((w) => w.run === ctrlRun.id && w.state === 'open') : []),
    [controllerWaits, ctrlRun],
  );
  const [logTail, setLogTail] = useState<string>('');

  // Fetch the in-flight step's log tail on open and every 5 s while running.
  const ctrlRunId = ctrlRun?.id ?? null;
  const ctrlRunning = ctrlRun?.status === 'running';
  useEffect(() => {
    if (!ctrlRunId) { setLogTail(''); return; }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/controller/runs/${ctrlRunId}/log?tail=50`);
        if (!res.ok) return;
        const text = await res.text();
        if (alive) setLogTail(text);
      } catch { /* a missing log just shows nothing */ }
    };
    load();
    if (!ctrlRunning) return () => { alive = false; };
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [ctrlRunId, ctrlRunning]);

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
          {'← Runs'}
        </button>
        {(spec || ctrlRun?.spec) && <h1 className="min-w-0 break-words text-base font-semibold text-[var(--text-primary)]">{spec ?? ctrlRun?.spec}</h1>}
      </div>

      {ctrlRun && (
        <LiveNow
          run={ctrlRun}
          activity={ctrlActivity}
          profiles={profiles}
          waits={ctrlWaits}
          logTail={logTail}
          now={tick}
          onOpenWait={() => navigate('/')}
        />
      )}

      {ctrlRun?.prReads?.length ? <PrPanel reads={ctrlRun.prReads} /> : null}

      {loaded && !hasRun && !ctrlRun ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] p-8 text-center text-sm text-[var(--text-secondary)]" data-testid="run-empty">
          {'no run for this project'}
        </div>
      ) : (
        <>
          {detail && <PhaseStrip strip={detail.phaseStrip} />}
          <OpenSpawns spawns={openSpawns} profiles={profiles} now={tick} />
          {hasTasks && model && <TaskTable model={model} detail={detail} summary={summary} />}
          <CollapsedTables model={model} profiles={profiles} now={tick} />
          <LogTabs detail={detail} />
        </>
      )}
    </div>
  );

  const panel = (
    <RunPanel model={model} view={view} />
  );

  return <PageLayout list={list} panel={panel} />;
}

// --- Phase strip -----------------------------------------------------------

function PhaseStrip({ strip }: { strip: RunDetail['phaseStrip'] }) {
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
            <div className="text-[var(--text-muted)]">{p.version ?? '—'}</div>
            <div className="text-[var(--text-muted)]">{'Rounds'}: {p.rounds}</div>
            {p.approvedOn && <div className="text-[var(--text-muted)]">{formatDate(p.approvedOn)}</div>}
          </div>
        ))}
      </div>
    </ScrollBox>
  );
}

// --- Live now (controller run) ---------------------------------------------

const CTRL_LIVE_STATUSES = ['queued', 'running', 'merging', 'paused', 'waiting'];

const CTRL_WAIT_LABELS: Record<string, string> = {
  'gate-a': 'Gate A', 'gate-b': 'Gate B', 'retro-plan': 'Retro plan',
  merge: 'Merge', escalation: 'Escalation', error: 'Error', question: 'Question',
};

/**
 * "Live now" for a controller run (design C10 Runs; controller-tasks.md T10):
 * the in-flight step's role, model, elapsed and current tool from the
 * `controller-activity` feed, plus the step log tail. Open gate and wait rows
 * link to the Now page sheet where they are answered.
 */
function LiveNow({ run, activity, profiles, waits, logTail, now, onOpenWait }: {
  run: ControllerRun;
  activity: ControllerActivity | null;
  profiles: Record<string, AgentProfile>;
  waits: ControllerWait[];
  logTail: string;
  now: number;
  onOpenWait: () => void;
}) {
  const live = CTRL_LIVE_STATUSES.includes(run.status);
  const role = activity?.role ?? null;
  const profile = role ? profiles[role] : undefined;
  const elapsed = activity?.ts ? fmtDuration(now - Date.parse(activity.ts)) : null;
  const logLines = logTail ? logTail.split('\n') : [];

  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-3" data-testid="live-now">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">{'Live now'}</span>
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          live
            ? 'bg-[color-mix(in_srgb,var(--interactive-primary)_15%,transparent)] text-[var(--interactive-primary)]'
            : 'bg-[var(--surface-inset)] text-[var(--text-muted)]'
        }`}>
          {run.status}
        </span>
        {run.phase && <span className="text-xs text-[var(--text-secondary)]">{run.phase}</span>}
      </div>

      {activity ? (
        <div className="text-xs text-[var(--text-secondary)] break-words" data-testid="live-now-step">
          <span className="font-medium text-[var(--text-primary)]">{profile?.role ?? role}</span>
          {present(role) && <span className="ml-1 text-[var(--text-muted)]">{role}</span>}
          {present(profile?.model) && <> · {'model'}: {profile!.model}</>}
          {present(elapsed) && <> · {'elapsed'}: {elapsed}</>}
          {present(activity.tool) && <> · {'tool'}: {activity.tool}</>}
          {present(activity.inputSummary) && (
            <span className="ml-1 text-[var(--text-muted)]">{activity.inputSummary}</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--text-muted)]" data-testid="live-now-idle">
          {live ? 'Waiting for the next step to report a tool.' : 'This run is not active.'}
        </p>
      )}

      {waits.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="live-now-waits">
          {waits.map((w) => (
            <Row key={w.id} testId={`live-now-wait-${w.id}`} onClick={onOpenWait}>
              <span className="inline-flex shrink-0 items-center rounded-full bg-[color-mix(in_srgb,#f59e0b_18%,transparent)] px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                {CTRL_WAIT_LABELS[w.kind] ?? w.kind}
              </span>
              <span className="min-w-0 flex-1 truncate text-[var(--text-secondary)]">{'Answer on the Now page'}</span>
            </Row>
          ))}
        </div>
      )}

      <div className="mt-2">
        <div className="mb-1 text-xs text-[var(--text-muted)]">{'Step log'}</div>
        {logLines.length === 0 ? (
          <p className="px-2 py-1 text-xs text-[var(--text-muted)]">{'No log yet.'}</p>
        ) : (
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--border-default)] bg-[var(--surface-inset)] p-2 text-xs text-[var(--text-secondary)]" data-testid="live-now-log">
            {logLines.slice(-50).join('\n')}
          </pre>
        )}
      </div>
    </div>
  );
}

// --- PR panel (controller run) ---------------------------------------------

// green/pending/red/unreadable -> the four status tokens (design C4). The full
// class strings are literal so the Tailwind build keeps them.
const CI_CHIP_STYLES: Record<ControllerPrRead['ci'], string> = {
  green: 'bg-[color-mix(in_srgb,var(--status-success)_15%,transparent)] text-[var(--status-success)]',
  pending: 'bg-[color-mix(in_srgb,var(--status-warning)_15%,transparent)] text-[var(--status-warning)]',
  red: 'bg-[color-mix(in_srgb,var(--status-error)_15%,transparent)] text-[var(--status-error)]',
  unreadable: 'bg-[color-mix(in_srgb,var(--status-pending)_15%,transparent)] text-[var(--status-pending)]',
};

/**
 * PR panel for a controller run (design C4; R1 AC7, AC8, AC10, AC11): one row per
 * PR read the merge rule saved on the run record, so the operator sees why a run in
 * `merging` has not merged. It makes no fetch and calls no GitHub route — it shows
 * only what the rule read.
 */
function PrPanel({ reads }: { reads: ControllerPrRead[] }) {
  const dash = '—';
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-3" data-testid="pr-panel">
      <div className="mb-2 text-sm font-medium text-[var(--text-primary)]">{'Pull requests'}</div>
      <div className="space-y-2">
        {reads.map((read) => {
          const isLink = typeof read.url === 'string' && read.url.startsWith('https://');
          return (
            <div
              key={`${read.repo}-${read.number}`}
              className="rounded border border-[var(--border-default)] p-2 text-sm min-w-0"
              data-testid={`pr-row-${read.repo}-${read.number}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--text-primary)] break-words">{read.repo}</span>
                {isLink ? (
                  <a href={read.url} target="_blank" rel="noreferrer" className="text-[var(--interactive-primary)] hover:underline">
                    {`#${read.number}`}
                  </a>
                ) : (
                  <span className="text-[var(--text-secondary)]">{`#${read.number}`}</span>
                )}
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CI_CHIP_STYLES[read.ci]}`}
                  data-testid={`pr-ci-${read.repo}-${read.number}`}
                >
                  {read.ci}
                </span>
                <span className="text-xs text-[var(--text-muted)]">{read.mergeable ?? dash}</span>
              </div>
              <div className="mt-0.5 text-xs text-[var(--text-secondary)] break-words">
                {read.verdict}
                {read.verdict === 'merged' && present(read.sha) && <> {read.sha!.slice(0, 7)}</>}
              </div>
              {read.reasons.length > 0 && (
                <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                  {read.reasons.map((reason, i) => (
                    <div key={i} className="break-words">{reason}</div>
                  ))}
                </div>
              )}
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">{formatDate(read.at, { includeSeconds: true })}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Open spawns -----------------------------------------------------------

function OpenSpawns({ spawns, profiles, now }: { spawns: SpawnNode[]; profiles: Record<string, AgentProfile>; now: number }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-sm font-medium text-[var(--text-primary)]">{'Open spawns'}</div>
      {spawns.length === 0 ? (
        <p className="px-2 py-1 text-sm text-[var(--text-muted)]">{'No open spawns.'}</p>
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
                      {fmtDuration(idleMs)}{stale ? ` ${'idle >15m'}` : ''}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-[var(--text-secondary)] break-words">
                  {present(declared) && <>{'declared'}: {declared} · </>}
                  {present(s.model) && <>{'actual'}: {s.model} · </>}
                  {'elapsed'}: {elapsed}
                  {present(s.lastTool) && <> · {'last tool'}: {s.lastTool}</>}
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
  const chips: Chip[] = TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] ?? s, count: counts[s] }));
  const toggle = (v: string) => setActive((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  const dash = '—';

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-sm font-medium text-[var(--text-primary)]">{'Tasks'}</div>
        <Chips chips={chips} active={active} onToggle={toggle} />
      </div>
      <ScrollBox>
        <table className="w-full border-collapse text-sm" data-testid="task-table">
          <thead>
            <tr className="text-left text-xs text-[var(--text-muted)]">
              <th className="py-1 pr-3 font-medium">{'ID'}</th>
              <th className="py-1 pr-3 font-medium">{'Title'}</th>
              <th className="py-1 pr-3 font-medium">{'Status'}</th>
              <th className="py-1 pr-3 font-medium">{'Verdict'}</th>
              <th className="py-1 pr-3 font-medium">{'TDD'}</th>
              <th className="py-1 pr-3 font-medium">{'Risk'}</th>
              <th className="py-1 font-medium">{'Fix rounds'}</th>
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
  if (!model) return null;
  const dash = '—';
  return (
    <div className="min-w-0">
      <Group name="run-rounds" title={'Rounds'} count={model.rounds.length} defaultCollapsed>
        {model.rounds.length === 0 ? (
          <p className="px-2 py-1 text-sm text-[var(--text-muted)]">{'No rounds.'}</p>
        ) : (
          <ScrollBox>
            <table className="w-full border-collapse text-sm" data-testid="rounds-table">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)]">
                  <th className="py-1 pr-3 font-medium">{'Phase'}</th>
                  <th className="py-1 pr-3 font-medium">{'Round'}</th>
                  <th className="py-1 pr-3 font-medium">{'Verdict'}</th>
                  <th className="py-1 font-medium">{'Version'}</th>
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

      <Group name="run-spawns" title={'Spawns'} count={model.spawns.length} defaultCollapsed>
        {model.spawns.length === 0 ? (
          <p className="px-2 py-1 text-sm text-[var(--text-muted)]">{'No spawns.'}</p>
        ) : (
          <ScrollBox>
            <table className="w-full border-collapse text-sm" data-testid="spawns-table">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)]">
                  <th className="py-1 pr-3 font-medium">{'Role'}</th>
                  <th className="py-1 pr-3 font-medium">{'Declared'}</th>
                  <th className="py-1 pr-3 font-medium">{'Actual'}</th>
                  <th className="py-1 pr-3 font-medium">{'Tokens'}</th>
                  <th className="py-1 font-medium">{'Elapsed'}</th>
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

function LogTabs({ detail }: { detail: RunDetail | null }) {
  const [tab, setTab] = useState<'ledger' | 'activity'>('ledger');

  const lines = useMemo(() => {
    if (tab === 'ledger') return (detail?.ledgerRows ?? []).map(ledgerLine);
    return (detail?.activityRows ?? []).map(activityLine);
  }, [tab, detail]);

  const tabs: { id: typeof tab; label: string }[] = [
    { id: 'ledger', label: 'Ledger' },
    { id: 'activity', label: 'Activity' },
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
          placeholder={'Filter'}
          data-testid="log-filter"
          className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-1 text-sm text-[var(--text-primary)]"
        />
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} data-testid="log-follow" />
          {'Follow'}
        </label>
      </div>
      {shown.length === 0 ? (
        <p className="px-2 py-1 text-sm text-[var(--text-muted)]">{'No rows.'}</p>
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

function RunPanel({ model, view }: { model: RunModel | null; view: SetupView | null }) {
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4" data-testid="run-panel">
      <div className="space-y-1">
        <PanelField label={'Run id'} value={model?.runId ?? undefined} />
        <PanelField label={'Start'} value={model?.runStartedAt ? formatDate(model.runStartedAt) : undefined} />
        <PanelField label={'Code root'} value={model?.codeRoot} />
        <PanelField label={'Worktree'} value={model?.worktree} />
        <PanelField label={'Headless'} value={model?.headless} />
        <PanelField label={'Providers'} value={model?.providers} />
        <PanelField label={'Tokens'} value={typeof model?.tokensTotal === 'number' ? model.tokensTotal.toLocaleString() : undefined} />
      </div>

      {view && (
        <div className="mt-4">
          <Group name="run-setup" title={'Defaults'} defaultCollapsed>
            <table className="w-full border-collapse text-sm" data-testid="run-setup-table">
              <tbody>
                <tr className="border-b border-[var(--border-default)]">
                  <td className="py-1 pr-3 text-[var(--text-muted)]">{'Supervisor'}</td>
                  <td className="py-1 break-words text-[var(--text-primary)]">{view.supervisor.model}</td>
                </tr>
                {view.roles.map((r) => {
                  const modelVal = r.defaultModel;
                  const provider = r.defaultProvider;
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
                  <td className="py-1 pr-3 text-[var(--text-muted)]">{'Worktree'}</td>
                  <td className="py-1 text-[var(--text-primary)]">{view.worktree}</td>
                </tr>
                <tr>
                  <td className="py-1 pr-3 text-[var(--text-muted)]">{'Gates'}</td>
                  <td className="py-1 text-[var(--text-primary)]">{view.gates}</td>
                </tr>
              </tbody>
            </table>
          </Group>
        </div>
      )}
    </div>
  );
}
