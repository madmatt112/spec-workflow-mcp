# Adversarial Analysis — dashboard-plain-pages/design (v1, round 1)

First review of the design. Primary surface: feasibility, consistency, edge cases.
Applied directives this round: re-verify every citation the v1 lint commit changed
(the whole `## Changes since` section), Data-Models completeness, error-branch shape,
library-capability probing. Fresh lens: none specified.

## What I checked and how

- Read `codebase-context.md`, the design, the requirements (v3), the decomposition
  entry 34, and `agent-rules.md`.
- Re-verified every citation the lint pass changed against the live code under the
  worktree:
  - `controllerHome` — `state.ts:292-297` (292 is the JSDoc line; function 293-297). Correct.
  - run-ledger `appendFileSync` — `ledger.ts:107`. Correct (the actual `appendFileSync` call).
  - `FileCache` — `file-cache.ts:16-48` (class opens at 16; `.text`/`.jsonl` are what C3 reuses). Correct.
  - phase `onRateLimit` types — `document.ts:182`, `implementation.ts:96`, `closeout.ts:62`,
    `retrospective.ts:41`, `merge-fix.ts:50`. All confirmed one-parameter declarations.
  - frontend anchors — `SpecsPage.tsx:32-39` (STATE_TONE), `UsagePage.tsx:95-102` (controller-runs
    refetch), `:117-120` (1 s tick), `DeferralsPage.tsx:54-57` (recordsOf), `:211` (deferral-row id).
    All confirmed. Lint delta was path-prefix only; ranges unchanged and correct.
- Probed the load-bearing new-mechanism claims in code: `StepSpec.onRateLimit`/`runId`
  (step.ts:135/127), the `rate_limit_event` branch (step.ts:499-502), `RunDeps.onRateLimit`
  (runs.ts:406), `controller.runDeps().onRateLimit` (controller.ts:732), `persistRateLimit`
  (790-803), `listRunsSync` (state.ts:382), `readRateLimit` (593-599, async, returns `undefined`),
  `liveRunsByProject`, `RunRecord` fields, `totalW`, `parseTaskProgress`, `DeferralStorage`
  (get/resolve/loadForWrite/constructor keys on the workflow root), the existing resolve/
  wait-answer route patterns, and `storeGroups`/`storeOf`.

The deltas since the checkpoint are clean: all citation range/prefix fixes verify, and the
only prose change (dropping the "It reuses…" sentence from the Overview) is harmless.

## Attack 1 — C7 resolve route: the missing-record 404 has no body

The route enumerates six ordered checks, and every branch but one pins a status **and** an
error body: `{ error: 'invalid-resolution' }` (400), `{ error: 'Project not found' }` (404),
`{ error: 'Deferral not found' }` (404), the reindex message (409), `Deferral <id> is already
<status>` (409), the handler's `message` (409).

Check 4's first arm — `storage.get(id)` null **and** `storage.fileExists(id)` false → **404**
— states only the status, no error body. `storage.get` returning null for a genuinely missing
file is confirmed (`deferral-storage.ts:272-275`, `read` → `missing`), and `fileExists` false
confirms it, so the branch is reachable: a record that vanishes between the Deferrals render and
the Resolve POST (the queue is live and other sessions resolve records). The frontend contract
C10 says the box "shows the reply's `error` text"; this branch hands it no `error`, so the
operator sees a blank reason on the one error that happens in a real race. The error-branch
directive this round names exactly this shape (an unpinned discriminant on a race-adjacent
branch carried into tasks). Resolution is one line: state `{ error: 'Deferral not found' }`,
matching check 3.

- **R1-1 — MUST_FIX [design].** C7 check 4's missing-record 404 leaves its error-body
  discriminant unstated while every sibling branch pins one; the C10 frontend renders a blank
  reason for it.

## Attack 2 — C6 fit: the guard never excludes a null `remaining`

C6 step 4 computes the fit when `done ≥ 1`, `use > 0`, `window` is non-null and `resetsAt` is
in the future, as `use / done × remaining ≤ headroom`. But `remaining` is `total − completed`
of `parseTaskProgress` over the spec's `tasks.md`, and the C6 post-condition itself says "a
missing ledger or `tasks.md` gives a `null` field," echoed by the Reliability NFR ("a missing …
`tasks.md` … yields … 'not known yet'"). The guard never tests `remaining != null`.

