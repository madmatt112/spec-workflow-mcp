---
name: sdd-continue
description: Continue the spec-driven development (SDD) process for the active spec. A thin supervisor that resolves the spec store and code roots, finds the active spec and its live phase, spawns one phase orchestrator at a time, and runs the retrospective conversation. Use when the user says "continue the sdd process", "continue sdd", "run the sdd loop", "next sdd step", or when this skill is invoked by name.
---

# SDD supervisor

You are the supervisor of one SDD run. One run takes the active spec from wherever it
is through its retrospective conversation and the close-out of the approved plan, then
stops. The next run starts the next spec.

Rules that hold for the whole run:

- You never read spec documents. The two retrospective files in step 5 are the only
  exception. Orchestrators read documents; you read their final report lines.
- You spawn one orchestrator at a time, in the foreground, and act on its final
  `PHASE:` line. Never poll. Never pass `subagent_type: fork`.
- Never pass `projectPath` to any spec-workflow MCP tool.
- Do not ask the user anything before step 5, except the two gates — gate A on a
  `gate-a` return and gate B before the first implementation spawn — which ask only in
  `block` mode (step 4) and never stall an unattended run.
- Every stop ends with the status line from `references/formats.md`.

Formats (report contract, HANDOFF rows, retro-log entry, status line) are in
`references/formats.md` next to this file. Read it once at the start.

## 0. Preflight

1. **Model.** Your system prompt names the model you run on. If it is not Fable 5.1 or
   a newer top-tier Claude model, print exactly
   `Run /model fable and /effort xhigh, then continue` and stop.
2. **Server.** Call the spec-workflow `spec-index` tool with `action: generate`. It is
   idempotent, it proves the server answers, and its result carries the roots (step 1)
   and the routing (step 2). If the tool is not available or fails, tell the user to
   run `/mcp`, check the `spec-workflow` server, and stop.
3. **Agents.** Look at the agent types available to your Agent tool. Find one whose
   name ends in `:sdd-reviewer`. The part before the colon is the **agent prefix**
   (for example `spec-workflow-harness`). If none exists, print
   `Install the spec-workflow-harness plugin (docs/SDD-HARNESS.md), then continue`
   and stop. Every orchestrator gets the prefix in its launch prompt; skills never
   hardcode it.
4. **Plugin freshness.** This skill's base directory holds `references/harness-source.sh`.
   Run `bash <base dir>/references/harness-source.sh`. It prints `source: <path | none>`
   (the local marketplace checkout the plugin was installed from, when there is one) and
   `drift: yes | no | unknown`. On `yes`, print one line and continue:
   `warning: the installed plugin differs from <source>/plugins/<plugin>; refresh it
   (uninstall, then install at this scope) unless that is intended`. Keep the `source`
   value: it is `HARNESS_REPO` in every launch prompt.

## 1. Roots (workspace contract v2)

- **Spec store root** = `projectContext.workflowRoot` from the `spec-index` result.
  It ends in `.spec-workflow`. Its parent is the **spec store repo root**.
- **Code root** = the current working directory.
- **Worktree check.** Run `git rev-parse --path-format=absolute --git-common-dir` and
  `git rev-parse --path-format=absolute --git-dir`. If they differ you are in a
  worktree; the main checkout is the common dir with the trailing `/.git` removed.
- **Fallback.** Only when the result carries no `workflowRoot`: the spec store root is
  `<main checkout>/.spec-workflow`.
- Every `.spec-workflow/...` path resolves against the spec store root.
- **HANDOFF** is `<spec store root>/HANDOFF.md` if it exists, else
  `<spec store repo root>/HANDOFF.md`. You commit your own HANDOFF edits (step 4).
- **Agent rules** are `<spec store root>/agent-rules.md`, optional. Note whether the
  file exists; pass its path to every orchestrator.

Say which roots you resolved in the handoff line (step 6).

**Run ledger.** Once the roots and the active spec are known (after step 2), start the
run's ledger as `references/formats.md` describes: choose a run id
(`run-<YYYYMMDD>-<HHMMSS>` UTC), write `/tmp/scratchpad/sdd/<spec>/event.sh` with the
Write tool (the script text is in formats.md, with the spec dir, run id and spec filled
in), append this run's line to the pointer file
`${XDG_STATE_HOME:-~/.local/state}/sdd/active-run` — one tab-separated line per active run,
`<main checkout>\t<spec dir>\t<run id>`, so concurrent runs in other checkouts keep their
own lines — then `bash <event.sh> run.start model=<your model>
specStore=<root> codeRoot=<cwd> worktree=<yes|no> headless=<yes|no>` (`headless=yes` when
the AskUserQuestion tool is not available to you). Every spawn below is bracketed with
`spawn.start` / `spawn.end` events, and every stop ends with `run.end`.

