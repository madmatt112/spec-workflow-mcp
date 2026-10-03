# Adversarial Review Memory — requirements
Last updated: 2026-10-02 (after v2 review)

## Cumulative Findings Summary

### Accepted
- R1-1 (SHOULD_FIX, v1) — Transcript-location contract: `<projects dir>` + override, the
  all-projects scan, and the `agentId`→activity `session` join. v2 Req 1.3/1.7/NFR Security
  fixed it. VERIFIED SOUND in v2: `spawn.end` has no `session`; all 8 orchestrator agentIds
  resolve via `harness-activity.jsonl`; session UUID matches the validator.
- R1-2 (SHOULD_FIX, v1) — Req 3.3 template set. v2 names the five template-less blocks plus
  `reviewer`/`checker` and restates the premise as six skeletons with deferred field text.
  VERIFIED: `BRIEF_TEMPLATES` has exactly those six kinds; reviewer/checker absent.
- R1-3 (SHOULD_FIX, v1) — Batch idempotency. v2 added Req 6.7. PARTIAL — see R2-2 (retro-log
  append + HANDOFF rewrite not covered).
- R1-4 (SHOULD_FIX, v1) — Runaway-guard input + Req 7.5 spawn. v2 pinned open-tasks to phase
  start and recorded the completion-gate spawn in D1. PARTIAL — see R2-4 (holder across
  supervisor restart).
- R1-5 (MINOR, v1) — Scenario-1 ephemeral transcripts. v2 tied capture to the early write
  (Req 1.6). PARTIAL — see R2-3 (no snapshot; tradr-hosted retention still unstated).
- R1-6 (MINOR, v1) — Req 7.1 rationale rewrite. v2 added `:16` default + `:17-20` rationale.
  VERIFIED accurate. Resolved.
- R1-7 (MINOR, v1, partial) — Req 3.5 close-path overlap. v2 routes impl close path through
  Req 6 scripts; other `spec-edit.mjs` uses left to design. Resolved as scoped.

### Partially Accepted
- (tracked above as PARTIAL: R1-3→R2-2, R1-4→R2-4, R1-5→R2-3)

### Rejected
- L-1…L-7 (lint-pass citation-identifier warnings) — rejected by the lint pass, closed in the
  Revision History. `base` is a document-defined source name; `harness`/`orient`/
  `implementation` are MCP tool/action/phase names; `reviewer`/`checker` are worker-kind
  names. Not citation defects. Do not re-raise.

### Unresolved (raised v2, round 2)
- R2-1 (SHOULD_FIX, Novel/carried) — Req 1.5/D7: "input W" undefined (must mean all non-output
  W terms; literal `input` is ~0.01% of W on a real row) and `base` sizing needs an unstated
  chars-per-token constant (probe hardcodes 3.5). Threatens criterion 6.
- R2-2 (SHOULD_FIX, Compounds R1-3, fix-induced) — Req 6.7 idempotency covers ledger row,
  checkbox, commit; NOT the retro-log append (`SKILL.md:255`) or HANDOFF State rewrite
  (`:257`). Re-run after a commit failure double-appends the retro-log entry.
- R2-3 (MINOR, Compounds R1-5) — transcript expiry fixed only by "capture early"; no snapshot,
  and tradr-hosted retention never stated.
- R2-4 (MINOR, Compounds R1-4) — "open tasks held fixed" has no holder across a supervisor
  restart; bites only >40-task phases (floor is 12).
- R2-5 (MINOR) — Req 3.3 cites `harness.ts:493-544`; sixth template body ends at 557. Extend.

## Patterns & Themes
- Producer/consumer asymmetry (hook vs usage action) is now resolved in Req 1.3 — verified.
- Precision illusion: the doc is very precise with line ranges yet overloads informal terms
  ("input W" vs the formula's `input` field) and relies on probe constants (3.5 chars/token)
  it never surfaces. The per-source split is the weakest-specified core mechanism.
- Fix-induced incompleteness: each accepted SHOULD_FIX fix (R1-3→6.7, R1-4→7.3, R1-5→1.6)
  closed the narrow case named in round 1 but left an adjacent case (non-ledger appends,
  supervisor restart, absolute expiry) open. Re-check the *neighbours* of each fix.

## Guidance for Next Review
- Well-covered, do not re-litigate: baseline W (4.50M doc / 2.68M impl), skill keep/move
  lists (Req 3.1/3.2), the Req 1.3 transcript join (verified sound), template-set enumeration
  (Req 3.3), Req 7.1 citations, restart arithmetic for the stated 17-task case.
- Focus v3 on whether R2-1 (define "input W" + base sizing) and R2-2 (retro-log/HANDOFF
  idempotency) got concrete contracts; both are the loop-keeping SHOULD_FIX.
- Fresh lenses still unused: cross-spec interaction (does the baseline-sources.md compare
  survive a BUDGET change between baseline and after-run?); testability of D9's quality
  signals (are "escalations and errors", "fix rounds per task" countable from the ledger
  as it stands?).
