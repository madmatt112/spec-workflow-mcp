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
spawn, default 20) and `REVISION_INPUT` (repair: the failing scenario).

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
- Edit `tasks.md` and HANDOFF with the Edit tool. Never `sed -i` on the spec store from
  a shell line, and never put a heredoc on a shell line; write scripts with the Write
  tool.
- Do not ask questions.
- Spec store commits go through the script in the document-phase skill's
  `references/cleanup.md` (same script, same path); write it if it does not exist.
- **Ledger.** `EVENT_SCRIPT` from the launch prompt records the run for `--watch`. Call it
  as `bash <EVENT_SCRIPT> <type> key=value ...` (quote values with spaces): `phase.start`
  at the end of Step 0 (`state=tasks <done>/<total>`); `task.pick task=<N> "title=<title>"`
  when you mark a task `[-]`; `spawn.start` right before every Agent call and `spawn.end`
  right after its report (`agent=`, `role=implement task <N> | verify task <N> | fix task
  <N> round <r> | adjudicate task <N> | end-to-end verification`, `phase=implementation`,
  `task=<N>`, `result=<logged line | VERDICT | VERIFY>`, `tokens=<n>` from the token
  count the Agent result states in its footer); `spawn.start` roles for a red
  PR: `fix ci <check> round <r>`; `note "text=gate: task <N> <pass|fail> risk <low|high>"`
  after every gate call; `task.done task=<N> rounds=<r> outcome=<pass|adjudicated|gate>`
  when you mark `[x]`; `note` for deferrals, design defects, drift and every red CI
  check; `phase.end` right before your final report. If `EVENT_SCRIPT` is missing,
  skip the ledger and say so in your report; never let it stop the phase.

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
   Print `▶ Task <N>: <title>`. Edit `tasks.md` to mark it `[-]` before any work. Then
   run `git -C <CODE_ROOT> rev-parse HEAD` and keep the sha as `base=<sha>` on the
   task-list item; every gate call for this task passes it as `baseRef`, through every
   fix round. A `[-]` task resumed from Step 0 has no base ref: gate it without
   `baseRef`, which scores `risk: high`.
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
4. **Gate.** Call the spec-workflow `review-task` tool with `action: gate`, `specName`,
   `taskId: "<N>"`, `baseRef` = the task's `base` sha when it has one, and `checks` = the
   check commands the task block and `agent-rules.md` name for the files the implementer
   touched, one shell string each, dropping a bare typecheck command (the gate runs the
   project typecheck itself). Record the ledger note, then route on `data.gate` and
   `data.risk`:
   - `gate: fail` ⇒ **step 5** with a gate-fix brief; spawn no verifier; then run the
     gate again.
   - `pass` and `risk: low` ⇒ **step 6**, with the gate-recorded review as the task's
     review, `rounds=0` and `task.done ... outcome=gate`.
   - `pass` and `risk: high` ⇒ **step 4b**.
   A gate `success: false` after the implementer's `logged: yes` is a tool error, not a
   fix round: write the HANDOFF section, commit the spec store, and report `PHASE:
   resume`, `STATE: tasks <done>/<total>`, `NEXT: task <N>` (the resume escape
   `sdd-closeout-phase/SKILL.md:96-98` uses for a stuck batch).
4b. **Verify** (high risk only). Write `/tmp/scratchpad/sdd/<SPEC>/verify-brief-task-<N>.md`
   from the verifier template (task id, the files the implementer named, round number,
   and the `## Gate results` block verbatim). Spawn `sdd-verifier` with `Read and execute
   the instructions in <brief path>`. It runs `review-task` `prepare` then `record`, so
   the dashboard and `spec-status` see the review, runs only the checks the gate did not
   run, and ends with `VERDICT: pass | fix-required`.
5. **Fix rounds** (cap 3, counting gate fails and verifier `fix-required` alike). Spawn
   a fresh `sdd-implementer`, then return to step 4 (the gate):
   - After a `gate: fail`: the gate-fix brief (`impl-brief-task-<N>-fix-<r>.md`) carries
     `data.reasons` and `data.checks` verbatim; spawn no verifier; re-run the gate.
   - After a verifier `fix-required`: `impl-brief-task-<N>-fix-<r>.md` from the fix
     template with the verifier's findings; re-run step 4.
   After three fix rounds still failing: write `adjudication-brief-task-<N>.md`, spawn
   `sdd-adjudicator` once (it rules on each open finding and fixes what it accepts), then
   one narrow verification (`verify-brief-task-<N>-narrow.md`: verify only the listed
   findings, and when the terminus was a gate fail re-run the checks that were failing;
   `review-task` `prepare` and `record` again). Append a retro-log entry (`ruling`, with
   the narrow verdict) and continue to step 6 whatever the narrow verdict says.
6. **Complete.** Only with a `gate: pass` and `risk: low`, a verifier `VERDICT: pass`,
   or after adjudication, and `logged: yes`: edit `tasks.md` `[-]` → `[x]` (`task.done`
   `outcome=gate` on the gate path, `pass` on a verifier pass, `adjudicated` after
   adjudication). Append a retro-log entry for the task:
   `## <ts> · implementation · task <N> · <inefficiency if fix rounds > 1, else gotcha>`
   with rounds, outcome, cost in spawns. Then rewrite the State row of the HANDOFF
   section `## <SPEC> — implementation` (`tasks <done>/<total>`, last code commit, next
   task) and commit the spec store. Count it against `BUDGET`.
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
    `git push -u origin HEAD`. If the branch already has an open PR (`gh pr view
    --json number,url`; a repair run or an earlier spawn opened it), reuse it.
    Otherwise `gh pr create` with a title from the spec's decomposition entry and a
    body that follows the PR rules in `agent-rules.md` (before creating, grep the body
    for every term the rules forbid on public surfaces). The `## Summary` gets one
    `Not in this PR: …` bullet, built from the `Cut scope` rows of the three
    document-phase HANDOFF sections (`## <SPEC> — requirements`, `— design`, `— tasks`);
    omit the bullet only when all three are `none`. Never merge. Record the PR
    URL in HANDOFF. **One PR per code repo per spec.** When the work would need a
    second PR (a second repository, or a change that must land on its own), do not
    open it: append a retro-log entry (`deviation`: the decomposition put two
    deliverables in one spec), add a `deferrals` record for the second deliverable,
    and name both in the HANDOFF section.
