# Requirements Document

## Introduction

This spec makes the dashboard sidebar show one row per project, with that project's state. It is for the operator, who reads the sidebar to see which projects have a run live or a wait open. It folds run worktrees into their project, counts each spec store once, keeps eval fixtures out of the operator's files, removes registrations whose path is gone, and adds a status dot and a sort order to each project row.

## Alignment with Product Vision

The steering directory has no `product.md`, so this spec aligns with the decomposition entry for spec 28 and the dashboard redesign it continues (specs 15 and 22). The sidebar is the operator's index of the controller's projects, and today it shows rows that are not projects and counts that are twice the truth. This spec makes the sidebar a correct index without a new page, route or visual style beyond the dot.

## Requirements

### Requirement 1 — A run's worktree is not a project of its own

**User Story:** As the operator, I want a run's worktree to show under the project it belongs to, so that the sidebar does not gain a row each time a run starts.

Terms. A **linked worktree** is a git working tree that is not its repository's main working tree. A worktree entry **folds** into a **parent project** when the dashboard lists the parent and does not list the entry. A **listed project** is one the dashboard project set holds (`src/dashboard/project-manager.ts:11-22`) that has not itself folded. The dashboard classifies an entry as a linked worktree, and finds that worktree's main working tree, by a git determination on the entry's workspace (`src/core/git-utils.ts:260-270`), not by path comparison: a separate-store main checkout (AC9) also has workspace unequal to workflow root, so the stored paths alone cannot tell the two apart. The determination runs only for an entry whose workspace and workflow root differ; an entry whose two paths are equal is a plain repo and needs none.

#### Acceptance Criteria

1. WHEN the dashboard builds its project set AND a registry entry's workspace is a linked worktree AND a listed project has a workspace equal to that worktree's main working tree and a workflow root equal to the entry's workflow root THEN the entry SHALL fold into that project.
2. IF no listed project matches by criterion 1 AND a listed project has a workspace equal to the entry's workflow root AND a workflow root equal to the entry's workflow root THEN the entry SHALL fold into that project, so a store-only match can never fold a worktree onto a project that holds a different store.
3. IF no listed project matches by criterion 1 or 2 THEN the entry SHALL be listed as its own project, as today. Invariant (verified, not red-first): this holds at base, and `e2e/worktree-shared.spec.ts:370-414` (two worktree servers, no main project) stays green unchanged.
4. WHEN an entry folds THEN the dashboard SHALL hold no project context for it, so it has no sidebar row, no Now idle row, no spec rows, and no second set of watchers on the parent's store (`src/dashboard/project-manager.ts:181-256`).
5. WHEN a registry sync, a manual add or a removal changes the listed projects THEN folding SHALL be evaluated again in that same sync, so a worktree row disappears when its parent appears and reappears when its parent is removed, without a dashboard restart (`src/dashboard/project-manager.ts:134-176`).
6. WHEN a request names a folded entry's id on a per-project route (for example `GET /api/projects/:projectId/deferrals`) THEN the route SHALL answer as it does today for an id the dashboard does not list (`src/dashboard/multi-server.ts:576-583`).
7. The MCP server SHALL still register its own per-worktree entry under its own id, and the registry file format and lock SHALL be unchanged. Invariant (verified, not red-first): `src/server.ts:185-195` and `src/core/project-registry.ts:317-393` hold at base, and `e2e/worktree-shared.spec.ts:748-795` stays green.
8. The MCP server's tool context (workspace path and workflow root) SHALL be unchanged. Invariant (verified, not red-first).
9. IF a project's workspace is a main working tree and its workflow root is a different directory (an operator registration with a separate store, such as `tradr-hosted · tradr`) THEN it SHALL keep its own row. Invariant (verified, not red-first): only linked worktrees fold.
10. A folded entry SHALL NOT be written to `projects.json`. Invariant (verified, not red-first): `src/dashboard/project-manager.ts:240-249` already skips an entry whose two paths differ.

### Requirement 2 — The Specs and Deferrals counts read each spec store once

**User Story:** As the operator, I want the Specs and Deferrals counts to be the real numbers, so that a live run does not double them.

Two listed projects **share a store** when their workflow roots are the same string; the registry stores both paths realpath-normalized (`src/core/project-registry.ts:354-393`).

#### Acceptance Criteria