## 2. Active spec

Use the `routing` field of the `spec-index` result (the same data as INDEX.md's
`## Next`):

- `active` ⇒ `routing.spec` is the active spec.
- `ambiguous` ⇒ report the candidates and stop. Do not pick one.
- `all-on-disk-complete` ⇒ first look for a finished spec whose retrospective is not
  closed: for every `<spec store root>/specs/<name>/` that has a `retrospective-log.md`,
  read the `Status:` line of its `retrospective-plan.md` (`grep -m1 '^Status:'`). A spec
  with no plan file, or a plan `DRAFT` or `APPROVED`, is still active: its retrospective
  or close-out is pending. Take the first such spec in INDEX order as the active spec and
  go to step 3. A plan `CLOSED`, or no retrospective log, means finished. Only when no
  spec is pending, apply the next rule.
- `all-on-disk-complete` with nothing pending, `no-specs` or `all-deferred` ⇒ not roadmap
  completion: specs are created lazily, so the next spec may have no directory yet. Read
  `<spec store root>/spec-decomposition/decomposition.md` and find the first spec named
  there (in order of first mention; a heading like `## 1. \`greeting-languages\`` or a
  slug in backticks) with no `<spec store root>/specs/<name>/` directory and no deferred
  marker. That spec is active and starts at requirements. If there is none: with
  `all-on-disk-complete` the roadmap is complete; with `no-specs` there is nothing to
  build; with `all-deferred` everything is deferred. Report which and stop.
- Any `routing.warnings` ⇒ print them; do not route past them silently.

Deferred specs are never active. If the result has no `routing` field (old server),
apply the same rule by hand from INDEX.md's tables: first not-Complete spec under
`## Active`; then a single started spec under `## Other specs`; then the
decomposition fallback. Never pick by table order.

## 3. Live phase

Call `spec-status` once for the active spec. Read `overallStatus`, the three document
entries in `phases` (`approved`, `approvalStatus`, `approvalId`) and `taskProgress`.
Apply these rules in order; the first match wins.

1. `overallStatus == completed` and `specs/<spec>/retrospective-log.md` exists and
   `specs/<spec>/retrospective-plan.md` either does not exist or has
   `Status: DRAFT` ⇒ phase **retrospective**. With an existing `retrospective.md` and
   `retrospective-proposals.md`, skip the orchestrator and go straight to step 5.
2. `overallStatus == completed` and `retrospective-plan.md` has `Status: APPROVED` ⇒
   phase **closeout**: the approved plan is implemented before the next spec starts.
3. `overallStatus == completed` otherwise (`Status: CLOSED`, or no retrospective log:
   specs completed before this harness have no retrospective) ⇒ the spec is finished.
   Report and stop.
4. Requirements missing or not approved ⇒ document phase **requirements**.
   **Gate-A resume recheck.** Before dispatching this phase, if
   `specs/<spec>/questions.md` exists and holds a `## Gate A` receipt whose decisions are
   still unanswered (every `answer:` line empty), gate A was emitted but never resolved —
   an interrupted run. Run the **Gate A** procedure (step 4) now to resolve it (ask in
   `block` mode or fall to `record`) exactly as for a fresh `PHASE: gate-a`; that
   procedure re-spawns the requirements orchestrator itself, so do not also dispatch
   `MODE: normal` straight to round 1 (Req 2 AC 7). An answered receipt ⇒ dispatch
   requirements normally. **No receipt, but a v1 draft.** If no `## Gate A` receipt is
   present yet `specs/<spec>/requirements.md` (or a `docs(sdd): <spec> requirements v1`
   checkpoint) exists and gate A is unresolved, an interrupt landed after the v1
   checkpoint but before the gate emit: run the **Gate A** procedure now instead of a
   normal re-dispatch, so v1 lint and gate A are not skipped. Only with no v1 draft at
   all ⇒ dispatch requirements normally.
5. Design missing or not approved ⇒ document phase **design**.
6. Tasks missing or not approved ⇒ document phase **tasks**. Exception: if
   `taskProgress.completed > 0` or `taskProgress.inProgress > 0`, implementation began
   under the old convention. Treat tasks as approved, append a retro-log entry with `retro.sh`
   (category `deviation`, "tasks treated as approved: implementation had begun"), and
   go to rule 7.
7. Otherwise ⇒ **implementation**.

Revision input: when the live document's `approvalStatus` is `needs-revision`, a human
used the dashboard between runs. Call `approvals` `status` on that `approvalId` once,
take `response`, `annotations` and `comments`, and pass them to the document
orchestrator as revision input.

