# Adversarial Review Memory — tasks
Last updated: 2026-10-03 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (v1, SHOULD_FIX).** `reconcile` fix variant had no source/consumer. Fixed in v2:
  task 9 sources `ci`+`reconcile` from briefs.md:232-253; task 13 names the Reconcile step
  as consumer. **Verified accurate in round 2** (Reconcile step uses reviser template with
  CI-fix content; verifier/ci from :255-267).
- **R1-2 (v1, SHOULD_FIX).** Task 11 report-cap grep swept frontmatter + out-of-scope agents.
  Fixed in v2: grep scoped to `harness/agents`; all 14 hits dispositioned; implementer
  frontmatter :3 corrected to 80. **Verified clean in round 2.**
- **R1-3 (v1, SHOULD_FIX).** Task 13 20-task grep reached :291 (task 14's line). Fixed in
  v2: grep scoped to `harness/skills/sdd-implementation-phase docs/SDD-HARNESS.md` + "twenty
  tasks". **Verified: no longer hits :291.**
- **R1-4 (v1, SHOULD_FIX).** Task 14 guard grep missed the word-form "twelve" doc statement.
  Fixed in v2: grep adds "twelve spawns"; points at SDD-HARNESS.md:130-134/:133. **Verified:
  finds :379 and :133.**
- **R1-5 (v1, MINOR).** Inert six/drafter-reviser grep. Fixed in v2: tasks 7/10 now prove no
  brief-kind count word exists. **Verified: grep returns nothing.**

### Partially Accepted
- (none)

### Rejected
- (none from the drafter yet)
- Lint L-2/L-3/L-4 (v2 lint pass) rejected as scope-boundary notes, not bridges. Not re-raised.

### Unresolved (round 2, awaiting drafter)
- **R2-1 — SHOULD_FIX (Compounds R1-1, carried).** Task 13 directs only the Reconcile (and
  e2e) brief re-point. The kept Per-task loop (Implement `redTests`→`authorFiles`/`authorReport`
  at SKILL.md:146-153; full/narrow verify :221-248; Fix rounds `template: reviser` :236-238;
  task adjudication :245) and the Repair step (:493-504, `fix`/`ci`+`fix`/`repair`) are never
  named, yet tasks 8/9 replace those templates and task 13 deletes briefs.md. Task 12 has the
  blanket "every brief/prompt block comes from the kinds"; task 13 lacks it. Skill-split test
  (headings) + 3 harness checks do not catch an incomplete re-point.
- **R2-2 — MINOR (Compounds R1-2, fix-induced).** Task 11 keeps `docs/SDD-HARNESS.md` in its
  File list but the R1-2 fix removed the only edit to it; "Note the block ... where it
  describes worker reports" points at no real block (only a formats pointer at :155).
- **R2-3 — MINOR (Novel, carried).** Task 12 over-cites "tasks 8 and 9" as the source for the
  document-phase split; document phase uses only task 8's kinds. The blanket it carries is
  what task 13 is missing (R2-1).

## Rulings carried (closed)
- **Req 7.3 runaway-guard basis → refinement (closed, round 1).** Guard sized from
  `data.tasks.total` (design D14), not Req 7.3's literal "open tasks." Do not re-open. NOTE:
  Req 7.3 TEXT still stale ("open tasks") — reconcile on a requirements touch.

## Patterns & Themes
- **Count/length grep theme is RESOLVED.** All five re-pointed greps (tasks 7, 10, 11, 13,
  14) now return exactly their intended hits against the tree. The `agent-rules.md`
  "Documents" bar is met.
- **New weak spot: per-task-loop re-pointing in task 13.** The skill's dozen brief calls span
  kept text (per-task loop) and moved sections; task 13's prompt names only the moved
  Reconcile/e2e, leaving the kept Implement/verify/fix/adjudication and Repair calls to
  inference. The `redTests → authorFiles/authorReport` change is owned by neither task 9
  ("do not edit the skills") nor task 13 (silent on it).
- **Clean elsewhere.** All v2-delta citations resolve at both ends; Test-line seams,
  success-clause coverage, requirement→task coverage, ordering, gate-B/gate-C all sound.

## Guidance for Next Review
- Verify the drafter added task 13's blanket (every impl brief/prompt block from task 9's
  kinds) and the explicit Implement-step and Repair-step re-points (R2-1).
- Confirm task 11's `docs/SDD-HARNESS.md` entry is resolved (R2-2) and task 12's source
  citation corrected to task 8 (R2-3).
- Do NOT re-run the five count/length greps unless a prompt changes one — they are verified
  clean. Do not re-open the Req 7.3 refinement ruling.
- A clean round is acceptable; do not keep the loop alive on MINOR-only residue.
