# Controller design

Status: draft, 2026-10-10, revised the same day after the adversarial review
(`docs/foundation-review-adversarial.md`). For Matthew's review. The "how" behind the decisions in
`docs/foundation-review.md` and ADRs 0001 to 0005. Design level only. Each step of the plan
gets its own task breakdown when it starts. Terms are from `GLOSSARY.md`.

## 1. The shape in one paragraph

The controller is a module of the dashboard server process. It holds the queue, starts runs
when it has capacity, and carries each run through its phases with loops written in code.
Each model step is one fresh headless `claude` process that the controller spawns with a
role, a brief and a report schema, and that exits with a typed result. The controller writes
the ledger, the approvals and the spec-store artifacts itself. When a run needs the operator
it writes a wait and moves on to other work. The operator answers waits, launches specs and
reads state in the dashboard. No model is in the control loop.

## 2. Process

- One process: `spec-workflow-mcp --dashboard`. It already owns the HTTP and WebSocket
  surface, the project registry, the watchers and the launcher.
- It runs as a user service that starts at login and restarts on failure (a systemd user
  unit on WSL2 with linger enabled). The exact unit is a step (b) task.
- Restart safety is a design rule, not a feature. All controller state is on disk before a
  step starts. On start, the controller reads every run record, checks each in-flight step's
  process, and resumes or fails the step. A restart in the middle of a run loses nothing.
- The controller never replaces itself with an untested build. After a merge in this
  repository the post-merge step builds into a staging directory, boots that build once in a
  scratch process with a smoke check (it starts, serves its health route, reads the home),
  and only then swaps it in and restarts. On failure the old build keeps running and the
  controller writes an `error` wait naming the commit. In-flight steps are external
  processes with their own session ids, so they survive a restart either way.
- A watchdog outside the controller: the service unit restarts it on exit, and a small
  heartbeat check (a cron on the box, not a model) pushes one notification when the health
  route has been down for ten minutes or the unit has restarted three times in an hour.
  Liveness of the controller itself never comes from the controller.

## 3. State

Two homes, one rule each.

- **Spec store (git).** Everything an operator reads later: documents, analyses, review
  records, gate files and the rendered `questions.md`, the retro files, deferrals,
  `harness-events.jsonl`. Unchanged formats. The controller commits them as the skills do
  today.
