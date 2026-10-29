import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Contract for dashboard-visual-refresh task 2 (design C1, C7 T3; Requirement
// 1.3): once the token-namespace clears land in tokens.css, each name it
// declares carries exactly one value per theme in the real, built stylesheet
// — one declaration in Tailwind's theme layer for a theme-independent name, or
// one in `:root` and one in `.dark` for a theme-varying name, never more.
// Red on base: tokens.css does not exist, so the theme-name classification
// below throws before the build assertion runs; separately, the base build
// (probed in codebase-context.md) carries two `--text-sm` and two
// `--radius-md` declarations (Tailwind's own default plus theme.css's),
// which this same count-based check would also catch once tokens.css exists
// without the namespace clears.

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const VITE_BIN = join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const VITE_CONFIG = join(REPO_ROOT, 'src', 'dashboard_frontend', 'vite.config.ts');
const TOKENS_PATH = join(REPO_ROOT, 'src', 'dashboard_frontend', 'src', 'modules', 'theme', 'tokens.css');

/** Same brace-matching reader as frontend-tokens.test.ts (no CSS parser
 *  package, Requirement 6.6); duplicated rather than shared because each
 *  vitest file here is self-contained. */
function extractBlock(css: string, headerPattern: RegExp, label: string): string {
  const headerMatch = headerPattern.exec(css);
  if (!headerMatch) {
    throw new Error(`tokens.css has no ${label} block`);
  }
  const openIndex = css.indexOf('{', headerMatch.index);
  if (openIndex === -1) {
    throw new Error(`tokens.css's ${label} header has no opening brace`);
  }
  let depth = 0;
  let i = openIndex;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) {
    throw new Error(`tokens.css's ${label} block has no matching closing brace`);
  }
  return css.slice(openIndex + 1, i);
}

function declaredNames(block: string): string[] {
  const names = new Set<string>();
  const re = /--([a-zA-Z0-9-]+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    names.add('--' + m[1]);
  }
  return [...names];
}

function escapeForRegExp(literal: string): string {
  return literal.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/** How many times `--name:` is declared anywhere in the built stylesheet.
 *  `var(--name)`, `var(--name, fallback)` and the `(--name)` shorthand never
 *  match: the character immediately after the name is `)` or `,`, never `:`. */
function declarationCount(css: string, name: string): number {
  const re = new RegExp(`${escapeForRegExp(name)}\\s*:`, 'g');
  return (css.match(re) ?? []).length;
}

describe('dashboard build', () => {
  let builtCss: string;
  let independentNames: string[];
  let varyingNames: string[];

  beforeAll(() => {
    const tokensSrc = readFileSync(TOKENS_PATH, 'utf-8');
    const themeBlock = extractBlock(tokensSrc, /@theme\s+static\s*\{/, '@theme static');
    const rootBlock = extractBlock(tokensSrc, /(^|\n)\s*:root\s*\{/, ':root');
    independentNames = declaredNames(themeBlock);
    varyingNames = declaredNames(rootBlock);

    const outDir = mkdtempSync(join(tmpdir(), 'dashboard-build-'));
    try {
      const result = spawnSync(
        process.execPath,
        [VITE_BIN, 'build', '--config', VITE_CONFIG, '--outDir', outDir, '--emptyOutDir'],
        { cwd: REPO_ROOT, timeout: 120000, encoding: 'utf-8' },
      );
      const { status, stdout, stderr } = result;
      if (status !== 0) {
        const tail = (stderr ?? stdout ?? '').slice(-2000);
        throw new Error(`vite build exited with status ${status}:\n${tail}`);
      }
      const assetsDir = join(outDir, 'assets');
      const cssFile = readdirSync(assetsDir).find((f) => f.endsWith('.css'));
      if (!cssFile) {
        throw new Error(`no built .css file found under ${assetsDir}`);
      }
      builtCss = readFileSync(join(assetsDir, cssFile), 'utf-8');
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  }, 130_000);

  it('gives every theme-independent token name exactly one declaration', () => {
    const offenders = independentNames
      .map((name) => ({ name, count: declarationCount(builtCss, name) }))
      .filter(({ count }) => count !== 1);
    expect(offenders).toEqual([]);
  });

  it('gives every theme-varying token name exactly two declarations (light and dark)', () => {
    const offenders = varyingNames
      .map((name) => ({ name, count: declarationCount(builtCss, name) }))
      .filter(({ count }) => count !== 2);
    expect(offenders).toEqual([]);
  });
});
