import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { mkdtempSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { sddHome } from '../src/dashboard/harness/state-files.js';
import { scrubbedGitEnv } from '../src/core/git-utils.js';
import { secretPath } from '../src/controller/access.js';
import type { RunRecord, WaitRecord } from '../src/controller/state.js';

/**
 * Browser checks of the ruling view (design.md C8; decomposition task 11;
 * Requirements 1, 3, 4, 5, 6). Runs on `playwright.worktree.config.ts`, whose
 * dashboard webServer sets `SDD_DEPLOY_DISABLED=1`, so a seeded `waits/<id>.json`
 * or `runs/<id>/run.json` stays exactly as written — the same fixture style
 * `e2e/worktree-board.spec.ts` uses. Every case reaches the view only through
 * the one seam the decomposition names: pressing "Answer" on the wait's tile
 * (`tile.getByRole('button', { name: 'Answer', exact: true }).click()`). The
 * task/diff routes the view reads sit under `/api/controller/`, so, per
 * Requirement 4 AC 11 ("no exemption"), the loopback GET passthrough in
 * `src/controller/access.ts` does not cover them the way it covers a
 * non-controller read; `pressAnswer` below logs the page in first, the same
 * way `e2e/worktree-board.spec.ts:34-37` does for its mutating calls.
 *
 * Contract, per case below — pre-condition, the call through the seam, the
 * observable result, and the source of the expected value:
 *
 * 1. A tagged `escalation` wait, with a run (phase/step set), a `tasks.md`
 *    with a TDD-marked task and a gate-note risk, and a worktree with one
 *    fixture commit the wait's `commits` names.
 *    Call: `tile.getByRole('button', { name: 'Answer', exact: true }).click()`.
 *    Result: `now-answer-sheet` shows; `band-needs-you` has count 0; the
 *    header (`ruling-header`) holds the project, spec, wait id, run id,
 *    "implementation", "implementer" and "task 1"; `ruling-age` reads
 *    "Age … ago"; the wait text shows; the task row (`ruling-task-row`)
 *    holds the title, the Success text, "TDD yes", the ledger risk and both
 *    files; the detail (`ruling-detail`) holds "Worker report" and the
 *    seeded report text; the diff (`ruling-diff`) holds the fixture
 *    commit's added line; the wait text, task row, detail, diff and the
 *    form's "Answer and continue the run" button appear in that order; an
 *    "Abandon the run" control (`ruling-abandon`) is offered.
 *    Source: task 11 Success, first clause; Requirements 1.2, 1.3, 1.5, 3.1,
 *    3.2, 3.3, 3.6, 4.2, 4.5 (added line), 4.7 (worker report before review),
 *    6.8, 6.9.
 * 2. An `escalation` wait whose `run` names no run record.
 *    Call: same press.
 *    Result: the view shows "run record gone" and the answer form
 *    (`answer-submit`) still renders.
 *    Source: task 11 Success "a wait whose run is gone shows run record
 *    gone"; Requirement 1.4.
 * 3. A `gate-b` wait with `recommended: 'Approve'` and `proposals`.
 *    Call: same press.
 *    Result: the "Approve" radio (`answer-opt-gate-b`, first of two) is
 *    checked; "(recommended)" and "The plan" are visible, with the seeded
 *    proposal line under it.
 *    Source: task 11 Success "a gate-B wait shows Approve checked with
 *    (recommended) and The plan"; Requirements 5.1, 5.3, 6.2, 6.8.
 * 3a. A `gate-a` wait with one asked decision (`recommended` set) and one
 *    recorded-not-asked proposal line.
 *    Call: same press.
 *    Result: the first of two `answer-opt-D1` radios is checked;
 *    "(recommended)" and "Recorded without asking" are visible, with the
 *    seeded recorded-decision line under it.
 *    Source: Requirements 5.1, 5.3 (the gate-a branch of the heading design
 *    C8 Interfaces names, distinct from gate-b's "The plan").
 * 3b. An `escalation` wait tagged to a task id absent from `tasks.md`, with
 *    no `detail` and no `commits`.
 *    Call: same press.
 *    Result: the task row (`ruling-task-row`) reads "task 99 not found in
 *    tasks.md"; the detail (`ruling-detail`) reads "no worker report or
 *    task review"; the diff (`ruling-diff`) reads "no commits for this
 *    task"; the answer form still renders.
 *    Source: Requirements 3.5, 3.6 (detail absent), 4.7 (no commits), 4.9
 *    (the form still renders and works).
 * 4. A `merge` wait (question id `merge`) with a run carrying one `run`-kind
 *    `PrRead`.
 *    Call: same press.
 *    Result: the PR number shows; `answer-submit` reads "Merge" and
 *    `answer-hold` is visible reading "Hold".
 *    Source: task 11 Success "a merge wait shows the PR number, Merge and
 *    Hold"; Requirement 5.5.
 * 5. An `escalation` wait whose question id is `security`, options
 *    `accept`/`retry`/`abandon`, no `recommended`.
 *    Call: same press.
 *    Result: three `answer-opt-security` radios, none checked;
 *    `answer-submit` is disabled.
 *    Source: task 11 Success "a security wait shows three unchecked radios
 *    and a disabled answer-submit"; Requirements 5.6, 6.2 (D3: no
 *    recommended, nothing preselected).
 * 6. An `escalation` wait with no `task` tag and question id other than
 *    `security`, with a run whose `phase` is `document`.
 *    Call: same press.
 *    Result: the view shows "no task: raised in the document phase".
 *    Source: task 11 Success "a taskless escalation shows no task: raised
 *    in the and its phase"; Requirement 5.7.
 * 7. A tagged `escalation` wait with a `ruling` question and `commits`, on a
 *    run whose `worktree` path does not exist.
 *    Call: same press, then `page.getByTestId('answer-text-ruling').fill(…)`.
 *    Result: the diff section (`ruling-diff`) reads "worktree gone";
 *    `answer-submit` starts disabled and becomes enabled once the ruling
 *    text box is filled.
 *    Source: task 11 Success "a removed worktree shows worktree gone and
 *    answer-submit enables once a ruling is typed"; Requirements 4.5, 6.2.
 *
 * 8. (task 12) An untagged `escalation` wait with a free `ruling` question,
 *    on a real controller run (`pauseRequested` set) whose project, run and
 *    spec dir are real, writable paths.
 *    Call: same press, then `answer-text-ruling.fill(ruling)`,
 *    `ruling-notes.fill(note)`, `answer-submit.click()`.
 *    Result: `answer-stage` becomes visible (the button's in-place stage,
 *    never rendered at base because `HomePage` hard-codes `stage={null}`);
 *    once the run leaves `waiting` the view returns to the board, with
 *    `band-needs-you` visible again, `wait-tile-<id>` at count 0 and
 *    `run-tile-<runId>` showing `run-status-<runId>` "paused"; the stored
 *    wait answer has `by: "operator"` and a value of the ruling text, a
 *    blank line, "Notes: " and the note; `questions.md` gains a
 *    `## escalation <id>` section holding the same ruling and note text.
 *    Source: task 12 Success, first clause; Requirements 6.4, 6.6, 6.8,
 *    6.11 (folds 6.13's "resumes the run", already a regression guard at
 *    `src/controller/phases/__tests__/implementation.test.ts:867`, and
 *    6.14's tile movement, a regression guard per the task's own Note on
 *    `src/controller/controller.ts:671-673` and
 *    `src/dashboard_frontend/src/modules/shell/board.ts:34-52`).
 * 9. (task 12) The same shape of wait as case 8, but the page intercepts
 *    the answer POST and fulfills it with status 500 and `{ reason }`
 *    before the request reaches the server.
 *    Call: same fill and press, with the route installed first.
 *    Result: `answer-stage` reads "failed: <reason>"; `answer-text-ruling`
 *    and `ruling-notes` keep their typed values; `answer-submit` is
 *    enabled again.
 *    Source: task 12 Success, third clause; Requirement 6.12.
 * 10. (task 12) A `gate-b` wait with `free: true` options and no
 *    `recommended`, on a real controller run (`pauseRequested` set).
 *    Call: same press, then check the second `answer-opt-gate-b` radio
 *    (leaving its own text box empty), `ruling-notes.fill(note)`,
 *    `answer-submit.click()`.
 *    Result: `answer-stage` becomes visible; the stored wait answer's
 *    value is the picked option alone, with no note text folded in;
 *    `questions.md`'s `## Gate B` section carries the option as the
 *    answer and a trailing `Notes: <note>` line.
 *    Source: task 12 Success, fourth clause; Requirement 6.5 (option alone;
 *    the receipt's `Notes:` line is design C4's gate rendering, already
 *    unit-tested at `src/controller/__tests__/waits.test.ts`, exercised
 *    here through the browser for the first time).
 */

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function waitPath(id: string): string {
  return join(sddHome(), 'waits', `${id}.json`);
}

async function writeWaitRecord(record: WaitRecord & { specDir: string }): Promise<void> {
  await mkdir(join(sddHome(), 'waits'), { recursive: true });
  await writeFile(waitPath(record.id), JSON.stringify(record, null, 2) + '\n', 'utf-8');
}

async function removeWaitRecord(id: string): Promise<void> {
  await rm(waitPath(id), { force: true });
}

/** Re-reads an answered wait record straight off disk (task 12 cases). */
async function readWaitRecord(id: string): Promise<WaitRecord & { specDir: string; answer?: Record<string, { value: string; by: string; answered: string }> }> {
  return JSON.parse(await readFile(waitPath(id), 'utf-8'));
}

const BASE_TOKENS = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

async function writeRunRecord(run: RunRecord): Promise<string> {
  const dir = join(sddHome(), 'runs', run.id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'run.json'), JSON.stringify(run, null, 2) + '\n', 'utf-8');
  return dir;
}

