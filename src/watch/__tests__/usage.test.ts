import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildUsageReport, usageDelta, formatUsageTable, UsageReport } from '../usage.js';
import { LedgerEvent, parseJsonl } from '../ledger.js';

/** The committed new-shape ledger, shared with the index and harness-tool tests (D8). */
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '../../__tests__/fixtures/usage-ledger.jsonl');

let t = 0;
/** A monotonically increasing timestamp so rows keep their written order. */
function ts(): string {
  t += 1;
  return new Date(Date.UTC(2026, 8, 20, 10, 0, t)).toISOString();
}

function ev(type: string, extra: Record<string, string | undefined> = {}): LedgerEvent {
  return { ts: ts(), type, ...extra };
}

/** Find a phase's cell for one agent. */
function cell(r: UsageReport, phase: string, agent: string) {
  return r.phases.find(p => p.phase === phase)?.agents[agent];
}
function phase(r: UsageReport, name: string) {
  return r.phases.find(p => p.phase === name);
}

describe('buildUsageReport — runs', () => {
  it('counts distinct defined run values, not run.start rows', () => {
    const rows: LedgerEvent[] = [
      ev('run.start', { run: 'r1' }),
      ev('spawn.usage', { run: 'r1', agent: 'sdd-drafter', phase: 'requirements', tokens: '100' }),
      ev('spawn.usage', { run: 'r2', agent: 'sdd-drafter', phase: 'requirements', tokens: '200' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(r.runs).toBe(2);
  });
});

describe('buildUsageReport — spawn opening rules (Req 5.4)', () => {
  it('counts a start-less spawn.usage once and drops a start-less spawn.end', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.usage', { agent: 'sdd-reviewer', phase: 'requirements', tokens: '500' }),
      ev('spawn.end', { agent: 'sdd-checker', phase: 'requirements', tokens: '999' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-reviewer')).toEqual({ spawns: 1, tokens: 500, unknown: 0 });
    expect(cell(r, 'requirements', 'sdd-checker')).toBeUndefined();
    expect(r.total.spawns).toBe(1);
  });

  it('each start-less spawn.usage of one agent is its own spawn', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.usage', { agent: 'sdd-reviewer', phase: 'requirements', tokens: '100' }),
      ev('spawn.usage', { agent: 'sdd-reviewer', phase: 'requirements', tokens: '200' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-reviewer')).toEqual({ spawns: 2, tokens: 300, unknown: 0 });
  });

  it('every closing row up to the next spawn.start counts once', () => {
    // The analyst pattern: one spawn.start, two spawn.end, one spawn; later spawn.end wins.
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-retro-analyst', phase: 'retrospective' }),
      ev('spawn.end', { agent: 'sdd-retro-analyst', tokens: '30000' }),
      ev('spawn.end', { agent: 'sdd-retro-analyst', tokens: '45675' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'retrospective', 'sdd-retro-analyst')).toEqual({ spawns: 1, tokens: 45675, unknown: 0 });
  });
});

describe('buildUsageReport — token source rules', () => {
  it('spawn.end beats spawn.usage', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '84000' }),
      ev('spawn.usage', { agent: 'sdd-drafter', tokens: '1' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-drafter')?.tokens).toBe(84000);
  });

  it('a digit-less spawn.end leaves the tokens on spawn.usage', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-implementer', phase: 'implementation' }),
      ev('spawn.end', { agent: 'sdd-implementer' }),
      ev('spawn.usage', { agent: 'sdd-implementer', tokens: '604010' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'implementation', 'sdd-implementer')?.tokens).toBe(604010);
  });

  it('the later of two spawn.end wins', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '100' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '200' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-drafter')?.tokens).toBe(200);
  });
});

describe('buildUsageReport — unknown mark (D6)', () => {
  it('marks unknown only on a non-digit tokens value', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.usage', { agent: 'sdd-verifier', phase: 'implementation', tokens: 'na' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'implementation', 'sdd-verifier')).toEqual({ spawns: 1, tokens: 0, unknown: 1 });
  });

  it('does not mark a token-less spawn (no tokens key anywhere)', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-document-orchestrator' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-document-orchestrator')).toEqual({ spawns: 1, tokens: 0, unknown: 0 });
  });

  it('sums a 0 as a known zero, unmarked', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '0' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-drafter')).toEqual({ spawns: 1, tokens: 0, unknown: 0 });
  });
});

describe('buildUsageReport — phase resolution (Req 5.6)', () => {
  it('uses the phase key of the spawn', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'design' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '10' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(phase(r, 'design')).toBeDefined();
  });

  it('falls back to the live-phase window at the spawn start', () => {
    const rows: LedgerEvent[] = [
      ev('phase.start', { phase: 'implementation' }),
      ev('spawn.start', { agent: 'sdd-implementer' }),
      ev('spawn.end', { agent: 'sdd-implementer', tokens: '10' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'implementation', 'sdd-implementer')?.tokens).toBe(10);
    expect(phase(r, 'unknown')).toBeUndefined();
  });

  it('is unknown when no phase key and no open window', () => {
    const rows: LedgerEvent[] = [
      ev('phase.start', { phase: 'design' }),
      ev('phase.end', { phase: 'design' }),
      ev('spawn.start', { agent: 'sdd-drafter' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '10' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'unknown', 'sdd-drafter')?.tokens).toBe(10);
  });

  it('a spawn.usage phase overwrites the start phase key', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.usage', { agent: 'sdd-drafter', phase: 'design', tokens: '10' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'design', 'sdd-drafter')?.tokens).toBe(10);
    expect(phase(r, 'requirements')).toBeUndefined();
  });
});

