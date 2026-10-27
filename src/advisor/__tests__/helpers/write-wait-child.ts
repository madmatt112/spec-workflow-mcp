/**
 * Child process driver for push.test.ts's cross-process criterion (Requirement
 * 10.2: a wait written by another process, not the in-process `waitEvents`,
 * SHALL still be pushed; the watchdog's own `createWait` call,
 * scripts/sdd-watchdog.sh:185-201, is the real-world example this stands in
 * for). It writes exactly one open wait, through the real `createWait`
 * (src/controller/waits.ts), under the `SDD_HOME` the parent test passes in
 * its env, then exits.
 *
 * Usage: write-wait-child.ts <kind> <projectId> <spec> <questionId> <questionText>
 */
import { createWait } from '../../../controller/waits.js';
import type { WaitKind } from '../../../controller/state.js';

async function main(): Promise<void> {
  const [kind, projectId, spec, questionId, questionText] = process.argv.slice(2);
  if (!kind || !projectId || !spec || !questionId || !questionText) {
    throw new Error('write-wait-child: usage <kind> <projectId> <spec> <questionId> <questionText>');
  }
  await createWait({
    kind: kind as WaitKind,
    runId: 'child-process-run',
    projectId,
    spec,
    specDir: process.cwd(),
    questions: [{ id: questionId, text: questionText, options: ['A', 'B'] }],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    process.stderr.write(`${error?.stack || error}\n`);
    process.exit(1);
  });