async function removeRunRecord(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf-8', env: scrubbedGitEnv() }).trim();
}

/** A temp git repo with one commit, then a second "fixture" commit that adds a line. Returns the fixture commit's hash. */
function makeFixtureRepo(): { repoDir: string; fixtureCommit: string } {
  const repoDir = mkdtempSync(join(tmpdir(), 'e2e-ruling-repo-'));
  git(repoDir, ['init', '-q', '-b', 'main', '.']);
  git(repoDir, ['config', 'user.email', 'fixture@example.com']);
  git(repoDir, ['config', 'user.name', 'Fixture']);

  writeFileSync(join(repoDir, 'notes.txt'), 'first line\n');
  git(repoDir, ['add', 'notes.txt']);
  git(repoDir, ['commit', '-q', '-m', 'Initial commit']);

  writeFileSync(join(repoDir, 'notes.txt'), 'first line\noperator added this fixture line\n');
  git(repoDir, ['add', 'notes.txt']);
  git(repoDir, ['commit', '-q', '-m', 'Add the fixture line']);
  const fixtureCommit = git(repoDir, ['rev-parse', 'HEAD']);

  return { repoDir, fixtureCommit };
}

const TASK_1_TASKS_MD = `- [ ] 1. Render a cheerful greeting banner
  - File: src/greeting.ts
  - File: src/banner.ts
  - Test: src/__tests__/greeting.test.ts — \`greet()\`
  - Purpose: it greets warmly.
  - _Prompt: Task: Render a greeting banner | Restrictions: none | Success: the banner reads Hello, operator_
`;

