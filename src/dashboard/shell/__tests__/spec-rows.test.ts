import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { buildSpecBlock, isSpecClosed } from '../spec-rows.js';
import type { PhaseRow } from '../../../watch/ledger.js';
import type { ProjectContext } from '../../project-manager.js';
import { DeferralStorage } from '../../../core/deferral-storage.js';
import type { RunRecord } from '../../../controller/state.js';

// Contract for src/dashboard/shell/spec-rows.ts (design.md C3/C5; task 4
// _Prompt; Requirements 1.2-1.5, 2.1-2.8).
//
// Reached only through buildSpecBlock(project, liveRuns, cache?).

function tmpBase(): string {
  return mkdtempSync(join(tmpdir(), 'sdd-spec-rows-test-'));
}

function makeProject(base: string, name = 'Project One'): { project: ProjectContext; workflowRoot: string; specsDir: string } {
  const projectPath = mkdtempSync(join(base, 'proj-'));
  const workflowRoot = join(projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');
  mkdirSync(specsDir, { recursive: true });
  const project = {
    projectId: randomUUID(),
    projectName: name,
    projectPath,
    workspacePath: projectPath,
    workflowRootPath: projectPath,
  } as ProjectContext;
  return { project, workflowRoot, specsDir };
}

function makeSpecDir(specsDir: string, spec: string): string {
  const dir = join(specsDir, spec);
  mkdirSync(dir, { recursive: true });
  return dir;
}

interface PhaseLogRow { date: string; spec: string; phase: string; state: string; result: string; note: string }

function phaseLogTable(rows: PhaseLogRow[]): string {
  return [
    '## Phase log',
    '',
    '| Date | Spec | Stage | State | Result | Note |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.date} | ${r.spec} | ${r.phase} | ${r.state} | ${r.result} | ${r.note} |`),
    '',
  ].join('\n');
}

function writeHandoff(workflowRoot: string, rows: PhaseLogRow[]): void {
  writeFileSync(join(workflowRoot, 'HANDOFF.md'), phaseLogTable(rows));
}

function writeDeferredMarker(specsDir: string, spec: string): void {
  writeFileSync(
    join(specsDir, spec, 'deferred.json'),
    JSON.stringify({ deferred: true, reason: 'postponed for the test', deferredAt: '2026-01-01T00:00:00.000Z' }),
  );
}

function writeRetroPlan(specsDir: string, spec: string, statusLine: string): void {
  writeFileSync(
    join(specsDir, spec, 'retrospective-plan.md'),
    `# Retrospective plan — ${spec}\n${statusLine}\n`,
  );
}

// Contract for isSpecClosed (design.md C9/D15; task 10 _Prompt; Requirement 3
// AC2).
//
// Reached only through isSpecClosed(phaseRows, planText).
//
// Criterion "true for a closeout/closed row" (task 10 _Prompt: "returns true
//   when a row has phase `closeout` and result `closed`"):
//   Pre-condition: a phaseRows array holding one row with phase 'closeout'
//   and result 'closed', and planText undefined.
//   Test: isSpecClosed(phaseRows, planText).
//   Observable result: true.
//   Expected-value source: the _Prompt's first disjunct, quoted above.
//
// Criterion "true for a plan whose Status: value starts with CLOSED" (task
//   10 _Prompt: "or when the first word of `firstStatusValue(planText)` is
//   `CLOSED`"):
//   Pre-condition: an empty phaseRows array, and planText whose first
//   `Status:` line reads "Status: CLOSED — retro done".
//   Test: isSpecClosed(phaseRows, planText).
//   Observable result: true.
//   Expected-value source: the _Prompt's second disjunct, quoted above.
//
// Criterion "false for neither" (task 10 _Prompt, the rule being a
//   disjunction of exactly those two conditions):
//   Pre-condition: a phaseRows array holding one row with phase 'closeout'
//   but result 'pending' (not 'closed'), and planText whose first `Status:`
//   line reads "Status: APPROVED — all decisions made".
//   Test: isSpecClosed(phaseRows, planText).
//   Observable result: false.
//   Expected-value source: the _Prompt's rule, quoted above; neither
//   disjunct is met by this fixture.

describe('isSpecClosed', () => {
  it('is true for a closeout row with result closed', () => {
    const phaseRows: PhaseRow[] = [
      { phase: 'closeout', state: 'complete', result: 'closed', note: 'closed', date: '2026-01-01' },
    ];

    expect(isSpecClosed(phaseRows, undefined)).toBe(true);
  });

  it('is true for a plan whose Status value starts with CLOSED', () => {
    const phaseRows: PhaseRow[] = [];
    const planText = '# Retrospective plan\nStatus: CLOSED — retro done\n';

    expect(isSpecClosed(phaseRows, planText)).toBe(true);
  });

  it('is false when neither the closeout row nor the plan status is met', () => {
    const phaseRows: PhaseRow[] = [
      { phase: 'closeout', state: 'complete', result: 'pending', note: 'not yet', date: '2026-01-01' },
    ];
    const planText = '# Retrospective plan\nStatus: APPROVED — all decisions made\n';

    expect(isSpecClosed(phaseRows, planText)).toBe(false);
  });
});

// Contract for buildSpecBlock (design.md C3; task 4 _Prompt; Requirements 1.2
// to 1.5, 2.1 to 2.8).
//
// Reached only through buildSpecBlock(project, liveRuns, cache?).
//
// === live (Req 2.2) ===
//
// Criterion "live in the implementation phase reads `implementation 3/7`"
//   (task 4 _Prompt): Pre-condition: a spec with tasks.md giving 3/7 done,
//   named by a heading, and a liveRuns entry for that spec with phase
//   'implementation' and status 'running'.
//   Test: buildSpecBlock(project, [run]).
//   Observable result: the line's word is 'live', fact is 'implementation 3/7'.
//   Expected-value source: design C3's live bullet; the fixture's own 3/7.
//
// Criterion "a paused live run reads `implementation 3/7 · paused`" (task 4
//   _Prompt): Pre-condition: as above but the run's status is 'paused'.
//   Test: buildSpecBlock(project, [run]).
//   Observable result: fact is 'implementation 3/7 · paused'.
//   Expected-value source: design C3's live bullet / D16's example string.
//
// Criterion "a live run of the store's second project reads live" (task 4
//   _Prompt): Pre-condition: a heading naming a spec, and a liveRuns entry for
//   that spec whose `project` field is a different project id (D24: liveRuns
//   holds every store member's live run, not only the representative's).
//   Test: buildSpecBlock(project, [run]).
//   Observable result: the line's word is 'live'.
//   Expected-value source: design C3's live bullet matches on `run.spec` only.
//
// === closed (Req 2.3) ===
//
// Criterion "closed reads `#12 #15` ascending from phase-log notes" (task 4
//   _Prompt): Pre-condition: a spec with a HANDOFF closeout/closed row and two
//   phase-log notes mentioning "PR #15" and "PR #12".
//   Test: buildSpecBlock(project, []).
//   Observable result: word 'closed', fact '#12 #15'.
//   Expected-value source: design C3's closed bullet / D6; the fixture's own
//   note text, deduplicated, sorted ascending, each written `#n`.
//
// Criterion "else `no PR recorded`" (task 4 _Prompt): Pre-condition: a closed
//   spec whose phase-log note names no PR.
//   Test: buildSpecBlock(project, []).
//   Observable result: fact 'no PR recorded'.
//   Expected-value source: design C3's closed bullet / D6.
//
// === deferred (Req 2.4) ===
//
// Criterion "deferred by a `(deferred)` heading ... its fact the newest open
//   record whose originSpec is the spec" (task 4 _Prompt, D5): Pre-condition:
//   a heading tagged `(deferred)` naming a spec, and two open deferral
//   records whose originSpec is that spec, created in sequence.
//   Test: buildSpecBlock(project, []).
//   Observable result: word 'deferred', fact equals the id of the second
//   (newest) record.
//   Expected-value source: design D5 and `DeferralStorage.list` sorting
//   newest first (`src/core/deferral-storage.ts:277-305`); the fixture's own
//   second id.
//
// Criterion "else a `d-` id in the entry text" (task 4 _Prompt, D5):
//   Pre-condition: a spec directory with a `deferred.json` marker (no
//   `(deferred)` heading tag), named by a heading whose text names a
//   `d-0000abcd` token, and no open deferral record for the spec.
//   Test: buildSpecBlock(project, []).
//   Observable result: word 'deferred', fact 'd-0000abcd'.
//   Expected-value source: design D5's second fallback; the fixture's own
//   literal id text.
//
// Criterion "else `no record`" (task 4 _Prompt, D5): Pre-condition: a
//   `(deferred)`-tagged heading naming a spec with no open record and no `d-`
//   id anywhere in the entry text.
//   Test: buildSpecBlock(project, []).
//   Observable result: fact 'no record'.
//   Expected-value source: design D5's final fallback.
//
// === next (Req 2.5, 2.8) ===
//
// Criterion "next has no fact ... at most one line reads it" (task 4
//   _Prompt): Pre-condition: a single heading naming a spec with no
//   directory, so `launchableSpec` (task 3) names it.
//   Test: buildSpecBlock(project, []).
//   Observable result: word 'next', fact null.
//   Expected-value source: design C3's next bullet; `launchableSpec` returns
//   exactly one spec or null by construction (task 3), so "at most one"
//   follows from this single-valued read and is not reasserted separately.
//
// === stopped (Req 2.6) ===
//
// Criterion "stopped reads the newest phase-log row's phase" (task 4
//   _Prompt): Pre-condition: a filler spec heading placed first (so it, not
//   the target, is `launchableSpec`), then a heading naming a spec with
//   tasks.md and two phase-log rows, the newer one with phase 'design'.
//   Test: buildSpecBlock(project, []).
//   Observable result: word 'stopped', fact 'design'.
//   Expected-value source: design C3's stopped bullet; the fixture's own
//   newer row.
//
// Criterion "else the index entry's current phase" (task 4 _Prompt):
//   Pre-condition: as above, but the target spec has only requirements.md and
//   no phase-log row at all.
//   Test: buildSpecBlock(project, []).
//   Observable result: fact 'design' (deriveSpecStatus's phase for a spec
//   with requirements.md but no design.md).
//   Expected-value source: design C3's stopped bullet;
//   `src/core/spec-status-deriver.ts`'s branch for that fixture shape.
//
// === not started (Req 2.7) ===
//
// Criterion "not started has no fact" (task 4 _Prompt): Pre-condition: a
//   filler spec heading placed first, then a heading naming an empty spec
//   directory (no documents, no ledger).
//   Test: buildSpecBlock(project, []).
//   Observable result: word 'not started', fact null.
//   Expected-value source: design C3's not-started bullet (the "otherwise" branch).
//
// === precedence (Req 2.1) ===
//
// Criterion "live beats closed and closed beats deferred" (task 4 _Prompt;
//   Requirement 2 AC1): Pre-condition (live case): a spec matching a live
//   run, a HANDOFF closed row and a deferred.json marker, all at once.
//   Pre-condition (closed case): the same spec minus the live run.
//   Test: buildSpecBlock(project, liveRuns).
//   Observable result: word 'live' in the first case, 'closed' in the second.
//   Expected-value source: design C3 step 4's first-match rule order (D1).
//
// === ordering and absence (Req 1.2, 1.5) ===
//
// Criterion "lines keep file order with non-sequential numbers" (task 4
//   _Prompt; D3): Pre-condition: a decomposition.md with heading `34` before
//   heading `12`.
//   Test: buildSpecBlock(project, []).
//   Observable result: lines[0].number is '34', lines[1].number is '12'.
//   Expected-value source: design D3 / C3 step 4 ("for each heading in file order").
//
// Criterion "an unnamed spec directory gives no line" (task 4 _Prompt; D4):
//   Pre-condition: two spec directories, only one named by a heading.
//   Test: buildSpecBlock(project, []).
//   Observable result: exactly one line, for the named spec.
//   Expected-value source: design D4 / Requirement 1 AC5.
//
// Criterion "no `decomposition.md` gives `lines: []`" (task 4 _Prompt):
//   Pre-condition: a store with no decomposition.md file.
//   Test: buildSpecBlock(project, []).
//   Observable result: lines is [], projectId/projectName carry the given project.
//   Expected-value source: design C3 step 1 / Requirement 1 AC4.

function writeDecomposition(workflowRoot: string, text: string): void {
  const dir = join(workflowRoot, 'spec-decomposition');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'decomposition.md'), text);
}

