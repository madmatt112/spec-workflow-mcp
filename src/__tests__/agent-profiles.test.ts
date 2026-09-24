import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Pins the generated harness/agent-profiles.json to the twelve agent frontmatters
// (Task 1, design Component 2, Requirements 3.1, 3.2, 3.6, 3.7). The JSON is read
// from disk, never imported, because it sits outside the TypeScript rootDir.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILES_PATH = join(ROOT, 'harness', 'agent-profiles.json');

function frontmatterValue(agentFile: string, line: number): string {
  const raw = readFileSync(join(ROOT, 'harness', 'agents', `${agentFile}.md`), 'utf8');
  const text = raw.split('\n')[line - 1];
  return text.slice(text.indexOf(':') + 1).trim();
}

describe('harness/agent-profiles.json', () => {
  const text = readFileSync(PROFILES_PATH, 'utf8');
  const profiles = JSON.parse(text) as Record<string, { model: string; effort: string; role: string; cacheTtl: string }>;

  it('has one entry per agent frontmatter (12 keys)', () => {
    expect(Object.keys(profiles)).toHaveLength(12);
  });

  it('matches each agent frontmatter model (line 4) and effort (line 5)', () => {
    for (const key of Object.keys(profiles)) {
      expect(profiles[key].model).toBe(frontmatterValue(key, 4));
      expect(profiles[key].effort).toBe(frontmatterValue(key, 5));
    }
  });

  it('records sdd-checker as claude-sonnet-5 high', () => {
    expect(profiles['sdd-checker'].model).toBe('claude-sonnet-5');
    expect(profiles['sdd-checker'].effort).toBe('high');
  });

  it('records cacheTtl as 1h for the three orchestrators and default for the other nine', () => {
    const orchestrators = [
      'sdd-document-orchestrator',
      'sdd-implementation-orchestrator',
      'sdd-closeout-orchestrator',
    ];
    for (const key of Object.keys(profiles)) {
      expect(profiles[key].cacheTtl).toBe(orchestrators.includes(key) ? '1h' : 'default');
    }
  });

  it('re-serialises byte for byte', () => {
    expect(JSON.stringify(profiles, null, 2) + '\n').toBe(text);
  });
});
