import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects, type Project } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { PageLayout } from './PageLayout';
import { Group, Row } from './primitives';
import {
  callHarness, buildLaunchInput, OpErrorView, type OpError,
} from './harness';
import type { RunListRow, NowModel, ControllerRun } from './types';
import { pauseNote, pauseNoteClass } from './pause';
import type { SetupView } from '../harness/types';
import { Button, Pill, type Tone } from '../ui/ui';

/**
 * The Runs list and Launch card (design C10 Runs and Launch card, D8;
 * Requirement 4 AC 1, 9 to 12). `/runs` lists `NowModel.runs` of enabled
 * projects in Live and Ended groups; selecting a row opens that project's run
 * page. The Launch chip opens one card per enabled project — the launchable
 * spec, the setup defaults in five summary lines and Launch — with no new launch
 * behaviour: Launch posts `buildLaunchInput` to the existing launch route. The
 * setup editor and its PUT route went with step (d) of the foundation rework.
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

function StateBadge({ state }: { state: RunListRow['state'] }) {
  const live = state === 'live';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
        live
          ? 'bg-[color-mix(in_srgb,var(--interactive-primary)_15%,transparent)] text-[var(--interactive-primary)]'
          : 'bg-[var(--surface-inset)] text-[var(--text-muted)]'
      }`}
    >
      {state}
    </span>
  );
}

function RunRows({ rows, now, onOpen, empty }: {
  rows: RunListRow[];
  now: number;
  onOpen: (projectId: string) => void;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{empty}</p>;
  }
  return (
    <>
      {rows.map((r) => (
        <Row key={`${r.projectId}:${r.runId ?? r.spec}`} testId={`run-row-${r.projectId}`} onClick={() => onOpen(r.projectId)}>
          <span className="shrink-0 text-xs text-[var(--text-muted)]">{r.projectName}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{r.spec}</span>
          {r.runId && <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">{r.runId}</span>}
          <StateBadge state={r.state} />
          {r.phase && <span className="shrink-0 text-xs text-[var(--text-secondary)]">{r.phase}</span>}
          <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{fmtAge(r.since, now) ?? ''}</span>
        </Row>
      ))}
    </>
  );
}

export function RunsPage() {
  const navigate = useNavigate();
  const { enabled, projects } = useProjects();
  const { now, controllerRuns } = useShell();

  const [launchOpen, setLaunchOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const runs = useMemo(() => (now?.runs ?? []).filter((r) => enabled(r.projectId)), [now, enabled]);
  const live = useMemo(() => runs.filter((r) => r.state === 'live'), [runs]);
  const ended = useMemo(() => runs.filter((r) => r.state !== 'live'), [runs]);
  const enabledProjects = useMemo(() => projects.filter((p) => enabled(p.projectId)), [projects, enabled]);

  const ctrlRuns = useMemo(
    () => controllerRuns.filter((r) => enabled(r.project)),
    [controllerRuns, enabled],
  );
  const projectName = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.projectId, p.projectName]));
    return (id: string) => byId.get(id) ?? id;
  }, [projects]);

  // Re-derive the selected run each push so the panel refreshes and drops a run
  // that finished or was discarded.
  const selectedRun = useMemo<ControllerRun | null>(
    () => ctrlRuns.find((r) => r.id === selectedRunId) ?? null,
    [ctrlRuns, selectedRunId],
  );

  const open = (projectId: string) => navigate(`/runs/${projectId}`);

  const list = (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-[var(--text-primary)]">{'Runs'}</h1>
        <Button
          variant={launchOpen ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setLaunchOpen((v) => !v)}
          aria-pressed={launchOpen}
          data-testid="launch-chip"
        >
          {'Launch'}
        </Button>
      </div>

      {launchOpen && (
        <div className="mb-4 space-y-3" data-testid="launch-cards">
          {enabledProjects.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'No projects.'}</p>
          ) : (
            enabledProjects.map((p) => <LaunchCard key={p.projectId} project={p} now={now} />)
          )}
        </div>
      )}

      <Group name="runs-controller" title={'Queue and controller runs'} count={ctrlRuns.length}>
        {ctrlRuns.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{'No controller runs.'}</p>
        ) : (
          ctrlRuns.map((r) => (
            <ControllerRunRow
              key={r.id}
              run={r}
              projectName={projectName(r.project)}
              now={tick}
              selected={selectedRunId === r.id}
              onClick={() => setSelectedRunId(r.id)}
            />
          ))
        )}
      </Group>

      <Group name="runs-live" title={'Live'} count={live.length}>
        <RunRows rows={live} now={tick} onOpen={open} empty={'No live runs.'} />
      </Group>

      <Group name="runs-ended" title={'Ended'} count={ended.length}>
        <RunRows rows={ended} now={tick} onOpen={open} empty={'No ended runs.'} />
      </Group>
    </div>
  );

  const panel = selectedRun ? (
    <ControllerRunPanel
      key={selectedRun.id}
      run={selectedRun}
      projectName={projectName(selectedRun.project)}
      now={tick}
      onOpenRun={() => navigate(`/runs/${selectedRun.project}`)}
      onGone={() => setSelectedRunId(null)}
    />
  ) : undefined;

  return <PageLayout list={list} panel={panel} />;
}

// --- Controller runs -------------------------------------------------------

const CTRL_STATUS_TONE: Record<string, Tone> = {
  running: 'accent',
  merging: 'accent',
  queued: 'neutral',
  paused: 'warning',
  waiting: 'warning',
  error: 'danger',
  done: 'neutral',
  abandoned: 'neutral',
};

function CtrlStatusChip({ status }: { status: ControllerRun['status'] }) {
  return (
    <Pill tone={CTRL_STATUS_TONE[status] ?? CTRL_STATUS_TONE.queued}>
      {status}
    </Pill>
  );
}

/** The step cursor as one line: the step kind, or '—' before a step runs. */
function cursorLine(run: ControllerRun): string {
  return run.stepKind ? run.stepKind : '—';
}

