# Adversarial Analysis — eval-gate-runs/requirements (v2, round 2)

Primary surface: completeness, ambiguity, scope. Fresh lens this round (prior round used
the wire-contract lens): failure-mode / error-path completeness — the override and exit-code
precedence the gate actually runs.

## What I read and checked

- Target: `requirements.md` v2 (full), Revision History line for v2.
- Delta since `94741410` (the six R1 dispositions): R1 AC1 brief-citation reorder; R2 AC1/AC2
  override carve-out + `gate.ts:74`; R2 AC5 error-wait summary wording; R4 AC1 count-after-
  provisional + the provisional `case`-reason example; scope note on the dry-run range.
- Code read both ends of every cited range: `src/evals/select.ts` (115-208, lines 131, 147,
  153, 184, 188, 190, 200), `src/evals/gate.ts` (full, lines 45-107), `src/evals/runner.ts`
  (141-266, lines 144, 165-243, 246-254), `src/evals/cli.ts` (128-187), `scripts/sdd-self-
  update.sh` (225-269, lines 234, 241, 252-258), `docs/SDD-HARNESS.md` (474-545, lines
  492-494, 504-506, 510-511, 537-539), tests `cli.test.ts:270-326`, `gate.test.ts:360-388`.
- Grepped every non-test consumer of `evals/results` / `EvalResultRecord` to test R3 AC4.

**Delta verdict: clean.** Every line the v2 delta added or changed is correct against the code:
`select.ts:153`=`brief ${template}`, `:200`=`brief source`, `:131`=`brief: base render
unavailable` (so R1-1's rotation is ended); `gate.ts:74` is the `!overrideSet.has(c.id)`
carve-out and `runner.ts:250` is the case-level `inconclusive` literal (R1-2 resolved);
`sdd-self-update.sh:252-258` writes the error wait for exit 1 **and** exit 2, and the exit-2
summary (`gate.ts:47`, `:70`) names the bad override, so R2 AC5 is accurate; `cli.ts:163-166`
already appends the ` (provisional)` suffix, so R4 AC1's "count after the marker" and the
`toContain` prefix at `cli.test.ts:283` both hold; scope-note cites `:234` (`HEAD..origin/main`)
and `:241` (`$BASE..$TARGET_COMMIT`) correctly. All six R1 dispositions landed as described.

## Attack 1 — R2 AC1/AC2 exit-1 claim vs the gate's exit-2 precedence (fresh lens)

- Stress-test the reworded "THEN the gate SHALL exit 1". The carve-out closes the R2↔R3 clash
  for *the same case*, but the code runs two exit-2 checks around the exit-1 block. The
  `passedOverrides` check (`gate.ts:66-72`) fires **after** `runCases`, so this event occurs:
  a selected case `baz` is named by `--eval-override` and passes → exit 2; concurrently a
  1-run case `bar` fails and no override names `bar`. R2 AC1's WHEN is satisfied for `bar`,
  yet the gate exits **2**, not 1. The claim is true only "absent any exit-2 override error."
  → **R2-1 MINOR, Compounds: R1-2** (fix-induced: the carve-out the R1-2 fix wrote is scoped to
  "that case" and does not account for a *different* override's exit-2). Deploy is blocked
  either way, so R2's user story holds; this is wording precision, not a wrong implementation.
- Confirm the pre-run exit-2 path does **not** collide: `badOverrides` (`gate.ts:45-49`) returns
  before `runCases`, so no 1-run case runs and R2 AC1's WHEN never fires. No finding there.
- Confirm R2 AC5's non-zero coverage. `gate_ok=0` catches exit 1 and exit 2 alike
  (`sdd-self-update.sh:248`), and the script exits before the `dist/` swap (`:265`), so
  "`dist/` unchanged" holds for both. Fine.

## Attack 2 — R3 AC4's "no outside reader" codebase claim (completeness of the blast radius)

- Challenge "no code outside `src/evals/` reads a record ... neither assumes 3 runs." Grep of
  every non-test file for `evals/results` / `EvalResultRecord` returns only `runner.ts` (writer)
  and the harness-evals design docs. The dashboard/controller/watch hits are the unrelated
  `.runs`/`results/` vocabulary, none touching the eval record. The claim holds; keeping `v: 1`
  and adding no field is safe because the `runs` array length already carries the real count
  (`runner.ts:251`, `:254`). Fine — the lens came up clean.

## Attack 3 — reporting the real count (R3 AC1-AC3) and the dry-run estimate (R4)

- Confirm R3 AC1's "line format does not change." `runner.ts:253-254` prints
  `${passed}/${runRecords.length}`, i.e. the real run count, so a 1-run case already reads
  `pass 1/1` with no runner edit; only the gate must start passing an `onLine`. Accurate.
- Confirm R3 AC2's summary reshape. `gate.ts:76` currently emits `<id> <firstReason>`; the
  record carries `verdict` and `runs`, so `<id> <verdict> <passed>/<runs> <first reason>` is
  derivable, and it does alter `gate.test.ts:369-371` as stated. The generic `<verdict>` also
  covers inconclusive cases (the `verdict !== 'pass'` filter admits both). Accurate.
- Confirm R4 AC5/AC6 against the scope note. The dry run is provisional over `HEAD..origin/main`
  while the gate is exact over `$BASE..$TARGET_COMMIT`; AC5's equality is now correctly fenced
  to exact select over the gate's range, and the scope note (R1-6) flags the preview as an
  estimate. No residual over-promise. Fine.

## Numbered findings

- **R2-1 — MINOR. Novel/Compounds R1-2 (fix-induced).** `requirements.md:33-34` (R2 AC1, AC2).
  The exit-1 claim is preempted by the `passedOverrides` exit-2 check (`gate.ts:66-72`) when a
  *different* override names a passed case in the same gate run. The deploy is still blocked, so
  the story is unharmed; tighten the WHEN to "absent any override-validation error" or note that
  the exit-2 override checks take precedence. Does not gate.

## Closing deliverables

**Top risks/gaps (3).**
1. R2-1 (MINOR): the exit-1 THEN is not exhaustive against the gate's exit-2 override checks;
   true in meaning (blocked) but imprecise in the exit code for a rare combined run.
2. No MUST_FIX/SHOULD_FIX risk remains: every v2 citation verifies at both ends, and the two
   R1 MUST_FIXes (rotated citations, R2↔R3 contradiction) are resolved in the code-true way.
3. Watch item for design, not a gap: the gate must thread per-case counts into `runCases`
   without disturbing the uniform `runs` option (R1 AC7) or the direct-run default of 3
   (R1 AC6, `runner.ts:144`). Bounded at requirements altitude; carried to design.

**Top 3 conclusions to challenge.**
1. "A failed single run SHALL exit 1" (R2 AC1) — necessary, not sufficient; an exit-2 override
   error wins. Reframe as "blocks the deploy," which is the story's real claim.
2. "The result record ... gains no field" (R3 AC4) — verified true: no external reader exists
   and the `runs` length is the count, so v:1 is safe. Accept.
3. "The dry run shows what a deploy will cost" (R4 story) — it shows a provisional estimate over
   a possibly different range; already fenced by AC5's condition and the scope note. Accept.

**What's missing before acting.** Nothing blocking. Optionally tighten R2 AC1/AC2's exit-code
wording for the exit-2 precedence; this is design-ready as it stands.

## Verdict block

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
