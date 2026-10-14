import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, copyFileSync } from 'fs';
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
        if (healthy) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, version: 'x' })); }
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
      const env = { SDD_PORT: String(port), SDD_HOME: home, SDD_WATCHDOG_FAIL_THRESHOLD: '3' };

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
});
