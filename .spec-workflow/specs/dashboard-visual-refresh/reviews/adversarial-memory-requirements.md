# Adversarial Review Memory — requirements

Last updated: 2026-10-28 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — R6.2 covered only `data-testid`; escalated to R2-1. **Resolved
  in v3:** the grep now emits all 102 attribute occurrences (86/86 testids, role, aria).
- **R1-2 (SHOULD_FIX, v1)** — R3.1 name-set test undefined. v2 added light/`.dark`/structural
  blocks; v3 (R2-3) named the selectors. **Resolved.**
- **R1-3 (SHOULD_FIX, v1)** — R7.1 capture pointed at empty temp stores; v2 points it at the
  suite's runtime seeding (`seedClosedSpec`, `WorktreeHarness`), citations verified. Resolved.
- **R2-1 (MUST_FIX, v2)** — R6.2 grep dropped brace/template/expression attributes.
  **Resolved in v3:** verified on real code, 102/102, every brace+expression form emits.
  Residue → R3-2.
- **R2-3 (MINOR, v2)** — R3.1 light/structural selectors unnamed. **Resolved in v3:** light→
  `:root`, dark→`.dark`, structural→a third distinct selector; name-set test compares
  `:root` vs `.dark`.

### Partially Accepted
- **MINOR methods for 1.2/1.4 (v1)** — var-ref test (1.4) + `--row-h` tied to density e2e (1.2). OK.
- **MINOR client-state keys (v1)** — density + group-collapse keys pinned in R6.5. OK.
- **MINOR stylesheet baseline (v1)** — 54.58 kB marked a reference, gate re-measures. OK.

### Rejected
- (none)

### Unresolved
- **R3-1 (MUST_FIX, v3, Novel, fix-induced, Compounds R2-2)** — R4.1's new cross-view
  computed-style test compares all seven properties (incl. background + text colour) for the
  **status pill and button** kinds across two views without fixing tone/variant. Pills have
  six tones (R4.2: paused=warning amber RunsPage:192-193, done=success green RunPage:454,
  error=danger, queued=neutral); buttons have four variants (danger RunsPage:306 vs primary
  LoginPanel:65). So the test compares different-coloured-by-design instances and FAILS on a
  correct build. Only the list row (shared `Row`) is well-defined. Fix: constrain to same
  tone/variant, or drop colour from the pill/button comparison.
- **R3-2 (MINOR, v3, Compounding R2-1, fix-induced)** — R6.2's `\{[^}]*\}` truncates
  interpolated templates at the first inner `}` (all 28 of them, e.g. `pr-row-${read.repo}`
  drops `-${read.number}`). The "matches template-literal forms alike" claim overclaims;
  blind to template text after the first `${…}`. Backstopped by the unchanged e2e suite and
  screenshots. Not loop-keeping.

## Patterns & Themes
- **Invariant/test asserted, verification narrower than the claim.** Persistent across all
  three rounds. R6.2 (R2-1→R3-2) and now R4.1's cross-view test (R3-1). Any new test clause
  here must be checked against the *design intent it is meant to prove*, not its own prose.
- **Fix-induced contradictions.** The v3 delta that closed R2-2 created R3-1 — a test that
  contradicts a sibling AC (R4.2 six tones, R4.1 four button variants). When a fix adds a
  test, check it against every AC that defines legitimate variation in what it compares.
- **JSX attribute forms.** This FE is mostly `{…}`/template-valued, not `"…"`. Any grep must
  account for nested braces inside `${…}` — the current regex still can't.

## Guidance for Next Review
- Attack first: whatever the reviser does for R3-1. The test must not compare across tones/
  variants. Confirm the fix names which instances (same tone, same variant) or which
  properties (drop colour) and that the list-row path is untouched.
- R3-2 is a one-line wording/regex nicety; do not escalate unless the reviser's edit
  re-breaks the attribute match (re-run the 102/102 count).
- Closed, do not reopen: R1-1/R1-2/R1-3 (resolved); R2-1 (verified resolved on real code);
  R2-3 (selectors named); L-2 and the v1 verified citation set.
- Lenses used: wire contracts (v1), testability/falsifiability (v2), cross-requirement
  contradiction (v3). Unused and still open: scope-creep (R4.1's long component list vs the
  "look only" scope); the R7.1 detail-panel-per-view thread is a design-phase check, not a
  requirements finding.
