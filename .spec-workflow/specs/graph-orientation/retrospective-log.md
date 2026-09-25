# Retrospective log — graph-orientation

## 2026-09-25T17:27:04Z · requirements · v1 · gotcha
Round 1: iterate, MUST_FIX 0 / SHOULD_FIX 3 / MINOR 3. Fresh lens (wire contracts) found R1-1 worktree graph staleness, R1-2 run.start refresh ordering, R1-3 R6 column omits DeepSeek readers. Clean of claim errors.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/retrospective-log.md#analysis:reviews/adversarial-analysis-requirements.md
Cost: one reviewer spawn

## 2026-09-25T17:50:47Z · requirements · v2 · gotcha
Round 2: iterate 2/1/0. Both MUST_FIX fix-induced by the v2 delta: R2-1 (Compounds R1-5) shrink-guard claim false, R2-2 (Compounds R1-3) R6 AC8 wrong line + false shared-scope claim; R2-3 SHOULD_FIX scenario-4 non-worktree fixture unspecified.
Evidence: reviews/adversarial-analysis-requirements-r2.md
Cost: one reviewer spawn

## 2026-09-25T18:05:24Z · requirements · v3 · gotcha
Round 3: CONVERGED 0/0/2. All three v3 rewrites verified accurate against source (graphify _check_shrink deletion/partial-extraction, usage.ts:159 deepseek keying + graph undercount, scenario-4 fixture). Two deferrable MINOR notes: graph column position in usage output; scenario-4 fixture prerequisites. Trajectory: MUST_FIX 0->2->0; clean converge in 3 rounds.
Evidence: reviews/adversarial-analysis-requirements-r3.md
Cost: one reviewer spawn

## 2026-09-25T18:06:40Z · requirements · phase · cleanup
requirements approved at v3 after 3 rounds; verdict trajectory 0/3/3 -> 2/1/0 -> converged 0/0/2; rulings 0; cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1790359537320_wcdfrrc6c; reviews/adversarial-analysis-requirements-r3.md
Cost: 3 reviewer + 4 reviser spawns

## 2026-09-25T18:45:57Z · design · v1 · ruling
Round 1 converged 0/0/3 (3 MINOR). Reviewer ruled D8 (RE-DECIDED Req 6 AC2): refinement, closed — a graph fact must come from a graph command, so a grep for the phrase does not count. First reviewed version converged; no revise round needed.
Evidence: reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn

## 2026-09-25T18:47:20Z · design · phase · cleanup
design approved at v1 after 1 round; verdict trajectory converged 0/0/3; rulings 1 (D8 refinement); cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1790361966822_09kylbcnh; reviews/adversarial-analysis-design.md
Cost: 1 reviewer + 1 reviser spawns (+1 drafter)

## 2026-09-25T19:21:00Z · tasks · v1 · gotcha
Round 1 converged clean 0/0/0; lint L-1..L-24 rejection upheld by reviewer; full component/AC coverage and producer-before-consumer order verified; no gate-b/gate-c tags.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-09-25T19:22:09Z · tasks · phase · cleanup
tasks approved at v1 after 1 rounds; verdict trajectory converged 0/0/0; rulings 0; cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1790364064340_6ez01nrhz; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/graph-orientation/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer + 1 reviser spawns

## 2026-09-25T21:26:45Z · implementation · task 1 · gotcha
sdd-graph.sh fact/refresh + test; gate pass risk low, 0 fix rounds, outcome gate.
Evidence: task 1; commit efa4e9b; harness/skills/sdd-continue/references/sdd-graph.sh, src/__tests__/sdd-graph.test.ts
Cost: 1 implementer spawn

## 2026-09-25T21:32:58Z · implementation · task 2 · gotcha
codeGraphSection + brief graph guard/append; gate pass risk low, 0 fix rounds, outcome gate.
Evidence: task 2; commit 1fed0c6; src/tools/harness.ts, src/tools/__tests__/harness.test.ts
Cost: 1 implementer spawn

## 2026-09-25T21:41:17Z · implementation · task 3 · gotcha
graph count in usage fold + tables (UsageCell.graph, windowPhase, isGraphCall, applyGraphCounts); gate pass risk low, 0 fix rounds, outcome gate.
Evidence: task 3; commit 765ee6e; src/watch/usage.ts, src/watch/__tests__/usage.test.ts, src/tools/__tests__/harness.test.ts
Cost: 1 implementer spawn

## 2026-09-25T21:47:15Z · implementation · task 4 · gotcha
readSpecActivity + usageAction folds graph counts via applyGraphCounts; gate pass risk low, 0 fix rounds, outcome gate.
Evidence: task 4; commit 50dfa8c; src/tools/harness.ts, src/tools/__tests__/harness.test.ts
Cost: 1 implementer spawn

## 2026-09-25T21:51:51Z · implementation · task 5 · gotcha
supervisor resolves graph fact, carries GRAPH lines, refresh before run.start; gate pass risk low, 0 fix rounds, outcome gate.
Evidence: task 5; commit dc5d58e; harness/skills/sdd-continue/SKILL.md, references/formats.md
Cost: 1 implementer spawn

## 2026-09-25T22:01:35Z · implementation · task 6 · gotcha
document skill passes graph, mirrors code graph block, drift-guard test; gate pass risk low, 0 fix rounds, outcome gate.
Evidence: task 6; commit 16d80dd; harness/skills/sdd-document-phase/SKILL.md, references/briefs.md, src/tools/__tests__/harness.test.ts
Cost: 1 implementer spawn

## 2026-09-25T22:09:25Z · implementation · task 7 · gotcha
impl + close-out skills pass graph and refresh per-task; gate pass risk low, 0 fix rounds, outcome gate.
Evidence: task 7; commit 844ec10; harness/skills/sdd-implementation-phase/SKILL.md, harness/skills/sdd-closeout-phase/SKILL.md
Cost: 1 implementer spawn

## 2026-09-25T22:13:06Z · implementation · task 8 · gotcha
docs name graph values, launch lines, graph column; gate pass risk low, 0 fix rounds, outcome gate.
Evidence: task 8; commit 24ebc3e; docs/TOOLS-REFERENCE.md, docs/SDD-HARNESS.md
Cost: 1 implementer spawn

## 2026-09-25T22:16:56Z · implementation · task 9 · gotcha
verification-only spec-store task: verification-evidence.md with 3 pending lines; verifier skipped by policy (retro P15), no gate, 0 fix rounds, outcome gate.
Evidence: task 9; commit 640b8c7; .spec-workflow/specs/graph-orientation/verification-evidence.md
Cost: 1 implementer spawn
