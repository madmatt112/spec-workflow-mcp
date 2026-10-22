# Tasks Document — verification-loop

Document version: v1

Dependency order: tasks 1 → 2 → 3 → 4 build the merge-evaluation facts and the dependency flag; task 5 adds the brief variants; 6 → 7 build and wire the merge fix round (6 needs 1 and 5); 8 → 9 build and wire the implementer route; 10 → 11 → 12 → 13 build the completion-gate security pass and its wait (12 needs 5, 9 and 10); task 14 is documentation. Each task leaves the tree compiling and every existing suite green. Expected verifier spend: tasks 2, 6, 8 and 10 create new modules, so they route high risk to the verifier; no task touches a `## Sensitive paths` entry.

- [ ] 1. Blocking kinds, base and head in the merge evaluation
  - File: src/controller/merge.ts
  - File: src/controller/__tests__/merge.test.ts
  - Test: src/controller/__tests__/merge.test.ts — evaluatePullRequest(pr)
  - Add the design C1 types and fields; tag each blocking reason where `evaluatePullRequest` (`src/controller/merge.ts:319`) pushes it (`src/controller/merge.ts:357-405`); copy `blocking` and `base` onto the `blocked` return (`src/controller/merge.ts:588-591`) of `mergeByRule` (`src/controller/merge.ts:568`).
  - Purpose: give the run loop a structured reason kind (R1 AC 1) with the merge rule still model-free (R1 AC 11).
  - _Leverage: src/controller/merge.ts (`PR_VIEW_FIELDS` :38-39, `MergeEvaluation` :79-95, `MergeStageResult` :100-111, `PullRequestEvaluation` :300-308)_
  - _Requirements: 1.1, 1.11_
  - _Prompt: Task: Implement design C1 per R1 AC 1 and AC 11. Export `BlockingKind` and `BlockingReason`; add `MergeEvaluation.blocking`, `PullRequestEvaluation.head` and `.base`, `MergeStageResult.blocking` and `.base`; add `baseRefName` to `PR_VIEW_FIELDS`. Set the kind from the branch that pushes each reason: failed workflow run gives `check` with `name` and `runId`, failed commit status gives `check` with no `runId`, `CONFLICTING` gives `conflict`, any other non-MERGEABLE, non-UNKNOWN value gives `other`, head mismatch gives `head`, attribution trailer gives `trailer`. Tests in src/controller/__tests__/merge.test.ts: one case per kind, a pending reason gets no entry, `head` and `base` read from the view | Restrictions: never derive a kind from reason text; `blocking` is set only when not ready, not pending and not unreadable; no new `gh` call; the exact `{ ready: true, reasons: [] }` assertions at src/controller/__tests__/merge.test.ts:172 and :255 and the argv counts at src/controller/__tests__/merge.test.ts:471, :486 and :497 keep their values (an illustrative minimum — widen to every exact assertion the change touches) | Success: each of the six kinds is asserted from its signal; a pending-only result has no `blocking`; a ready result still equals `{ ready: true, reasons: [] }`; `head` and `base` on the evaluation equal the view's `headRefOid` and `baseRefName`; the blocked `MergeStageResult` carries `blocking` and `base`; `npx tsc --noEmit` and src/controller/__tests__/merge.test.ts pass_

