/**
 * Tasks checks (design Component 7, requirements 5.1-5.4, 7.1-7.4, 10.1). The
 * `tasks` phase's machine checks: task shape from the existing validator, the
 * `_Requirements:` ids against the sibling `requirements.md`, and the design's
 * components covered by tasks plus the missing-bridge warning.
 *
 * Pure module, no I/O; `core` never imports `tools`. Findings leave `file`
 * empty for `finishLint` to set. `checkCoverage` and `checkBridges` take the
 * document's `lines` alongside task 2's `TaskBlock[]`: a `TaskBlock` carries
 * only `start`/`end`/`promptLines` line numbers, not the block text, so this
 * module slices the lines itself (the same shape `checkTaskWords` follows).
 * The sibling-document reads (`requirements.md`, `design.md`) belong to the
 * handler (task 7); it passes the parsed lines and `null` when a sibling is
 * missing.
 */
import { validateTasksMarkdown } from './task-validator.js';
import { criteria, fencedLines } from './lint-markdown.js';
import type { TaskBlock } from './lint-markdown.js';
import type { LintFinding } from './lint-types.js';

// --- Regexes ----------------------------------------------------------------

/** A `### Requirement N` heading, any suffix (requirement 5.3; `lint-markdown` REQUIREMENT_RE). */
const REQUIREMENT_HEADING_RE = /^###\s+Requirement\s+(\d+)\b/;

/** The `_Requirements:` value, copied from `src/core/task-parser.ts:266`. */
const REQUIREMENTS_VALUE_RE = /_Requirements:\s*([^_]+?)_/;

/** A bare numeric requirement id (`N`). */
const NUMERIC_ID_RE = /^\d+$/;

/** A numbered-item requirement id (`N.M`). */
const ITEM_ID_RE = /^(\d+)\.(\d+)$/;

/** The design components section heading, matched by trimmed equality (requirement 7.1). */
const COMPONENTS_HEADING = '## Components and Interfaces';

/** An h2 heading; bounds the components section (requirement 7.1). */
const H2_LINE_RE = /^##\s/;

/** An h3 heading and its text (requirement 7.1). */
const H3_HEADING_RE = /^###\s+(.+)$/;

/** A `Component N` heading prefix; the label when a heading opens so (requirement 7.1). */
const COMPONENT_LABEL_RE = /^Component\s+\d+/;

/**
 * A design heading that opens with an enumerated component letter (`A. Shared defaults`,
 * `B) Provider map`). Tasks that reference such a component write `Component A`, not the
 * heading text, so this letter lets a `Component <letter>` mention count as coverage
 * (retro P20).
 */
const COMPONENT_LETTER_RE = /^([A-Za-z])[.):]/;

/** A `task <id>` mention inside a task block (requirement 7.4). */
const TASK_MENTION_RE = /\btask\s+(\d+(?:\.\d+)*)/gi;

/** Words that mark a mentioned later task as deliberately bridged (requirement 7.4). */
const BRIDGE_WORDS = ['bridge', 'stub', 'cast', 'shim', 'placeholder'];

// --- Exported shape ---------------------------------------------------------

/** A design component: its heading text, the coverage label and its `design.md` line. */
export interface DesignComponent {
  /** The `### ` heading text (without the leading `### `). */
  heading: string;
  /** The coverage label: `Component N` when the heading opens so, else the name, backticks removed (D7). */
  label: string;
  /** 1-based line of the heading in `design.md`. */
  line: number;
}

// --- Checks -----------------------------------------------------------------

/**
 * Map every `validateTasksMarkdown` error and warning to a `tasks-format`
 * finding (requirements 5.1, 5.2, D8): errors at `error`, warnings at
 * `warning`, with the validator's 1-based `line` and `message` verbatim (no
 * task-id prefix, D8). `file` is left empty.
 */
export function checkTasksFormat(content: string): LintFinding[] {
  const result = validateTasksMarkdown(content);
  const findings: LintFinding[] = [];
  for (const e of result.errors) {
    findings.push({ file: '', line: e.line, rule: 'tasks-format', severity: 'error', message: e.message });
  }
  for (const w of result.warnings) {
    findings.push({ file: '', line: w.line, rule: 'tasks-format', severity: 'warning', message: w.message });
  }
  return findings;
}

