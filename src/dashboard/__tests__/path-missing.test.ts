/**
 * Contract — task 3 (Missing-path rule; design C6; requirements 4.3, 4.4).
 *
 * AC-1 (R4 AC3, ENOENT): pre — hostPath is a directory that existed and was
 *   removed. call — isPathMissing(hostPath). result — resolves true.
 *   source: design C6 "returns true only when the stat error code is ENOENT
 *   or ENOTDIR."
 *
 * AC-2 (R4 AC3, ENOTDIR): pre — hostPath is a path under a regular file (a
 *   non-directory path segment). call — isPathMissing(hostPath). result —
 *   resolves true. source: design C6, same ENOTDIR branch.
 *
 * AC-3 (R4 AC3, existing path): pre — hostPath is an existing directory.
 *   call — isPathMissing(hostPath). result — resolves false.
 *   source: design C6 "An existing path returns false."
 *
 * AC-4 (R4 AC4, translation throw): pre — PathUtils.translatePath throws for
 *   hostPath. call — isPathMissing(hostPath). result — resolves false, so
 *   the entry is kept. source: design C6 "a throw from translation returns
 *   false"; R4 AC4 "IF translation throws THEN the entry SHALL be kept."
 *
 * AC-5 (R4 AC3 "any other failure", design C6 logging): pre — stat rejects
 *   with EACCES. call — isPathMissing(hostPath), twice on the same path.
 *   result — both resolve false, and the "does not exist" log fires exactly
 *   once across both calls. source: design C6 "any other error returns
 *   false and logs once per path"; task 3 Prompt "logs once per path for
 *   the life of the process".
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { statOverride } = vi.hoisted(() => ({
  statOverride: { impl: undefined as ((path: string) => Promise<unknown>) | undefined },
}));

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    stat: (...args: Parameters<typeof actual.stat>) => {
      if (statOverride.impl) {
        return statOverride.impl(args[0] as string);
      }
      return actual.stat(...args);
    },
  };
});

import { PathUtils } from '../../core/path-utils.js';
import { isPathMissing } from '../path-missing.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'path-missing-test-'));
  statOverride.impl = undefined;
});

afterEach(async () => {
  statOverride.impl = undefined;
  vi.restoreAllMocks();
  await rm(tempDir, { recursive: true, force: true });
});

describe('isPathMissing', () => {
  it('a deleted directory is missing (ENOENT)', async () => {
    const dir = join(tempDir, 'gone');
    await mkdir(dir);
    await rm(dir, { recursive: true, force: true });

    await expect(isPathMissing(dir)).resolves.toBe(true);
  });

  it('a path under a regular file is missing (ENOTDIR)', async () => {
    const file = join(tempDir, 'a-file');
    await writeFile(file, 'content');
    const under = join(file, 'sub');

    await expect(isPathMissing(under)).resolves.toBe(true);
  });

  it('an existing directory is not missing', async () => {
    await expect(isPathMissing(tempDir)).resolves.toBe(false);
  });

  it('a translatePath that throws is not missing', async () => {
    const translateSpy = vi.spyOn(PathUtils, 'translatePath').mockImplementation(() => {
      throw new Error('translation failed');
    });

    await expect(isPathMissing(tempDir)).resolves.toBe(false);
    expect(translateSpy).toHaveBeenCalledWith(tempDir);
  });

  it('a stat that rejects with EACCES is not missing and logs exactly once over two calls', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    statOverride.impl = async () => {
      const err: NodeJS.ErrnoException = new Error('permission denied');
      err.code = 'EACCES';
      throw err;
    };

    await expect(isPathMissing(tempDir)).resolves.toBe(false);
    await expect(isPathMissing(tempDir)).resolves.toBe(false);

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
