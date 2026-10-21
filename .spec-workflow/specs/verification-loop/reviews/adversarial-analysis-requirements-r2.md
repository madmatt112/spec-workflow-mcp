# Adversarial Analysis — verification-loop/requirements (v2, round 2)

Reviewed v2 against the real code under the worktree. **Deltas first** (the eight
round-1 fixes R1-1…R1-8 the Revision History records), then one **fresh lens the
prior round did not use: idempotency / re-entry across a mid-gate wait**. Primary
surface: completeness, ambiguity, scope.

## Deltas since d606690 — verified clean (fix-induced re-check)

Every past-spec round-2 MUST_FIX was a claim error the previous delta wrote, so I
scoped each v2 fix to its own diff against the requirement it had to satisfy.

- **R1-1 (R2 AC7, line 49).** Now reads the Sonnet route from the `sdd-test-author`
  profile entry, `harness/agent-profiles.json:50-55`. Verified: lines 50-55 are
  exactly that entry — `model: claude-sonnet-5`, `effort: high`. "No new key, so the
  ten-key / frontmatter / byte-for-byte pins stay green" is correct (the file holds
  the same 10 keys). The intended re-tier coupling is now stated. Accurate.
- **R1-2 (R1 AC1/AC8, lines 21, 28).** Now requires the merge evaluation to tag each
  blocking reason with a kind (`check`, `conflict`, `trailer`, `head`, `other`) "from
  the signals it already computes (`merge.ts:361-405`)." Verified at both ends: each
  settled blocking reason is pushed at a push site that already knows its kind —
  failed workflow/status → `ciFailed` (`merge.ts:362,370`), `mergeable` not MERGEABLE
  → `merge.ts:390`, head mismatch → `:394`, attribution → `:400,404`. The kind is
  positional, not a text re-parse, so the claim is implementable, not false. AC1
  ("every reason is check/conflict") and AC8 ("any reason is trailer/head/other") are
  complementary and jointly exhaustive over the five kinds — no gap, no live
  double-cover. This closes round-1 R1-2.
- **R1-3 (R2 AC10, line 52).** R3's security fix rounds added to the Opus-profile
  non-task list. Accurate; matches R3 AC6's new step.
- **R1-4 (R1 AC5, line 25).** INFRA round now sets `merging` + re-check; citation
  `implementation.ts:1143-1148` still names the re-run loop (verified `:1146`). Accurate.
- **R1-5 (R2 AC8, line 50).** Effort scoped to `spawn.start`, model to both rows.
  Verified against `ledger.ts:130-143`: `spawnEnd` writes `model` (`:141`), no
  `effort`; `spawnStart` writes both (`:128`). `stepUsage` reads the profile today
  (`implementation.ts:375,377`). The claim is exact.
- **R1-6 (R3 AC9, line 69).** `abandon` clause added, self-consistent with AC8's
  option set.
- **R1-7 (R4 AC1, line 81).** Merge-base basis stated.
- **R1-8 (Alignment, line 9).** R4 mapped to grill decision 1.

No misstated artifact in any delta → **no delta-induced MUST_FIX**.

## Topic 1 — R3's completion-gate re-entry does not guard the e2e verification that gates the security pass (fresh lens: idempotency / re-entry)

R3 inserts a security pass "after the end-to-end verification … passes
(`implementation.ts:884-911`) … before the HANDOFF write and the push" (AC1), and
that pass can open an `escalation` wait (AC8) that **stops the run mid-gate**, after
up to two security fix rounds that **commit code** (AC6). AC13 guards re-entry — but
only for the pass itself: *"A re-entry … after a completed security pass, or after an
`accept` answer, SHALL NOT run the pass again; the state SHALL be read from this run's
ledger."*

- Challenge the claim that AC13 makes the gate idempotent. The completion gate is
  re-entered from the top on every resume: the phase does `return completionGate()`
  (`implementation.ts:517`) and the e2e loop at `:884-911` is **unconditional** — it
  has no ledger guard and re-spawns `verifyEndToEnd` (a full `sdd-verifier` step,
  `:958-980`) every entry. `prChecksGate`'s existing waits already prove this is the
  status quo (e2e re-runs before the gate reaches `:945`). AC13 guards the pass but is
  silent on the e2e step that AC1 makes its precondition.
