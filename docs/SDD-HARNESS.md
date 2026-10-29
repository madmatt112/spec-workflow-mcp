# SDD Harness

The SDD harness runs the spec-driven development workflow of this server with no human at
the keyboard. The operator launches a spec from the dashboard. The harness takes the spec
from its first document through implementation, the merge, the retrospective and the
close-out of the approved retrospective plan, then stops. The operator answers only when
the run opens a wait.

The harness is the **controller**, a module of the dashboard server (`src/controller/`,
`src/dashboard/`). It is code. No model runs in the control loop (ADR 0004). Each model
step is one fresh `claude -p` process with a role file from `harness/agents/` and a report
schema (`src/controller/step.ts`). The controller reads the step's result and writes the
run's history itself.

## What it is

- **The controller.** The queue, the runs, the waits, the capacity rules and the merge
  rule. It runs every phase: documents (`phases/document.ts`), implementation
  (`phases/implementation.ts`), the merge rule (`merge.ts`), retrospective
  (`phases/retrospective.ts`) and close-out (`phases/closeout.ts`). `runs.ts` routes a run
  from phase to phase, merges the close-out's pull requests and pushes the spec store at
  the end.
- **Ten worker roles** in `harness/agents/`, one file each, with a pinned model, an effort
  and a tool list: `sdd-drafter`, `sdd-reviewer`, `sdd-reviser`, `sdd-checker`,
  `sdd-adjudicator`, `sdd-test-author`, `sdd-implementer`, `sdd-verifier`,
  `sdd-retro-compiler`, `sdd-retro-analyst`. The controller gives each step one of these
  files as its system prompt.
- **One skill**, `sdd-deferrals`, in `harness/skills/`. It works the deferred-decision
  queue by hand. It is invoked by name only. No run uses it.
- **The dashboard**, the operator's only console: the Now, Runs, Run, Specs, Deferrals
  and Usage pages.

The harness approves its own documents through the `approvals` tool. The operator's
checkpoints are the waits: gate A after the first requirements draft, gate B before
implementation, the retrospective plan, and a merge wait where a project asks for one.

## The controller

The controller is the always-on part of the harness. It holds the queue, starts and
resumes runs, watches capacity, answers the operator through waits, and merges by rule.
It is a module of the dashboard server process (ADR 0005).

### What runs where

- The **dashboard server process** holds the controller. Run it as a service (see
  "Running the controller as a service"). It keeps running with every browser tab closed.
- Each model **step** is one fresh headless `claude -p` process. The controller spawns it
  with a role, a brief and a report schema. The step exits with a typed result. The
  controller reads the result for the report, the token usage and the usage windows, and
  writes the ledger itself. Every step's process id is in the run record while it runs.
- A run works in a worktree of the code repository, `.claude/worktrees/<spec>` on the
  branch `feat/<spec>`, when `agent-rules.md` says `worktree-per-change: required`
  (`src/dashboard/harness/worktree.ts`). The `worktree-setup` command runs once in a new
  worktree.

### The harness home

The controller keeps all machine state in the harness home (`~/.local/state/sdd`, or
`$SDD_HOME`). One writer: the controller. Every record carries a `v` field and is written
atomically.

- `runs/<run-id>/run.json` — one record per run: the project, the spec, the status, the
  phase, the step cursor, the worktree, the pull request, the in-flight step's process id
  and the token totals. `runs/<run-id>/steps/` holds each step's stream log and system
  prompt.
- `waits/<wait-id>.json` — one record per wait.
- `queue.json` — the launched runs waiting for a slot, in order.
- `rate-limit.json` — the latest usage windows.
- `projects.json` — every project the operator registered, until the operator removes it.
  This list is what keeps a project launchable after a controller restart.
- `secret` — the shared access secret (see "Access").
- `service.env` — the GitHub token for the service (see "GitHub credentials").
- `controller.lock` — the single-controller lock. A second controller that finds the
  lock held exits.
- `watchdog.state` and `watchdog-alerts.log` — the watchdog's memory and its alerts.
- `advisor/`, `sources.json`, `push.json`, `pushed.json`, `search.json` and `events.jsonl`
  — the advisor's own files (see "The advisor").