If `spec-status` reports the spec as not found, the spec is new: document phase
**requirements**.

Before dispatching implementation, call the spec-workflow `harness` tool with
`action: phase-log` for the active spec. It regenerates this spec's `## Phase log`
rows from the run ledger, including an `interrupted` row for any earlier phase whose
`phase.start` never got its `phase.end` — the interrupted-run case an earlier
supervisor used to detect from the State row and stamp by hand.

## 4. Dispatch loop

Spawn the orchestrator for the phase with the Agent tool, foreground, no `model`
parameter, `subagent_type` = `<prefix>:<agent>`:

| Phase | Agent |
| --- | --- |
| requirements / design / tasks | `sdd-document-orchestrator` |
| implementation | `sdd-implementation-orchestrator` |
| retrospective | `sdd-retro-orchestrator` |
| closeout | `sdd-closeout-orchestrator` |

The launch prompt contains, one line each:

```
SPEC: <slug>
PHASE: <requirements | design | tasks | implementation | retrospective | closeout>
MODE: <normal | revision | repair>
SPEC_STORE_ROOT: <path ending in .spec-workflow>
SPEC_STORE_REPO: <its parent>
CODE_ROOT: <cwd>
MAIN_CHECKOUT: <path, or "same as CODE_ROOT">
WORKTREE: <yes | no>
HANDOFF: <path>
AGENT_RULES: <path | none>
AGENT_PREFIX: <prefix>
HARNESS_REPO: <the preflight's source path | none>
EVENT_SCRIPT: /tmp/scratchpad/sdd/<spec>/event.sh
BUDGET: <4 review rounds | 20 tasks | all items | n/a>
REVISION_INPUT: <none | the text, verbatim>
```

followed by the report contract from `references/formats.md`, verbatim, and the line
`Report exactly in that contract. Never paste file contents.`

Before each spawn: `bash <event.sh> spawn.start agent=<agent> "role=<phase> phase, spawn <n>"
phase=<phase>`. After the report: `bash <event.sh> spawn.end agent=<agent> "role=…"
result=<PHASE value> tokens=<n>`, where `<n>` is the token count the Agent result
states in its footer (omit `tokens` only when it states none).

Act on the final `PHASE:` line of the orchestrator's report:

- `approved` or `complete`: call the spec-workflow `harness` tool with
  `action: phase-log` for the spec, which regenerates this spec's `## Phase log` rows
  from the ledger's `phase.end` events. Go back to step 3 for the next phase (call
  `spec-status` again).
- `closed`: call `harness` `phase-log` for the spec (the ledger's `closeout` `phase.end`
  supplies the `closed` row). The spec is finished: rewrite the routing header (a re-run
  starts the next spec), print the PR URLs and to-dos the orchestrator reported, and stop.
- `resume`: call `harness` `phase-log` for the spec, then spawn a fresh orchestrator for
  the same phase with the same prompt.
- `escalate`: write a HANDOFF row, print the `REASON:` line, and stop. Headless (no
  human can answer): the row is the record; exit.
- `design-defect`: write a HANDOFF row. Spawn `sdd-document-orchestrator` for `design`
  with `MODE: revision` and `REVISION_INPUT` = the `REASON:` text. After it reports
  `approved`, spawn `sdd-document-orchestrator` for `tasks` with `MODE: revision` and
  `REVISION_INPUT: re-validate every task against the new design; at least one review
  round`. After that reports `approved`, resume implementation. At most two
  design-defect loops per spec; the third is an `error`.
- `verify-failed`: write a HANDOFF row. Spawn `sdd-implementation-orchestrator` with
  `MODE: repair` and `REVISION_INPUT` = the `REASON:` text. At most two repair spawns;
  then stop and report.
- `error`: write a HANDOFF row, print the reason, stop.
- `retro-ready`: write a HANDOFF row, go to step 5.
- `gate-a`: run the **Gate A** procedure below. It reads the surface, writes the
  receipt, asks or records, and re-spawns the requirements orchestrator (`MODE: revision`
  on any changed decision, else `MODE: normal`); continue the dispatch loop on that
  orchestrator's report.
- Anything else, or no `PHASE:` line: treat as `error` with reason
  "orchestrator did not report in contract".

**Runaway guard.** More than 12 orchestrator spawns for one phase in this run is an
`error`.

**Gate B.** Before the first implementation spawn and before worktree entry, run the
**Gate B** procedure below once — it asks or records, runs at most one advisory
tasks-revision round, deletes slot b, and returns here. Then apply the worktree rule and
spawn implementation.

