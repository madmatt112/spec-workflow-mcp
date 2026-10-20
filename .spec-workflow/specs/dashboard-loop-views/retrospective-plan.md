# Retrospective plan — dashboard-loop-views

Status: APPROVED
Date: 2026-10-20

## Approved proposals

- **P1 (F1) — A non-canonical test-seam label stalled the implementation phase.**
  The cause is the parser/validator gap (F5) and the drafter label (F7); it is removed at
  the source by P5/P7. No separate change for F1 itself — once a non-canonical `- Test (…):`
  label is flagged at the tasks approval gate, it can never reach the implementation phase and
  stall a gate's allowed-file list.
  Target: none (resolved by P5/P7).
  Effort: S. Risk: low: no code change here.
  Prerequisites: P5, P7.
  DECISION NEEDED: no.

- **P2 (F2) — Full `npm test` runs for the first time at task 14.** The full suite only runs
  at the end-to-end gate, so pre-existing fails and e2e flake surface at the last task as one
  escalation instead of early. Whether to buy an earlier signal is a token-vs-latency tradeoff.
  Target: harness skills (implementation orchestrator / decomposition convention).
  Effort: M. Risk: medium: an early full run costs tokens on every spec, most of which pass.
  Prerequisites: none.
  DECISION NEEDED: yes. When should the full `npm test` first run in a spec?
  - Option A: keep it at the end-to-end gate only; accept a late surprise. (recommended)
  - Option B: add one mid-phase full-suite checkpoint after the first source task lands.
  - Option C: run the full suite once at phase start as a baseline, then only at the end gate.
  Recommendation: A — the surprise is cheap to absorb as one escalation, and B/C pay the full
  suite's cost on every spec to catch a once-per-spec event; P3 handles the real pain (pre-existing fails).

- **P3 (F3) — Five pre-existing vitest failures block the full-suite gate.** The end-to-end
  gate cannot tell an environment-coupled legacy failure from a regression, so the operator
  hand-rules each time (F2/F3 repeat across three specs). The smallest durable fix: run the
  full suite once at base (the merge-base commit) and diff — only tests that pass at base and
  fail at HEAD are regressions; the rest are reported, not blocked.
  Target: harness skills (end-to-end verification gate) or server (verification runner).
  Effort: M. Risk: medium: a base run doubles full-suite time at the gate; a flaky base masks a real regression.
  Prerequisites: none.
  DECISION NEEDED: yes. How should the gate handle known-failing, environment-coupled tests?
  - Option A: base-diff the full suite at the gate; block only on newly-failing tests. (recommended)
  - Option B: maintain a checked-in allowlist of known env-coupled failures the gate skips.
  - Option C: keep the operator ruling each time (status quo).
  Recommendation: A — it needs no manual list upkeep and matches the "regression guard, not forced red" principle already in agent-rules.

