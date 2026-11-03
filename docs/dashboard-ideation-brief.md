# Dashboard ideation brief (2026-10-30)

This brief is for an ideation session about the spec-workflow-mcp dashboard. The
operator (Matthew) is not satisfied with the design, the layout or the user experience.
The session must find out why and propose a better direction. It must not write code.

## 1. What the dashboard is

- One process serves the dashboard and the SDD controller: `spec-workflow-mcp --dashboard`,
  run as the systemd user unit `sdd-controller.service` on port 5000. The controller
  runs specs headless and speaks to the operator only through **wait records** (gate A,
  gate B, escalation, error, retro). See `docs/controller-design.md`.
- There is one operator (ADR 0001, 2026-10-10). The runtime is Claude Code on a
  subscription only (the Ultra plan). One weekly usage limit limits the work; the plan
  had a 5-hour window too until 2026-10-31. The Usage page still shows that window.
- The operator runs specs in four projects: spec-workflow-mcp itself, tradr (with
  tradr-hosted), jobsync and jobscout. Usually one or two runs are live at a time.
- To see it: open `http://localhost:5000` (bearer secret in `~/.local/state/sdd/secret`).
  For a scratch copy, `npm run dev:dashboard` (Vite) in the repo.

## 2. The current UI

Frontend: `src/dashboard_frontend/src/modules/`. The pages are in `shell/`:

| Page | File | Job |
| --- | --- | --- |
| Now | `NowPage.tsx` (31 KB) | Home. Open waits, live runs, the Open advisor button. |
| Runs | `RunsPage.tsx`, `RunPage.tsx` | Run list, one run's steps, Pause and Resume, Launch. |
| Specs | `SpecsPage.tsx` | Spec state per project. |
| Usage | `UsagePage.tsx`, `UsageTrend.tsx` | Token use and the usage windows. |
| Deferrals | `DeferralsPage.tsx` | The deferred-decision queue. |
| Settings | `Gear.tsx` | Notifications and setup. |

The sidebar (`Sidebar.tsx`) lists projects with a status dot and a count. Visual tokens
and shared parts are in `theme/` and `ui/`.

## 3. History: what the earlier rounds decided

Read `docs/dashboard-redesign.md` (grill of 2026-10-02) before you propose anything.
Its main decisions:

1. Nothing in the old UI was protected.
2. Everything on the dashboard comes from files and PR state. No hand-written status.
3. The operator acts from the dashboard: answers gates, decides retro questions, merges a
   green PR. The merge button is for him only.
4. Runs start in one tap with the saved setup. The per-role form is behind "edit setup".
5. Spec pages show harness state only. No document viewer or editor.
6. Token use per run, per spec by phase and role, and the trend per repository.
7. Visual direction: Linear. Dense rows grouped by kind, a narrow sidebar, a detail
   panel on the right for the selected item and its action.
8. Desk first. The phone gets a notification, not flows.
9. Several pages, SaaS style.

The specs that followed: dashboard-shell, -gates, -merge-and-deferrals, -usage, then
`dashboard-visual-refresh` (#187: tokens, buttons, status pills), `dashboard-project-list`
(#191) and `run-pause` (#195). The operator is still unhappy after all of them. Find out
which of these decisions still hold and which caused the problem.

## 4. Problems seen in use on 2026-10-30

These are facts from one day of operation. Use them as evidence, not as the full list.

- **No feedback on an action.** Open advisor ran for 10-20 s and then showed only a small
  grey word. The advisor had exited, and the page said nothing useful. (Fixed in #198:
  the button now says where the advisor runs, or which command to run.)
- **A dead run looks alive.** A controller step crashed. The run record kept the status
  "running" for five hours with no step. Nothing on the page showed that it was stuck
  (deferral d-e1bae32a).
- **Waits go unseen.** An escalation on tradr waited 4 h 20 min for an answer, because
  nobody had the dashboard open and the overwatch watch had lapsed. The dashboard does not
  make "something needs you, and for how long" clear.
- **Escalations are hard to judge in the page.** To rule on one, the overwatch had to read
  the wait text, a detail file in a scratch folder, the task's File list in `tasks.md`
  and the commit diff. The ruling then went back as free text.
- **Pause and resume need the API for a deploy.** A deploy means: pause each live run,
  wait for its step to end, run `scripts/sdd-self-update.sh`, resume. The page has the
  buttons but not the sequence.
- **Launching a new spec needs a hidden step.** A spec named in `decomposition.md` is not
  launchable until its `specs/<name>/` folder exists. The Runs page showed only
  "all specs complete".

## 5. Constraints

- One operator, desk first. The operator often reads on a phone through Remote Control.
- Deterministic data only. A page shows what files, the ledger and PR state say. No model
  writes status text.
- The merge button and the gate answers belong to the operator.
- Keep it simple. The operator does not want features that he did not ask for.

## 6. What the session must produce

1. The reasons for the dissatisfaction, in the operator's words. Ask him one question at a
   time, about outcomes (what he wants to see and do), not implementation.
2. Two or three different directions, each with a rough layout of the home view and of
   the "something needs you" flow. Include at least one direction that removes pages.
3. For each direction: which decisions in section 3 it keeps, and which it reverses.
4. A recommendation and a short list of open questions.

Write the result to `docs/dashboard-ideation.md`.
