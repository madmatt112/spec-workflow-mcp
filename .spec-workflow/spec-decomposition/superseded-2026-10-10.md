# Superseded decomposition entries (parked 2026-10-10)

These entries (specs 16, 17, 18, 20, 21, and the reserved 19) were written against the
supervisor-skill control plane. On 2026-10-09/10 the foundation review decided to replace
that control plane with a controller inside the dashboard server (`docs/foundation-review.md`,
`docs/controller-design.md`, ADRs 0001-0006). What each entry delivered is re-planned on the
controller at step (d) of that plan. They are kept here as written, for reference. This file
is not a routing input: the supervisor reads only `decomposition.md`.

### 16. `dashboard-gates` — answer gates and the retro from the dashboard (active)

A headless run today records the recommended picks at gate A and gate B and carries on,
and writes the retro plan as DRAFT and stops. Interactive runs block on AskUserQuestion in
a terminal session, which is why the overwatch session exists: to notice the wait and push
the operator's phone. This spec adds a third gates mode, `dashboard`: the run stops at gate
A, gate B and retro-ready, the dashboard shows the questions, the operator answers on the
Now page, the dashboard writes the answers and relaunches, and the supervisor continues
from them. With it, a notification when a wait appears. A headless run also stops when the
claude.ai usage limit is reached, and nothing continues it; an interactive session waits for
the reset and continues by itself. This spec gives a dashboard launch the same continue.

**Delivers.**

- **Gates mode `dashboard`** in the supervisor, chosen in the setup file and the agent
  rules next to `block` and `record`. At gate A or B the supervisor writes the gate payload,
  appends the `phase.end` row with the gate result, prints one line naming the wait, and
  exits with a known exit code. On the next launch it finds the answers in `questions.md`
  and continues. At retro-ready it writes the proposals and stops; on relaunch with an
  APPROVED plan it runs close-out. The `block` and `record` modes are unchanged.
- **The refusal signal** of harness-control-pane P4 (option B): a preflight that refuses
  the run emits a refusal event and exits non-zero, so a refused launch reads as refused.
- **Continue after a usage limit.** When a headless run stops on the usage limit, the
  harness records the limit and its reset time in the ledger and the run exits with a known
  exit code. The Now page shows the run as paused with the reset time, not as a run that
  exited without `run.end`. At the reset the dashboard relaunches the run with the saved
  setup, and the supervisor continues from the ledger and the spec files. After two
  relaunches in a row that stop on the limit again, the dashboard stops relaunching and
  shows a wait for the operator. A paused run sends no push; a stopped one does.
- **Answer sheets** in the Now panel. Gate: the questions and options from the gate file,
  the recommended pick marked, the recorded mechanics listed; "Answer and continue" writes
  `questions.md` in the harness's format and relaunches with the saved setup. Retro: the
  DECISION NEEDED questions, then the proposals with no decision as a ticked list;
  "Approve plan and continue" writes `retrospective-plan.md` as APPROVED with the decisions
  and relaunches. A second answer to an answered gate is refused.
- **Notifications.** A desktop notification from the open tab when a wait appears, and one
  line posted to a push service (ntfy or Pushover, configured in Settings) for the wait
  kinds the operator ticks. One message per wait, none for progress. A test button.
- **Frontend typecheck in the review gate.** Add a frontend tsconfig for src/dashboard_frontend
  and include it in the review gate's typecheck (today the gate excludes src/dashboard_frontend/**
  and nothing type-checks the frontend). Gate only on errors in touched files (dashboard-shell
  retro P2).
