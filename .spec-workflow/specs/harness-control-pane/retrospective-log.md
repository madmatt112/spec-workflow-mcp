
## 2026-09-28T20:18:20Z · requirements · v1 · gotcha
Round 1 on v1: iterate, MUST_FIX 1 / SHOULD_FIX 4 / MINOR 3. R1-1 is a scope contradiction (AC 2.9 writes new run.start ledger fields that decomposition boundary note and D14 forbid). R1-2..R1-5 are wire/validation gaps.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-09-28T20:54:15Z · requirements · v2 · inefficiency
Round 2 on v2: iterate 1/2/3. All findings fix-induced by the v2 lint trim: R2-1 (MUST_FIX) scope-note citation 753-754 landed on an unrelated note and short of the quoted phrase (correct 754-755); R2-2 (SHOULD_FIX) trim dropped 'distinct from initial/projects-update' from AC 4.9/5.10 and AC 5.10's type enumeration; R2-3 (SHOULD_FIX) AC 4.9 'only harness subscribers via existing broadcastToProject' contradicts that helper's projectId-only filter. Lesson: an aggressive over-cap trim can move citations off quoted text and weaken accepted wire-contract ACs.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn

## 2026-09-28T21:09:28Z · requirements · v3 · gotcha
Round 3 on v3: iterate 0/6/3; MUST_FIX 0 routes to a SHOULD_FIX-only corrective pass. The v3 delta verified clean (no regression). The failure-paths fresh lens surfaced 6 novel SHOULD_FIX gaps: R3-1 log-lines push left unrouted (compounds R2-3), R3-2 dashboard as a second concurrent writer of the machine-wide active-run pointer with no atomic-rewrite requirement, R3-3 no liveness reconciliation on restart/half-stop, R3-4 no launch error/rollback path, R3-5 preflight-refused run orphans harness-run.json, R3-6 check-to-spawn race with a terminal launch.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r3.md
Cost: 1 reviewer spawn

## 2026-09-28T21:22:44Z · requirements · phase · cleanup
requirements approved at v4 after 4 rounds; verdict trajectory 1/4/3 → 1/2/3 → 0/6/3 → SHOULD_FIX-only corrective pass → narrow check VERIFIED 6/6; rulings 0; cap not hit (SHOULD_FIX-only pass at v4, not post-cap adjudication); prune removed 0 records and 0 snapshots (kept 2). Round 2 findings were all fix-induced by the v2 over-cap lint trim (wrong citation range, weakened wire-contract ACs); round 3's failure-paths lens surfaced 6 novel robustness gaps, all accepted into v4.
Evidence: approval_1790630432518_ddccp0tmh; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r4.md
Cost: 3 reviewer + 1 checker + 3 reviser spawns

## 2026-09-28T22:03:01Z · design · v1 · gotcha
design R1: iterate 0/3/3; all 4 RE-DECIDED flags ruled refinement (closed) by reviewer on own authority; 3 SHOULD_FIX (launch-log lifecycle re-point/offset/reset unspecified; sdd-providers.sh merge bypasses early returns/inline checks; Testing Strategy omits harness plugin-sync + validate checks)
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn

## 2026-09-28T22:27:54Z · design · v2 · gotcha
design R2 (fresh lens failure/concurrency): iterate 0/2/1; R2-1 launch admission not atomic with in-flight mark (double-spawn race), R2-2 log re-point fires on every launch-update not only new launch (reset storm, compounds R1-1); R2-3 minor spawn-to-record crash window. Routes to SHOULD_FIX-only pass (D=2).
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-design-r2.md
Cost: 1 reviewer spawn

## 2026-09-28T22:41:54Z · design · v3 · gotcha
Narrow check deferred finding: the R2-1 fix names no LaunchError.step value for a call that loses the in-flight check-and-set race; the loser's error shape/handling at the route layer (409 vs 500) is unstated. Left for the tasks/implementation phase.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-design-r3.md
Cost: 1 checker spawn

