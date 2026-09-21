# SDD Harness

The SDD harness is a Claude Code plugin that runs the spec-driven development
workflow of this server without a human at the dashboard. One command takes the active
spec from wherever it stands through its retrospective and the close-out of the approved
retrospective plan, then stops. The next run starts the next spec.

It ships in this repository as the plugin `spec-workflow-harness` and is also bundled
into the two MCP plugins. Its source of truth is the `harness/` directory at the
repository root.

## What it is

- A **supervisor** skill, `sdd-continue`, that runs in the main session. It resolves
  the roots, finds the active spec and its live phase, spawns one orchestrator agent at
  a time, and holds the retrospective conversation with you.
- Four **orchestrator** agents, one per phase kind: `sdd-document-orchestrator`
  (requirements, design, tasks), `sdd-implementation-orchestrator`,
  `sdd-retro-orchestrator` and `sdd-closeout-orchestrator`. Each is spawned fresh,
  carries its phase skill, and reports in a fixed contract.
- Eight **worker** agents with pinned models and per-role tool allowlists:
  `sdd-drafter`, `sdd-reviewer`, `sdd-reviser`, `sdd-adjudicator`, `sdd-checker`,
  `sdd-implementer`, `sdd-verifier`, `sdd-retro-analyst`.
- A fifth skill, `sdd-deferrals`, that works the deferred-decision queue. It is invoked
  by name only and is never part of "continue the sdd process".

The harness approves its own documents. It uses the `approvals` tool's `approve`,
`reject`, `list` and `prune` actions and the per-document approval state that
`spec-status` reports (server 5.2.0 or later). There is no human gate before
implementation: the retrospective conversation is the one checkpoint per spec.

## Phase flow

```
continue the sdd process
  │
  ├─ preflight: model, server (spec-index generate), agent prefix
  ├─ roots: spec store = projectContext.workflowRoot, code = cwd (worktree aware)
  ├─ active spec: INDEX routing (## Next), decomposition fallback
  ├─ live phase: spec-status approval flags
  │
  ├─ requirements ─┐
  ├─ design        ├─ sdd-document-orchestrator ─ drafter → (reviewer → reviser)* → approve → prune → clean
  ├─ tasks        ─┘
  ├─ implementation ─ sdd-implementation-orchestrator ─ (implementer → verifier → fix*)* → gate → INDEX → PR → CI gate
  ├─ retrospective  ─ sdd-retro-orchestrator ─ findings → analyst proposals → conversation → plan APPROVED
  └─ closeout       ─ sdd-closeout-orchestrator ─ per target repo: (implementer → verifier → fix*)* → PR → plan CLOSED
```

Document phase, per version:

1. v1 by `sdd-drafter`, which also writes or extends `codebase-context.md` (the map
   of the files the spec touches, one line each with a citation; every later worker
   reads it first). Checkpoint commit, then the Lint step — a `spec-lint` pass whose
   findings a reviser fixes in place, committed `docs(sdd): <SPEC> <PHASE> v<N> lint`
   (it consumes no version cap).
2. Round: `adversarial-review` (with `verdictBlock: true`), the orchestrator tailors
   the prompt, `sdd-reviewer` writes the analysis and the verdict block. The tailored
   prompt carries a Machine-verified bullet naming the `spec-lint` checks that ran and a
   `## Changes since <version>` diff of what changed since the last reviewed version.
3. `converged` (or MINOR only) ⇒ approve. `iterate` ⇒ `sdd-reviser` writes v(N+1)
   in place, checkpoint commit, the Lint step, next round. When a round on the second or later reviewed
   version returns no MUST_FIX but some SHOULD_FIX, the reviser writes a SHOULD_FIX-only
   corrective version, `sdd-checker` verifies the listed items, and approval follows — no
   further review round.
4. A standoff (a Recurring MUST_FIX rejected twice running) is ruled on by the
   orchestrator and recorded.
