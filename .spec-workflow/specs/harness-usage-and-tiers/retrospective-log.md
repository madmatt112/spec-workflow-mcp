
## 2026-09-19T16:29:52Z · requirements · v5 · inefficiency
Cap hit at v4 (round 4 iterate MUST_FIX 1 / SHOULD_FIX 1). Post-cap corrective pass adjudicated to v5: R4-1 fixed (MUST_FIX, Req 5.4 token-state unknown-mark definition reconciled with Req 5.9 fixture totals), R4-2 fixed (SHOULD_FIX, header run count defined). No items ruled out; no carried items. Also 3 rounds of self-inflicted citation-path lint churn in Revision-History lint bullets (v2-v4) before the v4 lint pass collapsed them to token-free prose.
Evidence: adversarial-analysis-requirements-r4.md; requirements.md v5 Revision History
Cost: 1 adjudicator spawn

## 2026-09-19T16:32:46Z · requirements · phase · cleanup
requirements approved at v5 after 5 rounds; verdict trajectory 0/3/3 (r1) → 2/1/0 (r2) → 1/1/0 (r3) → 1/1/0 (r4) → post-cap adjudication → narrow check VERIFIED 2/2; rulings 0; cap hit (carried: none); prune removed 0 records and 0 snapshots. Notable: 3 versions of self-inflicted citation-path lint churn in Revision-History lint bullets before the v4 lint pass collapsed them to token-free prose; all substantive findings converged on Req 5's token-counting rule (spawn identity, spawn.usage fallback, token-state marks) vs the question-gates fixture totals.
Evidence: approval_1789835511785_5tgmkk1h5; .spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-requirements-r5.md
Cost: 4 reviewer + 6 reviser + 1 adjudicator + 1 checker spawns

## 2026-09-19T16:35:31Z · requirements · v5 · ruling
requirements.md describes the orchestrator-side per-spawn token source as an Agent result footer; the footer no longer exists and the count arrives in the task notification (<usage><subagent_tokens>), fixed in skills at f616c72 during this phase. Overwatch ruled carry-forward via a HANDOFF Carried item, not a revision pass: the hook-read transcript stays the mechanism the spec builds, and a revision plus review round costs more tokens than the stale description is worth.
Evidence: HANDOFF ## harness-usage-and-tiers — requirements, Carried items; commit f616c72
Cost: 0 rounds (ruled, not revised)
