import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, copyFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
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

// A build-stage test seam (design Component 10 change 3, D8): writes a stub
// `dist/evals/cli.js` into the staging worktree so step (c) succeeds without a
// real `npm run build`, which the toy fixtures above cannot run (no build script).
function stageBuildStub(body: string): string {
  return `mkdir -p dist/evals\ncat > dist/evals/cli.js <<'JSEOF'\n${body}\nJSEOF\n`;
}

// Design Component 5 (scripts/sdd-self-update.sh:231-237): the dry run's `select` call
// reads `base`/`target` straight off the checkout's own git history, so a toy checkout
// whose HEAD holds one case and its role file, with `origin/main` ahead by a role edit
// and an added case, exercises the real selection reasons (`role`, `case`) without a
// live build.
function makeEvalSelectionCheckout(): { checkout: string; origin: string; home: string } {
  const origin = mkdtempSync(join(tmpdir(), 'self-update-eval-origin-'));
  const checkout = mkdtempSync(join(tmpdir(), 'self-update-eval-co-'));
  const home = mkdtempSync(join(tmpdir(), 'self-update-eval-home-'));
  git(origin, 'init', '-q', '-b', 'main');
  git(origin, 'config', 'user.email', 't@example.com');
  git(origin, 'config', 'user.name', 'Test');
  mkdirSync(join(origin, 'harness', 'agents'), { recursive: true });
  mkdirSync(join(origin, 'harness', 'evals', 'alpha'), { recursive: true });
  writeFileSync(join(origin, 'harness', 'agents', 'demo-role.md'), 'role v1\n');
  writeFileSync(
    join(origin, 'harness', 'evals', 'alpha', 'case.json'),
    `${JSON.stringify({ role: 'demo-role', graders: [] })}\n`,
  );
  git(origin, 'add', '-A');
  git(origin, 'commit', '-qm', 'init');
  execFileSync('git', ['clone', '--quiet', origin, checkout]);
  git(checkout, 'config', 'user.email', 't@example.com');
  git(checkout, 'config', 'user.name', 'Test');
  // origin advances with a role edit and an added case.
  writeFileSync(join(origin, 'harness', 'agents', 'demo-role.md'), 'role v2\n');
  mkdirSync(join(origin, 'harness', 'evals', 'beta'), { recursive: true });
  writeFileSync(
    join(origin, 'harness', 'evals', 'beta', 'case.json'),
    `${JSON.stringify({ role: 'other-role', graders: [] })}\n`,
  );
  git(origin, 'add', '-A');
  git(origin, 'commit', '-qm', 'role edit + added case');
  return { checkout, origin, home };
}

