import { existsSync, readdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { controllerHome } from '../controller/state.js';
import { runCases } from './runner.js';
import { selectCases } from './select.js';
import { runGate } from './gate.js';

export interface MainOpts {
  casesRoot?: string;
  home?: string;
}

const USAGE = [
  'usage: eval [--live-checkout <dir>] [<id> ...]',
  '       eval select --repo <dir> --base <sha> --target <sha> [--provisional] [--base-dist <dir>]',
  '       eval gate --repo <dir> --base <sha> --target <sha> [--base-dist <dir>] --summary-file <path> [--override <id>]...',
].join('\n');

function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..');
}

function usageError(): number {
  console.log(USAGE);
  return 2;
}

interface ParsedRun {
  liveCheckout?: string;
  ids: string[];
}

/** `[--live-checkout <dir>] [<id> ...]`; `null` for an unknown flag or a missing value. */
function parseRun(argv: string[]): ParsedRun | null {
  let liveCheckout: string | undefined;
  const ids: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok === '--live-checkout') {
      const value = argv[i + 1];
      if (value === undefined) return null;
      liveCheckout = value;
      i += 2;
    } else if (tok.startsWith('--')) {
      return null;
    } else {
      ids.push(tok);
      i += 1;
    }
  }
  return { liveCheckout, ids };
}

interface ParsedSelect {
  repo: string;
  base: string;
  target: string;
  provisional: boolean;
  baseDist?: string;
}

/** `--repo <dir> --base <sha> --target <sha> [--provisional] [--base-dist <dir>]`. */
function parseSelect(argv: string[]): ParsedSelect | null {
  let repo: string | undefined;
  let base: string | undefined;
  let target: string | undefined;
  let baseDist: string | undefined;
  let provisional = false;
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (tok === '--provisional') {
      provisional = true;
      i += 1;
      continue;
    }
    if (!['--repo', '--base', '--target', '--base-dist'].includes(tok)) return null;
    const value = argv[i + 1];
    if (value === undefined) return null;
    if (tok === '--repo') repo = value;
    else if (tok === '--base') base = value;
    else if (tok === '--target') target = value;
    else baseDist = value;
    i += 2;
  }
  if (!repo || !base || !target) return null;
  return { repo, base, target, provisional, baseDist };
}

interface ParsedGate {
  repo: string;
  base: string;
  target: string;
  baseDist?: string;
  summaryFile: string;
  overrides: string[];
}

/** `--repo <dir> --base <sha> --target <sha> [--base-dist <dir>] --summary-file <path> [--override <id>]...`. */
function parseGate(argv: string[]): ParsedGate | null {
  let repo: string | undefined;
  let base: string | undefined;
  let target: string | undefined;
  let baseDist: string | undefined;
  let summaryFile: string | undefined;
  const overrides: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const tok = argv[i];
    if (!['--repo', '--base', '--target', '--base-dist', '--summary-file', '--override'].includes(tok)) return null;
    const value = argv[i + 1];
    if (value === undefined) return null;
    if (tok === '--repo') repo = value;
    else if (tok === '--base') base = value;
    else if (tok === '--target') target = value;
    else if (tok === '--base-dist') baseDist = value;
    else if (tok === '--summary-file') summaryFile = value;
    else overrides.push(value);
    i += 2;
  }
  if (!repo || !base || !target || !summaryFile) return null;
  return { repo, base, target, baseDist, summaryFile, overrides };
}

async function runRun(argv: string[], opts: MainOpts): Promise<number> {
  const parsed = parseRun(argv);
  if (!parsed) return usageError();

  const liveCheckout = parsed.liveCheckout ?? packageRoot();
  const home = opts.home ?? controllerHome();
  const resultsDir = join(home, 'evals', 'results');
  const before = existsSync(resultsDir) ? new Set(readdirSync(resultsDir)) : new Set<string>();

  const record = await runCases(parsed.ids, {
    liveCheckout,
    home,
    casesRoot: opts.casesRoot,
    onLine: (line) => console.log(line),
  });

  const after = existsSync(resultsDir) ? readdirSync(resultsDir) : [];
  const newFile = after.find((f) => !before.has(f));
  if (newFile) console.log(join(resultsDir, newFile));

  return record.cases.every((c) => c.verdict === 'pass') ? 0 : 1;
}

async function runSelect(argv: string[]): Promise<number> {
  const parsed = parseSelect(argv);
  if (!parsed) return usageError();

  const selected = await selectCases({
    repo: parsed.repo,
    base: parsed.base,
    target: parsed.target,
    mode: parsed.provisional ? 'provisional' : 'exact',
    baseDist: parsed.baseDist,
  });

  for (const s of selected) {
    const suffix = s.provisional ? ' (provisional)' : '';
    console.log(`select ${s.id}: ${s.reasons.join(', ')}${suffix}`);
  }

  return 0;
}

async function runGateCommand(argv: string[], opts: MainOpts): Promise<number> {
  const parsed = parseGate(argv);
  if (!parsed) return usageError();

  const result = await runGate({
    repo: parsed.repo,
    base: parsed.base,
    target: parsed.target,
    baseDist: parsed.baseDist,
    overrides: parsed.overrides,
    summaryFile: parsed.summaryFile,
    casesRoot: opts.casesRoot,
    home: opts.home,
  });

  return result.exit;
}

/**
 * The built package's own entry for the eval runner (design Component 9, R2 AC9, R3 AC7):
 * its own entry because `src/index.ts` rejects unknown flags.
 */
export async function main(argv: string[], opts: MainOpts = {}): Promise<number> {
  delete process.env.SDD_RUN_ID;
  delete process.env.SDD_STEP_ID;

  const [first, ...rest] = argv;
  if (first === 'select') return runSelect(rest);
  if (first === 'gate') return runGateCommand(rest, opts);
  return runRun(argv, opts);
}

function resolveEntrypoint(pathValue: string | undefined): string | undefined {
  if (!pathValue) return undefined;
  return resolve(pathValue);
}

const entrypoint = resolveEntrypoint(process.argv[1]);
const currentFile = resolveEntrypoint(fileURLToPath(import.meta.url));

if (entrypoint && currentFile && currentFile === entrypoint) {
  main(process.argv.slice(2)).then((exit) => {
    process.exit(exit);
  });
}
