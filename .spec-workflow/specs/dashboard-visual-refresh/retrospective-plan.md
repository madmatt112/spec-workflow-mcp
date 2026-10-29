# Retrospective plan — dashboard-visual-refresh

Status: APPROVED
Date: 2026-10-29

## Approved proposals

- **P1 (F1) — A self-hosting repo cannot gate-verify its own gate fix before merge.** A mid-spec
  change to the running gate's code (`src/core/task-parser.ts`, `gate-rules.ts`, `task-diff.ts`)
  can never be validated by the gate itself, because the loop runs the old build and the fix sits
  outside any feature task's `File:` list. Do not fold a harness/gate fix into an unrelated feature
  task's loop; it belongs in its own harness PR with rebuild+restart.
  Target: project steering (agent-rules.md "Checks").
  Effort: S. Risk: low: a wording rule, no behaviour change.
  Prerequisites: none.
  Eval case: none — a steering-prose rule, not an agent behaviour with a grader.
  DECISION NEEDED: yes. When the loop hits a gate bug whose fix is in gate code, how do we proceed?
  - Option A: stop the spec, fix the gate in its own harness PR, rebuild+restart, resume *(recommended)*.
  - Option B: let the operator hand-verify the fix and merge the feature spec with a retro note.
  - Option C: add a bypass flag so the loop reloads the rebuilt gate mid-run (large, risky).

