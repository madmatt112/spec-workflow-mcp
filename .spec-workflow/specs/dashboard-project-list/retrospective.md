# Retrospective — dashboard-project-list

Compiled 2026-10-29 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Task 1's File: list omitted the exported-function regression test, tripping the file-outside-list gate.** `linkedWorktreeInfo` is a new export, so `src/core/__tests__/git-utils.test.ts` (the export-classification guard) had to be edited, but tasks.md did not list it; the gate flagged a file edited outside the declared list. The operator ruled the list correct and the fix round was a no-op re-verify. Evidence: retro log 2026-10-29T13:08:38Z; spec commit 88c47fff; impl log task-1 1618. Frequency: once. Cost: 1 operator ruling + 1 no-op repair spawn.
- **F2 — `SPEC_WORKFLOW_SHARED_ROOT` leaked from the shell into verification.** The var was exported in the session environment; every verification check had to be run with it unset (`env -u`) or results would be scoped to the shared root. Evidence: verify-e2e-r1-findings.md lines 5-7; verify-e2e-r2-findings.md lines 6-7. Frequency: both e2e rounds. Cost: an unset step per command. Also seen in advisor.
- **F3 — `npm test` wipes `/tmp/scratchpad/sdd`, destroying the live briefs mid-run.** The verifier had to back up briefs to `/home/mcf/e2e-verify-logs/` before running the full suite so the run would not delete the artifacts under test. Evidence: verify-e2e-r1-findings.md line 77; verify-e2e-r2-findings.md lines 7-9. Frequency: both e2e rounds. Cost: a backup step per round.

## Product bugs found

- **F4 — `addProjectByPath` store-root change no longer re-points the context's watchers.** Task 6 replaced the base `removeProject`+`addProject` re-point with a bare in-place field update in `syncOnce`. On a re-add of the same workspace with a different `workflowRootPath`, the context reports the new store root but its parser/watcher/approvalStorage still read the old store. Accepted by the design C3 scope note. Evidence: deferral d-960bb37e; design.md:216. Frequency: once. Cost: deferred (owner harness), no fix.

## Tool and MCP errors or deficiencies

- **F5 — The `deferrals` tool could not see this spec's only deferral.** `action: list` filtered by `originSpec: dashboard-project-list` on the main store returned 0, yet d-960bb37e exists in the worktree store (untracked, created 2026-10-29T14:07Z). The tool reads only the merged store, so a worktree-created deferral is invisible until its spec-store commit lands. Evidence: deferrals list result (total 0) vs worktree file `.spec-workflow/deferrals/d-960bb37e.md`. Frequency: once. Cost: the deferral was nearly dropped from this retro.

## Harness defects

- **F6 — The completion ledger reported "0 deferrals added" while 1 was added.** The implementation-complete entry and HANDOFF both say 0 deferrals added, but d-960bb37e was created during task 6 verification. The count is a floor, not a total — consistent with the agent-rules floor caveat, but here the floor read zero against a real deferral. Evidence: retro log 2026-10-29T16:47:41Z (cleanup); HANDOFF implementation row ("0 added by this spec"); d-960bb37e. Frequency: once. Cost: bookkeeping only.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F7 — Three redundant re-spawns re-did work already committed.** Task 4's "retry" implementer found the behaviour already present at 947c0049 and made no change; task 1's repair-round-1 implementer made no change (operator no-op ruling); task 7 drew two clean reviews (v1 at 14:14, v2 at 14:17) with no fix round between. Evidence: impl log task-4 1327 ("no code change needed"); impl log task-1 1618; reviews review-7_v1 and review-7_v2 (both "No findings"). Frequency: 3 times. Cost: ~3 extra spawns of the 59 total.

## Documentation gaps

- **F8 — `verify-standing.md` was absent at the path the verifier expected.** The verifier fell back to the standing rules embedded in its role prompt. Evidence: verify-e2e-r1-findings.md line 5; verify-e2e-r2-findings.md line 4. Frequency: both e2e rounds. Cost: minor; fallback worked.

## Model behaviour

- **F9 — The verifier base-diffed every suspected regression before blocking.** For the 15 route-test failures it added a detached worktree at merge-base, linked node_modules, and proved 30/30 pass at base before calling the break a branch regression; it did the same to clear the focus-ring and flake failures as pre-existing. Evidence: verify-e2e-r1-findings.md lines 17-43, 63-67. Frequency: both rounds. Cost: extra base runs, correctly spent (this is desired behaviour, logged for the pattern).

## Process deviations and rulings

