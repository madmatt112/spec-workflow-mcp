# Adversarial Review Memory — requirements
Last updated: 2026-09-14 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — 9.2 machine-verified bullet contradicted the surviving-
  findings list. Reworded (v2) so a rule is machine-verified only when 9.3 lists no
  finding. The reword introduced R2-1.
- **R1-2 (SHOULD_FIX, v1)** — D4 EARS probe re-scoped under 4.1/4.2: review-gate 2/52,
  tighter-reviews 2/37. Verified in v2 and v3.
- **R1-3 (SHOULD_FIX, v1)** — dropped the `error` exception for the prompt-underscore
  warning; 5.1 maps every severity straight across (`task-validator.ts:205-215`).
- **R1-4 (SHOULD_FIX, v1)** — 8.3 names every `v<D+1>` to drop (title `briefs.md:151`,
  Job `:156`, rule 4 `:190-195`). All occurrences covered.
- **R1-5 (MINOR, v1)** — 1.3 dropped the "requirement 3.8" cross-reference
  (`root-selection.ts:36-40`).
- **R1-6 (MINOR, v1)** — 9.3 covers info-only results.
- **R1-7 (MINOR, v1)** — 10.4 "Three"→"Four"; 6.3 mirrors, not reuses, parseSensitivePaths.
- **R2-1 (MUST_FIX, v2, Compounding on R1-1)** — accepted in v3: 9.2 says checks ran
  before the lint pass; reviewer re-verifies citations the `## Changes` diff touches.
  *The v3 reword over-corrects for D > 1 — see R3-1.*
- **R2-2 (SHOULD_FIX, v2)** — accepted in v3: Req 3 "never needed" → "fires far less
  often." Resolved; no longer contradicts 8.9 / 3.2.
- **R2-3 (MINOR, v2)** — accepted in v3: 5.1 drops `field`, folds into `message`.
  Resolved; 1.6 shape unbroken.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R3-1 (SHOULD_FIX, v3 — Compounding on R2-1)** — 9.2 clause 2 ("re-verify any citation
  the `## Changes` diff touches — only the reviser (`briefs.md:187-188`) checked those")
  is true for D = 1 but false for D > 1. For D > 1 the diff base is the previous version's
  last commit (9.4/D13, "the whole delta"), so it includes the round reviser's citation
  edits — which the v<D> Lint step (8.1, Step 3 item 5) machine-checked before the round
  prompt was built. So "only the reviser checked those" is false, and clause 2 re-imposes
  the citation re-checking the Alignment says the tool removes. Fix: scope clause 2 to the
  lint-pass edits (re-lint after the pass, per R2-1 option a, or mark the lint-pass slice
  of the diff). 9-word cap headroom — reword must trade words out.
- **R3-2 (MINOR, v3 — Novel)** — 10.2's "exactly those seven findings … and nothing else"
  is brittle: an unclosed `_Prompt` can emit two `tasks-format` findings (prompt +
  prompt_structure, `task-validator.ts:205-229`), and a 200-over-cap requirements doc
  multiplies the EARS/identifier surface. Soften to "the seven expected rule/line pairs
  present," or require a minimal crafted fixture.

## Patterns & Themes
- The round-prompt contract (Req 9) has now conflated verification-provenance three
  times: R1-1 (check ran vs check passed), R2-1 (passed on drafted vs reviewed version),
  R3-1 (checked by the lint on the reviewed version vs checked only by the reviser). Each
  fix relocated the conflation instead of removing it. Root cause: once-per-version lint
  (8.5) + a Machine-verified bullet built from a single response + a whole-delta diff for
  D > 1. A clean resolution is a single lint-freshness rule (re-lint after the pass, or a
  diff slice that isolates lint-pass edits). Watch this in design.
- Rationale/decision trims stay content-safe: v3 dropped rejected alternatives from
  D5/D9/D12 and lost no criterion; 10 requirements, 10 criteria blocks, 3491/3500 words.
- Every code and line-range citation is accurate across v1, v2 and v3. Three rounds, no
  misstated artifact. Defects are internal logic (round prompt) and one brittle test
  assertion.
- Cap headroom is now 9 words — future fixes must trade words out.

## Guidance for Next Review
- Re-verify R3-1's fix: confirm the round prompt no longer tells the reviewer to
  re-verify citations the v<D> Lint step already machine-checked. Either data.checks
  describes the reviewed post-lint-pass version (8.5 amended to re-lint), or clause 2
  points only at the lint-pass slice of the diff, not the whole delta.
- Confirm R3-2: the e2e assertion matches the validators' multi-finding behaviour.
- Well-covered, do not re-mine: EARS counts (2/52, 2/37, verified three times); the
  R1-1..R1-7 citation set; the severity/1.7 mapping; every delta citation to date (all
  accurate); the tool-count / TOOLS-REFERENCE drift (10.4 handles it, no test asserts it);
  the reused validators' tests (untouched); the scaffold test (Req 9 does not touch the
  tool).
- Lenses used: r1 wire contracts; r2 contradictions + truth table; r3 cost-of-touching
  existing components. Unused and still open: failure/partial-failure paths (EACCES on a
  cited file — 2.3 covers only "directory or non-UTF-8", 1.5 does not list it, NFR
  Reliability claims 2.3 handles it — cold look worth taking); the sub-agent that receives
  only the task prompt; vendor/format facts (@mdx-js/mdx behaviour) against source.