## 2026-09-28T22:43:13Z · design · phase · cleanup
design approved at v3 after 3 rounds; verdict trajectory 0/3/3 → 0/2/1 → SHOULD_FIX-only pass → VERIFIED 3/3; rulings 0 (4 RE-DECIDED flags closed as refinement by reviewer at round 1); cap not hit (SHOULD_FIX-only pass at v3; carried: R2-3 word cap); prune removed 0 records and 0 snapshots.
Evidence: approval_1790635324007_a1w0qavvk; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-design-r2.md
Cost: 2 reviewer + 2 reviser spawns; 1 drafter; 1 checker

## 2026-09-28T23:13:08Z · tasks · v1 · gotcha
Round 1 review of tasks v1: verdict iterate 1/0/0 (one MUST_FIX, a citation correction R1-1); no ordering, coverage, atomicity or gate-B/gate-C gap. Carried design gaps (LaunchError.step/409-vs-500, R2-3 window) confirmed resolved in v1.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-09-28T23:22:40Z · tasks · v2 · gotcha
Round 2 review of tasks v2: converged 0/0/1 (one MINOR, no work needed). Fresh lens: cost of touching existing components. Bridge warnings and test-seam infos held. Delta (R1-1 citation fix) confirmed correct.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-tasks-r2.md
Cost: 1 reviewer spawn

## 2026-09-28T23:23:37Z · tasks · phase · cleanup
tasks approved at v2 after 2 rounds; verdict trajectory 1/0/0 → 0/0/1 → converged; rulings 0; cap not hit (one MINOR R2-1 left as-is, not word-cap); prune removed 0 records and 0 snapshots (2 snapshots kept).
Evidence: approval_1790637778134_ua1ingjck; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-tasks-r2.md
Cost: 2 reviewer + 1 reviser spawns; 1 drafter

## 2026-09-29T13:05:05Z · implementation · task 1 · gotcha
Read-only snapshot() split from generate(); gate pass risk high (tdd structural-red on base), verifier pass, no fix rounds.
Evidence: task 1; src/core/index-generator.ts; commit 4a55b6c
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T13:18:21Z · implementation · task 2 · gotcha
Wire types + state-files helpers; gate pass risk high (line-count 248>200 intended two-file scope, tdd structural-red), verifier pass, no fix rounds.
Evidence: task 2; src/dashboard/harness/types.ts, state-files.ts; commit 3cc5760
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T13:27:24Z · implementation · task 3 · gotcha
Two pure HANDOFF/gate parsers in project-watch.ts; gate pass risk high (tdd structural-red, new module), verifier pass, no fix rounds.
Evidence: task 3; src/dashboard/harness/project-watch.ts; commit 067fdef
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T13:48:38Z · implementation · task 4 · gotcha
run-setup module (view/validate/write) over tasks 1-3; gate pass risk high (line-count 291, tdd structural-red), verifier pass, no fix rounds.
Evidence: task 4; src/dashboard/harness/run-setup.ts; commit 63768ca
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T14:08:55Z · implementation · task 5 · gotcha
HarnessLauncher admission + detached launch (design C4); gate pass risk high (line-count 335, tdd structural-red), verifier pass, no fix rounds.
Evidence: task 5; src/dashboard/harness/launcher.ts; commit 1f8f237
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T14:30:19Z · implementation · task 6 · gotcha
Launcher stop/finalise/own-exit/restore added to task 5 class; gate pass risk high (line-count 251, tdd structural-red), verifier pass, no fix rounds.
Evidence: task 6; src/dashboard/harness/launcher.ts; commit 8872570
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T14:56:26Z · implementation · task 7 · gotcha
ProjectHarnessWatch added to task 3 module; start() is now async (hub in task 9 must await it); gate pass risk high (line-count 281, tdd structural-red), verifier pass, no fix rounds.
Evidence: task 7; src/dashboard/harness/project-watch.ts; commit f359099
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T15:20:21Z · implementation · task 8 · doc-gap
Design D9 chokidar note holds for re-creation but not first creation of a never-existed single file path (chokidar 3.6.0 hung); impl watches the sdd directory instead. Task 7 ProjectHarnessWatch watches file paths directly and may share this latent gap for files created after start() (mitigated in practice by launch-update re-arm).
Evidence: task 8; src/dashboard/harness/overview-watch.ts; commit 5e41fa5
Cost: implementer RETRO flag; no extra spawns

