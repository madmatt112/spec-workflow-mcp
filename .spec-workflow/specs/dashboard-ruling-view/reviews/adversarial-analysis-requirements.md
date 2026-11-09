# Adversarial Analysis — dashboard-ruling-view/requirements (v1)

Round 1. First review. Primary surface: completeness, ambiguity, scope. Fresh lens:
wire contracts across the boundary (router, query params, response shapes, client state).

## What I checked and how

Read `codebase-context.md`, the decomposition entry 33, and every cited artifact at
both ends of its range. The v1 lint pass repaired 20 bare-filename citations; I
re-verified each surviving citation against the code it names. All are accurate:

- `WaitRecord` state.ts:207-226 has no `detail`/`commits`; `WaitQuestion` 166-182 carries
  `task?`. `CreateWaitInput` waits.ts:52-62, `listWaitsForWire` 241-243 (strips only
  `specDir`), `answerWait` 145-150 (renders `questions.md` for gate-a/gate-b only). OK
- `ImplementationPhaseOutcome` implementation.ts:124-144 (task, no detail/commits);
  report schemas 152-182; `isTddMarked` 256-259; the never-logged stop at 795 and the
  gate-tool stop at 843 (both pass no task today); `taskCommits` 668-669 (already filters
  `redCommit`); SEAM-DEFECT stop 703-704; `routeImplementerFlags` 960-1005; the risk note
  848; `appendRulings` 553-559; `hasRulings` 740-745; pending reset 570. OK
- `handleImplementationOutcome` runs.ts:1242-1309; document-phase escalation 1359-1364. OK
- `getLatestReview` task-review-manager.ts:182-185; `TaskReview`/`ReviewFinding`
  types.ts:297-308 / 242-251 carry every field AC 2.6 lists. OK
- `ParsedTask.promptStructured`/`files` task-parser.ts:148-169; `checkAnswerKeys`
  actions.ts:145-154 (guards only `answers`, so a top-level `note` field passes). OK
- Frontend: `HomePage` 149-152 / 154-171 / 76-88, `tiles.tsx:90` (`text-display`),
  `board.ts` 21-32 / 152-163, `AnswerSheet` 45-78 / 200-209 / 210-260 (proposals ticked
  by default, line 128) / 277-292 / 313-317, both wire copies types.ts. OK
- `gates.ts` 148-159 (defer, free+options) and 229-243 (gate B, free+options);
  `controller.ts` 645-676 / 662-668. OK
- `ctx.codeRoot === run.worktree` in the implementation phase (runs.ts:900, 1021), so the
  commits `taskCommits` computes and the diff route's `git show` read the same checkout. OK

No false codebase claim survived. MUST_FIX = 0. Scope matches decomposition 33 (all six
"Delivers", the "Decided" lines, and the "Design should address" bullets are each covered).
The findings below are design gaps the fresh lens surfaced, plus minors.

## Topics attacked

### 1. Requirement 5 AC 6 vs AC 7 — the security escalation dispatch (wire/client state)

- Challenge the claim that AC 7's condition is disjoint from AC 6's. A security
  escalation is created at `runs.ts:1283-1289` as `kind: 'escalation'`, question
  `id: 'security'`, **no `task` tag**. AC 6 fires on "question id is `security`"; AC 7
  fires on "an `escalation` or `error` with no `task` tag". Both match the same wait.
- Stress-test the assumption that AC order resolves it. The view dispatches on wait
  shape, not on the order criteria happen to appear in the doc. An implementer who tests
  "no task tag" first renders "no task: raised in the completion phase" with no findings
  and no accept/retry/abandon radios — the exact security hole D3 was written to prevent.