- **P4 (F4) — `log-implementation` crashed reading `.linesAdded` off undefined.** The smallest
  change that removes the crash is a defensive read at `src/tools/log-implementation.ts:383`:
  destructure with defaults (`const { linesAdded = 0, linesRemoved = 0 } = statistics || {}`)
  so a missing or partial `statistics` payload records zeroes instead of throwing. The deeper
  worktree-root resolution issue is the recurring family — see Graduation candidates.
  Target: product code (`src/tools/log-implementation.ts`).
  Effort: S. Risk: low: pure null-guard; add a test next to the module for an undefined-stats payload.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — The tasks parser silently drops any test bullet not exactly `- Test:`.** Already
  remediated this spec: `afff014` added `SEAM_LABEL_RE` to `task-validator.ts`, wired through
  `lint-tasks.ts` and the pre-approval check (`b763146`, #151), so `- Test (integration):`,
  `Tests:` and `File (new):` are now flagged as `tasks-format` errors before approval rather
  than dropped silently at the gate. No further change: the parser stays strict (one canonical
  form) and the near-miss is now loud at authoring time.
  Target: none (fixed this spec).
  Effort: S. Risk: low: fix already landed and tested.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — The full e2e suite flaked under a controller CPU hotspot.** Fixed and deployed
  in PR #151; tests pass focused and on CI. One residual worth a small follow-up: `--retries=2`
  amplified the starvation rather than hiding it, so dropping e2e retries in the worktree run
  config would make a real flake fail fast instead of masking three attempts.
  Target: product code (Playwright config) / harness e2e run convention.
  Effort: S. Risk: low: fewer retries can surface genuine flake, which is the intent.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — The tasks drafter invented a label outside the template vocabulary.** The
  validator (P5) now rejects it at approval, so a bad draft can no longer reach implementation.
  Smallest residual change: add one line to the `sdd-drafter` tasks guidance stating the only
  test-seam label is `- Test: <path> — <call>` (no parenthetical qualifier), so the draft is
  right the first time and does not burn an approval round.
  Target: harness agents (`harness/agents/sdd-drafter.md`).
  Effort: S. Risk: low: a one-line reminder, no behaviour change.
  Prerequisites: P5.
  DECISION NEEDED: no.

- **P8 (F8) — Task 4 ran two repair re-entries against an unfixable gate before the fix.** With
  P5 landed, this exact trigger (a parser-invisible test label) can no longer reach the gate.
  The general inefficiency — re-entering repair mode against an unchanged gate verdict no
  implementer edit can move — remains. Smallest change: the implementation orchestrator treats
  a second identical `file-outside-list` verdict on an unchanged task as a design defect and
  escalates to the operator instead of spawning a third implementer.
  Target: harness skills (implementation orchestrator repair loop).
  Effort: S. Risk: low: escalates one loop sooner; worst case a slightly earlier operator wait.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — ~32-minute idle gap inside task 11.** One occurrence, no spawn between the test
  author's end and the implementer's start, no token cost. No evidence of a systemic cause; a
  single scheduling gap does not justify a change.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P10 (F10) — A red-impossible branch needed a hand-named, non-counted guard.** Handled
  in-phase and correctly: a branch that holds at base is a regression guard, not forced into a
  red test (agent-rules already says this). The one-time cost was a brief naming the guard. No
  change needed; the recurring convention is captured as a graduation candidate below.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P11 (F11) — The operator edited tasks.md mid-implementation to clear the parser defect.**
  This was the correct intervention for an unfixable-by-implementer defect, and P5 now catches
  the defect before approval so the mid-phase edit should not recur. No change needed.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: P5.
  DECISION NEEDED: no.

- **P12 (F12) — Task 14 closed on an operator ruling, verifier-skipped.** An operator ruling to
  close on a gate-only review and defer the full-suite proof to CI is within the operator's
  prerogative and already recorded in the HANDOFF. No change; the pattern of pushing the full
  suite to PR CI is addressed structurally by P3.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

## Decisions

- P2: When should the full `npm test` first run in a spec? → keep it at the end-to-end gate only; accept a late surprise. (recommended)
- P3: How should the gate handle known-failing, environment-coupled tests? → base-diff the full suite at the gate; block only on newly-failing tests. (recommended)

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P1: skipped — no change chosen
- P5: skipped — no change chosen
- P9: skipped — no change chosen
- P10: skipped — no change chosen
- P11: skipped — no change chosen
- P12: skipped — no change chosen
- P2: skipped — Option A chosen (keep full npm test at end-to-end gate only); no change needed
- P3: done — aecce51bf2d1e1642a122748349cb32220d67f0b
- P6: done — 1b178c6e373bd5c9e116f6871adce9c45d096bbd
- P7: done — 120bdc8be574d20b377a7a6654b79709de808b77
- P8: to-do (human) — Repair loop is now controller code (src/controller/phases/implementation.ts fix-rounds); needs tsc+vitest, outside this checks:none prose batch. Route as its own controller code task.
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/155
- P4: to-do (human) — Already complete and green at f29a4e3 (defensive destructure at src/tools/log-implementation.ts:385 plus the undefined-stats test). amend-nothing leaves no code change to make this round, so no new commit. Sole blocker is the gate's file-outside-list flag on the test file, which this round's header now scopes in — resolution is the supervisor accepting f29a4e3, not an implementer change. r2 is a verbatim re-send of r1. Detail: /tmp/scratchpad/sdd/dashboard-loop-views/closeout-fix-code-3-r2-note.md
