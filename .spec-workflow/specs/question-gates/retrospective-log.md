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

## 2026-09-16T20:58:17Z · requirements · v4 · gotcha
Narrow check VERIFIED 3/3 (R3-1/R3-2/R3-3 all addressed). Deferred finding: the v4 Revision History disposition bullet says R3-1 'deleted' the drafter 'directly to the gate-A server surface' claim and D2's 'needs no relay' clause, but both phrases remain verbatim (Req 2 AC1, D11, D2); the fix instead added a preceding capability-grant clause that grounds the retained language, so the changelog wording overstates the change. Cosmetic changelog nit, not a requirements defect; content is grounded.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements-r4.md
Cost: 1 checker spawn

## 2026-09-16T21:00:42Z · requirements · phase · cleanup
requirements approved at v4 after 4 rounds; verdict trajectory 1/4/4 -> 1/2/3 -> 0/3/1 -> SHOULD_FIX-only pass at v4, narrow check VERIFIED 3/3; rulings 0; cap not hit (exited via SHOULD_FIX-only pass, not the budget cap); prune removed 0 records and 0 snapshots (2 kept).
Evidence: approval_1789592305465_kil5tyx1t; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements-r3.md
Cost: 3 reviewer + 7 reviser (4 lint, 3 content) + 1 drafter + 1 narrow-check spawns

## 2026-09-16T21:08:06Z · requirements · phase · harness-defect
The four SDD orchestrator agent definitions (sdd-document/implementation/closeout/retro-orchestrator.md) do not allowlist the `harness` MCP tool, yet the phase skills call `harness orient` (Step 0) and `harness brief` (Lint step + revise step). Every 5.7.0 orchestrator run silently falls back to manual orient/brief, defeating harness-bookkeeping's core token saving and leaving reviews/lint-brief-<PHASE>-v<D>.md unwritten. Root cause is the missing allowlist entry, not a stale plugin cache.
Evidence: plugins/spec-workflow-harness/agents/sdd-document-orchestrator.md tools list ends at spec-lint (line 36); sdd-document-phase SKILL.md lines 108,160 call harness brief; run run-20260916-194812 has no lint-brief file and the orchestrator reported briefing manually
Cost: manual orient/brief every phase; token overhead unquantified this run

## 2026-09-16T21:52:56Z · design · v1 · gotcha
Round 1 review: iterate, MUST_FIX 0 / SHOULD_FIX 4 / MINOR 2. Wire-contract lens found 4 SHOULD_FIX seams (gate-B run-once, gate-put payload location contradiction, Req 2 AC 2 reword actor, AskUserQuestion option/answer round-trip) and 2 MINOR data-model/parser field gaps.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn
