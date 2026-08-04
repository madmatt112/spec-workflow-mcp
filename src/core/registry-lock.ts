import { promises as fs, type Stats } from 'fs';
import type { FileHandle } from 'fs/promises';
import { dirname } from 'path';
import { hostname } from 'os';

/**
 * Exclusive lock for the global project registry.
 *
 * Scoped to the registry writers only (requirement 6.6). The other shared-root
 * files and the global-directory anchor belong to `worktree-dashboard-concurrency`.
 */

/** Total time budget for acquiring the lock before giving up. */
export const DEFAULT_LOCK_TIMEOUT_MS = 5000;

/** A lock file whose mtime is older than this may be broken. */
export const DEFAULT_LOCK_STALE_MS = 30000;

/** Delay between acquisition attempts. */
export const DEFAULT_LOCK_RETRY_INTERVAL_MS = 25;

export interface RegistryLockOptions {
  /** Total time budget for acquisition. Default {@link DEFAULT_LOCK_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Age (from the lock file's mtime) past which the lock is breakable. Default {@link DEFAULT_LOCK_STALE_MS}. */
  staleMs?: number;
  /** Delay between attempts. Default {@link DEFAULT_LOCK_RETRY_INTERVAL_MS}. */
  retryIntervalMs?: number;
  /**
   * @internal Injection point for the concurrency tests, awaited after a lock
   * has been judged stale and before it is broken. The stat→rename window is
   * microseconds wide in practice, so a test that merely hopes to hit it is
   * flaky; this makes the interleaving certain. Production callers never set it.
   */
  onStaleVerdict?: () => Promise<void>;
}

export type RegistryLockResult<T> =
  | { acquired: true; value: T }
  | { acquired: false; reason: 'timeout' | 'error'; error?: NodeJS.ErrnoException };

/** Per-process counter making every temp/aside filename unique to this process. */
let fileCounter = 0;

/**
 * Temp filename for an atomic registry write: `<registryPath>.<pid>.<counter>.tmp`.
 *
 * Requirement 6.3. A single shared `<registryPath>.tmp` lets two concurrent
 * writers interleave bytes into one file; rename atomicity does not help,
 * because both renames move the same corrupted file.
 */
