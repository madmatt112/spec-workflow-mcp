
## 2026-09-17T17:51:42Z · requirements · v1 · harness-defect
The previous run was interrupted inside the document orchestrator after the v1 checkpoint, during the lint reviser and before the gate-A emit. On resume the supervisor's gate-A recheck keys on a questions.md receipt, which is only written after the orchestrator returns gate-a, and orient reports Step 2 for v1, so a normal re-dispatch would skip both the v1 lint pass and gate A. The supervisor ran gate A by hand from the fresh gate-a.json surface and logged the deviation.
Evidence: harness-events.jsonl run-20260917-170349 (spawn.start sdd-reviser lint, no spawn.end, no phase.end); gate-a.json mtime after requirements.md
Cost: 1 wasted orchestrator spawn plus drafter; lint reviser spawn lost

## 2026-09-17T17:55:53Z · requirements · v1 · harness-defect
Gate A asked the human five decisions phrased as implementation mechanics (recording sites, storage layout, pinned constants, diff transport). The human answered every one with 'you choose' and said the weeds had been detailed by agents. The gate produced no signal: the supervisor kept all recorded choices. The drafter's gate-A extraction should rank and phrase decisions as user-visible outcomes and trade-offs, or the gate should not fire when no decision is judgeable without the codebase.
Evidence: specs/worktree-review-signals/questions.md gate A answers
Cost: 1 AskUserQuestion call, 4 answers, all delegated
