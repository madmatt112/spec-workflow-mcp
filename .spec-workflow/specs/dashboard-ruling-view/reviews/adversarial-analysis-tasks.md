# Adversarial Analysis — dashboard-ruling-view/tasks (v1)

Round 1. Primary surface: **atomicity, ordering, coverage**. Fresh lens: none.

## What I checked and how

- Read tasks.md, requirements.md, design.md, codebase-context.md, decomposition entry 33,
  and agent-rules.md.
- Re-verified every citation the v1 lint commit touched (the whole `## Changes since`
  section): `./tsconfig.json:20` (excludes `src/dashboard_frontend/**` — correct),
  `./playwright.worktree.config.ts:67` (`SDD_DEPLOY_DISABLED: '1'` — correct),
  `src/controller/phases/implementation.ts:843-844` (gate-tool error stop — correct),
  `stage.ts:13` (`StageName`, no `answer` — correct), `board-view.test.ts:1624` (local
  fixture `StageName`, independent of the real one — "needs no edit" is correct),
  `board-view.test.ts:19-33` (dynamic-import pattern — correct), `HomePage.tsx:148-171`
  (`openWait` re-derive + board swap — correct). All delta citations hold.
- Spot-checked the artifact anchors each task relies on: `WaitRecord` state.ts:207-226;
  `createWait`/`listWaitsForWire`/`answerWait`/`upsertSection`/`noteText` in waits.ts;
  `ImplementationPhaseOutcome` 124-144, `isTddMarked` 256-259, `stop` 566-578, `runTask`
  649-952, `taskCommits` 668-669, SEAM-DEFECT 703-704, flagged returns 787-788/945-947,
  gate note 848; `waitAnd` 622-631, `handleImplementationOutcome` 1242-1309, ruling wait
  1259-1271, security text 1285-1287, error wait 1303-1307, doc escalation 1359-1364,
  `escalationRulings` 1188-1204; `ParsedTask`/`taskBlock`/`parseTasksFromMarkdown`;
  `getLatestReview` 182-185, `TaskReview` 297-308, `ReviewFinding` 242-251; the wait routes
  693-735 and `readWait`/`readRun` imports; the design C5 risk regex. Every cited symbol and
  range matches the tree.
