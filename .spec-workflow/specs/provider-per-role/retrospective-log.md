# Retrospective log — provider-per-role

## 2026-09-22T15:37:11Z · requirements · v2 · gotcha
Round 1 (first review of this doc, post-gate-A v2): iterate MUST_FIX 1 / SHOULD_FIX 6 / MINOR 2. MUST_FIX is a D2/D5 decision-log contradiction the gate-A delta did not propagate; SHOULD_FIX cluster on refusal ordering, model mapping, launch values, worktree-cwd premise, agent-profiles rationale.
Evidence: adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-09-22T16:01:30Z · requirements · v3 · gotcha
Round 2 on v3: iterate MUST_FIX 1 / SHOULD_FIX 1 / MINOR 2. R2-1 is fix-induced (Compounds R1-2): the round-1 alias fix left the response model field unsettled between the requested claude-* alias and the DeepSeek message.model requirement, and preflight (a) does not gate it. No rejections either round.
Evidence: adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn

## 2026-09-22T16:38:57Z · requirements · v4 · inefficiency
Round 3 on v4: iterate MUST_FIX 1 / SHOULD_FIX 1. Both findings compound the previous delta: R3-1 (fix-induced, Compounds R2-1) and R3-2 (Recurring, Compounds R2-2) — the R2-1 seam settlement and R2-2 wording did not fully land. D=4 with MUST_FIX flat (1->1 across r2->r3), so cap-convergence extra round not granted; going to post-cap corrective pass.
Evidence: adversarial-analysis-requirements-r3.md
Cost: 1 reviewer spawn

## 2026-09-22T16:46:10Z · requirements · v5 · inefficiency
Cap hit at v4 (D>=4 iterate, MUST_FIX flat r2->r3). Post-cap corrective pass adjudicated the two open items into v5: R3-1 (MUST_FIX) fixed — preflight (a) now runs the launcher's own claude-* alias and gives message.model one checkable expectation, Req 7 crit 1 checks spawn.start and spawn.end separately; R3-2 (SHOULD_FIX) fixed — launcher-critical probes given defined pass/fail consequences. No SHOULD_FIX ruled out; no carried items. Adjudicator flagged a MINOR out-of-scope stale CLI version citation (Req 2 crit 5 says 2.1.278; installed 2.1.280), left for a later phase.
Evidence: adversarial-analysis-requirements-r3.md; requirements.md v5
Cost: 1 adjudicator spawn

## 2026-09-22T16:48:00Z · requirements · v5 · gotcha
Narrow check verified 2/2 (R3-1, R3-2 both addressed in v5). One deferred finding: Req 6 crit 5's auth-path clause is grammatically garbled — the intended rule (a 'no' answer fails preflight (a)) is inferable but the sentence does not parse cleanly. MINOR wording; approval follows the narrow check. Carry to design drafter as a note if it reads the criterion verbatim.
Evidence: adversarial-analysis-requirements-r4.md
Cost: no extra spawn (deferred, not fixed)

## 2026-09-22T16:49:34Z · requirements · phase · cleanup
requirements approved at v5 after 4 rounds; verdict trajectory 1/6/2 -> 1/1/2 -> 1/1/0 -> post-cap adjudicated v5 (VERIFIED 2/2); rulings 0; cap hit (carried: none); prune removed 0 records and 0 snapshots. This was a revision-mode run applying the Gate A answers (refused-at-start run writes no ledger row); v1 was drafted+linted pre-gate and never reviewed.
Evidence: approval_1790095689366_qb203yqs4; reviews/adversarial-analysis-requirements-r3.md; reviews/adversarial-analysis-requirements-r4.md
Cost: 4 reviewer (3 adversarial + 1 narrow-check) + 4 reviser (v2 revision, v3, v4, v4-lint) spawns, 1 adjudicator

## 2026-09-22T17:46:10Z · design · v1 · ruling
Reviewer ruled both drafter RE-DECIDED literals as refinement (closed): Req 2 crit 5 (D4) — the --agents JSON model key carries the request alias, not the profile's declared model; effort still comes from the profiles. Req 2 crit 7 (D9) — --add-dir is passed when the spec store repo is outside the code root. Both are refinements of the requirement, not widenings; carry to the tasks drafter so it does not re-flag them.
Evidence: reviews/adversarial-analysis-design.md
Cost: no extra spawn (ruled inside round 1)

## 2026-09-22T17:46:10Z · design · v1 · gotcha
Round 1: iterate MUST_FIX 0 / SHOULD_FIX 1 / MINOR 1. R1-1 (SHOULD_FIX): keyless build/verify lifecycle contradicts itself. R1-2 (MINOR): tier-line is not the same as contingency. Deltas (lint pass) clean; wire-contract lens traced end-to-end and sound.
Evidence: reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn

