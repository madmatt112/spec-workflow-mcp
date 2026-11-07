// src/dashboard_frontend/src/modules/shell/useStages.ts
//
// Design C11 "Stages" (D42, D47). The stateful half of the stage lifecycle:
// `stage.ts` holds the rules, this hook holds the per-key state and the
// `callHarness` call. It holds no tile knowledge — `retained` only forwards
// whatever `Observed` snapshot its caller passes into the pure `advance`, so
// a tile is free to build that snapshot from its own run, waits or action
// props without this hook knowing those shapes. No unit test reaches here
// (D42); task 12's browser cases prove it, the same bridge `board.ts`'s
// caller-less helpers crossed in task 8/9.
import { useCallback, useState } from 'react';
import { callHarness } from './harness';
import { responseStage, advance, type Stage, type StageName, type Observed } from './stage';

export interface Stages {
  /** The stage currently held per key, as last computed by `press` or `retained`. */
  stages: Map<string, Stage>;
  /** Presses a control: marks the key `pressed`, then resolves to `running` or `failed` from the response. */
  press: (key: string, name: StageName, url: string, method: 'PUT' | 'POST', body?: unknown) => Promise<void>;
  /** Advances and returns the stage held at `key` against the caller's own `Observed` snapshot; drops it once `advance` clears it. */
  retained: (key: string, seen: Observed) => Stage | null;
}

export function useStages(): Stages {
  const [stages, setStages] = useState<Map<string, Stage>>(new Map());

  const press = useCallback(async (key: string, name: StageName, url: string, method: 'PUT' | 'POST', body?: unknown) => {
    setStages((prev) => new Map(prev).set(key, { name, phase: 'pressed', at: Date.now() }));
    const result = await callHarness(url, method, body).catch(() => null);
    setStages((prev) => new Map(prev).set(key, responseStage(name, result, Date.now())));
  }, []);

  const retained = useCallback((key: string, seen: Observed): Stage | null => {
    const current = stages.get(key) ?? null;
    if (current === null || current.phase === 'pressed') return current;
    const next = advance(current, seen, Date.now());
    if (next !== current) {
      setStages((prev) => {
        const copy = new Map(prev);
        if (next === null) copy.delete(key);
        else copy.set(key, next);
        return copy;
      });
    }
    return next;
  }, [stages]);

  return { stages, press, retained };
}