- [ ] 2. New-dependency reader module
  - File: src/controller/new-deps.ts
  - File: src/controller/__tests__/new-deps.test.ts
  - Test: src/controller/__tests__/new-deps.test.ts — diffNewDependencies(before, after); readNewDependencies(repoDir, baseBranch, head)
  - New module per design C2 Interfaces; pure diff plus a local-git reader that never throws.
  - Purpose: list the package names a PR head adds (R4 AC 1-2) without a GitHub call (NFR Performance).
  - _Leverage: src/core/git-utils.ts (`scrubbedGitEnv`), src/controller/merge.ts:459-465 (local `git show` pattern)_
  - _Requirements: 4.1, 4.2, 4.6_
  - _Prompt: Task: Create src/controller/new-deps.ts with `DEPENDENCY_SECTIONS`, `diffNewDependencies` and `readNewDependencies` as design C2 pins, per R4 AC 1, AC 2 and AC 6. The reader resolves `origin/<base>` else `<base>`, takes the merge base, lists changed `package.json` paths with `--no-renames`, and diffs both sides; a missing base side is empty. Tests: an added name; a name moved between sections; a re-versioned name; a removed name; a new manifest; on a temp git repo one added dependency, a lockfile-only commit (empty list) and a missing sha (`ok: false`) | Restrictions: git through `execFileSync` with `scrubbedGitEnv()`; assert only on returned values (node 20 safe); no `gh` call; never throw | Success: moved, re-versioned, removed and lockfile-only changes give no name; an added name and a new manifest's names are listed sorted and unique; an unreadable sha gives `ok: false` with one line of why; new-deps.test.ts passes_

- [ ] 3. Dependency flag in the merge pass
  - File: src/controller/merge.ts
  - File: src/controller/state.ts
  - File: src/controller/__tests__/merge.test.ts
  - Test: src/controller/__tests__/merge.test.ts — runMergeStage(run, deps)
  - Wire the reader of task 2 into `mergeByRule` (`src/controller/merge.ts:568-642`) per design C2 "Wiring" and "Ledger"; add `PrRead.newDependencies` (`src/controller/state.ts:109-126`).
  - Purpose: carry the new-dependency list on every PR read and log it once per change (R4 AC 1, 3, 5-7).
  - _Leverage: src/controller/merge.ts `makeRead` (:581-583), src/controller/ledger.ts `note`_
  - _Requirements: 4.1, 4.3, 4.5, 4.6, 4.7_
  - _Prompt: Task: Per R4 AC 1, 3, 5, 6 and 7 and design C2, call the reader task 2 exports from `mergeByRule` when the evaluation is readable and has `head` and `base`; put a non-empty list on the `PrRead` as `newDependencies`; widen `MergeStageDeps.ledger` to `prMerged`, `note` and `path`; write the `new dependencies:` note only when its text differs from the newest one for that PR (Data Models). Tests in src/controller/__tests__/merge.test.ts with a view that carries `baseRefName` and a temp repo: list on the read, one note over two passes, `none` after a logged list, `unreadable` note once; regression guard (already true at base, R4 AC 7): the verdict and reasons are unchanged | Restrictions: no new `gh` call, so the argv counts at src/controller/__tests__/merge.test.ts:471, :486 and :497 keep their values; a view without `baseRefName` (the existing `READY_VIEW` at src/controller/__tests__/merge.test.ts:59) skips the read and writes no note (design D14); never throw | Success: a PR adding a dependency carries `newDependencies` on its read; two passes write one note; a changed list writes one more; an empty list after a logged one writes one `none` note; an unreadable read writes one note and keeps the verdict and reasons; a view without `baseRefName` writes no note; existing src/controller/__tests__/merge.test.ts assertions pass unchanged_

- [ ] 4. Run page new-dependency chip
  - File: src/dashboard/shell/types.ts
  - File: src/dashboard_frontend/src/modules/shell/types.ts
  - File: src/dashboard_frontend/src/modules/shell/RunPage.tsx
  - File: e2e/worktree-shell.spec.ts
  - Add `newDependencies` to both `ControllerPrRead` hand copies (`src/dashboard/shell/types.ts:161-172`, `src/dashboard_frontend/src/modules/shell/types.ts:184-195`); render the chip in `PrPanel` (`src/dashboard_frontend/src/modules/shell/RunPage.tsx:345-394`) per design C8.
  - Purpose: show the operator that a PR adds a dependency (R4 AC 3-4). kind: e2e — the Playwright suite is the only test of this panel, so the task runs implementer-only.
  - _Leverage: src/dashboard_frontend/src/modules/shell/RunPage.tsx `CI_CHIP_STYLES` (:332-337), e2e/worktree-shell.spec.ts seeded record (:163-173) and panel assertions (:317-330)_
  - _Requirements: 4.3, 4.4_
  - _Prompt: Task: Per R4 AC 3 and AC 4 and design C8, add the optional field to both hand copies, matching the field task 3 added to `PrRead`; when non-empty, render a `new dependency` chip with the `pending` chip classes and `data-testid` `pr-deps-<repo>-<number>`, then the names joined by ", ". Extend the seeded run record in e2e/worktree-shell.spec.ts with `newDependencies` on one read and assert the chip text and names; assert the other read has no chip | Restrictions: run `npx playwright install chromium`, then `npx playwright test e2e/worktree-shell.spec.ts`; no new colour token; existing panel assertions (:317-330) keep their values | Success: the seeded read shows the chip and the names; a read without the field shows none; both hand copies match `PrRead`; `npx tsc --noEmit`, the frontend build and the suite pass_

