# Adversarial Analysis — worktree-execution-context/design.md (v4)

Every code claim below was re-checked against the working tree at `2605819`. Fifteen git
behaviours were verified empirically in scratch repositories (git 2.43.0). The type-enforcement
claim in Component 2 was verified by **running `tsc` against a patched copy of the tree** rather
than reasoning about it: baseline clean, then with `ToolContext.workspacePath` required, then
with the literal annotated and `setupHandlers` typed. Those two runs settle several claims and
falsify one supporting sentence.

**Prior-round posture.** The three-way split is real and mostly honest. v3's five lead findings
are either closed or assigned: the `TaskState` two-writer defect and the diff base are in
`worktree-review-signals`; the `SPEC_WORKFLOW_HOME` anchor and the lock mechanics are in
`worktree-dashboard-concurrency`; the dependency probe is gone with R7. Within what spec 1
keeps, v3's `sameRepository` findings are all closed properly — the symlinked-root fix, the
`GIT_DIR` scrub, the `null`-vs-`null` case, and the two-function split are each correct, and I
verified all four empirically. `selectRoots`'s undefined `projectPath` return is now defined.
`unwrapTypecheck`, R1 AC 14, and `normalizeIdentityPath`'s consumer all have owners. The
`R4_2B_DIFF_REJECTED` prose finding is now out of scope with R5. That work is sound and is not
re-litigated.

The prior pattern holds again, in the same shape. **The two worst defects in this revision are
in sentences written to close v3 findings, and both are wrong against the file they name:**
Component 3 states that `safeRealpath` is "reused unchanged; only the *counting* is new" while
requiring two behaviours `safeRealpath` structurally cannot support (§2.1), and Component 1
cites `task-diff.ts:25` as a precedent for explicit git environments when that line is the one
place in the codebase where an inherited `GIT_DIR` silently corrupts a *code* operation (§4.3).
Neither is visible reading a single component.

---

## 1. The split's central bet — can this spec ship alone?

### 1.1 Error Handling 4 is not a partial delivery. It is the original defect, relocated — and spec 1 makes it *more* reachable than today.

Traced end to end. When `workspaceFiles` is empty:

- `review-task.ts:414` returns `filesToReview: []`.
- Dashboard route: `task-review-runner.ts:110` destructures it, `:138` passes it to `buildPrompt`,
  and `:277` renders `filesToReview.map(f => \`- ${f}\`).join('\n')` — an **empty string** under
  the heading `## Files to Review`. `:283` then instructs "1. Read every file listed in 'Files to
  Review'."
- The diff is also empty (nothing to diff), so `computeDiffMethodologyState` returns
  `{kind:'empty'}` → `R4_2A_DIFF_EMPTY` (`review-task.ts:684`), which tells the agent: *"Either the
  task changes were already committed before review … Read every file in `filesToReview`."*
