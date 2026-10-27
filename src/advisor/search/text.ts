// src/advisor/search/text.ts
//
// Text search scoring (design.md C6; requirements.md Requirement 4 AC 2).
// No meaning score exists yet at this task; `meaningScore` is left unset.
import type { Chunk } from './corpus.js';

export interface Hit {
  project: string;
  path: string;
  startLine: number;
  endLine: number;
  kind: string;
  date: string;
  textScore: number;
  meaningScore?: number;
  score: number;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'your', 'all', 'can', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see',
  'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'that',
  'with', 'from', 'this', 'have', 'been', 'were', 'they', 'their', 'what', 'when', 'where',
  'which', 'will', 'would', 'there', 'here', 'than', 'then', 'also', 'into', 'over', 'under',
  'about', 'after', 'before', 'between', 'during', 'each', 'more', 'most', 'other', 'some',
  'such', 'only', 'own', 'same', 'few', 'any', 'both', 'does', 'did', 'had', 'got', 'may',
  'might', 'must', 'shall', 'should', 'could', 'while', 'because', 'into', 'onto', 'upon',
]);

function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

/** Scores each chunk by the query's distinct words plus a whole-phrase bonus (design.md C6). */
export function textSearch(chunks: Chunk[], query: string): Hit[] {
  const queryWords = Array.from(new Set(words(query)));
  const phrase = query.trim().toLowerCase();

  const hits: Hit[] = chunks.map((chunk) => {
    const lower = chunk.text.toLowerCase();
    let textScore = 0;
    for (const word of queryWords) {
      if (new RegExp(`\\b${word}\\b`).test(lower)) textScore += 1;
    }
    if (phrase.length > 0 && lower.includes(phrase)) textScore += 1;
    return {
      project: chunk.project,
      path: chunk.path,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      kind: chunk.kind,
      date: chunk.date,
      textScore,
      score: textScore,
    };
  });

  return hits.sort((a, b) => b.score - a.score);
}
