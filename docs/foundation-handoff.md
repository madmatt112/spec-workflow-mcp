# Foundation rework: handoff for the next session

Written 2026-10-15 by the session that landed step (c2). Read in this order: this file;
`docs/foundation-review.md` (decisions, plan, Progress log with every PR and finding);
`docs/controller-design.md` (the how); `docs/controller-tasks.md` (T1-T12 status);
`docs/adr/0001-0006`; `GLOSSARY.md`. Memory: `project_foundation_review_2026_10.md`.

## Where things stand

- Steps (0), (a), (b), (c2) and (c3) are on main and deployed (PRs #89-#129, no open PRs). The
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
  close-out; its outcome is in the Progress log once it lands. The
  fixture's decomposition holds three specs; keep it as the test bed. Register it once per
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
  `run.json` since #128); deploy at a wait. `gh pr checks --watch` exits 0 on a red check:
  read the check state before `gh pr merge`, and run `npm test` before pushing.
- tradr and jobsync still run whole specs on the old harness until they move to the
  controller.

## Next, in order

1. Carried decisions for Matthew: farewell retro P2 (scope gate touched-paths to the task's
   own diff; it reverses design D18) and the stale-worktree pruning (~40 worktrees from old
   harness runs under `.claude/worktrees/`; some may hold uncommitted state). Not blocking.
2. Known gaps to fix in small PRs: `harness-run.json` is machine state written into every
   project's spec store (gitignore it or move it to the home; the supervisor steps still
   read it until (c3)); the first run's `run.end` and the `harness-run.json` deletion land
   after the last spec-store commit and stay uncommitted.
3. Finish the (c2)/(c3) done-when on `run-20261015-153534`: tasks gated and verified in
   code, the PR opened and merged by rule, the retrospective in code, the retro-plan wait
   (Matthew's), close-out in code, `done`. Fix what the run surfaces in small PRs (the loops
   are tested against the stub; this run is their first real exercise).
4. Small PR: merge the close-out PRs by rule (they are recorded in the plan, the HANDOFF
   closeout section and `run.closeoutPrs`; the harness repo is `merge: ask`, so that one is
   a `merge` wait).
5. Step (d): delete the supervisor skill, hooks, pointer file, the four orchestrators and
   their phase skills (tradr and jobsync must move to the controller first, or keep a
   frozen copy), and re-plan the roadmap (specs 16-21 parked in
   `.spec-workflow/spec-decomposition/superseded-2026-10-10.md`; spec 22 slots in after
   the dashboard pages the re-plan keeps).
6. The advisor (design §16, ADR 0006): before designing its "state of the world" mechanism,
   hold the research and design session Matthew asked for (graph generators, indices). Do not
   design it solo.
7. Moving tradr to the controller is Matthew's call now that every phase runs in code.
