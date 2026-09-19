import { execFile, ExecFileOptions } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { partitionPaths } from './path-denylist.js';
import { scrubbedGitEnv } from './git-utils.js';

export type TypecheckDiagnostic = {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  inScope: boolean;
};

export type TypecheckResult =
  | {
      tsconfigPath: string;
      status: 'success';
      diagnostics: TypecheckDiagnostic[];
      coverage: { compiled: string[]; excluded: string[] };
      suppressedDenylistedFiles?: number;
      truncated?: boolean;
      typecheckWarning?: string;
    }
  | {
      tsconfigPath: string;
      status: 'unavailable';
      // 'rejection' is set by the orchestrator's unwrapTypecheck when the
      // Promise.allSettled entry rejects; runProjectTypecheck never produces it directly.
      reason:
        | 'no-tsconfig'
        | 'project-references'
        | 'wrapper-config'
        | 'tsc-not-found'
        | 'dependencies-unresolved'
        | 'no-parseable-output'
        | 'output-overflow'
        | 'feature-disabled'
        | 'rejection';
      // What the check observed: what was inspected, at which path, and what was
      // found. Required so the compiler enumerates every construction site
      // (design D9); it states the observation, never a diagnosis the check did
      // not make (requirement 2.4).
      observed: string;
      rejectionMessage?: string;
    }
  | {
      tsconfigPath: string;
      status: 'timeout';
      typecheckWarning?: string;
    };

const TIMEOUT_MS = 30_000;
// The pnpm whole-tree check compiles every package, so it gets a larger budget
// than the single-project `tsc` run (retro P7).
const PNPM_CHECK_TYPES_TIMEOUT_MS = 120_000;
const PNPM_WORKSPACE_FILE = 'pnpm-workspace.yaml';
const SIGKILL_GRACE_MS = 2_000;
const MAX_BUFFER = 16 * 1024 * 1024;
const GITIGNORE_ENTRY = '.spec-workflow/.cache/';
const TSBUILDINFO_REBUILD_WARNING =
  'tsbuildinfo rebuild — concurrent prepare suspected';
const TSBUILDINFO_REBUILD_RE = /TS5083\b|Cannot read file[^\n]*tsbuildinfo/i;
const REALPATH_CHUNK = 100;
const DIAGNOSTIC_CAP = 100;
const CASE_INSENSITIVE_VOLUME =
  process.platform === 'darwin' || process.platform === 'win32';

const realpathWarnedKeys = new Set<string>();

function warnRealpathOnce(code: string, p: string): void {
  const key = `${code}:${p}`;
  if (realpathWarnedKeys.has(key)) return;
  realpathWarnedKeys.add(key);
  console.warn(`[spec-workflow] typecheck realpath: ${code} on ${p}`);
}

function caseFold(p: string): string {
  return CASE_INSENSITIVE_VOLUME ? p.toLowerCase() : p;
}

type Resolved = {
  original: string;
  normalized: string | undefined;
  errorCode: string | undefined;
};

async function realpathChunked(paths: string[]): Promise<Resolved[]> {
  const out: Resolved[] = [];
  for (let i = 0; i < paths.length; i += REALPATH_CHUNK) {
    const chunk = paths.slice(i, i + REALPATH_CHUNK);
    const settled = await Promise.allSettled(chunk.map((p) => fs.realpath(p)));
    settled.forEach((s, idx) => {
      const original = chunk[idx];
      if (s.status === 'fulfilled') {
        out.push({ original, normalized: caseFold(s.value), errorCode: undefined });
        return;
      }
      const err = s.reason as NodeJS.ErrnoException;
      const code = err?.code ?? 'EUNKNOWN';
      if (code !== 'ENOENT') {
        warnRealpathOnce(code, original);
      }
      out.push({ original, normalized: undefined, errorCode: code });
    });
  }
  return out;
}

type TscRun = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  overflow: boolean;
};

/**
 * A per-workspace discriminator for the incremental cache file (requirement
 * 4.4). The cache *directory* is shared, so a single `tsc.tsbuildinfo` would be
 * written by every workspace with `--incremental` against a different `-p`
 * root — at best a full rebuild every run, at worst a concurrent truncation
 * that trips the rebuild-detection heuristic on an unrelated review.
 */
