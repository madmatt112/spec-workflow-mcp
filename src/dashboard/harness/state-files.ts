// src/dashboard/harness/state-files.ts
//
// The harness home (design.md C2; controller-design.md §3). Every path function
// reads the environment when called, never at module load, so a test's temporary
// XDG_STATE_HOME and SDD_HOME apply. The active-run pointer, the launch records
// and the launch logs of the supervisor launcher went with step (d) of the
// foundation rework; the controller's run records are the state now.
import { homedir } from 'os';
import { join } from 'path';
import { guardTestHome } from '../../core/test-home-guard.js';

/** `$XDG_STATE_HOME` when it is a non-empty string, else `~/.local/state`. */
export function stateHome(): string {
  const env = process.env.XDG_STATE_HOME;
  const resolved = env && env.length > 0 ? env : join(homedir(), '.local', 'state');
  guardTestHome(resolved, 'stateHome');
  return resolved;
}

/**
 * The harness home: `$SDD_HOME` when it is a non-empty string, else
 * `<state home>/sdd` (the existing rule). Default `~/.local/state/sdd`
 * (docs/bootstrap-decomposition-draft.md). Additive and backward-compatible:
 * callers that do not set `SDD_HOME` are unaffected.
 */
export function sddHome(): string {
  const env = process.env.SDD_HOME;
  return env && env.length > 0 ? env : join(stateHome(), 'sdd');
}