/**
 * Build the requirement index from `requirements.md` (requirement 5.3): every
 * `### Requirement N` heading is a key, mapped to the set of its numbered
 * acceptance-criteria item numbers (from Component 3's `criteria`). A
 * requirement with no criteria maps to an empty set.
 */
export function requirementIndex(lines: string[]): Map<number, Set<number>> {
  const index = new Map<number, Set<number>>();
  for (const line of lines) {
    const m = line.match(REQUIREMENT_HEADING_RE);
    if (m) {
      const n = Number(m[1]);
      if (!index.has(n)) index.set(n, new Set<number>());
    }
  }
  for (const c of criteria(lines)) {
    if (c.requirement === null) continue;
    let set = index.get(c.requirement);
    if (!set) {
      set = new Set<number>();
      index.set(c.requirement, set);
    }
    set.add(c.index);
  }
  return index;
}

/**
 * Check every `_Requirements:` token against the index (requirements 5.3, 5.4).
 * `index === null` (no sibling `requirements.md`) is one
 * `task-requirement-unchecked` at `info` on line 1, with no per-line check.
 * Otherwise, for each unfenced line containing `_Requirements:` and not
 * `_Prompt:` (`src/core/task-parser.ts:264`), the value of the
 * `_Requirements:` field (`:266`) is split on commas and trimmed: a token
 * starting `NFR` passes; `N` must be a key and `N.M` a key with that item, else
 * `task-requirement-id` at `error` naming the token; any other token is
 * `task-requirement-unchecked` at `info`. `file` is left empty.
 */
export function checkRequirementIds(lines: string[], index: Map<number, Set<number>> | null): LintFinding[] {
  if (index === null) {
    return [{
      file: '', line: 1, rule: 'task-requirement-unchecked', severity: 'info',
      message: 'no requirements index; requirement ids not checked',
    }];
  }

  const findings: LintFinding[] = [];
  const fenced = fencedLines(lines);
  for (let i = 0; i < lines.length; i++) {
    if (fenced[i]) continue;
    const line = lines[i];
    if (!line.includes('_Requirements:') || line.includes('_Prompt:')) continue;
    const valueMatch = line.match(REQUIREMENTS_VALUE_RE);
    if (!valueMatch) continue;

    const tokens = valueMatch[1].split(',').map((t) => t.trim()).filter((t) => t !== '');
    for (const token of tokens) {
      if (token.startsWith('NFR')) continue;

      if (NUMERIC_ID_RE.test(token)) {
        if (!index.has(Number(token))) {
          findings.push(requirementMiss(token, i + 1));
        }
        continue;
      }

      const itemMatch = token.match(ITEM_ID_RE);
      if (itemMatch) {
        const set = index.get(Number(itemMatch[1]));
        if (!set || !set.has(Number(itemMatch[2]))) {
          findings.push(requirementMiss(token, i + 1));
        }
        continue;
      }

      findings.push({
        file: '', line: i + 1, rule: 'task-requirement-unchecked', severity: 'info',
        message: `requirement token \`${token}\` not checked`,
      });
    }
  }
  return findings;
}

function requirementMiss(token: string, line: number): LintFinding {
  return {
    file: '', line, rule: 'task-requirement-id', severity: 'error',
    message: `requirement id \`${token}\` not found in requirements.md`,
  };
}

/**
 * Read the design components (requirement 7.1, D7). `null` when no trimmed line
 * is `## Components and Interfaces`; otherwise every `### ` heading up to the
 * next `## ` line. A component's label is the `Component N` prefix when the
 * heading opens so, else the heading text up to the first ` — `, `:` or `(`,
 * trimmed, backticks removed (D7).
 */
