# lean-fixture live run — usage and comparison (Requirement 8.3)

The Requirement 8.2 live run of `lean-fixture` on the merged checkout, recorded here
because the staged root under `/tmp/scratchpad` does not survive a restart.

- Date: 2026-10-05
- Run: `run-20261005-141456`, supervisor `claude-opus-5-5`, headless `claude -p`, launched
  by Matthew from a terminal (a nested launch from a session is denied by the auto-mode
  classifier)
- Checkout: `f7806cf` (PR #81 merge), `dist/` rebuilt after the merge
- Wall clock: `run.start` 2026-10-05T14:15:13Z, `run.end` 2026-10-05T15:38:37Z (1h23m)
- Final status line: `lean-fixture-code:lean-fixture retrospective DRAFT — plan needs
  decisions; AskUserQuestion unavailable`
- Ledger copy: `e2e/lean-fixture-harness-events.jsonl` (167 rows, 30 `spawn.start`,
  35 `spawn.end`); stdout: `e2e/fixture-run.log`; the fixture's own retrospective and
  proposals: `e2e/lean-fixture-retrospective.md`, `e2e/lean-fixture-retrospective-proposals.md`

## Per-unit comparison against baseline-sources.md

Orchestrator W per unit (review round for document phases, task for implementation).
Baseline figures are the `orch W/round` and `orch W/task` values in `baseline-sources.md`.

| Phase | Units | lean-fixture orch W/unit | tdd-task-loop | delta | trading-rules | delta |
| --- | --- | --- | --- | --- | --- | --- |
| requirements | 2 rounds | 305,756 | 617,969 | −50.5% | 280,838 (1 of 2 spawns unknown) | +8.9% |
| design | 1 round | 357,812 | 790,186 | −54.7% | unknown | — |
| tasks | 1 round | 354,169 | 1,064,380 | −66.7% | unknown | — |
| implementation | 6 tasks | 189,451 | 157,800 | **+20.1%** | 401,861 | −52.9% |

The implementation figure is the one worse signal (D9 finding for Matthew). The 5-task
budget split 6 tasks over two implementation orchestrator spawns: spawn 1 did tasks 1-5
for W 760,991 (152,198 per task, −3.6% against tdd-task-loop); spawn 2 did task 6 plus
the end-to-end gate for W 375,714, of which base (163,847) and skill (85,971) are a fixed
per-spawn prefix. tdd-task-loop's baseline ran its 17 tasks in one spawn.

## Quality signals (Requirement 8.4)

| Signal | lean-fixture | tdd-task-loop baseline |
| --- | --- | --- |
| Review rounds (requirements / design / tasks) | 2 / 1 / 1 | 3 / 2 / 1 |
| MUST_FIX at convergence | 0 / 0 / 0 | 0 / 0 / 0 |
| Fix rounds, all tasks | 0 | 2 |
| Escalations, errors, design defects | 0 | 0 |
| Wall clock per review round (min) | 7.7 / 10.1 / 9.9 | 27.2 / 41.2 / 44.9 |
| Wall clock per task (min, mean) | 4.7 | 8.9 (tasks 1-17) |

Wall clock per task is 47% below baseline, inside the 15% bound. None of the quality
signals is worse. Not like-for-like: the fixture's documents and tasks (six string helpers)
are far smaller than tdd-task-loop's.

## Findings recorded in the retro log

1. `sdd-reviewer` spawns have no `spawn.start` row and `unknown` tokens in `usage`, in
   the fixture and in both baselines alike: the activity hook keys `spawn.start` on a
   `-brief` prompt path, and reviewers launch from a `reviews/` prompt path. Their
   `spawn.end` rows (4, one new agentId per round) show the fresh spawn per round.
2. No PR: the staged fixture has no git remote, so the kit cannot show the "exactly one
   PR" half of (2). This spec's own PR #81 evidences the PR path.
3. The supervisor recorded `headless=no` under `claude -p` and only found at the
   retrospective that AskUserQuestion was unavailable (plan written DRAFT).
4. The gate B HANDOFF row landed outside the phase-log table in the fixture store
   (overwatch repaired it in the fixture's commit 22355f3).

## usage lean-fixture (verbatim)

```
usage lean-fixture  runs 1  spawns 34  tokens 17,894,232
phase | agent | spawns | tokens | W | cw5m | cw1h | gapRewrites | graph
requirements | sdd-document-orchestrator | 2 | 2,633,037 | 611,512.7 | 0 | 120,712 | 0 | 0
requirements | sdd-drafter | 1 | 151,399 | 82,941.05 | 23,297 | 0 | 0 | 0
requirements | sdd-reviewer | 2 | 0 | 0 (+2 unknown) | unknown | unknown | unknown | 0
requirements | sdd-reviser | 1 | 198,917 | 90,091.25 | 27,807 | 0 | 0 | 0
requirements | total | 6 | 2,983,353 | 784,545 (+2 unknown) | 51,104 | 120,712 | 0 (+2 unknown) | 0  orch 88.3%  in 136 out 40,401 cw 171,816 cr 2,771,000  anthropic 2,983,353  deepseek 0  orch W/round 305,756.35
design | sdd-document-orchestrator | 1 | 1,478,985 | 357,811.7 | 0 | 64,445 | 0 | 0
design | sdd-drafter | 1 | 310,650 | 123,397 | 33,288 | 0 | 0 | 0
design | sdd-reviewer | 1 | 0 | 0 (+1 unknown) | unknown | unknown | unknown | 0
design | total | 3 | 1,789,635 | 481,208.7 (+1 unknown) | 33,288 | 64,445 | 0 (+1 unknown) | 0  orch 82.6%  in 78 out 28,867 cw 97,733 cr 1,662,957  anthropic 1,789,635  deepseek 0  orch W/round 357,811.7
tasks | sdd-document-orchestrator | 1 | 1,546,269 | 354,168.8 | 0 | 64,850 | 0 | 0
tasks | sdd-drafter | 1 | 316,179 | 110,329 | 35,242 | 0 | 0 | 0
tasks | sdd-reviewer | 1 | 0 | 0 (+1 unknown) | unknown | unknown | unknown | 0
tasks | total | 3 | 1,862,448 | 464,497.8 (+1 unknown) | 35,242 | 64,850 | 0 (+1 unknown) | 0  orch 83.0%  in 78 out 23,355 cw 100,092 cr 1,738,923  anthropic 1,862,448  deepseek 0  orch W/round 354,168.8
implementation | sdd-implementation-orchestrator | 2 | 6,367,113 | 1,136,705.1 | 0 | 149,514 | 0 | 0
implementation | sdd-implementer | 6 | 1,239,717 | 374,079.1 | 103,790 | 0 | 0 | 0
implementation | sdd-test-author | 6 | 1,771,053 | 531,520.55 | 141,823 | 0 | 0 | 0
implementation | sdd-verifier | 6 | 1,178,152 | 564,856 | 181,258 | 0 | 0 | 0
implementation | total | 20 | 10,556,035 | 2,607,160.75 | 426,871 | 149,514 | 0 | 0  orch 60.3%  in 618 out 158,372 cw 576,385 cr 9,820,660  anthropic 10,556,035  deepseek 0  orch W/task 189,450.85
retrospective | sdd-retro-analyst | 1 | 74,096 | 47,433.45 | 16,093 | 0 | 0 | 0
retrospective | sdd-retro-orchestrator | 1 | 628,665 | 175,894.65 | 57,007 | 0 | 0 | 0
retrospective | total | 2 | 702,761 | 223,328.1 | 73,100 | 0 | 0 | 0  orch 89.5%  in 38 out 14,072 cw 73,100 cr 615,551  anthropic 702,761  deepseek 0  orch W/round -
total |  | 34 | 17,894,232 | 4,560,740.35 (+4 unknown) | 619,605 | 399,521 | 0 (+4 unknown) | 0  in 948 out 265,067 cw 1,019,126 cr 16,609,091  anthropic 17,894,232  deepseek 0

sources lean-fixture  spawns 6  unknown 0  (shares are estimates; W totals are floors)
requirements | sdd-document-orchestrator | a7a48f6bfb34f525b | calls 18 | peak 61,197 | W 248,449 | ledger W 248,449 | diff -0.00%
  base | 130,947 | 52.7%
  own-output | 51,550 | 20.7%
  skill | 45,355 | 18.3%
  bash | 13,879 | 5.6%
  prompt | 3,130 | 1.3%
  worker-report | 1,398 | 0.6%
  mcp:spec-lint | 1,317 | 0.5%
  mcp:harness.brief | 592 | 0.2%
  mcp:harness.orient | 281 | 0.1%
requirements | sdd-document-orchestrator | aae9f3327cd9eb86e | calls 32 | peak 70,650 | W 363,063 | ledger W 363,063 | diff 0.00%
  base | 160,313 | 44.2%
  own-output | 91,047 | 25.1%
  skill | 65,567 | 18.1%
  mcp:adversarial-review | 27,739 | 7.6%
  worker-report | 5,056 | 1.4%
  prompt | 4,235 | 1.2%
  bash | 3,075 | 0.8%
  mcp:spec-lint | 2,095 | 0.6%
  mcp:harness.brief | 1,584 | 0.4%
  mcp:approvals.request | 608 | 0.2%
  mcp:approvals.approve | 453 | 0.1%
  mcp:harness.orient | 449 | 0.1%
  mcp:approvals.list | 339 | 0.1%
  mcp:approvals.prune | 332 | 0.1%
  read:spec-store | 120 | 0.0%
  tool:Edit | 53 | 0.0%
design | sdd-document-orchestrator | af46f6d275f4081b7 | calls 26 | peak 75,578 | W 357,812 | ledger W 357,812 | diff 0.00%
  base | 147,193 | 41.1%
  own-output | 105,354 | 29.4%
  skill | 67,721 | 18.9%
  mcp:adversarial-review | 10,705 | 3.0%
  bash | 8,107 | 2.3%
  mcp:spec-lint | 7,464 | 2.1%
  worker-report | 4,623 | 1.3%
  prompt | 4,026 | 1.1%
  mcp:harness.brief | 1,062 | 0.3%
  mcp:approvals.request | 533 | 0.1%
  mcp:harness.orient | 397 | 0.1%
  mcp:approvals.approve | 370 | 0.1%
  mcp:approvals.prune | 258 | 0.1%
tasks | sdd-document-orchestrator | aa6b35e8067565f14 | calls 27 | peak 75,983 | W 354,169 | ledger W 354,169 | diff -0.00%
  base | 150,053 | 42.4%
  own-output | 92,264 | 26.1%
  skill | 63,811 | 18.0%
  bash | 23,790 | 6.7%
  mcp:adversarial-review | 10,911 | 3.1%
  prompt | 3,855 | 1.1%
  worker-report | 3,789 | 1.1%
  mcp:spec-lint | 2,554 | 0.7%
  mcp:harness.brief | 1,033 | 0.3%
  mcp:approvals.request | 694 | 0.2%
  mcp:approvals.approve | 545 | 0.2%
  mcp:approvals.prune | 407 | 0.1%
  mcp:harness.orient | 374 | 0.1%
  mcp:harness.gate | 88 | 0.0%
implementation | sdd-implementation-orchestrator | a6554ee0d303ee60c | calls 69 | peak 88,407 | W 760,991 | ledger W 760,991 | diff -0.00%
  base | 303,572 | 39.9%
  own-output | 212,885 | 28.0%
  skill | 140,961 | 18.5%
  worker-report | 37,681 | 5.0%
  bash | 26,937 | 3.5%
  mcp:review-task.gate | 17,944 | 2.4%
  prompt | 8,065 | 1.1%
  mcp:harness.brief | 7,074 | 0.9%
  mcp:harness.orient | 5,872 | 0.8%
implementation | sdd-implementation-orchestrator | a7a55fdaa151994f5 | calls 31 | peak 73,543 | W 375,714 | ledger W 375,714 | diff -0.00%
  base | 163,847 | 43.6%
  own-output | 96,053 | 25.6%
  skill | 85,971 | 22.9%
  bash | 12,271 | 3.3%
  worker-report | 7,131 | 1.9%
  prompt | 3,982 | 1.1%
  mcp:review-task.gate | 2,447 | 0.7%
  mcp:harness.orient | 1,982 | 0.5%
  mcp:harness.brief | 948 | 0.3%
  mcp:spec-index.generate | 795 | 0.2%
  mcp:spec-status | 235 | 0.1%
  mcp:deferrals.list | 51 | 0.0%
```
