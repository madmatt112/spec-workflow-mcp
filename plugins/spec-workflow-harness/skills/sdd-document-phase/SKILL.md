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

Templates for every brief and prompt are in `references/briefs.md`. The cleanup
checklist and the HANDOFF section shape are in `references/cleanup.md`. Read both once
at the start.

## Standing rules

- Hold at most one version of the document in context, and never the whole document:
  read the Revision History lines (grep), the verdict block of an analysis (`tail`),
  `grep -n '^#'` for structure, and worker reports. Nothing else.
- Spawn workers with the Agent tool, foreground, `subagent_type:
  <AGENT_PREFIX>:<agent>` (just `<agent>` when `AGENT_PREFIX` is `none`), no `model`
  parameter, never `fork`. Workers are
  `sdd-drafter`, `sdd-reviewer`, `sdd-reviser`, `sdd-adjudicator` and `sdd-checker`.
  Wait for the report. Exception: a worker `PROVIDERS` lists with `deepseek` (an entry
  `<agent>:deepseek:<model>`) you run with the Bash tool as
  `bash <LAUNCHER> <agent> "<launch message>"`, foreground — the launch message is the
  exact one the Agent tool would have got, and the command's stdout is the worker's
  report. When such a worker is due and `LAUNCHER` is `none` or the file is missing,
  report `PHASE: error` with `REASON: launcher missing for <agent>` and never spawn it
  through the Agent tool. A non-zero launcher exit is the stall of Step 2 item 5.
- Never pass `projectPath` to a spec-workflow MCP tool. Never poll approval status.
  `BLOCKED`, `canProceed: false` and `mustWait` are informational.
- Commit on the current branch of the spec store repo. Never create or switch branches.
- Keep a task list with one item per round.
- Paths: spec dir `<SPEC_STORE_ROOT>/specs/<SPEC>/`; document `<spec dir>/<PHASE>.md`;
  context file `<spec dir>/codebase-context.md`; reviews dir `<spec dir>/reviews/`;
  retro log `<spec dir>/retrospective-log.md` (create it with the line
  `# Retrospective log — <SPEC>` if missing); approval `filePath` is always
  `.spec-workflow/specs/<SPEC>/<PHASE>.md`.
- Every worker brief starts with `Read and obey <AGENT_RULES> first.` when
  `AGENT_RULES` is a path.
- When `GRAPH` is a path, every `harness` `brief` call carries `values.graph`,
  `values.graphBuiltAt` and `values.graphBehind`, set to your current `GRAPH`,
  `GRAPH_BUILT_AT` and `GRAPH_BEHIND`. When `GRAPH` is `none`, pass none of them. Never
  read `graph.json` or run a graphify read call yourself.
- Do not ask questions. Make the call, record it in the retro log, continue.
- Spec store commits go through a script file (see `references/cleanup.md`), never a
  compound shell line.
- **One approval record per phase.** The approval `request` happens once, in Step 5,
  for the version being approved. Versions live in the checkpoint commits.
- **Ledger.** `EVENT_SCRIPT` from the launch prompt records the run for `--watch`. Call it
  as `bash <EVENT_SCRIPT> <type> key=value ...` (quote values with spaces): `phase.start`
  at the end of Step 0; one `spawn.usage` right after each worker's report (`agent=`,
  `role=`, `phase=`, `round=` or `task=`, `result=`); `round` after every verdict; `note` for rulings and
  escalations; `phase.end` right before your final report. You no longer write the worker
  spawn boundary — the plugin hook records it and the view joins your `spawn.usage` to it
  by agent and time window. Event types and keys are listed in the supervisor's
  `references/formats.md`. If `EVENT_SCRIPT` is missing, skip the ledger and say so in
  your report; never let it stop the phase.

## Step 0 — Orient

1. If `HANDOFF` has a section `## <SPEC> — <PHASE>`, read that section only.
2. Call the spec-workflow `harness` tool with `action: orient`, `specName: <SPEC>`,
   `phase: <PHASE>`, `mode: <MODE>`, and no `projectPath`. It applies the Step 0 decision
   table server-side and returns `D` (the document version — 0 when the document does not
   exist), `A` (the latest analysis number), `verdict`, `P` (corrective pass),
   `narrowCheck` (the latest analysis is the `VERIFIED:` narrow check) and `nextStep`.
