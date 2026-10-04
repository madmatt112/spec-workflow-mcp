
## 2026-10-03T03:01:51Z · requirements · v1 · gotcha
round 1 review of v1: iterate, MUST_FIX 0 / SHOULD_FIX 4 / MINOR 3; fresh lens wire contracts; findings R1-1..R1-4 SHOULD_FIX
Evidence: reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-10-03T03:35:48Z · requirements · v2 · gotcha
round 2 review of v2: iterate, MUST_FIX 0 / SHOULD_FIX 2 / MINOR 3; fresh lens cold-read truth table; R2-1 input-W/base definition, R2-2 idempotency misses retro-log+HANDOFF (Compounds R1-3). MUST_FIX 0 SHOULD_FIX>0 at D=2 routes to SHOULD_FIX-only corrective pass
Evidence: reviews/adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn

## 2026-10-03T03:43:24Z · requirements · v3 · gotcha
narrow check r3 VERIFIED 2/2; deferred finding: Req 1.5 base formula does not restate which call (first call of spawn vs first overall) it scopes to; worth a second look in design if ambiguity surfaces
Evidence: reviews/adversarial-analysis-requirements-r3.md
Cost: 1 checker spawn

## 2026-10-03T03:44:33Z · requirements · phase · cleanup
requirements approved at v3 after 3 rounds; verdict trajectory 0/4/3 → 0/2/3 → narrow 2/2 → converged; rulings 0; cap not hit (SHOULD_FIX-only pass at v3); prune removed 0 records and 0 snapshots.
Evidence: approval_1790999009526_1ta45f5k3; reviews/adversarial-analysis-requirements-r2.md
Cost: 2 reviewer + 2 reviser spawns, 1 checker

## 2026-10-03T04:25:51Z · design · v1 · gotcha
Round 1: iterate MUST_FIX 0 / SHOULD_FIX 1 / MINOR 2. R1-1 (SHOULD_FIX): QueuedTask.testFiles and integration added with no named consumer; integration keys off '- Test (integration):', absent from all tasks.md. R1-2/R1-3 MINOR.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn

## 2026-10-03T04:25:51Z · design · v1 · ruling
Reviewer ruled all five drafter RE-DECIDED flags refinement (closed), within each governing requirement's intent: Req 1.5 per-call W from last line of each message.id; Req 3.3 lint rules inline in the Lint step; Req 4.2 orient returns the whole open-task queue with files and test files; Req 6.4 one generic book.sh written by a harness brief template; Req 7.3 runaway guard uses the task total. Carry to the tasks drafter.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design.md
Cost: no extra spawn (ruled in round 1)

## 2026-10-03T04:38:59Z · design · v2 · gotcha
Round 2: iterate MUST_FIX 1 / SHOULD_FIX 1 / MINOR 0, both Novel. R2-2 MUST_FIX (carried): Error Handling 'no usage line' branch has no discriminant in the SpawnSources union (breakdownTranscript null maps to no reason). R2-1 SHOULD_FIX: C6 brief-template refactor under-accounts for the existing briefAction test suite. v2 deltas verified clean, no fix-induced regression.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design-r2.md
Cost: 1 reviewer spawn

## 2026-10-03T07:48:37Z · design · v3 · gotcha
design round 3: iterate 0 MUST_FIX / 2 SHOULD_FIX / 0 MINOR; both v3 deltas (no-usage discriminant, brief-template test-accounting) re-verified clean; two residual halves of R2-1 open as R3-1, R3-2 (both Compounding SHOULD_FIX) -> SHOULD_FIX-only corrective pass
Evidence: reviews/adversarial-analysis-design-r3.md
Cost: 1 reviewer spawn

## 2026-10-03T07:57:02Z · design · v4 · gotcha
narrow-check deferred finding: design.md passthrough sentence lists only findings/folds/notes/re-decided; the new author-files/author-report wire is a separate sentence not folded into the enumerated list, so a reader skimming only the list could miss it. Readability MINOR, non-blocking.
Evidence: reviews/adversarial-analysis-design-r4.md
Cost: part of narrow-check spawn (no extra cost)

## 2026-10-03T07:58:22Z · design · phase · cleanup
design approved at v4 after 4 rounds; verdict trajectory 0/1/2 -> 1/1/0 -> 0/2/0 -> SHOULD_FIX-only pass, narrow check VERIFIED 2/2; rulings 0; cap not hit (SHOULD_FIX-only corrective pass at v4 after round 3, not a post-cap adjudication); prune removed 0 records and 0 snapshots (2 kept). One narrow-check deferred readability note logged above.
Evidence: approval_1791014244719_pyabfk5zm; reviews/adversarial-analysis-design-r3.md; reviews/adversarial-analysis-design-r4.md
Cost: 4 reviewer (3 review rounds + 1 narrow check) + 3 reviser spawns (v2, v3, v4); no adjudicator

