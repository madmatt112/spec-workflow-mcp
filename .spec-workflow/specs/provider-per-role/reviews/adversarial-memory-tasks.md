# Adversarial Review Memory — tasks

Last updated: 2026-09-22 (round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1 pending reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — Dependency-order paragraph (`tasks.md:9`) claims a failed
  proof/unset key "halts the spec there," but the halt (`PHASE: escalate`) needs task 3's
  escalate branch, which is not loaded until a session restart after task 3; task 1
  precedes task 3. In the run that builds this spec a failed preflight (a) does not halt —
  the orchestrator logs `RETRO: escalation`, gates task 1 `[x]`, and proceeds to tasks
  2-9. Scope note (`:117`)/D6 admit the branch is inactive this run but the guarantee is
  still stated as automatic. Fix: state the human-mediated current-run behaviour.
- **R1-2 (SHOULD_FIX)** — D5's premise that a named task 10 makes "the verifier brief
  carry the corrected outcomes" is unfounded. The completion gate
  (`sdd-implementation-phase/SKILL.md:186-205`) greps the decomposition; the e2e brief
  inserts it verbatim (`sdd-implementation-phase/references/briefs.md:177-181`). The
  decomposition scenario is stale (scenario 4 "with a note"; launcher "--model the
  DeepSeek name" — `decomposition.md:344,346,383-384`), so the step-8 verifier tests
  superseded outcomes and can VERIFY: fail a correct build, while task 10's corrected
  scenarios go unrun. Compounding: task 10 is verification-only (`File: none`), so per
  `SKILL.md:106-109` no verifier is spawned and the orchestrator only "runs its check
  commands" and marks `outcome=gate` — yet task 10's prompt emits `VERIFY:` + a
  `verification` deferral, which no agent executes.
- **R1-3 (MINOR)** — Req 3.5, Req 4.1, Req 4.5 map to no task's `_Requirements:` list;
  enforced via restrictions/regression but not criterion-auditable.
- **R1-4 (MINOR)** — Task 1's direct-body run names only 4 of the 9 `SDD_*` exports the
  body reads (design `launch.sh` block, `design.md:112-123`).

## Patterns & Themes

- **The drafter mis-models how the *running* session's loaded skills interact with the
  tasks.** R1-1 and R1-2 both fail on the same axis: a harness mechanism the tasks doc
  relies on (task 3's escalate branch; task 10 feeding the e2e verifier) is not actually
  wired the way the doc claims for the run that executes these tasks. Skills/agents load
  at session start; edits by an earlier task do not take effect mid-run; the completion
  gate reads the decomposition, not the tasks file. Future rounds should keep testing
  every claim of the form "task N halts / feeds / changes what a later step sees" against
  the *installed* skill text, not the post-spec state.
- Citation hygiene is strong: every artifact path/range/behaviour the tasks doc states is
  accurate, including the two lint-corrected citations (briefs.md:125-197,
  formats.md:5-17). No misstated-artifact MUST_FIX.
- Coverage of components (8/8) and requirement IDs is essentially complete; the only gaps
  are three negative-constraint criteria (R1-3).

## Guidance for Next Review

- Re-check R1-1: does the revision reconcile the "halts" claim with the current-run
  reality (human-mediated stop, or task 2's missing-body natural stop for the unset-key
  case only)? Do not accept a wording that still implies an automatic halt in this run.
- Re-check R1-2 hardest: the fix must produce a real path from task 10's corrected
  scenarios to the step-8 `## Scenario (from the decomposition entry)` slot, OR give task
  10 a `File:` so it is a normally-gated task; and it must reconcile the
  `VERIFY:`/deferral contract with the `outcome=gate` marking. Reject a fix that only
  reworded D5 without wiring the mechanism.
- Closed by ruling this spec — do not re-open: Req 2 crit 5 (`--agents` `model` = request
  alias, effort from profiles); Req 2 crit 7 (`--add-dir` when store repo outside code
  root); R2-1 (compare-mode provider-pair placement left to implementation; task 7/D3 put
  it at end-of-line after the delta text).
- Task 1 is intentionally large (body + live preflight + doc); D1 justified the bundle
  against Req 6 crit 1. Do not re-raise the split as blocking.
