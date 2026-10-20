# Adversarial Review Memory — design
Last updated: 2026-10-20 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX)** — token-check `child_process` classification was unspecified. v2 pins
  it to node-20 callback fields read directly (`error.killed` → timed out; `error.code`
  numeric/`ENOENT`), not `runCommand`'s number filter. Verified against merge.ts:150-172.
- **R1-2 (SHOULD_FIX)** — Data Models omitted the 500 branch. v2 adds `500: { error: string }`
  and the §3 exit-2 mapping names it. Verified against multi-server.ts:461-463 + state.ts:434-441.
- **R1-3 (MINOR)** — doctor default `timeoutMs` unstated. v2 states 10000.
- **R1-4 (MINOR)** — agent-rules read/write path ambiguous. v2 names
  `storeRoot/.spec-workflow/agent-rules.md`; verified against run-setup.ts:69.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (MINOR, Compounding R1-1)** — signal-kill-not-timeout yields `gh exited null`. Rare,
  non-crashing. Implementer's call.
- **R2-2 (MINOR, Novel)** — no named test for the `gh`-timeout / missing-binary token reasons.
  Behaviour is pinned; a task-phase test note would lock it.

## Patterns & Themes
- v1→v2 deltas were all four R1 fixes; each verifies against the cited code. The reviser pinned
  the fields (did not merely reword §4) and wired the 500 end to end.
- Citations remain uniformly accurate across both rounds (~40 ranges). No citation MUST_FIX in
  either round.
- One "consistency" candidate (start-controller suffix on a 500) was dismissed: Req 5 AC 7
  *requires* that line on any non-2xx. Check requirements before calling a message wrong.

## Guidance for Next Review
- Design is converged (0/0). Residual items are MINOR and task-phase.
- Do not re-open: citation accuracy, scope, D2/C7/D9 coherence, D12 remove-and-re-add safety,
  C9 peek motivation, D1 partial-mock rationale, `showHelp` toContain invariant, the token-field
  classification (R1-1, verified), the 500 shape/trigger (R1-2, verified), the agent-rules path
  (R1-4, verified), and the start-controller suffix (required by Req 5 AC 7).
- If a v3 exists, attack only its new deltas; the body is well-covered.
