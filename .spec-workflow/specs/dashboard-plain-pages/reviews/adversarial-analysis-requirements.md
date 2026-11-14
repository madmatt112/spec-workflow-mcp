# Adversarial Analysis — dashboard-plain-pages/requirements (v1, round 1)

First review. Fresh lens: **wire contracts across a boundary** (router, query
params, response shapes, client state) — the default first lens for requirements.
Changes since the v1 checkpoint are a single Revision-History lint-pass note
(all L-1..L-7 rejected as citation-identifier false positives; those rulings are
closed and not re-opened). With the delta empty, the lens carries the round.

## What I checked and how

Read the target, `codebase-context.md`, the decomposition entry #34, and
`agent-rules.md`. Verified every load-bearing citation against both ends of its
range in the worktree code:

- `step.ts:499-502` (rate_limit_event branch), `runs.ts:405-406` (`onRateLimit(windows)` — no run id), `controller.ts:790-803` (`persistRateLimit`), `controller.ts:692-707` (passed-reset read) — all accurate.
- `spec-rows.ts:78-82` (`isSpecClosed`), `:124-126` (doc/ledger test), `:149-154` (PR numbers), `live-runs.ts:10-18` (`liveRunsByProject`) — accurate.
- `run-setup.ts:23`, `:199-207` (launchable), `document.ts:1156-1158` (`(deferred)` write), `index-generator.ts:263-278` (`deferred.json` marker) — accurate.
- `multi-server.ts:436-451` (deferrals-update push), `:611-618` (spec detail route), `:625-643` (closed-specs route); `deferrals.ts:258-270` (`handleResolve`), `deferral-storage.ts:307-319` (`resolve`), `:192-202` (not-found / reindex errors) — accurate.
- `stores.ts:16-22` / `:39` (representative, enabled), `types.ts:174` (`tokens`), `shell-feed.ts:31`/`:44` (FileCache, 30 s tick), `UsagePage.tsx:95-102` (rate-limit refetch) — accurate.
- Removal targets exist: `usage-rows.ts`, `buildSpecDetail`, `SpecDetail`/`UsageSpecRow` in both backend and frontend `types.ts`, `SpecPanel`/`FileRow`.
- `FileCache.text` re-stats (mtime+size) each read, so Req 1 AC8 ("within one 30 s tick") and the Performance NFR hold — **fine, not flagged.**
- `watcher.ts:216-222` fires `deferral-change` on `'updated'`, so a resolve (in-place edit) does trigger the `deferrals-update` push — Req 6 AC6 / Req 7 AC7 hold — **fine, not flagged.**

No misstated artifact found. The defects below are wire-contract and scope gaps,
not citation errors.

## Topics attacked

### 1. The usage-log writer and its `run` field (Requirement 3, D10)

- **Challenge the Introduction's claim that this "adds one controller writer."** The log line must carry `run` (AC1), but the event's run id is not available where the write would sit. `onRateLimit(windows)` carries no run id at `runs.ts:406`, `step.ts:135`, and the five phase/driver interfaces (`document.ts:182`, `retrospective.ts:41`, `implementation.ts:96`, `closeout.ts:62`, `merge-fix.ts:50`). The six call sites in `runs.ts` pass `deps.onRateLimit` **raw** while the adjacent `onStepActivity: stepActivityForwarder(deps, run.id)` is explicitly given the id. Delivering `run` means changing that callback signature across all of those, or writing from `step.ts`.
- **Stress-test the alternative of writing from `step.ts`.** `spec.runId` is in scope there (`step.ts:461`) but is **optional** — the `if (spec.runId)` guard means a step with no run (the top-level supervisor plan step; `runs.ts:405` comment: "from a step or the supervisor stream") emits a rate_limit_event with no run id. AC1/D10 never say what `run` holds for a no-run event, or whether such events are logged at all.
- **Challenge the "Left to the design" list.** It enumerates four deferred design points and names neither the run-id plumbing nor the no-run case, so both are oversights the design/tasks phase inherits as unscoped controller-contract work, not intentional deferrals.

### 2. How the server-computed burn and fit reach the page (Requirements 4, 5)

- **Challenge the claim that "the server computes the burn and the fit; the page SHALL only render them" (5 AC5) given no transport is named.** The only surviving Usage fetch is `/api/controller/rate-limit` (`multi-server.ts:887-889`), a pure `rate-limit.json`-or-null passthrough; the closed-specs route that was the page's other fetch is deleted (Req 8 AC2). No route or response shape carries burn or per-run fit.
- **Stress-test 4 AC8 ("the page SHALL refetch its figures, as the current page does, `UsagePage.tsx:95-102`").** That citation is the rate-limit fetch. Taken literally it refetches only the window, never burn/fit. Either the rate-limit route must grow to compute per-run fit (it has no run/log knowledge today), or a new route/push is needed — the requirement picks none, leaving the response contract and client-state shape undefined.
- **Challenge the silence in "Left to the design."** As with topic 1, the burn/fit transport is absent from the deferred list, so it is an omission, not a deferral.

