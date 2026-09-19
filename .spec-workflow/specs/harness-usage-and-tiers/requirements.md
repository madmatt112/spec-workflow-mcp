# Requirements Document

## Introduction

The harness ledger (`harness-events.jsonl`) cannot say what a spawn cost or which model it ran on: per-spawn `tokens` are whatever an orchestrator transcribed from the Agent result footer (most rows on this store say `unknown`, `na` or `0`), and the watch view's model and effort columns come from a hand-kept table in `src/watch/ledger.ts:41-53` that disagrees with the agent files. This spec makes the plugin hook the single writer of per-spawn usage, read from the worker's transcript; generates the declared tiers from the agent frontmatter; adds a `usage` report to the `harness` tool; and brings the docs and the ledger view in line with the orchestrator tier change already in the agent files. It serves the supervisor, the retro analyst and the human who sets tiers, and it is the number source specs 9 and 10 are judged on.

## Alignment with Product Vision

`.spec-workflow/steering/` holds no `product.md` on this store, so alignment is taken from the efficiency plan's rules and its step 4 (`docs/harness-efficiency-plan.md:11-18`, `:160-177`): keep the ledger and `--watch`, measure in tokens, and cut where the numbers say to. The step-4 measurement prompt becomes a tool the harness runs on any spec. After this spec every spend number the harness reports is one the hook measured, not one an LLM transcribed.

## Requirements

### Requirement 1 — Usage from the transcript

**User Story:** As the supervisor, I want every `spawn.end` row to carry the spawn's token usage and actual model, so that the ledger states what each spawn cost without an LLM transcribing a footer.

#### Acceptance Criteria

1. WHEN `SubagentStop` fires for an agent whose type matches `(^|:)sdd-` (`harness/hooks/sdd-activity.sh:37`) AND the active-run pointer resolves (`:11-27`) THEN the hook SHALL append one `spawn.end` row carrying `ts`, `type`, `run`, `spec`, `agent` and the keys of criterion 2 — for every `sdd-*` agent, orchestrators included (`:83-85` skips names ending `-orchestrator` today).
2. WHEN the hook input carries `transcript_path` AND the file parses THEN the row SHALL carry `input`, `output`, `cacheWrite`, `cacheRead` as the sums of `message.usage.input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens` over the transcript's entries with `type` `assistant` and a `message.usage` object; `tokens` as the sum of those four; and `model` as the distinct `message.model` values seen, first-seen order, joined with `+` (D3).
3. Numeric values SHALL be written as JSON strings of decimal digits, the `LedgerEvent` value type (`src/watch/ledger.ts:14-20`); `buildModel` (`src/watch/ledger.ts:188`) already coerces `tokens` with `Number` (`:245`).
4. IF `transcript_path` is absent, the file is unreadable, or no assistant entry carries `message.usage` THEN the row SHALL still be written, with `tokens=unknown` and without `input`, `output`, `cacheWrite`, `cacheRead`, `model` — never a missing row.
5. A transcript line that is not JSON SHALL be skipped, as `parseJsonl` skips a torn tail (`src/watch/ledger.ts:129-142`).
6. The hook SHALL exit 0 in every path and finish inside the 5-second `timeout` of `harness/hooks/hooks.json` for a 2 MB transcript (probe: 1.87 MB, 586 lines, 240 assistant entries, parsed in 16.7 ms on node 24.13.0); no parse failure SHALL delay or block the agent's stop.
7. The `agent.stop` line in `harness-activity.jsonl` (`harness/hooks/sdd-activity.sh:63-65`, `:69`) SHALL keep its shape and MAY carry the same `tokens`.
8. `src/__tests__/hook-spawn-events.test.ts` SHALL drive the real script with a fixture transcript and a `SubagentStop` payload carrying `transcript_path`, and assert each sum against a value the test computes on its own; the case at `src/__tests__/hook-spawn-events.test.ts:110-116` (no `spawn.end` for an orchestrator) SHALL invert.
9. The only per-spawn token writer SHALL be this hook: no skill, agent or script writes `tokens` on any ledger row after this spec.

### Requirement 2 — Orchestrators and the supervisor stop transcribing the footer

