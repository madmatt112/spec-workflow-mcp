# Requirements Document — graph-orientation

## Introduction

This spec makes every SDD worker that touches code start from the graphify code graph of the code root instead of from cold `cat`, `sed` and `grep` reads. It is for the harness workers (drafter, reviewer, reviser, adjudicator, checker, implementer, verifier) and for the human who compares runs in the retrospective. It adds a graph fact to the supervisor's launch prompt, a `## Code graph` section to every brief when a graph exists, a graph-first rule for `codebase-context.md`, a graph refresh after code commits, and a `graph` column in `harness usage`.

## Alignment with Product Vision

The steering directory holds no `product.md`, so this spec aligns with the harness efficiency goal the decomposition entry states: tokens first. Raw reads of the code root are 27% of worker tool-result bytes, and `graphify explain` answers in about 200 tokens with `file:line` edges. The spec changes where a worker starts reading and what its brief says; it changes no review lens, gate rule, verifier decision or document cap.

## Requirements

### Requirement 1 — The graph fact at run start

**User Story:** As a phase orchestrator, I want the supervisor to tell me whether a code graph exists and how fresh it is, so that I can pass the facts into every brief without reading `graph.json` myself.

#### Acceptance Criteria

1. WHEN the supervisor has resolved the roots (`harness/skills/sdd-continue/SKILL.md:66-94`) THEN the supervisor SHALL resolve `GRAPH` to `<CODE_ROOT>/graphify-out/graph.json` when `CODE_ROOT` (`harness/skills/sdd-continue/SKILL.md:224-247`) is not a worktree, and to `<main checkout>/graphify-out/graph.json` when it is.
2. IF that file does not exist OR `command -v graphify` fails THEN the supervisor SHALL set `GRAPH` to `none`.
3. WHEN `GRAPH` is a path THEN the supervisor SHALL read the top-level `built_at_commit` key of the file and set `GRAPH_BEHIND` to the output of `git rev-list --count <built_at_commit>..HEAD` run in `CODE_ROOT`, and `GRAPH_BUILT_AT` to that sha.
4. IF `built_at_commit` is missing OR the `git rev-list` call fails THEN the supervisor SHALL set `GRAPH_BEHIND` to `unknown` and `GRAPH_BUILT_AT` to `unknown`.
5. WHEN the supervisor writes an orchestrator launch prompt (`harness/skills/sdd-continue/SKILL.md:224-247`) THEN it SHALL add the lines `GRAPH: <path | none>`, `GRAPH_BEHIND: <n | unknown | n/a>` and `GRAPH_BUILT_AT: <sha | unknown | n/a>`, with `n/a` on both freshness lines when `GRAPH` is `none`.
6. WHEN the worktree rule re-runs the worktree check (`harness/skills/sdd-continue/SKILL.md:320-327`) THEN the supervisor SHALL re-resolve `GRAPH`, `GRAPH_BEHIND` and `GRAPH_BUILT_AT` before the implementation spawn.
7. The supervisor SHALL resolve the graph against `CODE_ROOT` only, never against `SPEC_STORE_REPO`.
8. WHEN `GRAPH` is a path THEN the `run.start` row SHALL carry `graph=<path>` and `graphBehind=<n | unknown>` (the value after any Requirement 2 refresh); IF `GRAPH` is `none` THEN the `run.start` row SHALL carry neither key, so the ledger has the pre-spec shape.

### Requirement 2 — Freshness by tooling

**User Story:** As a worker, I want the graph rebuilt after code commits in the main checkout, so that a `file:line` from the graph matches the tree I read.

#### Acceptance Criteria

