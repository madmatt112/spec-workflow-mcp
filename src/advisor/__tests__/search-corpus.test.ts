import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeProjects, writeWait } from '../../controller/state.js';
import type { KnownProject, WaitRecord } from '../../controller/state.js';
import { listCorpus, chunk } from '../search/corpus.js';
import { textSearch } from '../search/text.js';

// Contract for src/advisor/search/corpus.ts and src/advisor/search/text.ts
// (design.md C6; requirements.md Requirement 4 AC 1, AC 3; tasks.md task 8).
//
// listCorpus(projects: KnownProject[]): Promise<CorpusFile[]> walks, for every
// given project, `.spec-workflow/**/*.md`, `docs/**/*.md` and `GLOSSARY.md`
// under that project's root, plus the home `waits/*.json` (found the same way
// `listWaits`, src/controller/state.ts:372, does, via `controllerHome()`).
// Never `advisor/notes/` and never anything outside those named trees (no
// session-transcript sweep). Each entry is `{ project, path, kind, date }`
// where `path` identifies the file (used later as `Hit.path`) and `kind` is
// derived from the path: `.spec-workflow/specs/*/requirements.md` ->
// 'requirements', `design.md` -> 'design', `tasks.md` -> 'tasks',
// `retrospective.md` -> 'retro', `.spec-workflow/deferrals/*.md` ->
// 'deferral', `docs/adr/*.md` -> 'ADR', any other `docs/**/*.md` or
// `GLOSSARY.md` -> 'doc', a home wait file -> 'wait'.
//
// chunk(file: CorpusFile): Promise<Chunk[]> splits that file's content at
// level 1-3 Markdown headings, capping every chunk at 60 lines (a run that
// stays under one heading for longer is cut into further <=60-line windows);
// a wait is always exactly one chunk. Each `Chunk` is `{ project, path, kind,
// date, startLine, endLine, text }` (1-based, inclusive line numbers).
//
// textSearch(chunks: Chunk[], query: string): Hit[] scores each chunk by the
// query's distinct words of three or more letters with stop words removed
// (one point per distinct word present in the chunk's `text`), plus one more
// point when the chunk's `text` contains the whole query phrase as a
// contiguous substring (case-insensitive). `Hit.textScore` and `Hit.score`
// both carry this value (no meaning score exists yet at this task). Results
// are sorted by score, highest first.
//
// Every test runs against a fresh temp SDD_HOME (`writeProjects`, `writeWait`
// write real files there) and fresh temp project roots, so the real home and
// repo are never touched.

let home: string;
let savedSddHome: string | undefined;
let extraDirs: string[];