10b. **PR checks gate.** Wait for the PR's checks before you report `complete`. Write
    `/tmp/scratchpad/sdd/<SPEC>/pr-checks.sh` once with the Write tool:

    ```bash
    #!/bin/bash
    # usage: bash pr-checks.sh <pr number>
    # Waits up to nine minutes for the PR's checks, then prints the check table.
    # Exit code: 0 every check passed, 1 one or more failed, 8 still pending.
    cd "<CODE_ROOT>"
    timeout 540 gh pr checks "$1" --watch --interval 20 > /dev/null 2>&1
    gh pr checks "$1"
    ```

    Run it in the foreground, never in the background, one call at a time. While it
    exits 8, run it again, up to 30 minutes of waiting in all; after that treat the
    PR as red with the check named `pending`. A repo with no checks (an empty table,
    exit 0) passes the gate. The table is the only CI output you read yourself.
    - Exit 0 ⇒ step 11.
    - Exit 1 ⇒ record `note "text=ci red: <check names>, round <r>"` and go to
      **Reconcile a red PR**. When it comes back green ⇒ step 11.
11. Report `PHASE: complete`, `STATE: tasks <total>/<total>`, `NEXT: retrospective`,
    and the PR URL in the 150 words above the contract, with the deferral numbers.

### Reconcile a red PR

Cap 3 rounds per PR. Round r:

1. **Log tail.** For each failing check, take the run id and job id from its URL in
   the table (`.../actions/runs/<run id>/job/<job id>`) and save the failing steps'
   log with a script file: `gh run view <run id> --job <job id> --log-failed | tail
   -80 > /tmp/scratchpad/sdd/<SPEC>/ci-<check>-r<r>.log`. Read nothing of it yourself
   beyond `wc -l`.
2. **Fix.** Write `impl-brief-ci-r<r>.md` from the CI fix template in
   `references/briefs.md` (the check names, the log file paths, "reproduce locally
   first"). Spawn `sdd-implementer` (`role=fix ci <check> round <r>`). It fixes the
   cause, commits on the branch without pushing, and reports the command that
   reproduces the check locally, or `INFRA:` when the failure is not in the code.
3. **Verify.** Write `verify-brief-ci-r<r>.md` from the CI verify template (the check
   names, the commit, the reproduce commands from the implementer's report). Spawn
   `sdd-verifier`. `VERIFY: fail` ⇒ the next round from step 2, without pushing.
   `VERIFY: pass` (or `INFRA:` from the implementer) ⇒ `git push` in `CODE_ROOT` (on
   `INFRA:`, rerun the failed jobs instead: `gh run rerun <run id> --failed`) and the
   gate again (10b).
4. **Record.** One retro-log entry per round: `bug` when the fix touched product or
   test code, `tool-error` when the failure was CI infrastructure (runner, network, a
   flaky job that reran green); evidence = the check name and the commit; cost =
   spawns and minutes.
5. After three rounds still red: write `adjudication-brief-ci.md` (each failing check,
   its last log file, "rule on each: fix it, or state why it cannot be fixed here"),
   spawn `sdd-adjudicator` once, push, run the gate once more. Still red ⇒ write the
   HANDOFF section (the PR URL, the red checks, what was tried), append a retro-log
   entry (`escalation`), commit the spec store, and report `PHASE: verify-failed`,
   `REASON: ci: <check>`. The supervisor's repair path takes over; its brief carries the
   check name, and steps 9 to 11 reuse the open PR.

## Repair

`MODE: repair` with `REVISION_INPUT` = the failing scenario or check.

1. Write `impl-brief-repair-<k>.md` from the fix template: the failing scenario, the
   instruction to reproduce first, fix the cause, add coverage that fails without the
   fix, and report. Spawn `sdd-implementer`. When `REVISION_INPUT` starts with `ci:`,
   the failing scenario is that PR check: use the CI fix template instead, with the
   log tail saved as in **Reconcile a red PR** step 1.
2. Re-run step 8 of the completion gate. On `pass` continue with steps 9–11. On
   `fail` report `PHASE: verify-failed` again; the supervisor caps repairs at two.

## Stop conditions and their reports

Record `phase.end phase=implementation result=<PHASE value> "state=tasks <done>/<total>"
"note=<one line>"` right before the report.

| Condition | PHASE | REASON |
| --- | --- | --- |
| Every task `[x]`, gate passed, INDEX regenerated, HANDOFF written, PR opened, checks green | `complete` | — |
| Budget reached with open tasks | `resume` | — |
| Implementer flagged a design defect | `design-defect` | the defect |
| Gate failed, or the PR stayed red after three reconcile rounds and an adjudication | `verify-failed` | the failing scenario, or `ci: <check>` |
| `tasks.md` not approved, drift, a tool error you cannot route around | `error` | the cause |

Every stop writes the HANDOFF section and commits the spec store first.