## 2026-09-22T18:06:56Z · design · v2 · gotcha
Round 2: converged MUST_FIX 0 / SHOULD_FIX 0 / MINOR 1. Both v2 deltas verified accurate, no fix-induced regression; fresh lens (prescribed tests vs installed vitest 4.0.16 + preflight/escalate halt) clean. R2-1 (MINOR, not blocking): compare-mode provider-pair placement under-specified — a value safely left to implementation.
Evidence: reviews/adversarial-analysis-design-r2.md
Cost: 1 reviewer spawn

## 2026-09-22T18:08:29Z · design · phase · cleanup
design approved at v2 after 2 rounds; verdict trajectory iterate 0/1/1 → converged 0/0/1; rulings 2 (both drafter RE-DECIDED literals ruled refinement/closed in round 1); cap not hit; prune removed 0 records and 0 snapshots (2 snapshots kept). Version header: none added — requirements.md (v5) and the design template carry no Document version header, so this spec tracks version in Revision History (v2 line present); adding a header only to design would be inconsistent.
Evidence: approval_1790100426099_8ay5vpwgq; reviews/adversarial-analysis-design-r2.md
Cost: 2 reviewer + 3 reviser + 1 drafter spawns

## 2026-09-22T18:43:29Z · tasks · v1 · gotcha
Round 1: iterate MUST_FIX 0 / SHOULD_FIX 2 / MINOR 2. R1-1 the in-run escalate/halt path is not active for the run that builds this spec; R1-2 task 10's corrected scenarios never reach the completion-gate verifier. No gate-b/gate-c findings, ESCALATE none.
Evidence: .spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-09-22T20:12:10Z · tasks · v2 · inefficiency
Round 2 iterate 1/1/1. Both substantive findings are fix-induced compounds of round 1: R2-1 (MUST_FIX, Compounds R1-2) — the R1-2 reword routed task 10's deferral filing through sdd-implementer, whose standing rules bar it, so the 'no writer' gap recurred; R2-2 (SHOULD_FIX, Compounds R1-1) — the R1-1 safety record uses RETRO: escalation, a category the implementer brief does not list. No circling (two distinct items) and no standoff (R1-2 was partially accepted, not rejected). Revising to v3.
Evidence: adversarial-analysis-tasks-r2.md
Cost: 1 reviewer spawn

## 2026-09-22T20:35:16Z · tasks · v3 · inefficiency
Round 3 iterate 1/1/1; all three findings fix-induced from the v3 delta. R3-1 (MUST_FIX, Compounds R2-3): the v3 lint pass mis-prefixed line 119's second citation onto SKILL.md:383-384 (out of bounds; the range is decomposition.md's). R3-2 (SHOULD_FIX, Compounds R2-1): the Deferral bar does not guarantee task 10's AFFECTS-FUTURE-SPECS flag becomes the verification-tagged deferral the fix asserts. R3-3 (MINOR, novel): task 10 Prompt body vs Success line disagree on AFFECTS-FUTURE-SPECS line count. Reviewer confirmed R2-1 core resolved (orchestrator holds deferrals). No circling (r2 R2-2 was task 1), no standoff. Revising to v4.
Evidence: adversarial-analysis-tasks-r3.md
Cost: 1 reviewer spawn

## 2026-09-22T20:54:54Z · tasks · v4 · inefficiency
Round 4 (cap) iterate 1/1/0. MUST_FIX flat at 1 from round 3, so cap convergence grants no extra round and round 4 was already BUDGET; routing to Step 4a post-cap corrective pass. Both open findings are contradiction remnants the truth-table lens surfaced: R4-1 (MUST_FIX, carried, Compounds R1-1) task 1's unset-key branch emits ESCALATE only while the Dependency-order paragraph and D6 promise RETRO: gotcha; R4-2 (SHOULD_FIX, fix-induced, Compounds R3-2) task 10's description bullet still asserts an unconditional verification deferral against the harmonised Prompt/D5/Scope note.
Evidence: adversarial-analysis-tasks-r4.md
Cost: 1 reviewer spawn

## 2026-09-22T20:59:59Z · tasks · v5 · inefficiency
Cap hit at v4 (4 review rounds); post-cap corrective pass adjudicated v5. R4-1 fixed (MUST_FIX): task 1's unset-key branch now reports RETRO: gotcha beside ESCALATE, matching Dependency-order/D6/Success/Scope. R4-2 fixed (SHOULD_FIX): task 10's description bullet now files the verification deferral only when the Deferral bar's three-part test holds. Both fixed, none ruled out, so no carried items for the next phase.
Evidence: adversarial-analysis-tasks-r4.md
Cost: 1 adjudicator spawn
