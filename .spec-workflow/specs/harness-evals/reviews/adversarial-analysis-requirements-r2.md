# Adversarial Analysis — harness-evals/requirements (v2, round 2)

Surface: completeness, ambiguity, scope. Deltas attacked first: the v2 Round-1
response (R1-1..R1-4, Accepted). Fresh lens for this round: none (prompt);
memory's error-path lens was addressed by the v2 crit-5 grader-throw clause.

## What I checked and how

Read target, codebase-context, round-1 analysis and memory, agent-rules. Re-verified
every citation the v2 delta introduced or moved, both ends:
- `closeout.ts:82-104` — `BATCH_SCHEMA` with `items[].status/commit/reason`. Correct.
- `closeout.ts:411-414` — `runModelStep({ role:'sdd-implementer', schema: BATCH_SCHEMA, cwd: landing.root })`. Correct; the implementer step does pass BATCH_SCHEMA.
- `brief-templates.ts:1505` — `Read \`<standing>\` first and obey it.` inside `renderCloseoutBatch`. Correct; the batch inlines only the standing *path*, not its text.
- `brief-templates.ts:1487-1489` — the standing "needs a human → `to-do — <reason>`" rule in `renderCloseoutStanding`. Correct (v1 R1 cited 1487-1488; v2's 1487-1489 is the full clause).
- `sdd-self-update.sh:179-182` — `--dry-run` prints "would npm run build" and skips the staging build. Correct.
- `sdd-implementer.md:20` — "the brief file … and the standing-instructions file it points at: read both." Confirms the close-out implementer consumes two briefs.

**No misstated artifact in the v2 delta.** The two findings below are seams the v2
fixes opened but did not close on both sides of a boundary.

## Topic 1 — the R1-2 fix wired run-time rendering but left selection single-template (Req 1 crit 1 vs Req 3 crit 1)

- Attack the delta: R1-2 made Req 1 crit 1 name "the brief template(s)" (plural) and Req 1 crit 2 render "every one … and wire the pointer" for a close-out case (batch + standing). That is the *run* side.
- Stress-test the *selection* side: Req 3 crit 1 (unchanged by v2) selects a case when "the text **its brief template** renders with the case's values (rendered once by each of the two commits and compared)" — singular, one render. It was written under the v1 one-template model and was not updated to match the new plural model.
- Challenge the coverage this leaves for `closeout-reversing-proposal`: its guarded rule lives in `renderCloseoutStanding` (`brief-templates.ts:1487-1489`), the standing brief. The batch render (`renderCloseoutBatch`, 1501-1518) emits only the standing *path* (`1505`), so weakening the standing rule changes the batch render not at all.

→ **R2-1 (Compounding on R1-2, fix-induced) — MUST_FIX.** Failure scenario: a later
deploy weakens the standing-brief "needs a human → `to-do`" rule in
`renderCloseoutStanding`. For `closeout-reversing-proposal` none of crit 1's five
triggers fire — directory, role file (`sdd-implementer.md`), profile entry, grader
code and the `closeout-batch` rendered text are all unchanged. The case is **not
selected**, the weakened rule ships, and the next live close-out forces a reversing
item instead of flagging it — the exact regression D10 and the case exist to guard,
now shipped unguarded. This is also an intra-doc contradiction: Req 1 crit 1 "template(s)"
vs Req 3 crit 1 "its brief template … rendered once." Fix: Req 3 crit 1 (and the
crit 6 dry-run signal) must compare the rendered text of **every** brief the case
renders — and the crit 6 source-diff must cover every render function and shared
helper those templates use (`C9_SENTENCE`, word caps, `renderCloseoutStanding`), not
one named function, or it under-reports standing-brief and helper changes.

## Topic 2 — the R1-4 fix softened crit 4 but left crit 3's unconditional 3/3 (Req 5 crit 3 vs crit 4)

- Attack the delta: R1-4 softened Req 5 crit 4 to "`closeout-reversing-proposal` … is **expected, not required**, to pass at base (D10); a base failure under the 3-of-3 bar is handled by an `--eval-override` (Requirement 4)."
- Stress-test against crit 3 (unchanged): "WHEN the deploy that lands this spec runs THEN all five cases SHALL be selected … and **SHALL pass 3 of 3**." That is an unconditional hard SHALL with no override mention.
- Challenge that base and the landing deploy differ for this case: this spec touches the drafter template (D5), the retro format and the docs — it does **not** touch `renderCloseoutStanding`. So the standing brief rendered on the landing deploy's staged build is identical to base. `closeout-reversing-proposal` behaves identically in both.

→ **R2-2 (Compounding on R1-4, fix-induced) — MUST_FIX.** Failure scenario: the
judgment case refuses 2 of 3 at base (crit 4 admits this is possible). Because the
landing render equals the base render, it refuses 2 of 3 on the landing deploy too,
fails the 3-of-3 bar, and per Req 3 crit 3 the landing deploy of **this spec**
refuses and must be re-run with `--eval-override closeout-reversing-proposal`. crit 3
flatly asserts all five SHALL pass 3/3, so the operator landing the spec is told it
will pass and is then blocked. crit 3 and crit 4 make incompatible demands on the
same execution. Fix: reconcile — exempt `closeout-reversing-proposal` from crit 3's
unconditional 3/3, or state the landing deploy may need an override for it.

## MINOR (do not keep the loop alive)

- Req 2 crit 7 writes one result record "WHEN a case run ends"; Req 3 crit 3's error
  wait names "the result record path." If the runner process itself dies mid-case
  (killed, OOM) no record is written and the error wait has no path to name. No
  criterion requires a partial/aborted-run record. (err-path lens.)
- The v2 crit-5 addition (grader throw / fixture-build failure → inconclusive)
  resolves the round-1 grader-exception MINOR. Good.

## Top risks/gaps

1. R2-1 — selection (Req 3 crit 1/crit 6) still single-template; a standing-brief
   regression never selects `closeout-reversing-proposal`. Silent coverage hole.
2. R2-2 — crit 3's "all five SHALL pass 3/3" contradicts crit 4's "expected, not
   required" for the judgment case; the landing deploy may self-refuse.
3. (MINOR) no partial result record if the runner crashes mid-case.

## Top 3 conclusions to challenge or reverse

1. "the text **its brief template** renders … rendered once" (Req 3 crit 1) — reverse
   to every brief the case renders, matching Req 1 crit 1's "template(s)."
2. "all five cases … **SHALL pass 3 of 3**" on the landing deploy (Req 5 crit 3) —
   qualify for the judgment case to match the softened crit 4.
3. crit 6's "diff **the template render function's source**" (singular) — widen to all
   render functions and shared helpers a multi-template case touches.

## What's missing before acting on this document

- A selection rule (Req 3 crit 1 and the crit 6 dry-run approximation) that watches
  every brief a multi-template case renders — the one change that closes R2-1.
- Reconciliation of the landing-deploy bar (crit 3) with the judgment-case exemption
  (crit 4) — one clause closes R2-2.

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
