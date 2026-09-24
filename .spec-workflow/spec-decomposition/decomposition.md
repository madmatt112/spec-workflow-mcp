# Spec Decomposition — worktree execution context

## Why this document exists

`worktree-execution-context` was authored as a single spec covering twelve requirements and fourteen design components. Three rounds of adversarial review each closed the prior round's findings properly and each introduced new ones. Both lead findings of the third round were **cross-component** — defects invisible when reading any single component:

- `log-implementation`'s attribution write erasing the diff base recorded by the dashboard endpoint, because two components wrote one file with no stated merge semantics.
- A relative `SPEC_WORKFLOW_HOME` anchored to the workflow root, which is uncomputable at `server.ts:56`, equals the workspace under `--no-shared-worktree-specs`, and does not exist for the dashboard.

That is a size signal rather than a diligence signal. The work is decomposed into three specs whose boundaries are the seams those defects crossed.

## Decomposition principles applied

- **Vertical slices.** Each spec delivers a behaviour a user can observe, not a layer.
- **Independent value.** Spec 1 fixes the correctness defect on its own; 2 and 3 improve signal and cost but are not preconditions for it.
- **Traceable interaction surface.** Each spec is small enough that a reviewer can hold every cross-component path in view.
- **Dependency-ordered.** 2 and 3 both consume the workspace path that 1 introduces.

## Specs

### 1. `worktree-execution-context` — correct execution context (active)

Makes code-touching operations run against the worktree an agent is actually in, while `.spec-workflow` operations stay on the shared root.

Carries R1 (identity inference), R2 (explicit override), R3 (typed two-root `ToolContext`), R4 (`review-task` root split and file partitioning), R6 (runners carry both roots), plus verifiability and migration for that surface.

**Independently valuable:** on its own this stops a task review from diffing and typechecking the wrong checkout — the defect the whole effort exists to fix.

**End-to-end verification.** Create a repository with two linked worktrees sharing one `.spec-workflow`, start an MCP server in each, then confirm all six:

1. Both worktrees appear as **distinct projects** in the dashboard, sharing one spec list — and both appear when the two servers are started **simultaneously**, which is what exercises the registry lock.
2. A task review triggered from worktree A diffs **A's** files and not B's, and typechecks A's tree — asserted on the compiled file list, not just the reported `tsconfigPath`.
3. A task whose implementation log records **bare relative filenames** produces a non-empty diff from a worktree. This is the regression guard for the deleted path pre-resolution.
4. An adversarial review triggered from a worktree **locates its target document** (it reads from the shared root while the runner spawns in the worktree).
5. A review whose logged paths all fail to resolve reports **no reviewable files and does not return a pass**.
6. **Non-worktree parity:** a single-checkout project with no path argument produces the same file sets, containment decisions, `tsconfigPath` and `projectId` as before the change — except where `realpath` differs from `resolve`, which is a documented migration consequence.

Plus the full check suite: `npm run build` (bare `tsc` over `src/**/*`), `npm test`, `npm run test:e2e:worktree` — confirming from the run output that **both** worktree suites executed, since the config's `testMatch` previously pinned only one.

### 2. `worktree-review-signals` — what the reviewer is told (deferred)

Everything concerning the accuracy of the signal a reviewing agent receives: the diff base, typecheck honesty, workspace attribution, and the disclosure channel that carries all three into the prompt.

Carries R5 (per-task diff base), R7 (typecheck degrades honestly), R8 (attribution), R9 (disclosures reach the reviewing agent).

**Depends on 1** for `ToolContext.workspacePath` and the file partition. **Deferred** because its components share one on-disk store and one disclosure object, which is exactly the coupling that produced the third round's lead finding; it deserves its own requirements pass rather than inheriting a design written under a larger scope.

**End-to-end verification (to be refined in its own requirements phase).** A task started and committed on a worktree branch produces a diff covering the committed work; a worktree with unresolvable dependencies reports a typecheck that is unavailable rather than a flood of fabricated module errors; a review of work logged in worktree A but triggered from B reports a workspace mismatch and still produces a verdict.

### 3. `worktree-dashboard-concurrency` — cost and safety under N worktrees (deferred)

Keeps the dashboard's work constant in the number of worktrees, and makes concurrent writes to shared state safe.

Carries R10 (shared per-workflow-root components) and the remainder of R11 — locking for the four shared-root files other than the registry, the staleness and atomic-break mechanics, and the global-directory location question.

**Depends on 1** for per-worktree identity, which is what makes N registry entries and N component sets exist at all. **Deferred** because what remains prevents duplication and contention that only become visible once 1 has shipped.

**End-to-end verification (to be refined in its own requirements phase).** With three worktrees registered on one workflow root, the dashboard constructs one spec watcher rather than three and a scheduled cleanup pass runs once rather than three times; removing one project leaves the survivors' watcher alive; a relative `SPEC_WORKFLOW_HOME` is rejected at startup with an error naming the absolute form.

**Correction after design review v4.** The original wording — "nothing in it is a correctness fix for the reviewing path" — was wrong for one item. Spec 1 gives each worktree a distinct `projectId`, which converts `registerProject`'s read-modify-write from a benign convergence into a **lost-registration race**: two agents starting together each read the registry without the other, and the second write erases the first, so one worktree never appears in the dashboard and none of spec 1's route contracts can fire for it. Spec 1 creates that contention and no user configuration avoids it, so **a minimal registry lock moved into spec 1** (its Requirement 6). Everything else stayed here.

One further dependency runs the other way and is recorded rather than moved: `getGlobalDir()` resolves a relative `SPEC_WORKFLOW_HOME` against `process.cwd()`, so per-worktree agents each get their own registry and the dashboard sees none of them. Spec 1's headline observable is unreachable in that configuration. This spec owns the anchor; spec 1 records the dependency in its Scope section.

## Harness efficiency specs

Step 2 of `docs/harness-efficiency-plan.md` (R1, R2, R5 of the Harness Spend Review). Three
server-side tools that take work off the LLM roles of the SDD harness. Each is a vertical
slice: a tool, the skill change that calls it, and the docs. Step 0's facts are settled in
`docs/step-0-answers.md`; do not re-check them.

### 4. `review-gate` — deterministic gate before any LLM verifier (active)

**Delivers.** A `review-task` action `gate` that runs what `prepare` runs today (typecheck,
hygiene, diff stats) plus the task's named checks (scoped tests, lint on touched files, each
as its own command), scores risk from the diff, and returns `gate: pass | fail`,
`risk: low | high` and the reasons. It can record a verdict of its own (`reviewer: gate`) so
the dashboard and `spec-status` still see every task reviewed. The implementation and
close-out skills call it first: gate fail ⇒ one implementer fix round with the gate's output
and no verifier; pass with risk low ⇒ record `pass`, tick the task; pass with risk high ⇒
spawn `sdd-verifier` with the gate's results in its brief and the instruction not to re-run
them. In close-out, `store` and `home` items never get an LLM verifier (the gate checks the
diff exists and touches only the named files); `harness` and `code` items go through the
gate.

