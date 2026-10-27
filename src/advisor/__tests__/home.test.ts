import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join, sep } from 'path';
import { tmpdir } from 'os';
import { controllerHome } from '../../controller/state.js';
import {
  advisorHomeDir,
  advisorNotesDir,
  advisorActionsDir,
  advisorOpinionsDir,
  advisorIndexDir,
  advisorSessionPath,
  sourcesPath,
  pushConfigPath,
  searchPath,
  pushedPath,
  eventsPath,
  appendEvent,
  type HomeEvent,
} from '../home.js';

// Contract for src/advisor/home.ts (design.md C1; requirements.md NFR
// Reliability). Each test runs against a fresh temp SDD_HOME so the real
// home is never touched; controllerHome() reads the environment at call
// time (src/controller/state.ts:238-243).

let home: string;
let savedSddHome: string | undefined;

beforeEach(async () => {
  savedSddHome = process.env.SDD_HOME;
  home = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-home-'));
  process.env.SDD_HOME = home;
});

afterEach(async () => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  await fs.rm(home, { recursive: true, force: true });
});

function readLines(contents: string): string[] {
  return contents.split('\n').filter((line) => line.length > 0);
}

describe('src/advisor/home.ts', () => {
  // AC (task 1 Success, item 1): every path function returns a path under
  // controllerHome(). Pre-condition: SDD_HOME points at the temp `home`.
  // Test: call each of the eleven path functions named in the task's
  // _Prompt. Observable result: every returned path is controllerHome()
  // itself (the advisor/ directory) or sits strictly under it. Expected
  // value source: the task's file list (advisor/, advisor/notes/,
  // advisor/actions/, advisor/opinions/, advisor/index/, advisor/session.json,
  // sources.json, push.json, search.json, pushed.json, events.jsonl) plus
  // design C1 ("all under controllerHome()").
  it('names every home path under controllerHome()', () => {
    const root = controllerHome();
    const under = (p: string) => p === root || p.startsWith(root + sep);

    expect(under(advisorHomeDir())).toBe(true);
    expect(under(advisorNotesDir())).toBe(true);
    expect(under(advisorActionsDir())).toBe(true);
    expect(under(advisorOpinionsDir())).toBe(true);
    expect(under(advisorIndexDir())).toBe(true);
    expect(under(advisorSessionPath())).toBe(true);
    expect(under(sourcesPath())).toBe(true);
    expect(under(pushConfigPath())).toBe(true);
    expect(under(searchPath())).toBe(true);
    expect(under(pushedPath())).toBe(true);
    expect(under(eventsPath())).toBe(true);

    // Each path names the file or directory the task lists, not a sibling.
    expect(advisorNotesDir()).toBe(join(advisorHomeDir(), 'notes'));
    expect(advisorActionsDir()).toBe(join(advisorHomeDir(), 'actions'));
    expect(advisorOpinionsDir()).toBe(join(advisorHomeDir(), 'opinions'));
    expect(advisorIndexDir()).toBe(join(advisorHomeDir(), 'index'));
    expect(advisorSessionPath()).toBe(join(advisorHomeDir(), 'session.json'));
    expect(sourcesPath()).toBe(join(root, 'sources.json'));
    expect(pushConfigPath()).toBe(join(root, 'push.json'));
    expect(searchPath()).toBe(join(root, 'search.json'));
    expect(pushedPath()).toBe(join(root, 'pushed.json'));
    expect(eventsPath()).toBe(join(root, 'events.jsonl'));
  });

  // AC (task 1 Success, item 2). Pre-condition: temp SDD_HOME, no
  // events.jsonl yet. Test: two appendEvent(row) calls with distinct
  // push.failure rows. Observable result: eventsPath() holds exactly two
  // newline-separated lines, each JSON.parse()-able with v === 1, a string
  // ts and the row's type, and each line's own fields distinguishable (first
  // line is rowA, second is rowB). Expected value source: requirements.md
  // NFR Reliability ("one JSON object per line, each carrying v: 1, a time
  // and a type") and the task Success line.
  it('appends two appendEvent calls as two parseable lines', async () => {
    const rowA: HomeEvent = { v: 1, ts: '2026-10-26T10:00:00.000Z', type: 'push.failure', wait: 'wait-a', detail: 'first failure' };
    const rowB: HomeEvent = { v: 1, ts: '2026-10-26T10:00:01.000Z', type: 'push.failure', wait: 'wait-b', detail: 'second failure' };

    await appendEvent(rowA);
    await appendEvent(rowB);

    const contents = await fs.readFile(eventsPath(), 'utf-8');
    const lines = readLines(contents);
    expect(lines).toHaveLength(2);

    const parsedA = JSON.parse(lines[0]);
    const parsedB = JSON.parse(lines[1]);

    expect(parsedA.v).toBe(1);
    expect(typeof parsedA.ts).toBe('string');
    expect(parsedA.type).toBe('push.failure');
    expect(parsedA.wait).toBe('wait-a');

    expect(parsedB.v).toBe(1);
    expect(typeof parsedB.ts).toBe('string');
    expect(parsedB.type).toBe('push.failure');
    expect(parsedB.wait).toBe('wait-b');
  });

  // AC (task 1 Success, item 3). Pre-condition: temp SDD_HOME. Test: one
  // appendEvent(row) call whose detail field is far larger than 4,096 bytes.
  // Observable result: the single written line is at most 4,096 bytes
  // (Buffer.byteLength) and still parses with v === 1, the row's type and
  // wait intact, and a shortened detail. Expected value source: design C1
  // ("a row over 4,096 bytes has its detail cut to fit") and requirements.md
  // NFR Reliability.
  it('cuts an oversize detail so the appended line stays at or under 4096 bytes', async () => {
    const hugeDetail = 'x'.repeat(10_000);
    const row: HomeEvent = { v: 1, ts: '2026-10-26T10:00:00.000Z', type: 'push.failure', wait: 'wait-huge', detail: hugeDetail };

    await appendEvent(row);

    const contents = await fs.readFile(eventsPath(), 'utf-8');
    const lines = readLines(contents);
    expect(lines).toHaveLength(1);

    const line = lines[0];
    expect(Buffer.byteLength(line, 'utf-8')).toBeLessThanOrEqual(4096);

    const parsed = JSON.parse(line);
    expect(parsed.v).toBe(1);
    expect(parsed.type).toBe('push.failure');
    expect(parsed.wait).toBe('wait-huge');
    expect(typeof parsed.detail).toBe('string');
    expect(parsed.detail.length).toBeLessThan(hugeDetail.length);
  });
});