- Grepped `AnswerSheet` across `src e2e` (task 11's scrub): only HomePage.tsx (import+use),
  AnswerSheet.tsx (deleted) and worktree-board.spec.ts (comment :697) hold it — all three in
  task 11's `File:` list. HANDOFF.md also holds it but sits at repo root, outside the
  `src e2e` grep scope. No file-outside-list stall (retro P12 clear).

## Deltas attacked first (the lint pass)

The checkpoint→worktree diff is the lint pass: directory-prefixing bare citations, de-ticking
three prose tokens on line 5, dropping `task 5`→`a later task` in task 1, and changing the
illustrative ledger id in task 7 from `gate: task 12` to `gate: task 2`. The path/de-tick
edits preserve meaning and all resolve correctly. The one substantive change is the task-7 id
swap — see R1-1.

## Findings

### R1-1 — [drafting] SHOULD_FIX — Task 7 lost its only `riskFromLedger` prefix-boundary sub-case

The lint pass rewrote task 7's Success from "task `1` does not match a `gate: task 12` note"
to "task `1` does not match a `gate: task 2` note" (delta, line 120). Design C5 pins the regex
to `^gate: task <taskId> \S+ risk (low|medium|high)\b` — the **space after `<taskId>`** is the
whole point: it stops a query for task `1` from matching a `gate: task 12`/`task 10`/`task 11`
note. The old example exercised exactly that boundary; `gate: task 2` does not (a wholly
different single digit never prefix-collides with `1`).

Per retro P7 the test author writes to the Success clause, so the boundary sub-case is now
silently dropped. agent-rules ("names each sub-case in its Success line … the tasks-phase
review rejects a Success line that collapses distinct sub-cases into one behaviour") names this
pattern: "ignores notes for another task id" has two distinct sub-cases — a different id and a
prefix-colliding id — and only the trivial one survives.

Failure scenario: an implementer writes `text.startsWith(`gate: task ${id} `)`-style logic but
drops the trailing space, or uses `\d+` greedily; `riskFromLedger(ledger, '1')` then returns
task 12's risk. The operator's ruling screen shows the wrong risk level for task 1. The weakened
test passes green because it never feeds a `task 1X` note.

Fix (reviser-only, no requirement/design/scope change): restore a prefix-colliding example
(e.g. task `1` must not match a `gate: task 12` note) and fix the citation-identifier lint's
skip-regex so quoted ledger-example text is not read as a forward task reference — the correct
disposition under the "lint false positive graduated at the check" house rule, rather than
weakening the test to dodge the check.

### Minor notes (do not keep the loop alive)

- MINOR — the e2e (task 11) seeds a gate-**B** wait and asserts "The plan", but never a gate-A
  wait, so the gate-A "Recorded without asking" proposal heading (R5 AC 3) is rendered but
  never exercised by any check. Symmetric with gate-B; low risk.
- MINOR — no check presses `ruling-abandon` (R6 AC 9): `offersAbandon` is unit-tested (task 10)
  and the button is rendered (task 11), but the click→`abandon`→cancel path is left to the base
  `controller.ts` invariant and never asserted end-to-end.
- MINOR — the "risk not scored yet" row text (R3 AC 3) is only reachable when `riskFromLedger`
  returns null; task 7 tests the null return but no e2e fixture lacks a gate note, so the
  display string is untested.

## Topics attacked

1. **Atomicity.** Task 11 is the one heavy task (full `RulingView.tsx` with 7 layouts + task
   row + 6 diff states + form, HomePage rewire, AnswerSheet deletion, a new multi-kind e2e
   spec). I judged it acceptable: the frontend has no tsc/vitest seam, so the React view and its
   Playwright spec are naturally one unit, and design D4 already split off the retention (task
   12) to stay under the size cap. Not a finding. Tasks 2/3/5/7/8 are right-sized; task 3's
   wrapper is one logical seam with each error/flag sub-case named in Success.
2. **Ordering.** Verified every chain: 2→3→4, 1→4, 1→5, 6→7, 6→8, 7/8→9, 6→10→11→12, 13 last.
   The functional edges 9→11 (view fetches task-9 routes) and 5→12 (note receipt) are not drawn
   as arrows but are covered by the stated "server tasks 1-9 before the view 10-12" rule and
   number-order execution. The never-logged error stop (795) vs gate-tool stop (843): both route
   through the one wrapper; the never-logged test's "no detail" guard forces `ev.report` to be
   set only on the flag path, which is correct and well-covered. No missing hard edge.
3. **Coverage.** Every requirement AC (1.1–6.14) is cited by at least one task; no task maps to
   zero requirements; the `Test:`/Success seams line up with design interfaces; the P7
   success-clause rule holds for every task except the task-7 boundary case above. Task 6 and 13
   are correctly implementer-only (schema guard / verification), and the File-list completeness
   rules (cited-module and root-walk-scrub) hold.

## Top risks / gaps (short doc → 3)

1. The task-7 `riskFromLedger` boundary sub-case was lost to a lint cosmetic (R1-1).
2. Gate-A proposal layout and the Abandon action are rendered but not exercised by any check
   (MINORs) — low likelihood of regression, but the e2e seeds only one proposal-bearing kind.
3. None beyond the above; the spec is tightly cited and the design does the heavy lifting.

## Top 3 conclusions to challenge

1. **"L-5 is a false positive; change the illustrative id to 2."** Reverse: the id change is not
   cost-free — it drops the one discriminating sub-case. The lint should be fixed at the check.
2. **"Task 6 needs no Test seam (D2)."** Stands — pure type shape, cannot fail red; L-4's
   rejection is sound and matches agent-rules implementer-only routing.
3. **"The gate-tool stop needs no case of its own (D5)."** Stands — the never-logged error test
   proves the shared wrapper carries task+commits for every error return site.

## What's missing before acting

Only R1-1. Restore the prefix-boundary example in task 7's Success (and graduate the lint
skip-regex). Everything else is ready to implement.

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 3
DESIGN_READY: no
ESCALATE: none