**Decided.** Conservative default: risk is high whenever any sensitive path is touched, more
than about 200 changed lines, or a task that names tests changed no test file. The sensitive
path list (API routes, schemas, migrations, auth, config, billing) lives in the project's
`agent-rules.md` under a machine-read heading, next to the forbidden-terms list that already
works that way; with no list, every path is sensitive. The end-to-end verification at the
completion gate and the PR checks gate stay as they are.

**End-to-end verification.** A fixture spec with three tasks and an `agent-rules.md` naming
one sensitive path: (1) a task that edits only a Markdown file returns `pass`, risk low, and
`get-task-review` shows a recorded verdict with `reviewer: gate`; (2) a task that touches the
sensitive path returns risk high, and the implementation skill's verifier brief for it carries
the gate's results; (3) a task whose named check fails returns `gate: fail` with the failing
command's one-line result and no verdict recorded. Then `spec-status` shows all three tasks
reviewed once they complete, and `npm test` is green.

**Depends on** nothing in this document. Independent of 5 and 6.

### 5. `spec-lint` — machine checks before every review round (active)

**Delivers.** A `spec-lint` tool that checks one spec document and reports findings with file
and line: every `path:line` and `path:a-b` citation resolves under the code root and the range
is inside the file, and when the sentence names an identifier it appears in the range; the MDX
bare-bracket check the approval already runs; EARS shape for acceptance criteria; tasks shape
(numbered, `_Prompt` closed with `_`, `_Requirements` ids that exist in `requirements.md`);
word counts against the caps (requirements 3,500, design 4,000, task block 150 plus prompt);
and, for tasks, coverage: every design component appears in some task, and a task that uses an
artefact a later task creates names its bridge. The document skill runs it after every drafter
or reviser write; findings go to `sdd-reviser` before the reviewer is spawned, and the round
prompt then says citations and structure are machine-verified, verify meaning only. The round
prompt also carries the document's diff since the last checkpoint commit.

**Decided.** The lint is additive: it never approves or rejects a document on its own, and a
finding it cannot classify is reported as `info`. Caps are tool defaults matching the
templates; a project overrides them in `agent-rules.md`. Citation checks read the code root
the server already resolves (`ToolContext`), not a path in the document.

**End-to-end verification.** A fixture spec whose requirements carry one broken citation, one
bare angle bracket, one non-EARS criterion and 200 words over the cap, and whose tasks carry
one unclosed `_Prompt`, one `_Requirements` id that does not exist and one design component no
task names: the tool reports each of the seven with its line and nothing else; a clean fixture
reports zero findings. A document-phase run on the fixture shows the reviser brief with the
lint findings before round 1 and the round-1 prompt containing the diff since the v1
checkpoint. `npm test` is green.

**Depends on** nothing in this document. Independent of 4 and 6.

### 6. `harness-bookkeeping` — orient, briefs and events done by tooling (active)

**Delivers.** Two tools and two hook changes that let the orchestrators only route. `harness
orient` returns, for any spec and phase, the state the skill's Step 0 computes today (document
version D, latest analysis A, last verdict, post-cap marker, tasks done and open, the next step
to take) in one call. `harness brief` writes a brief from a named template with the values
filled; for an implementer brief it extracts the task block with the server's tasks parser.
The plugin's `PreToolUse` hook writes `spawn.start` from the brief path in an Agent prompt (the
path names the role) and `SubagentStop` writes `spawn.end`; the orchestrator keeps writing
only `round`, `task.pick`, `task.done`, `note` and `phase.*`, plus one usage event per spawn
with the token count from the Agent result. The watch renderer merges the two files as it does
today. The HANDOFF `## Phase log` table is rendered from `harness-events.jsonl` the way
`spec-index` renders INDEX, and the supervisor stops hand-writing rows. Budgets in the skills
assume the smaller orchestrator context (20 tasks, all items of a class).

**Decided.** `SubagentStop` carries no usage (`docs/step-0-answers.md`, answer 2), so tokens
stay an orchestrator-written event; the renderer sums them per spawn. Both tools live in the
server, not a plugin CLI, because the parsers, `spec-status` and the approvals snapshots are
there. `--watch` must keep working with ledgers written before this spec, and old HANDOFF
tables are left as they are: rendering starts at the first `phase.start` in the ledger.

**End-to-end verification.** (1) `harness orient` against a fixture spec at each of five
states (no document, mid-review, post-cap without narrow check, implementation with a `[-]`
task, close-out with open items) returns the step the corresponding skill's Step 0 chooses.
(2) `harness brief` for task 3 of the fixture writes a file whose task block equals the parser's
block for task 3, byte for byte. (3) A session with the hooks installed, spawning one `sdd-*`
agent with a brief path in its prompt, appends `spawn.start` and `spawn.end` with the right
role and no orchestrator call. (4) `--watch --once` on a copy of the `tags-and-setups` and
`calendar-and-breakdowns` ledgers from `tradr-hosted` renders every phase, spawn and token
total it renders today. (5) The phase-log renderer, run on `calendar-and-breakdowns`' ledger,
produces the rows its hand-written table holds for phases that ran under a ledger.

**Depends on** nothing in this document for correctness. **Last** because it changes every
skill and the hooks; 4 and 5 land first so their skill changes are not rewritten twice.

### 7. `question-gates` — two bounded human gates, headless-safe (active)

Step 3 of `docs/harness-efficiency-plan.md` (R7 of the Harness Spend Review). Two places
where a human confirms or overturns the machine's direction: gate A on the requirements'
recorded decisions, gate B on the task plan's consequential actions. Both read
`gates: block | record` from `agent-rules.md`, default block when interactive and record
when headless, and never stall an unattended run.

**Delivers.**

- **Gate A — requirements direction.** After the drafter writes requirements v1, before the
  first adversarial round, the supervisor presents the `## Decisions taken in this document`
  items (`requirements-template.md`), ranked by how much each sets direction (what is being
  built and for whom), and asks at most five with AskUserQuestion. Each changed answer is
  routed to the (Sonnet) `sdd-reviser` as a revision comment, which writes v2 before round 1;
  unchanged answers are recorded and dropped. The gate runs in the main session: the document
  orchestrator returns a new `gate-a` outcome carrying the extracted decisions, and the
  supervisor — which already owns AskUserQuestion (the retrospective conversation) — asks and
  re-spawns the orchestrator with the answers. When AskUserQuestion is absent or denied
  (headless, or the mobile Remote Control auto-deny), the gate writes the decisions and
  "no answer" to `questions.md`, writes a HANDOFF row, and proceeds to round 1 unchanged.