3. Route to the step `nextStep` names, first match already applied: `Step R`, `Step 1`,
   `Step 5`, `Step 4b`, `Step 2`, `Step 2 item 9` (the SHOULD_FIX-only pass), `Step 4a` or
   `Step 3`. Keep `D`, `A`, `verdict`, `P` and `narrowCheck` on your task list; the later
   steps read them and advance `D` as they revise.
4. Print one line: `orient: <SPEC> <PHASE> D=<D> A=<A> verdict=<…> → <nextStep>`, and
   record `phase.start phase=<PHASE> mode=<MODE> budget=<BUDGET> state=v<D>`.

## Step 1 — v1

1. **Carried items.** For design, `grep -n 'Carried items' <HANDOFF>` inside the
   section `## <SPEC> — requirements`; for tasks, inside `## <SPEC> — design`. Take
   the row's value (`none`, or one line per item). Requirements has none.
2. Call the spec-workflow `harness` tool with `action: brief`, `template: drafter`,
   `specName: <SPEC>`, and `values` carrying the output path
   `reviews/drafter-brief-<PHASE>.md` and the drafter fields from `references/briefs.md`
   (the job, including the carried items for the `## Carried from <previous phase>`
   section). The tool fills the read-and-obey line and writes the file; keep the path it
   returns.
3. Spawn `sdd-drafter` with the prompt `Read and execute the instructions in <brief
   path>`. Note each `RE-DECIDED: <req> — <one line>` flag it raised and put them into
   the round-1 reviewer prompt's `## This round` section (Step 2) for a ruling: the
   reviewer rules each `refinement` (closed) or `widening` (a MUST_FIX). Copy each ruling
   into the retro log (`ruling`), the HANDOFF Rulings row, and the next phase's drafter
   brief carried section, so the tasks drafter stops re-flagging it.
4. Spot-check: `grep -n '^#' <document>` shows the template's sections; the Revision
   History has a v1 line; `<spec dir>/codebase-context.md` exists (`ls`). A missing
   context file is `PHASE: error` with `REASON: drafter wrote no codebase-context.md`.
   Note the word count the report states (the cap counts the body only — the H1
   down to the line before `## Revision History`); over the cap is a finding for
   round 1 (write it into the round section as `Over cap: <n> words`), not a stop.
5. Checkpoint commit: `docs(sdd): <SPEC> <PHASE> v1`.
6. D = 1. Run the Lint step. In the `requirements` phase and `MODE: normal`, run the
   **Gate A** step (below), which returns `PHASE: gate-a`; every other phase and mode
   goes to Step 2.

## Lint step

Run once per version, right after the checkpoint commit and before any reviewer spawn.
It never changes D.

1. Call `spec-lint` with `specName: <SPEC>`, `phase: <PHASE>`, and no `projectPath`. If
   the call fails naming an unknown tool (an older server), record `note
   text="spec-lint unavailable; lint skipped"`, set `LINT = skipped`, and end the step:
   no lint pass, no round-prompt bullet.
2. Keep `LINT = { checks: data.checks, findings: data.findings }` in the task list, and
   number `data.findings` `L-1`, `L-2`, … in file order. When `summary.error +
   summary.warning` is 0, set `LINT.open` to every `info` finding and end the step here;
   `info` findings alone spawn nothing.
3. Call `harness` `brief` with `template: reviser`, `specName: <SPEC>`, and `values`
   carrying the output path `reviews/lint-brief-<PHASE>-v<D>.md` and the lint brief's
   fields (job, findings) from `references/briefs.md`.
4. Spawn `sdd-reviser` with `Read and execute the instructions in <brief path>`. After its
   report write one `spawn.usage` carrying `role="lint v<D>"`, `round=<A+1>`, and the
   result from its report.
5. Spot-check: `grep -n 'Lint pass' <document>`.
6. Commit `docs(sdd): <SPEC> <PHASE> v<D> lint` through the commit script
   (`references/cleanup.md`); D does not change — a lint pass consumes no cap fuel.
7. Set `LINT.open` to every `L-n` the `v<D>` Lint-pass bullet (disposition rule 4) names
   rejected, plus every `info` finding. The Lint step runs at most once per version;
   findings left open go to the round prompt.

## Gate A — emit after the v1 lint (requirements, `MODE: normal` only)

Reached from Step 1 item 6, right after the Lint step, only in the `requirements` phase
and only in `MODE: normal`. A resume never reaches it: once v1 is checkpointed Step 0's
`nextStep` is `Step 2`, `Step 3` or `Step R`, never `Step 1`, so a review round or a
revision pass never re-emits gate A (Req 2 AC 3). The drafter already wrote the ranked
gate-A triples to the server surface when it drafted v1 (`sdd-drafter` gate-A step); you
never read them and never read the document body.

