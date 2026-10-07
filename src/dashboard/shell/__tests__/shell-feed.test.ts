import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ShellFeed } from '../shell-feed.js';
import { pointerPath } from '../../harness/state-files.js';
import type { LedgerEvent } from '../../../watch/ledger.js';
import type { ProjectContext } from '../../project-manager.js';
import type { ProjectManager } from '../../project-manager.js';
import type { HarnessLauncher } from '../../harness/launcher.js';
import type { LaunchRecord } from '../../harness/types.js';
import type { ShellMessage } from '../types.js';

// Contract for src/dashboard/shell/shell-feed.ts (design.md C7; task 6
// _Prompt; Requirements 2.6, 3.9, 5.7).
//
// Reached only through `new ShellFeed(projects, launcher, send, opts).start()`,
// `.schedule()`, `.snapshot()` and `.close()`.
//
// Criterion "non-resetting throttle" (task 6 _Prompt: "`schedule()` arms one
//   `throttleMs` timer (default 1000) only when none is armed and never
//   resets an armed one ... a trigger every 10 ms with `throttleMs` 50 gives
//   a first flush within 100 ms (a resetting debounce would give none)";
//   Requirements 3.9, 5.7 — the bounded-latency flush both the Now page's
//   waits and the Specs rows ride on one mechanism):
//   Pre-condition: a fresh ShellFeed over no projects, `throttleMs: 50`,
//   `tickMs` effectively disabled; `schedule()` called every 10 ms.
//   Test: repeated feed.schedule() while timing the first `send` call.
//   Observable result: the first send arrives under 100 ms of the first
//   schedule() call, even though the trigger keeps firing past that point.
//   Expected-value source: the literal "within 100 ms" / "every 10 ms" /
//   "throttleMs 50" figures of the _Prompt sentence.
//
// Criterion "tick-driven quiet appear and clear" (task 6 _Prompt: "A tickMs
//   interval (default 30000...) calls schedule() ... with tickMs 50, an
//   open spawn under a pointer line, an activity mtime 14 minutes before
//   the injected now and then the injected now moved 2 minutes later, a
//   quiet wait appears with no file event, and moving the activity mtime
//   forward clears it on a later tick"; Requirement 2.6):
//   Pre-condition: one project with a pointer line naming a spec whose
//   ledger has an open (no spawn.end) spawn.start, and an activity file
//   whose mtime is 14 minutes before the injected `now`.
//   Test: feed.start() (one flush at the 14-minute gap), then the injected
//   `now` is moved 2 minutes later with no file touched, then the tick
//   interval alone drives further flushes.
//   Observable result: the latest shell-now message's `waits` has no
//   'quiet' entry for the spec right after start(); after the clock moves,
//   a later shell-now message's `waits` gains a 'quiet' entry for that spec
//   with no file having been written; after the activity file's mtime is
//   then moved forward, a still later shell-now message's `waits` has lost
//   that entry again.
//   Expected-value source: the 15-minute threshold design.md C3 states
//   (14 min < it, 16 min > it) combined with the fixture's own spec name.
//
// Criterion "snapshot order" (task 6 _Prompt: "snapshot() returns the last
//   pair, or [] before the first flush"):
//   Pre-condition: a fresh ShellFeed over no projects.
//   Test: feed.snapshot() before any flush, then again after feed.start().
//   Observable result: [] before start(); after start(), the two message
//   types in order ['shell-now', 'shell-specs'].
//   Expected-value source: the literal "[]" / "shell-now then shell-specs"
//   wording of the C7 interface and _Prompt sentences.
//
// Criterion "no send after close" (task 6 _Prompt: "close() clears both
//   timers and no send follows"):
//   Pre-condition: a ShellFeed with a short tickMs/throttleMs, started once.
//   Test: feed.close(), then wait 200 ms with no further call.
//   Observable result: the count of captured sends is unchanged across
//   that 200 ms wait.
//   Expected-value source: the literal "no send follows" of the _Prompt
//   sentence, falsified by any growth in the captured send count.
//
// Criterion "omitted project on a throwing spec-row read" (task 6 _Prompt:
//   "calls the spec-row builder task 4 exports for every project (a project
//   whose rows throw is left out and logged once)"):
//   Pre-condition: two projects, one with a normal spec directory and one
//   whose `projectPath` is not a string (so the task-4 builder throws
//   immediately when it joins the path).
//   Test: feed.start(), then read the shell-specs message of
//   feed.snapshot().
//   Observable result: its rows include the good project's id and exclude
//   the bad project's id; console.error was called at least once.
//   Expected-value source: the fixtures' own project ids, and the literal
//   "logged" requirement of the _Prompt sentence.

