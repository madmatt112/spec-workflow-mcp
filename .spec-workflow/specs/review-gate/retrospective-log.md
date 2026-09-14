# Retrospective log — review-gate

## 2026-09-14T04:00:00Z · requirements · gotcha · round 1
Round 1 on v1: iterate MUST_FIX 2 / SHOULD_FIX 5 / MINOR 1. Two claim errors from the drafter (R1-1: AC 3.3 misstates the task-parser block span at task-parser.ts:175; R1-2: home-item gate contradicts the "no git repo at root" rule in AC 1.3/1.8). Five gaps: close-out verify brief and step 4 not edited (R1-3), typecheck array reduction unspecified (R1-4), verifier standing rule still says run checks yourself (R1-5), no ledger note for close-out gate calls (R1-6), no terminus for a gate that fails after the cap (R1-7).
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-09-14T04:40:00Z · requirements · inefficiency · round 2
Round 2 on v2: iterate MUST_FIX 1 / SHOULD_FIX 3 / MINOR 1. All four substantive findings are Compounding on the v2 delta: R2-1 (AC 1.2 added in v2 contradicts AC 1.3 on what `root` governs), R2-2 (the files-only item gate carved out in v2 leaves the AC 1.6 response contract undefined), R2-3 (the v2 terminus in AC 6.3 spawns a verifier that AC 6.5 tells not to run the checks), R2-4 (AC 7.6's close-out Verify spawn not made conditional for all-low batches). Every round-1 fix and every delta citation verified. Pattern: each round-1 fix opened a seam with a neighbouring AC; a truth-table pass at draft time would have caught R2-1 and R2-3.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn

## 2026-09-14T05:20:00Z · requirements · gotcha · round 3
Round 3 on v3: iterate MUST_FIX 0 / SHOULD_FIX 2 / MINOR 1, no Recurring. Both Novel, from the cost-of-touching lens: R3-1 (AC 1.3/1.6 add a `skipped` member to `TypecheckMethodologyState` at review-task.ts:45-52, which breaks the exhaustive `renderTypecheckDirective` switch at :793-810 under strict tsc; the document names no edit there) and R3-2 (AC 9.2's "all three tasks reviewed" is unreachable for the high-risk and gate-fail fixture tasks as written). Every v3 delta citation verified. R3-1 is a downstream consequence of the v2/v3 files-only carve-out; the reviser did not chase the new union member to its consumers.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-requirements-r3.md
Cost: 1 reviewer spawn

## 2026-09-14T05:04:00Z · requirements · inefficiency · round 4
Round 4 on v4 (second spawn of this phase, after a budget stop at v4 unreviewed): converged MUST_FIX 0 / SHOULD_FIX 0 / MINOR 2, no Recurring, DESIGN_READY yes. All three v4 fixes (R3-1 typecheck-state consumer edit, R3-2 AC 9.2 fixture reachability, R3-3) verified against the code; fresh lens "every cited artifact re-read at both ends" found every citation matching. Two MINOR completeness nits left for design (R4-1: AC 9.2 names per-case outcomes but not the range inputs; R4-2: a `home` item with no named path leaves the item gate under-specified). Four rounds total: the phase needed one round beyond the run budget of 3, purely to confirm v4; the r3 verdict was already 0/2/1.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-requirements-r4.md
Cost: 1 reviewer spawn

## 2026-09-14T05:06:00Z · requirements · phase · cleanup
requirements approved at v4 after 4 rounds; verdict trajectory 2/5/1 → 1/3/1 → 0/2/1 → converged 0/0/2; rulings 0; cap not hit; prune removed 0 records and 0 snapshots (2 snapshots kept).
Evidence: approval_1789362305169_drifuf0rc; .spec-workflow/specs/review-gate/reviews/adversarial-analysis-requirements-r4.md
Cost: 4 reviewer + 3 reviser spawns (across two orchestrator spawns; budget stop after round 3)

## 2026-09-14T05:30:00Z · design · deviation · drafter re-decided req 1.4
Design v1 flags RE-DECIDED: 1.4 — the HEAD fallback shares the baseRef path, so untracked files count in the range (design D17). The requirement's literal reads as a tracked-only fallback; the design widens it for one code path. Reviewer round 1 should check whether this contradicts AC 1.4 or only sharpens it.
Evidence: .spec-workflow/specs/review-gate/design.md (D17); drafter report
Cost: 0 extra spawns

## 2026-09-14T05:30:00Z · design · deviation · drafter re-decided req 3.1
Design v1 flags RE-DECIDED: 3.1 — adds risk rule g: a hygiene rejection raises the risk level, justified from the NFR Reliability clause (design D21). Requirement 3.1 enumerates the risk rules without this one. Reviewer round 1 should decide whether rule g is a permitted refinement or a scope widening.
Evidence: .spec-workflow/specs/review-gate/design.md (D21); drafter report
Cost: 0 extra spawns

## 2026-09-14T05:55:00Z · design · gotcha · round 1
Round 1 on v1: iterate MUST_FIX 2 / SHOULD_FIX 1 / MINOR 2. Two claim errors from the drafter: R1-1 (`git diff-tree -m --first-parent` does not restrict a merge sha to its first parent; probed on git 2.43.0, so range stats and touched files are wrong for merge commits) and R1-2 (`filesOnly` has no mode guard, so a task-mode call with only `files` records a pass with zero checks, contradicting AC 3.1(a)). One gap: R1-3 (the 200-char reason cap is stated but not wired). Both drafter RE-DECIDED flags (1.4 via D17, 3.1 via D21) ruled permitted refinements by the reviewer. Truth-table lens used on `scoreRisk` and `decideGate`.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn

## 2026-09-14T06:35:00Z · design · inefficiency · round 2
Round 2 on v2: iterate MUST_FIX 0 / SHOULD_FIX 2 / MINOR 1. R2-1 (Compounding on the v2 delta): the R1-1 command replacement dropped `-c core.quotePath=false`, so commit-mode and ls-files emit C-quoted non-ASCII paths while the baseRef diff emits raw; `touched` mixes encodings and the sensitive-path match gets false negatives. R2-2 (Novel): baseRef untracked inclusion pulls any non-ignored file under root into touched/stats; the store-exclusion assumption is unstated and the e2e fixture never gitignores `.spec-workflow`. R2-3 (MINOR): review-task and review-gate import cycle. Pattern repeats the requirements phase: a round-1 fix opened a seam (a flag dropped when the command was swapped). Lens: cost of touching existing components.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-design-r2.md
Cost: 1 reviewer spawn

## 2026-09-14T07:05:00Z · design · gotcha · round 3
Round 3 on v3: iterate MUST_FIX 0 / SHOULD_FIX 1 / MINOR 4. The v3 delta held: the reviewer re-probed `-c core.quotePath=false` on all three git producers, the Node exec error taxonomy, and the import cycle, and found no claim error. R3-1 (Novel, SHOULD_FIX): `handleGate` in the new `review-gate.ts` cannot reach the file-private `runGit` in `task-diff.ts`, and `runGit` returns neither stderr nor an exit code, so the distinct "not a repo" and "bad ref" outcomes the design promises are unimplementable as written. Lens: failure, rollback and partial-failure paths.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-design-r3.md
Cost: 1 reviewer spawn

## 2026-09-14T07:30:00Z · design · inefficiency · round 4
Round 4 on v4 (second spawn, fresh orchestrator after a budget stop at 3 rounds): converged MUST_FIX 0 / SHOULD_FIX 0 / MINOR 2. The v4 delta held: R3-1..R3-5 verified against the tree; the R3-1 fix distinguishes "not a repo" from "bad ref" by ordering `rev-parse --show-toplevel` before the ref resolve, so it no longer needs `runGit` to surface stderr or an exit code. Fresh lens: every cited artifact re-read at both ends of its range across ~20 files; no misstated artifact, no symbol clash, reused exports match. R4-1 (MINOR, Novel): the 100-path display cap is not explicitly separated from rule evaluation (backstopped by the line-count rule). R4-2 (MINOR, Novel): exec taxonomy probed on node 24, CI asserts on node 20. Four review rounds for a design that had zero MUST_FIX after round 1; rounds 2-4 each chased one SHOULD_FIX opened by the previous delta, then a fourth round to confirm the last delta. A round-count budget of 3 forced a re-spawn just to run the confirming round.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-design-r4.md
Cost: 1 reviewer spawn

## 2026-09-14T07:32:00Z · design · phase · cleanup
design approved at v4 after 4 rounds; verdict trajectory 2/1/2 → 0/2/1 → 0/1/4 → converged 0/0/2; rulings 0; cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1789371101511_f179qeeah; .spec-workflow/specs/review-gate/reviews/adversarial-analysis-design-r4.md
Cost: 4 reviewer + 3 reviser spawns (plus 1 drafter), across two orchestrator spawns; the first stopped on a 3-round budget with v4 unreviewed

## 2026-09-14T08:10:00Z · tasks · deviation · v1 draft
Drafter re-flagged the design-phase RE-DECIDED items (D17: req 1.4 HEAD fallback via baseRef; D21: req 3.1 rule g hygiene rejection => high) as carried, not new; design r1 already ruled both permitted refinements. No new re-decisions in tasks v1. R4-1 absorbed in tasks 2, 4, 5; R4-2 in task 3 (node 20 named as CI target, no local probe: node 20 not installed).
Evidence: .spec-workflow/specs/review-gate/tasks.md v1 Revision History; drafter report
Cost: 1 drafter spawn

## 2026-09-14T08:25:00Z · tasks · gotcha · round 1
Round 1 on tasks v1: iterate 0/2/1. Both SHOULD_FIX are test-recipe gaps where the asserted verdict is unreachable with the named fixture (R1-1: task 5 pass/low case lacks agent-rules.md so risk rule a scores high; R1-2: task 6 dispatch test asserts data.gate against a non-git fixture whose task-diff mock does not cover the new range-stats path). R1-3 MINOR: task 1 citation two lines off. R4-1/R4-2 absorption verified. Lens: implementer with only the task prompt.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-09-14T08:40:00Z · tasks · inefficiency · round 2
Round 2 on tasks v2: iterate 0/1/1. R2-1 SHOULD_FIX compounds on the R1-1 delta: the v2 fix for task 5's pass/low case added an agent-rules.md fixture for risk rule a but rules c and e still score the fixture high, so the asserted verdict stays unreachable; the round-1 reviser fixed one rule without walking the full risk table. R2-2 MINOR: task 5 record-after-gate case omits the mandatory prepare step. v2 deltas for tasks 1 and 6 verified sound; fresh lens (cost of touching existing suites) found nothing.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-tasks-r2.md
Cost: 1 reviewer spawn

## 2026-09-14T08:55:00Z · tasks · inefficiency · round 3
Round 3 on tasks v3: iterate 0/1/0. v3 delta (task 5 full precondition set, named prepare) verified sound: reviewer walked all seven risk rules and five gate rules. R3-1 SHOULD_FIX compounds on R2-1/R1-1: the same rule-c precondition gap in task 7's e2e cases 1 and 3 and the reviewCoverage close (fixture task blocks unconstrained; rule c fires if they name tests). The round-2 memory file already flagged task 7 as next-round guidance and the round-2 reviser saw it but left it because it was not a round-2 finding; a sweep of the same defect class across all tasks at v3 would have saved this round. Lens: truth table of every prescribed test case.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-tasks-r3.md
Cost: 1 reviewer spawn

## 2026-09-14T09:40:00Z · tasks · inefficiency · round 4
Round 4 on tasks v4: converged 0/0/0. v4 delta (task 7 R3-1 fix: rule-c precondition on e2e cases 1 and 3 and the reviewCoverage close) verified sound: reviewer walked all seven risk rules and five gate rules. Fresh lens (intra-document shape consistency: reviewer field, computeRangeStats, runChecks, gate-rules exports, tool schema, reviewCoverage traced across tasks 1-10) found no mismatch. This round was a fourth spawn to confirm a one-line delta; the class of defect (test fixture that cannot produce the asserted verdict) was found three rounds in a row because each reviser fixed only the flagged task instead of sweeping the class, and the r3 reviser's sweep at v4 was the first that did.
Evidence: .spec-workflow/specs/review-gate/reviews/adversarial-analysis-tasks-r4.md
Cost: 1 reviewer spawn

## 2026-09-14T09:45:00Z · tasks · phase · cleanup
tasks approved at v4 after 4 rounds; verdict trajectory 0/2/1 → 0/1/1 → 0/1/0 → converged; rulings 0; cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1789374518950_4t4vkpi4q; .spec-workflow/specs/review-gate/reviews/adversarial-analysis-tasks-r4.md
Cost: 4 reviewer + 3 reviser spawns

## 2026-09-14T08:36:09Z · implementation · task 1 · gotcha
Task 1 (reviewer field on TaskReview) passed on the first verification; the tasks document's line citations were exact enough that the implementer touched only the four named files and the verifier confirmed the commit scope matched them.
Evidence: task 1; commit 11b84ff; src/types.ts, src/core/task-review-manager.ts and their tests
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T08:45:56Z · implementation · task 2 · gotcha
Task 2 (computeRangeStats) passed first verification; the implementer spent ~104k tokens, roughly double task 1, on nine git-fixture cases (root, later, merge first-parent, baseRef committed/uncommitted/untracked, ignored, rename, no repo, bad ref, unborn HEAD).
Evidence: task 2; commit e116392; src/core/task-diff.ts and its test
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T08:52:01Z · implementation · task 3 · gotcha
Task 3 (check runner) passed first verification. Node 20 is the CI runtime but only node 22/24 are installed locally; the tests pass on 24 and assert only killed/signal/code, so CI is the real node-20 check at the PR gate.
Evidence: task 3; commit 53ad8c9; src/core/check-runner.ts and its test
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T09:02:17Z · implementation · task 4 · gotcha
Task 4 (gate rules) passed first verification. The implementer reported its file paths under the main checkout instead of the worktree; the commit was on the worktree branch, so only the report was wrong. Worth stating the worktree path more loudly in the standing brief's report rule.
Evidence: task 4; commit 5265810; src/core/gate-rules.ts and its test
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T09:15:02Z · implementation · task 5 · gotcha
Task 5 (handleGate) passed first verification at ~127k implementer tokens, the largest task so far; the tasks doc's long _Prompt precondition list (rules a-g armed state per case, worked out over four adversarial rounds) meant no test fixture had to be rediscovered by trial.
Evidence: task 5; commit 1310358; src/tools/review-gate.ts and its test
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T09:19:37Z · implementation · task 6 · doc-gap
Implementer changed the review-task description header "Two actions" to "Three actions"; the task and design both located the bullet list by that header without saying to update the count word, so a strict reviewer could read the one-word edit as outside the enumerated touch list.
Evidence: task 6; commit f313676; src/tools/review-task.ts description string
Cost: none (flag only)

## 2026-09-14T09:21:52Z · implementation · task 6 · gotcha
Task 6 (gate dispatch in review-task) passed first verification; review-task.ts is on the sensitive-path list, so the verifier confirmed with git show that every hunk sat in the five named spots and the byte-pinned constants were untouched.
Evidence: task 6; commit f313676; src/tools/review-task.ts and its test
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T09:31:04Z · implementation · task 7 · gotcha
Task 7 (e2e gate test) passed first verification; the decomposition's verification scenario now runs as a vitest test with real git and no mocks, so the completion gate's npm test covers it on CI's node 20.
Evidence: task 7; commit 1acc83f; src/tools/__tests__/review-gate.e2e.test.ts
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T09:40:27Z · implementation · task 8 · gotcha
Task 8 (implementation skill routes on the gate) passed first verification; the verifier confirmed the skill's argument and data field names against the shipped review-gate.ts, which the tasks doc did not ask for but which the brief's context note requested. Harness edits regenerate 12 plugin copies per commit.
Evidence: task 8; commit f5f899c; harness/skills/sdd-implementation-phase, harness/agents
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T09:48:31Z · implementation · task 9 · gotcha
Task 9 (close-out skill gates items) passed first verification; pointing the brief at task 8's already-merged wording kept the two skills' gate sections consistent without a second pass.
Evidence: task 9; commit ab7403b; harness/skills/sdd-closeout-phase, harness/agents/sdd-closeout-orchestrator.md
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T09:55:01Z · implementation · task 10 · gotcha
Task 10 (docs) passed first verification; the verifier checked each doc line against the shipped schema and GateData rather than the design, per the brief's context note. All ten tasks passed on round 1 with no fix rounds.
Evidence: task 10; commit 60c0981; docs/TOOLS-REFERENCE.md, docs/SDD-HARNESS.md
Cost: 1 implementer + 1 verifier spawn

## 2026-09-14T09:58:20Z · implementation · phase · cleanup
review-gate implemented: 10 tasks, 0 fix rounds, 0 adjudications, 21 spawns (10 implementer, 10 verifier, 1 end-to-end verifier), 0 deferrals added (12 deferred in total). Every task passed verification on round 1; the end-to-end verifier ran the decomposition scenario as the vitest e2e test plus the full suite (1097 passed, 5 skipped), build, plugin-assets check and plugin validate.
Evidence: .spec-workflow/specs/review-gate/tasks.md (10/10); code commits 11b84ff..60c0981 on feat/review-gate; harness-events.jsonl run-20260914-031800
Cost: 21 spawns, ~1.7M subagent tokens

## 2026-09-14T10:15:42Z · retrospective · phase · cleanup
Retrospective compiled: 22 findings (gotchas 3, product bugs 1, tool/MCP 3, harness defects 3, prompt misunderstandings 1, inefficiencies 4, documentation gaps 2, model behaviour 2, process deviations 1, decisions for the human 2; repeat patterns none, first retrospective in this store); 22 proposals, 4 decisions needed, 2 graduation candidates. Retro-log timestamps in earlier entries are hand-typed (F8); this one is from the clock.
Evidence: .spec-workflow/specs/review-gate/retrospective.md; .spec-workflow/specs/review-gate/retrospective-proposals.md
Cost: 1 analyst spawn, 133,884 tokens

## 2026-09-14T12:24:28Z · closeout · store batch 1 · cleanup
Store batch 1 landed P1, P2, G2 and the agent-rules.md half of P22 in `.spec-workflow/agent-rules.md`; verified on round 1, no fix rounds. No commit: `.spec-workflow/` is gitignored on `sdd/review-gate`, so the edits ride into the P3 baseline commit in the harness batch. Six `none` items (P4, P13, P15, P16, P18, P21) skipped as the plan decided; P14 is a human to-do because `docs/harness-efficiency-plan.md` is untracked and outside every landing root.
Evidence: .spec-workflow/agent-rules.md; .spec-workflow/specs/review-gate/retrospective-plan.md `## Close-out`
Cost: 1 implementer + 1 verifier spawn, ~47k subagent tokens

## 2026-09-14T12:46:54Z · closeout · harness batch 1 · cleanup
Harness batch 1 landed 13 items (P5, P6, P7, P8, P9, P10, P11, P12, P17, P19, P20, the skill half of P22, then P3) as 13 commits a0cc349..20b3ab5 on `chore/review-gate-retro`; verified on round 1, no fix rounds. P3's baseline commit tracks the spec store (286 files) and carries the store batch's `agent-rules.md` edits. The verifier accepted two scope notes: P9's "three" to "four" in docs/SDD-HARNESS.md (count consistency) and P12's generalisation of the Step 0 flag and Step 4b item source (needed for cross-spawn resume). Checks: plugin-assets, plugin validate, tsc, vitest log-implementation all pass.
Evidence: worktree .claude/worktrees/review-gate-retro; retrospective-plan.md `## Close-out`
Cost: 1 implementer + 1 verifier spawn, ~195k subagent tokens

## 2026-09-14T12:48:22Z · closeout · phase · cleanup
review-gate closed: 23 items, 16 done (3 store, 13 harness), 1 to-do for the human (P14: the efficiency plan document is untracked), 6 skipped (the plan chose no change). Two batches, 0 fix rounds, 0 adjudications, 4 spawns (2 implementer, 2 verifier). One PR, #30 on `chore/review-gate-retro`, not merged. P3 turned the spec store into tracked files on that branch; the live store in the main checkout is still ignored and newer than the baseline.
Evidence: .spec-workflow/specs/review-gate/retrospective-plan.md `## Close-out`; https://github.com/madmatt112/spec-workflow-mcp/pull/30; harness-events.jsonl run-20260914-031800
Cost: 4 spawns, ~242k subagent tokens
