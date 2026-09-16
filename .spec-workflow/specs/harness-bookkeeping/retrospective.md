# Retrospective — harness-bookkeeping

Compiled 2026-09-15 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

Third spec in this store (after review-gate, spec-lint). It builds the bookkeeping it
runs under: a `harness` MCP tool (`orient`/`brief`/`phase-log`), hook-written
`spawn.start`/`spawn.end`, and a `--watch` `spawn.usage` join. The new behaviour only
takes effect after the release republishes and the plugin is re-installed, so this run
was measured by the old ledger. Findings that turn on that say so.

## Gotchas

- **F1 — Both design MUST_FIX rounds were `--watch` fold bookkeeping, not product logic.**
  Design r1 MUST_FIX: prompt-launched workers carry no `-brief` filename, so the hook seam
  and fold erase them and their tokens. Design r2 MUST_FIX (compounds r1): the r1 fix
  mis-folds a prompt-launched worker onto a stale same-agent brief node when the agent type
  is reused (verifier e2e vs per-task; implementer close-out vs batch). The join of hook
  spawn events with orchestrator usage is genuinely hard; two of three design rounds went
  to it. Evidence: retrospective-log.md entries 16:47:27Z, 17:08:11Z, 17:25:02Z;
  reviews/adversarial-analysis-design-r2.md. Frequency: 2 of 3 design rounds. Cost: 2
  reviewer + reviser rounds.

- **F2 — Two phases converged through a SHOULD_FIX-only corrective pass, not a 4th
  reviewer round.** Requirements v3 and tasks v3 each hit `SHOULD_FIX>0, MUST_FIX 0` at r2
  and routed to a corrective pass closed by an `sdd-checker` narrow check (4/4, 1/1)
  instead of a full reviewer spawn. Evidence: retrospective-log.md 15:52:18Z, 18:19:44Z,
  16:11:03Z, 18:29:54Z. Frequency: 2 of 3 document phases. Cost saved: ~2 reviewer spawns
  (review-gate F12/P12 measured this).

## Product bugs found

- **F3 — `orient`'s `classifyTarget` uses broad free-text regexes for the close-out
  `byClass` detail.** Affects only the `byClass` breakdown, not `nextStep` routing; left as
  a non-blocking info finding by the task-2 verifier. Evidence: retrospective-log.md
  18:56:49Z; HANDOFF `## harness-bookkeeping — implementation` Gotchas; src/tools/harness.ts.
  Frequency: once. Cost: none.

## Tool and MCP errors or deficiencies

- **F4 — The worktree sandbox refused a compound `ls`/`grep` line in this retro run.** The
  guard could not verify the compound stayed inside the worktree and refused; it had to be
  split into single commands. Evidence: this retro's first Bash call (refusal on the
  combined HANDOFF/retro/impl-log listing). Frequency: once here; review-gate F5 and
  spec-lint F7/F8 are the same class. Cost: 1 extra tool round.

- **F5 — The `Grep` tool is not available in this session; content search must go through
  `grep` in Bash.** A `Grep` call returned "No such tool available". Evidence: this retro's
  Grep call on HANDOFF.md. Frequency: once. Cost: 1 tool round.

## Harness defects

- **F6 — `event.sh` and `.runid` were rewritten from run `-150006` to `-172935` by a
  concurrent peer supervisor mid-tasks, splitting 25 tasks-phase events across two run
  ids.** No skill or hook writes these files; the likely cause is a concurrent supervisor
  in session `spec-workflow-mcp-33`. Both were restored to `-150006`; existing events left
  as written. Evidence: retrospective-log.md 18:35:22Z; harness-events.jsonl (run ids
  `run-20260915-150006` and `run-20260915-172935`). Frequency: once here; spec-lint F10
  (active-run pointer overwritten by a concurrent run) is the same class. Cost: ledger run
  grouping fragmented for `--watch`; cosmetic.

