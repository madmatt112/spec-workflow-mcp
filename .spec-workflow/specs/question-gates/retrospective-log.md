# Retrospective log — question-gates

## 2026-09-16T20:10:22Z · requirements · v1 · gotcha
Round 1 adversarial review: iterate, MUST_FIX 1 / SHOULD_FIX 4 / MINOR 4. MUST_FIX: gate B lacks a fire-once guard (Req 4.1+5.1 re-run it, contradicting Req 5.3). SHOULD_FIX: undefined orchestrator->supervisor payload channel; undefined class-(a) no-list behaviour; extract/rank assigned to a role forbidden from reading document bodies; gate-A annotation unrouted.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn
