# Adversarial Review Memory — requirements

Last updated: 2026-10-29 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — store identity missing on the wire. Fixed in v2: R2 AC8 +
  AC5 by-store grouping + D13. Verified resolved.
- **R1-2 (SHOULD_FIX, v1)** — worktree-vs-main classification needs git, not path
  comparison. Fixed across v2 (git determination) and v3 (correct primitives). Resolved.
- **R1-3 (SHOULD_FIX, v1)** — filter × dot/sort unspecified. Fixed in v2: R5 AC11 + D14.
- **R1-4 (SHOULD_FIX, v1)** — projects.json startup removal unserialized. Fixed in v2:
  R4 AC8.
- **R1-5 (SHOULD_FIX, v1)** — AC2 fallback could fold onto a different store. Fixed in v2:
  AC2 workflow-root conjunct.
- **R2-1 (MUST_FIX, v2, fix-induced, Compounds R1-2)** — R1 Terms + NFR cited only the
  boolean classifier (`git-utils.ts:260-270`) for the main-tree path. Fixed in v3: cites
  `:133-139` (`gitCommonDirAbsolute`, parent = main tree) for the path half, `:260-270`
  for classify, and routes around `resolveGitRoot` (`:214-252`) whose env override returns
  the store. Verified resolved in r3.
- **R2-2 (SHOULD_FIX, v2, Compounds R1-5)** — AC2 store-only fold not gated on
  linked-worktree classification, contradicting AC9. Fixed in v3: AC2 now opens "IF the
  entry's workspace is a linked worktree AND …". Verified resolved in r3.

### Partially Accepted
(none)

### Rejected
(none; lint L-1..L-5 dot-state literals rejected with reasons — closed, do not re-open)

### Unresolved
(none)

## Patterns & Themes
- The git-utils worktree-classification / main-tree-derivation seam was the one recurring
  weak spot (R1-2 → R2-1). As of v3 it is grounded in the right primitives and the
  `SPEC_WORKFLOW_SHARED_ROOT`-override contamination of `resolveGitRoot` is accounted for.
- The AC1/AC2 two-branch fold rule drifted out of sync with AC9 across rounds; v3's
  linked-worktree gate on AC2 closed the last gap. The rule is now internally consistent.
- Run/wait attribution for a folded worktree surfaces on the parent row because runs are
  keyed by the launch (parent) project id, not the worktree registry id
  (`controller.ts:166`, `live-runs.ts:10-16`) — verified, not a gap.

## Guidance for Next Review
- r3 converged (0/0/3). All prior MUST_FIX/SHOULD_FIX resolved; no new defects in the v3
  deltas. If a v4 is spawned, do not re-examine: git-utils citations (now correct),
  store-identity wire (R2 AC8/D13), serialization (R4 AC8), filter×dot/sort (R5 AC11/D14),
  dot data flow (ShellProvider already subscribes shell-now/controller-runs/-waits),
  run attribution (parent id), dot-state lint literals.
- Only open items are MINOR/design-phase: the by-store Specs group heading display name
  (R2 AC5), R5 AC6 "1 or more", R5 AC8 token availability.
