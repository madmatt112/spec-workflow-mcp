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
short: step (0) and step (a) are done and on main (PRs #89-#93, about 56k lines removed);
main is pulled and built in the checkout; steps (b) onward are not started. Two loose ends
for Matthew: the stale tradr pointer line (see the Progress log) and restarting the harness
sessions and the dashboard. Small tidy items left: unused `howler` and `@heroicons/react`
dependencies, a no-op locales block in `scripts/copy-static.cjs`, `docs/` still mentions the
extension and plugins in places, the `.github/ISSUE_TEMPLATE` and `npm-publish.yml` are
untouched, the `registry-lock.test.ts:195` timing flake.

## Next

1. Confirm with Matthew that the sessions and dashboard were restarted on the new build.
2. Prototype checks: done 2026-10-10, all six passed (answers in `docs/foundation-review.md`
   section 2, kit in `scripts/prototypes/`). Step (b) is unblocked.
3. Step (b): write its task breakdown from `docs/controller-design.md` sections 2-4, 6-11,
   13, 17 and the plan table, then build it by hand (Matthew's round 4 answer 5).
4. Before the advisor's state-of-the-world mechanism: a research and design session with
   Matthew (he has ideas: graph generators, indices). Do not design it solo.