function workspaceCacheKey(workspacePath: string): string {
  return createHash('sha256')
    .update(caseFold(path.resolve(workspacePath)))
    .digest('hex')
    .slice(0, 16);
}

export async function runProjectTypecheck(
  /**
   * The checkout that is compiled. Governs every root use that determines which
   * tree tsc sees: the tsconfig, the compiler binary, the `-p` argument and the
   * spawn working directory (requirement 4.2).
   */
  workspacePath: string,
  /**
   * The shared root that owns the cache directory and the `.gitignore` entry
   * (requirement 4.3). Taking the workspace for these would create a
   * `.spec-workflow` directory inside every worktree and leave each with an
   * uncommitted edit to its tracked `.gitignore`.
   */
  workflowRoot: string,
  allFiles: string[],
  opts: { enabled: boolean },
): Promise<TypecheckResult[]> {
  const tsconfigPath = path.join(workspacePath, 'tsconfig.json');

  if (!opts.enabled) {
    const settingsPath = path.join(
      workflowRoot,
      '.spec-workflow',
      'adversarial-settings.json',
    );
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'feature-disabled',
      observed: `typecheck is disabled by \`features.typecheck: false\` in \`${settingsPath}\``,
    }];
  }

  let tsconfigText: string;
  try {
    tsconfigText = await fs.readFile(tsconfigPath, 'utf-8');
  } catch {
    // A pnpm monorepo keeps no root `tsconfig.json`, so this path would force
    // every task to `risk: high` on `no-tsconfig` (retro P7). When the workspace
    // declares a pnpm workspace, run its own `check-types` over the whole tree.
    let isPnpmWorkspace = false;
    try {
      await fs.access(path.join(workspacePath, PNPM_WORKSPACE_FILE));
      isPnpmWorkspace = true;
    } catch {
      // Not a pnpm workspace; fall through to the `no-tsconfig` report.
    }
    if (isPnpmWorkspace) {
      return runPnpmCheckTypes(workspacePath, allFiles, tsconfigPath);
    }

    const workflowTsconfig = path.join(workflowRoot, 'tsconfig.json');
    let workflowRootHasTsconfig: boolean;
    try {
      await fs.access(workflowTsconfig);
      workflowRootHasTsconfig = true;
    } catch {
      workflowRootHasTsconfig = false;
    }
    const observed = workflowRootHasTsconfig
      ? `no \`tsconfig.json\` at \`${tsconfigPath}\`; the workflow root has one at \`${workflowTsconfig}\``
      : `no \`tsconfig.json\` at \`${tsconfigPath}\`; the workflow root has none either`;
    return [{ tsconfigPath, status: 'unavailable', reason: 'no-tsconfig', observed }];
  }

  const parsed = parseTsconfig(tsconfigText);
  if (parsed && hasNonEmptyReferences(parsed)) {
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'project-references',
      observed: `\`${tsconfigPath}\` declares \`references\`; project references are not compiled`,
    }];
  }
  if (parsed && isFilesEmptyWrapper(parsed)) {
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'wrapper-config',
      observed: `\`${tsconfigPath}\` has an empty \`files\` list and no \`include\``,
    }];
  }

  const tscPath = await resolveTscBinary(workspacePath);
  if (!tscPath) {
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'tsc-not-found',
      observed: `no \`tsc\` under \`${path.join(workspacePath, 'node_modules', '.bin')}\``,
    }];
  }

  // A broken or half-installed workspace reports unavailable rather than letting
  // `tsc` fabricate hundreds of "cannot find module" diagnostics (requirement
  // 2.2, 2.3). The state is observed by direct existence check, never inferred
  // from diagnostic shape (requirement 2.7).
  const dependencyProbe = await probeDeclaredDependencies(workspacePath);
  if (dependencyProbe && dependencyProbe.unresolved.length > 0) {
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'dependencies-unresolved',
      observed: describeUnresolvedDependencies(workspacePath, dependencyProbe),
    }];
  }

  const cacheDir = path.join(workflowRoot, '.spec-workflow', '.cache');
  await fs.mkdir(cacheDir, { recursive: true });
  await ensureGitignoreEntry(workflowRoot);

  const tsbuildinfoPath = path.join(
    cacheDir,
    `tsc-${workspaceCacheKey(workspacePath)}.tsbuildinfo`,
  );
  const args = [
    '--noEmit',
    '-p', workspacePath,
    '--incremental',
    '--tsBuildInfoFile', tsbuildinfoPath,
    '--listFiles',
    '--pretty', 'false',
  ];

  // `tsc` does not read the git location variables itself, but it can load
  // config that shells out; the same shape as `runGit` is scrubbed the same way
  // (requirement 2.12).
  const env = { ...scrubbedGitEnv(), FORCE_COLOR: '0', NO_COLOR: '1' };
  const run = await spawnTsc(tscPath, args, env, workspacePath);

  const rebuilt = TSBUILDINFO_REBUILD_RE.test(run.stderr);
  const typecheckWarning = rebuilt ? TSBUILDINFO_REBUILD_WARNING : undefined;

  if (run.timedOut) {
    const result: TypecheckResult = { tsconfigPath, status: 'timeout' };
    if (typecheckWarning) result.typecheckWarning = typecheckWarning;
    return [result];
  }
  if (run.overflow) {
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'output-overflow',
      observed: '`tsc` output exceeded the 16 MB buffer',
    }];
  }

  const { diagnostics: parsedDiagnostics, listFiles } = parseTscOutput(run.stdout);
  // `tsc` prints diagnostic paths relative to its *spawn cwd*, which is the
  // workspace (see the spawnTsc call above) — not to the `-p` root and not to
  // this process's cwd. `--listFiles` output is already absolute, which is why
  // coverage was unaffected. Anchoring here makes `file` the absolute path
  // requirement 2.3 promises, and lets postProcess compare diagnostic paths
  // against the normalized `allFiles` set instead of against whatever directory
  // the server happens to be running from. `path.resolve` is a no-op when tsc
  // does emit an absolute path (a file outside the workspace tree).
  const diagnostics = parsedDiagnostics.map((d) => ({
    ...d,
    file: path.resolve(workspacePath, d.file),
  }));
  const cleanExit = run.exitCode === 0;

  if (cleanExit && listFiles.length === 0) {
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'no-parseable-output',
      observed: `\`tsc\` at \`${tscPath}\` exited ${run.exitCode ?? 0} with no diagnostics and no file list`,
    }];
  }
  if (!cleanExit && diagnostics.length === 0) {
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'no-parseable-output',
      observed: `\`tsc\` at \`${tscPath}\` exited ${run.exitCode ?? 0} with no diagnostics and no file list`,
    }];
  }

  const post = await postProcess(allFiles, listFiles, diagnostics);

  const result: TypecheckResult = {
    tsconfigPath,
    status: 'success',
    diagnostics: post.diagnostics,
    coverage: { compiled: post.compiled, excluded: post.excluded },
  };
  if (post.suppressedDenylistedFiles > 0) {
    result.suppressedDenylistedFiles = post.suppressedDenylistedFiles;
  }
  if (post.truncated) result.truncated = true;
  if (typecheckWarning) result.typecheckWarning = typecheckWarning;
  return [result];
}

