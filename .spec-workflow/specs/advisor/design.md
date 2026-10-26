# Design Document

## Overview

This design builds the advisor: a conversation entry (`spec-workflow-mcp advisor`, shell or Remote Control), a one-shot second opinion on a wait, and a code-built state of the world (summary, tallies, search) served through an MCP endpoint. Every shared-state change the advisor asks for is a staged action that runs only on a confirm in the dashboard; the controller sends one phone push per new wait. It reuses the controller's waits, step runner, merge rule, store lock, launch admission and access hook, with new code in `src/advisor/`.

## Steering Document Alignment

### Technical Standards (tech.md)
No `tech.md`; the design follows `agent-rules.md`: tests in `__tests__/` beside each module, `npx tsc --noEmit` and `vitest`, no new npm dependency.

### Project Structure (structure.md)
No `structure.md`; server code goes in `src/advisor/`, route wiring stays in `src/dashboard/multi-server.ts`, the role file goes in `harness/agents/` with its plugin copy generated.

### Design System (design-system.md) — if applicable
N/A: no `design-system.md`. New controls reuse the Now page's CSS variables and primitives (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:529-539`).

## Architecture

All advisor state lives in the harness home (`sddHome`, `src/dashboard/harness/state-files.ts:26-29`): `advisor/` plus `sources.json`, `push.json`, `search.json`, `pushed.json` and `events.jsonl`. The dashboard server process gains the advisor MCP endpoint, the operator routes (confirm, dismiss, second opinion, open advisor), the wait pusher and the search index refresh. Nothing runs on a timer.

```mermaid
graph LR
  CLI[advisor subcommand] -->|spawns| CC[claude session in home/advisor]
  CC -->|advisor credential| MCP[advisor MCP endpoint]
  MCP --> RD[summary, tallies, search, reads]
  MCP --> ST[staged action store]
  UI[dashboard, operator cookie] -->|confirm| EX[action executor]
  ST --> EX
  EX --> W[answerWait, enqueue, mergeByRule, store commit, self-update]
  UI -->|second opinion| OP[runStep sdd-advisor] --> WT[wait record]
  WD[home waits dir] -->|file event| PU[wait pusher] --> NT[ntfy-style URL]
```

## Components and Interfaces

### C1 — Home layout and event log (`src/advisor/home.ts`)
- **Interfaces:** one path function per file in Data Models, all under `controllerHome()` (`src/controller/state.ts:238-243`); `appendEvent(row: HomeEvent): Promise<void>`.
- **Post-conditions:** `appendEvent` writes one `JSON.stringify(row) + '\n'` per `fs.appendFile` call, never through `writeJsonAtomic`; a row over 4,096 bytes has its `detail` cut to fit. Every other new record is written with `writeJsonAtomic`, which this spec exports from `src/controller/state.ts:297-303` (module-private today).

### C2 — Advisor credential and scoped access (`src/controller/access.ts`)
- **Interfaces:** `advisorSecretPath()` (file `advisor-secret` in the home); `loadOrCreateAdvisorSecret()` (the 0600 create-or-read of `loadOrCreateSecret`, `src/controller/access.ts:40-67`); `ADVISOR_MCP_PATH = '/api/controller/advisor/mcp'`; `makeRequireAccess(secret, advisorSecret?)` and `installAccessControl(app, secret, advisorSecret?)`, the new argument optional and trailing; the server passes it at `src/dashboard/multi-server.ts:230-231`.
- **Post-conditions:** A request to exactly `ADVISOR_MCP_PATH` passes with `Authorization: Bearer` the advisor secret or with the operator credential. Elsewhere the advisor secret is no credential: `isAuthorized` (`src/controller/access.ts:129-137`) and login (`src/controller/access.ts:194-203`) still compare only the operator secret, so confirm, dismiss, second-opinion, open, answer and launch answer 401 to it (Requirement 6 AC 4, Requirement 7 AC 2). The endpoint is under `/api/controller/`, so the loopback read exemption (`src/controller/access.ts:168-171`) never applies.