1. **Reword trigger.** This pass's fixed findings are `LINT.findings` minus `LINT.open`
   (both on your task list from the Lint step; when `LINT = skipped` there are none).
   From `grep -n '^#' <document>` take the line range of the `## Decisions taken in this
   document` section — its heading line through the line before the next `^#` heading (or
   end of file). Structure read only; never read the section body.
2. **Re-spawn the drafter if a fix landed there.** If any fixed finding's `line` falls
   inside that range, a lint fix may have reworded a ranked decision and the surface is
   stale. Write the gate-A re-spawn brief (`references/briefs.md`) to
   `reviews/gate-a-brief-requirements.md` and spawn `sdd-drafter` with `Read and execute
   the instructions in <brief path>`; it re-reads the lint-corrected section, re-extracts
   and re-ranks the full set, and re-`put`s the complete list (`gate put` overwrites the
   whole file). Record one `spawn.usage` with `role="gate-a v1"` from its report. If no
   fixed finding falls in the range, skip this — the v1 surface still holds.
3. Record `phase.end phase=requirements result=gate-a state=v1`, then report
   `PHASE: gate-a`, `STATE: v1`, `NEXT: run gate A, then re-spawn requirements`. Do not
   run Step 2; the supervisor resolves gate A and re-spawns the phase.

## Step 2 — Review round

1. Count review rounds spawned in this run. If this round would be number
   `BUDGET + 1`, do not spawn it: go to **Budget**.
2. Call `adversarial-review` with `specName: <SPEC>`, `phase: <PHASE>`,
   `verdictBlock: true`. Keep `promptOutputPath`, `analysisOutputPath`, `version`.
