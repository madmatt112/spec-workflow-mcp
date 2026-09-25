/**
 * Usage fold for `harness usage` (design Component 5).
 *
 * The Req 5.4-5.6 algorithm over *every* run of a ledger, as pure functions spec 9 can
 * call without the tool. No file reads and no `buildModel` call live here: it restates
 * `buildModel`'s fold behaviours (the `spawn.usage` token fallback and the start-less
 * synthesis, `src/watch/ledger.ts` folds) as its own rules, but not its last-run scope or
 * its first-closing-row pairing.
 */

import { LedgerEvent, PHASE_ORDER, ActivityEvent } from './ledger.js';

export interface UsageCell {
  spawns: number;
  tokens: number;
  unknown: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  gapRewrites: number;
  cacheUnknownWrite: number;
  cacheUnknownGap: number;
  graph: number;
}
export interface UsageKinds { input: number; output: number; cacheWrite: number; cacheRead: number }
export interface UsageByProvider { anthropic: UsageCell; deepseek: UsageCell }
export interface UsagePhase {
  phase: string;
  agents: Record<string, UsageCell>;
  total: UsageCell;
  kinds: UsageKinds;
  orchestratorShare: number | null;
  providers: UsageByProvider;
}
export interface UsageReport { spec: string; runs: number; phases: UsagePhase[]; total: UsageCell; kinds: UsageKinds; providers: UsageByProvider }
export interface UsageDelta { phase: string; spawns: number; tokens: number }

/** Milliseconds of an ISO timestamp; 0 when absent or unparseable (as `buildModel`). */
function ms(ts: string | undefined): number {
  const n = ts ? new Date(ts).getTime() : NaN;
  return Number.isNaN(n) ? 0 : n;
}

const DIGITS = /^\d+$/;

function digitOr0(v: string | undefined): number {
  return v !== undefined && DIGITS.test(v) ? Number(v) : 0;
}

/** An open spawn: the `spawn.start` (or a start-less `spawn.usage`) and its closing rows. */
interface Spawn {
  agent: string;
  startedAt: string;
  phaseKey?: string;
  provider?: string;
  rows: LedgerEvent[];
}

interface SpawnCache {
  w5m: number;
  w1h: number;
  gap: number;
  unknownWrite: 0 | 1;
  unknownGap: 0 | 1;
}

interface ReducedSpawn {
  phase: string;
  agent: string;
  provider: string;
  tokens: number | undefined;
  unknown: boolean;
  kinds: UsageKinds;
  cache: SpawnCache;
}

function emptyCell(): UsageCell {
  return { spawns: 0, tokens: 0, unknown: 0, cacheWrite5m: 0, cacheWrite1h: 0, gapRewrites: 0, cacheUnknownWrite: 0, cacheUnknownGap: 0, graph: 0 };
}

function emptyProviders(): UsageByProvider {
  return { anthropic: emptyCell(), deepseek: emptyCell() };
}

function addCell(dst: UsageCell, src: UsageCell): void {
  dst.spawns += src.spawns;
  dst.tokens += src.tokens;
  dst.unknown += src.unknown;
  dst.cacheWrite5m += src.cacheWrite5m;
  dst.cacheWrite1h += src.cacheWrite1h;
  dst.gapRewrites += src.gapRewrites;
  dst.cacheUnknownWrite += src.cacheUnknownWrite;
  dst.cacheUnknownGap += src.cacheUnknownGap;
  dst.graph += src.graph;
}

function emptyKinds(): UsageKinds {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
}

/** Phase ordering: `PHASE_ORDER` first, then other labels sorted, `unknown` last. */
function phaseRank(p: string): number {
  const i = PHASE_ORDER.indexOf(p);
  if (i >= 0) return i;
  if (p === 'unknown') return PHASE_ORDER.length + 1;
  return PHASE_ORDER.length;
}

function cmpPhase(a: string, b: string): number {
  const ra = phaseRank(a);
  const rb = phaseRank(b);
  if (ra !== rb) return ra - rb;
  return a.localeCompare(b);
}

/** The live-phase window at time `at`: the latest phase.start at or before `at` not yet closed. */
function windowPhase(at: number, phaseStarts: LedgerEvent[], phaseEnds: LedgerEvent[]): string | undefined {
  for (let i = phaseStarts.length - 1; i >= 0; i--) {
    const ps = phaseStarts[i];
    if (ms(ps.ts) > at) continue;
    const closed = phaseEnds.some(pe => pe.phase === ps.phase && ms(pe.ts) >= ms(ps.ts) && ms(pe.ts) <= at);
    if (!closed) return ps.phase;
  }
  return undefined;
}

