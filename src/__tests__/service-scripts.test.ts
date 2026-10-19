import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, copyFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

// Contract for controller-tasks.md T9: the three scripts pass `bash -n`;
// sdd-service.sh print emits the controller and watchdog units with the
// required directives; sdd-watchdog.sh --dry-run sends exactly one alert after
// the (shortened) consecutive-failure threshold and again only after the health
// recovers; sdd-self-update.sh --dry-run exits 0 in a temp clone and prints the
// steps it would run without doing them.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptsDir = join(repoRoot, 'scripts');
const serviceSh = join(scriptsDir, 'sdd-service.sh');
const watchdogSh = join(scriptsDir, 'sdd-watchdog.sh');
const selfUpdateSh = join(scriptsDir, 'sdd-self-update.sh');

interface RunResult { code: number | null; stdout: string; stderr: string; }

function runScript(file: string, args: string[], env: NodeJS.ProcessEnv): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', [file, ...args], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    const t = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('script timed out')); }, 20000);
    child.on('error', (e) => { clearTimeout(t); reject(e); });
    child.on('exit', (code) => { clearTimeout(t); resolve({ code, stdout, stderr }); });
  });
}

function alertLines(home: string): number {
  const log = join(home, 'watchdog-alerts.log');
  if (!existsSync(log)) return 0;
  return readFileSync(log, 'utf-8').split('\n').filter((l) => l.trim().length > 0).length;
}

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

// A toy checkout whose `origin` has advanced by one commit, mirroring the live
// defect: the controller commits store documents onto the checkout's local main
// while a merged PR moves origin/main on. The caller adds the local-only commit.
function makeDivergedCheckout(): { checkout: string; origin: string; home: string } {
  const origin = mkdtempSync(join(tmpdir(), 'self-update-origin-'));
  const checkout = mkdtempSync(join(tmpdir(), 'self-update-co-'));
  const home = mkdtempSync(join(tmpdir(), 'self-update-home-'));
  git(origin, 'init', '-q', '-b', 'main');
  git(origin, 'config', 'user.email', 't@example.com');
  git(origin, 'config', 'user.name', 'Test');
  mkdirSync(join(origin, 'src'), { recursive: true });
  writeFileSync(join(origin, 'package.json'), '{"name":"toy","version":"0.0.0"}\n');
  writeFileSync(join(origin, 'src', 'index.ts'), 'export const x = 1;\n');
  git(origin, 'add', '-A');
  git(origin, 'commit', '-qm', 'init');
  execFileSync('git', ['clone', '--quiet', origin, checkout]);
  git(checkout, 'config', 'user.email', 't@example.com');
  git(checkout, 'config', 'user.name', 'Test');
  // origin advances with a merged PR.
  writeFileSync(join(origin, 'src', 'index.ts'), 'export const x = 1;\n// merged PR\n');
  git(origin, 'add', '-A');
  git(origin, 'commit', '-qm', 'merged PR');
  return { checkout, origin, home };
}

