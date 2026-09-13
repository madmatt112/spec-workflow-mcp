/**
 * Run model for `spec-workflow-mcp --watch`.
 *
 * Two append-only files under a spec directory feed it:
 * - `harness-events.jsonl`, written by the harness skills through their event script:
 *   run, phase, spawn, round and task events with the meaning only the orchestrators know.
 * - `harness-activity.jsonl`, written by the plugin's hooks: exact agent start and stop
 *   (with tokens) and one line per tool call of every `sdd-*` agent.
 *
 * Plus `tasks.md` for the task queue and `HANDOFF.md`'s `## Phase log` for phases that
 * finished before the ledger existed or in an earlier run.
 */

export interface LedgerEvent {
  ts: string;
  type: string;
  run?: string;
  spec?: string;
  [key: string]: string | undefined;
}

export interface ActivityEvent {
  ts: string;
  agent: string;
  event: 'tool' | 'agent.start' | 'agent.stop';
  run?: string;
  session?: string;
  agentId?: string;
  tool?: string;
  summary?: string;
  tokens?: number;
}

export interface AgentProfile {
  model: string;
  effort: string;
  role: string;
}

/** Declared in the plugin's agent frontmatter; the view shows them as declared. */
export const AGENT_PROFILES: Record<string, AgentProfile> = {
  'sdd-document-orchestrator': { model: 'fable-5-1', effort: 'xhigh', role: 'runs a document phase' },
  'sdd-implementation-orchestrator': { model: 'fable-5-1', effort: 'xhigh', role: 'runs the task queue' },
  'sdd-retro-orchestrator': { model: 'fable-5-1', effort: 'xhigh', role: 'compiles the retrospective' },
  'sdd-closeout-orchestrator': { model: 'fable-5-1', effort: 'xhigh', role: 'lands the retro plan' },
  'sdd-drafter': { model: 'fable-5-1', effort: 'xhigh', role: 'writes v1' },
  'sdd-reviewer': { model: 'opus-4-8', effort: 'xhigh', role: 'adversarial review' },
  'sdd-reviser': { model: 'opus-4-8', effort: 'xhigh', role: 'writes the next version' },
  'sdd-adjudicator': { model: 'fable-5-1', effort: 'xhigh', role: 'rules and fixes' },
  'sdd-implementer': { model: 'opus-4-8', effort: 'xhigh', role: 'implements a task' },
  'sdd-verifier': { model: 'opus-4-8', effort: 'xhigh', role: 'independent review' },
  'sdd-retro-analyst': { model: 'fable-5-1', effort: 'xhigh', role: 'proposes fixes' },
};

export interface PhaseRow {
  phase: string;
  state: string;
  result: string;
  note: string;
  date?: string;
}

export interface SpawnNode {
  agent: string;
  role: string;
  phase?: string;
  task?: string;
  round?: string;
  startedAt: string;
  endedAt?: string;
  result?: string;
  tokens?: number;
  lastActivityAt?: string;
  lastTool?: string;
  lastSummary?: string;
  /** Orchestrators are spawned by the supervisor; everything else by an orchestrator. */
  level: 1 | 2;
}

export interface TaskRow {
  id: string;
  title: string;
  status: 'done' | 'in-progress' | 'open';
}

export interface RoundRow {
  phase: string;
  round: string;
  verdict: string;
  version?: string;
}

/** A `task.pick` of the current run (a task id or a close-out item such as `P3`). */
export interface PickRow {
  task: string;
  title: string;
  done: boolean;
  outcome?: string;
}

export interface TickerLine {
  ts: string;
  text: string;
}

export interface RunModel {
  spec: string;
  runId?: string;
  runStartedAt?: string;
  runEndedAt?: string;
  status?: string;
  model?: string;
  codeRoot?: string;
  worktree?: string;
  headless?: string;
  phases: PhaseRow[];
  livePhase?: { phase: string; mode?: string; budget?: string; state?: string; startedAt: string };
  spawns: SpawnNode[];
  rounds: RoundRow[];
  tasks: TaskRow[];
  /** Items the orchestrator picked in this run; the queue for phases without a tasks.md. */
  picks: PickRow[];
  ticker: TickerLine[];
  tokensTotal: number;
  /** True when at least one activity event exists for the run (the hook is installed). */
  hasActivity: boolean;
}

export function parseJsonl<T>(text: string | undefined): T[] {
  if (!text) return [];
  const out: T[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch {
      // A torn write at the tail is normal while a run is appending; skip it.
    }
  }
  return out;
}

