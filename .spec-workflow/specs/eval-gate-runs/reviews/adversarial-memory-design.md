# Adversarial Review Memory — design

Last updated: 2026-11-04 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- None.

### Partially Accepted
- None.

### Rejected
- None.

### Unresolved
- None. Round 1 found no MUST_FIX or SHOULD_FIX. Clean round, verdict converged.

## Patterns & Themes
- Every design citation (both ends) and every touched/relied-on test assertion verified accurate; lint-pass deltas were citation-only.
- Two load-bearing Node runtime claims were independently probed and confirmed on node 24.13.0 (stable on node 20): (1) a symlinked `dist/evals/cli.js` runs `main` from no entrypoint — `cli.ts:208-215` compares unresolved `argv[1]` (`path.resolve`) against realpath'd `import.meta.url`, so it prints nothing/exit 0, which is why D6 needs the dynamic-import wrapper; (2) a CJS `exports.createWait` is exposed as a named export via `import()`.
- The reason-to-count rule is airtight: all seven reason strings `selectCases` emits classify with no gap; select/gate counts agree by construction because both run `plannedRuns` over identical exact-mode reasons.
- No record/`select`-output parser exists outside `src/evals/` (grep-confirmed), underpinning R3 AC4's "record keeps v:1, no reader assumes 3 runs".

## Guidance for Next Review
- If a round 2 opens (e.g. after an edit), re-check only the fix diff against its requirement; do not re-review the whole document.
- The probe artifact for the symlink/CJS-import claims lives at `/tmp/scratchpad/sdd/eval-gate-runs/probe` (recreate if gone); the behaviours are stable across node 20/24, so re-probing is not needed absent an edit to `cli.ts:203-215` or the toy-package `type` field.
- If `plannedRuns`, the `onLine` wiring, or the summary format `<id> <verdict> <passed>/<runs> <first reason>` changes, re-verify `gate.test.ts:369-371` still resolves to `fail 0/3` for the 3-run `case` fixture and `:440` stays `passes 3/3`.
