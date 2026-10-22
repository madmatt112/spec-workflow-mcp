# Adversarial Review Memory — tasks

Last updated: 2026-10-21 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (SHOULD_FIX)** — T8 `Success:` says "the four cases" but the `Task:` body names five `routeForTask` scenarios; the fifth ("an item for another task is ignored" — the task-id scoping test) is silently dropped. A `routeForTask` that ignores `taskId` passes all four and mis-routes every task to Opus when any task is sensitive (defeats R2). Fix: add the fifth case to `Success:`.
- **R1-2 (MINOR)** — T9 regression guard cites R2 AC 11 but lists "repair" (an AC 10 step) instead of the adjudicator; AC 11's adjudicator clause unguarded. Behaviourally safe (holds by construction; design omits it too). Wording fix.
- **R1-3 (MINOR)** — dependency header "(12 needs 5, 9 and 10)" omits the direct T11 dependency (e2e-skip/handoff markers). No build risk; accuracy fix.

## Patterns & Themes
- Success-clause vs Task-body drift is the live risk class for this doc: the test-author writes from `Success:`, so any case the `Task:` body enumerates but `Success:` collapses ("the four cases") is a silently-dropped test. Check every task's Task→Success test-count parity, not just presence.
- Invariant guards ("verified, not red-first") are being mapped loosely to AC numbers (R1-2). The behaviour is safe by construction, but the AC-to-step labels drift.
- Citations are clean: the v1 lint pass normalised function anchors and path prefixes; all delta citations and the key reused seams verified against the tree.

## Guidance for Next Review
- If R1-1 is fixed, re-check only T8's `Success:` diff against R2 AC 1's "for that task" scoping — a fix-induced re-check, not a fresh round.
- Do not re-open: coverage completeness (every AC mapped; R1 AC 13 justifiably task-less), the ordering chain (all producer→consumer edges satisfied by linear order), the T12 bridge-keeps-green (D4), the verifier-spend header claim (only T2/T6/T8/T10 are new modules; no task touches `## Sensitive paths`).
- Rejected-in-design tokens (blocking kinds, new field names, `security:` note vocabulary) are design decisions; do not raise as tasks-phase lint.
