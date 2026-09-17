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

## 2026-09-16T22:21:46Z · design · v2 · inefficiency
Round 2 review: iterate, MUST_FIX 0 / SHOULD_FIX 3 / MINOR 2. R2-1 and R2-2 compound R1-3 (the v2 delta): the narrow drafter re-spawn overwrites gate-a.json and has no observable trigger. R2-3 (novel) gate-B (b)/(c) reads forbidden document bodies. D>=2 with no MUST_FIX routes to a SHOULD_FIX-only corrective pass, no further review round.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-design-r2.md
Cost: 1 reviewer spawn

## 2026-09-16T22:47:33Z · design · v3 · gotcha
Narrow check VERIFIED 3/3 for the SHOULD_FIX-only pass (R2-1, R2-2, R2-3 all addressed). Deferred: Component 4's gate-A bullet cites sdd-document-phase/SKILL.md:102-105 for where LINT.findings/LINT.open sit on the task list; the actual LINT assignment/numbering is at lines 104-107 (102-105 is the spec-lint-unavailable branch). Citation drift only; R2-2's fix substance unaffected.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-design-r3.md
Cost: 1 checker spawn

## 2026-09-16T22:49:25Z · design · phase · cleanup
design approved at v3 after 3 rounds; verdict trajectory 0/4/2 -> 0/3/2 -> SHOULD_FIX-only pass, narrow check VERIFIED 3/3; rulings 0; cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1789598861550_cv4ve6r44; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-design-r3.md
Cost: 1 drafter + 2 reviewer + 1 checker + 5 reviser spawns

## 2026-09-16T23:30:19Z · tasks · v1 · gotcha
Round 1 review: iterate 0 MUST_FIX / 2 SHOULD_FIX / 3 MINOR. First tasks review; lint pass had re-introduced 5 bare-path citations in its own Revision-History bullet, listed as open findings to the round.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-09-16T23:58:32Z · tasks · v2 · gotcha
Round 2 review: converged 0/0/0, DESIGN_READY yes. v2 delta (R1-1 resume recheck, R1-2 lint-prose cleanup, R1-3 range fix) held; fresh lens = cost of touching existing components. Lint clean but for the ruled-rejected L-7 bridge-missing warning.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-tasks-r2.md
Cost: 1 reviewer spawn

## 2026-09-16T23:59:55Z · tasks · phase · cleanup
tasks approved at v2 after 2 rounds; verdict trajectory 0/2/3 -> converged; rulings 0; cap not hit; prune removed 0 records and 0 snapshots. Recurring gotcha: reviser Revision-History bullets that describe citation fixes embed bare file paths/identifiers, which spec-lint re-flags as unresolvable citations; the v2 lint brief added a convergence rule (no path/identifier tokens in the decision log) and lint went from 20 findings to 1. R1-1 also amended design.md Component 5 (v3 amended) for Req 2 AC 7's resume recheck.
Evidence: approval_1789603132726_81g3nqajw; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-tasks-r2.md
Cost: 1 drafter + 2 reviewer + 3 reviser spawns

## 2026-09-17T00:04:11Z · tasks · phase · harness-defect
The tasks document orchestrator re-initialized the run ledger — it overwrote /tmp/scratchpad/sdd/question-gates/event.sh with a new run id (run-20260916-225339) instead of reusing the EVENT_SCRIPT passed by the supervisor, orphaning the supervisor's run id (run-20260916-194812). All tasks-phase events (worker spawns, phase.start, phase.end) plus the supervisor's tasks spawn.end landed under the new id. Requirements and design orchestrators did not do this, so it is manual-fallback variance triggered by the same harness-tool allowlist gap: with harness orient unavailable, the orchestrator improvised ledger setup. Supervisor restored event.sh to the original run id for the remaining phases.
Evidence: harness-events.jsonl: 83 events under run-20260916-194812, 11 under run-20260916-225339; pointer file /home/mcf/.local/state/sdd/active-run kept the original id
Cost: one-off; ledger split across two run ids for one logical run

## 2026-09-17T00:16:58Z · implementation · task 1 · gotcha
Pure veto-rules module landed clean on the first pass; gate pass at risk low, no verifier needed.
Evidence: task 1; src/core/veto-rules.ts, src/core/__tests__/veto-rules.test.ts
Cost: 1 implementer spawn, 0 fix rounds

## 2026-09-17T00:23:24Z · implementation · task 2 · gotcha
Harness gate action (class-a/put/get/delete) landed on the first pass; gate pass at risk low despite 299 lines, no verifier needed.
Evidence: task 2; src/tools/harness.ts, src/tools/__tests__/harness.test.ts
Cost: 1 implementer spawn, 0 fix rounds

## 2026-09-17T00:26:37Z · implementation · task 3 · gotcha
formats.md PHASE enum + table row for gate-a; sync regenerated 3 plugins copies; gate pass risk low.
Evidence: task 3; harness/skills/sdd-continue/references/formats.md and 3 plugins mirrors
Cost: 1 implementer spawn, 0 fix rounds

## 2026-09-17T00:29:51Z · implementation · task 4 · gotcha
sdd-drafter gains harness grant (3 forms) + requirements-only gate-A put step; gate pass risk low.
Evidence: task 4; harness/agents/sdd-drafter.md and 3 plugins mirrors
Cost: 1 implementer spawn, 0 fix rounds