**Worktree rule.** Before the first implementation spawn: if `agent-rules.md` exists
and contains the line `worktree-per-change: required`, and the worktree check in
step 1 said `no`, enter a worktree named after the spec with the EnterWorktree tool,
then rename the branch to `feat/<spec>` (`git branch -m`). If `agent-rules.md`
carries a `worktree-setup:` line, run its command once in the new worktree. Re-run
the step 1 worktree check so the launch prompt carries the new `CODE_ROOT`. If EnterWorktree is
unavailable (headless run), the driver has already put you in a worktree; the step 1
check confirms it, and you do not enter another. Subagents inherit the worktree.

After each phase transition, rewrite the HANDOFF routing header (format in
`references/formats.md`) and commit HANDOFF in the spec store repo yourself: the
orchestrators commit only their own sections, so a header or phase row left uncommitted
is lost if the next spawn never happens. Use the commit script described in the
document-phase skill's `references/cleanup.md` (`/tmp/scratchpad/sdd/<spec>/commit-spec-store.sh`,
written with the Write tool if it does not exist yet), with the message
`docs(sdd): HANDOFF — <spec> <stage> <PHASE value>`.

### Gate mode resolution

Each gate resolves its own mode every time it runs:

- If `agent-rules.md` exists and carries a top-of-file `gates: block | record` key — the
  optional key beside `worktree-per-change`, absent by default — use that value.
- Otherwise `block` when the AskUserQuestion tool is available to you, `record` when it
  is not.
- A `block`-mode AskUserQuestion call that is unavailable, errors, or returns denied
  falls to `record` for that gate and proceeds. It never changes the run ledger's
  `headless` flag: a `dontAsk` permission rule can deny a call on an attended run, so a
  denial alone is not proof the run is unattended.

Neither gate ever stalls an unattended run: `record` always writes the questions to
`questions.md` and proceeds. Neither gate hard-blocks the spec; the only escape hatch is
stopping the run.

### Gate A

Run this on a `gate-a` return (step 4) and on the step 3 rule 4 resume recheck. You never
read the spec document — the drafter already wrote the ranked triples to the surface.

**Outcomes only.** A human gate presents only decisions the human is positioned to own —
scope, outcomes, tradeoffs with a product cost. Implementation mechanics (recording sites,
storage layout, constants, transport) are decided by the orchestrator and recorded, not
put to the human. So Gate A asks only the surface's scope, user-visible outcome and
trade-off decisions; skip any item that is a pure implementation mechanic — the agents
decided it and recorded it silently.

1. **Read the surface.** Call the `harness` tool with `action: gate`, `op: get`,
   `slot: a`, `specName: <spec>`. `data.payload.items` is up to five `GateADecision`
   `{header, question, options}`, ranked most direction-setting first; `options[0]` is the
   recorded choice, the rest are the rejected alternatives (at most four options). On
   `present: false` there is nothing to ask (should not occur after a `gate-a` return) —
   re-spawn the requirements orchestrator with `MODE: normal` and stop here.
2. **Receipt, before asking.** Write `specs/<spec>/questions.md` with a `## Gate A`
   section: one item per decision with its `question`, its `options`, and an empty
   `answer:` line. Commit it in the spec store repo with the commit script
   (`docs(sdd): <spec> gate A receipt`). Best-effort — a write or commit failure is logged
   and the run proceeds (Req 2 AC 7, Req 1 AC 5).
3. **Resolve the mode** (see **Gate mode resolution**).
4. **Block — ask.** Ask the decisions with AskUserQuestion: at most five, across at most
   two calls (four questions per call), each decision offering its `options` verbatim (at
   most four). A decision is **approve** when the reply selects `options[0]` with no
   appended free text; anything else — a different option, added free text, or both — is
   **needs revision**. If the second call is denied, errors, or times out after the first
   answered, keep the first call's answers and treat the unreturned decisions as
   `no answer`.
5. **Record the answers.** Fill each decision's `answer:` line in `questions.md` with its
   selected option and any free text (or `no answer`) and commit.
6. **Route.** If any decision needs revision, re-spawn `sdd-document-orchestrator` for
   `requirements` once with `MODE: revision` and `REVISION_INPUT` naming, per such
   decision, its new option (if changed) and its free text (if any), so `sdd-reviser`
   writes v2 covering all of them before the first review round. Otherwise re-spawn with
   `MODE: normal` to run round 1 on v1.
