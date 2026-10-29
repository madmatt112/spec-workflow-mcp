import { expect, test, type Page } from '@playwright/test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { WorktreeHarness, resetSpecWorkflowHome, type RegisteredProject } from './helpers/worktree-harness';
import { DeferralStorage } from '../src/core/deferral-storage.js';
import { secretPath } from '../src/controller/access.js';
import { sddHome } from '../src/dashboard/harness/state-files.js';
import { createWait } from '../src/controller/waits.js';
import type { RunRecord } from '../src/controller/state.js';

/**
 * Browser proof that the Specs and Deferrals counts, the any-enabled filter
 * and both page lists key on the spec store rather than on the listed
 * project (design.md C10-C12; Requirement 2). A `shared`-mode
 * {@link WorktreeHarness} with two worktrees and no server for the main
 * checkout gives exactly the fixture Requirement 2 describes: two listed
 * projects whose `workflowRootPath` is the one main checkout, with no
 * project ever listed for the checkout itself.
 *
 * Contract, per criterion, all exercised through test("a shared store counts
 * once") against the one dashboard this suite starts:
 *
 * - R2 AC1 (Specs count counts a store once). Pre-condition: two listed
 *   projects sharing one store with one spec in it. Test: read `nav-specs`
 *   after both load. Observable result: `1`, not `2`. Expected-value
 *   source: requirements.md:40, "count each pair of spec store and spec
 *   directory once, however many listed projects share that store".
 * - R2 AC2 (Deferrals count counts a store once). Pre-condition: the same
 *   store carries one `deferred` record. Test: read `nav-deferrals`.
 *   Observable result: `1`, not `2` — today each listed project's own
 *   `deferralsByProject` payload is built from the same shared store
 *   (`src/dashboard/multi-server.ts:464-473`), so summing every enabled
 *   listed project double-counts one store of two. Expected-value source:
 *   requirements.md:41.
 * - R2 AC3 (the any-enabled rule). Pre-condition: the same fixture with the
 *   store's representative project (the alphabetically-first worktree,
 *   `wt-a`; design C10's `storeGroups` representative rule) toggled off and
 *   its sibling `wt-b` left enabled. Test: re-read `nav-specs` and the Specs
 *   page's `spec-row-` rows. Observable result: unchanged at `1`, not `0` —
 *   today's Sidebar and SpecsPage key the enabled check on a row's own
 *   `projectId`, which is the representative's, so disabling only the
 *   representative zeroes a store that still has an enabled member.
 *   Expected-value source: requirements.md:42.
 * - R2 AC5 (the Specs page row count equals the Specs count). Pre-condition
 *   and test as above. Observable result: the `spec-row-` count equals
 *   `nav-specs` in both the all-enabled and the representative-disabled
 *   state. Expected-value source: requirements.md:44.
 * - R2 AC6 (the Deferrals page lists a store's record once). Pre-condition:
 *   the fixture's one deferred record, both listed projects enabled. Test:
 *   read the `deferral-row-` rows on `/#/deferrals`. Observable result: `1`,
 *   not `2`. Expected-value source: requirements.md:45.
 * - R2 AC8 (the payload carries store identity). Not independently
 *   observable: every assertion above is reachable only because `Project`
 *   carries `workflowRootPath` and `storeGroups`/`storeOf` key on it, so its
 *   coverage is folded into the AC1/AC2/AC3 assertions above
 *   (requirements.md:47).
 *
 * R2 AC4 (a live run on a store does not change the counts) is
 * RED-IMPOSSIBLE at this task: `ShellFeed.flush` calls `buildSpecRows` once
 * per `groupByStore` group regardless of which project, if any, has a live
 * run (`src/dashboard/shell/shell-feed.ts:98-102`) — liveness is never a
 * second axis of counting, already proved row-count-invariant by
 * `src/dashboard/shell/__tests__/shell-feed.test.ts:366-385` ("reads one
 * shared store once"). No code this task touches (frontend store grouping)
 * can affect it.
 */

