import { describe, it, expect } from 'vitest';
import {
  SENSITIVE_PATHS_HEADING,
  GENERATED_PATHS_HEADING,
  NO_LIST_REASON,
  RISK_LINE_THRESHOLD,
  TEST_WORD_RE,
  TEST_FILE_BASENAME_RE,
  TEST_DIR_SEGMENTS,
  TASK_CHECKBOX_RE,
  MAX_TOUCHED_LISTED,
  MAX_LINE_CHARS,
  TYPECHECK_STATE_RANK,
  parseSensitivePaths,
  parseGeneratedPaths,
  isSensitivePath,
  isGeneratedPath,
  taskBlock,
  taskNamesTests,
  isTestPath,
  worstTypecheckState,
  truncateLine,
  scoreRisk,
  decideGate,
  type RiskInput,
  type GateInput,
} from '../gate-rules.js';

describe('constants', () => {
  it('pins the tunable thresholds and heading', () => {
    expect(SENSITIVE_PATHS_HEADING).toBe('## Sensitive paths');
    expect(GENERATED_PATHS_HEADING).toBe('## Generated paths');
    expect(NO_LIST_REASON).toBe('sensitive-paths: no list; every path is sensitive');
    expect(RISK_LINE_THRESHOLD).toBe(200);
    expect(MAX_TOUCHED_LISTED).toBe(100);
    expect(MAX_LINE_CHARS).toBe(200);
    expect(TEST_DIR_SEGMENTS).toEqual(['__tests__', 'tests', 'test']);
  });

  it('ranks typecheck states worst-first', () => {
    expect(TYPECHECK_STATE_RANK[0]).toBe('timeout');
    expect(TYPECHECK_STATE_RANK[TYPECHECK_STATE_RANK.length - 1]).toBe('success-clean-full');
  });

  it('matches checkboxes and test tokens with the exported patterns', () => {
    expect(TASK_CHECKBOX_RE.test('- [ ] 1. Task')).toBe(true);
    expect(TASK_CHECKBOX_RE.test('  * [-] 2. Task')).toBe(true);
    expect(TASK_CHECKBOX_RE.test('plain line')).toBe(false);
    expect(TEST_WORD_RE.test('add tests')).toBe(true);
    expect(TEST_WORD_RE.test('contest')).toBe(false);
    expect(TEST_FILE_BASENAME_RE.test('foo.test.ts')).toBe(true);
    expect(TEST_FILE_BASENAME_RE.test('foo.ts')).toBe(false);
  });
});

describe('parseSensitivePaths', () => {
  it('returns null when the heading is absent', () => {
    expect(parseSensitivePaths('# Rules\n\nno heading here\n')).toBeNull();
  });

  it('returns null when the heading has no bullet', () => {
    expect(parseSensitivePaths('## Sensitive paths\n\njust prose\n')).toBeNull();
  });

  it('strips backticks and a leading ./', () => {
    expect(parseSensitivePaths('## Sensitive paths\n- `./src/a.ts`\n')).toEqual(['src/a.ts']);
  });

  it('ignores non-bullet lines between bullets', () => {
    const md = '## Sensitive paths\nprose\n- src/a.ts\nmore prose\n- src/b.ts\n';
    expect(parseSensitivePaths(md)).toEqual(['src/a.ts', 'src/b.ts']);
  });

  it('keeps a dir/ prefix entry as written', () => {
    expect(parseSensitivePaths('## Sensitive paths\n- `harness/hooks/`\n')).toEqual(['harness/hooks/']);
  });

  it('keeps an exact entry and stops at the next ## heading', () => {
    const md = '## Sensitive paths\n- src/core/path-utils.ts\n## Other\n- src/ignored.ts\n';
    expect(parseSensitivePaths(md)).toEqual(['src/core/path-utils.ts']);
  });
});

describe('isSensitivePath', () => {
  it('matches a dir/ entry by prefix and any other by equality', () => {
    expect(isSensitivePath('harness/hooks/hooks.json', ['harness/hooks/'])).toBe(true);
    expect(isSensitivePath('src/core/path-utils.ts', ['src/core/path-utils.ts'])).toBe(true);
    expect(isSensitivePath('src/other.ts', ['src/core/path-utils.ts'])).toBe(false);
    expect(isSensitivePath('harness/hookside.ts', ['harness/hooks/'])).toBe(false);
  });
});

describe('parseGeneratedPaths', () => {
  it('reads the ## Generated paths bullets like ## Sensitive paths', () => {
    const md = '## Sensitive paths\n- src/a.ts\n\n## Generated paths\n\n- `plugins/`\n';
    expect(parseGeneratedPaths(md)).toEqual(['plugins/']);
  });

  it('returns null when the heading is absent', () => {
    expect(parseGeneratedPaths('## Sensitive paths\n- src/a.ts\n')).toBeNull();
  });
});

