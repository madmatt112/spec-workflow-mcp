import { describe, it, expect } from 'vitest';
import { buildModel, parseHandoffActiveSpec, parseHandoffPhaseRows, parseJsonl, parseTasks, formatTokens, LedgerEvent, ActivityEvent } from '../ledger.js';

const HANDOFF = `# HANDOFF

> **READ FIRST — SDD routing (2026-09-12, harness v4).** Active spec **\`tags-and-setups\`**.
> Live phase **implementation**.

## Phase log

| Date | Spec | Stage | State | Result | Note |
| --- | --- | --- | --- | --- | --- |
| 2026-09-12 | tags-and-setups | requirements | v7 | approved | 7 rounds |
| 2026-09-12 | tags-and-setups | design | v1 | approved | converged round 1 |
| 2026-09-12 | other-spec | design | v2 | approved | not ours |
| 2026-09-12 | tags-and-setups | implementation | tasks 4/17 | resume | spawn 1 interrupted |

## tags-and-setups — requirements
| Field | Value |
| State | approved |
`;

const TASKS = `# Tasks

- [x] 1. Shared contract: tag schemas
  - _Requirements: 1.1_
- [x] 2. Tables and migration
- [-] 3. API errors and \`tags\` query layer
- [ ] 4. Tags service
- [ ] 5.1 Sub task
`;

function ledger(): LedgerEvent[] {
  return [
    { ts: '2026-09-12T18:00:00.000Z', run: 'run-1', spec: 's', type: 'run.start', model: 'fable' },
    { ts: '2026-09-12T18:00:05.000Z', run: 'run-1', spec: 's', type: 'phase.end', phase: 'tasks', result: 'approved', state: 'v2', note: 'old run' },
    { ts: '2026-09-12T19:00:00.000Z', run: 'run-2', spec: 's', type: 'run.start', model: 'fable-5-1', codeRoot: '/w/tree', worktree: 'yes', headless: 'yes' },
    { ts: '2026-09-12T19:00:10.000Z', run: 'run-2', spec: 's', type: 'spawn.start', agent: 'sdd-implementation-orchestrator', role: 'implementation phase, spawn 2', phase: 'implementation' },
    { ts: '2026-09-12T19:00:20.000Z', run: 'run-2', spec: 's', type: 'phase.start', phase: 'implementation', mode: 'normal', budget: '6 tasks', state: 'tasks 2/5' },
    { ts: '2026-09-12T19:01:00.000Z', run: 'run-2', spec: 's', type: 'task.pick', task: '3', title: 'API errors' },
    { ts: '2026-09-12T19:01:05.000Z', run: 'run-2', spec: 's', type: 'spawn.start', agent: 'sdd-implementer', role: 'implement task 3', phase: 'implementation', task: '3' },
  ];
}

function activity(): ActivityEvent[] {
  return [
    { ts: '2026-09-12T19:01:06.000Z', run: 'run-2', agent: 'sdd-implementer', event: 'agent.start', agentId: 'a1' },
    { ts: '2026-09-12T19:03:00.000Z', run: 'run-2', agent: 'sdd-implementer', event: 'tool', tool: 'Read', summary: '/w/tree/apps/api/x.ts', agentId: 'a1' },
    { ts: '2026-09-12T19:04:30.000Z', run: 'run-2', agent: 'sdd-implementer', event: 'tool', tool: 'Bash', summary: 'pnpm vitest run apps/api', agentId: 'a1' },
    // An unrelated agent from another spawn does not attach to this spawn.
    { ts: '2026-09-12T19:04:40.000Z', run: 'run-2', agent: 'sdd-verifier', event: 'tool', tool: 'Read', summary: '/w/tree/other', agentId: 'b1' },
  ];
}

describe('parse helpers', () => {
  it('parses jsonl and skips a torn tail', () => {
    const rows = parseJsonl<LedgerEvent>('{"ts":"a","type":"x"}\n{"ts":"b","type":"y"}\n{"ts":"c","ty');
    expect(rows.map(r => r.type)).toEqual(['x', 'y']);
    expect(parseJsonl(undefined)).toEqual([]);
  });

  it('reads the active spec and the phase log rows of one spec from HANDOFF', () => {
    expect(parseHandoffActiveSpec(HANDOFF)).toBe('tags-and-setups');
    const rows = parseHandoffPhaseRows(HANDOFF, 'tags-and-setups');
    expect(rows.map(r => `${r.phase}:${r.state}:${r.result}`)).toEqual([
      'requirements:v7:approved',
      'design:v1:approved',
      'implementation:tasks 4/17:resume',
    ]);
  });

  it('parses task markers and titles', () => {
    const tasks = parseTasks(TASKS);
    expect(tasks.map(t => `${t.id}:${t.status}`)).toEqual(['1:done', '2:done', '3:in-progress', '4:open', '5.1:open']);
    expect(tasks[2].title).toBe('API errors and tags query layer');
  });

  it('formats tokens', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(12_400)).toBe('12k');
    expect(formatTokens(1_250_000)).toBe('1.3M');
  });
});

