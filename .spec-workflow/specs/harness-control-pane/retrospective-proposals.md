# Retrospective proposals — harness-control-pane

One proposal per finding (F1–F17). F18–F19 are repeat patterns, promoted under
Graduation candidates.

- **P1 (F1) — Protect accepted-AC citations through a cap/lint trim.** Make the
  reviser's over-cap trim re-verify, after it removes any line, that every surviving
  accepted AC still carries its original citation anchored to the quoted phrase, and
  never relocate a citation onto an unrelated note. Add this as a post-trim check in
  the requirements reviser skill.
  Target: harness skills or agents.
  Effort: S. Risk: low: adds a check, no behaviour change to accepted text.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — Watch the containing directory for not-yet-created files.** Change
  ProjectHarnessWatch (task 7) to watch the sdd directory and filter by filename, the
  pattern task 8 already uses, so a file created after start() is seen without relying
  on the launch-update re-arm.
  Target: product code.
  Effort: S. Risk: low: mirrors a shipped, tested fix; mitigated gap today.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — Decide every enumerated error branch's shape at design.** Add to the
  design narrow-check a rule that each named error branch states its LaunchError.step
  and its route status code before the phase closes, so a race-loser shape is not
  carried to tasks.
  Target: harness skills or agents.
  Effort: S. Risk: low: tightens an existing narrow check.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — Signal a supervisor-model refusal instead of a clean exit.** A preflight
  that refuses the run (prints "Run /model opus…") must emit a run.start-refused signal
  and exit non-zero, leaving harness-run.json consumed or clearly marked, so the page
  reads "refused" rather than "exited, code 0" and `--watch` does not report "No active
  spec".
  Target: product code.
  Effort: M. Risk: medium: touches preflight exit path and page state mapping.
  Prerequisites: none.
  DECISION NEEDED: yes. Where should the supervisor-model mismatch be caught?
  - (A) Reject it in run-setup validation (run-setup.ts:207) so the launch never starts.
  - (B) Keep the preflight refusal but make it emit a refusal event and exit non-zero. ← recommended
  - (C) Both: validate early and harden the preflight signal.
  (B) is the smallest change that removes the silent-exit cause; (C) if early rejection
  is also wanted.

