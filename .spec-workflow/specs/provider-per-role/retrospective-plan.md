# Retrospective plan — provider-per-role

Status: CLOSED
Approved: 2026-09-23 by Matthew in the retro conversation (run run-20260923-160920).
Source: `retrospective.md` and `retrospective-proposals.md` in this directory, plus nine open
harness items from the overwatch session, put to Matthew as extra candidates (P17-P22).

## Decisions made

- **P4 — A.** Truncate-on-resume helper only: on resume, trim `harness-events.jsonl` back to
  its last complete line (drop a trailing partial line and any NUL run), keep the run id. No
  fsync or atomic-append change to `event.sh`.
- **P19 — medium routes like low.** A medium-risk task gets the deterministic gate only, no
  LLM verifier, in both the implementation and close-out phases (resolves d-009995d8).
- **P19 — placement (Matthew: "your choice"; supervisor chose).** The convention that
  docs-only tasks are down-ranked in risk is written in `docs/SDD-HARNESS.md`, next to the
  risk scoring description, because it is a harness convention that applies in every
  project, not only this one.

## Approved proposals

- **P1 (F1) — Require `${VAR:-}` for env reads in generated shell under `set -u`.** The
  launcher template and any task that authors a `set -u` shell script must read optional
  environment variables as `${VAR:-}`, never bare `$VAR`, so an unset key hits the intended
  no-row path instead of unbound-variable exit 1. Add the rule to the decomposition
  conventions for shell-authoring tasks and to `review-task`'s shell checklist.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: a one-line convention, the code fix already landed (044bbc3).
  Prerequisites: none.
  Decision: approved as written.

- **P2 (F2) — Supervisor preflights provider secrets before the implementation phase.**
  Before spawning the implementation orchestrator, the supervisor reads the `## Providers`
  map and, for every non-anthropic provider named, checks its required key is exported; a
  missing key stops with a plain-text ask up front instead of burning an implementer spawn
  and a mid-phase escalation that blocks dependent tasks.
  Target: harness skills or agents (`sdd-continue` supervisor preflight).
  Effort: M. Risk: low: preflight only reports, never writes.
  Prerequisites: none.
  Decision: approved as written.

- **P3 (F3) — E2E tasks that stage a scratch store must name a distinct event-script
  path.** A task brief that tells the implementer to build a scratch store with its own
  event script must give an explicit path under that scratch store (e.g.
  `<scratch-store>/event.sh`) and state that it must not be the supervisor's
  `EVENT_SCRIPT`. Pair with an implementer standing rule: never write to the
  `EVENT_SCRIPT` path from the launch prompt.
  Target: project steering, templates or decomposition conventions; and `sdd-implementer`
  agent rules.
  Effort: S. Risk: low: wording plus one standing rule.
  Prerequisites: none.
  Decision: approved as written; the implementer standing rule lands in the harness
  (`harness/agents/sdd-implementer.md`), the brief wording in the tasks-drafter guidance.

- **P4 (F4) — Add a ledger truncate-on-resume helper.** The supervisor already recovers by
  hand: on resume, before appending, truncate `harness-events.jsonl` to its last complete
  line (drop a trailing partial line and any NUL run). Ship this as a small shell helper the
  resume path calls, so crash recovery is one documented step, not manual surgery.
  Target: harness skills or agents (supervisor resume path in `sdd-continue`).
  Effort: M. Risk: low: only trims an already-corrupt tail; keeps the same run id.
  Prerequisites: none.
  Decision: option A (helper only), see Decisions made.

- **P5 (F5) — Same fix as P3.** The root cause of F3 was the brief's "its own event.sh"
  wording naming no distinct location. P3's decomposition-convention wording (name an
  explicit scratch-store path, forbid the shared `EVENT_SCRIPT`) removes this cause; no
  separate change.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: folded into P3.
  Prerequisites: P3.
  Decision: approved; done when P3 is done.

- **P8 (F8) — Caveat the "no MCP server" line for the eligible reviser.** In
  `docs/SDD-HARNESS.md` the DeepSeek-child sentence "given only the agent's frontmatter
  tools and no MCP server" reads as absolute, but the eligible `sdd-reviser` is launched
  with `--mcp-config` (design.md:133). Add a clause noting the reviser is the exception
  because its `adversarial-response` tool needs the server.
  Target: server code, docs or templates (`docs/SDD-HARNESS.md`).
  Effort: S. Risk: low: documentation only.
  Prerequisites: none.
  Decision: approved as written.

