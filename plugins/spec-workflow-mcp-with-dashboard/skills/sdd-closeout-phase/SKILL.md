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
`AGENT_RULES`, `AGENT_PREFIX`, `EVENT_SCRIPT` and `BUDGET` (items per spawn, default 8).

Brief templates and the two scripts are in `references/briefs.md`. Read it once at the
start.

## Standing rules

- Agent tool, foreground, `subagent_type: <AGENT_PREFIX>:<agent>`, no `model`
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
  task=<id> "title=<title>"` for every item of a batch when you brief it; `spawn.start`
  right before every Agent call and `spawn.end` right after its report (`agent=`,
  `role=implement <class> batch <b> | verify <class> batch <b> | fix <class> batch <b>
  round <r> | adjudicate <class> batch <b>`, `phase=closeout`, `result=<one line>`);
  `task.done task=<id> outcome=<done|to-do|skipped>` when you write its close-out line;
  `note` for skips and rulings; `phase.end` right before your final report. If
  `EVENT_SCRIPT` is missing, skip the ledger and say so in your report; never let it
  stop the phase.

## Step 0 — Orient

1. Call `spec-status` for `SPEC` once; require `overallStatus: completed`. Read the
   plan; require `Status: APPROVED`. Otherwise report `PHASE: error`, `REASON: <what is
   missing>`.
2. **Items.** Every bullet under `## Approved proposals` and `## Graduation candidates`
   that starts with `- **P<n>` or `- **G<n>` is one item: its id, title, text, `Target:`
   line and `Decision:` text when present. Number them in file order. Rejected proposals
   are not items.
3. **Done items.** If the plan has a `## Close-out` section, every `- P<n>:` or `- G<n>:`
   line in it is done (an earlier spawn wrote it). The open items are the rest.
4. **Target class** of each open item, from its `Target:` line and its decision, first
   match wins:

   | The item says | Class | Lands in |
   | --- | --- | --- |
   | target `none`, a human action, "ratified", "closed", or a decision that chose no change | `none` | nothing to land |
   | harness skills, agents, hooks; server code, docs or templates | `harness` | `HARNESS_REPO` |
   | steering, rules or `agent-rules.md`, project templates, decomposition conventions, spec store | `store` | `SPEC_STORE_REPO` |
   | memory, CLAUDE.md, settings | `home` | `~/.claude/` |
   | product code, or a path under the code repo | `code` | `MAIN_CHECKOUT` |

   A target that fits none of these is class `none` with the reason `unclear target`.
   With `HARNESS_REPO: none`, every `harness` item is a to-do (`the harness checkout is
   not on this machine`).
5. **Order:** `none` first (they cost nothing), then `store`, `harness`, `code`, `home`.
6. Read the HANDOFF section `## <SPEC> — closeout` if it exists: which worktrees,
   branches and PRs an earlier spawn left.
7. Write `/tmp/scratchpad/sdd/<SPEC>/closeout-standing.md` from the template once per
   run.
8. Print one line `orient: <SPEC> closeout items <done>/<total>; open: none <a> store <b>
   harness <c> code <d> home <e>` and record `phase.start`.

## Step 1 — Items with nothing to land

For each `none` item write its close-out line now (format in Step 4): `skipped — <the
decision or the reason, one line>` when the plan chose no change or ratified something
as it stands; `to-do (human) — <what the human does>` when the target is a human action
or a settings file. `task.pick` then `task.done` for each. They do not count against
`BUDGET`.

## Step 2 — Batches

Work the remaining classes in order. A **batch** is the open items of one class, at most
the budget left in this spawn (`BUDGET` minus the items already worked in this spawn).
When the budget is spent and open items remain: write the HANDOFF section, commit the
spec store, report `PHASE: resume`, `STATE: items <done>/<total>`, `NEXT: <class> batch`.

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
2. **Brief.** `task.pick` for every item in the batch. Write
   `/tmp/scratchpad/sdd/<SPEC>/closeout-brief-<class>-<b>.md` from the batch template:
   the landing (root, branch, how to commit), the checks for that class, and each item's
   id, title, text, target and decision, verbatim from the plan.
3. **Implement.** Spawn `sdd-implementer` with `Read and execute the instructions in
   <brief path>`. Its report has one line per item: `P<n>: done <commit>` | `P<n>: to-do
   — <reason>` | `P<n>: skipped — <reason>`.
4. **Verify.** Write `closeout-verify-<class>-<b>-r<r>.md` from the verify template (each
   item with its text and the implementer's line; the checks). Spawn `sdd-verifier`. It
   reports one line per item (`P<n>: ok` | `P<n>: not done — <one line>`) and
   `VERDICT: pass | fix-required`.
5. **Fix rounds** (cap 3 per batch). On `fix-required`: write
   `closeout-fix-<class>-<b>-r<r>.md` from the fix template with the `not done` items,
   spawn a fresh `sdd-implementer`, then step 4 again. After three rounds still
   `fix-required`: write `closeout-adjudication-<class>-<b>.md`, spawn `sdd-adjudicator`
   once (it lands what it can and marks the rest `skipped — <reason>`), then one narrow
   verification of the listed items (the verify template with only those items). Append a
   retro-log entry (`ruling`) and continue whatever the narrow verdict says.
6. **Close-out lines.** Write one line per item (Step 4) from the final reports:
   `done — <commit>`, `to-do (human) — <reason>`, `skipped — <reason>`. `task.done` for
   each. Append one retro-log entry per batch (`cleanup`: items done, to-do, skipped,
   spawns) and one per skipped item (`deviation`, the reason).
7. **PR.** When a `harness` or `code` class has no open items left and its branch has
   commits: push with `git push -u origin chore/<SPEC>-retro` in the worktree, then
   `gh pr create` with the title `chore(retro): <SPEC> retrospective follow-ups` and a
   body with `## Summary` (one bullet per item landed) and `## Test plan` (the checks
   run, ticked), no attribution footer. For the code repo, follow the PR rules in
   `agent-rules.md` and grep the body for every term they forbid first; the harness repo
   has its own conventions and those terms do not apply to it. Add `- <repo basename>:
   PR <url>` under `## Close-out`. Never merge.
8. **Checkpoint.** Commit the spec store (`docs(sdd): <SPEC> closeout <class> batch <b>`)
   and count the batch's items against `BUDGET`.

## Step 3 — Close

When no open item remains: check that every item has a close-out line, then replace
`Status: APPROVED` with `Status: CLOSED` in the plan (keep the rest of the file). Write
the HANDOFF section `## <SPEC> — closeout` (items done, to-do and skipped; the PR URLs
and branches; the to-dos for the human, one line each; gotchas). Append a retro-log
entry (`cleanup`: the totals and the spawns). Commit the spec store: `docs(sdd): <SPEC>
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
| Budget spent with open items | `resume` | — |
| Plan not `APPROVED`, spec not completed, drift, a tool error you cannot route around | `error` | the cause |

Every stop writes the HANDOFF section and commits the spec store first.