- **P5 (F5) — Record the Agent call's model as "declared".** In sdd-activity.sh add
  `model: tool_input.model` to the spawn.start row (the hook already holds tool_input at
  lines 211-216) and have `--watch` show that value as "declared", so an overridden run
  no longer reads the agent frontmatter model.
  Target: harness skills or agents (hook) plus product code (watch display).
  Effort: S. Risk: low: additive field; hooks are a sensitive path, needs a verifier.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — Name the PID in the pre-run.start refusal window.** When the launch-record
  branch (launcher.ts:128-129) refuses with runId null, have the page show the live
  launch PID so the ~40 s window before the pointer line has an identifier.
  Target: product code.
  Effort: S. Risk: low: display-only addition.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — Deflake the stale-lock critical-section test.** registry-lock.test.ts:190
  is timing-sensitive and flaked on a loaded runner; it is unrelated to this spec and
  was fixed by a rerun. Replace its fixed timing with a waitFor/poll so a loaded runner
  does not fail it. No harness or spec change.
  Target: product code (test only).
  Effort: S. Risk: low: test-only.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — Do not demand redTests for a task with no TDD marker.** The harness
  `brief` action should require a redTests value only when the task carries a TDD
  marker; a non-TDD task briefs without it.
  Target: server code.
  Effort: S. Risk: low: relaxes a required field on a clear condition.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — Keep the design-defect loop from firing on a tasks-only defect.** Before
  the loop forces a design revision, require it to confirm the defect lives in the
  design document; a RED-IMPOSSIBLE marking that originates in tasks is routed back to
  tasks, not design. Cross-repo, observed once (jobscout task 6).
  Target: harness skills or agents.
  Effort: M. Risk: medium: changes a routing branch; needs cross-repo validation.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P10 (F10) — Sync the store template copy on restart.** Edits under
  src/markdown/templates leave .spec-workflow/templates/*.md dirty after a restart.
  Regenerate the store copies as part of the build or restart step (or add them to the
  sync the build already runs) so the tree is clean. Recurring, cross-repo.
  Target: server code.
  Effort: S. Risk: low: mechanical copy step.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P11 (F11) — Regenerate generated files in close-out.** The implementation/close-out
  skill must regenerate and stage derived files (e.g. _how-its-built.json) before the PR
  so a close-out does not ship a stale generated artifact. Cross-repo (tradr PR #120).
  Target: harness skills or agents.
  Effort: S. Risk: low: adds a regenerate-and-check step.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P12 (F12) — Keep never-red checks out of the TDD test list.** Instruct the TDD test
  author to list only checks that can fail at base; a green regression guard for an
  unchanged file belongs in the implementer brief, not the red test list.
  Target: harness skills or agents.
  Effort: S. Risk: low: clarifies author instructions.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P13 (F13) — Run design probes on the CI node version.** agent-rules already says CI
  runs node 20 and local is 24; extend it so a design probe that informs a timing or
  stream-ordering decision runs under node 20, not just that tests assert node-20 fields.
  Target: project steering (agent-rules.md) and harness design skill.
  Effort: S. Risk: low: reinforces an existing rule.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P14 (F14) — Verifier spend on all-new-module TDD phases.** Twelve new-module TDD
  tasks each routed structural-red → high risk → verifier (15 spawns). The gate works as
  designed; the question is whether an all-new-module phase should spend a verifier on
  every task.
  Target: harness skills or agents.
  Effort: M. Risk: medium: changes risk routing; a wrong exemption skips real review.
  Prerequisites: none.
  DECISION NEEDED: yes. Should a clean-red new-module TDD task still always draw a
  verifier?
  - (A) Keep as-is — every structural-red task gets a verifier. ← recommended
  - (B) Exempt a new-module task whose red proof is clean and whose line count is below
    the sensitive threshold.
  - (C) Sample: verify a fixed fraction of such tasks per phase.
  (A) keeps the safety guarantee; the spend is real but each task is high-line-count
  harness code. Choose (B)/(C) only if the verifier spend is the binding cost.

- **P15 (F15) — Reject the enum template as a PHASE value.** Harden the orchestrator's
  PHASE parser to reject the whole enum template string and re-prompt for one value, so
  a document orchestrator cannot return the template itself. Cross-repo (tradr
  broker-csv-presets).
  Target: harness skills or agents.
  Effort: S. Risk: low: input validation on a parsed line.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P16 (F16) — No change: scope decision stands.** The concurrent terminal-launch race
  (R3-6) and the page-Launch re-save of harness-run.json were intended scope decisions
  recorded in the HANDOFF. No change; revisit only if a terminal gates=block setup being
  clobbered by a page launch becomes a reported problem.
  Target: project decomposition conventions.
  Effort: S. Risk: low: documents a standing decision.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P17 (F17) — Resolve the satisfied live-e2e deferral.** d-69b95f88 deferred the 7 live
  end-to-end steps to an operator session; an operator ran all 7 green on 2026-10-01 and
  verification-evidence.md reads "passed". The revisit criteria are met. The operator
  should resolve the deferral. No harness change; the gate worked as intended.
  Target: project steering (deferral record).
  Effort: S. Risk: low: housekeeping.
  Prerequisites: none.
  DECISION NEEDED: no.

## Graduation candidates

- **Citation integrity through cap/lint trims (F18 — F1 here; harness-bookkeeping F11,
  harness-usage-and-tiers F4, question-gates F4, provider-per-role). Seen in 4+ specs.**
  Target document: `.spec-workflow/agent-rules.md`, Lint false positives section (or a
  new "Citations" section).
  Rule text: "A cap or lint trim never moves a citation off the phrase it supports and
  never drops a citation from an accepted AC. After any trim that removes lines, re-verify
  that every surviving accepted AC still carries its original citation anchored to its
  quoted text."

- **Verifier spend on new-module / high-line-count tasks (F19 — F14 here;
  harness-bookkeeping F9/F10). Seen in 2+ specs.**
  Target document: `.spec-workflow/agent-rules.md`, review-gate conventions.
  Rule text: "A brand-new module with no code at base routes structural-red → high risk
  → verifier by default. When a whole phase is new-module TDD tasks, the tasks-phase
  decomposition states the expected verifier count up front so the spend is a planned
  figure, not a surprise."
