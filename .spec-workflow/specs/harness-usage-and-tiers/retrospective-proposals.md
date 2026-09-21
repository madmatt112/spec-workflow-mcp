# Retrospective proposals — harness-usage-and-tiers

One proposal per finding, in the format at the end of `retrospective.md`.

## Approved proposals

- **P1 (F1) — Leave the design span slip alone; no change.** design.md cited the
  `agent.stop` join as lines 305-311 while the real join is `src/watch/ledger.ts:293-314`;
  the load-bearing guarded-fill line (308) sits inside the cited span, so the
  citation-identifier check passed and the implementer read the code anyway. Zero rework.
  Tightening the citation lint to verify a range's *outer* bounds (not just that cited
  identifiers appear somewhere in range) would cost more false positives than this one
  cosmetic slip is worth.
  Target: none.
  Effort: S. Risk: low: the slip caused no rework and recurs rarely.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — Report every missing brief placeholder in one message.** `brief`'s
  required-value loop in `src/tools/harness.ts:608-615` returns on the *first* missing
  key, so a verifier brief that omits both `title` and `job` needs two failed calls to
  learn both. Accumulate all missing required keys and name them together, and append the
  template's full required-placeholder list to the message. One re-call instead of N.
  Target: server code (`src/tools/harness.ts`, plus its test).
  Effort: S. Risk: low: message-only change, existing tests pin the failure path.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — Stop the gate flagging regenerated `plugins/` mirror copies as
  out-of-list.** Task 8's gate failed `file-outside-list` x18 because the `files` list
  named the `harness/` sources but not the three `plugins/` copies the sync step
  regenerates. The line-count rule already exempts `## Generated paths`
  (`src/core/gate-rules.ts:242-246`); rule (d) at `gate-rules.ts:382-390` does not consult
  them. This is the F3↔ pattern seen in four specs.
  Target: server code (`src/core/gate-rules.ts`) or harness (tasks-drafter rule).
  Effort: S. Risk: medium: option A loosens what the gate accepts unlisted.
  Prerequisites: none.
  DECISION NEEDED: yes. How should the gate treat regenerated `plugins/` mirror copies?
  - **A (recommended)** — In rule (d), skip any touched path that matches `## Generated
    paths`, exactly as the line rule does. Removes the cause once; the mirrors are already
    machine-verified against `harness/` by `check:plugin-assets`.
  - B — Add an agent-rule making the tasks drafter enumerate every `plugins/` copy in a
    `harness/` task's `files` list. Keeps the gate strict but repeats manual work per spec.

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
  DECISION NEEDED: yes. How do we stop the Revision-History citation churn?
  - **A (recommended)** — Skip citation scanning inside a `## Revision History` (and
    decision-log) section in the linter. Removes the cause regardless of who authors the
    bullet.
  - B — Add the reviser's "prose only, no backticked path or identifier" rule to the
    drafter brief and the requirements/design templates. Cheaper, but relies on every
    author remembering it, which the five-spec history shows they do not.
  - C — Both A and B.

- **P5 (F5) — Adjudicate a requirement that circles a fixture instead of iterating to the
  cap.** Requirements ran five rounds, all substantive findings circling Req 5's
  token-counting rule against the question-gates fixture totals, then hit the v4 cap and
  needed a post-cap adjudication (4 reviewer + 6 reviser + 1 adjudicator + 1 checker
  spawns). When rounds re-litigate one requirement against a concrete fixture, an
  adjudication resolves it faster than more review rounds.
  Target: harness skills (`sdd-document-phase` orchestrator).
  Effort: S. Risk: low: adds a trigger, does not remove the cap.
  Prerequisites: none.
  DECISION NEEDED: yes. Should the document orchestrator adjudicate early when rounds
  circle one item?
  - **A (recommended)** — Add a trigger: when two consecutive rounds' substantive findings
    all concern the same requirement/rule, send that item to an adjudicator rather than
    spawning another review round.
  - B — No change; the cap plus post-cap adjudication is the designed safety valve and it
    reached a VERIFIED result (2/2, nothing ruled out).

- **P6 (F6) — No change now; consider a design-verifier cross-check later.** Design rule
  (c) names a model field absent from the Usage* Data Models and from `formatUsageTable`
  (`src/watch/usage.ts:163`). It caused no rework and the spec is closed, so trimming the
  phantom clause in this document is not worth a revision round. If phantom-field clauses
  recur, have the design verifier cross-check each backticked model field named in a rule
  against the Data Models section — but hold that until a second instance appears.
  Target: none now (later: harness `sdd-verifier` design checklist).
  Effort: S. Risk: low: info-only finding.
  Prerequisites: a second occurrence before acting.
  DECISION NEEDED: no.

- **P7 (F7) — No change; the refinement-vs-reopen ruling worked.** Two design re-decided
  flags (Req 4.7 two-line agent entry; Req 5.4 / D6 "states unknown" widening) were
  re-flagged in design review, the reviewer closed both as refinement, and the tasks
  drafter honoured the closure. Zero extra rounds. This is exactly the ruling mechanism
  behaving as designed.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — No change; the carry ledger did its job.** A mid-phase skill fix (f616c72)
  moved the per-spawn token count from an Agent result footer to the task notification's
  `<usage><subagent_tokens>`; requirements.md still described the old footer. Overwatch
  ruled it a HANDOFF Carried item rather than spend a revision-plus-review round on a stale
  descriptive line. That is the correct cost trade, and the Carried-items ledger is the
  right home for it.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

## Graduation candidates

- **Generated mirror copies under a gate `files` list (F3, four specs:
  harness-bookkeeping F10, review-gate F2, spec-lint F2, this spec).** The durable fix is
  P3-A in code; if that is not taken, promote this rule instead.
  Rule text: "A gate does not count or reject a touched path that matches `## Generated
  paths`. When a `harness/` task regenerates its `plugins/` mirror copies, those copies
  need no entry in the task's `files` list."
  Target document: `.spec-workflow/agent-rules.md`, under `## Generated paths`.

- **Revision History bullets carry no citations (F4, five specs: harness-bookkeeping F11,
  question-gates F4/F6, spec-lint F17, worktree-review-signals F1/F11, this spec).** The
  reviser brief already states this (`briefs.md:239-241`); the churn persists because the
  drafter and the templates do not, and the linter still scans those sections. Pair with
  P4.
  Rule text: "In `## Revision History` and decision-log bullets, cite findings by id and
  prose only. Never write a backticked path, line range or code identifier there; the
  citation lint does not scan these sections."
  Target document: drafter brief (`harness/skills/sdd-document-phase/references/briefs.md`)
  and the requirements/design templates (`src/markdown/templates/`).