Failure scenario: an implementation run has `task.done` ledger rows (`done ≥ 1`) and attributed
log lines (`use > 0`), the window is live, but `tasks.md` is unreadable/torn at request time, so
`remaining` is null. In JS `use/done × null` evaluates to `0`, `0 ≤ headroom` is true, and the
line renders **"fits before the reset"** with a null remaining — a confident wrong verdict on
the exact signal Requirement 5 exists to give the operator, and a direct contradiction of the
Reliability NFR and C6's own post-condition. Resolution: add `remaining != null` to the fit
guard (fall to `null` → "not known yet" otherwise).

- **R1-2 — SHOULD_FIX [design].** The fit guard omits `remaining != null`; a torn/missing
  `tasks.md` with `done ≥ 1` produces a bogus "fits" instead of "not known yet".

## Attack 3 — C2 run-id callback mechanism (held up)

The whole Usage feature rides on the rate-limit log line carrying the emitting run's id. I
traced it: `StepSpec.runId` is populated on every run step (`document.ts:389`,
`implementation.ts:511`, `closeout.ts:326`, `retrospective.ts:163`, `merge-fix.ts:220`,
`gates.ts:171/258` — all `runId: ctx.run.id`), so `spec.runId ?? null` yields the id for a run
step and null for a run-less (supervisor) step, exactly as Requirement 3 AC1 claims. The
type-assignability argument also holds: a one-parameter `ctx.onRateLimit` value is assignable to
the widened two-parameter optional slot, and the runtime value flowing down is the controller's
own two-parameter function, so step.ts's second argument reaches `appendUsageLine`. No phase
file changes are needed. This is fine; the design's reasoning is correct.

## Attack 4 — flagged departures (both defensible)

- **D25 double read of `decomposition.md`.** The builder reads it once through the cache; the
  index snapshot (`IndexGenerator.snapshot`) reads it again, so the NFR's "once per flush" is
  literally missed. The snapshot read is unchanged base behaviour over a small file every 30 s;
  changing the index generator would break the spec-index invariant. Defensible, flagged, no action.
- **D20 passed-reset → "not known yet" fit.** Adds one case to Requirement 5 AC3, mirroring D9.
  Consistent, flagged, no action.

## Attack 5 — Data-Models and shared-store correctness (held up)

- Every requirement-referenced result object has a full field shape pinned in Data Models
  (`UsageLogLine`, `SpecLine`, `SpecBlock`, `UsageRunLine`, `UsageView`); none is given through
  union arms only. The resolve route's `{ ok: true }` / `{ error }` shapes are enumerated inline
  in C7 (apart from the R1-1 gap).
- Shared-store resolve (Requirement 7 AC3) is sound: `DeferralStorage`'s constructor keys on
  `PathUtils.getWorkflowRoot(projectPath)` + `/deferrals` (`deferral-storage.ts:22-24`), so the
  representative project's `projectPath` and any member's resolve to the same record file. The
  `owner` column (Requirement 6 AC2) is real: `Deferral.owner` exists (`types.ts:327`) and is
  serialized/parsed (`deferral-storage.ts:64-65,150-169`).

## Closing deliverables

**Top risks/gaps (short doc → 3):**
1. R1-1 — the missing-record 404 renders a blank error in the resolve race (MUST_FIX).
2. R1-2 — the fit guard produces a wrong "fits" when `tasks.md` is unreadable (SHOULD_FIX).
3. Non-finding to watch in tasks: C7 never states how the route obtains its `storage`
   (`new DeferralStorage(project.projectPath)`, per `buildDeferralsPayload`'s pattern). Obvious
   from base, but the tasks phase should name it so the File-list/behaviour is explicit.

**Top 3 conclusions to challenge or reverse:**
1. "a missing ledger or `tasks.md` gives a `null` field" (C6 post-condition) — **not true for the
   `fit` field** as the step-4 guard is written; the post-condition overstates the handling (R1-2).
2. The C7 check list is complete — **not quite**; check 4's missing-record arm is the one branch
   without a body, and it is the race branch the operator actually hits (R1-1).
3. Nothing to reverse in C2/D13 — I tried to break it and could not; the run-id path and the
   type widening are correct as designed.

**What's missing before acting:**
- Fix R1-1 (state the 404 body) and R1-2 (add `remaining != null` to the fit guard).
- When decomposing, state the route's `storage` construction and make the
  `deferral-resolve-route.test.ts` 404-unknown-id case assert the `error` body, so the frontend
  contract (C10 shows `reply.error`) is covered, not just the status.

## Verdict

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
