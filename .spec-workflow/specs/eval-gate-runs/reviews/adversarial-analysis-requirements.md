# Adversarial Analysis — eval-gate-runs/requirements (v1, round 1)

Primary surface: completeness, ambiguity, scope. Fresh lens: wire contracts across a
boundary (select↔gate rule, gate→runner call, record shape, CLI output shapes).

## What I read and checked

- Target: `requirements.md` v1 (full).
- Delta since `1c1c5b38`: R1 AC1/AC2 gained inline citations (`role` :188, `profile` :190,
  `case` :184); R1 AC5 citation widened `:158` → `:155-159`; Revision-History lint line.
  I read `src/evals/select.ts`, `src/evals/gate.ts`, `src/evals/runner.ts`,
  `src/evals/cli.ts`, `scripts/sdd-self-update.sh:225-269`, `docs/SDD-HARNESS.md:474-545`,
  and the cited tests (`select.test.ts:150-183`, `gate.test.ts:360-449`,
  `cli.test.ts:278-286`, `runner.test.ts:236-247`, `service-scripts.test.ts:258-273`).
- Decomposition entry 35 checked against scope.

**Delta verdict:** the lines the delta added/changed are all correct. `select.ts:184`=`case`,
`:188`=`role`, `:190`=`profile`; `select.test.ts:155-159` are the `['case']`/`provisional`
assertions. The delta is clean. The defects below are pre-existing v1 content and the
cross-boundary lens.

## Attack 1 — Requirement 1, the reason→count partition and its citations

- Challenge the brief-reason citation triplet in AC1. The reasons are listed
  `brief <template>`, `brief source`, `brief: base render unavailable`; the citations
  `(:131, :153, :200)`. Actual lines: `:131`=`brief: base render unavailable`,
  `:153`=`brief <template>`, `:200`=`brief source`. The triplet is rotated: read against
  the inline convention the same sentence just set (`role`→:188, `profile`→:190), every
  pairing points at the wrong line. → **R1-1 MUST_FIX**.
- Confirm the partition is total and disjoint. 1-run set {role, profile, brief\*}; 3-run
  trigger {case, grader}. Union covers all seven reason strings `select.ts` emits; no
  overlap. This is fine.
- Confirm AC3's "alone or with any other reason" dominance: a case with `case`+`role`
  runs 3 (`case` wins). Consistent with AC1 ("reasons are **all** role/profile/brief").
  Fine.

## Attack 2 — Requirement 2 vs the override path (contradiction)

- Stress-test AC1/AC2's unconditional "SHALL exit 1". AC1: "WHEN the single run of a 1-run
  case fails THEN the gate SHALL … exit 1." AC2 the same for inconclusive. R3 AC5: "WHEN an
  override passes a failed 1-run case THEN the gate SHALL exit 0." The overlapping event —
  a 1-run case fails **and** is named by `--eval-override` — is given exit 1 by R2 and
  exit 0 by R3. `gate.ts:74` guards the exit-1 path with `!overrideSet.has(c.id)`; R2 drops
  that qualifier. → **R1-2 MUST_FIX** (contradiction between stories).
- Challenge AC1's "make no further step call for that case." A 1-run case has exactly one
  run by construction, so "no further call" is already guaranteed by runs=1 and adds
  nothing testable beyond R1 AC2's "1 step call for the second." Duplicate clause. → MINOR.
- Confirm AC5's block mechanism. `scripts/sdd-self-update.sh:252-258` writes the error wait
  and `exit 1` before the `dist/` swap (lines 263-266), so "dist/ unchanged" holds. Fine —
  but "names the failing case" over-promises for the exit-2 override-validation summaries
  (`gate.ts:47`, `:70`), which name a bad/passed override, not a failing case. → MINOR.

## Attack 3 — Requirement 4, the dry-run "cost preview" contract (fresh lens: output shape)

- Challenge AC1's two example forms. It pairs `: 3 runs` with the plain line and
  `(provisional): 1 run` with the provisional line, implying provisional ⟺ 1 run. But in
  provisional mode a `brief source` change pushes that reason onto **every** case
  (`select.ts:199-201`), so a case whose own dir also changed carries `['case','brief
  source']`, provisional=true, and by AC4's rule runs **3**. The correct provisional line
  can read `: 3 runs`. AC4 governs and resolves this, but AC1's example invites a
  `provisional ⟹ 1 run` mis-encoding. → MINOR (tighten AC1 wording).
- Stress-test the user story "know what a deploy will cost before I start it." The dry run
  runs `select --provisional … --base HEAD --target origin/main` (`script:234`); the real
  gate runs exact select over `--base $BASE --target $TARGET_COMMIT` (`script:241`). AC5's
  equality guarantee is for **exact** select only, over the **same** range. So the preview
  is an upper bound over a possibly different range. AC4 flags provisional membership; the
  range difference is unflagged but pre-existing and out of scope. → MINOR.
