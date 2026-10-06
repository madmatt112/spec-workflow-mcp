# Draft decomposition entries: dashboard redesign

Draft of 2026-10-03. These entries are written in the format of
`.spec-workflow/spec-decomposition/decomposition.md` so they can be pasted under
`## Harness operations specs` once Matthew says the design is ready. Landed in
`decomposition.md` on 2026-10-06 (commit f004fae) with one "Open for gate A" bullet added to
15 and 16; this file is the draft they came from. Design notes and the mockups are in
`docs/dashboard-redesign.md`.

Numbering continues from spec 14 (`lean-orchestrators`). Order: 15 → 16 → 17 → 18, after 14.

---

### 15. `dashboard-shell` — the five-page console, derived from the ledgers (planned)

The dashboard grew page by page from the upstream tool: eleven sidebar entries, four of
them showing task progress, two showing the run, and a Harness page whose setup form sits
above its live view. The operator built a phone HUD and a terminal TUI outside it because it
gave no fast status view, and both read a status file the overwatch session writes by hand.
This spec replaces the shell. Five pages (Now, Runs, Specs, Usage, Deferrals), one sidebar
with a project filter, a detail panel on the right, in the Linear idiom the operator chose:
dense grouped rows, collapsible groups, filter chips, search, pagination. Every row is
derived from files the harness already writes. Nothing is hand-written.

**Delivers.**

- **The shell.** A sidebar with the five routes and their counts, the projects as filter
  toggles, and a gear for theme, language, sound and notification settings. A list area
  and a detail panel. Rows 36 px, groups collapsible, chips for filters, a debounced search
  box and a pager on every list. Light and dark.
- **Now.** Four groups: waiting on you, live runs, idle projects, recently closed. A wait is
  derived: a gate (ledger `phase.end` with result `gate-a` or `gate-b` and no later
  `phase.start`), retro decisions (`retrospective-proposals.md` DECISION NEEDED while the
  plan is absent or DRAFT), a deferral owned by the human that blocks something, a run whose
  process exited without `run.end`, a run whose activity file is older than fifteen minutes
  while a spawn is open. The panel shows the selected wait read-only in this spec; acting on
  it is spec 16. Selecting a live run opens its run page.
- **Runs.** The run page: phase strip, live spawn with age badge and current tool, task table
  with gate verdict, risk, TDD and fix rounds, document rounds and spawns as collapsed
  tables, a tabbed log (ledger, activity, process log) with filter and follow. The panel
  holds the run's properties, Stop, and the saved setup as a collapsed table. A Launch chip
  shows one card per project with the routed spec, the saved setup and a one-tap Launch;
  Edit setup opens the table. This moves the existing launcher, setup and live view into
  the new layout; it adds no launch behaviour.
- **Specs.** All projects grouped, with state, phase, document versions, tasks done of
  total, PRs, deferral count, retro outcome and updated. The panel shows the selected
  spec's order, dependencies, runs, phase table, deferrals and files with an Open button for
  the editor. No document viewer.
- **Removed.** Statistics, Steering, Tasks, Implementation Logs, Approvals, Adversarial
  Analysis, the cleanup-job Settings page, the MDX editors, the spec viewer route, the
  project dropdown, and their routes, components, translations and tests. The server
  routes they used stay until a later spec shows nothing else calls them.
- **Usage and Deferrals** routes exist and show the current Deferrals list and a placeholder
  Usage page; their content is specs 17 and 18.

**Decided.**

- No project switcher. Every list is all projects; a project is a filter.
- Harness state only on spec pages. The operator reads documents in his editor.
- The run model, the watchers and `--watch` are unchanged. The new pages consume
  `src/watch/ledger.ts` and the harness watchers from spec 9; they add derivation, not
  watching.
- The TUI and the HUD artifact are not changed by this spec. The operator retires them
  himself once the Now page shows what they show.
- Desk first. The layout stacks on a phone and must not scroll sideways; it gets no phone
  flows.

**End-to-end verification.** (1) With the four projects registered and two live runs, the
Now page lists both runs with phase and detail, the idle project with its routed spec, and
the closed specs of the last seven days; a `phase.end` with result `gate-a` appended to one
ledger shows under waiting on you within five seconds without a reload. (2) The run page
for a live implementation run shows the same phase, spawn, round and task rows as `--watch`
on the same store, and the ledger tab follows new rows. (3) Launch from the Launch card
starts a headless run with the saved setup, the same as spec 9's Launch, and is disabled
with the reason while the store has a live run. (4) The Specs page lists every spec of
every project with its versions, tasks and PRs, and the panel for a closed spec shows its
two runs, its phase table and its files. (5) None of the removed routes resolves, and
`npm run build`, `npx tsc --noEmit` and `npm test` are green. (6) At 1000 px the panel
stacks under the list and nothing scrolls sideways.

