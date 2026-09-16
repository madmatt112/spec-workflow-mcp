# Retrospective log — question-gates

## 2026-09-16T20:10:22Z · requirements · v1 · gotcha
Round 1 adversarial review: iterate, MUST_FIX 1 / SHOULD_FIX 4 / MINOR 4. MUST_FIX: gate B lacks a fire-once guard (Req 4.1+5.1 re-run it, contradicting Req 5.3). SHOULD_FIX: undefined orchestrator->supervisor payload channel; undefined class-(a) no-list behaviour; extract/rank assigned to a role forbidden from reading document bodies; gate-A annotation unrouted.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-09-16T20:26:39Z · requirements · v2 · gotcha
Round 2 adversarial review: iterate, MUST_FIX 1 / SHOULD_FIX 2 / MINOR 3. All findings compound incomplete round-1 fixes: R2-1 (MUST_FIX, Compounds R1-1) Req 4 AC 1 vs Req 5 AC 6 contradiction; R2-2 (SHOULD_FIX, Compounds R1-2/R1-4) drafter->orchestrator wire gap; R2-3 (SHOULD_FIX, Compounds R1-6) mixed change+annotate. Lint L-1..L-5 (citation-identifier false positives) carried to reviewer.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn
