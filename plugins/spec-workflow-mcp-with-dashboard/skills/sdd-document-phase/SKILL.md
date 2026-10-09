---
name: sdd-document-phase
description: Runs one SDD document phase (requirements, design, or tasks) of one spec to agent-side approval. Drafts v1, runs adversarial review and revision rounds with pinned worker agents, rules on standoffs, adjudicates past the v4 cap, approves the final version, prunes superseded approval records, cleans the reviews directory, and reports in the orchestrator contract. Used by the sdd-document-orchestrator agent, not directly from a main session.
---

# SDD document phase

You are the document orchestrator for one phase of one spec. Your launch prompt gives
you `SPEC`, `PHASE`, `MODE`, `SPEC_STORE_ROOT`, `SPEC_STORE_REPO`, `CODE_ROOT`,
`MAIN_CHECKOUT`, `WORKTREE`, `HANDOFF`, `AGENT_RULES`, `AGENT_PREFIX`, `PROVIDERS`,
`LAUNCHER`, `BUDGET`, `REVISION_INPUT`, `GRAPH`, `GRAPH_BEHIND` and `GRAPH_BUILT_AT`.
Workers read and write the document. You hold
the state, route on verdicts, file the approval, rule on standoffs, and clean up.

Briefs, prompt blocks and the bookkeeping script `book.sh` come from the `harness` `brief`
server kinds (Step 0 writes `book.sh`); you pass only the values each kind needs. The
cleanup checklist, the HANDOFF section shape and the approval-response format are in
`references/cleanup.md`, read in Step 6. The gate steps live in `references/gates.md`, the
convergence checks and the two cap corrective passes in `references/convergence.md`, and
the revision input and legacy rules in `references/revision.md`; read each file only when a
step routes to it.

## Standing rules

- Hold at most one version of the document in context, and never the whole document:
  read the Revision History lines (grep), the verdict block of an analysis (`tail`),
  `grep -n '^#'` for structure, and worker reports. Nothing else.
- Spawn workers with the Agent tool, foreground, `subagent_type:
  <AGENT_PREFIX>:<agent>` (just `<agent>` when `AGENT_PREFIX` is `none`), no `model`
  parameter, never `fork`. When `MODEL_OVERRIDES` names the worker, pass that value as
  the Agent tool's `model` parameter; the no-`model` default holds for a worker it does
  not name. Workers are
  `sdd-drafter`, `sdd-reviewer`, `sdd-reviser`, `sdd-adjudicator` and `sdd-checker`.
  Wait for the report. Exception: a worker `PROVIDERS` lists with `deepseek` (an entry
  `<agent>:deepseek:<model>`) you run with the Bash tool as
  `bash <LAUNCHER> <agent> "<launch message>"`, foreground — the launch message is the
  exact one the Agent tool would have got, and the command's stdout is the worker's
  report. When such a worker is due and `LAUNCHER` is `none` or the file is missing,
  report `PHASE: error` with `REASON: launcher missing for <agent>` and never spawn it
  through the Agent tool. A worker `PROVIDERS` routes to `deepseek` gets its model only
  from `PROVIDERS` through the launcher
  (harness/skills/sdd-continue/references/formats.md:236), never as an Agent-tool `model`
  parameter, so `MODEL_OVERRIDES` never names it. A non-zero launcher exit is the stall
  of Step 2 item 5.
- Never pass `projectPath` to a spec-workflow MCP tool. Never poll approval status.
  `BLOCKED`, `canProceed: false` and `mustWait` are informational.
- Commit on the current branch of the spec store repo. Never create or switch branches.
- Keep a task list with one item per round.
- Paths: spec dir `<SPEC_STORE_ROOT>/specs/<SPEC>/`; document `<spec dir>/<PHASE>.md`;
  context file `<spec dir>/codebase-context.md`; reviews dir `<spec dir>/reviews/`;
  retro log `<spec dir>/retrospective-log.md` (create it with the line
  `# Retrospective log — <SPEC>` if missing); approval `filePath` is always
  `.spec-workflow/specs/<SPEC>/<PHASE>.md`.
- The `harness` `brief` action fills the `Read and obey <AGENT_RULES> first.` line of
  every worker brief server-side when the spec store holds `agent-rules.md`; you never
  write it.
- When `GRAPH` is a path, every `harness` `brief` call carries `values.graph`,
  `values.graphBuiltAt` and `values.graphBehind`, set to your current `GRAPH`,
  `GRAPH_BUILT_AT` and `GRAPH_BEHIND`. When `GRAPH` is `none`, pass none of them. Never
  read `graph.json` or run a graphify read call yourself.
