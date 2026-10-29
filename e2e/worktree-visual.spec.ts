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

  /**
   * Logs `context` in with the dashboard's shared secret (`src/controller/access.ts`),
   * the same way `capture`'s `captureView` does, so the Usage and Run views'
   * `/api/controller/` fetch does not 401 and raise the sign-in dialog over
   * the view under test.
   */
  async function login(context: import('@playwright/test').BrowserContext): Promise<void> {
    const secret = (await readFile(secretPath(), 'utf-8')).trim();
    await context.request.post('/api/login', { data: { secret } });
  }

  /**
   * Parses a `getComputedStyle` colour string (`rgb(r, g, b)` or
   * `rgba(r, g, b, a)`) into its `[r, g, b]` channels.
   */
  function parseRgb(color: string): [number, number, number] {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) {
      throw new Error(`cannot parse colour ${color}`);
    }
    const parts = match[1].split(',').map((part) => parseFloat(part.trim()));
    return [parts[0], parts[1], parts[2]];
  }

  /** WCAG relative luminance (NFR Accessibility formula) for an `[r, g, b]` triple. */
  function relativeLuminance([r, g, b]: [number, number, number]): number {
    const [R, G, B] = [r, g, b].map((channel) => {
      const s = channel / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }

  /** WCAG contrast ratio between two `getComputedStyle` colour strings. */
  function contrastRatio(colorA: string, colorB: string): number {
    const lumA = relativeLuminance(parseRgb(colorA));
    const lumB = relativeLuminance(parseRgb(colorB));
    const lighter = Math.max(lumA, lumB);
    const darker = Math.min(lumA, lumB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Tabs through `page` up to 40 stops (design T4.2, Requirement 4.4). Each
   * stop's focused element must show an outline at least 2px wide with at
   * least 3:1 contrast against the nearest ancestor that paints an opaque
   * background. Stops when focus cycles back to its first element or leaves
   * the document.
   */
  async function assertFocusRingAtEveryStop(page: Page, label: string): Promise<void> {
    let firstKey: string | null = null;
    for (let stop = 0; stop < 40; stop++) {
      await page.keyboard.press('Tab');
      const result = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) {
          return null;
        }
        const style = getComputedStyle(el);
        let bgEl: Element | null = el;
        let background = 'rgba(0, 0, 0, 0)';
        while (bgEl) {
          const bg = getComputedStyle(bgEl).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            background = bg;
            break;
          }
          bgEl = bgEl.parentElement;
        }
        const key = `${el.tagName}#${el.id}.${el.className}:${el.getAttribute('data-testid') ?? ''}`;
        return {
          key,
          outlineStyle: style.outlineStyle,
          outlineWidth: parseFloat(style.outlineWidth),
          outlineColor: style.outlineColor,
          background,
        };
      });
      if (!result) {
        break;
      }
      if (result.key === firstKey) {
        break;
      }
      if (firstKey === null) {
        firstKey = result.key;
      }
      const where = `${label} stop ${stop} (${result.key})`;
      expect(result.outlineStyle, where).not.toBe('none');
      expect(result.outlineWidth, where).toBeGreaterThanOrEqual(2);
      expect(contrastRatio(result.outlineColor, result.background), where).toBeGreaterThanOrEqual(3);
    }
  }

  // Task 3 / design T4.2 (Requirement 4.4): keyboard focus shows a focus ring,
  // at least 2px wide with at least 3:1 contrast on its surface, on every
  // view in both themes. Red-first at base: SearchBox and LoginPanel use
  // `focus:outline-none`, and most other focusables draw no ring at all.
  test('keyboard focus shows the focus ring on every view', async ({ browser }) => {
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext();
      await login(context);
      const page = await context.newPage();
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
      for (const view of VIEWS) {
        await openView(page, view);
        await assertFocusRingAtEveryStop(page, `${view} (${theme})`);
      }
      await context.close();
    }
  });

  // Task 3 / design T4.6 (Requirement 5.4): above the sidebar-plus-content-max
  // width, the routes wrapper inside `main` is capped at 1600px and centred,
  // so the left and right gaps inside `main` match within 1px. Red-first at
  // base: `main` wraps `Routes` directly with no cap (App.tsx:20-21).
  test('content is capped and centred at 1920', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    await openView(page, 'now');
    const result = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) {
        throw new Error('no main element found');
      }
      if (main.children.length !== 1) {
        throw new Error(`main has ${main.children.length} children, expected exactly one wrapper`);
      }
      const wrapper = main.children[0] as HTMLElement;
      const mainRect = main.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      return {
        wrapperWidth: wrapperRect.width,
        leftGap: wrapperRect.left - mainRect.left,
        rightGap: mainRect.right - wrapperRect.right,
      };
    });
    await context.close();
    expect(result.wrapperWidth).toBeLessThanOrEqual(1600);
    expect(Math.abs(result.leftGap - result.rightGap)).toBeLessThanOrEqual(1);
  });

  // Task 3 / design T4.3 (Requirement 4.5, regression guard — mouse focus
  // shows no ring today, tasks.md task 3 Notes): a mouse click on a nav link
  // and on a button leaves `outline-style: none` on the clicked element.
  test('mouse focus shows no ring', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await openView(page, 'now');

    const navLink = page.getByTestId('nav-runs');
    await navLink.click();
    const navOutline = await navLink.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(navOutline).toBe('none');

    const gearButton = page.getByTestId('gear-toggle');
    await gearButton.click();
    const gearOutline = await gearButton.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(gearOutline).toBe('none');

    await context.close();
  });

  // Task 3 / design T4.7 (Requirement 5.6, regression guard, D10): none of
  // the six views scrolls sideways at 360, 768, 1000, 1440 or 1920px wide, in
  // either theme.
  test('no view scrolls sideways at five widths in both themes', async ({ browser }) => {
    const widths = [360, 768, 1000, 1440, 1920];
    for (const theme of ['light', 'dark'] as const) {
      const context = await browser.newContext();
      await login(context);
      const page = await context.newPage();
      await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
      for (const view of VIEWS) {
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          await openView(page, view);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow, `${view} at ${width}px (${theme})`).toBeLessThanOrEqual(0);
        }
      }
      await context.close();
    }
  });

  type StyleSnapshot = {
    background: string;
    color: string;
    border: string;
    borderRadius: string;
    height: string;
    padding: string;
    fontSize: string;
  };

  type KindCapture = { kind: 'row' | 'pill' | 'button'; key: string; style: StyleSnapshot };

  /**
   * Reads every row, pill and button kind instance inside `main` on the
   * current page (design D7: the sidebar is the same element on every view
   * and would pair trivially). A pill's key is its tone, a button's key is
   * its variant and size, and a row's key is constant (only unselected rows
   * are collected, design T4.1) — the attributes that drive each kind's look.
   */
  async function captureKindsInMain(page: Page): Promise<KindCapture[]> {
    return page.evaluate(() => {
      function snapshot(el: Element): StyleSnapshot {
        const s = getComputedStyle(el as HTMLElement);
        return {
          background: s.backgroundColor,
          color: s.color,
          border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
          borderRadius: s.borderRadius,
          height: s.height,
          padding: s.padding,
          fontSize: s.fontSize,
        };
      }
      const main = document.querySelector('main');
      const out: KindCapture[] = [];
      if (!main) return out;
      for (const el of Array.from(main.querySelectorAll('[data-ui="pill"]'))) {
        out.push({ kind: 'pill', key: `tone=${el.getAttribute('data-tone')}`, style: snapshot(el) });
      }
      for (const el of Array.from(main.querySelectorAll('[data-ui="button"]'))) {
        out.push({
          kind: 'button',
          key: `variant=${el.getAttribute('data-variant')}|size=${el.getAttribute('data-size')}`,
          style: snapshot(el),
        });
      }
      for (const el of Array.from(main.querySelectorAll('[data-ui="row"][data-selected="false"]'))) {
        out.push({ kind: 'row', key: 'unselected', style: snapshot(el) });
      }
      return out;
    });
  }

  /**
   * Finds one key of `kind` captured on two distinct views and returns the
   * first such pair, or `null` if every key of that kind is confined to one
   * view (design T4.1: the test names the kind when no pair exists).
   */
  function findCrossViewPair(
    captures: Array<KindCapture & { view: View }>,
    kind: KindCapture['kind'],
  ): [KindCapture & { view: View }, KindCapture & { view: View }] | null {
    const byKey = new Map<string, Array<KindCapture & { view: View }>>();
    for (const c of captures) {
      if (c.kind !== kind) continue;
      const list = byKey.get(c.key) ?? [];
      list.push(c);
      byKey.set(c.key, list);
    }
    for (const list of byKey.values()) {
      const first = list[0];
      const other = list.find((c) => c.view !== first.view);
      if (other) return [first, other];
    }
    return null;
  }

  // Task 4 / design T4.1 (Requirement 4.1, red-first: the design names the
  // harness). For each of row, pill and button, one instance matched on the
  // attributes that drive its look (tone for the pill, variant and size for
  // the button, an unselected row) computes the same background colour,
  // colour, border, border radius, height, padding and font size on two
  // different views, in the resting state (no hover triggered). Red at base:
  // none of these views render the pill or button component task 3 exports
  // yet, so no `data-tone`/`data-variant` pair exists across views.
  test('one kind computes one style across views', async ({ browser }) => {
    const context = await browser.newContext();
    await login(context);
    const page = await context.newPage();

    const captures: Array<KindCapture & { view: View }> = [];
    for (const view of VIEWS) {
      await openView(page, view);
      const found = await captureKindsInMain(page);
      for (const entry of found) captures.push({ ...entry, view });
    }
    await context.close();

    for (const kind of ['row', 'pill', 'button'] as const) {
      const pair = findCrossViewPair(captures, kind);
      expect(pair, `no cross-view pair found for kind "${kind}"`).not.toBeNull();
      const [a, b] = pair!;
      expect(a.style, `${kind} ${a.key}: ${a.view} vs ${b.view}`).toEqual(b.style);
    }
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
