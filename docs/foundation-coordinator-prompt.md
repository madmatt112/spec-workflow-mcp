# Coordinator prompt: finish the foundation rework

Paste this file's path into a Claude Code session in `/home/mcf/repo/spec-workflow-mcp`
("Read and execute docs/foundation-coordinator-prompt.md") on Opus 5.5 or better. You are
the coordinator of the remaining plan. You decide, you review, you merge, you deploy. You
delegate every build task to a subagent with a brief. You never do a build task yourself
while a subagent could.

## Read first, in this order

1. `docs/foundation-handoff.md` (state and rules), then the Progress log at the end of
   `docs/foundation-review.md` (every PR, every finding).
2. `docs/SDD-HARNESS.md` (the manual for the controller as deployed).
3. `docs/controller-design.md` and `docs/controller-tasks.md` (the how).
4. `.spec-workflow/spec-decomposition/decomposition.md`, section "Re-planned entries".
5. Memory note `project_foundation_review_2026_10.md` under
   `~/.claude/projects/-home-mcf-repo-spec-workflow-mcp/memory/`.

## Rules you obey

- Matthew's `~/.claude/CLAUDE.md`: conventional commits, first line under 72 characters,
  NO attribution trailers of any kind in commits or PR bodies, no over-engineering, no
  features he did not ask for. Technical documentation in ASD-STE100 Simplified Technical
  English.
- One worktree per task under `.claude/worktrees/`, one PR per task, merge commit. Before
  every merge read the CI conclusion with `gh run view <id> --json conclusion` and merge
  only on `success`; `gh pr checks --watch` exits 0 on a red check and `gh pr merge` does
  not refuse a red PR. Run `npm test` in the worktree before you push.
- Deploy only with `scripts/sdd-self-update.sh`, and only while no run has a live step
  (a run parked at a wait, paused, in `merging`, or no run at all). Never build in the live
  checkout by hand while the service is installed. Health: `curl localhost:5000/api/health`.
- The controller answers to nobody but waits. Fixture runs (`madmatt112/sdd-fixture`): you
  answer gate A and gate B with the recommended options; you answer the retro plan approving
  only proposals whose Target is the fixture itself (its code, `.gitignore`,
  `package.json`, its `agent-rules.md`); drop proposals that target the harness. tradr and
  jobsync runs: every wait is Matthew's; send him one push notification per new wait and
  stop.
- Deleting a test or weakening a guarantee is Matthew's call: say so in the PR body.
- Keep `~/.local/state/sdd/owner-backlog.md` current for anything only Matthew can do.
- Record every PR and finding in the Progress log, and keep `docs/foundation-handoff.md`
  true, in a docs commit on `main` after each merge (`git pull --rebase origin main` first).

## The state you inherit (2026-10-16 18:30Z)

- Steps (0), (a), (b), (c2), (c3) and (d) are done and deployed. Live build is on `main`
  at or after `1c334e2`. The legacy harness is frozen at tag `legacy-harness-final`.
- Fixture runs 1 to 5 are done or finishing (`repeat`, `run-20261016-122423`, was in
  close-out). Check `~/.local/state/sdd/runs/*/run.json` and the Now page first.
- Open for Matthew: PR #136 (the roadmap re-plan: specs 23, 24, 25, then 22). Do not merge
  it yourself; ask him once.
- tradr pre-flight is done in `tradr-hosted` (`7bc8dbb`). Its first controller run is held
  for the seven-day usage window reset, Saturday 2026-10-18 15:00Z, unless Matthew says
  "launch tradr now". jobsync is registered and idle (its roadmap is complete).

## The remaining plan, in order

### 1. Confirm the repeat run's close-out landed something

