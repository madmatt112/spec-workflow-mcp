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
  '--row-h-comfortable', '--row-h',
  '--panel-w', '--content-max',
  '--text-display', '--text-display--line-height',
  '--text-tile', '--text-tile--line-height',
  '--tile-pad', '--tile-gap', '--band-gap',
];

// Baseline values at tokens.css:9-17 (design C12, requirement 11.2: these
// steps keep their values while the tile tokens are added).
const BASE_TEXT_SCALE: Record<string, string> = {
  '--text-xs': '11px',
  '--text-xs--line-height': '16px',
  '--text-sm': '12px',
  '--text-sm--line-height': '18px',
  '--text-base': '14px',
  '--text-base--line-height': '20px',
  '--text-lg': '16px',
  '--text-lg--line-height': '24px',
};

// Baseline colour values at tokens.css:61-160 (requirement 11 AC 1: every
// colour value stays unchanged while the tile tokens are added).
const BASE_LIGHT_COLOURS: Record<string, string> = {
  '--surface-base': '#fcfcfc',
  '--surface-panel': '#ffffff',
  '--surface-inset': '#f4f5f7',
  '--surface-hover': '#f0f0f3',
  '--surface-selected': '#ecedfa',
  '--surface-overlay': '#ffffff',
  '--text-primary': '#282a30',
  '--text-secondary': '#4b505a',
  '--text-muted': '#646975',
  '--text-on-accent': '#ffffff',
  '--border-default': '#e8e8ec',
  '--border-strong': '#80858f',
  '--accent': '#5e6ad2',
  '--accent-solid': '#5e6ad2',
  '--accent-solid-hover': '#4f5bc4',
  '--danger-solid': '#c93b40',
  '--danger-solid-hover': '#b0333a',
  '--focus-ring': '#5e6ad2',
  '--focus-ring-on-solid': '#000000',
  '--tone-success-fg': '#1f7a48',
  '--tone-success-bg': '#e6f3ec',
  '--tone-warning-fg': '#8a5a00',
  '--tone-warning-bg': '#f7eedb',
  '--tone-danger-fg': '#c4343a',
  '--tone-danger-bg': '#fce9ea',
  '--tone-info-fg': '#1f63b8',
  '--tone-info-bg': '#e5effa',
  '--tone-accent-fg': '#4f5bc4',
  '--tone-accent-bg': '#ecedfa',
  '--tone-neutral-fg': '#646975',
  '--tone-neutral-bg': '#f4f5f7',
  '--chart-1': '#2a78d6',
  '--chart-2': '#d5561f',
  '--chart-3': '#138a5f',
  '--chart-4': '#b07800',
  '--chart-5': '#8e4ec6',
  '--chart-6': '#0e7c86',
  '--scrim': 'rgb(0 0 0 / 0.4)',
  '--shadow-overlay': '0 4px 16px rgb(0 0 0 / 0.12)',
};

const BASE_DARK_COLOURS: Record<string, string> = {
  '--surface-base': '#0f1011',
  '--surface-panel': '#121314',
  '--surface-inset': '#1b1d21',
  '--surface-hover': '#1f2126',
  '--surface-selected': '#21223a',
  '--surface-overlay': '#18191b',
  '--text-primary': '#e3e4e6',
  '--text-secondary': '#b4b7bd',
  '--text-muted': '#8a8f98',
  '--text-on-accent': '#ffffff',
  '--border-default': '#23252a',
  '--border-strong': '#6a6f7b',
  '--accent': '#7170ff',
  '--accent-solid': '#5b5bd6',
  '--accent-solid-hover': '#4c4cc4',
  '--danger-solid': '#c62f35',
  '--danger-solid-hover': '#a8282e',
  '--focus-ring': '#7170ff',
  '--focus-ring-on-solid': '#ffffff',
  '--tone-success-fg': '#4cb782',
  '--tone-success-bg': '#1b2d26',
  '--tone-warning-fg': '#f2c94c',
  '--tone-warning-bg': '#312c1c',
  '--tone-danger-fg': '#f06a6a',
  '--tone-danger-bg': '#351e1f',
  '--tone-info-fg': '#5b9cf0',
  '--tone-info-bg': '#182635',
  '--tone-accent-fg': '#8f8fff',
  '--tone-accent-bg': '#21223a',
  '--tone-neutral-fg': '#8a8f98',
  '--tone-neutral-bg': '#1b1d21',
  '--chart-1': '#3987e5',
  '--chart-2': '#d95926',
  '--chart-3': '#199e70',
  '--chart-4': '#c98500',
  '--chart-5': '#a56de2',
  '--chart-6': '#1fa3ad',
  '--scrim': 'rgb(0 0 0 / 0.6)',
  '--shadow-overlay': '0 4px 16px rgb(0 0 0 / 0.5)',
};

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

  // Contract for dashboard-board task 17 (design C12; Requirement 1.5,
  // 11.2). Pre-condition: tokens.css at base still declares both
  // `--sidebar-w` (:56) and `--row-h-compact` (:53) inside `@theme static`.
  // Call: `declaredNames(themeBlock)`, the same reader every other test in
  // this file uses. Observable: neither name is a member of the returned
  // Set. Source of the expected value: design C12 ("Delete `--sidebar-w`
  // and `--row-h-compact`") and Requirement 11.2 ("`--sidebar-w` SHALL
  // go"). Red now because both names are still declared at base.
  it('no longer declares --sidebar-w or --row-h-compact in @theme static', () => {
    const themeNames = declaredNames(themeBlock);
    expect(themeNames.has('--sidebar-w')).toBe(false);
    expect(themeNames.has('--row-h-compact')).toBe(false);
  });

  it('declares every Data Models theme-independent token in @theme static', () => {
    const themeNames = declaredNames(themeBlock);
    const missing = THEME_INDEPENDENT_NAMES.filter((n) => !themeNames.has(n));
    expect(missing).toEqual([]);
  });

  it('gives --text-display a size of at least 32px and --text-tile a size of at least 14px (Requirement 11.2)', () => {
    const values = declaredValues(themeBlock);
    const displayPx = parseFloat(values.get('--text-display') ?? '');
    const tilePx = parseFloat(values.get('--text-tile') ?? '');
    expect(displayPx).toBeGreaterThanOrEqual(32);
    expect(tilePx).toBeGreaterThanOrEqual(14);
  });

  it('keeps the type-scale steps at tokens.css:9-17 unchanged while the tile tokens are added (Requirement 11.2)', () => {
    const values = declaredValues(themeBlock);
    const actual: Record<string, string | undefined> = {};
    for (const name of Object.keys(BASE_TEXT_SCALE)) {
      actual[name] = values.get(name);
    }
    expect(actual).toEqual(BASE_TEXT_SCALE);
  });

  it('keeps every colour value at tokens.css:61-160 unchanged while the tile tokens are added (Requirement 11 AC 1)', () => {
    const lightValues = declaredValues(rootBlock);
    const darkValues = declaredValues(darkBlock);
    const actualLight: Record<string, string | undefined> = {};
    const actualDark: Record<string, string | undefined> = {};
    for (const name of THEME_TOKEN_NAMES) {
      actualLight[name] = lightValues.get(name);
      actualDark[name] = darkValues.get(name);
    }
    expect(actualLight).toEqual(BASE_LIGHT_COLOURS);
    expect(actualDark).toEqual(BASE_DARK_COLOURS);
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
