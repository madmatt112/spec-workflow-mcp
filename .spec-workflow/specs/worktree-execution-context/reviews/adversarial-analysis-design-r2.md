# Adversarial Analysis — worktree-execution-context/design.md (v2)

Every code claim below was re-checked against the working tree at `2605819`. Two git
behaviours (`--git-common-dir` output forms, submodule common-dir shape) were verified
empirically in scratch repositories, not inferred.

**Prior-review posture.** v2 resolved most of v1's list, and resolved it properly rather
than by assertion: the `setupHandlers(context: any)` typing hole is now named and closed
(Component 2); `ApprovalStorage` is exempted from sharing with the correct reason
(Component 6); containment is narrowed to `workspacePath ∪ join(workflowRoot,
'.spec-workflow')` (Component 10); the diff base is workspace-keyed and validated with
`merge-base --is-ancestor` (Components 3, 9); the registry uses an exclusive lock across
all four writers and no longer aborts `initialize` (Component 7); `baseline` is split from
`degraded` (Component 4); the WebSocket shape is held constant so no `dist` rebuild is
needed (Component 6); R1 AC 11 and the adversarial disclosure both have owners
(Components 12, 4); the R5 hit rate is stated honestly. `.spec-workflow/steering/` is
genuinely empty, so the Steering Alignment section's `N/A` is accurate. That work is
sound and is not re-litigated below.

What follows is what v2 introduced, inherited without checking, or still has not answered.

---

## 1. Component 1 — `resolveGitCommonDirAbsolute` reuses a normalization that computes the wrong path

The design states twice (lines 119, 258) that the new helper "applies the normalization at
`git-utils.ts:60-66`". Read what that normalization does:

```ts
const gitIndex = gitCommonDir.lastIndexOf('.git');
if (gitIndex > 0) {
  const mainRepoPath = gitCommonDir.substring(0, gitIndex - 1);   // strips ".git"
  ...
}
return projectPath;                                              // when gitIndex <= 0
```

It returns the **parent of `.git`** — the repository root — not the common directory. It
exists to serve `resolveGitRoot`, whose contract is "where does `.spec-workflow` live".
A function named `resolveGitCommonDirAbsolute` that returns the repo root is not a
common-dir resolver, and both of its stated consumers break on that.

- **Challenge the claim that `join(resolveGitCommonDirAbsolute(workspace), 'info',
  'exclude')` reaches `info/exclude`.** Verified: from a repository root the raw command
  returns the bare `.git`, `lastIndexOf('.git')` is `0`, the `gitIndex > 0` guard fails,
  and the function falls through to `return projectPath`. The join produces
  `<repoRoot>/info/exclude`. From a linked worktree the raw command returns
  `/main/.git` (absolute — verified), the normalization strips `.git`, and the join
  produces `/main/info/exclude`. Neither path exists. R7 AC 12's policy — "when
  `info/exclude` is absent, skip without failing the typecheck" — then swallows the
  failure at every call site. **R7 AC 9/10/11 are jointly unimplementable as written, and
  the design's own error policy guarantees the defect is silent.** (Novel, high.)
- **Stress-test the same-repository comparison against git submodules.** Verified in a
  scratch repo: inside a submodule, `git rev-parse --git-common-dir` returns
  `/super/.git/modules/vendor/lib`. Applying the `:60-66` parent-stripping yields
  `/super`. From the superproject root it yields `/super`. **They compare equal**, and
  the toplevels differ (`/super` vs `/super/vendor/lib`), so R1 AC 1's precondition is
  satisfied and **inference adopts the submodule as the workspace**. An agent that `cd`s
  into a vendored dependency — an ordinary thing to do while reading code — silently
  re-points the server's diff, typecheck, and registry identity at the submodule. R1 AC 3
  ("different repositories → use the configured path unchanged") is violated by the
  mechanism meant to implement R1 AC 1. (Novel, high.)
- **Reverse the single-helper decision.** The two consumers need different values and the
  design forced them into one signature. R7 needs `resolve(cwd, rawCommonDir)` with no
  parent-stripping. R1 needs a *predicate* — `sameRepository(a, b)` comparing raw
  resolved common dirs (`/super/.git` vs `/super/.git/modules/vendor/lib` → not equal →
  no inference), which also fixes the submodule case for free. Specify two functions and
  state that R1's comparison operates on the common dir itself, never on its parent.
- **Note that `resolveGitCommonDirAbsolute` as described is `resolveGitRoot` minus the env
  override.** The Code Reuse section claims the normalization is "reused by both the new
  raw common-dir helper and by `ensureGitExcludeEntry`" — but if it returns the repo root,
  the helper is a duplicate of an existing function under a misleading name, and R1 AC 5's
  only real content (ignore `SPEC_WORKFLOW_SHARED_ROOT`) is a two-line variant, not a new
  component.

