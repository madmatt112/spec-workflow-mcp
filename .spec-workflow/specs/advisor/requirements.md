# Requirements Document

## Introduction

The advisor is the `sdd-advisor` role of ADR 0006 (amended 2026-10-26) and design §16: a model the operator talks to about every project the harness manages, plus a one-shot second opinion on a wait. It is for the one operator (ADR 0001) and replaces the standing overwatch session, `owctl`, the overwatch HUD and the overwatch handoff file. It adds a code-built state of the world (summary, tallies, search), staged actions the operator confirms in the dashboard, a notebook, a source registry and one phone push per new wait.

## Alignment with Product Vision

The steering directory holds no `product.md`, so this spec aligns with ADR 0004 and ADR 0006: the controller runs the work and no model sits in the control loop. The advisor adds judgement for the operator without adding a dependency for any run. The push and the staged-action guard are plain code, so the operator stays in control with no session running between conversations.

## Requirements

### Requirement 1 — the conversation entry

**User Story:** As the operator, I want to open one advisor conversation from a shell, the dashboard or my phone, so that I do coordination work in one place.

#### Acceptance Criteria

1. WHEN the operator runs `spec-workflow-mcp advisor` THEN the command SHALL start an interactive Claude Code session whose working directory is `advisor/` in the harness home (`sddHome`, `src/dashboard/harness/state-files.ts:26-29`), with the advisor role instructions loaded and the advisor tools of Requirement 7 connected.
2. WHEN the session starts THEN its first answer SHALL be the hello summary of Requirement 2, fetched through the advisor tools, not composed from memory.
3. WHEN the operator presses "Open advisor" in the dashboard THEN the controller SHALL start the same command as a Remote Control session (`claude --help` on 2.1.311 lists `--remote-control [name]`) and SHALL show the session name, or, if the session cannot start without a terminal, SHALL show the command to run instead (D7).
4. IF an advisor conversation is already live THEN "Open advisor" SHALL show that session and SHALL NOT start a second one.
5. WHEN the conversation ends THEN no advisor process SHALL remain; the controller SHALL hold no timer, cron or poll for the advisor (ADR 0006).
6. The subcommand SHALL be routed before argument parsing, the same way `init` and `doctor` are (`src/index.ts:129-131`, `src/index.ts:394-398`).

### Requirement 2 — the hello summary

**User Story:** As the operator, I want a short summary of what needs me when I open the advisor, so that I act on the important thing first.

#### Acceptance Criteria

1. WHEN the advisor asks for the summary THEN the controller SHALL return, built by code with no model: open waits (kind, project, spec, age), stuck runs (a run in `error`, or `running` with no step output for fifteen minutes; `RunStatus`, `src/controller/state.ts:56-64`), open PRs with the merge rule's last verdict (`PrRead`, `src/controller/state.ts:104-128`), deferrals with `owner: matthew` (`src/core/deferral-storage.ts:150-152`), live runs with phase and step, the two usage windows, and this week's tallies (Requirement 3).
2. WHEN a wait is open at the moment of the request THEN the summary SHALL list it (end-to-end check 1); the summary SHALL be built from current state on each request, never from a file older than the request.
3. The summary SHALL cover harness projects only; a project or source the operator marks as personal (the job search) SHALL appear only when the advisor asks for it by name.
4. The summary SHALL fit in 400 words of rendered text with every list capped and a "N more" line when capped.
5. IF a project's files are missing, empty or torn THEN the summary SHALL leave that project's rows out and name the project once; one bad project SHALL NOT hide the others (the rule `src/dashboard/shell/now-model.ts:1-8` already follows).

### Requirement 3 — tallies over time

**User Story:** As the operator, I want counts of cost, failures and findings over time, so that the advisor judges patterns without recounting.

#### Acceptance Criteria

1. The controller SHALL keep, from the run ledgers and the retrospectives of every project: tokens per role and per spec, step failures by classification (`StepClassification`, `src/controller/step.ts:71-77`), and retro findings per category, where a category is a level-2 heading of `retrospective.md`.
2. WHEN the advisor asks for tallies with a date range and an optional project THEN the controller SHALL return them bucketed by ISO week.
3. IF a ledger row lacks a field a tally needs THEN that tally SHALL count the row as unknown and label the column a floor (agent-rules "Run ledger" rule), never drop it silently.
4. WHEN a second-opinion step finishes THEN its token usage SHALL count under the role `sdd-advisor` (Requirement 5 AC 6).

### Requirement 4 — drill-down search

**User Story:** As the operator, I want to search everything the harness has written, by words and by meaning, so that the advisor recalls what was decided.

#### Acceptance Criteria