export function buildUsageReport(events: LedgerEvent[], spec: string): UsageReport {
  // (a) Stable sort by ts; runs = distinct defined run values.
  const sorted = [...events].sort((a, b) => ms(a.ts) - ms(b.ts));
  const runIds = new Set<string>();
  for (const e of sorted) if (e.run !== undefined) runIds.add(e.run);

  // (b) Walk the rows, keeping one open spawn per agent. A spawn.start opens (and replaces)
  // the agent's current spawn; a spawn.end or spawn.usage attaches to it. With none open a
  // spawn.usage becomes its own spawn (not entered as current) and a spawn.end is dropped.
  // A later spawn.end with an agentId already seen belongs to that same spawn (the hook
  // writes one per SubagentStop of a yielding orchestrator), whatever started since.
  const spawns: Spawn[] = [];
  const current = new Map<string, Spawn>();
  const byAgentId = new Map<string, Spawn>();
  for (const e of sorted) {
    const agent = e.agent ?? 'unknown';
    if (e.type === 'spawn.start') {
      const s: Spawn = { agent, startedAt: e.ts, phaseKey: e.phase, provider: e.provider, rows: [] };
      spawns.push(s);
      current.set(agent, s);
    } else if (e.type === 'spawn.end' || e.type === 'spawn.usage') {
      const open = (e.type === 'spawn.end' && e.agentId !== undefined && byAgentId.get(e.agentId)) || current.get(agent);
      if (open && e.type === 'spawn.end' && e.agentId !== undefined) byAgentId.set(e.agentId, open);
      if (open) {
        open.rows.push(e);
      } else if (e.type === 'spawn.usage') {
        spawns.push({ agent, startedAt: e.ts, phaseKey: e.phase, rows: [e] });
      }
    }
  }

  const phaseStarts = sorted.filter(e => e.type === 'phase.start');
  const phaseEnds = sorted.filter(e => e.type === 'phase.end');

  // (c)-(e) Reduce each spawn to phase, agent, tokens, kinds and its unknown mark.
  const reduced: ReducedSpawn[] = spawns.map(s => reduceSpawn(s, phaseStarts, phaseEnds));

  // (f) Aggregate into per-phase, per-agent cells.
  const phaseMap = new Map<string, UsagePhase>();
  for (const r of reduced) {
    let ph = phaseMap.get(r.phase);
    if (!ph) {
      ph = { phase: r.phase, agents: {}, total: emptyCell(), kinds: emptyKinds(), orchestratorShare: null, providers: emptyProviders() };
      phaseMap.set(r.phase, ph);
    }
    const anthropic = r.provider === 'anthropic';
    const agentKey = anthropic ? r.agent : `${r.agent}@deepseek`;
    const pcell = anthropic ? ph.providers.anthropic : ph.providers.deepseek;
    let cell = ph.agents[agentKey];
    if (!cell) {
      cell = emptyCell();
      ph.agents[agentKey] = cell;
    }
    cell.spawns += 1;
    ph.total.spawns += 1;
    pcell.spawns += 1;
    if (r.tokens !== undefined) {
      cell.tokens += r.tokens;
      ph.total.tokens += r.tokens;
      pcell.tokens += r.tokens;
    }
    if (r.unknown) {
      cell.unknown += 1;
      ph.total.unknown += 1;
      pcell.unknown += 1;
    }
    if (anthropic) {
      for (const dst of [cell, ph.total, ph.providers.anthropic]) {
        dst.cacheWrite5m += r.cache.w5m;
        dst.cacheWrite1h += r.cache.w1h;
        dst.gapRewrites += r.cache.gap;
        dst.cacheUnknownWrite += r.cache.unknownWrite;
        dst.cacheUnknownGap += r.cache.unknownGap;
      }
    }
    ph.kinds.input += r.kinds.input;
    ph.kinds.output += r.kinds.output;
    ph.kinds.cacheWrite += r.kinds.cacheWrite;
    ph.kinds.cacheRead += r.kinds.cacheRead;
  }

  for (const ph of phaseMap.values()) {
    let orchTokens = 0;
    for (const [agent, cell] of Object.entries(ph.agents)) {
      if (agent.endsWith('-orchestrator')) orchTokens += cell.tokens;
    }
    ph.orchestratorShare = ph.total.tokens > 0 ? orchTokens / ph.total.tokens : null;
  }

  const phases = [...phaseMap.values()].sort((a, b) => cmpPhase(a.phase, b.phase));

  const total = emptyCell();
  const kinds = emptyKinds();
  const providers = emptyProviders();
  for (const ph of phases) {
    addCell(total, ph.total);
    kinds.input += ph.kinds.input;
    kinds.output += ph.kinds.output;
    kinds.cacheWrite += ph.kinds.cacheWrite;
    kinds.cacheRead += ph.kinds.cacheRead;
    addCell(providers.anthropic, ph.providers.anthropic);
    addCell(providers.deepseek, ph.providers.deepseek);
  }

  return { spec, runs: runIds.size, phases, total, kinds, providers };
}

