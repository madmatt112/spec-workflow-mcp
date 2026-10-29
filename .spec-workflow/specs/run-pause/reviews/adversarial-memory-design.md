# Adversarial Review Memory — design
Last updated: 2026-10-29 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX)** — No operator stop between implementation `complete` and the merge stage;
  a held run on its last implementation step auto-merged its PR. Fixed in v2: C3 point 4 adds the
  merge-stage-entry stop (after `hasMerged` at runs.ts:624, before runMergeStage at 663-675),
  saves the `merge` cursor (C5), corrected loop-top wording, D3, Overview, + Testing case line 169.
  Verified accurate against the code in R2.
- **R1-2 (MINOR)** — Pause route reuse line wrongly cited the cancel route's shape. Fixed in v2:
  C2 line 54 now cites the resume route's three-way shape. Verified.

### Partially Accepted
- none

### Rejected
- **R1-3 (MINOR)** — Per-check synchronous `readRunSync` cost unstated. Rejected in v2: already
  stated and justified against the `windowBlock` precedent (C3 point 1, D11). Do not re-raise
  without new evidence.

### Unresolved
- **R2-1 (MINOR)** — C3 point 4 and Testing line 169 cite `(Requirement 7 AC 1)` as the grounding
  for "the PR stays unmerged," but Req 7 AC 1 only forbids starting a next *step*, and a clean
  merge (`gh pr merge`) is not a step per the requirements' Terms. The real anchor is D9's
  rationale. Wording/traceability only; behaviour is correct. Compounds R1-1 (fix-induced text).

## Patterns & Themes
- The design remains well-grounded: every cited path/range/signature/behaviour matches the code,
  across both the v1 base and the v2 delta.
- R1's single real gap (the implementation→merge direct call at runs.ts:947 bypassing the loop
  top) is now closed, and the stop-point enumeration is complete — 947 was the only un-held direct
  inter-phase call; document/retro/close-out all re-enter through the loop-top check.
- The only residue is a requirement-to-design traceability tag that over-claims (R2-1), not a code
  or logic defect.

## Guidance for Next Review
- Design is converged (0/0). No further adversarial round is needed on logic.
- If a v3 is cut, the only open item is the R2-1 tag (retag to D9); do not treat it as blocking.
- Do NOT re-open: the `writeRun` carry rule (D2), Error Handling 4 (resume-vs-pause race), the
  `isStartable` first-rule vs 30 s merge poll, the document round-top RE-DECIDED (D3), the
  `resumeNow` held-branch-first ordering, the merge-entry placement/cursor/resume round-trip, or
  the merge-stage test feasibility (harness supports it via stub-gh.mjs / scriptMergeablePR).
