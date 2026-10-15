# Foundation rework: handoff for the next session

Written 2026-10-15 by the session that landed step (c2). Read in this order: this file;
`docs/foundation-review.md` (decisions, plan, Progress log with every PR and finding);
`docs/controller-design.md` (the how); `docs/controller-tasks.md` (T1-T12 status);
`docs/adr/0001-0006`; `GLOSSARY.md`. Memory: `project_foundation_review_2026_10.md`.

## Where things stand

- Steps (0), (a), (b) and (c2) are on main and deployed (PRs #89-#124, no open PRs). The
  controller runs as the systemd user service `sdd-controller` on port 5000 from `dist/` of
  this checkout, with the watchdog timer, the shared secret at `~/.local/state/sdd/secret`,
  and Matthew's gh token in `~/.local/state/sdd/service.env`. Health:
  `curl localhost:5000/api/health`. **Never start the dashboard by hand while the service
  is installed**: `make dashboard-local` kills the service's process and takes port 5000,
  and the unit crash-loops ("Dashboard is already running") until that process exits.
- The controller runs the three document phases and the implementation phase itself
  (`src/controller/phases/document.ts`, `implementation.ts`). The old supervisor is spawned
  only for the retrospective and close-out (step c3 inlines them). The implementation
  orchestrator is never spawned; its agent and skill files stay in `harness/` until step
  (d), because tradr and jobsync still run whole specs on the old harness.
- Fixture runs on `madmatt112/sdd-fixture`: `run-20261012-191315` (`greeting-endpoint`) and
  `run-20261013-203521` (`farewell`) are `done` on the supervisor-run implementation.
  `run-20261015-153534` (`shout`, launched 2026-10-15 15:35Z) is the first run of the
  in-code implementation phase; its outcome is in the Progress log once it lands. The
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
- The old supervisor still runs the retrospective and close-out in ONE process per phase
  group. tradr and jobsync still run whole specs on the old harness until they move to the
  controller.

## Next, in order

1. Carried decisions for Matthew: farewell retro P2 (scope gate touched-paths to the task's
   own diff; it reverses design D18) and the stale-worktree pruning (~40 worktrees from old
   harness runs under `.claude/worktrees/`; some may hold uncommitted state). Not blocking.
2. Known gaps to fix in small PRs: `harness-run.json` is machine state written into every
   project's spec store (gitignore it or move it to the home; the supervisor steps still
   read it until (c3)); the first run's `run.end` and the `harness-run.json` deletion land
   after the last spec-store commit and stay uncommitted.
3. Finish the (c2) done-when on `run-20261015-153534`: tasks gated and verified in code,
   the PR opened and merged by rule, the retro supervisor step, close-out, `done`. Fix what
   the run surfaces in small PRs (the per-task loop is tested only against the stub so far).
4. Step (c3): the retrospective compile and analyst as steps, close-out as the task loop over
   the plan items (design §5), retiring the retro and close-out orchestrators; then step (d):
   delete the supervisor skill, hooks, pointer file, the document and implementation
   orchestrators and their phase skills, and re-plan the roadmap (specs 16-21 parked in
   `.spec-workflow/spec-decomposition/superseded-2026-10-10.md`; spec 22 slots in after
   the dashboard pages the re-plan keeps).
5. The advisor (design §16, ADR 0006): before designing its "state of the world" mechanism,
   hold the research and design session Matthew asked for (graph generators, indices). Do not
   design it solo.
6. Moving tradr to the controller is Matthew's call now that (c2) has landed.
