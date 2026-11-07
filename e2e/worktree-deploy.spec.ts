import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { sddHome } from '../src/dashboard/harness/state-files.js';
import type { RunRecord } from '../src/controller/state.js';
import type { DeployRecord } from '../src/controller/deploy.js';

/**
 * Browser checks of the Deploy control (design C9 "Dashboard control" and C10
 * "Reconnect"; decomposition task 13; Requirement 6 AC 1 to 7, AC 10).
 *
 * Runs on `playwright.worktree.config.ts`, whose dashboard webServer sets
 * `SDD_DEPLOY_DISABLED=1` (tasks D27): the real `Controller` behind this page
 * never ticks its deploy coordinator, so a seeded `deploy.json` stays exactly
 * as written and a seeded `run.json` is never picked up for a real launch.
 * No project is registered for this suite: `ProjectProvider.enabled()` reads
 * an id absent from its disabled list as on, and `listRunsForWire()` reads
 * `run.json` straight off disk, so Home needs no registered project to show
 * a controller run.
 *
 * Every mutating POST is stubbed with `page.route`, so none reaches the
 * server (the vite dev proxy's Origin rewrite is therefore not exercised
 * here; task 15's live verification covers it). Each test seeds its own
 * `deploy.json`/`run.json` under `sddHome()`, as
 * `e2e/worktree-shell.spec.ts:417-444` does, and removes them when it ends.
 *
 * Stage-strip contract this suite assumes of the implementation: within
 * `deploy-strip`, one element per `DEPLOY_STAGES` entry carries the test id
 * `deploy-stage-<stage>`, and the element for the record's current stage
 * carries `aria-current="step"`.
 */

const PROJECT_ID = 'e2e-deploy-project';

const BASE_TOKENS = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

function baseRun(id: string, overrides: Partial<RunRecord>): RunRecord {
  return {
    v: 1, id, project: PROJECT_ID,
    codeRoot: '/tmp/e2e-deploy-nonexistent', specStore: '/tmp/e2e-deploy-nonexistent',
    spec: 'spec-deploy', worktree: '/tmp/e2e-deploy-nonexistent', branch: 'feat/spec-deploy',
    status: 'running',
    created: '2026-11-05T10:00:00.000Z', updated: '2026-11-05T10:00:00.000Z',
    tokens: BASE_TOKENS,
    ...overrides,
  };
}

async function writeRun(run: RunRecord): Promise<string> {
  const dir = join(sddHome(), 'runs', run.id);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'run.json'), JSON.stringify(run, null, 2) + '\n', 'utf-8');
  return dir;
}

