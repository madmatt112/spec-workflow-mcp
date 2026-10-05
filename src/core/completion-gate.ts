import { promises as fs } from 'fs';
import { join } from 'path';
import { PathUtils } from './path-utils.js';
import { parseJsonl, LedgerEvent } from '../watch/ledger.js';

/**
 * The single completion gate the routers share (spec-index, spec-status, and the
 * supervisor's sdd-continue step-3 rule 1). An unresolved completion-gate stop
 * blocks "implementation complete" regardless of the task count.
 *
 * After 18/18 a run can still be parked on a stop the owner has not discharged:
 * the implementation phase's last `phase.end` carried result `escalate`,
 * `verify-failed`, or no/empty result, and no `phase.start` reopened a phase
 * after it.
 * Routing that trusted the task count alone sent such a run to retrospective;
 * only the HANDOFF header held it in implementation (retro mobile-pwa F5). Both
 * tools call this before they trust a `completed` status; sdd-continue states the
 * same rule in prose so the supervisor follows it.
 */

/** Milliseconds of an ISO timestamp; 0 when absent or unparseable (as `buildModel`). */
function ms(ts: string | undefined): number {
  const n = ts ? new Date(ts).getTime() : NaN;
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Pure core: true when the ledger ends on an unresolved completion-gate stop.
 * The newest `phase.end` has result `escalate`, `verify-failed`, or an
 * empty/absent `result`, and no `phase.start` follows it. A later `phase.start`
 * means a new phase (e.g. the repair run) reopened, so the stop has been acted
 * on and no longer blocks on its own. An empty ledger never blocks.
 */
export function ledgerHasUnresolvedCompletionGate(ledger: LedgerEvent[]): boolean {
  const sorted = [...ledger].sort((a, b) => ms(a.ts) - ms(b.ts));
  let lastEndIdx = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].type === 'phase.end') { lastEndIdx = i; break; }
  }
  if (lastEndIdx === -1) return false;
  for (let i = lastEndIdx + 1; i < sorted.length; i++) {
    if (sorted[i].type === 'phase.start') return false;
  }
  const result = (sorted[lastEndIdx].result ?? '').trim();
  return result === '' || result === 'escalate' || result === 'verify-failed';
}

/**
 * Read the spec's `harness-events.jsonl` and apply {@link
 * ledgerHasUnresolvedCompletionGate}. A missing or unreadable ledger never
 * blocks (a run never needs one).
 */
export async function hasUnresolvedCompletionGate(projectPath: string, specName: string): Promise<boolean> {
  const ledgerPath = join(PathUtils.getSpecPath(projectPath, specName), 'harness-events.jsonl');
  let text: string | undefined;
  try {
    text = await fs.readFile(ledgerPath, 'utf-8');
  } catch {
    return false;
  }
  return ledgerHasUnresolvedCompletionGate(parseJsonl<LedgerEvent>(text));
}
