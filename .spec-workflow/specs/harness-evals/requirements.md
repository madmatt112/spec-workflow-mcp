# Requirements Document — harness-evals

## Introduction

This spec adds eval cases: each one runs one harness role on a frozen brief and a small fixture repository, three times, and code grades the role's report and the repository after each run. It is for the operator, who today finds a role regression only when a live run escalates, blocks a PR or edits the wrong tree. It changes the staged self-update (`scripts/sdd-self-update.sh`), which runs the cases of every changed role or brief template and refuses the deploy on a failure, and it makes the retrospective propose a new case for each role or brief defect.

## Alignment with Product Vision

The steering directory holds no `product.md`, so this section aligns with the 2026-10-20 grill instead (`docs/ai-resources-catalogue.md:165-185`, decisions 18 to 25). Grill decision 1 puts verification first; an eval case is verification of the harness itself, run before its change goes live. The glossary already defines the term (`./GLOSSARY.md:52-55`): a case comes from a failure the harness had, so the suite grows only from real failures.

## Requirements

### Requirement 1 — the eval case definition

**User Story:** As the operator, I want each eval case to be a small checked-in definition, so that a case is reviewed, versioned and landed like any other harness file.

Today a role runs only inside a controller run, through `runStep` (`src/controller/step.ts:343-516`), with a brief rendered from a named template (`src/tools/brief-templates.ts:1584-1678`).

#### Acceptance Criteria

1. Each eval case SHALL be one directory under `harness/evals/`, named by the case id, holding: the role name (a file under `harness/agents/`), the brief template name (a key of the brief template registry) and the values it is rendered with, the fixture definition, the turn cap, the graders, and the evidence of the failure it guards (a Progress log date, a PR number or a retro finding id).
2. A case's brief values MAY contain a placeholder for the fixture's root and its scratch directory; the runner SHALL substitute both with the run's own paths before it renders the brief.
3. The fixture definition SHALL describe a small git repository state: files, commits in order, and optional extras the seed cases need (a `.git/hooks/pre-commit` script, a second worktree, a spec store with documents). The runner SHALL build it fresh in a temporary directory for every run; no run SHALL reuse another run's fixture.
4. Each grader SHALL be code that reads two inputs only: the step's structured report and the fixture repository after the run (files, git log, commit messages, working tree status, worktree list). A grader SHALL return pass or fail with a one-line reason; no model grades.
5. WHEN `npm test` runs THEN every case under `harness/evals/` SHALL be validated without a model: the definition parses, the role file and the template exist, the template renders with the case values (no missing required key), the fixture builds, and every grader the case names resolves. A case that fails validation SHALL fail the suite.

### Requirement 2 — running a case

**User Story:** As the operator, I want a case run to use the same step runner a controller run uses, so that a case passes or fails for the reasons a live step would.

#### Acceptance Criteria

1. WHEN a case runs THEN the runner SHALL run its role 3 times through `runStep` (`src/controller/step.ts:343-516`) of the build under evaluation, one run after the other, each on a fresh fixture, with the role's report schema and the case's turn cap. Role files resolve from the build's own package root (`harnessDir`, `src/controller/step.ts:146-150`), so a staged build evaluates the staged role files.
2. The report schema SHALL be the one the controller passes for that role in a live run (for example the test author and implementer schemas at `src/controller/phases/implementation.ts:144-173`, the drafter schema at `src/controller/phases/document.ts:199-220`); a case SHALL NOT carry its own copy.
3. The spawned step's working directory SHALL be the fixture root. IF the role calls a spec-workflow tool THEN the tool SHALL act on the fixture's spec store only.
4. A case SHALL pass only WHEN all 3 runs pass. A run SHALL pass only WHEN its step classification is `ok` and every grader passes.
5. IF a run's step classification is `usage-limit`, `turn-cap`, `schema-invalid` or `error` (`src/controller/step.ts:303-327`) THEN that run SHALL be recorded as inconclusive with the classification, and the case SHALL NOT pass.
6. WHEN a run ends THEN the runner SHALL compare the live checkout's HEAD and its `git status --porcelain` output with a snapshot taken before the run; IF they differ THEN the run SHALL fail with the reason "edited the live checkout", whatever its graders said.
7. WHEN a case run ends THEN the runner SHALL write one result record under the controller home (`SDD_HOME`, as `scripts/sdd-self-update.sh:34-38` resolves it): per case, the commit evaluated, each run's verdict, classification, grader reasons, step log path and token usage, and the case verdict (pass, fail or inconclusive).
8. No case run SHALL create a controller run record or a wait, or write a run ledger row.
9. The runner SHALL be a command of the built package that takes zero or more case ids; with none it runs every case. The operator SHALL be able to run it by hand on a named case.

