# Retrospective — dashboard-ruling-view

Compiled 2026-11-10 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — A root-walking Success grep tripped file-outside-list on task 11.** Task 11's own
  success check `grep -rn AnswerSheet src e2e` matched a task-10 author test
  (`src/dashboard/shell/__tests__/ruling-view.test.ts`) whose prose comments cited
  "AnswerSheet.tsx". That file was absent from task 11's File: list, so no implementer edit
  could clear the verdict; the phase re-entered as design-defect at tasks 10/13, a coordinator
  escalation added the file to tasks.md and reworded the two comments. Evidence: retro log
  2026-11-10T03:51:33Z; phase.end design-defect; escalation note 03:52:21Z; spec commit 71ad9aef;
  two task-11 red commits b282c875 / cf7716d2. Frequency: once. Cost: 1 escalation, 1 phase
  re-entry, 1 extra red commit.
- **F2 — Task 1 TDD was red-impossible; negative tests shipped as regression guards.** Base
  `createWait` ignores unknown input fields, so the new detail/commits keys are never stored at
  base; the two negative tests pass unchanged and were kept as guards, not forced red. Evidence:
  retro log 2026-11-10T00:47:04Z (task 1 doc-gap); commit c514fedf. Frequency: once (of 10 TDD
  tasks: 5 assertion-red, 5 structural-red, 0 vacuous). Cost: author judgement, no fix round.

## Product bugs found

- **F3 — Back to board leaves a stale answer-stage entry in useStages.** Design C9 ("Back to
  board clears the key's stage too") was not implemented literally: `HomePage.backToBoard` clears
  only `openWaitId`/`openWaitSnapshot`, leaving the `wait:<id>` entry in `stages.stages`. Inert —
  only visible effect is a brief stale "failed: …" when the same still-open wait is reopened after
  a failed answer, cleared on the next press. A proper fix needs a `clear(key)` on useStages, which
  task 12's File: list and restriction forbid. Deferred. Evidence: deferral d-f1167a89; verifier
  task-12 review, round 0. Frequency: once. Cost: 1 deferral.

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F4 — `isTddMarked` matches `kind: e2e` anywhere in the task block and crashed the run.**
  `isTddMarked` (`src/controller/phases/implementation.ts:256`) tests `/\bkind:\s*e2e\b/` over the
  whole block, so backtick code spans or prompt prose quoting `kind: e2e` flip a real TDD task to
  implementer-only and skip the test author. Task 7 stopped with "brief: required values
  'authorFiles', 'authorReport' missing" because the controller and the brief tool
  (`src/tools/harness.ts:751`, its own any-Test-line rule) disagree on marking. A quick fix landed
  on main (always send empty author keys for an implementer-only task with tests); it stops the
  crash, not the false positive. Evidence: deferral d-9c725b5d; code-repo commit e09ed20f
  `fix(controller): brief a kind: e2e task that has a Test line`. Frequency: once (one run-stopping
  crash). Cost: run halt + quick-fix commit + 1 deferral.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F5 — TDD marking logic is duplicated across the controller and the brief tool.** Two
  independent rules decide the same routing (block-wide regex vs any-Test-line); the mismatch, not
  a single bug, is what crashed task 7. One shared rule in core would remove the class. Evidence:
  deferral d-9c725b5d context (two cited sources). Frequency: once. Cost: folded into F4.

## Documentation gaps

- **F6 — The `kind: e2e` marker has no documented convention.** No tasks-drafter rule defines the
  marker; the one real use (tradr) writes it inline in a Purpose line, which is exactly the prose
  shape that trips the block-wide match. Evidence: deferral d-9c725b5d context. Frequency: once.
  Cost: contributed to the F4 crash; otherwise unknown.

## Model behaviour

None found. The implementation ran clean: 13 tasks, 0 fix rounds, 0 adjudications (retro log
2026-11-10T04:49:42Z).

## Process deviations and rulings

- **F7 — Coordinator escalation on task 11's File: list.** Accepted:
  `src/dashboard/shell/__tests__/ruling-view.test.ts` added to task 11 File entries, the two
  comments at ~313/321 reworded to cite the retired answer sheet by behaviour, no test code
  changed; the task re-ran and passed. Evidence: escalation note 2026-11-10T03:52:21Z; task-11
  review v1 verdict pass; spec commit 71ad9aef. Frequency: once (0 adjudications). Cost: 1
  escalation.

## Decisions the harness made for the human

- **F8 — Stale-stage bug deferred as a harness-owned info-finding, not escalated.** The verifier
  logged the C9 gap as inert and within task 12's restriction, so it was deferred rather than
  surfaced for a ruling. Evidence: deferral d-f1167a89 (owner harness). Frequency: once. Cost: 1
  deferral.
- **F9 — The `kind: e2e` crash was quick-fixed and the remainder deferred, harness-owned, no human
  ruling.** Evidence: deferral d-9c725b5d (owner harness); commit e09ed20f. Frequency: once. Cost:
  folded into F4.

## Repeat patterns

- **F1 ↔ dashboard-project-list F1, dashboard-loop-views F4/F5, dashboard-shell F3,
  harness-usage-and-tiers F3.** A root-walking Success grep or export-guard test edits a file the
  task's File: list omits, producing an unfixable file-outside-list verdict. Already codified as
  agent-rules retro P12 (root-walking scrub must list every file holding the symbol, comment hits
  count) — and it recurred here anyway. Evidence this spec: retro log 2026-11-10T03:51:33Z.
- **F2 ↔ dashboard-loop-views F10, advisor, dashboard-board.** A TDD branch is red-impossible at
  base and needs a hand-named, non-counted regression guard. Evidence this spec: retro log
  2026-11-10T00:47:04Z; dashboard-loop-views/retrospective.md:80.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | requirements v2, design v2, tasks v2 |
| Review rounds | requirements 2, design 2, tasks 2 |
| Fix rounds (impl) | 0 across 13 tasks |
| Adjudications | 0 |
| Escalations | 1 (task 11 File: list) |
| Rulings | 0 |
| Deferrals added | 2 (d-9c725b5d, d-f1167a89); ledger note said 1 — a floor |
| Spawns | 48 (impl: 14 implementer, 10 test-author, 6 verifier; + reviser/reviewer/checker across doc phases) |
| TDD | 10 tasks: assertion-red 5, structural-red 5, vacuous 0 |
| Verifier-skipped | task 13 (gate-only, final implementer-only — not re-logged) |
| PR | #215, merged |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  Eval case: <case id — what its grader checks | none — why>. Required when Target is
  harness skills or agents, or server code, docs or templates.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs' findings,
each proposed for promotion into a steering document or agent-rules.md, with the rule text as
it would be written.
