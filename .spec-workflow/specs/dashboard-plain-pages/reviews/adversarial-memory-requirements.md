# Adversarial Review Memory — requirements

Last updated: 2026-11-14 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- Lint-pass L-1..L-7 (by the drafter, pre-review): all rejected as citation-identifier false positives. Closed in Revision History; do not re-open.

### Unresolved (round 1)
- **R1-1 [design] SHOULD_FIX** — Req 3 AC1 / D10 require a `run` id on each usage-log line, but `onRateLimit(windows)` carries no run id (`runs.ts:406`, `step.ts:135`, phase interfaces `document.ts:182`/`retrospective.ts:41`/`implementation.ts:96`/`closeout.ts:62`/`merge-fix.ts:50`); the six `runs.ts` call sites pass it raw while adjacent `onStepActivity` gets `run.id`. No-run case (supervisor / optional `spec.runId`) unspecified. Introduction's "one controller writer" and "Left to the design" both omit this.
- **R1-2 [design] SHOULD_FIX** — No named server→client transport for server-computed burn/fit (Req 4 AC4, 5 AC5). Only surviving Usage fetch is `/api/controller/rate-limit` (window-only); closed-specs route deleted. 4 AC8 pins refresh to `UsagePage.tsx:95-102` (rate-limit fetch), which can't carry per-run fit.
- **R1-3 [drafting] SHOULD_FIX** — "Cut or changed against the decomposition entry" lists D1 and D2 but omits D7's redefinition of burn (decomp "utilisation delta over 24 h" → "sum of positive steps"), observably different across a reset.
- **R1-4 [design] MINOR** — Req 7 AC3 resolve POST `projectId` for a shared store unstated (representative implied by D2, not said for the mutation path).
- **R1-5 [design] MINOR** — D11 "enabled or not" relies on the controller-runs push being account-wide; true today but unstated.

## Patterns & Themes
- Wire-contract omissions cluster where a new field/number must cross a boundary that does not carry it: the run id into the log writer (R1-1) and the burn/fit out to the page (R1-2). Both are absent from the explicit "Left to the design" list, so they read as oversights.
- Citations are uniformly accurate (all ~30 verified both ends). The risk surface is scope/completeness, not misstatement.
- Scope-delta declarations against decomposition #34 are incomplete by one entry (D7).

## Guidance for Next Review
- Confirm the reviser named the run-id path and the no-run case in Req 3 (or "Left to the design"), and that the Introduction no longer undersells the controller change.
- Confirm a burn/fit transport (route or push + response shape) is named and that 4 AC8 matches it.
- Confirm the D7 burn deviation is in the decomposition-delta note.
- Re-probe no `## Probes` line existed in the context file; nothing owed there.
- All v1 citations verified accurate — a later round need not re-verify unless a line range moved.
