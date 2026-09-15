# Adversarial Review Memory — design

Last updated: 2026-09-14 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — Tool count was "12"; corrected to "13" in Component 10.
  Verified: `src/tools/index.ts:16-31` holds 12 entries today, +`spec-lint` = 13.
- **R1-2 (MUST_FIX, v1)** — Lint step ran before the `D` update, mislabelling the lint
  brief/commit with the stale version. Fixed: the "Run the Lint step." pointer now sits
  after the `D` update at `SKILL.md:98`, `:129`, `:144`, `:228`. Traced end to end
  (v1→round1→v2 lint→round2 script); labels now match and the D>1 base resolves to the
  prior `v<D-1> lint` commit exactly as requirement 9.4 mandates. Resolved.
- **R1-3 (SHOULD_FIX, v1)** — Info-only path never defined `LINT.open` / `L-n`. Fixed:
  numbering moved to sub-step (2); early-exit sets `LINT.open` = info findings; sub-step
  (7) guarded "if not ended at (2)". Info-only path resolved — but see R2-1 (full path).
- **R1-4 (MINOR, v1)** — `criteria` regex dropped the leading `\s*`; now `^(\d+)\.\s+(.*)$`,
  matching requirement 4.1's `^\d+\.\s`. Resolved.
- **R1-5 (MINOR, v1)** — D2 now flags the four-backtick fence as a known limit. Resolved.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (SHOULD_FIX, v2 — Compounding on R1-3)** — On the full path (error+warning>0),
  sub-step (7)/D10 compute `LINT.open` from "every `L-n` the report marks rejected or
  partially accepted", but the lint brief gives no source for "partially accepted": the
  Job is replaced whole with a Fix-only sentence (dropping `briefs.md:156-158`'s
  per-finding disposition report), and rule 4's bullet (`<n> fixed; rejected: L-n …`) has
  no partial slot. Result: partially-fixed findings are dropped from the round prompt's
  "Still open" list and the reviewer never sees the remainder. Fix must be net-neutral
  (doc is at 4,000/4,000). Options: drop "partially accepted" (D12 says fixes are
  mechanical → binary) or add a slot + name the read source.

## Patterns & Themes

- **`LINT.open` source is chronically under-specified.** R1-3 (info-only path) and R2-1
  (reviser-ran path) are the same defect on two branches: the design states what
  `LINT.open` should contain but not where each member is read from. If R2-1 is fixed,
  re-check that the zero-error/all-info and skipped/stalled paths still agree.
- **Version-variable timing (R1-2) is now correct** and rests on requirement 9.4's
  asymmetric base match: D=1 anchored (`v1$`), D>1 open (`v<D-1>( |$)`). Treat that
  asymmetry as load-bearing — any future edit that anchors the D>1 pattern with `$` would
  re-break the base lookup. Flag it if touched.
- **Delta citations were all accurate this round.** The four SKILL.md line numbers, the
  index.ts count, the briefs.md `:156`/`:169-176`/`:178-180`/`:190-195` ranges, the
  cleanup.md `:19-20`/`:62-85`/`:64-65` ranges, and requirement 4.1's regex all verified
  at both ends. No misstated-artifact MUST_FIX.
- Lenses used: R1 wire contracts across boundaries; R2 cold read for internal
  contradictions + truth table of Lint-step branches vs round-prompt sections. Not yet
  used: failure/rollback under a real running server; installed-library behaviour
  (`@mdx-js/mdx`, `isUtf8`) on node 20; the reviser-as-consumer-of-only-the-brief lens
  (partially opened by R2-1).

## Guidance for Next Review

- Confirm R2-1's resolution: is there now a single named source for every `L-n`'s
  disposition feeding `LINT.open`, and does "partially accepted" either exist in the
  recording format or no longer appear in D10/sub-step (7)? Check the fix cut as many
  words as it added (cap is 4,000, no headroom).
- Do not re-open R1-1..R1-5 (all verified resolved) without new evidence; mark Recurring
  if so. R1-4/R1-5 were MINOR and are closed.
- Consider a fresh lens next round: installed-library facts (mdx/isUtf8 on node 20), or
  failure/partial-failure paths under a running server (skipped/stalled lint reviser,
  non-git spec store), which the truth table only touched at the branch level.
- The SHOULD_FIX-only-pass Lint step producing an unconsumed `v<D> lint` commit is
  *actually fine* (fixes land in the approved doc, narrow check still runs); do not raise
  it unless new evidence shows harm.
