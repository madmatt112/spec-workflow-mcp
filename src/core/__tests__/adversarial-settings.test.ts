import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn(actual.readFileSync),
    statSync: vi.fn(actual.statSync),
  };
});

import { promises as fs } from 'node:fs';
import * as nodeFs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadSettings,
  resolveRunnerModel,
  isTypecheckEnabled,
  __resetForTests,
  type AdversarialSettings,
} from '../adversarial-settings.js';

let tempDir: string;
let settingsPath: string;
let warnSpy: ReturnType<typeof vi.spyOn>;

async function writeSettings(value: unknown | string): Promise<void> {
  const json = typeof value === 'string' ? value : JSON.stringify(value);
  await fs.writeFile(settingsPath, json, 'utf-8');
}

async function bumpMtime(): Promise<void> {
  // Advance mtime by 2s so cache key (mtimeMs, size) changes deterministically
  // even on second-resolution filesystems.
  const newTime = new Date(Date.now() + 2_000);
  await fs.utimes(settingsPath, newTime, newTime);
}

beforeEach(async () => {
  tempDir = await fs.mkdtemp(join(tmpdir(), 'adv-settings-test-'));
  await fs.mkdir(join(tempDir, '.spec-workflow'), { recursive: true });
  settingsPath = join(tempDir, '.spec-workflow', 'adversarial-settings.json');
  __resetForTests();
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  warnSpy.mockRestore();
  vi.restoreAllMocks();
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe('loadSettings — ENOENT silent (fresh-project case)', () => {
  it('returns {} silently when file is absent', () => {
    const result = loadSettings(tempDir);
    expect(result).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('loadSettings — read-throw containment (R3.7)', () => {
  it.each([
    ['EBUSY', 'EBUSY'],
    ['EACCES', 'EACCES'],
    ['EISDIR', 'EISDIR'],
    ['ELOOP', 'ELOOP'],
  ])('catches %s from readFileSync, warns, returns {}', async (_label, code) => {
    await writeSettings({ model: 'ok' });
    const err = new Error(`simulated ${code}`) as NodeJS.ErrnoException;
    err.code = code;
    vi.mocked(nodeFs.readFileSync).mockImplementationOnce(() => {
      throw err;
    });

    const result = loadSettings(tempDir);
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0] as string;
    expect(msg).toMatch(
      /^\[spec-workflow\] adversarial-settings\.json: read failed \(.+?\) \(path: .+?\); falling back to defaults\. /,
    );
    expect(msg).toContain(code);
  });

  it('catches arbitrary I/O errors (not just the documented set), warns, returns {}', async () => {
    await writeSettings({ model: 'ok' });
    const err = new Error('synthetic') as NodeJS.ErrnoException;
    err.code = 'ENOTDIR';
    vi.mocked(nodeFs.readFileSync).mockImplementationOnce(() => {
      throw err;
    });

    const result = loadSettings(tempDir);
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('loadSettings — JSON parse failure', () => {
  it('returns {} and warns once with pinned format', async () => {
    await writeSettings('{ not valid json');
    const result = loadSettings(tempDir);
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0] as string;
    expect(msg).toMatch(
      /^\[spec-workflow\] adversarial-settings\.json: JSON parse failed \(path: .+?\); falling back to defaults\. /,
    );
  });
});

describe('loadSettings — top-level non-object tolerated (R3.6)', () => {
  it.each([
    ['array', '[1, 2, 3]', 'array'],
    ['number', '42', 'number'],
    ['string', '"hello"', 'string'],
    ['null', 'null', 'null'],
    ['boolean', 'true', 'boolean'],
  ])('warns + returns {} when top-level is %s', async (_label, raw, repr) => {
    await writeSettings(raw);
    const result = loadSettings(tempDir);
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0] as string;
    expect(msg).toContain('top-level value is not an object');
    expect(msg).toContain(`received: ${repr}`);
  });
});

describe('loadSettings — cache hit/miss with mid-session edit (R3.7)', () => {
  it('cache HIT: second call within unchanged (mtime, size) does not re-parse', async () => {
    await writeSettings({ model: 'X' });
    const r1 = loadSettings(tempDir);
    const r2 = loadSettings(tempDir);
    expect(r2).toBe(r1);
  });

  it('cache MISS on mtime advance: second call re-parses with updated content', async () => {
    await writeSettings({ model: 'X' });
    const r1 = loadSettings(tempDir);
    expect(r1.model).toBe('X');

    await writeSettings({ model: 'Y' });
    await bumpMtime();
    const r2 = loadSettings(tempDir);
    expect(r2.model).toBe('Y');
    expect(r2).not.toBe(r1);
  });

  it('cache MISS on size change at unchanged mtime: re-parses (covers second-resolution filesystems)', async () => {
    await writeSettings({ model: 'X' });
    // Round mtime down to second-precision so a later utimes round-trip preserves
    // mtimeMs exactly (Date input to utimes is millisecond-precision; on
    // nanosecond-mtime filesystems the kernel-recorded sub-ms is lost). Without
    // this, the post-utimes mtimeMs won't match the cached value and the cache
    // miss would be driven by mtime, not size.
    const fixedMtime = new Date(Math.floor(Date.now() / 1000) * 1000);
    await fs.utimes(settingsPath, fixedMtime, fixedMtime);
    const stat1 = await fs.stat(settingsPath);

    const r1 = loadSettings(tempDir);
    expect(r1.model).toBe('X');

    await writeSettings({ model: 'XYZ' });
    await fs.utimes(settingsPath, stat1.atime, stat1.mtime);
    const stat2 = await fs.stat(settingsPath);
    // Preconditions: same mtime, different size — proves the test exercises the
    // size component of the cache key, not mtime drift.
    expect(stat2.mtimeMs).toBe(stat1.mtimeMs);
    expect(stat2.size).not.toBe(stat1.size);

    const r2 = loadSettings(tempDir);
    expect(r2.model).toBe('XYZ');
  });
});

describe('loadSettings — warn-once dedup (R3.7)', () => {
  it('second identical-cause read is silent until (mtime, size) advances', async () => {
    await writeSettings('{ broken');
    loadSettings(tempDir);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Second call hits the negative cache entry (broken file is cached as {} keyed
    // by current mtime/size); warnOnce dedup is also a backstop if the cache is bypassed.
    loadSettings(tempDir);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('warn-once flag clears when (mtime, size) advances, allowing fresh warn', async () => {
    await writeSettings('{ broken');
    loadSettings(tempDir);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    await writeSettings('{ also broken');
    await bumpMtime();
    loadSettings(tempDir);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

describe('loadSettings — happy path returns parsed object', () => {
  it('parses well-formed settings and freezes the result', async () => {
    await writeSettings({
      adversarial: { model: 'opus' },
      taskReview: { model: 'haiku' },
      features: { typecheck: true },
      model: 'sonnet',
      cli: 'claude',
    });
    const settings = loadSettings(tempDir);
    expect(settings.adversarial?.model).toBe('opus');
    expect(settings.taskReview?.model).toBe('haiku');
    expect(settings.features?.typecheck).toBe(true);
    expect(settings.model).toBe('sonnet');
    expect(settings.cli).toBe('claude');
    expect(Object.isFrozen(settings)).toBe(true);
    expect(Object.isFrozen(settings.adversarial)).toBe(true);
    expect(Object.isFrozen(settings.features)).toBe(true);
  });
});

describe('resolveRunnerModel — R3.10 precedence matrix', () => {
  it('(a) grouped only → grouped wins', () => {
    const s: AdversarialSettings = { adversarial: { model: 'X' } };
    expect(resolveRunnerModel(s, 'adversarial')).toBe('X');
    expect(resolveRunnerModel(s, 'taskReview')).toBeUndefined();
  });

  it('(b) legacy only → legacy used for both runners', () => {
    const s: AdversarialSettings = { model: 'L' };
    expect(resolveRunnerModel(s, 'adversarial')).toBe('L');
    expect(resolveRunnerModel(s, 'taskReview')).toBe('L');
  });

  it('(c) both present → grouped wins over legacy', () => {
    const s: AdversarialSettings = {
      adversarial: { model: 'G' },
      model: 'L',
    };
    expect(resolveRunnerModel(s, 'adversarial')).toBe('G');
    expect(resolveRunnerModel(s, 'taskReview')).toBe('L');
  });

  it('(d) empty-string grouped falls back to legacy', () => {
    const s: AdversarialSettings = {
      adversarial: { model: '' },
      model: 'L',
    };
    expect(resolveRunnerModel(s, 'adversarial')).toBe('L');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('(e) null runner block treated as absent — silent', () => {
    const s = {
      adversarial: null,
      model: 'L',
    } as unknown as AdversarialSettings;
    expect(resolveRunnerModel(s, 'adversarial')).toBe('L');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('(f) unknown sub-keys silently ignored', () => {
    const s = {
      adversarial: { unknownKey: 'z', cliArgs: ['a'] },
      model: 'L',
    } as unknown as AdversarialSettings;
    expect(resolveRunnerModel(s, 'adversarial')).toBe('L');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('(g) all missing → undefined', () => {
    expect(resolveRunnerModel({}, 'adversarial')).toBeUndefined();
    expect(resolveRunnerModel({}, 'taskReview')).toBeUndefined();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('resolveRunnerModel — non-object runner block warns and falls through (R3.5)', () => {
  it('runner block is bare string → warn-once + fall through to legacy', () => {
    const s = {
      adversarial: 'opus',
      model: 'L',
    } as unknown as AdversarialSettings;
    expect(resolveRunnerModel(s, 'adversarial')).toBe('L');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0] as string;
    expect(msg).toContain("'adversarial' is present but not an object");
    expect(msg).toContain('received: string');
  });

  it('runner block is array → warn-once with received: array', () => {
    const s = {
      adversarial: ['opus'],
      model: 'L',
    } as unknown as AdversarialSettings;
    expect(resolveRunnerModel(s, 'adversarial')).toBe('L');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('received: array');
  });

  it('warn-once dedups identical cause across calls', () => {
    const s = {
      adversarial: 'opus',
      model: 'L',
    } as unknown as AdversarialSettings;
    resolveRunnerModel(s, 'adversarial');
    resolveRunnerModel(s, 'adversarial');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

describe('resolveRunnerModel — non-string model warns and falls through (R3.5)', () => {
  it.each([
    ['number', 42, 'number'],
    ['boolean', true, 'boolean'],
    ['array', ['opus'], 'array'],
    ['null', null, 'null'],
    ['object', { nested: 'x' }, 'object'],
  ])(
    'runner.model %s → warn-once + fall through, never passes through',
    (_label, value, repr) => {
      const s = {
        adversarial: { model: value },
        model: 'L',
      } as unknown as AdversarialSettings;
      const resolved = resolveRunnerModel(s, 'adversarial');
      expect(resolved).toBe('L');
      expect(typeof resolved === 'string' || resolved === undefined).toBe(true);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg = warnSpy.mock.calls[0][0] as string;
      expect(msg).toContain("'adversarial.model' is present but not a string");
      expect(msg).toContain(`received: ${repr}`);
    },
  );

  it('legacy non-string model → warn-once + undefined returned', () => {
    const s = { model: 42 } as unknown as AdversarialSettings;
    expect(resolveRunnerModel(s, 'adversarial')).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("legacy 'model' is present but not a string");
  });
});

describe('isTypecheckEnabled — R3.12 matrix (silent vs warn distinction matters)', () => {
  it('returns true when features is absent (default)', () => {
    expect(isTypecheckEnabled({})).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('features === null → silent-absent (default true)', () => {
    const s = { features: null } as unknown as AdversarialSettings;
    expect(isTypecheckEnabled(s)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('features non-object (string) → warn-once + default true', () => {
    const s = { features: 'on' } as unknown as AdversarialSettings;
    expect(isTypecheckEnabled(s)).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("'features' is present but not an object");
    expect(warnSpy.mock.calls[0][0]).toContain('received: string');
  });

  it('features non-object (array) → warn-once + default true', () => {
    const s = { features: ['typecheck'] } as unknown as AdversarialSettings;
    expect(isTypecheckEnabled(s)).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('received: array');
  });

  it('features non-object (number) → warn-once + default true', () => {
    const s = { features: 1 } as unknown as AdversarialSettings;
    expect(isTypecheckEnabled(s)).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('features.typecheck === false → returns false (the only false-producing branch)', () => {
    expect(isTypecheckEnabled({ features: { typecheck: false } })).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('features.typecheck === true → returns true', () => {
    expect(isTypecheckEnabled({ features: { typecheck: true } })).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('features.typecheck absent (features object empty) → silent default true', () => {
    expect(isTypecheckEnabled({ features: {} })).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('features.typecheck === "" → silent-absent (default true)', () => {
    const s = { features: { typecheck: '' } } as unknown as AdversarialSettings;
    expect(isTypecheckEnabled(s)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['number 0', 0, 'number'],
    ['number 1', 1, 'number'],
    ['string "true"', 'true', 'string'],
    ['string "false"', 'false', 'string'],
    ['null', null, 'null'],
    ['array', [true], 'array'],
  ])('features.typecheck = %s → warn-once naming the value type, default true', (_label, value, repr) => {
    const s = { features: { typecheck: value } } as unknown as AdversarialSettings;
    expect(isTypecheckEnabled(s)).toBe(true);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg = warnSpy.mock.calls[0][0] as string;
    expect(msg).toContain("'features.typecheck' is present but not a boolean");
    expect(msg).toContain(`received: ${repr}`);
  });

  it('unknown keys under features silently ignored (forward-compat)', () => {
    const s = {
      features: { typecheck: true, futureFlag: 'whatever' },
    } as unknown as AdversarialSettings;
    expect(isTypecheckEnabled(s)).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
