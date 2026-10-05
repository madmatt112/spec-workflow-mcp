# Retrospective plan — lean-orchestrators

Status: APPROVED
Date: 2026-10-05
Decided by: Matthew, in the retro conversation of run `run-20261005-154530`.
Sources: `retrospective.md` (14 findings), `retrospective-proposals.md` (14 proposals,
3 graduation candidates).

## Decisions

- **P5** — option (A): keep the worktree guard; make "commit on feat, orchestrator relocates
  at merge" an explicit documented step in the verification-task brief, and have the task
  verifier review verification-only tasks so reviewCoverage counts them.
- **P7** — option (A): when the final remainder is exactly one task, add it to the previous
  batch (budget+1 once); the cap logic is unchanged.
- **P8** — option (A): lean-orchestrators is accepted as a win conditional on P7 landing and a
  re-measure of W per task on the next real spec; the per-round drop (50-67%) and leaner
  orchestrators are the goal, and the per-task gap (+20%) is prefix-driven.
- **Approval** — all 14 proposals and all three graduation candidates approved. Nothing
  rejected. P11, P12 and P13 are no-change items: the close-out records them done with no
  diff.

## Approved proposals

- **P1 (F1) — Pin ported-brief snapshots to the exact source text.** When a task moves a
  verbatim brief section into a template, the tasks-phase decomposition names the source
  file and line range and requires the snapshot to be pinned from that exact text, with the
  batched verifier diffing against it (as it did: the dropped `Compounds: R<k>-<n>` seam was
  caught).
  Target: harness skills (tasks decomposition + verifier convention).
  Effort: S. Risk: low: formalises a step the verifier already performs.
  Prerequisites: none.
  Decision: approved as written.

