# Adversarial Analysis — dashboard-plain-pages/tasks (v1, round 1)

Primary surface: atomicity, ordering, coverage. Fresh lens: none. First review.

## Deltas re-verified (the v1 lint commit)

The lint pass changed four Note lines (tasks 3, 4, 7, 11). Every citation it
touched is accurate against base 1054a946:

- Task 3 — `nextUnstartedSpec` at `src/dashboard/harness/run-setup.ts:230` is the
  `export function nextUnstartedSpec(workflowRoot: string)` definition. ✓
- Task 4 — `buildSpecRows` suite at `spec-rows.test.ts:279`, `buildSpecDetail` suite
  at `:483`, `isSpecClosed` suite at `:620`. All three `describe(...)` headers match. ✓
- Task 7 — the visual parity loop at `e2e/worktree-visual.spec.ts:415`
  (`for (const kind of ['row', 'pill', 'button'] ...)`). `grep -n "'row'"` returns
  exactly `:313`, `:353`, `:415` — the three row-kind sites the Success names. ✓
- Task 11 — "Unchanged artifacts the decomposition names" is a real design
  component heading (design `## Unchanged artifacts the decomposition names`), so
  L-1's coverage fix resolves. ✓
- L-5 rejection sound: `blocks` is absent from base; `shell-feed.ts:129` sends
  `data: { rows }` today, so `{ blocks }` is a to-be-built wire key. ✓

Also spot-checked, all correct: `tsconfig.json:20` (`exclude: … src/dashboard_frontend/**`),
`ledger.ts:107` (`appendFileSync(path, JSON.stringify(row) + '\n')`),
`step.ts:499-502` (the `rate_limit_event` branch). Requirement→task AC coverage is
complete (every AC 1.1–8.7 is carried by at least one task). Design components
C1–C12 and "Unchanged artifacts" each map to a task. No prose `File:` entries; all
are literal repo paths. No new external dependency (gate-b: none); no task exceeds
the approved requirements (gate-c: none).

## Topic 1 — Task 5's retired-symbol scrub grep (atomicity / file-outside-list)

- **Challenge the Success claim** that `grep -rn "buildSpecRows\|SpecListRow\|SpecPanel"
  src --include='*.ts' --include='*.tsx' --exclude-dir=__tests__` "finds nothing".
  `src/dashboard/shell/usage-rows.ts` carries `buildSpecRows` in comment prose at
  lines 4 and 30. It is a shipping-source `.ts` under `src`, not a test, so the grep
  matches it.
- **Stress-test the ordering:** `usage-rows.ts` is deleted in task **10**, which runs
  after task 5, and it is **not** in task 5's `File:` list. The implementer therefore
  cannot clear the hit (a touch of `usage-rows.ts` is `file-outside-list`, which no
  implementer commit resolves, retro P12), and the grep cannot read "nothing".
- This is exactly the retro-P1 class agent-rules names: "A root-walking Success grep
  for a retired symbol … a match in a sibling … comment prose does not count and is
  not listed — scope the grep so it cannot match one." Task 5's grep is unscoped
  against a live comment.
- The two sibling greps are clean by contrast: `SpecListRow` and `SpecPanel` only hit
  files already in task 5's list; task 10's larger scrub grep only risks the three
  pages, which tasks 5/7/9 rewrite wholesale before task 10 runs.

