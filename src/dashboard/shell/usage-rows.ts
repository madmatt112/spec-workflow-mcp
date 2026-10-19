// src/dashboard/shell/usage-rows.ts
//
// One Usage-page row per closed spec of a project (design.md C9, Requirement 3).
// `buildUsageRows` walks the IndexGenerator snapshot as `buildSpecRows` does and
// keeps each entry `isSpecClosed` returns true for, computing W, W per task and
// the baseline percentage. Every ledger and HANDOFF read goes through the
// FileCache, so a missing, empty or torn file yields a null or empty field and
// never throws (NFR Reliability). It writes nothing.
import { join } from 'path';
import { parseHandoffPhaseRows } from '../../watch/ledger.js';
import type { LedgerEvent } from '../../watch/ledger.js';
import { handoffPath } from '../../watch/index.js';
import { buildUsageReport } from '../../watch/usage.js';
import { IndexGenerator } from '../../core/index-generator.js';
import { readAgentRules } from '../harness/run-setup.js';
import type { ProjectContext } from '../project-manager.js';
import type { UsageSpecRow } from './types.js';
import { FileCache } from './file-cache.js';
import { isSpecClosed } from './spec-rows.js';

/** Milliseconds of a date/time string; a missing or unparsable value is -Infinity. */
function timeOf(value: string | undefined): number {
  if (!value) return -Infinity;
  const n = Date.parse(value);
  return Number.isNaN(n) ? -Infinity : n;
}

/**
 * One row per closed spec of `project` (design.md C9). Walks the snapshot as
 * `buildSpecRows` does (`src/dashboard/shell/spec-rows.ts:72-86`) and keeps each
 * entry where `isSpecClosed` is true.
 */
export async function buildUsageRows(
  project: ProjectContext,
  cache: FileCache = new FileCache(),
): Promise<UsageSpecRow[]> {
  const { projectId, projectName } = project;
  const workflowRoot = join(project.projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');
  const handoffMd = cache.text(handoffPath(workflowRoot));
  const baseline = readAgentRules(workflowRoot).baselineWPerTask ?? null;

  const { active, deferred, other } = await new IndexGenerator(project.projectPath).snapshot();
  const entries = [...active, ...deferred, ...other];

  const rows: UsageSpecRow[] = [];
  for (const entry of entries) {
    const spec = entry.name;
    const specDir = join(specsDir, spec);
    const phaseRows = parseHandoffPhaseRows(handoffMd, spec);
    const retroText = cache.text(join(specDir, 'retrospective-plan.md'));
    if (!isSpecClosed(phaseRows, retroText)) continue;

    const ledger = cache.jsonl<LedgerEvent>(join(specDir, 'harness-events.jsonl'));

    // closeDate: the newest closeout/closed row date, else the newest ledger ts, else null.
    let closeDate: string | null = null;
    let bestT = -Infinity;
    for (const r of phaseRows) {
      if (r.phase !== 'closeout' || r.result !== 'closed') continue;
      const t = timeOf(r.date);
      if (t >= bestT) { bestT = t; closeDate = r.date ?? null; }
    }
    if (closeDate === null) {
      let newestTs = -Infinity;
      for (const e of ledger) {
        const t = timeOf(e.ts);
        if (t >= newestTs) { newestTs = t; closeDate = e.ts ?? null; }
      }
      if (newestTs === -Infinity) closeDate = null;
    }

    const report = buildUsageReport(ledger, spec);
    const w = report.total.spawns - report.total.wUnknown > 0 ? report.total.w : null;
    const wUnknown = report.total.wUnknown;
    const tasks = entry.taskProgress.total;
    const wPerTask = w !== null && tasks > 0 ? w / tasks : null;
    const pctOfBaseline =
      wPerTask !== null && baseline !== null && baseline > 0 ? (wPerTask / baseline) * 100 : null;

    rows.push({ projectId, projectName, spec, closeDate, w, wUnknown, tasks, wPerTask, baseline, pctOfBaseline });
  }
  return rows;
}
