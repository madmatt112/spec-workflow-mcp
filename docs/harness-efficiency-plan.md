# Harness efficiency plan

Written 2026-09-13. Full analysis and evidence: the "Harness Spend Review" artifact
(https://claude.ai/code/artifact/a22ded8d-b5eb-4cc7-9513-550bffba039f). A Claude session
can read it with the Artifact tool. The decisions behind it are in project memory
(`harness-efficiency-decisions`).

Goal: about a third fewer tokens per spec, similar cut in wall clock, same checks that
matter. Priority order when things conflict: tokens, then wall clock.

## Rules for the whole plan

- One step at a time. Finish, merge, refresh, measure, then start the next.
- Harness skill changes reach tradr only after the plugin is refreshed there
  (uninstall, then install at the same scope). The preflight warns on drift.
- Server changes reach tradr only after an npm release and a session restart.
- Change `tradr-hosted` templates only between runs, never while a document phase is open.
- Keep: the ledger and `--watch`, a fresh agent per round and task, one PR per spec.

## Step 0 — Confirm five settings (30 minutes, can run alongside step 1)

Prompt:

> Check these five Claude Code facts from current docs and report yes/no with a URL each:
> (1) the Agent tool's `schema` option works for plugin-defined agent types spawned from a
> skill; (2) the SubagentStop hook payload carries token usage; (3) `subagentPromptCacheTtl`
> exists as a setting and how the longer TTL is billed; (4) how the Max plan weights Sonnet
> against Opus and Fable tokens; (5) `claude -p` runs never have AskUserQuestion.

Watch for: (1) decides whether R8 schema output happens in step 3. (4) decides how much
R6 is worth. Nothing else blocks.

**Done 2026-09-13.** Answers with URLs are in `docs/step-0-answers.md`; do not re-run
this step. What they change:

- (1) No: the Agent tool has no `schema` option. Step 3 keeps the text report contract.
- (2) No: `SubagentStop` carries no usage. In step 2, hook-written `spawn.end` events
  carry no tokens; the orchestrator's `spawn.end` from the Agent result footer stays
  the token source.
- (3) Yes: `subagentPromptCacheTtl` exists (`5m` or `1h`); the 1h write costs more.
  Only R8 cache hygiene depends on it, and no step schedules that yet.
- (4) No published weight. Step 4 measures R6 in tokens and minutes only.
- (5) No: AskUserQuestion is present in `claude -p` but denied without a permission
  host, and absent inside subagents. Step 3's gates cannot detect headless by the
  tool being missing; they read `gates:` from agent-rules.md and treat a denied call
  as record mode.

## Step 1 — Skills-only changes, one PR (R3, R4, R6, R8, budgets)

Prompt:

> Read docs/harness-efficiency-plan.md and the Harness Spend Review artifact. Implement
> step 1 on branch `feat/harness-diet-1`: cap document review at v4 with adjudication at v5
> and a Sonnet 5 `sdd-checker` agent for narrow checks; carry ruled-out SHOULD_FIX items
> into the next drafter brief; `sdd-reviser` to Sonnet 5 at high effort; mechanical roles
> at high not xhigh; drafter brief word caps (requirements 3,500, design 4,000, task block
> 150 plus prompt) and a required `codebase-context.md` that every later brief names as
> the first read; lean default templates in the server (narrative sections out, caps in);
> one approval request per phase instead of per version; budgets 20 tasks and all
> open items of a class for close-out; update docs/SDD-HARNESS.md and the model table.
> Run sync:plugin-assets, check:plugin-assets and `claude plugin validate . --strict`.
> Plan mode first: show me the file list before editing.

Watch for:

- The file list should be about a dozen files under `harness/`, `src/` templates and
  `docs/`. More than that means scope drift.
- `check:plugin-assets` and `claude plugin validate` pass. CI green.
- The approval-per-phase change must not break `spec-status` routing (it reads the newest
  approval record per document).

Done when: PR merged, version bumped if templates changed, plugin refreshed in tradr,
and `tradr-hosted/.spec-workflow/templates` updated to match (new documents only).

Sequencing: merge and refresh before step 1b. Do not touch `tradr-hosted` templates
while calendar's requirements phase is open.

## Step 1b — Measurement run: finish calendar-and-breakdowns under the new skills

Prompt (in a tradr session):

> continue the sdd process

Watch for:

- Requirements: it resumes at round 3 or 4. If round 4 iterates, the adjudicator writes
  v5 and `sdd-checker` runs the narrow check. Confirm the approval response says `cap: hit`.
- Design and tasks: word counts under the caps; `codebase-context.md` exists; reviewer
  rounds at or below 2.
- The Sonnet reviser: read one of its Revision History blocks. Rejections must still
  carry a reason that survives the next reviewer. If it accepts everything, raise it back
  to Opus before step 2.
- Implementation and close-out still run as before (R1 and R5 are not in yet).

Done when: the spec is CLOSED and its retrospective exists. Its ledger is the
"after step 1" dataset.

## Step 2 — Server work through the harness, three specs in this repo (R1, R2, R5)

First, in this repo, fix the spec-workflow MCP connection (it failed to connect on
2026-09-13) and confirm `spec-index generate` answers.

Prompt to write the decomposition entries:

> Add three specs to .spec-workflow/spec-decomposition/decomposition.md, in this order,
> each with delivers, verification scenario, decided, depends: (1) `review-gate`:
> `review-task` action `gate` that runs typecheck, hygiene, diff stats and the task's named
> checks, scores risk from diff size, files touched and a sensitive-path list read from
> agent-rules.md, records its own verdict, and lets the implementation and close-out
> skills skip the LLM verifier on low risk; (2) `spec-lint`: a tool that checks citations
> (path and line range exist, named identifier in range), MDX brackets, EARS and task
> shape, word caps, and design-to-task coverage, run by the document skill after every
> write, with the document diff since the last checkpoint added to the round prompt;
> (3) `harness-bookkeeping`: `harness orient` and `harness brief` tools, spawn events
> written by the plugin hooks from the brief path, the watch renderer merging them, and
> the HANDOFF phase log rendered from harness-events.jsonl. Then regenerate INDEX.

Then, for each spec in order:

> continue the sdd process

Watch for:

- Each spec should converge by v3 or v4 under the step-1 skills. If requirements runs
  past v4 twice in a row, stop and look at what the reviewer keeps finding.
- `review-gate` requirements must pin the conservative default: risk high on any
  sensitive path, more than about 200 changed lines, or a task naming tests with no test
  file changed.
- `harness-bookkeeping` must keep `--watch` working with old ledgers. Its verification
  scenario should replay tags-and-setups' files.
- `harness-bookkeeping`: hook-written spawn events carry no token usage (step 0 answer
  2, `docs/step-0-answers.md`). Keep the orchestrator's `spawn.end` as the token source.
- One PR per spec. Release after each merge; restart tradr's session before the next
  harness run there.

Sequencing: R1 first (largest saving), then R2, then R5. R5 last because it changes every
skill and the hooks. Do not start step 3 before R5 is released.

## Step 3 — Question gates and schema output (R7, R8), by hand

Prompt:

> Read docs/harness-efficiency-plan.md step 3. On branch `feat/harness-diet-3`: add gate
> A after requirements v1 (extract "Decisions taken in this document", ask up to five with
> AskUserQuestion, route changed answers to a Sonnet reviser before round 1) and gate B
> after tasks approval (present tasks and the veto list; approve or annotate; annotations
> run one revision round). Both read `gates: block | record` from agent-rules.md; record
> mode writes `questions.md` and a HANDOFF row and proceeds. Default block when
> interactive, record when headless. If step 0 confirmed schema output for plugin agents,
> replace the text report contract with a JSON schema on every Agent call. Sync, check,
> validate, PR.

Watch for: a headless run must not stall at a gate. Test with `claude -p` once before
merging. In an interactive run, gate A should show you five questions, not fifty.
Step 0 (`docs/step-0-answers.md`) already answered the two facts this step depends on:
the Agent tool has no `schema` option, so skip the JSON schema clause; and
AskUserQuestion exists but is denied in bare `claude -p`, so a gate must treat a denied
call as record mode rather than test for the tool's absence.

## Step 4 — Measure

Prompt (in a tradr session, after the next spec closes):

> Compare harness-events.jsonl for tags-and-setups, calendar-and-breakdowns and the
> newest spec: tokens and minutes by phase and by agent, review rounds per document,
> verifier spawns skipped by the gate, orchestrator share. Report as one table and say
> which of R1 to R8 delivered and which did not.

Watch for: orchestrator share under 20% of a phase; verifier spawns under half of task
count; requirements under 1M tokens. If a change did not deliver, revert it in the next
retro rather than tuning it. R6 is judged on tokens and minutes only: Anthropic
publishes no Sonnet-to-Opus weight (step 0 answer 4, `docs/step-0-answers.md`).
Compare the Sonnet reviser's tokens per round (review-gate ledger: nine spawns,
1.23M tokens, about 137K per round) against the Opus-reviser rounds in the tradr
ledgers (tags-and-setups, calendar-and-breakdowns); this store had no Opus baseline
(review-gate retro P14).