- **F7 — A docs-only task scored `risk: high` on a tests-not-touched heuristic.** Task 8
  (tool-count doc + a HANDOFF row) tripped the gate and drew a verifier that found nothing.
  Evidence: retrospective-log.md 20:00:53Z. Frequency: once here; spec-lint F3 (no-diff /
  tests-not-touched → high) is the same pattern. Cost: 1 verifier spawn.

- **F8 — A spurious task-7 gate `fail` came from the orchestrator passing a `plugins`
  directory instead of the individual file paths to the gate `files` list.** Re-ran the
  gate clean, no fix round. Evidence: retrospective-log.md 19:55:47Z; HANDOFF implementation
  section. Frequency: once. Cost: 1 extra gate run.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F9 — A verifier ran for 5 of 8 tasks (2,4,5,7,8), each on the line-count or
  sensitive-path rule, all passing with 0 findings.** Tasks 1, 3, 6 correctly went gate-only
  on low risk, so the gate is working; the spend is on high-line-count harness tasks.
  Evidence: retrospective-log.md task entries; ledger `sdd-verifier` n=6. Frequency: 5 of 8
  tasks; review-gate F13 (10/10) and spec-lint F14 (8/12) are the same pattern. Cost: 5
  verifier spawns, ~0 findings.

- **F10 — `harness/` edits regenerate three `plugins/` copies, inflating the diff that the
  gate line-count rule reads.** Task 7 changed 160 net lines but touched 20 files and 1,384
  changed lines across the three plugin copies, scoring high and drawing a verifier.
  Evidence: Implementation Logs/task-7 (+772/-612, 20 files); retrospective-log.md
  19:55:47Z. Frequency: once here; review-gate F2 and spec-lint F2 are the same. Cost:
  folds into F9's verifier spend; structural for every harness spec.

- **F11 — Recurring spec-lint citation false positives cost three lint passes per design
  version.** The citation-identifier rule flagged backticked plain words and design-coined
  field names as absent artifacts (~26–49 each version) and the citation-path rule
  re-flagged bare `render.ts`. Evidence: retrospective-log.md 17:26:49Z. Frequency: 3 lint
  passes in the design phase. Cost: ~3 reviser lint spawns.

## Documentation gaps

- **F12 — Close-out batch and impl fix-round briefs carry no `tasks.md` taskId, so they
  cannot use the server `implementer` template (it requires taskId/taskBlock).** The task-7
  implementer mapped them to `reviser`/`adjudicator` instead. Evidence: retrospective-log.md
  19:52:34Z; harness/skills/sdd-continue/SKILL.md, harness/skills/sdd-closeout-phase/SKILL.md.
  Frequency: once. Cost: none; resolve in the deferred D2 `briefs.md`-port follow-up.

- **F13 — `docs/TOOLS-REFERENCE.md` said 13 tools where the new `harness` tool makes 14.**
  Caught as design r3 MINOR R3-1, fixed in task 8. Evidence: retrospective-log.md
  17:25:02Z; commit 00fdec7. Frequency: once. Cost: folded into task 8.

## Model behaviour

- **F14 — Fable was out of credits; every SDD agent ran on opus via override, and a
  requirements drafter was re-spawned on opus after hitting the credit limit mid-phase.**
  Evidence: retrospective-log.md 18:29:54Z; HANDOFF phase-log row (requirements). Frequency:
  whole run. Cost: opus token rates plus one extra drafter spawn.

- **F15 — The drafter did not misstate a code artifact in v1 of any phase.** Requirements
  and design v1 each carried one MUST_FIX, but both were genuine design-difficulty gaps
  (F1), and the r1 logs record the citations as accurate. The review-gate F18 / spec-lint
  F20 "drafter ground error in v1" pattern did not recur. Evidence: retrospective-log.md
  15:27:30Z, 16:47:27Z. Frequency: 0 misstatements. Cost: none — an improvement.

## Process deviations and rulings

- **F16 — Zero rulings, adjudications, escalations and cap hits.** Both corrective passes
  (F2) were SHOULD_FIX-only routes, not the v4 cap. Two narrow-check deferred observations
  were recorded, not acted on: task 7's grep done-condition matches the approved/complete
  and closed phase rows but not the `resume` row (:192-193), and design Component 7's
  `:180-199` citation is a loose superset of the `:187-193` write sites. Evidence:
  retrospective-log.md 18:28:34Z (two entries). Frequency: 2 observations. Cost: 0.