describe('isGeneratedPath', () => {
  it('matches a dir/ entry by prefix', () => {
    expect(isGeneratedPath('plugins/spec-workflow/agent.md', ['plugins/'])).toBe(true);
    expect(isGeneratedPath('src/tools/review-gate.ts', ['plugins/'])).toBe(false);
  });
});

describe('taskBlock', () => {
  const md = [
    '- [ ] 1. First task',       // 0
    '  - File: a.ts',            // 1
    '## A heading between tasks', // 2
    '  more detail',             // 3
    '- [ ] 2. Second task',      // 4
    '  - File: b.ts',            // 5
  ].join('\n');

  it('does not let a heading bound the block, but a checkbox line does', () => {
    const block = taskBlock(md, 0);
    expect(block).toContain('A heading between tasks');
    expect(block).toContain('more detail');
    expect(block).not.toContain('Second task');
  });
});

describe('isTestPath', () => {
  it('is true for a .test./.spec. basename or a test dir segment', () => {
    expect(isTestPath('src/foo.test.ts')).toBe(true);
    expect(isTestPath('src/foo.spec.tsx')).toBe(true);
    expect(isTestPath('src/core/__tests__/foo.ts')).toBe(true);
    expect(isTestPath('tests/foo.ts')).toBe(true);
    expect(isTestPath('test/foo.ts')).toBe(true);
    expect(isTestPath('src/foo.ts')).toBe(false);
  });
});

describe('worstTypecheckState', () => {
  it('returns the element with the lowest rank index', () => {
    expect(
      worstTypecheckState([
        { kind: 'success-clean-full' },
        { kind: 'timeout' },
        { kind: 'success-with-diagnostics' },
      ]).kind
    ).toBe('timeout');
    expect(
      worstTypecheckState([
        { kind: 'unavailable-feature-disabled' },
        { kind: 'success-clean-full' },
      ]).kind
    ).toBe('unavailable-feature-disabled');
    const withReason = worstTypecheckState([
      { kind: 'unavailable-other', reason: 'no-tsconfig' },
      { kind: 'success-clean-full' },
    ]);
    expect(withReason).toEqual({ kind: 'unavailable-other', reason: 'no-tsconfig' });
  });
});

describe('truncateLine', () => {
  it('keeps the first line, trimmed to MAX_LINE_CHARS', () => {
    expect(truncateLine('first\nsecond')).toBe('first');
    expect(truncateLine('x'.repeat(250))).toHaveLength(MAX_LINE_CHARS);
    expect(truncateLine('short')).toBe('short');
  });
});

const lowRisk: RiskInput = {
  mode: 'task',
  sensitive: [],
  touched: ['src/foo.ts'],
  stats: { linesAdded: 1, linesRemoved: 1 },
  block: '- [ ] 1. Do the thing',
  rangeGiven: true,
  typecheck: { kind: 'success-clean-full' },
  hygieneRejection: null,
};

