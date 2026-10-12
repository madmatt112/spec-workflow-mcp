// src/core/test-home-guard.ts
//
// A test-only safety net. The harness home resolvers (`stateHome()` in
// src/dashboard/harness/state-files.ts and `controllerHome()` in
// src/controller/state.ts) resolve to the operator's real home when their
// environment variables are unset. A test that starts the Controller, the
// dashboard server or the HarnessLauncher without redirecting the home then
// writes run records, waits and launch records into the operator's real
// `~/.local/state/sdd` or `~/.spec-workflow-mcp`.
//
// The global vitest setup (vitest.setup.ts) points SDD_HOME, SPEC_WORKFLOW_HOME
// and XDG_STATE_HOME at per-worker temp directories, so this guard normally
// never fires. It exists to make any future leak fail loudly: when a test
// resolves the home to the real operator directory, throw instead of writing
// there silently.
import { homedir } from 'os';
import { join, resolve, sep } from 'path';

/** Are we running inside a test? */
function inTest(): boolean {
  return !!process.env.VITEST || process.env.NODE_ENV === 'test';
}

/** The current vitest test name, best-effort (undefined outside a test). */
function currentTestName(): string | undefined {
  try {
    const worker = (globalThis as { __vitest_worker__?: { current?: { name?: string; suite?: { name?: string } } } }).__vitest_worker__;
    return worker?.current?.name ?? worker?.current?.suite?.name;
  } catch {
    return undefined;
  }
}

/** Is `candidate` the same path as `root`, or inside it? */
function isUnder(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(root + sep);
}

/**
 * Throw when, during a test, `resolved` lands in the operator's real harness
 * home. `fnName` is the resolver that produced the path. Set
 * `SDD_TEST_ALLOW_REAL_HOME` to opt a test out (the unit tests that deliberately
 * exercise the default, real-home resolution use it).
 */
export function guardTestHome(resolved: string, fnName: string): void {
  if (!inTest()) return;
  if (process.env.SDD_TEST_ALLOW_REAL_HOME) return;

  const home = homedir();
  const forbidden = [join(home, '.local', 'state'), join(home, '.spec-workflow-mcp')];
  const abs = resolve(resolved);
  if (!forbidden.some((root) => isUnder(abs, root))) return;

  const test = currentTestName();
  throw new Error(
    `${fnName}() resolved to the operator's real home (${abs}) during a test` +
      (test ? ` ("${test}")` : '') +
      `. A test that starts the Controller, dashboard server or HarnessLauncher ` +
      `must set SDD_HOME, SPEC_WORKFLOW_HOME and XDG_STATE_HOME to temp directories. ` +
      `The global vitest setup (vitest.setup.ts) does this for every test; find the ` +
      `test above and give it an isolated home, or set SDD_TEST_ALLOW_REAL_HOME when it ` +
      `deliberately resolves the default.`,
  );
}
