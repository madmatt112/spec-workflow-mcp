// Always case-folded (secret-bearing).
const SECRET_BASENAMES_LC = ['.env', '.npmrc', '.netrc', '.pypirc'];
const SECRET_SUFFIXES_LC = ['.pem', '.key'];
const SECRET_PREFIXES_LC = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];

// Case-folded only on case-insensitive volumes.
const LOCKFILE_BASENAMES = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'Gemfile.lock',
  'Pipfile.lock',
  'Cargo.lock',
  'composer.lock',
  'mix.lock',
  'poetry.lock',
  'go.sum',
];
const NONSECRET_SUFFIXES = ['.lock', '.snap', '.min.js', '.min.css', '.map'];

// Unconditionally case-insensitive.
const SEGMENT_DENYLIST_LC = ['secrets', 'credentials', '.aws', '.kube', '.docker'];

export const TEST_FIXTURE_SEGMENTS: readonly string[] = [
  '__tests__',
  '__fixtures__',
  'fixtures',
  'test-data',
  'testdata',
];

// Reject empty entries at construction so a config-loading bug producing an
// empty entry can't silently match every path.
export function validateEntries(entries: readonly string[]): void {
  for (const entry of entries) {
    if (entry.length === 0) {
      throw new Error('path-denylist: empty entry rejected at construction');
    }
  }
}

validateEntries([
  ...SECRET_BASENAMES_LC,
  ...SECRET_SUFFIXES_LC,
  ...SECRET_PREFIXES_LC,
  ...LOCKFILE_BASENAMES,
  ...NONSECRET_SUFFIXES,
  ...SEGMENT_DENYLIST_LC,
  ...TEST_FIXTURE_SEGMENTS,
]);

const CASE_INSENSITIVE_VOLUME =
  process.platform === 'darwin' || process.platform === 'win32';

const LOCKFILE_BASENAMES_LC = LOCKFILE_BASENAMES.map(s => s.toLowerCase());
const FIXTURE_SEGMENTS_LC = TEST_FIXTURE_SEGMENTS.map(s => s.toLowerCase());

export function splitSegments(p: string): string[] {
  let stripped = p;
  if (/^[A-Za-z]:/.test(stripped)) {
    stripped = stripped.slice(2);
  }
  return stripped.split(/[/\\]/).filter(s => s.length > 0);
}

function isDenied(p: string): boolean {
  const segs = splitSegments(p);
  if (segs.length === 0) return false;
  const basename = segs[segs.length - 1];
  const baseLower = basename.toLowerCase();
  const lowerSegs = segs.map(s => s.toLowerCase());
  const hasFixtureSegment = lowerSegs.some(s => FIXTURE_SEGMENTS_LC.includes(s));

  if (!hasFixtureSegment) {
    if (lowerSegs.some(s => SEGMENT_DENYLIST_LC.includes(s))) return true;
  }

  if (SECRET_BASENAMES_LC.includes(baseLower)) return true;
  for (const suf of SECRET_SUFFIXES_LC) {
    if (baseLower.endsWith(suf)) return true;
  }
  for (const pref of SECRET_PREFIXES_LC) {
    if (baseLower.startsWith(pref)) return true;
  }

  if (CASE_INSENSITIVE_VOLUME) {
    if (LOCKFILE_BASENAMES_LC.includes(baseLower)) return true;
    for (const suf of NONSECRET_SUFFIXES) {
      if (baseLower.endsWith(suf)) return true;
    }
  } else {
    if (LOCKFILE_BASENAMES.includes(basename)) return true;
    for (const suf of NONSECRET_SUFFIXES) {
      if (basename.endsWith(suf)) return true;
    }
  }

  return false;
}

export function partitionPaths(paths: string[]): { kept: string[]; skipped: string[] } {
  const kept: string[] = [];
  const skipped: string[] = [];
  for (const p of paths) {
    if (isDenied(p)) skipped.push(p);
    else kept.push(p);
  }
  return { kept, skipped };
}
