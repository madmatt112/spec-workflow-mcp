# HANDOFF

Rolling state for the SDD loops. The implementation loop updates this at its completion gate; the document loop updates it when a spec's documents converge.

## Current state — 2026-08-04

**Both active specs are COMPLETE.** `worktree-execution-context` 19/19 and `tighter-reviews` 29/29, each with end-to-end verification passed and INDEX regenerated. There is no active spec left in the roadmap.

### `tighter-reviews` — what closed it

Its three remaining "tasks" (5, 8, 16) were container headers whose sub-tasks were already `[x]`. Verifying that the children genuinely delivered each parent found 8 and 16 covered, but **task 5's 5.3 half was inert**, and the end-to-end gate failed on it before passing on a re-run.

The defect, now fixed and resolved as `d-ae7cc6cf`: `tsc` prints diagnostic paths **relative to its spawn cwd**, but `postProcess` realpathed that relative string against the **server** process cwd, so `inScope` was `true` only when the two coincided — structurally impossible once the workspace points at a worktree. Every diagnostic came back `inScope: false`, and R4.4 then told the reviewing agent to treat task-introduced type errors as upstream context not to be filed. Fixed by anchoring parsed paths to `workspacePath` (commit `1e7d08a`).

**Two things worth remembering from it:**

- **It predated the worktree work** — reproduced at `047d20b`. `worktree-execution-context` removed the coincidence that hid it; it did not cause it.
- **Its coverage was fictitious.** The tests mocked `execFile` and hand-built diagnostic headers with absolute paths real `tsc` never emits, so the parser was only ever fed input the compiler does not produce. 942 tests passed over a behaviour that never worked. The mocks now use the relative form and two tests spawn the **real** compiler from a cwd asserted `!== workspacePath`; reverting the anchor fails six tests.

A knock-on: the 100-diagnostic cap's in-scope-first ordering had been dead code while every diagnostic was `inScope: false`. It is live now, and verified against 130 out-of-scope plus 20 in-scope diagnostics.

Minor artifact: `spec-status` warns that tasks 8 and 16 are complete without implementation logs. They are container headers — their children carry the logs. Harmless.

### Verification result

Six scenarios from the decomposition entry, all verified independently against a hand-built two-worktree fixture rather than only through the committed suite:

1. Two worktrees appear as distinct projects sharing one spec list; simultaneous start keeps both — **with a caveat, see below**
2. A review from worktree A diffs A's files and typechecks A's tree, asserted on the compiled file list
3. Bare relative logged paths produce a non-empty diff from a worktree
4. An adversarial review locates its target on the shared root while running in the worktree
5. An all-drop review reports no reviewable files and does not return a pass
6. Non-worktree parity holds — file sets, containment, `tsconfigPath` and `projectId` byte-identical to pre-change

Check suite: `npm run build` exit 0; `npm test` 942 passed / 2 skipped; `npm run test:e2e:worktree` 9 passed across **both** suites (`worktree-no-shared.spec.ts` 3, `worktree-shared.spec.ts` 6).

**Scenario 1's caveat.** The registry is correct and the lock holds, but a *live* dashboard shows only one of two simultaneously-started projects and never recovers. This reproduces at pre-spec commit `743192b` with two plain non-worktree projects, so it is a **pre-existing chokidar watcher defect, not caused by this spec** — recorded as `d-4ee04d64` and owned by `worktree-dashboard-concurrency`. The e2e scenario asserts the registry file, so it does not catch it.

### Known pre-existing failure, unrelated to this spec

`e2e/batch-approvals.spec.ts` — 8 failures, confirmed failing identically at `914e513` and earlier (no dashboard backend / no seeded approvals). This spec added no new e2e failure.

## Commits

Nine commits on `main`, all with a green build:

| Commit | Contents |
|---|---|
| `119c20d` | Tasks 1-5 — fixture, parity baseline, git primitives, registry lock, two-root resolution |
| `2f1790a` | Task 6 — `ToolContext.workspacePath` required |
| `6d6b7e0` | Task 7 — runner contracts split, four route sites wired |
| `66cbfea` | Tasks 8-9 — `GIT_*` scrub, `resolveLoggedFiles`, `validateAllFiles` deleted |
| `03c865c` | Tasks 10-11 — resolver wired in, typecheck root split |
| `1ce8001` | Tasks 12-13 — all-drop disclosure, diff containment rejection |
| `97068be`, `587eaf0` | Task 14 — `selectRoots` and its ledger-bound coverage |
| `914e513` | Task 15 — identity normalization, unregister by cached id |
| `1fd0dc4`, `4d7c9ca` | Tasks 16, 16.1 — e2e harness rewrite and five shared-mode scenarios |
| `33c5531` | Tasks 17-18 — regression coverage, docs, 5.0.0 |

