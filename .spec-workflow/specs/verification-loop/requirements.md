# Requirements Document — verification-loop

## Introduction

This spec makes a controller run fix its own red or conflicted pull request, run task implementers on Sonnet unless gate B flagged the task for a sensitive path, check sensitive specs with a security pass that reports only reproduced findings, and flag a PR that adds a new dependency. It is for the operator, who today answers an `error` wait for every red merge-stage PR and pays the Opus tier for every task. It changes the merge stage, the implementation phase's step model choice and completion gate, the PR read the Run page shows, and the run ledger.

## Alignment with Product Vision

The steering directory holds no `product.md`, so this section aligns with the 2026-10-20 grill instead (`docs/ai-resources-catalogue.md:125-163`). Grill decision 1 puts verification first and allows token items only where they are nearly free; R1 and R3 add verification, R2 is the nearly free token item. ADR 0003 stays true: the merge rule is code and a model never merges (`docs/adr/0003-merge-by-rule.md:12-14`).

## Requirements

### Requirement 1 — the run fixes its own blocked PR (C1)

**User Story:** As the operator, I want a red check or a merge conflict on the run's own PR to get two implementer fix rounds before it reaches me, so that I answer an `error` wait only when the harness could not fix it.

Today a PR that fails the rule with nothing in flight is `blocked` (`src/controller/merge.ts:588-591`) and `runMergeStageStep` opens an `error` wait at once (`src/controller/runs.ts:611-682`).

#### Acceptance Criteria

1. WHEN the merge stage of the run's own PR returns `blocked` AND every blocking reason is a failed workflow run, a failed commit status, or a merge conflict (`mergeable` is `CONFLICTING`) AND the run has used fewer than 2 merge fix rounds THEN the controller SHALL run one `sdd-implementer` fix round instead of opening the `error` wait.
2. WHEN a merge fix round runs THEN it SHALL run in the run's worktree on the PR branch, and its brief SHALL name each failing check with the saved log tail of its workflow run (as `prChecksGate` saves them, `src/controller/phases/implementation.ts:1069-1126`) and, for a conflict, say that the branch conflicts with the default branch.
3. WHEN a merge fix round resolves a conflict THEN the implementer SHALL merge the default branch into the PR branch; the controller SHALL NOT rewrite pushed history and SHALL NOT force-push.
4. WHEN a merge fix round ends with a new commit on the PR branch THEN the controller SHALL push the branch and set the run to `merging` with a re-check time, so the next merge pass reads the new CI state (`src/controller/runs.ts:666-668`).
5. WHEN the implementer of a merge fix round reports `INFRA:` THEN the controller SHALL re-run the failed workflow runs (as `src/controller/phases/implementation.ts:1143-1148` does) and the round SHALL count toward the cap.
6. WHEN the implementer of a merge fix round reports `DESIGN-DEFECT:` or `ESCALATE:`, or ends with no new commit and no `INFRA:` THEN the round SHALL count toward the cap and the next merge pass SHALL apply criteria 1 and 7 again.
7. WHEN the merge stage of the run's own PR returns `blocked` AND the run has used 2 merge fix rounds THEN the controller SHALL open the `error` wait as today, and its text SHALL add that 2 fix rounds ran and the reason each ended.
8. WHEN the merge stage returns `blocked` AND any blocking reason is an attribution trailer or a wrong head branch THEN the controller SHALL open the `error` wait as today with no fix round.
9. The merge fix round count SHALL be read from this run's ledger, so a controller restart, a re-entry or an operator "retry" on the `error` wait does not reset it. A "retry" re-runs the merge pass only.
10. WHEN a merge fix round starts THEN the ledger SHALL get the spawn rows of the step and one `note` row that names the round number and the blocking reasons.
11. The merge rule itself SHALL stay model-free: `evaluate` and `mergeByRule` (`src/controller/merge.ts:295-297`, `:568-642`) SHALL run no model step; the fix round is a separate step the run loop starts.
12. Invariant (verified, not red-first): a close-out PR that is `blocked` SHALL open the `error` wait with no fix round (`src/controller/runs.ts:927-931`).
13. Invariant (verified, not red-first): the implementation phase's PR checks gate (reconcile rounds, verifier, adjudicator, `verify-failed`; `src/controller/phases/implementation.ts:1068-1171`) SHALL behave as today.