- **Run liveness within ~5 s of an ungraceful exit.** The hook that writes the active-run
  pointer line also records the supervisor's Claude process PID and its start time (from
  /proc, so a reused PID can't look live). The dashboard checks /proc/<pid>/stat every 2-3 s
  per live run; if the process is gone or its start time differs, it shows the run as stopped
  (process gone) and enables Launch as a resume. The dashboard never deletes the pointer line;
  whatever resumes the run rewrites it. Dashboard launches already store a pid
  (LaunchRecord.pid); this extends that to runs started from a terminal. Trigger: 2026-10-09 a
  tradr session exited mid-implementation and the stale pointer kept Launch disabled until it
  was removed by hand.
- **Docs.** `docs/SDD-HARNESS.md` gains the `dashboard` mode and the answer path.

**Decided.**

- Stop and relaunch, not a waiting process: a gate can wait for hours, a relaunch is a
  fresh supervisor, and it survives a dashboard restart.
- The dashboard writes the same `questions.md` the interactive gate writes, so a run
  answered on the dashboard and a run answered in a terminal leave the same record.
- The phone gets a notification, not a page. The operator does not act from the phone.
- The overwatch push and the HUD are retired by the operator once this is live; the spec
  does not touch them.
- A usage-limit continue uses the same stop-and-relaunch path as a gate, with the reset
  time in place of the operator's answer. How a headless run detects the limit and reads
  the reset time is for the design phase. A phase orchestrator stopped by the limit
  restarts its phase, as today; this spec does not resume a phase part-way.
- Open for gate A: the push service, ntfy or Pushover.

**End-to-end verification.** (1) A fixture spec launched from the dashboard with gates
`dashboard` stops at gate A with a `phase.end` result `gate-a`, a known exit code and no
pointer line; the Now page shows the questions within five seconds and the desktop
notification fires. (2) Answering on the dashboard writes `questions.md` with the answers
attributed to the operator, relaunches, and the new run continues into requirements review
without asking again. (3) The same at gate B and at retro-ready: approving the plan writes
it APPROVED with the two decisions and relaunches into close-out. (4) A launch with a
refused supervisor model shows "refused" with the preflight's reason, not "exited 0". (5)
A push arrives on the phone for the gate and none for a `spawn.end`. (6) A fixture run that
stops on a simulated usage limit shows as paused with the reset time on the Now page, is
relaunched at that time without operator action, and continues the phase; a third stop in a
row shows a wait and sends one push. (7) A terminal run with gates `block` behaves as
before. (8) `npm run build`, `npx tsc --noEmit`, `npm test`,
`npm run check:plugin-assets` and `claude plugin validate . --strict` are green.

**Depends on** spec 15 for the Now page and the panel, spec 7 for the gate files and
`questions.md`, and spec 9 for the launcher and the setup file.

### 17. `dashboard-merge-and-deferrals` — the PR and the deferral queue in the loop (active)

A spec ends with a PR that no agent merges. Today the overwatch session merges it once CI
is green, by each repository's rule, then syncs and rebuilds. Deferrals assigned to the
operator sit in a list with no owner column. This spec puts both in the loop: the Now page
shows a green PR as a wait with a Merge button, and a deferral owned by the operator as a
wait when it blocks something.

**Delivers.**

- **PR state per spec.** The PR number from HANDOFF, its checks, mergeable state and
  review state from `gh`, on the Specs panel and the run page, and as a wait on Now when
  every check is green. Polled while a PR is open; pushed to the page.
- **Merge by rule.** `agent-rules.md` gains `merge-method` (merge commit or squash) and an
  optional `post-merge` command. Merge runs `gh pr merge` with the project's method, then
  the post-merge command (this repository: sync main, build, restart the dashboard), and
  shows each step's result. The button is for the operator; no harness skill calls it.
- **Deferrals page.** Grouped by project, chips for open, resolved, owner you, blocking;
  search and pagination; columns state, id, title, origin spec, owner, blocks, age. The
  panel shows the record, the revisit trigger and the context, with Mark resolved, Open
  file and Copy path. Mark resolved writes the record through the deferrals tool's
  resolve path.
