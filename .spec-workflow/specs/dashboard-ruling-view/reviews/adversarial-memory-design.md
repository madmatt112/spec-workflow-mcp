# Adversarial Review Memory — design

Last updated: 2026-11-08 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1 just raised)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (M1) — MUST_FIX [drafting].** Data Models: "`DiffCommit.hash` is 7 characters: `%h` for a
  found commit" is a false behaviour claim. `git show --format=%h HEAD` in this repo returns 8 chars
  (`3be9964a`); git abbreviates past 7 as the object count grows. Found arm (`%h`, 8) and not-found
  arm ("first 7") then disagree in length. Fix: wording only — call it git's abbreviated short hash
  (≥7) and align the not-found arm. Negligible runtime impact; flagged because the directive makes a
  wrong behaviour claim an automatic MUST_FIX.

## Patterns & Themes
- v1 is unusually clean: all ~60 citations resolve to the right symbol/range; both C6 probes
  re-ran and confirm the execFile timeout-vs-maxBuffer discrimination and the git cat-file/show
  behaviour. Data-model completeness and error-branch-shape (discriminant + status) rules both pass.
- The only crack is a library-behaviour claim about git's short-hash width — the kind of
  "checkable API capability" the round rules target. Probe captured the format but not the width.

## Guidance for Next Review
- M1 is wording; verify the reviser changed the "7 characters" sentence without touching
  `parseShow`/`capDiff`/`WaitDiff` behaviour or any requirement. Scope the re-check to that diff.
- Do not re-raise (verified fine in R1, cite only with new evidence): report-scope of C2 (ev.report
  set only at 703-704/787-788/945-947 is correct per R2 AC 5); C9's R1-AC-7 rewrite (answered-
  elsewhere still clears the `wait:<id>` key); `riskFromLedger` regex vs the 848 note; `resolved`
  exhaustiveness with `case 'answer'`; the error-question task tag not leaking via `escalationRulings`.
- Fresh lenses still unused: a security/data lens (no secrets/auth path here — the diff route sits
  under the same auth hooks, R4 AC 11), and a test-adequacy lens on the C9 wiring (e2e-only).