**R1-1 — MUST_FIX [drafting].** Task 5's removal grep matches `buildSpecRows` comment
prose in `src/dashboard/shell/usage-rows.ts` (deleted only in task 10, absent from
task 5's `File:` list), so the Success criterion "finds nothing" is false and the task
stalls on `file-outside-list`. Fix by scoping the grep to the files task 5 owns (or
excluding `usage-rows.ts` until task 10), per the retro-P1 scoping rule.

## Topic 2 — Deferrals Resolve coverage (coverage / sub-case collapse)

- **Challenge** that task 9 covers Requirement 7.9 ("WHEN the box's request is in
  flight THEN the confirm SHALL be disabled, so one press sends one request"). Task 9
  lists `7.9` in `_Requirements`, and design C10 pins two distinct disable triggers —
  "disabled while the trimmed text is empty **or** a request is in flight" — but the
  Success clause names only "the confirm is disabled with empty text". The in-flight
  trigger (the double-submit guard) is collapsed out.
- Agent-rules: "A task whose acceptance covers more than one distinct sub-case names
  each sub-case in its Success line … The tasks-phase review rejects a Success line
  that collapses distinct sub-cases into one behaviour." Task 9 is implementer-only
  (`kind: e2e`), so no test author backstops the un-named case; the implementer writes
  only what Success names. The in-flight disable is Playwright-assertable (delay the
  route, click confirm, assert disabled before the reply).

**R1-2 — SHOULD_FIX [drafting].** Task 9's Success collapses Requirement 7.9's
in-flight confirm-disable into the empty-text disable, leaving the one-press-one-request
guard untested. Add the in-flight sub-case to task 9's Success clause.

## Topic 3 — Usage-view fit null-cases (coverage, minor)

- **Stress-test** task 6's `null`-fit enumeration against design C6 + Error Handling
  #3. C6's fit guard requires `window is not null`, and Error Handling #3 states "No
  rate-limit.json: window: null … and every fit is null." Task 6's Success lists the
  `null` cases as document-phase, zero tasks, no attributed line, passed reset and
  missing `tasks.md` — but **not** window-null. The order of C6's `&&` short-circuits
  before `.resetsAt`, so no crash results, but the sub-case is unguarded.

**R1-3 — MINOR.** Task 6 omits the window-null → fit-null sub-case named by design C6 /
Error Handling #3. Low risk (design is explicit, no throw); fold into the fit test.

## Topic 4 — Empty-state display strings (coverage, minor pattern)

- The server/builder null is tested, but the frontend empty-state **text** is not
  e2e-pinned for: "No decomposition" (Req 1.4, test id `specs-no-decomposition-*`,
  task 5), "No usage window seen yet" (Req 4.3, `usage-no-window`, task 7), and burn
  "not known yet" (Req 4.5 — task 7's seed is 25 h/1 min old, so burn is always
  known). Req 4.1's reset-time, time-to-reset and bar sub-elements are likewise not
  named beyond "per cent left".
- Each is MINOR and the design supplies the test ids; none keeps the loop alive. Noted
  as a recurring pattern for the reviser, not a loop-keeper.

## What checks out (attacked, found fine)

- **Visual `row`-kind ordering.** Task 5 strips Specs rows; Usage (old) + Deferrals
  still render `data-ui="row"` → pair holds. Task 7 drops `row` from the `:415` loop
  exactly when only Deferrals still renders a row (one view, no pair). Task 9 then
  waits for a row, no panel. Sequence is sound. Pill-parity is held across the window
  by D28 (Deferrals owner pill) + Specs word pills; the old Deferrals `STATUS_TONE`
  pill carries the pair between tasks 7 and 9.
- **shell-specs regression guards.** `shell-routes.test.ts:286-343` assert only
  `m.type === 'shell-specs'`, never the payload shape, so they survive the
  `rows`→`blocks` change unedited — correctly left out of task 5's `File:` list.
- **Suite partition stays green per task.** `worktree-shell.spec.ts:228-309` is
  partitioned task 5 (`:228-260`), task 9 (`:262-288`), task 7 (`:290-309`); each page
  task runs the suite while the other two cases still exercise their unchanged old
  pages. No page is left empty.
- **Resolve route (task 8).** Six C7 checks in order, each 400/404/409 branch
  asserted, id regex keeps a crafted slash out of the path, auth/CORS inherited,
  body-only `resolution`. No security gap. Route-only, no page emptied.
- **Dependency chains.** 1→2→6→7, 3→4→5, 8→9, {5,7,9}→10, 11 last are all satisfied
  by number order; the only over-ordering (6 after 2) is harmless. No missing edge.
- **kind: e2e marker.** Task 9's `- Test:` seam + `kind: e2e` is the sanctioned e2e
  implementer-only shape (D32, lint `task-e2e-marker` passed); tasks 10/11 carry no
  seam, correctly implementer-only (retro P10).

## Top risks

1. **R1-1** — task 5's grep stalls on `usage-rows.ts` comment prose (MUST_FIX).
2. **R1-2** — Req 7.9 in-flight confirm-disable untested (SHOULD_FIX).
3. **R1-3** — task 6 window-null fit sub-case un-named (MINOR).

## Top 3 conclusions to challenge

1. Task 5 "grep … finds nothing" — **reverse**: it returns `usage-rows.ts:4` and `:30`.
2. Task 9 covers 7.9 — **reverse**: Success tests only empty-text disable, not in-flight.
3. Task 6's fit-null list is complete — **reverse**: window-null is missing vs C6.

## What's missing before acting

- Rescope task 5's removal grep (R1-1) — the only blocker.
- Name the 7.9 in-flight sub-case in task 9 (R1-2).
- Optional: name the window-null fit (R1-3) and the empty-state display strings (Topic 4).

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
