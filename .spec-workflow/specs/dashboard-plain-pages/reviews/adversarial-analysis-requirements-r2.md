# Adversarial Analysis — dashboard-plain-pages/requirements (v2, round 2)

Deltas-first review. Fresh lens: none (set by the prompt). Round 1 used the
wire-contract lens and raised R1-1..R1-5; v2 accepted all five. This round
attacks the v2 delta itself — every clause the five fixes wrote — and re-checks
each round-1 seam for a residual.

## What I checked and how

Read the target, `codebase-context.md`, `agent-rules.md`, the round-1 analysis
and the memory file. The v2 delta touched the Introduction, Alignment, Req 3
AC1, Req 4 AC8, Req 5 AC1, Req 7 AC3, the Performance/Reliability NFRs, the D5/D7/D8
option lists, the Scope notes and the Revision History. Every citation the delta
added or moved, verified both ends in the worktree:

- `src/controller/step.ts:461` (new) — `if (spec.runId) env.SDD_RUN_ID = spec.runId;`. `spec.runId` is optional, guarded by `if`. **Accurate.**
- `src/controller/step.ts:499-502` — the `rate_limit_event` branch calls `spec.onRateLimit?.(lastRateLimit)` (windows only). `spec` is in scope, so `spec.runId` is reachable there. **Accurate.**
- `src/controller/runs.ts:405-406` — `onRateLimit(windows: RateLimitWindows): void;`, doc-comment "from a step or the supervisor stream". Windows only, no run id, and the supervisor case is real. **Accurate.**
- `src/dashboard_frontend/src/modules/projects/stores.ts:16-22` / `:39` — `pickRepresentative` (project whose `projectPath` is the store, else first by name/id) and the enabled-if-any-member rule. **Accurate.**
- Shared-store resolve claim (Req 7 AC3): `DeferralStorage` keys its dir on `PathUtils.getWorkflowRoot(projectPath)` (`deferral-storage.ts:23`); the backend route resolves `projectId → project.projectPath → getWorkflowRoot` (`multi-server.ts:600-607`, `buildDeferralsPayload` at `:459-468`). Two members of one store share a `workflowRootPath`, so every member resolves to the same `deferrals/` file. **Claim true.**
- `controller-runs` push (Req 5 AC1): `ShellProvider.tsx:77,87` subscribes one global `controller-runs` topic and sets `controllerRuns` with no enable filter. **"Account-wide, unfiltered by enable state" holds today.**

The null-`run`/burn/fit logic in the new AC1 clause is internally consistent:
D7 burn sums positive steps across *all* consecutive lines (no run filter), so a
null-`run` line counts; D8 fit sums only lines whose later line carries the run's
id, so a null-`run` line is excluded. No contradiction there.

No misstated artifact. The one real defect is an inconsistency the R1-1 fix
introduced *between its own two edits*.

## Topics attacked

### 1. The R1-1 fix: Introduction vs Left-to-the-design (Req 3, Introduction, Scope)

- **Challenge the Introduction's new claim that the usage log "threads the emitting run's id through the rate-limit callback."** The v2 delta added this clause to the Introduction. The rate-limit callback is `onRateLimit` (`runs.ts:405-406`), which carries windows only. "Threads the run id through the callback" describes exactly one implementation — changing the `onRateLimit` signature.
- **Stress-test it against the Left-to-the-design bullet the same fix wrote.** That bullet says the run-id path is undecided: "change the windows-only `onRateLimit` signature at `src/controller/runs.ts:405-406`, **or** write the line from `src/controller/step.ts:499-502`, where `spec.runId` is in scope." Option two does **not** thread the id through the callback — it reads `spec.runId` directly at the event branch and leaves `onRateLimit` windows-only. The Introduction has pre-decided a choice the Scope section explicitly keeps open.
- **Name the failure.** An approver reads the Introduction and signs off believing the callback-signature approach is settled. The design phase reads Left-to-the-design and is free to pick the `step.ts`-direct write (the lower-blast-radius option — no five-interface signature change). The Introduction is then a false summary of what shipped. This is a self-contradiction, created by the v2 delta, in the two clauses one fix wrote.