async function removeRun(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

function deployRecordPath(): string {
  return join(sddHome(), 'deploy.json');
}

async function writeDeploy(record: DeployRecord): Promise<void> {
  await writeFile(deployRecordPath(), JSON.stringify(record, null, 2) + '\n', 'utf-8');
}

async function removeDeploy(): Promise<void> {
  await rm(deployRecordPath(), { force: true });
}

async function stubPost(
  page: Page,
  urlGlob: string,
  status: number,
  body: Record<string, unknown>,
): Promise<{ count: () => number }> {
  let count = 0;
  await page.route(urlGlob, (route: Route) => {
    count += 1;
    return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { count: () => count };
}

test.describe('Deploy control', () => {
  test.setTimeout(60000);

  test.beforeAll(async () => {
    await mkdir(sddHome(), { recursive: true });
  });

  // --- AC 1: confirm before press, exactly one POST after it ---------------

  test('(AC1) Deploy opens a confirm naming the held count and the advisor restart, and posts only after confirm', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const runId = 'e2e-deploy-ac1-live';
    const runDir = await writeRun(baseRun(runId, { status: 'running' }));

    try {
      const press = await stubPost(page, '**/api/controller/deploy', 202, { ok: true });

      await page.goto('/');
      const deployButton = page.getByTestId('deploy-button');
      await expect(deployButton).toBeVisible({ timeout: 15000 });

      await deployButton.click();
      const confirm = page.getByTestId('deploy-confirm');
      await expect(confirm).toBeVisible({ timeout: 15000 });
      await expect(confirm).toContainText(/\b1\b/);
      await expect(confirm).toContainText(/restart/i);
      await expect(confirm).toContainText(/advisor/i);

      expect(press.count()).toBe(0);

      await confirm.click();
      await expect.poll(() => press.count(), { timeout: 15000 }).toBe(1);
    } finally {
      await removeRun(runDir);
    }
  });

  // --- AC 2, AC 3, AC 5 (cancelable sub-case): build ------------------------

  test('(AC2, AC3, AC5-build) at build the strip marks the current stage, Deploy is disabled, and cancel posts', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const deploy: DeployRecord = {
      v: 1, stage: 'build', runs: [], started: '2026-11-05T10:00:00.000Z',
    };
    await writeDeploy(deploy);

    try {
      const cancel = await stubPost(page, '**/api/controller/deploy/cancel', 200, { ok: true });

      await page.goto('/');
      const strip = page.getByTestId('deploy-strip');
      await expect(strip).toBeVisible({ timeout: 15000 });

      const stageIds = ['wait', 'build', 'smoke', 'gate', 'swap', 'restart', 'done'];
      for (const stage of stageIds) {
        await expect(strip.getByTestId(`deploy-stage-${stage}`)).toBeVisible();
      }
      await expect(strip.getByTestId('deploy-stage-build')).toHaveAttribute('aria-current', 'step');
      await expect(strip.getByTestId('deploy-stage-wait')).not.toHaveAttribute('aria-current', 'step');

      await expect(page.getByTestId('deploy-button')).toBeDisabled();
      await expect(page.getByText('Deploying: build')).toBeVisible();

      const cancelButton = page.getByTestId('deploy-cancel');
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();
      await expect.poll(() => cancel.count(), { timeout: 15000 }).toBe(1);
    } finally {
      await removeDeploy();
    }
  });

  // --- AC 5 (non-cancelable sub-case): swap ---------------------------------

  test('(AC5-swap) at swap the strip offers no cancel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const deploy: DeployRecord = {
      v: 1, stage: 'swap', runs: [], started: '2026-11-05T10:00:00.000Z',
    };
    await writeDeploy(deploy);

    try {
      await page.goto('/');
      await expect(page.getByTestId('deploy-strip')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('deploy-stage-swap')).toHaveAttribute('aria-current', 'step');
      await expect(page.getByTestId('deploy-cancel')).toHaveCount(0);
    } finally {
      await removeDeploy();
    }
  });

  // --- AC 6: restart ---------------------------------------------------------

  test('(AC6) at restart the strip says the restart ends the advisor session', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const deploy: DeployRecord = {
      v: 1, stage: 'restart', runs: [], started: '2026-11-05T10:00:00.000Z',
    };
    await writeDeploy(deploy);

    try {
      await page.goto('/');
      const strip = page.getByTestId('deploy-strip');
      await expect(strip).toBeVisible({ timeout: 15000 });
      await expect(strip).toContainText(/restart/i);
      await expect(strip).toContainText(/advisor/i);
    } finally {
      await removeDeploy();
    }
  });

  // --- AC 7 (failed sub-case) ------------------------------------------------

  test('(AC7-failed) at failed the error text shows', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const deploy: DeployRecord = {
      v: 1, stage: 'failed', runs: [], started: '2026-11-05T10:00:00.000Z',
      error: 'gate: eval failed',
    };
    await writeDeploy(deploy);

    try {
      await page.goto('/');
      await expect(page.getByText('gate: eval failed')).toBeVisible({ timeout: 15000 });
    } finally {
      await removeDeploy();
    }
  });

  // --- AC 7 (done sub-case) + D7 ---------------------------------------------

  test('(AC7-done) at done the strip shows done and the commit, with Deploy enabled', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const deploy: DeployRecord = {
      v: 1, stage: 'done', runs: [], started: '2026-11-05T10:00:00.000Z',
      commit: 'abc1234',
    };
    await writeDeploy(deploy);

    try {
      await page.goto('/');
      const strip = page.getByTestId('deploy-strip');
      await expect(strip).toBeVisible({ timeout: 15000 });
      await expect(strip.getByTestId('deploy-stage-done')).toHaveAttribute('aria-current', 'step');
      await expect(page.getByText('abc1234')).toBeVisible();
      await expect(page.getByTestId('deploy-button')).toBeEnabled();
    } finally {
      await removeDeploy();
    }
  });

  // --- A non-2xx answer --------------------------------------------------

  test('a POST answered 409 shows deploy-error', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const runId = 'e2e-deploy-409-live';
    const runDir = await writeRun(baseRun(runId, { status: 'running' }));

    try {
      await stubPost(page, '**/api/controller/deploy', 409, { error: 'deploy-open', stage: 'build' });

      await page.goto('/');
      const deployButton = page.getByTestId('deploy-button');
      await expect(deployButton).toBeVisible({ timeout: 15000 });
      await deployButton.click();

      const confirm = page.getByTestId('deploy-confirm');
      await expect(confirm).toBeVisible({ timeout: 15000 });
      await confirm.click();

      await expect(page.getByTestId('deploy-error')).toBeVisible({ timeout: 15000 });
    } finally {
      await removeRun(runDir);
    }
  });

  // --- AC 4: a deploy-held run --------------------------------------------

  test('(AC4) a deploy-held run reads "held for deploy" on its tile and offers no Resume', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const runId = 'e2e-deploy-held';
    const runDir = await writeRun(baseRun(runId, {
      status: 'paused',
      holdBy: 'deploy',
      pauseRequested: '2026-11-05T10:00:00.000Z',
      pausedAt: '2026-11-05T10:00:00.000Z',
    }));

    try {
      await page.goto('/');
      const tile = page.getByTestId(`run-tile-${runId}`);
      await expect(tile).toBeVisible({ timeout: 15000 });
      await expect(tile).toContainText('held for deploy');
      await expect(page.getByTestId(`run-resume-${runId}`)).toHaveCount(0);
      await expect(page.getByTestId(`run-pause-${runId}`)).toBeVisible();
    } finally {
      await removeRun(runDir);
    }
  });
});
