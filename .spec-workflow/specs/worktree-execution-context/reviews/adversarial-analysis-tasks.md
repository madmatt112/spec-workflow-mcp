# Adversarial Analysis — worktree-execution-context/tasks.md (v1)

The document opens by asserting that ordering is load-bearing and that the design's six
indivisible sets are "restated inline as **BLOCKING** notes." Both halves of that sentence
fail under inspection. Two of the six sets are not restated where the work actually lands,
one BLOCKING note names a dependency that does not exist, and at least two task pairs that
carry no BLOCKING note cannot compile independently. Separately, the task list is ordered by
component rather than by build dependency, which puts a compile-breaking pair (2, 3) in the
wrong order and schedules the spec's only regression guard last.

What follows attacks six areas. Every line reference was checked against the working tree at
`2605819`.

---

## 1. The BLOCKING vocabulary — atomicity claims that do not survive checking

The header claims the six design sets are restated inline. Six tasks carry BLOCKING notes
(2, 4, 5, 7, 10, 12). The mapping is not the one the header asserts.

- **Refute Task 5's BLOCKING note outright.** It reads "this must land with task 6, because
  the resolver depends on it." That is a one-way forward dependency (6 needs 5), not a
  co-landing constraint, and the design's set 2 says something different: `safeRealpath`
  "must land with `file-resolution.ts` and with its own test block." Task 5 already creates
  `src/core/file-resolution.ts` and already lists `src/tools/review-task.ts` and
  `src/tools/__tests__/review-task.test.ts` in its file set — the entire design constraint is
  satisfied *inside task 5*. Either the note is wrong, or task 5's file list is wrong. As
  written, the document teaches an implementer that BLOCKING means "something later depends
  on this," which is true of almost every task here and drains the word of meaning that
  task 4 ("BLOCKING and INDIVISIBLE… This must be one commit") relies on.
