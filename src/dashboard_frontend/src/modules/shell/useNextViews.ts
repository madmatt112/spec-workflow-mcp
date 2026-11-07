// src/dashboard_frontend/src/modules/shell/useNextViews.ts
//
// Design C10 "Home and tiles", D29, D30. Fetches each tracked project's
// `/harness/setup` view on mount, when `runKey` changes, and every 30 s. A
// failed fetch removes that project's entry only; a per-project sequence
// number drops a response superseded by a later fetch for the same project.
import { useEffect, useRef, useState } from 'react';
import type { SetupView } from '../harness/types';
import type { Project } from '../projects/ProjectProvider';

const POLL_MS = 30_000;

export function useNextViews(projects: Project[], runKey: string): Map<string, SetupView> {
  const [views, setViews] = useState<Map<string, SetupView>>(new Map());
  const seqRef = useRef<Map<string, number>>(new Map());
  const idsKey = projects.map((p) => p.projectId).sort().join(',');

  useEffect(() => {
    let cancelled = false;

    async function fetchOne(projectId: string): Promise<void> {
      const seq = (seqRef.current.get(projectId) ?? 0) + 1;
      seqRef.current.set(projectId, seq);
      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/harness/setup`);
        if (!res.ok) throw new Error(`setup ${res.status}`);
        const data = await res.json() as SetupView;
        if (cancelled || seqRef.current.get(projectId) !== seq) return;
        setViews((prev) => new Map(prev).set(projectId, data));
      } catch {
        if (cancelled || seqRef.current.get(projectId) !== seq) return;
        setViews((prev) => {
          if (!prev.has(projectId)) return prev;
          const next = new Map(prev);
          next.delete(projectId);
          return next;
        });
      }
    }

    function fetchAll(): void {
      const ids = idsKey === '' ? [] : idsKey.split(',');
      for (const id of ids) void fetchOne(id);
      const idSet = new Set(ids);
      setViews((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const key of next.keys()) {
          if (!idSet.has(key)) { next.delete(key); changed = true; }
        }
        return changed ? next : prev;
      });
    }

    fetchAll();
    const interval = setInterval(fetchAll, POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [idsKey, runKey]);

  return views;
}