## 2026-09-29T15:24:47Z · implementation · task 8 · gotcha
OverviewWatch + buildOverviewRow (design C6); D9 solved by watching the sdd directory not a never-existed file. Gate pass risk high (line-count 340, tdd structural-red), verifier pass with 1 advisory info (lastRow scans whole ledger, design-conformant), no fix rounds.
Evidence: task 8; src/dashboard/harness/overview-watch.ts; commit 5e41fa5
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T15:44:50Z · implementation · task 9 · gotcha
HarnessHub + multi-server wiring (design C7); gate pass risk high (line-count 223, tdd structural-red, hygiene console:4 confirmed false positive - error-path logs matching existing pattern), verifier pass, no fix rounds.
Evidence: task 9; src/dashboard/harness/hub.ts, src/dashboard/multi-server.ts; commit 4b0afa3
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T16:08:52Z · implementation · task 10 · gotcha
Four harness routes in multi-server (design C7); gate pass risk high (tdd amended - legitimate beforeEach mkdir fixture fix, base assertion-red), verifier pass, no fix rounds.
Evidence: task 10; src/dashboard/multi-server.ts, harness-routes.test.ts; commit 57924c2
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T16:18:03Z · implementation · task 11 · gotcha
Frontend watchView + wire types (design C8); unmarked task (no vitest, frontend outside root compile). Gate pass risk high (line-count 281, typecheck partial-coverage by design), verifier pass, no fix rounds.
Evidence: task 11; src/dashboard_frontend/.../WebSocketProvider.tsx, harness/types.ts; commit 080afb0
Cost: 2 spawns (implementer, verifier)

## 2026-09-29T16:35:42Z · implementation · task 12 · gotcha
Harness page (design C8, 672 lines); gate pass risk high (line-count 797), verifier pass with 2 advisory info (5 unused i18n keys; a design-conformant log-reset ordering note), no fix rounds. 375px browser render deferred to task 19.
Evidence: task 12; src/dashboard_frontend/.../HarnessPage.tsx +3; commit da808df
Cost: 2 spawns (implementer, verifier)

## 2026-09-29T16:46:45Z · implementation · task 13 · gotcha
Overview page (design C8, read-only); gate pass risk high (line-count 202), verifier pass, no fix rounds. 375px browser render deferred to task 19.
Evidence: task 13; src/dashboard_frontend/.../OverviewPage.tsx +3; commit a2bbb89
Cost: 2 spawns (implementer, verifier)

## 2026-09-29T17:04:57Z · implementation · task 14 · gotcha
sdd-providers.sh RUN_FILE second-arg merge + plugins sync (design C9); gate pass risk high (tdd amended - implementer added 2 strengthening tests, base assertion-red), verifier pass, no fix rounds. All harness checks green.
Evidence: task 14; harness/.../sdd-providers.sh + 3 plugin copies + providers-map.test.ts; commit f1331aa
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T17:10:13Z · implementation · task 15 · doc-gap
Task 15 prompt lists a one-argument sdd-providers.sh 'hard-coded providers= line' check among the TDD test list, but sdd-providers.sh already exists and is unchanged by this task, so that check can never be red; the author omitted it and the implementer adds it as a green regression guard.
Evidence: task 15; src/__tests__/run-setup-script.test.ts; commit 44c2d6e
Cost: author RETRO flag; folded into implementer brief