3. Read the prompt file (the file tool refuses to overwrite a file it has not read),
   then overwrite it with the scaffold plus the round section from the template. Keep
   everything the scaffold wrote, including its standing directives and verdict block.
   When `GRAPH` is a path, replace the round section's final `<GRAPH is a path: the code
   graph block, filled.>` line with the code graph block (`references/briefs.md`), filled
   from your `GRAPH`, `GRAPH_BUILT_AT` and `GRAPH_BEHIND`; when `GRAPH` is `none`, drop
   that line. Run `bash /tmp/scratchpad/sdd/<SPEC>/append-changes.sh <D> <promptOutputPath>`;
   read only its exit code.
4. Spawn `sdd-reviewer` per the standing spawn rule, with exactly `Read and execute the
   instructions in <promptOutputPath>` as the launch message. Put nothing else in it.
5. Read the verdict block: `tail -8 <analysisOutputPath>`. If the file does not exist,
   the reviewer stalled: spawn it once more from the same prompt file. Still missing ⇒
   `PHASE: error`.
6. **ESCALATE.** If the `ESCALATE:` value is not `none`: when it names security,
   secrets, auth bypass, data loss, destructive migrations, money, billing, pricing,
   legal or compliance, write the HANDOFF section, append a retro-log entry with `retro.sh`
   (`escalation`), and report `PHASE: escalate` with the line as `REASON`. Otherwise
   it is a finding: log it (`gotcha`) and continue.
7. Record `round phase=<PHASE> round=<A> version=v<D> "verdict=<iterate m/s/k | converged m/s/k>"`.
8. Append a retro-log entry with `retro.sh` for the round: category `ruling` if you ruled this round,
   `inefficiency` if this is round 4 or later or the findings came from the previous
   delta, otherwise `gotcha`; the verdict counts in the body; cost = one reviewer spawn.
9. Route:
   - `converged`, or `iterate` with `MUST_FIX: 0` and `SHOULD_FIX: 0` ⇒ Step 5.
   - `iterate` with `MUST_FIX: 0`, `SHOULD_FIX > 0` and D ≥ 2 ⇒ **SHOULD_FIX-only pass**:
     run Step 3's `harness brief` (`template: reviser`) for the SHOULD_FIX items only,
     telling the reviser to end the v(D+1) Revision History line `SHOULD_FIX-only
     corrective pass`; spawn
     `sdd-reviser`, spot-check, checkpoint commit `docs(sdd): <SPEC> <PHASE> v(D+1)
     SHOULD_FIX-only corrective pass`, D = D + 1. Run the Lint step. Then Step 4b
     (narrow check on those items), then Step 5. No further review round.
   - `iterate` with fuel and D ≥ 4 ⇒ **Cap convergence check**.
   - `iterate` with fuel ⇒ **Circling check**; when it does not fire, **Standoff check**,
     then Step 3.

## Step 3 — Revise to v(D+1)

1. Call `harness` `brief` with `template: reviser`, `specName: <SPEC>`, and `values`
   carrying the output path `reviews/reviser-brief-<PHASE>-v<D+1>.md` and the reviser
   fields (job, findings) from `references/briefs.md`.
2. Spawn `sdd-reviser` with `Read and execute the instructions in <brief path>`.
3. Spot-check: `git diff --stat` on the document (through the script in
   `references/cleanup.md`) shows a change, and `grep -n -E '^- \*\*v<D+1>\*\*'
   <document>` finds the new Revision History line.
4. From the reviser's report, record which findings it rejected (id and round) in your
   task list. That tally feeds the standoff check.
5. Checkpoint commit: `docs(sdd): <SPEC> <PHASE> v<D+1> after round <A>`.
6. D = D + 1. Run the Lint step. Go to Step 2.

## Standoff check

A standoff is one finding that the reviewer marks **Recurring** and **MUST_FIX**, and
that the reviser **rejected in the two most recent consecutive rounds**. Detect it with
your rejection tally and `grep -n -i 'recurring' <analysis>`.

When you find one, rule on it yourself: accept or reject on the merits, in one
paragraph. Append to the document's Revision History, under the current version's
line, one bullet `- **Ruling — <finding id>: <accepted | rejected>.** <reason>`. Append
a retro-log entry with `retro.sh` (`ruling`). Add the finding to the "Closed by ruling" list in every
later reviewer prompt and reviser brief for this phase. If you accepted it, it becomes
a finding for the next reviser brief.

## Circling check

Review is circling when the substantive findings — every MUST_FIX and SHOULD_FIX — of
the two most recent consecutive rounds all concern one requirement or one rule: the round
is re-litigating that single item against a fixture, where an adjudication resolves it
faster than another review round. It needs two rounds, so it cannot fire on round 1.
Detect it from the two analyses' finding lines (`grep -n -E 'MUST_FIX|SHOULD_FIX'
<analysis>` for round `A` and round `A-1`) and the requirement or rule each names; the
condition holds only when both rounds name the same single item and nothing else.

When it holds, adjudicate that item instead of spawning another review round. This may
fire before D ≥ 4; the v4 cap in the Cap convergence check and Step 4a is unchanged.

1. Call `harness` `brief` with `template: adjudicator`, `specName: <SPEC>`, and `values`
   carrying the output path `reviews/adjudication-brief-<PHASE>-r<A>.md` and, as the open
   items, every open MUST_FIX and SHOULD_FIX for that requirement or rule by id, title and
   severity; the adjudication fields are in `references/briefs.md`.
2. Spawn `sdd-adjudicator` with `Read and execute the instructions in <brief path>`. After
   its report write one `spawn.usage` carrying `role="adjudication r<A>"` and its result.
3. Spot-check: `grep -n -E '^- \*\*v<D+1>\*\*' <document>` finds the new line.
4. From the report, list the **ruled-out SHOULD_FIX** items (id and title); keep them as
   carried items for the HANDOFF section in Step 6.
5. Checkpoint commit `docs(sdd): <SPEC> <PHASE> v<D+1> circling adjudication`.
6. Append a retro-log entry with `retro.sh` (`inefficiency`: review circled one item for two
   rounds; every item id with `fixed` or `ruled out`).
7. D = D + 1. Go to Step 4b (narrow check on the adjudicated items), then Step 5.

## Cap convergence check

At the cap — an `iterate` with fuel at D ≥ 4 — a converging run earns one more review
round instead of an adjudicator spawn. Grant it, once per phase, only when the last
round's `MUST_FIX` count strictly decreased from the round before it (compare the two
most recent `round` ledger `verdict=` counts, or your per-round task list). When it
decreased and the extra round is not yet spent: note in your task list that the cap's
one extra round is spent, then run the **Standoff check** and Step 3 — a normal revise
and review round. Otherwise — `MUST_FIX` flat or rising, or the extra round already
spent — go to Step 4a. The extra round still obeys `BUDGET` (Step 2, item 1) (retro P11/G3).

## Step 4a — Cap: corrective pass at v(D+1)

Reached when the fourth reviewed version (or a later one) still has `MUST_FIX` or
`SHOULD_FIX` above zero. Nothing reviews the corrective version again.

1. Call `harness` `brief` with `template: adjudicator`, `specName: <SPEC>`, and `values`
   carrying the output path `reviews/adjudication-brief-<PHASE>.md` and, as the open
   items, every open MUST_FIX and SHOULD_FIX from the r<A> analysis by id, title and
   severity (`grep -n -E 'MUST_FIX|SHOULD_FIX' <r<A> analysis>` gives the lines; read only
   those); the adjudication fields are in `references/briefs.md`.
2. Spawn `sdd-adjudicator` with `Read and execute the instructions in <brief path>`.
3. Spot-check: `grep -n -E '^- \*\*v<D+1>\*\*' <document>` finds the line and it
   contains `Post-cap corrective pass`.
4. From the report, list the **ruled-out SHOULD_FIX** items (id and title). They are the
   carried items for the next phase: keep them for the HANDOFF section in Step 6. Also
   carry every MINOR from the r<A> analysis the cap leaves unaddressed — rejected only
   because the word cap forbids the extra words — by id and title with the reason `word
   cap` (retro P11).
5. Checkpoint commit `docs(sdd): <SPEC> <PHASE> v<D+1> post-cap corrective pass`.
6. Append a retro-log entry with `retro.sh` (`inefficiency`: cap hit; every item id with `fixed` or
   `ruled out`).
7. D = D + 1. Go to Step 4b.

## Step 4b — Narrow check

1. Call `adversarial-review` (no `verdictBlock`). Read the prompt file, then overwrite
   it with the narrow-check prompt from the template, listing the items the corrective
   pass fixed (Step 4a's adjudicated items, the Circling check's adjudicated items, or the
   SHOULD_FIX-only pass's SHOULD_FIX items). When `GRAPH` is a path, replace the prompt's
   final `<GRAPH is a path: the code graph block, filled.>` line with the code graph block
   (`references/briefs.md`), filled from your `GRAPH`, `GRAPH_BUILT_AT` and `GRAPH_BEHIND`;
   when `GRAPH` is `none`, drop that line.
2. Spawn `sdd-checker` per the standing spawn rule, with exactly `Read and execute the
   instructions in <promptOutputPath>` as the launch message.
3. Read `grep -n '^VERIFIED:' <analysis>` and, if present, the lines from
   `## Deferred findings` to the end (`sed -n '/^## Deferred findings/,$p'`). Copy each
   deferred finding into the retro log as one entry (`gotcha`, evidence = the analysis
   path).
