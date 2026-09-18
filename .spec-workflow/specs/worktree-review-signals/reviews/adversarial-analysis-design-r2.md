# Adversarial Analysis — worktree-review-signals/design (v2), Round 2

Attack surface: feasibility, consistency, edge cases. Fresh lens: failure,
rollback and partial-failure paths (a git spawn that errors or times out, a
typecheck killed mid-run, a lock returning `acquired: false`, a `task-state.json`
write interrupted between temp-write and rename, a malformed/version-mismatched
state file, and every `unavailable` reason). Prior round: R1 (0/1/1, both
Accepted). Classification per finding below.

## The v2 delta holds — attacked first, no MUST_FIX

The prompt directs me to attack the round-1 response clauses before anything
else. I read both ends of every citation the delta wrote and re-derived the two
mechanical claims. All sound:

- **R1-1 fix (Component 10, lines 22 / 175 / 262 / 248).** The strip mechanism is
  correct. `toMCPResponse` is the single encode site (`src/tools/index.ts:37-91`),
  so a recursive undefined-key delete there covers `projectContext.dashboardUrl`
  on *both* responses that carry it: `src/tools/review-task.ts:525` and
  `src/tools/log-implementation.ts:414` (the design names only the former, but
  the global strip closes both — consistent, not a gap). The load-bearing claim
  "this repository's Vitest `toEqual` equates a deleted key with `undefined`" is
  **true**: `toEqual` ignores `undefined`-valued properties on both operands
  (only `toStrictEqual` would fail), so `decode(encode(stripped))` — which lacks
  the key entirely — deep-equals a source that holds the key as `undefined`. The
  line-248 test bullet now exercises "a context with and without `dashboardUrl`",
  which does catch the R1-1 no-dashboard path. Verified `src/types.ts:74`
  (`dashboardUrl?`), `src/server.ts:205`/`:222` (left `undefined`, assigned),
  `:525` (copied). D5's "a strip closes every optional field" (line 262) is
  accurate.
- **R1-2 fix (PrepareData inline shapes, lines 96-97, 106).** The two inline
  shapes match the literals they replace. `taskContext` at `review-task.ts:420-426`
  builds `{description, requirements: task.requirements||[], leverage:
  task.leverage||null, prompt: task.prompt||null, promptStructured:
  task.promptStructured||null}`; `task` is a `ParsedTask` (`parseTasksFromMarkdown`
  at `:374-375`; `ParsedTask.requirements?: string[]` at `task-parser.ts:117`), so
  `task.requirements||[]` is `string[]`, matching. `implementationSummary` at
  `:428-434` reads `latestLog` = `taskLogs[0]` where `getTaskLogs` returns
  `ImplementationLogEntry[]` (`implementation-log-manager.ts:461`), so
  `statistics`/`artifacts` are exactly `ImplementationLogEntry['statistics']` /
  `['artifacts']`, matching. `PromptSection` at `src/types.ts:146-149` is
  structurally identical to the task-parser's local `PromptSection`
  (`task-parser.ts:103-106`) that `ParsedTask.promptStructured` actually carries,
  so the annotation compiles. **R1-2 is fully closed.**

Both lint-changed citations (lines 106, 175) are accurate against source. No
misstated artifact. The delta introduces no MUST_FIX — consistent with the
pattern the prompt named (post-round-1 MUST_FIX come from delta claim errors;
this delta has none).

## Findings

### R2-1 — SHOULD_FIX — Novel — a git spawn that *hangs* has no degraded path; the new spawn on the interactive status route can never return

