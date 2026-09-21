/**
 * Usage fold for `harness usage` (design Component 5).
 *
 * The Req 5.4-5.6 algorithm over *every* run of a ledger, as pure functions spec 9 can
 * call without the tool. No file reads and no `buildModel` call live here: it restates
 * `buildModel`'s fold behaviours (the `spawn.usage` token fallback and the start-less
 * synthesis, `src/watch/ledger.ts` folds) as its own rules, but not its last-run scope or
 * its first-closing-row pairing.
 */

import { LedgerEvent, PHASE_ORDER } from './ledger.js';

export interface UsageCell { spawns: number; tokens: number; unknown: number }
export interface UsageKinds { input: number; output: number; cacheWrite: number; cacheRead: number }
export interface UsagePhase {
  phase: string;
  agents: Record<string, UsageCell>;
  total: UsageCell;
  kinds: UsageKinds;
  orchestratorShare: number | null;
}
export interface UsageReport { spec: string; runs: number; phases: UsagePhase[]; total: UsageCell; kinds: UsageKinds }
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
  rows: LedgerEvent[];
}

interface ReducedSpawn {
  phase: string;
  agent: string;
  tokens: number | undefined;
  unknown: boolean;
  kinds: UsageKinds;
}

function emptyCell(): UsageCell {
  return { spawns: 0, tokens: 0, unknown: 0 };
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

export function buildUsageReport(events: LedgerEvent[], spec: string): UsageReport {
  // (a) Stable sort by ts; runs = distinct defined run values.
  const sorted = [...events].sort((a, b) => ms(a.ts) - ms(b.ts));
  const runIds = new Set<string>();
  for (const e of sorted) if (e.run !== undefined) runIds.add(e.run);

  // (b) Walk the rows, keeping one open spawn per agent. A spawn.start opens (and replaces)
  // the agent's current spawn; a spawn.end or spawn.usage attaches to it. With none open a
  // spawn.usage becomes its own spawn (not entered as current) and a spawn.end is dropped.
  const spawns: Spawn[] = [];
  const current = new Map<string, Spawn>();
  for (const e of sorted) {
    const agent = e.agent ?? 'unknown';
    if (e.type === 'spawn.start') {
      const s: Spawn = { agent, startedAt: e.ts, phaseKey: e.phase, rows: [] };
      spawns.push(s);
      current.set(agent, s);
    } else if (e.type === 'spawn.end' || e.type === 'spawn.usage') {
      const open = current.get(agent);
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
      ph = { phase: r.phase, agents: {}, total: emptyCell(), kinds: emptyKinds(), orchestratorShare: null };
      phaseMap.set(r.phase, ph);
    }
    let cell = ph.agents[r.agent];
    if (!cell) {
      cell = emptyCell();
      ph.agents[r.agent] = cell;
    }
    cell.spawns += 1;
    ph.total.spawns += 1;
    if (r.tokens !== undefined) {
      cell.tokens += r.tokens;
      ph.total.tokens += r.tokens;
    }
    if (r.unknown) {
      cell.unknown += 1;
      ph.total.unknown += 1;
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
  for (const ph of phases) {
    total.spawns += ph.total.spawns;
    total.tokens += ph.total.tokens;
    total.unknown += ph.total.unknown;
    kinds.input += ph.kinds.input;
    kinds.output += ph.kinds.output;
    kinds.cacheWrite += ph.kinds.cacheWrite;
    kinds.cacheRead += ph.kinds.cacheRead;
  }

  return { spec, runs: runIds.size, phases, total, kinds };
}

function reduceSpawn(s: Spawn, phaseStarts: LedgerEvent[], phaseEnds: LedgerEvent[]): ReducedSpawn {
  let phaseKey = s.phaseKey;
  let tokens: number | undefined;
  let kinds = emptyKinds();

  // (c) tokens = the later digit-string spawn.end value; kinds from that same row. A
  // spawn.usage phase overwrites the phase key. Rows are already in ts order.
  for (const r of s.rows) {
    if (r.type === 'spawn.usage' && r.phase !== undefined) phaseKey = r.phase;
    if (r.type === 'spawn.end' && r.tokens !== undefined && DIGITS.test(r.tokens)) {
      tokens = Number(r.tokens);
      kinds = {
        input: digitOr0(r.input),
        output: digitOr0(r.output),
        cacheWrite: digitOr0(r.cacheWrite),
        cacheRead: digitOr0(r.cacheRead),
      };
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
    const at = ms(s.startedAt);
    let windowPhase: string | undefined;
    for (let i = phaseStarts.length - 1; i >= 0; i--) {
      const ps = phaseStarts[i];
      if (ms(ps.ts) > at) continue;
      const closed = phaseEnds.some(pe => pe.phase === ps.phase && ms(pe.ts) >= ms(ps.ts) && ms(pe.ts) <= at);
      if (!closed) {
        windowPhase = ps.phase;
        break;
      }
    }
    phase = windowPhase ?? 'unknown';
  }

  return { phase, agent: s.agent, tokens, unknown, kinds };
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

function grp(x: number): string {
  return x.toLocaleString('en-US');
}

function tokenCell(c: UsageCell): string {
  return `${grp(c.tokens)}${c.unknown ? ` (+${c.unknown} unknown)` : ''}`;
}

function orchStr(share: number | null): string {
  return share === null ? '-' : `${(share * 100).toFixed(1)}%`;
}

function kindsStr(k: UsageKinds): string {
  return `in ${grp(k.input)} out ${grp(k.output)} cw ${grp(k.cacheWrite)} cr ${grp(k.cacheRead)}`;
}

function headLine(r: UsageReport): string {
  return `usage ${r.spec}  runs ${r.runs}  spawns ${grp(r.total.spawns)}  tokens ${grp(r.total.tokens)}`;
}

export function formatUsageTable(report: UsageReport, compare?: UsageReport): string {
  if (!compare) return formatOne(report);
  return formatCompare(report, compare);
}

function formatOne(report: UsageReport): string {
  const lines: string[] = [headLine(report), 'phase | agent | spawns | tokens'];
  for (const ph of report.phases) {
    for (const agent of Object.keys(ph.agents).sort((a, b) => a.localeCompare(b))) {
      const c = ph.agents[agent];
      lines.push(`${ph.phase} | ${agent} | ${grp(c.spawns)} | ${tokenCell(c)}`);
    }
    lines.push(`${ph.phase} | total | ${grp(ph.total.spawns)} | ${tokenCell(ph.total)}  orch ${orchStr(ph.orchestratorShare)}  ${kindsStr(ph.kinds)}`);
  }
  lines.push(`total |  | ${grp(report.total.spawns)} | ${tokenCell(report.total)}  ${kindsStr(report.kinds)}`);
  return lines.join('\n');
}

function formatCompare(report: UsageReport, compare: UsageReport): string {
  const lines: string[] = [headLine(report), headLine(compare), 'phase | agent | spawns | tokens | spawns | tokens'];
  const aMap = new Map(report.phases.map(p => [p.phase, p]));
  const bMap = new Map(compare.phases.map(p => [p.phase, p]));
  const names: string[] = [];
  for (const p of report.phases) names.push(p.phase);
  for (const p of compare.phases) if (!names.includes(p.phase)) names.push(p.phase);
  names.sort(cmpPhase);
  const deltas = new Map(usageDelta(report, compare).map(d => [d.phase, d]));
  const pair = (c: UsageCell | undefined) => (c ? `${grp(c.spawns)} | ${tokenCell(c)}` : '- | -');

  for (const phase of names) {
    const ap = aMap.get(phase);
    const bp = bMap.get(phase);
    const agents = new Set<string>();
    if (ap) for (const k of Object.keys(ap.agents)) agents.add(k);
    if (bp) for (const k of Object.keys(bp.agents)) agents.add(k);
    for (const agent of [...agents].sort((a, b) => a.localeCompare(b))) {
      lines.push(`${phase} | ${agent} | ${pair(ap?.agents[agent])} | ${pair(bp?.agents[agent])}`);
    }
    const d = deltas.get(phase);
    lines.push(`${phase} | total | ${pair(ap?.total)} | ${pair(bp?.total)}  delta spawns ${d ? d.spawns : 0} tokens ${grp(d ? d.tokens : 0)}`);
  }
  const dSpawns = compare.total.spawns - report.total.spawns;
  const dTokens = compare.total.tokens - report.total.tokens;
  lines.push(`total |  | ${pair(report.total)} | ${pair(compare.total)}  delta spawns ${dSpawns} tokens ${grp(dTokens)}`);
  return lines.join('\n');
}