4. Go to Step 5. Approval always follows the narrow check, whatever `k/n` says; the
   count goes into the approval response.

## Step 5 — Approve

1. Find a pending record for this version: `approvals` `list` with `categoryName:
   <SPEC>`, `filePath` as above, `status: pending`; take the newest whose title ends
   in `v<D>`, if any (a run under the older per-version flow may have left one).
2. Otherwise `approvals` `request` now, with title `<SPEC> <PHASE> v<D>`, the
   `filePath` above, `type: document`, `category: spec`, `categoryName: <SPEC>`. If it
   fails on MDX or tasks-format errors, assemble a reviser brief with `harness` `brief`
   (`template: reviser`, `specName: <SPEC>`) whose findings are the error lines (numbered
   `RI-1`, …), spawn `sdd-reviser`, checkpoint commit `docs(sdd):
   <SPEC> <PHASE> v<D+1> lint fixes`, D = D + 1, and request again once. A second
   failure is `PHASE: error`.
3. `approvals` `approve` on the record with the response format from
   `references/cleanup.md`: version, rounds, final verdict counts, rulings, cap.
4. Go to Step 6.

## Step 6 — Cleanup, then report

Follow `references/cleanup.md` in order: prune, delete the listed files, keep the
memory file and the context file, retro-log phase summary, HANDOFF section (with the
carried items — the ruled-out SHOULD_FIX items from Step 4a plus every MINOR a reviser
or adjudicator rejected in this phase only for the word cap — or `none`), commit. Record
`phase.end phase=<PHASE> result=approved state=v<D> "note=<rounds> rounds, <trajectory>"`.
In the `tasks` phase and `MODE: normal` only, run the **Gate B** step (below) before you
report, so the veto surface holds the list for the supervisor.
Then report `PHASE: approved`, `STATE: v<D>`, `NEXT: <next phase> v1` (after tasks:
`NEXT: implementation`). In the 150 words above the contract, name any scope the
decomposition entry lists that the document cut or deferred, every ruling, and the
carried items.

