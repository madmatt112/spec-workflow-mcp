import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Dirent } from 'node:fs';
import { runGit } from './task-diff.js';
import { runCaptured, CHECK_TIMEOUT_MS } from './check-runner.js';
import { isTestPath } from './gate-rules.js';
import type { BaseOutcome, HeadOutcome, TddArgs } from '../types.js';

/**
 * The two agent-rules keys the proof obeys: the test command run in the base
 * worktree and the code root (`{files}` is replaced there), the optional setup
 * command run in the base worktree, and whether `red-on-base` is switched off
 * (design Component 7). A null command or `off: true` skips the base run as
 * inconclusive.
 */
export type ProofRules = {
  testCommand: string | null;
  setupCommand: string | null;
  off: boolean;
};

/**
 * The proof's finding, which the gate turns into `data.tdd` and reasons (design
 * Component 7). `base` is `inconclusive` and `baseCause` is set whenever the base
 * run could not be trusted; `head` is `not-run` when no test command exists.
 */
export type ProofResult = {
  baseSha: string | null;
  base: BaseOutcome;
  baseCause: string | null;
  head: HeadOutcome;
  sourcePaths: string[];
  amended: string[];
  redText: Record<string, string>;
};

/**
 * Non-empty lines of git `--name-only` output.
 */
function splitLines(stdout: string): string[] {
  return stdout.split('\n').filter((line) => line.length > 0);
}

/**
 * The command with every `{files}` token replaced by the single-quoted test
 * files, so a path with a space reaches the shell as one argument (requirement
 * 4.8). `split`/`join` replaces all tokens and leaves `$` untouched.
 */
function substituteFiles(command: string, files: string[]): string {
  const quoted = files.map((f) => `'${f}'`).join(' ');
  return command.split('{files}').join(quoted);
}

/**
 * Whether a base run's full captured output is an assertion failure or a
 * structural one (requirement 4.9): `assertion-red` when it holds `AssertionError`
 * and none of the four structural markers, else `structural-red`.
 */
export function classifyRed(output: string): 'assertion-red' | 'structural-red' {
  const structural =
    output.includes('Cannot find module') ||
    output.includes('is not a function') ||
    output.includes('SyntaxError') ||
    output.includes('error TS');
  if (output.includes('AssertionError') && !structural) return 'assertion-red';
  return 'structural-red';
}

/**
 * The `node_modules` directories of `root` to symlink into the base worktree
 * (requirement 4.7). A walk that follows no symlink (a symlinked directory is not
 * `isDirectory()`), does not descend into a `node_modules` once found, and skips
 * `.git` and any directory holding a `.git` entry — a linked worktree or a nested
 * repository. Exported so the walk's skips are tested without a worktree.
 */
export async function nodeModulesLinkTargets(root: string): Promise<string[]> {
  const targets: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    // A directory that is not the root but holds a `.git` entry is a linked
    // worktree or nested repository; its `node_modules` is not the root's.
    if (dir !== root && entries.some((e) => e.name === '.git')) return;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue; // follows no symlink
      if (entry.name === '.git') continue;
      const abs = path.join(dir, entry.name);
      if (entry.name === 'node_modules') {
        targets.push(path.relative(root, abs));
        continue; // do not descend; skips a node_modules inside another
      }
      await walk(abs);
    }
  }
  await walk(root);
  return targets;
}

