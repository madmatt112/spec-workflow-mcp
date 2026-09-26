# Verification evidence — graph-orientation

Live scenarios (2), (3) and (4) run against the merged checkout after `npm run build`
and a session restart. The retrospective phase requires every line below to read
`passed` before it starts.

- (2) passed — a supervisor launch on a checkout with no graphify on PATH carries GRAPH: none and a run.start row without graph keys. Evidence 2026-09-26 (run-20260926-135506): fixture with a graph.json, PATH without graphify → `sdd-graph.sh fact` printed GRAPH: none / GRAPH_BEHIND: n/a / GRAPH_BUILT_AT: n/a; the run.start row from the formats.md event.sh has no graph or graphBehind key
- (3) pending — a requirements phase on a fixture spec with a graph: every codebase-context.md range exists in the code root, and harness-activity.jsonl shows the drafter's first graphify explain or query before its first raw read of the code root
- (4) passed — a fixture checkout whose agent-rules.md omits the worktree-per-change line: after an implementer commit that changes the code graph, graph.json built_at_commit equals HEAD. Evidence 2026-09-26 (run-20260926-135506): fixture without worktree-per-change, graph built at 07dc29c, graph-changing commit → HEAD 3f71206, fact GRAPH_BEHIND: 1; `sdd-graph.sh refresh` → refresh: ok, GRAPH_BEHIND: 0, built_at_commit 3f71206 == HEAD (commit authored by the operator, not an sdd-implementer)
