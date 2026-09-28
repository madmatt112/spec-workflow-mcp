# Retrospective plan — tdd-task-loop

Status: CLOSED

Approved 2026-09-28 by Matthew in the retrospective conversation (run-20260928-182316).
Source: retrospective.md (F1-F16) and retrospective-proposals.md (P1-P16).

Landing note (from overwatch): code-repository items branch from the current
`origin/main`, reconcile against PR #72 (tdd-task-loop) and PR #73 (jobscout
vendor-lane-relevance close-out: resume reconcile default, `spawn.report` ledger row,
implementation-skill and brief edits), and land as one PR. Overwatch merges it when green.
Spec-store-only items commit directly.

## Approved proposals

- **P1 (F1, also covers F7/P7) — Gate every task on the implementer commit.** Make the
  single-commit gate range (`base=<implementer sha>^..sha`) the default wherever CODE_ROOT
  and the spec store share one repo; capture the pre-implement base but never use it as the
  gate base.
  Target: harness skills (sdd-implementation-phase SKILL.md, Step 1 / Step 4).
  Decision: approved as proposed.
- **P3 (F3) — Test author removes its own uncommitted test files on a design-defect stop.**
  On `SEAM-DEFECT`, or `RED-IMPOSSIBLE` on every criterion, the test author deletes the
  test files it wrote and did not commit before it reports.
  Target: harness skills/agents (sdd-implementation-phase Step 1b, sdd-test-author).
  Decision: approved as proposed.
- **P4 (F4, also covers F12/P12) — Dependent count assertions are in a count-changing
  task's edit scope.** Extend the agent-rules "Documents" count rule to counts in code and
  test files; the tasks-phase decomposition names the grep that finds every dependent
  count/length assertion for each count-changing task.
  Target: `.spec-workflow/agent-rules.md` (Documents) + tasks template / document-phase skill.
  Decision: approved as proposed.
- **P5 (F5, also covers F10/P10) — Every gate, prepare and record call names the code root.**
  The implementation skill passes `projectPath: <CODE_ROOT>` and the implementer commit on
  every `review-task` `gate`, `prepare` and `record` call; confirm whether the harness
  exports `CODE_ROOT` to the MCP server process and record the answer.
  Target: harness skills (sdd-implementation-phase Step 4/5).
  Decision: approved as proposed.
- **P9 (F9, also covers F15/P15) — spec-lint skip regex accepts the sub-bullet form.**
  Change the skip regex at `src/core/lint-citations.ts:75` to
  `/^\s*(?:[-*]\s+)?_(?:Leverage|Prompt):/` and add a vitest case for the indented
  `  - _Prompt:` form. Resolve deferral d-53b7f443 after it lands.
  Target: product code (src/core/lint-citations.ts) + a vitest case.
  Decision: approved as proposed.

## Graduation candidates

- **G1 — Worktree gate/prepare/record calls name the code root.**
  Target: `.spec-workflow/agent-rules.md` (a new "Worktree gates" bullet under Git).
  Rule text: "In a worktree run, every `review-task` `gate`, `prepare` and `record` call
  passes `projectPath: <CODE_ROOT>` and the implementer commit; never rely on the process
  default root. A gate that reports the main checkout's tree is void — re-run it scoped to
  CODE_ROOT."
  Decision: approved.
- **G2 — Fix a known lint false-positive class at the check, do not re-defer it.**
  Target: `.spec-workflow/agent-rules.md` (a "Lint false positives" bullet).
  Rule text: "A lint warning class that has been triaged as a known false positive in two or
  more specs is fixed at the check (its skip-regex or exemption), not deferred again.
  Skip-regexes for `_Leverage:` / `_Prompt:` lines must match the template's indented
  sub-bullet form (`  - _Prompt:`)."
  Decision: approved.

## Decisions made

- P2 (F2): keep spawning a verifier on line count or sensitive path alone (option a). No
  change.
- P8 (F8): the supervisor stays in the worktree; the documented `/usr/bin/git` + cp
  workaround stands (option a). No change.

## Not carried forward

- P2, P8: decided "keep as is" above.
- P6, P11 (F6, F11): already fixed in the merged code (`redTests` is in
  `OPTIONAL_BRIEF_KEYS`); the live run used an un-rebuilt server.
- P7, P10, P12, P15: covered by P1, P5, P4 and P9 respectively.
- P13, P14, P16: working as designed; nothing to change.

## Close-out

One line per proposal, written by the close-out phase.

- P1: done — 6c73071
- P3: done — 24741a5
- P4: done — bacb7116 (agent-rules count rule, on main) + 24f101e (tasks template grep)
- P5: done — 81a41b9
- P9: done — 3451495 (deferral d-53b7f443 resolved)
- G1: done — cbe7116
- G2: done — 2fa1b62
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/74
