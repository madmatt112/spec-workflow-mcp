import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { ShellFeed } from '../shell-feed.js';
import { writeRun, writeJsonAtomic, type RunRecord, type PrRead } from '../../../controller/state.js';
import { deployRecordPath, type ControllerDeploy } from '../../../controller/deploy.js';
import type { ProjectContext } from '../../project-manager.js';
import type { ProjectManager } from '../../project-manager.js';
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
// Criterion "snapshot order" (task 6 _Prompt: "snapshot() returns the last
//   pair, or [] before the first flush"):
//   Pre-condition: a fresh ShellFeed over no projects.
//   Test: feed.snapshot() before any flush, then again after feed.start().
//   Observable result: [] before start(); after start(), the message types
//   in order ['shell-now', 'shell-specs', 'controller-waits'] (T4 adds the
//   controller-waits message to the feed).
//   Expected-value source: the literal "[]" / "shell-now then shell-specs"
//   wording of the C7 interface and _Prompt sentences, plus T4's controller
//   waits message riding the same feed.
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
//
// Criterion "controller-actions joins the feed as the sixth message" (task
//   12 _Prompt: "the shell feed sends controller-actions with the action
//   list"; task 12 Count change: the five-message order becomes six,
//   controller-actions last):
//   Pre-condition: a fresh ShellFeed over no projects.
//   Test: feed.start(), then feed.snapshot().
//   Observable result: the snapshot's message types are
//   ['shell-now', 'shell-specs', 'controller-waits', 'controller-runs',
//   'controller-activity', 'controller-actions'] in that order.
//   Expected-value source: the task 12 Count change bullet's literal
//   "five-message order becomes six, controller-actions last".
//
// Criterion "one store read once per flush" (task 9 _Prompt: "In flush,
//   buildSpecRows runs once per group with the representative ... Spec
//   rows carry the representative's projectId and projectName";
//   Requirements 2.5, 2.7):
//   Pre-condition: two projects whose `workflowRootPath` is the same
//   shared string (so they share one store) but whose own spec
//   directories differ, named so the alphabetically-first project's name
//   is the representative.
//   Test: feed.start(), then read the shell-specs message of
//   feed.snapshot().
//   Observable result: the rows carry only the representative project's
//   id and only its own spec, not a second set of rows for the other
//   project on the same store.
//   Expected-value source: the literal "once per group with the
//   representative" of the C8/_Prompt sentence.
//
// Criterion "drivenRuns reaches the controller-runs row" (task 6 _Prompt:
//   "Add the `drivenRuns` option to `ShellFeed` ... whose flush passes its
//   result to `listRunsForWire`"; design C4; Requirements 1.9, 2.1, 2.2):
//   Pre-condition: one run record on disk, written through the controller
//   state, not yet driven on disk (driven lives only in controller memory).
//   Test: new ShellFeed(projects, send, { drivenRuns: () => <a set holding
//   the run's id> }).start(), then read the controller-runs message.
//   Observable result: the row for that run id reads `driven: true`.
//   Expected-value source: the literal "drivenRuns" option name and its
//   wiring to `listRunsForWire` in the _Prompt/design C4 text.

// Contract additions for task 10 (design.md C7; task 10 _Prompt; Requirements
// 4.12, 6.2, 6.9, NFR Performance). Reached only through `feed.start()`,
// `feed.pushDeploy(deploy)` and `feed.snapshot()`; `deployRecordPath()` and
// `writeJsonAtomic` (task 2) seed the record on disk the same way the
// self-update script would.
//
// Criterion "no record gives { deploy: null }" (task 10 _Prompt Success: "with
//   no record its data is { deploy: null }"):
//   Pre-condition: a fresh ShellFeed over no projects, no deploy.json on disk.
//   Test: feed.start(), then read the controller-deploy message of
//   feed.snapshot().
//   Observable result: its data is { deploy: null }.
//   Expected-value source: the literal "{ deploy: null }" of the _Prompt
//   sentence.
//
// Criterion "a seeded build record carries stage and no v or unitStarted"
//   (task 10 _Prompt Success: "with a seeded build record it carries
//   stage: 'build' and no v or unitStarted"):
//   Pre-condition: deploy.json written directly (writeJsonAtomic) with
//   v: 1, stage: 'build', runs: ['run-1'], started, unitStarted: true.
//   Test: feed.start(), then read the controller-deploy message of
//   feed.snapshot().
//   Observable result: its data is { deploy: { stage: 'build',
//   runs: ['run-1'], started } }, with no v or unitStarted key.
//   Expected-value source: the literal "stage: 'build'" / "no v or
//   unitStarted" of the _Prompt sentence, combined with the seeded fixture's
//   own runs/started values.
//
// Criterion "pushDeploy sends at once and snapshot holds it, still seven
//   long" (task 10 _Prompt Success: "pushDeploy sends one message at once
//   and snapshot() then holds the new value in place, still seven long"):
//   Pre-condition: a started ShellFeed over no projects.
//   Test: feed.pushDeploy(deploy), observed synchronously with no await.
//   Observable result: exactly one more message was sent, the last one being
//   { type: 'controller-deploy', data: { deploy } }; feed.snapshot() has
//   length 7 and its controller-deploy entry carries the same data.
//   Expected-value source: the literal "sends one message at once" / "still
//   seven long" of the _Prompt sentence.
//
// Criterion "pushDeploy after close sends nothing" (task 10 _Prompt Success:
//   "pushDeploy after close sends nothing"):
//   Pre-condition: a started, then closed, ShellFeed.
//   Test: feed.pushDeploy(deploy) after feed.close().
//   Observable result: the count of captured sends is unchanged.
//   Expected-value source: the literal "sends nothing" of the _Prompt
//   sentence.

