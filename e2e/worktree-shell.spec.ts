import { expect, test } from '@playwright/test';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { RegisteredProject, WorktreeHarness, resetSpecWorkflowHome } from './helpers/worktree-harness';

/**
 * Browser checks of the five-route dashboard shell (design Testing Strategy
 * end-to-end; decomposition checks 5 and 6). Runs on the same two-worktree
 * `--no-shared-worktree-specs` harness as e2e/worktree-no-shared.spec.ts: nav
 * order, the catch-all redirect, the project toggle and its persistence, the
 * density radio, group-collapse persistence, a live gate-A wait with no reload,
 * and the no-sideways-scroll rule at two narrow widths.
 *
 * The suite file name matches `WORKTREE_SPEC_PATTERN`, so it runs only under
 * playwright.worktree.config.ts, which isolates both SPEC_WORKFLOW_HOME and
 * XDG_STATE_HOME to temporary directories.
 */

const DASHBOARD_API_BASE_URL = 'http://127.0.0.1:5084';

const NAV_ORDER = ['nav-now', 'nav-runs', 'nav-specs', 'nav-usage', 'nav-deferrals'];
const SHELL_PAGES = ['/', '/runs', '/specs', '/usage', '/deferrals'];
// Real routes with no page, and one unknown route: every one lands on `/`.
const REDIRECTED = ['/approvals', '/steering', '/specs/view', '/harness', '/overview', '/nope'];

function getProjectByPathSuffix(projects: RegisteredProject[], suffix: string): RegisteredProject {
  const project = projects.find((entry) => entry.projectPath.endsWith(`/${suffix}`) || entry.projectPath.endsWith(`\\${suffix}`));
  if (!project) {
    throw new Error(`Project with path suffix "${suffix}" was not found in: ${JSON.stringify(projects, null, 2)}`);
  }
  return project;
}

