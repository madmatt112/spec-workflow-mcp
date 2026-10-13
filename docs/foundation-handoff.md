# Foundation rework: handoff for the next session

Written 2026-10-10 by session "fable-swm-ideating" (updated at the end of that session; the
Progress log in `docs/foundation-review.md` is the running record). Read in this order:
`docs/foundation-review.md` (decisions, plan, step briefs, progress), `docs/controller-design.md`
(the how), `docs/foundation-review-adversarial.md` (what was attacked and fixed),
`docs/adr/0001-0006`, `GLOSSARY.md`. Memory: `project_foundation_review_2026_10.md`.

## Standing rules for this work

- Matthew's CLAUDE.md: conventional commits, first line under 72 chars, NO attribution lines
  (no Co-Authored-By, no "Generated with", no session links) in commits or PR bodies, even
  though the harness reminder asks for them.
- Never run `npm run build`, `git pull` or `git checkout` in the main checkout
  `/home/mcf/repo/spec-workflow-mcp` while a harness run is live on this machine: tradr's
  `.mcp.json` runs this checkout's `dist/index.js` and the skills/agents are symlinked from
  `harness/`. Check `~/.local/state/sdd/active-run` and `pgrep -af 'claude -p'`. Work in
  worktrees under `.claude/worktrees/`. Pull and build main only between phases of the live
  run (ledger `phase.end` with no later `phase.start`) or when no run is live.
- Merge PRs on this repo with a merge commit once CI is green and the body is clean. Each
  deletion PR must be pure: no harness-path behaviour change.
- The live dashboard (port 5000) runs from the `dashboard-shell` worktree; do not restart it
  unless Matthew says so.
- Ask Matthew only outcome-level questions; mechanics are ours to decide.

## State at handoff

See the Progress log in `docs/foundation-review.md` for commit ids and PR numbers. In
short: steps (0), (a) and the code of (b) are on main (PRs #89-#106); main is pulled and
built in the checkout. Step (b)'s done-when (a real fixture run through the controller,
design §13) has not run yet. The controller goes live the moment the dashboard restarts on
the new build; the dashboard then needs the secret from `~/.local/state/sdd/secret` for
anything that acts. The old supervisor still runs implementation, retro and close-out, and
tradr/jobsync still run whole specs on it until they move to the controller. Two loose ends
for Matthew: the stale tradr pointer line (see the Progress log) and restarting the harness
sessions and the dashboard. Small tidy items left: unused `howler` and `@heroicons/react`
dependencies, a no-op locales block in `scripts/copy-static.cjs`, `docs/` still mentions the
extension and plugins in places, the `.github/ISSUE_TEMPLATE` and `npm-publish.yml` are
untouched, the `registry-lock.test.ts:195` timing flake.

## The live fixture run (as of 2026-10-12 23:20Z)

Run `run-20261012-191315` on project `_Dgt_snFrWSyYP-0` (`/home/mcf/repo/sdd-fixture`, repo
`madmatt112/sdd-fixture`, spec `greeting-endpoint`) is parked at the `retro-plan` wait `w-3c9400ec` (open since 2026-10-13 02:17Z): documents
approved at round 1 each, implementation done by the supervisor (3 tasks), branch pushed, PR #1
in the fixture opened by hand (gh was unauthenticated in the service; fixed by PR #109 and a
service reinstall) and awaiting Matthew's merge click; close-out follows the plan approval. When Matthew
approves on the Now page, the controller spawns the old supervisor for implementation
(`continue the sdd process`, headless), then the merge stage (`merge: auto`), then a
`retro-plan` wait, then close-out, then `done`. To watch: the run record is
`~/.local/state/sdd/runs/run-20261012-191315/run.json`, the ledger is
`/home/mcf/repo/sdd-fixture/.spec-workflow/specs/greeting-endpoint/harness-events.jsonl`, the
waits come from `GET /api/controller/waits` with the bearer secret from
`~/.local/state/sdd/secret`. Push Matthew once per new wait. Two defects seen so far, to fix
after the run: `run.json` token totals stay 0; step logs land in `controller-steps/` inside
the spec dir. The done-when also wants a controller restart mid-phase and a forced window
threshold; neither has been exercised yet.

## Next

1. Done 2026-10-11: sessions and dashboard restarted on the new build; stale pointer removed.
2. Prototype checks: done 2026-10-10, all six passed (answers in `docs/foundation-review.md`
   section 2, kit in `scripts/prototypes/`). Step (b) is unblocked.
3. Step (b) done-when: with Matthew, restart the dashboard (or `bash scripts/sdd-service.sh
   install`), sign in, launch a fixture spec, answer gate A and gate B on the Now page,
   watch the supervisor phases, the merge, the retro-plan wait and close-out; restart the
   controller once mid-phase; force a window threshold. Record the outcome in the Progress
   log. Then step (c2) (implementation loop in code) per `docs/controller-tasks.md`, then
   (c3), then (d) which also retires the document orchestrator and the old gates path.
4. Known flakes: `registry-lock.test.ts:195` and `step.test.ts` "scrubs the ANTHROPIC keys"
   (fix PR in flight on branch `fix/registry-lock-test-flake`). A PR that is DIRTY against
   main gets no CI run; rebase first.
5. Before the advisor's state-of-the-world mechanism: a research and design session with
   Matthew (he has ideas: graph generators, indices). Do not design it solo.
