import { expect, test, type Page } from '@playwright/test';
import { appendFile, mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { RegisteredProject, WorktreeHarness, resetSpecWorkflowHome } from './helpers/worktree-harness';
import { DeferralStorage } from '../src/core/deferral-storage.js';
import { sddHome } from '../src/dashboard/harness/state-files.js';
import { secretPath } from '../src/controller/access.js';
import type { PrRead, RunRecord } from '../src/controller/state.js';

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

// A spawn.start/spawn.end pair carrying every W field, so its W is known
// (design C1; the usage-rows test's `knownSpawn`): input 100, output 10,
// cacheRead 20, cacheWrite5m 8, cacheWrite1h 4 weighs 170.
const KNOWN_SPAWN: Array<Record<string, string>> = [
  { ts: '2026-01-01T00:00:00.000Z', type: 'spawn.start', agent: 'sdd-drafter', phase: 'requirements' },
  { ts: '2026-01-01T00:00:01.000Z', type: 'spawn.end', agent: 'sdd-drafter', tokens: '142', input: '100', output: '10', cacheRead: '20', cacheWrite5m: '8', cacheWrite1h: '4' },
];

/**
 * Seed one closed spec under a worktree's `.spec-workflow` (task 14): a tasks.md
 * (two tasks), a known-W ledger and a `## Phase log` closeout/closed row dated
 * `date`. For project A the phase log is appended to the existing HANDOFF (which
 * already routes to spec-a); project B has no HANDOFF, so one is written.
 */
async function seedClosedSpec(
  projectPath: string,
  spec: string,
  date: string,
  opts: { appendHandoff: boolean },
): Promise<void> {
  const workflowRoot = join(projectPath, '.spec-workflow');
  const specDir = join(workflowRoot, 'specs', spec);
  await mkdir(specDir, { recursive: true });
  await writeFile(join(specDir, 'tasks.md'), '- [ ] 1. first task\n- [ ] 2. second task\n', 'utf-8');
  await writeFile(
    join(specDir, 'harness-events.jsonl'),
    KNOWN_SPAWN.map((e) => JSON.stringify(e)).join('\n') + '\n',
    'utf-8',
  );
  const phaseLog = [
    '',
    '## Phase log',
    '',
    '| Date | Spec | Stage | State | Result | Note |',
    '| --- | --- | --- | --- | --- | --- |',
    `| ${date} | ${spec} | closeout | complete | closed | done |`,
    '',
  ].join('\n');
  const handoff = join(workflowRoot, 'HANDOFF.md');
  if (opts.appendHandoff) {
    await appendFile(handoff, phaseLog, 'utf-8');
  } else {
    await writeFile(handoff, '# HANDOFF\n' + phaseLog, 'utf-8');
  }
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

    // Seed the three views' fixtures (task 14). The usage route and the
    // deferrals REST route read the disk at request time, and the controller
    // feed re-reads the run records on every client connect, so this seeding
    // after registration is visible to each page when it loads.

    // A done controller run for project A with two PR reads: the run's own PR
    // (merged, with a sha) and a close-out PR (blocked, with two reasons).
    const prReads: PrRead[] = [
      {
        kind: 'run', repo: 'alpha-service', number: 42,
        url: 'https://example.test/alpha/pull/42',
        ci: 'green', mergeable: 'MERGEABLE', verdict: 'merged',
        reasons: ['all required checks passed'],
        newDependencies: ['left-pad', 'ms'],
        sha: 'cafef00d1234567', at: '2026-10-06T10:05:00.000Z',
      },
      {
        kind: 'closeout', repo: 'beta-service', number: 7,
        ci: 'red', mergeable: 'CONFLICTING', verdict: 'blocked',
        reasons: ['conflicts with the base branch', 'a required check is failing'],
        at: '2026-10-06T10:06:00.000Z',
      },
    ];
    const runRecord: RunRecord = {
      v: 1, id: 'e2e-pr-panel', project: projectA.projectId,
      codeRoot: projectA.projectPath, specStore: projectA.projectPath,
      spec: 'spec-a', worktree: projectA.projectPath, branch: 'feat/spec-a',
      status: 'done', created: '2026-10-06T10:00:00.000Z', updated: '2026-10-06T10:06:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      prReads,
    };
    const runDir = join(sddHome(), 'runs', runRecord.id);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2) + '\n', 'utf-8');

    // Three deferrals in project A: owner matthew, owner harness, and none.
    const storageA = new DeferralStorage(projectA.projectPath);
    const baseDeferral = {
      originSpec: 'spec-a', originPhase: 'design' as const,
      revisitTrigger: 'when the next spec starts', tags: [] as string[],
      supersedes: null as string | null,
      body: { context: 'ctx', decision: 'dec', revisitCriteria: 'crit' },
    };
    await storageA.create({ ...baseDeferral, title: 'Owned by matthew', owner: 'matthew' });
    await storageA.create({ ...baseDeferral, title: 'Owned by harness', owner: 'harness' });
    await storageA.create({ ...baseDeferral, title: 'No owner recorded' });

    // A closed spec in each project; only project A has a baseline-w-per-task.
    await seedClosedSpec(projectA.projectPath, 'closed-alpha', '2026-03-10', { appendHandoff: true });
    await writeFile(
      join(projectA.projectPath, '.spec-workflow', 'agent-rules.md'),
      '# agent-rules\nbaseline-w-per-task: 85\n',
      'utf-8',
    );
    await seedClosedSpec(projectB.projectPath, 'closed-beta', '2026-02-10', { appendHandoff: false });
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

  test('(R1) the Run page shows the PR panel with both reads, the sha, reasons and CI chips', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Open the run from the Runs list — the operator's own path in. The Runs
    // page makes no harness subscription, so its `controller-runs` arrives on the
    // overview feed like the Now page's; its row (and the panel's Open-run
    // button) are the DOM signal that the run reached the shared shell state,
    // which the run page then reuses (ShellProvider stays mounted throughout).
    await page.goto('/#/runs');
    await page.getByTestId('ctrl-run-row-e2e-pr-panel').click({ timeout: 15000 });
    await page.getByTestId('ctrl-open-run').click();

    await expect(page.getByTestId('pr-panel')).toBeVisible({ timeout: 15000 });

    const runRow = page.getByTestId('pr-row-alpha-service-42');
    const closeoutRow = page.getByTestId('pr-row-beta-service-7');
    await expect(runRow).toBeVisible();
    await expect(closeoutRow).toBeVisible();

    // The merged row shows the first 7 characters of the merge sha.
    await expect(runRow).toContainText('cafef00');

    // One CI chip per read, coloured by state.
    await expect(page.getByTestId('pr-ci-alpha-service-42')).toHaveText('green');
    await expect(page.getByTestId('pr-ci-beta-service-7')).toHaveText('red');

    // Each reason of the blocked close-out read is its own line.
    await expect(closeoutRow).toContainText('conflicts with the base branch');
    await expect(closeoutRow).toContainText('a required check is failing');

    // (R4) the read that adds a dependency shows the chip and the names joined
    // by ", "; the read without the field shows no chip.
    await expect(page.getByTestId('pr-deps-alpha-service-42')).toHaveText('new dependency');
    await expect(runRow).toContainText('left-pad, ms');
    await expect(page.getByTestId('pr-deps-beta-service-7')).toHaveCount(0);
  });

  test('(R2) the Deferrals page owner chip counts, filters by AND and shows the owner', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/deferrals');

    // Project A's three deferrals; project B has none.
    const rows = page.locator('[data-testid^="deferral-row-"]');
    await expect(rows).toHaveCount(3, { timeout: 15000 });

    // The matthew owner chip counts exactly the one matthew-owned record.
    await expect(page.getByTestId('chip-matthew')).toContainText('1');

    // Selecting it leaves only the matthew-owned row.
    await page.getByTestId('chip-matthew').click();
    await expect(rows).toHaveCount(1);

    // The panel shows the Owner.
    await rows.first().click();
    const panel = page.getByTestId('deferral-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Owner');
    await expect(panel).toContainText('matthew');

    // Status chips AND with owner chips: the matthew record is `deferred`, so
    // also selecting `resolved` (an OR would keep it) leaves no row.
    await page.getByTestId('chip-resolved').click();
    await expect(rows).toHaveCount(0);
  });

  test('(R3) the Usage page shows both projects, no placeholder, two trend lines and one baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/usage');

    await expect(page.getByTestId('usage-closed-specs')).toBeVisible({ timeout: 15000 });
    // The placeholder is gone.
    await expect(page.getByTestId('usage-placeholder')).toHaveCount(0);

    // Both projects' closed specs show as rows.
    await expect(page.getByTestId(`usage-row-${projectA.projectId}-closed-alpha`)).toBeVisible();
    await expect(page.getByTestId(`usage-row-${projectB.projectId}-closed-beta`)).toBeVisible();

    // One trend line per plotted project, one dashed baseline (project A only).
    await expect(page.locator('[data-testid^="trend-line-"]')).toHaveCount(2);
    await expect(page.locator('[data-testid^="trend-baseline-"]')).toHaveCount(1);
  });

  test('no page scrolls sideways at widths 1000 and 375', async ({ page }) => {
    const markerFor = (path: string) => (path === '/usage' ? 'usage-closed-specs' : 'page-list');

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

  // --- Pause note text (design C8; Requirement 6 AC 3/AC4/AC5) ---------------
  // Each test seeds its own run.json, as the PR-panel seed at lines 164-174
  // does, and removes it at the end so later tests see a clean run list.

  test('(R5) an applied operator pause reads "paused by you" with no resume part', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const runId = 'e2e-pause-applied';
    const runRecord: RunRecord = {
      v: 1, id: runId, project: projectA.projectId,
      codeRoot: projectA.projectPath, specStore: projectA.projectPath,
      spec: 'spec-a', worktree: projectA.projectPath, branch: 'feat/spec-a',
      status: 'paused', pauseReason: 'operator',
      // Carries pauseRequested so the (inactive, in this harness) scheduler
      // never reads this as a withdrawn hold and starts it.
      pauseRequested: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      pausedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      created: '2026-10-29T10:00:00.000Z', updated: '2026-10-29T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    const runDir = join(sddHome(), 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2) + '\n', 'utf-8');

    await page.goto('/#/runs');
    const note = page.getByTestId(`ctrl-run-pause-${runId}`);
    await expect(note).toBeVisible({ timeout: 15000 });
    await expect(note).toHaveText(/^paused by you/);
    await expect(note).not.toContainText('resumes in');

    await rm(runDir, { recursive: true, force: true });
  });

  test('(R5) a pending pause on a waiting run shows "pause requested"', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const runId = 'e2e-pause-pending-waiting';
    const runRecord: RunRecord = {
      v: 1, id: runId, project: projectA.projectId,
      codeRoot: projectA.projectPath, specStore: projectA.projectPath,
      spec: 'spec-a', worktree: projectA.projectPath, branch: 'feat/spec-a',
      // Waiting with no wait record: a pending hold on an open gate, with
      // nothing for this harness's inactive scheduler to act on.
      status: 'waiting',
      pauseRequested: new Date(Date.now() - 30 * 1000).toISOString(),
      created: '2026-10-29T10:00:00.000Z', updated: '2026-10-29T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    const runDir = join(sddHome(), 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2) + '\n', 'utf-8');

    await page.goto('/#/runs');
    const note = page.getByTestId(`ctrl-run-pause-${runId}`);
    await expect(note).toBeVisible({ timeout: 15000 });
    await expect(note).toContainText('pause requested');

    await rm(runDir, { recursive: true, force: true });
  });

  // Regression guard (Requirement 6 AC 5, holds at base): a usage-reason pause
  // keeps today's note and "resumes in", unchanged by C8's new pending/applied
  // cases. Uses `usage-limit`, never `usage-window`, so no real rate-limit
  // window logic treats this seed as live.
  test('(R5) a usage-limit pause keeps its "resumes in" note', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const runId = 'e2e-pause-usage';
    const runRecord: RunRecord = {
      v: 1, id: runId, project: projectA.projectId,
      codeRoot: projectA.projectPath, specStore: projectA.projectPath,
      spec: 'spec-a', worktree: projectA.projectPath, branch: 'feat/spec-a',
      status: 'paused', pauseReason: 'usage-limit',
      pausedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      resumeAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      created: '2026-10-29T10:00:00.000Z', updated: '2026-10-29T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    const runDir = join(sddHome(), 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2) + '\n', 'utf-8');

    await page.goto('/#/runs');
    const note = page.getByTestId(`ctrl-run-pause-${runId}`);
    await expect(note).toBeVisible({ timeout: 15000 });
    await expect(note).toContainText('usage-limit');
    await expect(note).toContainText('resumes in');

    await rm(runDir, { recursive: true, force: true });
  });

  // --- Pause and Resume buttons (design C9; Requirement 6 AC 1 to AC 4) ------
  // Each test seeds its own run.json, as the pause-note tests above do, and
  // removes it at the end. The row-click test performs a real mutation
  // through the pause route, so it logs in first, the same way
  // worktree-visual.spec.ts's `login` does; the mocked-failure test never
  // reaches the server, so it needs no session.

  async function login(page: Page): Promise<void> {
    const secret = (await readFile(secretPath(), 'utf-8')).trim();
    await page.context().request.post('/api/login', { data: { secret } });
  }

  test('(R6) clicking the row Pause of an unheld waiting run selects nothing and opens no panel, then the row shows the pending note with no Pause button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);

    const runId = 'e2e-pause-row-click';
    const runRecord: RunRecord = {
      v: 1, id: runId, project: projectA.projectId,
      codeRoot: projectA.projectPath, specStore: projectA.projectPath,
      spec: 'spec-a', worktree: projectA.projectPath, branch: 'feat/spec-a',
      // Unheld waiting, with no wait record: the same safe seed shape as the
      // pending-pause note test above, minus pauseRequested.
      status: 'waiting',
      created: '2026-10-29T10:00:00.000Z', updated: '2026-10-29T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    const runDir = join(sddHome(), 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2) + '\n', 'utf-8');

    await page.goto('/#/runs');
    const row = page.getByTestId(`ctrl-run-row-${runId}`);
    await expect(row).toBeVisible({ timeout: 15000 });
    const pauseButton = page.getByTestId(`ctrl-row-pause-${runId}`);
    await expect(pauseButton).toBeVisible();

    await pauseButton.click();

    await expect(row).toHaveAttribute('data-selected', 'false');
    await expect(page.getByTestId('ctrl-run-panel')).toHaveCount(0);

    await expect(pauseButton).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByTestId(`ctrl-run-pause-${runId}`)).toContainText('pause requested', { timeout: 15000 });

    await rm(runDir, { recursive: true, force: true });
  });

  test('(R6) a failed row Pause shows "pause failed (500)" in a role alert and opens no panel', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const runId = 'e2e-pause-row-fail';
    const runRecord: RunRecord = {
      v: 1, id: runId, project: projectA.projectId,
      codeRoot: projectA.projectPath, specStore: projectA.projectPath,
      spec: 'spec-a', worktree: projectA.projectPath, branch: 'feat/spec-a',
      status: 'waiting',
      created: '2026-10-29T10:00:00.000Z', updated: '2026-10-29T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    const runDir = join(sddHome(), 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2) + '\n', 'utf-8');

    await page.goto('/#/runs');
    const row = page.getByTestId(`ctrl-run-row-${runId}`);
    await expect(row).toBeVisible({ timeout: 15000 });

    await page.route(`**/api/controller/runs/${runId}/pause`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) }),
    );

    await page.getByTestId(`ctrl-row-pause-${runId}`).click();

    await expect(row.getByRole('alert')).toContainText('pause failed (500)', { timeout: 15000 });
    await expect(page.getByTestId('ctrl-run-panel')).toHaveCount(0);

    await rm(runDir, { recursive: true, force: true });
  });

  test('(R6) a held operator-paused run panel shows Resume (operator) and no Resume now', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const runId = 'e2e-pause-panel-operator';
    const runRecord: RunRecord = {
      v: 1, id: runId, project: projectA.projectId,
      codeRoot: projectA.projectPath, specStore: projectA.projectPath,
      spec: 'spec-a', worktree: projectA.projectPath, branch: 'feat/spec-a',
      status: 'paused', pauseReason: 'operator',
      pauseRequested: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      pausedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      created: '2026-10-29T10:00:00.000Z', updated: '2026-10-29T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    const runDir = join(sddHome(), 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2) + '\n', 'utf-8');

    await page.goto('/#/runs');
    await page.getByTestId(`ctrl-run-row-${runId}`).click();
    await expect(page.getByTestId('ctrl-run-panel')).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId('ctrl-resume-operator')).toBeVisible();
    await expect(page.getByTestId('ctrl-resume')).toHaveCount(0);

    await rm(runDir, { recursive: true, force: true });
  });

  // Regression guard (task 8 Note, holds at base): any `paused` run already
  // shows Resume now before this task, so this case stays green throughout.
  test('(R6) a usage-limit paused run panel shows Resume now', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    const runId = 'e2e-pause-panel-usage';
    const runRecord: RunRecord = {
      v: 1, id: runId, project: projectA.projectId,
      codeRoot: projectA.projectPath, specStore: projectA.projectPath,
      spec: 'spec-a', worktree: projectA.projectPath, branch: 'feat/spec-a',
      status: 'paused', pauseReason: 'usage-limit',
      pausedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      resumeAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      created: '2026-10-29T10:00:00.000Z', updated: '2026-10-29T10:00:00.000Z',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    const runDir = join(sddHome(), 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2) + '\n', 'utf-8');

    await page.goto('/#/runs');
    await page.getByTestId(`ctrl-run-row-${runId}`).click();
    await expect(page.getByTestId('ctrl-run-panel')).toBeVisible({ timeout: 15000 });

    await expect(page.getByTestId('ctrl-resume')).toBeVisible();

    await rm(runDir, { recursive: true, force: true });
  });
});
