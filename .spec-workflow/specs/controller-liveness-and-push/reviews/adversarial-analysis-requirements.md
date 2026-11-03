# Adversarial Analysis — controller-liveness-and-push/requirements (v1, round 1)

First review. Deltas since checkpoint `ebf67bc4` are trivial (one citation nudged `:428-429`→`:427-429`, plus the lint-pass revision note). Nothing in the delta to attack, so the thrust is the named fresh lens: **wire contracts across a boundary** (router, query params, response shapes, client state). I did not re-open the rejected lint items L-1..L-22; none of my findings overlap them.

Codebase reads (both ends of every range I judge):
- `src/controller/runs.ts:1410-1444` — `ControllerRunRow`, `toRow`, `listRunsForWire`: `toRow` is a pure function of the disk `RunRecord`; `listRunsForWire` maps `listRuns()` (disk). No controller handle.
- `src/controller/controller.ts:75-78` — `active`/`cancelled`/`resumeTimers`/`drives` are private in-memory fields; `:304-332` recover/reattach; `:417-466` startDrive/drive/onWaitChange.
- `src/dashboard/shell/shell-feed.ts:1-120` — `ShellFeed` constructor takes `ProjectManager`, a `send` callback and timing opts only; it calls the module-level `listRunsForWire()` (line 117). No controller reference anywhere.
- `src/dashboard/multi-server.ts:809-857` — run routes; `GET /api/controller/runs` (line 810) also calls bare `listRunsForWire()`.
- `src/dashboard/shell/types.ts:194-210` and `src/dashboard_frontend/src/modules/shell/types.ts:215-233` — two hand-copied `ControllerRun` wire types.
- `src/advisor/push.ts:37-41,188-217` — `PushConfig{v,url,dashboardUrl}`; `postOnce` POSTs JSON `{kind,project,spec,dashboardUrl}` to `config.url`.
- `src/advisor/summary.ts:93-100` — `pushState()` reads `pushConfigPath()` (`push.json`) to report push on/off.
- `src/advisor/home.ts:39-41` — `pushConfigPath()` → `push.json`. Confirmed.
- `src/dashboard/harness/run-setup.ts:146-232` and `src/core/spec-routing-deriver.ts:8-18` — `buildSetupView`, `nextUnstartedSpec`, the five-state `RoutingState` union. Requirement 6 cites are accurate; the "two states only" claim at `:195-201` is correct.
- `src/controller/state.ts:417-433` (`writeRunLocked` carries `pauseRequested`, clears on terminal), `src/controller/runs.ts:427-433,566-575,686-692,850-858` — all Requirement 1/3 cites verified correct.

The Requirement 1 (heartbeat) cites, Requirement 3 (Re-drive) cites, and Requirement 6 (launch routing) cites all resolve. No misstated artifact found. The heartbeat race (AC 6) and the step-end clear (AC 4) are stated as outcomes with the mechanism left to design, which is fine.

---

## Attack 1 — Requirement 2 AC 1: where does `driven` come from?

AC 1 says `driven` is "true while the controller holds the run in its `active` set or has a drive or a re-attach poll for it (`controller.ts:75-78`, `:320-332`, `:417-434`)" and that "the row is built in `src/controller/runs.ts:1429-1444` and read by the shell feed at `shell-feed.ts:115-120`."

- Challenge the claim that `driven` can be built where the row is built. `toRow` (`runs.ts:1429-1438`) takes only a `RunRecord` and `listRunsForWire` maps `listRuns()` straight off disk. The three truth-sources named (`active`, `drives`, `resumeTimers`) are **private in-memory fields of the `Controller` object** (`controller.ts:75-78`). `runs.ts` neither imports nor could import the controller without a cycle. As written, the one new field of this requirement has a build location that structurally cannot see its own truth-source.
- Stress-test the feed path. `ShellFeed` (`shell-feed.ts:38-46`) is constructed with a `ProjectManager` and a `send` callback — **no controller handle**. It calls bare `listRunsForWire()` (line 117). D6 makes the feed the channel later dashboard specs read liveness from, yet the feed cannot compute `driven`. The GET route at `multi-server.ts:810` has the same bare call.
- Stress-test the cross-process case. The controller runs only in the lock-holding process (`multi-server.ts:402-410`). A dashboard process that does not hold the lock has no controller object at all; `driven` would have to reach it over disk or IPC. The requirement never addresses this.
- Reject the naive escape: persisting `driven` to `run.json`. A persisted liveness flag goes stale the instant the controller that set it dies — which is precisely the "a dead run reads as running" bug Requirement 2 exists to kill. So the data path is not a free design choice; the requirement must say how live controller state reaches the row without reintroducing the stale flag.

An implementer who reads AC 1 literally ("built in `runs.ts:1429-1444`", truth = disk record) will derive `driven` from `status`+`inFlight` and get the between-steps live drive wrong — a wrong implementation. **SHOULD_FIX.** The requirement must specify the provenance of `driven` at both the GET route and the feed boundary (and the no-lock dashboard process), not pin the build to a disk-only function.

## Attack 2 — the run row is three hand-mirrored shapes; the doc names one

AC 1 names only `ControllerRunRow` (`runs.ts:1410-1427`). The same wire row is redeclared by hand twice more: `ControllerRun` at `src/dashboard/shell/types.ts:194-210` (the type the feed casts to, `shell-feed.ts:117`) and `ControllerRun` at `src/dashboard_frontend/src/modules/shell/types.ts:215-233` (the browser copy).

