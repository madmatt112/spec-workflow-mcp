# Retrospective plan — decisions-and-launch-guard

Status: APPROVED
Date: 2026-11-08

## Approved proposals

- **P1 (F1) — Clean implementation needs no change.** 23 tasks closed first-spawn with
  no re-opened round; record it as a healthy baseline, not a defect. No rule, eval or code
  touches this.
  Target: none.
  Effort: S. Risk: low: nothing changes.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — Red-impossible regression guards need no change.** Both guards were written
  up front per retro P10, already codified in agent-rules ("Fixtures and live verification",
  implementer-only / guard routing) and exercised by the `guard-task-no-red-step` eval.
  Target: none.
  Effort: S. Risk: low: existing rule and eval already cover it.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — Final task resolving four foreign deferrals needs no change.** Folding
  sweep-and-resolve of dashboard-board deferrals into task 23 is the intended close-out
  path and cost one implementer spawn. Leave as is.
  Target: none.
  Effort: S. Risk: low: no behaviour to alter.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — Reused-branch discard bug needs no further change.** The `branchReused`
  guard landed in the design round before ship and is the smallest fix for the Req 9 AC6
  hole. Confirm an existing test asserts a non-live reuser's discard does not delete the
  branch or close the PR; if absent, add that one regression test.
  Target: product code.
  Effort: S. Risk: low: fix already in; only a test-coverage check remains.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — Relocate worktree deferrals at the merge gate.** d-131803a4 was created in
  the worktree `.spec-workflow/deferrals/` but never committed or moved to the main store,
  so the index shows 0 for this spec. agent-rules already has the orchestrator relocate
  verification artifacts at the merge gate; extend that same step to sweep the worktree's
  `.spec-workflow/deferrals/` for records absent from the main store and relocate them,
  then re-run the "deferrals added" count after the sweep.
  Target: harness skills (implementation / merge-gate orchestrator).
  Effort: M. Risk: low: additive sweep; a duplicate id is a no-op copy.
  Prerequisites: none.
  Eval case: `orchestrator-relocates-worktree-deferrals` — grader seeds a new deferral
  file only in the worktree store and checks the merge-gate step copies it to the main
  store and the post-sweep count reflects it.
  DECISION NEEDED: no.

- **P6 (F6) — Hold the retro open until verification-evidence has no `pending` line.**
  agent-rules says every verification-evidence line must read `passed` before the
  retrospective opens, run by an operator in a restarted session; yet PR #210 merged and
  the retro opened with scenarios 1 and 6 still `pending`. The merge itself is allowed
  (the operator run is session-restarted), but the retro should not have opened. Close the
  gap at the retro-open gate.
  Target: harness skills (completion / retro-open gate).
  Effort: M. Risk: medium: a mis-set gate could stall a spec whose operator run is
  legitimately owed.
  Prerequisites: none.
  Eval case: `retro-gate-blocks-pending-verification` — grader supplies a
  verification-evidence.md with one `pending` line and checks the retro-open gate refuses
  and names the pending scenario.
  DECISION NEEDED: yes. What should the gate do when verification-evidence still has a
  `pending` line at retro-open?
  - Option A (recommended): block retro-open and surface the owed operator run as a
    wait-on-operator; merge still proceeds, retro waits for the `passed` lines.
  - Option B: allow retro-open but auto-file a tracked deferral for each `pending`
    scenario so the owed run is not lost.
  - Option C: keep today's behaviour (retro opens; evidence file tracks the debt) and
    only louden the compiler note.