1. WHEN `GRAPH` is a path AND `GRAPH_BEHIND` is not `0` AND `CODE_ROOT` is the main checkout THEN the supervisor SHALL run `graphify update <CODE_ROOT>` once, after Requirement 1 and before the `run.start` row is written (`harness/skills/sdd-continue/SKILL.md:108-110`), which precedes the first orchestrator spawn of the run.
2. WHEN the implementation orchestrator receives an `sdd-implementer` report in the per-task loop (the implement spawn and each fix spawn, `harness/skills/sdd-implementation-phase/SKILL.md:84-159`) AND `GRAPH` is a path AND `CODE_ROOT` is the main checkout THEN the orchestrator SHALL run `graphify update <CODE_ROOT>` before the next brief of that task.
3. WHEN the close-out orchestrator receives an `sdd-implementer` report for a `harness` or `code` batch (`harness/skills/sdd-closeout-phase/SKILL.md:120-159`) AND `GRAPH` is a path AND the batch's landing root is the main checkout THEN the orchestrator SHALL run `graphify update <landing root>`.
4. WHEN a `graphify update` exits 0 THEN the caller SHALL treat the graph as current at HEAD: `GRAPH_BEHIND` becomes `0` and `GRAPH_BUILT_AT` becomes the HEAD sha, whether or not `built_at_commit` in the file moved.
5. IF a `graphify update` exits non-zero or exceeds the timeout the design sets THEN the caller SHALL keep the previous `GRAPH_BEHIND` and `GRAPH_BUILT_AT`, write one ledger `note` naming the exit, and continue the phase.
6. IF `CODE_ROOT` is a worktree THEN no caller SHALL run `graphify update`, and the worktree reads the main checkout's graph with `GRAPH_BEHIND` counted against the worktree's HEAD.
7. No caller SHALL commit `graphify-out/` or pass `--force` to `graphify update`; `graphify-out/` stays untracked (`.gitignore:166-167`).

### Requirement 3 — The `## Code graph` brief section by tooling

**User Story:** As an orchestrator, I want `harness brief` to write the code-graph instructions for me, so that every worker gets the same text and a run without a graph gets today's brief.

#### Acceptance Criteria

1. WHEN `harness` `brief` (`src/tools/harness.ts:28-49`) is called with `values.graph` set to a path THEN the tool SHALL append a `## Code graph` section at the end of the brief, for every template in `BRIEF_TEMPLATES` (`src/tools/harness.ts:485-535`) and for any template added later.
2. The section SHALL state: the graph path; the three calls with `--graph <path>`: `graphify explain "<symbol>"` for one symbol and its edges, `graphify path "A" "B"` for a chain, and `graphify query "<terms>" --budget 800` for an area, with terms taken from the graph's labels; the rule (below); and the freshness line.
3. The rule text SHALL say: run `explain` on a symbol before opening its code file, then read only the cited range to confirm it; never use the graph for the spec store; when `explain` prints "No node matching", read the file as before; an `[INFERRED]` edge is never a citation; a citation in a document or the context file names a range the worker read.
4. The freshness line SHALL read `built at <values.graphBuiltAt>, <values.graphBehind> commits behind HEAD`; WHEN `graphBehind` is not `0` THEN the line SHALL add that a `file:line` from the graph is a hint to confirm, not a citation.
5. IF `values.graph` is absent or equals `none` THEN the tool SHALL write a brief byte-identical to the pre-spec output for the same template and values.
6. IF `values.graph` is a path AND `values.graphBuiltAt` or `values.graphBehind` is absent THEN the tool SHALL fail naming the missing values and write no file, styled on the missing-value rule (`src/tools/harness.ts:617-631`): a new check, since Requirement 3 AC 7 keeps these values out of the `{{key}}` placeholder set that rule checks.
7. The graph values SHALL NOT be `{{key}}` placeholders of any template, so a caller that passes no graph value never fails the missing-value rule.
8. The tool SHALL NOT read `graph.json`, run git or spawn any process (`src/tools/harness.ts:17-27`): every graph fact comes from `values` (`src/tools/harness.ts:547-655`).

### Requirement 4 — Every orchestrator passes the graph to every worker

