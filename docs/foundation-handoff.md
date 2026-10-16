# Foundation rework: handoff for the next session

Written 2026-10-15 by the session that landed step (c2). Read in this order: this file;
`docs/foundation-review.md` (decisions, plan, Progress log with every PR and finding);
`docs/controller-design.md` (the how); `docs/controller-tasks.md` (T1-T12 status);
`docs/adr/0001-0006`; `GLOSSARY.md`. Memory: `project_foundation_review_2026_10.md`.

## Where things stand

- Steps (0), (a), (b), (c2) and (c3) are on main and deployed (PRs #89-#133; the live build
  is `92717a7`, deployed 2026-10-16 02:50Z with no run live; no open PRs). PR #132, the
  close-out's P9 change, was closed unmerged: the proposal rested on a misread timeline. The
  controller runs as the systemd user service `sdd-controller` on port 5000 from `dist/` of
  this checkout, with the watchdog timer, the shared secret at `~/.local/state/sdd/secret`,
  and Matthew's gh token in `~/.local/state/sdd/service.env`. Health:
  `curl localhost:5000/api/health`. **Never start the dashboard by hand while the service
  is installed**: `make dashboard-local` kills the service's process and takes port 5000,
  and the unit crash-loops ("Dashboard is already running") until that process exits.
- The controller runs every phase itself (`src/controller/phases/document.ts`,
  `implementation.ts`, `retrospective.ts`, `closeout.ts`, task list T5-T14). No supervisor
  step remains. The supervisor skill, the four orchestrator agents and their phase skills
  stay in `harness/` only for tradr and jobsync, which still run whole specs on the old
  harness by hand; they go at step (d). The retrospective compile step is the new
  `sdd-retro-compiler` agent.
- Fixture runs on `madmatt112/sdd-fixture`: `run-20261012-191315` (`greeting-endpoint`) and
  `run-20261013-203521` (`farewell`) are `done` on the supervisor-run implementation.
  `run-20261015-153534` (`shout`, launched 2026-10-15 15:35Z, gate B approved 16:20Z on
  the (c3) build) is the first run of the in-code implementation, retrospective and
  close-out. The implementation phase ran clean unattended (18:30Z to 18:45Z: two tasks
  authored red first, three implemented, task 2 verified, end-to-end pass, fixture PR #3).
  The PR was then blocked for two hours: the test author's first commit `9d856f4` carried a
  `Co-Authored-By: Claude Sonnet 5` trailer and the merge rule rejected it, silently until
  PR #131 made that an `error` wait. Matthew rewrote the commit and force-pushed (a session
  cannot: the auto-mode classifier refuses history rewrites), the session answered "Retry",
  and the controller merged PR #3 by rule at 23:11Z (`eb61574`). The retrospective ran in
  code (14 findings, 9 proposals, 5 minutes); Matthew approved the plan at 02:08Z and the
  close-out ran in code to `done` at 02:31Z. **The run is the first through every in-code
  phase.** Its close-out landed nothing (0 done, 3 to-do, 6 skipped) because of three
  routing defects, fixed in PR #133 (Progress log 2026-10-16); the fixture's `.gitignore`
  item (P1) stays a to-do in the plan. Minor: task 3's
  `log-implementation` attribution names the fixture's main checkout, not the worktree
  (`source: override`); the gate diffed the right range (2 files, +26), so it is a retro
  note, not a defect to chase. The fixture's decomposition holds three specs; keep it as the test bed. Register it once per
  controller home with `POST /api/projects/add {"projectPath": "/home/mcf/repo/sdd-fixture"}`
  (Bearer secret); it is then remembered in `projects.json` across restarts.
