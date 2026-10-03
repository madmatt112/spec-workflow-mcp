# Requirements Document — lean-orchestrators

## Introduction

This spec measures where the document and implementation orchestrators spend their context, then cuts the largest sources. It is for the harness operator, who pays for every orchestrator call because each call reads the whole context again. It adds a per-source breakdown to `harness usage`, then makes the two orchestrators load less skill text, read fewer whole files, receive shorter worker reports, batch their bookkeeping calls and live for fewer tasks per spawn.

## Alignment with Product Vision

No `steering/product.md` exists in this spec store (the `steering/` directory is empty); alignment is to the efficiency plan's order "tokens, then wall clock" (`docs/harness-efficiency-plan.md:8-9`) and to decomposition entry 14 (`.spec-workflow/spec-decomposition/decomposition.md:728-782`). The entry fixes the scope to the document and implementation orchestrators, requires measurement first, and accepts a drop in orchestrator W per spec with no quality loss as done. Wall clock is not an accepted trade-off, so every cut that adds orchestrator restarts is a recorded decision for gate A.

## Measured baseline (drafter probe, 2026-10-02)

The unit is W = input + 1.25 cw5m + 2 cw1h + 0.1 read + 5 output (decomposition entry 14). From the `tdd-task-loop` ledger (`.spec-workflow/specs/tdd-task-loop/harness-events.jsonl`, last `spawn.end` per `agentId`): four document-orchestrator spawns cost 4.50M W and one implementation-orchestrator spawn cost 2.68M W over 17 tasks. The probe `/tmp/scratchpad/sdd/lean-orchestrators/source-probe.js` split each spawn's W by source from its transcript (character-proportional, so the shares are estimates; it reproduced the implementation spawn's ledger W within 0.3%):

| Source | Document spawns (3) | Implementation spawn |
| --- | --- | --- |
| Base prefix (system prompt, agent body, tool schemas), about 32k tokens | 32-36% | 25% |
| Skill text (preloaded skill plus `references/` reads) | 23-31% | 18% |
| Orchestrator's own text and tool inputs | 11-16% | 14% |
| Whole spec-store file reads (`tasks.md` once: 43k characters) | 1-5% | 16% |
| Worker reports (hand-back messages and Agent results) | 2-7% | 12% |
| MCP results (`adversarial-review`, `spec-lint`, `review-task` gate) | 5-11% | 5% |
| Bash results | 3-11% | 3% |

The implementation spawn made 127 calls and reached a 229k-token context; 51 of its tool calls were ledger writes. The document spawns made 56-74 calls each, of which 2-7 were worker spawns. The cuts below target the rows that one spec can change; the base prefix is out of scope (Scope notes).

## Requirements

### Requirement 1 — W and a per-source breakdown in `harness usage`

**User Story:** As the retro analyst, I want `harness usage` to print each orchestrator spawn's W split by context source, so that I can see which source a cut removed and read the drop against a baseline spec.

#### Acceptance Criteria