- **Gate B — task plan veto.** After the tasks document is approved, before implementation,
  the supervisor presents the task list plus one ranked **veto list**, most consequential
  first, combining: (a) irreversible / high-blast actions the tasks will perform — the paths a
  task declares it touches matched against `## Sensitive paths` in `agent-rules.md` (reusing
  `parseSensitivePaths`/`isSensitivePath` from `gate-rules.ts`), plus action keywords
  (migration, delete/drop, auth, billing, config, external write); (b) new external
  dependencies the tasks introduce; (c) tasks doing more than the approved requirements asked
  for. The human approves or annotates. Annotations run one tasks-revision round (advisory — no
  hard block, matching the retrospective conversation); an approve proceeds to implementation.
  Headless or denied: the veto list is written to `questions.md` and a HANDOFF row, and the run
  proceeds to implementation.

**Decided.**

- Gate A surfaces **direction-setting assumptions only** — the decisions that fix what is
  built and for whom — not every recorded decision, so five questions are spent where a wrong
  answer would waste the review rounds.
- Gate B's veto list is **one ranked list** of all three classes (irreversible actions, new
  dependencies, out-of-scope), most consequential first — not three separate lists.
- Objections are **advisory**: an annotation drives one revision round; neither gate
  hard-blocks the spec. The human's escape hatch is stopping the run.
- Both gates **proceed when unattended** (record mode): they never halt a headless or
  auto-denied run. A denied AskUserQuestion call is treated as record mode — it is not
  evidence of headless (step 0 answer 5, `docs/step-0-answers.md`); the supervisor already
  records `headless=yes` in the run ledger when the tool is absent.
- The gates live in the **supervisor** (`sdd-continue`), the only role with AskUserQuestion;
  the document orchestrator gains a `gate-a` return and the tasks orchestrator returns the
  computed veto list. Veto-list computation reuses `gate-rules.ts` and stays a pure, tunable
  module.

**End-to-end verification.** A fixture spec with an `agent-rules.md` carrying `gates: block`,
a `## Sensitive paths` entry, and requirements whose `## Decisions taken in this document`
holds five decisions of which two are direction-setting:

1. **Gate A, interactive.** A run reaching requirements v1 pauses and asks at most five
   questions; changing one direction-setting answer produces a v2 whose `## Decisions` reflect
   the change before any adversarial round runs, and the unchanged answers appear in
   `questions.md`.
2. **Gate A, headless.** The same run under `claude -p` (AskUserQuestion denied) does not
   stall: it writes the decisions to `questions.md`, a HANDOFF row, and proceeds to round 1 on
   v1 unchanged.
3. **Gate B, interactive.** After tasks approval the run shows a ranked veto list in which a
   task touching the sensitive path ranks above a new-dependency item above an out-of-scope
   item; an annotation runs exactly one tasks-revision round, then implementation begins.
4. **Gate B, headless.** The same point under `claude -p` writes the veto list to
   `questions.md` and a HANDOFF row and proceeds to implementation without stalling.
5. `npm test` is green and `claude plugin validate . --strict` passes.

**Depends on** `harness-bookkeeping` (spec 6) for the run ledger's `headless` flag and the
supervisor's report contract, and on `review-gate` (spec 4) for `gate-rules.ts` and the
`## Sensitive paths` convention. It is the last harness-efficiency spec; nothing depends on it.

## Harness operations specs

After the efficiency plan (`docs/harness-efficiency-plan.md`, steps 0 to 4). Three specs
decided on 2026-09-17 from a review of the twelve agents' model and effort settings, a wish
for a web control pane in place of the TUI for setting up and watching a run, and a wish to
run some roles on DeepSeek beside the Claude models; a fourth (11) decided on 2026-09-19 from
the TDD memo; a fifth (12) decided on 2026-09-21 from the graphify call count of the first
two Opus 4.8 runs; a sixth (13) decided on 2026-09-24 from the cache rewrites in those runs'
subagent transcripts. Numbers are identities, not order: the build order below is the order, and the
entries follow it. Facts settled on 2026-09-17, not to be
re-checked: `SubagentStop` carries `transcript_path` (the worker's own transcript, under
`<session>/subagents/agent-<id>.jsonl`) and no usage; that transcript's assistant entries
carry `message.usage` (input, output, cache creation, cache read) and `message.model`, in a
format Claude Code calls internal; agent frontmatter `effort` is honoured for plugin agents
and the Agent tool has a `model` override but no `effort` override; `ANTHROPIC_BASE_URL`,
`ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_MODEL` are process-wide, so every Agent-tool spawn in a
session uses the session's provider; DeepSeek's Anthropic endpoint maps `claude-opus*` to
`deepseek-v4-pro`, `claude-sonnet*` and `claude-haiku*` to `deepseek-flash`, and any other
name (so `claude-fable-5-1`) silently to `deepseek-flash`, ignores `budget_tokens`, and lists
MCP tools as unsupported (`https://api-docs.deepseek.com/guides/anthropic_api`).

### 8. `harness-usage-and-tiers` — tokens from the transcript, cheaper orchestrators (active)

Two things the ledger cannot do today: state what a spawn cost, and show what it ran on.
`spawn.usage` takes its `tokens` from the count the orchestrator reads off the Agent result
footer, and in the six runs on this store most of those rows say `unknown` or `na`; the
watch view shows model and effort from a table in `ledger.ts` that already disagrees with
the agent files (it shows the reviser as Opus xhigh; the file says Sonnet high; the checker is
missing). Without numbers, the tier question — are the orchestrators and the retro analyst
overkill at Fable xhigh — cannot be answered, and neither can spec 10's saving.

**Delivers.**

- **Usage from the transcript.** The plugin's `SubagentStop` hook reads the worker's
  transcript at `transcript_path`, sums `message.usage` over its assistant entries, and writes
  the sums on the `spawn.end` row it already emits: `input`, `output`, `cacheWrite`,
  `cacheRead`, `tokens` (their total), and `model` (the `message.model` seen, the actual model
  and not the declared one). Orchestrators are `sdd-*` agents spawned by the supervisor, so the
  same hook covers them. The orchestrator's `spawn.usage` keeps `role` and `result` and drops
  `tokens`; the skills and `formats.md` stop telling it to read the footer. A transcript the
  hook cannot parse yields `tokens=unknown`, never a missing row, since the format is internal
  to Claude Code and may change.
