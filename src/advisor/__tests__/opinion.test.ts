import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { startSecondOpinion } from '../opinion.js';
import { eventsPath, advisorOpinionsDir } from '../home.js';
import { createWait, answerWait, attachAdvice, setOpinionStatus } from '../../controller/waits.js';
import { readWait, readRun, writeRun, readQueue, writeQueue, type RunRecord, type QueueFile } from '../../controller/state.js';

// Contract for src/advisor/opinion.ts (design.md C7; requirements.md
// Requirement 5.1, 5.2, 5.4, 5.5, 5.6, 5.7; Requirement 3.4). Each test runs
// against a fresh temp SDD_HOME so the real home is never touched, and the
// model process is `scripts/stub-claude.mjs` (CONTROLLER_CLAUDE_BIN), the
// same seam src/controller/__tests__/step.test.ts uses for `claude`. No
// collaborator inside opinion.ts is mocked: the real createWait/attachAdvice/
// setOpinionStatus (src/controller/waits.ts) and the real runStep/loadRole
// (src/controller/step.ts, against the real harness/agents/sdd-advisor.md)
// all run for real against these temp dirs and the stub process.
//
// 5.3 ("the second opinion SHALL NOT answer the wait, change the run's
// status or start a run step") is marked in requirements.md as an invariant
// verified, not red-first; task 3 already covers it as a regression guard in
// src/controller/__tests__/waits.test.ts ("5.3 (regression guard) attachAdvice
// leaves the wait state and the run file unchanged", lines ~226-233): since
// opinion.ts only ever reaches the wait through attachAdvice/setOpinionStatus
// and never calls answerWait, enqueue or writeRun, that existing assertion
// continues to cover both branches (wait state, run record) here; no new red
// test is written for it (see report).
//
// 3.4 ("a second-opinion step's token usage SHALL count under the role
// sdd-advisor") is folded into the "one advisor.opinion row" assertions
// below: src/advisor/__tests__/tallies.test.ts (an earlier task) already
// proves buildTallies attributes an `events.jsonl` `advisor.opinion` row's
// usage to `byAgent['sdd-advisor']`; this file's job is only to prove
// opinion.ts writes that row with the right shape and numbers (5.6), which
// is what makes 3.4 true once both are in place (see report).
//
// The return shape of `startSecondOpinion` (`{ ok: true }` on success, or
// `{ ok: false, error: 'not-found' | 'not-open' | 'running' | 'usage-window',
// reason?: string }` on a guard) is not pinned by design.md beyond the route's
// HTTP status codes (404/409/202); this file fixes that shape as a concrete
// contract, mirroring src/advisor/__tests__/actions.test.ts's `confirmAction`
// `{ ok, error }` shape, because the route mapping itself is out of scope for
// this test (only `startSecondOpinion` is named on the task's Test: line).

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB_CLAUDE = join(HERE, '..', '..', '..', 'scripts', 'stub-claude.mjs');
const SRC_ROOT = join(HERE, '..', '..');

let home: string;
let savedSddHome: string | undefined;
let savedClaudeBin: string | undefined;
let savedClaudeScript: string | undefined;

beforeAll(() => {
  chmodSync(STUB_CLAUDE, 0o755);
});

beforeEach(async () => {
  savedSddHome = process.env.SDD_HOME;
  savedClaudeBin = process.env.CONTROLLER_CLAUDE_BIN;
  savedClaudeScript = process.env.STUB_CLAUDE_SCRIPT;
  home = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-opinion-'));
  process.env.SDD_HOME = home;
});

afterEach(async () => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  if (savedClaudeBin === undefined) delete process.env.CONTROLLER_CLAUDE_BIN;
  else process.env.CONTROLLER_CLAUDE_BIN = savedClaudeBin;
  if (savedClaudeScript === undefined) delete process.env.STUB_CLAUDE_SCRIPT;
  else process.env.STUB_CLAUDE_SCRIPT = savedClaudeScript;
  await fs.rm(home, { recursive: true, force: true });
});

