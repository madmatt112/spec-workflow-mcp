import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildUsageReport, usageDelta, formatUsageTable, isGraphCall, applyGraphCounts, spawnW, listSpawns, unitCount, UsageReport, UsageCell } from '../usage.js';
import { LedgerEvent, ActivityEvent, parseJsonl } from '../ledger.js';

/**
 * A full UsageCell from a partial; the cache fields and graph default to 0 (design C5).
 * No fixture in this file sets a spawn's full five W fields, so every spawn here is
 * W-unknown: wUnknown defaults to the cell's spawn count, w to 0 (design C1).
 */
function ce(p: Partial<UsageCell> & Pick<UsageCell, 'spawns' | 'tokens' | 'unknown'>): UsageCell {
  return { w: 0, wUnknown: p.spawns, cacheWrite5m: 0, cacheWrite1h: 0, gapRewrites: 0, cacheUnknownWrite: 0, cacheUnknownGap: 0, graph: 0, ...p };
}

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
    expect(cell(r, 'requirements', 'sdd-reviewer')).toEqual(ce({ spawns: 1, tokens: 500, unknown: 0, cacheUnknownWrite: 1 }));
    expect(cell(r, 'requirements', 'sdd-checker')).toBeUndefined();
    expect(r.total.spawns).toBe(1);
  });

  it('each start-less spawn.usage of one agent is its own spawn', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.usage', { agent: 'sdd-reviewer', phase: 'requirements', tokens: '100' }),
      ev('spawn.usage', { agent: 'sdd-reviewer', phase: 'requirements', tokens: '200' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-reviewer')).toEqual(ce({ spawns: 2, tokens: 300, unknown: 0, cacheUnknownWrite: 2 }));
  });

  it('every closing row up to the next spawn.start counts once', () => {
    // The analyst pattern: one spawn.start, two spawn.end, one spawn; later spawn.end wins.
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-retro-analyst', phase: 'retrospective' }),
      ev('spawn.end', { agent: 'sdd-retro-analyst', tokens: '30000' }),
      ev('spawn.end', { agent: 'sdd-retro-analyst', tokens: '45675' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'retrospective', 'sdd-retro-analyst')).toEqual(ce({ spawns: 1, tokens: 45675, unknown: 0, cacheUnknownWrite: 1 }));
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

  it('a yielding orchestrator counts once, at its latest spawn.end, even after a later start of the same agent', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', { agent: 'sdd-document-orchestrator', agentId: 'o1', tokens: '100' }),
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', { agent: 'sdd-document-orchestrator', agentId: 'o1', tokens: '250' }),
      ev('spawn.end', { agent: 'sdd-document-orchestrator', agentId: 'o2', tokens: '40' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'design', 'sdd-document-orchestrator')).toMatchObject({ spawns: 2, tokens: 290 });
  });
});

describe('buildUsageReport — unknown mark (D6)', () => {
  it('marks unknown only on a non-digit tokens value', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.usage', { agent: 'sdd-verifier', phase: 'implementation', tokens: 'na' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'implementation', 'sdd-verifier')).toEqual(ce({ spawns: 1, tokens: 0, unknown: 1, cacheUnknownWrite: 1 }));
  });

  it('does not mark a token-less spawn (no tokens key anywhere)', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-document-orchestrator' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-document-orchestrator')).toEqual(ce({ spawns: 1, tokens: 0, unknown: 0, cacheUnknownWrite: 1 }));
  });

  it('sums a 0 as a known zero, unmarked', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '0' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-drafter')).toEqual(ce({ spawns: 1, tokens: 0, unknown: 0, cacheUnknownWrite: 1 }));
  });
});