### C3 — Advisor MCP endpoint (`src/advisor/mcp-endpoint.ts`)
- **Interfaces:** `registerAdvisorMcp(app, deps): void` registers GET, POST and DELETE on `ADVISOR_MCP_PATH`. Per request: a low-level MCP `Server` with `ListTools` and `CallTool` handlers (the pattern of `src/server.ts:255-268`), a stateless `StreamableHTTPServerTransport` (`sessionIdGenerator: undefined`), `reply.hijack()`, then `transport.handleRequest(request.raw, reply.raw, request.body)` (probed on SDK 1.27.1 and fastify 5.8.1). The conversation id is the `x-sdd-conversation` header, else `unknown`.
- **Read tools:** `projects`, `runs`, `waits`, `specs`, `read_store_file {project, path}`, `pr_reads {project?}` (latest `PrRead` per PR, `src/controller/state.ts:109-128`), `usage` (`src/controller/state.ts:194-201`), `summary {include?}`, `tallies {from, to, project?}`, `search {query, project?, spec?, kind?, from?, to?, limit?}`, `sources`, `staged_actions {state?}`.
- **Stage tools:** `stage_merge {project, pr, branch}`, `stage_deploy {}`, `stage_launch {project, spec}`, `stage_answer {wait, answers}`, `stage_deferral {project, title, body, owner, originSpec?}`, `stage_decomposition {project, slug, markdown}`, `stage_backlog {text}`, each also taking a required non-empty `reason`. Each only calls `stageAction` (C8) and returns the id (Requirement 7 AC 3).
- **Post-conditions:** `read_store_file` resolves against the project's `.spec-workflow/`, applies `realpath`, and returns a tool error with no content for any result outside it, `..` and symlinks included (Requirement 7 AC 4).

### C4 — Summary (`src/advisor/summary.ts`)
- **Interfaces:** `buildSummary(opts: { include?: string[]; now?: Date }): Promise<AdvisorSummary>`; `renderSummary(s): string`.
- **Post-conditions:** Built from current files on each call, no cache. Sections (shape in Data Models): open waits (`listOpenWaits`, `src/controller/waits.ts:128-132`); stuck runs (`error`, or `running` with the newest file under `runStepsDir(id)`, `src/controller/state.ts:254-256`, older than 15 minutes or absent); open PRs (latest `PrRead` per PR, verdict not `merged`, run not `abandoned`); `owner: matthew` deferrals (`src/core/deferral-storage.ts:150-152`); live runs; `fiveHour` and `sevenDay` windows; this ISO week's tallies (C5); sources by name and line (Requirement 8 AC 3); `push: off` without `push.json`. A project in `sources.json` `personalProjects` appears only when named in `include`. Lists cap at 5 rows plus an `N more` line; rendered text at most 400 words. A project whose reads throw is dropped from every section and named once in `skipped` (`src/dashboard/shell/now-model.ts:1-8`).

### C5 — Tallies (`src/advisor/tallies.ts`)
- **Interfaces:** `buildTallies(q: { from: string; to: string; project?: string }): Promise<Tallies>`.
- **Post-conditions:** Reads every known project's `specs/*/harness-events.jsonl` and `specs/*/retrospective.md` and the home `events.jsonl`, bucketed by ISO week (`2026-W43`). Tokens: each `spawn.end` row (`src/controller/ledger.ts:130-143`) adds `tokens` to its `agent` and `spec`; each `advisor.opinion` row adds to role `sdd-advisor` (Requirement 3 AC 4). Failures: a `spawn.usage` row (`src/controller/ledger.ts:145-153`) whose `result` is a non-`ok` `StepClassification` (`src/controller/step.ts:71-77`) counts under it; any other value but `ok` or `success` counts as `unknown`. Findings: each `- **F` line counts under the level-2 heading above it, dated by the file's last commit. A row missing a needed field counts as `unknown`, and that column carries `floor: true` (Requirement 3 AC 3).

