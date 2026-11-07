import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { execFileSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { sddHome } from '../src/dashboard/harness/state-files.js';
import { secretPath } from '../src/controller/access.js';
import { advisorActionsDir } from '../src/advisor/home.js';
import type { RunRecord, WaitRecord, PrRead } from '../src/controller/state.js';
import type { StagedAction } from '../src/advisor/actions.js';
import type { DeployRecord } from '../src/controller/deploy.js';

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

/** Where `actionPath` (`src/advisor/actions.ts:76-78`) puts a staged action record. */
function actionRecordPath(id: string): string {
  return join(advisorActionsDir(), `${id}.json`);
}

function baseAction(id: string, overrides: Partial<StagedAction> = {}): StagedAction {
  return {
    v: 1,
    id,
    kind: 'backlog',
    target: { project: 'e2e-board-action-proj', spec: 'e2e-board-action-spec' },
    params: {},
    reason: 'Add this to the backlog.',
    conversation: 'e2e-board-action-conversation',
    created: isoAgo(5 * 60_000),
    state: 'staged',
    ...overrides,
  };
}

async function writeActionRecord(action: StagedAction): Promise<void> {
  await mkdir(advisorActionsDir(), { recursive: true });
  await writeFile(actionRecordPath(action.id), JSON.stringify(action, null, 2) + '\n', 'utf-8');
}

async function removeActionRecord(id: string): Promise<void> {
  await rm(actionRecordPath(id), { force: true });
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

/**
 * A throwaway local git repository with no remote and a real branch at
 * HEAD's one commit, for task 14's stopped-run tiles: `toRow`'s branch read
 * (`branchPresent`, design C2) runs `git rev-parse --verify refs/heads/<branch>`
 * against `codeRoot` for any `done`/`abandoned`/`error` run
 * (`src/controller/branch-presence.ts`), and a real two-press Discard runs
 * `git branch -D <branch>` there too (`src/controller/runs.ts:1416-1425`). A
 * bogus `codeRoot` makes that read fail (caught, reported `false`), and R7
 * AC6 shows no tile at all for a stopped run with no branch — the task's own
 * Note.
 */
async function makeGitRepo(branch: string): Promise<string> {
  const dir = join(tmpdir(), `specwf-e2e-board-repo-${randomBytes(4).toString('hex')}`);
  await mkdir(dir, { recursive: true });
  const git = (args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git(['init', '-q']);
  git(['config', 'user.email', 'e2e-board@example.com']);
  git(['config', 'user.name', 'e2e-board']);
  await writeFile(join(dir, 'README.md'), 'e2e-board fixture\n', 'utf-8');
  git(['add', '.']);
  git(['commit', '-q', '-m', 'init']);
  git(['branch', branch]);
  return dir;
}

/** Whether `branch` still exists as a local ref in the repo at `dir`. */
function branchExistsInRepo(dir: string, branch: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: dir, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function removeGitRepo(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/**
 * Task 15's Next-tile fixtures. `writeDecomposition` and `writeActiveSpec`
 * write the same `.spec-workflow` shapes `run-setup.test.ts`'s
 * `writeDecomposition`/`createSpec` helpers build for the unit suite, read
 * here through the real `GET /harness/setup` route (`buildSetupView`,
 * `nextUnstartedSpec` and `decompositionPosition`,
 * `src/dashboard/harness/run-setup.ts:150-259`).
 */
async function writeDecomposition(workflowRoot: string, content: string): Promise<void> {
  const dir = join(workflowRoot, 'spec-decomposition');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'decomposition.md'), content, 'utf-8');
}

/** A real, started, incomplete spec directory outside decomposition.md:
 *  `deriveRouting` (`src/core/spec-routing-deriver.ts`) buckets a spec not
 *  named in decomposition.md as `other`, and only a *started* `other` spec
 *  (`taskProgress.completed + .inProgress > 0`) reads `routing.state` as
 *  `active` with itself as `routing.spec` — an unstarted one instead leaves
 *  routing `ambiguous` and falls back to `nextUnstartedSpec`'s decomposition
 *  pick. `- [-] 1. a` (in progress) is what counts as started; `- [ ] 1. a`
 *  does not. */
async function writeActiveSpec(workflowRoot: string, name: string): Promise<void> {
  const dir = join(workflowRoot, 'specs', name);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'requirements.md'), '# R\n', 'utf-8');
  await writeFile(join(dir, 'design.md'), '# D\n', 'utf-8');
  await writeFile(join(dir, 'tasks.md'), '- [-] 1. a\n', 'utf-8');
}

/** Ensures `workflowRoot/specs` exists, then lets `setup` write whatever
 *  decomposition/specs fixture a Next-tile test needs. */
async function prepareWorkflowRoot(
  workflowRoot: string,
  setup: (workflowRoot: string) => Promise<void>,
): Promise<void> {
  await mkdir(join(workflowRoot, 'specs'), { recursive: true });
  await setup(workflowRoot);
}

/** Registers `dir` against the dashboard API directly (no browser), as
 *  `registerGateLedgerProject` does, optionally on an explicit store
 *  (`workflowRootPath`, design C10/D11; `stores.ts:25-43` groups listed
 *  projects by it). */
async function registerProjectAt(page: Page, dir: string, workflowRootPath?: string): Promise<string> {
  await mkdir(dir, { recursive: true });
  await login(page);
  const data: { projectPath: string; workflowRootPath?: string } = { projectPath: dir };
  if (workflowRootPath) data.workflowRootPath = workflowRootPath;
  const res = await page.request.post('/api/projects/add', { data });
  if (!res.ok()) throw new Error(`project registration failed (${res.status()})`);
  const body = (await res.json()) as { projectId: string };
  return body.projectId;
}

/** Registers a solo project at its own `.spec-workflow`, after `setup` has
 *  written the decomposition/specs fixture a Next-tile test needs. Always
 *  passes `dir` as the explicit `workflowRootPath` (not the no-override
 *  branch): an operator session's `SPEC_WORKFLOW_SHARED_ROOT`
 *  (`git-utils.ts:218-221`) would otherwise make every such registration's
 *  `resolveGitRoot` return that shared root instead of `dir`, reading this
 *  real repository's own `.spec-workflow` in place of the fixture. */
async function registerNextProject(
  page: Page,
  dirHint: string,
  setup: (workflowRoot: string) => Promise<void>,
): Promise<{ projectId: string; dir: string; workflowRoot: string }> {
  const dir = join(tmpdir(), `specwf-e2e-board-next-${dirHint}-${randomBytes(4).toString('hex')}`);
  const workflowRoot = join(dir, '.spec-workflow');
  await prepareWorkflowRoot(workflowRoot, setup);
  const projectId = await registerProjectAt(page, dir, dir);
  return { projectId, dir, workflowRoot };
}

/**
 * Two listed projects on one store (design C10 "two listed projects share a
 * store", D11): a shared `workflowRoot` directory IS the representative's
 * own `projectPath` (so `stores.ts`'s `pickRepresentative` "own" match picks
 * it over the name-sort fallback, deterministically), and a second project
 * is registered at a different directory with the same explicit
 * `workflowRootPath`. Both read the one decomposition `heading` names, since
 * the server's `project.projectPath` for an explicit-store registration is
 * the store itself (`project-manager.ts:23`, `:341-345`).
 */
async function registerSharedStoreProjects(
  page: Page,
  heading: string,
): Promise<{ repId: string; memberId: string; sharedDir: string; memberDir: string }> {
  const sharedDir = join(tmpdir(), `specwf-e2e-board-next-shared-${randomBytes(4).toString('hex')}`);
  const memberDir = join(tmpdir(), `specwf-e2e-board-next-member-${randomBytes(4).toString('hex')}`);
  await mkdir(sharedDir, { recursive: true });
  await mkdir(memberDir, { recursive: true });
  await prepareWorkflowRoot(join(sharedDir, '.spec-workflow'), async (wr) => writeDecomposition(wr, heading));
  const repId = await registerProjectAt(page, sharedDir, sharedDir);
  const memberId = await registerProjectAt(page, memberDir, sharedDir);
  return { repId, memberId, sharedDir, memberDir };
}

test.describe('Home (board)', () => {
  test.setTimeout(60000);

  test.beforeAll(async () => {
    await mkdir(sddHome(), { recursive: true });
    // `sddHome()` is a fixed, shared temp path across invocations of this
    // config (`playwright.worktree.config.ts`), so an orphaned wait a past
    // run's `openCrashWait` left behind — created before this file's
    // `baseRun()` moved off `status: 'merging'` — survives on disk and leaks
    // into every later run's tile-count assertions as an extra tile with no
    // test-known id. Start every run from an empty `waits`/`runs` so a past
    // invocation's debris can never bleed into this one's.
    await rm(join(sddHome(), 'waits'), { recursive: true, force: true });
    await rm(join(sddHome(), 'runs'), { recursive: true, force: true });
    await rm(advisorActionsDir(), { recursive: true, force: true });
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

  // Criterion "A `staged` action shows kind, target, reason, age, Confirm and
  // Dismiss" (task 12 Success; Requirement 5 AC 1 "Needs you SHALL show a
  // tile with its kind, target, reason, age and, while `staged`, Confirm and
  // Dismiss"). Also covers the neutral half of D12's tone rule (the
  // warning/danger half is the dedicated tone test below), the same split
  // task 11 used for the wait tile.
  //   Pre-condition: a `staged` action with kind `backlog`, a target naming a
  //   project, spec and PR, created 5 minutes ago.
  //   Test: page.goto('/'), then page.getByTestId('action-tile-' + id).
  //   Observable result: the tile is visible, `data-tone` is `neutral`, and
  //   its text contains "Backlog", the project id, the spec id, "#11", the
  //   reason text and an age like "5m"; a "Confirm" and a "Dismiss" button
  //   are both visible.
  //   Expected-value source: design C10 "ActionTile shows the kind, the
  //   target line of `actionTarget` ..., reason, age and, while `staged`,
  //   Confirm and Dismiss"; `actionTarget` (`NowPage.tsx:98-102`) joins
  //   `project`, `spec` and `#<pr>`; `STAGED_KIND_LABELS.backlog` is
  //   "Backlog" (`NowPage.tsx:22-25`); design C9 `ageTone` is `neutral`
  //   under 900,000 ms.
  test('(R5 AC1) a staged action shows kind, target, reason, age, Confirm and Dismiss', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const actionId = 'e2e-board-action-fields-action';
    const project = 'e2e-board-action-fields-proj';
    const spec = 'e2e-board-action-fields-spec';
    const action = baseAction(actionId, {
      kind: 'backlog',
      target: { project, spec, pr: 11 },
      reason: 'Needs a backlog entry for this.',
    });
    await writeActionRecord(action);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`action-tile-${actionId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toHaveAttribute('data-tone', 'neutral');
      await expect(tile).toContainText('Backlog');
      await expect(tile).toContainText(project);
      await expect(tile).toContainText(spec);
      await expect(tile).toContainText('#11');
      await expect(tile).toContainText('Needs a backlog entry for this.');
      await expect(tile).toContainText(/\b\d+m\b/);
      await expect(tile.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
      await expect(tile.getByRole('button', { name: 'Dismiss', exact: true })).toBeVisible();
    } finally {
      await removeActionRecord(actionId);
    }
  });

  // Criterion "a `running` one shows no Confirm or Dismiss" (task 12
  // Success; Requirement 5 AC 1 "... and, while `staged`, Confirm and
  // Dismiss" — the tile still shows for `running`, per AC 1's first clause,
  // but only `staged` gets the two buttons).
  //   Pre-condition: an action seeded directly in state `running` (never
  //   pressed in this browser session).
  //   Test: page.goto('/'), then the action's tile.
  //   Observable result: the tile is visible and contains the kind and
  //   reason text; a "Confirm" and a "Dismiss" button both have count 0.
  //   Expected-value source: Requirement 5 AC 1's "while `staged`" qualifier
  //   on the two buttons, and design C10's field list for the rest of the
  //   tile, which does not depend on state.
  test('(R5 AC1) a running action shows a tile with no Confirm or Dismiss', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const actionId = 'e2e-board-action-running-action';
    const action = baseAction(actionId, { kind: 'merge', reason: 'Merging now.', state: 'running' });
    await writeActionRecord(action);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`action-tile-${actionId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('Merge');
      await expect(tile).toContainText('Merging now.');
      await expect(tile.getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0);
      await expect(tile.getByRole('button', { name: 'Dismiss', exact: true })).toHaveCount(0);
    } finally {
      await removeActionRecord(actionId);
    }
  });

  // Criterion "a `done`, `refused`, `failed` or `dismissed` one left alone
  // has no tile" (task 12 Success; Requirement 5 AC 2) is RED-IMPOSSIBLE at
  // the red commit: `needsYou` already excludes all four terminal states
  // today (task 8, already shipped), proven branch by branch in
  // `src/dashboard/shell/__tests__/board-view.test.ts`'s
  // `it.each(['done', 'refused', 'failed', 'dismissed'])('drops an action in
  // state %s', ...)`. The `done` and `dismissed` halves are now covered
  // incidentally by the terminal-state e2e tests below, which press an
  // action to one of those states and assert its tile count drops to 0. The
  // `refused` and `failed` halves have no fresh negative test (review
  // finding, retro P10): nothing seeds a left-alone `refused` or `failed`
  // action and asserts no tile, so task 12's `ActionTile`/`HomePage` wiring
  // for those two states is e2e-unproven. This closes that gap, mirroring
  // the running-action test above.
  //   Pre-condition: an action seeded directly in state `refused` and one
  //   seeded directly in state `failed` (neither ever pressed in this
  //   browser session).
  //   Test: page.goto('/'), wait for the needs-you band, then each action's
  //   tile.
  //   Observable result: both tiles have count 0.
  //   Expected-value source: Requirement 5 AC 2 "a `done`, `refused`,
  //   `failed` or `dismissed` one left alone has no tile"; design C9
  //   `needsYou` drops all four terminal states.
  test('(R5 AC2) a refused or failed action left alone has no tile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const refusedId = 'e2e-board-action-refused-action';
    const failedId = 'e2e-board-action-failed-action';
    await writeActionRecord(baseAction(refusedId, { state: 'refused' }));
    await writeActionRecord(baseAction(failedId, { state: 'failed' }));
    try {
      await page.goto('/');
      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      // Give the controller-actions WS snapshot time to land before asserting absence.
      await page.waitForTimeout(3000);
      await expect(page.getByTestId(`action-tile-${refusedId}`)).toHaveCount(0);
      await expect(page.getByTestId(`action-tile-${failedId}`)).toHaveCount(0);
    } finally {
      await removeActionRecord(refusedId);
      await removeActionRecord(failedId);
    }
  });

  // Criterion "the age colours the tile by the wait rule (D12)" (task 12
  // Success; design D12 "Staged actions take the wait age colours and order,
  // as Needs-you tiles"). The neutral case is covered by the fields test
  // above, matching the split task 11 used for `WaitTile`'s tone criterion.
  //   Pre-condition: two staged actions on the same target, one created 20
  //   minutes ago, one 2 hours ago.
  //   Test: page.goto('/'), then each action's tile's `data-tone` attribute.
  //   Observable result: the 20-minute tile's `data-tone` is `warning`; the
  //   2-hour tile's is `danger`.
  //   Expected-value source: design C9 `ageTone(ms)`: `warning` from
  //   900,000 ms, `danger` from 3,600,000 ms, the same function `WaitTile`
  //   uses (D12 ties action tone to the wait rule).
  test('(D12) an action tile is warning at 20 minutes and danger at 2 hours old', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const warnId = 'e2e-board-action-tone-warn';
    const dangerId = 'e2e-board-action-tone-danger';
    await writeActionRecord(baseAction(warnId, { created: isoAgo(20 * 60_000) }));
    await writeActionRecord(baseAction(dangerId, { created: isoAgo(2 * 3_600_000) }));
    try {
      await page.goto('/');
      await expect(page.getByTestId(`action-tile-${warnId}`)).toHaveAttribute('data-tone', 'warning', { timeout: 15000 });
      await expect(page.getByTestId(`action-tile-${dangerId}`)).toHaveAttribute('data-tone', 'danger');
    } finally {
      await removeActionRecord(warnId);
      await removeActionRecord(dangerId);
    }
  });

  // Criterion "an action with no project shows no tag and stays with every
  // project off" (task 12 Success; Requirement 5 AC 3 "WHEN an action's
  // target names no project THEN the tile SHALL show with no project tag
  // and SHALL ignore the project filter").
  //   Pre-condition: a staged action whose `target` carries no `project`
  //   field (only `spec` and `pr`); `localStorage.shell.projects` (the
  //   off-list) set to `['']` before the page loads, so a bug that treats a
  //   missing project as the empty string would hide the tile.
  //   Test: page.goto('/'), then the action's tile.
  //   Observable result: the tile is visible despite the off-list entry,
  //   and contains the kind and target fields it does have (spec, "#9") with
  //   no literal "undefined" or "null" text (the regression a missing
  //   project-tag render would produce).
  //   Expected-value source: design C9 `needsYou`'s `passesProjectFilter`:
  //   `targetProject(action)` returns `null` when `target.project` is not a
  //   string, which short-circuits the filter regardless of `enabled`;
  //   design C10 "The project tag shows only when `target.project` is a
  //   string."
  test('(R5 AC3) an action with no project shows no tag and ignores the project filter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const actionId = 'e2e-board-action-noproject-action';
    const spec = 'e2e-board-action-noproject-spec';
    const action = baseAction(actionId, {
      kind: 'decomposition',
      target: { spec, pr: 9 },
      reason: 'No project on this one.',
    });
    await writeActionRecord(action);
    try {
      await page.addInitScript(() => {
        window.localStorage.setItem('shell.projects', JSON.stringify(['']));
      });
      await page.goto('/');
      const tile = page.getByTestId(`action-tile-${actionId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('Decomposition');
      await expect(tile).toContainText(spec);
      await expect(tile).toContainText('#9');
      const text = (await tile.textContent()) ?? '';
      expect(text).not.toMatch(/\bundefined\b|\bnull\b|\[object/i);
    } finally {
      await removeActionRecord(actionId);
    }
  });

  // Criterion "pressing Confirm shows pressed, then running, with the
  // control disabled" (task 12 Success; Requirement 9 AC 1 "its tile SHALL
  // show the stages pressed, running, done, or failed ..., and the pressed
  // control SHALL be disabled until the stage ends"). Confirm is stubbed
  // with `page.route`, per the task's Note, because the real route runs the
  // executor (D52); a controllable gate lets the test observe `pressed`
  // (before the stubbed response lands) separately from `running` (after).
  //   Pre-condition: a staged action; `page.route` intercepts its confirm
  //   POST and withholds the response until the test releases a gate.
  //   Test: tile.getByRole('button', { name: 'Confirm' }).click(), observed
  //   before and after releasing the gate.
  //   Observable result: right after the click (gate still held) the tile's
  //   text contains "pressed" and the Confirm button is disabled; after the
  //   gate releases and the stub answers 200, the tile's text contains
  //   "running" and the Confirm button is still disabled.
  //   Expected-value source: design C11's `Stage.phase` literals `pressed`
  //   and `running`, which Requirement 9 AC 1 names verbatim; `useStages`'s
  //   `press` "Sets pressed, disabling the tile's stage controls... Any
  //   other 2xx gives running" (design C11 post-conditions); design D37
  //   disables every stage control until the stage ends.
  test('(R9 AC1) pressing Confirm shows pressed then running, with the control disabled throughout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const actionId = 'e2e-board-action-press-action';
    const action = baseAction(actionId, { kind: 'merge', reason: 'Press me.' });
    await writeActionRecord(action);
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => { releaseGate = resolve; });
    try {
      await page.route('**/api/controller/actions/*/confirm', async (route) => {
        await gate;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      });
      await page.goto('/');
      const tile = page.getByTestId(`action-tile-${actionId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      const confirmButton = tile.getByRole('button', { name: 'Confirm', exact: true });

      await confirmButton.click();
      await expect(tile).toContainText(/pressed/i, { timeout: 5000 });
      await expect(confirmButton).toBeDisabled();

      releaseGate();
      await expect(tile).toContainText(/running/i, { timeout: 5000 });
      await expect(confirmButton).toBeDisabled();
    } finally {
      await removeActionRecord(actionId);
    }
  });

  // Criteria "a 500 with a `reason` shows that reason, one with only
  // `error` shows the error, one with neither shows the status code" (task
  // 12 Success; Requirement 9 AC 2 "the failed stage SHALL show the body's
  // `reason`, else its `error`, else the status code"). `failReason` itself
  // is already unit-tested (task 10, `board-view.test.ts`); this folds the
  // three wiring cases — that `ActionTile`/`StageLine` actually render
  // whichever field `failReason` picked — into one test over three seeded
  // actions, rather than three near-identical browser tests that only differ
  // in the stubbed response body.
  //   Pre-condition: three staged actions; `page.route` answers each one's
  //   confirm POST with status 500 and a body keyed by which action is
  //   pressed: `{ reason: 'blocked by policy' }`, `{ error: 'boom' }`, `{}`.
  //   Test: each action's Confirm button pressed in turn.
  //   Observable result: the first tile's text contains "blocked by
  //   policy"; the second's contains "boom"; the third's contains "500".
  //   Expected-value source: design C11 `failReason(status, body)`: the
  //   body's `reason`, else its `error`, else the status code as text; the
  //   seeded bodies and status pin each expected value directly.
  test('(R9 AC2) a failed confirm shows the body reason, else the error, else the status code', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const reasonId = 'e2e-board-action-reason-action';
    const errorId = 'e2e-board-action-error-action';
    const codeId = 'e2e-board-action-code-action';
    await writeActionRecord(baseAction(reasonId, { kind: 'merge', reason: 'Has a reason body.' }));
    await writeActionRecord(baseAction(errorId, { kind: 'merge', reason: 'Has an error-only body.' }));
    await writeActionRecord(baseAction(codeId, { kind: 'merge', reason: 'Has neither field.' }));
    try {
      await page.route('**/api/controller/actions/*/confirm', async (route) => {
        const url = route.request().url();
        if (url.includes(reasonId)) {
          await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ reason: 'blocked by policy' }) });
        } else if (url.includes(errorId)) {
          await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
        } else {
          await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({}) });
        }
      });
      await page.goto('/');

      const reasonTile = page.getByTestId(`action-tile-${reasonId}`);
      await expect(reasonTile).toBeVisible({ timeout: 15000 });
      await reasonTile.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect(reasonTile).toContainText('blocked by policy', { timeout: 5000 });

      const errorTile = page.getByTestId(`action-tile-${errorId}`);
      await errorTile.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect(errorTile).toContainText('boom', { timeout: 5000 });

      const codeTile = page.getByTestId(`action-tile-${codeId}`);
      await codeTile.getByRole('button', { name: 'Confirm', exact: true }).click();
      await expect(codeTile).toContainText('500', { timeout: 5000 });
    } finally {
      await removeActionRecord(reasonId);
      await removeActionRecord(errorId);
      await removeActionRecord(codeId);
    }
  });

  // Criterion "a 200 with `ok: false` shows failed and the tile stays until
  // reload (D35)" (task 12 Success; design D34 "A 2xx with ok false ...
  // reads as failed"; D35 "A failed action tile stays until reload").
  //   Pre-condition: a staged action; `page.route` answers its confirm POST
  //   with 200 and `{ ok: false, error: 'executor refused' }` — the shape
  //   `confirmAction` itself returns when its executor fails
  //   (`src/advisor/actions.ts:459-464`).
  //   Test: press Confirm, wait past the 5-second `done`-clear window,
  //   then `page.reload()`.
  //   Observable result: right after the press the tile shows "failed" and
  //   "executor refused", and the Confirm button re-enables (D37: disabled
  //   only until the stage ends); six seconds later the failed text is
  //   still showing (no auto-clear, unlike `done`); after reload the tile
  //   is visible again with Confirm and Dismiss and no "executor refused"
  //   text, because the underlying record was never actually mutated (the
  //   confirm was stubbed) and reload drops the local stage state.
  //   Expected-value source: design C11 `responseStage`: "a 2xx whose body
  //   has `ok === false` gives `failed` with the body's `error`"; D20/D35's
  //   failed-stays-until-next-press-or-reload rule; design C11 "Leaving Home
  //   drops stage state, as a reload does."
  test('(R9 AC2, D35) a 200 with ok false shows failed and the tile stays failed until reload', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const actionId = 'e2e-board-action-okfalse-action';
    const action = baseAction(actionId, { kind: 'merge', reason: 'Executor will refuse.' });
    await writeActionRecord(action);
    try {
      await page.route('**/api/controller/actions/*/confirm', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'executor refused' }) });
      });
      await page.goto('/');
      const tile = page.getByTestId(`action-tile-${actionId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      const confirmButton = tile.getByRole('button', { name: 'Confirm', exact: true });

      await confirmButton.click();
      await expect(tile).toContainText(/failed/i, { timeout: 5000 });
      await expect(tile).toContainText('executor refused');
      await expect(confirmButton).toBeEnabled();

      await page.waitForTimeout(6000);
      await expect(tile).toBeVisible();
      await expect(tile).toContainText('executor refused');

      await page.reload();
      const reloadedTile = page.getByTestId(`action-tile-${actionId}`);
      await expect(reloadedTile).toBeVisible({ timeout: 15000 });
      await expect(reloadedTile).not.toContainText('executor refused');
      await expect(reloadedTile.getByRole('button', { name: 'Confirm', exact: true })).toBeVisible();
      await expect(reloadedTile.getByRole('button', { name: 'Dismiss', exact: true })).toBeVisible();
    } finally {
      await removeActionRecord(actionId);
    }
  });

  // Criterion "a seeded `done` action moves the stage to done and it clears
  // after 5 s; the tile stays until then (requirement 5 AC 2)" (task 12
  // Success; Requirement 5 AC 2 "except a tile pressed in this view stays
  // until R9 has shown the outcome"; Requirement 9 AC 3 "the stage SHALL
  // read running until ... then done, then clear after 5 s"). Confirm is a
  // real, unstubbed press: the target is an `answer` action on a seeded
  // wait with no questions, so `confirmAction`'s real executor
  // (`execAnswer`) resolves it to `done` almost at once and emits the
  // `actionEvents` change the hub needs to push within the throttle window
  // (design C11; `src/advisor/actions.ts:170-177`), rather than relying on
  // a raw file rewrite reaching the feed only on its slow poll.
  //   Pre-condition: an open wait with no questions; a staged `answer`
  //   action targeting that wait.
  //   Test: tile.getByRole('button', { name: 'Confirm' }).click(), then the
  //   tile's content and presence over time.
  //   Observable result: the tile's text eventually contains "done"; the
  //   tile is still visible at that point; within the next 10 seconds the
  //   tile's count drops to 0.
  //   Expected-value source: design C11 `advance`: a resolved `running`
  //   stage becomes `done`; "A `done` stage older than 5,000 ms gives
  //   `null`"; "Retained tiles: ... stays rendered from that snapshot ...
  //   while its stage is `pressed`, `running` or `done`" — once the stage
  //   clears and the real action is `done` (no longer `staged`/`running`),
  //   `needsYou` no longer has a reason to render it.
  test('(R5 AC2, R9 AC3) a confirmed action moves its stage to done then clears after 5s, the tile staying until then', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const waitId = 'e2e-board-action-done-wait';
    const actionId = 'e2e-board-action-done-action';
    // `execAnswer`'s real `answerWait` appends a note under `record.specDir`
    // (src/controller/waits.ts:135, :310) for any non-`retro-plan` kind, the
    // same real mutation `(R4 AC5) answering in the sheet` seeds a `specDir`
    // for; a bare `baseWait` here would crash that write on an undefined path.
    const notesDir = join(tmpdir(), `specwf-e2e-board-notes-${waitId}`);
    const wait: WaitRecord & { specDir: string } = {
      ...baseWait(waitId, 'e2e-board-action-done-proj', 'e2e-board-action-done-spec', 5 * 60_000),
      specDir: notesDir,
    };
    const action = baseAction(actionId, {
      kind: 'answer',
      target: { wait: waitId },
      reason: 'Answer this wait with no questions.',
    });
    await writeWaitRecord(wait);
    await writeActionRecord(action);
    try {
      await login(page);
      await page.goto('/');
      const tile = page.getByTestId(`action-tile-${actionId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Confirm', exact: true }).click();

      await expect(tile).toContainText(/done/i, { timeout: 15000 });
      await expect(tile).toBeVisible();

      await expect(page.getByTestId(`action-tile-${actionId}`)).toHaveCount(0, { timeout: 10000 });
    } finally {
      await removeWaitRecord(waitId);
      await removeActionRecord(actionId);
      await rm(notesDir, { recursive: true, force: true });
    }
  });

  // Criterion "Dismiss on a real route ends with no tile" (task 12 Success;
  // the task's Note: "a real Dismiss on a second seeded action forces one
  // [flush]"). Unlike Confirm, Dismiss never runs an executor
  // (`src/dashboard/multi-server.ts:796-812`), so pressing it for real has
  // no side effect beyond the action record itself.
  //   Pre-condition: a staged action.
  //   Test: tile.getByRole('button', { name: 'Dismiss' }).click(), through
  //   the real route (no `page.route` stub).
  //   Observable result: the action's tile count eventually drops to 0.
  //   Expected-value source: design C11 `resolved`'s `dismiss` row:
  //   resolved when `actionState === 'dismissed'`; `advance` then moves
  //   `running` to `done`, which clears after 5 s per the same rule R9 AC 3
  //   states; the real `dismiss` route sets exactly that state
  //   (`src/advisor/actions.ts` `dismissAction`).
  test('(R5 AC2, R9) Dismiss through the real route ends with no tile', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const actionId = 'e2e-board-action-dismiss-action';
    const action = baseAction(actionId, { kind: 'backlog', reason: 'Dismiss me for real.' });
    await writeActionRecord(action);
    try {
      await login(page);
      await page.goto('/');
      const tile = page.getByTestId(`action-tile-${actionId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Dismiss', exact: true }).click();
      await expect(page.getByTestId(`action-tile-${actionId}`)).toHaveCount(0, { timeout: 15000 });
    } finally {
      await removeActionRecord(actionId);
    }
  });

  // --- RunTile read side (task 13; design C9, C10, D22, D23, D38) ----------
  //
  // The Running band is `[]` at base (`HomePage.tsx`'s hardcoded empty
  // array): no `[data-testid^="run-tile-"]` element can exist yet, so every
  // test below is red until the band is wired to `board.ts`'s `running()`
  // and a `RunTile` exists in `tiles.tsx`. None presses a control — task 13's
  // Restriction defers press wiring to task 14.
  //
  // The dot is read by CSS class, not a dedicated test id: design C10 pins
  // the exact classes verbatim ("The dot maps green, amber and grey to the
  // classes of Sidebar.tsx:37-41 ... red takes bg-(--tone-danger-fg)"), and
  // `Sidebar.tsx`'s own `DOT_COLOUR` map (`bg-(--tone-success-fg)` for
  // green, `bg-(--tone-warning-fg)` for amber/waiting, `bg-(--tone-neutral-fg)`
  // for grey/idle) gives the other three. None of these `bg-(--tone-*-fg)`
  // strings appears elsewhere in a tile (the `Tile` frame's tone border uses
  // `border-(--tone-*-fg)`; `pauseNoteClass` uses `text-(--tone-*-fg)`), so a
  // class-substring locator identifies the dot unambiguously.
  //
  // A `queued` or `merging` run record, unlike every other status fixture in
  // this file, is one the real Controller's live, undisabled 1-second
  // scheduler tick (`SDD_DEPLOY_DISABLED` only disables the deploy
  // coordinator) would otherwise drive at once (`isStartable`). The queued
  // fixture below sets `pauseRequested`, which `isStartable` checks before
  // the status at all, to hold it still for the test to read — the same
  // dodge this file's own `baseRun()` comment uses by picking `running`
  // over `merging` for its own fixture. The merging fixture below instead
  // gives `resumeAt` a future timestamp, which `isStartable`'s `merging`
  // branch already treats as not yet due.

  // Criterion "A run with `inFlight`, `startedAt`, `task` and a recent
  // `lastActivity` shows step kind, task, step age, `last activity`, and a
  // green dot" (task 13 Success; Requirement 6 AC 1 "the tile SHALL show
  // the spec, project tag, step kind, the task when there is one, the step
  // age while a step is in flight ..."; Requirement 6 AC 2 "the tile SHALL
  // show 'last activity N ago' and a dot ... under 5 minutes green").
  //   Pre-condition: a `waiting` run (moving; never stalled with no
  //   drive-crash wait; never auto-driven) with `cursor.stepKind`, an
  //   `inFlight.startedAt` 4 minutes ago, `inFlight.task`, and
  //   `lastActivity` 1 minute ago.
  //   Test: page.goto('/'), then page.getByTestId('run-tile-' + id).
  //   Observable result: the tile's text contains the step kind, the task
  //   label, "4m" (the step age) and the literal "last activity 1m ago";
  //   exactly one descendant carries a class containing
  //   `bg-(--tone-success-fg)` (the green dot).
  //   Expected-value source: Requirement 6 AC 1's field list; Requirement 6
  //   AC 2's literal "last activity N ago" phrase and "under 5 minutes
  //   green"; design C9 `runDot`'s thresholds and Sidebar.tsx's green class.
  test('(R6 AC1, AC2) a run tile shows step kind, task, step age, last activity, and a green dot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-green-run';
    const run = baseRun(runId, 'e2e-board-run-green-proj', {
      status: 'waiting',
      spec: 'e2e-board-run-green-spec',
      cursor: { phase: 'implementation', stepKind: 'implementer', attempt: 1 },
      inFlight: { id: 'step-green', pid: 999991, startTime: 0, startedAt: isoAgo(4 * 60_000), task: 'alpha-task' },
      lastActivity: isoAgo(60_000),
    });
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('implementer');
      await expect(tile).toContainText('alpha-task');
      await expect(tile).toContainText('4m');
      await expect(tile).toContainText('last activity 1m ago');
      await expect(tile.locator('[class*="bg-(--tone-success-fg)"]')).toHaveCount(1);
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criteria "an activity 10 minutes old shows amber" and "20 minutes old
  // shows red" (task 13 Success; Requirement 6 AC 2 "from 5 to under 15
  // minutes amber; at 15 minutes and after red"), folded into one test the
  // same way the wait tile's tone test bundled its two ages.
  //   Pre-condition: two `waiting` runs, one with `lastActivity` 10 minutes
  //   old, one 20 minutes old.
  //   Test: page.goto('/'), then each run's tile.
  //   Observable result: the 10-minute tile has exactly one descendant
  //   whose class contains `bg-(--tone-warning-fg)`; the 20-minute tile has
  //   exactly one whose class contains `bg-(--tone-danger-fg)`.
  //   Expected-value source: design C9 `runDot`: amber at 300,000 ms, red
  //   at 900,000 ms; Sidebar.tsx's amber class, design C10's red class.
  test('(R6 AC2) activity 10 minutes old shows amber, 20 minutes old shows red', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const amberId = 'e2e-board-run-amber-run';
    const redId = 'e2e-board-run-red-run';
    const amber = baseRun(amberId, 'e2e-board-run-amber-proj', {
      status: 'waiting', spec: 'e2e-board-run-amber-spec',
      inFlight: { id: 'step-amber', pid: 999992, startTime: 0, startedAt: isoAgo(30 * 60_000) },
      lastActivity: isoAgo(10 * 60_000),
    });
    const red = baseRun(redId, 'e2e-board-run-red-proj', {
      status: 'waiting', spec: 'e2e-board-run-red-spec',
      inFlight: { id: 'step-red', pid: 999993, startTime: 0, startedAt: isoAgo(40 * 60_000) },
      lastActivity: isoAgo(20 * 60_000),
    });
    const amberDir = await writeRunRecord(amber);
    const redDir = await writeRunRecord(red);
    try {
      await page.goto('/');
      const amberTile = page.getByTestId(`run-tile-${amberId}`);
      const redTile = page.getByTestId(`run-tile-${redId}`);
      await expect(amberTile).toBeVisible({ timeout: 15000 });
      await expect(amberTile.locator('[class*="bg-(--tone-warning-fg)"]')).toHaveCount(1);
      await expect(redTile).toBeVisible();
      await expect(redTile.locator('[class*="bg-(--tone-danger-fg)"]')).toHaveCount(1);
    } finally {
      await removeRunRecord(amberDir);
      await removeRunRecord(redDir);
    }
  });

  // Criterion "with no `lastActivity` the age runs from the step's start"
  // (task 13 Success; Requirement 6 AC 2 "The heartbeat age SHALL run from
  // `lastActivity`, else from the step's start").
  //   Pre-condition: a `waiting` run with `inFlight.startedAt` 6 minutes
  //   ago and no `lastActivity` field at all.
  //   Test: page.goto('/'), then the run's tile.
  //   Observable result: the tile's text contains the literal
  //   "last activity 6m ago" (the displayed age itself, not just its
  //   colour, comes from `stepStarted`); exactly one descendant's class
  //   contains `bg-(--tone-warning-fg)` (6 minutes is amber).
  //   Expected-value source: Requirement 6 AC 2's fallback rule verbatim;
  //   design C9 `runDot`'s `lastActivity ?? stepStarted` base.
  test('(R6 AC2) with no lastActivity the heartbeat age runs from the step start', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-fallback-run';
    const run = baseRun(runId, 'e2e-board-run-fallback-proj', {
      status: 'waiting',
      spec: 'e2e-board-run-fallback-spec',
      inFlight: { id: 'step-fallback', pid: 999994, startTime: 0, startedAt: isoAgo(6 * 60_000) },
    });
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('last activity 6m ago');
      await expect(tile.locator('[class*="bg-(--tone-warning-fg)"]')).toHaveCount(1);
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criterion "an `inFlight` with no `startedAt` omits the step age
  // (requirement 12 AC 3)" (task 13 Success; Requirement 12 AC 3 "the row
  // SHALL report no start time and the tile SHALL omit the step age").
  //   Pre-condition: a `waiting` run with an `inFlight` record carrying a
  //   `task` but no `startedAt`, and a recent (2-minute) `lastActivity`.
  //   Test: page.goto('/'), then the run's tile.
  //   Observable result: the tile shows the task and "last activity 2m
  //   ago" with a green dot (so the heartbeat, driven by `lastActivity`
  //   alone, is unaffected); the tile's full text contains no "NaN" (the
  //   value a step-age calculation over the missing `startedAt` would
  //   produce if it were not omitted).
  //   Expected-value source: Requirement 12 AC 3's omission rule; design
  //   Error Handling 7 "the tile omits the step age"; `Date.parse(undefined)`
  //   is `NaN`, so an un-omitted computation leaks visibly.
  test('(R12 AC3) an inFlight with no startedAt omits the step age', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-nostart-run';
    const run = baseRun(runId, 'e2e-board-run-nostart-proj', {
      status: 'waiting',
      spec: 'e2e-board-run-nostart-spec',
      inFlight: { id: 'step-nostart', pid: 999995, startTime: 0, task: 'beta-task' },
      lastActivity: isoAgo(2 * 60_000),
    });
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('beta-task');
      await expect(tile).toContainText('last activity 2m ago');
      await expect(tile.locator('[class*="bg-(--tone-success-fg)"]')).toHaveCount(1);
      const text = (await tile.textContent()) ?? '';
      expect(text).not.toMatch(/NaN/);
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criterion "a run between steps shows a grey dot and no heartbeat line"
  // (task 13 Success; Requirement 6 AC 3 "WHEN no step is in flight THEN
  // the dot SHALL be grey and no heartbeat line SHALL show").
  //   Pre-condition: a `waiting` run with no `inFlight` field at all, but a
  //   recent (2-minute) `lastActivity`, so a bug that read the heartbeat
  //   base before checking `inFlight` would still show green.
  //   Test: page.goto('/'), then the run's tile.
  //   Observable result: exactly one descendant's class contains
  //   `bg-(--tone-neutral-fg)` (grey); the tile's text does not contain
  //   "last activity".
  //   Expected-value source: Requirement 6 AC 3 verbatim; design C9
  //   `runDot`'s `if (!run.inFlight) return 'grey'` guard, checked first.
  test('(R6 AC3) a run between steps shows a grey dot and no heartbeat line', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-betweensteps-run';
    const run = baseRun(runId, 'e2e-board-run-betweensteps-proj', {
      status: 'waiting',
      spec: 'e2e-board-run-betweensteps-spec',
      lastActivity: isoAgo(2 * 60_000),
    });
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile.locator('[class*="bg-(--tone-neutral-fg)"]')).toHaveCount(1);
      await expect(tile).not.toContainText('last activity');
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criteria "`running` with no driver shows red `Stalled` and no dot",
  // "`waiting` with an open `drive-crash` wait shows the same" and "a plain
  // `waiting` run with `driven: false` does not" (task 13 Success;
  // Requirement 6 AC 4 "the tile SHALL show red 'Stalled' and Re-drive in
  // place of the dot ... No other run with `driven: false` SHALL read as
  // stalled"), folded into one test over three run fixtures, the same way
  // task 9's unit test bundled D7's branches.
  //   Pre-condition: a `running` run (never driven by this fixture-only
  //   server, so `driven` reads false); a `waiting` run with an open wait
  //   whose question id is `drive-crash` for its id; a plain `waiting` run
  //   with no such wait.
  //   Test: page.goto('/'), then each run's tile.
  //   Observable result: the `running` and the drive-crash `waiting` tiles
  //   both contain "Stalled" and have no descendant whose class contains
  //   `bg-(--tone-success-fg)`, `bg-(--tone-warning-fg)` or
  //   `bg-(--tone-neutral-fg)` (no ordinary dot); the plain `waiting`
  //   tile's text does not contain "Stalled".
  //   Expected-value source: Requirement 6 AC 4 and design D7 verbatim;
  //   design C9 `isStalled`'s two true branches and its default `false`.
  test('(R6 AC4) running with no driver or a drive-crash wait shows red Stalled with no dot; a plain waiting run does not', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runningId = 'e2e-board-run-stalled-running-run';
    const crashId = 'e2e-board-run-stalled-crash-run';
    const plainId = 'e2e-board-run-stalled-plain-run';
    const runningRun = baseRun(runningId, 'e2e-board-run-stalled-running-proj', {
      status: 'running', spec: 'e2e-board-run-stalled-running-spec',
    });
    const crashRun = baseRun(crashId, 'e2e-board-run-stalled-crash-proj', {
      status: 'waiting', spec: 'e2e-board-run-stalled-crash-spec',
    });
    const plainRun = baseRun(plainId, 'e2e-board-run-stalled-plain-proj', {
      status: 'waiting', spec: 'e2e-board-run-stalled-plain-spec',
    });
    const crashWait = baseWait('e2e-board-run-stalled-crash-wait', crashRun.project, crashRun.spec, 60_000, {
      run: crashId,
      questions: [{ id: 'drive-crash', text: 'step crashed' }],
    });
    const runningDir = await writeRunRecord(runningRun);
    const crashDir = await writeRunRecord(crashRun);
    const plainDir = await writeRunRecord(plainRun);
    await writeWaitRecord(crashWait);
    const noDot = '[class*="bg-(--tone-success-fg)"], [class*="bg-(--tone-warning-fg)"], [class*="bg-(--tone-neutral-fg)"]';
    try {
      await page.goto('/');
      const runningTile = page.getByTestId(`run-tile-${runningId}`);
      const crashTile = page.getByTestId(`run-tile-${crashId}`);
      const plainTile = page.getByTestId(`run-tile-${plainId}`);

      await expect(runningTile).toBeVisible({ timeout: 15000 });
      await expect(runningTile).toContainText('Stalled');
      await expect(runningTile.locator(noDot)).toHaveCount(0);

      await expect(crashTile).toBeVisible();
      await expect(crashTile).toContainText('Stalled');
      await expect(crashTile.locator(noDot)).toHaveCount(0);

      await expect(plainTile).toBeVisible();
      await expect(plainTile).not.toContainText('Stalled');
    } finally {
      await removeRunRecord(runningDir);
      await removeRunRecord(crashDir);
      await removeRunRecord(plainDir);
      await removeWaitRecord(crashWait.id);
    }
  });

  // Criterion "moving runs sort most stale first" (task 13 Success;
  // Requirement 3 AC 7 "Moving runs SHALL sort most stale first, by
  // `lastActivity`, else `updated`, oldest first").
  //   Pre-condition: two `waiting` runs, one with `lastActivity` 20 minutes
  //   old, one 2 minutes old.
  //   Test: page.goto('/'), then the ordered `[data-testid^="run-tile-"]`
  //   list.
  //   Observable result: the DOM order is [20-minute run, 2-minute run].
  //   Expected-value source: design C9 `running`'s `lastActivity`-ascending
  //   sort for moving runs (the earlier timestamp, i.e. more stale, first).
  test('(R3 AC7) moving runs sort most stale first', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const staleId = 'e2e-board-run-sort-stale-run';
    const freshId = 'e2e-board-run-sort-fresh-run';
    const stale = baseRun(staleId, 'e2e-board-run-sort-proj', {
      status: 'waiting', spec: 'e2e-board-run-sort-stale-spec', lastActivity: isoAgo(20 * 60_000),
    });
    const fresh = baseRun(freshId, 'e2e-board-run-sort-proj', {
      status: 'waiting', spec: 'e2e-board-run-sort-fresh-spec', lastActivity: isoAgo(2 * 60_000),
    });
    const staleDir = await writeRunRecord(stale);
    const freshDir = await writeRunRecord(fresh);
    try {
      await page.goto('/');
      await expect(page.getByTestId(`run-tile-${staleId}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`run-tile-${freshId}`)).toBeVisible();
      const ids = await page
        .locator('[data-testid^="run-tile-"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
      expect(ids).toEqual([`run-tile-${staleId}`, `run-tile-${freshId}`]);
    } finally {
      await removeRunRecord(staleDir);
      await removeRunRecord(freshDir);
    }
  });

  // Criterion "a `merging` tile shows the PR line" (task 13 Success; design
  // C10 "A `merging` run adds the run read's PR, CI and verdict").
  //   Pre-condition: a `merging` run with one `prReads` entry of `kind:
  //   'run'`, PR #42, `ci: 'green'`, `verdict: 'waiting'`, and a `resumeAt`
  //   in the future (so the live scheduler's `merging` re-check does not
  //   treat it as due and drive it away mid-test).
  //   Test: page.goto('/'), then the run's tile's text content.
  //   Observable result: the tile's text contains "42", "green" and
  //   "waiting".
  //   Expected-value source: design C10's merging-tile bullet; the PR
  //   number, ci and verdict are the seeded `PrRead`'s own field values,
  //   the same source `WaitTile`'s merge-read tests use.
  test('(design C10, D22) a merging tile shows the PR line', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-merging-run';
    const run = baseRun(runId, 'e2e-board-run-merging-proj', {
      status: 'merging',
      spec: 'e2e-board-run-merging-spec',
      resumeAt: isoAgo(-10 * 60_000),
      prReads: [prRead({ kind: 'run', repo: 'acme/widgets', number: 42, ci: 'green', verdict: 'waiting' })],
    });
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('42');
      await expect(tile).toContainText('green');
      await expect(tile).toContainText('waiting');
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criterion "a `queued` tile shows `queued`" and the grey half of its dot
  // (task 13 Success; design D23 "A queued tile shows 'queued', a grey
  // dot, Pause and Stop").
  //   Pre-condition: a `queued` run with `pauseRequested` set (so the live
  //   scheduler's 1-second tick, which would otherwise drive any on-disk
  //   `queued` run at once, treats it as not startable and leaves it
  //   `queued` for the test to read).
  //   Test: page.goto('/'), then the run's tile.
  //   Observable result: the tile's text contains "queued"; exactly one
  //   descendant's class contains `bg-(--tone-neutral-fg)`.
  //   Expected-value source: design D23 verbatim; design C9 `runDot`'s
  //   grey case (no `inFlight` on a queued record), Sidebar.tsx's grey
  //   class.
  test('(design D23) a queued tile shows "queued" and a grey dot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-queued-run';
    const run = baseRun(runId, 'e2e-board-run-queued-proj', {
      status: 'queued',
      spec: 'e2e-board-run-queued-spec',
      pauseRequested: isoAgo(0),
    });
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('queued');
      await expect(tile.locator('[class*="bg-(--tone-neutral-fg)"]')).toHaveCount(1);
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criterion "a deploy-held run reads `held for deploy` (regression
  // guard)" (task 13 Note: "The `held for deploy` case is a regression
  // guard for the note"; Requirement 6 AC 7, invariant per the requirements
  // document). `pauseNote` itself already returns this text at base (task
  // 9's unit test); this proves only that `RunTile` — new in this task —
  // wires that existing function in, which does not hold until the tile
  // exists.
  //   Pre-condition: a `waiting` run with `holdBy: 'deploy'`.
  //   Test: page.goto('/'), then the run's tile's text content.
  //   Observable result: the tile's text contains "held for deploy".
  //   Expected-value source: `src/dashboard_frontend/src/modules/shell/pause.ts:34-36`
  //   `pauseNote`'s `holdBy === 'deploy'` branch, checked first regardless
  //   of status.
  test('(R6 AC7) a deploy-held run reads "held for deploy"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-deployheld-run';
    const run = baseRun(runId, 'e2e-board-run-deployheld-proj', {
      status: 'waiting',
      spec: 'e2e-board-run-deployheld-spec',
      holdBy: 'deploy',
    });
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('held for deploy');
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // --- RunTile presses and stopped runs (task 14; design C10, C11, D21, D36) ---
  //
  // `RunTile` has no button at all until this task wires it: every test
  // below is red on the current tree for that reason alone, on top of
  // whichever behaviour it presses or reads. Pause, Resume, Stop and the
  // real half of Discard go through the dev proxy to the real `Controller`
  // this server runs (`playwright.worktree.config.ts` disables only its
  // deploy coordinator, `SDD_DEPLOY_DISABLED`); Re-drive and Confirm are
  // stubbed with `page.route` (D52). A `queued` or unguarded `paused`
  // fixture would otherwise be swept by that live scheduler within its 1 s
  // tick the same way task 13's own `queued` fixture had to dodge it
  // (`isStartable`, `src/controller/controller.ts:549-562`); each fixture
  // below that needs such a dodge says so inline.

  // Criterion "Pause on a `running` run reads `pausing after this step`"
  // (task 14 Success; Requirement 7 AC 1 "the tile SHALL offer Pause";
  // Requirement 6 AC 6 "'pause requested' SHALL become 'pausing after this
  // step' ... a running run's note reads just that").
  //   Pre-condition: a `running` run, unheld (status `running` is never
  //   auto-started by the live scheduler, so no defensive field is needed).
  //   Test: page.goto('/'), then tile.getByRole('button', { name: 'Pause' }).click().
  //   Observable result: the tile's text eventually contains "pausing after
  //   this step".
  //   Expected-value source: `src/controller/controller.ts:299-318`
  //   `pause()`'s pending branch (status stays `running`, `pauseRequested`
  //   set); `src/dashboard_frontend/src/modules/shell/pause.ts:42-43`
  //   `pauseNote`'s literal text.
  test('(R7 AC1, R6 AC6) Pause on a running run reads "pausing after this step"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-pause-running-run';
    const run = baseRun(runId, 'e2e-board-run-pause-running-proj', {
      status: 'running', spec: 'e2e-board-run-pause-running-spec',
    });
    const runDir = await writeRunRecord(run);
    try {
      await login(page);
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect(tile).toContainText('pausing after this step', { timeout: 15000 });
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criterion "Pause on a `queued` run reads `paused`" (task 14 Success;
  // Requirement 7 AC 1; Requirement 6 AC 6 "Once applied, the note SHALL
  // start with 'paused'").
  //   Pre-condition: a `queued` run with `pauseRequested` already set (the
  //   scheduler dodge: `isStartable` checks `pauseRequested` before the
  //   status at all) and `holdBy: 'deploy'` (so `isOperatorHeld` still
  //   reads false — `pause.ts:28` returns false unconditionally whenever
  //   `holdBy === 'deploy'` — and `runControls` offers Pause rather than
  //   Resume). Pressing Pause always rewrites `holdBy: 'operator'`
  //   (`controller.ts:305`), so the press itself needs no further defence.
  //   Test: page.goto('/'), then tile.getByRole('button', { name: 'Pause' }).click().
  //   Observable result: the tile's text eventually contains "paused".
  //   Expected-value source: `controller.ts:299-318` `pause()`'s applied
  //   branch for a `queued`, not-active run (`status: 'paused'`,
  //   `pauseReason: 'operator'`); `pause.ts:37-40` `pauseNote`'s "paused by
  //   you" text.
  test('(R7 AC1, R6 AC6) Pause on a queued run reads "paused"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-pause-queued-run';
    const run = baseRun(runId, 'e2e-board-run-pause-queued-proj', {
      status: 'queued', spec: 'e2e-board-run-pause-queued-spec',
      pauseRequested: isoAgo(0), holdBy: 'deploy',
    });
    const runDir = await writeRunRecord(run);
    try {
      await login(page);
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Pause', exact: true }).click();
      await expect(tile).toContainText(/paused/i, { timeout: 15000 });
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criterion "Resume on a held run shows the stage and returns Pause"
  // (task 14 Success; Requirement 7 AC 2 "the tile SHALL offer Resume in
  // place of Pause"; Requirement 9 AC 1 "its tile SHALL show the stages
  // pressed, running, done, or failed").
  //   Pre-condition: a `running` run with `pauseRequested` set and no
  //   `holdBy` (an operator-held pending pause; `running` needs no
  //   scheduler dodge).
  //   Test: tile.getByRole('button', { name: /^resume/i }).click().
  //   Observable result: the tile's text passes through one of
  //   pressed/running/done; a `Pause` button is visible again once the
  //   press resolves.
  //   Expected-value source: `controller.ts:337-371` `resumeNow`'s pending
  //   branch (`pauseRequested`/`holdBy` cleared, status stays `running`);
  //   `board.ts` `runControls`'s `resume`/`pause` disjunction once
  //   `isOperatorHeld` reads false again.
  test('(R7 AC2, R9 AC1) Resume on a held run shows the stage and returns Pause', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-resume-held-run';
    const run = baseRun(runId, 'e2e-board-run-resume-held-proj', {
      status: 'running', spec: 'e2e-board-run-resume-held-spec',
      pauseRequested: isoAgo(2 * 60_000),
    });
    const runDir = await writeRunRecord(run);
    try {
      await login(page);
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      const resumeButton = tile.getByRole('button', { name: /^resume/i });
      await expect(resumeButton).toBeVisible();
      await resumeButton.click();
      await expect(tile).toContainText(/pressed|running|done/i, { timeout: 5000 });
      await expect(tile.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({ timeout: 15000 });
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criterion "a usage pause offers Resume" (task 14 Success; Requirement 7
  // AC 2; design C9 `runControls`'s table row "resume for a usage pause").
  //   Pre-condition: a `paused` run with `pauseReason: 'usage-window'`,
  //   `pauseRequested` set (scheduler dodge — a `paused` usage-window run
  //   is otherwise `isStartable` at once) and a past `resumeAt`.
  //   Test: page.goto('/'), then the tile's Resume button, with no press.
  //   Observable result: a button whose name starts with "Resume" is
  //   visible on the tile.
  //   Expected-value source: `board.ts` `runControls`: `resume =
  //   isOperatorHeld(run) || (run.status === 'paused' && run.holdBy !==
  //   'deploy')` — true for any non-deploy `paused` run, usage-window or not.
  test('(R7 AC2) a usage pause offers Resume', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-usage-pause-run';
    const run = baseRun(runId, 'e2e-board-run-usage-pause-proj', {
      status: 'paused', spec: 'e2e-board-run-usage-pause-spec',
      pauseReason: 'usage-window', pauseRequested: isoAgo(0), resumeAt: isoAgo(60 * 60_000),
    });
    const runDir = await writeRunRecord(run);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile.getByRole('button', { name: /^resume/i })).toBeVisible();
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criterion "Stop posts `cancel`, and the tile turns `abandoned` with its
  // branch kept" (task 14 Success; Requirement 7 AC 3 "the tile SHALL offer
  // Stop, which SHALL call the `cancel` route and keep the worktree, branch
  // and PR").
  //   Pre-condition: a `running` run whose `codeRoot` is a real temporary
  //   git repository with a real branch (so the post-cancel `abandoned`
  //   row's branch-presence read, needed for the tile to keep showing at
  //   all, reads true — the task's own Note).
  //   Test: tile.getByRole('button', { name: 'Stop' }).click().
  //   Observable result: the tile keeps showing with a Discard button and
  //   no Stop, Pause or Resume button; the branch still exists in the repo.
  //   Expected-value source: `controller.ts:282-287` `cancel` →
  //   `cancelRun` writes `status: 'abandoned'` and never touches
  //   `branch`/`worktree`; `board.ts` `runControls`'s stopped-run row
  //   (Discard only); `discardRun`'s own branch-delete step never ran.
  test('(R7 AC3) Stop posts cancel, and the tile turns abandoned with its branch kept', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-stop-run';
    const branch = 'feat/e2e-board-stop';
    const repoDir = await makeGitRepo(branch);
    const run = baseRun(runId, 'e2e-board-run-stop-proj', {
      status: 'running', spec: 'e2e-board-run-stop-spec',
      codeRoot: repoDir, specStore: repoDir, worktree: repoDir, branch,
    });
    const runDir = await writeRunRecord(run);
    try {
      await login(page);
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Stop', exact: true }).click();
      await expect(tile.getByRole('button', { name: 'Discard', exact: true })).toBeVisible({ timeout: 15000 });
      await expect(tile.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0);
      await expect(tile.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
      await expect(tile.getByRole('button', { name: /^resume/i })).toHaveCount(0);
      expect(branchExistsInRepo(repoDir, branch)).toBe(true);
    } finally {
      await removeRunRecord(runDir);
      await removeGitRepo(repoDir);
    }
  });

  // Criterion "an `abandoned`, an `error` and a recent `done` run with a
  // branch each show Discard and no Stop, Pause or Resume" (task 14
  // Success; Requirement 7 AC 4 "the tile SHALL offer Discard in place of
  // Stop, and no Pause or Resume"; Requirement 7 AC 6's admission rule for
  // each status), folded into one test over three fixtures the way task
  // 13's own stalled test bundled three run shapes.
  //   Pre-condition: an `abandoned`, an `error`, and a `done` run updated
  //   one hour ago, each with its own real git repo and branch.
  //   Test: page.goto('/'), then each run's tile's buttons.
  //   Observable result: each tile shows exactly one Discard button and no
  //   Stop, Pause or Resume button.
  //   Expected-value source: Requirement 7 AC 4 and AC 6 verbatim; `board.ts`
  //   `runControls`'s stopped-row branch (`discard: !moving &&
  //   discardAllowed`, `stop`/`pause`/`resume` all false for a non-moving
  //   status) and `stoppedAdmitted`'s three admitted shapes.
  test('(R7 AC4, R7 AC6) an abandoned, an error and a recent done run with a branch each show Discard and no Stop, Pause or Resume', async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const abandonedId = 'e2e-board-run-stopped-abandoned-run';
    const errorId = 'e2e-board-run-stopped-error-run';
    const doneId = 'e2e-board-run-stopped-done-run';
    const abandonedBranch = 'feat/e2e-board-stopped-abandoned';
    const errorBranch = 'feat/e2e-board-stopped-error';
    const doneBranch = 'feat/e2e-board-stopped-done';
    const abandonedRepo = await makeGitRepo(abandonedBranch);
    const errorRepo = await makeGitRepo(errorBranch);
    const doneRepo = await makeGitRepo(doneBranch);
    const abandonedRun = baseRun(abandonedId, 'e2e-board-run-stopped-abandoned-proj', {
      status: 'abandoned', spec: 'e2e-board-run-stopped-abandoned-spec',
      codeRoot: abandonedRepo, specStore: abandonedRepo, worktree: abandonedRepo, branch: abandonedBranch,
    });
    const errorRun = baseRun(errorId, 'e2e-board-run-stopped-error-proj', {
      status: 'error', spec: 'e2e-board-run-stopped-error-spec',
      codeRoot: errorRepo, specStore: errorRepo, worktree: errorRepo, branch: errorBranch,
    });
    const doneRun = baseRun(doneId, 'e2e-board-run-stopped-done-proj', {
      status: 'done', spec: 'e2e-board-run-stopped-done-spec', updated: isoAgo(60 * 60_000),
      codeRoot: doneRepo, specStore: doneRepo, worktree: doneRepo, branch: doneBranch,
    });
    const abandonedDir = await writeRunRecord(abandonedRun);
    const errorDir = await writeRunRecord(errorRun);
    const doneDir = await writeRunRecord(doneRun);
    try {
      await page.goto('/');
      for (const id of [abandonedId, errorId, doneId]) {
        const tile = page.getByTestId(`run-tile-${id}`);
        await expect(tile).toBeVisible({ timeout: 15000 });
        await expect(tile.getByRole('button', { name: 'Discard', exact: true })).toBeVisible();
        await expect(tile.getByRole('button', { name: 'Stop', exact: true })).toHaveCount(0);
        await expect(tile.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
        await expect(tile.getByRole('button', { name: /^resume/i })).toHaveCount(0);
      }
    } finally {
      await removeRunRecord(abandonedDir);
      await removeRunRecord(errorDir);
      await removeRunRecord(doneDir);
      await removeGitRepo(abandonedRepo);
      await removeGitRepo(errorRepo);
      await removeGitRepo(doneRepo);
    }
  });

  // Criteria "a branchless one shows no tile", "a 25-hour-old `done` run
  // shows no tile" and "stopped runs sort after moving ones, newest first"
  // (task 14 Success; Requirement 7 AC 6; design C9 `running`) are
  // RED-IMPOSSIBLE: `HomePage.tsx` already fills the Running band from
  // `running(controllerRuns, enabled, tick)` (task 11), whose admission
  // (`stoppedAdmitted`) and sort order are task 8's `board.ts`, wired in
  // before this task and untouched by it — none of the three needs a
  // button, so all three already pass with no press wiring at all. Each
  // already has its own unit assertion, branch by branch, in task 8's own
  // Success line, covered in `src/dashboard/shell/__tests__/board-view.test.ts`:
  // "refuses each without it" and "refuses it at exactly 24 hours and with
  // no branch" (the branchless and 25-hour branches) and "admitted stopped
  // runs follow, newest `updated` first" (the sort order). Left out of the
  // red-test list per the standing green-regression-guard rule.

  // Criteria "the first Discard press posts nothing and shows the armed
  // text" and "the second posts, the branch and worktree are gone and the
  // tile leaves" (task 14 Success; Requirement 7 AC 5 "the tile SHALL ask
  // for a second press that names what goes ... only that press SHALL call
  // the route"; design D36 "The first Discard press is secondary, the
  // armed press danger"), folded into one test as one linear two-press
  // flow, plus the button-variant half of Requirement 11 AC 3 ("Tile
  // buttons SHALL use the secondary variant ... except the danger Discard
  // press").
  //   Pre-condition: an `abandoned` run with a real repo and branch.
  //   Test: tile.getByRole('button', { name: 'Discard' }).click(), then the
  //   armed button's click, with a `page.on('request', ...)` tap counting
  //   POSTs to the discard route.
  //   Observable result: after the first click, zero discard POSTs, the
  //   armed button (`data-variant="danger"`) carries the exact confirm text
  //   of `RunsPage.tsx:360`; the first button carried `data-variant`
  //   `"secondary"`; after the second click, exactly one discard POST, the
  //   run's tile leaves, and the branch no longer exists in the repo.
  //   Expected-value source: design C10 "the first press is a `secondary`
  //   button ... the armed button is `danger` and carries the text of
  //   `RunsPage.tsx:360`. Only that press calls the route"; `ui.tsx`'s
  //   `data-variant` attribute; `discardRun`'s `git branch -D`.
  test('(R7 AC5, D36, R11 AC3) the first Discard press posts nothing and shows the armed text; the second posts and the branch is gone', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-discard-run';
    const branch = 'feat/e2e-board-discard';
    const repoDir = await makeGitRepo(branch);
    const run = baseRun(runId, 'e2e-board-run-discard-proj', {
      status: 'abandoned', spec: 'e2e-board-run-discard-spec',
      codeRoot: repoDir, specStore: repoDir, worktree: repoDir, branch,
    });
    const runDir = await writeRunRecord(run);
    let discardPosts = 0;
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes(`/api/controller/runs/${runId}/discard`)) discardPosts++;
    });
    try {
      await login(page);
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      const firstPress = tile.getByRole('button', { name: 'Discard', exact: true });
      await expect(firstPress).toHaveAttribute('data-variant', 'secondary');
      await firstPress.click();

      const armedPress = tile.getByRole('button', {
        name: 'This deletes the worktree and branch and closes the PR', exact: true,
      });
      await expect(armedPress).toBeVisible();
      await expect(armedPress).toHaveAttribute('data-variant', 'danger');
      expect(discardPosts).toBe(0);

      await armedPress.click();
      await expect(page.getByTestId(`run-tile-${runId}`)).toHaveCount(0, { timeout: 15000 });
      expect(discardPosts).toBe(1);
      expect(branchExistsInRepo(repoDir, branch)).toBe(false);
    } finally {
      await removeRunRecord(runDir);
      await removeGitRepo(repoDir);
    }
  });

  // Criterion "a run sharing its branch with a moving run shows no Discard
  // and the quiet line" (task 14 Success; Requirement 7 AC 7 "the tile
  // SHALL NOT offer Discard"; design C10 "`discardAllowed: false` on a
  // stopped run shows the quiet line 'branch in use by a live run'").
  //   Pre-condition: an `abandoned` run and a `running` run sharing the
  //   same `codeRoot` and real branch.
  //   Test: page.goto('/'), then the stopped run's tile.
  //   Observable result: the tile's text contains "branch in use by a live
  //   run"; it has no Discard button.
  //   Expected-value source: `branchHeld` (`src/controller/runs.ts:1482-1488`):
  //   a moving run with the same `codeRoot` and `branch` holds it;
  //   `discardAllowed: !branchHeld(...)`; design C10's quiet-line text
  //   verbatim.
  test('(R7 AC7) a run sharing its branch with a moving run shows no Discard and the quiet line', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const stoppedId = 'e2e-board-run-branchheld-stopped-run';
    const movingId = 'e2e-board-run-branchheld-moving-run';
    const branch = 'feat/e2e-board-branchheld';
    const repoDir = await makeGitRepo(branch);
    const stoppedRun = baseRun(stoppedId, 'e2e-board-run-branchheld-proj', {
      status: 'abandoned', spec: 'e2e-board-run-branchheld-stopped-spec',
      codeRoot: repoDir, specStore: repoDir, worktree: repoDir, branch,
    });
    const movingRun = baseRun(movingId, 'e2e-board-run-branchheld-proj', {
      status: 'running', spec: 'e2e-board-run-branchheld-moving-spec',
      codeRoot: repoDir, specStore: repoDir, worktree: repoDir, branch,
    });
    const stoppedDir = await writeRunRecord(stoppedRun);
    const movingDir = await writeRunRecord(movingRun);
    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${stoppedId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('branch in use by a live run');
      await expect(tile.getByRole('button', { name: 'Discard', exact: true })).toHaveCount(0);
    } finally {
      await removeRunRecord(stoppedDir);
      await removeRunRecord(movingDir);
      await removeGitRepo(repoDir);
    }
  });

  // Criterion "a stubbed 409 `branch-in-use` shows that as the failed
  // reason and it stays until the next press" (task 14 Success; Requirement
  // 9 AC 2 "the failed stage SHALL show the body's `reason`, else its
  // `error`"; Requirement 9 AC 4 "it SHALL stay until the next press on
  // that tile"). Stubbed rather than the real guard (unlike the rest of
  // this task's Discard presses), because the real 409 case is already
  // proven read-side by the test above; this one proves only the stage
  // wiring's reaction to it.
  //   Pre-condition: an `abandoned` run with a real repo and branch;
  //   `page.route` answers its first discard POST 409 `{ error:
  //   'branch-in-use' }`, then flips to 200 `{ ok: true }` for the next one.
  //   Test: arm then press Discard (409), wait 6 s, then press the still-
  //   armed button again (now 200).
  //   Observable result: right after the 409, the tile shows "failed" and
  //   "branch-in-use"; six seconds later it still does (no auto-clear); the
  //   next press makes "branch-in-use" go.
  //   Expected-value source: design C11 `failReason`: the body's `reason`;
  //   `advance`: "A `failed` stage stays until the next `press` on that key".
  test('(R7 AC7, R9 AC2, R9 AC4) a stubbed 409 branch-in-use shows that as the failed reason and it stays until the next press', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-discard-409-run';
    const branch = 'feat/e2e-board-discard-409';
    const repoDir = await makeGitRepo(branch);
    const run = baseRun(runId, 'e2e-board-run-discard-409-proj', {
      status: 'abandoned', spec: 'e2e-board-run-discard-409-spec',
      codeRoot: repoDir, specStore: repoDir, worktree: repoDir, branch,
    });
    const runDir = await writeRunRecord(run);
    let fail = true;
    try {
      await page.route(`**/api/controller/runs/${runId}/discard`, async (route) => {
        if (fail) {
          await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'branch-in-use' }) });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
        }
      });
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Discard', exact: true }).click();
      const armedPress = tile.getByRole('button', {
        name: 'This deletes the worktree and branch and closes the PR', exact: true,
      });
      await armedPress.click();
      await expect(tile).toContainText(/failed/i, { timeout: 5000 });
      await expect(tile).toContainText('branch-in-use');

      await page.waitForTimeout(6000);
      await expect(tile).toBeVisible();
      await expect(tile).toContainText('branch-in-use');

      fail = false;
      await armedPress.click();
      await expect(tile).not.toContainText('branch-in-use', { timeout: 5000 });
    } finally {
      await removeRunRecord(runDir);
      await removeGitRepo(repoDir);
    }
  });

  // Criterion "Re-drive on a stalled tile shows its stages" (task 14
  // Success; Requirement 6 AC 4 "the tile SHALL show red 'Stalled' and
  // Re-drive in place of the dot"; Requirement 9 AC 1).
  //   Pre-condition: a `running` run with no driver (`isStalled` true);
  //   `page.route` gates its redrive POST on a manually-released promise
  //   (D52 stub), the same pattern task 12's Confirm press test uses.
  //   Test: tile.getByRole('button', { name: 'Re-drive' }).click().
  //   Observable result: the tile shows "pressed" and the button disables;
  //   once released, the tile shows "running".
  //   Expected-value source: design C11 `responseStage`: a 2xx gives
  //   `running`; D37 "a stage disables every stage control on its tile".
  test('(R6 AC4, R9 AC1) Re-drive on a stalled tile shows its stages', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const runId = 'e2e-board-run-redrive-run';
    const run = baseRun(runId, 'e2e-board-run-redrive-proj', {
      status: 'running', spec: 'e2e-board-run-redrive-spec',
    });
    const runDir = await writeRunRecord(run);
    let releaseGate!: () => void;
    const gate = new Promise<void>((resolve) => { releaseGate = resolve; });
    try {
      await page.route(`**/api/controller/runs/${runId}/redrive`, async (route) => {
        await gate;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
      });
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('Stalled');
      const redriveButton = tile.getByRole('button', { name: 'Re-drive', exact: true });

      await redriveButton.click();
      await expect(tile).toContainText(/pressed/i, { timeout: 5000 });
      await expect(redriveButton).toBeDisabled();

      releaseGate();
      await expect(tile).toContainText(/running/i, { timeout: 5000 });
    } finally {
      await removeRunRecord(runDir);
    }
  });

  // Criterion "a stubbed Confirm plus a seeded run shows that run's tile in
  // Running (requirement 5 AC 4)" is RED-IMPOSSIBLE: Requirement 5 AC 4
  // itself says so ("the launch itself is an invariant (verified, not
  // red-first: `src/dashboard/multi-server.ts:796-801`)"), and a seeded
  // `running` run's tile shows in band-running from `HomePage.tsx`'s
  // existing `running()` wiring (task 11) and `RunTile`'s read side (task
  // 13) with no press at all — already asserted by task 13's own "(R6 AC1,
  // AC2) a run tile shows step kind, task, step age, last activity, and a
  // green dot" case above. Confirm's stubbed press adds nothing this task
  // changes. Left out of the red-test list per the standing rule.

  // Task 15 "Add the Next tiles" (design C10, D29, D30; Requirements 8, 9.2).
  // `buildLaunchInput` is design/requirement-pinned "invariant, verified,
  // not red-first" (Requirement 8 AC 6; design C10's Error Handling list),
  // and the task's own Note repeats it: "Launch posting `buildLaunchInput`
  // holds at base: regression guard." No red test below presses Launch to
  // check its request body; the 409 case below presses Launch only to prove
  // the failed stage renders `OpErrorView`, per Requirement 9 AC 2.

  // Criterion "a project with a launchable spec shows spec, tag, one setup
  // line stating `gates record`, and Launch" (task 15 Success; Requirement
  // 8 AC 1, AC 3).
  //   Pre-condition: a registered project whose decomposition.md names one
  //   unstarted spec at heading 1, so `buildSetupView` gives it as
  //   `launchable` with no `launchBlock`.
  //   Test: page.goto('/'), then page.getByTestId('next-tile-' + projectId).
  //   Observable result: the tile contains the spec name, the project's
  //   display name, the exact line `setupLine` computes from the real
  //   fetched view (`supervisor <model> · <n> roles · worktree <v> · gates
  //   record`), and a "Launch" button.
  //   Expected-value source: the real `GET .../harness/setup` response,
  //   read directly in the test and used to build the expected line; design
  //   C9's `setupLine`.
  test('(R8 AC1, AC3) a launchable project\'s Next tile shows its spec, project tag, setup line and Launch', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const spec = 'e2e-board-next-fields-spec';
    const { projectId, dir } = await registerNextProject(page, 'fields', async (wr) => {
      await writeDecomposition(wr, `### 1. \`${spec}\`\n`);
    });
    try {
      const viewRes = await page.request.get(`/api/projects/${projectId}/harness/setup`);
      expect(viewRes.ok()).toBeTruthy();
      const view = await viewRes.json() as {
        launchable: string | null; supervisor: { model: string }; roles: unknown[]; worktree: string;
      };
      expect(view.launchable).toBe(spec);
      const expectedLine = `supervisor ${view.supervisor.model} · ${view.roles.length} roles · worktree ${view.worktree} · gates record`;

      const listRes = await page.request.get('/api/projects/list');
      const projects = await listRes.json() as Array<{ projectId: string; projectName: string }>;
      const projectName = projects.find((p) => p.projectId === projectId)?.projectName ?? '';
      expect(projectName.length).toBeGreaterThan(0);

      await page.goto('/');
      const tile = page.getByTestId(`next-tile-${projectId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText(spec);
      await expect(tile).toContainText(projectName);
      await expect(tile).toContainText(expectedLine);
      await expect(tile.getByRole('button', { name: 'Launch', exact: true })).toBeVisible();
    } finally {
      await unregisterProject(page, projectId, dir);
    }
  });

  // Criterion "a project with none shows no tile" (task 15 Success;
  // Requirement 8 AC 1 read negatively). Paired with a launchable control
  // project (same registration helper): "no tile for the empty project"
  // alone would hold even with no Next-tile rendering at all, so the
  // control's tile must show for this test to fail before the band is
  // wired.
  //   Pre-condition: a registered project with an empty `.spec-workflow`
  //   (no decomposition.md, no spec directories), so `buildSetupView` gives
  //   a null `launchable`; a second registered project whose decomposition
  //   names an unstarted spec, so it stays launchable.
  //   Test: page.goto('/'), then page.getByTestId('next-tile-' + id) for
  //   each project's id.
  //   Observable result: band-next renders; the empty project's tile has
  //   count 0 while the control's tile is visible.
  //   Expected-value source: the real `GET .../harness/setup` responses'
  //   `launchable`, read directly in the test; design C9's `nextTiles`
  //   drops a null `launchable`.
  test('(R8 AC1) a project with no launchable spec shows no Next tile, unlike a launchable control', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { projectId, dir } = await registerNextProject(page, 'none', async () => {});
    const controlSpec = 'e2e-board-next-none-control-spec';
    const control = await registerNextProject(page, 'none-control', async (wr) => (
      writeDecomposition(wr, `### 1. \`${controlSpec}\`\n`)
    ));
    try {
      const viewRes = await page.request.get(`/api/projects/${projectId}/harness/setup`);
      const view = await viewRes.json() as { launchable: string | null };
      expect(view.launchable).toBeNull();
      const controlViewRes = await page.request.get(`/api/projects/${control.projectId}/harness/setup`);
      const controlView = await controlViewRes.json() as { launchable: string | null };
      expect(controlView.launchable).toBe(controlSpec);

      await page.goto('/');
      await expect(page.getByTestId('band-next')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`next-tile-${control.projectId}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`next-tile-${projectId}`)).toHaveCount(0);
    } finally {
      await unregisterProject(page, projectId, dir);
      await unregisterProject(page, control.projectId, control.dir);
    }
  });

  // Criterion "a `launchBlock` that nulls `launchable` shows no tile" (task
  // 15 Success; Requirement 8 AC 4). Paired with an unblocked control
  // project (same decomposition shape, no run): "no tile for the blocked
  // project" alone would hold even with no Next-tile rendering at all, so
  // the control's tile must show for this test to fail before the band is
  // wired.
  //   Pre-condition: two registered projects whose decomposition.md each
  //   name an unstarted spec; the first alone gets a seeded `queued` run
  //   (written before `page.goto`, so the first load already reflects it —
  //   task 13's "A seeded file reaches an open page only on the 30 s tick"
  //   note) whose `project` equals its id, making `launchBlock` see a live
  //   run on it and null its setup view's `launchable` server-side
  //   (`multi-server.ts:669-672`); the second has no run and stays
  //   launchable.
  //   Test: page.goto('/'), then page.getByTestId('next-tile-' + id) for
  //   each project's id.
  //   Observable result: the queued run's tile is visible in band-running
  //   (the block is real, not assumed); the blocked project's Next tile has
  //   count 0 while the control's tile is visible.
  //   Expected-value source: the real `GET .../harness/setup` responses'
  //   `launchable` and `disabledReason`, read directly in the test.
  test('(R8 AC4) a launchBlock that nulls launchable shows no Next tile, unlike an unblocked control', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const spec = 'e2e-board-next-blocked-spec';
    const { projectId, dir } = await registerNextProject(page, 'blocked', async (wr) => {
      await writeDecomposition(wr, `### 1. \`${spec}\`\n`);
    });
    const controlSpec = 'e2e-board-next-blocked-control-spec';
    const control = await registerNextProject(page, 'blocked-control', async (wr) => (
      writeDecomposition(wr, `### 1. \`${controlSpec}\`\n`)
    ));
    const runId = 'e2e-board-next-blocked-run';
    const run = baseRun(runId, projectId, {
      status: 'queued', spec, pauseRequested: isoAgo(0), holdBy: 'deploy',
    });
    const runDir = await writeRunRecord(run);
    try {
      const viewRes = await page.request.get(`/api/projects/${projectId}/harness/setup`);
      const view = await viewRes.json() as { launchable: string | null; disabledReason: string | null };
      expect(view.launchable).toBeNull();
      expect(view.disabledReason).toMatch(/queued or live run/i);
      const controlViewRes = await page.request.get(`/api/projects/${control.projectId}/harness/setup`);
      const controlView = await controlViewRes.json() as { launchable: string | null };
      expect(controlView.launchable).toBe(controlSpec);

      await page.goto('/');
      await expect(page.getByTestId(`run-tile-${runId}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`next-tile-${control.projectId}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`next-tile-${projectId}`)).toHaveCount(0);
    } finally {
      await removeRunRecord(runDir);
      await unregisterProject(page, projectId, dir);
      await unregisterProject(page, control.projectId, control.dir);
    }
  });

  // Criterion "two projects on one store show one tile: the representative
  // ... when it is on" (task 15 Success; Requirement 8 AC 2, D11).
  //   Pre-condition: a representative and a member project on one store
  //   (`registerSharedStoreProjects`), both enabled by default (an id
  //   absent from `shell.projects`/`shell.projects.on` is on).
  //   Test: page.goto('/'), then page.getByTestId('next-tile-' + repId) and
  //   the member's id.
  //   Observable result: exactly the representative's tile shows; the
  //   member's id has count 0.
  //   Expected-value source: design C9's `nextProjects`: "the representative
  //   when it is on"; `stores.ts`'s `pickRepresentative` "own" match.
  test('(R8 AC2) two projects on one store show only the representative\'s tile when it is on', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const spec = 'e2e-board-next-shared-rep-spec';
    const { repId, memberId, sharedDir, memberDir } = await registerSharedStoreProjects(page, `### 1. \`${spec}\`\n`);
    try {
      await page.goto('/');
      await expect(page.getByTestId(`next-tile-${repId}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`next-tile-${memberId}`)).toHaveCount(0);
    } finally {
      await unregisterProject(page, repId, sharedDir);
      await unregisterProject(page, memberId, memberDir);
    }
  });

  // Criterion "two projects on one store show one tile: ... else the
  // enabled member" (task 15 Success; Requirement 8 AC 2, D11).
  //   Pre-condition: the same pair, with the representative's id put in
  //   `shell.projects` (the off-list) before the page loads, leaving the
  //   member unset (on).
  //   Test: page.goto('/'), then page.getByTestId('next-tile-' + memberId)
  //   and the representative's id.
  //   Observable result: exactly the member's tile shows; the
  //   representative's id has count 0.
  //   Expected-value source: design C9's `nextProjects`: "else the first
  //   enabled member".
  test('(R8 AC2) two projects on one store fall back to the enabled member when the representative is off', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const spec = 'e2e-board-next-shared-member-spec';
    const { repId, memberId, sharedDir, memberDir } = await registerSharedStoreProjects(page, `### 1. \`${spec}\`\n`);
    try {
      await page.addInitScript((offId) => {
        window.localStorage.setItem('shell.projects', JSON.stringify([offId]));
      }, repId);
      await page.goto('/');
      await expect(page.getByTestId(`next-tile-${memberId}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`next-tile-${repId}`)).toHaveCount(0);
    } finally {
      await unregisterProject(page, repId, sharedDir);
      await unregisterProject(page, memberId, memberDir);
    }
  });

  // Criterion "tiles follow `launchableOrder`, unnamed last, ties by project
  // name" (task 15 Success; Requirement 3 AC 9, design D10).
  //   Pre-condition: four registered projects: two tied at decomposition
  //   position 0 whose temp-dir names (and so, for a solo registration,
  //   whose `projectName = basename(dir)`, `project-registry.ts:131-138`)
  //   sort "...order-a..." before "...order-b..."; one at position 1 behind
  //   a `(deferred)`-tagged heading 0; one whose real, incomplete spec no
  //   heading names (`launchableOrder: null`).
  //   Test: page.goto('/'), then the DOM order of
  //   `[data-testid^="next-tile-"]`.
  //   Observable result: the four tiles render in the order
  //   [order-a, order-b, order-c, order-d] — ascending `launchableOrder`,
  //   the null-order project last, the tied pair by project name.
  //   Expected-value source: design C9's `nextTiles` sort rule, applied here
  //   through the real fetched views, not the already-unit-tested pure
  //   function alone.
  test('(R3 AC9) Next tiles sort by launchableOrder ascending, unnamed last, ties by project name', async ({ page }) => {
    test.setTimeout(45000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const projA = await registerNextProject(page, 'order-a', async (wr) => (
      writeDecomposition(wr, '### 1. `e2e-board-next-order-a-spec`\n')
    ));
    const projB = await registerNextProject(page, 'order-b', async (wr) => (
      writeDecomposition(wr, '### 1. `e2e-board-next-order-b-spec`\n')
    ));
    const projC = await registerNextProject(page, 'order-c', async (wr) => (
      writeDecomposition(
        wr,
        '### 1. `e2e-board-next-order-skip-spec` (deferred)\n### 2. `e2e-board-next-order-c-spec`\n',
      )
    ));
    const projD = await registerNextProject(page, 'order-d', async (wr) => {
      await writeDecomposition(wr, '### 1. `e2e-board-next-order-other-spec`\n');
      await writeActiveSpec(wr, 'e2e-board-next-order-d-spec');
    });
    try {
      const expectedIds = [projA.projectId, projB.projectId, projC.projectId, projD.projectId]
        .map((id) => `next-tile-${id}`);
      await page.goto('/');
      for (const id of expectedIds) {
        await expect(page.getByTestId(id)).toBeVisible({ timeout: 15000 });
      }
      const ids = await page
        .locator('[data-testid^="next-tile-"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
      expect(ids).toEqual(expectedIds);
    } finally {
      await unregisterProject(page, projA.projectId, projA.dir);
      await unregisterProject(page, projB.projectId, projB.dir);
      await unregisterProject(page, projC.projectId, projC.dir);
      await unregisterProject(page, projD.projectId, projD.dir);
    }
  });

  // Criterion "a setup fetch answering 500 drops that project's tile and
  // leaves the other" (task 15 Success; NFR Reliability "A failed setup
  // fetch SHALL show no Next tile for that project only").
  //   Pre-condition: two launchable projects; `page.route` answers only the
  //   second's setup fetch with a 500, leaving the first's real route
  //   untouched.
  //   Test: page.goto('/'), then page.getByTestId('next-tile-' + id) for
  //   each project.
  //   Observable result: the first project's tile shows; the second
  //   project's tile has count 0.
  //   Expected-value source: NFR Reliability's per-project failure rule;
  //   design C10's `useNextViews` "a failed fetch removes that project's
  //   entry only".
  test('(NFR Reliability) a 500 on one project\'s setup fetch drops only that project\'s tile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const specGood = 'e2e-board-next-500-good-spec';
    const specBad = 'e2e-board-next-500-bad-spec';
    const good = await registerNextProject(page, '500-good', async (wr) => (
      writeDecomposition(wr, `### 1. \`${specGood}\`\n`)
    ));
    const bad = await registerNextProject(page, '500-bad', async (wr) => (
      writeDecomposition(wr, `### 1. \`${specBad}\`\n`)
    ));
    try {
      await page.route(`**/api/projects/${bad.projectId}/harness/setup`, async (route) => {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
      });
      await page.goto('/');
      await expect(page.getByTestId(`next-tile-${good.projectId}`)).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`next-tile-${bad.projectId}`)).toHaveCount(0);
    } finally {
      await unregisterProject(page, good.projectId, good.dir);
      await unregisterProject(page, bad.projectId, bad.dir);
    }
  });

  // Criterion "a run status change refetches and the tile updates within
  // 5 s with no reload" (task 15 Success; Requirement 8 AC 5). The task's
  // own Note gives the trigger: "A real Pause on a seeded `queued` run
  // pushes a run change within the throttle" — pressing Pause on a queued
  // run flips its status to `paused` immediately (the task 14 "Pause on a
  // queued run reads 'paused'" case), changing the `id:status` pair
  // `useNextViews`'s `runKey` is built from (design C10, D30), without
  // depending on the slower, page-reload-only path a bare file write takes
  // (task 13's note on seeded files).
  //   Pre-condition: a launchable project whose own setup route is
  //   intercepted so the first response is forced `launchable: null`, with
  //   every other field passed through unmodified from the real route; an
  //   unrelated project's seeded `queued` run (dodging the live scheduler
  //   with `pauseRequested`/`holdBy: 'deploy'`, as task 14's queued-pause
  //   case does).
  //   Test: page.goto('/'); assert no Next tile; flip the stub to pass
  //   `launchable` through; press that queued run's real "Pause" button
  //   (going through the dev proxy, no `page.route` on the pause route
  //   itself); then page.getByTestId('next-tile-' + projectId) again, with
  //   no further navigation.
  //   Observable result: the Next tile is absent before the press and
  //   visible within 5 s after it, with no `page.goto`/reload between.
  //   Expected-value source: Requirement 8 AC 5's 5 s bound and "no
  //   reload"; design D30's refetch trigger.
  test('(R8 AC5) a run status change refetches Next within 5s with no reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const spec = 'e2e-board-next-refetch-spec';
    const { projectId, dir } = await registerNextProject(page, 'refetch', async (wr) => (
      writeDecomposition(wr, `### 1. \`${spec}\`\n`)
    ));
    const runId = 'e2e-board-next-refetch-run';
    const run = baseRun(runId, 'e2e-board-next-refetch-other-proj', {
      status: 'queued', spec: 'e2e-board-next-refetch-other-spec',
      pauseRequested: isoAgo(0), holdBy: 'deploy',
    });
    const runDir = await writeRunRecord(run);
    let launchableNow = false;
    try {
      await page.route(`**/api/projects/${projectId}/harness/setup`, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        if (!launchableNow) {
          body.launchable = null;
          body.disabledReason = 'blocked for the test';
        }
        await route.fulfill({ status: response.status(), contentType: 'application/json', body: JSON.stringify(body) });
      });
      await page.goto('/');
      const runTile = page.getByTestId(`run-tile-${runId}`);
      await expect(runTile).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId(`next-tile-${projectId}`)).toHaveCount(0);

      launchableNow = true;
      await runTile.getByRole('button', { name: 'Pause', exact: true }).click();

      await expect(page.getByTestId(`next-tile-${projectId}`)).toBeVisible({ timeout: 5000 });
    } finally {
      await removeRunRecord(runDir);
      await unregisterProject(page, projectId, dir);
    }
  });

  // Criterion "a stubbed 409 shows `OpErrorView`" (task 15 Success;
  // Requirement 9 AC 2 "Launch refusals SHALL keep `OpErrorView`").
  //   Pre-condition: a launchable project; `page.route` answers its launch
  //   POST with a 409 `run-live` body (`reason`, `runId`, `pid`), the same
  //   shape `OpErrorView`'s `run-live` branch renders as three distinct
  //   fields (`harness.tsx:69-108`).
  //   Test: press Launch on its tile, then read the tile's text.
  //   Observable result: the tile shows "Run id", the stubbed run id and
  //   the stubbed pid — `OpErrorView`'s multi-field rendering, not a plain
  //   one-line `failReason` string (which would show only the `reason`
  //   text).
  //   Expected-value source: `harness.tsx`'s `OpErrorView` `run-live`
  //   branch, read verbatim; design C11 "a `launch` non-2xx keeps `opError`
  //   so the tile renders `OpErrorView`".
  test('(R9 AC2) a stubbed Launch refusal renders OpErrorView', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const spec = 'e2e-board-next-launch-409-spec';
    const { projectId, dir } = await registerNextProject(page, 'launch-409', async (wr) => (
      writeDecomposition(wr, `### 1. \`${spec}\`\n`)
    ));
    try {
      await page.route(`**/api/projects/${projectId}/harness/launch`, async (route) => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'run-live', reason: 'A run is already live',
            runId: 'e2e-board-next-launch-live-run', pid: 4242,
          }),
        });
      });
      await page.goto('/');
      const tile = page.getByTestId(`next-tile-${projectId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await tile.getByRole('button', { name: 'Launch', exact: true }).click();

      await expect(tile).toContainText('Run id', { timeout: 5000 });
      await expect(tile).toContainText('e2e-board-next-launch-live-run');
      await expect(tile).toContainText('4242');
    } finally {
      await unregisterProject(page, projectId, dir);
    }
  });
});

/**
 * Browser checks of the top bar, the gear and the tab title (design C7
 * "Shell frame", C9's `tabTitle`, C10's `TabTitle`; decomposition task 16;
 * Requirements 1, 2 AC 1, 10, 11 AC 5). `Sidebar.tsx` is still the page's
 * only chrome at base, so every element this file asserts on through the
 * new top bar (`nav-home`, `deploy-button`, `open-advisor`, a project switch
 * reached through `gear-panel`) is absent or wrongly placed until the task
 * lands; each test below fails on its first assertion at base.
 */
function deployRecordPath(): string {
  return join(sddHome(), 'deploy.json');
}

async function writeDeployRecord(record: DeployRecord): Promise<void> {
  await writeFile(deployRecordPath(), JSON.stringify(record, null, 2) + '\n', 'utf-8');
}

async function removeDeployRecord(): Promise<void> {
  await rm(deployRecordPath(), { force: true });
}

test.describe('Shell (top bar, gear and tab title)', () => {
  test.setTimeout(60000);

  // Criterion "the header holds Home, Specs, Usage, Deferrals, Deploy, Open
  // advisor and the gear in that order, and no link shows a count" (task 16
  // Success; Requirement 1 AC 1).
  //   Pre-condition: a fresh Home, no project registered.
  //   Test: page.locator('[data-testid^="nav-"]') widened to the full header
  //   set named by design C7 (`nav-home`, `nav-specs`, `nav-usage`,
  //   `nav-deferrals`, `deploy-button`, `open-advisor`, `gear-toggle`).
  //   Observable result: exactly those 7 elements exist, in that DOM order;
  //   none of the four nav labels' text contains a digit.
  //   Expected-value source: design C7's explicit order and test ids;
  //   Requirement 1 AC 1's "no counts" clause.
  test('(R1 AC1) the header holds the links, Deploy, Open advisor and the gear in order with no link counts', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const order = ['nav-home', 'nav-specs', 'nav-usage', 'nav-deferrals', 'deploy-button', 'open-advisor', 'gear-toggle'];
    const selector = order.map((id) => `[data-testid="${id}"]`).join(', ');
    const els = page.locator(selector);
    await expect(els).toHaveCount(order.length, { timeout: 15000 });
    const ids = await els.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-testid')));
    expect(ids).toEqual(order);

    for (const navId of ['nav-home', 'nav-specs', 'nav-usage', 'nav-deferrals']) {
      const text = (await page.getByTestId(navId).textContent()) ?? '';
      expect(text).not.toMatch(/\d/);
    }
  });

  // Criterion "Open advisor posts as before and a long result wraps" (task
  // 16 Success; Requirement 1 AC 3).
  //   Pre-condition: a stubbed 200 answer to the advisor-open POST, with a
  //   long `command` string; viewport narrowed to 480 px.
  //   Test: click `open-advisor` once.
  //   Observable result: exactly one POST reaches the route; the rendered
  //   result text is found; its bounding box is taller than one line
  //   (wrapped, not truncated to a single ellipsised line).
  //   Expected-value source: design C7 "the result line drops `truncate`
  //   and takes `whitespace-normal break-words`"; Requirement 1 AC 3.
  test('(R1 AC3) Open advisor posts once and a long result wraps onto more than one line', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    const longWord = 'wraptestword';
    let postCount = 0;
    await page.route('**/api/controller/advisor/open', async (route) => {
      postCount += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: 'command', command: Array(40).fill(longWord).join(' ') }),
      });
    });

    await page.goto('/');
    const button = page.getByTestId('open-advisor');
    await expect(button).toBeVisible({ timeout: 15000 });
    await button.click();

    const result = page.getByText(longWord, { exact: false }).first();
    await expect(result).toBeVisible({ timeout: 15000 });
    expect(postCount).toBe(1);

    const box = (await result.boundingBox())!;
    expect(box.height).toBeGreaterThan(30);
  });

  // Criterion "the gear panel opens below its button and holds the theme
  // toggle, a named switch per project, the notification setting and the
  // version, with no density control, project dot or live count" (task 16
  // Success; Requirement 1 AC 4, AC 5; D13; Restrictions "no project dot or
  // live count in the gear", "the gear does not read useShell for
  // density"). The theme toggle, notification setting and version already
  // render inside `Gear.tsx` at base — only the switch-inside-the-panel and
  // the absent density control are new; folded into one test because they
  // describe the one panel's final contents (folds recorded in the report).
  //   Pre-condition: one registered project.
  //   Test: click `gear-toggle`, then read `gear-panel`'s content and
  //   position.
  //   Observable result: the panel's top sits at or below the button's
  //   bottom edge; it contains that project's switch and display name, no
  //   `project-dot-`/`project-live-count-` element, no density radio
  //   anywhere on the page, and the words "Theme" and "Notifications".
  //   Expected-value source: design C7's panel markup and D13's rationale;
  //   Requirement 1 AC 4 and AC 5's deletions.
  test('(R1 AC4, AC5, D13) the gear panel opens downward and holds the theme toggle, a named project switch, notifications and the version, with no density, dot or live count', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const dir = join(tmpdir(), `specwf-e2e-board-gear-${randomBytes(4).toString('hex')}`);
    const projectId = await registerProjectAt(page, dir);
    const listRes = await page.request.get('/api/projects/list');
    const projects = (await listRes.json()) as { projectId: string; projectName: string }[];
    const projectName = projects.find((p) => p.projectId === projectId)!.projectName;

    try {
      await page.goto('/');
      const toggle = page.getByTestId('gear-toggle');
      await expect(toggle).toBeVisible({ timeout: 15000 });
      const panel = page.getByTestId('gear-panel');
      await toggle.click();
      await expect(panel).toBeVisible();

      const toggleBox = (await toggle.boundingBox())!;
      const panelBox = (await panel.boundingBox())!;
      expect(panelBox.y).toBeGreaterThanOrEqual(toggleBox.y + toggleBox.height - 2);

      await expect(panel.getByTestId(`project-toggle-${projectId}`)).toBeVisible();
      await expect(panel).toContainText(projectName);
      await expect(panel.getByTestId(`project-dot-${projectId}`)).toHaveCount(0);
      await expect(panel.getByTestId(`project-live-count-${projectId}`)).toHaveCount(0);

      await expect(page.getByTestId('density-comfortable')).toHaveCount(0);
      await expect(page.getByTestId('density-compact')).toHaveCount(0);

      await expect(panel).toContainText('Theme');
      await expect(panel).toContainText('Notifications');
    } finally {
      await unregisterProject(page, projectId, dir);
    }
  });

  // Criterion "a switch persists across a reload and removes that
  // project's wait, run and Next tiles" (task 16 Success; Requirement 1 AC
  // 6). No renderer exercises `ProjectProvider.toggle` before this task
  // (task 7's Note), so this is this behaviour's first browser proof. Two
  // projects, not one: `launchBlock` nulls `launchable` for a project with
  // a live run (Requirement 8 AC 4), so one project cannot carry a run tile
  // and a Next tile at once.
  //   Pre-condition: project A has an open wait and a moving run; project B
  //   is registered with a launchable spec and no run.
  //   Test: open the gear, switch project A off, then project B off; reload
  //   after each.
  //   Observable result: project A's wait and run tiles, and project B's
  //   Next tile, each drop to 0 right after their switch and stay 0 after a
  //   reload; both switches read unchecked after the reload.
  //   Expected-value source: design C9's `enabled` filter threaded through
  //   `needsYou`/`running`/`nextProjects`; design C8's persisted storage.
  test('(R1 AC6) a project switch persists across a reload and removes that project\'s wait, run and Next tiles', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const dirA = join(tmpdir(), `specwf-e2e-board-toggle-a-${randomBytes(4).toString('hex')}`);
    const projectA = await registerProjectAt(page, dirA);
    const wait = baseWait('e2e-board-toggle-wait', projectA, 'e2e-board-toggle-wait-spec', 5 * 60_000);
    await writeWaitRecord(wait);
    const runId = 'e2e-board-toggle-run';
    const runDir = await writeRunRecord(baseRun(runId, projectA));

    const spec = 'e2e-board-toggle-next-spec';
    const { projectId: projectB, dir } = await registerNextProject(page, 'toggle', async (wr) => (
      writeDecomposition(wr, `### 1. \`${spec}\`\n`)
    ));

    try {
      await page.goto('/');
      const waitTile = page.getByTestId(`wait-tile-${wait.id}`);
      const runTile = page.getByTestId(`run-tile-${runId}`);
      const nextTile = page.getByTestId(`next-tile-${projectB}`);
      await expect(waitTile).toBeVisible({ timeout: 15000 });
      await expect(runTile).toBeVisible();
      await expect(nextTile).toBeVisible();

      const panel = page.getByTestId('gear-panel');
      await page.getByTestId('gear-toggle').click();
      await expect(panel).toBeVisible();
      const switchA = panel.getByTestId(`project-toggle-${projectA}`);
      const switchB = panel.getByTestId(`project-toggle-${projectB}`);
      await expect(switchA).toBeChecked();
      await expect(switchB).toBeChecked();
      await switchA.click();
      await expect(switchA).not.toBeChecked();
      await switchB.click();
      await expect(switchB).not.toBeChecked();

      await expect(waitTile).toHaveCount(0);
      await expect(runTile).toHaveCount(0);
      await expect(nextTile).toHaveCount(0);

      await page.reload();
      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      await expect(waitTile).toHaveCount(0);
      await expect(runTile).toHaveCount(0);
      await expect(nextTile).toHaveCount(0);

      await page.getByTestId('gear-toggle').click();
      await expect(panel).toBeVisible();
      await expect(panel.getByTestId(`project-toggle-${projectA}`)).not.toBeChecked();
      await expect(panel.getByTestId(`project-toggle-${projectB}`)).not.toBeChecked();
    } finally {
      await removeWaitRecord(wait.id);
      await removeRunRecord(runDir);
      await unregisterProject(page, projectA, dirA);
      await unregisterProject(page, projectB, dir);
    }
  });

  // Criterion "unset `sdd-fixture` is off on the board and in the gear;
  // turned on it stays on across a reload; another unset project stays on"
  // (task 16 Success; Requirement 1 AC 7).
  //   Pre-condition: two registered projects, one at a directory named
  //   exactly `sdd-fixture` (so its display name matches `DEFAULT_OFF_NAMES`
  //   exactly), the other at a randomly named directory; each with one open
  //   wait.
  //   Test: open the gear and read both switches, then click the
  //   `sdd-fixture` switch on and reload.
  //   Observable result: before any click, the other project's wait tile
  //   and gear switch read on while `sdd-fixture`'s wait tile has count 0
  //   and its switch reads unchecked; after the click its tile appears;
  //   after a reload both the tile and the switch still read on.
  //   Expected-value source: design C8's `DEFAULT_OFF_NAMES = ['sdd-fixture']`
  //   and D15/D24.
  test('(R1 AC7) an unset sdd-fixture is off by default, turning it on persists, and another unset project stays on', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const fixtureDir = join(tmpdir(), `specwf-e2e-board-fixture-${randomBytes(4).toString('hex')}`, 'sdd-fixture');
    const otherDir = join(tmpdir(), `specwf-e2e-board-other-${randomBytes(4).toString('hex')}`);
    const fixtureId = await registerProjectAt(page, fixtureDir, fixtureDir);
    const otherId = await registerProjectAt(page, otherDir, otherDir);
    const fixtureWait = baseWait('e2e-board-fixture-wait', fixtureId, 'e2e-board-fixture-spec', 5 * 60_000);
    const otherWait = baseWait('e2e-board-other-wait', otherId, 'e2e-board-other-spec', 5 * 60_000);
    await writeWaitRecord(fixtureWait);
    await writeWaitRecord(otherWait);

    try {
      await page.goto('/');
      const fixtureTile = page.getByTestId(`wait-tile-${fixtureWait.id}`);
      const otherTile = page.getByTestId(`wait-tile-${otherWait.id}`);
      await expect(otherTile).toBeVisible({ timeout: 15000 });
      await expect(fixtureTile).toHaveCount(0);

      const panel = page.getByTestId('gear-panel');
      await page.getByTestId('gear-toggle').click();
      await expect(panel).toBeVisible();
      await expect(panel.getByTestId(`project-toggle-${otherId}`)).toBeChecked();
      const fixtureSwitch = panel.getByTestId(`project-toggle-${fixtureId}`);
      await expect(fixtureSwitch).not.toBeChecked();

      await fixtureSwitch.click();
      await expect(fixtureSwitch).toBeChecked();
      await expect(fixtureTile).toBeVisible();

      await page.reload();
      await expect(fixtureTile).toBeVisible({ timeout: 15000 });
      await page.getByTestId('gear-toggle').click();
      await expect(panel).toBeVisible();
      await expect(panel.getByTestId(`project-toggle-${fixtureId}`)).toBeChecked();
    } finally {
      await removeWaitRecord(fixtureWait.id);
      await removeWaitRecord(otherWait.id);
      await unregisterProject(page, fixtureId, fixtureDir);
      await unregisterProject(page, otherId, otherDir);
    }
  });

  // Criterion "`/#/runs` and `/#/runs/x` land on Home" (task 16 Success;
  // Requirement 2 AC 1).
  //   Pre-condition: none.
  //   Test: page.goto('/#/runs') and page.goto('/#/runs/x').
  //   Observable result: each lands on the hash `#/` with `band-needs-you`
  //   visible.
  //   Expected-value source: design C7 "the two `/runs` routes go ... the
  //   catch-all stays"; Requirement 2 AC 1.
  test('(R2 AC1) /#/runs and /#/runs/x land on Home', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const path of ['/runs', '/runs/some-id']) {
      await page.goto(`/#${path}`);
      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/');
    }
  });

  // Criterion "the title reads `2 · 4h20m` with two open waits; a staged
  // action and a disabled project's wait do not count" (task 16 Success;
  // Requirement 10 AC 1).
  //   Pre-condition: two open waits on one enabled project, the older
  //   created 4h20m30s ago (so `compactAge` reads `4h20m` regardless of a
  //   few seconds of test latency); one open wait on a project disabled
  //   through `localStorage shell.projects`; one staged action, which
  //   `tabTitle` never reads at all.
  //   Test: page.goto('/'), then `document.title`.
  //   Observable result: the title reads exactly `2 · 4h20m`.
  //   Expected-value source: design C9's `tabTitle` table entry; Requirement
  //   10 AC 1 and AC 2's format.
  test('(R10 AC1) the tab title counts open enabled waits and excludes a staged action and a disabled project\'s wait', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const enabledProject = 'e2e-board-title-enabled-proj';
    const disabledProject = 'e2e-board-title-disabled-proj';
    const spec = 'e2e-board-title-spec';
    const oldest = baseWait('e2e-board-title-oldest', enabledProject, spec, 4 * 3600_000 + 20 * 60_000 + 30_000);
    const newer = baseWait('e2e-board-title-newer', enabledProject, spec, 60 * 60_000);
    const disabledWait = baseWait('e2e-board-title-disabled-wait', disabledProject, spec, 10 * 60_000);
    await writeWaitRecord(oldest);
    await writeWaitRecord(newer);
    await writeWaitRecord(disabledWait);
    const action = baseAction('e2e-board-title-action', {
      target: { project: enabledProject, spec },
      created: isoAgo(60_000),
    });
    await writeActionRecord(action);

    try {
      await page.addInitScript((id) => {
        window.localStorage.setItem('shell.projects', JSON.stringify([id]));
      }, disabledProject);
      await page.goto('/');
      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      await expect.poll(() => page.evaluate(() => document.title), { timeout: 15000 }).toBe('2 · 4h20m');
    } finally {
      await removeWaitRecord(oldest.id);
      await removeWaitRecord(newer.id);
      await removeWaitRecord(disabledWait.id);
      await removeActionRecord(action.id);
    }
  });

  // Criterion "with none it is the `index.html` title" (task 16 Success;
  // Requirement 10 AC 3).
  //   Pre-condition: one open wait, so the title first reads a count.
  //   Test: remove the wait record, reload, then `document.title`.
  //   Observable result: the title first matches `/^1 · /`, then — after
  //   the record is gone and the page reloads — reads exactly the
  //   `index.html` title `Spec Dashboard`.
  //   Expected-value source: Requirement 10 AC 3; `src/dashboard_frontend/index.html:6`.
  test('(R10 AC3) the title reverts to the index.html base once no open wait remains', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const wait = baseWait('e2e-board-title-revert-wait', 'e2e-board-title-revert-proj', 'e2e-board-title-revert-spec', 5 * 60_000);
    await writeWaitRecord(wait);

    try {
      await page.goto('/');
      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      await expect.poll(() => page.evaluate(() => document.title), { timeout: 15000 }).toMatch(/^1 · /);

      await removeWaitRecord(wait.id);
      await page.reload();
      await expect(page.getByTestId('band-needs-you')).toBeVisible({ timeout: 15000 });
      await expect.poll(() => page.evaluate(() => document.title), { timeout: 15000 }).toBe('Spec Dashboard');
    } finally {
      await removeWaitRecord(wait.id);
    }
  });

  // Criterion "at 390 px with the deploy strip open and an advisor result
  // showing, `scrollWidth` does not exceed the viewport on Home, Specs,
  // Usage and Deferrals" (task 16 Success; Requirement 11 AC 5).
  //   Pre-condition: a seeded `deploy.json` at stage `build` (opens
  //   `deploy-strip`); a stubbed long advisor result.
  //   Test: at 390x844, visit Home then follow the top bar's own `nav-*`
  //   links to Specs, Usage and Deferrals (so the persistent `TopBar`, not a
  //   fresh navigation, carries the strip and the result across pages).
  //   Observable result: on every one of the four pages,
  //   `document.documentElement.scrollWidth` does not exceed `clientWidth`.
  //   Expected-value source: Requirement 11 AC 5, read literally.
  test('(R11 AC5) at 390 px no page scrolls sideways with the deploy strip open and an advisor result showing', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await writeDeployRecord({ v: 1, stage: 'build', runs: [], started: isoAgo(0) });
    const longWord = 'wraptestword';
    await page.route('**/api/controller/advisor/open', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ state: 'command', command: Array(40).fill(longWord).join(' ') }),
      });
    });

    // `usage-closed-specs` only renders once some registered project has a
    // closed spec, so this seeds one in its own store. It must not rely on
    // `SPEC_WORKFLOW_SHARED_ROOT`: the review gate runs with that unset.
    const { projectId: overflowProjectId, dir: overflowDir } = await registerNextProject(
      page,
      'overflow',
      async (workflowRoot) => {
        const specDir = join(workflowRoot, 'specs', 'closed-overflow');
        await mkdir(specDir, { recursive: true });
        await writeFile(join(specDir, 'tasks.md'), '- [x] 1. first task\n', 'utf-8');
        await writeFile(
          join(workflowRoot, 'HANDOFF.md'),
          [
            '# HANDOFF',
            '',
            '## Phase log',
            '',
            '| Date | Spec | Stage | State | Result | Note |',
            '| --- | --- | --- | --- | --- | --- |',
            '| 2026-03-10 | closed-overflow | closeout | complete | closed | done |',
            '',
          ].join('\n'),
          'utf-8',
        );
      },
    );

    try {
      await page.goto('/');
      await expect(page.getByTestId('deploy-strip')).toBeVisible({ timeout: 15000 });
      await page.getByTestId('open-advisor').click();
      await expect(page.getByText(longWord, { exact: false }).first()).toBeVisible({ timeout: 15000 });

      const checkNoOverflow = async (label: string) => {
        await expect
          .poll(
            () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
            { message: `${label} @ 390px overflows horizontally`, timeout: 5000 },
          )
          .toBeLessThanOrEqual(0);
      };
      await checkNoOverflow('Home');

      await page.getByTestId('nav-specs').click();
      await expect(page.getByTestId('page-list')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('deploy-strip')).toBeVisible();
      await checkNoOverflow('Specs');

      await page.getByTestId('nav-usage').click();
      await expect(page.getByTestId('usage-closed-specs')).toBeVisible({ timeout: 15000 });
      await checkNoOverflow('Usage');

      await page.getByTestId('nav-deferrals').click();
      await expect(page.getByTestId('page-list')).toBeVisible({ timeout: 15000 });
      await checkNoOverflow('Deferrals');
    } finally {
      await removeDeployRecord();
      await unregisterProject(page, overflowProjectId, overflowDir);
    }
  });
});