// A wrapper, not a symlink: a symlinked `dist` prints nothing (src/evals/cli.ts:208-215,
// the entrypoint/currentFile comparison). The wrapper dynamic-imports this repository's
// own built `dist/evals/cli.js`, calls `main`, and exits with its code.
function writeEvalCliWrapper(checkout: string): void {
  mkdirSync(join(checkout, 'dist', 'evals'), { recursive: true });
  const realCli = pathToFileURL(join(repoRoot, 'dist', 'evals', 'cli.js')).href;
  writeFileSync(
    join(checkout, 'dist', 'evals', 'cli.js'),
    `import(${JSON.stringify(realCli)}).then((m) => m.main(process.argv.slice(2))).then((code) => { process.exit(code); });\n`,
  );
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
      expect(res.stdout).toContain('eval selection unavailable');
      expect(res.stdout).toContain('dry run complete; nothing changed');
      // Nothing was staged or built.
      expect(existsSync(join(clone, 'dist'))).toBe(false);
      expect(existsSync(join(clone, '.claude', 'worktrees', 'self-update'))).toBe(false);
    } finally {
      rmSync(clone, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 30000);

  it('sdd-self-update.sh --dry-run prints the select counts for a role edit and an added case, and changes nothing', async () => {
    const { checkout, origin, home } = makeEvalSelectionCheckout();
    try {
      writeEvalCliWrapper(checkout);
      // The dry run itself never fetches (scripts/sdd-self-update.sh:176-178), so the
      // test fetches origin/main before invoking it.
      git(checkout, 'fetch', 'origin');
      const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout }).toString().trim();
      const statusBefore = execFileSync('git', ['status', '--porcelain'], { cwd: checkout }).toString();

      const res = await runScript(selfUpdateSh, ['--dry-run'], { SDD_CHECKOUT: checkout, SDD_HOME: home });

      expect(res.code).toBe(0);
      expect(res.stdout).toContain('select alpha: role: 1 run');
      expect(res.stdout).toContain('select beta: case: 3 runs');
      expect(res.stdout).toContain('select: 2 cases, 4 runs');
      // No case actually ran: the select call never touches the results dir (and so
      // never spawns a stub `claude`, which would leave a `.counter` sibling behind).
      expect(existsSync(join(home, 'evals'))).toBe(false);
      const headAfter = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout }).toString().trim();
      const statusAfter = execFileSync('git', ['status', '--porcelain'], { cwd: checkout }).toString();
      expect(headAfter).toBe(headBefore);
      expect(statusAfter).toBe(statusBefore);
    } finally {
      rmSync(checkout, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
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

      const res = await runScript(selfUpdateSh, [], {
        SDD_CHECKOUT: checkout, SDD_HOME: home,
        SDD_STAGE_BUILD: stageBuildStub('process.exit(0);'), SDD_STAGE_SMOKE: 'true',
      });

      // The local store commit is rebased onto origin/main only after the staged
      // build and smoke boot pass, so `building in staging` prints before
      // `rebasing`; the store file survives on top of origin/main.
      expect(res.stdout).toContain('rebasing');
      expect(res.stdout).toContain('building in staging');
      expect(res.stdout.indexOf('building in staging')).toBeLessThan(res.stdout.indexOf('rebasing'));
      expect(res.stdout).not.toContain('refusing');
      expect(() => execFileSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: checkout })).not.toThrow();
      expect(existsSync(join(checkout, '.spec-workflow', 'specs', 'foo', 'tasks.md'))).toBe(true);
    } finally {
      rmSync(checkout, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 30000);

  it('sdd-self-update.sh autostashes a dirty tracked store file while rebasing', async () => {
    const { checkout, origin, home } = makeDivergedCheckout();
    try {
      const ledger = join(checkout, '.spec-workflow', 'specs', 'foo', 'harness-events.jsonl');
      mkdirSync(join(checkout, '.spec-workflow', 'specs', 'foo'), { recursive: true });
      writeFileSync(ledger, '{"n":1}\n');
      git(checkout, 'add', '-A');
      git(checkout, 'commit', '-qm', 'docs(sdd): store');
      // A live run appends to the ledger without committing.
      writeFileSync(ledger, '{"n":1}\n{"n":2}\n');

      const res = await runScript(selfUpdateSh, [], {
        SDD_CHECKOUT: checkout, SDD_HOME: home,
        SDD_STAGE_BUILD: stageBuildStub('process.exit(0);'), SDD_STAGE_SMOKE: 'true',
      });

      expect(res.stdout).toContain('rebasing');
      expect(res.stdout).toContain('building in staging');
      expect(res.stdout.indexOf('building in staging')).toBeLessThan(res.stdout.indexOf('rebasing'));
      expect(res.stdout).not.toContain('refusing');
      expect(() => execFileSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: checkout })).not.toThrow();
      expect(readFileSync(ledger, 'utf-8')).toBe('{"n":1}\n{"n":2}\n');
    } finally {
      rmSync(checkout, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 30000);

  it('sdd-self-update.sh refuses when a tracked file outside the store is dirty', async () => {
    const { checkout, origin, home } = makeDivergedCheckout();
    try {
      mkdirSync(join(checkout, '.spec-workflow', 'specs', 'foo'), { recursive: true });
      writeFileSync(join(checkout, '.spec-workflow', 'specs', 'foo', 'tasks.md'), '# tasks\n');
      git(checkout, 'add', '-A');
      git(checkout, 'commit', '-qm', 'docs(sdd): store');
      writeFileSync(join(checkout, 'src', 'index.ts'), 'export const x = 1;\n// dirty\n');

      const res = await runScript(selfUpdateSh, [], { SDD_CHECKOUT: checkout, SDD_HOME: home });

      expect(res.code).toBe(1);
      expect(res.stdout).toContain('refusing');
      expect(res.stdout).toContain('src/index.ts');
      expect(res.stdout).not.toContain('building in staging');
      expect(() => execFileSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: checkout })).toThrow();
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

  it('sdd-self-update.sh refuses on a failing eval stage and leaves HEAD, harness/ and dist/ unchanged', async () => {
    const { checkout, origin, home } = makeDivergedCheckout();
    try {
      const originalHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout }).toString().trim();
      mkdirSync(join(checkout, 'harness'), { recursive: true });
      writeFileSync(join(checkout, 'harness', 'marker.txt'), 'original\n');

      const res = await runScript(selfUpdateSh, [], {
        SDD_CHECKOUT: checkout, SDD_HOME: home,
        SDD_STAGE_BUILD: stageBuildStub('process.exit(1);'), SDD_STAGE_SMOKE: 'true',
      });

      // The staged gate failed, so the live-checkout move (deferred to step (f))
      // never ran: HEAD stays where it was before the update, not fast-forwarded.
      expect(res.code).toBe(1);
      expect(res.stdout).toContain('writing an error wait');
      expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout }).toString().trim()).toBe(originalHead);
      expect(readFileSync(join(checkout, 'harness', 'marker.txt'), 'utf-8')).toBe('original\n');
      expect(existsSync(join(checkout, 'dist'))).toBe(false);
    } finally {
      rmSync(checkout, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 30000);

  it('sdd-self-update.sh writes an error wait naming the staged gate summary, leaving the waits stub and HEAD unchanged', async () => {
    const { checkout, origin, home } = makeDivergedCheckout();
    try {
      const originalHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout }).toString().trim();
      // A stub `dist/controller/waits.js` in the live checkout (design D8): the toy
      // package has no `type` field, so this is CommonJS with `exports.createWait`. It
      // records the wait text it is given to a file under the test's home.
      mkdirSync(join(checkout, 'dist', 'controller'), { recursive: true });
      const waitsStub = [
        "const fs = require('fs');",
        "const path = require('path');",
        'exports.createWait = async function (opts) {',
        "  fs.writeFileSync(path.join(process.env.SDD_HOME, 'wait-record.txt'), opts.questions[0].text);",
        '};',
        '',
      ].join('\n');
      writeFileSync(join(checkout, 'dist', 'controller', 'waits.js'), waitsStub);

      const res = await runScript(selfUpdateSh, [], {
        SDD_CHECKOUT: checkout, SDD_HOME: home,
        SDD_STAGE_BUILD: stageBuildStub(
          [
            "const fs = require('fs');",
            "const i = process.argv.indexOf('--summary-file');",
            "fs.writeFileSync(process.argv[i + 1], 'demo fail 0/1 stub reason; record /x');",
            'process.exit(1);',
          ].join('\n'),
        ),
        SDD_STAGE_SMOKE: 'true',
      });

      expect(res.code).toBe(1);
      expect(res.stdout).toContain('writing an error wait');
      expect(readFileSync(join(home, 'wait-record.txt'), 'utf-8')).toContain('demo fail 0/1');
      expect(readFileSync(join(checkout, 'dist', 'controller', 'waits.js'), 'utf-8')).toBe(waitsStub);
      expect(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout }).toString().trim()).toBe(originalHead);
    } finally {
      rmSync(checkout, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 30000);

  it('sdd-self-update.sh forwards two --eval-override values as two --override arguments to the staged gate', async () => {
    const { checkout, origin, home } = makeDivergedCheckout();
    const argsFile = join(home, 'invocation-args.txt');
    try {
      const res = await runScript(selfUpdateSh, ['--eval-override', 'case-one', '--eval-override', 'case-two'], {
        SDD_CHECKOUT: checkout, SDD_HOME: home,
        SDD_STAGE_BUILD: stageBuildStub(
          [
            "import { writeFileSync } from 'node:fs';",
            `writeFileSync(${JSON.stringify(argsFile)}, process.argv.slice(2).join('\\n'));`,
            'process.exit(1);',
          ].join('\n'),
        ),
        SDD_STAGE_SMOKE: 'true',
      });

      expect(res.code).toBe(1);
      expect(existsSync(argsFile)).toBe(true);
      const lines = readFileSync(argsFile, 'utf-8').split('\n');
      const overrideIdx = lines.reduce<number[]>((acc, l, i) => (l === '--override' ? [...acc, i] : acc), []);
      expect(overrideIdx).toHaveLength(2);
      expect(lines[overrideIdx[0] + 1]).toBe('case-one');
      expect(lines[overrideIdx[1] + 1]).toBe('case-two');
    } finally {
      rmSync(checkout, { recursive: true, force: true });
      rmSync(origin, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 30000);

  it('sdd-self-update.sh exits 2 when --eval-override has no value', async () => {
    const res = await runScript(selfUpdateSh, ['--eval-override'], {});
    expect(res.code).toBe(2);
  });

  // Task 7 (design C4): --deploy-record <path>, write_stage, the commit write,
  // and the three-second restart gap. Each stage seam below copies the
  // record's current `stage` field into a shared log through
  // LOG_STAGE_SCRIPT, proving each write happens before the step it gates.
  describe('sdd-self-update.sh --deploy-record', () => {
    it(
      'runs build, smoke, gate, swap, restart in order, ends at done, keeps a field it ' +
        "does not set, matches the toy origin's commit, leaves no temp file beside the " +
        'record, and waits at least 3 seconds before the restart',
      async () => {
        const { checkout, origin, home } = makeDivergedCheckout();
        const stubDir = mkdtempSync(join(tmpdir(), 'self-update-stubs-'));
        const recordPath = join(home, 'deploy.json');
        const seqLog = join(home, 'seq.log');
        const gapFile = join(home, 'gap.txt');
        const logStageScript = join(stubDir, 'log-stage.cjs');
        try {
          writeFileSync(
            recordPath,
            JSON.stringify({ v: 1, stage: 'wait', runs: ['run-1'], started: new Date().toISOString() }),
          );
          writeFileSync(seqLog, '');
          writeFileSync(
            logStageScript,
            [
              "const fs = require('fs');",
              "const rec = JSON.parse(fs.readFileSync(process.env.RECORD_PATH, 'utf8'));",
              "fs.appendFileSync(process.env.SEQ_LOG, rec.stage + '\\n');",
              '',
            ].join('\n'),
          );
          writeFileSync(
            join(stubDir, 'npm'),
            ['#!/usr/bin/env node', 'require(process.env.LOG_STAGE_SCRIPT);', ''].join('\n'),
            { mode: 0o755 },
          );
          writeFileSync(
            join(stubDir, 'systemctl'),
            [
              '#!/usr/bin/env node',
              "const fs = require('fs');",
              'require(process.env.LOG_STAGE_SCRIPT);',
              'const gap = Date.now() - fs.statSync(process.env.RECORD_PATH).mtimeMs;',
              'fs.writeFileSync(process.env.GAP_FILE, String(gap));',
              '',
            ].join('\n'),
            { mode: 0o755 },
          );
          const gateBody = ['require(process.env.LOG_STAGE_SCRIPT);', 'process.exit(0);', ''].join('\n');

          const res = await runScript(selfUpdateSh, ['--deploy-record', recordPath], {
            SDD_CHECKOUT: checkout,
            SDD_HOME: home,
            PATH: `${stubDir}:${process.env.PATH ?? ''}`,
            RECORD_PATH: recordPath,
            SEQ_LOG: seqLog,
            GAP_FILE: gapFile,
            LOG_STAGE_SCRIPT: logStageScript,
            SDD_STAGE_BUILD: `node "$LOG_STAGE_SCRIPT"\n${stageBuildStub(gateBody)}`,
            SDD_STAGE_SMOKE: 'node "$LOG_STAGE_SCRIPT"',
          });

          expect(res.code).toBe(0);
          const seq = readFileSync(seqLog, 'utf-8').split('\n').filter((l) => l.trim().length > 0);
          expect(seq).toEqual(['build', 'smoke', 'gate', 'swap', 'restart']);

          const final = JSON.parse(readFileSync(recordPath, 'utf-8'));
          expect(final.stage).toBe('done');
          expect(final.runs).toEqual(['run-1']); // a seeded field the script never sets (R2 AC5)

          const originHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: origin }).toString().trim();
          expect(final.commit).toBe(originHead); // R2 AC2

          const leftovers = readdirSync(home).filter((f) => f !== 'deploy.json' && f.includes('deploy'));
          expect(leftovers).toEqual([]); // the atomic write leaves no temp file (R2 AC5)

          const gap = Number(readFileSync(gapFile, 'utf-8'));
          expect(gap).toBeGreaterThanOrEqual(2500); // R2 AC6 / D6: a 3-second sleep before the restart
        } finally {
          rmSync(checkout, { recursive: true, force: true });
          rmSync(origin, { recursive: true, force: true });
          rmSync(home, { recursive: true, force: true });
          rmSync(stubDir, { recursive: true, force: true });
        }
      },
      30000,
    );

    it('a build seam that deletes the record leaves it absent, not recreated (requirement 5 AC 2)', async () => {
      const { checkout, origin, home } = makeDivergedCheckout();
      const recordPath = join(home, 'deploy.json');
      try {
        writeFileSync(
          recordPath,
          JSON.stringify({ v: 1, stage: 'wait', runs: [], started: new Date().toISOString() }),
        );

        const res = await runScript(selfUpdateSh, ['--deploy-record', recordPath], {
          SDD_CHECKOUT: checkout,
          SDD_HOME: home,
          RECORD_PATH: recordPath,
          SDD_STAGE_BUILD: 'rm -f "$RECORD_PATH"',
          SDD_STAGE_SMOKE: 'true',
        });

        expect(res.code).not.toBe(0);
        expect(existsSync(recordPath)).toBe(false);
      } finally {
        rmSync(checkout, { recursive: true, force: true });
        rmSync(origin, { recursive: true, force: true });
        rmSync(home, { recursive: true, force: true });
      }
    }, 30000);

    it('--dry-run with --deploy-record leaves the record bytes unchanged (R2 AC 7)', async () => {
      const clone = mkdtempSync(join(tmpdir(), 'self-update-clone-'));
      const home = mkdtempSync(join(tmpdir(), 'self-update-home-'));
      const recordPath = join(home, 'deploy.json');
      try {
        execFileSync('git', ['clone', '--quiet', repoRoot, clone]);
        copyFileSync(selfUpdateSh, join(clone, 'scripts', 'sdd-self-update.sh'));
        const seeded = JSON.stringify({ v: 1, stage: 'build', runs: ['run-9'], started: '2026-01-01T00:00:00.000Z' });
        writeFileSync(recordPath, seeded);

        const res = await runScript(join(clone, 'scripts', 'sdd-self-update.sh'), ['--dry-run', '--deploy-record', recordPath], {
          SDD_CHECKOUT: clone,
          SDD_HOME: home,
        });

        expect(res.code).toBe(0);
        expect(readFileSync(recordPath, 'utf-8')).toBe(seeded);
      } finally {
        rmSync(clone, { recursive: true, force: true });
        rmSync(home, { recursive: true, force: true });
      }
    }, 30000);

    // Regression guard (requirement 2 AC 8, invariant, "not red-first"): no
    // existing test passes --deploy-record, so this already holds at base;
    // the branch "no record is written" has no prior assertion, so it is
    // added fresh here rather than left unnamed.
    it('writes no deploy record when --deploy-record is absent', async () => {
      const clone = mkdtempSync(join(tmpdir(), 'self-update-clone-'));
      const home = mkdtempSync(join(tmpdir(), 'self-update-home-'));
      try {
        execFileSync('git', ['clone', '--quiet', repoRoot, clone]);
        copyFileSync(selfUpdateSh, join(clone, 'scripts', 'sdd-self-update.sh'));

        await runScript(join(clone, 'scripts', 'sdd-self-update.sh'), ['--dry-run'], {
          SDD_CHECKOUT: clone,
          SDD_HOME: home,
        });

        expect(existsSync(join(home, 'deploy.json'))).toBe(false);
      } finally {
        rmSync(clone, { recursive: true, force: true });
        rmSync(home, { recursive: true, force: true });
      }
    }, 30000);

    // Regression guard: the parser's existing catch-all already exits 2 for
    // any unrecognized token, so a bare --deploy-record with no path already
    // exits 2 at base, mirroring the --eval-override test above.
    it('exits 2 when --deploy-record has no path', async () => {
      const res = await runScript(selfUpdateSh, ['--deploy-record'], {});
      expect(res.code).toBe(2);
    });
  });
});
