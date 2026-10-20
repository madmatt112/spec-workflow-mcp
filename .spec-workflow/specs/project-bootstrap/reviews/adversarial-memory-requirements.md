# Adversarial Review Memory — requirements

Last updated: 2026-10-20 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — awaiting reviser disposition)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — Req 3 AC 5 treats an absent `mcpServers` key as "not an object" and
  exits 1, contradicting AC 3's keep-other-keys/add-entry intent. Scope the error to a present
  non-object; create `mcpServers` when absent.
- **R1-2 (SHOULD_FIX)** — Security NFR says the secret goes only to loopback, but Req 5 AC 2
  takes the controller URL from the dashboard session file, which can be a non-loopback `--host`
  bind. Gate the resolved URL on loopback before sending the Bearer secret.
- **R1-3 (SHOULD_FIX)** — Req 6 AC 3 "re-run exits 0" contradicts Req 5 AC 7 "exit 2 on
  registration failure" when the controller is down on the re-run. Qualify AC 3.
- **R1-M1 (MINOR)** — detection flags extend the decomposition command line; justified by D8.

## Patterns & Themes
- Every code citation in v1 is accurate; attacks landed on internal AC-to-AC contradictions
  and unstated preconditions, not on misstated artifacts.
- Recurring shape: ACs that state an unconditional outcome ("exit 0", "replace only",
  "the URL") while another AC or the NFR adds a condition the first AC omits.
- The init→controller boundary is handled well: Req 5 AC 4 names both base-code gaps
  (`project-manager.ts:240-249` remember-guard; `:318-343` store-root derivation in the
  controller env) and AC 6 pins the `{ projectPath }` invariant.

## Guidance for Next Review
- Round 2: confirm the three SHOULD_FIX ACs were qualified without introducing new drift
  (fix-induced re-check, scoped to the edited ACs).
- Do not re-raise: citation accuracy (verified clean), the detection-flags scope (MINOR,
  justified), the backtick data-contract for `agent-rules.md` (round-trip verified against
  `run-setup.ts:88` / `gate-rules.ts:125-139` and `SDD-HARNESS.md:255/262`).
- Fresh-lens candidates not yet used: error-message/observability completeness (every `fail`
  line's "fix" text), and ordering/atomicity of the file writes vs the registration call.