## 2026-09-29T17:20:23Z · implementation · task 15 · gotcha
sdd-run-setup.sh reference script + plugins sync (design C9); gate pass risk high (tdd amended - orchestrator-requested green regression guard added, base assertion-red), verifier pass, no fix rounds. All harness checks green.
Evidence: task 15; harness/.../sdd-run-setup.sh + 3 plugin copies + run-setup-script.test.ts; commit dec48a4
Cost: 3 spawns (author, implementer, verifier)

## 2026-09-29T17:27:15Z · implementation · task 16 · gotcha
Supervisor SKILL.md + formats.md honour harness-run.json (design C9); prose-only harness change, gate pass risk low (gate recorded review, no verifier), no fix rounds. All harness checks green.
Evidence: task 16; harness/skills/sdd-continue/SKILL.md, formats.md + 6 plugin copies; commit e562054
Cost: 1 spawn (implementer)

## 2026-09-29T17:31:36Z · implementation · task 17 · gotcha
MODEL_OVERRIDES spawn-rule sentence added to 4 phase skills + plugins sync; prose-only, gate pass risk low (gate recorded review, no verifier), no fix rounds. All harness checks green.
Evidence: task 17; 4 phase SKILL.md + 12 plugin copies; commit 2927e4a
Cost: 1 spawn (implementer)

## 2026-09-29T17:35:14Z · implementation · task 18 · gotcha
Dashboard control pane docs section (design C10); docs-only, gate pass risk low, no fix rounds.
Evidence: task 18; docs/SDD-HARNESS.md; commit 2258d2d
Cost: 1 spawn (implementer)

## 2026-09-29T17:38:13Z · implementation · task 19 · gotcha
Pending verification-evidence.md written (10 pending lines: 7 live decomposition steps + 3 harness checks); verification-only spec-store task, no gate, no verifier (retro P15), logged yes/19.
Evidence: task 19; .spec-workflow/specs/harness-control-pane/verification-evidence.md; commit a25f99a
Cost: 1 spawn (implementer)

## 2026-09-29T17:43:55Z · implementation · task 20 · gotcha
In-loop full-suite gate: tsc/build/npm test (1721 passed, task 7 parity green)/plugin checks all 0, render.ts untouched (Req 6.1); c1-c3 marked passed, 7 live lines stay pending for the operator. Verification-only task, no verifier.
Evidence: task 20; .spec-workflow/specs/harness-control-pane/verification-evidence.md; commit 31e2810
Cost: 1 spawn (implementer)

## 2026-09-29T17:46:00Z · implementation · phase · cleanup
harness-control-pane implemented: 20/20 tasks, 0 fix rounds, 0 adjudications. ~47 spawns (12 test authors, 20 implementers, 15 verifiers for high-risk gates; tasks 16-18 completed on the low/medium gate path with no verifier, tasks 19-20 verification-only). 1 deferral added (d-69b95f88 live e2e). In-loop full suite green; 7 live decomposition steps deferred to an operator pre-merge session. Every TDD new-module task scored tdd structural-red -> risk high -> verifier, as designed.
Evidence: 20 tasks in tasks.md all [x]; harness-events.jsonl; retrospective-log.md
Cost: 12 author + 20 implementer + 15 verifier spawns; 0 adjudication

## 2026-09-29T17:54:57Z · implementation · task 5 · bug
CI red round 1: launcher test 'records pid, pgid, cwd and writes the argument list to the log' failed on node 20 - it read the log synchronously before the detached child's async argv write landed (node 20 gives no such guarantee; the design probe was node 24). Test-only fix: poll with waitFor until the log holds the argv; launcher.ts unchanged. Passed local + CI.
Evidence: check test; commit abf456c
Cost: 2 spawns (fix implementer, verifier); ~4 minutes