/** Rows of `## Phase log` for one spec, in file order. */
export function parseHandoffPhaseRows(handoffMd: string | undefined, spec: string): PhaseRow[] {
  if (!handoffMd) return [];
  const rows: PhaseRow[] = [];
  let inLog = false;
  for (const line of handoffMd.split('\n')) {
    if (line.startsWith('## ')) {
      inLog = line.trim() === '## Phase log';
      continue;
    }
    if (!inLog || !line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 6 || cells[0] === 'Date' || cells[0].startsWith('---')) continue;
    if (cells[1] !== spec) continue;
    rows.push({ date: cells[0], phase: cells[2], state: cells[3], result: cells[4], note: cells[5] });
  }
  return rows;
}

/** The active spec named in the HANDOFF routing header, if any. */
export function parseHandoffActiveSpec(handoffMd: string | undefined): string | undefined {
  if (!handoffMd) return undefined;
  const m = handoffMd.match(/Active spec \*\*`([^`]+)`\*\*/);
  return m ? m[1] : undefined;
}

export function parseTasks(tasksMd: string | undefined): TaskRow[] {
  if (!tasksMd) return [];
  const rows: TaskRow[] = [];
  const re = /^- \[( |x|-)\] (\d+(?:\.\d+)*)\.?\s+(.*)$/;
  for (const line of tasksMd.split('\n')) {
    const m = line.match(re);
    if (!m) continue;
    const status = m[1] === 'x' ? 'done' : m[1] === '-' ? 'in-progress' : 'open';
    rows.push({ id: m[2], title: m[3].replace(/`/g, '').trim(), status });
  }
  return rows;
}

function ms(ts: string | undefined): number {
  const n = ts ? new Date(ts).getTime() : NaN;
  return Number.isNaN(n) ? 0 : n;
}

