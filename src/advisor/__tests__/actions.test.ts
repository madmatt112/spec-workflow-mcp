import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { stageAction, listActions, confirmAction, dismissAction, actionEvents } from '../actions.js';
import { eventsPath } from '../home.js';
import { createWait } from '../../controller/waits.js';
import { readWait, controllerHome } from '../../controller/state.js';
import { DeferralStorage } from '../../core/deferral-storage.js';

// Contract for src/advisor/actions.ts (design.md C8; requirements.md
// Requirement 6 AC 1, AC 2, AC 3, AC 5, AC 8, AC 10). Each test runs
// against a fresh temp SDD_HOME so the real home is never touched, and a
// scratch git repo stands in for a project when a test needs one (the
// deferral and decomposition executors commit under that project's store
// lock). No collaborator inside src/advisor/actions.ts is mocked: the real
// createWait/answerWait (src/controller/waits.ts), DeferralStorage.create
// (src/core/deferral-storage.ts) and checkpoint (src/controller/ledger.ts,
// reached through confirmAction) all run for real against these temp dirs.
//
// Per success criterion (task 10 Success line):
//   (a) "a staged action is listed"                         -> list test
//   (b) "dismiss marks it dismissed and a later confirm
//        gets a not-staged refusal"                          -> dismiss test
//   (c) "a second confirm is refused"                        -> double-confirm test
//   (d) "answer stores by advisor"                           -> answer test
//   (e) "deferral and decomposition each make one commit"    -> deferral + decomposition tests
//   (f) "backlog appends one line"                           -> backlog test
//   (g) "each confirm writes one advisor.action row with
//        action, kind, target, conversation and outcome"     -> folded into (d), (e)x2, (f):
//        each of those four tests also reads events.jsonl and checks the
//        advisor.action row's action/kind/target/conversation/outcome fields,
//        rather than getting its own standalone test.
//
// `owner-backlog.md`'s path (home/owner-backlog.md) and dated-line format
// (`- YYYY-MM-DD: <text>`) are not pinned by any requirement or design
// line beyond "append one dated line to owner-backlog.md in the home" (C8)
// and D18 ("a plain append with no commit"); this file fixes that shape so
// the test is a concrete contract, not because the design names it.

let home: string;
let savedSddHome: string | undefined;

beforeEach(async () => {
  savedSddHome = process.env.SDD_HOME;
  home = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-actions-'));
  process.env.SDD_HOME = home;
});

afterEach(async () => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  await fs.rm(home, { recursive: true, force: true });
});

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8' });
}

/** A project git repo, `.spec-workflow/` seeded and committed, for deferral/decomposition. */
function initProjectRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'sdd-advisor-proj-'));
  mkdirSync(join(repo, '.spec-workflow', 'spec-decomposition'), { recursive: true });
  writeFileSync(
    join(repo, '.spec-workflow', 'spec-decomposition', 'decomposition.md'),
    [
      '## Specs',
      '',
      '### 1. `existing-spec` — something already planned (active)',
      '',
      'Existing body.',
      '',
      '## Build order',
      '',
      '1. existing-spec',
      '',
    ].join('\n'),
    'utf-8',
  );
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'Test']);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'init']);
  return repo;
}

function commitCount(repo: string): number {
  return git(repo, ['log', '--oneline']).trim().split('\n').filter((l) => l.length > 0).length;
}

async function readEventRows(): Promise<any[]> {
  let contents: string;
  try {
    contents = await fs.readFile(eventsPath(), 'utf-8');
  } catch {
    return [];
  }
  return contents.split('\n').filter((l) => l.length > 0).map((l) => JSON.parse(l));
}

/** A deps object whose projectPath throws, proving a kind that never needs the
 * project store (answer, backlog) never looks one up. */
const noProjectDeps = {
  projectPath(): string {
    throw new Error('projectPath should not be called for this kind');
  },
};