### Requirement 2 — implementer model by sensitive-path flag (C3)

**User Story:** As the operator, I want a task gate B did not flag for a sensitive path to run its implementer on Sonnet, so that the Opus tier is spent only on the tasks where a mistake costs most.

Today every `sdd-implementer` step runs on the profile model, `claude-opus-4-8` at `xhigh` (`harness/agent-profiles.json:20-25`); `StepSpec` already accepts a model and effort override (`src/controller/step.ts:93-111`).

#### Acceptance Criteria

1. WHEN the implementation phase starts an `sdd-implementer` step for a task (the first implement, its retry, the checks-file re-spawn, and every fix round of that task) AND gate B's class (a) holds no `sensitive-path` item for that task THEN the step SHALL run on the Sonnet route's model and effort.
2. WHEN the same steps start AND class (a) holds a `sensitive-path` item for the task THEN the step SHALL run on the `sdd-implementer` profile's model and effort (the Opus tier).
3. A `keyword` item for a task SHALL NOT route it to the Opus tier, including the destructive-verb items of the saturation fallback (`src/core/veto-rules.ts:65-153`).
4. The flag SHALL be computed by code with the same rule as `harness gate class-a` (`src/tools/harness.ts:1162-1220`) on the `tasks.md` and `## Sensitive paths` list current when the step starts; no model judges it.
5. IF the project's `agent-rules.md` has no `## Sensitive paths` list THEN no task SHALL be flagged and every task step SHALL take the Sonnet route.
6. The model SHALL be chosen once per step, at the spawn; a step SHALL NOT change model while it runs, and a resumed step SHALL keep the model it started on.
7. The Sonnet route's model and effort SHALL be read from `harness/agent-profiles.json`, not written in code; their first values SHALL be `claude-sonnet-5` and `high`. The ten-key, frontmatter-equality and byte-for-byte assertions of `src/__tests__/agent-profiles.test.ts:23-47` SHALL stay green.
8. WHEN a routed step starts and ends THEN its `spawn.start` and `spawn.end` rows SHALL carry the model and effort the step ran on, not the profile's (`src/controller/phases/implementation.ts:371-381` reads the profile today).
9. WHEN a task is picked THEN the ledger SHALL get one `note` row naming the task's route and its reason (the matching sensitive path, or "no sensitive-path flag").
10. Implementer steps that belong to no task (repair rounds, PR checks reconcile rounds, merge fix rounds of R1) SHALL run on the `sdd-implementer` profile's model and effort.
11. Invariant (verified, not red-first): the `sdd-test-author`, `sdd-verifier` and `sdd-adjudicator` steps SHALL keep their profile models.

### Requirement 3 — security pass for sensitive specs (C4)

**User Story:** As the operator, I want a spec that touches sensitive paths to get a security check that reports only what it reproduced, so that I spend attention on real findings and suspicions do not block the run.

#### Acceptance Criteria

