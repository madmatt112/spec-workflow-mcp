import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useProjects, type Project } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { PageLayout } from './PageLayout';
import { Group, Row } from './primitives';
import {
  callHarness, buildLaunchInput, OpErrorView, type OpError,
} from './harness';
import type { RunListRow, NowModel } from './types';
import type { SetupView, SetupInput, Provider } from '../harness/types';

/**
 * The Runs list and Launch card (design C10 Runs and Launch card, D8;
 * Requirement 4 AC 1, 9 to 12). `/runs` lists `NowModel.runs` of enabled
 * projects in Live and Ended groups; selecting a row opens that project's run
 * page. The Launch chip opens one card per enabled project — the launchable
 * spec, the saved setup in five summary lines, Launch and Edit setup — with no
 * new launch behaviour: Launch posts `buildLaunchInput` to the existing launch
 * route, and Edit setup saves through the existing PUT setup route.
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enabled, projects } = useProjects();
  const { now } = useShell();

  const [launchOpen, setLaunchOpen] = useState(false);
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const runs = useMemo(() => (now?.runs ?? []).filter((r) => enabled(r.projectId)), [now, enabled]);
  const live = useMemo(() => runs.filter((r) => r.state === 'live'), [runs]);
  const ended = useMemo(() => runs.filter((r) => r.state !== 'live'), [runs]);
  const enabledProjects = useMemo(() => projects.filter((p) => enabled(p.projectId)), [projects, enabled]);

  const open = (projectId: string) => navigate(`/runs/${projectId}`);

  const list = (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold text-[var(--text-primary)]">{t('shell.runs.title', 'Runs')}</h1>
        <button
          type="button"
          onClick={() => setLaunchOpen((v) => !v)}
          aria-pressed={launchOpen}
          data-testid="launch-chip"
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            launchOpen
              ? 'border-transparent bg-[var(--interactive-primary)] text-white'
              : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          {t('shell.runs.launch', 'Launch')}
        </button>
      </div>

      {launchOpen && (
        <div className="mb-4 space-y-3" data-testid="launch-cards">
          {enabledProjects.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-[var(--text-muted)]">{t('shell.runs.noProjects', 'No projects.')}</p>
          ) : (
            enabledProjects.map((p) => <LaunchCard key={p.projectId} project={p} now={now} />)
          )}
        </div>
      )}

      <Group name="runs-live" title={t('shell.runs.group.live', 'Live')} count={live.length}>
        <RunRows rows={live} now={tick} onOpen={open} empty={t('shell.runs.empty.live', 'No live runs.')} />
      </Group>

      <Group name="runs-ended" title={t('shell.runs.group.ended', 'Ended')} count={ended.length}>
        <RunRows rows={ended} now={tick} onOpen={open} empty={t('shell.runs.empty.ended', 'No ended runs.')} />
      </Group>
    </div>
  );

  return <PageLayout list={list} />;
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
  const { t } = useTranslation();
  const [view, setView] = useState<SetupView | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
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
  const launchState = now?.launches?.[project.projectId]?.state;
  const launching = launchState === 'running' || launchState === 'stopping';

  // The disable reason, in the order of design D8 / Requirement 4 AC 12.
  let disabledReason: string | null = null;
  if (view && !launchable) disabledReason = view.disabledReason ?? t('shell.runs.card.noLaunchable', 'No launchable spec.');
  else if (liveRun) disabledReason = t('shell.runs.card.disabledLive', 'A run is live for this project.');
  else if (launching) disabledReason = t('shell.runs.card.disabledLaunching', 'A launch is in progress.');

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

  const onSaved = useCallback(async () => {
    setEditing(false);
    await fetchSetup();
  }, [fetchSetup]);

  return (
    <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 min-w-0" data-testid={`launch-card-${project.projectId}`}>
      <div className="mb-2 flex items-center gap-2">
        <h2 className="min-w-0 flex-1 break-words text-sm font-semibold text-[var(--text-primary)]">{project.projectName}</h2>
      </div>

      {loadError ? (
        <p className="text-sm text-[var(--status-error)]">{t('shell.runs.card.loadError', 'Could not load setup.')}</p>
      ) : !view ? (
        <p className="text-sm text-[var(--text-muted)]">{t('shell.runs.none', '—')}</p>
      ) : (
        <>
          <div className="space-y-1">
            <SummaryLine label={t('shell.runs.card.spec', 'Spec')} value={view.launchable ?? t('shell.runs.none', '—')} />
            <SummaryLine label={t('shell.runs.card.supervisor', 'Supervisor')} value={input?.supervisorModel ?? view.supervisor.model} />
            <SummaryLine label={t('shell.runs.card.roles', 'Roles')} value={input ? Object.keys(input.roles).length : view.roles.length} />
            <SummaryLine label={t('shell.runs.card.worktree', 'Worktree')} value={input?.worktree ?? view.worktree} />
            <SummaryLine label={t('shell.runs.card.gates', 'Gates')} value={input?.gates ?? view.gates} />
          </div>

          {disabledReason && (
            <p className="mt-2 rounded border border-[var(--border-default)] bg-[var(--surface-inset)] p-2 text-xs text-[var(--text-secondary)] break-words" data-testid={`launch-disabled-${project.projectId}`}>
              {disabledReason}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={doLaunch}
              disabled={!!disabledReason || busy}
              data-testid={`launch-button-${project.projectId}`}
              className="rounded-md bg-[var(--interactive-primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? t('shell.runs.card.launching', 'Launching…') : t('shell.runs.card.launch', 'Launch')}
            </button>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              disabled={!launchable}
              data-testid={`edit-setup-${project.projectId}`}
              className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
            >
              {t('shell.runs.card.edit', 'Edit setup')}
            </button>
          </div>

          {opError && (
            <div className="mt-3 rounded border border-[var(--status-error)] bg-[color-mix(in_srgb,var(--status-error)_10%,transparent)] p-3 min-w-0">
              <div className="mb-1 text-sm font-semibold text-[var(--status-error)]">{t('shell.runs.err.heading', 'The run was refused')}</div>
              <OpErrorView error={opError} />
            </div>
          )}

          {editing && launchable && (
            <EditSetup view={view} prefix={prefix} onSaved={onSaved} />
          )}
        </>
      )}
    </section>
  );
}

// --- Edit setup table ------------------------------------------------------

type RoleValue = { model: string; provider: Provider };

function EditSetup({ view, prefix, onSaved }: {
  view: SetupView;
  prefix: string;
  onSaved: () => Promise<void> | void;
}) {
  const { t } = useTranslation();
  const saved = view.saved;
  const [supervisorModel, setSupervisorModel] = useState(saved?.supervisorModel ?? view.supervisor.model);
  const [worktree, setWorktree] = useState<'yes' | 'no'>(saved?.worktree ?? view.worktree);
  const [gates, setGates] = useState<'block' | 'record'>(saved?.gates ?? view.gates);
  const [roleValues, setRoleValues] = useState<Record<string, RoleValue>>(() => {
    const rv: Record<string, RoleValue> = {};
    for (const r of view.roles) {
      const sv = saved?.roles?.[r.agent];
      rv[r.agent] = { model: sv?.model ?? r.defaultModel, provider: sv?.provider ?? r.defaultProvider };
    }
    return rv;
  });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<OpError | null>(null);

  const setModel = (agent: string, model: string) =>
    setRoleValues((prev) => ({ ...prev, [agent]: { ...prev[agent], model } }));
  const setProvider = (agent: string, provider: Provider) =>
    setRoleValues((prev) => ({ ...prev, [agent]: { ...prev[agent], provider } }));

  const buildInput = (): SetupInput => {
    const roles: Record<string, { model: string; provider?: Provider }> = {};
    for (const r of view.roles) {
      const val = roleValues[r.agent];
      roles[r.agent] = r.providerEditable ? { model: val.model, provider: val.provider } : { model: val.model };
    }
    return { spec: view.launchable as string, supervisorModel, worktree, gates, roles };
  };

  const save = useCallback(async () => {
    setBusy(true);
    setSaveError(null);
    const res = await callHarness(`${prefix}/harness/setup`, 'PUT', buildInput());
    setBusy(false);
    if (!res.ok) { setSaveError({ status: res.status, body: res.data }); return; }
    await onSaved();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefix, supervisorModel, worktree, gates, roleValues, onSaved]);

  const inputCls = 'w-full rounded border border-[var(--border-default)] bg-[var(--surface-base)] px-2 py-1 text-sm text-[var(--text-primary)]';

  return (
    <div className="mt-3 border-t border-[var(--border-default)] pt-3" data-testid="edit-setup-table">
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr className="border-b border-[var(--border-default)]">
            <td className="py-1 pr-3 align-top text-[var(--text-muted)]">{t('shell.runs.card.supervisor', 'Supervisor')}</td>
            <td className="py-1" colSpan={2}>
              <input type="text" value={supervisorModel} onChange={(e) => setSupervisorModel(e.target.value)} className={inputCls} />
            </td>
          </tr>
          {view.roles.map((r) => (
            <tr key={r.agent} className="border-b border-[var(--border-default)]">
              <td className="py-1 pr-3 align-top text-[var(--text-muted)] break-words">{r.agent}</td>
              <td className="py-1 pr-2">
                <input
                  type="text"
                  value={roleValues[r.agent]?.model ?? ''}
                  onChange={(e) => setModel(r.agent, e.target.value)}
                  aria-label={t('shell.runs.card.model', 'Model')}
                  className={inputCls}
                />
              </td>
              <td className="py-1">
                {r.providerEditable ? (
                  <select
                    value={roleValues[r.agent]?.provider ?? r.defaultProvider}
                    onChange={(e) => setProvider(r.agent, e.target.value as Provider)}
                    aria-label={t('shell.runs.card.provider', 'Provider')}
                    className={inputCls}
                  >
                    <option value="anthropic">{t('shell.runs.provider.anthropic', 'Anthropic')}</option>
                    <option value="deepseek">{t('shell.runs.provider.deepseek', 'DeepSeek')}</option>
                  </select>
                ) : null}
              </td>
            </tr>
          ))}
          <tr className="border-b border-[var(--border-default)]">
            <td className="py-1 pr-3 text-[var(--text-muted)]">{t('shell.runs.card.worktree', 'Worktree')}</td>
            <td className="py-1" colSpan={2}>
              <select value={worktree} onChange={(e) => setWorktree(e.target.value as 'yes' | 'no')} className={inputCls}>
                <option value="yes">{t('shell.runs.card.worktree_yes', 'yes')}</option>
                <option value="no">{t('shell.runs.card.worktree_no', 'no')}</option>
              </select>
            </td>
          </tr>
          <tr>
            <td className="py-1 pr-3 text-[var(--text-muted)]">{t('shell.runs.card.gates', 'Gates')}</td>
            <td className="py-1" colSpan={2}>
              <select value={gates} onChange={(e) => setGates(e.target.value as 'block' | 'record')} className={inputCls}>
                <option value="block">{t('shell.runs.card.gates_block', 'block')}</option>
                <option value="record">{t('shell.runs.card.gates_record', 'record')}</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          data-testid="save-setup"
          className="rounded-md border border-[var(--border-default)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
        >
          {busy ? t('shell.runs.card.saving', 'Saving…') : t('shell.runs.card.save', 'Save setup')}
        </button>
      </div>

      {saveError && (
        <div className="mt-3 rounded border border-[var(--status-error)] bg-[color-mix(in_srgb,var(--status-error)_10%,transparent)] p-3 min-w-0">
          <div className="mb-1 text-sm font-semibold text-[var(--status-error)]">{t('shell.runs.err.heading', 'The run was refused')}</div>
          <OpErrorView error={saveError} />
        </div>
      )}
    </div>
  );
}
