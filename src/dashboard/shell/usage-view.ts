// src/dashboard/shell/usage-view.ts
//
// The server side of the Usage page (design.md C6, Requirements 4 and 5): the
// window, the burn and one fit per live run, computed in one place so the page
// is a pure render of what this returns. Every file read is guarded so a
// missing or torn file gives a null field, never a throw (NFR Reliability).
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { listRunsSync, readRateLimit, type RunRecord } from '../../controller/state.js';
import { readUsageLog, computeBurn, attributedUse } from '../../controller/usage-log.js';
import { totalW } from '../../controller/runs.js';
import { parseTaskProgress } from '../../core/task-parser.js';
import { parseJsonl, type LedgerEvent } from '../../watch/ledger.js';
import { liveRunsByProject } from './live-runs.js';
import type { ProjectContext } from '../project-manager.js';
import type { UsageView, UsageRunLine } from './types.js';

/** The distinct task ids a run's `task.done` ledger rows name (design D18). */
function tasksDoneByRun(specStore: string, spec: string, runId: string): number {
  const path = join(specStore, '.spec-workflow', 'specs', spec, 'harness-events.jsonl');
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return 0;
  }
  const done = new Set<string>();
  for (const e of parseJsonl<LedgerEvent>(text)) {
    if (e.type === 'task.done' && e.run === runId && e.task) done.add(e.task);
  }
  return done.size;
}

/** `total − completed` of the spec's `tasks.md`; null when it is missing or unreadable. */
function remainingTasks(specStore: string, spec: string): number | null {
  const path = join(specStore, '.spec-workflow', 'specs', spec, 'tasks.md');
  if (!existsSync(path)) return null;
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }
  const { total, completed } = parseTaskProgress(text);
  return total - completed;
}

export async function buildUsageView(projects: ProjectContext[], nowMs: number = Date.now()): Promise<UsageView> {
  const rateLimit = await readRateLimit();
  const window = rateLimit?.sevenDay ?? null;

  const lines = readUsageLog(nowMs);
  const burn = computeBurn(lines, nowMs);
  const newestUtilization = lines.length > 0 ? lines[lines.length - 1].sevenDay.utilization : null;
  const resetInFuture = window !== null && Date.parse(window.resetsAt) > nowMs;

  const liveRuns: RunRecord[] = [...liveRunsByProject(listRunsSync()).values()];
  const runs: UsageRunLine[] = liveRuns.map((run) => {
    const project = projects.find((p) => p.projectId === run.project);
    const line: UsageRunLine = {
      runId: run.id,
      projectId: run.project,
      projectName: project ? project.projectName : run.project,
      spec: run.spec,
      phase: run.phase ?? null,
      tokens: totalW(run.tokens),
      remaining: null,
      fit: null,
    };
    if (run.phase !== 'implementation') return line;

    line.remaining = remainingTasks(run.specStore, run.spec);
    const done = tasksDoneByRun(run.specStore, run.spec, run.id);
    const use = attributedUse(lines, run.id);
    if (done >= 1 && use > 0 && line.remaining !== null && resetInFuture && newestUtilization !== null) {
      const headroom = 1 - newestUtilization;
      line.fit = (use / done) * line.remaining <= headroom ? 'fits' : 'does-not-fit';
    }
    return line;
  });

  return { window, burn, runs };
}
