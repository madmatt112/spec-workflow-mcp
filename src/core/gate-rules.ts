/**
 * Gate rules: tunable constants and pure predicates for the review gate
 * (design Components 3-4, requirements 2, 3, 4).
 *
 * One module so a retrospective can tune every threshold and pattern in one
 * place (requirement 4.4/3.4). Pure functions only, no I/O. Typecheck states
 * arrive as `{ kind }` objects from the handler (Component 2), so `core` never
 * imports `tools`.
 */
import type { CheckResult } from './check-runner.js';
import type { TypecheckDiagnostic } from './typecheck.js';
import type { HygieneSignal } from './hygiene-signals.js';

// --- Component 3: sensitive-path list ---------------------------------------

/** The machine-read heading in `agent-rules.md` (requirement 2.2). */
export const SENSITIVE_PATHS_HEADING = '## Sensitive paths';

/** The machine-read heading listing paths the line rule excludes (retro P2). */
export const GENERATED_PATHS_HEADING = '## Generated paths';

/** The machine-read heading listing prose `*.md` the line rule excludes (retro P10). */
export const PROSE_PATHS_HEADING = '## Prose paths';

/** Every touched path is sensitive when no list is present (requirement 2.4). */
export const NO_LIST_REASON = 'sensitive-paths: no list; every path is sensitive';

// --- Component 4: risk and verdict constants --------------------------------

/** Changed-line ceiling before risk a `line-count` fires (requirement 3.1b). */
export const RISK_LINE_THRESHOLD = 200;

/** The task block names tests when it holds `test`/`tests` on a word boundary. */
export const TEST_WORD_RE = /\b(test|tests)\b/i;

/** A basename holding `.test.` or `.spec.` is a test file (requirement 3.3). */
export const TEST_FILE_BASENAME_RE = /\.(test|spec)\./;

/** A path segment that marks a test file (requirement 3.3). */
export const TEST_DIR_SEGMENTS = ['__tests__', 'tests', 'test'];

/** Checkbox line, copied from `src/core/task-parser.ts:167`; bounds a task block. */
export const TASK_CHECKBOX_RE = /^\s*[-*]\s+\[([ x\-])\]/;

/** Display cap the handler applies to `data.touched.paths`, never the rules (R4-1). */
export const MAX_TOUCHED_LISTED = 100;

/** Characters kept per reason line (requirement 1.7). */
export const MAX_LINE_CHARS = 200;

/**
 * Worst-first order of typecheck methodology states (D20). `worstTypecheckState`
 * returns the state with the lowest index here.
 */
export const TYPECHECK_STATE_RANK = [
  'timeout',
  'unavailable-other',
  'success-with-diagnostics-and-partial-coverage',
  'success-with-diagnostics',
  'success-partial-coverage',
  'unavailable-feature-disabled',
  'success-clean-full',
];

// --- Path normalisation (shared by matchers, R1-4) --------------------------