- `buildReviewMethodology:584` adds "Read ALL files listed in filesToReview before evaluating."
- `implementationSummary` (`:227`, the log's JSON) is still present, so the agent has a
  *description* of the work and no code. Nothing in `verdict` validation
  (`validateVerdictConsistency`) prevents `pass` with zero findings.

So the reviewing agent receives an empty file list, an instruction to read every file in it, and
a **fabricated causal explanation** for the empty diff. That is a confident passing verdict over
unexamined code — verbatim the harm model in `requirements.md:37`. Calling this deliberate
because the disclosure channel is deferred is only defensible if spec 1 does not *increase* the
rate of the all-drop case. It does, in three ways this design introduces:

1. **The containment narrowing (R4 AC 8) newly rejects paths that are accepted today.** Today
   `validateAllFiles(allFiles, projectPath)` accepts anything under the workflow root. After the
   change, a logged **absolute** path under the workflow root but outside the workspace is
   rejected and counted, not kept. `log-implementation.ts:372-373` stores `filesModified` /
   `filesCreated` **verbatim with no normalization or validation** — there is no code path that
   forces relative entries. An agent that logs absolute paths (`/main/src/foo.ts`) from a
   worktree loses every file.
2. **R4 AC 7's deleted-in-workspace guard** converts a fallback into a drop, by design.
3. **`runProjectTypecheck` moving to the workspace** flips fresh worktrees to `tsc-not-found`
   (§6.2), which is honest but is a second signal lost in the same release.

Either give spec 1 a minimal disclosure — one string in `data` and one line in the prepare
`nextSteps`, which costs nothing and needs no per-task store — or state in the requirements that
spec 1 must not ship without `worktree-review-signals`. Shipping it as written trades "reviews
the wrong checkout" for "reviews nothing and says so to no one." (Novel, **critical**.)

### 1.2 `counts` has no consumer anywhere in spec 1, so the stated justification for R4 AC 5 is false.

Component 3: "the count exists so the limitation is visible rather than implied." Trace it.
`resolveLoggedFiles` returns `counts`; Component 4's consumer table assigns `workspaceFiles` and
`files` to five consumers and **assigns `counts` to nothing**; `handlePrepare`'s response object
(`review-task.ts:410-424`) has no field for it; and the Data Models section says only "`counts`
distinguishes four drop causes that a single integer would conflate." Distinguishes them *for
whom*? Nothing reads it, nothing logs it, nothing returns it. The design has built a variable and
called it visibility. Either add it to the prepare response (`data.fileResolution.counts`) and to
the runner's prompt, or drop `counts` from spec 1 and say plainly that ambiguity is undetected
here. (Novel, high.)

On frequency, grounded rather than asserted: the design's premise that "Implementation logs
record bare filenames" is an **unenforced convention**. `log-implementation.ts:228-235` types
these as arrays of strings and `:372-373` stores them as given; the tool description's own
examples show both `"src/dashboard/server.ts"` and bare `"server.ts"`. So the ambiguity rate is
not a property of the system, it is a property of whatever the calling agent typed. That makes
"workspace first plus an uncommunicated counter" *worse* than current behaviour for a
sibling-worktree review in one specific way and better in another, and the design should say
which: better, because bare names now resolve to the tree that ran the review rather than always
to main; worse, because absolute names are now silently dropped rather than silently resolved.

### 1.3 Something spec 1 defers **is** load-bearing: spec 1 converts a benign registry race into a lost-registration race, and the fix is in spec 3.

`ProjectRegistry.registerProject` (`:187-226`) is a read-modify-write: `readRegistry()` at `:188`,
mutation, `writeRegistry()` at `:224`. `writeRegistry` (`:147-157`) writes `activeProjects.json.tmp`
and renames — atomic per write, **not** atomic across the read. Before spec 1, N worktrees of one
repository all computed the *same* `projectId` (`requirements.md:9`), so concurrent registration
converged on one entry and a lost update cost at most a stale `instances` array. After spec 1, N
worktrees compute N distinct ids, so two agents starting simultaneously each read the registry
without the other's entry and the second rename **erases the first worktree's registration**.
The dashboard then shows one of two worktrees, and the R5/R6 route contracts — the whole point of
Components 5 and 7 — cannot fire for the missing one. The decomposition assigns "locking for the
registry" to `worktree-dashboard-concurrency` on the grounds that "nothing in it is a correctness
fix for the reviewing path." That is wrong in this direction: spec 1 is what creates the
contention, and there is no `.mcp.json` a user can write that avoids it. State this in the Scope
consequences, or bring a minimal registry lock into spec 1. (Novel, high.)

The second deferred-but-load-bearing item is milder and should be recorded rather than fixed:
`getGlobalDir()` (`global-dir.ts:40-50`) resolves a **relative** `SPEC_WORKFLOW_HOME` against
`process.cwd()`, and the documented sandbox recipe (`global-dir.ts:15-16`) uses exactly that form.
With per-worktree agents each having their own cwd, a relative value gives one registry per
worktree and the dashboard sees none of them — so spec 1's headline observable ("two worktrees
appear as distinct projects sharing one spec list") is unreachable in that configuration.
The e2e suite is insulated (`playwright.worktree.config.ts:7` computes an absolute value), which
is exactly why this will not be caught. Spec 3 owns the anchor; spec 1 should record that its
own acceptance depends on it.

### 1.4 Shipping spec 1 alone **does** change currently working behaviour for non-worktree users, and R3 AC 7's parity clause structurally cannot cover it. (See §3.1.)

---

## 2. Component 3 — the new file resolver

### 2.1 The drop accounting and the deleted-in-workspace guard are both unimplementable with `safeRealpath` unchanged. RECURRING class — escalate.

Component 3 states two things that cannot both hold:

> **`safeRealpath`** (`src/tools/review-task.ts:26-39`) already does exactly what R4 AC 6 needs …
> It is reused unchanged; only the *counting* is new.

> `missing` counts `ENOENT` drops …, `unresolvable` counts the rest

Read `safeRealpath` (`:26-39`). It computes `code` at `:30`, uses it at `:31` to decide whether to
warn, and then **returns `undefined` for every failure without exposing the code**. The call site
cannot distinguish ENOENT from EACCES, ELOOP, ENOTDIR, or ENAMETOOLONG. So:

- `counts.missing` vs `counts.unresolvable` **cannot be computed**.
- **R4 AC 7 cannot be implemented**: "when an entry fails to resolve under the workspace with
  `ENOENT` **and** succeeds under the workflow root" requires the same information. Without it,
  the only implementable rules are "never fall back" (which drops legitimate `.spec-workflow`
  paths and defeats R4 AC 4) or "always fall back" (which is exactly the substitution AC 7
  forbids).

`safeRealpath` must return the code — `{ path?: string; code?: string }` or `string | ErrnoCode` —
which is a signature change to an **exported** function with its own committed test block
(`review-task.test.ts:372-418`, including `:411`'s `expect(warnSpy.mock.calls[0][0]).toMatch(/safeRealpath: ELOOP/)`).
The design's "no new warning logic is added" is true and irrelevant; the *return* has to change.

This is the same defect class v3 raised against the second `no-tsconfig` stat ("conflates absence
with inaccessibility … produces a diagnosis the check did not make"). That instance is gone with
R7; the class has reappeared in the function the design chose as its reuse anchor. **Recurring
class, novel instance — escalate.** (High.)

### 2.2 The four-way `counts` split covers the wrong four causes and loses granularity that exists today.

Today's drop causes, each with its own `warnOnce` key: non-array input
(`validateAllFiles:non-array`, `:43-47`), non-string element
(`validateAllFiles:non-string:${typeLabel}`, `:57-60`), `path.resolve` throw
(`validateAllFiles:throw:${errMsg}`, `:83-86`), silent realpath failure (`:65-67`), containment
rejection (`validateAllFiles:outside:${realResolved}`, `:72-75`). Five.

The design's `counts` is `{ ambiguous, missing, unresolvable, rejected }`. `ambiguous` is not a
drop at all. `missing` and `unresolvable` are not separable (§2.1). **Non-array input, non-string
entries, and `path.resolve` throws have no bucket** — and those are precisely the cases with
committed tests (`review-task.test.ts:443`, `:452`, `:464`). v3's finding was "stop conflating
four drop causes"; v4 answered with four buckets that map onto a different four. Enumerate the
causes from the code, not from the prose. (Novel/Compounding, medium.)

### 2.3 `workflowRootPath` is explicitly *not* realpath-normalized, so containment rejects every `.spec-workflow` path under a symlinked workflow root.

Data Models: `workspacePath: absolute, realpath-normalized` / `workflowRootPath: absolute`.
`ResolvedFile.path: absolute, realpath-normalized`. Containment (R4 AC 8): "accept under
`workspacePath`, or under `join(workflowRoot, '.spec-workflow')`."

So a realpath-normalized file path is compared against a **non**-realpath-normalized base. Today
this cannot happen: `validateAllFiles:49` does `const realProjectPath = safeRealpath(projectPath) ?? projectPath`
— it normalizes the base before comparing. Remove that and every logged
`.spec-workflow/specs/…` path under a symlinked workflow root fails containment, is counted
`rejected`, and vanishes from `filesToReview`. The Migration section itself names the populations
this hits — "a symlinked home, an automounted network home, macOS `/tmp` → `/private/tmp`" — as
the common case. Verified empirically: from a symlinked repo root, `--show-toplevel` returns the
**physical** path while the configured path stays the symlink spelling, so the two spellings
genuinely coexist in one process. Specify both roots as realpath-normalized, or realpath the base
at the comparison. (Novel, high.)

Same class, one line further out: `resolveGitRoot:40-43` returns `SPEC_WORKFLOW_SHARED_ROOT`
**verbatim** — trimmed, not resolved, not checked for absoluteness. A relative
`SPEC_WORKFLOW_SHARED_ROOT=./shared` therefore becomes `workflowRootPath`, and both
`join(workflowRoot, '.spec-workflow')` and `PathUtils.getSpecPath(workflowRoot, …)` become
relative paths resolved against the process cwd — which under inference is the worktree. R2 AC 7
promotes this variable above a flag without constraining its form. (Novel, medium.)

### 2.4 The resolution predicate is undefined for absolute entries, and for them `ambiguous` is either always true or meaningless.

Trace the five input shapes the prompt names through "resolution SHALL be attempted against the
workspace path first and the workflow root second":

| Input | What "resolve against a root" means | Result |
|---|---|---|
| `src/foo.ts` (bare relative) | `resolve(root, entry)` | Genuinely two candidates. Handled. |
| `/wt-a/src/foo.ts` (absolute, under workspace) | `path.resolve(root, '/abs')` **returns `/abs` for any root** | Both roots produce the identical path. Is it `ambiguous`? |
| `/main/.spec-workflow/x.md` (absolute, under workflow root) | same | same |
| absolute under neither | same | resolves fine, then fails containment |
| non-string / invalid | n/a | no `counts` bucket (§2.2) |

`path.resolve` ignores a base when the argument is absolute. So for every absolute entry the
"workspace first, workflow root second" order does nothing, both attempts succeed identically,
and by the design's own rule ("An entry that resolves under both is kept as the workspace file
with `ambiguous: true`") **every absolute entry is `ambiguous` and is labelled `root: 'workspace'`
regardless of where it actually lives** — including `/main/.spec-workflow/x.md`, which would then
be handed to `computeTaskDiff` and blow up the diff (verified fatal, exit 128, §4.1 row 11), which
is what R4 AC 11's assertion is for. The design conflates *anchoring* (join a relative entry to a
base) with *classification* (which root contains this absolute path). They are different
operations and the design specifies one function for both. Split them: anchor relative entries
against each root in order; classify absolute entries by containment only; reserve `ambiguous`
for relative entries that anchor successfully under both. (Novel, high.)

### 2.5 Enumerate what the signature change breaks — the design's Testing Strategy names four new cases and no existing ones.

`validateAllFiles` is exported (`review-task.ts:41`), has **one** production caller (`:380`), and:

- **Ten test call sites** in `review-task.test.ts`: `:443` (three expressions in one `it`), `:452`,
  `:464`, `:475`, `:486`, `:503`, `:514`, `:521`, plus the integration smoke test at `:768`. All
  pass a *string* second argument; all assert a flat `string[]`.
- **Both `warnOnce` keys** are asserted by string match: `path outside projectPath` at `:486`,
  `:503`, and `:768`. Under the new design containment failure is *counted* (`rejected`) and the
  design says nothing about whether it still warns. If it does not, three tests fail; if it does,
  the message "outside projectPath" names a concept that no longer exists (there are two roots).
  Decide and say so.
- **`filesToReview`'s flat-array shape** is asserted at `:132` (`toContain(join(tempDir,'src/handler.ts'))`)
  and `:787` (`toEqual([path.resolve(tempDir,'src/valid.ts')])`).
- **`buildPrompt` is a hard consumer of the flat shape**: `task-review-runner.ts:212` types the
  parameter `filesToReview: string[]` and `:277` renders `filesToReview.map(f => \`- ${f}\`)`.
  R4 AC 9 makes `filesToReview` an array of `{path, root, ambiguous}`. `:212` is a `string[]`
  annotation receiving `prepareResponse.data` (typed `any` at `:110`), so **the compiler will not
  catch this** and the review agent's prompt will read `- [object Object]` once per file. Neither
  the design nor R6 mentions `buildPrompt`. This is the single highest-impact unowned hop in the
  document. (Novel, high.)
- **`safeRealpath` and `_resetValidateWarnings` live in `src/tools/review-task.ts`** (`:16`, `:26`).
  A new `src/core/file-resolution.ts` that reuses `safeRealpath` must import from `src/tools/` —
  inverting the layering the design asserts two sections earlier ("Shared logic in `src/core/`,
  tool handlers in `src/tools/`"). Move `safeRealpath`, its `warnOnce` set, and the test reset
  hook into core, and update the `safeRealpath` describe block's import. Symmetrically,
  Component 2 puts `selectRoots` — shared by eleven tools — in `src/tools/root-selection.ts`.
  And the Overview says "Two new modules" while the components name three (`file-resolution`,
  `root-selection`, plus `git-utils` additions, which are not a module). (Novel, medium; the
  module-count slip is the same class v3 flagged.)

### 2.6 Dedupe-by-realpath is correct and does not address the hazard it appears to.

"Dedupe is by realpath across the whole result, so one file cannot appear in both partitions
under two spellings." True and worth keeping. But the sibling-worktree hazard is **two different
files with the same relative name** — `/wt-a/src/foo.ts` and `/main/src/foo.ts` are distinct
realpaths, so dedupe never fires and both can be present if any entry anchors to each. The
design's dedupe sentence reads as though it closes the ambiguity problem; it closes a different,
smaller one. Say which.

### 2.7 Two two-root file resolvers already exist in this codebase and the Code Reuse Analysis names neither.

- `ApprovalStorage.getFilePathCandidates` (`approval-storage.ts:204-226`) documents its order as
  "1) Workspace/worktree base (fileResolutionPath) 2) Shared workflow root (projectPath)",
  rejects absolute paths and `..`, and validates containment via
  `PathUtils.validatePathWithinBases(resolve(candidate), [resolve(fileResolutionPath), resolve(projectPath)])`
  at `:219-224`. `resolveExistingFilePath` (`:228-239`) takes the first candidate that `fs.access`
  succeeds on — i.e. exactly "workspace first, workflow root second, drop if neither."
- `multi-server.ts:716-738` builds a four-candidate set with the same ordering plus a
  `.spec-workflow`-prefixed legacy fallback.
- `project-manager.ts:150` already wires `fileResolutionPath: translatedWorkspacePath`.

So the premise that "the worktree path … never reaches the tools" is true for `ToolContext` and
false for the dashboard's file resolution, and Component 3's "path *partitioning* lives only in
`file-resolution.ts`" is false the moment it lands. Either reuse `validatePathWithinBases` and
state that `ApprovalStorage` keeps its own rule deliberately, or unify. At minimum, note that the
new resolver's order matches an existing shipped rule — that is a point in the design's favour and
it currently goes unclaimed. (Novel, medium.)

---

## 3. Component 2 — `selectRoots` and the override

### 3.1 The design silently deletes `resolveGitWorkspaceRoot` from resolution, which changes `projectId`, the spawn cwd, and containment for non-worktree users — and R3 AC 7's parity clause cannot cover it.

Today (`index.ts:180-181`):

```ts
const workspacePath = resolveGitWorkspaceRoot(expandedPath);   // git --show-toplevel
const workflowRootPath = noSharedWorktreeSpecs ? workspacePath : resolveGitRoot(workspacePath);
```

The design's precedence chain is `SPEC_WORKFLOW_WORKSPACE` → `noInference` → inference →
**`configuredPath`**. `resolveGitWorkspaceRoot` appears nowhere in Component 1, in the Data
Models, or in the Testing Strategy. So in the fallback case the workspace becomes the configured
path *verbatim* where today it is that path's git toplevel. Consequences for a user with **no
worktrees at all**:

- `.mcp.json` naming a subdirectory, or — far more common — **no path argument at all**, in which
  case `index.ts:178` uses `process.cwd()` and `:184-186` merely warns. Today both lift to the repo
  root; after the change both stay put.
- `projectId = sha1(workspacePath)` changes → the dashboard URL moves and the old entry orphans.
  The Migration section attributes id churn **only** to `realpath` vs `resolve`; this is a second,
  independent cause and is unstated.
- `workspacePath !== workflowRootPath` now, so **R3 AC 7's parity guarantee does not apply** — it
  is conditioned on the two roots being equal, which is exactly what stops being true. The parity
  claim is structurally incapable of covering the population it breaks.
- Containment (R4 AC 8) now accepts only files under the subdirectory. Every logged file elsewhere
  in the repo is `rejected` and dropped, where today `validateAllFiles` accepts anything under the
  workflow root. Combined with §1.1 this is an all-drop path for an ordinary single-checkout user.

It also contradicts the design's own governing criterion: R1 AC 2 says "WHEN the two paths resolve
to the same git top-level directory THEN the server SHALL use **that path** unchanged" — the
top-level directory, which is what `resolveGitWorkspaceRoot` computes. The design's chain returns
the configured path instead.

Committed tests pin the current call graph and will fail: `index-args.test.ts:28`
(`expect(mockedResolveGitWorkspaceRoot).toHaveBeenCalledWith('/tmp/specwf-wt-a')`), `:29`
(`expect(mockedResolveGitRoot).not.toHaveBeenCalled()`), `:41`
(`toHaveBeenCalledWith('/tmp/specwf-wt-b')` — the *workspace*, not the configured path, contra
R2 AC 5), and `:52-53` (workspace is git-resolved even in `--dashboard` mode). Separately, that
file's `vi.mock('../core/git-utils.js', …)` factory (`:3-6`) exports exactly two functions; adding
`resolveWorkspaceRoots` to `git-utils.ts` and importing it in `index.ts` makes the mock
incomplete and **every test in the file throws**. The Testing Strategy does not mention
`index-args.test.ts`. (Novel, **high** — this is the round's clearest regression along a path
that crosses components.)

### 3.2 `selectRoots` puts a blocking `execSync` with a five-second timeout on the per-tool-call path, contradicting the Performance NFR.

`selectRoots` returns `projectPath = resolveGitRoot(<override>)`, and `resolveGitRoot:47` is
`execSync('git rev-parse --git-common-dir', { timeout: 5000 })` — synchronous, blocking the event
loop of a server that also runs a dashboard. The Performance NFR says resolution "costs a bounded
number of `git rev-parse` invocations at startup … and runs once per process." Eleven tools honour
`args.projectPath`; a client that always sends it pays one blocking exec per call, up to 5 s each
on a slow or contended filesystem. Specify memoization keyed on the override string, or make the
derivation async, or state the NFR exception. (Novel, medium.)

### 3.3 Deriving the workflow root from an override degrades to "verbatim" — silently — in four cases, which is the exact defect R3 AC 5 exists to prevent.

`resolveGitRoot` returns its input unchanged when:

1. `SPEC_WORKFLOW_SHARED_ROOT` is set (`:40-43`) — it returns the env value and ignores the
   override entirely. Arguably right (env beats everything), but then "derived from the override
   by the same rule the server uses" is not what happens and the warning text won't say so.
2. The git command fails (`:70-73`) — not a repository, git absent, timeout.
3. The common dir has no `.git` substring, so `gitIndex > 0` is false (`:60-67`). **Verified:** a
   repository created with `git init --separate-git-dir=…/realgit` returns
   `--git-common-dir` = `/…/sgd-git/realgit`, `lastIndexOf('.git')` = −1, and `resolveGitRoot`
   returns the input. So for that layout an override to a worktree yields
   `projectPath = <worktree>` verbatim → `PathUtils.getSpecPath` looks for `.spec-workflow`
   inside the worktree → the adversarial-route defect, reintroduced on the override path.
4. A bare repository returns `.` (**verified**), `lastIndexOf('.git')` = −1, same outcome.

The design asserts "derived, not verbatim" as if the derivation always succeeds. It fails closed
to verbatim with no signal. Either warn when `resolveGitRoot(override) === override` and the
override is not a repository root, or use `gitCommonDirAbsolute` + `--show-toplevel` (which the
design is already adding) instead of the legacy string-stripping. (Novel, medium.)

### 3.4 `selectRoots` is defined and wired to one tool. Eleven tools honour the override; R3 AC 4/5 are unmet for ten of them.

`args.projectPath || context.projectPath` appears at `review-task.ts:276`, `deferrals.ts:115`,
`get-task-review.ts:49`, `spec-index.ts:49`, `spec-status.ts:40`, `log-implementation.ts:308`,
`approvals.ts:199`, `:370`, `:496`, `adversarial-review.ts:51`, `adversarial-response.ts:49`.
R3 AC 4 and AC 5 are written unconditionally ("WHEN **a tool** accepts an `args.projectPath`
override"). Component 2 introduces the function; no component assigns its call sites. The one that
matters most is `adversarial-review.ts:51` — `requirements.md:13` diagnoses precisely that
handler's root confusion, and the design leaves it computing `PathUtils.getWorkflowRoot(projectPath)`
from an unconverted override at `:60`. Name the eleven sites or scope R3 AC 4/5 to `review-task`
explicitly. (Novel, high.)

### 3.5 The enforcement claim is correct. Its supporting sentence is wrong three ways, and it understates the blast radius fourfold.

**Verified by running `tsc`.** Baseline clean. With `workspacePath: string` required and nothing
else changed: **19 errors, and `server.ts` is not among them** — confirming the design's central
point that `setupHandlers(context: any)` launders the literal and that both changes are required.
Adding the annotation and the parameter type produces the twentieth error at
`src/server.ts(96,13)`. That reasoning is sound and should be kept.

What the design gets wrong:

- "`src/tools/__tests__/spec-index.test.ts:79` passes `{} as ToolContext` and must supply a real
  value" — **it does not fail compilation.** A type assertion suppresses the missing-property
  check, so `:79` still compiles and still hands the handler a context whose `workspacePath` is
  `undefined` at runtime — the silent default R3 AC 1 exists to forbid, surviving inside the file
  the design cites as proof the mechanism works. The site that *does* fail in that file is
  **`:16`** (`context = { projectPath: tempDir }`).
- "**four other** annotated fixtures will fail compilation" — the real count is **19 further
  sites across 11 files**. Full list from the compiler:

  | File | Lines |
  |---|---|
  | `src/dashboard/multi-server.ts` | `828`, **`969`** |
  | `src/dashboard/task-review-runner.ts` | `100` |
  | `src/server.ts` | `96` (only after annotation) |
  | `src/prompts/__tests__/create-steering-doc.test.ts` | `5` |
  | `src/tools/__tests__/adversarial-response.test.ts` | `19` |
  | `src/tools/__tests__/adversarial-review.test.ts` | `24` |
  | `src/tools/__tests__/decomposition-guide.test.ts` | `6` |
  | `src/tools/__tests__/deferrals.test.ts` | `15`, `277` |
  | `src/tools/__tests__/get-task-review.test.ts` | `18` |
  | `src/tools/__tests__/projectPath.test.ts` | `10`, `41`, `74`, `134`, `219`, `248` |
  | `src/tools/__tests__/review-task.test.ts` | `65`, `574` |
  | `src/tools/__tests__/spec-index.test.ts` | `16` |

- **`multi-server.ts:969` is a second inline `ToolContext` literal** the design has never named
  (see §3.6). It is absent from the Integration Points list, from R3 AC 3, and from R5 AC 7.

Because `tsconfig.json` sets `include: ["src/**/*"]` and `npm run build` runs bare `tsc`, these are
**build** failures, not just test failures. The atomic-commit constraint is therefore stronger
than "tests break." (Novel, medium-high — the mechanism is right; its stated scope is off by 4×
and its single named example is the one case the mechanism misses.)

### 3.6 An entire route pair is missing from the design's exhaustive-looking "Route wiring" list.

`multi-server.ts` has **two** adversarial routes, not one:

| Route | Handler call | Runner call |
|---|---|---|
| `POST …/adversarial-review` | `:826-829` — `{ projectPath: project.originalProjectPath }` | `:848-860` — `projectPath: project.originalProjectPath` (`:852`) |
| `POST …/adversarial-review-retry` | `:967-970` — `{ projectPath: project.originalProjectPath }` | `:1012` — `projectPath: project.originalProjectPath` |

R5 AC 7 names `:828`; R5 AC 8 names `:852`; the design's Route-wiring bullet names both and
nothing else. The retry route reproduces both defects verbatim. The `ToolContext` change will at
least *surface* `:969` as a compile error and the `AdversarialRunner` field rename will surface
`:1012`, so this is a completeness gap rather than a silent one — but an implementer fixing
compile errors at `:969` has no design statement telling them to pass the workflow root there,
and the obvious mechanical fix (add `workspacePath: project.originalProjectPath`) preserves the
bug. Add both lines to R5 AC 7/8 and to Integration Points. (Novel, medium-high.)

---

## 4. Component 1 — resolution helpers

### 4.1 Empirical verification: `resolve(cwd, raw)` is correct for every form; two documented forms are stated slightly wrong; one form the design does not list matters.

git 2.43.0, scratch repositories. `--git-common-dir` raw output and `realpath(resolve(cwd, raw))`:

| Layout | raw | `realpath(resolve(cwd,raw))` | `--show-toplevel` |
|---|---|---|---|
| repo root | `.git` | `/main/.git` | `/main` |
| subdirectory `src/a/b` | `../../../.git` | `/main/.git` | `/main` |
| linked worktree (sibling) | `/main/.git` | `/main/.git` | `/wt-a` |
| nested worktree (`/main/nested`) | `/main/.git` | `/main/.git` | `/main/nested` |
| submodule | `/super/.git/modules/vendor/lib` | same | `/super/vendor/lib` |
| superproject | `.git` | `/super/.git` | `/super` |
| bare repo | `.` | `<baredir>` | **fatal: must be run in a work tree** |
| symlinked root `/main-link` | `.git` | **`/main/.git`** | `/main` (physical) |
| symlinked worktree `/wt-a-link` | `/main/.git` | `/main/.git` | `/wt-a` (physical) |
| `--separate-git-dir` | `/sgd-git/realgit` | same | `/sgd-work` |
| inside `/main/.git` | `.` | `/main/.git` | **fatal** |
| non-git | — (exit 128) | `null` | fatal |

Confirmed: the `realpath` is what makes a symlinked root compare equal to its own linked
worktree (`/main-link/.git` → `/main/.git`), and the submodule stays distinct from its
superproject (`/super/.git/modules/vendor/lib` ≠ `/super/.git`). Both claims hold. `.git` is a
**file** in a linked worktree (`gitdir: /main/.git/worktrees/wt-a`) and `--git-common-dir`
handles it, so the Testing Strategy's `.git`-as-file case is really the same case as the linked
worktree; the *distinct* case is `--separate-git-dir`, which the design does not list.

Two small corrections: a subdirectory returns `../..`-repeated to its own depth
(`../../../.git` from `src/a/b`), not the fixed `../../.git` the design states; and the design's
form list omits `--separate-git-dir`.

### 4.2 `--show-toplevel` **fails** in a bare repository and inside a git directory, and the inference gate reads that failure as "the toplevels differ."

Verified above. `resolveGitWorkspaceRoot` (`git-utils.ts:18-29`) catches the failure and returns
its input. So for `cwd = <bare repo>` or `cwd = /main/.git`, `gitCommonDirAbsolute` returns a
non-null value that can compare **equal** to the configured path's (verified: from `/main/.git`,
`--git-common-dir` is `.` → `/main/.git`, identical to the value from `/main`), `sameRepository`
returns **true**, and the "differing toplevels" precondition is satisfied only because both
toplevel lookups failed and fell back to their inputs. Inference then adopts a git directory or a
bare repository as the workspace: the spawn cwd is not a work tree, and `git diff` there fails.
Reachable from a server-side hook, which runs with cwd set to the git dir. The design's
precedence bullet says "gated on `sameRepository` and differing toplevels" and never says what an
*unavailable* toplevel means. Require a successful `--show-toplevel` on **both** sides before
inference fires. (Novel, medium.)

### 4.3 The scrub covers resolution and the spawn boundary and misses the one place a *code* operation runs git — and the design cites that exact line as evidence to the contrary. LEAD FINDING.

Component 1: "`src/core/task-diff.ts:25` already builds an explicit env; the three existing calls
in `git-utils.ts` inherit wholesale and are brought in line."

`task-diff.ts:25` is `env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' }`. That **inherits
`process.env` wholesale** and adds one key. It is not an explicit environment and it does not
scrub anything. `computeTaskDiff` runs `git diff` with `cwd` set to what will become the
workspace, in the **parent** process — so R2 AC 10's scrub at the two `spawn` sites does nothing
for it, and R1 AC 7's scrub covers only resolution.

Verified consequence, in a scratch worktree with one modified tracked file:

```
$ git diff --numstat -M HEAD -- src/a/b/f.ts                     → "1  0  src/a/b/f.ts"
$ GIT_DIR=<unrelated>/.git git diff --numstat -M HEAD -- src/a/b/f.ts  → ""   (exit 0)
```

Empty stdout, **exit 0, no error**. `runGit` returns `{ stdout: '', ok: true }`, so
`computeTaskDiff` reaches `:100-109` with `diff: ''` and `stats: {filesChanged: 0, …}` — not the
`!ok` branch, not a rejection. `computeDiffMethodologyState` returns `{kind:'empty'}` and
`R4_2A_DIFF_EMPTY` (`review-task.ts:684`) tells the reviewing agent *"the task changes were
already committed before review."* A fabricated explanation for an environment leak, on the exact
failure axis R1 AC 7 was written for, in the exact function this spec exists to point at the right
tree. R4 AC 11's containment assertion does not help: the pathspecs are valid, the containment is
correct, and git is simply looking at another repository.

Add `GIT_DIR`, `GIT_COMMON_DIR`, `GIT_WORK_TREE`, and `GIT_INDEX_FILE` to `runGit`'s env
deletion at `task-diff.ts:23-27`, and give R2 AC 10 (or a new AC) that third site. Note also
`typecheck.ts:153` (`{ ...process.env, FORCE_COLOR, NO_COLOR }`) inherits them and spawns `tsc`;
harmless today but the same shape. (Novel, **high**. This is the round's lead finding and it is
the same "one instance of each hazard class" pattern the memory file records.)

Two supporting details, verified: `GIT_WORK_TREE` alone does **not** change `--git-common-dir`
(returns `.git` from the local repo) but `GIT_DIR` + `GIT_WORK_TREE` **does** change
`--show-toplevel` (returns `/main` from `/unrelated`), so scrubbing all four is justified even
though the design's stated reason only covers two. And an inherited `GIT_DIR` makes
`--git-common-dir` succeed from a **non-repository** (`/tmp` → `/main/.git`), so without the scrub
`gitCommonDirAbsolute` returns non-null for directories that are not repositories at all.

On breakage: scrubbing is safe for the committed tests —
`git-utils.test.ts`'s "should call git with correct options" uses
`expect.objectContaining({cwd, encoding, stdio, timeout})`, which is partial and tolerates a new
`env` key. One legitimate configuration it does affect: the `git --git-dir=$HOME/.dotfiles
--work-tree=$HOME` dotfiles pattern, where the exported variables *are* the configuration.
Scrubbing is still correct there (we want the directory's repository) but say so rather than
leaving it discovered.

Minor internal contradiction: the Code Reuse section says `resolveGitRoot` "keeps its contract
unchanged" while Component 1 says its call is "brought in line" with the scrub. Under an
inherited `GIT_DIR` those are different behaviours. Pick one sentence.

### 4.4 `sameRepository` returning false for two non-git directories is reachable and load-bearing. Correct as designed.

Trace the counterfactual: if `null === null` compared equal, the gate's second condition would
*also* pass, because `resolveGitWorkspaceRoot` falls back to its input for both paths and two
different non-repo paths differ. Inference would fire between two directories that are not
repositories. The design's explicit false is doing real work. Keep it, and keep the test.

### 4.5 The precedence chain has no overlapping state, but the environment escape hatch is unguarded in three ways R2 does not cover.

Ordering is unambiguous: env (suppressed in dashboard mode) → `noInference` → inference →
configured, with `dashboardMode` and `noInference` as distinct inputs per R2 AC 8. No state has
two rules applying. What is missing is any *constraint* on the env value beyond existence:

- **No same-repository check.** `SPEC_WORKFLOW_WORKSPACE` pointing into an unrelated repository is
  accepted, and the workflow root still derives from the configured path — so specs come from
  project A while `git diff`, `tsc`, and the spawned agent all run in project B, with no warning.
  A stale value exported in a shell profile does this permanently and invisibly. R1 AC 7 scrubs
  `GIT_DIR` because "two unrelated repositories compare equal" is unacceptable; this achieves the
  same outcome through a variable the design *adds*.
- **No directory check.** A value naming a **file** passes the design's existence test, then
  `validateProjectPath` (`path-utils.ts:319-322`, "Project path is not a directory") throws inside
  `initialize`'s `try` and kills the MCP handshake — precisely the outcome R2 AC 4 exists to
  prevent, reached through a different error. Check `stat().isDirectory()`, not existence.
- **No permission check**, which matters more for inference (§4.6).

(Novel, medium.)

### 4.6 Inference can make startup fail for a user for whom it works today, because nothing validates the inferred path.

`validateProjectPath` (`path-utils.ts:280-335`) rejects four things: paths containing `..`/`~`
that escape cwd, paths whose absolute form is prefixed by `/etc /usr /bin /sbin /var /sys /proc`
(`:305-313`), non-directories, and — at `:327` — paths without `R_OK | **W_OK**`. Today
`workspacePath` derives from the path the *user configured*, so a user who configured a working
path has a working workspace. Under inference the workspace comes from `process.cwd()`, which the
user did not choose. An agent launched with cwd inside `/var/www/<project>` (a worktree of the
same repo, a completely ordinary web root) or in a read-only checkout now produces an inferred
workspace that `server.ts:67` rejects, `initialize` rethrows at `:130-132`, and `index.ts:391`
exits 1. The design protects the env path from this (Error Handling 3) and leaves the inference
path unprotected. Validate the inferred path with the same predicate and fall back to the
configured path on failure, with a log. (Novel, medium-high.)

---

## 5. Components 6 and 7 — identity and the CLI flag

### 5.1 Moving `normalizeIdentityPath` inside `generateProjectId` is safe for every caller that compares a computed id to a stored one — verified — but it desynchronizes the id from the path stored beside it.

Callers of `generateProjectId`: production `project-registry.ts:192`, `:236`, `:280`, `:335` (four,
as the design says), plus **four test sites that do exactly what the prompt asks about** —
compute an id and compare it against what the registry produced or wrote:
`dashboard/__tests__/multi-server.test.ts:78`, `multi-server-approvals-content.test.ts:46`,
`adversarial-endpoints.test.ts:47`, `core/__tests__/project-registry.test.ts:53`. All four survive,
for two different reasons worth stating: where the path exists, both sides realpath and agree;
where it does not (`project-registry.test.ts:53` uses the nonexistent `/tmp/my-repo`), R1 AC 9's
fallback fires **symmetrically** on both sides and the hashes still agree. Fine — but that safety
depends entirely on the fallback being deterministic and applied at every call site, which is an
argument for putting it inside `generateProjectId` and should be stated as such.

The real problem is one the design does not raise. `registerProject:190` computes
`const workspacePath = resolve(projectPath)` and `:216` **stores that value** as
`entry.projectPath`; only the *id* would become `sha1(realpath(p))`. So after the change the
stored path and the identity are different spellings of the same directory. `readRegistry:106`
re-normalizes with `resolve()`, not `realpath`, so the divergence persists across reads, and
`ProjectContext.originalProjectPath` / `workspacePath` (`project-manager.ts:143`, `:182`) carry the
symlink spelling into every downstream consumer — including the spawn cwd, `computeTaskDiff`'s
cwd, and R4 AC 8's containment base. Combined with §2.3 and with the verified fact that
`--show-toplevel` returns the **physical** path, one process ends up holding two spellings and
comparing across them. Normalize the stored `projectPath` in the same change, or state explicitly
that identity and path are deliberately different and that every comparison must realpath first.
(Novel, medium-high.)

### 5.2 `unregisterInstanceById` is writable — but a method one word away already exists with different semantics, and the design does not mention it.

`unregisterProjectById(projectId)` already exists at `project-registry.ts:260-264` and **deletes
the whole entry**, with one caller (`project-manager.ts:295`, the dashboard's manual remove). The
design adds `unregisterInstanceById(projectId, pid)`, which removes one instance. Both are
implementable against the existing structure — entries are keyed by `projectId`, so
`registry.get(projectId)` → filter `instances` → delete if empty is a direct transcription of
`unregisterProject:238-252`. But shipping two exported methods whose names differ by one word and
whose semantics differ by "entry" vs "instance" is a maintenance trap in a file that already has
`unregisterProject` doing both depending on whether `pid` is passed. Either extend
`unregisterProjectById(projectId, pid?)` with the same optional-pid convention `unregisterProject`
already uses, or rename. (Novel, low-medium.)

Entries registered before the upgrade: they keep their old key, so `unregisterInstanceById` with a
freshly-cached id never touches them. Migration acknowledges the orphan. What it does not say is
that the orphan is **permanent under Docker**: `cleanupStaleProjects` reaps by
`isProcessAlive`, which returns `true` unconditionally when both path-translation variables are
set (`project-registry.ts:164-171`). One line in Migration. (Compounding on v3.)

### 5.3 The two named changes for `--no-workspace-inference` are not sufficient — there are five, and the flag has a parse hole the design's own R1 AC 13 analysis should have caught.

Traced through `parseArguments`:

1. `validFlags` at `:115` — named. ✔
2. The argument filter at `:166-175` — named. ✔
3. **A boolean read**, alongside `:109-111`'s `isDashboardMode` / `noOpen` / `noSharedWorktreeSpecs`.
   Not named.
4. **The return type at `:99-108` and the `main()` destructure at `:212-215`**, so the value reaches
   `resolveWorkspaceRoots({ noInference })`. Not named.
5. **`showHelp()`'s OPTIONS block (`:26-36`)**, which the Usability NFR requires ("Documentation
   SHALL explain … the `--no-workspace-inference` opt-out") and which is the only place `--help`
   lists flags. Not named.

And the hole: the validation loop at `:121-126` accepts `--flag=value` forms by checking the flag
name, while the filter at `:167-171` matches only exact strings. So
`--no-workspace-inference=true` **passes validation, is not filtered out, and becomes
`filteredArgs[0]` — the project path**. The server then tries to use `--no-workspace-inference=true`
as a directory. This is pre-existing for `--no-open` and `--no-shared-worktree-specs`, but the
design's R1 AC 13 argument is specifically about how flag registration fails loudly versus
quietly, so it is the right place to close or record it. (Novel, medium.)

---

## 6. Cross-cutting: ownership, ordering, migration

### 6.1 Acceptance criteria with no owning component

- **NFR Security, second bullet**: "The denylist checks in `src/core/path-denylist.ts` and
  validations in `src/core/security-utils.ts` SHALL be audited against the second root in the same
  change." The design mentions `security-utils.ts` **zero times**. Worse, the requirement is
  misdirected: `security-utils.ts` contains rate limiting, CORS, security headers, audit logging,
  and port defaults — **no path validation at all**. The path validations are
  `PathUtils.safeJoin`, `PathUtils.validatePathWithinBases`, and `validateProjectPath` in
  `path-utils.ts`, none of which the design audits against `workspacePath` despite `safeJoin`
  being the single entry point for every `.spec-workflow` path and `validatePathWithinBases`
  being the existing two-root containment primitive (§2.7). Amend the NFR to name the right module
  and give it an owner.
- **R4 AC 1 and AC 2's *root* arguments.** `computeTaskDiff(projectPath, validatedAllFiles)`
  (`review-task.ts:389`) and `runProjectTypecheck(projectPath, validatedAllFiles, …)` (`:387`) each
  take a **root** as their first argument. Component 4's table assigns each consumer a *file
  list* — "`computeTaskDiff` (`:389`) | `workspaceFiles`", "`runProjectTypecheck` | `workspaceFiles`"
  — and never says the first argument changes. R4 AC 1 ("SHALL pass the workspace path") and
  R4 AC 2 ("SHALL pass the workspace path") are about the root, and the only table row that
  mentions a path is `unwrapTypecheck`. Add a column, or two rows.
- **R5 AC 7 / AC 8** for the retry route (`:969`, `:1012`) — §3.6.
- **R3 AC 3** for 16 of 20 construction sites — §3.5.
- **R3 AC 4 / AC 5** for 10 of 11 override sites — §3.4.
- **R6 AC 7** covers env scrubbing "at both spawn sites"; there is a third site that needs it
  (`task-diff.ts:25`, §4.3) and no criterion names it.
- **`buildPrompt`** (`task-review-runner.ts:212`, `:277`) has no owner for the `filesToReview`
  shape change — §2.5.

Components owning criteria they cannot satisfy: Component 3 owns R4 AC 6 and AC 7 and cannot
satisfy either with `safeRealpath` unchanged (§2.1).

### 6.2 Sending `runProjectTypecheck` the workspace has three unstated side effects, two of which write to the tree under review.

`runProjectTypecheck(projectPath, …)` uses its root for more than `tsconfigPath`:

- `:139-140` — `fs.mkdir(path.join(projectPath, '.spec-workflow', '.cache'), {recursive:true})`.
  With the workspace as the root, **every worktree gains a `.spec-workflow/` directory** on first
  review. That is the exact opposite of the premise the whole spec rests on ("`.spec-workflow` is
  deliberately shared across worktrees"), and under `--no-shared-worktree-specs` it silently
  creates the directory the flag is supposed to make explicit.
- `:141` — `ensureGitignoreEntry(projectPath)` (`:377-405`) appends `.spec-workflow/.cache/` to
  `<root>/.gitignore` when not already covered. `.gitignore` is **tracked**, so this dirties the
  worktree under review with an uncommitted modification. Each of N worktrees gets its own copy of
  the same edit.
- `:134` — `resolveTscBinary(projectPath)` (`:361-375`) stats `<root>/node_modules/.bin/tsc`. A
  freshly created worktree has no `node_modules`, so every typecheck returns
  `{status:'unavailable', reason:'tsc-not-found'}` where today it resolved against the main
  checkout and ran. That is arguably the honest answer and it does reach the agent through
  `R4_6B` — but it is a behaviour change in the primary use case, it is a second signal lost in
  the same release as §1.1, and the design does not mention it.

Decide explicitly: keep the cache and the ignore-file write on the **workflow root** (two extra
arguments, and `tsconfigPath` still from the workspace), or accept the worktree writes and put
them in Migration. Either way this belongs in the design, not in the implementer's lap.
(Novel, high.)

### 6.3 Implementation order — six sets that are individually safe and jointly breaking

The design states no order. Because `tsconfig.json` has `include: ["src/**/*"]` and `npm run build`
is bare `tsc`, an intermediate state is a **build** failure, not just a test failure.

1. **`ToolContext.workspacePath` required + all 20 sites in one commit.** Empirically verified:
   19 errors from the field alone, 20 with the annotation and the typed parameter. Table in §3.5.
   Cannot be split.
2. **`AdversarialRunner.RunOptions.projectPath` → `workspacePath`** must land with `:852` **and**
   `:1012`.
3. **`TaskReviewRunner.RunOptions` two-field split** must land with `:1791` and `:1853`.
4. **`review-task.ts:360-361`'s `.map` deletion must not land after the two-root partition** (the
   reverse is v2's catastrophe). Deleting the `.map` alone is safe and preserves today's semantics
   because `validateAllFiles:63` re-resolves against `projectPath`; keep the `new Set` at `:360`.
5. **The `filesToReview` shape change must land with `buildPrompt`'s signature and `:277`**, plus
   `review-task.test.ts:132` and `:787`. Nothing else will catch it (§2.5).
6. **`git-utils.ts`'s new exports must land with `index-args.test.ts:3-6`'s `vi.mock` factory**, or
   that file throws on every test (§3.1).

### 6.4 The `exports` map does not enforce what the Migration section claims, and it introduces one real risk.

Packaging facts, verified: no `exports` map, no `types` field, `"main": "dist/index.js"`,
`"files": ["dist/**/*", README, CHANGELOG, LICENSE]`, `"bin": {"spec-workflow-mcp": "dist/index.js"}`,
and `tsconfig.json` sets `"declaration": true`. So `dist/types.d.ts` ships and a deep import
resolves and type-checks. The design's characterisation — "undocumented and unintended, **not**
unsupported by the packaging" — is accurate and is the right correction of v3.

The conclusion drawn from it is not. "Adds an `exports` map in the same change, so the boundary is
enforced rather than re-argued at every future type change":

- **It enforces nothing for the actual consumption route.** This package is consumed as a `bin`
  through `npx` in `.mcp.json` (verified: this repository's own `.mcp.json` invokes
  `node …/dist/index.js`). `bin` resolution does not go through `exports`. The population the map
  would constrain — library consumers deep-importing `dist/types.js` — is the population the
  design has just argued does not exist.
- **It needs `"./package.json": "./package.json"`** or it breaks any tool that reads the manifest
  through the package specifier, which several npm-ecosystem tools do.
- **With `"type": "module"` and `moduleResolution: "node16"`, an `exports` map without a `types`
  condition removes types from the bare specifier too**, so it is a behaviour change for the
  `main` entry as well as the deep one.
- **The changed surface is larger than one interface, and one item is a *removal*, not a change.**
  `ToolContext` gains a field; `validateAllFiles` is **deleted** from `dist/tools/review-task.js`
  (a removed export, which no `exports` map softens); `resolveLoggedFiles` appears in a new module;
  `TaskReviewRunner.RunOptions` and `AdversarialRunner.RunOptions` both change field names.
  Declare the surface, not the interface.

Ship the position ("undocumented and unintended") in the release notes; drop the `exports` map
from this change or give it its own justification that does not rest on enforcement it cannot
provide.

Also missing from Migration: the second, independent cause of `projectId` churn (§3.1 — the
`resolveGitWorkspaceRoot` deletion, which moves ids for every subdirectory-or-cwd configuration
regardless of symlinks), and the permanence of orphaned entries under Docker (§5.2).

---

## Verified fine — do not spend more review effort here

- **Component 2's enforcement mechanism.** Proven by compiler run: the required field alone is
  silent at `server.ts`; both changes together catch it. Keep the reasoning verbatim.
- **`gitCommonDirAbsolute = realpath(resolve(cwd, raw))`.** Correct for all twelve layouts I could
  produce, including the symlinked root and the submodule.
- **`sameRepository` false for two non-repositories.** Reachable and load-bearing (§4.4).
- **R4 AC 8's refusal to accept the workflow root itself.** Verified from both directions: from a
  nested worktree, a parent-repo pathspec is `fatal: … is outside repository`, exit 128; from the
  main checkout, a nested-worktree pathspec produces **empty output at exit 0** — silently wrong
  rather than loudly wrong, which makes the narrow rule more valuable than the design claims.
- **R4 AC 11's assertion-over-stderr choice.** The message is
  `fatal: <p>: '<p>' is outside repository at '<repo>'`, exit 128, and it is gettext-marked.
  Asserting first is right. (What the assertion *does* on failure is still unspecified — see
  below.)
- **`AdversarialRunner`'s deliberate asymmetry.** `opts.projectPath` is used at exactly one place
  (`:111` → spawn `cwd`); it never calls `getSpecPath` and never builds a `ToolContext`. The
  one-field contract is correct.
- **`ProjectContext.workspacePath` already exists and is Docker-translated** (`project-manager.ts:14`,
  `:117`, `:143`, `:182`), so R5 AC 8's fix at `:852` is implementable exactly as written.
- **`job-scheduler.ts:178` / `:186` keeping the workflow root.** Correct — both are destructive
  directory operations on `.spec-workflow`.
- **The env scrub does not break `git-utils.test.ts`**, whose options assertion is
  `expect.objectContaining`.
- **The steering `N/A` claims.** `.spec-workflow/steering/` is empty; all three are honest.
- **The e2e harness "rewritten, not extended" scope.** Confirmed: `:200` passes
  `--no-shared-worktree-specs`, `:202` sets `cwd: this.options.serverRoot`, and `.spec-workflow` is
  seeded inside each worktree (`:157-158`, `:176-177`). Inference genuinely cannot fire, because
  `serverRoot` is this repository and the worktrees are in a temp repo. One consequence the design
  misses is in "What's missing" below.

---

## Citation audit (v4)

**Verified correct:** `git-utils.ts:8`, `:38-74`, `:40-43`, `:60-66` · `types.ts:58` ·
`server.ts:67`, `:77`, `:95-99`, `:135`, `:188` · `index.ts:115`, `:116-128`, `:166-175`,
`:180-181`, `:218-225` · `project-registry.ts:29-33`, `:233-255` ·
`review-task.ts:26-39`, `:41-90`, `:276`, `:285`, `:345`, `:360-361`, `:380`, `:381`, `:388`,
`:389`, `:391`, `:432`, `:556` · `task-diff.ts:25` (line correct, claim about it false) ·
`task-review-runner.ts:27-35`, `:95`, `:100`, `:144`, `:365`, `:368` ·
`adversarial-runner.ts:111`, `:147` · `multi-server.ts:828`, `:852`, `:1791`, `:1853` ·
`job-scheduler.ts:178`, `:186` · `path-denylist.ts` (module) · `project-manager.ts:264-265` ·
`adversarial-review.ts:60` (via requirements) · `spec-index.test.ts:79` (line exists; the claim
about it is wrong) · `typecheck.ts` timeout and `git-utils.ts:8` 5-second budget.

**Drifted:**

| Cited | Actual |
|---|---|
| `e2e/helpers/worktree-harness.ts:203` (child `cwd`) | `cwd: this.options.serverRoot` is **`:202`**; `:200` is the args array, `:205` is `SPEC_WORKFLOW_HOME`. v3 called this `:203` and it was wrong there too — third occurrence of drift on this one line. |
| "a subdirectory returns `../../.git`" | depth-dependent; verified `../../../.git` from `src/a/b` |
| "Two new modules (`git-utils` additions, `file-resolution`)" | three new files are named across the components (`file-resolution.ts`, `root-selection.ts`, plus `git-utils` additions, which are not a module) |

**Substantively wrong, not merely drifted:**

- *"`safeRealpath` … is reused unchanged; only the counting is new"* + *"`missing` counts `ENOENT`
  drops … `unresolvable` counts the rest"* — `safeRealpath` returns `undefined` for every failure
  and discards the code (§2.1).
- *"`src/core/task-diff.ts:25` already builds an explicit env"* — it inherits `process.env`
  wholesale and adds one key (§4.3).
- *"`spec-index.test.ts:79` passes `{} as ToolContext` and must supply a real value; four other
  annotated fixtures will fail compilation"* — `:79` does **not** fail (the assertion suppresses
  the check); the failing site in that file is `:16`; and there are 19 further sites in 11 files,
  not four (§3.5).
- The Component 1 precedence chain ending in *`configuredPath`* — silently deletes
  `resolveGitWorkspaceRoot` and contradicts R1 AC 2's "that path" (§3.1).
- *"`counts` … exists so the limitation is visible"* — no component, response field, or log reads
  it (§1.2).
- *"the adversarial **runner** call (`:852`) passes `project.workspacePath` … the job scheduler
  keeps the workflow root"* — the enumeration reads as exhaustive and omits the entire retry route
  (`:969`, `:1012`) (§3.6).
- Data Models: *`workflowRootPath: absolute`* (not realpath-normalized) while `ResolvedFile.path`
  is — makes containment reject `.spec-workflow` paths under a symlinked root (§2.3).
- Code Reuse: *"`resolveGitRoot` keeps its contract unchanged"* vs Component 1's *"the three
  existing calls … are brought in line"* (§4.3).

---

## Top 5 risks / gaps

1. **`task-diff.ts:25` inherits `GIT_DIR`, and the design cites it as proof that it does not.**
   Verified: `GIT_DIR=<unrelated>/.git git diff --numstat -M HEAD -- <file>` in a worktree returns
   empty stdout at **exit 0**, so `computeTaskDiff` takes the success path with `diff: ''` and no
   rejection, and `R4_2A_DIFF_EMPTY` tells the reviewing agent the changes "were already committed
   before review." R1 AC 7 scrubs resolution, R2 AC 10 scrubs the two spawn sites, and the one
   place a *code* operation runs git in the parent process is left inheriting — the same
   one-instance-per-hazard-class pattern the memory file names. (§4.3)
2. **Component 3 owns two acceptance criteria it structurally cannot satisfy.** `safeRealpath`
   returns `undefined` for every failure, so `counts.missing` vs `counts.unresolvable` (R4 AC 6)
   and the deleted-in-workspace guard (R4 AC 7) are both uncomputable while it is "reused
   unchanged." Compounding: the four `counts` buckets map onto the wrong four causes and lose the
   three input-validation drops that have committed tests; and the resolution predicate is
   undefined for absolute entries, for which `path.resolve` ignores the base entirely so
   "workspace first" is a no-op and `ambiguous` is vacuously true. (§2.1, §2.2, §2.4)
3. **Dropping `resolveGitWorkspaceRoot` from the fallback breaks a *non-worktree* population, and
   R3 AC 7's parity clause structurally cannot cover it** — it is conditioned on the two roots
   being equal, which is exactly what stops being true. A user with no path argument (or a
   subdirectory path) gets a new `projectId`, a new spawn cwd, and containment that rejects every
   logged file outside that subdirectory. Four committed assertions in `index-args.test.ts` pin the
   current behaviour, and that file's two-export `vi.mock` factory breaks outright. (§3.1)
4. **Error Handling 4's "deliberate gap" is the original defect relocated, and spec 1 widens it.**
   Traced: an empty `filesToReview` reaches the agent as an empty list under "Read every file
   listed", with `R4_2A_DIFF_EMPTY` fabricating "already committed" — a passing verdict over
   unexamined code. Spec 1 adds three new all-drop paths (containment narrowing versus absolute
   logged paths, which `log-implementation.ts:372-373` neither normalizes nor validates; the AC 7
   guard; `tsc-not-found` in fresh worktrees) and `counts` is read by nothing. (§1.1, §1.2, §6.2)
5. **Plumbing gaps on hops the compiler cannot see.** `filesToReview`'s shape change hits
   `task-review-runner.ts:212`/`:277` through an `any`-typed destructure, so the review prompt
   renders `- [object Object]` per file with no build error. The adversarial **retry** route
   (`:969` handler, `:1012` runner) duplicates both defects R5 AC 7/8 fix and appears in no
   requirement, no component, and no Integration Points list. `runProjectTypecheck`'s move to the
   workspace creates `.spec-workflow/.cache` inside every worktree and appends to the worktree's
   **tracked** `.gitignore`. (§2.5, §3.6, §6.2)

## Top 3 conclusions to challenge or reverse

**1. Reverse: "`safeRealpath` … is reused unchanged; only the *counting* is new."** The whole of
Component 3's drop accounting and its deleted-in-workspace guard depend on distinguishing ENOENT
from every other error code, and `safeRealpath` (`review-task.ts:26-39`) computes the code, uses it
to decide whether to warn, and then throws it away. Two acceptance criteria — R4 AC 6's "Failures
for other reasons SHALL be counted separately from `ENOENT` drops" and R4 AC 7 in its entirety —
are unimplementable as the design stands. The correct move is small and must be stated: change
`safeRealpath` to surface the code, accept that this is a signature change to an exported function
with its own committed test block (`review-task.test.ts:372-418`, including the ELOOP message
assertion at `:411`), and move it into `src/core/` alongside the new resolver so `file-resolution.ts`
does not have to import from `src/tools/`. Leaving the sentence as written is the third consecutive
round in which a fix was scoped to the half of a mechanism that was easier to name.

**2. Reverse: ending the workspace precedence chain at `configuredPath`.** Today the fallback is
`resolveGitWorkspaceRoot(configuredPath)` — the git toplevel — and that is load-bearing for three
things the design does not connect: `projectId` stability, the containment base, and the spawn cwd.
The design's chain returns the raw configured path, which (a) contradicts R1 AC 2's "that path", (b)
moves `projectId` for every user who runs without a path argument or with a subdirectory path,
which Migration attributes solely to `realpath`, (c) makes `workspacePath !== projectPath` for that
population so R3 AC 7's parity guarantee does not apply to them, and (d) narrows containment to a
subdirectory where today it spans the repository. End the chain at
`resolveGitWorkspaceRoot(configuredPath)` and say so explicitly, or amend R1 AC 2/AC 3 to state
that the configured path is now taken verbatim and add that to Migration as a second, independent
cause of id churn. Either is defensible; silence is not, because the change is invisible in every
worktree scenario the Testing Strategy exercises and shows up only for the users who have no
worktrees at all.

**3. Challenge: "the count exists so the limitation is visible rather than implied," and the
`exports` map that "enforces" the type boundary.** These are the same move made twice — a
mechanism named in place of a mechanism built. `counts` is returned by `resolveLoggedFiles`,
assigned to no consumer in Component 4's table, absent from the prepare response at
`review-task.ts:410-424`, and logged nowhere; it is visible to nothing, so R4 AC 5's "the count
reported" is unmet and the ambiguity limitation is precisely as implied as it was before. The
`exports` map is added to enforce a boundary against a consumption route (`import` of
`dist/types.js`) that the design has just argued nobody uses, while the route that *is* used
(`npx` → `bin`) bypasses `exports` entirely; meanwhile it needs a `./package.json` entry and a
`types` condition to avoid breaking the manifest read and the bare-specifier types. Ship the
disclosure that actually reaches a reader — one string in the prepare response and one line in the
release notes — and drop both of these.

## What's missing — do this before acting on the document

- **Change `safeRealpath` to return the error code** and move it, its `warnOnce` set, and
  `_resetValidateWarnings` into `src/core/`. Then re-derive `counts` from the five drop causes the
  current code actually distinguishes (non-array, non-string, `path.resolve` throw, ENOENT,
  non-ENOENT realpath failure, containment rejection), and state what a containment rejection
  warns, since `review-task.test.ts:486`, `:503`, and `:768` assert the current message.
- **Split anchoring from classification in `resolveLoggedFiles`.** Specify: relative entries are
  anchored `resolve(workspace, e)` then `resolve(workflowRoot, e)`; absolute entries are not
  anchored at all and are classified by containment only; `ambiguous` applies solely to relative
  entries that anchor successfully under both roots. As written, `path.resolve` makes the stated
  order a no-op for every absolute entry.
- **Specify both roots as realpath-normalized**, or realpath the containment bases at comparison.
  Also `resolve()` `SPEC_WORKFLOW_SHARED_ROOT` to an absolute path — `git-utils.ts:40-43` returns
  it verbatim and it may be relative.
- **Scrub `GIT_DIR`, `GIT_COMMON_DIR`, `GIT_WORK_TREE`, `GIT_INDEX_FILE` from `runGit`
  (`task-diff.ts:23-27`)** and give R2 AC 10 (or a new criterion) that third site. Correct the
  Component 1 sentence about `task-diff.ts:25`.
- **Restore `resolveGitWorkspaceRoot` to the fallback** (or amend R1 AC 2/AC 3 and Migration), and
  add `index-args.test.ts` to the Testing Strategy — its `vi.mock` factory must gain every new
  `git-utils` export or the whole file throws.
- **Require a successful `--show-toplevel` on both sides before inference fires**, and **validate
  the inferred workspace** with `validateProjectPath`'s predicate, falling back with a log. A bare
  repository and a git directory both return a usable `--git-common-dir` and **no** toplevel
  (verified), and `validateProjectPath` rejects `/var*` prefixes, non-directories, and paths
  without write access — none of which an inferred cwd is guaranteed to satisfy.
- **Constrain `SPEC_WORKFLOW_WORKSPACE`**: same-repository check with a warning on mismatch, and
  `stat().isDirectory()` rather than mere existence — a file passes the existence test and then
  kills the handshake at `server.ts:67`, the outcome R2 AC 4 exists to prevent.
- **Own the `filesToReview` shape change end to end**: `task-review-runner.ts:212`, `:277`,
  `review-task.test.ts:132`, `:787`. Nothing else will catch it, because `:110` destructures an
  `any`.
- **Add the adversarial retry route to R5 AC 7/8, the Route-wiring bullet, and Integration
  Points**: `multi-server.ts:969` (handler) and `:1012` (runner).
- **Name `selectRoots`'s call sites.** Eleven tools read `args.projectPath`; the design wires one.
  Decide per tool or scope R3 AC 4/5 to `review-task`. Specify memoization for the `execSync` the
  override triggers, and what happens when `resolveGitRoot(override) === override`.
- **Decide what `runProjectTypecheck` does with its root's side effects** — `.spec-workflow/.cache`
  creation (`typecheck.ts:139-140`) and the tracked-`.gitignore` append (`:141`, `:377-405`) — and
  put `tsc-not-found` in fresh worktrees in Migration.
- **Assign R4 AC 1/AC 2's root arguments** (`review-task.ts:387`, `:389`) in Component 4's table,
  and **state what R4 AC 11's assertion does on failure** — throw into `unwrapDiff`'s rejection
  arm, set `TaskDiffResult.rejection`, or drop the path. `computeTaskDiff:53-55` currently has no
  rejection path for a `!ok` diff, so an unhandled assertion lands in `{kind:'empty'}` and
  reproduces the fabricated explanation.
- **Amend the Security NFR** to name `path-utils.ts` (`safeJoin`, `validatePathWithinBases`,
  `validateProjectPath`) instead of `security-utils.ts`, which contains no path validation, and
  give it an owner. While there, reconcile Component 3 with the two two-root resolvers that already
  ship: `ApprovalStorage.getFilePathCandidates` (`approval-storage.ts:204-239`) and
  `multi-server.ts:716-738`.
- **Bring a minimal registry lock into spec 1, or record the regression.** Spec 1 turns
  `registerProject`'s read-modify-write into a lost-registration race by giving each worktree a
  distinct id; spec 3 owns the fix, and no `.mcp.json` avoids it.
- **State the six-part implementation order** in §6.3, with the compiler-verified 20-site
  `ToolContext` commit as one indivisible task. `tsconfig.json` includes `src/**/*` and
  `npm run build` runs bare `tsc`, so an intermediate state fails the build.
- **For the e2e rewrite: state the invocation change.** The harness currently runs
  `npm run dev -- <path> --no-shared-worktree-specs` with `cwd: serverRoot`
  (`worktree-harness.ts:199-202`). Setting the child `cwd` to the worktree — which R6 AC 2 requires
  for inference to be testable at all — breaks `npm run`, because the temp repository
  (`:128-143`) has no `package.json`. The replacement must invoke `tsx`/`node` with an absolute
  entry path. This is the load-bearing detail in "rewritten, not extended" and the design does not
  mention it.
