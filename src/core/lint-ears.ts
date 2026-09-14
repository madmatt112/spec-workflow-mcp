/**
 * EARS shape check (design Component 5, requirements 4.1-4.3). Each acceptance
 * criterion of a `requirements` document is testable in shape: it names `SHALL`,
 * and a criterion that opens with `WHEN` or `IF` also names `THEN`. A criterion
 * that does not is `ears-shape` at `warning` so the reviser reshapes it before a
 * reviewer judges what it says. This module never decides which phase runs it;
 * the handler calls it for `requirements` only (4.3). Pure module, no I/O;
 * `core` never imports `tools`.
 */
import type { Criterion } from './lint-markdown.js';
import type { LintFinding } from './lint-types.js';

/** The word every criterion must carry (requirement 4.2). */
const SHALL_RE = /\bSHALL\b/;
/** A conditional criterion opens with `WHEN` or `IF` (requirement 4.2). */
const CONDITIONAL_RE = /^(WHEN|IF)\b/;
/** A conditional criterion must also carry `THEN` (requirement 4.2). */
const THEN_RE = /\bTHEN\b/;

/**
 * Flag every non-EARS acceptance criterion (requirements 4.1-4.2). A criterion
 * passes when its text matches `SHALL` and, when it opens with `WHEN`/`IF`, also
 * matches `THEN`; otherwise one `ears-shape` warning on the item's line naming
 * the criterion and the missing word. `file` is left empty; `finishLint` sets it.
 */
export function checkEars(criteria: Criterion[]): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const c of criteria) {
    const label =
      c.requirement === null
        ? `Criterion ${c.index}`
        : `Requirement ${c.requirement} criterion ${c.index}`;
    let missing: string | null = null;
    if (!SHALL_RE.test(c.text)) {
      missing = 'SHALL';
    } else if (CONDITIONAL_RE.test(c.text) && !THEN_RE.test(c.text)) {
      missing = 'THEN';
    }
    if (missing !== null) {
      findings.push({
        file: '', line: c.line, rule: 'ears-shape', severity: 'warning',
        message: `${label} has no \`${missing}\``,
      });
    }
  }
  return findings;
}
