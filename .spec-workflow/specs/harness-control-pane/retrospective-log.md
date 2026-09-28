
## 2026-09-28T20:18:20Z · requirements · v1 · gotcha
Round 1 on v1: iterate, MUST_FIX 1 / SHOULD_FIX 4 / MINOR 3. R1-1 is a scope contradiction (AC 2.9 writes new run.start ledger fields that decomposition boundary note and D14 forbid). R1-2..R1-5 are wire/validation gaps.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-09-28T20:54:15Z · requirements · v2 · inefficiency
Round 2 on v2: iterate 1/2/3. All findings fix-induced by the v2 lint trim: R2-1 (MUST_FIX) scope-note citation 753-754 landed on an unrelated note and short of the quoted phrase (correct 754-755); R2-2 (SHOULD_FIX) trim dropped 'distinct from initial/projects-update' from AC 4.9/5.10 and AC 5.10's type enumeration; R2-3 (SHOULD_FIX) AC 4.9 'only harness subscribers via existing broadcastToProject' contradicts that helper's projectId-only filter. Lesson: an aggressive over-cap trim can move citations off quoted text and weaken accepted wire-contract ACs.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn

## 2026-09-28T21:09:28Z · requirements · v3 · gotcha
Round 3 on v3: iterate 0/6/3; MUST_FIX 0 routes to a SHOULD_FIX-only corrective pass. The v3 delta verified clean (no regression). The failure-paths fresh lens surfaced 6 novel SHOULD_FIX gaps: R3-1 log-lines push left unrouted (compounds R2-3), R3-2 dashboard as a second concurrent writer of the machine-wide active-run pointer with no atomic-rewrite requirement, R3-3 no liveness reconciliation on restart/half-stop, R3-4 no launch error/rollback path, R3-5 preflight-refused run orphans harness-run.json, R3-6 check-to-spawn race with a terminal launch.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r3.md
Cost: 1 reviewer spawn
