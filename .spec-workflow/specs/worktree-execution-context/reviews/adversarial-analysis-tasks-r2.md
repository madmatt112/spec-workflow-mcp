# Adversarial Analysis — worktree-execution-context/tasks.md (v2)

Every line reference below was re-derived against the working tree at `2605819`. The
`ToolContext` error counts were verified **empirically** by applying the change and running
`tsc --noEmit`, then reverting.

The restructure closed several v1 findings in substance: the `_Depends:_` graph is acyclic and
the numeric order is a valid topological order; task 1 exists and owns R7 AC 1; task 2 is a
front-loaded characterization test; task 4 moved to position 4 and now names the ENOENT case;
the `AdversarialRunner` contradiction is resolved in R5 AC 5's spawn-helper form and tasks 6
and 7 both carry it consistently; the typecheck cache is now keyed per workspace; `-p` and the
spawn cwd are enumerated; `index-args.test.ts` is in task 5's file list with the correct count
of three call-graph assertions.

It also introduced three defects the v1 document did not have, one of which leaves the tree
**build-red at task 8**, and it left intact the single largest attack surface in this
codebase — a **17-file golden-fixture pin plus a two-way drift test** on
`buildReviewMethodology` — which tasks 11 and 12 both must break and neither mentions.

---

## 0. Counts and citations — what drifted

The document's authority rests on exact counts. Re-derive them.

- **Reject the header outright.** Line 3 says "Fourteen tasks." The document contains
  **eighteen** checkboxes (1–17 plus 15.1). v1 had eighteen. The restructure's stated
  achievement — merging tasks so that a non-commit boundary is not a task boundary — did not
  reduce the count at all; it renumbered. An implementer who reads the header and stops at
  fourteen skips tasks 15, 15.1, 16 and 17, which is the entire e2e, regression and
  documentation tail. **Novel.**
- **`task-review-runner.ts:281` is wrong; the instruction is at `:283`.** Task 11 cites `:281`
  three times (bullets, `_Leverage:_`, `_Prompt:_`). `:281` is `sections.push('')`; `:282` is
  `## Instructions`; `:283` is `1. Read every file listed in "Files to Review".` v1 named `:283`
  correctly and the restructure did not pick it up — it inherited the wrong number from
  R4 AC 20 and design §4. **Recurring — escalate.** An implementer following the citation
  literally edits a blank line.
- **`typecheck.ts:153` is the env, not the spawn cwd.** Task 10 says "`spawnTsc`'s cwd
  (`:153`)". `:153` is `const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };`;
  the `spawnTsc(tscPath, args, env, projectPath)` call whose fourth argument is the cwd is at
  **`:154`**. v1 named `:154`. Worse, task 7 uses `:153` correctly (for the env) — so the same
  number denotes two different things in two tasks, and an implementer reconciling them will
  conclude one of the two is a typo without knowing which. **Recurring — escalate.**
- **"sixteen test sites across ten files" — nine files.** Verified by applying the field and
  running `tsc`: **19 errors in 11 files**, of which 3 are production sites in 2 files
  (`multi-server.ts` ×2, `task-review-runner.ts` ×1) and 16 are test sites in **nine** files
  (`create-steering-doc`, `adversarial-response`, `adversarial-review`, `decomposition-guide`,
  `deferrals` ×2, `get-task-review`, `projectPath` ×6, `review-task` ×2, `spec-index`).
  Sixteen is right; ten is not. **Novel.**

Verified correct and not worth re-litigating: the 19/20 error split with `server.ts` absent
from the first run and `server.ts:96` present in the second (I reproduced both); twenty-five
`runProjectTypecheck(` call sites in `typecheck.test.ts`; three call-graph assertions in
`index-args.test.ts` (`:28`, `:29`, `:41`); all six route lines (`828`, `852`, `969`, `1012`,
`1791`, `1853`); `loadSettings(project.projectPath)` at `:836` and `:986`; `job-scheduler.ts`
`:176`/`:184`; `isProcessAlive` returning `true` unconditionally at `:164-171`;
`ensureRegistryDir` reachable only from `readRegistry:87` and `writeRegistry:148`, both inside
`registerProject:187-226`; `git-utils.ts` containing exactly three git calls; `computeTaskDiff`
returning `diff: ''` with **no** rejection both when `kept.length === 0` (`:41-43`) and when
git fails (`:53-55`).

---

## 1. The `_Depends:_` graph

**The graph itself is sound. The field is not.**

Edges: 2→1, 3→1, 5→3, 6→5, 7→6, 8→1, 9→{6,8}, 10→9, 11→9, 12→9, 13→6, 14→{3,4},
15→14, 15.1→15, 16→13, 17→16. Acyclic, and every dependency has a lower number, so the stated
numeric order **is** a valid topological order. Say so and move on.

- **Attack `_Depends:_` as a field this project's own parser does not read.**
  `src/core/task-parser.ts:207-278` recognizes exactly three metadata markers — `_Prompt:`,
  `_Requirements:`, `_Leverage:` — plus `Files:` and `Purpose:`. A line
  `- _Depends: 6, 8_` matches none of them, falls through to the generic bullet branch at
  `:270-277`, and is filed into **`implementationDetails`**. `implementationDetails` is not in
  the `taskContext` object `handlePrepare` builds (`review-task.ts:363-369` passes
  `description`, `requirements`, `leverage`, `prompt`, `promptStructured`), so it reaches
  neither the reviewing agent nor the dashboard. And **not one of the eighteen `_Prompt:`
  fields mentions its dependencies.** The document declares ordering "load-bearing" and then
  encodes it in the one place the implementing agent will never see. **Novel.** This is a
  direct regression against v1's ask, which was for a dependency graph that *works*.
- **Reject the free-text values in a machine-readable field.** `_Depends: none (touches only
  project-registry.ts and a new module)_`, `_Depends: 3, and must not land before 2 or 4_`,
  `_Depends: 6 (the spawn sites need the roots the runner split provides)_`. If `_Depends:`
  is ever promoted to a parsed field with the comma-split `_Requirements:` uses
  (`task-parser.ts:251`), task 5 parses to `["3", "and must not land before 2 or 4"]` and task 4
  to `["none (touches only project-registry.ts and a new module)"]`. Pick one: prose, or a
  field. **Novel.**
- **Task 5's "must not land before 2 or 4" is a dependency, not a preference — and the document
  knows it.** Task 2's `_Prompt:_` says the parity test "MUST be written and passing BEFORE any
  behaviour change lands," and task 5 is the first behaviour change. Task 4's Purpose is "Close
  the lost-registration race **before** the change that creates it," and task 5 is that change.
  Both are hard constraints stated in absolute terms elsewhere and demoted to prose here.
  Write them as `_Depends: 2, 3, 4_`.
- **Task 4's `_Depends: none_` survives, but its Purpose overstates.** The lock touches
  `project-registry.ts` and one new module and needs nothing from tasks 1–3; a unit test can
  synthesize N distinct paths without inference existing, so the criterion is testable at
  position 4. Fine. But "Close the lost-registration race" is false as scoped: `registerProject`
  is the only wrapped writer, while `unregisterProject` (`:233-255`),
  `unregisterProjectById` (`:260-264`) and `cleanupStaleProjects` (`:297-327`) all perform an
  unlocked read-modify-write on the same file through the same `writeRegistry`. A shutdown
  racing a startup still erases an entry. **The design acknowledged this as "a known residual"
  (design §7, last line); tasks.md dropped the acknowledgment entirely**, and task 14 then adds
  a *new* unlocked writer call path by routing `stop()` through `unregisterProjectById`.
  **Compounding.**
- **Missing edge — task 7's most valuable half is serialized behind five tasks for no reason.**
  `_Depends: 6 (the spawn sites need the roots the runner split provides)_` is true for the two
  spawn envs. It is false for `runGit` (`task-diff.ts:23-27`), which needs nothing from task 6
  and carries the worst failure in the spec: with an inherited `GIT_DIR`, `git diff --numstat`
  returns empty at exit 0, `computeTaskDiff` takes the `!diffRun.ok` / empty path with **no**
  rejection (`task-diff.ts:53-55`), and `R4_2A_DIFF_EMPTY` tells the agent the changes were
  already committed. That scrub is a three-line change with zero dependencies. As ordered it
  lands seventh, after every commit that could be dogfooded.
- **Missing edge — 9 and 13 have no stated interface and either order is legal.** Task 13
  (`_Depends: 6_`) applies `selectRoots` at `review-task.ts:276`; task 9 (`_Depends: 6, 8_`)
  rewires `handlePrepare`. Neither depends on the other, so both orders are permitted. But
  `handlePrepare`'s signature today is `(specPath, specName, taskId, projectPath, context)` —
  there is no workspace parameter. If task 9 lands first it must read `context.workspacePath`
  directly, and then after task 13 an `args.projectPath` override changes the workflow root but
  **not** the diff/typecheck root — silently reintroducing R3 AC 5's defect on the override
  path that task 13 exists to close. If task 13 lands first, `handlePrepare` gains a workspace
  parameter it ignores for four tasks. Neither task states which. **Novel, and it causes
  rework:** whichever order is taken, the other task rewrites `handlePrepare`'s signature.

---

## 2. Task 6 — the merged mega-task

**The indivisibility claim is verified for the `ToolContext` half and unproven for the rest.**

I applied `workspacePath: string` to `ToolContext` and ran `tsc --noEmit`: 19 errors, `server.ts`
absent. I then annotated the literal at `:95` and typed `setupHandlers(context: ToolContext)`:
20 errors, `server.ts(96,13)` present. The claim is exact. Do not re-attack it.

- **Refute "the compiler as the enumeration mechanism" — it is blind to the site that already
  violates R3 AC 4.** `src/tools/__tests__/spec-index.test.ts:79` is
  `await specIndexHandler({ action: 'generate' }, {} as ToolContext)`. An assertion compiles, so
  it **does not appear** in either tsc run — I checked both outputs. Task 6's restriction
  forbids *introducing* `{} as ToolContext`; its success criterion is the stronger "no fixture
  uses a type assertion"; and its stated enumeration mechanism cannot find the one that already
  exists. That criterion is only reachable by grep, which the task does not instruct. **Novel.**