function waitFor(predicate: () => boolean, timeoutMs = 3000, intervalMs = 10): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (predicate()) { resolve(); return; }
      if (Date.now() > deadline) { reject(new Error('waitFor: timed out')); return; }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function ofType<T extends ShellMessage['type']>(
  messages: ShellMessage[],
  type: T,
): Extract<ShellMessage, { type: T }>[] {
  return messages.filter((m): m is Extract<ShellMessage, { type: T }> => m.type === type);
}

function tmpBase(): string {
  return mkdtempSync(join(tmpdir(), 'sdd-shell-feed-test-'));
}

function makeProject(base: string, spec: string, name = spec): { project: ProjectContext; specDir: string } {
  const projectPath = mkdtempSync(join(base, 'proj-'));
  const workflowRoot = join(projectPath, '.spec-workflow');
  const specDir = join(workflowRoot, 'specs', spec);
  mkdirSync(specDir, { recursive: true });
  const project = { projectId: randomUUID(), projectName: name, projectPath, workspacePath: projectPath } as ProjectContext;
  return { project, specDir };
}

function writeLedger(specDir: string, events: LedgerEvent[]): void {
  writeFileSync(join(specDir, 'harness-events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

/** An open (no spawn.end) spawn under `specDir`, plus an activity file with one tool row. */
function writeOpenSpawnFixture(specDir: string): string {
  const events: LedgerEvent[] = [
    { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: 'r1' },
    { ts: '2026-01-01T00:01:00.000Z', type: 'spawn.start', run: 'r1', agent: 'sdd-implementation-orchestrator', role: 'implementation phase, spawn 1' },
  ];
  writeLedger(specDir, events);
  const activityPath = join(specDir, 'harness-activity.jsonl');
  writeFileSync(activityPath, [
    JSON.stringify({ ts: '2026-01-01T00:01:00.000Z', agent: 'sdd-implementation-orchestrator', event: 'agent.start' }),
    JSON.stringify({ ts: '2026-01-01T00:02:00.000Z', agent: 'sdd-implementation-orchestrator', event: 'tool', tool: 'Read' }),
  ].join('\n') + '\n');
  return activityPath;
}

function stubProjects(projects: ProjectContext[]): ProjectManager {
  return { getAllProjects: () => projects } as unknown as ProjectManager;
}

function stubLauncher(get: (projectId: string) => LaunchRecord | null = () => null): HarnessLauncher {
  return { get } as unknown as HarnessLauncher;
}

describe('ShellFeed', () => {
  let xdgBase: string;
  let prevXdg: string | undefined;
  const bases: string[] = [];
  const feeds: { close: () => void }[] = [];

  beforeEach(() => {
    xdgBase = tmpBase();
    mkdirSync(join(xdgBase, 'sdd'), { recursive: true });
    prevXdg = process.env.XDG_STATE_HOME;
    process.env.XDG_STATE_HOME = xdgBase;
  });

  afterEach(() => {
    for (const f of feeds.splice(0)) {
      try { f.close(); } catch { /* already closed */ }
    }
    if (prevXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = prevXdg;
    rmSync(xdgBase, { recursive: true, force: true });
    for (const b of bases.splice(0)) rmSync(b, { recursive: true, force: true });
  });

  it('arms one non-resetting throttle timer, flushing within 100 ms of a steady 10 ms trigger stream', async () => {
    let firstFlushAt: number | null = null;
    const sends: ShellMessage[] = [];
    const feed = new ShellFeed(stubProjects([]), stubLauncher(), (m) => {
      sends.push(m);
      if (firstFlushAt === null) firstFlushAt = Date.now();
    }, { throttleMs: 50, tickMs: 1_000_000 });
    feeds.push(feed);

    const t0 = Date.now();
    const interval = setInterval(() => feed.schedule(), 10);
    try {
      await waitFor(() => firstFlushAt !== null, 500, 5);
    } finally {
      clearInterval(interval);
    }

    expect(sends.some((m) => m.type === 'shell-now')).toBe(true);
    expect(firstFlushAt! - t0).toBeLessThan(100);
  });

  it('shows a quiet wait only after the injected clock crosses the fifteen-minute gap, with no file event, then clears it once the activity mtime moves forward', async () => {
    const base = tmpBase();
    bases.push(base);
    const spec = 'quiet-spec';
    const { project, specDir } = makeProject(base, spec);
    const activityPath = writeOpenSpawnFixture(specDir);
    writeFileSync(pointerPath(), `/main/checkout\t${specDir}\trun-1\n`);

    const now0 = Date.now();
    const nowRef = { value: now0 };
    const fourteenMinAgo = new Date(now0 - 14 * 60 * 1000);
    utimesSync(activityPath, fourteenMinAgo, fourteenMinAgo);

    const sends: ShellMessage[] = [];
    const feed = new ShellFeed(stubProjects([project]), stubLauncher(), (m) => sends.push(m), {
      throttleMs: 20, tickMs: 50, now: () => nowRef.value,
    });
    feeds.push(feed);

    await feed.start();
    const afterStart = ofType(sends, 'shell-now').slice(-1)[0];
    expect(afterStart.data.waits.some((w) => w.kind === 'quiet' && w.spec === spec)).toBe(false);

    // Move the injected clock 2 minutes later with no file touched: the gap
    // is now 16 minutes, past the 15-minute threshold.
    nowRef.value = now0 + 2 * 60 * 1000;

    await waitFor(() => {
      const latest = ofType(sends, 'shell-now').slice(-1)[0];
      return latest.data.waits.some((w) => w.kind === 'quiet' && w.spec === spec);
    });

    // Fresh activity (mtime moved to the current injected now) clears it on
    // a later tick.
    const fresh = new Date(nowRef.value);
    utimesSync(activityPath, fresh, fresh);

    await waitFor(() => {
      const latest = ofType(sends, 'shell-now').slice(-1)[0];
      return !latest.data.waits.some((w) => w.kind === 'quiet' && w.spec === spec);
    });
  });

  it('returns [] before the first flush and the last shell-now/shell-specs pair in order after it', async () => {
    const feed = new ShellFeed(stubProjects([]), stubLauncher(), () => {}, { tickMs: 1_000_000 });
    feeds.push(feed);

    expect(feed.snapshot()).toEqual([]);

    await feed.start();
    const snap = feed.snapshot();
    expect(snap.map((m) => m.type)).toEqual(['shell-now', 'shell-specs']);
  });

  it('sends nothing for 200 ms once close() is called', async () => {
    const sends: ShellMessage[] = [];
    const feed = new ShellFeed(stubProjects([]), stubLauncher(), (m) => sends.push(m), { throttleMs: 10, tickMs: 15 });
    feeds.push(feed);

    await feed.start();
    const countAtClose = sends.length;

    feed.close();
    await sleep(200);

    expect(sends.length).toBe(countAtClose);
  });

  it('omits a project whose spec rows throw from shell-specs while the other project keeps its rows, and logs once', async () => {
    const base = tmpBase();
    bases.push(base);
    const { project: goodProject } = makeProject(base, 'spec-a', 'Good Project');
    const badProject = {
      projectId: randomUUID(),
      projectName: 'Bad Project',
      projectPath: undefined,
      workspacePath: '/tmp',
    } as unknown as ProjectContext;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const feed = new ShellFeed(stubProjects([goodProject, badProject]), stubLauncher(), () => {}, { tickMs: 1_000_000 });
      feeds.push(feed);

      await feed.start();
      const specsMsg = ofType(feed.snapshot(), 'shell-specs')[0];
      expect(specsMsg).toBeDefined();
      const rows = specsMsg.data.rows;
      expect(rows.some((r) => r.projectId === goodProject.projectId)).toBe(true);
      expect(rows.some((r) => r.projectId === badProject.projectId)).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });
});