**User Story:** As an orchestrator, I want to record only what I know (role and result), so that no count in the ledger comes from an LLM reading a footer.

#### Acceptance Criteria

1. The worker `spawn.usage` row an orchestrator writes SHALL keep `agent`, `role`, `result`, `phase`, and `task` or `round`, and SHALL NOT carry `tokens`.
2. Every passage that tells an orchestrator to take `tokens=<n>` from the Agent result SHALL be rewritten to drop it: `harness/skills/sdd-document-phase/SKILL.md:46-48`, `:114-116`, `:144`; `harness/skills/sdd-implementation-phase/SKILL.md:53-57`; `harness/skills/sdd-closeout-phase/SKILL.md:46-49`; `harness/skills/sdd-retrospective/SKILL.md:33-39`; `harness/skills/sdd-continue/SKILL.md:213-216`; the `spawn.end` and `spawn.usage` rows of the event table, `harness/skills/sdd-continue/references/formats.md:193-194`; and the supervisor note at `harness/skills/sdd-continue/references/formats.md:200-201`. The command that finds every member: `grep -rn "footer\|tokens=" harness/skills`.
3. The supervisor SHALL keep writing `spawn.start` for each orchestrator (`harness/skills/sdd-continue/SKILL.md:213-214`; the hook derives `spawn.start` from a brief path, `harness/hooks/sdd-activity.sh:78`, and an orchestrator launch has none) and SHALL write `spawn.usage` (`agent`, `role`, `result`) after the report in place of `spawn.end` (D1).
4. The retro orchestrator SHALL keep `spawn.start` for the analyst (prompt-launched, `harness/skills/sdd-retrospective/SKILL.md:79-87`) and SHALL write `spawn.usage` in place of `spawn.end` (D2).
5. `harness/skills/sdd-continue/references/formats.md` SHALL list the six usage keys on `spawn.end` as hook-written and state that `spawn.usage` carries no `tokens`.

### Requirement 3 — Declared tiers generated from the agent files

**User Story:** As the person who watches a run, I want the declared model and effort to come from the agent files, so that the view never disagrees with them.

#### Acceptance Criteria

1. WHEN `node scripts/sync-plugin-assets.cjs` runs THEN it SHALL write `harness/agent-profiles.json`: one entry per file under `harness/agents/`, keyed by frontmatter `name`, with `model`, `effort` and a one-line `role` (design fixes the derivation from `description`), sorted by key, byte-identical on repeated runs.
2. WHEN it runs with `--check` THEN it SHALL exit 1 naming `harness/agent-profiles.json` if that file differs from what it would write, as it does for plugin drift (`scripts/sync-plugin-assets.cjs:86-91`, `:102-105`), so CI's `check:plugin-assets` (`.github/workflows/ci.yml:30`) catches a frontmatter edit without a regenerated file.
3. `src/watch/ledger.ts` SHALL drop the literal `AGENT_PROFILES` (`src/watch/ledger.ts:40-53`) and expose profiles read from the generated file under the same `AgentProfile` shape (`src/watch/ledger.ts:34-38`), the full model id kept (`claude-opus-4-8`, not `opus-4-8`).
4. The published package (`package.json` `files`: `dist/**/*`, `README.md`, `CHANGELOG.md`, `LICENSE`) SHALL carry the profiles, so `npx ... --watch` on another machine shows declared tiers (D4).
5. IF the profiles file is missing or malformed at run time THEN the view SHALL render with empty model and effort columns, as `src/watch/render.ts:203` already does for an agent absent from the table, and never fail.
6. The profiles SHALL cover all twelve agents, `sdd-checker` included.
7. `scripts/copy-static.cjs` SHALL copy `harness/agent-profiles.json` to `dist/agent-profiles.json` beside its markdown/locales copies (`scripts/copy-static.cjs:45-61`), so the published package (`files: dist/**/*`) carries it (D4). `src/watch/ledger.ts` SHALL resolve it relative to its own module (`import.meta.url`, `src/core/workspace-initializer.ts:9`): the dist copy one level up, else `harness/agent-profiles.json` two levels up, so `vitest` (Req 4.6) and a built module both find it; else criterion 5's empty table.

