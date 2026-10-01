# Retrospective — harness-control-pane

Compiled 2026-10-01 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — An over-cap lint trim moved citations off quoted text and weakened accepted
  wire-contract ACs.** The v2 lint trim landed the scope-note citation on an unrelated
  note short of the quoted phrase, and dropped "distinct from initial/projects-update"
  plus AC 5.10's type enumeration from accepted ACs. Evidence:
  reviews/adversarial-analysis-requirements-r2.md; retro-log 2026-09-28T20:54:15Z.
  Frequency: once this spec; repeat pattern (see F17). Cost: 1 reviewer spawn (round 2).
- **F2 — chokidar 3.6.0 hangs watching a never-existed single file path on first
  creation; the fix watches the sdd directory.** Design D9's chokidar note held for
  re-creation but not first creation; task 8 watches the directory instead. Task 7's
  ProjectHarnessWatch watches file paths directly and may share this latent gap for files
  created after start(), mitigated in practice by the launch-update re-arm. Evidence:
  retro-log 2026-09-29T15:20:21Z (task 8 doc-gap); commit 5e41fa5. Frequency: once. Cost:
  implementer RETRO flag; no extra spawns.
- **F3 — The in-flight-race loser's error shape was left undecided at design and resolved
  one phase later.** The design narrow check flagged that the race loser named no
  LaunchError.step and its route-layer code (409 vs 500) was unstated; tasks v1 closed it
  with a new `admission` step mapping to 409 `run-live` with a null runId. Evidence:
  reviews/adversarial-analysis-design-r3.md; retro-log 2026-09-28T22:41:54Z; HANDOFF
  tasks carried items. Frequency: once. Cost: 1 checker spawn.

## Product bugs found

- **F4 — A supervisor-model override refuses the run silently and the page shows a clean
  exit.** A launch with supervisor model `sonnet` passed setup validation
  (run-setup.ts:207 accepts any Anthropic model), then the preflight printed "Run /model
  opus…" and exited 0: no run.start, no ledger, no HANDOFF header, harness-run.json left
  unconsumed, the page showed "exited, code 0", and `--watch` then failed with "No active
  spec". Nothing signals the run refused to start. Evidence: retro-log
  2026-10-01T20:10:08Z (check 2); sdd-sandbox launch log …0f4aeBWoAfgCpBpJ… . Frequency:
  once. Cost: 1 launch, ~1 min.
- **F5 — The "declared" model ignores run.start overrides, so an overridden live run reads
  as the wrong model.** With sdd-drafter overridden to sonnet, `--watch` showed it as
  "declared claude-opus-5-5 high" (the agent frontmatter) while it ran on
  claude-sonnet-5-5; the override itself worked (spawn.end model claude-sonnet-5-5). A
  concrete fix exists: the hook already holds the Agent call's tool_input at spawn.start
  (harness/hooks/sdd-activity.sh:211-216) but writes only agent and role — add
  tool_input.model and show it as declared. Evidence: retro-log 2026-10-01T20:14:42Z;
  sdd-sandbox run-20261001-201124 ledger. Frequency: once. Cost: 1 run.
- **F6 — The pre-run.start refusal window gives no run id or PID.** A second launch during
  the supervisor preflight (~40 s before the pointer line exists) is refused by the
  launch-record branch (launcher.ts:128-129) with runId null, so the page shows "a launch
  record is live" with no id or PID; once run.start lands the pointer branch refuses with
  the live id as designed. The page could name the PID in that window. Evidence: retro-log
  2026-10-01T20:12:33Z (check 3); POST /harness/launch at 20:12:27Z. Frequency: once. Cost:
  2 launch attempts.

## Tool and MCP errors or deficiencies

- **F7 — A pre-existing timing-sensitive concurrency test flaked on a loaded CI runner.**
  registry-lock.test.ts:190 (the stale-lock critical-section test) failed on CI; the diff
  was empty main…HEAD and the test is present on main, so it was unrelated to this spec.
  Resolved by rerunning the job. Evidence: retro-log 2026-09-29T17:57:52Z (task 20
  tool-error); run 36608321901. Frequency: once. Cost: rerun; 0 code changes.
- **F8 — The harness `brief` action demanded a redTests value for a task carrying no TDD
  marker (cross-repo).** Evidence: retro-log 2026-10-01T20:26:52Z (mcp-deficiency;
  overwatch spec-workflow-mcp-66). Frequency: once observed elsewhere, relevant to this
  harness. Cost: unknown.

## Harness defects

- **F9 — TDD routing marked a RED-IMPOSSIBLE task red-first and the design-defect loop
  forced a design revision for a defect that lived only in tasks (cross-repo, jobscout
  task 6).** Evidence: retro-log 2026-10-01T20:26:52Z. Frequency: once observed. Cost:
  unknown.
