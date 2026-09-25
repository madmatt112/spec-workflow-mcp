# HANDOFF

> **READ FIRST — SDD routing (2026-09-25, harness v4).** Active spec **`graph-orientation`**.
> Live phase **tasks**, state **pending**, last result **approved** (design v1).
> Roots: spec store `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`, code `/home/mcf/repo/spec-workflow-mcp`.
> A re-run does: resumes `graph-orientation` tasks (draft v1, review rounds, then gate B).

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
| 2026-09-18 | worktree-review-signals | implementation | tasks 12/12 | complete | PR #49 checks green; e2e VERIFY pass; 1 deferral added, 2 resolved |
| 2026-09-19 | worktree-review-signals | retrospective |  | retro-ready |  |
| 2026-09-19 | worktree-review-signals | closeout | items 13/13 | closed | 10 done, 3 to-do (PR #49 dep); retro follow-ups on PR #50 |
| 2026-09-19 | harness-usage-and-tiers | requirements | v1 | gate-a |  |
| 2026-09-19 | harness-usage-and-tiers | requirements | v5 | approved | 5 rounds, iterate throughout then cap hit adjudicated, VERIFIED 2/2 |
| 2026-09-19 | harness-usage-and-tiers | design | v3 | approved | 3 rounds, converged via SHOULD_FIX-only pass |
| 2026-09-21 | harness-usage-and-tiers | tasks | v1 | approved | 1 round, converged clean |
| 2026-09-21 | harness-usage-and-tiers | implementation | tasks 8/8 | complete | PR #54 checks green; live orchestrator SubagentStop half deferred as d-3091be1c |
| 2026-09-21 | harness-usage-and-tiers | retrospective |  | retro-ready |  |
| 2026-09-21 | harness-usage-and-tiers | retrospective | plan | approved | 5 items approved (P2, P3-A, P4-A, P5-A, graduation rule 2); P1/P6/P7/P8 accepted no work; graduation rule 1 rejected |
| 2026-09-21 | harness-usage-and-tiers | closeout | items 4/4 | closed |  |
| 2026-09-22 | provider-per-role | requirements | v1 | gate-a |  |
| 2026-09-22 | provider-per-role | requirements | v5 | approved | 4 rounds, cap hit then adjudicated, VERIFIED 2/2 |
| 2026-09-22 | provider-per-role | design | v2 | approved | 2 rounds, iterate→converged |
| 2026-09-22 | provider-per-role | tasks | v0 | interrupted |  |
| 2026-09-22 | provider-per-role | tasks | v5 | approved | 4 rounds, cap hit then adjudicated, narrow VERIFIED 2/2, fix-induced trajectory |
| 2026-09-23 | provider-per-role | implementation | tasks 0/10 | escalate | task 1 DEEPSEEK_API_KEY unset; preflight not run; spec blocked |
| 2026-09-23 | provider-per-role | implementation | tasks 0/10 | interrupted |  |
| 2026-09-23 | provider-per-role | implementation | tasks 10/10 | complete | 10/10 tasks, PR #59 checks green, 1 deferral |
| 2026-09-23 | provider-per-role | retrospective |  | retro-ready |  |
| 2026-09-23 | provider-per-role | retrospective | items 0/15 | APPROVED | plan approved by Matthew: 14 proposals + G1 (6 from overwatch), 8 no-change, 1 rejected; close-out after restart |
| 2026-09-24 | provider-per-role | closeout | items 15/15 | closed |  |
| 2026-09-24 | agent-cache-ttl | requirements | v1 | gate-a |  |
| 2026-09-24 | agent-cache-ttl | requirements | v4 | approved | 3 rounds (2 adversarial + narrow check), 1/2/3 → 0/2/1 → VERIFIED 3/3; Gate A revision applied |
| 2026-09-24 | agent-cache-ttl | design | v1 | approved | 1 round, converged clean (0/0/3) |
| 2026-09-24 | agent-cache-ttl | tasks | v1 | approved | 1 round, converged 0/0/2 |
| 2026-09-24 | agent-cache-ttl | implementation | tasks 9/9 | complete | PR #64 green; scenarios 1/2/3/5 pending for operator |
| 2026-09-25 | agent-cache-ttl | retrospective |  | retro-ready |  |
| 2026-09-25 | agent-cache-ttl | retrospective | APPROVED | retro-ready | plan approved: P2 P3 P7 P8 P9 P10 P14 P15(A) G1 G2; P1 rejected |
| 2026-09-25 | agent-cache-ttl | closeout | items 10/10 | closed | PR #66 open (not merged); G1 G2 in agent-rules.md, P2 P3 P9 P10 P15 in harness |
| 2026-09-25 | graph-orientation | requirements | v1 | gate-a |  |
| 2026-09-25 | graph-orientation | requirements | v3 | approved | 3 rounds, 0/3/3 to 2/1/0 to converged 0/0/2 |
| 2026-09-25 | graph-orientation | design | v1 | approved | 1 round, converged first pass 0/0/3 |

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
| State | implemented — all 12 tasks `[x]` on 2026-09-18 |
| Last code commit | 854db4e (task 12) on `feat/worktree-review-signals` |
| End-to-end | VERIFY pass: `npx tsc --noEmit`, `npm run build`, `npm test` (1316 passed / 2 skipped), `npm run test:e2e:worktree` (10/10, both worktree suites) |
| Deferrals added | 1 (`d-c99e352b` — MINOR honesty edges R2-3/R2-4) |
| Deferrals resolved | 2 (`d-a2233b94` TOON decode via task 1; `d-6e59490b` dashboard reviewer prompt via task 9) |
| Total deferred (project) | 14 |
| Fix rounds / adjudications | 0 / 0 (12 gate-pass; tasks 3,4,5,8 high-risk verifier pass) |
| Worth next | `d-c99e352b` (state-store read + ancestry honesty edges) · `d-84dc43e7` (worktree e2e not idempotent across repeat runs) · the `worktree-dashboard-concurrency` cluster (`d-4ee04d64`, `d-3580c072`, `d-e5331af0`) |
| Gotcha | Worktree e2e needs `npx playwright install chromium`; `agent-rules.md` worktree-setup lists only `npm ci`. Retro `harness-defect`. |
| Gotcha | `TaskStateStore.read` warns once per file on a plain-missing `task-state.json` — the normal single-checkout `head-expected` path; consider suppressing ENOENT (retro task 8). |
| PR | #49 https://github.com/madmatt112/spec-workflow-mcp/pull/49 (open, not merged) |

## worktree-review-signals — closeout

| Field | Value |
| --- | --- |
| State | CLOSED on 2026-09-18 — retrospective-plan.md marked CLOSED |
| Items | 13 total: 10 done, 3 to-do (human), 0 skipped |
| Landed (harness) | P1 04b1e89 · P3 ff3ab1e · P7 a5da1be · P11+G1 d3fd64c · P14+G3 42358c4 · P21 98e08fb — all on branch `chore/worktree-review-signals-retro` |
| Landed (store) | P12+G2 e9c1f36 — `agent-rules.md` worktree-setup now lists `npx playwright install chromium` for tasks running a worktree e2e suite |
| To-do (human) | P4, P6, P16 — product-code fixes whose target files (prepare-response TOON round-trip test, `isAncestorOfHead`, `src/core/task-state-store.ts`) do not exist on this branch (branched from main). They live on PR #49 (`feat/worktree-review-signals`, open). Land these on #49 or as a follow-up after #49 merges. |
| Gates | 7/7 pass, risk low; no verifier spawned |
| PR (retro) | #50 https://github.com/madmatt112/spec-workflow-mcp/pull/50 (base main; carries the unpushed local-main backlog, same as PR #49) |
| Gotcha | `briefs.md` has the "## Lint brief" section duplicated byte-identical (about L273 and L322); P1 and P11 were applied to both copies. Dedupe in a future pass. |
| Gotcha | This closeout ran isolated in the retro worktree; the main checkout cannot be git-committed from here. All bookkeeping (plan CLOSED, retro-log, this HANDOFF) is committed on `chore/worktree-review-signals-retro` and reaches main only when the retro PR merges. The ledger (`harness-events.jsonl`) was written to the main checkout for `--watch`. |

**Follow-up (2026-09-19):** P4, P6 and P16 landed in a follow-up PR from `fix/worktree-review-signals-followups` (ccc3ea8) once PR #49 was merged; the same PR removes the duplicated `## Lint brief` section from briefs.md (383a777). Plan lines updated to done.

## harness-usage-and-tiers — requirements

| Field | Value |
| --- | --- |
| State | approved at v5 on 2026-09-19 |
| Rounds | 5; verdicts 0/3/3 → 2/1/0 → 1/1/0 → 1/1/0 → post-cap adjudication, narrow check VERIFIED 2/2 |
| Approval | `approval_1789835511785_5tgmkk1h5` |
| Rulings | none |
| Cut scope | none |
| Carried items | Token source (overwatch ruling 2026-09-19, carried not revised): the orchestrator-side per-spawn token count is the `<usage><subagent_tokens>` value of the Agent task notification (skill fix f616c72), never a result footer, which does not exist; the hook-read transcript remains the deterministic replacement the spec builds. Design cites the notification as the current source. |
| Next phase loads | after `codebase-context.md`: `src/watch/ledger.ts` (the token/spawn fold the usage report reuses and departs from), `src/watch/render.ts` (watch view row widths), `src/tools/harness.ts` (the tool surface gaining `usage`/`gate`/`compareSpecName`), `harness/hooks/sdd-activity.sh` (spawn events and declared tiers) |

## harness-usage-and-tiers — design

| Field | Value |
| --- | --- |
| State | approved at v3 on 2026-09-19 |
| Rounds | 3; verdicts 1/1/2 → 0/2/0 → SHOULD_FIX-only corrective pass at v3, narrow check VERIFIED 2/2 |
| Approval | `approval_1789843231461_6kmnt6n22` |
| Rulings | Req 4.7 two-line agent entry (head + tier, each ≤80 cols) — refinement, closed; Req 5.4 / D6 "states unknown" widened to any non-digit `tokens` value — refinement, closed. Both are closed re-decisions; the tasks drafter must not re-flag them. |
| Cut scope | none |
| Carried items | none ruled out (no cap adjudication). Note for the implementer: design.md line 78 and the v3 Revision History cite the `agent.stop` activity join as spanning lines 305-311; the real join runs `src/watch/ledger.ts:293-314` — the load-bearing guarded-fill line (308) is correct, so this is a MINOR citation-span slip, not a false claim. Read the code. |
| Next phase loads | after `codebase-context.md`: this spec's `design.md` (8 components with pinned interfaces, the Data Models, Testing Strategy and Error Handling sections); then the files each component names — `src/watch/ledger.ts`, `src/watch/render.ts`, `src/tools/harness.ts`, `harness/hooks/sdd-activity.sh`, `scripts/sync-plugin-assets.cjs`, `scripts/copy-static.cjs` — plus the new files design pins (`src/watch/usage.ts`, `src/__tests__/fixtures/usage-ledger.jsonl`, `harness/agent-profiles.json`) |

## harness-usage-and-tiers — tasks

| Field | Value |
| --- | --- |
| State | approved at v1 on 2026-09-21 |
| Rounds | 1; verdict 0/0/2 → converged |
| Approval | `approval_1790008612021_brp2i8273` |
| Rulings | none (no standoff). Inherited design rulings still closed: Req 4.7 two-line agent entry; Req 5.4 / D6 non-digit `tokens` widening. |
| Cut scope | none; `spec-lint` coverage-component check clean, reviewer found no task-to-design gaps |
| Carried items | none (converged on round 1, no cap adjudication) |
| Next phase loads | after `codebase-context.md`: this spec's `tasks.md` (8 tasks in dependency order, each with a `_Prompt:` line) and `design.md`; the implementer works each task's prompt against the merged code, not against pinned cross-task signatures |

## harness-usage-and-tiers — implementation

| Field | Value |
| --- | --- |
| State | implemented 2026-09-21; all 8 tasks `[x]`; last code commit 358f401; e2e VERIFY pass |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/54 |
| Deferrals | this spec added 1 (d-3091be1c, tagged verification); 14 deferred project-wide |
| Deferred verification | d-3091be1c — live orchestrator SubagentStop half; re-run after this PR merges, `npm run build`, session restart |
| Worth next | d-3091be1c (this spec's live half, after merge+restart); d-1880d115 (question-gates gate A/B live scenarios, also needs re-install+restart); d-4c9198e3 (wire review-gate.ts to the P10 prose-paths set) |
| Gotchas | `harness brief` needs `title` beside `path`, and `job` for the verifier template; a `harness/` task mirrors into three `plugins/` trees, so the gate `files` list must include every `plugins/` copy or it fails `file-outside-list` (task 8, one extra gate call); task 4 and 7 gates were high risk (line-count, sensitive path) — both verifiers passed |
| Cut scope | requirements none, design none, tasks none |

## harness-usage-and-tiers — closeout

| Field | Value |
| --- | --- |
| State | CLOSED 2026-09-21; retrospective-plan.md marked CLOSED; 4/4 items done, 0 to-do, 0 skipped |
| Items | P2 94396b2; P3 f4bd289; P4 4e7f716 (incl. graduation candidate 2); P5 098f409 |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/56 (branch `chore/harness-usage-and-tiers-retro`) — NOT merged |
| Spawns | 1 implementer, 0 verifier (all four are harness items that passed the gate at low risk) |
| To-do (human) | Merge PR #56, then `npm run build` + session restart so the P2/P3/P4/P5 server + skill changes go live |
| Open verification | d-3091be1c (verification) still open — re-run after PR #56 merges, build, restart; human action item, not a close-out item |
| Gotchas | The `harness` orient class showed `store 1` because the classifier regex (`src/tools/harness.ts:465`, `\brules?\b`) matches `gate-rules.ts`/`tasks-drafter rule` in P3's Target line; P3 is really a `src/core/gate-rules.ts` change, so all four items landed as one harness batch. Gate `files` must be exact file paths, not directory names — P4/P5 first failed `file-outside-list` on directory args, passed on re-gate with the full path list (including the three `plugins/` mirror copies). |

## provider-per-role — requirements

| Field | Value |
| --- | --- |
| State | approved at v5 on 2026-09-22 (revision-mode run applying the Gate A answers) |
| Rounds | 4; verdicts 1/6/2 → 1/1/2 → 1/1/0 → post-cap adjudication v5, narrow check VERIFIED 2/2 |
| Approval | `approval_1790095689366_qb203yqs4` |
| Rulings | none (no standoff, no circling; the five approved Gate A decisions are human-decided and were treated as closed on their merits) |
| Cut scope | none. Scope notes reconcile two now-stale decomposition passages against the Gate A change — the refusal-timing bullet (decomposition still reads "refuse with a note") and the launcher `--model`/`ANTHROPIC_MODEL` contract — nothing the decomposition lists was cut. |
| Carried items | none ruled out (post-cap corrective pass fixed both R3-1 and R3-2). Notes for the design drafter: (1) narrow-check deferred finding — Req 6 crit 5's auth-path clause is grammatically garbled, intended rule is "a 'no' answer fails preflight (a)"; smooth it if design quotes the criterion. (2) MINOR, out of scope this phase — Req 2 crit 5 cites CLI `2.1.278`; installed is `2.1.280`. |
| Next phase loads | after `codebase-context.md`: the decomposition entry's "design should address" for provider-per-role and the endpoint routing facts at `.spec-workflow/spec-decomposition/decomposition.md:255-258`; then `.spec-workflow/agent-rules.md` (the new `## Providers` section), `harness/hooks/sdd-activity.sh` (the `provider` ledger field), the `claude -p` launcher surface the orchestrator calls instead of the Agent tool (Req 2/3), `harness/agent-profiles.json`, and the provider-split totals in the `harness usage` report and watch view (`src/watch/`) |

## provider-per-role — design

| Field | Value |
| --- | --- |
| State | approved at v2 on 2026-09-22 |
| Rounds | 2; verdicts iterate 0/1/1 → converged 0/0/1 (round 1 R1-1 SHOULD_FIX + R1-2 MINOR both accepted; round 2 clean, DESIGN_READY yes) |
| Approval | `approval_1790100426099_8ay5vpwgq` |
| Rulings | 2 (both drafter RE-DECIDED literals ruled refinement/closed in round 1): Req 2 crit 5 — the `--agents` JSON `model` key carries the request alias, not the profile's declared model (effort still from profiles); Req 2 crit 7 — `--add-dir` is passed when the spec store repo is outside the code root. |
| Cut scope | none. Scope notes address the two requirements carried notes (Req 6 crit 5 auth-path wording; installed CLI `2.1.280`) and keep the spec-9 override/page deferred, as requirements pinned. |
| Carried items | none ruled out (converged at v2 before any cap or adjudication). Notes for the tasks drafter: (1) carry the two round-1 refinement rulings above so tasks does not re-flag them. (2) R2-1 (MINOR, not blocking): compare-mode provider-pair placement is under-specified in the design — a value safely left to implementation; do not spawn a task solely for it. |
| Next phase loads | after `codebase-context.md`: this spec's `design.md` (the Components and Interfaces list, Data Models, Error Handling item 8, and the Testing Strategy unit/integration/E2E prescriptions each task maps to), the approved `requirements.md` for the acceptance criteria, and the decomposition entry's verification scenario. `structure.md` steering is absent. |

## provider-per-role — tasks

| Field | Value |
| --- | --- |
| State | approved at v5 on 2026-09-22 (resumed run: spawn 1 interrupted after v2 lint; spawn 2 ran rounds 2-4, cap adjudication, narrow check) |
| Rounds | 4 review rounds + narrow check; verdicts 0/2/2 → 1/1/1 → 1/1/1 → 1/1/0 → post-cap adjudication v5, narrow check VERIFIED 2/2 |
| Approval | `approval_1790110880017_zu7q7mynt` |
| Rulings | none (no standoff, no circling; cap convergence not granted — MUST_FIX flat 1→1 at r3→r4) |
| Cut scope | none |
| Carried items | none (post-cap corrective pass fixed both R4-1 and R4-2; nothing ruled out). Every post-r1 MUST_FIX was fix-induced: citation-path/range slips from reviser edits and contradiction remnants left when a fix touched 3 of 4 sites. |
| Next phase loads | after `codebase-context.md`: this spec's approved `tasks.md` (10 tasks, dependency-ordered; task 1 writes and proves the launcher body against DeepSeek, later tasks build the hook `provider` field, the `sdd-providers.sh` preflight, and the usage/watch provider split), `design.md` and `requirements.md`; the implementation orchestrator reads the gate-B veto list the server holds before the first spawn |
## provider-per-role — implementation

| Field | Value |
| --- | --- |
| State | implemented, 10/10 tasks, 2026-09-23 |
| Last code commit | 43c3414 |
| Deferrals | 1 added this spec (d-a38fea66); 15 deferred total |
| Deferred verification | d-a38fea66 |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/59 |
| Next deferrals worth working | d-3091be1c (live orchestrator SubagentStop usage half); d-1880d115 (question-gates gate A/B live scenarios) |
| Gotcha | Task 10 verified the launcher, map-script and usage-fold halves in-process (all six scenarios and the full suite green, real DeepSeek run, tokens=58346). The supervisor (roots-step refusal) and document-orchestrator (launcher routing, Anthropic reviser round) halves need the merged skills in a restarted session — deferred as d-a38fea66. docs/SDD-HARNESS.md's "no MCP server" line is the anthropic default; the eligible sdd-reviser gets --mcp-config (design.md:133), slightly loose for that case. |

## provider-per-role — closeout

Closed 2026-09-23. Retrospective plan implemented: 15 items — 15 done (P5 folded into P3), 0 to-do, 0 skipped. Not merged; merge is the human's.

- PR: spec-workflow-mcp PR #62 — https://github.com/madmatt112/spec-workflow-mcp/pull/62 — branch `chore/provider-per-role-retro`, 14 commits. Store items (P1, P3, P5, P16, G1) and harness items (P2, P4, P8, P11, P17, P18, P19, P20, P21, P22) all land in this one repo and ship in this PR.
- Gates: P1 (sensitive `src/tools/review-task.ts`) and P17 (sensitive `harness/hooks/`) were high-risk gate-pass and independently verified; the other 13 were low-risk gate-pass.
- To-do (human) — d-a38fea66: after the PR merges and the harness reloads, run the fixture requirements round of a scratch spec (DeepSeek reviser role, then all-anthropic, then key unset) to confirm the launcher path, the anthropic path and the keyless refusal.
- To-do (human) — after merge: resolve d-009995d8 (P19 medium-risk routing) and re-verify d-3091be1c (P17 hook usage rows).
- Follow-up filed d-9d600d11: `sdd-launch.sh` carries its own `readUsage` copy with the same multi-block token inflation P17 fixed in the hook; out of P17's hook-only scope, still latent for launcher/DeepSeek workers.
- Gotcha: P17 defect (b) (catch the final assistant line) has the functional fix in `sdd-activity.sh` but no deterministic race test — synchronous test fixtures make the tail-wait a no-op.

## agent-cache-ttl — requirements

| Field | Value |
| --- | --- |
| State | approved at v4 on 2026-09-24 (MODE revision: entered at v1 after Gate A) |
| Rounds | 3 (2 adversarial + 1 narrow check); verdicts iterate 1/2/3 → iterate 0/2/1 → SHOULD_FIX-only corrective pass v4, narrow check VERIFIED 3/3 |
| Approval | `approval_1790265698477_k4x8xi0qt` |
| Rulings | none (no standoff, no circling, no cap; no drafter RE-DECIDED flags this run) |
| Cut scope | none. Gate A revision made the live verification scenarios (1),(2),(3),(5) non-deferrable and block-until-restart (RI-1); no decomposition scope was cut or deferred. |
| Carried items | none ruled out (all findings R1-1..R1-6, R2-1..R2-3 accepted/fixed). Notes for the design drafter: (1) Req 4 now splits the unknown-cache counter into `cacheUnknownWrite` and `cacheUnknownGap` (per-kind unknown) — design must pin both fields on the UsageCell and its reducer. (2) Req 6 crit 7 gates the mandatory non-deferrable block on a tracked `verification-evidence.md` (one line per live scenario) the restarted rebuilt-harness session writes and the retrospective reads before it starts — design must pin that artifact and the retrospective's pre-start check. (3) Req 4 crit 6 collapses a total cell's cache columns to `unknown` only when the Anthropic spawn count is above 0; an all-DeepSeek total prints the `-` dash. |
| Next phase loads | after `codebase-context.md`: the approved `requirements.md` acceptance criteria (esp. Req 3 crit 7, Req 4 unknown-cache rule and crit 6, Req 6 crit 7 block), the decomposition entry for `agent-cache-ttl` (spec 13) and its verification scenario; `steering/tech.md`, `structure.md`, `design-system.md` as present. |

## agent-cache-ttl — design

| Field | Value |
| --- | --- |
| State | approved at v1 on 2026-09-24 |
| Rounds | 1; verdicts converged 0/0/3 (MINOR only) |
| Approval | `approval_1790268343061_7gv3iwvqs` |
| Rulings | none. Four drafter RE-DECIDED literals all ruled refinement/closed by the reviewer: Req 1.5 (profile test under `src/__tests__`, vitest only runs there), Req 5.2.5 (user settings read from `CLAUDE_CONFIG_DIR` when set), Req 6.2 (scenario (2) uses a probe agent carrying the orchestrator frontmatter), Req 6.7 (mandatory restart replaced by a pre-merge isolated session run). |
| Cut scope | none. All six decomposition verification scenarios and every delivered artifact are pinned. |
| Carried items | none ruled out (round 1 converged; 3 MINOR only). Notes for the tasks drafter: (1) C8 is the pre-merge live-verification component — scenarios 1/2/3/5 run in a scratch `CLAUDE_CONFIG_DIR` filled by `dev-link.sh` run against the worktree, because `~/.claude/agents/sdd-*.md` symlink into MAIN's `harness/agents`; evidence lands in the tracked `verification-evidence.md`. Tasks must sequence C8 and the evidence file, and the retrospective's pre-start check on it. (2) `UsageCell` carries per-kind unknown fields `cacheUnknownWrite`/`cacheUnknownGap`; the crit-6 total-cell collapse to `unknown` fires only when the Anthropic spawn count is above 0 (all-DeepSeek total prints `-`). (3) `SubagentStop` hook adds `cacheWrite5m`, `cacheWrite1h`, `gapRewrites` on `spawn.end`. |
| Next phase loads | after `codebase-context.md`: the approved `design.md` components C1–C8, its Data Models (`spawn.end` row, profile entry, `run.start` row, `verification-evidence.md`) and Testing Strategy; `requirements.md`; `steering/structure.md` as present. |

## agent-cache-ttl — tasks

| Field | Value |
| --- | --- |
| State | approved at v1 on 2026-09-24 |
| Rounds | 1; verdicts converged 0/0/2 (MINOR only) |
| Approval | `approval_1790270412051_s3dxtizxo` |
| Rulings | none. Three drafter RE-DECIDED design literals all ruled refinement/closed by the reviewer: C3/D5 (render pad `Math.max(23, len+1)` not fixed 24 — 24 breaks the 80-column render test and changes default line counts, which Req 2.3 forbids); Testing Strategy (keyless-profile case moves from the render test to the loader test); C8 (`recompute.mjs` falls back to `~/.claude/projects`, a missing transcript fails the row per design R1-1). |
| Cut scope | none. 9 tasks cover every design component C1–C8. Live-verification scenarios (1),(2),(3),(5) stay pending with no deferral (requirements D10); they run in the operator's pre-merge C8 session, not as a task. |
| Carried items | none. |
| Gate B | veto list written to slot b for the supervisor; gate B class (a) computed server-side, classes (b)/(c) empty (reviewer round-1 found no `[gate-b]`/`[gate-c]` tasks). |
| Next phase loads | implementation reads `codebase-context.md`, then `tasks.md` (dependency order 1→2→3, 6/7→8), `design.md` components C1–C8, `requirements.md`; the supervisor reads gate-B slot b before the first implementation spawn. |


## agent-cache-ttl — implementation

| Field | Value |
| --- | --- |
| State | implemented on 2026-09-24; 9/9 tasks; last code commit e57d84c |
| Deferrals | 0 added by this spec; 15 open total |
| Live verification | scenarios (1),(2),(3),(5) stay `pending` in verification-evidence.md; the operator runs design C8's launch sequence pre-merge (dev-link the branch, restart the session, run e2e-setup.sh, launch the three probe sessions, run recompute.mjs, mark the evidence lines `passed`). The evidence file blocks the retrospective until every line reads `passed` (D10, no deferral filed). |
| Next deferrals worth working | d-9d600d11 (sdd-launch.sh readUsage token inflation, same class as this spec's usage work); d-a38fea66 (verify provider-per-role halves in a restarted session); d-1880d115 (question-gates live gate scenarios) |
| Gotchas | Only one spec-run subagent transcript carries the ephemeral cache fields; scenario (4) paired it with a second real project transcript. harness/agent-profiles.json is not mirrored into plugins/. |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/64 |

## agent-cache-ttl — closeout

| Field | Value |
| --- | --- |
| State | CLOSED on 2026-09-25; 10/10 plan items done, 0 to-do, 0 skipped |
| Store batch | agent-rules.md: new "Fixtures and live verification" section — G1 (with P7/P8/P14) validity bar d733799, G2 tracked-evidence gate e8a58b4 |
| Harness batch | P2 56e8884, P3 3193b95, P9 1485bc6, P10 a44b7ed, P15 5d50bb5; each commit carried its plugins/ mirror |
| Gates | all 10 items gate pass, risk low; no verifier spawned (store class + harness low-risk) |
| Checks | sync-plugin-assets, check:plugin-assets, plugin validate --strict all green; P10 vitest 6/6 |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/66 (store + harness ride one PR — same repo; not merged) |
| To-do (human) | Merge PR #66 to land the retrospective follow-ups. |
| Gotchas | Session was worktree-isolated, so store-class changes and spec-store bookkeeping landed on chore/agent-cache-ttl-retro and ride PR #66 rather than committing to main directly. Ledger/retro-log/commit helper scripts were repointed from the main checkout to the worktree copy. P10's new JSDoc block comment must avoid a bare `*/` (a path glob closed the comment early). |

## graph-orientation — requirements

| Field | Value |
| --- | --- |
| State | approved at v3 on 2026-09-25 |
| Rounds | 3; verdicts 0/3/3 → 2/1/0 → converged 0/0/2 |
| Approval | `approval_1790359537320_wcdfrrc6c` |
| Rulings | none |
| Cut scope | none. Decomposition exclusions honoured (no spec-store graph, no .graphifyignore change, no PreToolUse-nudge change, no graphify MCP server, no agent-frontmatter change). Spec 11's test-author template is deferred (not this spec's scope); Req 3 AC 1 covers it when added. |
| Carried items | none. Round 3 converged 0/0/2; both MINOR notes (graph-column position in usage output; scenario-4 fixture prerequisites) left as deferrable, not carried. |
| Next phase loads | design reads `codebase-context.md` first, then the decomposition entry for graph-orientation, `tech.md` and `structure.md`, and this `requirements.md`: 7 requirements — the graph fact lands after the supervisor roots step (D9), freshness is by tooling, the graph column undercounts separate-process (DeepSeek) workers, and the graph covers only 8 of 2,713 `harness/` nodes so a worker on a skill file falls back to a normal read. |

## graph-orientation — design

| Field | Value |
| --- | --- |
| State | approved at v1 on 2026-09-25 |
| Rounds | 1; verdicts converged 0/0/3 |
| Approval | `approval_1790361966822_09kylbcnh` |
| Rulings | D8 (Req 6 AC2): refinement — a graph fact must come from a graph command; a grep for the phrase does not count. |
| Cut scope | none. Live halves of scenarios (2),(3),(4) wait as `pending` lines in the tracked verification-evidence file (C7); the activity hook, retro orchestrator and usage delta are unchanged; spec 11's test-author template is deferred and the C4 section covers it when added. Decomposition exclusions honoured. |
| Carried items | none. Round 1 converged 0/0/3; the 3 MINOR (R1-1 Testing Strategy misses a breaking compare-row assertion; R1-2 `windowPhase` pseudo-call arity; R1-3 close-out refresh condition stricter than Req 2 AC3, dormant) are left deferrable, not carried. |
| Next phase loads | tasks reads `codebase-context.md` first, then `structure.md` and this `design.md`: 7 components — C1 new `sdd-graph.sh` script, C2 supervisor graph step, C3 brief graph section by tooling in `harness.ts`, C4 orchestrator skills pass the graph, C5 graph column in `harness usage`, C6 docs, C7 tracked live-verification record. The graph field changes existing harness/usage test literals; live scenario halves stay pending in the evidence file. |
