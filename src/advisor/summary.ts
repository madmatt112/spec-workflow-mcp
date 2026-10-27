// src/advisor/summary.ts
//
// The hello summary (design.md C4; requirements.md Requirement 2, Requirement
// 8 AC 3, Requirement 10 AC 4, NFR Performance). Built from current files on
// every call, never from a cache: open waits, stuck runs, open PRs,
// owner-matthew deferrals, live runs, the two usage windows, this ISO week's
// tallies, sources and the push state. A project in `sources.json`
// `personalProjects` is left out of every section unless named in `include`;
// a project whose reads throw is dropped from every section and named once in
// `skipped` (the rule `src/dashboard/shell/now-model.ts:1-8` already follows).
import { promises as fs, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  listRuns,
  readProjects,
  readRateLimit,
  runStepsDir,
  type PrRead,
  type RateLimitFile,
} from '../controller/state.js';
import { listOpenWaits } from '../controller/waits.js';
import { DeferralStorage } from '../core/deferral-storage.js';
import { sourcesPath, pushConfigPath } from './home.js';
import { buildTallies, type Tallies } from './tallies.js';

type Week = Tallies['weeks'][string];

export interface AdvisorSummary {
  openWaits: { kind: string; project: string; spec: string; ageMins: number }[];
  stuckRuns: { id: string; project: string; reason: 'error' | 'running' }[];
  openPrs: { project: string; pr: number; verdict: string }[];
  deferrals: { project: string; title: string }[];
  liveRuns: { id: string; project: string; phase: string; stepKind?: string }[];
  windows: { fiveHour?: RateLimitFile['fiveHour']; sevenDay?: RateLimitFile['sevenDay'] };
  week: Week;
  sources: { name: string; about: string }[];
  push: 'on' | 'off';
  skipped: string[];
}

const LIST_CAP = 5;
const WORD_CAP = 400;
const STUCK_MINUTES = 15;

function emptyWeek(): Week {
  return { tokens: { byAgent: {}, bySpec: {} }, failures: {}, findings: {}, floor: {} };
}

/** Milliseconds on a run's newest `runStepsDir` file, or `undefined` when the dir is absent or empty. */
function newestStepMs(id: string): number | undefined {
  let names: string[];
  try {
    names = readdirSync(runStepsDir(id));
  } catch {
    return undefined;
  }
  let newest: number | undefined;
  for (const name of names) {
    try {
      const mtime = statSync(join(runStepsDir(id), name)).mtimeMs;
      if (newest === undefined || mtime > newest) newest = mtime;
    } catch {
      // Gone between readdir and stat: ignore.
    }
  }
  return newest;
}

/** `now`'s ISO-week Monday-to-Sunday range, in UTC. */
function isoWeekRange(now: Date): { from: string; to: string } {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 1);
  const from = d.toISOString();
  const to = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000 - 1).toISOString();
  return { from, to };
}

interface SourcesFileShape {
  sources?: { name: string; about: string }[];
  personalProjects?: string[];
}

async function readSourcesFile(): Promise<SourcesFileShape> {
  try {
    const raw = await fs.readFile(sourcesPath(), 'utf-8');
    return JSON.parse(raw) as SourcesFileShape;
  } catch {
    return {};
  }
}

async function pushState(): Promise<'on' | 'off'> {
  try {
    await fs.access(pushConfigPath());
    return 'on';
  } catch {
    return 'off';
  }
}

