import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { sddHome } from '../src/dashboard/harness/state-files.js';
import { secretPath } from '../src/controller/access.js';
import type { RunRecord, WaitRecord, PrRead } from '../src/controller/state.js';

/**
 * Browser checks of Home (design C10 "Home and tiles"; decomposition task 11;
 * Requirements 3, 4, 11.3, 11.4). Runs on `playwright.worktree.config.ts`,
 * whose dashboard webServer sets `SDD_DEPLOY_DISABLED=1`: the real
 * `Controller` behind this page never ticks its deploy coordinator, so a
 * seeded `waits/<id>.json` or `runs/<id>/run.json` stays exactly as written.
 * No project is registered for most tests (`ProjectProvider.enabled()` reads
 * an id absent from its disabled list as on); the one test that must prove a
 * ledger-derived wait never reaches Home registers a real, non-git project
 * through `POST /api/projects/add` directly against the dashboard API (not
 * through the page), the same way test setup elsewhere seeds files straight
 * onto disk.
 *
 * Every mutating call test setup makes goes straight to the dashboard API at
 * `DASHBOARD_API_BASE_URL`, not through the page's `fetch`, so none of it
 * depends on the vite dev proxy's Origin rewrite; only the UI-driven answer
 * flow (clicking "Answer and continue") exercises that proxy.
 */

/** Logs the page's browser context in, as `e2e/worktree-visual.spec.ts:133-135` does, so its `page.request` calls past this point carry the session the mutating routes require. */
async function login(page: Page): Promise<void> {
  const secret = (await readFile(secretPath(), 'utf-8')).trim();
  await page.request.post('/api/login', { data: { secret } });
}

function isoAgo(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

function waitPath(id: string): string {
  return join(sddHome(), 'waits', `${id}.json`);
}

function baseWait(
  id: string,
  project: string,
  spec: string,
  createdMs: number,
  overrides: Partial<WaitRecord> = {},
): WaitRecord {
  return {
    v: 1,
    id,
    kind: 'question',
    run: 'e2e-board-no-run',
    project,
    spec,
    created: isoAgo(createdMs),
    questions: [],
    state: 'open',
    ...overrides,
  };
}

async function writeWaitRecord(record: WaitRecord & { specDir?: string }): Promise<void> {
  await mkdir(join(sddHome(), 'waits'), { recursive: true });
  await writeFile(waitPath(record.id), JSON.stringify(record, null, 2) + '\n', 'utf-8');
}

async function removeWaitRecord(id: string): Promise<void> {
  await rm(waitPath(id), { force: true });
}

const BASE_TOKENS = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

function baseRun(id: string, project: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    v: 1, id, project,
    codeRoot: '/tmp/e2e-board-nonexistent', specStore: '/tmp/e2e-board-nonexistent',
    spec: 'e2e-board-run-spec', worktree: '/tmp/e2e-board-nonexistent', branch: 'feat/e2e-board',
    // 'running', not 'merging': the real Controller's scheduler (not gated by
    // SDD_DEPLOY_DISABLED) treats any on-disk 'merging' run with no `resumeAt`
    // as startable and drives it, raising its own "no pull request" error
    // wait for this nonexistent codeRoot. `mergeRead`/the tile only read
    // `prReads`, never `status`, so 'running' renders identically and stays
    // untouched by the scheduler.
    status: 'running',
    created: isoAgo(5 * 60_000), updated: isoAgo(60_000),
    tokens: BASE_TOKENS,
    ...overrides,
  };
}

async function writeRunRecord(run: RunRecord): Promise<string> {
  const dir = join(sddHome(), 'runs', run.id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'run.json'), JSON.stringify(run, null, 2) + '\n', 'utf-8');
  return dir;
}

