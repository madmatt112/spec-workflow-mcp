---
name: sdd-continue
description: Continue the spec-driven development (SDD) process for the active spec. A thin supervisor that resolves the spec store and code roots, finds the active spec and its live phase, spawns one phase orchestrator at a time, and runs the retrospective conversation. Use when the user says "continue the sdd process", "continue sdd", "run the sdd loop", "next sdd step", or when this skill is invoked by name.
---

# SDD supervisor

You are the supervisor of one SDD run. One run takes the active spec from wherever it
is to the end of its retrospective conversation, then stops. The next run starts the
next spec.

Rules that hold for the whole run:

- You never read spec documents. The two retrospective files in step 5 are the only
  exception. Orchestrators read documents; you read their final report lines.
- You spawn one orchestrator at a time, in the foreground, and act on its final
  `PHASE:` line. Never poll. Never pass `subagent_type: fork`.
- Never pass `projectPath` to any spec-workflow MCP tool.
- Do not ask the user anything before step 5.
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
  `<spec store repo root>/HANDOFF.md`.
- **Agent rules** are `<spec store root>/agent-rules.md`, optional. Note whether the
  file exists; pass its path to every orchestrator.

Say which roots you resolved in the handoff line (step 6).

## 2. Active spec

Use the `routing` field of the `spec-index` result (the same data as INDEX.md's
`## Next`):

- `active` ⇒ `routing.spec` is the active spec.
- `ambiguous` ⇒ report the candidates and stop. Do not pick one.
- `all-on-disk-complete` ⇒ not roadmap completion. Read
  `<spec store root>/spec-decomposition/decomposition.md` and find the first spec named
  there with no `<spec store root>/specs/<name>/` directory. That spec is active and
  starts at requirements. If there is none, the roadmap is complete: report and stop.
- `all-deferred` / `no-specs` ⇒ report and stop.
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
   `specs/<spec>/retrospective-plan.md` does not ⇒ phase **retrospective**.
2. `overallStatus == completed` otherwise ⇒ the spec is finished. Report and stop.
   (Specs completed before this harness have no retrospective.)
3. Requirements missing or not approved ⇒ document phase **requirements**.
4. Design missing or not approved ⇒ document phase **design**.
5. Tasks missing or not approved ⇒ document phase **tasks**. Exception: if
   `taskProgress.completed > 0` or `taskProgress.inProgress > 0`, implementation began
   under the old convention. Treat tasks as approved, append a retro-log entry
   (category `deviation`, "tasks treated as approved: implementation had begun"), and
   go to rule 6.
6. Otherwise ⇒ **implementation**.

Revision input: when the live document's `approvalStatus` is `needs-revision`, a human
used the dashboard between runs. Call `approvals` `status` on that `approvalId` once,
take `response`, `annotations` and `comments`, and pass them to the document
orchestrator as revision input.

If `spec-status` reports the spec as not found, the spec is new: document phase
**requirements**.

## 4. Dispatch loop

Spawn the orchestrator for the phase with the Agent tool, foreground, no `model`
parameter, `subagent_type` = `<prefix>:<agent>`:

| Phase | Agent |
| --- | --- |
| requirements / design / tasks | `sdd-document-orchestrator` |
| implementation | `sdd-implementation-orchestrator` |
| retrospective | `sdd-retro-orchestrator` |

The launch prompt contains, one line each:

```
SPEC: <slug>
PHASE: <requirements | design | tasks | implementation | retrospective>
MODE: <normal | revision | repair>
SPEC_STORE_ROOT: <path ending in .spec-workflow>
SPEC_STORE_REPO: <its parent>
CODE_ROOT: <cwd>
MAIN_CHECKOUT: <path, or "same as CODE_ROOT">
WORKTREE: <yes | no>
HANDOFF: <path>
AGENT_RULES: <path | none>
AGENT_PREFIX: <prefix>
BUDGET: <3 review rounds | 6 tasks | n/a>
REVISION_INPUT: <none | the text, verbatim>
```

followed by the report contract from `references/formats.md`, verbatim, and the line
`Report exactly in that contract. Never paste file contents.`

Act on the final `PHASE:` line of the orchestrator's report:

- `approved` or `complete`: write one HANDOFF phase row. Go back to step 3 for the
  next phase (call `spec-status` again).
- `resume`: write a HANDOFF row, then spawn a fresh orchestrator for the same phase
  with the same prompt.
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
- Anything else, or no `PHASE:` line: treat as `error` with reason
  "orchestrator did not report in contract".

**Runaway guard.** More than 12 orchestrator spawns for one phase in this run is an
`error`.

**Worktree rule.** Before the first implementation spawn: if `agent-rules.md` exists
and contains the line `worktree-per-change: required`, and the worktree check in
step 1 said `no`, enter a worktree named after the spec with the EnterWorktree tool,
then rename the branch to `feat/<spec>` (`git branch -m`). Re-run the step 1
worktree check so the launch prompt carries the new `CODE_ROOT`. If EnterWorktree is
unavailable (headless run), the driver has already put you in a worktree; the step 1
check confirms it, and you do not enter another. Subagents inherit the worktree.

After each phase transition, rewrite the HANDOFF routing header (format in
`references/formats.md`).

## 5. Retrospective conversation

Read exactly two files: `specs/<spec>/retrospective.md` and
`specs/<spec>/retrospective-proposals.md`. Present a summary: findings by category
with counts, the proposals with effort and risk, the graduation candidates.

Then use AskUserQuestion:

- One question per proposal marked `DECISION NEEDED: yes`, using the question and
  options the analyst wrote. At most four questions per call.
- Last, one multi-select question listing every proposal, asking which to approve.

If AskUserQuestion is unavailable or returns an error (headless run): skip the
conversation, write `specs/<spec>/retrospective-plan.md` with the header
`Status: DRAFT — decisions needed`, the list of open questions, and every proposal
marked "awaiting decision". Write a HANDOFF row (`retrospective`, `DRAFT`) and stop.

Otherwise write `specs/<spec>/retrospective-plan.md` with `Status: APPROVED`,
the approved proposals verbatim, the decisions made, and the rejected proposals with
the reason. Never implement anything from it in this run. Write a HANDOFF row, commit
in the spec store repo (`docs(sdd): <spec> retrospective plan`; use a script file if
`agent-rules.md` requires it), and stop.

## 6. Status line

At every stop, the last line you print is
`<project>:<spec> <phase> <state> — <one line>`, where `<project>` is the basename
of the main checkout. Before it, one handoff line naming the roots:
`roots: spec store <path> · code <path> · worktree <yes|no>`.
