# Foundation rework: handoff for the next session

Written 2026-10-13 by session "fable-swm-ideating" at the end of its context window. Read in
this order: this file; `docs/foundation-review.md` (decisions, plan, Progress log with every
PR and finding); `docs/controller-design.md` (the how); `docs/controller-tasks.md` (T1-T11
status); `docs/adr/0001-0006`; `GLOSSARY.md`. Memory: `project_foundation_review_2026_10.md`.

## Where things stand

- Steps (0), (a) and (b) are on main and deployed (PRs #89-#110, no open PRs). The controller
  runs as the systemd user service `sdd-controller` on port 5000 from `dist/` of this
  checkout, with the watchdog timer, the shared secret at `~/.local/state/sdd/secret`, and
  Matthew's gh token in `~/.local/state/sdd/service.env`. Health: `curl localhost:5000/api/health`.
- The first real run, `run-20261012-191315` on the fixture project `madmatt112/sdd-fixture`
  (`/home/mcf/repo/sdd-fixture`, project id `_Dgt_snFrWSyYP-0`, spec `greeting-endpoint`),
  is at: **running closeout supervisor** (Matthew approved the retro plan at about 03:20Z on 2026-10-13; close-out
  runs through the old supervisor and should end with the run `done`). Watch it:
  `~/.local/state/sdd/runs/run-20261012-191315/run.json`, the ledger at
  `/home/mcf/repo/sdd-fixture/.spec-workflow/specs/greeting-endpoint/harness-events.jsonl`,
  waits via `GET /api/controller/waits` with `Authorization: Bearer $(cat ~/.local/state/sdd/secret)`.
  If it ends `done`, record it in the Progress log; if it writes an `error` wait, read the
  wait text and the last step log under `runs/<id>/steps/` before touching anything.
- Done-when scorecard (design §13 (b)): proven = launch from the dashboard, gate A and B
  answered there with resume, three document phases in code, the supervisor bridge, three
  controller restarts mid-run (self-update) with the run intact, the staged self-update, the
  retro-plan wait answered. Not yet = merge by rule (the no-PR path hit first; fixed, needs a
  second run), close-out to `done` (in progress), a forced window threshold.

## Standing rules

- Matthew's CLAUDE.md: conventional commits, first line under 72 chars, NO attribution lines
  (no Co-Authored-By, no "Generated with", no session links) in commits or PR bodies.
- Never build, pull or checkout in the main checkout while a controller step or a legacy
  harness run is live; `scripts/sdd-self-update.sh` enforces this and is the way to deploy
  (pull, stage, smoke-boot, swap, restart). Work in worktrees under `.claude/worktrees/`,
  one PR per task, merge commit when CI is green. A PR that is DIRTY against main gets no CI
  run: rebase first. CI has a timing flake in `registry-lock.test.ts` that was narrowed.
- Deleting tests or weakening a guarantee is a judgement call for Matthew; say so in the PR.
- Ask Matthew only outcome-level questions; mechanics are ours. Push him once per new wait.
- The old supervisor still runs implementation, retro and close-out. tradr and jobsync still
  run whole specs on the old harness until they move to the controller.

## Next, in order

1. See the fixture run to `done`. Log it. Then delete nothing: the fixture repo stays as the
   test bed for the second run.
2. A second fixture run to prove merge by rule and the no-PR error wait (add a second small
   spec to the fixture's `decomposition.md`, launch from the dashboard). Also force a window
   threshold once (`CONTROLLER_WINDOW_THRESHOLD=0.01` in `service.env`, restart, launch,
   watch it park, restore).
3. Known defects to fix in small PRs: `run.json` token totals stay 0 although every
   `spawn.end` row carries usage; step logs are written to `controller-steps/` inside the
   spec dir (design §3 puts them in the home; make sure they are not committed); the
   fixture's retro proposals P2 (declare `typecheck: none` in agent-rules.md so the gate
   stops logging a degraded state) and P4/P5 (citation lint widening) are harness items worth
   carrying into this repo's backlog.
4. Step (c2): the implementation loop in code (`docs/controller-tasks.md` T6 notes and design
   §5 "Implementation"), retiring the implementation orchestrator; then (c3) retro and
   close-out; then step (d): delete the supervisor skill, hooks, pointer file, the document
   orchestrator and `sdd-document-phase`, and re-plan the roadmap (specs 16-21 are parked in
   `.spec-workflow/spec-decomposition/superseded-2026-10-10.md`).
5. The advisor (design §16, ADR 0006): before designing its "state of the world" mechanism,
   hold the research and design session Matthew asked for (graph generators, indices). Do not
   design it solo.
6. Moving tradr to the controller is Matthew's call once (c2) lands.