- **F10 — Review coverage gap: task 13 logged but unreviewed; merge allowed (decision C / retro P9).** Completion proceeded with reviewCoverage 12/13. Evidence: retro log 2026-10-29T16:47:41Z (deviation); HANDOFF Coverage row. Frequency: once. Cost: merge allowed, 1 task unreviewed.
- **F11 — Nine tasks took a gate-only review, verifier-skipped (retro P6/P15).** Tasks 1,2,3,4,5,8,9,12,13 were closed on the gate alone; only tasks 6,7,10,11 drew a verifier. Evidence: HANDOFF Verifier-skipped row; event roles ("verify task 6/7/10/11"). Frequency: once this spec. Cost: 4 verifier spawns instead of 13. Also seen in dashboard-loop-views.
- **F12 — Operator ruling on the task 1 file-list.** The operator ruled tasks.md v2 correct in listing git-utils.test.ts and directed a no-op re-verify of 5a2f67b5. Evidence: impl-brief-repair-2.md Operator rulings; spec commit 88c47fff. Frequency: once. Cost: see F1.

## Decisions the harness made for the human

- **F13 — The blocking e2e regression was fixed in the test fixtures, not in product code.** The implementer judged the startup missing-path prune (R4 AC1) correct and the fixtures wrong — they registered a `*-workspace` path never created on disk, an impossible production state — so three route fixtures now mkdir the workspace dir; narrowing the prune was rejected as contradicting AC1. Evidence: impl log task-6 1638; commit 861de022. Frequency: once. Cost: +11 lines, 1 repair round.
- **F14 — A pre-existing failing e2e test was admitted past the gate as not-a-regression (D9).** `worktree-visual.spec.ts` focus-ring contrast (1.0681, <3 on the runs-view ctrl-discard button) fails identically at merge-base and belongs to dashboard-visual-refresh; the verifier passed the merge. Evidence: verify-e2e-r2-findings.md lines 29-38. Frequency: both rounds. Cost: merge proceeded.

## Repeat patterns

- **F10 ↔ dashboard-visual-refresh F19/F20, tdd-task-loop retro:121, lean-orchestrators retro:128.** A logged review-coverage gap is noted for the human and the merge proceeds (decision C / P9). Evidence: this spec retro log 2026-10-29T16:47:41Z; dashboard-visual-refresh/retrospective.md:98-104.
- **F11 ↔ dashboard-loop-views F12.** A task closed on a gate-only review with the verifier skipped. Evidence: HANDOFF Verifier-skipped row; dashboard-loop-views/retrospective.md:97-99.
- **F14 ↔ advisor F17, dashboard-visual-refresh F21.** Pre-existing full-suite/e2e failures admitted past the gate under D9. Evidence: advisor/retrospective.md:92-94; dashboard-visual-refresh/retrospective.md:106.
- **F14 (base-fail) ↔ agent-rules "fails at base in 2+ specs".** The focus-ring e2e test now fails at base in dashboard-visual-refresh and here; the rule says the next decomposition adds a tracked fix task rather than treating it as an eternal D9 signal. Evidence: verify-e2e-r1-findings.md:63-67; verify-e2e-r2-findings.md:29-38.
- **F6 ↔ agent-cache-ttl, dashboard-shell, graph-orientation, lean-orchestrators, verification-loop retros.** Ledger/usage counts are floors, not totals. Evidence: those retros' summary sections; this spec retro log cleanup entry.
- **F2 ↔ advisor.** `SPEC_WORKFLOW_SHARED_ROOT` leaking into verification and needing an explicit unset. Evidence: advisor/retrospective.md; verify-e2e-r1-findings.md:5-7.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation (retro open) |
| Versions per phase | req v3, design v3, tasks v2 |
| Review rounds | req 3, design 3, tasks 1 |
| Fix rounds | 0 per-task; 2 phase repair rounds (round 1 no-op ruling, round 2 fixture fix) |
| e2e verification rounds | 3 (r0 fail, r1 blocking, r2 pass) |
| Adjudications | 0 (1 design v3 SHOULD_FIX-only corrective pass + narrow check) |
| Escalations | 0 |
| Rulings | 1 (task 1 file-list) |
| Deferrals added | 1 (d-960bb37e); ledger reported 0 |
| Spawns | 59 (floor) |
| TDD | 12 tasks (assertion-red 4, structural-red 8); task 13 implementer-only |
| Verifiers | 4 (tasks 6,7,10,11); 9 gate-only |
| PR | #191, merged |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  Eval case: <case id — what its grader checks | none — why>. Required when Target is
  harness skills or agents, or server code, docs or templates.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs' findings,
each proposed for promotion into a steering document or agent-rules.md, with the rule text as
it would be written.
