
## 2026-09-17T17:51:42Z · requirements · v1 · harness-defect
The previous run was interrupted inside the document orchestrator after the v1 checkpoint, during the lint reviser and before the gate-A emit. On resume the supervisor's gate-A recheck keys on a questions.md receipt, which is only written after the orchestrator returns gate-a, and orient reports Step 2 for v1, so a normal re-dispatch would skip both the v1 lint pass and gate A. The supervisor ran gate A by hand from the fresh gate-a.json surface and logged the deviation.
Evidence: harness-events.jsonl run-20260917-170349 (spawn.start sdd-reviser lint, no spawn.end, no phase.end); gate-a.json mtime after requirements.md
Cost: 1 wasted orchestrator spawn plus drafter; lint reviser spawn lost

## 2026-09-17T17:55:53Z · requirements · v1 · harness-defect
Gate A asked the human five decisions phrased as implementation mechanics (recording sites, storage layout, pinned constants, diff transport). The human answered every one with 'you choose' and said the weeds had been detailed by agents. The gate produced no signal: the supervisor kept all recorded choices. The drafter's gate-A extraction should rank and phrase decisions as user-visible outcomes and trade-offs, or the gate should not fire when no decision is judgeable without the codebase.
Evidence: specs/worktree-review-signals/questions.md gate A answers
Cost: 1 AskUserQuestion call, 4 answers, all delegated

## 2026-09-18T16:41:12Z · requirements · v2 · gotcha
Round 1 on v2: iterate MUST_FIX 2 / SHOULD_FIX 2 / MINOR 0. R1-1 is a lint-pass artifact: the v1 lint inserted a typecheck.ts:478 citation so a bare :30 in Req 1 AC10 re-resolved to the wrong file (lint fix introduced a citation error). R1-2 record-key granularity contradiction between Req 1 and Req 3/Req 7. R1-3 runGit discards failure cause; R1-4 provenance value recorded undefined. Escalate none.
Evidence: reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn (131k tokens)

## 2026-09-18T16:51:46Z · requirements · v3 · ruling
Orchestrator ruling: skipped the v3 lint reviser spawn. spec-lint on v3 reports 38 warnings, all citation-identifier, 0 error. 33 are the same identifier-is-new-behavior warnings the v1 lint pass rejected with reasons (recorded under the v2 Revision History line) and the v3 reviser re-checked; 5 are on the two lines the v3 delta wrote (Req 1 AC 6 provenance value; the migration note). A third reviser pass on the same warnings buys nothing; the 5 new ones go to the round-2 reviewer as LINT.open, and round 2 attacks the v3 delta first anyway. Harness note: citation-identifier fires on every identifier a criterion introduces as new behavior, so on a requirements document that names new fields it produces a standing wall of warnings; the rule needs a way to mark an identifier as new (or the lint step needs a carry-forward of rejected findings) so it stops re-firing.
Evidence: spec-lint v2: 34 warnings; spec-lint v3: 38 warnings; requirements.md v2 Revision History lint-pass bullet
Cost: 0 spawns (saved one ~100k-token reviser spawn)

## 2026-09-18T17:06:36Z · requirements · v3 · gotcha
Round 2 on v3: converged, MUST_FIX 0 / SHOULD_FIX 0 / MINOR 2, DESIGN_READY yes. Resumed orchestrator acted on the r2 verdict the stopped run left unactioned; no new reviewer spawned. Two MINOR items noted, not blocking.
Evidence: reviews/adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn (previous run)

## 2026-09-18T17:07:26Z · requirements · phase · cleanup
requirements approved at v3 after 2 rounds; verdict trajectory 2/2/0 (r1, v2) -> converged 0/0/2 (r2, v3); rulings 0; cap not hit; prune removed 0 records and 0 snapshots (2 snapshots kept).
Evidence: approval_1789751201977_4rubgz93s; reviews/adversarial-analysis-requirements-r2.md
Cost: 2 reviewer + 1 reviser spawns

## 2026-09-18T19:17:17Z · design · v1 · ruling
Round 1: iterate 0/1/1. Reviewer ruled both RE-DECIDED flags refinements (closed): D11 (R4 AC5 feature-disabled emits no degraded note) and D3 (R1 AC11 diffBase.commit is the ref HEAD, not a sha). One SHOULD_FIX R1-1 (prepare round-trip fails with no dashboard: dashboardUrl undefined -> null under toon 4.1.1; AC-4 test masks it). Both probes reproduced.
Evidence: reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn
