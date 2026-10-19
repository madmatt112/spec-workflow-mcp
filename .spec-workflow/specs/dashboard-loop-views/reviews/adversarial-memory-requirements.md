# Adversarial Review Memory — requirements

Last updated: 2026-10-19 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — AC3 close date mis-cited the 7-day-windowed `now-model` `closedOn`. v2
  rereads the HANDOFF closeout/closed row unwindowed via `parseHandoffPhaseRows` (`ledger.ts:202`) as
  the Specs page does (`spec-rows.ts:92`). **Verified fixed in v2.**
- **R1-2 (MUST_FIX, v1)** — NFR claimed `agent-rules.md` through `FileCache`, contradicting AC9's
  `readAgentRules` (uncached). v2 routes ledgers/HANDOFF through `FileCache`, `agent-rules.md` through
  `readAgentRules` uncached. **Verified fixed in v2.**
- **R1-3 (SHOULD_FIX, v1)** — AC1/AC3 did not say how CI state + `mergeable` reach `save`. v2 extends
  `evaluate` to return what it already read, classified by `readCiState`'s rule, no second read.
  **Verified fixed in v2.**
- **R1-4 (SHOULD_FIX, v1)** — AC6 named two of three `ControllerRun` shapes. v2 enumerates all three.
  **Verified fixed in v2.**
- **R1-5 (MINOR, v1)** — "one parser" overstatement + implicit create/update owner threading. v2 names
  `AgentRules` and the `create`/`update` storage sites. **Verified fixed in v2.**

### Partially Accepted
- (none)

### Rejected
- Lint pass (v1 and v2): all lint items rejected with reasons recorded in Revision History; not re-raised.

### Unresolved
- **R2-1 (SHOULD_FIX)** — AC1 saves "the repository name" but AC7 never renders it, and no path-free
  source is named (`repoDir` is a path forbidden by AC6/§17; `PullRequest.url` is optional;
  `PR_VIEW_FIELDS`, `merge.ts:38-39`, reads neither a url nor an owner/repo field). Either a dead field
  or a LAN path leak. Reconcile AC1↔AC7 and name the source. Novel, carried.

## Patterns & Themes
- v2 cleanly fixed all five R1 findings; every delta citation reads correctly at both ends. The
  round-1 root cause (citations naming the right file but misstating its behaviour/scope) did not recur
  in the deltas.
- The one surviving seam is the same family as R1-3: "the merge rule already read it, so the controller
  has it" (D1) is now true for CI state + `mergeable` but still false for the repository name — a
  saved panel field with no read behind it. Save-set vs render-set (AC1 vs AC7) were never reconciled.
- Security NFR / AC6 state the no-path rule but, with an unsourced repo name, set a trap rather than
  close it.

## Guidance for Next Review
- Confirm R2-1 reconciled: AC1's saved fields == AC7's rendered fields (+ only what AC5 ordering needs),
  and any repo label has a named path-free source with no second GitHub read.
- Do NOT re-raise R1-1..R1-5 (verified fixed), the deferral owner plumbing, the three-shape wire, or the
  W-fold tie — all sound.
- Watch the close-date edges only if a fix touches them: multiple closeout rows (tie-break) and
  null-close-date table position are MINOR and need not block.
- Lenses used: round 1 wire contracts; round 2 AC1↔AC7 save/render consistency + path-free sourcing.
  Unused: testability of the SVG trend's hover/legend assertions, and the CI-only-vs-combined `pending`
  design nit flagged under R1-3.
