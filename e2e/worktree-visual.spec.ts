import { Browser, Page, expect, test } from '@playwright/test';
import { mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { SeededVisualFixture, seedVisualSuite } from './helpers/shell-seed';
import { secretPath } from '../src/controller/access.js';

/**
 * Visual-parity suite (design C7 T4/T5; Requirement 7.1). Shares one seeded
 * `WorktreeHarness` (`e2e/helpers/shell-seed.ts`) across:
 *
 * - the outer `describe.serial`, where later tasks (2-5) add the cross-view
 *   sameness, focus-ring, native-controls, reduced-motion, width-cap and
 *   no-sideways-scroll tests (design C7 T4);
 * - the nested `capture` describe (T5), which is skipped entirely unless
 *   both `SCREENSHOT_SET` and `SCREENSHOT_DIR` are set, so a plain
 *   `npm run test:e2e:worktree` run writes nothing.
 *
 * The suite file name matches `WORKTREE_SPEC_PATTERN`, so it runs only under
 * playwright.worktree.config.ts, which isolates both SPEC_WORKFLOW_HOME and
 * XDG_STATE_HOME to temporary directories.
 */

const VIEWS = ['now', 'runs', 'run', 'specs', 'usage', 'deferrals'] as const;
type View = (typeof VIEWS)[number];
type Theme = 'light' | 'dark';

test.describe.serial('Dashboard visual suite', () => {
  test.setTimeout(180000);

  let fixture: SeededVisualFixture;

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180000);

    const specWorkflowHome = process.env.SPEC_WORKFLOW_HOME;
    if (!specWorkflowHome) {
      throw new Error('SPEC_WORKFLOW_HOME must be set by playwright.worktree.config.ts');
    }
    if (!process.env.XDG_STATE_HOME) {
      throw new Error('XDG_STATE_HOME must be set by playwright.worktree.config.ts');
    }

    fixture = await seedVisualSuite({ serverRoot: process.cwd(), specWorkflowHome });
  });

  test.afterAll(async () => {
    if (fixture?.harness) {
      await fixture.harness.cleanup();
    }
  });

  /**
   * Navigates `page` to one of the six views, opening the first row's panel
   * on Runs, Specs and Deferrals and the seeded run for the Run view, the
   * same way `../worktree-shell.spec.ts`'s own tests do.
   */
  async function openView(page: Page, view: View): Promise<void> {
    switch (view) {
      case 'now':
        await page.goto('/');
        await expect(page.getByTestId('group-now-waits')).toBeVisible({ timeout: 15000 });
        break;
      case 'runs':
        await page.goto('/#/runs');
        await page.locator('[data-testid^="ctrl-run-row-"]').first().click({ timeout: 15000 });
        await expect(page.getByTestId('ctrl-run-panel')).toBeVisible({ timeout: 15000 });
        break;
      case 'run':
        await page.goto('/#/runs');
        await page.getByTestId(`ctrl-run-row-${fixture.runRecord.id}`).click({ timeout: 15000 });
        await page.getByTestId('ctrl-open-run').click();
        await expect(page.getByTestId('pr-panel')).toBeVisible({ timeout: 15000 });
        break;
      case 'specs':
        await page.goto('/#/specs');
        await page.locator('[data-testid^="spec-row-"]').first().click({ timeout: 15000 });
        await expect(page.getByTestId('spec-panel')).toBeVisible({ timeout: 15000 });
        break;
      case 'usage':
        await page.goto('/#/usage');
        await expect(page.getByTestId('usage-closed-specs')).toBeVisible({ timeout: 15000 });
        break;
      case 'deferrals':
        await page.goto('/#/deferrals');
        await page.locator('[data-testid^="deferral-row-"]').first().click({ timeout: 15000 });
        await expect(page.getByTestId('deferral-panel')).toBeVisible({ timeout: 15000 });
        break;
    }
  }

  // Tasks 2-5 add their Requirement 3.3/4.1/4.4/4.5/4.6/5.4/5.6 tests directly
  // in this scope, reusing `fixture` and `openView`.

  // Task 2 / design T4.4 (Requirement 3.3): native controls take their colour
  // scheme from the selected theme, not the operating system. Each case opens
  // its own context so the OS emulation and the `theme` key it sets never leak
  // into the other direction's check.
  test('native controls follow the selected theme', async ({ browser }) => {
    async function colorSchemeFor(osScheme: 'light' | 'dark', theme: Theme): Promise<string> {
      const context = await browser.newContext({ colorScheme: osScheme });
      const page = await context.newPage();
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
      await page.goto('/');
      await expect(page.getByTestId('group-now-waits')).toBeVisible({ timeout: 15000 });
      const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
      await context.close();
      return scheme;
    }

    expect(await colorSchemeFor('light', 'dark')).toBe('dark');
    expect(await colorSchemeFor('dark', 'light')).toBe('light');
  });

  // Task 2 / design T4.5 (Requirement 4.6): under prefers-reduced-motion, a
  // nav link's transition duration is zeroed by the global reduced-motion rule.
  test('reduced motion zeroes transitions', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/');
    const navLink = page.locator('[data-testid^="nav-"]').first();
    await expect(navLink).toBeVisible({ timeout: 15000 });
    const duration = await navLink.evaluate((el) => getComputedStyle(el).transitionDuration);
    await context.close();
    expect(duration).toBe('0s');
  });

  test.describe('capture', () => {
    test.skip(
      !(process.env.SCREENSHOT_SET && process.env.SCREENSHOT_DIR),
      'capture is opt-in: set SCREENSHOT_SET and SCREENSHOT_DIR to run it',
    );

    /**
     * Opens `view` in a fresh browser context — fresh so each capture's
     * `localStorage.theme` (set before the first navigation, the same key
     * `src/dashboard_frontend/src/modules/theme/ThemeProvider.tsx:15` reads)
     * is never left over from a previous capture — and writes the screenshot.
     *
     * Logs in with the dashboard's shared secret first (`src/controller/access.ts`):
     * the Usage and Run views both fetch an `/api/controller/` route on load,
     * which 401s and raises the login overlay over an unauthenticated session,
     * covering the seeded data the screenshot exists to show.
     */
    async function captureView(
      browser: Browser,
      view: View,
      theme: Theme,
      width: number,
      height: number,
      path: string,
    ): Promise<void> {
      const context = await browser.newContext({ viewport: { width, height } });
      const secret = (await readFile(secretPath(), 'utf-8')).trim();
      await context.request.post('/api/login', { data: { secret } });
      const page = await context.newPage();
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
      await openView(page, view);
      await page.screenshot({ path });
      await context.close();
    }

    for (const view of VIEWS) {
      test(`captures the ${view} view`, async ({ browser }) => {
        const screenshotSet = process.env.SCREENSHOT_SET!;
        const dir = join(process.env.SCREENSHOT_DIR!, screenshotSet);
        await mkdir(dir, { recursive: true });

        await captureView(browser, view, 'light', 1440, 900, join(dir, `${view}-light.png`));
        await captureView(browser, view, 'dark', 1440, 900, join(dir, `${view}-dark.png`));

        if (screenshotSet === 'after') {
          await captureView(browser, view, 'dark', 375, 900, join(dir, `${view}-dark-375.png`));
        }
      });
    }
  });
});