- **F10 — Edits under src/markdown/templates leave the store copy
  .spec-workflow/templates/*.md dirty after a session restart (cross-repo).** Evidence:
  retro-log 2026-10-01T20:26:52Z. Frequency: recurring. Cost: unknown.
- **F11 — Close-out PRs miss regenerated generated files (cross-repo; tradr PR #120 left
  _how-its-built.json stale).** Evidence: retro-log 2026-10-01T20:26:52Z. Frequency: once
  observed. Cost: unknown.

## Prompt misunderstandings

- **F12 — Task 15's prompt listed a one-argument sdd-providers.sh check that can never be
  red.** The TDD test list named a "hard-coded providers= line" check, but
  sdd-providers.sh already existed and was unchanged by task 15, so it could not fail at
  base; the author omitted it and the implementer added it as a green regression guard.
  Evidence: retro-log 2026-09-29T17:10:13Z (task 15 doc-gap); commit 44c2d6e. Frequency:
  once. Cost: author RETRO flag; folded into implementer brief.

## Inefficiencies

- **F13 — A node-version gap in the design probe caused a CI-only test flake.** The
  launcher test read the log synchronously before the detached child's async argv write
  landed; node 20 gives no such ordering guarantee, but the design probe ran node 24.
  Test-only fix (poll with waitFor); launcher.ts unchanged. Evidence: retro-log
  2026-09-29T17:54:57Z (task 5 bug); commit abf456c. Frequency: once. Cost: 2 spawns (fix
  implementer, verifier), ~4 min.
- **F14 — Every TDD new-module task scored structural-red → risk high → verifier.** All 12
  TDD tasks were new modules with no code at base, so each routed to a verifier (15
  verifier spawns across the phase). This is the gate working as designed, but the spend
  concentrates on high-line-count harness tasks. Evidence: retro-log 2026-09-29T17:46:00Z
  (phase cleanup); repeat of harness-bookkeeping F9. Frequency: 12 tasks this spec; repeat
  pattern (see F18). Cost: ~15 verifier spawns.

## Documentation gaps

None found beyond the task-8 and task-15 items captured as F2 and F12.

## Model behaviour

- **F15 — A document orchestrator returned its PHASE line as the whole enum template
  instead of one value (cross-repo, tradr broker-csv-presets).** Evidence: retro-log
  2026-10-01T20:26:52Z (overwatch spec-workflow-mcp-66). Frequency: once observed. Cost:
  unknown.

## Process deviations and rulings

None. 0 orchestrator rulings and 0 adjudications across all four phases. At design round
1 the reviewer closed 4 RE-DECIDED requirement-literal flags as refinement on its own
authority (no orchestrator ruling needed). Evidence: retro-log 2026-09-28T22:43:13Z;
HANDOFF design Rulings row.

## Decisions the harness made for the human

- **F16 — The concurrent terminal-launch race was declared out of scope (R3-6).** The
  single-live-run invariant is bounded to dashboard-initiated launches, per the
  decomposition's pointer-file lock. The design also recorded that a page Launch re-saves
  harness-run.json with gates=record, clobbering a terminal setup with gates=block, as
  intended. Evidence: HANDOFF requirements Cut scope / Carried items; retro-log
  2026-09-28T21:22:44Z. Frequency: once. Cost: none (scope decision).
- **F17 — The 7 live end-to-end steps were deferred to an operator session
  (d-69b95f88).** The implementation session could not run a real `claude -p` launch or a
  browser, so lines (1)-(7) of verification-evidence.md stayed pending while the in-loop
  suite ran green. An operator ran all 7 on 2026-10-01 and every line now reads "passed";
  the deferral's revisit criteria are met and it is ready to resolve. Evidence:
  verification-evidence.md lines 7-13; deferral d-69b95f88. Frequency: once. Cost: 1
  deferral; operator pre-merge session.

## Repeat patterns

- **F18 — Over-cap / lint-induced citation churn.** F1 here (the v2 trim moved citations
  and weakened ACs) repeats harness-bookkeeping F11 (citation false positives, 3 lint
  passes per design version), harness-usage-and-tiers F4 (3 rounds of Revision-History
  citation rewrites), question-gates F4, and provider-per-role (fix-induced citation-path
  slips). Seen in 4+ specs. Evidence: this spec F1; harness-bookkeeping/retrospective.md
  F11; harness-usage-and-tiers/retrospective.md F4; question-gates/retrospective.md F4.
- **F19 — Verifier spend on high-line-count / new-module harness tasks.** F14 here repeats
  harness-bookkeeping F9/F10 (a verifier ran for 5 of 8 tasks on the line-count rule).
  Evidence: this spec F14; harness-bookkeeping/retrospective.md F9.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | requirements v4, design v3, tasks v2 |
| Review rounds | requirements 3+narrow, design 2+narrow, tasks 2 |
| Fix rounds (implementation) | 0 task fix rounds; 2 CI-red rounds (1 test-only fix, 1 rerun) |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 0 (4 RE-DECIDED flags closed by reviewer at design r1) |
| Deferrals added | 1 (d-69b95f88, live e2e — now satisfied) |
| Orchestrator spawns | reqs 3 rev+1 chk+3 rvs+1 drft; design 2 rev+2 rvs+1 drft+1 chk; tasks 2 rev+1 rvs+1 drft; impl 12 author+20 implementer+15 verifier+2 CI-fix |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/76 (#76, merged) |

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
