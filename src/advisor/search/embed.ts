// src/advisor/search/embed.ts
//
// Local embedder (design.md C6; requirements.md Requirement 4 AC 5, AC 7).
// Loopback only, so no text leaves the machine.
import { readFile } from 'fs/promises';
import { searchPath } from '../home.js';

export interface Embedder {
  model: string;
  embed(texts: string[]): Promise<number[][]>;
}

interface SearchConfig {
  v: 1;
  url: string;
  model: string;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

async function readConfig(): Promise<SearchConfig | undefined> {
  try {
    return JSON.parse(await readFile(searchPath(), 'utf-8')) as SearchConfig;
  } catch {
    return undefined;
  }
}

function isLoopback(url: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Sends one batched embed request (Ollama's `/api/embed`, pinned in search.test.ts). */
async function embed(url: string, model: string, texts: string[]): Promise<number[][]> {
  const res = await fetch(`${url}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!res.ok) throw new Error(`embed request failed: ${res.status}`);
  const body = (await res.json()) as { embeddings: number[][] };
  return body.embeddings;
}

/** Loads the embedder named in search.json; null when absent, non-loopback, or unreachable (AC 5, AC 7). */
export async function loadEmbedder(): Promise<Embedder | null> {
  const config = await readConfig();
  if (!config || !isLoopback(config.url)) return null;
  try {
    await embed(config.url, config.model, ['ping']);
  } catch {
    return null;
  }
  return { model: config.model, embed: (texts) => embed(config.url, config.model, texts) };
}
