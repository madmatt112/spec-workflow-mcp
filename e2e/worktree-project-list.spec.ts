import { expect, test, type Page } from '@playwright/test';
import { WorktreeHarness, resetSpecWorkflowHome, type RegisteredProject } from './helpers/worktree-harness';
import { DeferralStorage } from '../src/core/deferral-storage.js';

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
