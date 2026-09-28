# Retrospective log — tdd-task-loop

## 2026-09-27T20:03:06Z · requirements · v1 · gotcha
Drafter raised RE-DECIDED flags vs decomposition entry 11, for the round-1 reviewer to rule (refinement=closed | widening=MUST_FIX): (1) e2e scenario — an honest author reports the already-met task RED-IMPOSSIBLE so that task never reaches the gate; an in-process gate call proves the vacuous-base fail instead; (2) the proof base is the red commit's parent, not the gate's baseRef. Plus informational flag: D4 counts the author's files for tests-not-touched, so risk comes out lower than today's inputs would give. Lint clean 0/0/0; gate-a surface holds 5 ranked items (posture n/a ranked last, spec touches no money/PII).
Evidence: requirements.md v1; gate-a.json
Cost: drafter spawn (recorded)

## 2026-09-27T20:36:12Z · requirements · v1 · gotcha
Round 1 reviewer: iterate, MUST_FIX 0, SHOULD_FIX 4, MINOR 2, ESCALATE none. Anchors verified, scope matches decomposition spec 11.
Evidence: reviews/adversarial-analysis-requirements.md
Cost: one reviewer spawn

## 2026-09-27T20:57:39Z · requirements · v2 · gotcha
Round 2 reviewer: iterate, MUST_FIX 1, SHOULD_FIX 1, MINOR 2. Both findings fix-induced (R2-1 Compounds R1-6, R2-2 Compounds R1-3); round-1 fixes R1-1/2/4/5 confirmed resolved.
Evidence: reviews/adversarial-analysis-requirements-r2.md
Cost: one reviewer spawn

## 2026-09-27T21:17:08Z · requirements · v3 · gotcha
Round 3 reviewer: iterate, MUST_FIX 0, SHOULD_FIX 1 (R3-1, Recurring/carried: test-author brief lacks channel to spec dir/code root per R2 AC4/AC10), MINOR 1. v3 delta clean, no fix-induced defect. Routes to SHOULD_FIX-only corrective pass.
Evidence: reviews/adversarial-analysis-requirements-r3.md
Cost: one reviewer spawn

## 2026-09-27T21:22:50Z · requirements · v4 · gotcha
Narrow check deferred finding: an undocumented overview-text removal in the v4 diff (decorative alignment prose trimmed to stay under cap), unrelated to R3-1. Not addressed; noted for design phase.
Evidence: reviews/adversarial-analysis-requirements-r4.md
Cost: part of narrow-check spawn

## 2026-09-27T21:26:23Z · requirements · phase · cleanup
requirements approved at v4 after 4 rounds; verdict trajectory 0/4/2 -> 1/1/2 -> 0/1/1 -> SHOULD_FIX-only pass v4, VERIFIED 1/1; rulings 0; cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1790544195669_ni58rvsm6; reviews/adversarial-analysis-requirements-r4.md
Cost: 3 reviewer + 3 reviser + 1 checker spawns

## 2026-09-27T22:10:29Z · design · v1 · gotcha
round 1 design v1: iterate MUST_FIX 0 / SHOULD_FIX 2 / MINOR 4; SHOULD_FIX: Jev answer-extraction wire unprobed/unflagged; Component 13 count-word grep unreliable.
Evidence: reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn

## 2026-09-27T22:10:29Z · design · v1 · ruling
R3 AC4 RE-DECIDED (redTests optional key defaulting to empty string) ruled refinement by round-1 reviewer; closed, not a widening.
Evidence: reviews/adversarial-analysis-design.md
Cost: no extra spawn

## 2026-09-27T22:48:25Z · design · v2 · gotcha
round 2 design v2: CONVERGED MUST_FIX 0 / SHOULD_FIX 0 / MINOR 1 (R2-1 compounding R1-4: testFiles<->tests[] match does not pin path form, fail-open, non-blocking). Both R1 SHOULD_FIX resolved; all four fresh-lens seams pinned both sides.
Evidence: reviews/adversarial-analysis-design-r2.md
Cost: 1 reviewer spawn

## 2026-09-27T22:51:08Z · design · phase · cleanup
design approved at v2 after 2 rounds; verdict trajectory iterate 0/2/4 -> converged 0/0/1; rulings 1 (R3 AC4 ruled refinement); cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1790549338361_1lk95easg; reviews/adversarial-analysis-design-r2.md
Cost: 2 reviewer + 1 reviser spawns

## 2026-09-27T23:34:15Z · tasks · v1 · gotcha
Round 1 converged on v1: MUST_FIX 0 / SHOULD_FIX 0 / MINOR 2. Reviewer verified ~45 code citations at both ends and full coverage (13 design components to 17 tasks, every R1-R9 AC covered). The 39 citation-identifier lint warnings were rejected as a known false-positive class (skip-regex gap on indented _Prompt/_Leverage sub-bullets; deferral d-53b7f443).
Evidence: reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-09-27T23:35:01Z · tasks · phase · cleanup
tasks approved at v1 after 1 round; verdict trajectory converged 0/0/2 (clean first round); rulings 0; cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1790552073258_x9atj9mm4; reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer + 0 reviser spawns

## 2026-09-28T14:48:36Z · implementation · task 1 · gotcha
Gate against pre-implement HEAD picked up all uncommitted spec-store/working-tree noise (38 files); re-gated with commit=<implementer sha> to scope to the single commit. Use commit= per task.
Evidence: task 1; commit 711c546; gate reviewId 81418a81
Cost: 1 implementer spawn, 2 gate calls, 0 fix rounds

