// src/dashboard/shell/now-model.ts
//
// The Now page model over every registered project (design.md C4, Requirement 3
// and the Requirement 4 AC 1 list). One builder feeds the Now page groups, the
// Runs list and the Launch card state. Every file read goes through the task-1
// FileCache and the task-2 wait functions, so a missing, empty or torn file
// yields no row and never throws. A project whose read throws is left out of
// every group and logged once; one bad project never hides the others.
import { readdirSync } from 'fs';
import { join, basename } from 'path';
import { buildModel, parseJsonl, parseHandoffPhaseRows } from '../../watch/ledger.js';
import type { LedgerEvent, RunModel } from '../../watch/ledger.js';
import { handoffPath, resolveSpec } from '../../watch/index.js';
import { IndexGenerator } from '../../core/index-generator.js';
import type { ProjectContext } from '../project-manager.js';
import type { LaunchRecord, PointerLine } from '../harness/types.js';
import type { Wait, NowModel, LiveRunRow, IdleRow, ClosedRow, RunListRow } from './types.js';
import { FileCache } from './file-cache.js';
import { pointerForProject, deriveProjectWaits, orderWaits } from './waits.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds of a timestamp; a missing or unparsable value sorts first (0). */
function ms(ts: string | undefined): number {
  const n = ts ? new Date(ts).getTime() : NaN;
  return Number.isNaN(n) ? 0 : n;
}

