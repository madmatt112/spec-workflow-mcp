
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

## 2026-09-19T17:41:01Z · design · v1 · gotcha
Round 1: iterate 1/1/2. R1-1 MUST_FIX: skill edit line-spans stop short of the token-write text, leaving live tokens=unknown and stale/misaligned citations. R1-2 SHOULD_FIX: tier line reaches 81 cols for a two-model '+'-joined worker. Reviewer ruled both RE-DECIDED flags (Req 4.7 two-line, Req 5.4/D6 non-digit tokens) as refinement, closed.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn

## 2026-09-19T18:19:13Z · design · v2 · gotcha
Round 2: iterate 0/2/0. All four v2 fixes code-verified. Two SHOULD_FIX remain: R2-1 (Compounds R1-1) retro edit span :35-39 straddles phase.start/phase.end and Component 7's replacement names neither; R2-2 (Novel) Component 4 'never both badge and tokens' unhandled for D9 agent.stop-carries-tokens + activity join, risking an 84-col head line and transient double-count. MUST_FIX 0, so routing to SHOULD_FIX-only corrective pass (v3), then narrow check.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-design-r2.md
Cost: 1 reviewer spawn

## 2026-09-19T18:40:22Z · design · v3 · gotcha
Narrow check VERIFIED 2/2 (R2-1, R2-2 both addressed). Deferred finding: design.md line 78 and the v3 Revision History cite the agent.stop join span as 'lines 305 to 311' but the real join (double loop plus event-type branches) runs src/watch/ledger.ts:293-314; the load-bearing guarded-fill line (308) is correct, so the imprecision is a MINOR citation-span slip, not a false claim. Carried as a note for the implementer, who reads the code.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-design-r3.md
Cost: 1 checker spawn

## 2026-09-19T18:42:11Z · design · phase · cleanup
design approved at v3 after 3 rounds; verdict trajectory 1/1/2 → 0/2/0 → SHOULD_FIX-only corrective pass at v3, narrow check VERIFIED 2/2; rulings 2 (both refinement, closed); cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1789843231461_6kmnt6n22; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-design-r2.md
Cost: 3 reviewer/checker + 5 reviser + 1 drafter spawns

## 2026-09-21T16:36:38Z · tasks · v1 · gotcha
Round 1 converged on v1 (MUST_FIX 0 / SHOULD_FIX 0 / MINOR 2); clean first round after the lint pass fixed the two citation-path errors and reviser rejected 78 citation-identifier false positives. Two MINORs (fresh-lens bridge naming, a test-placement note) left as non-blocking.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-09-21T16:37:41Z · tasks · phase · cleanup
tasks approved at v1 after 1 round; verdict trajectory 0/0/2 → converged; rulings 0; cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1790008612021_brp2i8273; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer + 1 reviser spawns

## 2026-09-21T16:49:44Z · implementation · task 1 · gotcha
Generated agent-profiles.json builder; clean, gate low risk, no verifier.
Evidence: task 1; scripts/sync-plugin-assets.cjs, harness/agent-profiles.json
Cost: 1 spawn, 0 fix rounds

## 2026-09-21T16:55:53Z · implementation · task 2 · gotcha
SpawnNode usage keys and PHASE_ORDER move; gate low risk, no verifier.
Evidence: task 2; src/watch/ledger.ts, src/watch/render.ts
Cost: 1 spawn, 0 fix rounds

## 2026-09-21T17:04:51Z · implementation · task 3 · gotcha
Profiles loader and render tier line; Component 3 model parts already merged by task 2, scoped to loader+render.
Evidence: task 3; src/watch/ledger.ts, src/watch/render.ts
Cost: 1 spawn, 0 fix rounds

## 2026-09-21T17:20:00Z · implementation · task 4 · gotcha
Usage fold; gate high risk on line-count only (560 added, mostly tests), verifier VERDICT pass.
Evidence: task 4; src/watch/usage.ts
Cost: 2 spawns (impl+verify), 0 fix rounds

## 2026-09-21T17:20:00Z · implementation · task 4 · doc-gap
Design rule (c) names a model field the Usage* Data Models and formatUsageTable omit; phantom clause worth trimming in a future design pass.
Evidence: verifier finding, src/watch/usage.ts:163
Cost: no rework; info only

## 2026-09-21T17:28:44Z · implementation · task 5 · gotcha
Fixture ledger and pinned usage/watch numbers; gate low risk, no verifier.
Evidence: task 5; src/__tests__/fixtures/usage-ledger.jsonl
Cost: 1 spawn, 0 fix rounds

