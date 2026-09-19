# Adversarial Review Memory — design

Last updated: 2026-09-19 (Round 1, design v1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MUST_FIX)** — Skill edit ranges stop short of the token-write text.
  `sdd-continue/SKILL.md` edit pinned :213-217 but the paragraph runs to :220, leaving a
  live `tokens=unknown` supervisor instruction (breaks Req 1.9 / Req 2.3 and falsifies the
  design's "only two footer hits remain" grep claim). Same pattern: retro edit :35-38 vs
  token tail at :39 (req cited :33-39). Closeout attribution-footer cited :168, actual
  :170. Scope note calls :219-227 "untouched" but pre-flight starts at L222; L219-220
  carry the leftover.
- **R1-2 (SHOULD_FIX)** — Tier line overflows 80 cols for a `+`-joined two-model worker
  actual. Level-2 (indent 5): 5+3+8+1+23+6+1+31+3 = 81. Design supports `+`-joined models
  (D3, hook test, `!=` flag) but the "longest 66" budget and the width-80 render test
  ignore them.
- **R1-3 (MINOR)** — Tool `description` opening line still lists four actions; not updated
  to include `usage`.
- **R1-4 (MINOR)** — `SpawnNode` gains four kinds no consumer reads (usage.ts reads raw
  rows); Overview `:658-683` left bare after a ledger.ts citation.

## Patterns & Themes
- Under-cited edit spans: the design pins the first lines of multi-line instruction blocks
  and asserts a clean grep outcome that the tail lines contradict. Check every prose edit
  range against where the matched token actually stops.
- Width claims are pinned only for the single-model / orchestrator case; the `+`-joined
  actual (the design's own defensive feature) is never carried through the layout budget or
  the fixtures/tests.
- Codebase-context probe line numbers are trustworthy for the fold/render internals but
  carried at least one off-by-2 in a prose skill path (closeout footer 168 vs 170).

## Guidance for Next Review
- Re-run `grep -rn "footer\|tokens=" harness/skills` against the revised edit map and
  confirm only the two attribution-footer hits remain (at their true lines).
- Recompute the tier-line worst case with a 31-char `+`-joined actual at level-2 indent;
  demand a render test at width 80 that includes a two-model worker.
- Rulings already closed (do not re-open): Req 4.7 two-line entry = refinement;
  Req 5.4 / D6 any-non-digit = refinement.
- Wire contract (hook → fold → readers) is otherwise sound; the number/string split
  between activity and ledger rows is intentional and matches readers.
