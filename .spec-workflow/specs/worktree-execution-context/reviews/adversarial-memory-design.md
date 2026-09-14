# Adversarial Review Memory — design
Last updated: 2026-07-29 (after v4 review)

**Scope change at v4.** The spec was split three ways (`.spec-workflow/spec-decomposition/decomposition.md`).
`worktree-execution-context` now carries R1–R6 only. Findings against the old R5/R7–R11 surface are
marked **[out of scope]** below and moved to the sibling specs' ledgers; they are retained for one
more round so nothing is lost in the hand-off, then they can be deleted from this file.

## Cumulative Findings Summary

### Accepted
*(findings the subsequent design incorporated — verified as resolved unless noted)*

**From v1, resolved in v2 and still correct in v4:**
- **`setupHandlers(context: any)` defeats the enforcement mechanism** — annotate the literal *and*
  type the parameter. **Verified by compiler run at v4**: the required field alone produces 19
  errors and `server.ts` is silent; both changes together produce the twentieth at
  `server.ts(96,13)`. Reasoning is sound. Resolved.
- **Containment over-granted sibling worktrees** — narrowed to `workspacePath ∪ join(workflowRoot,
  '.spec-workflow')`. Resolved, and **verified empirically from both directions** at v4: a
  parent-repo pathspec from a nested worktree is `fatal … outside repository` (exit 128), and a
  nested-worktree pathspec from main is **empty output at exit 0** — silently wrong, which makes
  the narrow rule more valuable than the design claims.
- **e2e harness "extends" understated the work** — rewritten. Resolved (one unstated consequence,
  see Unresolved).

**From v2, resolved in v3/v4:**
- **`:360-361` pre-resolution defeats two-root resolution** — deletion explicit, raw-entry contract
  stated, regression test named. Resolved.
- **`resolveGitCommonDirAbsolute` reused `git-utils.ts:60-66`** — split into `gitCommonDirAbsolute`
  (no stripping) and `sameRepository`. **Re-verified at v4 across twelve layouts**, including
  `--separate-git-dir` and a symlinked linked-worktree path. Resolved.

**From v3, resolved in v4:**
- **`sameRepository` defeated by a symlinked repository root** — `realpath(resolve(cwd, raw))` added
  (R1 AC 6). **Verified**: `/main-link` → raw `.git` → `/main/.git`, equal to the worktree's.
  Resolved.
- **Inherited `GIT_DIR`/`GIT_COMMON_DIR` make unrelated repositories compare equal** — R1 AC 7
  scrubs four variables from resolution calls, R2 AC 10 from both spawn sites. **Verified** that
  `GIT_DIR` leaks even from a non-repository, and that `GIT_WORK_TREE` alone does not affect
  `--git-common-dir` but does affect `--show-toplevel`. Resolved **for resolution and spawn only** —
  a third site was missed (see Unresolved, lead finding).
- **`gitCommonDirAbsolute` failure return unspecified / `null === null`** — returns `false` if
  either side is null (R1 AC 4). Resolved, and confirmed load-bearing: with `null === null` the
  toplevel gate would also pass, so inference would fire between two non-repositories.
- **`selectRoots`'s `projectPath` return under an override is undefined** — now derived via
  `resolveGitRoot`, not verbatim (R3 AC 5). Direction resolved; the derivation degrades to verbatim
  in four cases (see Unresolved).
- **`generateProjectId` + realpath makes ids time-dependent / entry leaks on worktree removal** —
  `normalizeIdentityPath` inside `generateProjectId`, unregister by cached id (R1 AC 10).
  **Verified safe** for all four production call sites and the four test sites that compare a
  computed id against a stored one; the ENOENT fallback is symmetric so the hashes agree. Resolved.
- **The ENOENT warn-on-drop change broke `review-task.test.ts:512` and regressed deleted files** —
  reverted to silent ENOENT, with R4 AC 7 added as an explicit anti-substitution guard. Direction
  resolved; the guard is not implementable as specified (see Unresolved).
- **The `ToolContext` internal-only justification was not supported by the packaging** — restated as
  "undocumented and unintended, not unsupported." **Verified accurate** (no `exports`, no `types`,
  `declaration: true`, distributed as a `bin`). Resolved as a claim; the remedy is wrong (see
  Unresolved).
