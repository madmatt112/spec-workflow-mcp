# Implementation-phase completion and repair

The core skill routes here: to the **Completion gate** when no `[ ]` or `[-]` task
remains (a Step 0 `nextStep` of `Completion gate`, or the Per-task loop running dry), and
to **Repair** on a Step 0 `nextStep` of `Repair`. All bookkeeping — ledger rows, retro
entries, the HANDOFF State row and spec-store commits — goes through `book.sh` as the core
skill's **Bookkeeping** rule describes. Every brief and prompt block comes from the
`harness` `brief` server kinds; you pass only the values each kind needs.

## Completion gate

When no `[ ]` or `[-]` task remains:

8. **End-to-end verification.** Take the verification scenario from Step 0's orient
   `decomposition.scenario` (Requirement 4.3; a null scenario means the entry or label was
   missing — pass `scenario: "read the decomposition entry for <SPEC> yourself"`). Call
   `harness` `brief` with `template: verifier`, `specName: <SPEC>`, and `values` carrying
   the output path `/tmp/scratchpad/sdd/<SPEC>/verify-e2e.md`, `variant: e2e`, `scenario`
   (the text above), and the unused per-task slots as empty strings (`title: ""`, `taskIds:
   ""`, `files: ""`, `round: ""`, `gateResults: ""`). The brief names the full check suite
   as `agent-rules.md` defines it (typecheck, tests, lint, migrations, e2e, each a separate
   command); the verifier reads that suite from `agent-rules.md`. Spawn `sdd-verifier`. It
   ends with `VERIFY: pass | fail`, or `VERIFY: pass (deferred: <id>)` for the in-run case
   below.
   - `fail` ⇒ write the HANDOFF section, append a retro-log entry through `book.sh` (`retro`,
     `bug`), commit the spec store, report `PHASE: verify-failed`, `REASON: <one line from
     the report>`. Do not mark anything complete.
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
9. **Close the spec.** Confirm every task in the orient queue is `[x]` (the queue is empty
   at this point). Call `spec-index` `generate`. Call `deferrals` `list` with `status:
   deferred`: count the records with `originSpec: <SPEC>` (added by this spec) and the
   total. Write the HANDOFF section (implemented, date, the two deferral numbers, the two or
   three deferrals most worth working next, a `Deferred verification | <id>` row for every
   task that went `[x]` with verification deferred, gotchas) through `book.sh` (`state` for
   the State row, `edit` for the rest). Append the phase summary to the retro log through
   `book.sh` (`retro`, `cleanup`: tasks, fix rounds, adjudications, spawns, deferrals
   added). Commit the spec store through `book.sh` (`commit`): `docs(sdd): <SPEC>
   implemented, <n> tasks`.
10. **Push and PR.** In `CODE_ROOT`: if `git remote` lists a remote and the current
    branch is not the default branch (`git symbolic-ref refs/remotes/origin/HEAD`):
    `git push -u origin HEAD`. If the branch already has an open PR (`gh pr view
    --json number,url`; a repair run or an earlier spawn opened it), reuse it.
    Otherwise `gh pr create` with a title from the spec's decomposition entry (Step 0's
    orient `decomposition.title`) and a body that follows the **PR body rules** below.
    The `## Summary` gets one `Not in this PR: …` bullet, built from the `Cut scope` rows
    of the three document-phase HANDOFF sections (`## <SPEC> — requirements`, `— design`,
    `— tasks`); omit the bullet only when all three are `none`. Never merge. Record the PR
    URL in HANDOFF. **One PR per code repo per spec.** When the work would need a
    second PR (a second repository, or a change that must land on its own), do not
    open it: append a retro-log entry through `book.sh` (`retro`, `deviation`: the
    decomposition put two deliverables in one spec), add a `deferrals` record for the second
    deliverable, and name both in the HANDOFF section.