describe('src/advisor/actions.ts', () => {
  // (a) Requirement 6 AC 2: "WHEN the advisor stages an action THEN the
  // controller SHALL store it in the home with its kind, target, parameters,
  // the advisor's reason, the conversation id and state `staged`, and the
  // dashboard SHALL list it." Pre-condition: temp SDD_HOME, no actions yet.
  // Test: stageAction({kind:'backlog', target:{}, params:{text}, reason,
  // conversation}), then listActions(). Observable result: stageAction
  // returns a record with v:1, an `a-`-prefixed id, and the given kind,
  // target, params, reason, conversation and state 'staged'; listActions()
  // includes a record with that same id and those same fields. Expected
  // value source: design.md Data Models `StagedAction` shape and Requirement
  // 6 AC 2's field list.
  it('stores a staged action with its kind, target, params, reason and conversation, and lists it', async () => {
    const staged = await stageAction({
      kind: 'backlog',
      target: {},
      params: { text: 'Check the nightly export job' },
      reason: 'Noticed while reading the retro',
      conversation: 'conv-list',
    });

    expect(staged.v).toBe(1);
    expect(staged.id).toMatch(/^a-[0-9a-f]{8}$/);
    expect(staged.kind).toBe('backlog');
    expect(staged.target).toEqual({});
    expect(staged.params).toEqual({ text: 'Check the nightly export job' });
    expect(staged.reason).toBe('Noticed while reading the retro');
    expect(staged.conversation).toBe('conv-list');
    expect(staged.state).toBe('staged');
    expect(typeof staged.created).toBe('string');
    expect(Number.isNaN(Date.parse(staged.created))).toBe(false);

    const listed = await listActions();
    const found = listed.find((a) => a.id === staged.id);
    expect(found).toBeDefined();
    expect(found!.kind).toBe('backlog');
    expect(found!.params).toEqual({ text: 'Check the nightly export job' });
    expect(found!.reason).toBe('Noticed while reading the retro');
    expect(found!.conversation).toBe('conv-list');
    expect(found!.state).toBe('staged');
  });

  // (b) Requirement 6 AC 3: "WHEN the operator dismisses it THEN it SHALL be
  // marked `dismissed` and never run"; Success line: "a later confirm gets a
  // not-staged refusal". Pre-condition: one staged backlog action, no
  // owner-backlog.md yet. Test: dismissAction(id), then confirmAction(id,
  // deps). Observable result: dismissAction's returned record (and the
  // listed one) has state 'dismissed'; confirmAction returns a not-staged
  // refusal (`ok: false`); owner-backlog.md is never created (the dismissed
  // action's executor never ran). Expected value source: Requirement 6 AC 3
  // and the task Success line's "not-staged refusal" wording.
  it('dismiss marks an action dismissed, and never runs it: a later confirm is a not-staged refusal', async () => {
    const staged = await stageAction({
      kind: 'backlog',
      target: {},
      params: { text: 'This must never be written' },
      reason: 'dismiss test',
      conversation: 'conv-dismiss',
    });

    const dismissed = await dismissAction(staged.id);
    expect(dismissed?.state).toBe('dismissed');

    const listed = await listActions();
    expect(listed.find((a) => a.id === staged.id)?.state).toBe('dismissed');

    const result = await confirmAction(staged.id, noProjectDeps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not-staged');

    const backlogPath = join(controllerHome(), 'owner-backlog.md');
    await expect(fs.access(backlogPath)).rejects.toThrow();
  });

  // (c) Design C8 ("409 on an action not `staged`"); Success line: "a second
  // confirm is refused". Pre-condition: one staged backlog action. Test:
  // confirmAction(id, deps) twice in a row. Observable result: the first
  // confirm succeeds (`ok: true`, one new owner-backlog.md line); the second
  // confirm on the same id returns a not-staged refusal and does not append a
  // second line. Expected value source: design.md C8's confirm-route
  // behaviour, restated at the store level, and the task Success line.
  it('refuses a second confirm of the same action: it ran only once', async () => {
    const staged = await stageAction({
      kind: 'backlog',
      target: {},
      params: { text: 'Only once' },
      reason: 'double confirm test',
      conversation: 'conv-second',
    });

    const first = await confirmAction(staged.id, noProjectDeps);
    expect(first.ok).toBe(true);

    const second = await confirmAction(staged.id, noProjectDeps);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toBe('not-staged');

    const backlogPath = join(controllerHome(), 'owner-backlog.md');
    const lines = (await fs.readFile(backlogPath, 'utf-8')).split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
  });

  // (d) + (g) Requirement 6 AC 8: "A confirmed wait answer SHALL go through
  // `answerWait` with `by: advisor`..."; Requirement 6 AC 5: the row has
  // action id, kind, target, conversation id and outcome. Pre-condition: a
  // real open wait (createWait) with one question `q1`; a staged 'answer'
  // action targeting that wait with an answer for `q1`. Test:
  // confirmAction(id, deps). Observable result: confirm succeeds; the wait
  // record (readWait) now has `answer.q1.value` the given pick and
  // `answer.q1.by === 'advisor'`, and `state === 'answered'`; one
  // `advisor.action` row in events.jsonl whose `action` is the staged id,
  // `kind` is 'answer', `target.wait` is the wait id, `conversation` is the
  // given conversation id, and `outcome` is a non-empty string. Expected
  // value source: Requirement 6 AC 8 (the `by: advisor` behaviour) and AC 5
  // (the row's field list), both quoted above.
  it('a confirmed answer action answers the wait with by: advisor, and logs one advisor.action row', async () => {
    const wait = await createWait({
      kind: 'question',
      runId: 'run-1',
      projectId: 'proj-1',
      spec: 'spec-1',
      specDir: await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-specdir-')),
      questions: [{ id: 'q1', text: 'Pick a or b', options: ['a', 'b'] }],
    });

    const staged = await stageAction({
      kind: 'answer',
      target: { wait: wait.id },
      params: { answers: { q1: 'a' } },
      reason: 'the advisor picked a',
      conversation: 'conv-answer',
    });

    const result = await confirmAction(staged.id, noProjectDeps);
    expect(result.ok).toBe(true);

    const updated = await readWait(wait.id);
    expect(updated?.state).toBe('answered');
    expect((updated as any)?.answer?.q1?.value).toBe('a');
    expect((updated as any)?.answer?.q1?.by).toBe('advisor');

    const rows = await readEventRows();
    const actionRows = rows.filter((r) => r.type === 'advisor.action');
    expect(actionRows).toHaveLength(1);
    expect(actionRows[0].action).toBe(staged.id);
    expect(actionRows[0].kind).toBe('answer');
    expect(actionRows[0].target.wait).toBe(wait.id);
    expect(actionRows[0].conversation).toBe('conv-answer');
    expect(typeof actionRows[0].outcome).toBe('string');
    expect(actionRows[0].outcome.length).toBeGreaterThan(0);
  });

  // (e-1) + (g) Requirement 6 AC 10: "A confirmed deferral or decomposition
  // write SHALL commit under the project's store lock"; Requirement 6 AC 5
  // (row fields). Pre-condition: a scratch project git repo with a committed
  // `.spec-workflow/`; a staged 'deferral' action whose params are the
  // `DeferralStorage.create` input shape (title, originSpec, originPhase,
  // revisitTrigger, tags, owner, body). Test: confirmAction(id, deps) where
  // `deps.projectPath('proj-1')` resolves to the repo. Observable result:
  // confirm succeeds; the repo's commit count rose by exactly one and that
  // commit's changed files are exactly the one new file under
  // `.spec-workflow/deferrals/`; `DeferralStorage(repo).list()` now holds one
  // deferral with the given title; one `advisor.action` row with the staged
  // id, kind 'deferral', `target.project` 'proj-1', the given conversation
  // and a non-empty outcome. Expected value source: Requirement 6 AC 10 and
  // AC 5 (quoted above) and design C8's deferral bullet ("DeferralStorage.create
  // ... and checkpoint ... of that file, inside one withStoreLock").
  it('a confirmed deferral action commits exactly one new deferral file under the store lock', async () => {
    const repo = initProjectRepo();
    const before = commitCount(repo);

    const staged = await stageAction({
      kind: 'deferral',
      target: { project: 'proj-1' },
      params: {
        title: 'Advisor-staged deferral',
        originSpec: 'demo-spec',
        originPhase: null,
        revisitTrigger: 'next planning session',
        tags: ['advisor'],
        owner: 'matthew',
        body: { context: 'context', decision: 'decision text', revisitCriteria: 'criteria text' },
      },
      reason: 'surfaced during a search',
      conversation: 'conv-deferral',
    });

    const deps = { projectPath: (id: string) => (id === 'proj-1' ? repo : (() => { throw new Error('unknown project'); })()) };
    const result = await confirmAction(staged.id, deps);
    expect(result.ok).toBe(true);

    expect(commitCount(repo)).toBe(before + 1);
    const changed = git(repo, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n').filter((l) => l.length > 0);
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatch(/^\.spec-workflow\/deferrals\/.+\.md$/);

    const deferrals = await new DeferralStorage(repo).list();
    expect(deferrals).toHaveLength(1);
    expect(deferrals[0].title).toBe('Advisor-staged deferral');

    const rows = await readEventRows();
    const actionRows = rows.filter((r) => r.type === 'advisor.action');
    expect(actionRows).toHaveLength(1);
    expect(actionRows[0].action).toBe(staged.id);
    expect(actionRows[0].kind).toBe('deferral');
    expect(actionRows[0].target.project).toBe('proj-1');
    expect(actionRows[0].conversation).toBe('conv-deferral');
    expect(typeof actionRows[0].outcome).toBe('string');
    expect(actionRows[0].outcome.length).toBeGreaterThan(0);
  });

  // (e-2) + (g) Requirement 6 AC 10 and AC 5, as above, for the decomposition
  // executor. Pre-condition: the same kind of scratch repo, its
  // `decomposition.md` holding an "## Build order" heading and no section for
  // slug `new-thing`; a staged 'decomposition' action with that slug and a
  // markdown block. Test: confirmAction(id, deps). Observable result: confirm
  // succeeds; commit count rose by exactly one, touching exactly
  // `.spec-workflow/spec-decomposition/decomposition.md`; the file's new
  // content holds the staged markdown positioned before "## Build order" and
  // keeps the existing `existing-spec` section; one `advisor.action` row with
  // kind 'decomposition' and the other row fields. Expected value source:
  // Requirement 6 AC 10, AC 5, and design C8's decomposition bullet ("replace
  // the `### ` section whose heading holds the backticked slug, or insert
  // before `## Build order` (else at the end), then checkpoint the file").
  it('a confirmed decomposition action inserts the section before Build order and commits exactly that file', async () => {
    const repo = initProjectRepo();
    const before = commitCount(repo);
    const decompPath = join(repo, '.spec-workflow', 'spec-decomposition', 'decomposition.md');

    const staged = await stageAction({
      kind: 'decomposition',
      target: { project: 'proj-1' },
      params: {
        slug: 'new-thing',
        markdown: '### 2. `new-thing` — a new thing (active)\n\nNew body.\n',
      },
      reason: 'planning the next spec',
      conversation: 'conv-decomp',
    });

    const deps = { projectPath: (id: string) => (id === 'proj-1' ? repo : (() => { throw new Error('unknown project'); })()) };
    const result = await confirmAction(staged.id, deps);
    expect(result.ok).toBe(true);

    expect(commitCount(repo)).toBe(before + 1);
    const changed = git(repo, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n').filter((l) => l.length > 0);
    expect(changed).toEqual(['.spec-workflow/spec-decomposition/decomposition.md']);

    const after = await fs.readFile(decompPath, 'utf-8');
    expect(after).toContain('`existing-spec`');
    expect(after).toContain('`new-thing`');
    expect(after.indexOf('`new-thing`')).toBeLessThan(after.indexOf('## Build order'));

    const rows = await readEventRows();
    const actionRows = rows.filter((r) => r.type === 'advisor.action');
    expect(actionRows).toHaveLength(1);
    expect(actionRows[0].action).toBe(staged.id);
    expect(actionRows[0].kind).toBe('decomposition');
    expect(actionRows[0].target.project).toBe('proj-1');
    expect(actionRows[0].conversation).toBe('conv-decomp');
    expect(typeof actionRows[0].outcome).toBe('string');
    expect(actionRows[0].outcome.length).toBeGreaterThan(0);
  });

  // (f) + (g) Design C8's backlog bullet ("append one dated line to
  // `owner-backlog.md` in the home; no commit", design D18); Requirement 6 AC
  // 5 (row fields). Pre-condition: temp SDD_HOME, no `owner-backlog.md` yet.
  // Test: stage and confirm a 'backlog' action. Observable result:
  // `owner-backlog.md` now holds exactly one line, matching
  // `- YYYY-MM-DD: <text>` with the staged text; one `advisor.action` row
  // with the staged id, kind 'backlog', the given conversation and a
  // non-empty outcome. Expected value source: design C8's backlog bullet, D18
  // and Requirement 6 AC 5, plus the task Success line's "backlog appends one
  // line".
  it('a confirmed backlog action appends exactly one dated line to owner-backlog.md', async () => {
    const backlogPath = join(controllerHome(), 'owner-backlog.md');
    await expect(fs.access(backlogPath)).rejects.toThrow();

    const staged = await stageAction({
      kind: 'backlog',
      target: {},
      params: { text: 'Check the DB migration' },
      reason: 'noticed during search',
      conversation: 'conv-backlog',
    });

    const result = await confirmAction(staged.id, noProjectDeps);
    expect(result.ok).toBe(true);

    const contents = await fs.readFile(backlogPath, 'utf-8');
    const lines = contents.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^- \d{4}-\d{2}-\d{2}: Check the DB migration$/);

    const rows = await readEventRows();
    const actionRows = rows.filter((r) => r.type === 'advisor.action');
    expect(actionRows).toHaveLength(1);
    expect(actionRows[0].action).toBe(staged.id);
    expect(actionRows[0].kind).toBe('backlog');
    expect(actionRows[0].conversation).toBe('conv-backlog');
    expect(typeof actionRows[0].outcome).toBe('string');
    expect(actionRows[0].outcome.length).toBeGreaterThan(0);
  });

  // Added coverage (not an author test): actionEvents (design C8's interface
  // list) emits `change` after every store write.
  it('emits change on stageAction, confirmAction and dismissAction', async () => {
    const seen: string[] = [];
    const onChange = (action: { id: string; state: string }) => seen.push(action.state);
    actionEvents.on('change', onChange);
    try {
      const staged = await stageAction({
        kind: 'backlog',
        target: {},
        params: { text: 'watch for change events' },
        reason: 'change-event test',
        conversation: 'conv-change',
      });
      expect(seen).toEqual(['staged']);

      await confirmAction(staged.id, noProjectDeps);
      expect(seen).toEqual(['staged', 'running', 'done']);

      const staged2 = await stageAction({
        kind: 'backlog',
        target: {},
        params: { text: 'another' },
        reason: 'change-event test 2',
        conversation: 'conv-change-2',
      });
      await dismissAction(staged2.id);
      expect(seen).toEqual(['staged', 'running', 'done', 'staged', 'dismissed']);
    } finally {
      actionEvents.off('change', onChange);
    }
  });

  // Added coverage (not an author test): design Error Handling flow 6 — a
  // throwing executor (here, execDecomposition against a repo with no
  // decomposition.md) still lands the action failed and still logs one row.
  it('a throwing executor still lands the action failed and still logs one advisor.action row', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'sdd-advisor-throw-proj-'));
    mkdirSync(join(repo, '.spec-workflow'), { recursive: true });
    git(repo, ['init', '-q']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'Test']);
    git(repo, ['commit', '-q', '--allow-empty', '-m', 'init']);

    const staged = await stageAction({
      kind: 'decomposition',
      target: { project: 'proj-1' },
      params: { slug: 'new-thing', markdown: '### `new-thing`\n' },
      reason: 'throw test',
      conversation: 'conv-throw',
    });

    const deps = { projectPath: (id: string) => (id === 'proj-1' ? repo : (() => { throw new Error('unknown project'); })()) };
    const result = await confirmAction(staged.id, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('failed');

    const rows = await readEventRows();
    const actionRows = rows.filter((r) => r.type === 'advisor.action');
    expect(actionRows).toHaveLength(1);
    expect(actionRows[0].action).toBe(staged.id);
    expect(actionRows[0].kind).toBe('decomposition');
    expect(actionRows[0].outcome).toBe('failed');
    expect(typeof actionRows[0].detail).toBe('string');
    expect(actionRows[0].detail.length).toBeGreaterThan(0);
  });
});
