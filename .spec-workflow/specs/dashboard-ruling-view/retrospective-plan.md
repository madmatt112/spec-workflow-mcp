# Retrospective plan — dashboard-ruling-view

Status: APPROVED
Date: 2026-11-10

## Approved proposals

- **P1 (F1) — Root-walking Success grep caught a sibling task's test comment.**
  The P12 rule already requires listing every file that holds the symbol, but it cannot
  cover a file that does not exist at tasks-authoring time: task 10's author test was
  written mid-run and its prose comment cited `AnswerSheet.tsx`, so task 11's root-walking
  `grep -rn AnswerSheet src e2e` matched a file no author could have listed. The smallest
  cause-removing change is to scope a retired-symbol Success grep so it cannot match a
  sibling's comment prose — restrict the grep to the implementation surface the task owns
  (e.g. `--include` on source globs, or exclude `__tests__`), so a later test's comment is
  out of range.
  Target: harness skills or agents (tasks-drafter success-criteria rule).
  Effort: S. Risk: low: a scoped grep still proves the symbol is gone from shipping code; a
  stray test comment was never the thing the check guarded.
  Prerequisites: none.
  Eval case: tdd-root-walk-scope — grader seeds a retired symbol in a sibling test comment
  and checks the task's Success grep does not route a file-outside-list verdict on it.
  DECISION NEEDED: yes. The P12 rule recurred; strengthen it or accept the escalation net?
  - Option A (recommended): scope retired-symbol Success greps to owned source files so
    sibling test/comment hits cannot match — removes the class, including run-created files.
  - Option B: keep P12 as-is and accept the file-outside-list escalation as the safety net
    (it cost 1 escalation, 0 adjudications here).
  - Option C: require authors to list anticipated sibling test files — brittle, cannot
    cover files not yet designed.

