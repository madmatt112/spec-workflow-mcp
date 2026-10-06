# Dashboard redesign

Status: design memo. Written 2026-10-03 from the brief at
`~/.local/state/sdd/dashboard-redesign-brief.md`. On 2026-10-06 Matthew approved the plan and
the four spec entries went into `decomposition.md` as specs 15 to 18 (commit f004fae). The
draft they came from is `docs/dashboard-decomposition-draft.md`; the mock sources are in
`docs/mockups/`. Nothing in this document is implemented yet; spec 15 implements first.

Mockups:

- Four visual directions of the Home page: https://claude.ai/artifact/4x9tGqYuFqnZgxyAA8wxeK
- All five pages in the chosen direction (Linear): https://claude.ai/artifact/33sSm4rTkiXFt489QYSW3x

## 1. How the operator works today

The evidence is the overwatch handoff, the HUD artifact and the TUI, the memory notes, the
harness-control-pane spec and its retrospective, and the ledgers.

- Four projects are registered with the dashboard: spec-workflow-mcp, tradr (spec store
  tradr-hosted), jobscout and matthew-field.ca. Three run the harness at the same time.
- Each project has one interactive Claude session that runs `continue the sdd process`. An
  overwatch session coordinates: it re-briefs the harness sessions after every restart, merges
  every PR once CI is green, keeps the HUD up to date, and sends a phone push when a session
  waits on Matthew.
- The daily loop is: see what waits (gate A, gate B, the retro conversation, a ruling, a
  restart, a green PR, a deferral assigned to him), act on it, then go back to other work.
  Gates have waited for hours because nothing showed them (gate B overnight, 5 h).
- Tokens matter. The Max plan is the limit, and the efficiency plan tracks W per task per
  spec. The overwatch measures these by hand from the ledgers.
- The dashboard did not serve this loop, so two views were built outside it: the HUD artifact
  on the phone and the Go TUI in tmux. Both read a JSON file the overwatch writes by hand.

## 2. What the current UI does well and badly

| Page | Verdict | Why |
| --- | --- | --- |
| Statistics | Remove | Three counters and a "coming soon" card. Nothing the loop needs. |
| Steering | Remove | Document editor for files the harness never asks him to edit. This repo has no steering documents. |
| Specs | Replace | The list is useful; the document viewer and MDX editor are not. He reads files in his editor. |
| Harness | Rebuild | The live view is right (it mirrors `--watch`). The 13-card setup form sits above it and makes every visit a scroll. |
| Overview | Rebuild | Right idea, wrong content: it says "running" but not what waits, shows done to-dos inline, and has no picks, no PR state, no age warning. |
| Tasks | Remove | Kanban and manual status changes. The harness moves tasks itself; verdicts are already on the run view. |
| Implementation Logs | Remove | Never part of the loop. |
| Approvals | Remove | The harness approves its own documents. The annotator and diff view served the manual workflow. |
| Adversarial Analysis | Remove | Analyses are read in the editor; the settings tab configures the old manual reviewer. |
| Deferrals | Keep, rebuild | Human to-dos live here. Needs owner, blocking and filters. |
| Settings | Remove | Cleanup cron jobs, none configured. |

Overlaps today: task progress appears on four pages; the run state appears on Harness and
Overview; adversarial reviews appear on Approvals and Adversarial Analysis; deferred specs
appear on Deferrals and Harness. The sidebar is the order things were added in.

Matthew's own words on what makes it bad: built for fewer and smaller projects than he
runs; nothing collapsible; no filters or search; no pagination; a rigid one-column grid; no
colour or shading to show hierarchy.

## 3. Decisions (grill of 2026-10-02)

1. Nothing in today's UI is protected. The redesign may remove any page.
2. The dashboard replaces both the HUD artifact and the TUI. Everything on it is derived
   from files and PR state. No hand-written status lines. The overwatch stops writing the
   HUD once the dashboard shows the same.
3. He acts from the dashboard: answers gate A and gate B, decides the retro questions and
   approves the plan, merges a green PR. The merge button is for him, never for an agent.
4. Runs start from the dashboard, headless, in one tap with the saved setup. The per-role
   form sits behind an "edit setup" control. No chaining: he starts each spec's run himself.
5. Spec pages show harness state only: versions, verdicts, rounds, task outcomes, PR,
   deferrals, retro outcome. No document viewer or editor.
6. Tokens: live per run, per spec by phase and role with the orchestrator share, and the
   trend across specs per repository.
7. Visual direction: Linear. Dense rows grouped by kind, a narrow sidebar, a detail panel on
   the right that holds the selected item and its action.
8. Phone: not a target. A simple phone notification when something needs him is enough.
   Desk first; the layout must not break on a phone but gets no phone flows.
9. It may spread across several pages, SaaS style. It is not one page.

Decisions I made and he confirmed:

- No project switcher. Every list shows all projects; a project is a filter in the sidebar.
- A headless run stops at gate A, gate B and retro-ready. The dashboard writes the answers
  and relaunches the run, which continues from the recorded answers. Today a headless run
  records the recommended picks and carries on.

## 4. The pages

Five pages, one sidebar, a detail panel. Theme, language, sound and notification settings
sit behind a gear at the bottom of the sidebar.

### Now (home)

The HUD and the TUI, derived. Four groups, each collapsible:

1. Waiting on you. One row per wait, sorted by what blocks a run: a gate, retro decisions,
   a green PR, a deferral assigned to him, a run that exited with an error or a refusal, a
   run that went quiet. Each row has the project, the spec, one line of detail, the age and
   the action. Selecting a row puts the action in the panel.
2. Live runs. One row per run: project, spec, phase chip, one line of detail (round and
   worker, or task and worker, or the gate it waits on), tokens, age. Selecting a row opens
   the run page.
3. Idle projects, with the routed next spec and a Launch button when one exists.
4. Recently closed, collapsed by default, last seven days.

The panel holds the action sheet for the selected wait:

- Gate A or B: the questions and options from the gate file, the recommended pick marked,
  the mechanics that were recorded without asking listed below. "Answer and continue"
  writes `questions.md` and relaunches the run.
- Retro: the DECISION NEEDED questions with their options, then the proposals with no
  decision as a ticked list. "Approve plan and continue" writes `retrospective-plan.md` as
  APPROVED and relaunches for close-out.
- PR: repository, branch, method, author, the checks. "Merge PR" merges by the project's
  rule and shows the post-merge step.
- Deferral: the record's fields and context. "Mark resolved" or open the file.

### Runs

A run page, in the Linear issue layout: title and state, a phase strip (six phases with
version, rounds and approval time; the live one highlighted), "Live now" (the orchestrator
spawn and the worker under it with model, effort, elapsed, age badge and current tool), a
task table in the implementation phase (state, gate verdict, risk, TDD, fix rounds,
reviewer; filter chips; paginated), document rounds and spawns as collapsed tables, and a
tabbed log (ledger, activity, process log) with a filter and a follow toggle.

The panel holds the run's properties (run id, started, code root, spec store, supervisor,
providers, gates, tokens with the orchestrator share, PID), Stop, Open worktree, the saved
setup as a collapsed table (role, model, effort, provider; worktree; gates), and the gate
answers given so far.

Launch is a chip in the page header. It shows one card per project: the routed spec, the
saved setup in five lines, Launch, Edit setup. Launch is disabled with the reason when the
store has a live run or an open spec, or when nothing is routed.

### Specs

All projects, grouped by project, with chips for live, closed, deferred and not started, a
search box and pagination. Columns: state, spec, phase, document versions (R4 D3 T2), tasks
done of total, PRs with their state, deferral count, retro outcome, updated.

The panel for the selected spec: order in the decomposition, dependencies, store path,
runs with tokens, PRs; the phase table (version, rounds, approval date; the waiting phase
highlighted); its deferrals; its files with Open buttons for the editor; and the pending
action when it has one.

### Usage

Three tabs. Live: tokens today, orchestrator share, cache hit; a stacked bar per live run
by role group; the current spawns with their token fields. Per spec: a spec chooser, total W,
W per task against the baseline, orchestrator share; a stacked bar per phase; a role table
with spawns, model, W, share, cache read, W per spawn. Trend: W per task for every closed
spec by close date, one line per repository, the step-4 baselines ringed, with a table view.

### Deferrals

The queue, grouped by project, chips for open, resolved, owner you, blocking; search and
pagination. Columns: state, id, title, origin spec, owner, blocks, age. The panel shows the
record, the revisit trigger and the context, with Mark resolved, Open file and Copy path.
Open deferrals owned by him also appear under Now when they block something or their
revisit trigger has fired.

### Settings (gear)

Notifications: desktop on or off, phone push on or off with the service and topic and a
test button, and the list of wait kinds to send for. Merging: the method and the post-merge
step per project, read from each project's `agent-rules.md`. Appearance: theme, density,
language, sound.

## 5. Where everything comes from

| On the page | Source |
| --- | --- |
| A gate waits | Ledger `phase.end` with result `gate-a` or `gate-b` and no later `phase.start`; the questions from `gate-a.json` or `gate-b.json`; the recorded picks from `questions.md`. |
| Retro decisions wait | `retrospective-proposals.md` DECISION NEEDED blocks while `retrospective-plan.md` is absent or DRAFT. |
| A PR is green | `gh pr view` for the spec's PR: checks, mergeable, review state. The PR number comes from HANDOFF. The merge method from `agent-rules.md`. |
| A deferral needs him | Deferral records with owner `human`, blocking first, or a fired revisit trigger. |
| A run failed or is stuck | A launch record whose process exited without `run.end`; the supervisor's refusal signal (harness-control-pane P4, still a to-do); the activity file older than 15 minutes while a spawn is open. |
| Live run, spawns, rounds, tasks | `harness-events.jsonl` and `harness-activity.jsonl` through the existing model builder in `src/watch/ledger.ts`; task verdicts from the task-review summary route. |
| Tokens | The hook's `spawn.end` rows per run; the `harness usage` action per spec; the trend from every closed spec's ledger. |
| Specs list | The read-only INDEX snapshot and routing, the HANDOFF phase log, approvals, task progress. |