- **Declared tiers from the agent files.** `scripts/sync-plugin-assets.cjs` also writes
  `harness/agent-profiles.json` (name, model, effort, one-line role) from the agents'
  frontmatter, and `ledger.ts` reads that file instead of its hand-kept table. The watch view
  shows declared model and effort beside the actual model from the ledger, so a substitution
  (the Opus overlay of 2026-09-16, or a DeepSeek mapping under spec 10) is visible.
- **A usage report.** `harness` gains action `usage`: for one spec, or two specs side by side,
  a table of tokens and spawns by phase and by agent with the orchestrator share per phase,
  read from `harness-events.jsonl`. This is step 4 of the efficiency plan as a tool instead
  of a prompt.
- **The tier change.** The four orchestrators (`sdd-document-orchestrator`,
  `sdd-implementation-orchestrator`, `sdd-closeout-orchestrator`, `sdd-retro-orchestrator`) and
  `sdd-retro-analyst` move from `claude-fable-5-1` xhigh to `claude-opus-4-8` high. Nothing else
  moves: drafter and adjudicator stay Fable xhigh; reviewer, implementer and verifier stay
  Opus 4.8 xhigh; reviser and checker stay Sonnet 5 high.

**Decided.**

- Token counts come from the transcript, never from an LLM transcribing a footer. The hook
  is the single writer of per-spawn usage.
- Cache reads are reported apart from fresh input. The Max plan limit is the cost driver
  (`docs/harness-efficiency-plan.md`, rules), and the two are not the same thing under it.
- The orchestrators are the tier to cut: their work is to route (spec 6 took orient, briefs
  and events off them), they escalate rulings to the adjudicator, and they hold the longest
  contexts, so xhigh thinking on every tool call is where the spend compounds (one close-out
  orchestrator spawn on `spec-lint`: 388,958 tokens). Opus 4.8 high, not Sonnet, on the first
  cut; a second cut is a retro decision after one measured spec.
- Effort stays in the agent files; the Agent tool cannot override it. A per-run effort is out
  of scope here and in spec 9.
- Old ledgers keep rendering: `spawn.usage` rows that carry `tokens` are still summed when no
  `spawn.end` on the same spawn carries them.

**End-to-end verification.** (1) A session with the hooks installed spawns one `sdd-*` agent
with a brief path; its `spawn.end` row carries numeric `input`, `output`, `cacheRead`,
`cacheWrite`, `tokens` and `model`, and the total equals the sum over that transcript's
assistant entries, computed independently. (2) The same for an orchestrator spawned by the
supervisor. (3) `harness usage` on the `question-gates` ledger and on a fixture ledger written
under this spec prints one table each: tokens by phase and agent, orchestrator share per
phase, and `unknown` only where the source rows say so. (4) `--watch --once` on the
`review-gate` ledger renders every token total it renders today, and on the fixture ledger
shows declared Opus 4.8 high and actual `claude-opus-4-8` for an orchestrator row. (5) Agent
files, `plugins/` copies and `agent-profiles.json` agree: `npm run check:plugin-assets` and
`claude plugin validate . --strict` pass; `npm test` is green.

**Depends on** `harness-bookkeeping` (spec 6) for the hook-written `spawn.end` rows. Nothing
in this document depends on it for correctness; 9, 10, 11, 12 and 13 depend on it for their numbers.

### 10. `provider-per-role` — DeepSeek for chosen roles, Claude for the rest (active)

Every Agent-tool spawn uses the session's provider, and DeepSeek's endpoint maps every
Fable name to `deepseek-flash`, so pointing the session at DeepSeek would swap the whole
harness. What is wanted is one provider per role, per run, with the run ledger and the plan's
limit accounting telling them apart.

**Delivers.**

- **Provider per role.** A `## Providers` block in `agent-rules.md` names a provider per
  role: `anthropic` (default) or `deepseek`, with the DeepSeek model (`deepseek-v4-pro` or
  `deepseek-flash`). The supervisor reads it at Step 0 and records the map on `run.start`.
  When spec 9 lands, its `harness-run.json` carries the same map per run and overrides the
  block for that run.
- **A subprocess spawn path.** For a DeepSeek role the orchestrator does not call the Agent
  tool. It runs a launcher script (written by the supervisor next to `event.sh`) that spawns
  `claude -p` with the same brief, the agent's definition passed with `--agents` from
  `agent-profiles.json` and the agent file, the same tools, `--model` the DeepSeek name, and
  an environment of `ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic`,
  `ANTHROPIC_AUTH_TOKEN` from `DEEPSEEK_API_KEY`, and `ANTHROPIC_MODEL` set to the same name.
  The launcher writes `spawn.start` and `spawn.end` itself (no plugin hook fires in the parent
  for a separate process), with `provider=deepseek`, `model`, and usage from the child's
  transcript the way spec 8's hook reads it, and returns the worker's report on stdout so the
  orchestrator's next step is unchanged.
- **Eligible roles.** `sdd-reviewer` and `sdd-checker` first: file tools only, no MCP tool,
  and the reviewer is the most-spawned role per spec. Roles that call an MCP tool (reviser,
  implementer, verifier, drafter, adjudicator) stay on Anthropic until the preflight below
  says otherwise.
- **Accounting.** `harness usage` (spec 8) and the watch view show DeepSeek tokens under
  their provider and out of the Anthropic total, which is the number the Max plan limit
  applies to.

**Decided.**

- Provider is never set process-wide on the session that runs the harness. A DeepSeek role
  is a child process with its own environment; the session stays on Anthropic.
- The first task of the spec is a preflight, recorded as a step-0-style answer in `docs/`:
  (a) `claude -p` against DeepSeek with the reviewer definition reads a spec and writes an
  analysis in the review prompt's format with the verdict block; (b) the same with one MCP
  tool call (`adversarial-response`), to learn whether "MCP tools unsupported" means the API
  connector or Claude Code's client tools. (b) decides whether the reviser is eligible; no
  other role is promoted in this spec.
- DeepSeek ignores `budget_tokens`, so the agent's `effort` is not carried to it; thinking
  is on or off. The ledger records the declared effort as not applied.
- The key comes from the environment of the process that starts the run (terminal or
  dashboard), never from the spec store or the run file. A DeepSeek role with no key refuses
  at `run.start` with a `note`; the run does not fall back to Anthropic silently.
- A DeepSeek worker gets the same brief, the same tools and the same report contract as an
  Agent-tool worker, so a role can move back with one config line and no skill change.