7. **Record mode** (AskUserQuestion absent, errored or denied, or `gates: record`): skip
   the ask, write every decision's `answer:` line as `no answer` in `questions.md`, write
   a HANDOFF `## Phase log` row (stage `requirements`, state `v1`, result `gate-a`, note
   `gate A recorded — no human`), commit both together, and re-spawn
   `sdd-document-orchestrator` for `requirements` with `MODE: normal` to run round 1 on v1
   unchanged (Req 3).

### Gate B

Run this before the first implementation spawn and before worktree entry. You never read
the spec document.

1. **Read the surface.** Call the `harness` tool with `action: gate`, `op: get`,
   `slot: b`, `specName: <spec>`. On `present: false` there is nothing to veto — skip to
   step 4 (the delete). This is the expected state on every implementation entry after the
   first, and on an annotate or design-defect re-approval, so gate B runs at most once
   (Req 5 AC 6). When present, `data.payload` is `{ tasks: [{id, title}], veto:
   VetoItem[] }` — `VetoItem` `{rank, class, taskId, summary}`, ranked most consequential
   first.
2. **Resolve the mode** (see **Gate mode resolution**).
3. **Ask or record.**
   - **Block.** Present the compact `tasks` plan and the ranked `veto` list, then ask with
     AskUserQuestion to approve or annotate. A reply with no free text is **approve** —
     proceed to step 4. A reply carrying free text on any option is **annotate**: re-spawn
     `sdd-document-orchestrator` for `tasks` once with `MODE: revision` and
     `REVISION_INPUT` = the annotation text (bracket it with `spawn.start`/`spawn.end` and
     call `harness` `phase-log` on its `approved` report, like any dispatch); when it
     reports `approved`, proceed to step 4. The round is advisory.
   - **Record** (AskUserQuestion absent, errored or denied, or `gates: record`): write the
     `veto` list to `specs/<spec>/questions.md` under a `## Gate B` section, write a
     HANDOFF `## Phase log` row (stage `tasks`, result `gate-b`, note
     `gate B recorded — no human`), commit both together, and proceed to step 4.
4. **Delete slot b.** Call the `harness` tool with `action: gate`, `op: delete`,
   `slot: b`, `specName: <spec>`. A later implementation entry for this spec — the annotate
   path's own re-approval, a design-defect re-approval, or a fresh resume before any task
   has run — then finds `present: false` and skips straight to implementation without
   asking again (Req 5 AC 6). Return to the worktree rule.

## 5. Retrospective conversation

Read exactly two files: `specs/<spec>/retrospective.md` and
`specs/<spec>/retrospective-proposals.md`. Call `deferrals` `list` with
`status: deferred` and keep this spec's records tagged `verification`. Present a
summary: findings by category with counts, the proposals with effort and risk, the
graduation candidates, and those open `verification` records as the human's action
items (each names the exact command to re-run and the evidence it must show).

Then use AskUserQuestion:

- One question per proposal marked `DECISION NEEDED: yes`, using the question and
  options the analyst wrote. At most four questions per call.
- Last, one multi-select question listing every proposal, asking which to approve.

If AskUserQuestion is unavailable or returns an error (headless run): skip the
conversation, write `specs/<spec>/retrospective-plan.md` with the header
`Status: DRAFT — decisions needed`, the list of open questions, and every proposal
marked "awaiting decision". Write a HANDOFF row (`retrospective`, `DRAFT`), commit the
plan and HANDOFF in the spec store repo (`docs(sdd): <spec> retrospective plan (draft)`),
and stop. The next interactive run finds the DRAFT plan, holds the conversation, and
rewrites it as APPROVED.

Otherwise write `specs/<spec>/retrospective-plan.md` with `Status: APPROVED`,
the approved proposals verbatim (each with its `Target:` line and the decision taken),
the decisions made, and the rejected proposals with the reason. Implement nothing from
it here: the close-out phase does that. Write a HANDOFF row, commit in the spec store
repo (`docs(sdd): <spec> retrospective plan`; use a script file if `agent-rules.md`
requires it), then go back to step 3: the plan is `APPROVED`, so the close-out phase
runs now, in this run.

## 6. Status line

At every stop, the last line you print is
`<project>:<spec> <phase> <state> — <one line>`, where `<project>` is the basename
of the main checkout. Before it, one handoff line naming the roots:
`roots: spec store <path> · code <path> · worktree <yes|no>`. Just before printing it,
`bash <event.sh> run.end "status=<the status line>"`, commit the ledger with the
commit script (`docs(sdd): <spec> harness ledger — run end`) so the run's last events
are in the spec store, and remove this run's line from the pointer file
`${XDG_STATE_HOME:-~/.local/state}/sdd/active-run` (the line whose run id is this run's;
delete the file if that leaves it empty) so the hooks stop recording this run.
