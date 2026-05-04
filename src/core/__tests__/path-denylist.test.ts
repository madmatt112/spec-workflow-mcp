import { describe, it, expect } from 'vitest';
import {
  partitionPaths,
  splitSegments,
  validateEntries,
  TEST_FIXTURE_SEGMENTS,
} from '../path-denylist.js';

const CASE_INSENSITIVE_VOLUME =
  process.platform === 'darwin' || process.platform === 'win32';

function expectSkipped(p: string) {
  const { kept, skipped } = partitionPaths([p]);
  expect(skipped).toEqual([p]);
  expect(kept).toEqual([]);
}

function expectKept(p: string) {
  const { kept, skipped } = partitionPaths([p]);
  expect(kept).toEqual([p]);
  expect(skipped).toEqual([]);
}

describe('partitionPaths — secret-bearing entries (always case-folded)', () => {
  it('skips exact secret basenames regardless of case', () => {
    expectSkipped('app/.env');
    expectSkipped('app/.ENV');
    expectSkipped('home/user/.npmrc');
    expectSkipped('home/user/.NPMRC');
    expectSkipped('home/user/.netrc');
    expectSkipped('home/user/.NETRC');
    expectSkipped('proj/.pypirc');
    expectSkipped('proj/.PYPIRC');
  });

  it('skips secret suffixes regardless of case', () => {
    expectSkipped('certs/server.pem');
    expectSkipped('certs/server.PEM');
    expectSkipped('certs/server.Pem');
    expectSkipped('certs/private.key');
    expectSkipped('certs/private.KEY');
  });

  it('skips secret prefixes regardless of case', () => {
    expectSkipped('home/user/.ssh/id_rsa');
    expectSkipped('home/user/.ssh/ID_RSA');
    expectSkipped('home/user/.ssh/id_rsa.pub');
    expectSkipped('home/user/.ssh/ID_RSA.PUB');
    expectSkipped('home/user/.ssh/id_ed25519');
    expectSkipped('home/user/.ssh/ID_ED25519');
    expectSkipped('home/user/.ssh/id_ecdsa');
    expectSkipped('home/user/.ssh/id_dsa');
  });
});

describe('partitionPaths — lock-file basenames (case-folded only on case-insensitive volumes)', () => {
  it('skips canonical-case lock files on every platform', () => {
    expectSkipped('proj/package-lock.json');
    expectSkipped('proj/pnpm-lock.yaml');
    expectSkipped('proj/yarn.lock');
    expectSkipped('proj/Gemfile.lock');
    expectSkipped('proj/Cargo.lock');
    expectSkipped('proj/go.sum');
    expectSkipped('proj/poetry.lock');
    expectSkipped('proj/Pipfile.lock');
    expectSkipped('proj/composer.lock');
    expectSkipped('proj/mix.lock');
  });

  if (CASE_INSENSITIVE_VOLUME) {
    it('skips uppercase variants on case-insensitive volumes (darwin/win32)', () => {
      expectSkipped('proj/PACKAGE-LOCK.JSON');
      expectSkipped('proj/Yarn.LOCK');
      expectSkipped('proj/CARGO.lock');
    });
  } else {
    it('keeps non-canonical-case variants on case-sensitive volumes (linux)', () => {
      expectKept('proj/PACKAGE-LOCK.JSON');
      expectKept('proj/Cargo.LOCK');
    });
  }
});

describe('partitionPaths — non-secret suffixes (case-folded only on case-insensitive volumes)', () => {
  it('skips canonical-case non-secret suffixes on every platform', () => {
    expectSkipped('build/bundle.min.js');
    expectSkipped('build/bundle.min.css');
    expectSkipped('build/bundle.map');
    expectSkipped('snapshots/foo.snap');
    expectSkipped('proj/random.lock');
  });

  if (CASE_INSENSITIVE_VOLUME) {
    it('skips uppercase suffix variants on case-insensitive volumes', () => {
      expectSkipped('build/bundle.MIN.JS');
      expectSkipped('build/bundle.Min.Css');
      expectSkipped('build/bundle.MAP');
      expectSkipped('snapshots/foo.SNAP');
    });
  } else {
    it('keeps uppercase suffix variants on case-sensitive volumes (linux)', () => {
      expectKept('build/bundle.MIN.JS');
      expectKept('build/bundle.Min.Css');
      expectKept('build/bundle.MAP');
      expectKept('snapshots/foo.SNAP');
    });
  }
});

describe('partitionPaths — path-segment matches (unconditionally case-insensitive)', () => {
  it('skips paths whose segments match the segment denylist regardless of case', () => {
    expectSkipped('proj/secrets/foo.json');
    expectSkipped('proj/SECRETS/foo.json');
    expectSkipped('proj/Secrets/foo.json');
    expectSkipped('proj/credentials/db.yml');
    expectSkipped('proj/CREDENTIALS/db.yml');
    expectSkipped('proj/.aws/config');
    expectSkipped('proj/.AWS/config');
    expectSkipped('proj/.kube/config');
    expectSkipped('proj/.docker/config.json');
  });
});

