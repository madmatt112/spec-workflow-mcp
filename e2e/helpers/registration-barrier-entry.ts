/**
 * Server entry point with a stdin barrier immediately before registration.
 *
 * The port of `src/core/__tests__/helpers/registry-lock-child.ts` to the e2e
 * harness (requirement 6.2). That child prints `ready` once its imports resolve
 * and then blocks on stdin so the parent can release every contender at the same
 * instant, putting process startup *outside* the contention window. Without it a
 * "simultaneous" start is not simultaneous at all: two `spawn`ed node processes
 * reach the registry read-modify-write tens of milliseconds apart while the
 * section itself is a couple of milliseconds wide, so a missing lock is detected
 * only about one start in ten and the scenario has to buy its confidence with
 * repetition.
 *
 * Releasing at process *start* would not be enough here — unlike the unit
 * child, a real server still has to transpile `src/index.ts`, resolve its
 * workspace through several `git rev-parse` subprocesses and initialize the
 * workflow root before it registers, and that prefix reintroduces the skew. So
 * the barrier is installed on `ProjectRegistry.prototype.registerProject`
 * instead, which is the exact call the lock protects: every server does all of
 * its startup work, parks one statement short of the critical section, and is
 * released from there.
 *
 * Nothing about the server under test changes. It is the real `src/index.ts`,
 * with the real arguments, doing the real inference — this module only adds a
 * pause, and only in the process it launches.
 *
 * Blocking on stdin is safe at this point precisely because registration
 * happens *before* `StdioServerTransport` is connected (`src/server.ts:193`
 * versus `:238`): the MCP transport has not attached to stdin yet, so the single
 * release byte consumed here can never be taken out of the JSON-RPC stream.
 *
 * Usage: `node <tsx cli> registration-barrier-entry.ts <server args...>`
 */
import { fileURLToPath } from 'url';
import { ProjectRegistry } from '../../src/core/project-registry.js';

/**
 * Printed on stdout once this process is parked on the barrier.
 *
 * Kept in sync by hand with `REGISTRATION_BARRIER_READY` in
 * `worktree-harness.ts`, which is what waits for it. The harness cannot import
 * the constant from here: importing this module *starts a server*.
 */
const READY_MARKER = 'registration-barrier: ready to register';

/**
 * Parks until the parent's release, then until the instant it named.
 *
 * The release line is `go <epoch millis>`, and honouring the timestamp rather
 * than the arrival is what keeps the barrier tight on a busy machine. Waking N
 * processes from a blocking read is N scheduling decisions, and on a saturated
 * host they can land tens of milliseconds apart — wide enough for one contender
 * to finish the whole read-modify-write before the next is even runnable, which
 * is the skew the barrier exists to remove. Every contender instead converges on
 * one wall-clock instant, so the wake-up latency is absorbed by the lead time
 * and only the final millisecond has to be shared.
 *
 * A late message degrades to releasing immediately, which is no worse than not
 * having the timestamp at all.
 */
function waitForGo(): Promise<void> {
  return new Promise<number>((resolve) => {
    process.stdin.setEncoding('utf-8');
    process.stdin.once('data', (chunk: string) => {
      // Paused again immediately so the byte after the release — if a suite ever
      // writes one — is left for the MCP transport that attaches later.
      process.stdin.pause();
      resolve(Number(String(chunk).trim().split(/\s+/)[1]));
    });
    process.stdout.write(`${READY_MARKER}\n`);
  }).then(async (releaseAt) => {
    if (!Number.isFinite(releaseAt)) {
      return;
    }
    // Coarse first so the process is not burning a core it has to share with
    // the other contenders, then a spin for the last few milliseconds.
    while (Date.now() < releaseAt - 5) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    while (Date.now() < releaseAt) {
      // Deliberately empty: already runnable, waiting only for the clock.
    }
  });
}

const originalRegisterProject = ProjectRegistry.prototype.registerProject;
let released = false;

ProjectRegistry.prototype.registerProject = async function (
  this: ProjectRegistry,
  ...args: Parameters<typeof originalRegisterProject>
): Promise<string> {
  if (!released) {
    released = true;
    await waitForGo();
  }
  return originalRegisterProject.apply(this, args);
};

// `src/index.ts` runs `main()` only when `process.argv[1]` resolves to itself
// (`src/index.ts:584-589`), so importing it from here would otherwise load the
// module and do nothing at all. Claiming the entrypoint is what starts the
// server; `argv.slice(2)` — the server's own arguments — is left untouched.
process.argv[1] = fileURLToPath(new URL('../../src/index.ts', import.meta.url));

await import('../../src/index.js');
