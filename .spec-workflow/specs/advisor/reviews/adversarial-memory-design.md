# Adversarial Review Memory — design

Last updated: 2026-10-26 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-2 (SHOULD_FIX, v1).** Data Models now pins AdvisorSummary, Tallies, Hit,
  SearchResult and the per-week floor map; C6/search return SearchResult. Closed in v2.
- **R1-3 (MINOR, v1).** C8 no-run merge now names the full MergeTarget (6 fields) and the
  synthetic `openRunLedger` (ledger.ts:95); pr.merged lands outside spec ledgers. Closed in v2.
- **R1-4 (MINOR, v1).** mcp.json `headers` key marked a task-phase probe in C10 and the
  scope-note probe list. Closed in v2.
- **R1-5 (MINOR, v1).** C7 now notes the opinion runStep passes no onRateLimit (lag accepted,
  controller.ts:413). Closed in v2.

### Partially Accepted
- (none)

### Rejected
- **R1-1 (was MUST_FIX, v1) — FALSE FINDING, now corrected.** R1 claimed the window
  threshold is at controller.ts:87-88 and windowBlock at 375-390. The tree (read in v2)
  shows threshold at **85-86** and windowBlock at **373-388**; onRateLimit at **413**. The
  v2 design cites exactly those and is CORRECT. R1 (and codebase-context.md L73-74) are the
  off-by-two. Do NOT re-raise 85-86/373-388 as a regression.

### Unresolved
- **R2-1 (SHOULD_FIX, Compounding R1-2, fix-induced).** AdvisorSummary.sources carries
  `location`, but Requirement 8 AC 3 ("by name and line") + C4 prose call for the one-line
  description (`about`). Day-one JobSync has `location ""`, so the summary would render a
  blank source line. Pin `about` or re-word the citation.
- **R2-2 (MINOR, Compounding R1-2, fix-induced).** AdvisorSummary.week is named for one week
  but typed as the full multi-week `Tallies` container. Implementable; misleading name.

## Patterns & Themes
- Citations in the DESIGN are accurate; the error source is the review scaffold itself —
  codebase-context.md L73-74 are off-by-two for the threshold/windowBlock, and R1 inherited it.
  Verify line ranges against the real tree, not codebase-context, when they look load-bearing.
- The recurring weak spot is Data-Models ↔ requirement-prose fidelity for the code-built
  responses: R1-2 pinned the shapes; v2's R2-1/R2-2 are both fields in that new block that
  drifted from the ACs they serve (sources field, week container). Check each new typed field
  against the exact AC wording, not just "is there a type now".
- Library/API-capability discipline remains solid (StepSpec fields, SDK/fastify/claude all
  verified across rounds).

## Guidance for Next Review
- If v3 touches AdvisorSummary, re-check R2-1 as a scoped fix-induced re-check: does the
  summary source row now carry `about` (Req 8 AC 3), and is JobSync's blank-location case gone?
- Do NOT re-open the threshold/windowBlock/onRateLimit citations (85-86 / 373-388 / 413) —
  verified correct against the tree; R1-1 was wrong.
- Well-covered, skip: MergeTarget/openRunLedger (C8), error-branch shapes/race losers (retro P3),
  StepUsage mapping, access model (C2), the C3/C10 library-capability claims.
- Fresh lens not yet spent: a tasks-decomposition/TDD-feasibility lens (count-changing tasks,
  new-module structural-red/verifier spend) if a later round needs one.
