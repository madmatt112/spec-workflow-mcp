# Dashboard ideation (2026-11-02)

Status: ideation result. Written from the brief at `docs/dashboard-ideation-brief.md` and
a question round with the operator on 2026-11-02 (fourteen questions, one at a time, about
outcomes). No code was written. The earlier design is `docs/dashboard-redesign.md`
(2026-10-02); this document says which of its decisions hold. The specs are entries 30 to 34 in
`.spec-workflow/spec-decomposition/decomposition.md` (revised 2026-11-03 after an adversarial
review; see section 6).

Mockups of direction A (seven artboards: Home board, ruling view, Specs, Usage, Deferrals,
Home during a deploy, Home on a phone): https://claude.ai/artifact/7p1s6R33zMQWMaz7aVPeLP

## 1. Why the operator is not satisfied (his answers)

The questions asked what he wants to see and do. The answers, in order:

1. The biggest problem is that the dashboard **looks and feels wrong**, before any missing
   feature. Specifically: "the content that IS there is cramped and dense, but there is lots
   of empty space around the content that's unused."
2. Given the whole screen, he wants **fewer things, larger**. Not the same rows with more
   padding, and not more detail per row.
3. The home view holds three things: **what needs him, with age; each live run as a card;
   what he can launch next.** Usage is not one of them.
4. When a wait lands while he is away: **a push, and he answers at the desk.** No phone
   flow.
5. To rule on an escalation at the desk he wants **everything inline on one screen**: the
   wait text, the task, the detail and the diff. Not links to the editor.
6. In a normal day he opens **Specs, Usage and Deferrals**. He does not open Runs.
7. A run card needs **step, heartbeat and controls, nothing more**: the current step and its
   age, a "last activity" heartbeat that turns red when stale, and pause, resume, stop. The
   Runs page can go.
8. A deploy should be **one Deploy action that does the sequence**: pause the live runs,
   wait for their steps to end, run the self-update, resume, and show each stage.
9. For a spec that is in `decomposition.md` but has no folder, **Launch creates the folder**.
   The next routed spec is always launchable.
10. The shape is **Home plus three plain pages** (Specs, Usage, Deferrals). No Runs page, no
    sidebar. A top bar with four links. Settings behind a gear.
11. The visual feel is a **mission control board**: big type, big status, few large tiles,
    readable from a metre away, colour means state.
12. Projects appear as **a tag on each tile, sorted by urgency**. No grouping by project, no
    columns per project, no filter.
13. The Specs page answers **"where is each project in its decomposition"**: the ordered spec
    list per project, which are closed, which is live, which is next. Little else.
14. The Usage page answers **"how much weekly window is left"**: headroom now, burn rate,
    whether the live runs fit before the reset.
15. The Deferrals page is for **watching the whole queue**: all open records across
    projects with owner, tag and state. He mostly reads.

### What this says about the October decisions

The redesign of October built the right data (files, ledger, PR state) into the wrong
container. Decision 7 (Linear: dense rows, narrow sidebar, right detail panel) is the
cause of the dissatisfaction. Linear's density is made for a team with hundreds of issues.
This operator has one or two live runs, a handful of waits and four projects. Dense rows
leave the screen empty, and the detail panel hides the one thing he must read (the wait)
behind a click.

Decision 9 (several pages, SaaS style) made it worse: Runs is a page he never opens, and the
sidebar's project list takes a column to show four names.

The problems of 2026-10-30 (section 4 of the brief) are not layout problems but they share
one cause: the page shows records, not state. A run record said "running" for five hours
because nothing on the page is derived from the step process. A wait sat for 4 h 20 min
because its age was a small grey number in a row. The fix for both is the same as the
layout fix: fewer, larger tiles whose colour and size come from age and liveness.

## 2. Three directions

Every direction keeps these constraints: one operator, desk first, deterministic data,
merge and gate answers belong to the operator, no unrequested features.

### Direction A: Board plus three pages (recommended)

