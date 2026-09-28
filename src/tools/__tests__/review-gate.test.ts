import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Only typecheck is mocked (`:13-20` of review-task.test.ts). Hygiene and the
// git plumbing (`computeRangeStats`) run for real against a temp git repo, so
// the gate exercises the whole path end to end.
const overrides = vi.hoisted(() => ({
  typecheck: null as null | ((...args: any[]) => any),
}));

vi.mock('../../core/typecheck.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/typecheck.js')>();
  return {
    ...actual,
    runProjectTypecheck: (...args: any[]) =>
      overrides.typecheck ? overrides.typecheck(...args) : (actual.runProjectTypecheck as any)(...args),
  };
});

import { handleGate } from '../review-gate.js';
import { reviewTaskHandler, _resetReviewWarnings } from '../review-task.js';
import { ImplementationLogManager } from '../../dashboard/implementation-log-manager.js';
import { ToolContext } from '../../types.js';

function gitCmd(dir: string, args: string[]): void {
  execFileSync('git', args, {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitInit(dir: string): void {
  gitCmd(dir, ['init', '-q', '-b', 'main']);
  gitCmd(dir, ['config', 'user.email', 'test@example.com']);
  gitCmd(dir, ['config', 'user.name', 'Test']);
  gitCmd(dir, ['config', 'commit.gpgsign', 'false']);
}

function gitHead(dir: string): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

// A task block that does NOT match /\b(tests?)\b/i, so risk rule c never fires
// on a non-test change.
const TASKS_MD = [
  '# Tasks',
  '',
  '- [-] 1. Implement feature',
  '  _Requirements: REQ-001_',
  '  _Prompt: Task: Build it | Restrictions: No new deps | Success: it works_',
  '',
  '- [ ] 2. Another item',
  '',
].join('\n');

const AGENT_RULES = ['# Agent rules', '', '## Sensitive paths', '', '- src/other.ts', ''].join('\n');

describe('handleGate', () => {
  let tempDir: string;
  let specPath: string;
  let context: ToolContext;
  let base: string; // C0 sha

  const FEATURE_DISABLED = () => [
    {
      tsconfigPath: '/x/tsconfig.json',
      status: 'unavailable',
      reason: 'feature-disabled',
      observed: 'typecheck is disabled by `features.typecheck: false`',
    },
  ];

  beforeEach(async () => {
    overrides.typecheck = FEATURE_DISABLED;
    _resetReviewWarnings();
    tempDir = await fs.mkdtemp(join(tmpdir(), 'review-gate-test-'));

    gitInit(tempDir);
    await fs.writeFile(join(tempDir, '.gitignore'), '.spec-workflow/\nnode_modules/\n');
    await fs.mkdir(join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(join(tempDir, 'src/base.ts'), 'export const base = 1;\n');
    gitCmd(tempDir, ['add', '-A']);
    gitCmd(tempDir, ['commit', '-q', '-m', 'C0']);
    base = gitHead(tempDir);

    specPath = join(tempDir, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specPath, { recursive: true });
    await fs.writeFile(join(specPath, 'tasks.md'), TASKS_MD);
    await fs.writeFile(join(tempDir, '.spec-workflow', 'agent-rules.md'), AGENT_RULES);

    context = { projectPath: tempDir, workspacePath: tempDir };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function addTask1Log(): Promise<void> {
    const logManager = new ImplementationLogManager(specPath);
    await logManager.addLogEntry({
      taskId: '1',
      timestamp: new Date().toISOString(),
      summary: 'Implemented feature',
      filesModified: ['src/feature.ts'],
      filesCreated: [],
      statistics: { linesAdded: 1, linesRemoved: 0, filesChanged: 1 },
      artifacts: {},
    });
  }

  function gate(args: Parameters<typeof handleGate>[0], taskId: string) {
    return handleGate(args, specPath, 'test-spec', taskId, tempDir, tempDir, context);
  }

  async function reviewsFiles(): Promise<string[]> {
    try {
      return await fs.readdir(join(specPath, 'reviews'));
    } catch {
      return [];
    }
  }

  it('a task gate with baseRef is pass/low, records reviewer: gate, no marker', async () => {
    await addTask1Log();
    await fs.writeFile(join(tempDir, 'src/feature.ts'), 'export const feature = 2;\n');

    const result = await gate({ baseRef: base }, '1');

    expect(result.success).toBe(true);
    expect(result.data.gate).toBe('pass');
    expect(result.data.risk).toBe('low');
    expect(result.data.recorded).not.toBeNull();
    expect(result.data.touched.paths).toEqual(['src/feature.ts']);

    const files = await reviewsFiles();
    const reviewFile = files.find((f) => f.startsWith('review-'));
    expect(reviewFile).toBeDefined();
    const md = await fs.readFile(join(specPath, 'reviews', reviewFile!), 'utf-8');
    expect(md).toContain('reviewer: gate');
    expect(files.some((f) => f.startsWith('.prepare-'))).toBe(false);
  });

  it('an item gate with a commit records no review file', async () => {
    const result = await gate({ commit: base }, 'P3');

    expect(result.success).toBe(true);
    expect(result.data.recorded).toBeNull();
    const files = await reviewsFiles();
    expect(files.some((f) => f.startsWith('review-'))).toBe(false);
  });

  it('a files-only gate with a missing path fails with skipped precomputations', async () => {
    await fs.writeFile(join(tempDir, 'src/present.ts'), 'export const p = 1;\n');

    const result = await gate({ files: ['src/present.ts', 'src/missing.ts'] }, 'P4');

    expect(result.success).toBe(true);
    expect(result.data.gate).toBe('fail');
    expect(result.data.stats).toBeNull();
    expect(result.data.typecheck.kind).toBe('skipped');
    expect(result.data.hygiene).toEqual({});
    expect(result.data.reasons).toContain('listed-file-missing: src/missing.ts');
  });

  describe('Error Handling causes 1-6', () => {
    it('cause 1: root not a directory', async () => {
      const result = await gate({ baseRef: base, root: join(tempDir, 'nope') }, 'P5');
      expect(result.success).toBe(false);
    });

    it('cause 2: no git repository at root', async () => {
      const nonGit = await fs.mkdtemp(join(tmpdir(), 'review-gate-nongit-'));
      try {
        const result = await gate({ commit: base, root: nonGit }, 'P6');
        expect(result.success).toBe(false);
        expect(result.message).toContain('no git repository');
      } finally {
        await fs.rm(nonGit, { recursive: true, force: true });
      }
    });

    it('cause 3: baseRef does not resolve', async () => {
      await addTask1Log();
      const result = await gate({ baseRef: 'deadbeef' }, '1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('does not resolve');
    });

    it('cause 4: unknown task with no commit or files', async () => {
      const result = await gate({}, 'nope');
      expect(result.success).toBe(false);
    });

    it('cause 5: task without an implementation log', async () => {
      const result = await gate({ baseRef: base }, '1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('implementation log');
    });

    it('cause 6: agent-rules.md unreadable for a reason other than ENOENT', async () => {
      await addTask1Log();
      const rulesPath = join(tempDir, '.spec-workflow', 'agent-rules.md');
      await fs.rm(rulesPath);
      await fs.mkdir(rulesPath); // a directory ⇒ EISDIR on read
      const result = await gate({ baseRef: base }, '1');
      expect(result.success).toBe(false);
    });
  });

  it('an extra tracked touched path with files given is file-outside-list', async () => {
    await addTask1Log();
    await fs.writeFile(join(tempDir, 'src/feature.ts'), 'export const feature = 2;\n');
    gitCmd(tempDir, ['add', '-A']);
    gitCmd(tempDir, ['commit', '-q', '-m', 'C1']);

    const result = await gate({ baseRef: base, files: ['src/listed.ts'] }, '1');

    expect(result.success).toBe(true);
    expect(result.data.gate).toBe('fail');
    expect(result.data.reasons).toContain('file-outside-list: src/feature.ts');
  });

  it('P5: an untracked extra path is exempt from file-outside-list', async () => {
    await addTask1Log();
    // src/feature.ts is written but never committed, so it is untracked at gate
    // time — orchestrator/environment residue, not the implementer's committed work.
    await fs.writeFile(join(tempDir, 'src/feature.ts'), 'export const feature = 2;\n');

    const result = await gate({ baseRef: base, files: ['src/listed.ts'] }, '1');

    expect(result.success).toBe(true);
    expect(result.data.gate).toBe('pass');
    expect(result.data.reasons).not.toContain('file-outside-list: src/feature.ts');
  });

  it('a gate pass/low, then prepare, then record yields version 2', async () => {
    await addTask1Log();
    await fs.writeFile(join(tempDir, 'src/feature.ts'), 'export const feature = 2;\n');

    const gateResult = await gate({ baseRef: base }, '1');
    expect(gateResult.data.recorded.version).toBe(1);

    await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);
    const record = await reviewTaskHandler(
      { action: 'record', specName: 'test-spec', taskId: '1', verdict: 'pass', summary: 'ok', findings: [] },
      context,
    );

    expect(record.success).toBe(true);
    expect(record.data.version).toBe(2);
  });

  it('every reason and check output is at most 200 characters, and no diff key', async () => {
    await addTask1Log();
    await fs.writeFile(join(tempDir, 'src/feature.ts'), 'export const feature = 2;\n');
    const longCheck = `node -e "console.log('x'.repeat(500)); process.exit(1)"`;

    const result = await gate({ baseRef: base, checks: [longCheck] }, '1');

    expect(result.data.gate).toBe('fail');
    for (const reason of result.data.reasons) {
      expect(reason.length).toBeLessThanOrEqual(200);
    }
    for (const check of result.data.checks) {
      expect(check.output.length).toBeLessThanOrEqual(200);
    }
    expect('diff' in result.data).toBe(false);
  });

  it('caps touched.paths at 100 but scores a sensitive path sorted past 100 high', async () => {
    await addTask1Log();
    // 120 untracked files, sorted; the sensitive one sorts to position 119.
    for (let i = 0; i < 120; i++) {
      const name = `f${String(i).padStart(3, '0')}.ts`;
      await fs.writeFile(join(tempDir, 'src', name), 'export const x = 1;\n');
    }
    await fs.writeFile(
      join(tempDir, '.spec-workflow', 'agent-rules.md'),
      ['## Sensitive paths', '', '- src/f119.ts', ''].join('\n'),
    );

    const result = await gate({ baseRef: base }, '1');

    expect(result.success).toBe(true);
    expect(result.data.touched.total).toBe(120);
    expect(result.data.touched.paths.length).toBe(100);
    expect(result.data.touched.paths).not.toContain('src/f119.ts');
    expect(result.data.risk).toBe('high');
    expect(result.data.reasons).toContain('sensitive-path: src/f119.ts matches src/f119.ts');
  });

  it('excludes generated paths from the line count and hygiene, keeps them touched', async () => {
    await addTask1Log();
    await fs.writeFile(
      join(tempDir, '.spec-workflow', 'agent-rules.md'),
      ['## Sensitive paths', '', '- src/other.ts', '', '## Generated paths', '', '- plugins/', ''].join('\n'),
    );
    await fs.mkdir(join(tempDir, 'plugins'), { recursive: true });
    const generatedLines = Array.from({ length: 260 }, (_, i) => `export const g${i} = ${i};`);
    generatedLines.push("console.log('generated');");
    await fs.writeFile(join(tempDir, 'plugins/gen.ts'), generatedLines.join('\n') + '\n');
    await fs.writeFile(join(tempDir, 'src/feature.ts'), 'export const feature = 2;\n');

    const result = await gate({ baseRef: base }, '1');

    expect(result.success).toBe(true);
    // plugins/ lines do not count toward the line rule.
    expect(result.data.reasons.some((r: string) => r.startsWith('line-count'))).toBe(false);
    // the generated file stays in the touched list.
    expect(result.data.touched.paths).toContain('plugins/gen.ts');
    // its console call is not scanned.
    expect(result.data.hygiene.console ?? 0).toBe(0);
  });

  it('down-ranks a docs-only change to medium and records the gate review (retro P7)', async () => {
    await addTask1Log();
    const bigDoc = Array.from({ length: 250 }, (_, i) => `Paragraph ${i} about the methodology.`).join('\n') + '\n';
    await fs.mkdir(join(tempDir, 'docs'), { recursive: true });
    await fs.writeFile(join(tempDir, 'docs/guide.md'), bigDoc);
    // Commit the change: untracked paths no longer count toward line-count (retro
    // P6), so the doc must be the implementer's tracked commit to score by size.
    gitCmd(tempDir, ['add', '-A']);
    gitCmd(tempDir, ['commit', '-q', '-m', 'C1']);

    const result = await gate({ baseRef: base }, '1');

    expect(result.success).toBe(true);
    expect(result.data.gate).toBe('pass');
    expect(result.data.risk).toBe('medium');
    expect(result.data.touched.paths).toEqual(['docs/guide.md']);
    expect(result.data.reasons.some((r: string) => r.startsWith('docs-only:'))).toBe(true);
    // The gate stands as the review, so the verifier is skipped and CI is the net.
    expect(result.data.recorded).not.toBeNull();
    const files = await reviewsFiles();
    const reviewFile = files.find((f) => f.startsWith('review-'));
    expect(reviewFile).toBeDefined();
    const md = await fs.readFile(join(specPath, 'reviews', reviewFile!), 'utf-8');
    expect(md).toContain('risk medium');
  });

  it('keeps a change high when a non-doc path is in the set (retro P7)', async () => {
    await addTask1Log();
    const bigDoc = Array.from({ length: 250 }, (_, i) => `Paragraph ${i}.`).join('\n') + '\n';
    await fs.mkdir(join(tempDir, 'docs'), { recursive: true });
    await fs.writeFile(join(tempDir, 'docs/guide.md'), bigDoc);
    await fs.writeFile(join(tempDir, 'src/feature.ts'), 'export const feature = 2;\n');
    // Commit the change: untracked paths no longer count toward line-count (retro
    // P6), so the tracked commit is what the gate measures by size.
    gitCmd(tempDir, ['add', '-A']);
    gitCmd(tempDir, ['commit', '-q', '-m', 'C1']);

    const result = await gate({ baseRef: base }, '1');

    expect(result.success).toBe(true);
    expect(result.data.risk).toBe('high');
    expect(result.data.reasons.some((r: string) => r.startsWith('docs-only:'))).toBe(false);
  });

  it('down-ranks a generated-only change to medium (retro P10)', async () => {
    await addTask1Log();
    // The generated dir is also sensitive, so the change scores high; every
    // touched path is generated, so the verifier is skipped and CI is the net.
    await fs.writeFile(
      join(tempDir, '.spec-workflow', 'agent-rules.md'),
      ['## Sensitive paths', '', '- plugins/', '', '## Generated paths', '', '- plugins/', ''].join('\n'),
    );
    await fs.mkdir(join(tempDir, 'plugins'), { recursive: true });
    await fs.writeFile(join(tempDir, 'plugins/gen.ts'), 'export const g = 1;\n');

    const result = await gate({ baseRef: base }, '1');

    expect(result.success).toBe(true);
    expect(result.data.gate).toBe('pass');
    expect(result.data.risk).toBe('medium');
    expect(result.data.reasons.some((r: string) => r.startsWith('generated-only:'))).toBe(true);
    expect(result.data.recorded).not.toBeNull();
  });

  it('down-ranks a spec-store-only change (no touched path) to medium (retro P10)', async () => {
    await addTask1Log();
    // No path under the code root changed: the whole task lived in the spec store.
    // no-diff would score high; the down-rank makes it medium so the verifier is
    // skipped, and the log the gate already required stands.
    const result = await gate({ baseRef: base }, '1');

    expect(result.success).toBe(true);
    expect(result.data.gate).toBe('pass');
    expect(result.data.touched.total).toBe(0);
    expect(result.data.risk).toBe('medium');
    expect(result.data.reasons.some((r: string) => r.startsWith('no-product-code:'))).toBe(true);
  });

  // --- Component 8: the tdd argument -----------------------------------------
  // Real git and real `node` run the proof against the temp repo; the agent rules
  // add `tdd-test-command: node {files}`. A wrong impl fails the copied test with
  // an AssertionError on the base commit and passes after it is fixed.
  describe('tdd argument', () => {
    const IMPL_WRONG = 'module.exports.sum = (a, b) => 0;\n';
    const IMPL_RIGHT = 'module.exports.sum = (a, b) => a + b;\n';
    const SUM_TEST =
      "const assert = require('node:assert');\n" +
      "const { sum } = require('./impl.js');\n" +
      'assert.strictEqual(sum(1, 2), 3);\n';

    async function writeTddRules(extra = ''): Promise<void> {
      await fs.writeFile(
        join(tempDir, '.spec-workflow', 'agent-rules.md'),
        ['# Agent rules', '', 'tdd-test-command: node {files}', extra, '', '## Sensitive paths', '', '- src/other.ts', ''].join('\n'),
      );
    }

    async function writeTddTask(testPath = 'src/sum.test.js'): Promise<void> {
      await fs.writeFile(
        join(specPath, 'tasks.md'),
        [
          '# Tasks',
          '',
          '- [-] 1. Implement sum',
          `  - Test: \`${testPath}\` — \`sum(a, b)\``,
          '  _Requirements: 4.1_',
          '  _Prompt: Task: Build sum | Restrictions: none | Success: sum adds two numbers_',
          '',
        ].join('\n'),
      );
    }

    async function commit(rel: string, content: string, msg: string): Promise<string> {
      await fs.writeFile(join(tempDir, rel), content);
      gitCmd(tempDir, ['add', '-A']);
      gitCmd(tempDir, ['commit', '-q', '-m', msg]);
      return gitHead(tempDir);
    }

    const TDD_MS = 30_000;

    it('without tdd the data keys are today\'s nine and no sidecar is written', async () => {
      await addTask1Log();
      await fs.writeFile(join(tempDir, 'src/feature.ts'), 'export const feature = 2;\n');

      const result = await gate({ baseRef: base }, '1');

      expect(result.success).toBe(true);
      expect(Object.keys(result.data).sort()).toEqual(
        ['checks', 'gate', 'hygiene', 'reasons', 'recorded', 'risk', 'stats', 'touched', 'typecheck'].sort(),
      );
      expect('tdd' in result.data).toBe(false);
      const files = await reviewsFiles();
      expect(files.some((f) => f.startsWith('.tdd-'))).toBe(false);
    });

    it('refuses tdd in item mode', async () => {
      const result = await gate(
        { commit: base, tdd: { testFiles: ['src/sum.test.js'], redCommit: base } },
        'P7',
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('tdd needs a task');
    });

    it('an assertion-red proof passes at low risk and the review carries tdd', async () => {
      await writeTddRules();
      await writeTddTask();
      const implCommit = await commit('src/impl.js', IMPL_WRONG, 'impl wrong');
      const redCommit = await commit('src/sum.test.js', SUM_TEST, 'red: failing test');
      await commit('src/impl.js', IMPL_RIGHT, 'green: fix impl');
      await addTask1Log();

      const result = await gate(
        { baseRef: implCommit, tdd: { testFiles: ['src/sum.test.js'], redCommit } },
        '1',
      );

      expect(result.success).toBe(true);
      expect(result.data.gate).toBe('pass');
      expect(result.data.risk).toBe('low');
      expect(result.data.tdd.base).toBe('assertion-red');
      expect(result.data.tdd.head).toBe('pass');
      expect(result.data.tdd.seams).toEqual({ 'src/sum.test.js': 'sum(a, b)' });
      expect(result.data.recorded).not.toBeNull();

      const files = await reviewsFiles();
      expect(files.some((f) => f.startsWith('.tdd-'))).toBe(true);
      const reviewFile = files.find((f) => f.startsWith('review-'));
      expect(reviewFile).toBeDefined();
      const md = await fs.readFile(join(specPath, 'reviews', reviewFile!), 'utf-8');
      expect(md).toContain('## TDD proof');
    }, TDD_MS);

    it('fails vacuous when the author tests pass on the base commit (9.2)', async () => {
      await writeTddRules();
      await writeTddTask();
      const implCommit = await commit('src/impl.js', IMPL_RIGHT, 'impl already right');
      const redCommit = await commit('src/sum.test.js', SUM_TEST, 'red: passes on base');
      await addTask1Log();

      const result = await gate(
        { baseRef: implCommit, tdd: { testFiles: ['src/sum.test.js'], redCommit } },
        '1',
      );

      expect(result.success).toBe(true);
      expect(result.data.gate).toBe('fail');
      expect(result.data.tdd.base).toBe('vacuous');
      expect(result.data.reasons).toContain('tdd: tests pass on base');
    }, TDD_MS);

    it('fails when the red commit also changed a source file', async () => {
      await writeTddRules();
      await writeTddTask();
      const implCommit = await commit('src/impl.js', IMPL_WRONG, 'impl wrong');
      // The red commit changes the test and the source together.
      await fs.writeFile(join(tempDir, 'src/sum.test.js'), SUM_TEST);
      await fs.writeFile(join(tempDir, 'src/impl.js'), IMPL_RIGHT);
      gitCmd(tempDir, ['add', '-A']);
      gitCmd(tempDir, ['commit', '-q', '-m', 'red+source']);
      const redCommit = gitHead(tempDir);
      await addTask1Log();

      const result = await gate(
        { baseRef: implCommit, tdd: { testFiles: ['src/sum.test.js'], redCommit } },
        '1',
      );

      expect(result.success).toBe(true);
      expect(result.data.gate).toBe('fail');
      expect(result.data.reasons).toContain('tdd: author changed source: src/impl.js');
    }, TDD_MS);

    it('red-on-base off forces high on a whitespace-only change (5.3)', async () => {
      await writeTddRules('red-on-base: off');
      await writeTddTask();
      await commit('src/impl.js', IMPL_RIGHT, 'impl');
      const redCommit = await commit('src/sum.test.js', SUM_TEST, 'red');
      // A whitespace-only implementer commit: the trivial-change fast path would
      // score it low, but the inconclusive (off) base forces high.
      await commit('src/impl.js', '  ' + IMPL_RIGHT, 'whitespace only');
      await addTask1Log();

      const result = await gate(
        { baseRef: redCommit, tdd: { testFiles: ['src/sum.test.js'], redCommit } },
        '1',
      );

      expect(result.success).toBe(true);
      expect(result.data.risk).toBe('high');
      expect(result.data.tdd.base).toBe('inconclusive');
      expect(result.data.reasons.some((r: string) => r.startsWith('tdd-inconclusive'))).toBe(true);
    }, TDD_MS);

    it('matches a ./-prefixed test file to its seam', async () => {
      await writeTddRules();
      await writeTddTask();
      const implCommit = await commit('src/impl.js', IMPL_WRONG, 'impl wrong');
      const redCommit = await commit('src/sum.test.js', SUM_TEST, 'red');
      await commit('src/impl.js', IMPL_RIGHT, 'green');
      await addTask1Log();

      const result = await gate(
        { baseRef: implCommit, tdd: { testFiles: ['./src/sum.test.js'], redCommit } },
        '1',
      );

      expect(result.success).toBe(true);
      expect(result.data.tdd.seams).toEqual({ './src/sum.test.js': 'sum(a, b)' });
    }, TDD_MS);

    it('off and shadow judge modes give an identical verdict, risk and reasons', async () => {
      await writeTddRules();
      await writeTddTask();
      const implCommit = await commit('src/impl.js', IMPL_WRONG, 'impl wrong');
      const redCommit = await commit('src/sum.test.js', SUM_TEST, 'red');
      await commit('src/impl.js', IMPL_RIGHT, 'green');
      await addTask1Log();

      const args = { baseRef: implCommit, tdd: { testFiles: ['src/sum.test.js'], redCommit } };

      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              model: 'jev-1.13.0',
              usage: { input_tokens: 10 },
              answers: {
                tautological: { noul: 0 },
                asserts_criteria: { score: 2 },
                through_seam: { noul: 1 },
                mocks_internals: { noul: 0 },
              },
            }),
            { status: 200 },
          ),
      );
      try {
        // off: no key, so the judge never runs.
        vi.stubEnv('TYPESAFE_API_KEY', '');
        const offResult = await gate(args, '1');

        // shadow: a key plus a stubbed global fetch answer the judge.
        vi.stubEnv('TYPESAFE_API_KEY', 'test-key');
        vi.stubGlobal('fetch', fetchMock);
        const shadowResult = await gate(args, '1');

        expect(shadowResult.data.gate).toBe(offResult.data.gate);
        expect(shadowResult.data.risk).toBe(offResult.data.risk);
        expect(shadowResult.data.reasons).toEqual(offResult.data.reasons);
        expect(fetchMock).toHaveBeenCalled();
        expect(offResult.data.tdd.judged).toBeNull();
        expect(shadowResult.data.tdd.judged).not.toBeNull();
      } finally {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
      }
    }, TDD_MS);
  });
});

