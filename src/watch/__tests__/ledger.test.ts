import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildModel, loadAgentProfiles, parseHandoffActiveSpec, parseHandoffPhaseRows, parseJsonl, parseTasks, formatTokens, LedgerEvent, ActivityEvent } from '../ledger.js';

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

describe('loadAgentProfiles', () => {
  it('gives {} for a missing candidate and for a malformed one', () => {
    expect(loadAgentProfiles(['/nonexistent/agent-profiles.json'])).toEqual({});
    const dir = mkdtempSync(join(tmpdir(), 'profiles-'));
    const bad = join(dir, 'agent-profiles.json');
    writeFileSync(bad, 'not json');
    try {
      expect(loadAgentProfiles([bad])).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads the generated profiles by default', () => {
    const profiles = loadAgentProfiles();
    expect(Object.keys(profiles)).toHaveLength(12);
    expect(profiles['sdd-checker']).toEqual({ model: 'claude-sonnet-5', effort: 'high', role: 'checker', cacheTtl: 'default' });
  });

  it('copies cacheTtl only when the profiles file carries it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'profiles-'));
    const without = join(dir, 'without.json');
    const withTtl = join(dir, 'with.json');
    writeFileSync(without, JSON.stringify({ 'sdd-x': { model: 'm', effort: 'e', role: 'r' } }));
    writeFileSync(withTtl, JSON.stringify({ 'sdd-x': { model: 'm', effort: 'e', role: 'r', cacheTtl: '1h' } }));
    try {
      const a = loadAgentProfiles([without]);
      expect(a['sdd-x']).toEqual({ model: 'm', effort: 'e', role: 'r' });
      expect('cacheTtl' in a['sdd-x']).toBe(false);
      const b = loadAgentProfiles([withTtl]);
      expect(b['sdd-x']).toEqual({ model: 'm', effort: 'e', role: 'r', cacheTtl: '1h' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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
    // A spawn.end that carries tokens wins over the hook, and every spawn's tokens add up.
    ev.push({ ts: '2026-09-12T19:11:00.000Z', run: 'run-2', spec: 's', type: 'spawn.end', agent: 'sdd-implementation-orchestrator', role: 'implementation phase, spawn 2', result: 'resume', tokens: '58851' });
    const m2 = buildModel({ spec: 's', ledger: ev, activity: act, tasksMd: TASKS });
    expect(m2.spawns[0].tokens).toBe(58_851);
    expect(m2.tokensTotal).toBe(84_000 + 58_851);
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

  it('treats an orchestrator that has not yet written phase.start as the live phase', () => {
    const ev: LedgerEvent[] = [
      { ts: '2026-09-13T10:00:00.000Z', run: 'run-3', spec: 's', type: 'run.start', model: 'fable-5-1' },
      { ts: '2026-09-13T10:00:01.000Z', run: 'run-3', spec: 's', type: 'spawn.start', agent: 'sdd-closeout-orchestrator', role: 'closeout phase, spawn 1', phase: 'closeout' },
    ];
    const m = buildModel({ spec: 's', ledger: ev, activity: [] });
    expect(m.livePhase?.phase).toBe('closeout');
    expect(m.livePhase?.state).toBeUndefined();
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

  it('folds a spawn.usage onto the hook-written spawn of the same agent', () => {
    const ev = ledger();
    // The hook writes a coarse spawn.start (in ledger()) and a spawn.end with no tokens.
    ev.push({ ts: '2026-09-12T19:10:00.000Z', run: 'run-2', spec: 's', type: 'spawn.end', agent: 'sdd-implementer' });
    // The orchestrator writes the precise usage event: role, result, tokens.
    ev.push({ ts: '2026-09-12T19:10:01.000Z', run: 'run-2', spec: 's', type: 'spawn.usage', agent: 'sdd-implementer', role: 'implement task 3 (v2)', result: 'logged: yes/3', tokens: '84000', phase: 'implementation', task: '3' });
    const m = buildModel({ spec: 's', ledger: ev, activity: [], tasksMd: TASKS });
    expect(m.spawns).toHaveLength(2); // no synthesized node: the usage claimed the hook node
    const impl = m.spawns[1];
    expect(impl.role).toBe('implement task 3 (v2)');
    expect(impl.result).toBe('logged: yes/3');
    expect(impl.tokens).toBe(84_000);
    expect(impl.endedAt).toBe('2026-09-12T19:10:00.000Z');
    expect(m.tokensTotal).toBe(84_000);
  });

  it('synthesizes a node for a reused-agent prompt-launched worker whose brief node is claimed', () => {
    const ev = ledger();
    // Per-task verifier: brief-launched, so the hook writes spawn.start/spawn.end.
    ev.push({ ts: '2026-09-12T19:11:00.000Z', run: 'run-2', spec: 's', type: 'spawn.start', agent: 'sdd-verifier', role: 'verify task', phase: 'implementation', task: '3' });
    ev.push({ ts: '2026-09-12T19:12:00.000Z', run: 'run-2', spec: 's', type: 'spawn.end', agent: 'sdd-verifier' });
    // Its usage claims that hook node.
    ev.push({ ts: '2026-09-12T19:12:01.000Z', run: 'run-2', spec: 's', type: 'spawn.usage', agent: 'sdd-verifier', role: 'verify task 3', result: 'pass', tokens: '40000', phase: 'implementation', task: '3' });
    // End-to-end verifier: prompt-launched, no brief node; its usage synthesizes a node.
    ev.push({ ts: '2026-09-12T19:20:00.000Z', run: 'run-2', spec: 's', type: 'spawn.usage', agent: 'sdd-verifier', role: 'verify end to end', result: 'pass', tokens: '25000', phase: 'implementation' });
    const m = buildModel({ spec: 's', ledger: ev, activity: [], tasksMd: TASKS });
    const verifiers = m.spawns.filter(s => s.agent === 'sdd-verifier');
    expect(verifiers).toHaveLength(2);
    const [perTask, e2e] = verifiers;
    expect(perTask.role).toBe('verify task 3');
    expect(perTask.tokens).toBe(40_000);
    expect(perTask.endedAt).toBe('2026-09-12T19:12:00.000Z');
    expect(e2e.role).toBe('verify end to end');
    expect(e2e.tokens).toBe(25_000);
    expect(e2e.level).toBe(2);
    expect(e2e.startedAt).toBe('2026-09-12T19:20:00.000Z');
    expect(e2e.endedAt).toBe('2026-09-12T19:20:00.000Z');
    expect(m.tokensTotal).toBe(40_000 + 25_000);
  });

  it('leaves an old ledger (spawn.start/end with tokens, no spawn.usage) unchanged', () => {
    const ev = ledger();
    ev.push({ ts: '2026-09-12T19:10:00.000Z', run: 'run-2', spec: 's', type: 'spawn.end', agent: 'sdd-implementer', role: 'implement task 3', result: 'logged: yes/3', tokens: '84000' });
    const m = buildModel({ spec: 's', ledger: ev, activity: [], tasksMd: TASKS });
    // No spawn.usage, so the fold pass is inert: same two nodes, tokens from spawn.end.
    expect(m.spawns).toHaveLength(2);
    expect(m.spawns[1].role).toBe('implement task 3');
    expect(m.spawns[1].tokens).toBe(84_000);
    expect(m.tokensTotal).toBe(84_000);
  });

  it('works with no ledger at all (a spec built before the harness)', () => {
    const m = buildModel({ spec: 'tags-and-setups', ledger: [], activity: [], tasksMd: TASKS, handoffMd: HANDOFF });
    expect(m.runId).toBeUndefined();
    expect(m.phases).toHaveLength(3);
    expect(m.spawns).toEqual([]);
    expect(m.hasActivity).toBe(false);
  });

  it('carries the hook usage keys from a spawn.end onto the spawn node', () => {
    const ev = ledger();
    ev.push({ ts: '2026-09-12T19:10:00.000Z', run: 'run-2', spec: 's', type: 'spawn.end', agent: 'sdd-implementer', role: 'implement task 3', result: 'logged: yes/3', model: 'claude-opus-4-8', input: '10000', output: '4000', cacheWrite: '30000', cacheRead: '40000', tokens: '84000' });
    const m = buildModel({ spec: 's', ledger: ev, activity: [], tasksMd: TASKS });
    const impl = m.spawns[1];
    expect(impl.model).toBe('claude-opus-4-8');
    expect(impl.input).toBe(10_000);
    expect(impl.output).toBe(4_000);
    expect(impl.cacheWrite).toBe(30_000);
    expect(impl.cacheRead).toBe(40_000);
    expect(impl.tokens).toBe(84_000);
    expect(m.tokensTotal).toBe(84_000);
  });

  it('keeps a digit-string spawn.end tokens over a later folded spawn.usage', () => {
    const ev = ledger();
    ev.push({ ts: '2026-09-12T19:10:00.000Z', run: 'run-2', spec: 's', type: 'spawn.end', agent: 'sdd-implementer', role: 'implement task 3', result: 'logged: yes/3', tokens: '84000' });
    ev.push({ ts: '2026-09-12T19:10:01.000Z', run: 'run-2', spec: 's', type: 'spawn.usage', agent: 'sdd-implementer', role: 'implement task 3 (v2)', result: 'logged: yes/3', tokens: '1', phase: 'implementation', task: '3' });
    const m = buildModel({ spec: 's', ledger: ev, activity: [], tasksMd: TASKS });
    const impl = m.spawns[1];
    expect(impl.tokens).toBe(84_000);
    expect(m.tokensTotal).toBe(84_000);
  });

  it('carries provider (spawn.start, overwritten by spawn.end), splits tokens by provider, reads the run map', () => {
    const ev = ledger().map(e =>
      e.type === 'run.start' && e.run === 'run-2'
        ? { ...e, providers: 'sdd-reviewer:deepseek:deepseek-v4-pro' }
        : e);
    // Anthropic implementer (fixture spawn.start, no provider) closes with tokens.
    ev.push({ ts: '2026-09-12T19:10:00.000Z', run: 'run-2', spec: 's', type: 'spawn.end', agent: 'sdd-implementer', role: 'implement task 3', result: 'logged: yes/3', tokens: '84000' });
    // DeepSeek reviewer: the provider on spawn.start is overwritten by the spawn.end's.
    ev.push({ ts: '2026-09-12T19:11:00.000Z', run: 'run-2', spec: 's', type: 'spawn.start', agent: 'sdd-reviewer', role: 'review task 3', phase: 'implementation', task: '3', provider: 'anthropic' });
    ev.push({ ts: '2026-09-12T19:12:00.000Z', run: 'run-2', spec: 's', type: 'spawn.end', agent: 'sdd-reviewer', result: 'pass', tokens: '182000', provider: 'deepseek' });
    const m = buildModel({ spec: 's', ledger: ev, activity: [], tasksMd: TASKS });
    const reviewer = m.spawns.find(s => s.agent === 'sdd-reviewer');
    expect(reviewer?.provider).toBe('deepseek');
    expect(m.tokensByProvider).toEqual({ anthropic: 84_000, deepseek: 182_000 });
    expect(m.tokensTotal).toBe(84_000 + 182_000);
    expect(m.providers).toBe('sdd-reviewer:deepseek:deepseek-v4-pro');
  });
});
