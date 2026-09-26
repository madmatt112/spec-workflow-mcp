# Retrospective proposals — graph-orientation

Written 2026-09-26 by the retro analyst from `retrospective.md`. One proposal per finding,
in the format at the end of the findings file.

- **P1 (F1) — Label the usage graph column a floor, not a count.** The graph column cannot
  see separate-process (DeepSeek) readers, and requirements (R6) accepted this. No
  instrumentation change; add one line where the column is documented (harness usage doc /
  `harness usage` help text) stating the column counts only activity-stream graph calls and
  is a lower bound when a separate-process reader runs.
  Target: server code, docs or templates.
  Effort: S. Risk: low: doc-only, no behaviour change.
  Prerequisites: none.
  DECISION NEEDED: no. Working as designed; the only gap is that the floor semantics are
  implicit. See P9 for the cross-spec rule.

- **P2 (F2) — Leave the verification-only review nag as is.** `reviewCoverage` reads 8/10
  and `spec-status` nags because verifier is skipped on verification-only tasks (policy
  P15). The nag is expected and costs nothing. Smallest change is none: do not special-case
  the denominator for a cosmetic string.
  Target: server code, docs or templates.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no. If the nag ever misleads an operator into re-reviewing, the follow-up
  is to exclude verification-only tasks from the `reviewCoverage` denominator in
  `spec-status`; not worth it now.

- **P3 (F3) — Strip a leading `cd <path>;` before the activity-hook summary truncation.**
  The hook cuts Bash summaries at 160 chars (`sdd-activity.sh:150`); the drafter's mandatory
  `cd <absolute root>;` prefix pushes the real command (`graphify query/explain`) past the
  cut, so graph calls never appear in `harness-activity.jsonl` and the graph-before-read
  intent (D4/D8) undercounts. Strip one leading `cd …;` segment from `s` before applying the
  160-char cap, so the meaningful command survives.
  Target: harness skills or agents (`harness/hooks/sdd-activity.sh`).
  Effort: S. Risk: medium: `harness/hooks/` is a sensitive path (high-risk gate, verifier
  runs); the regex must match only a leading `cd` and not eat a command that contains `cd`.
  Prerequisites: re-sync `plugins/` copies, `npm run check:plugin-assets`, restart sessions.
  DECISION NEEDED: yes. How should the hook stop losing graph calls behind the `cd` prefix?
  - (A) *Strip a leading `cd …;` before truncating.* **[recommended]** Targeted, keeps the
    file small, fixes the exact cause.
  - (B) Raise the 160-char cap (e.g. to 400). Simplest, but bloats every long Bash row and
    only defers the problem to longer prefixes.
  - (C) Have the drafter emit graph commands on their own line without the `cd` prefix.
    Fights the cwd-resets-between-bash-calls constraint; larger blast radius.

- **P4 (F4) — No change: deferring live halves to a restarted session is the accepted
  design.** Scenarios (2)(3)(4) parked as `pending` in a tracked `verification-evidence.md`
  because they need the merged checkout built and the session restarted. This is exactly
  what design C7, `agent-rules.md` ("Fixtures and live verification") and CLAUDE.md
  (`deferrals list tag=verification`) prescribe. The split is inherent to a harness that
  verifies its own build.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — Diagnose instrumentation before paying for a live spawn.** The ~2.1M-token
  fixture requirements spawn meant to confirm graph-before-read instead exposed F3, so the
  spend proved a hook bug, not the intent. Fixing P3 lets the ordering be read straight from
  the activity stream, removing the need for that spawn. Add one line to the retro/live-
  verification skill: when a scenario asserts on ledger/activity ordering, first confirm the
  instrumentation records the event, then run the live spawn.
  Target: harness skills or agents.
  Effort: S. Risk: low: guidance only.
  Prerequisites: P3 (so the stream actually carries the graph rows).
  DECISION NEEDED: no.

- **P6 (F6) — No change: ruling D8 is captured in the design.** The reviewer ruled that a
  graph fact must come from a graph command, not a grep for the phrase. It closed inside the
  single design round with no extra spawn and is recorded in the design. Nothing recurring
  to codify beyond the spec.
  Target: harness skills or agents.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — Make the reviser re-verify claims it adds or changes.** Both round-2 MUST_FIX
  were fix-induced: the v2 revision introduced a false shrink-guard claim and a wrong R6 AC8
  line/false shared-scope claim that round 3 had to correct. Add a reviser self-check: before
  submitting, re-verify against source every factual claim (line numbers, counts, scope
  statements) the revision added or changed, not only the ones flagged.
  Target: harness skills or agents (reviser skill/agent).
  Effort: S. Risk: low: adds a check step, may lengthen a revise pass slightly.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — No change: parking verification halves is the codified pattern, not a silent
  harness decision.** The design-time split (C7) is the same pattern already written into
  CLAUDE.md and `agent-rules.md`, and it was tracked in `verification-evidence.md` with open
  verification-tagged deferrals (d-a38fea66, d-1880d115). The decision was made in the open,
  not for the human.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

## Graduation candidates

- **Instrumentation counts are floors, and known undercounts are named.** Seen in
  graph-orientation (F1 separate-process readers, F3 `cd`-prefix truncation) and
  agent-cache-ttl (F5 `spawn.end` first-yield undercount). The class recurs: ledger/usage
  instrumentation systematically undercounts an event type. Proposed rule for
  `agent-rules.md` (Run ledger section):

  > Ledger and `harness usage` counts are floors, not exact totals. Any column that cannot
  > observe a whole class of events — a separate-process worker, a truncated summary, a
  > yield that fires before the last transcript line — is a lower bound. When you add or read
  > such a column, name its known blind spots next to it, and never treat a count as proof
  > that no further events occurred.

  Target document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

- *Not a candidate (already codified):* "verification halves run in a rebuilt, restarted
  session" (F4/F8) is already a rule in `agent-rules.md` ("Fixtures and live verification")
  and CLAUDE.md (`deferrals list tag=verification`). No promotion needed.
