import { execFile, ExecFileOptions } from 'node:child_process';
import { partitionPaths } from './path-denylist.js';

export type TaskDiffResult = {
  diff: string;
  stats: { filesChanged: number; linesAdded: number; linesRemoved: number } | undefined;
  skippedPaths: string[];
  truncated: boolean;
  rejection?: { message: string };
};

const MAX_BUFFER = 16 * 1024 * 1024;
const PER_FILE_LINE_CAP = 500;
const TOTAL_BYTE_CAP = 50_000;

const DIFF_HEADER_RE = /^diff --git a\/(.+) b\/(.+)$/;
const BINARY_MARKER_RE = /^Binary files .* differ$/m;

type GitRun = { stdout: string; ok: boolean };

function runGit(projectPath: string, args: string[]): Promise<GitRun> {
  return new Promise((resolve) => {
    const opts: ExecFileOptions = {
      cwd: projectPath,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
      maxBuffer: MAX_BUFFER,
    };
    execFile('git', args, opts, (err, stdout) => {
      const stdoutStr = typeof stdout === 'string' ? stdout : stdout?.toString() ?? '';
      resolve({ stdout: stdoutStr, ok: !err });
    });
  });
}

export async function computeTaskDiff(
  projectPath: string,
  allFiles: string[],
): Promise<TaskDiffResult> {
  const { kept, skipped } = partitionPaths(allFiles);

  if (kept.length === 0) {
    return { diff: '', stats: undefined, skippedPaths: skipped, truncated: false };
  }

  const diffArgs = ['diff', '-U10', '-M', 'HEAD', '--', ...kept];
  const numstatArgs = ['diff', '--numstat', '-M', 'HEAD', '--', ...kept];

  const [diffRun, numstatRun] = await Promise.all([
    runGit(projectPath, diffArgs),
    runGit(projectPath, numstatArgs),
  ]);

  if (!diffRun.ok || !numstatRun.ok) {
    return { diff: '', stats: undefined, skippedPaths: skipped, truncated: false };
  }

  const numstat = parseNumstat(numstatRun.stdout);
  const sections = splitDiffSections(diffRun.stdout);

  let truncated = false;
  const nonBinarySections: { filePath: string; body: string }[] = [];
  for (const sec of sections) {
    if (BINARY_MARKER_RE.test(sec.body)) continue;
    const stat = numstat.perFile.get(sec.filePath);
    if (stat && stat.added + stat.removed > PER_FILE_LINE_CAP) {
      nonBinarySections.push({
        filePath: sec.filePath,
        body: `<diff truncated: ${sec.filePath} per-file cap exceeded>\n`,
      });
      truncated = true;
    } else {
      nonBinarySections.push(sec);
    }
  }

  let totalBytes = 0;
  let budgetExhausted = false;
  const finalParts: string[] = [];
  for (const sec of nonBinarySections) {
    if (budgetExhausted) {
      finalParts.push(
        `<diff truncated: ${sec.filePath} total budget exhausted, file truncated despite size>\n`,
      );
      truncated = true;
      continue;
    }
    const bodyBytes = Buffer.byteLength(sec.body, 'utf-8');
    if (totalBytes + bodyBytes > TOTAL_BYTE_CAP) {
      finalParts.push(
        `<diff truncated: ${sec.filePath} total budget exhausted, file truncated despite size>\n`,
      );
      truncated = true;
      budgetExhausted = true;
    } else {
      finalParts.push(sec.body);
      totalBytes += bodyBytes;
    }
  }

  return {
    diff: finalParts.join(''),
    stats: {
      filesChanged: numstat.filesChanged,
      linesAdded: numstat.linesAdded,
      linesRemoved: numstat.linesRemoved,
    },
    skippedPaths: skipped,
    truncated,
  };
}

function splitDiffSections(diff: string): { filePath: string; body: string }[] {
  const lines = diff.split('\n');
  const sections: { filePath: string; body: string }[] = [];
  let currentPath: string | undefined;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentPath === undefined) return;
    let body = currentLines.join('\n');
    if (body.length > 0 && !body.endsWith('\n')) body += '\n';
    sections.push({ filePath: currentPath, body });
  };

  for (const line of lines) {
    const m = DIFF_HEADER_RE.exec(line);
    if (m) {
      flush();
      currentPath = m[2];
      currentLines = [line];
    } else if (currentPath !== undefined) {
      currentLines.push(line);
    }
  }
  flush();
  return sections;
}

function parseNumstat(text: string): {
  perFile: Map<string, { added: number; removed: number }>;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
} {
  const perFile = new Map<string, { added: number; removed: number }>();
  let filesChanged = 0;
  let linesAdded = 0;
  let linesRemoved = 0;

  for (const rawLine of text.split('\n')) {
    if (!rawLine) continue;
    const parts = rawLine.split('\t');
    if (parts.length < 3) continue;
    const [aStr, rStr, ...rest] = parts;
    const filePath = rest.join('\t');
    const added = aStr === '-' ? 0 : Number.parseInt(aStr, 10);
    const removed = rStr === '-' ? 0 : Number.parseInt(rStr, 10);
    const a = Number.isFinite(added) ? added : 0;
    const r = Number.isFinite(removed) ? removed : 0;
    perFile.set(filePath, { added: a, removed: r });
    filesChanged++;
    linesAdded += a;
    linesRemoved += r;
  }

  return { perFile, filesChanged, linesAdded, linesRemoved };
}