- **Nine committed `validateAllFiles` assertions break** — R6 AC 5 now names them. Resolved in the
  requirements; the design's Testing Strategy still lists only new cases, and the real count is ten
  call sites plus two `filesToReview` shape assertions plus `buildPrompt`.
- **`AdversarialRunner` has no consumer for a `workflowRoot` field** — R5 AC 5 states the asymmetry.
  **Verified**: `opts.projectPath` is used at exactly one place (`:111` → spawn `cwd`). Resolved.
- **R1 AC 12/14 duplicate log** — folded into one emission. Resolved.
- **No implementation order stated** — still not stated (see Unresolved), but the four v3 pairs are
  now six v4 sets and one is compiler-verified.
- **Citation drift on `server.ts:93-97`** — corrected to `:95-99` everywhere. Resolved.

### Partially Accepted
*(no user response recorded; these reflect the design's own posture)*
- **Error Handling 4 — "no disclosure channel, stated so the gap is deliberate."** A deliberate
  scope choice that, as traced at v4, leaves a passing verdict over an empty file set with a
  fabricated explanation. Needs a user decision: accept, add one string to the prepare response, or
  gate spec 1's release on `worktree-review-signals`.
- **R4 AC 5 counts ambiguity rather than disambiguating.** Honest as a limitation; the count is
  currently read by nothing, so the stated justification does not hold.
- **`exports` map added in the same release.** Deliberate, but the enforcement rationale is false
  for this package's consumption route.

### Rejected
- *(none recorded — no user response to any round has been captured in this file)*

### Unresolved

**Novel in v4 (not yet responded to):**
- **`task-diff.ts:25` inherits `GIT_DIR` and the design cites it as proof it does not.** LEAD.
  Verified: `GIT_DIR=<unrelated>/.git git diff --numstat -M HEAD -- <file>` in a worktree returns
  empty stdout at **exit 0** → `computeTaskDiff` takes the success path with `diff: ''` and no
  rejection → `R4_2A_DIFF_EMPTY` tells the agent the changes "were already committed before
  review." R1 AC 7 covers resolution, R2 AC 10 covers the two spawn sites, nothing covers the
  parent process's own `git diff`.
- **`safeRealpath` discards the error code, so R4 AC 6's `missing`/`unresolvable` split and R4 AC 7
  entirely are unimplementable while it is "reused unchanged."** Recurring class (v3's
  `no-tsconfig` ENOENT/EACCES conflation), novel instance — escalated.
- **`counts`' four buckets map onto the wrong four causes** and lose the three input-validation
  drops that have committed tests (non-array `:443`, non-string `:464`, `path.resolve` throw `:452`).
- **`counts` has no consumer**: not in Component 4's table, not in the prepare response
  (`review-task.ts:410-424`), not logged. R4 AC 5's "the count reported" is unmet.
- **`path.resolve` ignores the base for absolute entries**, so "workspace first, workflow root
  second" is a no-op for every absolute logged path and `ambiguous` is vacuously true for all of
  them. The design conflates anchoring with classification.
- **`workflowRootPath` is explicitly *not* realpath-normalized** (Data Models) while
  `ResolvedFile.path` is → containment rejects every `.spec-workflow` path under a symlinked
  workflow root. Today `validateAllFiles:49` realpaths the base, so this is a parity regression on
  the population Migration names as common.
- **`SPEC_WORKFLOW_SHARED_ROOT` is returned verbatim by `resolveGitRoot:40-43`** — untrimmed of
  symlinks and not resolved to absolute, so a relative value makes containment and `getSpecPath`
  relative to the process cwd.
- **The precedence chain silently deletes `resolveGitWorkspaceRoot`.** Ends at `configuredPath`,
  contradicting R1 AC 2's "that path"; moves `projectId` for every no-argument or subdirectory
  configuration (a second cause Migration does not carry); makes `workspacePath !== projectPath` for
  that population so R3 AC 7's parity clause cannot cover them; narrows containment to a
  subdirectory. `index-args.test.ts:28`, `:29`, `:41`, `:52-53` pin the current behaviour and its
  two-export `vi.mock` factory (`:3-6`) breaks outright.
- **`filesToReview`'s shape change hits `task-review-runner.ts:212`/`:277` through an `any`-typed
  destructure** → the review prompt renders `- [object Object]` per file with no build error. Also
  breaks `review-task.test.ts:132` and `:787`.
- **An entire route pair is missing**: the adversarial **retry** route duplicates both defects
  R5 AC 7/8 fix — `multi-server.ts:969` (inline `ToolContext` literal, second one in the file) and
  `:1012` (runner `projectPath: project.originalProjectPath`).
- **`runProjectTypecheck`'s move to the workspace has three unstated side effects**:
  `typecheck.ts:139-140` creates `.spec-workflow/.cache` inside every worktree, `:141` appends to
  the worktree's **tracked** `.gitignore`, and `:134`/`:361-375` flips fresh worktrees to
  `tsc-not-found`.
- **R4 AC 1/AC 2's *root* arguments are unowned.** Component 4's table assigns file lists only;
  `computeTaskDiff(projectPath, …)` (`:389`) and `runProjectTypecheck(projectPath, …)` (`:387`) both
  take a root.
- **R4 AC 11's assertion has no specified failure behaviour**, and `computeTaskDiff:53-55` has no
  rejection path, so an unhandled assertion lands in `{kind:'empty'}` and reproduces the fabricated
  explanation.
- **`selectRoots` is wired to one of eleven `args.projectPath` sites.** R3 AC 4/5 unmet for ten,
  including `adversarial-review.ts:51` — the handler whose defect `requirements.md:13` diagnoses.
- **`selectRoots` puts a blocking 5-second `execSync` on the per-call path**, contradicting the
  Performance NFR; no memoization specified.
- **`resolveGitRoot(override)` degrades to verbatim in four cases** (env short-circuit, git failure,
  no `.git` substring — verified with `--separate-git-dir`, bare repo `.`) with no warning,
  reintroducing the R3 AC 5 defect.
- **`--show-toplevel` fails in a bare repo and inside a git dir** (verified), `resolveGitWorkspaceRoot`
  swallows it, and the inference gate reads the fallback as "toplevels differ" → adopts a non-work-tree
  as the workspace.
- **Inference can make `validateProjectPath` fail** (`/var*` prefix, non-directory, missing `W_OK`)
  for a path the user never chose; only the env path is protected (Error Handling 3).
- **`SPEC_WORKFLOW_WORKSPACE` is unconstrained**: no same-repository check (a stale exported value
  silently redirects diff/typecheck/spawn to another project) and existence rather than
  `isDirectory()` (a file passes, then kills the handshake at `server.ts:67`).
- **Spec 1 turns `registerProject`'s read-modify-write into a lost-registration race** by giving each
  worktree a distinct id; the lock is deferred to spec 3 and no `.mcp.json` avoids it.
- **A relative `SPEC_WORKFLOW_HOME` (documented at `global-dir.ts:15-16`) makes spec 1's headline
  observable unreachable**; the e2e suite is insulated by an absolute value in
  `playwright.worktree.config.ts:7`, so it will not be caught.
- **NFR Security names the wrong module**: `security-utils.ts` contains no path validation (rate
  limiting, CORS, headers, audit logging only). The real validations — `PathUtils.safeJoin`,
  `validatePathWithinBases`, `validateProjectPath` — are never audited against the second root.
- **Two two-root file resolvers already ship and Code Reuse names neither**:
  `ApprovalStorage.getFilePathCandidates` (`approval-storage.ts:204-239`, documented workspace-first)
  and `multi-server.ts:716-738`. Component 3's "partitioning lives only in `file-resolution.ts`"
  is false on landing.
- **`safeRealpath`/`_resetValidateWarnings` live in `src/tools/`**, so `src/core/file-resolution.ts`
  must import from the tools layer — inverting the design's own stated layering. Symmetrically,
  `selectRoots` (shared by eleven tools) is placed in `src/tools/root-selection.ts`.
- **`unregisterProjectById` already exists** (`project-registry.ts:260-264`, deletes the whole entry,
  one caller at `project-manager.ts:295`); the design adds `unregisterInstanceById` one word away
  with different semantics and never mentions the existing method.
- **`registerProject:190/:216` stores `resolve(p)` while the id becomes `sha1(realpath(p))`** — the
  stored path and the identity are different spellings, and the stored one flows into every
  downstream consumer including containment and the spawn cwd.
- **Orphaned pre-upgrade entries are permanent under Docker** (`isProcessAlive` returns `true`
  unconditionally at `:166-171`); Migration mentions the orphan, not its permanence.
- **`--no-workspace-inference` needs five changes, not two** (flag boolean, `parseArguments` return
  shape + `main()` wiring, `showHelp()`'s OPTIONS block), and `--no-workspace-inference=true`
  passes validation, is not filtered, and becomes the project path.
- **The `exports` map enforces nothing for this package's consumption route** (`npx` → `bin` bypasses
  `exports`), needs `"./package.json"` and a `types` condition, and the changed surface includes a
  *removed* export (`validateAllFiles`) plus two `RunOptions` field renames.
- **Six jointly-breaking implementation sets, still unordered** — see r4 §6.3. The `ToolContext`
  set is 20 sites in 12 files and is a **build** failure (`tsconfig include: ["src/**/*"]`,
  `npm run build` = bare `tsc`), not just a test failure.
- **The e2e rewrite's load-bearing detail is unstated**: setting the child `cwd` to the worktree
  breaks `npm run dev -- …` because the temp repository has no `package.json`; the harness must
  invoke `tsx`/`node` with an absolute entry path.
- **Citation drift**: `worktree-harness.ts:203` → **`:202`** (third round wrong on this line);
  "a subdirectory returns `../../.git`" is depth-dependent (verified `../../../.git`);
  "Two new modules" versus three new files named across the components.
- **Design claims falsified against code**: `spec-index.test.ts:79`'s `{} as ToolContext` does
  **not** fail compilation (the failing site in that file is `:16`), and "four other annotated
  fixtures" is really 19 sites in 11 files.

**Carried forward at v4 but [out of scope] — hand to the sibling specs:**
- `worktree-review-signals`: `TaskState` two-writer lost update; R5 AC 3's missing base→`computeTaskDiff`
  plumbing; the maxbuffer reclassification; `R4_2B_DIFF_REJECTED`'s "threw an unexpected exception"
  prose (**recurring, three rounds — must be closed there**); the dependency probe's four parameters;
  R7 AC 6's unmet SHALL and the `R4_6B` keyset; `no-tsconfig-in-workspace`'s ENOENT/EACCES
  conflation; R8 AC 1/5 and R9 AC 2/3's owners; `ExecutionContext.workflowRoot` name collision.
- `worktree-dashboard-concurrency`: the `SPEC_WORKFLOW_HOME` anchor and `getGlobalDir()`'s five
  callers; every lock mechanic (atomic break, `fs.stat` mtime, `O_EXCL`/NFS, critical-section
  boundaries, lock paths, ordering); `getNextVersion`'s scope; the `.prepare` marker's four call
  sites; the non-existent `Mutex`; R10 AC 3/AC 5's owners; `.gitignore` → `info/exclude` and the
  bare-repo `info/exclude` probe; `resolveGitRoot`'s env short-circuit in dashboard mode.
- **Correction to a v3 finding, for the record:** v3 asserted that `path-denylist.ts` "denies any
  path containing a `__tests__`/`__fixtures__` segment." It does not. `TEST_FIXTURE_SEGMENTS` is an
  *exception* that suppresses the `secrets`/`credentials` segment check (`isDenied`'s
  `hasFixtureSegment` branch); test files are **kept**. `kept.length === 0` with a non-empty input
  is still reachable (lockfiles, `.snap`, `.map`, `.min.js`, `.env`) but not by the mechanism v3
  named. Whoever inherits that finding should re-derive it.

## Patterns & Themes

- **The pattern is now specific enough to name: each round's worst defect is in a sentence written
  to close the prior round's finding, and it is wrong about the *return value or environment* of the
  function it cites.** v3: `getNextVersion` is a pure read; the `dependencies`-only probe. v4:
  `safeRealpath` returns `undefined` for every failure; `task-diff.ts:25` inherits `process.env`.
  Both v4 instances are one-line reads away from being caught. **Next round: for every sentence of
  the form "X already does Y, so it is reused unchanged", open X and read what it returns.**
- **"Ownership by assertion" has moved from criteria → plumbing → *arguments*.** v1/v2 found
  criteria with no component; v3 found hops between components; v4 finds *parameters within an owned
  call*: `computeTaskDiff`'s and `runProjectTypecheck`'s first arguments, `buildPrompt`'s
  `filesToReview` annotation, `safeRealpath`'s discarded code. A per-AC ownership table would not
  catch any of these; a per-call-site signature diff would.
- **Enumerations that read as exhaustive are one item short, and it is always the retry twin.**
  v3: `broadcastTaskUpdate`'s two callers. v4: the adversarial retry route (`:969`, `:1012`) beside
  the primary route (`:828`, `:852`). When the design lists route line numbers, grep the file for
  the same expression rather than trusting the list.
- **Hazard classes are still handled at N−1 sites.** Env scrubbing: resolution ✔, spawn ✔,
  `task-diff` ✘. Realpath normalization: `workspacePath` ✔, `projectId` ✔, `workflowRootPath` ✘,
  stored `entry.projectPath` ✘. Two-root resolution: new resolver ✔, `ApprovalStorage` and
  `multi-server` already exist and are unmentioned. **Enumerate every instance of a hazard class
  before accepting any fix for it.**
- **Empirical verification keeps paying, and now so does running the compiler.** Every round, at
  least one load-bearing claim is settled only by execution. v4 added a decisive one: patching
  `ToolContext` and running `tsc` proved the enforcement mechanism *and* falsified the design's
  count (19 sites, not four) and its single named example (`{} as ToolContext` compiles fine).
  **Run `tsc` against a patched copy for any "the compiler will catch it" claim.**
- **Parity claims are conditioned on the case that stops being true.** R3 AC 7 guarantees parity
  "when `workspacePath` and `projectPath` are equal" — and the v4 regression (§3.1) works by making
  them unequal for users who have no worktrees. Check every parity clause's *precondition* against
  the change, not just its observables.

## Guidance for Next Review

**Focus areas:**
- **Read the return type of every function the design says it reuses unchanged.** That single check
  would have found both of v4's lead findings. Candidates next round: `safeRealpath` (if the design
  still claims it is unchanged), `resolveGitRoot`, `partitionPaths`, `PathUtils.safeJoin`.
