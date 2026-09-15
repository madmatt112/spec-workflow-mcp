import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_CAPS,
  wordCount,
  checkDocWords,
  checkTaskWords,
  parseWordCaps,
} from '../lint-words.js';
import { taskBlocks } from '../lint-markdown.js';

describe('DEFAULT_CAPS', () => {
  it('holds the template values', () => {
    expect(DEFAULT_CAPS).toEqual({ requirements: 3500, design: 4000, task: 150 });
  });
});

describe('wordCount', () => {
  it('is 0 for blank text', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   \n\t ')).toBe(0);
  });

  it('equals `wc -w` on an ASCII fixture', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lint-words-'));
    try {
      const text = 'The quick brown fox\njumps over  the lazy dog.\n\nSecond paragraph, three words here.\n';
      const file = join(dir, 'fixture.txt');
      writeFileSync(file, text);
      const wc = Number(execFileSync('wc', ['-w', file], { encoding: 'utf-8' }).trim().split(/\s+/)[0]);
      expect(wordCount(text)).toBe(wc);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('checkDocWords', () => {
  it('flags a document over the cap on line 1', () => {
    expect(checkDocWords('one two three four five', 4)).toEqual([
      { file: '', line: 1, rule: 'doc-words', severity: 'warning', message: '5 words, cap 4' },
    ]);
  });

  it('is silent at or under the cap', () => {
    expect(checkDocWords('one two three four', 4)).toEqual([]);
  });

  it('counts the body from the H1 to before `## Revision History`', () => {
    const content = [
      '# Requirements Document',
      '',
      'one two three',
      '',
      '## Revision History',
      '- **v1** (2026-09-14) — Initial draft with many extra words that must not count here',
    ].join('\n');
    // Body is `# Requirements Document` (3) + `one two three` (3) = 6 words, at the cap.
    expect(checkDocWords(content, 6)).toEqual([]);
    // The Revision History line would push it over if it were counted.
    expect(wordCount(content)).toBeGreaterThan(6);
  });

  it('flags when the body alone is over the cap and names its count', () => {
    const content = ['# Title', 'one two three four', '## Revision History', 'ignored ignored ignored'].join('\n');
    // Body is `# Title` (2) + `one two three four` (4) = 6 words.
    expect(checkDocWords(content, 5)).toEqual([
      { file: '', line: 1, rule: 'doc-words', severity: 'warning', message: '6 words, cap 5' },
    ]);
  });

  it('counts to the end when there is no `## Revision History`', () => {
    const content = ['# Title', 'one two three four five'].join('\n');
    // `# Title` (2) + five words = 7 words, no heading to stop before.
    expect(checkDocWords(content, 6)).toEqual([
      { file: '', line: 1, rule: 'doc-words', severity: 'warning', message: '7 words, cap 6' },
    ]);
  });
});

describe('checkTaskWords', () => {
  it('excludes the `_Prompt:` line and its continuations from the count', () => {
    const lines = [
      '- [ ] 1. Do the first thing',
      '  - Purpose: alpha beta gamma delta epsilon',
      '  _Prompt: Task: aaa bbb ccc ddd eee',
      '  fff ggg hhh iii jjj kkk lll mmm nnn ooo',
      '  ppp qqq rrr sss ttt uuu Restrictions none Success ok_',
      '',
      '- [ ] 2. Second task with few words',
    ];
    const blocks = taskBlocks(lines);
    const findings = checkTaskWords(lines, blocks, 1);

    const b1 = findings.find((f) => f.line === 1)!;
    const nonPrompt = [lines[0], lines[1], lines[5]].join('\n');
    const withPrompt = lines.slice(0, 6).join('\n');
    expect(b1).toEqual({
      file: '', line: 1, rule: 'task-words', severity: 'warning',
      message: `task 1: ${wordCount(nonPrompt)} words, cap 1`,
    });
    // The excluded prompt lines carry words, so the count is strictly smaller.
    expect(wordCount(nonPrompt)).toBeLessThan(wordCount(withPrompt));
  });

  it('bounds a block at the next `## ` line', () => {
    const lines = [
      '- [ ] 1. Task one alpha beta',
      '  - Purpose: one two three',
      '## Decisions',
      'many extra words that must not count at all here',
      'more and more words beyond the block boundary line',
    ];
    const blocks = taskBlocks(lines);
    const findings = checkTaskWords(lines, blocks, 1);

    expect(findings).toHaveLength(1);
    const blockText = [lines[0], lines[1]].join('\n');
    expect(findings[0]).toEqual({
      file: '', line: 1, rule: 'task-words', severity: 'warning',
      message: `task 1: ${wordCount(blockText)} words, cap 1`,
    });
    // The words after the `## ` heading are outside the block.
    expect(wordCount(blockText)).toBeLessThan(wordCount(lines.join('\n')));
  });

  it('names an unnumbered checkbox and stays silent under the cap', () => {
    const lines = ['- [ ] Do a thing with no id'];
    const blocks = taskBlocks(lines);
    expect(checkTaskWords(lines, blocks, 1)[0]).toEqual({
      file: '', line: 1, rule: 'task-words', severity: 'warning',
      message: `task unnumbered: ${wordCount(lines[0])} words, cap 1`,
    });
    expect(checkTaskWords(lines, blocks, 1000)).toEqual([]);
  });
});

describe('parseWordCaps', () => {
  it('reads a valid override', () => {
    const md = ['## Word caps', '', '- requirements: 3000', '- design: 5000', '- task: 200', '', '## Next'].join('\n');
    expect(parseWordCaps(md)).toEqual({
      caps: { requirements: 3000, design: 5000, task: 200 },
      invalid: [],
    });
  });

  it('reports a non-integer value as invalid, leaving the default', () => {
    const md = ['## Word caps', '- design: lots'].join('\n');
    expect(parseWordCaps(md)).toEqual({ caps: {}, invalid: [{ key: 'design', value: 'lots' }] });
  });

  it('yields nothing when the heading is absent', () => {
    expect(parseWordCaps('# Title\n\nno caps section here')).toEqual({ caps: {}, invalid: [] });
  });

  it('ignores an unknown key', () => {
    const md = ['## Word caps', '- frobnicate: 10', '- requirements: 42'].join('\n');
    expect(parseWordCaps(md)).toEqual({ caps: { requirements: 42 }, invalid: [] });
  });
});
