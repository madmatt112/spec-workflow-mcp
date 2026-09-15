import { readFile, stat } from 'fs/promises';
import path from 'node:path';
import { execFile, ExecFileOptions } from 'node:child_process';
import { partitionPaths } from './path-denylist.js';
import { scrubbedGitEnv } from './git-utils.js';

export type HygieneSignal = {
  file: string;
  line: number;
  pattern: 'console' | 'todo' | 'fixme' | 'debugger';
  text: string;
};

const MAX_FILE_SIZE = 1024 * 1024;
const MAX_TEXT_LENGTH = 120;

const PATTERNS: Array<{ pattern: HygieneSignal['pattern']; regex: RegExp }> = [
  { pattern: 'console', regex: /console\.(log|warn|error|debug|info|trace)\s*\(/ },
  { pattern: 'todo', regex: /\bTODO\b/ },
  { pattern: 'fixme', regex: /\bFIXME\b/ },
  { pattern: 'debugger', regex: /\bdebugger\b/ },
];

async function scanFile(file: string): Promise<HygieneSignal[]> {
  try {
    const stats = await stat(file);
    if (stats.size > MAX_FILE_SIZE) {
      return [];
    }
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    const signals: HygieneSignal[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { pattern, regex } of PATTERNS) {
        if (regex.test(line)) {
          const trimmed = line.trim();
          const text = trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH) : trimmed;
          signals.push({ file, line: i + 1, pattern, text });
        }
      }
    }
    return signals;
  } catch {
    return [];
  }
}

const GIT_MAX_BUFFER = 16 * 1024 * 1024;

/** Runs git in `root` with the location vars scrubbed; never throws (P6). */
function runHygieneGit(root: string, args: string[]): Promise<{ stdout: string; ok: boolean }> {
  return new Promise((resolve) => {
    const opts: ExecFileOptions = {
      cwd: root,
      env: { ...scrubbedGitEnv(), GIT_OPTIONAL_LOCKS: '0' },
      maxBuffer: GIT_MAX_BUFFER,
    };
    execFile('git', args, opts, (err, stdout) => {
      const s = typeof stdout === 'string' ? stdout : stdout?.toString() ?? '';
      resolve({ stdout: s, ok: !err });
    });
  });
}


const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Signals on the added (`+`) lines of a unified=0 diff, numbered new-side (P6). */
function scanDiffAddedLines(file: string, diff: string): HygieneSignal[] {
  const signals: HygieneSignal[] = [];
  let newLine = 0;
  for (const line of diff.split('\n')) {
    const hunk = HUNK_HEADER_RE.exec(line);
    if (hunk) {
      newLine = Number.parseInt(hunk[1], 10);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const content = line.slice(1);
      for (const { pattern, regex } of PATTERNS) {
        if (regex.test(content)) {
          const trimmed = content.trim();
          const text = trimmed.length > MAX_TEXT_LENGTH ? trimmed.slice(0, MAX_TEXT_LENGTH) : trimmed;
          signals.push({ file, line: newLine, pattern, text });
        }
      }
      newLine++;
    }
  }
  return signals;
}

/**
 * Scans a file's added lines over the range. A tracked file unchanged in the
 * range yields nothing; a new (untracked) file is scanned whole, since all of its
 * lines are added; a git failure falls back to the whole-file scan (P6).
 */
async function scanRangedFile(
  file: string,
  range: { root: string; base: string[] },
): Promise<HygieneSignal[]> {
  const rel = path.relative(range.root, file);
  const diff = await runHygieneGit(range.root, ['diff', '--unified=0', ...range.base, '--', rel]);
  if (!diff.ok) return scanFile(file);
  if (diff.stdout.trim().length > 0) return scanDiffAddedLines(file, diff.stdout);
  const tracked = await runHygieneGit(range.root, ['ls-files', '--error-unmatch', '--', rel]);
  return tracked.ok ? [] : scanFile(file);
}

/**
 * Hygiene signals for `files`. A ranged call scans only the added lines of the
 * range (`git diff --unified=0 <base> -- <file>`); a files-only call scans each
 * whole file (P6).
 */
export async function computeHygieneSignals(
  files: string[],
  range?: { root: string; base: string[] },
): Promise<HygieneSignal[]> {
  const { kept } = partitionPaths(files);
  const results = await Promise.all(
    kept.map((f) => (range ? scanRangedFile(f, range) : scanFile(f))),
  );
  return results.flat();
}