There is no pointer file and no `harness-run.json` any more; both went with the
supervisor at step (d) of the foundation rework.

The spec store keeps everything the operator reads later, in git: the documents, the
analyses, the gate receipt (`questions.md`), the retro files, the deferrals and
`harness-events.jsonl`. The controller commits these as it goes and pushes the store at
the end of the run (see "Run end").

### Launch and capacity

Launch means enqueue. The operator launches a spec; the controller writes a `queued` run
and starts it when it has a slot (ADR 0004). It allows one run per spec store.

- **Register a project once.** `POST /api/projects/add {"projectPath": "<repo>"}` with the
  secret. The project is remembered in `projects.json`. `DELETE /api/projects/:id`
  removes it.
- **The launchable spec.** The first entry of `spec-decomposition/decomposition.md` whose
  heading is `### N. \`<name>\`` and which has no `.spec-workflow/specs/<name>/`
  directory yet. An entry marked `(deferred)` is skipped. `GET
  /api/projects/:id/harness/setup` shows the spec, or the reason nothing is launchable.
- **Launch.** The Launch card on the Runs page, or `POST /api/projects/:id/harness/launch`
  with `{"spec", "supervisorModel", "worktree", "gates", "roles"}` (the Runs page builds
  this from the setup view). The route makes the spec directory, forces `gates: record`
  and enqueues. It answers `409` when the spec is not the launchable one, when another
  run is live on the same spec store, or when a usage window blocks launches.
- **Slots.** The controller carries up to two runs at once. Set `CONTROLLER_SLOTS` to
  change the count. Launched runs over the slot count wait in the queue, first come first
  served.
- **Windows.** Every step reports the two usage windows of the subscription: the
  five-hour window and the seven-day window. The controller keeps the latest values.
  Before it starts a step, it checks both windows. It holds every run back while either
  window is over the threshold, and starts them again at the window's reset. Set
  `CONTROLLER_WINDOW_THRESHOLD` to change the threshold (default `0.95`).
- **Token cap.** A per-run cap stops a runaway run. The default is twice
  `baseline-w-per-spec` from `agent-rules.md`; with no key there is no cap. At the cap the
  controller writes an `error` wait; the operator raises the cap or abandons the run.

### Waits

A wait is the only way a run speaks to the operator. The controller writes a wait, parks
the run, and carries on with other work. The operator answers the wait on the dashboard
Now page, or with `POST /api/controller/waits/:id/answer {"answers": {"<question id>":
"<value>"}, "by": "<name>"}`. The answer resumes the run.

A wait is one of these kinds: `gate-a`, `gate-b`, `retro-plan`, `merge`, `escalation`,
`error`, `question`. When the operator answers a gate wait, the controller renders the
gate receipt into `questions.md` in the spec store and appends a `note` row to the ledger.
An `error` or `escalation` wait answered "abandon" ends the run; any other answer resumes
it. A second opinion can be attached to a wait (`POST /api/controller/waits/:id/advice`);
the operator still answers.

### The merge rule

After the implementation phase reports complete, the controller reads the pull request and
decides by a fixed rule (ADR 0003, design §10). It merges when every GitHub Actions run and
commit status of the head commit passed, the PR is mergeable, no commit or body carries a
Claude attribution trailer, and the head branch is the run's. It reads CI from the
workflow runs and commit statuses, not from the check rollup, because a fine-grained token
cannot read check runs. A model never runs this rule. Three keys in `agent-rules.md` set
the behaviour per project:

- `merge-method` — `merge` or `squash`.
- `post-merge` — the command to run after a successful merge, in a code span.
- `merge` — `auto` (merge by rule) or `ask` (write a `merge` wait instead). The default is
  `auto`. The harness's own repository is set to `ask`, because a bad merge there takes
  down the control plane of every project.

While a check is still running, the controller re-checks every thirty seconds. When the PR
fails the rule and nothing is in flight (a red check, a conflict, a wrong head branch, an
attribution trailer), it writes an `error` wait with the reasons; "Retry" re-enters the
rule after the operator fixes the PR. A PR whose state `gh` cannot read is an `error` wait
too.

