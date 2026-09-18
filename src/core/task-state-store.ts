import { promises as fs } from 'fs';
import { join } from 'path';
import {
  withRegistryLock,
  uniqueTempPath,
  type RegistryLockOptions,
} from './registry-lock.js';
import { normalizeIdentityPath } from './git-utils.js';

/**
 * Per-spec task state: one JSON record per task holding the diff bases keyed by
 * workspace and the shared attribution. Two owners, one lock.
 *
 * The status route records a base (`recordBase`); `log-implementation` records
 * attribution (`recordAttribution`). Both writers serialise on a sibling
 * `.lock` through {@link withRegistryLock}, read the current file, mutate one
 * field and rename a unique temp over it, so a write to either field preserves
 * the other (requirement 3.8) and two workspaces writing at once neither lose a
 * write nor observe a half-written file (requirement 3.8, 7.6). The registry's
 * own lock file (`registry-lock.ts:7-11`) is never shared: the lock path here
 * is the record's own sibling.
 */

/** Basename of the per-spec state file under `<workflowRoot>/.spec-workflow/specs/<spec>/`. */
export const TASK_STATE_FILE = 'task-state.json';

/** The whole file. `version` guards the shape; an unknown version reads as null. */
export interface TaskStateFile {
  version: 1;
  tasks: Record<string, TaskStateRecord>;
}

/** One task's record: bases keyed by `normalizeIdentityPath(workspacePath)`, plus shared attribution. */
export interface TaskStateRecord {
  bases: Record<string, { commit: string; recordedAt: string }>;
  attribution?: TaskAttribution;
}

/** Where and at what commit `log-implementation` recorded the work; its single writer. */
export interface TaskAttribution {
  workspacePath: string;
  commit: string | null;
  source: 'context' | 'override';
  loggedAt: string;
}

/** File paths a warn has already been emitted for, so `read` warns once per file. */
const warnedFiles = new Set<string>();

export class TaskStateStore {
  private readonly filePath: string;
  private readonly lockPath: string;

  /**
   * @param specPath  the spec directory `<workflowRoot>/.spec-workflow/specs/<spec>/`.
   * @param lockOptions  forwarded to {@link withRegistryLock}; lets a test inject a
   *   short `timeoutMs`. Production callers construct with the spec path alone.
   */
  constructor(specPath: string, private readonly lockOptions: RegistryLockOptions = {}) {
    this.filePath = join(specPath, TASK_STATE_FILE);
    this.lockPath = `${this.filePath}.lock`;
  }

  /**
   * The record for `taskId`, or null. Never throws and takes no lock: the
   * writers rename their temp over the file, so a reader sees it complete or
   * absent, never partial. A missing, unreadable, malformed or wrong-version
   * file returns null and warns once per file; a well-formed file with no entry
   * for `taskId` returns null without warning.
   */
  async read(taskId: string): Promise<TaskStateRecord | null> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, 'utf-8');
    } catch (error: any) {
      this.warnOnce(`unreadable: ${error?.code || error}`);
      return null;
    }

    const file = parseTaskStateFile(raw);
    if (!file) {
      this.warnOnce('malformed or wrong version');
      return null;
    }

    return file.tasks[taskId] ?? null;
  }

  /**
   * Record `commit` as the diff base for `workspacePath` on `taskId`. Runs under
   * the lock, preserving every other field. Returns false and warns when the
   * lock cannot be acquired (the caller continues); a write failure rejects
   * (Error Handling #10).
   */
  async recordBase(taskId: string, workspacePath: string, commit: string): Promise<boolean> {
    return this.mutate(taskId, record => {
      record.bases[normalizeIdentityPath(workspacePath)] = {
        commit,
        recordedAt: new Date().toISOString(),
      };
    });
  }

  /**
   * Record `attribution` on `taskId`. Runs under the lock, preserving the bases.
   * Returns false and warns when the lock cannot be acquired; a write failure
   * rejects (Error Handling #10).
   */
  async recordAttribution(taskId: string, attribution: TaskAttribution): Promise<boolean> {
    return this.mutate(taskId, record => {
      record.attribution = attribution;
    });
  }

  /** Acquire the lock, load-or-init the file, mutate one task's record, rename a temp over it. */
  private async mutate(taskId: string, apply: (record: TaskStateRecord) => void): Promise<boolean> {
    const result = await withRegistryLock(
      this.lockPath,
      async () => {
        const file = await this.loadForWrite();
        const record = file.tasks[taskId] ?? { bases: {} };
        apply(record);
        file.tasks[taskId] = record;
        await this.write(file);
      },
      this.lockOptions
    );

    if (!result.acquired) {
      console.warn(
        `[task-state-store] Could not acquire ${this.lockPath} (${result.reason}); ${taskId} not recorded`
      );
      return false;
    }
    return true;
  }

  /**
   * The current file to mutate, or a fresh empty one. A missing, unreadable,
   * malformed or wrong-version file starts fresh so the write still lands; a
   * well-formed peer file is returned so its fields are preserved.
   */
  private async loadForWrite(): Promise<TaskStateFile> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return parseTaskStateFile(raw) ?? { version: 1, tasks: {} };
    } catch {
      return { version: 1, tasks: {} };
    }
  }

  /**
   * Atomic write: a unique temp (per process, {@link uniqueTempPath}) then
   * `fs.rename`, mirroring `ProjectRegistry.writeRegistry`. A failure rejects
   * and propagates out of `withRegistryLock`'s `finally` (Error Handling #10).
   */
  private async write(file: TaskStateFile): Promise<void> {
    const tempPath = uniqueTempPath(this.filePath);
    await fs.writeFile(tempPath, JSON.stringify(file, null, 2), 'utf-8');
    await fs.rename(tempPath, this.filePath);
  }

  private warnOnce(reason: string): void {
    if (warnedFiles.has(this.filePath)) return;
    warnedFiles.add(this.filePath);
    console.warn(`[task-state-store] ${this.filePath} (${reason}); treating as no record`);
  }
}

/** Parse `raw` into a `TaskStateFile`, or null if it is not JSON, not an object, or not `version: 1`. */
function parseTaskStateFile(raw: string): TaskStateFile | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as { version?: unknown }).version !== 1 ||
    typeof (parsed as { tasks?: unknown }).tasks !== 'object' ||
    (parsed as { tasks?: unknown }).tasks === null
  ) {
    return null;
  }

  return parsed as TaskStateFile;
}
