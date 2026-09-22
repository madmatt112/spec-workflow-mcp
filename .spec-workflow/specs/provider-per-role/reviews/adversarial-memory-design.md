# Adversarial Review Memory — design

Last updated: 2026-09-22 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — Keyless lifecycle contradiction: v1 E2E claimed a keyless run
  defers (1)/(4) via `sdd-implementation-phase/SKILL.md:201-210` (a tool/restart mechanism),
  while preflight escalates on an unset key. RESOLVED in v2: the E2E paragraph now reads
  "Without the key, task 1 halts the spec (Req 6 crit 7); (1) and (4) need the key, not a
  deferred half"; the `:201-210` citation is gone. Design took option (b) — key required to
  build. Verified consistent with scenarios (2)/(3). Closed.
- **R1-2 (MINOR, v1)** — Watch `!=` mark silently contingent on DeepSeek's echoed
  `message.model`. RESOLVED in v2: Component 6 line 77 adds "`!=` depends on DeepSeek's
  echoed `message.model` (Component 7)." Verified accurate. Closed.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 (MINOR, v2)** — Compare-mode provider-pair placement under-specified. Component 5's
  "append the pair after each spec's total cell" invites a mid-line layout that breaks the
  unlisted `toContain` assertions at `usage.test.ts:258-259`; the one-spec example (line 160)
  implies end-of-line append (which keeps them passing). No compare example, no Data Models
  entry. Fix: one clause pinning end-of-line placement, or list the compare block as changed.
  Display/test-shape only; not loop-keeping.

## Patterns & Themes

- The DeepSeek/CLI *behaviour* contract (transcript shape/location, `ANTHROPIC_AUTH_TOKEN`
  auth, `--agents` key acceptance, `auto`+`prompts none`, model echo) is deferred to preflight
  (a) by design; the stub-`claude` launcher test cannot catch a real mismatch. Sound by
  design — the spec's correctness rests on preflight (a). Any future weakening is high-risk.
- The producer→consumer wiring (provider propagation, no double-count, `none` vs `anthropic`
  defaults, header/table asymmetry, transcript locator) and the required-field addition (only
  the empty-report `toEqual` at usage.test.ts:266 breaks) were traced end to end and are
  sound and code-accurate.
- v2 delta = surgical, correct. Both R1 fixes land cleanly; no fix-induced regression.
- The soft spot remaining is formatting-detail precision (R2-1), not lifecycle or wire logic.

## Rulings this round / earlier (do not re-open)

- **R1-1 Revision-History ruling** — Component 7 / Error Handling 8 match BOTH Req 6 crit 6
  ((a) fails → escalate) and crit 7 (key unset → report + no fabricated outcome); no content
  change needed there. Closed by the v2 Revision History.
- **Req 2 crit 5 / D4** (`--agents` model = alias, not profile) — REFINEMENT (closed, R1).
- **Req 2 crit 7 / D9** (`--add-dir` when store outside code root) — REFINEMENT (closed, R1).

## Guidance for Next Review

- If a v3 exists, verify only that R2-1's clause (if added) pins the compare total-line
  layout and that `usage.test.ts:258-259` are either untouched (end-append) or listed as
  changed. Re-verify any citation the v3 delta rewrites, both ends.
- Well-covered, do not re-check unless the design changes them: the delta text (R1-1/R1-2
  fixes); the unit-test range citations (all 7 resolve to the named tests); the required
  `providers` field breaking only usage.test.ts:266; the preflight/escalate halt chain
  (SKILL 100-106 → 247-248, `escalation` category, body step-1 refuse-before-start); the
  hook early-exit via XDG_STATE_HOME (`sdd-activity.sh:11-12`); vitest 4.0.16 installed.
- Lenses used so far: v1 = wire contracts; v2 = prescribed tests vs installed runner +
  preflight/escalate safety. Unused: failure/rollback ordering and idempotency across
  re-entry (resumed orchestrator, launcher re-run across rounds, partial `spawn.start`
  without `spawn.end`), and docs-count discipline (Component 8 count-word edits).
