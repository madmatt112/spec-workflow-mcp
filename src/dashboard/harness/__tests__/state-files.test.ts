import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir, homedir } from 'os';
import { getGlobalDir } from '../../../core/global-dir.js';
import {
  stateHome,
  pointerPath,
  harnessStateDir,
  launchesDir,
  logsDir,
  readPointer,
  removePointerLine,
} from '../state-files.js';

// Contract for src/dashboard/harness/state-files.ts (design.md C2; task 2
// _Prompt; Requirements 3.4, 3.7, 3.13, 5.5, 5.7).
//
// Criterion "env override" (design.md C2 interfaces: stateHome() =
//   process.env.XDG_STATE_HOME || join(homedir(), '.local/state');
//   harnessStateDir() = join(getGlobalDir(), 'harness'); "every path function
//   reads the environment when called"):
//   Pre-condition: XDG_STATE_HOME and SPEC_WORKFLOW_HOME set to distinct temp
//   dirs.
//   Call: stateHome(), pointerPath(), harnessStateDir(),
//   launchesDir(), logsDir().
//   Observable result: each equals the set env var joined with the literal
//   sub-path the design names (sdd/active-run, harness, harness/launches,
//   harness/logs).
//   Expected-value source: design.md C2 (lines 51-52).
//
// Criterion "home default" (design.md C2, same interfaces' default branch):
//   Pre-condition: XDG_STATE_HOME and SPEC_WORKFLOW_HOME deleted from env.
//   Call: the same six functions.
//   Observable result: each equals homedir()/.local/state (or
//   getGlobalDir()'s own default) joined with the same literal sub-paths.
//   Expected-value source: harness/hooks/sdd-activity.sh:11 (stateHome
//   default) and src/core/global-dir.ts:40-51 (harnessStateDir default,
//   read directly via the real getGlobalDir()).
//
// Criterion "readPointer on a missing file" (task 2 _Prompt: "returns an
//   empty array for a missing file"):
//   Pre-condition: path under a temp dir that is never created.
//   Call: readPointer(path).
//   Observable result: [].
//   Expected-value source: the _Prompt sentence.
//
// Criterion "readPointer on a malformed line" (task 2 _Prompt: "drops a line
//   without three non-empty fields"):
//   Pre-condition: a pointer file with two well-formed tab-separated lines
//   and two malformed ones (too few fields; an empty third field).
//   Call: readPointer(path).
//   Observable result: only the two well-formed lines come back as
//   { mainCheckout, specDir, runId }, in file order.
//   Expected-value source: the _Prompt sentence.
//
// Criterion "removePointerLine keeps the other lines" (design.md C2, porting
//   harness/skills/sdd-continue/references/formats.md:266-281):
//   Pre-condition: a pointer file with three lines for three run ids.
//   Call: removePointerLine(path, <the middle run id>).
//   Observable result: the file on disk still holds the other two lines
//   unchanged; the call returns 1.
//   Expected-value source: formats.md:266-281 (`kept = lines.filter(...)`,
//   written back when kept.length > 0).
//
// Criterion "removePointerLine deletes the file at zero lines" (same
//   source, the `rmSync` branch):
//   Pre-condition: a pointer file with exactly one line, for the target run.
//   Call: removePointerLine(path, thatRunId).
//   Observable result: the file no longer exists; the call returns 1.
//   Expected-value source: formats.md:273-275 (`rmSync` at kept.length === 0).
//
// Criterion "removePointerLine returns 0 on a second call" (task 2 _Prompt:
//   "it returns the count removed and is idempotent (no file or no match
//   returns 0 and writes nothing)"):
//   Pre-condition: the file already removed by a first call.
//   Call: removePointerLine(path, the same run id) again.
//   Observable result: returns 0; the file still does not exist.
//   Expected-value source: the _Prompt sentence.
//
// Criterion "removePointerLine keeps a concurrent line" (task 2 _Prompt:
//   "adds a compare step: read the file again before the rename and, when
//   the text differs from the first read, restart the filter from the new
//   text"):
//   Pre-condition: a custom `read` seam that returns only the target run's
//   line on its first call and, from its second call on, that line plus a
//   second line a concurrent run appended for a different run id.
//   Call: removePointerLine(path, targetRunId, read).
//   Observable result: the file on disk ends up holding only the concurrent
//   line — the target line removed, the concurrent line kept, not deleted.
//   Expected-value source: the _Prompt sentence (restart-from-new-text rule).

