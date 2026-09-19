import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  TaskStateStore,
  TASK_STATE_FILE,
  type TaskAttribution,
} from '../task-state-store.js';
import { normalizeIdentityPath } from '../git-utils.js';

let testRoot: string;
let caseCounter = 0;

beforeAll(async () => {
  // realpath'd so a `normalizeIdentityPath` key computed from a workspace path
  // under this root matches on a platform where `tmpdir()` is a symlink.
  testRoot = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'specwf-task-state-')));
});

afterAll(async () => {
  await fs.rm(testRoot, { recursive: true, force: true }).catch(() => {});
});

// The store warns to stderr on a null read and on an unacquired lock; silence it.
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

/** A spec directory that does not exist yet. */
async function newSpecDir(): Promise<string> {
  return join(testRoot, `spec-${caseCounter++}`);
}

/** A workspace directory that exists, so `normalizeIdentityPath` resolves it by realpath. */
async function newWorkspace(name: string): Promise<string> {
  const dir = join(testRoot, `ws-${name}-${caseCounter++}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

describe('TaskStateStore.read', () => {
  it('returns null for a missing file without warning (the normal single-checkout path)', async () => {
    const store = new TaskStateStore(await newSpecDir());
    expect(await store.read('1')).toBeNull();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns null for a malformed file', async () => {
    const specPath = await newSpecDir();
    await fs.mkdir(specPath, { recursive: true });
    await fs.writeFile(join(specPath, TASK_STATE_FILE), '{ not json', 'utf-8');
    const store = new TaskStateStore(specPath);
    expect(await store.read('1')).toBeNull();
  });

  it('returns null for a wrong-version file', async () => {
    const specPath = await newSpecDir();
    await fs.mkdir(specPath, { recursive: true });
    await fs.writeFile(
      join(specPath, TASK_STATE_FILE),
      JSON.stringify({ version: 2, tasks: {} }),
      'utf-8'
    );
    const store = new TaskStateStore(specPath);
    expect(await store.read('1')).toBeNull();
  });

  it('returns null for a well-formed file with no entry for the task', async () => {
    const specPath = await newSpecDir();
    const store = new TaskStateStore(specPath);
    await store.recordBase('1', await newWorkspace('a'), 'abc');
    expect(await store.read('2')).toBeNull();
  });
});

describe('TaskStateStore writers', () => {
  it('recordBase then recordAttribution keeps both fields (one record, two owners)', async () => {
    const specPath = await newSpecDir();
    const ws = await newWorkspace('owner');
    const store = new TaskStateStore(specPath);
    const attribution: TaskAttribution = {
      workspacePath: ws,
      commit: 'deadbeef',
      source: 'context',
      loggedAt: new Date().toISOString(),
    };

    expect(await store.recordBase('1', ws, 'deadbeef')).toBe(true);
    expect(await store.recordAttribution('1', attribution)).toBe(true);

    const record = await store.read('1');
    expect(record).not.toBeNull();
    expect(record!.bases[normalizeIdentityPath(ws)]).toMatchObject({ commit: 'deadbeef' });
    expect(record!.attribution).toEqual(attribution);
  });

  it('keeps both bases when two workspaces record concurrently (requirement 7.6)', async () => {
    const specPath = await newSpecDir();
    const wsA = await newWorkspace('A');
    const wsB = await newWorkspace('B');
    const store = new TaskStateStore(specPath);

    const results = await Promise.all([
      store.recordBase('1', wsA, 'aaaa'),
      store.recordBase('1', wsB, 'bbbb'),
    ]);
    expect(results).toEqual([true, true]);

    const record = await store.read('1');
    expect(record!.bases[normalizeIdentityPath(wsA)]).toMatchObject({ commit: 'aaaa' });
    expect(record!.bases[normalizeIdentityPath(wsB)]).toMatchObject({ commit: 'bbbb' });
  });

  it('returns false and writes nothing when the lock is held', async () => {
    const specPath = await newSpecDir();
    const ws = await newWorkspace('held');
    await fs.mkdir(specPath, { recursive: true });
    // Hold the lock the way a peer does (registry-lock.test.ts:338): exclusive create.
    const lockPath = join(specPath, `${TASK_STATE_FILE}.lock`);
    await fs.writeFile(lockPath, 'peer', { flag: 'wx', encoding: 'utf-8' });

    const store = new TaskStateStore(specPath, { timeoutMs: 50, retryIntervalMs: 10 });
    expect(await store.recordBase('1', ws, 'abc')).toBe(false);

    // No record file was written.
    await expect(fs.access(join(specPath, TASK_STATE_FILE))).rejects.toThrow();
  });
});