## 2026-09-28T14:55:45Z · implementation · task 2 · gotcha
Clean gate-path pass, no fix rounds.
Evidence: task 2; commit 5035827; gate reviewId e5ad926c
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T15:02:46Z · implementation · task 3 · gotcha
Clean gate-path pass, no fix rounds.
Evidence: task 3; commit 53f1b3c; gate reviewId 27d79a75
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T15:06:02Z · implementation · task 4 · gotcha
Docs-only change, gate medium risk, verifier skipped by policy.
Evidence: task 4; commit b4ef274; gate reviewId 197cd1fd
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T15:09:03Z · implementation · task 5 · gotcha
Clean gate-path pass, no fix rounds.
Evidence: task 5; commit 8bed0bb; gate reviewId c40c603f
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T15:19:17Z · implementation · task 6 · tool-error
review-task gate ran its checks in the default root (main checkout on another branch, lacking this branch's changes), so get-task-review.test.ts failed there while green 21x in the worktree. Cost one spurious fix round. Fix: pass root=CODE_ROOT to every gate call. Tasks 1-5 gates likely ran in the main checkout too (checks passed vacuously); task 17 full-suite run is the net.
Evidence: task 6; commit ed69108; gate reviewId c6cf9c8f
Cost: 1 implementer + 1 fix spawn, 3 gate calls

## 2026-09-28T15:36:57Z · implementation · task 7 · gotcha
High risk on line-count only (289>200), verifier passed. Verifier INFO: proveRedGreen 'never throws' not airtight (fs.mkdtemp/mkdir/writeFile outside try can propagate on raw infra fault); task 9 gate caller should guard the call.
Evidence: task 7; commit fedb70f; verifier VERDICT pass
Cost: 1 implementer + 1 verifier spawn, 1 gate call, 0 fix rounds

## 2026-09-28T15:51:32Z · implementation · task 8 · gotcha
Verifier confirmed Jev wire vs @typesafe-ai/sdk v0.6.0. Note: review-task prepare runs against the main checkout (projectPath), so its diff is empty on a worktree branch; verifier read worktree files directly. Same root cause as the gate root issue.
Evidence: task 8; commit 555f8d9; verifier VERDICT pass
Cost: 1 implementer + 1 verifier spawn, 1 gate call, 0 fix rounds

## 2026-09-28T16:13:22Z · implementation · task 9 · gotcha
Sensitive-path high risk, verifier confirmed all 9 critical items (schema-only review-task.ts, no rule-body change, sidecar before review, vacuous-base fail). Verifier INFO: readRequirementCriteria (review-gate.ts:139) matches only N.M ids not bare N; shadow-only, fail-open, unreachable this spec.
Evidence: task 9; commit c1f2dc4; verifier reviewId 6e86d005 VERDICT pass
Cost: 1 implementer + 1 verifier spawn, 1 gate call, 0 fix rounds

## 2026-09-28T16:18:42Z · implementation · task 10 · gotcha
Clean gate-path pass, no fix rounds.
Evidence: task 10; commit f2e332f; gate reviewId 036db598
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T16:23:19Z · implementation · task 11 · gotcha
Clean gate-path pass, no fix rounds.
Evidence: task 11; commit 83b84df; gate reviewId b891b8ec
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T16:29:06Z · implementation · task 12 · gotcha
Clean gate-path pass, dashboard build green, no fix rounds.
Evidence: task 12; commit dde41e2; gate reviewId 13f507f5
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T16:34:37Z · implementation · task 13 · gotcha
Clean gate-path pass; 13th agent registered, plugin validate green.
Evidence: task 13; commit 7512a66; gate reviewId 08439f55
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T16:42:36Z · implementation · task 14 · gotcha
Clean gate-path pass; harness skill loop wired, plugin validate green.
Evidence: task 14; commit 32259fe; gate reviewId 36d8d89f
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T16:51:15Z · implementation · task 15 · gotcha
Clean gate-path pass; two-repo commit (worktree docs + spec-store agent-rules key).
Evidence: task 15; worktree 34ceda2 + spec-store 507339e; gate reviewId 48edf64a
Cost: 1 implementer spawn, 1 gate call, 0 fix rounds

## 2026-09-28T17:04:59Z · implementation · task 16 · gotcha
Verification-only task (no CODE_ROOT paths), no gate/verifier per policy; fixture kit dry-run 11/11 green on built server; verification-evidence.md carries 3 pending live lines (9.1, 9.3, 9.5) for operator. reviewCoverage will read below total for this task by policy.
Evidence: task 16; commit 4fd7174; dry-run 11/11 green
Cost: 1 implementer spawn, 0 gate, 0 fix rounds

## 2026-09-28T17:11:57Z · implementation · task 17 · bug
End-to-end npm test caught a regression: task 13 added sdd-test-author (13th profile) but the count assertion src/watch/__tests__/ledger.test.ts:103 toHaveLength(12) was outside task 13's grep list and never updated, so npm test failed 1/1596. Fixed inline as an e2e-gate fix.
Evidence: task 17 e2e; task 13 commit 7512a66; ledger.test.ts:103
Cost: 1 verifier + 1 fix implementer spawn

## 2026-09-28T17:15:53Z · implementation · phase · cleanup
17/17 tasks implemented; 2 verifier reviews (tasks 7, 9 high-risk line-count/sensitive-path), 13 gate-path completions, 0 adjudications; 1 gate fix round (task 6, gate ran in wrong tree — root fix), 1 e2e fix round (task 13 count miss). 1 deferral added (d-53b7f443). Live verification 9.1/9.3/9.5 pending via verification-evidence.md.
Evidence: PR #72; logCoverage 17/17; reviewCoverage 15/17 (16,17 verification-only)
Cost: 17 implementer + 3 verifier + 2 fix spawns; ~19 gate calls