### Requirement 4 — Watch view shows declared beside actual

**User Story:** As the person who watches a run, I want to see the model a spawn actually ran on beside the one its file declares, so that a substitution is visible.

#### Acceptance Criteria

1. `SpawnNode` (`src/watch/ledger.ts:63-78`) SHALL gain optional `model`, `input`, `output`, `cacheWrite`, `cacheRead`, read off the paired `spawn.end` row (`:240-247`).
2. WHEN an agent line is rendered (`src/watch/render.ts:180-211`) THEN it SHALL show the declared model and effort from the profiles and, when the node carries `model`, the actual model beside them.
3. IF the actual model differs from the declared model THEN the line SHALL carry a visible mark (design picks it); IF the node carries no `model` THEN the actual column is blank.
4. The header total (`src/watch/render.ts:79`, `src/watch/ledger.ts:316`) SHALL keep summing `tokens` per spawn, cache reads included; the split by kind lives in Requirement 5 (D10).
5. WHEN `--watch --once` runs on the fixture ledger of Requirement 5.8 THEN an orchestrator row SHALL show declared `claude-opus-4-8 high` and actual `claude-opus-4-8`.
6. `src/watch/__tests__/render.test.ts:53` and `:56`, which assert `fable-5-1 xhigh` for the orchestrator and `opus-4-8 xhigh` for the implementer from the hand-kept table, SHALL be updated to the generated profiles.
7. The fixed-width layout at `src/watch/render.ts:202-203` (46-char role slack, 11-char model column) SHALL be re-budgeted before criterion 2 ships: the longest declared id is 16 characters (`claude-fable-5-1`, Req 3.3) and `padRight` does not truncate. Design owns the new widths; this criterion pins the full rendered line — indent, agent, both model columns, effort, role, duration, badge, tokens — fitting within 80 columns without wrapping.

### Requirement 5 — Usage report

**User Story:** As the retro analyst, I want a tokens-by-phase-and-agent table for one spec or two, so that step 4 of the efficiency plan is a tool call and not a prompt.

#### Acceptance Criteria

