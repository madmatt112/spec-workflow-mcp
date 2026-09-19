# Retrospective — worktree-review-signals

Compiled 2026-09-18 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — A v2 lint fix introduced a citation error.** The v1 lint pass inserted a
  `typecheck.ts:478` citation, so a bare `:30` in Req 1 AC10 re-resolved to the wrong
  file; the round-1 reviewer caught it as R1-1. Evidence: retrospective-log.md
  2026-09-18T16:41:12Z; reviews/adversarial-analysis-requirements.md. Frequency: once.
  Cost: part of 1 reviewer spawn (131k tokens).

- **F2 — The brief assumed a non-repo `git diff HEAD` exits 128; it exits 1.** Task 3
  found 128 is the unborn-HEAD code; tests were written to the real observed cause.
  Evidence: retrospective-log.md 2026-09-18T22:27:43Z; src/core/task-diff.ts; commit
  7f95e82. Frequency: once. Cost: 0 extra spawns (implementer flagged it).

- **F3 — A pinned interface omitted a test-only constructor argument.** Design
  Component 1 pinned `constructor(specPath)` but its Testing Strategy needed
  `timeoutMs:50`; the implementer added an optional `lockOptions` second arg,
  backward-compatible. Evidence: retrospective-log.md 2026-09-18T22:13:10Z;
  src/core/task-state-store.ts; commit 820b198. Frequency: once. Cost: 0 extra spawns.

## Product bugs found

- **F4 — A prepare response did not decode with the library that encoded it.** The TOON
  encoder at `^0.8.0` produced text the installed decoder could not round-trip; the
  design round-1 probe also reproduced `dashboardUrl` undefined→null under 4.1.1.
  Closed by task 1 (bump to 4.x, strip undefined keys). Evidence: deferral d-a2233b94;
  retrospective-log.md 2026-09-18T19:17:17Z; commit b9bd32a. Frequency: standing bug
  until this spec. Cost: 1 deferral, closed.

- **F5 — The interactive status route spawned git with no timeout.** Design round 2
  found the unbounded `runGit` on the status route had no degraded path (R2-1); the fix
  added a 10 s timeout. Evidence: reviews/adversarial-analysis-design-r2.md;
  retrospective-log.md 2026-09-18T19:48:20Z. Frequency: once. Cost: part of 1 reviewer
  spawn.

- **F6 — A git-infra error was reported as a benign `rejected` diff.** Design R2-4:
  `isAncestorOfHead` reported an infra failure as `rejected`, which would emit a false
  `head-degraded` note. Left as a MINOR honesty edge. Evidence:
  reviews/adversarial-analysis-design-r2.md; deferral d-c99e352b. Frequency: once.
  Cost: 1 deferral (open).

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F7 — Interrupt-before-emit defeats the resume gate-A recheck.** The previous run was
  interrupted inside the document orchestrator after the v1 checkpoint and before the
  gate-A emit. The supervisor's recheck keys on a questions.md receipt written only after
  the orchestrator returns gate-a, and orient reported Step 2, so a normal re-dispatch
  would have skipped both the v1 lint pass and gate A. Evidence: retrospective-log.md
  2026-09-17T17:51:42Z; harness-events.jsonl run-20260917-170349. Frequency: once.
  Cost: 1 wasted orchestrator spawn plus drafter.

- **F8 — A mid-commit reboot lost the requirements-approved commit.** The machine
  rebooted 17:10Z mid-commit; 18 empty git objects and a dangling main pointer; the
  supervisor reconstructed the approved state from the surviving approval record and
  HANDOFF section. Evidence: harness-events.jsonl 2026-09-18T17:13:58Z note and
  phase.end. Frequency: once. Cost: manual reconstruction, no lost content.

- **F9 — A regenerated phase-log row hid an approved state in the TUI.** A phase-log
  regeneration appended an `interrupted` row for an earlier run's unclosed phase.start
  BELOW the approved row; the watch TUI takes the last row per stage, so it showed
  requirements as `v2 interrupted` while the approval said approved. Evidence:
  retrospective-log.md 2026-09-18T19:48:47Z; HANDOFF.md phase-log rows; approval
  approval_1789751201977_4rubgz93s. Frequency: once. Cost: one false alarm to the human.

- **F10 — The TUI mislabelled an orchestrator's model.** The design orchestrator ran on
  claude-opus-4-8 but the TUI labelled it fable-5-1 xhigh; the label comes from the
  ledger's run.start model, which is the supervisor's. Evidence: retrospective-log.md
  2026-09-18T19:48:47Z; agent-a1c4668cc0cc08640.jsonl model counts. Frequency: once.
  Cost: cosmetic; misleads the human on which model ran a phase.

- **F11 — citation-identifier fires a standing wall on every version naming new fields.**
  v3 lint reported 38 warnings, 0 error; 33 were the same identifier-is-new-behavior
  warnings the v1 pass already rejected with reasons; the rule re-fires each version. It
  needs a way to mark an identifier as new, or a carry-forward of rejected findings.
  Evidence: retrospective-log.md 2026-09-18T16:51:46Z; harness-events.jsonl v3-lint note.
  Frequency: 33 of 38 warnings re-fired; seen in question-gates, harness-bookkeeping,
  spec-lint. Cost: risks a wasted reviser spawn each version (~100k tokens if run).

- **F12 — worktree e2e needs a browser install the setup step omits.** The worktree
  Playwright suite needs `npx playwright install chromium`; `agent-rules.md`
  worktree-setup lists only `npm ci`, so the first run failed on a missing binary.
  Evidence: retrospective-log.md 2026-09-18T23:52:26Z; agent-rules.md worktree-setup;
  commit 854db4e. Frequency: once here; structural for worktree e2e. Cost: 1 extra manual
  install step.

