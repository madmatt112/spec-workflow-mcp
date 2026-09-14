import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runChecks, lastLine, CHECK_TIMEOUT_MS, CHECK_MAX_BUFFER } from '../check-runner.js';

// The real node binary running the tests; absolute, so PATH scrubbing is moot.
const NODE = process.execPath;

let root: string;

beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'check-runner-'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('constants', () => {
  it('pins the per-check budget and buffer cap', () => {
    expect(CHECK_TIMEOUT_MS).toBe(300_000);
    expect(CHECK_MAX_BUFFER).toBe(16 * 1024 * 1024);
  });
});

describe('lastLine', () => {
  it('takes the last non-empty line of stdout then stderr', () => {
    expect(lastLine('first\nsecond\n\n', '')).toBe('second');
    // stderr is appended after stdout, so its last line wins.
    expect(lastLine('out', 'err-a\nerr-b\n')).toBe('err-b');
    // no output at all yields the empty string.
    expect(lastLine('', '')).toBe('');
  });

  it('trims to 200 characters', () => {
    const line = lastLine('x'.repeat(250), '');
    expect(line).toHaveLength(200);
  });
});

describe('runChecks', () => {
  it('reports a passing command', async () => {
    const results = await runChecks(root, [`"${NODE}" -e "console.log('ok')"`]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('pass');
    expect(results[0].exitCode).toBe(0);
    expect(results[0].output).toBe('ok');
  });

  it('reports a non-zero exit as fail with the exit code', async () => {
    const results = await runChecks(root, [`"${NODE}" -e "console.error('boom'); process.exit(3)"`]);
    expect(results[0].status).toBe('fail');
    expect(results[0].exitCode).toBe(3);
    expect(results[0].output).toBe('boom');
  });

  it('reports a check that exceeds the timeout as timeout', async () => {
    const results = await runChecks(
      root,
      [`"${NODE}" -e "setTimeout(()=>{}, 5000)"`],
      { timeoutMs: 100 },
    );
    expect(results[0].status).toBe('timeout');
    expect(results[0].exitCode).toBeNull();
  });

  it('runs the commands in order, awaited one at a time', async () => {
    const marker = join(root, 'order.txt');
    // The first command sleeps before appending; a parallel runner would let
    // the second finish first. Sequential order yields 'ab'.
    const results = await runChecks(root, [
      `"${NODE}" -e "setTimeout(()=>require('fs').appendFileSync('${marker}','a'),150)"`,
      `"${NODE}" -e "require('fs').appendFileSync('${marker}','b')"`,
    ]);
    expect(results.map((r) => r.status)).toEqual(['pass', 'pass']);
    const written = await fs.readFile(marker, 'utf-8');
    expect(written).toBe('ab');
  });
});
