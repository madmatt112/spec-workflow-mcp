# Adversarial Analysis — dashboard-ruling-view/requirements (v2)

Round 2. Primary surface: completeness, ambiguity, scope. Prompt-named fresh lens:
none. Lens I chose (memory's "next lenses"): testability of each AC and cross-AC
consistency of the cap/length values. Deltas attacked first, per the standing directive.

## What I checked and how

Read the rolling memory, the v1 analysis, `codebase-context.md`, and the v2 diff
(`## Changes since 59bf1447`). The v2 delta is exactly the five round-1 fixes plus the
lint pass — I read both ends of every citation the delta touched:

- **R1 AC 1 split (R1-3):** `HomePage.tsx:154-171` — pressing Answer replaces the board
  with `<AnswerSheet>` in a `space-y-3` slot, a "Back to board" button above it, no board
  band. The base swap/link/hidden-board holds; the content in the slot is `<AnswerSheet>`,
  not the header/task-row/diff. The split (base invariant vs new red-first content at AC
  1.2+) is accurate and cleanly separated — the memory's R1-3 follow-up is satisfied.
- **R2 AC 12 (R1-5 + lint L-11/L-12):** `waits.ts:241-243` is `listWaitsForWire`, which
  strips only `specDir`. The relocated citation is correct. Wire question carries no `task`
  at base (`dashboard/shell/types.ts:57-95`, codebase-context), so "SHALL gain … the
  question `task` tag" and "SHALL NOT carry `commits`" read accurately against base.
- **R4 AC 2 (R1-2):** reworded to name success state `ok` and a `commits` response array;
  no new citation. Matches the four failure states (AC 5-8).
- **R5 AC 7 (R1-1 + R1-4):** `runs.ts:1283-1289` — the security escalation is
  `kind: escalation`, `id: security`, **no** task tag, **no** `recommended`. The exclusion
  "question id is not `security`" + "AC 6 takes precedence" closes the R1-1 collision, and
  "SHALL still show the answer form" closes R1-4. `runs.ts:1359-1364` — the document-phase
  escalate wait is `id: escalation`, free, no task: the parenthetical is correct.

No false codebase claim appears in the delta. Every round-1 finding is dispositioned
Accepted and applied as the Revision History records. The decisions-trim (D1-D10 lost
their "options were …" enumerations) and the two prose removals (Alignment, Scope notes)
drop no requirement — R1 AC 6 still forbids reading the scratch folder; D1/D4 rationale is
intact. MUST_FIX = 0.

## Topics attacked (deltas first)

### 1. R5 AC 7 — the security-escalation precedence fix (fix-induced re-check)

- Challenge that the new guard leaves a taskless wait uncovered. Scoped the check to the
  fix diff: AC 7 now fires on `escalation`/`error`, no task tag, `id != security`; AC 6
  owns `id == security`. The taskless universe is document-phase escalation (`id
  escalation`), merge/close-out/retrospective/implementation error (`id error`), security
  (`id security`). Every member lands in exactly one of AC 6 / AC 7. No orphan, no new
  double-match. Resolved.
- Stress-test that AC 6 still renders the answer controls for `id security`: AC 6 shows
  accept/retry/abandon radios and R6 AC 2 disables the button until a pick (the wait has no
  `recommended`, verified). The D3 hole stays closed. Fine.

### 2. R4 AC 2 — the `ok` success state (fix-induced re-check)

- Challenge the leftover in AC 9 ("In every state of AC 5-8 the answer form SHALL still
  render"): the R1-2 fix named `ok` in AC 2 but AC 9 still enumerates only the four failure
  states, so `ok` is unlisted there. This is not a hole — R3 AC 1's normal order renders
  the form after the diff in the success case — but the enumeration reads as exhaustive and
  omits `ok`. MINOR wording at most; does not block.
- Stress-test the `commits` name reused across R4 AC 2 (diff-response array of commit
  objects) and R2 AC 1/AC 7 (`commits?: string[]` on the record). Different shapes, same
  word; the design phase names the fields. Not a requirements contradiction.

### 3. Cap/length cross-AC consistency (chosen fresh lens)

- Cross-checked D4 against R2 AC 8 (12,000 / 8,000 detail) and R4 AC 4 (60 files / 400
  lines / 512 KiB). All three agree; the detail that rides the pushed wait is bounded at
  ~20k chars, and the diff is a separate capped fetch. No drift.

### 4. Testability of the rewritten ACs (chosen fresh lens)

- R1 AC 1: the red-first portion is the ruling-view content, testable via AC 1.2+; the
  regression-guard portion (swap/link/hidden board) is testable against base. Routable.
- R5 AC 7 / AC 6: each branch is a distinct render assertion keyed on `kind` + question
  `id`; a test author can red-test taskless-non-security and security separately. Routable.
- R4 AC 2: `state: 'ok'` + `commits` array is now an assertable response shape. Routable.

## Top risks / gaps (short doc → 3)

1. MINOR [drafting] R4 AC 9 still says "In every state of AC 5-8", which omits the `ok`
   success state the R1-2 fix introduced in AC 2. The form does render in `ok` (R3 AC 1),
   so this is wording, not a hole. Leave to the reviser's discretion; does not block.
2. (none — no SHOULD_FIX surfaced on the delta or the two fresh lenses)
3. (none)

## Top 3 conclusions to challenge or reverse

1. "The five round-1 fixes are applied correctly." Upheld after re-check — I tried to
   reverse each (AC-7 orphan, AC-2 contract gap, AC-1 mis-route) and each holds.
2. "The decisions-trim lost nothing normative." Upheld — the chosen-rationale and all cap
   numbers survive; only the rejected alternatives were dropped.
3. "The document is testable end-to-end." Upheld — every rewritten AC maps to a red test or
   a declared regression guard.

## What's missing before acting

- Nothing blocking. The only loose thread is the AC 9 enumeration wording (item 1), which a
  one-word reviser touch ("in every diff state" / "including `ok`") would tidy; it is not
  required for the design phase to proceed.

VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