- **P7 (F7) — Gate-only verifier-skipped tail needs no change.** Five tasks taking the
  gate alone is the agent-rules routing (decision C), planned not discovered, saving ~5
  verifier spawns. See P11 for the one part that is a genuine deviation (mid-spec task 14).
  Target: none.
  Effort: S. Risk: low: intended routing.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — Two guard-only author spawns need no change.** Tasks 1 and 12 each spent one
  test-author spawn to write a green named guard per P10; that is the intended handling and
  the cost (2 spawns, no aborted author) is negligible. The implementer-only routing already
  exists for tasks whose *every* AC is a guard; these were decomposed as TDD and the guard
  was written cleanly, so no rule change buys anything.
  Target: none.
  Effort: S. Risk: low: no aborted work occurred.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — "Operator-reported defects" wording needs no change.** The intro overclaim
  (items 4–5 were retro decisions, not operator reports) was caught and reworded in the
  requirements review. The review did its job; nothing to add.
  Target: none.
  Effort: S. Risk: low: already corrected.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P10 (F10) — SHOULD_FIX all resolved in-round needs no change.** Three findings fixed and
  verified `converged` by r2 with no escalation is the review loop working. Positive signal.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P11 (F11) — A mid-spec implementer-only task must still take a gate review.** agent-rules
  decision C allows the N−1 review-coverage skip for the *final* task only; here the
  completion gate closed coverage at 21/23, skipping review on task 14 (mid-spec,
  implementer-only) as well as task 23 (final). Tighten the gate so the N−1 allowance binds
  only to the final task; a mid-spec implementer-only task still takes the gate review
  (verifier may be skipped), so coverage would read 22/23.
  Target: harness skills (completion gate) and agent-rules (clarify scope).
  Effort: M. Risk: medium: over-tightening could re-require a verifier where only a gate
  review is intended.
  Prerequisites: none.
  Eval case: `completion-gate-midspec-review-required` — grader presents a spec with one
  mid-spec implementer-only task unreviewed and checks the gate does not merge until that
  task has a gate review, while still allowing the final task's N−1 skip.
  DECISION NEEDED: yes. How should a mid-spec implementer-only task be covered?
  - Option A (recommended): require a gate review on it (counted in coverage), verifier
    skipped — the final-task N−1 skip does not extend to it.
  - Option B: allow the skip but decomposition must pre-declare each mid-spec
    implementer-only task so the gate expects the lower coverage (N−k planned, not a
    surprise).
  - Option C: no change — accept mid-spec gate-only tasks as the compiler finding already
    surfaces them.

- **P12 (F12) — Reviser ruling on R1-5 needs no change.** Closing an illustrative
  close-out reference as a ruling at design r2 (not re-opening) is within the reviser's
  remit and cost nothing. Leave as is.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P13 (F13) — Gate A single-option posture needs no change.** The n/a money/
  personal-data/legal option carried a harness `basis` checking all eleven items; a
  single justified option with a recorded basis is the designed behaviour for a spec with
  no such surface, not a decision silently taken from the operator. Keep it; the basis is
  the audit trail.
  Target: none.
  Effort: S. Risk: low: basis already records the reasoning.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P14 (F14) — Merge-past-coverage under decision C needs no change.** The standing
  decision correctly fired without a prompt for the *final* task. The one over-reach (it
  also covered mid-spec task 14) is handled by P11; decision C itself is sound.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

## Decisions

- P6: What should the gate do when verification-evidence still has a `pending` line at retro-open? → block retro-open and surface the owed operator run as a wait-on-operator; merge still proceeds, retro waits for the `passed` lines.
- P11: How should a mid-spec implementer-only task be covered? → require a gate review on it (counted in coverage), verifier skipped — the final-task N−1 skip does not extend to it.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P1: skipped — no change chosen
- P2: skipped — no change chosen
- P3: skipped — no change chosen
- P7: skipped — no change chosen
- P8: skipped — no change chosen
- P9: skipped — no change chosen
- P10: skipped — no change chosen
- P12: skipped — no change chosen
- P13: skipped — no change chosen
- P14: skipped — no change chosen
- P11: to-do (human) — Core change is the completion-gate behavior plus the eval harness/evals/completion-gate-midspec-review-required/, both outside .spec-workflow; needs the worktree/CI spec flow, not a direct main commit. agent-rules.md:214 still states the Option-C 'surfaces as a finding' behavior the recorded Option-A decision supersedes, so a partial agent-rules-only edit would assert a rule the gate code does not enforce.
- P5: skipped — file-outside-list fail on .spec-workflow/agent-rules.md, which is genuinely required — the merge-gate relocation rule this item extends lives only there; no committed harness orchestrator skill exists (orchestrator under ~/.claude, uncommitted; precedent dashboard-board P9). Sweep already committed in 182650b6; per the file-outside-list rule I did not re-commit the unchanged tree and did not revert. REQUIRED: add .spec-workflow/agent-rules.md to P5's allowed files and rerun the gate on commit 182650b6.
- P6: done — 7ae573d94b4205488b8e3c956d410a7f8e977faa
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/211
