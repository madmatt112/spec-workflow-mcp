import { describe, it, expect } from 'vitest';
import { finishLint, lintMessage, CHECKS_BY_PHASE, type LintFinding, type LintCaps } from '../lint-types.js';

const CAPS: LintCaps = { requirements: 3500, design: 4000, task: 150 };

function finding(partial: Partial<LintFinding>): LintFinding {
  return {
    file: '',
    line: 1,
    rule: 'mdx',
    severity: 'info',
    message: 'm',
    ...partial,
  };
}

describe('lint-types', () => {
  describe('finishLint', () => {
    it('sorts by line then rule and keeps a stable order on a tie', () => {
      const input: LintFinding[] = [
        finding({ line: 5, rule: 'mdx', message: 'A' }),
        finding({ line: 2, rule: 'doc-words', message: 'B' }),
        finding({ line: 2, rule: 'caps-invalid', message: 'C' }),
        finding({ line: 2, rule: 'caps-invalid', message: 'D' }), // tie with C on line and rule
      ];
      const { findings } = finishLint(input, 'requirements', CAPS);
      expect(findings.map((f) => f.message)).toEqual(['C', 'D', 'B', 'A']);
    });

    it('cuts a 250-character message to 200 and sets file to <phase>.md', () => {
      const long = 'x'.repeat(250);
      const { findings } = finishLint([finding({ message: long, rule: 'mdx' })], 'design', CAPS);
      expect(findings[0].message).toHaveLength(200);
      expect(findings[0].file).toBe('design.md');
    });

    it('computes summary counts and total', () => {
      const input: LintFinding[] = [
        finding({ severity: 'error', line: 1 }),
        finding({ severity: 'error', line: 2 }),
        finding({ severity: 'warning', line: 3 }),
        finding({ severity: 'info', line: 4 }),
      ];
      const { summary } = finishLint(input, 'tasks', CAPS);
      expect(summary).toEqual({ error: 2, warning: 1, info: 1, total: 4 });
    });

    it('carries the phase checks and the caps in force', () => {
      const data = finishLint([], 'requirements', CAPS);
      expect(data.checks).toEqual(CHECKS_BY_PHASE.requirements);
      expect(data.caps).toBe(CAPS);
    });
  });

  describe('lintMessage', () => {
    it('renders the requirement 1.8 message', () => {
      const summary = { error: 2, warning: 1, info: 3, total: 6 };
      expect(lintMessage('my-spec', 'tasks', summary)).toBe(
        'spec-lint my-spec/tasks.md: 6 findings (2 error, 1 warning, 3 info)',
      );
    });
  });
});