- Attack the parenthetical in AC 7 ("a document-phase escalation…, a merge or close-out
  error") as load-bearing documentation the normative WHEN clause does not honour: it
  enumerates intended cases but the clause itself is broader than that list.
- Resolution is one clause: scope AC 7 to `escalation`/`error` with no `task` tag **and**
  question id not `security`, or state that AC 6 takes precedence.

### 2. Requirement 4 — the diff route response shape (router/response contract)

- Challenge the completeness of the response discriminant. AC 5-8 name a `state`
  (`worktree-gone`, `run-gone`, `no-commits`, `unreadable`) for every failure. AC 2 (the
  success case) names no `state` and no top-level field for the commit array. A client
  that does `switch (resp.state)` has no success arm.
- Stress-test the two-author seam: nothing fixes whether success is "`state` absent" or
  "`state: 'ok'`", nor whether the payload is `{ commits: [...] }` or another key. Server
  and client can diverge and the diff silently never renders.
- Challenge AC 9 ("In every state of AC 5-8 the answer form SHALL still render") — it
  lists only the failure states, so the success state is unmentioned there too, leaving
  the whole success arm of the contract implicit.
- Probe whether the client needs `commits` on the wire at all (AC 2.12 adds it): the diff
  route reads commits server-side, so the client only needs `detail` (for AC 3.6) and a
  commits-present flag. Adding the raw hash list to the pushed wait is harmless but
  unused; confirm it is intended, not cargo-culted.

### 3. Requirement 1 AC 1 — the "full width" base-invariant claim (scope of red-first)

- Stress-test the tag "Invariant (verified, not red-first): this holds at base
  (`HomePage.tsx:154-171`)". Lines 154-171 prove the board is replaced by the sheet with
  a "Back to board" link and no board band — that part holds. "the ruling view at full
  width" is new: at base the replacement is `<AnswerSheet>` (a `${ui.panel} p-4` card),
  not the full-width header/task-row/diff view AC 1.2+ build.
- Challenge folding a new layout requirement into an AC marked not-red-first: a test
  author takes the whole AC as a regression guard and writes no red test for the
  headline deliverable ("A full-width view in place of the board", decomposition 33).
- If "full width" means only "occupies the whole content column as the sheet already
  does", say so; otherwise split the frame invariant from the new layout.

### 4. Requirement 2 / 6 — the `note` field and `questions.md` paths (completeness)

- `answerWait(id, answers, by)` has no `note` parameter and `noteText`/`gateSection`
  (waits.ts:305-309, 260-272) never emit a note. AC 6.5/6.6/6.7 require a new `note`
  argument threaded into both the ledger row and a new escalation/error `questions.md`
  section. Implementable, but the requirement never states `answerWait`'s signature
  changes — confirm the design owns it so it is not rediscovered mid-run.
- Spot-check the split in AC 6.4 vs 6.5: a typed ruling folds the note into the value; a
  picked option sends `note` separately. AC 6.6 then records "the note when one was sent"
  — for a ruling the note is inside the value, so "when one was sent" reads as the
  separate-field case only. Consistent, but the dual meaning of "note" is easy to misread.

### 5. Requirement 3 AC 2 — TDD derived from `isTddMarked` (unstated dependency)

- `isTddMarked(task, block)` (implementation.ts:256-259) is **not exported** and needs
  the raw `tasks.md` block, not the `ParsedTask`. AC 3.4 reads the row from `tasks.md`, so
  the server can get the block, but it must re-implement the rule (a `- Test:` line and no
  `kind: e2e`). Name this in the design so the server does not import across the
  controller/dashboard boundary or silently drift from the rule.

## Top risks / gaps

1. SHOULD_FIX [design] Security escalation satisfies both R5 AC 6 and R5 AC 7; no
   precedence stated → the generic no-task layout can hide the accept/retry/abandon radios
   (D3's hole).
2. SHOULD_FIX [design] R4 diff-route success response has no named discriminant or payload
   field; the four failure states do → client/server contract gap, diff may never render.
3. SHOULD_FIX [design] R1 AC 1 marks the new "full width" ruling view as a base invariant,
   risking no red test for the spec's headline deliverable.
4. MINOR [design] R5 AC 7 does not say the answer form still renders for a taskless
   escalation/error; a document-phase free-text escalation needs its text box.
5. MINOR [design] R2 AC 12 adds `commits` to the pushed wire though the client reads the
   diff server-side; the raw hash list is unused on the client — confirm intent.

Not severity-counted (design-ownership reminders; the behaviour is already specified): R6
AC 5-7 imply a new `answerWait` `note` parameter and an escalation/error `questions.md`
renderer; R3 AC 2's TDD cell must replicate the unexported, block-reading `isTddMarked`.

## Top 3 conclusions to challenge or reverse

1. "R5 AC 7 covers the taskless escalations." Reverse: it also captures the security
   escalation, colliding with AC 6. Add the `id != 'security'` guard.
2. "R1 AC 1 holds at base, so it is not red-first." Partly false: only the board-swap
   holds; the full-width ruling view is new. Split or re-scope the invariant.
3. "R4 is fully specified." Challenge: the success response — the common case — is the one
   shape with no discriminant; every failure has one. Name the success contract.

## What's missing before acting

- A precedence rule across the R5 kind-dispatch ACs (security vs taskless-escalation,
  and whether the answer form renders for a taskless escalation/error — AC 7 omits it).
- The success half of the R4 diff-route response contract (discriminant + payload field).
- A design note that R6 changes `answerWait`'s signature and adds an escalation/error
  `questions.md` section renderer, and that R3's TDD cell replicates `isTddMarked`.

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 2
DESIGN_READY: no
ESCALATE: none
