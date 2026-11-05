import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, cpSync, chmodSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { runGate } from '../gate.js';
import { renderCaseBriefs } from '../render.js';
import { harnessHandler } from '../../tools/harness.js';
import { DeferralStorage } from '../../core/deferral-storage.js';
import type { EvalCase } from '../case.js';
import type { Fixture } from '../fixture.js';
import type { StepSpec, StepResult } from '../../controller/step.js';

// Design Component 8 (src/evals/gate.ts, design.md:109-117), Requirement 3 ACs 2, 3, 5 and
// Requirement 4 ACs 2-5: runGate(opts) selects the cases a deploy between `base` and `target`
// must run, validates every `--eval-override` id against that selection before any step spawns
// (post-condition 1, R4 AC2), runs no step and writes no record when nothing is selected
// (post-condition 2, R3 AC5), refuses an override naming a case that passed (post-condition 3,
// R4 AC2), refuses with a one-line summary when a failing or inconclusive case is not named by
// any override (post-condition 4, R3 AC3/R4 AC4), and otherwise proceeds, appending one
// `overrides.log` line and creating one `owner: harness` deferral per overridden case whose
// body names the deferral's own id in a ready-to-paste Progress log line (post-condition 5, R4
// AC3). Each test builds its own two-commit temp git repository (the gate's `repo`, `base` and
// `target`) holding a case under `harness/evals/<id>/`, with `casesRoot` pointing at that same
// repository's working tree at `target` (design D2: "the gate test needs cases at a temp
// repository's target commit"). A case added only at `target` is selected under either
// selection mode (design Component 7 post-condition 1, "a new case counts"); a case
// byte-unchanged between `base` and `target`, with no `agent-rules.md` in its fixture tree (so
// its rendered brief carries no fixture-root path), is proven unselected by handing `runGate` a
// `baseDist` whose `tools/harness.js` is baked, ahead of time, with this build's own real
// rendered text for that case — so the comparison select.ts performs internally, under either
// mode, finds no difference. Cases run through `scripts/stub-claude.mjs` (CONTROLLER_CLAUDE_BIN);
// "no spawn" is read off the stub's own counter file, never a module-private hook. Each test
// reaches the gate only through `runGate`, never a module-private helper.

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-claude.mjs');

const savedEnv = { ...process.env };

// A throwaway scratch root per test, so the runner never writes under (nor the teardown
// ever wipes) the shared `/tmp/scratchpad/sdd` that holds a live run's briefs (retro P3).
let evalScratchRoot: string;

beforeAll(() => {
  chmodSync(STUB, 0o755);
});

beforeEach(() => {
  delete process.env.SDD_RUN_ID;
  delete process.env.SDD_STEP_ID;
  evalScratchRoot = mkdtempSync(join(tmpdir(), 'swm-eval-scratch-'));
  process.env.SWM_EVAL_SCRATCH_ROOT = evalScratchRoot;
});

afterEach(() => {
  rmSync(evalScratchRoot, { recursive: true, force: true });
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(savedEnv)) {
    process.env[key] = value;
  }
});

function git(dir: string, args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

function initRepo(dir: string): void {
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 't@test']);
  git(dir, ['config', 'user.name', 'Tester']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
}

function commitAll(dir: string, message: string): string {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
  return git(dir, ['rev-parse', 'HEAD']);
}

/** A `test-author` case whose fixture has no `agent-rules.md`, so its rendered brief carries
 * no fixture-root path and is identical across any two independent renders of the same values. */
function writeDeterministicCase(repoDir: string, id: string): void {
  const caseDir = join(repoDir, 'harness', 'evals', id);
  const treeDir = join(caseDir, 'fixture', '01');
  const wf = join(treeDir, '.spec-workflow');
  const spec = `eval-${id}`;
  mkdirSync(join(wf, 'specs', spec), { recursive: true });
  writeFileSync(
    join(wf, 'specs', spec, 'tasks.md'),
    ['# Tasks', '', '- [ ] 1. Do something', '  - Test: src/foo.test.ts — calls foo', ''].join('\n'),
  );
  writeFileSync(
    join(caseDir, 'case.json'),
    JSON.stringify({
      id, role: 'sdd-test-author', phase: 'implementation', spec, turnCap: 50,
      evidence: 'docs/example.md:1-2',
      briefs: [{
        template: 'test-author', file: 'author-brief.md', taskId: '1',
        values: { title: `${id} case`, job: 'Write a failing test for task 1.' },
      }],
      fixture: { commits: [{ message: 'init', tree: 'fixture/01' }] },
      graders: [{ name: 'report-flag', args: { prefix: 'none' } }],
    }, null, 2),
  );
}