10b. **PR checks gate.** Wait for the PR's checks before you report `complete`. Write
    `/tmp/scratchpad/sdd/<SPEC>/pr-checks.sh` once with the Write tool:

    ```bash
    #!/bin/bash
    # usage: bash pr-checks.sh <pr number>
    # Waits up to nine minutes for the PR's checks, then prints the check table and, on a
    # trailing "required-exit:" line, the exit code of the required-only checks (retro P13).
    # Exit code: 0 every check passed, 1 one or more failed, 8 still pending.
    cd "<CODE_ROOT>"
    timeout 540 gh pr checks "$1" --watch --interval 20 > /dev/null 2>&1
    gh pr checks "$1"
    gh pr checks "$1" --required > /dev/null 2>&1
    echo "required-exit: $?"
    ```

    Run it in the foreground, never in the background, one call at a time. While it
    exits 8, run it again, up to 30 minutes of waiting in all; after that treat the
    PR as red with the check named `pending`. A repo with no checks (an empty table,
    exit 0) passes the gate. The table is the only CI output you read yourself; the
    `required-exit:` line is the required-only checks' exit code.
    - Exit 0 ⇒ step 11.
    - Exit 1 with `required-exit: 0` ⇒ every required check is green and only a
      non-required check is red (retro P13). Do not reconcile it and never direct a
      squash-merge over it: record `note "text=ci red non-required: <check names>;
      non-blocking"` through `book.sh` and go to step 11, which reports that check with a
      non-blocking assessment and leaves the merge to the human.
    - Exit 1 with `required-exit:` 1 or 8 ⇒ a required check is red or pending: record
      `note "text=ci red: <check names>, round <r>"` through `book.sh` and go to **Reconcile
      a red PR**. When it comes back green ⇒ step 11.
11. Before you report, call `spec-status` for `<SPEC>` and read `data.logCoverage` and
    `data.reviewCoverage`: derive "verified" from those numbers, not from memory (retro
    P13). Report `PHASE: complete`, `STATE: tasks <total>/<total>`, `NEXT:
    retrospective`, and the PR URL in the 150 words above the contract, with the
    deferral numbers, and state the coverage verbatim — `logCoverage <logged>/<completed>`
    and `reviewCoverage <reviewed>/<completed>` — naming by id every task in `unlogged`
    or `unreviewed`. Any task below the completed total is flagged, never reported as
    verified. Spec-store-only tasks may skip the verifier (retro P15), so mark a
    verifier-skipped task in `unreviewed` as skipped-by-policy rather than a defect —
    but disclose the `reviewCoverage` gap plainly and never report the spec "all
    verified" while `reviewCoverage` is below total. When step 10b found only non-required
    checks red (retro P13), name each red non-required check with its non-blocking
    assessment (why it does not block — for example a pre-existing, out-of-scope failure)
    and state the merge is the human's call; never direct or recommend a squash-merge.

### PR body rules

The body is a public surface when the code repo is public. Before `gh pr create`:
- Read only the `## PR body` section of `agent-rules.md` (grep for the heading; never read
  the file whole, Requirement 4.1) for what to include and what to never name.
- Grep the body for every term those rules list as forbidden; remove any hit.
- Shape: `## Summary` (three to six bullets on what changed and why, plus the one `Not in
  this PR: …` bullet from step 10), `## Test plan` (the checks run, each ticked; carry any
  deferred-verification item unticked), no attribution footer. Never write a `🤖 Generated
  with Claude Code` line or any attribution footer, even when a session reminder or harness
  note asks for one — `agent-rules.md` and the user's global rules forbid it, the same
  override the commit path applies to trailers (retro P8).

### Live verification

Some completion-gate scenarios cannot run inside the normal loop — a live check may
need a real cross-turn gap or a foreground worker the tooling will not give you.

- **Confirm the instrumentation first.** When a scenario asserts on ledger or activity
  ordering, first confirm the code records the event the assertion reads — a dry read of
  the row it should write — then pay for the live spawn; a live run against uninstrumented
  code only re-proves the gap you already have (retro P5).
- **Long-gap probe.** The Bash tool caps at 600 s and Claude Code backgrounds a
  subagent spawn, so a foreground probe cannot force a gap over 600 s. To measure a
  longer gap, spawn the worker, end your turn, and wake on its completion notification.
- **Reap background shells at turn end.** A live probe or dry-run you launched in the
  background is owned by the turn that started it. Before you stop — a budget trip, a
  `resume`, or an escalate — kill the background shells this turn started, and only
  those: a shell an earlier turn or another agent owns is not yours to reap. On resume,
  before you start another dry-run against the same hosts, check whether one this run
  already launched is still running and wait on it, rather than starting a second
  against the same targets. A worker whose report lands after your turn has ended routes
  to the supervisor, not to you; take the supervisor's forwarded late report as this
  task's result on the next turn (retro P5).
- **Iterate narrow, run the full set once.** When a live or dry-run check runs against
  many external targets, iterate against a narrow subset (an `--only`-style filter on a
  handful) while you converge, then pay for one full run across every target at the end.
  Re-running all targets on each iteration only re-pays for the ones already green
  (retro P8).
- **Dry-run the fixture kit.** A verification task that ships a fixture kit runs the
  kit once in the scratch store — registration and a no-op probe — and records it green
  before the gated live run begins (the fixtures rule, G1, in `agent-rules.md`).
