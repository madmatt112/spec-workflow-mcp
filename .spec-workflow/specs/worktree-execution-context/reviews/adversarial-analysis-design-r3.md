# Adversarial Analysis — worktree-execution-context/design.md (v3)

Every code claim below was re-checked against the working tree at `2605819`. Nine git
behaviours were verified empirically in scratch repositories (git 2.43.0): `--git-common-dir`
output forms at repo root / subdirectory / linked worktree / nested worktree / submodule /
bare repo / through a symlinked root; `GIT_DIR` and `GIT_COMMON_DIR` env leakage; and the
exact stderr and exit codes for pathspec-outside-repository, empty-repo, non-repo, and
bad-object failures.

**Prior-round posture.** v3 closed v2's five lead findings properly rather than by
assertion. Component 1 is genuinely split into a predicate and a non-stripping resolver, and
the submodule case is fixed — verified: a submodule's common dir is
`/super/.git/modules/vendor/lib`, absolute, so `sameRepository` correctly returns false.
`:360-361` is explicitly deleted and the raw-entry contract is stated. The dependency probe
is replaced by one that *can* return false. `rejection: { message }` is reused rather than
duplicated, and `runGit`'s missing information source is named. `workspaceKey` is pinned to
the untranslated realpath on both sides. `.prepare` markers and `getNextVersion` are
acknowledged. The Migration section exists. `broadcastTaskUpdate`, event ordering,
re-keying, `normalizeIdentityPath`, `unwrapTypecheck`, R1 AC 12 and R7 AC 8 all have owners.
That work is sound and is not re-litigated.

The prior round's lesson was that the fixes introduced a worse defect than the ones they
closed, along a path that crossed three hundred lines. The same shape recurs here, twice:
**Component 12's attribution writer destroys Component 10's diff base** (§5.1), and
**Component 7's `SPEC_WORKFLOW_HOME` anchoring re-creates the exact split it exists to
close** in the one mode the entire e2e suite runs in (§3.3). Neither is visible
component-by-component.

---

## 1. Component 11 — the `:361` deletion and the rewritten `validateAllFiles`

The deletion is correct and the raw-entry contract is right. The partition built on top of
it is not.

- **Reverse "workspace first" as an unqualified rule — it violates R4 AC 10's second
  sentence.** R4 AC 10 reads: a review whose recorded workspace differs from the reviewing
  workspace "SHALL proceed and the mismatch SHALL be surfaced … **It SHALL NOT silently
  resolve the other workspace's relative paths against the reader's tree.**" Component 11's
  resolution order does exactly that. `requirements.md:17` records that implementation logs
  "record bare filenames with no root marker", so bare relative names are the norm. When
  worktree A logged `src/foo.ts` and worktree B reviews it, `resolve(B, 'src/foo.ts')`
  succeeds — a worktree is a checkout of the same repository, so B has its own copy — and the
  path is classified as a workspace file, diffed against B's tree, typechecked in B, and
  listed in `filesToReview` as B's copy. The design discloses the mismatch through the
  attribution channel and then resolves the paths against the reader's tree anyway. Disclosing
  a violation does not satisfy an AC that forbids the behaviour. Either state that on
  `attribution.state === 'mismatch'` the partition is suppressed (all paths → dropped, or all
  → workflow-root), or amend R4 AC 10. (Novel, high.)
- **Establish that nothing detects the both-roots ambiguity, and that the design already
  holds the information needed to.** A bare relative name resolves under both roots in every
  sibling-worktree review — that is the *normal* case, not an edge. The design says
  "workspace first" and stops. Nothing counts how many entries were ambiguous, nothing
  reports it, and `fileSet` carries `workspaceCount`/`workflowCount`/`droppedCount` but no
  `ambiguousCount`. Component 3 records `workspacePath` and `workspaceSource` per task, and
  Component 4 computes `attribution`, so the resolver has a signal available and never
  consults it. Add `ambiguousCount` to `fileSet` and make the resolver take the recorded
  workspace as an input, or state that the partition is a heuristic and that "which root
  won" is a guess for every bare name — which is a materially weaker claim than R4 AC 5's
  "SHALL report, per path, which root resolved it". (Novel, high.)
- **The design's own R4 AC 4 change breaks a committed test and regresses deleted-file
  handling.** Component 11: "Dropped with `warnOnce` when neither root resolves (R4 AC 4),
  closing the silent `continue` at `:65-67`." That `continue` is not an oversight —
  `safeRealpath` (`review-task.ts:26-39`) deliberately suppresses `ENOENT` at `:31`, and
  `review-task.test.ts:512` pins it: *"drops deleted files silently (safeRealpath ENOENT, no
  warn)"* with `expect(warnSpy).not.toHaveBeenCalled()`. A task that deletes files records
  them in `filesModified`; under the new rule every deletion emits a warning. Worse under two
  roots: a file **deleted in the worktree but still present in the main checkout** now
  resolves against the workflow root, lands in `workflowFiles`, is excluded from the diff and
  the typecheck (R4 AC 7/9), and appears in `filesToReview` pointing at the *undeleted* main-
  repo copy. The reviewer is handed the file the task removed. Distinguish `ENOENT` (silent,
  or counted separately) from other resolution failures. (Novel, high.)
- **Enumerate what the new signature breaks.** `validateAllFiles` is exported and has one
  production caller (`review-task.ts:380`) and **nine committed test call sites**, all passing
  a string second argument and asserting a flat `string[]`:
  `review-task.test.ts:443`, `:444`, `:445` (non-array), `:452` (NUL byte), `:464`
  (non-string elements), `:475` (relative paths), `:486` (absolute outside), `:503` (symlink
  outside), `:514` (deleted files — see above), `:521` (dedupe by realpath), plus the
  integration smoke test at `:768`. The two `warnOnce` keys change too
  (`validateAllFiles:outside:${realResolved}` and the message "path outside projectPath"),
  and `:486`/`:503` assert on that exact string. The design's Testing Strategy adds four new
  cases and does not acknowledge that eleven existing assertions are being rewritten.
  (Novel, medium.)
- **Specify dedupe across the partition boundary and stop conflating four drop causes.**
  The current `seen` set is keyed on `realResolved` and spans one list. With two lists, a
  path that resolves under both roots under two different spellings could appear in both
  partitions. And `dropped: number` collapses non-array input, non-string elements,
  `path.resolve` throws, ENOENT, and containment rejection into one integer that Component 4
  publishes to the reviewing agent as `fileSet.droppedCount`. A reviewer told "3 files were
  dropped" cannot act on it. (Novel, medium.)
- **`filesToReview` containing both partitions is coherent but under-labelled.** The
  reviewing agent is spawned with `cwd` set to the workspace and told by
  `R4_1_DIFF_PRESENT` (`review-task.ts:681`) to "Open files from `filesToReview`". Absolute
  paths under the workflow root are readable — the runner passes
  `--dangerously-skip-permissions` — so nothing breaks. But the agent gets counts in
  `fileSet` and no per-path labels, so it cannot tell that `<workflowRoot>/.spec-workflow/…`
  is a spec document rather than reviewable code, and `R4_2A_DIFF_EMPTY` will tell it to
  "Read every file in `filesToReview`" including entries deliberately excluded from the diff.
  Ship the partition, not just its cardinalities. (Novel, medium.)
