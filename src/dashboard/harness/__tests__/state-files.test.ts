import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { stateHome, sddHome } from '../state-files.js';

// Contract for src/dashboard/harness/state-files.ts (design.md C2;
// controller-design.md §3). The pointer, launch-record and log path functions
// went with the supervisor launcher at step (d) of the foundation rework; the
// two path functions the controller still uses stay.
//
// Criterion "stateHome and sddHome read the environment when called":
//   Pre-condition: XDG_STATE_HOME set to a temp dir; SDD_HOME unset, then set.
//   Test: stateHome(), sddHome().
//   Observable result: stateHome() is the temp dir; sddHome() is `<temp>/sdd`
//   without SDD_HOME and the SDD_HOME value with it.
//
// Criterion "defaults to the home directory when the env vars are unset":
//   Pre-condition: XDG_STATE_HOME and SDD_HOME unset (the test-home guard is
//   opted out for this one case).
//   Observable result: stateHome() is `~/.local/state`; sddHome() is
//   `~/.local/state/sdd`.

describe('state-files', () => {
  let originalXdg: string | undefined;
  let originalSdd: string | undefined;
  let tempXdg: string;

  beforeEach(async () => {
    originalXdg = process.env.XDG_STATE_HOME;
    originalSdd = process.env.SDD_HOME;
    tempXdg = await fsp.mkdtemp(join(tmpdir(), 'state-files-xdg-'));
  });

  afterEach(async () => {
    if (originalXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = originalXdg;
    if (originalSdd === undefined) delete process.env.SDD_HOME;
    else process.env.SDD_HOME = originalSdd;
    delete process.env.SDD_TEST_ALLOW_REAL_HOME;
    await fsp.rm(tempXdg, { recursive: true, force: true });
  });

  it('reads XDG_STATE_HOME and SDD_HOME when set', () => {
    process.env.XDG_STATE_HOME = tempXdg;
    delete process.env.SDD_HOME;

    expect(stateHome()).toBe(tempXdg);
    expect(sddHome()).toBe(join(tempXdg, 'sdd'));

    process.env.SDD_HOME = join(tempXdg, 'elsewhere');
    expect(sddHome()).toBe(join(tempXdg, 'elsewhere'));
  });

  it('defaults to the home directory when the env vars are unset', () => {
    delete process.env.XDG_STATE_HOME;
    delete process.env.SDD_HOME;
    // This case deliberately resolves to the real home, so opt out of the
    // test-home guard (src/core/test-home-guard.ts) for its assertions.
    process.env.SDD_TEST_ALLOW_REAL_HOME = '1';

    expect(stateHome()).toBe(join(homedir(), '.local', 'state'));
    expect(sddHome()).toBe(join(homedir(), '.local', 'state', 'sdd'));
  });
});
