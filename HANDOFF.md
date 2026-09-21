# HANDOFF

> **READ FIRST — SDD routing (2026-09-21, harness v4).** **`harness-usage-and-tiers`** is CLOSED — no active spec.
> Live phase **closeout**, state **items 4/4**, last result **closed** (PR #56 open, not merged).
> Roots: spec store `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`, code `/home/mcf/repo/spec-workflow-mcp` (close-out ran in worktree `.claude/worktrees/harness-usage-and-tiers-retro`, branch `chore/harness-usage-and-tiers-retro`).
> A re-run does: starts the next roadmap spec, `harness-control-pane` (spec 9 of decomposition.md, no directory yet), at requirements — but only after PR #56 merges, `npm run build`, and a session restart. Human: merge PR #56; fix the SubagentStop hook so it reads the subagent transcript (agent_transcript_path, or derive from agent_id) and fires once, then re-verify d-3091be1c (kept open, evidence in the record); push local main (ahead of origin with docs commits).

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