/** A temp spec dir with a TDD-marked task 1 and a medium-risk gate note. */
function makeSpecDir(): string {
  const specDir = mkdtempSync(join(tmpdir(), 'e2e-ruling-spec-'));
  writeFileSync(join(specDir, 'tasks.md'), TASK_1_TASKS_MD, 'utf-8');
  writeFileSync(
    join(specDir, 'harness-events.jsonl'),
    JSON.stringify({ type: 'note', text: 'gate: task 1 B risk medium' }) + '\n',
    'utf-8',
  );
  return specDir;
}

function baseRun(id: string, project: string, worktree: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    v: 1, id, project,
    codeRoot: '/tmp/e2e-ruling-nonexistent', specStore: '/tmp/e2e-ruling-nonexistent',
    spec: 'e2e-ruling-run-spec', worktree, branch: 'feat/e2e-ruling',
    status: 'waiting',
    created: isoAgo(5 * 60_000), updated: isoAgo(30_000),
    tokens: BASE_TOKENS,
    ...overrides,
  };
}

/** Logs the page in, as `e2e/worktree-board.spec.ts:34-37` does, so the ruling view's own `/task` and `/diff` GETs (under `/api/controller/`, Requirement 4 AC 11) carry the session they require. */
async function login(page: Page): Promise<void> {
  const secret = (await readFile(secretPath(), 'utf-8')).trim();
  await page.request.post('/api/login', { data: { secret } });
}

