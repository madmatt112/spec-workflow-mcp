import { expect, test } from '@playwright/test';
import { RegisteredProject, WorktreeHarness, resetSpecWorkflowHome } from './helpers/worktree-harness';

const DASHBOARD_API_BASE_URL = 'http://127.0.0.1:5084';

/**
 * Shared-mode worktree coverage (requirements 7.2, 7.3).
 *
 * This file currently pins the harness contract the dashboard scenarios are
 * built on: workspace inference fires in a real spawned server, and the two
 * roots settle apart — workspace on the worktree, workflow root on the main
 * checkout, which is the only place a `.spec-workflow` exists here.
 */
test.describe.serial('Shared worktree specs', () => {
  test.setTimeout(180000);

  let harness: WorktreeHarness;
  let registeredProjects: RegisteredProject[];

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(180000);

    const specWorkflowHome = process.env.SPEC_WORKFLOW_HOME;
    if (!specWorkflowHome) {
      // Hard stop rather than a fallback: without the override the spawned
      // servers register temp worktrees in the developer's real global
      // registry, where they are permanently unreapable under path
      // translation. Run this suite with playwright.worktree.config.ts.
      throw new Error('SPEC_WORKFLOW_HOME must be set by playwright.worktree.config.ts');
    }

    await resetSpecWorkflowHome(specWorkflowHome);

    harness = new WorktreeHarness({
      serverRoot: process.cwd(),
      dashboardApiBaseUrl: DASHBOARD_API_BASE_URL,
      specWorkflowHome,
      mode: 'shared',
      // Both layouts: `wt-a` beside the main checkout, `wt-nested` under it —
      // the layout in which the shared workflow root contains the worktree.
      worktrees: [
        { name: 'wt-a', layout: 'sibling' },
        { name: 'wt-nested', layout: 'nested' }
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

  test('infers each worktree as its own workspace over a shared workflow root', async () => {
    const repoPath = harness.getRepoPath();

    for (const worktree of harness.getWorktrees()) {
      // Retained, not the rolling tail: this is startup output, and the
      // dashboard scenarios keep these servers alive and talking long enough to
      // evict it from a MAX_LOG_LINES window.
      const logs = harness.getResolutionLogsFor(worktree.name);
      expect(logs, `inference log for ${worktree.name}`).toContain(
        'Workspace inferred from the working directory.'
      );
      expect(logs).toContain(`workspacePath=${worktree.path}`);
      expect(logs).toContain(`workflowRootPath=${repoPath}`);
    }

    const entries = await harness.readRegistry();
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.workflowRootPath).toBe(repoPath);
    }
    expect(entries.map((entry) => entry.projectPath).sort())
      .toEqual(harness.getWorktrees().map((worktree) => worktree.path).sort());

    expect(registeredProjects.map((project) => project.projectPath).sort())
      .toEqual(harness.getWorktrees().map((worktree) => worktree.path).sort());
  });
});
