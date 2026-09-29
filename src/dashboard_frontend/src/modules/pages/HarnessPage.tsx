import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiData } from '../api/api';
import { useWs } from '../ws/WebSocketProvider';
import type {
  SetupView, SetupInput, Provider, RoleRow, LaunchRecord,
  RunModel, AgentProfile, SpawnNode,
} from '../harness/types';

// The harness routes are called with fetch directly rather than the shared PUT
// helper (src/dashboard_frontend/src/modules/api/api.tsx:139-142), because that
// helper drops a non-ok body and this page must show the 400, 409 or 500 body
// (design D8; Req 3.14).
type HarnessResult = { ok: boolean; status: number; data: any };

async function callHarness(url: string, method: 'PUT' | 'POST', body?: any): Promise<HarnessResult> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

type RoleValue = { model: string; provider: Provider };
type GateSections = { gateA: string | null; gateB: string | null };
type TaskReviewSummary = Record<string, { verdict: string; version: number; tdd?: any }>;
type OpError = { status: number; body: any };

/** True for a value the live view should render; absent fields are omitted (Req 4.6). */
function present(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-4 min-w-0">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!present(value)) return null;
  return (
    <div className="min-w-0">
      <span className="text-xs text-[var(--text-muted)]">{label}: </span>
      <span className="text-sm text-[var(--text-primary)] break-words">{String(value)}</span>
    </div>
  );
}

