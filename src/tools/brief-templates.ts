/**
 * Named server-side brief templates, one per brief kind the harness spawns
 * (design Component 3, C6, D2). Each template declares its render `mode`, the
 * `required` caller keys (in placeholder order, so a missing-value message lists
 * them left to right), the `optional` keys that default to '' when the caller
 * omits them (design Component 5), and a `render` that fills its `{{key}}`
 * placeholders from a value map.
 *
 * Placeholders are `{{key}}`, filled from the map; `{{agentRules}}` is filled
 * with the spec-store `agent-rules.md` path when that file exists, and its line
 * is dropped when the map carries no `agentRules` value (2.4,
 * `harness/skills/sdd-document-phase/references/briefs.md:4-11`). The
 * implementer and test-author templates' `{{taskBlock}}` is filled by the tasks
 * parser, not the caller (2.2). Porting the skills' `references/briefs.md`
 * verbatim and guarding the two in sync is a deferred follow-up (design Scope
 * notes, D2).
 */

/** One server-side brief template (design C6, illustrative type). */
export interface BriefTemplate {
  /** How the brief is written out. All of today's kinds write a fresh file. */
  mode: 'write' | 'append';
  /** Caller keys that must have a value, in placeholder order. */
  required: string[];
  /** Keys that default to '' when the caller omits them. */
  optional?: string[];
  /** Fill the template's `{{key}}` placeholders from `values`. */
  render(values: Record<string, string>): string;
}

/** Raw body of each kind; `{{key}}` placeholders, one per line. */
const BODIES: Record<string, string> = {
  drafter: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Job',
    '{{job}}',
    '',
  ].join('\n'),
  reviser: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Job',
    '{{job}}',
    '',
    '## Findings',
    '{{findings}}',
    '',
  ].join('\n'),
  adjudicator: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Open items',
    '{{items}}',
    '',
  ].join('\n'),
  verifier: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Job',
    '{{job}}',
    '',
  ].join('\n'),
  implementer: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Task text (from tasks.md)',
    '',
    '{{taskBlock}}',
    '',
    '{{redTests}}',
  ].join('\n'),
  'test-author': [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Job',
    '{{job}}',
    '',
    '## Task text (from tasks.md)',
    '',
    '{{taskBlock}}',
    '',
  ].join('\n'),
};

/**
 * Fill a body's `{{key}}` placeholders from `values`. The read-and-obey line is
 * dropped when the map carries no `agentRules` value (the spec-store
 * `agent-rules.md` is absent); every other placeholder is replaced with its
 * value (2.4).
 */
function renderBody(body: string, values: Record<string, string>): string {
  const text =
    values.agentRules === undefined
      ? body.split('\n').filter((l) => !l.includes('{{agentRules}}')).join('\n')
      : body;
  return text.replace(/\{\{(\w+)\}\}/g, (_full, key: string) =>
    key in values ? values[key] : '',
  );
}

export const BRIEF_TEMPLATES: Record<string, BriefTemplate> = {
  drafter: { mode: 'write', required: ['title', 'job'], render: (v) => renderBody(BODIES.drafter, v) },
  reviser: { mode: 'write', required: ['title', 'job', 'findings'], render: (v) => renderBody(BODIES.reviser, v) },
  adjudicator: { mode: 'write', required: ['title', 'items'], render: (v) => renderBody(BODIES.adjudicator, v) },
  verifier: { mode: 'write', required: ['title', 'job'], render: (v) => renderBody(BODIES.verifier, v) },
  implementer: {
    mode: 'write',
    required: ['title', 'redTests'],
    optional: ['redTests'],
    render: (v) => renderBody(BODIES.implementer, v),
  },
  'test-author': { mode: 'write', required: ['title', 'job'], render: (v) => renderBody(BODIES['test-author'], v) },
};

/** Whether a template fills the server-provided `{{taskBlock}}` slot. */
export function templateUsesTaskBlock(name: string): boolean {
  return (BODIES[name] ?? '').includes('{{taskBlock}}');
}