function ControllerRunRow({ run, projectName, now, selected, onClick }: {
  run: ControllerRun;
  projectName: string;
  now: number;
  selected: boolean;
  onClick: () => void;
}) {
  const pause = pauseNote(run, now);
  return (
    <Row testId={`ctrl-run-row-${run.id}`} selected={selected} onClick={onClick}>
      <span className="shrink-0 text-xs text-[var(--text-muted)]">{projectName}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{run.spec}</span>
      <CtrlStatusChip status={run.status} />
      {run.phase && <span className="shrink-0 text-xs text-[var(--text-secondary)]">{run.phase}</span>}
      <span className="shrink-0 text-xs text-[var(--text-muted)]">{cursorLine(run)}</span>
      {pause && (
        <span className={`shrink-0 text-xs ${pauseNoteClass(pause)}`} data-testid={`ctrl-run-pause-${run.id}`}>
          {pause.text}
        </span>
      )}
      <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{run.tokens.toLocaleString()} tok</span>
      <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{fmtAge(run.created, now) ?? ''}</span>
    </Row>
  );
}

function ControllerRunPanel({ run, projectName, now, onOpenRun, onGone }: {
  run: ControllerRun;
  projectName: string;
  now: number;
  onOpenRun: () => void;
  onGone: () => void;
}) {
  const pause = pauseNote(run, now);
  const [busy, setBusy] = useState<null | 'cancel' | 'discard'>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (kind: 'cancel' | 'discard') => {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/controller/runs/${run.id}/${kind}`, { method: 'POST' });
      if (!res.ok) throw new Error(`${kind} failed (${res.status})`);
      onGone();
    } catch (e: any) {
      setError(e?.message ?? `${kind} failed`);
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4" data-testid="ctrl-run-panel">
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <CtrlStatusChip status={run.status} />
          <span className="text-xs text-[var(--text-muted)]">{projectName}</span>
        </div>
        <h2 className="mt-1 break-words text-base font-semibold text-[var(--text-primary)]">{run.spec}</h2>
      </div>

      <div className="space-y-1 border-t border-[var(--border-default)] pt-3">
        <SummaryLine label={'Run id'} value={<span className="font-mono text-xs">{run.id}</span>} />
        {run.phase && <SummaryLine label={'Phase'} value={run.phase} />}
        <SummaryLine label={'Step'} value={cursorLine(run)} />
        {pause && <SummaryLine label={'Paused'} value={<span className={pauseNoteClass(pause)}>{pause.text}</span>} />}
        <SummaryLine label={'Tokens'} value={`${run.tokens.toLocaleString()} tok`} />
        <SummaryLine label={'Age'} value={fmtAge(run.created, now) ?? '—'} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onOpenRun} data-testid="ctrl-open-run">
          {'Open run page'}
        </Button>
        <Button variant="secondary" onClick={() => act('cancel')} disabled={busy !== null} data-testid="ctrl-cancel">
          {busy === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </Button>
        {confirmDiscard ? (
          <Button variant="danger" onClick={() => act('discard')} disabled={busy !== null} data-testid="ctrl-discard-confirm">
            {busy === 'discard' ? 'Discarding…' : 'This deletes the worktree and branch and closes the PR'}
          </Button>
        ) : (
          <Button variant="danger" onClick={() => setConfirmDiscard(true)} disabled={busy !== null} data-testid="ctrl-discard">
            {'Discard'}
          </Button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-[var(--status-error)]">{error}</p>}
    </div>
  );
}

// --- Launch card -----------------------------------------------------------

function SummaryLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="shrink-0 text-[var(--text-muted)]">{label}</span>
      <span className="min-w-0 break-words text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function LaunchCard({ project, now }: { project: Project; now: NowModel | null }) {
  const [view, setView] = useState<SetupView | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<OpError | null>(null);

  const prefix = `/api/projects/${encodeURIComponent(project.projectId)}`;

  const fetchSetup = useCallback(async () => {
    try {
      const res = await fetch(`${prefix}/harness/setup`);
      if (!res.ok) throw new Error(`setup ${res.status}`);
      setView(await res.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [prefix]);

  useEffect(() => { fetchSetup(); }, [fetchSetup]);

  const launchable = !!view?.launchable;
  const liveRun = (now?.live ?? []).some((r) => r.projectId === project.projectId);

  // The disable reason, in the order of design D8 / Requirement 4 AC 12.
  let disabledReason: string | null = null;
  if (view && !launchable) disabledReason = view.disabledReason ?? 'No launchable spec.';
  else if (liveRun) disabledReason = 'A run is live for this project.';

  const input = view && launchable ? buildLaunchInput(view) : null;

  const doLaunch = useCallback(async () => {
    if (!view || !view.launchable) return;
    setBusy(true);
    setOpError(null);
    const res = await callHarness(`${prefix}/harness/launch`, 'POST', buildLaunchInput(view));
    setBusy(false);
    if (!res.ok) setOpError({ status: res.status, body: res.data });
    await fetchSetup();
  }, [view, prefix, fetchSetup]);

  return (
    <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 min-w-0" data-testid={`launch-card-${project.projectId}`}>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 break-words text-sm font-semibold text-[var(--text-primary)]">{project.projectName}</h2>
      </div>

      {loadError ? (
        <p className="text-sm text-[var(--status-error)]">{'Could not load setup.'}</p>
      ) : !view ? (
        <p className="text-sm text-[var(--text-muted)]">{'—'}</p>
      ) : (
        <>
          <div className="space-y-1">
            <SummaryLine label={'Spec'} value={view.launchable ?? '—'} />
            <SummaryLine label={'Supervisor'} value={input?.supervisorModel ?? view.supervisor.model} />
            <SummaryLine label={'Roles'} value={input ? Object.keys(input.roles).length : view.roles.length} />
            <SummaryLine label={'Worktree'} value={input?.worktree ?? view.worktree} />
            <SummaryLine label={'Gates'} value={input?.gates ?? view.gates} />
          </div>

          {disabledReason && (
            <p className="mt-2 rounded-sm border border-[var(--border-default)] bg-[var(--surface-inset)] p-2 text-xs text-[var(--text-secondary)] break-words" data-testid={`launch-disabled-${project.projectId}`}>
              {disabledReason}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={doLaunch}
              disabled={!!disabledReason || busy}
              data-testid={`launch-button-${project.projectId}`}
            >
              {busy ? 'Launching…' : 'Launch'}
            </Button>
          </div>

          {opError && (
            <div className="mt-3 rounded-sm border border-[var(--status-error)] bg-[color-mix(in_srgb,var(--status-error)_10%,transparent)] p-3 min-w-0">
              <div className="mb-1 text-sm font-semibold text-[var(--status-error)]">{'The run was refused'}</div>
              <OpErrorView error={opError} />
            </div>
          )}
        </>
      )}
    </section>
  );
}
