# Adversarial Review Memory — tasks

Last updated: 2026-10-03 (round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1 just delivered)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved (round 1, awaiting drafter)
- **R1-1 — SHOULD_FIX.** Task 9 lists a `reconcile` variant of the `fix` kind (design C6)
  with no verbatim source and no rule distinguishing it from `ci`; unbuildable cold, and
  task 13 never consumes a `reconcile` fix variant. Cite its source or fold into `ci`.
- **R1-2 — SHOULD_FIX.** Task 11's grep `"150 words\|120 words\|100 words"` over
  `harness/agents docs/SDD-HARNESS.md` hits (a) `sdd-implementer.md:3` frontmatter (task
  forbids frontmatter edits; leaves it stating 150 vs new 80-word cap), (b)
  `sdd-retro-analyst.md:26` (out-of-scope; retro orchestrator keeps its shape), (c)
  `docs/SDD-HARNESS.md:78` "each task block 150 words" (task-block size, not a report cap).
  "orchestrator caps stay" does not cover these.
- **R1-3 — SHOULD_FIX.** Task 13's grep `"20 tasks\|default 20\|20-task"` over `harness…`
  returns `sdd-continue/SKILL.md:291` — the supervisor launch line that task 14 owns and
  that is NOT in task 13's File list. Its only exception names
  `docs/harness-efficiency-plan.md`, outside the grep scope. Scope the grep to the impl
  skill or except :291.
- **R1-4 — SHOULD_FIX.** Task 14's grep `"12 orchestrator spawns\|Runaway guard"` misses
  `docs/SDD-HARNESS.md:133` ("More than twelve spawns for one phase is an error" — spelled
  "twelve", no "Runaway guard" label). The phase-agnostic statement then ships wrong for
  implementation. "finds each statement" is false.
- **R1-5 — MINOR.** Tasks 7/10 grep `"six\|drafter, reviser"` finds only false positives
  (`harness.test.ts:50` "six fixture states"; `TOOLS-REFERENCE.md:523` "sixteen" rules — a
  correct count); no brief-kind count word exists. "update every count word it finds" risks
  corrupting "sixteen". Tasks 8/9 (the real count-changers) name no count grep.

## Rulings carried (closed on reviewer authority)
- **Req 7.3 runaway-guard basis → refinement (closed).** Design D14 / task 14 size the
  guard from `data.tasks.total`, not Req 7.3's literal "open tasks at phase start." Stays
  within the requirement's intent (allowance never shrinks, never trips spuriously; total
  also survives supervisor restart) and was already adjudicated in design R2-4 (approved
  v4). NOTE for next drafter: Req 7.3 TEXT is now stale; reconcile on a requirements touch.

## Patterns & Themes
- **Count/length greps are the weak spot.** 4 of 5 pinned greps are defective: digit-form
  patterns ("12","20","six") miss word-form doc statements ("twelve","twenty"), collide
  with forbidden frontmatter, over-reach into another task's files / out-of-scope agents, or
  match only noise. `agent-rules.md` "Documents" bar (a grep that finds every dependent
  count/length assertion) is not met across tasks 7, 10, 11, 13, 14.
- **Clean elsewhere.** Citations (including the full `## Changes since` lint delta), brief
  verbatim source ranges, Test-line seams, success-clause coverage, requirement→task
  coverage, ordering of the server/brief/skill chain, and gate-B/gate-C are all sound.

## Guidance for Next Review
- Verify the drafter fixed the five greps (scope + word-form terms + explicit exceptions)
  and resolved the `reconcile` variant; re-check that task 13 no longer edits
  `sdd-continue/SKILL.md:291`.
- Do not re-open the Req 7.3 refinement ruling.
- If greps are corrected, re-confirm each still catches its intended targets AND nothing
  out of scope by running them against the tree.
- A clean round is acceptable; do not keep the loop alive on MINOR-only residue.
