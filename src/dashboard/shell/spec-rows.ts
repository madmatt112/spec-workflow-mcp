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
import type { LedgerEvent, PhaseRow } from '../../watch/ledger.js';
import { handoffPath } from '../../watch/index.js';
import { IndexGenerator } from '../../core/index-generator.js';
import { DeferralStorage } from '../../core/deferral-storage.js';
import type { SpecIndexEntry } from '../../types.js';
import type { ProjectContext } from '../project-manager.js';
import type { RunRecord } from '../../controller/state.js';
import { decompositionHeadings, launchableSpec } from '../harness/run-setup.js';
import type { SpecListRow, SpecDetail, SpecWord, SpecLine, SpecBlock } from './types.js';
import { FileCache } from './file-cache.js';

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
 * True when the ledger's newest run ended `abandoned`: its last `run.start` has a
 * `run.end` row with status `abandoned` and no later run started.
 */
export function newestRunAbandoned(ledger: LedgerEvent[]): boolean {
  const starts = ledger.filter((e) => e.type === 'run.start' && e.run);
  const newest = starts[starts.length - 1]?.run;
  if (!newest) return false;
  return ledger.some((e) => e.type === 'run.end' && e.run === newest && e.status === 'abandoned');
}

/**
 * The one closed-spec rule for the Specs page and the usage rows (design D15):
 * true when a phase-log row has phase `closeout` and result `closed`, or when
 * the first word of the plan's first `Status:` value is `CLOSED`.
 */
export function isSpecClosed(phaseRows: PhaseRow[], planText: string | undefined): boolean {
  const closedByRow = phaseRows.some((r) => r.phase === 'closeout' && r.result === 'closed');
  const closedByPlan = (firstStatusValue(planText) ?? '').split(/\s+/)[0] === 'CLOSED';
  return closedByRow || closedByPlan;
}

/**
 * One row per snapshot spec (every spec directory) with its harness state
 * (design.md C5). State precedence is first-match (D10): `live`, `closed`,
 * `deferred`, `not-started`, `abandoned` (the newest run ended abandoned), else
 * `in-progress`.
 */
