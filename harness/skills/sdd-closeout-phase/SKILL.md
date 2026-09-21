---
name: sdd-closeout-phase
description: Runs the close-out phase of one SDD spec: implements every proposal of the APPROVED retrospective plan with implementer and verifier agents, grouped by target repository and landed by each repository's own rules (direct commits in the spec store, a branch and one PR per code repository, in-place edits under ~/.claude), writes one outcome line per proposal in retrospective-plan.md, marks the plan CLOSED, and reports in the orchestrator contract. Used by the sdd-closeout-orchestrator agent, not directly from a main session.
---

# SDD close-out phase

You implement the approved retrospective plan of one spec, so the spec is closed before
the next one starts. You never implement, read source, edit source or run tests. Workers
do that. Your own reads are `retrospective-plan.md`, `agent-rules.md`, HANDOFF, the retro
log and worker reports. If file contents, diffs or test output start accumulating in your
context, stop and report `PHASE: error` with `REASON: drift (worker over-shared)`.

Your launch prompt gives you `SPEC`, `PHASE: closeout`, the roots, `HARNESS_REPO` (the
local checkout the harness plugin was installed from, or `none`), `HANDOFF`,
`AGENT_RULES`, `AGENT_PREFIX`, `EVENT_SCRIPT` and `BUDGET` (`all items`: one spawn works
every open item of every class; `resume` exists only for the error paths). The `all
items` budget assumes the reduced orchestrator context this harness produces: you route
only — the `orient` action runs Step 0, `harness brief` assembles each brief, and the
plugin hook writes the worker spawn boundary, so none of that fills your context.

Brief templates and the two scripts are in `references/briefs.md`. Read it once at the
start.

## Standing rules

- Agent tool, foreground, `subagent_type: <AGENT_PREFIX>:<agent>` (just `<agent>` when `AGENT_PREFIX` is `none`), no `model`
  parameter, never `fork`. One worker at a time.
- Never pass `projectPath` to a spec-workflow MCP tool.
- Paths: spec dir `<SPEC_STORE_ROOT>/specs/<SPEC>/`; the plan
  `<spec dir>/retrospective-plan.md`; retro log `<spec dir>/retrospective-log.md`;
  briefs and scripts in `/tmp/scratchpad/sdd/<SPEC>/` (create it).
- Every brief starts with `Read and obey <AGENT_RULES> first.` when `AGENT_RULES` is a
  path.
- Do not ask questions. A proposal you cannot land becomes a to-do line, never a
  question and never a blocker.
- Never merge a PR. Never edit `settings.json` or `settings.local.json` under
  `~/.claude`; an item that needs that is a to-do.
- Spec store commits of your own files (the plan, HANDOFF, the retro log) go through
  the script in the document-phase skill's `references/cleanup.md` (same script, same
  path); write it if it does not exist. Workers commit the items they land.
- **Ledger.** `EVENT_SCRIPT` records the run for `--watch`. Call it as
  `bash <EVENT_SCRIPT> <type> key=value ...` (quote values with spaces): `phase.start
  phase=closeout "state=items <done>/<total>"` at the end of Step 0; `task.pick
  task=<id> "title=<title>"` for every item of a batch when you brief it; one
  `spawn.usage` right after each worker's report (`agent=`, `role=implement <class> batch
  <b> | verify <class> batch <b> | fix <class> batch <b> round <r> | adjudicate <class>
  batch <b>`, `phase=closeout`, `result=<one line>`);
  `note "text=gate: item <id> <pass|fail> risk <low|high>"` after every gate call, so
  Step 4 counts the verifier spawns skipped for `store`/`home` items;
  `task.done task=<id> outcome=<done|to-do|skipped>` when you write its close-out line;
  `note` for skips and rulings; `phase.end` right before your final report. You no longer
  write the worker spawn boundary — the plugin hook records it and the view joins your
  `spawn.usage` to it by agent and time window. If `EVENT_SCRIPT` is missing, skip the
  ledger and say so in your report; never let it stop the phase.

## Step 0 — Orient

1. Call `spec-status` for `SPEC` once; require `overallStatus: completed`. Then call the
   spec-workflow `harness` tool with `action: orient`, `specName: <SPEC>`,
   `phase: closeout`, and no `projectPath`. It reads the plan and returns `items`
   (`total`, `done`, `open`), `byClass` (open-item counts for `none`, `store`, `harness`,
   `code`, `home`) and `nextStep`. A `success: false` (no plan, or the plan is not
   readable) ⇒ report `PHASE: error`, `REASON: <what is missing>`. The tool selects the
   open items — every `- **P<n>`/`- **G<n>` bullet under `## Approved proposals` and
   `## Graduation candidates` that no `## Close-out` line already closes — and classes each
   by its `Target:` line and decision (first match wins):

   | The item says | Class | Lands in |
   | --- | --- | --- |
   | target `none`, a human action, "ratified", "closed", or a decision that chose no change | `none` | nothing to land |
   | harness skills, agents, hooks; server code, docs or templates | `harness` | `HARNESS_REPO` |
   | steering, rules or `agent-rules.md`, project templates, decomposition conventions, spec store | `store` | `SPEC_STORE_REPO` |
   | memory, CLAUDE.md, settings | `home` | `~/.claude/` |
   | product code, or a path under the code repo | `code` | `MAIN_CHECKOUT` |

   A target that fits none of these is class `none`. With `HARNESS_REPO: none`, every
   `harness` item is a to-do (`the harness checkout is not on this machine`).
