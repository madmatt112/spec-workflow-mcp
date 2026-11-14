# Adversarial Analysis — dashboard-plain-pages/design (v2, round 2)

Primary surface: feasibility, consistency, edge cases. Fresh lens this round: none specified.
Directives applied: attack the v2 delta first (fix-induced re-check of R1-1 and R1-2), error-branch
shape, Data-Models completeness, library-capability probing.

## The v2 delta (two changes, both round-1 fixes)

Per the Revision History and the diff from `89514571`, v2 changed exactly two clauses:
1. **C7 check 4** (R1-1): the missing-record 404 now states `{ error: 'Deferral not found' }`
   (matching check 3).
2. **C6 step 4** (R1-2): the fit guard gained `remaining != null`.

Both are the round-1 findings. I scoped each to its fix diff against the requirement it must satisfy
(fix-induced re-check), not a whole re-review.

### R1-1 re-check — PASS

C7 check 4 now reads: `storage.get(id)` null + `fileExists(id)` false → 404 `{ error: 'Deferral not
found' }`; `get` null + file exists → 409 reindex message. Verified against live code:
- `get` (`deferral-storage.ts:272-275`) returns null when `read` is **missing or corrupt**.
- `fileExists` (`:485-492`) disambiguates: missing → false (404), corrupt-present → true (409).
- The 409 arm cites "the reindex message of `src/core/deferral-storage.ts:196-199`"; that range is
  exactly the `loadForWrite` corrupt-branch throw ("exists on disk but its frontmatter could not be
  parsed … Run the deferrals 'reindex' action"). Citation correct.

Every C7 branch now pins both status and error-body discriminant (400 invalid-resolution; 404 Project
not found; 404 Deferral not found ×2; 409 reindex; 409 already-`<status>`; 409 handler `message`). The
error-branch directive is satisfied; the C10 blank-reason race is closed.

### R1-2 re-check — PASS

C6 step 4's guard now requires `remaining != null`. `remaining = total − completed` of
`parseTaskProgress` (`task-parser.ts:553-568`), which always returns numbers — so `remaining` is null
only when `tasks.md` is unreadable and the builder assigns null, exactly the torn/missing case the C6
post-condition and the Reliability NFR name. In JS the old guard let `use/done × null → 0 ≤ headroom`
render a bogus "fits"; the added clause now falls to `null` ("not known yet"). Consistent with the
post-condition and NFR. No new inconsistency introduced: `UsageRunLine.remaining` is still
`number | null`, and fit is computed only in the implementation phase.

## Fresh pass — load-bearing claims the delta leans on (all hold)

- **Ledger `task.done` row carries `run`.** C6 computes `done` as distinct `task` in `task.done` rows
  "whose `run` is the run's id." `ledger.ts:102-108` injects `run: runId` into every row via the
  shared `write`, and `taskDone` (`:160-166`) goes through it. The by-run-id count is computable. ✓
- **`totalW` export.** `runs.ts:585-587` is a module-private `function totalW(t: TokenTotals)`;
  "`totalW` becomes an export" is accurate and necessary. ✓
- **`RateLimitWindow` shape.** `state.ts:239-244` is exactly `{ utilization: number; resetsAt: string }`;
  C6 step 1's `window = readRateLimit()'s sevenDay`, the `window.resetsAt`-in-future guard, and the
  `UsageView.window` field all match the real type. ✓

## What I did not re-raise

- C2/D13 run-id mechanism, Data-Models completeness, and the D25/D20 flagged departures — round 1
  traced and cleared these; no delta touched them.
- C7 does not state `storage` construction (`new DeferralStorage(project.projectPath)`); carried as a
  tasks-phase non-finding from round 1, not a design defect.

## One MINOR (does not keep the loop alive)

- **[design] C7 check 4b body wrapper is implicit.** The 409 corrupt arm says "with the reindex
  message" rather than spelling the `{ error: <message> }` wrapper that C10 reads via `reply.error`.
  Every sibling branch uses `{ error: … }`, so the intent is unambiguous; pin the wrapper in tasks if
  convenient. Not a defect.

## Closing deliverables

**Top risks/gaps (short doc → 3):** none open. R1-1 and R1-2 are resolved and verified; the delta
introduced no regression.

**Top conclusions to challenge:** none survive. The two round-1 reversals ("missing ledger/tasks.md
gives a null field" and "the C7 check list is complete") are now true as written.

**What's missing before acting:** nothing at the design layer. For tasks: assert the `error` body in the
404-unknown-id resolve test and name `new DeferralStorage(project.projectPath)` (both already flagged).

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