/** Build the hello summary fresh from current state (design.md C4). */
export async function buildSummary(opts: { include?: string[]; now?: Date } = {}): Promise<AdvisorSummary> {
  const now = opts.now ?? new Date();
  const include = opts.include ?? [];

  const { projects } = await readProjects();
  const sourcesFile = await readSourcesFile();
  const personalProjects = sourcesFile.personalProjects ?? [];

  const skipped: string[] = [];
  const excluded = new Set<string>();

  const deferrals: AdvisorSummary['deferrals'] = [];
  for (const project of projects) {
    const isPersonal = personalProjects.includes(project.name) || personalProjects.includes(project.id);
    const named = include.includes(project.name) || include.includes(project.id);
    if (isPersonal && !named) {
      excluded.add(project.id);
      excluded.add(project.name);
      continue;
    }
    try {
      const storage = new DeferralStorage(project.workflowRootPath);
      const list = await storage.list({ status: 'deferred' });
      for (const d of list) {
        if (d.owner === 'matthew') deferrals.push({ project: project.name, title: d.title });
      }
    } catch {
      skipped.push(project.name);
      excluded.add(project.id);
      excluded.add(project.name);
    }
  }

  const runs = (await listRuns()).filter((r) => !excluded.has(r.project));

  const stuckRuns: AdvisorSummary['stuckRuns'] = [];
  const openPrs: AdvisorSummary['openPrs'] = [];
  const liveRuns: AdvisorSummary['liveRuns'] = [];
  for (const run of runs) {
    if (run.status === 'error') {
      stuckRuns.push({ id: run.id, project: run.project, reason: 'error' });
    } else if (run.status === 'running') {
      const newest = newestStepMs(run.id);
      if (newest === undefined || now.getTime() - newest > STUCK_MINUTES * 60 * 1000) {
        stuckRuns.push({ id: run.id, project: run.project, reason: 'running' });
      }
      liveRuns.push({ id: run.id, project: run.project, phase: run.phase ?? '', stepKind: run.cursor?.stepKind });
    }

    if (run.status !== 'abandoned' && run.prReads?.length) {
      const latest = new Map<number, PrRead>();
      for (const read of run.prReads) {
        const prev = latest.get(read.number);
        if (!prev || read.at > prev.at) latest.set(read.number, read);
      }
      for (const [pr, read] of latest) {
        if (read.verdict !== 'merged') openPrs.push({ project: run.project, pr, verdict: read.verdict });
      }
    }
  }

  const waits = (await listOpenWaits()).filter((w) => !excluded.has(w.project));
  const openWaits = waits.map((w) => ({
    kind: w.kind,
    project: w.project,
    spec: w.spec,
    ageMins: Math.floor((now.getTime() - new Date(w.created).getTime()) / 60000),
  }));

  const rateLimit = await readRateLimit();
  const windows = { fiveHour: rateLimit?.fiveHour, sevenDay: rateLimit?.sevenDay };

  const { from, to } = isoWeekRange(now);
  const tallies = await buildTallies({ from, to });
  const week = Object.values(tallies.weeks)[0] ?? emptyWeek();

  const sources = (sourcesFile.sources ?? []).map((s) => ({ name: s.name, about: s.about }));
  const push = await pushState();

  return { openWaits, stuckRuns, openPrs, deferrals, liveRuns, windows, week, sources, push, skipped };
}

function capList(label: string, items: string[]): string[] {
  if (items.length === 0) return [];
  const lines = [`${label}:`, ...items.slice(0, LIST_CAP).map((i) => `- ${i}`)];
  if (items.length > LIST_CAP) lines.push(`- ${items.length - LIST_CAP} more`);
  return lines;
}

function capWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return text;
  return words.slice(0, max).join(' ');
}

/** Render the capped summary text (design.md C4: 5 rows a list, 400 words total). */
export function renderSummary(s: AdvisorSummary): string {
  const lines: string[] = [];
  lines.push(...capList('Open waits', s.openWaits.map((w) => `${w.kind} ${w.project}/${w.spec} (${w.ageMins}m)`)));
  lines.push(...capList('Stuck runs', s.stuckRuns.map((r) => `${r.id} ${r.project} (${r.reason})`)));
  lines.push(...capList('Open PRs', s.openPrs.map((p) => `${p.project} #${p.pr} ${p.verdict}`)));
  lines.push(...capList('Deferrals (matthew)', s.deferrals.map((d) => `${d.project}: ${d.title}`)));
  lines.push(
    ...capList(
      'Live runs',
      s.liveRuns.map((r) => `${r.id} ${r.project} ${r.phase}${r.stepKind ? '/' + r.stepKind : ''}`),
    ),
  );
  const fiveHour = s.windows.fiveHour ? JSON.stringify(s.windows.fiveHour) : 'unknown';
  const sevenDay = s.windows.sevenDay ? JSON.stringify(s.windows.sevenDay) : 'unknown';
  lines.push(`Usage windows: 5h ${fiveHour} 7d ${sevenDay}`);
  const tokens = Object.values(s.week.tokens.byAgent).reduce((a, b) => a + b, 0);
  const failures = Object.values(s.week.failures).reduce((a, b) => a + b, 0);
  const findings = Object.values(s.week.findings).reduce((a, b) => a + b, 0);
  lines.push(`This week: ${tokens} tokens, ${failures} failures, ${findings} findings`);
  lines.push(...capList('Sources', s.sources.map((src) => `${src.name}: ${src.about}`)));
  lines.push(`Push: ${s.push}`);
  if (s.skipped.length) lines.push(`Skipped: ${s.skipped.join(', ')}`);

  return capWords(lines.join('\n'), WORD_CAP);
}
