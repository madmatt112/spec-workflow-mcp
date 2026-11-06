# Adversarial Review Memory — design
Last updated: 2026-11-06 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1→fixed v2)** — Run red-dot class: cited `Sidebar.tsx:37-41` map has no red; C10 now sends `red → bg-(--tone-danger-fg)` (`tokens.css:92`), green/amber/grey keep the Sidebar tone classes. Verified correct in v2.
- **R1-2 (MINOR, v1→fixed v2)** — Dropped C7's false "only the sidebar read" of `now`/`controllerActivity`/`connected`; all readers are deleted pages. Verified.
- **R1-3 (MINOR, v1→fixed v2)** — C6 hub range split: `snapshotFor` :118-121, `overviewSnapshot` :123-129 kept, `watchedProjects` :131-134. Verified.
- **R1-4 (MINOR, v1→fixed v2)** — C7 now also deletes `Gear.tsx:14` `{ density, setDensity }` destructure so tsc holds. Verified.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved (raised this round, awaiting reviser disposition)
- **R2-1 (MINOR)** — `Observed` type consumed by C11 `resolved`/`advance` is never pinned; reads are enumerated in the `resolved` table and C11 is "illustrative — verify against the test fake," so not blocking and not a Data-Models MUST_FIX (not a requirement-referenced result object).
- **R2-2 (MINOR)** — C4 "nothing changes on branch-in-use" needs `cancelled.add`/`dropFromQueue`/`clearRunActivity` (`controller.ts:374-377`) moved after the `branchHeld` guard; post-condition pins the invariant but the reorder is not enumerated.
- **R2-3 (MINOR, fix-induced)** — Architecture "three run-row fields" under-counts the five in Data Models; enumerated concept list unchanged, Data Models authoritative. Cosmetic.

## Patterns & Themes
- Citations remain accurate across controller, server, feed, frontend and tests; v1 and v2 lint passes plus R1-3/R1-4 tightened the loose ranges. Both lint passes rejected new/cross-file-identifier flags correctly.
- The residual weak spots are the same class as R1: "copy from <cite>" / count shorthands and under-specified internal types (`Observed`) where the prose is slightly looser than the enumerated contract — none break the build.
- Hard parts (Discard/relaunch race under store lock + two-clause `branchHeld`; done-discard cache flush; controller→dashboard/harness layering; Tailwind 4.1.18 probe) re-verified sound.

## Guidance for Next Review
- Design is converged (0/0). If a v3 is produced, re-verify only its delta.
- Do NOT re-examine: dot-class map (closed), hub/Gear/ShellProvider deletion contracts (verified), the Discard race and done-discard cache (verified twice), the Tailwind probe, citation ranges.
- If tasks phase opens: confirm the stage/tile e2e set actually renders the red dot class and the merging tile (not just `runDot`'s return), and that the `Observed` shape is settled against the board-view test fake. Watch the C4 discard reorder (R2-2) lands as stated.
