# Retrospective — question-gates

Compiled 2026-09-16 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Requirements rounds 2 and 3 compounded incomplete round-1 fixes.** Round 2's
  MUST_FIX (R2-1) compounded R1-1's AC contradiction and R2-2 compounded R1-2/R1-4's
  drafter→orchestrator wire gap; round 3's R3-1 compounded R2-2 again. The same seams were
  patched shallowly and re-surfaced across three review rounds before the SHOULD_FIX-only
  pass closed them. Evidence: retrospective-log.md 20:26:39Z, 20:42:09Z;
  reviews/adversarial-analysis-requirements-r2.md, -r3.md. Frequency: 4 requirements rounds,
  3 with compounding findings. Cost: ~2 extra reviewer + reviser rounds.

## Product bugs found

None found. The two `src/` tasks (veto-rules module, harness gate action) and four
`harness/` prose tasks all landed on the first pass; `npm run build`, `npm test` (1260
passed / 2 skipped) and `claude plugin validate . --strict` were green.

## Tool and MCP errors or deficiencies

None found beyond the harness-tool allowlist gap recorded under Harness defects (F2).

## Harness defects

- **F2 — The `harness` MCP tool is not allowlisted in the four SDD orchestrator agent
  definitions, so every phase fell back to manual orient/brief.** The phase skills call
  `harness orient` (Step 0) and `harness brief` (Lint + revise), but
  sdd-document/implementation/closeout/retro-orchestrator.md do not grant the tool, so all
  four phases assembled orient and every worker brief by hand and no
  reviews/lint-brief-<PHASE>-v<D>.md persisted. Root cause is the missing allowlist entry,
  not a stale cache. Evidence: retrospective-log.md 21:08:06Z, 00:55:50Z;
  plugins/spec-workflow-harness/agents/sdd-document-orchestrator.md tools list; deferral
  d-473aa261. Frequency: all 4 phases this spec; already seen in spec-lint (origin of
  d-473aa261). Cost: manual overhead every phase; tokens unquantified.

- **F3 — The tasks orchestrator re-initialized the ledger, splitting one run across two
  run ids.** It overwrote /tmp/scratchpad/sdd/question-gates/event.sh with a fresh run id
  (run-20260916-225339) instead of reusing the supervisor's EVENT_SCRIPT
  (run-20260916-194812), so all tasks-phase events plus the supervisor's tasks spawn.end
  landed under the new id. Requirements and design orchestrators did not; the variance
  traces to the same F2 allowlist gap (with `harness orient` unavailable the orchestrator
  improvised ledger setup). The supervisor restored the original id. Evidence:
  retrospective-log.md 00:04:11Z; harness-events.jsonl (83 events under -194812, 11 under
  -225339). Frequency: once (tasks phase). Cost: one-off ledger split, cosmetic for
  `--watch`.

## Prompt misunderstandings

None found.

## Inefficiencies

- **F4 — spec-lint citation-identifier warnings recur on almost every version.** The rule
  flags the document's own defined terms (`record`, `headless`, `question`, `options`) and
  bare paths that sit in Revision-History disposition bullets. Requirements v2/v3 lint
  passes surfaced 5 then 9; tasks v1 re-introduced 5 bare-path citations in its own lint
  Revision-History bullet. Always warnings, never blocking, but each costs a lint reviser
  spawn per version. The tasks v2 lint brief added a convergence rule (no path/identifier
  tokens in the decision log) and lint dropped from 20 findings to 1. Evidence:
  retrospective-log.md 20:33:46Z, 23:30:19Z, 23:59:55Z. Frequency: most versions across
  requirements and tasks; seen in harness-bookkeeping F11 and the spec-lint retro. Cost:
  ~1 lint reviser spawn per version.

## Documentation gaps

- **F5 — Design Component 4 named gate B's veto-list sources but not the source for the
  payload's compact `tasks:[{id,title}]` plan.** The task-5 implementer filled the gap with
  a permitted task-header grep, consistent with the no-body-read rule, so it cost no spawn —
  but a downstream reader had to invent the plan source. Evidence: retrospective-log.md
  00:42:11Z; Implementation Logs/task-5. Frequency: once. Cost: none (resolved in
  implementation).

