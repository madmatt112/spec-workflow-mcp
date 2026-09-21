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
PHASE: approved | gate-a | complete | closed | resume | escalate | design-defect | verify-failed | error | retro-ready
SPEC: <slug>
STAGE: requirements | design | tasks | implementation | retrospective | closeout
STATE: v<N> | tasks <done>/<total> | items <done>/<total> | n/a
NEXT: <one line: what a re-spawn does next>
REASON: <one line, required for escalate, design-defect, verify-failed, error>
```

Meaning of `PHASE`:

| Value | Who emits it | Supervisor action |
| --- | --- | --- |
| `approved` | document orchestrator | Write a HANDOFF row; continue to the next phase. |
| `gate-a` | document orchestrator | Run gate A, then re-spawn requirements. |
| `complete` | implementation orchestrator | Write a HANDOFF row; continue (retrospective). |
| `closed` | close-out orchestrator | Write a HANDOFF row; the spec is finished. |
| `resume` | any | Budget spent, phase mid-flight. Spawn a fresh orchestrator for the same phase. |
| `escalate` | any | Stop. Print the reason. Headless: write it to HANDOFF and exit. |
| `design-defect` | implementation orchestrator | Re-open design with the defect as revision input; then tasks in revision mode; then resume implementation. At most two loops per spec. |
| `verify-failed` | implementation orchestrator | Spawn the implementation orchestrator in repair mode. At most two repairs. |
| `error` | any | Stop and report. |
| `retro-ready` | retro orchestrator | Run the retrospective conversation, then the close-out phase. |

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

The `<ISO timestamp>` is the output of `date -u +%Y-%m-%dT%H:%M:%SZ`, run when you
append; never typed from memory.

Entries are appended with `retro.sh`, never by hand — which is why every skill's
"append a retro-log entry" step names it. The script sits next to `event.sh` at
`/tmp/scratchpad/sdd/<spec>/retro.sh`, written once per run (Write tool) with the spec
dir filled in. It stamps the time itself and refuses an empty argument:

```bash
#!/bin/bash
# usage: bash retro.sh "<stage>" "<vN | task N | phase>" "<category>" "<body>" "<evidence>" "<cost>"
export SDD_RETRO_LOG="<spec dir>/retrospective-log.md"
[ "$#" -eq 6 ] || { echo "retro.sh: need 6 arguments" >&2; exit 2; }
for a in "$@"; do [ -n "$a" ] || { echo "retro.sh: empty argument" >&2; exit 2; }; done
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
{
  printf '\n## %s · %s · %s · %s\n' "$ts" "$1" "$2" "$3"
  printf '%s\nEvidence: %s\nCost: %s\n' "$4" "$5" "$6"
} >> "$SDD_RETRO_LOG"
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
v<N>; <rounds> review rounds; final verdict MUST_FIX <m> / SHOULD_FIX <s> / MINOR <k>; rulings: <none | list>; cap: <not hit | hit, adjudicated at v<N>, VERIFIED k/n>
```

## Status line

Printed by the supervisor at every stop:

```
<project>:<spec> <phase> <state> — <one line>
```

`<project>` is the basename of the code root's main checkout.

## Run ledger (`harness-events.jsonl`)

Every run appends events to `<spec dir>/harness-events.jsonl`, one JSON object per line.
`spec-workflow-mcp --watch <spec store repo>` renders it live, together with the activity
file the plugin's hooks write (`harness-activity.jsonl`: agent start and stop, tokens, and
one line per tool call of every `sdd-*` agent). Both files are committed with the spec store
at each checkpoint; they are the run's history.

Events are written with the event script, never by hand. The supervisor writes the script
once per run at `/tmp/scratchpad/sdd/<spec>/event.sh` (Write tool) and appends this run's
line to the pointer file `${XDG_STATE_HOME:-~/.local/state}/sdd/active-run` — one
tab-separated line `<main checkout>\t<spec dir>\t<run id>` per active run, which is what
lets the hooks match each run by the prefix of its cwd. Orchestrators call the script; the launch prompt
carries its path as `EVENT_SCRIPT`. An orchestrator reuses that `EVENT_SCRIPT`; it never writes a new run id.

```bash
#!/bin/bash
# usage: bash event.sh <type> key=value ...   (values may contain spaces; quote them)
export SDD_LEDGER="<spec dir>/harness-events.jsonl"
export SDD_RUN="<run id>"
export SDD_SPEC="<spec>"
node -e '
const [type, ...kv] = process.argv.slice(1);
const e = { ts: new Date().toISOString(), run: process.env.SDD_RUN, spec: process.env.SDD_SPEC, type };
for (const a of kv) { const i = a.indexOf("="); if (i > 0) e[a.slice(0, i)] = a.slice(i + 1); }
require("fs").appendFileSync(process.env.SDD_LEDGER, JSON.stringify(e) + "\n");
' "$@"
```

Run id: `run-<YYYYMMDD>-<HHMMSS>` (UTC) chosen by the supervisor at start.

| Type | Written by | Keys |
| --- | --- | --- |
| `run.start` | supervisor | `model`, `specStore`, `codeRoot`, `worktree` (yes/no), `headless` (yes/no) |
| `run.end` | supervisor | `status` (the status line) |
| `phase.start` | orchestrator, at Step 0 | `phase` (also `closeout`), `mode`, `budget`, `state` (v<N>, tasks a/b or items a/b at entry) |
| `phase.end` | orchestrator, before its report | `phase`, `result` (the PHASE value), `state`, `note` (one line) |
| `spawn.start` | plugin hook (`PreToolUse`) for a brief-launched worker; supervisor for an orchestrator | `agent` (e.g. `sdd-reviewer`); `role` — the coarse label the hook takes from the brief filename for a worker, or `<phase> phase, spawn <n>` from the supervisor for an orchestrator |
| `spawn.end` | plugin hook (`SubagentStop`) for every `sdd-*` agent | `agent`, `input`, `output`, `cacheWrite`, `cacheRead`, `tokens` (digits or `unknown`), `model` |
| `spawn.usage` | supervisor for an orchestrator, orchestrator for a worker | `agent`, `role` (precise, e.g. `review v3`, `implement task 13`, `verify task 13`, `fix ci e2e round 1`, `implement harness batch 1`), `result` (VERDICT / VERIFY / logged line), `phase`, `task` or `round`; no `tokens` |
| `round` | document orchestrator | `phase`, `round`, `verdict` (`iterate 1/1/3` or `converged 0/0/1`), `version` |
| `task.pick` | implementation or close-out orchestrator | `task` (`<N>` or `P<n>`), `title` |
| `task.done` | implementation or close-out orchestrator | `task`, `rounds` (implementation), `outcome` (`pass`, `adjudicated`; close-out: `done`, `to-do`, `skipped`) |
| `note` | any | `text` (rulings, escalations, deviations) |

The supervisor writes `spawn.start` and `spawn.usage` for each orchestrator it spawns
(`agent=sdd-document-orchestrator`, `role=design phase, spawn 2`, `result=<PHASE value>`);
the hook writes each orchestrator's `spawn.end`.

## Run deregister (`deregister.mjs`)

At `run.end` the supervisor removes this run's line from the shared pointer file
`${XDG_STATE_HOME:-~/.local/state}/sdd/active-run`. Concurrent runs in other checkouts
keep their own lines there, so the removal must read, filter and rewrite the file in
Node — never a shell `grep -v`, which even under `rtk proxy` can splice a command
summary into a file another session shares. The supervisor writes this script once per
run with the Write tool under its `helpers/` dir (so the document-phase cleanup never
removes it) and calls it as
`node /tmp/scratchpad/sdd/<spec>/helpers/deregister.mjs <pointer path> <run id>`.

```js
#!/usr/bin/env node
// deregister.mjs — drop this run's line from the shared active-run pointer,
// filtering and rewriting in Node (no shell `grep -v`). It matches on the run id
// in the third tab-separated field and writes atomically via a temp file + rename.
// usage: node deregister.mjs <pointer path> <run id>
import { readFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
const [pointer, runId] = process.argv.slice(2);
if (!pointer || !runId) { console.error('usage: node deregister.mjs <pointer> <run id>'); process.exit(2); }
let lines;
try {
  lines = readFileSync(pointer, 'utf-8').split('\n').filter((l) => l.length > 0);
} catch { process.exit(0); } // no pointer file: nothing to remove
const kept = lines.filter((l) => l.split('\t')[2] !== runId);
if (kept.length === 0) {
  rmSync(pointer, { force: true });
} else {
  const tmp = `${pointer}.${process.pid}.tmp`;
  writeFileSync(tmp, kept.join('\n') + '\n');
  renameSync(tmp, pointer); // atomic replace on the same filesystem
}
console.log(`deregister: removed ${lines.length - kept.length}, kept ${kept.length}`);
```
