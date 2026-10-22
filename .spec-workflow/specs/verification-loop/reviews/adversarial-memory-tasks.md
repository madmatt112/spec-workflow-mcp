# Adversarial Review Memory — tasks

Last updated: 2026-10-21 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — T8 `Success:` named four `routeForTask` cases while the Task body named five; the fifth (task-id scoping) was silently dropped. Fixed in v2 by adding the fifth case — but without the `sensitive-path` qualifier (see R2-1 Unresolved).
- **R1-2 (MINOR, v1)** — T9 guard cited AC 11 but listed "repair" (an AC 10 step). Fixed in v2 by relabelling to "R2 AC 10 and 11"; the three listed steps now map correctly. Residual: AC 11's adjudicator still unnamed — known-safe (holds by construction, design omits it too), not re-raised.
- **R1-3 (MINOR, v1)** — dependency header omitted T12's direct need of T11. Fixed in v2: parenthetical now reads "5, 9, 10 and 11". Closed.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (SHOULD_FIX, v2) — Compounds R1-1, fix-induced.** T8's new fifth case reads "an item whose `taskId` is another task" in both Task body and Success, with no kind. The test author writes from `Success:`; a `keyword` item (taskId = other) satisfies the clause but is ignored by kind, not taskId, so it does not catch a `routeForTask` that ignores `taskId`. On a spec with one sensitive task that bug routes every non-sensitive task to Opus (defeats R2) with a green suite. Fix: insert `sensitive-path` before "item" in both the Task body and the Success clause, as round 1 proposed verbatim.

## Patterns & Themes
- **Success-clause vs Task-body drift stays the live risk class, now one level deeper.** R1-1 was a dropped case; R2-1 is a case that was added but under-specified. A fix that adds the words without the *discriminating* attribute (here, item kind) re-opens the same hole. When checking a fix, verify the added test can actually fail against the defect it targets, not just that the words are present.
- Invariant-guard AC labels keep drifting (R1-2): relabelling fixed the attribution but not the omitted third step (adjudicator). Behaviourally safe each time; the labels over-claim coverage.
- Citations remain clean; the v2 delta was pure prose and added no anchors.

## Guidance for Next Review
- If R2-1 is fixed, re-check only T8's fifth-case diff: confirm both Task body and Success name a `sensitive-path` item for another task. A fix-induced re-check, not a fresh round.
- Do not re-open (closed by ruling / verified clean): coverage completeness (every AC mapped; R1 AC 13 justifiably task-less), the ordering chain, T12's bridge-keeps-green (D4), the verifier-spend header claim, the full Task→Success parity of T1–T7 and T9–T14, the T9 adjudicator residual (known-safe MINOR).
- Rejected-in-design/lint tokens (blocking kinds, new field names, `classAItems` closure, `security:` vocabulary, task-4 e2e-only) are settled — do not raise as tasks-phase lint.
