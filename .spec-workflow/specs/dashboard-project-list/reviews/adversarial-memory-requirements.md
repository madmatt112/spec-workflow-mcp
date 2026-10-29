# Adversarial Review Memory — requirements

Last updated: 2026-10-29 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — store identity missing on the wire. Fixed in v2: R2 AC8
  adds store identity (workflow root) to the project-list payload; R2 AC5 restated to
  group Specs-page rows by store; D13. Verified resolved.
- **R1-2 (SHOULD_FIX, v1)** — worktree vs separate-store-main classification needs git,
  not path comparison; main working tree not stored; cost unbounded. Partly fixed in v2
  (Terms + NFR git-determination bullet) but the fix mis-cites the primitive — see R2-1.
- **R1-3 (SHOULD_FIX, v1)** — filter × dot/sort unspecified. Fixed in v2: R5 AC11 + D14.
- **R1-4 (SHOULD_FIX, v1)** — projects.json startup removal unserialized vs controller
  remember/forget. Fixed in v2: R4 AC8 (serialize with the unlocked atomic-rename writes).
- **R1-5 (SHOULD_FIX, v1)** — AC2 fallback could fold onto a different store. Fixed in v2:
  AC2 gained the `P.workflowRoot === entry.workflowRoot` conjunct. Wrong-store fold closed;
  a different AC2 gap remains — see R2-2.

### Partially Accepted
(none)

### Rejected
(none; lint L-1..L-5 dot-state literals rejected with reasons — closed, do not re-open)

### Unresolved
- **R2-1 (MUST_FIX, v2, fix-induced, Compounds R1-2)** — R1 Terms + NFR Performance cite
  `git-utils.ts:260-270` (`isGitWorktree`, a boolean) for "finds that worktree's main
  working tree". That function cannot return a path. The main-tree derivation lives in
  `gitCommonDirAbsolute` (`git-utils.ts:133-139`) / `resolveGitRoot` (`:214-252`, parent-
  of-.git at 238-244, but note it honours `SPEC_WORKFLOW_SHARED_ROOT` first so it returns
  the store in the AC9 case). Cite the common-dir primitive for the path half.
- **R2-2 (SHOULD_FIX, v2, Compounds R1-5)** — R1 AC2 store-only fold is not gated on the
  entry being a linked worktree (AC1 repeats that precondition, AC2 omits it), so for a
  separate-store main checkout (AC9) whose store is also a listed plain repo, AC2 folds it
  and violates AC9's "only linked worktrees fold" invariant (and NFR Reliability on a
  failed determination). Gate AC2 inside the linked-worktree branch.

## Patterns & Themes
- The weak seam remains the **worktree-classification / main-working-tree derivation** in
  git-utils. R1 repeatedly under-specifies which git primitive yields which value;
  `isGitWorktree` (boolean) vs `gitCommonDirAbsolute`/`resolveGitRoot` (paths) are
  distinct and `resolveGitRoot` is contaminated by the shared-root env override.
- AC1/AC2 are a two-branch fold rule; AC2's preconditions keep drifting out of sync with
  AC1's and with the AC9 invariant. Each round has closed one AC2 gap and exposed another.
- Store-level aggregation wire (R1-1) now sound after AC8/D13.

## Guidance for Next Review
- Confirm the git citation was corrected so both halves (classify + find main tree) are
  grounded, and that the shared-root-env contamination of `resolveGitRoot` is accounted for.
- Confirm AC2 was gated on linked-worktree classification (no path-only fold of a
  non-worktree or an unclassifiable entry).
- Well-covered, do not re-examine: R2 store-identity wire (AC8/D13), R4 serialization
  (AC8), R5 filter×dot/sort (AC11/D14), the dot-state lint literals. Citations outside
  git-utils are verified accurate.
