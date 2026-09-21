# Retrospective plan — harness-usage-and-tiers

Status: CLOSED
Approved: 2026-09-21 by Matthew in the retro conversation (run run-20260919-143236).
Source: `retrospective.md` and `retrospective-proposals.md` in this directory.

## Decisions made

- **P3 — A.** In gate rule (d), skip any touched path that matches `## Generated paths`,
  exactly as the line rule does. The mirrors are machine-verified against `harness/` by
  `check:plugin-assets`.
- **P4 — A.** Skip citation scanning inside a `## Revision History` (and decision-log)
  section in the linter. Graduation candidate 2 (the prose-only rule in the drafter brief
  and the requirements/design templates) is approved alongside it, so the pair amounts to
  option C.
- **P5 — A.** Add a trigger to the document orchestrator: when two consecutive rounds'
  substantive findings all concern the same requirement or rule, send that item to an
  adjudicator rather than spawning another review round. The v4 cap stays.

## Approved proposals

- **P2 (F2) — Report every missing brief placeholder in one message.** `brief`'s
  required-value loop in `src/tools/harness.ts:608-615` returns on the *first* missing
  key, so a verifier brief that omits both `title` and `job` needs two failed calls to
  learn both. Accumulate all missing required keys and name them together, and append the
  template's full required-placeholder list to the message. One re-call instead of N.
  Target: server code (`src/tools/harness.ts`, plus its test).
  Effort: S. Risk: low: message-only change, existing tests pin the failure path.
  Prerequisites: none.
  Decision: approved as written.

- **P3 (F3) — Stop the gate flagging regenerated `plugins/` mirror copies as
  out-of-list.** Task 8's gate failed `file-outside-list` x18 because the `files` list
  named the `harness/` sources but not the three `plugins/` copies the sync step
  regenerates. The line-count rule already exempts `## Generated paths`
  (`src/core/gate-rules.ts:242-246`); rule (d) at `gate-rules.ts:382-390` does not consult
  them. This is the F3↔ pattern seen in four specs.
  Target: server code (`src/core/gate-rules.ts`) or harness (tasks-drafter rule).
  Effort: S. Risk: medium: option A loosens what the gate accepts unlisted.
  Prerequisites: none.
  Decision: option A — in rule (d), skip any touched path that matches `## Generated
  paths`, as the line rule does. Server code only; no agent rule.

- **P4 (F4) — Exempt Revision History / decision-log bullets from the citation lint.**
  Three req rounds (v2-v4) rewrote Revision-History lint bullets to satisfy the
  citation-identifier rule, then v4 collapsed them to token-free prose. These bullets are
  meta-commentary, not real citations, yet `checkCitations` scans them and flags every
  backticked path or identifier. The reviser brief already forbids tokens there
  (`briefs.md:239-241`), but the linter still fires. This is the F4↔ pattern seen in five
  specs — the costliest recurring churn.
  Target: server code (`src/core/lint-citations.ts` / `src/tools/spec-lint.ts`) or harness
  briefs + templates.
  Effort: A=M, B=S. Risk: medium: option A must scope the skip precisely to those sections.
  Prerequisites: none.
  Decision: option A — skip citation scanning inside `## Revision History` and decision-log
  sections in the linter. Plus graduation candidate 2 below (brief and template rule text).

- **P5 (F5) — Adjudicate a requirement that circles a fixture instead of iterating to the
  cap.** Requirements ran five rounds, all substantive findings circling Req 5's
  token-counting rule against the question-gates fixture totals, then hit the v4 cap and
  needed a post-cap adjudication (4 reviewer + 6 reviser + 1 adjudicator + 1 checker
  spawns). When rounds re-litigate one requirement against a concrete fixture, an
  adjudication resolves it faster than more review rounds.
  Target: harness skills (`sdd-document-phase` orchestrator).
  Effort: S. Risk: low: adds a trigger, does not remove the cap.
  Prerequisites: none.
  Decision: option A — add the trigger: when two consecutive rounds' substantive findings
  all concern the same requirement/rule, send that item to an adjudicator rather than
  spawning another review round.

- **Graduation candidate 2 (F4, five specs) — Revision History bullets carry no
  citations.** Approved with P4.
  Rule text: "In `## Revision History` and decision-log bullets, cite findings by id and
  prose only. Never write a backticked path, line range or code identifier there; the
  citation lint does not scan these sections."
  Target: drafter brief (`harness/skills/sdd-document-phase/references/briefs.md`) and the
  requirements/design templates (`src/markdown/templates/`).
  Decision: approved; land with P4.

## Accepted with no work

- **P1 (F1) — Leave the design span slip alone; no change.** Target: none. Accepted.
- **P6 (F6) — No change now; consider a design-verifier cross-check later.** Target: none
  now (later: harness `sdd-verifier` design checklist, after a second occurrence). Accepted.
- **P7 (F7) — No change; the refinement-vs-reopen ruling worked.** Target: none. Accepted.
- **P8 (F8) — No change; the carry ledger did its job.** Target: none. Accepted.

## Rejected

- **Graduation candidate 1 (F3, four specs) — generated mirror copies rule in
  `agent-rules.md`.** Not needed: P3 option A fixes the gate in code, which the proposal
  itself names as the durable fix.
- **P3 option B, P4 options B and C as standalone, P5 option B.** Not taken; see Decisions.

## Open verification record

- d-3091be1c (verification): after `npm run build` and a session restart, run one SDD
  phase through the supervisor and confirm the orchestrator's `spawn.end` row in that
  spec's `harness-events.jsonl` carries numeric input, output, cacheWrite, cacheRead,
  tokens and a model string, with tokens equal to the sum of `message.usage` over the
  orchestrator transcript's assistant entries. Human action item; not a close-out item.

## Close-out

One line per proposal, written by the close-out phase.

- P2: done — 94396b2
- P3: done — f4bd289
- P4: done — 4e7f716
- P5: done — 098f409
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/56
