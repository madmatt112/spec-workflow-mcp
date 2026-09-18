# HANDOFF

> **READ FIRST — SDD routing (2026-09-18, harness v4).** Active spec **`worktree-review-signals`**.
> Live phase **implementation**, state **tasks 0/12**, last result **approved (tasks v1; gate B approved by the human, slot deleted)**.
> Roots: spec store `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`, code `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/worktree-review-signals` (worktree of `/home/mcf/repo/spec-workflow-mcp`, branch `feat/worktree-review-signals`).
> A re-run does: from the worktree, spawn the implementation orchestrator `MODE: normal` on the 12-task queue (gate B already resolved, `present: false`). Orchestrators run on claude-opus-4-8 high.

Rolling state for the SDD loops. The implementation loop updates this at its completion gate; the document loop updates it when a spec's documents converge.

## Phase log

| Date | Spec | Stage | State | Result | Note |
| --- | --- | --- | --- | --- | --- |
| 2026-09-16 | question-gates | requirements | v4 | approved | 4 rounds, 1/4/4 -> 1/2/3 -> 0/3/1 -> SHOULD_FIX-only pass VERIFIED 3/3 |
| 2026-09-16 | question-gates | design | v3 | approved | 3 rounds, 0/4/2 -> 0/3/2 -> SHOULD_FIX-only pass, narrow check VERIFIED 3/3 |
| 2026-09-17 | question-gates | tasks | v2 | approved | 2 rounds, 0/2/3 -> converged |
| 2026-09-17 | question-gates | implementation | tasks 6/6 | complete | 6/6 gate-pass risk low, PR #46 checks green, e2e tool half verified, live gates deferred d-1880d115 |
| 2026-09-17 | question-gates | retrospective |  | retro-ready |  |
| 2026-09-17 | question-gates | closeout | items 0/5 | error | worktree-isolation launch mismatch; relaunch isolated to question-gates-retro |
| 2026-09-17 | question-gates | closeout | items 5/5 | closed | 5/5 landed; PR #47 open not merged; runtime verify deferred d-473aa261/d-1880d115 |
| 2026-09-17 | worktree-review-signals | requirements | v1 | interrupted | fresh-v1 override: stale split scaffold, orient said Step 2 |
| 2026-09-18 | worktree-review-signals | requirements | v3 | approved | 2 rounds, iterate then converged |
| 2026-09-18 | worktree-review-signals | requirements | v2 | interrupted |  |
| 2026-09-18 | worktree-review-signals | design | v3 | approved | 2 review rounds + SHOULD_FIX-only pass + narrow check, 0/1/1 -> 0/2/2 -> VERIFIED 2/2 |
| 2026-09-18 | worktree-review-signals | tasks | v1 | approved | 1 round, converged clean |

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

## question-gates — requirements

| Field | Value |
| --- | --- |
| State | approved at v4 on 2026-09-16 |
| Rounds | 4; verdicts 1/4/4 -> 1/2/3 -> 0/3/1 -> SHOULD_FIX-only pass, narrow check VERIFIED 3/3 |
| Approval | `approval_1789592305465_kil5tyx1t` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | requirements.md, then the gate-A/gate-B server-surface and AskUserQuestion `{header, question, options}` contracts it pins, src/core/gate-rules.ts and src/tools/review-gate.ts, and decomposition spec 7 (steering docs absent, so the decomposition entry is the scope authority) |

## question-gates — design

| Field | Value |
| --- | --- |
| State | approved at v3 on 2026-09-16 |
| Rounds | 3; verdicts 0/4/2 -> 0/3/2 -> SHOULD_FIX-only pass, narrow check VERIFIED 3/3 |
| Approval | `approval_1789598861550_cv4ve6r44` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | codebase-context.md, then design.md — the `gate` action ops (class-a / put / get / delete) on src/tools/harness.ts, the new pure module src/core/veto-rules.ts, the gate-A drafter-extraction surface and the gate-B `[gate-b:...]`/`[gate-c:...]` tagged-finding surface, and the AskUserQuestion `{header, question, options}` contract; decomposition spec 7 is the scope authority (no steering docs). Two MINOR design gaps remain open in adversarial-analysis-design-r2.md (R2-4 harness/ plugin-asset checks in Testing Strategy; R2-5 class-a input hygiene) for the tasks phase to weigh. |

## question-gates — tasks

| Field | Value |
| --- | --- |
| State | approved at v2 on 2026-09-16 |
| Rounds | 2; verdicts 0/2/3 -> converged |
| Approval | `approval_1789603132726_81g3nqajw` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | codebase-context.md, then tasks.md — a 6-task forward-only plan (no bridges): task 1 adds pure src/core/veto-rules.ts (computeClassA), task 2 adds the harness `gate` action (class-a/put/get/delete) to src/tools/harness.ts, tasks 3-6 are harness/ prose (formats.md PHASE `gate-a`, sdd-drafter.md gate-A extraction, document-phase SKILL gate-A/gate-B emission, sdd-continue SKILL gate execution) with `sync-plugin-assets` + `check:plugin-assets` + `claude plugin validate` in each Success. design.md v3 (its Component 5 was amended in place — see design.md's `v3 amended` line — for Req 2 AC 7's resume recheck) and requirements.md v4 are the scope authority; no steering docs. Both open design MINORs are closed: R2-4 by tasks D3, R2-5 by tasks D2. Run-level verification (four gate scenarios with/without AskUserQuestion + `npm run build`/`npm test`) is the gate, not an automated task (D6). |