export function uniqueTempPath(basePath: string): string {
  return `${basePath}.${process.pid}.${fileCounter++}.tmp`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * A file's identity on this host. Compared as a pair; `ino` alone is not unique.
 *
 * Known limit: a filesystem that does not report inode numbers (some FUSE and
 * network mounts answer `ino === 0` for every file) collapses this to a
 * comparison of `dev` alone, i.e. always true between two files on that mount.
 * No cheap guard exists that is not worse than the disease — rejecting `ino === 0`
 * outright would make every lock unreleasable *and* unbreakable there, a
 * deadlock in place of a race. {@link sameStaleFile} still discriminates on
 * such a mount, because a lock only becomes breakable once it is `staleMs` old
 * and so cannot share an mtime with a lock created after the verdict.
 */
interface FileIdentity {
  dev: number;
  ino: number;
}

function sameFile(a: FileIdentity, b: FileIdentity): boolean {
  return a.dev === b.dev && a.ino === b.ino;
}

/**
 * The identity of a file *in the state it was judged in*.
 *
 * `dev`+`ino` alone is not enough here, unlike in {@link releaseLock} where an
 * open handle pins the inode: breaking a stale lock frees its inode, and the
 * very next lock file created in that directory routinely gets it back. A
 * process that judged the old file would then see its own inode number on a
 * peer's live lock. `mtimeMs` separates them — a lock is only breakable once it
 * is `staleMs` old, so a file created after the verdict cannot share its mtime.
 */
interface StaleCandidate extends FileIdentity {
  mtimeMs: number;
}

function sameStaleFile(a: StaleCandidate, b: StaleCandidate): boolean {
  return sameFile(a, b) && a.mtimeMs === b.mtimeMs;
}

/**
 * Put a wrongly-moved lock file back.
 *
 * The file being restored is somebody's LIVE lock, so it must never simply be
 * unlinked when the restore fails: that destroys a lock its holder still
 * believes in and leaves `lockPath` free for everyone else to take.
 *
 * `link` first, rather than `rename`: if a third process acquired while the
 * path was vacant, `link` fails with EEXIST and leaves that live lock intact,
 * whereas `rename` would silently clobber it. But hard links are not universal
 * — `SPEC_WORKFLOW_HOME` may point at exFAT or CIFS, which answer EPERM,
 * ENOSYS or ENOTSUP — so `rename` is the fallback there, guarded by a stat so
 * that it cannot land on a lock acquired in the meantime. The stat→rename gap
 * is not atomic; it is accepted because the only alternatives are destroying a
 * live lock or leaving the path permanently vacant.
 *
 * Logs nothing: this runs inside the vacancy window opened by the rename in
 * {@link breakStaleLock}, and console I/O there measurably widens it.
 */
async function restoreLock(asidePath: string, lockPath: string): Promise<void> {
  try {
    await fs.link(asidePath, lockPath);
    // `lockPath` now names the file again; the aside is a second link to it.
    await fs.unlink(asidePath).catch(() => {});
    return;
  } catch (error: any) {
    if (error?.code === 'EEXIST') {
      // A third party acquired while the path was vacant. Their lock is live
      // and stands; the file we moved is unreachable to its holder either way
      // (it releases by identity and will find a stranger's inode), so it is
      // dropped rather than left as debris.
      await fs.unlink(asidePath).catch(() => {});
      return;
    }
  }

  // No hard links on this filesystem.
  let occupied: boolean;
  try {
    await fs.stat(lockPath);
    occupied = true;
  } catch {
    occupied = false;
  }

  if (occupied) {
    await fs.unlink(asidePath).catch(() => {});
    return;
  }

  // If even the rename fails, the aside file is left exactly where it is: a
  // leftover file is recoverable, a destroyed lock is not.
  await fs.rename(asidePath, lockPath).catch(() => {});
}

/**
 * Break a lock whose mtime says it is stale.
 *
 * Atomic by construction (requirement 6.5): the lock is renamed aside and only
 * the process whose rename succeeded may proceed. A stat-then-unlink-then-open
 * sequence lets two processes that both judge the lock stale each unlink the
 * other's freshly created lock and both acquire; a rename cannot succeed twice
 * for the same source file.
 *
 * The rename alone is not enough, because `rename` acts on the *path*, not on
 * the file that was judged. Between the `stat` and the `rename` a peer can break
 * the same stale lock and acquire, so the rename would move a LIVE lock aside
 * and this process would acquire on top of it — two simultaneous holders, the
 * exact failure the atomic break exists to prevent. POSIX has no "remove if the
 * inode still matches", so the break is verified after the fact: the aside file
 * is `stat`ed, and the break counts only if it is the very file the staleness
 * verdict was formed about. Otherwise the file is put back and this process
 * does NOT acquire.
 *
 * Verifying after the fact means `lockPath` is briefly vacant — between the
 * rename and the restore — and that window cannot be closed, only narrowed to
 * the two syscalls (`stat`, then `link`) that decide and undo. See the marked
 * region below.
 *
 * Staleness comes from `fs.stat` mtime, never from a self-reported timestamp
 * inside the file and never from `isProcessAlive`, which returns true
 * unconditionally under Docker path translation and would make a crashed
 * container's lock permanently unbreakable.
 */
async function breakStaleLock(
  lockPath: string,
  staleMs: number,
  onStaleVerdict?: () => Promise<void>
): Promise<boolean> {
  let stats;
  try {
    stats = await fs.stat(lockPath);
  } catch {
    // Already gone (or unreadable) — the next acquisition attempt decides.
    return false;
  }

  if (Date.now() - stats.mtimeMs < staleMs) {
    return false;
  }

  // The identity of the file this verdict is about. Anything else at `lockPath`
  // by the time we act is somebody's live lock, not our stale one.
  const judged: StaleCandidate = { dev: stats.dev, ino: stats.ino, mtimeMs: stats.mtimeMs };

  if (onStaleVerdict) {
    await onStaleVerdict();
  }

  const asidePath = `${lockPath}.${process.pid}.${fileCounter++}.stale`;
  try {
    await fs.rename(lockPath, asidePath);
  } catch {
    // Lost the race, or the holder released it first. Not ours to break.
    return false;
  }

  // ---- `lockPath` is VACANT from here until the restore below. ----
  // Nothing but the identity check and the restore may go in this window: a
  // third party can acquire the vacant path while the process we may have just
  // robbed still holds its lock, so every syscall, log line or allocation added
  // here widens a genuine double-acquisition window. `fs.stat` rather than
  // open+fstat is one syscall instead of three, and is exactly as trustworthy:
  // the aside name carries our pid and a per-process counter, so no other
  // process can have put a different file there. `Stats` is compared in place
  // rather than copied into a `StaleCandidate`.
  let moved: Stats | undefined;
  try {
    moved = await fs.stat(asidePath);
  } catch {
    // Cannot prove what we moved, so we must not act as if we broke it.
    moved = undefined;
  }

  const broke = moved !== undefined && sameStaleFile(moved, judged);
  if (!broke) {
    await restoreLock(asidePath, lockPath);
  }
  // ---- Window closed. Logging and everything else belongs below. ----

  if (!broke) {
    console.error(
      `[registry-lock] ${lockPath} changed under us while it was being judged; putting it back and standing down`
    );
    return false;
  }

  console.error(`[registry-lock] Broke a stale lock at ${lockPath} (older than ${staleMs}ms)`);
  await fs.unlink(asidePath).catch(() => {});
  return true;
}

/**
 * Release our own lock.
 *
 * Ownership is decided by file identity, not by the lock file's contents: the
 * handle is still open here, so the kernel cannot have recycled our inode and a
 * `dev`+`ino` match therefore names our file and no other. It also means a lock
 * whose diagnostic contents were never written is still released rather than
 * leaked for the whole staleness window. If our lock was broken while we held it
 * and another process now owns the path, the identities differ and that file is
 * left alone.
 *
 * The unlink runs BEFORE the close, with nothing between it and the identity
 * check. Closing first ends the inode pinning that makes the check meaningful,
 * and puts a syscall inside the check→unlink gap: a peer that breaks our lock
 * in there — our lock having gone stale during a long critical section — has
 * its own live lock unlinked by us. The gap cannot be removed altogether (POSIX
 * has no "unlink if the inode still matches"), only reduced to two adjacent
 * calls.
 */
async function releaseLock(handle: FileHandle, lockPath: string, identity: FileIdentity): Promise<void> {
  let ours = false;
  try {
    const current = await fs.stat(lockPath);
    ours = sameFile({ dev: current.dev, ino: current.ino }, identity);
  } catch {
    // Missing or unreadable — either already gone or not ours to remove.
    ours = false;
  }

  if (ours) {
    await fs.unlink(lockPath).catch(() => {});
  }

  await handle.close().catch(() => {});
}

type AcquisitionResult =
  | { ok: true; handle: FileHandle; identity: FileIdentity }
  | { ok: false; reason: 'timeout' | 'error'; error?: NodeJS.ErrnoException };

async function acquireLock(
  lockPath: string,
  timeoutMs: number,
  staleMs: number,
  retryIntervalMs: number,
  onStaleVerdict?: () => Promise<void>
): Promise<AcquisitionResult> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    let handle: FileHandle | undefined;
    try {
      handle = await fs.open(lockPath, 'wx');
    } catch (error: any) {
      // Requirement 6.2: EEXIST is contention and is retried. Every other
      // errno is reported rather than spun on — a retry loop that treats
      // ENOENT or EACCES as contention burns the whole budget and leaves
      // every process unregistered.
      if (error?.code !== 'EEXIST') {
        console.error(`[registry-lock] Cannot acquire ${lockPath}: ${error?.code || error}`);
        return { ok: false, reason: 'error', error };
      }
    }

    if (handle) {
      try {
        const stats = await handle.stat();
        return { ok: true, handle, identity: { dev: stats.dev, ino: stats.ino } };
      } catch (error: any) {
        // We hold a lock we cannot identify, so `releaseLock` could never
        // recognise it as ours. Drop it now rather than leak it for the full
        // staleness window; the file was created by the `wx` open above.
        console.error(`[registry-lock] Cannot identify the lock file ${lockPath}: ${error?.code || error}`);
        await handle.close().catch(() => {});
        await fs.unlink(lockPath).catch(() => {});
        return { ok: false, reason: 'error', error };
      }
    }

    if (await breakStaleLock(lockPath, staleMs, onStaleVerdict)) {
      continue; // We won the break; retry immediately.
    }

    if (Date.now() >= deadline) {
      console.error(`[registry-lock] Timed out after ${timeoutMs}ms waiting for ${lockPath}`);
      return { ok: false, reason: 'timeout' };
    }

    await delay(retryIntervalMs);
  }
}

