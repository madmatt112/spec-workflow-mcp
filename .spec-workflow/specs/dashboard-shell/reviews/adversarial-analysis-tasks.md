# Adversarial Analysis — dashboard-shell/tasks (v1), Round 1

Primary surface: atomicity, ordering, coverage. Fresh lens: task-to-requirement/design
coverage. First review of this document.

## What I checked and how

**Delta citations (the v1 lint commit, re-verified at both ends).** All clean — the lint
changes were cosmetic (bare root-file paths lost an uncitable line suffix; the rest gained
a directory prefix), no meaning moved:
- `src/core/gate-rules.ts:31` = `RISK_LINE_THRESHOLD = 200` (confirmed).
- `tsconfig.json:20` excludes `src/dashboard_frontend/**`; `vitest.config.ts:7-8` excludes
  the frontend (confirmed; both now cited bare).
- `src/dashboard/harness/overview-watch.ts:44-48` = `isInside`, `:243-246` =
  `pointerForProject` (confirmed, the copied pointer rule of D9).
- `src/dashboard/harness/__tests__/project-watch.test.ts:373-376` = `stubLauncher`
  (confirmed).
- `src/dashboard/__tests__/harness-routes.test.ts:104-141` = waitFor/connect/collect/send
  helpers; `:153-202` = two-project live fixture with temp `XDG_STATE_HOME` (confirmed).
- `src/dashboard_frontend/src/modules/pages/HarnessPage.tsx:10-29` = `callHarness`,
  `:211-226` = `buildInput`/roles, `:228-244` = `runOp`/launch post (confirmed).
- `playwright.worktree.config.ts:8-11` sets `SPEC_WORKFLOW_HOME`, `:39-61` = the two web
  servers' env; `playwright.worktree-pattern.ts:21` = `WORKTREE_SPEC_PATTERN`;
  `e2e/worktree-no-shared.spec.ts:23-63` = the two-worktree setup (confirmed).

**Load-bearing non-delta claims spot-checked (context file is drafter-written):**
- "newest open level-2 spawn" is grounded: `ledger.ts:297` sets `level = agent.endsWith
  ('-orchestrator') ? 1 : 2`, so level-2 = worker spawn. Not an invented term.
- `run-setup.ts:167-168` are exactly `launchable` and `disabledReason` (task 3's citation
  is tighter than the design's `166-168`, and correct).
- `ledger.ts:423` reads the `rounds` key on `task.done`; `:428` reads `text ?? note` on a
  `note` (task 5 risk/fixRounds derivation grounded).
- Route registrations in `multi-server.ts` use `this.app.<method>('PATH', async …)`, so
  task 16's invariant grep `this.app.get|put|post|delete('PATH'` is viable; the new
  `/api/shell/projects/:projectId/specs/:specName` is absent at base (route add is real,
  Requirement 6 AC 6 subset check holds).
- `deferral-change` at `multi-server.ts:491-507` currently calls `broadcastToProject`
  (task 7 replaces it with the overview-reaching send of D12).

**Coverage matrix (every task's `_Requirements:` line against all ACs).** Every acceptance
criterion of Requirements 1–8 maps to at least one task, and every design component
C1–C12 plus the invariants/operator-evidence maps per the intro paragraph. No orphan AC,
no orphan component.

**Success-clause coverage (retro P7).** Every test named in each task's `Task:` body also
appears in that task's `Success:` clause (tasks 1–7 enumerate case-for-case; tasks 8, 14
use a blanket "every case named in this prompt" back-reference). No silently dropped test.

**`Test:` line assertability.** Each `Test:` call (`new FileCache()…`, `gateOrRuling`/
`deriveProjectWaits`/`orderWaits`, `buildNowModel`, `buildSpecRows`/`buildSpecDetail`,
`buildRunDetail` + `ProjectHarnessWatch`, `ShellFeed`, the live `shell-routes` server) is
defined in the design interfaces, and its success criteria are assertable with values the
requirements state.

**Gate B / Gate C.** No task introduces a new npm/external dependency (task 13 and the
Playwright reuse are explicitly dependency-neutral) — no `[gate-b]` finding. No task
exceeds the approved requirements; the few non-requirement details (disconnected marker,
`generatedAt`) are design-sourced (C9 / Data Models), not scope invention — no `[gate-c]`
finding.

**Ordering.** Server tasks 1–7 precede frontend 8–14 (D10); the stub-then-replace chain
(task 8 stubs → 9/10/11/12 replace → 13 removes legacy → 14 e2e) is acyclic and the build
stays green at each step (D2 bundles only imported modules). The worktree e2e suite is run
only where named (tasks 8, 12, 14); at each point the matched `worktree-*.spec.ts` set is
consistent with what exists. No cycle, no forward reference that breaks build order.

## Findings

### R1-1 — MINOR — Dependency paragraph understates the task-2 edges
The "Dependency order" paragraph says only "task 3 uses the task 2 waits". In fact both
task 3 (live-row pointer) and task 4 (`live` spec state) consume **the pointer-matching
helper task 2 exports** — each task prompt says "the helper task 2 exports". Build order
(2 < 3 < 4) still holds and the prompts carry the real edges, so nothing breaks; the
summary paragraph is just incomplete.

### R1-2 — MINOR — `NowModel.generatedAt` has no stated value or test
The Data Models block makes `generatedAt: string` a required `NowModel` field, but task 3's
prompt neither names its value nor a test for it (it enumerates waits/live/idle/closed/
runs/launches only). `tsc` forces the implementer to populate it, and the Now page ticks
ages from browser time (OverviewPage pattern), so the field is low-risk, but its intent is
unstated.

### R1-3 — MINOR — "a new launch clears the exited wait" is not a named test case
Requirement 2 AC 4 ends "A new launch for the project SHALL clear it." Task 2's
`waits.test.ts` enumeration covers exited with a null run id, with a run id and no
`run.end`, and with a `run.end` (clears), but not the state→`running` clear path. It is
covered implicitly (state ≠ `exited` derives no wait), just not asserted.

## Top risks/gaps
1. None at MUST/SHOULD level. The three MINORs above are documentation/test-naming polish.

## Conclusions to challenge
1. The claim "every task leaves the dashboard build green" is sound only because D2 bundles
   imported modules and the stubs are routed — verified, not a gap.
2. "14 verifier runs" is an internally consistent planning estimate (6 new-module + 8
   >200-line), not a load-bearing claim; tasks 15 (docs md) and 16 (verification-only) are
   plausibly low risk.
3. Task 8 is large (all of C9 + Usage + NotificationProvider trim + e2e rewrite) with only
   a build/i18n/toggle-e2e seam, but this is the accepted D2/D4 tradeoff (frontend has no
   vitest harness), not a defect to reverse.

## What's missing before acting
Nothing blocking. Optionally fold R1-1 into the dependency paragraph and name the
`generatedAt`/new-launch-clear cases when the implementer writes tasks 2 and 3.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