**User Story:** As a reviewer, reviser, checker, implementer or verifier, I want my brief or prompt to tell me to `explain` a cited symbol before I open its file, so that I stop dumping whole files to check one range.

#### Acceptance Criteria

1. WHEN `GRAPH` is a path THEN the document, implementation and close-out orchestrators SHALL pass `graph`, `graphBuiltAt` and `graphBehind` in every `harness` `brief` call, with the values current after any Requirement 2 refresh.
2. WHEN `GRAPH` is `none` THEN those orchestrators SHALL pass no graph value.
3. WHEN `GRAPH` is a path AND the document orchestrator appends the reviewer round section or writes the narrow-check prompt (`harness/skills/sdd-document-phase/references/briefs.md:136-208`, `harness/skills/sdd-document-phase/references/briefs.md:386-409`) THEN it SHALL add a code-graph block with the same path, calls, rule and freshness line as Requirement 3.
4. IF `GRAPH` is `none` THEN the round section and the narrow-check prompt SHALL be unchanged.
5. No orchestrator SHALL read `graph.json` or run a graphify read call itself; only the `graphify update` of Requirement 2 is an orchestrator call.

### Requirement 5 — The context file from the graph

**User Story:** As the requirements drafter, I want to build `codebase-context.md` from graph answers, so that the map every later worker reads first costs a fraction of a cold exploration.

#### Acceptance Criteria

1. WHEN `GRAPH` is a path AND the phase is `requirements` THEN the drafter brief's `## Codebase context` section (`harness/skills/sdd-document-phase/references/briefs.md:50-59`) SHALL tell the drafter to build the file from `explain` and `query` output for each area the decomposition entry names, and to open a code file only to confirm the range it cites.
2. WHEN `GRAPH` is a path AND the phase is `design` or `tasks` THEN the drafter brief SHALL tell the drafter to extend the file the same way.
3. The context file shape SHALL stay as spec 6 defined it, and every line SHALL cite a range the drafter read at both ends; a graph node alone is not a citation.
4. IF `GRAPH` is `none` THEN the drafter brief SHALL be unchanged.

### Requirement 6 — Graph use counted in `harness usage`

**User Story:** As the human in the retrospective, I want `harness usage` to show how many graphify calls each agent made, so that I can compare tokens and graph use per role against `agent-cache-ttl`.

#### Acceptance Criteria

1. WHEN `harness` `usage` runs for a spec THEN it SHALL read `harness-activity.jsonl` from the spec dir next to `harness-events.jsonl`; IF the file is missing THEN every graph count SHALL be 0 and the call SHALL succeed.
2. A graph call SHALL be one activity row with `event: tool`, `tool: Bash`, and a `summary` that names `graphify explain`, `graphify query` or `graphify path`; one row counts once, and a `graphify update` row does not count.
3. The fold SHALL attribute each graph call to the row's `agent` and to the phase whose live window contains the row's `ts`, by the rule `src/watch/usage.ts:277-296` applies to a spawn's start, else to phase `unknown`.
4. The one-report and compare tables (`src/watch/usage.ts:361-410`) SHALL print a `graph` column on every phase-agent row, every phase total and the spec total, and `data.report` SHALL carry the counts, folded by joining activity rows to the events-derived phase windows in `usageAction` (`src/tools/harness.ts:1072-1093`); the pure `buildUsageReport` (`src/watch/usage.ts:113-218`) SHALL NOT read the activity file.
5. IF an agent has graph calls in a phase but no spawn cell there THEN the table SHALL print a row for it with 0 spawns.
6. WHEN `compareSpecName` names a spec THEN the tool SHALL read that spec's activity log the same way, so `harness usage` for this spec against `agent-cache-ttl` prints that run's count.
7. Every existing column SHALL keep its value; only the header and row shapes gain the `graph` column.
8. IF a role runs as a separate provider process rather than an Agent-tool subagent THEN its graphify calls SHALL NOT appear in the count: the activity hook records only `sdd`-prefixed Agent-tool subagents (`harness/hooks/sdd-activity.sh:126-128`), so the `graph` column is scoped to Agent-tool (Anthropic-routed) workers. The spawns column is not scoped the same way: it keys a non-Anthropic role apart with a `@deepseek` suffix (`src/watch/usage.ts:159`) but still counts its real spawns from `spawn.start` events, so a DeepSeek reviewer or checker row prints a non-zero `spawns` count alongside `graph=0`, undercounting that role's graph use in the retrospective comparison.

