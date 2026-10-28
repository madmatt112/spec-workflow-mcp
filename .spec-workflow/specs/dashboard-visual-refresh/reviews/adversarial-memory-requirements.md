# Adversarial Review Memory — requirements

Last updated: 2026-10-28 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — R6.2 covered only `data-testid`. v2 added role/aria to the
  grep and pinned label text to screenshots. **Incompletely resolved — see R2-1.**
- **R1-2 (SHOULD_FIX, v1)** — R3.1 name-set test undefined. v2 mandates light/`.dark`/
  structural blocks, no structural dup into `.dark`. Resolved bar a selector detail (R2-3).
- **R1-3 (SHOULD_FIX, v1)** — R7.1 cited empty temp stores as "fixture stores." v2 points
  the capture at the suite's runtime seeding (`seedClosedSpec`, `WorktreeHarness`),
  citations verified accurate. Resolved.

### Partially Accepted
- **MINOR methods for 1.2/1.4 (v1)** — v2 added a var-ref test (1.4) and tied `--row-h`
  to the density e2e (1.2). OK.
- **MINOR client-state keys (v1)** — v2 pinned density + group-collapse keys in R6.5,
  citations verified. OK.
- **MINOR stylesheet baseline (v1)** — v2 marked 54.58 kB a reference, gate re-measures. OK.

### Rejected
- (none)

### Unresolved
- **R2-1 (MUST_FIX, v2, Recurring/Compounding, fix-induced, Compounds R1-1)** — R6.2's
  new grep anchors on `="[^"]*"`, matching only string-literal values. Misses 31/86
  brace/template `data-testid` (incl. `log-tab-*`, `chip-*`, `Row` `testId`), the `Row`
  `role={onClick…}`, and ~6/10 aria (`aria-pressed`, `aria-expanded`, `aria-selected`,
  template `aria-label`). Self-contradicts "template-literal values compared by their
  template text" (grep emits none). Regressed v1 grep which caught all 86 test-ids.
- **R2-2 (SHOULD_FIX, v2, Novel)** — R4.1 "two instances SHALL compute the same …" has no
  test method; R2's literal scan does not catch two valid-but-different tokens. Central
  claim of the spec, unfalsifiable as written.
- **R2-3 (MINOR, v2, Compounding R1-2)** — R3.1 light block + structural block selectors
  unnamed; if both are `:root` the name-set test can't identify "the light block."

## Patterns & Themes

- **Invariant asserted, verification narrower than the assertion.** Persistent. R6.2 fix
  swapped one narrowness (data-testid only) for another (string-literal only). Any
  grep-based check in this FE must account for JSX **expression** and **template-literal**
  attribute forms — most role/aria/testid values here are `{…}`, not `"…"`.
- **Fixes that regress an earlier-agreed behaviour.** R6.2's v2 grep caught fewer
  test-ids than v1's grep. Diff the new check against the behaviour the prior round signed
  off, not just against the new requirement.
- **Core claims without tests.** R4.1's cross-view sameness — the spec's reason to exist —
  has no mandated check while every lesser claim does.

## Guidance for Next Review

- Attack first: whatever the reviser does for R2-1 (the grep). Verify the new command on
  real code — run it and count against `grep -rhoE '(data-testid|role|aria-[a-z-]+)=' FE`.
  If the fix still can't emit a template-literal/expression value it names, it is unfixed.
- Then R2-2's R4.1 verification and R2-3's block selectors.
- Closed, do not reopen: L-2 (Revision History); the v1 verified citation set; R1-3
  direction (seeding) — citations confirmed accurate this round.
- Lens used so far: wire contracts (v1), testability/falsifiability (v2). Unused:
  cross-requirement contradiction sweep (R4.2 pill text vs R6.2 label invariant; R6.4
  "no test edited" vs any new assertion wanting an existing suite); scope-creep (R4.1
  component list vs the "look only" scope).
- Open thread for the design phase, not yet a finding: does the suite's seeding open a
  detail panel on **every** view (Deferrals, Now) as R7.1 requires?
