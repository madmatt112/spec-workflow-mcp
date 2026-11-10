import { expect, test, type Page } from '@playwright/test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { mkdtempSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { sddHome } from '../src/dashboard/harness/state-files.js';
import { scrubbedGitEnv } from '../src/core/git-utils.js';
import type { RunRecord, WaitRecord } from '../src/controller/state.js';

/**
 * Browser checks of the ruling view (design.md C8; decomposition task 11;
 * Requirements 1, 3, 4, 5, 6). Runs on `playwright.worktree.config.ts`, whose
 * dashboard webServer sets `SDD_DEPLOY_DISABLED=1`, so a seeded `waits/<id>.json`
 * or `runs/<id>/run.json` stays exactly as written — the same fixture style
 * `e2e/worktree-board.spec.ts` uses. Every case reaches the view only through
 * the one seam the decomposition names: pressing "Answer" on the wait's tile
 * (`tile.getByRole('button', { name: 'Answer', exact: true }).click()`). No
 * case needs a login: every route the view reads is a GET, and the access
 * guard lets a loopback GET through unauthenticated (`src/controller/access.ts`).
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
 *    commit's added line.
 *    Source: task 11 Success, first clause; Requirements 1.2, 1.3, 1.5, 3.1,
 *    3.2, 3.3, 3.6, 4.2, 4.5 (added line), 4.7 (worker report before review).
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
 *    (recommended) and The plan"; Requirements 5.1, 5.3, 6.2.
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

async function pressAnswer(page: Page, waitId: string): Promise<void> {
  await page.goto('/');
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
  } finally {
    await removeWaitRecord(waitId);
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