- **P2 (F2) — Task 1 negative tests shipped as regression guards.**
  `createWait` ignores unknown fields at base, so the two detail/commits negative tests pass
  unchanged and were kept as guards. This is exactly the `tdd-regression-guard` rule and the
  sub-case rule (agent-rules "A task whose acceptance covers more than one distinct
  sub-case…") working as written: the author used judgement, no fix round, no cost. No change
  needed.
  Target: none (behaved as designed).
  Effort: S. Risk: low: no defect, the guard is correctly non-counted.
  Prerequisites: none.
  Eval case: none — no change proposed.
  DECISION NEEDED: no.

- **P3 (F3) — Back to board leaves a stale answer-stage entry in useStages.**
  `HomePage.backToBoard` clears `openWaitId`/`openWaitSnapshot` but not the `wait:<id>` entry
  in `stages.stages`, so a reopened still-open wait briefly shows a stale "failed: …". The
  effect is inert and cleared on the next press. The cause-removing fix is a `clear(key)` on
  `useStages` called from `backToBoard`, which task 12's File list forbade — so it was
  correctly deferred (d-f1167a89). Do the small product fix in the next dashboard task that
  already touches `useStages`; the deferral tracks it until then.
  Target: product code (`useStages`, `HomePage.backToBoard`).
  Effort: S. Risk: low: adds one map-delete on an already-cleared path.
  Prerequisites: a task that lists `useStages` in its File list.
  Eval case: none — product code, not harness/server surface.
  DECISION NEEDED: no.

- **P4 (F4) — `isTddMarked` matches `kind: e2e` anywhere in the task block.**
  `isTddMarked` (`src/controller/phases/implementation.ts:273`) tests `/\bkind:\s*e2e\b/i`
  over the whole block, so a backtick span or prompt prose quoting the marker flips a real
  TDD task to implementer-only. The quick fix on main stopped the crash, not the false
  positive. Match the marker only in its canonical position — anchored to its own line
  (`/^\s*kind:\s*e2e\b/im`) or read from the parsed task field rather than the raw block —
  so prose that merely quotes it does not route.
  Target: server code (`src/controller/phases/implementation.ts`).
  Effort: S. Risk: medium: routing logic that already halted one run; anchor change needs the
  real tradr marker shape as a fixture to avoid a new false negative.
  Prerequisites: F6 (the canonical marker form the anchor keys on).
  Eval case: controller-tdd-mark-anchor — grader feeds a block whose prose quotes `kind: e2e`
  in a code span and a block with the real marker line, asserts only the latter routes
  implementer-only.
  DECISION NEEDED: no.

- **P5 (F5) — TDD marking logic is duplicated across controller and brief tool.**
  The controller (`isTddMarked`, block regex) and the brief tool (`src/tools/harness.ts`,
  `!!task?.tests && task.tests.length > 0`) decide the same routing by different rules; the
  mismatch is what crashed task 7. Extract one predicate in core that both import, keyed on
  the parsed task plus the anchored marker, so the two surfaces can never disagree again.
  Target: server code (new shared predicate in `src/core`, used by controller and brief tool).
  Effort: M. Risk: medium: touches the routing both consumers depend on; land with F4 under
  one test set.
  Prerequisites: P4 (defines the single correct rule to share).
  Eval case: core-tdd-mark-single-source — grader asserts controller and brief tool return
  the same marking for a battery of blocks, including the `kind: e2e`-in-prose case.
  DECISION NEEDED: no.

- **P6 (F6) — The `kind: e2e` marker has no documented convention.**
  No tasks-drafter rule defines the marker; the one real use (tradr) writes it inline in a
  Purpose line — the prose shape that trips the block-wide match. Document the marker as its
  own line in the task block (not inline in prose), so P4's anchor and P5's shared predicate
  have a convention to key on, and add a tasks-phase lint that flags an inline `kind: e2e`.
  Target: harness skills or agents (tasks-drafter) and `docs/SDD-HARNESS.md`.
  Effort: S. Risk: low: documents an existing marker, no behaviour change beyond a lint.
  Prerequisites: none (but P4/P5 should adopt the documented form).
  Eval case: tasks-lint-e2e-marker — grader checks an inline `kind: e2e` in a Purpose line is
  flagged and a standalone marker line passes.
  DECISION NEEDED: no.

- **P7 (F7) — Coordinator escalation on task 11's File list.**
  The file-outside-list escalation surfaced the exact File-list patch, the orchestrator
  applied it, and the task re-ran green — 1 escalation, 0 adjudications. The designed safety
  net worked. No change needed; P1 addresses the upstream cause.
  Target: none (behaved as designed).
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none — no change proposed.
  DECISION NEEDED: no.

- **P8 (F8) — Stale-stage bug deferred as a harness-owned info-finding, not escalated.**
  The verifier judged the C9 gap inert and inside task 12's restriction and deferred it
  rather than opening a ruling. That is the correct disposition for an inert finding a task's
  File list forbids fixing: a deferral tracks it (see P3), a ruling would spend a human on a
  cosmetic flicker. No change needed.
  Target: none (behaved as designed).
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none — no change proposed.
  DECISION NEEDED: no.

- **P9 (F9) — The `kind: e2e` crash was quick-fixed and the remainder deferred.**
  The quick fix stopped the run halt; the residual false positive is deferred (d-9c725b5d)
  and answered by P4–P6. No separate change; close the deferral when P4/P5 land.
  Target: none (folded into P4/P5).
  Effort: S. Risk: low.
  Prerequisites: P4, P5.
  Eval case: none — covered by P4/P5 cases.
  DECISION NEEDED: no.

## Decisions

- P1: The P12 rule recurred; strengthen it or accept the escalation net? → scope retired-symbol Success greps to owned source files so sibling test/comment hits cannot match — removes the class, including run-created files.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P2: skipped — no change chosen
- P7: skipped — no change chosen
- P8: skipped — no change chosen
- P9: skipped — no change chosen
- P1: done — 4353215945f3dc9a58fc16bfc268aabfb8aac9ae
