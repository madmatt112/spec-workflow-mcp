// src/dashboard/shell/spec-rows.ts
//
// The Specs page's blocks (design.md C3, Requirements 1 and 2). `buildSpecBlock`
// returns one Specs block per store, one line per decomposition heading, with a
// first-match harness-state word and fact. Every file read goes through the
// task-1 FileCache, so a missing, empty or torn file yields a null or empty
// field and never throws.
import { join } from 'path';
import { parseHandoffPhaseRows } from '../../watch/ledger.js';
import type { PhaseRow } from '../../watch/ledger.js';
import { handoffPath } from '../../watch/index.js';
import { IndexGenerator } from '../../core/index-generator.js';
import { DeferralStorage } from '../../core/deferral-storage.js';
import type { SpecIndexEntry } from '../../types.js';
import type { ProjectContext } from '../project-manager.js';
import type { RunRecord } from '../../controller/state.js';
import { decompositionHeadings, launchableSpec } from '../harness/run-setup.js';
import type { SpecWord, SpecLine, SpecBlock } from './types.js';
import { FileCache } from './file-cache.js';

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
 * The one closed-spec rule for the Specs page and the usage rows (design D15):
 * true when a phase-log row has phase `closeout` and result `closed`, or when
 * the first word of the plan's first `Status:` value is `CLOSED`.
 */
export function isSpecClosed(phaseRows: PhaseRow[], planText: string | undefined): boolean {
  const closedByRow = phaseRows.some((r) => r.phase === 'closeout' && r.result === 'closed');
  const closedByPlan = (firstStatusValue(planText) ?? '').split(/\s+/)[0] === 'CLOSED';
  return closedByRow || closedByPlan;
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
