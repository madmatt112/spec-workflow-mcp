# Overwatch role and headless runs: discussion notes

Written 2026-10-09 by the overwatch session (spec-workflow-mcp-bb) for a big-picture session.
Status: discussion only. Matthew has not decided. Nothing here is in a spec yet, except the
items marked "in spec 16 scope".

## 1. The question

Matthew, 2026-10-09:

> If we allow headless harness runs that are launched from the dashboard, the way the current
> "continue the sdd process" agent behaviour often outputs information and questions directly to
> its Claude Code session (i.e. the user) without messaging the overwatch is going to be a problem
> in a headless environment. The overwatch might need to become non-optional, and the whole
> harness structure should be designed so that the user only ever directly interacts with the
> overwatch agent (via the dashboard or via a Claude Code session, not sure which one), and the
> overwatch handles all in/out communication and coordination of harness runs.

## 2. How the system works today

### 2.1 Actors

- **Harness run.** One Claude Code session runs the `sdd-continue` skill (the supervisor). The
  supervisor spawns one phase orchestrator at a time (requirements, design, tasks,
  implementation, retrospective, close-out). Orchestrators spawn workers (drafter, reviewer,
  reviser, implementer, verifier, test author, adjudicator, checker, retro analyst).
- **Operator.** Matthew. He starts sessions, answers gates, approves retro plans, restarts
  sessions after harness changes.
- **Overwatch session.** An interactive Claude Code session in the spec-workflow-mcp repo. It
  never runs "continue the sdd process" itself. It watches all runs, briefs harness sessions,
  recommends gate picks, reviews and merges PRs, coordinates between sessions, and keeps the
  operator's to-do list. It is optional: the harness runs without it.

### 2.2 Communication paths