1. The `harness` tool (`src/tools/harness.ts:27-101`) SHALL gain action `usage` in the enum (`:46`) and dispatch (`:109-120`); it SHALL read only `harness-events.jsonl` under the resolved spec store through `PathUtils.safeJoin`, as `phase-log` does (`:673-683`), and spawn no process.
2. WHEN called with `specName` THEN it SHALL return one table: a row per phase in `PHASE_ORDER` (`src/watch/render.ts:60`, a non-exported `const` the tool SHALL export or duplicate, since `harness.ts` is a separate module) followed by any other phase label; per phase and per agent the token sum and spawn count; per phase a total, the orchestrator share (`orchestrator tokens / phase tokens`; orchestrator = agent name ending `-orchestrator`, `src/watch/ledger.ts:238`), and the `input`, `output`, `cacheWrite`, `cacheRead` sums over the spawns that carry them; and a spec total row.
3. WHEN called with a second spec, an optional parameter `compareSpecName` (`src/tools/harness.ts:49-92`; `:95` bars unnamed ones) (D12), THEN it SHALL return both tables side by side in the same row and column order, plus a per-phase delta of tokens and spawns.
4. A spawn is identified by its `spawn.start` row; when the agent has none, an otherwise-unclaimed `spawn.usage` row (or a digit-carrying `spawn.end` row) SHALL count as its own spawn — the synthesis `buildModel`'s fold performs today for a start-less worker (`src/watch/ledger.ts:275-290`); in question-gates, `sdd-reviewer` (no `spawn.start`, seven numeric `spawn.usage` rows) and `sdd-checker` (no `spawn.start`, two numeric `spawn.usage` rows) each get one spawn per numeric `spawn.usage` row; a start-less `spawn.end` with no digits carries no spawn on its own. Every `spawn.end` or `spawn.usage` row for an agent with a `spawn.start`, up to its next `spawn.start`, closes that spawn and SHALL count once, however many closing rows it has (Req 5.9's analyst: one `spawn.start`, two `spawn.end`, one spawn). Per spawn, `tokens` SHALL come from a `spawn.end` row carrying a digit string; when none on the spawn does, `tokens` SHALL come from a `spawn.usage` digit string instead, as `buildModel`'s fold already reads (`:266`, `:271`) — the source for `sdd-drafter`, `sdd-reviser` and `sdd-implementer`, whose digit-less `spawn.end` leaves the tokens on `spawn.usage`. `spawn.end` wins over `spawn.usage` when both carry one (Req 7.2), and the later `spawn.end` wins between two (the analyst: 45,675 at 01:10:49). A spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no tokens; such a cell prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source row says so. This is the report's own algorithm over every run (criterion 5): it adopts `buildModel`'s fold behaviours — the `spawn.usage` token fallback and the start-less synthesis (`src/watch/ledger.ts:250-291`) — but not its last-run scope (`:200-202`) or its first-closing-row pairing (`:241`).
5. The report SHALL cover every run in the ledger, not only the last `run.start` (D5): `question-gates` carries rows of `run-20260916-225339` with no `run.start`, and `buildModel`'s last-run scope (`src/watch/ledger.ts:200-202`) drops 6 numeric rows, 732,073 tokens, plus the analyst's second `spawn.end` criterion 4 counts (45,675, `1,185,572` shown against `1,963,320` in the file). The header SHALL state the run count.
6. A spawn's phase SHALL be the `phase` key of its `spawn.start` or folded `spawn.usage`; else the phase whose `phase.start`-to-`phase.end` window holds the spawn's start; else `unknown` (D6).
7. The response SHALL carry the table as text in `message` and the same numbers in `data` (D7).
8. `src/tools/__tests__/harness.test.ts` SHALL cover: one spec; two specs; an unknown cell; an old ledger (`spawn.end` with `tokens`, `review-gate` shape); a new ledger (hook rows with the six keys); the all-runs scope. A fixture ledger in that shape SHALL be committed under `src/` for the verification scenario.
9. WHEN run on the `question-gates` ledger THEN the spec total SHALL equal 1,963,320 plus nothing (the sum of its 23 digit-string rows), with `unknown` marks on the cells of its 14 `unknown`, `na` and `0` rows.
10. `docs/TOOLS-REFERENCE.md:547-570` SHALL document `usage` and `gate` (it lists three actions today).

### Requirement 6 — The tier change, recorded and consistent

**User Story:** As the human who sets tiers, I want the agent files, the generated profiles, the plugin copies and the docs to agree, so that one place says what runs on what.

#### Acceptance Criteria

1. The agent files SHALL declare: the four orchestrators and `sdd-retro-analyst` `claude-opus-4-8` / `high` (landed at commit 599bdca on 2026-09-18, `harness/agents/sdd-document-orchestrator.md:4-5` and the other four); `sdd-drafter`, `sdd-adjudicator` `claude-fable-5-1` / `xhigh`; `sdd-reviewer`, `sdd-implementer`, `sdd-verifier` `claude-opus-4-8` / `xhigh`; `sdd-reviser`, `sdd-checker` `claude-sonnet-5` / `high`. This spec changes no agent file (D9).
2. `docs/SDD-HARNESS.md:284-298` (model policy, groups the supervisor with the orchestrators and analyst as Fable xhigh) SHALL match the agent files and name `harness/agent-profiles.json` as the generated source for the orchestrators, the analyst and the workers; the supervisor has no agent file and is outside the generated profiles (Scope notes), so its row SHALL be described separately; `:325-328` SHALL say the hook measures tokens from the transcript.
3. `npm run check:plugin-assets` and `claude plugin validate . --strict` SHALL pass with the agent files, the `plugins/` copies and `agent-profiles.json` in agreement.
4. This document SHALL NOT specify a second cut (Sonnet for an orchestrator); that choice SHALL wait for a retro decision after one measured spec.

### Requirement 7 — Old ledgers keep rendering

**User Story:** As the person who compares specs, I want ledgers written before this spec to render and sum as they do today, so that the baseline survives.

#### Acceptance Criteria

