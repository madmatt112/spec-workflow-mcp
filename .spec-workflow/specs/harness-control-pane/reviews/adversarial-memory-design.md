# Adversarial Review Memory — design

Last updated: 2026-09-28 (Round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — round 1 dispositions pending revision)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved (this round — R1)
- **R1-1 (SHOULD_FIX)** — harness-log producer has no launch re-point / byte-offset reset on
  a new launch; `launchedAt`/`reset` consumer behaviour unspecified. Per-launch log path
  (`logs/<projectId>-<launch time>.log`) means the 2nd run of a session does not stream.
- **R1-2 (SHOULD_FIX)** — sdd-providers.sh merge (C9) ignores the script's `none()`
  short-circuits (lines 41/35/66) and its inline per-row checks (54-64); an override/added
  run-file role can bypass validation or never merge (no `## Providers` block case).
- **R1-3 (SHOULD_FIX)** — Testing Strategy omits the mandatory harness/ checks
  (`sync-plugin-assets.cjs`, `check:plugin-assets`, `claude plugin validate . --strict`,
  agent-rules.md:27); the design edits 7 harness/ files.
- **R1-4 (MINOR)** — reconcile(clients) snapshot targeting unspecified; risk of resetting
  existing clients' log views.
- **R1-5 (MINOR)** — buildSetupView prose omits several SetupView fields; OverviewWatch
  .snapshot() has no return shape. Data Models itself is complete (no union-only object).
- **R1-6 (MINOR)** — validateSetup does not enforce the supervisor Opus-5.5/Fable-5.1 floor;
  a bad override fails only as a child refusal.

### Flag rulings (closed by reviewer authority — carried to next drafter)
- Req 1 AC 4 (D3 deepseek pre-fill): **refinement** — keeps the form valid on load.
- Req 3 AC 13 (retry, residual race): **refinement** — exceeds the blessed deregister.mjs bar.
- Req 3 AC 14 (re-run setup on unmarked reuse): **refinement** — marker gates *use*, intent met.
- Req 2 AC 6 (malformed file deleted): **refinement** — matches AC 6 anti-re-refuse purpose;
  `mismatch` correctly not deleted.

## Patterns & Themes
- The strongest gaps cluster on the **launcher ↔ watch ↔ client** seam (per-launch log
  lifecycle, snapshot fan-out) — the fresh-lens wire contract. Payload *shapes* are sound;
  *lifecycle/reset* semantics are thin.
- The **shared-file concurrency** theme (pointer file) recurs from the parent decomposition;
  accepted here as within the blessed helper's bar but worth an implementation test.
- **harness/ change discipline** (plugin sync + validate) is under-represented in verification.
- Citations are accurate; the lint-pass directory prefixes all resolve. No MUST_FIX and no
  false codebase claims this round.

## Guidance for Next Review
- Re-check R1-1/R1-2/R1-3 first; they are the loop-keeping SHOULD_FIX items.
- Do NOT re-litigate the four flag rulings (closed refinements) or the 63 citation-identifier
  warnings (rejected false-positive class) without new evidence.
- Confirm any revision to sdd-providers.sh keeps validation on merged rows and drops the
  early `none()` returns when a run file is passed.
- Confirm the launch-log lifecycle (path re-point, offset reset, client reset) is pinned.
- Data Models completeness and library-capability probes passed in R1; re-verify only if the
  relevant lines change.