### Requirement 7 — Docs and verification

**User Story:** As a harness maintainer, I want the docs and the verification to state the graph behaviour, so that the next operator knows what the facts mean and what was proven.

#### Acceptance Criteria

1. The `harness` section of `docs/TOOLS-REFERENCE.md` (`docs/TOOLS-REFERENCE.md:547-579`) SHALL name the three graph values of `brief` and the `graph` column of `usage`.
2. `docs/SDD-HARNESS.md` SHALL state the three launch-prompt lines, the refresh rule and that `graphify-out/` stays untracked.
3. The end-to-end verification SHALL run the decomposition entry's scenarios (1) to (6); WHEN a scenario needs a harness run in a rebuilt and restarted session, or needs a fixture checkout that departs from this repo's `worktree-per-change: required` rule, THEN it SHALL stay `pending` in a tracked `verification-evidence.md` as `agent-rules.md` requires, not close silently.
4. The fixture for scenario (4) SHALL be a checkout whose `agent-rules.md` omits the `worktree-per-change: required` line, so the worktree rule (`harness/skills/sdd-continue/SKILL.md:320-327`) never enters a worktree and an implementer commit lands in a non-worktree `CODE_ROOT` that changes the code graph, moving `built_at_commit` to HEAD; this is the only path where Requirement 2 AC 2 fires (D14), and Requirement 7 AC 3's deferral covers it because it departs from this repo's own worktree rule.

## Non-Functional Requirements

### Performance
- A `query` in any brief carries `--budget 800`; the brief names `explain` first.
- A `graphify update` runs only on the conditions of Requirement 2, with a timeout the design sets.

### Security
- The refresh is `graphify update`, the code-only path: AST extraction and hub-named communities, no LLM call and no key (probe: `codebase-context.md`, section "graph artifacts and graphify CLI").

### Reliability
- A missing graph, a missing binary, a failed or timed-out refresh never stops a run or a phase; the brief and ledger then keep the pre-spec shape (Requirement 1 AC 8, Requirement 3 AC 5).
- The global PreToolUse nudge in `~/.claude` is unchanged.
- A `graphify update` that loses nodes from source files it did not re-extract this run — an interrupted or partial extraction, not an ordinary code deletion — trips the refresh's shrink guard and exits non-zero; because Requirement 2 AC 7 forbids `--force`, Requirement 2 AC 5 then keeps the previous `GRAPH_BEHIND` until a human reruns the update or forces a rebuild outside this spec. A commit that only deletes code does not trip the guard: the guard accounts for the deleted paths and the refresh exits 0.

## Decisions taken in this document

