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
spawn, default 20) and `REVISION_INPUT` (repair: the failing scenario). The 20-task
budget assumes the reduced orchestrator context this harness produces: you route only —
the `orient` action runs Step 0, `harness brief` assembles each brief, and the plugin
hook writes the worker spawn boundary, so none of that fills your context.

Brief templates are in `references/briefs.md`. Read it once at the start.

## Standing rules

- Agent tool, foreground, `subagent_type: <AGENT_PREFIX>:<agent>` (just `<agent>` when `AGENT_PREFIX` is `none`), no `model`
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
- Edit `tasks.md` and HANDOFF with the Edit tool. When the tool refuses the path (a
  worktree-isolated session), write `/tmp/scratchpad/sdd/<SPEC>/spec-edit.mjs` once with
  the Write tool from the script text in the document-phase skill's
  `references/cleanup.md`, then call it on its own shell line:
  `node /tmp/scratchpad/sdd/<SPEC>/spec-edit.mjs <file> <old> <new>` replaces one exact
  match (non-zero exit on 0 or 2+ matches). Never `sed -i` on the spec store, never a
  heredoc; write scripts with the Write tool.
- Do not ask questions.
- Spec store commits go through the script in the document-phase skill's
  `references/cleanup.md` (same script, same path); write it if it does not exist.
- **Ledger.** `EVENT_SCRIPT` from the launch prompt records the run for `--watch`. Call it
  as `bash <EVENT_SCRIPT> <type> key=value ...` (quote values with spaces): `phase.start`
  at the end of Step 0 (`state=tasks <done>/<total>`); `task.pick task=<N> "title=<title>"`
  when you mark a task `[-]`; one `spawn.usage` right after each worker's report
  (`agent=`, `role=implement task <N> | verify task <N> | fix task <N> round <r> |
  adjudicate task <N> | end-to-end verification | fix ci <check> round <r>`,
  `phase=implementation`, `task=<N>`, `result=<logged line | VERDICT | VERIFY>`);
  `note "text=gate: task <N> <pass|fail> risk <low|high>"` after every gate call;
  `task.done task=<N> rounds=<r> outcome=<pass|adjudicated|gate>` when you mark `[x]`;
  `note` for deferrals, design defects, drift and every red CI check; `phase.end` right
  before your final report. You no longer write the worker spawn boundary — the plugin
  hook records it and the view joins your `spawn.usage` to it by agent and time window.
  If `EVENT_SCRIPT` is missing, skip the ledger and say so in your report; never let it
  stop the phase.

## Step 0 — Orient

1. Call the spec-workflow `harness` tool with `action: orient`, `specName: <SPEC>`,
   `phase: implementation`, `mode: <MODE>`, and no `projectPath`. It returns `tasks`
   (`total`, `done`, `inProgress`, `open`), `tasksApproved`, `currentPhase` and `nextStep`.
   Route on `nextStep`:
   - `error: tasks.md not approved` ⇒ report `PHASE: error`, `REASON: tasks.md not
     approved`.
   - `Repair` ⇒ go to **Repair**.
   - `Per-task loop: resume task <N>` ⇒ the **Per-task loop**, working that `[-]` task
     first from Step 2 (its implementer may have finished; the verifier decides).
   - `Per-task loop` ⇒ the **Per-task loop**.
   - `Completion gate` ⇒ the **Completion gate**.
2. Read the HANDOFF section `## <SPEC> — implementation` if it exists.
3. Write `/tmp/scratchpad/sdd/<SPEC>/impl-standing.md` and `verify-standing.md` from
   the templates once per run.
4. Record `phase.start phase=implementation mode=<MODE> budget=<BUDGET>
   "state=tasks <done>/<total>"`.

## Per-task loop

Loop until no `[ ]` or `[-]` task remains, or the budget trips.

1. **Pick.** The first `[ ]` task in file order (or the `[-]` task from Step 0).
   Print `▶ Task <N>: <title>`. Edit `tasks.md` to mark it `[-]` before any work. Then
   run `git -C <CODE_ROOT> rev-parse HEAD` and keep the sha as `base=<sha>` on the
   task-list item; every gate call for this task passes it as `baseRef`, through every
   fix round. A `[-]` task resumed from Step 0 has no base ref: gate it without
   `baseRef`, which scores `risk: high`.
