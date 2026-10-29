# Adversarial Analysis — dashboard-project-list/requirements (v3, round 3)

Attack surface: completeness, ambiguity, scope. Fresh lens: none (per prompt).
Deltas attacked first: the two v3 fixes (R2-1 git citation rewrite in R1 Terms +
NFR Performance; R2-2 linked-worktree gate added to R1 AC2) plus the D1–D14 wording
compression.

## Delta re-checks (both prior findings, fix-induced scope)

**R2-1 (was MUST_FIX) — resolved.** R1 Terms (requirements.md:17) and NFR Performance
(requirements.md:122) now cite `git-utils.ts:260-270` (`isGitWorktree`, the non-`.git`
boolean classification) for the *classify* half and `git-utils.ts:133-139`
(`gitCommonDirAbsolute`, the common-dir primitive whose parent is the main tree) for the
*find-main-tree* half, and explicitly route around `resolveGitRoot`
(`git-utils.ts:214-252`), noting its `SPEC_WORKFLOW_SHARED_ROOT` override (218-221)
returns the store not the main tree. Verified both ends: `gitCommonDirAbsolute` returns
`normalizeIdentityPath(resolve(cwd, raw))` — for a `git worktree add` linked worktree
`raw` is `<main>/.git`, whose parent is the main working tree; `isGitWorktree` returns
`gitCommonDir !== '.git'`; `resolveGitRoot` does parent-of-`.git` at 238-244 but honours
the env override first. Citations accurate, both halves now grounded. The NFR "one call
yields both" is achievable from the single `git rev-parse --git-common-dir` primitive.

**R2-2 (was SHOULD_FIX) — resolved.** R1 AC2 (requirements.md:22) now opens with "IF the
entry's workspace is a linked worktree AND …", repeating AC1's precondition. A
separate-store main checkout (AC9) or an entry whose classification failed no longer
reaches the store-only fold, so AC9's "only linked worktrees fold" invariant and NFR
Reliability's "a failed determination keeps the entry listed" both hold. AC1/AC2/AC3/AC9
are now internally consistent: in the plain-worktree case AC1 and AC2 target the same
store-equals-main-tree project; AC2 differs only when the worktree's store ≠ its main
tree (the D5 two-step case).

**D1–D14 compression — clean.** The v3 edit trimmed "the options were …" prose on D1,
D2, D5, D8, D12, D13, D14 without changing any decision or introducing a code claim.

## Fresh-lens checks that could have been findings but hold

- **R5 AC5 / R7 AC1 — a worktree run must surface on the parent row.** Verified against
  code: `enqueue` writes `project: input.projectId` (the launch/parent project id), not
  the worktree's registry id (`controller.ts:166`), and `liveRunsByProject` keys by
  `run.project` (`live-runs.ts:10-16`). The folded worktree's run is already attributed
  to the parent, so the parent row's `running` dot and count of 1 are implementable.
- **R5 AC9 — "data the sidebar already receives … no new route, poll or WebSocket
  topic."** Accurate: `ShellProvider` already subscribes to `shell-now`,
  `controller-waits` and `controller-runs` (`ShellProvider.tsx:103-106`) and the Sidebar
  already reads `now.waits`/`now.live` (`Sidebar.tsx:37,39-40`).
- **R6 AC3 — last activity = newest `updated` across all run records of any status.** The
  full run list is already in the shell context as `controllerRuns`
  (`ShellProvider.tsx:95,160`), fed by `listRunsForWire` (every run, newest first). No new
  data needed.

## Minors (noted, not loop-keeping)

- R2 AC5 does not say which display name a by-store Specs group heading carries when the
  store's projects differ (`SpecsPage.tsx:169` uses `p.projectName`). Design-phase.
- Carried, unchanged: R5 AC6 "1 or more" under the one-run-per-store guard; R5 AC8 token
  availability.
- The "main working tree is its parent of the common dir" derivation is exact only for a
  standard linked worktree, not a submodule or `--separate-git-dir` worktree
  (`git-utils.ts:120-131`); out of scope for the harness's `git worktree add` runs.

## Top risks/gaps
1. None at MUST_FIX or SHOULD_FIX. The git-utils classification/main-tree seam — the one
   weak spot across three rounds — is now grounded in the correct primitives.
2. The by-store Specs heading display-name choice (MINOR) is the only open wording item.

## Top 3 conclusions — all now stand
1. "R2-1 is resolved" — confirmed; both classify and find-main-tree halves grounded.
2. "R2-2 is resolved" — confirmed; AC2 gated on linked-worktree classification.
3. "Dot/count/sort use only existing data" — confirmed against ShellProvider subscriptions.

## What's missing before acting
- Nothing blocking. Design phase should settle the by-store group heading display name.

---

VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
