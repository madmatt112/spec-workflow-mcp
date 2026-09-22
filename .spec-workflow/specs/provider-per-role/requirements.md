# Requirements Document — provider-per-role

## Introduction

This spec lets one SDD run send chosen roles to DeepSeek through a child `claude -p` process while every other role and the session itself stay on Anthropic. It is for the harness operator who pays the Max plan limit and wants the most-spawned role off it, and for the orchestrators, whose routing must not change. It adds a `## Providers` section to `agent-rules.md`, a launcher the orchestrator calls instead of the Agent tool for a DeepSeek role, `provider` on the ledger, and provider-split totals in `harness usage` and the watch view.

## Alignment with Product Vision

No `steering/product.md` exists in this store, so alignment is to the harness operations preamble of the decomposition and the efficiency plan's first rule: tokens against the Max plan limit come first (`docs/harness-efficiency-plan.md:8-9`). Routing the reviewer, the most-spawned role per spec, off Anthropic cuts that number without changing a skill's steps. The provider is a per-role, per-run fact the ledger records, so spec 9 can render it and spec 11 can promote its test author with one line.

## Requirements

### Requirement 1 — Provider map in `agent-rules.md`

**User Story:** As the harness operator, I want to name a provider per role in `agent-rules.md`, so that a role moves between Anthropic and DeepSeek with one line and no skill edit.

#### Acceptance Criteria

1. THE spec store's `agent-rules.md` SHALL accept an optional `## Providers` section whose bullets read `- <agent>: <provider> <model>`, where `<agent>` is a harness agent name (`sdd-reviewer`), `<provider>` is `anthropic` or `deepseek`, and `<model>` is `deepseek-v4-pro` or `deepseek-flash`, required for `deepseek` and absent for `anthropic`. WHEN the section is absent or names no agent THEN every role SHALL run on Anthropic as today (D1).
2. THE eligible set for `deepseek` SHALL be `sdd-reviewer` and `sdd-checker` (file tools only: `harness/agents/sdd-reviewer.md:7-12`, `harness/agents/sdd-checker.md:7-12`), plus `sdd-reviser` only after preflight (b) passes (Requirement 6 criterion 4). No other agent SHALL be eligible in this spec.
3. WHEN the section names an agent outside the eligible set, an unknown provider, a `deepseek` row without a listed model, or the same agent twice THEN the supervisor SHALL refuse the run at `run.start` with a `note` naming the offending bullet (the shape of Requirement 4 criterion 2) and SHALL NOT run that role on Anthropic instead (D2).
4. THE supervisor SHALL read the section once, at the roots step where it locates `agent-rules.md` (`harness/skills/sdd-continue/SKILL.md:71-72`), and SHALL record the map on `run.start` as `providers=<agent>:<provider>[:<model>],...` in section order, or `providers=none` when the section is absent or empty (D4).
5. THE orchestrator launch prompt (`harness/skills/sdd-continue/SKILL.md:190-208`) SHALL gain two lines, `PROVIDERS: <the same value>` and `LAUNCHER: <path | none>`, so an orchestrator never re-reads `agent-rules.md` for the map (D9).
6. THE list of machine-read lines (`docs/SDD-HARNESS.md:271-280`) SHALL name `## Providers` as the fifth, with the eligible set and the two model names.
7. THE per-run override from spec 9's `harness-run.json` SHALL NOT be built here; the value format of criterion 4 is the one spec 9 pre-fills (Scope notes).

### Requirement 2 — The launcher: a subprocess spawn path for a DeepSeek role

**User Story:** As the document orchestrator, I want one command that runs a DeepSeek role with the same launch message and returns the same report, so that my steps before and after the spawn are unchanged.

#### Acceptance Criteria

