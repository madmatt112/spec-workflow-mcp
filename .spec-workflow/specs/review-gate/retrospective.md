# Retrospective — review-gate

Compiled 2026-09-14 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

First spec run under harness 5.4.0 (review cap at v4 with adjudicate-to-v5 and
sdd-checker, Sonnet reviser, lean templates with word caps, one approval per phase,
required codebase-context.md). Findings that touch a 5.4.0 change say so.

## Gotchas

- **F1 — Node 20 is the CI runtime; only node 22/24 exist locally.** check-runner and the
  e2e test assert only on killed/signal/code so they hold on 20, but node-20 behaviour was
  never run locally; design R4-2 raised it and tasks absorbed it as "CI is the check".
  Evidence: retrospective-log.md entry 08:52:01Z (task 3); reviews/adversarial-analysis-design-r4.md
  R4-2; HANDOFF.md `## review-gate — implementation` Gotchas row. Frequency: 3 times in
  this spec (design r4, tasks 3 and 7). Cost: unknown; a node-20-only failure surfaces
  first at the PR gate.

- **F2 — `harness/` edits regenerate 12 `plugins/` copies per commit.** Tasks 8 and 9
  changed 55 and 42 net lines but touched 16 and 12 files; the task 8 verifier spent 101k
  tokens, the second-highest verifier spawn, on a diff that is 75% generated copies.
  Evidence: Implementation Logs/task-8_2026-09-14T0937_d2691cb9.md and
  task-9_2026-09-14T0945_69007de0.md file lists; harness-events.jsonl `spawn.end` verify
  task 8 tokens=101389. Frequency: 2 tasks. Cost: ~40k verifier tokens (estimate).

- **F3 — The spec store is gitignored in this repo, so no spec artifact has git history.**
  Every checkpoint through commit-spec-store.sh reported "nothing to commit"; v1-v4 of each
  document, 12 analyses and the retro log exist only as working files plus two approval
  snapshots. Evidence: .gitignore:148; `git log -- .spec-workflow/specs/review-gate` is
  empty; /tmp/scratchpad/sdd/review-gate/commit-spec-store.sh (check-ignore branch).
  Frequency: every checkpoint in this spec (~30). Cost: none in tokens; a lost or mangled
  document cannot be recovered.

## Product bugs found

- **F4 — `runGit` in task-diff.ts is file-private and returns neither stderr nor an exit
  code.** Design v3 promised distinct "not a repo" and "bad ref" outcomes the helper cannot
  produce; v4 worked around it by ordering `rev-parse --show-toplevel` before the ref
  resolve instead of changing the helper. Evidence: reviews/adversarial-analysis-design-r3.md
  R3-1; retrospective-log.md entry 07:05:00Z. Frequency: once. Cost: 1 reviewer + 1
  reviser spawn (design r3 to v4; the reviser spawn was 272k tokens).

## Tool and MCP errors or deficiencies

- **F5 — The worktree sandbox refuses compound shell lines that mix `sed -i` on the spec
  store with heredocs.** The implementation orchestrator had to split them. Evidence:
  HANDOFF.md `## review-gate — implementation` Gotchas row. Frequency: seen during
  implementation, count not logged. Cost: unknown.

- **F6 — `log-implementation` rendered an artifact block with every field `undefined`.**
  Task 6's log has an `### Integrations` entry whose Description, Frontend Component,
  Backend Endpoint and Data Flow are all `undefined`; the tool accepted an empty
  integration object and the renderer printed it. Evidence:
  Implementation Logs/task-6_2026-09-14T0919_d8a95385.md `## Artifacts`. Frequency: once.
  Cost: none.

- **F7 — The run's `event.sh` is mode 644, so `test -x` fails and it must be invoked
  through `bash`.** The retrospective skill says to skip the ledger when the script is
  missing; a non-executable script is the same failure from a different cause. Evidence:
  /tmp/scratchpad/sdd/review-gate/event.sh (`ls -l`). Frequency: once. Cost: none.

## Harness defects

- **F8 — Retro-log entry timestamps are typed by the orchestrator and disagree with the
  ledger.** Requirements round 3 is stamped 05:20Z, after round 4 (05:04Z) and after the
  05:05Z approval; the tasks entries are stamped 08:10-09:45Z while the ledger has the four
  tasks rounds at 07:55-08:28Z and implementation starting 08:31Z; design rounds 1-3 are
  10-20 minutes late. Evidence: retrospective-log.md headings versus harness-events.jsonl
  `round` events; sdd-document-phase/references/cleanup.md:29 gives the format but no
  source for the timestamp. Frequency: 15 of 16 document-phase entries. Cost: none in
  tokens; the log cannot be used for timing.

