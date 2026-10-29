import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Contract for dashboard-visual-refresh task 2 (design C1, C7 T2; Requirement
// 3.1, NFR Accessibility, and the task's own "every Data Models name declared"
// instruction supporting Requirement 1.1). tokens.css does not exist at base,
// so every test here is red-first by construction (design: "Red on base:
// tokens.css does not exist").
//
// A small brace-matching reader (no CSS parser package, Requirement 6.6)
// extracts the three top-level blocks tokens.css declares in order: the
// `@theme static { ... }` block (theme-independent tokens), the `:root { ... }`
// block (light colour/shadow tokens) and the `.dark { ... }` block (dark
// colour/shadow tokens).

const TOKENS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'dashboard_frontend',
  'src',
  'modules',
  'theme',
  'tokens.css',
);

/** Finds `headerPattern`'s first match, then returns the text between the
 *  next `{` and its matching `}` (brace-depth counted, not regex-bounded). */
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

/** Every custom-property *name* declared directly in a block (a namespace
 *  clear like `--color-*: initial;` never matches: the `*` breaks the
 *  character class immediately before the required `:`). */
function declaredNames(block: string): Set<string> {
  const names = new Set<string>();
  const re = /--([a-zA-Z0-9-]+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    names.add('--' + m[1]);
  }
  return names;
}

/** Every custom-property name declared in a block, mapped to its raw value
 *  text (used for the colour pairs; clears are excluded the same way). */
function declaredValues(block: string): Map<string, string> {
  const values = new Map<string, string>();
  const re = /--([a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    values.set('--' + m[1], m[2].trim());
  }
  return values;
}

function hexToLinearChannels(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`"${hex}" is not a #rrggbb colour`);
  }
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  return channels.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))) as [
    number,
    number,
    number,
  ];
}

/** WCAG 2.1 relative luminance (§1.4.3/1.4.11 formula). */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinearChannels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, lighter over darker. */
function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function cross(fgs: string[], bgs: string[], min: number): Array<{ fg: string; bg: string; min: number }> {
  return fgs.flatMap((fg) => bgs.map((bg) => ({ fg, bg, min })));
}

// Every Data Models name (design "Data Models" section).
const THEME_INDEPENDENT_NAMES = [
  '--font-sans', '--font-mono',
  '--text-xs', '--text-xs--line-height',
  '--text-sm', '--text-sm--line-height',
  '--text-base', '--text-base--line-height',
  '--text-lg', '--text-lg--line-height',
  '--font-weight-normal', '--font-weight-medium', '--font-weight-semibold', '--font-weight-bold',
  '--leading-tight', '--leading-normal', '--tracking-wide',
  '--spacing',
  '--radius-sm', '--radius-md', '--radius-lg', '--radius-full',
  '--border-width',
  '--focus-ring-width', '--focus-ring-offset',
  '--default-transition-duration', '--default-transition-timing-function',
  '--disabled-opacity',
  '--row-h-comfortable', '--row-h-compact', '--row-h',
  '--sidebar-w', '--panel-w', '--content-max',
];

const THEME_TOKEN_NAMES = [
  '--surface-base', '--surface-panel', '--surface-inset', '--surface-hover', '--surface-selected', '--surface-overlay',
  '--text-primary', '--text-secondary', '--text-muted', '--text-on-accent',
  '--border-default', '--border-strong',
  '--accent', '--accent-solid', '--accent-solid-hover',
  '--danger-solid', '--danger-solid-hover',
  '--focus-ring', '--focus-ring-on-solid',
  '--tone-success-fg', '--tone-success-bg',
  '--tone-warning-fg', '--tone-warning-bg',
  '--tone-danger-fg', '--tone-danger-bg',
  '--tone-info-fg', '--tone-info-bg',
  '--tone-accent-fg', '--tone-accent-bg',
  '--tone-neutral-fg', '--tone-neutral-bg',
  '--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--chart-6',
  '--scrim', '--shadow-overlay',
];

const TONES = ['success', 'warning', 'danger', 'info', 'accent'];
const SURFACES = ['--surface-base', '--surface-panel', '--surface-inset', '--surface-hover', '--surface-selected', '--surface-overlay'];