### Access

The dashboard binds to loopback. Exposure on the LAN is opt-in (`--host`). Every mutating
route and every `/api/controller/*` route needs the shared secret or the session cookie.
The controller makes the secret on first start and keeps it in the harness home. The
browser sends it from a login once per device. Read routes are open on loopback and need
the secret on the LAN. `/api/health` is the one route that needs no secret. There is no
second user and no roles (design §17), beyond one exception: the advisor's own scoped
credential, a second secret good only for its one MCP endpoint and no other route (see
"The advisor").

### Cancel and discard

The operator can stop a run from the dashboard, or with `POST
/api/controller/runs/:id/cancel` and `.../discard`. **Cancel** signals the in-flight step,
marks the run abandoned, and leaves the worktree, the branch and any open PR in place.
**Discard** cancels the run and then removes the worktree, deletes the branch and closes
the PR.

## Phase flow

```
launch → queued → running
  ├─ requirements ─ drafter → lint → (reviewer → reviser)* → approve ─ gate A wait after v1
  ├─ design       ─ drafter → lint → (reviewer → reviser)* → approve
  ├─ tasks        ─ drafter → lint → (reviewer → reviser)* → approve ─ gate B wait
  ├─ implementation ─ per task: [test author] → implementer → gate → [verifier → fix*]
  │                   → end-to-end verifier → push → PR → checks loop
  ├─ merge        ─ the merge rule (or a merge wait)
  ├─ retrospective ─ compiler → analyst ─ retro-plan wait
  ├─ closeout     ─ per class: implementer → gate → [verifier → fix*] → one PR per repository
  └─ run end      ─ close-out PRs merged by rule → store committed and pushed → done
```

The controller routes a run from the state on disk (`routeRun` in `runs.ts`): the
approval state of the three documents, the task list, the plan status. A restart re-enters
the run at the same place.

### Documents

For requirements, design and tasks in turn: the drafter writes v1; the lint step runs the
spec checks and a reviser fixes the lint findings; then rounds of adversarial review and
revision until the reviewer converges, or until the v4 cap, when the adjudicator writes a
corrective version and the checker verifies it. The controller approves the final version
with the `approvals` tool and prunes the superseded records. After the first requirements
draft the run opens the `gate-a` wait (the drafter's clarifying questions and the posture
question); after the approved tasks document it opens the `gate-b` wait (approve the task
plan, or annotate it for one revision).

### Implementation

The controller works the task list in order. For a task marked for TDD, the test author
writes the failing tests first and commits them (`test(<spec>): task <N> red`); the
red-on-base proof uses `tdd-test-command`, `red-on-base` and `red-on-base-setup` from
`agent-rules.md`. A measurement or report task — one whose success is evidence produced
by running the gates (a bench run, a staging capture, a generated reference), with
nothing that can fail before the code exists — carries no `- Test:` seam, so the router
(`isTddMarked`) routes it implementer-only and the checks it names are its pass
criterion. This stays a drafter-authored exception, not a first-class task kind. The
implementer implements the task and commits. The review gate runs
in-process (`review-task`): the touched paths against the sensitive, generated and prose
path lists, the checks the implementer reported, the typecheck, the hygiene signals and a
risk score. A low-risk task closes on the gate. A high-risk task, or a task in a sensitive
path, goes to the verifier; a `not done` verdict starts a fix round (implementer again,
then the verifier), three rounds at most, then the adjudicator rules. When every task is
closed, the end-to-end verifier runs the spec's verification scenario. The controller then
pushes the branch, opens the pull request and waits for its checks (twenty-second polls,
up to thirty minutes); a red check starts a reconcile round (an implementer fixes, the
controller pushes), three at most.

### Merge

The merge rule above. A merged PR writes a `pr.merged` row to the ledger.

### Retrospective