/**
 * Run `fn` while holding an exclusive lock on `lockPath`.
 *
 * Never throws on acquisition failure: the caller registers before the MCP
 * transport connects, so throwing would kill the handshake (requirement 6.4).
 * The outcome is reported in the return value; `fn`'s own errors propagate.
 */
export async function withRegistryLock<T>(
  lockPath: string,
  fn: () => Promise<T>,
  options: RegistryLockOptions = {}
): Promise<RegistryLockResult<T>> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const staleMs = options.staleMs ?? DEFAULT_LOCK_STALE_MS;
  const retryIntervalMs = options.retryIntervalMs ?? DEFAULT_LOCK_RETRY_INTERVAL_MS;

  // Requirement 6.2: the registry's own `ensureRegistryDir` runs *inside* the
  // critical section, so on a first run the directory does not exist yet and
  // `fs.open(lockPath, 'wx')` fails with ENOENT rather than EEXIST. Create the
  // directory here, before acquiring.
  try {
    await fs.mkdir(dirname(lockPath), { recursive: true });
  } catch (error: any) {
    console.error(`[registry-lock] Cannot create the lock directory ${dirname(lockPath)}: ${error?.code || error}`);
    return { acquired: false, reason: 'error', error };
  }

  const acquisition = await acquireLock(lockPath, timeoutMs, staleMs, retryIntervalMs, options.onStaleVerdict);
  if (!acquisition.ok) {
    return { acquired: false, reason: acquisition.reason, error: acquisition.error };
  }

  const token = `${process.pid}-${Date.now()}-${fileCounter++}`;
  try {
    await acquisition.handle.writeFile(JSON.stringify({ pid: process.pid, hostname: hostname(), token }), 'utf-8');
  } catch (error: any) {
    // The contents are diagnostic only; the exclusive create is the lock and
    // `releaseLock` identifies it by inode, so an unstamped lock is still
    // released rather than leaked.
    console.error(`[registry-lock] Could not stamp ${lockPath}: ${error?.code || error}`);
  }

  try {
    const value = await fn();
    return { acquired: true, value };
  } finally {
    await releaseLock(acquisition.handle, lockPath, acquisition.identity);
  }
}
