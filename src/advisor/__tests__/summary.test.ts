import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  writeRun,
  writeWait,
  writeProjects,
  writeRateLimit,
  writeJsonAtomic,
  runStepsDir,
} from '../../controller/state.js';
import type { RunRecord, WaitRecord, PrRead } from '../../controller/state.js';
import { DeferralStorage } from '../../core/deferral-storage.js';
import { appendEvent, sourcesPath } from '../home.js';
import { buildSummary, renderSummary } from '../summary.js';

// Contract for src/advisor/summary.ts (design.md C4; requirements.md
// Requirement 2 AC 1-5, Requirement 8 AC 3, Requirement 10 AC 4, NFR
// Performance; tasks.md task 7). buildSummary({ include?, now? }) builds the
// AdvisorSummary fresh from the home and every registered project's files on
// each call, never from a cache; renderSummary(s) gives the capped text.
// Each test runs against a fresh temp SDD_HOME (and, where a project is
// needed, a fresh temp project root) so the real home and repo are never
// touched. Fixture rows are written through the real production writers
// (writeRun, writeWait, writeProjects, writeRateLimit, DeferralStorage,
// appendEvent), never hand-mocked.

let home: string;
let savedSddHome: string | undefined;
let extraDirs: string[];

beforeEach(() => {
  savedSddHome = process.env.SDD_HOME;
  home = mkdtempSync(join(tmpdir(), 'sdd-advisor-summary-home-'));
  process.env.SDD_HOME = home;
  extraDirs = [];
});

afterEach(() => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  rmSync(home, { recursive: true, force: true });
  for (const dir of extraDirs) rmSync(dir, { recursive: true, force: true });
});

function projectRoot(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  extraDirs.push(dir);
  return dir;
}

function makeRun(overrides: Partial<RunRecord> & { id: string }): RunRecord {
  return {
    v: 1,
    project: 'proj-a',
    codeRoot: '/code/proj-a',
    specStore: '/code/proj-a/.spec-workflow',
    spec: 'spec-a',
    worktree: '/code/proj-a/.worktrees/spec-a',
    branch: 'feat/spec-a',
    status: 'running',
    created: '2026-10-26T12:00:00.000Z',
    updated: '2026-10-26T12:00:00.000Z',
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    ...overrides,
  };
}

function makeWait(overrides: Partial<WaitRecord> & { id: string }): WaitRecord {
  return {
    v: 1,
    kind: 'question',
    run: 'run-a',
    project: 'proj-a',
    spec: 'spec-a',
    created: '2026-10-26T12:00:00.000Z',
    questions: [{ id: 'q1', text: 'Pick one' }],
    state: 'open',
    ...overrides,
  };
}

function makePrRead(overrides: Partial<PrRead> & { number: number; verdict: PrRead['verdict']; at: string }): PrRead {
  return {
    kind: 'run',
    repo: 'spec-workflow-mcp',
    ci: 'green',
    reasons: [],
    ...overrides,
  };
}

const baseDeferral = {
  originSpec: null,
  originPhase: null,
  revisitTrigger: 'later',
  tags: [],
  supersedes: null,
  body: { context: 'c', decision: 'd', revisitCriteria: 'r' },
};