### 3. Scope deltas against decomposition #34 (Scope notes)

- **Stress-test the completeness of "Cut or changed against the decomposition entry."** It lists only D1 (adds "stopped") and D2 (group by store). It omits D7, which redefines burn from the decomposition's "burn is the utilisation delta over 24 h" to "the sum of positive steps between consecutive log lines." D7 itself names "the plain difference of two lines" as a rejected option, so this is a reasoned deviation — observably different whenever a weekly reset falls inside the 24 h — that belongs in the delta list.

### 4. State routing and the "next" word (Requirement 2) — probed, fine

- Verified the six-word precedence (live→closed→deferred→next→stopped→not started) is a coherent redesign of the existing five-branch precedence (D1), and that per-store launchable (`run-setup.ts:199-207`, keyed on one `workflowRoot`) makes "at most one next" (AC8) hold for a shared store. The "next" rule lives in `run-setup`, a different module from the `buildSpecRows`/shell-feed path that builds the Specs page; wiring it in is design, and the requirement correctly names the rule's source. No defect.

## Top 5 risks / gaps

1. **[design] SHOULD_FIX — the `run` field has no path to the writer (Req 3 AC1, D10).** The `onRateLimit` boundary carries only windows (`runs.ts:406` and five phase interfaces); the six call sites pass it raw though `run.id` is in scope beside them. "Adds one controller writer" (Introduction) hides a cross-boundary signature change, and the no-run (supervisor / `spec.runId` undefined) case is unspecified. *Failure:* an implementer slots the append next to `persistRateLimit` (per AC2) and finds no run id there; or writes from `step.ts` and emits lines with an empty `run` for supervisor events, which D8's per-run fit then silently drops.
2. **[design] SHOULD_FIX — no named transport for the server-computed burn and fit (Req 4 AC4, 5 AC5, 4 AC8).** The surviving fetch returns only the window; the closed-specs route is deleted. *Failure:* the design extends only `/api/controller/rate-limit` (per AC8's citation) and burn/fit never reach the page, or it invents a route the requirement never scoped and the Usage AC that pins the refresh to `UsagePage.tsx:95-102` no longer describes the real data flow.
3. **[drafting] SHOULD_FIX — the burn redefinition (D7) is missing from the decomposition-delta note.** "Cut or changed against the decomposition entry" omits the change from the entry's "utilisation delta over 24 h" to D7's sum of positive steps, which differ across a reset. *Failure:* an approver reconciling the spec against #34 signs off expecting a plain delta and is surprised by a different burn number when a reset lands in the window.
4. **[design] MINOR — the Resolve POST's `projectId` for a shared store is unstated (Req 7 AC3, D2).** Deferrals reads each store once via its representative (D2), but the mutation route is `/api/projects/:projectId/...`; the requirement never says the representative's `projectId` is the one the row POSTs to. Implied, not stated. Low risk because any member `projectId` of the store resolves to the same path.
5. **[design] MINOR — D11's "enabled or not" depends on the controller-runs push being account-wide.** Usage lists live runs of every registered project, enabled or not (5 AC1); the frontend reads `controllerRuns` from `useShell`. The requirement never states the push is unfiltered by enable state. It is today (runs are controller-wide), so this is a note, not a hole.

## Top 3 conclusions to challenge or reverse

1. **"It adds one controller writer (the usage log)." Reverse the framing.** The writer needs a run id the current `onRateLimit` contract does not carry; honouring `run` touches `step.ts`, five phase drivers, `RunDeps`, and six call sites, or forces a step-side write with an unspecified no-run case. The Introduction and "Left to the design" should say so.
2. **"The server computes the burn and the fit; the page SHALL only render them." Challenge as under-specified.** True as a rule, but with no route/response shape and an AC (4 AC8) that cites a refetch path incapable of carrying them, the contract is undefined at exactly the boundary this round's lens targets.
3. **"Cut or changed against the decomposition entry: D1… D2…" Challenge as incomplete.** D7 is a third, observable deviation (burn delta → sum of positive steps) and should be declared beside D1 and D2.

## What's missing — do before acting on this document

- Name, in Req 3 / "Left to the design," how the run id reaches the usage-log line (change the `onRateLimit` signature, or write from `step.ts`) and what `run` holds for a rate-limit event with no run.
- Name the server→client transport for burn and per-run fit (extend `/api/controller/rate-limit`, a new route, or a field on the controller-runs rows) and align 4 AC8 with it.
- Add the D7 burn deviation to the decomposition-delta note.

## Standing-directive checks

- Deltas-first: the only change since checkpoint is the lint-pass note; its rulings are closed and were not re-opened.
- ESCALATE: the resolve route is the only mutation; the NFR puts it behind the existing auth/CORS hooks, trims and length-caps `resolution` (≤2,000), and passes only a string to the deferrals tool — no shell, no secrets, no destructive migration. Nothing for a human now.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