- **Fine, briefly:** deleting `:361` does not break the `new Set` dedupe at `:360` —
  `validateAllFiles` still dedupes by realpath at `:78-79`. Containment for the equal-roots
  case is also fine: `join(workflowRoot, '.spec-workflow')` sits inside `workspacePath`, so
  `.spec-workflow` paths classify as workspace files exactly as they do today, and R3 AC 7
  parity holds.

---

## 2. Component 1 — the split resolvers

`gitCommonDirAbsolute = resolve(cwd, raw)` is correct for every form I could produce.
Verified: repo root → `.git`; subdirectory → `../../.git` (relative to the *git process's*
cwd, so `resolve(projectPath, raw)` is right only because `execSync` is given
`cwd: projectPath`); linked worktree → `/main/.git` absolute; nested worktree → `/main/.git`
absolute; submodule → `/super/.git/modules/vendor/lib` absolute. `sameRepository` rejects the
submodule correctly. That part is settled.

Three ways the predicate still gives the wrong answer:

- **`sameRepository` is defeated by a symlinked repository root, silently and with no log.**
  Verified: from `/main-link` (a symlink to `/main`), `git rev-parse --git-common-dir`
  returns the bare string `.git`, so `resolve('/main-link', '.git')` = `/main-link/.git`,
  while the linked worktree returns `/main/.git`. **They compare unequal, inference is
  suppressed, and the configured path is used unchanged** — the precise defect this spec
  exists to fix, surviving in the layout where `.mcp.json` names a path through a symlink
  (`~/dev` → `/Volumes/Work/dev`, `/home` → `/System/Volumes/Data/home`, an NFS automount).
  Note that `--show-toplevel` *does* return the physical path, so R1 AC 1's first clause
  works and only the gate fails. R1 AC 12 logs only when inference *fires*, so the failure is
  invisible. The design already defines `normalizeIdentityPath` in the same file and does not
  apply it here. Compare realpathed common dirs. (Novel, high.)
- **An inherited `GIT_DIR` or `GIT_COMMON_DIR` makes two unrelated repositories compare
  equal.** Verified: with `GIT_DIR=/main/.git` exported, `git rev-parse --git-common-dir` run
  in `/unrelated` returns `/main/.git`; `GIT_COMMON_DIR` does the same. `sameRepository` then
  returns true for repositories that share nothing, R1 AC 1's toplevel precondition is
  satisfied, and **inference adopts an unrelated cwd as the workspace**, violating R1 AC 3
  through the mechanism meant to implement R1 AC 1. This is the exact failure direction R1 AC
  5 was written to prevent, via a different variable. It is reachable whenever the MCP server
  is spawned from a git hook, `git rebase --exec`, or any wrapper that exports `GIT_DIR`.
  `task-diff.ts:25` already builds an explicit env for its git calls; `git-utils.ts:20`,
  `:47`, `:84` inherit `process.env` wholesale. Scrub `GIT_DIR`, `GIT_COMMON_DIR`,
  `GIT_WORK_TREE`, and `GIT_INDEX_FILE` from the resolution calls, and from the two spawn
  sites in R2 AC 8. (Novel, high.)
- **Specify the failure return, and make `null === null` not mean "same repository".**
  `gitCommonDirAbsolute` returns `string | null`. If `sameRepository` compares the two return
  values with `===`, two non-git directories both yield `null` and compare **equal** —
  inference fires between two directories that are not repositories at all, contradicting R1
  AC 4. One line, but the design does not contain it. (Novel, medium.)
- **A bare repository returns `.`, not `.git`, and `info/exclude` exists there.** Verified:
  `git rev-parse --git-common-dir` in a bare repo returns `.`, so
  `gitCommonDirAbsolute` returns the bare repo directory and
  `join(that, 'info', 'exclude')` **resolves to a real file**. R7 AC 12's "skip when the
  repository is bare" is therefore not detectable from either of the two conditions the
  design names (not a git repository; `info/exclude` absent) — it needs a third call,
  `git rev-parse --is-bare-repository`, which no component specifies. Also verified:
  `info/exclude` exists by default in a fresh `git init`, in a bare repo, and inside a
  submodule's gitdir, so the "absent" skip branch is essentially unreachable and the design's
  three-way skip policy is really a one-way policy. (Novel, medium.)
- **R1 AC 12's owner fires on the right condition, but duplicates the existing log.** The
  design's condition (`source === 'inference'`) is correct — inference only runs when the
  toplevels differ (R1 AC 1), so firing implies changing. But the existing log at
  `index.ts:218-225` is left in place and fires on `workspacePath !== workflowRootPath`, which
  is *also* true in the ordinary sibling-worktree inference case. Two stderr blocks describing
  one event. Say which one wins. (Novel, low.)
- **Fine, briefly:** nothing else in the design depends on `git-utils.ts:60-66`, and
  `resolveGitRoot`'s contract is genuinely untouched — verified by reading every new call
  path. One inherited hazard, though: `project-manager.ts:265` calls `resolveGitRoot` for the
  dashboard's manual-add path, and `resolveGitRoot:40-43` short-circuits on
  `SPEC_WORKFLOW_SHARED_ROOT`. R2 AC 7 suppresses `SPEC_WORKFLOW_WORKSPACE` in dashboard mode
  and says nothing about `SPEC_WORKFLOW_SHARED_ROOT`, so a dashboard launched with that
  variable set collapses every manually added project onto one workflow root. Pre-existing,
  but this spec is the first to reason about dashboard-mode env suppression and should close
  it or record it.

---

## 3. Components 7 and 8 — one lock helper now guarding four file classes