describe('buildUsageReport — orchestrator share and order', () => {
  it('computes the orchestrator share and null at zero', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-document-orchestrator', tokens: '600' }),
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '400' }),
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'design' }),
      ev('spawn.end', { agent: 'sdd-drafter' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(phase(r, 'requirements')?.orchestratorShare).toBeCloseTo(0.6, 5);
    expect(phase(r, 'design')?.orchestratorShare).toBeNull();
  });

  it('orders phases PHASE_ORDER, then others sorted, then unknown last', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.usage', { agent: 'a', phase: 'unknown', tokens: '1' }),
      ev('spawn.usage', { agent: 'a', phase: 'zeta', tokens: '1' }),
      ev('spawn.usage', { agent: 'a', phase: 'implementation', tokens: '1' }),
      ev('spawn.usage', { agent: 'a', phase: 'requirements', tokens: '1' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(r.phases.map(p => p.phase)).toEqual(['requirements', 'implementation', 'zeta', 'unknown']);
  });
});

describe('usageDelta', () => {
  it('is b minus a per phase of the union', () => {
    const a = buildUsageReport([
      ev('spawn.usage', { agent: 'x', phase: 'requirements', tokens: '100' }),
    ], 'a');
    const b = buildUsageReport([
      ev('spawn.usage', { agent: 'x', phase: 'requirements', tokens: '250' }),
      ev('spawn.usage', { agent: 'x', phase: 'design', tokens: '40' }),
    ], 'b');
    const d = usageDelta(a, b);
    expect(d).toEqual([
      { phase: 'requirements', spawns: 0, tokens: 150 },
      { phase: 'design', spawns: 1, tokens: 40 },
    ]);
  });
});

describe('formatUsageTable — one spec', () => {
  it('prints the header, cells, totals, orchestrator share and unknown marks', () => {
    const rows: LedgerEvent[] = [
      ev('run.start', { run: 'r1' }),
      ev('spawn.start', { run: 'r1', agent: 'sdd-document-orchestrator', phase: 'requirements' }),
      ev('spawn.end', { run: 'r1', agent: 'sdd-document-orchestrator', tokens: '600000', input: '100', output: '200', cacheWrite: '300', cacheRead: '0' }),
      ev('spawn.start', { run: 'r1', agent: 'sdd-reviewer', phase: 'requirements' }),
      ev('spawn.end', { run: 'r1', agent: 'sdd-reviewer', tokens: 'unknown' }),
    ];
    const r = buildUsageReport(rows, 'demo');
    const text = formatUsageTable(r);
    expect(text).toContain('usage demo  runs 1  spawns 2  tokens 600,000');
    expect(text).toContain('phase | agent | spawns | tokens');
    expect(text).toContain('requirements | sdd-reviewer | 1 | 0 (+1 unknown)');
    expect(text).toContain('requirements | sdd-document-orchestrator | 1 | 600,000');
    expect(text).toContain('orch 100.0%');
    expect(text).toContain('in 100 out 200 cw 300 cr 0');
    expect(text).toContain('total |  | 2 | 600,000 (+1 unknown)');
  });
});

describe('formatUsageTable — two specs', () => {
  it('merges columns and prints the delta on total rows', () => {
    const a = buildUsageReport([
      ev('spawn.usage', { agent: 'sdd-drafter', phase: 'requirements', tokens: '100' }),
    ], 'left');
    const b = buildUsageReport([
      ev('spawn.usage', { agent: 'sdd-drafter', phase: 'requirements', tokens: '250' }),
      ev('spawn.usage', { agent: 'sdd-reviser', phase: 'design', tokens: '40' }),
    ], 'right');
    const text = formatUsageTable(a, b);
    expect(text).toContain('usage left  runs 0  spawns 1  tokens 100');
    expect(text).toContain('usage right  runs 0  spawns 2  tokens 290');
    expect(text).toContain('phase | agent | spawns | tokens | spawns | tokens');
    // design exists only on the right: left cell is a dash pair.
    expect(text).toContain('design | sdd-reviser | - | - | 1 | 40');
    expect(text).toContain('requirements | total | 1 | 100 | 1 | 250  delta spawns 0 tokens 150');
    expect(text).toContain('total |  | 1 | 100 | 2 | 290  delta spawns 1 tokens 190');
  });
});

describe('buildUsageReport — empty', () => {
  it('gives a zero report for no rows', () => {
    const r = buildUsageReport([], 'empty');
    expect(r).toEqual({ spec: 'empty', runs: 0, phases: [], total: { spawns: 0, tokens: 0, unknown: 0 }, kinds: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 } });
  });
});

describe('buildUsageReport — committed fixture (D8, Req 5.8)', () => {
  it('folds the two-run fixture to its pinned totals and share', () => {
    const rows = parseJsonl<LedgerEvent>(readFileSync(FIXTURE, 'utf8'));
    const r = buildUsageReport(rows, 'usage-fixture');
    expect(r.runs).toBe(2);
    expect(r.total.spawns).toBe(5);
    expect(r.total.tokens).toBe(4_554_189);
    expect(r.phases.length).toBe(1);
    expect(r.total.unknown).toBe(1);
    // The one unknown mark is the reviewer, whose spawn.end carried tokens=unknown.
    expect(cell(r, 'requirements', 'sdd-reviewer')?.unknown).toBe(1);
    expect(formatUsageTable(r)).toContain('orch 60.2%');
  });
});
