import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useWs } from '../ws/WebSocketProvider';
import { useProjects } from '../projects/ProjectProvider';
import type { NowModel, SpecListRow, ControllerWait, ControllerRun, ControllerActivity, StagedAction } from './types';

export type Density = 'comfortable' | 'compact';

export interface DeferralRecord {
  id: string;
  title: string;
  status: string;
  originSpec?: string;
  [key: string]: any;
}

export interface DeferralsPayload {
  deferrals: DeferralRecord[];
  duplicateGroups: any[];
  deferredSpecs: any[];
}

interface ShellContextType {
  now: NowModel | null;
  specRows: SpecListRow[];
  controllerWaits: ControllerWait[];
  controllerRuns: ControllerRun[];
  controllerActivity: ControllerActivity[];
  controllerActions: StagedAction[];
  deferralsByProject: Record<string, DeferralsPayload>;
  connected: boolean;
  density: Density;
  setDensity: (density: Density) => void;
}

/** One desktop notification per new wait (T4): no sound, no other kinds. */
function notifyWait(wait: ControllerWait): void {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Waiting on you', { body: `${wait.kind} — ${wait.spec}` });
    }
  } catch {
    /* a browser without the Notification API: silent */
  }
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

const DENSITY_KEY = 'shell.density';

function readDensity(): Density {
  try {
    return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
}

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const { connected, subscribe, unsubscribe, watchView } = useWs();
  const { projects } = useProjects();
  const [now, setNow] = useState<NowModel | null>(null);
  const [specRows, setSpecRows] = useState<SpecListRow[]>([]);
  const [controllerWaits, setControllerWaits] = useState<ControllerWait[]>([]);
  const [controllerRuns, setControllerRuns] = useState<ControllerRun[]>([]);
  const [controllerActivity, setControllerActivity] = useState<ControllerActivity[]>([]);
  const [controllerActions, setControllerActions] = useState<StagedAction[]>([]);
  const [deferralsByProject, setDeferralsByProject] = useState<Record<string, DeferralsPayload>>({});
  const [density, setDensityState] = useState<Density>(() => readDensity());

  // Open wait ids already seen; the first payload seeds it so a reconnect or a
  // reload does not re-notify. One notification per newly appearing open wait.
  const seenWaitIds = useRef<Set<string>>(new Set());
  const seenSeeded = useRef(false);

  // Hold the overview view for the life of the page and listen for its pushes.
  useEffect(() => {
    const onNow = (data: NowModel) => setNow(data);
    const onSpecs = (data: { rows: SpecListRow[] }) => setSpecRows(data?.rows ?? []);
    const onControllerWaits = (data: { waits: ControllerWait[] }) => {
      const waits = data?.waits ?? [];
      setControllerWaits(waits);
      const open = waits.filter((w) => w.state === 'open');
      if (!seenSeeded.current) {
        open.forEach((w) => seenWaitIds.current.add(w.id));
        seenSeeded.current = true;
        return;
      }
      for (const w of open) {
        if (!seenWaitIds.current.has(w.id)) {
          seenWaitIds.current.add(w.id);
          notifyWait(w);
        }
      }
    };
    const onControllerRuns = (data: { runs: ControllerRun[] }) => setControllerRuns(data?.runs ?? []);
    const onControllerActivity = (data: { activity: ControllerActivity[] }) =>
      setControllerActivity(data?.activity ?? []);
    const onControllerActions = (data: { actions: StagedAction[] }) =>
      setControllerActions(data?.actions ?? []);
    const onDeferrals = (data: DeferralsPayload, projectId?: string) => {
      if (projectId) setDeferralsByProject((prev) => ({ ...prev, [projectId]: data }));
    };
    subscribe('shell-now', onNow);
    subscribe('shell-specs', onSpecs);
    subscribe('controller-waits', onControllerWaits);
    subscribe('controller-runs', onControllerRuns);
    subscribe('controller-activity', onControllerActivity);
    subscribe('controller-actions', onControllerActions);
    subscribe('deferrals-update', onDeferrals);
    const release = watchView({ kind: 'overview' });
    return () => {
      release();
      unsubscribe('shell-now', onNow);
      unsubscribe('shell-specs', onSpecs);
      unsubscribe('controller-waits', onControllerWaits);
      unsubscribe('controller-runs', onControllerRuns);
      unsubscribe('controller-activity', onControllerActivity);
      unsubscribe('controller-actions', onControllerActions);
      unsubscribe('deferrals-update', onDeferrals);
    };
  }, [subscribe, unsubscribe, watchView]);

  // Fetch the per-project deferrals payloads; `deferrals-update` replaces them.
  const projectKey = projects.map((p) => p.projectId).sort().join(',');
  useEffect(() => {
    let cancelled = false;
    for (const project of projects) {
      const id = project.projectId;
      fetch(`/api/projects/${id}/deferrals`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!cancelled && data) setDeferralsByProject((prev) => ({ ...prev, [id]: data }));
        })
        .catch(() => { /* a project with no deferrals route stays absent */ });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectKey]);

  // Density drives the shared row height CSS variable.
  useEffect(() => {
    document.documentElement.style.setProperty('--row-h', density === 'compact' ? '32px' : '36px');
  }, [density]);

  const setDensity = useCallback((d: Density) => {
    setDensityState(d);
    try { localStorage.setItem(DENSITY_KEY, d); } catch { /* ignore */ }
  }, []);

  const value = useMemo<ShellContextType>(() => ({
    now,
    specRows,
    controllerWaits,
    controllerRuns,
    controllerActivity,
    controllerActions,
    deferralsByProject,
    connected,
    density,
    setDensity
  }), [now, specRows, controllerWaits, controllerRuns, controllerActivity, controllerActions, deferralsByProject, connected, density, setDensity]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextType {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
