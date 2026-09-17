import { describe, it, expect } from 'vitest';
import {
  CLASS_A_KEYWORDS,
  computeClassA,
  type TaskVetoInput,
  type ClassAItem,
} from '../veto-rules.js';

const NO_LIST_REASON = 'sensitive-paths: no list; every path is sensitive';

function task(overrides: Partial<TaskVetoInput> = {}): TaskVetoInput {
  return {
    id: '1',
    title: 'A task',
    files: [],
    block: '',
    ...overrides,
  };
}

describe('CLASS_A_KEYWORDS', () => {
  it('pins the six tunable action keywords', () => {
    expect(Object.keys(CLASS_A_KEYWORDS)).toEqual([
      'migration',
      'delete',
      'auth',
      'billing',
      'config',
      'external-write',
    ]);
  });
});

describe('computeClassA — keyword scan', () => {
  const cases: Array<[string, string]> = [
    ['migration', 'Run the schema migration on boot'],
    ['delete', 'Delete the stale rows'],
    ['delete', 'Drop the legacy table'],
    ['auth', 'Wire the auth middleware'],
    ['billing', 'Charge the billing account'],
    ['config', 'Read the config file'],
    ['external-write', 'Perform an external write to the CDN'],
  ];

  for (const [name, block] of cases) {
    it(`fires the ${name} keyword on "${block}"`, () => {
      const items = computeClassA([task({ block })], []);
      const kw = items.filter((i) => i.kind === 'keyword');
      expect(kw).toHaveLength(1);
      expect(kw[0]).toMatchObject({
        taskId: '1',
        kind: 'keyword',
        reason: `keyword: ${name}`,
        score: 1,
      });
    });
  }

  it('fires no keyword on an unrelated block', () => {
    const items = computeClassA([task({ block: 'Render the dashboard header' })], []);
    expect(items).toHaveLength(0);
  });

  it('pushes one keyword item per matching keyword', () => {
    const items = computeClassA(
      [task({ block: 'Add auth to the billing config' })],
      []
    );
    expect(items.map((i) => i.reason).sort()).toEqual([
      'keyword: auth',
      'keyword: billing',
      'keyword: config',
    ]);
  });
});

describe('computeClassA — sensitive path', () => {
  it('scores a sensitive-path item 2 and ranks it before keyword items', () => {
    const items = computeClassA(
      [
        task({
          id: '2',
          title: 'Touch approvals',
          files: ['src/tools/approvals.ts'],
          block: 'Also delete a record',
        }),
      ],
      ['src/tools/approvals.ts']
    );
    expect(items[0]).toMatchObject({
      taskId: '2',
      kind: 'sensitive-path',
      reason: 'sensitive-path: src/tools/approvals.ts',
      score: 2,
    });
    expect(items[1]).toMatchObject({ kind: 'keyword', score: 1 });
  });

  it('pushes one path item per task even with several matching files', () => {
    const items = computeClassA(
      [
        task({
          files: ['src/tools/approvals.ts', 'harness/hooks/x.js'],
          block: '',
        }),
      ],
      ['src/tools/approvals.ts', 'harness/hooks/']
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('sensitive-path');
  });

  it('sorts every sensitive-path item ahead of every keyword item', () => {
    const items = computeClassA(
      [
        task({ id: '1', block: 'add auth', files: [] }),
        task({ id: '2', files: ['src/core/path-utils.ts'], block: '' }),
      ],
      ['src/core/path-utils.ts']
    );
    const kinds = items.map((i: ClassAItem) => i.kind);
    expect(kinds).toEqual(['sensitive-path', 'keyword']);
  });
});

describe('computeClassA — null sensitive list (requirement 4.5)', () => {
  it('pushes no path item yet still fires keywords, never NO_LIST_REASON', () => {
    const items = computeClassA(
      [
        task({
          files: ['src/tools/approvals.ts'],
          block: 'Run the migration',
        }),
      ],
      null
    );
    expect(items.every((i) => i.kind === 'keyword')).toBe(true);
    expect(items).toHaveLength(1);
    expect(items[0].reason).toBe('keyword: migration');
    expect(items.some((i) => i.reason.includes(NO_LIST_REASON))).toBe(false);
  });
});
