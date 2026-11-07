# Adversarial Analysis — decisions-and-launch-guard/requirements (v2, round 2)

Primary surface: completeness, ambiguity, scope. Fresh lens this round: testability
of acceptance criteria measured against the requirement's own user-story intent —
a lens round 1 (wire contracts) did not use. Deltas attacked first.

## What I checked and how

Read: requirements.md (all), the v2 diff, codebase-context.md, agent-rules.md, the
v1 analysis and memory. Verified both ends of every citation the v2 delta touched,
plus the load-bearing base-state claims behind the requirement I attack.

**Delta re-verification (clean):**
- `src/dashboard_frontend/src/modules/shell/HomePage.tsx:188-194` (R1-2 fix, Req 2
  AC5) — this is exactly the `onLaunch` single-`stages.press` handler; the base
  one-press launch path. Citation accurate.
- `src/controller/runs.ts:356` (R1-3 fix, Req 3 AC1) — `decisions.map((p) => `- ${p.id}:
  ${p.question} → ${answers[p.id] ?? 'no answer'}`).join('\n')`. Each decision is one
  joined line, and the literal `no answer` is written when the answer is nullish.
  Citation and the two new clauses ("one line", "`no answer` counts as not recorded")
  accurate.
- The `## Decisions taken` reformat (D1–D13) dropped the "options were …" lists and
  trimmed prose. Compared every entry to v1: the chosen outcome and rationale are
  preserved; no factual drift, no new claim introduced. Clean.
- Req 2 Verification second scenario and the Scope-notes "disambiguates a path present
  under more than one store code root" addition: deferrals/scenarios, not code claims.
- Removed Cut bullet (`steering/product.md`): the same fact still stands in the
  Alignment section. No gap.
- Re-verified Req 7 AC3 base claim: `writeRunLocked` (`src/controller/state.ts:431-463`)
  writes `{...record, status}` from the caller's record and reads disk only when
  `!terminal`; there is no disk-status guard against un-abandoning. Claim accurate.

**No misstated artifact in the v2 delta. No fix-induced MUST_FIX.** Every delta is an
accepted round-1 fix and each lands correctly.

## Topics attacked

### 1. v2 deltas — the round-1 fixes
- Stress-tested R1-1's fix (Req 2 Verification second scenario) against AC7: it names
  the no-`tasks.md` scenario and ties it to the design-stated source, discharging
  R1-1's ask for a stated scenario. But unlike the first scenario (`tradr infra` warns,
  `tradr app` clear) it states no concrete pass/fail outcome — "holds the same warning
  rule" — because the source is design-deferred. Weak but adequate (MINOR, see R2-2).
- R1-2/R1-3/R1-4/R1-5 fixes verified against code and intent — all land. No regression.

### 2. Requirement 10 "Tile colour follows health" — tone vs the user story (fresh lens)
- Challenge AC1's map against the user story "a red outline to mean trouble, so that a
  long healthy run does not look broken." AC1 routes tile tone through `runDot`
  (`board.ts:96-104`), whose base is `lastActivity ?? stepStarted` and which returns
  `red` at ≥ 15 min and `amber` at ≥ 5 min of **activity** age. `red` → `danger`.
- `isStalled` (`board.ts:109-117`) is true only for an **undriven** run. So a *driven*
  (healthy, not stalled) run whose current step has streamed nothing for ≥ 15 min still
  gets a red dot → `danger` tone. `lastActivity` is cleared/stale during a quiet step
  (confirmed in `liveness-e2e.test.ts`: it appears while the step streams and is absent
  within 1 s of the step ending), so the `stepStarted` fallback drives the age.