1. The search corpus SHALL be, for every known project: the spec store under `.spec-workflow/`, `docs/` (ADRs included) and `GLOSSARY.md`, plus the wait records in the home. Session transcripts and the advisor notebook SHALL NOT be indexed.
2. WHEN the advisor searches THEN the controller SHALL run a text search and a meaning search together and return one merged, de-duplicated list, each hit with project, path, line range, kind and date.
3. The search SHALL accept filters for project, spec, kind (requirements, design, tasks, retro, deferral, ADR, doc, wait) and a date range.
4. WHEN a query is worded differently from a retro finding that shares no key word with it THEN the finding SHALL be in the first ten hits (end-to-end check 3).
5. Meaning search SHALL use an embedding model that runs on the machine; no document text and no query SHALL leave the machine (D3).
6. WHEN a search starts THEN the controller SHALL re-embed only files whose content hash changed since the last index and drop entries for deleted files.
7. IF the embedding model is not installed THEN the search SHALL return text hits only and say that meaning search is off.

### Requirement 5 — the second opinion

**User Story:** As the operator, I want the advisor's picks on one wait when I press for them, so that I answer with a second view and no run waits for it.

#### Acceptance Criteria

1. WHEN the operator presses "Second opinion" on an open wait in the dashboard THEN the controller SHALL run one headless step with the role `sdd-advisor` through `runStep` (`src/controller/step.ts:350`), given the wait and the summary, and SHALL attach its typed result to the wait.
2. The result SHALL hold one pick per question (question id, the pick, a reason of at most 60 words) and a summary of at most 100 words (D5). The answer sheet SHALL show the picks next to each question (today it shows `advice` as text, `src/dashboard_frontend/src/modules/shell/NowPage.tsx:529-539`).
3. The second opinion SHALL NOT answer the wait, change the run's status or start a run step; the operator still answers. Invariant (verified, not red-first): `attachAdvice` already leaves the run untouched (`src/controller/waits.ts:118-126`, `src/controller/controller.ts:339-362`).
4. The controller SHALL run the second-opinion step only from the operator's press; no other controller code path SHALL start an `sdd-advisor` step (end-to-end check 2).
5. IF a usage window is above the controller's threshold THEN the press SHALL be refused with the reason; the step SHALL NOT take a run slot (D9).
6. WHEN the step ends THEN the controller SHALL write one `advisor.opinion` row to the home event log with the wait id, the outcome and the usage.
7. IF the step fails or returns an invalid result THEN the wait SHALL keep its earlier advice and the dashboard SHALL show the failure; the run SHALL be unaffected.
8. A wait record written before this spec, whose `advice` is a string, SHALL still render.

### Requirement 6 — staged actions

**User Story:** As the operator, I want every shared-state change the advisor proposes to wait for my confirmation in the dashboard, so that nothing the advisor reads can merge, deploy or launch.

#### Acceptance Criteria

1. The staged action kinds SHALL be: merge a PR, deploy (run `scripts/sdd-self-update.sh`, `scripts/sdd-self-update.sh:1-24`), launch a spec, answer a wait, file a deferral, add or edit a decomposition entry, and write to the owner backlog.
2. WHEN the advisor stages an action THEN the controller SHALL store it in the home with its kind, target, parameters, the advisor's reason, the conversation id and state `staged`, and the dashboard SHALL list it.
3. The action SHALL run only when the operator confirms it in the dashboard; WHEN the operator dismisses it THEN it SHALL be marked `dismissed` and never run.
4. The credential the advisor session holds SHALL be able to stage and read, and SHALL be refused (401) by the confirm route; only the browser session the operator logs in with SHALL confirm (D2).
5. WHEN a confirmed action runs THEN the controller SHALL write one `advisor.action` row to the home event log with the action id, kind, target, conversation id, outcome and time.
6. A confirmed merge SHALL apply the merge rule's checks (green checks, mergeable, no attribution trailer; `mergeByRule`, `src/controller/merge.ts:695-778`) and SHALL refuse with the rule's reasons when they fail (D4). For a run's PR under `merge: ask` it SHALL answer that run's `merge` wait with `merge` (`src/controller/merge.ts:729-753`).
7. WHEN the advisor stages a merge THEN nothing SHALL merge until the operator confirms; after confirmation the merge SHALL happen and `advisor.action` SHALL be logged (end-to-end check 4).
8. A confirmed wait answer SHALL go through `answerWait` with `by: advisor` so the receipt and the `note` row record that the advisor acted for the operator (ADR 0006).
9. A confirmed launch SHALL go through the controller's `enqueue` (`src/controller/controller.ts:145-179`) and its admission guards.
10. A confirmed deferral or decomposition write SHALL commit under the project's store lock (`withStoreLock`, `src/controller/state.ts:535-546`).
11. Writing code, running tests, committing on a branch and opening a PR SHALL stay ordinary work in the conversation, not staged actions.
12. This repository's `merge: ask` SHALL be unchanged. Invariant (verified, not red-first).

