import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useWs } from '../ws/WebSocketProvider';
import { useProjects } from '../projects/ProjectProvider';
import { deployRetryCap } from './deploy';
import type { SpecListRow, ControllerWait, ControllerRun, StagedAction, ControllerDeploy } from './types';

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
  specRows: SpecListRow[];
  controllerWaits: ControllerWait[];
  controllerRuns: ControllerRun[];
  controllerActions: StagedAction[];
  controllerDeploy: ControllerDeploy | null;
  deferralsByProject: Record<string, DeferralsPayload>;
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

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const { subscribe, unsubscribe, watchView, setRetryCap } = useWs();
  const { projects } = useProjects();
  const [specRows, setSpecRows] = useState<SpecListRow[]>([]);
  const [controllerWaits, setControllerWaits] = useState<ControllerWait[]>([]);
  const [controllerRuns, setControllerRuns] = useState<ControllerRun[]>([]);
  const [controllerActions, setControllerActions] = useState<StagedAction[]>([]);
  const [controllerDeploy, setControllerDeploy] = useState<ControllerDeploy | null>(null);
  const [deferralsByProject, setDeferralsByProject] = useState<Record<string, DeferralsPayload>>({});

  // Open wait ids already seen; the first payload seeds it so a reconnect or a
  // reload does not re-notify. One notification per newly appearing open wait.
  const seenWaitIds = useRef<Set<string>>(new Set());
  const seenSeeded = useRef(false);

  // Hold the overview view for the life of the page and listen for its pushes.
  useEffect(() => {
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
    const onControllerActions = (data: { actions: StagedAction[] }) =>
      setControllerActions(data?.actions ?? []);
    const onControllerDeploy = (data: { deploy: ControllerDeploy | null }) =>
      setControllerDeploy(data?.deploy ?? null);
    const onDeferrals = (data: DeferralsPayload, projectId?: string) => {
      if (projectId) setDeferralsByProject((prev) => ({ ...prev, [projectId]: data }));
    };
    subscribe('shell-specs', onSpecs);
    subscribe('controller-waits', onControllerWaits);
    subscribe('controller-runs', onControllerRuns);
    subscribe('controller-actions', onControllerActions);
    subscribe('controller-deploy', onControllerDeploy);
    subscribe('deferrals-update', onDeferrals);
    const release = watchView({ kind: 'overview' });
    return () => {
      release();
      unsubscribe('shell-specs', onSpecs);
      unsubscribe('controller-waits', onControllerWaits);
      unsubscribe('controller-runs', onControllerRuns);
      unsubscribe('controller-actions', onControllerActions);
      unsubscribe('controller-deploy', onControllerDeploy);
      unsubscribe('deferrals-update', onDeferrals);
    };
  }, [subscribe, unsubscribe, watchView]);

  // Cap the reconnect delay while the record is at swap or restart (design
  // C9/C10; Requirement 6 AC8), so a client reconnects within 10 seconds.
  useEffect(() => {
    setRetryCap(deployRetryCap(controllerDeploy?.stage));
  }, [controllerDeploy, setRetryCap]);

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

  const value = useMemo<ShellContextType>(() => ({
    specRows,
    controllerWaits,
    controllerRuns,
    controllerActions,
    controllerDeploy,
    deferralsByProject,
  }), [specRows, controllerWaits, controllerRuns, controllerActions, controllerDeploy, deferralsByProject]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextType {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