## Gate B — assemble the veto list (tasks, `MODE: normal`, first approval)

Reached from Step 6, before the report, only in the `tasks` phase and only in
`MODE: normal` — the first time this spec's tasks phase reaches `approved`. In
`MODE: revision` (an annotation's advisory round or a design-defect revalidation) write
no list and skip this step (Req 5 AC 6); the supervisor already holds gate B's result.
You never read the document body.

1. **Class (a).** Call the `harness` tool with `action: gate`, `op: class-a`,
   `specName: <SPEC>`. It reads `tasks.md` and the `## Sensitive paths` list server-side
   and returns `data.items: ClassAItem[]` (`{taskId, title, kind, reason, score}`;
   `score` 2 for a sensitive-path item, 1 for a keyword item). You compute none of it.
2. **Classes (b)/(c).** Collect the kept tags the reviser recorded:
   `grep -n -E '\[gate-(b|c):' <document>` over the Revision History lines (a permitted
   read, the tracking Step 3 item 4 already does for the standoff tally). For each
   distinct `[gate-b:T<id>]`/`[gate-c:T<id>]` tag take its most recent bullet; keep it as
   a VetoCandidateItem `{taskId, class: 'b'|'c', reason}` only when that bullet is marked
   **Rejected** (the task was intentionally kept) — `taskId` and `class` from the tag,
   `reason` from the bullet's one line. Drop a tag whose latest bullet is **Accepted**
   (the task was removed).
3. **Fold into one ranked list.** Map each `ClassAItem` to a `VetoItem`
   (`taskId`→`taskId`, `reason`→`summary`, `kind`→`class: 'a'`) and each
   VetoCandidateItem to a `VetoItem` (`taskId`, `reason`→`summary`, `class`). Order all
   three classes into one list, most consequential first — class (a) items pre-ordered by
   `score` descending — and assign each `rank` last (1 = most consequential). One list,
   not three (Req 4 AC 4).
4. **Compact plan.** Build `tasks: [{id, title}]` for presentation from the task headers:
   `grep -n -E '^- \[[ xX-]\] [0-9]' <document>` gives each task's number and title (a
   structure read like `grep -n '^#'`, never the body); strip any `[gate-b:*]`/
   `[gate-c:*]` tag from a title.
5. **Put.** Call the `harness` tool with `action: gate`, `op: put`, `slot: b`,
   `specName: <SPEC>`, and top-level `payload = { tasks: [...], veto: VetoItem[] }`
   (`gate put` overwrites the whole file). Then finish the Step 6 report as normal
   (`PHASE: approved`); the supervisor reads slot b before the first implementation spawn.

## Step R — Revision input

`MODE: revision` means a human left `needs-revision` comments, or the supervisor
re-opened this phase after a design defect.

1. Call `harness` `brief` with `template: reviser`, `specName: <SPEC>`, and `values`
   carrying the output path `reviews/reviser-brief-<PHASE>-v<D+1>.md` and, as the
   findings, `REVISION_INPUT` (numbered `RI-1`, `RI-2`, …) instead of an analysis file.
   Every item is a MUST_FIX; the reviser may still reject one with a reason.
2. Spawn `sdd-reviser`. Spot-check. Checkpoint commit.
3. D = D + 1. Run the Lint step. Go to Step 2. At least one review round runs before approval, even if
   the document had converged before. The cap rule applies as written: a revised
   document already at v4 or later that iterates goes to Step 4a.

## Budget

When the next review round would exceed `BUDGET`: write the HANDOFF section (state,
D, A, last verdict, rejection tally, rulings), commit, record `phase.end
phase=<PHASE> result=resume state=v<D>`, and report `PHASE: resume`,
`STATE: v<D>`, `NEXT: review v<D>` or `NEXT: revise to v<D+1>` depending on where you
stopped. A fresh orchestrator resumes from Step 0.

## Legacy rules that stay in force

- Never wait on dashboard state; never poll; never treat `BLOCKED` as a stop.
- Load steering documents by phase (the briefs do this): requirements ⇒ `product.md`
  and the decomposition entry; design ⇒ `tech.md`, `structure.md`, `design-system.md`
  when present; tasks ⇒ `structure.md` and this spec's `design.md`.
- Surface any cut scope in the phase report.
- One version of the document in context at a time. Workers read the whole document;
  you do not.
