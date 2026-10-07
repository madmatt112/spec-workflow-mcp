import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useWs } from '../ws/WebSocketProvider';
import { useProjects } from '../projects/ProjectProvider';
import type { NowModel, SpecListRow } from './types';

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
  deferralsByProject: Record<string, DeferralsPayload>;
  connected: boolean;
  density: Density;
  setDensity: (density: Density) => void;
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
  const [deferralsByProject, setDeferralsByProject] = useState<Record<string, DeferralsPayload>>({});
  const [density, setDensityState] = useState<Density>(() => readDensity());

  // Hold the overview view for the life of the page and listen for its pushes.
  useEffect(() => {
    const onNow = (data: NowModel) => setNow(data);
    const onSpecs = (data: { rows: SpecListRow[] }) => setSpecRows(data?.rows ?? []);
    const onDeferrals = (data: DeferralsPayload, projectId?: string) => {
      if (projectId) setDeferralsByProject((prev) => ({ ...prev, [projectId]: data }));
    };
    subscribe('shell-now', onNow);
    subscribe('shell-specs', onSpecs);
    subscribe('deferrals-update', onDeferrals);
    const release = watchView({ kind: 'overview' });
    return () => {
      release();
      unsubscribe('shell-now', onNow);
      unsubscribe('shell-specs', onSpecs);
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
    deferralsByProject,
    connected,
    density,
    setDensity
  }), [now, specRows, deferralsByProject, connected, density, setDensity]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellContextType {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within ShellProvider');
  return ctx;
}