/** No spawn.end row carried digit tokens: the cache numbers are unknown (Req 4.3). */
function unknownWriteCache(): SpawnCache {
  return { w5m: 0, w1h: 0, gap: 0, unknownWrite: 1, unknownGap: 0 };
}

/** Cache numbers from the spawn.end row that set tokens (Req 4.2). */
function cacheOf(r: LedgerEvent): SpawnCache {
  const w5m = r.cacheWrite5m;
  const w1h = r.cacheWrite1h;
  if (w5m === undefined || !DIGITS.test(w5m) || w1h === undefined || !DIGITS.test(w1h)) {
    return unknownWriteCache();
  }
  const gap = r.gapRewrites;
  if (gap !== undefined && DIGITS.test(gap)) {
    return { w5m: Number(w5m), w1h: Number(w1h), gap: Number(gap), unknownWrite: 0, unknownGap: 0 };
  }
  return { w5m: Number(w5m), w1h: Number(w1h), gap: 0, unknownWrite: 0, unknownGap: 1 };
}

function reduceSpawn(s: Spawn, phaseStarts: LedgerEvent[], phaseEnds: LedgerEvent[]): ReducedSpawn {
  let phaseKey = s.phaseKey;
  let provider = s.provider;
  let tokens: number | undefined;
  let kinds = emptyKinds();
  let cache: SpawnCache = unknownWriteCache();

  // (c) tokens = the later digit-string spawn.end value; kinds and cache from that same row. A
  // spawn.usage phase overwrites the phase key. The last spawn.end carrying provider wins.
  // Rows are already in ts order.
  for (const r of s.rows) {
    if (r.type === 'spawn.usage' && r.phase !== undefined) phaseKey = r.phase;
    if (r.type === 'spawn.end' && r.provider !== undefined) provider = r.provider;
    if (r.type === 'spawn.end' && r.tokens !== undefined && DIGITS.test(r.tokens)) {
      tokens = Number(r.tokens);
      kinds = {
        input: digitOr0(r.input),
        output: digitOr0(r.output),
        cacheWrite: digitOr0(r.cacheWrite),
        cacheRead: digitOr0(r.cacheRead),
      };
      cache = cacheOf(r);
    }
  }
  // Else the later digit-string spawn.usage value.
  if (tokens === undefined) {
    for (const r of s.rows) {
      if (r.type === 'spawn.usage' && r.tokens !== undefined && DIGITS.test(r.tokens)) tokens = Number(r.tokens);
    }
  }

  // (d) unknown = tokens undefined and some row carries a non-digit tokens value. A spawn
  // whose rows carry no tokens key at all counts unmarked; 0 is a known zero.
  let unknown = false;
  if (tokens === undefined) {
    unknown = s.rows.some(r => r.tokens !== undefined && !DIGITS.test(r.tokens));
  }

  // (e) phase = phaseKey; else the live-phase window at the spawn's start; else unknown.
  let phase: string;
  if (phaseKey) {
    phase = phaseKey;
  } else {
    phase = windowPhase(ms(s.startedAt), phaseStarts, phaseEnds) ?? 'unknown';
  }

  return { phase, agent: s.agent, provider: provider ?? 'anthropic', tokens, unknown, kinds, cache };
}

/** Per phase of the union (in report order), `b` minus `a`. */
export function usageDelta(a: UsageReport, b: UsageReport): UsageDelta[] {
  const names: string[] = [];
  for (const p of a.phases) names.push(p.phase);
  for (const p of b.phases) if (!names.includes(p.phase)) names.push(p.phase);
  names.sort(cmpPhase);
  const aMap = new Map(a.phases.map(p => [p.phase, p.total]));
  const bMap = new Map(b.phases.map(p => [p.phase, p.total]));
  return names.map(phase => {
    const at = aMap.get(phase) ?? emptyCell();
    const bt = bMap.get(phase) ?? emptyCell();
    return { phase, spawns: bt.spawns - at.spawns, tokens: bt.tokens - at.tokens };
  });
}

