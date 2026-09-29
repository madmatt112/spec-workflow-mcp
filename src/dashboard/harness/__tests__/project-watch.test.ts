import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { promises as fsp, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { parseHandoffRouting, parseGateSections, ProjectHarnessWatch } from '../project-watch.js';
import { buildModel, parseJsonl, AGENT_PROFILES } from '../../../watch/ledger.js';
import type { LedgerEvent } from '../../../watch/ledger.js';
import type { HarnessLauncher } from '../launcher.js';
import type { LaunchRecord, HarnessMessage } from '../types.js';
import type { ProjectContext } from '../../project-manager.js';

// Contract for src/dashboard/harness/project-watch.ts (design.md C5 interfaces;
// task 3 _Prompt; Requirements 1.3, 4.5).
//
// Criterion "full header" (task 3 _Prompt: "spec comes from
//   parseHandoffActiveSpec … phase, state and result come from the header
//   line of formats.md:76"; Requirement 1 AC 3):
//   Pre-condition: a HANDOFF routing header with the Active spec line and the
//   `Live phase **X**, state **Y**, last result **Z**.` line, both prefixed
//   with the `> ` blockquote marker as formats.md:75-76 shows.
//   Test: parseHandoffRouting(md).
//   Observable result: { spec: 'harness-control-pane', phase: 'document',
//   state: 'in-progress', result: 'gate-a' }.
//   Expected-value source: the literal field values written into the fixture
//   header, per the formats.md:75-76 line grammar.
//
// Criterion "spec with no live-phase line" (task 3 _Prompt: "each null when
//   the line or its field is missing"; Requirement 1 AC 3):
//   Pre-condition: a HANDOFF header with the Active spec line but no `Live
//   phase …` line at all.
//   Test: parseHandoffRouting(md).
//   Observable result: { spec: 'other-spec', phase: null, state: null,
//   result: null }.
//   Expected-value source: the _Prompt sentence ("each null when the line …
//   is missing").
//
// Criterion "no header" (task 3 _Prompt: "the spec comes from
//   parseHandoffActiveSpec … and null means no spec"):
//   Pre-condition: a markdown document with no "Active spec **`…`**" text at
//   all (parseHandoffActiveSpec, src/watch/ledger.ts:219-223, returns
//   undefined for it).
//   Test: parseHandoffRouting(md).
//   Observable result: null.
//   Expected-value source: the _Prompt sentence ("null means no spec").
//
// Criterion "undefined input" (task 3 _Prompt, same sentence):
//   Pre-condition: none.
//   Test: parseHandoffRouting(undefined).
//   Observable result: null.
//   Expected-value source: the _Prompt sentence ("null means no spec").
//
// Criterion "Gate A only" (task 3 _Prompt: "the trimmed text under a `## Gate
//   A` or `## Gate B` heading up to the next `## ` heading, null when the
//   heading or the input is missing"; Requirement 4 AC 5):
//   Pre-condition: a markdown document with a `## Gate A` heading and body
//   text, and no `## Gate B` heading anywhere.
//   Test: parseGateSections(md).
//   Observable result: { gateA: '1. **Question** — some question?\n   -
//   answer: yes', gateB: null }.
//   Expected-value source: the _Prompt sentence (trimmed text under the
//   heading to the next `## ` heading, or end of input; null for a missing
//   heading).
//
// Criterion "both sections" (same _Prompt sentence; Requirement 4 AC 5):
//   Pre-condition: a markdown document with both a `## Gate A` heading
//   followed by body text and a `## Gate B` heading followed by different
//   body text.
//   Test: parseGateSections(md).
//   Observable result: { gateA: 'Question A text here.', gateB: 'Question B
//   text here.' }.
//   Expected-value source: the _Prompt sentence (trimmed text under each
//   heading, Gate A stopping at the next `## ` heading, Gate B running to end
//   of input).
//
// Criterion "neither section" (same _Prompt sentence):
//   Pre-condition: a markdown document with no `## Gate A` or `## Gate B`
//   heading.
//   Test: parseGateSections(md).
//   Observable result: { gateA: null, gateB: null }.
//   Expected-value source: the _Prompt sentence ("null when the heading … is
//   missing").

describe('project-watch parsers', () => {
  describe('parseHandoffRouting', () => {
    it('reads spec, phase, state and result from a full HANDOFF header', () => {
      const md = [
        '> **READ FIRST — SDD routing (2026-09-29, harness v4).** Active spec **`harness-control-pane`**.',
        '> Live phase **document**, state **in-progress**, last result **gate-a**.',
        '> Roots: spec store `/tmp/foo/.spec-workflow`, code `/tmp/foo`.',
        '> A re-run does: continue the sdd process.',
      ].join('\n');

      expect(parseHandoffRouting(md)).toEqual({
        spec: 'harness-control-pane',
        phase: 'document',
        state: 'in-progress',
        result: 'gate-a',
      });
    });

    it('returns null phase, state and result when the header has a spec but no live-phase line', () => {
      const md = [
        '> **READ FIRST — SDD routing (2026-09-29, harness v4).** Active spec **`other-spec`**.',
        '> Roots: spec store `/tmp/foo/.spec-workflow`, code `/tmp/foo`.',
      ].join('\n');

      expect(parseHandoffRouting(md)).toEqual({
        spec: 'other-spec',
        phase: null,
        state: null,
        result: null,
      });
    });

    it('returns null when the HANDOFF has no routing header', () => {
      const md = '# Just a document\n\nSome prose with no routing header.';

      expect(parseHandoffRouting(md)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseHandoffRouting(undefined)).toBeNull();
    });
  });

  describe('parseGateSections', () => {
    it('returns the Gate A text and null Gate B when only Gate A is present', () => {
      const md = [
        '# Questions — some-spec',
        '',
        '## Gate A',
        '',
        '1. **Question** — some question?',
        '   - answer: yes',
      ].join('\n');

      expect(parseGateSections(md)).toEqual({
        gateA: '1. **Question** — some question?\n   - answer: yes',
        gateB: null,
      });
    });

    it('returns both sections trimmed, Gate A stopping at the Gate B heading', () => {
      const md = [
        '# Questions — some-spec',
        '',
        '## Gate A',
        '',
        'Question A text here.',
        '',
        '## Gate B',
        '',
        'Question B text here.',
      ].join('\n');

      expect(parseGateSections(md)).toEqual({
        gateA: 'Question A text here.',
        gateB: 'Question B text here.',
      });
    });

    it('returns null for both sections when neither heading is present', () => {
      const md = '# Questions — some-spec\n\nNo gate sections here, just prose.';

      expect(parseGateSections(md)).toEqual({ gateA: null, gateB: null });
    });
  });
});

// Contract additions for task 7 (design.md C5; task 7 _Prompt; Requirements
// 3.5, 3.6, 4.1, 4.2, 4.3, 4.5, 4.6, 6.1, 6.2). Every test drives the real
// `ProjectHarnessWatch` against real files on a temp directory; the only stub
// is the launcher (task 7 _Prompt: "a stub launcher: an EventEmitter with
// `get` and a `noteRunId` spy, cast through `unknown` to the task 5 class"),
// which is the class's constructor-injected collaborator, not a mock of
// project-watch.ts itself.
//
// Criterion "parity: the sent model deep-equals buildModel over the same
//   fixture ledger, activity, tasks and HANDOFF, and the gates message
//   matches parseGateSections of questions.md" (task 7 _Prompt "Tests" item
//   1; Requirements 6.2, 4.5):
//   Pre-condition: a spec directory with a ledger (`run.start`, `phase.start`,
//   `spawn.start`), no activity file, a `tasks.md`, a HANDOFF naming the spec,
//   and a `questions.md` with only a `## Gate A` section; a stub launcher
//   whose `get` returns null.
//   Test: `new ProjectHarnessWatch(project, launcher, send).start()`.
//   Observable result: the sent `harness-model`'s `data.model` deep-equals
//   `buildModel({ spec, ledger: parseJsonl(ledgerText), activity: [], tasksMd,
//   handoffMd })` computed from the same fixture text; `data.profiles` equals
//   `AGENT_PROFILES`; `data.launch` is null; the sent `harness-gates`'s `data`
//   equals `{ spec, gateA: 'Some gate A question?', gateB: null }`.
//   Expected-value source: `buildModel` (src/watch/ledger.ts:243) called
//   directly on the fixture text, and `parseGateSections` (task 3) on the
//   fixture questions.md, per task 7 _Prompt ("the rebuild reads the four
//   files the way renderOnce does ... calls buildModel, and sends
//   harness-model ... and harness-gates from parseGateSections").
//
// Criterion "a ledger append gives a new harness-model within five seconds"
//   (task 7 _Prompt "Tests" item 2; Requirements 4.1, 4.2):
//   Pre-condition: a started watch (`debounceMs: 50`) over a minimal fixture
//   whose ledger holds one `run.start`.
//   Test: append a `phase.start` row for that run to the ledger file, then
//   poll `send`'s captured messages.
//   Observable result: within five seconds a new `harness-model` arrives
//   whose `data.model.livePhase.phase` is `'document'` (the appended phase).
//   Expected-value source: task 7 _Prompt ("Any change schedules one rebuild
//   after debounceMs") and Requirement 4 AC 2 ("push it ... within five
//   seconds of the append").
//
// Criterion "log lines arrive in order and a partial line waits for its
//   newline" (task 7 _Prompt "Tests" item 3; Requirement 3.5):
//   Pre-condition: a stub launcher whose `get` returns a launch record
//   pointing at an empty log file.
//   Test: append `'line1\n'`, wait for a `harness-log`; then append
//   `'partial'` with no trailing newline and wait briefly; then append
//   `'-done\n'`.
//   Observable result: the first `harness-log`'s `data` is `{ launchedAt,
//   lines: ['line1'], reset: false }`; after the bare `'partial'` append no
//   second `harness-log` appears; after the completing append exactly one
//   more `harness-log` arrives with `data` `{ launchedAt, lines:
//   ['partial-done'], reset: false }`.
//   Expected-value source: task 7 _Prompt ("send only complete lines as one
//   harness-log batch with the record's launchedAt and reset: false, hold a
//   partial tail until its newline").
//
// Criterion "an update with the same log path resets nothing" (task 7
//   _Prompt "Tests" item 4; design.md C5; tasks D10; Requirement 3.5):
//   Pre-condition: a started watch already reading a log at a fixed path,
//   with one complete line already sent.
//   Test: `launcher.emit('launch-update', { ...record, state: 'stopping' })`
//   (same `logPath`), then append a further line to the log.
//   Observable result: no `harness-log` with `reset: true` is ever sent; the
//   `harness-log` that follows the further append carries only that new line
//   (`['second']`), proving the byte offset was not reset to 0 (no repeat of
//   the earlier line).
//   Expected-value source: task 7 _Prompt ("an update with the same logPath
//   ... resets nothing (design C5)").
//
// Criterion "a new-path update sends a reset: true batch with the new
//   launchedAt and lines from offset 0" (task 7 _Prompt "Tests" item 5;
//   design.md C5; Requirement 3.5):
//   Pre-condition: a started watch on one log path; a second log file already
//   holding one line (`'seed\n'`) at a different path; the stub launcher's
//   `get` now returns a record naming that second path and a new
//   `launchedAt`.
//   Test: `launcher.emit('launch-update', newRecord)`.
//   Observable result: a `harness-log` arrives whose `data` equals `{
//   launchedAt: newRecord.launchedAt, lines: ['seed'], reset: true }`.
//   Expected-value source: task 7 _Prompt ("re-derives the path from
//   launcher.get(projectId), sets the offset to 0, clears the kept lines,
//   re-arms the log file watch and sends a reset: true batch with the new
//   launchedAt").
//
// Criterion "a HANDOFF naming another spec re-targets" (task 7 _Prompt;
//   design.md C5 "a HANDOFF naming another spec re-targets the watcher"):
//   Pre-condition: two spec directories (`spec-f`, `spec-g`), each with its
//   own `run.start` and `tasks.md`; a HANDOFF naming `spec-f`.
//   Test: after the first `harness-model` for `spec-f` arrives, rewrite
//   HANDOFF to name `spec-g`.
//   Observable result: a later `harness-model` arrives with `data.spec ===
//   'spec-g'` whose `data.model` deep-equals `buildModel` over `spec-g`'s own
//   fixture files.
//   Expected-value source: `buildModel` computed directly from `spec-g`'s
//   fixture text, per task 7 _Prompt ("When HANDOFF names another spec,
//   close the spec file watches and watch the new spec's files").
//
// Criterion "noteRunId is called with the run id" (task 7 _Prompt;
//   Requirement 3.6):
//   Pre-condition: a launch record with `runId: null` and a `launchedAt`
//   earlier than the ledger's `run.start` timestamp for a run id
//   `'run-noted'`.
//   Test: start the watch and poll the stub launcher's `noteRunId` spy.
//   Observable result: `noteRunId` is called with `(project.projectId,
//   'run-noted')`.
//   Expected-value source: task 7 _Prompt ("When the model's run id is set,
//   its runStartedAt is at or after the record's launchedAt and the record's
//   run id differs, call launcher.noteRunId (Req 3.6)").
//
// Criterion "nothing is sent after close()" (task 7 _Prompt):
//   Pre-condition: a started watch that has sent its initial `harness-model`.
//   Test: call `close()`, then append to the ledger and emit a
//   `launch-update`, and wait past the debounce window.
//   Observable result: the count of messages captured by `send` is unchanged
//   from immediately after `close()`.
//   Expected-value source: task 7 _Prompt ("close() closes the watchers,
//   clears timers and removes the launcher listener").

function waitFor(predicate: () => boolean, timeoutMs = 5000, intervalMs = 20): Promise<void> {
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

function handoffFixture(spec: string, phase = 'document', state = 'in-progress', result = 'gate-a'): string {
  return [
    `> **READ FIRST — SDD routing.** Active spec **\`${spec}\`**.`,
    `> Live phase **${phase}**, state **${state}**, last result **${result}**.`,
  ].join('\n');
}

function ofType<T extends HarnessMessage['type']>(
  messages: HarnessMessage[],
  type: T,
): Extract<HarnessMessage, { type: T }>[] {
  return messages.filter((m): m is Extract<HarnessMessage, { type: T }> => m.type === type);
}

function makeLaunchRecord(overrides: Partial<LaunchRecord> & { projectId: string; logPath: string; launchedAt: string }): LaunchRecord {
  return {
    workflowRoot: '/unused',
    spec: 'demo-spec',
    pid: process.pid,
    pgid: process.pid,
    cwd: '/unused',
    worktree: 'no',
    setupWrittenAt: overrides.launchedAt,
    runId: null,
    state: 'running',
    exitCode: null,
    signal: null,
    stopRequestedAt: null,
    endedAt: null,
    note: null,
    ...overrides,
  };
}

describe('ProjectHarnessWatch', () => {
  let base: string;
  const watches: { close: () => void }[] = [];

  beforeEach(async () => {
    base = await fsp.mkdtemp(join(tmpdir(), 'project-watch-test-'));
  });

  afterEach(async () => {
    for (const w of watches.splice(0)) {
      try { w.close(); } catch { /* already closed */ }
    }
    await fsp.rm(base, { recursive: true, force: true });
  });

  async function makeProject(spec: string): Promise<{ project: ProjectContext; workflowRoot: string; specDir: string }> {
    const projectPath = await fsp.mkdtemp(join(base, 'proj-'));
    const workflowRoot = join(projectPath, '.spec-workflow');
    const specDir = join(workflowRoot, 'specs', spec);
    mkdirSync(specDir, { recursive: true });
    const project = { projectId: randomUUID(), projectPath, workspacePath: projectPath } as ProjectContext;
    return { project, workflowRoot, specDir };
  }

  /** A run.start-only ledger, tasks.md and a HANDOFF naming the spec. */
  function writeMinimalFixture(workflowRoot: string, specDir: string, spec: string, runId: string, runStartTs: string): string {
    const ledgerPath = join(specDir, 'harness-events.jsonl');
    writeFileSync(ledgerPath, JSON.stringify({ ts: runStartTs, type: 'run.start', run: runId, spec }) + '\n');
    writeFileSync(join(specDir, 'tasks.md'), '- [ ] 1. Task one\n');
    writeFileSync(join(workflowRoot, 'HANDOFF.md'), handoffFixture(spec));
    return ledgerPath;
  }

  function stubLauncher(get: (projectId: string) => LaunchRecord | null, noteRunId = vi.fn()): { launcher: HarnessLauncher; noteRunId: ReturnType<typeof vi.fn> } {
    const emitter = Object.assign(new EventEmitter(), { get, noteRunId });
    return { launcher: emitter as unknown as HarnessLauncher, noteRunId };
  }

  it('sends a harness-model matching buildModel and a harness-gates matching parseGateSections over the same fixtures', async () => {
    const { project, workflowRoot, specDir } = await makeProject('spec-a');
    const runId = 'run-20260101-000000';
    const ledgerEvents = [
      { ts: '2026-01-01T00:00:00.000Z', type: 'run.start', run: runId, spec: 'spec-a', model: 'claude-test', codeRoot: '/tmp/spec-a', worktree: 'no', headless: 'yes' },
      { ts: '2026-01-01T00:00:05.000Z', type: 'phase.start', run: runId, phase: 'document', mode: 'auto', state: 'in-progress' },
      { ts: '2026-01-01T00:00:10.000Z', type: 'spawn.start', run: runId, agent: 'sdd-document-orchestrator', role: 'orchestrator', phase: 'document' },
    ] satisfies LedgerEvent[];
    const ledgerText = ledgerEvents.map((e) => JSON.stringify(e)).join('\n') + '\n';
    writeFileSync(join(specDir, 'harness-events.jsonl'), ledgerText);
    const tasksText = '- [x] 1. Do thing\n- [ ] 2. Another thing\n';
    writeFileSync(join(specDir, 'tasks.md'), tasksText);
    const handoffText = handoffFixture('spec-a');
    writeFileSync(join(workflowRoot, 'HANDOFF.md'), handoffText);
    const questionsText = ['## Gate A', '', 'Some gate A question?', ''].join('\n');
    writeFileSync(join(specDir, 'questions.md'), questionsText);

    const messages: HarnessMessage[] = [];
    const { launcher } = stubLauncher(() => null);
    const watch = new ProjectHarnessWatch(project, launcher, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);

    await watch.start();
    await waitFor(() => ofType(messages, 'harness-model').length > 0 && ofType(messages, 'harness-gates').length > 0);

    const modelMsg = ofType(messages, 'harness-model')[0];
    const expectedModel = buildModel({
      spec: 'spec-a',
      ledger: parseJsonl(ledgerText),
      activity: [],
      tasksMd: tasksText,
      handoffMd: handoffText,
    });
    expect(modelMsg.data.spec).toBe('spec-a');
    expect(modelMsg.data.model).toEqual(expectedModel);
    expect(modelMsg.data.profiles).toEqual(AGENT_PROFILES);
    expect(modelMsg.data.launch).toBeNull();

    const gatesMsg = ofType(messages, 'harness-gates')[0];
    expect(gatesMsg.data).toEqual({ spec: 'spec-a', gateA: 'Some gate A question?', gateB: null });
  }, 15000);

  it('sends a new harness-model within five seconds of a ledger append (debounce 50ms)', async () => {
    const { project, workflowRoot, specDir } = await makeProject('spec-b');
    const runId = 'run-b';
    const runStartTs = new Date(Date.now() - 60000).toISOString();
    const ledgerPath = writeMinimalFixture(workflowRoot, specDir, 'spec-b', runId, runStartTs);

    const messages: HarnessMessage[] = [];
    const { launcher } = stubLauncher(() => null);
    const watch = new ProjectHarnessWatch(project, launcher, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);

    await watch.start();
    await waitFor(() => ofType(messages, 'harness-model').length > 0);
    const before = ofType(messages, 'harness-model').length;

    appendFileSync(ledgerPath, JSON.stringify({ ts: new Date().toISOString(), type: 'phase.start', run: runId, phase: 'document', mode: 'auto', state: 'in-progress' }) + '\n');
    await waitFor(() => ofType(messages, 'harness-model').length > before, 5000);

    const latest = ofType(messages, 'harness-model').slice(-1)[0];
    expect(latest.data.model?.livePhase?.phase).toBe('document');
  }, 15000);

  it('sends complete log lines in order and holds a partial line until its newline', async () => {
    const { project, workflowRoot, specDir } = await makeProject('spec-c');
    writeMinimalFixture(workflowRoot, specDir, 'spec-c', 'run-c', new Date(Date.now() - 60000).toISOString());

    const logPath = join(base, 'run-c.log');
    writeFileSync(logPath, '');
    const launchedAt = new Date().toISOString();
    const record = makeLaunchRecord({ projectId: project.projectId, logPath, launchedAt });

    const messages: HarnessMessage[] = [];
    const { launcher } = stubLauncher(() => record);
    const watch = new ProjectHarnessWatch(project, launcher, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);

    await watch.start();
    await waitFor(() => ofType(messages, 'harness-model').length > 0);

    appendFileSync(logPath, 'line1\n');
    await waitFor(() => ofType(messages, 'harness-log').length === 1, 5000);
    expect(ofType(messages, 'harness-log')[0].data).toEqual({ launchedAt, lines: ['line1'], reset: false });

    appendFileSync(logPath, 'partial');
    await sleep(600);
    expect(ofType(messages, 'harness-log').length).toBe(1);

    appendFileSync(logPath, '-done\n');
    await waitFor(() => ofType(messages, 'harness-log').length === 2, 5000);
    expect(ofType(messages, 'harness-log')[1].data).toEqual({ launchedAt, lines: ['partial-done'], reset: false });
  }, 15000);

  it('sends no reset when a launch-update names the same log path', async () => {
    const { project, workflowRoot, specDir } = await makeProject('spec-d');
    writeMinimalFixture(workflowRoot, specDir, 'spec-d', 'run-d', new Date(Date.now() - 60000).toISOString());

    const logPath = join(base, 'run-d.log');
    writeFileSync(logPath, '');
    const launchedAt = new Date().toISOString();
    const record = makeLaunchRecord({ projectId: project.projectId, logPath, launchedAt });

    const messages: HarnessMessage[] = [];
    const { launcher } = stubLauncher(() => record);
    const watch = new ProjectHarnessWatch(project, launcher, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);

    await watch.start();
    await waitFor(() => ofType(messages, 'harness-model').length > 0);

    appendFileSync(logPath, 'first\n');
    await waitFor(() => ofType(messages, 'harness-log').length === 1, 5000);
    expect(ofType(messages, 'harness-log')[0].data).toEqual({ launchedAt, lines: ['first'], reset: false });

    launcher.emit('launch-update', { ...record, state: 'stopping', stopRequestedAt: new Date().toISOString() });
    await sleep(500);
    expect(ofType(messages, 'harness-log').some((m) => m.data.reset)).toBe(false);

    appendFileSync(logPath, 'second\n');
    await waitFor(() => ofType(messages, 'harness-log').length === 2, 5000);
    expect(ofType(messages, 'harness-log')[1].data).toEqual({ launchedAt, lines: ['second'], reset: false });
  }, 15000);

  it('sends a reset batch with the new launchedAt and lines from offset 0 when a launch-update names a new log path', async () => {
    const { project, workflowRoot, specDir } = await makeProject('spec-e');
    writeMinimalFixture(workflowRoot, specDir, 'spec-e', 'run-e', new Date(Date.now() - 60000).toISOString());

    const logPathA = join(base, 'run-e-a.log');
    writeFileSync(logPathA, '');
    const launchedAtA = new Date(Date.now() - 30000).toISOString();
    let record = makeLaunchRecord({ projectId: project.projectId, logPath: logPathA, launchedAt: launchedAtA });

    const messages: HarnessMessage[] = [];
    const { launcher } = stubLauncher(() => record);
    const watch = new ProjectHarnessWatch(project, launcher, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);

    await watch.start();
    await waitFor(() => ofType(messages, 'harness-model').length > 0);

    const logPathB = join(base, 'run-e-b.log');
    writeFileSync(logPathB, 'seed\n');
    const launchedAtB = new Date().toISOString();
    record = makeLaunchRecord({ projectId: project.projectId, logPath: logPathB, launchedAt: launchedAtB });

    launcher.emit('launch-update', record);
    await waitFor(() => ofType(messages, 'harness-log').some((m) => m.data.reset === true), 5000);

    const resetMsg = ofType(messages, 'harness-log').find((m) => m.data.reset === true)!;
    expect(resetMsg.data).toEqual({ launchedAt: launchedAtB, lines: ['seed'], reset: true });
  }, 15000);

  it('re-targets its spec watches when HANDOFF names another spec', async () => {
    const { project, workflowRoot, specDir: specFDir } = await makeProject('spec-f');
    const specGDir = join(workflowRoot, 'specs', 'spec-g');
    mkdirSync(specGDir, { recursive: true });

    const ledgerFText = JSON.stringify({ ts: '2026-02-01T00:00:00.000Z', type: 'run.start', run: 'run-f', spec: 'spec-f' }) + '\n';
    writeFileSync(join(specFDir, 'harness-events.jsonl'), ledgerFText);
    const tasksFText = '- [ ] 1. F task\n';
    writeFileSync(join(specFDir, 'tasks.md'), tasksFText);

    const ledgerGText = JSON.stringify({ ts: '2026-02-02T00:00:00.000Z', type: 'run.start', run: 'run-g', spec: 'spec-g' }) + '\n';
    writeFileSync(join(specGDir, 'harness-events.jsonl'), ledgerGText);
    const tasksGText = '- [ ] 1. G task\n';
    writeFileSync(join(specGDir, 'tasks.md'), tasksGText);

    const handoffPath = join(workflowRoot, 'HANDOFF.md');
    writeFileSync(handoffPath, handoffFixture('spec-f'));

    const messages: HarnessMessage[] = [];
    const { launcher } = stubLauncher(() => null);
    const watch = new ProjectHarnessWatch(project, launcher, (m) => messages.push(m), { debounceMs: 50 });
    watches.push(watch);

    await watch.start();
    await waitFor(() => ofType(messages, 'harness-model').some((m) => m.data.spec === 'spec-f'));

    const handoffGText = handoffFixture('spec-g');
    writeFileSync(handoffPath, handoffGText);
    await waitFor(() => ofType(messages, 'harness-model').some((m) => m.data.spec === 'spec-g'), 5000);

    const gMsg = ofType(messages, 'harness-model').filter((m) => m.data.spec === 'spec-g').slice(-1)[0];
    const expectedG = buildModel({
      spec: 'spec-g',
      ledger: parseJsonl(ledgerGText),
      activity: [],
      tasksMd: tasksGText,
      handoffMd: handoffGText,
    });
    expect(gMsg.data.model).toEqual(expectedG);
  }, 15000);

  it("calls launcher.noteRunId with the run id once the model's run id differs from the record's", async () => {
    const { project, workflowRoot, specDir } = await makeProject('spec-h');
    const runStartTs = new Date().toISOString();
    writeMinimalFixture(workflowRoot, specDir, 'spec-h', 'run-noted', runStartTs);

    const logPath = join(base, 'run-h.log');
    writeFileSync(logPath, '');
    const launchedAt = new Date(Date.parse(runStartTs) - 5000).toISOString();
    const record = makeLaunchRecord({ projectId: project.projectId, logPath, launchedAt, runId: null });

    const { launcher, noteRunId } = stubLauncher(() => record);
    const watch = new ProjectHarnessWatch(project, launcher, () => {}, { debounceMs: 50 });
    watches.push(watch);

    await watch.start();
    await waitFor(() => noteRunId.mock.calls.length > 0, 5000);

    expect(noteRunId).toHaveBeenCalledWith(project.projectId, 'run-noted');
  }, 15000);

  it('sends nothing after close()', async () => {
    const { project, workflowRoot, specDir } = await makeProject('spec-i');
    const ledgerPath = writeMinimalFixture(workflowRoot, specDir, 'spec-i', 'run-i', new Date(Date.now() - 60000).toISOString());

    const messages: HarnessMessage[] = [];
    const { launcher } = stubLauncher(() => null);
    const watch = new ProjectHarnessWatch(project, launcher, (m) => messages.push(m), { debounceMs: 50 });

    await watch.start();
    await waitFor(() => ofType(messages, 'harness-model').length > 0);

    watch.close();
    const countAfterClose = messages.length;

    appendFileSync(ledgerPath, JSON.stringify({ ts: new Date().toISOString(), type: 'phase.start', run: 'run-i', phase: 'design' }) + '\n');
    launcher.emit('launch-update', makeLaunchRecord({ projectId: project.projectId, logPath: join(base, 'unused.log'), launchedAt: new Date().toISOString() }));
    await sleep(800);

    expect(messages.length).toBe(countAfterClose);
  }, 15000);
});
