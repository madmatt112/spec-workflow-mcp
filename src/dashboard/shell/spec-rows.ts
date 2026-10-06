// src/dashboard/shell/spec-rows.ts
//
// The Specs page rows and one spec's detail panel (design.md C5, Requirement 5).
// `buildSpecRows` returns one row per spec of a project with its harness state;
// `buildSpecDetail` returns one spec's panel data — paths, runs, phases and
// deferrals, but never any file content (Requirement 5 AC 5, D9). Every file read
// goes through the task-1 FileCache, so a missing, empty or torn file yields a
// null or empty field and never throws.
import { readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { buildModel, parseHandoffPhaseRows } from '../../watch/ledger.js';
import type { LedgerEvent } from '../../watch/ledger.js';
import { handoffPath } from '../../watch/index.js';
import { IndexGenerator } from '../../core/index-generator.js';
import { DeferralStorage } from '../../core/deferral-storage.js';
import type { ProjectContext } from '../project-manager.js';
import type { PointerLine } from '../harness/types.js';
import type { SpecListRow, SpecDetail } from './types.js';
import { FileCache } from './file-cache.js';
import { pointerForProject } from './waits.js';

const SPEC_NAME_RE = /^[A-Za-z0-9._-]+$/;
const VERSION_RE = /^v\d+$/;

/** Milliseconds of a date/time string; a missing or unparsable value is -Infinity. */
function timeOf(value: string | undefined): number {
  if (!value) return -Infinity;
  const n = Date.parse(value);
  return Number.isNaN(n) ? -Infinity : n;
}

/** The item with the newest `dateOf`, or undefined for an empty list. */
function newestBy<T>(items: T[], dateOf: (t: T) => string | undefined): T | undefined {
  let best: T | undefined;
  let bestT = -Infinity;
  for (const it of items) {
    const t = timeOf(dateOf(it));
    if (best === undefined || t >= bestT) {
      best = it;
      bestT = t;
    }
  }
  return best;
}

/** The later of two optional date strings, or null when neither parses. */
function pickNewer(a: string | undefined, b: string | undefined): string | null {
  const ta = timeOf(a);
  const tb = timeOf(b);
  if (ta === -Infinity && tb === -Infinity) return null;
  return ta >= tb ? (a ?? null) : (b ?? null);
}

/** The value of the first `Status:` line of a plan, or null. */
function firstStatusValue(text: string | undefined): string | null {
  if (!text) return null;
  for (const line of text.split('\n')) {
    const m = line.match(/Status:\s*\**\s*(.+?)\s*$/);
    if (m) return m[1];
  }
  return null;
}

/**
 * One row per snapshot spec (every spec directory) with its harness state
 * (design.md C5). State precedence is first-match (D10): `live`, `closed`,
 * `deferred`, `not-started`, else `in-progress`.
 */
export async function buildSpecRows(
  project: ProjectContext,
  pointers: PointerLine[],
  cache: FileCache = new FileCache(),
): Promise<SpecListRow[]> {
  const { projectId, projectName } = project;
  const workflowRoot = join(project.projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');
  const handoffMd = cache.text(handoffPath(workflowRoot));
  const pointer = pointerForProject(project, pointers);
  const livePointerSpec = pointer ? basename(pointer.specDir) : null;
  const deferralStorage = new DeferralStorage(project.projectPath);

  const { active, deferred, other } = await new IndexGenerator(project.projectPath).snapshot();
  const entries = [...active, ...deferred, ...other];

  const rows: SpecListRow[] = [];
  for (const entry of entries) {
    const spec = entry.name;
    const specDir = join(specsDir, spec);
    const phaseRows = parseHandoffPhaseRows(handoffMd, spec);
    const ledger = cache.jsonl<LedgerEvent>(join(specDir, 'harness-events.jsonl'));
    const model = buildModel({ spec, ledger, activity: [] });
    const retroText = cache.text(join(specDir, 'retrospective-plan.md'));
    const statusValue = firstStatusValue(retroText);

    // state — first match wins (D10).
    const closedByRow = phaseRows.some((r) => r.phase === 'closeout' && r.result === 'closed');
    const closedByPlan = (statusValue ?? '').split(/\s+/)[0] === 'CLOSED';
    const hasDocOrLedger = ['requirements.md', 'design.md', 'tasks.md', 'harness-events.jsonl'].some(
      (f) => cache.text(join(specDir, f)) !== undefined,
    );
    let state: SpecListRow['state'];
    if (livePointerSpec === spec) state = 'live';
    else if (closedByRow || closedByPlan) state = 'closed';
    else if (entry.deferred) state = 'deferred';
    else if (!hasDocOrLedger) state = 'not-started';
    else state = 'in-progress';

    // phase — live phase, else newest phase-log stage, else the entry's currentPhase.
    const phase = model.livePhase?.phase || newestBy(phaseRows, (r) => r.date)?.phase || entry.currentPhase || null;

    // versions — per document phase, the newest v-plus-digits phase-log State, else null.
    const versionOf = (docPhase: string): string | null => {
      const matching = phaseRows.filter((r) => r.phase === docPhase && VERSION_RE.test(r.state));
      return newestBy(matching, (r) => r.date)?.state ?? null;
    };
    const versions = {
      requirements: versionOf('requirements'),
      design: versionOf('design'),
      tasks: versionOf('tasks'),
    };

    // prs — distinct PR numbers in phase-log notes, ascending.
    const prNums = new Set<number>();
    for (const r of phaseRows) {
      for (const m of r.note.matchAll(/PR #(\d+)/g)) prNums.add(Number(m[1]));
    }
    const prs = [...prNums].sort((a, b) => a - b);

    // retro — the first word of the plan's Status value, else null.
    const retro = statusValue ? statusValue.split(/\s+/)[0] : null;

    // updated — the newer of the newest ledger ts and the newest phase-log date, else null.
    let newestLedgerTs: string | undefined;
    for (const e of ledger) {
      if (newestLedgerTs === undefined || timeOf(e.ts) > timeOf(newestLedgerTs)) newestLedgerTs = e.ts;
    }
    const updated = pickNewer(newestLedgerTs, newestBy(phaseRows, (r) => r.date)?.date);

    const deferrals = (await deferralStorage.list({ status: 'deferred', originSpec: spec })).length;

    rows.push({
      projectId,
      projectName,
      spec,
      state,
      phase,
      versions,
      tasks: { done: entry.taskProgress.completed, total: entry.taskProgress.total },
      prs,
      deferrals,
      retro,
      updated,
    });
  }
  return rows;
}

/** `order` and `dependsOn` from the decomposition entry that names the spec in backticks. */
function parseDecomposition(text: string | undefined, spec: string): { order: number | null; dependsOn: string | null } {
  if (!text) return { order: null, dependsOn: null };
  const lines = text.split('\n');
  const token = '`' + spec + '`';
  let headingIdx = -1;
  let order: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^###\s+(\d+)\.\s/);
    if (m && lines[i].includes(token)) {
      order = Number(m[1]);
      headingIdx = i;
      break;
    }
  }
  if (headingIdx === -1) return { order: null, dependsOn: null };

  let dependsOn: string | null = null;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^###\s/.test(lines[i])) break;
    if (lines[i].trimStart().startsWith('**Depends on**')) {
      const para: string[] = [];
      for (let j = i; j < lines.length && lines[j].trim() !== '' && !/^###\s/.test(lines[j]); j++) {
        para.push(lines[j].trim());
      }
      dependsOn = para.join(' ').replace(/^\*\*Depends on\*\*\s*/, '').trim();
      break;
    }
  }
  return { order, dependsOn };
}

/** One run row per `run.start`, with end/status from its `run.end` and tokens from `buildModel` over only that run's rows. */
function buildRuns(spec: string, ledger: LedgerEvent[]): SpecDetail['runs'] {
  const runs: SpecDetail['runs'] = [];
  for (const e of ledger) {
    if (e.type !== 'run.start' || !e.run) continue;
    const runId = e.run;
    const rows = ledger.filter((ev) => ev.run === runId);
    const runEnd = rows.find((ev) => ev.type === 'run.end');
    const model = buildModel({ spec, ledger: rows, activity: [] });
    runs.push({
      runId,
      start: e.ts,
      end: runEnd?.ts ?? null,
      status: runEnd?.status ?? null,
      tokens: model.tokensTotal,
    });
  }
  return runs;
}

/** Top-level regular files of a spec directory with `path` built on the original workflow root. */
function listTopLevelFiles(specDir: string, workflowRootPath: string, spec: string): SpecDetail['files'] {
  let dirents;
  try {
    dirents = readdirSync(specDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files: SpecDetail['files'] = [];
  for (const d of dirents) {
    if (!d.isFile()) continue;
    let st;
    try {
      st = statSync(join(specDir, d.name));
    } catch {
      continue;
    }
    files.push({
      name: d.name,
      path: join(workflowRootPath, '.spec-workflow', 'specs', spec, d.name),
      size: st.size,
      modified: st.mtime.toISOString(),
    });
  }
  return files;
}

/**
 * One spec's detail panel (design.md C5). Null when `spec` fails the name regex,
 * is `.`/`..`, or is no directory under the specs directory. File paths are built
 * on the original `workflowRootPath`; no file content leaves the server.
 */
export async function buildSpecDetail(project: ProjectContext, spec: string): Promise<SpecDetail | null> {
  if (!SPEC_NAME_RE.test(spec) || spec === '.' || spec === '..') return null;
  const workflowRoot = join(project.projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');
  const specDir = join(specsDir, spec);
  try {
    if (!statSync(specDir).isDirectory()) return null;
  } catch {
    return null;
  }

  const cache = new FileCache();
  const decompText = cache.text(join(workflowRoot, 'spec-decomposition', 'decomposition.md'));
  const { order, dependsOn } = parseDecomposition(decompText, spec);

  const ledger = cache.jsonl<LedgerEvent>(join(specDir, 'harness-events.jsonl'));
  const runs = buildRuns(spec, ledger);

  const phases = parseHandoffPhaseRows(cache.text(handoffPath(workflowRoot)), spec);

  const records = await new DeferralStorage(project.projectPath).list({ originSpec: spec });
  const deferrals = records.map((r) => ({ id: r.id, title: r.title, status: r.status }));

  const files = listTopLevelFiles(specDir, project.workflowRootPath, spec);

  return { order, dependsOn, runs, phases, deferrals, files };
}