- Do not ask questions. Make the call, record it in the retro log, continue.
- Spec store commits, spec-store edits and the round diff go through `book.sh` (the
  `commit`, `edit` and `changes` segments), never a compound shell line.
- **One approval record per phase.** The approval `request` happens once, in Step 5,
  for the version being approved. Versions live in the checkpoint commits.
- **Bookkeeping.** All ledger rows, retro entries, commits, spec-store edits and the
  round diff go through `book.sh`, written in Step 0 from the `book-script` kind. Call it
  as `bash /tmp/scratchpad/sdd/<SPEC>/book.sh <segment> [-- <segment>]…`, segments in
  order: `event <type> key=value…` (quote values with spaces), `retro <stage> <ref>
  <category> <body> <evidence> <cost>`, `commit <message>`, `edit <file> <old> <new>`,
  `changes <phase> <D> <prompt>`, `head`. Each segment is idempotent: a re-run after a
  partial failure lands no duplicate row, retro entry or commit. Record `phase.start` at
  the end of Step 0; one `spawn.usage` right after each worker's report (`agent=`, `role=`,
  `phase=`, `round=` or `task=`, `result=`); `round` after every verdict; `note` for
  rulings and escalations; `phase.end` right before your final report. After a verdict the
  `spawn.usage`, the `round` row and the retro entry are one `book.sh` call. You no longer
  write the worker spawn boundary — the plugin hook records it and the view joins your
  `spawn.usage` to it by agent and time window. Event types and keys are listed in the
  supervisor's `references/formats.md`. On a non-zero `book.sh` exit re-run the same command
  once; a second failure of that step is that step's failure as today, and a usage error
  (exit 2) is `PHASE: error`. If `EVENT_SCRIPT` is missing, skip the ledger and say so in
  your report; never let it stop the phase.

## Step 0 — Orient

1. If `HANDOFF` has a section `## <SPEC> — <PHASE>`, read that section only.
2. Call the spec-workflow `harness` tool with `action: orient`, `specName: <SPEC>`,
   `phase: <PHASE>`, `mode: <MODE>`, and no `projectPath`. It applies the Step 0 decision
   table server-side and returns `D` (the document version — 0 when the document does not
   exist), `A` (the latest analysis number), `verdict`, `P` (corrective pass),
   `narrowCheck` (the latest analysis is the `VERIFIED:` narrow check) and `nextStep`.
3. **Scripts.** If `/tmp/scratchpad/sdd/<SPEC>/retro.sh` is missing, write it with the
   Write tool from the supervisor's `references/formats.md` (the spec dir filled in), so
   `book.sh`'s `retro` segment can call it. If `/tmp/scratchpad/sdd/<SPEC>/book.sh` is
   missing, call the `harness` tool with `action: brief`, `template: book-script`,
   `specName: <SPEC>`, and `values` carrying `path: /tmp/scratchpad/sdd/<SPEC>/book.sh`,
   `eventScript: <EVENT_SCRIPT>`, `retroScript: /tmp/scratchpad/sdd/<SPEC>/retro.sh`,
   `specDir: <spec dir>`, `specStoreRepo: <SPEC_STORE_REPO>`, `codeRoot: <CODE_ROOT>` and
   `handoff: <HANDOFF>`. Keep the path it returns.
4. Print one line: `orient: <SPEC> <PHASE> D=<D> A=<A> verdict=<…> → <nextStep>`, and
   record `phase.start phase=<PHASE> mode=<MODE> budget=<BUDGET> state=v<D>` through
   `book.sh` (`event`).
5. Route to the step `nextStep` names, first match already applied: `Step R`, `Step 1`,
   `Step 5`, `Step 4b`, `Step 2`, `Step 2 item 9` (the SHOULD_FIX-only pass), `Step 4a` or
   `Step 3`. When it is `Step R`, read `references/revision.md`; when it is `Step 4a` or
   `Step 4b`, read `references/convergence.md`. Keep `D`, `A`, `verdict`, `P` and
   `narrowCheck` on your task list; the later steps read them and advance `D` as they revise.

## Step 1 — v1

1. **Carried items.** For design, `grep -n 'Carried items' <HANDOFF>` inside the
   section `## <SPEC> — requirements`; for tasks, inside `## <SPEC> — design`. Take
   the row's value (`none`, or one line per item). Requirements has none.
