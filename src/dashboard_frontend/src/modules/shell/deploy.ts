// src/dashboard_frontend/src/modules/shell/deploy.ts
//
// Design C9 "Dashboard control". Pure stage/hold helpers, type-only imports,
// no DOM types and no React.
import type { ControllerRun, DeployStage } from './types';

export const DEPLOY_STAGES: readonly DeployStage[] =
  ['wait', 'build', 'smoke', 'gate', 'swap', 'restart', 'done'];

export function isDeployOpen(stage: DeployStage): boolean {
  return stage !== 'done' && stage !== 'failed';
}

const CANCELABLE_STAGES = new Set<DeployStage>(['wait', 'build', 'smoke', 'gate']);

export function canCancel(stage: DeployStage): boolean {
  return CANCELABLE_STAGES.has(stage);
}

const LIVE_STATUSES = new Set<ControllerRun['status']>(['queued', 'running', 'merging', 'paused', 'waiting']);

export function deployHoldCount(runs: ControllerRun[]): number {
  return runs.filter((run) => LIVE_STATUSES.has(run.status) && run.pauseRequested === undefined).length;
}

export function deployRetryCap(stage?: DeployStage): number | null {
  return stage === 'swap' || stage === 'restart' ? 2000 : null;
}
