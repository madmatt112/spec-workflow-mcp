# Adversarial Review Memory — requirements

Last updated: 2026-09-27 (Round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser/adjudicator disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — R6 AC3: the proof line cannot render for a passing marked task.
  `TaskReviewFindings` (`TasksPage.tsx:472-507`) is mounted only under
  `verdict !== 'pass'` (`:1384`) and behind an expand toggle (`:1399-1401`); the honest
  happy path is verdict `pass` / no findings, so the cited anchor is insufficient. Real
  change site: `TasksPage.tsx:1364-1406`.
- **R1-2 (SHOULD_FIX)** — R4 AC9: classification needs full output; cited runner
  (`check-runner.ts:35-44` `lastLine`, `92-104` `runChecks`) exposes only the last line
  (the vitest duration line, per the doc's own Probe). Reusing `runChecks` misclassifies
  every assertion-red as structural-red → risk high → cost outcome lost. State that the
  proof captures full stdout/stderr for classification, separate from the one-line
  response (AC14).
- **R1-3 (SHOULD_FIX)** — R3 AC4: no wire for `## Red tests` into the server-generated
  implementer brief. `harness brief template: implementer` (`harness.ts:525-534`,
  `SKILL.md:105-110`) has no slot; the author's verbatim report is runtime data. Neither
  R2 nor R3 nor R8 names the injection mechanism (placeholder vs new template vs
  orchestrator append). Fix briefs use the `reviser` `{{job}}` slot, so they are less
  exposed.
- **R1-4 (SHOULD_FIX)** — R4 AC14 "run no command other than the two agent-rules keys"
  collides with the mandated git plumbing (AC4/AC5 `git diff`, AC6 `git worktree`
  prune/add/remove, AC8 copy). Scope "command" to configurable test/setup commands; git
  plumbing excepted. Currently unverifiable as worded.
- **R1-5 (MINOR)** — R4 AC13 `data.tdd.seams` (and the Jev payload, R7 AC3) is in the
  output but not in the input (AC1: `{ testFiles, redCommit }`; R3 AC6 passes only those).
  Derivable from the parsed task's `tests[]`, but the derivation is unstated.
- **R1-6 (MINOR)** — R1: a malformed `Test:` line (no em dash / empty call) has no defined
  parser destination (tests[] with empty seam vs `implementationDetails` fallthrough at
  `task-parser.ts:289-296`).
- **Design-must-resolve (not numbered)** — R5 AC7 + D10: cross-call persistence of "the
  latest proof" between the gate and the verifier's `review-task record`
  (`review-task.ts:858`); no store/key named. Also: `test-author` has no standing brief;
  path/git context must reach it via the `job` value (R2 AC4/AC10).

## Patterns & Themes

- **Server/orchestrator boundary is the weak seam.** Two of four SHOULD_FIX (R1-3, and the
  D10 note) and one design gap sit where runtime agent data must cross into
  server-authored artifacts (briefs, recorded reviews). harness-bookkeeping centralized
  authoring in the server; every new field the orchestrator must inject needs an explicit
  channel or it regresses to hand-editing.
- **Response/UI shapes carry fields the inputs never supply** (R1-1 render gate, R1-5
  `seams`): the wire lens keeps surfacing output-only fields with no stated source.
- **Reuse-the-existing-helper assumptions hide correctness traps** (R1-2): the one-line
  runner and the pass-hidden findings component both work for today's flow but break the
  new happy path.
- Citations are clean: all anchors verified accurate at both ends. Attack meaning, not
  paths, in later rounds.

## Guidance for Next Review

- Re-check R1-1 through R1-4 against v2's disposition; classify each Recurring/
  Compounding/Novel.
- The `## Changes since` diff was empty this round; next round attack the v1→v2 delta
  first.
- Confirm the reviser did not "fix" R1-1 by editing only `TaskReviewFindings` without
  touching the `verdict !== 'pass'` mount gate.
- If AC14 is reworded, verify the new wording still forbids arbitrary project-configured
  commands (the NFR Security intent) while permitting git plumbing.
- Fresh lens used this round: wire contracts. A future round could apply: failure/rollback
  paths of the base worktree (partial `finally` cleanup, `git worktree prune` racing a
  concurrent run), or the cost of touching `review-task.ts` (a sensitive path — its tasks
  force a verifier).
