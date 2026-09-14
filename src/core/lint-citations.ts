/**
 * Citation checks (design Component 4, requirements 1.9, 2.1-2.7, NFR Security).
 * Every `path:line` and `path:a-b` in a document is verified against the real
 * tree before a reviewer reads it: the path resolves under the code root, the
 * spec store or the spec directory (first hit wins), the range sits inside the
 * file, and every backticked identifier in a block that holds a resolved
 * citation appears in one of its cited ranges.
 *
 * Reads go only through `PathUtils.safeJoin` (`src/core/path-utils.ts:183-206`);
 * a path with `..` or a leading `/` is a `citation-path` error and is never read
 * (requirement 1.9). Each distinct file is read at most once per call (2.7) via a
 * per-call `Map`. No child process; `core` never imports `tools`.
 */
import { readFile, stat } from 'node:fs/promises';
import { isUtf8 } from 'node:buffer';
import { PathUtils } from './path-utils.js';
import { fencedLines, blocks, type Block } from './lint-markdown.js';
import type { LintFinding } from './lint-types.js';

// --- Regexes ----------------------------------------------------------------

/**
 * A path citation: `[\w.-]` segments joined by `/`, the last ending in `.` plus
 * one to six letters, then `:N` or `:A-B`, inside or outside backticks
 * (requirement 2.1). The lookbehind rejects a token after `\w`, `.`, `/` or `-`,
 * so `localhost:3000`, `v1.2:3` and `https://x.com:443` do not match (the last
 * because the `x.com` token follows a `/`); a leading `/` (an absolute path) is
 * allowed to match so it can be flagged `citation-path` (requirement 1.9).
 */
export const CITATION_RE = /(?<![\w./-])(\/?(?:[\w.-]+\/)*[\w.-]+\.[A-Za-z]{1,6}):(\d+)(?:-(\d+))?(?![\w-])/g;

/** A bare backticked range `` `:N` `` or `` `:A-B` `` with no path (requirement 2.2). */
export const BARE_RANGE_RE = /`:(\d+)(?:-(\d+))?`/g;

/** A backticked span, an identifier candidate (requirement 2.6). */
const BACKTICK_SPAN_RE = /`([^`]+)`/g;

/** The identifier segment 2.6 keeps: a letter/`_`/`$` start, then two or more word chars. */
const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]{2,}$/;

// --- Exported shape ---------------------------------------------------------

/**
 * A `path:line`/`path:a-b` citation, or a bare backticked range resolved against
 * an earlier path (design.md Data Models "Scanning types"). `line` and `column`
 * are the 1-based position of the token in the document (the finding line);
 * `start` and `end` are the cited line range (`start === end` for a single
 * line). `path` is `''` for a bare range with no earlier path citation in its
 * block; `block` is the block the token sits in, for the identifier check.
 */
export interface Citation {
  path: string;
  line: number;
  column: number;
  start: number;
  end: number;
  bare: boolean;
  block: Block;
}

// --- Scanners ---------------------------------------------------------------

/**
 * Collect every citation token on the unfenced lines (requirement 2.1; inline
 * code spans are scanned, triple-backtick fences are not). A bare backticked
 * range resolves against its block's nearest earlier path citation in document
 * order; with no such path its `path` is `''` and `checkCitations` reports
 * `citation-bare` (requirement 2.2). Blocks come from `blocks()`, so a bare
 * range borrows only within its own block.
 */
export function extractCitations(lines: string[], fenced: boolean[], blockList: Block[]): Citation[] {
  const lineToBlock = new Map<number, Block>();
  for (const b of blockList) {
    for (let ln = b.start; ln <= b.end; ln++) lineToBlock.set(ln, b);
  }

  const citations: Citation[] = [];
  let currentBlock: Block | null = null;
  let lastPath: Citation | null = null;

  for (let i = 0; i < lines.length; i++) {
    if (fenced[i]) continue;
    const docLine = i + 1;
    const block = lineToBlock.get(docLine) ?? { start: docLine, end: docLine };
    if (block !== currentBlock) {
      currentBlock = block;
      lastPath = null; // "earlier" is scoped to the block (requirement 2.2)
    }

    // Gather path citations and bare ranges on this line, then process them in
    // column order so a bare range borrows only path citations to its left.
    type Hit = { column: number; path: string | null; start: number; end: number };
    const hits: Hit[] = [];
    for (const m of lines[i].matchAll(CITATION_RE)) {
      const a = Number(m[2]);
      const b = m[3] !== undefined ? Number(m[3]) : a;
      hits.push({ column: (m.index ?? 0) + 1, path: m[1], start: a, end: b });
    }
    for (const m of lines[i].matchAll(BARE_RANGE_RE)) {
      const a = Number(m[1]);
      const b = m[2] !== undefined ? Number(m[2]) : a;
      hits.push({ column: (m.index ?? 0) + 1, path: null, start: a, end: b });
    }
    hits.sort((x, y) => x.column - y.column);

    for (const h of hits) {
      if (h.path !== null) {
        const cit: Citation = {
          path: h.path, line: docLine, column: h.column,
          start: h.start, end: h.end, bare: false, block,
        };
        lastPath = cit;
        citations.push(cit);
      } else {
        citations.push({
          path: lastPath ? lastPath.path : '', line: docLine, column: h.column,
          start: h.start, end: h.end, bare: true, block,
        });
      }
    }
  }
  return citations;
}

/**
 * The identifier tokens in a stretch of text (requirement 2.6, design
 * Component 4). For every backticked span: reject one with whitespace, `/` or
 * `:` (a path or citation), or a leading `-`, `'`, `"`, `{`, `[` or `<`; strip a
 * trailing `(...)`; reject a file name (ends in `.` plus one to four lowercase
 * letters); take the last `.`-segment; keep it when it matches
 * `^[A-Za-z_$][A-Za-z0-9_$]{2,}$`. So `` `PathUtils.getWorkflowRoot` `` yields
 * `getWorkflowRoot` and `` `'gate'` `` yields nothing. Duplicates drop out.
 */