async function pressAnswer(page: Page, waitId: string): Promise<void> {
  await page.goto('/');
  await login(page);
  const tile = page.getByTestId(`wait-tile-${waitId}`);
  await expect(tile).toBeVisible({ timeout: 15000 });
  await tile.getByRole('button', { name: 'Answer', exact: true }).click();
  await expect(page.getByTestId('now-answer-sheet')).toBeVisible({ timeout: 15000 });
}

test('(task 11) a tagged escalation shows the header, task row, detail and diff with no band-needs-you', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { repoDir, fixtureCommit } = makeFixtureRepo();
  const specDir = makeSpecDir();
  const waitId = 'e2e-ruling-task-wait';
  const runId = 'e2e-ruling-task-run';
  const project = 'e2e-ruling-task-proj';
  const spec = 'e2e-ruling-task-spec';

  const run = baseRun(runId, project, repoDir, {
    spec,
    phase: 'implementation',
    cursor: { phase: 'implementation', stepKind: 'implementer', task: '1', attempt: 1 },
  });
  const runDir = await writeRunRecord(run);

  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'escalation',
    run: runId,
    project,
    spec,
    created: isoAgo(2 * 60_000),
    questions: [{
      id: 'ruling',
      text: 'Design defect (tasks 0/3): the greeting banner misses a comma. Rule on it.',
      free: true,
      task: '1',
    }],
    state: 'open',
    specDir,
    detail: '## Worker report\n\nThe implementer attempted the banner twice and flagged a design defect.',
    commits: [fixtureCommit],
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    await expect(page.getByTestId('band-needs-you')).toHaveCount(0);

    const header = page.getByTestId('ruling-header');
    await expect(header).toContainText(project);
    await expect(header).toContainText(spec);
    await expect(header).toContainText(waitId);
    await expect(header).toContainText(runId);
    await expect(header).toContainText('implementation');
    await expect(header).toContainText('implementer');
    await expect(header).toContainText('task 1');
    await expect(page.getByTestId('ruling-age')).toContainText(/Age .* ago/);

    await expect(page.getByTestId('now-answer-sheet')).toContainText(
      'Design defect (tasks 0/3): the greeting banner misses a comma.',
    );

    const row = page.getByTestId('ruling-task-row');
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText('Render a cheerful greeting banner');
    await expect(row).toContainText('the banner reads Hello, operator');
    await expect(row).toContainText('TDD yes');
    await expect(row).toContainText('medium');
    await expect(row).toContainText('src/greeting.ts');
    await expect(row).toContainText('src/banner.ts');

    const detail = page.getByTestId('ruling-detail');
    await expect(detail).toContainText('Worker report');
    await expect(detail).toContainText('The implementer attempted the banner twice and flagged a design defect.');

    const diff = page.getByTestId('ruling-diff');
    await expect(diff).toContainText('operator added this fixture line', { timeout: 15000 });

    // Order (Requirement 3 AC 1): wait text, task row, detail, diff, then the form.
    const sheetText = await page.getByTestId('now-answer-sheet').innerText();
    const idxWaitText = sheetText.indexOf('the greeting banner misses a comma');
    const idxTaskRow = sheetText.indexOf('Render a cheerful greeting banner');
    const idxDetail = sheetText.indexOf('Worker report');
    const idxDiffText = sheetText.indexOf('operator added this fixture line');
    const idxForm = sheetText.indexOf('Answer and continue the run');
    expect(idxWaitText).toBeGreaterThanOrEqual(0);
    expect(idxTaskRow).toBeGreaterThan(idxWaitText);
    expect(idxDetail).toBeGreaterThan(idxTaskRow);
    expect(idxDiffText).toBeGreaterThan(idxDetail);
    expect(idxForm).toBeGreaterThan(idxDiffText);

    // Requirement 6 AC 8 (the shared label) and AC 9 (Abandon offered: the
    // `ruling` question carries no `abandon` option).
    await expect(page.getByTestId('answer-submit')).toContainText('Answer and continue the run');
    await expect(page.getByTestId('ruling-abandon')).toBeVisible();
  } finally {
    await removeWaitRecord(waitId);
    await removeRunRecord(runDir);
    await rm(repoDir, { recursive: true, force: true });
    await rm(specDir, { recursive: true, force: true });
  }
});

