// vitest.setup.ts
//
// Global test setup (wired into vitest.config.ts `setupFiles`). Before any test
// module runs, point the harness home environment variables at per-worker temp
// directories, so a test that starts the Controller, the dashboard server or
// the HarnessLauncher never writes into the operator's real
// `~/.local/state/sdd` or `~/.spec-workflow-mcp`.
//
// The home resolvers read these variables at call time (see state-files.ts and
// global-dir.ts), so setting them here — before the test file is imported and
// captures its own `originalEnv` snapshot — means both the live resolution and
// any env-restoring afterEach fall back to a temp directory, never the real
// home. The paired guard in src/core/test-home-guard.ts fails loudly if one
// still leaks.
import { mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const worker = process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? '0';
const root = join(tmpdir(), `swm-test-home-${process.pid}-${worker}`);

const dirs = {
  SDD_HOME: join(root, 'sdd-home'),
  SPEC_WORKFLOW_HOME: join(root, 'spec-workflow-mcp'),
  XDG_STATE_HOME: join(root, 'xdg-state'),
};

for (const [key, dir] of Object.entries(dirs)) {
  mkdirSync(dir, { recursive: true });
  process.env[key] = dir;
}

// Remove the worker's temp root when the worker process exits. Registered once
// per worker; `process.on('exit')` handlers must be synchronous.
if (!(globalThis as { __swmHomeCleanup__?: boolean }).__swmHomeCleanup__) {
  (globalThis as { __swmHomeCleanup__?: boolean }).__swmHomeCleanup__ = true;
  process.on('exit', () => {
    try {
      rmSync(root, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });
}
