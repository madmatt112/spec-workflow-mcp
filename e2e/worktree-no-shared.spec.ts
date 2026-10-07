import { expect, test } from '@playwright/test';
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
    await harness.startMcpServers();
    registeredProjects = await harness.waitForProjects(2, 90000);
  });

  test.afterAll(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('shows both worktree projects as sidebar toggles without the project dropdown', async ({ page }) => {
    const projectA = getProjectByPathSuffix(registeredProjects, 'wt-a');
    const projectB = getProjectByPathSuffix(registeredProjects, 'wt-b');

    await page.goto('/');

    // Each registered worktree project is a sidebar toggle; the dropdown shell is gone.
    await expect(page.getByTestId(`project-toggle-${projectA.projectId}`)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId(`project-toggle-${projectB.projectId}`)).toBeVisible();

    await expect(page.locator('[data-testid^="project-dropdown"]')).toHaveCount(0);
  });
});