// Contract additions for task 18 (design.md C6; task 18 _Prompt;
// Requirements 2.3, 2.4). Reached only through `feed.start()`,
// `feed.pushDeploy(deploy)` and `feed.snapshot()`.
//
// Criterion "flush sends exactly the five topics in order, shell-now and
//   controller-activity gone" (task 18 _Prompt: "Per design C6, flush
//   sends shell-specs, controller-waits, controller-runs, controller-actions
//   and controller-deploy"; Requirements 2.3, 2.4):
//   Pre-condition: a fresh ShellFeed over no projects.
//   Test: feed.snapshot() before any flush, then feed.start(), then
//   feed.snapshot() again.
//   Observable result: [] before start(); after start(), the message types
//   in order are exactly ['shell-specs', 'controller-waits',
//   'controller-runs', 'controller-actions', 'controller-deploy'] — an
//   exact-array equality that also proves no message is 'shell-now' or
//   'controller-activity'.
//   Expected-value source: the literal topic list of the task 18 _Prompt
//   sentence ("flush sends shell-specs, controller-waits, controller-runs,
//   controller-actions and controller-deploy").
//
// Criterion "pushDeploy keeps the snapshot five long" (task 18 Success:
//   "a pushDeploy keeps the snapshot five long"):
//   Pre-condition: a started ShellFeed over no projects.
//   Test: feed.pushDeploy(deploy), observed synchronously with no await.
//   Observable result: feed.snapshot() has length 5 and its
//   controller-deploy entry carries the pushed data.
//   Expected-value source: the literal "five long" of the task 18 Success
//   sentence.

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
  const project = {
    projectId: randomUUID(), projectName: name, projectPath, workspacePath: projectPath,
    workflowRootPath: projectPath,
  } as ProjectContext;
  return { project, specDir };
}

function stubProjects(projects: ProjectContext[]): ProjectManager {
  return { getAllProjects: () => projects } as unknown as ProjectManager;
}

