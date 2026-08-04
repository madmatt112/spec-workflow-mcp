import { defineConfig, devices } from '@playwright/test';
import { WORKTREE_SPEC_PATTERN } from './playwright.worktree-pattern.js';

export default defineConfig({
  testDir: './e2e',
  // The worktree suites belong to playwright.worktree.config.ts, which sets
  // SPEC_WORKFLOW_HOME. Run here they would register temporary worktrees in the
  // developer's real global registry, where the entries are permanently
  // unreapable under path translation.
  //
  // The same constant is playwright.worktree.config.ts's `testMatch`, so the
  // two configs cannot drift apart. See playwright.worktree-pattern.ts.
  testIgnore: WORKTREE_SPEC_PATTERN,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev:dashboard',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
