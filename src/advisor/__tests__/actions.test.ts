import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import { mkdirSync, mkdtempSync, writeFileSync, chmodSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { stageAction, listActions, confirmAction, dismissAction, actionEvents } from '../actions.js';
import { eventsPath, advisorActionsDir } from '../home.js';
import { createWait } from '../../controller/waits.js';
import { readWait, controllerHome, writeRun, listWaits, type RunRecord } from '../../controller/state.js';
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
let savedGhBin: string | undefined;
let savedGhScript: string | undefined;
let savedHarnessRepo: string | undefined;

beforeAll(() => {
  // The stub is executed directly via its shebang; guarantee the mode.
  chmodSync(STUB_GH, 0o755);
});

beforeEach(async () => {
  savedSddHome = process.env.SDD_HOME;
  home = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-actions-'));
  process.env.SDD_HOME = home;
  savedGhBin = process.env.CONTROLLER_GH_BIN;
  savedGhScript = process.env.STUB_GH_SCRIPT;
  savedHarnessRepo = process.env.CONTROLLER_HARNESS_REPO;
});

afterEach(async () => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  if (savedGhBin === undefined) delete process.env.CONTROLLER_GH_BIN;
  else process.env.CONTROLLER_GH_BIN = savedGhBin;
  if (savedGhScript === undefined) delete process.env.STUB_GH_SCRIPT;
  else process.env.STUB_GH_SCRIPT = savedGhScript;
  if (savedHarnessRepo === undefined) delete process.env.CONTROLLER_HARNESS_REPO;
  else process.env.CONTROLLER_HARNESS_REPO = savedHarnessRepo;
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

// ---------------------------------------------------------------------------
// gh stub plumbing for the merge executor (task 11; _Leverage scripts/stub-gh.mjs),
// mirroring src/controller/__tests__/merge.test.ts's own helpers.
// ---------------------------------------------------------------------------

const STUB_GH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'stub-gh.mjs');

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Write a gh stub script and point CONTROLLER_GH_BIN/STUB_GH_SCRIPT at it. */
function useGhScript(runs: unknown[]): string {
  process.env.CONTROLLER_GH_BIN = STUB_GH;
  const scriptPath = join(tmp('advisor-actions-gh-'), 'gh-script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.STUB_GH_SCRIPT = scriptPath;
  return scriptPath;
}

function recordedArgv(scriptPath: string): string[][] {
  const raw = readFileSync(`${scriptPath}.argv`, 'utf8').trim();
  return raw ? raw.split('\n').map((l) => JSON.parse(l) as string[]) : [];
}

/** A PR view with green, mergeable defaults (no `baseRefName`, so the
 * read-only new-dependency flag skips its own git read — see merge.ts
 * flagNewDependencies, which early-returns with no `base`). */
const GH_PR_VIEW = {
  mergeable: 'MERGEABLE',
  mergeStateStatus: 'CLEAN',
  headRefName: 'feat/thing',
  headRefOid: 'deadbeefcafe0001',
  body: 'A clean PR body with no trailers.',
  commits: [{ oid: 'deadbeefcafe0001', messageHeadline: 'feat: do the thing', messageBody: 'Body line.' }],
  author: { login: 'someone' },
};

function runsOf(...runs: Record<string, unknown>[]) {
  return { argvIncludes: ['api'], stdout: { total_count: runs.length, workflow_runs: runs } };
}
function statusesOf(...statuses: Record<string, unknown>[]) {
  return { argvIncludes: ['api'], stdout: { state: statuses.length ? 'success' : 'pending', total_count: statuses.length, statuses } };
}

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

  // ---------------------------------------------------------------------------
  // Task 11: merge, deploy and launch executors (design.md C8; requirements.md
  // Requirement 6 AC 6, AC 7, AC 9; task 11 Success line). `merge` and `deploy`
  // reach outside the advisor's own home (a real `gh` call through
  // scripts/stub-gh.mjs, a real spawned script), so no collaborator inside
  // actions.ts is mocked here either: only the external process boundary
  // (`gh`, the self-update script) is swapped for a stub, the same seam
  // src/controller/__tests__/merge.test.ts uses for `gh`.
  //
  // Per the task's Success line:
  //   "a red-checks PR is refused with reasons and not merged"     -> merge-refused test
  //   "a green PR merges and logs advisor.action (6.7)"            -> merge-merged test
  //   "a run's open merge wait is answered by advisor"             -> merge-answered-wait test
  //   "deploy is spawned detached"                                 -> deploy test
  // Requirement 6 AC 9 (launch goes through enqueue's admission guards) has no
  // bullet of its own on the Success line; it is covered by the launch test
  // below, which proves confirmAction's launch executor reaches `launchSpec`
  // (the function task 11 moves the guards into) rather than enqueuing
  // directly. Requirement 6 AC 12 ("merge: ask unchanged") is the requirements
  // document's own marked invariant ("verified, not red-first") about this
  // repository's agent-rules.md, not actions.ts behavior; it is not a red test
  // here (see report).
  //
  // The merge target/params shape (`target: {project, spec, pr}`, `params:
  // {branch}`) and the deploy/launch seams (`CONTROLLER_HARNESS_REPO` for the
  // self-update script's checkout root, a `launchSpec` field on `ActionDeps`)
  // are this file's own concrete fixing of design.md's "Illustrative — verify
  // against the test fake" Data Models note; they are not quoted from the
  // design or requirements text.

  describe('merge executor', () => {
    // Requirement 6 AC 6: "...and SHALL refuse with the rule's reasons when
    // they fail (D4)." Pre-condition: a staged `merge` action naming a PR
    // whose head sha has a failed CI check (no matching run/wait exists, so
    // the mergeByRule branch runs); `gh pr merge` is never stubbed, so a call
    // to it would throw "no response at index". Test: confirmAction(id,
    // deps). Observable result: confirm returns `{ok: false, error:
    // 'refused'}`; the stored action's state is 'refused' and its
    // outcome.detail includes the failing-check reason; exactly 3 gh
    // invocations ran (view, runs, statuses) — no merge attempted; one
    // advisor.action row with outcome 'refused' and a detail string
    // naming the reason. Expected value source: Requirement 6 AC 6 and
    // design C8's merge bullet ("Any status but merged is refused with the
    // rule's reasons"), quoted above.
    it('refuses a red-checks PR with the rule reasons, without merging', async () => {
      const script = useGhScript([
        { argvIncludes: ['pr', 'view'], stdout: GH_PR_VIEW },
        runsOf({ name: 'test', status: 'completed', conclusion: 'failure' }),
        statusesOf(),
      ]);
      const repo = tmp('sdd-advisor-merge-repo-');

      const staged = await stageAction({
        kind: 'merge',
        target: { project: 'proj-1', spec: 'spec-1', pr: 7 },
        params: { branch: 'feat/thing' },
        reason: 'the advisor noticed the PR is green... or not',
        conversation: 'conv-merge-refused',
      });

      const deps = { projectPath: (id: string) => (id === 'proj-1' ? repo : (() => { throw new Error('unknown project'); })()) };
      const result = await confirmAction(staged.id, deps);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe('refused');

      const refused = (await listActions()).find((a) => a.id === staged.id);
      expect(refused?.state).toBe('refused');
      expect(refused?.outcome?.detail.join(' ')).toMatch(/workflow test did not pass/);

      expect(recordedArgv(script)).toHaveLength(3); // view, runs, statuses — no merge call

      const rows = await readEventRows();
      const actionRows = rows.filter((r) => r.type === 'advisor.action');
      expect(actionRows).toHaveLength(1);
      expect(actionRows[0].action).toBe(staged.id);
      expect(actionRows[0].kind).toBe('merge');
      expect(actionRows[0].outcome).toBe('refused');
      expect(actionRows[0].detail).toMatch(/workflow test did not pass/);
    });

    // Requirement 6 AC 6 ("A confirmed merge SHALL apply the merge rule's
    // checks...") and AC 7 ("...after confirmation the merge SHALL happen and
    // advisor.action SHALL be logged"); design C8's merge bullet ("the
    // project's rules...with merge set to auto"). Pre-condition: a green PR;
    // the project's own agent-rules.md says `merge: ask` (proving the action
    // forces `auto` rather than reading the project's own setting). Test:
    // confirmAction(id, deps). Observable result: confirm succeeds; the
    // synthetic ledger at advisor/actions/<id>/harness-events.jsonl carries
    // one pr.merged row (number '7', sha, method 'merge', run the action id);
    // no new `merge` wait was created (the `ask` rule never fired); one
    // advisor.action row logged. Expected value source: Requirement 6 AC 6,
    // AC 7 (quoted above) and design C8's merge bullet (the `auto` override
    // and the synthetic ledger path).
    it('merges a green PR even when the project rule says merge: ask, and logs advisor.action', async () => {
      useGhScript([
        { argvIncludes: ['pr', 'view'], stdout: GH_PR_VIEW },
        runsOf({ name: 'test', status: 'completed', conclusion: 'success' }),
        statusesOf(),
        { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
        { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'f00dc0ffee1234' } } },
      ]);
      const repo = tmp('sdd-advisor-merge-repo-');
      mkdirSync(join(repo, '.spec-workflow'), { recursive: true });
      writeFileSync(join(repo, '.spec-workflow', 'agent-rules.md'), 'merge: ask\n');

      const staged = await stageAction({
        kind: 'merge',
        target: { project: 'proj-1', spec: 'spec-1', pr: 7 },
        params: { branch: 'feat/thing' },
        reason: 'the PR is green',
        conversation: 'conv-merge-merged',
      });

      const deps = { projectPath: (id: string) => (id === 'proj-1' ? repo : (() => { throw new Error('unknown project'); })()) };
      const result = await confirmAction(staged.id, deps);
      expect(result.ok).toBe(true);

      const ledgerPath = join(advisorActionsDir(), staged.id, 'harness-events.jsonl');
      const ledgerRows = readFileSync(ledgerPath, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
      const merged = ledgerRows.find((r) => r.type === 'pr.merged');
      expect(merged).toMatchObject({ number: '7', sha: 'f00dc0ffee1234', method: 'merge', run: staged.id });

      const mergeWaits = (await listWaits()).filter((w) => w.kind === 'merge');
      expect(mergeWaits).toHaveLength(0); // the `ask` rule was overridden to auto; no wait opened

      const rows = await readEventRows();
      const actionRows = rows.filter((r) => r.type === 'advisor.action');
      expect(actionRows).toHaveLength(1);
      expect(actionRows[0].action).toBe(staged.id);
      expect(actionRows[0].kind).toBe('merge');
      expect(actionRows[0].target.pr).toBe(7);
      expect(actionRows[0].conversation).toBe('conv-merge-merged');
      expect(actionRows[0].outcome).toMatch(/merged/i);
    });

    // Design C8's merge bullet ("a run on that project with this pr and an
    // open merge wait → answerWait with merge by advisor...outcome
    // answered-wait"); Requirement 6 AC 8's `by: advisor` behaviour, restated
    // for the merge kind. Pre-condition: a real RunRecord on project 'proj-1'
    // with pr 7 and an open `merge` wait on that run (no gh stub installed:
    // this branch never calls gh). Test: confirmAction(id, noProjectDeps) —
    // `projectPath` is never needed on this branch. Observable result:
    // confirm succeeds; the wait is now answered, `answer.merge.value` is
    // 'merge' and `answer.merge.by` is 'advisor'; one advisor.action row with
    // outcome exactly 'answered-wait'. Expected value source: design C8's
    // merge bullet, quoted above.
    it('answers a run\'s open merge wait by advisor instead of merging directly', async () => {
      const run: RunRecord = {
        v: 1,
        id: 'run-advisor-merge-1',
        project: 'proj-1',
        codeRoot: '/irrelevant',
        specStore: '/irrelevant',
        spec: 'spec-1',
        worktree: '/irrelevant',
        branch: 'feat/thing',
        pr: 7,
        status: 'merging',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      };
      await writeRun(run);
      const specDir = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-merge-specdir-'));
      const wait = await createWait({
        kind: 'merge',
        runId: run.id,
        projectId: 'proj-1',
        spec: 'spec-1',
        specDir,
        questions: [{ id: 'merge', text: 'Merge PR #7?', options: ['merge', 'hold'], recommended: 'merge' }],
      });

      const staged = await stageAction({
        kind: 'merge',
        target: { project: 'proj-1', spec: 'spec-1', pr: 7 },
        params: {},
        reason: 'the advisor picked merge',
        conversation: 'conv-merge-wait',
      });

      const result = await confirmAction(staged.id, noProjectDeps);
      expect(result.ok).toBe(true);

      const updatedWait = await readWait(wait.id);
      expect(updatedWait?.state).toBe('answered');
      expect((updatedWait as any)?.answer?.merge?.value).toBe('merge');
      expect((updatedWait as any)?.answer?.merge?.by).toBe('advisor');

      const rows = await readEventRows();
      const actionRows = rows.filter((r) => r.type === 'advisor.action');
      expect(actionRows).toHaveLength(1);
      expect(actionRows[0].action).toBe(staged.id);
      expect(actionRows[0].kind).toBe('merge');
      expect(actionRows[0].conversation).toBe('conv-merge-wait');
      expect(actionRows[0].outcome).toBe('answered-wait');
    });
  });

  describe('deploy executor', () => {
    // Design C8's deploy bullet: "spawn scripts/sdd-self-update.sh...from the
    // checkout root, detached, logged to advisor/actions/id/deploy.log;
    // outcome started; the script reports its own failures." Pre-condition:
    // CONTROLLER_HARNESS_REPO points at a scratch checkout whose
    // scripts/sdd-self-update.sh is a stub that sleeps 500ms, then writes a
    // marker to stdout (standing in for the real script, which this test must
    // never run for real). Test: confirmAction(id, deps), timed. Observable
    // result: confirm returns `{ok: true}` and resolves in well under the
    // stub's 500ms sleep (proving the spawn is detached, not awaited);
    // advisor/actions/<id>/deploy.log eventually (polled) contains the stub's
    // marker line; one advisor.action row with outcome exactly 'started'.
    // Expected value source: design C8's deploy bullet, quoted above.
    it('spawns sdd-self-update.sh detached, logging to deploy.log, with outcome started', async () => {
      const checkout = tmp('sdd-advisor-deploy-checkout-');
      mkdirSync(join(checkout, 'scripts'), { recursive: true });
      const stubScript = join(checkout, 'scripts', 'sdd-self-update.sh');
      writeFileSync(stubScript, '#!/bin/bash\nsleep 0.5\necho "DEPLOY_STUB_OK"\n');
      chmodSync(stubScript, 0o755);
      process.env.CONTROLLER_HARNESS_REPO = checkout;

      const staged = await stageAction({
        kind: 'deploy',
        target: {},
        params: {},
        reason: 'ship the merged PR',
        conversation: 'conv-deploy',
      });

      const startedAt = Date.now();
      const result = await confirmAction(staged.id, noProjectDeps);
      const elapsedMs = Date.now() - startedAt;

      expect(result.ok).toBe(true);
      expect(elapsedMs).toBeLessThan(400); // did not wait for the stub's 500ms sleep: detached

      const logPath = join(advisorActionsDir(), staged.id, 'deploy.log');
      let logged = '';
      for (let i = 0; i < 40 && !logged.includes('DEPLOY_STUB_OK'); i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (existsSync(logPath)) logged = readFileSync(logPath, 'utf-8');
      }
      expect(logged).toContain('DEPLOY_STUB_OK');

      const rows = await readEventRows();
      const actionRows = rows.filter((r) => r.type === 'advisor.action');
      expect(actionRows).toHaveLength(1);
      expect(actionRows[0].action).toBe(staged.id);
      expect(actionRows[0].kind).toBe('deploy');
      expect(actionRows[0].conversation).toBe('conv-deploy');
      expect(actionRows[0].outcome).toBe('started');
    });

    // Retro P5: a missing self-update script makes `spawn` emit an async
    // 'error'; without a listener node throws it and crashes the server.
    // Pre-condition: CONTROLLER_HARNESS_REPO points at a scratch checkout with
    // no scripts/sdd-self-update.sh. Test: confirmAction(id, deps). Observable
    // result: confirm returns `{ok: false}` (not a thrown, uncaught error), the
    // stored action lands 'failed', and one advisor.action row carries outcome
    // 'spawn-failed' with a non-empty detail. Expected value source: the retro
    // finding ("attach an error handler that logs and returns a surfaced
    // failure instead of propagating").
    it('lands the action failed instead of crashing when the script cannot be spawned', async () => {
      const checkout = tmp('sdd-advisor-deploy-missing-');
      // No scripts/sdd-self-update.sh here: spawn emits ENOENT via 'error'.
      process.env.CONTROLLER_HARNESS_REPO = checkout;

      const staged = await stageAction({
        kind: 'deploy',
        target: {},
        params: {},
        reason: 'deploy a checkout with no script',
        conversation: 'conv-deploy-missing',
      });

      const result = await confirmAction(staged.id, noProjectDeps);
      expect(result.ok).toBe(false);

      const landed = (await listActions()).find((a) => a.id === staged.id);
      expect(landed?.state).toBe('failed');

      const rows = await readEventRows();
      const actionRows = rows.filter((r) => r.type === 'advisor.action');
      expect(actionRows).toHaveLength(1);
      expect(actionRows[0].kind).toBe('deploy');
      expect(actionRows[0].outcome).toBe('spawn-failed');
      expect(typeof actionRows[0].detail).toBe('string');
      expect(actionRows[0].detail.length).toBeGreaterThan(0);
    });
  });

  describe('launch executor', () => {
    // Requirement 6 AC 9: "A confirmed launch SHALL go through the
    // controller's enqueue...and its admission guards." Design C8's launch
    // bullet: "the launch route body...moves into launchSpec(projectId,
    // input), called by route and executor, so the launch checks and enqueue
    // apply." Pre-condition: a staged `launch` action; a fake
    // `deps.launchSpec` standing in for the real one task 11 adds to
    // multi-server.ts (the real guards are covered by
    // src/dashboard/__tests__/harness-routes.test.ts against that same
    // function, unchanged by this task). Test: confirmAction(id, deps).
    // Observable result: confirm succeeds; `launchSpec` was called exactly
    // once with the staged action's project id and an input carrying the
    // staged spec; the advisor.action row's outcome names the runId
    // `launchSpec` returned. Expected value source: Requirement 6 AC 9 and
    // design C8's launch bullet, both quoted above.
    it('a confirmed launch action calls launchSpec with the project and spec, and logs its runId', async () => {
      const calls: { projectId: string; input: unknown }[] = [];
      const deps = {
        projectPath: noProjectDeps.projectPath,
        launchSpec: async (projectId: string, input: unknown) => {
          calls.push({ projectId, input });
          return { ok: true as const, runId: 'run-20261027-093000' };
        },
      };

      const staged = await stageAction({
        kind: 'launch',
        target: { project: 'proj-1', spec: 'spec-2' },
        params: {},
        reason: 'the spec is ready to launch',
        conversation: 'conv-launch',
      });

      const result = await confirmAction(staged.id, deps as any);
      expect(result.ok).toBe(true);

      expect(calls).toHaveLength(1);
      expect(calls[0].projectId).toBe('proj-1');
      expect((calls[0].input as { spec?: string }).spec).toBe('spec-2');

      const rows = await readEventRows();
      const actionRows = rows.filter((r) => r.type === 'advisor.action');
      expect(actionRows).toHaveLength(1);
      expect(actionRows[0].action).toBe(staged.id);
      expect(actionRows[0].kind).toBe('launch');
      expect(actionRows[0].conversation).toBe('conv-launch');
      expect(actionRows[0].outcome).toMatch(/run-20261027-093000/);
    });
  });
});
