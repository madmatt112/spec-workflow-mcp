// src/advisor/search/index.ts
//
// Index refresh (design.md C6; requirements.md Requirement 4 AC 6, NFR
// Performance; design D12). Hashes every corpus file, re-embeds only changed
// or never-embedded files, drops files no longer in the corpus. A model
// change drops the index file. Past 200 chunks needing embedding, only the
// first 200 are embedded before returning; the rest embed in a background
// job this process keeps running, so the caller gets text hits now instead
// of blocking (design D12).
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
  /** Set past 200 chunks needing embedding; the rest finish in the background (design D12). */
  indexing?: { done: number; total: number };
}

interface PlanEntry {
  projectId: string;
  relPath: string;
  fileChunks: Chunk[];
  hash: string;
  vectors: (number[] | undefined)[];
}

interface BackgroundJob {
  total: number;
  done: number;
  promise: Promise<void>;
}

const EMBED_CAP = 200;

/** The one indexing job this process ever runs at a time (design D12: "keeps embedding in process"). */
let backgroundJob: BackgroundJob | null = null;

/** Test-only hook: resolves once any in-flight background indexing job finishes. */
export function waitForIndexing(): Promise<void> {
  return backgroundJob ? backgroundJob.promise : Promise.resolve();
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

/** The model already on disk, read without the drop-on-mismatch check above. */
async function cachedModel(path: string): Promise<string> {
  try {
    return (JSON.parse(await readFile(path, 'utf-8')) as IndexFile).model;
  } catch {
    return '';
  }
}

function relPathFor(file: CorpusFile, projects: KnownProject[]): string {
  const project = projects.find((p) => p.id === file.project);
  return project ? relative(project.workflowRootPath, file.path) : relative(controllerHome(), file.path);
}

function missingIndices(vectors: (number[] | undefined)[]): number[] {
  return vectors.map((v, i) => (v === undefined ? i : -1)).filter((i) => i >= 0);
}

function entryToIndexed(entry: Pick<PlanEntry, 'hash' | 'fileChunks' | 'vectors'>): IndexFile['files'][string] {
  return {
    hash: entry.hash,
    chunks: entry.fileChunks.map((c, i) => ({
      startLine: c.startLine,
      endLine: c.endLine,
      kind: c.kind,
      date: c.date,
      vector: entry.vectors[i] ? toBase64(entry.vectors[i]!) : undefined,
    })),
  };
}

/** Builds the hash/cache-reuse plan for the whole corpus, no network calls (design.md C6). */
async function buildPlan(embedder: Embedder | null): Promise<{ plan: PlanEntry[]; models: Map<string, string> }> {
  const { projects } = await readProjects();
  const files = await listCorpus(projects);

  const byProject = new Map<string, CorpusFile[]>();
  for (const file of files) {
    const list = byProject.get(file.project) ?? [];
    list.push(file);
    byProject.set(file.project, list);
  }

  const plan: PlanEntry[] = [];
  const models = new Map<string, string>();

  for (const [projectId, projectFiles] of byProject) {
    const indexPath = join(advisorIndexDir(), `${projectId}.json`);
    // No embedder this round: read the model already on disk instead of
    // forcing '', so a no-embedder search never wipes the vector cache
    // (review-9_v1 INFO, index.ts:124/197).
    const model = embedder ? embedder.model : await cachedModel(indexPath);
    models.set(projectId, model);
    const index = await readIndex(indexPath, model);

    for (const file of projectFiles) {
      const relPath = relPathFor(file, projects);
      const fileChunks = await chunk(file);
      const hash = createHash('sha256').update(fileChunks.map((c) => c.text).join('\n')).digest('hex');
      const cached = index.files[relPath];
      const reuse = cached?.hash === hash && cached.chunks.length === fileChunks.length;
      const vectors: (number[] | undefined)[] = fileChunks.map((_, i) =>
        reuse && cached!.chunks[i].vector ? fromBase64(cached!.chunks[i].vector!) : undefined,
      );
      plan.push({ projectId, relPath, fileChunks, hash, vectors });
    }
  }

  return { plan, models };
}

async function writePlan(plan: PlanEntry[], models: Map<string, string>): Promise<void> {
  const nextFilesByProject = new Map<string, IndexFile['files']>();
  for (const entry of plan) {
    const nextFiles = nextFilesByProject.get(entry.projectId) ?? {};
    nextFiles[entry.relPath] = entryToIndexed(entry);
    nextFilesByProject.set(entry.projectId, nextFiles);
  }
  for (const [projectId, model] of models) {
    const indexPath = join(advisorIndexDir(), `${projectId}.json`);
    await writeJsonAtomic(indexPath, { v: 1, model, files: nextFilesByProject.get(projectId) ?? {} });
  }
}

/** Embeds the deferred entries and persists them once done (design D12: background job). */
async function embedDeferred(embedder: Embedder, deferred: PlanEntry[], job: BackgroundJob): Promise<void> {
  try {
    for (const entry of deferred) {
      const missing = missingIndices(entry.vectors);
      if (missing.length === 0) continue;
      const embeddings = await embedder.embed(missing.map((i) => entry.fileChunks[i].text));
      missing.forEach((idx, j) => { entry.vectors[idx] = embeddings[j]; });
      job.done += missing.length;
    }
  } catch {
    // Embedder unreachable mid-refresh: stop, keep what was already embedded
    // (design Error Handling #7); never leave this detached job's rejection
    // unhandled (review-9_v2 WARNING, index.ts:237).
  }

  const byProject = new Map<string, PlanEntry[]>();
  for (const entry of deferred) {
    const list = byProject.get(entry.projectId) ?? [];
    list.push(entry);
    byProject.set(entry.projectId, list);
  }

  for (const [projectId, entries] of byProject) {
    const indexPath = join(advisorIndexDir(), `${projectId}.json`);
    const current = await readIndex(indexPath, embedder.model);
    for (const entry of entries) current.files[entry.relPath] = entryToIndexed(entry);
    await writeJsonAtomic(indexPath, { v: 1, model: embedder.model, files: current.files });
  }
}

function toChunks(plan: PlanEntry[]): (Chunk & { vector?: number[] })[] {
  return plan.flatMap((entry) => entry.fileChunks.map((c, i) => ({ ...c, vector: entry.vectors[i] })));
}

/** Refreshes every project's index and returns the whole corpus (design.md C6; Requirement 4 AC 6, D12). */
export async function refreshIndex(embedder: Embedder | null): Promise<RefreshResult> {
  const { plan, models } = await buildPlan(embedder);

  if (embedder && backgroundJob) {
    // A background job already owns embedding; this round changes nothing on disk (design D12).
    return { chunks: toChunks(plan), embedded: 0, pending: 0, indexing: { done: backgroundJob.done, total: backgroundJob.total } };
  }

  if (!embedder) {
    const pending = plan.reduce((sum, e) => sum + missingIndices(e.vectors).length, 0);
    await writePlan(plan, models);
    return { chunks: toChunks(plan), embedded: 0, pending };
  }

  const totalMissing = plan.reduce((sum, e) => sum + missingIndices(e.vectors).length, 0);

  if (totalMissing <= EMBED_CAP) {
    let embedded = 0;
    for (const entry of plan) {
      const missing = missingIndices(entry.vectors);
      if (missing.length === 0) continue;
      const embeddings = await embedder.embed(missing.map((i) => entry.fileChunks[i].text));
      missing.forEach((idx, j) => { entry.vectors[idx] = embeddings[j]; });
      embedded += missing.length;
    }
    await writePlan(plan, models);
    return { chunks: toChunks(plan), embedded, pending: 0 };
  }

  // Over 200 chunks to embed: embed up to the cap now, defer the rest to a background job (design D12).
  let budget = EMBED_CAP;
  const deferred: PlanEntry[] = [];
  let embedded = 0;
  for (const entry of plan) {
    const missing = missingIndices(entry.vectors);
    if (missing.length === 0) continue;
    if (budget > 0) {
      const embeddings = await embedder.embed(missing.map((i) => entry.fileChunks[i].text));
      missing.forEach((idx, j) => { entry.vectors[idx] = embeddings[j]; });
      embedded += missing.length;
      budget -= missing.length;
    } else {
      deferred.push(entry);
    }
  }

  await writePlan(plan, models);

  const job: BackgroundJob = { total: totalMissing, done: embedded, promise: Promise.resolve() };
  backgroundJob = job;
  job.promise = embedDeferred(embedder, deferred, job).finally(() => {
    if (backgroundJob === job) backgroundJob = null;
  });

  return { chunks: toChunks(plan), embedded, pending: totalMissing - embedded, indexing: { done: job.done, total: job.total } };
}
