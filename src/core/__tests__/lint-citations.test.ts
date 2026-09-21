import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fsp from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ESM module namespaces are not spyable, so count reads by wrapping `readFile`
// with a mock that delegates to the real implementation (temp-dir I/O is real).
const { readFileSpy } = vi.hoisted(() => ({ readFileSpy: vi.fn() }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: (...args: Parameters<typeof actual.readFile>) => {
      readFileSpy(...args);
      return (actual.readFile as (...a: unknown[]) => Promise<unknown>)(...args);
    },
  };
});

import {
  CITATION_RE,
  BARE_RANGE_RE,
  extractCitations,
  identifierTokens,
  checkCitations,
  type Citation,
} from '../lint-citations.js';
import { fencedLines, blocks } from '../lint-markdown.js';
import type { LintFinding } from '../lint-types.js';

const split = (s: string): string[] => s.split('\n');

/** Run the scanners the way `checkCitations` does. */
function extract(doc: string): Citation[] {
  const lines = split(doc);
  const fenced = fencedLines(lines);
  return extractCitations(lines, fenced, blocks(lines, fenced));
}

/** All matches of a global regex against a string. */
function matches(re: RegExp, s: string): RegExpMatchArray[] {
  return [...s.matchAll(re)];
}

// --- CITATION_RE / BARE_RANGE_RE (Component 4 examples) --------------------

describe('CITATION_RE', () => {
  it('matches a relative path and a range, capturing path, a and b', () => {
    const single = matches(CITATION_RE, '../x.ts:3');
    expect(single).toHaveLength(1);
    expect(single[0][1]).toBe('../x.ts');
    expect(single[0][2]).toBe('3');
    expect(single[0][3]).toBeUndefined();

    const range = matches(CITATION_RE, 'src/foo.ts:3-5');
    expect(range[0][1]).toBe('src/foo.ts');
    expect(range[0][2]).toBe('3');
    expect(range[0][3]).toBe('5');
  });

  it('does not match ports, versions, URLs or a wordy path:line', () => {
    for (const s of ['localhost:3000', 'v1.2:3', 'https://x.com:443', 'path:line']) {
      expect(matches(CITATION_RE, s)).toHaveLength(0);
    }
  });

  it('matches an absolute path so it can be flagged (requirement 1.9)', () => {
    const m = matches(CITATION_RE, 'see /tmp/abs.ts:1 here');
    expect(m).toHaveLength(1);
    expect(m[0][1]).toBe('/tmp/abs.ts');
  });
});

describe('BARE_RANGE_RE', () => {
  it('matches a bare backticked line and range', () => {
    expect(matches(BARE_RANGE_RE, '`:5`')[0][1]).toBe('5');
    const r = matches(BARE_RANGE_RE, '`:12-14`')[0];
    expect(r[1]).toBe('12');
    expect(r[2]).toBe('14');
  });
});

// --- extractCitations -------------------------------------------------------

describe('extractCitations', () => {
  it('scans inline code but not triple-backtick fences', () => {
    const doc = ['```', 'src/fenced.ts:1', '```', 'inline `src/inline.ts:2` here'].join('\n');
    const cits = extract(doc);
    expect(cits.map((c) => c.path)).toEqual(['src/inline.ts']);
    expect(cits[0].line).toBe(4);
    expect(cits[0].start).toBe(2);
  });

  it('borrows a bare range from the block’s nearest earlier path citation', () => {
    const cits = extract('`src/a.ts:1` and then `:7`');
    expect(cits).toHaveLength(2);
    const bare = cits.find((c) => c.bare)!;
    expect(bare.path).toBe('src/a.ts');
    expect(bare.start).toBe(7);
  });

  it('leaves a bare range with no earlier path in its block unresolved', () => {
    const bare = extract('a lonely `:5` here').find((c) => c.bare)!;
    expect(bare.path).toBe('');
    expect(bare.start).toBe(5);
  });

  it('does not borrow across a block boundary', () => {
    const bare = extract('`src/a.ts:1`\n\n`:9`').find((c) => c.bare)!;
    expect(bare.path).toBe('');
  });
});

