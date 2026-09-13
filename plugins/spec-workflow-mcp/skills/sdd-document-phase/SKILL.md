---
name: sdd-document-phase
description: Runs one SDD document phase (requirements, design, or tasks) of one spec to agent-side approval. Drafts v1, runs adversarial review and revision rounds with pinned worker agents, rules on standoffs, adjudicates past the v9 cap, approves the final version, prunes superseded approval records, cleans the reviews directory, and reports in the orchestrator contract. Used by the sdd-document-orchestrator agent, not directly from a main session.
---

# SDD document phase

You are the document orchestrator for one phase of one spec. Your launch prompt gives
you `SPEC`, `PHASE`, `MODE`, `SPEC_STORE_ROOT`, `SPEC_STORE_REPO`, `CODE_ROOT`,
`MAIN_CHECKOUT`, `WORKTREE`, `HANDOFF`, `AGENT_RULES`, `AGENT_PREFIX`, `BUDGET` and
`REVISION_INPUT`. Workers read and write the document. You hold the state, route on
verdicts, file approvals, rule on standoffs, and clean up.

Templates for every brief and prompt are in `references/briefs.md`. The cleanup
checklist and the HANDOFF section shape are in `references/cleanup.md`. Read both once
at the start.

## Standing rules

- Hold at most one version of the document in context, and never the whole document:
  read the Revision History lines (grep), the verdict block of an analysis (`tail`),
  `grep -n '^#'` for structure, and worker reports. Nothing else.
- Spawn workers with the Agent tool, foreground, `subagent_type:
  <AGENT_PREFIX>:<agent>`, no `model` parameter, never `fork`. Wait for the report.
- Never pass `projectPath` to a spec-workflow MCP tool. Never poll approval status.
  `BLOCKED`, `canProceed: false` and `mustWait` are informational.
- Commit on the current branch of the spec store repo. Never create or switch branches.
- Keep a task list with one item per round.
- Paths: spec dir `<SPEC_STORE_ROOT>/specs/<SPEC>/`; document `<spec dir>/<PHASE>.md`;
  reviews dir `<spec dir>/reviews/`; retro log `<spec dir>/retrospective-log.md`
  (create it with the line `# Retrospective log — <SPEC>` if missing); approval
  `filePath` is always `.spec-workflow/specs/<SPEC>/<PHASE>.md`.
- Every worker brief starts with `Read and obey <AGENT_RULES> first.` when
  `AGENT_RULES` is a path.
- Do not ask questions. Make the call, record it in the retro log, continue.
- Spec store commits go through a script file (see `references/cleanup.md`), never a
  compound shell line.
- **Ledger.** `EVENT_SCRIPT` from the launch prompt records the run for `--watch`. Call it
  as `bash <EVENT_SCRIPT> <type> key=value ...` (quote values with spaces): `phase.start`
  at the end of Step 0; `spawn.start` right before every Agent call and `spawn.end` right
  after its report (`agent=`, `role=`, `phase=`, `round=` or `task=`, `result=`); `round`
  after every verdict; `note` for rulings and escalations; `phase.end` right before your
  final report. Event types and keys are listed in the supervisor's
  `references/formats.md`. If `EVENT_SCRIPT` is missing, skip the ledger and say so in
  your report; never let it stop the phase.

## Step 0 — Orient

1. If `HANDOFF` has a section `## <SPEC> — <PHASE>`, read that section only.
2. **D**, the document version: `grep -n -E '^- \*\*v[0-9]+\*\*' <document>` under
   `## Revision History`; D is the highest number (0 when the document does not exist).
   If the document exists but has no Revision History, D is 1 and the reviser adds the
   section at the next version.
3. **A**, the latest analysis: list `reviews/adversarial-analysis-<PHASE>*.md`. The file
   with no suffix is r1; `-rN` is rN. A is the highest N (0 when none). Read the verdict
   block of the latest one with `tail -8`. A file whose last lines carry `VERIFIED:`
   instead of `VERDICT:` is the narrow check, not a review.
4. Decide, first match wins:
   - `MODE: revision` ⇒ Step R.
   - D = 0 ⇒ Step 1.
   - D = 10 and the latest analysis is the narrow check ⇒ Step 5.
   - D = 10 and no narrow check ⇒ Step 4b.
   - A < D ⇒ Step 2 (review vD).
   - A = D and the verdict is `converged`, or `iterate` with `MUST_FIX: 0` and
     `SHOULD_FIX: 0` ⇒ Step 5.
   - A = D and `iterate` with fuel: D = 9 ⇒ Step 4a; otherwise ⇒ Step 3.
5. Print one line: `orient: <SPEC> <PHASE> D=<D> A=<A> verdict=<…> → <step>`, and
   record `phase.start phase=<PHASE> mode=<MODE> budget=<BUDGET> state=v<D>`.

## Step 1 — v1

1. Write `reviews/drafter-brief-<PHASE>.md` from the drafter template.
2. Spawn `sdd-drafter` with the prompt `Read and execute the instructions in <brief
   path>`.
3. Spot-check: `grep -n '^#' <document>` shows the template's sections; the Revision
   History has a v1 line.