- [ ] 5. Merge-fix and security brief variants
  - File: src/tools/brief-templates.ts
  - File: src/tools/__tests__/harness.test.ts
  - Test: src/tools/__tests__/harness.test.ts — `harnessHandler({ action: 'brief', template, specName, values })`
  - Route `fix` variants `merge` and `security` and `verifier` variants `security` and `security-narrow` to four new renderers, per design C4.
  - Purpose: briefs for the merge fix round (R1 AC 2-3) and the security pass and fix rounds (R3 AC 3-7).
  - _Leverage: src/tools/brief-templates.ts `renderCiFix` (:682-705), `renderFix` (:713-750), `renderVerifier` (:833-848), template entries (:1553-1562)_
  - _Requirements: 1.2, 1.3, 3.3, 3.4, 3.6_
  - _Prompt: Task: Per R1 AC 2-3 and R3 AC 3, 4 and 6, add `renderMergeFix`, `renderSecurityFix` and `renderVerifierSecurity` with the lines design C4 pins, dispatched from `renderFix` and `renderVerifier`. Tests in harness.test.ts: the merge variant names the check, its log path, the conflict text with `git merge origin/<base>`, "never rebase" and the `INFRA:` paragraph; the security fix lists the findings and says do not push; the security verifier scopes to `git diff <base>...HEAD`, lists sensitive files first, names the `security/` scratch directory and the finding and suspicion rules; the narrow variant re-runs only the listed findings | Restrictions: the required keys of `fix` and `verifier` stay unchanged; existing variant output and its exact assertions in harness.test.ts are unchanged | Success: each of the four variants renders the lines listed in Task; every existing harness.test.ts brief test passes unchanged_

- [ ] 6. Merge fix round module
  - File: src/controller/merge-fix.ts
  - File: src/controller/phases/implementation.ts
  - File: src/controller/__tests__/merge-fix.test.ts
  - Test: src/controller/__tests__/merge-fix.test.ts — mergeFixHistory(rows, runId); mergeFixEligible(result, used); runMergeFixRound(ctx, input)
  - New module per design C3 Interfaces and its seven post-conditions.
  - Purpose: one capped implementer fix round on the PR branch that never rewrites history (R1 AC 2-6, 10).
  - _Leverage: src/controller/step.ts `runStep`, `loadRole` (:229-242); src/controller/phases/implementation.ts log tails (:1117-1126), INFRA re-run (:1143-1148), `IMPLEMENTER_SCHEMA` (:147-161); scripts/stub-claude.mjs; scripts/stub-gh.mjs_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.10, 2.10_
  - _Prompt: Task: Create src/controller/merge-fix.ts per design C3 and R1 AC 1-6 and AC 10, using the blocking types task 1 exports and the `merge` brief variant task 5 adds. The round runs on `sdd-implementer` at the profile model (R2 AC 10). Tests: eligibility for each kind mix at used 0, 1 and 2; history over two runs' rows and a `step usage-limit` ending; a round against a bare remote that pushes; one with no commit; one with a rewritten HEAD (not pushed); one reporting `INFRA:` (the stub-gh `run rerun` argv); the start note text; the brief names the log path and the conflict merge | Restrictions: never `--force`, never rebase; the ancestry check runs before any push; the only implementation.ts change is to export `IMPLEMENTER_SCHEMA` with its value unchanged; stubs only, node 20 fields | Success: eligibility is true only for check or conflict kinds under the cap; history skips the other run's rows and the usage-limit ending; the pushed, no-commit, rewritten and `INFRA:` rounds give the ending and kind design C3 step 7 names, and a rewritten HEAD is never pushed; the `INFRA:` round records one `gh run rerun` per run id; the start and end notes match Data Models; the brief names the log path and, for a conflict, the merge of the default branch; merge-fix.test.ts and implementation.test.ts pass_

