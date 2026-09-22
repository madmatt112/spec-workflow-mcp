# Adversarial Review Memory — design

Last updated: 2026-09-22 (Round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — first review)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (SHOULD_FIX)** — Keyless lifecycle is contradictory: preflight (task 1) escalates
  on an unset `DEEPSEEK_API_KEY` and blocks all later tasks (Component 7, Error Handling 8,
  Req 6 crit 6-7), yet Testing E2E claims a keyless session defers scenarios (1)/(4) via
  `sdd-implementation-phase/SKILL.md:201-210` — a mechanism scoped to a missing skill/tool
  (fixed by rebuild+restart), not a missing key. A from-scratch keyless run (this machine)
  never reaches the completion gate, so the key-independent code (usage/ledger/render folds,
  docs, their unit tests) is never built and the "deferred half" is unreachable. Fix:
  distinguish key-*absent* (defer, revisitCriteria names the key) from run-(a)-*failed*
  (escalate).
- **R1-2 (MINOR)** — Watch tier-line `!=` fires on `s.model !== profile.model`; `s.model` is
  the preflight-measured `message.model`. If DeepSeek echoes the alias (`claude-opus-4-8`),
  a reviewer on `deepseek-v4-pro` shows no `!=`. Display-only; note the contingency in
  Component 6 / D8.

## Patterns & Themes

- The DeepSeek/CLI *behaviour* contract (transcript location & shape, `ANTHROPIC_AUTH_TOKEN`
  auth, `--agents` key acceptance, `auto`+`prompts none` permitting the child's Write, model
  echo) is deferred to preflight (a) by design. The launcher unit test uses a stub `claude`
  that writes where the launcher expects, so it cannot catch a real mismatch — the spec's
  correctness rests on preflight (a). Any future weakening of that preflight is high-risk.
- Verification-lifecycle reasoning is the soft spot, not the wire wiring. The producer→
  consumer contracts (provider propagation, no double-count across the three spawn rows,
  `none` vs `anthropic` defaults, header/table asymmetry, transcript locator) were traced end
  to end and are sound and code-accurate.

## Rulings this round (do not re-open)

- **Req 2 crit 5 / D4** (`--agents` model = alias, not profile) — REFINEMENT (closed).
- **Req 2 crit 7 / D9** (`--add-dir` when store outside code root) — REFINEMENT (closed);
  grounded in the shared-root (tradr) layout, restores single-repo parity.

## Guidance for Next Review

- Verify R1-1's fix reconciles Component 7 / Error Handling 8 with the Testing E2E deferred
  half, and that a key-absent deferral's `revisitCriteria` names `DEEPSEEK_API_KEY`, not just
  a restart. Confirm the key-independent tasks can build without a key.
- Confirm R1-2 got a one-line contingency note (or was consciously declined).
- Re-probed and CONFIRMED this round, no need to re-check unless the design changes them:
  `claude --version` = 2.1.280; `--tools`/`--allowedTools` accept comma OR space; the
  transcript SLUG rule (`/` and `.` → `-`); `agent-profiles.json` reviewer 47-51 / checker
  7-11 / reviser 52-56; the fold double-count analysis (usage.ts current-not-cleared,
  ledger.ts tokens-only-if-unset).
- Next lens (unused so far): failure/rollback ordering and idempotency across re-entry
  (resumed orchestrator, launcher re-run across rounds, partial `spawn.start` without a
  `spawn.end`), and the docs-count discipline (Component 8 count-word edits).