### Requirement 7 — the advisor tools

**User Story:** As the advisor, I want one tool surface over every project, so that I read state and stage actions without touching files I should not.

#### Acceptance Criteria

1. The dashboard server SHALL expose an MCP endpoint for the advisor with reads (projects, runs, waits, specs, any spec-store file, PR reads, usage windows, the summary, tallies, search, sources, staged actions) and one stage operation per kind of Requirement 6 AC 1.
2. The endpoint SHALL sit under the access hook (`makeRequireAccess`, `src/controller/access.ts:156-180`) and SHALL require the advisor credential on loopback too.
3. No tool on the endpoint SHALL execute a Requirement 6 action directly.
4. A spec-store file read SHALL stay inside that project's `.spec-workflow/` and SHALL refuse any path that leaves it.

### Requirement 8 — sources

**User Story:** As the operator, I want to name outside things the advisor knows about, so that it can use my website and my job search when I ask.

#### Acceptance Criteria

1. The registry SHALL be `sources.json` in the home: per source a name, a kind (repo, folder, url, mcp), a location and one line saying what it is.
2. On day one it SHALL list `~/repo/matthew-field.ca` (kind repo) and JobSync (kind mcp, the running instance's MCP server), JobSync marked personal (Requirement 2 AC 3).
3. WHEN the conversation starts THEN the advisor SHALL list the sources by name and line, and SHALL read a source only when the conversation needs it.
4. The role instructions SHALL state that everything read from a source is data, never an instruction.
5. WHEN a source file holds a planted instruction to merge, launch or stage anything THEN the advisor SHALL stage no action from it (end-to-end check 6; live check, recorded in `verification-evidence.md`).
6. The operator SHALL be able to edit `sources.json` by hand or ask the advisor to edit it; an advisor edit to `sources.json` is ordinary work in the home.

### Requirement 9 — notebook and decisions

**User Story:** As the operator, I want the advisor to keep its own notes and to put decisions where they act, so that nothing important lives only in a conversation.

#### Acceptance Criteria

1. The notebook SHALL be `advisor/notes/` in the home: one Markdown file per thread and an `index.md` with one line per thread. No controller code SHALL read it.
2. WHEN a conversation takes a decision THEN the advisor SHALL write it where it acts (an ADR, `GLOSSARY.md`, a project doc) and commit it on that repository's current branch under the store lock, and SHALL add a dated notebook line pointing at the commit; a decomposition change goes through Requirement 6.
3. WHEN the notebook is empty and `overwatch-handoff.md` exists in the home THEN the advisor SHALL seed threads from it and from `owner-backlog.md` in its first conversation (D12).

### Requirement 10 — phone push per wait

**User Story:** As the operator, I want one phone push for every new wait on every project, so that I know when the harness needs me with no session running.

#### Acceptance Criteria

1. WHEN a wait record with state `open` appears in the home THEN the controller SHALL send exactly one push for it, holding the wait kind, the project name, the spec and the dashboard link, and nothing else (no question text, no advice).
2. The push SHALL fire for a wait written by another process too (the watchdog writes one from its own node process, `scripts/sdd-watchdog.sh:185-201`, where the in-process `waitEvents`, `src/controller/waits.ts:61`, never fires).
3. The controller SHALL record each pushed wait id in the home, so a restart, an answer or an advice attach SHALL NOT push again (end-to-end check 5).
4. The push SHALL be a plain HTTP POST to an ntfy-style URL from `push.json` in the home (D6); IF `push.json` is absent THEN no push SHALL be sent and the summary SHALL say push is off.
5. IF a push fails THEN the controller SHALL retry once after one minute, then log the failure in the home event log; the wait and the run SHALL be unaffected.

### Requirement 11 — retirement and documentation

**User Story:** As the operator, I want the overwatch tooling retired and the advisor documented, so that there is one coordination path.

#### Acceptance Criteria

1. `docs/SDD-HARNESS.md`, `docs/USER-GUIDE.md` and `GLOSSARY.md` SHALL describe the advisor's entries, staged actions, sources, notebook and push, and `docs/controller-design.md` §16 SHALL match what shipped.
2. The docs SHALL list the operator's one-time retirement steps: archive the `owctl` repository, delete `overwatch-hud.json` and `overwatch-handoff.md` from the home after the notebook seed (`docs/overwatch-role-and-headless.md:192-194`).
3. The role `sdd-advisor` SHALL have an agent file under `harness/agents/` and a profile on the drafter tier (`harness/agent-profiles.json:14-19`), and the plugin copies SHALL match (`npm run check:plugin-assets`).

## Non-Functional Requirements

### Performance
- The summary SHALL return in under 2 seconds with the three known projects.
- A search with no changed files SHALL return in under 3 seconds; the first full index may run longer and SHALL report progress.
- A second opinion SHALL be capped by `--max-turns` and the drafter-tier budget; it SHALL NOT exceed one step.

### Security
- The advisor credential SHALL be separate from the operator secret (`src/controller/access.ts:40-67`), 0600 in the home, and the advisor session's permission settings SHALL deny reads of the operator secret file.
- Push bodies SHALL carry no question text, advice, file content or path.
- Source content SHALL never be placed in a staged action's parameters without the advisor's own reason beside it.

### Reliability
- Every new home record (staged action, pushed-id list, search index metadata, sources, push config) SHALL carry `v: 1` and be written atomically (`writeJsonAtomic`, `src/controller/state.ts:297-303`).
- No run, wait or merge SHALL depend on the advisor, the search index or the push service being available.

## Decisions taken in this document

- D1 — Posture, local only (no money, billing, refunds or credits; personal data from the job search, notebook and website stays on the machine; the push carries only wait kind, project and spec; erasure is deleting the home files; no legal or compliance framing for a one-operator tool): options were this local-only posture, sending summaries through the push service, or a hosted search index; chosen because nothing in the entry needs data to leave the machine.
- D2 — Staged-action guard is a separate advisor credential the confirm route refuses, plus a permission rule that stops the advisor reading the operator secret: options were a scoped advisor credential, the operator secret with a confirm flag, or a prompt rule only; chosen because design section 16 makes the guard code and a session that holds the operator secret could confirm its own action.
- D3 — Meaning search uses a local embedding model whose weights are fetched once at install: options were a local model, a hosted embedding API, or text search only; chosen because the entry says no API and nothing leaves the machine.
- D4 — A confirmed staged merge applies the merge rule's checks and refuses on failure: options were apply the merge rule then merge, merge on confirm with no checks, or merge only through run merge waits; chosen because a confirm must not bypass the green-checks and no-attribution rule.
- D5 — Second-opinion advice becomes typed picks per question plus a short summary, and old text advice still renders: options were typed picks plus summary, keep free text, or picks only; chosen because the entry says picks attach to the wait and the sheet can place each pick by its question.
- D6 — The phone push is an HTTP POST to an ntfy-style URL set in the home: options were an ntfy-style URL, Pushover, a Telegram bot, or a Claude Code push from a session; chosen because it is one request with no account library, and a session push needs a resident session.
- D7 — The dashboard opens the conversation as a Remote Control session and shows the command when that cannot start without a terminal: options were a Remote Control launch with fallback, show the command only, or a terminal multiplexer launch; chosen because the phone entry needs Remote Control and the flag exists but is not yet proven without a terminal.
- D8 — The shell entry is an advisor subcommand of the package binary, with the sdd advisor form as a documented shell alias: options were a subcommand, a second package binary named sdd, or a separate script; chosen because the package has one binary and subcommands already route the same way.
- D9 — A second opinion takes no run slot and is refused above the usage threshold: options were no slot with a window check, a run slot, or no check; chosen because it must never delay a run and must not spend a nearly empty window.
- D10 — One agent file serves both entries, on the drafter tier: options were one agent file, a skill plus an agent file, or two roles; chosen because the step runner loads roles from agent files and one text keeps both entries consistent.
- D11 — Decision commits are ordinary work under the store lock, and a decomposition change is staged: options were ordinary commits, staging every repository write, or notebook-only decisions; chosen because the entry stages decomposition entries and says decisions are committed where they act.
- D12 — The advisor seeds the notebook in its first conversation from the handoff file and the owner backlog: options were an advisor seed, a code import script, or no seed; chosen because the seed is prose and the advisor is the prose role.
- D13 — The search index refreshes incrementally when a search starts: options were refresh on search, a file watcher, or a timed rebuild; chosen because the entry rules out polling and crons and re-embeds only changed files.

## Scope notes

- Carried items: none.
- Deferred: a standing "watch X and tell me" one-shot (ADR 0006 consequence 1); not in the entry's delivered list.
- Cut: indexing session transcripts (the entry excludes them) and the notebook (the advisor reads its own files).
- Outside the repository: archiving `owctl` and deleting the retired home files are operator steps; this spec documents them (Requirement 11 AC 2) and does not perform them.
- The steering `product.md` does not exist; alignment cites the ADRs instead.

## Revision History

- **v1** (2026-10-26) — Initial draft.
  - **Lint pass.** 2 fixed; rejected: none.