- [ ] 7. Merge fix round in the run loop
  - File: src/controller/runs.ts
  - File: src/controller/__tests__/runs.test.ts
  - Test: src/controller/__tests__/runs.test.ts — runOnce(deps, runId)
  - In `runMergeStageStep` (`src/controller/runs.ts:611`), case `blocked` (`src/controller/runs.ts:669-682`), run the round task 6 builds when eligible, else the `error` wait with the round endings, per design C3 "Wiring".
  - Purpose: the run fixes its own red or conflicted PR before it asks the operator (R1 AC 1, 4-9).
  - _Leverage: src/controller/runs.ts `stepLifecycle`, `stepActivityForwarder` (:425-449), `nextMergeCheck`, `waitAnd` (:534-544)_
  - _Requirements: 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.12_
  - _Prompt: Task: Per R1 AC 1 and AC 4-9 and design C3 "Wiring", read this run's ledger rows, apply the history and eligibility helpers task 6 exports, and when eligible check cancel, the token cap and `deps.windowBlock()` first, then run the round; `usage-limit` pauses the run, any other kind saves `merging` with `resumeAt: nextMergeCheck(deps)`. When not eligible, open the `error` wait and add the round endings when any ran. Tests: a blocked red check runs one round and leaves `merging` with `resumeAt`; after two rounds the wait text names both endings; a trailer opens the wait with no spawn; a "retry" after the cap opens the wait with no spawn; regression guard (already true at base, R1 AC 12): a blocked close-out PR opens the wait with no spawn | Restrictions: `runCloseoutMergeStep` (:931-966) unchanged; the merge rule runs no model step (R1 AC 11); no existing runs.test.ts assertion changes value | Success: a blocked red check spawns one implementer and leaves the run `merging` with a `resumeAt`; after two rounds the `error` wait text names both endings; a trailer, a retry after the cap and a blocked close-out PR each open the `error` wait with no implementer spawn; the round count read from the ledger survives a re-entry; runs.test.ts passes_

- [ ] 8. Implementer route module
  - File: src/controller/implementer-route.ts
  - File: src/controller/__tests__/implementer-route.test.ts
  - Test: src/controller/__tests__/implementer-route.test.ts — routeForTask(items, taskId)
  - New module per design C5 Interfaces.
  - Purpose: pick the implementer model and effort from the class (a) items with no model judgement (R2 AC 1-5, 7).
  - _Leverage: src/controller/step.ts `loadRole` (:229-242); harness/agent-profiles.json `sdd-implementer` (:20-25) and `sdd-test-author` (:50-55)_
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.7_
  - _Prompt: Task: Create src/controller/implementer-route.ts with `ImplementerRoute` and `routeForTask` as design C5 pins, per R2 AC 1, 2, 3, 5 and 7. Tests: a `sensitive-path` item for the task gives the `sdd-implementer` profile and the item's reason; keyword-only items give the `sdd-test-author` profile and `no sensitive-path flag`; no items give the same; `null` gives the `sdd-implementer` profile and `class-a unavailable` (design D7); an item for another task is ignored | Restrictions: read both profiles through `loadRole`, never literal model strings; add no key to harness/agent-profiles.json, so src/__tests__/agent-profiles.test.ts stays green with no edit | Success: the four cases return the model, effort and reason listed; implementer-route.test.ts and agent-profiles.test.ts pass_