### C6 — Search (`src/advisor/search/`)
- **Interfaces:** `corpus.ts` `listCorpus(projects)` (each project's `.spec-workflow/**/*.md`, `docs/**/*.md`, `GLOSSARY.md`, and the home `waits/*.json`; never transcripts or `advisor/notes/`) and `chunk(file)` (split at level 1-3 headings, at most 60 lines; a wait is one chunk); `text.ts` `textSearch(chunks, query)`; `embed.ts` `interface Embedder { model: string; embed(texts: string[]): Promise<number[][]> }` and `loadEmbedder(): Promise<Embedder | null>`; `index.ts` `refreshIndex(embedder)`; `search.ts` `search(q): Promise<SearchResult>` (Data Models).
- **Post-conditions:** A hit's shape is in Data Models; `kind` comes from the path and `date` is a wait's `created`, else the last commit date, else mtime. Filters apply before ranking. Text score: distinct query words of three letters or more (stop words removed) present in the chunk, plus one for the whole phrase. Meaning score: cosine similarity. Lists merge by reciprocal rank fusion (k = 60), de-duplicated on `project|path|startLine`; limit 10 by default, 30 at most. Searches run one at a time. Each search hashes every corpus file (SHA-256), re-embeds only changed files and drops gone ones (Requirement 4 AC 6). Over 200 chunks to embed: text hits now, `meaning: "indexing n of m"`, embedding continues in process. No embedder: `meaning: "off"`, text hits only (Requirement 4 AC 7).
- **Embedder:** a local Ollama server named in `search.json` (`{ v: 1, url, model }`). `loadEmbedder` returns null when the file is absent, the url is not loopback, or a one-text call fails; loopback only, so no text leaves the machine (Requirement 4 AC 5). The request shape is not pinned: no embedding server is installed here, so the task that writes `embed.ts` probes one and pins the shape in its test fake.
- **Index files:** `advisor/index/projectId.json` (`{ v: 1, model, files: { relPath: { hash, chunks: [{ startLine, endLine, kind, date, vector }] } } }`, vectors base64 Float32); a model change drops the file.

### C7 — Second opinion (`src/advisor/opinion.ts`)
- **Interfaces:** `POST /api/controller/waits/:id/second-opinion` (operator credential) → 202; `startSecondOpinion(waitId, deps: { usageBlock(): { blocked: boolean; resumeAt?: string } })`. `Controller` gains a public `usageBlock()` returning its `windowBlock()` (`src/controller/controller.ts:373-388`), so the threshold is the controller's (`src/controller/controller.ts:85-86`).
- **Post-conditions:** 404 unknown wait; 409 `not-open`; 409 `running` when one is in flight for the wait; 409 `usage-window` with the reason when blocked (Requirement 5 AC 5). Otherwise: sets `opinionStatus` running, writes `advisor/opinions/waitId/stamp/brief.md` (questions, options, recommendation, rendered summary, word limits), and calls `runStep` (`src/controller/step.ts:350`) with role `sdd-advisor`, cwd the home `advisor/`, `maxTurns: 6`, `schema: OPINION_SCHEMA`, `mcpConfig: { mcpServers: {} }` (strict, so no MCP server; `src/controller/step.ts:372-374`), `noSessionPersistence: true`. It is not in `Controller.active` and not queued, so it takes no run slot. Valid result: schema match, each pick names a wait question and, where options exist, one of them; reasons at most 60 words, summary at most 100. Valid → `attachAdvice(id, opinion.summary, opinion)`, status cleared. Otherwise → `opinionStatus` failed with the classification or `invalid result`, advice and opinion untouched (Requirement 5 AC 7). Either way one `advisor.opinion` row with the five `StepUsage` fields. The call passes no `onRateLimit`, so the opinion's own spend reaches `rate-limit.json` only at the next scheduled step that wires it (`src/controller/controller.ts:413`); the lag is accepted. It never answers the wait, writes a run or touches the queue (Requirement 5 AC 3); `opinion.ts` is the only `runStep` caller with role `sdd-advisor` (Requirement 5 AC 4).
- **Wait writes:** `answerWait`, `attachAdvice` and the status write go through one in-process queue per wait id in `src/controller/waits.ts`, so an advice write never overwrites an answer read before it.

### C8 — Staged actions (`src/advisor/actions.ts`)
- **Interfaces:** `stageAction(input)`, `listActions(state?)`, `confirmAction(id, deps)`, `dismissAction(id)`, `actionEvents` (`change`). Routes, operator credential only: `GET /api/controller/actions`, `POST /api/controller/actions/:id/confirm`, `POST /api/controller/actions/:id/dismiss`; 409 on an action not `staged`.
- **Executor per kind:**
  - `merge`: a run on that project with this `pr` and an open `merge` wait → `answerWait` with `merge` by `advisor`; the run's merge pass applies the rule (`src/controller/merge.ts:729-753`); outcome `answered-wait`. Else `mergeByRule` (`src/controller/merge.ts:695-778`) with a full `MergeTarget` (`src/controller/merge.ts:542-551`) — `pr: { number, repoDir: workspacePath, branch }`, `runId` the action id, `projectId`, `spec`, `questionId: 'merge'`, `label` from the action — the project's rules (`src/controller/merge.ts:160-163`) with `merge: 'auto'`, and `MergeStageDeps` (`src/controller/merge.ts:136-150`) whose `ledger` is a synthetic `openRunLedger` (`src/controller/ledger.ts:95`) rooted at `advisor/actions/id/`, so the `pr.merged` row lands there, outside any `specs/*/harness-events.jsonl` (so a no-run merge is invisible to tallies). Any status but `merged` is `refused` with the rule's reasons (Requirement 6 AC 6).
  - `deploy`: spawn `scripts/sdd-self-update.sh` (`scripts/sdd-self-update.sh:1-24`) from the checkout root, detached, logged to `advisor/actions/id/deploy.log`; outcome `started`; the script reports its own failures.
  - `launch`: the launch route body (`src/dashboard/multi-server.ts:604-635`) moves into `launchSpec(projectId, input)`, called by route and executor, so the launch checks and `enqueue` (`src/controller/controller.ts:145-179`) apply (Requirement 6 AC 9).
  - `answer`: the route's unknown-question check (`src/dashboard/multi-server.ts:649-657`) moves into `checkAnswerKeys(wait, answers)`, then `answerWait(id, answers, 'advisor')` (`src/controller/waits.ts:90-116`; Requirement 6 AC 8).
  - `deferral`: `DeferralStorage.create` (`src/core/deferral-storage.ts:229-270`) and `checkpoint` (`src/controller/ledger.ts:233-245`) of that one file, inside one `withStoreLock` (`src/controller/state.ts:535-546`; Requirement 6 AC 10).
  - `decomposition`: under the same lock, replace the `### ` section whose heading holds the backticked slug, or insert before `## Build order` (else at the end), then `checkpoint` the file.
  - `backlog`: append one dated line to `owner-backlog.md` in the home; no commit.
- **Post-conditions:** Each confirm writes one `advisor.action` row (Requirement 6 AC 5). No stage tool exists for code, tests, commits or PRs (Requirement 6 AC 11). `merge: ask` in `agent-rules.md` is untouched (Requirement 6 AC 12). The shell feed sends a `controller-actions` topic (`src/dashboard/shell/shell-feed.ts:121-129`) and the hub re-arms it on `actionEvents` (`src/dashboard/harness/hub.ts:45-51`).

### C9 — Sources (`src/advisor/sources.ts`)
- `readSources()`; `seedSources()` writes the day-one file when absent: `~/repo/matthew-field.ca` (`repo`) and JobSync (`mcp`, `personal: true`, location `""` until the operator fills in its MCP url) (Requirement 8 AC 2). No controller code acts on source content.

### C10 — Conversation entry (`src/advisor/cli.ts`)
- **Interfaces:** `advisorCommand(args)` routed in `main` before argument parsing, beside `bootstrapCommand` (`src/index.ts:129-131`, `:394-398`); `runAdvisorCommand(args)` with `--remote-control`; `spec-workflow-mcp advisor commit --store path -m message -- paths` runs `checkpoint` inside `withStoreLock`, the way the advisor commits decisions (Requirement 9 AC 2). Route `POST /api/controller/advisor/open` (operator credential) → `{ state: 'live', name }` or `{ state: 'command', command }`.
- **`runAdvisorCommand`:** finds the dashboard url with `peekDashboardSession` (`src/core/dashboard-session.ts:153-177`), else exits 1; creates `advisor/` and `advisor/notes/`; seeds sources; makes a conversation UUID; writes mode 0600 `advisor/mcp.json` (one `type: 'http'` server at the dashboard url plus `ADVISOR_MCP_PATH`, `headers` with the advisor bearer and `x-sdd-conversation`; the `headers` key form is a task-phase probe) and `advisor/settings.json` (deny rules on the operator secret file for Read and Bash); writes the role body to `advisor/system.md`; spawns `claude` in `advisor/`, stdio inherited, with `--append-system-prompt-file`, `--model` and `--effort` from `loadRole('sdd-advisor')`, `--mcp-config`, `--strict-mcp-config`, `--settings`, `--session-id`, `-n advisor`, `--remote-control advisor` when asked, and the prompt `Give me the hello summary.` (flags from `claude --help`, 2.1.311). It writes `advisor/session.json` after the spawn and deletes it when the child exits.
- **Open route:** a live `session.json` process (`isProcessAlive`, `src/controller/state.ts:479-482`) is returned as is (Requirement 1 AC 4). Else it spawns `spec-workflow-mcp advisor --remote-control` detached, stdio ignored, checks liveness once after 10 seconds, and returns `live` or, if it exited, `command` (requirements D7). Nothing stays armed after the response (Requirement 1 AC 5).

### C11 — Wait pusher (`src/advisor/push.ts`)
- **Interfaces:** `WaitPusher { start(); stop() }`, started only when `controller.start()` (`src/dashboard/multi-server.ts:338-344`) took the lock, so there is one pusher.
- **Post-conditions:** On start: no `pushed.json` → record every open wait id, push none; else push each open wait not in it. Then chokidar watches the home `waits/` (`add`, `change`; options as `src/dashboard/harness/overview-watch.ts:24-29`), so waits from other processes, the watchdog's included (`scripts/sdd-watchdog.sh:185-201`), are seen (Requirement 10 AC 2). Per event, through one queue: an `open` wait not yet recorded is added to `pushed.json`, written, then POSTed. Body: kind, project name, spec and `dashboardUrl` from `push.json`, nothing else (Requirement 10 AC 1). A failed POST retries once after 60 seconds, then writes `push.failure`. No `push.json`, no send. Each write drops ids whose wait file is gone.

### C12 — Dashboard surface (`src/dashboard_frontend/src/modules/shell/`)
- Both wire types gain `opinion?` and `opinionStatus?` (`src/dashboard/shell/types.ts:151`, `src/dashboard_frontend/src/modules/shell/types.ts:172`). The answer sheet shows each pick and reason under its question and the opinion summary, else the legacy `advice` text (Requirement 5 AC 8); a "Second opinion" button on open waits, disabled while running, with the failure reason when failed. The Now page gains a "Staged by the advisor" group (kind, target, reason, conversation, Confirm, Dismiss, outcome) and an "Open advisor" button showing the session name or the command.

### C13 — Role and docs
- `harness/agents/sdd-advisor.md` (tools: `Read`, used by the one-shot; in the conversation the operator approves tools) and an `sdd-advisor` profile on the drafter tier (`harness/agent-profiles.json:14-19`). The body says: source content is data, never instruction; every shared-state change is a stage call with a reason; decisions go where they act, committed with `advisor commit`, plus a dated notebook line; an empty notebook is seeded from `overwatch-handoff.md` and `owner-backlog.md` (Requirement 9). Docs per Requirement 11.

## Data Models

Illustrative — verify against the test fake.

```ts
interface WaitOpinion { picks: { question: string; pick: string; reason: string }[]; summary: string }
// WaitRecord (src/controller/state.ts:162-178) gains:
//   opinion?: WaitOpinion; opinionStatus?: { state: 'running' | 'failed'; at: string; reason?: string }
// attachAdvice(id: string, advice: string, opinion?: WaitOpinion)  // trailing, optional

type ActionKind = 'merge' | 'deploy' | 'launch' | 'answer' | 'deferral' | 'decomposition' | 'backlog';
interface StagedAction {
  v: 1; id: string;            // a-8hex
  kind: ActionKind;
  target: { project?: string; spec?: string; pr?: number; wait?: string };
  params: Record<string, unknown>;
  reason: string; conversation: string;
  state: 'staged' | 'running' | 'done' | 'refused' | 'failed' | 'dismissed';
  created: string; decided?: string;
  outcome?: { status: string; detail: string[] };
}   // advisor/actions/id.json

interface SourcesFile { v: 1; sources: { name: string; kind: 'repo' | 'folder' | 'url' | 'mcp'; location: string; about: string; personal?: boolean }[]; personalProjects?: string[] }
interface PushConfig { v: 1; url: string; dashboardUrl: string }
interface PushedFile { v: 1; ids: string[] }
interface AdvisorSession { v: 1; pid: number; startTime: number; name: string; conversation: string; remote: boolean; started: string }
type HomeEvent =
  | { v: 1; ts: string; type: 'advisor.opinion'; wait: string; outcome: string; input: number; output: number; cacheRead: number; cacheWrite5m: number; cacheWrite1h: number }
  | { v: 1; ts: string; type: 'advisor.action'; action: string; kind: ActionKind; target: object; conversation: string; outcome: string; detail?: string }
  | { v: 1; ts: string; type: 'push.failure'; wait: string; detail: string };

// Read-tool responses (the code-built state of the world).
interface AdvisorSummary {
  openWaits: { kind: string; project: string; spec: string; ageMins: number }[];
  stuckRuns: { id: string; project: string; reason: 'error' | 'running' }[];
  openPrs: { project: string; pr: number; verdict: string }[];
  deferrals: { project: string; title: string }[];
  liveRuns: { id: string; project: string; phase: string; stepKind?: string }[];
  windows: { fiveHour?: RateLimitFile['fiveHour']; sevenDay?: RateLimitFile['sevenDay'] };
  week: Tallies['weeks'][string];
  sources: { name: string; about: string }[];
  push: 'on' | 'off';
  skipped: string[];                   // reads that threw
}
interface Tallies {
  weeks: Record<string, {              // key `2026-W43`
    tokens: { byAgent: Record<string, number>; bySpec: Record<string, number> };
    failures: Record<string, number>;  // StepClassification or `unknown`
    findings: Record<string, number>;  // level-2 heading → count
    floor: Partial<Record<'tokens' | 'failures' | 'findings', true>>;
  }>;
}
interface Hit {
  project: string; path: string; startLine: number; endLine: number;
  kind: string; date: string;
  textScore: number; meaningScore?: number; score: number;
}
interface SearchResult { hits: Hit[]; meaning: 'on' | 'off' | string }  // `indexing n of m` while embedding
```

## Error Handling

1. **Dashboard not running when `advisor` starts:** exit 1 with a message to start `spec-workflow-mcp --dashboard`; no session file.
2. **Advisor credential on any other route:** 401 `unauthorized`, today's body (`src/controller/access.ts:177`).
3. **Store path escape:** tool error `path outside the spec store`; nothing read.
4. **Second opinion fails or is invalid:** `opinionStatus` failed with the reason on the sheet; earlier advice kept; run untouched.
5. **Confirmed merge fails the rule:** action `refused` with the rule's reasons; nothing merged.
6. **Executor throws (lock busy, git error, unknown project):** action `failed` with the message, and its `advisor.action` row.
7. **Embedder unreachable mid-refresh:** refresh stops, the index keeps what it wrote, result says `meaning: "off"`.
8. **Push fails twice:** `push.failure` row; the id stays in `pushed.json`, so it never repeats. An unreadable `pushed.json` is treated as absent (baseline, no push).

## Testing Strategy

- **Unit (new, `src/advisor/__tests__/`):** `summary.test.ts` (each section, stale `running` run, torn project skipped and named, personal project hidden then included, 400-word cap); `tallies.test.ts` (ISO weeks, `sdd-advisor` usage, `unknown` and floor cells, findings per heading); `search.test.ts` with a fake `Embedder` (fusion and de-dup, filters, changed-only re-embed, deleted file dropped, text-only fallback, reworded query in the top ten); `actions.test.ts` with `scripts/stub-gh.mjs` (each kind, double confirm 409, dismissed never runs, row shape); `opinion.test.ts` with `scripts/stub-claude.mjs` (picks attached, invalid keeps advice, usage refusal, run and queue unchanged); `push.test.ts` (baseline, one push per new wait, a wait written by a child process, no repush on answer, advice or restart, retry then failure row, no config no send, body fields only); `mcp-endpoint.test.ts`; `cli.test.ts`.
- **Existing suites:** `src/controller/__tests__/access.test.ts` (advisor secret opens only the endpoint; 401 on confirm and login), `waits.test.ts` (existing `attachAdvice` assertions stay valid; the new argument is optional), `src/dashboard/__tests__/controller-waits-routes.test.ts`, `access-routes.test.ts`, `harness-routes.test.ts` (launch responses unchanged after the `launchSpec` move).
- **Invariants (verified, not red-first):** Requirement 5 AC 3 and Requirement 6 AC 12 hold at base; their tests are regression guards.
- **End-to-end:** `src/advisor/__tests__/advisor-e2e.test.ts` on a temporary `SDD_HOME`, a fixture project, the server on a scratch port, stub `claude` and `gh`, and a local capture server for pushes, runs entry checks 1-5 (check 3 with the fake embedder). Check 6, and check 3 with a real embedder, are live checks the operator records in `verification-evidence.md`.

## Decisions taken in this document

- D1 — The embedder is a local Ollama server named in a home config file: because it adds no native dependency and an absent server simply means meaning search is off.
- D2 — The push trigger is a file watch on the home waits directory plus a start-up scan: because the watchdog writes waits from another process and polling is ruled out.
- D3 — The first start records every open wait without a push: because a deploy must not send a burst for old waits.
- D4 — The advisor credential opens exactly one path, the MCP endpoint: because the endpoint already carries every read.
- D5 — The conversation id is a UUID the subcommand makes, used as the session id and sent as a header: because the model cannot misstate a header.
- D6 — A confirmed merge of a PR with no run uses the merge rule with the merge key set to auto: because one merge path keeps the checks identical.
- D7 — A confirmed merge of a run's PR under ask answers that run's merge wait: because the run then records the merge in its own ledger.
- D8 — A confirmed deploy runs the self-update script detached: because the script restarts the server that would wait.
- D9 — The one-shot gets the wait and summary inline, no MCP server and only the Read tool: because a one-shot that cannot stage cannot be steered into staging.
- D10 — The typed opinion rides a trailing optional argument of the advice attach, and the advice text becomes its summary: because existing callers stay valid.
- D11 — The wait record carries an opinion status: because the wait list already reaches the browser.
- D12 — The search index refreshes on search start and keeps embedding in process past 200 chunks: because a first index would break the three-second bound.
- D13 — Text search scans chunks in node and lists merge by rank fusion: because ripgrep is not a sure install and fusion needs no score scaling.
- D14 — A ledger result that is not a step classification counts as unknown: because the document phase writes the CLI subtype there.
- D15 — Personal marks live in the sources file: because the operator already edits it.
- D16 — Open advisor checks the spawned process once after ten seconds: because the requirement allows showing the command instead.
- D17 — A stuck run is one whose newest step log is older than fifteen minutes: because the record does not change while a step streams.
- D18 — The owner-backlog write is a plain append with no commit: because that file is not in a repository.
- D19 — Wait writes are queued per wait id in process: because an advice write that lands after an answer read would erase the answer.
- D20 — The advisor commits decisions through an advisor commit subcommand that holds the store lock: because decision commits are ordinary work, yet the lock lives in controller code.

## Scope notes

- Carried items from requirements: none.
- Deferred: a standing "watch X" one-shot (as in requirements).
- Not changed: the document phase keeps writing the CLI subtype into `spawn.usage` (`src/controller/phases/document.ts:375`); D14 counts it as unknown.
- Left to the tasks phase as probes: the Ollama request shape (no embedding server is installed here), the Bash-tool deny-rule form, and the mcp.json `headers` key form.
- Outside the repository: archiving `owctl` and deleting the retired home files stay operator steps (Requirement 11 AC 2).

## Revision History

- **v3** (2026-10-26) — SHOULD_FIX-only corrective pass.
  - **R2-1 — Accepted (SHOULD_FIX).** The summary sources row now carries each source's one-line description, not its location, so the listing matches Requirement 8 AC 3 and day-one JobSync renders its line, not a blank.
  - **R2-2 — Accepted (MINOR).** The summary week field now types one ISO week's cells, not the whole multi-week container, matching its name.
- **v2** (2026-10-26) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 1/1/3).
  - **R1-1 — Accepted (MUST_FIX).** C7 cites the controller threshold and windowBlock (the lint pass corrected the exact lines).
  - **R1-2 — Accepted.** Data Models pins AdvisorSummary, Tallies, Hit/SearchResult and the per-week floor map (Requirement 3 AC 3); C6 returns SearchResult.
  - **R1-3 — Accepted.** C8's no-run merge names the full MergeTarget and synthetic openRunLedger; its pr.merged row lands outside the spec ledgers.
  - **R1-4 — Accepted.** C10 and the scope-note probe list mark the mcp.json headers key a task-phase probe.
  - **R1-5 — Accepted.** C7 notes the opinion runStep passes no onRateLimit; its spend reaches rate-limit.json at the next scheduled step (lag accepted).
  - **Lint pass.** 2 fixed: windowBlock 375-390→373-388 and onRateLimit 415→413, plus the sibling threshold cite 87-88→85-86 — symbols the cited range missed. Rejected the rest as citation-identifier false positives (verified against the tree).
- **v1** (2026-10-26) — Initial draft.
  - **Lint pass.** 0 fixed; all 65 rejected as citation-identifier false positives (verified against the tree).