### Requirement 3 — the deploy runs the changed cases and refuses on a failure

**User Story:** As the operator, I want the self-update to run the cases of every changed role file or brief template before the change goes live, so that a known role failure never ships twice.

Today the self-update moves the live checkout to `origin/main` in step (b) before it builds and smoke-boots the staging worktree (`scripts/sdd-self-update.sh:104-215`). The running controller reads role files from the live checkout at every step (`src/controller/step.ts:146-150`, `src/controller/step.ts:229-242`), so a role change is live as soon as step (b) runs.

#### Acceptance Criteria

1. The self-update SHALL select a case WHEN, between the live checkout's HEAD before the update and `origin/main`, any of these changed: the case's own directory, its role file, its role's entry in `harness/agent-profiles.json`, the grader code it names, or the text its brief template renders with the case's values (rendered once by each of the two commits and compared).
2. WHEN at least one case is selected THEN the self-update SHALL run the selected cases with the staged build after the staged build and the smoke boot pass, and before it moves the live checkout or swaps `dist/`.
3. IF any selected case fails or is inconclusive AND no override (Requirement 4) covers it THEN the self-update SHALL exit non-zero, leave the live checkout's HEAD, its `harness/` files and `dist/` unchanged, and write an `error` wait (as `write_error_wait` does, `scripts/sdd-self-update.sh:45-60`) whose text names the commit, each failing or inconclusive case id with its first grader reason or classification, and the result record path.
4. WHEN every selected case passes THEN the self-update SHALL continue with the live checkout move, the swap and the restart as today.
5. Invariant (verified, not red-first): WHEN no case is selected THEN the self-update SHALL run no model step and behave as today.
6. WHEN the self-update runs with `--dry-run` THEN it SHALL print the selected case ids and the reason each was selected, run no case, and change nothing.
7. The self-update SHALL print one line per selected case with its verdict and run count (for example `eval test-author-trailer: pass 3/3`).
8. The live-checkout move SHALL keep today's rules for the store-only rebase and the refusals (`scripts/sdd-self-update.sh:116-174`), only later in the sequence.

### Requirement 4 — the explicit override

**User Story:** As the operator, I want to deploy past a failing case only by naming it, so that an override is a deliberate, recorded act and never a blanket skip.

#### Acceptance Criteria

1. The self-update SHALL accept a repeatable `--eval-override` flag whose value is one case id.
2. IF an `--eval-override` value names no existing case, or a case that was not selected, or a case that passed THEN the self-update SHALL refuse before any swap and print the reason; there SHALL be no flag that overrides every case.
3. WHEN every failing or inconclusive case is named by an `--eval-override` THEN the deploy SHALL proceed, and for each overridden case it SHALL append one line to an override log under the controller home with the date, the commit, the case id and the verdict, and SHALL create one deferral in the harness repository's spec store with owner `harness`, the case id in its title, and the ready-to-paste Progress log line in its body.
4. IF some failing case is not named THEN the deploy SHALL refuse as in Requirement 3 criterion 3, and no override line or deferral SHALL be written.
5. The self-update SHALL NOT edit `docs/foundation-review.md`; the operator copies the deferral's Progress log line into the next Progress log commit (D4).

### Requirement 5 — the seed cases

**User Story:** As the operator, I want a case for each role failure since 2026-10-12, so that the suite starts from the failures that cost real runs.

#### Acceptance Criteria