- **F13 — A model repoint had no effect because agents load from the directory
  marketplace.** The opus-4-8 overlay was written into the 5.8.0 plugin cache, but the
  plugin agents load from `plugins/spec-workflow-harness`, so the cache edit did nothing;
  the run paused for an overlay at the effective path plus a session restart. Evidence:
  harness-events.jsonl notes (plugin-cache repoint; directory-marketplace finding).
  Frequency: once here; matches project memory tier-overlay-in-plugin-cache. Cost: 1 run
  pause plus a restart.

## Prompt misunderstandings

None found. Every task reported 0 fix rounds and 0 adjudications.

## Inefficiencies

- **F14 — An unactionable gate consumed one AskUserQuestion round.** Gate A asked the
  human five decisions phrased as implementation mechanics (recording sites, storage
  layout, pinned constants, diff transport); the human answered every one with "you
  choose". The gate produced no signal. Evidence: retrospective-log.md
  2026-09-17T17:55:53Z; questions.md gate-A answers. Frequency: 4 of 5 delegated. Cost: 1
  AskUserQuestion call, 4 answers, all delegated.

## Documentation gaps

- **F15 — See F2 and F3.** Two briefs stated facts the implementer had to correct at
  the tree: the non-repo git exit code and the pinned constructor signature. Evidence:
  retrospective-log.md task 2 and task 3 doc-gap entries. Frequency: 2 tasks. Cost: 0
  extra spawns; both self-corrected.

- **F16 — `TaskStateStore.read` warns once per file on a plain-missing record.** The
  design's Error Handling makes `read` warn once per file, which fires on the normal
  single-checkout `head-expected` path where no `task-state.json` exists; ENOENT should
  be suppressed. Evidence: retrospective-log.md 2026-09-18T23:17:07Z;
  src/core/task-state-store.ts; commit dcb18ba. Frequency: every single-checkout prepare.
  Cost: log noise on the normal path.

## Model behaviour

None found. claude-opus-4-8 high ran the orchestrators and analyst; the F10 mislabel is a
ledger/TUI defect, not model behaviour.

## Process deviations and rulings

- **F17 — Orchestrator skipped the v3 lint reviser spawn.** spec-lint on v3 reported 38
  citation-identifier warnings, 0 error; 33 were already-rejected re-fires and 5 were on
  the v3 delta, carried to the round-2 reviewer as LINT.open. A third reviser pass bought
  nothing. Evidence: retrospective-log.md 2026-09-18T16:51:46Z. Frequency: once. Cost: 0
  spawns (saved ~100k-token reviser spawn).

- **F18 — Supervisor ran gate A by hand.** With no questions.md receipt after the
  interrupt, the supervisor ran gate A from the fresh gate-a.json surface and logged the
  deviation (F7). Evidence: retrospective-log.md 2026-09-17T17:51:42Z; harness-events
  note. Frequency: once. Cost: none beyond F7.

- **F19 — Two design MINOR items deferred; two rulings closed as refinements.** R2-3
  (malformed→null underspecified) and R2-4 deferred as d-c99e352b; rulings D11
  (feature-disabled emits no degraded note) and D3 (diffBase.commit is the ref HEAD)
  closed as refinements. Evidence: retrospective-log.md 2026-09-18T20:10:25Z; HANDOFF
  design section. Frequency: once. Cost: 1 deferral (open).

## Decisions the harness made for the human

- **F20 — Gate A choices kept by the supervisor after full delegation.** The human
  delegated all five gate-A decisions; the supervisor kept every recorded choice. See
  F14. Evidence: harness-events.jsonl gate-A note; questions.md. Frequency: once. Cost:
  design decisions made without human input.

- **F21 — Gate B approved with no annotation.** The human approved the 12-task plan with
  7 class-a veto items presented and no annotation; slot b was deleted. Evidence:
  harness-events.jsonl gate-B note. Frequency: once. Cost: task plan accepted without
  engagement on the veto items.

## Repeat patterns

- **F11 ↔ question-gates F4, harness-bookkeeping, spec-lint.** citation-identifier
  false-positives recur on almost every version that names new identifiers; still
  unfixed. Evidence: this spec retrospective-log.md 2026-09-18T16:51:46Z;
  question-gates/retrospective.md F4 (line 58) and its repeat note (line 121).

- **F12 ↔ spec-lint retro (worktree-setup / `npm ci`).** A worktree e2e run needs a
  setup step agent-rules omits (there `npm ci`, here `npx playwright install chromium`).
  Evidence: this task 12 entry; spec-lint/retrospective.md line 16.

- **F14 / F20 ↔ question-gates gate-A findings.** A human gate asks decisions the human
  delegates back as mechanics, producing no signal. Evidence: this gate-A entries;
  question-gates/retrospective.md gate-A finding.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | requirements v3, design v3, tasks v1 |
| Review rounds | requirements 2, design 2 + narrow check, tasks 1 |
| Fix rounds (impl) | 0 |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | design 2 (D11, D3) + 1 orchestrator lint-skip |
| Deferrals added | 1 (d-c99e352b); 2 resolved (d-a2233b94, d-6e59490b) |
| Orchestrator spawns | 4 document/impl orchestrators + this retro |
| Worker spawns (impl) | 17 (12 implementer + 5 verifier), 12 gates |
| PR | #49 (open, checks green) |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs'
findings, each proposed for promotion into a steering document or agent-rules.md,
with the rule text as it would be written.
