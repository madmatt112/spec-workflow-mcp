# Adversarial Analysis — dashboard-board/requirements (v1, round 1)

First review. Primary surface: completeness, ambiguity, scope. Fresh lens applied: wire contracts across a boundary (router, query params, response shapes, client state).

## What I checked and how

- Read the decomposition entry (`decomposition.md:1116-1175`) and checked the document against its scope.
- Re-probed every citation changed in the v1 lint diff and every wire-contract claim against the code, both ends of each range:
  - `ConnectionBanner.tsx:13` ✓, `Sidebar.tsx:114-121` disconnected-marker ✓ (R1 AC 8).
  - `now-model.ts:186-191` (buildNowModel / shell-now) ✓, `now-model.ts:127-133` idle omits the decomposition fallback ✓, `waits.ts:111` deriveProjectWaits ✓, `shell-feed.ts:150-158` seven topics incl. controller-activity ✓, `hub.ts:78-93` project watches ✓ (R2 AC 3).
  - `state.ts:112` prReads ✓ (R4 AC 3), `merge.ts:28` id `merge`, `merge.ts:556` `merge:<repo>#<n>` ✓.
  - `pause.ts:42-43` "pause requested" ✓ (R6 AC 6), `controller.ts:205-222` redrive accepts exactly running-stalled + drive-crash ✓ (R6 AC 4), `waits.ts:193` ✓.
  - `runs.ts:1374-1390` cancelRun writes abandoned ✓ (R7 AC 8), `runs.ts:1400-1422` discardRun has no branch guard ✓ (R7 AC 7), `runs.ts:1453-1465` toRow + `ControllerRunRow` (1428-1451) ✓ (R12).
  - `controller.ts:386-399` launchBlock + `multi-server.ts:671` nulls launchable ✓ (R8 AC 4), `multi-server.ts:662-674`, `:687` gates record ✓, `run-setup.ts:198-202` launchable fallback ✓.
  - R12 AC 1 claim "nothing writes `cursor.task`": grep over `src/controller` confirms every `cursor:{…}` write sets phase/stepKind/attempt only — true ✓.
  - `questions[0].text` exists on `ControllerWaitQuestion` (types.ts:158) ✓, `NowPage.tsx:66-78` ctrlSummary ✓, `NowPage.tsx:245-248` waits filtered by state only, not project ✓.
- **Every artifact citation in the document is accurate.** No MUST_FIX from a misstated path/range/behaviour.

## Topics attacked

### T1 — The run row's single "Discard allowed" field (R12 AC 1 × R7 AC 6/AC 7)
- Challenge the claim that one boolean "whether Discard is allowed under R7 AC 6 and AC 7" can drive both tile visibility and the Discard button.
- Stress-test the fact that `ControllerRunRow` (`src/controller/runs.ts:1428-1451`) carries **no `branch` field**, and the Security NFR forbids paths, so the frontend has no branch-presence signal other than this flag.
- Trace R7 AC 6 (stopped run with branch → tile; otherwise none) against R7 AC 7 (branch-in-use → tile, **no** Discard): "Discard not allowed" must map to two different tile outcomes.

### T2 — Writing the task id at step spawn (R12 AC 2, scope note)
- Attack the citation `src/controller/runs.ts:455-458`: `stepLifecycle.onStepSpawn` receives `{ id (step id), pid, startTime }` only — not a task id, and `startTime` is a numeric `/proc` value, not ISO.
- Stress-test the scope note's claim that design "adds" only `runs.ts` and `state.ts`.

### T3 — The wait tile's text for gate / retro waits (R4 AC 1)
- Challenge "the first line of `questions[0].text`" as a universal rule against `ctrlSummary` (`NowPage.tsx:66-78`), which summarises gate-a/gate-b/retro-plan by a **count**, not question text.
- Stress-test "the kind's fallback line" for those three kinds.

### T4 — Pending-pause note for a waiting run (R6 AC 6)
- Attack the completeness of "replacing 'pause requested' at `pause.ts:42-43`" when the string also occurs at line 45.

### T5 — Scope framing (Introduction × R7/R8/R12)
- Challenge the intro's "changes the shell, Home and the run row" against controller-lifecycle changes.

## Top risks / gaps

### R1-1 — MUST_FIX (Novel). One "Discard allowed" bit cannot encode R7 AC 6 and AC 7's three outcomes
R12 AC 1 adds exactly one new Discard signal to the row. But the frontend must distinguish three stopped-run states:
1. no branch → **no tile** (R7 AC 6 "Otherwise a stopped run SHALL have none");
2. branch present, a moving run shares `branch`+`codeRoot` → **tile, no Discard** (R7 AC 7);
3. branch present and free → **tile + Discard**.
`ControllerRunRow` (`src/controller/runs.ts:1428-1451`) carries no `branch` field and the Security NFR keeps paths off the row, so the frontend has no branch-presence signal except "Discard allowed". A single boolean collapses (1) and (2): "not allowed" means *hide the run* for a branchless run but *show it without the button* for a branch-in-use run. As written R12 AC 1 contradicts R7 AC 6/AC 7 — the wire contract is unimplementable without a second signal (e.g. a separate "has tile / branch present" flag) or a rule that the server omits R7-AC-6-excluded stopped runs from `controller-runs`. The document states neither. Failure scenario: a `done` run <24h whose branch another live run reuses either vanishes from Running (if the bit gates the tile) or shows a live Discard that the route then 409s (if the bit only gates the button) — opposite bugs from the same under-specified field.

