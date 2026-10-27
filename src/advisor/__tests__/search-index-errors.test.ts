import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeProjects } from '../../controller/state.js';
import type { KnownProject } from '../../controller/state.js';
import { advisorIndexDir } from '../home.js';
import { refreshIndex, waitForIndexing } from '../search/index.js';
import type { Embedder } from '../search/embed.js';

// Fixes for task 9's review-task v2 findings (reviewId
// 02d40401-27a2-41d7-81d9-6208150d7329): the WARNING (index.ts:237 —
// embedDeferred had no try/catch, so an embedder failure mid-background-job
// was an unhandled rejection that would crash the host process; design
// Error Handling #7 says refresh stops and the index keeps what it wrote)
// and the INFO (index.ts:124/197 — a no-embedder round forced model: '',
// wiping the cached vectors of every project index).

let home: string;
let savedSddHome: string | undefined;
let extraDirs: string[];

beforeEach(() => {
  savedSddHome = process.env.SDD_HOME;
  home = mkdtempSync(join(tmpdir(), 'sdd-advisor-index-errors-home-'));
  process.env.SDD_HOME = home;
  extraDirs = [];
});

afterEach(() => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
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

function writeMd(root: string, relPath: string, content: string): void {
  const full = join(root, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content, 'utf-8');
}

interface OnDiskIndex {
  model: string;
  files: Record<string, { chunks: { vector?: string }[] }>;
}

function readOnDiskIndex(projectId: string): OnDiskIndex {
  return JSON.parse(readFileSync(join(advisorIndexDir(), `${projectId}.json`), 'utf-8')) as OnDiskIndex;
}

describe('src/advisor/search/index.ts background-job and no-embedder error handling', () => {
  it('stops and keeps what it already wrote when the embedder fails mid-background-job, without crashing', async () => {
    const root = projectRoot('sdd-advisor-index-crash-');
    const total = 210;
    for (let i = 0; i < total; i++) {
      writeMd(root, `docs/note-${i}.md`, `# Note ${i}\n\nContent number ${i}.\n`);
    }
    const project = makeProject('proj-crash', root);
    await writeProjects({ v: 1, projects: [project] });

    let calls = 0;
    const embedder: Embedder = {
      model: 'fake-model',
      embed: async (texts: string[]) => {
        calls += 1;
        // Let the synchronous first-200 embed and the background job's first
        // two calls succeed, then simulate the embedder going unreachable.
        if (calls > 202) throw new Error('embedder unreachable');
        return texts.map(() => [1, 0]);
      },
    };

    await refreshIndex(embedder);
    await expect(waitForIndexing()).resolves.toBeUndefined();

    const indexed = readOnDiskIndex('proj-crash');
    const embeddedCount = Object.values(indexed.files).filter((f) => f.chunks[0]?.vector !== undefined).length;
    expect(embeddedCount).toBeGreaterThan(0);
    expect(embeddedCount).toBeLessThan(total);
  });

  it('keeps the cached vectors through a round with no embedder, instead of wiping the index', async () => {
    const root = projectRoot('sdd-advisor-index-noembed-');
    writeMd(root, 'docs/guide.md', '# Guide\n\nSome content.\n');
    const project = makeProject('proj-noembed', root);
    await writeProjects({ v: 1, projects: [project] });

    let calls = 0;
    const embedder: Embedder = {
      model: 'fake-model',
      embed: async (texts: string[]) => {
        calls += 1;
        return texts.map(() => [1, 0]);
      },
    };

    await refreshIndex(embedder);
    expect(calls).toBe(1);

    await refreshIndex(null);

    const afterNoEmbedder = readOnDiskIndex('proj-noembed');
    expect(afterNoEmbedder.model).toBe('fake-model');
    expect(afterNoEmbedder.files['docs/guide.md'].chunks[0].vector).toBeDefined();

    await refreshIndex(embedder);
    expect(calls).toBe(1);
  });
});
