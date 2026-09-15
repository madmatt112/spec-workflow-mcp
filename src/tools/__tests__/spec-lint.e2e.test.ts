import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { decode } from '@toon-format/toon';

// End-to-end lint scenario (Req 10.2, design's End-to-end strategy). Nothing is
// mocked: real temp dirs are both roots and every call goes through
// `handleToolCall('spec-lint', …)` (`src/tools/index.ts:33-92`), whose TOON body
// we decode back to the response object. One fixture is deliberately broken so
// each phase's rules fire exactly once; a clean sibling proves silence. The only
// `fs` behaviour asserted is that an absent citation target `stat`s as missing,
// which node 20 guarantees; the broken citation `src/missing.ts` exists under
// none of the three resolution bases.
import { handleToolCall } from '../index.js';
import { ToolContext } from '../../types.js';

const BROKEN = 'sl-broken';
const CLEAN = 'sl-clean';

// A 300-word body so `requirements.md` clears the 100-word override cap.
const FILLER = Array.from({ length: 300 }, (_, i) => `word${i % 7}`).join(' ');

async function writeSpec(
  root: string,
  spec: string,
  files: Record<string, string>,
  agentRules?: string,
): Promise<void> {
  const specDir = join(root, '.spec-workflow', 'specs', spec);
  await fs.mkdir(specDir, { recursive: true });
  if (agentRules !== undefined) {
    await fs.writeFile(join(root, '.spec-workflow', 'agent-rules.md'), agentRules);
  }
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(join(specDir, name), content);
  }
}

async function lint(context: ToolContext, specName: string, phase: string): Promise<any> {
  const res = await handleToolCall('spec-lint', { specName, phase }, context);
  expect(res.isError).toBeFalsy();
  return decode(res.content[0].text);
}

/** The `{ rule, line }` of every finding, in the order the tool returns them. */
function ruleLines(response: any): Array<{ rule: string; line: number }> {
  return response.data.findings.map((f: any) => ({ rule: f.rule, line: f.line }));
}

describe('spec-lint end-to-end', () => {
  let brokenDir: string;
  let cleanDir: string;
  let brokenCtx: ToolContext;
  let cleanCtx: ToolContext;

  beforeAll(async () => {
    // --- Broken fixture: one rule per phase fires, with a known line. ---
    brokenDir = await fs.mkdtemp(join(tmpdir(), 'spec-lint-e2e-broken-'));
    brokenCtx = { projectPath: brokenDir, workspacePath: brokenDir };

    const agentRules = ['# Agent rules', '', '## Word caps', '', '- requirements: 100', ''].join('\n');

    // requirements.md: a broken citation (line 3), a bare `<5%` (line 5, an MDX
    // compile error), a criterion with no `SHALL` (line 11), and 300 words.
    const requirements = [
      '# Requirements', // 1
      '', // 2
      'See src/missing.ts:3 for the broken path.', // 3
      '', // 4
      'Coverage sits under <5% today.', // 5
      '', // 6
      '### Requirement 1', // 7
      '', // 8
      '#### Acceptance Criteria', // 9
      '', // 10
      '1. The system does the thing.', // 11
      '', // 12
      FILLER, // 13
      '', // 14
    ].join('\n');

    // design.md: two `### Component N` headings under the components section.
    const design = [
      '# Design',
      '',
      '## Components and Interfaces',
      '',
      '### Component 1',
      '',
      'First.',
      '',
      '### Component 2',
      '',
      'Second.',
      '',
    ].join('\n');

    // tasks.md: a `_Prompt:` with its three sections but no closing `_` (line 3),
    // `_Requirements: 9.9_` (line 4), and only `Component 1` named.
    const tasks = [
      '# Tasks', // 1
      '', // 2
      '- [ ] 1. Implement Component 1', // 3
      '  _Requirements: 9.9_', // 4
      '  _Prompt: Task: do it | Restrictions: none | Success: it works', // 5
      '', // 6
    ].join('\n');

    await writeSpec(brokenDir, BROKEN, { 'requirements.md': requirements, 'design.md': design, 'tasks.md': tasks }, agentRules);

    // --- Clean fixture: every phase silent, default caps (no agent-rules). ---
    cleanDir = await fs.mkdtemp(join(tmpdir(), 'spec-lint-e2e-clean-'));
    cleanCtx = { projectPath: cleanDir, workspacePath: cleanDir };

    const cleanReq = [
      '# Requirements',
      '',
      '### Requirement 1',
      '',
      '#### Acceptance Criteria',
      '',
      '1. WHEN the user acts THEN the system SHALL respond.',
      '',
    ].join('\n');
    const cleanDesign = ['# Design', '', '## Components and Interfaces', '', '### Component 1', '', 'Does a thing.', ''].join('\n');
    const cleanTasks = [
      '# Tasks',
      '',
      '- [ ] 1. Implement Component 1',
      '  _Requirements: 1.1_',
      '  _Prompt: Task: do it | Restrictions: none | Success: it works._',
      '',
    ].join('\n');

    await writeSpec(cleanDir, CLEAN, { 'requirements.md': cleanReq, 'design.md': cleanDesign, 'tasks.md': cleanTasks });
  });

  afterAll(async () => {
    await fs.rm(brokenDir, { recursive: true, force: true });
    await fs.rm(cleanDir, { recursive: true, force: true });
  });

  it('lints the broken requirements document to exactly its four rules', async () => {
    const response = await lint(brokenCtx, BROKEN, 'requirements');
    expect(ruleLines(response)).toEqual([
      { rule: 'doc-words', line: 1 },
      { rule: 'citation-path', line: 3 },
      { rule: 'mdx', line: 5 },
      { rule: 'ears-shape', line: 11 },
    ]);
    expect(response.data.summary.total).toBe(4);
  });

  it('lints the broken tasks document to exactly its three rules', async () => {
    const response = await lint(brokenCtx, BROKEN, 'tasks');
    expect(ruleLines(response)).toEqual([
      { rule: 'coverage-component', line: 1 },
      { rule: 'tasks-format', line: 3 },
      { rule: 'task-requirement-id', line: 4 },
    ]);
    expect(response.data.summary.total).toBe(3);
  });

  it('reports no findings for a clean spec in every phase', async () => {
    for (const phase of ['requirements', 'design', 'tasks']) {
      const response = await lint(cleanCtx, CLEAN, phase);
      expect(response.data.summary.total).toBe(0);
      expect(response.data.findings).toEqual([]);
    }
  });
});