5. Cap at v4: when the fourth reviewed version still iterates, `sdd-adjudicator`
   fixes or rules out every open item as v5; one narrow check by `sdd-checker`
   verifies the list; approval always follows. A SHOULD_FIX the adjudicator rules
   out is carried into the next phase's drafter brief through the HANDOFF section.
6. One `approvals request` for the final version, then approve it, `prune` any
   superseded records and their snapshots, delete the per-round prompts and briefs,
   keep the analyses, the rolling memory file and `codebase-context.md`, write
   HANDOFF, commit.

Documents are written for agents first and capped: requirements about 3,500 words,
design about 4,000, each task block 150 words plus its prompt. The default templates
carry the caps; the drafter reports its word count, `spec-lint` raises a `doc-words`
finding on an over-cap document, and the reviewer treats an overrun as a SHOULD_FIX.

Implementation phase, per task: mark `[-]`, `sdd-implementer` implements and logs, then
the `review-task` gate runs first (`action: gate`) for a deterministic pass/fail verdict
and a low/high risk score. A `gate: fail` starts a fix round; a `pass` at `risk: low`
records the review and completes the task; a `pass` at `risk: high` spawns `sdd-verifier`
to review through `review-task` (`prepare` then `record`). Up to three fix rounds, then
`sdd-adjudicator` once, then mark `[x]`. Completion gate: end-to-end
verification, `spec-index generate`, HANDOFF with deferral numbers, commit, push, PR.
Never merge. One PR per code repository per spec: a second one is a decomposition
finding (a retro-log `deviation` and a deferral), never a second PR.

PR checks gate: the orchestrator then waits for the PR's checks (`gh pr checks --watch`
in a script, at most ten minutes per call and thirty in all). All green ⇒ `complete`.
A red check starts a reconcile round: the failing job's log tail goes to
`sdd-implementer` with the instruction to reproduce locally first, `sdd-verifier`
re-runs that check locally, the orchestrator pushes to the same branch and watches
again. Cap three rounds, then `sdd-adjudicator` once, then `verify-failed` with
`REASON: ci: <check>`, which the supervisor's repair path picks up. Each round is a
retro-log entry (`bug`, or `tool-error` for CI infrastructure).

Retrospective: the orchestrator compiles `retrospective.md` (every finding with an
evidence reference), `sdd-retro-analyst` writes `retrospective-proposals.md`, the
supervisor asks you the `DECISION NEEDED` questions and which proposals to approve, and
writes `retrospective-plan.md` as `APPROVED`. The conversation implements nothing; the
close-out phase does. Headless runs write the plan as `DRAFT — decisions needed` and
stop; the next interactive run holds the conversation.

Close-out: `sdd-closeout-orchestrator` reads the `APPROVED` plan and works one item per
approved proposal, grouped by target: the spec store (steering, rules, templates,
decomposition conventions), the harness's own repository (skills, agents, server code,
docs), the product code, and `~/.claude` (memory). Each group lands by its repository's
rules: direct commits on the spec store's branch; a worktree on branch
`chore/<spec>-retro` and one PR per code repository, never merged; in-place edits under
`~/.claude`, never `settings.json` (those become to-dos). `sdd-implementer` works a
batch of up to eight items; the `review-task` gate then runs on every `done` item for a
pass/fail verdict and a low/high risk; `sdd-verifier` reviews only the `harness`/`code`
items that pass at `risk: high`, while a `store` or `home` item is `ok` on a gate pass;
fix rounds cap at three, then `sdd-adjudicator` once.
Every proposal gets one line under `## Close-out` in `retrospective-plan.md`
(`done — <commit>`, `to-do (human) — <reason>`, `skipped — <reason>`, plus one line per
PR); when every proposal has one, the plan's status becomes `CLOSED` and the spec is
finished. A proposal the agent cannot land is an explicit to-do; it never blocks the
close. The harness's own repository is found through the local marketplace checkout the
plugin was installed from; the supervisor's preflight also warns when the installed
plugin differs from that checkout, so a merged but unrefreshed plugin is visible.