// "Contrast pairs T2 checks (both themes)" (design Data Models).
const CONTRAST_PAIRS: Array<{ fg: string; bg: string; min: number }> = [
  ...cross(['--text-primary', '--text-secondary', '--text-muted'], SURFACES, 4.5),
  { fg: '--accent', bg: '--surface-base', min: 4.5 },
  { fg: '--accent', bg: '--surface-panel', min: 4.5 },
  ...cross(['--text-on-accent'], ['--accent-solid', '--accent-solid-hover', '--danger-solid', '--danger-solid-hover'], 4.5),
  ...TONES.flatMap((t) => [
    { fg: `--tone-${t}-fg`, bg: `--tone-${t}-bg`, min: 4.5 },
    { fg: `--tone-${t}-fg`, bg: '--surface-panel', min: 4.5 },
  ]),
  { fg: '--tone-danger-fg', bg: '--surface-base', min: 4.5 },
  ...cross(['--focus-ring', '--border-strong'], ['--surface-base', '--surface-panel', '--surface-inset', '--surface-overlay'], 3),
  { fg: '--focus-ring', bg: '--surface-hover', min: 3 },
  { fg: '--focus-ring', bg: '--surface-selected', min: 3 },
  ...cross(['--focus-ring-on-solid'], ['--accent-solid', '--accent-solid-hover', '--danger-solid', '--danger-solid-hover'], 3),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ fg: `--chart-${n}`, bg: '--surface-panel', min: 3 })),
];

describe('tokens.css', () => {
  let themeBlock: string;
  let rootBlock: string;
  let darkBlock: string;

  beforeAll(() => {
    const css = readFileSync(TOKENS_PATH, 'utf-8');
    themeBlock = extractBlock(css, /@theme\s+static\s*\{/, '@theme static');
    rootBlock = extractBlock(css, /(^|\n)\s*:root\s*\{/, ':root');
    darkBlock = extractBlock(css, /(^|\n)\s*\.dark\s*\{/, '.dark');
  });

  it('declares the same set of custom-property names in :root and .dark', () => {
    const rootNames = [...declaredNames(rootBlock)].sort();
    const darkNames = [...declaredNames(darkBlock)].sort();
    expect(darkNames).toEqual(rootNames);
  });

  it('keeps the @theme static block disjoint from the :root and .dark names', () => {
    const themeNames = declaredNames(themeBlock);
    const colourNames = new Set([...declaredNames(rootBlock), ...declaredNames(darkBlock)]);
    const overlap = [...themeNames].filter((n) => colourNames.has(n));
    expect(overlap).toEqual([]);
  });

  it('declares every Data Models theme-independent token in @theme static', () => {
    const themeNames = declaredNames(themeBlock);
    const missing = THEME_INDEPENDENT_NAMES.filter((n) => !themeNames.has(n));
    expect(missing).toEqual([]);
  });

  it('declares every Data Models theme token in both :root and .dark', () => {
    const rootNames = declaredNames(rootBlock);
    const darkNames = declaredNames(darkBlock);
    const missingLight = THEME_TOKEN_NAMES.filter((n) => !rootNames.has(n));
    const missingDark = THEME_TOKEN_NAMES.filter((n) => !darkNames.has(n));
    expect({ missingLight, missingDark }).toEqual({ missingLight: [], missingDark: [] });
  });

  it('meets every Data Models contrast pair at 4.5:1 or 3:1 in the light theme', () => {
    const values = declaredValues(rootBlock);
    for (const pair of CONTRAST_PAIRS) {
      const fg = values.get(pair.fg);
      const bg = values.get(pair.bg);
      expect(fg, `light ${pair.fg} is declared`).toBeDefined();
      expect(bg, `light ${pair.bg} is declared`).toBeDefined();
      const ratio = contrastRatio(fg as string, bg as string);
      expect(ratio, `light ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}, needs ${pair.min}`).toBeGreaterThanOrEqual(
        pair.min,
      );
    }
  });

  it('meets every Data Models contrast pair at 4.5:1 or 3:1 in the dark theme', () => {
    const values = declaredValues(darkBlock);
    for (const pair of CONTRAST_PAIRS) {
      const fg = values.get(pair.fg);
      const bg = values.get(pair.bg);
      expect(fg, `dark ${pair.fg} is declared`).toBeDefined();
      expect(bg, `dark ${pair.bg} is declared`).toBeDefined();
      const ratio = contrastRatio(fg as string, bg as string);
      expect(ratio, `dark ${pair.fg} on ${pair.bg} is ${ratio.toFixed(2)}, needs ${pair.min}`).toBeGreaterThanOrEqual(
        pair.min,
      );
    }
  });
});