describe('partitionPaths — narrowed test-fixture exception (R1.6)', () => {
  it('exempts path-segment matches when a fixture segment is present', () => {
    expectKept('proj/__tests__/secrets/foo.json');
    expectKept('proj/__fixtures__/credentials/db.yml');
    expectKept('proj/fixtures/.aws/config');
    expectKept('proj/test-data/.kube/config');
    expectKept('proj/testdata/.docker/config.json');
  });

  it('exemption is case-insensitive on the fixture segment', () => {
    expectKept('proj/__TESTS__/secrets/foo.json');
    expectKept('proj/__Fixtures__/credentials/db.yml');
    expectKept('proj/TestData/.docker/config.json');
  });

  it('exemption does NOT extend to secret basename/suffix/prefix rules', () => {
    expectSkipped('proj/__tests__/.env');
    expectSkipped('proj/__fixtures__/server.pem');
    expectSkipped('proj/fixtures/private.key');
    expectSkipped('proj/__tests__/id_rsa');
    expectSkipped('proj/__fixtures__/.npmrc');
  });

  it('exemption does NOT extend to lock-file basenames or non-secret suffixes', () => {
    expectSkipped('proj/__tests__/package-lock.json');
    expectSkipped('proj/__fixtures__/yarn.lock');
    expectSkipped('proj/fixtures/bundle.min.js');
  });

  it('exposes TEST_FIXTURE_SEGMENTS as the documented set', () => {
    expect([...TEST_FIXTURE_SEGMENTS].sort()).toEqual(
      ['__fixtures__', '__tests__', 'fixtures', 'test-data', 'testdata'].sort()
    );
  });
});

describe('partitionPaths — cross-platform separator splitting', () => {
  it('skips Windows-style backslash paths on Linux+ POSIX (mixed-separator bypass closed)', () => {
    expectSkipped('proj\\secrets\\foo.json');
    expectSkipped('proj\\credentials\\db.yml');
  });

  it('handles forward slashes following a Windows drive letter (drive strip + forward-slash split together)', () => {
    expectSkipped('C:/proj/secrets/foo.json');
    expectSkipped('D:/code/.aws/config');
  });

  it('skips paths with mixed separators', () => {
    expectSkipped('proj\\sub/secrets\\foo.json');
    expectSkipped('proj/sub\\secrets/foo.json');
  });
});

describe('splitSegments — Windows drive-letter stripping (mutation-sensitive)', () => {
  it('strips a leading drive-letter prefix before segmentation', () => {
    expect(splitSegments('C:\\proj\\secrets\\foo.json')).toEqual([
      'proj',
      'secrets',
      'foo.json',
    ]);
    expect(splitSegments('c:\\proj\\.aws\\config')).toEqual([
      'proj',
      '.aws',
      'config',
    ]);
  });

  it('strips drive letter even with no separator after it (C:foo)', () => {
    expect(splitSegments('C:foo')).toEqual(['foo']);
    expect(splitSegments('Z:secrets')).toEqual(['secrets']);
  });

  it('does not strip a single letter that is not followed by a colon', () => {
    expect(splitSegments('C/proj/foo.ts')).toEqual(['C', 'proj', 'foo.ts']);
  });

  it('does not strip non-letter characters before the colon', () => {
    expect(splitSegments('1:proj/foo.ts')).toEqual(['1:proj', 'foo.ts']);
  });
});

describe('partitionPaths — Windows drive-letter integration', () => {
  it('skips drive-prefixed paths with denylisted segments', () => {
    expectSkipped('C:\\proj\\secrets\\foo.json');
    expectSkipped('D:\\code\\credentials\\db.yml');
  });

  it('keeps a drive-prefixed path that has no denylisted content', () => {
    expectKept('C:\\proj\\src\\foo.ts');
  });
});

describe('partitionPaths — empty-segment filtering (UNC, doubled separators)', () => {
  it('still skips when leading double-backslash UNC path is given', () => {
    expectSkipped('\\\\server\\share\\secrets\\foo.json');
  });

  it('still skips when doubled separators appear mid-path', () => {
    expectSkipped('proj//secrets//foo.json');
    expectSkipped('proj\\\\secrets\\\\foo.json');
  });

  it('keeps a clean path with no denylisted segments or basename rules', () => {
    expectKept('proj/src/foo.ts');
    expectKept('proj\\src\\foo.ts');
  });
});

describe('partitionPaths — pure & synchronous batch behavior', () => {
  it('classifies a mixed batch into kept/skipped preserving order', () => {
    const inputs = [
      'proj/src/foo.ts',
      'proj/secrets/db.yml',
      'proj/.env',
      'proj/__tests__/secrets/foo.json',
      'proj/yarn.lock',
      'proj/README.md',
    ];
    const { kept, skipped } = partitionPaths(inputs);
    expect(kept).toEqual([
      'proj/src/foo.ts',
      'proj/__tests__/secrets/foo.json',
      'proj/README.md',
    ]);
    expect(skipped).toEqual([
      'proj/secrets/db.yml',
      'proj/.env',
      'proj/yarn.lock',
    ]);
  });

  it('returns empty result for empty input', () => {
    expect(partitionPaths([])).toEqual({ kept: [], skipped: [] });
  });

  it('does not return a Promise', () => {
    const result = partitionPaths(['proj/foo.ts']);
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.kept).toBeDefined();
  });
});

describe('validateEntries — empty-entry rejection at construction', () => {
  it('throws when any entry is empty', () => {
    expect(() => validateEntries([''])).toThrow(/empty entry/i);
    expect(() => validateEntries(['foo', ''])).toThrow(/empty entry/i);
    expect(() => validateEntries(['', 'foo'])).toThrow(/empty entry/i);
  });

  it('does not throw for a non-empty list', () => {
    expect(() => validateEntries(['foo', 'bar'])).not.toThrow();
    expect(() => validateEntries([])).not.toThrow();
  });

  it('module load-time validation already succeeded (no empty entries baked in)', async () => {
    await expect(import('../path-denylist.js')).resolves.toBeDefined();
  });
});
