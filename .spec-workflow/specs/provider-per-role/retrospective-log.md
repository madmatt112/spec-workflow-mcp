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
