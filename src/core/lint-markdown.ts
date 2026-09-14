/**
 * Markdown scanning helpers (design Component 3, requirements 2.1, 2.5, 4.1,
 * 5.3, 6.2, 7.2, 7.4). One text model — fences, blocks, acceptance criteria and
 * task blocks — that the citation, EARS, word-count, coverage and bridge rule
 * modules (tasks 3-6) share, so no rule module re-scans the document.
 *
 * Pure module, no I/O. Every exported shape carries 1-based line numbers.
 */

// --- Regexes copied from the task parser -----------------------------------
// Copied literals, not imports, the way `src/core/gate-rules.ts:36-37` copies
// the checkbox regex; the citation comment names the source line.

/** Checkbox line, copied from `src/core/task-parser.ts:167`; bounds a task block. */
const CHECKBOX_RE = /^\s*[-*]\s+\[([ x\-])\]/;

/** Well-formed checkbox with its text, copied from `src/core/task-parser.ts:178`. */
const CHECKBOX_TEXT_RE = /^(\s*)([-*])\s+\[([ x\-])\]\s+(.+)/;

/** Task id on the text after the checkbox, copied from `src/core/task-parser.ts:204`. */
const TASK_ID_RE = /^(\d+(?:\.\d+)*)\s*\\?\.?\s+(.+)/;

/** Single-line prompt (ends with `_`), copied from `src/core/task-parser.ts:235`. */
const PROMPT_SINGLE_RE = /_Prompt:\s*(.+)_$/;

// --- Structural regexes -----------------------------------------------------

/** A triple-backtick fence line, possibly indented (requirement 2.1). */
const FENCE_RE = /^\s*```/;

/** A list item start (requirement 2.5). */
const LIST_ITEM_RE = /^\s*([-*+]|\d+\.)\s/;

/** A table row (requirement 2.5). */
const TABLE_ROW_RE = /^\s*\|/;

/** Any ATX heading, level 1-6 (requirement 2.5). */
const HEADING_RE = /^#{1,6}\s/;

/** An h2 heading; bounds a task block (requirement 6.2, D6). */
const H2_RE = /^##\s/;

/** A `### Requirement N` heading (requirement 4.1). */
const REQUIREMENT_RE = /^###\s+Requirement\s+(\d+)\b/;

/** A numbered acceptance-criteria item (requirement 4.1's `^\d+\.\s`). */
const NUMBERED_ITEM_RE = /^(\d+)\.\s+(.*)$/;

/** The acceptance-criteria heading, matched by trimmed equality (requirement 4.1). */
const ACCEPTANCE_HEADING = '#### Acceptance Criteria';

// --- Exported shapes --------------------------------------------------------

/**
 * A run of consecutive non-blank unfenced lines (requirement 2.5). Shape from
 * design.md Data Models "Scanning types" (`{ start; end }`, 1-based inclusive);
 * callers slice the document's own `lines` by `start`-`end`.
 */
export interface Block {
  /** 1-based line of the block's first line. */
  start: number;
  /** 1-based line of the block's last line (inclusive). */
  end: number;
}

/** A numbered item under a `#### Acceptance Criteria` heading (requirement 4.1). */
export interface Criterion {
  /** The `### Requirement N` this sits under, or `null` before any. */
  requirement: number | null;
  /** The item number (`N` of `N.`); `index` per design.md Data Models. */
  index: number;
  /** 1-based line of the item's first line. */
  line: number;
  /** The item text with its continuation lines joined by one space. */
  text: string;
}

/**
 * A checkbox task and the lines it owns (requirement 6.2). Shape from design.md
 * Data Models "Scanning types" (`{ id; line; start; end; promptLines }`);
 * callers slice the document's own `lines` by `start`-`end` and exclude the
 * `promptLines` line numbers.
 */
export interface TaskBlock {
  /** 1-based line of the checkbox line. */
  line: number;
  /** The task id (e.g. `2`, `3.1`), or `null` when the checkbox has none. */
  id: string | null;
  /** 1-based line of the block's first line (the checkbox line). */
  start: number;
  /** 1-based line of the block's last line (inclusive). */
  end: number;
  /**
   * 1-based line numbers of the `_Prompt:` line and, when it is multi-line, its
   * continuation lines (design.md Data Models: `number[]`, not the raw text).
   */
  promptLines: number[];
}

// --- Scanners ---------------------------------------------------------------

/**
 * Mask every line inside a triple-backtick fence, the fence delimiters
 * included (requirement 2.1). `true` from a line matching `^\s*``` ` to the
 * next such line, inclusive; an unclosed fence masks to the end of the file.
 */
export function fencedLines(lines: string[]): boolean[] {
  const mask = new Array<boolean>(lines.length).fill(false);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      mask[i] = true; // the delimiter itself is fenced (inclusive)
      inFence = !inFence;
    } else if (inFence) {
      mask[i] = true;
    }
  }
  return mask;
}

