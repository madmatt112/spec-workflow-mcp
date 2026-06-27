import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { DeferralStorage } from '../deferral-storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '__fixtures__', 'deferrals');

const ALL_IDS = [
  'd-aaaa0001', // double-quoted, deferred
  'd-bbbb0002', // single-quoted, deferred
  'd-cccc0003', // unquoted, deferred
  'd-dddd0004', // single-quoted, resolved
  'd-eeee0005', // single-quoted, superseded (old)
  'd-ffff0006', // double-quoted, deferred (new, supersedes old)
  'd-gggg0007', // mixed-quoting, deferred
  'd-hhhh0008', // single-quoted title with apostrophe, deferred
];

describe('DeferralStorage — resilient reads (Defect 1)', () => {
  let tempDir: string;
  let deferralsDir: string;
  let storage: DeferralStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'deferral-fixtures-'));
    deferralsDir = join(tempDir, '.spec-workflow', 'deferrals');
    await fs.mkdir(deferralsDir, { recursive: true });

    // Copy every fixture file into the temp store
    const files = await fs.readdir(FIXTURES_DIR);
    for (const file of files) {
      await fs.copyFile(join(FIXTURES_DIR, file), join(deferralsDir, file));
    }

    storage = new DeferralStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('list() returns ALL on-disk deferrals regardless of quoting style', async () => {
    const all = await storage.list();
    expect(all).toHaveLength(ALL_IDS.length);
    expect(all.map(d => d.id).sort()).toEqual([...ALL_IDS].sort());
  });

  it('get() resolves single-quoted, unquoted, and mixed-quoting files', async () => {
    const single = await storage.get('d-bbbb0002');
    expect(single).not.toBeNull();
    expect(single!.title).toBe('Single-quoted deferral');
    expect(single!.status).toBe('deferred');
    expect(single!.tags).toEqual(['billing', 'auth']);

    const unquoted = await storage.get('d-cccc0003');
    expect(unquoted).not.toBeNull();
    expect(unquoted!.title).toBe('Unquoted scalar deferral');
    expect(unquoted!.originSpec).toBe('market-feed');
    expect(unquoted!.tags).toEqual(['streaming', 'feed']);

    const mixed = await storage.get('d-gggg0007');
    expect(mixed).not.toBeNull();
    expect(mixed!.title).toBe('Mixed-quoting deferral');
    expect(mixed!.tags).toEqual([]);
  });

  it('parses YAML single-quote escaping', async () => {
    const d = await storage.get('d-hhhh0008');
    expect(d).not.toBeNull();
    expect(d!.title).toBe("It's a single-quoted title with an apostrophe");
  });

  it('preserves the superseded chain across mixed quoting', async () => {
    const oldD = await storage.get('d-eeee0005');
    const newD = await storage.get('d-ffff0006');
    expect(oldD!.status).toBe('superseded');
    expect(oldD!.supersededBy).toBe('d-ffff0006');
    expect(newD!.supersedes).toBe('d-eeee0005');
  });

  it('filters work across all quoting styles', async () => {
    expect((await storage.list({ status: 'deferred' })).map(d => d.id).sort())
      .toEqual(['d-aaaa0001', 'd-bbbb0002', 'd-cccc0003', 'd-ffff0006', 'd-gggg0007', 'd-hhhh0008']);
    expect((await storage.list({ status: 'resolved' })).map(d => d.id)).toEqual(['d-dddd0004']);
    expect((await storage.list({ status: 'superseded' })).map(d => d.id)).toEqual(['d-eeee0005']);
    expect((await storage.list({ originSpec: 'trade-data' })).map(d => d.id).sort())
      .toEqual(['d-aaaa0001', 'd-bbbb0002', 'd-dddd0004']);
    expect((await storage.list({ tag: 'tools' })).map(d => d.id).sort())
      .toEqual(['d-eeee0005', 'd-ffff0006']);
  });

  it('tolerates CRLF line endings and a BOM', async () => {
    const crlf = [
      '﻿---',
      "id: 'd-crlf0009'",
      "status: 'deferred'",
      "title: 'CRLF deferral'",
      'tags: [win]',
      '---',
      '',
      '## Context',
      'Windows line endings.',
      '',
      '## Decision Deferred',
      'Defer.',
      '',
      '## Revisit Criteria',
      'Later.',
      '',
    ].join('\r\n');
    await fs.writeFile(join(deferralsDir, 'd-crlf0009.md'), crlf, 'utf-8');

    const d = await storage.get('d-crlf0009');
    expect(d).not.toBeNull();
    expect(d!.title).toBe('CRLF deferral');
    expect(d!.tags).toEqual(['win']);
    expect(d!.body.context).toBe('Windows line endings.');
  });
});