1. WHEN `harness usage` runs THEN each phase total and each agent cell SHALL also carry W, computed per spawn from the closing `spawn.end` row's `input`, `output`, `cacheRead`, `cacheWrite5m` and `cacheWrite1h` (the keys the hook writes at `harness/hooks/sdd-activity.sh:220-229`). IF a spawn's `cacheWrite5m` or `cacheWrite1h` is not a digit string THEN that spawn's W SHALL count as unknown, shown as ` (+N unknown)` like the token cell (`src/watch/usage.ts:365-367`).
2. WHEN the `usage` action gets `sources: true` THEN for every `sdd-document-orchestrator` and `sdd-implementation-orchestrator` spawn it SHALL read the subagent transcript and print one block per spawn: phase, agent, `agentId`, calls, peak context tokens, W, and one row per source with its W and its share of the spawn's W (D2).
3. The transcript SHALL be located from the activity rows' `session` and `agentId` (`src/watch/ledger.ts:26-36`) as `<projects dir>/<any project>/<session>/subagents/agent-<agentId>.jsonl`, the same derivation the hook uses (`harness/hooks/sdd-activity.sh:135-142`). The action SHALL accept a `session` and an `agentId` only when they match `^[A-Za-z0-9-]+$`, and SHALL read no other path.
4. The sources SHALL be: `base` (the prefix not visible in the transcript), `skill` (meta messages that carry a skill body, and `Read` results of files under a `skills/` directory), `worker-report` (Agent tool results and hand-back messages), `read` (other `Read` results, with the spec-store share broken out), `mcp:<tool>.<action>`, `bash`, `tool:<name>` for any other tool, `prompt` (the launch prompt and other user text) and `own-output` (the orchestrator's text and tool inputs held in context, plus its output tokens).
5. Each call SHALL be counted once per `message.id`, as `readUsage` counts it (`harness/hooks/sdd-activity.sh:68-98`). A call's output W SHALL go to `own-output`; its input W SHALL be split over the sources in its context in proportion to their size, with `base` sized once from the first call (D7).
6. WHEN the breakdown runs on the `tdd-task-loop` ledger and transcripts THEN the source totals of each document and implementation orchestrator spawn SHALL equal that spawn's W from criterion 1 within 1% (decomposition scenario 1).
7. IF a spawn's transcript is missing or unreadable THEN its block SHALL print `sources unknown` with its ledger W, and the report header SHALL count such spawns; the action SHALL never fail on a missing transcript.
8. WHEN `sources: true` is given THEN each phase total SHALL also print W per unit: W per review round in a document phase (the count of `round` rows) and W per completed task in the implementation phase (the count of `task.done` rows). WHEN `compareSpecName` is also given THEN the compare table SHALL print both specs' per-unit W and the delta.
9. Without `sources: true` the action SHALL read only the spec store, as its description states (`src/tools/harness.ts:41-43`); the description SHALL name the transcript read that `sources: true` adds. The action SHALL still spawn no process.
10. The breakdown and the W fold SHALL be pure functions in `src/watch/` with tests beside them, fed fixture transcripts: one per source kind, a multi-line message counted once, a missing transcript, and a sum check against W.

### Requirement 2 — The baseline survives transcript cleanup

**User Story:** As the retro analyst, I want the baseline breakdowns saved in the spec store, so that the retro can compare against them after the transcripts are gone.

#### Acceptance Criteria

1. WHEN Requirement 1 is implemented THEN the first implementation task after it SHALL write `.spec-workflow/specs/lean-orchestrators/baseline-sources.md` holding the `sources: true` output for `tdd-task-loop` (this spec store) and for `trading-rules` (`/home/mcf/repo/tradr-hosted/.spec-workflow`, through `projectPath`), and commit it (D8).
2. IF a baseline spawn reports `sources unknown` THEN the file SHALL say so for that spawn and keep its ledger W; the task SHALL not invent a breakdown.
3. The retro SHALL read the baseline from this file, not from transcripts. The oldest transcript kept under `~/.claude/projects/-home-mcf-repo-spec-workflow-mcp/` was dated 2026-09-13 on 2026-10-02 (probe), so older transcripts are already gone.

### Requirement 3 — Step-scoped skill text

**User Story:** As the harness operator, I want each orchestrator to hold only the skill text of the steps it runs, so that rarely used steps stop riding in every call.

#### Acceptance Criteria

1. The preloaded `sdd-document-phase` skill (`harness/agents/sdd-document-orchestrator.md:8-9`) SHALL keep the standing rules, Step 0, Step 1, the Lint step, Step 2, Step 3, Step 5, Step 6 and Budget. Gate A, Gate B, the Standoff, Circling and Cap convergence checks, Steps 4a and 4b, the Design scope-cut gate, Step R and the legacy rules SHALL move to reference files that the orchestrator reads only when Step 0 or a route names that step (D5).
2. The preloaded `sdd-implementation-phase` skill (`harness/agents/sdd-implementation-orchestrator.md:8-9`) SHALL keep the standing rules, Step 0, the Per-task loop and the Deferral bar. Design defect, Escalate, Resume recovery, the Completion gate (with Live verification and Reconcile a red PR), Repair and the stop table SHALL move to reference files read only when routed there.
3. No orchestrator SHALL read `references/briefs.md` whole. Today both skills say to read it once at the start (`harness/skills/sdd-document-phase/SKILL.md:14-17`, `harness/skills/sdd-implementation-phase/SKILL.md:22`), and the server templates do not yet carry the fixed brief text (`src/tools/harness.ts:490-491`). Every brief, prompt section and standing brief an orchestrator writes SHALL come from `harness` `brief` with the fixed text server-side; the step text SHALL list only the values the orchestrator passes.
4. The implementer and verifier standing briefs (`harness/skills/sdd-implementation-phase/references/briefs.md`, sections at lines 5 and 134) SHALL be written by `harness` `brief`, not by the orchestrator's Write tool.
5. The document orchestrator SHALL read `references/cleanup.md` only in Step 6 and in the step that first needs the commit script.
6. No moved text SHALL change meaning: a test SHALL assert that every rule heading of today's two skills exists in the new skill or in exactly one of its reference files.

### Requirement 4 — No whole spec-store files in the implementation orchestrator

**User Story:** As the harness operator, I want the implementation orchestrator to route from server results, not from whole files, so that `tasks.md` and the decomposition stop riding in every call.

#### Acceptance Criteria

1. The implementation orchestrator SHALL NOT read `tasks.md`, the decomposition file or `agent-rules.md` with the Read tool or with a shell command that prints them whole. Today its own reads include all three (`harness/skills/sdd-implementation-phase/SKILL.md:6-13`).
2. WHEN `harness` `orient` runs for `implementation` THEN its result SHALL also carry the next task's id, title and status, so that the Pick step needs no `tasks.md` read (`harness/skills/sdd-implementation-phase/SKILL.md:104-107`).
3. WHEN the completion gate needs the decomposition entry's verification scenario THEN a server result SHALL return that scenario text only; the orchestrator SHALL not grep the whole file.
4. The orchestrator SHALL change a task's checkbox through the batched bookkeeping of Requirement 6, which locates the line itself.

### Requirement 5 — Short, fixed-shape worker reports

**User Story:** As the harness operator, I want every worker's report to its orchestrator to be a short fixed block, so that reports stop growing the orchestrator context.

#### Acceptance Criteria

1. Every worker that reports to the document or implementation orchestrator (drafter, reviewer, reviser, adjudicator, checker, implementer, test author, verifier) SHALL end its report with a fixed `key: value` block of at most 8 lines, and the whole report SHALL be at most 80 words (D6).
2. The block keys SHALL be the ones the orchestrator routes on, listed per role in the role's agent file; file lists and per-file notes SHALL not appear in the report. A worker that has more to say SHALL write it to a file under `/tmp/scratchpad/sdd/<spec>/` and name the path in one line.
3. The orchestrator SHALL route only on block keys; IF a report lacks its block THEN the orchestrator SHALL treat it as a stall and re-spawn once, as it does for a missing verdict block (`harness/skills/sdd-document-phase/SKILL.md:169-208`).
4. The hook's `spawn.report` row (`harness/hooks/sdd-activity.sh:230-235`) SHALL be unchanged; it records whatever the worker reported.

### Requirement 6 — Batched bookkeeping

**User Story:** As the harness operator, I want the orchestrator's bookkeeping between two worker spawns to take one tool call, so that fewer calls re-read the context.

#### Acceptance Criteria

1. Between a worker's report and the next worker spawn or gate call, the implementation orchestrator SHALL make at most one bookkeeping tool call. The pick (checkbox to `[-]`, `task.pick`, HEAD capture) SHALL be one call; the close (checkbox to `[x]`, `task.done`, retro-log entry, HANDOFF State row, spec-store commit) SHALL be one call. Today these are separate Edit, `event.sh`, `retro.sh` and commit calls (`harness/skills/sdd-implementation-phase/SKILL.md:59-77`, `harness/skills/sdd-implementation-phase/SKILL.md:252-264`).
2. Each worker's `spawn.usage` row and each gate's `note` and `judge` rows SHALL be written in that same bookkeeping call, not in a call of their own.
3. In a document phase, the `spawn.usage`, `round` row and retro-log entry that follow a review verdict SHALL be one call (`harness/skills/sdd-document-phase/SKILL.md:61-69`).
4. The batching SHALL be per-run shell scripts that the orchestrator writes once per run, beside `event.sh`, and SHALL append rows only through `EVENT_SCRIPT`, so the run ledger keeps one writer per row and its run id (`.spec-workflow/agent-rules.md:84-97`) (D3).
5. Ledger row types and keys SHALL be unchanged, so `--watch` and `harness usage` read the new run as they read the baseline.
6. The batch scripts SHALL exit non-zero naming the step that failed; the orchestrator SHALL treat a non-zero exit as today's failed step, never as success.

### Requirement 7 — Fewer tasks per implementation orchestrator spawn

**User Story:** As the harness operator, I want the supervisor to restart the implementation orchestrator more often, so that no single spawn re-reads a 200k-token context for its last tasks.

#### Acceptance Criteria

1. The supervisor's implementation `BUDGET` SHALL default to 5 tasks per spawn (today 20: `harness/skills/sdd-continue/SKILL.md:291`), and the skill text that states 20 SHALL say 5 (D1).
2. WHEN a spawn reports `PHASE: resume` THEN the supervisor SHALL spawn a fresh orchestrator as today (`harness/skills/sdd-continue/SKILL.md:350-351`).
3. The runaway guard (`harness/skills/sdd-continue/SKILL.md:379-380`) SHALL allow, for the implementation phase, the larger of 12 and ceil(open tasks / BUDGET) + 4 spawns.
4. The document orchestrator's lifetime SHALL be unchanged: 4 review rounds per spawn (D4).
5. WHEN the task that fills the budget is also the last open task THEN the orchestrator SHALL report `PHASE: resume` with `NEXT: completion gate`, so a fresh spawn runs the completion gate (today Budget fires only while open tasks remain: `harness/skills/sdd-implementation-phase/SKILL.md:265-267`).

### Requirement 8 — Must-keeps and end-to-end proof

**User Story:** As the harness operator, I want a fixture run and the retro to prove the drop with no lost quality or must-keep, so that the cuts are judged on numbers.

#### Acceptance Criteria

1. The run SHALL keep the must-keeps: the ledger and `--watch`, a fresh worker per round and per task, and one PR per spec that agents never merge (decomposition entry 14, Decided).
2. WHEN a fixture spec with at least 6 tasks runs on the changed harness through requirements, design, tasks and implementation THEN its ledger SHALL show a fresh worker `spawn.start` per review round and per task, and one PR (decomposition scenario 2). The fixture kit SHALL be dry-run in a scratch store and recorded green before the gated run (`.spec-workflow/agent-rules.md:99-110`).
3. WHEN that run ends THEN `harness usage` with `sources: true` SHALL show orchestrator W per review round and per task lower than in `baseline-sources.md`, and the retro SHALL print both numbers (decomposition scenario 3).
4. The retro SHALL also report, beside the baseline, these quality signals: review rounds per document phase, MUST_FIX count at convergence, fix rounds per task, escalations and errors, and phase wall clock per round and per task. A worse quality signal, or wall clock per task more than 15% above the baseline, SHALL be a retro finding for Matthew, not a silent pass (D9).
5. WHEN the fixture run cannot run inside the normal loop THEN it SHALL stay pending in a tracked `verification-evidence.md` whose every line must read `passed` before the retrospective opens (`.spec-workflow/agent-rules.md:99-110`).
6. `npm run check:plugin-assets`, `claude plugin validate . --strict`, `npx tsc --noEmit` and `npm test` SHALL be green (decomposition scenario 4).

## Non-Functional Requirements

### Performance
- Orchestrator W per review round and per task SHALL drop against the baseline; there is no fixed target (decomposition entry 14, Decided).
- `harness usage` without `sources: true` SHALL read no more files than today.

### Security
- The transcript read SHALL accept only validated `session` and `agentId` values (Requirement 1 criterion 3) and SHALL not follow paths from row content.

### Reliability
- A missing transcript, a torn ledger line or an unknown cache field SHALL lower the report to an unknown count, never fail it. Breakdown shares are estimates and W totals are floors; the report SHALL say so in its header (`.spec-workflow/agent-rules.md:84-97`).

## Decisions taken in this document

- D1 — Implementation orchestrator lifetime: options were 5 tasks per spawn (chosen), 20 tasks per spawn as today, 10 tasks per spawn, one task per spawn; chosen because the probe shows the last tasks of a 17-task spawn re-read about 200k tokens per call, a fresh spawn costs one base-and-skill write, and 5 adds about three restarts to a 17-task phase, which stays within the wall-clock rule while one task per spawn would not.
- D2 — Where the breakdown is computed: options were the usage action reads orchestrator transcripts on request (chosen), the activity hook writes per-source rows at subagent stop, a standalone script outside the server; chosen because only a transcript reader can break down the baseline specs, and it keeps new code out of the hook, a sensitive path.
- D3 — Where batched bookkeeping lives: options were per-run shell scripts written beside the event script (chosen), new server actions that write the ledger and commit, leaving the calls as they are; chosen because commits need a git process the harness tool never spawns, and the ledger keeps its single writer path.
- D4 — Document orchestrator lifetime: options were keep 4 review rounds per spawn (chosen), one spawn per review round; chosen because document spawns peaked at 136k to 163k tokens, below the implementation peak, and the skill and bookkeeping cuts reach them without extra restarts.
- D5 — Skill split: options were preloaded core plus routed reference files (chosen), one file per step loaded on demand, keep whole skills; chosen because every spawn runs the core steps, and per-step files would add a read call to every step.
- D6 — Worker report size: options were a fixed block of at most 8 lines within 80 words (chosen), keep the 150-word cap, reports to files only; chosen because the 22 worker hand-backs of the baseline implementation spawn ran a median of 261 words (220 to 466), and the orchestrator routes on a few keys only.
- D7 — Attribution rule: options were split each call's input W by source size with the base sized from the first call (chosen), count tokens with a tokenizer, charge each block only once when it first enters; chosen because the split makes the source totals equal W by construction, and no tokenizer package is installed in this repository (probe of the installed packages, 2026-10-02).
- D8 — Baseline persistence: options were a committed baseline file written early in implementation (chosen), rely on the transcripts staying, re-run the baseline specs; chosen because old transcripts are already gone from this machine, and re-runs cost a full spec.
- D9 — Quality bar: options were the listed retro signals with a 15% wall-clock flag (chosen), a fixed W target, reviewer judgement only; chosen because the decomposition sets no target number and makes wall clock Matthew's call.
- D10 — Cheaper orchestrator model: options were defer to a retro decision (chosen), try Sonnet on the fixture run through the per-role override, switch the default now; chosen because W weighs tokens the same on every model, so a model change cannot show in this spec's done measure.
- D11 — Approval calls: options were leave the four approval calls per phase as they are (chosen), batch them in one server action; chosen because the approvals tool is a sensitive path and the four calls are a small share of a document spawn.

## Scope notes

- The base prefix (system prompt, agent body, tool schemas, about 32k tokens and 25-36% of orchestrator W) is not cut: it is set by Claude Code and the session's MCP servers, not by this repository. The breakdown reports it so a later spec can act.
- The cheaper-model lever is deferred to a retro decision (D10); the per-role override from spec 9 stays available.
- The close-out and retro orchestrators keep their shape (decomposition entry 14, Decided). Shared reference text they use, such as `references/cleanup.md`, SHALL keep working for them.
- The decomposition entry lists all four levers as accepted; this document uses three (less detail, supervisor looping, bookkeeping to scripts) and defers the model lever.
- Carried items from a previous phase: none.

## Revision History

- **v1** (2026-10-02) — Initial draft.