export function buildModel(input: {
  spec: string;
  ledger: LedgerEvent[];
  activity: ActivityEvent[];
  tasksMd?: string;
  handoffMd?: string;
}): RunModel {
  const { spec } = input;
  const ledger = [...input.ledger].sort((a, b) => ms(a.ts) - ms(b.ts));
  const activity = [...input.activity].sort((a, b) => ms(a.ts) - ms(b.ts));

  // The current run is the last run.start; everything live is scoped to it.
  const runStart = [...ledger].reverse().find(e => e.type === 'run.start');
  const runId = runStart?.run;
  const runEvents = runId ? ledger.filter(e => e.run === runId) : ledger;
  const runActivity = runId ? activity.filter(a => !a.run || a.run === runId) : activity;
  const runEnd = [...runEvents].reverse().find(e => e.type === 'run.end');

  // Phases: HANDOFF rows first (they cover earlier runs); then ledger phase.end rows the
  // HANDOFF does not have yet.
  const phases = parseHandoffPhaseRows(input.handoffMd, spec);
  for (const e of ledger.filter(e => e.type === 'phase.end')) {
    const dup = phases.some(p => p.phase === e.phase && p.result === e.result && p.state === (e.state ?? ''));
    if (!dup) phases.push({ date: e.ts.slice(0, 10), phase: e.phase ?? '', state: e.state ?? '', result: e.result ?? '', note: e.note ?? '' });
  }

  // Live phase: the last phase.start without a later phase.end for the same phase.
  let livePhase: RunModel['livePhase'];
  const starts = runEvents.filter(e => e.type === 'phase.start');
  const lastStart = starts[starts.length - 1];
  if (lastStart) {
    const ended = runEvents.some(e => e.type === 'phase.end' && e.phase === lastStart.phase && ms(e.ts) >= ms(lastStart.ts));
    if (!ended) {
      livePhase = { phase: lastStart.phase ?? '', mode: lastStart.mode, budget: lastStart.budget, state: lastStart.state, startedAt: lastStart.ts };
    }
  }

  // Spawns: pair spawn.start with the first later unmatched spawn.end of the same agent.
  const spawns: SpawnNode[] = [];
  for (const e of runEvents) {
    if (e.type === 'spawn.start') {
      const agent = e.agent ?? 'unknown';
      spawns.push({
        agent,
        role: e.role ?? '',
        phase: e.phase,
        task: e.task,
        round: e.round,
        startedAt: e.ts,
        level: agent.endsWith('-orchestrator') ? 1 : 2,
      });
    } else if (e.type === 'spawn.end') {
      const open = spawns.find(s => s.agent === e.agent && !s.endedAt && ms(s.startedAt) <= ms(e.ts));
      if (open) {
        open.endedAt = e.ts;
        open.result = e.result;
        if (e.tokens && !Number.isNaN(Number(e.tokens))) open.tokens = Number(e.tokens);
      }
    }
  }

  // Activity joins by agent name and time window: the latest tool event after the spawn
  // started (and before it ended) is what the agent is doing; the agent.stop in the window
  // carries the tokens.
  let tokensTotal = 0;
  for (const a of runActivity) {
    if (a.event === 'agent.stop' && typeof a.tokens === 'number') tokensTotal += a.tokens;
  }
  for (const s of spawns) {
    const from = ms(s.startedAt);
    const to = s.endedAt ? ms(s.endedAt) + 60_000 : Number.POSITIVE_INFINITY;
    for (const a of runActivity) {
      if (a.agent !== s.agent) continue;
      const t = ms(a.ts);
      if (t < from || t > to) continue;
      if (a.event === 'tool') {
        s.lastActivityAt = a.ts;
        s.lastTool = a.tool;
        s.lastSummary = a.summary;
      } else if (a.event === 'agent.stop' && typeof a.tokens === 'number' && s.tokens === undefined) {
        s.tokens = a.tokens;
      } else if (a.event === 'agent.start' && !s.lastActivityAt) {
        s.lastActivityAt = a.ts;
      }
    }
  }

  const picks: PickRow[] = [];
  for (const e of runEvents) {
    if (e.type === 'task.pick' && e.task) {
      picks.push({ task: e.task, title: e.title ?? '', done: false });
    } else if (e.type === 'task.done' && e.task) {
      const pick = picks.find(pk => pk.task === e.task && !pk.done);
      if (pick) { pick.done = true; pick.outcome = e.outcome; }
    }
  }

  const rounds: RoundRow[] = runEvents
    .filter(e => e.type === 'round')
    .map(e => ({ phase: e.phase ?? '', round: e.round ?? '', verdict: e.verdict ?? '', version: e.version }));

  // Ticker: the last few meaningful events, newest last.
  const tickerSource: TickerLine[] = [];
  for (const e of runEvents) {
    if (e.type === 'run.start') continue;
    const detail =
      e.type === 'spawn.start' || e.type === 'spawn.end' ? `${e.agent ?? ''}  ${e.role ?? ''}${e.result ? `  -> ${e.result}` : ''}` :
      e.type === 'task.pick' ? `task ${e.task ?? ''}  ${e.title ?? ''}` :
      e.type === 'task.done' ? `task ${e.task ?? ''}  ${e.outcome ?? ''}${e.rounds ? ` after ${e.rounds} round(s)` : ''}` :
      e.type === 'round' ? `${e.phase ?? ''} ${e.version ?? ''} round ${e.round ?? ''}  ${e.verdict ?? ''}` :
      e.type === 'phase.start' ? `${e.phase ?? ''}  ${e.mode ?? ''} ${e.state ?? ''}`.trim() :
      e.type === 'phase.end' ? `${e.phase ?? ''}  ${e.result ?? ''}  ${e.state ?? ''}` :
      e.type === 'run.end' ? `${e.status ?? ''}` :
      e.type === 'note' ? `${e.text ?? ''}` : '';
    tickerSource.push({ ts: e.ts, text: `${e.type.padEnd(11)} ${detail}`.trimEnd() });
  }
  for (const a of runActivity) {
    if (a.event === 'agent.stop') {
      tickerSource.push({ ts: a.ts, text: `agent.stop  ${a.agent}${a.tokens ? `  ${formatTokens(a.tokens)} tok` : ''}` });
    }
  }
  tickerSource.sort((a, b) => ms(a.ts) - ms(b.ts));

  return {
    spec,
    runId,
    runStartedAt: runStart?.ts,
    runEndedAt: runEnd?.ts,
    status: runEnd?.status,
    model: runStart?.model,
    codeRoot: runStart?.codeRoot,
    worktree: runStart?.worktree,
    headless: runStart?.headless,
    phases,
    livePhase,
    spawns,
    rounds,
    tasks: parseTasks(input.tasksMd),
    picks,
    ticker: tickerSource.slice(-4),
    tokensTotal,
    hasActivity: runActivity.length > 0,
  };
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}