1. WHEN `--watch --once` runs on the `review-gate` ledger THEN it SHALL print `tokens 6.3M` (`tokensTotal` 6,324,447 over 59 spawns, every `spawn.end` carrying a digit string) and the same per-spawn tokens as before this spec.
2. IF a spawn has both a `spawn.end` with a digit-string `tokens` and a folded `spawn.usage` with `tokens` THEN the `spawn.end` value SHALL win (the fold at `src/watch/ledger.ts:271` overrides it today; no ledger on this store has both).
3. `spawn.usage` rows that carry `tokens` SHALL still be summed when no `spawn.end` on the same spawn carries them (`question-gates` shape).
4. `src/watch/__tests__/ledger.test.ts:169-226` SHALL pass unchanged, with one added case for a hook row carrying the six keys.

## Non-Functional Requirements

### Performance
- The hook reads the transcript once, in the inline node it already runs, with no dependency beyond `fs`; it stays inside the 5-second hook timeout on a 2 MB transcript (Requirement 1.6).
- `harness usage` reads each ledger once; a 300-row ledger returns in under one second.

### Reliability
- The hook never exits non-zero and never omits the `spawn.end` row; every failure degrades to `tokens=unknown`.
- A missing or malformed `agent-profiles.json` never fails `--watch` or the server.

### Security
- The hook reads only the path the hook payload names and writes only under the spec directory the pointer file resolved (`harness/hooks/sdd-activity.sh:19-31`); `usage` reads only under the spec store through `safeJoin`.

### Compatibility
- CI runs node 20 (`.github/workflows/ci.yml:20`); the hook test asserts only on the JSON lines the script appends (`src/__tests__/hook-spawn-events.test.ts:9-11`).
- `harness/hooks/` is a sensitive path (`.spec-workflow/agent-rules.md`); the hook change is high risk at the review gate.

## Decisions taken in this document

- D1 — The supervisor writes `spawn.usage` (`agent`, `role`, `result`) for an orchestrator, and the hook writes the orchestrator's `spawn.end`: options were keep the supervisor's `spawn.end` and have the hook skip orchestrators (no orchestrator usage, against the entry), both write `spawn.end` (the second row finds no open node at `src/watch/ledger.ts:241` and its `result` is lost), or the supervisor switches to `spawn.usage`; chosen because one writer per row type is the rule workers already follow.
- D2 — The retro orchestrator keeps `spawn.start` for the analyst and writes `spawn.usage` instead of `spawn.end`: options were leave it (a duplicate `spawn.end` per analyst run) or brief-launch the analyst so the hook writes both rows; chosen because the analyst's launch prompt is not this spec's concern.
- D3 — `model` is the distinct `message.model` values in first-seen order joined with `+`: options were the last entry's model, the most frequent, or all distinct; chosen because a mid-spawn substitution must show, not hide (every probed transcript had one value).
- D4 — The profiles ship inside `dist/` and `ledger.ts` resolves them relative to its own module, empty table on absence: options were import through `resolveJsonModule` from `harness/` (outside `rootDir: ./src`, `tsconfig.json:8`), read from the working directory, or copy at build; chosen because `npx` users have only `dist/**`.
- D5 — `usage` sums every run in a ledger: options were the last run as `--watch` does, one table per run, or all runs flat; chosen because `question-gates` loses 777,748 tokens under the last-run scope.
- D6 — Phase attribution: `phase` key, then the live-phase window at spawn start, then `unknown`: options were key only (every hook `spawn.start` lacks it), window only, or key then window; chosen because the key is exact when present and the window covers hook rows.
- D7 — `usage` returns text in `message` and numbers in `data`: options were text only or JSON only; chosen because an orchestrator reads the text and spec 9 reads the data.
- D8 — An unknown spawn shows as `<sum> (+n unknown)` in its cell: options were print `unknown` for the whole cell or drop the spawn; chosen because the spawn count stays honest and the known sum stays usable.
- D9 — The tier change is verified and documented, not re-applied: options were re-edit the five agent files or treat 599bdca as the delivery; chosen because the files already say Opus 4.8 high and the docs and the ledger table are what still disagree.
- D10 — The `--watch` header keeps one total; the kind split is only in `usage`: options were add cache columns to the TUI or keep it; chosen because the TUI has no room and spec 9 renders `RunModel` in a pane.
- D11 — Actual effort is not captured, though transcript entries carry `effort`: options were add it to `spawn.end` or leave it; chosen because the entry names `model` only and `effort` cannot be overridden per spawn.
- D12 — Two-spec comparison takes one optional second spec, not a list: options were an array or a pair; chosen because the entry says "two specs side by side".