/** One directory symlink per `node_modules` of `root`, at the same relative path. */
async function linkNodeModules(root: string, worktreePath: string): Promise<void> {
  for (const rel of await nodeModulesLinkTargets(root)) {
    const dest = path.join(worktreePath, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    try {
      await fs.symlink(path.join(root, rel), dest, 'dir');
    } catch {
      // A pre-existing entry is left as it is.
    }
  }
}

/**
 * Runs the author's red tests in a detached worktree of the base commit and sets
 * `result.base`/`result.baseCause` from the outcome (design Component 7, step 5).
 * A `finally` removes the worktree with `--force` and then the temp directory, so
 * no infrastructure fault leaks a worktree.
 */
async function runBaseWorktree(
  root: string,
  baseSha: string,
  result: ProofResult,
  rules: ProofRules,
  testFiles: string[],
  timeoutMs: number,
): Promise<void> {
  const testCommand = rules.testCommand as string; // non-null: caller guards it
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sww-redgreen-'));
  const worktreePath = path.join(tmpRoot, 'base');
  try {
    await runGit(root, ['worktree', 'prune']);
    const add = await runGit(root, ['worktree', 'add', '--detach', worktreePath, baseSha]);
    if (!add.ok) {
      result.baseCause = `worktree add failed: ${add.cause ?? 'unknown'}`;
      return;
    }

    if (rules.setupCommand !== null) {
      const setup = await runCaptured(worktreePath, rules.setupCommand, { timeoutMs });
      if (setup.status !== 'pass' || setup.exitCode !== 0) {
        result.baseCause = 'red-on-base-setup failed';
        return;
      }
    } else {
      await linkNodeModules(root, worktreePath);
    }

    for (const [rel, text] of Object.entries(result.redText)) {
      const dest = path.join(worktreePath, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, text);
    }

    const command = substituteFiles(testCommand, testFiles);
    const first = await runCaptured(worktreePath, command, { timeoutMs });
    if (first.status === 'timeout') {
      result.baseCause = 'base run timed out';
      return;
    }
    if (first.exitCode !== 0) {
      result.base = classifyRed(`${first.stdout}\n${first.stderr}`);
      return;
    }

    // Exit 0: one more run distinguishes a vacuous test from a flaky one.
    const second = await runCaptured(worktreePath, command, { timeoutMs });
    if (second.status === 'timeout') {
      result.baseCause = 'base run timed out';
      return;
    }
    if (second.exitCode === 0) {
      result.base = 'vacuous';
    } else {
      result.baseCause = 'flaky base run';
    }
  } finally {
    await runGit(root, ['worktree', 'remove', '--force', worktreePath]);
    await fs.rm(tmpRoot, { recursive: true, force: true });
  }
}

/**
 * Proves the author's tests fail on the pre-task code and pass on the finished
 * code (design Component 7). It never throws: every git call goes through the
 * exported runner and every test run through the captured runner, and the base
 * run's worktree is always cleaned up. `timeoutMs` defaults to `CHECK_TIMEOUT_MS`.
 */
export async function proveRedGreen(
  root: string,
  tdd: TddArgs,
  rules: ProofRules,
  opts?: { timeoutMs?: number },
): Promise<ProofResult> {
  const timeoutMs = opts?.timeoutMs ?? CHECK_TIMEOUT_MS;
  const testFiles = tdd.testFiles;
  const result: ProofResult = {
    baseSha: null,
    base: 'inconclusive',
    baseCause: null,
    head: 'not-run',
    sourcePaths: [],
    amended: [],
    redText: {},
  };

  // Step 1: resolve the red commit and its first parent (the base).
  const redRun = await runGit(root, ['rev-parse', '--verify', `${tdd.redCommit}^{commit}`]);
  const parentRun = await runGit(root, ['rev-parse', '--verify', `${tdd.redCommit}^1^{commit}`]);
  let redCommit: string | null = null;
  if (redRun.ok && parentRun.ok) {
    redCommit = redRun.stdout.trim();
    result.baseSha = parentRun.stdout.trim();
  } else {
    result.baseCause = 'red commit does not resolve';
  }

  if (redCommit) {
    // Step 2: non-test paths the red commit changed against its first parent.
    const changed = await runGit(root, [
      'diff', '--name-only', result.baseSha as string, redCommit,
    ]);
    if (changed.ok) {
      for (const p of splitLines(changed.stdout)) {
        if (!isTestPath(p)) result.sourcePaths.push(p);
      }
    }

    // Step 3: author test files the working tree amended since the red commit.
    const amendedRun = await runGit(root, ['diff', '--name-only', redCommit, '--', ...testFiles]);
    if (amendedRun.ok) result.amended = splitLines(amendedRun.stdout);

    // Step 4: each author test file's red-commit content.
    for (const tf of testFiles) {
      const show = await runGit(root, ['show', `${redCommit}:${tf}`]);
      if (show.ok) result.redText[tf] = show.stdout;
    }
  }

  // Step 5: the base run, skipped as inconclusive on a known cause.
  if (redCommit && result.baseCause === null) {
    if (rules.off) {
      result.baseCause = 'red-on-base: off';
    } else if (rules.testCommand === null) {
      result.baseCause = 'no tdd-test-command';
    } else if (result.sourcePaths.length > 0) {
      result.baseCause = 'author changed source';
    } else {
      await runBaseWorktree(root, result.baseSha as string, result, rules, testFiles, timeoutMs);
    }
  }

  // Step 6: the head run, whenever a test command is set (a failing head is a
  // fact even when the base is inconclusive or off — design D7).
  if (rules.testCommand !== null) {
    const command = substituteFiles(rules.testCommand, testFiles);
    const headRun = await runCaptured(root, command, { timeoutMs });
    result.head = headRun.status === 'pass' && headRun.exitCode === 0 ? 'pass' : 'fail';
  }

  return result;
}

/**
 * The gate's fail and risk reasons for a proof (design Component 7 outcome
 * table). A `vacuous` base, a failing head and each source path fail the gate; a
 * `structural-red` or `inconclusive` base and any amended file raise risk.
 */
export function proofReasons(p: ProofResult): { fail: string[]; risk: string[] } {
  const fail: string[] = [];
  const risk: string[] = [];

  if (p.base === 'vacuous') fail.push('tdd: tests pass on base');
  if (p.head === 'fail') fail.push('tdd: tests fail on HEAD');
  for (const sp of p.sourcePaths) fail.push(`tdd: author changed source: ${sp}`);

  if (p.base === 'structural-red') risk.push('tdd-structural-red');
  if (p.base === 'inconclusive') risk.push(`tdd-inconclusive: ${p.baseCause ?? 'unknown'}`);
  if (p.amended.length > 0) risk.push(`tdd-amended: ${p.amended.join(', ')}`);

  return { fail, risk };
}