1. WHEN the end-to-end verification of the completion gate passes (`src/controller/phases/implementation.ts:884-911`) AND at least one task of the spec has a `sensitive-path` class (a) item (the R2 AC 4 rule) THEN the controller SHALL run one security pass step on the `sdd-verifier` role before the HANDOFF write and the push.
2. IF no task of the spec has a `sensitive-path` item THEN the controller SHALL run no security pass and the completion gate SHALL behave as today.
3. The security pass brief SHALL scope the review to the run branch's diff against its merge base with the default branch, and SHALL list the files of that diff that match a `## Sensitive paths` entry first.
4. The security pass report SHALL be structured: a list of findings, each with a title, a file, the command that reproduces it, and the output the command produced; and a list of suspicions, each with a title, a file and one line of why.
5. A finding that lacks a reproduce command or its observed output SHALL be treated by code as a suspicion.
6. WHEN the pass reports one or more findings THEN the controller SHALL run a security fix round on the `sdd-implementer` role whose brief lists the findings, then a narrowed security pass that re-runs only those findings' reproductions; at most 2 such rounds SHALL run.
7. WHEN findings still reproduce after 2 security fix rounds THEN the controller SHALL run the `sdd-adjudicator` on the open findings, then one narrowed re-check.
8. WHEN a finding still reproduces after the adjudicator's re-check THEN the controller SHALL open an `escalation` wait that lists each open finding with its reproduce command, with the options `accept`, `retry` and `abandon`.
9. WHEN the operator answers `accept` THEN the completion gate SHALL continue to the HANDOFF write and the push without running the pass again, and each accepted finding SHALL appear in the HANDOFF Gotchas row, as an unchecked line in the PR body's Test plan, and as a retro-log entry. WHEN the operator answers `retry` THEN the pass and its rounds SHALL run again from round 1.
10. WHEN the pass reports a suspicion THEN the controller SHALL create one deferral per suspicion with owner `matthew`, tag `security`, origin spec and phase `implementation`, and a body that holds the suspicion's file and why; a re-entry SHALL NOT create the same deferral twice.
11. A suspicion SHALL NOT start a fix round, open a wait, or stop the run.
12. WHEN the pass, a fix round, the adjudicator or the re-check runs THEN the ledger SHALL get its spawn rows and one `note` row with the counts of findings and suspicions.
13. A re-entry of the implementation phase after a completed security pass, or after an `accept` answer, SHALL NOT run the pass again; the state SHALL be read from this run's ledger.

### Requirement 4 — a PR that adds a new dependency is flagged (C5)

**User Story:** As the operator, I want to see on the Run page and in the ledger that a PR adds a dependency, so that I can look at it before or after the merge without the run stopping.

#### Acceptance Criteria