const DASHBOARD_API_BASE_URL = 'http://127.0.0.1:5084';

/** The nav row's own count badge — the second `<span>`, after the label. */
async function navCount(page: Page, testId: string): Promise<number> {
  const text = await page.getByTestId(testId).locator('span').nth(1).innerText();
  return Number(text);
}

function byWorktreePath(projects: RegisteredProject[], path: string): RegisteredProject {
  const found = projects.find((p) => p.projectPath === path);
  if (!found) {
    throw new Error(`No registered project for worktree path ${path}. Got: ${JSON.stringify(projects, null, 2)}`);
  }
  return found;
}

test.describe.serial('Shared-store Specs and Deferrals counts', () => {
  test.setTimeout(180000);

  let harness: WorktreeHarness;

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180000);

    const specWorkflowHome = process.env.SPEC_WORKFLOW_HOME;
    if (!specWorkflowHome) {
      throw new Error('SPEC_WORKFLOW_HOME must be set by playwright.worktree.config.ts');
    }
    if (!process.env.XDG_STATE_HOME) {
      throw new Error('XDG_STATE_HOME must be set by playwright.worktree.config.ts');
    }

    await resetSpecWorkflowHome(specWorkflowHome);

    // `shared` mode with two worktrees and no separate server for the main
    // checkout: both worktrees' workflow root resolves to the one main
    // checkout, so this is two listed projects sharing one store with no
    // project ever listed for the main checkout itself.
    harness = new WorktreeHarness({
      serverRoot: process.cwd(),
      dashboardApiBaseUrl: DASHBOARD_API_BASE_URL,
      specWorkflowHome,
      mode: 'shared'
    });

    await harness.setup();
    await harness.startMcpServers();
    await harness.waitForProjects(2, 90000);

    // One deferred record in the shared store (the main checkout).
    await new DeferralStorage(harness.getRepoPath()).create({
      title: 'Shared store deferral',
      originSpec: 'spec-shared',
      originPhase: 'design',
      revisitTrigger: 'when the next spec starts',
      tags: [],
      supersedes: null,
      body: { context: 'ctx', decision: 'dec', revisitCriteria: 'crit' },
    });
  });

  test.afterAll(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('a shared store counts once', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const registered = await harness.waitForProjects(2);
    const wtA = harness.getWorktree('wt-a');
    const wtB = harness.getWorktree('wt-b');
    const projectA = byWorktreePath(registered, wtA.path);
    const projectB = byWorktreePath(registered, wtB.path);

    await page.goto('/');

    // R2 AC1, AC2, AC8: one store, one spec, one deferred record, two listed
    // projects on it — the counts read 1, not 2.
    await expect.poll(() => navCount(page, 'nav-specs'), { timeout: 15000 }).toBe(1);
    await expect.poll(() => navCount(page, 'nav-deferrals'), { timeout: 15000 }).toBe(1);

    // R2 AC5: the Specs page's own row count agrees with the sidebar count.
    await page.goto('/#/specs');
    await expect(page.locator('[data-testid^="spec-row-"]')).toHaveCount(1, { timeout: 15000 });

    // R2 AC6: the Deferrals page lists the one record once, not once per
    // listed project on the store.
    await page.goto('/#/deferrals');
    await expect(page.locator('[data-testid^="deferral-row-"]')).toHaveCount(1, { timeout: 15000 });

    // R2 AC3: disabling the store's representative project (`wt-a`, the
    // alphabetically-first worktree) alone must not zero a store whose
    // sibling `wt-b` is still enabled.
    await page.goto('/');
    await page.getByTestId(`project-toggle-${projectA.projectId}`).click();

    await expect.poll(() => navCount(page, 'nav-specs'), { timeout: 15000 }).toBe(1);
    await expect.poll(() => navCount(page, 'nav-deferrals'), { timeout: 15000 }).toBe(1);

    await page.goto('/#/specs');
    await expect(page.locator('[data-testid^="spec-row-"]')).toHaveCount(1, { timeout: 15000 });

    // Disabling every listed project on the store drops both counts to zero.
    await page.goto('/');
    await page.getByTestId(`project-toggle-${projectB.projectId}`).click();

    await expect.poll(() => navCount(page, 'nav-specs'), { timeout: 15000 }).toBe(0);
    await expect.poll(() => navCount(page, 'nav-deferrals'), { timeout: 15000 }).toBe(0);
  });
});