describe('buildUsageReport — provider fold (Req 5.1, 5.2)', () => {
  it('takes the provider from the spawn.end row', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements', provider: 'anthropic' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '100', provider: 'deepseek' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-reviewer@deepseek')?.tokens).toBe(100);
    expect(phase(r, 'requirements')?.providers.deepseek.tokens).toBe(100);
  });

  it('falls back to the spawn.start provider when the end carries none', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements', provider: 'deepseek' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '100' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-reviewer@deepseek')?.tokens).toBe(100);
  });

  it('defaults to anthropic when no row carries a provider', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '100' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-reviewer')?.tokens).toBe(100);
    expect(phase(r, 'requirements')?.providers.anthropic.tokens).toBe(100);
    expect(phase(r, 'requirements')?.providers.deepseek).toEqual(ce({ spawns: 0, tokens: 0, unknown: 0 }));
  });

  it('keys a deepseek spawn @deepseek and leaves the anthropic key for the same agent', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '100' }),
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements', provider: 'deepseek' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '250', provider: 'deepseek' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-reviewer')).toEqual(ce({ spawns: 1, tokens: 100, unknown: 0, cacheUnknownWrite: 1 }));
    expect(cell(r, 'requirements', 'sdd-reviewer@deepseek')).toEqual(ce({ spawns: 1, tokens: 250, unknown: 0 }));
    const p = phase(r, 'requirements');
    expect(p?.providers.anthropic).toEqual(ce({ spawns: 1, tokens: 100, unknown: 0, cacheUnknownWrite: 1 }));
    expect(p?.providers.deepseek).toEqual(ce({ spawns: 1, tokens: 250, unknown: 0 }));
    expect(r.providers.anthropic.tokens).toBe(100);
    expect(r.providers.deepseek.tokens).toBe(250);
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
    expect(d).toMatchObject([
      { phase: 'requirements', spawns: 0, tokens: 150, w: 0 },
      { phase: 'design', spawns: 1, tokens: 40, w: 0 },
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

  it('appends the provider pair to phase and spec total lines', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '1000' }),
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements', provider: 'deepseek' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '250', provider: 'deepseek' }),
    ];
    const text = formatUsageTable(buildUsageReport(rows, 'demo'));
    expect(text).toContain('requirements | sdd-reviewer@deepseek | 1 | 250');
    expect(text).toContain('anthropic 1,000  deepseek 250');
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
    expect(text).toContain('phase | agent | spawns | tokens | W | cw5m | cw1h | gapRewrites | graph | spawns | tokens | W | cw5m | cw1h | gapRewrites | graph');
    // design exists only on the right: the left side is seven dashes (W added).
    expect(text).toContain('design | sdd-reviser | - | - | - | - | - | - | - | 1 | 40 | 0 (+1 unknown) | unknown | unknown | unknown | 0');
    expect(text).toContain('requirements | total | 1 | 100 | 0 (+1 unknown) | unknown | unknown | unknown | 0 | 1 | 250 | 0 (+1 unknown) | unknown | unknown | unknown | 0  delta spawns 0 tokens 150');
    expect(text).toContain('total |  | 1 | 100 | 0 (+1 unknown) | unknown | unknown | unknown | 0 | 2 | 290 | 0 (+2 unknown) | unknown | unknown | unknown | 0  delta spawns 1 tokens 190');
  });

  it('appends the provider pair after the delta on compare total lines', () => {
    const a = buildUsageReport([
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '100' }),
    ], 'left');
    const b = buildUsageReport([
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '250' }),
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements', provider: 'deepseek' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '40', provider: 'deepseek' }),
    ], 'right');
    const text = formatUsageTable(a, b);
    expect(text).toContain('requirements | total | 1 | 100 | 0 (+1 unknown) | unknown | unknown | unknown | 0 | 2 | 290 | 0 (+2 unknown) | unknown | unknown | unknown | 0  delta spawns 1 tokens 190  anthropic 100 | 250  deepseek 0 | 40');
    expect(text).toContain('total |  | 1 | 100 | 0 (+1 unknown) | unknown | unknown | unknown | 0 | 2 | 290 | 0 (+2 unknown) | unknown | unknown | unknown | 0  delta spawns 1 tokens 190  anthropic 100 | 250  deepseek 0 | 40');
  });
});

