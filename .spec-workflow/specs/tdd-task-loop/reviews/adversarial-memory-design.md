# Adversarial Review Memory — design
Last updated: 2026-09-27 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — Inbound Jev answer wire unprobed and unflagged. v2 flags
  both outbound `criteria` and inbound answer-number extraction as docs-placeholder,
  names `@typesafe-ai/sdk` types (jev doc 1.3, verified) plus a live key as confirmation
  sources, and gates the R9 AC3 judge event behind that confirmation. **Resolved in v2.**
- **R1-2 (SHOULD_FIX, v1)** — Count-word command over/under-inclusive. v2 replaces it
  with a member-complete `grep -rn -iE` command. Ran it: 7 hits, 6 real edits (incl.
  `SDD-HARNESS.md:21` "Eight **worker** agents" via the `worker\*\* agents` pattern) + the
  named false positive `SDD-HARNESS.md:133` "twelve spawns". **Resolved in v2.**
- **R1-4 (MINOR, v1)** — Gate seam/testLines source made explicit in Component 8 step 3;
  cites `review-gate.ts:161` (verified the parse). **Resolved in v2.**
- **R1-5 (MINOR, v1)** — Author `SEAM-DEFECT` stop reason now sourced from the author's
  flag; cites `SKILL.md:209-216` (verified the design-defect stop). **Resolved in v2.**

### Partially Accepted
- **R1-3 (MINOR, v1)** — `classifyRed` structural-marker misclassification recorded in
  Scope notes as a known shadow-data bias; classification rule (R4 AC9) left closed.
- **R1-6 (MINOR, v1)** — Stale-sidecar mis-attach after mid-spec unmark recorded in Error
  Handling 5 as an accepted limitation; no run stamp added.

### Rejected
- (none)

### Unresolved
- **R2-1 (MINOR, v2, Compounding R1-4)** — `testFiles`↔`tests[]` match "by path" does not
  pin the shared path form; a mismatch silently drops seams/testLines (fail-open). Low
  risk (one skill authors both sides). Not loop-keeping. Not yet responded to.

## Rulings issued (closed — do not re-open)
- **R3 AC4** `redTests` optional key defaulting to `''` — refinement, closed (round 1).
- **R4 AC9** `classifyRed` marker list + full-stdout+stderr scan — closed.

## Patterns & Themes
- Document is exceptionally well-grounded across two rounds. Every code citation the v2
  delta wrote verified accurate (paths, ranges, wording). No fix-induced claim error.
- Weaknesses only ever clustered in external/unprobeable wires (Jev) and prescribed
  maintenance commands — both closed in v2. Codebase claims never missed.
- All four producer→consumer seams the round-2 lens targeted (parsed-task
  tests/seams→gate+judge; TddBlock→markdown fence→back; data.tdd→routes→dashboard;
  redText→judge) are pinned on both sides and verified.

## Guidance for Next Review
- Verdict at v2 is **converged** (0 MUST_FIX, 0 SHOULD_FIX, 1 MINOR). A further round is
  not required by severity. If one runs, it is redundant on the areas below.
- Well-covered, do not re-examine: Jev wire honesty (R1-1), count-word command (R1-2),
  the four cross-artifact shape seams, Data Models completeness, review-markdown
  round-trip, dashboard route wiring, the R4 AC9 and R3 AC4 closed rulings.
- Only open thread is the trivial R2-1 path-form note; it degrades gracefully and does
  not block implementation.
