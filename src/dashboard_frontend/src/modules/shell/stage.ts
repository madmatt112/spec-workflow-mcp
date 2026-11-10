// src/dashboard_frontend/src/modules/shell/stage.ts
//
// Design C11 "Stages" (D20, D34, D37). One rule set for the lifecycle of a
// pressed control (pause, resume, stop, discard, redrive, launch, confirm,
// dismiss): `pressed` while the request is in flight, `running` once accepted
// and awaiting its outcome, `done` or `failed` once resolved. Pure, type-only
// imports, no DOM types and no React — `useStages.ts` is the stateful caller.
import type { ControllerRun, ControllerWait, StagedAction } from './types';
import { isOperatorHeld } from './pause';
import { isStalled } from './board';
import type { HarnessResult } from './harness';

export type StageName =
  | 'pause' | 'resume' | 'stop' | 'discard' | 'redrive' | 'launch' | 'confirm' | 'dismiss' | 'answer';
export type StagePhase = 'pressed' | 'running' | 'done' | 'failed';

export interface Stage {
  name: StageName;
  phase: StagePhase;
  at: number;
  reason?: string;
  opError?: { status: number; body: any };
  runId?: string;
}

/**
 * What a stage's `resolved` check reads, keyed by stage name per design C11's
 * table: `run`/`waits` for `pause`/`resume`/`stop`/`discard`/`redrive`,
 * `controllerRuns` for `launch`, `actionState`/`actionDetail` for
 * `confirm`/`dismiss`. Undefined `run` reads as "the row is gone".
 */
export interface Observed {
  run?: ControllerRun;
  waits?: ControllerWait[];
  controllerRuns?: string[];
  actionState?: StagedAction['state'];
  actionDetail?: string;
}

const RUNNING_TIMEOUT_MS = 30_000;
const DONE_CLEAR_MS = 5_000;

/** The body's `reason`, else its `error`, else the status code as text. */
export function failReason(status: number, body: any): string {
  return body?.reason ?? body?.error ?? String(status);
}

/**
 * Turns a `callHarness` result, or a rejected fetch (`result: null`), into the
 * next stage: a rejected fetch or a non-2xx gives `failed` with `failReason`
 * (a `launch` non-2xx also keeps `opError` so the tile can render
 * `OpErrorView`); a 2xx whose body has `ok === false` gives `failed` with the
 * body's `error`, because `confirm` answers 200 when its executor fails
 * (D34); any other 2xx gives `running`.
 */
export function responseStage(name: StageName, result: HarnessResult | null, now: number): Stage {
  if (result === null) {
    return { name, phase: 'failed', at: now, reason: 'the request failed' };
  }
  if (!result.ok) {
    const stage: Stage = { name, phase: 'failed', at: now, reason: failReason(result.status, result.data) };
    if (name === 'launch') stage.opError = { status: result.status, body: result.data };
    return stage;
  }
  if (result.data && result.data.ok === false) {
    return { name, phase: 'failed', at: now, reason: result.data.error };
  }
  const stage: Stage = { name, phase: 'running', at: now };
  if (name === 'launch' && typeof result.data?.runId === 'string') stage.runId = result.data.runId;
  return stage;
}

/** Whether a running stage's outcome has landed, per design C11's table. */
export function resolved(stage: Stage, seen: Observed): boolean {
  switch (stage.name) {
    case 'pause': {
      const run = seen.run;
      return run !== undefined && (run.pauseRequested !== undefined || run.status === 'paused');
    }
    case 'resume': {
      const run = seen.run;
      return run !== undefined && !isOperatorHeld(run) && run.status !== 'paused';
    }
    case 'stop':
      return seen.run === undefined || seen.run.status === 'abandoned';
    case 'discard':
      return seen.run === undefined || seen.run.branchPresent === false;
    case 'redrive':
      return seen.run === undefined || !isStalled(seen.run, seen.waits ?? []);
    case 'launch':
      return stage.runId !== undefined && (seen.controllerRuns ?? []).includes(stage.runId);
    case 'confirm':
      return seen.actionState === 'done' || seen.actionState === 'refused' || seen.actionState === 'failed';
    case 'dismiss':
      return seen.actionState === 'dismissed';
    case 'answer':
      return seen.run === undefined || seen.run.status !== 'waiting';
  }
}

/**
 * Advances a stage one tick: a resolved `running` stage moves to `done`,
 * except a `confirm` that resolves as `refused` or `failed`, which moves to
 * `failed` with the outcome detail as reason; an unresolved `running` stage
 * older than 30 s moves to `failed` with "no change seen in 30 s" (D20); a
 * `done` stage older than 5 s clears to `null`; a `failed` stage stays until
 * the next press on that key or until the tile leaves.
 */
export function advance(stage: Stage, seen: Observed, now: number): Stage | null {
  if (stage.phase === 'running') {
    if (resolved(stage, seen)) {
      if (stage.name === 'confirm' && (seen.actionState === 'refused' || seen.actionState === 'failed')) {
        return { ...stage, phase: 'failed', reason: seen.actionDetail };
      }
      return { ...stage, phase: 'done', at: now };
    }
    if (now - stage.at >= RUNNING_TIMEOUT_MS) {
      return { ...stage, phase: 'failed', reason: 'no change seen in 30 s' };
    }
    return stage;
  }
  if (stage.phase === 'done') {
    return now - stage.at >= DONE_CLEAR_MS ? null : stage;
  }
  return stage;
}