The compiler step reads the retro log, the HANDOFF sections, the deferrals, the
implementation logs, the task reviews, the git log and the earlier retrospectives, and
writes `retrospective.md`. The analyst step writes `retrospective-proposals.md`: one
proposal per finding with its target, effort, risk and, where needed, a decision. The run
then opens the `retro-plan` wait: the decision questions and one approve-or-drop toggle per
proposal. The answer writes `retrospective-plan.md` with `Status: APPROVED`.

### Close-out

The controller reads the approved plan and classes each proposal by its `Target:` line
(and a concrete path when the Target names one): `store` (the spec store, direct commits),
`harness` (this repository), `code` (the project's repository), `home` (`~/.claude`), or
`none` (nothing to land: a "no change" decision, or a human action, which becomes a
to-do). It works one batch per class: an implementer lands the items in a retro worktree
on `chore/<spec>-retro`; the gate checks each landed item against the paths it names (or
the commit's own files); a high-risk item goes to the verifier; three fix rounds, then the
adjudicator. Each item gets one close-out line in the plan; each repository with commits
gets one pull request. The plan ends `Status: CLOSED`.

### Run end

The close-out's pull requests merge by the merge rule, each with its repository's rules
(the project's for the code repository, the repository's own `agent-rules.md` for the
harness; the harness is `ask`, so that one is a `merge` wait). The controller writes
`run.end`, commits the spec store, rebases it onto its remote and pushes it. A push that
fails is an `error` wait, never a silent drift. The run is `done`.

## Agent rules

`agent-rules.md` at the spec store root is the project's rule file. The roles read all of
it as rules. The controller reads these keys (`src/dashboard/harness/run-setup.ts`,
`src/core/gate-rules.ts`, `src/controller/controller.ts`):

| Key or section | Read by | Meaning |
| --- | --- | --- |
| `worktree-per-change: required` | the controller | run in a worktree on `feat/<spec>` |
| `worktree-setup: \`<command>\`` | the controller | run once in a new worktree |
| `gates: block\|record` | the setup view | a launch always records |
| `merge-method: merge\|squash` | the merge rule | how the PR is merged |
| `post-merge: \`<command>\`` | the merge rule | run after a merge, ten-minute budget |
| `merge: auto\|ask` | the merge rule | merge by rule, or open a `merge` wait |
| `baseline-w-per-spec: <n>` | the controller | the token cap is twice this |
| `baseline-w-per-task: <n>` | the Usage page | the repository's W per task baseline |
| `tdd-test-command: <command>` | the review gate | the red-on-base proof |
| `red-on-base`, `red-on-base-setup` | the review gate | the proof's mode and setup |
| `lint: <command>` | nobody | informational only; put the command under `## Checks` to have it run |
| `## Checks` bullets | the implementer | the commands it runs and reports to the gate |
| `typecheck: none` | the review gate | the project declares no typecheck |
| `## Sensitive paths` bullets | the review gate | a touched path here raises the risk |
| `## Generated paths` bullets | the review gate | excluded from the line rule |
| `## Prose paths` bullets | the review gate | `*.md` under these excluded from the line rule |
| `## Providers` rows (`- <agent>: <provider> [<model>]`) | the setup view | a role on another provider |

`init` writes five of these keys into a new `agent-rules.md`: `worktree-per-change`,
`worktree-setup`, `tdd-test-command`, `merge-method` and `merge`.

## Roles and models

`harness/agent-profiles.json` mirrors the frontmatter of the eleven role files. A test
pins them to each other. The controller is code and has no model.

| Role | Model | Effort |
| --- | --- | --- |
| `sdd-drafter`, `sdd-adjudicator`, `sdd-advisor` | `claude-opus-5-5` | high |
| `sdd-reviewer`, `sdd-implementer`, `sdd-verifier` | `claude-opus-4-8` | xhigh |
| `sdd-reviser`, `sdd-retro-compiler`, `sdd-retro-analyst` | `claude-opus-4-8` | high |
| `sdd-checker`, `sdd-test-author` | `claude-sonnet-5` | high |

`sdd-advisor` is not a step in a run: it is the advisor's role, run only in the
operator's conversation or the one-shot second opinion (see "The advisor").

A `## Providers` row in `agent-rules.md` moves an eligible role (`sdd-reviewer`,
`sdd-checker`, `sdd-reviser`) to DeepSeek for one project.

## Artifacts

In the spec store (`.spec-workflow/`), committed by the controller as the run goes:

| File | Writer | Kept |
| --- | --- | --- |
| `specs/<spec>/requirements.md`, `design.md`, `tasks.md` | the drafter and revisers | yes |
| `specs/<spec>/codebase-context.md` | the drafter | yes |
| `specs/<spec>/reviews/` (analyses, briefs, task reviews, `.tdd-<n>.json`) | the roles and the gate | analyses and reviews yes; briefs deleted at phase end |
| `specs/<spec>/questions.md`, `gate-a.json` | the controller (gate receipts) | yes |
| `specs/<spec>/harness-events.jsonl` | the controller (the ledger) | yes |
| `specs/<spec>/retrospective-log.md` | the controller, append-only | yes |
| `specs/<spec>/retrospective.md`, `retrospective-proposals.md`, `retrospective-plan.md` | compiler, analyst, the controller | yes |
| `specs/<spec>/Implementation Logs/` | the implementer (`log-implementation`) | yes |
| `approvals/` | the controller | pruned to the final version |
| `deferrals/` | the roles (`deferrals`) | yes |
| `HANDOFF.md` | the controller: the routing header, the phase log, one section per stage | yes |
| `INDEX.md` | regenerated | yes |

The ledger rows are: `run.start`, `run.end`, `phase.start`, `phase.end`, `spawn.start`,
`spawn.end`, `spawn.usage`, `round`, `judge`, `task.pick`, `task.done`, `pr.merged`,
`note`. Every row carries the run id.

In the harness home: see "The harness home".

## Installing from a checkout

This machine runs the harness from the checkout. There is no plugin to install.

1. `npm ci && npm run build` once, before the service exists.
2. `scripts/sdd-service.sh install` (see "Running the controller as a service").
3. `scripts/dev-link.sh`: links `harness/agents/*.md` into `~/.claude/agents/` and
   `harness/skills/*` into `~/.claude/skills/`, prunes links whose target is gone, and
   removes the retired activity hook's entries from `~/.claude/settings.json`. The
   controller reads the role files from the checkout; the links serve interactive
   sessions. Uninstall any harness plugin first, or the agents appear twice.
4. In each project, run `init` and then `doctor` (see "Bootstrapping a project"). `init`
   writes `.mcp.json` and registers the project; `doctor` checks the result.

To deploy a change: merge it, then `scripts/sdd-self-update.sh`. Never `npm run build` in
the live checkout while the service is installed, and never start the dashboard by hand on
the service's port: the unit then crash-loops behind the hand-started process.

### Bootstrapping a project

`init` configures a repository for a run. `doctor` checks a configured repository before a
run uses it. Run both from the checkout:

```bash
node <checkout>/dist/index.js init <repo>
node <checkout>/dist/index.js doctor <repo>
```

`init` takes the repository path and four options:

- `--store <path>` — the store root, when the spec store is a separate repository.
- `--test-command <command>` — the `tdd-test-command`.
- `--worktree-setup <command>` — the `worktree-setup` command.
- `--merge-method merge|squash` — the merge method. The default is `merge`.

`init` writes `.mcp.json`, and `agent-rules.md` when the store has none. It then registers
the project with the controller. It commits nothing. `init` exits 0 when it wrote the files
and registered the project, 1 on an input error, and 2 when registration fails.

`doctor` runs seven checks in order and prints one line for each check:

1. `mcp` — `.mcp.json` names an existing `dist/index.js`.
2. `store` — the store root holds a `.spec-workflow/` directory.
3. `agent-rules` — the store has `agent-rules.md` with the `worktree-per-change` and
   `merge-method` lines.
4. `controller` — the controller answers its health check.
5. `registered` — the controller has the repository and its store root registered.
6. `remote` — the `origin` remote is a `github.com` repository.
7. `token` — `gh` can push to that repository.

`doctor` exits 0 when every check passes, and 1 when a check fails. It writes nothing.

## Running the controller as a service

The controller is the always-on dashboard process. Run it as a systemd user service so it
starts at login and restarts if it stops. The service runs
`node <checkout>/dist/index.js --dashboard --port 5000`.

Build the checkout first (`npm ci && npm run build`, before the service exists). Then install
the service:

```bash
scripts/sdd-service.sh install
```

The command writes three user units to `~/.config/systemd/user/`:
`sdd-controller.service`, `sdd-watchdog.service` and `sdd-watchdog.timer`. It then reloads
systemd and starts the controller and the watchdog. The controller unit sets `Restart=always`
and removes `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` from the environment, because no
controller step uses a key or a token.

### GitHub credentials

The controller's children need `gh` authenticated: the implementation phase (push and
`gh pr create`), the merge rule and the close-out phase call `gh`. A systemd service does not inherit your shell, so a `GH_TOKEN` exported in
your shell does not reach it. There are two ways to give the service a credential.

- **Token file.** `install` copies `GH_TOKEN` and `GITHUB_TOKEN` (and `GH_HOST`, when set)
  from the installing shell into `<controller home>/service.env` (mode `0600`; the home is
  `$SDD_HOME` or `~/.local/state/sdd`). The controller unit reads it with
  `EnvironmentFile=-<that path>`. Re-run `install` to refresh the token. The token is never
  printed or logged.
- **`gh auth login`.** Logging in persists the credential in `~/.config/gh/hosts.yml`, which
  the service reads through `HOME`. This needs no env file; it is the simpler choice when you
  are not using a `GH_TOKEN`.

After `install`, confirm the service can reach GitHub:

```bash
scripts/sdd-service.sh status
```

`status` reports whether the env file exists and runs `gh auth status` under the service's
environment. If `gh` is unauthenticated, the implementation phase pushes the branch but opens
no PR; the controller then raises an `error` wait rather than skipping to the retrospective.

To keep the service running after you log out, enable linger once:

```bash
loginctl enable-linger $USER
```

Set `SDD_PORT` to change the port, `SDD_CHECKOUT` to point at a different checkout, and
`SDD_NODE_BIN` to pin an absolute `node` path (necessary with a per-shell version manager
such as fnm or nvm). `scripts/sdd-service.sh print` writes the units to the screen and
changes nothing. `scripts/sdd-service.sh uninstall` stops and removes them.

Check the status and the last health:

```bash
scripts/sdd-service.sh status
```

Read the logs:

```bash
journalctl --user -u sdd-controller -f
```

### Health route

The controller answers `GET /api/health` with no secret. The route reports `ok`, the
version, the uptime, the process id, the slots in use and in total, the latest usage
windows and the build time. The watchdog and the staged self-update both read this route.

### The watchdog

`sdd-watchdog.timer` runs `scripts/sdd-watchdog.sh` every minute. The watchdog reads
`/api/health` and the state of `sdd-controller.service`, and keeps `watchdog.state` in
the harness home. It raises one alert when one of three conditions holds: ten failed
health probes in a row; three automatic restarts of the unit in one hour; or the unit
loaded but not active (failed, or stuck in auto-restart) for three probes in a row, even
while the port answers. The third condition is the one a port-only probe misses: a
dashboard started by hand holds the port and keeps the health route green while the real
unit crash-loops (2026-10-14). The watchdog does not raise a second alert until the
condition clears.

An alert goes to three places: a line in `watchdog-alerts.log` in the harness home
(always), a desktop notification with `notify-send` (best effort), and an `error` wait
in the harness home, so the dashboard's Now page shows it until the operator acknowledges
it (best effort: it needs the checkout's `dist/` and the node binary the unit carries).
The watchdog is plain bash and needs only `curl` and `systemctl`, so it cannot die of the
broken `PATH` that takes the controller down. It never runs a model.

### The staged self-update

`scripts/sdd-self-update.sh` updates the controller safely. The harness repository's
post-merge command runs it. The controller never replaces itself with an untested build.
The script does these steps in order:

1. It refuses to run while a run step is in flight.
2. It fetches `origin/main` and checks the move: the divergence and dirty-path rules
   that decide whether the live checkout may move at all.
3. It builds the new commit in a staging worktree.
4. It boots the staged build once with `--smoke` on a scratch port.
5. It runs the eval cases the change selects, with the staged build (see "Eval cases"
   below). A case that fails or is inconclusive, and that no `--eval-override` names,
   stops the update here: the live checkout, `harness/` and `dist/` stay as they were.
6. It checks the move again, in case a new commit landed during the build, then moves
   the live checkout to the new commit.
7. It swaps `dist/` in and restarts the controller.

On a step 5 failure the script writes an `error` wait that names the commit, each
failing or inconclusive case with its first reason, and the eval result record's path,
so the wait shows on the dashboard.

Pass `--eval-override <id>` once per failing or inconclusive case id to deploy past it.
An override must name a case that was selected and did not pass; no flag overrides every
case. Each override appends one line to an override log in the controller home (date,
commit, case id, verdict) and creates one deferral, owned by `harness`, that names the
case and carries a ready-to-paste Progress log line. The self-update does not edit
`docs/foundation-review.md` itself; the operator pastes that line into the next Progress
log commit.

Run `scripts/sdd-self-update.sh --dry-run` to print every step without changing anything.
When the staged `dist/evals/cli.js` exists, `--dry-run` also prints the cases the change
would select and why, without running them.

### Eval cases

An eval case runs one harness role on a frozen brief against a small, fresh git
repository, three times, and grades the report and the repository after each run. A case
guards against a role or brief regression that a live run would otherwise have to catch.

Each case is one directory under `harness/evals/<id>/`, holding a `case.json` file with
these fields:

- `id`: the case id. It equals the directory name.
- `role`: the role file under `harness/agents/` the case emulates.
- `phase`: `implementation`, `document` or `closeout`.
- `spec`: the spec name the case's briefs render for.
- `turnCap`: the run's turn limit.
- `cwd`: the step's working directory under the fixture root. Optional; it defaults to
  the fixture root.
- `evidence`: the failure the case guards against — a Progress log date, a PR number or
  a retro finding id.
- `briefs`: the brief templates to render and the values to render them with.
- `fixture`: the git repository to build for each run — files, commits in order, and any
  extra the case needs, such as a pre-commit hook or a second worktree.
- `graders`: the checks that pass or fail each run.

To run one case by hand, build the package, then run:

```
node dist/evals/cli.js <id>
```

With no id, this command runs every case. It prints one line per case (verdict and run
count) and, at the end, the path of the result record it wrote under the controller
home, at `evals/results/<UTC stamp>-<commit>.json`.

When a retrospective finds a role or brief defect, its proposal names a case id, with
one line on what its grader checks, on an `Eval case:` line — or `none`, with the
reason. When the operator approves that proposal, the close-out lands the new case
directory under `harness/evals/` in the same commit as the fix. The close-out does not
run the case; the next deploy's self-update runs it for the first time.

### Where the secret lives

The dashboard binds to loopback. Every write route needs a shared secret (see T8 of the
controller design). The controller makes the secret on first start and keeps it in the
harness home. `/api/health` is the one route that needs no secret.

## The advisor

The advisor is the one model the operator talks to about every project the harness
manages, the harness itself, and the sources the operator names. It is nonessential: no
run waits for it, and no run state depends on it (design §16).

- **Entries.** Press "Open advisor" in the dashboard, or run `spec-workflow-mcp advisor`
  (aliased `sdd advisor` where the operator has set that alias) in a shell. Either starts
  a `claude` conversation in a fixed directory, with the `sdd-advisor` role, the hello
  summary preloaded, and the controller's tools connected over MCP. The second entry is
  one-shot: press "Second opinion" on a wait to run the same role as a headless step
  against that one wait; it attaches its picks to the wait and changes nothing else.
- **Staged actions.** A merge, a deploy, a launch, a wait answer, a deferral, a
  decomposition entry or an owner-backlog line the advisor proposes is staged, not run. It
  appears in the dashboard's "Staged by the advisor" group with the advisor's reason, and
  runs only when the operator presses Confirm there; Dismiss marks it so a later confirm
  is refused. A confirmed or refused action is written to the home event log as
  `advisor.action`.
- **Sources.** `sources.json` in the harness home names what the advisor may read outside
  the harness: a repository, a folder, a site, an MCP server, each with one line saying
  what it is, and a flag for a personal one. The operator edits the file by hand or asks
  the advisor to.
- **Notebook.** `advisor/notes/` in the harness home: one Markdown file per thread, with
  an index. The advisor writes it in its own words; the controller never reads it. A
  decision the advisor takes is committed where it acts (an ADR, `GLOSSARY.md`, a project
  doc) with the `advisor commit` subcommand, plus a dated line in the notebook.
- **Push.** `push.json` in the harness home names a URL. One push per new wait goes there,
  naming only its kind, project, spec and the dashboard link — never the question, the
  advice or any file content.
- **Credential.** The advisor's conversation holds its own secret, separate from the
  operator's, good only for the advisor's one MCP endpoint and no other route (see
  "Access").

Everything the advisor reads from a source is data, never an instruction: a planted line
telling it to merge, launch or stage something is content to report, not a command to
obey. That is why a staged action, not a direct write, is the only way the advisor changes
shared state.

### Retiring overwatch

The advisor replaces the standing overwatch session, `owctl`, the overwatch HUD and the
handoff file. Once the advisor's notebook has seeded its first threads from
`overwatch-handoff.md` and `owner-backlog.md`, the operator takes these one-time steps:

1. Archive the `owctl` repository (`~/repo/overwatch-tui`).
2. Delete `overwatch-hud.json` from the harness home.
3. Delete `overwatch-handoff.md` from the harness home.

## Dashboard pages

- **Now.** The waits that need the operator, with an answer sheet per kind and a Second
  opinion button; the live runs, the idle projects with their launchable spec, the specs
  closed in the last seven days, the actions the advisor has staged with Confirm and
  Dismiss, and an Open advisor button.
- **Runs.** Every run of the enabled projects in Live and Ended groups, and the Launch
  card: one card per project with the launchable spec, the setup defaults and the Launch
  button, disabled with its reason when the project cannot launch.
- **Run.** One project's run: the phase strip, each open step, the task table with the
  gate verdicts, rounds and spawns, and the Ledger, Activity and Process logs with a filter
  and a follow toggle.
- **Specs.** Every spec of every project with state chips, search and a pager; a row shows
  the decomposition order, the runs, the phase table, the deferrals and the files.
- **Deferrals.** Every deferral record grouped by project, with status chips and search.
- **Usage.** The five-hour and seven-day windows as bars with their reset times. The
  per-spec and trend views are a later release (spec 23 in the re-plan).

## Testing without tokens

The controller's loops run in tests against two stubs, so no test calls a model or GitHub.
`scripts/stub-claude.mjs` stands in for `claude`: it reads canned step results from
`STUB_CLAUDE_SCRIPT` and prints the stream a real step would; a scripted run can also
write files and run shell commands in the step's cwd, which is how a stubbed implementer
commits. `scripts/stub-gh.mjs` stands in for `gh` in the merge, discard and PR-checks
tests. A test points `CONTROLLER_CLAUDE_BIN` at the first stub and `CONTROLLER_GH_BIN` at
the second. `npm test` runs them all.

The live test bed is the fixture repository `madmatt112/sdd-fixture`: a small Node CLI
whose decomposition holds five specs (`greeting-endpoint`, `farewell`, `shout`, `whisper`,
`repeat`). A fixture run's gates and retro plan are answered by the operating session with
the recommended options.

## The legacy harness

Until 2026-10-16 the harness was a supervisor skill (`sdd-continue`) with four
orchestrator agents, their phase skills and an activity hook, run from a terminal session.
Steps (a) to (d) of the foundation rework (`docs/foundation-review.md`, ADRs 0001 to 0006)
replaced it with the controller. The last commit with the legacy harness is tagged
`legacy-harness-final`. Every project (tradr, jobsync, the fixture) runs on the controller.
