# Adversarial Review Memory — requirements

Last updated: 2026-11-03 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX)** — Req 2 AC 1: `driven` provenance. v2 names live controller memory as the only truth, hands it to the GET route + feed, forbids persisting to `run.json`, no-lock process reports not-driven. D10 amended. Delta citations re-verified accurate in v2.
- **R1-2 (SHOULD_FIX)** — three hand-mirrored run-row shapes; v2 requires `driven`+`lastActivity` on all three, cites the server copy's `pauseRequested` drift (verified: `src/dashboard/shell/types.ts:194-210` lacks it, the other two carry it). Req 2 AC 2 recast as derived fact, rendering deferred to later dashboard specs, e2e verifies the wire row.
- **R1-3 (SHOULD_FIX)** — Req 4 AC 2 now migrates both readers; `pushState()` at `src/advisor/summary.ts:93-100` confirmed as the second reader.
- **R1-4 (MINOR)** — plain-text message body named in the design-deferred list.

### Partially Accepted
- (none)

### Rejected
- (none; lint L-1..L-23 rejections recorded in the Revision History, not re-opened)

### Unresolved
- **R2-1 (SHOULD_FIX, Novel)** — Req 5 reminder is anchored to the wait's `created` time (AC 1/AC 4) but the first push is not — the pusher only sends when it sees the wait (`src/advisor/push.ts:155-186`), and it has no timer and no push-time record (`pushed.json` is ids-only). A wait first pushed >1h after `created` (controller-down watchdog wait; deploy restart across the hour) gets its reminder sent "at once" per AC 4, firing a redundant second push seconds after the first — defeats the "missed message" user story. Fix: anchor the reminder to first-notification time (record it), and arm it on both the start scan and the live file-watch path, not just on start.

## Patterns & Themes
- Round 1 theme (liveness is live in-process state, every reader is elsewhere) is resolved by the v2 delta; citations were accurate throughout — the weakness was always unstated data-flow, never wrong ranges.
- Round 2 theme: **time anchors.** The pusher is purely event-driven with no clock; Req 5 bolts a scheduling subsystem on and anchors it to `created` while the actual notification time floats. Any requirement that times something off a record field should be checked against when the event the operator cares about actually happens.
- Requirement cites remain accurate across both rounds. No MUST_FIX has appeared; all findings are unstated-behaviour / anchor gaps.

## Guidance for Next Review
- If R2-1 is accepted, verify the revision anchors the reminder to notification time (not `created`) and does not reintroduce the double-push; check the start-scan AND live-push arming are both stated.
- Well-covered, do not re-examine: the `driven` provenance / three-shape / push-config-reader seam (R1-1..R1-3 closed), and all Requirement 1/2/3/6 cites (verified correct twice).
- Unused lens still available: the drive-crash wait discriminator (the "question id design names it") surviving `recover` (`controller.ts:304-317`) and Req 3 AC 7's expire-and-re-drive on start — a correctness/restart angle not yet probed.
- Do not re-open lint L-1..L-23 or any Revision-History ruling without new evidence (mark Recurring).