### 2. The R1-2 fix: Req 4 AC8 "the usage route" vs the deferred transport

- **Stress-test "refetch its figures — the window, the burn and the per-run fits — from the usage route" (AC8, singular definite article) against AC1–AC3.** AC1–AC3 key the window on `rate-limit.json` (the `/api/controller/rate-limit` passthrough). Left-to-the-design offers two transports: extend `/api/controller/rate-limit`, **or** add a route. If the design adds a separate route for burn/fits, the window keeps coming from the rate-limit route and there are *two* usage routes — so "the usage route" (one) is only accurate under the extend option.
- **Weigh it.** Softer than topic 1: "the usage route" reads loosely as "whatever route serves usage figures," and the transport is openly deferred. It narrows the deferred choice by implication, not by assertion. MINOR, not loop-keeping.

### 3. Re-check of R1-3, R1-4, R1-5 — resolved

- R1-3: the D7 burn deviation is now in the decomposition-delta note ("D7 redefines burn from the entry's utilisation delta over 24 h to the sum of positive steps, differing when a reset falls inside the 24 h"). **Resolved.**
- R1-4: Req 7 AC3 now names the representative `projectId`, with the shared-store justification I verified true above. **Resolved.**
- R1-5: Req 5 AC1 now states the push is account-wide; verified consistent with `ShellProvider`. **Resolved.**

### 4. Option-list trims (D5, D7, D8) — probed, fine

The v2 delta collapsed rejected-option wording (D5 "only the origin-spec record, only the entry text" → "a single source"; D8 dropped "(it counts other runs' spend)"). Each chosen-rationale clause is intact and no citation moved. No defect.

## Top 3 risks / gaps

1. **[drafting] SHOULD_FIX — the Introduction pre-decides the run-id mechanism the Scope section defers (Req 3 / Introduction / Scope).** `Compounds: R1-1`, fix-induced. The Introduction says the log "threads the emitting run's id through the rate-limit callback"; Left-to-the-design says that path is one of two open options (callback-signature change, or a direct `step.ts` write that never touches the callback). *Failure:* design picks the `step.ts`-direct write, and the Introduction's description of the shipped writer is false; an approver reconciling summary against scope sees the document disagree with itself.
2. **[drafting] MINOR — Req 4 AC8's "the usage route" (singular) leans to the extend-rate-limit transport option.** `Compounds: R1-2`. AC1–AC3 source the window from `rate-limit.json`; if the design adds a separate burn/fit route, two routes serve usage and AC8's single "the usage route" mis-describes the flow.
3. Nothing else. All v2-touched citations verified; R1-3/4/5 resolved; D7/D8 null-run logic internally consistent.

## Top conclusions to challenge or reverse

1. **"The usage log threads the emitting run's id through the rate-limit callback" (Introduction). Reverse to match the Scope section.** State the run id reaches the line without naming the callback, since the path is deferred and one option bypasses the callback entirely.
2. **"Refetch … from the usage route" (4 AC8). Challenge the singular.** Either commit the design to one extended route, or word AC8 so it does not presume a single transport the Scope section has not chosen.

## What's missing — do before acting

- Reword the Introduction's parenthetical so it does not commit to the callback mechanism (align it with the two-option Left-to-the-design bullet).
- Optionally relax 4 AC8's "the usage route" to not presume a single transport.

## Standing-directive checks

- Deltas-first: attacked every v2-changed clause; the only live defect sits in text the R1-1 fix wrote.
- Closed rulings (lint L-1..L-7) not re-opened.
- ESCALATE: the resolve route is the only mutation — same auth/CORS hooks, `resolution` string only, trimmed and ≤2,000 chars, no shell, no secrets, no destructive migration. Nothing for a human now.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
