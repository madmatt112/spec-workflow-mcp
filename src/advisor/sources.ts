// src/advisor/sources.ts
//
// Sources registry (design.md C9; requirements.md Requirement 8 AC 1, AC 2,
// AC 6; Requirement 2 AC 3). No controller code acts on source content.
import { promises as fs } from 'fs';
import { writeJsonAtomic } from '../controller/state.js';
import { sourcesPath } from './home.js';

export interface Source {
  name: string;
  kind: 'repo' | 'folder' | 'url' | 'mcp';
  location: string;
  about: string;
  personal?: boolean;
}

interface SourcesFile {
  v: 1;
  sources: Source[];
  personalProjects?: string[];
}

/** The day-one sources: the site and JobSync (Requirement 8 AC 2). */
const DAY_ONE_SOURCES: Source[] = [
  {
    name: 'matthew-field.ca',
    kind: 'repo',
    location: '~/repo/matthew-field.ca',
    about: 'Matthew’s personal website.',
  },
  {
    name: 'JobSync',
    kind: 'mcp',
    location: '',
    about: 'The running job search MCP server.',
    personal: true,
  },
];

/** Read `sources.json`; an absent or torn file reads as no sources. */
export async function readSources(): Promise<Source[]> {
  try {
    const raw = await fs.readFile(sourcesPath(), 'utf-8');
    const parsed = JSON.parse(raw) as SourcesFile;
    return parsed.sources ?? [];
  } catch {
    return [];
  }
}

/** Write the day-one `sources.json` only when the file does not exist yet. */
export async function seedSources(): Promise<void> {
  try {
    await fs.access(sourcesPath());
    return;
  } catch {
    // Absent: fall through and seed.
  }
  const file: SourcesFile = { v: 1, sources: DAY_ONE_SOURCES };
  await writeJsonAtomic(sourcesPath(), file);
}
