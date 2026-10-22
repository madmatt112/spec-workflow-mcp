# Adversarial Analysis — harness-evals/design (v1, round 1)

First review. Changes since the checkpoint are two lint fixes only (`./vitest.config.ts:8`,
`node dist/evals/cli.js`); both re-verified correct. The rest is a fresh-document pass against
the decomposition entry (#27) and the approved requirements, attacking feasibility, consistency
and edge cases.

## What I checked

Read both ends of every code citation under the worktree. All are accurate — no misstated
artifact:

- `step.ts`: `harnessDir` 146-150, `loadRole` 229-242, `classify` 303-327, `runStep` 343-516,
  env scrub/set 381-387, `StepSpec.worktree` 93-134. The env analysis in Component 6 (the CLI
  must delete inherited `SDD_RUN_ID`/`SDD_STEP_ID` because `{ ...process.env }` at :381 spreads
  them and :384-385 only *sets* them) is correct.
- Schemas: `AUTHOR_SCHEMA` 144-157 (private), `IMPLEMENTER_SCHEMA` 159 (already exported),
  `VERIFIER_SCHEMA` 175-184 (private), `DRAFTER_SCHEMA` document.ts:199-220 (private),
  `BATCH_SCHEMA` closeout.ts:82-104 (private). Component 4's "adds `export` to the **four**
  module-private constants" is exactly right — IMPLEMENTER_SCHEMA is already public, so four
  remain. `BATCH_SCHEMA.items[].status` enum includes `to-do`, which the reversing-proposal
  grader needs.
- `COMMIT_SCRIPT` closeout.ts:196-206, `renderCloseoutStanding` 1472-1499 (cannot-do rule
  1487-1489), `renderCloseoutBatch` 1505/1509, drafter sentence 129-133, retro proposal format
  1381-1391, `BRIEF_TEMPLATES` 1584-1678.
- Brief action: `briefAction` 617-842, test-author `- Test:` check 707-712, absolute-path honour
  805-807, `SERVER_BRIEF_KEYS={agentRules,taskBlock,spec}` 585, `harnessHandler` exported 116.
- `validateTasksMarkdown` 42 + near-miss error 146-162; `ATTRIBUTION_PATTERNS` merge.ts:252-256;
  `DeferralStorage` constructor + `create` 229-270 + owner 62-66; `Deferral` type types.ts:312-333;
  `controllerHome` state.ts:239-243; `mcpConfigFor` shape controller.ts:436-453; CLI positional
  path + unknown-flag reject index.ts:239-241; `vitest.config.ts:8`; `tsconfig.json:7-8`.
- `scripts/sdd-self-update.sh` whole file: carve-out 131-133, divergence/dirty checks 123-158,
  rebase/ff 159-173, `write_error_wait` 45-60, `wait_no_step` 228. The split (b1 checks/no move,
  (f) move after the gate) is internally consistent and matches D3/D10.

## Attack 1 — the override deferral (Component 8 post-condition 5)

- Challenge the claim that `new DeferralStorage(repo).create(…)` can write a `body.context`
  Progress line ending `…; deferral <id>.` **with the deferral's own id**. `create` (229-270)
  `Omit`s `id` from its input and mints it internally via `generateId()` (239); the caller never
  sees the id until `create` returns, after the file is already written. The own-id can't be in
  the body at write time.
- Stress-test the completeness of the specified call. `create`'s input still requires
  `revisitTrigger: string` and `body.{decision, revisitCriteria}` (types.ts:312-333, all
  non-optional). Component 8 names only `owner`, `title`, `tags`, null origin fields and
  `body.context`. A TypeScript `create(...)` with those alone does not compile.
- Challenge the traceability goal. R4 AC3 wants the deferral to carry "the ready-to-paste
  Progress log line." If the implementer drops the `deferral <id>` fragment (the only way to
  satisfy a one-call `create`), the operator pastes a line that names no deferral — the exact
  back-reference the requirement asked for is gone.

## Attack 2 — the selector's exact brief-render path (Component 7, reason 5)

