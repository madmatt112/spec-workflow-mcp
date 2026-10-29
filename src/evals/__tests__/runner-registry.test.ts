import { describe, it, expect } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, realpathSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execFileSync, type ChildProcess } from 'child_process';
import { runCases } from '../runner.js';
import type { StepSpec, StepResult } from '../../controller/step.js';

// Design Component 7 (src/index.ts, src/server.ts, src/evals/runner.ts) and the Testing
// Strategy "Integration" bullet, and requirements.md R3 AC1, AC4 and AC5:
// Test: runCases(ids, { step }), where the stub `step` takes the recorded spec-workflow
// server `args`, swaps `dist/index.js` for `src/index.ts`, and spawns the real server under
// the `tsx` binary at `node_modules/.bin/tsx` (a dev dependency). The stub only records what
// it observed, in outer-scope variables; every `expect` runs in the `it` body after
// `runCases` resolves, because `runCases` wraps the `step` call in its own try/catch
// (`src/evals/runner.ts:170-231`) and would otherwise swallow a thrown assertion as an
// `inconclusive` run instead of failing the test.
// Pre-condition: one case with no graders, run once. The server's `args` carry the fixture
// root as the sole positional argument today, and — once C7 lands — `--no-register` right
// after it.
// Observable result: while the spawned server was alive (before its stdin ended), the
// per-worker registry (`activeProjects.json` under `SPEC_WORKFLOW_HOME`,
// vitest.setup.ts:23-24) held no entry whose `projectPath` was the fixture root — present at
// base (red, the server registers by default), absent after the fix (green, `--no-register`
// skips it); the server printed either `Project registered:` (src/server.ts:198, base) or
// `Project registration skipped` (src/server.ts:200, after the fix) on stderr; once stdin
// ended it exited 0.
// Expected-value source: design.md Testing Strategy "Integration" bullet (design.md:190,
// "reads the per-worker registry and asserts no fixture entry — present at base (red),
// absent after the fix (green)... It then ends stdin and waits for exit 0... asserting only
// node-20-guaranteed fields: a stderr `data` line and the `exit` code"); requirements.md R3
// AC1 (requirements.md:55), AC4 (requirements.md:58), AC5 (requirements.md:59); R7 AC2
// (requirements.md:113); tasks.md task 8 Prompt.

function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..', '..');
}

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

/** A fresh cases root holding one `test-author` case wired to a minimal fixture store, with
 * no graders — the run's verdict is not what this test is about. */
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
      graders: [],
    }, null, 2),
  );
}

/** A tracked `README.md`, committed, so `runCases`'s live-checkout snapshot has a baseline. */
function makeLiveCheckout(): string {
  const dir = mkdtempSync(join(tmpdir(), 'eval-registry-live-'));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 't@test']);
  git(dir, ['config', 'user.name', 'Tester']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  mkdirSync(join(dir, '.spec-workflow'), { recursive: true });
  writeFileSync(join(dir, 'README.md'), 'hello\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

const STARTUP_LINE = /Project registered:|Project registration skipped/;

/** Swaps the `dist/index.js` entry the step was configured with for `src/index.ts`, and
 * spawns it under the `tsx` binary with the remaining args unchanged. This test's own
 * process may carry `SPEC_WORKFLOW_WORKSPACE`/`SPEC_WORKFLOW_SHARED_ROOT` from the harness
 * session running it; either would override the fixture's own workspace inference the way
 * `runCases`'s real callers never do, so both are scrubbed before the spawn (the same scrub
 * `e2e/helpers/worktree-harness.ts` applies to its own spawned servers). */
function spawnEvalServer(serverArgs: string[]): ChildProcess {
  const entryPoint = serverArgs[0].replace(join('dist', 'index.js'), join('src', 'index.ts'));
  const rest = serverArgs.slice(1);
  const tsxBin = join(packageRoot(), 'node_modules', '.bin', 'tsx');
  const env = { ...process.env };
  delete env.SPEC_WORKFLOW_WORKSPACE;
  delete env.SPEC_WORKFLOW_SHARED_ROOT;
  return spawn(tsxBin, [entryPoint, ...rest], { stdio: ['pipe', 'pipe', 'pipe'], env });
}

/** Resolves once `stderr` has printed one of the two startup lines, asserting only on the
 * `data` event (a node-20-guaranteed `ChildProcess.stderr` field). */
function waitForStartupLine(child: ChildProcess): Promise<string> {
  return new Promise((resolveFn, rejectFn) => {
    let buf = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      buf += chunk.toString();
      if (STARTUP_LINE.test(buf)) resolveFn(buf);
    });
    child.on('error', rejectFn);
  });
}

/** Ends stdin and resolves with the exit code (a node-20-guaranteed `exit` event field). */
function endAndWaitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolveFn) => {
    child.on('exit', (code) => resolveFn(code ?? -1));
    child.stdin?.end();
  });
}

describe('runCases(ids, { step })', () => {
  it(
    'leaves no fixture entry in the per-worker registry while the configured server is alive, and exits 0',
    async () => {
      const casesRoot = mkdtempSync(join(tmpdir(), 'eval-registry-cases-'));
      const home = mkdtempSync(join(tmpdir(), 'eval-registry-home-'));
      const liveCheckout = makeLiveCheckout();
      // A throwaway scratch root, so the runner never writes under (nor cleanup ever wipes)
      // the shared `/tmp/scratchpad/sdd` that holds a live run's briefs (retro P3).
      const evalScratchRoot = mkdtempSync(join(tmpdir(), 'swm-eval-scratch-'));
      process.env.SWM_EVAL_SCRATCH_ROOT = evalScratchRoot;
      writeTestAuthorCase(casesRoot, 'registry-case');

      let stderrAtStartup = '';
      let hasFixtureEntry = true;
      let exitCode = -1;

      const step = async (spec: StepSpec): Promise<StepResult> => {
        const mcpConfig = spec.mcpConfig as { mcpServers: Record<string, { args: string[] }> };
        const serverArgs = mcpConfig.mcpServers['spec-workflow'].args;
        const fixtureRoot = serverArgs[1];

        const child = spawnEvalServer(serverArgs);
        stderrAtStartup = await waitForStartupLine(child);

        const registryPath = join(process.env.SPEC_WORKFLOW_HOME as string, 'activeProjects.json');
        const registryText = existsSync(registryPath) ? readFileSync(registryPath, 'utf8') : '{}';
        const registry = JSON.parse(registryText) as Record<string, { projectPath: string }>;
        const fixtureRealpath = realpathSync(fixtureRoot);
        hasFixtureEntry = Object.values(registry).some((entry) => entry.projectPath === fixtureRealpath);

        exitCode = await endAndWaitForExit(child);

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

      await runCases(['registry-case'], { liveCheckout, casesRoot, home, runs: 1, step });

      expect(stderrAtStartup).toMatch(STARTUP_LINE);
      expect(hasFixtureEntry).toBe(false);
      expect(exitCode).toBe(0);

      rmSync(casesRoot, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(liveCheckout, { recursive: true, force: true });
      rmSync(evalScratchRoot, { recursive: true, force: true });
      delete process.env.SWM_EVAL_SCRATCH_ROOT;
    },
    60000,
  );
});