describe('buildUsageReport — cache numbers (Req 4)', () => {
  it('takes the three cache values from the digit spawn.end row', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '1000', cacheWrite5m: '10', cacheWrite1h: '20', gapRewrites: '2' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-drafter')).toEqual(ce({ spawns: 1, tokens: 1000, unknown: 0, cacheWrite5m: 10, cacheWrite1h: 20, gapRewrites: 2 }));
  });

  it('marks the write unknown when a write field is not a digit (sums stay 0)', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '1000', cacheWrite5m: 'unknown', cacheWrite1h: '20', gapRewrites: '2' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-drafter')).toEqual(ce({ spawns: 1, tokens: 1000, unknown: 0, cacheUnknownWrite: 1 }));
  });

  it('keeps the write sums and marks the gap unknown when only gapRewrites is not a digit', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '1000', cacheWrite5m: '10', cacheWrite1h: '20', gapRewrites: 'unknown' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-drafter')).toEqual(ce({ spawns: 1, tokens: 1000, unknown: 0, cacheWrite5m: 10, cacheWrite1h: 20, gapRewrites: 0, cacheUnknownGap: 1 }));
  });

  it('marks a spawn.usage-only spawn write-unknown (Req 4.3)', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.usage', { agent: 'sdd-drafter', phase: 'requirements', tokens: '1000' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-drafter')).toEqual(ce({ spawns: 1, tokens: 1000, unknown: 0, cacheUnknownWrite: 1 }));
  });

  it('adds nothing from a deepseek spawn and keeps the anthropic cache in a mixed phase', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '1000', cacheWrite5m: '10', cacheWrite1h: '20', gapRewrites: '1' }),
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements', provider: 'deepseek' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '250', provider: 'deepseek', cacheWrite5m: '99', cacheWrite1h: '99', gapRewrites: '9' }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(cell(r, 'requirements', 'sdd-reviewer')).toEqual(ce({ spawns: 1, tokens: 1000, unknown: 0, cacheWrite5m: 10, cacheWrite1h: 20, gapRewrites: 1 }));
    expect(cell(r, 'requirements', 'sdd-reviewer@deepseek')).toEqual(ce({ spawns: 1, tokens: 250, unknown: 0 }));
    const p = phase(r, 'requirements');
    expect(p?.providers.anthropic).toEqual(ce({ spawns: 1, tokens: 1000, unknown: 0, cacheWrite5m: 10, cacheWrite1h: 20, gapRewrites: 1 }));
    expect(p?.total).toEqual(ce({ spawns: 2, tokens: 1250, unknown: 0, cacheWrite5m: 10, cacheWrite1h: 20, gapRewrites: 1 }));
  });
});