## Decisions the harness made for the human

- **F17 — Every phase approval was agent-side; the human was not contacted from run start
  to PR open.** Evidence: approvals `_2j5fb0jwj`, `_hu3xk15p0`, `_0imaqu57g`. Frequency: 3;
  review-gate F21 and spec-lint F24 are the same. The R7 question gates are still unbuilt
  and, per project memory, need their own spec. Cost: none.

- **F18 — Two scope cuts were made by agents and recorded in HANDOFF and the PR body.** D2:
  porting the `briefs.md` templates into a synced server template set is deferred; D4:
  retrospective `orient` is a preconditions check, out of the tool's five routing states.
  Evidence: HANDOFF Cut-scope rows (requirements/design/tasks). Frequency: 2; review-gate
  F22 and spec-lint F25 are the same. Cost: none.

- **F19 — One deferral (`d-324dbe0d`) hands the human a live-plugin verification the run
  could not do itself.** The new `harness` tool and hook spawn events only reach the live
  server/plugin after the release republishes and the plugin is re-installed. Evidence:
  deferral d-324dbe0d (tag `verification`); HANDOFF "Deferred verification". Frequency: once
  here; spec-lint F11/F23 (a harness spec cannot verify its harness half in-run) is
  structural for every harness spec. Cost: 1 manual run owed; blocks step-3 of the plan.

## Repeat patterns

- Verifier spent on clean tasks via the line-count / sensitive-path rule: review-gate F13,
  spec-lint F14 → F9.
- `harness/` edits inflate the gate line count through generated `plugins/` copies:
  review-gate F2, spec-lint F2 → F10.
- The synthesis/reviser fix opens a seam the next round finds: review-gate F19, spec-lint
  F21 → F1 (design r2 compounds r1).
- Worktree/sandbox guard refuses compound lines and spec-store edits: review-gate F5,
  spec-lint F7/F8 → F4.
- A concurrent run in a peer session clobbers shared run-state: spec-lint F10 → F6.
- Gate scores `risk: high` on a no-code / docs-only task: spec-lint F3 → F7.
- Agent-side approvals with no human gate: review-gate F21, spec-lint F24 → F17.
- Scope cuts by agents, now in the PR body: review-gate F22, spec-lint F25 → F18.
- A harness spec cannot verify its harness half in-run and defers it: spec-lint F11/F23 →
  F19.
- Did **not** recur (fixes held): retro-log timestamps are correct this run (review-gate
  F8, spec-lint F9 fixed); the spec store is git-tracked with full history (review-gate F3
  fixed); drafter v1 ground errors gone (F15).

## Summary numbers

| Item | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | v3 / v3 / v3 |
| Review rounds | 7 reviewer spawns (2 + 3 + 2) plus 2 checker narrow checks |
| Fix rounds (implementation) | 0 of 8 tasks |
| Adjudications / checker spawns | 0 / 2 |
| Escalations | 0 |
| Rulings | 0 |
| Deferrals added | 1 (`d-324dbe0d`); 14 deferred in total |
| Orchestrator spawns | 4 (3 document, 1 implementation) plus this retro |
| Worker spawns | 44 (6 drafter, 7 reviewer, 15 reviser, 2 checker, 8 implementer, 6 verifier) |
| Tokens | Not reliably recorded: only the implementation orchestrator's `spawn.end` carried a count (192,761); worker `spawn.end` events lack tokens — the gap this spec's `spawn.usage` join closes going forward |
| Gate path | 3 tasks gate-only (1, 3, 6); 5 to a verifier (2, 4, 5, 7, 8) |
| Code commits | 8 on `feat/harness-bookkeeping` (8785ec5..00fdec7) |
| Spec-store commits | ~20 tracked `docs(sdd)` commits |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/41 (open, CI green) |

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