describe('scoreRisk', () => {
  it('is low when no rule fires', () => {
    expect(scoreRisk(lowRisk)).toEqual({ risk: 'low', reasons: [] });
  });

  it('a: fires when the list is absent (NO_LIST_REASON)', () => {
    const r = scoreRisk({ ...lowRisk, sensitive: null });
    expect(r.risk).toBe('high');
    expect(r.reasons).toContain(NO_LIST_REASON);
  });

  it('a: fires when a touched path matches an entry', () => {
    const r = scoreRisk({ ...lowRisk, sensitive: ['src/foo.ts'], touched: ['src/foo.ts'] });
    expect(r.reasons).toContain('sensitive-path: src/foo.ts matches src/foo.ts');
  });

  it('a: reads the whole touched list uncapped (a match at index 150 of 200)', () => {
    const touched = Array.from({ length: 200 }, (_, i) => `src/file-${i}.ts`);
    touched[150] = 'src/core/path-utils.ts';
    const r = scoreRisk({ ...lowRisk, sensitive: ['src/core/path-utils.ts'], touched });
    expect(r.risk).toBe('high');
    expect(r.reasons).toContain('sensitive-path: src/core/path-utils.ts matches src/core/path-utils.ts');
  });

  it('b: fires when changed lines exceed the threshold', () => {
    const r = scoreRisk({ ...lowRisk, stats: { linesAdded: 150, linesRemoved: 60 } });
    expect(r.reasons).toContain('line-count: 210 changed lines exceed 200');
  });

  it('b: per-path counts drop generated paths from the line rule (P2)', () => {
    const r = scoreRisk({
      ...lowRisk,
      perFile: { 'src/a.ts': 100, 'plugins/gen.ts': 300 },
      generated: ['plugins/'],
      stats: { linesAdded: 400, linesRemoved: 0 },
    });
    expect(r.reasons.some((x) => x.startsWith('line-count'))).toBe(false);
  });

  it('b: per-path counts still fire when the non-generated total exceeds it (P2)', () => {
    const r = scoreRisk({
      ...lowRisk,
      perFile: { 'src/a.ts': 201, 'plugins/gen.ts': 300 },
      generated: ['plugins/'],
      stats: null,
    });
    expect(r.reasons).toContain('line-count: 201 changed lines exceed 200');
  });


  it('c: fires when the task names tests and no touched path is a test file', () => {
    const r = scoreRisk({ ...lowRisk, block: '- [ ] 1. Add tests for foo', touched: ['src/foo.ts'] });
    expect(r.reasons).toContain('tests-not-touched: task names tests; no touched path is a test file');
  });

  it('d: fires when the touched set is empty', () => {
    const r = scoreRisk({ ...lowRisk, touched: [] });
    expect(r.reasons).toContain('no-diff: no path changed in the range');
  });

  it('e: fires on timeout and on unavailable-other with its reason', () => {
    expect(scoreRisk({ ...lowRisk, typecheck: { kind: 'timeout' } }).reasons).toContain(
      'typecheck-unavailable: timeout'
    );
    expect(
      scoreRisk({ ...lowRisk, typecheck: { kind: 'unavailable-other', reason: 'no-tsconfig' } }).reasons
    ).toContain('typecheck-unavailable: no-tsconfig');
  });

  it('f: fires when a task has no range selector', () => {
    const r = scoreRisk({ ...lowRisk, rangeGiven: false });
    expect(r.reasons).toContain('no-range: ranged against HEAD; pass baseRef');
  });

  it('g: fires when hygiene rejected', () => {
    const r = scoreRisk({ ...lowRisk, hygieneRejection: 'boom' });
    expect(r.reasons).toContain('hygiene-rejected: boom');
  });

  it('item mode suppresses rules c and f', () => {
    const r = scoreRisk({
      ...lowRisk,
      mode: 'item',
      block: '- [ ] Add tests',
      touched: ['src/foo.ts'],
      rangeGiven: false,
    });
    expect(r).toEqual({ risk: 'low', reasons: [] });
  });
});

const passGate: GateInput = {
  checks: [{ command: 'npm test', status: 'pass', exitCode: 0, output: 'ok' }],
  diagnostics: [],
  hygiene: [],
  touched: ['src/foo.ts'],
  files: null,
  missing: [],
  filesOnly: false,
};

describe('decideGate', () => {
  it('passes when no rule fires', () => {
    expect(decideGate(passGate)).toEqual({ gate: 'pass', reasons: [] });
  });

  it('a: fails on a non-zero check and on a timed-out check', () => {
    expect(
      decideGate({ ...passGate, checks: [{ command: 'tsc', status: 'fail', exitCode: 2, output: 'error' }] })
        .reasons
    ).toContain('check-failed: tsc exit 2 — error');
    expect(
      decideGate({ ...passGate, checks: [{ command: 'tsc', status: 'timeout', exitCode: null, output: '' }] })
        .reasons
    ).toContain('check-timeout: tsc after 300 s');
  });

  it('b: fails on an in-scope diagnostic and ignores out-of-scope ones', () => {
    const r = decideGate({
      ...passGate,
      diagnostics: [
        { file: 'a.ts', line: 5, column: 1, code: 'TS1', message: 'm', inScope: true },
        { file: 'b.ts', line: 9, column: 2, code: 'TS2', message: 'm', inScope: true },
      ],
    });
    expect(r.reasons).toContain('typecheck-diagnostic: a.ts:5 TS1 (+1 more)');
    expect(
      decideGate({
        ...passGate,
        diagnostics: [{ file: 'a.ts', line: 5, column: 1, code: 'TS1', message: 'm', inScope: false }],
      })
    ).toEqual({ gate: 'pass', reasons: [] });
  });

  it('c: fails on a debugger signal, not on console/todo/fixme', () => {
    expect(
      decideGate({ ...passGate, hygiene: [{ file: 'a.ts', line: 3, pattern: 'debugger', text: 'debugger' }] })
        .reasons
    ).toContain('debugger: a.ts:3');
    expect(
      decideGate({ ...passGate, hygiene: [{ file: 'a.ts', line: 3, pattern: 'console', text: 'console.log()' }] })
    ).toEqual({ gate: 'pass', reasons: [] });
  });

  it('d: fails when a touched path is outside a given files list', () => {
    const r = decideGate({ ...passGate, files: ['src/foo.ts'], touched: ['src/foo.ts', 'src/bar.ts'] });
    expect(r.reasons).toContain('file-outside-list: src/bar.ts');
  });

  it('e: fails when a listed file is missing under root (files-only)', () => {
    const r = decideGate({ ...passGate, filesOnly: true, missing: ['src/gone.ts'] });
    expect(r.reasons).toContain('listed-file-missing: src/gone.ts');
  });
});
