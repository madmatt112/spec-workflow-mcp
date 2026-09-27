# Retrospective plan — graph-orientation

Status: APPROVED

Approved by Matthew on 2026-09-27 in the retrospective conversation (supervisor run
run-20260926-135506). Sources: `retrospective.md`, `retrospective-proposals.md`, and six
overwatch items from the step 4 measurement (2026-09-25), appended to
`retrospective-log.md` on 2026-09-26 and numbered P9-P14 here.

Close-out note: spec-workflow-mcp PR #68 (vendor-board-sources retro) changed review-gate
risk scoring (`gate-rules.ts` `scoreRisk`, task-diff), the implementation skill and the
document-phase briefs. Branch close-out from the current `main` and check P10 and P12
against that change first.

## Approved proposals

- **P1 (F1) — Label the usage graph column a floor, not a count.** Add one line where the
  column is documented (harness usage doc / `harness usage` help text): the column counts
  only activity-stream graph calls and is a lower bound when a separate-process reader runs.
  Target: server code, docs or templates.
  Decision: approved as proposed.

- **P3 (F3) — Strip a leading `cd <path>;` before the activity-hook summary truncation.**
  In `harness/hooks/sdd-activity.sh`, remove one leading `cd …;` segment from the Bash
  summary before the 160-character cap, so a chained `graphify query`/`explain` stays
  visible. The match must take only a leading `cd` segment. Re-sync `plugins/` copies and
  run `npm run check:plugin-assets`.
  Target: harness skills or agents (`harness/hooks/sdd-activity.sh`).
  Decision: option A, strip the leading `cd` (recommended). Rejected: B raise the cap, C
  drafter drops the `cd` prefix.

- **P5 (F5) — Diagnose instrumentation before paying for a live spawn.** Add one line to the
  live-verification guidance: when a scenario asserts on ledger or activity ordering, first
  confirm the instrumentation records the event, then run the live spawn.
  Target: harness skills or agents.
  Decision: approved as proposed. Prerequisite: P3.

- **P7 (F7) — Make the reviser re-verify claims it adds or changes.** Add a reviser
  self-check: before it writes the next version, re-verify against source every factual
  claim (line numbers, counts, scope statements) the revision added or changed, not only
  the flagged ones.
  Target: harness skills or agents (reviser agent / brief).
  Decision: approved as proposed.

- **P9 (overwatch R6) — Revert sdd-reviser to claude-opus-4-8.** The Sonnet reviser uses
  0.6-2.1M weighted tokens per spawn against 0.40-0.51M for Opus 4.8; on tradr
  account-deletion it took 22.6M of 40.6M document spend. Change the reviser's model back
  to `claude-opus-4-8` (agent frontmatter and any tier profile that pins it).
  Target: harness skills or agents (`harness/agents/sdd-reviser.md`, tier profiles).
  Decision: revert to Opus 4.8 (recommended). Rejected: keep Sonnet, investigate first.

- **P10 (overwatch R1) — Find why no tradr task scores low risk.** tradr account-deletion
  scored 23 high and 6 medium, zero low, so every tradr task still gets a verifier. Find the
  cause (tradr `agent-rules.md` sensitive-path list, or the 200-line threshold) and fix it
  or record why it is correct. Check against PR #68's `scoreRisk` change first.
  Target: server code, docs or templates (`gate-rules.ts` risk scoring) or tradr steering.
  Decision: approved.

- **P11 (overwatch R2) — Fix mechanical lint findings without a reviser spawn.** spec-lint
  adds 10-16 Sonnet lint-reviser spawns per spec at about 0.5M each (tradr
  account-export-import requirements r2 lint: 0 fixed, 16 rejected). Keep lint; apply
  mechanical findings in place without spawning a reviser.
  Target: harness skills or agents (document-phase lint step).
  Decision: fix without a spawn (recommended). Rejected: drop lint revisions, keep as is.

- **P12 (overwatch) — Word boundaries in the gate class-a keyword match.** `auth` matched
  `author` on graph-orientation tasks 1 and 10. Match keywords on word boundaries.
  Target: server code, docs or templates (`harness` gate `class-a`).
  Decision: approved.

- **P13 (overwatch) — Investigate the one-hour orchestrator cache prefix break.**
  gapRewrites 1 on two orchestrators (agent-cache-ttl close-out a9b0bf2d7c7160bcc after a
  696 s gap; tradr account-export-import document orchestrator af899d43011358e85). The
  prefix broke after a ~9k-token head, not by expiry. Find the cause; fix it or record it.
  Target: harness skills or agents.
  Decision: approved (investigate).

- **P14 (overwatch) — `harness brief` resolves a bare `reviews/x.md` against the spec
  dir.** Since #65 P5 a bare `reviews/x.md` lands in `.spec-workflow/reviews/`, not
  `specs/<SPEC>/reviews/`. One-line fix to resolve against the spec dir.
  Target: server code, docs or templates (`src/tools/harness.ts` brief action).
  Decision: approved.

## Graduation candidates

- **G1 — Instrumentation counts are floors, and known undercounts are named.** Add to
  `.spec-workflow/agent-rules.md` (Run ledger section):

  > Ledger and `harness usage` counts are floors, not exact totals. Any column that cannot
  > observe a whole class of events — a separate-process worker, a truncated summary, a
  > yield that fires before the last transcript line — is a lower bound. When you add or read
  > such a column, name its known blind spots next to it, and never treat a count as proof
  > that no further events occurred.

  Target: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
  Decision: approved.

## Decisions made

- P3: strip a leading `cd` segment before truncation.
- P9: reviser back to Opus 4.8.
- P11: keep lint, fix mechanical findings without a reviser spawn.

## Not taken (no change)

- P2 (F2): the verification-only review nag stays; cosmetic, costs nothing.
- P4 (F4): deferring live halves to a restarted session is the accepted design.
- P6 (F6): ruling D8 is already captured in the design.
- P8 (F8): parking verification halves is the codified pattern.

## Open verification to-dos (human)

- d-a38fea66: verify the provider-per-role supervisor/orchestrator halves in a restarted
  session.
- d-1880d115: question-gates live gate scenarios (1b), (3b), (2), (4).
