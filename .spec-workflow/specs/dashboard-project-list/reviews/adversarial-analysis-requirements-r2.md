# Adversarial Analysis — dashboard-project-list/requirements (v2, round 2)

Attack surface: completeness, ambiguity, scope. Fresh lens: none (per prompt).
Deltas attacked first: the five round-1 fixes now in the document (R1 Terms + NFR
git determination; R1 AC2 workflow-root conjunct; R2 AC5/AC8 + D13; R4 AC8;
R5 AC11 + D14).

Code re-read at both ends of every v2-changed citation:
`src/core/git-utils.ts` (133-139, 214-252, 260-270), `src/dashboard/shell/shell-feed.ts:84-142`,
`src/dashboard/project-manager.ts:295-320`, `src/dashboard/shell/types.ts:71-83`,
`src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:80-179`,
`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:1-20`,
`src/dashboard_frontend/src/modules/shell/Sidebar.tsx:35-100`,
`src/controller/state.ts:440-474`.

Citations verified accurate: R2 AC5 (`shell-feed.ts:94-101` = the per-project spec-row
loop; `SpecsPage.tsx:95,169` = the by-`projectId` state-count and the `<Group>` render),
R2 AC8 (`project-manager.ts:301-313` returns only `projectPath`, no workflow root;
`ProjectProvider.tsx:8-13` has no store field; `types.ts:71-83` carries a single
`projectId`), R4 AC8 (`state.ts:455-473` = unlocked `rememberProject`/`forgetProject`
read-modify-write over `writeJsonAtomic`), R5 AC11 (`Sidebar.tsx:80-91` renders a row
for every project regardless of the filter). R1-1/R1-3/R1-4/R1-5 are adequately
addressed by these deltas and are not re-raised.

---

## Finding R2-1 (MUST_FIX, fix-induced) — the git citation names a boolean classifier for a job (find the main working tree) it cannot do

Compounds: R1-2 (the fix that wrote this clause).

R1 Terms (v2 delta): "The dashboard classifies an entry as a linked worktree, **and
finds that worktree's main working tree**, by a git determination on the entry's
workspace (`src/core/git-utils.ts:260-270`)". The NFR Performance bullet (v2 delta)
repeats the same single citation for the "one git determination per sync".

`src/core/git-utils.ts:260-270` is `isGitWorktree`, which runs
`git rev-parse --git-common-dir` and returns `gitCommonDir !== '.git'` — a **boolean**.
It can answer "is this a linked worktree?" It cannot and does not return the path of
the main working tree, which is the second, load-bearing half of the sentence and the
exact thing R1-2 asked the document to ground ("where the main working tree comes
from"). The main-tree path is derivable from the *common directory* — `/main/.git` →
parent `/main` — i.e. from `gitCommonDirAbsolute` (`git-utils.ts:133-139`, the memory's
own R1-2 pointer) or `resolveGitRoot` (`git-utils.ts:214-252`, which does exactly that
parent-of-`.git` derivation at 238-244). None of those is cited; only the boolean is.

Why it is not cosmetic: `resolveGitRoot` checks `SPEC_WORKFLOW_SHARED_ROOT` **first**
(218-221) and returns that override, so in the separate-store case (AC9) it yields the
store, **not** the main working tree. Finding the main working tree reliably therefore
needs the raw `git rev-parse --git-common-dir` derivation (`gitCommonDirAbsolute`,
133-139), bypassing the env override. Citing `isGitWorktree` tells the implementer
nothing about this and points them at a function that returns `true`/`false`. The NFR
"one git determination" cost claim is achievable only with the common-dir primitive
(one call yields both the boolean and the parent path); `isGitWorktree` alone does not
yield the path at all.

Fix: cite `git-utils.ts:133-139` (and/or `:214-252`) for the main-working-tree
derivation and keep `:260-270` for the classification, or state that one
`git rev-parse --git-common-dir` call yields both and cite the common-dir primitive.

## Finding R2-2 (SHOULD_FIX) — AC2's store-only fold is not gated on the entry being a linked worktree, so it contradicts AC9

Compounds: R1-5 (the same AC2 predicate; R1-5 closed the wrong-*store* fold, this is
the missing worktree gate).

R1 AC9 is labelled an invariant: "IF a project's workspace is a main working tree and
its workflow root is a different directory (an operator registration with a separate
store, such as `tradr-hosted · tradr`) THEN it SHALL keep its own row … only linked
worktrees fold." AC1 enforces this by repeating the precondition "a registry entry's
workspace **is a linked worktree**." AC2 does **not** repeat it: "IF no listed project
matches by criterion 1 AND a listed project has a workspace equal to the entry's
workflow root AND a workflow root equal to the entry's workflow root THEN the entry
SHALL fold." For a separate-store main checkout, AC1's precondition is false, so "no
listed project matches by criterion 1" is vacuously true, and AC2 then folds on path
alone.

Failure scenario: `tradr-hosted` is registered with workspace `C` and store `S`
(`C != S`, AC9's case), and the store directory `S` is also a listed project (workspace
`S`, workflow root `S` — a plain repo). The Terms run the fold determination on
`tradr-hosted` because its two paths differ. AC1 does not fire (not a linked worktree).
AC2 fires: `S`-project.workspace == `S` == entry.workflowRoot and
`S`-project.workflowRoot == `S`. `tradr-hosted` folds into the `S` row and loses its own
row — directly violating AC9 and the cut-scope note that `tradr-hosted` /
`tradr-hosted · tradr` are separate product rows. The same gap means that on a **failed**
git determination (NFR Reliability: "a failed determination keeps the entry listed")
AC2's path-only test can still fold the entry, contradicting that bullet too.

Fix: gate AC2 on the same linked-worktree classification AC1 carries (make AC1/AC2 two
fallbacks *within* the linked-worktree branch), so a non-worktree or an
unclassifiable entry can never reach the store-only fold.

---

## Minor (noted, not loop-keeping)

- R2 AC5 says group the Specs page "by store rather than by project id" but does not say
  what heading a store group carries when its projects have different display names
  (`SpecsPage.tsx:169` uses `p.projectName`). A design-phase detail.
- Carried from round 1, unchanged and still minor: R5 AC6 "1 or more" under the
  one-run-per-store guard; R5 AC8 token availability.

---

## Top 3 conclusions to challenge

1. **"R1-2 is fully addressed."** Reverse: the fix names the classification primitive
   but cites a boolean for the main-working-tree discovery it was asked to ground, and
   the real primitive (common-dir, 133-139) is not cited (R2-1).
2. **D5/AC9 "only linked worktrees fold."** Challenge: AC2 as written can fold a
   separate-store main checkout whenever its store is independently listed, so the
   invariant is not enforced by the ACs (R2-2).
3. **NFR Performance "one git determination per sync."** Challenge: one call suffices
   only with the common-dir primitive; the cited `isGitWorktree` yields the boolean
   but not the path, so taken literally the mechanism needs a second call (R2-1).

## What's missing before acting

- Correct the git citation so both the classification and the main-working-tree
  derivation are grounded (R2-1).
- Resolve the AC2/AC9 contradiction by gating the store-only fold on linked-worktree
  classification (R2-2).

---

VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
