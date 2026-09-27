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

## 2026-09-25T22:24:17Z · implementation · task 10 · gotcha
e2e verification: build+test(1504 pass)+plugin checks green, scenario 5 graph=4 vs 0; verification-only, no gate/verifier (retro P15), outcome gate.
Evidence: task 10; no code change; npm test green, scenario 5 pass
Cost: 1 implementer spawn

## 2026-09-25T22:25:04Z · implementation · phase · cleanup
graph-orientation implemented: 10/10 tasks, 0 fix rounds, 0 adjudications; e2e gate green (build, test 1504 pass, plugin-assets, plugin validate); scenario 5 graph=4 vs 0.
Evidence: tasks.md all [x]; commits efa4e9b..24ebc3e; verification-evidence.md 3 pending
Cost: 10 implementer spawns, 0 verifier, 0 deferrals added

## 2026-09-26T14:55:22Z · implementation · phase · harness-defect
Live scenario (3): harness-activity.jsonl hides drafter graph calls. The activity hook cuts Bash summaries at 160 characters and the drafter starts each call with cd <absolute root>;, so a graphify query or explain chained after it is cut off; the first visible graph row came after the first raw source read although the transcript shows two graph calls before it. The graph-call count (usage graph column, D4/D8) undercounts. Matthew marked (3) passed and asked for this as a retro item.
Evidence: verification-evidence.md (3); fixture run-fixture-s3 harness-activity.jsonl rows 14:17:26-14:17:36 vs drafter transcript
Cost: one fixture requirements spawn, ~2.1M tokens

## 2026-09-26T15:00:30Z · retrospective · phase · cleanup
Retrospective compiled: 8 findings (2 gotchas, 1 harness defect, 2 inefficiencies, 2 process/rulings, 1 harness-decision) + 2 repeat patterns; 8 proposals (P1-P8), 1 decision needed (P3 activity-hook cd-prefix truncation), 1 graduation candidate (instrumentation counts are floors). Analyst spawn 1.
Evidence: retrospective.md; retrospective-proposals.md
Cost: 1 retro-analyst spawn

## 2026-09-26T15:01:35Z · retrospective · phase · inefficiency
Overwatch R6: the Sonnet reviser uses 0.6-2.1M weighted tokens per spawn against 0.40-0.51M for Opus 4.8; in tradr account-deletion the reviser took 22.6M of 40.6M document spend. The plan rule says revert. Proposal: sdd-reviser back to claude-opus-4-8.
Evidence: overwatch step 4 measurement 2026-09-25, subagent transcripts (memory project_step4_results.md)
Cost: 22.6M of 40.6M doc tokens on account-deletion

## 2026-09-26T15:01:35Z · retrospective · phase · harness-defect
Overwatch R1: no tradr task has ever scored low risk (account-deletion 23 high, 6 medium), so every tradr task still gets a verifier. Proposal: find the cause (tradr agent-rules sensitive-path list, or the 200-line threshold).
Evidence: overwatch step 4 measurement 2026-09-25, subagent transcripts (memory project_step4_results.md)
Cost: one verifier spawn per tradr task

## 2026-09-26T15:01:35Z · retrospective · phase · inefficiency
Overwatch R2: spec-lint adds 10-16 Sonnet lint reviser spawns per spec at about 0.5M each; tradr account-export-import requirements r2 lint was 0 fixed, 16 rejected. Decision: keep lint but fix mechanical findings without a reviser spawn, or drop it.
Evidence: overwatch step 4 measurement 2026-09-25, subagent transcripts (memory project_step4_results.md)
Cost: 5-8M tokens per spec

## 2026-09-26T15:01:35Z · retrospective · phase · bug
Overwatch: the gate class-a keyword match needs word boundaries; auth matched author on graph-orientation tasks 1 and 10.
Evidence: graph-orientation gate B veto items, tasks 1 and 10
Cost: false class-a veto items

## 2026-09-26T15:01:35Z · retrospective · phase · harness-defect
Overwatch: one-hour orchestrator cache showed gapRewrites 1 on two orchestrators (agent-cache-ttl close-out a9b0bf2d7c7160bcc after a 696 s gap; tradr account-export-import doc orchestrator af899d43011358e85). The prefix broke after a ~9k-token head, not by expiry. Cause unproven; investigate.
Evidence: overwatch step 4 measurement 2026-09-25, subagent transcripts (memory project_step4_results.md)
Cost: one full prefix rewrite per occurrence

## 2026-09-26T15:01:35Z · retrospective · phase · bug
Overwatch: harness brief (#65 P5) resolves a bare reviews/x.md against .spec-workflow/ instead of specs/<SPEC>/. Proposal: one-line fix to resolve against the spec dir.
Evidence: src/tools/harness.ts brief action; overwatch note
Cost: misplaced brief files

## 2026-09-27T15:02:33Z · closeout · phase · cleanup
harness batch 1: 8 done (P1 P3 P5 P7 P9 P11 P12 P14), 2 to-do (P10 P13 external cause). store: G1 done (agent-rules.md, uncommitted). Gates all pass; P3 high (sensitive harness/hooks) verified ok. PR #69.
Evidence: PR https://github.com/madmatt112/spec-workflow-mcp/pull/69
Cost: 1 implementer spawn, 1 verifier spawn

## 2026-09-27T15:03:42Z · closeout · phase · cleanup
graph-orientation CLOSED: items 11/11 (9 done, 2 to-do human). Harness PR #69 (8 items); G1 in spec store; P10/P13 to-do (external cause). Spec store left uncommitted for the supervisor.
Evidence: retrospective-plan.md Status: CLOSED; HANDOFF closeout section; PR https://github.com/madmatt112/spec-workflow-mcp/pull/69
Cost: 2 spawns total: 1 implementer, 1 verifier
