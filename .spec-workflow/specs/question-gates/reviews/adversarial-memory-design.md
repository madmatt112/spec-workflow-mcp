# Adversarial Review Memory — design

Last updated: 2026-09-16 (round 1)

Target: `.spec-workflow/specs/question-gates/design.md`. Scope authority: decomposition
spec 7 and requirements v4 (no steering docs). Round 1 lens: wire contracts across a
boundary (the `gate` action payload surface, the `gate-a` PHASE value, the AskUserQuestion
option/answer round-trip).

## Cumulative Findings Summary

### Accepted
- (none yet — first review)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved (raised round 1, awaiting reviser disposition)
- **R1-1 — SHOULD_FIX — Gate B no run-once mechanism.** `gate-b.json` persists; `gate get
  slot=b` returns `present: true` on every implementation entry. Annotate path (Req 5 AC 3)
  loops tasks-revision → approved → step 3 → first implementation spawn → gate B re-asks;
  fresh resume before tasks start does the same. Contradicts Req 5 AC 3/AC 6 and the design's
  own "runs at most once." Gate A is safe only because its trigger never recurs on resume
  (`documentNextStep` returns Step 2 once D≥1) and it has the Req 2 AC 7 receipt; gate B has
  neither. Fix: consume/delete/mark the file, or gate on task progress.
- **R1-2 — SHOULD_FIX — `gate put` payload field location contradictory.** Schema (Component
  2) adds top-level `payload`; `op: 'put'` writes `values.payload`; Error Handling 6 mirrors
  `briefAction`'s `values.path` guard; Component 3 caller passes top-level `payload`. If
  schema/caller win, handler reads undefined and the malformed guard fires; the surface goes
  inert. Pin one location across schema, ops, callers, Error Handling.
- **R1-3 — SHOULD_FIX — Req 2 AC 2 reword-rewrite has no actor.** Drafter runs once (Step 1,
  before Lint); Lint step spawns `sdd-reviser` (no gate grant, `sdd-reviser.md:7-16`); drafter
  not re-spawned. Mandated post-lint triple rewrite unimplementable as designed → stale gate-A
  text. Fix: enforce Lint-never-touches-decisions, or grant reviser the write, or re-run the
  drafter step.
- **R1-4 — SHOULD_FIX — option/answer round-trip underspecified.** `options: string[]`
  unbounded; transform to AskUserQuestion option surface unstated; a decision with ≥4
  alternatives overflows one question with no truncation/fallback. D4 approve-detection
  ("reply selects options[0]") never states the answer→options[0] mapping → misclassifies
  approve vs needs-revision. `requirements-template.md:47-52` does not machine-separate
  chosen/rejected.
- **R1-5 — MINOR — data-model gaps.** `GateADecision`/`VetoItem` untyped; `ClassAItem`→`veto`
  transform (summary source, rank/class) and `ClassAItem.score` semantics unstated.
- **R1-6 — MINOR — parser field-name mismatch.** `ParsedTask` has `description` not `title`,
  no block field; `taskBlock(content, taskId)` is a separate function. "via
  parseTasksFromMarkdown, each task's files and taskBlock" is imprecise (Dependencies does
  list taskBlock separately, so not a false signature).

## Patterns & Themes

- **Gate A hardened, gate B did not inherit the hardening.** Gate A carries a persisted-state
  re-entrancy guard (Req 2 AC 7) and a non-recurring trigger; gate B reuses the "persist a
  JSON payload, read it back" pattern without a consume/mark step, so its at-most-once
  guarantee is asserted, not built. Watch every "runs once" / "at most once" claim for a
  concrete mechanism.
- **Producer/consumer field disagreements.** The payload arg location (R1-2) and the parser
  field names (R1-6) are the same failure class: one side of a boundary names a shape the
  other side does not provide. Next rounds should keep tracing writer↔reader for any new shape.
- **Leaning on unpinned external contracts.** AskUserQuestion's option surface (R1-4) and the
  template's decision phrasing are relied on without pinning. Req 2 AC 4 already showed the
  tool has caps; the per-question options cap and the answer format are the unpinned siblings.

## Guidance for Next Review

- **Delta first.** v1→v2 will be a round-1 adversarial response. Re-verify any citation the
  v2 reviser adds/changes, both ends, before judging.
- **Re-check R1-1 and R1-3 mechanically.** For R1-1, confirm the fix names who deletes/marks
  the gate file and that the annotate + fresh-resume paths both stop re-asking. For R1-3,
  confirm a single actor holds both the gate write and the reword duty.
- **All citations verified clean in round 1** (delta + the design's own set): `harness.ts`
  (24-25, 36-77, 517-544, 517-612), `index.ts` (15,33,83), `gate-rules.ts` (26, 101-135,
  260-261), `review-gate.ts` (177-194), `task-parser.ts` (108-128, 279-288, 365-385),
  `sdd-drafter.md` (7-13, 16-26), `sdd-reviser.md` (14-16), `sdd-document-phase/SKILL.md`
  (20, 69-120, 236-245), `sdd-continue/SKILL.md` (14, 60, 146-210, 185-210, 215-230,
  232-261), `formats.md` (25-26, 28-35, 37-50), `agent-rules.md` (5-6). No misstated-artifact
  MUST_FIX. Do not re-open these paths without new evidence.
- **Unused fresh lenses for later rounds:** failure-mode enumeration on the record-mode
  commit path (mid-phase commits not at a phase transition); interaction with
  harness-bookkeeping's ledger-rendered `## Phase log` (do hand-written gate rows survive
  regeneration); concurrency (two runs on one spec store writing `gate-*.json`).
- Rejected findings: none yet. Rulings closed by Revision History: none.
