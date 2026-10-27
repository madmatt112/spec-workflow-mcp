// src/advisor/search/search.ts
//
// Merged text + meaning search (design.md C6; requirements.md Requirement 4
// AC 2-7, NFR Performance). Filters apply before ranking; lists fuse by
// reciprocal rank fusion (k = 60); searches run one at a time.
import { loadEmbedder } from './embed.js';
import { refreshIndex } from './index.js';
import { textSearch } from './text.js';
import type { Chunk } from './corpus.js';
import type { Hit } from './text.js';

export interface SearchQuery {
  query: string;
  project?: string;
  spec?: string;
  kind?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface SearchResult {
  hits: Hit[];
  meaning: 'on' | 'off' | string;
}

const RRF_K = 60;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;

function matchesFilters(c: Chunk, q: SearchQuery): boolean {
  if (q.project && c.project !== q.project) return false;
  if (q.spec && !c.path.includes(`/specs/${q.spec}/`)) return false;
  if (q.kind && c.kind !== q.kind) return false;
  if (q.from && c.date < q.from) return false;
  if (q.to && c.date > q.to) return false;
  return true;
}

function dedupeKey(h: { project: string; path: string; startLine: number }): string {
  return `${h.project}|${h.path}|${h.startLine}`;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** Reciprocal rank fusion (k = 60), 1-based ranks; absence from a list contributes nothing. */
function fuse(textRanks: Map<string, number>, meaningRanks: Map<string, number>): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [key, rank] of textRanks) scores.set(key, (scores.get(key) ?? 0) + 1 / (RRF_K + rank));
  for (const [key, rank] of meaningRanks) scores.set(key, (scores.get(key) ?? 0) + 1 / (RRF_K + rank));
  return scores;
}

async function run(q: SearchQuery): Promise<SearchResult> {
  const embedder = await loadEmbedder();
  const { chunks, indexing } = await refreshIndex(embedder);
  const filtered = chunks.filter((c) => matchesFilters(c, q));

  const textHits = textSearch(filtered, q.query);
  const textRanks = new Map<string, number>();
  const byKey = new Map<string, Hit>();
  textHits.forEach((h, i) => {
    const key = dedupeKey(h);
    textRanks.set(key, i + 1);
    byKey.set(key, h);
  });

  let meaning: 'on' | 'off' | string = 'off';
  const meaningRanks = new Map<string, number>();

  // Over 200 chunks to embed: text hits now, meaning still "indexing n of m" (design D12).
  if (embedder && indexing) {
    meaning = `indexing ${indexing.done} of ${indexing.total}`;
  } else if (embedder) {
    meaning = 'on';
    const [queryVector] = await embedder.embed([q.query]);
    const ranked = filtered
      .filter((c): c is Chunk & { vector: number[] } => Array.isArray(c.vector))
      .map((c) => ({ chunk: c, meaningScore: cosine(queryVector, c.vector) }))
      .sort((a, b) => b.meaningScore - a.meaningScore);

    ranked.forEach(({ chunk: c, meaningScore }, i) => {
      const key = dedupeKey(c);
      meaningRanks.set(key, i + 1);
      const existing = byKey.get(key);
      if (existing) existing.meaningScore = meaningScore;
    });
  }

  const fused = fuse(textRanks, meaningRanks);
  const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const hits = [...byKey.entries()]
    .map(([key, hit]) => ({ ...hit, score: fused.get(key) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { hits, meaning };
}

let searchChain: Promise<unknown> = Promise.resolve();

/** Merged text + meaning search over the known projects' corpus (design.md C6). */
export function search(q: SearchQuery): Promise<SearchResult> {
  const next = searchChain.then(() => run(q));
  searchChain = next.catch(() => undefined);
  return next;
}