/**
 * Browser proof of the sidebar's status dot, live-run count and sort order
 * (design.md C9/C11; Requirements 5 and 6). A fresh `shared`-mode
 * {@link WorktreeHarness} with one worktree, plus two bare (non-git)
 * directories registered through `POST /api/projects/add`, gives three
 * listed projects whose dot, count and position this suite drives
 * independently: the main checkout (a linked worktree folds into it, design
 * C2/C3), a project with an open controller wait, and an idle project.
 *
 * Contract, per criterion:
 *
 * - R5 AC1, AC7 (one status dot, with a text alternative). Pre-condition:
 *   the main project listed, no live run yet. Test: read
 *   `project-dot-<mainId>`'s `data-state` and `aria-label`/`title`.
 *   Observable result: exactly one dot element, carrying a text
 *   alternative. Expected-value source: requirements.md:82,88.
 * - R5 AC3, AC5, AC6 (running dot and live count from a controller run).
 *   Pre-condition: a linked worktree registered on the main checkout's
 *   store, plus a `running` controller run record for the main project id.
 *   Test: read `project-dot-<mainId>` and `project-live-count-<mainId>`
 *   after `page.reload()`. Observable result: `data-state="running"`,
 *   count `1`. Expected-value source: requirements.md:84,86,87.
 * - R1 AC1 to AC4 (fold; regression guard, holds at base after tasks 6 and
 *   11 — not red here). Pre-condition and test as above. Observable result:
 *   exactly one `project-dot-`/`project-toggle-` element in total — the
 *   worktree's own registration never gains a second row. Expected-value
 *   source: requirements.md:21,24.
 * - R2 AC1, AC2, AC4 (the Specs/Deferrals counts are unaffected by a live
 *   worktree run; regression guard, holds at base after task 11 — not red
 *   here). Pre-condition: `nav-specs`/`nav-deferrals` read once before the
 *   worktree server starts. Test: re-read both after the run is seeded.
 *   Observable result: unchanged. Expected-value source:
 *   requirements.md:40,41,43.
 * - R5 AC2, AC4 (waiting dot; idle dot). Pre-condition: a project with one
 *   open controller wait (`createWait`) and an older `done` run; a second
 *   project with no wait and a newer `done` run. Test: read each project's
 *   `project-dot-` `data-state`. Observable result: `waiting` and `idle`.
 *   Expected-value source: requirements.md:83,85.
 * - R6 AC1, AC2 (active before idle, overriding recency). Pre-condition as
 *   above — the idle project's run is strictly newer than the waiting
 *   project's. Test: read the DOM order of every `project-dot-` element.
 *   Observable result: the waiting project's dot precedes the idle
 *   project's, despite the idle project's newer activity. Expected-value
 *   source: requirements.md:100-101.
 * - R5 AC11 (the filter governs neither the dot nor the sort position).
 *   Pre-condition: the main project's dot and position already observed.
 *   Test: toggle `project-toggle-<mainId>` off and re-read both — the
 *   toggle is client-side only, so no reload is needed for the comparison
 *   to be meaningful. Observable result: identical `data-state` and
 *   identical DOM order. Expected-value source: requirements.md:92.
 *
 * R5 AC8 (colours from tokens.css) and R5 AC10 (no other element, size or
 * spacing change) are regression guards covered by
 * `src/dashboard/__tests__/frontend-style-scan.test.ts`, not independently
 * observable here.
 */
