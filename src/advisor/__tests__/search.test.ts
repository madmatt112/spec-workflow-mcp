import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, readFileSync, unlinkSync } from 'fs';
import { createServer, type Server } from 'http';
import { join, relative } from 'path';
import { tmpdir } from 'os';
import { writeProjects } from '../../controller/state.js';
import type { KnownProject } from '../../controller/state.js';
import { searchPath, advisorIndexDir } from '../home.js';
import { search } from '../search/search.js';
import type { SearchQuery } from '../search/search.js';
import { waitForIndexing } from '../search/index.js';

// Contract for src/advisor/search/embed.ts, index.ts and search.ts (design.md
// C6; requirements.md Requirement 4 AC 2, AC 4, AC 5, AC 6, AC 7, NFR
// Performance; tasks.md task 9). The design gives these interfaces only in
// shorthand ("refreshIndex(embedder)", "search(q): Promise<SearchResult>");
// this file pins the concrete shapes the implementer must match, as the
// design's Data Models section licenses ("Illustrative — verify against the
// test fake").
//
// embed.ts: `interface Embedder { model: string; embed(texts: string[]):
// Promise<number[][]> }` and `loadEmbedder(): Promise<Embedder | null>`.
// loadEmbedder reads `search.json` (home.ts `searchPath()`): `{ v: 1, url,
// model }`. It returns null when the file is absent, when `new
// URL(url).hostname` is not loopback (`127.0.0.1`, `localhost`, `::1`), or
// when a one-text reachability call fails. A reachable embedder's `embed`
// sends `POST {url}/api/embed` with JSON body `{ model, input: texts }`
// (`texts` always an array, even for the one-text probe) and expects JSON
// `{ model, embeddings: number[][] }` back — the shape pinned here from
// Ollama's documented batched embeddings endpoint (no local Ollama server
// could be probed in this environment; the live probe against a real
// install stays pending in verification-evidence.md).
//
// index.ts: `refreshIndex(embedder: Embedder | null): Promise<{ chunks:
// (Chunk & { vector?: number[] })[]; embedded: number; pending: number }>`.
// It reads every known project (`readProjects`) and that project's corpus
// (`listCorpus`, `chunk` from task 8), hashes each file with SHA-256, and
// only calls `embedder.embed` for a file whose hash changed since the last
// `advisor/index/<projectId>.json` (home.ts `advisorIndexDir()`) or that has
// no cached vector yet; a file no longer in the corpus is dropped from that
// index file. The returned `chunks` cover the whole corpus; a chunk's
// `vector` is set when a vector exists (cached or freshly embedded) and
// `undefined` otherwise (no embedder, or not yet embedded this round).
//
// search.ts: `search(q: SearchQuery): Promise<SearchResult>` where
// `SearchQuery = { query: string; project?: string; spec?: string; kind?:
// string; from?: string; to?: string; limit?: number }` (`from`/`to` are
// inclusive ISO date strings, the same field names `buildTallies` — task 6 —
// uses for a date range; a chunk matches `spec` when its `path` contains the
// path segment `/specs/<spec>/`). It loads the embedder, refreshes the
// index, applies every given filter to the corpus chunks before any
// scoring, runs `textSearch` (task 8) and, when an embedder loaded, a cosine
// pass against the query's own embedding, then fuses the two rank-ordered
// lists by reciprocal rank fusion with `k = 60` and 1-based ranks (`score =
// 1/(60+rankText) + 1/(60+rankMeaning)`, a list a chunk is absent from
// contributing nothing), de-duplicating on `project|path|startLine`, sorted
// by the fused `score` descending, sliced to `q.limit ?? 10` (max 30).
// `SearchResult.meaning` is `'off'` with no embedder reachable, `'on'`
// otherwise (the `"indexing n of m"` progress string past 200 pending
// chunks, design D12, is out of this task's named Success list and is not
// tested here).
//
// Every test runs against a fresh temp SDD_HOME and fresh temp project
// roots, so the real home and repo are never touched. Tests that need a
// reachable embedder run a plain Node http server standing in for Ollama
// (`startFakeOllama`): any request text containing a `zzzvec-<id>` tag is
// looked up in a per-test vector table; any other text (the reachability
// probe, and the search query itself, both untagged by construction) maps
// to that test's registered query vector. This both supplies deterministic
// cosine scores and captures the exact request bodies sent, pinning the
// request shape above.

