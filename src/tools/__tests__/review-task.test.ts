import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs, symlinkSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import path, { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const overrides = vi.hoisted(() => ({
  typecheck: null as null | ((...args: any[]) => any),
  hygiene: null as null | ((...args: any[]) => any),
  diff: null as null | ((...args: any[]) => any),
}));

vi.mock('../../core/typecheck.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/typecheck.js')>();
  return {
    ...actual,
    runProjectTypecheck: (...args: any[]) =>
      overrides.typecheck ? overrides.typecheck(...args) : (actual.runProjectTypecheck as any)(...args),
  };
});

vi.mock('../../core/hygiene-signals.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/hygiene-signals.js')>();
  return {
    ...actual,
    computeHygieneSignals: (...args: any[]) =>
      overrides.hygiene ? overrides.hygiene(...args) : (actual.computeHygieneSignals as any)(...args),
  };
});

vi.mock('../../core/task-diff.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/task-diff.js')>();
  return {
    ...actual,
    computeTaskDiff: (...args: any[]) =>
      overrides.diff ? overrides.diff(...args) : (actual.computeTaskDiff as any)(...args),
  };
});

import {
  reviewTaskHandler,
  validateAllFiles,
  safeRealpath,
  _resetValidateWarnings,
  buildReviewMethodology,
  type DiffMethodologyState,
  type TypecheckMethodologyState,
} from '../review-task.js';
import { ToolContext } from '../../types.js';
import { ImplementationLogManager } from '../../dashboard/implementation-log-manager.js';