export function HarnessPage() {
  const { t } = useTranslation();
  const { projectId } = useApiData();
  const { subscribe, unsubscribe, watchView } = useWs();

  const [view, setView] = useState<SetupView | null>(null);
  const [viewError, setViewError] = useState('');

  // Live state from the websocket pushes.
  const [model, setModel] = useState<RunModel | null>(null);
  const [profiles, setProfiles] = useState<Record<string, AgentProfile>>({});
  const [launch, setLaunch] = useState<LaunchRecord | null>(null);
  const [gateSections, setGateSections] = useState<GateSections>({ gateA: null, gateB: null });
  const [logLines, setLogLines] = useState<string[]>([]);
  const [summary, setSummary] = useState<TaskReviewSummary>({});

  // Form state.
  const [supervisorModel, setSupervisorModel] = useState('');
  const [worktree, setWorktree] = useState<'yes' | 'no'>('no');
  const [gates, setGates] = useState<'block' | 'record'>('block');
  const [roleValues, setRoleValues] = useState<Record<string, RoleValue>>({});

  const [opError, setOpError] = useState<OpError | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const launchRef = useRef<LaunchRecord | null>(null);
  // The launchable spec the form was last initialised for; undefined until first load.
  const initForRef = useRef<string | null | undefined>(undefined);

  const prefix = projectId ? `/api/projects/${encodeURIComponent(projectId)}` : '';

  const fetchSetup = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/harness/setup`);
      if (!res.ok) throw new Error(`setup ${res.status}`);
      const v: SetupView = await res.json();
      setView(v);
      setViewError('');
      // Initialise the form only on first load or when the launchable spec
      // changes, so a refetch after Save/Launch/Stop keeps the operator's edits.
      if (initForRef.current !== v.launchable) {
        setSupervisorModel(v.supervisor.model);
        setWorktree(v.worktree);
        setGates(v.gates);
        const rv: Record<string, RoleValue> = {};
        for (const r of v.roles) rv[r.agent] = { model: r.defaultModel, provider: r.defaultProvider };
        setRoleValues(rv);
        initForRef.current = v.launchable;
      }
    } catch (e: any) {
      setViewError(e?.message || t('harness.loadError'));
    }
  }, [projectId, t]);

  // Fetch the setup view on mount and whenever the project changes.
  useEffect(() => {
    initForRef.current = undefined;
    setView(null);
    setModel(null);
    setLaunch(null);
    launchRef.current = null;
    setLogLines([]);
    setGateSections({ gateA: null, gateB: null });
    setSummary({});
    fetchSetup();
  }, [projectId, fetchSetup]);

  // Subscribe to the harness view and its three message types (Req 4.8, 4.9).
  useEffect(() => {
    if (!projectId) return;
    const release = watchView({ kind: 'harness', projectId });

    const onModel = (d: { spec: string | null; model: RunModel | null; profiles: Record<string, AgentProfile>; launch: LaunchRecord | null }) => {
      setModel(d.model);
      setProfiles(d.profiles || {});
      setLaunch(d.launch);
      launchRef.current = d.launch;
    };
    const onGates = (d: { spec: string | null; gateA: string | null; gateB: string | null }) => {
      setGateSections({ gateA: d.gateA, gateB: d.gateB });
    };
    const onLog = (d: { launchedAt: string; lines: string[]; reset: boolean }) => {
      setLogLines((prev) => {
        // Drop a batch that belongs to a different launch than the current one.
        const current = launchRef.current?.launchedAt;
        if (current && d.launchedAt !== current) return prev;
        const base = d.reset ? [] : prev;
        const next = base.concat(d.lines || []);
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    };

    subscribe('harness-model', onModel);
    subscribe('harness-gates', onGates);
    subscribe('harness-log', onLog);
    return () => {
      unsubscribe('harness-model', onModel);
      unsubscribe('harness-gates', onGates);
      unsubscribe('harness-log', onLog);
      release();
    };
  }, [projectId, watchView, subscribe, unsubscribe]);

  // Tick the uptime while a run is live.
  useEffect(() => {
    if (!model?.runStartedAt || model?.runEndedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [model?.runStartedAt, model?.runEndedAt]);

  const inImplementation = model?.livePhase?.phase === 'implementation';
  const runSpec = model?.spec || view?.launchable || null;

  // In the implementation phase fetch the task-review summary at most every 5s.
  useEffect(() => {
    if (!inImplementation || !projectId || !runSpec) {
      setSummary({});
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/specs/${encodeURIComponent(runSpec)}/task-reviews/summary`);
        if (!res.ok) return;
        const data = await res.json();
        if (alive) setSummary(data.summary || {});
      } catch {
        // ignore; a missing summary just shows no verdicts
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [inImplementation, projectId, runSpec]);

  const buildInput = useCallback((v: SetupView): SetupInput => {
    const roles: Record<string, { model: string; provider?: Provider }> = {};
    for (const r of v.roles) {
      const val = roleValues[r.agent] || { model: r.defaultModel, provider: r.defaultProvider };
      roles[r.agent] = r.providerEditable
        ? { model: val.model, provider: val.provider }
        : { model: val.model };
    }
    return {
      spec: v.launchable as string,
      supervisorModel,
      worktree,
      gates,
      roles,
    };
  }, [roleValues, supervisorModel, worktree, gates]);

  const runOp = useCallback(async (kind: 'save' | 'launch' | 'stop') => {
    if (!projectId) return;
    if (kind !== 'stop' && (!view || !view.launchable)) return;
    setBusy(true);
    setOpError(null);
    let res: HarnessResult;
    if (kind === 'save') {
      res = await callHarness(`${prefix}/harness/setup`, 'PUT', buildInput(view as SetupView));
    } else if (kind === 'launch') {
      res = await callHarness(`${prefix}/harness/launch`, 'POST', buildInput(view as SetupView));
    } else {
      res = await callHarness(`${prefix}/harness/stop`, 'POST');
    }
    setBusy(false);
    if (!res.ok) setOpError({ status: res.status, body: res.data });
    await fetchSetup();
  }, [projectId, view, prefix, buildInput, fetchSetup]);

  const setRoleModel = (agent: string, defaults: RoleRow, model: string) => {
    setRoleValues((prev) => ({ ...prev, [agent]: { ...(prev[agent] || { model: defaults.defaultModel, provider: defaults.defaultProvider }), model } }));
  };
  const setRoleProvider = (agent: string, defaults: RoleRow, provider: Provider) => {
    setRoleValues((prev) => ({ ...prev, [agent]: { ...(prev[agent] || { model: defaults.defaultModel, provider: defaults.defaultProvider }), provider } }));
  };

  if (!projectId) {
    return <div className="text-[var(--text-secondary)]">{t('harness.noProject')}</div>;
  }

  const launchable = !!view?.launchable;
  const formDisabled = !launchable || busy;
  const running = launch?.state === 'running' || launch?.state === 'stopping';
  const uptimeMs = model?.runStartedAt
    ? (model.runEndedAt ? Date.parse(model.runEndedAt) : now) - Date.parse(model.runStartedAt)
    : NaN;

  return (
    <div className="space-y-4 min-w-0">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('harness.title')}</h1>

      {viewError && (
        <div className="rounded border border-[var(--status-error)] bg-[color-mix(in_srgb,var(--status-error)_10%,transparent)] p-3 text-sm text-[var(--status-error)] break-words">
          {t('harness.loadError')}
        </div>
      )}

      {/* Spec list and HANDOFF routing */}
      {view && (
        <Card title={t('harness.specs.heading')}>
          <div className="space-y-2">
            {view.specs.map((s) => (
              <div key={`${s.bucket}-${s.name}`} className="grid grid-cols-1 sm:grid-cols-4 gap-1 min-w-0 border-b border-[var(--border-default)] pb-2 last:border-b-0">
                <div className="min-w-0 break-words font-medium text-[var(--text-primary)]">
                  {s.name}
                  {s.routed && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[color-mix(in_srgb,var(--interactive-primary)_15%,transparent)] text-[var(--interactive-primary)]">
                      {t('harness.specs.routed')}
                    </span>
                  )}
                </div>
                <div className="min-w-0 break-words text-sm text-[var(--text-secondary)]">{t('harness.specs.phase')}: {s.currentPhase}</div>
                <div className="min-w-0 break-words text-sm text-[var(--text-secondary)]">{t('harness.specs.status')}: {s.overallStatus}</div>
                <div className="min-w-0 break-words text-sm text-[var(--text-secondary)]">{t('harness.specs.progress')}: {s.progress.completed}/{s.progress.total}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-[var(--border-default)]">
            <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.handoff.heading')}</div>
            {view.handoff ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                <Row label={t('harness.handoff.spec')} value={view.handoff.spec} />
                <Row label={t('harness.handoff.phase')} value={view.handoff.phase} />
                <Row label={t('harness.handoff.state')} value={view.handoff.state} />
                <Row label={t('harness.handoff.result')} value={view.handoff.result} />
              </div>
            ) : (
              <div className="text-sm text-[var(--text-muted)]">{t('harness.handoff.none')}</div>
            )}
          </div>
        </Card>
      )}

      {/* Run setup form */}
      {view && (
        <Card title={t('harness.form.heading')}>
          {!launchable && (
            <div className="mb-3 rounded border border-[var(--border-default)] bg-[var(--surface-inset)] p-2 text-sm text-[var(--text-secondary)] break-words">
              {t('harness.form.disabled', { reason: view.disabledReason || view.routing.reason })}
            </div>
          )}
          {view.saved && (
            <div className="mb-3 text-xs text-[var(--text-muted)] break-words">
              {t('harness.form.savedNotice', { writtenAt: view.saved.writtenAt })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Supervisor card */}
            <div className="rounded border border-[var(--border-default)] p-3 min-w-0">
              <div className="font-medium text-[var(--text-primary)] break-words">{t('harness.form.supervisor')}</div>
              <label className="block mt-2 text-xs text-[var(--text-muted)]">{t('harness.form.model')}</label>
              <input
                type="text"
                value={supervisorModel}
                disabled={formDisabled}
                onChange={(e) => setSupervisorModel(e.target.value)}
                className="w-full mt-1 px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--surface-base)] text-sm text-[var(--text-primary)] disabled:opacity-50"
              />
              <div className="mt-2 text-xs text-[var(--text-secondary)] break-words">
                {t('harness.form.effort')}: {view.supervisor.effort}
              </div>
              <div className="text-xs text-[var(--text-muted)] break-words">{t('harness.form.supervisorEffortFixed')}</div>
            </div>

            {/* One card per role */}
            {view.roles.map((r) => {
              const val = roleValues[r.agent] || { model: r.defaultModel, provider: r.defaultProvider };
              return (
                <div key={r.agent} className="rounded border border-[var(--border-default)] p-3 min-w-0">
                  <div className="font-medium text-[var(--text-primary)] break-words">{r.agent}</div>
                  <div className="text-xs text-[var(--text-muted)] break-words">{t('harness.form.role')}: {r.role}</div>
                  <label className="block mt-2 text-xs text-[var(--text-muted)]">{t('harness.form.model')}</label>
                  <input
                    type="text"
                    value={val.model}
                    disabled={formDisabled}
                    onChange={(e) => setRoleModel(r.agent, r, e.target.value)}
                    className="w-full mt-1 px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--surface-base)] text-sm text-[var(--text-primary)] disabled:opacity-50"
                  />
                  {r.providerEditable && (
                    <>
                      <label className="block mt-2 text-xs text-[var(--text-muted)]">{t('harness.form.provider')}</label>
                      <select
                        value={val.provider}
                        disabled={formDisabled}
                        onChange={(e) => setRoleProvider(r.agent, r, e.target.value as Provider)}
                        className="w-full mt-1 px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--surface-base)] text-sm text-[var(--text-primary)] disabled:opacity-50"
                      >
                        <option value="anthropic">{t('harness.provider.anthropic')}</option>
                        <option value="deepseek">{t('harness.provider.deepseek')}</option>
                      </select>
                    </>
                  )}
                  <div className="mt-2 text-xs text-[var(--text-secondary)] break-words">
                    {t('harness.form.declaredModel')}: {r.declaredModel}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] break-words">
                    {t('harness.form.effort')}: {r.effort}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] break-words">{t('harness.form.effortFixed')}</div>
                </div>
              );
            })}
          </div>

          {/* Worktree and gates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="min-w-0">
              <label className="block text-xs text-[var(--text-muted)]">{t('harness.form.worktree')}</label>
              <select
                value={worktree}
                disabled={formDisabled}
                onChange={(e) => setWorktree(e.target.value as 'yes' | 'no')}
                className="w-full mt-1 px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--surface-base)] text-sm text-[var(--text-primary)] disabled:opacity-50"
              >
                <option value="yes">{t('harness.form.worktreeYes')}</option>
                <option value="no">{t('harness.form.worktreeNo')}</option>
              </select>
            </div>
            <div className="min-w-0">
              <label className="block text-xs text-[var(--text-muted)]">{t('harness.form.gates')}</label>
              <select
                value={gates}
                disabled={formDisabled}
                onChange={(e) => setGates(e.target.value as 'block' | 'record')}
                className="w-full mt-1 px-2 py-1 rounded border border-[var(--border-default)] bg-[var(--surface-base)] text-sm text-[var(--text-primary)] disabled:opacity-50"
              >
                <option value="block">{t('harness.form.gatesBlock')}</option>
                <option value="record">{t('harness.form.gatesRecord')}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              onClick={() => runOp('save')}
              disabled={formDisabled}
              className="btn-secondary disabled:opacity-50"
            >
              {busy ? t('harness.form.saving') : t('harness.form.save')}
            </button>
            <button
              onClick={() => runOp('launch')}
              disabled={formDisabled}
              className="px-4 py-2 rounded-md bg-[var(--interactive-primary)] text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? t('harness.form.launching') : t('harness.form.launch')}
            </button>
          </div>
        </Card>
      )}

      {/* Operation error: 400 field/value/error, 409 reason/run id, 500 step/detail */}
      {opError && (
        <div className="rounded border border-[var(--status-error)] bg-[color-mix(in_srgb,var(--status-error)_10%,transparent)] p-3 min-w-0">
          <div className="text-sm font-semibold text-[var(--status-error)] mb-1">{t('harness.error.heading')}</div>
          <OpErrorBody error={opError} />
        </div>
      )}

      {/* Run bar */}
      {launch && (
        <Card title={t('harness.run.heading')}>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <Row label={t('harness.run.state')} value={launch.state} />
            <Row label={t('harness.run.pid')} value={launch.pid} />
            <Row label={t('harness.run.runId')} value={launch.runId} />
            <Row label={t('harness.run.exitCode')} value={launch.exitCode} />
          </div>
          {running && (
            <button
              onClick={() => runOp('stop')}
              disabled={busy || launch.state === 'stopping'}
              className="mt-3 px-4 py-2 rounded-md bg-[var(--status-error)] text-white text-sm font-medium disabled:opacity-50"
            >
              {launch.state === 'stopping' ? t('harness.run.stopping') : t('harness.run.stop')}
            </button>
          )}
        </Card>
      )}

      {/* Live view */}
      <Card title={t('harness.live.heading')}>
        {model ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              <Row label={t('harness.live.spec')} value={model.spec} />
              <Row label={t('harness.live.codeRoot')} value={model.codeRoot} />
              <Row label={t('harness.live.worktree')} value={model.worktree} />
              <Row label={t('harness.live.runId')} value={model.runId} />
              <Row label={t('harness.live.uptime')} value={model.runStartedAt ? fmtDuration(uptimeMs) : null} />
              <Row label={t('harness.live.tokens')} value={model.tokensTotal} />
              <Row label={t('harness.live.providers')} value={model.providers} />
            </div>

            {/* Phase rows */}
            {model.phases.length > 0 && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.live.phases')}</div>
                <div className="space-y-1">
                  {model.phases.map((p, i) => (
                    <div key={i} className="text-sm text-[var(--text-secondary)] break-words min-w-0">
                      {p.phase} — {p.state}{present(p.result) ? ` / ${p.result}` : ''}{present(p.note) ? ` — ${p.note}` : ''}{present(p.date) ? ` (${p.date})` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live phase */}
            {model.livePhase && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.live.livePhase')}</div>
                <div className="text-sm text-[var(--text-secondary)] break-words">
                  {model.livePhase.phase}
                  {present(model.livePhase.mode) ? ` — ${model.livePhase.mode}` : ''}
                  {present(model.livePhase.state) ? ` / ${model.livePhase.state}` : ''}
                  {present(model.livePhase.budget) ? ` — ${model.livePhase.budget}` : ''}
                </div>
              </div>
            )}

            {/* Spawn tree */}
            {model.spawns.length > 0 && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.live.spawns')}</div>
                <div className="space-y-1">
                  {model.spawns.map((sp, i) => (
                    <SpawnRow key={i} spawn={sp} profile={profiles[sp.agent]} t={t} />
                  ))}
                </div>
              </div>
            )}

            {/* Round rows */}
            {model.rounds.length > 0 && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.live.rounds')}</div>
                <div className="space-y-1">
                  {model.rounds.map((r, i) => (
                    <div key={i} className="text-sm text-[var(--text-secondary)] break-words min-w-0">
                      {r.phase} {t('harness.live.round')} {r.round} — {r.verdict}{present(r.version) ? ` (${r.version})` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Picks */}
            {model.picks.length > 0 && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.live.picks')}</div>
                <div className="space-y-1">
                  {model.picks.map((p, i) => (
                    <div key={i} className="text-sm text-[var(--text-secondary)] break-words min-w-0">
                      {p.task} — {p.title} {p.done ? '✓' : ''}{present(p.outcome) ? ` (${p.outcome})` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Implementation task rows with verdict and tdd */}
            {inImplementation && model.tasks.length > 0 && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.live.tasks')}</div>
                <div className="space-y-1">
                  {model.tasks.map((task) => {
                    const rev = summary[task.id];
                    return (
                      <div key={task.id} className="text-sm text-[var(--text-secondary)] break-words min-w-0">
                        {task.id} — {task.title} [{task.status}]
                        {rev && present(rev.verdict) ? ` — ${t('harness.live.verdict')}: ${rev.verdict}` : ''}
                        {rev && rev.tdd ? ` — ${t('harness.live.tdd')}: ${typeof rev.tdd === 'string' ? rev.tdd : JSON.stringify(rev.tdd)}` : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Ticker */}
            {model.ticker.length > 0 && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.live.ticker')}</div>
                <div className="space-y-1">
                  {model.ticker.map((tk, i) => (
                    <div key={i} className="text-xs text-[var(--text-muted)] break-words min-w-0">
                      {tk.ts} {tk.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-[var(--text-muted)]">{t('harness.live.empty')}</div>
        )}
      </Card>

      {/* Gate sections — read-only text, no control answers them (Req 4.5) */}
      <Card title={t('harness.gates.heading')}>
        {gateSections.gateA || gateSections.gateB ? (
          <div className="space-y-3">
            {gateSections.gateA && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.gates.gateA')}</div>
                <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words min-w-0">{gateSections.gateA}</pre>
              </div>
            )}
            {gateSections.gateB && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)] mb-1">{t('harness.gates.gateB')}</div>
                <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words min-w-0">{gateSections.gateB}</pre>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-[var(--text-muted)]">{t('harness.gates.none')}</div>
        )}
      </Card>

      {/* Log lines */}
      <Card title={t('harness.logs.heading')}>
        {logLines.length > 0 ? (
          <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words min-w-0 max-h-96 overflow-y-auto">
            {logLines.join('\n')}
          </pre>
        ) : (
          <div className="text-sm text-[var(--text-muted)]">{t('harness.logs.empty')}</div>
        )}
      </Card>
    </div>
  );
}

function SpawnRow({ spawn, profile, t }: { spawn: SpawnNode; profile?: AgentProfile; t: (k: string) => string }) {
  const indent = spawn.level === 2 ? 'ml-4' : '';
  const declared = profile ? `${profile.model} / ${profile.effort}` : null;
  return (
    <div className={`text-sm text-[var(--text-secondary)] break-words min-w-0 ${indent}`}>
      <span className="text-[var(--text-primary)]">{spawn.role || spawn.agent}</span>
      {present(declared) ? ` — ${t('harness.live.declaredModel')}: ${declared}` : ''}
      {present(spawn.model) ? ` — ${t('harness.live.actualModel')}: ${spawn.model}` : ''}
      {present(spawn.provider) ? ` — ${t('harness.live.provider')}: ${spawn.provider}` : ''}
      {present(spawn.tokens) ? ` — ${t('harness.live.tokensLabel')}: ${spawn.tokens}` : ''}
    </div>
  );
}

function OpErrorBody({ error }: { error: OpError }) {
  const { t } = useTranslation();
  const body = error.body || {};
  // 409 run-live: reason and run id
  if (body.error === 'run-live') {
    return (
      <div className="text-sm text-[var(--text-primary)] space-y-1">
        <Row label={t('harness.error.runLive')} value={body.reason} />
        <Row label={t('harness.error.runId')} value={body.runId} />
      </div>
    );
  }
  // 409 not-launchable: reason
  if (body.error === 'not-launchable') {
    return (
      <div className="text-sm text-[var(--text-primary)] space-y-1">
        <Row label={t('harness.error.notLaunchable')} value={body.reason} />
      </div>
    );
  }
  // 404 not-running
  if (body.error === 'not-running') {
    return <div className="text-sm text-[var(--text-primary)] break-words">{t('harness.error.notRunning')}</div>;
  }
  // 500 with step and detail
  if (present(body.step)) {
    return (
      <div className="text-sm text-[var(--text-primary)] space-y-1">
        <Row label={t('harness.error.step')} value={body.step} />
        <Row label={t('harness.error.detail')} value={body.detail || body.error} />
      </div>
    );
  }
  // 400 ValidationError: field, value, error
  if (present(body.field)) {
    return (
      <div className="text-sm text-[var(--text-primary)] space-y-1">
        <Row label={t('harness.error.field')} value={body.field} />
        <Row label={t('harness.error.value')} value={body.value} />
        <div className="break-words min-w-0">{body.error}</div>
      </div>
    );
  }
  return <div className="text-sm text-[var(--text-primary)] break-words">{body.error || t('harness.error.generic')}</div>;
}