test('(task 11) a wait whose run is gone shows run record gone and still renders the form', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const waitId = 'e2e-ruling-rungone-wait';
  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'escalation',
    run: 'e2e-ruling-rungone-missing-run',
    project: 'e2e-ruling-rungone-proj',
    spec: 'e2e-ruling-rungone-spec',
    created: isoAgo(60_000),
    questions: [{ id: 'ruling', text: 'Escalation needing a ruling.', free: true, task: '1' }],
    state: 'open',
    specDir: join(tmpdir(), 'e2e-ruling-rungone-nonexistent-specdir'),
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    await expect(page.getByTestId('now-answer-sheet')).toContainText('run record gone');
    await expect(page.getByTestId('answer-submit')).toBeVisible();
  } finally {
    await removeWaitRecord(waitId);
  }
});

test('(task 11) a gate-B wait shows Approve checked with (recommended) and The plan', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const waitId = 'e2e-ruling-gateb-wait';
  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'gate-b',
    run: 'e2e-ruling-gateb-run',
    project: 'e2e-ruling-gateb-proj',
    spec: 'e2e-ruling-gateb-spec',
    created: isoAgo(60_000),
    questions: [{
      id: 'gate-b',
      text: 'Approve the task plan, or annotate it?',
      options: ['Approve', 'Annotate'],
      recommended: 'Approve',
      free: true,
    }],
    state: 'open',
    specDir: join(tmpdir(), 'e2e-ruling-gateb-nonexistent-specdir'),
    proposals: ['Plan approved at v1.', 'Task 1: Render a cheerful greeting banner'],
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    const radios = page.getByTestId('answer-opt-gate-b');
    await expect(radios).toHaveCount(2);
    await expect(radios.first()).toBeChecked();
    await expect(page.getByTestId('now-answer-sheet')).toContainText('(recommended)');
    await expect(page.getByTestId('now-answer-sheet')).toContainText('The plan');
    await expect(page.getByTestId('now-answer-sheet')).toContainText('Task 1: Render a cheerful greeting banner');
    await expect(page.getByTestId('answer-submit')).toContainText('Answer and continue the run');
  } finally {
    await removeWaitRecord(waitId);
  }
});

test('(task 11) a gate-A wait shows its recorded decisions under Recorded without asking', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const waitId = 'e2e-ruling-gatea-wait';
  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'gate-a',
    run: 'e2e-ruling-gatea-run',
    project: 'e2e-ruling-gatea-proj',
    spec: 'e2e-ruling-gatea-spec',
    created: isoAgo(60_000),
    questions: [{
      id: 'D1',
      text: 'Use library X or roll our own?',
      options: ['Use library X', 'Roll our own'],
      recommended: 'Use library X',
      reason: 'direction-setting decision',
    }],
    state: 'open',
    specDir: join(tmpdir(), 'e2e-ruling-gatea-nonexistent-specdir'),
    proposals: ['D2 — Use caching — recorded without asking as "yes"'],
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    const radios = page.getByTestId('answer-opt-D1');
    await expect(radios).toHaveCount(2);
    await expect(radios.first()).toBeChecked();
    await expect(page.getByTestId('now-answer-sheet')).toContainText('(recommended)');
    await expect(page.getByTestId('now-answer-sheet')).toContainText('Recorded without asking');
    await expect(page.getByTestId('now-answer-sheet')).toContainText('D2 — Use caching — recorded without asking as "yes"');
  } finally {
    await removeWaitRecord(waitId);
  }
});