2. **Order:** `none` first (they cost nothing), then `store`, `harness`, `code`, `home`.
   Route on `nextStep`: `Step 1` ⇒ **Step 1** (a `none` item is open); `Step 2` ⇒
   **Step 2** (only landing classes remain); `Step 3` ⇒ **Step 3** (every item already
   done — close now).
3. Read the HANDOFF section `## <SPEC> — closeout` if it exists: which worktrees,
   branches and PRs an earlier spawn left.
4. Write `/tmp/scratchpad/sdd/<SPEC>/closeout-standing.md` from the template once per
   run.
5. Print one line `orient: <SPEC> closeout items <done>/<total>; open: none <a> store <b>
   harness <c> code <d> home <e>` and record `phase.start phase=closeout
   "state=items <done>/<total>"`.

## Step 1 — Items with nothing to land

For each `none` item write its close-out line now (format in Step 4): `skipped — <the
decision or the reason, one line>` when the plan chose no change or ratified something
as it stands; `to-do (human) — <what the human does>` when the target is a human action
or a settings file. `task.pick` then `task.done` for each.

## Step 2 — Batches

Work the remaining classes in order. A **batch** is every open item of one class: one
implementer brief per class, however many items it holds. The spawn works every class
before it reports. If a worker is interrupted or a tool error leaves open items you
cannot route around in this spawn: write the HANDOFF section, commit the spec store,
report `PHASE: resume`, `STATE: items <done>/<total>`, `NEXT: <class> batch`.

For each batch:

1. **Landing.** Prepare where the batch lands, once per repo per spec (reuse what an
   earlier spawn prepared):
   - `store`: the current branch of `SPEC_STORE_REPO`; no new branch, no PR. Only files
     under `SPEC_STORE_ROOT`, plus the paths `agent-rules.md` allows for direct commits,
     may change; an item that needs another file is a to-do.
   - `harness` and `code`: a worktree on branch `chore/<SPEC>-retro` from the default
     branch, made with the worktree script in `references/briefs.md` (it fetches, branches
     from `origin/<default>`, adds `<repo>/.claude/worktrees/<SPEC>-retro`, and reuses
     the branch or the worktree when one exists). Workers commit on that branch; you push
     and open the one PR for the repo when its class has no open items left. Never merge.
     No remote ⇒ the commits stay on the branch and the close-out lines name it.
   - `home`: in-place edits under `~/.claude/`, no commit.