| From | To | How |
| --- | --- | --- |
| Harness run | Operator | Plain text and `AskUserQuestion` in its own terminal session |
| Harness run | Overwatch | `owctl inbox <from> <text>` (durable, only when the session was told to) |
| Harness run | Anyone | Run ledger `harness-events.jsonl` per spec (run.start, phase.end, round, spawn.*, run.end) |
| Overwatch | Harness run | `SendMessage` cross-session (needs the session's current name from `ListAgents`) |
| Overwatch | Operator | Terminal text, `PushNotification`, HUD (`owctl`, Charm TUI) |
| Dashboard | Operator | Now / Runs / Specs / Usage / Deferrals pages, read from ledgers and spec files |
| Dashboard | Harness run | Launch: writes a setup file and spawns `claude -p "continue the sdd process" …` |

The active-run pointer `~/.local/state/sdd/active-run` (one line per live run: repo, spec dir,
run id) is how the dashboard and the hook decide that a run is live.

### 2.3 Gates modes today

- `block`: the supervisor asks with `AskUserQuestion` in its terminal and waits.
- `record`: the supervisor records the recommended picks and continues (used headless).
- Retro: headless writes the plan as DRAFT and stops; interactive holds a conversation.

## 3. What is already planned (decomposition.md, swm spec store)

- **Spec 16 `dashboard-gates`** (next swm spec). Adds gates mode `dashboard`: at gate A, gate B
  and retro-ready the supervisor writes the gate payload, appends `phase.end`, prints one line,
  and exits with a known exit code. The dashboard shows answer sheets on the Now page, writes
  `questions.md` (or an APPROVED `retrospective-plan.md`), and relaunches. "Stop and relaunch,
  not a waiting process." Also: a refusal signal, continue after a usage limit, desktop and push
  notifications (ntfy or Pushover), a frontend typecheck in the review gate, and (added
  2026-10-09) PID-based run liveness. Decided: "The overwatch push and the HUD are retired by the
  operator once this is live." The build order says spec 16 goes second "because it removes the
  reason the overwatch session exists."
- **Spec 17 `dashboard-merge-and-deferrals`.** The PR and the deferral queue in the dashboard. Today
  the overwatch session merges PRs once CI is green.
- **Spec 18 `dashboard-usage`.** Tokens live, per spec and across specs.
- **Spec 19.** Reserved for the overwatch role. Not drafted. Earlier note: draft it after `owctl`
  and `/overwatch-closeout` have run for a few sessions.
- **Spec 20 `harness-home`.** One home directory for cross-project state (pointer, overwatch
  handoff, HUD, events, setups).
- **Spec 21 `repo-bootstrap`.** Put the harness on a new repository.

Shared assumptions (decomposition): the runtime is Claude Code with a Claude subscription only;
mechanisms are deterministic code and the model does only judgement and prose; the harness is
opinionated.

## 4. Evidence from 2026-10-08/09 (one overwatch session)

These are real incidents. They show where the current split breaks.

1. **The overwatch did not notice new sessions.** Matthew started two harness sessions without
   telling them to notify the overwatch. The overwatch only learns of a run from ledger rows and
   inbox notes, and only while it polls (`owctl catchup` in a Monitor that expires every 30
   minutes and must be re-armed by hand). It saw nothing until Matthew said so.
2. **The overwatch briefed the wrong session.** Session names change on every restart and match
   by repo prefix. It matched `jobscout-7d` as the jobsync session. Later the jobsync session
   restarted as `jobsync-4c` and a message to the old name failed.
3. **Runs talk to the terminal, not to the overwatch.** Gate A, gate B and both retro
   conversations happened in the harness sessions' terminals. The overwatch saw each one only
   because the session also wrote an inbox note, and relayed picks in its own terminal. The
   operator had to read two places.
4. **Ungraceful exit left a stale pointer.** Matthew closed the tradr session (`tradr-b2`) in the
   middle of an implementation batch. The pointer line stayed, the dashboard showed the run as
   live, and Launch stayed disabled. The overwatch removed the line by hand with Matthew's OK
   (it never removes lines it does not own, because a resumed supervisor can reuse its run id).
   A shell wrapper (`rtk`) briefly corrupted the pointer file during that edit. Fix planned in
   spec 16: PID + process start time in the pointer line, dashboard checks `/proc` every 2-3 s.
5. **Headless detection is wrong for dashboard launches.** Launch started
   `claude -p "continue the sdd process" --model claude-opus-5-5 …` (pid 1963135, launch record
   `~/.spec-workflow-mcp/harness/launches/jw-DAU9PDsLBNYBp.json`). The run ledger row
   `run.start run-20261009-164212` says `"headless":"no"`, and `ListAgents` lists the session as
   "interactive". The supervisor decides "headless" from whether `AskUserQuestion` is absent, so
   a `-p` run can believe it is interactive. This is exactly the failure Matthew described: a
   headless run that thinks it can ask the user. Not yet investigated.
6. **Cross-session coordination was needed and only the overwatch did it.**
   - Two close-outs (dashboard-shell and mcp-write-tools) ran at the same time and both edited
     harness files in the same checkout. The overwatch moved one into its own worktree and
     removed duplicate items.
   - Two tradr sessions would have written the same release-notes file. The overwatch gave one
     the file and told the other to edit it in place.
   - The overwatch held the local pull and build of harness PRs until the tradr run reached a
     gate, because that run reads its skills and server from the same checkout.
7. **Judgement the overwatch added.** Gate picks with reasons; reading task prompts behind gate B
   veto items (most were keyword false positives); checking the CSP against third-party scripts
   before calling it safe; reviewing PR diffs before merge; catching a rule with no producer
   (`kind: e2e` marker that nothing writes); catching a rule that reads "the newest transcript",
   which can be another session's.
8. **Restarts.** New harness rules load only at session start. Sessions that were not restarted
   ran old rules through a whole phase.

## 5. The overwatch's recommendation (not decided)

Make the **channel** non-optional, not the overwatch **agent**.

### 5.1 One queue for every human-facing message

- In any non-terminal mode (headless, dashboard launch), nothing in a run speaks to the user
  directly. No `AskUserQuestion`, no question in plain text, no status meant for a human.
- Every human-facing message becomes a structured **wait record** in one durable queue, written
  by deterministic code (a harness tool action), then the run exits with a known exit code.
- Wait kinds: gate (A, B), retro plan, escalation (design defect, adjudication deadlock, budget
  trip), error or refusal, free-text question, notice (no answer needed).
- Each record holds: kind, run id, spec, the question, the options (or free text), the run's own
  recommended pick, an optional advisor recommendation, and the answer once given.
- The dashboard renders every kind, writes the answer, and relaunches the run. This widens
  spec 16, which today covers gates and the retro only.
- Run liveness comes from the PID check (section 4 item 4), not from the agent noticing.

### 5.2 The overwatch as an optional advisor on the same queue (spec 19)

- When a wait record appears, an advisor (the overwatch session, or a one-shot agent) adds its
  recommended picks and reasons to the record. It also reviews and merges PRs until spec 17
  takes over, and coordinates across runs (shared checkouts, shared files, pull and build
  timing).
- The run never depends on it. If the overwatch is down, the operator still sees every wait in
  the dashboard, only without the advisor's picks.

### 5.3 Where the operator interacts

- **Dashboard:** answer and approve (structured, works from any device).
- **Claude Code overwatch session:** discuss, ask why, think through design. It reads and writes
  the same queue.

### 5.4 Why not make the overwatch agent the single interface

- It is the least reliable part today (section 4 items 1-3): it polls, it expires, its view of
  session names goes stale, and it must be restarted and re-briefed.
- It costs tokens while idle. Tokens are the binding limit (Max plan).
- Routing messages is mechanical. The standing rule is: mechanics in deterministic code, the
  model only for judgement and prose.
- A single LLM in the path of every answer is a single point of failure for every run.

## 6. Open questions for the big-picture session

1. Is the operator's single surface the dashboard, a Claude Code session, or both with split
   jobs (answer vs discuss)?
2. Should the overwatch be non-optional (Matthew's proposal) or an optional advisor on a
   mandatory queue (section 5)? What does each cost in tokens per day?
3. Should interactive terminal runs also stop using the terminal for questions, so there is
   one path for all runs? Or keep `block` mode for when the operator sits at the run?
4. What owns cross-run coordination (shared checkout, shared files, pull/build timing, worktree
   isolation): code rules, the advisor, or the operator?
5. How does a headless run know it is headless? Fix the detection (section 4 item 5) with an
   explicit flag from the launcher instead of tool absence?
6. Who merges PRs after spec 17: the dashboard with a human click, or an advisor with rules?
7. What happens to `owctl`, the HUD TUI, the overwatch inbox, the handoff file and
   `/overwatch-closeout` once spec 16 lands? Retire, or keep as the advisor's tools?
8. How does an advisor learn of a new run without polling? (Event stream from the dashboard
   server, a hook, or a file watch.)
9. Does spec 16 stay as scoped and spec 19 take the rest, or does spec 16 widen to the full
   queue (section 5.1)?

## 7. Pointers

- Decomposition: `.spec-workflow/spec-decomposition/decomposition.md` (specs 15-21, build order).
- Dashboard launcher: `src/dashboard/harness/launcher.ts` (spawns `claude -p`).
- Run setup and launchable spec: `src/dashboard/harness/run-setup.ts`.
- Now model (live runs, pointer): `src/dashboard/shell/now-model.ts`.
- Supervisor skill: `harness/skills/sdd-continue/SKILL.md`.
- Overwatch state: `~/.local/state/sdd/` (`active-run`, `overwatch-handoff.md`,
  `overwatch-hud.json`, `overwatch-inbox.jsonl`, `overwatch-events.jsonl`, `owner-backlog.md`).
- `owctl`: `~/go/bin/owctl`, source `~/repo/overwatch-tui`.
- Earlier memos: `docs/dashboard-redesign.md` (dashboard re-imagining, specs 15-18).