describe('review-task handler', () => {
  let tempDir: string;
  let context: ToolContext;
  let specPath: string;

  beforeEach(async () => {
    overrides.typecheck = null;
    overrides.hygiene = null;
    overrides.diff = null;
    _resetValidateWarnings();
    tempDir = await fs.mkdtemp(join(tmpdir(), 'review-task-test-'));
    specPath = join(tempDir, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specPath, { recursive: true });
    context = { projectPath: tempDir };

    // Create a minimal tasks.md
    await fs.writeFile(join(specPath, 'tasks.md'), [
      '# Tasks',
      '',
      '- [-] 1. Implement feature',
      '  _Requirements: REQ-001_',
      '  _Prompt: Role: Developer | Task: Build it | Restrictions: No new deps | Success: Tests pass_',
      '',
      '- [ ] 2. Another task',
    ].join('\n'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createImplLog() {
    // Materialize the referenced files so validateAllFiles keeps them
    // (it drops paths whose realpath ENOENTs).
    await fs.mkdir(join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(join(tempDir, 'src/handler.ts'), 'export const x = 1;\n');
    await fs.writeFile(join(tempDir, 'src/new-file.ts'), 'export const y = 2;\n');
    const logManager = new ImplementationLogManager(specPath);
    await logManager.addLogEntry({
      taskId: '1',
      timestamp: new Date().toISOString(),
      summary: 'Implemented feature',
      filesModified: ['src/handler.ts'],
      filesCreated: ['src/new-file.ts'],
      statistics: { linesAdded: 50, linesRemoved: 5, filesChanged: 2 },
      artifacts: {
        functions: [{ name: 'handleRequest', purpose: 'Handle request', location: 'src/handler.ts:10', isExported: true }],
      },
    });
  }

  describe('prepare action', () => {
    it('should fail if no implementation log exists', async () => {
      const result = await reviewTaskHandler(
        { action: 'prepare', specName: 'test-spec', taskId: '1' },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('No implementation log');
    });

    it('should fail if task does not exist', async () => {
      await createImplLog();
      const result = await reviewTaskHandler(
        { action: 'prepare', specName: 'test-spec', taskId: '999' },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return review context and methodology', async () => {
      await createImplLog();
      const result = await reviewTaskHandler(
        { action: 'prepare', specName: 'test-spec', taskId: '1' },
        context
      );
      expect(result.success).toBe(true);
      expect(result.data.taskContext).toBeDefined();
      expect(result.data.implementationSummary).toBeDefined();
      expect(result.data.filesToReview).toContain(join(tempDir, 'src/handler.ts'));
      expect(result.data.methodology).toContain('Review Methodology');
      expect(result.data.methodology).toContain('No new deps');
      expect(result.data.methodology).toContain('Tests pass');
    });

    it('should write a prepare marker', async () => {
      await createImplLog();
      await reviewTaskHandler(
        { action: 'prepare', specName: 'test-spec', taskId: '1' },
        context
      );

      // Check marker file exists
      const reviewsDir = join(specPath, 'reviews');
      const files = await fs.readdir(reviewsDir);
      expect(files.some(f => f.startsWith('.prepare-'))).toBe(true);
    });

    describe('hygiene signal integration', () => {
      const ORIGINAL_ITEM_9 = '9. **Hygiene**: Hardcoded secrets, leftover debug code (console.log, TODO/FIXME from this task), commented-out code, unused imports or variables introduced by this task. Mark findings from items 7-9 with category: "hygiene".';

      async function seedLogWithFiles(filesModified: string[], filesCreated: string[] = []) {
        const logManager = new ImplementationLogManager(specPath);
        await logManager.addLogEntry({
          taskId: '1',
          timestamp: new Date().toISOString(),
          summary: 'Implemented feature',
          filesModified,
          filesCreated,
          statistics: { linesAdded: 10, linesRemoved: 0, filesChanged: filesModified.length + filesCreated.length },
          artifacts: {},
        });
      }

      it('(a) returns hygieneSignals with correct line numbers and patterns', async () => {
        const relPath = 'src/dirty.ts';
        const absPath = join(tempDir, relPath);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, [
          'function foo() {',
          "  console.log('debug');",
          '  // TODO: x',
          '}',
        ].join('\n'));
        await seedLogWithFiles([relPath]);

        const result = await reviewTaskHandler(
          { action: 'prepare', specName: 'test-spec', taskId: '1' },
          context
        );

        expect(result.success).toBe(true);
        const signals = result.data.hygieneSignals;
        expect(signals).toHaveLength(2);
        const consoleSig = signals.find((s: any) => s.pattern === 'console')!;
        const todoSig = signals.find((s: any) => s.pattern === 'todo')!;
        expect(consoleSig.line).toBe(2);
        expect(todoSig.line).toBe(3);
      });

      it('(b) clean task returns empty hygieneSignals AND original item 9 text', async () => {
        const relPath = 'src/clean.ts';
        const absPath = join(tempDir, relPath);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, [
          'export function add(a: number, b: number) {',
          '  return a + b;',
          '}',
        ].join('\n'));
        await seedLogWithFiles([relPath]);

        const result = await reviewTaskHandler(
          { action: 'prepare', specName: 'test-spec', taskId: '1' },
          context
        );

        expect(result.success).toBe(true);
        expect(result.data.hygieneSignals).toEqual([]);
        expect(result.data.methodology).toContain(ORIGINAL_ITEM_9);
      });

      it('(c) methodology contains triage directive when signals are present', async () => {
        const relPath = 'src/dirty.ts';
        const absPath = join(tempDir, relPath);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, "console.log('hi');");
        await seedLogWithFiles([relPath]);

        const result = await reviewTaskHandler(
          { action: 'prepare', specName: 'test-spec', taskId: '1' },
          context
        );

        expect(result.success).toBe(true);
        expect(result.data.methodology).toContain('Pre-computed hygiene signals are attached in');
      });

      it('(d) every signal has an absolute file path', async () => {
        const relPath = 'src/dirty.ts';
        const absPath = join(tempDir, relPath);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, [
          "console.log('a');",
          '// TODO: y',
          'debugger;',
        ].join('\n'));
        await seedLogWithFiles([relPath]);

        const result = await reviewTaskHandler(
          { action: 'prepare', specName: 'test-spec', taskId: '1' },
          context
        );

        expect(result.success).toBe(true);
        const signals = result.data.hygieneSignals;
        expect(signals.length).toBeGreaterThan(0);
        for (const signal of signals) {
          expect(path.isAbsolute(signal.file)).toBe(true);
        }
      });
    });
  });

  describe('record action', () => {
    it('should fail without prepare marker', async () => {
      await createImplLog();
      const result = await reviewTaskHandler(
        { action: 'record', specName: 'test-spec', taskId: '1', verdict: 'pass', summary: 'OK', findings: [] },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('prepare');
    });

    it('should reject pass verdict with findings', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        {
          action: 'record', specName: 'test-spec', taskId: '1',
          verdict: 'pass', summary: 'OK',
          findings: [{ severity: 'info', title: 'Note', description: 'Something' }]
        },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('zero findings');
    });

    it('should reject fail verdict without criticals', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        {
          action: 'record', specName: 'test-spec', taskId: '1',
          verdict: 'fail', summary: 'Bad',
          findings: [{ severity: 'warning', title: 'Warn', description: 'Not critical' }]
        },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('critical finding');
    });

    it('should reject findings verdict with criticals', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        {
          action: 'record', specName: 'test-spec', taskId: '1',
          verdict: 'findings', summary: 'Issues',
          findings: [{ severity: 'critical', title: 'Crit', description: 'Bad' }]
        },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('fail');
    });

    it('should record a passing review', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        { action: 'record', specName: 'test-spec', taskId: '1', verdict: 'pass', summary: 'All checks passed', findings: [] },
        context
      );
      expect(result.success).toBe(true);
      expect(result.data.verdict).toBe('pass');
      expect(result.data.version).toBe(1);
      expect(result.data.criticalCount).toBe(0);
    });

    it('should record a failing review with severity counts', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        {
          action: 'record', specName: 'test-spec', taskId: '1',
          verdict: 'fail', summary: 'Critical bug',
          findings: [
            { severity: 'critical', title: 'Bug', description: 'desc' },
            { severity: 'warning', title: 'Warn', description: 'desc' },
            { severity: 'info', title: 'Note', description: 'desc' },
          ]
        },
        context
      );
      expect(result.success).toBe(true);
      expect(result.data.criticalCount).toBe(1);
      expect(result.data.warningCount).toBe(1);
      expect(result.data.infoCount).toBe(1);
    });

    it('should increment version on re-review', async () => {
      await createImplLog();

      // First review
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);
      await reviewTaskHandler(
        { action: 'record', specName: 'test-spec', taskId: '1', verdict: 'fail', summary: 'Bad', findings: [{ severity: 'critical', title: 'X', description: 'Y' }] },
        context
      );

      // Second review
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);
      const result = await reviewTaskHandler(
        { action: 'record', specName: 'test-spec', taskId: '1', verdict: 'pass', summary: 'Fixed', findings: [] },
        context
      );
      expect(result.data.version).toBe(2);
    });
  });
});

