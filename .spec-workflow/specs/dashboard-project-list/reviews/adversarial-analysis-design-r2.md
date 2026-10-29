# Adversarial Analysis — dashboard-project-list/design (v2), Round 2

Primary surface: feasibility, consistency, edge cases. Fresh lens: none (per prompt).
Deltas attacked first (R1-1/R1-2/R1-3/R1-4/R1-5 fixes), then a fresh pass over the
integration-test seam.

## Fix-induced re-checks (scoped to the v2 diff)

All three accepted SHOULD_FIX fixes were re-checked against the code and the requirement
they satisfy. Each fix is correctly applied; none introduced a regression in its own clause.

- **R1-2 (debounce) — clean.** Watcher handlers (`project-manager.ts:115-121`) are
  `change`/`add` → `syncWithRegistry()` with no existing debounce; adding a 100 ms trailing
  debounce is feasible. `gitCapture` is `execSync` (`git-utils.ts:64-71`) with the 5000 ms
  `GIT_EXEC_OPTIONS` timeout (`:7-11`), so D12's "blocks the reconcile up to 5000 ms per
  differing candidate" is accurate. `initialize()` calling the first `syncWithRegistry()`
  directly preserves cleanup→prune→sync→watcher.
- **R1-3 (forget-before-unregister) — clean.** Today's order is
  `removeProject → unregister(391) → forget(392)`. `unregisterProjectById` (`:421-441`)
  takes **no lock** and only writes if the entry exists, so it cannot contribute a lock-miss
  throw. `forgetProject` wrapped in `withProjectsLock` (contract like `withStoreLock`,
  `state.ts:559-570`, which throws when `!acquired`) throws *before* any write. Placing it
  first therefore does leave both files whole on a lock miss, and Error Handling #3's claim
  "never a registry-removed but still-remembered entry" holds.
- **R1-1 (integration-test signal) — fix applied, but a second defect in the same seam
  survives; see R2-1.** `server.ts:195` logs `Project registered: <id>` to stderr (via
  `console.error`); `:234` is `process.stdin.on('end')` → `stop()` → `exit(0)`. Waiting for
  either startup line is sound and both are stderr lines.

## Topics attacked

### 1. The integration test's red-first integrity is erased by the shutdown unregister (Testing Strategy › Integration)

- **Challenge the claim "At base the args lack the flag, the server registers the fixture,
  and the test fails."** The design's stated sequence is: wait for startup line → *end the
  child's stdin and wait for exit 0* → *then* assert the registry is byte-equal to before.
  At base, `stop()` runs on the stdin-`end` path and calls
  `unregisterProjectById(registeredProjectId, pid)` (`server.ts:289-290`), which deletes the
  only instance and rewrites the registry (`project-registry.ts:421-441`). So a clean
  start/stop at base **registers on start and unregisters on stop** — the registry map
  returns to its pre-registration contents before the assertion runs. The registration write
  the design points to as the red signal has been reversed by the time byte-equality is
  checked.
- **Stress-test the actual red/green discriminator.** Whether the test is red at base now
  depends entirely on whether the per-worker registry *file* pre-existed: if it was absent,
  register→unregister leaves an empty-map file (not byte-equal to "absent") → red by
  accident; if it already existed (prior write in the worker home), register→unregister
  round-trips to identical bytes → **green at base**, and the red-first gate proves nothing.
  The design states no such precondition, so the gate is fragile and its stated cause is
  wrong.
- **Direct the fix:** snapshot/assert the registry (and `projects.json`) *while the server
  is alive* — after the startup line, before closing stdin — not after exit. The red signal
  (an entry present at base, absent after the fix) must be observed before shutdown reverses
  it. Alternatively assert the registry gains the fixture entry at base vs. gains nothing
  after the fix.
- **Side note (MINOR):** the `projects.json` half of the byte-equal assertion discriminates
  nothing in either state — the MCP server never writes `projects.json` (only the dashboard's
  `rememberProject` does, and the dashboard is not running in this `runCases` test), so that
  file is unchanged at base *and* after the fix. It is a harmless but inert assertion.

### 2. `removeProjectById` new body leaves the in-memory list unspecified on a forget throw (C3)

- **Challenge the completeness of the C3 `removeProjectById` bullet.** It describes
  forget → unregister → `syncWithRegistry()` but is silent on the current first line,
  `await this.removeProject(projectId)` (`:390`, the in-memory context + watcher removal).
  If that call is kept ahead of `forgetProject`, a lock-miss throw leaves the files whole
  (as claimed) but the in-memory project already removed and not re-added until the next
  watcher-driven sync — the DELETE answers 500 yet the sidebar transiently drops the row.
  If instead the design intends `removeProject` to be dropped (the trailing
  `syncWithRegistry()` reconciles in-memory), say so. As written the new body is ambiguous
  at exactly the point the fix is meant to make clean. MINOR.

### 3. Rechecked clean (no new defect)

- **Representative / store-key consistency (C8/C10/C11/C12):** spec-row id = representative
  id, group/selection keys = `<store>::…`, `storeOf` keys on `workflowRootPath`; all agree.
  Unchanged in substance by the v2 concision edits.
- **Run attribution to the parent:** the e2e seeds the run with the main project's id, and
  runs are launched under the main id while the worktree folds; `buildSidebarRows` counts
  runs by the listed (parent) id, so the live-run dot/count on the parent is consistent.
  (A run launched *directly under a worktree id* that then folds would be invisible, but that
  is adjacent to the explicitly deferred "server instances on the parent row" and not a
  requirement here.)
- **Data Models:** both wire objects (`Project-list item`, `SidebarProjectRow`) are fully
  field-enumerated; no union-only shapes. The R1-5 hedge removal is correct.
- **Library-capability claims in the delta:** none new beyond the R1-verified
  `tsx`/`vitest 4.0.16`/`tsc 5.9.3` probe and `execSync` timeout.

## Top 3 risks/gaps

1. **(SHOULD_FIX, Compounding R1-1, carried)** The new integration test asserts registry
   byte-equality *after* the server has exited; at base the start-time registration is
   reversed by the shutdown unregister, so the test's red-first signal is fragile/incorrect —
   it can be green at base when the per-worker registry file pre-exists, making the R3
   AC1/AC2 / R7 AC2 gate inert. Assert while the server is alive. [Topic 1]
2. **(MINOR)** C3's `removeProjectById` bullet omits the fate of the in-memory
   `removeProject(:390)` call; on a `forgetProject` lock-miss the files stay whole but the
   in-memory row may drop until the next sync. Pin the full new body. [Topic 2]
3. **(MINOR)** The integration test's `projects.json` byte-equal assertion is inert (the MCP
   server never writes that file in this test) — it neither reds at base nor greens after the
   fix. [Topic 1 side note]

## Top 3 conclusions to challenge or reverse

1. **"the server registers the fixture, and the test fails" (red-first).** Reverse the
   implied mechanism: the registration is undone by the shutdown unregister before the
   assertion, so registration is not what makes (or keeps) the test red. Move the assertion
   ahead of stdin close.
2. **R1-3's "both files whole, a clean retry."** Correct for the files, but incomplete for
   the in-memory list if `removeProject` stays first — decide and state it.
3. **The byte-equal-to-before invariant as the R3 proof.** For `projects.json` it is a
   tautology in this test; the real signal lives only in the registry, and only before
   shutdown.

## What's missing before acting

- A one-line statement that the integration test captures the registry (and, if kept, the
  `projects.json`) snapshot while the server is running, so base is red and fixed is green.
- The explicit new body of `removeProjectById` (whether the in-memory `removeProject` call
  survives and where).

## Verdict block

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