## Model behaviour

- **F6 — Reviser/drafter disposition bullets overstate or misplace their own citations.**
  The requirements v4 Revision-History bullet claimed R3-1 "deleted" two phrases that remain
  verbatim (the fix added a grounding clause instead); the design v3 Component 4 gate-A
  bullet cited SKILL.md:102-105 when the LINT assignment is at 104-107. Both are cosmetic —
  content is grounded — but the decision log is not self-consistent. Evidence:
  retrospective-log.md 20:58:17Z, 22:47:33Z; reviews/adversarial-analysis-requirements-r4.md,
  -design-r3.md. Frequency: twice (requirements v4, design v3). Cost: none (cosmetic nits).

## Process deviations and rulings

- **F7 — One lint finding was ruled rejected in both tasks rounds; no other rulings or
  escalations occurred.** L-7 (bridge-missing) was ruled a false positive in tasks v1 and
  v2: task 4's mention of task 5's re-spawn behaviour names no artefact task 5 creates, so
  the template's bridge rule does not trigger; D1's producer-before-consumer order covers
  it. Two phases (requirements v3→v4, design v2→v3) exited via the SHOULD_FIX-only
  corrective pass + narrow check (VERIFIED 3/3 each) rather than another full review round —
  normal routing, not a deviation. Evidence: tasks.md Revision History v1/v2 L-7;
  retrospective-log.md 20:42:09Z, 22:47:33Z. Frequency: 1 ruling, 0 adjudications, 0
  escalations. Cost: none.

## Decisions the harness made for the human

- **F8 — The four live gate scenarios were deferred to a post-release plugin reinstall, so
  the spec shipped with only the tool half verified.** The harness/server changes take
  effect only after a release republishes and the plugin re-installs, so scenarios 1-4 (gate
  A and gate B, interactive and headless) were deferred to d-1880d115; the in-process tool
  half (build + 1260 tests + plugin validate) is proven and a fixture is staged. The
  implementation orchestrator made this call autonomously. Evidence: retrospective-log.md
  00:55:52Z; deferral d-1880d115; HANDOFF question-gates implementation. Frequency: once;
  same class as spec-lint's d-473aa261. Cost: verification split across a release boundary.

## Repeat patterns

- **F2 ↔ spec-lint d-473aa261.** The `harness` tool allowlist gap on the four SDD
  orchestrator agents is a standing defect: spec-lint opened d-473aa261 for it and
  question-gates re-hit it in all four phases. It blocks lint-brief persistence and the
  round-1 `## Changes since` prompt across every harness spec.
- **F3 ↔ harness-bookkeeping F6, spec-lint F10.** A run's ledger id is overwritten mid-run
  (here by a sub-orchestrator, elsewhere by a concurrent peer supervisor or an overwritten
  active-run pointer), splitting events across two ids. Same class each time; cosmetic for
  `--watch`.
- **F4 ↔ harness-bookkeeping F11, spec-lint retro.** citation-identifier false positives on
  backticked plain words and Revision-History decision-log tokens cost a lint pass per
  version on every recent spec.
- **F8 ↔ spec-lint d-473aa261.** A harness/server spec can only verify its tool half
  in-process; the live half always waits for a release + reinstall and is carried as a
  verification deferral.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | requirements v4, design v3, tasks v2 |
| Review rounds | requirements 3 + narrow check; design 2 + narrow check; tasks 2 |
| Fix rounds (impl) | 0 (all 6 tasks gate-pass at risk low) |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 1 (L-7 bridge-missing, rejected, tasks v1+v2) |
| Deferrals added | 1 (d-1880d115, verification) |
| Worker spawns | requirements ~12; design 9; tasks 6; implementation 7 (6 implementers + 1 e2e verifier) |
| Orchestrator spawns | 4 phase orchestrators (3 document + 1 implementation) + retro |
| PR | https://github.com/madmatt112/spec-workflow-mcp/pull/46 |

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
findings, each proposed for promotion into a steering document or agent-rules.md, with the
rule text as it would be written.
