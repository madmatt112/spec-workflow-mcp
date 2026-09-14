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