describe('formatUsageTable — cache columns (Req 4)', () => {
  it('heads three cache columns and prints the digit sums on an anthropic line', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '1000', cacheWrite5m: '10', cacheWrite1h: '20', gapRewrites: '2' }),
    ];
    const text = formatUsageTable(buildUsageReport(rows, 'demo'));
    expect(text).toContain('phase | agent | spawns | tokens | W | cw5m | cw1h | gapRewrites');
    expect(text).toContain('requirements | sdd-drafter | 1 | 1,000 | 0 (+1 unknown) | 10 | 20 | 2');
  });

  it('prints three dashes for a deepseek line and an all-deepseek total', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements', provider: 'deepseek' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '250', provider: 'deepseek', cacheWrite5m: '5', cacheWrite1h: '5', gapRewrites: '0' }),
    ];
    const text = formatUsageTable(buildUsageReport(rows, 'demo'));
    expect(text).toContain('requirements | sdd-reviewer@deepseek | 1 | 250 | 0 (+1 unknown) | - | - | -');
    expect(text).toContain('requirements | total | 1 | 250 | 0 (+1 unknown) | - | - | -');
    expect(text).toContain('total |  | 1 | 250 | 0 (+1 unknown) | - | - | -');
  });

  it('ends the gap column with (+N unknown) when some spawns are gap-unknown', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '100', cacheWrite5m: '10', cacheWrite1h: '20', gapRewrites: '3' }),
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '200', cacheWrite5m: '5', cacheWrite1h: '5', gapRewrites: 'unknown' }),
    ];
    const text = formatUsageTable(buildUsageReport(rows, 'demo'));
    expect(text).toContain('requirements | sdd-reviewer | 1 | 200 | 0 (+1 unknown) | 5 | 5 | unknown');
    expect(text).toContain('requirements | total | 2 | 300 | 0 (+2 unknown) | 15 | 25 | 3 (+1 unknown)');
  });

  it('prints unknown in every cache column and unchanged tokens for a ledger with no keys (Req 4.8)', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '1000' }),
      ev('spawn.start', { agent: 'sdd-reviewer', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-reviewer', tokens: '500' }),
    ];
    const text = formatUsageTable(buildUsageReport(rows, 'demo'));
    expect(text).toContain('requirements | sdd-drafter | 1 | 1,000 | 0 (+1 unknown) | unknown | unknown | unknown');
    expect(text).toContain('requirements | sdd-reviewer | 1 | 500 | 0 (+1 unknown) | unknown | unknown | unknown');
    expect(text).toContain('requirements | total | 2 | 1,500 | 0 (+2 unknown) | unknown | unknown | unknown');
    expect(text).toContain('total |  | 2 | 1,500 | 0 (+2 unknown) | unknown | unknown | unknown');
  });

  it('compares a ledger with the keys against one without (Req 4.7, 4.9)', () => {
    const a = buildUsageReport([
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '1000', cacheWrite5m: '10', cacheWrite1h: '20', gapRewrites: '2' }),
    ], 'withkeys');
    const b = buildUsageReport([
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '1000' }),
    ], 'nokeys');
    const text = formatUsageTable(a, b);
    expect(text).toContain('requirements | sdd-drafter | 1 | 1,000 | 0 (+1 unknown) | 10 | 20 | 2 | 0 | 1 | 1,000 | 0 (+1 unknown) | unknown | unknown | unknown | 0');
  });
});

describe('buildUsageReport — empty', () => {
  it('gives a zero report for no rows', () => {
    const r = buildUsageReport([], 'empty');
    expect(r).toEqual({ spec: 'empty', runs: 0, phases: [], total: ce({ spawns: 0, tokens: 0, unknown: 0 }), kinds: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }, providers: { anthropic: ce({ spawns: 0, tokens: 0, unknown: 0 }), deepseek: ce({ spawns: 0, tokens: 0, unknown: 0 }) } });
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
    // No provider key in the fixture: deepseek is empty, anthropic holds every token.
    expect(r.providers.deepseek.spawns).toBe(0);
    expect(r.providers.anthropic.tokens).toBe(r.total.tokens);
  });
});

/** A tool activity row with the given summary, defaulting to a Bash tool. */
function tool(agent: string, summary: string, extra: Partial<ActivityEvent> = {}): ActivityEvent {
  return { ts: ts(), agent, event: 'tool', tool: 'Bash', summary, ...extra };
}

describe('isGraphCall (Req 6.2, D8)', () => {
  it('matches explain/query/path at a command boundary', () => {
    expect(isGraphCall(tool('sdd-implementer', 'graphify explain "x" --graph p'))).toBe(true);
    expect(isGraphCall(tool('sdd-implementer', 'cd a && graphify query t'))).toBe(true);
    expect(isGraphCall(tool('sdd-implementer', 'graphify path "A" "B"'))).toBe(true);
  });

  it('rejects update, a grep of the phrase, and a non-Bash row', () => {
    expect(isGraphCall(tool('sdd-implementer', 'graphify update .'))).toBe(false);
    expect(isGraphCall(tool('sdd-implementer', 'grep -n "graphify explain" f'))).toBe(false);
    expect(isGraphCall(tool('sdd-implementer', 'graphify explain x', { tool: 'Read' }))).toBe(false);
  });
});

