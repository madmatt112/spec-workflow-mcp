# Adversarial Review Memory — design

Last updated: 2026-09-18 (after v1 review)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser response)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX, Novel)** — The whole prepare response fails Requirement 6 AC 1 /
  Component 10 round-trip when the MCP server runs without a dashboard:
  `projectContext.dashboardUrl` is `undefined` (`types.ts:74` optional; `server.ts:205`/`:222`
  leave it undefined), `handlePrepare` copies it (`review-task.ts:525`), and 4.1.1 encodes
  `undefined` → `null`, so decoded ≠ source (verified mechanically). The design fixes only
  `diffStats ?? null` and misses this sibling field. The AC-4 round-trip test is specified
  "with a context carrying dashboardUrl", masking the failure. Fix: coalesce the field or strip
  undefined at the `encode` boundary in `toMCPResponse`; make the test use a real response.
- **R1-2 (MINOR, Novel)** — `PrepareData` (design lines 96-98) names `TaskContext` and
  `ImplementationSummary`, neither of which exists (`grep`: only `ResolvedFile` at
  `file-resolution.ts:111`). Today they are inline literals (`review-task.ts:420-434`). The
  interface will not compile until they are defined or inlined; D16's compile-guard depends on it.

## Patterns & Themes

- The design's citations are exact: every changed citation in the lint diff and every
  fresh-lens anchor verified at both ends against source. Both re-probed facts (git merge-base
  exit codes; toon 0.8.0-vs-4.1.1 round-trip) reproduced exactly.
- The one live weakness is completeness, not correctness: the `undefined → null` encoding
  hazard was reasoned about for `diffStats` but not swept across the *whole* response
  (`projectContext.dashboardUrl`). Watch any future response-shape addition for the same class
  of optional-undefined field.
- Test bullets that pin specific inputs ("with a context carrying dashboardUrl") can hide the
  exact edge the requirement targets. Prefer realistic response construction in round-trip tests.

## Guidance for Next Review

- First re-check R1-1's closure: is `dashboardUrl` (and every other optional response field —
  audit `nextSteps`, `projectContext`, nested `artifacts`) either coalesced or stripped before
  `encode`, and does the AC-4 test build a real response without a hard-coded dashboardUrl?
- Confirm `TaskContext`/`ImplementationSummary` were defined or inlined (R1-2).
- Rulings already closed — do not re-open: D11 (`feature-disabled` no note) = refinement;
  D3 (`diffBase.commit = 'HEAD'` for HEAD provenances) = refinement.
- Already verified sound; do not re-litigate without new evidence: `observed`-required
  construction sites and `any`-typed test overrides; `diffStats` null-safety in the runner
  `## Diff` branch; task-state.json key normalization on both ends; `dependencies-unresolved`
  → `unavailable-other` flow and R4_6B byte-pin; `DiffMethodologyState` `no-files` switch
  safety; `!ok` diff arm rejection + parity path; decomposition scope alignment.
- If the loop continues, apply a genuinely fresh lens (e.g., concurrency/interleaving of the two
  record writers under the store lock, or the error-path temp-file lifecycle on the dashboard path)
  rather than re-running the wire-contract or citation sweep.