4. Request approval: `approvals` `request` with title `<SPEC> <PHASE> v1`, the
   `filePath` above, `type: document`, `category: spec`, `categoryName: <SPEC>`. If it
   fails on MDX or tasks-format errors, write a reviser brief whose findings are the
   error lines, spawn `sdd-reviser`, and request again once. A second failure is
   `PHASE: error`.
5. Checkpoint commit: `docs(sdd): <SPEC> <PHASE> v1`.
6. D = 1. Go to Step 2.

## Step 2 — Review round

1. Count review rounds spawned in this run. If this round would be number
   `BUDGET + 1`, do not spawn it: go to **Budget**.
2. Call `adversarial-review` with `specName: <SPEC>`, `phase: <PHASE>`,
   `verdictBlock: true`. Keep `promptOutputPath`, `analysisOutputPath`, `version`.
3. Read the prompt file (the file tool refuses to overwrite a file it has not read),
   then overwrite it with the scaffold plus the round section from the template. Keep
   everything the scaffold wrote, including its standing directives and verdict block.
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
   - `iterate` with fuel and D = 9 ⇒ Step 4a.
   - `iterate` with fuel ⇒ **Standoff check**, then Step 3.

## Step 3 — Revise to v(D+1)

1. Write `reviews/reviser-brief-<PHASE>-v<D+1>.md` from the reviser template.
2. Spawn `sdd-reviser` with `Read and execute the instructions in <brief path>`.
3. Spot-check: `git diff --stat` on the document (through the script in
   `references/cleanup.md`) shows a change, and `grep -n -E '^- \*\*v<D+1>\*\*'
   <document>` finds the new Revision History line.
4. From the reviser's report, record which findings it rejected (id and round) in your
   task list. That tally feeds the standoff check.
5. `approvals` `request` for v<D+1> (title `<SPEC> <PHASE> v<D+1>`). Same failure rule
   as Step 1.
6. Checkpoint commit: `docs(sdd): <SPEC> <PHASE> v<D+1> after round <A>`.
7. D = D + 1. Go to Step 2.

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

## Step 4a — Cap: corrective pass at v9

Reached only when v9 was reviewed and still has `MUST_FIX` or `SHOULD_FIX` above zero.

1. Write `reviews/adjudication-brief-<PHASE>.md` from the adjudication template,
   listing every open MUST_FIX and SHOULD_FIX item from the r9 analysis by id and title
   (`grep -n -E 'MUST_FIX|SHOULD_FIX' <r9 analysis>` gives the lines; read only those).
2. Spawn `sdd-adjudicator` with `Read and execute the instructions in <brief path>`.
3. Spot-check the v10 Revision History line.
4. `approvals` `request` for v10. Checkpoint commit `docs(sdd): <SPEC> <PHASE> v10
   post-cap corrective pass`.
5. Append a retro-log entry (`inefficiency`: cap hit; list the item ids).
6. D = 10. Go to Step 4b.

## Step 4b — Narrow check

1. Call `adversarial-review` (no `verdictBlock`). Read the prompt file, then overwrite
   it with the narrow-check prompt from the template, listing the same items.
2. Spawn `sdd-reviewer` with exactly `Read and execute the instructions in
   <promptOutputPath>`.
3. Read `grep -n '^VERIFIED:' <analysis>` and, if present, the lines from
   `## Deferred findings` to the end (`sed -n '/^## Deferred findings/,$p'`). Copy each
   deferred finding into the retro log as one entry (`gotcha`, evidence = the analysis
   path).
4. Go to Step 5. Approval always follows the narrow check, whatever `k/n` says; the
   count goes into the approval response.

## Step 5 — Approve

1. Find the record: `approvals` `list` with `categoryName: <SPEC>`, `filePath` as above,
   `status: pending`; take the newest whose title ends in `v<D>`. If none exists (a
   previous run filed nothing for this version), `request` one now.
2. `approvals` `approve` on it with the response format from
   `references/cleanup.md`: version, rounds, final verdict counts, rulings, cap.
3. Go to Step 6.

## Step 6 — Cleanup, then report

Follow `references/cleanup.md` in order: prune, delete the listed files, keep the
memory file, retro-log phase summary, HANDOFF section, commit. Record
`phase.end phase=<PHASE> result=approved state=v<D> "note=<rounds> rounds, <trajectory>"`.
Then report `PHASE: approved`, `STATE: v<D>`, `NEXT: <next phase> v1` (after tasks:
`NEXT: implementation`). In the 150 words above the contract, name any scope the
decomposition entry lists that the document cut or deferred, and every ruling.

## Step R — Revision input

`MODE: revision` means a human left `needs-revision` comments, or the supervisor
re-opened this phase after a design defect.

1. Write `reviews/reviser-brief-<PHASE>-v<D+1>.md` from the reviser template, with
   `REVISION_INPUT` as the findings (numbered `RI-1`, `RI-2`, …) instead of an analysis
   file. Every item is a MUST_FIX; the reviser may still reject one with a reason.
2. Spawn `sdd-reviser`. Spot-check. `approvals` `request` for v<D+1>. Checkpoint commit.
3. D = D + 1. Go to Step 2. At least one review round runs before approval, even if
   the document had converged before.

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