1. WHEN the sidebar shows the Specs count THEN it SHALL count each pair of spec store and spec directory once, however many listed projects share that store (`src/dashboard_frontend/src/modules/shell/Sidebar.tsx:41`).
2. WHEN the sidebar shows the Deferrals count THEN it SHALL count each pair of spec store and deferral record with status `deferred` once, however many listed projects share that store (`src/dashboard_frontend/src/modules/shell/Sidebar.tsx:42-44`).
3. IF at least one listed project on a store is enabled in the sidebar filter THEN that store's specs and deferrals SHALL count; IF every listed project on it is disabled THEN they SHALL NOT.
4. WHEN a run is live in a linked worktree on a store THEN the Specs and Deferrals counts SHALL equal the counts with no run live.
5. WHEN the Specs page lists spec rows THEN it SHALL group rows by store rather than by project id and list each pair of store and spec once, so its row count under the same filter equals the Specs count (`src/dashboard/shell/shell-feed.ts:94-101`, `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:95,169`).
6. WHEN the Deferrals page lists deferral records THEN it SHALL list each record of a store once, however many listed projects share that store.
7. The shell feed SHALL read each distinct store once per flush for spec rows, not once per listed project.
8. The project-list payload SHALL carry each listed project's store identity (its workflow root), and the Specs count, the Deferrals count, their page lists and the any-enabled filter of criterion 3 SHALL key on that store identity. Today the payload carries only the workspace path (`src/dashboard/project-manager.ts:301-313`), the frontend `Project` shape has no store field (`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:8-13`) and each `SpecListRow` carries a single `projectId` (`src/dashboard/shell/types.ts:71-83`), so without it the count, the filter and the page lists cannot agree.

### Requirement 3 — An eval run registers nothing in the operator's files

**User Story:** As the operator, I want eval runs to leave my project list alone, so that fixture repositories never show in the sidebar.

#### Acceptance Criteria

1. WHEN `runCases` starts a step THEN the spec-workflow server that step launches SHALL write no entry to the operator's registry, the `activeProjects.json` under the registry directory the operator's own servers use (`src/evals/runner.ts:141`, `src/evals/runner.ts:179-198`, `src/core/global-dir.ts:40-51`).
2. WHEN an eval run ends THEN the controller's `projects.json` SHALL hold no entry it did not hold before the run.
3. The eval's server SHALL still serve its tools with the fixture root as both workspace and workflow root, so case results do not change (`src/evals/runner.ts:186-189`).
4. A unit test SHALL prove criterion 1 without a live model call, through the injectable step of `RunCasesOpts` (`src/evals/runner.ts:42-49`).
5. The eval runner SHALL NOT read, edit or delete entries in the operator's registry or `projects.json` to meet criteria 1 and 2.

### Requirement 4 — A registration whose path no longer exists is removed

**User Story:** As the operator, I want registrations for deleted directories to go away, so that deleted worktrees and eval fixtures do not stay in the sidebar.

#### Acceptance Criteria

1. WHEN the dashboard starts THEN it SHALL remove every registry entry whose workspace path or workflow root path does not exist, whether or not its pids are alive (`src/core/project-registry.ts:474-504`).
2. WHEN the dashboard starts THEN it SHALL remove from `projects.json` every entry whose workspace path or workflow root path does not exist, and SHALL NOT list it (`src/controller/state.ts:451-474`, `src/dashboard/project-manager.ts:77-92`).
3. A path SHALL count as not existing only when its stat fails with `ENOENT` or `ENOTDIR`. Any other failure SHALL keep the entry.
4. IF path translation is on (Docker mode) THEN the check SHALL stat the translated path (`src/core/path-utils.ts:108`); IF translation throws THEN the entry SHALL be kept.
5. The check SHALL run at dashboard start only. Registry reads SHALL stay free of filesystem calls per entry (`src/core/project-registry.ts:178-206`).
6. Registry removals SHALL run under the registry lock (`src/core/project-registry.ts:317-337`).
7. WHEN an entry is removed THEN the dashboard SHALL log one line naming the file, the project id and the missing path.
8. The startup removal from `projects.json` SHALL NOT drop an entry the controller remembered or refreshed concurrently; `rememberProject` and `forgetProject` write that file unlocked as atomic-rename read-modify-write (`src/controller/state.ts:455-473`), so the removal SHALL serialize with those writes, the integrity the registry lock of criterion 6 gives the registry side.

### Requirement 5 — Each project row carries a status dot and a live-run count

**User Story:** As the operator, I want each project row to show whether it is running, waiting on me or idle, so that I can see where to look without opening the Now page.

#### Acceptance Criteria