- **Challenge the claim that Task 10's BLOCKING note identifies anything.** It says "this
  must land with the shape change itself" without naming which task performs the shape
  change. `ResolvedFile` is defined in task 6; `filesToReview` is populated in task 7; the
  renderer is updated in task 10. Design set 4 requires the shape change and
  `buildPrompt`/`:277`/the two assertions to be one landing. The tasks split it across three.
  Trace the concrete failure: task 7's success criterion says `.spec-workflow` entries "reach
  `filesToReview`" without stating in what shape. If task 7 assigns the labelled
  `ResolvedFile[]` (which is what R4 AC 15 and the design's consumer table demand), then for
  the whole of tasks 8 and 9 every dashboard-spawned review renders
  `- [object Object]` once per file at `task-review-runner.ts:277`, under an unchanged
  instruction "Read every file listed in 'Files to Review'." That is exactly the outcome
  design set 4 exists to prevent, produced by the task decomposition itself.
- **Stress-test the header's claim that set 6 is restated.** Design set 6 is
  "`git-utils.ts`'s new exports must land with `index-args.test.ts`'s `vi.mock` factory."
  Task 1 adds four new exports to `git-utils.ts` and lists only `src/core/git-utils.ts` —
  no test file at all. The note appears on task 2. The claim survives only because the
  factory needs to cover what `index.ts` imports rather than what `git-utils.ts` exports,
  which means the design's set 6 is stated wrongly and the tasks inherited it verbatim
  instead of correcting it.
- **Force the document to state the dependency graph it claims to encode.** Six BLOCKING
  notes are the entire ordering apparatus for eighteen tasks. There is no `_Depends: n_`
  field, and the `_Leverage:_` lines that gesture at dependencies ("task 1's helpers",
  "task 5's `safeRealpath`", "task 6's `resolveLoggedFiles`") appear on only four tasks.
  Tasks 2→3, 4→12, 7→11 and 15→17 all carry real build- or behaviour-level dependencies
  with nothing recording them.
- **Reject the framing that a BLOCKING note and a separate task number can coexist.** Task 4
  says a set of changes "must be one commit" and is one task. Task 5 says the same about a
  pair and is two tasks, each with its own `[-]` → `log-implementation` → `[x]` lifecycle. If
  the tracking convention is one task per commit, tasks that must share a commit must share a
  number.

---

## 2. Tasks 2 and 3 — a split that does not build, and an off-switch that arrives late

Task 2 introduces `resolveWorkspaceRoots` and turns inference on. Task 3 registers
`--no-workspace-inference` at five parse sites.

- **Challenge the claim that Task 2 is implementable as specified.** Task 2 requires
  "validate an inferred path with `validateProjectPath` and fall back with a log on failure."
  `validateProjectPath` is `async` (`src/core/path-utils.ts:280`, returns `Promise<string>`).
  The design declares `resolveWorkspaceRoots` synchronous
  (`design.md:89-92`, no `Promise`), and `parseArguments` is synchronous
  (`src/index.ts:99`, returns an object literal). You cannot await an async predicate from a
  synchronous resolver called by a synchronous parser. The three resolutions are: make
  `parseArguments` async — which breaks all three tests in `index-args.test.ts`, each of which
  does `const parsed = parseArguments([...]); expect(parsed.workspacePath)…`, and changes an
  exported signature; reimplement the predicate synchronously — violating R1 AC 8's "the same
  predicate the server already applies"; or validate in `server.initialize`, which already
  calls `await validateProjectPath(this.workspacePath)` at `server.ts:66` but *throws* rather
  than falling back, defeating the criterion. Task 2 names none of these, and its restriction
  block — which finds room for three other warnings — is silent on it.
- **Attack the ordering of 2 before 3 directly.** Task 2's precedence chain consumes a
  `noInference` boolean. Task 3 owns the boolean read at `:109-111` and the `main()`
  destructure at `:212-215`. Task 2 must therefore either edit sites task 3 claims, or pass a
  hardcoded `false`. Worse, the validation loop at `src/index.ts:116-128` throws
  `Unknown option` for any `--`-prefixed argument absent from `validFlags` — so after task 2
  lands, `--no-workspace-inference` makes the server refuse to start. **Task 2 is the commit
  that switches inference on for every user, and the documented escape hatch does not exist
  until task 3.** Task 3's own restriction block states this mechanism ("the validation loop
  at :116-128 throws Unknown option and the server refuses to start") without noticing it
  indicts the ordering.
- **Stress-test Task 3's `=value` success criterion against the code it changes.** The
  criterion is "`--no-workspace-inference=true` does not become the project path." Meeting it
  is a one-line filter change. But the boolean reads are exact-string matches —
  `args.includes('--no-open')` at `src/index.ts:110`. After the filter fix,
  `--no-workspace-inference=true` is accepted by the validation loop, stripped from the path
  position, and read as `false`. The user's opt-out is silently discarded and inference stays
  on — which is the failure mode the flag exists to escape. The same applies to
  `--no-open=true` and `--no-shared-worktree-specs=true`, which task 3 explicitly brings into
  scope. Neither R1 AC 17 nor task 3 says what the `=value` form should *mean*; the task
  converts "wrong project path" into "silently ignored flag" and calls it done.
- **Reject Task 3's file list.** It is `src/index.ts` — one file. All four of its success
  criteria are assertions about parsing behaviour ("The flag parses in bare form and
  suppresses inference"; "`--help` lists the new flag"), and there is exactly one place those
  can be asserted: `src/__tests__/index-args.test.ts`, which task 3 does not list. Task 3 as
  written ships an untested parse change.
- **Challenge the "four assertions" count in Task 2's restriction and R7 AC 7.**
  `index-args.test.ts` contains three assertions referencing the mocked functions:
  `toHaveBeenCalledWith('/tmp/specwf-wt-a')` (:28), `not.toHaveBeenCalled()` (:29), and
  `toHaveBeenCalledWith('/tmp/specwf-wt-b')` (:42). The third test asserts nothing about the
  call graph. In a document whose authority rests on exact counts — "twenty construction
  sites," "ten test call sites," "five parse sites," "six drop causes" — an unchecked count
  is a signal that the others deserve re-derivation too.
- **Attack the replacement of the log block at `:218-225`.** Task 2 says replace it "with one
  emission fired when `source === 'inference'`." The existing block has two arms: a
  worktree-detected arm printing both roots whenever `workspacePath !== workflowRootPath`, and
  a `--no-shared-worktree-specs` arm. An inference-only emission deletes both. A user who
  passes a worktree path explicitly, or sets `SPEC_WORKFLOW_WORKSPACE`, now gets no root
  logging at all — contradicting the Usability NFR ("Startup logging SHALL make the resolved
  workspace and workflow roots visible without a debug flag") and R1 AC 18, which says
  *reconciled with*, not *replaced by*.

---

## 3. Tasks 5–10 — the review-task chain, and the typecheck root split

- **Refute Task 8's enumeration of `runProjectTypecheck`'s root uses.** The task names four:
  `tsconfigPath`, `resolveTscBinary` (`typecheck.ts:134`), the cache mkdir (`:139-140`), and
  `ensureGitignoreEntry` (`:141`). There are two more, and both are load-bearing:
  `-p projectPath` in the argument array at `typecheck.ts:146` and the fourth argument to
  `spawnTsc(tscPath, args, env, projectPath)` at `:154`, which is the child's cwd. If either
  keeps the workflow root, tsc compiles the main checkout while reporting the worktree's
  `tsconfigPath` — the exact defect the spec exists to fix, now with a `tsconfigPath` string
  that lies about which tree was compiled. The design undercounts identically
  ("uses its root for three things beyond `tsconfigPath`"); the task copies the error instead
  of catching it. Task 8's success criteria do not mention `-p` or the spawn cwd either.
- **Attack Task 8's file list.** It is `src/core/typecheck.ts, src/tools/review-task.ts`.
  `runProjectTypecheck` has **twenty-five** call sites in
  `src/core/__tests__/typecheck.test.ts` (`:121` through `:603`), every one passing a single
  root. `tsconfig.json` sets `"include": ["src/**/*"]` and excludes only `node_modules`,
  `dist`, and `src/dashboard_frontend/**`, and `npm run build` runs bare `tsc` — so those
  tests are compiled by the build. A required second parameter breaks the build at
  twenty-five sites the task does not list; an optional one silently leaves the default on
  whichever root the implementer picks, and task 8's "with equal roots behaviour is
  unchanged" criterion cannot distinguish the two.
- **Stress-test the decision to put the typecheck cache on the workflow root.** Task 8
  mandates the cache mkdir and `tsbuildinfoPath` (`typecheck.ts:143`) on the workflow root.
  In the spec's primary use case — N worktrees, one shared `.spec-workflow` — that is **one
  `tsc.tsbuildinfo` file shared by every worktree**, written with `--incremental` and a
  per-worktree `-p` root. Two reviews running in two worktrees write the same path
  concurrently; `MAX_CONCURRENT_PER_PROJECT = 2` does not help because the worktrees are now
  distinct projects by construction. Best case every run is a full rebuild and the incremental
  cache is pure overhead; worst case a truncated or interleaved tsbuildinfo trips
  `TSBUILDINFO_REBUILD_RE` (`typecheck.ts:53`) on unrelated reviews. Nothing in task 8, the
  design, or R4 AC 3 keys the cache file per workspace.
- **Challenge Task 6's completeness against its own design section.** Design §3 ends with
  "**Dedupe** by realpath across the whole result," with an explicit note on what it does not
  solve. Task 6 does not mention dedupe in its bullets, its restrictions, or its success
  criteria. The dedupe that exists today is the raw-string `new Set` at
  `review-task.ts:360`, which task 7 preserves — and which does not collapse `src/foo.ts`
  against `./src/foo.ts`. After task 7 deletes the `.map`, those two entries reach the
  resolver as distinct strings, resolve to one realpath, and appear twice in `filesToReview`
  and twice in the diff pathspec list.
- **Attack Task 7's "decide and state" instruction as a non-criterion.** Task 7 says "decide
  and state what containment rejection warns, since the current message names projectPath and
  there are now two roots." A task whose deliverable is a decision has no verifiable
  completion condition, and R7 AC 6 makes the same move ("SHALL be decided rather than
  inherited"). Meanwhile `validatePathWithinBases` (`path-utils.ts:169`) *throws* with the
  fixed message `Path traversal detected: path escapes allowed directories` — so task 6's
  "Establish containment via `validatePathWithinBases`" requires a try/catch per entry to
  produce the `outside-roots` count, and the message the reviewer sees comes from a primitive
  neither task is allowed to change. Neither task says which layer emits the warning.
- **Refute Task 9's claim to close the all-drop failure.** Its purpose line is "Stop an
  all-drop review reaching the agent as an empty list with a fabricated explanation." Task 9
  adds a note and counts. It does not touch `task-review-runner.ts:283` ("1. Read every file
  listed in 'Files to Review'.") or `review-task.ts:426`
  (`nextSteps: ['Read all files listed in filesToReview', …]`). An all-drop review still
  reaches the agent as an empty list under an instruction to read it, now with a note above.
  Nothing gates the verdict, and R4 AC 16's stated harm — "a passing verdict over unexamined
  code" — is untouched. Task 9's success criterion is that the note *appears*, which is
  satisfied while the harm persists.
- **Stress-test the two consecutive edits to `buildPrompt`'s eleven-parameter signature.**
  Task 9 inserts `fileResolution`; task 10 changes `filesToReview`'s type. `buildPrompt`
  (`:206-217`) takes eleven positional parameters, of which `taskContext` and
  `implementationSummary` are `any` and three trailing ones default to `null`. The natural
  typing for `fileResolution` is `any`, because it is destructured from an `any`-typed
  `prepareResponse.data` at `:110`. Insert it after `filesToReview` and forget to reorder the
  single call site at `:138`: `methodology` lands in the `fileResolution` slot,
  `outputPath` lands in `methodology`, and the real output path lands in
  `priorReviewContext: string | null`. All assignable; **tsc reports nothing**; the agent is
  handed a prompt whose methodology section contains a temp file path and which never learns
  where to write its JSON. Neither task fixes the parameter position or proposes an options
  object.

---

## 4. Tasks 12–14 — runner contracts, and a direct contradiction between 13 and 14

- **Force a resolution of the contradiction between Task 13 and Task 14.** Task 13's
  restriction: "Do NOT add a second field to `AdversarialRunner`: it uses its path at exactly
  one place and a `workflowRoot` field would be dead." Its success criterion: "the runner
  carries one path field." Task 14, one task later, requires deleting the four `GIT_*`
  variables from "both agent spawn envs (`:368`, `:147`), **setting the two
  `SPEC_WORKFLOW_*` roots explicitly at the spawn sites**." `adversarial-runner.ts:147` is
  `AdversarialRunner`'s spawn. Setting `SPEC_WORKFLOW_SHARED_ROOT` there requires the
  workflow root — the field task 13 forbids and asserts absent. R2 AC 13 requires it; R5 AC 5
  and design §5 forbid it; the tasks carry both, one task apart, in the order that makes
  task 13's committed success criterion false by task 14. Decide whether `AdversarialRunner`
  gains a second field, inherits `SPEC_WORKFLOW_SHARED_ROOT` from the dashboard process
  (which is wrong when the dashboard serves several workflow roots), or is exempted from
  R2 AC 13 — and say so in whichever task lands first.
- **Attack Task 4's silence on what value each of the twenty sites receives.** Task 4 makes
  `workspacePath` required and says "every context carries a real workspace path." At
  `task-review-runner.ts:100` the only value available is `opts.projectPath` — the workflow
  root — because `RunOptions.workspacePath` does not exist until task 12, eight tasks later.
  At `multi-server.ts:828` and `:969` the available values are `project.originalProjectPath`
  and `project.projectPath`, and the design explicitly warns that "the obvious mechanical fix
  at `:969` (add `workspacePath: project.originalProjectPath`) preserves the bug." Task 4
  reproduces neither the warning nor the intended values. Its instruction "Run tsc to
  enumerate the sites rather than working from a list" tells the implementer how to *find*
  the sites and nothing about how to *fill* them, which is where the defect lives.
- **Challenge the window opened between Task 4 and Task 12.** From task 4 onward, every
  dashboard-spawned review carries a `ToolContext` whose `workspacePath` is the shared
  workflow root while the type contract asserts it is the workspace. Tasks 7 through 11 then
  build the entire two-root consumer chain on top of that field. Behaviour is unchanged
  (both roots are equal today for the dashboard path), so nothing fails — which is precisely
  the problem: five tasks' worth of success criteria are green against a context that is
  lying, and the first real exercise of the split is task 12's. Reorder so 12 and 13 land
  immediately after 4, or state in task 4 that the placeholder is deliberate and name it.
- **Stress-test Task 14's assumption that `TaskDiffResult.rejection` is enough.** The task
  says to reuse the existing field at `task-diff.ts:9` because "it is already consumed at
  `review-task.ts:101-102`." Verified — `computeDiffMethodologyState` maps it to
  `{ kind: 'rejected', message }`. But task 14 adds a *new* producer of that state (a
  containment assertion failure) with a message the reviewing agent has never seen, and no
  task updates `buildReviewMethodology`'s handling or asserts what the agent is told. The
  criterion "a workflow-root pathspec reaching the diff produces a rejection distinguishable
  from an empty diff" is satisfied by any string; the requirement's purpose — that the agent
  not be told the changes were already committed — is not tested end-to-end anywhere.
- **Reject Task 14's scope for `runGit`.** `runGit` (`task-diff.ts:21-32`) is the only git
  invocation in the parent process on the code path, and task 14 scrubs it. Correct. But
  `git-utils.ts` contains a third git call the task-1 enumeration does not name —
  `isGitWorktree` at `:82`. Task 1 says "every git call in the module" and then lists two.
  `isGitWorktree` currently has no production callers, which makes the omission harmless
  today and a trap the moment someone wires it up.

---

## 5. Tasks 15–16 — identity normalization and the registry lock

- **Attack Task 16's acquire step against its own success criterion.** The criterion is
  "N concurrent registrations against a nonexistent registry file produce N entries." The
  acquire is `fs.open(lockPath, 'wx')` at `${registryPath}.lock`, and `registryPath` is
  `join(getGlobalDir(), 'activeProjects.json')` (`project-registry.ts:57-58`). The directory
  is created by `ensureRegistryDir()`, called only from `readRegistry` (`:87`) and
  `writeRegistry` (`:148`) — both *inside* `registerProject`, i.e. inside the lock. On a
  first run the global directory does not exist, so `fs.open(…, 'wx')` fails with **ENOENT,
  not EEXIST**. If the retry loop treats every failure as contention, all N processes burn
  the full time budget and all N "log prominently and continue unregistered" — zero entries,
  not N. If it treats ENOENT as fatal, it throws, and `registerProject` is awaited before the
  transport connects (`server.ts:77`), killing the MCP handshake — the outcome R6 AC 4
  exists to prevent. Task 16 never says to create the directory before acquiring, and does
  not distinguish ENOENT from EEXIST anywhere.
- **Challenge the ordering of Task 16 at position 16.** R6's design note is explicit that
  this spec *creates* the loss: "Before per-worktree identity, N worktrees computed the same
  `projectId` and concurrent registration converged." Per-worktree identity lands at **task 2**.
  The lock lands at **task 16**. That is a fourteen-task window during which anyone dogfooding
  the branch with two agents in two worktrees loses a registration silently, and every route
  contract tasks 12–13 establish fails to fire for the lost worktree. The document's opening
  sentence claims ordering is load-bearing; nothing in the ordering reflects the risk window
  the spec's own requirements document identifies.
- **Stress-test Task 15's conversion of `generateProjectId` into a filesystem-dependent
  function.** `generateProjectId` (`project-registry.ts:29-33`) is today a pure SHA-1 of a
  string. Task 15 puts `normalizeIdentityPath` inside it, which must call `realpathSync`.
  It is then called at `:192`, `:236`, `:280`, `:335` — including on registry *read* paths
  that the dashboard exercises per request. The task states neither the synchronous-I/O cost
  nor what happens when the path no longer exists, beyond "a deterministic fallback when
  realpath fails." Trace the fallback: a worktree registers while it exists (id from the
  realpath), then `git worktree remove` runs, then anything recomputing an id from
  `entry.projectPath` gets the fallback spelling and a **different** id from the map key.
  Task 15's criterion "id and stored path agree" holds only while the directory exists, and
  the Reliability NFR ("A worktree whose directory has been removed SHALL NOT prevent the
  dashboard from starting or serving other projects") is asserted by no task.
- **Force Task 15 to say what `readRegistry:106` does.** The bullet says "match
  `readRegistry`'s re-normalization at `:106`." `:106` currently does `resolve(entry.projectPath)`
  for every entry on every read. "Match" could mean realpath every stored path on every
  registry read — synchronous filesystem calls proportional to project count on a hot path,
  failing for every removed worktree — or leave `resolve()` and normalize only on write, in
  which case identity and stored path disagree for entries written before this change. The
  two readings differ observably and the task picks neither.
- **Attack `normalizeIdentityPath`'s complete absence of completion criteria.** Task 1
  introduces it in a single clause ("and `normalizeIdentityPath(p)`") with no stated
  behaviour, no stated fallback, and no mention in task 1's success criteria, which cover
  only `gitCommonDirAbsolute`, `gitTopLevel` and `sameRepository`. Its semantics are specified
  fourteen tasks later, in task 15's restrictions. No task unit-tests it.

---

## 6. Tasks 1, 17, 18 — verification, and the requirement traceability audit

- **Reject Task 1's success criteria as unsupported by its file list and by the existing test
  file.** Task 1 lists one file: `src/core/git-utils.ts`. Its success criteria are a
  ten-fixture unit test matrix over real git repositories. The only place those could go is
  `src/core/__tests__/git-utils.test.ts`, which begins with
  `vi.mock('child_process', () => ({ execSync: vi.fn() }))` at `:11-13` — a whole-module mock
  that makes real-repository tests impossible in that file without restructuring it. Task 1
  names no test file, no fixture helper, and no restructuring.
- **Attack the missing fixture task.** R7 AC 1 requires "a fixture creating a real git
  repository with at least one linked worktree in a temporary directory, supporting sibling
  and nested layouts, and removing it on teardown." No such helper exists in `src/` today
  (the only git-repo construction is `e2e/helpers/worktree-harness.ts`). The only task citing
  7.1 is **task 17**, which is the e2e rewrite — position seventeen. Tasks 1 and 6 both need
  it at position one and six. Either add a fixture task before task 1, or accept that tasks 1
  and 6 will each hand-roll their own and the sibling/nested layouts will be built twice.
- **Stress-test Task 1's submodule fixture against modern git.** The success criteria require
  a submodule case ("a superproject and submodule compare unequal"). Since git 2.38.1,
  `file://` transport for submodules is disabled by default (CVE-2022-39253); a local
  `git submodule add ./sub` fails unless the fixture sets
  `-c protocol.file.allow=always`. Neither task 1, nor R7 AC 4, nor the design's testing
  strategy mentions it. The concrete failure is a fixture that works on one developer's
  machine and fails in CI, or silently never exercises the case task 1 calls out as the
  reason not to reuse the normalization at `git-utils.ts:60-66`.
- **Challenge scheduling the parity test last.** Task 18 is the only place R3 AC 11's
  non-worktree parity is asserted — "a project with no path argument, asserting file sets,
  containment, `tsconfigPath` and `projectId` unchanged." *Unchanged from what?* Written at
  position eighteen, the test is authored against post-change behaviour and can only assert
  that the code does what it now does. To detect a regression introduced by task 2 or task 7
  it has to be a characterization test written **before** task 1, capturing today's values.
  The task's own restriction says this population "is the one the earlier design regressed" —
  and then schedules its guard after every change that could regress it again.
- **Reject Task 18 as a single task.** Its file list spans two test files, `docs/CONFIGURATION.md`
  and `CHANGELOG.md`; it claims seven acceptance criteria across two requirements; and it
  mixes a regression guard, new worktree test cases, user documentation and release notes.
  Those have nothing in common and four different completion conditions. Split at minimum
  into a parity/coverage task (moved to the front) and a documentation task.
- **Attack Task 18's requirement citations as double-ownership.** It claims 7.6 (the ten
  `validateAllFiles` call sites and the two `warnOnce` assertions) — done in **task 7**. It
  claims 7.7 (the `index-args.test.ts` mock factory) — done in **task 2**. It claims 7.9,
  which enumerates coverage for R2 AC 12, R3 AC 2, R3 AC 5-7, R4 AC 16-17, all of R5, R6 AC 2
  and R1 AC 13 — every one of which has its own success criteria in tasks 4, 9, 10, 11,
  12–14, 15 and 16. Either those tasks did the work and task 18's citations are vacuous, or
  they did not and task 18 is eleven tasks too late. Traceability that means both is
  traceability that means neither.
- **Force Task 17 to state what it must preserve.** It is described as "a rewrite, not an
  extension," with the criterion "the existing no-shared-mode suite still passes." The
  current harness carries two properties the criteria never name: `SPEC_WORKFLOW_HOME`
  isolation via `this.options.specWorkflowHome` (`worktree-harness.ts:205`), without which
  the e2e run writes temp worktrees into the developer's real global registry — where, per
  Migration, orphans are permanently unreapable under path translation; and the
  `realpath()` calls at `:145-147` that make `project.projectPath === this.wtAPath`
  comparisons hold. Task 15's identity normalization lands before task 17 and interacts
  directly with the second; a rewrite that drops either produces a suite that passes locally
  and pollutes or fails elsewhere.

### Uncovered acceptance criteria

Cross-referencing every `_Requirements:_` line against `requirements.md`:

| AC | Text | Status |
|---|---|---|
| **R4 AC 4** | `tsc-not-found` recorded in Migration as expected | Cited by no task. Task 18's *prose* mentions it; its `_Requirements:_` line does not. |
| **R5 AC 9** | Settings continue to load from the workflow root for the adversarial routes | Cited by no task. `multi-server.ts:836`, `:986` (`loadSettings(project.projectPath)`) are in no file list. |
| **R5 AC 10** | Job scheduler continues to pass the workflow root to `cleanupSpecs`/`cleanupArchivedSpecs` | Cited by no task. `src/dashboard/job-scheduler.ts:176`, `:184` appear in no file list, and the file appears nowhere in the document. |
| **R7 AC 1** | Unit-level git fixture with sibling and nested layouts | Cited only by task 17 (e2e), needed by tasks 1 and 6. |

R5 AC 9 and AC 10 are "SHALL continue" criteria — regression guards for behaviour the spec
must not break. They are exactly the kind that get broken by a sweeping rename, and exactly
the kind no compiler catches when the field being renamed is `projectPath` on a runner
options object.

---

## Top 5 risks and gaps

1. **Tasks 13 and 14 contradict each other one task apart.** Task 13 forbids a second path
   field on `AdversarialRunner` and asserts its absence as a success criterion; task 14
   requires setting `SPEC_WORKFLOW_SHARED_ROOT` explicitly at `adversarial-runner.ts:147`,
   which needs exactly that field. Implementing in order makes task 13's committed criterion
   false; implementing task 14 first violates task 13's restriction. R2 AC 13 and R5 AC 5
   carry the same contradiction upstream, so this has to be resolved in the requirements, not
   patched in a task.

2. **Task 2 cannot be implemented as written.** R1 AC 8's `validateProjectPath` is async;
   `resolveWorkspaceRoots` and `parseArguments` are both synchronous. Every resolution
   (async `parseArguments`, a sync reimplementation, or validation moved into
   `server.initialize`) changes something the spec pins — an exported signature, "the same
   predicate the server already applies," or fall-back-instead-of-throw. Task 2's restriction
   block does not mention it. Compounding: task 2 turns inference on and task 3 supplies the
   only way to turn it off, in that order, with `--no-workspace-inference` throwing
   `Unknown option` in between.

3. **Task 8 undercounts `runProjectTypecheck`'s root uses and omits twenty-five call sites.**
   `-p projectPath` (`typecheck.ts:146`) and `spawnTsc`'s cwd (`:154`) are unnamed; getting
   either wrong reproduces the defect while reporting the worktree's `tsconfigPath`. The file
   list omits `src/core/__tests__/typecheck.test.ts`, which the bare-`tsc` build compiles and
   which calls the function twenty-five times with one root. Separately, pinning the
   incremental cache to the workflow root gives N worktrees one shared `tsc.tsbuildinfo`
   written concurrently.

4. **The `filesToReview` shape change is split across tasks 6, 7 and 10, violating the
   design's own indivisible set 4.** For the duration of tasks 8 and 9, a dashboard-triggered
   review renders `- [object Object]` per file at `task-review-runner.ts:277` under an
   instruction to read them — with no build error, because the destructure at `:110` is
   `any`. Task 10's BLOCKING note says "must land with the shape change itself" without
   naming which task that is.

5. **Task 16's lock acquires before the directory it locks in exists.** `fs.open(lockPath,
   'wx')` fails with ENOENT on a first run, which is the exact scenario R6 AC 2 and task 16's
   own success criterion specify. Depending on how the retry loop classifies the error, N
   concurrent first-run registrations produce either zero entries or a dead MCP handshake.
   And the lock lands fourteen tasks after task 2 creates the loss it prevents.

---

## Top 3 conclusions to challenge or reverse

**1. Reverse: the typecheck cache should not be a single shared file on the workflow root.**

Task 8 and R4 AC 3 argue correctly that the cache must not go *in the worktree* — that would
create `.spec-workflow` inside every worktree and dirty each one's tracked `.gitignore`. The
conclusion drawn is "therefore put it on the workflow root," which silently makes
`<workflowRoot>/.spec-workflow/.cache/tsc.tsbuildinfo` a single mutable file shared by every
worktree, written with `--incremental` against different `-p` roots, potentially concurrently.
The premise supports a weaker conclusion: the cache **directory** belongs on the workflow root;
the cache **file** must be keyed per workspace. `tsc-<projectId>.tsbuildinfo` costs one line
and preserves both the "no `.spec-workflow` in the worktree" invariant and the incremental
benefit. As specified, the incremental cache is at best useless in the spec's primary use case
and at worst a concurrency bug introduced by the spec that fixes a concurrency bug.

**2. Reverse the ordering: the parity guard and the registry lock belong at the front.**

Task 18's non-worktree parity assertions are the only protection for the entire existing user
base, and they are scheduled after all eighteen behaviour changes. A parity test written last
is a snapshot of the new behaviour, not a guard against regressing the old one — it cannot
fail. It must be a characterization test written before task 1, capturing today's file sets,
containment decisions, `tsconfigPath` and `projectId` for a non-worktree project with no path
argument. The same argument applies to task 16: R6's own design note says this spec creates
the registration race, and the creating change is task 2. Moving the lock to position 3 costs
nothing in dependencies (it touches only `project-registry.ts` and a new module) and closes a
fourteen-task window in which the branch silently loses registrations while it is being
dogfooded.

**3. Challenge the premise that eighteen sequential tasks is the right decomposition at all.**

The document's header concedes the point: six of eighteen tasks carry BLOCKING notes, and
three of those ("must be one commit", "must land with task 6", "must land with the shape
change itself") say the task boundary is not a commit boundary. Where a boundary is not a
commit boundary, it is not a task boundary either — it is a checklist inside one. Tasks 5+6,
7+10, and 2+3 are each one unit of work with one build-green point; splitting them buys
nothing and costs three intermediate states that either do not compile or compile while
behaving wrongly. Conversely task 4 (twenty sites, one commit), task 17 (full harness rewrite
plus five scenarios) and task 18 (two test files, two docs, seven ACs) are each too large to
review as a unit. Merge the three blocked pairs; split 18 into a parity task and a docs task;
and give task 17's five scenarios their own checkboxes. That yields roughly the same total
work with boundaries that mean something.

---

## What is missing before acting on this document

- **A dependency graph.** Six BLOCKING notes and four `_Leverage:_` mentions do not encode
  2→3, 4→12, 5→6, 6/7→10, 7→11, 15→17. Add a `_Depends:_` line per task or a graph at the top.
- **A resolution of the `AdversarialRunner` env contradiction**, decided in `requirements.md`
  between R2 AC 13 and R5 AC 5 before either task 13 or task 14 is started.
- **A stated answer to the sync/async problem in R1 AC 8**, with the consequences for
  `parseArguments`' exported signature and `index-args.test.ts`'s three tests spelled out.
- **A fixture task before task 1** implementing R7 AC 1 — real repository, linked worktree,
  sibling and nested layouts, `-c protocol.file.allow=always` for the submodule case,
  teardown — plus a decision on where real-repository git tests live given that
  `src/core/__tests__/git-utils.test.ts` mocks `child_process` wholesale.
- **A characterization-test task at position 0** capturing today's parity observables for a
  non-worktree project with no path argument, so task 18's assertions have a baseline that
  can fail.
- **Task-level coverage for R5 AC 9 and AC 10**, naming `multi-server.ts:836`/`:986` and
  `src/dashboard/job-scheduler.ts:176`/`:184`, neither of which appears anywhere in this
  document.
- **Explicit placeholder values for the twenty `ToolContext` sites in task 4**, in particular
  `task-review-runner.ts:100` and `multi-server.ts:828`/`:969`, with the design's warning that
  `project.originalProjectPath` at `:969` preserves the bug carried into the task.
- **A decision on whether the file-resolution disclosure is informational or actionable.**
  If R4 AC 16's stated harm is "a passing verdict over unexamined code," some task must change
  `task-review-runner.ts:283` and `review-task.ts:426`, or the requirement should be rewritten
  to claim only what task 9 delivers.
- **A per-workspace key for the typecheck incremental cache**, or an explicit statement in
  task 8 and Migration that incremental typechecking is disabled in multi-worktree use.
- **A statement of what `--flag=value` means** for all three flags, since task 3's fix
  converts a wrong-project-path bug into a silently-ignored-flag bug for the one flag whose
  purpose is escaping a bad inference.

---

## Briefly fine

The dashboard route wiring in tasks 12 and 13 is correct and complete against the code:
`ProjectContext` already carries `projectPath`, `workspacePath` and `originalProjectPath`
(`project-manager.ts:12-16`), all four route sites are real (`multi-server.ts:828`, `:852`,
`:969`, `:1012`, `:1791`, `:1853`), and the retry routes reproduce the defects verbatim as
claimed. Task 7's `new Set` observation is exact — the dedupe is on line 360 and the `.map` on
361, so deleting the `.map` alone is safe. Task 4's instruction to enumerate sites with `tsc`
rather than from a list is the right move and correctly defuses its own "twenty" count.
Task 16's rejection of `isProcessAlive` for staleness is well-grounded:
`project-registry.ts:166-171` does return `true` unconditionally when both path-translation
variables are set. Task 11's memoization rationale holds — `resolveGitRoot` is a synchronous
`execSync` with a 5s timeout (`git-utils.ts:5-9`) — though the cache is keyed by an
agent-supplied string with no eviction policy stated.
