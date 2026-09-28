import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import {
  proveRedGreen,
  classifyRed,
  proofReasons,
  nodeModulesLinkTargets,
} from '../red-green.js';
import type { ProofRules } from '../red-green.js';
import type { TddArgs } from '../../types.js';

// Real git and real node run against a temp repo; nothing is mocked here.
const NODE_RULES: ProofRules = { testCommand: 'node {files}', setupCommand: null, off: false };
const TEST_MS = 20_000;

const IMPL_WRONG = 'module.exports.sum = (a, b) => 0;\n';
const IMPL_RIGHT = 'module.exports.sum = (a, b) => a + b;\n';
const IMPL_NOSUM = 'module.exports.other = 1;\n';
const SUM_TEST =
  "const assert = require('node:assert');\n" +
  "const { sum } = require('./impl');\n" +
  'assert.strictEqual(sum(1, 2), 3);\n';

function git(dir: string, args: string[]): void {
  execFileSync('git', args, {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitOut(dir: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
    .toString()
    .trim();
}

function initRepo(dir: string): void {
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
}

async function write(dir: string, rel: string, content: string): Promise<void> {
  const p = join(dir, rel);
  await fs.mkdir(dirname(p), { recursive: true });
  await fs.writeFile(p, content);
}

function commitAll(dir: string, message: string): string {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', message]);
  return gitOut(dir, ['rev-parse', 'HEAD']);
}

function tdd(testFiles: string[], redCommit: string): TddArgs {
  return { testFiles, redCommit };
}

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'red-green-root-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('classifyRed', () => {
  it('is assertion-red for an AssertionError with no structural marker', () => {
    expect(classifyRed('AssertionError [ERR_ASSERTION]: 0 !== 3')).toBe('assertion-red');
  });

  it('is structural-red when a structural marker is present', () => {
    expect(classifyRed('TypeError: sum is not a function')).toBe('structural-red');
    expect(classifyRed('Error: Cannot find module ./impl')).toBe('structural-red');
    expect(classifyRed('SyntaxError: Unexpected token')).toBe('structural-red');
    expect(classifyRed('foo.ts(1,1): error TS2304')).toBe('structural-red');
    // an AssertionError next to a structural marker records structural-red.
    expect(classifyRed('AssertionError\nis not a function')).toBe('structural-red');
  });
});

describe('proveRedGreen outcome table', () => {
  it('records assertion-red base and passing head when tests fail on old code', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');
    await write(root, 'sum.test.js', SUM_TEST);
    const red = commitAll(root, 'test(x): task 1 red');
    await write(root, 'impl.js', IMPL_RIGHT);
    commitAll(root, 'implement sum');

    const p = await proveRedGreen(root, tdd(['sum.test.js'], red), NODE_RULES);
    expect(p.base).toBe('assertion-red');
    expect(p.head).toBe('pass');
    expect(p.baseCause).toBeNull();
    expect(p.sourcePaths).toEqual([]);
    expect(proofReasons(p)).toEqual({ fail: [], risk: [] });
  }, TEST_MS);

  it('records structural-red base and raises risk when the seam is missing', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_NOSUM);
    commitAll(root, 'base');
    await write(root, 'sum.test.js', SUM_TEST);
    const red = commitAll(root, 'red');
    await write(root, 'impl.js', IMPL_RIGHT);
    commitAll(root, 'implement');

    const p = await proveRedGreen(root, tdd(['sum.test.js'], red), NODE_RULES);
    expect(p.base).toBe('structural-red');
    expect(p.head).toBe('pass');
    expect(proofReasons(p).risk).toContain('tdd-structural-red');
  }, TEST_MS);

  it('records vacuous base and fails when the test passes on old code', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_RIGHT);
    commitAll(root, 'base already correct');
    await write(root, 'sum.test.js', SUM_TEST);
    const red = commitAll(root, 'red');

    const p = await proveRedGreen(root, tdd(['sum.test.js'], red), NODE_RULES);
    expect(p.base).toBe('vacuous');
    expect(proofReasons(p).fail).toContain('tdd: tests pass on base');
  }, TEST_MS);

  it('records inconclusive with a flaky-base cause when the two base runs differ', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');
    const flaky =
      "const assert = require('node:assert');\n" +
      "const fs = require('node:fs');\n" +
      "const f = 'flaky-counter';\n" +
      "if (fs.existsSync(f)) { assert.fail('second run'); }\n" +
      "fs.writeFileSync(f, '1');\n";
    await write(root, 'flaky.test.js', flaky);
    const red = commitAll(root, 'red');

    const p = await proveRedGreen(root, tdd(['flaky.test.js'], red), NODE_RULES);
    expect(p.base).toBe('inconclusive');
    expect(p.baseCause).toBe('flaky base run');
    expect(proofReasons(p).risk).toContain('tdd-inconclusive: flaky base run');
  }, TEST_MS);

  it('fails on a non-zero head run', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');
    await write(root, 'sum.test.js', SUM_TEST);
    const red = commitAll(root, 'red'); // impl left wrong, so HEAD also fails

    const p = await proveRedGreen(root, tdd(['sum.test.js'], red), NODE_RULES);
    expect(p.head).toBe('fail');
    expect(proofReasons(p).fail).toContain('tdd: tests fail on HEAD');
  }, TEST_MS);

  it('fails per source path and skips the base run when the red commit changed source', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');
    await write(root, 'impl.js', IMPL_RIGHT); // the author touched a source file
    await write(root, 'sum.test.js', SUM_TEST);
    const red = commitAll(root, 'red');

    const p = await proveRedGreen(root, tdd(['sum.test.js'], red), NODE_RULES);
    expect(p.sourcePaths).toContain('impl.js');
    expect(p.base).toBe('inconclusive');
    expect(p.baseCause).toBe('author changed source');
    expect(proofReasons(p).fail).toContain('tdd: author changed source: impl.js');
  }, TEST_MS);

  it('marks amended and raises risk when the working tree changed a red test file', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');
    await write(root, 'sum.test.js', SUM_TEST);
    const red = commitAll(root, 'red');
    await write(root, 'impl.js', IMPL_RIGHT);
    await write(root, 'sum.test.js', SUM_TEST + '// amended\n');
    commitAll(root, 'implement and tweak test');

    const p = await proveRedGreen(root, tdd(['sum.test.js'], red), NODE_RULES);
    expect(p.amended).toEqual(['sum.test.js']);
    expect(p.base).toBe('assertion-red');
    expect(proofReasons(p).risk).toContain('tdd-amended: sum.test.js');
  }, TEST_MS);
});