## 2026-09-29T17:57:52Z · implementation · task 20 · tool-error
CI red round 2: src/core/__tests__/registry-lock.test.ts:190 'serialises the critical section when several processes break the same stale lock (req 6.5)' failed on CI. Untouched by this branch (empty diff main...HEAD) and present on main - a pre-existing timing-sensitive concurrency test that flaked on a loaded runner, not caused by harness-control-pane. Rerunning the failed job rather than changing code.
Evidence: check test; registry-lock.test.ts untouched on this branch; run 36608321901
Cost: rerun failed job; 0 code changes

## 2026-10-01T20:10:08Z · verification · check 2 · bug
A dashboard launch with supervisor model 'sonnet' passed setup validation (run-setup.ts:207 accepts any Anthropic model), then the supervisor preflight printed 'Run /model opus and /effort high, then continue' and exited 0. No run.start, no ledger, no HANDOFF header; harness-run.json was left unconsumed, the page showed 'exited, code 0', and --watch then failed with 'No active spec'. The page gives no sign the run refused to start.
Evidence: sdd-sandbox launch log ~/.spec-workflow-mcp/harness/logs/0f4aeBWoAfgCpBpJ-2026-10-01T20-09-03-847Z.log; sdd-sandbox/.spec-workflow/harness-run.json (supervisorModel sonnet, roles {})
Cost: 1 launch, about 1 minute

## 2026-10-01T20:12:33Z · verification · check 3 · gotcha
A second launch during the supervisor's preflight (about 40 s from launch to run.start, before the pointer line exists) is refused by the launch-record branch of admission (launcher.ts:128-129) with runId null, so the page shows 'a launch record is live' and no run id or PID. Once run.start lands the pointer branch refuses with the live run id, as Req 3 AC7 says. The page could name the PID in that window.
Evidence: POST /harness/launch at 20:12:27Z returned run-live runId run-20261001-201124; Matthew's earlier click showed no run id (screenshot)
Cost: 2 launch attempts

## 2026-10-01T20:14:42Z · verification · check 2 · gotcha
With sdd-drafter overridden to sonnet, --watch showed the drafter as 'declared claude-opus-5-5 high' (the agent frontmatter) while it ran on claude-sonnet-5-5; 'actual' stays blank until spawn.end. The override itself worked (spawn.end model claude-sonnet-5-5, run.start overrides sdd-drafter:sonnet:anthropic), but 'declared' ignores run.start overrides, so a live run with an override reads as the wrong model.
Evidence: sdd-sandbox run-20261001-201124 ledger rows 20:13:33 spawn.start / 20:14:28 spawn.end; Matthew's --watch screenshot
Cost: 1 run
Fix idea: the hook already has the Agent call's tool_input at spawn.start (harness/hooks/sdd-activity.sh:211-216) but writes only agent and role; add tool_input.model when present, and have the page and --watch show it as declared.

## 2026-10-01T20:26:52Z · requirements · phase · model-behaviour
Cross-repo (tradr broker-csv-presets): the document orchestrator returned its PHASE line as the whole enum template instead of one value.
Evidence: overwatch spec-workflow-mcp-66 observation, relayed 2026-10-01
Cost: unknown

## 2026-10-01T20:26:52Z · implementation · phase · harness-defect
Cross-repo (jobscout task 6): TDD routing marked a task red-first that only tested earlier-task code (RED-IMPOSSIBLE), and the design-defect loop then forced a design revision for a defect that lived only in tasks.
Evidence: overwatch spec-workflow-mcp-66 observation, relayed 2026-10-01
Cost: unknown