describe('safeRealpath', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    _resetValidateWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    tempDir = await fs.mkdtemp(join(tmpdir(), 'safe-realpath-test-'));
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns the realpath for an existing file', () => {
    const filePath = join(tempDir, 'a.txt');
    writeFileSync(filePath, '');
    const result = safeRealpath(filePath);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('returns undefined silently on ENOENT (deleted/missing file)', () => {
    const missing = join(tempDir, 'does-not-exist.txt');
    const result = safeRealpath(missing);
    expect(result).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warn-once on non-ENOENT error (ELOOP from symlink cycle)', () => {
    const a = join(tempDir, 'a-link');
    const b = join(tempDir, 'b-link');
    symlinkSync(b, a);
    symlinkSync(a, b);

    const r1 = safeRealpath(a);
    expect(r1).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/safeRealpath: ELOOP/);

    // Same path + same code: deduped
    const r2 = safeRealpath(a);
    expect(r2).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('validateAllFiles', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(async () => {
    _resetValidateWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    tempDir = await fs.mkdtemp(join(tmpdir(), 'validate-all-files-test-'));
  });

  afterEach(async () => {
    warnSpy.mockRestore();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function makeFile(rel: string): string {
    const abs = join(tempDir, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, '');
    return abs;
  }

  it('returns [] and warns on non-array input', () => {
    expect(validateAllFiles(null as unknown, tempDir)).toEqual([]);
    expect(validateAllFiles('not-an-array' as unknown, tempDir)).toEqual([]);
    expect(validateAllFiles({ length: 1, 0: 'x' } as unknown, tempDir)).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toMatch(/allFiles is not an array/);
  });

  it('drops NUL-byte paths with warn', () => {
    makeFile('ok.ts');
    const result = validateAllFiles(['ok.ts', 'bad\0.ts'], tempDir);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(path.resolve(tempDir, 'ok.ts'));
    const warnings = warnSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('\n');
    // NUL-byte handling differs across Node versions: path.resolve may throw
    // (ERR_INVALID_ARG_VALUE), or realpathSync rejects it. Either way the
    // entry must be dropped and some warn must fire.
    expect(warnings).toMatch(/path\.resolve threw|safeRealpath/);
  });

  it('drops non-string elements (number, Symbol, BigInt, null, undefined) with warn', () => {
    makeFile('ok.ts');
    const result = validateAllFiles(
      [42, Symbol('s'), BigInt(0), null, undefined, 'ok.ts'],
      tempDir
    );
    expect(result).toEqual([path.resolve(tempDir, 'ok.ts')]);
    const warnings = warnSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('\n');
    expect(warnings).toMatch(/non-string entry at index 0/);
  });

  it('keeps relative paths (resolved against projectPath)', () => {
    makeFile('src/handler.ts');
    const result = validateAllFiles(['src/handler.ts'], tempDir);
    expect(result).toEqual([path.resolve(tempDir, 'src/handler.ts')]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('drops absolute paths resolving outside projectPath with warn', async () => {
    const otherDir = await fs.mkdtemp(join(tmpdir(), 'validate-other-'));
    try {
      const outside = join(otherDir, 'outside.txt');
      writeFileSync(outside, '');
      makeFile('inside.ts');
      const result = validateAllFiles([outside, 'inside.ts'], tempDir);
      expect(result).toEqual([path.resolve(tempDir, 'inside.ts')]);
      const warnings = warnSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('\n');
      expect(warnings).toMatch(/path outside projectPath/);
    } finally {
      await fs.rm(otherDir, { recursive: true, force: true });
    }
  });

  it('drops symlinks whose target is outside projectPath with warn', async () => {
    const otherDir = await fs.mkdtemp(join(tmpdir(), 'validate-other-'));
    try {
      const outsideTarget = join(otherDir, 'outside.ts');
      writeFileSync(outsideTarget, '');
      const linkPath = join(tempDir, 'link.ts');
      symlinkSync(outsideTarget, linkPath);

      const result = validateAllFiles(['link.ts'], tempDir);
      expect(result).toEqual([]);
      const warnings = warnSpy.mock.calls.map((c: unknown[]) => c[0] as string).join('\n');
      expect(warnings).toMatch(/path outside projectPath/);
    } finally {
      await fs.rm(otherDir, { recursive: true, force: true });
    }
  });

  it('drops deleted files silently (safeRealpath ENOENT, no warn)', () => {
    makeFile('exists.ts');
    const result = validateAllFiles(['exists.ts', 'gone.ts'], tempDir);
    expect(result).toEqual([path.resolve(tempDir, 'exists.ts')]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('dedupes duplicates by realpath and preserves first-seen original', () => {
    makeFile('src/a.ts');
    const result = validateAllFiles(
      ['src/a.ts', './src/a.ts', path.resolve(tempDir, 'src/a.ts')],
      tempDir
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(path.resolve(tempDir, 'src/a.ts'));
  });

});

// ---------------------------------------------------------------------------
// handlePrepare integration tests (task 11; Track-A composite-pin block
// removed in 16.1 — Track-B fixtures + composite/drift/sentinel pins land in
// task 17).
// ---------------------------------------------------------------------------

describe('handlePrepare integration', () => {
  let tempDir: string;
  let specPath: string;
  let context: ToolContext;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  // Canonical fixture inputs (R4.10):
  // requirements=['1.1','2.4']; restrictions='Do NOT bypass denylist; do NOT change truncation messages';
  // success='All listed cases pass; messages emit verbatim'; leverage='src/core/path-denylist.ts';
  // hasTechSteering=true; hasPriorReviews=false; hasHygieneSignals=true.
  const CANONICAL_TASKS_MD = [
    '# Tasks',
    '',
    '- [-] 1. Implement feature',
    '  - _Leverage: src/core/path-denylist.ts_',
    '  - _Requirements: 1.1, 2.4_',
    '  - _Prompt: Role: Developer | Task: Build it | Restrictions: Do NOT bypass denylist; do NOT change truncation messages | Success: All listed cases pass; messages emit verbatim_',
    '',
  ].join('\n');

  beforeEach(async () => {
    overrides.typecheck = null;
    overrides.hygiene = null;
    overrides.diff = null;
    _resetValidateWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    tempDir = await fs.mkdtemp(join(tmpdir(), 'review-task-track-a-'));
    specPath = join(tempDir, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specPath, { recursive: true });
    // Steering doc → hasTechSteering=true
    const steeringDir = join(tempDir, '.spec-workflow', 'steering');
    await fs.mkdir(steeringDir, { recursive: true });
    await fs.writeFile(join(steeringDir, 'tech.md'), '# Tech\n');
    await fs.writeFile(join(specPath, 'tasks.md'), CANONICAL_TASKS_MD);
    context = { projectPath: tempDir };
  });

  afterEach(async () => {
    overrides.typecheck = null;
    overrides.hygiene = null;
    overrides.diff = null;
    warnSpy.mockRestore();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function seedLog(filesModified: string[], filesCreated: string[] = []) {
    const logManager = new ImplementationLogManager(specPath);
    await logManager.addLogEntry({
      taskId: '1',
      timestamp: new Date().toISOString(),
      summary: 'Implemented',
      filesModified,
      filesCreated,
      statistics: { linesAdded: 1, linesRemoved: 0, filesChanged: filesModified.length + filesCreated.length },
      artifacts: {},
    });
  }

  async function materializeFile(rel: string, content = 'export const x = 1;\n'): Promise<string> {
    const abs = join(tempDir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
    return abs;
  }

  async function runPrepare() {
    return reviewTaskHandler(
      { action: 'prepare', specName: 'test-spec', taskId: '1' },
      context
    );
  }

  it('returns typecheckResults and emits Item 10 directive (success-with-diagnostics)', async () => {
    await materializeFile('src/x.ts');
    await seedLog(['src/x.ts']);
    overrides.typecheck = async () => [
      {
        tsconfigPath: join(tempDir, 'tsconfig.json'),
        status: 'success',
        diagnostics: [
          { file: join(tempDir, 'src/x.ts'), line: 1, column: 1, code: 'TS2322', message: 'oops', inScope: true },
        ],
        coverage: { compiled: [join(tempDir, 'src/x.ts')], excluded: [] },
      },
    ];

    const result = await runPrepare();
    expect(result.success).toBe(true);
    expect(result.data.typecheckResults).toHaveLength(1);
    expect(result.data.typecheckResults[0].status).toBe('success');
    expect(result.data.typecheckResults[0].diagnostics).toHaveLength(1);
    expect(result.data.methodology).toContain('Triage the typecheck diagnostics.');
  });

  // Track-A "no diff fields" guard removed: task 14 lights up the diff data
  // fields. Track-B presence tests are added in task 17.

  it('runs typecheck and hygiene concurrently (barrier-based, no wall-clock)', async () => {
    await materializeFile('src/x.ts');
    await seedLog(['src/x.ts']);

    // Barrier approach: each utility resolves its own "started" deferred, then
    // awaits the OTHER's "started" deferred before completing. If the handler
    // ran them sequentially, the second would never start, so the first would
    // hang waiting on a deferred that nobody resolves. Concurrency is proven
    // by construction — no timer thresholds.
    let resolveTcStarted!: () => void;
    let resolveHyStarted!: () => void;
    const tcStarted = new Promise<void>(r => { resolveTcStarted = r; });
    const hyStarted = new Promise<void>(r => { resolveHyStarted = r; });

    overrides.typecheck = async () => {
      resolveTcStarted();
      await hyStarted;
      return [
        {
          tsconfigPath: join(tempDir, 'tsconfig.json'),
          status: 'success',
          diagnostics: [],
          coverage: { compiled: [join(tempDir, 'src/x.ts')], excluded: [] },
        },
      ];
    };
    overrides.hygiene = async () => {
      resolveHyStarted();
      await tcStarted;
      return [];
    };

    // If the handler awaited typecheck before starting hygiene, this would
    // hang forever; vitest's per-test timeout would surface the regression.
    const result = await runPrepare();
    expect(result.success).toBe(true);
  });

  it('typecheck rejection → reason: rejection + R4.6b emits + handlePrepare succeeds', async () => {
    await materializeFile('src/x.ts');
    await seedLog(['src/x.ts']);
    overrides.typecheck = async () => { throw new Error('boom'); };

    const result = await runPrepare();
    expect(result.success).toBe(true);
    expect(result.data.typecheckResults[0].status).toBe('unavailable');
    expect(result.data.typecheckResults[0].reason).toBe('rejection');
    expect(result.data.typecheckResults[0].rejectionMessage).toBe('boom');
    expect(result.data.methodology).toContain('Typecheck did not run for this review.');
    const warnText = warnSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(warnText).toMatch(/typecheck rejected unexpectedly: boom/);
  });

  it('hygiene rejection → data.hygieneRejection.message set + handlePrepare succeeds', async () => {
    await materializeFile('src/x.ts');
    await seedLog(['src/x.ts']);
    overrides.typecheck = async () => [
      {
        tsconfigPath: join(tempDir, 'tsconfig.json'),
        status: 'success',
        diagnostics: [],
        coverage: { compiled: [join(tempDir, 'src/x.ts')], excluded: [] },
      },
    ];
    overrides.hygiene = async () => { throw new Error('hygiene-fail'); };

    const result = await runPrepare();
    expect(result.success).toBe(true);
    expect(result.data.hygieneSignals).toEqual([]);
    expect(result.data.hygieneRejection).toBeDefined();
    expect(result.data.hygieneRejection.message).toBe('hygiene-fail');
    const warnText = warnSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(warnText).toMatch(/hygiene rejected unexpectedly: hygiene-fail/);
  });

  it('unwrap warn-once: distinct messages logged separately, same message deduped', async () => {
    await materializeFile('src/x.ts');
    await seedLog(['src/x.ts']);

    let call = 0;
    overrides.typecheck = async () => {
      call++;
      if (call === 1) throw new Error('msg-A');
      if (call === 2) throw new Error('msg-B');
      throw new Error('msg-A'); // call 3: dedupes with call 1
    };

    await runPrepare();
    await runPrepare();
    await runPrepare();

    const tcWarnings = warnSpy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .filter((m: string) => m.includes('typecheck rejected unexpectedly'));
    expect(tcWarnings).toHaveLength(2);
    expect(tcWarnings.some((m: string) => m.includes('msg-A'))).toBe(true);
    expect(tcWarnings.some((m: string) => m.includes('msg-B'))).toBe(true);
  });

  it('unwrap warn-once: hygiene branch uses a separate key namespace', async () => {
    await materializeFile('src/x.ts');
    await seedLog(['src/x.ts']);
    overrides.typecheck = async () => [
      {
        tsconfigPath: join(tempDir, 'tsconfig.json'),
        status: 'success',
        diagnostics: [],
        coverage: { compiled: [join(tempDir, 'src/x.ts')], excluded: [] },
      },
    ];

    let call = 0;
    overrides.hygiene = async () => {
      call++;
      if (call === 1) throw new Error('shared-msg');
      if (call === 2) throw new Error('hy-other');
      throw new Error('shared-msg'); // dedupes with call 1
    };

    await runPrepare();
    await runPrepare();
    await runPrepare();

    const hyWarnings = warnSpy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .filter((m: string) => m.includes('hygiene rejected unexpectedly'));
    expect(hyWarnings).toHaveLength(2);
    expect(hyWarnings.some((m: string) => m.includes('shared-msg'))).toBe(true);
    expect(hyWarnings.some((m: string) => m.includes('hy-other'))).toBe(true);
  });

  it('integration validateAllFiles smoke test: outside-projectPath dropped, valid kept, warn fires', async () => {
    const otherDir = await fs.mkdtemp(join(tmpdir(), 'review-task-outside-'));
    try {
      await materializeFile('src/valid.ts');
      const outside = join(otherDir, 'outside.ts');
      writeFileSync(outside, '');
      // Seed log with one valid relative path and one absolute outside-projectPath.
      await seedLog(['src/valid.ts', outside]);
      overrides.typecheck = async () => [
        {
          tsconfigPath: join(tempDir, 'tsconfig.json'),
          status: 'success',
          diagnostics: [],
          coverage: { compiled: [join(tempDir, 'src/valid.ts')], excluded: [] },
        },
      ];

      const result = await runPrepare();
      expect(result.success).toBe(true);
      expect(result.data.filesToReview).toEqual([path.resolve(tempDir, 'src/valid.ts')]);
      const warnings = warnSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
      expect(warnings).toMatch(/path outside projectPath/);
    } finally {
      await fs.rm(otherDir, { recursive: true, force: true });
    }
  });

  // Track-A interim composite-pin block deleted per R4.9: Track-B's PR replaces
  // those interim pins. Track-B fixtures live at src/tools/__tests__/__fixtures__/methodology/
  // (no `track-a-` prefix); task 17 wires them into composite-pin assertions
  // alongside the diff-state mock and the two-way drift / sentinel tests.

  describe('Track-B diff rejection vs empty distinguisher (R4.2a vs R4.2b)', () => {
    it('diff utility rejection → R4.2b emits AND data.diffRejection.message is set', async () => {
      await materializeFile('src/x.ts');
      await seedLog(['src/x.ts']);
      overrides.typecheck = async () => [
        {
          tsconfigPath: join(tempDir, 'tsconfig.json'),
          status: 'success',
          diagnostics: [],
          coverage: { compiled: [join(tempDir, 'src/x.ts')], excluded: [] },
        },
      ];
      overrides.diff = async () => { throw new Error('git-spawn-fail'); };

      const result = await runPrepare();
      expect(result.success).toBe(true);
      expect(result.data.diff).toBe('');
      expect(result.data.diffRejection).toBeDefined();
      expect(result.data.diffRejection.message).toBe('git-spawn-fail');
      expect(result.data.methodology).toContain('Diff utility rejected unexpectedly');
      expect(result.data.methodology).not.toContain('No diff available');
    });

    it('diff utility returns benign empty → R4.2a emits AND data.diffRejection is undefined', async () => {
      await materializeFile('src/x.ts');
      await seedLog(['src/x.ts']);
      overrides.typecheck = async () => [
        {
          tsconfigPath: join(tempDir, 'tsconfig.json'),
          status: 'success',
          diagnostics: [],
          coverage: { compiled: [join(tempDir, 'src/x.ts')], excluded: [] },
        },
      ];
      overrides.diff = async () => ({
        diff: '',
        stats: undefined,
        skippedPaths: [],
        truncated: false,
      });

      const result = await runPrepare();
      expect(result.success).toBe(true);
      expect(result.data.diff).toBe('');
      expect(result.data.diffRejection).toBeUndefined();
      expect(result.data.methodology).toContain('No diff available');
      expect(result.data.methodology).not.toContain('Diff utility rejected unexpectedly');
    });
  });

  describe('end-to-end secret-leak across all three consumers (NFR Security)', () => {
    it('denylisted paths absent from skippedPaths consumers (diff/hygiene/typecheck)', async () => {
      // Materialize a real .ts file (kept) + .ENV (secret-bearing, denied) + package-lock.json (denied)
      await materializeFile('src/keep.ts', 'export const x = 1;\n');
      const envAbs = join(tempDir, '.ENV');
      writeFileSync(envAbs, 'SECRET=do-not-expose\n');
      const lockAbs = join(tempDir, 'package-lock.json');
      writeFileSync(lockAbs, '{"name":"do-not-expose"}\n');
      await seedLog(['src/keep.ts', '.ENV', 'package-lock.json']);

      // Real diff utility (no override) — temp dir isn't a git repo, so the
      // real implementation will return an empty diff with skippedPaths.
      overrides.diff = null;

      // Real hygiene runs but its denylist filter MUST drop .ENV and package-lock.json.
      overrides.hygiene = null;

      // Typecheck mock that simulates a real run including the denied files in
      // its raw output — the mock asserts what handlePrepare DOES with the
      // results. The handler does NOT post-filter typecheck results (filtering
      // lives inside runProjectTypecheck per task 5.3); to verify the third-
      // consumer denylist promise end-to-end we let the mock represent the
      // post-denylist shape: compiled keeps src/keep.ts only, excluded empty,
      // diagnostics empty.
      overrides.typecheck = async (_projectPath: string, allFiles: string[]) => {
        // Sanity: handler should pass through allFiles as-is to the utility;
        // the utility owns the denylist filter. Mock output emulates that.
        return [
          {
            tsconfigPath: join(tempDir, 'tsconfig.json'),
            status: 'success',
            diagnostics: [],
            coverage: {
              compiled: allFiles.filter(p => p.endsWith('keep.ts')),
              excluded: [],
            },
          },
        ];
      };

      const result = await runPrepare();
      expect(result.success).toBe(true);

      // (a) skippedPaths surfaced from diff utility
      const skippedNames = (result.data.skippedPaths as string[]).map(p => path.basename(p));
      expect(skippedNames).toContain('.ENV');
      expect(skippedNames).toContain('package-lock.json');

      // (b) data.diff does not mention .ENV or package-lock.json content
      expect(result.data.diff).not.toMatch(/\.ENV/);
      expect(result.data.diff).not.toMatch(/package-lock\.json/);
      expect(result.data.diff).not.toMatch(/SECRET=do-not-expose/);
      expect(result.data.diff).not.toMatch(/"name":"do-not-expose"/);

      // (c) hygieneSignals does not include .ENV or package-lock.json
      const hygieneFiles = (result.data.hygieneSignals as Array<{ file: string }>).map(s =>
        path.basename(s.file)
      );
      expect(hygieneFiles).not.toContain('.ENV');
      expect(hygieneFiles).not.toContain('package-lock.json');

      // (d) typecheck coverage.compiled, coverage.excluded, diagnostics[].file
      // do NOT contain .ENV or package-lock.json
      const tc = result.data.typecheckResults[0];
      const coverageNames = [
        ...(tc.coverage?.compiled ?? []).map((p: string) => path.basename(p)),
        ...(tc.coverage?.excluded ?? []).map((p: string) => path.basename(p)),
      ];
      const diagFiles = (tc.diagnostics ?? []).map((d: { file: string }) => path.basename(d.file));
      expect(coverageNames).not.toContain('.ENV');
      expect(coverageNames).not.toContain('package-lock.json');
      expect(diagFiles).not.toContain('.ENV');
      expect(diagFiles).not.toContain('package-lock.json');
    });
  });
});

// ---------------------------------------------------------------------------
// Track-B composite-pin tests against all 17 fixtures.
// Each fixture file in __fixtures__/methodology/*.txt has a docstring section
// followed by `---` then the verbatim buildReviewMethodology output for a
// canonical (diffState, typecheckState) pair (R4.10).
// ---------------------------------------------------------------------------

const __filename_test = fileURLToPath(import.meta.url);
const __dirname_test = dirname(__filename_test);
const FIXTURE_DIR = path.resolve(__dirname_test, '__fixtures__/methodology');
const REQUIREMENTS_MD = path.resolve(
  __dirname_test,
  '../../../.spec-workflow/specs/tighter-reviews/requirements.md'
);

// Canonical input shared by every fixture (R4.10):
// requirements=['1.1', '2.4']; restrictions=...; success=...; leverage=...;
// hasTechSteering=true; hasPriorReviews=false; hasHygieneSignals=true.
const CANONICAL_TASK_CONTEXT = {
  description: 'Implement feature',
  requirements: ['1.1', '2.4'],
  leverage: 'src/core/path-denylist.ts',
  prompt: null as string | null,
  promptStructured: [
    { key: 'Role', value: 'Developer' },
    { key: 'Task', value: 'Build it' },
    { key: 'Restrictions', value: 'Do NOT bypass denylist; do NOT change truncation messages' },
    { key: 'Success', value: 'All listed cases pass; messages emit verbatim' },
  ],
};
const HAS_TECH_STEERING = true;
const HAS_PRIOR_REVIEWS = false;
const HAS_HYGIENE_SIGNALS = true;

// Filename → (diffState, typecheckState). Mirrors each fixture's canonical input docstring.
const FIXTURE_INPUTS: Record<string, { diffState: DiffMethodologyState; typecheckState: TypecheckMethodologyState }> = {
  // 7 typecheck-axis (diff held at 'present')
  'success-clean-full.txt':
    { diffState: { kind: 'present' }, typecheckState: { kind: 'success-clean-full' } },
  'success-with-diagnostics.txt':
    { diffState: { kind: 'present' }, typecheckState: { kind: 'success-with-diagnostics', truncated: false } },
  'success-partial-coverage.txt':
    { diffState: { kind: 'present' }, typecheckState: { kind: 'success-partial-coverage' } },
  'success-with-diagnostics-and-partial-coverage.txt':
    { diffState: { kind: 'present' }, typecheckState: { kind: 'success-with-diagnostics-and-partial-coverage', truncated: false } },
  'unavailable-feature-disabled.txt':
    { diffState: { kind: 'present' }, typecheckState: { kind: 'unavailable-feature-disabled' } },
  'unavailable-other.txt':
    { diffState: { kind: 'present' }, typecheckState: { kind: 'unavailable-other', reason: 'project-references' } },
  'timeout.txt':
    { diffState: { kind: 'present' }, typecheckState: { kind: 'timeout' } },
  // 4 diff-axis (typecheck held at success-clean-full)
  'diff-empty.txt':
    { diffState: { kind: 'empty' }, typecheckState: { kind: 'success-clean-full' } },
  'diff-present-untruncated.txt':
    { diffState: { kind: 'present' }, typecheckState: { kind: 'success-clean-full' } },
  'diff-present-truncated.txt':
    { diffState: { kind: 'present-truncated' }, typecheckState: { kind: 'success-clean-full' } },
  'diff-rejected.txt':
    { diffState: { kind: 'rejected', message: '<diff utility error>' }, typecheckState: { kind: 'success-clean-full' } },
  // 6 cross-axis
  'cross-success-partial-coverage-diff-empty.txt':
    { diffState: { kind: 'empty' }, typecheckState: { kind: 'success-partial-coverage' } },
  'cross-timeout-diff-present-truncated.txt':
    { diffState: { kind: 'present-truncated' }, typecheckState: { kind: 'timeout' } },
  'cross-unavailable-other-diff-present-truncated.txt':
    { diffState: { kind: 'present-truncated' }, typecheckState: { kind: 'unavailable-other', reason: 'project-references' } },
  'cross-success-with-diagnostics-diff-empty.txt':
    { diffState: { kind: 'empty' }, typecheckState: { kind: 'success-with-diagnostics', truncated: false } },
  'cross-diff-rejected-typecheck-rejection.txt':
    { diffState: { kind: 'rejected', message: '<diff utility error>' }, typecheckState: { kind: 'unavailable-other', reason: 'rejection' } },
  'cross-success-partial-coverage-diff-rejected.txt':
    { diffState: { kind: 'rejected', message: '<diff utility error>' }, typecheckState: { kind: 'success-partial-coverage' } },
};

// Normalization pipeline (R4.10):
//   1. \r\n → \n
//   2. line-by-line .trimEnd()
//   3. NFC
//   4. em-dash → hyphen
//   5. smart quotes → straight
//   6. whitespace-run collapse to single space
//
// For the drift extractors, paragraph boundaries on `\n\n` MUST be detected
// BEFORE whitespace-collapse — that boundary detection is internalised in
// `extractDirectiveSentences` (line-walk over the body) and
// `extractR4BlocksFromRequirements` (line-walk over requirements.md), so by
// the time text reaches `normalize` here the boundaries are already encoded
// in separate strings. Composite-pin and drift therefore share this single
// helper today; if a caller ever needs boundary preservation INSIDE `normalize`,
// split the function then — don't introduce divergent copies preemptively.
function normalize(text: string): string {
  let n = text.replace(/\r\n/g, '\n');
  n = n.split('\n').map(l => l.replace(/\s+$/, '')).join('\n');
  n = n.normalize('NFC');
  n = n.replace(/—/g, '-');
  n = n.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  n = n.replace(/\s+/g, ' ');
  return n.trim();
}

function loadFixtureBody(filename: string): string {
  const raw = readFileSync(join(FIXTURE_DIR, filename), 'utf-8');
  const sepIdx = raw.indexOf('\n---\n');
  if (sepIdx < 0) throw new Error(`Fixture ${filename} missing '---' separator`);
  return raw.slice(sepIdx + 5);
}

describe('Track-B composite pins (R4.10)', () => {
  for (const [filename, { diffState, typecheckState }] of Object.entries(FIXTURE_INPUTS)) {
    it(`fixture ${filename} matches buildReviewMethodology output`, () => {
      const fixtureBody = loadFixtureBody(filename);
      const actual = buildReviewMethodology(
        CANONICAL_TASK_CONTEXT as any,
        HAS_TECH_STEERING,
        HAS_PRIOR_REVIEWS,
        HAS_HYGIENE_SIGNALS,
        diffState,
        typecheckState,
      );
      expect(normalize(actual)).toBe(normalize(fixtureBody));
    });
  }

  it('fixture count is exactly 17', () => {
    const files = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.txt'));
    expect(files).toHaveLength(17);
  });
});

// ---------------------------------------------------------------------------
// Track-A interim sentinel — Track B replaces those interim fixtures, so the
// marker `# SPEC-WORKFLOW:TRACK-A:INTERIM-PIN` MUST be absent from every
// fixture in the directory.
// ---------------------------------------------------------------------------

describe('Track-A interim sentinel', () => {
  it('no fixture file contains # SPEC-WORKFLOW:TRACK-A:INTERIM-PIN', () => {
    const files = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.txt'));
    for (const f of files) {
      const content = readFileSync(join(FIXTURE_DIR, f), 'utf-8');
      expect(content).not.toContain('# SPEC-WORKFLOW:TRACK-A:INTERIM-PIN');
    }
  });
});

// ---------------------------------------------------------------------------
// Two-way drift test (R4.10).
//
// Heading regex (PINNED): /^####\s+(R4\.\d+[a-z]?)\s+[—-]\s+/m
//   R4.x directives MUST use exactly four `#` and an em-dash or ASCII hyphen
//   separator. Other heading shapes (`### `, `#####`, `**R4.1**`, `: ` instead
//   of dash) fail to match — surfaces as keyset failure, not silent.
//
// Block extraction:
//   - Matches both `> ...` block-quote and ```...``` fenced-block delimiters
//     following a matched heading.
//   - Each extracted block is keyed by R4.x name.
//   - Duplicate-name handling: if two blocks extract under the same name (e.g.
//     a future R4.x maintenance splits the directive across two `> ...`
//     paragraphs under one heading), the test FAILS (does not silently
//     concatenate or last-write-wins).
//   - Empty-block handling: a heading whose block is missing or empty FAILS
//     (closes the silent-loss path: a future R4.x written as a numbered list
//     would otherwise vacuously match Direction A).
// ---------------------------------------------------------------------------

const EXPECTED_R4_BLOCK_NAMES = [
  'R4.1',
  'R4.2a',
  'R4.2b',
  'R4.4',
  'R4.5',
  'R4.6a',
  'R4.6b',
  'R4.7',
] as const;

function extractR4BlocksFromRequirements(text: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const lines = text.split('\n');
  // Pinned heading regex: see header comment above.
  const HEADING_RE = /^####\s+(R4\.\d+[a-z]?)\s+[—-]\s+/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADING_RE);
    if (!m) continue;
    const name = m[1];

    let j = i + 1;
    let blockContent: string | null = null;
    while (j < lines.length && !/^#+\s/.test(lines[j])) {
      if (lines[j].startsWith('> ')) {
        const quotedLines: string[] = [];
        while (j < lines.length && lines[j].startsWith('> ')) {
          quotedLines.push(lines[j].slice(2));
          j++;
        }
        const candidate = quotedLines.join(' ');
        if (blockContent !== null) {
          throw new Error(
            `Duplicate block found for ${name} — R4.x directives must be a single contiguous block-quote or fenced block`,
          );
        }
        blockContent = candidate;
        continue;
      }
      if (lines[j].startsWith('```')) {
        const fenced: string[] = [];
        j++;
        while (j < lines.length && !lines[j].startsWith('```')) {
          fenced.push(lines[j]);
          j++;
        }
        if (j < lines.length) j++;
        const candidate = fenced.join(' ');
        if (blockContent !== null) {
          throw new Error(
            `Duplicate block found for ${name} — R4.x directives must be a single contiguous block-quote or fenced block`,
          );
        }
        blockContent = candidate;
        continue;
      }
      j++;
    }

    if (blockContent === null || blockContent.trim() === '') {
      throw new Error(
        `R4.x heading found but no block content extracted for ${name} — directives must be \`>\` block-quote or \`\`\` fenced`,
      );
    }
    if (blocks.has(name)) {
      throw new Error(
        `Duplicate block found for ${name} — R4.x directives must be a single contiguous block-quote or fenced block`,
      );
    }
    blocks.set(name, blockContent);
    i = j - 1;
  }

  return blocks;
}

// Direction B sentence extractor — pinned. If R4 prose evolves to use new
// sentence shapes (e.g. semicolon-separated clauses), update
// `extractDirectiveSentences` AND its companion test below in the same PR.
//
// 5-step algorithm:
//   1. Strip the top-of-file docstring (everything before the `---` separator).
//   2. Split remaining text on `\n\n+` to get paragraph candidates.
//   3. Keep paragraphs in the directive zone:
//      - `**Read first:**` opens the diff zone (closes at `## Primary` heading)
//      - paragraph beginning with `10.` opens the typecheck zone (closes at
//        `## Recording Results`)
//      - item-9 (hygiene) is NOT pinned to R4 (R4.8 — kept verbatim from
//        fast-reviews); paragraphs starting with `9.` close zones and are not
//        kept.
//      - `**Note:**` truncation paragraph is a render-side note (not
//        authoritative R4 prose) and is skipped while in zone.
//   4. Within each kept paragraph, sentence-split on /(?<=[.!?])(?:\s+|$)/.
//   5. Exclude boilerplate sentences: `^\d+\.\s*$`, `^\*\*[^*]+\*\*$`, empty.
export function extractDirectiveSentences(fixture: string): string[] {
  const sepIdx = fixture.indexOf('\n---\n');
  const body = sepIdx >= 0 ? fixture.slice(sepIdx + 5) : fixture;

  // Paragraph boundaries are blank lines OR a line starting a new numbered
  // list item (`\d+. `) OR a heading (`## `). Items 7-10 in the fixture sit on
  // consecutive lines without blank separators, so a plain `\n\n` split would
  // merge them into one block — boundary detection on `\n\n` BEFORE
  // whitespace-collapse must also recognise list-item starts as paragraph
  // boundaries to isolate item 10.
  const lines = body.split('\n');
  const paragraphs: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const t = current.join('\n').trim();
    if (t !== '') paragraphs.push(t);
    current = [];
  };
  for (const line of lines) {
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (
      current.length > 0 &&
      (/^\d+\.\s/.test(line) || /^##\s/.test(line) || /^#\s/.test(line))
    ) {
      flush();
    }
    current.push(line);
  }
  flush();

  const kept: string[] = [];
  let inDiffZone = false;
  let inTypecheckZone = false;
  for (const p of paragraphs) {
    if (/^##\s/.test(p)) {
      inDiffZone = false;
      inTypecheckZone = false;
      continue;
    }
    if (p.startsWith('**Read first:**')) {
      inDiffZone = true;
      kept.push(p);
      continue;
    }
    if (/^10\.\s/.test(p)) {
      inTypecheckZone = true;
      kept.push(p);
      continue;
    }
    if (/^\d+\.\s/.test(p)) {
      // Other numbered list items end the directive zones.
      inDiffZone = false;
      inTypecheckZone = false;
      continue;
    }
    if (inDiffZone || inTypecheckZone) {
      if (p.startsWith('**Note:**')) continue;
      kept.push(p);
    }
  }

  const terminator = /(?<=[.!?])(?:\s+|$)/;
  const sentences: string[] = [];
  for (const p of kept) {
    for (const s of p.split(terminator)) sentences.push(s);
  }

  return sentences.filter(s => {
    const t = s.trim();
    if (t === '') return false;
    if (/^\d+\.\s*$/.test(t)) return false;
    if (/^\*\*[^*]+\*\*$/.test(t)) return false;
    return true;
  });
}

describe('extractDirectiveSentences self-test', () => {
  it('extracts diff and typecheck directive sentences from a known fixture, excluding item-9', () => {
    const fixture = readFileSync(
      join(FIXTURE_DIR, 'success-with-diagnostics.txt'),
      'utf-8'
    );
    const sentences = extractDirectiveSentences(fixture);

    // The R4.1 prose opens with "Read the diff first" — must be present.
    expect(sentences.some(s => s.includes('Read the diff first'))).toBe(true);
    // The R4.4 prose opens with "Triage the typecheck diagnostics" — must be present.
    expect(sentences.some(s => s.includes('Triage the typecheck diagnostics'))).toBe(true);
    // Item-9 hygiene is NOT pinned to R4 — its prose must NOT be extracted.
    expect(sentences.every(s => !s.includes('Pre-computed hygiene signals are attached'))).toBe(true);
    // Items 1-8 (Spec-Compliance and Correctness/Hygiene) are out of zone.
    expect(sentences.every(s => !s.includes('Requirements compliance'))).toBe(true);
    expect(sentences.every(s => !s.includes('Restriction adherence'))).toBe(true);
    // Recording-results enumeration is out of zone.
    expect(sentences.every(s => !s.includes('verdict: "pass"'))).toBe(true);
  });
});

describe('Two-way drift test (R4.10)', () => {
  it('extracted block keyset equals EXPECTED_R4_BLOCK_NAMES', () => {
    const requirementsMd = readFileSync(REQUIREMENTS_MD, 'utf-8');
    const blocks = extractR4BlocksFromRequirements(requirementsMd);
    const actualNames = Array.from(blocks.keys()).sort();
    const expectedNames = [...EXPECTED_R4_BLOCK_NAMES].sort();
    expect(actualNames).toEqual(expectedNames);
  });

  it('Direction A: each R4.x block appears as a contiguous substring in at least one fixture', () => {
    const requirementsMd = readFileSync(REQUIREMENTS_MD, 'utf-8');
    const blocks = extractR4BlocksFromRequirements(requirementsMd);

    const fixtureBodies = Object.keys(FIXTURE_INPUTS).map(f =>
      normalize(loadFixtureBody(f))
    );

    for (const [name, block] of blocks) {
      const normalized = normalize(block);
      const matched = fixtureBodies.some(body => body.includes(normalized));
      expect(matched, `R4 block ${name} not found verbatim in any fixture`).toBe(true);
    }
  });

  it('Direction B: every fixture directive sentence appears in some R4.x block', () => {
    const requirementsMd = readFileSync(REQUIREMENTS_MD, 'utf-8');
    const blocks = extractR4BlocksFromRequirements(requirementsMd);
    const normalizedBlocks = Array.from(blocks.values()).map(normalize);

    for (const filename of Object.keys(FIXTURE_INPUTS)) {
      const raw = readFileSync(join(FIXTURE_DIR, filename), 'utf-8');
      const sentences = extractDirectiveSentences(raw);
      for (const s of sentences) {
        const ns = normalize(s);
        if (ns === '') continue;
        const matched = normalizedBlocks.some(b => b.includes(ns));
        expect(
          matched,
          `Fixture ${filename} sentence not found in any R4 block: ${ns.slice(0, 120)}`
        ).toBe(true);
      }
    }
  });
});