export function designComponents(designLines: string[]): DesignComponent[] | null {
  let start = -1;
  for (let i = 0; i < designLines.length; i++) {
    if (designLines[i].trim() === COMPONENTS_HEADING) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  const components: DesignComponent[] = [];
  for (let i = start + 1; i < designLines.length; i++) {
    if (H2_LINE_RE.test(designLines[i])) break; // the next `## ` heading bounds the section
    const headingMatch = designLines[i].match(H3_HEADING_RE);
    if (!headingMatch) continue;
    const heading = headingMatch[1].trim();
    components.push({ heading, label: labelFor(heading), line: i + 1 });
  }
  return components;
}

/** The coverage label for a component heading (requirement 7.1, D7). */
function labelFor(heading: string): string {
  const componentMatch = heading.match(COMPONENT_LABEL_RE);
  let raw: string;
  if (componentMatch) {
    raw = componentMatch[0];
  } else {
    let cut = heading.length;
    for (const delimiter of [' — ', ':', '(']) {
      const idx = heading.indexOf(delimiter);
      if (idx !== -1 && idx < cut) cut = idx;
    }
    raw = heading.slice(0, cut);
  }
  return raw.replace(/`/g, '').trim();
}

/**
 * Check that every design component is covered by a task (requirements 7.2,
 * 7.3). `components === null` (no `design.md` or no components section) is one
 * `coverage-unchecked` at `info` on line 1. Otherwise a label that no task
 * block's joined text (its `start`-`end` span, prompt included) matches at word
 * boundaries, case-insensitive, is `coverage-component` at `error` on line 1,
 * naming the heading and its `design.md` line. `file` is left empty. A component whose
 * heading opens with an enumerated letter (`A. Shared defaults`) is also covered by a task
 * that names `Component <that letter>`, since tasks reference it that way (retro P20).
 */
export function checkCoverage(
  lines: string[],
  blocks: TaskBlock[],
  components: DesignComponent[] | null,
): LintFinding[] {
  if (components === null) {
    return [{
      file: '', line: 1, rule: 'coverage-unchecked', severity: 'info',
      message: 'design.md has no components section; coverage not checked',
    }];
  }

  const spans = blocks.map((b) => lines.slice(b.start - 1, b.end).join('\n'));
  const findings: LintFinding[] = [];
  for (const component of components) {
    const labelRe = new RegExp('\\b' + escapeRegExp(component.label) + '\\b', 'i');
    const letterMatch = component.heading.match(COMPONENT_LETTER_RE);
    const letterRe = letterMatch ? new RegExp('\\bComponent\\s+' + letterMatch[1] + '\\b', 'i') : null;
    if (spans.some((span) => labelRe.test(span) || (letterRe !== null && letterRe.test(span)))) continue;
    findings.push({
      file: '', line: 1, rule: 'coverage-component', severity: 'error',
      message: `design component "${component.heading}" is covered by no task (design.md line ${component.line})`,
    });
  }
  return findings;
}

/**
 * Warn on a task block that names a later task with no bridge (requirement
 * 7.4). Per block with an id, each `task <id>` mention (case-insensitive) whose
 * id sorts after the block's own id by numeric segments — a shorter prefix
 * sorts first — is `bridge-missing` at `warning` on the checkbox line, naming
 * both ids, unless the block's text contains any of `bridge`, `stub`, `cast`,
 * `shim`, `placeholder` (case-insensitive), which suppresses the block.
 * `.spec-workflow/specs/review-gate/tasks.md:50-51` (task 5 names task 6 and
 * `bridge`) passes. `file` is left empty.
 */
export function checkBridges(lines: string[], blocks: TaskBlock[]): LintFinding[] {
  const findings: LintFinding[] = [];
  for (const block of blocks) {
    if (block.id === null) continue;
    const span = lines.slice(block.start - 1, block.end).join('\n');
    if (BRIDGE_WORDS.some((word) => span.toLowerCase().includes(word))) continue;

    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    TASK_MENTION_RE.lastIndex = 0;
    while ((match = TASK_MENTION_RE.exec(span)) !== null) {
      const mentioned = match[1];
      if (mentioned === block.id || seen.has(mentioned)) continue;
      if (compareIds(mentioned, block.id) <= 0) continue;
      seen.add(mentioned);
      findings.push({
        file: '', line: block.line, rule: 'bridge-missing', severity: 'warning',
        message: `task ${block.id} names later task ${mentioned} with no bridge`,
      });
    }
  }
  return findings;
}

/** Compare two dotted ids by numeric segments; a shorter prefix sorts first (requirement 7.4). */
function compareIds(a: string, b: string): number {
  const as = a.split('.').map(Number);
  const bs = b.split('.').map(Number);
  const len = Math.min(as.length, bs.length);
  for (let i = 0; i < len; i++) {
    if (as[i] !== bs[i]) return as[i] - bs[i];
  }
  return as.length - bs.length;
}

/** Escape a label for a literal `RegExp` (design Component 7's `escape(label)`). */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