## Step 5 — Cache lifetime for agents that wait (R9), spec `agent-cache-ttl`

Added 2026-09-24 from the transcripts of the provider-per-role and dashboard-layout runs.

A subagent gets a five-minute prompt cache, also on a Claude subscription. The main
session gets one hour (`https://code.claude.com/docs/en/prompt-caching`, "Which TTL each
request gets"). An orchestrator waits for its workers. When a wait is longer than five
minutes, the cache expires, and the next call writes the full prefix again.

Measured on 194 subagent transcripts (2026-09-21 to 2026-09-24):

| Gap before a call | Calls | Calls that wrote the prefix again | Tokens written again |
| --- | --- | --- | --- |
| Less than 5 minutes | 5,217 | 118 (2%) | 5.4M |
| 5 to 60 minutes | 102 | 93 (91%) | 11.3M |

The three orchestrator roles cause 92 of the 95 rewrites after a gap (11.2M tokens). The
worker roles almost never wait more than five minutes. The main sessions have 0 rewrites
in 89 gaps of 5 to 60 minutes, because their cache lives one hour.

Claude Code 2.1.248 and later lets an agent file set its own cache lifetime with
`experimental: { cacheTtl: 1h }` in the frontmatter. A one-hour cache write costs 2x the
input rate, a five-minute write costs 1.25x, and a cache read costs 0.1x. For the
orchestrators in the sample, a one-hour cache costs about 35% less than today: the higher
rate on each turn's new content is smaller than the full rewrites it removes.

Do this through the harness as spec `agent-cache-ttl` (decomposition entry 13): set a
one-hour cache on the orchestrator agents only, record the cache lifetime per spawn, and
count rewrites after a gap in `harness usage`. A refresh timer (a call every four minutes
to keep a five-minute cache warm) is not the first choice: it adds turns and output
tokens, and the frontmatter setting removes the cause.

Watch for: rewrites after a gap of 5 to 60 minutes fall to near zero for orchestrators;
orchestrator cache-write tokens per phase fall; worker roles do not change. If usage goes
over the plan limit, Claude Code ignores a one-hour frontmatter value while it uses usage
credits, so those runs return to five minutes.

## What each change is, in one line

- R1 Deterministic gate before any LLM verifier; verifier only on high risk.
- R2 Machine lint of citations, structure and coverage before each round; diff in the prompt.
- R3 Cap at v4, adjudicate at v5, narrow check on Sonnet.
- R4 Lean documents with caps; codebase narrative in a separate context file.
- R5 Orient, briefs, spawn events and HANDOFF rows done by tooling, not the orchestrator.
- R6 Sonnet 5 for the reviser and narrow checks; mechanical roles at high effort.
- R7 Two bounded question gates, headless-safe.
- R8 Schema output, one approval per phase, close-out batching, cache hygiene.
- R9 One-hour prompt cache for agents that wait on workers; rewrites after a gap counted.