2. **Brief.** `task.pick` for every item in the batch. Call the spec-workflow `harness`
   tool with `action: brief`, `template: reviser`, `specName: <SPEC>`, and `values`
   carrying the output path `/tmp/scratchpad/sdd/<SPEC>/closeout-brief-<class>-<b>.md`, the
   job (the landing: root, branch, how to commit, and the checks for that class) and the
   findings (each item's id, title, text, target and decision, verbatim from the plan);
   the batch fields are in `references/briefs.md`. The tool writes the read-and-obey line.
3. **Implement.** Spawn `sdd-implementer` with `Read and execute the instructions in
   <brief path>`. Its report has one line per item: `P<n>: done <commit>` | `P<n>: to-do
   — <reason>` | `P<n>: skipped — <reason>`.
3b. **Gate.** For each item reported `done <sha>`, call the spec-workflow `review-task`
   tool with `action: gate`, `specName`, `taskId: <id>`, `commit: <sha>`, `root:` the
   batch's landing root, `files:` the paths the item's text or `Target:` line names
   (relative to the root), and `checks:` the class's checks
   (`references/briefs.md:5-14`), one shell string each. A `home` item passes `files` and
   no `commit`; an item that names no path gets no gate call and is `ok` as it stands
   (the tool never receives `files: []`). Only `done` items are gated; `to-do` and
   `skipped` items skip the gate and close as today (Step 4 of the close-out lines).
   Record the ledger `note` per call, then route each item on `data.gate` and `data.risk`
   in steps 4 and 5.
4. **Verify.** A `gate: pass` item is `ok` — spawn no verifier — when its class is
   `store` or `home` whatever `data.risk` says, or when it is `harness`/`code` at
   `risk: low`. Spawn `sdd-verifier` only for `harness`/`code` items that are `pass` and
   `high`: call `harness` `brief` with `template: verifier`, `specName: <SPEC>`, and
   `values` for the output path `closeout-verify-<class>-<b>-r<r>.md`, its job listing only
   those items with their gate results. When no item remains at `risk: high` after
   this drop, spawn no verifier. The verifier reports one line per listed item
   (`P<n>: ok` | `P<n>: not done — <one line>`) and `VERDICT: pass | fix-required`.
5. **Fix rounds** (cap 3 per batch, counting gate fails and verifier `not done` alike).
   A `gate: fail` item and a verifier `not done` item both enter the fix brief: call
   `harness` `brief` with `template: reviser`, `specName: <SPEC>`, `values` for the output
   path `closeout-fix-<class>-<b>-r<r>.md` and those items as its findings (a gate-fail
   item's line is its `data.reasons`/`data.checks`), spawn a fresh `sdd-implementer`,
   re-gate the fixed items, then step 4 again. After three rounds still failing: call
   `harness` `brief` with `template: adjudicator`, `specName: <SPEC>`, output path
   `closeout-adjudication-<class>-<b>.md` and the listed items, spawn `sdd-adjudicator`
   once (it lands what it can and marks the rest `skipped — <reason>`), then one narrow
   verification of the listed items (a `harness brief`, `template: verifier`, with only
   those items). Append a retro-log entry with `retro.sh`
   (`ruling`) and continue whatever the narrow verdict says.
6. **Close-out lines.** Write one line per item (Step 4) from the final reports:
   `done — <commit>`, `to-do (human) — <reason>`, `skipped — <reason>`. `task.done` for
   each. Append one retro-log entry with `retro.sh` per batch (`cleanup`: items done, to-do, skipped,
   spawns) and one per skipped item (`deviation`, the reason).
7. **PR.** When a `harness` or `code` class has no open items left and its branch has
   commits: push with `git push -u origin chore/<SPEC>-retro` in the worktree, then
   `gh pr create` with the title `chore(retro): <SPEC> retrospective follow-ups` and a
   body with `## Summary` (one bullet per item landed) and `## Test plan` (the checks
   run, ticked), no attribution footer. For the code repo, follow the PR rules in
   `agent-rules.md` and grep the body for every term they forbid first; the harness repo
   has its own conventions and those terms do not apply to it. Add `- <repo basename>:
   PR <url>` under `## Close-out`. Never merge.
8. **Checkpoint.** Commit the spec store (`docs(sdd): <SPEC> closeout <class> batch <b>`).

## Step 3 — Close

When no open item remains: check that every item has a close-out line, then replace
`Status: APPROVED` with `Status: CLOSED` in the plan (keep the rest of the file). Write
the HANDOFF section `## <SPEC> — closeout` (items done, to-do and skipped; the PR URLs
and branches; the to-dos for the human, one line each; gotchas). Append a retro-log
entry with `retro.sh` (`cleanup`: the totals and the spawns). Commit the spec store: `docs(sdd): <SPEC>
closed`. Record `phase.end phase=closeout result=closed "state=items <total>/<total>"`.
Report `PHASE: closed`, `STATE: items <total>/<total>`, `NEXT: next spec`, and in the
150 words above the contract: the counts, the PR URLs and the to-dos.

## Step 4 — Close-out line format

Under `## Close-out` in `retrospective-plan.md` (create the section at the end of the
file when missing, with the first line `One line per proposal, written by the close-out
phase.`), one line per item, in this form and no other:

```
- P<n>: done — <commit sha>
- P<n>: to-do (human) — <reason>
- P<n>: skipped — <reason>
```

`G<n>` lines the same. One line per repo with a PR or a branch: `- <repo basename>: PR
<url>` or `- <repo basename>: branch chore/<SPEC>-retro (no remote)`.

## Stop conditions and their reports

Record `phase.end phase=closeout result=<PHASE value> "state=items <done>/<total>"
"note=<one line>"` right before the report.

| Condition | PHASE | REASON |
| --- | --- | --- |
| Every item has a close-out line, plan `CLOSED`, HANDOFF written, PRs opened | `closed` | — |
| Open items remain after an interrupted worker or a routed-around tool error | `resume` | — |
| Plan not `APPROVED`, spec not completed, drift, a tool error you cannot route around | `error` | the cause |

Every stop writes the HANDOFF section and commits the spec store first.