- Challenge the completeness of AC 1 and AC 9 (and Requirement 1 AC 9 for `lastActivity`). For `driven`/`lastActivity` to reach the operator's dashboard as typed fields, all three shapes must gain them. The document requires only the first. The `as ControllerRun[]` cast in the feed silently drops the typing, so the fields ride the JSON at runtime but are invisible to the client — nobody can read them in a typed path.
- Evidence of live drift: the server-side `ControllerRun` at `shell/types.ts:198-209` is **already** missing `pauseRequested`, which both the row builder and the frontend copy carry. These copies drift today; adding two fields to only one copy widens the gap.
- Challenge Requirement 2 AC 2 as testable in this spec. AC 2 ("the dashboard derives stalled from the two fields") reads as an AC on the dashboard, but the decomposition enumerates no client renderer (D6 defers liveness rendering to "the dashboard specs after this one"), and the end-to-end check verifies the **wire row** (`driven: false` within 5 s), not a rendered dashboard. As scoped, AC 2 has no implementing or testable surface here.

**SHOULD_FIX.** Either require `driven`+`lastActivity` on all three wire shapes and state that stalled *derivation/rendering* is deferred, or drop AC 2's dashboard claim and keep this spec to the wire. As written it straddles the boundary.

## Attack 3 — Requirement 4 AC 2: "`push.json` SHALL no longer be read" misses a second reader

AC 2 migrates the config from `push.json` to `notify.json` and asserts `push.json` "SHALL no longer be read." The scope note promises to update only `docs/controller-design.md §16` and "the advisor docs."

- Challenge the claim. `push.json` has a **second reader the document never names**: `src/advisor/summary.ts:93-100` `pushState()` does `fs.access(pushConfigPath())` and reports push "on"/"off" in the advisor hello summary. The migration in AC 2 touches only the pusher (`push.ts`).
- Cite the failure. D2 states the old file "is not configured on the operator's machine." After the switch, `notify.json` drives sends but `push.json` is absent, so `pushState()` returns `'off'` forever — the advisor hello will report **push off while push is actually on**. This is live-wrong, not cosmetic.
- This also falsifies D2's stated justification ("one config means one path to test"): two code paths still read the old file.

**SHOULD_FIX.** Add `summary.ts` `pushState()` to the migration (read `notify.json`), or restate AC 2 so it does not claim `push.json` is no longer read anywhere.

## Attack 4 — Requirement 4 AC 3: the ntfy message is a half-specified wire shape (MINOR)

AC 3 says "POST one message to `url` + `/` + `topic`" carrying kind, project name, spec and the first question line "and nothing else." The current sender (`push.ts:206-217`) POSTs `content-type: application/json` with a JSON body to `config.url`.

- The ntfy `<server>/<topic>` publish endpoint treats the request **body as the plain-text message**; title/priority/tags are headers, not body fields. The requirement lists four fields but never says the message is plain text nor how the four compose into one line. An implementer who keeps the JSON body would publish raw JSON as the notification text.
- This is largely conscious-deferred: AC 4 defers the auth header to "the ntfy documentation," and the scope note leaves "the ntfy title and priority" to design. So the composition detail is reasonably a design item.

**MINOR** — flag so design states plain-text-body + field composition explicitly; not loop-keeping on its own.

---

## Top 3 conclusions to challenge or reverse

1. **D10 — "one fact on the wire cannot disagree with another," stalled derived from `status`+`driven`.** D10 treats `driven` as a settled wire fact and glosses the hard part: `driven` is live controller memory (`controller.ts:75-78`), not a disk fact, and is invisible to the feed (`shell-feed.ts:38-46`) and to a no-lock dashboard process. The decision is sound only once the provenance in Attack 1 is pinned; as stated it assumes a fact the architecture does not yet deliver.
2. **D1/D2 — "the pusher is the one sender; `push.json` no longer read; one path to test."** False while `summary.ts:93-100` still reads `push.json` (Attack 3). Reverse the "one path" claim or widen the migration.
3. **D6 — "the wire row carries driven; later dashboard specs read liveness from the row."** The row's *consumer* types (`ControllerRun` ×2) are not updated here and this spec ships no renderer, so Requirement 2 AC 2's "dashboard derives stalled" has no testable surface in this spec (Attack 2). Decide: fields-on-all-three-shapes now, rendering later.

## What's missing — before acting on this document

- A clause on how `driven` crosses from the controller's in-memory `active`/`drives`/`resumeTimers` to the wire row at **both** `GET /api/controller/runs` and the shell feed, including the no-lock dashboard process, without persisting a stale-prone flag to `run.json`.
- A requirement that `driven` and `lastActivity` land on all three run-row shapes (`ControllerRunRow`, `dashboard/shell/types.ts` `ControllerRun`, `dashboard_frontend` `ControllerRun`), and an explicit statement of whether stalled *rendering* is in this spec or deferred (reconcile with AC 2).
- `summary.ts` `pushState()` added to the `push.json`→`notify.json` migration (or AC 2 restated).

## Fine, move on

- Requirement 1 heartbeat cites, the `writeRunLocked`/`pauseRequested` carry-over model (`state.ts:417-433`), and the terminal-clear mirror (AC 7) are accurate and self-consistent.
- Requirement 3 Re-drive response shapes (404 `run-not-found`, 200 `{ok:true}`, 409 `not-stalled`) match the existing route conventions at `multi-server.ts:814-846`; the retry re-drive path through `onWaitChange` (`controller.ts:454-465`) is correctly described.
- Requirement 6 launch-routing cites and the five-state `RoutingState` union are correct; the generic `launchable`/`disabledReason` logic at `run-setup.ts:200-201` already absorbs the extra two states once `unstarted` is computed for them.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
