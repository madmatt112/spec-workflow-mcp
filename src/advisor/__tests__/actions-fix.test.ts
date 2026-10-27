import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import { mkdirSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { actionEvents, confirmAction, dismissAction, stageAction } from '../actions.js';
import { eventsPath } from '../home.js';

// Review-fix coverage for round 1 (verifier F1, F2): actions.ts's actionEvents
// emitter (design C8's interface list) and confirmAction's handling of a
// throwing executor (design Error Handling flow 6). actions.test.ts (the
// author's file) is untouched; these are additional tests, not amendments.

let home: string;
let savedSddHome: string | undefined;

beforeEach(async () => {
  savedSddHome = process.env.SDD_HOME;
  home = await fs.mkdtemp(join(tmpdir(), 'sdd-advisor-actions-fix-'));
  process.env.SDD_HOME = home;
});

afterEach(async () => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  await fs.rm(home, { recursive: true, force: true });
});

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8' });
}

async function readEventRows(): Promise<any[]> {
  let contents: string;
  try {
    contents = await fs.readFile(eventsPath(), 'utf-8');
  } catch {
    return [];
  }
  return contents.split('\n').filter((l) => l.length > 0).map((l) => JSON.parse(l));
}

describe('src/advisor/actions.ts — review-fix round 1', () => {
  it('emits change on stageAction, confirmAction and dismissAction (F1)', async () => {
    const seen: string[] = [];
    const onChange = (action: { id: string; state: string }) => seen.push(action.state);
    actionEvents.on('change', onChange);
    try {
      const staged = await stageAction({
        kind: 'backlog',
        target: {},
        params: { text: 'watch for change events' },
        reason: 'f1 test',
        conversation: 'conv-f1',
      });
      expect(seen).toEqual(['staged']);

      await confirmAction(staged.id, { projectPath: () => { throw new Error('unused'); } });
      expect(seen).toEqual(['staged', 'running', 'done']);

      const staged2 = await stageAction({
        kind: 'backlog',
        target: {},
        params: { text: 'another' },
        reason: 'f1 test 2',
        conversation: 'conv-f1b',
      });
      await dismissAction(staged2.id);
      expect(seen).toEqual(['staged', 'running', 'done', 'staged', 'dismissed']);
    } finally {
      actionEvents.off('change', onChange);
    }
  });

  it('a throwing executor still lands the action failed and still logs one advisor.action row (F2)', async () => {
    // A repo with no decomposition.md: execDecomposition's fs.readFile throws,
    // unwinding past withStoreLock with no catch of its own.
    const repo = mkdtempSync(join(tmpdir(), 'sdd-advisor-fix-proj-'));
    mkdirSync(join(repo, '.spec-workflow'), { recursive: true });
    git(repo, ['init', '-q']);
    git(repo, ['config', 'user.email', 'test@example.com']);
    git(repo, ['config', 'user.name', 'Test']);
    git(repo, ['commit', '-q', '--allow-empty', '-m', 'init']);

    const staged = await stageAction({
      kind: 'decomposition',
      target: { project: 'proj-1' },
      params: { slug: 'new-thing', markdown: '### `new-thing`\n' },
      reason: 'f2 test',
      conversation: 'conv-f2',
    });

    const deps = { projectPath: (id: string) => (id === 'proj-1' ? repo : (() => { throw new Error('unknown project'); })()) };
    const result = await confirmAction(staged.id, deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('failed');

    const rows = await readEventRows();
    const actionRows = rows.filter((r) => r.type === 'advisor.action');
    expect(actionRows).toHaveLength(1);
    expect(actionRows[0].action).toBe(staged.id);
    expect(actionRows[0].kind).toBe('decomposition');
    expect(actionRows[0].outcome).toBe('failed');
    expect(typeof actionRows[0].detail).toBe('string');
    expect(actionRows[0].detail.length).toBeGreaterThan(0);
  });
});
