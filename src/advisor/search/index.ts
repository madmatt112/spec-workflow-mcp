// src/advisor/search/index.ts
//
// Index refresh (design.md C6; requirements.md Requirement 4 AC 6).
// Hashes every corpus file, re-embeds only changed or never-embedded files,
// drops files no longer in the corpus. A model change drops the index file.
import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { join, relative } from 'path';
import { controllerHome, readProjects, writeJsonAtomic } from '../../controller/state.js';
import type { KnownProject } from '../../controller/state.js';
import { advisorIndexDir } from '../home.js';
import { chunk, listCorpus } from './corpus.js';
import type { Chunk, CorpusFile } from './corpus.js';
import type { Embedder } from './embed.js';

interface IndexedChunk {
  startLine: number;
  endLine: number;
  kind: string;
  date: string;
  vector?: string;
}

interface IndexFile {
  v: 1;
  model: string;
  files: Record<string, { hash: string; chunks: IndexedChunk[] }>;
}

export interface RefreshResult {
  chunks: (Chunk & { vector?: number[] })[];
  embedded: number;
  pending: number;
}

function toBase64(vector: number[]): string {
  return Buffer.from(Float32Array.from(vector).buffer).toString('base64');
}

function fromBase64(encoded: string): number[] {
  const buf = Buffer.from(encoded, 'base64');
  return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
}

async function readIndex(path: string, model: string): Promise<IndexFile> {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf-8')) as IndexFile;
    if (parsed.model !== model) return { v: 1, model, files: {} };
    return parsed;
  } catch {
    return { v: 1, model, files: {} };
  }
}

function relPathFor(file: CorpusFile, projects: KnownProject[]): string {
  const project = projects.find((p) => p.id === file.project);
  return project ? relative(project.workflowRootPath, file.path) : relative(controllerHome(), file.path);
}

async function refreshFile(
  file: CorpusFile,
  relPath: string,
  index: IndexFile,
  embedder: Embedder | null,
  counts: { embedded: number; pending: number },
): Promise<{ chunks: (Chunk & { vector?: number[] })[]; entry: IndexFile['files'][string] }> {
  const fileChunks = await chunk(file);
  const hash = createHash('sha256').update(fileChunks.map((c) => c.text).join('\n')).digest('hex');
  const cached = index.files[relPath];
  const reuse = cached?.hash === hash && cached.chunks.length === fileChunks.length;

  const vectors: (number[] | undefined)[] = fileChunks.map((_, i) =>
    reuse && cached!.chunks[i].vector ? fromBase64(cached!.chunks[i].vector!) : undefined,
  );

  if (embedder) {
    const missing = vectors.map((v, i) => (v === undefined ? i : -1)).filter((i) => i >= 0);
    if (missing.length > 0) {
      const embeddings = await embedder.embed(missing.map((i) => fileChunks[i].text));
      missing.forEach((idx, j) => { vectors[idx] = embeddings[j]; });
      counts.embedded += missing.length;
    }
  } else {
    counts.pending += vectors.filter((v) => v === undefined).length;
  }

  return {
    chunks: fileChunks.map((c, i) => ({ ...c, vector: vectors[i] })),
    entry: {
      hash,
      chunks: fileChunks.map((c, i) => ({
        startLine: c.startLine,
        endLine: c.endLine,
        kind: c.kind,
        date: c.date,
        vector: vectors[i] ? toBase64(vectors[i]!) : undefined,
      })),
    },
  };
}

/** Refreshes every project's index and returns the whole corpus (design.md C6; Requirement 4 AC 6). */
export async function refreshIndex(embedder: Embedder | null): Promise<RefreshResult> {
  const { projects } = await readProjects();
  const files = await listCorpus(projects);

  const byProject = new Map<string, CorpusFile[]>();
  for (const file of files) {
    const list = byProject.get(file.project) ?? [];
    list.push(file);
    byProject.set(file.project, list);
  }

  const allChunks: (Chunk & { vector?: number[] })[] = [];
  const counts = { embedded: 0, pending: 0 };

  for (const [projectId, projectFiles] of byProject) {
    const indexPath = join(advisorIndexDir(), `${projectId}.json`);
    const model = embedder?.model ?? '';
    const index = await readIndex(indexPath, model);
    const nextFiles: IndexFile['files'] = {};

    for (const file of projectFiles) {
      const relPath = relPathFor(file, projects);
      const { chunks: fileChunks, entry } = await refreshFile(file, relPath, index, embedder, counts);
      nextFiles[relPath] = entry;
      allChunks.push(...fileChunks);
    }

    await writeJsonAtomic(indexPath, { v: 1, model, files: nextFiles });
  }

  return { chunks: allChunks, embedded: counts.embedded, pending: counts.pending };
}