- **Owner on a deferral.** The deferral record gains `owner` (human or harness); the
  `deferrals` tool accepts it on add and update; the sdd-deferrals skill sets it when it
  triages a record as decide. Open deferrals owned by the human appear under Now when they
  block something or their revisit trigger has fired.

**Decided.**

- Merge is a button, never automatic. The operator asked for the merge; the rule that no
  agent merges its own PR stands.
- The post-merge command lives in `agent-rules.md`, read at merge time, so each repository
  says what happens after its merge.

**End-to-end verification.** (1) With a spec whose PR is open and green on a fixture
remote, Now shows the PR as a wait within one poll, the Specs panel shows its checks, and
Merge merges with the project's method and runs the post-merge command, reporting each
step. (2) A PR with a failing check shows red on the Specs panel and does not appear under
waiting. (3) A deferral added with owner human and a blocks value appears under Now; Mark
resolved removes it and the record reads resolved. (4) The Deferrals page filters by owner
and by blocking, and paginates past twenty records. (5) `npm run build`, `npx tsc --noEmit`
and `npm test` are green.

**Depends on** spec 15 for the pages and the panel.

### 18. `dashboard-usage` — tokens live, per spec, and across specs (active)

The efficiency plan is judged on W per task per spec, measured by hand from the ledgers by
the overwatch session. `harness usage` prints the per-spec numbers and, after spec 14, the
per-source breakdown of each orchestrator spawn. This spec draws them.

**Delivers.**

- **Live.** Tokens today, orchestrator share today, cache hit over 24 hours; a stacked bar
  per live run by role group (orchestrators, document workers, implementation workers,
  retro and other); the open spawns with their token fields, updated on every `spawn.end`.
- **Per spec.** A spec chooser; total W, W per task against the repository's baseline,
  orchestrator share; a stacked bar per phase; a role table with spawns, model, W, share,
  cache read and W per spawn, from the `harness usage` action.
- **Trend.** W per task for every closed spec by close date, one line per repository, the
  step-4 baselines marked, with a table view. Series colours in a fixed order, a legend, a
  hover value per point.

**Decided.**

- W is the unit everywhere, as in the efficiency plan: input + 1.25 cache write 5m + 2
  cache write 1h + 0.1 cache read + 5 output. No dollar estimate.
- The page reads the `usage` action and the ledgers; it adds no ledger field and changes
  no hook.

**End-to-end verification.** (1) The per-spec view for `tdd-task-loop` shows the same
totals as `harness usage` on its ledger, within rounding. (2) The trend chart lists every
closed spec of every registered project with W per task, and the two baselines are marked.
(3) With a run live, the live view's run total rises within five seconds of a `spawn.end`
row. (4) `npm run build`, `npx tsc --noEmit` and `npm test` are green.

**Depends on** spec 15 for the shell, spec 8 for the `usage` action and the hook-written
`spawn.end` rows, and spec 14 for the per-source breakdown.

Specs 20 and 21 share these assumptions: the runtime is Claude Code with a Claude subscription
(other runtimes and API billing are not supported); mechanisms are deterministic code and the
model does only judgement and prose; the harness is opinionated, and a repository that does not
meet the stated requirements does not complete the bootstrap. Spec 19 is reserved for the
overwatch role and is not drafted yet.

### 20. `harness-home` — one home for the state that is not one project's (active)

The harness keeps state in three places. The spec store (`.spec-workflow/`) of each project
holds the documents, ledgers, gate files, deferrals and agent rules. Claude Code keeps the
session transcripts under `~/.claude/projects/`, and `harness usage` reads them. The third
place, `~/.local/state/sdd/`, grew one file at a time with no plan: the active-run pointer, the
overwatch handoff, the HUD file, the overwatch event log, briefs and backups. Different agents
and scripts write some of these files, and some are written by hand. This spec makes the third
place a defined harness home with a fixed layout, one writer for each file, and a schema
version on each record.

**Delivers.**

