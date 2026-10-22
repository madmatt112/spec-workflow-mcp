# Adversarial Analysis — harness-evals/requirements (v1, round 1)

First review. Primary surface: completeness, ambiguity, scope. Fresh lens: wire
contracts across a boundary (the case↔`runStep` contract and the case↔grader
report contract). Deltas since `85dd127` attacked first: the v1 lint pass was
citation hygiene plus one wording strengthen (Req 5 crit 4, "are expected to
pass at base" → "SHALL pass at base") — see R1-4.

## What I checked and how

Read the target, `codebase-context.md`, the decomposition entry (27), `agent-rules.md`,
the glossary. Verified every cited artifact at both ends of each range in the worktree:
`step.ts` (18-19 scrub, 92-134 StepSpec, 146-150 harnessDir, 229-242 loadRole, 303-327
classify, 343-516 runStep, 361-364 tools), `implementation.ts` (144-173 AUTHOR+IMPLEMENTER
schemas, 67-72 TURN_CAP), `document.ts` (199-220 DRAFTER_SCHEMA), `closeout.ts` (37
TURN_CAP, 82-104 BATCH_SCHEMA, 411-414 the implementer step), `merge.ts` (252-256
ATTRIBUTION_PATTERNS), `task-validator.ts` (12 SEAM_LABEL_RE, 138-150 check),
`task-parser.ts` (14), `brief-templates.ts` (129-133 Test(integration), 1381-1391 proposal
format, 1487-1488 the "needs a human → to-do" rule in `renderCloseoutStanding`, 1501-1518
renderCloseoutBatch, 1584-1678 registry), `harness.ts` (541-561 classifyTarget — confirms
"template"/"server"/"docs" class as `harness`, so a brief-template fix and its case do land
in the same batch; Req 6 crit 2 holds), `sdd-self-update.sh` (34-60, 74-82, 104-240),
`deferral-storage.ts` (62-66 owner), the role files, `SDD-HARNESS.md` (459-473),
`agent-profiles.json` (keys present). **Every path, range and symbol the document cites is
correct.** The findings below are design gaps, not misstated artifacts.

## Topic 1 — the report-schema contract (Req 2 crit 2)

- Challenge the claim that the schema is "the one the controller passes **for that role**."
  The controller keys schema by (role, phase), not by role. `sdd-implementer` gets
  `IMPLEMENTER_SCHEMA` in implementation (`implementation.ts:159-173`) but `BATCH_SCHEMA`
  in close-out (`closeout.ts:82-104`, passed at `closeout.ts:411-414`).
- Stress-test this against the seed set: 2 of the 5 cases (`closeout-landing-root`,
  `closeout-reversing-proposal`) run `sdd-implementer`. Crit 2 names only
  `implementation.ts:144-173` and `document.ts:199-220` as the schema sources — never
  `closeout.ts`.
- Challenge that "a case SHALL NOT carry its own copy" is sufficient given Req 1 crit 1
  gives the runner only a role name + one template name; neither resolves which of the two
  implementer schemas to pass.

→ **R1-1 (Novel) — MUST_FIX.** Failure scenario: an implementer wires the runner
`role → IMPLEMENTER_SCHEMA`, the only schema crit 2 names for that role. Both close-out
cases then spawn with the wrong schema; `closeout-reversing-proposal`'s grader (which needs
`BATCH_SCHEMA.items[].status`/`reason` to see "needs a human decision") and
`closeout-landing-root`'s grader (needs `items[].commit` for the on-branch check) read
fields that don't exist. The Scope note "how the report schemas are shared between the
phases and the runner" defers the *mechanism*, not *which* schema — crit 2 asserts a
definite, wrong answer. Fix: key the schema by the step/template the case emulates (or by
(role, phase)) and cite `closeout.ts:82-104`.

## Topic 2 — the case↔brief contract is one template; a close-out step is two (Req 1 crit 1)

- Stress-test "the brief template name (a key of the brief template registry)" (singular)
  against the close-out implementer step. In a live run that step reads **two** rendered
  briefs: `closeout-batch` (`brief-templates.ts:1501-1518`) and the `closeout-standing`
  file it points at (`"Read \`<standing>\` first and obey it"`, line 1505).
- Challenge the premise behind `closeout-reversing-proposal`: the rule it guards — an item
  that "needs a human" is reported `to-do — <reason>` and not forced — lives in
  `renderCloseoutStanding` (`brief-templates.ts:1487-1488`), i.e. the **standing** brief,
  not the batch brief. With only `closeout-batch` rendered, the implementer never receives
  that rule, so the case cannot reproduce the behaviour it is meant to guard.
- Stress-test against D1: freezing the standing text as a fixture file (instead of rendering
  it from the build) contradicts D1 ("a frozen file cannot catch a brief template defect") —
  `closeout-standing` is itself a template.

→ **R1-2 (Novel) — MUST_FIX.** Failure scenario: a case is built per crit 1 with
`template = closeout-batch`; the runner renders one brief; `<standing>` resolves to a
missing path or a stale frozen file; the close-out implementer cases either error or test
nothing. Shares the root cause of R1-1: the one-role/one-template/role-keyed-schema case
model does not fit the close-out implementer step (40% of the seed set). Fix: let a case
name the step it emulates (which may render a standing + batch brief), or list the
template(s) it renders, and render the standing brief from the build under evaluation.

## Topic 3 — `--dry-run` cannot compute the selection it must print (Req 3 crit 1 vs crit 6)

- Challenge that crit 6's `--dry-run` ("print the selected case ids and the reason each was
  selected … run no case, and change nothing") can report every reason. One selection input
  in crit 1 is "the text its brief template renders … rendered once by each of the two
  commits and compared." Rendering with `origin/main`'s template requires executing that
  commit's built renderer.
- Stress-test against the script: `--dry-run` skips the staging build entirely
  (`sdd-self-update.sh:179-182`, `would "npm run build in $STAGING"`), so the new build's
  `dist/` never exists. The other four inputs (case dir, role file, profile entry, grader
  code) are pure git diffs and need no build; only the rendered-text input does.

→ **R1-3 (Novel) — SHOULD_FIX.** Failure scenario: an operator runs `--dry-run` to preview a
deploy that changed only a brief template's rendered text; the dry run cannot render the new
side, so it under-reports (or guesses) the selection and the preview disagrees with the real
run. Fix: state whether `--dry-run` builds staging to compute the rendered-text diff, or
specify a build-free signal (e.g. a source-line diff of the template function) for that one
input.

## Topic 4 — Req 5 crit 4's strengthened invariant (the delta) overstates determinism and is under-cited

- Attack the delta: v1 changed "are expected to pass at base" → "**SHALL** pass at base as
  regression guards." Challenge that a hard SHALL fits `closeout-reversing-proposal`, which
  tests a **judgment** (does the implementer recognise that an item reverses a recorded
  design decision?). D10 itself says only that "the recorded instances show the implementer
  refusing correctly" — evidence of a tendency, not a deterministic rule.
- Stress-test the pass bar: Req 2 crit 4 requires all 3 runs to pass, and a run that fails a
  grader is a **fail**, not inconclusive (inconclusive is only `usage-limit`/`turn-cap`/
  `schema-invalid`/`error`, crit 5). A judgment case that refuses 2 of 3 times fails at base
  and refuses *every* deploy that touches it until overridden (Req 4) — the opposite of a
  silent regression guard.
- Challenge the citation set. Crit 4 cites `sdd-test-author.md:29-31` and
  `brief-templates.ts:1509`, which cover only test-author×2 and `closeout-landing-root`. The
  rule for `closeout-reversing-proposal` (`renderCloseoutStanding`, `brief-templates.ts:1487-1488`,
  template `closeout-standing`) is not cited, so a reader cannot verify that this case guards
  an existing rule — the exact thing the SHALL asserts.

→ **R1-4 (Novel, fix-induced by the v1 delta) — SHOULD_FIX.** Fix: add the missing citation
for the reversing-proposal rule, and soften/qualify the SHALL for judgment-based cases (or
state the flake budget and that a 3/3 base failure is handled by override, not treated as a
code regression).

## MINOR (do not keep the loop alive)

- The turn cap is a case value (Req 1 crit 1, Req 2 crit 1) while the schema must come from
  the build (crit 2). The "same reasons a live step would" principle argues the cap should
  also track the live per-(role,phase) value (`implementation.ts:67-72`, `closeout.ts:37`); a
  frozen cap can turn-cap where a live step would not. Defensible as a per-case knob — left
  for the case author.
- No criterion says a grader exception at run time is a fail vs inconclusive; it matters for
  which override path (Req 4) applies. Req 1 crit 5 covers only `npm test` validation.
- No fixture/temp-dir cleanup is required after a run (Req 1 crit 3 builds fresh each run);
  15 spawns on the landing deploy leave 15 fixture trees.
- Req 7 crit 1: the doc at `SDD-HARNESS.md:459-473` still lists the old order (fast-forward
  at step 2, before build); the doc update must also reflect the reordered live-checkout move
  (D3), not only insert the eval step.

## Top risks/gaps

1. R1-1 — the role-keyed schema rule is wrong for the close-out implementer (2/5 cases).
2. R1-2 — the one-template case model cannot render the close-out standing brief, where the
   reversing-proposal rule lives (2/5 cases).
3. R1-3 — `--dry-run` cannot compute the rendered-brief selection input it must print.

## Top 3 conclusions to challenge or reverse

1. "The report schema SHALL be the one the controller passes **for that role**" (Req 2
   crit 2) — reverse to (role, phase)/step-keyed; `sdd-implementer` has two schemas.
2. "Each eval case … holding … **the** brief template name" (Req 1 crit 1) — reverse the
   assumption that one case == one template; the close-out step is batch + standing.
3. "The four cases … **SHALL** pass at base as regression guards" (Req 5 crit 4) — challenge
   that a judgment case (`closeout-reversing-proposal`) is deterministic enough for a hard
   SHALL under a 3/3 bar.

## What's missing before acting on this document

- A statement of how the runner resolves the schema **and** the brief(s) for a close-out
  implementer case — the single change that unblocks R1-1 and R1-2.
- The run-time error taxonomy for the runner itself (grader throws, fixture build fails) as
  distinct from step classifications.
- The `--dry-run` selection semantics for the rendered-text input.

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 2
MINOR: 4
DESIGN_READY: no
ESCALATE: none
```