- **Attack the six route sites: "workflow root" and "workspace" each name two fields that
  differ under path translation, and the document disambiguates one of the six.**
  `ProjectContext` (`project-manager.ts:11-23`) carries **four** path fields:
  `projectPath` (translated workflow root), `workflowRootPath` (untranslated workflow root),
  `workspacePath` (translated workspace), `originalProjectPath` (untranslated workspace).
  Task 6 says "`:828`, `:969` (workflow root to the handler), `:852`, `:1012` (workspace to the
  runner)" and warns only that `workspacePath: project.originalProjectPath` at `:969` preserves
  a bug. Trace the failures it does not cover:
  - `:852`/`:1012` today pass `project.originalProjectPath` as the **spawn cwd**. R5 AC 8 says
    pass `project.workspacePath`. Under Docker those differ, so this is a silent behaviour
    change to the adversarial spawn cwd in the one configuration where registry orphans are
    permanent. Task 6 states it as "workspace to the runner" and never says which field.
  - A `ToolContext` at `:828` built as `{ projectPath: project.projectPath, workspacePath:
    project.originalProjectPath }` mixes a **translated** containment base with an
    **untranslated** workspace. `validatePathWithinBases` (`path-utils.ts:169-178`) is a prefix
    comparison; mixed address spaces make it reject every workspace file, and the failure is a
    thrown `Path traversal detected` string that names neither root.
  Design §5's testing strategy does say "both adversarial runners receive the **translated**
  workspace." The tasks document dropped that word. **Novel.**
- **Stress-test the merge: the `AdversarialRunner` half is not build-coupled to anything in
  task 6.** `AdversarialRunner.RunOptions` keeps one field (R5 AC 5); the change is that its
  private spawn helper takes the workflow root as a parameter so R2 AC 13's env can be set. That
  parameter is consumed by **task 7**, not task 6. Nothing in task 6 forces it, nothing in task
  6 tests it, and the `ToolContext` change does not surface it. It was merged by association.
  Likewise `:852` and `:1012` are forced by the `TaskReviewRunner`/`AdversarialRunner` field
  renames, not by the type change — so "the compiler enumerates the sites" is true for 20 sites
  and false for 4 of the 6 route sites, which are found by rename-following.