Version is **5.0.0** across `package.json`, `package-lock.json` and all three plugin manifests; `check:plugin-version` passes. Not tagged or published — that is a release step.

## Roadmap — what comes next

| # | Spec | State |
|---|---|---|
| 1 | `worktree-execution-context` | **Complete** — 19/19 |
| 2 | `tighter-reviews` | **Complete** — 29/29 |
| — | `worktree-review-signals` | Deferred; unblocked. Scope record only — needs its own requirements phase |
| — | `worktree-dashboard-concurrency` | Deferred; unblocked. Scope record only — needs its own requirements phase |
| — | `approval-durability-and-routing` | Deferred; independent of the worktree specs. Scope record only |

**The roadmap has no active spec.** Every spec in the active table is complete, so `sdd-router.md` will report "SDD roadmap complete — no active spec" and exit. Advancing requires **undeferring** one of the three (`spec-index` action `undefer`), which then routes to the document loop's Requirements phase.

All three are scope records only and each needs a requirements phase before it can be built. Inherited deferrals to feed into those phases:

- `worktree-review-signals` — `d-6e59490b` (diff state never reaches the dashboard-spawned reviewer), `d-a2233b94` (TOON responses cannot be decoded), and the disclosure-channel halves of `d-f3cb6fd8`
- `worktree-dashboard-concurrency` — `d-e5331af0` (only `registerProject` is locked), `d-3580c072` (deleting `SPEC_WORKFLOW_HOME` kills the registry watch), `d-4ee04d64` (closely-spaced registrations missed via the renamed inode), `d-84dc43e7` (worktree e2e suite not idempotent across repeat runs — plausibly the same watcher/global-directory root cause as the other two, worth resolving together)

## Deferrals

From the documents phase:

- `d-0829d1e3` — dashboard repo-grouping UI (backend duplication handled by spec 3's R10)
- `d-75761c78` — concurrent agent edits to a shared `tasks.md` are unprotected; needs a task-status MCP tool
- `d-0b7bb0cc` — `isProcessAlive` cannot verify PIDs under Docker path translation
- `d-f3cb6fd8` — two read-every-file instructions survive the all-drop guard, byte-pinned across a spec boundary

From implementation:

- `d-2124a571` — vitest workers never emit process `exit`, so temp-dir teardown needs an explicit `afterAll`
- `d-e5331af0` — the registry lock covers `registerProject` only; `unregisterProject`, `unregisterProjectById` and `cleanupStaleProjects` remain unlocked, so concurrent shutdowns can lose a removal the way concurrent starts could lose a registration
- `d-bbad43e4` — `design.md:110` calls `ToolContext.workspacePath` an untranslated host path; it is translated. The code comment is corrected and names the document as wrong
- `d-6e59490b` — diff state never reaches the dashboard-spawned reviewer's prompt, so task 13's rejection wording arrives only on the direct-call path
- `d-3580c072` — deleting `SPEC_WORKFLOW_HOME` while the dashboard runs permanently kills its registry watch
- `d-4ee04d64` — the dashboard misses closely-spaced registrations because `writeRegistry` renames a new inode over the watched file. **Confirmed pre-existing** — reproduces at `743192b` with plain non-worktree projects
- `d-a2233b94` — TOON responses from `review-task` and `adversarial-review` cannot be decoded by the library that encoded them

## Things worth carrying forward

- **Hand-written site lists came up short in seven separate places** across this spec — `execSync` sites, `BOOLEAN_FLAGS`, `process.env` sites, typecheck root uses, and more. Every one was caught by the `grep`/`tsc` enumeration the task text mandated instead. Keep putting the enumerating command in the task, not the count.
- **A correct implementation with no swap-detecting test is the recurring failure.** Task 7 shipped correct code that left all 825 tests green when both roots were swapped, because every fixture used equal roots. Reviews that mutate rather than read caught this repeatedly — it is worth the cost.
- **Raw NUL bytes make a file read as binary**, and `grep -rn` then silently skips it. One test file had this; it would have hidden itself from the enumeration contract every later task relied on.
- `src/__tests__/parity-baseline.test.ts` was the regression net throughout. Its one reserved edit — the symlink `projectId` case — was spent by task 15 and the file records it.
- `src/__tests__/index-entrypoint.test.ts:18` leaks a `/tmp/specwf-entrypoint-*` directory per run. Pre-existing, tracked since `1191755`, unfixed.
- Untracked `playwright-report/` and `test-results/` are left by e2e runs and are not gitignored.
