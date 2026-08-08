import { SpecIndexEntry } from '../types.js';

/**
 * Why there is (or is not) a spec to work on next. Callers must branch on this
 * rather than on `spec` being absent — the three "no spec" states mean very
 * different things and only one of them means the roadmap is finished.
 */
export type RoutingState =
  /** `spec` names the spec to work on. */
  | 'active'
  /** Nothing declares an order over the remaining specs. Stop and ask. */
  | 'ambiguous'
  /** Every spec *on disk* is Complete. decomposition.md may still name unstarted specs. */
  | 'all-on-disk-complete'
  /** Specs exist but every one is deferred. Nothing is finished. */
  | 'all-deferred'
  /** No specs exist yet. */
  | 'no-specs';

export interface RoutingDecision {
  state: RoutingState;
  /** The spec to work on, or null for every state except 'active'. */
  spec: string | null;
  /** Human-readable justification, rendered into INDEX.md so a choice can be audited. */
  reason: string;
  /** Specs considered but not chosen. Populated for 'ambiguous'. */
  candidates: string[];
  /** Data problems that make the decision less trustworthy. */
  warnings: string[];
}

const isComplete = (e: SpecIndexEntry) => e.overallStatus === 'completed';

/**
 * A spec someone has begun. `completed` alone is not enough: the implementation loop
 * marks a task `[-]` *before* working on it, so a spec whose first task is underway
 * has completed 0.
 */
const isStarted = (e: SpecIndexEntry) =>
  e.taskProgress.completed + e.taskProgress.inProgress > 0;

const progress = (e: SpecIndexEntry) =>
  e.taskProgress.total > 0 ? `${e.taskProgress.completed}/${e.taskProgress.total}` : 'no tasks yet';

const label = (e: SpecIndexEntry) => `${e.name} (${progress(e)})`;

/**
 * Decide which spec to work on next, from the same buckets INDEX.md renders.
 *
 * Two buckets, two different rules, on purpose:
 *
 * - `active` is a human-declared *dependency* sequence (order of first mention in
 *   decomposition.md). Progress must never override it — spec N+1 may depend on N.
 * - `other` has no declared order at all. Creation time is filesystem birthtime, which
 *   is not stored in git and is restamped by any fresh clone or worktree, so it encodes
 *   nothing. The only real signal is whether someone has started the spec. Where that
 *   does not single one out, this returns 'ambiguous' rather than inventing an order.
 *
 * Deliberately takes the categorized buckets rather than the `inDecomposition` flag:
 * when decomposition.md is absent the generator puts every spec in `active`, and
 * keying off the flag instead would rank them by a rule the rendered table does not use.
 */
export function deriveRouting(buckets: {
  active: SpecIndexEntry[];
  deferred: SpecIndexEntry[];
  other: SpecIndexEntry[];
}): RoutingDecision {
  const { active, deferred, other } = buckets;
  const warnings = collectWarnings([...active, ...other, ...deferred]);
  const decide = (d: Omit<RoutingDecision, 'warnings'>): RoutingDecision => ({ ...d, warnings });

  if (active.length === 0 && deferred.length === 0 && other.length === 0) {
    return decide({ state: 'no-specs', spec: null, reason: 'No specs exist yet.', candidates: [] });
  }

  if (active.length === 0 && other.length === 0) {
    return decide({
      state: 'all-deferred',
      spec: null,
      reason: `Every spec (${deferred.length}) is deferred. Nothing is complete — undefer one to continue.`,
      candidates: deferred.map(e => e.name),
    });
  }

  const nextSequenced = active.find(e => !isComplete(e));
  if (nextSequenced) {
    return decide({
      state: 'active',
      spec: nextSequenced.name,
      reason: `First not-Complete spec in build order (${progress(nextSequenced)}).`,
      candidates: [],
    });
  }

  const residual = other.filter(e => !isComplete(e));
  if (residual.length === 0) {
    return decide({
      state: 'all-on-disk-complete',
      spec: null,
      reason:
        'Every spec on disk is Complete. This is NOT necessarily roadmap completion — check ' +
        'decomposition.md for a spec named there with no .spec-workflow/specs/<name>/ directory. ' +
        'Such a spec has not been created yet and is invisible here; it is the next spec, starting at Requirements.',
      candidates: [],
    });
  }

  const started = residual.filter(isStarted);
  if (started.length === 1) {
    return decide({
      state: 'active',
      spec: started[0].name,
      reason:
        `Only started spec not in decomposition.md (${progress(started[0])}). ` +
        'Finishing started work beats beginning unsequenced work.',
      candidates: [],
    });
  }

  if (started.length > 1) {
    return decide({
      state: 'ambiguous',
      spec: null,
      reason:
        `${started.length} specs outside decomposition.md are started and nothing declares their order. ` +
        'Pick one explicitly, or add them to decomposition.md to sequence them.',
      candidates: started.map(label),
    });
  }

  return decide({
    state: 'ambiguous',
    spec: null,
    reason:
      `${residual.length} spec(s) outside decomposition.md are not Complete, none started, and nothing ` +
      'declares their order. Pick one explicitly, or add them to decomposition.md to sequence them.',
    candidates: residual.map(label),
  });
}

/**
 * Flag specs whose tasks.md still has open checkbox lines the parser dropped. Those
 * lines count toward nothing, so such a spec can read Complete while tasks.md still
 * lists open work — the decision above would be made on numbers that do not describe
 * the file. Completed unparsed lines are not counted (see TaskParserResult.summary),
 * so the common "Implementation log" convention does not trip this.
 */
function collectWarnings(entries: SpecIndexEntry[]): string[] {
  return entries
    .filter(e => e.taskProgress.unparsed > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(
      e =>
        `${e.name}: tasks.md has ${e.taskProgress.unparsed} unfinished checkbox line(s) the parser could not ` +
        'read (a task needs a leading number, e.g. "- [ ] 1. Do the thing"). Its progress and status are unreliable.'
    );
}