---

## 2. Component 10 — `handlePrepare:361` destroys the relativeness two-root resolution depends on

Component 10's central move: "Two-root resolution lives in `validateAllFiles`, not at
`:361`. Line 361 is a pure `path.resolve`; the filesystem probe the rule depends on is the
`safeRealpath` at `:64`." That is a correct diagnosis of where the *probe* lives and a
fatal misreading of what `:361` does to the input.

```ts
// review-task.ts:360-361
const allFiles = [...new Set([...latestLog.filesModified, ...latestLog.filesCreated])]
  .map(p => path.resolve(projectPath, p));          // projectPath = workflow root
```

- **Challenge the assumption that `validateAllFiles` can resolve against two roots given
  its input.** By the time it runs, every entry is already **absolute**, anchored to the
  workflow root. `path.resolve(workspacePath, '<workflowRoot>/src/foo.ts')` returns the
  workflow-root path unchanged — the workspace base is ignored. The "workspace first,
  workflow root second" rule of R4 AC 3 can never select the workspace for any relative
  input. (Novel, critical.)
- **Trace the consequence, which is worse than a wrong checkout.** `requirements.md:17`
  records that implementation logs "record bare filenames with no root marker", so
  relative entries are the norm. Each becomes `<workflowRoot>/src/foo.ts`; `safeRealpath`
  **succeeds**, because a worktree is a checkout of the same repository and the file
  exists in the main repo too; then v2's newly narrowed containment (workspace ∪
  `<workflowRoot>/.spec-workflow`) **rejects** it — it is under the workflow root but not
  under `.spec-workflow`. Every code file is dropped with `warnOnce` (R4 AC 4).
  `filesToReview` is empty, `computeTaskDiff` gets an empty list, typecheck coverage is
  empty, and `buildExecutionContext` reports `baseline-no-base` — which Component 4
  explicitly defines as **not degraded**. The reviewing agent receives a clean-looking run
  with zero files. The narrowed containment rule v1 asked for turns a wrong-checkout bug
  into a silent no-op bug.