## Scope notes

- The tier change (entry item 4) landed before this spec at commit 599bdca; this spec verifies it, generates the profiles from it and fixes `docs/SDD-HARNESS.md:284-298`. Nothing cut.
- The step-4 prompt's other columns (`docs/harness-efficiency-plan.md:164-167`: minutes, review rounds per document, verifier spawns skipped by the gate) are not in the entry's `usage` and are not delivered; `round` and `note` rows stay in the ledger for a later extension.
- The supervisor's model pre-flight (`harness/skills/sdd-continue/SKILL.md:218-226`) stays as it is; it could read the hook's `spawn.end` `model` instead, but the entry does not ask for it.
- Tokens of the supervisor (the main session) are not captured: no `SubagentStop` fires for it.
- Per-run effort and per-role provider belong to specs 9 and 10 (entry, Decided).

## Revision History

- **v1** (2026-09-19) — Initial draft.
  - **Lint pass.** 24 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence), L-26–L-30 (SpawnNode forward "SHALL gain" fields, citation is the extension point not a claim they exist today), L-33 (harness tool forward "SHALL gain action `usage`"), L-34–L-38 (forward-looking `usage` report fields and the tool's own `specName` parameter, unrelated to the `PHASE_ORDER` citation), L-43–L-44 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point), L-45 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation), L-51 (`tsconfig.json` already sits at the code root; no prefix needed), L-52–L-53 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation).
  - Fixed citation ranges/paths: L-6 (`:83`→`:83-85`), L-7 (added `src/watch/ledger.ts:188` for `buildModel`), L-8, L-11 (bare ranges given full paths), L-9, L-10, L-19, L-25, L-31, L-32, L-39–L-42, L-47–L-50, L-54 (added missing directory prefixes), L-12–L-18, L-20 (skill paths prefixed `harness/skills/`, plus sibling bare `formats.md` at Requirement 2 criterion 5), L-21–L-24 (bare ranges given `scripts/sync-plugin-assets.cjs`/`src/watch/ledger.ts` paths).
  - L-46 accepted: Requirement 6 criterion 4 rewritten with `SHALL NOT` / `SHALL` (checked the rest of the document for other Acceptance Criteria missing `SHALL`; none found).
- **v3** (2026-09-19) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 2/1/0).
  - **R2-1 — Accepted (MUST_FIX).** Requirement 5 criterion 4 (line 78) now states an explicit fallback: when no closing row of the digit-carrying end kind exists on a spawn, tokens come from the digit-carrying usage kind instead, naming the drafter, reviser and implementer as the worked case; without this the report read only the analyst's row and missed 97.7% of the flagship total.
  - **R2-2 — Accepted (MUST_FIX).** The same criterion (line 78) now identifies a start-less agent's spawn from its own otherwise-unclaimed closing row, naming the reviewer (seven such rows) and the checker (two) as the worked case; without this, 46% of the flagship total had no spawn to attach to.
  - **R2-3 — Accepted (SHOULD_FIX).** Requirement 4 criterion 7's closing sentence (line 67) now pins the full rendered agent line fitting within 80 columns without wrapping, replacing the prior floor pin that the render code makes unconditionally true and that guarded nothing.
  - **Lint pass.** 5 fixed; rejected: L-1–L-5 (Introduction prose clauses unrelated to the sole citation in that sentence, as v1); L-6 (`jsonl` belongs to the `harness-activity.jsonl` clause, not the `sdd-activity.sh:63-65`, `:69` citation, same v1/v2 pattern); L-7 (`transcript_path` belongs to the earlier clause, not the `:110-116` invert-case citation); L-8, L-9 (`usage`/`result` belong to the `spawn.usage` clause, not the `spawn.start` citation); L-10, L-11 (`start`/`usage` paraphrase the retro-analyst spawn, the citation evidences prompt-launch, same v1/v2 pattern); L-12 (`vitest` names a later-clause consumer, as v2); L-13–L-18 (SpawnNode forward `SHALL gain` fields, citation is the extension point, as v1); L-19–L-23 (forward `usage`-report fields and `specName`, unrelated to the `PHASE_ORDER`/orchestrator-suffix citations, as v1); L-24 (`compareSpecName` names a not-yet-added parameter, as v2); L-25, L-26 (`buildModel` named at `src/watch/ledger.ts:188`; confirmed the cited ranges anchor its fold behaviours, not the identifier); L-27, L-28 (doc says today's `TOOLS-REFERENCE.md` lacks `usage`/`gate`, so their absence from the cited range is the point, as v1); L-29 (`xhigh` belongs to the `sdd-drafter`/`sdd-adjudicator` clause, not the orchestrator citation, as v1); L-30 (`usage` belongs to the `spawn.usage` clause, not the `:271` override citation); L-31, L-32 (`usage`/`safeJoin` belong to the `usage` tool clause, not the hook read/write citation); L-33–L-35 (`usage`/`role`/`result` belong to the `spawn.usage` clause, not the `:241` open-node citation); L-36 (confirmed `tsconfig.json` sits at the repo root, `tsconfig.json:8` carries `rootDir: ./src`; known ruling, error persists, as v1/v2); L-37, L-38 (`usage`/`note` belong to later clauses unrelated to the step-4 columns citation, as v1); L-39, L-40 (bare `:83`/`:83-85` are the v1 Revision-History bullet's own before/after shorthand, not a live citation, as v2). L-41–L-45 accepted: the v2 Lint pass bullet's rejection prose backticked bare filenames (`copy-static.cjs`, `workspace-initializer.ts`, `harness.ts`) with line ranges as path citations; stripped the backticks so they read as plain prose (checked the rest of the document for the same construct — a backticked bare path with a line range inside Revision-History prose — none found).