- **P11 (F11) — Reviser must fix every site of a multi-site finding.** Add an
  `sdd-reviser` standing rule: when a finding names a claim, value, decision or citation
  that can recur, `grep` for every occurrence and fix all of them in one pass; a partial
  fix that leaves a contradiction remnant is a MUST_FIX next round. This is the shared cause
  of F6, F7 and the fix-induced cap runs.
  Target: harness skills or agents (`sdd-reviser` agent).
  Effort: S. Risk: low: one standing rule, aligns with the existing citation-verify rule.
  Prerequisites: none.
  Decision: approved as written. Overwatch item 7 (3 of the last 6 document phases hit the
  v4 cap: provider-per-role requirements and tasks, dashboard-layout design) is the
  evidence it answers.

- **P16 (F16) — Guard the shared `event.sh` / `EVENT_SCRIPT` path from workers.** Across
  three specs a spawned worker or peer step wrote the supervisor's shared `event.sh` or
  `.runid`, splitting one run across ids and fragmenting `--watch`. Make the rule explicit
  everywhere workers run: only the supervisor writes `event.sh`, `.runid` and the shared
  event script; any scratch store a task stages uses its own named path. See the graduation
  candidate below for the exact rule text.
  Target: project steering, templates or decomposition conventions; agent-rules.md.
  Effort: S. Risk: low: a standing rule plus the P3 wording; no code change.
  Prerequisites: P3.
  Decision: approved as written.

- **P17 (overwatch 4) — Fix the SubagentStop hook's usage rows (d-3091be1c).** Three
  residual defects: (a) the hook fires at every yield of an orchestrator with background
  children, so a re-entered orchestrator gets several cumulative `spawn.end` rows; (b) the
  row is written about 65 ms before the orchestrator's final assistant line lands, so it
  misses that line; (c) it sums every transcript line, but a message with several content
  blocks writes one line per block with the same `message.id` and the same usage, inflating
  totals about 2.5-3x. Dedupe by `message.id` keeping the last line, emit one `spawn.end`
  per spawn, and catch the final line.
  Target: harness hook (`harness/hooks/sdd-activity.sh`) and its test.
  Effort: M. Risk: medium: changes every recorded token figure from here on.
  Prerequisites: none.
  Decision: approved (overwatch item 4). Re-verify d-3091be1c after the fix merges.

- **P18 (overwatch 5) — Stop duplicate event rows from re-issued `event.sh` calls.** Opus
  4.8 orchestrators re-issue `event.sh` calls: duplicate `phase.end` (dashboard-layout
  requirements, 2026-09-22 15:59:19Z and 15:59:35Z) and duplicate `phase.start`
  (provider-per-role tasks, 18:10:23Z and 18:11:39Z). Hypothesis: the RTK Bash hook
  filters `event.sh`'s empty output, so the orchestrator sees no confirmation and retries.
  Make the event script print a one-line confirmation that survives the filter, or make a
  repeated identical row harmless.
  Target: harness skills (the `event.sh` text in `sdd-continue/references/formats.md`).
  Effort: S. Risk: low: output-only change to the script text.
  Prerequisites: none.
  Decision: approved (overwatch item 5).

- **P19 (overwatch 2 and 3) — Route medium risk like low; document the docs-only
  down-rank.** Docs-only tasks score risk medium, but the implementation and close-out
  skills route only low and high (d-009995d8). Route medium like low: deterministic gate
  only, no LLM verifier. Write the docs-only down-rank convention in `docs/SDD-HARNESS.md`
  next to the risk scoring description.
  Target: harness skills (`sdd-implementation-phase`, `sdd-closeout-phase`) and docs
  (`docs/SDD-HARNESS.md`).
  Effort: S. Risk: low: medium tasks get the cheaper route Matthew chose.
  Prerequisites: none.
  Decision: medium like low; placement in `docs/SDD-HARNESS.md` (see Decisions made).
  Resolve d-009995d8 when it lands.