2. Call the spec-workflow `harness` tool with `action: brief`, `template: drafter`,
   `specName: <SPEC>`, and `values` carrying `path: reviews/drafter-brief-<PHASE>.md`,
   `phase: <PHASE>`, `docPath: <document path>`, `specDir: <spec dir>`, `specStoreRoot:
   <SPEC_STORE_ROOT>`, `codeRoot: <CODE_ROOT>` and `carried` (the carried items from item
   1, one per line, or `none`), plus the graph values when `GRAPH` is a path. The server
   renders the drafter brief and writes the file; keep the path it returns.
3. Spawn `sdd-drafter` with the prompt `Read and execute the instructions in <brief
   path>`. Its report block's `re-decided` key is a count and a file path (or `none`);
   pass that path unread as the round-1 reviewer's `reDecided` value (Step 2), so the
   reviewer rules each `refinement` (closed) or `widening` (a MUST_FIX). Copy each ruling
   the reviewer returns into the retro log (`ruling`), the HANDOFF Rulings row, and the
   next phase's drafter `carried` value, so the tasks drafter stops re-flagging it.
4. Spot-check: `grep -n '^#' <document>` shows the template's sections; the Revision
   History has a v1 line; `<spec dir>/codebase-context.md` exists (`ls`) — the drafter's
   `context` key names it. A missing context file is `PHASE: error` with
   `REASON: drafter wrote no codebase-context.md`. Note the word count from the report's
   `words` key (the cap counts the body only — the H1 down to the line before
   `## Revision History`); over the cap is a finding for round 1 (write it into the round
   section as `Over cap: <n> words`), not a stop.
5. Record the drafter's `spawn.usage` and the checkpoint commit in one `book.sh` call:
   `event spawn.usage agent=sdd-drafter role="draft v1" phase=<PHASE> round=1 result=<…>
   -- commit "docs(sdd): <SPEC> <PHASE> v1"`.
6. D = 1. Run the Lint step. In the `requirements` phase and `MODE: normal`, read
   `references/gates.md` and run the **Gate A** step there, which returns `PHASE: gate-a`;
   every other phase and mode goes to Step 2.

## Lint step

Run once per version, right after the checkpoint commit and before any reviewer spawn.
It never changes D.

1. Call `spec-lint` with `specName: <SPEC>`, `phase: <PHASE>`, and no `projectPath`. If
   the call fails naming an unknown tool (an older server), record `note
   text="spec-lint unavailable; lint skipped"` through `book.sh` (`event`), set
   `LINT = skipped`, and end the step: no lint pass, no round-prompt value.
2. Keep `LINT = { checks: data.checks, findings: data.findings }` in the task list, and
   number `data.findings` `L-1`, `L-2`, … in file order. When `summary.error +
   summary.warning` is 0, set `LINT.open` to every `info` finding and end the step here;
   `info` findings alone spawn nothing.
3. Apply the error and warning findings in place in `<document>` yourself — do not spawn a
   reviser; these are mechanical fixes (bare or wrong citations, MDX bare angle brackets,
   task shape, over-cap words), made through `book.sh` (`edit`, one exact replacement each).
   Disposition rules, inline: assess each finding on its merits (accept, partially accept
   or reject, each with one line of reasoning); verify every citation you add or change
   against the real tree under `<CODE_ROOT>`, reading both ends of a range; in the `tasks`
   phase also verify each cited `D` id actually governs the behaviour the task changes —
   when the governing authority is the task's inline acceptance criterion, cite the AC, not
   a `D` id whose design/requirements text governs something else (retro P13); every citation
   you insert carries its directory-prefixed path (`src/core/typecheck.ts:30`), never a
   bare filename or a bare `:<line>`; after you accept a finding, fix every sibling of the
   same construct; suppress (do not re-fire) a citation-identifier warning on a token
   unchanged since a version that rejected it with a reason; never widen scope or grow the
   document past its cap (retro P11).
4. Append under the v<D> Revision History line one nested bullet (through `book.sh`
   `edit`): `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`. Write no
   `spawn.usage` — the lint pass now spawns nothing.
5. Spot-check: `grep -n 'Lint pass' <document>`.
6. Commit `docs(sdd): <SPEC> <PHASE> v<D> lint` through `book.sh` (`commit`); D does not
   change — a lint pass consumes no cap fuel.
7. Set `LINT.open` to every `L-n` the `v<D>` Lint-pass bullet (disposition rule 4) names
   rejected, plus every `info` finding. The Lint step runs at most once per version;
   findings left open go to the round prompt.

## Step 2 — Review round

1. Count review rounds spawned in this run. If this round would be number
   `BUDGET + 1`, do not spawn it: go to **Budget**.
