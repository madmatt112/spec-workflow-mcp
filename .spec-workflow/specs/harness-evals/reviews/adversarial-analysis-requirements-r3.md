# Adversarial Analysis — harness-evals/requirements (v3, round 3)

Surface: completeness, ambiguity, scope. Deltas attacked first: the v3 Round-2
response (R2-1, R2-2 Accepted; MINOR Rejected). Fresh lens for this round (prompt:
none): the memory's own prediction — when a fix flips a case's model to plural
templates, every *other* criterion that still restates the one-template model.

## What I checked and how

Read target, codebase-context, round-1/round-2 analyses, memory, the v3 diff.

**Delta re-check (fix-induced, scoped to the diff vs the requirement each fix must satisfy):**
- R2-1 → Req 3 crit 1 now reads "the text **any** brief template the case renders
  produces … (each brief rendered by both commits and compared)" and crit 6's dry-run
  signal now diffs "the source of **every** render function and shared helper the
  case's templates use." Both match the r2 fix requirement (watch every brief;
  source-diff every render fn + helper). **Fix correct.** Grounded: `renderCloseoutBatch`
  (`brief-templates.ts:1501-1518`) emits only the standing *path* at 1505, so the
  standing rule (`renderCloseoutStanding`, 1487-1489) is reachable only by rendering the
  standing brief itself — exactly what crit 1's "every brief" now does. On the real
  build path a shared-helper change (e.g. `C9_SENTENCE`, 1495) changes rendered text and
  is caught by the text compare; crit 6's explicit helper diff covers the no-build case.
- R2-2 → Req 5 crit 3 now holds "the four cases other than `closeout-reversing-proposal`
  … 3 of 3" and lets the judgment case fall to an `--eval-override`, matching crit 4 and
  D10. **Fix correct.** No residual crit 3/crit 4 contradiction.

**No misstated artifact in the v3 delta.** The delta is the two fixes plus prose
tightening of the Introduction, Alignment, Decisions and Scope notes; no citation moved.
Spot-checked `brief-templates.ts:1487-1489/1505`, `task-validator.ts:7-12`. Correct.
Citations remain clean across three rounds — not re-spent here.

The MINOR from r2 (partial result record on a runner crash) is Closed by ruling in the
v3 Revision History. Not re-opened.

## The seam the fixes did not finish closing

Both r2 findings were "model flipped to plural templates on one criterion, the sibling
criteria still assert the one-template / single-artifact model." The memory predicted
the next step verbatim: *grep every other criterion that restates the old model —
selection, dry-run, landing-deploy, **validation, grader trigger**.* R2-1/R1-2 updated
run-time rendering (Req 1 crit 2), selection (Req 3 crit 1), and the dry-run signal
(crit 6). Two siblings were not updated.

## Topic 1 — `npm test` validation (Req 1 crit 5) still validates "the template" (singular)

- Attack the delta's reach: R1-2/R2-1 made Req 1 crit 1 name "the brief template(**s**)"
  and Req 1 crit 2 render "every one … and wire the pointer" for a close-out case. Req 1
  crit 5 (static validation under `npm test`), untouched since v1, still reads "the role
  file and **the template** exist, **the template** renders with the case values (no
  missing required key)."
- Stress-test the two close-out cases: each emulates a step that renders `closeout-batch`
  **and** `closeout-standing` (Req 1 crit 2, grounded at `brief-templates.ts:1505`). crit
  5 validates "the template" — one. A case whose *standing* values omit a required key
  passes `npm test` and only blows up at run time (recorded inconclusive by Req 2 crit 5),
  which is the exact pre-flight failure crit 5 exists to catch.
- Challenge the generic reading: "the template" could be read as "each named template,"
  but the spec just went to the trouble of making crit 1/crit 2 plural for these cases;
  leaving crit 5 singular is a live ambiguity an implementer will resolve the cheap way.

→ **R3-1 (Compounds: R1-2, carried) — SHOULD_FIX.** Failure scenario: a retro adds a
close-out case whose `closeout-standing` render needs a key the case definition omits.
`npm test` renders only the batch template, reports green, the case lands. The next
deploy selects it, the standing render throws, the run is inconclusive (Req 2 crit 5),
and the deploy refuses — a failure crit 5 was supposed to surface at authoring time.
Fix: crit 5 → "every template the case renders" (plural), mirroring crit 1/crit 2.

## Topic 2 — the selection trigger "the grader code it names" (Req 3 crit 1) is non-transitive

- Attack the asymmetry the R2-1 fix created: crit 1's template trigger now compares
  rendered text (which absorbs any shared-helper change), and crit 6 spells out "every
  render function **and shared helper** the case's templates use." The grader trigger in
  the same crit 1 — "**the grader code it names**" — got no such treatment, and crit 6
  (which only approximates "the rendered-text input (criterion 1)") says nothing about
  graders. So a change to code a grader *uses but does not name* is watched by neither.
- Stress-test against realistic graders: graders are deterministic code (Req 1 crit 4)
  and the seed set shares obvious logic — "no new commit," "main checkout HEAD/tree
  unchanged" (`closeout-landing-root`), the attribution-pattern check
  (`test-author-trailer`, `merge.ts:252-256`). A shared helper is the natural factoring.
  Unlike a template, a grader has no "rendered text" the selector can diff; selection
  depends entirely on a source diff, so that diff must be transitive or it under-selects.
- Challenge the "deferred to design" cover: grader *location/structure* is deferred, but
  the selection trigger itself is a hard SHALL in crit 1. The requirement commits to
  *what* selects a case; it should commit to the transitive closure, as it now does for
  templates.

→ **R3-2 (Compounds: R2-1, carried) — SHOULD_FIX.** Failure scenario: a deploy refactors
a shared grader helper used by `closeout-landing-root`'s grader — say the "main checkout
HEAD unchanged" check — and introduces a bug that makes it always pass. The grader file
the case *names* is unchanged; directory, role file, profile, and rendered brief are all
unchanged. crit 1 fires for no case. The weakened grader ships; `closeout-landing-root`
still "runs" on later deploys but no longer catches the main-checkout edit it guards —
the exact R2-1 coverage hole, on the grader axis. Fix: crit 1 → "the grader code it names
**and the shared code that grader uses**," matching crit 6's template-helper language.

## Top risks/gaps

1. R3-2 — selection's grader trigger is non-transitive; a shared-grader-helper regression
   selects no case and ships unguarded. Silent coverage hole, same shape as R2-1.
2. R3-1 — `npm test` validation renders only "the template," so a malformed second
   template in a multi-template case passes pre-flight and fails at deploy time.
3. (Observed, not a finding) crit 3 keeps `drafter-test-seam-label` in the hard 3/3 group
   though the drafter is a generative role; the general override (Req 4) still covers a
   flake, so this is acceptable, not a gap.

## Top 3 conclusions to challenge

1. "the grader code it **names**" (Req 3 crit 1) — widen to the code the grader uses, to
   match the shared-helper treatment templates just received.
2. "**the template** renders with the case values" (Req 1 crit 5) — pluralise to every
   template the case renders, to match crit 1/crit 2.
3. (Holds) The two R2 fixes are correct and need no reversal.

## What's missing before acting

- One clause on crit 1's grader trigger and one on crit 5 — both are the still-unfinished
  half of the plural-template / shared-code model the R1-2 and R2-1 fixes established.
  Neither is a contradiction or a codebase error; both are under-specifications that a
  literal implementer resolves the narrow way, reopening the coverage hole R2-1 closed.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