// --- identifierTokens (the two 2.6 examples) --------------------------------

describe('identifierTokens', () => {
  it('takes the last dot-segment of a qualified name', () => {
    expect(identifierTokens('call `PathUtils.getWorkflowRoot` now')).toEqual(['getWorkflowRoot']);
  });

  it('rejects a quoted literal, a path, a citation and a file name', () => {
    expect(identifierTokens("the `'gate'` action")).toEqual([]);
    expect(identifierTokens('at `src/a.ts` and `real.ts:1` and `notes.md`')).toEqual([]);
  });

  it('strips a trailing call and de-duplicates', () => {
    expect(identifierTokens('`selectRoots()` then `selectRoots`')).toEqual(['selectRoots']);
  });
});

// --- checkCitations (temp dir, real fs) -------------------------------------

describe('checkCitations', () => {
  let root: string;
  let baseA: string;
  let baseB: string;
  let baseC: string;

  const rulesOn = (fs: LintFinding[], rule: string): LintFinding[] => fs.filter((f) => f.rule === rule);

  beforeEach(async () => {
    root = await fsp.mkdtemp(join(tmpdir(), 'lint-citations-'));
    baseA = join(root, 'a');
    baseB = join(root, 'b');
    baseC = join(root, 'c');
    for (const d of [baseA, baseB, baseC]) await fsp.mkdir(d, { recursive: true });
    readFileSpy.mockClear();
  });

  afterEach(async () => {
    await fsp.rm(root, { recursive: true, force: true });
  });

  it('resolves first hit across the three bases in order', async () => {
    // Absent in baseA, five lines in baseB, one line in baseC: a correct
    // first-hit resolver picks baseB and finds line 3 in range. A directory
    // prefix is required now that a bare filename is rejected (retro P2).
    await fsp.mkdir(join(baseB, 'd'), { recursive: true });
    await fsp.mkdir(join(baseC, 'd'), { recursive: true });
    await fsp.writeFile(join(baseB, 'd', 'dup.ts'), 'l1\nl2\nl3\nl4\nl5\n');
    await fsp.writeFile(join(baseC, 'd', 'dup.ts'), 'only\n');
    const findings = await checkCitations(split('see `d/dup.ts:3`'), [baseA, baseB, baseC]);
    expect(findings).toHaveLength(0);
  });

  it('rejects a filename cited with no directory prefix, even if it exists (retro P2)', async () => {
    // Present under baseA, yet still rejected: the bare-filename rule is strict
    // and never reads the tree, so a lucky match cannot mask a missing dir.
    await fsp.writeFile(join(baseA, 'accounting.query.ts'), 'a\nb\nc\n');
    const findings = await checkCitations(split('see `accounting.query.ts:2`'), [baseA]);
    const path = rulesOn(findings, 'citation-path');
    expect(path).toHaveLength(1);
    expect(path[0].severity).toBe('error');
    expect(path[0].message).toContain('no directory prefix');
    expect(readFileSpy).not.toHaveBeenCalled();
  });

  it('reports citation-path and never reads a `..` or absolute path', async () => {
    const findings = await checkCitations(split('bad `../escape.ts:1` and `/etc/abs.ts:1`'), [baseA]);
    expect(rulesOn(findings, 'citation-path')).toHaveLength(2);
    expect(readFileSpy).not.toHaveBeenCalled();
  });

  it('reports citation-path when a path resolves under no base', async () => {
    const findings = await checkCitations(split('gone `src/missing.ts:1`'), [baseA]);
    expect(rulesOn(findings, 'citation-path')).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
  });

  it('reports citation-range on 0, A > B and past EOF', async () => {
    await fsp.mkdir(join(baseA, 'd'), { recursive: true });
    await fsp.writeFile(join(baseA, 'd', 'small.ts'), 'one\ntwo\n'); // two lines
    const doc = ['`d/small.ts:3`', '`d/small.ts:0`', '`d/small.ts:2-1`', '`d/small.ts:1-2`'].join('\n');
    const findings = await checkCitations(split(doc), [baseA]);
    const range = rulesOn(findings, 'citation-range');
    expect(range.map((f) => f.line).sort((a, b) => a - b)).toEqual([1, 2, 3]);
    expect(range.every((f) => f.severity === 'error')).toBe(true);
  });

  it('reports citation-unchecked for a directory and for non-UTF-8 bytes', async () => {
    await fsp.mkdir(join(baseA, 'd'), { recursive: true });
    await fsp.mkdir(join(baseA, 'd', 'sub.ts'));
    await fsp.writeFile(join(baseA, 'd', 'bad.ts'), Buffer.from([0xff, 0xfe]));
    const findings = await checkCitations(split('`d/sub.ts:1`\n`d/bad.ts:1`'), [baseA]);
    const unchecked = rulesOn(findings, 'citation-unchecked');
    expect(unchecked).toHaveLength(2);
    expect(unchecked.every((f) => f.severity === 'info')).toBe(true);
  });

  it('reports citation-bare only when the block has no earlier path', async () => {
    await fsp.writeFile(join(baseA, 'a.ts'), 'x\ny\nz\n');
    // First block borrows the path (no citation-bare); second block has none.
    const doc = ['`a.ts:1` and `:2`', '', 'lonely `:3`'].join('\n');
    const findings = await checkCitations(split(doc), [baseA]);
    const bare = rulesOn(findings, 'citation-bare');
    expect(bare).toHaveLength(1);
    expect(bare[0].line).toBe(3);
    expect(bare[0].severity).toBe('info');
  });

  it('flags an identifier absent from its cited range, passes one present', async () => {
    await fsp.mkdir(join(baseA, 'd'), { recursive: true });
    await fsp.writeFile(join(baseA, 'd', 'real.ts'), 'function getWorkflowRoot() {}\nother stuff here\n');
    const doc = [
      '`PathUtils.getWorkflowRoot` lives at `d/real.ts:1`',
      '',
      '`missingId` is at `d/real.ts:2`',
    ].join('\n');
    const findings = await checkCitations(split(doc), [baseA]);
    const ident = rulesOn(findings, 'citation-identifier');
    expect(ident).toHaveLength(1);
    expect(ident[0].line).toBe(3);
    expect(ident[0].severity).toBe('warning');
    expect(ident[0].message).toContain('missingId');
  });

  it('skips the identifier check when the block’s citations all failed (D4)', async () => {
    const findings = await checkCitations(split('`someIdent` at `nope.ts:1`'), [baseA]);
    expect(rulesOn(findings, 'citation-identifier')).toHaveLength(0);
    expect(rulesOn(findings, 'citation-path')).toHaveLength(1);
  });

  it('skips citation scanning in Revision History and decision-log sections (retro P4)', async () => {
    const doc = [
      '## Revision History',
      '',
      '- **v2** (2026-09-21) — fixed `src/ghost.ts:1` per F4',
      '',
      '## Decisions taken in this document',
      '',
      '- D1: kept `src/phantom.ts:9` as the boundary',
      '',
      '## Notes',
      '',
      'a real one at `src/outside.ts:1`',
    ].join('\n');
    const findings = await checkCitations(split(doc), [baseA]);
    const path = rulesOn(findings, 'citation-path');
    // Only the citation in the ordinary `## Notes` section is scanned.
    expect(path).toHaveLength(1);
    expect(path[0].message).toContain('src/outside.ts');
  });

  it('reads each cited file at most once per call (requirement 2.7)', async () => {
    await fsp.mkdir(join(baseA, 'd'), { recursive: true });
    await fsp.writeFile(join(baseA, 'd', 'once.ts'), 'a\nb\nc\n');
    await checkCitations(split('`d/once.ts:1` and `d/once.ts:2` and `d/once.ts:3`'), [baseA]);
    const onceReads = readFileSpy.mock.calls.filter((c) => String(c[0]).endsWith('once.ts')).length;
    expect(onceReads).toBe(1);
  });
});