1. WHEN the map names at least one `deepseek` row THEN the supervisor SHALL write `/tmp/scratchpad/sdd/<spec>/launch.sh` next to `event.sh` at run start (`harness/skills/sdd-continue/SKILL.md:76-86`), with the spec dir, run id, spec and the map filled in, and pass its path as `LAUNCHER`; otherwise `LAUNCHER: none`.
2. THE per-run file SHALL carry only run values and SHALL call a launcher body that ships with the harness under `harness/` and is tested the way the hook is (`src/__tests__/hook-spawn-events.test.ts:13-41`) (D3).
3. WHEN an orchestrator is about to spawn an agent that `PROVIDERS` names `deepseek` THEN it SHALL run `bash <LAUNCHER> <agent> "<launch message>"` with the exact launch message it would have given the Agent tool (for the reviewer, `Read and execute the instructions in <promptOutputPath>`, `harness/skills/sdd-document-phase/SKILL.md:160-161`), wait for it in the foreground, and take the worker's final report from stdout.
4. WHEN `PROVIDERS` names a `deepseek` agent and `LAUNCHER` is `none` or the file is missing THEN the orchestrator SHALL report `PHASE: error` with the reason and SHALL NOT spawn that agent through the Agent tool (D2).
5. THE launcher SHALL spawn `claude -p` (installed `2.1.278`; flags per `claude -p --help`) with: the launch message as the prompt; the agent's definition passed with `--agents`, built from the agent file (its frontmatter `tools`, its body as the agent prompt) and `harness/agent-profiles.json` (declared model and effort for the ledger, `harness/agent-profiles.json:47-51`); `--model` set to the map's DeepSeek name; only the agent's frontmatter tools; and no MCP server (`--strict-mcp-config` with no `--mcp-config`) (D10).
6. THE child's environment SHALL carry `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`, `ANTHROPIC_AUTH_TOKEN` set from `DEEPSEEK_API_KEY`, and `ANTHROPIC_MODEL` set to the same DeepSeek name; it SHALL NOT carry `ANTHROPIC_API_KEY` (Requirement 4 criterion 4).
7. THE child SHALL never wait on a permission prompt (one that would block is denied, `--permission-prompts none`) and SHALL read the spec store and write under `reviews/` from a worktree cwd, where the spec store sits in the main checkout (`harness/skills/sdd-continue/SKILL.md:63-67`; `--add-dir`).
8. THE launcher SHALL exit 0 with the report on stdout when the child ends with a final message, and non-zero with one stderr line otherwise; the orchestrator's stall rule then applies unchanged (missing analysis file: spawn once more, then `PHASE: error`, `harness/skills/sdd-document-phase/SKILL.md:162-164`).
9. THE orchestrator SHALL write `spawn.usage` after a launcher call exactly as after an Agent-tool call (`harness/skills/sdd-document-phase/SKILL.md:44-52`), and SHALL read the verdict block or the `VERIFIED:` line from the analysis file as today; nothing after the spawn changes.
10. THE agent file and the skill that say spawn workers only with the Agent tool (`harness/agents/sdd-document-orchestrator.md:50`, `harness/skills/sdd-document-phase/SKILL.md:23-27`) SHALL say: with the Agent tool, or with `LAUNCHER` for an agent `PROVIDERS` names `deepseek`; a `model` parameter is still never passed to the Agent tool.
11. THE DeepSeek worker SHALL receive the same launch message, the same tools and the same report contract (`harness/skills/sdd-continue/references/formats.md:123-135`) as an Agent-tool worker, so moving a role back is one line in `## Providers`.

### Requirement 3 — Ledger rows for a DeepSeek spawn

**User Story:** As the operator watching a run, I want a DeepSeek spawn in the ledger with its provider, model and usage, so that the views tell the two providers apart.

#### Acceptance Criteria

