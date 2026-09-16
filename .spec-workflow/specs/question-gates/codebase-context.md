# Codebase context — question-gates

## Supervisor (sdd-continue) — the only role with AskUserQuestion; both gates live here

- harness/skills/sdd-continue/SKILL.md:48-76 — resolves roots and starts the run ledger; `run.start` records `headless=yes` when the AskUserQuestion tool is not available.
- harness/skills/sdd-continue/SKILL.md:146-210 — dispatch loop: spawns one phase orchestrator, acts on its final `PHASE:` line; the PHASE routing table (`approved`, `resume`, `escalate`, `error`, ...) is where a new `gate-a` return is handled.
- harness/skills/sdd-continue/SKILL.md:157-175 — the orchestrator launch prompt fields (SPEC, PHASE, MODE, REVISION_INPUT, ...) a re-spawn after gate A reuses.
- harness/skills/sdd-continue/SKILL.md:215-230 — worktree entry and HANDOFF rewrite happen before the first implementation spawn; gate B inserts here, before implementation.
- harness/skills/sdd-continue/SKILL.md:232-261 — retrospective conversation: existing AskUserQuestion usage and its headless fallback (write a file, HANDOFF row, proceed); the pattern both gates follow.

## Document phase — Gate A emission point (requirements only)

- harness/agents/sdd-document-orchestrator.md:1-52 — the agent that runs requirements/design/tasks; spawns workers, reports in the contract; gains a `gate-a` return and (for tasks) returns the veto list.
- harness/skills/sdd-document-phase/SKILL.md:69-93 — Step 1 writes and checkpoints v1 with the drafter; gate A fires right after this checkpoint, before Step 2.
- harness/skills/sdd-document-phase/SKILL.md:122-157 — Step 2 first adversarial review round; gate A precedes it.
- harness/skills/sdd-document-phase/SKILL.md:247-259 — Step R revision-input path: reviser writes v(D+1) from numbered findings, then at least one review round; the changed-answers route reuses this.
- harness/agents/sdd-reviser.md:1-33 — Sonnet reviser; takes a findings list or revision comments and writes the next version in place; a changed gate-A answer routes here as a revision comment.

## Gate B veto computation — reuses the review-gate rules

- src/core/gate-rules.ts:14-17 — `SENSITIVE_PATHS_HEADING = '## Sensitive paths'`, the machine-read heading.
- src/core/gate-rules.ts:79-99 — `parseHeadingBullets`, the bullet-list parser under a heading.
- src/core/gate-rules.ts:101-135 — `parseSensitivePaths` and `isSensitivePath` (`dir/` prefix or equality match); the predicates gate B class (a) reuses.
- src/tools/review-gate.ts:177-194 — existing caller: reads `agent-rules.md` at the workflow root, calls `parseSensitivePaths`; ENOENT ⇒ every path sensitive.

## Templates the gates read

- .spec-workflow/templates/requirements-template.md:47-52 — `## Decisions taken in this document`, the section gate A extracts and ranks.
- .spec-workflow/templates/tasks-template.md:3-13 — task shape: each task declares touched paths on `- File:` lines; gate B class (a) matches these.

## Contracts and configuration

- harness/skills/sdd-continue/references/formats.md:24-50 — orchestrator report contract and PHASE table; a `gate-a` value is added here.
- harness/skills/sdd-continue/references/formats.md:52-67 — HANDOFF `## Phase log` row shape both gates write in record mode.
- harness/skills/sdd-continue/references/formats.md:185-200 — run-ledger event table; `run.start` carries `headless` (yes/no).
- .spec-workflow/agent-rules.md:5-6 — top-of-file `key: value` lines (`worktree-per-change`), where the new `gates: block | record` key sits.
- .spec-workflow/agent-rules.md:63-70 — `## Sensitive paths` list, the class-(a) match source.
- docs/step-0-answers.md:96-107 — answer 5: `claude -p` runs still list AskUserQuestion; a bare `-p` run denies the call; a denial is not evidence of headless.

## Server surface — the `harness` tool (where the `gate` action is added, design)

- src/tools/harness.ts:24-82 — the `harnessTool` schema; the `action` enum (`orient|brief|phase-log`) and props gain `gate` and `op`/`slot`/`payload`.
- src/tools/harness.ts:84-100 — `harnessHandler` action switch; a `case 'gate'` routes to the new handler.
- src/tools/harness.ts:455-505 — `BRIEF_TEMPLATES`, the named server templates; the pattern for server-owned payload shapes.
- src/tools/harness.ts:517-612 — `briefAction`: `selectRoots`, `PathUtils.safeJoin`, `mkdir`+`writeFile`, missing-value guard (537-544) — the write pattern `gate put` reuses.
- src/tools/index.ts:15,33,83 — `harnessTool`/`harnessHandler` import, registration, and dispatch; already wired, no change to add an action.

## Gate-B inputs — the tasks parser and the sensitive-path predicates

- src/core/task-parser.ts:119 — `ParsedTask.files?: string[]`, the declared paths class (a) matches.
- src/core/task-parser.ts:279-288 — `Files:`/`File:` lines parsed (comma-split, parenthetical stripped) into `files[]`.
- src/core/gate-rules.ts:101-104 — `parseSensitivePaths`, reused by `gate class-a` to parse `agent-rules.md`.
- src/core/gate-rules.ts:133-135 — `isSensitivePath`, reused by `veto-rules.ts` `computeClassA` for the path match.
- src/tools/review-gate.ts:177-194 — existing agent-rules read + ENOENT⇒null pattern `gate class-a` mirrors.

## Where new source and tests land

- src/core/veto-rules.ts — new pure module (class (a) keywords + `computeClassA`), mirrors `gate-rules.ts`.
- src/core/__tests__/gate-rules.test.ts — sibling suite; new `veto-rules.test.ts` goes next to it.
- src/tools/__tests__/harness.test.ts — existing harness suite; the `gate` action tests extend it.

## Drafter and reviser frontmatter (the MCP-grant convention gate A follows)

- harness/agents/sdd-drafter.md:7-13 — drafter `tools:` (no MCP tool today); gains `harness` in three plugin-prefixed forms.
- harness/agents/sdd-drafter.md:16-26 — drafter body/standing rules; gains one requirements-phase-only gate-A step.
- harness/agents/sdd-reviser.md:14-16 — reviser's single MCP grant (`adversarial-response`), the pattern the drafter's grant matches.