- [ ] 9. Implementer route in the implementation phase
  - File: src/controller/phases/implementation.ts
  - File: src/controller/phases/__tests__/implementation.test.ts
  - Test: src/controller/phases/__tests__/implementation.test.ts — runImplementationPhase(ctx)
  - Add the `classAItems` closure, an optional model override on `runModelStep` (`src/controller/phases/implementation.ts:383-418`), and the route note, per design C5 "Wiring".
  - Purpose: unflagged task steps run on the Sonnet route; flagged and non-task steps keep the profile (R2 AC 1-2, 4, 6, 8-11).
  - _Leverage: src/controller/phases/gates.ts class-a call (:291-294); `stepUsage` (:371-381)_
  - _Requirements: 2.1, 2.2, 2.4, 2.6, 2.8, 2.9, 2.10, 2.11_
  - _Prompt: Task: Per R2 AC 1, 2, 4, 6 and 8-11 and design C5, compute the route with the function task 8 exports at every task step start (implement attempts :629-634, checks re-spawn :658-661, task fix rounds :774-778) and pass it to `runModelStep`, which then fills `StepSpec.model` and `.effort` and the `spawn.start` model and effort and `spawn.end` model. Write the route note at the task's first step and again when the route changes. Tests: the stub init event `argv` has `--model claude-sonnet-5` for a task on `src/a.js` and `--model claude-opus-4-8` for a task on `package.json` (the fixture lists it, src/controller/phases/__tests__/implementation.test.ts:104); spawn rows match; one route note per task; regression guard (already true at base, R2 AC 11): the test author, verifier and repair steps keep their profiles | Restrictions: repair (:994-997) and reconcile (:1137-1140) pass no override; no `--resume`; existing implementation.test.ts assertions keep their values | Success: the unflagged task's implementer `argv` carries `--model claude-sonnet-5` and the flagged task's carries `--model claude-opus-4-8`; each `spawn.start` model and effort and `spawn.end` model equal the `argv` values; each task gets one route note; the test author, verifier and repair steps run on their profile models; src/controller/phases/__tests__/implementation.test.ts passes_

- [ ] 10. Security pass state module
  - File: src/controller/phases/security-pass.ts
  - File: src/controller/phases/__tests__/security-pass.test.ts
  - Test: src/controller/phases/__tests__/security-pass.test.ts — classifySecurityReport(report); e2ePassStands(rows); readSecurityState(rows); suspicionKey(s)
  - New pure module per design C6 Interfaces.
  - Purpose: classify a security report and read the security loop's resume state from ledger notes (R3 AC 4-5, 9, 13).
  - _Leverage: design Data Models (the `security:` notes)_
  - _Requirements: 3.4, 3.5, 3.6, 3.7, 3.9, 3.13_
  - _Prompt: Task: Create src/controller/phases/security-pass.ts with the types, `SECURITY_SCHEMA` and four functions design C6 pins, per R3 AC 4, 5, 6, 7, 9 and 13. Tests: a finding with no command or no output becomes a suspicion with why `reported without a reproduction`; output cut to 400 characters; `e2ePassStands` true after the pass note, false once a newer `completion handoff written` note exists; `readSecurityState` reaches every `next` value from the note sequences Data Models lists; two epochs count rounds only after the newest epoch; an answered wait id is listed; `suspicionKey` is stable for the same file and title | Restrictions: pure, no I/O; read only the note texts design Data Models lists | Success: an unreproduced finding is returned as a suspicion with that why; output is at most 400 characters; `e2ePassStands` is true after the pass note and false after a newer handoff note; `readSecurityState` returns each `next` value design C6 lists for its note sequence; rounds count only after the newest epoch; an answered wait id appears in `answered`; `suspicionKey` is equal for equal file and title; security-pass.test.ts passes_

