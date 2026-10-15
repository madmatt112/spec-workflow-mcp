# Foundation rework: handoff for the next session

Written 2026-10-15 by session "swm-rebuild" (renamed from "fable-swm-ideating"). Read in
this order: this file; `docs/foundation-review.md` (decisions, plan, Progress log with every
PR and finding); `docs/controller-design.md` (the how); `docs/controller-tasks.md` (T1-T11
status); `docs/adr/0001-0006`; `GLOSSARY.md`. Memory: `project_foundation_review_2026_10.md`.

## Where things stand

- Steps (0), (a) and (b) are on main and deployed (PRs #89-#121, no open PRs). The controller
  runs as the systemd user service `sdd-controller` on port 5000 from `dist/` of this
  checkout, with the watchdog timer, the shared secret at `~/.local/state/sdd/secret`, and
  Matthew's gh token in `~/.local/state/sdd/service.env`. Health: `curl localhost:5000/api/health`.
  The unit with the reboot-safe node path (#121) started cleanly after the 2026-10-14 19:45
  MDT reboot and ran through the night. **Never start the dashboard by hand while the service
  is installed**: `make dashboard-local` kills the service's process and takes port 5000, and
  the unit crash-loops ("Dashboard is already running") until that process exits.
- Both fixture runs are `done`: `run-20261012-191315` (`greeting-endpoint`, 2026-10-13,
  close-out 7/7, harness PR #113) and `run-20261013-203521` (`farewell`, 2026-10-14: fixture
  PR #2 merged by rule at 03:39:58Z, close-out 6/6, harness PR #120). Fixture `main` holds
  both specs; keep `madmatt112/sdd-fixture` as the test bed.
- Done-when scorecard (design §13 (b)): every item exercised: launch from the dashboard,
  gates A and B answered there with resume, three document phases in code, the supervisor
  bridge, six controller restarts mid-run with the run intact, the staged self-update, the
  retro-plan wait answered and close-out to `done` (first run), the forced window threshold
  (park and resume), the no-PR and unreadable-PR error waits, merge by rule (second run).
- Fixed this window: #111 step logs in `runs/<id>/steps/`; #112 supervisor reuses
  `SDD_RUN_ID`; #114 launch offers the next decomposition spec with no directory; #115 a
  reset window reads as reset, pause fields cleared; #116 + #117 `typecheck: none` honoured
  by the gate (R4.6c); #118 unreadable PR state ⇒ error wait; #119 the merge rule reads CI
  from GitHub Actions runs and commit statuses (a fine-grained PAT has no Checks permission,
  so the PR check rollup is unreadable on private repos; ADR 0003 amended); #120 farewell
  retro follow-ups (structural-red no longer forces risk high, `phase.end` before gate B,
  verifier for wiring tasks); #121 reboot-safe service unit. Roadmap: spec 22
  `dashboard-visual-refresh` added (`ab6ba46`).

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
- The old supervisor still runs implementation, retro and close-out in ONE process per
  phase group: it goes implementation → retrospective without returning to the controller,
  and the merge stage runs when it exits. tradr and jobsync still run whole specs on the old
  harness until they move to the controller.
- 2026-10-14 the reboot broke `sdd-controller.service`: its baked `PATH` carried fnm's
  per-shell dir, so `node` was not found and the unit crash-looped for ten hours while the
  watchdog saw a green health endpoint (Matthew's hand-started `make dashboard-local`).
  PR #121 makes `sdd-service.sh` bake the resolved node binary; applied live. If the
  service is ever down: `systemctl --user status sdd-controller` and the journal first,
  then `SDD_CHECKOUT=<checkout> bash scripts/sdd-service.sh install`. Open: the watchdog
  should also watch the unit (NRestarts, ActiveState), not only the port.
- The dashboard lists a project only while an MCP server process for it is alive. After a
  controller restart the fixture vanished until a background `node dist/index.js
  /home/mcf/repo/sdd-fixture` was started; that process belongs to the previous session and
  may be gone. Start one again if `GET /api/projects/list` lacks `sdd-fixture`.

## Next, in order

1. Carried decisions for Matthew: farewell retro P2 (scope gate touched-paths to the task's
   own diff; it reverses design D18) and the stale-worktree pruning. Not blocking.
2. Known gaps to fix in small PRs: the watchdog should watch the unit (`NRestarts`,
   `ActiveState`), not only the health endpoint (a hand-started dashboard kept it green
   through ten hours of crash-looping on 2026-10-14), and its `--dry-run` test reads the
   live unit's `NRestarts`, so it fails whenever the real unit has looped; the controller needs its own durable project list in the
   home (design §3) instead of the MCP-process registry; `harness-run.json` is machine state
   written into every project's spec store (gitignore it or move it to the home); the first
   run's `run.end` and the `harness-run.json` deletion land after the last spec-store commit
   and stay uncommitted; ~40 stale worktrees from old harness runs under `.claude/worktrees/`
   (pruning is Matthew's call, some may hold uncommitted state).
3. Step (c2): the implementation loop in code (`docs/controller-tasks.md` T6 notes and design
   §5 "Implementation"), retiring the implementation orchestrator; then (c3) retro and
   close-out; then step (d): delete the supervisor skill, hooks, pointer file, the document
   orchestrator and `sdd-document-phase`, and re-plan the roadmap (specs 16-21 parked in
   `.spec-workflow/spec-decomposition/superseded-2026-10-10.md`; spec 22 slots in after the
   dashboard pages the re-plan keeps).
4. The advisor (design §16, ADR 0006): before designing its "state of the world" mechanism,
   hold the research and design session Matthew asked for (graph generators, indices). Do not
   design it solo.
5. Moving tradr to the controller is Matthew's call once (c2) lands.
