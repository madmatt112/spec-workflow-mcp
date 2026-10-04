# Verification evidence — lean-orchestrators

Scenario (1) ran in this baseline task while the orchestrator transcripts still
existed. Lines (2) and (3), added by the fixture task, run against the merged
checkout after `npm run build` and a session restart. The retrospective phase
requires every line below to read `passed` before it starts.

- (1) passed — all 5 document and implementation orchestrator spawns of tdd-task-loop resolve, each transcript W within 1% of its ledger W; largest diff 0.00% (2.1875e-16). Evidence 2026-10-03 (CODE_ROOT b8c53b4): `usage` with `sources: true` ran from the worktree build via /tmp/scratchpad/sdd/lean-orchestrators/baseline.mjs (the session's own MCP server is the main-checkout build and lacks the option), 5 resolved, 0 unknown, recorded verbatim in baseline-sources.md