test('(task 11) a wait tagged to an unknown task shows task-not-found, no detail and no commits, with the form still rendering', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const specDir = makeSpecDir();
  const waitId = 'e2e-ruling-notask-wait';
  const runId = 'e2e-ruling-notask-run';
  const project = 'e2e-ruling-notask-proj';
  const spec = 'e2e-ruling-notask-spec';

  const run = baseRun(runId, project, '/tmp/e2e-ruling-notask-nonexistent', {
    spec,
    phase: 'implementation',
    cursor: { phase: 'implementation', stepKind: 'implementer', task: '99', attempt: 1 },
  });
  const runDir = await writeRunRecord(run);

  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'escalation',
    run: runId,
    project,
    spec,
    created: isoAgo(60_000),
    questions: [{ id: 'ruling', text: 'Design defect concerning an unlisted task.', free: true, task: '99' }],
    state: 'open',
    specDir,
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    const row = page.getByTestId('ruling-task-row');
    await expect(row).toContainText('task 99 not found in tasks.md', { timeout: 15000 });

    const detail = page.getByTestId('ruling-detail');
    await expect(detail).toContainText('no worker report or task review');

    const diff = page.getByTestId('ruling-diff');
    await expect(diff).toContainText('no commits for this task', { timeout: 15000 });

    await expect(page.getByTestId('answer-submit')).toBeVisible();
  } finally {
    await removeWaitRecord(waitId);
    await removeRunRecord(runDir);
    await rm(specDir, { recursive: true, force: true });
  }
});

test('(task 11) a merge wait shows the PR number, Merge and Hold', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const waitId = 'e2e-ruling-merge-wait';
  const runId = 'e2e-ruling-merge-run';
  const project = 'e2e-ruling-merge-proj';
  const spec = 'e2e-ruling-merge-spec';

  const run = baseRun(runId, project, '/tmp/e2e-ruling-merge-nonexistent', {
    spec,
    prReads: [{
      kind: 'run',
      repo: 'acme/widgets',
      number: 4821,
      url: 'https://github.com/acme/widgets/pull/4821',
      ci: 'green',
      mergeable: 'MERGEABLE',
      verdict: 'not-ready',
      reasons: ['CI still pending for the last commit'],
      at: isoAgo(30_000),
    }],
  });
  const runDir = await writeRunRecord(run);

  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'merge',
    run: runId,
    project,
    spec,
    created: isoAgo(60_000),
    questions: [{ id: 'merge', text: 'Ready to ship v2' }],
    state: 'open',
    specDir: join(tmpdir(), 'e2e-ruling-merge-nonexistent-specdir'),
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    await expect(page.getByTestId('now-answer-sheet')).toContainText('4821');
    await expect(page.getByTestId('answer-submit')).toContainText('Merge');
    await expect(page.getByTestId('answer-hold')).toBeVisible();
    await expect(page.getByTestId('answer-hold')).toContainText('Hold');
  } finally {
    await removeWaitRecord(waitId);
    await removeRunRecord(runDir);
  }
});

test('(task 11) a security wait shows three unchecked radios and a disabled answer-submit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const waitId = 'e2e-ruling-security-wait';
  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'escalation',
    run: 'e2e-ruling-security-missing-run',
    project: 'e2e-ruling-security-proj',
    spec: 'e2e-ruling-security-spec',
    created: isoAgo(60_000),
    questions: [{
      id: 'security',
      text: 'Security findings survived the loop (tasks 2/3):\n'
        + 'cmd-injection (src/foo.ts): rm -rf\n'
        + 'Accept to record them, retry the pass, or abandon the run.',
      options: ['accept', 'retry', 'abandon'],
    }],
    state: 'open',
    specDir: join(tmpdir(), 'e2e-ruling-security-nonexistent-specdir'),
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    const radios = page.getByTestId('answer-opt-security');
    await expect(radios).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(radios.nth(i)).not.toBeChecked();
    }
    await expect(page.getByTestId('answer-submit')).toBeDisabled();
  } finally {
    await removeWaitRecord(waitId);
  }
});

test('(task 11) a taskless escalation shows no task: raised in the document phase', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const waitId = 'e2e-ruling-taskless-wait';
  const runId = 'e2e-ruling-taskless-run';
  const project = 'e2e-ruling-taskless-proj';
  const spec = 'e2e-ruling-taskless-spec';

  const run = baseRun(runId, project, '/tmp/e2e-ruling-taskless-nonexistent', {
    spec,
    phase: 'document',
  });
  const runDir = await writeRunRecord(run);

  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'escalation',
    run: runId,
    project,
    spec,
    created: isoAgo(60_000),
    questions: [{ id: 'escalation', text: 'Draft phase escalated: ambiguous requirement.', free: true }],
    state: 'open',
    specDir: join(tmpdir(), 'e2e-ruling-taskless-nonexistent-specdir'),
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    await expect(page.getByTestId('now-answer-sheet')).toContainText('no task: raised in the document phase');
  } finally {
    await removeWaitRecord(waitId);
    await removeRunRecord(runDir);
  }
});