/** Spec-directory names under a specs directory; a missing directory gives []. */
function listSpecDirs(specsDir: string): string[] {
  try {
    return readdirSync(specsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return [];
  }
}

/**
 * The live row's one-line detail: the newest open level-2 spawn's agent with
 * `round N` or `task N`, else `waits on gate A`/`B` when the project has a gate
 * wait, else the live phase (design.md C4; Requirement 3.3, 2.7, 2.8).
 */
function liveDetail(model: RunModel, projWaits: Wait[]): string {
  const open = model.spawns.filter((s) => !s.endedAt && s.level === 2);
  if (open.length) {
    const newest = open.reduce((a, b) => (ms(b.startedAt) >= ms(a.startedAt) ? b : a));
    if (newest.round) return `${newest.agent} round ${newest.round}`;
    if (newest.task) return `${newest.agent} task ${newest.task}`;
    return newest.agent;
  }
  const gate = projWaits.find((w) => w.kind === 'gate');
  if (gate && gate.detail.kind === 'gate') return `waits on gate ${gate.detail.gate}`;
  return model.livePhase?.phase ?? '';
}

/** The phase of the newest ledger `phase.end`, or null when there is none. */
function newestPhaseEnd(ledger: LedgerEvent[]): string | null {
  let best: LedgerEvent | undefined;
  for (const e of ledger) {
    if (e.type !== 'phase.end') continue;
    if (!best || ms(e.ts) >= ms(best.ts)) best = e;
  }
  return best?.phase ?? null;
}

/** True when a `YYYY-MM-DD` date is within 7 calendar days before `now`. */
function withinSevenDays(date: string | undefined, now: number): boolean {
  if (!date) return false;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return false;
  const d = new Date(now);
  const nowMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const ageDays = (nowMidnight - parsed) / DAY_MS;
  return ageDays >= 0 && ageDays <= 7;
}

interface ProjectResult {
  waits: Wait[];
  live: LiveRunRow | null;
  idle: IdleRow | null;
  closed: ClosedRow[];
  runs: RunListRow | null;
  launch: { state: LaunchRecord['state']; pid: number; runId: string | null } | null;
}

/**
 * Every group's contribution for one project. May throw (the injected `launchOf`
 * or a reader); the caller catches, logs once and omits the project. The result
 * is assembled whole, so a mid-way throw leaves nothing partially added.
 */
async function collectProject(
  project: ProjectContext,
  pointers: PointerLine[],
  launchOf: (projectId: string) => LaunchRecord | null,
  now: number,
  cache: FileCache,
): Promise<ProjectResult> {
  const { projectId, projectName } = project;
  const workflowRoot = join(project.projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');

  const pointer = pointerForProject(project, pointers);
  const launch = launchOf(projectId);
  const waits = deriveProjectWaits(project, pointer, launch, now, cache);

  // live — one row per project with a pointer line under its specs directory.
  let live: LiveRunRow | null = null;
  if (pointer) {
    const spec = basename(pointer.specDir);
    const ledger = cache.jsonl<LedgerEvent>(join(specsDir, spec, 'harness-events.jsonl'));
    const model = buildModel({ spec, ledger, activity: [] });
    live = {
      projectId,
      projectName,
      spec,
      runId: pointer.runId,
      phase: model.livePhase?.phase ?? null,
      detail: liveDetail(model, waits),
      tokens: model.tokensTotal,
      startedAt: model.runStartedAt ?? null,
    };
  }

  // idle — projects with no pointer; routing by the rule of run-setup.ts:167-168.
  let idle: IdleRow | null = null;
  if (!pointer) {
    const { routing } = await new IndexGenerator(project.projectPath).snapshot();
    idle = {
      projectId,
      projectName,
      launchable: routing.state === 'active' ? routing.spec : null,
      disabledReason: routing.state === 'active' ? null : routing.reason,
    };
  }

  // closed — specs whose HANDOFF phase log has a `closeout`/`closed` row within 7 days.
  const closed: ClosedRow[] = [];
  const handoffMd = cache.text(handoffPath(workflowRoot));
  for (const name of listSpecDirs(specsDir)) {
    const row = parseHandoffPhaseRows(handoffMd, name).find(
      (r) => r.phase === 'closeout' && r.result === 'closed' && withinSevenDays(r.date, now),
    );
    if (row?.date) closed.push({ projectId, projectName, spec: name, closedOn: row.date });
  }

  // runs — projects whose resolveSpec names a spec with a ledger (catch the throw and skip).
  let runs: RunListRow | null = null;
  let resolvedSpec: string | null = null;
  try {
    resolvedSpec = resolveSpec(workflowRoot);
  } catch {
    resolvedSpec = null;
  }
  if (resolvedSpec) {
    const ledgerPath = join(specsDir, resolvedSpec, 'harness-events.jsonl');
    const ledgerText = cache.text(ledgerPath);
    if (ledgerText !== undefined) {
      const ledger = parseJsonl<LedgerEvent>(ledgerText);
      const model = buildModel({ spec: resolvedSpec, ledger, activity: [] });
      const state: RunListRow['state'] = pointer
        ? 'live'
        : launch && launch.spec === resolvedSpec && (launch.state === 'stopped' || launch.state === 'exited')
          ? launch.state
          : 'ended';
      runs = {
        projectId,
        projectName,
        spec: resolvedSpec,
        runId: pointer?.runId ?? model.runId ?? null,
        state,
        phase: model.livePhase?.phase ?? newestPhaseEnd(ledger),
        since: model.runStartedAt ?? null,
      };
    }
  }

  const launchEntry = launch ? { state: launch.state, pid: launch.pid, runId: launch.runId } : null;

  return { waits, live, idle, closed, runs, launch: launchEntry };
}

/**
 * The Now model over every registered project (design.md C4). `waits` is
 * `orderWaits` over every project's waits; `live`, `idle`, `closed` and `runs`
 * are the design C4 groups; `launches[projectId]` is each project's launch
 * record state/pid/runId or null. Always uses the passed `now`, never
 * `Date.now()`. A project whose read throws is omitted from every group and
 * logged once with `console.error`.
 */
export async function buildNowModel(
  projects: ProjectContext[],
  pointers: PointerLine[],
  launchOf: (projectId: string) => LaunchRecord | null,
  now: number,
  cache: FileCache = new FileCache(),
): Promise<NowModel> {
  const waits: Wait[] = [];
  const live: LiveRunRow[] = [];
  const idle: IdleRow[] = [];
  const closed: ClosedRow[] = [];
  const runs: RunListRow[] = [];
  const launches: NowModel['launches'] = {};

  for (const project of projects) {
    try {
      const r = await collectProject(project, pointers, launchOf, now, cache);
      waits.push(...r.waits);
      if (r.live) live.push(r.live);
      if (r.idle) idle.push(r.idle);
      closed.push(...r.closed);
      if (r.runs) runs.push(r.runs);
      launches[project.projectId] = r.launch;
    } catch (err) {
      console.error(`buildNowModel: skipping project ${project.projectId}`, err);
    }
  }

  return {
    waits: orderWaits(waits),
    live,
    idle,
    closed,
    runs,
    launches,
    generatedAt: new Date(now).toISOString(),
  };
}