describe('DeferralStorage.reindex — migration/normalization (Defect 1 + 4)', () => {
  let tempDir: string;
  let deferralsDir: string;
  let storage: DeferralStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'deferral-reindex-'));
    deferralsDir = join(tempDir, '.spec-workflow', 'deferrals');
    await fs.mkdir(deferralsDir, { recursive: true });
    const files = await fs.readdir(FIXTURES_DIR);
    for (const file of files) {
      await fs.copyFile(join(FIXTURES_DIR, file), join(deferralsDir, file));
    }
    storage = new DeferralStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('rewrites legacy files to canonical double-quoted frontmatter without losing data', async () => {
    const before = await storage.list();
    const result = await storage.reindex();

    expect(result.total).toBe(ALL_IDS.length);
    expect(result.unparseable).toEqual([]);
    expect(result.rewritten).toBeGreaterThan(0);

    // Every single-quoted file is now canonical double-quoted
    const single = await fs.readFile(join(deferralsDir, 'd-bbbb0002.md'), 'utf-8');
    expect(single).toContain(`id: "d-bbbb0002"`);
    expect(single).toContain(`status: "deferred"`);
    expect(single).not.toContain(`'deferred'`);

    // No deferral data lost
    const after = await storage.list();
    expect(after.map(d => d.id).sort()).toEqual(before.map(d => d.id).sort());
    const apostrophe = after.find(d => d.id === 'd-hhhh0008');
    expect(apostrophe!.title).toBe("It's a single-quoted title with an apostrophe");
  });

  it('preserves the document body verbatim through reindex', async () => {
    await storage.reindex();
    const d = await storage.get('d-cccc0003');
    expect(d!.body.context).toBe('Frontmatter values are bare/unquoted.');
    expect(d!.body.decision).toBe('Defer streaming support.');
    expect(d!.body.revisitCriteria).toBe('When streaming lands.');
  });

  it('is idempotent — a second reindex rewrites nothing', async () => {
    await storage.reindex();
    const second = await storage.reindex();
    expect(second.rewritten).toBe(0);
    expect(second.unparseable).toEqual([]);
  });

  it('reports unparseable files instead of dropping them silently', async () => {
    await fs.writeFile(join(deferralsDir, 'd-broken.md'), 'no frontmatter here', 'utf-8');
    const result = await storage.reindex();
    expect(result.unparseable).toContain('d-broken.md');
  });
});

describe('DeferralStorage — duplicate detection (Defect 2)', () => {
  let tempDir: string;
  let storage: DeferralStorage;

  const base = {
    originSpec: 'market-feed',
    originPhase: 'design' as const,
    revisitTrigger: 'later',
    tags: ['feed'],
    supersedes: null,
    body: { context: 'c', decision: 'd', revisitCriteria: 'r' },
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'deferral-dedup-'));
    await fs.mkdir(join(tempDir, '.spec-workflow', 'deferrals'), { recursive: true });
    storage = new DeferralStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('flags near-duplicate titles within the same originSpec', async () => {
    const firstId = await storage.create({ ...base, title: 'Streaming market data / live feeds' });
    const dups = await storage.findDuplicates('Streaming market data / live price feeds', 'market-feed');
    expect(dups).toHaveLength(1);
    expect(dups[0].id).toBe(firstId);
    expect(dups[0].similarity).toBeGreaterThanOrEqual(DeferralStorage.DUPLICATE_THRESHOLD);
  });

  it('does not flag titles from a different originSpec', async () => {
    await storage.create({ ...base, title: 'Streaming market data / live feeds' });
    const dups = await storage.findDuplicates('Streaming market data / live price feeds', 'other-spec');
    expect(dups).toHaveLength(0);
  });

  it('does not flag unrelated titles', async () => {
    await storage.create({ ...base, title: 'Streaming market data / live feeds' });
    const dups = await storage.findDuplicates('Per-conversation trade-data scrub', 'market-feed');
    expect(dups).toHaveLength(0);
  });

  it('groups likely duplicates for the dashboard', async () => {
    await storage.create({ ...base, title: 'User-authored / custom advisor tools' });
    await storage.create({ ...base, title: 'User-authored / custom advisor tools' });
    await storage.create({ ...base, title: 'Completely unrelated thing' });

    const groups = await storage.findDuplicateGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });
});