**Depends on** spec 9 for the harness watchers, the launcher, the setup file and the run
model wiring, and on spec 6 for the pointer file and the hook events.

### 16. `dashboard-gates` — answer gates and the retro from the dashboard (planned)

A headless run today records the recommended picks at gate A and gate B and carries on,
and writes the retro plan as DRAFT and stops. Interactive runs block on AskUserQuestion in
a terminal session, which is why the overwatch session exists: to notice the wait and push
the operator's phone. This spec adds a third gates mode, `dashboard`: the run stops at gate
A, gate B and retro-ready, the dashboard shows the questions, the operator answers on the
Now page, the dashboard writes the answers and relaunches, and the supervisor continues
from them. With it, a notification when a wait appears.

**Delivers.**

- **Gates mode `dashboard`** in the supervisor, chosen in the setup file and the agent
  rules next to `block` and `record`. At gate A or B the supervisor writes the gate payload,
  appends the `phase.end` row with the gate result, prints one line naming the wait, and
  exits with a known exit code. On the next launch it finds the answers in `questions.md`
  and continues. At retro-ready it writes the proposals and stops; on relaunch with an
  APPROVED plan it runs close-out. The `block` and `record` modes are unchanged.
- **The refusal signal** of harness-control-pane P4 (option B): a preflight that refuses
  the run emits a refusal event and exits non-zero, so a refused launch reads as refused.
- **Answer sheets** in the Now panel. Gate: the questions and options from the gate file,
  the recommended pick marked, the recorded mechanics listed; "Answer and continue" writes
  `questions.md` in the harness's format and relaunches with the saved setup. Retro: the
  DECISION NEEDED questions, then the proposals with no decision as a ticked list;
  "Approve plan and continue" writes `retrospective-plan.md` as APPROVED with the decisions
  and relaunches. A second answer to an answered gate is refused.
- **Notifications.** A desktop notification from the open tab when a wait appears, and one
  line posted to a push service (ntfy or Pushover, configured in Settings) for the wait
  kinds the operator ticks. One message per wait, none for progress. A test button.
- **Docs.** `docs/SDD-HARNESS.md` gains the `dashboard` mode and the answer path.

**Decided.**

- Stop and relaunch, not a waiting process: a gate can wait for hours, a relaunch is a
  fresh supervisor, and it survives a dashboard restart.
- The dashboard writes the same `questions.md` the interactive gate writes, so a run
  answered on the dashboard and a run answered in a terminal leave the same record.
- The phone gets a notification, not a page. The operator does not act from the phone.
- The overwatch push and the HUD are retired by the operator once this is live; the spec
  does not touch them.

**End-to-end verification.** (1) A fixture spec launched from the dashboard with gates
`dashboard` stops at gate A with a `phase.end` result `gate-a`, a known exit code and no
pointer line; the Now page shows the questions within five seconds and the desktop
notification fires. (2) Answering on the dashboard writes `questions.md` with the answers
attributed to the operator, relaunches, and the new run continues into requirements review
without asking again. (3) The same at gate B and at retro-ready: approving the plan writes
it APPROVED with the two decisions and relaunches into close-out. (4) A launch with a
refused supervisor model shows "refused" with the preflight's reason, not "exited 0". (5)
A push arrives on the phone for the gate and none for a `spawn.end`. (6) A terminal run with
gates `block` behaves as before. (7) `npm run build`, `npx tsc --noEmit`, `npm test`,
`npm run check:plugin-assets` and `claude plugin validate . --strict` are green.

**Depends on** spec 15 for the Now page and the panel, spec 7 for the gate files and
`questions.md`, and spec 9 for the launcher and the setup file.

### 17. `dashboard-merge-and-deferrals` — the PR and the deferral queue in the loop (planned)

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

### 18. `dashboard-usage` — tokens live, per spec, and across specs (planned)

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

---

### Change to the build order section

Append after the line about 14:

> 15 → 16 → 17 → 18 after 14. 15 first because every later dashboard spec renders inside
> it. 16 second because it removes the reason the overwatch session exists. 17 before 18
> because merging is in the daily loop and usage is not.

### Boundary notes to add

- **The run model and the watchers belong to 9; derivation belongs to 15.** 15 adds no
  watcher and changes no model field.
- **Gate files and `questions.md` belong to 7; the `dashboard` mode belongs to 16.** 16
  writes the same records 7 defined.
- **The usage action belongs to 8 and 14; its display belongs to 18.**
- **The TUI is not replaced by a spec.** The operator retires it when Now shows what it shows.
