# Adversarial Review Memory — requirements
Last updated: 2026-10-20 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — Req 3 AC 5 rejected a valid `.mcp.json` lacking `mcpServers`.
  Fixed in v2: AC 5 errors only on a present non-object; AC 3 creates the key when absent.
  Verified clean in v2 — no new drift.
- **R1-3 (SHOULD_FIX, v1)** — Req 6 AC 3 "re-run exits 0" contradicted Req 5 AC 7 exit 2.
  Fixed in v2: exit 0 is now conditioned on controller reachability; failed re-register exits
  2. Verified clean in v2.

### Partially Accepted
- (none)

### Rejected
- **R1-M1 (MINOR, v1)** — detection flags extend the decomposition command line; justified by
  D8 and Scope notes. Closed, do not re-raise without new evidence.

### Unresolved
- **R2-1 (MUST_FIX, v2, fix-induced, Compounds R1-2)** — the R1-2 fix (Req 5 AC 2
  loopback-fallback) rests on a false premise: the dashboard session URL is hardcoded
  `http://localhost:${this.actualPort}` (`multi-server.ts:356`), independent of the `--host`
  bind (`:349`). `localhost` is loopback (`security-utils.ts:51-54`) and the other two URL
  sources are `127.0.0.1` literals, so the "resolved URL host is not loopback" guard can never
  fire and the parenthetical ("bound with non-localhost `--host`") misstates the code. In the
  LAN-only-bind case it names, the controller is not on loopback, so the "use 127.0.0.1"
  fallback cannot connect. The Security NFR was already satisfied. Drop or reframe AC 2.

## Patterns & Themes
- v1's three findings were internal AC-to-AC contradictions; all code citations were accurate.
- v2 flipped: the R1-2 *fix* introduced the first real codebase-grounded MUST_FIX by assuming
  `DashboardSessionEntry.url` carries the bind address. It does not (`multi-server.ts:356`).
  Lesson: findings that assert a producer field's value must be traced to the one line that
  writes it, not inferred from the consumer's option (`--host`).
- Recurring shape (now twice): ACs/NFRs that assume a value ("the resolved URL", "exit 0")
  that another layer constrains — here the hardcoded session URL constrains the URL host.

## Guidance for Next Review
- Round 3: fix-induced re-check of R2-1 only — confirm Req 5 AC 2 was dropped/reframed against
  the Security NFR without re-introducing a secret-off-loopback path or breaking the
  `controller`/`registered` doctor checks that reference AC 2's URL.
- Do not re-raise (verified clean): R1-1 (`.mcp.json` absent-key handling), R1-3 (re-run exit
  code), all other code citations (accurate through v2), the agent-rules backtick data
  contract, the detection-flags scope (MINOR, closed).
- Fresh-lens candidates still unused: observability completeness of each doctor `fail` line's
  fix text; ordering/atomicity of the temp+rename writes vs the registration call (both looked
  coherent on a first pass — low yield, confirm only if a delta touches them).
