import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'fs';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const HERE = dirname(fileURLToPath(import.meta.url));
// src/evals/__tests__ -> ../../../dist/evals/cli.js (built by `npm run build`).
const builtCli = join(HERE, '..', '..', '..', 'dist', 'evals', 'cli.js');

// Retro eval-gate-runs P1 (F1): when `process.argv[1]` is a symlink to the built
// entry, `resolveEntrypoint` must `realpathSync` it so it matches the realpath'd
// `import.meta.url` and `main()` runs. Before the fix the symlink stayed
// unresolved, the equality never held, and the entry printed nothing and exited 0.
describe('cli entry guard through a symlink', () => {
  it('runs main() when invoked through a symlink to the built entry', () => {
    if (!existsSync(builtCli)) {
      throw new Error(`built entry missing: ${builtCli} (run npm run build first)`);
    }
    const dir = mkdtempSync(join(tmpdir(), 'eval-cli-symlink-'));
    const link = join(dir, 'cli-link.js');
    symlinkSync(builtCli, link);
    try {
      let exit = 0;
      let output = '';
      try {
        output = execFileSync('node', [link, '--totally-bogus'], { encoding: 'utf8' });
      } catch (err) {
        const e = err as { status?: number; stdout?: string };
        exit = e.status ?? 1;
        output = e.stdout ?? '';
      }
      // main() ran: an unknown flag exits 2 with a usage line, not the silent exit 0.
      expect(exit).toBe(2);
      expect(output).toMatch(/usage/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
