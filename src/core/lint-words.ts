/**
 * Word counts and cap override (design Component 6, requirements 6.1-6.3, 10.1).
 * The cap overrun the round prompt's `Over cap` line reports comes from a real
 * count here, not the drafter's report: `wordCount` equals `wc -w` on ASCII
 * whitespace (D5), `checkDocWords` counts the whole document, `checkTaskWords`
 * counts each task block minus its prompt lines, and `parseWordCaps` reads a
 * per-project override under `## Word caps` in `agent-rules.md`.
 *
 * Pure module, no I/O; `core` never imports `tools`. Findings leave `file`
 * empty for `finishLint` to set. `parseWordCaps` mirrors `parseSensitivePaths`
 * (`src/core/gate-rules.ts:73-93`) rather than calling it, so the gate module
 * stays untouched (D6, requirements R1-7).
 */
import type { TaskBlock } from './lint-markdown.js';
import type { LintCaps, LintFinding } from './lint-types.js';

/**
 * The default caps, the template values (`src/markdown/templates/
 * requirements-template.md:3`, `design-template.md:3`, `tasks-template.md:3`).
 */
export const DEFAULT_CAPS: LintCaps = { requirements: 3500, design: 4000, task: 150 };

/** The machine-read override heading in `agent-rules.md` (requirement 6.3). */
const WORD_CAPS_HEADING = '## Word caps';

/** The known override keys (requirement 6.3); one per `LintCaps` field. */
const KNOWN_KEYS: Array<keyof LintCaps> = ['requirements', 'design', 'task'];

/** A positive integer with no leading zero (requirement 6.3). */
const POSITIVE_INT_RE = /^[1-9]\d*$/;

/**
 * The whitespace-separated token count of `text` (requirement 6.1). `0` for
 * blank text, else `text.trim().split(/\s+/).length`; this equals GNU `wc -w`
 * on ASCII whitespace (D5, probe 2026-09-14).
 */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

/**
 * The document-level word check for `requirements` and `design` (requirement
 * 6.1). WHEN the whole document's count exceeds `cap`, one `doc-words` warning
 * on line 1, message `<count> words, cap <cap>`. `file` is left empty.
 */
export function checkDocWords(content: string, cap: number): LintFinding[] {
  const count = wordCount(content);
  if (count <= cap) return [];
  return [{ file: '', line: 1, rule: 'doc-words', severity: 'warning', message: `${count} words, cap ${cap}` }];
}

/**
 * The per-task word check for `tasks` (requirement 6.2). Each block from task 2
 * carries only line numbers (`TaskBlock` in design.md Data Models), so this
 * takes the document's `lines` too and slices each block's own lines by
 * `start`-`end`, excluding the `promptLines`. WHEN a block's count exceeds
 * `cap`, one `task-words` warning on the checkbox line, message
 * `task <id | unnumbered>: <count> words, cap <cap>`. `file` is left empty.
 */
export function checkTaskWords(lines: string[], blocks: TaskBlock[], cap: number): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const block of blocks) {
    const promptLines = new Set(block.promptLines);
    const counted: string[] = [];
    for (let doc = block.start; doc <= block.end; doc++) {
      if (promptLines.has(doc)) continue; // exclude the `_Prompt:` line and its continuations
      counted.push(lines[doc - 1]);
    }
    const count = wordCount(counted.join('\n'));
    if (count > cap) {
      const id = block.id ?? 'unnumbered';
      findings.push({
        file: '', line: block.line, rule: 'task-words', severity: 'warning',
        message: `task ${id}: ${count} words, cap ${cap}`,
      });
    }
  }
  return findings;
}

/**
 * Parse the per-project cap override (requirement 6.3), mirroring the bullet
 * scan of `parseSensitivePaths` (`src/core/gate-rules.ts:73-93`) without calling
 * it (D6). The `## Word caps` heading is matched by trimmed equality; bullets
 * `- <key>: <value>` run to the next `## ` line or EOF. Each bullet splits on
 * its first `:` into a lower-cased key and a trimmed value. A known key
 * (`requirements | design | task`) with a value matching `^[1-9]\d*$` sets that
 * cap; any other value for a known key is `invalid`; unknown keys are ignored.
 * No heading yields an empty result. The handler (task 7) turns each `invalid`
 * entry into one `caps-invalid` finding.
 */
export function parseWordCaps(markdown: string): { caps: Partial<LintCaps>; invalid: { key: string; value: string }[] } {
  const caps: Partial<LintCaps> = {};
  const invalid: { key: string; value: string }[] = [];
  const lines = markdown.split('\n');

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === WORD_CAPS_HEADING) {
      start = i;
      break;
    }
  }
  if (start === -1) return { caps, invalid };

  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*##\s/.test(lines[i])) break; // next section heading bounds the list
    const bullet = lines[i].match(/^\s*[-*]\s+(.+)$/);
    if (!bullet) continue; // non-bullet lines are ignored
    const colon = bullet[1].indexOf(':');
    if (colon === -1) continue; // no key:value pair on this bullet
    const key = bullet[1].slice(0, colon).trim().toLowerCase();
    const value = bullet[1].slice(colon + 1).trim();
    if (!KNOWN_KEYS.includes(key as keyof LintCaps)) continue; // unknown keys ignored
    const known = key as keyof LintCaps;
    if (POSITIVE_INT_RE.test(value)) {
      caps[known] = Number(value);
    } else {
      invalid.push({ key, value });
    }
  }
  return { caps, invalid };
}