/**
 * Whole-tree typecheck for a pnpm monorepo (retro P7). A pnpm workspace keeps no
 * root `tsconfig.json`, so the plain path returns `no-tsconfig` and forces every
 * task to `risk: high`. Here we run the repo's own `pnpm check-types` script —
 * the command CI runs — and read its exit code: a clean run is `success` with no
 * diagnostics; a failure surfaces the `tsc` diagnostics it printed, anchored and
 * scoped against the task's files so the gate can flag the in-scope ones.
 *
 * No result is cached: a repair re-run edits the tree, and a stale verdict on a
 * security gate is worse than a slow one. Speed comes from `tsc`'s own
 * incremental build cache, which the repo's `check-types` script keeps.
 */
async function runPnpmCheckTypes(
  workspacePath: string,
  allFiles: string[],
  tsconfigPath: string,
): Promise<TypecheckResult[]> {
  const env = { ...scrubbedGitEnv(), FORCE_COLOR: '0', NO_COLOR: '1' };
  const run = await spawnTsc(
    'pnpm',
    ['check-types'],
    env,
    workspacePath,
    true,
    PNPM_CHECK_TYPES_TIMEOUT_MS,
  );

  if (run.timedOut) {
    return [{ tsconfigPath, status: 'timeout' }];
  }
  if (run.overflow) {
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'output-overflow',
      observed: `\`pnpm check-types\` output exceeded the ${MAX_BUFFER / (1024 * 1024)} MB buffer`,
    }];
  }
  if (run.exitCode === 0) {
    // A clean whole-tree run: every package compiled with no errors.
    return [{ tsconfigPath, status: 'success', diagnostics: [], coverage: { compiled: [], excluded: [] } }];
  }

  const { diagnostics: parsedDiagnostics } = parseTscOutput(`${run.stdout}\n${run.stderr}`);
  if (parsedDiagnostics.length === 0) {
    return [{
      tsconfigPath,
      status: 'unavailable',
      reason: 'no-parseable-output',
      observed: `\`pnpm check-types\` at \`${workspacePath}\` exited ${run.exitCode ?? 'null'} with no parseable diagnostics`,
    }];
  }
  const anchored = parsedDiagnostics.map((d) => ({ ...d, file: path.resolve(workspacePath, d.file) }));
  // `allFiles` as both the scope set and the compiled set: a whole-tree run
  // compiles every package, so nothing this task touched is uncovered.
  const post = await postProcess(allFiles, allFiles, anchored);
  const result: TypecheckResult = {
    tsconfigPath,
    status: 'success',
    diagnostics: post.diagnostics,
    coverage: { compiled: post.compiled, excluded: post.excluded },
  };
  if (post.suppressedDenylistedFiles > 0) result.suppressedDenylistedFiles = post.suppressedDenylistedFiles;
  if (post.truncated) result.truncated = true;
  return [result];
}