test.describe.serial('Sidebar status dot, live-run count and order', () => {
  test.setTimeout(180000);

  let harness: WorktreeHarness;
  let secret: string;
  let mainProjectId: string;
  let baselineSpecsCount: number;
  let baselineDeferralsCount: number;
  let projectWId: string;
  let projectWPath: string;
  let projectIId: string;
  let projectIPath: string;

  // `workflowRootPath` is passed explicitly, equal to `projectPath`, rather
  // than left for the route to derive via `resolveGitRoot` (design C7):
  // deriving it honours `SPEC_WORKFLOW_SHARED_ROOT`, which this very
  // repository's own dev/test shells can have exported (this suite's own
  // host checkout), and an inherited override would point every registered
  // fixture's store at the real repository instead of the fixture. Passing
  // the store explicitly makes registration depend only on the two values
  // this test controls.
  async function addProject(projectPath: string): Promise<string> {
    const response = await fetch(`${DASHBOARD_API_BASE_URL}/api/projects/add`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
      body: JSON.stringify({ projectPath, workflowRootPath: projectPath }),
    });
    if (!response.ok) {
      throw new Error(
        `POST /api/projects/add failed for ${projectPath}: ${response.status} ${await response.text()}`
      );
    }
    const body = (await response.json()) as { projectId: string; success: boolean };
    return body.projectId;
  }

  async function seedRun(record: RunRecord): Promise<void> {
    const runDir = join(sddHome(), 'runs', record.id);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), JSON.stringify(record, null, 2) + '\n', 'utf-8');
  }

  async function dotOrder(page: Page): Promise<string[]> {
    return page.locator('[data-testid^="project-dot-"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-testid') ?? '')
    );
  }

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180000);

    const specWorkflowHome = process.env.SPEC_WORKFLOW_HOME;
    if (!specWorkflowHome) {
      throw new Error('SPEC_WORKFLOW_HOME must be set by playwright.worktree.config.ts');
    }
    if (!process.env.XDG_STATE_HOME) {
      throw new Error('XDG_STATE_HOME must be set by playwright.worktree.config.ts');
    }

    await resetSpecWorkflowHome(specWorkflowHome);

    secret = (await readFile(secretPath(), 'utf-8')).trim();

    harness = new WorktreeHarness({
      serverRoot: process.cwd(),
      dashboardApiBaseUrl: DASHBOARD_API_BASE_URL,
      specWorkflowHome,
      mode: 'shared',
      worktrees: [{ name: 'wt-a', layout: 'sibling' }],
    });

    await harness.setup();
  });

  test.afterAll(async () => {
    if (harness) {
      await harness.cleanup();
    }
    for (const dir of [projectWPath, projectIPath]) {
      if (dir) {
        await rm(dir, { recursive: true, force: true });
      }
    }
  });

  test('a live worktree run shows one running row', async ({ page }) => {
    mainProjectId = await addProject(harness.getRepoPath());

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.getByTestId(`project-toggle-${mainProjectId}`)).toBeVisible({ timeout: 15000 });

    baselineSpecsCount = await navCount(page, 'nav-specs');
    baselineDeferralsCount = await navCount(page, 'nav-deferrals');

    // A linked worktree on the main checkout's store: its main tree and
    // workflow root both equal the main project's own paths (R1 AC1), so it
    // folds into the main project's row rather than adding a second one.
    harness.startMcpServer('wt-a');
    const wtA = harness.getWorktree('wt-a');
    await expect.poll(async () => {
      const registry = await harness.readRegistry();
      return registry.some((entry) => entry.projectPath === wtA.path);
    }, { timeout: 60000 }).toBe(true);

    await seedRun({
      v: 1, id: 'e2e-sidebar-running', project: mainProjectId,
      codeRoot: harness.getRepoPath(), specStore: harness.getRepoPath(),
      spec: 'spec-shared', worktree: harness.getRepoPath(), branch: 'feat/spec-shared',
      status: 'running', created: '2026-10-06T10:00:00.000Z', updated: '2026-10-06T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    await page.reload();

    // Regression guard (holds at base after tasks 6/11, not red here): the
    // worktree never gains a second row.
    await expect(page.locator('[data-testid^="project-toggle-"]')).toHaveCount(1, { timeout: 15000 });

    await expect.poll(
      () => page.getByTestId(`project-dot-${mainProjectId}`).getAttribute('data-state'),
      { timeout: 15000 },
    ).toBe('running');
    await expect(page.getByTestId(`project-live-count-${mainProjectId}`)).toHaveText('1', { timeout: 15000 });
    await expect(page.locator('[data-testid^="project-dot-"]')).toHaveCount(1, { timeout: 15000 });

    const dotLabel = await page.getByTestId(`project-dot-${mainProjectId}`).getAttribute('aria-label');
    expect(dotLabel).toBeTruthy();

    await expect.poll(() => navCount(page, 'nav-specs'), { timeout: 15000 }).toBe(baselineSpecsCount);
    await expect.poll(() => navCount(page, 'nav-deferrals'), { timeout: 15000 }).toBe(baselineDeferralsCount);
  });

  test('a waiting project sorts above a newer idle one', async ({ page }) => {
    projectWPath = await mkdtemp(join(tmpdir(), 'specwf-e2e-sidebar-w-'));
    projectIPath = await mkdtemp(join(tmpdir(), 'specwf-e2e-sidebar-i-'));

    projectWId = await addProject(projectWPath);
    projectIId = await addProject(projectIPath);

    await createWait({
      kind: 'question',
      runId: 'e2e-sidebar-wait-run',
      projectId: projectWId,
      spec: 'spec-w',
      specDir: join(projectWPath, '.spec-workflow', 'specs', 'spec-w'),
      questions: [{ id: 'q1', text: 'Proceed?' }],
    });

    // An older run for the waiting project.
    await seedRun({
      v: 1, id: 'e2e-sidebar-wait-done', project: projectWId,
      codeRoot: projectWPath, specStore: projectWPath,
      spec: 'spec-w', worktree: projectWPath, branch: 'feat/spec-w',
      status: 'done', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    // A strictly newer run for the idle project — recency alone must not
    // put it above the waiting project (R6 AC1 over AC2).
    await seedRun({
      v: 1, id: 'e2e-sidebar-idle-done', project: projectIId,
      codeRoot: projectIPath, specStore: projectIPath,
      spec: 'spec-i', worktree: projectIPath, branch: 'feat/spec-i',
      status: 'done', created: '2026-06-01T00:00:00.000Z', updated: '2026-06-01T00:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await expect.poll(
      () => page.getByTestId(`project-dot-${projectWId}`).getAttribute('data-state'),
      { timeout: 15000 },
    ).toBe('waiting');
    await expect.poll(
      () => page.getByTestId(`project-dot-${projectIId}`).getAttribute('data-state'),
      { timeout: 15000 },
    ).toBe('idle');

    const order = await dotOrder(page);
    const idxW = order.indexOf(`project-dot-${projectWId}`);
    const idxI = order.indexOf(`project-dot-${projectIId}`);
    expect(idxW).toBeGreaterThanOrEqual(0);
    expect(idxI).toBeGreaterThanOrEqual(0);
    expect(idxW).toBeLessThan(idxI);
  });

  test('the filter keeps the dot and the position', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    await expect.poll(
      () => page.getByTestId(`project-dot-${mainProjectId}`).getAttribute('data-state'),
      { timeout: 15000 },
    ).toBe('running');

    const beforeState = await page.getByTestId(`project-dot-${mainProjectId}`).getAttribute('data-state');
    const beforeOrder = await dotOrder(page);

    await page.getByTestId(`project-toggle-${mainProjectId}`).click();

    const afterState = await page.getByTestId(`project-dot-${mainProjectId}`).getAttribute('data-state');
    const afterOrder = await dotOrder(page);

    expect(afterState).toBe(beforeState);
    expect(afterOrder).toEqual(beforeOrder);
  });
});
