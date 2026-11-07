# Requirements Document

## Introduction

This spec fixes eleven operator items in launch, close-out, cancel and the Home board. It serves the operator who runs specs from the dashboard across projects that share one spec store.

## Alignment with Product Vision

`.spec-workflow/steering/` holds no `product.md`, so the goals below come from the decomposition entry for spec 36. The spec removes human waits that no human judgement needs and stops launches on the wrong repository. The board then shows only true run state, so the operator can trust it.

## Requirements

### Requirement 1 — Project display names

**User Story:** As the operator, I want a short name for each project, so that I can tell the two tradr projects apart.

#### Acceptance Criteria

1. WHEN a project has a stored display name THEN Home, Specs, Usage, Deferrals, the gear and the advisor push text SHALL show it in place of the generated name (`src/core/project-registry.ts:130-139`, `src/advisor/push.ts:88-96`).
2. WHEN a server re-registers a project THEN the stored display name SHALL stay. `registerProjectLocked` overwrites `projectName` at base (`src/core/project-registry.ts:354-360`, `:376`).
3. WHEN the controller restarts, or the project has no live registry entry THEN the display name SHALL stay. The durable row is in `projects.json` (`src/controller/state.ts:619-628`, `src/dashboard/project-manager.ts:127`).
4. IF a project has no display name THEN it SHALL show the generated name (invariant, verified, not red-first: `src/core/project-registry.ts:234`).
5. WHEN a display name changes THEN the project id, runs and waits SHALL not change (invariant, verified, not red-first: the id hashes the path, `src/core/project-registry.ts:118-123`).
6. WHEN a staged action tile renders THEN it SHALL show the project's display name. `actionTarget` prints the raw id at base (`src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280`).
7. The operator SHALL set a display name with no code change. The design states where.
8. WHEN this spec deploys THEN the project with code root `/home/mcf/repo/tradr` SHALL be named `tradr app`, and the project with code root `/home/mcf/repo/tradr-hosted` SHALL be named `tradr infra`, and no page SHALL show `tradr-hosted · tradr`. These values SHALL be registry data. No file under `src/` or `harness/` SHALL hard-code a tradr path or name.

### Requirement 2 — Launch guard

**User Story:** As the operator, I want the Next tile to warn me when the spec's files are not in that project's repository, so that I do not launch on the wrong one.

#### Acceptance Criteria