The dashboard already has the watchers for the pointer file, the HUD file, each project's
HANDOFF and ledger (`overview-watch.ts`, `project-watch.ts`). The new pages extend what
they derive, not how they watch.

## 6. The loop, and what the harness has to change

Launch a headless run from the dashboard. The run stops at gate A, gate B and retro-ready
and leaves its payload. The dashboard shows the wait, Matthew answers, the dashboard writes
the answer file and relaunches. The supervisor reads the answers and continues. At the end
of implementation the run opens its PR; the dashboard shows the checks; he merges. He
starts the next spec himself.

Why stop and relaunch rather than keep a process waiting: a gate can wait for hours, a
relaunch is a fresh supervisor that reads the answers from the spec folder, and it survives
a dashboard restart. The retrospective and close-out already work this way for headless
runs.

Harness changes:

1. A third gates mode next to `block` and `record`: `dashboard`. The supervisor writes the
   gate payload, appends `phase.end` with the gate result, prints one line naming the wait,
   and exits with a known code. On the next launch it reads `questions.md` and continues.
   Same for retro-ready: the proposals are written, the run stops; on relaunch with an
   APPROVED plan it runs close-out.
2. The supervisor refusal signal (harness-control-pane P4, option B): a refused preflight
   emits a refusal event and exits non-zero, so the dashboard reads "refused", not "exited
   0".
3. `agent-rules.md` gains a merge method (merge commit or squash) and an optional
   post-merge command per project, so the dashboard merges by each repository's rule and
   runs the sync-and-build step for this repository.

What does not change: the ledger and `--watch`, a fresh agent per round and per task, one
PR per spec, no agent merges its own PR.

Side effect worth naming: with headless runs each launch is a fresh `claude -p` process, so
the "restart every session after a merge" to-do goes away. After a merge in this repository
the dashboard itself must rebuild and restart; launched runs survive that by design.

## 7. Notifications

He is not acting from the phone, so nothing has to reach the box from outside. Two
channels, both outbound:

- Desktop: the open dashboard tab raises an OS notification when a wait appears, so he
  sees it from any window. Clicking it brings the tab forward on the item.
- Phone: the server posts one line to a push service (ntfy or Pushover) when a wait
  appears. No reply path.

One message per wait, none for progress, the same rule the overwatch push follows today.
The overwatch session stops sending pushes once this is live. A hosted bridge service is
not needed for this; it would only earn its keep if he wanted to act from outside the LAN.

## 8. Split into specs and order

Four specs, each a vertical slice. Draft entries in the decomposition format are in
`docs/dashboard-decomposition-draft.md`.

| # | Spec | Delivers | Depends on |
| --- | --- | --- | --- |
| 15 | `dashboard-shell` | The Linear layout, sidebar, project filter, the five routes; Now, Runs and Specs as read-only pages derived from the ledgers; the legacy pages removed. | 9 (the watchers and the run model), 6 (pointer file, hook events) |
| 16 | `dashboard-gates` | The `dashboard` gates mode and the refusal signal in the harness; the answer sheets for gate A, gate B and retro; relaunch; desktop and phone notifications. | 15, 7 (question gates), 9 (launcher) |
| 17 | `dashboard-merge-and-deferrals` | PR state per spec, merge by rule with the post-merge step; the Deferrals page with owner, blocking and resolve. | 15 |
| 18 | `dashboard-usage` | The Usage page: live, per spec, trend. | 15, 8 (usage action), 14 (per-source breakdown) |

Order: 15 → 16 → 17 → 18, after 14 (`lean-orchestrators`). 15 first because every other
spec renders inside it. 16 second because it is the change that removes the overwatch's
reason to exist. 17 before 18 because merging is in the daily loop and usage is not.

Bump: minor for each (a new page is a template change).

## 9. Open items for Matthew

- Push service: ntfy (free, self-hostable, needs the ntfy app) or Pushover (one-time
  purchase, its own app). Either is one HTTP POST from the server.
- "Open in editor" on a spec's files: a `vscode://` link, or copy the path. The link is
  one line if the editor is VS Code.
- i18n: the dashboard carries seven locales. The new pages are single-user. Keep the
  react-i18next scaffolding with English only, or drop it for the new pages.
- Density: the mock uses 36 px rows. Say if you want them tighter or looser before the
  spec pins a number.
- One run per spec store: Launch is disabled while another spec on the same store is open.
  Confirm that rule stands for dashboard launches.
