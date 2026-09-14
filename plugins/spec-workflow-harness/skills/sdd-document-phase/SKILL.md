---
name: sdd-document-phase
description: Runs one SDD document phase (requirements, design, or tasks) of one spec to agent-side approval. Drafts v1, runs adversarial review and revision rounds with pinned worker agents, rules on standoffs, adjudicates past the v4 cap, approves the final version, prunes superseded approval records, cleans the reviews directory, and reports in the orchestrator contract. Used by the sdd-document-orchestrator agent, not directly from a main session.
---

# SDD document phase

You are the document orchestrator for one phase of one spec. Your launch prompt gives
you `SPEC`, `PHASE`, `MODE`, `SPEC_STORE_ROOT`, `SPEC_STORE_REPO`, `CODE_ROOT`,
`MAIN_CHECKOUT`, `WORKTREE`, `HANDOFF`, `AGENT_RULES`, `AGENT_PREFIX`, `BUDGET` and
`REVISION_INPUT`. Workers read and write the document. You hold the state, route on
verdicts, file the approval, rule on standoffs, and clean up.

Templates for every brief and prompt are in `references/briefs.md`. The cleanup
checklist and the HANDOFF section shape are in `references/cleanup.md`. Read both once
at the start.

## Standing rules

- Hold at most one version of the document in context, and never the whole document:
  read the Revision History lines (grep), the verdict block of an analysis (`tail`),
  `grep -n '^#'` for structure, and worker reports. Nothing else.
- Spawn workers with the Agent tool, foreground, `subagent_type:
  <AGENT_PREFIX>:<agent>`, no `model` parameter, never `fork`. Workers are
  `sdd-drafter`, `sdd-reviewer`, `sdd-reviser`, `sdd-adjudicator` and `sdd-checker`.
  Wait for the report.
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
- Do not ask questions. Make the call, record it in the retro log, continue.
- Spec store commits go through a script file (see `references/cleanup.md`), never a
  compound shell line.
- **One approval record per phase.** The approval `request` happens once, in Step 5,
  for the version being approved. Versions live in the checkpoint commits.
- **Ledger.** `EVENT_SCRIPT` from the launch prompt records the run for `--watch`. Call it
  as `bash <EVENT_SCRIPT> <type> key=value ...` (quote values with spaces): `phase.start`
  at the end of Step 0; `spawn.start` right before every Agent call and `spawn.end` right
  after its report (`agent=`, `role=`, `phase=`, `round=` or `task=`, `result=`,
  `tokens=<n>` from the token count the Agent result states in its footer); `round`
  after every verdict; `note` for rulings and escalations; `phase.end` right before your
  final report. Event types and keys are listed in the supervisor's
  `references/formats.md`. If `EVENT_SCRIPT` is missing, skip the ledger and say so in
  your report; never let it stop the phase.

## Step 0 — Orient

1. If `HANDOFF` has a section `## <SPEC> — <PHASE>`, read that section only.
2. **D**, the document version: `grep -n -E '^- \*\*v[0-9]+\*\*' <document>` under
   `## Revision History`; D is the highest number (0 when the document does not exist).
   If the document exists but has no Revision History, D is 1 and the reviser adds the
   section at the next version. **P**, corrective pass: true when the line for v<D>
   contains `Post-cap corrective pass` or `SHOULD_FIX-only corrective pass`.
3. **A**, the latest analysis: list `reviews/adversarial-analysis-<PHASE>*.md`. The file
   with no suffix is r1; `-rN` is rN. A is the highest N (0 when none). Read the verdict
   block of the latest one with `tail -8`. A file whose last lines carry `VERIFIED:`
   instead of `VERDICT:` is the narrow check, not a review.
4. Decide, first match wins:
   - `MODE: revision` ⇒ Step R.
   - D = 0 ⇒ Step 1.
   - P and the latest analysis is the narrow check ⇒ Step 5.
   - P and no narrow check ⇒ Step 4b.
   - A < D ⇒ Step 2 (review vD).
   - A = D and the verdict is `converged`, or `iterate` with `MUST_FIX: 0` and
     `SHOULD_FIX: 0` ⇒ Step 5.
   - A = D and `iterate` with `MUST_FIX: 0`, `SHOULD_FIX > 0` and D ≥ 2 ⇒ the
     SHOULD_FIX-only pass in Step 2 item 9.
   - A = D and `iterate` with fuel: D ≥ 4 ⇒ Step 4a; otherwise ⇒ Step 3.
