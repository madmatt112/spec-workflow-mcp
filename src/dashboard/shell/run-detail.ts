// src/dashboard/shell/run-detail.ts
//
// The run page's extra fields (design.md C6; Requirement 4 AC 3, 5, 7). A pure
// builder over the same ledger, activity and HANDOFF that `buildModel` reads: it
// adds the phase strip, per-task risk and fix rounds, and the capped ledger and
// activity rows that `RunModel` does not carry.
import { buildModel, PHASE_ORDER } from '../../watch/ledger.js';
import type { LedgerEvent, ActivityEvent } from '../../watch/ledger.js';
import type { RunDetail } from './types.js';

function ms(ts: string | undefined): number {
  const n = ts ? new Date(ts).getTime() : NaN;
  return Number.isNaN(n) ? 0 : n;
}

/** `gate: task <id> <pass|fail> risk <low|high>` (SKILL.md:80-82); captures id and risk. */
const GATE_NOTE = /^gate: task (\S+) (?:pass|fail) risk (low|high)$/;

export function buildRunDetail(input: {
  spec: string;
  ledger: LedgerEvent[];
  activity: ActivityEvent[];
  handoffMd?: string;
  rowCap?: number;
}): RunDetail {
  const { spec } = input;
  const rowCap = input.rowCap ?? 500;
  const ledger = [...input.ledger].sort((a, b) => ms(a.ts) - ms(b.ts));
  const activity = [...input.activity].sort((a, b) => ms(a.ts) - ms(b.ts));

  // buildModel supplies the merged phase rows (HANDOFF + ledger phase.end) and
  // the live phase, over the same inputs.
  const model = buildModel({ spec, ledger, activity, handoffMd: input.handoffMd });
  const livePhase = model.livePhase?.phase;

  const phaseStrip = PHASE_ORDER.map((phase) => {
    const rows = model.phases.filter((p) => p.phase === phase);
    let version: string | null = null;
    let approvedOn: string | null = null;
    for (const r of rows) {
      if (/^v\d+$/.test(r.state)) version = r.state;
      if (r.result === 'approved' || r.result === 'complete' || r.result === 'closed') {
        approvedOn = r.date ?? null;
      }
    }
    const rounds = ledger.filter((e) => e.type === 'round' && e.phase === phase).length;
    return { phase, version, rounds, approvedOn, live: livePhase === phase };
  });

  // taskMeta: the newest gate note's risk and the newest task.done's rounds per
  // task. The ledger is oldest first, so a later row overwrites an earlier one.
  const taskMeta: RunDetail['taskMeta'] = {};
  const meta = (id: string) => (taskMeta[id] ??= { risk: null, fixRounds: null });
  for (const e of ledger) {
    if (e.type === 'note' && typeof e.text === 'string') {
      const m = e.text.match(GATE_NOTE);
      if (m) meta(m[1]).risk = m[2] as 'low' | 'high';
    } else if (e.type === 'task.done' && e.task) {
      const n = Number(e.rounds);
      meta(e.task).fixRounds = e.rounds !== undefined && !Number.isNaN(n) ? n : null;
    }
  }

  // ledgerRows and activityRows: the current run's rows, scoped the way buildModel
  // scopes (src/watch/ledger.ts:256-260), oldest first, the newest rowCap kept.
  const runStart = [...ledger].reverse().find((e) => e.type === 'run.start');
  const runId = runStart?.run;
  const ledgerRows = (runId ? ledger.filter((e) => e.run === runId) : ledger).slice(-rowCap);
  const activityRows = (runId ? activity.filter((a) => !a.run || a.run === runId) : activity).slice(-rowCap);

  return { spec, phaseStrip, taskMeta, ledgerRows, activityRows };
}