test('(task 11) a removed worktree shows worktree gone and answer-submit enables once a ruling is typed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const waitId = 'e2e-ruling-noworktree-wait';
  const runId = 'e2e-ruling-noworktree-run';
  const project = 'e2e-ruling-noworktree-proj';
  const spec = 'e2e-ruling-noworktree-spec';
  const missingWorktree = join(tmpdir(), `e2e-ruling-missing-worktree-${randomBytes(4).toString('hex')}`);

  const run = baseRun(runId, project, missingWorktree, {
    spec,
    phase: 'implementation',
    cursor: { phase: 'implementation', stepKind: 'implementer', task: '1', attempt: 1 },
  });
  const runDir = await writeRunRecord(run);

  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'escalation',
    run: runId,
    project,
    spec,
    created: isoAgo(60_000),
    questions: [{
      id: 'ruling',
      text: 'Design defect (tasks 1/3): needs a ruling.',
      free: true,
      task: '1',
    }],
    state: 'open',
    specDir: join(tmpdir(), 'e2e-ruling-noworktree-nonexistent-specdir'),
    commits: ['deadbeef1'],
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    await expect(page.getByTestId('ruling-diff')).toContainText('worktree gone', { timeout: 15000 });

    const submit = page.getByTestId('answer-submit');
    await expect(submit).toBeDisabled();
    await page.getByTestId('answer-text-ruling').fill('Approved: ship it as written.');
    await expect(submit).toBeEnabled();
  } finally {
    await removeWaitRecord(waitId);
    await removeRunRecord(runDir);
  }
});

test('(task 12) a ruling with a note writes the folded answer and questions.md, then the view returns to the board once the run leaves waiting', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const specDir = mkdtempSync(join(tmpdir(), 'e2e-ruling-stage-spec-'));
  const waitId = 'e2e-ruling-stage-wait';
  const runId = 'e2e-ruling-stage-run';
  const project = 'e2e-ruling-stage-proj';
  const spec = 'e2e-ruling-stage-spec';
  const rulingText = 'Approved: ship the banner fix as written.';
  const noteText = 'Double-checked the comma fix with the style guide.';

  // `pauseRequested` set (design D11): once the real controller here answers
  // the wait, `onWaitChange` (`src/controller/controller.ts:671-673`) parks
  // the run `paused` rather than driving it, so it leaves `waiting` without
  // the suite running a real harness unit.
  const run = baseRun(runId, project, '/tmp/e2e-ruling-stage-nonexistent', {
    spec,
    pauseRequested: isoAgo(5 * 60_000),
  });
  const runDir = await writeRunRecord(run);

  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'escalation',
    run: runId,
    project,
    spec,
    created: isoAgo(60_000),
    questions: [{ id: 'ruling', text: 'Design defect: rule on the banner fix.', free: true }],
    state: 'open',
    specDir,
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    await page.getByTestId('answer-text-ruling').fill(rulingText);
    await page.getByTestId('ruling-notes').fill(noteText);
    await page.getByTestId('answer-submit').click();

    // At base `HomePage` passes `stage={null}` unconditionally, so
    // `answer-stage` (`AnswerStageLine`) never renders no matter how long the
    // test waits; this assertion is the behaviour task 12 wires in.
    await expect(page.getByTestId('answer-stage')).toBeVisible({ timeout: 5000 });
    // Past this point the server's `answerWait` (which writes the wait
    // record and `questions.md` before resolving) has returned.
    await expect(page.getByTestId('answer-stage')).toHaveText(/running|done/, { timeout: 10000 });

    const record = await readWaitRecord(waitId);
    expect(record.answer?.ruling?.by).toBe('operator');
    expect(record.answer?.ruling?.value).toBe(`${rulingText}\n\nNotes: ${noteText}`);

    const questionsMd = await readFile(join(specDir, 'questions.md'), 'utf-8');
    expect(questionsMd).toContain(`## escalation ${waitId}`);
    expect(questionsMd).toContain(rulingText);
    expect(questionsMd).toContain(`Notes: ${noteText}`);

    await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`wait-tile-${waitId}`)).toHaveCount(0);
    await expect(page.getByTestId(`run-tile-${runId}`)).toBeVisible();
    await expect(page.getByTestId(`run-status-${runId}`)).toContainText('paused');
  } finally {
    await removeWaitRecord(waitId);
    await removeRunRecord(runDir);
    await rm(specDir, { recursive: true, force: true });
  }
});