let home: string;
let savedSddHome: string | undefined;
let extraDirs: string[];
let servers: { close(): Promise<void> }[];

beforeEach(() => {
  savedSddHome = process.env.SDD_HOME;
  home = mkdtempSync(join(tmpdir(), 'sdd-advisor-search-home-'));
  process.env.SDD_HOME = home;
  extraDirs = [];
  servers = [];
});

afterEach(async () => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  await Promise.all(servers.map((s) => s.close()));
  rmSync(home, { recursive: true, force: true });
  for (const dir of extraDirs) rmSync(dir, { recursive: true, force: true });
});

function projectRoot(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  extraDirs.push(dir);
  return dir;
}

function makeProject(idAndName: string, root: string): KnownProject {
  return {
    id: idAndName,
    name: idAndName,
    workspacePath: root,
    workflowRootPath: root,
    seen: '2026-01-01T00:00:00.000Z',
  };
}

function writeMd(root: string, relPath: string, content: string): string {
  const full = join(root, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content, 'utf-8');
  return full;
}

function setDate(path: string, iso: string): void {
  const d = new Date(iso);
  utimesSync(path, d, d);
}

interface FakeOllamaRequest { model: string; input: string[] }

/** A plain-http stand-in for a reachable local Ollama (contract block above). */
async function startFakeOllama(vectors: Map<string, number[]>, queryVector: number[]): Promise<{
  url: string;
  requests: FakeOllamaRequest[];
  close: () => Promise<void>;
}> {
  const requests: FakeOllamaRequest[] = [];
  const server: Server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = JSON.parse(raw) as FakeOllamaRequest;
      requests.push(body);
      const embeddings = body.input.map((text) => {
        const m = text.match(/zzzvec-([a-z0-9-]+)/);
        return (m ? vectors.get(m[1]) : undefined) ?? queryVector;
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ model: body.model, embeddings }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const handle = {
        url: `http://127.0.0.1:${port}`,
        requests,
        close: () => new Promise<void>((r) => server.close(() => r())),
      };
      servers.push(handle);
      resolve(handle);
    });
  });
}

function writeSearchConfig(url: string): void {
  writeFileSync(searchPath(), JSON.stringify({ v: 1, url, model: 'fake-embed' }), 'utf-8');
}

/** Unit vector whose cosine similarity against [1, 0] is exactly `cosine`. */
function vec(cosine: number): number[] {
  return [cosine, Math.sqrt(Math.max(0, 1 - cosine * cosine))];
}