Home is a board of tiles that fills the width. Three plain pages for Specs, Usage and
Deferrals. A top bar with four links and a gear. No sidebar, no Runs page, no detail
panel.

Home view:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  SDD        Home   Specs   Usage   Deferrals                     Deploy   ⚙     │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  NEEDS YOU                                                                     │
│  ┌──────────────────────────────────────┐ ┌──────────────────────────────────┐ │
│  │ ESCALATION          tradr      4h 20 │ │ GATE B           jobscout    12m │ │
│  │ account-deletion · task 7            │ │ match-eval · design v2           │ │
│  │ Reviewer: delete path skips the      │ │ 3 questions, 2 recommended       │ │
│  │ audit row when ...                   │ │                                  │ │
│  │                          [ Rule ]    │ │                     [ Answer ]   │ │
│  └──────────────────────────────────────┘ └──────────────────────────────────┘ │
│                                                                                │
│  RUNNING                                                                       │
│  ┌──────────────────────────────────────┐ ┌──────────────────────────────────┐ │
│  │ ● jobsync  match-eval       impl 9/14│ │ ● swm  run-pause          retro  │ │
│  │ implementer · task 10 · 6 min        │ │ retro-compiler · 2 min           │ │
│  │ last activity 40 s ago               │ │ last activity 3 s ago            │ │
│  │                 [ Pause ]  [ Stop ]  │ │                 [ Pause ] [ Stop]│ │
│  └──────────────────────────────────────┘ └──────────────────────────────────┘ │
│                                                                                │
│  NEXT                                                                          │
│  ┌──────────────────────────────────────┐ ┌──────────────────────────────────┐ │
│  │ tradr    account-deletion-retro      │ │ jobscout   19 of 22 · sweep-ui   │ │
│  │ saved setup · opus / high            │ │ saved setup · opus / high        │ │
│  │                        [ Launch ]    │ │                        [ Launch ]│ │
│  └──────────────────────────────────────┘ └──────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────┘
```

Rules of the board:

- Three bands, in this order, each with as many tiles as it has items. An empty band shows
  one quiet line ("nothing needs you"). The bands never collapse.
- Tiles are large: title line in big type, two lines of fact, one action. Two tiles per row
  at desk width, one per row on a phone.
- Within a band, tiles sort by urgency: waits by age (oldest first), runs by staleness
  (most stale first), launch by decomposition order.
- Colour means state and nothing else. A wait tile warms with age: neutral under 15 min,
  amber under 1 h, red after. A run tile's dot is green while the heartbeat is fresh, amber
  after 5 min without activity, red after 15 (the controller's "quiet" threshold). A run
  whose step process is gone shows as red "stalled", never as "running".
- The project is a tag on the tile. No grouping, no filter.
- Every action shows its stages in the tile where it was pressed (pressed, running, done or
  failed with the reason). Nothing happens off-screen.

The "something needs you" flow:

1. A wait record is written. The shell raises a desktop notification (exists today) and the
   controller sends one phone push (kind, project, spec, one line) through ntfy (new: the
   phone push has been the overwatch session's job, not the controller's).
2. The tab title carries the count and the oldest age ("2 · 4h20m"). This is the signal
   when he is at the desk but on another tab.
3. He opens Home. The wait tile is first, large, red if old. He presses the action.
4. The action opens the ruling view **in place of the board**, full width, not a side
   panel. For an escalation it holds, top to bottom: the wait text; the task row from
   `tasks.md` with its file list; the escalation detail (the controller writes it into the
   wait record, not a scratch file); the commit diff, rendered; the answer form. Fixed
   options when the wait has them, a notes box always.
5. "Answer and continue" writes the record, renders `questions.md` and resumes the run. The
   tile goes from Needs You to Running in front of him.

Deploy, as one action in the top bar: pressed, the page lists the live runs and their
step state; it pauses each, shows "waiting for step to end" per run, runs the self-update,
survives its own restart (the page reconnects and reads the stage from a deploy record),
resumes each run, then shows done. The rule "never a bare build in the live checkout" is
enforced by the action, not by the operator remembering it.

Launch: the Next tile is always present for a project whose decomposition has an unclosed
spec. Launch creates `specs/<name>/` when it is missing, then starts the run. "All specs
complete" appears only when the decomposition is complete.

Specs page: one block per project, the decomposition as an ordered list; each line is the
spec name and a state word (closed, live, next, deferred, not started), the live one
carrying its phase. Nothing else on the page. A spec's full record is out of scope until he
asks for it.

Usage page: one large gauge for the weekly window (used, left, resets at), the burn rate
over the last 24 h, and a line per live run with its share. The per-spec cost and the
trend chart move to a second tab he opens on demand, or are dropped.

Deferrals page: the queue as one table across projects: id, project, spec, tag, owner,
state, age, summary. Sorted by age. Read-only except Resolve.

### Direction B: One page

Everything on one scrolling page. The board of direction A at the top, then three sections
below it (Specs, Usage, Deferrals) in the same tile language. No navigation at all.

Home view: the same three bands as A, then:

```
│  SPECS                                                                         │
│  swm       ■■■■■■■■■■■■■■■■■■□□   run-pause (retro) · 20 of 22                 │
│  tradr     ■■■■■■■□□□□            account-deletion (escalation) · 7 of 11      │
│  jobscout  ■■■■■■■■■■■■■■■■■■■□□  sweep-ui next · 19 of 22                     │
│  jobsync   ■■■■■■□□               match-eval (impl) · 6 of 8                   │
│                                                                                │
│  USAGE        weekly window ████████████████░░░░░░  64% used · resets Sat 09:00│
│                                                                                │
│  DEFERRALS    14 open · 3 need you · oldest 9 d                [ open queue ]  │
```

The "something needs you" flow is the same as A. The ruling view opens full width over the
page and closes back to it.

What changes against A: Specs shrinks to one line per project (the bar is the
decomposition, the text is the live spec), Usage to one gauge, Deferrals to a count with a
link to a plain table. Pages are gone; the gear stays.

This is the direction that removes the most. It fits "fewer things, larger" best and it is
the cheapest to build. It fails if the Deferrals queue is something he reads at length (he
said "watch the whole queue"), because a table of fourteen records does not fit a section.

### Direction C: Keep the pages, rebuild Home

The page set, sidebar and routes stay. Home becomes the board of direction A. Runs, Specs,
Usage and Deferrals keep their current content with the type and spacing scaled up to fill
the width.

Home view: the board of A inside the current shell, with the sidebar on the left.

The "something needs you" flow: as A, but the ruling view opens in the right detail panel
of the current shell, widened to half the screen.

This is the smallest change. It answers "cramped content in empty space" on Home only. It
keeps a Runs page he never opens and a sidebar that spends a column on four names, and it
keeps the detail panel that hides the wait behind a click. It does not match his answers on
shape (10) or on Runs (7).

## 3. Which October decisions each direction keeps

| # | Decision (2026-10-02) | A: Board + 3 pages | B: One page | C: Keep pages |
| --- | --- | --- | --- | --- |
| 1 | Nothing in the old UI is protected | keeps | keeps | keeps |
| 2 | Everything derived from files and PR state | keeps; adds process liveness as a source | keeps; same | keeps; same |
| 3 | He acts from the dashboard; merge is his | keeps; actions show their stages | keeps | keeps |
| 4 | One-tap launch with saved setup | keeps; Launch also creates the folder | keeps; same | keeps; same |
| 5 | Spec pages show harness state only | keeps; narrows to the decomposition list | reverses: no spec page, one line per project | keeps as is |
| 6 | Tokens per run, per spec, trend per repo | reverses: window headroom first; per-spec and trend on a second tab or dropped | reverses: one gauge | keeps |
| 7 | Linear: dense rows, sidebar, detail panel | **reverses** all three | **reverses** all three | reverses on Home only |
| 8 | Desk first; phone gets a notification | keeps; tiles stack to one column | keeps | keeps |
| 9 | Several pages, SaaS style | partly reverses: four pages, no Runs | **reverses**: one page | keeps |

## 4. Recommendation

Direction A.

It matches his answers one for one: the three bands on Home (3), no Runs page (6, 7), four
plain pages (10), mission control tiles (11), project as a tag (12), Specs as a
decomposition list (13), Usage as the window (14), Deferrals as a readable queue (15).

Direction B is tempting because it removes the most, but it squeezes the Deferrals queue
and the Specs list into sections, and he said he reads both. If after a month of A the
three pages turn out to be glanced at rather than read, B is a deletion away.

Direction C is not enough. The complaint is the container, and C keeps the container.

What A reverses and why it is right to reverse it:

- Decision 7 was chosen from four mockups before the dashboard existed. It was chosen for
  its look, not for the number of things on the screen. The number is small, so the
  mockup's density never appeared and its empty space did.
- Decision 6 asked for three token views. The one he opens is the window. The other two
  were the overwatch's measurement tool, and the overwatch no longer measures by hand.
- Decision 9 produced a Runs page. He does not open it because the run card tells him
  whether the run is alive, and when it is not, the wait tells him why.

Order of work, if A is accepted: the board (Home) with liveness and age colour; the ruling
view with the inline diff and the escalation detail in the wait record; Launch that creates
the folder; the Deploy action; then the three pages, which are mostly deletions.

## 5. Open questions, answered 2026-11-02

Each question was put to the operator one at a time; the answer follows it.

1. **Liveness source.** The controller writes a last-activity timestamp into `run.json`
   each time the step process emits output. The board reads that field. One source.
2. **Escalation detail.** The controller copies the reviewer's detail file into the wait
   record when it writes the escalation wait. The reviewer role does not change.
3. **The diff in the ruling view.** All four projects and their worktrees are on this
   machine. The service reads the diff live with git when the view opens.
4. **Deploy survives itself.** A deploy record under `~/.local/state/sdd/` holds the stage
   and the paused run ids. The restarted service reads it, finishes the resume, and the
   reconnected page shows the stages.
5. **Repeat pushes.** One push when the wait is written, one reminder if it is still open
   after an hour, then silence. Channel (decided 2026-11-03): ntfy, POSTed by the controller;
   topic and server in `~/.local/state/sdd/notify.json`. Chosen over Pushover (paid), Gotify
   (Android only) and a Telegram bot (token handling) for a free HTTP POST with apps on both
   phone platforms and a self-host path.
6. **Usage per spec and the trend.** Dropped. Usage is the window gauge, the burn rate and a
   line per live run. The ledgers keep the data.
7. **Phone.** No phone work. The board stacks to one column; the ruling view only has to
   not break.

## 6. Adversarial review of the specs (2026-11-03)

An Opus 5.5 reviewer read entries 30 to 33 against the code. What changed as a result:

- "Stalled" is not a dead step process (the controller retries those) but a run the
  controller stopped driving after a phase threw. It is now a controller fact (`driven`) with
  a Re-drive action and an `error` wait, in spec 30.
- `lastActivity` is fed from every stream line, not only tool calls, and is owned like
  `pauseRequested` so a late write cannot undo a status change.
- The deploy script writes its own stages to `deploy.json` and runs as a transient systemd
  user unit; the service cgroup would otherwise kill it on restart. Holds get an owner field
  and cover waiting and queued runs.
- The escalation detail comes from the implementer's flag text (the stopping worker), not a
  reviewer that may never have run; the ruling form is free text.
- Burn and fit on Usage come from a new append-only utilisation log, in the window's unit.
- Orphans from the deletions have owners: Open advisor in the top bar, staged advisor actions
  as a Needs-you tile, Discard on a stopped run's tile, project toggles in the gear, density
  toggle deleted. "Edit setup" and the window in the top bar were dropped as unasked-for.
- The controller specs (30, 31) come first so the dashboard specs deploy through them.