5. Print one line: `orient: <SPEC> <PHASE> D=<D> A=<A> verdict=<…> → <step>`, and
   record `phase.start phase=<PHASE> mode=<MODE> budget=<BUDGET> state=v<D>`.

## Step 1 — v1

1. **Carried items.** For design, `grep -n 'Carried items' <HANDOFF>` inside the
   section `## <SPEC> — requirements`; for tasks, inside `## <SPEC> — design`. Take
   the row's value (`none`, or one line per item). Requirements has none.
2. Write `reviews/drafter-brief-<PHASE>.md` from the drafter template, with the carried
   items in its `## Carried from <previous phase>` section.
3. Spawn `sdd-drafter` with the prompt `Read and execute the instructions in <brief
   path>`. Note each `RE-DECIDED: <req> — <one line>` flag it raised and put them into
   the round-1 reviewer prompt's `## This round` section (Step 2) for a ruling: the
   reviewer rules each `refinement` (closed) or `widening` (a MUST_FIX). Copy each ruling
   into the retro log (`ruling`), the HANDOFF Rulings row, and the next phase's drafter
   brief carried section, so the tasks drafter stops re-flagging it.
4. Spot-check: `grep -n '^#' <document>` shows the template's sections; the Revision
   History has a v1 line; `<spec dir>/codebase-context.md` exists (`ls`). A missing
   context file is `PHASE: error` with `REASON: drafter wrote no codebase-context.md`.
   Note the word count the report states; over the cap is a finding for round 1
   (write it into the round section as `Over cap: <n> words`), not a stop.
5. Checkpoint commit: `docs(sdd): <SPEC> <PHASE> v1`.
6. D = 1. Run the Lint step. Go to Step 2.

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
3. Write `reviews/lint-brief-<PHASE>-v<D>.md` from the lint brief template in
   `references/briefs.md`.
4. Spawn `sdd-reviser` with `Read and execute the instructions in <brief path>`, wrapped
   in `spawn.start`/`spawn.end` carrying `role="lint v<D>"` and `round=<A+1>`.
5. Spot-check: `grep -n 'Lint pass' <document>`.
6. Commit `docs(sdd): <SPEC> <PHASE> v<D> lint` through the commit script
   (`references/cleanup.md`); D does not change — a lint pass consumes no cap fuel.
7. Set `LINT.open` to every `L-n` the `v<D>` Lint-pass bullet (disposition rule 4) names
   rejected, plus every `info` finding. The Lint step runs at most once per version;
   findings left open go to the round prompt.

## Step 2 — Review round

1. Count review rounds spawned in this run. If this round would be number
   `BUDGET + 1`, do not spawn it: go to **Budget**.
2. Call `adversarial-review` with `specName: <SPEC>`, `phase: <PHASE>`,
   `verdictBlock: true`. Keep `promptOutputPath`, `analysisOutputPath`, `version`.
3. Read the prompt file (the file tool refuses to overwrite a file it has not read),
   then overwrite it with the scaffold plus the round section from the template. Keep
   everything the scaffold wrote, including its standing directives and verdict block.
   Run `bash /tmp/scratchpad/sdd/<SPEC>/append-changes.sh <D> <promptOutputPath>`; read
   only its exit code.
4. Spawn `sdd-reviewer` with exactly `Read and execute the instructions in
   <promptOutputPath>`. Put nothing else in the launch message.
5. Read the verdict block: `tail -8 <analysisOutputPath>`. If the file does not exist,
   the reviewer stalled: spawn it once more from the same prompt file. Still missing ⇒
   `PHASE: error`.
6. **ESCALATE.** If the `ESCALATE:` value is not `none`: when it names security,
   secrets, auth bypass, data loss, destructive migrations, money, billing, pricing,
   legal or compliance, write the HANDOFF section, append a retro-log entry
   (`escalation`), and report `PHASE: escalate` with the line as `REASON`. Otherwise
   it is a finding: log it (`gotcha`) and continue.
7. Record `round phase=<PHASE> round=<A> version=v<D> "verdict=<iterate m/s/k | converged m/s/k>"`.
8. Append a retro-log entry for the round: category `ruling` if you ruled this round,
   `inefficiency` if this is round 4 or later or the findings came from the previous
   delta, otherwise `gotcha`; the verdict counts in the body; cost = one reviewer spawn.