- Stress-test AC2 ("WHEN a healthy run is older than 1 hour THEN its tone SHALL be
  `neutral`") against AC1: "healthy" is undefined and "older than 1 hour" is the wrong
  axis — `runDot` keys off activity recency, not overall age. For a driven run older
  than 1 hour whose step has been quiet ≥ 15 min, AC1 says `danger` and AC2 says
  `neutral`. The two ACs disagree on a real, common state. See R2-1.
- Confirm the base bug is real (so the requirement is still wanted): base `RunTile`
  sets `tone = ageTone(now - created)` (`tiles.tsx:149-150`), which is `danger` at
  ≥ 1 h of total age regardless of health. The requirement's direction is right; its
  AC set just does not resolve the driven-but-quiet case.

### 3. Spot-checks that held
- Req 9 AC1 `MOVING_STATUSES` = exactly `queued, running, merging, paused, waiting`
  (`board.ts:35`); AC2 `stoppedAdmitted`/sort-by-`updated`-desc (`board.ts:38-57`);
  AC5 base dwell rule (`board.ts:38-44`) — all accurate.
- Req 7 AC3 base-state citations accurate (above). Req 3 AC1 single-line read accurate.

## Findings

### R2-1 — SHOULD_FIX — Novel (carried; Req 10 unchanged by the v2 delta) — Req 10 AC1/AC2
Requirement 10's user story wants a long **healthy** run not to look broken, but AC1
routes tone through `runDot`, which returns `red` (→ `danger`) for any run whose step
has had no streamed activity for ≥ 15 min, and `isStalled` excludes only *undriven*
runs. So a driven, healthy run in a long quiet step is coloured `danger` — the exact
outcome the user story forbids. AC2 ("a healthy run older than 1 hour SHALL be
`neutral`") contradicts AC1 for this case and leaves "healthy" undefined and keyed to
the wrong axis (total age, not activity age).
**Failure scenario:** an implementer run 70 min in, actively healthy, inside a single
`npm test` tool call that has streamed nothing for 18 min. `lastActivity` is stale/absent,
so `runDot` uses `stepStarted` (70 min) → age ≥ 900000 → `red` → AC1 tone = `danger`.
The operator sees a red outline on a healthy long run — the thing Req 10 set out to
fix — and no AC rules it out; a test author cannot satisfy AC1 and AC2 together for
this input.
**Fix:** define "healthy" in terms of `runDot`'s output (green/grey) and state whether a
*driven* run's activity-gap red counts as `danger` or should be suppressed to `warning`/
`neutral` (i.e. reserve `danger` for `isStalled`). Re-word AC2 as "overall age alone
SHALL NOT force `danger`" so it stops implying every 1-hour-old healthy run is `neutral`.

### R2-2 — MINOR — Compounds R1-1 — Req 2 Verification
The second verification scenario ("a launchable spec with no `tasks.md` … holds the
same warning rule") names no concrete pass/fail outcome, unlike the first scenario. It
cannot, because the no-`tasks.md` source is design-deferred — but that means the AC7
common branch still has no executable acceptance check at this level. Acceptable as a
deferral; flag so the design/tasks phase is bound to produce the concrete scenario.

### R2-3 — MINOR — Req 9 AC3
"The stopped band … SHALL have less visual weight than Running" is unquantified and not
independently testable. Safe to leave to design, but note it as a non-testable clause.

## Closing deliverables

**Top risks/gaps**
1. Req 10 colours a driven-but-quiet long run `danger`, defeating its own user story,
   and AC1/AC2 disagree on that case (R2-1).
2. The AC7 no-`tasks.md` common branch still has no concrete acceptance outcome, only a
   schematic verification line (R2-2).

**Top conclusions to challenge**
1. "Tile colour follows health" — as specified it follows *activity recency*, not
   health; a healthy run with a quiet step reads as trouble. Reverse: `danger` should
   track `isStalled` (undriven), not a `runDot` activity gap, if the user story governs.
2. AC2's "older than 1 hour → neutral" frames the fix on the age axis the requirement is
   trying to abandon; it should be framed as "age alone no longer forces danger."

**What's missing before acting**
- A resolution in Req 10 of whether a driven run's `runDot` red is `danger`, plus a
  definition of "healthy," so the design and its tests are not left to guess.

Nothing here needs a human now.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