Budgets: a document orchestrator runs at most four review rounds per spawn and an
implementation orchestrator at most twenty tasks; then it reports `resume` and the
supervisor spawns a fresh one. A close-out orchestrator works every open item of every
class in one spawn, one implementer batch per class. More than twelve spawns for one
phase is an error.

## Report contract

Every orchestrator ends its final message with:

```
PHASE: approved | complete | closed | resume | escalate | design-defect | verify-failed | error | retro-ready
SPEC: <slug>
STAGE: requirements | design | tasks | implementation | retrospective | closeout
STATE: v<N> | tasks <done>/<total> | items <done>/<total> | n/a
NEXT: <one line>
REASON: <one line, required for escalate, design-defect, verify-failed, error>
```

The supervisor acts on `PHASE` only. `escalate` stops the run; it is used for an
`ESCALATE:` line from a reviewer that names security, secrets, auth bypass, data loss,
destructive migrations, money, billing, pricing, legal or compliance. Anything else a
reviewer escalates is treated as a finding.

Every stop prints `<project>:<spec> <phase> <state> — <one line>`. The full set of
formats (verdict block, HANDOFF rows, retro-log entries, worker reports) is in
`harness/skills/sdd-continue/references/formats.md`.

## Artifacts the harness writes

Under `.spec-workflow/specs/<spec>/`:

| File | Written by | Kept |
| --- | --- | --- |
| `retrospective-log.md` | every orchestrator, append-only | yes |
| `codebase-context.md` | the drafter of each document phase (created at requirements, extended later) | yes |
| `reviews/adversarial-memory-<phase>.md` | the reviewer, per round | yes |
| `reviews/adversarial-analysis-<phase>[-rN].md` | the reviewer | only the last one per phase |
| `reviews/adversarial-prompt-<phase>[-rN].md` | the orchestrator | deleted at phase end |
| `reviews/*-brief-<phase>*.md` | the orchestrator | deleted at phase end |
| `retrospective.md`, `retrospective-proposals.md` | retro orchestrator, analyst | yes |
| `retrospective-plan.md` (`Status: DRAFT` → `APPROVED` → `CLOSED`, with a `## Close-out` line per proposal) | supervisor, then the close-out orchestrator | yes |
| `harness-events.jsonl`, `harness-activity.jsonl` | the run's event script; the plugin hooks | yes |

`HANDOFF.md` (at `.spec-workflow/HANDOFF.md` if it exists, else at the spec store
repo root): the supervisor owns the routing header and the `## Phase log` table;
orchestrators own one `## <spec> — <stage>` section each. `INDEX.md` is never edited
by hand; the harness regenerates it with `spec-index`.

Approval records: one `request` per document phase, filed for the version being
approved. Earlier versions live in the checkpoint commits, not in approval records, so
the dashboard shows one record per document rather than a per-version history (a
deliberate trade for one fewer tool round-trip per round). At phase end `prune` still
runs, so records left by older per-version runs are rejected (if still pending) and
deleted, with their snapshots.

## Installing

