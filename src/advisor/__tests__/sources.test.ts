import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { sourcesPath } from '../home.js';
import { readSources, seedSources } from '../sources.js';

// Contract for src/advisor/sources.ts (design.md C9; requirements.md
// Requirement 8 AC 1, AC 2, AC 6; Requirement 2 AC 3). Each test runs
// against a fresh temp SDD_HOME so the real home sources.json is never
// touched; sourcesPath() (src/advisor/home.ts) reads controllerHome(),
// which reads the environment at call time.

let home: string;
let savedSddHome: string | undefined;

beforeEach(async () => {
  savedSddHome = process.env.SDD_HOME;
  home = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-sources-'));
  process.env.SDD_HOME = home;
});

afterEach(async () => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  await fs.rm(home, { recursive: true, force: true });
});

describe('src/advisor/sources.ts', () => {
  // AC (Requirement 8 AC 1, AC 2; Requirement 2 AC 3; task 5 Success item 1).
  // Pre-condition: temp SDD_HOME, no sources.json yet. Test: seedSources(),
  // then readSources(). Observable result: the returned list holds exactly
  // the two day-one sources — the site (kind repo, location
  // '~/repo/matthew-field.ca', a non-empty one-line about, not personal) and
  // JobSync (kind mcp, location '' until the operator fills it, a non-empty
  // one-line about, personal true). Expected value source: requirements.md
  // Requirement 8 AC 2 ("On day one it SHALL list ~/repo/matthew-field.ca
  // (kind repo) and JobSync (kind mcp ...), JobSync marked personal") and the
  // task's _Prompt line ("JobSync ..., personal true, location empty until
  // the operator fills it").
  it('seeds both day-one sources with kind, location, about and JobSync marked personal', async () => {
    await seedSources();
    const sources = await readSources();

    expect(sources).toHaveLength(2);

    const site = sources.find((s: { kind: string }) => s.kind === 'repo') as
      | { kind: string; location: string; about: string; personal?: boolean }
      | undefined;
    expect(site).toBeDefined();
    expect(site!.location).toBe('~/repo/matthew-field.ca');
    expect(typeof site!.about).toBe('string');
    expect(site!.about.length).toBeGreaterThan(0);
    expect(site!.personal).not.toBe(true);

    const jobSync = sources.find((s: { name: string }) => s.name === 'JobSync') as
      | { name: string; kind: string; location: string; about: string; personal?: boolean }
      | undefined;
    expect(jobSync).toBeDefined();
    expect(jobSync!.kind).toBe('mcp');
    expect(jobSync!.location).toBe('');
    expect(typeof jobSync!.about).toBe('string');
    expect(jobSync!.about.length).toBeGreaterThan(0);
    expect(jobSync!.personal).toBe(true);
  });

  // AC (Requirement 8 AC 6; task 5 Restrictions "an existing file is never
  // overwritten"; task 5 Success item 2). Pre-condition: a hand-edited
  // sources.json already on disk (the operator filled in JobSync's location
  // and added a third source). Test: seedSources() a second time.
  // Observable result: the file's raw bytes are unchanged, byte for byte.
  // Expected value source: requirements.md Requirement 8 AC 6 ("The operator
  // SHALL be able to edit sources.json by hand") and design.md C9 ("seedSources
  // writes the day-one file when absent").
  it('leaves a hand-edited sources.json byte for byte on a second seed', async () => {
    await seedSources();
    const handEdited =
      JSON.stringify(
        {
          v: 1,
          sources: [
            {
              name: 'JobSync',
              kind: 'mcp',
              location: 'http://127.0.0.1:4100/mcp',
              about: 'My job search assistant.',
              personal: true,
            },
            { name: 'side-project', kind: 'folder', location: '~/repo/side-project', about: 'A personal hobby project.' },
          ],
        },
        null,
        2,
      ) + '\n';
    await fs.writeFile(sourcesPath(), handEdited, 'utf-8');

    await seedSources();

    const afterSecondSeed = await fs.readFile(sourcesPath(), 'utf-8');
    expect(afterSecondSeed).toBe(handEdited);
  });

  // AC (task 5 _Prompt "readSources returns the parsed file, or an empty
  // list for an absent or torn file"; task 5 Success item 3). Pre-condition:
  // sources.json holds unparsable bytes. Test: readSources() with no prior
  // seedSources() call. Observable result: resolves to an empty list, not a
  // thrown error. Expected value source: the task's _Prompt line, the only
  // text specifying torn-file behaviour for readSources.
  it('reads a torn sources.json as no sources', async () => {
    await fs.writeFile(sourcesPath(), '{ not valid json', 'utf-8');

    const sources = await readSources();

    expect(sources).toEqual([]);
  });

  // AC (task 5 _Prompt "readSources returns ... an empty list for an absent
  // ... file"). Pre-condition: temp SDD_HOME, sources.json never written.
  // Test: readSources() with no prior seedSources() call. Observable result:
  // resolves to an empty list. Expected value source: the task's _Prompt
  // line.
  it('reads an absent sources.json as no sources', async () => {
    const sources = await readSources();
    expect(sources).toEqual([]);
  });
});