- Confirm AC6/AC7 wiring. `script:232-234` is the live-build `select --provisional`;
  `service-scripts.test.ts:264` pins `eval selection unavailable`. The scope note's "R4 may
  need no script edit" holds — the script passes `select`'s stdout through. Fine.

## Attack 4 — the gate→runner wire contract (fresh lens)

- Probe how per-case counts cross into the runner. `runCases`' `runs` is **uniform** per
  call (`runner.ts:144,165`), and R1 AC7 keeps that for other callers. R3 AC3 requires **one**
  result record holding both a 3-entry and a 1-entry case, and R3 AC4 says only
  `gate.ts:66-81` reads the single returned record. Together these already forbid the
  "two runCases calls → two records" route and force a single call carrying per-case
  counts. The contract is adequately pinned at requirements altitude; the new runCases
  input is design (decomposition defers `runCases`/the `runs` option to design). **Not a
  finding** — the lens came up clean here.
- Confirm the rule-sharing contract (AC4) and the summary-line contract (R3 AC2, start
  `<target 12>: ` / end `; record <path>`, `gate.ts:76-77`, assertion `gate.test.ts:369-371`).
  Both precise. Fine.

## Numbered findings

- **R1-1 — MUST_FIX.** `requirements.md:19` (R1 AC1). The brief-reason citations
  `(:131, :153, :200)` are rotated against the reasons they follow. A reader verifying
  `brief source` is sent to `select.ts:153`, which is `brief <template>`; `brief: base
  render unavailable` is sent to `:200`, which is `brief source`. Misstated artifact (wrong
  line per named reason). Fix: reorder to `:153, :200, :131`, or inline each reason's
  citation as AC1 already does for `role`/`profile`.
- **R1-2 — MUST_FIX.** `requirements.md:33-34` (R2 AC1, AC2) vs `requirements.md:49`
  (R3 AC5). R2 AC1/AC2 say a failed/inconclusive single run SHALL exit 1 with no
  qualifier; R3 AC5 says an overridden failed 1-run case exits 0. For the overlapping event
  (failed 1-run case named by `--eval-override`) the two THENs conflict. `gate.ts:74` resolves
  it with `!overrideSet.has(c.id)`. Fix: add "and, absent an `--eval-override` naming that
  case," to R2 AC1 and AC2.
- **R1-3 — MINOR.** `requirements.md:59` (R4 AC1). Example forms imply provisional ⟺ 1 run;
  a provisional case with a `case`/`role`/`grader`/`profile` reason runs 3 per AC4. Show a
  `(provisional): 3 runs` form or state the count is independent of provisional-ness.
- **R1-4 — MINOR.** `requirements.md:33` (R2 AC1). "no further step call for that case" is
  vacuous for a 1-run case and duplicates R1 AC2's step-count assertion; the testable
  content is only the exit code.
- **R1-5 — MINOR.** `requirements.md:37` (R2 AC5). "names the failing case" over-promises
  for exit-2 override-validation waits, which name an override problem, not a failing case.
- **R1-6 — MINOR.** `requirements.md:63,64` (R4 AC5/AC6). The preview is `--base HEAD
  --target origin/main`; the gate is `--base $BASE --target $TARGET_COMMIT`. A one-line
  scope note that the preview may be over a different range would stop a "the dry run lied"
  retro finding.

## Closing deliverables

**Top risks/gaps (3).**
1. The R2↔R3 override contradiction (R1-2): a test author could pin exit 1 for an
   overridden failed 1-run case, contradicting the shipped override semantics.
2. The rotated AC1 citations (R1-1): verification against the code lands on the wrong
   reason for two of three brief reasons.
3. R4 AC1's provisional/count conflation (R1-3): a `provisional ⟹ 1 run` mis-encoding
   under-counts a provisional case that also changed its own dir.

**Top 3 conclusions to challenge.**
1. "A single run blocks a deploy the way 3 runs do" (R2 story) — only *absent an override*;
   the story must inherit R3's override carve-out or it contradicts it.
2. "The dry run shows what a deploy will cost" (R4 story) — it shows a provisional upper
   bound, possibly over a different commit range than the deploy. Reframe as an estimate.
3. "The brief reasons are … (:131, :153, :200)" (AC1) — the mapping is wrong; do not trust
   grouped citation order where the surrounding sentence uses inline order.

**What's missing before acting.**
- Qualify R2 AC1/AC2 with the override carve-out.
- Fix the AC1 citation order.
- Decide whether R4 AC1 should show a provisional-but-3-run line, and whether the preview's
  range caveat is worth one scope line.

## Verdict block

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 0
MINOR: 4
DESIGN_READY: no
ESCALATE: none
```