describe('DeferralStorage.merge (Defect 2)', () => {
  let tempDir: string;
  let storage: DeferralStorage;

  const base = {
    originSpec: 'market-feed',
    originPhase: 'design' as const,
    revisitTrigger: 'later',
    tags: ['feed'],
    supersedes: null,
    body: { context: 'c', decision: 'd', revisitCriteria: 'r' },
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'deferral-merge-'));
    await fs.mkdir(join(tempDir, '.spec-workflow', 'deferrals'), { recursive: true });
    storage = new DeferralStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('folds a duplicate into a canonical record and marks it superseded', async () => {
    const canonicalId = await storage.create({ ...base, title: 'Streaming market data / live feeds', tags: ['feed'] });
    const dupId = await storage.create({ ...base, title: 'Streaming market data / live price feeds', tags: ['streaming'] });

    await storage.merge(dupId, canonicalId);

    const dup = await storage.get(dupId);
    expect(dup!.status).toBe('superseded');
    expect(dup!.supersededBy).toBe(canonicalId);

    const canonical = await storage.get(canonicalId);
    expect(canonical!.status).toBe('deferred');
    expect(canonical!.supersedes).toBe(dupId);
    // Tags are unioned into the canonical record
    expect(canonical!.tags.sort()).toEqual(['feed', 'streaming']);
  });

  it('rejects merging into itself or merging a non-deferred record', async () => {
    const a = await storage.create({ ...base, title: 'A title here' });
    const b = await storage.create({ ...base, title: 'B different title' });
    await expect(storage.merge(a, a)).rejects.toThrow('into itself');

    await storage.resolve(b, 'done');
    await expect(storage.merge(a, b)).rejects.toThrow(/is resolved/);
  });

  it('keeps the superseded duplicate readable (no data lost)', async () => {
    const canonicalId = await storage.create({ ...base, title: 'Canonical decision' });
    const dupId = await storage.create({ ...base, title: 'Canonical decisions', body: { context: 'unique context', decision: 'd', revisitCriteria: 'r' } });
    await storage.merge(dupId, canonicalId);

    const dup = await storage.get(dupId);
    expect(dup!.body.context).toBe('unique context');

    const all = await storage.list();
    expect(all.map(d => d.id).sort()).toEqual([canonicalId, dupId].sort());
  });
});

describe('DeferralStorage — actionable errors (Defect 4)', () => {
  let tempDir: string;
  let deferralsDir: string;
  let storage: DeferralStorage;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'deferral-errors-'));
    deferralsDir = join(tempDir, '.spec-workflow', 'deferrals');
    await fs.mkdir(deferralsDir, { recursive: true });
    storage = new DeferralStorage(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('distinguishes a corrupt file from a missing one on write ops', async () => {
    await fs.writeFile(join(deferralsDir, 'd-corrupt.md'), 'not a valid deferral', 'utf-8');

    // Missing → plain not found
    await expect(storage.resolve('d-missing', 'x')).rejects.toThrow(/not found/);
    // Exists but unparseable → actionable reindex hint
    await expect(storage.resolve('d-corrupt', 'x')).rejects.toThrow(/reindex/);
  });

  it('fileExists reports disk presence independent of parseability', async () => {
    await fs.writeFile(join(deferralsDir, 'd-corrupt.md'), 'garbage', 'utf-8');
    expect(await storage.fileExists('d-corrupt')).toBe(true);
    expect(await storage.get('d-corrupt')).toBeNull();
    expect(await storage.fileExists('d-missing')).toBe(false);
  });
});
