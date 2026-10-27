// src/advisor/tallies.ts
//
// Tallies the advisor judges without recounting (design.md C5; requirements.md
// Requirement 3). Reads every known project's `specs/*/harness-events.jsonl`
// and `specs/*/retrospective.md` (via readProjects(), src/controller/state.ts)
// plus the home `events.jsonl`, bucketed by ISO week.
import { readFileSync, readdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { readProjects } from '../controller/state.js';
import { parseJsonl } from '../watch/ledger.js';
import { PathUtils } from '../core/path-utils.js';
import { scrubbedGitEnv } from '../core/git-utils.js';
import { eventsPath } from './home.js';
import type { HomeEvent } from './home.js';

export interface Tallies {
  weeks: Record<string, {
    tokens: { byAgent: Record<string, number>; bySpec: Record<string, number> };
    failures: Record<string, number>;
    findings: Record<string, number>;
    floor: Partial<Record<'tokens' | 'failures' | 'findings', true>>;
  }>;
}

type Week = Tallies['weeks'][string];

/** The step runner's own classifications (src/controller/step.ts:71-77); `ok` is never a failure. */
const STEP_CLASSIFICATIONS = new Set(['turn-cap', 'usage-limit', 'login-expired', 'schema-invalid', 'error']);

function emptyWeek(): Week {
  return { tokens: { byAgent: {}, bySpec: {} }, failures: {}, findings: {}, floor: {} };
}

function weekOf(tallies: Tallies, ts: string): Week {
  const key = isoWeekKey(new Date(ts));
  let week = tallies.weeks[key];
  if (!week) {
    week = emptyWeek();
    tallies.weeks[key] = week;
  }
  return week;
}

/** ISO 8601 week key (`2026-W43`): Thursday of the row's week picks the ISO year. */
function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

function inRange(ts: string | undefined, from: string, to: string): boolean {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return t >= new Date(from).getTime() && t <= new Date(to).getTime();
}

function addTokens(week: Week, agent: string | undefined, spec: string, tokens: string | undefined): void {
  if (tokens === undefined || tokens === 'unknown') {
    week.floor.tokens = true;
    return;
  }
  const n = Number(tokens);
  if (agent) week.tokens.byAgent[agent] = (week.tokens.byAgent[agent] ?? 0) + n;
  week.tokens.bySpec[spec] = (week.tokens.bySpec[spec] ?? 0) + n;
}

function addFailure(week: Week, result: string | undefined): void {
  if (result === undefined) {
    week.floor.failures = true;
    week.failures.unknown = (week.failures.unknown ?? 0) + 1;
    return;
  }
  if (result === 'ok') return;
  const bucket = STEP_CLASSIFICATIONS.has(result) ? result : 'unknown';
  week.failures[bucket] = (week.failures[bucket] ?? 0) + 1;
}

function readLedgerRows(specDir: string, spec: string, from: string, to: string, tallies: Tallies): void {
  let text: string;
  try {
    text = readFileSync(join(specDir, 'harness-events.jsonl'), 'utf-8');
  } catch {
    return;
  }
  for (const row of parseJsonl<Record<string, string>>(text)) {
    if (!inRange(row.ts, from, to)) continue;
    if (row.type === 'spawn.end') {
      addTokens(weekOf(tallies, row.ts), row.agent, spec, row.tokens);
    } else if (row.type === 'spawn.usage') {
      addFailure(weekOf(tallies, row.ts), row.result);
    }
  }
}

/** The file's last commit date (`git log -1 --format=%cI`), or undefined outside a repo / unknown. */
export function lastCommitDate(root: string, relPath: string): string | undefined {
  try {
    const out = execFileSync('git', ['-C', root, 'log', '-1', '--format=%cI', '--', relPath], {
      encoding: 'utf-8',
      env: scrubbedGitEnv(),
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

function readFindings(projectRoot: string, specDir: string, spec: string, from: string, to: string, tallies: Tallies): void {
  let text: string;
  try {
    text = readFileSync(join(specDir, 'retrospective.md'), 'utf-8');
  } catch {
    return;
  }
  const relPath = join('.spec-workflow', 'specs', spec, 'retrospective.md');
  const ts = lastCommitDate(projectRoot, relPath);
  if (!inRange(ts, from, to)) return;
  const week = weekOf(tallies, ts!);
  let heading: string | undefined;
  for (const line of text.split('\n')) {
    const h = line.match(/^## (.+)/);
    if (h) {
      heading = h[1].trim();
      continue;
    }
    if (/^- \*\*F/.test(line)) {
      if (heading === undefined) {
        week.floor.findings = true;
        continue;
      }
      week.findings[heading] = (week.findings[heading] ?? 0) + 1;
    }
  }
}

function readHomeEvents(from: string, to: string, tallies: Tallies): void {
  let text: string;
  try {
    text = readFileSync(eventsPath(), 'utf-8');
  } catch {
    return;
  }
  for (const row of parseJsonl<HomeEvent>(text)) {
    if (row.type !== 'advisor.opinion' || !inRange(row.ts, from, to)) continue;
    const week = weekOf(tallies, row.ts);
    const n = row.input + row.output + row.cacheRead + row.cacheWrite5m + row.cacheWrite1h;
    week.tokens.byAgent['sdd-advisor'] = (week.tokens.byAgent['sdd-advisor'] ?? 0) + n;
  }
}

/** Spec-directory names under one project's `.spec-workflow/specs`; a missing directory gives []. */
function listSpecs(projectRoot: string): string[] {
  try {
    return readdirSync(join(PathUtils.getWorkflowRoot(projectRoot), 'specs'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

/** Tallies the advisor judges without recounting (design.md C5). */
export async function buildTallies(q: { from: string; to: string; project?: string }): Promise<Tallies> {
  const tallies: Tallies = { weeks: {} };
  const { projects } = await readProjects();
  for (const project of projects) {
    if (q.project && project.id !== q.project && project.name !== q.project) continue;
    for (const spec of listSpecs(project.workflowRootPath)) {
      const specDir = PathUtils.getSpecPath(project.workflowRootPath, spec);
      readLedgerRows(specDir, spec, q.from, q.to, tallies);
      readFindings(project.workflowRootPath, specDir, spec, q.from, q.to, tallies);
    }
  }
  readHomeEvents(q.from, q.to, tallies);
  return tallies;
}
