# Adversarial Review Memory — requirements
Last updated: 2026-09-16 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — Gate B had no fire-once guard. Fixed by Req 5 AC 6; the
  Req 4 AC 1 half was completed in v3 (see R2-1).
- **R1-2 (SHOULD_FIX, v1)** — No in-budget channel for gate-A decisions / veto list.
  Fixed by Req 1 AC 6 (server surface). Follow-ups R2-2 (v3) and R3-1 (still open).
- **R1-3 (MINOR, v1)** — No owner for the decision→`{header,question,options}` transform.
  Fixed by Req 2 AC 1 (drafter owns it).
- **R1-4 (SHOULD_FIX, v1)** — Extraction/rank assigned to the orchestrator, which cannot
  read the body. Fixed by Req 2 AC 1 / D2 (drafter). Spawned R2-2/R2-5/R3-1.
- **R1-5 (SHOULD_FIX, v1)** — Class (a) no-list behaviour undefined. Fixed by Req 4 AC 5.
  Citations verified accurate through v3.
- **R1-6 (SHOULD_FIX, v1)** — Gate-A annotate unrouted. Fixed by (old) Req 2 AC 7;
  completed by R2-3/R2-4 in v3.
- **R1-7 (MINOR, v1)** — "returns an error" case missing from Req 3/6 AC 1. Fixed.
- **R1-8 (MINOR, v1)** — `questions.md` commit/persistence unstated. Fixed by Req 1 AC 5.
- **R1-9 (MINOR, v1)** — Gate-A timing vs Lint step. Fixed by Req 2 AC 2.
- **R2-1 (MUST_FIX, v2)** — Req 4 AC 1 unconditional vs Req 5 AC 6 fire-once. Fixed in v3:
  Req 4 AC 1 scoped to first `MODE: normal`, cross-references Req 5 AC 6. Verified resolved.
- **R2-2 (SHOULD_FIX, v2)** — Drafter→surface channel: Req 1 AC 6 named the orchestrator
  while the producer was the drafter. Fixed in v3 (drafter writes surface directly). BUT
  see R3-1: the drafter has no MCP tool to do so.
- **R2-3 (SHOULD_FIX, v2)** — Mixed change+annotate double-route. Fixed by v3 Req 2 AC 5
  (per-decision approve/needs-revision, one revision round covers all). Verified resolved
  on the happy path.
- **R2-4 (MINOR, v2)** — Changed-option free text dropped. Fixed in Req 2 AC 5.
- **R2-5 (MINOR, v2)** — Pre/post-lint triple staleness. Fixed by Req 2 AC 2 (lint may not
  reword a ranked decision; drafter rewrites the triple first if needed).
- **R2-6 (MINOR, v2)** — Recording asymmetry (change recorded nothing). Fixed in Req 2 AC 5.

### Partially Accepted
- (none)

### Rejected
- Lint L-1..L-9 (v1/v2/v3) — citation-identifier warnings for `record`, `headless`,
  `question`, `options`; rejected across all three rounds because they are the document's
  own gate-mode terms / AskUserQuestion payload keys, not cited source text. L-6..L-9
  (v3) additionally flag the v2 Lint-pass rejection note itself. Confirmed rejected in v3;
  no new evidence to overturn.

### Unresolved (raised v3, awaiting response)
- **R3-1 (SHOULD_FIX)** — Compounds R2-2. Req 2 AC 1 makes the drafter write the gate-A
  list "directly to the gate-A server surface," but `sdd-drafter.md:7-13` grants no
  `mcp__spec-workflow__*` tool (the orchestrator and reviser both do). D2's rationale
  conflates document `Write`/`Edit` with a server-tool call. The R2-2 fix relocated the
  payload onto the one actor that cannot reach the server. Fix: give the drafter the
  server tool (a real `sdd-drafter.md` change) or return the write to a server-capable
  actor.
- **R3-2 (SHOULD_FIX)** — Novel. Gate A is dropped when the supervisor is interrupted
  between the `gate-a` return (a Step-1 early return) and the gate's completion: a fresh
  orchestrator orients at `D=1/A=0` → Step 2 (round 1), `gate-a` never re-fires (Req 2 AC
  2/AC 3), and block mode wrote no `questions.md` / no HANDOFF row. Refutes D3's "no extra
  state." Fix: durable receipt before asking + defined resume (re-ask or fall to record).
- **R3-3 (SHOULD_FIX)** — Novel. Partial/timed-out AskUserQuestion across Req 2 AC 4's
  two-call split is undefined; Req 3 covers only whole-gate denial at entry. Call-1
  answered + call-2 denied/errored/crashed has no rule. Fix: record answered decisions,
  treat unreturned as record/no-answer, proceed.
- **R3-4 (MINOR)** — Novel. Record-mode `questions.md`/commit-failure vs the absolute
  non-stall guarantee (Req 1 AC 5 + Reliability NFR) is undefined. Note proceed +
  best-effort record.

## Patterns & Themes

- **Incomplete fixes at boundaries persist into v3.** v2's boundary pattern recurred: the
  R2-2 fix (drafter writes the surface) fixed the naming but not the capability (R3-1) —
  the fix names an actor without the tool to perform it, the same class as v2's
  "one side of the seam" pattern.
- **Producer/capability mismatch on the drafter.** Extraction (R1-4) and now the server
  write (R2-2) were piled onto the drafter for locality reasons, but the drafter is the
  most tool-constrained worker (no MCP grant). Every reassignment onto the drafter should
  check its frontmatter tools, not just its document access.
- **Failure/interruption paths are unspecified.** The happy-path state machine (gates
  fire once, resolve, re-spawn) is now internally consistent (R2-1/R2-3 resolved), but the
  document has no durable state for a gate in flight (R3-2) and no partial-tool-return rule
  (R3-3). D3's "no extra state" is the root: it optimises away exactly the state a crash
  needs.

## Guidance for Next Review

- Verify the design/next pass reconciles: (1) the drafter's server-write capability — does
  `sdd-drafter.md` gain a tool, or does the write move to a server-capable actor (R3-1);
  (2) gate-A interruption recovery — durable receipt + resume rule (R3-2); (3) the
  partial/timed-out AskUserQuestion outcome (R3-3); (4) record-mode write-failure (R3-4).
- Well-covered, do not re-mine: class-(a) no-list behaviour (R1-5, citations verified);
  scope coverage vs decomposition spec 7; the Req 4 AC 1 / Req 5 AC 6 fire-once
  reconciliation (R2-1 resolved); the mixed change+annotate outcome (R2-3 resolved); the
  Lint L-1..L-9 false positives (rejected three rounds running).
- Citations are clean through v3 — all delta and delta-adjacent citations re-verified this
  round (`sdd-drafter.md:26`, `document-orchestrator.md:49,51`, `formats.md:25-26`,
  `document-phase/SKILL.md:20`, `gate-rules.ts:101-135`). Re-check only if ranges move.
- The next fresh lens has not covered: concurrency (two runs on one spec via the
  `active-run` pointer), and the exact `phase.start`/`phase.end` pairing the `gate-a` early
  return disturbs (noted as a secondary in R3-2).