- **Task 6 cannot be verified as complete at position 6.** Its success criteria end with "an
  adversarial review and a retry both locate their target document from a worktree." At position
  6: task 15's harness (the only thing that can start a server in a worktree) is nine tasks
  away; `route-roots.test.ts` is created by task 16; and **task 6 lists no test file at all**.
  The only way to evidence that criterion is to hand-roll the harness task 15 builds. Either
  demote the criterion to "the four handler/runner sites receive the values in the table" and
  move the behavioural claim to 15.1, or accept that task 6 is unverifiable and say so.
  **Novel** (v1 attacked task 4's *values*, not its verifiability).
- Also minor and real: `src/server.ts` does not import `ToolContext` (imports end at `:19`).
  "Annotate the literal at `src/server.ts:95-99`" requires adding the import first, or the
  20th error is `Cannot find name 'ToolContext'` rather than the missing-property error the
  success criterion pins.

---

## 3. Coverage — every acceptance criterion against every task

Full matrix built from the eighteen `_Requirements:_` lines against all 84 acceptance criteria.

**Covered exactly once and correctly:** R1 AC 1–18; R2 AC 1–8, 10–13; R3 AC 1–4, 5–10;
R4 AC 1–5, 7–26; R5 AC 1–8; R6 AC 1–6; R7 AC 1–4, 8, 9, 10.

### Orphaned

| AC | Text | Status |
|---|---|---|
| **R7 AC 5** | The file-resolver test matrix | Cited by no task. Task 8's success criteria reproduce it almost verbatim, so it is **covered in substance**; the citation gap is cosmetic. |
| **R7 AC 6** | "the resolver replaces `validateAllFiles`" — **ten existing call sites**, **two `warnOnce` message assertions**, containment-warning text decided | **Cited by no task, and covered in substance by no task.** See §4; this is the build-red finding. |

`validateAllFiles` has exactly one production caller (`review-task.ts:380`) and **ten** call
sites in `review-task.test.ts` (`:443`, `:444`, `:445`, `:452`, `:464`, `:475`, `:486`, `:503`,
`:514`, `:521`) — R7 AC 6's "ten" is exact. Neither task 8 nor task 9 mentions
`validateAllFiles` in a bullet, a restriction, or a success criterion.

### Mis-cited

- **Task 17 cites `7.7`, which is not a documentation criterion.** R7 AC 7 is "WHEN
  `git-utils.ts` gains exports THEN `src/__tests__/index-args.test.ts` SHALL be updated: its
  `vi.mock` factory declares exactly two exports…". Task 17 writes `docs/CONFIGURATION.md`,
  `CHANGELOG.md` and `README.md` and cannot implement it. The work *is* done — by task 5, whose
  restriction block quotes the mock-factory hazard and whose file list includes
  `index-args.test.ts` — but **task 5 does not cite 7.7**. Move the citation. **Novel.**
  (Note in passing: R7 AC 7 still says "**four** assertions"; there are three, as task 5
  correctly states. The requirements document was never corrected.)

### Double ownership where neither task fails if the other does the work

- **R4 AC 6** (`tsc-not-found` recorded in Migration) is claimed by task 10 (via `4.2-4.6`) and
  task 17 (via `4.6`). It is a pure documentation criterion. **Task 10's success criteria never
  mention Migration, the changelog, or `tsc-not-found`** — its citation is bookkeeping and would
  go green with the criterion unimplemented. Task 17 does the work. Drop `4.6` from task 10.
- **R2 AC 9** (`SPEC_WORKFLOW_SHARED_ROOT` resolved to absolute) is claimed by task 3 explicitly
  and by task 5 via the blanket `2.1-2.11`. Task 3 does the work (its bullet names it, its file
  list has `git-utils.ts`). Task 5's success criteria do not test it. Harmless but it is the
  same pattern.

### Verify the claimed closures

- **R5 AC 9 / R5 AC 10 — closed in substance, not in citation.** No `_Requirements:_` line
  contains `5.9` or `5.10`. But task 16 cites `7.9`, which names both sites explicitly, and
  task 16's success criterion is falsifiable: "reverting either SHALL-continue site to a
  workspace path makes a test fail." That is a real guard. Accept it; add the citations for
  traceability.
- **R7 AC 1 — genuinely owned by task 1.** Accept, with the capability caveat in §5.
- **R3 AC 11 / R7 AC 8 — owned by task 2 in form.** The guard exists and is front-loaded. But
  nothing owns *keeping it green*; see §5.
- **Task 17's citations are half real.** `4.6` is real work. `7.7` is not its work. The
  Usability NFR it also serves ("Documentation SHALL explain … including in `--help`") is split:
  the `--help` entry belongs to task 5's five parse sites, the prose to task 17. Neither says so.

---

## 4. Overlapping edits and merge hazards

### The build-red state at task 8 — the headline finding

**Task 8 leaves `tsc` failing, and its own file list is the reason nobody noticed.**

Task 8 moves `safeRealpath` from `src/tools/review-task.ts` to `src/core/file-resolution.ts`
and changes its return from `string | undefined` to a `RealpathResult` discriminated union.
`validateAllFiles` — which task 8 never mentions and task 9 never mentions — sits at
`review-task.ts:41-90` and consumes the old shape twice:

```ts
:49   const realProjectPath = safeRealpath(projectPath) ?? projectPath;
:64   const realResolved = safeRealpath(resolved);
:65   if (realResolved === undefined) { continue; }
:69   !realResolved.startsWith(realProjectPath + path.sep)
```

After task 8, `:49` assigns a `RealpathResult` to a value used as a string at `:69`, and `:65`
compares a non-nullable union against `undefined`. `tsconfig.json` includes `src/**/*` and the
build is bare `tsc`. **The tree does not compile at the end of task 8.**

It also does not test. `review-task.test.ts:42-44` imports `validateAllFiles`, `safeRealpath`
and `_resetValidateWarnings` from `../review-task.js`; all three move or change. The
`safeRealpath` describe block (`:372-418`) asserts `expect(result).toBeUndefined()` three times
(`:398`, `:409`, `:415`) and `expect(typeof result).toBe('string')` once (`:392`) — every one of
which is false against `{ ok: false, code: 'ENOENT' }`. Task 8's restriction says only that "its
committed test block including the ELOOP message assertion **moves with it**." Moving that block
verbatim makes four assertions fail; the block must be **rewritten**, not moved, and the task
says the opposite.

This is the document's own headline principle — "a boundary that is not a commit boundary is not
a task boundary" — violated by the task that most loudly invokes it ("safeRealpath and the
resolver must land together"). The set that must land together is larger than the task claims:
`safeRealpath` + the resolver + **`validateAllFiles`'s removal** + its ten test call sites + the
rewritten `safeRealpath` assertions. That set is exactly R7 AC 6, which no task cites.
**Novel, and it causes rework** — an implementer discovers it only when the build breaks after
the work is otherwise done.

### The 17-fixture golden pin — the second headline

`src/tools/__tests__/__fixtures__/methodology/` contains **17 committed `.txt` fixtures**
(verified: `git ls-files` returns 17). `review-task.test.ts:1035-1055` asserts that
`buildReviewMethodology`'s **entire normalized output** matches each fixture for a canonical
input matrix, and closes with `it('fixture count is exactly 17')`. Separately,
`:1293-1340` runs a two-way drift test extracting R4 blocks from
`.spec-workflow/specs/tighter-reviews/requirements.md` and asserting each appears verbatim in
some fixture and that every fixture directive sentence appears in some R4 block.

- **Task 12 cannot satisfy R4 AC 23 without breaking this, and names none of it.** Its file list
  is `src/core/task-diff.ts, src/tools/review-task.ts` — no test file, no fixture. "State new
  text rather than inheriting it" has exactly two implementations:
  (a) change `R4_2B_DIFF_REJECTED` (`review-task.ts:686-687`) — it appears verbatim in three
  fixtures (`diff-rejected.txt`, `cross-diff-rejected-typecheck-rejection.txt`,
  `cross-success-partial-coverage-diff-rejected.txt`) **and** is pinned byte-identical to a
  requirements document belonging to a different spec (`tighter-reviews`), which this spec has
  no mandate to edit; or
  (b) add a new `DiffMethodologyState` kind — `renderDiffPreamble`'s switch (`:692-710`) gains a
  case, `FIXTURE_INPUTS` needs an eighteenth entry, and `fixture count is exactly 17` fails.
  Either way task 12 as scoped ships red. **Novel, and it causes rework.**
- **The drift test is `describe.skipIf(!existsSync(REQUIREMENTS_MD))` on a gitignored path**
  (`.gitignore:148` ignores `.spec-workflow`). It **skips in CI and runs on the developer's
  machine**. So the failure mode is inverted from the usual one: the implementer sees it, CI
  does not, and a reviewer reading a green CI run concludes the change is safe.
- **Task 11's success criterion "the read-every-file instruction is absent on that path" is
  false as scoped.** There are **four** instructions to read every file, not two:
  1. `task-review-runner.ts:283` — named by task 11 (as `:281`).
  2. `review-task.ts:426` `nextSteps: ['Read all files listed in filesToReview', …]` — named.
  3. `review-task.ts:584` — `'Read ALL files listed in filesToReview before evaluating.'`,
     emitted **unconditionally** in every methodology, and therefore present in all 17 fixtures.
  4. `R4_2A_DIFF_EMPTY` (`:683-684`) — "Read every file in `filesToReview`…" plus the fabricated
     "the task changes were already committed before review."
  Site 4 fires **necessarily** on the all-drop path: `workspaceFiles` is empty →
  `computeTaskDiff` returns at `:41-43` with `diff: ''` and no rejection →
  `computeDiffMethodologyState` → `{kind:'empty'}` → `R4_2A_DIFF_EMPTY`. Task 11's restriction
  *names* that harm and then scopes the work to two sites that do not remove it. This is v1's
  finding against old task 9 ("the note appears while the harm persists"), reproduced with a
  longer restriction block. **Recurring — escalate.** And sites 3 and 4 are both inside the
  golden pin, so removing them is an eighteen-fixture regeneration, not an edit.

### Other overlaps

- **Tasks 10, 11 and 12 are mutually unordered.** All three carry `_Depends: 9_` and nothing
  else. All three edit `src/tools/review-task.ts`, and two of them edit the same return block:
  task 9 changes `data.filesToReview` (`:414`) and the `Promise.allSettled` block (`:386-390`);
  task 10 changes `:387` and `:391` inside that same block; task 11 adds `fileResolution` to
  `data` (`:410-424`) and replaces `nextSteps` (`:425-429`); task 12 changes the rejection path
  consumed at `:101-102`. In parallel these conflict textually; sequentially in any of the six
  legal orders they are fine. A document that opens with "ordering is load-bearing" should not
  leave six legal orders among the four tasks that touch one function.
- **Tasks 9 and 11 both edit `task-review-runner.ts:110` and `buildPrompt` — and this one is
  handled correctly.** Task 9 converts the eleven positional parameters to an options object
  first, so task 11's `fileResolution` is a named field. Briefly fine; the sequencing argument
  in task 9's restriction is exactly right.
- **`src/dashboard/__tests__/task-review-runner.test.ts` is in no task's file list and has eight
  stale prepare-response mocks.** Lines `37`, `56`, `72`, `86`, `125`, `265`, `281`, `297` each
  construct `data: { taskContext: {}, implementationSummary: {}, steeringExcerpt: null,
  filesToReview: [], methodology: '' }`. Task 9 changes `filesToReview`'s shape and task 11 adds
  `fileResolution` to the `:110` destructure. These mocks are untyped, so **tsc reports nothing**
  — the same `any` laundering task 9's restriction correctly identifies at `:110`, one file
  over. Task 11's all-drop branch keys on `fileResolution.workspaceCount`, which is `undefined`
  in all eight. **Novel.**
- **`review-task.test.ts` has a typecheck override task 10 does not list.** `:874` declares
  `overrides.typecheck = async (_projectPath: string, allFiles: string[]) => { … allFiles.filter(…) }`,
  invoked through a `vi.mock` factory that forwards `(...args: any[])` (`:13-20`). Adding a
  required second root parameter shifts `allFiles` by one position; `allFiles.filter` is then
  called on a string and throws at runtime. `as any` + `...args` means **the compiler catches
  nothing**. Task 10's file list is `typecheck.ts, review-task.ts, typecheck.test.ts` — it omits
  the file containing the override. **Novel.**
- **Build-red vs test-red, stated honestly:** task 6 (20 sites) and task 10 (25 sites) are
  build-red mid-task and both list every affected file, so the state is bounded and
  acknowledged. Task 8 is build-red **at its own completion point** and does not acknowledge it.
  That is the distinction the document should be drawing and does not.

---

## 5. Completion criteria and the two new front tasks

### Task 2 — the characterization test nobody owns after it is written

- **Establish which later tasks must update it. The document names two of at least six.**
  Tasks 5 and 10 carry "task 2's parity test still passes." Tasks 8, 9, 11, 12 and 14 do not —
  and tasks 9 and 14 are the two highest-risk.
- **Task 14 breaks it by design, and no task says so.** Task 2 captures **`projectId`** among
  its observables. Task 14 puts `normalizeIdentityPath` (a `realpathSync`) inside
  `generateProjectId` (`project-registry.ts:29-33`). Migration in both requirements.md and
  design.md states plainly that `projectId` **changes wherever `realpath` differs from
  `resolve`** — symlinked home, automounted home, macOS `/tmp` → `/private/tmp`. So the
  characterization test's `projectId` assertion is *supposed* to fail at task 14, on some
  machines and not others. On Linux CI with a plain `mkdtemp` it will not fail; on a macOS
  developer's machine it will. **The implementer is handed a test that fails for a documented,
  intended reason, on a machine-dependent basis, with no rule for telling that from a
  regression.** Task 2's own restriction ("a deliberate local change to the resolution fallback
  makes it fail") teaches the opposite lesson. **Novel, and it causes rework** — either the
  assertion is deleted (losing the guard's most load-bearing observable) or it is "fixed" by
  recomputing the expectation, which is precisely papering over.
  The fix is one sentence in task 14: *task 2's `projectId` assertion is expected to move here;
  re-capture it and record the old and new values in the changelog.*
- **Task 9 is the highest parity risk and carries no parity criterion.** Deleting the
  `.map(p => path.resolve(projectPath, p))` at `:360-361` and routing everything through a new
  resolver changes the file set reaching the diff, the typecheck and hygiene — three of task 2's
  five observables — for *every* user, worktree or not. It is the one task whose success
  criteria should say "task 2's parity test still passes" and does not.
- **Task 2's stated `_Leverage:_` cannot be leveraged.** It names
  "`src/tools/__tests__/review-task.test.ts` (existing prepare harness)". That harness is a
  `vi.hoisted` overrides object plus three `vi.mock` factories (`:7-38`) — **file-local by
  construction**; `vi.mock` is hoisted per module graph and cannot be imported into
  `src/__tests__/parity-baseline.test.ts`. Capturing "the file set reaching the diff and the
  typecheck" requires intercepting `computeTaskDiff`'s and `runProjectTypecheck`'s arguments,
  i.e. re-declaring those factories in the new file. Task 2 must say "re-declare, do not
  import." **Novel.**

### Task 1 — the fixture's stated capabilities do not cover its three consumers

Task 1 builds: sibling and nested worktree layouts, a submodule, a bare repo,
`--separate-git-dir`, a symlinked root. Now check each consumer.

- **Task 3 needs ten layouts (R7 AC 4) and task 1 commits to six.** Missing from task 1's
  stated capabilities: **two unrelated repositories** (needed for "with `GIT_DIR` exported to an
  unrelated repository two unrelated paths compare unequal") and **two non-git directories**
  (needed for "two non-git directories compare unequal" — the R1 AC 4 guard). Task 1 cites only
  `7.1`; the ten-case matrix is `7.4`, cited by task 3. Task 3 will hand-roll both.
- **Task 8 needs capabilities task 1 does not name at all**: a `.spec-workflow` directory seeded
  under the **main repository** (for "containment accepts `.spec-workflow` above the
  workspace"); the ability to create a file in the workflow root and delete it in the workspace
  (for the R4 AC 14 deleted-in-workspace guard); and a **symlinked workflow root** — task 1
  offers "a symlinked root," which is the repository root, not a symlinked path to the tree that
  holds `.spec-workflow`. Task 8 will hand-roll file seeding, which is the "hand-rolling twice"
  task 1's Purpose exists to prevent. **Novel.**
- **Task 2 needs almost none of it.** A non-worktree parity baseline needs one plain repo. The
  2→1 edge is real but thin; it is the 3→1 and 8→1 edges that are under-specified.

### Tasks 15 / 15.1 — an e2e suite that no runner will execute

- **`playwright.worktree.config.ts:14` is `testMatch: '**/worktree-no-shared.spec.ts'`.** Task 15
  creates `e2e/worktree-shared.spec.ts` and task 15.1 fills it with five scenarios. Neither task
  lists `playwright.worktree.config.ts` in its Files line (task 15 mentions it only under
  `_Leverage:_`), and neither says to widen `testMatch` or add a project. **`npm run
  test:e2e:worktree` will not run the new file**, so task 15.1's success criterion ("All five
  scenarios pass independently") is unverifiable through the intended runner.
- **Worse, the default config *will* run it, without the isolation.** `playwright.config.ts:4`
  is `testDir: './e2e'` with no `testMatch`, so `npm run test:e2e` picks up every
  `e2e/*.spec.ts` — including the new one — under a webServer of `npm run dev:dashboard` on
  port 5173 and **no `SPEC_WORKFLOW_HOME`**. That is precisely the failure task 15's restriction
  forbids: "e2e runs write temp worktrees into the real global registry where orphans are
  permanently unreapable under path translation." The isolation lives in
  `playwright.worktree.config.ts:7-10`, in the config that will not run the file. **Novel, and
  it causes rework.**
- **15.1's concurrency scenario needs a harness capability task 15 does not commit to building.**
  `worktree-harness.ts:191-195` is `startMcpServers()` → `startMcpForPath(A)` →
  `await waitForProjects(1, 45000)` → `startMcpForPath(B)`. Strictly sequential, with a barrier
  between. Task 15.1's restriction says "must actually start two servers concurrently rather
  than sequentially, or it does not exercise the registry lock." Task 15's bullets cover cwd,
  invocation, seeding, layouts, `SPEC_WORKFLOW_HOME` and `realpath` — not concurrent start. The
  criterion "the simultaneous-start case fails if the registry lock is reverted" is not
  achievable on the harness task 15 describes. **Compounding.**

### Success criteria that are decisions, not deliverables

The prompt names two. There are **six**, and one more that is a decision dressed as a warning:

1. Task 3 — "`normalizeIdentityPath` needs **stated** behaviour, a **stated** fallback."
2. Task 9 — "**Decide and state** what containment rejection warns."
3. Task 12 — "**state** new text rather than inheriting it."
4. Task 13 — "The memo cache is keyed by an agent-supplied string — **state whether it is
   bounded**."
5. Task 14 — "**state the cost** and **decide explicitly** whether `readRegistry:106` realpaths
   every stored path on every read or normalizes only on write."
6. Task 17 — "**State the position** in the release notes."

Of these, 1, 3 and 6 have a verifiable artifact (a tested helper, a string in a fixture, a
changelog line). **2, 4 and 5 do not.** Task 13's is the worst: "state whether it is bounded" is
satisfiable by writing "unbounded" in a comment, while an unbounded `Map` keyed on an
agent-supplied `args.projectPath` is a memory leak reachable by a client that sends a fresh
path per call — which R3 AC 9's own rationale ("a client that sends `projectPath` on every
call") posits as the motivating case. Task 14's is worse in consequence: the two readings it
declines to pick between differ observably for entries written before the change and for removed
worktrees, and picking wrong puts a synchronous `realpathSync` per entry on a dashboard read path
(`getProject:280`, `isProjectRegistered:335`, and `readRegistry:106` itself). Convert all three
to a stated decision **in the task**, not in the implementer's head.

### Two more, briefly

- **Task 14 names one of the two store sites.** "normalize the path stored at `:216`" — but
  `registerProject`'s existing-entry branch stores it again at **`:207`**
  (`existing.projectPath = workspacePath`). Both read the same `workspacePath` computed at
  `:190`, so normalizing at `:190` covers both; normalizing "at `:216`" as instructed covers one.
  Say `:190`.
- **Task 6's Files line pollutes the parsed file list.** `task-parser.ts:260-269` splits the
  `Files:` value on commas and strips parenthesised suffixes. Task 6's line ends
  "`…, src/dashboard/multi-server.ts, plus sixteen test sites across ten files`", so the parsed
  `files` array gains a member `plus sixteen test sites across ten files`. It will render in the
  dashboard as a file. Prose belongs in a bullet.

---

## Top 5 risks and gaps

1. **Task 8 ends build-red, and R7 AC 6 is the criterion that would have caught it.**
   `safeRealpath`'s move and return change break `validateAllFiles` at `review-task.ts:49` and
   `:64-70`, and invalidate four assertions in the `safeRealpath` block that task 8 says to
   *move* rather than *rewrite*. No task mentions `validateAllFiles`, its removal, or its ten
   test call sites. The document's own principle names the fix: the indivisible set is
   `safeRealpath` + `file-resolution.ts` + `validateAllFiles`'s deletion + the ten call sites +
   the rewritten assertions. **Causes rework.**

2. **Tasks 11 and 12 both require breaking a 17-file golden pin and a two-way drift test, and
   neither names a test file.** `buildReviewMethodology`'s full output is pinned per fixture
   with a hard `fixture count is exactly 17` assertion; `R4_2A_DIFF_EMPTY` and
   `R4_2B_DIFF_REJECTED` are additionally pinned byte-identical to another spec's requirements
   document by a drift test that **skips in CI and runs locally**. Task 11's "the read-every-file
   instruction is absent on that path" is false while `review-task.ts:584` and
   `R4_2A_DIFF_EMPTY` stand — both inside the pin. **Causes rework.**

3. **Tasks 15 and 15.1 ship an e2e file that the worktree config will not run and the default
   config will run without `SPEC_WORKFLOW_HOME` isolation.** `playwright.worktree.config.ts:14`
   pins `testMatch` to the old spec; `playwright.config.ts:4` sweeps `./e2e` with no isolation.
   Neither task lists either config file. 15.1 additionally depends on a concurrent-start
   capability task 15 never commits to building. **Causes rework.**

4. **Task 6 wires six route sites using role names that each map to two `ProjectContext` fields
   differing under path translation, and disambiguates one.** `projectPath` vs
   `workflowRootPath`, `workspacePath` vs `originalProjectPath`. R5 AC 8 silently changes the
   adversarial spawn cwd from untranslated to translated; a mixed-translation `ToolContext` at
   `:828` makes `validatePathWithinBases` reject every workspace file with a message naming
   neither root. Separately, task 6's terminal success criterion needs infrastructure that
   arrives nine tasks later.

5. **The `_Depends:_` field is not read by this project's task parser, and the ordering it
   encodes never reaches the implementing agent.** `task-parser.ts` recognizes `_Prompt:`,
   `_Requirements:`, `_Leverage:`, `Files:`, `Purpose:` and nothing else; `_Depends:` is filed
   into `implementationDetails`, which `handlePrepare` does not pass into `taskContext`. None of
   the eighteen `_Prompt:` fields restates its dependencies. The v1 remedy was implemented in a
   form the toolchain cannot see.

---

## Top 3 conclusions to challenge or reverse

**1. Reverse: "a boundary which is not a commit boundary is not a task boundary" was applied to
the wrong boundaries.**

The principle produced task 6 (a required field, twenty construction sites, two runner contracts
and six route wirings, of which only the field and the twenty sites are actually build-coupled)
and left task 8 split from the `validateAllFiles` removal that its own type change forces. The
test is mechanical: *does `tsc` fail if only half lands?* Applied honestly it **merges** task 8
with the `validateAllFiles` deletion (it must, or the build is red) and **splits** task 6 into
(6a) `ToolContext` + twenty sites + `:828`/`:969`, which the compiler enumerates, and
(6b) the two runner contracts + `:852`/`:1012`/`:1791`/`:1853`, which rename-following
enumerates and which is where the translated/untranslated decision lives. Task 6's own text
concedes the split by describing two different discovery mechanisms for one task.

**2. Reverse: R4 AC 20 and task 11 enumerate two sites when there are four, and two of the four
are golden-pinned.**

The requirement names `task-review-runner.ts:281` and `review-task.ts:426`. The agent is also
told to read every file by the unconditional methodology header (`review-task.ts:584`, present
in all 17 fixtures) and by `R4_2A_DIFF_EMPTY` (`:683-684`), which additionally supplies the
fabricated "already committed" explanation R4 AC 20 names as the harm — and which fires
*necessarily* on the all-drop path, because an empty `workspaceFiles` returns an empty diff with
no rejection at `task-diff.ts:41-43`. Task 11 as written adds a note above the instruction it
cannot reach. This is the v1 finding restated with more prose and the same outcome. Either
R4 AC 20 is rewritten to claim only what a two-site edit delivers, or task 11 grows to include
the methodology constants, the eighteenth fixture, and a decision about the `tighter-reviews`
drift pin. **Do not merge this document until that decision is made** — it is the difference
between a task and a two-day archaeology exercise.

**3. Challenge the premise that the eighteen `_Prompt:` fields are the deliverable.**

Every one of them is a paragraph of restrictions written for a reader who has the design open.
None states its dependencies, none states the values its call sites should receive beyond one
warning at `:969`, and the fields that carry the ordering (`_Depends:`) and the file scope
(`Files:`) are consumed by a parser that files the first into free text and the second into a
comma-split list that task 6 pollutes with prose. Meanwhile six tasks (7, 11, 12, 13, and
partially 14) have purely behavioural success criteria — "the four variables are absent from
both child envs," "each of the four degradation cases warns," "a genuinely empty diff still
classifies as empty" — and **no test file in their Files line**. That is v1's rejection of old
task 3 ("ships an untested parse change"), now recurring across four tasks. The document is
optimising the prose and under-specifying the two things an implementer actually executes
against: what to edit, and where the assertion lives.

---

## What is missing before acting on this document

- **A task, or an expansion of task 8, that deletes `validateAllFiles`, updates its ten call
  sites in `review-task.test.ts` and the two `warnOnce` message assertions, and rewrites the
  four `safeRealpath` assertions for the new return shape** — citing R7 AC 6, which no task
  currently cites.
- **A decision on the methodology golden pin**, recorded in tasks 11 and 12: whether
  `R4_2A_DIFF_EMPTY` / `R4_2B_DIFF_REJECTED` are edited (breaking the `tighter-reviews` drift
  pin, which this spec does not own), whether a new `DiffMethodologyState` kind is added
  (requiring an eighteenth fixture and a change to `fixture count is exactly 17`), and who
  regenerates the fixtures. Both tasks need `src/tools/__tests__/review-task.test.ts` and the
  fixture directory in their Files lines.
- **A `testMatch` change in `playwright.worktree.config.ts`**, in task 15's Files line, plus a
  statement of what stops `playwright.config.ts` from sweeping the new spec without
  `SPEC_WORKFLOW_HOME` isolation.
- **A concurrent-start capability in task 15's bullets**, since 15.1's registry-lock scenario
  depends on it and the current `startMcpServers` barriers on `waitForProjects(1)`.
- **The translated/untranslated field name for each of the six route sites**, written into
  task 6 as a table: `:828`/`:969` → `{ projectPath: ?, workspacePath: ? }`; `:852`/`:1012` →
  `?`; `:1791`/`:1853` → `{ workflowRoot: ?, workspacePath: ? }`. Four fields exist; six slots
  need filling; one warning covers one slot.
- **A sentence in task 14 stating that task 2's `projectId` assertion is expected to move**, and
  how to re-capture it, so a machine-dependent intended failure is not mistaken for a
  regression — and "task 2's parity test still passes" added to task 9, whose file-set changes
  are the largest parity risk in the spec.
- **Enumerated fixture capabilities in task 1** covering what tasks 3 and 8 actually need: a
  second unrelated repository, two non-git directories, `.spec-workflow` seeded under the main
  repository, per-worktree file create/delete, and a symlinked path to the **workflow root**.
- **Test files in the Files lines of tasks 7, 11, 12 and 13**, all four of which have purely
  behavioural success criteria and no place to assert them. Task 13 is the worst: five
  behavioural criteria, five source files, zero test files.
- **Decisions, not "state whether" instructions**, for task 13's memo bound and task 14's
  `readRegistry:106` question.
- **Corrections:** `:281` → `:283` (task 11, three places); `:153` → `:154` for the spawn cwd
  (task 10); "Fourteen tasks" → eighteen; "ten files" → nine (task 6); `7.7` moved from task 17
  to task 5; `4.6` dropped from task 10; `5.9`/`5.10` added to task 16; `:216` → `:190`
  (task 14); task 6's `Files:` prose moved to a bullet.
- **An acknowledgment in task 4 of the residual the design carried and tasks.md dropped**:
  `unregisterProject`, `unregisterProjectById` and `cleanupStaleProjects` remain unlocked
  writers of the same file, so a shutdown racing a startup still loses an entry — and task 14
  adds a new call path through one of them.

---

## Briefly fine

The empirical claims about `tsc` are exact and I reproduced them: 19 errors with `server.ts`
absent, 20 with the annotation and typed parameter, `server.ts(96,13)` as the twentieth. The
twenty-five `runProjectTypecheck` call sites, the three `index-args.test.ts` call-graph
assertions, the ten `validateAllFiles` call sites, all six route line numbers, `:836`/`:986`,
`job-scheduler.ts:176`/`:184`, `isProcessAlive`'s unconditional `true`, and `ensureRegistryDir`'s
position inside the critical section all check out. The `_Depends:_` graph is acyclic and the
numeric order is a valid topological order. Task 9's argument for converting `buildPrompt` to an
options object **before** inserting fields is exactly right and correctly sequenced against
task 11. Task 4's ENOENT-versus-EEXIST analysis, its rejection of `isProcessAlive`, and its
insistence on an atomic rename-aside are all well-grounded in the code. Task 10's per-workspace
`tsbuildinfo` key and its required-not-optional second parameter close v1's finding properly.
Task 3 now scrubs all three git calls in `git-utils.ts`, including `isGitWorktree`. Task 16's
"reverting either SHALL-continue site makes a test fail" is the only success criterion in the
document that is stated as a mutation test, and it is the right shape for the other seventeen.
