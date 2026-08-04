import { defineConfig, devices } from '@playwright/test';
import { join } from 'path';
import { tmpdir } from 'os';
import { WORKTREE_SPEC_PATTERN } from './playwright.worktree-pattern.js';

const DASHBOARD_PORT = 5084;
const FRONTEND_PORT = 5184;
const SPEC_WORKFLOW_HOME = process.env.SPEC_WORKFLOW_HOME || join(tmpdir(), 'specwf-e2e-worktree-state');

// Share the same global state path between test workers and spawned web servers.
process.env.SPEC_WORKFLOW_HOME = SPEC_WORKFLOW_HOME;

export default defineConfig({
  testDir: './e2e',
  // A pattern, not a filename. Pinning one file by name means the next
  // worktree suite silently never runs here — and *does* run under the default
  // config, which sets no SPEC_WORKFLOW_HOME, so its temp worktrees land in the
  // developer's real global registry.
  //
  // The same constant is playwright.config.ts's `testIgnore`, so the two
  // configs cannot drift apart. See playwright.worktree-pattern.ts.
  testMatch: WORKTREE_SPEC_PATTERN,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: `http://127.0.0.1:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'on',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `npm run dev -- --dashboard --no-open --port ${DASHBOARD_PORT}`,
      url: `http://127.0.0.1:${DASHBOARD_PORT}/api/test`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        ...process.env,
        SPEC_WORKFLOW_HOME
      }
    },
    {
      command: `npm run dev:dashboard -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      url: `http://127.0.0.1:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        ...process.env,
        SPEC_WORKFLOW_HOME,
        VITE_DASHBOARD_PORT: String(DASHBOARD_PORT)
      }
    }
  ]
});
