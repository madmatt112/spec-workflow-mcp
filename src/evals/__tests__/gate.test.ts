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

beforeAll(() => {
  chmodSync(STUB, 0o755);
});

beforeEach(() => {
  delete process.env.SDD_RUN_ID;
  delete process.env.SDD_STEP_ID;
});

afterEach(() => {
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
  rmSync('/tmp/scratchpad/sdd', { recursive: true, force: true });
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
  // Observable result: `exit: 1`; `summaryFile` reads exactly `<target 12>: fail-case <first
  // reason>; record <result.record>`; no `<home>/evals/overrides.log` is written; no deferral
  // exists under the repo's `.spec-workflow/deferrals/`.
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
      `${target12}: fail-case ${expectedReason}; record ${result.record}`,
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
});
