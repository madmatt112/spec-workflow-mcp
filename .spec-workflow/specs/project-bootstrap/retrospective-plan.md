# Retrospective plan — project-bootstrap

Status: APPROVED
Date: 2026-10-21

## Approved proposals

- **P1 (F1) — doctor's gh check reads node-20 callback fields directly.**
  No change. The token check classifies `killed`/`code`/`ENOENT` straight off the
  execFile callback (per design D10) rather than through `runCommand`, precisely to
  stay on fields the node-20 docs guarantee. This is the node-20 field-discipline
  clause (agent-rules.md lines 36-38) applied correctly, not a defect; it recurs
  because the CI/local node split is real and permanent.
  Target: product code (no change).
  Effort: S. Risk: low: nothing to do.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — expandTilde copied into the cli module to keep the parser pure.**
  No change. `parseInitArgs`/`parseDoctorArgs` do no I/O and are not exported from
  index.ts; duplicating the one-line tilde helper kept them side-effect-free and
  import-free, which is the simpler of the two options. A shared import would drag an
  I/O-capable module into a pure parser for no gain. Trivial, once, no repeat.
  Target: product code (no change).
  Effort: S. Risk: low: nothing to do.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — spawn.start outnumbers spawn.end/spawn.usage by one (47 vs 46).**
  No change. The ledger is a floor, not an exact total; one spawn's end/usage going
  unobserved is exactly what the floor caveat in agent-rules.md (lines 109-116)
  warns about, and both the retro log and HANDOFF already read 46 as a floor. No run
  impact. The only risk is a future reader treating spawn accounting as exact, which
  the existing caveat already forbids.
  Target: harness agent-rules (no change; already covered).
  Effort: S. Risk: low: nothing to do.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — requirements v2 carried an unreachable IF-clause tying `--host` to the
  resolved URL host.** No change to process. The false parenthetical ("because the
  dashboard was bound with a non-localhost `--host`") was caught as R2-1 MUST_FIX and
  reframed to "loopback by construction" in v3. This is the adversarial requirements
  loop doing its job: a reasoning defect caught before implementation at the cost of
  one extra round. One round is the expected price of catching it; no rule prevents a
  branch-reachability slip earlier without adding review weight that would cost more
  than it saves.
  Target: harness document loop (no change).
  Effort: S. Risk: low: nothing to do.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — tasks 6 and 9 drew a verifier review though the gate labelled them risk
  low.** The verifier fired on 6,7,8,9 while the gate notes read "risk low" for 6 and
  9. The likely cause is the new-module structural-red → high-risk → verifier default
  (agent-rules.md lines 167-169) overriding the low gate label, and the tasks-phase
  decomposition not stating the expected verifier count up front — which the same
  clause already requires for an all-new-module phase. So the governing rule exists;
  this run did not apply its "state the expected verifier count up front" half. The
  smallest fix is a compliance reminder, not new rule text. But the gate label and the
  routing disagreeing is worth a human read.
  Target: project decomposition conventions / harness tasks phase.
  Effort: S. Risk: low: a reminder or a label fix, both local.
  Prerequisites: none.
  DECISION NEEDED: yes. When a new-module TDD phase routes tasks to the verifier by
  structural-red default, should the gate's per-task risk label and the planned
  verifier count be reconciled so the spend is never a surprise?
  - Option A: No change — the rule already requires the up-front count; treat this as a
    one-time decomposition miss and move on. (recommended)
  - Option B: Add a tasks-phase check that fails decomposition if an all-new-module
    phase omits the expected verifier count.
  - Option C: Make the gate label new-module structural-red tasks "high" so the label
    and the routing agree, and the "risk low" note can never appear.

- **P6 (F6) — the exit-2 remedy line is imprecise for a LAN-only dashboard bind.**
  When the dashboard is bound to a specific non-loopback interface (`--host
  192.168.1.5`), the session file still records `http://localhost:`, init's POST is
  refused, and exit 2 points the operator at `scripts/sdd-service.sh install` though
  the controller is already running. It was accepted knowingly as an out-of-scope
  MINOR; the smallest honest fix is a one-line reword of the exit-2 remedy to name the
  bind-interface case as an alternative cause. Wording-only, product code.
  Target: product code (init exit-2 failure message).
  Effort: S. Risk: low: message text only, no behaviour change.
  Prerequisites: none.
  DECISION NEEDED: no. (Reword the remedy line in a later touch of that module; not
  worth a dedicated change now.)

- **P7 (F7) — the adversarial reviewer reversed its own prior finding against ground
  truth.** No change. The reviewer re-checked each prior SHOULD_FIX/MUST_FIX against
  the fix diff and the cited source lines before converging, rather than re-raising,
  giving clean convergence at 3/2/2 rounds. This is the desired behaviour; record it
  as evidence the fix-induced re-check in the reviewer prompt is working. Nothing to
  propose.
  Target: harness reviewer (no change; working as intended).
  Effort: S. Risk: low: nothing to do.
  Prerequisites: none.
  DECISION NEEDED: no.

## Decisions

- P5: When a new-module TDD phase routes tasks to the verifier by structural-red default, should the gate's per-task risk label and the planned verifier count be reconciled so the spend is never a surprise? → No change — the rule already requires the up-front count; treat this as a one-time decomposition miss and move on. (recommended)

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P1: skipped — no change chosen
- P2: skipped — no change chosen
- P3: skipped — no change chosen
- P4: skipped — no change chosen
- P7: skipped — no change chosen
- P5: skipped — Option A (no change) chosen in plan Decisions; rule already requires up-front verifier count, one-time decomposition miss