test.describe.serial('Dashboard shell end to end', () => {
  test.setTimeout(180000);

  let harness: WorktreeHarness;
  let projectA: RegisteredProject;
  let projectB: RegisteredProject;
  let ledgerPathA: string;

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

    harness = new WorktreeHarness({
      serverRoot: process.cwd(),
      dashboardApiBaseUrl: DASHBOARD_API_BASE_URL,
      specWorkflowHome,
      mode: 'no-shared',
      worktrees: [
        { name: 'wt-a', layout: 'sibling', specName: 'spec-a', sourceFile: 'src/service-a.ts' },
        { name: 'wt-b', layout: 'sibling', specName: 'spec-b', sourceFile: 'src/service-b.ts' }
      ]
    });

    await harness.setup();

    // Seed wt-a's HANDOFF (naming spec-a) and a `run.start` ledger BEFORE the
    // servers start, so the overview watch arms on spec-a's harness-events.jsonl
    // when the first client connects. The gate test then appends the phase rows
    // and the append — not a reload — is what surfaces the wait.
    const wtA = harness.getWorktree('wt-a');
    const specADir = join(wtA.path, '.spec-workflow', 'specs', 'spec-a');
    ledgerPathA = join(specADir, 'harness-events.jsonl');
    await mkdir(specADir, { recursive: true });
    await writeFile(
      join(wtA.path, '.spec-workflow', 'HANDOFF.md'),
      '# HANDOFF\n\nActive spec **`spec-a`**\n',
      'utf-8'
    );
    await writeFile(
      ledgerPathA,
      JSON.stringify({ ts: '2026-10-06T10:00:00.000Z', type: 'run.start', run: 'run-1', spec: 'spec-a' }) + '\n',
      'utf-8'
    );

    await harness.startMcpServers();
    const registered = await harness.waitForProjects(2, 90000);
    projectA = getProjectByPathSuffix(registered, 'wt-a');
    projectB = getProjectByPathSuffix(registered, 'wt-b');
  });

  test.afterAll(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('the five nav links appear in the fixed order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const navs = page.locator('[data-testid^="nav-"]');
    await expect(navs).toHaveCount(NAV_ORDER.length, { timeout: 15000 });
    const ids = await navs.evaluateAll((els) => els.map((el) => el.getAttribute('data-testid')));
    expect(ids).toEqual(NAV_ORDER);
  });

  test('every path with no page redirects to Now', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const path of REDIRECTED) {
      await page.goto(`/#${path}`);
      // The Now page's first group proves we landed there, and the hash is reset.
      await expect(page.getByTestId('group-now-waits')).toBeVisible({ timeout: 15000 });
      await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/');
    }
  });

  test('toggling a project off hides its Specs rows and the state survives a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/specs');

    const rowA = page.getByTestId(`spec-row-${projectA.projectId}-spec-a`);
    const rowB = page.getByTestId(`spec-row-${projectB.projectId}-spec-b`);
    await expect(rowA).toBeVisible({ timeout: 15000 });
    await expect(rowB).toBeVisible();

    await page.getByTestId(`project-toggle-${projectB.projectId}`).click();
    await expect(rowB).toHaveCount(0);
    await expect(rowA).toBeVisible();

    await page.reload();
    await expect(rowA).toBeVisible({ timeout: 15000 });
    await expect(rowB).toHaveCount(0);
  });

  test('the density radio switches a row height between 36 and 32 px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/specs');

    const rowA = page.getByTestId(`spec-row-${projectA.projectId}-spec-a`);
    await expect(rowA).toBeVisible({ timeout: 15000 });
    expect(Math.round((await rowA.boundingBox())!.height)).toBe(36);

    await page.getByTestId('gear-toggle').click();
    await page.getByTestId('density-compact').click();
    await expect.poll(async () => Math.round((await rowA.boundingBox())!.height)).toBe(32);

    await page.getByTestId('density-comfortable').click();
    await expect.poll(async () => Math.round((await rowA.boundingBox())!.height)).toBe(36);
  });

  test('a collapsed group stays collapsed after a reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const toggle = page.getByTestId('group-now-live').locator('button[aria-expanded]');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 15000 });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await page.reload();
    const toggleAfter = page.getByTestId('group-now-live').locator('button[aria-expanded]');
    await expect(toggleAfter).toHaveAttribute('aria-expanded', 'false', { timeout: 15000 });
  });

  test('a live gate-A phase.end surfaces the gate wait within 5 s with no reload', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    // Only the `run.start` row is present, so there is no gate wait yet.
    await expect(page.getByTestId('group-now-waits')).toBeVisible({ timeout: 15000 });
    const gateRow = page.getByTestId(`wait-row-gate-${projectA.projectId}`);
    await expect(gateRow).toHaveCount(0);

    // Append the phase rows; the overview watch + shell feed push shell-now.
    await appendFile(
      ledgerPathA,
      JSON.stringify({ ts: '2026-10-06T10:01:00.000Z', type: 'phase.start', run: 'run-1', spec: 'spec-a', phase: 'requirements' }) + '\n',
      'utf-8'
    );
    await appendFile(
      ledgerPathA,
      JSON.stringify({ ts: '2026-10-06T10:02:00.000Z', type: 'phase.end', run: 'run-1', spec: 'spec-a', phase: 'requirements', result: 'gate-a' }) + '\n',
      'utf-8'
    );

    await expect(gateRow).toBeVisible({ timeout: 5000 });
  });

  test('at 1000 px the panel stacks below the list', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto('/#/specs');

    const rowA = page.getByTestId(`spec-row-${projectA.projectId}-spec-a`);
    await expect(rowA).toBeVisible({ timeout: 15000 });
    await rowA.click();
    await expect(page.getByTestId('spec-panel')).toBeVisible({ timeout: 15000 });

    const listBox = (await page.getByTestId('page-list').boundingBox())!;
    const panelBox = (await page.getByTestId('page-panel').boundingBox())!;
    expect(panelBox.y).toBeGreaterThanOrEqual(listBox.y + listBox.height - 2);
  });

  test('no page scrolls sideways at widths 1000 and 375', async ({ page }) => {
    const markerFor = (path: string) => (path === '/usage' ? 'usage-placeholder' : 'page-list');

    for (const width of [1000, 375]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of SHELL_PAGES) {
        await page.goto(`/#${path}`);
        await expect(page.getByTestId(markerFor(path))).toBeVisible({ timeout: 15000 });
        await expect
          .poll(
            () =>
              page.evaluate(
                () => document.documentElement.scrollWidth - document.documentElement.clientWidth
              ),
            { message: `${path} @ ${width}px overflows horizontally`, timeout: 5000 }
          )
          .toBeLessThanOrEqual(0);
      }
    }
  });
});