describe('proveRedGreen quoting and inconclusive causes', () => {
  it('single-quotes a test path holding a space so it runs as one argument', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');
    const spaced = "const assert = require('node:assert');\nassert.strictEqual(1, 2);\n";
    const rel = 'spaced dir/sum test.test.js';
    await write(root, rel, spaced);
    const red = commitAll(root, 'red');

    // Correct quoting makes the file run and hit AssertionError; a broken split
    // would make node fail to find a module (structural-red).
    const p = await proveRedGreen(root, tdd([rel], red), NODE_RULES);
    expect(p.base).toBe('assertion-red');
  }, TEST_MS);

  it('is inconclusive with red-on-base: off when the switch is off', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');
    await write(root, 'sum.test.js', SUM_TEST);
    const red = commitAll(root, 'red');

    const p = await proveRedGreen(root, tdd(['sum.test.js'], red), {
      testCommand: 'node {files}',
      setupCommand: null,
      off: true,
    });
    expect(p.base).toBe('inconclusive');
    expect(p.baseCause).toBe('red-on-base: off');
    expect(proofReasons(p).risk).toContain('tdd-inconclusive: red-on-base: off');
  }, TEST_MS);

  it('is inconclusive and head not-run when no test command is set', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');
    await write(root, 'sum.test.js', SUM_TEST);
    const red = commitAll(root, 'red');

    const p = await proveRedGreen(root, tdd(['sum.test.js'], red), {
      testCommand: null,
      setupCommand: null,
      off: false,
    });
    expect(p.base).toBe('inconclusive');
    expect(p.baseCause).toBe('no tdd-test-command');
    expect(p.head).toBe('not-run');
    expect(proofReasons(p).risk).toContain('tdd-inconclusive: no tdd-test-command');
  }, TEST_MS);

  it('is inconclusive when the red commit does not resolve', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');

    const p = await proveRedGreen(root, tdd(['sum.test.js'], 'deadbeefdeadbeef'), NODE_RULES);
    expect(p.base).toBe('inconclusive');
    expect(p.baseSha).toBeNull();
    expect(p.baseCause).toBe('red commit does not resolve');
  }, TEST_MS);
});

async function tempPrefixDirs(): Promise<Set<string>> {
  const names = await fs.readdir(tmpdir());
  return new Set(names.filter((n) => n.startsWith('sww-redgreen-')));
}

describe('proveRedGreen temp-directory cleanup', () => {
  it('removes the temp directory after a failing setup command', async () => {
    initRepo(root);
    await write(root, 'impl.js', IMPL_WRONG);
    commitAll(root, 'base');
    await write(root, 'sum.test.js', SUM_TEST);
    const red = commitAll(root, 'red');

    const before = await tempPrefixDirs();
    const p = await proveRedGreen(root, tdd(['sum.test.js'], red), {
      testCommand: 'node {files}',
      setupCommand: 'node -e "process.exit(1)"',
      off: false,
    });
    const after = await tempPrefixDirs();

    expect(p.base).toBe('inconclusive');
    expect(p.baseCause).toContain('setup');
    // No new sww-redgreen-* directory is left behind.
    const leaked = [...after].filter((n) => !before.has(n));
    expect(leaked).toEqual([]);
  }, TEST_MS);
});

describe('nodeModulesLinkTargets', () => {
  it('links a nested package node_modules and skips nested, .git and worktree ones', async () => {
    initRepo(root);
    // Top-level node_modules: linked.
    await write(root, 'node_modules/pkg-a/index.js', 'module.exports = 1;\n');
    // Inside another node_modules: skipped (never descended).
    await write(root, 'node_modules/inner/node_modules/deep/index.js', 'module.exports = 2;\n');
    // Nested package: linked.
    await write(root, 'packages/foo/node_modules/pkg-b/index.js', 'module.exports = 3;\n');
    // Under .git: skipped.
    await write(root, '.git/node_modules/x/index.js', 'module.exports = 4;\n');
    // A linked worktree (a directory holding a `.git` entry): skipped.
    await write(root, 'wt/.git', 'gitdir: /elsewhere\n');
    await write(root, 'wt/node_modules/y/index.js', 'module.exports = 5;\n');

    const targets = (await nodeModulesLinkTargets(root)).sort();
    expect(targets).toEqual(['node_modules', 'packages/foo/node_modules']);
  });
});