function makeRun(project: string, spec: string, status: RunRecord['status'], phase?: string): RunRecord {
  return {
    v: 1,
    id: randomUUID(),
    project,
    codeRoot: '/tmp/code-root',
    specStore: '/tmp/spec-store',
    spec,
    worktree: '',
    branch: '',
    status,
    phase,
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  };
}

const TASKS_3_OF_7 = [
  '- [x] 1. a',
  '- [x] 2. b',
  '- [x] 3. c',
  '- [ ] 4. d',
  '- [ ] 5. e',
  '- [ ] 6. f',
  '- [ ] 7. g',
  '',
].join('\n');

describe('buildSpecBlock', () => {
  let base: string;

  beforeEach(() => { base = tmpBase(); });
  afterEach(() => { rmSync(base, { recursive: true, force: true }); });

  it('gives a live run in the implementation phase the fact "implementation 3/7"', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'live-impl-spec');
    writeFileSync(join(dir, 'tasks.md'), TASKS_3_OF_7);
    writeDecomposition(workflowRoot, '### 1. `live-impl-spec` — exercises the live word\n');
    const run = makeRun(project.projectId, 'live-impl-spec', 'running', 'implementation');

    const block = await buildSpecBlock(project, [run]);
    const line = block.lines.find((l) => l.spec === 'live-impl-spec');
    expect(line?.word).toBe('live');
    expect(line?.fact).toBe('implementation 3/7');
  });

  it('gives a paused live run the fact "implementation 3/7 · paused"', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    const dir = makeSpecDir(specsDir, 'live-paused-spec');
    writeFileSync(join(dir, 'tasks.md'), TASKS_3_OF_7);
    writeDecomposition(workflowRoot, '### 1. `live-paused-spec` — exercises the paused live word\n');
    const run = makeRun(project.projectId, 'live-paused-spec', 'paused', 'implementation');

    const block = await buildSpecBlock(project, [run]);
    const line = block.lines.find((l) => l.spec === 'live-paused-spec');
    expect(line?.word).toBe('live');
    expect(line?.fact).toBe('implementation 3/7 · paused');
  });

  it("reads live for a live run belonging to the store's second project", async () => {
    const { project, workflowRoot } = makeProject(base);
    writeDecomposition(workflowRoot, "### 1. `shared-live-spec` — exercises a second project's live run\n");
    const run = makeRun('a-different-project-id', 'shared-live-spec', 'running', 'requirements');

    const block = await buildSpecBlock(project, [run]);
    const line = block.lines.find((l) => l.spec === 'shared-live-spec');
    expect(line?.word).toBe('live');
  });

  it('gives a closed spec the fact "#12 #15" from its ascending phase-log PR numbers', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'closed-pr-spec');
    writeHandoff(workflowRoot, [
      { date: '2026-01-01', spec: 'closed-pr-spec', phase: 'implementation', state: 'v1', result: 'approved', note: 'see PR #15' },
      { date: '2026-01-02', spec: 'closed-pr-spec', phase: 'closeout', state: 'complete', result: 'closed', note: 'closed via PR #12' },
    ]);
    writeDecomposition(workflowRoot, '### 1. `closed-pr-spec` — exercises the closed word\n');

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'closed-pr-spec');
    expect(line?.word).toBe('closed');
    expect(line?.fact).toBe('#12 #15');
  });

  it('gives a closed spec with no PR note the fact "no PR recorded"', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'closed-nopr-spec');
    writeHandoff(workflowRoot, [
      { date: '2026-01-01', spec: 'closed-nopr-spec', phase: 'closeout', state: 'complete', result: 'closed', note: 'closed, nothing to merge' },
    ]);
    writeDecomposition(workflowRoot, '### 2. `closed-nopr-spec` — exercises the no-PR fact\n');

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'closed-nopr-spec');
    expect(line?.word).toBe('closed');
    expect(line?.fact).toBe('no PR recorded');
  });

  it('gives a (deferred)-tagged heading the newest open record whose originSpec is the spec', async () => {
    const { project, workflowRoot } = makeProject(base);
    writeDecomposition(workflowRoot, '### 1. `deferred-tag-spec` — exercises the deferred tag (deferred)\n');
    const storage = new DeferralStorage(project.projectPath);
    const body = { context: 'c', decision: 'd', revisitCriteria: 'r' };
    const common: { originPhase: null; revisitTrigger: string; tags: string[]; body: typeof body; supersedes: null } =
      { originPhase: null, revisitTrigger: 't', tags: [], body, supersedes: null };
    await storage.create({ title: 'older', originSpec: 'deferred-tag-spec', ...common });
    const newest = await storage.create({ title: 'newer', originSpec: 'deferred-tag-spec', ...common });

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'deferred-tag-spec');
    expect(line?.word).toBe('deferred');
    expect(line?.fact).toBe(newest);
  });

  it('falls back to a `d-` id in the entry text when no open record names the spec', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'deferred-marker-spec');
    writeDeferredMarker(specsDir, 'deferred-marker-spec');
    writeDecomposition(workflowRoot, '### 1. `deferred-marker-spec` — blocked on d-0000abcd for the launch gate\n');

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'deferred-marker-spec');
    expect(line?.word).toBe('deferred');
    expect(line?.fact).toBe('d-0000abcd');
  });

  it('gives "no record" when no open record and no `d-` id name the spec', async () => {
    const { project, workflowRoot } = makeProject(base);
    writeDecomposition(workflowRoot, '### 1. `deferred-none-spec` — nothing names a record (deferred)\n');

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'deferred-none-spec');
    expect(line?.word).toBe('deferred');
    expect(line?.fact).toBe('no record');
  });

  it('gives the launchable spec the word "next" with no fact', async () => {
    const { project, workflowRoot } = makeProject(base);
    writeDecomposition(workflowRoot, '### 1. `next-spec` — exercises the next word\n');

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'next-spec');
    expect(line?.word).toBe('next');
    expect(line?.fact).toBeNull();
  });

  it("gives a stopped spec the fact of its newest phase-log row's phase", async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'filler-spec-e1');
    const dir = makeSpecDir(specsDir, 'stopped-row-spec');
    writeFileSync(join(dir, 'tasks.md'), '- [ ] 1. not started yet\n');
    writeHandoff(workflowRoot, [
      { date: '2026-01-01', spec: 'stopped-row-spec', phase: 'requirements', state: 'v1', result: 'approved', note: 'ok' },
      { date: '2026-02-01', spec: 'stopped-row-spec', phase: 'design', state: 'in-progress', result: 'pending', note: 'wip' },
    ]);
    writeDecomposition(workflowRoot, [
      '### 1. `filler-spec-e1` — routes first so the target is never launchable',
      '',
      '### 2. `stopped-row-spec` — exercises the stopped word',
      '',
    ].join('\n'));

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'stopped-row-spec');
    expect(line?.word).toBe('stopped');
    expect(line?.fact).toBe('design');
  });

  it("falls back to the index entry's currentPhase when a stopped spec has no phase-log row", async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'filler-spec-e2');
    const dir = makeSpecDir(specsDir, 'stopped-entry-spec');
    writeFileSync(join(dir, 'requirements.md'), '# Requirements\n');
    writeDecomposition(workflowRoot, [
      '### 1. `filler-spec-e2` — routes first so the target is never launchable',
      '',
      '### 2. `stopped-entry-spec` — exercises the currentPhase fallback',
      '',
    ].join('\n'));

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'stopped-entry-spec');
    expect(line?.word).toBe('stopped');
    expect(line?.fact).toBe('design');
  });

  it('gives an empty spec with documents absent the word "not started" and no fact', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'filler-spec-f1');
    makeSpecDir(specsDir, 'not-started-spec');
    writeDecomposition(workflowRoot, [
      '### 1. `filler-spec-f1` — routes first so the target is never launchable',
      '',
      '### 2. `not-started-spec` — exercises the not-started word',
      '',
    ].join('\n'));

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'not-started-spec');
    expect(line?.word).toBe('not started');
    expect(line?.fact).toBeNull();
  });

  it('gives word "live" when live, closed and deferred all match', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'precedence-live-spec');
    writeHandoff(workflowRoot, [
      { date: '2026-01-01', spec: 'precedence-live-spec', phase: 'closeout', state: 'complete', result: 'closed', note: 'closed' },
    ]);
    writeDeferredMarker(specsDir, 'precedence-live-spec');
    writeDecomposition(workflowRoot, '### 1. `precedence-live-spec` — exercises live-over-closed-and-deferred precedence\n');
    const run = makeRun(project.projectId, 'precedence-live-spec', 'running', 'requirements');

    const block = await buildSpecBlock(project, [run]);
    const line = block.lines.find((l) => l.spec === 'precedence-live-spec');
    expect(line?.word).toBe('live');
  });

  it('gives word "closed" when closed and deferred both match but no live run does', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'precedence-closed-spec');
    writeHandoff(workflowRoot, [
      { date: '2026-01-01', spec: 'precedence-closed-spec', phase: 'closeout', state: 'complete', result: 'closed', note: 'closed' },
    ]);
    writeDeferredMarker(specsDir, 'precedence-closed-spec');
    writeDecomposition(workflowRoot, '### 1. `precedence-closed-spec` — exercises closed-over-deferred precedence\n');

    const block = await buildSpecBlock(project, []);
    const line = block.lines.find((l) => l.spec === 'precedence-closed-spec');
    expect(line?.word).toBe('closed');
  });

  it('keeps file order in lines even when heading numbers are non-sequential', async () => {
    const { project, workflowRoot } = makeProject(base);
    writeDecomposition(workflowRoot, [
      '### 34. `spec-a` — appears first in the file',
      '',
      '### 12. `spec-b` — appears second in the file',
      '',
    ].join('\n'));

    const block = await buildSpecBlock(project, []);
    expect(block.lines.map((l) => l.number)).toEqual(['34', '12']);
    expect(block.lines.map((l) => l.spec)).toEqual(['spec-a', 'spec-b']);
  });

  it('gives no line for a spec directory that no heading names', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    makeSpecDir(specsDir, 'named-spec');
    makeSpecDir(specsDir, 'orphan-spec');
    writeDecomposition(workflowRoot, '### 1. `named-spec` — the only named spec\n');

    const block = await buildSpecBlock(project, []);
    expect(block.lines).toHaveLength(1);
    expect(block.lines.find((l) => l.spec === 'orphan-spec')).toBeUndefined();
  });

  it('gives lines: [] when the store has no decomposition.md', async () => {
    const { project } = makeProject(base);

    const block = await buildSpecBlock(project, []);
    expect(block.lines).toEqual([]);
    expect(block.projectId).toBe(project.projectId);
    expect(block.projectName).toBe(project.projectName);
  });
});