- **v2** (2026-09-19) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
  - **R1-1 — Accepted (SHOULD_FIX).** Requirement 3 gains a criterion naming the build copy step into the dist tree and the two-step module-relative resolution a build and a test run both satisfy.
  - **R1-2 — Accepted (SHOULD_FIX).** Requirement 5's counting criterion rewritten: spawn identity is the opening row, every closing row counts once, the end row beats the usage row, the later end row breaks a tie; it is now its own algorithm, not the watch view's fold. The all-runs criterion trimmed to drop the duplicated pairing explanation.
  - **R1-3 — Accepted (SHOULD_FIX).** Requirement 4 gains a criterion naming the fixed column widths that must be re-budgeted for the longer declared ids before the actual-model column ships; the new widths stay design's call.
  - **R1-4 — Accepted (MINOR).** Requirement 6's docs criterion splits the supervisor out of the generated-source line; its tier row is described on its own.
  - **R1-5 — Accepted (MINOR).** Requirement 5's phase-order criterion now says the constant must be exported or duplicated; its second-spec criterion names the new parameter and points at the schema it extends.
  - **R1-6 — Accepted (MINOR).** Requirement 2's first criterion reworded to name the worker row an orchestrator writes, so it no longer collides with the criterion about the orchestrator's own row.
  - **Lint pass.** 0 fixed; rejected (all): L-1–L-5, L-26–L-28 (word sits in prose elsewhere in the sentence, not the cited range, as v1); L-6, L-7, L-8–L-11, L-29–L-34, L-36–L-37 (word belongs to a different clause than the cited line, same v1 pattern); L-12, L-24 (`vitest`/`compareSpecName` name a later-clause consumer or a not-yet-added parameter; checked copy-static.cjs:45-61, workspace-initializer.ts:9, harness.ts:49-92,95, absent as expected); L-13–L-18, L-19–L-23 (forward `SHALL gain`/`SHALL document` claims, citation is today's extension point, as v1); L-25 (`buildModel` named at `:188`; `:200-202` anchors only the last-run-scope claim); L-35 (`tsconfig.json` already at the code root, as v1); L-38–L-39 (Revision History shorthand for a past fix, not a live citation).
