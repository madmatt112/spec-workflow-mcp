// src/dashboard/shell/waits.ts
//
// Wait derivation from harness files only (design.md C3, Requirement 2). The
// three design C3 functions plus the pointer-matching helper the later shell
// modules share. Everything reads through the task-1 FileCache, so a missing,
// empty or torn file yields no wait and never throws (Requirement 2 AC 10).
// Nothing here edits or imports a writable export from src/watch/ or
// overview-watch (Requirement 8 AC 1 and 2); it only calls existing readers.
import { readdirSync } from 'fs';
import { join, basename, relative, isAbsolute } from 'path';
import { buildModel } from '../../watch/ledger.js';
import type { LedgerEvent, ActivityEvent } from '../../watch/ledger.js';
import { handoffPath } from '../../watch/index.js';
import { parseHandoffRouting, parseGateSections } from '../harness/project-watch.js';
import type { ProjectContext } from '../project-manager.js';
import type { LaunchRecord, PointerLine } from '../harness/types.js';
import type { Wait } from './types.js';
import { FileCache } from './file-cache.js';

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

/** Milliseconds of a timestamp; a missing or unparsable value sorts first (0). */
function ms(ts: string | undefined): number {
  const n = ts ? new Date(ts).getTime() : NaN;
  return Number.isNaN(n) ? 0 : n;
}

/**
 * True when `target` resolves inside `dir` (not equal, not an ancestor). Copied
 * from src/dashboard/harness/overview-watch.ts:44-48 (D9, Requirement 8 AC 2).
 */
function isInside(dir: string, target: string): boolean {
  const rel = relative(dir, target);
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * The first pointer line whose `specDir` resolves inside the project's
 * `.spec-workflow/specs` directory, or undefined. The rule of
 * src/dashboard/harness/overview-watch.ts:243-246, copied so the shell modules
 * share one matcher (D9, Requirement 8 AC 2).
 */
export function pointerForProject(project: ProjectContext, pointers: PointerLine[]): PointerLine | undefined {
  const specsDir = join(project.projectPath, '.spec-workflow', 'specs');
  return pointers.find((p) => isInside(specsDir, p.specDir));
}

/**
 * Among the rows of the last `run.start` (all rows when there is none, as
 * `buildModel` scopes, src/watch/ledger.ts:256-261), the newest `phase.end`
 * gives a `gate` for a `gate-a`/`gate-b` result or a `ruling` for `escalate`,
 * only with no later `phase.start` of that run; anything else is null. Pure.
 */
export function gateOrRuling(ledger: LedgerEvent[]): { kind: 'gate' | 'ruling'; row: LedgerEvent } | null {
  const sorted = [...ledger].sort((a, b) => ms(a.ts) - ms(b.ts));
  const runStart = [...sorted].reverse().find((e) => e.type === 'run.start');
  const runId = runStart?.run;
  const runEvents = runId ? sorted.filter((e) => e.run === runId) : sorted;

  let lastEndIdx = -1;
  for (let i = runEvents.length - 1; i >= 0; i--) {
    if (runEvents[i].type === 'phase.end') { lastEndIdx = i; break; }
  }
  if (lastEndIdx === -1) return null;
  for (let i = lastEndIdx + 1; i < runEvents.length; i++) {
    if (runEvents[i].type === 'phase.start') return null;
  }
  const result = runEvents[lastEndIdx].result;
  if (result === 'gate-a' || result === 'gate-b') return { kind: 'gate', row: runEvents[lastEndIdx] };
  if (result === 'escalate') return { kind: 'ruling', row: runEvents[lastEndIdx] };
  return null;
}

/** The `items` array of a gate JSON file, or null when it is missing or unparsable. */
function gateItems(cache: FileCache, path: string): { header: string; question: string; options: string[] }[] | null {
  const text = cache.text(path);
  if (text === undefined) return null;
  try {
    const parsed = JSON.parse(text) as { items?: unknown };
    return Array.isArray(parsed.items) ? (parsed.items as { header: string; question: string; options: string[] }[]) : null;
  } catch {
    return null;
  }
}

/** The retrospective plan is absent, or its first `Status:` value starts with `DRAFT`. */
function planDraftOrAbsent(cache: FileCache, path: string): boolean {
  const text = cache.text(path);
  if (text === undefined) return true;
  const m = text.match(/Status:\s*([^\n]*)/);
  return m ? m[1].trim().startsWith('DRAFT') : false;
}

/** The trimmed `DECISION NEEDED: yes` lines of a proposals file. */
function decisionLines(proposals: string): string[] {
  const out: string[] = [];
  for (const line of proposals.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.includes('DECISION NEEDED: yes')) out.push(trimmed);
  }
  return out;
}

/** A short English line per wait kind; the wording is free (D6, Requirement 3 AC 2). */
function summaryFor(detail: Wait['detail'], spec: string): string {
  switch (detail.kind) {
    case 'gate': return `${spec} waits on gate ${detail.gate}.`;
    case 'ruling': return `${spec} ${detail.phase} is ${detail.state} and needs a ruling.`;
    case 'retro': return `${spec} retrospective has ${detail.count} decision(s) to make.`;
    case 'exited': return `${spec} run exited.`;
    case 'quiet': return `${spec} has been quiet since ${detail.lastActivityAt}.`;
  }
}

