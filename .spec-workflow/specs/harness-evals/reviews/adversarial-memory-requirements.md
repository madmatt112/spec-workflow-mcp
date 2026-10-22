# Adversarial Review Memory — requirements
Last updated: 2026-10-22 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1→v2)** — schema keyed by (role, phase) not role; close-out batch
  schema (`closeout.ts:82-104`, passed 411-414) now cited in Req 2 crit 2. Fix verified correct.
- **R1-2 (MUST_FIX, v1→v2)** — a case now names the step + brief template(s); Req 1 crit 2
  renders both close-out briefs at run time and wires the pointer. **Run side fixed; see R2-1
  for the selection side it left behind.**
- **R1-3 (SHOULD_FIX, v1→v2)** — dry-run marked provisional with a source-diff signal (Req 3
  crit 6). Addressed, but the signal is single-function/single-template — see R2-1.
- **R1-4 (SHOULD_FIX, v1→v2)** — Req 5 crit 4 softened for `closeout-reversing-proposal`
  (expected, not required, at base; override handles a base failure). **Fixed crit 4 but not
  crit 3 — see R2-2.**
- **v1 grader-exception MINOR** — v2 crit 5 now records a grader throw / fixture-build failure
  as inconclusive. Resolved.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (MUST_FIX, Compounding on R1-2, fix-induced)** — Req 3 crit 1 (and crit 6's dry-run
  signal) still select on "its brief template" (singular) / "the template render function's
  source." The R1-2 fix made Req 1 crit 1 plural but left selection single-template. A change
  to `renderCloseoutStanding` (`brief-templates.ts:1487-1489`, the standing brief, where the
  reversing-proposal rule lives) changes neither the role file, profile, grader, nor the
  `closeout-batch` render (which inlines only the standing *path*, `1505`), so
  `closeout-reversing-proposal` is never selected and a standing-rule regression ships
  unguarded. Fix: selection must compare the rendered text of every brief the case renders,
  and the crit 6 source-diff must cover every render function + shared helper.
- **R2-2 (MUST_FIX, Compounding on R1-4, fix-induced)** — Req 5 crit 3 ("all five … SHALL pass
  3 of 3" on the landing deploy) contradicts the softened crit 4 ("expected, not required" +
  override). The spec does not touch `renderCloseoutStanding`, so the landing render equals
  base; a 2/3 judgment refusal fails the landing deploy's 3-of-3 bar and forces an override
  crit 3 denies. Fix: qualify crit 3 for the judgment case.

## Patterns & Themes

- **Two-sided seam, one side fixed.** Both round-2 findings are the same shape: a v2 fix
  updated one side of a cross-criterion boundary and left the other asserting the old model.
  R1-2 fixed run-time rendering (Req 1) but not selection (Req 3 crit 1/6). R1-4 fixed the
  base-pass bar (crit 4) but not the landing-deploy bar (crit 3). Future rounds: when a fix
  changes a case's model (templates, pass bar), grep every other criterion that restates the
  old model — selection, dry-run, landing-deploy, docs.
- **The close-out implementer case is still the stress point** (2/5 seed cases, one role + two
  briefs + phase-keyed schema). Every unresolved finding traces to it. Schema (R1-1) and
  run-time rendering (R1-2) now fit it; selection (R2-1) and the landing bar (R2-2) do not.
- **Citations remain clean.** Every v1 and v2 citation verified correct at both ends across two
  rounds. No misstated-artifact MUST_FIX in either round. Do not re-spend rounds on citations.

## Guidance for Next Review
- Verify the reviser updated **Req 3 crit 1 and crit 6** to watch every brief a case renders
  (R2-1), and **Req 5 crit 3** to match crit 4 for the judgment case (R2-2). Check both ends.
- Fresh lens candidate still unused: runner-self error paths — partial/aborted result record on
  a runner crash (the MINOR here), and the Req 3 crit 3 error-wait text contract when the
  result path does not exist.
- Well-covered, do not re-examine: schema keying (R1-1), run-time two-brief rendering (R1-2),
  all cited artifacts, D7/`classifyTarget` batch landing, the grader-throw classification.
