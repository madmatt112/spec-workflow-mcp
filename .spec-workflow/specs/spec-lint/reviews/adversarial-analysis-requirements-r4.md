# Narrow check — spec-lint/requirements v4

R3-1: addressed — 9.2 clause 2 now reads "Re-verify only citations the `v<D>` lint commit (8.4) changed," dropping the false "only the reviser checked those" claim and scoping to exactly the unverified lint-pass edits (option (b) from R3-1's fix), with the Revision History line recording it as Accepted (SHOULD_FIX); doc stays at 3500 words, at not over the cap.

VERIFIED: 1/1

## Deferred findings
- 9.5's `## Changes since <short sha>` is one flat `git diff <base> -- <document>`; nothing in Requirement 9 delineates which lines within it came from the v<D> lint commit (8.4) versus the round reviser's other edits, so a reviewer following 9.2 clause 2 must independently locate that commit (e.g. by subject grep) rather than read it off the prompt directly.