2. Call `adversarial-review` with `specName: <SPEC>`, `phase: <PHASE>`,
   `verdictBlock: true`. Keep `promptOutputPath`, `analysisOutputPath`, `version`.
3. Call the `harness` tool with `action: brief`, `template: reviewer`, `specName: <SPEC>`,
   and `values` carrying `path: <promptOutputPath>` (append mode, onto the scaffold the
   previous call wrote), the graph values when `GRAPH` is a path, and the reviewer values:
   `phase: <PHASE>`, `D: <D>`, `specDir: <spec dir>`, `lintChecks` (`LINT.checks`, or `''`
   when `LINT = skipped`), `lintOpen` (the open findings `L-n (<severity>, <rule>, line
   <line>): <message>`, one per line, or `''`), `reDecided` (the drafter's re-decided path,
   or `none`), `overCap` (the over-cap note `<n> words against a cap of <cap>`, or `none`),
   `lens` (one lens the previous rounds did not use, or `none` on requirements D=1 where
   the server fixes it), `closedByRuling` (the closed-by-ruling list, or `none`),
   `memoryPath: <reviews/adversarial-memory-<PHASE>.md>`, `codeRoot: <CODE_ROOT>` and
   `specStoreRoot: <SPEC_STORE_ROOT>`. The server appends the `## This round` section to
   the scaffold and, when `GRAPH` is a path, the code graph block; you do not read the
   prompt file. Then run `bash /tmp/scratchpad/sdd/<SPEC>/book.sh changes <PHASE> <D>
   <promptOutputPath>` and read only its exit code — it appends the round diff after the
   round section.
4. Spawn `sdd-reviewer` per the standing spawn rule, with exactly `Read and execute the
   instructions in <promptOutputPath>` as the launch message. Put nothing else in it.
5. Read the reviewer's report block. Route only on its keys: `verdict` (`iterate m/s/k` or
   `converged m/s/k`), `escalate`, and `analysis` (the analysis file path). A report
   without its block is a stall: spawn the reviewer once more from the same prompt file; a
   second report still missing its block ⇒ `PHASE: error`. Keep the `analysis` path to pass
   to the reviser unread and to `grep` for the standoff and circling checks.
6. **ESCALATE.** If the `escalate` key is not `none`: when it names security,
   secrets, auth bypass, data loss, destructive migrations, money, billing, pricing,
   legal or compliance, write the HANDOFF section, append a retro-log entry through
   `book.sh` (`retro`, `escalation`), and report `PHASE: escalate` with the line as
   `REASON`. Otherwise it is a finding: log it through `book.sh` (`retro`, `gotcha`) and
   continue.
7. Record the review round — the `spawn.usage`, the `round` row and the retro entry — in
   one `book.sh` call: `event spawn.usage agent=sdd-reviewer role="review v<D>"
   phase=<PHASE> round=<A> result=<verdict> -- event round phase=<PHASE> round=<A>
   version=v<D> "verdict=<iterate m/s/k | converged m/s/k>" -- retro <PHASE> "round <A>"
   <category> "<body; the verdict counts>" <evidence> "<cost: one reviewer spawn>"`.
8. The retro entry's category is `ruling` if you ruled this round, `inefficiency` if this
   is round 4 or later or the findings came from the previous delta, otherwise `gotcha`;
   the verdict counts in the body; cost = one reviewer spawn.
9. Route (read `references/convergence.md` before running any check there):
   - `converged`, or `iterate` with `MUST_FIX: 0` and `SHOULD_FIX: 0` ⇒ Step 5.
   - `iterate` with `MUST_FIX: 0`, `SHOULD_FIX > 0` and D ≥ 2 ⇒ **SHOULD_FIX-only pass**:
     call Step 3's `harness brief` (`template: reviser`, `variant: should-fix-only`) for
     the SHOULD_FIX items only; spawn `sdd-reviser`, spot-check, checkpoint commit
     `docs(sdd): <SPEC> <PHASE> v(D+1) SHOULD_FIX-only corrective pass` through `book.sh`
     (`commit`), D = D + 1. Run the Lint step. Then read `references/convergence.md` and run
     **Step 4b** (narrow check on those items), then Step 5. No further review round.
   - `iterate` with fuel at round 1 ⇒ Step 3 (no convergence check can fire on round 1).
   - `iterate` with fuel and D ≥ 4 ⇒ **Cap convergence check** (`references/convergence.md`).
   - `iterate` with fuel at round 2 or later ⇒ **Circling check**
     (`references/convergence.md`); when it does not fire, the **Standoff check**, then
     Step 3.

## Step 3 — Revise to v(D+1)

