# Adversarial Analysis — dashboard-project-list/requirements (v1, round 1)

First review. Attack surface: completeness, ambiguity, scope. Fresh lens: wire
contracts across a boundary (router, query params, response shapes, client state).
Changes since the v1 checkpoint are a lint-pass citation fix (R3 AC1 gained
`src/evals/runner.ts:141`) and one Revision History line — no behaviour changed, so
the review is of the whole document under the wire-contract lens.

Checked against the decomposition entry 28 (items 1–6 map to R1–R6; R7 is the
decomposition's end-to-end scenario). Code read: `project-manager.ts`,
`Sidebar.tsx`, `SpecsPage.tsx`, `ShellProvider.tsx`, `ProjectProvider.tsx`,
`NowPage.tsx`, `shell-feed.ts`, `spec-rows.ts`, `shell/types.ts`, `now-model.ts`,
`live-runs.ts`, `project-registry.ts`, `git-utils.ts`, `controller.ts`,
`controller/state.ts`, `evals/runner.ts`, `multi-server.ts`. Citations in the
document were re-probed and are accurate (including R4 AC5 → `project-registry.ts:178-206`,
the `readRegistry` doc block that states the no-filesystem-on-read invariant; and
run attribution: `controller.ts:166` sets `project: input.projectId` = the launch/
parent project id, with the worktree a separate field, so the dot/count land on the
parent row as R5/R7 assume).

---

## Finding R1-1 (MUST_FIX) — R2's "count each store once" + "any-enabled filter" cannot be built against the artifacts it cites

Requirement 2 is the heart of this spec (decomposition item 2). AC1 counts each
(store, spec) once "(`Sidebar.tsx:41`)"; AC2 the same for deferrals
"(`Sidebar.tsx:42-44`)"; AC3 makes the filter *any project on the store enabled*;
AC5 says the Specs **page** row count under the same filter equals the Specs count.
Grounded in the cited frontend, these cannot all hold:

- The project-list payload carries **no store identity**. `getProjectsList`
  (`project-manager.ts:301-313`) returns `projectPath: p.originalProjectPath` (the
  workspace), never `workflowRootPath`; the frontend `Project` type
  (`ProjectProvider.tsx:8-13`) has no store field. The client cannot group projects
  by store.
- Each `SpecListRow` carries a **single** `projectId`/`projectName`
  (`shell/types.ts:71-83`), set once per listed project in the per-project loop
  (`shell-feed.ts:94-101`, `spec-rows.ts:83,155-167`).
- The Specs page renders **one group per enabled project**, matching
  `r.projectId === p.projectId` (`SpecsPage.tsx:83,94-95,107-111,169`). Each spec is
  attributed to exactly one project. The sidebar count is
  `specRows.filter((r) => enabled(r.projectId)).length` (`Sidebar.tsx:41`); the
  deferrals count sums `deferralsByProject[p.projectId]` over enabled projects
  (`Sidebar.tsx:42-44`), and `deferralsByProject` is fetched **once per listed
  project** (`ShellProvider.tsx:127-134`), so two projects on one store fetch and sum
  the same records twice.

Failure scenario: projects A and B share store S (e.g. the e2e case
`worktree-shared.spec.ts:370-414` — two worktrees, no main project — or an operator
registration plus its `· code-root` sibling, R1 AC9). To satisfy AC1/AC5 a
dedup picks one representative projectId per (store, spec). The operator disables A
(representative) but keeps B enabled. The deduped row's `enabled(A)` is false → the
spec vanishes from the count *and* from B's group on the Specs page, violating AC3
("any project on the store enabled → it counts") and AC5 (page rows ≠ count).
Conversely keeping both rows double-counts, violating AC1.

The requirement neither adds a store key to the wire nor changes the page's
"group by projectId" model, so no implementation of AC1+AC3+AC5 exists against the
cited lines. Before design, decide the contract: put `workflowRootPath` on the
project-list payload, or a store key / the full projectId-set on `SpecListRow` and
the deferrals grouping, and restate the Specs-page grouping as by-store.

## Finding R1-2 (SHOULD_FIX) — the fold rule must tell a linked worktree from a separate-store main checkout, which the registry's stored paths cannot do

R1 AC1's precondition is "a registry entry's workspace is a linked worktree," and
AC9 keeps a **main checkout with a separate store** (`tradr-hosted · tradr`) as its
own row — "only linked worktrees fold." But both a linked worktree and a
separate-store main checkout have `workspace ≠ workflowRootPath` in the registry
(`readRegistry` stores both `resolve()`-normalized, `project-registry.ts:226-236`;
the main checkout's store is `resolveGitRoot` of a different directory). Path
comparison alone cannot separate them. Telling them apart needs a git
determination per entry — `isGitWorktree` / `git rev-parse --git-common-dir`
(`git-utils.ts:133-139,260-270`) — i.e. a subprocess per registry entry.

Likewise AC1's "that worktree's **main working tree**" is not a stored field; for a
standard repo it equals `workflowRootPath`, but for the separate-store case D5 is
built for it does not, and it again needs git. R1 AC5 re-runs folding on **every**
registry sync (every MCP server start/stop), so this is N git subprocesses per sync.
NFR Performance accounts only for R4's one stat per entry at start; it is silent on
the fold's git cost at AC5's cadence. (NFR Reliability does cover a *failed* fold —
keep the entry, log once.) Pin in design: how an entry is classified as a linked
worktree, where the main working tree comes from, and the per-sync cost bound — or
add the needed fields to the registry entry.

## Finding R1-3 (SHOULD_FIX) — the sidebar filter × dot/sort interaction is unspecified

The sidebar renders a row for **every** project, enabled or not
(`Sidebar.tsx:80-91`); `enabled` only gates counts and page contents, never the
rows. R5 AC1 puts a dot on every row and R6 sorts rows by dot then activity, but
neither requirement mentions the filter, while R2 handles it explicitly. The dot's
sources (`controllerWaits`, `now.waits`, `controllerRuns`) are unfiltered in
`ShellProvider`; only the Now **page** filters them (`NowPage.tsx:251,257-259`). So
a developer naturally computes the true dot for disabled projects too.

Failure scenario: the operator disables a noisy project to hide its data; it then
opens a wait, lights a `waiting` dot, and R6 AC1 sorts it to the **top** of the
sidebar above the projects they actually watch — the opposite of hiding it. The
other reading (disabled → forced idle/bottom) is equally defensible. Decide whether
a filtered-out project shows its real dot and sort position.

## Finding R1-4 (SHOULD_FIX) — R4's projects.json startup removal can clobber a concurrent controller remember/forget; only the registry side is serialized

R4 AC6 requires registry removals under the registry lock, but R4 AC2 adds a
**bulk read-all / rewrite-all** of `projects.json` at dashboard start with no
serialization named. `projects.json` is written by `rememberProject`/`forgetProject`
as unlocked async read-modify-write over `writeJsonAtomic` (atomic rename only, no
lock — `state.ts:318-323,460-473`), and the same functions are called by the
controller's run path. The R4 startup pass is one more read-modify-write on the same
file.

Failure scenario: at dashboard start the controller remembers a freshly launched
project between the R4 pass's read and its write; the R4 write (built from the
pre-remember snapshot) drops the new project, and a launch reads "Project not
found" until the next register — the exact regression `state.ts:444-448` records
the durable list was added to prevent. The asymmetry (lock the registry, nothing
for the durable list) should be resolved: state the ordering/merge that keeps the
R4 removal from losing a concurrent write, or justify why the startup window is safe.

## Finding R1-5 (SHOULD_FIX) — R1 AC2's fallback predicate is under-constrained and can fold a worktree into a project on a different store

R1 AC2: "IF no listed project matches by criterion 1 AND a listed project has a
workspace equal to the entry's workflow root THEN the entry SHALL fold into that
project." It matches only on `P.workspace === entry.workflowRoot`; it does **not**
also require `P.workflowRoot === entry.workflowRoot`. D5's stated purpose is to stop
folding "a run into the wrong row."

Failure scenario: an operator registration P has `workspace == S` but
`workflowRoot == T` (addable via `POST /api/projects/add` with an explicit
`workflowRootPath`, `project-manager.ts:323-384`). A worktree entry on store S then
folds into P by AC2, and its run disappears under a row that shows store T's specs
and deferrals — the wrong store. Add the `P.workflowRoot === entry.workflowRoot`
conjunct to AC2 (or state why the store-only match is intended).

---

## Minor (noted, not loop-keeping)

- R5 AC6 says "1 or more" for the live-run count, but the admission guard allows at
  most one live run per project/store (`controller.ts:160`), so the value is 0 or 1.
  Harmless over-generalization.
- R5 AC8 assumes spec 22's token file already has colours that read as
  waiting/running/idle; if not, the dot states need new tokens *there* (which AC8
  permits — it forbids only new hard-coded colour in frontend code). Worth a word in
  design so it is not read as "reuse an unrelated token."

---

## Top 3 conclusions to challenge or reverse

1. **"This spec makes the sidebar a correct index … counts read each spec store
   once" (Intro, R2).** Reverse the implicit premise that the frontend can dedup and
   filter per store: it has no store identity on any wire it receives (R1-1). The
   store-identity contract is a prerequisite, not a design detail.
2. **D5: "chose the two-step rule because a store with a separate code root would
   otherwise fold a run into the wrong row."** Challenge: the two-step rule as
   written still can't distinguish a linked worktree from a separate-store main
   checkout without git (R1-2), and AC2's fallback can itself fold into the wrong
   store (R1-5). The decision is sound; the ACs do not yet implement it.
3. **R4 AC6's framing that locking the registry removal is the integrity story.**
   Challenge: the durable list is the shared-with-the-controller file and the one R4
   now bulk-rewrites, yet it has no serialization (R1-4).

## What's missing before acting on this document

- A store-identity wire decision for R2 (payload field or row key) and a restated
  Specs-page grouping model.
- How the dashboard classifies linked-worktree vs separate-store-main-checkout and
  obtains the main working tree, with the per-sync cost bounded (R1, NFR Performance).
- The filter × dot/sort rule for disabled projects (R5/R6).
- Serialization/ordering for the R4 `projects.json` removal against the controller
  (R4).

---

VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 4
MINOR: 2
DESIGN_READY: no
ESCALATE: none