- The watchdog (PR #122) watches the unit as well as the port and raises an `error` wait
  on the Now page; it is plain bash, so it cannot die of the broken `PATH` that took the
  controller down on 2026-10-14. `watchdog.state` and `watchdog-alerts.log` sit in the
  harness home. After a change to `scripts/sdd-service.sh`, rerun
  `SDD_CHECKOUT=/home/mcf/repo/spec-workflow-mcp bash scripts/sdd-service.sh install` from
  a shell that carries `GH_TOKEN` (it rewrites `service.env`).

## Standing rules

- Matthew's CLAUDE.md: conventional commits, first line under 72 chars, NO attribution lines
  (no Co-Authored-By, no "Generated with", no session links) in commits or PR bodies.
- Never build, pull or checkout in the main checkout while a controller step or a legacy
  harness run is live; `scripts/sdd-self-update.sh` enforces this and is the way to deploy
  (pull --ff-only, stage, smoke-boot, swap, restart). It runs fine while a run is parked at a
  wait or in `merging`. Work in worktrees under `.claude/worktrees/`, one PR per task, merge
  commit when CI is green. Keep local `main` fast-forwardable: commit docs on top of
  `origin/main` (pull --rebase before committing). CI has a timing flake in
  `registry-lock.test.ts` that was narrowed.
- Deleting tests or weakening a guarantee is a judgement call for Matthew; say so in the PR.
- Ask Matthew only outcome-level questions; mechanics are ours. Push him once per new wait.
- A fixture run's gate A and gate B are answered by the session with the recommended
  options (they are test runs); the retro-plan wait is Matthew's.
- If the service is ever down: `systemctl --user status sdd-controller` and the journal
  first, then `SDD_CHECKOUT=<checkout> bash scripts/sdd-service.sh install`.
- `scripts/sdd-self-update.sh` refuses while a step is live (every step's pid is in
  `run.json` since #128); deploy at a wait or in `merging`.
- The merge stage re-checks only while something is in flight; a PR that fails the rule
  with nothing pending (red check, conflict, wrong head, attribution trailer) is an
  `error` wait with a `merge` cursor, so "Retry" re-enters the merge stage (PR #131). `gh pr checks --watch` exits 0 on a red check:
  read the check state before `gh pr merge`, and run `npm test` before pushing.
- tradr and jobsync still run whole specs on the old harness until they move to the
  controller.

## Next, in order

1. Carried decisions for Matthew: farewell retro P2 (scope gate touched-paths to the task's
   own diff; it reverses design D18) and the stale-worktree pruning (~40 worktrees from old
   harness runs under `.claude/worktrees/`; some may hold uncommitted state). Not blocking.
2. Known gap, now a step (d) deletion item: `harness-run.json` is written into the spec
   store only by the dashboard's setup and launch routes (`multi-server.ts`, the
   `writeRunFile` calls) and deleted by the legacy launcher; the controller never reads it
   (only `buildSetupView` and the harness-run-detail message do). Drop the write with the
   legacy launcher and setup form.
3. The (c2)/(c3) done-when is met twice (`shout`, `whisper`: every phase in code, `done`).
   Still not seen live: a close-out that lands an item through the gate and the verifier.
   shout landed nothing (three routing defects, PR #133); whisper landed nothing (one more,
   `agent-rules.md` read as the harness keyword, PR #137). A fifth fixture spec is the next
   proof; approve only its proposals whose Target is the fixture itself.
4. Small PR: merge the close-out PRs by rule (they are recorded in the plan, the HANDOFF
   closeout section and `run.closeoutPrs`; the harness repo is `merge: ask`, so that one is
   a `merge` wait).
5. Step (d): the harness half is done (PR #138: supervisor skill, phase skills,
   orchestrators, hook; frozen at tag `legacy-harness-final`; after a deploy run
   `scripts/dev-link.sh` once to prune the dead links and the hook entry). Left: (d2) the
   server-side legacy paths (`launcher.ts` supervisor spawn and restore, the `active-run`
   pointer in state-files, controller and runs, `harness-run.json` writes in the setup and
   launch routes, the Now model's pointer inputs, the setup form's supervisor model), and
   the roadmap re-plan, proposed in PR #136 for Matthew. jobsync is registered; tradr's
   first controller run is held for the seven-day window reset (Saturday 15:00Z).
6. The advisor (design §16, ADR 0006): before designing its "state of the world" mechanism,
   hold the research and design session Matthew asked for (graph generators, indices). Do not
   design it solo.
7. Moving tradr to the controller is Matthew's call now that every phase runs in code.