describe('src/advisor/search/embed.ts, index.ts and search.ts', () => {
  // AC 4.2 ("run a text search and a meaning search together and return one
  // merged, de-duplicated list, each hit with project, path, line range,
  // kind and date") decomposed to the task's "fusion and de-dup" Success
  // item. Pre-condition: one project with three chunks — one ("both") shares
  // the query word with a high meaning score, one ("textOnly") shares the
  // query word but has a low meaning score, one ("meaningOnly") shares no
  // word but has a high meaning score — and a reachable fake embedder.
  // Test: search({ query: 'umbrella' }). Observable result: exactly one hit
  // per chunk (no duplicate for "both", present in both component lists),
  // every hit carries project/path/startLine/endLine/kind/date and a numeric
  // score, "meaningOnly" is present (a meaning-only match surfaces), and
  // "both"'s fused score exceeds "textOnly"'s (tied text score, but "both"
  // wins on meaning). Expected value source: design.md C6 ("Lists merge by
  // reciprocal rank fusion ... de-duplicated") and the task's Success line.
  it('fuses text and meaning hits into one de-duplicated list', async () => {
    const root = projectRoot('sdd-advisor-search-fusion-');
    writeMd(root, '.spec-workflow/specs/demo/design.md', '# Design\n\nPlanning notes about the umbrella rollout strategy. zzzvec-both\n');
    writeMd(root, 'docs/text-only.md', '# Notes\n\nAnother umbrella reference unrelated to meaning. zzzvec-textonly\n');
    writeMd(root, 'docs/meaning-only.md', '# Notes\n\nA different topic entirely with no shared wording. zzzvec-meaningonly\n');
    const project = makeProject('proj-fusion', root);
    await writeProjects({ v: 1, projects: [project] });

    const vectors = new Map([
      ['both', vec(0.95)],
      ['textonly', vec(-0.9)],
      ['meaningonly', vec(0.9)],
    ]);
    const fake = await startFakeOllama(vectors, vec(1));
    writeSearchConfig(fake.url);

    const result = await search({ query: 'umbrella' });

    expect(result.meaning).toBe('on');
    expect(result.hits).toHaveLength(3);
    const both = result.hits.filter((h) => h.path.endsWith('design.md'));
    expect(both).toHaveLength(1);
    const textOnly = result.hits.find((h) => h.path.endsWith('text-only.md'));
    const meaningOnly = result.hits.find((h) => h.path.endsWith('meaning-only.md'));
    expect(textOnly).toBeDefined();
    expect(meaningOnly).toBeDefined();
    expect(both[0].score).toBeGreaterThan(textOnly!.score);
    for (const hit of result.hits) {
      expect(typeof hit.project).toBe('string');
      expect(typeof hit.path).toBe('string');
      expect(typeof hit.startLine).toBe('number');
      expect(typeof hit.endLine).toBe('number');
      expect(typeof hit.kind).toBe('string');
      expect(typeof hit.date).toBe('string');
      expect(typeof hit.score).toBe('number');
    }
  });

  // Requirement 4 AC 3's filter list ("project, spec, kind ... and a date
  // range"), decomposed per the task's "each filter" Success item into one
  // test per filter. This test: the project filter. Pre-condition: two
  // projects each with a chunk sharing the query word "needle"; proj-a also
  // has a second, non-spec doc chunk sharing the word. Test:
  // search({ query: 'needle', project: 'proj-a' }). Observable result: both
  // of proj-a's chunks are present and proj-b's is absent. Expected value
  // source: Requirement 4 AC 3 and design.md C6 ("Filters apply before
  // ranking").
  it('filters hits to one project before ranking', async () => {
    const rootA = projectRoot('sdd-advisor-search-filter-a-');
    const rootB = projectRoot('sdd-advisor-search-filter-b-');
    writeMd(rootA, '.spec-workflow/specs/spec-one/design.md', '# Design\n\nFind the needle in this file.\n');
    writeMd(rootA, 'docs/guide.md', '# Guide\n\nAnother needle reference.\n');
    writeMd(rootB, '.spec-workflow/specs/spec-two/design.md', '# Design\n\nA needle over here too.\n');
    const projectA = makeProject('proj-a', rootA);
    const projectB = makeProject('proj-b', rootB);
    await writeProjects({ v: 1, projects: [projectA, projectB] });

    const result = await search({ query: 'needle', project: 'proj-a' });

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits.every((h) => h.project === 'proj-a')).toBe(true);
    expect(result.hits.some((h) => h.path.endsWith('spec-one/design.md'))).toBe(true);
    expect(result.hits.some((h) => h.path.endsWith('guide.md'))).toBe(true);
    expect(result.hits.some((h) => h.path.endsWith('spec-two/design.md'))).toBe(false);
  });

  // Same filter battery, the spec filter. Pre-condition as above. Test:
  // search({ query: 'needle', spec: 'spec-one' }). Observable result: only
  // the spec-one chunk is present — proj-a's non-spec doc and proj-b's
  // spec-two chunk are both absent. Expected value source: Requirement 4
  // AC 3 and the task's Success line.
  it('filters hits to one spec before ranking', async () => {
    const rootA = projectRoot('sdd-advisor-search-filter-a-');
    const rootB = projectRoot('sdd-advisor-search-filter-b-');
    writeMd(rootA, '.spec-workflow/specs/spec-one/design.md', '# Design\n\nFind the needle in this file.\n');
    writeMd(rootA, 'docs/guide.md', '# Guide\n\nAnother needle reference.\n');
    writeMd(rootB, '.spec-workflow/specs/spec-two/design.md', '# Design\n\nA needle over here too.\n');
    const projectA = makeProject('proj-a', rootA);
    const projectB = makeProject('proj-b', rootB);
    await writeProjects({ v: 1, projects: [projectA, projectB] });

    const result = await search({ query: 'needle', spec: 'spec-one' });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].path.endsWith('spec-one/design.md')).toBe(true);
  });

  // Same filter battery, the kind filter. Pre-condition as above (design.md
  // under specs gets kind 'design'; docs/guide.md gets kind 'doc', per
  // task 8's corpus.ts). Test: search({ query: 'needle', kind: 'doc' }).
  // Observable result: only the doc chunk is present, both design chunks
  // absent. Expected value source: Requirement 4 AC 3 and the task's
  // Success line.
  it('filters hits to one kind before ranking', async () => {
    const rootA = projectRoot('sdd-advisor-search-filter-a-');
    const rootB = projectRoot('sdd-advisor-search-filter-b-');
    writeMd(rootA, '.spec-workflow/specs/spec-one/design.md', '# Design\n\nFind the needle in this file.\n');
    writeMd(rootA, 'docs/guide.md', '# Guide\n\nAnother needle reference.\n');
    writeMd(rootB, '.spec-workflow/specs/spec-two/design.md', '# Design\n\nA needle over here too.\n');
    const projectA = makeProject('proj-a', rootA);
    const projectB = makeProject('proj-b', rootB);
    await writeProjects({ v: 1, projects: [projectA, projectB] });

    const result = await search({ query: 'needle', kind: 'doc' });

    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].kind).toBe('doc');
    expect(result.hits[0].path.endsWith('guide.md')).toBe(true);
  });

  // Same filter battery, the date-range filter. Pre-condition: the two
  // design.md chunks are given an mtime of 2026-01-15 (no git repo in the
  // fixture, so corpus.ts falls back to mtime); guide.md is given
  // 2026-06-15. Test: search({ query: 'needle', from: '2026-01-01', to:
  // '2026-02-01' }). Observable result: both January chunks are present,
  // the June chunk absent. Expected value source: Requirement 4 AC 3 and the
  // task's Success line.
  it('filters hits to a date range before ranking', async () => {
    const rootA = projectRoot('sdd-advisor-search-filter-a-');
    const rootB = projectRoot('sdd-advisor-search-filter-b-');
    const designA = writeMd(rootA, '.spec-workflow/specs/spec-one/design.md', '# Design\n\nFind the needle in this file.\n');
    const guide = writeMd(rootA, 'docs/guide.md', '# Guide\n\nAnother needle reference.\n');
    const designB = writeMd(rootB, '.spec-workflow/specs/spec-two/design.md', '# Design\n\nA needle over here too.\n');
    setDate(designA, '2026-01-15T00:00:00.000Z');
    setDate(designB, '2026-01-15T00:00:00.000Z');
    setDate(guide, '2026-06-15T00:00:00.000Z');
    const projectA = makeProject('proj-a', rootA);
    const projectB = makeProject('proj-b', rootB);
    await writeProjects({ v: 1, projects: [projectA, projectB] });

    const result = await search({ query: 'needle', from: '2026-01-01', to: '2026-02-01' });

    expect(result.hits).toHaveLength(2);
    expect(result.hits.some((h) => h.path.endsWith('guide.md'))).toBe(false);
    expect(result.hits.every((h) => h.kind === 'design')).toBe(true);
  });

  // Requirement 4 AC 6 ("re-embed only files whose content hash changed ...
  // and drop entries for deleted files"), decomposed to the task's "only a
  // changed file re-embeds" Success item. Pre-condition: one project, two
  // files, one indexed round already run (so both have cached vectors).
  // Test: change fileB's content (new hash, new tag), clear the fake
  // server's request log, then search(q) again. Observable result: none of
  // round two's request bodies mention fileA's tag (its cached vector was
  // reused), but at least one mentions fileB's new tag (it was re-embedded).
  // Expected value source: Requirement 4 AC 6 and the task's Success line.
  it('re-embeds only the file whose content hash changed', async () => {
    const root = projectRoot('sdd-advisor-search-changed-');
    writeMd(root, '.spec-workflow/specs/demo/design.md', '# Design\n\nFoxglove notes. zzzvec-filea\n');
    writeMd(root, 'docs/guide.md', '# Guide\n\nMarigold report one. zzzvec-fileb-v1\n');
    const project = makeProject('proj-changed', root);
    await writeProjects({ v: 1, projects: [project] });

    const vectors = new Map([
      ['filea', vec(0.5)],
      ['fileb-v1', vec(0.5)],
      ['fileb-v2', vec(0.5)],
    ]);
    const fake = await startFakeOllama(vectors, vec(0.5));
    writeSearchConfig(fake.url);

    await search({ query: 'foxglove' });

    writeMd(root, 'docs/guide.md', '# Guide\n\nMarigold report two revised. zzzvec-fileb-v2\n');
    fake.requests.length = 0;

    await search({ query: 'foxglove' });

    const sentTexts = fake.requests.flatMap((r) => r.input);
    expect(sentTexts.some((t) => t.includes('zzzvec-filea'))).toBe(false);
    expect(sentTexts.some((t) => t.includes('zzzvec-fileb-v2'))).toBe(true);
  });

  // Requirement 4 AC 6's other half, decomposed to the task's "a deleted
  // file leaves the index" Success item. Pre-condition: one project, two
  // files indexed once with a reachable fake embedder (fileB contains the
  // unique word "zephyr"). Test: delete fileB from disk, then
  // search({ query: 'zephyr' }) again. Observable result: no hit for
  // fileB, and the on-disk advisor/index/<projectId>.json no longer lists
  // fileB's relative path under `files`. Expected value source:
  // Requirement 4 AC 6 ("drops entries for deleted files") and the task's
  // Success line.
  it('drops a deleted file from the index and the hits', async () => {
    const root = projectRoot('sdd-advisor-search-deleted-');
    writeMd(root, '.spec-workflow/specs/demo/design.md', '# Design\n\nFoxglove notes. zzzvec-filea\n');
    const guidePath = writeMd(root, 'docs/guide.md', '# Guide\n\nA zephyr passed through. zzzvec-fileb\n');
    const project = makeProject('proj-deleted', root);
    await writeProjects({ v: 1, projects: [project] });

    const vectors = new Map([['filea', vec(0.5)], ['fileb', vec(0.5)]]);
    const fake = await startFakeOllama(vectors, vec(0.5));
    writeSearchConfig(fake.url);

    const before = await search({ query: 'zephyr' });
    expect(before.hits.some((h) => h.path.endsWith('guide.md'))).toBe(true);

    unlinkSync(guidePath);

    const after = await search({ query: 'zephyr' });
    expect(after.hits.some((h) => h.path.endsWith('guide.md'))).toBe(false);

    const indexed = JSON.parse(readFileSync(join(advisorIndexDir(), 'proj-deleted.json'), 'utf-8')) as { files: Record<string, unknown> };
    const relPath = relative(root, guidePath);
    expect(Object.keys(indexed.files)).not.toContain(relPath);
  });

  // Requirement 4 AC 7 ("IF the embedding model is not installed THEN the
  // search SHALL return text hits only and say that meaning search is
  // off"), folding AC 4.5 (loopback-only, nothing leaves the machine) which
  // this same loopback check enforces. Pre-condition: search.json names a
  // non-loopback url; one project with a chunk sharing the query word.
  // Test: search({ query: 'beacon' }). Observable result:
  // result.meaning === 'off', the text hit is still present, and it carries
  // no meaningScore. Expected value source: Requirement 4 AC 7 (cited by the
  // task) and design.md C6 ("No embedder: meaning: 'off', text hits only").
  it('falls back to text-only hits when the embedder url is not loopback', async () => {
    const root = projectRoot('sdd-advisor-search-nonloopback-');
    writeMd(root, 'docs/guide.md', '# Guide\n\nA beacon shone over the bay.\n');
    const project = makeProject('proj-nonloopback', root);
    await writeProjects({ v: 1, projects: [project] });
    writeSearchConfig('http://example.invalid:11434');

    const result = await search({ query: 'beacon' });

    expect(result.meaning).toBe('off');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].meaningScore).toBeUndefined();
  });

  // Requirement 4 AC 4 ("WHEN a query is worded differently from a retro
  // finding that shares no key word with it THEN the finding SHALL be in
  // the first ten hits"). Pre-condition: a retrospective.md chunk (the
  // "finding") sharing zero words with the query; ten noise chunks sharing
  // 1..10 of the query's ten distinct words respectively (so without
  // meaning search the finding, scoring zero, would rank 11th — outside the
  // default limit of ten). The fake embedder gives the finding the single
  // highest cosine (meaning rank 1) and gives noise chunk i a cosine
  // decreasing in i, so the noise chunk with the single best text rank gets
  // the single worst meaning rank (the pairing least favourable to the
  // finding: by construction its fused RRF score, k=60, then exactly ties
  // the finding's and every other chunk scores strictly lower — worked
  // through in this file's commit notes). Test: search({ query: <the ten
  // words> }). Observable result: the finding's path is among the first ten
  // hits. Expected value source: Requirement 4 AC 4 (cited by the task,
  // "(4.4)" in its Success line) and design.md C6's reciprocal rank fusion
  // (k = 60).
  it("ranks a reworded query's matching retro finding in the first ten hits", async () => {
    const root = projectRoot('sdd-advisor-search-reworded-');
    const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet'];
    const query = words.join(' ');

    writeMd(
      root,
      '.spec-workflow/specs/demo/retrospective.md',
      '# Retrospective\n\n- **Finding 1.** The rollout needed a staged rollback plan before the quarter closed. zzzvec-target\n',
    );
    const vectors = new Map<string, number[]>([['target', vec(0.99)]]);
    for (let i = 1; i <= 10; i++) {
      writeMd(
        root,
        `docs/noise-${i}.md`,
        `# Noise ${i}\n\nFiller notes mentioning ${words.slice(0, i).join(' and ')} among other remarks. zzzvec-noise-${i}\n`,
      );
      vectors.set(`noise-${i}`, vec(0.9 - i * 0.08));
    }
    const project = makeProject('proj-reworded', root);
    await writeProjects({ v: 1, projects: [project] });

    const fake = await startFakeOllama(vectors, vec(1));
    writeSearchConfig(fake.url);

    const result = await search({ query });

    expect(result.hits.length).toBeLessThanOrEqual(10);
    expect(result.hits.some((h) => h.path.endsWith('retrospective.md'))).toBe(true);
  });

  // Design D12 ("Over 200 chunks to embed: text hits now, meaning: 'indexing
  // n of m', embedding continues in process"), cited by task 9's Prompt but
  // left untested there (fix round 1). Pre-condition: one project with 210
  // single-chunk files (no cache yet), all sharing the query word, and a
  // reachable fake embedder. Test: search({ query: 'sparrow' }) on the first,
  // never-indexed round. Observable result: the response carries text hits
  // immediately, no hit has a meaningScore (meaning search is skipped while
  // indexing), and `meaning` reports progress as "indexing <n> of 210" with
  // n capped at 200. After the background job finishes (awaited via the
  // test-only `waitForIndexing` hook so the fixture can be torn down safely),
  // a second search resolves with `meaning: 'on'`. Expected value source:
  // design.md C6 / D12 and requirements.md NFR Performance (bounding how much
  // embedding a single search call blocks on).
  it('returns text hits with an "indexing n of m" progress string past 200 chunks to embed, then finishes in the background', async () => {
    const root = projectRoot('sdd-advisor-search-indexing-');
    const total = 210;
    for (let i = 0; i < total; i++) {
      writeMd(root, `docs/note-${i}.md`, `# Note ${i}\n\nContent about sparrow number ${i}.\n`);
    }
    const project = makeProject('proj-indexing', root);
    await writeProjects({ v: 1, projects: [project] });

    const fake = await startFakeOllama(new Map(), vec(1));
    writeSearchConfig(fake.url);

    const first = await search({ query: 'sparrow' });

    expect(first.hits.length).toBeGreaterThan(0);
    expect(first.hits.every((h) => h.meaningScore === undefined)).toBe(true);
    const match = /^indexing (\d+) of (\d+)$/.exec(first.meaning);
    expect(match).not.toBeNull();
    expect(Number(match![2])).toBe(total);
    expect(Number(match![1])).toBeLessThanOrEqual(200);
    expect(Number(match![1])).toBeGreaterThan(0);

    await waitForIndexing();

    const second = await search({ query: 'sparrow' });
    expect(second.meaning).toBe('on');
  });

  // NFR Performance ("A search with no changed files SHALL return in under
  // 3 seconds"), decomposed to the task's "an unchanged corpus searches in
  // under 3 seconds" Success item. Pre-condition: one project with a small
  // corpus and a reachable fake embedder, indexed once already. Test: time
  // a second search(q) call with nothing changed on disk. Observable
  // result: the second call resolves in under 3000 ms. Expected value
  // source: the NFR Performance clause (cited by the task) and the task's
  // Success line.
  it('searches an unchanged corpus in under three seconds', async () => {
    const root = projectRoot('sdd-advisor-search-perf-');
    for (let i = 1; i <= 5; i++) {
      writeMd(root, `docs/note-${i}.md`, `# Note ${i}\n\nSome ping-related content number ${i}.\n`);
    }
    const project = makeProject('proj-perf', root);
    await writeProjects({ v: 1, projects: [project] });

    const fake = await startFakeOllama(new Map(), vec(1));
    writeSearchConfig(fake.url);

    await search({ query: 'ping' });

    const started = Date.now();
    await search({ query: 'ping' });
    const elapsed = Date.now() - started;

    expect(elapsed).toBeLessThan(3000);
  });
});
