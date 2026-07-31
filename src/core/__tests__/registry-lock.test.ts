import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { ProjectRegistry, generateProjectId } from '../project-registry.js';
import {
  withRegistryLock,
  uniqueTempPath,
  DEFAULT_LOCK_TIMEOUT_MS,
  DEFAULT_LOCK_STALE_MS,
} from '../registry-lock.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../global-dir.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const CHILD_SCRIPT = join(HERE, 'helpers', 'registry-lock-child.ts');

let testRoot: string;
let caseCounter = 0;

beforeAll(async () => {
  // realpath'd: `generateProjectId` normalizes its argument (requirement 1.10),
  // so on a platform where `tmpdir()` is itself a symlink (macOS `/var`) an
  // un-normalized root would make a registered path and its stored spelling
  // differ for reasons that have nothing to do with this suite.
  testRoot = await fs.realpath(await fs.mkdtemp(join(tmpdir(), 'specwf-registry-lock-')));
});

// Explicit teardown: vitest's worker pool never emits process 'exit'.
afterAll(async () => {
  await fs.rm(testRoot, { recursive: true, force: true }).catch(() => {});
});

/** A directory path that does NOT exist yet. */
function caseDir(name: string): string {
  return join(testRoot, `${name}-${caseCounter++}`);
}

