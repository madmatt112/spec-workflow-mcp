# Retrospective — spec-lint

Compiled 2026-09-14 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

Second spec in this store; first under the review-gate close-out changes (PR #30: budget
equals the cap, SHOULD_FIX-only pass ends with `sdd-checker`, reviser rule 9, tracked spec
store, worktree implementation). Findings that measure one of those say so.

## Gotchas

- **F1 — The implementation worktree had no dependency install.** The gate's typecheck
  reported `tsc-not-found`, task 1 scored `risk: high` on a clean 154-line module and a
  verifier was spent; `npm ci` in the worktree fixed it before task 2. The supervisor's
  worktree entry has no install step. Evidence: retrospective-log.md entry 19:59:53Z;
  sdd-continue/SKILL.md:213-217; review-task.ts:815. Frequency: once. Cost: 1 verifier
  spawn, 46k tokens.

- **F2 — The gate's line count includes the three generated `plugins/` copies.** Task 9
  changed 70 net lines of `harness/` but scored 352 lines across 16 files and went to a
  verifier; task 10, the same edit pattern, scored 188 and passed on the gate. The 200
  threshold, not the file count, decides the path for harness tasks. Evidence:
  retrospective-log.md entries 21:32:56Z and 21:37:30Z; Implementation Logs/task-9 file
  list; gate-rules.ts:25, 212-213. Frequency: 1 of 2 harness tasks; seen in review-gate
  (F2) too. Cost: 1 verifier spawn, 77k tokens.

- **F3 — A task with no code diff scores `risk: high`.** Task 12 (build, test, one
  retro-log entry) tripped `no-diff` and `tests-not-touched`, so a verifier was required;
  the orchestrator folded it into the end-to-end verification spawn so `npm test` ran
  once. Evidence: retrospective-log.md entry 21:54:18Z; harness-events.jsonl note
  21:53:40Z; gate-rules.ts:217-228. Frequency: once. Cost: none extra (the 56k verifier
  spawn was needed for VERIFY anyway).

- **F4 — Tool responses through `handleToolCall` are TOON-encoded.** The task 8 test had
  to decode the body with `@toon-format/toon` before asserting on `data`; it worked, so
  deferral `d-a2233b94` ("TOON responses undecodable") may be stale. Evidence:
  retrospective-log.md entry 21:23:45Z; HANDOFF.md `## spec-lint — implementation`
  "Worth working next". Frequency: once. Cost: unknown, inside a 106k implementer spawn.

- **F5 — ESM namespaces cannot be spied.** The read-once and no-read-on-traversal
  assertions in task 3 needed `vi.mock` with `importOriginal` around `node:fs/promises`;
  the implementer spent 110k tokens, the largest of the module tasks. Evidence:
  retrospective-log.md entry 20:35:40Z; Implementation Logs/task-3 summary. Frequency:
  once. Cost: part of a 110k spawn.

## Product bugs found

- **F6 — The console hygiene scan reads every line of a touched file, not only added
  lines.** Task 7's comment-only edit to `root-selection.ts` made the scan report the
  pre-existing `warnOnce` `console` call as a hygiene hit. Evidence:
  src/core/hygiene-signals.ts:21-40 (whole-file scan, never sees a diff);
  retrospective-log.md entry 21:15:13Z (which misattributes it to diff hunks);
  Implementation Logs/task-7 (root-selection.ts in Files Modified). Frequency: once. Cost:
  none (the task was already high on line count).

## Tool and MCP errors or deficiencies

- **F7 — The Edit and Write tools refuse spec-store paths from a worktree-isolated
  session.** The implementation skill's standing rule says to edit `tasks.md` and HANDOFF
  with the Edit tool (review-gate P5); every such edit went through a scratch node script,
  and this retrospective was written to the scratchpad and copied in. Evidence:
  retrospective-log.md phase summary 21:54:18Z; HANDOFF.md implementation Gotchas row;
  sdd-implementation-phase/SKILL.md:37; /tmp/scratchpad/sdd/spec-lint/sedit.mjs.
  Frequency: every spec-store edit in implementation and retrospective; review-gate F5
  was the same class. Cost: one script per run; tokens unknown.