1. WHEN a Next tile renders THEN it SHALL show the project's code root, the value a launch stores as `codeRoot` (`src/controller/controller.ts:259`, `src/dashboard/project-manager.ts:302`).
2. WHEN two enabled projects share a store and the spec is launchable THEN Next SHALL show one tile per enabled project. This replaces dashboard-board Requirement 8 AC 2 and `nextProjects` (`src/dashboard_frontend/src/modules/shell/board.ts:61-76`).
3. WHEN the spec's files do not exist under the tile's code root THEN the tile SHALL show a warning that names that code root and the project to use.
4. WHEN the warning shows THEN a first press of Launch SHALL send no request and SHALL arm the tile, and a second press SHALL post the same `buildLaunchInput` body (`src/dashboard_frontend/src/modules/shell/harness.tsx:40-52`).
5. WHEN no warning shows THEN one press SHALL launch (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/HomePage.tsx:188-194`).
6. IF no project of the store holds the files THEN the warning rule in AC 8 SHALL apply, and the tile SHALL never name a project that does not hold them.
7. A launchable spec often has no `tasks.md` and no directory (`src/dashboard/harness/run-setup.ts:230-239`), so this is the common case at launch. WHEN `tasks.md` exists THEN the guard SHALL read its `File:` entries (`src/core/task-parser.ts:332-345`). WHEN it does not exist THEN the guard SHALL read the source the design states, and that source SHALL give a comparison for a decomposition entry that names repository paths. WHEN no source gives a file list THEN the tile SHALL say so and Launch SHALL need one press.
8. The design SHALL state the rule for a spec that creates mostly new files. A path that exists under no project of the store SHALL NOT count against a tile.
9. IF the guard's read fails THEN the tile SHALL still render, with no warning.
10. The launch route, `launchSpec` and `enqueue` admission SHALL not change (invariant, verified, not red-first: `src/dashboard/multi-server.ts:105-132`).

Verification: with task files only in the app repository, the `tradr infra` tile warns and a first press does not launch, and the `tradr app` tile shows no warning. A second scenario, a launchable spec with no `tasks.md`, exercises the design-stated source on the common branch and holds the same warning rule.

### Requirement 3 — Close-out builds recorded decisions

**User Story:** As the operator, I want the close-out to act on my retro answers, so that an approved decision is built or reported.

#### Acceptance Criteria

1. WHEN the close-out reads a plan THEN it SHALL read the `## Decisions` lines that `buildRetroPlanMarkdown` writes (`src/controller/runs.ts:340-363`). Each decision is one line (`src/controller/runs.ts:356`) and the read takes that line; an answer of `no answer` SHALL count as not recorded.
2. WHEN an approved proposal has a recorded answer THEN its close-out line SHALL NOT be `skipped — no change chosen`. At base the fallback at `src/controller/phases/closeout.ts:362-375` writes that line for a class `none` item with no `Decision:` line and no human target.
3. WHEN an item with a recorded answer goes to a batch THEN the brief SHALL carry the answer. `itemsText` holds only the item block at base (`src/controller/phases/closeout.ts:404`).
4. IF an item has a recorded answer and its target gives no landing class THEN its line SHALL be `to-do (human) — ` and a reason that states the answer and why no batch can build it.
5. IF the recorded answer itself chooses no change THEN the line SHALL be `skipped — ` and the answer text. The match over free text is heuristic; the design pins and tests it.
6. WHEN an item with a recorded answer does not land THEN its line SHALL be `to-do (human) — ` and the reason. `src/controller/phases/closeout.ts:633` writes `skipped` at base. The commit revert for an item that did not land SHALL not change.
7. WHEN an approved item carries a `Target document:` line THEN the close-out SHALL read it as the item's target. `classifyTarget` and Step 1 match only `Target:` (`src/tools/harness.ts:541-546`, `src/controller/phases/closeout.ts:368`), so G1 and G2 read as class `none`.
8. WHEN an approved item has no recorded answer and its target says no change THEN its line SHALL stay `skipped — no change chosen` (invariant, verified, not red-first).

Verification: a plan shaped like the option-lifecycle-events plan never writes `skipped — no change chosen` for P6, P11, G1 or G2.

### Requirement 4 — File-list patch

**User Story:** As the operator, I want a genuine off-list file added to the task automatically, so that a run does not wait on me for a one-line `tasks.md` edit.

#### Acceptance Criteria

1. WHEN every reason of the gate before a fix round starts with `file-outside-list:` AND the implementer reports `REQUIRED:` for a file those reasons name THEN the controller SHALL add that file to the task's `File:` entries in `tasks.md`, commit the spec store, and gate the task again with the new list, with no wait. At base this stops as a design defect (`src/controller/phases/implementation.ts:929-936`).
2. WHEN the controller applies a patch THEN the run ledger SHALL gain one row with the task id, the fix round, the file and the `REQUIRED:` reason.
3. A patch SHALL add only files that are both in the flag and in the gate reasons. It SHALL change no other line, and the parser SHALL read the new entry (`src/core/task-parser.ts:332-345`).
4. IF the gate has any other reason, or the flag names a file outside the reasons, or the round followed a verifier verdict THEN `REQUIRED:` SHALL stop as a design defect (invariant, verified, not red-first).
5. WHEN the patched gate reports high risk THEN the verifier SHALL run, through the base routing (`src/controller/phases/implementation.ts:858-871`).
6. A patch SHALL use the round already counted, and the fix round cap SHALL apply (`src/controller/phases/implementation.ts:880-893`).
7. WHEN a round has no `REQUIRED:` flag THEN the unchanged-commit escalation SHALL stand (invariant, verified, not red-first: `src/controller/phases/implementation.ts:826-842`).
8. The gate's `file-outside-list` rule SHALL not change (invariant, verified, not red-first: `src/core/gate-rules.ts:520-530`).
9. The fix brief and the implementer agent text SHALL say that a `REQUIRED:` report patches the list (`src/tools/brief-templates.ts:797-807`, `harness/agents/sdd-implementer.md:31`). The flag prefix SHALL stay, so the eval case stays valid (`harness/evals/implementer-file-outside-list-classify/case.json:29`).
10. Unit tests SHALL cover this requirement with a stub fix round. No new eval role SHALL be added.

### Requirement 5 — Doc review cap

**User Story:** As the operator, I want doc review to end after round 1 when only drafting defects remain, so that a run does not pay for a second review of wording.

#### Acceptance Criteria

1. WHEN a reviewer reports a MUST_FIX or SHOULD_FIX item THEN the item SHALL carry a label, `drafting` or `design`. A drafting defect is one the reviser can fix with no change to a requirement, a design choice or the scope: a wrong citation, a stale count, wording, or a lint failure. Every other item is a design defect. The design states how the label travels (`src/controller/phases/document.ts:253-265`, `src/tools/adversarial-review.ts:318-325`).
2. WHEN round 1 returns at least one item and every item is `drafting` THEN the phase SHALL run one corrective reviser version, the lint step and the narrow check over all items, then approve with no second adversarial round. The path at `src/controller/phases/document.ts:892-903` needs `D >= 2` and SHOULD_FIX-only at base.
3. WHEN round 1 returns one `design` item THEN the loop SHALL go on as at base (invariant, verified, not red-first: `src/controller/phases/document.ts:923-929`).
4. IF an item has no label THEN it SHALL count as `design`.
5. WHEN round 1 sets `escalate` THEN the escalation SHALL win (invariant, verified, not red-first: `src/controller/phases/document.ts:861-864`).
6. The cap SHALL apply to requirements, design and tasks. All phases SHALL stay. Round 2 and later SHALL not change.
7. WHEN the cap ends a review THEN the ledger SHALL record it.

### Requirement 6 — Rules and deferrals

**User Story:** As the operator, I want the G1 and G2 rules in force, and the deferrals closed, so that the queue matches what shipped.

#### Acceptance Criteria

1. The G1 and G2 text (lines 143-148 and 155-159 of the `option-lifecycle-events` retrospective-plan.md in the tradr-hosted spec store, outside this code root) SHALL go verbatim into `## Checks` of `.spec-workflow/agent-rules.md`.
2. `readAgentRules` SHALL read the same keys after the edit (invariant, verified, not red-first: `src/dashboard/harness/run-setup.ts:72-141`).
3. WHEN this spec closes THEN `d-83cc3ac1`, `d-37e510db`, `d-4f6a6271` and, for its launch half, `d-aaf54e29` SHALL be resolved.

### Requirement 7 — Cancel stops the driver

**User Story:** As the operator, I want a cancel to be final, so that no agent runs and no wait opens after I stop a run.

#### Acceptance Criteria

1. WHEN a run is cancelled THEN no new step SHALL start for it in any phase, at any of the five `runStep` call sites (`src/controller/phases/document.ts:401`, `src/controller/phases/implementation.ts:472`, `src/controller/phases/retrospective.ts:169`, `src/controller/phases/closeout.ts:319`, `src/controller/merge-fix.ts:229`). At base the document phase reads only the pause hold (`src/controller/runs.ts:989`, `src/controller/phases/document.ts:201-206`), and the retry at `src/controller/runs.ts:1331-1354` starts a second drafter.
2. WHEN a step ends because of a cancel THEN the driver SHALL open no `error` or `escalation` wait and start no retry. Each handler opens a wait at base (`src/controller/runs.ts:1136-1139`, `:1261-1265`, `:1288-1291`, `:1314-1315`, `:1355-1358`).
3. WHEN a run is `abandoned` on disk THEN no later write SHALL change that status. At base `save` spreads the caller's record (`src/controller/runs.ts:566-571`), `runOnce` (`:832`) sets `running` on entry (`:849-851`) and `writeRunLocked` has no guard (`src/controller/state.ts:431-435`).
4. AC 1 to AC 3 SHALL hold after a controller restart, when the in-memory set is empty (`src/controller/controller.ts:90`).
5. WHEN a merge stage is in progress at the cancel THEN it SHALL open no wait and write no status.
6. A cancel SHALL keep the worktree, branch and PR (invariant, verified, not red-first: `src/controller/runs.ts:1380-1400`).
7. The crash wait SHALL still skip a cancelled run (invariant, verified, not red-first: `src/controller/controller.ts:611-638`).

Verification: a cancel during a live step leaves the run `abandoned`, with no second `claude -p`, no new wait and no status change in the next 60 seconds.

### Requirement 8 — True phase and age

**User Story:** As the operator, I want each run tile to show its own phase and age, so that I can trust the board.

#### Acceptance Criteria

1. WHEN a moving run has a `phase` THEN its tile SHALL show it. `RunTile` shows `stepKind` and `task` only at base (`src/dashboard_frontend/src/modules/shell/tiles.tsx:126`, `:165-169`).
2. WHEN a run tile renders THEN it SHALL show the age since `created`. At base `created` sets only the tone, and the visible age is the step's (`src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150`, `:170-174`). The step age SHALL stay.
3. The tile SHALL read phase and age from the run's own `controller-runs` row, never from a ledger (invariant, verified, not red-first: `src/controller/runs.ts:1490-1511`).
4. IF a run has no `phase` THEN the tile SHALL show no phase text.

Verification: a run 2 minutes into requirements, on a project with an older run of the same store, shows `requirements` and its true age.

### Requirement 9 — Running and stopped bands

**User Story:** As the operator, I want the Running band to hold only moving runs, so that its count means what it says.

#### Acceptance Criteria

1. WHEN Running renders THEN it SHALL hold only runs in `queued`, `running`, `merging`, `paused` or `waiting`, in the base order. This replaces dashboard-board Requirement 3 AC 7 (`src/dashboard_frontend/src/modules/shell/board.ts:35`, `:46-59`).
2. WHEN `stoppedAdmitted` admits a run THEN it SHALL appear in a separate stopped band, newest `updated` first, with a plain status word: `done`, `abandoned` or `error`.
3. The stopped band SHALL sit below Next, SHALL have less visual weight than Running, and SHALL not render when it is empty.
4. `runControls` SHALL not change for a stopped run (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/board.ts:119-132`).
5. The design SHALL state how long an abandoned run stays in the band. At base an abandoned run stays while a branch of its name exists (`src/dashboard_frontend/src/modules/shell/board.ts:38-44`).
6. IF a later run reused an older run's branch name THEN Discard of the older run SHALL NOT delete that branch or close that PR. `discardRun` acts by name and `branchHeld` sees moving runs only (`src/controller/runs.ts:1410-1431`, `:1482-1488`). The design states the rule, using `dashboard-deploy` run-20261104-205502 as the case.

Verification: with one running run, one done run and one abandoned run, each stopped run with its branch present, Running holds only the running run and the stopped band holds the other two.

### Requirement 10 — Tile colour follows health

**User Story:** As the operator, I want a red outline to mean trouble, so that a long healthy run does not look broken.

#### Acceptance Criteria

1. WHEN a run tile renders THEN its tone SHALL come from `isStalled` and `runDot`, not `ageTone` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150`, `src/dashboard_frontend/src/modules/shell/board.ts:90-117`): stalled or red is `danger`, amber is `warning`, green or grey is `neutral`.
2. WHEN a healthy run is older than 1 hour THEN its tone SHALL be `neutral`.
3. WHEN a run is stalled THEN its tone SHALL NOT be `neutral`.
4. Wait tiles and action tiles SHALL keep `ageTone` (invariant, verified, not red-first: `src/dashboard_frontend/src/modules/shell/tiles.tsx:78-79`, `:308-309`).

### Requirement 11 — Deploy alignment

**User Story:** As the operator, I want the Deploy control level with the nav links, so that the top bar reads as one row.

#### Acceptance Criteria

1. The `mb-3` class at `src/dashboard_frontend/src/modules/shell/DeployControl.tsx:57` SHALL be removed.
2. WHEN the top bar renders at desktop width THEN the Deploy control's vertical centre SHALL match the nav links' centre within 1 px.

## Non-Functional Requirements

### Performance
- The guard SHALL use file existence checks only, with no git call and no model call, because the setup view refetches every 30 s (`src/dashboard_frontend/src/modules/shell/useNextViews.ts:1-61`).

### Security
- The guard SHALL skip an absolute path or a path with `..`, so that a listed path cannot probe outside the code root.
- The `controller-runs` row SHALL gain no path. The code root reaches the tile from the project list, which already carries it (`src/dashboard/project-manager.ts:302`).

### Reliability
- A failed `tasks.md` patch SHALL fall back to the design-defect stop, with the failure in the ledger.

## Decisions taken in this document

- D1 — The doc review cap fixes the findings before it approves, because a MUST_FIX never stays open and the corrective path already exists.
- D2 — Next shows one tile per enabled project in a shared store, because with one tile the representative is the infra project, leaving no tile for the warning the verification names. Overrides dashboard-board D11.
- D3 — After a patch the controller re-runs the gate on the same commit, because a REQUIRED report makes no commit and the off-list change is already in the task commit. The patch is built from the gate reasons, so the gate output does not change; the ledger row and the spec-store commit keep a wrong patch revertible.
- D4 — A recorded answer that no batch can build becomes a to-do with its reason, because the decomposition asks for a to-do and a guessed landing could put code in the wrong repository.
- D5 — The launch guard warns and never refuses, because both projects stay and some specs change the infra repository.
- D6 — The advisor launch path gets no guard, because its Confirm press is already a second press and the decomposition places the guard on the tile.
- D7 — Cancel applies in every phase, including document phases, because the reproductions were in the requirements phase. Overrides run-pause design D7 for cancel only; the usage window stays out of the document stop.
- D8 — The doc review cap applies to round 1 only and an unlabelled finding counts as design, because the operator's decision says round 1 and a missing label must not skip a review.
- D9 — The stopped band is a fourth band below Next, absent when empty, with the admission rule unchanged, because the operator asked for a separate, quieter band. Overrides dashboard-board Requirement 3's three fixed bands.
- D10 — Tone maps stalled and red to danger, amber to warning, and green and grey to neutral, because the outline follows the same signal as the dot. Action tiles keep age tone, as the entry changes only run tiles.
- D11 — A run tile adds phase and run age and keeps step kind and step age, because the entry asks for phase and age and nothing else.
- D12 — An approved item with a Target document line is read as having a target, because existing approved plans already use it and G1 and G2 carry no Decisions line.
- D13 — G1 and G2 land in this store's rules file only, because the entry names this file and a run here commits nothing in the tradr store.

## Scope notes

Left to the design, as the decomposition asks: how a reviewer labels a finding, where the display name is set, the guard's source with no `tasks.md` and how it disambiguates a path present under more than one store code root, the new-files rule, how long an abandoned run stays in the stopped band, and Discard on a reused branch name. Requirements 1, 2, 5 and 9 set limits on these.

Cut or deferred:

- The eval `file-outside-list-emits-tasks-patch`: cut by the decomposition, because the framework has no role for it.
- The no-PR half of `d-aaf54e29` (related `d-c3c57b89`): out of scope, as the entry resolves only the launch half.
- The spec folder that a later ledger write recreated in the first `d-4f6a6271` reproduction: not listed in the entry and did not recur in the second. Requirement 7 removes the later steps, and no separate requirement covers it.
- Retro P1 and P11: P1 launch checks are covered by Requirement 2. P11 stays on tradr deferral `d-8619948d`.

Carried items: none.

## Revision History

- **v1** (2026-11-07) — Initial draft.
  - **Lint pass.** 18 fixed; rejected: L-4, L-5, L-6, L-7 (`drafting`/`design` are the labels Requirement 5 introduces, absent from base code by design), L-12 (`phase` is the field this AC adds to the tile, absent from the base render by design).
- **v2** (2026-11-07) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/1/4).
  - **R1-1 — Accepted (SHOULD_FIX).** Req 2 Verification now adds a second scenario, a launchable spec with no tasks.md on the common design-stated-source branch; the under-two-roots path disambiguation is deferred to the design in Scope notes.
  - **R1-2 — Accepted (MINOR).** Req 2 AC5 now cites the base one-press path, HomePage.tsx lines 188-194.
  - **R1-3 — Accepted (MINOR).** Req 3 AC1 now states each decision is one line and the read takes that line, so a multi-line answer cannot truncate silently.
  - **R1-4 — Accepted (MINOR).** Req 3 AC5 now flags the no-change match as heuristic over free text, pinned and tested in the design.
  - **R1-5 — Accepted (MINOR).** Introduction now reads eleven operator items, not operator-reported defects, since items 4 and 5 are retro efficiency decisions.
  - **Lint pass.** 0 fixed; rejected: L-1–L-5 (`drafting`/`design`/`phase` = labels/field Reqs 5, 8 add; absent from cited base ranges by design; v1 rejected same class as L-4–L-7, L-12).
