// src/dashboard_frontend/src/modules/shell/board.ts
//
// Design C9 "Board model". Pure tile-selection helpers, type-only imports,
// no DOM types and no React. No caller yet (task 11 wires Home to these).
import type { ControllerWait, ControllerRun, StagedAction } from './types';
import type { SetupView } from '../harness/types';
import type { Project } from '../projects/ProjectProvider';
import { storeGroups } from '../projects/stores';

type NeedsYouItem = ControllerWait | StagedAction;

function targetProject(action: StagedAction): string | null {
  const value = action.target.project;
  return typeof value === 'string' ? value : null;
}

function passesProjectFilter(projectId: string | null, enabled: (projectId: string) => boolean): boolean {
  return projectId === null || enabled(projectId);
}

export function needsYou(
  waits: ControllerWait[],
  actions: StagedAction[],
  enabled: (projectId: string) => boolean,
): NeedsYouItem[] {
  const openWaits = waits.filter((wait) => wait.state === 'open' && enabled(wait.project));
  const liveActions = actions.filter((action) => (
    (action.state === 'staged' || action.state === 'running')
    && passesProjectFilter(targetProject(action), enabled)
  ));
  return [...openWaits, ...liveActions].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
}

const MOVING_STATUSES = new Set<ControllerRun['status']>(['queued', 'running', 'merging', 'paused', 'waiting']);
const DAY_MS = 24 * 60 * 60 * 1000;

export function stoppedAdmitted(run: ControllerRun, now: number): boolean {
  if (run.status === 'abandoned' || run.status === 'error') return Boolean(run.branchPresent);
  if (run.status === 'done') {
    return Boolean(run.branchPresent) && now - Date.parse(run.updated) < DAY_MS;
  }
  return false;
}

export function running(
  runs: ControllerRun[],
  enabled: (projectId: string) => boolean,
  now: number,
): ControllerRun[] {
  const onProject = runs.filter((run) => enabled(run.project));
  const moving = onProject
    .filter((run) => MOVING_STATUSES.has(run.status))
    .sort((a, b) => Date.parse(a.lastActivity ?? a.updated) - Date.parse(b.lastActivity ?? b.updated));
  const stopped = onProject
    .filter((run) => !MOVING_STATUSES.has(run.status) && stoppedAdmitted(run, now))
    .sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
  return [...moving, ...stopped];
}

export function nextProjects(
  projects: Project[],
  enabled: (projectId: string) => boolean,
): Project[] {
  const result: Project[] = [];
  for (const group of storeGroups(projects, enabled)) {
    if (!group.enabled) continue;
    if (enabled(group.representative.projectId)) {
      result.push(group.representative);
      continue;
    }
    const member = group.projects.find((p) => enabled(p.projectId));
    if (member) result.push(member);
  }
  return result;
}

export function nextTiles(
  views: Map<string, SetupView>,
  projectName: (projectId: string) => string,
): Array<[string, SetupView]> {
  return [...views.entries()]
    .filter(([, view]) => view.launchable !== null)
    .sort(([idA, viewA], [idB, viewB]) => (
      (viewA.launchableOrder ?? Infinity) - (viewB.launchableOrder ?? Infinity)
      || projectName(idA).localeCompare(projectName(idB))
    ));
}