async function postProcess(
  allFiles: string[],
  listFilesOutput: string[],
  diagnostics: TypecheckDiagnostic[],
): Promise<{
  compiled: string[];
  excluded: string[];
  diagnostics: TypecheckDiagnostic[];
  suppressedDenylistedFiles: number;
  truncated: boolean;
}> {
  const allFilesResolved = await realpathChunked(allFiles);
  const listFilesResolved = await realpathChunked(listFilesOutput);

  const listFilesNormalizedSet = new Set<string>();
  for (const r of listFilesResolved) {
    if (r.normalized !== undefined) listFilesNormalizedSet.add(r.normalized);
  }

  const allFilesNormalizedSet = new Set<string>();
  const seenAllFilesKeys = new Set<string>();
  const compiled: string[] = [];
  const excluded: string[] = [];
  for (const r of allFilesResolved) {
    if (r.normalized === undefined) {
      // realpath failed: bucket as excluded so the path stays visible to the
      // reviewer. ENOENT is silent; non-ENOENT already warned via
      // warnRealpathOnce inside realpathChunked.
      const key = `${r.errorCode ?? 'EUNKNOWN'}:${caseFold(r.original)}`;
      if (seenAllFilesKeys.has(key)) continue;
      seenAllFilesKeys.add(key);
      excluded.push(r.original);
      continue;
    }
    allFilesNormalizedSet.add(r.normalized);
    if (seenAllFilesKeys.has(r.normalized)) continue;
    seenAllFilesKeys.add(r.normalized);
    if (listFilesNormalizedSet.has(r.normalized)) compiled.push(r.original);
    else excluded.push(r.original);
  }

  const diagFiles = diagnostics.map((d) => d.file);
  const diagResolved = await realpathChunked(diagFiles);
  const taggedDiagnostics = diagnostics.map((d, i) => {
    const norm = diagResolved[i].normalized;
    const inScope = norm !== undefined && allFilesNormalizedSet.has(norm);
    return { ...d, inScope };
  });

  const compiledFilter = partitionPaths(compiled);
  const excludedFilter = partitionPaths(excluded);
  const diagFilter = partitionPaths(diagFiles);
  const keptDiagFiles = new Set(diagFilter.kept);
  const filteredDiagnostics = taggedDiagnostics.filter((d) =>
    keptDiagFiles.has(d.file),
  );

  const suppressedSet = new Set<string>();
  for (const s of compiledFilter.skipped) suppressedSet.add(caseFold(s));
  for (const s of excludedFilter.skipped) suppressedSet.add(caseFold(s));
  for (const s of diagFilter.skipped) suppressedSet.add(caseFold(s));
  const suppressedDenylistedFiles = suppressedSet.size;

  const inScopeDiags = filteredDiagnostics.filter((d) => d.inScope);
  const outOfScopeDiags = filteredDiagnostics.filter((d) => !d.inScope);
  const ordered = [...inScopeDiags, ...outOfScopeDiags];
  const truncated = ordered.length > DIAGNOSTIC_CAP;
  const cappedDiagnostics = truncated ? ordered.slice(0, DIAGNOSTIC_CAP) : ordered;

  return {
    compiled: compiledFilter.kept,
    excluded: excludedFilter.kept,
    diagnostics: cappedDiagnostics,
    suppressedDenylistedFiles,
    truncated,
  };
}