/** Forward-slash, root-relative, leading `./` stripped (requirement 2.3, R1-4). */
function normalizePath(relPath: string): string {
  return relPath.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

// --- Component 3: parse and match -------------------------------------------

/**
 * The bullet entries under `heading`, to the next `## ` line or EOF, stripped of
 * backticks, whitespace and a leading `./`; non-bullet lines ignored. No heading,
 * or a heading with no bullet, yields `null` (requirement 2.2, 2.4, D26).
 */
function parseHeadingBullets(markdown: string, heading: string): string[] | null {
  const lines = markdown.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === heading) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  const entries: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*##\s/.test(lines[i])) break; // next section heading bounds the list
    const bullet = lines[i].match(/^\s*[-*]\s+(.+)$/);
    if (!bullet) continue; // non-bullet lines are ignored
    const entry = normalizePath(bullet[1].replace(/`/g, '').trim());
    if (entry.length > 0) entries.push(entry);
  }
  return entries.length > 0 ? entries : null;
}

/** The `## Sensitive paths` bullet entries, or `null` (requirement 2.2, 2.4). */
export function parseSensitivePaths(markdown: string): string[] | null {
  return parseHeadingBullets(markdown, SENSITIVE_PATHS_HEADING);
}

/** The `## Generated paths` bullet entries the line rule excludes, or `null` (P2). */
export function parseGeneratedPaths(markdown: string): string[] | null {
  return parseHeadingBullets(markdown, GENERATED_PATHS_HEADING);
}

/** The `## Prose paths` bullet entries whose `*.md` files the line rule excludes (P10). */
export function parseProsePaths(markdown: string): string[] | null {
  return parseHeadingBullets(markdown, PROSE_PATHS_HEADING);
}

/** The entry a path matches, or `undefined`: `dir/` by prefix, else by equality. */
function matchingEntry(relPath: string, entries: string[]): string | undefined {
  const p = normalizePath(relPath);
  for (const entry of entries) {
    if (entry.endsWith('/')) {
      if (p.startsWith(entry)) return entry;
    } else if (p === entry) {
      return entry;
    }
  }
  return undefined;
}

/**
 * True when `relPath` matches an entry: a `dir/` entry matches by prefix, any
 * other by equality; forward-slash paths relative to `root` (requirement 2.3).
 */
export function isSensitivePath(relPath: string, entries: string[]): boolean {
  return matchingEntry(relPath, entries) !== undefined;
}

/** True when `relPath` matches a `## Generated paths` entry, same matcher (P2). */
export function isGeneratedPath(relPath: string, entries: string[]): boolean {
  return matchingEntry(relPath, entries) !== undefined;
}

/**
 * True when `relPath` is a `*.md` file matching a `## Prose paths` entry (P10).
 * Only Markdown prose is exempt; a real source file under the same dir still counts.
 */
export function isProsePath(relPath: string, entries: string[]): boolean {
  return normalizePath(relPath).endsWith('.md') && matchingEntry(relPath, entries) !== undefined;
}

// --- Component 4: task-block predicates -------------------------------------

/**
 * The block of `tasks.md` a task owns: its line through the line before the next
 * checkbox line (mirrors `src/core/task-parser.ts:167-175`, requirement 3.3). A
 * heading between two tasks does not bound it; only a checkbox line does.
 */
export function taskBlock(tasksMarkdown: string, lineNumber: number): string {
  const lines = tasksMarkdown.split('\n');
  let end = lines.length;
  for (let i = lineNumber + 1; i < lines.length; i++) {
    if (TASK_CHECKBOX_RE.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(lineNumber, end).join('\n');
}

/** True when the task block holds `test`/`tests` on a word boundary (3.3). */
export function taskNamesTests(block: string): boolean {
  return TEST_WORD_RE.test(block);
}

/** True when a basename holds `.test.`/`.spec.`, or a segment is a test dir (3.3). */
export function isTestPath(relPath: string): boolean {
  const p = normalizePath(relPath);
  const base = p.split('/').pop() ?? '';
  if (TEST_FILE_BASENAME_RE.test(base)) return true;
  return p.split('/').some((seg) => TEST_DIR_SEGMENTS.includes(seg));
}

/**
 * The worst state across typecheck results: the element with the lowest index in
 * `TYPECHECK_STATE_RANK` (requirement 4.6). An unranked kind is least-worst.
 */
export function worstTypecheckState<T extends { kind: string }>(states: T[]): T {
  const rank = (s: T): number => {
    const idx = TYPECHECK_STATE_RANK.indexOf(s.kind);
    return idx === -1 ? Number.POSITIVE_INFINITY : idx;
  };
  let worst = states[0];
  for (let i = 1; i < states.length; i++) {
    if (rank(states[i]) < rank(worst)) worst = states[i];
  }
  return worst;
}

/** The first line, trimmed to `MAX_LINE_CHARS` (requirement 1.7, R1-3). */
export function truncateLine(s: string): string {
  const firstLine = s.split('\n')[0];
  return firstLine.length > MAX_LINE_CHARS ? firstLine.slice(0, MAX_LINE_CHARS) : firstLine;
}

// --- Component 4: risk rules (Data Models table) ----------------------------

export type RiskInput = {
  mode: 'task' | 'item';
  /** Parsed sensitive-path entries, or `null` when no list is present. */
  sensitive: string[] | null;
  /** Every touched path in the range, relative to `root`, uncapped (R4-1). */
  touched: string[];
  stats: { linesAdded: number; linesRemoved: number } | null;
  /** Changed lines per touched path, from `computeRangeStats` (P2/P14 line rule). */
  perFile?: Record<string, number>;
  /** Parsed `## Generated paths` entries, or `null`/absent when none (P2). */
  generated?: string[] | null;
  /** Parsed `## Prose paths` entries whose `*.md` files are exempt, or `null`/absent (P10). */
  prose?: string[] | null;
  /** The task block; `''` in item mode. */
  block: string;
  /** Whether any of `baseRef`, `commit`, `files` was given. */
  rangeGiven: boolean;
  /** The worst typecheck methodology state (Component 2). */
  typecheck: { kind: string; reason?: string };
  /** The hygiene rejection message, or `null` when the scan succeeded. */
  hygieneRejection: string | null;
  /**
   * True when the range touched files but has no semantic diff — a byte-identical
   * re-indent, or a whitespace-only/no-op edit (retro P14). Set by the handler
   * only after a whitespace-ignoring diff proved zero changed lines.
   */
  trivialChange?: boolean;
};

/**
 * The changed-line total the `line-count` rule scores: the per-path total with
 * generated (P2), prose `*.md` (P10) and test (P14) paths dropped, or the aggregate
 * when no per-path counts are given. `null` when neither is present.
 */
function countedLines(input: RiskInput): number | null {
  if (input.perFile) {
    const generated = input.generated ?? null;
    const prose = input.prose ?? null;
    let total = 0;
    for (const [p, changed] of Object.entries(input.perFile)) {
      if (generated && isGeneratedPath(p, generated)) continue;
      if (prose && isProsePath(p, prose)) continue; // prose *.md do not count (P10)
      if (isTestPath(p)) continue; // source lines only; test paths do not count (P14)
      total += changed;
    }
    return total;
  }
  if (input.stats) return input.stats.linesAdded + input.stats.linesRemoved;
  return null;
}


/**
 * Score risk from the touched list and the pre-computations (Data Models risk
 * table, R4-1). `risk` is `high` when any row fires; item mode never fires c/f.
 */
export function scoreRisk(input: RiskInput): { risk: 'low' | 'high'; reasons: string[] } {
  // Fast path (retro P14): a change that touched files but has no semantic diff
  // needs no verifier, so it scores low outright — even when a rule below (a
  // sensitive path, `no-tsconfig`) would otherwise force high. `trivialChange` is
  // set only after a whitespace-ignoring diff proved zero changed lines, so a
  // real change never slips through here.
  if (input.trivialChange) {
    return { risk: 'low', reasons: [] };
  }

  const reasons: string[] = [];

  // a sensitive-path
  if (input.sensitive === null) {
    reasons.push(NO_LIST_REASON);
  } else {
    for (const p of input.touched) {
      const entry = matchingEntry(p, input.sensitive);
      if (entry !== undefined) {
        reasons.push(`sensitive-path: ${p} matches ${entry}`);
        break;
      }
    }
  }

  // b line-count. Generated paths (`## Generated paths`) do not count toward the
  // rule; per-path counts drive it when present, else the aggregate (P2).
  const counted = countedLines(input);
  if (counted !== null && counted > RISK_LINE_THRESHOLD) {
    reasons.push(`line-count: ${counted} changed lines exceed ${RISK_LINE_THRESHOLD}`);
  }


  // c tests-not-touched (task mode). Also requires that some touched path is a
  // non-test, non-generated source file under `src/`, so a docs-only or
  // verification-only task cannot trip the rule (retro P7).
  const touchesSource = input.touched.some(
    (p) =>
      normalizePath(p).startsWith('src/') &&
      !isTestPath(p) &&
      !(input.generated && isGeneratedPath(p, input.generated))
  );
  if (
    input.mode === 'task' &&
    taskNamesTests(input.block) &&
    !input.touched.some(isTestPath) &&
    touchesSource
  ) {
    reasons.push('tests-not-touched: task names tests; no touched path is a test file');
  }

  // d no-diff
  if (input.touched.length === 0) {
    reasons.push('no-diff: no path changed in the range');
  }

  // e typecheck-unavailable. A project that declares no typecheck toolchain
  // (`no-tsconfig`) is a non-TypeScript repo, not a degraded review surface, so
  // the rule stays silent and risk scores on the other rules (retro P2).
  if (input.typecheck.kind === 'timeout') {
    reasons.push('typecheck-unavailable: timeout');
  } else if (
    input.typecheck.kind === 'unavailable-other' &&
    input.typecheck.reason !== 'no-tsconfig'
  ) {
    reasons.push(`typecheck-unavailable: ${input.typecheck.reason ?? 'unavailable'}`);
  }

  // f no-range (task mode)
  if (input.mode === 'task' && !input.rangeGiven) {
    reasons.push('no-range: ranged against HEAD; pass baseRef');
  }

  // g hygiene-rejected
  if (input.hygieneRejection !== null) {
    reasons.push(`hygiene-rejected: ${input.hygieneRejection}`);
  }

  return { risk: reasons.length > 0 ? 'high' : 'low', reasons };
}

// --- Component 4: gate rules (Data Models table) ----------------------------

export type GateInput = {
  checks: CheckResult[];
  /** Diagnostics of the `success` results; `decideGate` keeps the in-scope ones. */
  diagnostics: TypecheckDiagnostic[];
  hygiene: HygieneSignal[];
  touched: string[];
  /** The caller's `files`, or `null` when none was given. */
  files: string[] | null;
  /** Parsed `## Generated paths` entries, or `null`/absent when none (P3). */
  generated?: string[] | null;
  /** Files-only: listed paths absent under `root`. */
  missing: string[];
  filesOnly: boolean;
};

/**
 * Decide the gate verdict from the checks and pre-computations (Data Models gate
 * table). `gate` is `fail` when any row fires, else `pass`.
 */
export function decideGate(input: GateInput): { gate: 'pass' | 'fail'; reasons: string[] } {
  const reasons: string[] = [];

  // a check-failed / check-timeout
  for (const c of input.checks) {
    if (c.status === 'timeout') {
      reasons.push(`check-timeout: ${c.command} after 300 s`);
    } else if (c.status !== 'pass') {
      reasons.push(`check-failed: ${c.command} exit ${c.exitCode} — ${c.output}`);
    }
  }

  // b typecheck-diagnostic
  const inScope = input.diagnostics.filter((d) => d.inScope);
  if (inScope.length > 0) {
    const d = inScope[0];
    reasons.push(`typecheck-diagnostic: ${d.file}:${d.line} ${d.code} (+${inScope.length - 1} more)`);
  }

  // c debugger
  const dbg = input.hygiene.find((h) => h.pattern === 'debugger');
  if (dbg) {
    reasons.push(`debugger: ${dbg.file}:${dbg.line}`);
  }

  // d file-outside-list. A generated (`## Generated paths`) path is skipped, just
  // as the line-count rule excludes it: the sync step regenerates those copies, so
  // a `files` list naming only the sources must not flag the mirror copies (P3).
  if (input.files !== null) {
    const listed = input.files.map(normalizePath);
    const generated = input.generated ?? null;
    for (const p of input.touched) {
      if (generated && isGeneratedPath(p, generated)) continue;
      if (!listed.includes(normalizePath(p))) {
        reasons.push(`file-outside-list: ${p}`);
      }
    }
  }

  // e listed-file-missing (files-only)
  if (input.filesOnly) {
    for (const p of input.missing) {
      reasons.push(`listed-file-missing: ${p}`);
    }
  }

  return { gate: reasons.length > 0 ? 'fail' : 'pass', reasons };
}