describe('applyGraphCounts (Req 6.3-6.5, D9)', () => {
  it('adds each graph call to the windowed phase, agent, totals and the anthropic provider', () => {
    const events: LedgerEvent[] = [
      ev('phase.start', { phase: 'implementation' }),
      ev('spawn.start', { agent: 'sdd-implementer', phase: 'implementation' }),
      ev('spawn.end', { agent: 'sdd-implementer', tokens: '1000' }),
    ];
    const report = buildUsageReport(events, 's');
    const activity: ActivityEvent[] = [
      tool('sdd-implementer', 'graphify explain "x"'),
      tool('sdd-implementer', 'graphify query t'),
      tool('sdd-implementer', 'graphify update .'),
    ];
    expect(applyGraphCounts(report, events, activity)).toBe(report);
    expect(cell(report, 'implementation', 'sdd-implementer')?.graph).toBe(2);
    expect(phase(report, 'implementation')?.total.graph).toBe(2);
    expect(phase(report, 'implementation')?.providers.anthropic.graph).toBe(2);
    expect(report.total.graph).toBe(2);
    expect(report.providers.anthropic.graph).toBe(2);
  });

  it('sends a call outside every window to unknown, with a 0-spawn agent cell', () => {
    const events: LedgerEvent[] = [
      ev('phase.start', { phase: 'design' }),
      ev('phase.end', { phase: 'design' }),
    ];
    const report = buildUsageReport(events, 's');
    applyGraphCounts(report, events, [tool('sdd-reviewer', 'graphify path "A" "B"')]);
    const c = cell(report, 'unknown', 'sdd-reviewer');
    expect(c?.graph).toBe(1);
    expect(c?.spawns).toBe(0);
    expect(report.total.graph).toBe(1);
  });

  it('prints a phase and agent present only through graph rows with 0 spawns and dash cache', () => {
    const events: LedgerEvent[] = [ev('phase.start', { phase: 'implementation' })];
    const report = buildUsageReport(events, 'demo');
    applyGraphCounts(report, events, [tool('sdd-implementer', 'graphify explain "x"')]);
    const text = formatUsageTable(report);
    expect(text).toContain('phase | agent | spawns | tokens | W | cw5m | cw1h | gapRewrites | graph');
    expect(text).toContain('implementation | sdd-implementer | 0 | 0 | 0 | - | - | - | 1');
    expect(text).toContain('implementation | total | 0 | 0 | 0 | - | - | - | 1');
    expect(text).toContain('total |  | 0 | 0 | 0 | - | - | - | 1');
  });
});

describe('spawnW (design C1, Req 1.1)', () => {
  it('computes input + 1.25*cw5m + 2*cw1h + 0.1*cacheRead + 5*output from a spawn.end row', () => {
    const row = ev('spawn.end', {
      agent: 'sdd-document-orchestrator',
      input: '100',
      output: '10',
      cacheRead: '20',
      cacheWrite5m: '8',
      cacheWrite1h: '4',
    });
    expect(spawnW(row)).toBe(170);
  });

  it('is undefined when cacheWrite5m is not a digit string', () => {
    const row = ev('spawn.end', {
      input: '100',
      output: '10',
      cacheRead: '20',
      cacheWrite5m: 'unknown',
      cacheWrite1h: '4',
    });
    expect(spawnW(row)).toBeUndefined();
  });
});

describe('buildUsageReport — W per cell (Req 1.1)', () => {
  it('sets cell.w from the spawn.end row that sets tokens, unmarked', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', {
        agent: 'sdd-document-orchestrator',
        tokens: '9999',
        input: '100',
        output: '10',
        cacheRead: '20',
        cacheWrite5m: '8',
        cacheWrite1h: '4',
      }),
    ];
    const r = buildUsageReport(rows, 's');
    const c = cell(r, 'design', 'sdd-document-orchestrator');
    expect(c?.w).toBe(170);
    expect(c?.wUnknown).toBe(0);
  });

  it('marks wUnknown when W is undefined though tokens are a known digit', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '500', input: '10', output: '1' }),
    ];
    const r = buildUsageReport(rows, 's');
    const c = cell(r, 'requirements', 'sdd-drafter');
    expect(c?.w).toBe(0);
    expect(c?.wUnknown).toBe(1);
  });

  it('marks wUnknown when tokens come only from spawn.usage', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.usage', { agent: 'sdd-reviewer', phase: 'requirements', tokens: '1000' }),
    ];
    const r = buildUsageReport(rows, 's');
    const c = cell(r, 'requirements', 'sdd-reviewer');
    expect(c?.w).toBe(0);
    expect(c?.wUnknown).toBe(1);
  });
});

