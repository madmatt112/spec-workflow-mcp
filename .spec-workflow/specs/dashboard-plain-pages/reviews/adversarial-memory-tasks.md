# Adversarial Review Memory — tasks
Last updated: 2026-11-14 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, drafting).** Task 5's removal grep matched `buildSpecRows` comment
  prose in `usage-rows.ts` (deleted only in task 10, not on task 5's File list) → would
  stall `file-outside-list`. v2 scoped the grep with `--exclude=usage-rows.ts` and a
  note. Re-verified in round 2: every other non-test hit is in a task-5-owned file; the
  grep still catches a residual `buildSpecRows` in `spec-rows.ts`. FIXED.
- **R1-2 (SHOULD_FIX, drafting).** Task 9's Success collapsed Req 7.9's in-flight
  confirm-disable into the empty-text disable. v2 added the in-flight sub-case
  (delay route, assert disabled before reply). Re-verified round 2. FIXED.
- **R1-3 (MINOR).** Task 6's fit-null list omitted the null-window case (design C6).
  v2 added "for a null window (no rate-limit.json)". Re-verified round 2. FIXED.

### Partially Accepted
- (none)

### Rejected
- **R1-4 (MINOR, pattern).** Empty-state display strings ("No decomposition", "No usage
  window seen yet", burn "not known yet", Req 4.1 sub-elements) not e2e-pinned. v2
  rejected: builder nulls are tested, page Success lines assert the primary rendered
  strings; pinning every empty-state string adds e2e breadth beyond the finding's value.
  Not re-raised round 2 (no new evidence; round 1 flagged it as a note, not a loop-keeper).

### Unresolved
- (none — round 2 converged 0/0/0)

## Patterns & Themes

- **Retired-symbol scrub greps vs sibling comment prose (R1-1).** The file-outside-list
  stall class. Both scrub greps (task 5, task 10) now verified clean against the ACTUAL
  tree, not end-state reasoning: enumerate every non-test `.ts/.tsx` hit for each grep's
  symbols, confirm each file is either in that task's File list or rewritten by an
  earlier owning task, and confirm the one excluded sibling (`usage-rows.ts`) is the
  only out-of-list hit. The method that caught R1-1 and confirmed the fix.
- **Sub-case collapse in Success clauses (R1-2).** Closed for this document; re-check any
  future delta that touches a Success clause of an implementer-only / `kind: e2e` task.
- **Delta citations accurate.** All four v2 deltas carried accurate citations; no
  fix-induced claim error — the usual round-2 MUST_FIX source was absent here.

## Guidance for Next Review

- Document converged at v2 (0/0/0). If a v3 is spawned, it would be on a new delta only.
- Well-covered, do not re-examine without new evidence: both scrub greps (task 5 +
  task 10, verified against the tree), the dependency chains (1→2→6→7, 3→4→5, 8→9,
  {5,7,9}→10, 11 last), suite partition green-per-task, resolve-route security, pill/row
  visual parity across tasks 5/7/9, `kind: e2e` + implementer-only routing (tasks 9/10/11),
  requirement→task AC coverage (complete), the four task-1 Test seams, empty-state strings
  (R1-4 rejected).
- No design defect found across rounds 1–2; DESIGN_READY stayed yes.