/** Point CONTROLLER_CLAUDE_BIN/STUB_CLAUDE_SCRIPT at a canned run list; returns the script path. */
function useClaudeScript(runs: unknown[]): string {
  process.env.CONTROLLER_CLAUDE_BIN = STUB_CLAUDE;
  const dir = mkdtempSync(join(tmpdir(), 'sdd-advisor-opinion-claude-'));
  const scriptPath = join(dir, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
  return scriptPath;
}

/** How many times the stub has been invoked (0 when its counter file was never written). */
function invocationCount(scriptPath: string): number {
  try {
    return Number.parseInt(readFileSync(`${scriptPath}.counter`, 'utf8').trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function readEventRows(): Promise<any[]> {
  let contents: string;
  try {
    contents = await fs.readFile(eventsPath(), 'utf-8');
  } catch {
    return [];
  }
  return contents.split('\n').filter((l) => l.length > 0).map((l) => JSON.parse(l));
}

const USAGE = {
  input_tokens: 11,
  output_tokens: 222,
  cache_read_input_tokens: 333,
  cache_creation: { ephemeral_5m_input_tokens: 44, ephemeral_1h_input_tokens: 55 },
};

function fakeRun(id: string): RunRecord {
  return {
    v: 1,
    id,
    project: 'proj-1',
    codeRoot: '/irrelevant',
    specStore: '/irrelevant',
    spec: 'spec-1',
    worktree: '/irrelevant',
    branch: 'feat/thing',
    status: 'waiting',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  } as RunRecord;
}

async function makeWait(runId: string) {
  const specDir = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-opinion-specdir-'));
  return createWait({
    kind: 'question',
    runId,
    projectId: 'proj-1',
    spec: 'spec-1',
    specDir,
    questions: [{ id: 'approach', text: 'Pick a rollout approach', options: ['careful', 'fast'], recommended: 'careful' }],
  });
}

describe('src/advisor/opinion.ts', () => {
  // Added coverage (design C7 post-conditions: "404 unknown wait"), not its
  // own Requirement-5 AC number. Pre-condition: no wait with this id exists.
  // Test: startSecondOpinion('w-doesnotexist', deps). Observable result:
  // `{ ok: false, error: 'not-found' }`; the claude stub was never invoked.
  // Source: design.md C7 Post-conditions, "404 unknown wait".
  it('refuses an unknown wait with not-found, and never spawns a step', async () => {
    const script = useClaudeScript([{ result: { subtype: 'success', is_error: false, structured_output: {}, usage: USAGE } }]);

    const result = await startSecondOpinion('w-doesnotexist', { usageBlock: () => ({ blocked: false }) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not-found');
    expect(invocationCount(script)).toBe(0);
  });

  // Added coverage (design C7 post-conditions: "409 not-open"). Pre-condition:
  // a wait already answered. Test: startSecondOpinion(id, deps). Observable
  // result: `{ ok: false, error: 'not-open' }`; no step spawned; the wait's
  // advice/opinion are untouched. Source: design.md C7 Post-conditions.
  it('refuses an answered wait with not-open, and never spawns a step', async () => {
    const script = useClaudeScript([{ result: { subtype: 'success', is_error: false, structured_output: {}, usage: USAGE } }]);
    const wait = await makeWait('run-not-open');
    await answerWait(wait.id, { approach: 'careful' }, 'operator');

    const result = await startSecondOpinion(wait.id, { usageBlock: () => ({ blocked: false }) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not-open');
    expect(invocationCount(script)).toBe(0);
  });

  // Added coverage (design C7 post-conditions: "409 running when one is in
  // flight"). Pre-condition: an open wait whose opinionStatus is already
  // `running` (seeded directly through the real, unmocked `setOpinionStatus`,
  // simulating a press already in flight). Test: startSecondOpinion(id,
  // deps). Observable result: `{ ok: false, error: 'running' }`; no step
  // spawned. Source: design.md C7 Post-conditions.
  it('refuses a second press while one is in flight, and never spawns a second step', async () => {
    const script = useClaudeScript([{ result: { subtype: 'success', is_error: false, structured_output: {}, usage: USAGE } }]);
    const wait = await makeWait('run-in-flight');
    await setOpinionStatus(wait.id, { state: 'running' });

    const result = await startSecondOpinion(wait.id, { usageBlock: () => ({ blocked: false }) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('running');
    expect(invocationCount(script)).toBe(0);
  });

  // Requirement 5.5 / D9: "IF a usage window is above the controller's
  // threshold THEN the press SHALL be refused with the reason; the step
  // SHALL NOT take a run slot." Pre-condition: an open wait; `deps.usageBlock`
  // reports blocked. Test: startSecondOpinion(id, deps). Observable result:
  // `{ ok: false, error: 'usage-window', reason: <non-empty string> }`; no
  // step spawned; the wait's opinionStatus stays unset (the block happens
  // before "sets opinionStatus running"). Source: Requirement 5.5, quoted
  // above, and design.md C7 Post-conditions ("409 usage-window with the
  // reason when blocked").
  it('refuses a blocked usage window with the reason, taking no run slot', async () => {
    const script = useClaudeScript([{ result: { subtype: 'success', is_error: false, structured_output: {}, usage: USAGE } }]);
    const wait = await makeWait('run-blocked');

    const result = await startSecondOpinion(wait.id, {
      usageBlock: () => ({ blocked: true, resumeAt: '2026-10-28T00:00:00.000Z' }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('usage-window');
      expect(typeof result.reason).toBe('string');
      expect((result.reason ?? '').length).toBeGreaterThan(0);
    }
    expect(invocationCount(script)).toBe(0);

    const stored = await readWait(wait.id);
    expect(stored?.opinionStatus).toBeUndefined();
  });

  // Requirement 5.1 ("...run one headless step with the role sdd-advisor
  // through runStep, given the wait and the summary, and SHALL attach its
  // typed result to the wait") and 5.6 ("WHEN the step ends THEN the
  // controller SHALL write one advisor.opinion row to the home event log with
  // the wait id, the outcome and the usage"). Pre-condition: an open wait
  // with one options question; a RunRecord and a QueueFile already on disk
  // (standing in for "no run slot, no queue change"); the stub returns a
  // valid typed opinion. Test: startSecondOpinion(id, deps). Observable
  // result: `{ ok: true }`; the re-read wait carries `advice` ===
  // opinion.summary, `opinion` deep-equal the stub's picks/summary, and
  // `opinionStatus` cleared (undefined); one `advisor.opinion` row in
  // events.jsonl with `wait` === the wait id and the five StepUsage numbers
  // (11/222/333/44/55) from the stub's usage; the run record and the queue
  // file re-read unchanged from what was written before the call; a
  // `brief.md` was written under advisor/opinions/<waitId>/ naming the wait's
  // question text. Expected value source: Requirement 5.1 and 5.6, both
  // quoted above, and design.md C7 ("writes advisor/opinions/waitId/stamp/
  // brief.md").
  it('attaches a valid typed opinion to the wait, logs one advisor.opinion row, and leaves the run and queue unchanged', async () => {
    useClaudeScript([{
      result: {
        subtype: 'success', is_error: false, num_turns: 2, session_id: 'sess-opinion-1',
        result: 'done',
        structured_output: {
          picks: [{ question: 'approach', pick: 'careful', reason: 'Matches the team\'s usual pace and keeps risk low.' }],
          summary: 'Go with the careful rollout; it matches past incidents.',
        },
        usage: USAGE,
        duration_ms: 4321,
      },
    }]);

    const wait = await makeWait('run-opinion-ok');
    const run = fakeRun('run-opinion-ok');
    await writeRun(run);
    const before = await readRun(run.id); // writeRun stamps pausedAt on a waiting run
    const queue: QueueFile = { v: 1, runs: ['run-opinion-ok'] };
    await writeQueue(queue);

    const result = await startSecondOpinion(wait.id, { usageBlock: () => ({ blocked: false }) });
    expect(result.ok).toBe(true);

    const updated = await readWait(wait.id);
    expect(updated?.advice).toBe('Go with the careful rollout; it matches past incidents.');
    expect(updated?.opinion).toEqual({
      picks: [{ question: 'approach', pick: 'careful', reason: 'Matches the team\'s usual pace and keeps risk low.' }],
      summary: 'Go with the careful rollout; it matches past incidents.',
    });
    expect(updated?.opinionStatus).toBeUndefined();

    const rows = await readEventRows();
    const opinionRows = rows.filter((r) => r.type === 'advisor.opinion');
    expect(opinionRows).toHaveLength(1);
    expect(opinionRows[0].wait).toBe(wait.id);
    expect(typeof opinionRows[0].outcome).toBe('string');
    expect(opinionRows[0].input).toBe(11);
    expect(opinionRows[0].output).toBe(222);
    expect(opinionRows[0].cacheRead).toBe(333);
    expect(opinionRows[0].cacheWrite5m).toBe(44);
    expect(opinionRows[0].cacheWrite1h).toBe(55);

    expect(await readRun('run-opinion-ok')).toEqual(before);
    expect(await readQueue()).toEqual(queue);

    const opinionsBase = join(advisorOpinionsDir(), wait.id);
    const stamps = await fs.readdir(opinionsBase);
    expect(stamps.length).toBeGreaterThan(0);
    const brief = await fs.readFile(join(opinionsBase, stamps[0], 'brief.md'), 'utf-8');
    expect(brief).toContain('Pick a rollout approach');
  });

  // Requirement 5.7 ("IF the step fails or returns an invalid result THEN the
  // wait SHALL keep its earlier advice and the dashboard SHALL show the
  // failure; the run SHALL be unaffected") and 5.6 (one advisor.opinion row
  // either way). Pre-condition: an open wait with options ['careful','fast']
  // already carrying earlier advice (attached directly through the real,
  // unmocked attachAdvice); the stub's pick names the question but picks a
  // value outside its options ('reckless'), an invalid result per design C7
  // ("each pick names a wait question and, where options exist, one of
  // them"). Test: startSecondOpinion(id, deps). Observable result: the
  // re-read wait's `advice` is still the earlier text, unchanged; its
  // `opinionStatus` is `{ state: 'failed', reason: <non-empty string> }`; one
  // `advisor.opinion` row in events.jsonl with the wait id and the five
  // StepUsage numbers from the stub, either way. Expected value source:
  // Requirement 5.7 and 5.6, quoted above, and design.md C7 ("otherwise
  // opinionStatus failed with the reason, advice untouched").
  it('keeps the earlier advice and records opinionStatus failed for an invalid pick, still logging one advisor.opinion row', async () => {
    useClaudeScript([{
      result: {
        subtype: 'success', is_error: false, num_turns: 2, session_id: 'sess-opinion-2',
        result: 'done',
        structured_output: {
          picks: [{ question: 'approach', pick: 'reckless', reason: 'Not one of the offered options.' }],
          summary: 'This should never attach.',
        },
        usage: USAGE,
        duration_ms: 1000,
      },
    }]);

    const wait = await makeWait('run-opinion-invalid');
    await attachAdvice(wait.id, 'Earlier human-set advice, from before this press.');

    const result = await startSecondOpinion(wait.id, { usageBlock: () => ({ blocked: false }) });
    expect(result.ok).toBe(true);

    const updated = await readWait(wait.id);
    expect(updated?.advice).toBe('Earlier human-set advice, from before this press.');
    expect(updated?.opinion).toBeUndefined();
    expect(updated?.opinionStatus?.state).toBe('failed');
    expect(typeof updated?.opinionStatus?.reason).toBe('string');
    expect((updated?.opinionStatus?.reason ?? '').length).toBeGreaterThan(0);

    const rows = await readEventRows();
    const opinionRows = rows.filter((r) => r.type === 'advisor.opinion');
    expect(opinionRows).toHaveLength(1);
    expect(opinionRows[0].wait).toBe(wait.id);
    expect(opinionRows[0].input).toBe(11);
    expect(opinionRows[0].output).toBe(222);
    expect(opinionRows[0].cacheRead).toBe(333);
    expect(opinionRows[0].cacheWrite5m).toBe(44);
    expect(opinionRows[0].cacheWrite1h).toBe(55);
  });

  // Requirement 5.4 ("The controller SHALL run the second-opinion step only
  // from the operator's press; no other controller code path SHALL start an
  // sdd-advisor step") and the task's Restrictions ("opinion.ts is the only
  // runStep caller with role sdd-advisor"). Test: grep every non-test .ts
  // file under src/ for the literal role assignment `role: 'sdd-advisor'`
  // (the same literal-string-per-call-site convention every other runStep/
  // runModelStep caller in this codebase uses, e.g.
  // src/controller/phases/document.ts:753 `role: 'sdd-drafter'`). Observable
  // result: exactly one match, in src/advisor/opinion.ts. Source: Requirement
  // 5.4, quoted above, and the task's Restrictions line.
  it('is the only runStep caller with role sdd-advisor', () => {
    const pattern = /role\s*:\s*['"]sdd-advisor['"]/;
    const matches: string[] = [];

    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        if (name === '__tests__' || name === 'node_modules' || name === 'dashboard_frontend') continue;
        const full = join(dir, name);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (name.endsWith('.ts')) {
          const content = readFileSync(full, 'utf-8');
          if (pattern.test(content)) matches.push(full);
        }
      }
    };
    walk(SRC_ROOT);

    expect(matches).toHaveLength(1);
    expect(matches[0].replace(/\\/g, '/')).toMatch(/src\/advisor\/opinion\.ts$/);
  });
});
