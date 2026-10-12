import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

// Contract for controller-tasks.md T9: `node dist/index.js --dashboard --smoke
// --port <free>` starts, requests /api/health, prints it and exits 0 within 30
// seconds. This is an integration test over the built entrypoint, so it is
// skipped when there is no build. It must never touch the live dashboard's
// session: --smoke isolates the global session dir to a throwaway, which this
// test relies on (it sets no SPEC_WORKFLOW_HOME).

const distIndex = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist', 'index.js');
const hasBuild = existsSync(distIndex);

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      if (!a || typeof a === 'string') { s.close(); reject(new Error('no port')); return; }
      const port = a.port;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

describe.skipIf(!hasBuild)('--dashboard --smoke (controller T9)', () => {
  it('starts, prints /api/health and exits 0 within 30 seconds', async () => {
    const port = await getFreePort();
    const sddHome = mkdtempSync(join(tmpdir(), 'smoke-flag-home-'));

    const result = await new Promise<{ code: number | null; stdout: string }>((resolve, reject) => {
      const child = spawn('node', [distIndex, '--dashboard', '--smoke', '--port', String(port)], {
        env: { ...process.env, SDD_HOME: sddHome },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      child.stdout.on('data', (d) => { stdout += d.toString(); });
      const killTimer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('smoke did not exit in time')); }, 29000);
      child.on('error', (e) => { clearTimeout(killTimer); reject(e); });
      child.on('exit', (code) => { clearTimeout(killTimer); resolve({ code, stdout }); });
    });

    expect(result.code).toBe(0);
    const health = JSON.parse(result.stdout.trim());
    expect(health.ok).toBe(true);
    expect(health.slots).toHaveProperty('total');
  }, 30000);
});
