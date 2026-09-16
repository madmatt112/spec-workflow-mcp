# Adversarial Review Memory — design
Last updated: 2026-09-16 (after v2 review)

Target: `.spec-workflow/specs/question-gates/design.md`. Scope authority: decomposition
spec 7 and requirements v4 (no steering docs). Round 1 lens: wire contracts across the
`gate` payload boundary. Round 2 lens: cost of touching an existing component (tests,
fixtures, standing rules of `harness`, `sdd-drafter`, the two skills).

## Cumulative Findings Summary

### Accepted (by the reviser, in Revision History)
- R1-1 (SHOULD_FIX) — Gate B no run-once mechanism. Fixed with a `gate delete slot=b` op
  the supervisor calls after gate B resolves. **Verified sound in round 2** (annotate,
  design-defect, fresh-resume all find `present: false`).
- R1-2 (SHOULD_FIX) — `gate put` payload location contradictory. Pinned to top-level
  `payload` everywhere. **Verified clean in round 2.**
- R1-3 (SHOULD_FIX) — Req 2 AC 2 reword-rewrite had no actor. Fix added a narrow drafter
  re-spawn. **The fix is under-baked — see R2-1, R2-2 below.**
- R1-4 (SHOULD_FIX) — option/answer round-trip underspecified. Fixed with D9 four-option
  cap, Error Handling item 7, and D4 verbatim `options[0]` compare. Internally consistent;
  label-vs-description granularity of the returned selection still unpinned but that is
  closed R1-4 territory (no codebase evidence to re-open).
- R1-5 (MINOR) — types/`score` unstated. Fixed (`GateADecision`, `VetoItem`, score 2/1,
  transform). Clean.
- R1-6 (MINOR) — parser field mapping imprecise. Fixed with precise `description`→title
  rename and both `task-parser.ts` citations. Clean.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved (raised round 2, awaiting reviser disposition)
- **R2-1 — SHOULD_FIX — Compounds R1-3.** `gate put slot=a` overwrites the whole
  `gate-a.json` (`briefAction` `writeFile`, no merge). The R1-3 re-spawn "naming just that
  decision" that "rewrites only that triple" clobbers the other decisions. Needs a
  read-back-and-merge (a `gate get slot=a` then re-put all items) or a full re-extract.
- **R2-2 — SHOULD_FIX — Compounds R1-3.** The re-spawn's trigger ("a lint fix that rewords
  a decision") can't be evaluated: the orchestrator may not read the Decisions section
  (`SKILL.md:20` "Nothing else"; the rule requirements D2 relies on), and the reviser emits
  no rewording signal (`sdd-reviser.md:32`, unmodified). So R1-3's staleness can persist.
  Pin a permitted signal (reviser flag, or lint-finding-line vs Decisions-range check).
- **R2-3 — SHOULD_FIX — Novel.** Gate-B classes (b)/(c) direct the orchestrator to judge
  "from `tasks.md`/`requirements.md`" — a document-body read forbidden by `SKILL.md:20` and
  contradicting Component 4's own Purpose. Gate A and gate-B class (a) both delegate
  body-reading (drafter / server `gate class-a`); (b)/(c) got no delegate.
- **R2-4 — MINOR — Novel.** Testing Strategy omits `sync-plugin-assets.cjs` +
  `check:plugin-assets` that `agent-rules.md:24-26` mandates for a `harness/` change.
- **R2-5 — MINOR — Novel.** `ParsedTask.files?` → `TaskVetoInput.files: string[]` coalesce
  unstated; `gate class-a` does not exclude `isHeader: true` rows (spurious keyword hits).

## Patterns & Themes

- **Gate A hardened, gate B (and now the R1-3 fix) inherit the hole.** The round-1 theme
  holds and deepened: gate A delegates every body-read (drafter) and has a non-recurring
  trigger; the R1-3 re-spawn (R2-2) and gate-B (b)/(c) (R2-3) both put body-reading or
  body-detection on the document orchestrator, which `SKILL.md:20` forbids. Any new step
  that needs the document's content must name a worker or server surface, never the
  orchestrator.
- **Overwrite-not-merge on the shared surface.** `gate put` is a whole-file write; any
  "narrow"/partial write claim (R2-1) is false unless a read-back is specified. Watch every
  future "rewrite only X" against `put`'s overwrite semantics.
- **A delta fix that names an actor but not the actor's inputs.** R1-3 named the drafter
  (actor) but not its trigger (R2-2) or its read-back (R2-1). Round-1's "one side names a
  shape the other doesn't provide" generalises to "a fix names a step but not the data or
  signal that step needs."

## Guidance for Next Review

- **Delta first (v3 will be the round-2 response).** Re-verify any citation the v3 reviser
  adds/changes, both ends. Confirm the R1-3 fix now has (a) a permitted trigger signal and
  (b) a merge/read-back, and that gate-B (b)/(c) got a delegate.
- **All citations verified clean across rounds 1-2** (delta + design set): `harness.ts`
  (24-25, 36-77, 517-544, 537-544, 517-612, 84-100, 600-611), `index.ts` (15,33,83),
  `gate-rules.ts` (26, 101-104, 101-135, 260-261), `review-gate.ts` (177-194),
  `task-parser.ts` (108-128, 119, 279-288, 365-385), `sdd-drafter.md` (7-13, 16-26),
  `sdd-reviser.md` (14-16, 32), `sdd-document-phase/SKILL.md` (20, 69-120, 236-245),
  `sdd-continue/SKILL.md` (14, 60, 146-210, 185-210, 215-230, 232-261), `formats.md`
  (25-26, 28-35, 37-50), `agent-rules.md` (5-6, 24-26, 63-70), requirements.md (D2, D6, D9).
  No misstated-artifact MUST_FIX either round. Do not re-open these without new evidence.
- **`SKILL.md:20` is the load-bearing constraint** for this spec; check every actor
  assignment against it.
- **Unused fresh lenses for later rounds:** record-mode commit failure paths; interaction
  with `harness` `phase-log` regeneration of hand-written gate HANDOFF rows; concurrency
  (two runs writing `gate-*.json`); the AskUserQuestion return shape (label vs description)
  if new codebase evidence appears.
- Rulings closed by Revision History: R1-1..R1-6 dispositions. Rejected findings: none.
