# SDD harness formats

Every file in this list is a contract. Do not change field names or order.

## Verdict block

Every adversarial analysis ends with this block. The reviewer fills it in; the
orchestrator reads only this block from the analysis file.

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires `MUST_FIX = 0` and `SHOULD_FIX = 0`. An `iterate` verdict with
`MUST_FIX = 0` and `SHOULD_FIX = 0` (MINOR only) is treated as converged: MINOR
findings do not produce a new version.

## Orchestrator report contract

The last lines of every orchestrator's final message. At most 150 words above it,
never file contents.

```
PHASE: approved | complete | resume | escalate | design-defect | verify-failed | error | retro-ready
SPEC: <slug>
STAGE: requirements | design | tasks | implementation | retrospective
STATE: v<N> | tasks <done>/<total> | n/a
NEXT: <one line: what a re-spawn does next>
REASON: <one line, required for escalate, design-defect, verify-failed, error>
```

Meaning of `PHASE`:

| Value | Who emits it | Supervisor action |
| --- | --- | --- |
| `approved` | document orchestrator | Write a HANDOFF row; continue to the next phase. |
| `complete` | implementation orchestrator | Write a HANDOFF row; continue (retrospective). |
| `resume` | any | Budget spent, phase mid-flight. Spawn a fresh orchestrator for the same phase. |
| `escalate` | any | Stop. Print the reason. Headless: write it to HANDOFF and exit. |
| `design-defect` | implementation orchestrator | Re-open design with the defect as revision input; then tasks in revision mode; then resume implementation. At most two loops per spec. |
| `verify-failed` | implementation orchestrator | Spawn the implementation orchestrator in repair mode. At most two repairs. |
| `error` | any | Stop and report. |
| `retro-ready` | retro orchestrator | Run the retrospective conversation. |

## HANDOFF phase row

One per phase transition, written by the supervisor into the `## Phase log` table
under the routing header of `HANDOFF.md`.

```
| <ISO date> | <spec> | <stage> | <state> | <PHASE value> | <one-line note> |
```

The table header, created when missing:

```
## Phase log

| Date | Spec | Stage | State | Result | Note |
| --- | --- | --- | --- | --- | --- |
```

## HANDOFF routing header

The first block of `HANDOFF.md`, owned by the supervisor. Rewritten at every stop.

```
> **READ FIRST — SDD routing (<ISO date>, harness v4).** Active spec **`<spec>`**.
> Live phase **<stage>**, state **<state>**, last result **<PHASE value>**.
> Roots: spec store `<spec store root>`, code `<code root>`<, worktree of `<main checkout>`>.
> A re-run does: <one line>.
```

Orchestrators own one `## <spec> — <stage>` section each, placed after the phase
log. They never touch the header or the table.

## Retro-log entry

Append-only, one per event, in `.spec-workflow/specs/<spec>/retrospective-log.md`.
The first orchestrator that runs for a spec creates the file with the heading
`# Retrospective log — <spec>`.

```
## <ISO timestamp> · <stage> · <vN | task N | phase> · <category>
<what happened, one to three sentences>
Evidence: <path, approval id, commit, or analysis section>
Cost: <rounds, minutes, spawns, or "unknown">
Fix idea: <optional one line>
```

Categories: `gotcha`, `bug`, `tool-error`, `mcp-deficiency`, `harness-defect`,
`misunderstanding`, `inefficiency`, `doc-gap`, `model-behaviour`, `ruling`,
`escalation`, `cleanup`, `deviation`.

## Worker report

150 words or fewer. The last thing a worker agent says.

- Files touched, one line each.
- Checks run and their result.
- `logged: yes/<taskId>` where applicable.
- Flags, one per line, only when they apply:
  `DESIGN-DEFECT: <one line>`, `AFFECTS-FUTURE-SPECS: <one line>`,
  `RETRO: <category> — <one line>`, `SPEC-SIZED: <one line>`, `NEW-FINDING: <one line>`.
- Verdict line for reviewers and verifiers: `VERDICT: pass | fix-required` or
  `VERIFY: pass | fail`.
- No diffs, no file contents, no test output beyond a one-line summary.

## Approval response

The `response` given to `approvals approve` on the final version:

```
v<N>; <rounds> review rounds; final verdict MUST_FIX <m> / SHOULD_FIX <s> / MINOR <k>; rulings: <none | list>; cap: <not hit | hit, adjudicated at v10, VERIFIED k/n>
```

## Status line

Printed by the supervisor at every stop:

```
<project>:<spec> <phase> <state> — <one line>
```

`<project>` is the basename of the code root's main checkout.