## question-gates — implementation

| Field | Value |
| --- | --- |
| State | implemented 2026-09-16; tasks 6/6; last code commit 6507cad |
| Fix rounds | none — all six tasks passed the gate at risk low (0 fix rounds, 0 adjudications, 0 task verifiers) |
| Deferred verification | d-1880d115 |
| Deferrals added | 1 (d-1880d115, tag verification); project total 15 deferred |
| Gotchas | Harness/server changes take effect only after the release republishes and the plugin re-installs, so live gate scenarios 1-4 are deferred to d-1880d115 (tool half verified in-process: build + 1260 tests + plugin validate all green, fixture staged at /tmp/scratchpad/sdd/question-gates/scratch-store/). The `harness` orient/brief MCP tool was not granted to this orchestrator, so Step 0 and every worker brief were assembled by hand — same root cause as d-473aa261. |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/46 |

## question-gates — closeout

| Field | Value |
| --- | --- |
| State | CLOSED 2026-09-17; 5/5 items landed (P1, P2, P3, P4, P6), 0 to-do, 0 skipped |
| Items | P1 a26f246, P2 82064d8, P3 478bf4f, P4 0542178, P6 8156c82 — all harness prose; gate pass risk low; no verifier, no fix rounds, no adjudication |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/47 (branch `chore/question-gates-retro`) — NOT merged |
| Graduation | Candidates 1-4 promoted with their proposals; candidate 1 (an orchestrator that calls the harness tool must allowlist it) codified in `docs/SDD-HARNESS.md` |
| Spec store | Bookkeeping committed on `main` (plan CLOSED, retro-log, ledger); code changes ride PR #47 |
| To-do (human) | 1) Merge PR #47. 2) The harness prose takes effect only after a release republishes and the plugin re-installs (rides the question-gates release, `d-1880d115`). 3) After re-install run `deferrals list tag=verification` and clear `d-473aa261` (P2/P3 runtime: orchestrator reaches the harness tool; one run id per run) and `d-1880d115` (live gate scenarios 1-4). |
| Gotcha | This close-out orchestrator still lacked the `harness` MCP tool (exactly what P2 fixes), so Step 0 and the worker brief were the hand-assembled ones the prior spawn staged; this resolves once #47 releases and re-installs. |

## worktree-review-signals — requirements

| Field | Value |
| --- | --- |
| State | approved at v3 on 2026-09-18 |
| Rounds | 2; verdicts 2/2/0 (r1) → converged 0/0/2 (r2) |
| Approval | `approval_1789751201977_4rubgz93s` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | design drafter reads `codebase-context.md`, then this spec's `requirements.md` and the decomposition entry; tech.md/structure.md/design-system.md |

## worktree-review-signals — design

| Field | Value |
| --- | --- |
| State | approved at v3 on 2026-09-18 |
| Rounds | 2 review rounds + narrow check; verdicts iterate 0/1/1 (r1) → iterate 0/2/2 (r2) → SHOULD_FIX-only pass → narrow check VERIFIED 2/2 |
| Approval | `approval_1789762159323_qb9brmb19` |
| Rulings | D11 (R4 AC5 — `feature-disabled` emits no degraded note): refinement, closed. D3 (R1 AC11 — `diffBase.commit` is the ref `HEAD`, not a sha): refinement, closed. |
| Cut scope | none |
| Carried items | none |
| Deferred | R2-3 (malformed→null underspecified: a shape-valid, version-1 record with a wrong-typed field can reach the consumer and throw, vs EH #3) and R2-4 (`isAncestorOfHead` reports a git-infra error as `rejected`, emitting a false `head-degraded` note) — both MINOR, left out of the SHOULD_FIX-only pass. See deferrals tag `worktree-review-signals`. |
| Next phase loads | tasks drafter reads `codebase-context.md`, then this spec's `design.md` and `requirements.md`, and the decomposition entry for `worktree-review-signals`; `structure.md` if present |

## worktree-review-signals — tasks

| Field | Value |
| --- | --- |
| State | approved at v1 on 2026-09-18 |
| Rounds | 1 review round; verdict converged 0/0/3 (r1) |
| Approval | `approval_1789764667108_pozu2vt3a` |
| Rulings | none |
| Cut scope | none |
| Carried items | none |
| Next phase loads | implementation reads `codebase-context.md` first, then `tasks.md`; 12 tasks, leaf-first order, task 3 carries a `'HEAD'` bridge removed in task 8 |

## worktree-review-signals — implementation

| Field | Value |
| --- | --- |
| State | tasks 4/12 |
| Last code commit | 5268970 (task 4) |
| Next task | 5 — Add the no-files diff state and its methodology constants |