The fresh lens names "a git spawn that errors or times out." Errors are handled
(`runGit` resolves `ok: false` → `rejected` for the diff, EH #5). **A hang is
not.** `runGit` (`src/core/task-diff.ts:50-62`) sets `cwd`, `env` and `maxBuffer`
but **no `timeout`**, and resolves only inside the `execFile` callback. If the
git child never exits (a repo on a stalled network mount, a hung `git` process,
a credential prompt), the promise never resolves — no `ok: false`, no
degradation, just an unbounded await.

The design adds three git spawns on paths that previously had fewer or none:
`readHeadCommit` and `isAncestorOfHead` in `handlePrepare` (Component 4), and
`readHeadCommit` in the **dashboard status route** (Component 6), which today
does zero git and returns fast (`multi-server.ts:1465-1473`). Component 6 states
the recording is "Wrapped in try/catch with `console.warn`; the response
(`:1469-1473`) is identical on every arm." That is false for a hang: `try/catch`
catches a throw or rejection, not a pending promise. If `readHeadCommit` is
awaited before the `:1469` return (as the wording implies) and git hangs, the
`PUT .../status` **never responds** — a new user-facing hang on a dashboard
action. If instead the implementer makes it fire-and-forget to protect the
response, the e2e assertion `provenance === 'recorded'` (Testing Strategy line
254) becomes a cross-process race. The design specifies neither a timeout nor the
await/fire-and-forget choice.

The Error Handling section (lines 230-239) enumerates git *failure* but omits git
*hang*, and the prompt asks that the section "cover each path the components can
take." Fix: give `runGit` (or at least the two new spawns) a bounded `timeout`
so a hang resolves as `ok: false` with a `cause`, feeding the existing
`head-expected` / `rejected` degradations; and state whether the status route
awaits the record. Likelihood is low for `rev-parse`/`merge-base` specifically
(fast, no network, `GIT_OPTIONAL_LOCKS=0`), which is why this is SHOULD_FIX not
MUST_FIX — but the design puts an unbounded blocking op on an interactive route
with an explicit (incorrect) claim that the response is always identical.

### R2-2 — SHOULD_FIX — Novel — the atomic-write failure lifecycle leaks untracked debris into the git-tracked spec store, and Error Handling omits the store-write-throws path

Round 1's memory flagged "the error-path temp-file lifecycle" as unexamined. Two
gaps here, one story.

1. **The gitignore pattern does not cover the files the store's own machinery
   produces.** The design writes the record with `uniqueTempPath(filePath)` then
   `fs.rename` (Component 1, following `writeRegistry` at
   `project-registry.ts:277-279`). `uniqueTempPath` (`registry-lock.ts:52-54`)
   emits `<path>.<pid>.<counter>.tmp`; a stale-lock break emits
   `<lockPath>.<pid>.<counter>.stale` (`registry-lock.ts:208`). The design's
   ignore entry (line 196, D19) adds only the two exact names `task-state.json`
   and `task-state.json.lock`, matching the exact-filename precedent at
   `.gitignore:150` (`harness-activity.jsonl`). Neither exact name matches
   `task-state.json.1234.0.tmp`. Unlike `writeRegistry` (whose temp lives in the
   untracked home dir), this record lives in `.spec-workflow/specs/<spec>/` —
   **git-tracked in this repo**. A crash between `writeFile` and `rename`, or a
   `rename`/`link` failure on the restore path, orphans a temp/stale file that
   shows as untracked and can be swept into a commit by the SDD doc-commit steps'
   `git add .spec-workflow/...`. The design's own stated intent — "the server
   writes no user `.gitignore`" and runtime records are not committed (D19) — is
   only half-realized. Fix: use a glob (`.spec-workflow/specs/*/task-state.json*`)
   so the file, lock, temp and stale variants are all covered.

2. **Error Handling does not enumerate "the store write throws."** EH #2 covers
   only `acquired: false`. If the lock is acquired but `writeFile`/`rename` inside
   `fn` throws (EXDEV, ENOSPC, EACCES), `withRegistryLock` releases the lock in
   its `finally` and **re-throws** (`registry-lock.ts:385-390`), so `recordBase`/
   `recordAttribution` reject rather than return `false`. It happens to be
   degraded-safe because both callers wrap the call (Components 6, 7), but the
   Error Handling section — which the prompt asks me to check for completeness —
   never states this path, and the `read` side never states what removes the
   orphaned temp. State the write-throws outcome and the temp cleanup.

### R2-3 — MINOR — Novel — "malformed → null" is underspecified: a shape-valid, version-1 record with a wrong-typed field reaches the consumer and can throw, contradicting EH #3

EH #3 promises "Record missing, unreadable, malformed, or wrong version: `read`
returns null; prepare reports `head-expected` and `unknown` and succeeds." The
store's `read` is specified to null out "missing, unreadable, malformed or
`version !== 1`" (Component 1) and the test (line 245) exercises "missing,
malformed and wrong-version files" — which reads as JSON-parse + version
validation, not shape validation. A file that parses, has `version: 1`, but holds
`attribution: { workspacePath: 42, ... }` would pass `read` and reach
handlePrepare step 4, where `normalizeIdentityPath(a.workspacePath)`
(`git-utils.ts:101`) runs on a non-string and can throw; the throw is caught by
the outer `handlePrepare` try (`review-task.ts:528`), turning the whole prepare
into `success: false` — the opposite of EH #3's "succeeds." The atomic writer
cannot itself produce such a file (rename is all-or-nothing), so the trigger is
manual tampering or an external writer; that is why this is MINOR. But the design
should either say `read` validates the record *shape* (not just version) before
returning it, or that step-4 comparisons tolerate a non-string field.

### R2-4 — MINOR — Novel — `isAncestorOfHead` reports a git-infrastructure error as "base not an ancestor / rejected," emitting a false `head-degraded` note

`isAncestorOfHead` is "true only on exit 0" (line 60). `runGit` returns
`ok: false` on *any* `err`, including ENOENT (no git binary) or a spawn error —
not only exit 1/128. So when git is broken, `isAncestorOfHead` returns `false` and
handlePrepare step 2 yields `head-degraded`, whose `detail` (Data Models line 213)
states: "The recorded base `<sha>` is not an ancestor of HEAD in this workspace
and was rejected." That is a false claim — ancestry was never checked; git
failed. `computeTaskDiff` then also fails on the same broken git and returns
`rejected`, so the reviewer receives two different explanations for one root
cause (a misleading "base rejected" note plus a truthful "git diff failed"
rejection). D4 ("any non-zero exit … is 'not validated'") reasoned about *exit
codes*, not about the spawn failing to run at all. Narrow (needs a recorded base
plus git broken at review time), hence MINOR; fix by having `isAncestorOfHead`
distinguish "git did not run" from "exit 1/128" so a spawn failure does not
masquerade as a base rejection.

## Failure paths checked that are sound (no finding)

- **Typecheck killed mid-run.** `run.timedOut` → `{status: 'timeout'}`
  (`typecheck.ts:193-197`); handlePrepare synthesizes the `observed` sentence for
  `timeout` (Data Models line 215), so no missing-`observed` compile gap — the
  required-`observed` rule is on the `unavailable` arm only, and `timeout` is a
  separate status. An external SIGKILL lands on the `no-parseable-output` arm
  (`:217-222`). Both degrade as stated.
- **Lock `acquired: false`.** `withRegistryLock` retries EEXIST for up to
  `DEFAULT_LOCK_TIMEOUT_MS = 5000` (`registry-lock.ts:14`), then returns
  `{acquired:false, reason:'timeout'}`. Writer warns and drops its write; the base
  falls back to `head-expected`, attribution to `unknown` — degraded-safe. The
  two writers touch different fields under one lock, so a serialized
  read-modify-write keeps both (Testing Strategy line 245 covers it).
- **Interrupted write, read side.** `rename` is atomic; `read` takes no lock and
  sees the file complete or absent, never torn, never ENOENT mid-swap. The
  design's claim holds. (Only the *orphaned temp* is the issue — R2-2.)
- **Every `unavailable` reason carries `observed`.** Construction sites and the
  `observed` table were verified sound in round 1; unchanged in the delta.

## Top 3 risks / gaps

1. **R2-1** — an unbounded git spawn with no timeout on the interactive status
   route and the prepare path; a hang has no degraded outcome and no Error
   Handling entry.
2. **R2-2** — the atomic-write temp/stale files are not gitignored and can be
   committed into the tracked spec store; Error Handling omits the
   store-write-throws path.
3. **R2-3 / R2-4** — edge-case honesty gaps: a shape-malformed record can flip
   prepare to failure (contradicting EH #3), and a broken-git error is dressed up
   as a base rejection.

## Top 3 conclusions to challenge

1. **"the response (`:1469-1473`) is identical on every arm" (Component 6).**
   Reverse to: "…on every arm where the git spawn returns." A hung
   `readHeadCommit` yields no response. Bound the spawn or record after replying.
2. **"the server writes no user `.gitignore`" / runtime records are not committed
   (D19).** Only half-true: the specified pattern covers the record and lock but
   not the temp/stale files the same machinery emits into a tracked directory.
3. **EH #3 "malformed … succeeds."** Holds for JSON/version corruption; a
   shape-valid, wrong-typed record instead throws and fails the whole prepare.
   The delta (R1-1/R1-2) and the encoding choice all survive re-probing.

## What's missing before acting

- Give `runGit` (or the two new spawns) a bounded timeout and state the status
  route's await/fire-and-forget choice, then add the hang path to Error Handling.
- Widen the gitignore entry to a glob covering `.tmp`/`.stale`; state the store
  write-failure and temp-cleanup behaviour.
- Say whether `read` validates record shape, and whether step-4 comparisons and
  `isAncestorOfHead` tolerate a non-string field / a git-run failure.

## Verdict block

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```

`converged` requires SHOULD_FIX = 0; R2-1 and R2-2 keep the loop alive.