- **F8 — The worktree guard refuses `git` as written in the retrospective skill.** The rtk
  hook rewrites `git` to `rtk git`, which the guard cannot verify; `-C <main checkout>`,
  globs and compound lines are refused too. `/usr/bin/git` with explicit paths passes.
  The skill's Step 1 item 6 commands were refused six times in this run. Evidence:
  sdd-retrospective/SKILL.md Step 1 item 6; sdd-document-phase/references/cleanup.md:75-77
  (already uses `/usr/bin/git`). Frequency: 6 refused calls; review-gate F5 same class.
  Cost: about 6 tool calls.

## Harness defects

- **F9 — The five requirements-phase retro-log entries have empty timestamps.** Their
  headings read `##  · requirements · …`; the design and tasks entries carry clock times.
  Review-gate P8 (commit 1e998d0) made the timestamp come from `date -u`, so the
  substitution, not the rule, failed. Evidence: retrospective-log.md lines 3, 8, 13, 18,
  23 against harness-events.jsonl `round` events 16:13:25Z, 16:48:32Z, 17:17:38Z.
  Frequency: 5 of 5 entries in one phase; review-gate F8 same class. Cost: none; the
  ledger is the timing source.

- **F10 — The active-run pointer was overwritten by a concurrent run in another store.**
  A tradr-hosted run (position-screenshots) replaced it between requirements and design;
  the supervisor noticed and restored it. Evidence: harness-events.jsonl note 17:31:02Z.
  Frequency: once. Cost: none this time; a missed restore sends ledger events to the
  wrong run.

- **F11 — A spec that changes `harness/` cannot verify its harness half in-run.** The
  installed plugin (cache 5.5.0) has no Lint step and the running server has no
  `spec-lint` tool, so task 12's harness verification was deferred to a manual run on a
  scratch store. Evidence: deferral d-473aa261; retrospective-log.md entry 21:47:12Z;
  ~/.claude/plugins/cache/spec-workflow-mcp-marketplace/spec-workflow-harness/5.5.0
  (no `## Lint step`); CLAUDE.md "After a release that changes harness/". Frequency:
  once here; structural for every harness spec. Cost: 1 deferral; a manual step.

- **F12 — `tasks.md` has no `Document version` header.** Cleanup step 6 greps for it and
  `sed`s on mismatch; with zero matches the check silently passes. Requirements and design
  carry `v4` and `v3`. Evidence: `grep -c 'Document version'` on the three documents
  (1, 1, 0); cleanup.md:58-60. Frequency: 1 of 3 documents. Cost: none.

## Prompt misunderstandings

- **F13 — The task 11 implementer's report omitted the commit line.** The orchestrator
  confirmed with `git status` and `git log -1` before gating. Evidence:
  retrospective-log.md entry 21:44:39Z; sdd-implementation-phase/references/briefs.md:207
  (report lists `<sha>`). Frequency: 1 of 13 implementer reports. Cost: 2 tool calls.

## Inefficiencies

- **F14 — The verifier ran for 8 of 12 tasks, 7 of them on the line-count rule alone.**
  Nine verifier spawns, 635k tokens, one `fix-required` verdict (task 2). Six spawns on
  tasks that passed clean (1, 3, 5, 6, 7, 9) cost 443k. The plan's watch line is verifier
  spawns under half of task count; this run is 9/12. Evidence: harness-events.jsonl
  `spawn.end` verify task 1-12; `note` "gate: task N pass risk high" (8 tasks);
  docs/harness-efficiency-plan.md:169; gate-rules.ts:25. Frequency: 8 tasks; review-gate
  F13 (10 of 10, 748k) is the same pattern before the gate. Cost: 443k tokens.

- **F15 — Document phases took 60% of tokens and 66% of wall clock; P9 and P12 measured.**
  2.83M of 4.75M tokens and about 4h10m of 6h18m (review-gate: 67%, 77%, 6h42m). One
  orchestrator spawn per document phase (three, against six in review-gate; P9). The two
  SHOULD_FIX-only passes ended with a checker at 37k and 29k tokens where a reviewer round
  costs 124k-150k (P12). Evidence: harness-events.jsonl `phase.start`/`phase.end` and
  `spawn.end` aggregates; review-gate retrospective-plan.md close-out P9, P12. Frequency:
  this spec. Cost: about 210k saved by P12, about 200k by P9.

