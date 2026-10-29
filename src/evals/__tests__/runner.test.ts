import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync, readdirSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { runCases, type EvalResultRecord } from '../runner.js';
import type { StepSpec, StepResult } from '../../controller/step.js';

// Design Component 6 (src/evals/runner.ts), Requirement 2 ACs 1, 3-8 and Requirement 3 AC7:
// runCases(ids, opts) runs each named case's role 3 times through the live `runStep`
// (design.md:84), each run on a fresh fixture (design.md:85-89), classifies a non-`ok` step
// as inconclusive (design.md:90, R2 AC5), runs every grader only on an `ok` step and turns a
// grader throw into inconclusive rather than fail (design.md:90, R2 AC5), fails a run whose
// live checkout moved or dirtied outside the `.spec-workflow/`/`HANDOFF.md` carve-out
// (design.md:91,93, R2 AC6), records per-run usage and the case token total (design.md:95,
// R2 AC7), prints one `eval <id>: <verdict> <passed>/<runs>, <tokens> tokens` line per case
// (design.md:96, R3 AC7), and writes no run record, wait or ledger row under the home it is
// given (R2 AC8). Each test builds its own temp cases root, live checkout and home directory,
// sets CONTROLLER_CLAUDE_BIN to the stub `claude` (scripts/stub-claude.mjs), and reaches the
// runner only through `runCases`, never a module-private helper.

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
  // This harness session's own ambient SDD_RUN_ID (set by the controller run this test
  // suite executes under) would otherwise leak into the stub's spawn env regardless of
  // what the runner does; clear it so the "no SDD_RUN_ID" assertion exercises the
  // runner's own behaviour, not this session's environment. Restored by afterEach below.
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

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

/** A fresh cases root holding one `test-author` case wired to a minimal fixture store. */
function writeTestAuthorCase(
  casesRoot: string,
  id: string,
  graders: { name: string; args: Record<string, unknown> }[],
): void {
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
      id,
      role: 'sdd-test-author',
      phase: 'implementation',
      spec,
      turnCap: 50,
      evidence: 'docs/example.md:1-2',
      briefs: [{
        template: 'test-author', file: 'author-brief.md', taskId: '1',
        values: { title: 'Test author case', job: 'Write a failing test for task 1.' },
      }],
      fixture: { commits: [{ message: 'init', tree: 'fixture/01' }] },
      graders,
    }, null, 2),
  );
}

