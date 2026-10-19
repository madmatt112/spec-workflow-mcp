import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { buildUsageRows } from '../usage-rows.js';
import { FileCache } from '../file-cache.js';
import { buildUsageReport } from '../../../watch/usage.js';
import type { LedgerEvent } from '../../../watch/ledger.js';
import type { ProjectContext } from '../../project-manager.js';

// Contract for src/dashboard/shell/usage-rows.ts (design.md C9; task 11 _Prompt;
// Requirements 3.1-3.9).
//
// Reached only through buildUsageRows(project, cache).

function tmpBase(): string {
  return mkdtempSync(join(tmpdir(), 'sdd-usage-rows-test-'));
}

function makeProject(base: string, name = 'Project One'): { project: ProjectContext; workflowRoot: string; specsDir: string } {
  const projectPath = mkdtempSync(join(base, 'proj-'));
  const workflowRoot = join(projectPath, '.spec-workflow');
  const specsDir = join(workflowRoot, 'specs');
  mkdirSync(specsDir, { recursive: true });
  const project = {
    projectId: randomUUID(),
    projectName: name,
    projectPath,
    workspacePath: projectPath,
    workflowRootPath: projectPath,
  } as ProjectContext;
  return { project, workflowRoot, specsDir };
}

function makeSpecDir(specsDir: string, spec: string): string {
  const dir = join(specsDir, spec);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeLedger(specDir: string, events: LedgerEvent[]): void {
  writeFileSync(join(specDir, 'harness-events.jsonl'), events.map((e) => JSON.stringify(e)).join('\n') + '\n');
}

function writeTasks(specDir: string, count: number): void {
  const lines = Array.from({ length: count }, (_, i) => `- [ ] ${i + 1}. task ${i + 1}`).join('\n');
  writeFileSync(join(specDir, 'tasks.md'), lines + '\n');
}

interface PhaseLogRow { date: string; spec: string; phase: string; state: string; result: string; note: string }

function phaseLogTable(rows: PhaseLogRow[]): string {
  return [
    '## Phase log',
    '',
    '| Date | Spec | Stage | State | Result | Note |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map((r) => `| ${r.date} | ${r.spec} | ${r.phase} | ${r.state} | ${r.result} | ${r.note} |`),
    '',
  ].join('\n');
}

function writeHandoff(workflowRoot: string, rows: PhaseLogRow[]): void {
  writeFileSync(join(workflowRoot, 'HANDOFF.md'), phaseLogTable(rows));
}

function writeRetroPlan(specsDir: string, spec: string, statusLine: string): void {
  writeFileSync(
    join(specsDir, spec, 'retrospective-plan.md'),
    `# Retrospective plan — ${spec}\n${statusLine}\n`,
  );
}

function writeAgentRules(workflowRoot: string, baselineLine: string | null): void {
  const text = baselineLine === null ? '# agent-rules\n' : `# agent-rules\n${baselineLine}\n`;
  writeFileSync(join(workflowRoot, 'agent-rules.md'), text);
}

/** A spawn.start/spawn.end pair carrying every W field, so its W is known (design C1). */
function knownSpawn(agent: string, phase: string, fields: Record<string, string>): LedgerEvent[] {
  return [
    { ts: '2026-01-01T00:00:00.000Z', type: 'spawn.start', agent, phase },
    { ts: '2026-01-01T00:00:01.000Z', type: 'spawn.end', agent, ...fields },
  ];
}

describe('buildUsageRows', () => {
  let base: string;

  beforeEach(() => { base = tmpBase(); });
  afterEach(() => { rmSync(base, { recursive: true, force: true }); });

  it('returns projectId, projectName and the newer of two closeout/closed dates (Req 3.1, 3.3)', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base, 'Repo Alpha');
    const specDir = makeSpecDir(specsDir, 'spec-a');
    writeTasks(specDir, 1);
    writeHandoff(workflowRoot, [
      { date: '2026-01-05', spec: 'spec-a', phase: 'closeout', state: 'complete', result: 'closed', note: 'first close' },
      { date: '2026-03-10', spec: 'spec-a', phase: 'closeout', state: 'complete', result: 'closed', note: 'reclosed' },
    ]);

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-a');
    expect(row).toBeDefined();
    expect(row?.projectId).toBe(project.projectId);
    expect(row?.projectName).toBe('Repo Alpha');
    expect(row?.closeDate).toBe('2026-03-10');
  });

  it('falls back to the newest ledger ts when the spec is closed via the retro plan, with no closeout/closed row (Req 3.2, 3.3)', async () => {
    const { project, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-b');
    writeTasks(specDir, 1);
    writeRetroPlan(specsDir, 'spec-b', 'Status: CLOSED — all decisions made');
    writeLedger(specDir, [
      { ts: '2026-02-01T00:00:00.000Z', type: 'spawn.start', agent: 'sdd-drafter', phase: 'requirements' },
      { ts: '2026-02-20T00:00:00.000Z', type: 'spawn.end', agent: 'sdd-drafter', input: '1', output: '1', cacheRead: '1', cacheWrite5m: '1', cacheWrite1h: '1' },
    ]);

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-b');
    expect(row?.closeDate).toBe('2026-02-20T00:00:00.000Z');
  });

  it('excludes a spec that is not closed (Req 3.2)', async () => {
    const { project, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-open');
    writeTasks(specDir, 1);

    const rows = await buildUsageRows(project, new FileCache());
    expect(rows.find((r) => r.spec === 'spec-open')).toBeUndefined();
  });

  it('gives a null closeDate and a null w when there is no closeout row and no ledger at all (Req 3.3, 3.8)', async () => {
    const { project, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-c');
    writeTasks(specDir, 1);
    writeRetroPlan(specsDir, 'spec-c', 'Status: CLOSED — done');

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-c');
    expect(row?.closeDate).toBeNull();
    expect(row?.w).toBeNull();
  });

  it('computes w equal to buildUsageReport(...).total.w exactly and wPerTask as w divided by tasks (Req 3.4, 3.5)', async () => {
    const { project, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-d');
    writeTasks(specDir, 4);
    writeRetroPlan(specsDir, 'spec-d', 'Status: CLOSED — done');
    const events = knownSpawn('sdd-drafter', 'requirements', {
      input: '100', output: '10', cacheRead: '20', cacheWrite5m: '8', cacheWrite1h: '4',
    });
    writeLedger(specDir, events);

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-d');
    const expected = buildUsageReport(events, 'spec-d').total.w;
    expect(row?.w).toBe(expected);
    expect(row?.w).toBe(170);
    expect(row?.wPerTask).toBe(170 / 4);
  });

  it('gives a null wPerTask when the task count is 0 (Req 3.6)', async () => {
    const { project, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-e');
    writeRetroPlan(specsDir, 'spec-e', 'Status: CLOSED — done');
    writeLedger(specDir, knownSpawn('sdd-drafter', 'requirements', {
      input: '100', output: '10', cacheRead: '20', cacheWrite5m: '8', cacheWrite1h: '4',
    }));

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-e');
    expect(row?.tasks).toBe(0);
    expect(row?.wPerTask).toBeNull();
  });

  it('gives wUnknown above 0 when a spawn has an unknown W (Req 3.7)', async () => {
    const { project, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-f');
    writeTasks(specDir, 2);
    writeRetroPlan(specsDir, 'spec-f', 'Status: CLOSED — done');
    writeLedger(specDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'spawn.start', agent: 'sdd-reviewer', phase: 'requirements' },
      { ts: '2026-01-01T00:00:01.000Z', type: 'spawn.end', agent: 'sdd-reviewer', tokens: '500' },
    ]);

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-f');
    expect(row?.wUnknown).toBeGreaterThan(0);
  });

  it('gives a null w when the ledger has spawns but none with a known W (Req 3.8)', async () => {
    const { project, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-g');
    writeTasks(specDir, 2);
    writeRetroPlan(specsDir, 'spec-g', 'Status: CLOSED — done');
    writeLedger(specDir, [
      { ts: '2026-01-01T00:00:00.000Z', type: 'spawn.start', agent: 'sdd-reviewer', phase: 'requirements' },
      { ts: '2026-01-01T00:00:01.000Z', type: 'spawn.end', agent: 'sdd-reviewer', tokens: '500' },
    ]);

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-g');
    expect(row?.w).toBeNull();
    expect(row?.wPerTask).toBeNull();
  });

  it('computes pctOfBaseline from the repository baseline integer (Req 3.9)', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-h');
    writeTasks(specDir, 4);
    writeRetroPlan(specsDir, 'spec-h', 'Status: CLOSED — done');
    writeLedger(specDir, knownSpawn('sdd-drafter', 'requirements', {
      input: '100', output: '10', cacheRead: '20', cacheWrite5m: '8', cacheWrite1h: '4',
    }));
    writeAgentRules(workflowRoot, 'baseline-w-per-task: 85');

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-h');
    expect(row?.baseline).toBe(85);
    expect(row?.wPerTask).toBe(170 / 4);
    expect(row?.pctOfBaseline).toBe((170 / 4) / 85 * 100);
  });

  it('gives a null baseline and a null pctOfBaseline when agent-rules.md has no baseline key (Req 3.9)', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-i');
    writeTasks(specDir, 4);
    writeRetroPlan(specsDir, 'spec-i', 'Status: CLOSED — done');
    writeLedger(specDir, knownSpawn('sdd-drafter', 'requirements', {
      input: '100', output: '10', cacheRead: '20', cacheWrite5m: '8', cacheWrite1h: '4',
    }));
    writeAgentRules(workflowRoot, null);

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-i');
    expect(row?.baseline).toBeNull();
    expect(row?.pctOfBaseline).toBeNull();
  });

  it('keeps a zero baseline but nulls pctOfBaseline, avoiding a divide by zero (design D9, Req 3.9)', async () => {
    const { project, workflowRoot, specsDir } = makeProject(base);
    const specDir = makeSpecDir(specsDir, 'spec-j');
    writeTasks(specDir, 4);
    writeRetroPlan(specsDir, 'spec-j', 'Status: CLOSED — done');
    writeLedger(specDir, knownSpawn('sdd-drafter', 'requirements', {
      input: '100', output: '10', cacheRead: '20', cacheWrite5m: '8', cacheWrite1h: '4',
    }));
    writeAgentRules(workflowRoot, 'baseline-w-per-task: 0');

    const rows = await buildUsageRows(project, new FileCache());
    const row = rows.find((r) => r.spec === 'spec-j');
    expect(row?.baseline).toBe(0);
    expect(row?.pctOfBaseline).toBeNull();
  });
});