- **P20 (overwatch 8) — spec-lint coverage rule accepts the component letter.** The
  coverage-component rule wants the design heading label ("A. Shared defaults") where tasks
  say "Component A"; 12 errors persisted after the fix pass on dashboard-layout tasks. Make
  the rule match a task's "Component <letter>" to the design heading that starts with that
  letter.
  Target: server code (the spec-lint coverage-component check under `src/`, plus its test).
  Effort: S. Risk: low: loosens one match to an equivalent form.
  Prerequisites: none.
  Decision: approved (overwatch item 8).

- **P21 (overwatch 6) — Spec-store commit script skips gitignored paths.**
  `sdd-document-phase/references/cleanup.md:81-84` stages `.spec-workflow/approvals/<SPEC>`
  with `git add -A`; tradr-hosted gitignores that directory, so the add aborts there. Skip
  any path in the list that git ignores.
  Target: harness skills (`sdd-document-phase/references/cleanup.md` and every copy of the
  commit script text).
  Effort: S. Risk: low: fewer paths staged only where they are ignored anyway.
  Prerequisites: none.
  Decision: approved (overwatch item 6).

- **P22 (overwatch 1) — Name the `## Approved proposals` heading in the retro step.**
  Close-out orient counts plan items only under a heading titled exactly
  `## Approved proposals` (`src/tools/harness.ts:422`), and `sdd-continue`'s retrospective
  step never says so; a plan with another heading orients to 0 items (seen twice in tradr).
  State the exact headings (`## Approved proposals`, `## Graduation candidates`) and the
  `- **P<n>` item form in the step 5 plan instructions.
  Target: harness skills (`sdd-continue` step 5).
  Effort: S. Risk: low: instruction text only.
  Prerequisites: none.
  Decision: approved (overwatch item 1).

## Graduation candidates

- **G1 — The shared run-ledger paths are supervisor-only (F16 here; harness-bookkeeping F6;
  question-gates F3 — 3 specs).** Rule text, for `agent-rules.md` under a new
  `## Run ledger` heading (and echoed in the decomposition conventions):

  > Only the supervisor creates or writes `/tmp/scratchpad/sdd/<spec>/event.sh`, its
  > `.runid` and the run's `harness-events.jsonl`. A spawned worker calls `EVENT_SCRIPT`
  > only to append rows; it never rewrites, re-initializes or repoints it. A task that
  > stages a scratch store with its own event script gives that script an explicit path
  > under the scratch store (`<scratch-store>/event.sh`) and must not reuse the
  > supervisor's `EVENT_SCRIPT` path.

  Target: agent-rules.md (`.spec-workflow/agent-rules.md`).
  Decision: approved as written.

## No-change proposals

Accepted as no change; no close-out work.

- P6 (F6), P7 (F7) — the cap hits are answered by P11.
- P9 (F9) — the garbled Req 6 crit 5 clause is fixed when the criterion is next touched.
- P10 (F10) — the stale CLI version citation is left; version strings drift.
- P12 (F12) — the two design rulings worked as intended.
- P13 (F13) — the pre-gate requirements v1 is not a reviewable version.
- P14 (F14) — the flat-cap auto-route to adjudication is the documented rule.
- P15 (F15) — the crash resume decision was correct; P4 adds the tooling.

## Rejected proposals

- **Overwatch item 9 — tell the operator to confirm `/effort xhigh` in the supervisor
  preflight and the harness docs.** Not selected by Matthew in the retro conversation.

## Human action items

- d-a38fea66 (verification): after the restart that loads the merged harness, run a
  fixture requirements round of a scratch spec with `agent-rules.md` naming
  `sdd-reviewer: deepseek deepseek-v4-pro`, then with every role anthropic, then with the
  key unset. Evidence: the DeepSeek round goes through the launcher, the Anthropic round
  runs as before, the keyless run refuses at start.

## Close-out

One line per proposal, written by the close-out phase.

- P1: done — 3b9b1a0
- P3: done — d4d3228
- P5: done — folded into P3 (no separate change)
- P16: done — 4e1ccca
- G1: done — 5c33b89
- P2: done — 0bebf68
- P4: done — c9af722
- P8: done — 4a6941c
- P11: done — c464408
- P17: done — c87cd4a
- P18: done — 03e207a
- P19: done — 221a2fb
- P20: done — 8036cfc
- P21: done — 1ab0a2a
- P22: done — 8e8c0e3
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/62