- **P2 (F2) — No change; `git reset --hard` block worked as intended.** The
  irreversible-destruction guard held and revert/relocate recovered the mis-commit. The only
  cost was surprise; a one-line note in the implementer brief ("undo a mis-commit with
  revert or relocate, not `git reset --hard`") removes that.
  Target: harness skills (implementer brief note).
  Effort: S. Risk: low: documentation only.
  Prerequisites: none.
  Decision: approved; add the one-line brief note.

- **P3 (F3) — Record `spawn.start` for reviewer spawns.** The hook regex only matches a
  `-brief*.md` prompt path (`sdd-activity.sh:213`), so reviewer spawns from a `reviews/`
  prompt are W-unknown in every `harness usage` report. Extend the match to also accept the
  reviewer prompt path and emit a `spawn.start` with role `reviewer`, so reviewer W is
  observable.
  Target: harness/hooks/sdd-activity.sh (sensitive path — high risk per agent-rules; add a
  hook test).
  Effort: M. Risk: medium: a hook regex change is machine-read by the review gate and must
  keep `plugins/` copies synced.
  Prerequisites: none.
  Decision: approved as written.

- **P4 (F4) — When a brief slot moves to a server kind, wire the orchestrator-filled fields
  as template keys in the same task.** Task 8 and task 13 shipped literal `<D>`, `<sha>`,
  `<check names>`, CODE_ROOT etc. because the lean orchestrator no longer fills them. Make it
  a decomposition rule: any task that relocates an orchestrator-filled slot into a template
  enumerates every `<...>`/path placeholder in that slot and converts each to a template key,
  and the task verifier greps the rendered output for residual `<...>`.
  Target: harness skills (tasks decomposition convention) + the grep in the task verifier.
  Effort: M. Risk: low: both verifiers already caught this; the rule front-loads it.
  Prerequisites: none.
  Decision: approved as written.

- **P5 (F5) — Give verification-only tasks a sanctioned path to the main spec store.**
  Baseline/fixture files on tasks 5 and 15 landed on `feat` (the worktree guard blocks the
  main checkout) and the orchestrator relocated them by hand every time; this recurs on any
  verification-only task and shows up as reviewCoverage 13/16. See graduation candidate G1.
  Target: harness skills + agent-rules.md.
  Effort: M. Risk: medium: touches the worktree write guard contract.
  Prerequisites: none.
  Decision: approved with option (A) — keep the guard; make "commit on feat, orchestrator
  relocates on merge" an explicit documented step in the verification-task brief, and have
  the task verifier review these tasks so coverage counts them.

- **P6 (F6) — Detect headless capability at run.start, not at the retro.** The `claude -p`
  supervisor recorded `headless=no`, found AskUserQuestion unavailable only when writing the
  retro plan, and the fixture (no git remote) can never exercise the one-PR criterion. Probe
  for AskUserQuestion and a git remote at run.start and record the result, so a headless kit
  run declares up front which gates it cannot satisfy and leaves them `pending` by design.
  Target: harness skills (supervisor run.start) + fixture README note on the missing remote.
  Effort: M. Risk: medium: run.start probe must not itself block a normal session.
  Prerequisites: none.
  Decision: approved as written.

- **P7 (F7) — Fold a trailing single task into the previous batch.** When tasks mod budget
  == 1, the last orchestrator spawn runs one task plus the e2e gate for ~375k W, of which
  ~250k is fixed base+skill prefix. Change the launch-budget rule so a final remainder of 1
  task is absorbed into the prior spawn (last batch = budget+1) rather than paying a whole
  second prefix.
  Target: harness skills (implementation launch-budget rule).
  Effort: S. Risk: low: a larger final batch is cheaper than a second prefix; cap logic
  unchanged.
  Prerequisites: none.
  Decision: approved with option (A) — if the final remainder is exactly 1 task, add it to
  the previous batch (budget+1 once).

- **P8 (F8) — Record the +20% W/task result for Matthew; decide whether the decomposition's
  per-task axis must be a win.** The spec cut W per review round 50-67% but ran W/task
  189,451 vs baseline 157,800 (+20%). The operator correctly surfaced this as a D9 finding
  rather than a silent pass. The cause (more, smaller spawns each paying a prefix) is P7;
  whether that trade is acceptable is a product call.
  Target: project steering (harness efficiency decisions / memory).
  Effort: S (decision only). Risk: low.
  Prerequisites: P7 (the prefix fix may close most of the gap).
  Decision: approved with option (A) — accept, conditional on P7 landing and a re-measure of
  W per task on the next real spec; record the decision in project steering.

- **P9 (F9) — No change; carry RED-IMPOSSIBLE ACs as regression guards.** AC 1.9 could not
  produce a red test because `sources` was already an ignored arg; the implementer carried it
  as a regression guard at zero extra cost. Make it a one-line TDD convention: an AC whose
  behaviour already holds at base is marked a regression guard, not forced into a red test.
  Target: harness skills (TDD task convention).
  Effort: S. Risk: low: documents the handling already used.
  Prerequisites: none.
  Decision: approved; write the one-line convention.

- **P10 (F10) — Update Req 7.3 runaway-guard text to match the shipped basis.** The tasks
  ruling sized the guard from the task total (design D14), not the requirement's open-tasks,
  so Req 7.3's text is stale. Edit the requirement line to state the shipped basis.
  Target: spec store (requirements.md, this spec) — one-line doc fix.
  Effort: S. Risk: low: a closed spec's requirement text; no behaviour change.
  Prerequisites: none.
  Decision: approved as written.

- **P11 (F11) — No change; the round-1 reviewer handled the RE-DECIDED flags correctly.**
  The drafter flagged five design decisions RE-DECIDED and the reviewer ruled all five
  refinements within their governing requirement's intent, with no extra spawn. The flag ->
  ruling path worked as designed; over-flagging that closes in round 1 is cheap and safe.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  Decision: approved as a no-change item; record done with no diff.

- **P12 (F12) — No change; three rulings converged with zero adjudications or escalations.**
  All three document phases closed via a SHOULD_FIX-only corrective pass, the cap was never
  hit, and no ruling cost an extra spawn. This is the intended ruling-before-adjudication
  flow working.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  Decision: approved as a no-change item; record done with no diff.

- **P13 (F13) — No change; deferring live scenarios to an operator session is the sanctioned
  path.** The harness could not rebuild/restart/run AskUserQuestion under its own session, so
  it filed d-8a58ed18, shipped with (1)+(kit) passed and (2)/(3) `pending`, and the operator
  resolved them. This is exactly the `verification-evidence.md` gate in agent-rules.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  Decision: approved as a no-change item; record done with no diff.

- **P14 (F14) — Codify the D9 reading once P8 is decided.** The operator recorded the +20% W
  signal as a retro finding and let the merge proceed, per D9 (a worse signal is a finding,
  not a silent pass and not a merge block). The behaviour was correct; the open question is
  only whether D9 stays the standing policy, which P8 settles.
  Target: project steering (verification ruling policy).
  Effort: S. Risk: low.
  Prerequisites: P8.
  Decision: approved; P8 is decided (A), so D9 stays the standing policy — write it down
  beside the verification-evidence gate in agent-rules.md.

## Graduation candidates

- **G1 — Verification-only task convention (F5; also tdd-task-loop F14, graph-orientation
  F2).** Seen in three specs: verification-only tasks skip the verifier and/or require a
  manual spec-store relocate, dropping reviewCoverage.
  Rule text: "A verification-only task (one that produces baseline, fixture or
  verification-evidence artifacts and no source change) is still reviewed and counted in
  reviewCoverage. It writes its artifacts on the feature branch and the orchestrator
  relocates them to the main spec store at the merge gate; the brief states this relocation
  step explicitly."
  Target: .spec-workflow/agent-rules.md (new bullet under "Fixtures and live verification").
  Decision: approved; consistent with P5 option (A).

- **G2 — Name the blind spots of every usage count (F3; also graph-orientation F3,
  spec-lint tokens-unknown).** Seen in three specs: the activity hook under-records a whole
  class of spawns (reviewers W-unknown; truncated graph calls), yet counts are read as
  totals.
  Rule text: "Every `harness usage` producer records a `spawn.start` for every orchestrator
  AND reviewer spawn, matching both the `-brief*.md` and the `reviews/` prompt paths. Any
  column that cannot observe a class of events is labelled a floor at its source."
  Target: .spec-workflow/agent-rules.md ("Run ledger" section already states floors; add the
  reviewer-spawn requirement).
  Decision: approved.

- **G3 — Per-spawn prefix dominates short spawns (F7; also agent-cache-ttl, graph-orientation,
  provider-per-role).** Seen in four specs: the fixed base+skill prefix makes a 1-2 task
  spawn disproportionately expensive.
  Rule text: "When decomposing into orchestrator spawns, never leave a final spawn of one
  task: fold a trailing remainder of one into the previous batch. Treat the base+skill prefix
  as a fixed per-spawn cost when choosing the number of spawns."
  Target: .spec-workflow/agent-rules.md (new bullet) and the implementation launch-budget
  skill.
  Decision: approved; consistent with P7 option (A).

## Rejected proposals

None.
