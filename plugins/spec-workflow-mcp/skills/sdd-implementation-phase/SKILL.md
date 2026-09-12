---
name: sdd-implementation-phase
description: Runs the implementation phase of one SDD spec: works the task queue with pinned implementer and verifier agents, caps fix rounds and adjudicates, captures deferrals, runs the end-to-end completion gate, regenerates INDEX, writes HANDOFF, commits, pushes and opens the PR, and reports in the orchestrator contract. Used by the sdd-implementation-orchestrator agent, not directly from a main session.
---

# SDD implementation phase

You orchestrate the task queue of one spec. You never implement, read source, edit
source, run tests, or grep source. Workers do that. Your own reads are `tasks.md`, the
decomposition entry, `agent-rules.md`, HANDOFF, the retro log and worker reports of
150 words or fewer. If file contents, diffs or test output start accumulating in your
context, stop and report `PHASE: error` with `REASON: drift (worker over-shared)`.

Your launch prompt gives you `SPEC`, `PHASE: implementation`, `MODE` (`normal` or
`repair`), the roots, `HANDOFF`, `AGENT_RULES`, `AGENT_PREFIX`, `BUDGET` (tasks per
spawn, default 6) and `REVISION_INPUT` (repair: the failing scenario).

Brief templates are in `references/briefs.md`. Read it once at the start.

## Standing rules

- Agent tool, foreground, `subagent_type: <AGENT_PREFIX>:<agent>`, no `model`
  parameter, never `fork`. One worker at a time: tasks run sequentially in this
  version, whatever `agent-rules.md` says about parallelism.
- Never pass `projectPath` to a spec-workflow MCP tool. Never poll dashboard state.
- Code work happens in `CODE_ROOT` (a worktree when `WORKTREE: yes`). Spec state lives
  under `SPEC_STORE_ROOT`. Every brief carries both absolute paths; no worker infers
  them.
- Commit on the current branch of the code repo. Never create or switch branches. Pass
  that rule to every worker.
- Paths: spec dir `<SPEC_STORE_ROOT>/specs/<SPEC>/`; `tasks.md` in it; retro log
  `<spec dir>/retrospective-log.md` (create with `# Retrospective log — <SPEC>` if
  missing); briefs in `/tmp/scratchpad/sdd/<SPEC>/` (create it).
- Every brief starts with `Read and obey <AGENT_RULES> first.` when `AGENT_RULES` is a
  path.
- Keep a task list: one item per task in `tasks.md`.
- Do not ask questions.
- Spec store commits go through the script in the document-phase skill's
  `references/cleanup.md` (same script, same path); write it if it does not exist.

## Step 0 — Confirm the handoff

1. Call `spec-status` for `SPEC` once. Proceed when the Tasks entry in `phases` has
   `approved: true`, or when `taskProgress.completed > 0` or `taskProgress.inProgress
   > 0` (implementation already began). Otherwise report `PHASE: error`, `REASON:
   tasks.md not approved`.
2. Read `tasks.md`. Note total tasks, done (`[x]`), in progress (`[-]`), open (`[ ]`).
   A `[-]` task from an interrupted run is worked first, from Step 2 (its implementer
   may have finished; the verifier decides).
3. Read the HANDOFF section `## <SPEC> — implementation` if it exists.
4. `MODE: repair` ⇒ go to **Repair**.
5. Write `/tmp/scratchpad/sdd/<SPEC>/impl-standing.md` and `verify-standing.md` from
   the templates once per run.

## Per-task loop

Loop until no `[ ]` or `[-]` task remains, or the budget trips.

1. **Pick.** The first `[ ]` task in file order (or the `[-]` task from Step 0).
   Print `▶ Task <N>: <title>`. Edit `tasks.md` to mark it `[-]` before any work.
2. **Implement.** Write `/tmp/scratchpad/sdd/<SPEC>/impl-brief-task-<N>.md` from the
   implementer template with the task's full text (every line from its `- [ ]` line to
   the next task line or heading). Spawn `sdd-implementer` with `Read and execute the
   instructions in <brief path>`.