beforeEach(() => {
  savedSddHome = process.env.SDD_HOME;
  home = mkdtempSync(join(tmpdir(), 'sdd-advisor-search-home-'));
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

function makeWait(id: string, project: string): WaitRecord {
  return {
    v: 1,
    id,
    kind: 'question',
    run: 'run-1',
    project,
    spec: 'demo',
    created: '2026-02-01T00:00:00.000Z',
    questions: [{ id: 'q1', text: 'Proceed?' }],
    state: 'open',
  };
}

describe('src/advisor/search/corpus.ts and text.ts', () => {
  // AC 4.1 ("Session transcripts and the advisor notebook SHALL NOT be
  // indexed") decomposed with the task's named corpus definition (every known
  // project's `.spec-workflow/**/*.md` plus the home wait records). Two known
  // projects each hold one eligible requirements.md plus a decoy md file
  // outside any of the named trees (a stand-in session transcript); the home
  // holds one eligible wait plus decoy notebook files under `advisor/notes/`.
  // Test: listCorpus(projects) for both projects. Observable result: the
  // returned list holds exactly the two requirements.md entries and the one
  // wait entry (length 3) and no entry's path mentions the decoy trees.
  // Expected value source: requirements.md Requirement 4 AC 1 and the task's
  // Restriction line ("Never list session transcripts or the home
  // advisor/notes/").
  it('excludes session transcripts and the advisor notebook from the corpus', async () => {
    const rootA = projectRoot('sdd-advisor-search-proj-a-');
    const rootB = projectRoot('sdd-advisor-search-proj-b-');
    writeMd(rootA, '.spec-workflow/specs/demo/requirements.md', '# Requirements\n\nSome content.\n');
    writeMd(rootB, '.spec-workflow/specs/demo/requirements.md', '# Requirements\n\nOther content.\n');
    // Decoys: a stand-in session transcript outside every named tree.
    writeMd(rootA, 'transcripts/session-abc.md', '# Transcript\n\nShould never be listed.\n');

    const projects = [makeProject('proj-a', rootA), makeProject('proj-b', rootB)];
    await writeProjects({ v: 1, projects });
    await writeWait(makeWait('w1', 'proj-a'));
    // Decoys: the advisor notebook, never indexed.
    writeMd(home, 'advisor/notes/thread-1.md', '# Thread\n\nShould never be listed.\n');
    writeMd(home, 'advisor/notes/index.md', '# Index\n\nShould never be listed.\n');

    const files = await listCorpus(projects);

    expect(files).toHaveLength(3);
    expect(files.some((f) => f.path.endsWith('requirements.md') && f.project === 'proj-a')).toBe(true);
    expect(files.some((f) => f.path.endsWith('requirements.md') && f.project === 'proj-b')).toBe(true);
    expect(files.some((f) => f.kind === 'wait')).toBe(true);
    expect(files.some((f) => f.path.includes('notes'))).toBe(false);
    expect(files.some((f) => f.path.includes('transcripts'))).toBe(false);
  });

  // AC 4.1's corpus definition plus AC 4.3's kind vocabulary (requirements,
  // design, tasks, retro, deferral, ADR, doc, wait), decomposed to the task's
  // named success: an ADR under docs/adr/ gets kind ADR, contrasted with an
  // ordinary docs file and GLOSSARY.md (both 'doc'). Pre-condition: one
  // project with docs/adr/0001-example.md, docs/guide.md and GLOSSARY.md.
  // Test: listCorpus([project]). Observable result: the adr entry's kind is
  // 'ADR'; the other two entries' kind is 'doc'. Expected value source: the
  // task's Success line ("an ADR under docs/adr/ gets kind ADR") and
  // requirements.md Requirement 4 AC 3's kind list.
  it('gives an ADR under docs/adr/ kind ADR, distinct from an ordinary doc', async () => {
    const root = projectRoot('sdd-advisor-search-proj-adr-');
    writeMd(root, 'docs/adr/0001-example.md', '# ADR 0001\n\nExample decision.\n');
    writeMd(root, 'docs/guide.md', '# Guide\n\nHow to use it.\n');
    writeMd(root, 'GLOSSARY.md', '# Glossary\n\nTerm: definition.\n');

    const project = makeProject('proj-adr', root);
    await writeProjects({ v: 1, projects: [project] });

    const files = await listCorpus([project]);

    const adr = files.find((f) => f.path.endsWith('docs/adr/0001-example.md'));
    const guide = files.find((f) => f.path.endsWith('docs/guide.md'));
    const glossary = files.find((f) => f.path.endsWith('GLOSSARY.md'));

    expect(adr?.kind).toBe('ADR');
    expect(guide?.kind).toBe('doc');
    expect(glossary?.kind).toBe('doc');
  });

  // Task's named success: "a 150-line section splits into chunks of at most
  // 60 lines". Pre-condition: one project file with a single level-1 heading
  // followed by 150 lines of body and no further heading (one section, no
  // sub-split from headings alone). Test: listCorpus([project]) to get the
  // file's CorpusFile, then chunk(file). Observable result: more than one
  // chunk results (the 151-line section was actually split, not kept whole),
  // every chunk spans at most 60 lines, and the chunks cover the file
  // contiguously from line 1 to line 151 with no gap or overlap. Expected
  // value source: design.md C6 ("chunk splits ... at most 60 lines") and the
  // task's Success line.
  it('splits a 150-line section into chunks of at most 60 lines', async () => {
    const root = projectRoot('sdd-advisor-search-proj-chunk-');
    const bodyLines = Array.from({ length: 150 }, (_, i) => `Line ${i + 1} of the section body.`);
    writeMd(root, '.spec-workflow/specs/demo/design.md', ['# Design', ...bodyLines].join('\n') + '\n');

    const project = makeProject('proj-chunk', root);
    await writeProjects({ v: 1, projects: [project] });

    const files = await listCorpus([project]);
    const target = files.find((f) => f.path.endsWith('design.md'));
    expect(target).toBeDefined();

    const chunks = await chunk(target!);
    const sorted = [...chunks].sort((a, b) => a.startLine - b.startLine);

    expect(sorted.length).toBeGreaterThan(1);
    for (const c of sorted) {
      expect(c.endLine - c.startLine + 1).toBeLessThanOrEqual(60);
    }
    expect(sorted[0].startLine).toBe(1);
    expect(sorted[sorted.length - 1].endLine).toBe(151);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startLine).toBe(sorted[i - 1].endLine + 1);
    }
  });

  // Task's named success: "the phrase bonus ranks an exact-phrase chunk
  // first". Pre-condition: two hand-built chunks for the query "merge rule
  // confirmation" (three distinct words, each >= 3 letters, none a stop
  // word): one contains all three words scattered with no contiguous phrase
  // (word score 3, no phrase bonus); the other contains the exact phrase
  // "merge rule confirmation" as a contiguous substring, plus the same three
  // words (word score 3, plus the phrase bonus). Test: textSearch([scattered,
  // phrased], 'merge rule confirmation'). Observable result: the phrased
  // chunk's hit is first, with score 4; the scattered chunk's hit is second,
  // with score 3. Expected value source: design.md C6 ("Text score: distinct
  // query words ... plus one for the whole phrase") and the task's Success
  // line.
  it('ranks the exact-phrase chunk first via the phrase bonus', () => {
    const scattered = {
      project: 'proj-text',
      path: 'scattered.md',
      kind: 'doc',
      date: '2026-03-01T00:00:00.000Z',
      startLine: 1,
      endLine: 5,
      text: 'The merge happened under a rule, with confirmation pending for later.',
    };
    const phrased = {
      project: 'proj-text',
      path: 'phrased.md',
      kind: 'doc',
      date: '2026-03-01T00:00:00.000Z',
      startLine: 1,
      endLine: 5,
      text: 'We require merge rule confirmation before anything proceeds.',
    };

    const hits = textSearch([scattered, phrased], 'merge rule confirmation');

    expect(hits[0].path).toBe('phrased.md');
    expect(hits[0].score).toBe(4);
    expect(hits[0].textScore).toBe(4);
    const second = hits.find((h) => h.path === 'scattered.md');
    expect(second?.score).toBe(3);
  });
});