9. Route:
   - `converged`, or `iterate` with `MUST_FIX: 0` and `SHOULD_FIX: 0` ⇒ Step 5.
   - `iterate` with `MUST_FIX: 0`, `SHOULD_FIX > 0` and D ≥ 2 ⇒ **SHOULD_FIX-only pass**:
     write a Step 3 reviser brief for the SHOULD_FIX items only, telling the reviser to
     end the v(D+1) Revision History line `SHOULD_FIX-only corrective pass`; spawn
     `sdd-reviser`, spot-check, checkpoint commit `docs(sdd): <SPEC> <PHASE> v(D+1)
     SHOULD_FIX-only corrective pass`, D = D + 1. Run the Lint step. Then Step 4b
     (narrow check on those items), then Step 5. No further review round.
   - `iterate` with fuel and D ≥ 4 ⇒ Step 4a.
   - `iterate` with fuel ⇒ **Standoff check**, then Step 3.

## Step 3 — Revise to v(D+1)

1. Write `reviews/reviser-brief-<PHASE>-v<D+1>.md` from the reviser template.
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
a retro-log entry (`ruling`). Add the finding to the "Closed by ruling" list in every
later reviewer prompt and reviser brief for this phase. If you accepted it, it becomes
a finding for the next reviser brief.

## Step 4a — Cap: corrective pass at v(D+1)

Reached when the fourth reviewed version (or a later one) still has `MUST_FIX` or
`SHOULD_FIX` above zero. Nothing reviews the corrective version again.

1. Write `reviews/adjudication-brief-<PHASE>.md` from the adjudication template,
   listing every open MUST_FIX and SHOULD_FIX item from the r<A> analysis by id, title
   and severity (`grep -n -E 'MUST_FIX|SHOULD_FIX' <r<A> analysis>` gives the lines;
   read only those).
2. Spawn `sdd-adjudicator` with `Read and execute the instructions in <brief path>`.
3. Spot-check: `grep -n -E '^- \*\*v<D+1>\*\*' <document>` finds the line and it
   contains `Post-cap corrective pass`.
4. From the report, list the **ruled-out SHOULD_FIX** items (id and title). They are the
   carried items for the next phase: keep them for the HANDOFF section in Step 6.
5. Checkpoint commit `docs(sdd): <SPEC> <PHASE> v<D+1> post-cap corrective pass`.
6. Append a retro-log entry (`inefficiency`: cap hit; every item id with `fixed` or
   `ruled out`).
7. D = D + 1. Go to Step 4b.

## Step 4b — Narrow check

1. Call `adversarial-review` (no `verdictBlock`). Read the prompt file, then overwrite
   it with the narrow-check prompt from the template, listing the items the corrective
   pass fixed (Step 4a's adjudicated items, or the SHOULD_FIX-only pass's SHOULD_FIX
   items).
2. Spawn `sdd-checker` with exactly `Read and execute the instructions in
   <promptOutputPath>`.
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
   fails on MDX or tasks-format errors, write a reviser brief whose findings are the
   error lines (numbered `RI-1`, …), spawn `sdd-reviser`, checkpoint commit `docs(sdd):
   <SPEC> <PHASE> v<D+1> lint fixes`, D = D + 1, and request again once. A second
   failure is `PHASE: error`.
3. `approvals` `approve` on the record with the response format from
   `references/cleanup.md`: version, rounds, final verdict counts, rulings, cap.
4. Go to Step 6.

## Step 6 — Cleanup, then report

Follow `references/cleanup.md` in order: prune, delete the listed files, keep the
memory file and the context file, retro-log phase summary, HANDOFF section (with the
carried items from Step 4a, or `none`), commit. Record
`phase.end phase=<PHASE> result=approved state=v<D> "note=<rounds> rounds, <trajectory>"`.
Then report `PHASE: approved`, `STATE: v<D>`, `NEXT: <next phase> v1` (after tasks:
`NEXT: implementation`). In the 150 words above the contract, name any scope the
decomposition entry lists that the document cut or deferred, every ruling, and the
carried items.

## Step R — Revision input

`MODE: revision` means a human left `needs-revision` comments, or the supervisor
re-opened this phase after a design defect.

1. Write `reviews/reviser-brief-<PHASE>-v<D+1>.md` from the reviser template, with
   `REVISION_INPUT` as the findings (numbered `RI-1`, `RI-2`, …) instead of an analysis
   file. Every item is a MUST_FIX; the reviser may still reject one with a reason.
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