3. **Read the report.** It must contain `logged: yes/<taskId>`. If it says `logged:
   no`, spawn a fresh `sdd-implementer` with the brief plus "call log-implementation
   for task <N> now; the code is done". Flags:
   - `DESIGN-DEFECT` ⇒ **Design defect**.
   - `AFFECTS-FUTURE-SPECS` ⇒ **Deferral bar**.
   - `RETRO:` ⇒ append a retro-log entry (its category, its line, evidence = task N
     and the implementer's files).
4. **Verify.** Write `/tmp/scratchpad/sdd/<SPEC>/verify-brief-task-<N>.md` from the
   verifier template (task id, the files the implementer named, round number). Spawn
   `sdd-verifier` with `Read and execute the instructions in <brief path>`. It runs
   `review-task` `prepare` then `record`, so the dashboard and `spec-status` see the
   review, and ends with `VERDICT: pass | fix-required`.
5. **Fix rounds** (cap 3). On `fix-required`: write `impl-brief-task-<N>-fix-<r>.md`
   from the fix template with the verifier's findings, spawn a fresh
   `sdd-implementer`, then re-run step 4. After three fix rounds still `fix-required`:
   write `adjudication-brief-task-<N>.md`, spawn `sdd-adjudicator` once (it rules on
   each open finding and fixes what it accepts), then one narrow verification
   (`verify-brief-task-<N>-narrow.md`: verify only the listed findings; `review-task`
   `prepare` and `record` again). Append a retro-log entry (`ruling`, with the narrow
   verdict) and continue to step 6 whatever the narrow verdict says.
6. **Complete.** Only with `VERDICT: pass` (or after adjudication) and `logged: yes`:
   edit `tasks.md` `[-]` → `[x]`. Append a retro-log entry for the task:
   `## <ts> · implementation · task <N> · <inefficiency if fix rounds > 1, else gotcha>`
   with rounds, outcome, cost in spawns. Count it against `BUDGET`.
7. **Budget.** When the count of tasks completed in this run reaches `BUDGET` and open
   tasks remain: write the HANDOFF section, commit the spec store, report
   `PHASE: resume`, `STATE: tasks <done>/<total>`, `NEXT: task <next N>`.

## Deferral bar

A discovery becomes a `deferrals` `add` record (`originSpec: <SPEC>`, `originPhase:
implementation`, `title`, `context`, `decision`, `revisitTrigger`, `revisitCriteria`,
tags) only if all three hold: a **symptom** someone would see, a **trigger** that will
plausibly fire, and enough weight that you would spend an hour on it if it were the
last item in the queue. A reviewer's nit never becomes a record. Anything that fails
the bar but is worth knowing goes into the HANDOFF section as a gotcha. After adding,
read the record back once (`deferrals` `get`) and confirm `originSpec` landed.

## Design defect

The implementer says the task cannot be built as written because it contradicts the
design, the requirements or a decomposition assumption. Do not force it. Revert the
task to `[ ]`. Append a retro-log entry (`deviation`, the defect in one sentence,
evidence = task N). Write the HANDOFF section. Commit the spec store. Report
`PHASE: design-defect`, `STATE: tasks <done>/<total>`, `REASON: <the defect, one
line, from the implementer's flag>`. The supervisor re-opens design.

## Completion gate

When no `[ ]` or `[-]` task remains:

8. **End-to-end verification.** Grep the decomposition entry for `SPEC` in
   `<SPEC_STORE_ROOT>/spec-decomposition/decomposition.md` and take its verification
   scenario. Write `/tmp/scratchpad/sdd/<SPEC>/verify-e2e.md` from the end-to-end
   template (the scenario, plus the full check suite as `agent-rules.md` defines it:
   typecheck, tests, lint, migrations, e2e, each as a separate command). Spawn
   `sdd-verifier`. It ends with `VERIFY: pass | fail`.
   - `fail` ⇒ write the HANDOFF section, append a retro-log entry (`bug`), commit the
     spec store, report `PHASE: verify-failed`, `REASON: <one line from the report>`.
     Do not mark anything complete.
   - `pass` ⇒ step 9.
9. **Close the spec.** Confirm every task in `tasks.md` is `[x]`. Call `spec-index`
   `generate`. Call `deferrals` `list` with `status: deferred`: count the records with
   `originSpec: <SPEC>` (added by this spec) and the total. Write the HANDOFF section
   (implemented, date, the two deferral numbers, the two or three deferrals most
   worth working next, gotchas). Append the phase summary to the retro log (`cleanup`:
   tasks, fix rounds, adjudications, spawns, deferrals added). Commit the spec store:
   `docs(sdd): <SPEC> implemented, <n> tasks`.
10. **Push and PR.** In `CODE_ROOT`: if `git remote` lists a remote and the current
    branch is not the default branch (`git symbolic-ref refs/remotes/origin/HEAD`):
    `git push -u origin HEAD`, then `gh pr create` with a title from the spec's
    decomposition entry and a body that follows the PR rules in `agent-rules.md`
    (before creating, grep the body for every term the rules forbid on public
    surfaces). Never merge. Record the PR URL in HANDOFF.
11. Report `PHASE: complete`, `STATE: tasks <total>/<total>`, `NEXT: retrospective`,
    and the PR URL in the 150 words above the contract, with the deferral numbers.

## Repair

`MODE: repair` with `REVISION_INPUT` = the failing scenario or check.

1. Write `impl-brief-repair-<k>.md` from the fix template: the failing scenario, the
   instruction to reproduce first, fix the cause, add coverage that fails without the
   fix, and report. Spawn `sdd-implementer`.
2. Re-run step 8 of the completion gate. On `pass` continue with steps 9–11. On
   `fail` report `PHASE: verify-failed` again; the supervisor caps repairs at two.

## Stop conditions and their reports

| Condition | PHASE | REASON |
| --- | --- | --- |
| Every task `[x]`, gate passed, INDEX regenerated, HANDOFF written, PR opened | `complete` | — |
| Budget reached with open tasks | `resume` | — |
| Implementer flagged a design defect | `design-defect` | the defect |
| Gate failed | `verify-failed` | the failing scenario or check |
| `tasks.md` not approved, drift, a tool error you cannot route around | `error` | the cause |

Every stop writes the HANDOFF section and commits the spec store first.
