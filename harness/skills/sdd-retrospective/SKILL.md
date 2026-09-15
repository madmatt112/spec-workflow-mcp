---
name: sdd-retrospective
description: Runs the retrospective of one completed SDD spec: compiles the findings from the retro log, HANDOFF, deferrals, implementation logs, task reviews, the git log and earlier retrospectives into retrospective.md, then has the retro analyst write retrospective-proposals.md, and reports PHASE retro-ready. Never implements anything. Used by the sdd-retro-orchestrator agent, not directly from a main session.
---

# SDD retrospective

You compile the findings of one finished spec and hand them to the analyst. You never
implement, and you never write the plan: the supervisor holds the conversation with the
human and writes `retrospective-plan.md`.

Your launch prompt gives you `SPEC`, `PHASE: retrospective`, the roots, `HANDOFF`,
`AGENT_RULES`, `AGENT_PREFIX`. Formats are in `references/formats.md`; read it first.

## Standing rules

- Agent tool, foreground, `subagent_type: <AGENT_PREFIX>:sdd-retro-analyst`, no
  `model` parameter, never `fork`.
- Never pass `projectPath` to a spec-workflow MCP tool.
- Every finding carries an evidence reference (a path, an approval id, a commit, a
  deferral id, an analysis section, a retro-log entry timestamp), a frequency and a
  cost estimate. A finding without a reference is not written.
- Both output files are capped at 2,500 words each. Count before you finish.
- Do not ask questions.
- Edit spec-store files (HANDOFF, the retro log) with the Edit tool. When the tool
  refuses the path (a worktree-isolated session), write
  `/tmp/scratchpad/sdd/<SPEC>/spec-edit.mjs` once with the Write tool from the script
  text in the document-phase skill's `references/cleanup.md`, then call it on its own
  shell line: `node /tmp/scratchpad/sdd/<SPEC>/spec-edit.mjs <file> <old> <new>` replaces
  one exact match (non-zero exit on 0 or 2+ matches). Never `sed -i` on the spec store,
  never a heredoc; write scripts with the Write tool.
- **Ledger.** `EVENT_SCRIPT` from the launch prompt records the run for `--watch`. Call it
  as `bash <EVENT_SCRIPT> <type> key=value ...` (quote values with spaces):
  `phase.start phase=retrospective` after the preconditions, `spawn.start` / `spawn.end`
  around the analyst (`agent=sdd-retro-analyst role=proposals`, `tokens=<n>` from the
  Agent result's footer on `spawn.end`), `phase.end phase=retrospective
  result=retro-ready` before the report. `EVENT_SCRIPT` missing or not readable: skip the
  ledger and say so in your report; never let it stop the phase.

## Step 0 — Preconditions

1. Call `spec-status` for `SPEC`. Require `overallStatus: completed`. Read
   `<SPEC_STORE_ROOT>/specs/<SPEC>/tasks.md` and require every task `[x]`. Otherwise
   report `PHASE: error`, `REASON: spec not complete (<what is open>)`.
2. Require `<spec dir>/retrospective-log.md` to exist. If it does not, the spec was
   built before this harness: write `retrospective.md` with the single section
   `## No harness log` explaining that, skip the analyst, and report `PHASE: error`,
   `REASON: no retrospective log`.

## Step 1 — Compile `retrospective.md`

Read, in this order, taking notes rather than copying:

1. `<spec dir>/retrospective-log.md`, every entry.
2. The HANDOFF sections for `SPEC` (grep the headings `## <SPEC> — `).
3. `deferrals` `list` filtered by `originSpec: <SPEC>` (all statuses).
4. `<spec dir>/Implementation Logs/` (summaries and file lists; skim).
5. The task reviews: `get-task-review` for each task that had a fix round (the retro
   log says which), latest version.
6. The git log of the spec commits, gathered by a script so that no `git` invocation
   sits on a shell line. The retro skill writes `/tmp/scratchpad/sdd/<SPEC>/git-log.sh`
   with the Write tool; inside the script each repo gets one `cd` followed by one
   `/usr/bin/git log --oneline` call with absolute paths — the code repo
   (`<default branch>..HEAD` in `CODE_ROOT`; if the branch is merged, the commits whose
   message names the spec) and the spec store repo (`-- .spec-workflow/specs/<SPEC>` in
   the spec store repo root) — and the skill then runs it with `bash`. The script uses
   no `-C`, no glob and no `&&` on any shell line.
7. Every earlier `<SPEC_STORE_ROOT>/specs/*/retrospective.md`, for repeat patterns.

Write `<spec dir>/retrospective.md` with the sections in `references/formats.md`, in
that order, a section present even when empty (`None found.`). Every finding is one
bullet in the finding format. Cap 2,500 words.

## Step 2 — Analyst

Spawn `sdd-retro-analyst` with the prompt:

```
Read and execute: write <spec dir>/retrospective-proposals.md from the findings in
<spec dir>/retrospective.md, following the proposal format in that file's header.
Spec store root <SPEC_STORE_ROOT>; code root <CODE_ROOT>; agent rules <AGENT_RULES>.
Cap 2,500 words. Report in 100 words or fewer: proposal count, decisions needed,
graduation candidates.
```

(`retrospective.md`'s header carries the proposal format, copied from
`references/formats.md`, so the analyst needs no other file.)

Check the file exists, has one proposal per finding, and ends with `## Graduation
candidates`. Count the lines matching `DECISION NEEDED: yes`.

## Step 3 — Report

Commit both files in the spec store repo (`docs(sdd): <SPEC> retrospective findings
and proposals`, through the commit script described in the document-phase skill's
`references/cleanup.md`). Append one retro-log entry (`cleanup`: retrospective
compiled, finding and proposal counts).

Report `PHASE: retro-ready`, `STATE: n/a`, `NEXT: retrospective conversation`, and in
the 150 words above the contract: both paths, the finding count by category, the
proposal count, and the number of decisions needed.
