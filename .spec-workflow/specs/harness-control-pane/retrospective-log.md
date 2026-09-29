
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
