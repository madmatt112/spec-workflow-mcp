
## 2026-09-17T17:51:42Z · requirements · v1 · harness-defect
The previous run was interrupted inside the document orchestrator after the v1 checkpoint, during the lint reviser and before the gate-A emit. On resume the supervisor's gate-A recheck keys on a questions.md receipt, which is only written after the orchestrator returns gate-a, and orient reports Step 2 for v1, so a normal re-dispatch would skip both the v1 lint pass and gate A. The supervisor ran gate A by hand from the fresh gate-a.json surface and logged the deviation.
Evidence: harness-events.jsonl run-20260917-170349 (spawn.start sdd-reviser lint, no spawn.end, no phase.end); gate-a.json mtime after requirements.md
Cost: 1 wasted orchestrator spawn plus drafter; lint reviser spawn lost