describe('formatUsageTable — W column (Req 1.1)', () => {
  it('prints the W column after tokens, with the unknown mark like the token cell', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', {
        agent: 'sdd-document-orchestrator',
        tokens: '9999',
        input: '100',
        output: '10',
        cacheRead: '20',
        cacheWrite5m: '8',
        cacheWrite1h: '4',
      }),
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'design' }),
      ev('spawn.end', { agent: 'sdd-drafter', tokens: '500' }),
    ];
    const text = formatUsageTable(buildUsageReport(rows, 'demo'));
    expect(text).toContain('phase | agent | spawns | tokens | W |');
    expect(text).toContain('design | sdd-document-orchestrator | 1 | 9,999 | 170 |');
    expect(text).toContain('design | sdd-drafter | 1 | 500 | 0 (+1 unknown) |');
  });
});

describe('unitCount (design C1)', () => {
  it('counts round rows whose phase key matches, for a document phase', () => {
    const rows: LedgerEvent[] = [
      ev('round', { phase: 'requirements', round: '1', verdict: 'approve' }),
      ev('round', { phase: 'requirements', round: '2', verdict: 'approve' }),
      ev('round', { phase: 'design', round: '1', verdict: 'approve' }),
    ];
    expect(unitCount(rows, 'requirements')).toBe(2);
  });

  it('counts task.done rows inside the implementation window', () => {
    const rows: LedgerEvent[] = [
      ev('phase.start', { phase: 'implementation' }),
      ev('task.done', { task: '1', outcome: 'done' }),
      ev('task.done', { task: '2', outcome: 'done' }),
      ev('phase.end', { phase: 'implementation' }),
      ev('task.done', { task: '3', outcome: 'done' }),
    ];
    expect(unitCount(rows, 'implementation')).toBe(2);
  });
});

describe('buildUsageReport — orchW, units, orchWPerUnit (Req 1.8)', () => {
  it('sums the orchestrator cells W into orchW and divides by units', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', {
        agent: 'sdd-document-orchestrator',
        tokens: '600',
        input: '100',
        output: '20',
        cacheRead: '0',
        cacheWrite5m: '0',
        cacheWrite1h: '0',
      }),
      ev('round', { phase: 'design', round: '1', verdict: 'approve' }),
      ev('round', { phase: 'design', round: '2', verdict: 'approve' }),
    ];
    const r = buildUsageReport(rows, 's');
    const ph = phase(r, 'design');
    expect(ph?.units).toBe(2);
    expect(ph?.orchW).toBe(200);
    expect(ph?.orchWPerUnit).toBe(100);
  });

  it('is null when units is 0', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', {
        agent: 'sdd-document-orchestrator',
        tokens: '600',
        input: '100',
        output: '20',
        cacheRead: '0',
        cacheWrite5m: '0',
        cacheWrite1h: '0',
      }),
    ];
    const r = buildUsageReport(rows, 's');
    expect(phase(r, 'design')?.orchWPerUnit).toBeNull();
  });
});

describe('usageDelta — w and orchWPerUnit (Req 1.8)', () => {
  it('is b minus a for w and orchWPerUnit per phase', () => {
    const a = buildUsageReport([
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', {
        agent: 'sdd-document-orchestrator',
        tokens: '600',
        input: '100',
        output: '20',
        cacheRead: '0',
        cacheWrite5m: '0',
        cacheWrite1h: '0',
      }),
      ev('round', { phase: 'design', round: '1', verdict: 'approve' }),
      ev('round', { phase: 'design', round: '2', verdict: 'approve' }),
    ], 'a');
    const b = buildUsageReport([
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', {
        agent: 'sdd-document-orchestrator',
        tokens: '900',
        input: '100',
        output: '160',
        cacheRead: '0',
        cacheWrite5m: '0',
        cacheWrite1h: '0',
      }),
      ev('round', { phase: 'design', round: '1', verdict: 'approve' }),
      ev('round', { phase: 'design', round: '2', verdict: 'approve' }),
      ev('round', { phase: 'design', round: '3', verdict: 'approve' }),
    ], 'b');
    const d = usageDelta(a, b);
    const designDelta = d.find(x => x.phase === 'design');
    expect(designDelta?.w).toBe(700);
    expect(designDelta?.orchWPerUnit).toBe(200);
  });
});

