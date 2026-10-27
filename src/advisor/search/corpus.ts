// src/advisor/search/corpus.ts
//
// Search corpus listing and chunking (design.md C6; requirements.md
// Requirement 4 AC 1, AC 3). Walks each known project's
// `.spec-workflow/**/*.md`, `docs/**/*.md` and `GLOSSARY.md`, plus the home
// `waits/*.json`. Session transcripts and the home `advisor/notes/` are never
// visited (AC 1). Scans in node, no ripgrep (design D13).
import { promises as fs } from 'fs';
import { join, relative, sep } from 'path';
import { controllerHome, listWaits } from '../../controller/state.js';
import type { KnownProject } from '../../controller/state.js';
import { PathUtils } from '../../core/path-utils.js';
import { lastCommitDate } from '../tallies.js';

export interface CorpusFile {
  project: string;
  path: string;
  kind: string;
  date: string;
}

export interface Chunk {
  project: string;
  path: string;
  kind: string;
  date: string;
  startLine: number;
  endLine: number;
  text: string;
}

const MAX_CHUNK_LINES = 60;
const HEADING_RE = /^#{1,3}\s/;

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function walkMarkdown(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkMarkdown(full)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/** design.md C6's kind vocabulary, derived from the file's path relative to the project root. */
function deriveKind(relPath: string): string {
  const posix = relPath.split(sep).join('/');
  const base = posix.split('/').pop() ?? posix;
  if (posix.startsWith('.spec-workflow/deferrals/')) return 'deferral';
  if (posix.startsWith('docs/adr/')) return 'ADR';
  if (base === 'requirements.md') return 'requirements';
  if (base === 'design.md') return 'design';
  if (base === 'tasks.md') return 'tasks';
  if (base === 'retrospective.md') return 'retro';
  return 'doc';
}

async function projectFiles(project: KnownProject): Promise<CorpusFile[]> {
  const root = project.workflowRootPath;
  const candidates = [
    ...(await walkMarkdown(PathUtils.getWorkflowRoot(root))),
    ...(await walkMarkdown(join(root, 'docs'))),
  ];
  const glossary = join(root, 'GLOSSARY.md');
  if (await exists(glossary)) candidates.push(glossary);

  const out: CorpusFile[] = [];
  for (const full of candidates) {
    const rel = relative(root, full);
    const committed = lastCommitDate(root, rel);
    const date = committed ?? (await fs.stat(full)).mtime.toISOString();
    out.push({ project: project.id, path: full, kind: deriveKind(rel), date });
  }
  return out;
}

/** The home wait files, one `CorpusFile` each, kind `wait` (AC 1, AC 3). */
async function waitFiles(): Promise<CorpusFile[]> {
  const waits = await listWaits();
  return waits.map((wait) => ({
    project: wait.project,
    path: join(controllerHome(), 'waits', `${wait.id}.json`),
    kind: 'wait',
    date: wait.created,
  }));
}

/** The search corpus for the given projects (design.md C6; Requirement 4 AC 1). */
export async function listCorpus(projects: KnownProject[]): Promise<CorpusFile[]> {
  const out: CorpusFile[] = [];
  for (const project of projects) {
    out.push(...(await projectFiles(project)));
  }
  out.push(...(await waitFiles()));
  return out;
}

function stripTrailingBlank(lines: string[]): string[] {
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function headingSections(lines: string[]): { start: number; end: number }[] {
  const n = lines.length;
  const headingLines: number[] = [];
  for (let i = 0; i < n; i++) {
    if (HEADING_RE.test(lines[i])) headingLines.push(i + 1);
  }
  if (headingLines.length === 0) return n > 0 ? [{ start: 1, end: n }] : [];
  const sections: { start: number; end: number }[] = [];
  if (headingLines[0] > 1) sections.push({ start: 1, end: headingLines[0] - 1 });
  for (let i = 0; i < headingLines.length; i++) {
    const start = headingLines[i];
    const end = i + 1 < headingLines.length ? headingLines[i + 1] - 1 : n;
    sections.push({ start, end });
  }
  return sections;
}

function capWindows(start: number, end: number, max: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (let s = start; s <= end; s += max) {
    out.push({ start: s, end: Math.min(s + max - 1, end) });
  }
  return out;
}

/** Splits one corpus file into chunks (design.md C6): headings 1-3, capped at 60 lines; a wait is one chunk. */
export async function chunk(file: CorpusFile): Promise<Chunk[]> {
  const raw = await fs.readFile(file.path, 'utf-8');
  const lines = stripTrailingBlank(raw.split('\n'));

  if (file.kind === 'wait') {
    return [{
      project: file.project, path: file.path, kind: file.kind, date: file.date,
      startLine: 1, endLine: Math.max(1, lines.length), text: raw,
    }];
  }

  const chunks: Chunk[] = [];
  for (const section of headingSections(lines)) {
    for (const win of capWindows(section.start, section.end, MAX_CHUNK_LINES)) {
      chunks.push({
        project: file.project,
        path: file.path,
        kind: file.kind,
        date: file.date,
        startLine: win.start,
        endLine: win.end,
        text: lines.slice(win.start - 1, win.end).join('\n'),
      });
    }
  }
  return chunks;
}
