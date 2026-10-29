# Adversarial Review Memory — requirements

Last updated: 2026-10-29 (round 1, v1)

## Cumulative Findings Summary

### Accepted
(none yet — round 1)

### Partially Accepted
(none yet)

### Rejected
(none yet)

### Unresolved
- **R1-1 (MUST_FIX)** — R2 dedup + any-enabled filter unbuildable against cited
  artifacts: project-list payload carries no store id (`project-manager.ts:301-313`),
  `SpecListRow` has one `projectId` (`shell/types.ts:71-83`), SpecsPage groups by
  `projectId` (`SpecsPage.tsx:83-111,169`), deferrals fetched per project
  (`ShellProvider.tsx:127-134`). AC1+AC3+AC5 jointly unsatisfiable.
- **R1-2 (SHOULD_FIX)** — fold rule can't tell a linked worktree from a separate-store
  main checkout (both have workspace≠workflowRoot in the registry); needs git per
  entry (`git-utils.ts:133-139,260-270`). "Main working tree" (AC1) and classification
  not stored; R1 AC5 re-runs every sync; NFR Performance silent on the cost.
- **R1-3 (SHOULD_FIX)** — filter × dot/sort unspecified for disabled projects; sidebar
  renders a row for every project (`Sidebar.tsx:80-91`); a hidden waiting project
  could sort to the top (R5/R6 vs R2's explicit filter handling).
- **R1-4 (SHOULD_FIX)** — R4 AC2 bulk `projects.json` startup removal has no lock while
  the registry removal has AC6's; `writeJsonAtomic` is rename-only
  (`state.ts:318-323,460-473`); can clobber a concurrent controller remember.
- **R1-5 (SHOULD_FIX)** — R1 AC2 fallback matches only `P.workspace===entry.workflowRoot`,
  missing `P.workflowRoot===entry.workflowRoot`; can fold a worktree into a project on
  a different store, the wrong-row case D5 claims to prevent.
- Minor: R5 AC6 "1 or more" vs one-run guard (`controller.ts:160`); R5 AC8 token
  availability for dot states.

## Patterns & Themes

- The spec's weak seam is the **server→client wire for store-level aggregation**:
  everything in R2/R5/R6 is attributed per `projectId`, but the real unit is the
  **store** (workflowRoot). No wire shape carries store identity, so dedup, filter,
  and worktree-vs-separate-store classification all lack the data they need.
- Citations are accurate; run attribution (`controller.ts:166`) correctly lands the
  dot/count on the parent, so R5/R7 are internally consistent on that axis.

## Guidance for Next Review

- Re-probe whether the reviser added a store-identity field (payload `workflowRootPath`
  or a row-level store/projectId-set) and whether SpecsPage grouping was restated. If
  not, R1-1 stays MUST_FIX.
- Check R1 ACs for an explicit worktree-classification mechanism and cost note.
- Confirm R4 states projects.json removal serialization; confirm R1 AC2 gained the
  workflowRoot conjunct.
- Do not re-open the accurate citations or the run-attribution chain (verified sound).
