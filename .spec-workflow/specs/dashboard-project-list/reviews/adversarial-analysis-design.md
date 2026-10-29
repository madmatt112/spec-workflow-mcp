# Adversarial Analysis — dashboard-project-list/design (v1), Round 1

First review of the design. Primary surface: feasibility, consistency, edge cases.
Fresh lens: none specified. All findings are Novel (round 1).

## What I checked and how

I read the design against the requirements, the decomposition entry (spec 28), the
codebase-context, and the cited code. I verified the lint-changed citations (the whole
`## Changes since` section) and every load-bearing artifact:

- **C1 git-utils** — `gitCapture` (`src/core/git-utils.ts:64-71`), timeout (`:7-11`),
  `isGitWorktree` (`:260-270`), `gitCommonDirAbsolute` (`:133-139`),
  `normalizeIdentityPath` (`:101-112`), `resolveGitRoot` (`:214-252`): all accurate.
- **C3 project-manager** — `syncWithRegistry` (`:134-176`), `addProject`/remember-equal-paths
  (`:181-256`, `:240-249`, catch `:246-248`), `getProjectsList` (`:301-313`),
  `addProjectByPath` explicit-root re-add (`:364-372`), `removeProjectById` (`:389-393`),
  durable test `:84`/`:87` (now 2)/`:115` (now `[id]`): all accurate.
- **C4/C5** — `cleanupStaleProjects` (`:474-504`, dead-pid loop `:479-496`), `lockPath`
  exists (`:144`,`:150`), `withRegistryLock` returns `acquired` (`registry-lock.ts:371-412`),
  `projectsPath` (`:302-304`), `readProjects`/`writeProjects` (`:451-457`), `writeJsonAtomic`
  (`:318-323`): accurate. `cleanupStaleProjects` is called only at `project-manager.ts:41`
  (start-only holds); no reentrancy with `registerProject`'s lock.
- **C7** — `CLI_FLAGS` (`:164-177`), help OPTIONS (`:37-65`), `parseArguments` (`:206-221`),
  boolean `=value` rejection (`:240-245`), `initialize` block (`server.ts:185-195`), `stop`
  guard (`:289`), `runCases` inline args (`runner.ts:190-197`): accurate. `tsx ^4.7.0` is a
  devDependency; `dev: tsx src/index.ts` confirmed.
- **C8/C9** — `flush` reads waits/runs (`shell-feed.ts:103-115`), per-project spec rows
  (`:94-101`), skip-log (`:98-100`), `CTRL_LIVE_STATUSES` literal (`NowPage.tsx:27`) ==
  design's `NOW_LIVE_STATUSES`, live-run parity (`NowPage.tsx:257-264`): all accurate.
- **Probe** — installed `vitest 4.0.16`, `typescript 5.9.3` match the cited probe exactly;
  `node16` resolution (`tsconfig.json:4-5`) and frontend exclusion (`:20`) confirmed; TS2835
  on extensionless frontend imports is consistent with node16. Accepted.

No misstated artifact found. MUST_FIX = 0.

## Topics attacked

### 1. The new integration test's start/stop synchronization (Testing Strategy › Integration)

- **Challenge the claim that the test "waits for the registration log line."** At base
  (red-first) the real server logs `Project registered: …`; after the fix `runCases` appends
  `--no-register`, so C7 makes the server log `Project registration skipped (--no-register)`
  and emit no registration line at all. A test that waits for the registration line passes
  red at base and then **hangs/times out once green**. The synchronization point must be a
  signal present in both states (either line, or process-ready / clean exit).
- **Stress-test the node-20 contract.** Agent-rules require a child_process/stream test to
  "assert only on fields the node 20 docs guarantee, and the design says which." This test
  spawns `tsx src/index.ts`, reads stderr for a line, and closes stdin to trigger
  `process.stdin.on('end')` → `stop()` (`server.ts:234`). The design states no node-20
  behaviour it relies on, and CI runs node 20.