/** A live controller run record for a project, written under the test's SDD home. */
function runRecord(project: ProjectContext, spec: string, id: string): RunRecord {
  const iso = '2026-01-01T00:00:00.000Z';
  return {
    v: 1, id, project: project.projectId, codeRoot: project.projectPath, specStore: project.projectPath, spec,
    worktree: project.projectPath, branch: `feat/${spec}`, status: 'running', created: iso, updated: iso,
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  };
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
    const feed = new ShellFeed(stubProjects([]), (m) => {
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

    expect(sends.some((m) => m.type === 'shell-specs')).toBe(true);
    expect(firstFlushAt! - t0).toBeLessThan(100);
  });

  it('carries a run record prReads on its controller-runs wire row within the throttle', async () => {
    const base = tmpBase();
    bases.push(base);
    const spec = 'pr-spec';
    const { project } = makeProject(base, spec);
    const reads: PrRead[] = [{
      kind: 'run', repo: 'spec-workflow-mcp', number: 42,
      url: 'https://example.test/pr/42', ci: 'green', mergeable: 'MERGEABLE',
      verdict: 'merged', reasons: ['all checks green'], sha: 'abc123',
      at: '2026-01-01T00:05:00.000Z',
    }];
    await writeRun({ ...runRecord(project, spec, 'run-pr'), prReads: reads });

    const sends: ShellMessage[] = [];
    const feed = new ShellFeed(stubProjects([project]), (m) => sends.push(m), {
      throttleMs: 20, tickMs: 1_000_000,
    });
    feeds.push(feed);

    await feed.start();

    await waitFor(() => {
      const latest = ofType(sends, 'controller-runs').slice(-1)[0];
      return !!latest?.data.runs.find((r) => r.id === 'run-pr')?.prReads?.length;
    });

    const latest = ofType(sends, 'controller-runs').slice(-1)[0];
    const row = latest.data.runs.find((r) => r.id === 'run-pr');
    expect(row?.prReads).toEqual(reads);
  });

  it('reaches the controller-runs row with driven: true when the run id is in drivenRuns', async () => {
    const base = tmpBase();
    bases.push(base);
    const spec = 'driven-spec';
    const { project } = makeProject(base, spec);
    await writeRun(runRecord(project, spec, 'run-driven'));

    const sends: ShellMessage[] = [];
    const feed = new ShellFeed(stubProjects([project]), (m) => sends.push(m), {
      throttleMs: 20, tickMs: 1_000_000, drivenRuns: () => new Set(['run-driven']),
    });
    feeds.push(feed);

    await feed.start();

    const latest = ofType(sends, 'controller-runs').slice(-1)[0];
    const row = latest.data.runs.find((r) => r.id === 'run-driven');
    expect(row?.driven).toBe(true);
  });

  it('returns [] before the first flush and the last shell-specs/controller-waits/controller-runs/controller-actions/controller-deploy quintet in order after it, with no shell-now or controller-activity', async () => {
    const feed = new ShellFeed(stubProjects([]), () => {}, { tickMs: 1_000_000 });
    feeds.push(feed);

    expect(feed.snapshot()).toEqual([]);

    await feed.start();
    const snap = feed.snapshot();
    expect(snap.map((m) => m.type)).toEqual([
      'shell-specs', 'controller-waits', 'controller-runs', 'controller-actions', 'controller-deploy',
    ]);
  });

  it('sends nothing for 200 ms once close() is called', async () => {
    const sends: ShellMessage[] = [];
    const feed = new ShellFeed(stubProjects([]), (m) => sends.push(m), { throttleMs: 10, tickMs: 15 });
    feeds.push(feed);

    await feed.start();
    const countAtClose = sends.length;

    feed.close();
    await sleep(200);

    expect(sends.length).toBe(countAtClose);
  });

  it('reads one shared store once: two projects on it send one set of spec rows carrying the representative\'s id', async () => {
    const base = tmpBase();
    bases.push(base);
    const shared = '/tmp/shared-store-for-test';
    const { project: alpha } = makeProject(base, 'spec-a', 'Alpha');
    const { project: zeta } = makeProject(base, 'spec-z', 'Zeta');
    (alpha as unknown as { workflowRootPath: string }).workflowRootPath = shared;
    (zeta as unknown as { workflowRootPath: string }).workflowRootPath = shared;

    const feed = new ShellFeed(stubProjects([zeta, alpha]), () => {}, { tickMs: 1_000_000 });
    feeds.push(feed);
    await feed.start();

    const specsMsg = ofType(feed.snapshot(), 'shell-specs')[0];
    expect(specsMsg).toBeDefined();
    const rows = specsMsg.data.rows;
    expect(rows.every((r) => r.projectId === alpha.projectId)).toBe(true);
    expect(rows.some((r) => r.spec === 'spec-z')).toBe(false);
    expect(rows.some((r) => r.spec === 'spec-a')).toBe(true);
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
      workflowRootPath: '/tmp/bad-project-store',
    } as unknown as ProjectContext;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const feed = new ShellFeed(stubProjects([goodProject, badProject]), () => {}, { tickMs: 1_000_000 });
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

  it('sends controller-deploy with { deploy: null } when no record exists on disk', async () => {
    const feed = new ShellFeed(stubProjects([]), () => {}, { tickMs: 1_000_000 });
    feeds.push(feed);

    await feed.start();

    const msg = ofType(feed.snapshot(), 'controller-deploy')[0];
    expect(msg).toBeDefined();
    expect(msg.data).toEqual({ deploy: null });
  });

  it('carries a seeded build-stage record on controller-deploy with no v or unitStarted', async () => {
    const started = '2026-11-05T00:00:00.000Z';
    await writeJsonAtomic(deployRecordPath(), {
      v: 1, stage: 'build', runs: ['run-1'], started, unitStarted: true,
    });

    const feed = new ShellFeed(stubProjects([]), () => {}, { tickMs: 1_000_000 });
    feeds.push(feed);

    await feed.start();

    const msg = ofType(feed.snapshot(), 'controller-deploy')[0];
    expect(msg).toBeDefined();
    expect(msg.data).toEqual({ deploy: { stage: 'build', runs: ['run-1'], started } });
  });

  it('pushDeploy sends controller-deploy at once and snapshot holds it, still five long', async () => {
    const sends: ShellMessage[] = [];
    const feed = new ShellFeed(stubProjects([]), (m) => sends.push(m), { tickMs: 1_000_000 });
    feeds.push(feed);
    await feed.start();
    const countAtStart = sends.length;

    const deploy: ControllerDeploy = { stage: 'build', runs: ['run-9'], started: '2026-11-05T00:00:00.000Z' };
    feed.pushDeploy(deploy);

    expect(sends.length).toBe(countAtStart + 1);
    expect(sends[sends.length - 1]).toEqual({ type: 'controller-deploy', data: { deploy } });

    const snap = feed.snapshot();
    expect(snap).toHaveLength(5);
    expect(ofType(snap, 'controller-deploy')[0]?.data).toEqual({ deploy });
  });

  it('pushDeploy after close sends nothing', async () => {
    const sends: ShellMessage[] = [];
    const feed = new ShellFeed(stubProjects([]), (m) => sends.push(m), { tickMs: 1_000_000 });
    feeds.push(feed);
    await feed.start();
    feed.close();
    const countAtClose = sends.length;

    feed.pushDeploy({ stage: 'done', runs: [], started: '2026-11-05T00:00:00.000Z' });

    expect(sends.length).toBe(countAtClose);
  });
});