describe('formatUsageTable — per-unit option (Req 1.8)', () => {
  it('adds orch W/round or orch W/task to each phase total when perUnit is set', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', {
        agent: 'sdd-document-orchestrator',
        tokens: '600',
        input: '100',
        output: '20',
        cacheRead: '0',
        cacheWrite5m: '0',
        cacheWrite1h: '0',
      }),
      ev('round', { phase: 'design', round: '1', verdict: 'approve' }),
      ev('round', { phase: 'design', round: '2', verdict: 'approve' }),
      ev('phase.start', { phase: 'implementation' }),
      ev('spawn.start', { agent: 'sdd-implementation-orchestrator', phase: 'implementation' }),
      ev('spawn.end', {
        agent: 'sdd-implementation-orchestrator',
        tokens: '1200',
        input: '100',
        output: '100',
        cacheRead: '0',
        cacheWrite5m: '0',
        cacheWrite1h: '0',
      }),
      ev('task.done', { task: '1', outcome: 'done' }),
      ev('task.done', { task: '2', outcome: 'done' }),
      ev('phase.end', { phase: 'implementation' }),
    ];
    const text = formatUsageTable(buildUsageReport(rows, 'demo'), undefined, { perUnit: true });
    expect(text).toContain('orch W/round 100');
    expect(text).toContain('orch W/task 300');
  });

  it('prints both specs per-unit W and the delta when compare is given', () => {
    const a = buildUsageReport([
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', {
        agent: 'sdd-document-orchestrator',
        tokens: '600',
        input: '100',
        output: '20',
        cacheRead: '0',
        cacheWrite5m: '0',
        cacheWrite1h: '0',
      }),
      ev('round', { phase: 'design', round: '1', verdict: 'approve' }),
      ev('round', { phase: 'design', round: '2', verdict: 'approve' }),
    ], 'a');
    const b = buildUsageReport([
      ev('spawn.start', { agent: 'sdd-document-orchestrator', phase: 'design' }),
      ev('spawn.end', {
        agent: 'sdd-document-orchestrator',
        tokens: '900',
        input: '100',
        output: '160',
        cacheRead: '0',
        cacheWrite5m: '0',
        cacheWrite1h: '0',
      }),
      ev('round', { phase: 'design', round: '1', verdict: 'approve' }),
      ev('round', { phase: 'design', round: '2', verdict: 'approve' }),
      ev('round', { phase: 'design', round: '3', verdict: 'approve' }),
    ], 'b');
    const text = formatUsageTable(a, b, { perUnit: true });
    expect(text).toContain('orch W/round 100 | 300  delta 200');
  });
});

describe('listSpawns (design C1)', () => {
  it('lists each reduced spawn with phase, agent, the latest spawn.end agentId, and W from the tokens-setting row', () => {
    const rows: LedgerEvent[] = [
      ev('spawn.start', { agent: 'sdd-drafter', phase: 'requirements' }),
      ev('spawn.end', {
        agent: 'sdd-drafter',
        agentId: 'a1',
        tokens: '500',
        input: '10',
        output: '1',
        cacheRead: '0',
        cacheWrite5m: '0',
        cacheWrite1h: '0',
      }),
      ev('spawn.end', { agent: 'sdd-drafter', agentId: 'a2', tokens: 'unknown' }),
    ];
    const spawns = listSpawns(rows);
    expect(spawns).toHaveLength(1);
    expect(spawns[0]).toMatchObject({ phase: 'requirements', agent: 'sdd-drafter', agentId: 'a2', w: 15 });
  });
});