- **Grep for the second instance.** For every line number the design cites in `multi-server.ts`,
  `review-task.ts`, or the runners, grep the same expression across the file. The retry twin pattern
  has now recurred twice.
- **Trace *arguments*, not just values.** For each of R4 AC 1, AC 2, AC 9, AC 10, confirm that both
  the root argument and the file-list argument have a named change, and that every consumer of a
  changed shape (`filesToReview`, `TaskDiffResult`, `RunOptions`) is named.
- **Run the compiler.** Patch the type, run `tsc --noEmit -p tsconfig.json` in a copy, and compare
  the error list against whatever the design claims. `include: ["src/**/*"]` means tests are in the
  build, so the list is complete.
- **Re-run the git probes if any resolution claim changes.** Keep: symlinked root, symlinked
  worktree, `GIT_DIR`/`GIT_COMMON_DIR`/`GIT_WORK_TREE` leakage, bare repo, git-dir cwd,
  `--separate-git-dir`, submodule, subdirectory depth, `git diff` with `GIT_DIR` set (empty at
  exit 0 — the v4 lead), and the nested-versus-sibling pathspec asymmetry (fatal versus silent).
- **Check the non-worktree population explicitly.** v4's third-worst finding only affects users
  with no worktrees, which is the population no scenario in the Testing Strategy exercises. For
  each change, ask what it does when there is one checkout and no path argument.