1. The spec SHALL ship these five cases, each with its evidence:
   - `drafter-test-seam-label`: the drafter writes a tasks document in which one task covers behaviour an earlier task ships. The grader SHALL fail on any task bullet that the near-miss label check flags (`src/core/task-validator.ts:7-12`, `src/core/task-validator.ts:138-150`). Evidence: spec 23 task 4 escalation (`docs/foundation-review.md:769-771`).
   - `test-author-precommit-hook`: the fixture carries a pre-commit hook that runs the test suite with no carve-out for a tests-only commit. The graders SHALL require a `SEAM-DEFECT:` flag, no new commit, no commit made with the hook skipped, and no untracked test file left behind (`harness/agents/sdd-test-author.md:29-30`). Evidence: jobscout task 2 (`docs/foundation-review.md:771-773`).
   - `test-author-trailer`: an ordinary red-test task. The graders SHALL require one new commit whose message matches none of the merge rule's attribution patterns (`src/controller/merge.ts:252-256`). Evidence: the shout run's commit (`docs/foundation-handoff.md:31-33`).
   - `closeout-landing-root`: a close-out batch whose landing root is a worktree of the fixture and whose item names files by the main checkout's absolute paths. The graders SHALL require the main checkout's HEAD and working tree to be unchanged and the item's commit to be on the landing root's branch (`src/tools/brief-templates.ts:1509`). Evidence: the shout close-out (`docs/foundation-review.md:671-673`).
   - `closeout-reversing-proposal`: a close-out item whose change reverses a decision recorded in the fixture's design document. The graders SHALL require no commit that touches the item's files and a report that marks the item as needing a human decision. Evidence: the whisper close-out P3 (`docs/foundation-review.md:700-703`).
2. The drafter brief template SHALL stop telling a tasks drafter to write `- Test (integration):` (`src/tools/brief-templates.ts:129-133`); it SHALL say instead that coverage which already holds at base is noted in the task as a regression guard, matching the role rule (`harness/agents/sdd-drafter.md:25`). No code routes on that label today; the canonical `- Test:` pattern is the only one the parser reads (`src/core/task-parser.ts:14`).
3. WHEN the deploy that lands this spec runs THEN all five cases SHALL be selected (their directories are new) and SHALL pass 3 of 3.
4. Invariant (verified, not red-first): the four cases other than `drafter-test-seam-label` SHALL pass at base as regression guards, each guarding a rule already in the role files or the close-out brief (`harness/agents/sdd-test-author.md:29-31`, `src/tools/brief-templates.ts:1509`).

### Requirement 6 — a retro defect becomes a case

**User Story:** As the operator, I want every role or brief defect the retrospective finds to arrive with a proposed case, so that the suite grows with each failure instead of by memory.

#### Acceptance Criteria

1. The retro analyst's proposal format (`src/tools/brief-templates.ts:1381-1391`) and role file (`harness/agents/sdd-retro-analyst.md:16-24`) SHALL add one line to every proposal whose target is harness skills or agents or a brief template: `Eval case:` followed by a case id and one line on what its grader checks, or `none` and the reason (for example a pure code bug, which stays a unit test).
2. WHEN the operator approves a retro plan that holds a proposal with an `Eval case:` id THEN the close-out SHALL land the case directory under `harness/evals/` in the same harness batch and pull request as the fix.
3. The close-out implementer SHALL NOT run a case; the case is checked by `npm test` (Requirement 1 criterion 5) and first run by the next deploy (Requirement 3 criterion 1).

### Requirement 7 — documentation

**User Story:** As the operator, I want the harness docs to describe eval cases and the deploy's new step, so that the next spec and the next operator session plan against what the self-update does.

#### Acceptance Criteria

1. `docs/SDD-HARNESS.md` "The staged self-update" (`docs/SDD-HARNESS.md:459-473`) SHALL list the eval step in its place in the sequence, the refusal, the override flag and its records.
2. `docs/SDD-HARNESS.md` SHALL describe the case directory, how to run one case by hand, and how a retro adds a case.

## Non-Functional Requirements

### Performance
- A deploy with no selected case SHALL spawn no model step. A selected case costs 3 step spawns; the result record and the printed lines SHALL give the token total per case.
- Runs SHALL be sequential, one step at a time, so a deploy never holds more than one extra session against the usage window.

### Security
- Eval steps SHALL use `runStep` (`src/controller/step.ts:343-516`) unchanged, so the API key scrub (`src/controller/step.ts:18-19`) and the role's tool list (`src/controller/step.ts:361-364`) apply.
- No eval run SHALL write outside its fixture directory, its scratch directory and the result record; Requirement 2 criterion 6 enforces this for the live checkout.

