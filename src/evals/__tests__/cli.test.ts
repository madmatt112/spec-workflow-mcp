import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, chmodSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execFileSync } from 'child_process';
import { main } from '../cli.js';

// Design Component 9 (src/evals/cli.ts, design.md:119-125), Requirement 2 AC9 and
// Requirement 3 AC7: main(argv) is the built package's own entry for the eval runner
// (design.md:120, "its own entry because src/index.ts rejects unknown flags"). An unknown
// flag or a flag given with no value exits 2 with a usage line (design.md:125). The bare
// form (`[<id> …]`) runs the named cases, or every case with none, deleting any inherited
// SDD_RUN_ID / SDD_STEP_ID first (design Component 6, "Record", design.md:95) and printing
// the runner's own per-case lines and the result record path (design.md:122). `select`
// prints `select <id>: <reasons>`, with ` (provisional)` appended under `--provisional`
// (design.md:123). `gate` forwards its flags into runGate and returns its own exit code
// (design.md:124). Each test reaches the CLI only through `main`, never a module-private
// helper; the `run`/`gate` tests pass `{ casesRoot, home }` as `main`'s own optional,
// non-flag second argument — the same test seam `runCases`/`runGate` already expose on
// their own `opts` (design.md:84,111) — so a case defined in a throwaway temp git
// repository, run through the stub `claude` (CONTROLLER_CLAUDE_BIN), never touches this
// build's real `harness/evals/` or the operator's real controller home.

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

/** Captures everything `fn` prints via `console.log` or `process.stdout.write`, restitching
 * both into one string (design.md:125's restriction is stdout-only; cli.ts may use either). */
async function captureStdout(fn: () => Promise<number>): Promise<{ exit: number; output: string }> {
  const chunks: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    chunks.push(args.map((a) => String(a)).join(' '));
  });
  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    chunks.push(typeof chunk === 'string' ? chunk : String(chunk));
    return true;
  });
  try {
    const exit = await fn();
    return { exit, output: chunks.join('\n') };
  } finally {
    logSpy.mockRestore();
    writeSpy.mockRestore();
  }
}

/** A fresh cases root holding one no-op-grader `sdd-test-author` case, so it always passes. */
function writeTestAuthorCase(casesRoot: string, id: string): void {
  const caseDir = join(casesRoot, id);
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
      graders: [],
    }, null, 2),
  );
}