- **The home directory.** The default is `~/.local/state/sdd`. The `SDD_HOME` variable
  overrides it. The server, the hook, the dashboard and the overwatch tools all resolve it
  with the same rule.
- **A fixed layout.** `registry.json` lists the projects. `active-run` keeps its current
  tab-separated format. `overwatch/` holds `events.jsonl`, `hud.json`, `handoff.md` and
  `sessions/` (one summary for each closed overwatch session). `setups/` holds the dashboard
  setup files if they are not already in the home.
- **The project registry.** Each entry records the project name, the code root, the store
  root and the store placement (`in-repo`, `separate-repo` or `excluded`). The dashboard reads
  this registry. The bootstrap (spec 21) writes it. A server that starts in a project that is
  not in the registry adds it, as the server does today.
- **One writer for each file.** Each file in the home has one named writer: a server tool
  action, the hook or `owctl`. `docs/SDD-HARNESS.md` gets a table of file, writer, readers and
  schema. No skill tells an agent to write one of these files by hand.
- **Schema versions.** Each JSONL row and each JSON file in the home carries a `v` field.
  Readers ignore fields they do not know and refuse a `v` that is newer than they support,
  with a message that names the file.
- **Migration.** On the first start after this spec, a move step relocates the current
  `~/.local/state/sdd/` files to the new layout, keeps a backup, and prints what it moved. The
  step does nothing on the second start.

**Decided.**

- The spec store of each project does not change. It keeps only spec artifacts.
- Nothing in the home is committed to a repository. It is the state of one machine.
- The overwatch TUI and `owctl` (repository `~/repo/overwatch-tui`) read the home path from the
  same rule. Their change lands in their own repository and is part of this spec's
  verification, not of its code.

**End-to-end verification.** (1) With `SDD_HOME` set to an empty directory, a fixture project
started through the dashboard appears in `registry.json` with its placement, and a run writes
its active-run line and its overwatch events in the new layout. (2) A machine with the current
`~/.local/state/sdd/` layout migrates once: every file reaches its new path, a backup exists,
and a second start moves nothing. (3) Each file in the writer table is written only by its
writer during a full fixture run, which a test confirms by checksum before and after each
other writer runs. (4) A record with an unknown field is read without error, and a record with
a newer `v` is refused with the file name. (5) `npm run build`, `npx tsc --noEmit`,
`npm test`, `npm run check:plugin-assets` and `claude plugin validate . --strict` are green.

**Depends on** spec 6 for the pointer file and the hook events, and spec 9 for the dashboard
setup file and the run model.

### 21. `repo-bootstrap` — put the harness on a new repository (active)

`docs/SDD-HARNESS.md` tells an operator how to install the plugin and configure `.mcp.json`.
It does not tell them how to make a repository ready for a run: where the spec store goes,
what `agent-rules.md` must contain (the gate test command, the checks, the sensitive paths,
the git and merge rules), which steering documents to write, and how to get a first
`decomposition.md`. The four repositories that use the harness today got these by hand, and
each did it differently. This spec adds a bootstrap that takes a repository from nothing to a
first run, a check that tells the operator whether a configured repository is healthy, and a
clean way to remove the harness.

**Delivers.**

- **Requirements, stated and checked.** A repository can complete the bootstrap only if:
  - it is a git repository with a GitHub remote, and `gh` is authenticated for it;
  - it has a test command that runs and exits 0 on the default branch;
  - Claude Code is installed and can run the supervisor model.

  The bootstrap checks each requirement. When one fails, it stops and prints the exact fix.
