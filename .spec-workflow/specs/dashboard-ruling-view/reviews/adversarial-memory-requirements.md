# Adversarial Review Memory — requirements

Last updated: 2026-11-08 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none; the v1 lint pass already rejected L-7..L-28 with reasons in the Revision History
  — those are closed, do not re-open.)

### Unresolved (round 1)
- R1-1 SHOULD_FIX [design] R5 AC 6 vs AC 7: a security escalation (`escalation`, question
  id `security`, no `task` tag; runs.ts:1283-1289) matches both AC 6 (id=security) and
  AC 7 (no task tag). No precedence stated → the generic "no task" layout can hide the
  accept/retry/abandon radios (D3's hole). Fix: scope AC 7 to exclude id=security.
- R1-2 SHOULD_FIX [design] R4 diff-route success response has no named `state` discriminant
  or payload field, while every failure (AC 5-8) does. Client/server contract gap.
- R1-3 SHOULD_FIX [design] R1 AC 1 tags the new "full width" ruling view as a base
  invariant (HomePage.tsx:154-171); only the board-swap + Back-to-board holds at base, the
  full-width view is new → risk of no red test for the headline deliverable.
- R1-4 MINOR [design] R5 AC 7 does not state the answer form still renders for a taskless
  escalation/error (a document-phase free-text escalation needs its box).
- R1-5 MINOR [design] R2 AC 12 adds `commits` to the pushed wire though the client reads
  the diff server-side; the raw hash list is unused on the client.

## Patterns & Themes
- The document is unusually well-grounded: all citations verified accurate after the v1
  lint pass. The live defects are completeness/precedence gaps in the kind-dispatch and
  the one new wire contract (the diff route), not false codebase claims.
- Fresh lens used this round: wire contracts (router/response/client state). The diff
  route's success half and the R5 kind-dispatch precedence are where the contract thins.
- Design-ownership reminders (not counted): `answerWait` gains a `note` param + an
  escalation/error `questions.md` renderer (R6 AC 5-7); the server replicates the
  unexported `isTddMarked` (R3 AC 2).

## Guidance for Next Review
- Confirm the reviser scoped R5 AC 7 to exclude the security escalation (R1-1) and named
  the R4 success response discriminant/payload (R1-2).
- If R1-3 is dispositioned by re-wording "full width", check the frame invariant and the
  new layout are cleanly separated so the test author is not mis-routed.
- Next lenses not yet used: testability of acceptance criteria (can each AC be given a
  failing test?), and cross-AC consistency of the cap/length values (D4: 12k/8k/60/400/512
  KiB) against R2 AC 8 and R4 AC 4.
- Rulings closed by the v1 Revision History (L-7..L-28) are closed; do not re-open.
