# Adversarial Review Memory — requirements

Last updated: 2026-10-28 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — R6.2 asserts `data-testid` + `role` + `aria-*` + label-text are
  invariant, but the `Check:` only greps `data-testid`. Role/aria/label unverified; R4.1
  rebuilds tabs (`RunPage.tsx:640-653`) and chips (`primitives.tsx:88` `aria-pressed`) from a
  shared definition, so an a11y drop can merge green.
- **R1-2 (SHOULD_FIX)** — R3.1 "a test SHALL compare the two name sets" is undefined: the
  token file mixes theme-independent tokens (spacing/type/radius/motion, `:root` only) with
  colour tokens (both themes) and shadows (both). No way given to identify the colour-token
  subset the test compares.
- **R1-3 (SHOULD_FIX)** — R7.1 cites `playwright.worktree.config.ts:18-71` as "the fixture
  stores"; those lines set empty temp `SPEC_WORKFLOW_HOME`/`XDG_STATE_HOME`. Fixtures are
  seeded at runtime by `WorktreeHarness`/`seedClosedSpec` in `e2e/worktree-shell.spec.ts`. A
  script pointed at the config alone renders an empty dashboard.
- **MINOR** — R1.2 and R1.4 state no verification method; R1.4 not in R2.3 red-first and R2
  lint checks colour literals, not undefined var refs.
- **MINOR** — client-state keys beyond `theme` unpinned (density `DENSITY_KEY`
  `ShellProvider.tsx:147`; group collapse — the latter guarded by e2e `:258`).
- **MINOR** — NFR baseline "54.58 kB" is a drafter probe, not independently rebuilt.

## Patterns & Themes

- **Invariant asserted, verification narrower than the assertion.** R6.2 (check covers 1 of
  4 attribute classes). Watch every "SHALL be the same / a test SHALL compare" clause and
  confirm the stated check actually covers the whole claim.
- **Tests mandated against a token structure that doesn't exist yet.** R3.1 assumes a cleanly
  separable colour-token set; the file doesn't provide one. Requirements that mandate a test
  must also pin what the test can see.
- **Citations load-bearing but one-sided.** R7.1's config citation is accurate as a file but
  mislabelled as "fixture stores." Check that a cited artifact actually *contains* what the
  sentence claims, not just that the path/line exists.
- All code citations verified accurate this round; the delta (lint `./` prefixes) is clean;
  `.hljs`/`.markdown-content` removal confirmed safe (no FE markdown rendering).

## Guidance for Next Review

- Deltas to attack first next round: whatever the reviser changes for R1-1/R1-2/R1-3. For a
  fix-induced re-check, scope to the fix diff vs the requirement, don't re-review the doc.
- Fresh lens used this round: wire contracts. Next unused lens candidates: testability/
  acceptance-criteria falsifiability; cross-requirement contradiction (e.g. R1.2 token-ref vs
  R2 inline-style literal check vs the e2e 36/32 px assertion all agreeing on `--row-h`).
- Do not reopen L-2 (closed in Revision History) or the verified citation set above.
- If R3.1 is "fixed" by duplicating structural tokens into `.dark`, flag it — that is the
  wrong fix.