/**
 * The five wait kinds for one project, from its harness files only (design.md
 * C3, Requirement 2). `gate`, `ruling` and `quiet` read the overview watch's
 * spec — the pointer spec when the pointer resolves inside this project, else
 * the HANDOFF active spec; `quiet` also needs a pointer. `retro` scans every
 * spec directory. `exited` reads the launch record (D7). A missing cache
 * argument means a fresh cache.
 */
export function deriveProjectWaits(
  project: ProjectContext,
  pointer: PointerLine | undefined,
  launch: LaunchRecord | null,
  now: number,
  cache: FileCache = new FileCache(),
): Wait[] {
  const waits: Wait[] = [];
  const { projectId, projectName } = project;
  const workflowRoot = join(project.projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');

  const validPointer = pointer && isInside(specsDir, pointer.specDir) ? pointer : undefined;
  const watchSpec = validPointer
    ? basename(validPointer.specDir)
    : parseHandoffRouting(cache.text(handoffPath(workflowRoot)))?.spec ?? null;

  const push = (kind: Wait['kind'], spec: string, since: string, detail: Wait['detail']): void => {
    waits.push({ kind, projectId, projectName, spec, since, summary: summaryFor(detail, spec), detail });
  };

  // gate / ruling / quiet — all read the watch spec's row ledger.
  if (watchSpec) {
    const specDir = join(specsDir, watchSpec);
    const ledger = cache.jsonl<LedgerEvent>(join(specDir, 'harness-events.jsonl'));

    const gr = gateOrRuling(ledger);
    if (gr?.kind === 'gate') {
      const gate: 'A' | 'B' = gr.row.result === 'gate-a' ? 'A' : 'B';
      const items = gateItems(cache, join(specDir, gate === 'A' ? 'gate-a.json' : 'gate-b.json'));
      const sections = parseGateSections(cache.text(join(specDir, 'questions.md')));
      const questions = gate === 'A' ? sections.gateA : sections.gateB;
      push('gate', watchSpec, gr.row.ts, { kind: 'gate', gate, items, questions });
    } else if (gr?.kind === 'ruling') {
      push('ruling', watchSpec, gr.row.ts, {
        kind: 'ruling', phase: gr.row.phase ?? '', state: gr.row.state ?? '', note: gr.row.note ?? '',
      });
    }

    if (validPointer) {
      const model = buildModel({ spec: watchSpec, ledger, activity: [] });
      const openSpawns = model.spawns.filter((s) => !s.endedAt);
      if (openSpawns.length) {
        const activityPath = join(specDir, 'harness-activity.jsonl');
        const mtimeMs = cache.mtimeMs(activityPath);
        if (mtimeMs !== null && now - mtimeMs > FIFTEEN_MIN_MS) {
          const newest = openSpawns.reduce((a, b) => (ms(b.startedAt) >= ms(a.startedAt) ? b : a));
          const toolRows = cache.jsonl<ActivityEvent>(activityPath)
            .filter((a) => a.agent === newest.agent && a.event === 'tool')
            .sort((a, b) => ms(a.ts) - ms(b.ts));
          const lastTool = toolRows.length ? toolRows[toolRows.length - 1].tool ?? null : null;
          const iso = new Date(mtimeMs).toISOString();
          push('quiet', watchSpec, iso, { kind: 'quiet', agent: newest.agent, lastTool, lastActivityAt: iso });
        }
      }
    }
  }

  // retro — every spec directory with proposals present and the plan absent or DRAFT.
  let names: string[] = [];
  try {
    names = readdirSync(specsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    names = [];
  }
  for (const name of names) {
    const dir = join(specsDir, name);
    const proposals = cache.text(join(dir, 'retrospective-proposals.md'));
    if (proposals === undefined) continue;
    if (!planDraftOrAbsent(cache, join(dir, 'retrospective-plan.md'))) continue;
    const mtimeMs = cache.mtimeMs(join(dir, 'retrospective-proposals.md'));
    if (mtimeMs === null) continue;
    const lines = decisionLines(proposals);
    push('retro', name, new Date(mtimeMs).toISOString(), { kind: 'retro', count: lines.length, lines });
  }

  // exited — the launch record exited and its run has no run.end in its spec ledger (D7).
  if (launch && launch.state === 'exited') {
    let hasRunEnd = false;
    if (launch.runId) {
      const ledger = cache.jsonl<LedgerEvent>(join(specsDir, launch.spec, 'harness-events.jsonl'));
      hasRunEnd = ledger.some((e) => e.type === 'run.end' && e.run === launch.runId);
    }
    if (launch.runId === null || !hasRunEnd) {
      push('exited', launch.spec, launch.endedAt ?? launch.launchedAt, {
        kind: 'exited', exitCode: launch.exitCode, signal: launch.signal, endedAt: launch.endedAt, logPath: launch.logPath,
      });
    }
  }

  return waits;
}

const KIND_ORDER: Record<Wait['kind'], number> = { gate: 0, ruling: 1, retro: 2, exited: 3, quiet: 4 };

/** Kinds in the order gate, ruling, retro, exited, quiet, then `since` ascending. */
export function orderWaits(waits: Wait[]): Wait[] {
  return [...waits].sort((a, b) => {
    const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    return k !== 0 ? k : ms(a.since) - ms(b.since);
  });
}