function writeScript(dir: string, runs: unknown[]): string {
  const scriptPath = join(dir, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
  return scriptPath;
}

/** A tracked `README.md` and a tracked `.spec-workflow/scratch.md`, both committed. */
function makeLiveCheckout(): string {
  const dir = mkdtempSync(join(tmpdir(), 'eval-live-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 't@test']);
  git(dir, ['config', 'user.name', 'Tester']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  mkdirSync(join(dir, '.spec-workflow'), { recursive: true });
  writeFileSync(join(dir, 'README.md'), 'hello\n');
  writeFileSync(join(dir, '.spec-workflow', 'scratch.md'), 'scratch\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

const USAGE = {
  input_tokens: 6, output_tokens: 4, cache_read_input_tokens: 2,
  cache_creation: { ephemeral_5m_input_tokens: 1, ephemeral_1h_input_tokens: 1 },
};
const MAPPED_USAGE = { input: 6, output: 4, cacheRead: 2, cacheWrite5m: 1, cacheWrite1h: 1 };

function okRun(sessionId: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    result: {
      subtype: 'success', is_error: false, num_turns: 2, session_id: sessionId,
      result: 'wrote tests',
      structured_output: { commit: 'none', files: ['src/foo.test.ts'], flag: 'none' },
      usage: USAGE,
    },
    exitCode: 0,
    ...extra,
  };
}

function initEventOf(logPath: string): Record<string, unknown> | undefined {
  return readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Record<string, unknown>)
    .find((l) => l.type === 'system' && l.subtype === 'init');
}

function cleanup(...dirs: string[]): void {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
}

describe('runCases(ids, opts)', () => {
  // Pre-condition: one case with no graders (vacuously passing), run with the default `runs`
  // of 3, each run returning an `ok` step with the same five-field usage.
  // Test: runCases(['pass-case'], { liveCheckout, casesRoot, home, onLine }).
  // Observable result: the step ran on 3 distinct fixture roots (each run's log's init event
  // carries a different `cwd`); the case verdict is `pass`; the record holds each run's mapped
  // usage and a token total of 3 × 14 = 42; `onLine` received exactly one line,
  // `eval pass-case: pass 3/3, 42 tokens`; the stub's init env carries no `SDD_RUN_ID`; and the
  // temp home holds only the `evals/` tree the runner itself wrote — no `runs/`, `waits/` or
  // ledger file, so no run record, wait or ledger row exists under it.
  // Expected-value source: design.md Component 6 post-conditions 1 and 4 (design.md:86,89,
  // "fresh fixture" / "one run after the other"), "Case verdict" (design.md:94), "Record"
  // (design.md:95, R2 AC7), "Lines" (design.md:96, R3 AC7); requirements.md R2 AC1
  // (requirements.md:33), AC7 (requirements.md:39), AC8 (requirements.md:40); tasks.md task 7
  // Prompt, "3 runs use 3 distinct fixture roots", "the record holds per-run usage and the
  // token total", "the line reads `eval <id>: <verdict> <passed>/<runs>, <tokens> tokens`",
  // "no run record, wait or ledger row exists", "the stub env has no `SDD_RUN_ID`".
  it('runs 3 sequential runs on distinct fixtures, totals usage into the case line, and leaves the home clean', async () => {
    const casesRoot = mkdtempSync(join(tmpdir(), 'eval-cases-'));
    const home = mkdtempSync(join(tmpdir(), 'eval-home-'));
    const liveCheckout = makeLiveCheckout();
    writeTestAuthorCase(casesRoot, 'pass-case', []);
    writeScript(casesRoot, [okRun('s1'), okRun('s2'), okRun('s3')]);

    const lines: string[] = [];
    const record: EvalResultRecord = await runCases(['pass-case'], {
      liveCheckout, casesRoot, home, onLine: (l) => lines.push(l),
    });

    const kase = record.cases.find((c) => c.id === 'pass-case');
    expect(kase?.verdict).toBe('pass');
    expect(kase?.runs).toHaveLength(3);
    for (const run of kase?.runs ?? []) {
      expect(run.verdict).toBe('pass');
      expect(run.classification).toBe('ok');
      expect(run.usage).toEqual(MAPPED_USAGE);
    }
    expect(kase?.tokens).toBe(42);

    const cwds = (kase?.runs ?? []).map((r) => initEventOf(r.logPath)?.cwd);
    expect(new Set(cwds).size).toBe(3);

    for (const run of kase?.runs ?? []) {
      const init = initEventOf(run.logPath);
      const env = init?.env as Record<string, string> | undefined;
      expect(env?.SDD_RUN_ID).toBeUndefined();
    }

    expect(lines).toEqual(['eval pass-case: pass 3/3, 42 tokens']);

    expect(readdirSync(home)).toEqual(['evals']);
    expect(existsSync(join(home, 'runs'))).toBe(false);
    expect(existsSync(join(home, 'waits'))).toBe(false);
    expect(readdirSync(join(home, 'evals', 'results')).length).toBeGreaterThan(0);

    cleanup(casesRoot, home, liveCheckout);
  });

  // Pre-condition: one case whose single run reports a rejected rate-limit window during
  // execution (the same shape step.test.ts's "classifies a usage-limit" case uses).
  // Test: runCases(['limit-case'], { liveCheckout, casesRoot, home, runs: 1 }).
  // Observable result: the run's classification is `usage-limit`, its verdict is
  // `inconclusive`, and the case verdict is `inconclusive` (not `pass` or `fail`).
  // Expected-value source: design.md Component 6 post-condition 5 ("A classification other
  // than `ok` gives `inconclusive` with the classification", design.md:90); requirements.md R2
  // AC5 (requirements.md:37); tasks.md task 7 Prompt, "a usage-limit result gives
  // `inconclusive` with the classification".
  it('records a usage-limit step as inconclusive with its classification', async () => {
    const casesRoot = mkdtempSync(join(tmpdir(), 'eval-cases-'));
    const home = mkdtempSync(join(tmpdir(), 'eval-home-'));
    const liveCheckout = makeLiveCheckout();
    writeTestAuthorCase(casesRoot, 'limit-case', []);
    writeScript(casesRoot, [{
      stream: [{
        type: 'rate_limit_event',
        rate_limit_info: {
          status: 'rejected', overageStatus: 'rejected',
          unifiedWindows: {
            five_hour: { utilization: 0.4, resetsAt: 1791703800 },
            seven_day: { utilization: 0.99, resetsAt: 1791730800 },
          },
        },
      }],
      result: {
        subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 's-limit',
        result: '', usage: {},
      },
      exitCode: 1,
    }]);

    const record = await runCases(['limit-case'], { liveCheckout, casesRoot, home, runs: 1 });

    const kase = record.cases.find((c) => c.id === 'limit-case');
    expect(kase?.runs[0].classification).toBe('usage-limit');
    expect(kase?.runs[0].verdict).toBe('inconclusive');
    expect(kase?.verdict).toBe('inconclusive');

    cleanup(casesRoot, home, liveCheckout);
  });

  // Pre-condition: one case whose single run reports `ok`, naming a grader
  // (`no-commit-touches`) with no `paths` argument, so the grader's own `(args.paths as
  // unknown[]).map` throws a TypeError when the runner calls it.
  // Test: runCases(['throw-case'], { liveCheckout, casesRoot, home, runs: 1 }).
  // Observable result: the run's classification stays `ok` (the step itself succeeded), but
  // its verdict is `inconclusive`, carrying a reason naming the grader and that it threw —
  // distinct from a grader that merely returns `fail`.
  // Expected-value source: design.md Component 6 post-condition 5 ("a throw gives
  // `inconclusive` with the error", design.md:90) and Error Handling 3 ("grader throws:
  // `inconclusive` with `grader <name> threw: <message>`, distinct from `fail`",
  // design.md:207); requirements.md R2 AC5 (requirements.md:37); tasks.md task 7 Prompt, "a
  // throwing grader gives `inconclusive`, not `fail`".
  it('records a throwing grader as inconclusive, distinct from a grader fail', async () => {
    const casesRoot = mkdtempSync(join(tmpdir(), 'eval-cases-'));
    const home = mkdtempSync(join(tmpdir(), 'eval-home-'));
    const liveCheckout = makeLiveCheckout();
    writeTestAuthorCase(casesRoot, 'throw-case', [{ name: 'no-commit-touches', args: { repo: '.' } }]);
    writeScript(casesRoot, [okRun('s-throw')]);

    const record = await runCases(['throw-case'], { liveCheckout, casesRoot, home, runs: 1 });

    const kase = record.cases.find((c) => c.id === 'throw-case');
    expect(kase?.runs[0].classification).toBe('ok');
    expect(kase?.runs[0].verdict).toBe('inconclusive');
    expect(kase?.runs[0].reasons.some((r) => /no-commit-touches/.test(r) && /threw/.test(r))).toBe(true);
    expect(kase?.verdict).toBe('inconclusive');

    cleanup(casesRoot, home, liveCheckout);
  });

  // Pre-condition: one case whose single run reports `ok` and whose stub commits, by shell
  // command, one empty commit carrying a `Co-Authored-By: Claude` trailer; its graders require
  // exactly one new commit (which holds) and no attribution trailer (which fails).
  // Test: runCases(['trailer-case'], { liveCheckout, casesRoot, home, runs: 1 }).
  // Observable result: the run's verdict is `fail`, with a reason naming the attribution
  // trailer; the case verdict is `fail`.
  // Expected-value source: design.md Component 6 post-condition 5 ("every grader runs: ... any
  // fail gives `fail`", design.md:90) and "Case verdict" (design.md:94); the
  // `no-attribution-trailer` grader (Component 5, design.md:76); tasks.md task 7 Prompt, "a
  // stub commit with a `Co-Authored-By: Claude` trailer gives `fail`".
  it("fails a run whose ok step's commit carries an attribution trailer", async () => {
    const casesRoot = mkdtempSync(join(tmpdir(), 'eval-cases-'));
    const home = mkdtempSync(join(tmpdir(), 'eval-home-'));
    const liveCheckout = makeLiveCheckout();
    writeTestAuthorCase(casesRoot, 'trailer-case', [
      { name: 'new-commit-count', args: { repo: '.', count: 1 } },
      { name: 'no-attribution-trailer', args: { repo: '.' } },
    ]);
    writeScript(casesRoot, [okRun('s-trailer', {
      commands: ['git commit --allow-empty -q -m "test(x): add tests" -m "Co-Authored-By: Claude <noreply@anthropic.com>"'],
    })]);

    const record = await runCases(['trailer-case'], { liveCheckout, casesRoot, home, runs: 1 });

    const kase = record.cases.find((c) => c.id === 'trailer-case');
    expect(kase?.runs[0].classification).toBe('ok');
    expect(kase?.runs[0].verdict).toBe('fail');
    expect(kase?.runs[0].reasons.some((r) => r.includes('attribution trailer'))).toBe(true);
    expect(kase?.verdict).toBe('fail');

    cleanup(casesRoot, home, liveCheckout);
  });

  // Pre-condition: two separate single-run cases against two separate live checkouts, each
  // live checkout holding a tracked `README.md` and a tracked `.spec-workflow/scratch.md`.
  // One run's stub edits the live checkout's `README.md` by absolute path; the other's edits
  // its `.spec-workflow/scratch.md` by absolute path. Both cases' only grader (`clean-tree` on
  // the fixture, repo `.`) passes — the fixture itself is never touched.
  // Test: two calls to runCases([id], { liveCheckout, casesRoot, home, runs: 1 }).
  // Observable result: the run that edited the tracked `README.md` fails with the reason
  // "edited the live checkout", regardless of its passing grader; the run that edited only
  // `.spec-workflow/scratch.md` does not fail for that reason and its case verdict is `pass`.
  // Expected-value source: design.md Component 6 post-condition 6 ("A changed live-checkout
  // snapshot gives `fail` with `edited the live checkout`, whatever the graders said",
  // design.md:91) and "Snapshot" (design.md:93, reusing the self-update's `.spec-workflow/` /
  // `HANDOFF.md` carve-out, design D3); requirements.md R2 AC6 (requirements.md:38,
  // "fail with the reason \"edited the live checkout\""); tasks.md task 7 Prompt, "a stub edit
  // to a tracked file of a temp live checkout gives `edited the live checkout`, an edit under
  // its `.spec-workflow/` does not".
  it('fails a run that edited a tracked live-checkout file, but not one that only touched its .spec-workflow/', async () => {
    const casesRootA = mkdtempSync(join(tmpdir(), 'eval-cases-'));
    const homeA = mkdtempSync(join(tmpdir(), 'eval-home-'));
    const liveCheckoutA = makeLiveCheckout();
    writeTestAuthorCase(casesRootA, 'live-edit-case', [{ name: 'clean-tree', args: { repo: '.' } }]);
    writeScript(casesRootA, [okRun('s-live-a', {
      edits: [{ path: join(liveCheckoutA, 'README.md'), content: 'oops, edited\n' }],
    })]);
    const recordA = await runCases(['live-edit-case'], { liveCheckout: liveCheckoutA, casesRoot: casesRootA, home: homeA, runs: 1 });
    const kaseA = recordA.cases.find((c) => c.id === 'live-edit-case');
    expect(kaseA?.runs[0].verdict).toBe('fail');
    expect(kaseA?.runs[0].reasons).toContain('edited the live checkout');
    expect(kaseA?.verdict).toBe('fail');
    cleanup(casesRootA, homeA, liveCheckoutA);

    const casesRootB = mkdtempSync(join(tmpdir(), 'eval-cases-'));
    const homeB = mkdtempSync(join(tmpdir(), 'eval-home-'));
    const liveCheckoutB = makeLiveCheckout();
    writeTestAuthorCase(casesRootB, 'live-store-case', [{ name: 'clean-tree', args: { repo: '.' } }]);
    writeScript(casesRootB, [okRun('s-live-b', {
      edits: [{ path: join(liveCheckoutB, '.spec-workflow', 'scratch.md'), content: 'still fine\n' }],
    })]);
    const recordB = await runCases(['live-store-case'], { liveCheckout: liveCheckoutB, casesRoot: casesRootB, home: homeB, runs: 1 });
    const kaseB = recordB.cases.find((c) => c.id === 'live-store-case');
    expect(kaseB?.runs[0].reasons).not.toContain('edited the live checkout');
    expect(kaseB?.verdict).toBe('pass');
    cleanup(casesRootB, homeB, liveCheckoutB);
  });

  // Pre-condition: one case with no graders, run once with a stub `step` that records the
  // `mcpConfig` it receives in place of running the live `runStep`.
  // Test: runCases(['no-register-case'], { liveCheckout, casesRoot, home, runs: 1, step }).
  // Observable result: the recorded spec-workflow server's `args` end with the step's own
  // `workspace` field (the fixture root) followed immediately by `--no-register`.
  // Expected-value source: design.md Component 7 ("runCases... appends '--no-register' to
  // the inline server's args, after the fixture root", design.md:94); requirements.md R3 AC1
  // (requirements.md:55) and AC4 (requirements.md:58); tasks.md task 8 Prompt, "append the
  // flag task 7 adds to the inline server's args in runCases, after the fixture root" and
  // "asserts that the spec-workflow server args end with the fixture root then that flag".
  it("appends --no-register to the inline server's args, after the fixture root", async () => {
    const casesRoot = mkdtempSync(join(tmpdir(), 'eval-cases-'));
    const home = mkdtempSync(join(tmpdir(), 'eval-home-'));
    const liveCheckout = makeLiveCheckout();
    writeTestAuthorCase(casesRoot, 'no-register-case', []);

    let recordedArgs: string[] = [];
    let recordedWorkspace = '';
    const step = async (spec: StepSpec): Promise<StepResult> => {
      const mcpConfig = spec.mcpConfig as { mcpServers: Record<string, { args: string[] }> };
      recordedArgs = mcpConfig.mcpServers['spec-workflow'].args;
      recordedWorkspace = spec.workspace ?? '';
      return {
        structuredOutput: { commit: 'none', files: [], flag: 'none' },
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 },
        sessionId: null,
        numTurns: 1,
        isError: false,
        subtype: 'success',
        resultText: '',
        exitCode: 0,
        classification: 'ok',
        durationMs: 0,
      };
    };

    await runCases(['no-register-case'], { liveCheckout, casesRoot, home, runs: 1, step });

    expect(recordedArgs.slice(-2)).toEqual([recordedWorkspace, '--no-register']);

    cleanup(casesRoot, home, liveCheckout);
  });
});