/**
 * A graphify read call: a `Bash` tool row whose summary runs `graphify explain`, `query` or
 * `path` at a command boundary (design C5, D8). A `graphify update` or a grep of the phrase
 * does not match.
 */
export function isGraphCall(row: ActivityEvent): boolean {
  return row.event === 'tool' && row.tool === 'Bash' && row.summary !== undefined
    && /(^|[\s;&|(])graphify\s+(explain|query|path)\b/.test(row.summary);
}

/**
 * Fold graph calls from the activity rows onto `report` (design C5). Each call adds 1 to the
 * `graph` count of its agent cell in the phase whose live window holds the row's ts (else
 * `unknown`), of that phase's total, of its Anthropic provider cell, and of the report total
 * and its Anthropic provider cell. A missing phase or agent is created empty (0 spawns).
 * Mutates and returns `report`.
 */
export function applyGraphCounts(report: UsageReport, events: LedgerEvent[], activity: ActivityEvent[]): UsageReport {
  const sorted = [...events].sort((a, b) => ms(a.ts) - ms(b.ts));
  const phaseStarts = sorted.filter(e => e.type === 'phase.start');
  const phaseEnds = sorted.filter(e => e.type === 'phase.end');
  for (const row of activity) {
    if (!isGraphCall(row)) continue;
    const phaseName = windowPhase(ms(row.ts), phaseStarts, phaseEnds) ?? 'unknown';
    let ph = report.phases.find(p => p.phase === phaseName);
    if (!ph) {
      ph = { phase: phaseName, agents: {}, total: emptyCell(), kinds: emptyKinds(), orchestratorShare: null, providers: emptyProviders() };
      report.phases.push(ph);
      report.phases.sort((a, b) => cmpPhase(a.phase, b.phase));
    }
    const agentKey = row.agent ?? 'unknown';
    let cell = ph.agents[agentKey];
    if (!cell) {
      cell = emptyCell();
      ph.agents[agentKey] = cell;
    }
    cell.graph += 1;
    ph.total.graph += 1;
    ph.providers.anthropic.graph += 1;
    report.total.graph += 1;
    report.providers.anthropic.graph += 1;
  }
  return report;
}

function grp(x: number): string {
  return x.toLocaleString('en-US');
}

function tokenCell(c: UsageCell): string {
  return `${grp(c.tokens)}${c.unknown ? ` (+${c.unknown} unknown)` : ''}`;
}

/**
 * The three cache columns for a cell, gated on its Anthropic spawn count (design C5).
 * At 0 (an all-DeepSeek cell) all three are `-`. Else a write column is `unknown` when
 * every spawn's write was unknown, else its sum; the gap column is `unknown` when every
 * spawn's gap was unknown, else its sum with ` (+N unknown)` when some were unknown.
 */
function cacheCols(c: UsageCell, anthropicSpawns: number): [string, string, string] {
  if (anthropicSpawns === 0) return ['-', '-', '-'];
  const write = (sum: number) => (c.cacheUnknownWrite === anthropicSpawns ? 'unknown' : grp(sum));
  const n = c.cacheUnknownWrite + c.cacheUnknownGap;
  const gap = n === anthropicSpawns ? 'unknown' : `${grp(c.gapRewrites)}${n > 0 ? ` (+${n} unknown)` : ''}`;
  return [write(c.cacheWrite5m), write(c.cacheWrite1h), gap];
}

function cacheStr(c: UsageCell, anthropicSpawns: number): string {
  return cacheCols(c, anthropicSpawns).join(' | ');
}

function orchStr(share: number | null): string {
  return share === null ? '-' : `${(share * 100).toFixed(1)}%`;
}

function kindsStr(k: UsageKinds): string {
  return `in ${grp(k.input)} out ${grp(k.output)} cw ${grp(k.cacheWrite)} cr ${grp(k.cacheRead)}`;
}

function provStr(p: UsageByProvider): string {
  return `anthropic ${grp(p.anthropic.tokens)}  deepseek ${grp(p.deepseek.tokens)}`;
}

function headLine(r: UsageReport): string {
  return `usage ${r.spec}  runs ${r.runs}  spawns ${grp(r.total.spawns)}  tokens ${grp(r.total.tokens)}`;
}

export function formatUsageTable(report: UsageReport, compare?: UsageReport): string {
  if (!compare) return formatOne(report);
  return formatCompare(report, compare);
}

function formatOne(report: UsageReport): string {
  const lines: string[] = [headLine(report), 'phase | agent | spawns | tokens | cw5m | cw1h | gapRewrites | graph'];
  for (const ph of report.phases) {
    for (const agent of Object.keys(ph.agents).sort((a, b) => a.localeCompare(b))) {
      const c = ph.agents[agent];
      const anthropicSpawns = agent.endsWith('@deepseek') ? 0 : c.spawns;
      lines.push(`${ph.phase} | ${agent} | ${grp(c.spawns)} | ${tokenCell(c)} | ${cacheStr(c, anthropicSpawns)} | ${grp(c.graph)}`);
    }
    lines.push(`${ph.phase} | total | ${grp(ph.total.spawns)} | ${tokenCell(ph.total)} | ${cacheStr(ph.total, ph.providers.anthropic.spawns)} | ${grp(ph.total.graph)}  orch ${orchStr(ph.orchestratorShare)}  ${kindsStr(ph.kinds)}  ${provStr(ph.providers)}`);
  }
  lines.push(`total |  | ${grp(report.total.spawns)} | ${tokenCell(report.total)} | ${cacheStr(report.total, report.providers.anthropic.spawns)} | ${grp(report.total.graph)}  ${kindsStr(report.kinds)}  ${provStr(report.providers)}`);
  return lines.join('\n');
}

function formatCompare(report: UsageReport, compare: UsageReport): string {
  const cols = 'spawns | tokens | cw5m | cw1h | gapRewrites | graph';
  const lines: string[] = [headLine(report), headLine(compare), `phase | agent | ${cols} | ${cols}`];
  const aMap = new Map(report.phases.map(p => [p.phase, p]));
  const bMap = new Map(compare.phases.map(p => [p.phase, p]));
  const names: string[] = [];
  for (const p of report.phases) names.push(p.phase);
  for (const p of compare.phases) if (!names.includes(p.phase)) names.push(p.phase);
  names.sort(cmpPhase);
  const deltas = new Map(usageDelta(report, compare).map(d => [d.phase, d]));
  const pair = (c: UsageCell | undefined, anthropicSpawns: number) =>
    c ? `${grp(c.spawns)} | ${tokenCell(c)} | ${cacheStr(c, anthropicSpawns)} | ${grp(c.graph)}` : '- | - | - | - | - | -';
  const provPair = (a: UsageByProvider | undefined, b: UsageByProvider | undefined) =>
    `anthropic ${grp(a?.anthropic.tokens ?? 0)} | ${grp(b?.anthropic.tokens ?? 0)}  deepseek ${grp(a?.deepseek.tokens ?? 0)} | ${grp(b?.deepseek.tokens ?? 0)}`;

  for (const phase of names) {
    const ap = aMap.get(phase);
    const bp = bMap.get(phase);
    const agents = new Set<string>();
    if (ap) for (const k of Object.keys(ap.agents)) agents.add(k);
    if (bp) for (const k of Object.keys(bp.agents)) agents.add(k);
    for (const agent of [...agents].sort((a, b) => a.localeCompare(b))) {
      const ac = ap?.agents[agent];
      const bc = bp?.agents[agent];
      const aCount = agent.endsWith('@deepseek') ? 0 : (ac?.spawns ?? 0);
      const bCount = agent.endsWith('@deepseek') ? 0 : (bc?.spawns ?? 0);
      lines.push(`${phase} | ${agent} | ${pair(ac, aCount)} | ${pair(bc, bCount)}`);
    }
    const d = deltas.get(phase);
    lines.push(`${phase} | total | ${pair(ap?.total, ap?.providers.anthropic.spawns ?? 0)} | ${pair(bp?.total, bp?.providers.anthropic.spawns ?? 0)}  delta spawns ${d ? d.spawns : 0} tokens ${grp(d ? d.tokens : 0)}  ${provPair(ap?.providers, bp?.providers)}`);
  }
  const dSpawns = compare.total.spawns - report.total.spawns;
  const dTokens = compare.total.tokens - report.total.tokens;
  lines.push(`total |  | ${pair(report.total, report.providers.anthropic.spawns)} | ${pair(compare.total, compare.providers.anthropic.spawns)}  delta spawns ${dSpawns} tokens ${grp(dTokens)}  ${provPair(report.providers, compare.providers)}`);
  return lines.join('\n');
}
