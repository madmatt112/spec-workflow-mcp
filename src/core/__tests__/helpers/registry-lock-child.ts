/**
 * Child process driver for the registry lock's concurrency tests.
 *
 * Real mutual exclusion cannot be demonstrated from one event loop: sequential
 * `await`s in a single process serialise themselves regardless of the lock, so
 * such a test passes with the lock removed and proves nothing. Each contender
 * here is a separate OS process with its own file descriptors.
 *
 * Protocol: the child prints `ready` once its imports are resolved, then blocks
 * on stdin. The parent releases every child at once by writing to each stdin,
 * so process startup (~0.5s under tsx) is outside the contention window.
 *
 * Usage:
 *   registry-lock-child.ts register <workspacePath> <workflowRootPath>
 *   registry-lock-child.ts critical <lockPath> <logPath> <holdMs>
 */
import { promises as fs } from 'fs';
import { ProjectRegistry } from '../../project-registry.js';
import { withRegistryLock } from '../../registry-lock.js';

function waitForGo(): Promise<void> {
  return new Promise(resolve => {
    process.stdin.setEncoding('utf-8');
    process.stdin.once('data', () => {
      process.stdin.pause();
      resolve();
    });
    process.stdout.write('ready\n');
  });
}

async function main(): Promise<string> {
  const [mode, ...args] = process.argv.slice(2);
  await waitForGo();

  if (mode === 'register') {
    const [workspacePath, workflowRootPath] = args;
    const registry = new ProjectRegistry();
    const projectId = await registry.registerProject(workspacePath, process.pid, { workflowRootPath });
    return `done ${projectId}`;
  }

  if (mode === 'critical') {
    const [lockPath, logPath, holdMs] = args;
    const result = await withRegistryLock(lockPath, async () => {
      // O_APPEND writes of this size are atomic, so an interleaving in the log
      // is an interleaving of the critical sections, not of the writes.
      await fs.appendFile(logPath, `enter ${process.pid}\n`, 'utf-8');
      await new Promise(resolve => setTimeout(resolve, Number(holdMs)));
      await fs.appendFile(logPath, `exit ${process.pid}\n`, 'utf-8');
    });
    return `done ${result.acquired ? 'acquired' : 'not-acquired'}`;
  }

  throw new Error(`registry-lock-child: unknown mode ${mode}`);
}

// Exit explicitly once stdout has flushed: the stdin handle keeps the event
// loop alive otherwise and the parent waits forever for the exit event.
main()
  .then(message => process.stdout.write(`${message}\n`, () => process.exit(0)))
  .catch(error => process.stderr.write(`${error?.stack || error}\n`, () => process.exit(1)));
