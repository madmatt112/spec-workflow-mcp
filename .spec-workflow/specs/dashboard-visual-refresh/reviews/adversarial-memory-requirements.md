# Adversarial Review Memory — requirements

Last updated: 2026-10-28 (after v4 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — R6.2 covered only `data-testid`; escalated to R2-1/R3-2.
  Resolved: grep emits all 102 attribute occurrences (86/86 testids, role, aria).
- **R1-2 (SHOULD_FIX, v1)** — R3.1 name-set test undefined; v2 added light/`.dark`/structural
  blocks, v3 named the selectors. Resolved.
- **R1-3 (SHOULD_FIX, v1)** — R7.1 capture pointed at empty temp stores; v2 points it at the
  suite's runtime seeding. Resolved.
- **R2-1 (MUST_FIX, v2)** — R6.2 grep dropped brace/template/expression attributes. Resolved
  in v3 (whole-attribute defect), residue R3-2.
- **R2-3 (MINOR, v2)** — R3.1 light/structural selectors unnamed. Resolved in v3.
- **R3-1 (MUST_FIX, v3, fix-induced, Compounds R2-2)** — R4.1's cross-view test compared
  background+text colour across by-design-varying tones/variants (six pill tones, four button
  variants), failing a correct build. **Resolved in v4:** R4.1 now reads "same state, tone and
  variant" and the test "matches tone for the pill and variant for the button." Verified
  implementable — shared tone (error→danger on Runs+Run; running/merging on Runs) and shared
  primary variant (Now+Runs) exist across two views. List-row path unchanged.
- **R3-2 (MINOR, v3, Compounding R2-1, fix-induced)** — R6.2 regex truncated interpolated
  templates at the first inner `}`. **Resolved in v4:** branch `\{([^{}]|\{[^}]*\})*\}`
  consumes one brace level; re-probed 102/102, all 29 templates emit whole, old regex
  confirmed to truncate the same inputs. No two-level-nested attribute exists.

### Partially Accepted
- **MINOR methods for 1.2/1.4 (v1)** — var-ref test + `--row-h` tied to density e2e. OK.
- **MINOR client-state keys (v1)** — density + group-collapse keys pinned in R6.5. OK.
- **MINOR stylesheet baseline (v1)** — 54.58 kB a reference, gate re-measures. OK.

### Rejected
- (none)

### Unresolved
- **R4-1 (MINOR, v4, Novel)** — v4 Revision History omits the D1–D12 "options were" removal
  (all twelve stripped; lint "0 fixed", so a deliberate untraced edit). No requirement made
  wrong; decisions keep choice + rationale. Non-loop-keeping; optional one-line RH note.

## Patterns & Themes
- **Invariant/test asserted, verification narrower than the claim.** The dominant theme for
  three rounds (R6.2 R2-1→R3-2, R4.1 cross-view test R3-1). Both are now closed on real code.
  Any *future* new test clause must still be checked against the design intent it proves, not
  its own prose — but v4 introduced no new test clause, so the theme is dormant.
- **Fix-induced contradictions.** v3's R2-2 fix created R3-1; v4's R3-1 fix created no new
  contradiction (checked R4.1 against R4.2, R4.3, list-row path). The fix-induced chain has
  terminated.
- **JSX attribute forms.** FE is mostly `{…}`/template-valued; the regex now handles one
  nested brace level and matches all current attributes. Only a two-level-nested interpolation
  would reopen it, and none exists.

## Guidance for Next Review
- The two R3 deltas are the last substantive edits and both verified resolved on real code.
  Do not reopen R3-1 or R3-2 — re-running the 102/102 count or re-reading R4.1 will only
  re-confirm. A clean round is the expected result unless the design phase (next artifact)
  changes requirements text.
- Closed, do not reopen: R1-1/R1-2/R1-3, R2-1, R2-3, R3-1, R3-2 (all verified resolved);
  L-1..L-8 and the v1 verified citation set.
- R4-1 is a traceability nicety, not a requirements defect — do not escalate.
- Design-phase threads (not requirements findings): which same tone the R4.1 pill test uses;
  whether R7.1 seeding opens a detail panel on Now and Deferrals.
- Lenses used: wire contracts (v1), testability/falsifiability (v2), cross-requirement
  contradiction (v3), scope-creep + dead-class correctness (v4). The document is internally
  consistent and cites real artifacts throughout.