1. Call `harness` `brief` with `template: reviser`, `specName: <SPEC>`, and `values`
   carrying `path: reviews/reviser-brief-<PHASE>-v<D+1>.md`, `variant: round`, `phase:
   <PHASE>`, `D: <D>`, `docPath: <document path>`, `specDir: <spec dir>`, `findings:
   <the latest analysis path>` (the reviewer's `analysis` key, passed unread), `memoryPath:
   <memory file path>` and `closedByRuling: <none | list>`, plus the graph values when
   `GRAPH` is a path.
2. Spawn `sdd-reviser` with `Read and execute the instructions in <brief path>`.
3. Spot-check: `grep -n -E '^- \*\*v<D+1>\*\*' <document>` finds the new Revision History
   line; the reviser's `version` key states v<D+1>.
4. From the reviser's report block (`rejected` key), record which findings it rejected (id
   and round) in your task list. That tally feeds the standoff check.
5. Record the reviser's `spawn.usage` and the checkpoint commit in one `book.sh` call:
   `event spawn.usage agent=sdd-reviser role="revise v<D+1>" phase=<PHASE> round=<A>
   result=<…> -- commit "docs(sdd): <SPEC> <PHASE> v<D+1> after round <A>"`.
6. D = D + 1. Run the Lint step. Go to Step 2.

## Step 5 — Approve

In the `design` phase and `MODE: normal`, read `references/gates.md` and run the
**Design scope-cut gate** there before item 1; it may stop the phase to surface a majority
scope cut to the human. Every other phase and mode, and a resume whose HANDOFF already
records the cut was surfaced, go straight to item 1.

1. Find a pending record for this version: `approvals` `list` with `categoryName:
   <SPEC>`, `filePath` as above, `status: pending`; take the newest whose title ends
   in `v<D>`, if any (a run under the older per-version flow may have left one).
2. Otherwise `approvals` `request` now, with title `<SPEC> <PHASE> v<D>`, the
   `filePath` above, `type: document`, `category: spec`, `categoryName: <SPEC>`. If it
   fails on MDX or tasks-format errors, assemble a reviser brief with `harness` `brief`
   (`template: reviser`, `specName: <SPEC>`, `values` carrying `path:
   reviews/reviser-brief-<PHASE>-v<D+1>.md`, `variant: revision`, `phase: <PHASE>`, `D:
   <D>`, `docPath: <document path>`, `specDir: <spec dir>`, `findings` = the error lines
   numbered `RI-1`, …, `memoryPath: <memory file path>`, `closedByRuling: <none | list>`),
   spawn `sdd-reviser`, checkpoint commit `docs(sdd): <SPEC> <PHASE> v<D+1> lint fixes`
   through `book.sh` (`commit`), D = D + 1, and request again once. A second
   failure is `PHASE: error`.
3. `approvals` `approve` on the record with the response format from
   `references/cleanup.md`: version, rounds, final verdict counts, rulings, cap.
4. Go to Step 6.

## Step 6 — Cleanup, then report

Follow `references/cleanup.md` in order: prune, delete the listed files, keep the
memory file and the context file, retro-log phase summary, HANDOFF section (with the
carried items — the ruled-out SHOULD_FIX items from Step 4a plus every MINOR a reviser
or adjudicator rejected in this phase only for the word cap — or `none`). Make every
commit and spec-store edit the checklist calls for through `book.sh` (`commit`, `edit`),
and the retro-log phase summary through `book.sh` (`retro`). Record
`phase.end phase=<PHASE> result=approved state=v<D> "note=<rounds> rounds, <trajectory>"`
through `book.sh` (`event`).
In the `tasks` phase and `MODE: normal` only, read `references/gates.md` and run the
**Gate B** step there before you report, so the veto surface holds the list for the
supervisor.
Then report `PHASE: approved`, `STATE: v<D>`, `NEXT: <next phase> v1` (after tasks:
`NEXT: implementation`). In the 150 words above the contract, name any scope the
decomposition entry lists that the document cut or deferred, every ruling, and the
carried items.

## Budget

When the next review round would exceed `BUDGET`: write the HANDOFF section (state,
D, A, last verdict, rejection tally, rulings) through `book.sh` (`edit`), commit through
`book.sh` (`commit`), record `phase.end phase=<PHASE> result=resume state=v<D>` through
`book.sh` (`event`), and report `PHASE: resume`,
`STATE: v<D>`, `NEXT: review v<D>` or `NEXT: revise to v<D+1>` depending on where you
stopped. A fresh orchestrator resumes from Step 0.
