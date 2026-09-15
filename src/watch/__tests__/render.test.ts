import { describe, it, expect } from 'vitest';
import { buildModel, LedgerEvent, ActivityEvent } from '../ledger.js';
import { render } from '../render.js';

const NOW = new Date('2026-09-12T19:12:00.000Z');
const ESC = String.fromCharCode(27);

const TASKS = `# Tasks
- [x] 1. Shared contract
- [x] 2. Tables and migration
- [-] 3. API errors and query layer
- [ ] 4. Tags service
- [ ] 5. Position endpoint
- [ ] 6. Chips column
- [ ] 7. Settings tab
- [ ] 8. Gate
`;

const HANDOFF = `## Phase log

| Date | Spec | Stage | State | Result | Note |
| --- | --- | --- | --- | --- | --- |
| 2026-09-12 | s | requirements | v7 | approved | 7 rounds, converged 0/0/0 |
| 2026-09-12 | s | design | v1 | approved | converged round 1 |
| 2026-09-12 | s | tasks | v2 | approved | 2 rounds |
`;

const LEDGER: LedgerEvent[] = [
  { ts: '2026-09-12T19:00:00.000Z', run: 'run-20260912-190000', spec: 's', type: 'run.start', model: 'fable-5-1', codeRoot: '/home/x/.claude/worktrees/s', worktree: 'yes' },
  { ts: '2026-09-12T19:00:10.000Z', run: 'run-20260912-190000', spec: 's', type: 'spawn.start', agent: 'sdd-implementation-orchestrator', role: 'implementation phase, spawn 1', phase: 'implementation' },
  { ts: '2026-09-12T19:00:20.000Z', run: 'run-20260912-190000', spec: 's', type: 'phase.start', phase: 'implementation', mode: 'normal', budget: '6 tasks', state: 'tasks 2/8' },
  { ts: '2026-09-12T19:01:00.000Z', run: 'run-20260912-190000', spec: 's', type: 'task.pick', task: '3', title: 'API errors and query layer' },
  { ts: '2026-09-12T19:01:05.000Z', run: 'run-20260912-190000', spec: 's', type: 'spawn.start', agent: 'sdd-implementer', role: 'implement task 3', phase: 'implementation', task: '3' },
];

const ACTIVITY: ActivityEvent[] = [
  { ts: '2026-09-12T19:01:06.000Z', agent: 'sdd-implementer', event: 'agent.start' },
  { ts: '2026-09-12T19:04:30.000Z', agent: 'sdd-implementer', event: 'tool', tool: 'Bash', summary: 'pnpm vitest run --maxWorkers=2 apps/api/src/features/tags' },
  { ts: '2026-09-12T19:00:15.000Z', agent: 'sdd-implementation-orchestrator', event: 'tool', tool: 'Read', summary: '/store/.spec-workflow/specs/s/tasks.md' },
];

