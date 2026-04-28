import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { performance } from 'perf_hooks';
import { computeHygieneSignals } from '../hygiene-signals.js';

describe('computeHygieneSignals', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'hygiene-signals-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('(a) returns one console signal and one todo signal with correct line numbers', async () => {
    const file = join(tempDir, 'a.ts');
    await fs.writeFile(file, [
      'function foo() {',
      "  console.log('hi');",
      '  return 1;',
      '  // TODO: refactor',
      '}',
    ].join('\n'));

    const signals = await computeHygieneSignals([file]);

    expect(signals).toHaveLength(2);
    const consoleSig = signals.find(s => s.pattern === 'console')!;
    const todoSig = signals.find(s => s.pattern === 'todo')!;
    expect(consoleSig.line).toBe(2);
    expect(consoleSig.file).toBe(file);
    expect(todoSig.line).toBe(4);
    expect(todoSig.file).toBe(file);
  });

  it('(b) returns a debugger signal', async () => {
    const file = join(tempDir, 'b.ts');
    await fs.writeFile(file, ['let x = 1;', 'debugger;', 'x++;'].join('\n'));

    const signals = await computeHygieneSignals([file]);

    expect(signals).toHaveLength(1);
    expect(signals[0].pattern).toBe('debugger');
    expect(signals[0].line).toBe(2);
  });

  it('(c) lowercase todo produces no signal (case sensitivity)', async () => {
    const file = join(tempDir, 'c.ts');
    await fs.writeFile(file, [
      '// todo: not a real todo marker',
      '// fixme: also lowercase, ignored',
    ].join('\n'));

    const signals = await computeHygieneSignals([file]);

    expect(signals).toHaveLength(0);
  });

  it('(d) missing file path is skipped without throwing; remaining files still scanned', async () => {
    const real = join(tempDir, 'real.ts');
    await fs.writeFile(real, 'console.log("x");');
    const missing = join(tempDir, 'does-not-exist.ts');

    const signals = await computeHygieneSignals([missing, real]);

    expect(signals).toHaveLength(1);
    expect(signals[0].file).toBe(real);
    expect(signals[0].pattern).toBe('console');
  });

  it('(e) oversize file is skipped without reading; other files still scanned', async () => {
    const oversize = join(tempDir, 'big.ts');
    const small = join(tempDir, 'small.ts');
    await fs.writeFile(oversize, 'console.log("oversize");');
    await fs.writeFile(small, 'console.log("small");');

    // Test-local mock isolated to this case via vi.doMock + module reset.
    // The ESM limitation in vitest prevents vi.spyOn on the 'fs/promises'
    // namespace ("Cannot redefine property"), so we scope a fresh module
    // instance with a stat stub and a readFile spy, and unmock afterward
    // so other tests in this file use the real fs module.
    vi.resetModules();
    vi.doMock('fs/promises', async () => {
      const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
      return {
        ...actual,
        stat: vi.fn(async (p: any) => {
          if (String(p) === oversize) return { size: 1024 * 1024 + 1 } as any;
          return (actual.stat as any)(p);
        }),
        readFile: vi.fn((...args: any[]) => (actual.readFile as any)(...args)),
      };
    });

    try {
      const { computeHygieneSignals: scoped } = await import('../hygiene-signals.js');
      const fsp = await import('fs/promises');
      const readFileSpy = vi.mocked(fsp.readFile);
      readFileSpy.mockClear();

      const signals = await scoped([oversize, small]);

      const readFilePaths = readFileSpy.mock.calls.map(c => String(c[0]));
      expect(readFilePaths).not.toContain(oversize);
      expect(readFilePaths).toContain(small);
      expect(signals).toHaveLength(1);
      expect(signals[0].file).toBe(small);
    } finally {
      vi.doUnmock('fs/promises');
      vi.resetModules();
    }
  });

  it('(f) signals are ordered within each file ascending by line number', async () => {
    const file1 = join(tempDir, 'f1.ts');
    const file2 = join(tempDir, 'f2.ts');
    await fs.writeFile(file1, [
      '// TODO: one',
      'console.log(1);',
      '// FIXME: three',
      'debugger;',
    ].join('\n'));
    await fs.writeFile(file2, [
      'debugger;',
      '// TODO: two',
    ].join('\n'));

    const signals = await computeHygieneSignals([file1, file2]);

    const f1Lines = signals.filter(s => s.file === file1).map(s => s.line);
    const f2Lines = signals.filter(s => s.file === file2).map(s => s.line);
    expect(f1Lines).toEqual([...f1Lines].sort((a, b) => a - b));
    expect(f2Lines).toEqual([...f2Lines].sort((a, b) => a - b));
    expect(f1Lines).toEqual([1, 2, 3, 4]);
    expect(f2Lines).toEqual([1, 2]);
  });

  it('(g) a single line matching two patterns produces two signals on the same (file, line)', async () => {
    const file = join(tempDir, 'double.ts');
    await fs.writeFile(file, '// TODO: remove console.log(x)');

    const signals = await computeHygieneSignals([file]);

    expect(signals).toHaveLength(2);
    expect(signals.every(s => s.file === file && s.line === 1)).toBe(true);
    const patterns = signals.map(s => s.pattern).sort();
    expect(patterns).toEqual(['console', 'todo']);
  });

  it('(h) scans 50 files of 500 lines each in under 200ms', async () => {
    const files: string[] = [];
    let expectedTodos = 0;
    let expectedConsole = 0;
    for (let i = 0; i < 50; i++) {
      const file = join(tempDir, `perf-${i}.ts`);
      const lines: string[] = [];
      for (let j = 0; j < 500; j++) {
        if (j % 100 === 0) {
          lines.push(`// TODO: line ${j}`);
          expectedTodos++;
        } else if (j % 137 === 0) {
          lines.push(`console.log(${j});`);
          expectedConsole++;
        } else {
          lines.push(`const v${j} = ${j};`);
        }
      }
      await fs.writeFile(file, lines.join('\n'));
      files.push(file);
    }

    const start = performance.now();
    const signals = await computeHygieneSignals(files);
    const elapsed = performance.now() - start;

    // Strong count assertion catches a regex regression that would otherwise
    // pass a `> 0` check while silently dropping one of the patterns.
    expect(signals).toHaveLength(expectedTodos + expectedConsole);
    expect(signals.filter(s => s.pattern === 'todo')).toHaveLength(expectedTodos);
    expect(signals.filter(s => s.pattern === 'console')).toHaveLength(expectedConsole);
    expect(elapsed).toBeLessThan(200);
  });
});