1. WHEN the launcher starts the child THEN it SHALL append `spawn.start` to `harness-events.jsonl` with `run`, `spec`, `agent`, `role` (the agent name without `sdd-`, the value the orchestrator's `spawn.usage` uses today, `.spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:105`), `provider=deepseek`, `model=<requested DeepSeek name>` and `effort=not-applied` (D4, D11).
2. WHEN the child exits THEN the launcher SHALL append `spawn.end` with `agent`, `provider=deepseek`, `model` (the `message.model` values seen in the child's transcript, joined with `+`) and `input`, `output`, `cacheWrite`, `cacheRead`, `tokens` summed over the transcript's assistant entries by the hook's rule (`harness/hooks/sdd-activity.sh:37-49`); a transcript it cannot find or parse SHALL yield `tokens=unknown` and no usage keys, never a missing row (`harness/hooks/sdd-activity.sh:114-123`).
3. THE launcher SHALL locate the child's transcript deterministically (the design names the mechanism; `--session-id <uuid>` and `~/.claude/projects/<cwd slug>/<session id>.jsonl` are the probed inputs), never as the newest file in a directory.
4. THE two rows SHALL be written through the run's event script mechanism (`harness/skills/sdd-continue/references/formats.md:163-182`), with string values and the `run` and `spec` keys of every row, and exactly one `spawn.start` and one `spawn.end` per launcher call; the child's own hooks SHALL add nothing to the run's ledger or activity file (`harness/hooks/sdd-activity.sh:14-17` gates on an `sdd-` agent type; the preflight proves it for the child, else the design disables hooks there).
5. THE Anthropic spawn rows SHALL NOT change: no `provider` key is added to them, and a row without `provider` reads as `anthropic` in every consumer (Requirement 5).
6. THE event table (`harness/skills/sdd-continue/references/formats.md:186-198`) SHALL list the launcher as a writer of `spawn.start` and `spawn.end`, the keys `provider`, `model` and `effort`, and `providers` on `run.start`.

### Requirement 4 — The key, and refusal without it

**User Story:** As the operator, I want the DeepSeek key read from my environment only and a run that stops when it is missing, so that no key lands in the spec store and no role runs on the wrong provider by accident.

#### Acceptance Criteria

1. THE key SHALL be `DEEPSEEK_API_KEY` in the environment of the process that starts the run (terminal or dashboard), never read from the spec store, a run file, `agent-rules.md` or a launch prompt.
2. WHEN the map names a `deepseek` role and `DEEPSEEK_API_KEY` is unset or empty THEN the supervisor SHALL write `run.start` (with `providers`), then `note text="deepseek: <agent> needs DEEPSEEK_API_KEY; not set"`, then `run.end` with a status line naming the role and the missing key, deregister, and stop; it SHALL spawn no orchestrator (D5).
3. THE launcher SHALL also refuse (non-zero, one stderr line, no `spawn.start`) when called with the key unset, so a stale launcher cannot run on a missing key.
4. THE key SHALL NOT appear in the launcher text, any ledger or activity row, HANDOFF, the retro log, `questions.md`, a brief, or a commit; the child's environment SHALL NOT carry `ANTHROPIC_API_KEY`; and preflight (a) SHALL show the session's Anthropic credential was not used (the child's transcript `message.model` is a DeepSeek name).
5. WHEN the key is set THEN the run SHALL NOT print it, and the watch view and `harness usage` SHALL NOT read it.

### Requirement 5 — Accounting by provider

**User Story:** As the operator judging the saving, I want `harness usage` and the watch view to show DeepSeek tokens apart from the Anthropic total, so that the number the Max plan limit applies to stays honest.

#### Acceptance Criteria

1. THE usage fold (`src/watch/usage.ts:76-216`) SHALL take a spawn's provider from the `provider` key of its `spawn.end`, else its `spawn.start`, else `anthropic`.
2. THE report (`src/watch/usage.ts:13-23`) SHALL add per-provider cells (`spawns`, `tokens`, `unknown`) at the spec level and per phase; the existing `total` and `kinds` fields SHALL keep their all-provider meaning and values (D6).
3. WHEN the table is printed (`src/watch/usage.ts:253-298`) THEN each agent row SHALL name its provider when it is not `anthropic`, and each phase total line and the spec total line SHALL print `anthropic <tokens>` and `deepseek <tokens>` beside the existing figures; in compare mode both specs SHALL carry the same columns.
4. WHEN `harness usage` runs on a ledger with no `provider` key (`src/__tests__/fixtures/usage-ledger.jsonl:1-20`, `question-gates`) THEN every existing figure SHALL be unchanged and the `deepseek` figures SHALL read 0; `data.report` SHALL carry the provider cells.
5. THE watch model (`src/watch/ledger.ts:94-114`, `src/watch/ledger.ts:142-163`) SHALL carry `provider` per spawn node and tokens by provider on the run; the header (`src/watch/render.ts:67-79`) SHALL print `tokens <Anthropic total>` and, when DeepSeek tokens exist, `deepseek <total>` after it; the tier line (`src/watch/render.ts:204-211`) SHALL print the provider before the actual model for a non-Anthropic spawn; the `!=` mark fires as today.
6. WHEN `--watch --once` runs on the `review-gate` ledger THEN it SHALL render every token total it renders today (the spec 8 regression, kept).
7. WHEN `run.start` carries a `providers` value other than `none` THEN the watch view SHALL show it.
8. THE docs (`docs/TOOLS-REFERENCE.md:574-577`, `docs/SDD-HARNESS.md:330-333`) SHALL say the usage is split by provider and the Anthropic figure is the Max plan number.

### Requirement 6 — Preflight recorded in `docs/`

**User Story:** As the operator, I want the DeepSeek facts this spec depends on proven once and written down, so that the launcher is built on tested behaviour and the reviser's eligibility is a recorded answer.

#### Acceptance Criteria

1. THE first task of the spec SHALL be the preflight, and its outcomes SHALL be written to `docs/deepseek-preflight.md` in the step-0 answer format (`docs/step-0-answers.md:1-17`): date, source, a summary table, one section per question with the evidence (D7).
2. THE preflight SHALL run (a): `claude -p` against DeepSeek with the reviewer's definition, `--model deepseek-v4-pro` and the environment of Requirement 2 criterion 6, on a fixture spec document with a review prompt built as the round section is (`harness/skills/sdd-document-phase/references/briefs.md:125-176`); it passes WHEN the analysis file exists in the review prompt's format and ends with the verdict block (`harness/skills/sdd-continue/references/formats.md:5-17`); the record SHALL include the transcript's `message.model` and the usage sums.
3. THE preflight SHALL run (b): the same with the reviser's definition, one `--mcp-config` for the spec-workflow server, and a prompt that makes one `adversarial-response` call (`harness/skills/sdd-document-phase/references/briefs.md:225`); the record SHALL say whether the call was made and answered and, on failure, whether the refusal came from the API connector or from Claude Code's client tools.
4. IF (b) shows the MCP call answered THEN `sdd-reviser` SHALL join the eligible set (Requirement 1 criterion 2) in this spec; IF not THEN it SHALL stay on Anthropic, and no other role SHALL be promoted here.
5. THE preflight SHALL also record, with one line of evidence each: whether `ANTHROPIC_AUTH_TOKEN` alone authenticates the child (no `ANTHROPIC_API_KEY`, no OAuth); whether `--agents` accepts `tools` and `model` keys; where the child's transcript lands and whether `--session-id` fixes its name; whether the user's hooks fire in the child and write to the run's files; and whether the declared `effort` reaches DeepSeek (expected ignored, per the decomposition preamble) (D7).
6. IF (a) fails THEN the preflight task SHALL record it and the implementation orchestrator SHALL report `PHASE: escalate` with the reason; no later task of this spec SHALL run until a human rules (D8).
7. IF `DEEPSEEK_API_KEY` is unset when the preflight runs THEN the task SHALL report the missing key and stop; it SHALL NOT record a fabricated outcome.

### Requirement 7 — End-to-end verification and regression

**User Story:** As the operator, I want the decomposition's six scenarios runnable as written, so that the spec is judged on its ledger, not on a report.

#### Acceptance Criteria

1. WHEN a fixture requirements round runs with `sdd-reviewer` on `deepseek-v4-pro` THEN the analysis file SHALL exist in the round's format with a verdict block; the ledger SHALL hold its `spawn.start` and `spawn.end` with `provider=deepseek`, a DeepSeek model name and digit-string usage; and the reviser round that follows SHALL run on Anthropic through the Agent tool with the hook-written rows of today.
2. WHEN the same round runs with every role on `anthropic` THEN the ledger SHALL have today's shape: no `provider` key on any spawn row, and `run.start` gaining only `providers`.
3. WHEN `DEEPSEEK_API_KEY` is unset and the map names one `deepseek` role THEN the run SHALL stop as Requirement 4 criterion 2 says, and `--watch --once` SHALL show the stopped status and no spawn (spec 9's page is not built; Scope notes).
4. WHEN `harness usage` runs on the ledger of criterion 1 THEN it SHALL report the reviewer's tokens under `deepseek` and an Anthropic total that excludes them.
5. THE checks SHALL pass: `npm test`, `npx tsc --noEmit`, `claude plugin validate . --strict`, `npm run check:plugin-assets`; a launcher test SHALL assert only on `child_process` and `fs` fields the node 20 docs guarantee (`.spec-workflow/agent-rules.md:30-32`).

## Non-Functional Requirements

### Performance
- An Anthropic spawn SHALL cost nothing new: no launcher call, no extra ledger row, and the hook's early exit (`harness/hooks/sdd-activity.sh:11-17`) unchanged.
- `harness usage` and the watch view SHALL stay synchronous folds of the two files; no network call.

### Security
- Requirement 4 holds for every file the run commits. `harness/hooks/` is a sensitive path (`.spec-workflow/agent-rules.md:61-70`); the design says where the launcher body goes.
- The child SHALL have the eligible role's file tools only and no MCP server, so it cannot write approvals, deferrals or the spec store through a tool.

### Reliability
- A DeepSeek spawn SHALL always leave a `spawn.end`; `unknown` beats a wrong number (the spec 8 rule).
- Refusal beats a silent fallback: a missing key, a missing launcher or a bad map row stops the run with a `note`.
- The session that runs the harness SHALL never have its provider changed; the child is the only process with the DeepSeek environment.

### Compatibility
- Old ledgers render and fold unchanged. CI runs node 20 (`.spec-workflow/agent-rules.md:30-32`). `plugins/` copies are regenerated by `scripts/sync-plugin-assets.cjs`, and `harness/agent-profiles.json` keeps its shape.

## Decisions taken in this document

- D1 — Map shape: a Providers section in agent-rules with one bullet per agent naming provider and model; options were a top-of-file key like the gates key, a YAML block, or a provider field in each agent's frontmatter; chosen because it matches the four machine-read sections already there, and an agent's frontmatter is shared by every run and every project.
- D2 — A bad map row, an ineligible role, a missing key or a missing launcher refuses the run with a note; options were ignore the row with a note, fall back to Anthropic for that role, or refuse; chosen because the decomposition rules out a silent fallback and a wrong provider spends the Max plan without saying so.
- D3 — The launcher is a per-run wrapper next to the event script that calls a body shipped with the harness and tested like the hook; options were the whole script written by the supervisor each run from the formats reference, or a server action; chosen because the body is real logic that needs a test, and the wrapper keeps the decomposition's contract of a file next to the event script.
- D4 — Ledger keys: provider, model and effort on spawn start; provider, model and the six usage keys on spawn end; run start carries the whole map; options were provider on spawn end only, or a new event type; chosen because both folds already read those rows, and the map on run start is what spec 9 renders.
- D5 — A refused run writes run start, a note and run end and spawns nothing; options were stopping before any ledger row, or a run start with a refused status; chosen because the ledger and the watch view then show why the run stopped.
- D6 — The Anthropic figure is the headline tokens number and DeepSeek is shown beside it, while the existing all-provider totals keep their values in the data; options were dropping DeepSeek from every total, or a provider filter parameter; chosen because the Max plan number must be the one the eye lands on while nothing an existing test asserts changes.
- D7 — The preflight file is a new docs file in the step-0 answer format and carries five extra probes the design needs (auth path, agents JSON keys, transcript location, hooks in the child, effort); options were appending to the step-0 file, or a HANDOFF row; chosen because the step-0 file is closed and says do not re-run, and the extra probes are the facts the launcher is built on.
- D8 — A failed preflight (a) escalates and blocks the rest of the spec; options were continuing with the Anthropic-only parts, or deferring the whole spec; chosen because every other deliverable exists to serve the DeepSeek path.
- D9 — The launch prompt carries the map and the launcher path; options were each orchestrator re-reading agent-rules; chosen because the supervisor is the single reader of run configuration and skills never parse it twice.
- D10 — The child gets the agent's frontmatter tools only and no MCP server; options were inheriting the session's MCP configuration; chosen because the eligible roles are file-tools-only by definition, and the spec store keeps one writer.
- D11 — The role value on a launcher spawn start is the agent name without its prefix; options were the prompt filename stem as the hook does for briefs, or no role; chosen because the reviewer and checker are prompt-launched and the orchestrator's usage row already uses that value, so the watch view joins by the same label.

## Scope notes

- The spec 9 per-run override (`harness-run.json`) is deferred to spec 9 as the entry says; this spec fixes the map value format spec 9 pre-fills.
- Verification (4) names "the page"; that is spec 9's control pane, not built yet. Here the check is the TUI (`--watch --once`).
- Only the reviewer and checker are promoted; the reviser only on a passed preflight (b); no other role.
- Not fixed here: an Anthropic prompt-launched reviewer or checker still gets no hook `spawn.start` (`harness/hooks/sdd-activity.sh:106-113` matches brief filenames only; live rows `.spec-workflow/specs/harness-usage-and-tiers/harness-events.jsonl:104-105`), so both folds drop its `spawn.end` usage (`src/watch/usage.ts:93-100`, `src/watch/ledger.ts:276-288`). The launcher writes both rows, so a DeepSeek spawn is unaffected. Flagged for the retro.
- `steering/product.md` does not exist; alignment is written to the decomposition preamble and the efficiency plan.
- DeepSeek endpoint facts (model mapping, `budget_tokens` ignored, MCP tools unsupported) are taken from the decomposition preamble's settled list and not re-probed; the preflight measures behaviour, not the docs.

## Revision History

- **v1** (2026-09-21) — Initial draft.