describe('render', () => {
  it('draws the outline with phases, live spawn tree, queued tasks and the ticker (no colour)', () => {
    const model = buildModel({ spec: 's', ledger: LEDGER, activity: ACTIVITY, tasksMd: TASKS, handoffMd: HANDOFF });
    const out = render(model, { now: NOW, width: 120, color: false });
    const lines = out.split('\n');
    expect(lines[0]).toContain('s | s | worktree | run 20260912-190000 | up 12:00');
    expect(lines[0]).toMatch(/tokens 0\s*$/);
    expect(out).toContain('+ requirements   v7          approved   7 rounds, converged 0/0/0');
    expect(out).toContain('+ design         v1          approved   converged round 1');
    expect(out).toContain('> implementation tasks 2/8      spawn 1 | since');
    // Orchestrator: running, its last tool call was 11:45 ago.
    expect(out).toMatch(/> sdd-implementation-orchestrator\s+fable-5-1\s+xhigh\s+implementation phase, spawn 1\s+11:50\s+\* 11:45/);
    expect(out).toContain('+ 2 done, last 2  Tables and migration');
    expect(out).toContain('> 3  API errors and query layer');
    expect(out).toMatch(/> sdd-implementer\s+opus-4-8\s+xhigh\s+implement task 3\s+10:55\s+\* 7:30/);
    expect(out).toContain('Bash   pnpm vitest run --maxWorkers=2 apps/api/src/features/tags');
    expect(out).toContain('o 4  Tags service');
    expect(out).toContain('... 2 more queued');
    expect(out).toContain('o retrospective');
    expect(out).toContain('spawn.start sdd-implementer  implement task 3');
    expect(out).toContain('age since the agent');
    expect(out).not.toContain(ESC);
  });

  it('colours the age badge by silence', () => {
    const model = buildModel({ spec: 's', ledger: LEDGER, activity: ACTIVITY, tasksMd: TASKS, handoffMd: HANDOFF });
    const out = render(model, { now: NOW, width: 120, color: true });
    // implementer silent 7:30 -> amber (33); orchestrator silent 11:45 -> amber too (red is 15 min)
    expect(out).toContain(`${ESC}[33m* 7:30${ESC}[0m`);
    expect(out).toContain(`${ESC}[33m* 11:45${ESC}[0m`);
    // Four minutes later the orchestrator crosses 15 min of silence -> red (31); the implementer stays amber.
    const later = render(model, { now: new Date('2026-09-12T19:16:00.000Z'), width: 120, color: true });
    expect(later).toContain(`${ESC}[31m* 15:45${ESC}[0m`);
    expect(later).toContain(`${ESC}[33m* 11:30${ESC}[0m`);
  });

  it('says so when there is no ledger and no activity', () => {
    const model = buildModel({ spec: 's', ledger: [], activity: [], tasksMd: TASKS, handoffMd: HANDOFF });
    const out = render(model, { now: NOW, width: 80, color: false });
    expect(out).toContain('no run recorded');
    expect(out).toContain('tokens -');
    expect(out).toContain('no harness-events.jsonl for this spec yet');
    expect(out).toContain('no events yet');
    expect(out).toContain('no activity events yet');
  });

  it('draws a close-out phase from the picked items', () => {
    const ledger: LedgerEvent[] = [
      { ts: '2026-09-13T10:00:00.000Z', run: 'run-20260913-100000', spec: 's', type: 'run.start', model: 'fable-5-1', codeRoot: '/home/x/tradr', worktree: 'no' },
      { ts: '2026-09-13T10:00:05.000Z', run: 'run-20260913-100000', spec: 's', type: 'spawn.start', agent: 'sdd-closeout-orchestrator', role: 'closeout phase, spawn 1', phase: 'closeout' },
      { ts: '2026-09-13T10:00:10.000Z', run: 'run-20260913-100000', spec: 's', type: 'phase.start', phase: 'closeout', mode: 'normal', budget: '8 items', state: 'items 0/3' },
      { ts: '2026-09-13T10:00:20.000Z', run: 'run-20260913-100000', spec: 's', type: 'task.pick', task: 'P1', title: 'Raise the budget' },
      { ts: '2026-09-13T10:00:21.000Z', run: 'run-20260913-100000', spec: 's', type: 'task.done', task: 'P1', outcome: 'skipped' },
      { ts: '2026-09-13T10:00:30.000Z', run: 'run-20260913-100000', spec: 's', type: 'task.pick', task: 'P2', title: 'Keep every analysis file' },
      { ts: '2026-09-13T10:00:31.000Z', run: 'run-20260913-100000', spec: 's', type: 'task.pick', task: 'P3', title: 'Bump the version header' },
      { ts: '2026-09-13T10:00:40.000Z', run: 'run-20260913-100000', spec: 's', type: 'spawn.start', agent: 'sdd-implementer', role: 'implement harness batch 1', phase: 'closeout' },
    ];
    const out = render(buildModel({ spec: 's', ledger, activity: [], handoffMd: HANDOFF }), { now: new Date('2026-09-13T10:05:00.000Z'), width: 100, color: false });
    expect(out).toContain('> closeout       items 1/3      spawn 1 | since');
    expect(out).toContain('> sdd-closeout-orchestrator');
    expect(out).toContain('+ 1 done, last P1  Raise the budget');
    expect(out).toContain('> P2 P3  2 items');
    expect(out).toMatch(/> sdd-implementer\s+opus-4-8\s+xhigh\s+implement harness batch 1/);
    expect(out).not.toContain('o closeout');
  });

  it('renders a spawn.usage ticker line with the precise role, result and tokens', () => {
    const ledger: LedgerEvent[] = [
      ...LEDGER,
      { ts: '2026-09-12T19:06:00.000Z', run: 'run-20260912-190000', spec: 's', type: 'spawn.end', agent: 'sdd-implementer' },
      { ts: '2026-09-12T19:06:01.000Z', run: 'run-20260912-190000', spec: 's', type: 'spawn.usage', agent: 'sdd-implementer', role: 'implement task 3 (v2)', result: 'logged: yes/3', tokens: '84000', phase: 'implementation', task: '3' },
    ];
    const out = render(buildModel({ spec: 's', ledger, activity: ACTIVITY, tasksMd: TASKS, handoffMd: HANDOFF }), { now: NOW, width: 120, color: false });
    expect(out).toContain('spawn.usage sdd-implementer  implement task 3 (v2)  -> logged: yes/3  84k tok');
  });

  it('shows a stopped run', () => {
    const ledger = [...LEDGER,
      { ts: '2026-09-12T19:10:00.000Z', run: 'run-20260912-190000', spec: 's', type: 'phase.end', phase: 'implementation', result: 'resume', state: 'tasks 3/8', note: 'budget' },
      { ts: '2026-09-12T19:10:05.000Z', run: 'run-20260912-190000', spec: 's', type: 'run.end', status: 'x:s implementation tasks 3/8 - budget' },
    ];
    const out = render(buildModel({ spec: 's', ledger, activity: [], tasksMd: TASKS, handoffMd: HANDOFF }), { now: NOW, width: 100, color: false });
    expect(out).toContain('# stopped x:s implementation tasks 3/8 - budget');
    expect(out).toContain('~ implementation tasks 3/8   resume     budget');
    const closed = [...LEDGER,
      { ts: '2026-09-12T19:10:00.000Z', run: 'run-20260912-190000', spec: 's', type: 'phase.end', phase: 'closeout', result: 'closed', state: 'items 5/5', note: '3 done' },
      { ts: '2026-09-12T19:10:05.000Z', run: 'run-20260912-190000', spec: 's', type: 'run.end', status: 'x:s closeout items 5/5 - closed' },
    ];
    const closedOut = render(buildModel({ spec: 's', ledger: closed, activity: [], tasksMd: TASKS, handoffMd: HANDOFF }), { now: NOW, width: 100, color: false });
    expect(closedOut).toContain('+ closeout       items 5/5   closed     3 done');
  });
});
