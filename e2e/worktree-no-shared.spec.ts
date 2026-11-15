import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { RegisteredProject, WorktreeHarness, resetSpecWorkflowHome } from './helpers/worktree-harness';

const DASHBOARD_API_BASE_URL = 'http://127.0.0.1:5084';

function getProjectByPathSuffix(projects: RegisteredProject[], suffix: string): RegisteredProject {
  const project = projects.find((entry) => entry.projectPath.endsWith(`/${suffix}`) || entry.projectPath.endsWith(`\\${suffix}`));
  if (!project) {
    throw new Error(`Project with path suffix "${suffix}" was not found in: ${JSON.stringify(projects, null, 2)}`);
  }
  return project;
}

test.describe.serial('No-shared worktree dashboard separation', () => {
  test.setTimeout(180000);

  let harness: WorktreeHarness;
  let registeredProjects: RegisteredProject[];

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180000);

    const specWorkflowHome = process.env.SPEC_WORKFLOW_HOME;
    if (!specWorkflowHome) {
      throw new Error('SPEC_WORKFLOW_HOME must be set by playwright.worktree.config.ts');
    }

    await resetSpecWorkflowHome(specWorkflowHome);

    harness = new WorktreeHarness({
      serverRoot: process.cwd(),
      dashboardApiBaseUrl: DASHBOARD_API_BASE_URL,
      specWorkflowHome,
      // Explicit: this suite covers `--no-shared-worktree-specs`, where each
      // worktree carries its own `.spec-workflow`. The fixture names are pinned
      // here rather than defaulted so the assertions below keep naming the
      // seeded spec and file directly.
      mode: 'no-shared',
      worktrees: [
        { name: 'wt-a', layout: 'sibling', specName: 'spec-a', sourceFile: 'src/service-a.ts' },
        { name: 'wt-b', layout: 'sibling', specName: 'spec-b', sourceFile: 'src/service-b.ts' }
      ]
    });

    await harness.setup();

    // Each worktree's decomposition names its own spec (D30), so its line
    // renders on the Specs page before any project toggle is exercised.
    const wtA = harness.getWorktree('wt-a');
    const wtB = harness.getWorktree('wt-b');
    await mkdir(join(wtA.path, '.spec-workflow', 'spec-decomposition'), { recursive: true });
    await writeFile(
      join(wtA.path, '.spec-workflow', 'spec-decomposition', 'decomposition.md'),
      '### 1. `spec-a`\n',
      'utf-8'
    );
    await mkdir(join(wtB.path, '.spec-workflow', 'spec-decomposition'), { recursive: true });
    await writeFile(
      join(wtB.path, '.spec-workflow', 'spec-decomposition', 'decomposition.md'),
      '### 1. `spec-b`\n',
      'utf-8'
    );

    await harness.startMcpServers();
    registeredProjects = await harness.waitForProjects(2, 90000);
  });

  test.afterAll(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('shows both worktree projects as gear switches without the project dropdown', async ({ page }) => {
    const projectA = getProjectByPathSuffix(registeredProjects, 'wt-a');
    const projectB = getProjectByPathSuffix(registeredProjects, 'wt-b');

    await page.goto('/');

    // Each registered worktree project is a switch in the gear panel; the dropdown shell is gone.
    await page.getByTestId('gear-toggle').click();
    await expect(page.getByTestId(`project-toggle-${projectA.projectId}`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`project-toggle-${projectB.projectId}`)).toBeVisible();

    await expect(page.locator('[data-testid^="project-dropdown"]')).toHaveCount(0);
  });

  test('specs page groups each worktree spec under its project and a toggle hides it', async ({ page }) => {
    const projectA = getProjectByPathSuffix(registeredProjects, 'wt-a');
    const projectB = getProjectByPathSuffix(registeredProjects, 'wt-b');

    await page.goto('/#/specs');

    // With both toggles on, each worktree's seeded spec shows under its project.
    const specLineA = page.getByTestId(`spec-line-${projectA.projectId}-spec-a`);
    const specLineB = page.getByTestId(`spec-line-${projectB.projectId}-spec-b`);
    await expect(specLineA).toBeVisible({ timeout: 15000 });
    await expect(specLineB).toBeVisible();

    // Toggling project B off hides its line and keeps project A's. The
    // toggle lives in the gear panel, so it opens first.
    await page.getByTestId('gear-toggle').click();
    await page.getByTestId(`project-toggle-${projectB.projectId}`).click();
    await expect(specLineB).toHaveCount(0);
    await expect(specLineA).toBeVisible();
  });
});
