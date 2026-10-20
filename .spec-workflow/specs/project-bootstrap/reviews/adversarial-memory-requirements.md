# Adversarial Review Memory — requirements
Last updated: 2026-10-20 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — Req 3 AC 5 rejected a valid `.mcp.json` lacking `mcpServers`.
  Fixed in v2: AC 5 errors only on a present non-object; AC 3 creates the key when absent.
  Verified clean through v2.
- **R1-3 (SHOULD_FIX, v1)** — Req 6 AC 3 "re-run exits 0" contradicted Req 5 AC 7 exit 2.
  Fixed in v2: exit 0 conditioned on controller reachability; failed re-register exits 2.
  Verified clean through v2.
- **R2-1 (MUST_FIX, v2, fix-induced, Compounds R1-2)** — Req 5 AC 2's loopback-fallback IF
  clause guarded an unreachable condition and misstated how `--host` relates to the resolved
  URL. Fixed in v3: the dead IF clause was deleted and replaced with a loopback-by-construction
  statement (session URL hardcoded `localhost` at `multi-server.ts:356`, two fallbacks are
  `127.0.0.1` literals, `localhost` is loopback per `security-utils.ts:51-54`). Re-verified
  clean in v3 — all four citations accurate, no secret-off-loopback path, doctor
  `controller`/`registered` checks still resolve AC 2's URL.

### Partially Accepted
- (none)

### Rejected
- **R1-M1 (MINOR, v1)** — detection flags extend the decomposition command line; justified by
  D8 and Scope notes. Closed, do not re-raise without new evidence.

### Unresolved
- (none)

## Patterns & Themes
- v1's three findings were internal AC-to-AC contradictions; all code citations accurate.
- v2's one MUST_FIX was introduced by the R1-2 *fix*, which assumed `DashboardSessionEntry.url`
  carries the bind address. It does not (`multi-server.ts:356` hardcodes `localhost`).
- v3's delta (single AC) resolved R2-1 correctly and introduced no new drift. The fix took the
  "loopback by construction" framing R2 recommended and cited it accurately.
- Lesson held: trace a producer field's value to the one line that writes it, not the
  consumer's option. The v3 citation `multi-server.ts:349-356` correctly brackets both the bind
  (349) and the URL write (356).

## Guidance for Next Review
- All findings through v3 are resolved. Requirements is converged at v3 (0/0).
- Do NOT re-raise (verified clean): R1-1 (`.mcp.json` absent-key handling), R1-3 (re-run exit
  code), R2-1 (AC 2 loopback resolution), all code citations (accurate through v3), the
  detection-flags scope (MINOR, closed).
- Only remaining MINOR, already accepted: LAN-only `--host` bind makes the controller
  unreachable on loopback → `init` exits 2, `controller` check fails. Acceptable fail-safe;
  the AC 7 remedy line is mildly imprecise in that edge. Not a defect — do not raise.
- If a future delta re-opens Req 5 AC 2 or Req 7 AC 1.4/1.5, re-check the loopback-by-
  construction claim against `multi-server.ts:356` again before accepting.
