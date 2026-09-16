# Retrospective log — question-gates

## 2026-09-16T20:10:22Z · requirements · v1 · gotcha
Round 1 adversarial review: iterate, MUST_FIX 1 / SHOULD_FIX 4 / MINOR 4. MUST_FIX: gate B lacks a fire-once guard (Req 4.1+5.1 re-run it, contradicting Req 5.3). SHOULD_FIX: undefined orchestrator->supervisor payload channel; undefined class-(a) no-list behaviour; extract/rank assigned to a role forbidden from reading document bodies; gate-A annotation unrouted.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-09-16T20:26:39Z · requirements · v2 · gotcha
Round 2 adversarial review: iterate, MUST_FIX 1 / SHOULD_FIX 2 / MINOR 3. All findings compound incomplete round-1 fixes: R2-1 (MUST_FIX, Compounds R1-1) Req 4 AC 1 vs Req 5 AC 6 contradiction; R2-2 (SHOULD_FIX, Compounds R1-2/R1-4) drafter->orchestrator wire gap; R2-3 (SHOULD_FIX, Compounds R1-6) mixed change+annotate. Lint L-1..L-5 (citation-identifier false positives) carried to reviewer.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn

## 2026-09-16T20:33:46Z · requirements · v3 · inefficiency
spec-lint citation-identifier warnings recur each version: the rule flags this document's own defined terms (record, headless, question, options) when they sit on a line that also carries a citation scoped to a different clause. Rejected in v2 and v3 lint passes (5 then 9 findings); count grows because each version's Revision History disposition bullets re-name the terms. Warnings only, never blocking, but they cost a lint reviser spawn per version. Candidate: lint should ignore backtick terms inside Revision History bullets, or citation-identifier should scope to the clause not the line.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md
Cost: 1 reviser spawn per version (lint)

## 2026-09-16T20:42:09Z · requirements · v3 · gotcha
Round 3 adversarial review: iterate, MUST_FIX 0 / SHOULD_FIX 3 / MINOR 1. R2-1/R2-3 verified resolved. Open SHOULD_FIX: R3-1 (drafter has no MCP tool to write the gate-A surface, Compounds R2-2), R3-2 (gate A dropped on supervisor interruption, Novel), R3-3 (partial/mid-sequence AskUserQuestion return across the two gate-A calls undefined, Novel); MINOR R3-4 (record-mode write-failure behaviour). MUST_FIX 0 with SHOULD_FIX>0 at D=3 routes to a SHOULD_FIX-only corrective pass + narrow check, no further review round.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements-r3.md
Cost: 1 reviewer spawn