export function identifierTokens(text: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(BACKTICK_SPAN_RE)) {
    const span = m[1];
    if (/[\s/:]/.test(span)) continue;            // whitespace, `/` or `:`
    if (/^[-'"{[<]/.test(span)) continue;         // a leading char 2.6 excludes
    const stripped = span.replace(/\([^)]*\)$/, ''); // drop a trailing `(...)`
    if (/\.[a-z]{1,4}$/.test(stripped)) continue; // a file name
    const segment = stripped.split('.').pop() ?? '';
    if (!IDENTIFIER_RE.test(segment)) continue;
    if (!seen.has(segment)) {
      seen.add(segment);
      result.push(segment);
    }
  }
  return result;
}

// --- Resolution -------------------------------------------------------------

type Resolved =
  | { kind: 'path' }                       // absent under every base, or `..`/leading `/`
  | { kind: 'unchecked' }                  // a directory, an unreadable file, or non-UTF-8
  | { kind: 'lines'; lines: string[] };    // a readable UTF-8 file, split on `\n`

/**
 * Resolve a cited path once and cache the result (requirement 2.7): a `..` or
 * leading-`/` path is `citation-path` with no read (1.9); otherwise
 * `PathUtils.safeJoin` and `stat` per base in order, the first existing base
 * wins (2.3); a directory, an unreadable file or non-UTF-8 bytes is
 * `citation-unchecked`; a readable UTF-8 file is split on `\n` with a trailing
 * empty element dropped. Only that base's file is read, at most once.
 */
async function resolvePathOnce(rawPath: string, bases: string[], cache: Map<string, Resolved>): Promise<Resolved> {
  const hit = cache.get(rawPath);
  if (hit) return hit;

  let entry: Resolved = { kind: 'path' };
  if (!(rawPath.includes('..') || rawPath.startsWith('/'))) {
    for (const base of bases) {
      let candidate: string;
      try {
        candidate = PathUtils.safeJoin(base, rawPath);
      } catch {
        continue; // safeJoin refused this base
      }
      let stats;
      try {
        stats = await stat(candidate);
      } catch {
        continue; // not under this base; try the next
      }
      // First existing base wins (2.3), whether readable, a directory or not.
      if (stats.isDirectory()) {
        entry = { kind: 'unchecked' };
      } else {
        try {
          const buffer = await readFile(candidate);
          if (!isUtf8(buffer)) {
            entry = { kind: 'unchecked' };
          } else {
            const parts = buffer.toString('utf-8').split('\n');
            if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
            entry = { kind: 'lines', lines: parts };
          }
        } catch {
          entry = { kind: 'unchecked' };
        }
      }
      break;
    }
  }

  cache.set(rawPath, entry);
  return entry;
}

// --- The check --------------------------------------------------------------

/**
 * Verify every citation in a document (requirements 2.1-2.7, design Component 4).
 * `bases` are tried in order: the code root, the spec store, the spec directory
 * (`[workspacePath, workflowRoot, specDir]` from the handler). Returns findings
 * with `file` unset; `finishLint` sets it to `<phase>.md`.
 */
export async function checkCitations(lines: string[], bases: string[]): Promise<LintFinding[]> {
  const fenced = fencedLines(lines);
  const blockList = blocks(lines, fenced);
  const citations = extractCitations(lines, fenced, blockList);

  const findings: LintFinding[] = [];
  const cache = new Map<string, Resolved>();            // one read per distinct path (2.7)
  const inRangeByBlock = new Map<Block, Citation[]>();  // for the identifier check (D4)

  for (const cit of citations) {
    if (cit.bare && cit.path === '') {
      findings.push({
        file: '', line: cit.line, rule: 'citation-bare', severity: 'info',
        message: `Bare range ${rangeLabel(cit)} has no earlier path citation in its block`,
      });
      continue;
    }

    const resolved = await resolvePathOnce(cit.path, bases, cache);
    if (resolved.kind === 'path') {
      findings.push({
        file: '', line: cit.line, rule: 'citation-path', severity: 'error',
        message: pathMessage(cit.path),
      });
    } else if (resolved.kind === 'unchecked') {
      findings.push({
        file: '', line: cit.line, rule: 'citation-unchecked', severity: 'info',
        message: `Cited path is not checkable (a directory, unreadable, or not UTF-8): ${cit.path}`,
      });
    } else {
      const count = resolved.lines.length;
      if (cit.start === 0 || cit.end === 0 || cit.start > cit.end || cit.end > count) {
        findings.push({
          file: '', line: cit.line, rule: 'citation-range', severity: 'error',
          message: `Cited range ${citeLabel(cit)} is out of bounds (${cit.path} has ${count} lines)`,
        });
      } else {
        const list = inRangeByBlock.get(cit.block) ?? [];
        list.push(cit);
        inRangeByBlock.set(cit.block, list);
      }
    }
  }

  // Identifier check: only a block with at least one in-range resolved citation
  // (design D4); each identifier absent from the joined cited ranges is a
  // `citation-identifier` warning on the block's first line (requirement 2.5).
  for (const [block, inRange] of inRangeByBlock) {
    const blockText = lines.slice(block.start - 1, block.end).join('\n');
    const tokens = identifierTokens(blockText);
    if (tokens.length === 0) continue;

    const citedParts: string[] = [];
    for (const c of inRange) {
      const r = cache.get(c.path);
      if (r && r.kind === 'lines') citedParts.push(r.lines.slice(c.start - 1, c.end).join('\n'));
    }
    const citedText = citedParts.join('\n');
    const checked = inRange.map(citeLabel).join(', ');

    for (const token of tokens) {
      if (!citedText.includes(token)) {
        findings.push({
          file: '', line: block.start, rule: 'citation-identifier', severity: 'warning',
          message: `Identifier '${token}' is absent from the cited ranges (${checked})`,
        });
      }
    }
  }

  return findings;
}

// --- Message helpers --------------------------------------------------------

/** A bare range as it was written, `` `:N` `` or `` `:A-B` ``. */
function rangeLabel(c: Citation): string {
  return c.end !== c.start ? `\`:${c.start}-${c.end}\`` : `\`:${c.start}\``;
}

/** A citation as `path:N` or `path:A-B`. */
function citeLabel(c: Citation): string {
  return c.end !== c.start ? `${c.path}:${c.start}-${c.end}` : `${c.path}:${c.start}`;
}

/** The `citation-path` message: distinguish a refused path from one found under no base. */
function pathMessage(p: string): string {
  return p.includes('..') || p.startsWith('/')
    ? `Cited path is absolute or contains '..' and is not read: ${p}`
    : `Cited path resolves under no base (code root, spec store, spec dir): ${p}`;
}
