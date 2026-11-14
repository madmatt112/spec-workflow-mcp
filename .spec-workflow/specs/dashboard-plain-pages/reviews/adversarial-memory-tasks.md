# Adversarial Review Memory — tasks

Last updated: 2026-11-14 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 — MUST_FIX [drafting].** Task 5's removal grep
  `grep -rn "buildSpecRows\|SpecListRow\|SpecPanel" src --include='*.ts' --include='*.tsx' --exclude-dir=__tests__`
  matches `buildSpecRows` comment prose in `src/dashboard/shell/usage-rows.ts:4,30`.
  That file is deleted only in task 10 and is absent from task 5's `File:` list, so
  the Success "finds nothing" is false and the task stalls `file-outside-list` (retro
  P1/P12). Fix: scope the grep to task-5-owned files or exclude `usage-rows.ts`.
- **R1-2 — SHOULD_FIX [drafting].** Task 9 lists Req 7.9 but its Success collapses the
  two confirm-disable triggers (design C10: empty text OR in-flight) into "disabled
  with empty text". The one-press-one-request / in-flight guard is untested; task 9 is
  implementer-only (`kind: e2e`) so nothing backstops it. Fix: name the in-flight
  sub-case in task 9's Success.
- **R1-3 — MINOR.** Task 6 omits the window-null → fit-null sub-case (design C6 guard
  `window is not null`; Error Handling #3 "every fit is null"). No crash (short-circuit
  order), low risk.
- **R1-4 — MINOR (pattern).** Empty-state display strings not e2e-pinned: "No
  decomposition" (1.4/task 5), "No usage window seen yet" (4.3/task 7), burn "not
  known yet" (4.5 — task 7 seeds always-known burn), and Req 4.1's reset-time/bar
  sub-elements beyond "per cent left". Server-side nulls are tested; only the rendered
  text is unasserted.

## Patterns & Themes

- **Retired-symbol scrub greps vs sibling comment prose (R1-1).** The recurring
  file-outside-list stall: a `grep … finds nothing` Success walks `src` but a symbol
  survives in a comment of a file a *later* task deletes. Future rounds: for every
  deletion/feed task, re-run the literal grep against the tree as it stands *after
  that task* (not end-state), and confirm every hit is in the task's `File:` list.
- **Sub-case collapse in Success clauses (R1-2, R1-3).** `_Requirements` lists an AC
  but the Success line names only one of its triggers/branches. Check each listed AC's
  distinct sub-cases against the Success clause, especially for implementer-only /
  `kind: e2e` tasks with no test author.
- **Empty-state display strings (R1-4).** Builder-null is tested, the rendered empty
  string is not. Recurring across Specs/Usage/Deferrals.

## Guidance for Next Review

- Re-verify R1-1 is fixed by *scope*, not by adding `usage-rows.ts` to task 5 (adding
  it would be wrong — it is task 10's deletion). Confirm the rescoped grep still catches
  a real residual `buildSpecRows` in task-5-owned files.
- Confirm task 9's Success gained the in-flight disable assertion (R1-2).
- Deltas-first: attack whatever the reviser changed; the lint-touched citations
  (tasks 3/4/7/11) are already verified clean this round — do not re-walk them unless
  re-edited.
- Closed/settled this round: visual `row`-kind ordering, pill-parity across tasks 7–9
  (D28), shell-specs regression guards, suite partition green-per-task, resolve-route
  security, dependency chains, `kind: e2e` routing. Do not re-open without new evidence.
- No design defect found; DESIGN_READY stayed yes. Both live findings are tasks-level
  drafting.