## 2026-10-03T08:38:17Z · tasks · v1 · gotcha
tasks R1: iterate 0 MUST_FIX / 4 SHOULD_FIX / 1 MINOR; cold-prompt lens found 4 grep/brief-variant defects (R1-1..R1-4) and 1 MINOR (R1-5). Req 7.3 runaway-guard basis ruled refinement by the reviewer on its own authority (design D14 sizes the guard from task total, not the requirement's open-tasks); closed and carried to the next drafter, so the Req 7.3 text is now stale.
Evidence: .spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-10-03T09:02:06Z · tasks · v2 · gotcha
tasks R2: iterate 0 MUST_FIX / 1 SHOULD_FIX / 2 MINOR. All five v2 fix-induced greps verified clean; every v2-delta citation resolves. R2-1 (SHOULD_FIX, Compounds R1-1): task 13 names only the Reconcile/e2e brief re-point, leaving the kept per-task-loop and Repair calls unaddressed though tasks 8/9 replace those templates and task 13 deletes briefs.md. R2-2, R2-3 MINOR. Routes to SHOULD_FIX-only corrective pass (D=2, MUST_FIX 0).
Evidence: .spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-tasks-r2.md
Cost: 1 reviewer spawn

## 2026-10-03T09:10:32Z · tasks · phase · cleanup
tasks approved at v3 after 3 rounds; verdict trajectory 0/4/1 → 0/1/2 → SHOULD_FIX-only pass at v3, narrow check VERIFIED 3/3; rulings 1 (Req 7.3 runaway-guard basis = refinement, carried to next drafter); cap not hit; prune removed 0 records and 0 snapshots (2 kept).
Evidence: approval_1791018590058_j7ukpmynx; .spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-tasks-r2.md; .spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-tasks-r3.md
Cost: 2 reviewer + 2 reviser spawns, 1 narrow-check checker, 1 drafter

## 2026-10-04T02:36:17Z · implementation · task 1 · gotcha
New-module-scale change (241 changed lines) routed high risk; verifier passed round 1 with 0 findings. rounds 0, outcome pass.
Evidence: task 1; src/watch/usage.ts
Cost: 1 author + 1 implementer + 1 verifier spawn

## 2026-10-04T02:56:12Z · implementation · task 2 · gotcha
New pure module sources.ts; verifier passed round 1 with 1 immaterial info (substring form). rounds 0, outcome pass.
Evidence: task 2; src/watch/sources.ts
Cost: 1 author + 1 implementer + 1 verifier spawn

## 2026-10-04T03:07:10Z · implementation · task 3 · gotcha
New module transcripts.ts (path-traversal defense); verifier passed round 1 with 0 findings. rounds 0, outcome pass. Third consecutive clean new-module verifier; batching enabled for later non-sensitive tasks.
Evidence: task 3; src/watch/transcripts.ts
Cost: 1 author + 1 implementer + 1 verifier spawn

## 2026-10-04T03:15:13Z · implementation · task 4 · doc-gap
AC 1.9 'without sources the output is byte-identical' is RED-IMPOSSIBLE at base (sources is an ignored arg today, so omitting it already yields spec-store-only output before any code exists). Carried to the implementer brief as a regression guard, not a red test.
Evidence: task 4; src/tools/__tests__/harness.test.ts
Cost: 0 extra spawns

## 2026-10-04T03:22:55Z · implementation · task 4 · gotcha
sources option wired across harness.ts/sources.ts/docs; gate risk low (existing file, 182 lines added), review recorded by gate. rounds 0, outcome gate.
Evidence: task 4; reviewId 7ea76279
Cost: 1 author + 1 implementer spawn

## 2026-10-04T03:40:45Z · implementation · task 5 · harness-defect
A spec-store-only (verification-only) task's implementer runs in the worktree session, where the shell guard blocks reaching the main checkout, so it cannot run commit-spec-store.sh; baseline files landed on feat (7b83f87). Orchestrator relocated them to the main spec store and committed there. For task 15, have the implementer leave files in the scratch dir and let the orchestrator relocate+commit.
Evidence: task 5; 7b83f87 on feat; main commit of baseline files
Cost: 1 implementer spawn + orchestrator relocation

## 2026-10-04T03:51:22Z · implementation · task 6 · gotcha
orient queue/nextTask/decomposition added to harness.ts; gate risk low, review recorded. rounds 0, outcome gate.
Evidence: task 6; reviewId d532fb24
Cost: 1 author + 1 implementer spawn

## 2026-10-04T04:07:29Z · implementation · task 7 · gotcha
New module brief-templates.ts (pure move of 6 kinds); gate high (260 lines + tests-not-touched, both expected); verifier confirmed byte-identical, 0 findings. rounds 0, outcome pass.
Evidence: task 7; src/tools/brief-templates.ts
Cost: 1 implementer + 1 verifier spawn

## 2026-10-04T06:06:38Z · implementation · task 9 · gotcha
Implementation brief kinds ported; batched verify (with 8,10) passed task 9, report sentences replaced by C9, redTests repointed without weakening coverage. rounds 0, outcome pass.
Evidence: task 9; commit dd71a72
Cost: 1 author + 1 implementer + shared batched verifier

## 2026-10-04T06:06:38Z · implementation · task 10 · gotcha
book-script kind with all 8 C7 segments; batched verify passed task 10, strong idempotency test. rounds 0, outcome pass.
Evidence: task 10; commit bee6506
Cost: 1 author + 1 implementer + shared batched verifier

## 2026-10-04T06:15:16Z · implementation · task 8 · gotcha
Ported document-phase brief kinds; batched verify caught non-verbatim reviewer round section (dropped 'Compounds: R<k>-<n>' seam + 2 warnings + stale adjudicator bullet); 1 fix round restored verbatim text and corrected a mis-pinned snapshot. rounds 1, outcome pass. Lesson: ported-verbatim briefs need snapshots pinned to the exact source text, else a paraphrase slips through the gate.
Evidence: task 8; commit 9c4cd9f
Cost: 1 author + 1 implementer + 1 fix + shared batched verifier + 1 narrow verifier

## 2026-10-04T06:20:10Z · implementation · task 11 · gotcha
C9 report blocks across 8 agent files + plugin sync; gate low, review recorded, plugin-assets + validate green. rounds 0, outcome gate.
Evidence: task 11; reviewId a09f064c
Cost: 1 implementer spawn

## 2026-10-04T06:45:04Z · implementation · task 12 · harness-defect
Task 8's document-phase renderChecker/renderAdjudicator leave literal placeholders (<analysis output path>, <D>, <r<A> analysis path>, <memory file path>, <CODE_ROOT>) that are not server-filled and the lean orchestrator no longer fills; a checker/adjudicator brief would render with unfilled slots. Flagged by task 12's implementer at Step 4b; needs a task-8 follow-up fix on brief-templates.ts before the e2e gate.
Evidence: task 12; src/tools/brief-templates.ts renderChecker/renderAdjudicator
Cost: flagged during task 12 split

## 2026-10-04T07:06:01Z · implementation · task 12 · inefficiency
Doc-phase skill split (verifier pass, headings preserved, briefs.md+drift-guard deleted, bookkeeping via book.sh). Verifier investigation exposed a tasks-8+12 regression: document-phase checker/adjudicator server kinds left orchestrator-filled slots (<D>, analysis paths, CODE_ROOT, MUST_FIX/SHOULD_FIX counts, memory path, checker write target) as literal <...>; 1 fix round wired them as template keys and passed them from convergence.md. Lesson: when a brief slot the orchestrator used to fill moves server-side, it must become a template key, not stay literal. rounds 1, outcome pass.
Evidence: task 12; commits 53b7d1c + d2977a7; reviewId 2ed94b98
Cost: 1 author + 1 implementer + 1 fix + 1 verifier spawn

## 2026-10-04T07:24:46Z · implementation · task 13 · doc-gap
Task-9 fix ci/reconcile and verifier ci/e2e kinds render literal <check names>/<log paths>/<suite> with no value slot; unlike task 12's checker/adjudicator this degrades gracefully (the CI/e2e worker self-discovers them, and the orchestrator supplies the scenario+suite via the brief job). Flagged for the task-13 verifier to confirm hard-vs-soft before deciding a fix.
Evidence: task 13; src/tools/brief-templates.ts fix/verifier ci+e2e variants
Cost: flagged during task 13 split

## 2026-10-04T07:39:17Z · implementation · task 13 · inefficiency
Impl-phase skill split (verifier confirmed C8 split, routing, book.sh, orient reads, 5-task budget, Req 7.5). Verifier caught 2 criticals: (1) missing Req 5.3 'missing report block re-spawns once then PHASE: error' rule in SKILL.md; (2) task-9 CI variants (renderCiFix/renderVerifierCi) ignored findings and emitted literal <check names>/<sha>/<command> with no slot — a hard gap breaking the reconcile-red-PR path. 1 fix round added the rule and slotted the CI variants. Lesson: dynamic brief variants (CI/reconcile) need real value slots, not literal placeholders; and every skill-split must carry the stall-on-missing-block rule. rounds 1, outcome pass.
Evidence: task 13; commits 39420cb + 6162859; reviewId 44653a6c
Cost: 1 author + 1 implementer + 1 fix + 1 verifier spawn

## 2026-10-04T07:42:40Z · implementation · task 14 · gotcha
Supervisor launch budget set to 5 tasks and runaway guard scaled to max(12, ceil(T/B)+4) for implementation (D14 task total); gate low, review recorded, harness checks pass. rounds 0, outcome gate.
Evidence: task 14; reviewId bb963c24
Cost: 1 implementer spawn
