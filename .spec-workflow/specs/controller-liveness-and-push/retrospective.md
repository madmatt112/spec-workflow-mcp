# Retrospective — controller-liveness-and-push

Compiled 2026-11-04 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

This was a fast, clean run: 15 tasks, 0 fix rounds during implementation, 0
adjudications, 0 rulings, 0 deferrals added, one post-gate CI fix round. Most
findings are recurring harness/test-fixture patterns, not new defects.

## Gotchas

- **F1 — The claude stub cannot emit malformed stream lines, so the line-parser red
  tests needed a throwaway raw-claude script.** Task 3's criteria (b)(c)(d) require
  blank / non-JSON / scalar / no-newline stdout lines, but `stub-interactive-claude.mjs`
  always emits valid JSON objects with trailing newlines. The author wrote a tiny
  runtime-only script (via `writeFileSync` into `mkdtemp`, not committed to `scripts/`)
  that echoes exact bytes to stdout. Evidence: retro-log 2026-11-04T03:29:33Z (task 3
  doc-gap); impl log task-3_...0330. Frequency: once this spec. Cost: extra author
  reasoning, 1 spawn.
- **F2 — A `waitFor` wall-clock deadline flaked only under the full parallel suite on
  CI.** Task 12's (n,m) failing-POST test uses a 5000 ms `waitFor` deadline; under node 20
  running the whole suite on 2 cores, a starved event loop lapsed the window before the
  chokidar watch + two failing fetches + retry delay + appendEvent chain got CPU, even
  though the `it()` block had 10000 ms. Fix widened the deadline to 15000 ms / 20000 ms;
  no product code changed, passing runs still finish in ~600 ms. Evidence: commit
  a62990c0; retro-log 2026-11-04T06:57:02Z; impl log task-12_...0654. Frequency: once
  this spec. Cost: 1 CI fix round + 1 CI re-run.

## Product bugs found

None found. The red tests described current behaviour the feature then changed; no
pre-existing product defect was uncovered. Evidence: 36 pre-existing tests stayed green
across both touched files (retro-log 2026-11-04T04:48:11Z, task 8).

## Tool and MCP errors or deficiencies

None found.

## Harness defects

None found. The ledger reconciled cleanly (57 spawns, reviewCoverage 15/15, logCoverage
15/15; HANDOFF implementation row). No double `spawn.end`, no stage-named `phase.end`
result observed.

## Prompt misunderstandings

- **F3 — A tasks-phase "regression guard (hold at base)" label was wrong for one
  sub-case.** Task 12 tagged criteria (4.5)/(n) and (4.6)/(o) as guards, but only (4.6)/(o)
  actually held unchanged at run; (4.5)/(n) needed a genuine new red test because
  `notify.json` is not read yet, so an old-seam test would never attempt a POST. The
  author verified the labels by running rather than trusting them. Evidence: retro-log
  2026-11-04T05:54:16Z (task 12 doc-gap). Frequency: once this spec. Cost: extra author
  reasoning, no fix round.

## Inefficiencies

- **F4 — Three tasks hit red-impossible and needed hand-named, non-counted guards.**
  Task 3 (stub limitation, F1), task 8 (kill-retry + `drivenRuns()` already held at base,
  so a `liveness-e2e.test.ts` regression guard passed green at base and was not counted
  red), and task 12 (one guarded sub-case, F3). Each cost extra author reasoning to
  distinguish genuine red from pre-held behaviour. Evidence: retro-log entries
  2026-11-04T03:29:33Z, 04:48:11Z, 05:54:16Z. Frequency: 3 of 15 tasks. Cost: author
  reasoning; no fix rounds.

## Documentation gaps

None found. Task 15 (docs) rewrote the `notify.json` / redrive docs and passed its agent
review with 0 findings; the home-list count held. Evidence: review-15_v2_...0636.

## Model behaviour

- **F5 — The implementer confirmed the ntfy header contract by live docs fetch rather
  than shipping a blind header.** Task 12 WebFetched docs.ntfy.sh/publish to verify
  `Authorization: Bearer`, the `Title`/`Priority` aliases and the 4096-byte body limit
  before wiring the POST, found no disagreement with design C9, and so did not escalate
  (built to escalate if it had). Evidence: impl log task-12_...0558. Frequency: once this
  spec. Cost: 1 WebFetch.
- **F6 — The design review tightened a token-redaction rule proactively.** Design v3
  dropped an AND so any token containing a `/` OR a file extension is redacted, making
  `notify.json` redact in startup logs; the v3 Revision History corrected the understated
  R1-1 disposition. Evidence: adversarial-analysis-design-r3.md (S-1); commit bb936307.
  Frequency: once this spec. Cost: 1 design round.

## Process deviations and rulings

None found. HANDOFF records no rulings and no cut scope across all three document phases;
0 adjudications (retro-log 2026-11-04T06:41:17Z). Tasks 10-13 took a gate-only review
(verifier-skipped) per the established routing (HANDOFF Verifier-skipped row, retro
P6/P15); this is intended and not re-logged as a deviation.

## Decisions the harness made for the human

None found. No silent merge-blocks or D9 overrides; the CI flake was fixed in-loop, not
escalated.

## Repeat patterns

- **F4 (red-impossible / guard mislabel) recurs widely.** Also advisor F12, lean-orchestrators
  F9, tdd-task-loop F3, verification-loop F1/F5, run-pause F6, harness-control-pane F9,
  dashboard-loop-views F10, harness-evals F7. The pattern persists despite the
  tdd-regression-guard rule in agent-rules.md.
- **F2 (node-20 `waitFor` CI timing flake) recurs.** Also review-gate F1, project-bootstrap
  F1, harness-control-pane F7/F13, dashboard-loop-views F6. A wall-clock deadline sized on
  local node 24 starves under the node-20 2-core parallel CI suite.
- **Gate-only / verifier-skipped tasks (10-13) recur.** Also advisor F15, dashboard-project-list
  F11, dashboard-loop-views F12, run-pause F11, harness-bookkeeping, project-bootstrap,
  spec-lint. This is accepted routing, listed only for the pattern.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | requirements v3, design v3, tasks v1 |
| Review rounds | requirements 3, design 3, tasks 1 (all converged should-fix-only) |
| Document fix rounds | requirements 2, design 2, tasks 0 |
| Corrective passes | requirements v3 + design v3 (SHOULD_FIX-only); 0 adjudications |
| Implementation fix rounds | 0 in-loop; 1 post-gate CI round |
| Escalations / rulings | 0 / 0 |
| Deferrals added | 0 (32 open project-wide) |
| Spawns | 57 (implementation) |
| TDD | 14 tasks: assertion-red 5, structural-red 9, vacuous 0 |
| Verifier-skipped | tasks 10, 11, 12, 13 (gate-only); reviewCoverage 15/15 |
| PR | #200, merged to main |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  Eval case: <case id — what its grader checks | none — why>. Required when Target is
  harness skills or agents, or server code, docs or templates.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs' findings,
each proposed for promotion into a steering document or agent-rules.md, with the rule text as
it would be written.