1. Each sidebar project row SHALL show exactly one status dot, with one of three states: `waiting`, `running` or `idle` (`src/dashboard_frontend/src/modules/shell/Sidebar.tsx:79-92`).
2. WHEN the project has an open controller wait (`project` equal to the project id, `state` open) OR a row on the Now page's "Waiting on you" list for that project id THEN the dot SHALL be `waiting` (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:241-280`).
3. WHEN the dot is not `waiting` AND the project has at least one live run THEN the dot SHALL be `running`.
4. WHEN neither criterion 2 nor 3 holds THEN the dot SHALL be `idle`.
5. The live-run count of a project SHALL equal the number of rows the Now page's Live runs group shows for that project: its controller runs with a status in the Now page's live set, plus a ledger-derived live row only when it has no such controller run (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:27`, `src/dashboard_frontend/src/modules/shell/NowPage.tsx:257-264`).
6. WHEN the live-run count is 1 or more THEN the row SHALL show it beside the dot; WHEN it is 0 THEN the row SHALL show no count.
7. The dot SHALL carry a text alternative that names its state and, when shown, the live-run count, so the state does not depend on colour alone.
8. The dot's colours SHALL come from the token file spec 22 introduced; the frontend SHALL contain no new hard-coded colour.
9. The dot and the count SHALL update from data the sidebar already receives (the project list poll, `controller-runs`, `controller-waits` and `shell-now`), with no new route, poll or WebSocket topic.
10. The dot SHALL be the only new visual element; row height, font and spacing SHALL stay as spec 22 left them.
11. The sidebar filter SHALL NOT change a row's dot or its sort position (R6); the sidebar already renders a row for every listed project regardless of the filter (`src/dashboard_frontend/src/modules/shell/Sidebar.tsx:80-91`), and the filter gates the Specs and Deferrals counts and the page lists only.

### Requirement 6 — Active projects sort first

**User Story:** As the operator, I want projects with a live run or an open wait at the top, so that the projects that need me are first.

#### Acceptance Criteria

1. WHEN the sidebar lists projects THEN projects whose dot is `waiting` or `running` SHALL come before projects whose dot is `idle`.
2. Within each of the two groups, projects SHALL sort by last activity, newest first.
3. A project's last activity SHALL be the newest `updated` time among all its controller run records, of any status (`src/dashboard/shell/types.ts:186-202`).
4. A project with no controller run record SHALL sort after every project in its group that has one; ties and projects with no record SHALL sort by display name.
5. WHEN a push arrives that changes no project's dot or last activity THEN the order SHALL NOT change.

### Requirement 7 — End-to-end verification

**User Story:** As the operator, I want the decomposition's scenario proved on a running dashboard, so that the fix holds outside unit tests.

#### Acceptance Criteria

1. WHEN a project has one live run in a linked worktree on its store THEN the sidebar SHALL show one row for it, with a `running` dot and a live-run count of 1, and the Specs and Deferrals counts SHALL equal those with no run live.
2. WHEN an eval run completes THEN the registry and the sidebar SHALL be unchanged.
3. WHEN a registered workspace directory is deleted and the dashboard restarts THEN its row SHALL be gone.
4. WHEN one project has an open wait and another idle project has newer activity THEN the first SHALL show the `waiting` dot and sort above the second.
5. `npm run build`, `npx tsc --noEmit` and `npm test` SHALL be green.

## Non-Functional Requirements

### Performance
- The start-time existence check costs one stat per registry and `projects.json` entry, once per dashboard start.
- Folding costs one git determination per sync, run only for a registry entry whose workspace and workflow root differ (`src/core/git-utils.ts:260-270`); an entry whose two paths are equal needs none, and a failed determination keeps the entry listed (NFR Reliability).
- A shell-feed flush SHALL read no more spec stores than it reads today; with a live worktree run it reads fewer.

### Security
- An eval run SHALL put no fixture path into the operator's registry or `projects.json`.
- The status data SHALL add no path to the wire; the dot uses ids, statuses and times already sent.

### Reliability
- Folding SHALL never delete a registry entry; only the start-time existence check of Requirement 4 deletes entries.
- A failure while computing folds or existence SHALL keep the entry listed, as today, and log once.

## Decisions taken in this document

- D1 — Where a worktree folds: the options were the server registers under the parent's id, the dashboard folds the entry when it builds its project set, or the server skips registration inside a worktree; chosen the dashboard fold because spec 1's registry contract and its race test need one entry per worktree, and only the dashboard reads the registry.
- D2 — How the eval stays out of the operator's files: the options were isolate the eval's server from the operator's registry, remove its entries after the run, or filter fixture paths out in the dashboard; chosen isolation because a removal after the run is lost when the run crashes, and a path filter would also hide real projects under the temp directory.
- D3 — Where and when stale registrations go: the options were the registry and the durable project list at dashboard start, the registry only, or a check on every registry read; chosen both at start because the three eval rows live in the durable list, and registry reads must stay free of filesystem calls.
- D4 — Dot precedence: the options were waiting before running, running before waiting, or two dots on one row; chosen waiting first because it is the only state that needs the operator.
- D5 — Which parent a worktree folds into: the options were main working tree and store first with the store's own project as fallback, the store only, or the main working tree only; chosen the two-step rule because a store with a separate code root would otherwise fold a run into the wrong row.
- D6 — A worktree with no matching parent: the options were keep its row as today, or hide it; chosen keep because hiding a server that no other row represents makes it invisible.
- D7 — What counts as waiting: the options were open controller waits only, or the full set the Now page's waiting list shows; chosen the full set so the dot and the Now count agree.
- D8 — What last activity is: the options were the newest run record update, the durable list's seen time, spec file times, or the registry's registration time; chosen the run record update because the seen time refreshes on every start and file times need a directory walk.
- D9 — Whether deduplication reaches the page lists: the options were the counts only, or the counts and the Specs and Deferrals page lists; chosen both so a count always matches the rows under it.
- D10 — The filter on a shared store: the options were count it while any project on it is enabled, or follow one chosen project's toggle; chosen any-enabled because the operator toggles projects, not stores.
- D11 — What a missing path is: the options were not-found errors only, or any stat failure; chosen not-found only so a permission error or a slow mount never deletes a real project.
- D12 — Money, personal data and legal posture: not applicable; the spec touches no money, personal data, or legal surface, and its only deletion is of the operator's own stale local registrations.
- D13 — Store identity on the wire: the options were add the workflow root to the project-list payload, put a store key on the spec rows, or keep per-project attribution; chosen the payload workflow root because the count, the filter and the page lists all have to key on the store to agree, and the payload is the one shape every one of them already reads.
- D14 — The filter against the dot and the sort: the options were force a filtered-out project to idle and the bottom, or compute its dot and sort position as for any other project; chosen the latter because the sidebar already shows a row for every project whatever the filter, so the filter governs counts and page lists, not rows.

## Scope notes

- Cut, as the decomposition records for later work: one row per product (a store and its separate code root, as `tradr-hosted` and `tradr-hosted · tradr`), better display names than the folder name, a persistent Hide, worktrees nested under their parent, and a Remove action.
- Deferred: removing stale registrations while the dashboard runs. Requirement 4 checks at start only, which is what the decomposition's verification asks for.
- Deferred: showing a folded worktree's server instances on the parent row. The dot and the count read run records and waits, not server instances.
- Changed relative to spec 1 (`worktree-execution-context`, requirement 1's user story): a worktree still registers as its own project in the registry, but the dashboard no longer lists it when its parent is listed.
- The steering directory has no `product.md`; the alignment section cites the decomposition instead.
- Carried items from the decomposition: none.

## Revision History

- **v1** (2026-10-29) — Initial draft.
  - **Lint pass.** 1 fixed; rejected: L-2/L-3/L-4/L-5 — `waiting`/`running`/`idle` are new dot-state literals R5 AC1 defines, not code identifiers; citations anchor the row markup and wait derivation correctly.
- **v2** (2026-10-29) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 1/4/2).
  - **R1-1 — Accepted (MUST_FIX).** Added R2 AC8 requiring the project-list payload to carry each project's store identity (workflow root) so the counts, the any-enabled filter and the page lists all key on the store; restated R2 AC5 to group Specs-page rows by store, not by project id; recorded the choice as D13.
  - **R1-2 — Accepted (SHOULD_FIX).** R1 Terms now states the dashboard classifies a linked worktree and finds its main working tree by a git determination, not path comparison, and runs it only for an entry whose two paths differ; a new NFR Performance bullet bounds the cost to one determination per such entry per sync.
  - **R1-3 — Accepted (SHOULD_FIX).** Added R5 AC11 and D14: the filter governs counts and page lists only, never a row's dot or sort position, since the sidebar renders every project row regardless of the filter.
  - **R1-4 — Accepted (SHOULD_FIX).** Added R4 AC8: the projects.json startup removal must serialize with the controller's unlocked remember/forget writes and never drop a concurrently added entry, naming the atomic-rename seam.
  - **R1-5 — Accepted (SHOULD_FIX).** R1 AC2 fallback now also requires the listed project's workflow root to equal the entry's workflow root, so a store-only match can no longer fold a worktree onto a different store.
  - **Minors — noted, no change.** R5 AC6 "1 or more" is a harmless over-generalization under the one-run-per-store guard; R5 AC8 token availability is a design-phase note.
  - **Lint pass.** 0 fixed; rejected: L-1/L-2/L-3/L-4 — `waiting`/`running`/`idle` are dot-state literals R5 AC1 defines, not code identifiers. The citations anchor the Sidebar row markup (Sidebar.tsx:79-92) and the NowPage wait derivation (NowPage.tsx:241-280), both re-verified. Rule 11 suppresses these: the tokens are unchanged since v1's reasoned rejection.
