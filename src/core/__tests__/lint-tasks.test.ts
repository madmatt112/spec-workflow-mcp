import { describe, it, expect } from 'vitest';
import {
  checkTasksFormat,
  requirementIndex,
  checkRequirementIds,
  designComponents,
  checkCoverage,
  checkBridges,
} from '../lint-tasks.js';
import { taskBlocks } from '../lint-markdown.js';

describe('checkTasksFormat', () => {
  it('returns no findings for a well-formed task', () => {
    const content = [
      '- [ ] 1. Build the thing',
      '  - _Prompt: Task: build it | Restrictions: none | Success: done_',
    ].join('\n');
    expect(checkTasksFormat(content)).toEqual([]);
  });

  it('maps a validator error to a tasks-format error, message verbatim', () => {
    const content = '- [ ] Build the thing';
    expect(checkTasksFormat(content)).toEqual([
      { file: '', line: 1, rule: 'tasks-format', severity: 'error', message: 'Missing task ID number' },
    ]);
  });

  it('maps a validator warning to a tasks-format warning', () => {
    const content = [
      '- [ ] 1. Build the thing',
      '  - _Prompt: Task: build it | Restrictions: none | Success: done',
    ].join('\n');
    expect(checkTasksFormat(content)).toEqual([
      { file: '', line: 1, rule: 'tasks-format', severity: 'warning', message: 'Prompt field may be missing closing underscore' },
    ]);
  });
});

describe('requirementIndex', () => {
  const reqLines = [
    '### Requirement 1 — Foo',
    '#### Acceptance Criteria',
    '1. The tool SHALL do X.',
    '2. The tool SHALL do Y.',
    '',
    '### Requirement 2 — Bar',
    '#### Acceptance Criteria',
    '1. The tool SHALL do Z.',
    '',
    '### Requirement 3 — Baz',
  ];

  it('maps every heading to its item numbers, empty for a requirement with no criteria', () => {
    const index = requirementIndex(reqLines);
    expect([...index.keys()].sort()).toEqual([1, 2, 3]);
    expect([...index.get(1)!].sort()).toEqual([1, 2]);
    expect([...index.get(2)!]).toEqual([1]);
    expect([...index.get(3)!]).toEqual([]);
  });
});

describe('checkRequirementIds', () => {
  const index = requirementIndex([
    '### Requirement 1 — Foo',
    '#### Acceptance Criteria',
    '1. The tool SHALL do X.',
    '2. The tool SHALL do Y.',
    '### Requirement 2 — Bar',
    '#### Acceptance Criteria',
    '1. The tool SHALL do Z.',
  ]);

  it('passes N, N.M and an NFR token, flags a miss and an unknown token', () => {
    const lines = [
      '- [ ] 1. Task',
      '  - _Requirements: 1, 1.2, NFR Security, REQ-001, 3, 2.5_',
    ];
    expect(checkRequirementIds(lines, index)).toEqual([
      { file: '', line: 2, rule: 'task-requirement-unchecked', severity: 'info', message: 'requirement token `REQ-001` not checked' },
      { file: '', line: 2, rule: 'task-requirement-id', severity: 'error', message: 'requirement id `3` not found in requirements.md' },
      { file: '', line: 2, rule: 'task-requirement-id', severity: 'error', message: 'requirement id `2.5` not found in requirements.md' },
    ]);
  });

  it('skips a _Requirements: token that sits on a _Prompt: line', () => {
    const lines = ['  - _Prompt: Task: cite _Requirements: 9 in the body_'];
    expect(checkRequirementIds(lines, index)).toEqual([]);
  });

  it('returns one info on line 1 when there is no index', () => {
    const lines = ['  - _Requirements: 1, 2_'];
    expect(checkRequirementIds(lines, null)).toEqual([
      { file: '', line: 1, rule: 'task-requirement-unchecked', severity: 'info', message: 'no requirements index; requirement ids not checked' },
    ]);
  });
});

describe('designComponents', () => {
  const designLines = [
    '# Design',
    '',
    '## Components and Interfaces',
    '',
    '### Component 1 — Tool registration (`src/tools/spec-lint.ts`)',
    '- **Purpose:** register',
    '',
    '### `spec-lint` tool',
    '- text',
    '',
    '## Data Models',
    '### Not a component',
  ];

  it('reads both label shapes and stops at the next h2', () => {
    expect(designComponents(designLines)).toEqual([
      { heading: 'Component 1 — Tool registration (`src/tools/spec-lint.ts`)', label: 'Component 1', line: 5 },
      { heading: '`spec-lint` tool', label: 'spec-lint tool', line: 8 },
    ]);
  });

  it('returns null when there is no components section', () => {
    expect(designComponents(['# Design', '## Overview', 'text'])).toBeNull();
  });
});

describe('checkCoverage', () => {
  const components = designComponents([
    '## Components and Interfaces',
    '### Component 1 — Tool registration',
    '### `spec-lint` tool',
    '## Data Models',
  ])!;

  it('flags a component no task covers', () => {
    const tasksLines = [
      '- [ ] 1. Register the tool',
      '  - Implements Component 1.',
      '  - _Prompt: Task: do it_',
    ];
    expect(checkCoverage(tasksLines, taskBlocks(tasksLines), components)).toEqual([
      { file: '', line: 1, rule: 'coverage-component', severity: 'error', message: 'design component "`spec-lint` tool" is covered by no task (design.md line 3)' },
    ]);
  });

  it('matches a label from a task prompt line too', () => {
    const tasksLines = [
      '- [ ] 1. Do the work',
      '  - _Prompt: Task: cover Component 1 and the spec-lint tool | Restrictions: none | Success: done_',
    ];
    expect(checkCoverage(tasksLines, taskBlocks(tasksLines), components)).toEqual([]);
  });

  it('returns one coverage-unchecked info when there are no components', () => {
    expect(checkCoverage(['- [ ] 1. Task'], taskBlocks(['- [ ] 1. Task']), null)).toEqual([
      { file: '', line: 1, rule: 'coverage-unchecked', severity: 'info', message: 'design.md has no components section; coverage not checked' },
    ]);
  });
});

describe('checkBridges', () => {
  it('flags a block that names a later task with no bridge', () => {
    const lines = [
      '- [ ] 1. First task',
      '  - This depends on task 2 doing its part.',
      '  - _Prompt: Task: do it_',
      '- [ ] 2. Second task',
      '  - _Prompt: Task: do more_',
    ];
    expect(checkBridges(lines, taskBlocks(lines))).toEqual([
      { file: '', line: 1, rule: 'bridge-missing', severity: 'warning', message: 'task 1 names later task 2 with no bridge' },
    ]);
  });

  it('passes a block that names a later task and the word bridge (review-gate tasks.md:50-51)', () => {
    const lines = [
      '- [ ] 5. Add handleGate',
      '  - `data.touched.paths` is cut to 100 for display only; no dispatch',
      '    exists yet, so the test calls `handleGate` directly (bridge;',
      '    task 6 adds the dispatch case)',
      '  - _Prompt: Task: implement it_',
    ];
    expect(checkBridges(lines, taskBlocks(lines))).toEqual([]);
  });

  it('does not flag an earlier task or the block itself', () => {
    const lines = [
      '- [ ] 1. First task',
      '  - _Prompt: Task: do it_',
      '- [ ] 2. Second task',
      '  - Builds on task 1 and revisits task 2.',
      '  - _Prompt: Task: do more_',
    ];
    expect(checkBridges(lines, taskBlocks(lines))).toEqual([]);
  });
});
