
## 2026-09-15T15:27:30Z · requirements · v1 · gotcha
Round 1 (wire-contract lens): iterate, MUST_FIX 1 / SHOULD_FIX 5 / MINOR 2. Headline: hook-written spawn events cannot carry the role/result the same-spawn view promises (R4.2 contradiction); usage-event target file, shape and join key undefined; supervisor level-1 spawns and interrupted phase-log row fall in a gap. Citations accurate.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-09-15T15:52:18Z · requirements · v2 · inefficiency
Round 2 (cost-of-touching-existing-component lens): iterate, MUST_FIX 0 / SHOULD_FIX 4 / MINOR 0. R2-1/R2-2 compound round-1 fixes (ticker still renders role/result from spawn events; interrupted-row trigger fights buildModel live-phase rule); R2-3/R2-4 novel (per-spec phase-log render risks clobbering other specs' rows; hook second file must keep feeding the live badge). No MUST_FIX; routes to SHOULD_FIX-only corrective pass at v3, no further review round.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn

## 2026-09-15T16:11:03Z · requirements · phase · cleanup
requirements approved at v3 after 3 rounds; verdict trajectory 1/5/2 (r1) -> 0/4/0 (r2) -> SHOULD_FIX-only corrective pass at v3, narrow check VERIFIED 4/4; rulings 0; cap not hit (SHOULD_FIX-only pass, not the v4 cap); prune removed 0 records and 0 snapshots. Scope: retrospective orient deferred from v1 (D4). Carried items: none.
Evidence: approval_1789488556690_2j5fb0jwj; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-requirements-r2.md; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-requirements-r3.md
Cost: 2 reviewer + 5 reviser spawns, 1 drafter, 1 checker

## 2026-09-15T16:47:27Z · design · v1 · gotcha
Round 1 verdict iterate MUST_FIX 1 / SHOULD_FIX 2 / MINOR 2. Headline MUST_FIX: prompt-launched workers (reviewer, checker, verifier, adjudicator) carry no -brief filename, so the hook seam and fold erase them and their tokens from --watch, contradicting Overview and Requirement 4.2.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn

## 2026-09-15T17:08:11Z · design · v2 · inefficiency
Round 2 verdict iterate MUST_FIX 1 / SHOULD_FIX 0 / MINOR 1. R2-1 (Compounds R1-1): the v2 synthesis fix (fold orphan spawn.usage onto a same-agent brief node when no spawn.start matches) mis-folds a prompt-launched worker onto a stale same-agent brief node when the agent type is reused (sdd-verifier e2e vs per-task; sdd-implementer close-out fix vs batch) — worker vanishes, tokens lost, node relabelled. The round-1 fix introduced the defect the round-2 delta must correct.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-design-r2.md
Cost: 1 reviewer spawn

## 2026-09-15T17:25:02Z · design · v3 · gotcha
Round 3 verdict converged (MUST_FIX 0 / SHOULD_FIX 0 / MINOR 2). Reviewer hand-traced the v3 unconsumed-match fold through both guaranteed agent-reuse cases (e2e verifier after per-task verifier; close-out fix implementer after batch implementer) — each keeps its own node/tokens, no relabel. Change is additive and inert on installed watch fixtures. Two MINOR novels: R3-1 docs/TOOLS-REFERENCE.md says 13 tools should be 14; R3-2 Testing Strategy does not name the reused-agent test case.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-design-r3.md
Cost: 1 reviewer spawn

## 2026-09-15T17:26:49Z · design · phase · cleanup
design approved at v3 after 3 rounds; verdict trajectory 1/2/2 → 1/0/1 → converged; rulings 0; cap not hit; prune removed 0 records and 0 snapshots. Two MINORs left at convergence (R3-1 docs/TOOLS-REFERENCE.md tool count; R3-2 Testing Strategy reused-agent case) — for tasks phase, not carried. Recurring lint noise: the citation-identifier rule flags backticked plain words and design-coined field names as absent artifacts; three lint passes rejected the same ~26-49 false positives each version, and the citation-path rule kept re-flagging bare render.ts on Revision-History bullets.
Evidence: approval_1789493105533_hu3xk15p0; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-design-r3.md
Cost: 3 reviewer + 5 reviser spawns (2 revise, 3 lint), 1 drafter

## 2026-09-15T18:02:54Z · tasks · v1 · gotcha
Round 1 verdict iterate 0/2/1. Two SHOULD_FIX at the skill/template seam: the brief-template set is unenumerated (task 3 to task 7 name contract; "five" contradicts Component 5's seven roles); task 7 bundles ~7 skill edits under checks that verify no content (silent spawn-event double-write risk). One MINOR.
Evidence: .spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-09-15T18:19:44Z · tasks · v2 · inefficiency
Round 2 verdict iterate 0/1/0. One SHOULD_FIX R2-1 (Compounds R1-2): task 7 covers only half of Requirement 5.2 — retires supervisor phase-log hand-write at SKILL.md:139-143 but not the per-PHASE-result phase-row writes at :187-193; grep done-condition checks only :139-143, so phase log stays double-sourced. Routed to SHOULD_FIX-only corrective pass (D>=2).
Evidence: .spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-tasks-r2.md
Cost: 1 reviewer spawn

## 2026-09-15T18:28:34Z · tasks · v3 · gotcha
Narrow-check deferred finding: task 7's grep done-condition ('write one HANDOFF phase row') matches the approved/complete (:187) and closed (:189) rows but not the resume row (:192-193, phrased 'write a HANDOFF row'); the prose routes resume to phase-log but the grep neither asserts it nor distinguishes it from the same-phrasing out-of-scope :194-202 rows. Implementer following the prose still covers resume; the grep check is imperfect.
Evidence: .spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-tasks-r3.md
Cost: 0 (deferred observation)

## 2026-09-15T18:28:34Z · tasks · v3 · gotcha
Narrow-check deferred finding: design Component 7's parenthetical cites :180-199, a superset spanning the out-of-scope :194-202 rows rather than pinning :187-193; only Requirement 5.2 names the two write sites precisely. Design citation is loose but not wrong; tasks doc pins the exact sites.
Evidence: .spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-tasks-r3.md
Cost: 0 (deferred observation)

## 2026-09-15T18:29:54Z · tasks · phase · cleanup
tasks approved at v3 after 3 rounds; verdict trajectory 0/2/1 → 0/1/0 → SHOULD_FIX-only corrective pass (R2-1 fixed, narrow check VERIFIED 1/1); rulings 0; cap not hit (SHOULD_FIX-only route at v3); prune removed 0 records and 0 snapshots (single approval record). Two narrow-check deferred findings recorded above. Fable was out of credits, so every SDD agent ran on opus via override.
Evidence: approval_1789496923491_0imaqu57g; .spec-workflow/specs/harness-bookkeeping/reviews/adversarial-analysis-tasks-r2.md
Cost: 2 reviewer + 5 reviser + 1 drafter + 1 checker spawns

## 2026-09-15T18:35:22Z · tasks · phase · harness-defect
event.sh and .runid were rewritten from the supervisor run id run-20260915-150006 to run-20260915-172935 during the tasks phase, so 25 tasks-phase ledger events are grouped under a second run id. No skill or hook writes these files; a concurrent supervisor in peer session spec-workflow-mcp-33 is the likely cause. Restored both to 150006 for the remaining phases; existing events left as written to avoid asserting false provenance.
Evidence: .spec-workflow/specs/harness-bookkeeping/harness-events.jsonl (run ids run-20260915-150006 and run-20260915-172935)
Cost: ledger fragmented across two run ids; cosmetic for --watch run grouping

## 2026-09-15T18:42:46Z · implementation · task 1 · gotcha
rounds 0; outcome gate (pass, risk low); taskBlock parser export, clean first pass.
Evidence: task 1; commit 8785ec5
Cost: 1 implementer spawn

## 2026-09-15T18:56:49Z · implementation · task 2 · gotcha
rounds 1 (verifier, high risk 445 lines); outcome pass; 2 info findings non-blocking (classifyTarget byClass detail, unasserted narrow-check branch).
Evidence: task 2; commit 71fc87c
Cost: 1 implementer + 1 verifier spawn

## 2026-09-15T19:05:54Z · implementation · task 3 · gotcha
rounds 0; outcome gate (pass, risk low); brief action with 5 templates (drafter/reviser/adjudicator/verifier/implementer) task 7 must pass verbatim.
Evidence: task 3; commit 34fbcc9
Cost: 1 implementer spawn

## 2026-09-15T19:17:28Z · implementation · task 4 · gotcha
rounds 1 (verifier, high risk 228 lines); outcome pass, 0 findings; phase-log regen from ledger.
Evidence: task 4; commit 24e41ae
Cost: 1 implementer + 1 verifier spawn

## 2026-09-15T19:27:21Z · implementation · task 5 · gotcha
rounds 1 (verifier, high risk sensitive path harness/hooks); outcome pass, 0 findings; hook writes spawn.start/spawn.end, plugins regenerated.
Evidence: task 5; commit 1302435
Cost: 1 implementer + 1 verifier spawn

## 2026-09-15T19:32:38Z · implementation · task 6 · gotcha
rounds 0; outcome gate (pass, risk low); spawn.usage fold + ticker branch; render.ts unchanged (already renders level-2 nodes).
Evidence: task 6; commit 61b6e37
Cost: 1 implementer spawn

## 2026-09-15T19:52:34Z · implementation · task 7 · doc-gap
Close-out batch and impl fix-round briefs have no tasks.md taskId, so they cannot use the server implementer template (requires taskId/taskBlock); implementer mapped them to reviser/adjudicator. Worth resolving in the deferred D2 briefs.md-port follow-up.
Evidence: task 7; harness/skills/sdd-continue/SKILL.md, harness/skills/sdd-closeout-phase/SKILL.md
Cost: 0 extra spawns (flagged during implementation)

## 2026-09-15T19:55:47Z · implementation · task 7 · gotcha
rounds 1 (verifier, high risk 346 lines across 5 skills); outcome pass, 0 findings; all grep done-conditions hold. One spurious gate fail from orchestrator passing a plugins dir instead of file paths to the gate files list; re-ran gate clean, no fix round.
Evidence: task 7; commit 50635d5
Cost: 1 implementer + 1 verifier spawn

## 2026-09-15T20:00:53Z · implementation · task 8 · gotcha
rounds 1 (verifier); outcome pass, 0 findings; docs tool-count 13->14 + harness row. Gate scored risk high via a tests-not-touched heuristic on a docs-only task (false positive).
Evidence: task 8; commit 00fdec7
Cost: 1 implementer + 1 verifier spawn

## 2026-09-15T20:17:26Z · implementation · phase · cleanup
8/8 tasks implemented; 0 fix rounds, 0 adjudications. Gate-only completion on tasks 1/3/6 (low risk), verifier pass on 2/4/5/7/8 (high risk). E2E full suite green (build, npm test 1233, check:plugin-assets, plugin validate); scenarios 1-5 verified in-process; live-plugin half deferred as d-324dbe0d. One spurious task-7 gate fail (orchestrator files-list param), re-ran clean.
Evidence: commits 8785ec5..00fdec7; e2e deferral d-324dbe0d
Cost: 14 spawns: 8 implementer + 5 task verifier + 1 e2e verifier; 1 deferral added

## 2026-09-15T20:38:38Z · retrospective · phase · cleanup
retrospective compiled: 19 findings across 11 sections, 19 proposals (2 decisions needed: P6 concurrent run-state pointer, P10 harness/ Markdown in the gate line rule; 4 graduation candidates). Analyst re-spawned on opus after a fable credit-limit failure on the first attempt.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/retrospective.md; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-bookkeeping/retrospective-proposals.md
Cost: 1 analyst spawn (+1 failed fable spawn)

## 2026-09-15T21:22:00Z · closeout · store batch 1 · cleanup
P10 agent-rules.md '## Prose paths' section landed on main; gate pass risk low, no verifier.
Evidence: commit f60c6aa; gate P10 store facet
Cost: 1 implementer spawn

## 2026-09-15T21:22:00Z · closeout · harness batch 1 · cleanup
P1, P4, P5, P7, P10-code landed on chore/harness-bookkeeping-retro; all six facet gates pass risk low, no verifier, no fix rounds; checks green (check:plugin-assets, plugin validate, tsc --noEmit, vitest gate-rules).
Evidence: PR #42; commits 347e771 ef5fc45 fa86052 39cbf92 136fdc8
Cost: 1 implementer spawn; 5 gate calls

## 2026-09-15T21:22:00Z · closeout · P3 P6 P8 · deviation
To-do: targets created or rewritten by open PR #41 (feat/harness-bookkeeping); cannot land on a main-based branch until #41 merges. P3 src/tools/harness.ts absent on main; P6 sdd-activity.sh + sdd-continue rewritten; P8 sdd-implementation-phase SKILL.md rewritten.
Evidence: git diff origin/main feat/harness-bookkeeping; PR #41 open
Cost: 0 spawns (orchestrator-determined to-do)

## 2026-09-15T21:22:00Z · closeout · P10 · deviation
P10 landed as scoped (gate-rules.ts + agent-rules.md) but review-gate.ts is not yet wired to consume the prose-paths set, so the exemption has no runtime effect; wiring declined as beyond approved scope and deferred.
Evidence: deferral d-4c9198e3; implementer RETRO flag
Cost: 0 spawns

## 2026-09-15T21:22:00Z · closeout · phase · cleanup
Close-out complete: 8 items — 5 done (P1 P4 P5 P7 P10), 3 to-do (P3 P6 P8, blocked by PR #41). Plan CLOSED. Retro PR #42 opened; P10 store facet direct to main.
Evidence: PR #42; retrospective-plan.md Close-out section
Cost: 2 implementer spawns; 6 gate calls; 0 verifier; 0 fix rounds
