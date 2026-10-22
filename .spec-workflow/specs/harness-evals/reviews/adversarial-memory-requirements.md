# Adversarial Review Memory — requirements

Last updated: 2026-10-22 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (MUST_FIX)** — Req 2 crit 2 keys the report schema "for that role," but the
  controller keys it by (role, phase): `sdd-implementer` gets `IMPLEMENTER_SCHEMA`
  (`implementation.ts:159-173`) in implementation and `BATCH_SCHEMA` (`closeout.ts:82-104`,
  passed at 411-414) in close-out. 2/5 seed cases are close-out implementer cases; crit 2
  never cites `closeout.ts`. The Scope deferral defers the sharing *mechanism*, not *which*
  schema.
- **R1-2 (MUST_FIX)** — Req 1 crit 1 gives a case one template name; the close-out
  implementer step reads two briefs (`closeout-batch` + the `closeout-standing` it points to,
  `brief-templates.ts:1505`). The `closeout-reversing-proposal` rule it guards lives in
  `renderCloseoutStanding` (`brief-templates.ts:1487-1488`). Freezing standing as a fixture
  file contradicts D1.
- **R1-3 (SHOULD_FIX)** — Req 3 crit 1's "rendered by each of the two commits" selection
  input needs the staged build; `--dry-run` (crit 6) skips the build
  (`sdd-self-update.sh:179-182`), so it cannot compute/print that reason.
- **R1-4 (SHOULD_FIX, fix-induced by v1 delta)** — the v1 delta hardened Req 5 crit 4 to
  "SHALL pass at base." Overstates determinism for the judgment-based
  `closeout-reversing-proposal` (a 2/3 base refusal → fail → blocks every touching deploy),
  and crit 4's citations (`sdd-test-author.md:29-31`, `brief-templates.ts:1509`) omit the
  reversing-proposal rule (`brief-templates.ts:1487-1488`).

## Patterns & Themes

- **Root cause for R1-1 + R1-2:** the case model (one role, one template, role-keyed schema)
  fits drafter/test-author cases but not the close-out implementer step (2/5 seed cases),
  which is one role + two templates + a phase-keyed schema. Any revision should fix both at
  the boundary, not patch one side.
- **Citations are clean.** Every path/range/symbol the v1 document cites was verified correct
  at both ends. No misstated-artifact MUST_FIX. Don't re-spend rounds re-checking citations;
  spend them on the case↔runStep↔grader wire contract.
- `classifyTarget` (`harness.ts:541-561`) treats "template"/"server"/"docs" as `harness`
  keywords, so a brief-template fix and its eval case land in the same harness batch — Req 6
  crit 2 and D7 hold for brief templates, not only role files. Do not re-raise this.

## Guidance for Next Review

- Verify the reviser keyed schema + brief(s) by step/phase (not role) and cited
  `closeout.ts:82-104` and the `closeout-standing` template — that is the R1-1/R1-2 fix seam;
  check both ends.
- If the SHALL in Req 5 crit 4 survives, demand a stated flake handling for judgment cases.
- Fresh lens used this round: wire contracts across a boundary. Next unused lens candidate:
  failure/err-path completeness of the runner itself (grader throws, fixture build failure,
  partial result record) and the self-update's error-wait text contract.
- MINOR carried: turn-cap/schema asymmetry, grader-exception classification, fixture cleanup,
  SDD-HARNESS reorder. Do not keep the loop alive on these alone.