- **`init`, a deterministic command.** `npx @madmatt112org/spec-workflow-mcp init` does
  these steps:
  1. Check the requirements.
  2. Detect the test, lint and typecheck commands from `package.json`, `pyproject.toml`, the
     `Makefile` and the CI workflows.
  3. Ask a fixed set of questions, with the detected values as defaults: the store placement,
     the merge method (merge commit or squash), DCO sign-off, and the sensitive paths. The
     suggested sensitive paths are the CI workflows, the migrations, the auth code and the
     deploy files that detection found.
  4. Scaffold the store in its fixed layout, with `agent-rules.md` filled from the answers
     and the templates copied.
  5. Add `.claude/worktrees/` and `.spec-workflow/.cache/` to `.gitignore` (today
     `src/core/typecheck.ts` appends the cache line itself during a task review, which leaves
     an uncommitted `.gitignore` change in the repository mid-run; after this spec the server
     only reports a missing line through `doctor`), add the `spec-workflow` server to
     `.mcp.json`, and print the plugin install command.
  6. Add the project to the harness home registry (spec 20).
  7. Write `init-manifest.json` in the store. It lists every path that `init` created or
     changed.

  `init --yes` takes every default and asks nothing, so a script can run it.
- **Store placement.** There are three placements, each with a fixed layout: `in-repo`
  (`.spec-workflow/` committed with the code; the default), `separate-repo` (the store in a
  second repository, given by its path; the code repository gets only `.mcp.json` with
  `SPEC_WORKFLOW_SHARED_ROOT`), and `excluded` (`.spec-workflow/` in the repository, listed in
  `.git/info/exclude`, never committed). `init` explains each placement in one line before it
  asks.
- **`/sdd-init`, the judgement half.** A skill runs `init`. Then it drafts the steering
  documents (product, tech, structure) from the codebase, and turns the operator's goal into
  a first `decomposition.md`. Both go through the normal document approval. The operator
  approves them before the first run.
- **`doctor`, a deterministic check.** `npx @madmatt112org/spec-workflow-mcp doctor` checks a
  configured repository: the store is found, `agent-rules.md` parses and has the required
  keys, the gate test command runs, the hook is registered, the plugin prefix (or the
  checkout layout) is consistent, and the project is in the registry. It prints one line for
  each check and exits non-zero when one fails. The supervisor's preflight runs the same
  checks.
- **`uninstall`.** It reverses `init` from `init-manifest.json`: it removes the `.mcp.json`
  entry, the `.gitignore` line and the registry entry, and it prints the plugin uninstall
  command. It keeps the spec store unless the operator passes `--purge`.
- **Docs.** `docs/SDD-HARNESS.md` gets a "Start on a new repository" section: requirements,
  `init`, `/sdd-init`, the first run, `doctor` and `uninstall`.

**Decided.**

- The bootstrap is opinionated. It supports the three placements and no other layout. A
  repository that does not meet the requirements does not complete it.
- The bootstrap does not install the plugin. Plugin installation is a Claude Code command that
  the operator runs, and `init` prints it.
- `init` never edits product code. It writes only the store, `.mcp.json`, `.gitignore` (or
  `.git/info/exclude`), the registry and the manifest.

**End-to-end verification.** (1) On a fresh Node fixture repository with a GitHub remote,
`init --yes` completes, `doctor` passes every check, `/sdd-init` drafts the steering documents
and a decomposition from a stated goal, and "continue the sdd process" starts the first spec
and drafts requirements v1. (2) The same on a Python fixture repository: detection finds its
test command. (3) A repository without a remote, and a repository whose test command fails,
each stop at the requirement check with the exact fix printed and no files written. (4) Each
placement produces its fixed layout, and the `separate-repo` placement leaves only `.mcp.json`
changed in the code repository. (5) `uninstall` removes exactly the paths in the manifest
(other than the store) and nothing else, which a test confirms by diffing the repository
before `init` and after `uninstall`. (6) `npm run build`, `npx tsc --noEmit`, `npm test`,
`npm run check:plugin-assets` and `claude plugin validate . --strict` are green.

**Depends on** spec 20 for the home and the registry, spec 7 for the document approval path
that `/sdd-init` uses, and spec 9 for the dashboard's project list.
