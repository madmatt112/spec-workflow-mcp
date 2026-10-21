// Contract for DashboardSessionManager.peekDashboardSession() (design C9, Req 7 AC 6, Req 5 AC 2):
//
// 1. Live-pid session file -> the parsed entry.
//    Pre:  home dir exists; activeSession.json holds an entry whose pid is this test process.
//    Call: await manager.peekDashboardSession()
//    Want: the written entry, unchanged.
//    Src:  design.md C9 "otherwise the parsed entry".
//
// 2. Dead-pid session file -> null, file left in place.
//    Pre:  home dir exists; activeSession.json holds an entry whose pid already exited.
//    Call: await manager.peekDashboardSession()
//    Want: null; a later fs.access on the session file still resolves (not unlinked).
//    Src:  brief Success clause "a dead-pid file returns null and the file still exists
//          afterwards"; design.md C9 "It never writes or unlinks."
//
// 3. Absent home directory -> null, no directory created.
//    Pre:  SPEC_WORKFLOW_HOME points at a path that does not exist.
//    Call: await manager.peekDashboardSession()
//    Want: null; a later fs.access on that path still rejects ENOENT (no mkdir happened).
//    Src:  design.md C9 "reads the session path ... with no mkdir"; brief Success clause
//          "an absent home directory returns null and no directory is created".
//
// 4. Unparseable session file -> null.
//    Pre:  home dir exists; activeSession.json holds invalid JSON.
//    Call: await manager.peekDashboardSession()
//    Want: null.
//    Src:  design.md C9 "returns null for an absent or unparseable file".
//
// 5. Entry with no string url -> null.
//    Pre:  home dir exists; activeSession.json holds a live-pid entry whose url is missing.
//    Call: await manager.peekDashboardSession()
//    Want: null.
//    Src:  design.md C9 "a missing string url".

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { DashboardSessionManager } from '../dashboard-session.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../global-dir.js';

describe('DashboardSessionManager.peekDashboardSession', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `spec-workflow-peek-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    await fs.mkdir(tempDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = tempDir;
  });

  afterEach(async () => {
    process.env = { ...originalEnv };
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  it('returns the parsed entry for a live-pid session file', async () => {
    const entry = {
      url: 'http://localhost:4000',
      port: 4000,
      pid: process.pid,
      startedAt: '2026-01-01T00:00:00.000Z',
    };
    await fs.writeFile(join(tempDir, 'activeSession.json'), JSON.stringify(entry), 'utf-8');

    const manager = new DashboardSessionManager();
    const result = await manager.peekDashboardSession();

    expect(result).toEqual(entry);
  });

  it('returns null for a dead-pid session file and leaves the file in place', async () => {
    const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    const deadPid = dead.pid as number;
    const sessionPath = join(tempDir, 'activeSession.json');
    const entry = {
      url: 'http://localhost:4000',
      port: 4000,
      pid: deadPid,
      startedAt: '2026-01-01T00:00:00.000Z',
    };
    await fs.writeFile(sessionPath, JSON.stringify(entry), 'utf-8');

    const manager = new DashboardSessionManager();
    const result = await manager.peekDashboardSession();

    expect(result).toBeNull();
    await expect(fs.access(sessionPath)).resolves.toBeUndefined();
  });

  it('returns null for an absent home directory and creates no directory', async () => {
    const missingHome = join(tempDir, 'does-not-exist');
    process.env[SPEC_WORKFLOW_HOME_ENV] = missingHome;

    const manager = new DashboardSessionManager();
    const result = await manager.peekDashboardSession();

    expect(result).toBeNull();
    await expect(fs.access(missingHome)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns null for an unparseable session file', async () => {
    await fs.writeFile(join(tempDir, 'activeSession.json'), '{not valid json', 'utf-8');

    const manager = new DashboardSessionManager();
    const result = await manager.peekDashboardSession();

    expect(result).toBeNull();
  });

  it('returns null for an entry with no string url', async () => {
    const entry = {
      port: 4000,
      pid: process.pid,
      startedAt: '2026-01-01T00:00:00.000Z',
    };
    await fs.writeFile(join(tempDir, 'activeSession.json'), JSON.stringify(entry), 'utf-8');

    const manager = new DashboardSessionManager();
    const result = await manager.peekDashboardSession();

    expect(result).toBeNull();
  });
});
