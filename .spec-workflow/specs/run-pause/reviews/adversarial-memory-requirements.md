# Adversarial Review Memory — requirements
Last updated: 2026-10-29 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — Two response-body citations excluded the artifact line. Fixed in v2:
  `run-not-found` anchors `multi-server.ts:814`, `not-paused` anchors `:823`. Re-verified correct.
- **R1-2 (SHOULD_FIX, v1)** — `merging → paused` erased the only merge-resume signal (`status:'merging'`).
  Fixed in v2: R3 AC3 sets the `merge` cursor (`stepKind:'merge'`) on pause; R4 AC2 names it as the marker
  `runOnce`'s `resumingMerge` reads (`runs.ts:779-781`), same one the `blocked` path sets (`:689-691`).
  Mechanism verified sound.
- **R1-3 (MINOR, v1)** — Row-level Pause had no error surface ("as the panel does" had no target). Fixed in
  v2: R6 AC2 requires the error surfaced without opening the panel and defers the render location to design
  (Scope notes). Cites (`RunsPage.tsx:209-233` stateless row, `:321` panel error line) verified.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (SHOULD_FIX, Compounding R1-2, v2)** — R3 AC3 pauses a `merging` run but never says to clear
  `resumeAt`. A merging run always carries `resumeAt = now + 30 s` (`runs.ts:677`/`:726`,
  `MERGE_POLL_INTERVAL_MS=30_000`). `isStartable` (`controller.ts:336-339`) starts any paused run once
  `resumeAt <= now`, so an operator pause can self-resume mid-deploy — violating D9 and the Reliability NFR
  ("an operator pause has no `resumeAt`"). R3 AC2 explicitly clears `resumeAt`; R3 AC3's silence reads as
  "keep it". Fix: R3 AC3 clears `resumeAt` on the paused write.

## Patterns & Themes
- The `merging → paused` transition is the recurring fragile seam. R1-2 closed the re-entry marker (cursor);
  R2-1 shows the *same* write also leaves `resumeAt` dangling. When an AC changes a run's status, make it
  state every field of the write (status, reason, resumeAt, inFlight, cursor), not just the new one.
- Per-AC asymmetry misleads: when one AC spells out a field (R3 AC2 "clear resumeAt") and a sibling AC that
  needs the same handling omits it, implementers read the omission as intent.
- Citation precision (the v1 theme) is now clean — all v2 anchors land on their artifacts.

## Guidance for Next Review
- If the reviser clears `resumeAt` in R3 AC3, fix-induced re-check only: confirm the paused-from-merging
  write now lists `resumeAt: none` (or equivalent) and that no other paused-write AC lost a field — not a
  full re-read.
- Well-covered, do not re-attack without new evidence: response-body anchors (R1-1), the merge-cursor
  re-entry mechanism (R1-2), the row error-surface deferral (R1-3), crash-recovery ordering R5 AC3–AC5
  (checked sound this round), live/terminal status partition (R1), `runEvents` emission (R1 AC7).
- Next fresh-lens candidate if a round 3 runs: the multi-site enforcement of R2 AC6 (usage-limit under a
  pending pause → operator pause) across the document phase, `handleImplementationOutcome` (`runs.ts:1120-1181`)
  and the merge-fix usage-limit path (`runs.ts:720-722`) — does every usage-limit write honour a pending pause?