- **F9 — `BUDGET: 3 review rounds` per orchestrator spawn against a v4 cap forces a
  re-spawn whenever a phase needs its fourth round.** All three phases did: each stopped
  with v4 written and unreviewed, wrote HANDOFF, committed, and a fresh orchestrator
  re-oriented to run one confirming round and approve. (5.4.0: cap at v4.) Evidence:
  harness-events.jsonl `phase.end result=resume` at 04:52:26Z, 07:15:36Z, 08:18:38Z;
  `spawn.end` document-orchestrator spawn 2 tokens 67,711 / 68,999 / 65,786; HANDOFF
  commits d25abba, 7fe01fa, 7b5a465 (stops) and 7c1efea, e93a14f, a68a76b (resumes).
  Frequency: 3 times (every document phase). Cost: ~202k orchestrator tokens, 6 HANDOFF
  commits, ~12 minutes per phase.

- **F10 — The reviser brief scopes the reviser to the analysis findings, so next-round
  guidance in the memory file is read and dropped.** The tasks round-2 memory flagged task
  7 as carrying the same fixture defect; the v3 reviser saw it, left it because it was not
  a round-2 finding, and round 3 found it. Evidence: retrospective-log.md entry 08:55:00Z;
  reviews/adversarial-memory-tasks.md:37-44; sdd-document-phase/references/briefs.md
  reviser template ("Memory: read; do not write"; disposition rule 3 "Do not widen
  scope"). Frequency: once explicit; the same class in requirements r2 and design r2.
  Cost: 1 reviewer + 1 reviser spawn (~143k tokens) plus the round-4 confirmation.

## Prompt misunderstandings

- **F11 — Implementers reported file paths under the main checkout instead of the
  worktree (tasks 4 and 9).** The standing brief names the worktree as code root but the
  report rule ("files touched one per line") does not say which root to report under; the
  commits were on the worktree branch, so only the report was wrong. Evidence:
  retrospective-log.md entry 09:02:17Z; HANDOFF.md implementation Gotchas row;
  /tmp/scratchpad/sdd/review-gate/impl-standing.md lines 5-11 and 43. Frequency: 2 of 10
  tasks. Cost: none (the verifier checked the commit, not the report).

## Inefficiencies

- **F12 — Round 4 was a confirming round in every phase.** Round-3 verdicts were 0/2/1,
  0/1/4 and 0/1/0; the convergence rule requires `SHOULD_FIX: 0`, so one SHOULD_FIX buys a
  full reviewer spawn on the next delta even with no MUST_FIX left. Evidence:
  sdd-document-phase/SKILL.md Step 0 item 4 and Step 2 item 9; harness-events.jsonl
  `round` events; `spawn.end` reviewer tokens 110,968 / 142,088 / 103,631 for the three
  round-4 spawns. Frequency: 3 times. Cost: ~357k reviewer tokens plus F9's re-spawns.

- **F13 — A verifier ran for every task: ten spawns, 748k tokens, zero findings.** Every
  task passed on round 1, so 40% of implementation-phase tokens bought no change. This
  spec ships the gate that routes pass/low tasks past the verifier (tasks 8 and 9), so the
  fix is in PR #29 and unmeasured until the next spec runs on it. Evidence:
  harness-events.jsonl `spawn.end` verify task 1-10; reviews/review-{1..10}_v1_*.md all
  pass; retrospective-log.md entry 09:58:20Z. Frequency: 10 times. Cost: 748k tokens.

- **F14 — The Sonnet reviser spends as many tokens per round as the Opus reviewer.** Nine
  reviser spawns averaged 137k tokens (1.23M total) against 127k for the reviewer; the
  design v3-to-v4 reviser spent 272k on a 0/1/4 verdict. (5.4.0: sdd-reviser on
  claude-sonnet-5 at high effort.) The saving is in unit price, not volume. Evidence:
  harness-events.jsonl `spawn.end` sdd-reviser (n=9, tokens=1,233,146) and sdd-reviewer
  (n=12, tokens=1,526,180); agents/sdd-reviser.md:4-5. Frequency: 9 spawns. Cost: 1.23M
  tokens.

- **F15 — Document phases took 67% of tokens and 77% of wall clock; implementation went
  10/10 first pass.** 3.86M of 5.73M tokens and 5h08m of 6h42m went to requirements,
  design and tasks; implementation then needed 0 fix rounds and 0 adjudications, and the
  retro log credits the tasks document's precision (line citations, worked-out fixture
  preconditions) for it. Evidence: harness-events.jsonl `phase.start`/`phase.end` and
  `spawn.end` aggregates; retrospective-log.md entries 08:36:09Z, 09:15:02Z, 09:58:20Z.
  Frequency: this spec. Cost: as stated; whether it is the right trade is the
  retrospective's question.

## Documentation gaps

- **F16 — Design and tasks located the review-task action list by its "Two actions"
  header without saying to update the count word.** The task 6 implementer changed it to
  "Three actions" and flagged RETRO doc-gap because a strict verifier could read the edit
  as outside the touch list. Evidence: retrospective-log.md entry 09:19:37Z; commit
  f313676. Frequency: once. Cost: none.

- **F17 — codebase-context.md's probe line on merge commits seeded design R1-1.** Line
  158 says a merge commit "prints nothing without `-m --first-parent`", which the drafter
  carried into Component 5 as a first-parent-only diff; the r1 reviewer probed git 2.43.0
  and refuted it (MUST_FIX). (5.4.0: required codebase-context.md, read first in every
  brief.) Evidence: .spec-workflow/specs/review-gate/codebase-context.md:158;
  reviews/adversarial-analysis-design.md R1-1. Frequency: once. Cost: 1 MUST_FIX in design
  r1, then the v2 command swap that dropped `-c core.quotePath=false` (design R2-1).