describe('service scripts (controller T9)', () => {
  it('pass bash -n', () => {
    for (const s of [serviceSh, watchdogSh, selfUpdateSh]) {
      expect(() => execFileSync('bash', ['-n', s])).not.toThrow();
    }
  });

  it('sdd-service.sh print emits the controller and watchdog units', async () => {
    const out = (await runScript(serviceSh, ['print'], { SDD_CHECKOUT: repoRoot, SDD_PORT: '5050' })).stdout;
    expect(out).toContain('sdd-controller.service');
    expect(out).toContain('sdd-watchdog.service');
    expect(out).toContain('sdd-watchdog.timer');
    expect(out).toContain(`--dashboard --port 5050`);
    expect(out).toContain(`WorkingDirectory=${repoRoot}`);
    expect(out).toContain('Restart=always');
    expect(out).toContain('RestartSec=5');
    expect(out).toContain('StartLimitIntervalSec=0');
    expect(out).toContain('UnsetEnvironment=ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN');
    expect(out).toContain('OnUnitActiveSec=1min');
  });

  it('sdd-service.sh gives the watchdog unit the checkout, the node binary and the display', async () => {
    const out = (await runScript(serviceSh, ['print'], {
      SDD_CHECKOUT: repoRoot, SDD_NODE_BIN: '/opt/node/bin/node', DISPLAY: ':9', WAYLAND_DISPLAY: 'wayland-9',
    })).stdout;
    const watchdog = out.split('# ==== ').find((u) => u.startsWith(`${process.env.HOME}/.config/systemd/user/sdd-watchdog.service`))
      ?? out.split('sdd-watchdog.service ====')[1];
    expect(watchdog).toBeDefined();
    expect(watchdog).toContain(`Environment="SDD_CHECKOUT=${repoRoot}"`);
    expect(watchdog).toContain('Environment="SDD_NODE_BIN=/opt/node/bin/node"');
    expect(watchdog).toContain('Environment="DISPLAY=:9"');
    expect(watchdog).toContain('Environment="WAYLAND_DISPLAY=wayland-9"');
  });

  it('sdd-service.sh bakes a reboot-safe node path: no transient fnm dir, ExecStart on the resolved binary', async () => {
    const transient = '/run/user/1000/fnm_multishells/12345_1700000000000/bin';
    const out = (await runScript(serviceSh, ['print'], {
      SDD_CHECKOUT: repoRoot, SDD_PORT: '5050', PATH: `${transient}:${process.env.PATH ?? ''}`,
    })).stdout;
    const pathLines = out.split('\n').filter((l) => l.startsWith('Environment="PATH='));
    expect(pathLines).toHaveLength(2); // the controller and the watchdog units
    for (const line of pathLines) expect(line).not.toContain('fnm_multishells');
    const exec = out.split('\n').find((l) => l.startsWith('ExecStart=') && l.includes('--dashboard'));
    expect(exec).toBeDefined();
    const bin = exec!.slice('ExecStart='.length).split(' ')[0];
    expect(bin.startsWith('/')).toBe(true);
    expect(bin.endsWith('/node')).toBe(true);
    expect(bin).not.toContain('fnm_multishells');
    // The binary's directory leads the baked PATH so npm beside it resolves too.
    const dir = bin.slice(0, bin.lastIndexOf('/'));
    for (const line of pathLines) expect(line).toContain(`PATH=${dir}:`);
  });

  it('sdd-service.sh honours SDD_NODE_BIN for ExecStart', async () => {
    const out = (await runScript(serviceSh, ['print'], { SDD_CHECKOUT: repoRoot, SDD_NODE_BIN: '/opt/node/bin/node' })).stdout;
    expect(out).toContain('ExecStart=/opt/node/bin/node ');
    expect(out).toContain('Environment="PATH=/opt/node/bin:');
  });

  describe('sdd-watchdog.sh --dry-run failure rule', () => {
    let server: http.Server;
    let port: number;
    let healthy = false;
    let home: string;

    beforeAll(async () => {
      server = http.createServer((_req, res) => {
        if (healthy) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, version: 'x', pid: process.pid })); }
        else { res.writeHead(503); res.end('down'); }
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      port = (server.address() as any).port;
      home = mkdtempSync(join(tmpdir(), 'watchdog-home-'));
    });

    afterAll(() => {
      server.close();
      rmSync(home, { recursive: true, force: true });
    });

    it('alerts once after three failures and again only after recovery', async () => {
      // An absent unit name keeps the live sdd-controller unit (and its restart
      // counter) out of the test: systemctl reports it not-found, so only the
      // health rule can fire.
      const env = {
        SDD_PORT: String(port), SDD_HOME: home, SDD_WATCHDOG_FAIL_THRESHOLD: '3',
        SDD_WATCHDOG_UNIT: 'sdd-watchdog-test-absent.service',
      };

      healthy = false;
      for (let i = 0; i < 3; i++) await runScript(watchdogSh, ['--dry-run'], env);
      expect(alertLines(home)).toBe(1); // crossed the threshold once

      await runScript(watchdogSh, ['--dry-run'], env);
      expect(alertLines(home)).toBe(1); // still down, but not notified twice

      healthy = true;
      await runScript(watchdogSh, ['--dry-run'], env); // recovers: latch clears

      healthy = false;
      for (let i = 0; i < 3; i++) await runScript(watchdogSh, ['--dry-run'], env);
      expect(alertLines(home)).toBe(2); // a fresh breach alerts again
    });

    /** A stand-in `systemctl` whose `show` prints the given unit properties. */
    function writeSystemctlStub(dir: string, props: Record<string, string | number>): string {
      const path = join(dir, 'systemctl');
      const lines = Object.entries(props).map(([k, v]) => `echo "${k}=${v}"`).join('\n');
      writeFileSync(path, `#!/bin/bash\n# args: --user show <unit> -p ...\n${lines}\n`, { mode: 0o755 });
      return path;
    }

    it('alerts on a unit that is loaded but not active while the port stays green, with no node on PATH', async () => {
      const unitHome = mkdtempSync(join(tmpdir(), 'watchdog-unit-'));
      try {
        const looping = writeSystemctlStub(unitHome, {
          LoadState: 'loaded', ActiveState: 'activating', SubState: 'auto-restart', NRestarts: 0, MainPID: 0,
        });
        // PATH holds only the system dirs: curl, bash and sed, no node. The
        // watchdog must not need node to decide (2026-10-14: it died of the same
        // missing node as the controller and evaluated nothing for ten hours).
        const env = {
          SDD_PORT: String(port), SDD_HOME: unitHome, SDD_WATCHDOG_UNIT_THRESHOLD: '3',
          SDD_WATCHDOG_UNIT: 'sdd-controller.service', SDD_WATCHDOG_SYSTEMCTL: looping,
          PATH: '/usr/bin:/bin',
        };
        healthy = true;
        for (let i = 0; i < 2; i++) await runScript(watchdogSh, ['--dry-run'], env);
        expect(alertLines(unitHome)).toBe(0);
        const third = await runScript(watchdogSh, ['--dry-run'], env);
        expect(third.code).toBe(0);
        expect(alertLines(unitHome)).toBe(1);
        const log = readFileSync(join(unitHome, 'watchdog-alerts.log'), 'utf-8');
        expect(log).toContain('activating/auto-restart for 3 probes');
        expect(log).toContain(`port ${port} is green, served by pid ${process.pid} (not the unit)`);

        await runScript(watchdogSh, ['--dry-run'], env);
        expect(alertLines(unitHome)).toBe(1); // latched

        // The unit recovers: the latch clears and no new line is written.
        const active = writeSystemctlStub(unitHome, {
          LoadState: 'loaded', ActiveState: 'active', SubState: 'running', NRestarts: 0, MainPID: process.pid,
        });
        await runScript(watchdogSh, ['--dry-run'], { ...env, SDD_WATCHDOG_SYSTEMCTL: active });
        expect(alertLines(unitHome)).toBe(1);
        expect(readFileSync(join(unitHome, 'watchdog.state'), 'utf-8')).toContain('unit_bad=0');
      } finally {
        rmSync(unitHome, { recursive: true, force: true });
      }
    });

    it('counts automatic restarts from NRestarts and alerts at the threshold', async () => {
      const unitHome = mkdtempSync(join(tmpdir(), 'watchdog-restarts-'));
      try {
        const env = {
          SDD_PORT: String(port), SDD_HOME: unitHome, SDD_WATCHDOG_RESTART_THRESHOLD: '3',
          SDD_WATCHDOG_UNIT: 'sdd-controller.service',
        };
        healthy = true;
        const quiet = writeSystemctlStub(unitHome, { LoadState: 'loaded', ActiveState: 'active', SubState: 'running', NRestarts: 1, MainPID: process.pid });
        await runScript(watchdogSh, ['--dry-run'], { ...env, SDD_WATCHDOG_SYSTEMCTL: quiet });
        expect(alertLines(unitHome)).toBe(0);
        // Four more restarts since the last probe: 5 in the hour with the first, over the threshold.
        const bursting = writeSystemctlStub(unitHome, { LoadState: 'loaded', ActiveState: 'active', SubState: 'running', NRestarts: 5, MainPID: process.pid });
        await runScript(watchdogSh, ['--dry-run'], { ...env, SDD_WATCHDOG_SYSTEMCTL: bursting });
        expect(alertLines(unitHome)).toBe(1);
        expect(readFileSync(join(unitHome, 'watchdog-alerts.log'), 'utf-8')).toContain('restarted 5 times in the last hour');
      } finally {
        rmSync(unitHome, { recursive: true, force: true });
      }
    });
  });

  it('sdd-self-update.sh --dry-run exits 0 in a temp clone and changes nothing', async () => {
    const clone = mkdtempSync(join(tmpdir(), 'self-update-clone-'));
    const home = mkdtempSync(join(tmpdir(), 'self-update-home-'));
    try {
      execFileSync('git', ['clone', '--quiet', repoRoot, clone]);
      // The script may not be committed yet in a dev checkout; use the current one.
      copyFileSync(selfUpdateSh, join(clone, 'scripts', 'sdd-self-update.sh'));
      const res = await runScript(join(clone, 'scripts', 'sdd-self-update.sh'), ['--dry-run'], {
        SDD_CHECKOUT: clone,
        SDD_HOME: home,
      });
      expect(res.code).toBe(0);
      expect(res.stdout).toContain('[dry-run]');
      expect(res.stdout).toContain('dry run complete; nothing changed');
      // Nothing was staged or built.
      expect(existsSync(join(clone, 'dist'))).toBe(false);
      expect(existsSync(join(clone, '.claude', 'worktrees', 'self-update'))).toBe(false);
    } finally {
      rmSync(clone, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 30000);

  it('sdd-self-update.sh rebases store-only local commits when origin has advanced', async () => {
    const { checkout, origin, home } = makeDivergedCheckout();
    try {
      // The controller's store commit on local main: spec store + HANDOFF only.
      mkdirSync(join(checkout, '.spec-workflow', 'specs', 'foo'), { recursive: true });
      writeFileSync(join(checkout, '.spec-workflow', 'specs', 'foo', 'tasks.md'), '# tasks\n');
      writeFileSync(join(checkout, 'HANDOFF.md'), '# handoff\n');
      git(checkout, 'add', '-A');
      git(checkout, 'commit', '-qm', 'docs(sdd): store');

      const res = await runScript(selfUpdateSh, [], { SDD_CHECKOUT: checkout, SDD_HOME: home });

      // The local store commit was rebased onto origin/main, so origin/main is
      // now an ancestor of HEAD and the store file survives on top. The run then
      // moves past step (b) into the staging build (which fails in this toy repo).
      expect(res.stdout).toContain('rebasing');
      expect(res.stdout).toContain('building in staging');
      expect(res.stdout).not.toContain('refusing');
      expect(() => execFileSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: checkout })).not.toThrow();
      expect(existsSync(join(checkout, '.spec-workflow', 'specs', 'foo', 'tasks.md'))).toBe(true);
    } finally {
      rmSync(checkout, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 30000);

  it('sdd-self-update.sh refuses when a local-only commit touches a path outside the store', async () => {
    const { checkout, origin, home } = makeDivergedCheckout();
    try {
      // A stray local commit touching src/ must never be replayed by a self-update.
      writeFileSync(join(checkout, 'src', 'index.ts'), 'export const x = 1;\n// local hack\n');
      git(checkout, 'add', '-A');
      git(checkout, 'commit', '-qm', 'local src change');

      const res = await runScript(selfUpdateSh, [], { SDD_CHECKOUT: checkout, SDD_HOME: home });

      expect(res.code).toBe(1);
      expect(res.stdout).toContain('refusing');
      expect(res.stdout).toContain('src/index.ts');
      expect(res.stdout).not.toContain('building in staging');
      // Local main was left unmoved: not rebased, no staging worktree created.
      expect(() => execFileSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: checkout })).toThrow();
      expect(existsSync(join(checkout, '.claude', 'worktrees', 'self-update'))).toBe(false);
    } finally {
      rmSync(checkout, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 30000);
});
