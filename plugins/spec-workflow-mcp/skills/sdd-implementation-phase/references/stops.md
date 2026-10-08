# Implementation-phase stops and resume recovery

The core skill routes here: to **Resume recovery** on a Step 0 `nextStep` of
`Per-task loop: resume task <N>`; to **Design defect** on a `DESIGN-DEFECT` from the
implementer or a `SEAM-DEFECT`/all-criteria `RED-IMPOSSIBLE` from the test author (step
1b, except a finding-driven already-compliant case, which step 1b routes implementer-only —
see **Design defect**); to **Escalate** on an `ESCALATE:` flag; and to **Stop conditions
and their reports**
for any stop other than Budget. All bookkeeping — ledger rows, retro entries, the HANDOFF
State row and spec-store commits — goes through `book.sh` as the core skill's
**Bookkeeping** rule describes. Every stop writes the HANDOFF section and commits the spec
store first.

## Design defect

The implementer says the task cannot be built as written because it contradicts the
design, the requirements or a decomposition assumption; or, on a marked task, the test
author (step 1b) reported `SEAM-DEFECT` or `RED-IMPOSSIBLE` for every criterion, in which
case no implementer runs. (A finding-driven task whose every criterion is `RED-IMPOSSIBLE`
because the shipped code already satisfies it is already-compliant, not defective — step 1b
routes it implementer-only, not here, retro F6/F17.) Do not force it. Revert the
task to `[ ]` (`book.sh` `check <N> todo`). Append a retro-log entry through `book.sh`
(`retro`, `deviation`, the defect in one sentence, evidence = task N). Write the HANDOFF
section and commit the spec store (`book.sh`). Report
`PHASE: design-defect`, `STATE: tasks <done>/<total>`, `REASON: <the defect, one line,
from the flag — the author's when step 1b raised it, else the implementer's>`. The
supervisor re-opens design.

## Escalate

The implementer says a task's own instructions make a measured outcome need a human
ruling before any later task runs — a failed vendor probe, not a design contradiction.
Do not force it. Revert the task to `[ ]` (`book.sh` `check <N> todo`). Append a retro-log
entry through `book.sh` (`retro`, `escalation`, the flag's line, evidence = task N). Write
the HANDOFF section and commit the spec store (`book.sh`). Report `PHASE: escalate`, `STATE:
tasks <done>/<total>`, `REASON: <the flag's line>`. The supervisor already stops on it.

## Resume recovery

A 429/credit interruption mid-review is resumable: re-run only the interrupted spawn. A gate
that already passed, and author or implementer commits already made, are intact — never redo
committed work on resume (retro G3). The steps below reconcile the resumed task against those
commits rather than re-running them.

An `[-]` task resumed from Step 0 may already carry a worker's commit even though its report
never reached you: the worker finished after your previous turn ended, so its report routed
to the supervisor, not to you. The plugin hook persists every worker's final report to the
ledger as a `spawn.report`, and `orient` returns the undrained ones — those with no matching
`spawn.usage` — as `data.inFlightReports` (retro P4).

1. **Drain first.** For each report in `data.inFlightReports`, treat it as that worker's
   report arriving now: it belongs to the resumed `[-]` task (work is sequential). Record its
   `spawn.usage`, then route it through Step 3 onward (log check, then Step 4 gate, verify,
   complete) exactly as if the Agent tool had just returned it — before you spawn any new
   worker. A drained report needs no reconcile.
   When `data.inFlightReports` is empty but the resumed task is `[-]` — a worker was in
   flight — a force-handed-back report may still be landing: it routes to the supervisor
   session and the hook persists it as a `spawn.report` a moment later. Hold a short drain
   window before concluding there is nothing to drain — wait briefly, then call `orient`
   once more; if a report now appears, drain it as above. Only when that second `orient`
   still returns none do you fall to Step 2, and never spawn a second worker for a `[-]`
   task before this re-check (retro P7).
2. **Reconcile only when drain finds nothing.** When the resumed `[-]` task has a commit but
   `data.inFlightReports` holds no report for it (an older run before persistence, or a report
   the hook could not capture), treat a commit with no matching worker report as ambiguous
   state, not unfinished work. Check the code repo for a commit that implements the resumed
   task (`git -C <CODE_ROOT> log`, the same read Step 1b makes for the author commit), then:
   - **A commit exists, no report ⇒ reconcile, do not re-implement.** Spawn one
     `sdd-implementer` with a brief that says the task is already committed at `<sha>`, that it
     must confirm the commit satisfies the task and call `log-implementation` naming that
     commit, and that it must change no code; then gate and verify from Step 4 as usual.
   - **No commit ⇒** resume the task from Step 2 as a normal implement.

## Stop conditions and their reports

Record `phase.end phase=implementation result=<PHASE value> "state=tasks <done>/<total>"
"note=<one line>"` through `book.sh` (`event`) right before the report. `result=` is the
PHASE value from the table below — `complete` at a clean batch end, otherwise the real
stop outcome — never the `phase=` stage name and never empty.

| Condition | PHASE | REASON |
| --- | --- | --- |
| Every task `[x]`, gate passed, INDEX regenerated, HANDOFF written, PR opened, checks green | `complete` | — |
| Budget reached with open tasks | `resume` | — |
| Implementer flagged a design defect | `design-defect` | the defect |
| Implementer flagged an escalate | `escalate` | the flag's line |
| Gate failed, or the PR stayed red after three reconcile rounds and an adjudication | `verify-failed` | the failing scenario, or `ci: <check>` |
| `tasks.md` not approved, drift, a tool error you cannot route around | `error` | the cause |

Every stop writes the HANDOFF section and commits the spec store first.