1. WHEN the merge pass reads a PR (the run's own or a close-out PR, `src/controller/merge.ts:568-583`) THEN code SHALL list the package names added between the PR's base and head under `dependencies`, `devDependencies`, `peerDependencies` or `optionalDependencies` of any `package.json` in the diff.
2. A name that is only moved between those four sections, a version change of an existing name, and a lockfile-only change SHALL NOT count as new.
3. WHEN the list is not empty THEN the `PrRead` the pass saves (`src/controller/state.ts:109-126`) SHALL carry it, and both hand copies (`src/dashboard/shell/types.ts:161-172`, `src/dashboard_frontend/src/modules/shell/types.ts:184-195`) SHALL carry the same field.
4. WHEN a PR read carries new dependencies THEN its row in the Run page's PR panel (`src/dashboard_frontend/src/modules/shell/RunPage.tsx:345-394`) SHALL show a "new dependency" chip and the package names.
5. WHEN the merge pass first finds a non-empty list for a PR, or finds a list that differs from the last one it logged for that PR THEN the ledger SHALL get one `note` row naming the PR and the packages; an unchanged list on a later poll SHALL write no row.
6. IF the base or the head of the PR cannot be read locally THEN the pass SHALL record no list and write a `note` row once; it SHALL NOT change the verdict, open a wait, or throw.
7. Invariant (verified, not red-first): a new dependency SHALL NOT change the merge verdict, its reasons, or open a wait.

### Requirement 5 — documentation

**User Story:** As the operator, I want the design and ADR text to match what the controller does, so that the next spec plans against the real merge stage.

#### Acceptance Criteria

1. `docs/adr/0003-merge-by-rule.md` SHALL get a dated amendment: a `blocked` run PR with a red check or a conflict gets up to 2 implementer fix rounds before the `error` wait; the merge rule stays code.
2. Section 10 of `docs/controller-design.md` (`docs/controller-design.md:194-208`) SHALL state the fix rounds, the new-dependency flag, and that neither changes the merge verdict.

## Non-Functional Requirements

### Performance
- A spec with no `sensitive-path` item SHALL spawn no extra step for R3; R1 SHALL add at most 2 implementer spawns per run.
- R4 SHALL add no GitHub API call per merge poll; it reads git locally, and any extra PR field rides the existing `gh pr view` call (`src/controller/merge.ts:320-324`).

### Security
- The security pass step runs on the read-only `sdd-verifier` role; it writes reproductions only under the scratch directory, never in the code root.

### Reliability
- Every new count (merge fix rounds, security rounds, logged dependency lists) SHALL be read from the run ledger, so a restart resumes without repeating a step.
- Tests SHALL drive `gh` and `claude` through `scripts/stub-gh.mjs` and `scripts/stub-claude.mjs` and assert only on node 20 fields.

## Decisions taken in this document

- D1 — Where the C1 fix rounds land: options were the merge stage only, replacing the implementation phase's three reconcile rounds with two, or one shared cap across both; chosen the merge stage only because the grill placed C1 there and the existing reconcile loop already handles a red PR at completion, so the new rounds catch what turns red or conflicts after it.
- D2 — Which blocked reasons start a fix round: options were only failed checks and conflicts with nothing else blocking, any blocked reason, or checks and conflicts even when an unfixable reason is also present; chosen only checks and conflicts because a fix round cannot clear a trailer or a wrong head branch.
- D3 — The fix round cap counts per run: options were per run, per blocked episode, or reset by an operator retry; chosen per run because the grill said up to two rounds and a retry means the operator fixed the PR.
- D4 — No verifier inside a merge fix round: options were a verifier per round as the reconcile loop does, or none; chosen none because the re-run CI is the judge and the spawn is saved.
- D5 — A conflict is resolved by merging the default branch into the PR branch: options were a merge commit, or a rebase with a force push; chosen the merge because it never rewrites pushed history.
- D6 — The source of the sensitive-path flag for model routing: options were recomputing gate B class (a) from the current tasks document, reading the gate-b wait's proposals, or the Check's per-commit risk tier; chosen recomputing because it is deterministic, survives an annotation revision, and works when no gate-b wait exists.
- D7 — No sensitive-path list means no flag: options were the Sonnet route for all tasks or the Opus tier for all tasks; chosen Sonnet because gate B flags nothing without a list and the Check still raises such commits to high risk.
- D8 — Implementer steps outside a task keep the Opus tier: options were the role profile, the Sonnet route, or the Opus tier only when the spec has any flag; chosen the profile because repair, reconcile and merge fixes chase integration failures across tasks.
- D9 — The Sonnet route's model and effort live in the agent profile file with first values Sonnet 5 at high: options were the profile file, hard-coded values, or an agent-rules key; chosen the profile file because it is the designated model source and that pair already runs the test author.
- D10 — The security pass is its own verifier step after the end-to-end verification passes: options were a separate step, a section inside the end-to-end brief, or a step that also fires on sensitive files in the diff; chosen a separate step on gate B flags only because it has its own report shape and the entry scopes it to flagged specs.
- D11 — Security findings get 2 fix rounds, then the adjudicator, then an escalation wait with accept, retry and abandon: options for the cap were 2 or 3 rounds; chosen 2 to match the completion gate's repair cap.
- D12 — One deferral per unreproduced suspicion: options were one per suspicion or one per pass; chosen one per suspicion because the deferral loop triages and resolves records one at a time.
- D13 — A new dependency is a name added to one of the four dependency sections of a package manifest: options were manifests only, manifests plus lockfiles, or other ecosystems too; chosen manifests only because all three registered repositories are Node projects and a lockfile change is transitive.
- D14 — The dependency flag covers every PR the merge pass reads: options were the run's own PR only, or every PR read; chosen every PR because the read is shared code and the flag opens no wait.
- D15 — A dependency ledger row is written once per new list, not per poll: options were once per list or every poll; chosen once because the merge stage polls every 30 seconds.

## Scope notes

- Carried from the decomposition: none.
- Cut: none of the four items of the decomposition entry.
- Deferred to design: the brief template text for the merge fix and security variants, the ledger row shapes, and the field names in the run record and the profile file.
- Out of scope by the entry: fix rounds on close-out PRs (R1 AC 12), keyword routing (R2 AC 3).
- Not in this spec: grill items C2 (parked), C6 and C9 (rejected), C7 and C8 (landed as separate PRs).
- The steering `product.md` does not exist; the alignment section cites the grill instead.

## Revision History

- **v1** (2026-10-21) — Initial draft.
  - **Lint pass.** 5 fixed; rejected: L-6/L-7/L-8/L-9 (package.json section keys named by the AC, not merge.ts symbols; the citation anchors "the merge pass reads a PR").