- D1 — A refresh that exits 0 makes the graph current at HEAD: options were trust the exit code and set behind to 0, keep counting from the file's built-at commit, or force a write every time; chosen because the installed graphify leaves an unchanged graph file untouched and keeps the old commit, so the count would show a fresh graph as stale forever (probe in the context file).
- D2 — The brief section's facts come from caller values: options were caller-passed values, the tool reading the graph file and running git itself; chosen because the harness tool reads only the spec store and spawns no process, and the supervisor already runs git.
- D3 — A third launch line carries the built-at commit: options were a separate built-at line, packing the commit into the behind line, orchestrators reading the graph file; chosen because the freshness line names the commit and orchestrators never read the graph.
- D4 — A graph call is one Bash activity row naming explain, query or path: options were those three once per row, every row mentioning graphify, each invocation inside a row; chosen because summaries are cut at 160 characters and a row naming a graphify-out path is a raw read, not a graph call.
- D5 — Graph calls are attributed to a phase by the live-phase window at the row's time: options were the window rule, per agent with no phase, a join through the agent id to its spawn; chosen because the usage fold already applies the window rule to spawns, so the new column lines up with the existing rows.
- D6 — A refresh failure is a ledger note, not a stop: options were note and continue, stop the phase; chosen because the graph is an index, and a stale graph only turns citations into hints.
- D7 — Reviewer and checker prompts get the block through the document skill's text: options were skill text, new reviewer and checker brief templates; chosen because those prompts are appended to the adversarial-review scaffold, not written by the brief action.
- D8 — Graph values missing their freshness fail the brief call: options were fail naming them, fill them as unknown; chosen because it follows the same fail-fast shape as the missing-value rule — a new check, since Requirement 3 AC 7 keeps these values out of the `{{key}}` placeholder set that rule checks — and a silent unknown hides an orchestrator bug.
- D9 — The graph is resolved after the roots step and again after worktree entry, not in preflight: options were after roots, in preflight; chosen because the path depends on the code root and main checkout, which the roots step computes, and the worktree rule changes the code root.
- D10 — The run-start row carries graph keys only when a graph exists: options were keys only with a graph, always with a none value, never; chosen because the no-graph run must keep the pre-spec ledger shape.
- D11 — Live scenarios that need a restarted session are deferred through the evidence file: options were defer the live half as pending evidence, block the PR until a restarted session runs them; chosen because agent-rules requires that route and the previous spec used it.
- D12 — The close-out refresh rule is kept although it does not fire today: options were keep it, drop it; chosen because the decomposition lists it and a change to the close-out landing root would make it fire; today code and harness batches land in a retro worktree.
- D13 — Posture: this spec touches no money, personal data, deletion or legal surface: options were none; chosen because it changes only harness briefs, launch lines and a usage column.
- D14 — The implementation per-task refresh (Requirement 2 AC 2) does not fire under worktree-per-change either, mirroring D12: options were disclose it, widen AC 2 to cover a worktree, update the worktree's graph despite AC 6; chosen because AC 6 forbids a worktree update, so during implementation `GRAPH` stays the main checkout's graph — stale and missing the task's new symbols — and a worker falls back to a cold read for its own edits (Requirement 3 AC 3).

## Scope notes

- Carried from previous phase: none.
- Deferred: spec 11's test-author template does not exist yet; Requirement 3 AC 1 covers it when it is added.
- Not in scope: the retrospective analyst and retrospective orchestrator; the decomposition names drafter to implementer and spec 11's test author only.
- Not in scope, per the decomposition: a graph of the spec store, a change to `.graphifyignore`, a change to the global PreToolUse nudge, an MCP server for graphify, agent frontmatter changes.
- Refinement: the decomposition places the graph fact in supervisor Step 0; this document places it after the roots step (D9) because the roots step computes the paths it needs.
- Refinement: verification scenario (4) is sharpened by Requirement 7 AC 4, because a commit that does not change the graph leaves `built_at_commit` unchanged (D1).
- The graph covers little of `harness/`: 8 of 2,713 nodes, all shell scripts; a worker on a skill file falls back to a normal read (Requirement 3 AC 3).

## Revision History

- **v1** (2026-09-25) — Initial draft.
  - **Lint pass.** 6 fixed (L-2, L-9, L-10, L-15, L-16, L-21); rejected: L-1, L-3, L-4, L-5, L-6, L-7, L-8, L-11, L-12, L-13, L-14, L-17, L-18 (GRAPH/graph/graphBuiltAt/graphBehind are new names this spec proposes, absent from the cited code today), L-19, L-20 (explain/query are content Requirement 5 adds to that section, not there yet), L-22, L-23 (the graph column is new, not in usage.ts or the docs table yet).