- **If a Tasks document exists**, check the six jointly-breaking sets in r4 §6.3, especially that
  the 20-site `ToolContext` change is one task and that the `filesToReview` shape change carries
  `buildPrompt` with it.

**Well covered — do not re-derive:**
- Component 2's typing mechanism (compiler-verified twice).
- `resolve(cwd, raw)` correctness and `realpath`'s effect on the symlinked root (verified three
  rounds running); the submodule-versus-superproject separation.
- `sameRepository`'s `false` for two non-repositories, and why it is load-bearing.
- The containment rule's refusal to accept the workflow root (verified from both directions).
- R4 AC 11's assertion-over-stderr choice, and the exact pathspec message/exit code.
- `AdversarialRunner`'s one-field asymmetry (`:111` is the only use).
- `ProjectContext.workspacePath` already existing and being Docker-translated.
- `job-scheduler.ts:178`/`:186` keeping the workflow root.
- The packaging facts (no `exports`, no `types`, `declaration: true`, `bin` distribution).
- `git-utils.test.ts`'s options assertion tolerating a new `env` key (`objectContaining`).
- The steering-doc `N/A` claims — `.spec-workflow/steering/` is empty.
- The `:360-361` deletion and the raw-entry contract.
- `--no-shared-worktree-specs` versus `SPEC_WORKFLOW_SHARED_ROOT` precedence.