- **P2 (F2) — A net-zero revert pair in the gate range produced a phantom structural-red.** The
  gate diffs `commit^..HEAD`, so a reverted parser fix that landed inside the range inflated the
  tdd head/line-count though the net diff was zero. Change the gate to diff the task's own commit
  set (`preHead..HEAD` minus commits attributed to no task) rather than a flat range, or collapse
  net-zero revert pairs before counting lines. See P7 — same root cause, one fix.
  Target: server code (`src/core/task-diff.ts`, `src/controller/phases/implementation.ts`).
  Effort: M. Risk: medium: range math feeds every gate verdict; needs tests on multi-commit tasks.
  Prerequisites: P7 decision (what the gate range should be).
  Eval case: `gate-range-net-zero-revert` — a task whose range holds a revert pair grades structural-green.
  DECISION NEEDED: no (folded into P7's decision).

- **P3 (F3) — The e2e visual capture did not reset the durable project list.**
  `resetSpecWorkflowHome` truncates `activeProjects.json` but not `projects.json`, so repeat
  captures polluted the sidebar. Already fixed in `playwright.worktree.config.ts` (e89b1edb);
  harden the reset helper to truncate both files so the next capturing spec needs no per-config fix.
  Target: server code (the reset helper under `e2e/`/test support).
  Effort: S. Risk: low: test-only helper.
  Prerequisites: none.
  Eval case: none — e2e test scaffolding, covered by the capture suite running clean.
  DECISION NEEDED: no.

- **P4 (F4) — Gear's notify-enable button is not drawn from the shared Button.** `Gear.tsx:109`
  keeps a raw `<button>`; task 4 grepped only `*Page.tsx` and the sameness test searched inside
  `main` while Gear is in the sidebar. Open deferral d-8b739a63 already tracks the one-line swap to
  the shared Button; land it, and widen the sameness test's scope to the sidebar.
  Target: product code (`Gear.tsx`) + its test.
  Effort: S. Risk: low: token-clean swap, latent 4.1 gap.
  Prerequisites: none (deferral already filed).
  Eval case: none — product UI, verified by the widened sameness test.
  DECISION NEEDED: no.

- **P5 (F5) — A fix brief carried another task's content.** `appendRulings` appends *all*
  `ctx.operatorRulings` to every brief, so task 4's fix brief carried task 1's rulings and its
  `<A>-<B>` reference. Tag each ruling with the task id it was issued for and have `appendRulings`
  filter to the current task.
  Target: server code (`src/controller/phases/implementation.ts` `appendRulings`, and the ruling
  capture that fills `operatorRulings`).
  Effort: M. Risk: medium: touches every brief that appends rulings; needs a test per callsite.
  Prerequisites: none.
  Eval case: `fix-brief-scoped-rulings` — a run with rulings on two tasks grades each brief carrying only its own.
  DECISION NEEDED: no.

- **P6 (F6) — The gate re-sent a byte-identical fix brief as a new round.** Round 2 was byte-identical
  to round 1 and its "tests fail on HEAD" was contradicted by a live re-run. Same root as F11/P8:
  the reasons never changed, so the rendered brief never changed. Fixing P5 and P8 removes the
  identical-brief case; additionally, refuse to spawn a fix round whose brief hashes identical to
  the previous round and route to the verifier or escalate instead.
  Target: server code (`src/controller/phases/implementation.ts` fix loop).
  Effort: S. Risk: low: a guard on an already-computed brief string.
  Prerequisites: P8.
  Eval case: `fix-brief-identical-guard` — an unchanged brief grades as routed, not re-spawned.
  DECISION NEEDED: no.

- **P7 (F8) — The gate ranges from the implementer's last reported commit, not the task's first.**
  `base = commit^` yields stale ranges and false `file-outside-list` escalations (d-e6bee5d8, open).
  The task's pick head (`preHead`) and its attributed commit set already exist in the loop; base the
  gate on the task's own commits, not a single reported commit.
  Target: server code (`src/controller/phases/implementation.ts`).
  Effort: M. Risk: medium: changes the diff every gate sees; multi-commit and resume paths need tests.
  Prerequisites: none.
  Eval case: `gate-range-task-commits` — a multi-commit task grades its range as pick-head..HEAD, no false outside-list.
  DECISION NEEDED: yes. What is the gate's commit range? (F2 and F8 pull the same lever.)
  - Option A: the task's attributed commit set, excluding net-zero revert pairs and unattributed commits *(recommended; fixes F2 and F8 together)*.
  - Option B: a flat `preHead..HEAD` range (simpler, but re-admits F2's phantom reds).
  - Option C: keep `commit^..HEAD` and only widen on resume (leaves d-e6bee5d8 open).

- **P8 (F9/F13) — A `file-outside-list` verdict cannot be moved by any implementer edit.** The loop
  already escalates when HEAD is unchanged and the reasons repeat (implementation.ts:810-826, P8 from
  dashboard-loop-views). It still cost two rounds here because the escalation needs *two* identical
  gates to trigger. Escalate on the first `file-outside-list` reason whose path the task cannot write
  (path outside every `File:` entry), without waiting for a repeat round.
  Target: server code (`src/controller/phases/implementation.ts`).
  Effort: S. Risk: low: tightens an existing guard.
  Prerequisites: none.
  Eval case: `outside-list-escalate-first-round` — an out-of-scope path grades as escalated on round 0.
  DECISION NEEDED: no.

- **P9 (F10) — The declared-directory annotation dropped its trailing slash, so prefix matching
  flagged every file under the directory.** The fix in `src/core/task-parser.ts` was reverted per F1,
  so the bug is still live. Re-apply the trailing-slash fix as its own harness PR (per P1), with a
  unit test on directory-prefix matching.
  Target: server code (`src/core/task-parser.ts`) + `__tests__`.
  Effort: S. Risk: low: one matcher, covered by a new unit test.
  Prerequisites: P1 (land it as a standalone harness PR).
  Eval case: `declared-dir-prefix-match` — a file under a declared directory grades as in-list.
  DECISION NEEDED: no.

- **P10 (F11) — The loop resends an identical brief instead of routing to the verifier.** Task 4's
  fail was pre-declared verifier routing (line-count/structural-red stated in tasks.md), not an
  implementer defect, yet `gate.gate === 'fail'` always opens an implementer fix round. When a fail
  is a structural/line-count verdict the decomposition marked for verifier routing, route to the
  verifier instead of spawning a fix implementer.
  Target: server code (`src/controller/phases/implementation.ts` fix branch) + the tasks-phase
  routing annotation.
  Effort: M. Risk: medium: changes which role a fail goes to; needs the routing flag honoured end to end.
  Prerequisites: P7 (clean range so the structural verdict is trustworthy).
  Eval case: `structural-fail-routes-verifier` — a pre-declared structural fail grades as verifier-routed.
  DECISION NEEDED: no.

- **P11 (F7) — A "MANDATORY: run graphify query" reminder was injected into tool results.** This is
  the user's global graphify PreToolUse hook firing because `graphify-out/` exists in the repo; it
  is not an SDD-harness defect and looks like injection to every agent. No harness change.
  Target: CLAUDE.md / settings (the user's global graphify hook).
  Effort: S. Risk: low: scopes one hook.
  Prerequisites: none.
  Eval case: none — the harness does not own this hook.
  DECISION NEEDED: yes. The graphify hook injects a mandatory-query line into Grep/Read results in SDD worktrees. What do we want?
  - Option A: exclude SDD worktree paths (`.claude/worktrees/`) from the hook so harness agents never see it *(recommended)*.
  - Option B: leave it; agents correctly flag and ignore it (F16), so it costs only noise.
  - Option C: delete `graphify-out/` from this repo.

- **P12 (F12) — Task 3 ran 4 fix rounds / 5 spawns before an adjudicated narrow pass.** All of it
  chased the F2 phantom structural-red. No change of its own: P2/P7 remove the phantom red, which
  removes the rounds. The round cap behaviour is correct.
  Target: none (fixed by P7).
  Effort: S. Risk: low.
  Prerequisites: P7.
  Eval case: none — covered by P7's case.
  DECISION NEEDED: no.

- **P13 (F14) — Task 5 spent 2 fix rounds / 3 spawns on pre-existing npm test failures.** The
  failures base-diff as pre-existing (D9), so the rounds added no fix. The loop should recognise a
  check that already fails at base and not open an implementer fix round for it; record it as the
  D9 signal and continue. See also P15 for the standing D9 pattern.
  Target: server code (`src/controller/phases/implementation.ts` / `gate-rules.ts` check handling).
  Effort: M. Risk: medium: must base-diff each failing check reliably before suppressing a round.
  Prerequisites: none.
  Eval case: `pre-existing-check-no-fix-round` — a base-failing check grades as a signal, not a round.
  DECISION NEEDED: no.

- **P14 (F15) — A 6-task visual refresh cost 54 spawns and 11 fix rounds.** This is the sum of
  F2/F5/F6/F9/F11/F14; no change of its own. P2/P5/P6/P7/P8/P10/P13 together remove the wasted
  rounds. Track W/task on the next real spec to confirm.
  Target: none (aggregate).
  Effort: S. Risk: low.
  Prerequisites: the above.
  Eval case: none — aggregate metric.
  DECISION NEEDED: no.

- **P15 (F21) — Six pre-existing npm test failures were allowed past the e2e gate (D9).** Correct
  per the D9 policy already in agent-rules; no merge-gate change. But a suite failing at base across
  multiple specs should become a tracked fix task, not an eternal signal — see Graduation.
  Target: project steering (decomposition conventions).
  Effort: S. Risk: low: adds a tracked task, no gate change.
  Prerequisites: none.
  Eval case: none — a decomposition convention.
  DECISION NEEDED: no.

- **P16 (F16) — The implementer flagged, rather than absorbed, verdicts it could not fix.** Positive
  behaviour; keep it. No change.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none — positive finding.
  DECISION NEEDED: no.

- **P17 (F17/F18) — Task 3 adjudicated after 3 rounds; task 4 escalated on a stale resend.** Both
  are correct process outcomes given the underlying defects; the rulings/escalation fired as
  designed. Fixed at root by P2/P7 (phantom red) and P5/P10 (stale/mis-routed brief). No separate
  change.
  Target: none (fixed by P2/P5/P7/P10).
  Effort: S. Risk: low.
  Prerequisites: those.
  Eval case: none.
  DECISION NEEDED: no.

- **P18 (F19/F20) — Task 6 was logged but unreviewed; merge allowed (decision C, retro P9).**
  reviewCoverage 5/6. The auto-allow repeats across specs (↔ tdd-task-loop). The merge-gate
  behaviour is a policy choice, not a bug.
  Target: harness agents (retro/merge-gate policy) / project steering.
  Effort: S. Risk: low: a policy wording change.
  Prerequisites: none.
  Eval case: `merge-gate-coverage-gap` — a 5/6 coverage run grades per the chosen policy.
  DECISION NEEDED: yes. When a task is logged but unreviewed at the merge gate, what should happen?
  - Option A: auto-allow with a logged retro finding, as today (decision C) *(recommended; cheapest, human sees it)*.
  - Option B: block the merge until an operator waives the gap explicitly.
  - Option C: spawn one catch-up verifier for the unreviewed task before the merge gate.

- **P19 (F22) — The uncommitted re-captured before-screenshots deferral was resolved at the merge
  gate.** d-85d402c5 is resolved; the merge-gate check worked as intended. No change.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  Eval case: none — a resolved deferral, behaviour correct.
  DECISION NEEDED: no.

## Decisions

- P1: When the loop hits a gate bug whose fix is in gate code, how do we proceed? → stop the spec, fix the gate in its own harness PR, rebuild+restart, resume *(recommended)*.
- P7: What is the gate's commit range? → the task's attributed commit set, excluding net-zero revert pairs and unattributed commits *(recommended; fixes F2 and F8 together)*.
- P11: The graphify hook injects a mandatory-query line into Grep/Read results in SDD worktrees. What do we want? → leave it; agents correctly flag and ignore it (F16), so it costs only noise.
- P18: When a task is logged but unreviewed at the merge gate, what should happen? → auto-allow with a logged retro finding, as today (decision C) *(recommended; cheapest, human sees it)*.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P12: skipped — no change chosen
- P14: skipped — no change chosen
- P16: skipped — no change chosen
- P17: skipped — no change chosen
- P19: skipped — no change chosen
- P1: to-do (human) — Rule already correct and committed (67a4994a) in .spec-workflow/agent-rules.md Checks. Gate fail is an unmovable file-outside-list: closeout itemPaths derived the expected list from the backticked example src/core/task-parser.ts (only named token existing at root), while the correct steering-prose commit touched .spec-workflow/agent-rules.md. No permitted edit moves a file-list verdict; the real fix is in gate code (closeout.ts) or retrospective-plan.md, both forbidden here. DESIGN-DEFECT.
- P15: done — a9a2f2d53a403dce822a496fd31d00411e593bd3
- P18: to-do (human) — harness merge-gate policy + eval case harness/evals/merge-gate-coverage-gap/ are outside store 1's .spec-workflow scope; decision C keeps behaviour as-is, no spec-store change
- P2: to-do (human) — gate-verdict Eval case unsupported by src/evals (agent-run graders only); blocked on P7 decision; medium-risk task-diff/controller change
- P3: done — 589038f028cab57ccf08127fbab73a5a9a20f9cb
- P5: to-do (human) — names a gate-verdict Eval case src/evals cannot grade (case.ts rejects unknown graders); cross-cutting medium-risk change to operatorRulings capture + every brief
- P6: to-do (human) — prereq P8 not landed (needs P5+P8); gate-verdict Eval case unsupported by src/evals
- P7: to-do (human) — DECISION NEEDED: yes, unresolved — the gate commit range (Option A/B/C) is a core design choice an implementer must not pick
- P8: to-do (human) — names Eval case 'outside-list-escalate-first-round' describing a gate verdict src/evals cannot grade; medium-risk escalation-timing change needing live controller verification
- P9: to-do (human) — prereq P1 (item wants its own standalone harness PR, not a retro-batch commit); names a gate/parser Eval case the agent-run eval infra cannot grade
- P10: to-do (human) — blocked on P7 (clean range); routing-flag change must be honoured end-to-end with live verification; gate-verdict Eval case unsupported
- P11: to-do (human) — DECISION NEEDED: yes, unresolved (graphify hook policy); target is ~/.claude which closeout-standing does not commit — needs a human
- P13: to-do (human) — names gate-verdict Eval case src/evals cannot grade; medium-risk base-diff check-suppression change in implementation.ts/gate-rules.ts
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/189