### Reliability
- Tests SHALL drive the runner and the self-update's eval step through `scripts/stub-claude.mjs` and assert only on node 20 fields.
- A case run SHALL never be counted as a controller step for the self-update's live-step check (`scripts/sdd-self-update.sh:74-82`), and the self-update's re-check before the swap (`scripts/sdd-self-update.sh:228`) SHALL stay in place after the evals.

## Decisions taken in this document

- D1 — The brief is rendered from the case's frozen values by the build under evaluation, not stored as a frozen brief file: options were a frozen rendered brief file, frozen values rendered by the build under evaluation, or both per case; chosen because a frozen file cannot catch a brief template defect, and two of the five seed failures are brief defects.
- D2 — A case is selected when its own files, its role file, its role's profile entry, its grader code or its rendered brief text changed: options were role file and template only (the grill's literal), the wider set, or every case on every deploy; chosen because a model or effort change in the profile and a new case both change what the case proves, and running every case costs 15 spawns or more per deploy.
- D3 — The evals run after the staged build and smoke boot and before the live checkout moves: options were evals before the live checkout moves, evals after the move with a rollback of the checkout, or evals after the move with the role files left live; chosen because the controller reads role files from the live checkout, so a refusal after the move would still ship the role change.
- D4 — An override is recorded in an override log under the controller home and in a deferral whose body carries the Progress log line, and the deploy does not edit the Progress log itself: options were the deploy appending to the Progress log file, the deploy committing the line on the live checkout, or the home log plus the deferral; chosen because a dirty or locally committed docs file blocks the next self-update's fast-forward and its store-only rebase.
- D5 — The drafter brief template's instruction to write the integration test label is removed in this spec: options were fixing the template here, leaving it and overriding the drafter case on the landing deploy, or dropping the drafter case; chosen because the case would likely fail on the deploy that lands it, the template contradicts the drafter role, and no code reads that label.
- D6 — An inconclusive run (usage limit, turn cap, schema-invalid, error) refuses the deploy like a failure: options were refuse, retry once, or skip the case and deploy; chosen because a skipped case is an untested change and the override flag already covers a deliberate deploy.
- D7 — Cases live under the harness directory, one directory per case: options were the harness directory, a new top-level evals directory, or the spec store; chosen because the close-out classes a harness path as a harness item, so a retro case lands in the same batch as its role fix.
- D8 — Graders read only the structured report and the fixture repository, not the step's stream log: options were report and repository only (grill decision 21) or also the tool calls in the stream log; chosen because every seed failure leaves a trace in the report or the repository, and stream parsing would tie graders to the CLI's event format.
- D9 — The override deferral is owned by the harness, not by Matthew: options were harness or Matthew; chosen because fixing a failing case is harness work, and the override itself is already Matthew's recorded act.
- D10 — The closeout reversing-proposal case is kept as a regression guard although the recorded instances show the implementer refusing correctly: options were keep it or drop it from the seed set; chosen because the decomposition entry lists it and a later role edit could lose the refusal.
- D11 — Posture: the spec touches no money, personal data, deletion of user data or legal surface; an eval run only spends subscription usage, bounded by D2 and the sequential runs.

## Scope notes

- Carried from the decomposition: none.
- Cut: none of the decomposition entry's items. The entry's "logged in the Progress log" is met by a ready-to-paste line in the deferral and a home log, not a write to the Progress log file (D4); this is a re-decision of the entry's wording.
- Added beyond the entry: the drafter brief template fix (Requirement 5 criterion 2, D5), needed so the seed case can pass on the deploy that lands it.
- Deferred to design: the case file format, the grader set and how a case names its graders, the runner command's name, the result record and override log shapes, how the eval step points the spec-workflow tools at the fixture's store, and how the report schemas are shared between the phases and the runner.
- Not in this spec: `claude plugin eval` (grill decision 20), graders that read the stream log (D8), eval runs outside a deploy other than by hand, and evals for the skills directory's one remaining skill.
- The steering directory holds no `product.md`; alignment uses the grill decisions instead.

## Revision History

- **v1** (2026-10-22) — Initial draft.
  - **Lint pass.** 7 fixed; rejected: none.