describe('state-files', () => {
  let originalXdg: string | undefined;
  let originalSwm: string | undefined;
  let tempXdg: string;
  let tempSwm: string;

  beforeEach(async () => {
    originalXdg = process.env.XDG_STATE_HOME;
    originalSwm = process.env.SPEC_WORKFLOW_HOME;
    tempXdg = await fsp.mkdtemp(join(tmpdir(), 'state-files-xdg-'));
    tempSwm = await fsp.mkdtemp(join(tmpdir(), 'state-files-swm-'));
  });

  afterEach(async () => {
    if (originalXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = originalXdg;
    if (originalSwm === undefined) delete process.env.SPEC_WORKFLOW_HOME;
    else process.env.SPEC_WORKFLOW_HOME = originalSwm;
    delete process.env.SDD_TEST_ALLOW_REAL_HOME;
    await fsp.rm(tempXdg, { recursive: true, force: true });
    await fsp.rm(tempSwm, { recursive: true, force: true });
  });

  describe('path functions', () => {
    it('reads XDG_STATE_HOME and SPEC_WORKFLOW_HOME when set', () => {
      process.env.XDG_STATE_HOME = tempXdg;
      process.env.SPEC_WORKFLOW_HOME = tempSwm;

      expect(stateHome()).toBe(tempXdg);
      expect(pointerPath()).toBe(join(tempXdg, 'sdd', 'active-run'));
      expect(harnessStateDir()).toBe(join(tempSwm, 'harness'));
      expect(launchesDir()).toBe(join(tempSwm, 'harness', 'launches'));
      expect(logsDir()).toBe(join(tempSwm, 'harness', 'logs'));
    });

    it('defaults to the home directory when the env vars are unset', () => {
      delete process.env.XDG_STATE_HOME;
      delete process.env.SPEC_WORKFLOW_HOME;
      // This case deliberately resolves to the real home, so opt out of the
      // test-home guard (src/core/test-home-guard.ts) for its assertions.
      process.env.SDD_TEST_ALLOW_REAL_HOME = '1';

      expect(stateHome()).toBe(join(homedir(), '.local', 'state'));
      expect(pointerPath()).toBe(join(homedir(), '.local', 'state', 'sdd', 'active-run'));
      expect(harnessStateDir()).toBe(join(getGlobalDir(), 'harness'));
      expect(launchesDir()).toBe(join(getGlobalDir(), 'harness', 'launches'));
      expect(logsDir()).toBe(join(getGlobalDir(), 'harness', 'logs'));
    });
  });

  describe('readPointer', () => {
    it('returns an empty array for a missing pointer file', () => {
      const path = join(tempXdg, 'does-not-exist', 'active-run');
      expect(readPointer(path)).toEqual([]);
    });

    it('drops a line without three non-empty fields and keeps the well-formed ones', () => {
      const path = join(tempXdg, 'active-run');
      writeFileSync(
        path,
        [
          '/main/checkout-a\t/specs/a\tRUN-1',
          '/main/checkout-b\tonly-two-fields',
          '/main/checkout-c\t/specs/c\t',
          '/main/checkout-d\t/specs/d\tRUN-2',
        ].join('\n') + '\n',
      );

      expect(readPointer(path)).toEqual([
        { mainCheckout: '/main/checkout-a', specDir: '/specs/a', runId: 'RUN-1' },
        { mainCheckout: '/main/checkout-d', specDir: '/specs/d', runId: 'RUN-2' },
      ]);
    });
  });

  describe('removePointerLine', () => {
    it('keeps the other lines and removes only the matching run id', () => {
      const path = join(tempXdg, 'active-run');
      writeFileSync(
        path,
        [
          '/main/checkout-a\t/specs/a\tRUN-1',
          '/main/checkout-b\t/specs/b\tRUN-2',
          '/main/checkout-c\t/specs/c\tRUN-3',
        ].join('\n') + '\n',
      );

      const removed = removePointerLine(path, 'RUN-2');

      expect(removed).toBe(1);
      expect(readFileSync(path, 'utf-8')).toBe(
        '/main/checkout-a\t/specs/a\tRUN-1\n/main/checkout-c\t/specs/c\tRUN-3\n',
      );
    });

    it('deletes the file when no line remains', () => {
      const path = join(tempXdg, 'active-run');
      writeFileSync(path, '/main/checkout-a\t/specs/a\tRUN-1\n');

      const removed = removePointerLine(path, 'RUN-1');

      expect(removed).toBe(1);
      expect(existsSync(path)).toBe(false);
    });

    it('returns 0 and writes nothing on a second call for the same run id', () => {
      const path = join(tempXdg, 'active-run');
      writeFileSync(path, '/main/checkout-a\t/specs/a\tRUN-1\n');
      removePointerLine(path, 'RUN-1');

      const removed = removePointerLine(path, 'RUN-1');

      expect(removed).toBe(0);
      expect(existsSync(path)).toBe(false);
    });

    it('keeps a line a concurrent run appends between the first read and the rename', () => {
      const path = join(tempXdg, 'active-run');
      const onlyTarget = '/main/checkout-a\t/specs/a\tRUN-1\n';
      const withConcurrent = onlyTarget + '/main/checkout-b\t/specs/b\tRUN-2\n';
      writeFileSync(path, onlyTarget);

      let calls = 0;
      const read = (): string => {
        calls += 1;
        return calls === 1 ? onlyTarget : withConcurrent;
      };

      const removed = removePointerLine(path, 'RUN-1', read);

      expect(calls).toBeGreaterThanOrEqual(2);
      expect(removed).toBe(1);
      expect(readFileSync(path, 'utf-8')).toBe('/main/checkout-b\t/specs/b\tRUN-2\n');
    });
  });
});
