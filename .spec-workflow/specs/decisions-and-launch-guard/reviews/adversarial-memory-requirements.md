# Adversarial Review Memory — requirements

Last updated: 2026-11-07 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX, Novel)** — Req 2 AC7 calls the no-`tasks.md` path "the common case
  at launch" and puts the novel guard logic there, but the only stated Verification (and
  decomposition e2e item 2) exercise the `tasks.md` File:-entry branch. Common/risky
  branch unverified. Fix: add a no-`tasks.md` verification or explicit design-owned
  deferral; include the cross-repo path-disambiguation rule.
- **R1-2 (MINOR)** — Req 2 AC5 invariant carries no citation (base one-press is
  `HomePage.tsx:188-194`).
- **R1-3 (MINOR)** — Req 3 AC1 `## Decisions` read assumes single-line answers
  (`buildRetroPlanMarkdown` inlines, `runs.ts:356`); multi-line / `→` answers truncate.
- **R1-4 (MINOR)** — Req 3 AC5 "chooses no change" is a heuristic free-text match, test
  deferred; pin it in design.
- **R1-5 (MINOR)** — Intro "eleven operator-reported defects": items 4 & 5 are retro
  efficiency decisions, not operator-reported defects.

## Patterns & Themes
- Citations are strong: all diff-delta line corrections and all load-bearing artifact
  cites verified accurate against code. No misstated artifact.
- The board requirements (R8/R9/R10) ride existing `ControllerRunRow` wire fields — no new
  wire contract needed. R2's guard rides the existing `/harness/setup` → `SetupView` fetch
  (tied to the 30s poll by NFR Performance).
- Recurring soft spot: phase-to-phase **text-format contracts** (`## Decisions` lines;
  free-text "no change" answers) are specified behaviourally but their parse robustness is
  deferred to design.
- Verification lines lean on the `tasks.md` launch branch while AC7 says the no-`tasks.md`
  branch is the common one.

## Guidance for Next Review
- Fresh lenses already used: wire contracts (round 1). Pick a different lens next round
  (e.g. failure-mode / idempotency, or testability of acceptance criteria).
- If v2 adds a no-`tasks.md` verification, scope the re-check to that addition vs AC7
  (fix-induced re-check), not a whole re-review.
- Do not re-open: the translatePath equivalence (host-conditional but accepted), the
  cross-project "name the project to use" mechanism (frontend combines per-project
  booleans — implementable, no gap), AC8 "registry data" vs AC3 projects.json (read path
  vs durable source — coherent).
- Verify any NEW citations v2 introduces (especially around the guard source and the label
  schema change in `document.ts`/`adversarial-review.ts`).