## 2026-09-21T17:35:04Z · implementation · task 6 · gotcha
harness usage action + docs; gate low risk, no verifier.
Evidence: task 6; src/tools/harness.ts, docs/TOOLS-REFERENCE.md
Cost: 1 spawn, 0 fix rounds

## 2026-09-21T17:44:13Z · implementation · task 7 · gotcha
SubagentStop hook now sole per-spawn usage writer; sensitive path high risk, verifier VERDICT pass, no findings.
Evidence: task 7; harness/hooks/sdd-activity.sh
Cost: 2 spawns (impl+verify), 0 fix rounds

## 2026-09-21T17:51:49Z · implementation · task 8 · inefficiency
Gate first failed with file-outside-list because the files list omitted the generated plugins/ copies; a harness/ task always mirrors into three plugins trees, so the files list must include every plugins/ copy. Re-ran clean.
Evidence: task 8; gate reasons file-outside-list x18
Cost: 1 extra gate call, no worker respawn

## 2026-09-21T18:00:40Z · implementation · phase · cleanup
Phase complete: 8/8 tasks, 0 fix rounds, 0 adjudications. 11 worker spawns (8 implementers, 2 task verifiers, 1 e2e verifier). Tasks 4 and 7 hit the high-risk gate (line-count, sensitive path); both verifiers passed. 1 deferral added (d-3091be1c, verification). e2e VERIFY pass with the live orchestrator SubagentStop half deferred.
Evidence: tasks.md all [x]; retrospective-log.md
Cost: 11 spawns, 1 extra gate call on task 8

## 2026-09-21T18:10:02Z · retrospective · phase · cleanup
Retrospective compiled: 8 findings across gotchas, tool deficiency, harness defect, inefficiencies, doc gap, rulings and a harness-made decision; 2 repeat patterns (plugins/ mirror in gate files list x4 specs; citation-identifier lint churn x5 specs). Analyst wrote 8 proposals (P1-P8), 3 decisions needed, 2 graduation candidates.
Evidence: retrospective.md; retrospective-proposals.md
Cost: 1 analyst spawn (42744 tokens)

## 2026-09-21T22:57:01Z · closeout · phase · cleanup
harness batch 1: 4/4 items done (P2, P3, P4, P5); 0 to-do; 0 skipped. 1 implementer spawn; 0 verifier spawns (all four are harness items that passed the gate at low risk). 6 gate calls: P4 and P5 first failed file-outside-list because the orchestrator passed directory names instead of exact paths, then passed on re-gate with exact paths.
Evidence: PR https://github.com/madmatt112/spec-workflow-mcp/pull/56; commits 94396b2 f4bd289 4e7f716 098f409
Cost: 1 implementer spawn, 0 verifier spawns

## 2026-09-21T22:57:32Z · closeout · phase · cleanup
Close-out complete: 4/4 approved proposals landed (P2, P3, P4 incl. graduation candidate 2, P5), 0 to-do, 0 skipped. Plan marked CLOSED. All four are harness-class server/skill changes landed on one branch with one PR. Total spawns: 1 implementer, 0 verifier (every item passed the gate at low risk).
Evidence: retrospective-plan.md ## Close-out; PR https://github.com/madmatt112/spec-workflow-mcp/pull/56
Cost: 1 implementer spawn, 0 verifier spawns, 6 gate calls

## 2026-09-21T22:59:47Z · closeout · phase · harness-defect
d-3091be1c verification FAILED on the first live run after PR #54: the SubagentStop hook wrote the close-out orchestrator's spawn.end with usage summed from the parent session transcript, not the orchestrator's. Row: input 5516, output 430585, cacheWrite 5001644, cacheRead 46447696, tokens 51885441, model claude-fable-5-1+<synthetic>; the orchestrator transcript (agent-a91016c9ea9a0c2d1.jsonl) is 77/77 claude-opus-4-8 and sums to 5843386. The hook reads d.transcript_path (the session file); it needs the subagent's own transcript path from the payload (agent_transcript_path, if present) with transcript_path only as a fallback. Two identical rows were written (22:42:44 and 22:57:47), so the hook also fires twice per orchestrator.
Evidence: harness-events.jsonl run-20260921-223600 spawn.end rows for sdd-closeout-orchestrator; harness/hooks/sdd-activity.sh readUsage(d.transcript_path)
Cost: 1 verification pass, 0 spawns