- Challenge "definitions are read at `target` through `git ls-tree` and `git show`, without a
  checkout" against reason 5's "build one fixture, render the case's briefs." `buildFixture(c,
  caseDir)` (Component 2) copies on-disk fixture tree directories (`tree: "fixture/01"`,
  post-condition 2) and the render reads `tasks.md`/`agent-rules.md` from the built fixture store
  (briefAction 690-712). None of that is reachable from git objects alone.
- Stress-test the gate run context. At step (e) `$REPO` is the live checkout still at `BASE`
  (the move is deferred to (f)); the selector interface takes only `{repo, base, target, mode,
  baseDist}` — no staging path — so it cannot read target's `harness/evals/<id>/` from disk.
- Cite the failure: a later deploy that touches only `src/tools/brief-templates.ts` runs the
  **exact** selector (reason 5, not the provisional source-diff) to decide which cases' rendered
  text changed. With no on-disk target case dir it either builds the fixture from the base
  checkout (comparing the wrong revision's text and mis-selecting) or needs a `git archive`
  extraction the design never names. The landing deploy hides this (all 5 select via reason 1).

## Attack 3 — brief-value wiring the design leaves to the case author

- Stress-test the drafter case. The `drafter` template requires `phase, docPath, specDir,
  specStoreRoot, codeRoot, carried` (1618); none are server-filled (585) and none are
  `{{fixture}}`/`{{scratch}}` by name. The case must hand-wire all six through the placeholder,
  and `docPath` must equal the grader's `doc` arg, or `tasks-labels-canonical` reads a file the
  drafter never wrote. The design states neither coupling.
- Challenge the close-out `commitScript`. `closeout-standing` requires `commitScript` (1585);
  Component 3 post-condition 4 writes `scratch/closeout-commit.sh` but never says the case's
  standing `values.commitScript` must point at `{{scratch}}/closeout-commit.sh`. Workable, but
  unstated — an omitted value fails the render with a missing-key error.
- These are MINOR (the placeholder mechanism supports them), but they are exactly the
  per-case detail a tasks author will get wrong without a stated rule.

## Attack 4 — data-model and error-branch completeness

- Stress-test the `Fixture` type: Components 2/3/6 use `f.root`, `f.bases`, and dispose the
  `mkdtemp` parent, but `Fixture` is never enumerated in Data Models (parent path for disposal is
  only implied). MINOR.
- Challenge the gate's exit-1 surface. Post-condition 4 pins the summary text for the
  unoverridden-fail branch, but the crash / missing-staged-CLI / deferral-write-failure branches
  (Error Handling 6/9) all return exit 1 with no pinned `summaryFile` content, so
  `write_error_wait "evals" "<summary text>"` has nothing defined to echo for them. MINOR.
- The `Eval case:` trigger (Component 11) fires on the whole "server code, docs or templates"
  Target option, broader than R6 AC1's "a brief template"; acceptable because `none` is allowed,
  but it silently requires the line on pure server-code proposals. MINOR.

## Top risks / gaps

1. (MUST_FIX) Override deferral body cannot carry its own id via the single `create()` call the
   design cites, and the call omits `create`'s other required fields. **Attack 1.**
2. (SHOULD_FIX) Exact-mode selector render has no on-disk target case dir to build its fixture
   from; "without a checkout" contradicts `buildFixture`'s on-disk `caseDir`. **Attack 2.**
3. (MINOR) Drafter/close-out brief values and the `docPath`↔grader-`doc` coupling are left to the
   case author with no stated rule. **Attack 3.**
4. (MINOR) `Fixture` shape not pinned in Data Models.
5. (MINOR) Exit-1 summary text unpinned for the crash / missing-CLI / deferral-write branches.

## Top 3 conclusions to challenge

1. "Create one deferral through `new DeferralStorage(repo).create(…)`" — reverse to: create,
   capture the returned id, then write `body.context` (or move the `deferral <id>` reference to
   the override-log line / revisit field). Pin `revisitTrigger` and `body.{decision,
   revisitCriteria}` too.
2. "Case ids and definitions are read at `target` … without a checkout" — the brief-render reason
   needs files, not just git objects. Either state the `git archive <target> harness/evals/<id>`
   extraction into a temp caseDir, or feed the selector the staged worktree path and read from it.
3. "Every signature is illustrative; the post-conditions bind" — true for signatures, but the
   deferral and selector post-conditions above are themselves the defects, so the usual escape
   hatch does not cover them.

## What's missing before acting

- A deferral-creation recipe (field-by-field) that an implementer can transcribe, including how
  the own-id reaches the body.
- The selector's target-materialisation step for exact-mode rendering.
- A one-line statement of the case-author contract: which brief values use `{{fixture}}`/
  `{{scratch}}`, and that `docPath`/grader paths must agree.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