- **The `SPEC_WORKFLOW_HOME` anchoring rule is inapplicable at the site that needs it,
  self-defeating in the mode the e2e suite runs in, and impossible for the dashboard.** Three
  separate failures of one sentence:
  1. **`ProjectRegistry` is constructed before the workflow root exists.**
     `server.ts:56` runs `this.projectRegistry = new ProjectRegistry()` in the *constructor*;
     `ProjectRegistry`'s own constructor calls `getGlobalDir()` at `project-registry.ts:57`.
     `initialize(projectPath, workspacePath)` — the first moment the workflow root is known —
     is `server.ts:59`. The value the anchor needs does not exist when the anchor is computed.
  2. **Under `--no-shared-worktree-specs`, `workflowRootPath === workspacePath`** (R2 AC 5,
     and `index.ts:181` today). Anchoring a relative `SPEC_WORKFLOW_HOME` to the workflow root
     therefore gives **one registry per worktree** — precisely the split the rule exists to
     close, and R11 AC 2 is vacuous again. This is the only mode the current e2e suite runs
     in (`worktree-harness.ts:200` passes `--no-shared-worktree-specs`, and `:205` sets
     `SPEC_WORKFLOW_HOME` from `process.env`), so the suite that is supposed to verify R11 AC
     2 would verify it against N registries.
  3. **The dashboard has no workflow root at all.** `ProjectManager` constructs its
     `ProjectRegistry` at `project-manager.ts:32`, before any project is known, and serves N
     projects across M roots. It cannot apply the rule. Under a relative
     `SPEC_WORKFLOW_HOME` the MCP servers would write to `<workflowRoot>/…/activeProjects.json`
     and the dashboard would read `<dashboardCwd>/…/activeProjects.json` — **the dashboard
     shows no projects at all**, which is strictly worse than today's N-registries behaviour.
     (Novel, high — this is the round's second cross-component defect.)
- **Changing the anchor moves four other files, not just the registry.** `getGlobalDir()` has
  five callers: `project-registry.ts:57`, `dashboard-session.ts:22` (`activeSession.json`),
  `settings-manager.ts:11` (`settings.json`), `execution-history-manager.ts:12`
  (`job-execution-history.json`), `workspace-initializer.ts:172`. If only the registry
  re-anchors, the registry and the session file part company and `server.ts:85-86`'s
  dashboard-URL lookup reads a different directory from the one the dashboard wrote. If
  `getGlobalDir()` re-anchors globally, its signature must take a root that three of the five
  callers do not have. The design's Migration bullet describes the blast radius as "their
  registry relocated once". It is the whole global directory, and the split is silent.
  (Novel, high.)
- **Locking `getNextVersion` alone accomplishes nothing.** Component 8: "`getNextVersion`
  (`:62-66`) is read-max-then-write; two worktrees compute N+1 and one review file overwrites
  the other. It moves inside `withFileLock` on a per-spec lock." `getNextVersion` is a **pure
  read** — `task-review-manager.ts:62-66` calls `getReviewsForTask` and returns
  `max + 1`. The write is `saveReview`'s `fs.writeFile` at `:126`, fifteen lines later. Two
  worktrees serialising the read still both observe N and both return N+1. The critical
  section must span `getNextVersion` **through** the `writeFile`, i.e. wrap `saveReview:109-126`.
  The design's diagnosis is right and its fix is scoped to the half that does not matter.
  (Novel, high.)
- **The marker rename has four call sites and a nested one the design does not name.** New
  `<taskId>.<workspaceKey>` naming touches `writePrepareMarker` (`:71-75`),
  `hasPrepareMarker` (`:81-90`), and `removePrepareMarker` (`:95-103`) — and the callers are
  `review-task.ts:354` (prepare), `review-task.ts:469` (record's gate check),
  `task-review-runner.ts:194` (the `finally`), **and `saveReview:129`, which calls
  `removePrepareMarker` internally**. `TaskReviewManager` is constructed from `specPath`
  alone (`:37-40`), so the workspaceKey has to arrive either as a constructor argument
  (changing three construction sites) or as a per-method parameter (changing all four
  callers). The design names two of the four and specifies neither plumbing option.
  `task-review-manager.test.ts:22-34` and `:105-113` assert the current three-method API and
  break either way. (Novel, medium.)
- **Give every protected file a lock path, and state the acquisition order.** The design says
  `<lockTarget>.lock` for the registry and "a per-spec lock" for review versions, and nothing
  for `TaskStateStore`, the markers, or `info/exclude`. Concretely: `info/exclude`'s lock
  lands *inside `.git`* (`<commonDir>/info/exclude.lock`), one directory away from git's own
  `index.lock` convention; the per-spec review lock and the per-task `TaskStateStore` lock are
  in an ancestor/descendant relationship under `<specPath>`, so a future
  `recordAttribution` call from inside a review-persist critical section deadlocks or
  double-holds. Nothing today nests two locks, but nothing forbids it either. State the four
  paths and one ordering rule. (Novel, medium.)
- **Stale-lock breaking by window alone is not atomic, and two breakers can both win.** The
  design specifies *when* to break and never *how*. The obvious implementation — `stat`, see
  the window exceeded, `unlink`, `open(…,'wx')` — races: A unlinks and acquires; B, which
  also decided the lock was stale, unlinks **A's fresh lock** and acquires; both hold. Fix by
  breaking through `rename(lockPath, lockPath + '.' + pid + '.stale')` and proceeding only if
  the rename succeeded, then re-verifying after acquisition. (Novel, high — the prompt asked
  for this specific scenario and the document has no answer.)
- **`acquiredAt` is the wrong clock on the filesystem the design says it is protecting.** The
  holder writes its own ISO timestamp; the breaker compares against its own `Date.now()`. On
  the shared/NFS `$HOME` the design invokes to justify `hostname`, cross-host clock skew of
  tens of seconds is ordinary — larger than the 30 s window. Skew one way steals locks from
  live holders; the other way makes them unbreakable. Use the lock file's `mtime` from
  `fs.stat`, which is stamped by the file server and is consistent for every client of it.
  While there: `O_EXCL` (`fs.open(…,'wx')`) is **not reliably atomic on NFSv2/v3** — if the
  design is going to reason about NFS it must say so, or restrict the guarantee to local
  filesystems. (Novel, medium-high.)
- **A machine suspended mid-critical-section defeats window-only breaking, and that is
  acceptable — say so.** `retryBudget < stalenessWindow` protects against *slow*, not against
  *stopped*. A laptop suspended for an hour with the lock held has it broken at 30 s and the
  interleaving returns on resume. There is no timer-based fix. Record it as an accepted
  residual alongside the atomic-break rule so that at most one breaker wins.
- **Fine, briefly:** one retry budget across the five file classes is defensible — every
  protected operation is a short read-modify-write of a small file (registry ~KB, task state
  ~200 B, `info/exclude` ~KB, review version listing bounded by reviews-per-spec), all in the
  same millisecond order. The prompt's "long-running agent holding a review-version lock"
  scenario does not arise, because no lock is held across the 15-minute agent run — the
  `.prepare` marker, not a lock, is what spans it. That is the right shape; leave it.
- **`ensureGitExcludeEntry` trades a team-shared ignore rule for a per-clone one, unstated.**
  `.gitignore` is tracked: today one developer's typecheck adds `.spec-workflow/.cache/`, it
  gets committed, and every collaborator and every fresh clone inherits it.
  `<commonDir>/info/exclude` is per-clone and never shared. For the non-worktree majority this
  is a straight regression, invisible until someone commits a `.cache` directory. R3 AC 7's
  parity list does not cover the ignore-file target, so it is not an AC violation — which is
  exactly why it needs to be in Migration rather than nowhere. (Novel, medium.)
- **Verified and accurate:** this repository's `.gitignore` does contain a bare
  `.spec-workflow` entry, and `.git/info/exclude` contains only git's default comment block —
  so the design's prediction that this repo will gain the entry on first run is correct.

---

## 4. Component 9 — the dependency probe and the untouched pinned prose

The probe can now return false. It returns false for the wrong reasons and misses the right
ones.

- **Reading only `dependencies` excludes every package that causes the failure R7 AC 3
  targets.** This repository declares 37 `dependencies` and 15 `devDependencies`, and the
  devDependencies are `typescript`, `@types/node`, `@types/ws`, `@types/diff`, `@types/react`,
  `@types/react-dom`, `vitest`, `tsx`, `vite` — every package whose absence produces the
  `TS2307` flood the requirement describes. A worktree created after a `package.json` change
  most often lacks a *dev* dependency, because that is what type resolution consumes. The
  probe as specified would stat 10 of `@dnd-kit/core`, `@fastify/cors`, `howler`,
  `node-cron`, `open` … and report the workspace resolvable. Sample `dependencies` **and**
  `devDependencies`. (Novel, high.)
- **"Bounded sample of 10, deterministic order" cannot be representative, and the bound buys
  nothing.** The realistic failure is one or two missing packages out of 37 direct
  dependencies (52 including devDependencies): a deterministic first-10 sample detects it
  roughly 20–27% of the time, and *systematically* samples the entries that have been in
  `package.json` longest — the ones most likely already installed. The cost the bound avoids
  is 52 `fs.stat` calls, tens of microseconds, against a typecheck that spawns `tsc` with a
  **30-second** budget (`typecheck.ts:47`). Drop the bound and stat every direct dependency.
  (Novel, high.)
- **The probe's placement is a leftover from a data dependency v3 removed.** v2 ran the probe
  after `parseTscOutput` because its predicate consumed `listFiles`. v3's predicate reads
  `<workspace>/package.json` and stats `<workspace>/node_modules/<name>` — it consumes nothing
  from tsc. Keeping it after `spawnTsc` means paying the full 30-second run before declaring
  it invalid, and it contradicts R7 AC 3's literal wording ("WHEN a typecheck is **about to
  run** THEN the workspace's dependency resolution SHALL be probed"). Move it between
  `resolveTscBinary` (`:134`) and `spawnTsc` (`:154`). The stated ordering relative to
  `:171-176` then becomes moot. (Compounding on v2 §5, high.)
- **Post-hoc placement also lets the probe discard a typecheck that succeeded.** A declared
  dependency that is never imported from TypeScript — `open`, `howler`, `node-cron`,
  `@dnd-kit/*` in this repo, none of which the server tsconfig compiles against — being absent
  flips `status: 'success'` with real, correct diagnostics to `status: 'unavailable'`. Running
  the probe *before* the spawn at least makes the false positive cheap and honest; running it
  after means throwing away a valid result. R7's harm model is one-directional (never present
  a non-run as a verdict) and does not license the converse. (Novel, medium-high.)
- **Concrete layouts the predicate mishandles.** (a) *npm/pnpm workspaces*: the worktree root's
  `package.json` typically declares only devDependencies and `workspaces`, so
  "no declared dependencies → resolvable" makes the probe a no-op for every monorepo. (b)
  *Hoisting*: if `<workspace>` is ever a package directory rather than the monorepo root,
  `node_modules/<name>` legitimately does not exist there and every dependency reads as
  absent. (c) *pnpm*: `node_modules/<name>` is a symlink into `.pnpm`; `fs.stat` follows it
  and is correct, but a **broken** symlink (left by an interrupted prune — the exact "partial
  install" case) makes `stat` throw, which happens to give the right answer for the wrong
  reason. Say `fs.access`/`fs.stat` explicitly, and say what a throw means. (d)
  *`optionalDependencies` and platform-specific packages* are outside `dependencies`, so they
  are correctly not sampled — fine. (Novel, medium.)
- **R7 AC 6 is not satisfied, and the design presents the violation as a tradeoff.** AC 6's
  first sentence is an unconditional SHALL: "WHEN a new `unavailable` reason is introduced
  THEN the reviewer-facing methodology text that enumerates reasons (`review-task.ts:724-725`)
  SHALL be updated to include it." The design introduces two new reasons and explicitly does
  not edit that text. It frames this as "Tradeoff, stated" — but a stated tradeoff against a
  SHALL is an unmet acceptance criterion, and R12 AC 8 will test for it. Either amend R7 AC 6
  in the requirements (with the drift-test cost recorded as a deferred decision against
  `tighter-reviews`, per v2's §10 conclusion) or do the three coordinated edits. Silence is
  the one option that leaves an approved requirement failing. (Novel, high.)
- **Correct the design's own characterisation: the enumeration is *already* non-exhaustive.**
  `R4_6B` lists `'project-references'`, `'no-tsconfig'`, `'tsc-not-found'`,
  `'no-parseable-output'`, `'output-overflow'`, `'rejection'` — it omits **`'wrapper-config'`**,
  a shipped reason produced at `typecheck.ts:131`. The prose already says "e.g.". The design
  says the enumeration "becomes non-exhaustive"; it was already, which weakens the stated
  tradeoff in the design's favour and should be said accurately rather than overclaimed.
- **What the agent actually sees, traced.** `runProjectTypecheck` returns
  `{status:'unavailable', reason:'workspace-deps-unresolvable'}` →
  `computeTypecheckMethodologyState` (`:122-127`) → `{kind:'unavailable-other', reason}` →
  `renderTypecheckDirective` (`:742-743`) → item 10 = `R4_6B`. The agent reads "degraded
  review surface" plus a `reason` string with no gloss, which is survivable. The execution
  context **does** reach it on every `R4_6B` path — including `unwrapTypecheck`'s
  `reason:'rejection'` arm — because `buildExecutionContext` reads the same
  `TypecheckResult[0]` after `unwrapTypecheck`. The one real gap: for the dashboard route,
  `task-review-runner.ts:110` destructures five fields and discards the rest, so
  `executionContext` must be added there **and** to `buildPrompt`'s eleven-parameter signature
  at `:138`. R9 AC 2 and AC 3 have no owning component — only a Testing Strategy bullet
  ("the `:110` destructure guard"). Give them one. (Novel, medium.)
- **The second stat for `no-tsconfig-in-workspace` conflates absence with inaccessibility.**
  `runProjectTypecheck` returns `no-tsconfig` at `:123` from a bare `catch` around
  `fs.readFile` (`:120-124`) — ENOENT, EACCES, EISDIR, and EMFILE all land there. Adding "present
  at the workflow root but not the workspace → `no-tsconfig-in-workspace`" therefore reports
  *"this branch has no tsconfig"* when the workspace's tsconfig exists and is unreadable. R7 AC
  2 forbids exactly this: "it SHALL describe what was observed, not a diagnosis the check did
  not make." Branch on `err.code === 'ENOENT'`. Parity is fine: when the roots are equal the
  second stat hits the same file and always yields the existing `no-tsconfig`. (Novel, medium.)

---

## 5. Component 10 — rejection classification against four pinned tests

- **The attribution writer destroys the diff base in the normal sequence.** Two components
  write one file and the design states no merge semantics. Component 10: the dashboard
  task-status endpoint writes `baseCommit`/`baseRecordedAt` into
  `<specPath>/.task-state/<taskId>.<workspaceKey>.json` on the transition to in-progress.
  Component 12: after every successful `log-implementation`, `TaskStateStore.recordAttribution`
  writes `workspacePath`, `workspaceSource`, `headCommit`, `lastLoggedAt` to the same path.
  The ordering is always status → work → log. If `recordAttribution` writes the record rather
  than merging into it — and nothing in the design says otherwise; the lock guarantees no
  *torn* write, not no *lost update* — **`baseCommit` is erased before the first review ever
  reads it**, and every review falls back to `baseline-no-base`, which Component 4 explicitly
  classifies as *not degraded*. R5 is then dead on arrival with a clean-looking verdict, and
  the only symptom is that the feature quietly never works. State read-modify-merge under the
  lock, and name the field owners. (Novel, critical — this is the round's lead finding.)
- **The same two-writer arrangement contradicts R8 AC 2.** "WHEN the attribution record is
  written THEN `log-implementation` SHALL be the writer. **No component other than the
  recording site defined here writes attribution.**" The task-status endpoint creates the
  record and populates its `workspaceKey` and (per Component 10) runs with `cwd` set to
  `project.originalProjectPath` — it is writing workspace attribution. R5 AC 9 pushes the base
  into the same store; R8 AC 2 forbids a second writer to it. One of the two has to give.
  (Novel, high.)
- **Nothing plumbs the base commit into `computeTaskDiff`.** `computeTaskDiff(projectPath,
  allFiles)` (`task-diff.ts:35-38`) takes two parameters and hardcodes `'HEAD'` in both
  argument arrays at `:45-46`; `review-task.ts:389` calls it with two arguments. Component 10
  specifies recording, ancestry validation, and rejection classification, and **never
  specifies the signature change, the `HEAD` → `<base>` substitution, or who reads
  `TaskStateStore` at prepare time**. R5 AC 3 — the criterion the entire requirement exists
  for — has no owning code change. This is the memory file's "ownership by assertion" pattern,
  recurring on the one requirement v2 was praised for handling correctly. (Novel, high.)
- **stderr classification is locale-fragile and the design has no stated fallback.** Verified
  on git 2.43: the message is `fatal: <path>: '<path>' is outside repository at '<repo>'`,
  exit 128. That string is gettext-marked in git's source, so a user with a localised git
  emits a translated form and the classifier silently falls through to "benign" — the
  outcome the promotion exists to prevent. Better: **the case is unreachable when the
  partition is correct** (a path realpathed under `workspacePath` cannot be outside the repo
  whose cwd is `workspacePath`), so it is a canary for a partitioning bug, not a runtime
  condition. Assert containment *before* invoking git and set `rejection` from the assertion.
  That is locale-free, version-free, and cheaper. If stderr matching is kept, pin the
  invocation's locale (`LC_ALL=C` in `runGit`'s env, next to the existing
  `GIT_OPTIONAL_LOCKS: '0'` at `:25`) and state what an unclassifiable `!ok` becomes.
  (Novel, high.)
- **`runGit`'s return-type change is a non-risk — say so and correct the type.** `runGit`
  (`task-diff.ts:21-33`) is module-private, not exported, and has exactly one caller,
  `computeTaskDiff:49-50`. No test references it. Adding `stderr` and the exit code is purely
  additive and breaks nothing. One correction: `execFile`'s error carries a **numeric**
  `code` for a non-zero exit but a **string** `code` (`'ENOENT'`,
  `'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'`) for spawn and buffer failures — the pinned tests at
  `task-diff.test.ts:272` and `:329` exercise both. `code: number` is wrong; it is
  `number | string | undefined`, and the classifier must not treat a string code as an exit
  status. (Novel, low but concrete.)
- **`kept.length === 0` is reachable with `workspaceCount > 0`, and there is a committed test
  proving it.** `computeTaskDiff:39` runs `partitionPaths(allFiles)` — the **denylist**, not
  the root partition. `path-denylist.ts:24-30` denies any path containing a `__tests__`,
  `__fixtures__`, `fixtures`, `test-data`, or `testdata` segment, plus lockfiles, `.snap`,
  `.map`, `.min.js`, `secrets`, `.env`. **A task that only modifies test files** — a routine
  shape in this repository — yields a non-empty `workspaceFiles` and an empty `kept`, hits
  `:41-43`, and returns an empty diff with no rejection. `task-diff.test.ts` already pins
  this: *"all paths denylisted short-circuits before invoking git"*. Component 4's claim that
  "`fileSet.workspaceCount === 0` … is what makes that visible rather than silent" is
  therefore **false** for the most likely instance of the branch. Carry `keptCount` out of
  `computeTaskDiff`, or add `skippedPaths.length > 0 && diff === ''` to the `degraded`
  predicate. (Novel, high.)
- **The maxbuffer case becomes materially more likely and is deliberately kept benign.** R5
  replaces `HEAD` with a per-task base that may be many commits back, so the diff volume is no
  longer bounded by the working tree. A 16 MB overflow (`MAX_BUFFER`, `task-diff.ts:12`)
  produces `{diff:'', stats:undefined, rejection:undefined}` →
  `computeDiffMethodologyState` → `{kind:'empty'}` → `R4_2A_DIFF_EMPTY`, which tells the
  reviewing agent that "the task changes were already committed before review". A fabricated
  explanation for a truncated read, with `degraded` false because `workspaceCount > 0`. The
  design enumerates this case as staying benign on the strength of a test written when the
  base was always `HEAD`. Re-decide it now that the base moved. (Compounding on v2 §3, high.)
- **RECURRING — `R4_2B_DIFF_REJECTED`'s prose is still a lie for the case being routed into
  it.** `review-task.ts:687`: "The diff was NOT computed because the utility **threw an
  unexpected exception**." A pathspec-outside-repository failure is an ordinary non-zero exit,
  not an exception. v2 was told this; v3 narrowed the set from "all `!ok`" to one case and
  left the prose describing the wrong cause for that one case. The design's sentence — "keeps
  `R4_2B_DIFF_REJECTED`'s … prose accurate **for its existing callers**" — is literally true
  and elides the new caller, which is the only one at issue. **Escalate.**

---

## 6. Cross-cutting: ownership, ordering, and Migration

### Criteria with no owning component

- **R5 AC 3** — no code change carries the base into `computeTaskDiff` (§5).
- **R9 AC 2 / AC 3** — `task-review-runner.ts:110`'s destructure and `buildPrompt`'s
  eleven-parameter signature at `:138`; only a Testing Strategy bullet (§4).
- **R8 AC 1 / AC 5** — AC 1 says "**the entry** SHALL record the absolute workspace path …
  Both fields SHALL exist in **the stored record**". The design writes both to a JSON sidecar
  (`TaskStateStore`), not to the implementation-log entry. That is the right engineering call
  — the log is hand-parsed markdown (`implementation-log-manager.ts:199-205`, `:334-335`) and
  adding fields means changing a writer and a parser — but it is not what AC 1 says, and AC 5
  ("WHEN a log entry is read THEN its recorded workspace path SHALL be available to callers")
  is unmet for every caller of `getTaskLogs` outside `handlePrepare`. State the deviation and
  amend R8 AC 1, or write the field.
- **R10 AC 5** — `removeProject` (`project-manager.ts:206-227`) unconditionally calls
  `context.watcher.stop()` and `context.watcher.removeAllListeners()`. Under sharing there is
  one watcher carrying one set of fan-out handlers, so removing *any* project on a root tears
  down the shared watcher and strips the fan-out for the survivors. The design specifies the
  refcount policy and never names the site; `:206-227` is absent from the Integration Points
  list. (Novel, medium.)
- **R10 AC 3 for `deferral-change`** — `multi-server.ts:444` calls
  `this.buildDeferralsPayload(project.projectPath)` **inside** the per-id handler, so under
  fan-out one deferral change on a shared root produces N reads of one tree. The design hoists
  `spec-change` and `broadcastTaskUpdate` and is silent on this one. (`steering-change` at
  `:384-395` is fine — its payload arrives in the event and no read happens per id. Say which
  is which.) (Novel, medium.)
- **`Mutex` does not exist.** `grep` finds no `Mutex` class in `src/`, and it is not a
  dependency; the NFR forbids adding one. Component 6 writes `private sharedMutex = new
  Mutex();` as though importing something. The Overview says "Four new modules"; this is a
  fifth primitive with no module, no home, and no Testing Strategy bullet. (Novel, medium.)
- **`selectRoots`'s `projectPath` return under an override is unspecified.** The signature
  returns `{ projectPath; workspacePath }`. R3 AC 5 only requires deriving the *workspace*
  from `args.projectPath` plus a warning. So what does `projectPath` become? If it is the
  override verbatim (today's behaviour at `review-task.ts:276`), then an agent overriding to a
  worktree path makes `PathUtils.getSpecPath` (`:285`) look for `.spec-workflow` inside the
  worktree and the spec is not found — the adversarial-route defect from
  `requirements.md:13`, reintroduced on the override path. Component 2 introduces the function
  and does not define half its return value. (Novel, medium.)

### Prior recurring findings — verified against code, not prose

- **`broadcastTaskUpdate` finally has an owner — but the wrong half of it.** The design says
  it is "refactored to read and parse once per workflow root and send per subscriber". It has
  **two callers of different arity**: `multi-server.ts:380` (the shared `task-update` event,
  which does need fan-out) and `multi-server.ts:1454` (the task-status PUT endpoint, which
  concerns one project). Refactoring the function itself silently changes what the PUT
  endpoint broadcasts — arguably desirable, since `tasks.md` is shared, but it is a change to
  which clients receive `task-status-update` and the design does not state it. Downgrade from
  Recurring to Compounding; close the caller gap. The `spec-change` hoisting is correct and
  verified: `getAllSpecs()`/`getAllArchivedSpecs()` are at `:360-361`, inside the debounce
  callback, inside the per-project handler.
- **Event ordering — designed, not asserted.** Verified: `watcher.start()` is
  `project-manager.ts:155`, `this.projects.set` is `:193`, `emit('project-added')` is `:197`.
  The fix (join `projectIds` only after `project-added`) is implementable at `:197`. One
  residual: between `:193` and joining, the project is in the map but ineligible for fan-out,
  so a `spec-change` in that window is missed with no re-read — benign only because the
  frontend fetches on `project-added`. Say so.
- **Re-keying on workflow-root change — designed.** Verified: `syncWithRegistry:111-119`
  mutates `workflowRootPath` and `projectPath` in place for a known id, and
  `project-registry.ts:207-208` overwrites `existing.workflowRootPath` on every
  re-registration. The design's mutex-guarded leave-and-rejoin is the right shape. Closed.
- **The Migration section exists and answers both `SHALL`s.** Closed as a structural gap; the
  content is challenged below.

### The `ToolContext` "internal-only" position

The packaging facts do not support the stated justification, though they do support the
conclusion.

- `package.json`: `"files": ["dist/**/*"]`, `"main": "dist/index.js"`, **no `types` field, no
  `exports` map**. `tsconfig.json` sets `"declaration": true`, so `dist/types.d.ts` ships.
  With no `exports` map, `import { ToolContext } from 'spec-workflow-mcp/dist/types.js'`
  resolves and type-checks for any consumer. `src/index.ts`'s tail guards `main()` behind an
  entrypoint check, so the import is side-effect-free. **There is a working, typed external
  construction path.** The design's claim that it "has no supported external construction
  path" is not what the published surface says.
- What *does* support the conclusion: the package is distributed as a `bin`
  (`spec-workflow-mcp` → `dist/index.js`), consumed via `npx` in `.mcp.json`, and documents no
  library API. "Undocumented and unintended" is the defensible claim; "unsupported by the
  packaging" is not. Restate it on those grounds, and consider adding an `exports` map in the
  same release so the declaration is enforced rather than asserted — otherwise the same
  argument has to be re-made for every future type change.
- **The claim must cover more than `ToolContext`.** This change also alters the exported
  shapes of `validateAllFiles` (signature and return), `TypecheckResult` (two new union
  members, breaking any exhaustive `switch`), `TaskDiffResult` semantics, and adds a parameter
  to `computeTaskDiff` — all of which ship in `dist/*.d.ts` under the same non-existent
  `exports` gate. Declare the surface internal, not the interface. (Novel, medium-high.)

### `projectId` stability — the Migration claim is false where realpath differs

Component 13 puts `normalizeIdentityPath` inside `generateProjectId`, which is correct for
symmetry across the four call sites (`:192`, `:236`, `:280`, `:335` — all verified). Two
consequences the Migration section does not carry:

- **Main-checkout ids are not unchanged.** `requirements.md:263` and the design both assert
  they are, on the grounds that a main checkout's workspace path already equals its configured
  path. That reasoning covers *inference*; it does not cover *realpath*. Wherever the
  configured path traverses a symlink — `/home` on many distros, `~/dev` → an external volume,
  macOS `/tmp` → `/private/tmp`, any automounted network home — `realpath(p) !== resolve(p)`
  and **the id changes on upgrade**, moving the dashboard URL and orphaning the old registry
  entry. Say so, or the release note is wrong.
- **`generateProjectId` becomes time-dependent, which reintroduces the asymmetry Component 13
  exists to remove.** R1 AC 8 requires falling back to the un-normalised path when `realpath`
  fails. `realpath` fails with ENOENT once the directory is gone. `server.ts:188` unregisters
  by path in `stop()`; after `git worktree remove`, the unregister computes a *different* id
  from the one used at registration and `unregisterProject:238-239` returns without deleting.
  The entry leaks — and under Docker, where `isProcessAlive` returns `true` unconditionally
  (`project-registry.ts:166-171`), `cleanupStaleProjects` never reaps it either, so it leaks
  permanently. Error Handling scenario 11 covers the *live* removed-worktree case and not this
  one. Cache the id at registration and unregister by id, or accept and document the leak.
  (Novel, high.)

### Implementation order — pairs that are individually safe and jointly breaking

The design implies an order and never states one. Four hazards:

1. **`ToolContext.workspacePath` required must land atomically with all six construction
   sites.** `types.ts` + `server.ts:95-99` (annotate) + `server.ts:135` (`context: any` →
   `ToolContext`) + `task-review-runner.ts:100` + `multi-server.ts:828` (inline literal) +
   `spec-index.test.ts:79` + `create-steering-doc.test.ts:5` +
   `decomposition-guide.test.ts:6` + `projectPath.test.ts:10`, `:41`, `:74`, `:134`. Any
   intermediate state fails `tsc` across the whole suite, so this cannot be split across
   tasks.
2. **The two-root `validateAllFiles` must not land before the `:361` deletion.** The reverse
   order is v2's catastrophe. Deleting `:361` alone is safe (relative names then resolve
   against the workflow root inside `validateAllFiles`, matching today's behaviour); the new
   partition alone is not. State the direction.
3. **`TaskStateStore`'s two writers must land with merge semantics, or in the order
   log-writer-first.** Landing the task-status base recorder before `recordAttribution`
   learns to merge means every base written in the interim is destroyed (§5.1).
4. **Re-anchoring `SPEC_WORKFLOW_HOME` must land for the dashboard and the MCP server in one
   change**, or the dashboard reads a registry nobody writes (§3).

### Env scrubbing at the spawn boundary

R2 AC 8's two variables are right and both sites are correct (`task-review-runner.ts:368`,
`adversarial-runner.ts:147` — both `env: { ...process.env }`). Two additions: **`GIT_DIR` and
`GIT_COMMON_DIR`** must be scrubbed too, or the child's `resolveWorkspaceRoots` inherits the
§2 hazard from a parent that happened to be launched from a hook. And if Component 7's
anchoring change lands, **`SPEC_WORKFLOW_HOME`** should be normalised to an absolute value
before it is passed down, since a relative value resolved against the *child's* workflow root
is a different directory whenever the child's flags differ from the parent's.

### Naming

`ExecutionContext.workflowRoot` means the directory *containing* `.spec-workflow`.
`PathUtils.getWorkflowRoot(p)` (`path-utils.ts:208-210`) returns `join(p, '.spec-workflow')` —
the directory itself — and `review-task.ts:432` puts that value in the response as
`projectContext.workflowRoot`. The prepare response will therefore carry **two fields named
`workflowRoot` with different meanings**, both reaching the reviewing agent. Rename one.
(Novel, low-medium.)

### `AdversarialRunner`'s second field has no consumer

R6 AC 5 requires "the same two-field contract, with the same division of uses".
`AdversarialRunner` uses `opts.projectPath` in exactly one place — `runAgent(jobId,
opts.projectPath, …)` at `:111` → spawn `cwd`. It never calls `getSpecPath` and never builds a
`ToolContext`. A `workflowRoot` field on its `RunOptions` would be dead. Either qualify R6 AC
5 or say the field is carried for symmetry and unused. (Novel, low.)

---

## Citation audit (v3)

**Verified correct:** `git-utils.ts:38-74`, `:40-43`, `:60-66` · `path-utils.ts:208-210` ·
`global-dir.ts:46` · `project-registry.ts:29-33`, `:125-139`, `:147-157`, `:192`, `:207-208`,
`:233-255`, `:236`, `:260-264`, `:280`, `:297-320`, `:310-312`, `:335` · `typecheck.ts:15-45`,
`:113`, `:123`, `:136`, `:168`, `:171-176`, `:178`, `:361-375`, `:377-405` ·
`task-diff.ts:9`, `:21-33`, `:41-43`, `:53-55` · `path-denylist.ts` ·
`review-task.ts:49`, `:64`, `:65-67`, `:69-76`, `:101-102`, `:276`, `:285`, `:345`, `:360-361`,
`:381`, `:388`, `:389`, `:391`, `:422`, `:432`, `:556`, `:724-725` ·
`review-task.test.ts:1094-1103`, `:1293` (the `describe.skipIf` line, exactly) ·
`task-review-manager.ts:62-66`, `:71-75`, `:73`, `:74` (v2's off-by-one is fixed) ·
`task-review-runner.ts:27-35`, `:95`, `:100`, `:110`, `:144`, `:194`, `:365`, `:368` ·
`adversarial-runner.ts:110`, `:147` (both v2 corrections absorbed) ·
`adversarial-review.ts:51`, `:60` · `project-manager.ts:32`, `:80-86`, `:109-120`, `:140-201`,
`:143`, `:146-152`, `:155`, `:175-177`, `:183`, `:193`, `:197`, `:264-265` ·
`multi-server.ts:401`, `:438`, `:828`, `:852`, `:1404`, `:1791`, `:1853`, `:2165-2180` ·
`job-scheduler.ts:161-190` · `log-implementation.ts:307` · `server.ts:67`, `:135`, `:188` ·
`index.ts:115`, `:116-128`, `:166-175`, `:180-181`, `:218-225` · `spec-index.test.ts:79` ·
17 `__fixtures__/methodology/` snapshots (count confirmed).

**Drifted:**

| Cited | Actual |
|---|---|
| `server.ts:93-97` (the `ToolContext` literal) | the literal is `:95-99`; `:93` is blank, `:94` a comment. Inherited from `requirements.md:69`/`:70`. This is the site the whole enforcement mechanism turns on. |
| `server.ts:76` (`registerProject` awaited) | the `await` is `:77`; `:76` is its comment |
| `server.ts:105` ("before the transport connects") | `:105` constructs the transport; `await this.server.connect(transport)` is `:113` |
| `project-registry.ts:164-171` (`isProcessAlive`) | the method is `:164-180`; the Docker branch is `:166-171` |
| `e2e/helpers/worktree-harness.ts:200` (child `cwd`) | `:200` is the args array; `cwd: this.options.serverRoot` is `:203` |
| `task-review-manager.ts:33-97` | the class does not end at `:97`; `:97` is inside `removePrepareMarker` |
| `multi-server.ts:346` (spec-change) | the `on('spec-change'` is `:345`; inherited from requirements |

**Substantively wrong, not merely drifted:**

- *"`fileSet.workspaceCount === 0` is what makes that visible rather than silent"* — false for
  the denylist path, which has a committed test proving reachability with
  `workspaceCount > 0` (§5).
- *"`getNextVersion` … moves inside `withFileLock`"* — `getNextVersion` is a pure read; the
  write is `saveReview:126` (§3).
- *"A relative `SPEC_WORKFLOW_HOME` is … resolved against the workflow root … so every
  worktree of a repository shares one registry"* — false under `--no-shared-worktree-specs`
  (where the two roots are equal), inapplicable to the dashboard, and uncomputable at
  `server.ts:56` (§3).
- *"`ToolContext` … has no supported external construction path"* — no `exports` map, typed
  `.d.ts` shipped, side-effect-free deep import (§6).
- *"`R4_6B`'s enumeration **becomes** non-exhaustive"* — it already omits `'wrapper-config'`
  (`typecheck.ts:131`).
- *"Dropped with `warnOnce` when neither root resolves … closing the silent `continue` at
  `:65-67`"* — that `continue` is deliberately silent for ENOENT and
  `review-task.test.ts:512` pins no-warn (§1).
- *"Main-checkout ids are unchanged"* (Migration) — false wherever `realpath !== resolve`
  (§6).
- *"Neither helper consults `SPEC_WORKFLOW_SHARED_ROOT` (R1 AC 5)"* — true, and incomplete:
  both consult `GIT_DIR`/`GIT_COMMON_DIR` implicitly, in the direction AC 5 exists to prevent
  (§2).

---

## Top 5 risks / gaps

1. **`log-implementation`'s attribution write destroys the diff base before any review reads
   it.** Two components write one `TaskState` file in a fixed order (status → work → log) with
   no stated merge semantics. The lock prevents torn writes, not lost updates. R5's entire
   mechanism silently never fires, and the resulting run reports `baseline-no-base`, which
   Component 4 defines as *not degraded* — a clean-looking verdict over a feature that does
   not work. Compounded by the fact that **no component plumbs the base into `computeTaskDiff`
   at all**: R5 AC 3 has no owning code change and `task-diff.ts:45-46` still hardcodes
   `HEAD`. (§5)
2. **The `SPEC_WORKFLOW_HOME` anchoring rule cannot be implemented where it is needed and
   re-creates the split it closes.** `ProjectRegistry` is constructed at `server.ts:56`,
   before the workflow root exists at `:59`; under `--no-shared-worktree-specs` the workflow
   root *is* the workspace, so the anchor yields N registries again in the only mode the e2e
   suite runs; and the dashboard, which has no single workflow root, would read a different
   registry from the one every MCP server writes — showing no projects at all. Changing the
   anchor also moves `activeSession.json`, `settings.json`, and the job history, which four
   other call sites resolve independently. (§3)
3. **Workspace-first resolution violates R4 AC 10 and the partition is an undetected guess.**
   Implementation logs record bare filenames, and a worktree is a checkout of the same
   repository, so every logged name resolves under both roots. The design resolves the other
   workspace's relative paths against the reader's tree — which R4 AC 10 forbids in terms —
   discloses the mismatch, and never counts or reports the ambiguity. Compounding: the ENOENT
   drop change makes a file deleted in the worktree resolve against the *main checkout* and be
   handed to the reviewer undeleted. (§1)
4. **The dependency probe samples the wrong set, at the wrong time, with a bound that defeats
   it.** It reads `dependencies` only, excluding every devDependency (`typescript`,
   `@types/*`, `vitest`) whose absence produces the `TS2307` flood R7 AC 3 targets; caps at 10
   of 37–52 direct packages, giving ~25% detection of a one-or-two-missing install; and runs
   *after* a 30-second `tsc` spawn although its inputs no longer come from tsc, which both
   contradicts R7 AC 3's "about to run" and lets it discard a typecheck that already
   succeeded. Alongside it, R7 AC 6's unconditional SHALL is left unmet and presented as a
   tradeoff. (§4)
5. **The lock's staleness rule has no atomic break, the wrong clock, and — separately —
   `getNextVersion` is locked on the half that doesn't matter.** Two processes that both judge
   a lock stale can both unlink and both acquire; `acquiredAt` is a self-reported timestamp
   compared across hosts on the NFS `$HOME` the design invokes to justify `hostname`; `O_EXCL`
   is not reliably atomic there; and the review-version fix wraps a pure read while the write
   fifteen lines later stays unprotected. (§3)

## Top 3 conclusions to challenge or reverse

**1. Reverse: "Resolution order: workspace first, workflow root second."** as an unconditional
rule. The premise — that the workspace should win — is right for the case where the reviewer
is in the tree that did the work, and *wrong by requirement* for the case the spec exists to
detect. R4 AC 10 says in terms that a review of another workspace's task "SHALL NOT silently
resolve the other workspace's relative paths against the reader's tree", and workspace-first
does precisely that for every bare filename, which is every filename. The design already
computes `attribution` from the same store; make the resolver a function of it. On
`state === 'mismatch'`, suppress workspace resolution and report the file set as
unresolvable rather than resolving it into the wrong tree — the reviewer then gets an
honestly empty file set with a stated cause, instead of a diff of B's untouched copies of A's
files. Without this, v3 replaces "everything resolves to the main repo" with "everything
resolves to whichever tree is reading", which is a different wrong answer with better
plumbing.

**2. Reverse: anchoring a relative `SPEC_WORKFLOW_HOME` to the workflow root.** The
diagnosis (a documented relative form splits the registry across N cwds) is correct and worth
fixing; the chosen anchor is unavailable at `server.ts:56`, is equal to the workspace under
`--no-shared-worktree-specs` so it splits anyway, and does not exist for the dashboard —
where the consequence is not "N registries" but "the dashboard sees none of them". Anchor to
something both processes can compute without a project: resolve the relative form against the
**git common directory** of the launch cwd (available before `initialize`, identical for every
worktree of a repository, and identical for a dashboard launched anywhere inside it), or
reject relative values outright with a startup error naming the absolute form. Either is
implementable; the stated rule is not. Whichever is chosen, `getGlobalDir()` must change once
for all five callers, not once for the registry.

**3. Challenge: "Only a pathspec-outside-repository failure becomes a rejection", with the
other four `!ok` causes left benign.** Two problems in one decision. First, the promoted case
is the one the design's own partitioning makes unreachable — it is a canary, and a canary
should be raised by a containment assertion before `git diff` runs, not by matching a
gettext-translated stderr string across git versions and locales. Second, the demoted cases
were classified benign when the base was always `HEAD`; R5 replaces it with a base that may be
many commits back, which makes `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` materially more likely, and
that path currently tells the reviewing agent — via `R4_2A_DIFF_EMPTY` — that the changes
"were already committed before review". The classification should be re-derived from the new
base semantics, not inherited from four tests written under the old ones. And `R4_2B`'s
"threw an unexpected exception" prose has now been wrong for two consecutive revisions for
whatever case is routed into it.

## What's missing — do this before acting on the document

- **State `TaskStateStore`'s write semantics**: read-modify-merge under the lock, with a named
  owner per field, and reconcile the two writers against R8 AC 2. Then give R5 AC 3 an owning
  change: `computeTaskDiff`'s new signature, the `HEAD` → `<base>` substitution at
  `task-diff.ts:45-46`, and the read site in `handlePrepare`.
- **Re-specify the global-directory anchor** so it is computable at `server.ts:56`, survives
  `--no-shared-worktree-specs`, and applies to `ProjectManager`. Change `getGlobalDir()` once
  for all five callers or say explicitly that only the registry moves and what that does to
  `activeSession.json`.
- **Make the file partition a function of attribution**, add `ambiguousCount` to `fileSet`,
  ship the per-path partition (not just counts) to the reviewing agent, and keep ENOENT drops
  silent — `review-task.test.ts:512` pins it and deletions are normal.
- **Rewrite the dependency probe**: `dependencies` **and** `devDependencies`, no sample bound,
  run before `spawnTsc`, and state what a `stat` throw on a broken pnpm symlink means. Then
  either amend R7 AC 6 or do its three coordinated edits — do not leave an approved SHALL
  unmet under the heading "Tradeoff, stated".
- **Fix the lock's three unspecified mechanics**: atomic break via `rename`-then-verify;
  `fs.stat` mtime instead of self-reported `acquiredAt`; a stated `O_EXCL`/NFS caveat. Widen
  the review-version critical section to cover `saveReview:109-126`. Give each of the five
  protected files a concrete lock path and one acquisition-order rule.
- **Realpath the common dirs in `sameRepository`, scrub `GIT_DIR`/`GIT_COMMON_DIR`** from
  every resolution call and from both spawn sites, define the `null`-vs-`null` case, and add a
  `--is-bare-repository` probe for R7 AC 12 — a bare repo returns `.` and *has* an
  `info/exclude`.
- **Own the four unowned criteria**: R9 AC 2/3 (`task-review-runner.ts:110` and `buildPrompt`),
  R8 AC 1/5 (or amend), R10 AC 5 (`project-manager.ts:206-227`), and R10 AC 3 for
  `deferral-change` (`multi-server.ts:444`). Specify `Mutex` as a fifth new module with a test
  bullet. Define `selectRoots`'s `projectPath` return under an override.
- **Correct the Migration section**: main-checkout ids *do* move wherever `realpath !==
  resolve`; `generateProjectId` becomes time-dependent and leaks registry entries when a
  worktree is removed; the internal-only declaration must cover the whole `dist` surface and
  should be enforced with an `exports` map rather than asserted; and the
  `.gitignore` → `info/exclude` switch removes a team-shared ignore rule for every
  non-worktree user.
- **Write the implementation order down**, at minimum the four jointly-breaking pairs in §6 —
  the `ToolContext` atomic commit, the `:361`-before-partition direction, the
  `TaskStateStore` merge-before-recorder direction, and the dashboard/MCP anchor pairing.
