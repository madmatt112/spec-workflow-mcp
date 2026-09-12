# SDD Harness

The SDD harness is a Claude Code plugin that runs the spec-driven development
workflow of this server without a human at the dashboard. One command takes the active
spec from wherever it stands to the end of its retrospective, then stops. The next run
starts the next spec.

It ships in this repository as the plugin `spec-workflow-harness` and is also bundled
into the two MCP plugins. Its source of truth is the `harness/` directory at the
repository root.

## What it is

- A **supervisor** skill, `sdd-continue`, that runs in the main session. It resolves
  the roots, finds the active spec and its live phase, spawns one orchestrator agent at
  a time, and holds the retrospective conversation with you.
- Three **orchestrator** agents, one per phase kind: `sdd-document-orchestrator`
  (requirements, design, tasks), `sdd-implementation-orchestrator`, and
  `sdd-retro-orchestrator`. Each is spawned fresh, carries its phase skill, and reports
  in a fixed contract.
- Seven **worker** agents with pinned models and per-role tool allowlists:
  `sdd-drafter`, `sdd-reviewer`, `sdd-reviser`, `sdd-adjudicator`, `sdd-implementer`,
  `sdd-verifier`, `sdd-retro-analyst`.
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
  ├─ implementation ─ sdd-implementation-orchestrator ─ (implementer → verifier → fix*)* → gate → INDEX → PR
  └─ retrospective  ─ sdd-retro-orchestrator ─ findings → analyst proposals → conversation → plan
```

Document phase, per version:

1. v1 by `sdd-drafter`, then `approvals request`.
2. Round: `adversarial-review` (with `verdictBlock: true`), the orchestrator tailors
   the prompt, `sdd-reviewer` writes the analysis and the verdict block.
3. `converged` (or MINOR only) ⇒ approve. `iterate` ⇒ `sdd-reviser` writes v(N+1)
   in place, one new approval request, next round.
4. A standoff (a Recurring MUST_FIX rejected twice running) is ruled on by the
   orchestrator and recorded.
5. Cap at v9: `sdd-adjudicator` fixes or rules out every open item as v10; one narrow
   check by `sdd-reviewer` verifies the list; approval always follows.
6. Approve the final version, `prune` the superseded records and their snapshots,
   delete the per-round prompts, analyses (except the last) and briefs, keep the
   rolling memory file, write HANDOFF, commit.

Implementation phase, per task: mark `[-]`, `sdd-implementer` implements and logs,
`sdd-verifier` reviews through `review-task` (`prepare` then `record`), up to three fix
rounds, then `sdd-adjudicator` once, then mark `[x]`. Completion gate: end-to-end
verification, `spec-index generate`, HANDOFF with deferral numbers, commit, push, PR.
Never merge.

Retrospective: the orchestrator compiles `retrospective.md` (every finding with an
evidence reference), `sdd-retro-analyst` writes `retrospective-proposals.md`, the
supervisor asks you the `DECISION NEEDED` questions and which proposals to approve, and
writes `retrospective-plan.md`. Nothing from the plan is implemented in the same run.
Headless runs write the plan as `DRAFT — decisions needed` and stop.

Budgets: a document orchestrator runs at most three review rounds per spawn and an
implementation orchestrator at most six tasks; then it reports `resume` and the
supervisor spawns a fresh one. More than twelve spawns for one phase is an error.

## Report contract

Every orchestrator ends its final message with:

```
PHASE: approved | complete | resume | escalate | design-defect | verify-failed | error | retro-ready
SPEC: <slug>
STAGE: requirements | design | tasks | implementation | retrospective
STATE: v<N> | tasks <done>/<total> | n/a
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
| `reviews/adversarial-memory-<phase>.md` | the reviewer, per round | yes |
| `reviews/adversarial-analysis-<phase>[-rN].md` | the reviewer | only the last one per phase |
| `reviews/adversarial-prompt-<phase>[-rN].md` | the orchestrator | deleted at phase end |
| `reviews/*-brief-<phase>*.md` | the orchestrator | deleted at phase end |
| `retrospective.md`, `retrospective-proposals.md`, `retrospective-plan.md` | retro orchestrator, analyst, supervisor | yes |

`HANDOFF.md` (at `.spec-workflow/HANDOFF.md` if it exists, else at the spec store
repo root): the supervisor owns the routing header and the `## Phase log` table;
orchestrators own one `## <spec> — <stage>` section each. `INDEX.md` is never edited
by hand; the harness regenerates it with `spec-index`.

Approval records: one `request` per document version, so the dashboard keeps the
version history. At phase end the approved record stays and every other record for
that document is rejected (if still pending) and deleted, with its snapshots.

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

Two lines are machine-read:

- `worktree-per-change: required` — the supervisor enters a worktree before
  implementation.
- A `## PR body` section whose bullet list of forbidden terms the implementation
  orchestrator greps the PR body for before `gh pr create`.

Keep it short and imperative. Every worker reads it on every spawn.

## Model policy

| Role | Model | Effort |
| --- | --- | --- |
| Supervisor (main session), the three orchestrators, `sdd-drafter`, `sdd-adjudicator`, `sdd-retro-analyst` | Fable 5.1 (`claude-fable-5-1`) | xhigh |
| `sdd-reviewer`, `sdd-reviser`, `sdd-implementer`, `sdd-verifier` | Opus 4.8 (`claude-opus-4-8`) | xhigh |

Models are pinned in each agent's frontmatter with full model ids. Skills never pass a
`model` parameter to the Agent tool and never use `subagent_type: fork` (a fork runs
on the parent's model). The `opus` alias is never used: it resolves to the newest Opus.

## Developing the harness

Edit `harness/` only. `npm run sync:plugin-assets` copies it into the three plugin
roots (`npm run build` does this too); `npm run check:plugin-assets` fails in CI when
the copies drift. `claude plugin validate <plugin root> --strict` validates each
plugin; `claude plugin validate . --strict` validates the marketplace.