- Otherwise the byte-equal-before/after assertion is sound: with `--no-register` the server
  writes neither the registry (registration skipped) nor `projects.json` (the MCP server
  never writes it; only the dashboard's project-manager does).

### 2. Synchronous git classification on the un-debounced watcher reconcile (C3, C1, D12)

- **Challenge the feasibility of running `linkedWorktreeInfo` in `syncWithRegistry`.** The
  chokidar registry watcher calls `syncWithRegistry()` directly on every `change`/`add`
  with no debounce (`project-manager.ts:115-121`). The design adds synchronous `execSync`
  git classification (`gitCapture`, 5000 ms timeout) per differing-path candidate into that
  reconcile. Today `syncWithRegistry` makes zero git calls.
- **Stress-test the spec's own motivating scenario.** The decomposition's driver is "the
  sidebar gets messy *as runs start up*" — i.e. a burst of registry writes. Each write now
  fires a full reconcile that **blocks the dashboard event loop** on one git call per
  differing entry (up to 5 s each on a slow/hung git or a git lock), serialized (C3) so
  concurrent events queue and re-run the whole classification pass. The design addresses
  neither event-loop blocking nor coalescing.
- **Challenge D12 as scoped too narrowly.** D12 ("no cache, one git call per differing entry
  per sync") answers *cost per sync*, not *the number of syncs* nor the blocking primitive.
  A debounce/coalesce on the watcher, or within-burst memoization, is the missing piece.

### 3. The `withProjectsLock` contract change for `forgetProject` (C5, Error Handling #3)

- **Challenge "Signatures unchanged."** The signature is unchanged but the *exception
  contract* is not: `forgetProject` now runs inside `withProjectsLock`, which throws when the
  lock is not acquired. Today `forgetProject` is unlocked and cannot fail on a lock.
- **Stress-test `removeProjectById` (`project-manager.ts:392`).** It calls
  `unregisterProjectById` then `forgetProject`, uncaught. Under lock contention the DELETE now
  answers 500 with the registry entry already removed but the project still in `projects.json`
  → the "removed" project **reappears on the next sync** (it is remembered). Error Handling #3
  covers `rememberProject`'s throw but not this symmetric path.

### 4. Representative consistency across server (C8) and frontend (C10/C12) — fine

- C8 picks the representative by `originalProjectPath == workflowRootPath` then projectName
  then projectId; C10 uses `projectPath` (== server `originalProjectPath` via
  `getProjectsList`) with the same tiebreak. Spec-row `projectId`, group title, and
  `storeOf` keying all agree. No defect.

### 5. Folding edge cases — fine

- AC9 separate-store main checkout: differing paths → classify runs → common-dir is `.git`
  → not linked → keeps its row and may be a parent. Correct.
- Two worktrees, no main (R1 AC3, `worktree-shared.spec.ts:370-414`): no parent has
  workspace == store → no fold → listed. Correct.
- Fold never chains: parents drawn only from non-linked entries (C2 §2). Correct.
- Deleted-workspace live server (Error Handling #6): prune removes whatever the pid; later
  `stop()` finds no entry (`project-registry.ts:421-425`). Correct.

## Top 5 risks/gaps

1. **(SHOULD_FIX)** Integration test synchronizes on a "registration log line" that the fix
   deletes → the green test hangs; and its node-20 child_process/stream contract is unstated
   (agent-rules). [Topic 1]
2. **(SHOULD_FIX)** Un-debounced watcher reconcile now runs blocking `execSync` git calls per
   differing entry; a run-startup burst can freeze the dashboard event loop up to 5 s × N.
   [Topic 2]
3. **(SHOULD_FIX)** `forgetProject`'s new throw-on-lock contract is uncaught in
   `removeProjectById`: a contended manual delete returns 500 and the project reappears on the
   next sync. [Topic 3]
4. **(MINOR)** C1 "Reuses: the existing common-dir handling; no new git command" is imprecise
   — to get both the raw `.git` test and the normalized parent from one call, the function
   must reimplement `isGitWorktree`/`gitCommonDirAbsolute` logic inline, not call them.
5. **(MINOR)** Data Models tags both wire shapes "illustrative — verify against the test
   fake"; fields are enumerated and correct, so the hedge only weakens an otherwise pinned
   contract.

## Top 3 conclusions to challenge or reverse

1. **"C9 lives on the server, proved by an integration/e2e that starts a real server."** The
   chosen proof (spawn real server, wait for a log line, close stdin) is the least portable
   part of the plan and, as written, cannot be both red at base and green after the fix.
   Reverse to: synchronize on a signal invariant across the flag (ready/exit, or either log
   line) and pin the node-20 behaviours relied on.
2. **D12 "no classification cache."** Correct for per-sync cost, but it leaves the real
   exposure — a blocking, un-coalesced reconcile on a write burst — unanswered. Add a debounce
   or within-sync memoization rather than reversing D12's per-path cache verdict.
3. **"Signatures unchanged" for remember/forget under the lock.** Reverse the implied claim
   that behaviour is unchanged: the failure surface widens, and `removeProjectById` must
   decide whether a lock miss is best-effort (log, succeed) or fatal (500).

## What's missing before acting

- A debounce/coalesce decision for the watcher-driven reconcile, and a statement that git
  classification runs on the event loop synchronously with a bounded 5 s worst case per entry.
- The integration test's exact startup/shutdown signal and its node-20-guaranteed fields.
- `removeProjectById`'s behaviour when `forgetProject`'s lock is not acquired.

## Verdict block

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
