import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// Pins the cacheTtl extraction of scripts/sync-plugin-assets.cjs independent of
// --check (design C2, D4). It loads the build script through createRequire and
// the module's main-module guard, so requiring it runs neither main nor any
// write under harness/. Two fixture agent files go to a temp dir — one with
// `experimental: { cacheTtl: 1h }` after its effort line, one without.

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const SCRIPT = join(here, '../../scripts/sync-plugin-assets.cjs');
const { cacheTtlOf, buildProfiles } = require(SCRIPT) as {
  cacheTtlOf: (raw: string | undefined) => string;
  buildProfiles: (agentsDir?: string) => string;
};

function agent(name: string, experimental: string, quoted = true): string {
  const description = `SDD ${name}: a fixture agent for the cacheTtl test.`;
  return [
    '---',
    `name: ${name}`,
    `description: ${quoted ? JSON.stringify(description) : description}`,
    'model: claude-opus-4-8',
    'effort: high',
    ...(experimental ? [experimental] : []),
    'color: blue',
    '---',
    '',
    'Body.',
    '',
  ].join('\n');
}

describe('sync-plugin-assets buildProfiles / cacheTtlOf', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'sync-plugin-assets-'));
    await fs.writeFile(join(dir, 'with-ttl.md'), agent('sdd-with', 'experimental: { cacheTtl: 1h }'));
    await fs.writeFile(join(dir, 'without-ttl.md'), agent('sdd-without', ''));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('cacheTtlOf returns the trimmed capture, else "default"', () => {
    expect(cacheTtlOf('{ cacheTtl: 1h }')).toBe('1h');
    expect(cacheTtlOf(undefined)).toBe('default');
    expect(cacheTtlOf('{ }')).toBe('default');
    expect(cacheTtlOf('{ cacheTtl: }')).toBe('default');
  });

  it('buildProfiles reads cacheTtl per agent from the experimental line', () => {
    const profiles = JSON.parse(buildProfiles(dir)) as Record<string, { cacheTtl: string }>;
    expect(profiles['sdd-with'].cacheTtl).toBe('1h');
    expect(profiles['sdd-without'].cacheTtl).toBe('default');
  });

  it('is byte-identical across two runs', () => {
    expect(buildProfiles(dir)).toBe(buildProfiles(dir));
  });

  it('derives the role from a quoted description', () => {
    const profiles = JSON.parse(buildProfiles(dir)) as Record<string, { role: string }>;
    expect(profiles['sdd-with'].role).toBe('sdd-with');
  });

  it('throws on frontmatter that is not valid YAML', async () => {
    // An unquoted description with ": " is invalid YAML; Claude Code then
    // silently drops the experimental mapping.
    await fs.writeFile(join(dir, 'unquoted.md'), agent('sdd-bad', 'experimental: { cacheTtl: 1h }', false));
    expect(() => buildProfiles(dir)).toThrow(/unquoted\.md: frontmatter is not valid YAML/);
  });
});

describe('harness/agents frontmatter', () => {
  it('is valid YAML in every agent file', () => {
    expect(() => buildProfiles()).not.toThrow();
  });
});