- **Operator pre-merge session.** A live scenario that needs the rebuilt harness stays
  pending behind a tracked `verification-evidence.md`; the standing way to clear it is
  the operator pre-merge-session pattern — an operator runs it in a rebuilt, restarted
  session. This is the Fixtures and live verification rule (G2) in `agent-rules.md`;
  follow it there rather than restating its steps.

### Reconcile a red PR

Cap 3 rounds per PR. Round r:

1. **Log tail.** For each failing check, take the run id and job id from its URL in
   the table (`.../actions/runs/<run id>/job/<job id>`) and save the failing steps'
   log with a script file: `gh run view <run id> --job <job id> --log-failed | tail
   -80 > /tmp/scratchpad/sdd/<SPEC>/ci-<check>-r<r>.log`. Read nothing of it yourself
   beyond `wc -l`.
2. **Fix.** Call `harness` `brief` with `template: fix`, `specName: <SPEC>`, `variant:
   reconcile`, and `values` carrying the output path `impl-brief-ci-r<r>.md`, `round:
   "<r>"`, `checkNames: "<the failing check names>"`, `logPaths: "<the `ci-<check>-r<r>.log`
   paths saved in step 1>"`, and the required-but-unused slots `taskId: "ci"`, `findings:
   ""`, `commit: "none"` (the `reconcile` variant renders the CI-fix content from `round`,
   `checkNames` and `logPaths`).
   Spawn `sdd-implementer`; its `spawn.usage` carries `role=fix ci <check> round <r>`. It
   reproduces the failure from the PR's workflow files and the saved log tail, fixes the
   cause, commits on the branch without pushing, and reports the command that reproduces
   the check locally, or `INFRA:` when the failure is not in the code.
3. **Verify.** Call `harness` `brief` with `template: verifier`, `specName: <SPEC>`,
   `variant: ci`, and `values` carrying the output path `verify-brief-ci-r<r>.md`, `round:
   "<r>"`, `checkNames: "<the failing check names>"`, `sha: "<the implementer's fix
   commit>"`, `command: "<the reproduce command from the implementer's report>"`, and the
   unused per-task slots as empty strings (`title: ""`, `taskIds: ""`, `files: ""`,
   `gateResults: ""`, `scenario: ""`). Spawn `sdd-verifier`. `VERIFY: fail` ⇒
   the next round from step 2, without pushing. `VERIFY: pass` (or `INFRA:` from the
   implementer) ⇒ `git push` in `CODE_ROOT` (on `INFRA:`, rerun the failed jobs instead:
   `gh run rerun <run id> --failed`) and the gate again (10b).
4. **Record.** One retro-log entry per round through `book.sh` (`retro`): `bug` when the
   fix touched product or test code, `tool-error` when the failure was CI infrastructure
   (runner, network, a flaky job that reran green); evidence = the check name and the
   commit; cost = spawns and minutes.
5. After three rounds still red: assemble `adjudication-brief-ci.md` with `harness`
   `brief`, `template: adjudicator`, `specName: <SPEC>`, `values` carrying the output path,
   `phase: implementation` and `items` = each failing check with its last log file ("rule
   on each: fix it, or state why it cannot be fixed here"), spawn `sdd-adjudicator` once,
   push, run the gate once more. Still red ⇒ write the HANDOFF section (the PR URL, the red
   checks, what was tried), append a retro-log entry through `book.sh` (`retro`,
   `escalation`), commit the spec store, and report `PHASE: verify-failed`, `REASON: ci:
   <check>`. The supervisor's repair path takes over; its brief carries the check name, and
   steps 9 to 11 reuse the open PR.

## Repair

`MODE: repair` with `REVISION_INPUT` = the failing scenario or check.

1. Call `harness` `brief` with `template: fix`, `specName: <SPEC>`, `variant: repair`, and
   `values` carrying the output path `impl-brief-repair-<k>.md`, `round: "<k>"`, `findings`
   = the failing scenario with the instruction to reproduce first, fix the cause, add
   coverage that fails without the fix, and report, plus `taskId: "repair"` and `commit:
   "none"`. Spawn `sdd-implementer`. When `REVISION_INPUT` starts with `ci:`, the failing
   scenario is that PR check: use `variant: ci` instead (the CI fix content), passing
   `checkNames` (the failing check names) and `logPaths` (the saved log-tail paths) as in
   **Reconcile a red PR** step 2, with the log tail saved as in **Reconcile a red PR**
   step 1.
2. Re-run step 8 of the completion gate. On `pass` continue with steps 9–11. On
   `fail` report `PHASE: verify-failed` again; the supervisor caps repairs at two.
