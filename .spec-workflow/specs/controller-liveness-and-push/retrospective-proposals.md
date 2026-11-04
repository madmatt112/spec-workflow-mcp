# Retrospective proposals — controller-liveness-and-push

Written 2026-11-04 by the retro analyst

This was a clean run (15 tasks, 0 in-loop fix rounds, 0 escalations). Most findings
are recurring harness/test-fixture patterns, not new defects, so most proposals are
small or no-change, with the systemic fixes carried to `## Graduation candidates`.

## Proposals

- **P1 (F1) — Commit a reusable malformed-stream stub.** Add one small committed test
  helper (or a `RAW_STDOUT` env mode on the existing headless stub) that echoes exact
  bytes — blank, non-JSON, scalar, and no-trailing-newline lines — so stream
  line-parser red tests reuse it instead of minting a throwaway script in `mkdtemp`.
  Target: server code (test helper under `src/advisor/__tests__/helpers/` or `scripts/`).
  Effort: S. Risk: low: test-only, no product code, no runner change.
  Prerequisites: none.
  Eval case: none — a test helper is exercised by the vitest suite that consumes it,
  not by a harness grader; its correctness is proven by the red tests it enables.
  DECISION NEEDED: no.

- **P2 (F2) — No further code change; graduate the deadline rule.** The landed widening
  (15000/20000 ms, commit a62990c0) removes this spec's flake and passing runs still
  finish in ~600 ms, so no more product or test change is needed here. The real cause —
  a `waitFor` deadline sized on local node 24 that starves under the node-20 2-core
  parallel CI suite — is a cross-spec pattern; see G1.
  Target: none for this spec (systemic fix in G1).
  Effort: S. Risk: low: deadline-only, no behaviour change.
  Prerequisites: none.
  Eval case: none — the fix is a test-timing constant, not harness-graded behaviour.
  DECISION NEEDED: no.

- **P3 (F3) — No change; the existing rules already covered it.** The author caught the
  mislabel by running the sub-case red, exactly as the "name each sub-case / mark a
  base-held one a regression guard" rule (agent-rules.md, Documents) and
  `tdd-regression-guard` intend. This is one instance of the F4 pattern, not a separate
  defect; the systemic question lives in P4.
  Target: none.
  Effort: S. Risk: low: no change proposed.
  Prerequisites: none.
  Eval case: none — no change.
  DECISION NEEDED: no.

- **P4 (F4) — Decide how to curb recurring red-impossible / guard discovery.** Three of
  15 tasks (stub limit F1, kill-retry already held at base, one guarded sub-case F3) hit
  red-impossible mid-run and cost extra author reasoning, despite `tdd-regression-guard`
  and the sub-case rule. The gap is the *mixed* task: some sub-cases are genuinely red,
  others hold at base or cannot be driven red (unwired seam, stub limit), and that
  per-AC status is only discovered when the test author runs. The whole-task guard rule
  already routes all-guard tasks implementer-only; it does not label per-AC status inside
  a mixed task.
  Target: harness skills or agents (tasks-phase decomposition + review) / project
  decomposition conventions.
  Effort: M. Risk: medium: a per-AC red/guard annotation adds decomposition work and
  could misfire if the base state is mis-predicted.
  Prerequisites: none.
  Eval case: tasks-phase-review case — grader checks a mixed task's Success line carries
  a per-sub-case red/guard/unwired tag and the review rejects one that omits it.
  DECISION NEEDED: yes. The `tdd-regression-guard` rule exists yet the pattern persists
  across ~9 specs; how much more should we invest?
  - Option A: Accept as inherent TDD cost — author reasoning, no fix rounds, is cheap;
    change nothing.
  - Option B (recommended): Extend the tasks-phase decomposition to tag each sub-case of
    a mixed task as red / regression-guard / unwired-seam up front, and have the
    tasks-phase review reject an untagged mixed Success line. Removes the mid-run
    discovery without new tooling.
  - Option C: Build a pre-run base-state probe (run each red test at base in CI) to
    auto-classify ACs — most thorough, highest build and spend cost.

- **P5 (F5) — No change; designed behaviour worked.** The implementer WebFetched
  docs.ntfy.sh to confirm the `Authorization: Bearer` / `Title` / `Priority` / 4096-byte
  contract before wiring the POST and was built to escalate on disagreement; it found
  none. This is the build-to-escalate path behaving correctly, at a cost of one WebFetch.
  Target: none.
  Effort: S. Risk: low: no change proposed.
  Prerequisites: none.
  Eval case: none — no change.
  DECISION NEEDED: no.

- **P6 (F6) — No change; the design review self-corrected well.** Design v3 loosened the
  token-redaction predicate (redact on `/` OR a file extension) so `notify.json` redacts
  in startup logs, and the v3 Revision History fixed the understated R1-1 disposition.
  This is the adversarial design review doing its job; no process defect to remove.
  Target: none.
  Effort: S. Risk: low: no change proposed.
  Prerequisites: none.
  Eval case: none — no change.
  DECISION NEEDED: no.

## Graduation candidates

- **node-20 CI `waitFor` deadline sizing** (F2 here; also review-gate F1,
  project-bootstrap F1, harness-control-pane F7/F13, dashboard-loop-views F6 — 6 specs).
  Rule text, for agent-rules.md under **Checks** (after the node-20 paragraph):
  "A `waitFor`/polling deadline that fences an async chain (a watch firing, a fetch +
  retry, an appended event) is sized for the node-20 2-core parallel CI suite, not local
  node 24: budget it at least 3× the observed local pass time, or draw it from one shared
  `CI_WAIT_MS` constant. A deadline that passes locally but can starve under the full
  parallel suite is a flake, not a pass."

- **per-sub-case red/guard status of a mixed task** (F3/F4 here; also advisor F12,
  lean-orchestrators F9, tdd-task-loop F3, verification-loop F1/F5, run-pause F6,
  harness-control-pane F9, dashboard-loop-views F10, harness-evals F7 — 9 specs). Listed
  as a candidate only if P4 adopts Option B/C; the current `tdd-regression-guard` and
  whole-task-guard rules already cover the all-guard case, so this graduates the *mixed*
  case. Rule text, for agent-rules.md under **Documents** (extending the sub-case rule):
  "In a task whose sub-cases mix genuinely-red behaviour with behaviour that holds at
  base or cannot yet be driven red (unwired seam, stub limitation), the Success line
  tags each sub-case red / regression-guard / unwired-seam. The tasks-phase review
  rejects a mixed Success line that leaves any sub-case untagged, so the test author
  never discovers the split by running."