### R1-2 — SHOULD_FIX (Novel). The task id R12 AC 2 writes at spawn is not in scope at the cited site
R12 AC 2 cites `src/controller/runs.ts:455-458` for "the run record SHALL hold its ISO start time and task id". That function (`stepLifecycle.onStepSpawn`) receives only `{ id, pid, startTime }`, where `id` is the **step** id (e.g. `implementer-task-1`) and `startTime` is a numeric `/proc` field. The raw task id lives in the implementation phase's `runTask` (`src/controller/phases/implementation.ts:616`); it reaches `onStepSpawn` only through the step-id string (all five phases pass `{ id: opts.stepId, pid, startTime }`, e.g. `implementation.ts:469`). So design must either change the `onStepSpawn` contract across the phase files or parse the task out of the step id. The scope note says design adds only `src/controller/runs.ts` and `src/controller/state.ts` to the enumerate list; it omits `src/controller/phases/implementation.ts` (and the shared `onStepSpawn` type). Failure scenario: design wires the field in `runs.ts` alone, finds the task id absent, and re-enters — the exact rework the enumerate list exists to prevent.

### R1-3 — SHOULD_FIX (Novel). R4 AC 1 tile text is undefined for gate-a / gate-b / retro-plan
R4 AC 1 mandates "the first line of `questions[0].text` … IF the wait has no questions THEN … the kind's fallback line (`NowPage.tsx:66-78`)." But `ctrlSummary` returns, for `gate-a`/`gate-b`, a **count** (`Gate A — N decision(s)`) and for `retro-plan` a proposal count — never `questions[0].text` and never a questions-based fallback. For a gate wait that has questions, R4 AC 1 as written shows the first decision prompt and drops the count the operator needs ("how much is behind this gate"); the cited "fallback line" has no gate/retro branch to fall through to. The three aggregate kinds' tile text is therefore ambiguous. Failure scenario: a gate-B wait with 9 items renders one item's text, and the operator cannot see from the board that eight more decisions wait behind it.

### R1-4 — SHOULD_FIX (Novel). R6 AC 6 leaves the waiting-run pending-pause note unspecified
R6 AC 6's condition ("`pauseRequested` set, status not `paused`") covers both `pause.ts:43` (running: `'pause requested'`) and `pause.ts:45` (waiting: `${waiting.text} · pause requested`). The AC cites only `:42-43` and says the note "SHALL read 'pausing after this step'". For the waiting case it is unstated whether the whole composite note collapses to "pausing after this step" (losing the resume-time context) or only the `· pause requested` suffix is rewritten. Failure scenario: a waiting run with a pending pause either loses its "resumes in …" text or keeps the old "pause requested" wording — two defensible implementations, no AC to pick between them.

### R1-5 — MINOR (Novel). The Introduction undersells the controller surface
"It changes the shell, Home and the run row" hides that R7 AC 8 changes `cancelRun`'s status write, R7 AC 7 adds a 409 guard to `discardRun`, and R12 adds controller writes at step spawn. The scope note partly repairs this ("design adds runs.ts and state.ts"), but a reader scoping review effort off the intro underestimates the controller blast radius.

## Top 3 conclusions to challenge or reverse

1. **"every tile field [is] derived from records" (R12 user story) + one Discard bit.** Reverse toward two signals: the record/row cannot carry branch presence (Security NFR) yet R7 AC 6/AC 7 need three outcomes. Either add an explicit "stopped-run tile" predicate to the row, or state that the server filters R7-AC-6-excluded stopped runs out of `controller-runs` and the bit governs only the button. Pick one in requirements; do not leave it to design to infer.
2. **"the task id (`runs.ts:455-458`)" (R12 AC 2).** Challenge the single-file framing. Name where the task id enters the spawn path (the implementation phase) and add that file to the "design must enumerate" list, or specify that the row derives the task by parsing the step id.
3. **"the first line of `questions[0].text`" as universal (R4 AC 1).** Reverse for the aggregate kinds: keep a count/aggregate summary for gate-a/gate-b/retro-plan, and define the actual fallback text per kind rather than pointing at a function whose gate branches never reach a fallback.

## What's missing before acting on this document

- A second row signal (or an explicit server-side filter rule) that lets the frontend tell "no tile" from "tile, no Discard" — blocks R7 AC 6/AC 7 and R12 AC 1 (R1-1).
- The write-source file for the step's task id named in scope, and the ISO-vs-/proc conversion acknowledged (R1-2).
- Per-kind tile text and fallback for gate-a/gate-b/retro-plan (R1-3).
- The waiting-run pending-pause wording resolved (R1-4).
- Minor-to-note (not findings, design may settle): R8 AC 5 asserts Next reflects run start/stop within 5 s but names no push channel for the REST setup view (only that the mount-fetch is insufficient); R7 AC 7 does not say whether `branch-in-use` is the 409 body's `reason` or `error` (R9 AC 2 reads `reason` then `error`); the frontend must parse `merge:<repo>#<n>` to match a close-out read.

## Verdict

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 3
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