**End-to-end verification.** (1) Preflight (a) and (b) run and their outcomes are written to
`docs/`. (2) A fixture requirements round with the reviewer on `deepseek-v4-pro`: the analysis
file exists in the round's format with a verdict block; the ledger has `spawn.start` and
`spawn.end` for it with `provider=deepseek`, the model name and numeric tokens; the reviser
round that follows runs on Anthropic through the Agent tool as today. (3) The same round with
every role on `anthropic` writes a ledger of today's shape (regression). (4) With
`DEEPSEEK_API_KEY` unset, a run with one DeepSeek role stops at `run.start` with a `note`
naming the role and the missing key, and neither the page nor the TUI shows a spawn. (5)
`harness usage` on the ledger of (2) reports the reviewer's tokens under `deepseek` and the
Anthropic total without them. (6) `npm test` is green and `claude plugin validate . --strict`
passes.

**Depends on** spec 8 (usage from the transcript, `agent-profiles.json`, provider-aware
`harness usage`). Spec 9 pre-fills its run form from the provider map, and spec 11's test
author is the next role eligible for it; neither depends on it for correctness.

### 13. `agent-cache-ttl` — a one-hour cache for agents that wait (active)

A subagent gets a five-minute prompt cache, also on a Claude subscription; the main session
gets one hour (`https://code.claude.com/docs/en/prompt-caching`, "Which TTL each request
gets", "Subagents and the cache"). An orchestrator spends most of a phase waiting for its
workers. When a wait is longer than five minutes, its cache expires and its next call writes
the full prefix again at the cache-write rate. Measured on the 194 subagent transcripts of
2026-09-21 to 2026-09-24 (the `provider-per-role` and `dashboard-layout` runs), one usage
per `message.id`: 91% of calls after a gap of 5 to 60 minutes wrote more than half of the
prefix again (93 of 102, 11.3M tokens), against 2% of calls after a shorter gap. The three
orchestrator roles made 92 of the 95 rewrites after a gap (implementation 49, document 41,
close-out 2); the worker roles made 1. The main sessions, on one hour, made 0 rewrites in 89
gaps of 5 to 60 minutes. Claude Code 2.1.248 and later (this machine runs 2.1.281) reads a
per-agent lifetime from frontmatter: `experimental: { cacheTtl: 1h }`. A one-hour write costs
2x the input rate, a five-minute write 1.25x, a read 0.1x. For the orchestrators in the
sample, one hour costs about 35% less than today (22.4M to 14.6M input-rate units): the
higher rate on each turn's new content is smaller than the full rewrites it removes. The
transcripts already split each write by lifetime (`usage.cache_creation.ephemeral_5m_input_tokens`
and `ephemeral_1h_input_tokens`), so the effect can be proved per spawn.

**Delivers.**

- **One hour for the agents that wait.** `sdd-document-orchestrator`,
  `sdd-implementation-orchestrator` and `sdd-closeout-orchestrator` carry
  `experimental: { cacheTtl: 1h }` in their frontmatter. Every other agent keeps the default.
  `scripts/sync-plugin-assets.cjs` copies the field to the `plugins/` agents and writes
  `cacheTtl` (`1h` or `default`) per agent in `harness/agent-profiles.json`; the watch view
  shows it beside the declared model and effort.
- **The lifetime a spawn got, on its row.** The `SubagentStop` hook writes three more fields
  on `spawn.end`: `cacheWrite5m` and `cacheWrite1h` (sums of the two `cache_creation` fields,
  one usage per `message.id`), and `gapRewrites` (the count of calls that came more than five
  minutes after the previous call and wrote more than half of the previous call's prefix).
  A transcript without `cache_creation` yields `unknown` for all three, never a missing row.
- **The report.** `harness usage` adds columns per agent and per phase: cache writes by
  lifetime and `gapRewrites`, so the retro reads the saving against `provider-per-role`,
  the last spec run without this one.
- **An override is visible.** Supervisor Step 0 records `cacheTtl` on `run.start`: `per-agent`,
  or the value that overrides the frontmatter when one is set (`FORCE_PROMPT_CACHING_5M=1`,
  `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`, or `subagentPromptCacheTtl` in a settings file,
  which Claude Code applies before frontmatter), or `unsupported` when `claude --version` is
  below 2.1.248. It warns once and carries on; it never stops a run for this.

**Decided.**

- Per agent, not global. `subagentPromptCacheTtl: 1h` would put every worker at the 2x write
  rate on every turn to save one rewrite in the sample. The retro orchestrator made 0 rewrites
  after a gap and stays on the default; moving it is a retro decision on this spec's numbers.
- No refresh timer. A keep-alive call every four minutes adds turns and output tokens, and an
  orchestrator blocked on its workers has no turn in which to make it. The frontmatter setting
  removes the cause.
- On usage credits Claude Code ignores a one-hour frontmatter value and returns to five
  minutes. Accepted: the harness runs within plan usage, and the rows show which runs fell back.
- The supervisor is a main session and already has one hour; nothing changes for it.
- DeepSeek children (spec 10) are out of scope; their cache behaviour is the provider's.

**End-to-end verification.** (1) The supervisor spawns an orchestrator on a fixture spec; the
orchestrator's transcript shows `ephemeral_1h_input_tokens` above 0 and `ephemeral_5m_input_tokens`
at 0 on its writes, and a worker it spawns shows the reverse. (2) An orchestrator that waits
more than ten minutes on a background worker reads at least 90% of its previous prefix from
cache on its next call, and its `spawn.end` row carries `gapRewrites` 0. (3) `cacheWrite5m`,
`cacheWrite1h` and `gapRewrites` on every `spawn.end` row of the fixture run equal sums
computed independently from the transcripts. (4) `harness usage` on the fixture ledger and on
the `provider-per-role` ledger prints the new columns, with `unknown` where the source rows
lack them. (5) A run with `FORCE_PROMPT_CACHING_5M=1` records that value on `run.start` and
warns once. (6) `npm run check:plugin-assets`, `claude plugin validate . --strict` and
`npm test` are green.

**Depends on** spec 8 for the hook-written `spawn.end` row and `harness usage`, and on the
`provider-per-role` close-out's P17 (one usage per `message.id` in the same hook) for exact
numbers; it lands after that close-out's PR, which changes the same hook. Nothing depends on
it for correctness; every later spec's token figures include its saving.

### 12. `graph-orientation` — workers orient from the code graph, not from cold reads (active)

Every worker that touches code starts from raw reads. Over the 284 worker transcripts in
this checkout's session directory, 27% of all tool-result bytes are `cat`, `sed` and `grep`
on the code root (drafter 2.7M chars over 436 calls, reviewer 2.4M over 555, reviser 1.2M
over 497); the spec store is 50%, the rest is checks and git. A graphify graph exists for
both code roots (`graphify-out/graph.json`: 2,713 nodes here, 8,531 in tradr) and nothing
under `harness/` names it: 4 graphify calls in 4,648 tool events across the last four runs,
all prompted by the global PreToolUse nudge, each a BFS dump cut at graphify's 2,000-token
default (60 of 331 nodes shown) and followed by the same raw reads. `graphify explain
"<symbol>"` answers in about 200 tokens with `[EXTRACTED]` edges that carry `file:line`. The
context file of spec 6 (`<spec dir>/codebase-context.md`,
`sdd-document-phase/references/briefs.md:50-59`) is the map every later worker reads first,
and the requirements drafter writes it from cold exploration. Nothing rebuilds the graph
during a run: on 2026-09-21 this checkout's graph was 19 commits behind HEAD.

**Delivers.**

- **A graph fact.** Supervisor Step 0 resolves `GRAPH: <path> | none`:
  `<CODE_ROOT>/graphify-out/graph.json`, or the main checkout's when `CODE_ROOT` is a
  worktree (the rule of `~/.claude/scripts/graphify-hook-guard.sh`), `none` when the file or
  the `graphify` binary is missing. The launch prompt carries it with `GRAPH_BEHIND: <n>` from
  `git rev-list --count <built_at_commit>..HEAD` (`built_at_commit` is a top-level key of
  `graph.json`).
- **A brief section by tooling.** When `GRAPH` is a path, the `harness` `brief` action
  (`src/tools/harness.ts`, `BRIEF_TEMPLATES`) adds `## Code graph` to every template, drafter
  to implementer and spec 11's test author: the path; the three calls with `--graph <path>`
  (`explain "<symbol>"` for one symbol and its edges, `path "A" "B"` for a chain, `query
  "<terms>" --budget 800` for an area, terms taken from the graph's labels); the rule (explain
  before opening a file, then read only the cited range to confirm it, never for the spec
  store); and the freshness line (`built at <sha>, <n> commits behind HEAD`; behind by more
  than 0, a `file:line` from the graph is a hint to confirm, not a citation). No graph, no
  section: the brief is byte-identical to today's.
- **The context file from the graph.** The requirements drafter builds `codebase-context.md`
  from `explain` and `query` output for each area the decomposition entry names, and reads a
  file only to confirm the range it cites; the shape of spec 6 stays. Design and tasks
  drafters extend it the same way. Reviewer, reviser, checker, implementer and verifier
  briefs say to `explain` a cited symbol before opening its file.
- **Freshness by tooling.** `graphify update <CODE_ROOT>` (the CLI's code-only path: AST, no
  LLM, no key) runs from the implementation and close-out orchestrators' per-task step after
  each implementer commit, and from the supervisor at run start when `GRAPH_BEHIND` is not 0,
  in both cases only when `CODE_ROOT` is the main checkout; a worktree reads the main
  checkout's graph and never writes it. `graphify-out/` stays untracked.
- **Counted.** The activity hook already logs every worker tool call with its summary
  (`harness-activity.jsonl`); `harness usage` adds a `graph` column, the count of `graphify`
  calls per agent, so the retro compares tokens and graph use per role against
  `agent-cache-ttl` (spec 13), the last run without this spec.

**Decided.**

- The graph is an index, not a source. A citation in a document or the context file still
  names a range the agent read; `[INFERRED]` edges are not citations.
- `explain` first, `query` capped at 800 tokens. The default query was measured at about
  1,800 tokens per call with most nodes cut; a targeted read is cheaper than that.
- The spec store stays out of the graph and `.graphifyignore` is unchanged. graphify's
  markdown extractor (`extractors/markdown.py`) yields one node per document and link edges,
  and spec documents cite in backticks, not links, so the structural layer holds nothing for
  them; the semantic layer needs an LLM pass per changed file (graphify `SKILL.md`, Step 3B),
  and the live documents change every review round and are read whole by design (52% of
  tool-result bytes since 2026-09-19, mostly the reviser re-reading the document it revises).
  The slow-changing files (`steering/`, `decomposition.md`, `deferrals/`, closed
  retrospectives) are read today by slug grep and line ranges (47 decomposition touches in
  four runs); a semantic graph of them for the drafter's and the retro analyst's cross-cutting
  questions is a retro decision on this spec's numbers, not part of it.
- One graph per code root, owned by the code root. `SPEC_STORE_REPO` ≠ `CODE_ROOT` is the
  normal case: tradr's store is tradr-hosted, which has no graph and needs none.
- Workers call the CLI through Bash, which every worker has: no MCP server, no agent
  frontmatter change.
- The global PreToolUse nudge (`graphify-hook-guard.sh`, in `~/.claude`) is outside the
  harness and unchanged; the brief section makes it redundant for workers. Its nudge on
  spec-store reads is a human to-do (a path filter in the wrapper).

**End-to-end verification.** (1) `harness brief` for every template on a fixture store with a
graph present writes `## Code graph` with the resolved path, the three calls and the
freshness line; with no graph, every template's output is byte-identical to the pre-spec
output. (2) A supervisor launch on a checkout without `graphify` carries `GRAPH: none` and
the run's ledger has today's shape. (3) A requirements phase on a fixture spec with a graph:
`codebase-context.md` cites only ranges that exist in the code root, and
`harness-activity.jsonl` shows the drafter's first `explain` or `query` before its first raw
read of the code root. (4) After an implementer commit on the fixture, `graph.json`'s
`built_at_commit` is HEAD. (5) `harness usage` on the fixture ledger prints the `graph`
column, and side by side with `agent-cache-ttl` prints that run's count from its activity
log. (6) `npm test`, `npm run check:plugin-assets` and `claude plugin validate . --strict`
are green.

**Depends on** `harness-bookkeeping` (spec 6) for the `brief` action and the activity log,
and on spec 8 for `harness usage`. Nothing depends on it; spec 11's test author gets the
section through the same template mechanism.

### 11. `tdd-task-loop` — a test author and a red-on-base proof for marked tasks (active)

The implementer writes a task's tests with or after its code, and nothing proves a test
failed before the code existed; the gate's only test signal is a word match on the task
block (`gate-rules.ts:298-311`). A test the implementing agent writes after the code shares
its blind spots and does not change outcomes (arXiv 2602.07900); weak tests make the next
fix round worse (ExecCritic). This spec adds independence and a negative control per task,
on the decisions of 2026-09-19 (`docs/tdd-implementation-research.md`, section 0.1).

**Delivers.**

- **The `Test:` line.** A task opts in with `- Test: <test path> — <public call>` after its
  `File:` lines. The parser promotes it to `tests[]`; a lint rule `task-test-seam` checks
  the path is a test path by the gate's rule and the seam is present, and notes a source task
  without one; the tasks reviewer gets one lens: the seam exists in the design or an earlier
  task, and the success criteria are assertable through it with values the requirements
  state. The tasks template carries the shape. Nothing else in the tasks phase changes.
- **The test author.** `sdd-test-author` (`claude-sonnet-5`, high; Read, Grep, Glob, Bash,
  Write, Edit), brief template `test-author` in `harness brief`. It reads the task block,
  the seam, the criteria and design sections the task cites, `codebase-context.md` and one
  existing test file; writes a contract block, then one test per success criterion with
  expected values from the criteria, through the seam only; runs the file and must see every
  test fail; commits the test file(s) only, `test(<spec>): task <N> red`; reports each test's
  red kind, `commit:`, and the flags `SEAM-DEFECT`, `RED-IMPOSSIBLE`, `RETRO:`. It creates no
  stubs.
- **The implementer under TDD.** Its brief carries the red tests. It makes them pass, does
  not edit the author's files (`TEST-AMENDED: <file> — <reason>` when it must), may add its
  own tests, runs the author's files last and reports `green: n/n`.
- **The proof in the gate.** `src/core/red-green.ts`, called by `handleGate` when the call
  carries `tdd: { testFiles, redCommit }`: the red commit touched only test paths; the
  author's files are unchanged since (`amended`); a detached worktree at `baseRef` with every
  `node_modules` of the code root mirrored as a symlink (or `red-on-base-setup:` from the
  agent rules); the author's files copied in and run alone with `tdd-test-command:` from the
  agent rules; the same on `HEAD`; the red classified from the runner output (assertion,
  structural, unknown); the worktree removed in a `finally`. Outcomes: assertion red and
  green pass; structural red, inconclusive and amended pass at risk high
  (`tdd-structural-red`, `tdd-inconclusive`, `tdd-amended`); a vacuous base run, a failing
  head run, or a red commit that touched source fail the gate. The recorded review gains a
  `tdd` block (files, seam, red commit, base, head, amended, judged); `spec-status` and the
  dashboard task view show it.
- **Jev in shadow.** `src/core/judge.ts` from the Jev note (one `fetch`, content-hash cache,
  `off | shadow | enforce` per site, fail open, a `judge` ledger event) and four questions on
  the author's test file against the criteria and the seam: `tautological`,
  `asserts_criteria`, `through_seam`, `mocks_internals`. Shadow in this spec: answers recorded
  in the `tdd` block and the ledger, nothing routes on them.
- **The loop.** The implementation-phase skill gains the author step before the implementer,
  the `tdd` argument on the gate call, the red section in implementer and fix briefs, and a
  verifier note to read an amended test against the criteria first. A task without a `Test:`
  line runs today's loop exactly.

**Decided.**

- A different agent writes the test than writes the code, and it never sees the
  implementation. Sonnet 5 high: the narrow-role tier of the efficiency decisions.
- The proof is code. Only facts change the gate's verdict; Jev raises risk at most, and only
  after one spec of shadow data sets its thresholds. Infrastructure never blocks: a git or
  setup error is `inconclusive`, and the verifier decides, as `no-diff` does today.
- Today's `scoreRisk` rules are unchanged. Three high-risk reasons are added; nothing in this
  spec lowers risk or skips a verifier. Whether an assertion-red, green, unamended task may
  skip the verifier is a retro decision after the first measured spec.
- No stubs: a stub is an invented interface. A structural red is allowed and raises risk.
- The implementer may amend an author test, must flag it, and the gate detects it from the
  diff whether flagged or not.
- One test per success criterion, all red before the implementer runs; no refactor step; no
  standalone TDD skill. Visibility is the gate's review record; the PR body and the ledger
  keep their shape, save the gate `note` carrying the base outcome word.
- Budget: a marked task may cost at most a third more than an unmarked one in price-weighted
  tokens (Sonnet at 0.4 of Opus), measured on the first dogfooded spec from `spawn.end` per
  role against the review-gate and spec-lint ledgers. The tasks phase gains one line per
  marked task and one reviewer lens, nothing else.
- Jev's key sits in this repository's `.mcp.json` env only; tradr stays `off`.

**Open, for gate A of this spec.** (a) `SEAM-DEFECT` routes through the design-defect stop, or
a narrower tasks-defect stop that re-opens only the tasks phase (recommended: design-defect
this round). (b) A per-project `red-on-base: off` key in the agent rules that keeps the author
and skips the proof at risk high (recommended: allow, default on). (c) Confirmation that the
test files and criteria this public repository already publishes may go to TypeSafe in shadow.

**End-to-end verification.** (1) A fixture spec of three tasks in a scratch store against this
checkout: one marked and honest; one marked whose behaviour already exists at the base
commit; one unmarked docs task. The implementation phase runs headless (`claude -p`): the
first task's record shows `base: assertion-red`, `head: pass`, `amended: false`; the second
fails the gate with `tdd: tests pass on base` and enters a fix round; the third spawns no
author and records no `tdd` block. (2) The ledger carries `spawn.usage role=author task <N>`
for the two marked tasks and one `judge` event each when a key is set, none when it is not.
(3) A spec with no `Test:` line produces a ledger and review records identical in shape to
today's (regression). (4) The proof takes under 30 seconds per task on this checkout. (5)
`npx tsc --noEmit`, `npm test`, `npm run check:plugin-assets` and `claude plugin validate .
--strict` pass, and `agent-profiles.json` lists the thirteenth agent.

**Depends on** spec 8 for per-role usage (the budget measurement) and `agent-profiles.json`
(the new agent's declared tier). Soft on 10: the author calls no MCP tool, so one line in the
provider map moves it to DeepSeek. Spec 9's task view shows the `tdd` block when 9 lands.

### 9. `harness-control-pane` — set up, launch and watch a run in the dashboard (active)

The dashboard (`src/dashboard`, Fastify and a websocket; `src/dashboard_frontend`, React)
shows specs, approvals and reviews but nothing of a harness run; the run is watched in the
`--watch` TUI and launched by hand with `continue the sdd process` or a `claude -p` script.
This spec adds a Harness page that does both, on the data layer the TUI already has.

**Delivers.**

- **Run setup.** The page lists the specs of the project with their state (the roadmap's
  `INDEX.md` order and the live phase from HANDOFF, as the supervisor reads them) and a form
  for one run: spec, model per role (declared value from `agent-profiles.json` pre-filled;
  the Agent tool's aliases and full ids allowed), provider per role (the `## Providers` map
  of spec 10 pre-filled), worktree yes or no, gates block or record.
  Effort is shown read-only with the reason. Submitting writes `.spec-workflow/harness-run.json`
  in the spec store.
- **The supervisor honours it.** `sdd-continue` reads `harness-run.json` at Step 0 when it
  exists, passes each role's model to the Agent tool's `model` override, records the overrides
  on `run.start`, and deletes the file when the run ends. A run started from the terminal with
  no file behaves as today.
- **Launch and stop.** A route spawns `claude -p` with the `continue the sdd process` prompt
  through the dashboard's existing child-process pattern (`adversarial-runner.ts`: scrubbed
  git env, `cwd` the checkout or worktree, both roots on the env), records the pid and run id,
  and streams stdout and stderr to the page. Stop sends SIGTERM; the supervisor's existing
  interrupt handling writes `run.end`. One live run per spec store; the hooks' pointer file
  (`~/.local/state/sdd/active-run`) is the lock the route checks and the page shows.
- **Live view.** The server watches `harness-events.jsonl`, `harness-activity.jsonl`, HANDOFF
  and `tasks.md` with the watcher `src/watch/index.ts` uses, builds `RunModel` with
  `buildModel` from `src/watch/ledger.ts`, and pushes it over the existing websocket on
  change. The page renders what `render.ts` renders: phase rows, the spawn tree with tokens
  and model, rounds, task picks, the ticker, plus the recorded answers of a gate that ran in
  record mode (`questions.md`).

**Decided.**

- Built into the existing dashboard, not a new app or a second server. The TUI stays
  (`--watch` is must-keep) and shares `ledger.ts`; `render.ts` is not touched.
- Model per role is per run; effort is not. The Agent tool has no effort override, and a
  per-run effort would mean rewriting the plugin cache (the 2026-09-16 overlay), which is a
  workaround and not a feature.
- A launched run is headless (`claude -p`), so the question gates of spec 7 run in record
  mode: the pane shows the recorded decisions and veto list, it does not answer them. Gates
  answered from the pane are a later spec that needs a resume path in the supervisor.
- The dashboard runs the harness only as a child process, never in-process, so a crashed run
  cannot take the dashboard down and a stop is a signal.
- Secrets never pass through the page; the child inherits the dashboard's environment.

**End-to-end verification.** (1) With the dashboard open on a fixture project, the Harness
page lists the specs in roadmap order with the live spec's phase and the declared model per
role. (2) Launching the fixture spec with one role's model changed to `sonnet`: `run.start`
appears on the page within five seconds and carries the override; as the ledger grows, the
phase row, spawn tree, round rows and ticker update without a reload, and the overridden
role's spawn row shows actual model `claude-sonnet-5` (spec 8). (3) Stop ends the process,
`run.end` is written, the pointer line is removed, and the page shows the run as stopped;
launching again while a run is live is refused with the live run id. (4) `--watch` on the
same store during (2) shows the same rows as the page. (5) A terminal run with no
`harness-run.json` produces a ledger identical in shape to today's. (6) `npx tsc --noEmit`,
`npm run build` and `npm test` are green; the page works at phone width.

**Depends on** spec 8 for tokens and declared tiers on the page (soft: the page renders
without them), on spec 10 for the provider map the form pre-fills (soft: the field defaults
to `anthropic`), and on `harness-bookkeeping` (spec 6) for the pointer file and hook events.

## Build order

1 → (2 and 3 in either order). 2 and 3 are independent of each other.

4 → 5 → 6 → 7 in that order. Each is independently shippable and gets its own release; 6
changes every skill and the hooks, so it lands before 7. Spec 7 (`question-gates`) is the
plan's step 3 and runs after 6 is released — which it now is (5.7.0).

8 → 10 → 13 → 12 → 11 → 9 in that order, after 2 (`worktree-review-signals`, live on 2026-09-17)
closes. 8 first because 10, 13, 12, 11 and 9 are judged on its numbers. 10 second: it needs
only 8's `agent-profiles.json` and usage, and its provider map lives in `agent-rules.md` until
9 exists. 13 third: it is the smallest (three frontmatter lines, three hook fields, one usage
column), it has the largest measured saving per line changed, and every later spec's figures
include that saving, so 12 and 11 are measured with it in place; it lands after the
`provider-per-role` close-out PR, which changes the same hook. 12 fourth: it is small (the launch facts, the brief action, the drafters' context-file
step, one usage column), 13's run is its baseline, and every later worker, 11's
test author included, orients through it. 11 fifth: its budget is measured with 8's per-role usage, and its author role is the
next candidate for 10's map. 9 last: it renders 10's `provider` and 11's `tdd` block. Each is
its own release, and the spec after 11 is the first to run with `Test:` lines.

## Boundary notes

- **`TaskStateStore` belongs to 2, not 1.** Spec 1 records nothing per task.
- **The registry's *location* belongs to 3**, with its *content* (per-worktree identity, realpath normalization) in 1. Spec 1 registers correctly; spec 3 makes concurrent registration safe and decides where the global directory lives.
- **Typecheck root selection is in 1** (it must run in the workspace); **typecheck honesty is in 2** (whether its output can be trusted). The split is deliberate: 1 makes it run in the right place, 2 makes it tell the truth about whether it ran.
- **The execution-context disclosure object is in 2.** Spec 1 emits no new reviewer-facing channel.
- **Per-spawn usage is in 8, its display is in 8 and 9.** Spec 9 renders `RunModel`; it adds no
  ledger field. Spec 10 writes the same fields for its child processes and adds `provider`.
- **Per-role provider is in 10, the per-run file is in 9.** 10 defines the provider map in
  `agent-rules.md`; 9 defines `harness-run.json` with `model` and `provider` per role and
  makes it override the map for one run.
- **The red-on-base proof is in 11; the verifier-need decision is not.** 11 adds three
  high-risk reasons and a `tdd` block; it changes no existing `scoreRisk` rule and skips no
  verifier. A skip on a proven task is a retro decision after the first measured spec.
- **`judge.ts` is born in 11, in shadow, for one site.** The verifier-need gate, lint triage
  and the narrow-check swap of `docs/jev-integration-research.md` are later specs that reuse
  the module.
- **Cache lifetime is in 13, usage accounting is in 8.** 13 sets the lifetime per agent and
  adds three fields to the row 8's hook writes; it changes no model, effort or brief.
- **Orientation is in 12, judgement is not.** 12 changes where a worker starts reading and
  what its brief tells it; it changes no review lens, no gate rule, no verifier decision and
  no document cap.
- **The TUI is not replaced.** 9 adds a second consumer of `ledger.ts`; `render.ts` stays.

## Open question deferred to spec 2

R7 AC 6 requires new typecheck `unavailable` reasons to be added to a byte-pinned methodology constant whose drift test compares against a different spec's gitignored requirements file. That criterion moves to spec 2 and is to be amended there, with the resulting divergence recorded as a deferred decision against `tighter-reviews`.