2. **Implement.** Call the spec-workflow `harness` tool with `action: brief`,
   `template: implementer`, `specName: <SPEC>`, `taskId: "<N>"`, and `values` carrying the
   output path `/tmp/scratchpad/sdd/<SPEC>/impl-brief-task-<N>.md`. The tool fills the
   task's full text (its `- [ ]` line to the next checkbox, so an intervening `##` heading
   is included) from `tasks.md` and writes the read-and-obey line. Spawn `sdd-implementer`
   with `Read and execute the instructions in <the returned path>`.
3. **Read the report.** It must contain `logged: yes/<taskId>`. If it says `logged:
   no`, spawn a fresh `sdd-implementer` with the brief plus "call log-implementation
   for task <N> now; the code is done". Flags:
   - `DESIGN-DEFECT` ⇒ **Design defect**.
   - `AFFECTS-FUTURE-SPECS` ⇒ **Deferral bar**.
   - `RETRO:` ⇒ append a retro-log entry with `retro.sh` (its category, its line, evidence = task N
     and the implementer's files).
   - `ESCALATE:` ⇒ **Escalate**.
   A **verification-only task** — its `File:` lines name no path under `CODE_ROOT` —
   has no gate: skip step 4 and spawn no verifier for it. Run its check commands as
   part of step 8 (end-to-end verification), then mark it `[x]` with `outcome=gate`.
4. **Gate.** Call the spec-workflow `review-task` tool with `action: gate`, `specName`,
   `taskId: "<N>"`, `baseRef` = the task's `base` sha when it has one, and `checks` = the
   check commands the task block and `agent-rules.md` name for the files the implementer
   touched, one shell string each, dropping a bare typecheck command (the gate runs the
   project typecheck itself). Pass `files` as the exact per-file paths the task
   changed, from the diff — never a directory, which mis-scores the gate (retro P8). Record the ledger note, then route on `data.gate` and
   `data.risk`:
   - `gate: fail` ⇒ **step 5** with a gate-fix brief; spawn no verifier; then run the
     gate again.
   - `pass` and `risk: low` or `medium` ⇒ **step 6**, with the gate-recorded review as the
     task's review, `rounds=0` and `task.done ... outcome=gate`. Medium is the docs-only
     down-rank (`docs/SDD-HARNESS.md`); it routes like low — the deterministic gate only, no
     verifier.
   - `pass` and `risk: high` ⇒ **step 4b**.
   A gate `success: false` after the implementer's `logged: yes` is a tool error, not a
   fix round: write the HANDOFF section, commit the spec store, and report `PHASE:
   resume`, `STATE: tasks <done>/<total>`, `NEXT: task <N>` (the resume escape
   `sdd-closeout-phase/SKILL.md:96-98` uses for a stuck batch).
4b. **Verify** (high risk only). Call `harness` `brief` with `template: verifier`,
   `specName: <SPEC>`, and `values` carrying the output path
   `/tmp/scratchpad/sdd/<SPEC>/verify-brief-task-<N>.md` and the verifier job (task id, the
   files the implementer named, round number, and the `## Gate results` block verbatim)
   from `references/briefs.md`. Spawn `sdd-verifier` with `Read and execute
   the instructions in <brief path>`. It runs `review-task` `prepare` then `record`, so
   the dashboard and `spec-status` see the review, runs only the checks the gate did not
   run, and ends with `VERDICT: pass | fix-required`.
5. **Fix rounds** (cap 3, counting gate fails and verifier `fix-required` alike). Spawn
   a fresh `sdd-implementer`, then return to step 4 (the gate). Assemble each fix brief
   with `harness` `brief`, `template: reviser`, `specName: <SPEC>`, `values` carrying the
   output path `impl-brief-task-<N>-fix-<r>.md` and the findings:
   - After a `gate: fail`: the findings are `data.reasons` and `data.checks` verbatim;
     spawn no verifier; re-run the gate.
   - After a verifier `fix-required`: the findings are the verifier's findings; re-run
     step 4.
   After three fix rounds still failing: assemble `adjudication-brief-task-<N>.md` with
   `harness` `brief`, `template: adjudicator`, the open findings as its items, spawn
   `sdd-adjudicator` once (it rules on each open finding and fixes what it accepts), then
   one narrow verification (assemble `verify-brief-task-<N>-narrow.md` with `harness`
   `brief`, `template: verifier`: verify only the listed findings, and when the terminus
   was a gate fail re-run the checks that were failing; `review-task` `prepare` and
   `record` again). Append a retro-log entry with `retro.sh` (`ruling`, with the narrow
   verdict) and continue to step 6 whatever the narrow verdict says.
6. **Complete.** Only with a `gate: pass` and `risk: low` or `medium`, a verifier
   `VERDICT: pass`, or after adjudication, and `logged: yes`: edit `tasks.md` `[-]` → `[x]` (`task.done`
   `outcome=gate` on the gate path, `pass` on a verifier pass, `adjudicated` after
   adjudication). Append a retro-log entry with `retro.sh` for the task:
   `## <ts> · implementation · task <N> · <inefficiency if fix rounds > 1, else gotcha>`
   with rounds, outcome, cost in spawns. Then rewrite the State row of the HANDOFF
   section `## <SPEC> — implementation` (`tasks <done>/<total>`, last code commit, next
   task) and commit the spec store. Count it against `BUDGET`. A task whose
   verification is only partly done may still go `[x]`, but only when a `deferrals`
   record tagged `verification` names the exact command still to run and the evidence
   it must show; on that, add the row `Deferred verification | <id>` to the HANDOFF
   `## <SPEC> — implementation` section and carry that item unticked in the PR body's
   Test plan (step 10). A silent skip is not allowed: no record, no `[x]`.
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
task to `[ ]`. Append a retro-log entry with `retro.sh` (`deviation`, the defect in one sentence,
evidence = task N). Write the HANDOFF section. Commit the spec store. Report
`PHASE: design-defect`, `STATE: tasks <done>/<total>`, `REASON: <the defect, one
line, from the implementer's flag>`. The supervisor re-opens design.

## Escalate

The implementer says a task's own instructions make a measured outcome need a human
ruling before any later task runs — a failed vendor probe, not a design contradiction.
Do not force it. Revert the task to `[ ]`. Append a retro-log entry with `retro.sh`
(`escalation`, the flag's line, evidence = task N). Write the HANDOFF section. Commit the
spec store. Report `PHASE: escalate`, `STATE: tasks <done>/<total>`, `REASON: <the
flag's line>`. The supervisor already stops on it.

## Completion gate

When no `[ ]` or `[-]` task remains:

8. **End-to-end verification.** Grep the decomposition entry for `SPEC` in
   `<SPEC_STORE_ROOT>/spec-decomposition/decomposition.md` and take its verification
   scenario. Call `harness` `brief` with `template: verifier`, `specName: <SPEC>`, and
   `values` carrying the output path `/tmp/scratchpad/sdd/<SPEC>/verify-e2e.md` and the
   end-to-end job (the scenario, plus the full check suite as `agent-rules.md` defines it:
   typecheck, tests, lint, migrations, e2e, each as a separate command). Spawn
   `sdd-verifier`. It ends with `VERIFY: pass | fail`, or `VERIFY: pass (deferred: <id>)`
   for the in-run case below.
   - `fail` ⇒ write the HANDOFF section, append a retro-log entry with `retro.sh` (`bug`), commit the
     spec store, report `PHASE: verify-failed`, `REASON: <one line from the report>`.
     Do not mark anything complete.
   - When the scenario needs a skill or tool this spec adds that the running session or
     server still lacks (agents and skills load at session start; the server loads when
     the session connects, from `dist/` on a checkout or from the released package on a
     plugin install), the verifier cannot exercise it end-to-end: it verifies the tool
     half in-process instead, stages the fixture under
     `/tmp/scratchpad/sdd/<SPEC>/scratch-store/`, and reports
     `VERIFY: pass (deferred: <id>)`. On that report add a `deferrals` record tagged
     `verification` whose `revisitCriteria` is the exact command to re-run once the
     checkout is rebuilt and the session restarted (or the plugin and server reinstalled)
     and the evidence it must show, then treat it as `pass`.
   - `pass` ⇒ step 9.
9. **Close the spec.** Confirm every task in `tasks.md` is `[x]`. Call `spec-index`
   `generate`. Call `deferrals` `list` with `status: deferred`: count the records with
   `originSpec: <SPEC>` (added by this spec) and the total. Write the HANDOFF section
   (implemented, date, the two deferral numbers, the two or three deferrals most
   worth working next, a `Deferred verification | <id>` row for every task that went
   `[x]` with verification deferred, gotchas). Append the phase summary to the retro log (`cleanup`:
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
    open it: append a retro-log entry with `retro.sh` (`deviation`: the decomposition put two
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
2. **Fix.** Call `harness` `brief` with `template: reviser`, `specName: <SPEC>`, and
   `values` carrying the output path `impl-brief-ci-r<r>.md` and, as the findings, the CI
   fix content from `references/briefs.md` (the check names, the log file paths,
   "reproduce locally first"). Spawn `sdd-implementer`; its `spawn.usage` carries
   `role=fix ci <check> round <r>`. It fixes the cause, commits on the branch without
   pushing, and reports the command that reproduces the check locally, or `INFRA:` when
   the failure is not in the code.
3. **Verify.** Call `harness` `brief` with `template: verifier`, `specName: <SPEC>`, and
   `values` carrying the output path `verify-brief-ci-r<r>.md` and the CI verify job (the
   check names, the commit, the reproduce commands from the implementer's report). Spawn
   `sdd-verifier`. `VERIFY: fail` ⇒ the next round from step 2, without pushing.
   `VERIFY: pass` (or `INFRA:` from the implementer) ⇒ `git push` in `CODE_ROOT` (on
   `INFRA:`, rerun the failed jobs instead: `gh run rerun <run id> --failed`) and the
   gate again (10b).
4. **Record.** One retro-log entry per round: `bug` when the fix touched product or
   test code, `tool-error` when the failure was CI infrastructure (runner, network, a
   flaky job that reran green); evidence = the check name and the commit; cost =
   spawns and minutes.
5. After three rounds still red: assemble `adjudication-brief-ci.md` with `harness`
   `brief`, `template: adjudicator`, `specName: <SPEC>`, its items each failing check with
   its last log file ("rule on each: fix it, or state why it cannot be fixed here"),
   spawn `sdd-adjudicator` once, push, run the gate once more. Still red ⇒ write the
   HANDOFF section (the PR URL, the red checks, what was tried), append a retro-log
   entry with `retro.sh` (`escalation`), commit the spec store, and report `PHASE: verify-failed`,
   `REASON: ci: <check>`. The supervisor's repair path takes over; its brief carries the
   check name, and steps 9 to 11 reuse the open PR.

## Repair

`MODE: repair` with `REVISION_INPUT` = the failing scenario or check.

1. Call `harness` `brief` with `template: reviser`, `specName: <SPEC>`, and `values`
   carrying the output path `impl-brief-repair-<k>.md` and, as the findings, the failing
   scenario with the instruction to reproduce first, fix the cause, add coverage that
   fails without the fix, and report. Spawn `sdd-implementer`. When `REVISION_INPUT`
   starts with `ci:`, the failing scenario is that PR check: use the CI fix content
   instead, with the log tail saved as in **Reconcile a red PR** step 1.
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
| Implementer flagged an escalate | `escalate` | the flag's line |
| Gate failed, or the PR stayed red after three reconcile rounds and an adjudication | `verify-failed` | the failing scenario, or `ci: <check>` |
| `tasks.md` not approved, drift, a tool error you cannot route around | `error` | the cause |

Every stop writes the HANDOFF section and commits the spec store first.