- [ ] 11. Record the end-to-end pass and skip it on re-entry
  - File: src/controller/phases/implementation.ts
  - File: src/controller/phases/__tests__/implementation.test.ts
  - Test: src/controller/phases/__tests__/implementation.test.ts — runImplementationPhase(ctx)
  - In `completionGate` (`src/controller/phases/implementation.ts:879-956`) write the `e2e verification passed` note on a pass, skip the e2e loop (:884-911) when it stands, and write `completion handoff written` after the HANDOFF write (:922-932).
  - Purpose: a completion-gate re-entry never re-runs a passed e2e verification (R3 AC 13).
  - _Leverage: `ledgerRows` (:326-335)_
  - _Requirements: 3.13_
  - _Prompt: Task: Per R3 AC 13 and design C6 flow steps 1 and 5, use the pass-stands reader task 10 exports on this run's rows; when it is true skip the e2e loop, else run it as today and write the pass note. Write the handoff note right after the HANDOFF write. Tests: a re-entry after the pass note and before the handoff note spawns no e2e verifier (the stub script holds no e2e run); a run whose newest marker is the handoff note runs e2e again | Restrictions: the repair rounds and the deferred-verification deferral (:891-904) are unchanged; existing implementation.test.ts assertions keep their values (the new notes match none of their regexes, for example :263) | Success: a pass writes one `e2e verification passed` note and the HANDOFF write is followed by one `completion handoff written` note; a re-entry between the two spawns no e2e verifier; a re-entry after the handoff note runs e2e again; every existing implementation.test.ts case passes_

- [ ] 12. Security pass loop in the completion gate
  - File: src/controller/phases/implementation.ts
  - File: src/controller/phases/__tests__/implementation.test.ts
  - Test: src/controller/phases/__tests__/implementation.test.ts — runImplementationPhase(ctx)
  - Add design C6 flow steps 2-4 between the e2e pass and the HANDOFF write; add `'security-open'`, `findings` and `securityAnswers` to the phase interfaces (:72-124).
  - Purpose: a sensitive spec gets a reproduce-only security pass with capped fixes, the adjudicator and an escalation (R3 AC 1-12).
  - _Leverage: `DeferralStorage.create` (src/core/deferral-storage.ts:229-232); `retro` (:350-360); `buildPrBody` (:1042-1057)_
  - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_
  - _Prompt: Task: Per R3 AC 1-12 and design C6 flow steps 2-4, drive the loop from the state reader task 10 exports, with the brief variants task 5 adds and the class-a closure task 9 adds. Bridge: until task 13, a `security-open` outcome reaches the generic `error` wait (src/controller/runs.ts:1050-1055); task 13 replaces it. Tests: an unflagged spec spawns no security step and writes no `security:` row; a flagged spec runs pass, fix, recheck, adjudicator and recheck, then returns `security-open`; one deferral per suspicion (owner `matthew`, tag `security`) across a re-entry; `accept` puts each finding in the Gotchas row, an unchecked PR body line and the retro log; `retry` writes epoch 2 and spawns no e2e | Restrictions: security fix rounds use the profile model (R2 AC 10) and never push; reproductions only under the scratch `security/` directory | Success: an unflagged spec spawns no security step and writes no `security:` row; a flagged spec spawns pass, fix, recheck, adjudicator and recheck in that order and returns `security-open` with the open findings; each suspicion makes one deferral (owner `matthew`, tag `security`) and a re-entry makes none more; `accept` puts each finding in the Gotchas row, an unchecked PR body Test plan line and one retro entry; `retry` writes `security: epoch 2` and spawns no e2e verifier; implementation.test.ts passes_