Read `/home/mcf/repo/sdd-fixture/.spec-workflow/specs/repeat/retrospective-plan.md`,
section `## Close-out`. If an item that targeted the fixture (P1, P2, P5) is `to-do` or
`skipped` for a routing or gate reason, that is a defect in `src/controller/phases/closeout.ts`
or `classifyTarget` in `src/tools/harness.ts`: brief a subagent to fix it with a test in
`src/controller/phases/__tests__/closeout.test.ts`, review, merge, deploy. If the items
landed (`done — <sha>`), record it in the Progress log: the close-out loop is proven.

### 2. tradr onto the controller (after the window reset, or on Matthew's word)

Check `~/.local/state/sdd/rate-limit.json` (`sevenDay.utilization` under 0.5 is comfortable).
Launch: `POST /api/projects/jw-DAU9PDsLBNYBp/harness/launch` with the Bearer secret from
`~/.local/state/sdd/secret` and body `{"spec":"import-off-request-thread",
"supervisorModel":"claude-opus-5-5","worktree":"yes","gates":"record","roles":{}}`.
Watch `~/.local/state/sdd/waits/` and the run's ledger
(`/home/mcf/repo/tradr-hosted/.spec-workflow/specs/import-off-request-thread/harness-events.jsonl`).
Every wait is Matthew's. Fix what the run surfaces in small PRs; a tradr close-out opens a
PR against `madmatt112/tradr` (merge by rule, squash) and possibly one against this repo
(`merge: ask`, a `merge` wait you answer after reviewing the diff). When the run is `done`,
compute W per task from the ledger's `spawn.end` rows of the implementation phase and
compare with the step-4 baseline (memory `step4-measurement-results`: tdd-task-loop 1.4M,
trading-rules 2.62M per task); write the number in the Progress log. That closes the (c2)
done-when.

### 3. The re-plan's specs (only after Matthew merges or amends PR #136)

Remove the "(proposed)" markers so `nextUnstartedSpec` routes to spec 23, then run each
spec on this repository through the controller itself (register this checkout as a project
if `projects.json` lacks it; launch from the Runs page). Order: 23 `dashboard-loop-views`,
24 `project-bootstrap`, 22 `dashboard-visual-refresh`. Spec 25 (the advisor) waits for the
design session with Matthew: never design it alone.

### 4. Loose ends, small PRs, any time

- `RunPage.tsx` header comment still mentions a Stop button on the stop route (removed by
  #140).
- `docs/SDD-HARNESS.md`: the `lint:` key of `agent-rules.md` is not in its table because
  nobody confirmed the controller reads it; check `src/core/gate-rules.ts` and fix either.
- About fifty stale worktrees under `.claude/worktrees/` (and in tradr): Matthew's call;
  ask once, with the list.
- `harness-run.json` files left in spec stores from before #140 can be deleted by hand.

## How you coordinate subagents

- One subagent per task, `general-purpose` type, briefed with: the goal in one paragraph;
  the files to read first; the exact decisions (not mechanics to explore); the worktree to
  create (`rtk bypass git worktree add .claude/worktrees/<name> -b <branch> origin/main`);
  the tests to add or adjust; "run `npx tsc --noEmit -p tsconfig.json` and `npm test`";
  "commit, push, open the PR with `gh pr create --base main`, do NOT merge"; the report
  format (under 200 words: PR number, files, tests, anything unresolved).
- A subagent's `node_modules`: run `npm ci --no-audit --no-fund` in its worktree (a
  symlink to the live checkout's install misses dev dependencies).
- You review the diff (`gh pr diff <n>` or `git diff origin/main..<branch>`) before CI
  finishes, then merge on a green conclusion, then deploy at a wait, then write the docs
  commit. Never let two subagents edit the same files at once.
- Run at most two subagents at a time; the usage windows are shared with the controller's
  own steps and with Matthew's sessions.

## Done-when for this prompt

tradr's first controller run is `done` with its W per task recorded; the re-plan is
approved and spec 23 is at least launched; every finding of the runs is fixed and
deployed; the handoff is true. Then stop and tell Matthew what is left: the advisor session
and his carried decisions.
