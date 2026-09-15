/**
 * Lint finding types and response assembly (design Component 2, requirements
 * 1.6-1.8). One shape for every `src/core/lint-*.ts` rule module and the
 * `spec-lint` handler: sort, cap and summary live here so no rule module
 * repeats them. Pure module, no I/O; `core` never imports `tools`.
 */
import { truncateLine } from './gate-rules.js';

export type LintPhase = 'requirements' | 'design' | 'tasks';
export type LintSeverity = 'error' | 'warning' | 'info';
export type LintRule =
  | 'citation-path' | 'citation-range' | 'citation-unchecked' | 'citation-bare' | 'citation-identifier'
  | 'mdx' | 'ears-shape' | 'tasks-format' | 'task-requirement-id' | 'task-requirement-unchecked'
  | 'doc-words' | 'task-words' | 'caps-invalid'
  | 'coverage-component' | 'coverage-unchecked' | 'bridge-missing';

export interface LintFinding {
  file: string;
  line: number;        // 1-based
  column?: number;     // `mdx` only
  rule: LintRule;
  severity: LintSeverity;
  message: string;
}

export interface LintCaps { requirements: number; design: number; task: number }

export interface LintData {
  findings: LintFinding[];
  summary: { error: number; warning: number; info: number; total: number };
  checks: LintRule[];
  caps: LintCaps;
}

/** Rule ids that can fire in every phase (design D9). */
const EVERY_PHASE: LintRule[] = [
  'citation-path',
  'citation-range',
  'citation-unchecked',
  'citation-bare',
  'citation-identifier',
  'mdx',
  'caps-invalid',
];

/**
 * Every rule id that can fire per phase, not a rule-family list (design D9): the
 * round prompt reasons per rule id. The handler passes this to `finishLint`.
 */
export const CHECKS_BY_PHASE: Record<LintPhase, LintRule[]> = {
  requirements: [...EVERY_PHASE, 'ears-shape', 'doc-words'],
  design: [...EVERY_PHASE, 'doc-words'],
  tasks: [
    ...EVERY_PHASE,
    'tasks-format',
    'task-requirement-id',
    'task-requirement-unchecked',
    'task-words',
    'coverage-component',
    'coverage-unchecked',
    'bridge-missing',
  ],
};

/**
 * Assemble the response `data` from every rule module's findings (requirements
 * 1.6-1.8): set each `file` to `<phase>.md` (relative to the spec directory),
 * cut each `message` to 200 characters with `truncateLine`, stable-sort by
 * `line` then `rule` (string compare), count the `summary`, list `checks` from
 * `CHECKS_BY_PHASE` and carry the `caps` in force.
 */
export function finishLint(findings: LintFinding[], phase: LintPhase, caps: LintCaps): LintData {
  const file = `${phase}.md`;
  const shaped: LintFinding[] = findings.map((f) => ({
    ...f,
    file,
    message: truncateLine(f.message),
  }));
  // Array.prototype.sort is stable; a 0 comparison keeps insertion order on a tie.
  shaped.sort((a, b) => a.line - b.line || (a.rule < b.rule ? -1 : a.rule > b.rule ? 1 : 0));

  const summary = { error: 0, warning: 0, info: 0, total: shaped.length };
  for (const f of shaped) summary[f.severity] += 1;

  return { findings: shaped, summary, checks: CHECKS_BY_PHASE[phase], caps };
}

/** The requirement 1.8 response message. */
export function lintMessage(specName: string, phase: LintPhase, summary: LintData['summary']): string {
  return `spec-lint ${specName}/${phase}.md: ${summary.total} findings (${summary.error} error, ${summary.warning} warning, ${summary.info} info)`;
}