- [ ] 13. Security escalation wait
  - File: src/controller/runs.ts
  - File: src/controller/__tests__/runs.test.ts
  - Test: src/controller/__tests__/runs.test.ts — runOnce(deps, runId)
  - Map `security-open` in `handleImplementationOutcome` (`src/controller/runs.ts:1015-1056`) to one `escalation` wait; pass the security answers to the phase (`src/controller/runs.ts:859-867`); skip them in `escalationRulings` (`src/controller/runs.ts:997-1008`); per design C7.
  - Purpose: the operator rules on findings that survived the loop (R3 AC 8-9).
  - _Leverage: `waitAnd` (:534-544); src/controller/controller.ts abandon path (:353-358)_
  - _Requirements: 3.8, 3.9_
  - _Prompt: Task: Per R3 AC 8 and AC 9 and design C7, open one `escalation` wait with question id `security`, options `accept`, `retry`, `abandon` and no `recommended`, listing each finding as title, file and command; park without a second wait while one is open; pass the answered security waits, oldest first, as the context field task 12 adds; keep them out of the rulings. Remove the bridge task 12 names. Tests: `security-open` opens one wait with three options; a second pass opens no second wait; an answered `accept` reaches the phase and not a ruling | Restrictions: `abandon` takes the existing cancel path, no new status; no existing runs.test.ts assertion changes value | Success: `security-open` opens one `escalation` wait with question id `security`, options `accept`, `retry`, `abandon` and no recommendation; a second pass with that wait open opens no second wait; an answered `accept` reaches the phase as a security answer and is absent from the rulings; runs.test.ts passes_

- [ ] 14. ADR amendment and controller design text
  - File: docs/adr/0003-merge-by-rule.md
  - File: docs/controller-design.md
  - Add the dated amendment to ADR 0003 and one paragraph to section 10 of the controller design (`docs/controller-design.md:194-208`), per design C9.
  - Purpose: the next spec plans against the real merge stage (R5).
  - _Leverage: the existing ADR 0003 amendment bullets_
  - _Requirements: 5.1, 5.2_
  - _Prompt: Task: Per R5 AC 1 and AC 2 and design C9, add an ADR 0003 amendment dated the day the task lands: a `blocked` run PR whose every blocking reason is a red check or a conflict gets up to 2 implementer fix rounds before the `error` wait; the merge rule stays code. Add one section 10 paragraph: the fix rounds, the new-dependency flag, and that neither changes the merge verdict | Restrictions: ASD-STE100 style; no other section changes; ADR status stays accepted | Success: both texts state the three facts R5 lists and match tasks 3 and 7_

## Decisions taken in this document

- D1 — Pure module before wiring, one task each: options were one task per design component, or a split of each new module from its wiring; chosen because each new module gets a red-first unit test and each wiring task stays under the word cap.
- D2 — The Run page task routes implementer-only through the e2e kind marker: options were a new frontend unit test for the PR panel, or the Playwright suite the design names; chosen because no unit harness covers that page and the TDD command is vitest, which cannot run the Playwright suite.
- D3 — The end-to-end pass record is its own task before the security loop: options were one completion-gate task, or two; chosen because one task overruns the cap and the resume record must land before the loop that depends on it.
- D4 — Until the escalation task lands, a security-open outcome falls to the generic error wait: options were a stub mapping in the loop task, or the existing fall-through; chosen because the fall-through needs no throwaway code and keeps the tree green.
- D5 — Invariant criteria are regression guards inside the task that touches their code: options were separate verification tasks, or guards; chosen because they hold at base and cannot fail red-first.

## Scope notes

- Carried from design: none.
- Cut from the decomposition entry: none of its four items.
- The invariant criteria R1 AC 12, R1 AC 13, R2 AC 11 and R4 AC 7 are regression guards in tasks 7, 9 and 3; R1 AC 13 needs no task because no task changes the PR checks gate.
- No live check on a real red PR; the stubs cover every branch, as design states.

## Revision History

- **v1** (2026-10-21) — Initial draft.
  - **Lint pass.** 11 fixed; rejected: L-2/L-3 `blocking`/`base` are new fields task 1 adds (not in source); L-6/L-10 `newDependencies` is a new field; L-15 `classAItems` is a new closure; L-9 info only — task 4 is `kind: e2e` (D2), its only test is the Playwright suite in File:, which vitest cannot run.