- **Demand the deletion be stated.** The design justifies why `:361` is not the probe site
  but never says it is removed. `validateAllFiles(input: unknown, roots)` keeps
  `input: unknown`, so the signature does not force the change either — the compiler will
  accept the pre-resolved array. State explicitly: `:360-361`'s `.map(p =>
  path.resolve(projectPath, p))` is deleted and `latestLog.filesModified` /
  `filesCreated` are passed raw, with `validateAllFiles` doing both resolutions itself.
- **Add the test that would have caught it.** The Testing Strategy's `validateAllFiles`
  bullet lists "partition correctness, warned drops, containment" — every one of which
  passes with absolute inputs. Add a case whose input is a **relative** path and whose
  expected partition is `workspaceFiles`.
- **Assign the third consumer.** `computeHygieneSignals(validatedAllFiles)`
  (`review-task.ts:388`) reads the same array and is given no root by the design.
  "Partition consumers" names only diff and typecheck.

---

## 3. Component 9 — the rejection field already exists, is already consumed, and four committed tests pin it undefined

Component 9's last bullet: "`computeTaskDiff`'s `!ok` branch (`task-diff.ts:53-55`)
currently returns an empty diff indistinguishable from a genuinely clean tree… It gains a
`rejected: { reason }` field." This adopts v1's recommendation verbatim without checking
the file.

- **Challenge the claim that the field is new.** `TaskDiffResult.rejection?: { message:
  string }` is declared at `task-diff.ts:9`. It is already consumed by
  `computeDiffMethodologyState` (`review-task.ts:100-103`) and already surfaced in
  `data.diffRejection` (`:422`). The design proposes `rejected: { reason }` — a different
  name and a different shape — which would land as a **second** field with overlapping
  meaning. (Novel, high.)
- **Stress-test the reviewer-facing prose the new signal would inherit.**
  `R4_2B_DIFF_REJECTED` (`review-task.ts:687`) reads: "The diff was NOT computed because
  the utility **threw an unexpected exception**… **Surface the rejection in your review
  summary** … so the human reviewer knows the diff path failed and can investigate the
  underlying cause." Routing an ordinary non-zero `git diff` exit through that channel
  tells the agent an exception was thrown when none was. This is a byte-pinned methodology
  constant in the same family as `R4_6B`, and Component 8's drift-test plan covers only
  the typecheck constants.
- **Confront the four tests that pin the opposite behaviour.**
  `task-diff.test.ts:87` ("empty repo (no HEAD) degrades to safe state with **no rejection
  field**"), `:272` (git binary ENOENT), `:283` (not a git repository), `:329`
  (`ERR_CHILD_PROCESS_STDIO_MAXBUFFER`). All four exercise the `!ok` branch and all four
  assert `result.rejection` is `undefined`. Two are deliberate benign classifications (a
  repo with no commits is not a degraded review). The design treats `!ok` as one
  undifferentiated branch and would flip all four.
- **Identify the missing information source.** `runGit` (`task-diff.ts:21-33`) returns
  `{ stdout, ok: !err }` — it discards stderr, the exit code, and the error object. There
  is **no source for `reason`** without changing `runGit`'s return type, which the design
  does not mention.
- **Note the branch the design did not fix, which partitioning makes newly reachable.**
  `kept.length === 0` (`:41-43`) returns an empty diff with no rejection. After
  partitioning, a documentation task whose logged paths all resolve against the workflow
  root yields `workspaceFiles = []` and lands there — the exact case R4 AC 3 exists for,
  now failing through a branch Component 9 never touches. (Compounding on v1 §"Two-root
  file resolution will silently empty the diff".)

---

## 4. Components 3 & 9 — `workspaceKey` is not translation-invariant, and the shared per-task files it does not key

Component 3 keys `TaskState` on `sha1(realpath(workspacePath))` and calls the choice
"load-bearing". It is — which is why the key's *derivation* has to be pinned on both
sides, and is not.

- **Challenge the assumption that writer and reader compute the same key.** The writer is
  the dashboard task-status endpoint, which has `project.workspacePath` — Docker-**translated**
  at `project-manager.ts:143`. The reader is `review-task`, which has
  `context.workspacePath` — the untranslated host path set at `server.ts:61`. Under path
  translation these are different strings whose `realpath`s are also different (a container
  path and a host path). The base is written under one key and read under another, and the
  miss is silent: `listForTask` finds a record from "another workspace", so the run reports
  an **attribution mismatch** for a task reviewed in its own worktree. (Novel, high.)
- **Apply Component 6's own reasoning here.** The design already argues, correctly, that
  `sharedByRoot` must key on the *untranslated* root because translation can collapse or
  diverge paths (R10 AC 1). It does not apply that argument one component earlier, where
  the same hazard produces a wrong answer rather than a wrong lookup.
- **Note that the two review paths disagree even without Docker.** A dashboard-spawned
  review gets `workspacePath` from `RunOptions` (translated); a direct MCP `review-task`
  call gets it from `ToolContext` (host). Specify one canonical form — untranslated,
  realpathed — and name the producer on each side.
- **Attack the per-task files the design left unkeyed.** Component 3 keys the *new* store
  by workspace and says nothing about the *existing* per-task state on the same shared
  root. `TaskReviewManager.writePrepareMarker` writes `<specPath>/reviews/.prepare-<id>`
  (`:71-75`) with no workspace component. Two worktrees reviewing one task: A writes the
  marker, B writes the marker, A's `finally` at `task-review-runner.ts:194` calls
  `removePrepareMarker` and **deletes B's gate**, so B's `handleRecord` fails its marker
  check after a 15-minute agent run. `getNextVersion` (`task-review-manager.ts:62-66`) is
  a read-max-then-write with the same exposure — both worktrees compute version N+1 and
  one review file overwrites the other. This spec is what makes concurrent worktree
  reviews of one spec possible; it creates the exposure and does not address it. R11 AC 8
  covers "per-task state from Requirements 5 and 8" only. (Novel, high.)

---

## 5. Component 8 — the dependency probe is a tautology, so `workspace-deps-unresolvable` is unreachable

The design replaced v1's rejected ratio heuristic with a direct probe. The direction is
right; the predicate as specified never returns false.

> True when `listFiles` contains any path under the workspace's `node_modules`, **or**
> `<workspace>/node_modules/typescript/lib` exists.

- **Challenge both disjuncts against the control flow that precedes them.**
  `resolveTscBinary` (`typecheck.ts:361-375`) checks `<workspace>/node_modules/.bin/tsc`
  and returns `tsc-not-found` at `:136` when it is missing. So the probe only runs when a
  local tsc exists — and when a local tsc exists, `node_modules/typescript/lib` exists
  (disjunct 2 true) *and* `--listFiles` includes that tsc's own `lib.*.d.ts` default
  libraries, which live under `<workspace>/node_modules/typescript/lib/` (disjunct 1
  true). **The probe returns `true` in every run that reaches it.** (Novel, high.)
- **Conclude that the new reason is dead code.** `'workspace-deps-unresolvable'` cannot be
  produced. The Testing Strategy's e2e scenario — "a worktree with unresolvable
  dependencies reports `workspace-deps-unresolvable` rather than a wall of fabricated
  errors" — cannot pass, and the unit bullet ("`workspaceDepsResolvable`: resolvable,
  missing `node_modules`") tests only the case `tsc-not-found` already handles.
- **Name the failure mode R7 AC 3 actually targets.** Not "`node_modules` absent" — that is
  `tsc-not-found`. It is "TypeScript present, the project's *other* dependencies absent or
  stale": a worktree created after `package.json` changed, or a partial install. There,
  `.bin/tsc` resolves, the probe passes, and the flood of `TS2307`s ships as `status:
  'success'` with `inScope: true`, routing to `R4_4_TYPECHECK_PRESENT` and instructing the
  reviewer to "promote to a finding". That is the exact fabricated-verdict outcome R7
  exists to prevent, surviving v2 intact.
- **Specify a predicate that can fail.** Read `dependencies` from the workspace's
  `package.json` and stat `node_modules/<name>` for each (or a bounded sample); or require
  `listFiles` to contain at least one `node_modules` entry **outside**
  `node_modules/typescript/lib`. Either can return false; neither is a diagnostic-shape
  heuristic.
- **Check the placement claim against the two earlier short-circuits.** Running the probe
  "immediately after `parseTscOutput` (`:168`)… before `await postProcess` at `:178`" is
  right about cost, but `:171-176` already returns `no-parseable-output` for a clean exit
  with no `listFiles` and for a dirty exit with no diagnostics. State the ordering relative
  to those two, not just relative to `postProcess`.

---

## 6. Component 8 — `info/exclude` is a newly shared mutable file with N writers and no lock

Component 7 builds an exclusive lock for `activeProjects.json`. Component 3 reuses it for
`TaskStateStore`. Component 8 moves a write from a per-worktree file to a
shared-across-all-worktrees file and applies neither.

- **Challenge the writer count.** `.gitignore` had exactly one writer per worktree by
  construction — each worktree checks out its own copy. `<commonDir>/info/exclude` is
  **one file for all N worktrees**. Two concurrent typechecks are the normal case for this
  feature, and the existing write shape (`typecheck.ts:377-405`) is read → string-append →
  non-atomic `fs.writeFile`. Concurrent writers produce a lost update (benign) or a
  truncate-then-write observed mid-flight by a reader (not benign). (Novel, medium-high.)
- **Weigh what is being clobbered.** `info/exclude` frequently holds a developer's
  hand-written local excludes. `.gitignore` was project-owned; this file is user-owned.
  A best-effort write policy that was acceptable for a tracked project file is not
  obviously acceptable here, and the design does not re-argue it.
- **State the covered-check's new basis.** The design does not say whether the
  early-return-if-covered check survives or what it reads. If it reads `info/exclude`,
  then repos whose `.gitignore` already contains `.spec-workflow` — **this repository's
  does** — get the entry appended to the shared file anyway. Harmless, but it is a
  behaviour change on every fresh clone that the design does not acknowledge.
- **Reconcile with the NFR.** The Performance NFR says R7 AC 10 "runs once per typecheck".
  With the write on the shared common dir, N worktrees × M typechecks all contend on one
  path; "once per typecheck" understates the coupling.

---

## 7. Component 7 — the lock's location and its staleness rule

R11 AC 3's exclusive lock is the right primitive. Its two operational parameters are
unspecified in ways that make it fail open.

- **Challenge the assumption that all worktrees share one `<globalDir>`.**
  `getGlobalDir()` (`src/core/global-dir.ts`) resolves a **relative** `SPEC_WORKFLOW_HOME`
  against `process.cwd()` — a documented, supported form for sandboxed environments. This
  spec's entire premise is that N servers launch from N different working directories.
  Under the relative form each worktree gets its own `activeProjects.json` **and its own
  lock file**; the exclusive lock protects nothing across them, R11 AC 2 ("the registry
  SHALL contain N entries") is vacuous because there are N registries, and the dashboard —
  launched from a third cwd — watches a fourth. The design makes `cwd` load-bearing for
  the first time and does not check what else reads it. (Novel, high.)
- **Stress-test stale-lock breaking under Docker.** The rule is "a lock whose `acquiredAt`
  exceeds a staleness window **and whose pid is not alive locally**". If that reuses
  `isProcessAlive` (`project-registry.ts:164-171`), the Docker branch returns `true`
  unconditionally — behaviour R2 AC 9 deliberately preserves. A stale lock then becomes
  **permanently unbreakable**: every subsequent process exhausts its budget and continues
  unregistered under R11 AC 6's fail-soft policy, forever, with only a log line. Say
  whether the breaker uses a different liveness check or whether the timer alone suffices.
- **State the invariant between the two time constants.** The retry budget must be strictly
  less than the staleness window, or a live-but-slow holder inside its critical section has
  its lock stolen and the read-modify-write interleaving returns. The design gives neither
  number and never names the relation — it only says the budget is "sized to cover a
  realistic simultaneous start of a dozen worktrees on a slow `$HOME`", which is a lower
  bound on the budget with no matching lower bound on the window.
- **Justify recording `hostname` or drop it.** The data model carries it; no rule consumes
  it. On a shared or NFS `$HOME`, a cross-host lock cannot be pid-checked at all, so the
  window is the only mechanism — worth stating rather than leaving the field decorative.

---

## 8. Component 6 — sharing has no answer for a workflow root that changes, and the fan-out list contradicts the exemption

- **Attack the update path `syncWithRegistry` takes for an id it already knows.**
  `project-manager.ts:109-120` mutates `project.workflowRootPath` and
  `project.projectPath` in place. `registerProject` (`project-registry.ts:207-208`)
  overwrites `existing.workflowRootPath` on every re-registration, so restarting a server
  with `--no-shared-worktree-specs` toggled, or with `SPEC_WORKFLOW_SHARED_ROOT` newly
  set, changes it. `sharedByRoot` is consulted only on add and on remove — never on
  update — so the entry keeps serving specs, tasks, and archives from the **previous**
  root's parser and watcher indefinitely. Specify re-keying on change, including the
  refcount transfer and the teardown of the vacated root. (Novel, medium-high.)
- **Resolve the contradiction between the fan-out bullet and the `ApprovalStorage`
  exemption.** The fan-out bullet lists `:401` — the `approval-change` handler — among
  handlers that must "loop the ids". But R10 AC 2 keeps `ApprovalStorage` one-per-entry,
  so `approval-change` (`project-manager.ts:175-177`) carries exactly one `projectId` and
  has nothing to loop. The design cannot both exempt the component and fan out its event.
  (Novel, medium — introduced by v2's own fix for v1's finding.)
- **RECURRING — `broadcastTaskUpdate` is still untouched.** `multi-server.ts:2165-2180`
  re-reads `tasks.md` from disk *per projectId*. Under the fan-out loop, one `tasks.md`
  save on a shared root produces N reads and N parses of one file — the hottest event
  path, and precisely the cost R10 exists to flatten. v1 named this function; v2's
  Component 6 does not mention it. R10 AC 3's "read once per workflow root" is asserted
  and not designed. The same hoisting question applies to the `spec-change` handler, whose
  `parser.getAllSpecs()` / `getAllArchivedSpecs()` calls sit *inside* the per-project
  debounce callback (`:360-365`) — moving to a `projectIds` array without hoisting those
  reads out of the loop satisfies AC 4 and fails AC 3. **Escalate.**
- **RECURRING — event ordering across a shared watcher is still unaddressed.** Today
  `watcher.start()` (`:155`) precedes `emit('project-added')` (`:197`) for the same
  project. Under sharing, project #2 on a root emits `project-added` while the shared
  watcher has been live for arbitrarily long, so a `spec-change` carrying #2's id can
  broadcast before the frontend knows #2 exists. The design's fan-out makes this the
  normal case. v1 named it; v2 is silent. **Escalate.**
- **RECURRING — the diff-base producer's cwd under Docker.** Component 9 now says the
  producer runs "with `cwd` set to the project's **workspace** path" but still does not say
  translated or untranslated. A translated linked-worktree path inside a container holds a
  `.git` *file* pointing at an absolute host path under the main repo's
  `.git/worktrees/`, which does not exist in the container — `git rev-parse HEAD` fails
  and nothing is recorded. That degrades gracefully under R5 AC 2, so this is a
  documentation gap rather than a defect; state it and move on.

---

## 9. Criteria with no owning component, and the Migration NFR with no section

v1's sharpest structural finding was that acceptance criteria were being satisfied by
assertion rather than by an owning component. v2 fixed the instances v1 named (R1 AC 11 →
Component 12; R8 → Component 11; R9 AC 7 → Component 4). The pattern recurs on criteria v1
did not name.

- **`normalizeIdentityPath` has no consumer.** It appears exactly once in the whole
  document — inside Component 1's interface block. R1 AC 7 requires that "**any** code
  path computes a `projectId`" realpath-normalize first. `generateProjectId`
  (`project-registry.ts:29-33`) is reached from four call sites — `registerProject:192`,
  `unregisterProject:236`, `getProject:280`, `isProjectRegistered:335` — all of which use
  `resolve()`, not `realpath`. Normalizing at the register site alone is worse than
  normalizing nowhere: `server.ts:188` unregisters by path, so a symlinked workspace
  registers under one id and unregisters under another, the entry is never removed, and
  `cleanupStaleProjects` becomes the only reaper. Name the site. (Novel, medium.)
- **`WorkspaceSource` / `ResolvedRoots.source` is defined and read by nothing.** Its
  presumable consumer is R1 AC 12 (log both paths when inference changes the workspace),
  which also has no owner. The existing stderr log (`index.ts:218-225`) fires on
  `workspacePath !== workflowRootPath` — a different condition, and one that is **false**
  in the `--no-shared-worktree-specs` + inference case, where R2 AC 5 forces the two roots
  equal. R1 AC 12 is unsatisfiable through the existing log.
- **`'no-tsconfig-in-workspace'` names no site.** `runProjectTypecheck` returns
  `no-tsconfig` at `typecheck.ts:123` the moment the workspace's `tsconfig.json` is
  unreadable. R7 AC 8 requires distinguishing "this branch has no tsconfig" from "this
  project has no tsconfig", which requires a *second* stat against the workflow root.
  Component 8 lists the new reason and specifies no check that produces it.
- **`unwrapTypecheck(settled[0], projectPath)` (`review-task.ts:391`) is in neither list.**
  It builds `tsconfigPath` from the workflow root. R3 AC 7 makes `tsconfigPath` a pinned
  parity observable, so the rejection arm would report a different root from every other
  arm. Component 10's "Unchanged on the workflow root: `:285`, `:345`, `:381`, `:432`,
  `:556`" omits it, and so does the changed list.
- **RECURRING — the Migration NFR has no section at all.** `requirements.md:265` requires
  the release to "either declare `ToolContext` internal-only in the package documentation,
  or take a major version bump; the choice SHALL be **stated**". `requirements.md:266`
  requires release notes that distinguish self-clearing attribution from the
  non-self-clearing diff base. The design's sections are Overview, Steering Alignment,
  Code Reuse, Architecture, Components, Data Models, Error Handling, Testing Strategy —
  there is no Migration section and no component states either choice. `ToolContext` is
  exported from `src/types.ts` and ships in the generated declarations at version 4.3.0.
  v1 raised this; the requirement was written in response; the design still does not
  answer it. **Escalate.**
- **Error Handling has no entry for a bad `SPEC_WORKFLOW_WORKSPACE`.** `server.ts:67`
  calls `validateProjectPath(this.workspacePath)` inside the `try` that wraps
  `initialize`. A typo'd env override therefore **aborts MCP startup** — the precise
  outcome Component 7 went to some trouble to avoid for the registry lock. Scenario 2
  covers `realpath` failure; nothing covers a workspace that does not exist.

---

## 10. Component 8 — "relax the drift test" is not expressible against the test that exists

Component 8's resolution of the pinned-prose problem: "extend the constant with the new
reasons and **relax the drift test** to compare only the constants this spec does not
touch, removing the cross-spec dependency."

- **Challenge the premise that the test has per-constant granularity.** It does not. Read
  `review-task.test.ts:1293-1336`. It is three assertions over two units: R4.x **blocks**
  extracted from the other spec's `requirements.md`, and **directive sentences** extracted
  from committed fixture files. Direction A asserts each block is a contiguous substring of
  some fixture; Direction B asserts each fixture sentence is contained in some block; the
  keyset test at `:1299` asserts exact set equality against `EXPECTED_R4_BLOCK_NAMES`
  (`:1094-1103`). Adding two reason strings to `R4_6B` fails Direction A and Direction B,
  and exempting `R4.6b` fails the keyset test. Three coordinated edits, not a relaxation.
  (Novel, medium.)
- **Account for the 17 committed snapshot fixtures.** `__fixtures__/methodology/` holds 17
  `.txt` snapshots. Changing `R4_6B` requires regenerating at least `unavailable-other.txt`
  and `cross-unavailable-other-diff-present-truncated.txt`; the Component 9 change to
  `computeTaskDiff`'s rejection semantics touches `diff-rejected.txt` and the two
  `cross-*-diff-rejected-*` fixtures. The design mentions no fixture work.
- **Challenge the stated motive.** The design frames relaxation as avoiding "editing an
  unrelated spec's approved document". The effect is the same divergence — the
  `tighter-reviews` requirements will permanently disagree with the shipped prose — only
  now nothing detects it. If the divergence is acceptable, say so and record it as a
  deferred decision against that spec; do not present an undetected drift as the
  conservative option.

---

## 11. Component 5 — R2 AC 5 and R2 AC 8 conflict in the spawned child

- **Trace the env the runner sets into the child's own resolution.** The runner sets
  `SPEC_WORKFLOW_SHARED_ROOT` to the job's workflow root (R2 AC 8). The child's
  `resolveWorkspaceRoots` then applies Component 1's rule: "when `noSharedWorktreeSpecs` is
  set, `workflowRootPath = workspacePath`". If the user's `.mcp.json` carries
  `--no-shared-worktree-specs`, the flag branch wins and the explicitly-set
  `SPEC_WORKFLOW_SHARED_ROOT` is discarded — the child looks for `.spec-workflow` inside
  the worktree and cannot find the spec the job is about. The design states both rules and
  reconciles neither. (Novel, medium.)
- **Confirm the citation.** The adversarial spawn's `env` is `adversarial-runner.ts:147`,
  not `:146`; `spawn` opens at `:144` and the `runAgent` invocation is at `:111`. The
  task-review side (`:365`, `:368`, `:144`) is correct.

---

## Citation audit (v2)

Verified correct: `git-utils.ts:18-74`, `:40-43`, `:60-66`; `path-utils.ts`;
`typecheck.ts:15-45`, `:113`, `:123`, `:168`, `:178`, `:180-191`, `:272`, `:316-321`,
`:361`, `:377-405`; `task-diff.ts:53-55`; `review-task.ts:49`, `:64`, `:65-67`, `:69-76`,
`:276`, `:285`, `:345`, `:361`, `:381`, `:389`, `:430-435`, `:432`, `:556`, `:724-725`;
`review-task.test.ts:1293`; `task-review-runner.ts:95`, `:100`, `:110`, `:144`, `:365`,
`:368`; `adversarial-runner.ts:110`; `project-manager.ts:80-86`, `:140-201`, `:143`,
`:146-152`, `:193`, `:264-265`; `project-registry.ts:125-139`, `:147-157`, `:164-171`,
`:233-255`, `:260-264`, `:297-320`; `multi-server.ts:346`, `:401`, `:438`, `:828`, `:852`,
`:1404`, `:1791`, `:1853`; `job-scheduler.ts:161-190`; `log-implementation.ts:307`;
`server.ts:76`, `:93-97`, `:105`, `:135`; `index.ts:115`, `:116-128`, `:166-175`,
`:180-181`; `spec-index.test.ts:79`; `approval-storage.ts` five-method claim.

Drifted:

| Cited | Actual |
|---|---|
| `task-review-manager.ts:72-73` (sanitizes task IDs) | sanitize `:73`, join `:74` (v1's audit was also off by one here; v2 inherited it) |
| `adversarial-runner.ts:146` (env scrubbing) | `:147`; `spawn` opens `:144` |
| `multi-server.ts:401` listed as a fan-out handler | correct line, but the event cannot carry multiple ids under R10 AC 2 (see §8) |

Substantively wrong, not merely drifted:

- **"applies the normalization at `git-utils.ts:60-66`"** (lines 119, 258) — that
  normalization returns the parent of `.git`. See §1.
- **"It gains a `rejected: { reason }` field"** (Component 9) — the field exists as
  `rejection?: { message: string }` (`task-diff.ts:9`), is already consumed, and is pinned
  `undefined` by four tests. See §3.
- **"`parseTscOutput`'s `listFiles` … Reused as the dependency-resolution probe, so R7 AC 3
  costs no extra work"** (Code Reuse) — the reuse is free but the predicate built on it
  cannot return false. See §5.

---

## Top 5 risks / gaps

1. **The `:361` pre-resolution silently empties every review in a worktree.** Logged paths
   are absolutized against the workflow root before `validateAllFiles` runs, so two-root
   resolution can never select the workspace; the narrowed containment rule then drops
   every code file with a warning, and Component 4 classifies the resulting zero-file,
   zero-diff run as `baseline-no-base` — explicitly **not degraded**. The design's own
   words justify keeping `:361` and never say it is removed. (§2)
2. **`resolveGitCommonDirAbsolute` reuses a normalization that returns the repository
   root.** R7 AC 10's `info/exclude` write lands on a nonexistent path and R7 AC 12's skip
   policy hides it; separately, the same parent-stripping makes a submodule and its
   superproject compare as one repository, so inference adopts submodules as workspaces.
   Both verified empirically. (§1)
3. **`workspace-deps-unresolvable` is unreachable.** Both disjuncts of
   `workspaceDepsResolvable` are true in every run that gets past `tsc-not-found`, so R7
   AC 3's new state cannot be produced, its e2e scenario cannot pass, and the case R7
   actually exists for — TypeScript installed, project deps stale — still ships fabricated
   `TS2307`s as `status: 'success'`. (§5)
4. **`workspaceKey` is not translation-invariant, and the existing shared per-task files
   are not keyed at all.** The dashboard writes the base under a translated path and
   `review-task` reads under a host path; concurrently, `.prepare-<taskId>` markers and
   `getNextVersion` remain unkeyed on the shared root, so one worktree's review deletes
   another's gate and overwrites its review file. (§4)
5. **The registry lock assumes a shared `<globalDir>` that a documented configuration
   splits.** `getGlobalDir()` resolves a relative `SPEC_WORKFLOW_HOME` against
   `process.cwd()`, and this spec's premise is N servers with N working directories — N
   registries, N locks, R11 AC 2 vacuous. Compounded by a stale-lock rule that is
   permanently unbreakable under Docker if it reuses `isProcessAlive`. (§7)

## Top 3 conclusions to challenge or reverse

**1. Reverse: "Two-root resolution lives in `validateAllFiles`, not at `:361`."** The
premise — that `:361` is not the probe site — is true and irrelevant. `:361` is the site
that destroys the input the probe needs. State instead: `:360-361`'s `.map(p =>
path.resolve(projectPath, p))` is **deleted**; `validateAllFiles` receives
`latestLog.filesModified` / `filesCreated` verbatim and performs both resolutions itself;
and the unit test for it takes a relative path. Without that sentence the design's most
likely implementation is a review that reports zero files and calls it a clean baseline —
strictly worse than the wrong-checkout defect the spec exists to fix, because the current
bug at least produces a diff someone can notice is wrong.

**2. Reverse: one helper for the common directory.** `resolveGitCommonDirAbsolute` is
asked to serve an identity comparison (R1 AC 1) and a filesystem join (R7 AC 10) with one
return value, and the design picked the normalization that serves neither correctly — it
returns the repo root, which makes the `info/exclude` join wrong at every call site and
makes submodules compare equal to their superprojects. Split it: `gitCommonDirAbsolute(cwd)
= resolve(cwd, rawCommonDir)` with **no** parent-stripping for R7, and a
`sameRepository(a, b)` predicate over the raw resolved common dirs for R1. The predicate
form also removes the temptation to compare derived paths, which is what admitted
submodules in the first place.

**3. Challenge: "the drift test is relaxed to compare only the constants this spec does not
touch."** The test has no per-constant unit — it compares extracted R4.x blocks against
committed fixture snapshots in both directions plus an exact keyset equality. Exempting
`R4.6b` means editing the extractor, the `EXPECTED_R4_BLOCK_NAMES` list, and Direction B's
sentence filter, then regenerating fixtures — and the outcome is that the shipped prose
and the `tighter-reviews` requirements diverge permanently with nothing detecting it. That
is not more conservative than editing the other document; it is the same divergence,
undetected. Either edit the other spec's requirements and say so, or record the divergence
as an explicit deferred decision against `tighter-reviews`.

## What's missing — do this before acting on the document

- **Rewrite Component 1 as two functions** and re-derive R1 AC 1's comparison from raw
  common dirs. Add submodule and bare-repo cases to the `resolveGitCommonDirAbsolute`
  unit-test bullet, which currently lists only repo root / subdirectory / linked worktree /
  non-git.
- **State that `review-task.ts:360-361` is deleted** and that `validateAllFiles` takes raw
  logged entries. Add the relative-path partition test. Assign a root to
  `computeHygieneSignals` and to `unwrapTypecheck`'s `tsconfigPath`.
- **Re-specify the diff rejection against the code that exists.** Reuse
  `rejection: { message }`; decide which `!ok` causes are degradations and which are
  benign, because four committed tests currently pin all of them benign; extend `runGit`
  to return the exit code or stderr, since nothing today can populate a reason; and cover
  the `kept.length === 0` branch that partitioning makes newly reachable.
- **Replace the dependency probe with one that can return false** — declared-dependency
  stats, or a `listFiles` entry outside `node_modules/typescript/lib` — and state the
  probe's ordering relative to the `no-parseable-output` short-circuits at `:171-176`.
- **Pin `workspaceKey`'s derivation to an untranslated, realpathed path** and name the
  producer on the dashboard side and the MCP side. Then extend R11 AC 8's concurrency
  treatment to `.prepare-<taskId>` and `getNextVersion`, or state why those are exempt.
- **Decide where the lock lives when `SPEC_WORKFLOW_HOME` is relative**, state the
  liveness check used for stale-lock breaking (and that it is not `isProcessAlive` under
  Docker), and state the invariant `retryBudget < stalenessWindow` with both numbers.
- **Give `info/exclude` the same concurrency treatment as the other shared files**, or
  argue explicitly why a best-effort clobber of a user-owned file with N writers is
  acceptable. State what the covered-check reads.
- **Add re-keying on `workflowRootPath` change** to Component 6, remove `:401` from the
  fan-out list, hoist the tree read out of the per-id loop for `spec-change`, and give
  `broadcastTaskUpdate` an owner — it is the path R10 AC 3 is about and it has been
  unaddressed across two revisions.
- **Write the Migration section.** State the `ToolContext` choice (internal-only vs major
  bump) and the release-note wording that distinguishes self-clearing attribution from the
  non-self-clearing diff base. Both are explicit `SHALL`s in the Migration NFR.
- **Give `normalizeIdentityPath` a consumer**, covering all four `generateProjectId` call
  sites, and give R1 AC 12 and R7 AC 8 owning components.
- **Scope the pinned-prose work honestly**: three test edits plus regeneration of the
  affected `__fixtures__/methodology/` snapshots, not a relaxation.
- **Add an Error Handling entry** for a `SPEC_WORKFLOW_WORKSPACE` that does not exist —
  `server.ts:67` currently turns it into a failed MCP startup.