## Documentation gaps

- **F16 — Design Component 3 prose contradicts the Data Models block on `promptLines`.**
  Prose says the prompt's text; the block says `number[]`. The task 2 implementer followed
  the prose (plus `Block.lines`, `Criterion.number`) and the verifier found three shape
  findings; the fix realigned to the block. This was the spec's only fix round. Evidence:
  retrospective-log.md entries 20:19:28Z (two); reviews/review-2_v1_2026-09-14T2012.md;
  design.md:164-166; commits ab9b493, 6b335f4. Frequency: once. Cost: 1 fix round, 2
  spawns, 121k tokens.

- **F17 — Design Component 4 lists `/etc/hosts:1` as a `CITATION_RE` match, but the
  design's own regex requires a file extension.** The implementer built the literal; the
  verifier ruled it acceptable. Evidence: retrospective-log.md entry 20:35:40Z;
  Implementation Logs/task-3 NOTE. Frequency: once. Cost: none.

- **F18 — Design Components 6 and 7 kept signatures without `lines` after tasks R1-1.**
  Tasks v2 fixed tasks 5, 6, 7; the design was left stale by ruling because it was
  already approved. The task 5 and 6 implementers re-flagged the gap and the task 7
  brief had to be re-issued with the merged signatures. Evidence: retrospective-log.md
  entries 20:49:56Z, 21:03:56Z; reviews/adversarial-memory-tasks.md ("intentionally left
  with the pre-fix signatures"); /tmp/scratchpad/sdd/spec-lint/impl-brief-task-7-v2.md.
  Frequency: 3 tasks. Cost: 1 re-issued brief; 2 RETRO reports.

- **F19 — Requirements 10.1 and 10.5 are under-cited on the tasks that realise them.**
  Tasks R1-2 added 10.1 to tasks 3-6 but not 1-2; R2-1 left it open as MINOR. Evidence:
  reviews/adversarial-memory-tasks.md Unresolved R2-1; HANDOFF.md tasks row. Frequency:
  twice in one phase. Cost: none.

## Model behaviour

- **F20 — The design drafter misstated two ground facts in v1; the requirements drafter
  misstated none.** Tool count 12 not 13 (`src/tools/index.ts`), and the Lint step placed
  before the `D` increment. Requirements v1-v4 had no misstated citation across three
  rounds. Evidence: reviews/adversarial-analysis-design.md R1-1, R1-2;
  reviews/adversarial-memory-requirements.md ("Three rounds, no misstated artifact").
  Frequency: 2 findings in 1 phase (review-gate F18: 4 in 2 phases). Cost: shaped design
  round 1 (about 300k reviewer plus reviser).

- **F21 — The reviser relocates a defect instead of removing it, with rule 9 live.** In
  requirements, rounds 2 and 3 each found only a defect the previous fix introduced (R2-1
  on R1-1, R3-1 on R2-1) in the same clause, 9.2; the memory file says each fix "relocated
  the conflation instead of removing it". Design R2-1 compounded on R1-3 the same way.
  Rule 9 (fix the class) was in the installed 5.5.0 briefs. Evidence:
  reviews/adversarial-memory-requirements.md "Patterns & Themes" bullet 1;
  reviews/adversarial-memory-design.md "`LINT.open` source is chronically
  under-specified"; retrospective-log.md rounds 2-3 requirements, round 2 design;
  plugins cache 5.5.0 briefs.md:205. Frequency: 3 rounds in 2 phases; review-gate F19
  same. Cost: about 0.8M tokens across reviewer and reviser (ledger averages).

## Process deviations and rulings

- **F22 — Design v3 was accepted at 4,029 words, 29 over the 4,000 cap.** v2 landed at
  exactly 4,000; the mandatory Revision History entry pushed v3 over and the orchestrator
  accepted it as bookkeeping. Evidence: retrospective-log.md entry 19:01:46Z; `wc -w
  design.md`; HANDOFF.md design row. Frequency: once; review-gate design was 4,000/4,000.
  Cost: none.

- **F23 — Task 12 was marked `[x]` with half its verification deferred.** The build and
  test half ran; the harness half (lint brief exists before round 1, round-1 prompt holds
  `## Changes since`) became deferral d-473aa261 with a staged scratch store. Evidence:
  retrospective-log.md entries 21:47:12Z, 21:54:18Z; deferral d-473aa261. Frequency:
  once. Cost: 1 manual run owed.

No orchestrator rulings, no `RE-DECIDED` flags, no adjudication and no cap hit in any
phase; two `sdd-checker` narrow checks ran (requirements v4, design v3).

## Decisions the harness made for the human

- **F24 — All three approvals were agent-side; no human contact from run start to PR
  open.** Approved 17:29:43Z, 19:01:57Z, 19:49:30Z; PR #36 opened 21:54:48Z, 6h16m after
  15:38:38Z. The question gates (efficiency plan Step 3) are not built. Evidence:
  approval_1789406972904_ikcza0zc6, approval_1789412510223_mzylwaioq,
  approval_1789415366866_81h8nvknx; harness-events.jsonl run.start and PR note;
  docs/harness-efficiency-plan.md:139. Frequency: 3; review-gate F21 same. Cost: none.

- **F25 — Three scope cuts were made by agents.** The adjudicator Step 4a write is not
  linted; worker self-lint is deferred (requirements D11); steering and decomposition
  documents are out of scope. They reached the PR body's "Not in this PR" bullet
  (review-gate P22 working). Evidence: HANDOFF.md requirements, design and tasks Cut
  scope rows; /tmp/scratchpad/sdd/spec-lint/pr-body.md:8. Frequency: 3. Cost: none.

F23's deferral is also a decision the human now has to act on.

## Repeat patterns

- Verifier spent on clean tasks through the line rule: review-gate F2, F13 → F2, F14.
- Sandbox and worktree guard refusing spec-store edits and git commands: review-gate F5
  → F7, F8. P5 (Edit tool rule) does not hold in a worktree session.
- Retro-log timestamps wrong or missing: review-gate F8 → F9, after P8 landed.
- Reviser fixes the instance and the next round finds the relocated defect: review-gate
  F19 → F21, after P19 (rule 9) landed.
- Drafter ground errors in v1: review-gate F18 → F20, reduced from four to two.
- Design at or over the 4,000 cap: review-gate summary (4,000/4,000) → F22.
- Agent-side approvals with no human gate: review-gate F21 → F24.
- Scope cuts by agents: review-gate F22 → F25, now visible in the PR body.

## Summary numbers

| Item | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | v4 / v3 / v2 |
| Review rounds | 7 reviewer spawns (3 + 2 + 2) plus 2 checker narrow checks |
| Fix rounds (implementation) | 1 of 12 tasks (task 2) |
| Adjudications / checker spawns | 0 / 2 |
| Escalations | 0 |
| Rulings | 0 |
| Deferrals added | 1 (d-473aa261); 13 deferred in total |
| Orchestrator spawns | 4 (1 + 1 + 1 document, 1 implementation) plus this retro |
| Worker spawns | 40 (3 drafter, 7 reviewer, 6 reviser, 2 checker, 13 implementer, 9 verifier) |
| Tokens | 4.75M: documents 2.83M (60%), implementation 1.92M (40%) |
| Wall clock | 6h18m: requirements 1h51m, design 1h31m, tasks 47m, implementation 2h04m |
| Gate path | 4 tasks gate-only (4, 8, 10, 11); 8 to a verifier |
| Document sizes vs caps | requirements 3,500 / 3,500; design 4,029 / 4,000; tasks 3,745 |
| Commits | 12 code commits on `feat/spec-lint`; 29 spec-store commits on `main` |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/36 (open, mergeable, CI green; +3,047 / -38, 39 files) |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs'
findings, each proposed for promotion into a steering document or agent-rules.md,
with the rule text as it would be written.
