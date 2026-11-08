// src/dashboard_frontend/src/modules/shell/board.ts
//
// Design C9 "Board model". Pure tile-selection helpers, type-only imports,
// no DOM types and no React. No caller yet (task 11 wires Home to these).
import type { ControllerWait, ControllerRun, ControllerPrRead, StagedAction } from './types';
import type { SetupView } from '../harness/types';
import type { Project } from '../projects/ProjectProvider';
import { isOperatorHeld } from './pause';

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
  return projects.filter((p) => enabled(p.projectId));
}

/** Two-press arming for a `warn` guard (design C2 "Two press (AC 4)"). Every
 *  other guard state launches on one press. */
export function launchPress(
  view: { launchable: string | null; guard?: { state: 'clear' | 'warn' | 'no-list' } },
  armedSpec: string | null,
): 'arm' | 'launch' {
  if (view.guard?.state !== 'warn') return 'launch';
  if (armedSpec !== view.launchable) return 'arm';
  return 'launch';
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

export function ageTone(ms: number): 'neutral' | 'warning' | 'danger' {
  if (ms >= 3_600_000) return 'danger';
  if (ms >= 900_000) return 'warning';
  return 'neutral';
}

export function runDot(run: ControllerRun, now: number): 'grey' | 'green' | 'amber' | 'red' {
  if (!run.inFlight) return 'grey';
  const base = run.lastActivity ?? run.stepStarted;
  if (!base) return 'grey';
  const age = now - Date.parse(base);
  if (age >= 900_000) return 'red';
  if (age >= 300_000) return 'amber';
  return 'green';
}

/** The question id a drive-crash wait carries; a hand copy of src/controller/waits.ts:193. */
const DRIVE_CRASH_QUESTION = 'drive-crash';

export function isStalled(run: ControllerRun, waits: ControllerWait[]): boolean {
  if (run.status === 'running' && !run.driven) return true;
  if (run.status === 'waiting' && !run.driven) {
    return waits.some((w) => (
      w.run === run.id && w.state === 'open' && w.questions.some((q) => q.id === DRIVE_CRASH_QUESTION)
    ));
  }
  return false;
}

export function runControls(
  run: ControllerRun,
  waits: ControllerWait[],
): { pause: boolean; resume: boolean; stop: boolean; discard: boolean; redrive: boolean } {
  const moving = MOVING_STATUSES.has(run.status);
  const resume = isOperatorHeld(run) || (run.status === 'paused' && run.holdBy !== 'deploy');
  return {
    pause: moving && !resume,
    resume,
    stop: moving,
    discard: !moving && Boolean(run.discardAllowed),
    redrive: isStalled(run, waits),
  };
}

export function mergeRead(wait: ControllerWait, runs: ControllerRun[]): ControllerPrRead | null {
  const run = runs.find((r) => r.id === wait.run);
  if (!run) return null;
  const questionId = wait.questions[0]?.id ?? '';
  if (questionId === 'merge') {
    return run.prReads?.find((read) => read.kind === 'run') ?? null;
  }
  const match = /^merge:(.+)#(\d+)$/.exec(questionId);
  if (!match) return null;
  const [, repo, number] = match;
  return run.prReads?.find((read) => read.repo === repo && read.number === Number(number)) ?? null;
}

/** One-line summary of a controller wait. */
export function waitSummary(wait: ControllerWait): string {
  const q0 = wait.questions[0]?.text;
  switch (wait.kind) {
    case 'gate-a': return `Gate A — ${wait.questions.length} decision(s)`;
    case 'gate-b': return `Gate B — ${wait.questions.length} item(s)`;
    case 'retro-plan': return `Retro plan — ${wait.proposals?.length ?? 0} proposal(s)`;
    case 'merge': return q0 ?? 'Ready to merge';
    case 'escalation': return q0 ?? 'A reviewer escalated';
    case 'error': return q0 ?? 'A step needs a decision';
    case 'question': return q0 ?? 'A step needs one fact';
    default: return q0 ?? '';
  }
}

export function setupLine(view: SetupView): string {
  return `supervisor ${view.supervisor.model} · ${view.roles.length} roles · worktree ${view.worktree} · gates record`;
}

export function compactAge(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    return `${days}d${totalHours % 24}h`;
  }
  if (totalHours >= 1) {
    return `${totalHours}h${totalMinutes % 60}m`;
  }
  return `${totalMinutes}m`;
}

export function tabTitle(
  waits: ControllerWait[],
  enabled: (projectId: string) => boolean,
  now: number,
  base: string,
): string {
  const open = waits.filter((wait) => wait.state === 'open' && enabled(wait.project));
  if (open.length === 0) return base;
  const oldest = Math.min(...open.map((wait) => Date.parse(wait.created)));
  return `${open.length} · ${compactAge(now - oldest)}`;
}