/** A `test-author` case ready to run through the stub `claude`, with the given graders. */
function writeAuthorCase(
  repoDir: string,
  id: string,
  graders: { name: string; args: Record<string, unknown> }[],
): void {
  const caseDir = join(repoDir, 'harness', 'evals', id);
  const treeDir = join(caseDir, 'fixture', '01');
  const wf = join(treeDir, '.spec-workflow');
  const spec = `eval-${id}`;
  mkdirSync(join(wf, 'specs', spec), { recursive: true });
  writeFileSync(join(wf, 'agent-rules.md'), '# Agent rules\n\nmerge: ask\n');
  writeFileSync(
    join(wf, 'specs', spec, 'tasks.md'),
    ['# Tasks', '', '- [ ] 1. Do something', '  - Test: src/foo.test.ts — calls foo', ''].join('\n'),
  );
  writeFileSync(
    join(caseDir, 'case.json'),
    JSON.stringify({
      id, role: 'sdd-test-author', phase: 'implementation', spec, turnCap: 50,
      evidence: 'docs/example.md:1-2',
      briefs: [{
        template: 'test-author', file: 'author-brief.md', taskId: '1',
        values: { title: `${id} case`, job: 'Write a failing test for task 1.' },
      }],
      fixture: { commits: [{ message: 'init', tree: 'fixture/01' }] },
      graders,
    }, null, 2),
  );
}

/** Renders `c`'s one brief through this build's real `harnessHandler`, on a throwaway root
 * copied straight from the case's own fixture tree (no git, no placeholder substitution risk). */
