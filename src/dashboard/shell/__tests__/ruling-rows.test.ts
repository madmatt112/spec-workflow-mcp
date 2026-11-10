import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { riskFromLedger, readTaskRow } from '../ruling-rows.js';

// Contract for src/dashboard/shell/ruling-rows.ts (design.md C5; task 7
// _Prompt; Requirement 3 AC 2, AC 3, AC 5).
//
// Reached only through riskFromLedger(ledgerText, taskId) and
// readTaskRow(specDir, taskId).

describe('riskFromLedger', () => {
  it('returns the risk of the newest matching gate note', () => {
    const ledgerText = [
      JSON.stringify({ type: 'note', text: 'gate: task 1 B risk low' }),
      JSON.stringify({ type: 'note', text: 'gate: task 1 A risk high round 1' }),
    ].join('\n');

    expect(riskFromLedger(ledgerText, '1')).toBe('high');
  });

  it('ignores a note for another task id (task 1 does not match a gate note for task 12)', () => {
    const ledgerText = JSON.stringify({ type: 'note', text: 'gate: task 12 B risk low' });

    expect(riskFromLedger(ledgerText, '1')).toBeNull();
  });

  it('skips a torn line', () => {
    const ledgerText = [
      '{ this is not json',
      JSON.stringify({ type: 'note', text: 'gate: task 1 A risk medium' }),
    ].join('\n');

    expect(riskFromLedger(ledgerText, '1')).toBe('medium');
  });

  it('returns null with no matching note', () => {
    const ledgerText = JSON.stringify({ type: 'phase.start', phase: 'implementation' });

    expect(riskFromLedger(ledgerText, '1')).toBeNull();
  });
});

describe('readTaskRow', () => {
  let specDir: string;

  beforeEach(() => {
    specDir = mkdtempSync(join(tmpdir(), 'ruling-rows-'));
  });

  afterEach(() => {
    rmSync(specDir, { recursive: true, force: true });
  });

  function writeTasks(content: string): void {
    writeFileSync(join(specDir, 'tasks.md'), content);
  }

  const TASK_1 = `- [ ] 1. Build the thing
  - File: src/thing.ts
  - Test: src/__tests__/thing.test.ts — \`thing()\`
  - Purpose: it does the thing.
  - _Prompt: Task: Build the thing | Restrictions: none | Success: the thing works_
`;

  const TASK_2_E2E = `- [ ] 2. Render the panel
  - File: src/panel.tsx
  - Test: e2e/panel.spec.ts — \`panel renders\`
  - kind: e2e
  - Purpose: shows the panel. The Playwright suite is the only test of this panel.
  - _Prompt: Task: Render the panel | Restrictions: none | Success: the panel renders_
`;

  // Prose that merely quotes the marker in a code span must not route (retro F4/P4):
  // the anchored match only recognises a standalone marker line.
  const TASK_3_QUOTES_MARKER = `- [ ] 3. Render the other panel
  - File: src/other.tsx
  - Test: src/__tests__/other.test.ts — \`other()\`
  - Purpose: like task 2 but do not write \`kind: e2e\` here.
  - _Prompt: Task: Render the other panel | Restrictions: none | Success: the other panel renders_
`;

  it('returns ok with id, title, Success text, tdd true, risk and files', () => {
    writeTasks(TASK_1);
    mkdirSync(specDir, { recursive: true });
    writeFileSync(
      join(specDir, 'harness-events.jsonl'),
      JSON.stringify({ type: 'note', text: 'gate: task 1 B risk medium' }) + '\n',
    );

    const row = readTaskRow(specDir, '1');

    expect(row).toEqual({
      state: 'ok',
      id: '1',
      title: 'Build the thing',
      success: 'the thing works',
      tdd: true,
      risk: 'medium',
      files: ['src/thing.ts'],
    });
  });

  it('gives tdd false for a block with a standalone kind: e2e marker line', () => {
    writeTasks(TASK_2_E2E);

    const row = readTaskRow(specDir, '2');

    expect(row).toMatchObject({ state: 'ok', tdd: false });
  });

  it('gives tdd true when prose only quotes kind: e2e in a code span', () => {
    writeTasks(TASK_3_QUOTES_MARKER);

    const row = readTaskRow(specDir, '3');

    expect(row).toMatchObject({ state: 'ok', tdd: true });
  });

  it('gives success null with no Success section', () => {
    writeTasks(`- [ ] 3. Do a thing with no prompt
  - File: src/thing.ts
  - Purpose: it does a thing.
`);

    const row = readTaskRow(specDir, '3');

    expect(row).toMatchObject({ state: 'ok', success: null });
  });

  it('gives not-found with the id for an id absent from tasks.md', () => {
    writeTasks(TASK_1);

    const row = readTaskRow(specDir, '9');

    expect(row).toEqual({ state: 'not-found', id: '9' });
  });

  it('gives not-found with the id for a missing tasks.md', () => {
    const row = readTaskRow(join(specDir, 'missing-dir'), '1');

    expect(row).toEqual({ state: 'not-found', id: '1' });
  });

  it('gives risk null when harness-events.jsonl is missing', () => {
    writeTasks(TASK_1);

    const row = readTaskRow(specDir, '1');

    expect(row).toMatchObject({ state: 'ok', risk: null });
  });
});