- Stress-test the `accept` path. On `accept`, AC13 says "continue to the HANDOFF write
  and the push without running the pass again." But re-entry restarts at `:884`, so
  the gate **re-runs e2e before it can consult the ledger to skip the pass**. The
  security fix rounds (AC6) changed the code *after* the last e2e pass, so this re-run
  is against new code and can legitimately **fail** → the run falls into repair rounds
  (`:908-910`) and never reaches the skip-the-pass logic. The operator's `accept` is
  stranded until e2e passes again. AC13's "continue to HANDOFF" cannot be honored as
  written.
- Stress-test the `retry` path. AC9 says "the pass and its rounds SHALL run again from
  round 1," while AC13 says state is read from the ledger — which still holds the
  AC12 `note` rows from the first two rounds. Nothing says what `retry` resets, nor
  whether e2e re-runs before the retried pass. An implementer cannot tell whether the
  round counter is cleared, epoch-keyed, or ignored.
- Failure scenario: operator answers `accept` on the escalation wait; the gate
  re-enters, re-spawns e2e against the post-security-fix tree, e2e flips to fail, the
  run burns repair rounds and re-opens a `verify-failed`/`error` wait instead of
  writing HANDOFF — the opposite of what `accept` promised, and a second full verifier
  spawn the operator did not expect.
- **Fix:** state the gate's resume contract across the security wait — whether the
  e2e pass is read from the ledger (not re-run) on `accept`/`retry`/restart, and what
  `retry` resets — so AC13's "continue to HANDOFF" and AC9's "from round 1" are
  implementable without re-running e2e at `:884`. **SHOULD_FIX. Novel; carried (the
  gap is in R3 AC1/AC9/AC13, text the v2 delta did not touch).**

## What's fine (checked, moving on)

- **Round-1 R1-1 and R1-2 are genuinely closed**, not deferred wrong — the two the
  memory flagged as most at risk. AC7 names a concrete existing key; AC1 requires a
  structured kind sourced positionally from code that already distinguishes them.
- **AC1's `conflict` = `mergeable` is `CONFLICTING` is conservative and correct.**
  `merge.ts:389` emits "not mergeable" for any non-MERGEABLE/non-UNKNOWN value;
  tagging only CONFLICTING as `conflict` routes any exotic value to `other` → AC8's
  no-fix-round wait, which is the safe default. Not a defect.
- **R4 AC1's "(the merge-base basis of R3 AC 3)"** is loosely imprecise — R3 AC3 says
  "merge base with the default branch," R4 says "merge base of the head and the PR's
  base branch" (they diverge only for a close-out PR, where R4's generalisation is the
  correct one). The R4 text itself is right; the cross-reference is a wording nicety,
  not a gap. Not counted.
- **Delta citations** `merge.ts:361-405`, `agent-profiles.json:50-55`,
  `ledger.ts:130-143`, `implementation.ts:371-381`, `merge.ts:568-583` all read as
  stated. v1's verified citations were not re-walked (memory guidance), and the
  reviser did not alter them.

## Top 3 conclusions to challenge or reverse

1. **"AC13 makes the security sub-process re-entry-safe" is false.** It guards the
   pass but not the e2e step (`:884-911`, unconditional) that AC1 gates it behind; the
   `accept` and `retry` paths both re-run e2e against post-fix code.
2. **"`retry` runs from round 1" is under-determined** against AC13's ledger-read:
   nothing says what resets the AC12 round `note` rows.
3. The two round-1 structural risks (Sonnet-route source, reason-kind source) are now
   sound — the loop should close on the R3 re-entry contract, not re-litigate R2/R1.

## What is missing before design

- The completion gate's resume contract across the new mid-gate security wait: e2e not
  re-run (read from ledger) on `accept`/`retry`/restart, and what `retry` resets.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