describe('src/advisor/summary.ts buildSummary/renderSummary', () => {
  // AC 2.2: a wait open at the moment of the request is listed, with its age,
  // and the summary is built from current state on each call (never a stale
  // cache). Pre-condition: no waits exist; a first buildSummary call returns
  // an empty openWaits. A wait (kind 'question', project 'proj-a', spec
  // 'spec-a') is then created with `created` equal to a fixed instant. Test:
  // buildSummary({ now }) three minutes after that instant. Observable
  // result: openWaits holds exactly one entry {kind, project, spec, ageMins:
  // 3}, present only on the second call. Expected value source: requirements.md
  // Requirement 2 AC 2 ("a wait open at the moment of the request ... SHALL
  // list it ... built from current state on each request") and design.md C4
  // ("open waits (kind, project, spec, ageMins)").
  it('lists a just-created open wait with its age, built fresh on each call (2.2)', async () => {
    const createdAt = new Date('2026-10-26T12:00:00.000Z');
    const before = await buildSummary({ now: createdAt });
    expect(before.openWaits).toEqual([]);

    await writeWait(makeWait({ id: 'w-fresh', created: createdAt.toISOString() }));

    const later = new Date(createdAt.getTime() + 3 * 60 * 1000);
    const after = await buildSummary({ now: later });

    expect(after.openWaits).toEqual([{ kind: 'question', project: 'proj-a', spec: 'spec-a', ageMins: 3 }]);
  });

  // AC 2.1 (stuck runs) and design D17. Pre-condition: four runs — one
  // 'running' with its newest runStepsDir file 20 minutes old (stale), one
  // 'running' with its newest file 2 minutes old (fresh), one 'running' with
  // no runStepsDir at all (absent), one 'error'. Test: buildSummary({ now }).
  // Observable result: stuckRuns names exactly run-stale, run-absent and
  // run-error (reasons 'running', 'running', 'error'); run-fresh is absent.
  // Expected value source: design.md D17 ("a stuck run is one whose newest
  // step log is older than fifteen minutes") and design.md C4 ("stuck runs
  // (error, or running with the newest file under runStepsDir(id) older than
  // 15 minutes or absent)").
  it('marks error runs and running runs with a stale or absent step log as stuck (2.1, D17)', async () => {
    const now = new Date('2026-10-26T12:00:00.000Z');
    const staleAt = new Date(now.getTime() - 20 * 60 * 1000);
    const freshAt = new Date(now.getTime() - 2 * 60 * 1000);

    await writeRun(makeRun({ id: 'run-stale', status: 'running' }));
    mkdirSync(runStepsDir('run-stale'), { recursive: true });
    writeFileSync(join(runStepsDir('run-stale'), 'step-1.log'), 'x');
    utimesSync(join(runStepsDir('run-stale'), 'step-1.log'), staleAt, staleAt);

    await writeRun(makeRun({ id: 'run-fresh', status: 'running' }));
    mkdirSync(runStepsDir('run-fresh'), { recursive: true });
    writeFileSync(join(runStepsDir('run-fresh'), 'step-1.log'), 'x');
    utimesSync(join(runStepsDir('run-fresh'), 'step-1.log'), freshAt, freshAt);

    await writeRun(makeRun({ id: 'run-absent', status: 'running' }));
    await writeRun(makeRun({ id: 'run-error', status: 'error' }));

    const summary = await buildSummary({ now });

    const byId = new Map(summary.stuckRuns.map((r) => [r.id, r.reason]));
    expect([...byId.keys()].sort()).toEqual(['run-absent', 'run-error', 'run-stale']);
    expect(byId.get('run-stale')).toBe('running');
    expect(byId.get('run-absent')).toBe('running');
    expect(byId.get('run-error')).toBe('error');
    expect(byId.has('run-fresh')).toBe(false);
  });

  // AC 2.1 (open PRs). Pre-condition: run-open ('running', pr 10) holds two
  // PrReads for pr 10 at different times with different verdicts (the later
  // one 'blocked'); run-merged ('merging', pr 11) holds one PrRead whose
  // verdict is 'merged'; run-abandoned ('abandoned', pr 12) holds one PrRead
  // whose verdict is 'waiting'. Test: buildSummary({ now }). Observable
  // result: openPrs holds exactly one row, pr 10 with verdict 'blocked' (the
  // latest read); pr 11 is absent (verdict merged) and pr 12 is absent (run
  // abandoned). Expected value source: design.md C4 ("open PRs (latest
  // PrRead per PR, verdict not merged, run not abandoned)") and
  // requirements.md Requirement 2 AC 1.
  it('lists open PRs from the latest PrRead per PR, excluding merged verdicts and abandoned runs (2.1)', async () => {
    await writeRun(makeRun({
      id: 'run-open', status: 'running', pr: 10,
      prReads: [
        makePrRead({ number: 10, verdict: 'waiting', at: '2026-10-26T11:00:00.000Z' }),
        makePrRead({ number: 10, verdict: 'blocked', at: '2026-10-26T11:30:00.000Z' }),
      ],
    }));
    await writeRun(makeRun({
      id: 'run-merged', status: 'merging', pr: 11,
      prReads: [makePrRead({ number: 11, verdict: 'merged', at: '2026-10-26T11:00:00.000Z' })],
    }));
    await writeRun(makeRun({
      id: 'run-abandoned', status: 'abandoned', pr: 12,
      prReads: [makePrRead({ number: 12, verdict: 'waiting', at: '2026-10-26T11:00:00.000Z' })],
    }));

    const summary = await buildSummary({ now: new Date('2026-10-26T12:00:00.000Z') });

    expect(summary.openPrs).toEqual([{ project: 'proj-a', pr: 10, verdict: 'blocked' }]);
  });

  // AC 2.1 (deferrals, live runs, windows, week). Pre-condition: one
  // registered project ('proj-b') with one owner:'matthew' deferral and one
  // owner:'harness' deferral; one 'running' run for that project with phase
  // 'implementation' and cursor.stepKind 'implementer'; rate-limit.json with
  // known fiveHour/sevenDay windows; the home events.jsonl holding one
  // advisor.opinion row at 'now' whose five usage fields sum to 40. Test:
  // buildSummary({ now }). Observable result: deferrals holds only the
  // matthew-owned item; liveRuns holds the running run with its phase and
  // stepKind; windows.fiveHour/sevenDay equal the written rate-limit file;
  // week.tokens.byAgent['sdd-advisor'] equals 40 (the tallies builder's own
  // rule, task 6). Expected value source: design.md C4 ("owner: matthew
  // deferrals ...; live runs; fiveHour and sevenDay windows; this ISO week's
  // tallies (C5)") and requirements.md Requirement 2 AC 1 plus Requirement 3
  // AC 4 (via the tallies builder this task leverages).
  it("carries owner-matthew deferrals, live runs, usage windows and this week's tallies (2.1)", async () => {
    const root = projectRoot('sdd-advisor-summary-proj-');
    await writeProjects({
      v: 1,
      projects: [{ id: 'proj-b', name: 'proj-b', workspacePath: root, workflowRootPath: root, seen: '2026-01-01T00:00:00.000Z' }],
    });

    const storage = new DeferralStorage(root);
    await storage.create({ ...baseDeferral, title: 'Fix the thing', owner: 'matthew' } as any);
    await storage.create({ ...baseDeferral, title: 'Harness item', owner: 'harness' } as any);

    await writeRun(makeRun({
      id: 'run-live', project: 'proj-b', status: 'running', phase: 'implementation',
      cursor: { phase: 'implementation', stepKind: 'implementer', attempt: 1 },
    }));

    await writeRateLimit({
      v: 1,
      fiveHour: { utilization: 0.4, resetsAt: '2026-10-26T18:00:00.000Z' },
      sevenDay: { utilization: 0.1, resetsAt: '2026-11-02T12:00:00.000Z' },
      updated: '2026-10-26T12:00:00.000Z',
    });

    await appendEvent({
      v: 1, ts: '2026-10-26T12:00:00.000Z', type: 'advisor.opinion', wait: 'w-x', outcome: 'ok',
      input: 10, output: 20, cacheRead: 5, cacheWrite5m: 3, cacheWrite1h: 2,
    });

    const summary = await buildSummary({ now: new Date('2026-10-26T12:00:00.000Z') });

    expect(summary.deferrals).toEqual([{ project: 'proj-b', title: 'Fix the thing' }]);
    expect(summary.liveRuns).toEqual([{ id: 'run-live', project: 'proj-b', phase: 'implementation', stepKind: 'implementer' }]);
    expect(summary.windows.fiveHour).toEqual({ utilization: 0.4, resetsAt: '2026-10-26T18:00:00.000Z' });
    expect(summary.windows.sevenDay).toEqual({ utilization: 0.1, resetsAt: '2026-11-02T12:00:00.000Z' });
    expect(summary.week.tokens.byAgent['sdd-advisor']).toBe(40);
  });

  // AC 2.5. Pre-condition: two registered projects — 'proj-ok' with a
  // readable deferrals store (one owner:'matthew' deferral) and 'proj-torn'
  // whose workspacePath/workflowRootPath are the JSON literal null (a torn
  // record), which makes PathUtils.safeJoin (src/core/path-utils.ts:183-185)
  // throw as soon as the project's deferrals store is opened. Test:
  // buildSummary({ now }). Observable result: deferrals holds only
  // proj-ok's item; skipped equals exactly ['proj-torn'], and proj-ok's rows
  // are not hidden by proj-torn's failure. Expected value source:
  // requirements.md Requirement 2 AC 5 ("leave that project's rows out and
  // name the project once; one bad project SHALL NOT hide the others") and
  // design.md C4 (same rule, citing src/dashboard/shell/now-model.ts:1-8).
  it('drops a torn project from every section and names it once in skipped, without hiding others (2.5)', async () => {
    const root = projectRoot('sdd-advisor-summary-ok-');
    const storage = new DeferralStorage(root);
    await storage.create({ ...baseDeferral, title: 'Alpha item', owner: 'matthew' } as any);

    await writeProjects({
      v: 1,
      projects: [
        { id: 'proj-ok', name: 'proj-ok', workspacePath: root, workflowRootPath: root, seen: '2026-01-01T00:00:00.000Z' },
        { id: 'proj-torn', name: 'proj-torn', workspacePath: null, workflowRootPath: null, seen: '2026-01-01T00:00:00.000Z' },
      ] as any,
    });

    const summary = await buildSummary({ now: new Date('2026-10-26T12:00:00.000Z') });

    expect(summary.deferrals).toEqual([{ project: 'proj-ok', title: 'Alpha item' }]);
    expect(summary.skipped).toEqual(['proj-torn']);
  });

  // AC 2.3. Pre-condition: one registered project 'jobsync' with one
  // owner:'matthew' deferral; the home sources.json names 'jobsync' in
  // personalProjects. Test: buildSummary({ now }) without include, then
  // buildSummary({ now, include: ['jobsync'] }). Observable result: the
  // first call's deferrals is empty (jobsync hidden); the second call's
  // deferrals holds jobsync's item. Expected value source: requirements.md
  // Requirement 2 AC 3 ("a project ... the operator marks as personal ...
  // SHALL appear only when the advisor asks for it by name") and design.md
  // C4 ("a project in sources.json personalProjects appears only when named
  // in include").
  it('hides a personal project until it is named in include (2.3)', async () => {
    const root = projectRoot('sdd-advisor-summary-personal-');
    const storage = new DeferralStorage(root);
    await storage.create({ ...baseDeferral, title: 'Apply to Acme', owner: 'matthew' } as any);

    await writeProjects({
      v: 1,
      projects: [{ id: 'jobsync', name: 'jobsync', workspacePath: root, workflowRootPath: root, seen: '2026-01-01T00:00:00.000Z' }],
    });
    await writeJsonAtomic(sourcesPath(), { v: 1, sources: [], personalProjects: ['jobsync'] });

    const hidden = await buildSummary({ now: new Date('2026-10-26T12:00:00.000Z') });
    expect(hidden.deferrals).toEqual([]);

    const shown = await buildSummary({ now: new Date('2026-10-26T12:00:00.000Z'), include: ['jobsync'] });
    expect(shown.deferrals).toEqual([{ project: 'jobsync', title: 'Apply to Acme' }]);
  });

  // AC 2.4 (list cap). Pre-condition: six open waits, each a distinct spec
  // ('spec-0' .. 'spec-5'). Test: renderSummary(await buildSummary({ now })).
  // Observable result: the rendered text mentions exactly five of the six
  // spec names and contains an "N more" line naming the one left out.
  // Expected value source: requirements.md Requirement 2 AC 4 ("fit in 400
  // words of rendered text with every list capped and a 'N more' line when
  // capped") and design.md C4 ("Lists cap at 5 rows plus an N more line").
  it('renders at most 5 rows per list with an "N more" line when a list is capped (2.4)', async () => {
    for (let i = 0; i < 6; i++) {
      await writeWait(makeWait({ id: `w-${i}`, spec: `spec-${i}`, created: '2026-10-26T11:58:00.000Z' }));
    }

    const summary = await buildSummary({ now: new Date('2026-10-26T12:00:00.000Z') });
    const text = renderSummary(summary);

    const shownSpecs = [0, 1, 2, 3, 4, 5].map((i) => `spec-${i}`).filter((s) => text.includes(s));
    expect(shownSpecs).toHaveLength(5);
    expect(text).toMatch(/1 more/i);
  });

  // AC 2.4 (400-word cap). Pre-condition: a fixture well past what an
  // uncapped render would fit in 400 words — six open waits, six error runs,
  // six running runs each with a PrRead carrying a long reason string, six
  // running live runs for one project, and six owner:'matthew' deferrals
  // with long titles for that project. Test: renderSummary(await
  // buildSummary({ now })). Observable result: the rendered text's word
  // count is at most 400. Expected value source: requirements.md Requirement
  // 2 AC 4 ("SHALL fit in 400 words of rendered text") and design.md C4
  // ("rendered text at most 400 words").
  it('renders at most 400 words regardless of how much state exists (2.4)', async () => {
    for (let i = 0; i < 6; i++) {
      await writeWait(makeWait({ id: `w-${i}`, spec: `spec-wait-${i}`, created: '2026-10-26T11:00:00.000Z' }));
    }
    for (let i = 0; i < 6; i++) {
      await writeRun(makeRun({ id: `run-err-${i}`, status: 'error', spec: `spec-err-${i}` }));
    }
    for (let i = 0; i < 6; i++) {
      await writeRun(makeRun({
        id: `run-pr-${i}`, status: 'running', spec: `spec-pr-${i}`, pr: 100 + i,
        prReads: [makePrRead({
          number: 100 + i, verdict: 'waiting', at: '2026-10-26T11:00:00.000Z',
          reasons: ['a long reason string that would pad the rendered text quite a bit if included verbatim in full'],
        })],
      }));
    }

    const root = projectRoot('sdd-advisor-summary-words-');
    await writeProjects({
      v: 1,
      projects: [{ id: 'proj-live', name: 'proj-live', workspacePath: root, workflowRootPath: root, seen: '2026-01-01T00:00:00.000Z' }],
    });
    for (let i = 0; i < 6; i++) {
      await writeRun(makeRun({
        id: `run-live-${i}`, project: 'proj-live', status: 'running', spec: `spec-live-${i}`, phase: 'implementation',
        cursor: { phase: 'implementation', stepKind: 'implementer', attempt: 1 },
      }));
    }
    const storage = new DeferralStorage(root);
    for (let i = 0; i < 6; i++) {
      await storage.create({
        ...baseDeferral,
        title: `A long deferred decision title number ${i} about something important to review`,
        owner: 'matthew',
      } as any);
    }

    const summary = await buildSummary({ now: new Date('2026-10-26T12:00:00.000Z') });
    const text = renderSummary(summary);
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    expect(wordCount).toBeLessThanOrEqual(400);
  });

  // AC 8.3. Pre-condition: the home sources.json holds two sources (the
  // day-one shape: a repo and a personal mcp source), each with a name and a
  // one-line 'about'. Test: buildSummary({ now }). Observable result:
  // summary.sources equals the two sources' {name, about} pairs, in file
  // order. Expected value source: requirements.md Requirement 8 AC 3 ("the
  // advisor SHALL list the sources by name and line") and design.md C4
  // ("sources by name and line (Requirement 8 AC 3)").
  it('lists sources by name and about line (8.3)', async () => {
    await writeJsonAtomic(sourcesPath(), {
      v: 1,
      sources: [
        { name: 'matthew-field.ca', kind: 'repo', location: '~/repo/matthew-field.ca', about: 'Personal website.' },
        { name: 'JobSync', kind: 'mcp', location: '', about: 'Job search MCP server.', personal: true },
      ],
    });

    const summary = await buildSummary({ now: new Date('2026-10-26T12:00:00.000Z') });

    expect(summary.sources).toEqual([
      { name: 'matthew-field.ca', about: 'Personal website.' },
      { name: 'JobSync', about: 'Job search MCP server.' },
    ]);
  });

  // AC 10.4 (the absent-push half). Pre-condition: no push.json in the home.
  // Test: buildSummary({ now }). Observable result: summary.push equals
  // 'off'. Expected value source: requirements.md Requirement 10 AC 4 ("IF
  // push.json is absent THEN ... the summary SHALL say push is off") and
  // design.md C4 ("push: off without push.json").
  it('reports push as off when push.json is absent (10.4)', async () => {
    const summary = await buildSummary({ now: new Date('2026-10-26T12:00:00.000Z') });
    expect(summary.push).toBe('off');
  });

  // NFR Performance. Pre-condition: three registered projects, each with an
  // empty spec ledger, plus one run and one wait in the shared home. Test:
  // time a single buildSummary({ now }) call. Observable result: elapsed
  // time is under 2000ms. Expected value source: requirements.md Non-
  // Functional Requirements §Performance ("The summary SHALL return in under
  // 2 seconds with the three known projects").
  it('returns in under 2 seconds with three known projects (NFR Performance)', async () => {
    const roots = ['p1', 'p2', 'p3'].map((n) => projectRoot(`sdd-advisor-summary-perf-${n}-`));
    await writeProjects({
      v: 1,
      projects: roots.map((r, i) => ({ id: `proj-${i}`, name: `proj-${i}`, workspacePath: r, workflowRootPath: r, seen: '2026-01-01T00:00:00.000Z' })),
    });
    for (const r of roots) {
      mkdirSync(join(r, '.spec-workflow', 'specs', 'spec-a'), { recursive: true });
      writeFileSync(join(r, '.spec-workflow', 'specs', 'spec-a', 'harness-events.jsonl'), '');
    }
    await writeRun(makeRun({ id: 'run-perf', status: 'running' }));
    await writeWait(makeWait({ id: 'w-perf' }));

    const start = Date.now();
    await buildSummary({ now: new Date() });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });
});