/** A `test-author` case directory under a temp repo's `harness/evals/`, with the given graders. */
function writeAuthorCaseDir(
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

/** A `tools/harness.js` under `baseDistDir` whose `harnessHandler` forwards to this build's
 * own real one. `selectCases`'s exact-mode comparison renders both ends off the same
 * fixture within one call, so an unchanged case's brief renders byte-identical through
 * either handler — this stands in for an unchanged old build without pinning an absolute
 * fixture path baked in from a separate, throwaway render context. */
function writeMatchingBaseDist(baseDistDir: string): void {
  const realHarness = pathToFileURL(join(HERE, '..', '..', '..', 'dist', 'tools', 'harness.js')).href;
  mkdirSync(join(baseDistDir, 'tools'), { recursive: true });
  writeFileSync(join(baseDistDir, 'package.json'), '{"type":"module"}\n');
  writeFileSync(
    join(baseDistDir, 'tools', 'harness.js'),
    [
      'export async function harnessHandler(args, context) {',
      `  const mod = await import(${JSON.stringify(realHarness)});`,
      '  return mod.harnessHandler(args, context);',
      '}',
      '',
    ].join('\n'),
  );
}

/** Shared infra (role file, profile entry, brief-source files, README) plus one `demo` case,
 * for a repo whose only difference between `base` and `target` is brief-source text. */
function writeSelectRepo(dir: string): void {
  mkdirSync(join(dir, 'harness', 'agents'), { recursive: true });
  writeFileSync(join(dir, 'harness', 'agents', 'sdd-test-author.md'), 'role body v1\n');
  writeFileSync(
    join(dir, 'harness', 'agent-profiles.json'),
    JSON.stringify({ 'sdd-test-author': { model: 'sonnet' } }, null, 2),
  );
  mkdirSync(join(dir, 'src', 'tools'), { recursive: true });
  writeFileSync(join(dir, 'src', 'tools', 'brief-templates.ts'), '// brief templates v1\n');
  writeFileSync(join(dir, 'src', 'tools', 'harness.ts'), '// harness v1\n');
  writeFileSync(join(dir, 'README.md'), 'hello\n');
  writeAuthorCaseDir(dir, 'cli-demo', [{ name: 'report-flag', args: { prefix: 'none' } }]);
}

/** Writes a fresh `STUB_CLAUDE_SCRIPT` in its own scratch directory and points
 * `CONTROLLER_CLAUDE_BIN` at the stub; returns the script path (its `.counter` sibling
 * records whether the stub was ever invoked). */
function writeScript(runs: unknown[]): string {
  const scriptDir = mkdtempSync(join(tmpdir(), 'eval-cli-script-'));
  const scriptPath = join(scriptDir, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
  return scriptPath;
}

function okRun(sessionId: string): Record<string, unknown> {
  return {
    result: {
      subtype: 'success', is_error: false, num_turns: 2, session_id: sessionId,
      result: 'wrote tests',
      structured_output: { commit: 'none', files: ['src/foo.test.ts'], flag: 'none' },
      usage: {
        input_tokens: 6, output_tokens: 4, cache_read_input_tokens: 2,
        cache_creation: { ephemeral_5m_input_tokens: 1, ephemeral_1h_input_tokens: 1 },
      },
    },
    exitCode: 0,
  };
}

/** A tracked `README.md`, committed, for the "run" command's live-checkout snapshot. */
function makeLiveCheckout(): string {
  const dir = mkdtempSync(join(tmpdir(), 'eval-cli-live-'));
  initRepo(dir);
  writeFileSync(join(dir, 'README.md'), 'hello\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

function cleanup(...dirs: string[]): void {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}

describe('main(argv)', () => {
  // Pre-condition: none; `argv` holds one token that looks like a flag (starts with `--`)
  // but matches none of the CLI's own flags.
  // Test: main(['--totally-bogus']).
  // Observable result: the returned exit code is 2; the captured stdout output carries a
  // usage line (matches /usage/i).
  // Expected-value source: design.md Component 9 (design.md:125, "An unknown flag or
  // missing value exits 2 with a usage line"); tasks.md task 10 Prompt/Success, "an unknown
  // flag ... exit[s] 2 with a usage line".
  it('exits 2 with a usage line on an unknown flag', async () => {
    const { exit, output } = await captureStdout(() => main(['--totally-bogus']));
    expect(exit).toBe(2);
    expect(output).toMatch(/usage/i);
  });

  // Pre-condition: none; `argv` names the `select` form's `--repo` flag as its last token,
  // with no value token after it.
  // Test: main(['select', '--repo']).
  // Observable result: the returned exit code is 2; the captured stdout output carries a
  // usage line (matches /usage/i).
  // Expected-value source: design.md Component 9 (design.md:125, "An unknown flag or
  // missing value exits 2 with a usage line"); tasks.md task 10 Prompt/Success, "a missing
  // value ... exit[s] 2 with a usage line".
  it('exits 2 with a usage line when a flag is given with no value', async () => {
    const { exit, output } = await captureStdout(() => main(['select', '--repo']));
    expect(exit).toBe(2);
    expect(output).toMatch(/usage/i);
  });

  // Pre-condition: a two-commit temp repo holding one case (`cli-demo`, unchanged at both
  // commits) whose only difference between `base` and `target` is the content of
  // `src/tools/brief-templates.ts` — the "brief source" trigger (design.md:107, D5).
  // Test: main(['select', '--repo', dir, '--base', base, '--target', target, '--provisional']).
  // Observable result: the returned exit code is 0; the captured stdout output contains the
  // literal line `select cli-demo: brief source (provisional)`.
  // Expected-value source: design.md Component 9 (design.md:123, "prints `select <id>:
  // <reasons>`, plus ` (provisional)` when marked; exit 0") and Component 7 post-condition 6
  // (design.md:107, the `brief source` / `provisional: true` pairing); tasks.md task 10
  // Prompt/Success, "`select` ... prints its lines, exit 0, with the provisional suffix
  // under `--provisional`".
  it('prints select <id>: <reasons> with the provisional suffix under --provisional, and exits 0', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-cli-select-'));
    initRepo(dir);
    writeSelectRepo(dir);
    const base = commitAll(dir, 'base');
    writeFileSync(join(dir, 'src', 'tools', 'brief-templates.ts'), '// brief templates v2\n');
    const target = commitAll(dir, 'target');

    const { exit, output } = await captureStdout(() =>
      main(['select', '--repo', dir, '--base', base, '--target', target, '--provisional']),
    );

    expect(exit).toBe(0);
    expect(output).toContain('select cli-demo: brief source (provisional)');

    cleanup(dir);
  });

  // Pre-condition: a fresh temp cases root holding one no-op-grader `sdd-test-author` case
  // (`cli-pass-case`, always passes), a fresh temp home, a fresh temp live checkout, the
  // stub `claude` scripted with 3 `ok` runs, and `SDD_RUN_ID` set in `process.env` before
  // the call (simulating a leaked ambient run id).
  // Test: main(['--live-checkout', liveCheckout, 'cli-pass-case'], { casesRoot, home }).
  // Observable result: the returned exit code is 0; `process.env.SDD_RUN_ID` is `undefined`
  // afterward; the captured stdout output contains the runner's own case line (`eval
  // cli-pass-case: pass 3/3, 42 tokens`) and the path of the one result-record file the run
  // wrote under `<home>/evals/results/`.
  // Expected-value source: design Component 9 "run only when the module is the process
  // entry... Before any run, delete SDD_RUN_ID and SDD_STEP_ID" (tasks.md task 10 Prompt)
  // and design.md:122 ("prints the case lines and record path"); design.md:95-96 (the case
  // line format and per-run usage total); tasks.md task 10 Prompt/Success, "a run with
  // `SDD_RUN_ID` set leaves it unset afterwards" and "a stub case run prints its case line
  // and the record path". Folded: both bullets are observed from the same single `main`
  // call, so one test covers both (no separate coverage needed).
  it('leaves SDD_RUN_ID unset and prints the case line and record path for a named case run', async () => {
    const casesRoot = mkdtempSync(join(tmpdir(), 'eval-cli-cases-'));
    const home = mkdtempSync(join(tmpdir(), 'eval-cli-home-'));
    const liveCheckout = makeLiveCheckout();
    writeTestAuthorCase(casesRoot, 'cli-pass-case');
    writeScript([okRun('s1'), okRun('s2'), okRun('s3')]);
    process.env.SDD_RUN_ID = 'leaked-run-id';

    const { exit, output } = await captureStdout(() =>
      main(['--live-checkout', liveCheckout, 'cli-pass-case'], { casesRoot, home }),
    );

    expect(exit).toBe(0);
    expect(process.env.SDD_RUN_ID).toBeUndefined();
    expect(output).toContain('eval cli-pass-case: pass 3/3, 42 tokens');

    const resultsDir = join(home, 'evals', 'results');
    const files = readdirSync(resultsDir);
    expect(files).toHaveLength(1);
    expect(output).toContain(join(resultsDir, files[0]));

    cleanup(casesRoot, home, liveCheckout);
  });

  // Pre-condition: a two-commit temp repo whose `base` already holds `cli-demo-case` (a
  // `test-author` case) and whose `target` differs only by an unrelated `README.md` edit;
  // `baseDist` is baked, ahead of time, to this build's own real rendered text for that
  // case, so — under the gate's always-`exact` selection — `cli-demo-case` ends up with zero
  // selection reasons (unselected). The override names this unselected case.
  // Test: main(['gate', '--repo', dir, '--base', base, '--target', target, '--base-dist',
  // baseDist, '--summary-file', summaryFile, '--override', 'cli-demo-case'], { casesRoot,
  // home }).
  // Observable result: the returned exit code is 2 (`runGate`'s own post-condition 1 exit
  // code, forwarded); the stub `claude` is never invoked (its script's `.counter` sibling is
  // never created); `summaryFile` is written and names `cli-demo-case`.
  // Expected-value source: design.md Component 8 post-condition 1 (design.md:113, "Before
  // any run, an override that names ... an unselected case gives exit 2 with the reason in
  // `summaryFile`") and Component 9 (design.md:124, "gate ... exits with its code"); tasks.md
  // task 10 Prompt/Success, "a `gate` run forwards its flags and exit code" and "a bad
  // `--override` ... exits 2 before any spawn". Folded: this test is the sole evidence for
  // both the generic "forwards its flags and exit code" bullet and the specific "bad
  // override exits 2 before any spawn" bullet, since both describe the same observable call.
  it('refuses a gate run, before any spawn, when --override names an unselected case, forwarding its exit code', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-cli-gate-'));
    initRepo(dir);
    writeFileSync(join(dir, 'README.md'), 'hello\n');
    writeAuthorCaseDir(dir, 'cli-demo-case', [{ name: 'report-flag', args: { prefix: 'none' } }]);
    const base = commitAll(dir, 'base');
    writeFileSync(join(dir, 'README.md'), 'hello v2\n');
    const target = commitAll(dir, 'target');

    const baseDist = mkdtempSync(join(tmpdir(), 'eval-cli-basedist-'));
    writeMatchingBaseDist(baseDist);

    const home = mkdtempSync(join(tmpdir(), 'eval-cli-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-cli-summary-')), 'summary.txt');
    const scriptPath = writeScript([]);

    const exit = await main([
      'gate', '--repo', dir, '--base', base, '--target', target,
      '--base-dist', baseDist, '--summary-file', summaryFile, '--override', 'cli-demo-case',
    ], { casesRoot: join(dir, 'harness', 'evals'), home });

    expect(exit).toBe(2);
    expect(existsSync(`${scriptPath}.counter`)).toBe(false);
    expect(readFileSync(summaryFile, 'utf8')).toContain('cli-demo-case');

    cleanup(dir, baseDist, home, dirname(summaryFile));
  });

  // Pre-condition: a two-commit temp repo whose `target` adds `cli-fail-case`, a
  // `test-author` case whose only grader (`report-flag`, prefix `SEAM-DEFECT:`) fails on
  // every run the stub reports (the stub's `flag` is `none`); the override names this case;
  // the stub `claude` is scripted with 3 `ok` runs.
  // Test: main(['gate', '--repo', dir, '--base', base, '--target', target, '--summary-file',
  // summaryFile, '--override', 'cli-fail-case'], { casesRoot, home }).
  // Observable result: the returned exit code is 0; `<home>/evals/overrides.log` holds
  // exactly one tab-separated line whose second field is `target`'s first 12 characters,
  // whose third field is `cli-fail-case`, and whose fourth field is `fail`.
  // Expected-value source: design.md Component 8 post-condition 5 (design.md:117, "Append
  // one line to `<home>/evals/overrides.log`") and Component 9 (design.md:124, "gate ...
  // exits with its code"); tasks.md task 10 Prompt/Success, "a `gate` run forwards its flags
  // and exit code" and "an `--override` on a failing case exits 0 ... writes one line to the
  // run's `overrides.log`". Folded: this test, together with the previous one, is the sole
  // coverage for the generic "forwards its flags and exit code" bullet (two exit codes, 0
  // and 2, both forwarded correctly).
  it('runs a gate through the stub, writing one overrides.log line, when a failing case is named by --override', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'eval-cli-gate-'));
    initRepo(dir);
    writeFileSync(join(dir, 'README.md'), 'hello\n');
    const base = commitAll(dir, 'base');
    writeAuthorCaseDir(dir, 'cli-fail-case', [{ name: 'report-flag', args: { prefix: 'SEAM-DEFECT:' } }]);
    const target = commitAll(dir, 'target');
    const target12 = target.slice(0, 12);

    const home = mkdtempSync(join(tmpdir(), 'eval-cli-home-'));
    const summaryFile = join(mkdtempSync(join(tmpdir(), 'eval-cli-summary-')), 'summary.txt');
    writeScript([okRun('s1'), okRun('s2'), okRun('s3')]);

    const exit = await main([
      'gate', '--repo', dir, '--base', base, '--target', target,
      '--summary-file', summaryFile, '--override', 'cli-fail-case',
    ], { casesRoot: join(dir, 'harness', 'evals'), home });

    expect(exit).toBe(0);

    const lines = readFileSync(join(home, 'evals', 'overrides.log'), 'utf8').split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    const [, loggedTarget12, loggedId, loggedVerdict] = lines[0].split('\t');
    expect(loggedTarget12).toBe(target12);
    expect(loggedId).toBe('cli-fail-case');
    expect(loggedVerdict).toBe('fail');

    cleanup(dir, home, dirname(summaryFile));
  });
});