/**
 * Split the document into blocks (requirement 2.5, design D3). A block starts
 * at a non-blank unfenced line after a blank or fenced line, or at any list
 * item, table row or heading; it ends before the next start or the next blank
 * line. Fenced and blank lines belong to no block.
 */
export function blocks(lines: string[], fenced: boolean[]): Block[] {
  const isStart = (i: number): boolean => {
    // Callers only ask about non-blank unfenced lines.
    const afterBoundary = i === 0 || lines[i - 1].trim() === '' || fenced[i - 1];
    return (
      afterBoundary ||
      LIST_ITEM_RE.test(lines[i]) ||
      TABLE_ROW_RE.test(lines[i]) ||
      HEADING_RE.test(lines[i])
    );
  };

  const result: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    if (fenced[i] || lines[i].trim() === '' || !isStart(i)) {
      i++;
      continue;
    }
    let j = i + 1;
    while (j < lines.length && !fenced[j] && lines[j].trim() !== '' && !isStart(j)) {
      j++;
    }
    result.push({ start: i + 1, end: j });
    i = j;
  }
  return result;
}

/**
 * Collect the numbered items under each `#### Acceptance Criteria` heading
 * (requirement 4.1). Each item runs to the next numbered item, blank line or
 * heading; its continuation lines join to the text with one space. The
 * requirement number comes from the most recent `### Requirement N` heading,
 * `null` before any. An acceptance section ends at the next heading.
 */
export function criteria(lines: string[]): Criterion[] {
  const result: Criterion[] = [];
  let currentRequirement: number | null = null;
  let inAcceptance = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const reqMatch = line.match(REQUIREMENT_RE);
    if (reqMatch) {
      currentRequirement = Number(reqMatch[1]);
      inAcceptance = false;
      continue;
    }
    if (line.trim() === ACCEPTANCE_HEADING) {
      inAcceptance = true;
      continue;
    }
    if (HEADING_RE.test(line)) {
      inAcceptance = false;
      continue;
    }
    if (!inAcceptance) continue;

    const itemMatch = line.match(NUMBERED_ITEM_RE);
    if (!itemMatch) continue;

    let text = itemMatch[2].trim();
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (next.trim() === '' || HEADING_RE.test(next) || NUMBERED_ITEM_RE.test(next)) break;
      text += ' ' + next.trim();
      j++;
    }
    result.push({ requirement: currentRequirement, index: Number(itemMatch[1]), line: i + 1, text });
    i = j - 1;
  }
  return result;
}

/**
 * Split `tasks.md` into task blocks (requirement 6.2, design D6). Each block
 * runs from a checkbox line to the line before the next checkbox line, the
 * next `## ` line, or EOF, whichever comes first. `id` is the numeric id on the
 * text after the checkbox (`src/core/task-parser.ts:204`), `null` when absent.
 * `promptLines` is the `_Prompt:` line plus, when it does not end with `_`, its
 * continuation lines up to a blank line or a `-`/`*` bullet, `Files:` or
 * `Purpose:` line (`src/core/task-parser.ts:233-259`).
 */
export function taskBlocks(lines: string[]): TaskBlock[] {
  const result: TaskBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!CHECKBOX_RE.test(lines[i])) continue;

    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (CHECKBOX_RE.test(lines[j]) || H2_RE.test(lines[j])) {
        end = j;
        break;
      }
    }
    const blockLines = lines.slice(i, end);

    let id: string | null = null;
    const checkboxText = lines[i].match(CHECKBOX_TEXT_RE);
    if (checkboxText) {
      const idMatch = checkboxText[4].match(TASK_ID_RE);
      if (idMatch) id = idMatch[1];
    }

    result.push({ line: i + 1, id, start: i + 1, end, promptLines: promptLinesOf(blockLines, i) });
  }
  return result;
}

/**
 * The 1-based document line numbers of the `_Prompt:` line and its continuation
 * lines within a task block. `offset` is the block's 0-based start index in the
 * document, so a block line `k` is document line `offset + k + 1`.
 */
function promptLinesOf(blockLines: string[], offset: number): number[] {
  for (let k = 0; k < blockLines.length; k++) {
    if (!blockLines[k].includes('_Prompt:')) continue;
    const collected = [offset + k + 1];
    if (!PROMPT_SINGLE_RE.test(blockLines[k].trim())) {
      for (let m = k + 1; m < blockLines.length; m++) {
        const nextTrim = blockLines[m].trim();
        if (!nextTrim || /^[-*]\s/.test(nextTrim) || /^Files?:/i.test(nextTrim) || /^Purpose:/i.test(nextTrim)) {
          break;
        }
        collected.push(offset + m + 1);
      }
    }
    return collected;
  }
  return [];
}