async function realRenderedText(caseDir: string, c: EvalCase): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), 'eval-gate-expected-'));
  const scratch = mkdtempSync(join(tmpdir(), 'eval-gate-expected-scratch-'));
  try {
    cpSync(join(caseDir, c.fixture.commits[0].tree), root, { recursive: true });
    const f: Fixture = { root, parent: root, bases: {} };
    const { texts } = await renderCaseBriefs(c, f, scratch, harnessHandler);
    return texts[c.briefs[0].template];
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** A `tools/harness.js` whose `harnessHandler` ignores its input and always writes `text`. */
function writeMatchingBaseDist(baseDistDir: string, text: string): void {
  mkdirSync(join(baseDistDir, 'tools'), { recursive: true });
  writeFileSync(join(baseDistDir, 'package.json'), '{"type":"module"}\n');
  writeFileSync(
    join(baseDistDir, 'tools', 'harness.js'),
    [
      "import { writeFileSync } from 'fs';",
      'export async function harnessHandler(args) {',
      `  writeFileSync(args.values.path, ${JSON.stringify(text)}, 'utf-8');`,
      '  return { success: true, data: { path: args.values.path } };',
      '}',
      '',
    ].join('\n'),
  );
}

/** Writes a fresh `STUB_CLAUDE_SCRIPT` in its own scratch directory and points
 * `CONTROLLER_CLAUDE_BIN` at the stub; returns the script path (its `.counter` sibling records
 * whether the stub was ever invoked). */
function writeScript(runs: unknown[]): string {
  const scriptDir = mkdtempSync(join(tmpdir(), 'eval-gate-script-'));
  const scriptPath = join(scriptDir, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
  return scriptPath;
}

function okRun(sessionId: string, flag: string): Record<string, unknown> {
  return {
    result: {
      subtype: 'success', is_error: false, num_turns: 2, session_id: sessionId,
      result: 'wrote tests',
      structured_output: { commit: 'none', files: ['src/foo.test.ts'], flag },
      usage: {
        input_tokens: 6, output_tokens: 4, cache_read_input_tokens: 2,
        cache_creation: { ephemeral_5m_input_tokens: 1, ephemeral_1h_input_tokens: 1 },
      },
    },
    exitCode: 0,
  };
}

function cleanup(...dirs: string[]): void {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}

const ZERO_USAGE = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };

/** The case id a run's `logPath` names (`<id>-r<n>.jsonl`, `src/evals/runner.ts:181`). */
function caseIdFromLogPath(logPath: string): string {
  const base = logPath.split(/[\\/]/).pop() ?? '';
  const match = base.match(/^(.+)-r\d+\.jsonl$/);
  return match ? match[1] : base;
}

function stepResultFor(verdict: 'pass' | 'fail' | 'usage-limit'): StepResult {
  if (verdict === 'usage-limit') {
    return {
      structuredOutput: null, usage: ZERO_USAGE, sessionId: null, numTurns: 1, isError: false,
      subtype: null, resultText: null, exitCode: null, classification: 'usage-limit', durationMs: 0,
    };
  }
  return {
    structuredOutput: { commit: 'none', files: [], flag: verdict === 'pass' ? 'none' : 'bad' },
    usage: ZERO_USAGE, sessionId: null, numTurns: 1, isError: false, subtype: 'success',
    resultText: '', exitCode: 0, classification: 'ok', durationMs: 0,
  };
}

/** A `RunGateOpts.step` stub that counts calls per case id, read off `logPath`, and returns the
 * next verdict from that case's scripted sequence (repeating the sequence's last entry past its
 * end; a case absent from `scripts` always reports `pass`). */
function scriptedStep(
  calls: Record<string, number>,
  scripts: Record<string, Array<'pass' | 'fail' | 'usage-limit'>>,
): (spec: StepSpec) => Promise<StepResult> {
  return async (spec: StepSpec): Promise<StepResult> => {
    const id = caseIdFromLogPath(spec.logPath);
    const n = (calls[id] = (calls[id] ?? 0) + 1);
    const seq = scripts[id] ?? ['pass'];
    const verdict = seq[Math.min(n - 1, seq.length - 1)];
    return stepResultFor(verdict);
  };
}

/** The R1 AC2 fixture (design.md Testing Strategy): `old-case` from `writeDeterministicCase` at
 * `base`, with `harness/agents/sdd-test-author.md` present; `target` edits that role file and
 * adds `new-case`. `baseDist` is baked, via `writeMatchingBaseDist`, with `old-case`'s own real
 * rendered text, so `old-case` ends up selected by `role` alone; `new-case`, new at `target`, is
 * selected by `case` (and, through the same role-file edit, `role` too). */
async function buildTwoCaseFixture(): Promise<{
  dir: string; base: string; target: string; target12: string; casesRoot: string; baseDist: string;
}> {
  const dir = mkdtempSync(join(tmpdir(), 'eval-gate-'));
  initRepo(dir);
  writeFileSync(join(dir, 'README.md'), 'hello\n');
  mkdirSync(join(dir, 'harness', 'agents'), { recursive: true });
  writeFileSync(join(dir, 'harness', 'agents', 'sdd-test-author.md'), '# sdd-test-author\n\nv1\n');
  writeDeterministicCase(dir, 'old-case');
  const base = commitAll(dir, 'base');

  const oldCaseDir = join(dir, 'harness', 'evals', 'old-case');
  const c = JSON.parse(readFileSync(join(oldCaseDir, 'case.json'), 'utf8')) as EvalCase;
  const text = await realRenderedText(oldCaseDir, c);
  const baseDist = mkdtempSync(join(tmpdir(), 'eval-gate-basedist-'));
  writeMatchingBaseDist(baseDist, text);

  writeFileSync(join(dir, 'harness', 'agents', 'sdd-test-author.md'), '# sdd-test-author\n\nv2\n');
  writeAuthorCase(dir, 'new-case', [{ name: 'report-flag', args: { prefix: 'none' } }]);
  const target = commitAll(dir, 'target');

  return {
    dir, base, target, target12: target.slice(0, 12), casesRoot: join(dir, 'harness', 'evals'), baseDist,
  };
}

describe('runGate(opts)', () => {
  // Pre-condition: a two-commit repo holding one case, `demo-case`, byte-identical at `base`
  // and `target` (only an unrelated `README.md` edit separates the commits), with a `baseDist`
  // baked, ahead of time, to this build's own real rendered text for that case — so, under
  // either selection mode, `demo-case` ends up with zero selection reasons (unselected). No
  // case at all exists under the id `missing-id`.
  // Test: two calls to runGate({ repo, base, target, casesRoot, overrides: [<id>], summaryFile,
  // home }), one with `overrides: ['missing-id']`, one with `overrides: ['demo-case']` and
  // `baseDist` given.
  // Observable result: both calls return `exit: 2`; neither call's stub `claude` is ever
  // invoked (its script's `.counter` sibling is never created); each `summaryFile` is written
  // and names the offending override id.
  // Expected-value source: design.md Component 8 post-condition 1 (design.md:113, "Before any
  // run, an override that names no case at `target` or an unselected case gives exit 2 with the
  // reason in `summaryFile`"); requirements.md R4 AC2 (requirements.md:67, "refuse before any
  // swap and print the reason"); tasks.md task 9 Prompt, "an override naming no case or an
  // unselected case gives exit 2 before any spawn".
  it('refuses, before any spawn, an override naming no case at target and one naming an unselected case', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-gate-'));
    initRepo(dir);
    writeFileSync(join(dir, 'README.md'), 'hello\n');
    writeDeterministicCase(dir, 'demo-case');
    const base = commitAll(dir, 'base');
    writeFileSync(join(dir, 'README.md'), 'hello v2\n');
    const target = commitAll(dir, 'target');

    const caseDir = join(dir, 'harness', 'evals', 'demo-case');
    const c = JSON.parse(readFileSync(join(caseDir, 'case.json'), 'utf8')) as EvalCase;
    const text = await realRenderedText(caseDir, c);
    const baseDist = mkdtempSync(join(tmpdir(), 'eval-gate-basedist-'));
    writeMatchingBaseDist(baseDist, text);

    const casesRoot = join(dir, 'harness', 'evals');
    const home1 = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const home2 = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile1 = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    const summaryFile2 = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');

    const scriptPath1 = writeScript([]);
    const result1 = await runGate({
      repo: dir, base, target, casesRoot, overrides: ['missing-id'],
      summaryFile: summaryFile1, home: home1,
    });
    expect(result1.exit).toBe(2);
    expect(existsSync(`${scriptPath1}.counter`)).toBe(false);
    expect(readFileSync(summaryFile1, 'utf8')).toContain('missing-id');

    const scriptPath2 = writeScript([]);
    const result2 = await runGate({
      repo: dir, base, target, baseDist, casesRoot, overrides: ['demo-case'],
      summaryFile: summaryFile2, home: home2,
    });
    expect(result2.exit).toBe(2);
    expect(existsSync(`${scriptPath2}.counter`)).toBe(false);
    expect(readFileSync(summaryFile2, 'utf8')).toContain('demo-case');

    cleanup(dir, baseDist, home1, home2, dirname(summaryFile1), dirname(summaryFile2));
  });

  // Pre-condition: a two-commit repo with an empty `harness/evals/` directory at both commits
  // (no case defined at all; only an unrelated `README.md` edit separates the commits); no
  // override is given.
  // Test: runGate({ repo, base, target, casesRoot, overrides: [], summaryFile, home }).
  // Observable result: `exit: 0`; the stub `claude`'s script `.counter` sibling is never
  // created (no spawn); the home directory holds no `evals/` tree at all (no record).
  // Expected-value source: design.md Component 8 post-condition 2 (design.md:114, "No
  // selection gives exit 0, no spawn, no record (R3 AC5)"); requirements.md R3 AC5
  // (requirements.md:55); tasks.md task 9 Prompt, "no selection gives exit 0, no stub
  // invocation and no record".
  it('gives exit 0 with no spawn and no record when nothing is selected', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-gate-'));
    initRepo(dir);
    mkdirSync(join(dir, 'harness', 'evals'), { recursive: true });
    writeFileSync(join(dir, 'README.md'), 'hello\n');
    const base = commitAll(dir, 'base');
    writeFileSync(join(dir, 'README.md'), 'hello v2\n');
    const target = commitAll(dir, 'target');

    const casesRoot = join(dir, 'harness', 'evals');
    const home = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    const scriptPath = writeScript([]);

    const result = await runGate({
      repo: dir, base, target, casesRoot, overrides: [], summaryFile, home,
    });

    expect(result.exit).toBe(0);
    expect(existsSync(`${scriptPath}.counter`)).toBe(false);
    expect(existsSync(join(home, 'evals'))).toBe(false);

    cleanup(dir, home, dirname(summaryFile));
  });

  // Pre-condition: a two-commit repo whose `target` adds `pass-case`, a `test-author` case
  // whose only grader (`report-flag`, prefix `none`) passes on every run the stub reports (the
  // stub's `flag` is `none`); the override names this case.
  // Test: runGate({ repo, base, target, casesRoot, overrides: ['pass-case'], summaryFile,
  // home }).
  // Observable result: `exit: 2` (the override is refused because the case it names passed).
  // Expected-value source: design.md Component 8 post-condition 3 (design.md:115, "After the
  // runs ..., an override naming a passed case gives exit 2 (R4 AC2)"); requirements.md R4 AC2
  // (requirements.md:67, "a case that passed"); tasks.md task 9 Prompt, "a passed case named
  // by an override gives exit 2".
  it('refuses with exit 2 when an override names a case that passed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-gate-'));
    initRepo(dir);
    writeFileSync(join(dir, 'README.md'), 'hello\n');
    const base = commitAll(dir, 'base');
    writeAuthorCase(dir, 'pass-case', [{ name: 'report-flag', args: { prefix: 'none' } }]);
    const target = commitAll(dir, 'target');

    const casesRoot = join(dir, 'harness', 'evals');
    const home = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    writeScript([okRun('s1', 'none'), okRun('s2', 'none'), okRun('s3', 'none')]);

    const result = await runGate({
      repo: dir, base, target, casesRoot, overrides: ['pass-case'], summaryFile, home,
    });

    expect(result.exit).toBe(2);

    cleanup(dir, home, dirname(summaryFile));
  });

  // Pre-condition: a two-commit repo whose `target` adds `fail-case`, a `test-author` case
  // whose only grader (`report-flag`, prefix `SEAM-DEFECT:`) fails on every run (the stub's
  // `flag` is `none`); no override is given.
  // Test: runGate({ repo, base, target, casesRoot, overrides: [], summaryFile, home }).
  // Observable result: `exit: 1`; `summaryFile` reads exactly `<target 12>: fail-case fail 0/3
  // <first reason>; record <result.record>`; no `<home>/evals/overrides.log` is written; no
  // deferral exists under the repo's `.spec-workflow/deferrals/`.
  // Expected-value source: design.md Component 8 post-condition 4 (design.md:116, "A `fail` or
  // `inconclusive` case no override names gives exit 1, no override line, no deferral (R4 AC4).
  // `summaryFile` gets `<target 12>: <id> <first reason>; …; record <path>`"); requirements.md
  // R3 AC3 (requirements.md:53) and R4 AC4 (requirements.md:69); tasks.md task 9 Prompt, "an
  // unnamed failing case gives exit 1, the summary line in the design format, no override line
  // and no deferral".
  it('refuses with exit 1 and the design-format summary line when a failing case is not named by any override', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-gate-'));
    initRepo(dir);
    writeFileSync(join(dir, 'README.md'), 'hello\n');
    const base = commitAll(dir, 'base');
    writeAuthorCase(dir, 'fail-case', [{ name: 'report-flag', args: { prefix: 'SEAM-DEFECT:' } }]);
    const target = commitAll(dir, 'target');
    const target12 = target.slice(0, 12);

    const casesRoot = join(dir, 'harness', 'evals');
    const home = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    writeScript([okRun('s1', 'none'), okRun('s2', 'none'), okRun('s3', 'none')]);

    const result = await runGate({
      repo: dir, base, target, casesRoot, overrides: [], summaryFile, home,
    });

    expect(result.exit).toBe(1);
    expect(result.record).toBeDefined();
    expect(existsSync(result.record as string)).toBe(true);

    const expectedReason = 'flag "none" does not start with "SEAM-DEFECT:"';
    expect(readFileSync(summaryFile, 'utf8').trim()).toBe(
      `${target12}: fail-case fail 0/3 ${expectedReason}; record ${result.record}`,
    );
    expect(existsSync(join(home, 'evals', 'overrides.log'))).toBe(false);
    const deferralsDir = join(dir, '.spec-workflow', 'deferrals');
    const deferralFiles = existsSync(deferralsDir)
      ? readdirSync(deferralsDir).filter((f) => f.endsWith('.md'))
      : [];
    expect(deferralFiles).toHaveLength(0);

    cleanup(dir, home, dirname(summaryFile));
  });

  // Pre-condition: the same `fail-case` as above, this time named by one `--eval-override`.
  // Test: runGate({ repo, base, target, casesRoot, overrides: ['fail-case'], summaryFile,
  // home }).
  // Observable result: `exit: 0`; `<home>/evals/overrides.log` holds exactly one tab-separated
  // line (date, `target12`, `fail-case`, `fail`); the repo's `.spec-workflow/deferrals/` holds
  // exactly one deferral whose `owner` is `harness`, whose title is `Eval case fail-case
  // overridden at <target12>`, whose `tags` is `['eval-override']`, whose `originSpec` and
  // `originPhase` are `null`, whose `revisitTrigger` is `eval case fail-case passes`, whose
  // `body.decision` is `override at deploy`, whose `body.revisitCriteria` is `case fail-case
  // passes 3/3`, and whose `body.context` is the ready-to-paste Progress log line naming the
  // case's verdict and first reason and ending `deferral <the deferral's own id>.`.
  // Expected-value source: design.md Component 8 post-condition 5 (design.md:117, the full
  // `create`/`update` and override-log text); requirements.md R4 AC3 (requirements.md:68,
  // "append one line to an override log ... create one deferral ... owner `harness`, the case
  // id in its title, and the ready-to-paste Progress log line in its body"); tasks.md task 9
  // Prompt, "a failing case named by an override gives exit 0, one `overrides.log` line and one
  // deferral with owner `harness`, the case id in its title and the Progress log line, holding
  // the deferral id, in its context".
  it('proceeds with exit 0, one overrides.log line and one harness deferral when every failing case is named by an override', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-gate-'));
    initRepo(dir);
    writeFileSync(join(dir, 'README.md'), 'hello\n');
    const base = commitAll(dir, 'base');
    writeAuthorCase(dir, 'fail-case', [{ name: 'report-flag', args: { prefix: 'SEAM-DEFECT:' } }]);
    const target = commitAll(dir, 'target');
    const target12 = target.slice(0, 12);

    const casesRoot = join(dir, 'harness', 'evals');
    const home = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    writeScript([okRun('s1', 'none'), okRun('s2', 'none'), okRun('s3', 'none')]);

    const result = await runGate({
      repo: dir, base, target, casesRoot, overrides: ['fail-case'], summaryFile, home,
    });

    expect(result.exit).toBe(0);

    const overridesLogPath = join(home, 'evals', 'overrides.log');
    const lines = readFileSync(overridesLogPath, 'utf8').split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    const [date, loggedTarget12, loggedId, loggedVerdict] = lines[0].split('\t');
    expect(loggedTarget12).toBe(target12);
    expect(loggedId).toBe('fail-case');
    expect(loggedVerdict).toBe('fail');
    expect(Number.isNaN(Date.parse(date))).toBe(false);

    const storage = new DeferralStorage(dir);
    const all = await storage.list();
    expect(all).toHaveLength(1);
    const deferral = all[0];
    expect(deferral.owner).toBe('harness');
    expect(deferral.title).toBe(`Eval case fail-case overridden at ${target12}`);
    expect(deferral.tags).toEqual(['eval-override']);
    expect(deferral.originSpec).toBeNull();
    expect(deferral.originPhase).toBeNull();
    expect(deferral.revisitTrigger).toBe('eval case fail-case passes');
    expect(deferral.body.decision).toBe('override at deploy');
    expect(deferral.body.revisitCriteria).toBe('case fail-case passes 3/3');

    const expectedReason = 'flag "none" does not start with "SEAM-DEFECT:"';
    const escaped = expectedReason.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    expect(deferral.body.context).toMatch(
      new RegExp(`^- \\d{4}-\\d{2}-\\d{2} — deploy ${target12} overrode eval case fail-case \\(fail, ${escaped}\\); deferral ${deferral.id}\\.$`),
    );

    cleanup(dir, home, dirname(summaryFile));
  });

  // Pre-condition: `buildTwoCaseFixture()`: `old-case`, unchanged between `base` and `target`,
  // selected only by `role`; `new-case`, added at `target`, selected by `case` (and `role`). A
  // `step` stub counts calls per case id (read off `logPath`) and reports `pass` for every call.
  // No override is given.
  // Test: runGate({ repo, base, target, baseDist, casesRoot, overrides: [], summaryFile, home,
  // step, onLine }), with `onLine` collecting every line it receives into an array.
  // Observable result: the step stub is called 3 times for `new-case` and 1 time for
  // `old-case`; the returned `record`'s `new-case` entry holds 3 `runs` entries and its
  // `old-case` entry holds 1; the collected lines include one containing `pass 3/3` and one
  // containing `pass 1/1`.
  // Expected-value source: design.md Component 3 post-condition 1 (design.md:60, "runGate
  // builds runsByCase from selected with plannedRuns, and passes it and opts.onLine in the
  // runCases call"); requirements.md R1 AC1 (requirements.md:19), AC2 (requirements.md:20) and
  // R3 AC1 (requirements.md:45), AC3 (requirements.md:47); tasks.md task 3 Prompt Success, "a
  // gate over new-case and old-case (reason role only) makes 3 step calls for new-case and 1
  // for old-case; that run's record holds 3 and 1 runs entries, and onLine gets lines holding
  // pass 3/3 and pass 1/1".
  it('makes 3 step calls for the case-reason case and 1 for the role-only case, with matching run counts and onLine lines', async () => {
    const { dir, base, target, casesRoot, baseDist } = await buildTwoCaseFixture();
    const home = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    const calls: Record<string, number> = {};
    const lines: string[] = [];

    const result = await runGate({
      repo: dir, base, target, baseDist, casesRoot, overrides: [], summaryFile, home,
      step: scriptedStep(calls, {}),
      onLine: (line: string) => lines.push(line),
    });

    expect(result.exit).toBe(0);
    expect(calls['new-case']).toBe(3);
    expect(calls['old-case']).toBe(1);

    const record = JSON.parse(readFileSync(result.record as string, 'utf8'));
    expect(record.cases.find((c: { id: string }) => c.id === 'new-case').runs).toHaveLength(3);
    expect(record.cases.find((c: { id: string }) => c.id === 'old-case').runs).toHaveLength(1);

    expect(lines.some((l) => l.includes('pass 3/3'))).toBe(true);
    expect(lines.some((l) => l.includes('pass 1/1'))).toBe(true);

    cleanup(dir, baseDist, home, dirname(summaryFile));
  });

  // Pre-condition: `buildTwoCaseFixture()`, with a `step` stub that fails `old-case`'s one run
  // (`pass` for `new-case`'s 3 runs); no override is given.
  // Test: runGate({ repo, base, target, baseDist, casesRoot, overrides: [], summaryFile, home,
  // step }).
  // Observable result: `exit: 1`; the step stub is called exactly once for `old-case`;
  // `summaryFile` contains `fail 0/1`.
  // Expected-value source: design.md Component 3 post-condition 2 (design.md:61, "<passed>/
  // <runs>" in the summary); requirements.md R2 AC1 (requirements.md:33) and R3 AC2
  // (requirements.md:46); tasks.md task 3 Prompt Success, "a failing grader on the 1-run case
  // with no override gives exit 1, 1 step call and a summary holding fail 0/1".
  it('gives exit 1, one step call and a summary holding fail 0/1 when the 1-run case fails its grader', async () => {
    const { dir, base, target, casesRoot, baseDist } = await buildTwoCaseFixture();
    const home = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    const calls: Record<string, number> = {};

    const result = await runGate({
      repo: dir, base, target, baseDist, casesRoot, overrides: [], summaryFile, home,
      step: scriptedStep(calls, { 'old-case': ['fail'] }),
    });

    expect(result.exit).toBe(1);
    expect(calls['old-case']).toBe(1);
    expect(readFileSync(summaryFile, 'utf8')).toContain('fail 0/1');

    cleanup(dir, baseDist, home, dirname(summaryFile));
  });

  // Pre-condition: `buildTwoCaseFixture()`, with a `step` stub reporting `old-case`'s one run
  // as classified `usage-limit` (`pass` for `new-case`'s 3 runs); no override is given.
  // Test: runGate({ repo, base, target, baseDist, casesRoot, overrides: [], summaryFile, home,
  // step }).
  // Observable result: `exit: 1`; `summaryFile` contains `inconclusive 0/1`.
  // Expected-value source: requirements.md R2 AC2 (requirements.md:34, "the case verdict SHALL
  // be inconclusive ... and the gate SHALL exit 1"); design.md Component 3 post-condition 2;
  // tasks.md task 3 Prompt Success, "a stub step classified usage-limit on the 1-run case gives
  // exit 1 and a summary holding inconclusive 0/1".
  it('gives exit 1 and a summary holding inconclusive 0/1 when the 1-run case is classified usage-limit', async () => {
    const { dir, base, target, casesRoot, baseDist } = await buildTwoCaseFixture();
    const home = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    const calls: Record<string, number> = {};

    const result = await runGate({
      repo: dir, base, target, baseDist, casesRoot, overrides: [], summaryFile, home,
      step: scriptedStep(calls, { 'old-case': ['usage-limit'] }),
    });

    expect(result.exit).toBe(1);
    expect(readFileSync(summaryFile, 'utf8')).toContain('inconclusive 0/1');

    cleanup(dir, baseDist, home, dirname(summaryFile));
  });

  // Pre-condition: `buildTwoCaseFixture()`, with a `step` stub failing `old-case`'s one run
  // (`pass` for `new-case`'s 3 runs); the override names `old-case`.
  // Test: runGate({ repo, base, target, baseDist, casesRoot, overrides: ['old-case'],
  // summaryFile, home, step }).
  // Observable result: `exit: 0`; the deferral created for `old-case` has `body.revisitCriteria`
  // equal to `case old-case passes 1/1`.
  // Expected-value source: design.md Component 3 post-condition 3 (design.md:62,
  // "revisitCriteria ... reads case <id> passes <n>/<n>, with n equal to c.runs.length");
  // requirements.md R3 AC5 (requirements.md:49, "the number comes from the case's real run
  // count"); tasks.md task 3 Prompt Success, "an override of the failed 1-run case gives exit 0
  // and revisitCriteria of case <id> passes 1/1".
  it('gives exit 0 and a revisitCriteria of case <id> passes 1/1 when an override names the failed 1-run case', async () => {
    const { dir, base, target, target12, casesRoot, baseDist } = await buildTwoCaseFixture();
    const home = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    const calls: Record<string, number> = {};

    const result = await runGate({
      repo: dir, base, target, baseDist, casesRoot, overrides: ['old-case'], summaryFile, home,
      step: scriptedStep(calls, { 'old-case': ['fail'] }),
    });

    expect(result.exit).toBe(0);

    const storage = new DeferralStorage(dir);
    const all = await storage.list();
    const deferral = all.find((d) => d.title === `Eval case old-case overridden at ${target12}`);
    expect(deferral?.body.revisitCriteria).toBe('case old-case passes 1/1');

    cleanup(dir, baseDist, home, dirname(summaryFile));
  });

  // Pre-condition: `buildTwoCaseFixture()`, with a `step` stub failing only `new-case`'s first
  // run and passing its second and third (`old-case`'s one run passes); no override is given.
  // Test: runGate({ repo, base, target, baseDist, casesRoot, overrides: [], summaryFile, home,
  // step }).
  // Observable result: the step stub is called 3 times for `new-case` (the run loop keeps going
  // after the first failure — a regression guard for requirement 2.4's step count, true at
  // base); `exit: 1`; `summaryFile` contains `fail 2/3`.
  // Expected-value source: requirements.md R2 AC4 (requirements.md:36, "the remaining runs of
  // that case SHALL still run"), invariant verified not red-first; design.md Component 3
  // post-condition 2 (the `<passed>/<runs>` text, which is new); tasks.md task 3 Prompt Success,
  // "a 3-run case that fails only its first run makes 3 step calls (regression guard,
  // requirement 2.4) and its summary reads fail 2/3".
  it('keeps running a 3-run case after its first run fails, and reports fail 2/3', async () => {
    const { dir, base, target, casesRoot, baseDist } = await buildTwoCaseFixture();
    const home = mkdtempSync(join(tmpdir(), 'eval-gate-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-gate-summary-')), 'summary.txt');
    const calls: Record<string, number> = {};

    const result = await runGate({
      repo: dir, base, target, baseDist, casesRoot, overrides: [], summaryFile, home,
      step: scriptedStep(calls, { 'new-case': ['fail', 'pass', 'pass'] }),
    });

    expect(result.exit).toBe(1);
    expect(calls['new-case']).toBe(3);
    expect(readFileSync(summaryFile, 'utf8')).toContain('fail 2/3');

    cleanup(dir, baseDist, home, dirname(summaryFile));
  });
});