const DIAGNOSTIC_HEADER_RE = /^(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)$/;
const ABS_PATH_RE = /^([A-Za-z]:[\\/]|\/)/;
const TS_JS_SOURCE_RE = /\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)(:|$)/;
const MESSAGE_BYTE_CAP = 4096;
const TRUNCATION_SUFFIX = '\n<...truncated>';

function parseTscOutput(stdout: string): {
  diagnostics: TypecheckDiagnostic[];
  listFiles: string[];
} {
  const lines = stdout.split(/\r?\n/);
  const consumed = new Array<boolean>(lines.length).fill(false);
  const diagnostics: TypecheckDiagnostic[] = [];

  let i = 0;
  while (i < lines.length) {
    const m = DIAGNOSTIC_HEADER_RE.exec(lines[i]);
    if (!m) { i++; continue; }
    consumed[i] = true;
    const [, file, lineStr, colStr, codeNum, head] = m;
    let message = head;
    let j = i + 1;
    while (j < lines.length) {
      const next = lines[j];
      if (DIAGNOSTIC_HEADER_RE.test(next)) break;
      if (ABS_PATH_RE.test(next)) break;
      if (TS_JS_SOURCE_RE.test(next)) break;
      if (!/^\s/.test(next)) break;
      message += '\n' + next;
      consumed[j] = true;
      j++;
    }
    diagnostics.push({
      file,
      line: parseInt(lineStr, 10),
      column: parseInt(colStr, 10),
      code: 'TS' + codeNum,
      message: capMessage(message),
      // `file` is left exactly as tsc printed it (usually workspace-relative);
      // the caller anchors it to the workspace. inScope is tagged in
      // postProcess (normalization + allFiles intersection).
      inScope: false,
    });
    i = j;
  }

  const listFiles: string[] = [];
  for (let k = 0; k < lines.length; k++) {
    if (consumed[k]) continue;
    if (ABS_PATH_RE.test(lines[k])) listFiles.push(lines[k]);
  }
  return { diagnostics, listFiles };
}

function capMessage(message: string): string {
  if (Buffer.byteLength(message, 'utf-8') <= MESSAGE_BYTE_CAP) return message;
  const buf = Buffer.from(message, 'utf-8');
  let cut = MESSAGE_BYTE_CAP;
  // Back up to a UTF-8 boundary so we don't split a multi-byte sequence.
  while (cut > 0 && (buf[cut] & 0xC0) === 0x80) cut--;
  return buf.subarray(0, cut).toString('utf-8') + TRUNCATION_SUFFIX;
}

function hasNonEmptyReferences(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const refs = (parsed as Record<string, unknown>).references;
  return Array.isArray(refs) && refs.length > 0;
}

function isFilesEmptyWrapper(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;
  return (
    Array.isArray(obj.files) &&
    (obj.files as unknown[]).length === 0 &&
    !('include' in obj)
  );
}

