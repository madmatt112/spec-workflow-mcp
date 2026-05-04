import { execFile, ExecFileOptions } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { partitionPaths } from './path-denylist.js';

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
        | 'no-parseable-output'
        | 'output-overflow'
        | 'feature-disabled'
        | 'rejection';
      rejectionMessage?: string;
    }
  | {
      tsconfigPath: string;
      status: 'timeout';
      typecheckWarning?: string;
    };

const TIMEOUT_MS = 30_000;
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

export async function runProjectTypecheck(
  projectPath: string,
  allFiles: string[],
  opts: { enabled: boolean },
): Promise<TypecheckResult[]> {
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');

  if (!opts.enabled) {
    return [{ tsconfigPath, status: 'unavailable', reason: 'feature-disabled' }];
  }

  let tsconfigText: string;
  try {
    tsconfigText = await fs.readFile(tsconfigPath, 'utf-8');
  } catch {
    return [{ tsconfigPath, status: 'unavailable', reason: 'no-tsconfig' }];
  }

  const parsed = parseTsconfig(tsconfigText);
  if (parsed && hasNonEmptyReferences(parsed)) {
    return [{ tsconfigPath, status: 'unavailable', reason: 'project-references' }];
  }
  if (parsed && isFilesEmptyWrapper(parsed)) {
    return [{ tsconfigPath, status: 'unavailable', reason: 'wrapper-config' }];
  }

  const tscPath = await resolveTscBinary(projectPath);
  if (!tscPath) {
    return [{ tsconfigPath, status: 'unavailable', reason: 'tsc-not-found' }];
  }

  const cacheDir = path.join(projectPath, '.spec-workflow', '.cache');
  await fs.mkdir(cacheDir, { recursive: true });
  await ensureGitignoreEntry(projectPath);

  const tsbuildinfoPath = path.join(cacheDir, 'tsc.tsbuildinfo');
  const args = [
    '--noEmit',
    '-p', projectPath,
    '--incremental',
    '--tsBuildInfoFile', tsbuildinfoPath,
    '--listFiles',
    '--pretty', 'false',
  ];

  const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
  const run = await spawnTsc(tscPath, args, env, projectPath);

  const rebuilt = TSBUILDINFO_REBUILD_RE.test(run.stderr);
  const typecheckWarning = rebuilt ? TSBUILDINFO_REBUILD_WARNING : undefined;

  if (run.timedOut) {
    const result: TypecheckResult = { tsconfigPath, status: 'timeout' };
    if (typecheckWarning) result.typecheckWarning = typecheckWarning;
    return [result];
  }
  if (run.overflow) {
    return [{ tsconfigPath, status: 'unavailable', reason: 'output-overflow' }];
  }

  const { diagnostics, listFiles } = parseTscOutput(run.stdout);
  const cleanExit = run.exitCode === 0;

  if (cleanExit && listFiles.length === 0) {
    return [{ tsconfigPath, status: 'unavailable', reason: 'no-parseable-output' }];
  }
  if (!cleanExit && diagnostics.length === 0) {
    return [{ tsconfigPath, status: 'unavailable', reason: 'no-parseable-output' }];
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
      // inScope is tagged in task 5.3 (normalization + allFiles intersection).
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

async function resolveTscBinary(projectPath: string): Promise<string | null> {
  const binDir = path.join(projectPath, 'node_modules', '.bin');
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

async function ensureGitignoreEntry(projectPath: string): Promise<void> {
  const gitignorePath = path.join(projectPath, '.gitignore');
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
): Promise<TscRun> {
  return new Promise((resolve) => {
    const opts: ExecFileOptions = {
      env,
      cwd,
      maxBuffer: MAX_BUFFER,
      shell: process.platform === 'win32',
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
    }, TIMEOUT_MS);
  });
}