- **v2** (2026-09-25) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
  - **R1-1 — Accepted (SHOULD_FIX).** Added a decision disclosing that the implementation per-task refresh also does not fire under worktree-per-change, mirroring the existing close-out decision: during implementation the graph a worker reads stays the main checkout's, missing the task's new symbols. Sharpened the scenario-4 verification fixture to state it runs in a non-worktree checkout, the only path where that refresh fires.
  - **R1-2 — Accepted (SHOULD_FIX).** The run-start refresh condition now pins the update before the run-start ledger row is written, not merely before the first orchestrator spawn, so the run-start row can carry the post-refresh count the run-start requirement expects.
  - **R1-3 — Accepted (SHOULD_FIX).** Added a scoping criterion to the usage requirement: the graph column counts only Agent-tool (Anthropic-routed) workers, since the activity hook logs only sdd-prefixed Agent-tool subagents and a separately-routed provider process leaves no row to count.
  - **R1-4 — Accepted (MINOR).** The usage requirement now states the graph count is folded by joining activity rows to the events-derived phase windows inside the usage action, not inside the pure report-building function.
  - **R1-5 — Accepted (MINOR).** Added a Reliability line: a deletion-heavy commit trips the refresh's shrink guard, which exits non-zero because the no-force rule forbids overriding it, so the graph stays behind HEAD until a manual rebuild.
  - **R1-6 — Accepted (MINOR).** Reworded the brief-failure criterion and its matching decision from claiming to reuse the placeholder-only missing-value rule to being styled on it, since the graph values are exempt from the placeholder set that rule checks.
  - **Lint pass.** 1 fixed (L-22); rejected: L-1, L-2, L-3, L-4, L-5, L-9, L-10, L-11, L-12, L-13, L-14, L-15, L-16, L-17, L-18, L-21 (unchanged; to-be-built artifact, ruled in v1 lint), L-6, L-7, L-8, L-19, L-20 (to-be-built artifact this spec proposes; citation ranges confirmed correct).
- **v3** (2026-09-25) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 2/1/0).
  - **R2-1 — Accepted (MUST_FIX).** The v2 Reliability line wrongly claimed an ordinary code-deletion commit trips the refresh's shrink guard; the installed graphify's guard folds deleted paths into the re-extracted set and only refuses an unexplained loss from a file the run did not touch. Rewrote the line around the real wedge, an interrupted or partial extraction, and stated plainly that a deletion-only commit exits 0 (requirements.md:118).
  - **R2-2 — Accepted (MUST_FIX).** R6 AC8 cited the wrong lines for the `@deepseek` keying and falsely called the spawns and graph columns the same scope. Corrected the citation to the line that keys the agent, and replaced the false-equivalence claim with a statement that a non-Agent-tool role's spawns count stays non-zero while its graph count reads zero, undercounting that role's graph use in the retrospective comparison (requirements.md:93).
  - **R2-3 — Accepted (SHOULD_FIX).** Scenario (4)'s fixture asked for a non-worktree commit without saying how one arises under this repo's mandatory worktree rule, and the docs-and-verification deferral criterion did not cover a worktree-config gap. Pinned the fixture to a checkout whose `agent-rules.md` omits the worktree-per-change line, so the worktree rule never enters a worktree, and widened the deferral criterion to also cover a fixture that departs from that rule (requirements.md:103-104).
  - **Lint pass.** 0 fixed; rejected: L-1 through L-20, L-23 (unchanged; to-be-built artifact, ruled in v1/v2 lint), L-21, L-22, L-24 (to-be-built artifact — the run.start row field, the usage spawns column, the graph-built-at commit field; citation ranges at sdd-activity.sh:126-128, usage.ts:159 and sdd-continue/SKILL.md:320-327 confirmed correct).