interface ChildOutput {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Run N genuinely concurrent OS processes.
 *
 * Every child prints `ready` once loaded and then blocks on stdin; only when
 * all N are ready does the parent release them together. Without that
 * handshake, tsx startup (~0.5s) staggers the children enough that the first
 * finishes before the last begins and there is no contention to test.
 */
async function runConcurrently(argSets: string[][], env: Record<string, string>): Promise<ChildOutput[]> {
  const children = argSets.map(args => {
    const child = spawn(process.execPath, ['--import', 'tsx', CHILD_SCRIPT, ...args], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const output: ChildOutput = { code: null, stdout: '', stderr: '' };
    let markReady: () => void = () => {};
    let failReady: (error: Error) => void = () => {};
    const ready = new Promise<void>((resolve, reject) => {
      markReady = resolve;
      failReady = reject;
    });

    child.stdout!.setEncoding('utf-8');
    child.stdout!.on('data', (chunk: string) => {
      output.stdout += chunk;
      if (output.stdout.includes('ready')) markReady();
    });
    child.stderr!.setEncoding('utf-8');
    child.stderr!.on('data', (chunk: string) => {
      output.stderr += chunk;
    });

    const exited = new Promise<void>(resolve => {
      child.on('exit', code => {
        output.code = code;
        failReady(new Error(`child exited before becoming ready: ${output.stderr}`));
        resolve();
      });
    });

    return { child, output, ready, exited };
  });

  try {
    await Promise.all(children.map(c => c.ready));
  } catch (error) {
    children.forEach(c => c.child.kill());
    throw error;
  }

  // Release every contender at the same moment.
  for (const { child } of children) {
    child.stdin!.write('go\n');
  }

  await Promise.all(children.map(c => c.exited));
  return children.map(c => c.output);
}

describe('withRegistryLock — concurrent registration (requirements 6.1, 6.2)', () => {
  it(
    'keeps all N entries when N separate processes register at once against a nonexistent registry file and a nonexistent global directory',
    async () => {
      const globalDir = caseDir('concurrent-register');
      // Deliberately NOT created: `ensureRegistryDir` runs inside the critical
      // section, so this is the ENOENT-not-EEXIST case of requirement 6.2.
      //
      // The workspaces therefore live OUTSIDE it — creating them under
      // `globalDir` would create `globalDir` and destroy that case. They ARE
      // created, because `generateProjectId` realpath-normalizes its argument
      // (requirement 1.10) and logs the fallback when that fails; a nonexistent
      // workspace would put a line on every child's stderr and the
      // `stderr === ''` assertion below could no longer see a lock warning.
      const workspaceRoot = caseDir('concurrent-register-workspaces');
      const workspaces = Array.from({ length: 6 }, (_, i) => join(workspaceRoot, 'repo', 'worktrees', `feature-${i}`));
      await Promise.all(workspaces.map(p => fs.mkdir(p, { recursive: true })));

      const results = await runConcurrently(
        workspaces.map(workspacePath => ['register', workspacePath, join(workspaceRoot, 'repo')]),
        { [SPEC_WORKFLOW_HOME_ENV]: globalDir }
      );

      for (const result of results) {
        expect(result.stderr).toBe('');
        expect(result.code).toBe(0);
      }

      const raw = await fs.readFile(join(globalDir, 'activeProjects.json'), 'utf-8');
      const registry = JSON.parse(raw) as Record<string, { projectPath: string }>;

      expect(Object.keys(registry)).toHaveLength(workspaces.length);
      for (const workspacePath of workspaces) {
        expect(registry[generateProjectId(workspacePath)]?.projectPath).toBe(workspacePath);
      }

      // Nothing left behind: the lock is released and every temp file renamed.
      const leftovers = (await fs.readdir(globalDir)).filter(name => name !== 'activeProjects.json' && name !== 'repo');
      expect(leftovers).toEqual([]);
    },
    120000
  );

  it(
    'serialises the critical section when several processes break the same stale lock (requirement 6.5)',
    async () => {
      const globalDir = caseDir('stale-breakers');
      await fs.mkdir(globalDir, { recursive: true });
      const lockPath = join(globalDir, 'activeProjects.json.lock');
      const logPath = join(globalDir, 'critical-section.log');
      await fs.writeFile(logPath, '', 'utf-8');

      // A lock left behind by a process that died. Its mtime is the only
      // staleness evidence the implementation is allowed to use.
      await fs.writeFile(lockPath, JSON.stringify({ pid: 999999, hostname: 'dead-host', token: 'dead' }), 'utf-8');
      const longAgo = new Date(Date.now() - DEFAULT_LOCK_STALE_MS * 4);
      await fs.utimes(lockPath, longAgo, longAgo);

      const contenders = 4;
      const results = await runConcurrently(
        Array.from({ length: contenders }, () => ['critical', lockPath, logPath, '150']),
        { [SPEC_WORKFLOW_HOME_ENV]: globalDir }
      );

      for (const result of results) {
        expect(result.stderr).not.toContain('Error');
        expect(result.code).toBe(0);
        expect(result.stdout).toContain('done acquired');
      }

      // The rename-aside decides the winner: exactly one process may break the
      // stale lock, and the losers wait for it rather than acquiring too.
      const breakers = results.filter(result => result.stderr.includes('Broke a stale lock'));
      expect(breakers).toHaveLength(1);

      // If two breakers both acquired, their enter/exit pairs interleave here.
      const lines = (await fs.readFile(logPath, 'utf-8')).trim().split('\n');
      expect(lines).toHaveLength(contenders * 2);
      for (let i = 0; i < lines.length; i += 2) {
        const [enterWord, enterPid] = lines[i].split(' ');
        const [exitWord, exitPid] = lines[i + 1].split(' ');
        expect(enterWord).toBe('enter');
        expect(exitWord).toBe('exit');
        expect(exitPid).toBe(enterPid);
      }

      // The lock is released and no rename-aside file survives.
      const leftovers = (await fs.readdir(globalDir)).filter(name => name !== 'critical-section.log');
      expect(leftovers).toEqual([]);
    },
    120000
  );
});

describe('withRegistryLock — acquisition (requirements 6.2, 6.4, 6.5)', () => {
  it('creates the lock directory before acquiring', async () => {
    const globalDir = caseDir('missing-dir');
    const lockPath = join(globalDir, 'activeProjects.json.lock');

    const result = await withRegistryLock(lockPath, async () => 'ran');

    expect(result).toEqual({ acquired: true, value: 'ran' });
    await expect(fs.stat(globalDir)).resolves.toBeTruthy();
  });

  it('releases the lock file when the critical section finishes', async () => {
    const globalDir = caseDir('release');
    const lockPath = join(globalDir, 'activeProjects.json.lock');

    await withRegistryLock(lockPath, async () => {
      await expect(fs.stat(lockPath)).resolves.toBeTruthy();
    });

    await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('releases the lock when the critical section throws, and propagates the error', async () => {
    const globalDir = caseDir('throwing');
    const lockPath = join(globalDir, 'activeProjects.json.lock');

    await expect(
      withRegistryLock(lockPath, async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reports a non-EEXIST failure immediately instead of spinning until the budget expires', async () => {
    const blocker = join(caseDir('not-a-dir'), 'blocker');
    await fs.mkdir(dirname(blocker), { recursive: true });
    await fs.writeFile(blocker, 'not a directory', 'utf-8');

    const fn = vi.fn(async () => 'ran');
    const started = Date.now();
    const result = await withRegistryLock(join(blocker, 'nested', 'activeProjects.json.lock'), fn);

    expect(result.acquired).toBe(false);
    expect(result).toMatchObject({ reason: 'error' });
    expect(fn).not.toHaveBeenCalled();
    expect(Date.now() - started).toBeLessThan(DEFAULT_LOCK_TIMEOUT_MS);
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'reports an EACCES on the lock file rather than treating it as contention',
    async () => {
      const globalDir = caseDir('read-only');
      await fs.mkdir(globalDir, { recursive: true });
      await fs.chmod(globalDir, 0o555);

      try {
        const fn = vi.fn(async () => 'ran');
        const started = Date.now();
        const result = await withRegistryLock(join(globalDir, 'activeProjects.json.lock'), fn, {
          timeoutMs: 4000,
        });

        expect(result).toMatchObject({ acquired: false, reason: 'error' });
        expect((result as { error?: NodeJS.ErrnoException }).error?.code).toBe('EACCES');
        expect(fn).not.toHaveBeenCalled();
        expect(Date.now() - started).toBeLessThan(3000);
      } finally {
        await fs.chmod(globalDir, 0o755);
      }
    }
  );

  it('does not break a lock whose mtime is fresh, and times out instead', async () => {
    const globalDir = caseDir('fresh-lock');
    await fs.mkdir(globalDir, { recursive: true });
    const lockPath = join(globalDir, 'activeProjects.json.lock');
    const held = JSON.stringify({ pid: 999999, hostname: 'other-host', token: 'other' });
    await fs.writeFile(lockPath, held, 'utf-8');

    const fn = vi.fn(async () => 'ran');
    const result = await withRegistryLock(lockPath, fn, { timeoutMs: 200, retryIntervalMs: 10 });

    expect(result).toEqual({ acquired: false, reason: 'timeout', error: undefined });
    expect(fn).not.toHaveBeenCalled();
    expect(await fs.readFile(lockPath, 'utf-8')).toBe(held);
  });

  it('breaks a lock judged stale from its mtime, not from a timestamp inside the file', async () => {
    const globalDir = caseDir('stale-lock');
    await fs.mkdir(globalDir, { recursive: true });
    const lockPath = join(globalDir, 'activeProjects.json.lock');
    // A self-reported timestamp claiming the lock is brand new. Ignored.
    await fs.writeFile(lockPath, JSON.stringify({ pid: 999999, hostname: 'dead', acquiredAt: Date.now() }), 'utf-8');
    const longAgo = new Date(Date.now() - 60000);
    await fs.utimes(lockPath, longAgo, longAgo);

    const result = await withRegistryLock(lockPath, async () => 'ran', {
      timeoutMs: 2000,
      staleMs: 1000,
      retryIntervalMs: 10,
    });

    expect(result).toEqual({ acquired: true, value: 'ran' });
    expect(await fs.readdir(globalDir)).toEqual([]);
  });

  it('does not acquire on top of a live lock when a peer breaks and acquires between our staleness verdict and our break (requirement 6.5)', async () => {
    const globalDir = caseDir('break-toctou');
    await fs.mkdir(globalDir, { recursive: true });
    const lockPath = join(globalDir, 'activeProjects.json.lock');

    // The stale lock that both this process and the peer judge breakable.
    await fs.writeFile(lockPath, JSON.stringify({ pid: 999999, hostname: 'dead', token: 'dead' }), 'utf-8');
    const longAgo = new Date(Date.now() - 60000);
    await fs.utimes(lockPath, longAgo, longAgo);

    const peerLock = JSON.stringify({ pid: 12345, hostname: 'peer', token: 'peer-holds-it' });
    let peerHasActed = false;

    // The stat→rename window is microseconds wide, so a test that races for it
    // is flaky and proves nothing on the runs it misses. The injection point
    // makes the interleaving certain: the peer breaks the stale lock and
    // acquires *after* our staleness verdict and *before* our break.
    const fn = vi.fn(async () => 'ran');
    const result = await withRegistryLock(lockPath, fn, {
      timeoutMs: 300,
      staleMs: 1000,
      retryIntervalMs: 10,
      onStaleVerdict: async () => {
        if (peerHasActed) return;
        peerHasActed = true;
        const peerAside = `${lockPath}.peer.stale`;
        await fs.rename(lockPath, peerAside);
        await fs.unlink(peerAside);
        await fs.writeFile(lockPath, peerLock, { flag: 'wx', encoding: 'utf-8' });
      },
    });

    expect(peerHasActed).toBe(true);
    expect(
      result.acquired,
      'DOUBLE ACQUISITION: acquired the lock while the peer that broke the stale lock still held it'
    ).toBe(false);
    expect(
      fn,
      'DOUBLE ACQUISITION: ran the critical section while the peer still held the lock'
    ).not.toHaveBeenCalled();
    // The peer's live lock survives untouched: it was never ours to break.
    expect(await fs.readFile(lockPath, 'utf-8')).toBe(peerLock);
    expect((await fs.readdir(globalDir)).sort()).toEqual(['activeProjects.json.lock']);
  });

  it('releases the lock even when the diagnostic contents cannot be written', async () => {
    const globalDir = caseDir('unstampable');
    const lockPath = join(globalDir, 'activeProjects.json.lock');

    const realOpen = fs.open.bind(fs);
    const spy = vi.spyOn(fs, 'open').mockImplementation(async (...args: any[]) => {
      const handle = await (realOpen as any)(...args);
      // Everything the lock needs, except a working `writeFile`.
      return {
        stat: () => handle.stat(),
        close: () => handle.close(),
        writeFile: async () => {
          throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
        },
      } as any;
    });

    try {
      const result = await withRegistryLock(lockPath, async () => 'ran');
      expect(result).toEqual({ acquired: true, value: 'ran' });
    } finally {
      spy.mockRestore();
    }

    // Not leaked for the full staleness window: the lock is identified by inode,
    // not by the token it never managed to write.
    await expect(fs.stat(lockPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readdir(globalDir)).toEqual([]);
  });

  it('leaves a replacement lock alone when our own lock was broken mid-section', async () => {
    const globalDir = caseDir('broken-mid-section');
    const lockPath = join(globalDir, 'activeProjects.json.lock');
    const replacement = JSON.stringify({ pid: 12345, hostname: 'other-host', token: 'someone-else' });

    const result = await withRegistryLock(lockPath, async () => {
      // Simulates another process breaking our lock aside and acquiring it.
      await fs.rm(lockPath);
      await fs.writeFile(lockPath, replacement, 'utf-8');
      return 'ran';
    });

    expect(result).toEqual({ acquired: true, value: 'ran' });
    expect(await fs.readFile(lockPath, 'utf-8')).toBe(replacement);
  });
});

describe('registerProject under the lock (requirements 6.1, 6.3, 6.4)', () => {
  const originalHome = process.env[SPEC_WORKFLOW_HOME_ENV];
  let globalDir: string;

  beforeEach(() => {
    globalDir = caseDir('register');
    process.env[SPEC_WORKFLOW_HOME_ENV] = globalDir;
  });

  afterAll(() => {
    if (originalHome === undefined) {
      delete process.env[SPEC_WORKFLOW_HOME_ENV];
    } else {
      process.env[SPEC_WORKFLOW_HOME_ENV] = originalHome;
    }
  });

  it('keeps both entries when two interleaved registrations race in one event loop', async () => {
    const registry = new ProjectRegistry();
    const a = join(globalDir, 'repo', 'worktrees', 'a');
    const b = join(globalDir, 'repo', 'worktrees', 'b');

    const [idA, idB] = await Promise.all([
      registry.registerProject(a, 111, { workflowRootPath: join(globalDir, 'repo') }),
      registry.registerProject(b, 222, { workflowRootPath: join(globalDir, 'repo') }),
    ]);

    expect(idA).not.toBe(idB);
    const entries = await registry.getAllProjects();
    expect(entries.map(e => e.projectPath).sort()).toEqual([a, b].sort());
  });

  it(
    'logs prominently and continues unregistered when the lock budget is exhausted',
    async () => {
      await fs.mkdir(globalDir, { recursive: true });
      const lockPath = join(globalDir, 'activeProjects.json.lock');
      // Held by someone else, and fresh, so it is never broken within the budget.
      await fs.writeFile(lockPath, JSON.stringify({ pid: 999999, hostname: 'other', token: 'other' }), 'utf-8');

      const errors: string[] = [];
      const spy = vi.spyOn(console, 'error').mockImplementation(msg => {
        errors.push(String(msg));
      });

      const registry = new ProjectRegistry();
      const workspacePath = join(globalDir, 'repo');
      const started = Date.now();
      let projectId: string;
      try {
        projectId = await registry.registerProject(workspacePath, 333, { workflowRootPath: workspacePath });
      } finally {
        spy.mockRestore();
      }

      // Did not throw: the MCP handshake survives.
      expect(projectId).toBe(generateProjectId(workspacePath));
      expect(Date.now() - started).toBeGreaterThanOrEqual(DEFAULT_LOCK_TIMEOUT_MS - 100);
      expect(errors.join('\n')).toContain('UNREGISTERED');
      await expect(fs.stat(join(globalDir, 'activeProjects.json'))).rejects.toMatchObject({ code: 'ENOENT' });
    },
    30000
  );
});

describe('unique temp filename (requirement 6.3)', () => {
  it('is unique per call and carries this process id', () => {
    const first = uniqueTempPath('/tmp/activeProjects.json');
    const second = uniqueTempPath('/tmp/activeProjects.json');

    expect(first).not.toBe(second);
    expect(first.startsWith(`/tmp/activeProjects.json.${process.pid}.`)).toBe(true);
    expect(first.endsWith('.tmp')).toBe(true);
  });

  it('is the name project-registry writes through — no shared `<registryPath>.tmp` remains', async () => {
    const source = await fs.readFile(join(REPO_ROOT, 'src', 'core', 'project-registry.ts'), 'utf-8');

    expect(source).toContain('uniqueTempPath(this.registryPath)');
    expect(source).not.toContain('${this.registryPath}.tmp');
  });
});