describe('buildModel', () => {
  it('scopes live state to the last run and keeps phases from HANDOFF and earlier runs', () => {
    const m = buildModel({ spec: 'tags-and-setups', ledger: ledger(), activity: activity(), tasksMd: TASKS, handoffMd: HANDOFF });
    expect(m.runId).toBe('run-2');
    expect(m.model).toBe('fable-5-1');
    expect(m.worktree).toBe('yes');
    // HANDOFF rows first, then the run-1 phase.end that HANDOFF lacks.
    expect(m.phases.map(p => `${p.phase}:${p.result}`)).toEqual([
      'requirements:approved', 'design:approved', 'implementation:resume', 'tasks:approved',
    ]);
    expect(m.livePhase?.phase).toBe('implementation');
    expect(m.livePhase?.budget).toBe('6 tasks');
  });

  it('pairs spawns with activity by agent and time, and reports the last tool call', () => {
    const m = buildModel({ spec: 's', ledger: ledger(), activity: activity(), tasksMd: TASKS });
    expect(m.spawns).toHaveLength(2);
    const [orch, impl] = m.spawns;
    expect(orch.level).toBe(1);
    expect(orch.endedAt).toBeUndefined();
    expect(impl.level).toBe(2);
    expect(impl.task).toBe('3');
    expect(impl.lastTool).toBe('Bash');
    expect(impl.lastSummary).toBe('pnpm vitest run apps/api');
    expect(impl.lastActivityAt).toBe('2026-09-12T19:04:30.000Z');
    expect(m.hasActivity).toBe(true);
    expect(m.tokensTotal).toBe(0);
  });

  it('closes a spawn on spawn.end and takes tokens from the agent.stop in its window', () => {
    const ev = ledger();
    ev.push({ ts: '2026-09-12T19:10:00.000Z', run: 'run-2', spec: 's', type: 'spawn.end', agent: 'sdd-implementer', role: 'implement task 3', result: 'logged: yes/3' });
    ev.push({ ts: '2026-09-12T19:10:30.000Z', run: 'run-2', spec: 's', type: 'task.done', task: '3', rounds: '1', outcome: 'pass' });
    const act = activity();
    act.push({ ts: '2026-09-12T19:09:59.000Z', run: 'run-2', agent: 'sdd-implementer', event: 'agent.stop', tokens: 84_000, agentId: 'a1' });
    const m = buildModel({ spec: 's', ledger: ev, activity: act, tasksMd: TASKS });
    const impl = m.spawns[1];
    expect(impl.endedAt).toBe('2026-09-12T19:10:00.000Z');
    expect(impl.result).toBe('logged: yes/3');
    expect(impl.tokens).toBe(84_000);
    expect(m.tokensTotal).toBe(84_000);
    expect(m.ticker.map(t => t.text.split(/\s+/)[0]).slice(-2)).toEqual(['spawn.end', 'task.done']);
    expect(m.ticker).toHaveLength(4);
  });

  it('ends the live phase on phase.end and records run.end', () => {
    const ev = ledger();
    ev.push({ ts: '2026-09-12T19:30:00.000Z', run: 'run-2', spec: 's', type: 'phase.end', phase: 'implementation', result: 'resume', state: 'tasks 3/5', note: 'budget' });
    ev.push({ ts: '2026-09-12T19:30:05.000Z', run: 'run-2', spec: 's', type: 'run.end', status: 'tradr:s implementation tasks 3/5 - budget' });
    const m = buildModel({ spec: 's', ledger: ev, activity: [], tasksMd: TASKS });
    expect(m.livePhase).toBeUndefined();
    expect(m.status).toContain('budget');
    expect(m.phases.some(p => p.phase === 'implementation' && p.result === 'resume' && p.state === 'tasks 3/5')).toBe(true);
  });

  it('tracks picked items for phases without a task queue (close-out)', () => {
    const ev: LedgerEvent[] = [
      { ts: '2026-09-13T10:00:00.000Z', run: 'run-3', spec: 's', type: 'run.start', model: 'fable-5-1' },
      { ts: '2026-09-13T10:00:05.000Z', run: 'run-3', spec: 's', type: 'phase.start', phase: 'closeout', state: 'items 0/3' },
      { ts: '2026-09-13T10:00:10.000Z', run: 'run-3', spec: 's', type: 'task.pick', task: 'P1', title: 'Raise the budget' },
      { ts: '2026-09-13T10:00:11.000Z', run: 'run-3', spec: 's', type: 'task.pick', task: 'P2', title: 'Keep every analysis file' },
      { ts: '2026-09-13T10:05:00.000Z', run: 'run-3', spec: 's', type: 'task.done', task: 'P1', outcome: 'done' },
    ];
    const m = buildModel({ spec: 's', ledger: ev, activity: [] });
    expect(m.livePhase?.phase).toBe('closeout');
    expect(m.picks.map(pk => `${pk.task}:${pk.done ? pk.outcome : 'open'}`)).toEqual(['P1:done', 'P2:open']);
    expect(m.ticker[m.ticker.length - 1].text).toBe('task.done   task P1  done');
  });

  it('works with no ledger at all (a spec built before the harness)', () => {
    const m = buildModel({ spec: 'tags-and-setups', ledger: [], activity: [], tasksMd: TASKS, handoffMd: HANDOFF });
    expect(m.runId).toBeUndefined();
    expect(m.phases).toHaveLength(3);
    expect(m.spawns).toEqual([]);
    expect(m.hasActivity).toBe(false);
  });
});
