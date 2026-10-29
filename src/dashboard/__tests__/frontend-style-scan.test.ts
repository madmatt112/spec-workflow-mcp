import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { dirname, join, relative, basename, sep } from 'path';
import { fileURLToPath } from 'url';

// Contract for dashboard-visual-refresh task 5 (design C7 T1; Requirements
// 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.2). T1 itself is the deliverable the task
// names (design: "the regexes are in the prototype ... the tasks author
// copies them in"), so this file both defines the scanner and proves it
// against the real tree. Every frontend file this test reads is read as
// text (`fs.readFileSync`), never imported, so the frontend stays outside
// `npx tsc --noEmit`'s program (tasks.md Scope notes: "Frontend type
// checking stays absent"; `./tsconfig.json` excludes `src/dashboard_frontend/**`).
//
// Two kinds of test live here:
//  - rule tests feed a synthetic line straight to scanFile(), pinning the
//    exact matched-text/line/rule triple the design and Reference section
//    specify for each rule (pre-condition: a fixture line carrying one
//    violation of that kind; call: scanFile on that fixture; observable:
//    the returned Hit[]; source: design C7 T1 and the tasks.md Reference
//    regexes/rule list, copied unchanged per task instruction).
//  - the aggregate test (pre-condition: the real FE tree as tasks 2-4 leave
//    it; call: walking FE_ROOT through scanFile; observable: zero hits;
//    source: Requirement 2.1/2.3) and the Usage trend test (pre-condition:
//    UsageTrend.tsx's own source; call: reading its SERIES declaration;
//    observable: the six values are var(--chart-1)..var(--chart-6) in
//    order; source: Requirement 2.4/design C6) run against the real,
//    unmodified FE source, so they are red now for the same reason design
//    cites for T2/T3: the task-5 sweep (bridge removal, UsageTrend/RunPage
//    fixes) has not happened yet.

const HERE = dirname(fileURLToPath(import.meta.url));
const FE_ROOT = join(HERE, '..', '..', 'dashboard_frontend', 'src');
const TOKENS_PATH = join(FE_ROOT, 'modules', 'theme', 'tokens.css');

// ---- tokens.css reader (brace-matching, no CSS parser package) ----------

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

/** Every custom-property name declared directly in a block; a namespace
 *  clear (`--color-*: initial;`) never matches, the `*` breaks the
 *  character class immediately before the required `:`. */
function declaredNames(block: string): Set<string> {
  const names = new Set<string>();
  const re = /--([a-zA-Z0-9-]+)\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    names.add('--' + m[1]);
  }
  return names;
}

/** The suffix vocabulary a namespace declares, e.g. `--radius-md` under
 *  prefix `--radius-` gives `md`. A name whose remainder still contains
 *  `--` (a line-height companion such as `--text-xs--line-height`) is not
 *  a utility suffix and is skipped. */
function suffixSet(names: Set<string>, prefix: string, excludePrefixes: string[] = []): Set<string> {
  const out = new Set<string>();
  for (const n of names) {
    if (!n.startsWith(prefix)) continue;
    if (excludePrefixes.some((p) => n.startsWith(p))) continue;
    const rest = n.slice(prefix.length);
    if (!rest || rest.includes('--')) continue;
    out.add(rest);
  }
  return out;
}

interface Declared {
  allNames: Set<string>;
  textSizes: Set<string>;
  radii: Set<string>;
  shadows: Set<string>;
  fontWeights: Set<string>;
  fontFamilies: Set<string>;
  leadings: Set<string>;
}