async function removeRunRecord(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/** A fresh PrRead, letting a test override only the fields it cares about. */
function prRead(overrides: Partial<PrRead> & Pick<PrRead, 'kind' | 'repo' | 'number' | 'ci' | 'verdict'>): PrRead {
  return { reasons: [], at: isoAgo(60_000), ...overrides };
}

/**
 * Registers a real, non-git project directly against the dashboard API (no
 * browser involved), with a HANDOFF routing header and a ledger `phase.end`
 * row whose `result` is `gate-a` (the same shape `e2e/worktree-shell.spec.ts`
 * seeds for its gate test) — the input the legacy `now.waits` deriver turns
 * into a `Wait` row. No `waits/<id>.json` controller record exists for it.
 */
async function registerGateLedgerProject(page: Page): Promise<{ projectId: string; dir: string }> {
  const dir = join(tmpdir(), `specwf-e2e-board-${randomBytes(4).toString('hex')}`);
  const workflowRoot = join(dir, '.spec-workflow');
  const spec = 'e2e-board-gate-spec';
  const specDir = join(workflowRoot, 'specs', spec);
  await mkdir(specDir, { recursive: true });
  await writeFile(
    join(workflowRoot, 'HANDOFF.md'),
    `# HANDOFF\n\n> **READ FIRST.** Active spec **\`${spec}\`**.\n`,
    'utf-8',
  );
  const ledger = [
    { ts: isoAgo(120_000), type: 'run.start', run: 'e2e-board-gate-run' },
    { ts: isoAgo(90_000), type: 'phase.end', run: 'e2e-board-gate-run', spec, phase: 'requirements', result: 'gate-a' },
  ];
  await writeFile(
    join(specDir, 'harness-events.jsonl'),
    ledger.map((e) => JSON.stringify(e)).join('\n') + '\n',
    'utf-8',
  );
  await login(page);
  const res = await page.request.post('/api/projects/add', { data: { projectPath: dir } });
  if (!res.ok()) throw new Error(`project registration failed (${res.status()})`);
  const data = (await res.json()) as { projectId: string };
  return { projectId: data.projectId, dir };
}

async function unregisterProject(page: Page, projectId: string, dir: string): Promise<void> {
  await page.request.delete(`/api/projects/${projectId}`).catch(() => undefined);
  await rm(dir, { recursive: true, force: true });
}

test.describe('Home (board)', () => {
  test.setTimeout(60000);

  test.beforeAll(async () => {
    await mkdir(sddHome(), { recursive: true });
  });

  // Criteria "Home shows Needs you, Running and Next in that order with no
  // collapse control", "an empty band shows one quiet line" and "no filter,
  // search, pagination or closed-spec list exists" (task 11 Success;
  // Requirement 3 AC 1, 2, 4, 8; design C10 "Each band is a `section` with
  // test id ...; An empty band shows one quiet line").
  //   Pre-condition: a fresh Home with no waits, runs or actions seeded.
  //   Test: page.goto('/'), then the three `[data-testid^="band-"]` sections.
  //   Observable result: exactly 3 bands in order band-needs-you,
  //   band-running, band-next; none has an `[aria-expanded]` toggle or a
  //   tile; each still renders non-empty text (the quiet line); no
  //   search-box, pager or group-now-closed element exists.
  //   Expected-value source: design C10's band order and test ids, and the
  //   task's explicit list of removed chrome.
  test('(R3 AC1, AC2, AC4, AC8) Home shows three ordered, uncollapsible bands with quiet lines and no filter, search, pagination or closed list', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const bands = page.locator('[data-testid^="band-"]');
    await expect(bands).toHaveCount(3, { timeout: 15000 });
    await expect(bands.nth(0)).toHaveAttribute('data-testid', 'band-needs-you');
    await expect(bands.nth(1)).toHaveAttribute('data-testid', 'band-running');
    await expect(bands.nth(2)).toHaveAttribute('data-testid', 'band-next');

    for (const testId of ['band-needs-you', 'band-running', 'band-next']) {
      const band = page.getByTestId(testId);
      await expect(band.locator('[aria-expanded]')).toHaveCount(0);
      await expect(
        band.locator(
          '[data-testid^="wait-tile-"], [data-testid^="action-tile-"], [data-testid^="run-tile-"], [data-testid^="next-tile-"]',
        ),
      ).toHaveCount(0);
      const text = (await band.textContent())?.trim() ?? '';
      expect(text.length).toBeGreaterThan(0);
    }

    await expect(page.getByTestId('search-box')).toHaveCount(0);
    await expect(page.getByTestId('pager')).toHaveCount(0);
    await expect(page.getByTestId('group-now-closed')).toHaveCount(0);
  });

  // Criterion "a disabled project's wait has no tile (requirement 3 AC 5)"
  // (task 11 Success; Requirement 3 AC 5 "WHEN a wait, run or action belongs
  // to a project that is off THEN Home SHALL show no tile for it").
  //   Pre-condition: a wait record on `projectId`, and `localStorage
  //   shell.projects` set to `[projectId]` (the off-list) before the page
  //   loads.
  //   Test: page.goto('/'), then page.getByTestId(`wait-tile-${wait.id}`).
  //   Observable result: band-needs-you is visible; the wait's tile has
  //   count 0.
  //   Expected-value source: Requirement 3 AC 5's filter rule, applied
  //   through `needsYou`'s `enabled` parameter (design C9).
  test('(R3 AC5) a disabled project\'s wait has no tile', async ({ page }) => {
    const projectId = 'e2e-board-disabled-proj';
    const wait = baseWait('e2e-board-disabled-wait', projectId, 'e2e-board-disabled-spec', 5 * 60_000);
    await writeWaitRecord(wait);
    try {
      await page.addInitScript((id) => {
        window.localStorage.setItem('shell.projects', JSON.stringify([id]));
      }, projectId);
      await page.goto('/');
      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`wait-tile-${wait.id}`)).toHaveCount(0);
    } finally {
      await removeWaitRecord(wait.id);
    }
  });

  // Criterion "only controller waits show: a `gate-a` ledger row with no
  // controller wait gives no tile" (task 11 Success; Requirement 3 AC 6
  // "Waits derived from harness files SHALL NOT appear").
  //   Pre-condition: a registered project whose ledger carries a
  //   `phase.end` row with `result: 'gate-a'` and no `waits/<id>.json`
  //   controller record.
  //   Test: page.goto('/'), then `[data-testid^="wait-tile-"]` inside
  //   band-needs-you after the feed has had time to push.
  //   Observable result: 0 wait tiles; the band still renders non-empty
  //   text (the quiet line).
  //   Expected-value source: design C9's `needsYou(waits, actions, enabled)`
  //   reads only `ControllerWait[]`, never the legacy ledger-derived `Wait`.
  test('(R3 AC6) a gate-a ledger row with no controller wait record gives no tile', async ({ page }) => {
    const { projectId, dir } = await registerGateLedgerProject(page);
    try {
      await page.goto('/');
      const band = page.getByTestId('band-needs-you');
      await expect(band).toBeVisible({ timeout: 15000 });
      // Give the (irrelevant, if Home is correct) shell-now push time to land.
      await page.waitForTimeout(3000);
      await expect(page.locator('[data-testid^="wait-tile-"]')).toHaveCount(0);
      const text = (await band.textContent())?.trim() ?? '';
      expect(text.length).toBeGreaterThan(0);
    } finally {
      await unregisterProject(page, projectId, dir);
    }
  });

  // Criteria "two waits sort oldest first" and "tiles sit in two columns at
  // 1024 px and one at 1023 px" (task 11 Success; Requirement 3 AC 6 "oldest
  // `created` first"; Requirement 3 AC 3 "1024 px ... two columns; below
  // that, in one").
  //   Pre-condition: two open waits on the same project, one created 2h
  //   ago, one 5m ago.
  //   Test: page.goto('/'), then the ordered `[data-testid^="wait-tile-"]`
  //   list, and each tile's `boundingBox()` at 1024px and at 1023px.
  //   Observable result: the DOM order is [older, newer]; at 1024px the two
  //   tiles share a row (y within 5px) with the newer tile to the right; at
  //   1023px the newer tile's y is more than 10px below the older one's.
  //   Expected-value source: design C9 `needsYou`'s `created`-ascending
  //   sort, and design C12's probe that `lg:grid-cols-2` activates at
  //   `width >= 64rem` (1024px).
  test('(R3 AC3, AC6) two waits sort oldest first, and lay out two columns at 1024px, one at 1023px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const older = baseWait('e2e-board-sort-older', 'e2e-board-sort-proj', 'e2e-board-sort-spec', 2 * 3_600_000);
    const newer = baseWait('e2e-board-sort-newer', 'e2e-board-sort-proj', 'e2e-board-sort-spec', 5 * 60_000);
    await writeWaitRecord(older);
    await writeWaitRecord(newer);
    try {
      await page.goto('/');
      const olderTile = page.getByTestId(`wait-tile-${older.id}`);
      const newerTile = page.getByTestId(`wait-tile-${newer.id}`);
      await expect(olderTile).toBeVisible({ timeout: 15000 });
      await expect(newerTile).toBeVisible();

      const ids = await page
        .locator('[data-testid^="wait-tile-"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
      expect(ids).toEqual([`wait-tile-${older.id}`, `wait-tile-${newer.id}`]);

      await page.setViewportSize({ width: 1024, height: 900 });
      await page.waitForTimeout(300);
      const wideOlder = await olderTile.boundingBox();
      const wideNewer = await newerTile.boundingBox();
      expect(wideOlder).not.toBeNull();
      expect(wideNewer).not.toBeNull();
      expect(Math.abs(wideOlder!.y - wideNewer!.y)).toBeLessThan(5);
      expect(wideNewer!.x).toBeGreaterThan(wideOlder!.x);

      await page.setViewportSize({ width: 1023, height: 900 });
      await page.waitForTimeout(300);
      const narrowOlder = await olderTile.boundingBox();
      const narrowNewer = await newerTile.boundingBox();
      expect(narrowOlder).not.toBeNull();
      expect(narrowNewer).not.toBeNull();
      expect(narrowNewer!.y).toBeGreaterThan(narrowOlder!.y + 10);
    } finally {
      await removeWaitRecord(older.id);
      await removeWaitRecord(newer.id);
    }
  });

  // Criterion "`data-tone` is `neutral` at 5 minutes, `warning` at 20 and
  // `danger` at 2 hours" (task 11 Success, warning/danger half; Requirement
  // 4 AC 2 "from 15 minutes to under 1 hour, amber; at 1 hour and after,
  // red"). The neutral-at-5-minutes half is covered by the fields test
  // below, same tile shape, so it is not repeated here.
  //   Pre-condition: two waits on the same project, created 20m and 2h ago.
  //   Test: page.goto('/'), then each wait-tile's `data-tone` attribute.
  //   Observable result: the 20m-old tile's `data-tone` is `warning`; the
  //   2h-old tile's is `danger`.
  //   Expected-value source: design C9 `ageTone(ms)`: `warning` from
  //   900,000 ms, `danger` from 3,600,000 ms.
  test('(R4 AC2) data-tone is warning at 20 minutes and danger at 2 hours', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const warn = baseWait('e2e-board-tone-warn', 'e2e-board-tone-proj', 'e2e-board-tone-spec', 20 * 60_000);
    const danger = baseWait('e2e-board-tone-danger', 'e2e-board-tone-proj', 'e2e-board-tone-spec', 2 * 3_600_000);
    await writeWaitRecord(warn);
    await writeWaitRecord(danger);
    try {
      await page.goto('/');
      await expect(page.getByTestId(`wait-tile-${warn.id}`)).toHaveAttribute('data-tone', 'warning', { timeout: 15000 });
      await expect(page.getByTestId(`wait-tile-${danger.id}`)).toHaveAttribute('data-tone', 'danger');
    } finally {
      await removeWaitRecord(warn.id);
      await removeWaitRecord(danger.id);
    }
  });

  // Criterion "a wait seeded just under 15 minutes old turns `warning` with
  // no reload" (task 11 Success; Requirement 4 AC 2 "The colour SHALL
  // change with no reload").
  //   Pre-condition: a wait created 15 minutes minus 8 seconds ago (so the
  //   900,000 ms boundary is crossed about 8s after the page loads).
  //   Test: page.goto('/'), read the tile's `data-tone` immediately, then
  //   again with an 15s timeout and no further navigation or reload.
  //   Observable result: `data-tone` is `neutral` right after load, then
  //   becomes `warning` with no `page.reload()` in between.
  //   Expected-value source: design C10's one-second tick re-deriving
  //   `needsYou`/`ageTone` on every render, so the DOM updates in place.
  test('(R4 AC2) a wait just under 15 minutes old turns warning with no reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const wait = baseWait('e2e-board-boundary-wait', 'e2e-board-boundary-proj', 'e2e-board-boundary-spec', 15 * 60_000 - 8_000);
    await writeWaitRecord(wait);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`wait-tile-${wait.id}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toHaveAttribute('data-tone', 'neutral');
      await expect(tile).toHaveAttribute('data-tone', 'warning', { timeout: 15000 });
    } finally {
      await removeWaitRecord(wait.id);
    }
  });

  // Criteria "the tile shows kind, project tag, spec, summary, age and
  // Answer", the neutral-at-5-minutes half of the tone criterion, and "with
  // no read it says `PR not read yet`" (task 11 Success; Requirement 4 AC 1
  // "the kind label, project tag, spec, the wait's summary line, the age
  // ..., and one action, 'Answer'"; Requirement 4 AC 3 "IF no read matches
  // THEN the tile SHALL say 'PR not read yet'").
  //   Pre-condition: a `merge` wait 5 minutes old with a question text, on a
  //   run whose only `prReads` entry is a `closeout` read that matches
  //   neither `merge` (question id `merge` wants `kind: 'run'`) nor any
  //   `merge:<repo>#<n>` id.
  //   Test: page.goto('/'), then the wait's tile and its text content and
  //   `data-tone`.
  //   Observable result: `data-tone` is `neutral`; the tile's text contains
  //   "Merge", the project id, the spec, the question text, an age like
  //   "5m", an "Answer" button, and "PR not read yet".
  //   Expected-value source: Requirement 4 AC 1's field list and design
  //   C9's `waitSummary`/`ageTone`; Requirement 4 AC 3's no-match fallback
  //   text, verbatim from the task's `_Prompt`.
  test('(R4 AC1, AC3) a wait tile shows kind, project tag, spec, summary, age, Answer, and "PR not read yet" with no matching read', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const waitId = 'e2e-board-fields-wait';
    const runId = 'e2e-board-fields-run';
    const project = 'e2eboardfieldsproj';
    const spec = 'e2eboardfieldsspec';
    const wait = baseWait(waitId, project, spec, 5 * 60_000, {
      kind: 'merge',
      run: runId,
      questions: [{ id: 'merge', text: 'Ready to ship v2' }],
    });
    const run = baseRun(runId, project, {
      prReads: [prRead({ kind: 'closeout', repo: 'acme/widgets', number: 3, ci: 'green', verdict: 'waiting' })],
    });
    await writeWaitRecord(wait);
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`wait-tile-${waitId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toHaveAttribute('data-tone', 'neutral');
      await expect(tile).toContainText('Merge');
      await expect(tile).toContainText(project);
      await expect(tile).toContainText(spec);
      await expect(tile).toContainText('Ready to ship v2');
      await expect(tile).toContainText(/\b\d+m\b/);
      await expect(tile.getByRole('button', { name: 'Answer', exact: true })).toBeVisible();
      await expect(tile).toContainText('PR not read yet');
    } finally {
      await removeWaitRecord(waitId);
      await removeRunRecord(runDir);
    }
  });

  // Criterion "a merge wait shows PR number, CI state and verdict for
  // `merge` ..." (task 11 Success; Requirement 4 AC 3 "`merge` takes the
  // `kind: 'run'` read").
  //   Pre-condition: a `merge` wait whose question id is exactly `merge`,
  //   on a run with one `prReads` entry of `kind: 'run'`, PR #7, `ci:
  //   'green'`, `verdict: 'waiting'`.
  //   Test: page.goto('/'), then the wait's tile's text content.
  //   Observable result: the tile's text contains "7", "green" and
  //   "waiting".
  //   Expected-value source: design C9 `mergeRead`'s `merge`-id branch,
  //   which takes the `kind: 'run'` read; the PR number, ci and verdict are
  //   the seeded `PrRead`'s own field values.
  test('(R4 AC3) a merge wait with question id "merge" shows the run-kind PR read', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const waitId = 'e2e-board-merge-run-wait';
    const runId = 'e2e-board-merge-run-run';
    const project = 'e2e-board-merge-run-proj';
    const wait = baseWait(waitId, project, 'e2e-board-merge-run-spec', 5 * 60_000, {
      kind: 'merge',
      run: runId,
      questions: [{ id: 'merge', text: 'Ready to ship' }],
    });
    const run = baseRun(runId, project, {
      prReads: [prRead({ kind: 'run', repo: 'acme/widgets', number: 7, ci: 'green', verdict: 'waiting' })],
    });
    await writeWaitRecord(wait);
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`wait-tile-${waitId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('7');
      await expect(tile).toContainText('green');
      await expect(tile).toContainText('waiting');
    } finally {
      await removeWaitRecord(waitId);
      await removeRunRecord(runDir);
    }
  });

  // Criterion "... and for `merge:` plus repo and number" (task 11 Success;
  // Requirement 4 AC 3 "`merge:` plus repo and number takes the read with
  // that repo and number").
  //   Pre-condition: a `merge` wait whose question id is
  //   `merge:acme/widgets#9`, on a run with two `prReads` entries: one for
  //   `other/x#1` (which must not match) and one for `acme/widgets#9` with
  //   `ci: 'red'`, `verdict: 'blocked'`.
  //   Test: page.goto('/'), then the wait's tile's text content.
  //   Observable result: the tile's text contains "9", "red" and "blocked"
  //   (the matching read), not the non-matching read's fields.
  //   Expected-value source: design C9 `mergeRead`'s `merge:<repo>#<n>`
  //   regex branch, matched against the seeded `PrRead`'s own `repo`,
  //   `number`, `ci` and `verdict`.
  test('(R4 AC3) a merge:<repo>#<number> question id shows the matching PR read', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const waitId = 'e2e-board-merge-named-wait';
    const runId = 'e2e-board-merge-named-run';
    const project = 'e2e-board-merge-named-proj';
    const wait = baseWait(waitId, project, 'e2e-board-merge-named-spec', 5 * 60_000, {
      kind: 'merge',
      run: runId,
      questions: [{ id: 'merge:acme/widgets#9', text: 'Ready to ship' }],
    });
    const run = baseRun(runId, project, {
      prReads: [
        prRead({ kind: 'run', repo: 'other/x', number: 1, ci: 'pending', verdict: 'not-ready' }),
        prRead({ kind: 'closeout', repo: 'acme/widgets', number: 9, ci: 'red', verdict: 'blocked' }),
      ],
    });
    await writeWaitRecord(wait);
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`wait-tile-${waitId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('9');
      await expect(tile).toContainText('red');
      await expect(tile).toContainText('blocked');
    } finally {
      await removeWaitRecord(waitId);
      await removeRunRecord(runDir);
    }
  });

  // Criterion "Answer replaces the board with the sheet at full width and a
  // `Back to board` link" (task 11 Success; Requirement 4 AC 4 "the
  // existing answer sheet SHALL replace the board at full width, with a
  // 'Back to board' link and no panel beside it").
  //   Pre-condition: an open wait, and the board's band-needs-you bounding
  //   box captured before the press.
  //   Test: tile.getByRole('button', { name: 'Answer' }).click().
  //   Observable result: `now-answer-sheet` becomes visible; band-needs-you
  //   disappears; "Back to board" text is visible; the sheet's width is
  //   within 20px of the board's captured width (full width, not a side
  //   panel).
  //   Expected-value source: design C10 "While a wait is open, Home renders
  //   a 'Back to board' link and `AnswerSheet` at full width instead of the
  //   bands."
  test('(R4 AC4) pressing Answer replaces the board with the sheet at full width and a Back to board link', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const wait = baseWait('e2e-board-open-wait', 'e2e-board-open-proj', 'e2e-board-open-spec', 5 * 60_000);
    await writeWaitRecord(wait);
    try {
      await page.goto('/');
      const band = page.getByTestId('band-needs-you');
      await expect(band).toBeVisible({ timeout: 15000 });
      const boardBox = await band.boundingBox();

      const tile = page.getByTestId(`wait-tile-${wait.id}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Answer', exact: true }).click();

      const sheet = page.getByTestId('now-answer-sheet');
      await expect(sheet).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('band-needs-you')).toHaveCount(0);
      await expect(page.getByText('Back to board')).toBeVisible();

      const sheetBox = await sheet.boundingBox();
      expect(boardBox).not.toBeNull();
      expect(sheetBox).not.toBeNull();
      expect(Math.abs(sheetBox!.width - boardBox!.width)).toBeLessThan(20);
    } finally {
      await removeWaitRecord(wait.id);
    }
  });

  // Criterion "the link returns the board" (task 11 Success; Requirement 4
  // AC 5 "WHEN the sheet's wait is answered, here or elsewhere, THEN the
  // board SHALL return" — the link is the "here, with no answer" cause).
  //   Pre-condition: an open wait; Answer already pressed so the sheet is
  //   showing.
  //   Test: page.getByText('Back to board').click().
  //   Observable result: band-needs-you becomes visible again;
  //   now-answer-sheet's count drops to 0.
  //   Expected-value source: design C10's `openWaitId`, cleared by the link
  //   with no server round-trip, so the board re-renders.
  test('(R4 AC5) the Back to board link returns to the board', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const wait = baseWait('e2e-board-back-wait', 'e2e-board-back-proj', 'e2e-board-back-spec', 5 * 60_000);
    await writeWaitRecord(wait);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`wait-tile-${wait.id}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Answer', exact: true }).click();
      await expect(page.getByTestId('now-answer-sheet')).toBeVisible({ timeout: 15000 });

      await page.getByText('Back to board').click();

      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('now-answer-sheet')).toHaveCount(0);
    } finally {
      await removeWaitRecord(wait.id);
    }
  });

  // Criterion "answering in the sheet returns the board" (task 11 Success;
  // Requirement 4 AC 5, the "answered here" cause).
  //   Pre-condition: an open wait with no questions (so `answer-submit`
  //   needs no field filled); Answer already pressed so the sheet is
  //   showing.
  //   Test: page.getByTestId('answer-submit').click().
  //   Observable result: band-needs-you becomes visible again;
  //   now-answer-sheet's count drops to 0.
  //   Expected-value source: design C10 "The open wait is re-derived from
  //   `needsYou` on each render. When the wait is gone, answered or
  //   filtered, `openWaitId` no longer matches and the board returns"; the
  //   POST answer moves the wait's state off `open`, so the next
  //   `controller-waits` push drops it from `needsYou`.
  test('(R4 AC5) answering in the sheet returns to the board', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const waitId = 'e2e-board-answer-wait';
    const notesDir = join(tmpdir(), `specwf-e2e-board-notes-${waitId}`);
    const wait: WaitRecord & { specDir: string } = { ...baseWait(waitId, 'e2e-board-answer-proj', 'e2e-board-answer-spec', 5 * 60_000), specDir: notesDir };
    await writeWaitRecord(wait);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`wait-tile-${waitId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Answer', exact: true }).click();
      await expect(page.getByTestId('now-answer-sheet')).toBeVisible({ timeout: 15000 });

      // A real mutation through the answer route needs a session, the same
      // way the row Pause press does (e2e/worktree-shell.spec.ts:505-508).
      await login(page);
      await page.getByTestId('answer-submit').click();

      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('now-answer-sheet')).toHaveCount(0);
    } finally {
      await removeWaitRecord(waitId);
      await rm(notesDir, { recursive: true, force: true });
    }
  });

  // Criterion "a wait answered through the route while the sheet is open
  // returns it too" (task 11 Success; Requirement 4 AC 5 "here, or
  // elsewhere" — the "elsewhere" cause).
  //   Pre-condition: an open wait; Answer already pressed so the sheet is
  //   showing; the test's own page session logged in.
  //   Test: page.request.post(`/api/controller/waits/${waitId}/answer`, ...)
  //   — the route, not the sheet's own submit button.
  //   Observable result: the POST answers ok; band-needs-you becomes
  //   visible again with no click inside the sheet; now-answer-sheet's
  //   count drops to 0.
  //   Expected-value source: design C10's "any cause" re-derivation: the
  //   next `controller-waits` push (triggered by the route's own answer,
  //   not this page's click) drops the wait from `needsYou`, so
  //   `openWaitId` no longer matches regardless of who answered it.
  test('(R4 AC5) a wait answered through the route while the sheet is open returns it too', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const waitId = 'e2e-board-external-answer-wait';
    const notesDir = join(tmpdir(), `specwf-e2e-board-notes-${waitId}`);
    const wait: WaitRecord & { specDir: string } = { ...baseWait(waitId, 'e2e-board-external-proj', 'e2e-board-external-spec', 5 * 60_000), specDir: notesDir };
    await writeWaitRecord(wait);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`wait-tile-${waitId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Answer', exact: true }).click();
      await expect(page.getByTestId('now-answer-sheet')).toBeVisible({ timeout: 15000 });

      await login(page);
      const res = await page.request.post(`/api/controller/waits/${waitId}/answer`, {
        data: { answers: {}, by: 'e2e-test' },
      });
      expect(res.ok()).toBe(true);

      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('now-answer-sheet')).toHaveCount(0);
    } finally {
      await removeWaitRecord(waitId);
      await rm(notesDir, { recursive: true, force: true });
    }
  });

  // Criterion "light and dark both render the tile" (task 11 Success;
  // Requirement 11 AC 4 "light and dark SHALL both work").
  //   Pre-condition: one open wait; two fresh browser contexts, one seeded
  //   with `localStorage.theme = 'light'`, one with `'dark'`.
  //   Test: page.goto('/'), then the wait's tile, once per context.
  //   Observable result: the wait's tile is visible in both the light and
  //   the dark context.
  //   Expected-value source: Requirement 11 AC 4 names both themes as a
  //   pass/fail condition directly; no computed value, just visibility.
  test('(R11 AC4) light and dark both render the wait tile', async ({ browser }) => {
    const wait = baseWait('e2e-board-theme-wait', 'e2e-board-theme-proj', 'e2e-board-theme-spec', 5 * 60_000);
    await writeWaitRecord(wait);
    try {
      for (const theme of ['light', 'dark'] as const) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('/');
        await expect(page.getByTestId(`wait-tile-${wait.id}`)).toBeVisible({ timeout: 15000 });
        await context.close();
      }
    } finally {
      await removeWaitRecord(wait.id);
    }
  });
});