- **Harness home (`~/.local/state/sdd`, spec 20's layout).** Everything that is machine
  state: `runs/<run-id>/run.json` (project, spec, status, phase, step cursor, worktree,
  session id and PID of the in-flight step, started and updated times, pause reason),
  `waits/<wait-id>.json` (see section 7), `queue.json` (ordered run ids waiting for a slot),
  and the per-step logs. Each record carries a `v` field. One writer: the controller.

The active-run pointer file goes away. The controller knows which runs are live because it
owns their processes. `--watch` keeps reading the ledger and needs no pointer.

## 4. A step

A step is one role doing one job: draft requirements v1, review design v2, implement task 7,
verify task 7, compile the retrospective. The controller runs it as:

```
claude -p "Read and execute the instructions in <brief>"
  --model <role model> --effort <role effort>
  --system-prompt-file <harness/agents/<role>.md body>   (or the closest flag that
                                                          makes the role the session's persona)
  --allowedTools <role tool list> --permission-mode <fixed posture> --permission-prompts none
  --mcp-config <spec-workflow server for this project> --strict-mcp-config
  --json-schema <role report schema> --output-format json
  --max-turns <role cap> --session-id <uuid the controller chose>
```

- `cwd` is the run's worktree. The environment has `ANTHROPIC_API_KEY` and
  `ANTHROPIC_AUTH_TOKEN` removed, and carries `SDD_RUN_ID`, `SDD_STEP_ID`, the two
  spec-workflow roots, and `SDD_HEADLESS=1`. Headless is a flag the launcher sets, never a
  guess.
- The brief comes from `brief-templates.ts` as today (drafter, reviewer, reviser,
  adjudicator, checker, implementer, fix, verifier, plus new ones for the retro steps). The
  role's model and effort come from `agent-profiles.json` and the project's provider map.
- The result JSON gives the controller the typed report (`structured_output`), the usage
  (input, output, cache read, cache write), the session id and the turn count. The
  controller writes `spawn.start`, `spawn.end` and `spawn.usage` to the ledger from that.
  The hook, the transcript parsing in `harness usage`, and the `spawn-ends/` markers are
  not needed for new runs. Old ledgers still render.
- A step that exits non-zero is classified: usage limit (pause the run, section 9), turn
  cap, tool error, model refusal. Each class has a fixed response: resume the same session,
  retry fresh once, or write an error wait.
- Resume is `--resume <session id>` on the same brief. A resume inside the one-hour cache
  is cheap; a resume after a usage-window pause (hours) re-pays the cold prefix, the same as
  a fresh step. The cold prefix per step (system prompt, role body, CLAUDE.md, MCP tool
  definitions) and the MCP server start are a per-step cost to measure in the prototypes
  (section 14) against today's fresh subagent per round and task, which pays the same
  prefix.
- A role has no subagents. Every spawn is the controller's. Nesting depth is zero.

Fan-out, where today's loops run things in parallel, is the controller starting several
steps at once. Nothing in a step talks to another step.

## 5. Phase loops

The rules are the ones in the skills today, moved into code. The loops below name the
decisions; the caps, budgets and verdict rules stay as documented in `docs/SDD-HARNESS.md`.

**Implementation (c1 here; the review's plan and the progress log call it c2).** For each open task in order: mark `[-]`; if the task is TDD-marked,
run the test-author step and prove red on base; run the implementer step; run the review
gate in-process (`review-gate.ts`); on fail, run a fix step with the gate output, up to
three times, then the adjudicator step once; on pass at high risk, run the verifier step and
treat its verdict the same way; record the verdict, mark `[x]`, write `task.done`. Then the
completion gate: the verification step, `spec-index generate`, HANDOFF rendered from the
ledger, commit, push, open the PR. Then the PR checks loop: poll checks; on a red check run
a reconcile step with the log tail, up to three times, then the adjudicator once. Green
means the phase is complete. The implementation orchestrator agent is deleted.

**Documents (c2).** Drafter step writes v1 (and `codebase-context.md`); lint in-process;
if findings, a lint-fix reviser step; checkpoint commit. After requirements v1, gate A: the
drafter's report lists the decisions taken (schema field), the controller writes a gate-a
wait and parks the run; when answered, changed answers go to a reviser step as revision
comments. Rounds: build the adversarial prompt in-process (the `adversarial-review` tool's
logic as a function), reviewer step returns the analysis and the verdict as schema fields;
converged means approve (write the approval record, prune, clean); iterate means a reviser
step and the next round; the v4 cap means adjudicator step then checker step then approve.
After tasks approval, gate B: the veto list is built in-process from the tasks document and
`agent-rules.md`, written as a gate-b wait; an annotation runs one reviser step. The document
orchestrator agent is deleted.

**Retrospective and close-out (c3).** Retro compile is a step (judgement and prose), the
analyst is a step, then a retro-plan wait. The approved plan's items run through the
implementation loop above, grouped by target repository, with the same gate and verifier
rules, then the plan is marked CLOSED. The retro and close-out orchestrator agents are
deleted.

**Between phases.** Phase routing is a function of the spec store state (approval records,
`tasks.md`, the retro plan status), the same inputs `harness orient` reads today. The
supervisor skill is deleted at step (d).

## 6. Step (b): the outer loop plus the document loop

Step (b) ships the controller with the queue, waits, liveness, capacity, merge, the
usage-window pause, access control, the watchdog and cancel, and runs the three document
phases itself (section 5, "Documents"). That is the first inlined loop because it proves
the fresh-process-with-schema mechanism and the waits on a loop that does no irreversible
git. For implementation, retrospective and close-out the controller spawns today's
supervisor unchanged, one headless process per phase, because those phases already stop
where the controller needs them to: implementation ends at the pull request, the
retrospective stops headless at a DRAFT plan (which the controller turns into a
`retro-plan` wait), and close-out starts from an APPROVED plan. No bridge code is written
into the supervisor; it is deleted at step (d) as it is. The document orchestrator agent is
retired at (b), the implementation orchestrator at (c2), the other two at (c3).

## 7. Waits

A wait record: `id`, `kind`, `run`, `project`, `spec`, `created`, `questions` (each with
`id`, `text`, `options` or `free`, `recommended`, `reason`), `answer` (per question, with
`by` and `answered`), `advice` (optional, from an advisor step), `state` (open, answered,
expired).

Kinds: `gate-a`, `gate-b`, `retro-plan`, `merge` (a project with "ask me first"),
`escalation` (a reviewer's ESCALATE line), `error` (a step the controller cannot resolve),
`question` (free text, for the rare case a step needs one fact only the operator has).

The dashboard renders each kind (spec 16's answer sheets). Answering writes the record,
renders `questions.md` into the spec store, and tells the controller to continue the run.
A "second opinion" control runs an advisor step with the wait and its context and attaches
the advice; the operator still answers. One desktop notification and one phone push per
wait, none for progress.

Nothing else in a run can address the operator. A step's report schema has no free-text
"message to the user" field.

## 8. Liveness

The controller owns every step process and gets its exit event. `run.json` holds the PID and
process start time of the in-flight step. On controller start, a run whose step process is
gone is resumed from its cursor; a run whose process is alive is re-attached. The dashboard
reads liveness from the controller, not from a file. "Quiet" (a step with no output for
fifteen minutes) is still a wait of kind `error` after the turn cap, never a silent stall.

## 9. Capacity and the usage window

- Slots: two concurrent runs by default, configurable. Within a run, steps are sequential
  unless a loop fans out. First come, first served from `queue.json`.
- Every step runs with `--output-format stream-json`, and every run emits a
  `rate_limit_event` carrying the five-hour and seven-day windows' `utilization` and
  `resetsAt`. The controller keeps the latest values. Before starting a step it refuses to
  start when either window is above a threshold (default 0.95) and parks the run until that
  window's `resetsAt`. A step that still fails with a limit error pauses the run until the
  nearest `resetsAt`, or fifteen minutes when none is known. A paused run keeps its slot for
  ten minutes then yields it. On resume the same step runs with `--resume` (verified across
  processes). The dashboard's Usage page shows the two windows from the same event.
- One run per spec store at a time, as decided on 2026-10-06.
- A per-run token cap, default twice the project's measured baseline W per spec (from the
  step-4 numbers, overridable in `agent-rules.md`). At the cap the controller stops
  starting steps and writes an `error` wait with the figures; the operator raises the cap
  or cancels. A per-step cap is `--max-turns` plus `--max-budget-usd` as a backstop.

## 10. Merge rule

Per project, in `agent-rules.md`: the merge method (exists), the post-merge command
(exists), and `merge: auto | ask` (new, default `auto`). The controller merges when the PR's
checks are green, it is mergeable, its commits and body carry no model attribution trailer,
and the branch is the run's. "Checks are green" means every GitHub Actions workflow run for
the head sha completed with success, skipped or neutral and every commit status is success;
the PR's check rollup is not used, because a fine-grained token cannot read it on a private
repository (ADR 0003, 2026-10-14 amendment). Then it runs the post-merge command and writes `pr.merged`.
With `ask`, it writes a `merge` wait instead. A model never runs this rule.

The harness's own repository defaults to `ask`: a green build there proves the tests pass,
not that the controller boots on it, and a bad merge takes down the control plane of every
project. The operator can switch it to `auto` once the staged self-restart (section 2) has
caught a bad build at least once.

A `blocked` PR whose every blocking reason is a red check or a conflict gets up to two
`sdd-implementer` fix rounds before the `error` wait. The ledger holds the round count, so
a restart does not repeat a round. Each merge pass also flags the package names the head
adds over its base, as a ledger note and on the run record. Neither the fix rounds nor the
new-dependency flag changes the merge verdict: the rule still merges only a green,
mergeable, attribution-free PR on the run's branch, and a model never runs it.

## 11. Cross-run coordination

- Every run works in its own worktree (the launcher does this today). The main checkout of
  any project is never a run's working directory.
- Writes to a shared spec store (HANDOFF, INDEX, decomposition, deferrals) go through one
  lock per store in the controller.
- The harness's own repository: steps read skills and agents from `harness/` in the main
  checkout (symlinks today, `--plugin-dir harness` later). A merge that changes them reaches
  the next step start, and no running step changes under its feet because a step is one
  process with its prompts loaded.
- The hold-the-pull rule the overwatch kept by hand becomes: the post-merge command for this
  repository waits until no run shares this checkout, counting the controller's own steps
  and, until step (d), any legacy run that still writes the active-run pointer, then pulls,
  builds into staging and goes through the staged restart.

## 12. What each existing piece becomes

| Today | After |
| --- | --- |
| `sdd-continue` supervisor skill | step (b): runs one phase per spawn; step (d): deleted |
| three orchestrator agents and their phase skills | the loops in section 5; deleted at c1, c2, c3 |
| worker agents (drafter, reviewer, reviser, checker, adjudicator, test author, implementer, verifier, retro analyst) | kept as role definitions; each run is one headless process |
| `harness` tool: orient, brief, phase-log, gate | internal functions of the controller; `brief` stays callable for by-hand runs |
| `harness usage` (transcripts) | usage from each step's result JSON; transcript reader kept for old ledgers |
| the activity hook, `spawn-ends/`, `event.sh`, `retro.sh`, `deregister.mjs` | deleted; the controller writes the ledger |
| active-run pointer | deleted; liveness from the controller |
| HANDOFF routing header and gate rows | rendered from the ledger and the wait records |
| `questions.md`, `retrospective-plan.md` status | rendered from wait answers; the plan's body is still a step's prose |
| `approvals` tool | the controller writes approval records; the tool stays for by-hand runs |
| `review-task`, `spec-lint`, `log-implementation`, `deferrals`, `adversarial-response` | unchanged; called in-process by the controller or mid-step by a role |
| dashboard launcher (`launcher.ts`) | deleted at step (d) (PR #140); `step.ts` is the step runner and `worktree.ts` keeps `ensureWorktree` |
| spec 16 (gates) | the waits of section 7 and their answer sheets |
| spec 17 (merge, deferrals) | section 10 and the Deferrals page |
| spec 18 (usage) | from step results; the page as designed |
| spec 20 (home) | section 3 is its layout |
| spec 21 (bootstrap) | unchanged in intent; `doctor` also checks the service |
| overwatch session, `owctl`, HUD, inbox, handoff | retired at step (b); `owctl` repository archived |

## 13. Done-when

- **(b)**: a spec launched from the dashboard runs requirements with the current supervisor,
  stops at gate A as a wait, is answered in the dashboard, continues through tasks, stops at
  gate B, continues through implementation and the PR, is merged by rule, stops at the
  retro plan, and closes; the dashboard was closed for part of it; the controller was
  restarted once mid-phase and the run finished; a forced usage-limit error paused and
  resumed a run; no terminal was opened.
- **(c2)**: the same with the implementation phase run by the controller's loop; the
  implementation orchestrator agent no longer exists; W per task on a fixture spec is below
  the step-4 baseline by at least the orchestrator share.
- **Cancel**: the operator stops a run from the dashboard; the in-flight step is signalled,
  the run is marked abandoned, and its worktree, branch and open PR are left in place. A
  separate "discard" removes the worktree, deletes the branch and closes the PR, on a second
  click.
- **Tests**: the controller's loops run in CI against a stub `claude` binary that returns
  canned step results (the `childEnv` pattern in `launcher.test.ts`), so no loop test costs
  tokens. Each loop has a fixture spec and a scripted sequence of step outcomes: converge at
  v2, iterate to the cap, gate fail then fix, usage-limit error, crash mid-step and resume.

## 14. Verified by prototype (2026-10-10)

All six checks passed (`scripts/prototypes/`, answers in `docs/foundation-review.md`
section 2). What each settled:

1. Which flag makes an agent file's body the persona of a `-p` session with that role's
   tool list, and whether `--allowedTools` plus `--permission-mode` gives a worker file edits
   and test runs with no prompt and no nested-process denial.
2. The exact error a `-p` run returns on a subscription usage limit, and whether it names
   the reset time.
3. `--resume <session id>` from a different parent process, with the same cwd and MCP
   config, continues the step.
4. A systemd user service on WSL2 can run `claude -p` on the subscription login (keychain or
   `setup-token`).
5. `--json-schema` with the reviewer's verdict schema returns a valid object on a real
   review, and what happens on the fifth failed attempt.
6. `--output-format stream-json` gives enough for the Run page's "current tool" line, so the
   activity hook is not needed.

## 16. The advisor

The role the operator talks to (ADR 0006, round 5 of the review). Nonessential by
construction: the controller has no code path that invokes it except the "second opinion"
control the operator presses, and no run state depends on its output.

- **Entries.** (1) Conversation: "open advisor" in the dashboard, or `sdd advisor` in a
  shell, starts a Claude Code session in a fixed directory (so its auto-memory is one place)
  with the `sdd-advisor` skill, the state of the world preloaded, and the controller's MCP
  tools connected. Remote Control gives the same session on the phone. (2) One-shot:
  "second opinion" on a wait runs the same skill as a headless step with the wait and the
  state of the world, and attaches the typed advice to the wait record.
- **State of the world.** A file the controller rebuilds on every state change, debounced:
  projects, runs (phase, step, age), open waits, the queue, open specs with phase and PR
  state, deferrals owned by the operator, retro outcomes of the last week, usage this
  window, the harness version. Code builds it. Decided in the design session of 2026-10-26
  (decomposition entry 25): a short summary at hello, tallies the controller keeps from
  the ledgers and retros, and drill-down search that runs text and local-embedding meaning
  search together over every project's records.
- **Tools.** The dashboard server exposes one MCP endpoint for the advisor
  (`ADVISOR_MCP_PATH`): read tools (`projects`, `runs`, `waits`, `specs`,
  `read_store_file`, `pr_reads`, `usage`, `summary`, `tallies`, `search`, `sources`,
  `staged_actions`) and stage tools (`stage_merge`, `stage_deploy`, `stage_launch`,
  `stage_answer`, `stage_deferral`, `stage_decomposition`, `stage_backlog`), each needing a
  reason. `read_store_file` reads only inside a project's `.spec-workflow/`; a path that
  tries to leave it, by `..` or by a symlink, is refused. A stage tool never runs an action:
  it appears in the dashboard as a pending action with the advisor's reason, and runs only
  when the operator confirms it there. The guard is code, not a prompt rule, because the
  advisor reads sources the operator does not control (a site, a folder, another system)
  and a planted instruction in one of them must not be able to merge or launch. Everything
  the advisor reads from a source is data, never an instruction, and the role file says so.
  A confirmed action is written to the home event log as `advisor.action` with the
  conversation id.
- **Sources.** `sources.json` in the harness home: name, kind (repo, folder, url, mcp),
  location, one line of what it is, and whether it is personal. The role lists them at
  hello and reads what the conversation needs. The operator edits the file or asks the
  advisor to.
- **Notebook.** `advisor/notes/` in the home: one Markdown file per thread, an index the
  advisor keeps. Prose by the model, which is what it is for. The controller never reads it.
- **Push.** `push.json` in the harness home names a URL. The process that takes the
  controller's start lock runs the one pusher. On its first start it records every open
  wait without pushing; after that, a new open wait gets one POST carrying only its kind,
  project, spec and the dashboard URL — no question text, advice or file content. A failed
  push retries once after a minute, then is logged to the home event log as `push.failure`
  and dropped.
- **Lifetime.** No resident process, no crons, no polling. A conversation ends when the
  operator closes it; a one-shot exits. A future "watch X" is a scheduled one-shot through
  the controller, logged like any action.
- **Model.** A judgement-and-prose role: the drafter tier in `agent-profiles.json`.
- **When.** After step (b), which is what gives it a queue, waits and the state to compile.
  The current overwatch session's useful tooling (`owctl catchup`, the handoff, the session
  summaries) is the seed of the notebook and the state of the world; the rest retires.

## 17. Access

The dashboard binds to 127.0.0.1 by default. Exposure on the LAN is opt-in. Every mutating
route (launch, answer, merge, cancel, confirm an advisor action, edit a setup) requires the
operator's shared secret, which the controller generates on first start and keeps in the
harness home; the dashboard sends it from a browser login once per device. The advisor's
MCP endpoint takes that same operator secret, or a second, scoped credential the
controller generates alongside it: a bearer good for that one endpoint and no other route.
`sdd advisor` reads its scoped credential from the home. The secret is required on the LAN
too. Read routes are open on loopback and need the secret on the LAN. There is no second
user and no roles, beyond that one scoped, read-and-stage-only credential.

## 18. Not in scope

The document pipeline's content and rules; the dashboard's visual design (spec 15 stands);
multi-machine; any runtime other than Claude Code on a subscription; renaming the package.