The repository is a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`)
with three plugins under `plugins/`:

| Plugin | Contents | Use when |
| --- | --- | --- |
| `spec-workflow-harness` | agents and skills; **no** MCP server | your project configures `spec-workflow` in its own `.mcp.json` (the common case; avoids two servers loading) |
| `spec-workflow-mcp` | the same harness plus an `.mcp.json` that runs `npx -y @madmatt112org/spec-workflow-mcp@latest .` | you want the server and the harness from one plugin |
| `spec-workflow-mcp-with-dashboard` | as above, dashboard variant | as above |

Register the marketplace once, then install a plugin for a project:

```bash
claude plugin marketplace add /path/to/spec-workflow-mcp      # or the GitHub repo
claude plugin install spec-workflow-harness@spec-workflow-mcp-marketplace --scope project
claude plugin details spec-workflow-harness
```

`--scope project` writes to `.claude/settings.json`; use `--scope local` for
`.claude/settings.local.json` when the project's settings file is shared or public.
Restart the session after installing. Plugin components are namespaced: the skill is
`/spec-workflow-harness:sdd-continue`, the agents are
`spec-workflow-harness:sdd-reviewer` and so on. The supervisor finds the prefix at
run time, so the same skills work under any of the three plugins.

### From a checkout, no plugin

When you develop the harness or the server, run both from your working copy instead.
Nothing is copied, so a merged change is live after a rebuild and a session restart,
and the server and the harness always come from the same commit.

1. Build once: `npm install && npm run build`.
2. In each project's `.mcp.json`, replace the `npx` command with
   `"command": "node", "args": ["<checkout>/dist/index.js", ...]`, keeping any path
   argument or `SPEC_WORKFLOW_SHARED_ROOT` env you already pass. Keep the server name
   `spec-workflow` so the tool names stay `mcp__spec-workflow__*`.
3. Run `scripts/dev-link.sh`. It symlinks every `harness/agents/*.md` into
   `~/.claude/agents/`, every `harness/skills/*` into `~/.claude/skills/`, and adds the
   `PreToolUse`, `SubagentStart` and `SubagentStop` hook entries for
   `harness/hooks/sdd-activity.sh` to `~/.claude/settings.json` (absolute path; the
   plugin's `hooks.json` uses `${CLAUDE_PLUGIN_ROOT}`, which does not exist here).
4. Uninstall any harness plugin at every scope (`claude plugin uninstall
   spec-workflow-harness@spec-workflow-mcp-marketplace --scope <user|project|local>`
   from each project), or you get the agents twice, once prefixed and once bare.
5. Restart your sessions. Agents and skills are read at session start.

Under this layout the agents are unprefixed (`sdd-reviewer`), the skill is
`/sdd-continue`, and the supervisor's preflight reports the prefix as `none` and the
checkout as `HARNESS_REPO`. After a change under `src/`: `npm run build`, then restart.
After a change under `harness/`: restart only.

Then, in a session opened in the project (or in a worktree of it):

```
continue the sdd process
```

or `/spec-workflow-harness:sdd-continue`. Headless:

```bash
claude -p "continue the sdd process" --model fable --effort xhigh --permission-mode auto
```

The supervisor refuses to start on a model below Fable 5.1 and tells you which
commands to run.

## Workspace contract

- The **spec store root** is what the server reports as `projectContext.workflowRoot`
  (the directory ending in `.spec-workflow`). Every `.spec-workflow/...` path resolves
  against it. Configure the server with `SPEC_WORKFLOW_SHARED_ROOT` when the store lives
  in another repository than the code.
- The **code root** is the working directory the session started in, a worktree when
  you are in one. Workers do their source work there.
- No skill ever passes `projectPath` to an MCP tool.
- If `agent-rules.md` contains `worktree-per-change: required` and the session is not
  in a worktree, the supervisor enters one named after the spec before the first
  implementation spawn.

## Writing `agent-rules.md`

`<spec store root>/agent-rules.md` is optional. When it exists, every worker brief
starts with `Read and obey <path> first.` Put in it the rules a fresh agent working in
your repository must know and cannot derive from the code: which git binary and
commit flags to use, what never to run, where scratch files go, which tools to prefer
for orientation, what a PR body may and may not say, which test commands are safe.

Four lines are machine-read:

- `worktree-per-change: required` — the supervisor enters a worktree before
  implementation.
- A `## PR body` section whose bullet list of forbidden terms the implementation
  orchestrator greps the PR body for before `gh pr create`.
- A `## Sensitive paths` section whose bullet list of repository paths the `review-task`
  gate reads; a change that touches any listed path scores `risk: high`.
- A `## Word caps` section whose bullets `requirements`, `design` and `task` override the
  `spec-lint` word caps.

Keep it short and imperative. Every worker reads it on every spawn.

## Model policy

| Role | Model | Effort |
| --- | --- | --- |
| Supervisor (main session, no agent file, outside the generated profiles) | the session's model, at least Fable 5.1 (`claude-fable-5-1`) | the session's effort |
| Orchestrators (four), `sdd-retro-analyst` | Opus 4.8 (`claude-opus-4-8`) | high |
| `sdd-drafter`, `sdd-adjudicator` | Fable 5.1 (`claude-fable-5-1`) | xhigh |
| `sdd-reviewer`, `sdd-implementer`, `sdd-verifier` | Opus 4.8 (`claude-opus-4-8`) | xhigh |
| `sdd-reviser`, `sdd-checker` | Sonnet 5 (`claude-sonnet-5`) | high |

The reviser dispositions a numbered list and edits in place; the checker verifies a
list of items. Both are narrow, well-specified jobs, so a Sonnet-class model at high
effort does them. The open-ended roles (review, implement, verify) stay on Opus.

Models are pinned in each agent's frontmatter with full model ids. `scripts/sync-plugin-assets.cjs`
reads that frontmatter into `harness/agent-profiles.json`, the generated source the watch
view reads for the orchestrators, the analyst and the workers; CI's `check:plugin-assets`
fails when it drifts. Skills never pass a `model` parameter to the Agent tool and never use
`subagent_type: fork` (a fork runs on the parent's model). The `opus` alias is never used:
it resolves to the newest Opus.

## Watching a run

`spec-workflow-mcp --watch <spec store repo>` draws the run in progress for the active spec
in the terminal and redraws on every change: the phases with their verdicts and approvals,
the live phase expanded to the current orchestrator spawn, the worker under it with its model,
effort, role, elapsed time, an age badge (minutes since its last tool call: amber at 5, red at
15) and the tool call it is making now, the next queued tasks, tokens spent so far, and a
four-line ticker of the latest events. `q` quits. Watch only: it changes nothing.

```bash
npx -y @madmatt112org/spec-workflow-mcp@latest --watch /home/mcf/repo/tradr-hosted
npx -y @madmatt112org/spec-workflow-mcp@latest --watch /home/mcf/repo/tradr-hosted --spec tags-and-setups --once
node <checkout>/dist/index.js --watch /home/mcf/repo/tradr-hosted     # from a checkout
```

Two append-only files under the spec directory feed it, both committed with the spec store:

- `harness-events.jsonl`: run, phase, spawn, round and task events the supervisor and the
  orchestrators write through the run's event script (schema in
  `harness/skills/sdd-continue/references/formats.md`). This is the run's history too.
- `harness-activity.jsonl`: exact agent start and stop and one line per tool call of
  every `sdd-*` agent, written by the plugin's `PreToolUse`, `SubagentStart` and
  `SubagentStop` hooks (`hooks/sdd-activity.sh`). The hook exits at once for any other agent
  and for sessions without an active run, so it costs nothing outside the harness.

Phases that finished before a ledger existed come from `HANDOFF.md`'s `## Phase log`, so a
spec built before 5.3.0 still shows its history. The `SubagentStop` hook measures each
spawn's tokens from the transcript and writes them on its `spawn.end` row; the watch header
sums them, and `harness usage` splits them by kind; there is no dollar estimate.

## Developing the harness

Edit `harness/` only. `npm run sync:plugin-assets` copies it into the three plugin
roots (`npm run build` does this too); `npm run check:plugin-assets` fails in CI when
the copies drift. `claude plugin validate <plugin root> --strict` validates each
plugin; `claude plugin validate . --strict` validates the marketplace.

Run the harness you are editing from the checkout (Installing, "From a checkout, no
plugin"), not from an installed plugin: a plugin install copies the files at install
time and reads agent frontmatter from the marketplace source, so an edit is picked up
only after an uninstall and install, and only partly. From the checkout, an edit is live
at the next session start. Cut a release when you want to publish, not to use a change.

An orchestrator (or any agent) that calls the `harness` tool must allowlist it in its
frontmatter `tools:` list, in all three plugin-name variants
(`mcp__spec-workflow__harness` and its two `mcp__plugin_…__harness` forms).