test('(task 12) a 500 from the answer request shows failed in answer-stage, keeps the typed values and re-enables answer-submit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const waitId = 'e2e-ruling-stage-fail-wait';
  const rulingText = 'Approved: ship it, pending the follow-up.';
  const noteText = 'Flagging this for a second look next sprint.';

  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'escalation',
    run: 'e2e-ruling-stage-fail-missing-run',
    project: 'e2e-ruling-stage-fail-proj',
    spec: 'e2e-ruling-stage-fail-spec',
    created: isoAgo(60_000),
    questions: [{ id: 'ruling', text: 'Design defect: needs a ruling.', free: true }],
    state: 'open',
    specDir: join(tmpdir(), 'e2e-ruling-stage-fail-nonexistent-specdir'),
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    await page.route(`**/api/controller/waits/${waitId}/answer`, (route) => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ reason: 'simulated server failure' }),
    }));

    await page.getByTestId('answer-text-ruling').fill(rulingText);
    await page.getByTestId('ruling-notes').fill(noteText);
    const submit = page.getByTestId('answer-submit');
    await submit.click();

    await expect(page.getByTestId('answer-stage')).toHaveText('failed: simulated server failure', { timeout: 5000 });
    await expect(page.getByTestId('answer-text-ruling')).toHaveValue(rulingText);
    await expect(page.getByTestId('ruling-notes')).toHaveValue(noteText);
    await expect(submit).toBeEnabled();
  } finally {
    await removeWaitRecord(waitId);
  }
});

test('(task 12) a gate wait answered with a picked option and a note sends the option alone, with Notes in the receipt', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const specDir = mkdtempSync(join(tmpdir(), 'e2e-ruling-stage-gate-spec-'));
  const waitId = 'e2e-ruling-stage-gate-wait';
  const runId = 'e2e-ruling-stage-gate-run';
  const project = 'e2e-ruling-stage-gate-proj';
  const spec = 'e2e-ruling-stage-gate-spec';
  const noteText = 'Please double check the naming before merging.';

  const run = baseRun(runId, project, '/tmp/e2e-ruling-stage-gate-nonexistent', {
    spec,
    pauseRequested: isoAgo(5 * 60_000),
  });
  const runDir = await writeRunRecord(run);

  const wait: WaitRecord & { specDir: string } = {
    v: 1,
    id: waitId,
    kind: 'gate-b',
    run: runId,
    project,
    spec,
    created: isoAgo(60_000),
    questions: [{
      id: 'gate-b',
      text: 'Approve the task plan, or annotate it?',
      options: ['Approve', 'Annotate'],
      free: true,
    }],
    state: 'open',
    specDir,
  };
  await writeWaitRecord(wait);

  try {
    await pressAnswer(page, waitId);

    await page.getByTestId('answer-opt-gate-b').nth(1).check();
    await page.getByTestId('ruling-notes').fill(noteText);
    await page.getByTestId('answer-submit').click();

    await expect(page.getByTestId('answer-stage')).toHaveText(/running|done/, { timeout: 10000 });

    const record = await readWaitRecord(waitId);
    expect(record.answer?.['gate-b']?.value).toBe('Annotate');

    const questionsMd = await readFile(join(specDir, 'questions.md'), 'utf-8');
    expect(questionsMd).toContain('## Gate B');
    expect(questionsMd).toContain('Annotate');
    expect(questionsMd).toContain(`Notes: ${noteText}`);
  } finally {
    await removeWaitRecord(waitId);
    await removeRunRecord(runDir);
    await rm(specDir, { recursive: true, force: true });
  }
});
