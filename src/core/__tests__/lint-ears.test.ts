import { describe, it, expect } from 'vitest';
import { checkEars } from '../lint-ears.js';
import { criteria } from '../lint-markdown.js';
import type { Criterion } from '../lint-markdown.js';

function crit(text: string, over: Partial<Criterion> = {}): Criterion {
  return { requirement: 1, index: 1, line: 10, text, ...over };
}

describe('checkEars', () => {
  it('passes a plain SHALL criterion', () => {
    expect(checkEars([crit('The tool SHALL return a response.')])).toEqual([]);
  });

  it('passes a WHEN criterion that also names THEN', () => {
    expect(checkEars([crit('WHEN the file resolves THEN the tool SHALL fire.')])).toEqual([]);
  });

  it('flags a criterion with no SHALL on its line', () => {
    const findings = checkEars([crit('The tool returns a response.', { line: 22 })]);
    expect(findings).toEqual([
      { file: '', line: 22, rule: 'ears-shape', severity: 'warning', message: 'Requirement 1 criterion 1 has no `SHALL`' },
    ]);
  });

  it('flags a WHEN criterion that names SHALL but not THEN', () => {
    const findings = checkEars([crit('WHEN the file resolves the tool SHALL fire.', { requirement: 4, index: 2, line: 40 })]);
    expect(findings).toEqual([
      { file: '', line: 40, rule: 'ears-shape', severity: 'warning', message: 'Requirement 4 criterion 2 has no `THEN`' },
    ]);
  });

  it('reports SHALL first when a conditional lacks both words', () => {
    const findings = checkEars([crit('IF the file is missing the tool logs it.')]);
    expect(findings.map((f) => f.message)).toEqual(['Requirement 1 criterion 1 has no `SHALL`']);
  });

  it('labels a criterion with no requirement number', () => {
    const findings = checkEars([crit('The tool responds.', { requirement: null, index: 3 })]);
    expect(findings[0].message).toBe('Criterion 3 has no `SHALL`');
  });

  it('runs over the criteria the scanner emits', () => {
    const doc = [
      '### Requirement 1 — The tool',
      '',
      '#### Acceptance Criteria',
      '',
      '1. The tool SHALL respond.',
      '2. The tool responds fast.',
      '3. WHEN asked THEN the tool SHALL answer.',
    ];
    const findings = checkEars(criteria(doc));
    expect(findings).toEqual([
      { file: '', line: 6, rule: 'ears-shape', severity: 'warning', message: 'Requirement 1 criterion 2 has no `SHALL`' },
    ]);
  });
});