function buildDeclared(tokensCss: string): Declared {
  const themeBlock = extractBlock(tokensCss, /@theme\s+static\s*\{/, '@theme static');
  const rootBlock = extractBlock(tokensCss, /(^|\n)\s*:root\s*\{/, ':root');
  const darkBlock = extractBlock(tokensCss, /(^|\n)\s*\.dark\s*\{/, '.dark');
  const themeNames = declaredNames(themeBlock);
  const allNames = new Set<string>([...themeNames, ...declaredNames(rootBlock), ...declaredNames(darkBlock)]);
  return {
    allNames,
    textSizes: suffixSet(themeNames, '--text-'),
    radii: suffixSet(themeNames, '--radius-'),
    shadows: suffixSet(themeNames, '--shadow-'),
    fontWeights: suffixSet(themeNames, '--font-weight-'),
    fontFamilies: suffixSet(themeNames, '--font-', ['--font-weight-']),
    leadings: suffixSet(themeNames, '--leading-'),
  };
}

// ---- the scan rules (tasks.md Reference section, ported unchanged, plus
//      the remaining design C7 T1 rules the task-5 prompt names) ---------

const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const COLOUR_FN = /\b(?:rgba?|hsla?|oklch)\(/g;
const COLOR_MIX_LITERAL = /color-mix\([^)]*?(?:#[0-9a-fA-F]{3,8}|\b(?:rgba?|hsla?|oklch)\()/g;
const PALETTE_CLASS =
  /(?<![\w-])(?:[a-z-]+:)*(?:text|bg|border|ring|outline|fill|stroke|from|to|via|divide|placeholder|decoration|accent|caret|shadow)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})(?:\/\d+)?(?![\w-])/g;
const VAR_FALLBACK_LITERAL = /var\(--[\w-]+\s*,\s*(?:#|rgba?\(|hsla?\(|[a-z]+\()/g;
const ARBITRARY_LENGTH = /(?<![\w-])(?:[a-z-]+:)*[a-z-]+-\[-?\d*\.?\d+(?:px|rem|em|vh|vw|%)\]/g;
const DARK_VARIANT = /(?<![\w-])dark:[\w-]/g;

// `var(--name)` or the `(--name)` shorthand, wherever the name is the first
// thing inside a `(` and the next non-space character closes or separates it.
const VAR_NAME_REF = /\(\s*--([a-zA-Z0-9-]+)\s*[,)]/g;

const CSS_CUSTOM_PROP_DECL = /(?<![\w-])--[a-zA-Z0-9-]+\s*:/;
const SET_PROPERTY_CALL = /setProperty\(\s*(['"])--([a-zA-Z0-9-]+)\1/;
const CLASS_SELECTOR = /\.[a-zA-Z][\w-]*(?=\s*[,{])/g;

const TEXT_SIZE_VOCAB = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
const RADIUS_VOCAB = ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', 'full'];
const SHADOW_VOCAB = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none'];
const FONT_WEIGHT_VOCAB = ['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black'];
const FONT_FAMILY_VOCAB = ['sans', 'serif', 'mono'];
const LEADING_VOCAB = ['none', 'tight', 'snug', 'normal', 'relaxed', 'loose'];

function utilityRegex(prefix: string, vocab: string[]): RegExp {
  return new RegExp(`(?<![\\w-])(?:[a-z0-9-]+:)*${prefix}-(${vocab.join('|')})(?![\\w-])`, 'g');
}
function bareUtilityRegex(word: string): RegExp {
  return new RegExp(`(?<![\\w-])(?:[a-z0-9-]+:)*${word}(?![\\w-])`, 'g');
}

interface Hit {
  file: string;
  line: number;
  rule: string;
  text: string;
}

function scanLine(file: string, lineNo: number, line: string, declared: Declared, checkClassSelector: boolean): Hit[] {
  const hits: Hit[] = [];
  const push = (rule: string, text: string) => hits.push({ file, line: lineNo, rule, text });

  for (const m of line.matchAll(HEX)) push('hex', m[0]);
  for (const m of line.matchAll(COLOUR_FN)) push('colour-fn', m[0]);
  for (const m of line.matchAll(COLOR_MIX_LITERAL)) push('color-mix-literal', m[0]);
  for (const m of line.matchAll(PALETTE_CLASS)) push('palette-class', m[0]);
  for (const m of line.matchAll(VAR_FALLBACK_LITERAL)) push('var-fallback-literal', m[0]);
  for (const m of line.matchAll(ARBITRARY_LENGTH)) push('arbitrary-length', m[0]);
  for (const m of line.matchAll(DARK_VARIANT)) push('dark-variant', m[0]);

  const styleMatch = line.match(/style=\{\{[^}]*\}\}/);
  if (styleMatch && /\d(?:px|rem)\b/.test(styleMatch[0])) push('inline-length', styleMatch[0]);

  for (const m of line.matchAll(VAR_NAME_REF)) {
    if (!declared.allNames.has('--' + m[1])) push('undeclared-var', m[0].trim());
  }

  const declMatch = CSS_CUSTOM_PROP_DECL.exec(line);
  if (declMatch) push('custom-property-outside', declMatch[0]);
  const setMatch = SET_PROPERTY_CALL.exec(line);
  if (setMatch && setMatch[2] !== 'row-h') push('custom-property-outside', setMatch[0]);

  if (checkClassSelector) {
    for (const m of line.matchAll(CLASS_SELECTOR)) {
      if (m[0] !== '.dark') push('class-selector', m[0]);
    }
  }

  const utilityChecks: Array<[RegExp, Set<string>]> = [
    [utilityRegex('text', TEXT_SIZE_VOCAB), declared.textSizes],
    [utilityRegex('rounded', RADIUS_VOCAB), declared.radii],
    [utilityRegex('shadow', SHADOW_VOCAB), declared.shadows],
    [utilityRegex('font', FONT_WEIGHT_VOCAB), declared.fontWeights],
    [utilityRegex('font', FONT_FAMILY_VOCAB), declared.fontFamilies],
    [utilityRegex('leading', LEADING_VOCAB), declared.leadings],
  ];
  for (const [re, declaredSet] of utilityChecks) {
    for (const m of line.matchAll(re)) {
      if (!declaredSet.has(m[1])) push('undeclared-utility', m[0]);
    }
  }
  for (const bareWord of ['rounded', 'shadow']) {
    for (const m of line.matchAll(bareUtilityRegex(bareWord))) push('undeclared-utility', m[0]);
  }

  return hits;
}

function scanFile(file: string, text: string, declared: Declared): Hit[] {
  const base = basename(file);
  const checkClassSelector = base === 'tailwind.css' || base === 'theme.css';
  const hits: Hit[] = [];
  text.split('\n').forEach((line, i) => {
    hits.push(...scanLine(file, i + 1, line, declared, checkClassSelector));
  });
  return hits;
}

function formatHits(hits: Hit[]): string {
  return hits.map((h) => `${h.file}:${h.line} ${h.rule} ${h.text}`).join('\n');
}

const EXEMPT_RELATIVE_PATHS = new Set(['modules/theme/tokens.css', 'assets/fonts/fonts.css']);
function isScannable(relPath: string): boolean {
  return !EXEMPT_RELATIVE_PATHS.has(relPath);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(p);
  }
  return out;
}

describe('frontend-style-scan (design C7 T1)', () => {
  let declared: Declared;

  beforeAll(() => {
    declared = buildDeclared(readFileSync(TOKENS_PATH, 'utf-8'));
  });

  describe('exempt files (Requirement 2.1)', () => {
    it('exempts only tokens.css and fonts.css; every other ts/tsx/css path under FE is scannable', () => {
      expect(isScannable('modules/theme/tokens.css')).toBe(false);
      expect(isScannable('assets/fonts/fonts.css')).toBe(false);
      expect(isScannable('modules/theme/tailwind.css')).toBe(true);
      expect(isScannable('modules/shell/NowPage.tsx')).toBe(true);
    });
  });

  describe('rule: hex colour literal (Requirement 2.1)', () => {
    it('flags a hex colour literal, naming the file, line and matched text', () => {
      const hits = scanFile('modules/shell/Fixture.tsx', 'const bg = { background: "#1a2b3c" };', declared);
      expect(hits).toEqual([{ file: 'modules/shell/Fixture.tsx', line: 1, rule: 'hex', text: '#1a2b3c' }]);
    });
  });

  describe('rule: colour function, including a color-mix with a literal argument (Requirement 2.1)', () => {
    it('flags rgb/rgba/hsl/hsla/oklch and a color-mix carrying a literal colour', () => {
      const rgba = scanFile('modules/shell/Fixture.tsx', "const c = 'rgba(0, 0, 0, 0.5)';", declared);
      expect(rgba.map((h) => h.rule)).toEqual(['colour-fn']);
      const oklch = scanFile('modules/shell/Fixture.tsx', "const c = 'oklch(0.5 0.1 200)';", declared);
      expect(oklch.map((h) => h.rule)).toEqual(['colour-fn']);
      const mixLiteral = scanFile(
        'modules/shell/Fixture.tsx',
        "const c = 'color-mix(in srgb, #ffffff 50%, transparent)';",
        declared,
      );
      expect(mixLiteral.map((h) => h.rule)).toContain('color-mix-literal');
    });

    it('does not flag a color-mix whose arguments are both custom properties', () => {
      const hits = scanFile(
        'modules/shell/Fixture.tsx',
        "const c = 'color-mix(in srgb, var(--accent) 50%, var(--surface-panel))';",
        declared,
      );
      expect(hits.filter((h) => h.rule === 'color-mix-literal')).toEqual([]);
    });
  });

  describe('rule: Tailwind palette colour class (Requirement 2.1)', () => {
    it('flags a named palette shade and the opacity form, with any colour-utility prefix', () => {
      const shade = scanFile('modules/shell/Fixture.tsx', 'className="text-amber-400"', declared);
      expect(shade).toEqual([{ file: 'modules/shell/Fixture.tsx', line: 1, rule: 'palette-class', text: 'text-amber-400' }]);
      const opacity = scanFile('modules/shell/Fixture.tsx', 'className="bg-black/50"', declared);
      expect(opacity).toEqual([{ file: 'modules/shell/Fixture.tsx', line: 1, rule: 'palette-class', text: 'bg-black/50' }]);
    });
  });

  describe('rule: var() fallback that is a literal colour, with the allowed keywords (Requirement 2.1)', () => {
    it('flags a literal-colour fallback but allows transparent, currentColor and inherit', () => {
      const flagged = scanFile('modules/shell/Fixture.tsx', 'var(--accent-danger, #dc2626)', declared);
      expect(flagged.map((h) => h.rule)).toContain('var-fallback-literal');
      const allowed = [
        'var(--scrim, transparent)',
        'var(--focus-ring, currentColor)',
        'var(--border-default, inherit)',
      ];
      for (const line of allowed) {
        const hits = scanFile('modules/shell/Fixture.tsx', line, declared);
        expect(hits.filter((h) => h.rule === 'var-fallback-literal'), line).toEqual([]);
      }
    });
  });

  describe('rule: arbitrary-value length class (Requirement 2.1)', () => {
    it('flags an arbitrary length class, matching the min-w-[7rem] site the design cites', () => {
      const hits = scanFile('modules/shell/RunPage.tsx', 'className="min-w-[7rem]"', declared);
      expect(hits).toEqual([{ file: 'modules/shell/RunPage.tsx', line: 1, rule: 'arbitrary-length', text: 'min-w-[7rem]' }]);
    });
  });

  describe('rule: dark: variant (Requirement 2.1, 3.2)', () => {
    it('flags a className dark: variant', () => {
      const hits = scanFile('modules/shell/Fixture.tsx', 'className="dark:text-amber-400"', declared);
      expect(hits.map((h) => h.rule)).toContain('dark-variant');
    });
  });

  describe('rule: pixel or rem literal in an inline style (Requirement 2.1)', () => {
    it('flags a px/rem literal inside style={{ ... }} but allows a dynamic percentage', () => {
      const flagged = scanFile('modules/shell/Fixture.tsx', "<div style={{ width: '10px' }} />", declared);
      expect(flagged.map((h) => h.rule)).toContain('inline-length');
      const allowed = scanFile('modules/shell/Fixture.tsx', "<div style={{ width: pct + '%' }} />", declared);
      expect(allowed.filter((h) => h.rule === 'inline-length')).toEqual([]);
    });
  });

  describe('rule: undeclared var() / (--name) reference (Requirement 1.4)', () => {
    it('flags a custom-property reference tokens.css does not declare, and allows a declared one', () => {
      const flagged = scanFile('modules/shell/Fixture.tsx', 'text-(--totally-fake-token)', declared);
      expect(flagged).toEqual([
        { file: 'modules/shell/Fixture.tsx', line: 1, rule: 'undeclared-var', text: '(--totally-fake-token)' },
      ]);
      const allowed = scanFile('modules/shell/Fixture.tsx', 'text-(--accent) w-(--sidebar-w)', declared);
      expect(allowed.filter((h) => h.rule === 'undeclared-var')).toEqual([]);
    });
  });

  describe('rule: custom-property declaration outside tokens.css (Requirement 1.1)', () => {
    it('flags a CSS declaration and a setProperty call naming a new custom property', () => {
      const cssDecl = scanFile('modules/theme/tailwind.css', '  --foo: red;', declared);
      expect(cssDecl.map((h) => h.rule)).toContain('custom-property-outside');
      const setCall = scanFile('modules/shell/Fixture.tsx', "el.style.setProperty('--foo', 'red');", declared);
      expect(setCall.map((h) => h.rule)).toContain('custom-property-outside');
    });

    it('exempts the row-height setProperty call ShellProvider.tsx makes', () => {
      const line =
        "document.documentElement.style.setProperty('--row-h', density === 'compact' ? 'var(--row-h-compact)' : 'var(--row-h-comfortable)');";
      const hits = scanFile('modules/shell/ShellProvider.tsx', line, declared);
      expect(hits.filter((h) => h.rule === 'custom-property-outside')).toEqual([]);
    });
  });

  describe('rule: class selector other than .dark in tailwind.css or a theme.css file (Requirement 1.5)', () => {
    it('flags a stray class rule in tailwind.css but allows .dark', () => {
      const hits = scanFile('modules/theme/tailwind.css', '.btn { color: red; }\n.dark { color-scheme: dark; }', declared);
      expect(hits).toEqual([{ file: 'modules/theme/tailwind.css', line: 1, rule: 'class-selector', text: '.btn' }]);
    });

    it('does not apply to a .tsx file', () => {
      const hits = scanFile('modules/shell/Fixture.tsx', '.btn { color: red; }', declared);
      expect(hits.filter((h) => h.rule === 'class-selector')).toEqual([]);
    });
  });

  describe('rule: undeclared text/rounded/shadow/font-weight/leading utility, plus bare rounded/shadow (Requirement 1.5)', () => {
    it('flags an undeclared size in each namespace and the bare forms, allowing the declared vocabulary', () => {
      const flaggedLines = [
        'className="text-2xl"',
        'className="rounded-xl"',
        'className="shadow-lg"',
        'className="rounded"',
        'className="shadow"',
        'className="font-extrabold"',
        'className="font-serif"',
        'className="leading-loose"',
      ];
      for (const line of flaggedLines) {
        const hits = scanFile('modules/shell/Fixture.tsx', line, declared);
        expect(hits.map((h) => h.rule), line).toContain('undeclared-utility');
      }
      const allowedLines = [
        'className="text-sm"',
        'className="rounded-md"',
        'className="font-semibold"',
        'className="font-sans"',
        'className="leading-tight"',
      ];
      for (const line of allowedLines) {
        const hits = scanFile('modules/shell/Fixture.tsx', line, declared);
        expect(hits.filter((h) => h.rule === 'undeclared-utility'), line).toEqual([]);
      }
    });
  });

  describe('message format (Requirement 2.2)', () => {
    it('names each offending file, line and matched text as one entry per hit', () => {
      const text = 'const a = "#111111";\nconst b = "min-w-[2px]";\n';
      const hits = scanFile('modules/shell/Fixture.tsx', text, declared);
      expect(hits).toEqual([
        { file: 'modules/shell/Fixture.tsx', line: 1, rule: 'hex', text: '#111111' },
        { file: 'modules/shell/Fixture.tsx', line: 2, rule: 'arbitrary-length', text: 'min-w-[2px]' },
      ]);
    });
  });

  describe('aggregate scan over FE (Requirement 2.1, 2.3)', () => {
    it('finds zero disallowed hits outside the token file and fonts.css', () => {
      const hits: Hit[] = [];
      for (const absPath of walk(FE_ROOT)) {
        const rel = relative(FE_ROOT, absPath).split(sep).join('/');
        if (!isScannable(rel)) continue;
        hits.push(...scanFile(rel, readFileSync(absPath, 'utf-8'), declared));
      }
      expect(hits, formatHits(hits)).toEqual([]);
    });
  });

  describe('Usage trend series colours (Requirement 2.4, design C6)', () => {
    it('declares SERIES as var(--chart-1) through var(--chart-6) in that order', () => {
      const text = readFileSync(join(FE_ROOT, 'modules', 'shell', 'UsageTrend.tsx'), 'utf-8');
      const match = text.match(/const SERIES\s*=\s*\[([^\]]*)\]/);
      expect(match, 'UsageTrend.tsx declares a SERIES array').not.toBeNull();
      const values = match![1]
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      expect(values).toEqual([
        'var(--chart-1)',
        'var(--chart-2)',
        'var(--chart-3)',
        'var(--chart-4)',
        'var(--chart-5)',
        'var(--chart-6)',
      ]);
    });
  });
});