## 2026-10-01T20:26:52Z · implementation · phase · harness-defect
Every change under src/markdown/templates leaves the store copy .spec-workflow/templates/*.md dirty after a session restart.
Evidence: overwatch spec-workflow-mcp-66 observation, relayed 2026-10-01
Cost: unknown

## 2026-10-01T20:26:52Z · implementation · phase · mcp-deficiency
The harness brief action demanded a redTests value for a task that carries no TDD marker.
Evidence: overwatch spec-workflow-mcp-66 observation, relayed 2026-10-01
Cost: unknown

## 2026-10-01T20:26:52Z · closeout · phase · tool-error
Cross-repo (jobscout close-out): the auto-mode classifier blocked the close-out orchestrator's routine event.sh ledger writes three times in a row, stalling the run about 19 hours.
Evidence: overwatch spec-workflow-mcp-66 observation, relayed 2026-10-01
Cost: ~19h stall

## 2026-10-01T20:26:52Z · closeout · phase · harness-defect
Close-out PRs miss regenerated generated files (tradr PR #120 left _how-its-built.json stale).
Evidence: overwatch spec-workflow-mcp-66 observation, relayed 2026-10-01
Cost: unknown

## 2026-10-01T20:32:41Z · retrospective · phase · cleanup
retrospective compiled: 19 findings (3 gotchas, 3 product bugs, 2 tool/MCP, 3 harness defects, 1 prompt, 2 inefficiencies, 1 model-behaviour, 2 harness-decisions, 2 repeat patterns) and 17 proposals (2 decisions needed, 2 graduation candidates). All 7 live e2e steps now passed; d-69b95f88 ready to resolve.
Evidence: retrospective.md; retrospective-proposals.md
Cost: 1 analyst spawn

## 2026-10-02T02:48:01Z · closeout · phase · cleanup
store batch: P13 (826418e), G1 (6e4b202), G2 (99053de) committed to agent-rules.md on main; P16 skipped (no-change scope decision); P17 deferral d-69b95f88 resolved. All 3 gates pass risk low; store class ok, no verifier.
Evidence: retrospective-plan.md Close-out; agent-rules.md
Cost: 1 implementer spawn

## 2026-10-02T03:31:55Z · closeout · phase · cleanup
harness batch (retro worktree, branch chore/harness-control-pane-retro): 9 done (P1 385ba62, P3 e2beaa4, P5 3583c68, P8 741082d, P9 e9dd880, P10 f1aed28, P11 3ab5d23, P12 a783031, P15 cca6e82); P13 harness-half skipped (node-20 probe already deferred to agent-rules.md); P14 skipped (decision A). All gates pass; P5 high-risk (sensitive hooks path) verified pass; other 8 low risk. PR opened after code batch.
Evidence: retrospective-plan.md Close-out
Cost: 1 implementer + 1 verifier spawn

## 2026-10-02T18:08:03Z · closeout · phase · cleanup
code batch (retro worktree, branch chore/harness-control-pane-retro): 3 done (P2 28265e4, P6 20ce08e, P7 e675405); P4 to-do (refusal signal is a harness SKILL.md + design.md slice, not product-code-only). All 3 gates pass risk low; code class low risk, no verifier.
Evidence: retrospective-plan.md Close-out
Cost: 1 implementer spawn

## 2026-10-02T18:08:03Z · closeout · task P4 · deviation
P4 left to-do: decision (B) refusal signal needs the supervisor preflight (harness SKILL.md) to emit a run.start-refused event and exit non-zero plus a step-0 refusal-signal channel; contradicts design.md:250; not a product-code-only change.
Evidence: retrospective-plan.md Close-out
Cost: 0 spawns

## 2026-10-02T18:09:48Z · closeout · phase · cleanup
harness-control-pane close-out CLOSED: 19 items — 18 done (3 store, 9 harness+code store-side... actually 3 store + 9 harness + 3 code = 15 landed, P16/P13-half/P14 skipped=3), P4 to-do (human). Store on main; harness+code on branch chore/harness-control-pane-retro via PR #79 (not merged). Spawns across close-out: 3 implementers + 1 verifier.
Evidence: retrospective-plan.md; HANDOFF.md; PR #79
Cost: 3 implementer + 1 verifier spawns total
