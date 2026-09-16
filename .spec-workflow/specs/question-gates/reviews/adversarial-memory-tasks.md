# Adversarial Review Memory — tasks

Last updated: 2026-09-16 (Round 1)

## Cumulative Findings Summary

### Accepted
(none yet — first round)

### Partially Accepted
(none yet)

### Rejected
(none yet)

### Unresolved
- **R1-1 — SHOULD_FIX** — Task 6 covers only AC 7's receipt write; the step-3 resume recheck
  ("re-ask or fall to record when the receipt is unanswered", Req 2 AC 7 second sentence,
  `sdd-continue/SKILL.md:122`) is in neither task 6 nor design Component 5. Interrupted gate A
  silently proceeds to round 1 unanswered. Root is a design gap; task overstates Req 2.7 coverage.
- **R1-2 — SHOULD_FIX** — Five open ERROR-level citation-path findings (L-8..L-12) in the v1
  Lint-pass Revision-History bullet (tasks.md lines 87-90): bare `sdd-reviser.md`, two `SKILL.md`,
  `references/briefs.md`. Fix = code-fence/qualify without rewriting history. Paired qualified
  citations already sit beside them, so no artifact is wrong — only unresolvable as written.
- **R1-3 — MINOR** — `parseTasksFromMarkdown` cited at `task-parser.ts:108-128` (the ParsedTask
  interface); the function is at 153-356. Inherited from approved design Component 2; identifier
  appears as a call at line 366 so citation-identifier passed.
- **R1-4 — MINOR** — Task 5 bundles gate A emission + gate B assembly (six behaviors, two files,
  two independent features) in one task; least-atomic change, would review cleaner split 5a/5b.
- **R1-5 — MINOR** — "external write" (sixth class-a keyword) has no regex in design Component 1 /
  requirements D7; implementer invents pattern and test. Module is tunable, so latitude not blocker.

## Patterns & Themes

- **Requirement-to-design drift surfaced at the tasks layer.** The strongest finding (R1-1) is a
  requirements-v4 acceptance criterion (R3-2's AC 7) that design v3 only half-implemented; the
  tasks doc inherited the half and claimed full coverage. When a requirement AC was added after the
  matching design version, check the design actually designed all of it before trusting a task's
  `_Requirements` line.
- **Lint pass introduced its own residual errors.** Fully-qualifying task-body citations left bare
  filenames in the historical bullet describing the fix — a recurring hazard of "describe the fix in
  prose" Revision History. Prefer code-fenced paths in disposition bullets.
- **Delta citations were all accurate.** The lint commit's fully-qualified paths (tasks 4/5/6) all
  resolve at both ends. Ordering DAG and component→task coverage are sound; D1 (no bridge/stub) and
  D5 (no orchestrator edit) both verified against the tree.

## Guidance for Next Review

- Re-check R1-1 first: did the reviser add a step-3 receipt check to task 6, or amend design
  Component 5? If it only reworded the task without adding the check, the gap persists (mark
  Recurring). Verify against `sdd-continue/SKILL.md` step-3 routing region (rules 4-7, ~lines 112-137).
- Re-check R1-2: confirm the five paths in the (now-superseded) v1 Lint-pass bullet are code-fenced
  or qualified; run the citation-path rule mentally over the current Revision History.
- Fresh lens already applied (sub-agent-with-only-the-prompt). Round 2 should pick a different lens:
  e.g. the reviser executing task 5 without design.md in context, or the failure-mode lens on the
  gate-B grep pipeline (reviewer title tag → reviser Revision-History bullet → orchestrator grep):
  does a dropped tag silently vanish a veto class?
- Do not re-open: delta citation accuracy (all verified), D1/D5 (verified), L-1..L-6 warnings
  (dismissed as scoped-citation false positives), L-7 (rejection upheld).
