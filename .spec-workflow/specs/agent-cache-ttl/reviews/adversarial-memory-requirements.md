# Adversarial Review Memory — requirements

Last updated: 2026-09-24 (round 1, v2)

## Cumulative Findings Summary

### Accepted
- (none yet)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (MUST_FIX)** — Req 6 crit 7: block-until-restart gate is unsatisfiable on this
  machine. It requires (1),(2),(3),(5) recorded on a rebuilt-harness session before the PR is
  "marked ready for review", yet its own parenthetical (and CLAUDE.md: harness runs from the
  main checkout, symlinks + hook path to main) says worktree changes are live only after merge.
  Pre-ready needs post-merge evidence → deadlock. Fix: make the live half a post-merge
  obligation, not a pre-ready blocker. Delta from Gate A / RI-1; the block-vs-defer *choice* is
  a closed ruling, the *mechanism* is not.
- **R1-2 (SHOULD_FIX)** — Req 1 crit 4: "same generic per-line split" applied to
  `{ cacheTtl: 1h }` yields `1h }`, not `1h`; fails crit 5's `"1h"`; `check:plugin-assets` is
  self-referential and cannot catch it. Needs an explicit extraction + an independent test.
- **R1-3 (SHOULD_FIX)** — Req 4 crit 6: "its Anthropic spawn count" undefined for phase-total /
  grand-total cells (mixed provider). New `UsageCell` fields carry no per-cell Anthropic count;
  `providers` tracked only at phase/report level. Naive `cell.spawns` never collapses an
  all-unknown Anthropic total to `unknown`.
- **R1-4 (MINOR)** — Req 2 crit 2/3/4: `render.ts:226` `padRight(declared, 23)`; 1h agents are
  exactly 23 chars → `1hactual` with no separator; widening the pad grazes crit 3 for the nine
  default agents. Pad/separator decision unstated.
- **R1-5 (MINOR)** — Req 5 crit 2/4: "below 2.1.248" has no numeric/semver compare (lexical
  mis-orders 2.1.9 vs 2.1.248); the single warning text over-claims on `unknown`, contradicting
  D7's "neither hides nor invents a fact".
- **R1-6 (MINOR)** — Req 5 crit 6: test stubs `claude` + `HOME` only, so the three settings-file
  tiers (crit 2.5 / D8 / D11 first-file-wins) go untested; the script's source for "the code
  root" is also unstated.

## Patterns & Themes
- Wire-contract seams are where the gaps cluster: the producer (buildProfiles, hook) and the
  consumer (usage report, watch view) are each internally fine, but the *derivation glue*
  between a one-line frontmatter value and a scalar field, and between a mixed-provider cell and
  an "Anthropic-only" count, is under-specified.
- Self-referential checks give false confidence: `check:plugin-assets` (regenerate-and-compare)
  cannot catch a wrong `cacheTtl` value (R1-2); acceptance criteria that lean on it need an
  independent literal assertion.
- The Gate A revision removed the deferral cleanly from the normative text but replaced it with
  a gate that ignores the merge-first build model the document itself documents (R1-1).

## Guidance for Next Review
- Re-verify Req 6 crit 7 first: has the live-half gate been reframed to a post-merge obligation
  that is actually reachable? Check every D10 cross-reference still agrees.
- Confirm crit 4 now names a concrete extraction and crit 5 has a test asserting literal `"1h"`
  not via `check:plugin-assets`.
- Confirm crit 6 defines the Anthropic count source for total rows (expect
  `providers.anthropic.spawns`), and that a mixed-provider phase fixture exercises it.
- L-1..L-29 (citation-identifier addition-point warnings) are ruled closed; do not re-raise
  without new evidence.
- Scope vs decomposition entry 13 was checked and matches at v2; only re-check if requirements
  are added/removed.
