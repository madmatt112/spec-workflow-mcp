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
