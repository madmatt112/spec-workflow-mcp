
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