## Model behaviour

- **F18 — The drafter misstated code artifacts in v1 of both requirements and design.**
  Requirements R1-1 (task-parser block span ends at the next checkbox, not a heading) and
  R1-2; design R1-1 (F17) and R1-2 (`filesOnly` with no mode guard). The drafter rule says
  verify every citation at both ends; four MUST_FIX claim errors got through. Evidence:
  reviews/adversarial-analysis-requirements.md R1-1, R1-2;
  reviews/adversarial-analysis-design.md R1-1, R1-2; agents/sdd-drafter.md. Frequency: 2
  phases, 4 findings. Cost: shaped rounds 1-2 of both phases (~4 spawns).

- **F19 — The reviser fixes the flagged instance, not the class, so each delta opens a
  seam the next round finds.** Requirements r2: all four substantive findings compounded on
  the v2 delta. Design r2: the R1-1 command swap dropped a flag. Tasks r1, r2, r3: the same
  "fixture cannot produce the asserted verdict" defect in one rule, then two more rules,
  then another task; the r3 reviser's sweep was the first to walk the whole rule table.
  (5.4.0: Sonnet reviser; no Opus baseline in this store to compare.) Evidence:
  retrospective-log.md entries 04:40:00Z, 06:35:00Z, 08:40:00Z, 08:55:00Z, 09:40:00Z;
  reviews/adversarial-memory-tasks.md:37 ("RECURRING across rounds 1-3"). Frequency: 3
  phases. Cost: about one round per phase, ~800k tokens across reviewer and reviser.

## Process deviations and rulings

- **F20 — The design drafter re-decided two requirements; the round-1 reviewer, not the
  orchestrator, ruled them permitted refinements.** D17 widened req 1.4's HEAD fallback to
  count untracked files; D21 added risk rule g (hygiene rejection raises risk) to req 3.1's
  closed list. The tasks drafter re-flagged both as carried. Evidence: retrospective-log.md
  entries 05:30:00Z (two), 05:55:00Z, 08:10:00Z; design.md D17, D21. Frequency: 2. Cost: 0
  extra spawns.

No orchestrator rulings, no standoffs, no adjudication and no sdd-checker spawn in any
phase: the 5.4.0 post-cap path was not exercised.

## Decisions the harness made for the human

- **F21 — All three phase approvals were agent-side, 4-7 seconds after the request.** The
  human was not asked anything from run start (03:18Z) to PR open (10:00Z). This is
  5.4.0's "one approval request per phase, filed for the approved version" working as
  written; whether a human gate belongs somewhere in 6h42m is for the retrospective.
  Evidence: approval_1789362305169_drifuf0rc (requested 05:05:05Z, approved 05:05:11Z);
  approval_1789371101511_f179qeeah (07:31:41Z to 07:31:45Z);
  approval_1789374518950_4t4vkpi4q (08:28:38Z to 08:28:43Z). Frequency: 3. Cost: none.

- **F22 — Four scope cuts were made by agents and recorded only in HANDOFF.** No dashboard
  frontend change (`reviewer` travels in the API payload only); no `## Checks` parsing
  from agent-rules.md (design D2); no version bump (req 9.5); Windows shell behaviour not
  verified. Evidence: HANDOFF.md `## review-gate — requirements`, `— design`, `— tasks`
  Cut scope rows. Frequency: 4 across 3 phases. Cost: none.

F20's two re-decisions (D17, D21) also belong here.

## Repeat patterns

None found. This is the first retrospective in this spec store; no earlier
`retrospective.md` exists to compare against. Within this spec, F9, F12 and F19 each
recurred in all three document phases, which is the nearest thing to a cross-spec signal
and the first thing the next retrospective should check.

## Summary numbers

| Item | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | v4 / v4 / v4 (every phase converged at the 5.4.0 cap) |
| Review rounds | 12 (4 + 4 + 4) |
| Fix rounds (implementation) | 0 of 10 tasks |
| Adjudications / checker spawns | 0 / 0 |
| Escalations | 0 |
| Rulings | 0 by orchestrators; 2 by the design r1 reviewer (D17, D21) |
| Deferrals added | 0 (12 deferred in total, none from this spec) |
| Orchestrator spawns | 7 (2 + 2 + 2 document, 1 implementation) |
| Worker spawns | 45 (3 drafter, 12 reviewer, 9 reviser, 10 implementer, 11 verifier) |
| Tokens | 5.73M: documents 3.86M (67%), implementation 1.87M |
| Wall clock | 6h42m: requirements 1h47m, design 2h25m, tasks 56m, implementation 1h29m |
| Document sizes vs 5.4.0 caps | requirements 3,491 / 3,500 words; design 4,000 / 4,000; tasks 3,203 |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/29 (open, mergeable, CI green; +2,464 / -199, 45 files) |

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
