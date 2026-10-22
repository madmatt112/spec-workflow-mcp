# Adversarial Review Memory — requirements
Last updated: 2026-10-22 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1→v2)** — schema keyed by (role, phase); close-out batch schema
  (`closeout.ts:82-104`, passed 411-414) cited in Req 2 crit 2. Verified correct.
- **R1-2 (MUST_FIX, v1→v2)** — a case names the step + brief template(s); Req 1 crit 2
  renders both close-out briefs and wires the pointer. Run side fixed. **Its plural-template
  model was not propagated to Req 1 crit 5 — see R3-1.**
- **R1-3 (SHOULD_FIX, v1→v2)** — dry-run marked provisional with a source-diff signal.
- **R1-4 (SHOULD_FIX, v1→v2)** — Req 5 crit 4 softened for `closeout-reversing-proposal`.
- **R2-1 (MUST_FIX, v2→v3)** — selection now watches every brief a case renders; Req 3
  crit 1 compares rendered text of every template, crit 6 diffs every render fn + shared
  helper. **Verified correct in v3.** But the companion grader trigger in crit 1 stayed
  non-transitive — see R3-2.
- **R2-2 (MUST_FIX, v2→v3)** — Req 5 crit 3 holds four cases to 3/3 and lets the judgment
  case fall to an override, matching crit 4/D10. **Verified correct in v3.**
- **v1 grader-exception MINOR / v2 crit 5** — grader throw / fixture-build failure →
  inconclusive. Resolved.

### Partially Accepted
- (none)

### Rejected
- **r2 MINOR (partial result record on runner crash)** — Rejected in v3 Revision History:
  a runner crash exits non-zero and leaves the checkout unchanged (crit 3), nothing ships
  untested; a partial-record contract is a design concern. Closed — do not re-open.

### Unresolved
- **R3-1 (SHOULD_FIX, Compounds R1-2, carried)** — Req 1 crit 5 (`npm test` validation)
  still reads "the template renders … (no missing required key)" (singular). A
  multi-template close-out case whose *standing* values omit a key passes pre-flight and
  only fails at deploy (inconclusive). Fix: crit 5 → "every template the case renders."
- **R3-2 (SHOULD_FIX, Compounds R2-1, carried)** — Req 3 crit 1's grader trigger is "the
  grader code it **names**" — non-transitive. A graders' *shared helper* changes (graders
  are code, seed set shares "no new commit"/"main checkout unchanged"/attribution checks);
  the named file is unchanged, so no case is selected and a weakened grader ships. crit 6
  covers only templates. Fix: crit 1 → "the grader code it names and the shared code that
  grader uses," mirroring crit 6's template-helper language.

## Patterns & Themes
- **One pattern, now three rounds deep: a model-flip propagated to some criteria, not all.**
  R1-2/R2-1 flipped the case model to *plural templates + transitive shared code*. Updated:
  run-time (Req 1 crit 2), selection text compare (Req 3 crit 1 template leg), dry-run
  source diff (crit 6, templates). **Not updated:** static validation (Req 1 crit 5, R3-1)
  and the selection grader leg (Req 3 crit 1, R3-2). Next round: confirm BOTH are pluralised
  / made transitive, then check nothing else (docs Req 7, Req 6 retro-added case path)
  still restates the singular model.
- **Close-out implementer case is still the stress point** (2/5 cases, two briefs,
  phase-keyed schema, shared helpers). Every round's findings trace to it.
- **Citations clean across three rounds.** Every v1/v2/v3 citation verified at both ends.
  No misstated-artifact MUST_FIX in any round. Do not re-spend rounds on citations.

## Guidance for Next Review
- Verify the reviser pluralised **Req 1 crit 5** (R3-1) and made **Req 3 crit 1's grader
  trigger transitive** (R3-2). Check both ends; check they match the crit 1/crit 6
  template language already there.
- If both land, the plural/transitive model is finally uniform — likely a clean round.
- Well-covered, do not re-examine: schema keying (R1-1), run-time two-brief rendering
  (R1-2), selection text compare + dry-run helper diff for templates (R2-1), the
  landing-deploy judgment carve-out (R2-2), all cited artifacts, D7 batch landing,
  grader-throw classification, the runner-crash partial-record MINOR (ruled closed).
- Unused fresh-lens candidate: Req 6 (retro-added case) ↔ Req 1/Req 3 wiring — does a
  retro-proposed case arrive with the template-set and grader-closure metadata selection
  needs, or only an id + one grader line (crit 1)?