export async function buildSpecRows(
  project: ProjectContext,
  liveSpec: string | null,
  cache: FileCache = new FileCache(),
): Promise<SpecListRow[]> {
  const { projectId, projectName } = project;
  const workflowRoot = join(project.projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');
  const handoffMd = cache.text(handoffPath(workflowRoot));
  const deferralStorage = new DeferralStorage(project.projectPath);

  const { active, deferred, other } = await new IndexGenerator(project.projectPath).snapshot();
  const entries = [...active, ...deferred, ...other];

  // Count the project's deferred records per origin spec with one scan of the
  // deferrals store. A per-spec `list({ originSpec })` in the loop below re-reads
  // and re-parses every deferral file once for each spec, which dominates the
  // shell-feed flush on a project with many specs.
  const deferredByOriginSpec = new Map<string, number>();
  for (const d of await deferralStorage.list({ status: 'deferred' })) {
    if (d.originSpec) deferredByOriginSpec.set(d.originSpec, (deferredByOriginSpec.get(d.originSpec) ?? 0) + 1);
  }

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
    const hasDocOrLedger = ['requirements.md', 'design.md', 'tasks.md', 'harness-events.jsonl'].some(
      (f) => cache.text(join(specDir, f)) !== undefined,
    );
    let state: SpecListRow['state'];
    if (liveSpec === spec) state = 'live';
    else if (isSpecClosed(phaseRows, retroText)) state = 'closed';
    else if (entry.deferred) state = 'deferred';
    else if (!hasDocOrLedger) state = 'not-started';
    else if (newestRunAbandoned(ledger)) state = 'abandoned';
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

    const deferrals = deferredByOriginSpec.get(spec) ?? 0;

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

/** True when the spec directory holds a document or a ledger (design C3's stopped bullet). */
function hasDocOrLedger(cache: FileCache, specDir: string): boolean {
  return ['requirements.md', 'design.md', 'tasks.md', 'harness-events.jsonl'].some(
    (f) => cache.text(join(specDir, f)) !== undefined,
  );
}

/**
 * The decomposition heading line for `spec` through, but not including, the
 * next `### ` line, else `''` — the same boundaries as `decompositionEntry`
 * (`src/dashboard/harness/run-setup.ts:276-291`), computed over the already
 * cached `decomposition.md` lines instead of reading the file again.
 */
function decompositionEntryText(lines: string[], spec: string): string {
  const headingRe = /^###\s+\d+\.\s+`([\w.-]+)`/;
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = headingRe.exec(lines[i]);
    if (m && m[1] === spec) { start = i; break; }
  }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^###\s/.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

/**
 * One Specs block per store (design.md C3, Requirements 1 and 2): one line per
 * `decomposition.md` heading, in file order, with the first-match word (D1)
 * `live`, `closed`, `deferred`, `next`, `stopped` or `not started`, and the
 * matching fact. `liveRuns` holds the live run of every project of the store
 * (D24): the live rule matches on `run.spec` only. An unnamed spec directory
 * gives no line (D4); no `decomposition.md` gives `lines: []`.
 */
export async function buildSpecBlock(
  project: ProjectContext,
  liveRuns: RunRecord[],
  cache: FileCache = new FileCache(),
): Promise<SpecBlock> {
  const { projectId, projectName, projectPath } = project;
  const workflowRoot = join(projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');

  const decompText = cache.text(join(workflowRoot, 'spec-decomposition', 'decomposition.md'));
  const headings = decompText ? decompositionHeadings(decompText) : [];
  if (headings.length === 0) return { projectId, projectName, lines: [] };
  const decompLines = decompText!.split('\n');

  const handoffMd = cache.text(handoffPath(workflowRoot));
  const { active, deferred, other, routing } = await new IndexGenerator(projectPath).snapshot();
  const entries = new Map<string, SpecIndexEntry>();
  for (const e of [...active, ...deferred, ...other]) entries.set(e.name, e);

  const deferredRecords = await new DeferralStorage(projectPath).list({ status: 'deferred' });
  const next = launchableSpec(routing, workflowRoot, decompText);

  const lines: SpecLine[] = [];
  for (const heading of headings) {
    const { spec } = heading;
    const entry = entries.get(spec);
    const specDir = join(specsDir, spec);
    const phaseRows = parseHandoffPhaseRows(handoffMd, spec);

    const liveRun = liveRuns.find((r) => r.spec === spec);
    let word: SpecWord;
    let fact: string | null;

    if (liveRun) {
      word = 'live';
      let base = liveRun.phase || liveRun.status;
      if (liveRun.phase === 'implementation' && entry) {
        base = `${base} ${entry.taskProgress.completed}/${entry.taskProgress.total}`;
      }
      if (liveRun.status !== 'running') {
        base = `${base} · ${liveRun.status}`;
      }
      fact = base;
    } else if (isSpecClosed(phaseRows, cache.text(join(specDir, 'retrospective-plan.md')))) {
      word = 'closed';
      const prNums = new Set<number>();
      for (const r of phaseRows) {
        for (const m of r.note.matchAll(/PR #(\d+)/g)) prNums.add(Number(m[1]));
      }
      const prs = [...prNums].sort((a, b) => a - b);
      fact = prs.length > 0 ? prs.map((n) => `#${n}`).join(' ') : 'no PR recorded';
    } else if (heading.deferredTag || entry?.deferred === true) {
      word = 'deferred';
      const record = deferredRecords.find((d) => d.originSpec === spec);
      if (record) {
        fact = record.id;
      } else {
        const m = decompositionEntryText(decompLines, spec).match(/d-[0-9a-f]{8}/);
        fact = m ? m[0] : 'no record';
      }
    } else if (spec === next) {
      word = 'next';
      fact = null;
    } else if (hasDocOrLedger(cache, specDir)) {
      word = 'stopped';
      fact = newestBy(phaseRows, (r) => r.date)?.phase ?? entry?.currentPhase ?? null;
    } else {
      word = 'not started';
      fact = null;
    }

    lines.push({ number: heading.number, spec, word, fact });
  }

  return { projectId, projectName, lines };
}