function parseTsconfig(text: string): unknown {
  try {
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
      .replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

async function resolveTscBinary(workspacePath: string): Promise<string | null> {
  const binDir = path.join(workspacePath, 'node_modules', '.bin');
  const candidates = process.platform === 'win32'
    ? [path.join(binDir, 'tsc.cmd'), path.join(binDir, 'tsc')]
    : [path.join(binDir, 'tsc')];
  for (const c of candidates) {
    try {
      await fs.access(c);
      return c;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Existence-probe every package named in the workspace's `dependencies` and
 * `devDependencies` (requirement 2.2). `optionalDependencies` are excluded. One
 * `fs.access` on `<workspace>/node_modules/<name>/package.json` per name, all
 * awaited together (design D7). Returns null when `package.json` is absent or
 * unparseable, so the check proceeds and spawns `tsc` as before. Dependency
 * state is decided by this direct check, never inferred from diagnostics
 * (requirement 2.7).
 */
async function probeDeclaredDependencies(
  workspacePath: string,
): Promise<{ declared: number; unresolved: string[] } | null> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(workspacePath, 'package.json'), 'utf-8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const names = new Set<string>();
  for (const key of ['dependencies', 'devDependencies'] as const) {
    const section = obj[key];
    if (typeof section === 'object' && section !== null) {
      for (const name of Object.keys(section as Record<string, unknown>)) {
        names.add(name);
      }
    }
  }
  const declaredNames = [...names];
  const results = await Promise.all(
    declaredNames.map(async (name) => {
      try {
        await fs.access(
          path.join(workspacePath, 'node_modules', name, 'package.json'),
        );
        return null;
      } catch {
        return name;
      }
    }),
  );
  const unresolved = results.filter((n): n is string => n !== null);
  return { declared: declaredNames.length, unresolved };
}

function describeUnresolvedDependencies(
  workspacePath: string,
  probe: { declared: number; unresolved: string[] },
): string {
  const packageJson = path.join(workspacePath, 'package.json');
  const shown = probe.unresolved.slice(0, 5).map((n) => `\`${n}\``).join(', ');
  const extra = probe.unresolved.length - Math.min(probe.unresolved.length, 5);
  const tail = extra > 0 ? `, and ${extra} more` : '';
  return `${probe.unresolved.length} of ${probe.declared} packages declared in \`${packageJson}\` have no \`node_modules/<name>/package.json\` under \`${workspacePath}\`: ${shown}${tail}; \`tsc\` was not run`;
}

async function ensureGitignoreEntry(workflowRoot: string): Promise<void> {
  const gitignorePath = path.join(workflowRoot, '.gitignore');
  let content: string;
  try {
    content = await fs.readFile(gitignorePath, 'utf-8');
  } catch (err) {
    // No .gitignore (fresh project) or unreadable → best-effort, do not create.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      // unreadable for non-ENOENT reasons: stay silent
    }
    return;
  }
  const lines = content.split('\n').map((l) => l.trim());
  // Already covered by either the explicit cache entry or any broader .spec-workflow rule.
  const covered =
    lines.includes(GITIGNORE_ENTRY) ||
    lines.includes('.spec-workflow/.cache') ||
    lines.includes('.spec-workflow') ||
    lines.includes('.spec-workflow/');
  if (covered) return;
  const newContent = content.endsWith('\n')
    ? `${content}${GITIGNORE_ENTRY}\n`
    : `${content}\n${GITIGNORE_ENTRY}\n`;
  try {
    await fs.writeFile(gitignorePath, newContent, 'utf-8');
  } catch {
    // best-effort
  }
}

function spawnTsc(
  tscPath: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  cwd: string,
  useShell: boolean = process.platform === 'win32',
  timeoutMs: number = TIMEOUT_MS,
): Promise<TscRun> {
  return new Promise((resolve) => {
    const opts: ExecFileOptions = {
      env,
      cwd,
      maxBuffer: MAX_BUFFER,
      shell: useShell,
    };
    let timedOut = false;
    let killTimer: NodeJS.Timeout | undefined;

    const proc = execFile(tscPath, args, opts, (error, stdout, stderr) => {
      clearTimeout(timeoutTimer);
      if (killTimer) clearTimeout(killTimer);
      const stdoutStr = typeof stdout === 'string' ? stdout : stdout?.toString() ?? '';
      const stderrStr = typeof stderr === 'string' ? stderr : stderr?.toString() ?? '';
      if (error) {
        const errCode = (error as NodeJS.ErrnoException).code;
        const overflow = errCode === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';
        const exitCode =
          typeof (error as { code?: unknown }).code === 'number'
            ? ((error as { code: number }).code)
            : null;
        resolve({
          stdout: stdoutStr,
          stderr: stderrStr,
          exitCode,
          timedOut,
          overflow,
        });
        return;
      }
      resolve({
        stdout: stdoutStr,
        stderr: stderrStr,
        exitCode: 0,
        timedOut,
        overflow: false,
      });
    });

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      try { proc.kill('SIGTERM'); } catch { /* already exited */ }
      killTimer = setTimeout(() => {
        try { proc.kill('SIGKILL'); } catch { /* already exited */ }
      }, SIGKILL_GRACE_MS);
    }, timeoutMs);
  });
}
