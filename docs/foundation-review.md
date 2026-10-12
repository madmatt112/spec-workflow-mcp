# Foundation review: is the harness built on the right base?

Status: grill closed 2026-10-10, frontier empty, plan accepted. Next: step (a). Untracked memo like the
other research notes in `docs/`. Decisions land here as they are made, terms in
`GLOSSARY.md`, hard-to-reverse choices as ADRs in `docs/adr/`.

## 1. The question

Matthew, 2026-10-09:

> I'm worried that at this point in the SWM lifecycle, we are building features and functions
> on top of the wrong foundation. SWM was built (by upstream) and then forked (by me) as
> something very different from what it is today and where I want it to go. Consider if
> rebuilding / migrating / reworking / redesigning the product from base principles would
> ultimately produce a superior product.

Trigger: `docs/overwatch-role-and-headless.md` (the communication paths, headless detection,
pointer staleness, cross-run coordination and restart problems of 2026-10-08/09).

## 2. Where the code stands today (facts, 2026-10-09)

| Area | Lines | Note |
| --- | --- | --- |
| src/core | 23,015 | path/root resolution, parsers, approvals, registry, typecheck, git |
| src/tools | 17,000 | 18 MCP tools |
| src/dashboard (backend) | 19,793 | multi-server, watchers, runners, launcher |
| src/dashboard_frontend | 4,894 | five-page shell after spec 15 (11 locales still present) |
| src/watch | 3,695 | ledger model and `--watch` renderer |
| vscode-extension | 13,202 | upstream; 1 commit by Matthew |
| harness (skills, agents, hooks) | 4,655 | the product's behaviour, as prose |

Fork point: upstream 2.2.6, 2026-03-13. 1,509 commits in history. Matthew's commits touch
`src/` 244 times and `harness/` 180 times.

Load-bearing map: `docs/foundation-review-codemap.md`. Headline: of ~34,000 non-test server
lines, ~22,900 (67%) are on the harness path and are deterministic mechanics with tests
(parsers, approvals, gate, lint, worktree roots, ledger, launcher, shell). ~6,300 are
legacy-only, plus ~1,650 lines of dead routes, the 13k-line VS Code extension, 14k lines of
plugin mirrors, ~1,400 lines of frontend residue. The control plane is 4,655 lines of prose
plus the launcher. LLMs hand-write load-bearing state: the run pointer, four scripts
transcribed from prose each run, HANDOFF rows, `questions.md`, the retro plan.

Live defects the map surfaced (not acted on; recorded for the plan):
- Nothing writes `phase.end result=gate-b`, so the Now page's gate-B wait can never fire.
- `JobScheduler` starts with every dashboard and can `fs.rm` spec directories; no UI left.
- The implementation-log migrator runs on every connect; `migration.log` is 2.1 MB of noise.
- `sdd-adjudicator` is told to call `log-implementation` but is not granted it.
- `spawn-ends/` holds 1,168 marker files, never pruned.

Claude Code primitives, checked against code.claude.com/docs on 2026-10-09:

- Nothing in Claude Code starts or resumes a local `claude -p` by itself. CronCreate,
  ScheduleWakeup and Monitor die with their session. Routines fire cloud runs only. A
  long-lived process outside Claude Code must own the queue.
- Workflow scripts: deterministic loops, `agent({schema})` typed output, results outside the
  model's context. No shell or file access, no cross-session resume, no mid-run input, and a
  usage-limit hit fails their agents. Usable inside one step, not as the controller.
- `claude -p`: `--json-schema` structured result, `--resume <session-id>`, `--max-turns`,
  `--max-budget-usd`, `--permission-prompts none`, `--agents <json>`, `--append-system-prompt`.
  AskUserQuestion is not offered without a permission host. A PreToolUse hook can answer it
  with `updatedInput`. No env var marks `-p`; the launcher passes its own flag.
- Subscription in scripts: `claude setup-token` gives a one-year `CLAUDE_CODE_OAUTH_TOKEN`.
  `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN` in the environment wins silently; scrub them.
  `--bare` needs an API key; do not depend on it.
- Hooks: 33 events; SubagentStop carries `agent_transcript_path`, no usage. Usage still
  comes from transcripts. Hooks can live in agent frontmatter.
- Cache: the main conversation of a `-p` run gets 1 h on a subscription; subagents 5 min
  unless `subagentPromptCacheTtl: 1h` or frontmatter `experimental.cacheTtl`.
- `claude agents --json --all` reports background-session state as an enum. `claude plugin
  eval --json` runs skill/agent cases in CI with exit codes.
- Agent-tool subagents still have no schema output; only workflow `agent()` and `-p` do.

Prototype checks (`scripts/prototypes/`, run by Matthew 2026-10-10, Sonnet 5.5, all PASS):

1. Persona and permissions: `--append-system-prompt-file <agent body>` plus `--allowedTools`
   and `--permission-prompts none` let a `-p` worker edit a file and run an allowed shell
   command with `permission_denials: []` in every mode tried (default, acceptEdits, dontAsk,
   bypassPermissions). No nested-process denial: the controller is not a Claude session.
2. Usage-limit error shape: not forced. But `--output-format stream-json` emits a
   `rate_limit_event` with `rate_limit_info` on every run: `status`, `resetsAt` (epoch),
   `rateLimitType`, `utilization` and `resetsAt` per window (`five_hour`, `seven_day`),
   `overageStatus`. The controller reads the window state from every step instead of waiting
   for a failure.
3. `--resume <session-id>` from a different parent process (setsid, fresh shell) continued
   the step with its context.
4. A transient systemd user unit on WSL2 ran `claude -p` on the subscription login (no API
   key, no keychain prompt).
5. `--json-schema` returned a valid reviewer-style verdict object 3/3.
6. stream-json shows `tool_use` blocks with tool names in order (Read, Bash): enough for the
   Run page's "current tool" line without the activity hook.

Also measured: a `-p` main conversation writes its cache at the one-hour tier
(`ephemeral_1h_input_tokens` 25,325 on the first call, 0 on later calls with 107k cache read).
Matthew's seven-day window stood at 91% utilisation during the checks (resets 2026-10-11 09:00 MDT).

## 3. Design tree

Root: the destination. What the product is in a year, for whom.

- A. Audience: one operator (Matthew) on N repos, or a publishable product.
- B. Spine: a run/queue/wait pipeline whose artifacts are spec documents, or a document
  workflow with an autonomous runner attached.
  - B1. One run path (every run launched headless by a controller) or two (terminal + headless).
  - B2. Operator surface: dashboard to act, a chat session to think.
  - B3. Who owns cross-run coordination (shared checkout, shared files, pull/build timing).
  - B4. The overwatch role: retired, or an optional advisor on the same queue.
- C. What is kept: ledger and watch, fresh agent per round/task, one PR per spec never merged
  by an agent, adversarial review, retro and close-out, the document phases.
- D. What is cut: VS Code extension, manual workflow pages and tools, locales, upstream
  compatibility, three plugins, other MCP clients.
- E. Where mechanics live: a deterministic controller or skill prose (depends on the
  primitives fact-finder).
- F. Quality bar: the ranking of unattended reliability, operator attention per spec,
  tokens per spec, wall clock, number of repos.
- G. Appetite and sequencing: freeze the roadmap (specs 16-21) or not; rebuild in place,
  strangler, or new repo.
- H. Identity: name and package (late, cosmetic).

## 4. Rounds

### Round 1 (2026-10-09): A, B, B1, D, F. All five recommendations accepted.

1. One operator, several projects. No design weight for other users.
2. The spine is a queue of runs and waits. Spec documents are artifacts of a run.
3. One run path: launched headless by the harness, no terminal interaction, ever.
4. Cut: VS Code extension, manual-workflow tools and pages, locales, upstream layout
   compatibility, bundled MCP plugins. Keep: ledger and watch, fresh agent per round and
   task, one PR per spec never merged by an agent, adversarial review, retro and close-out,
   the three document phases.
5. "Superior" ranks: unattended reliability and honesty about state, then operator attention
   per spec, then tokens per spec, then wall clock, then concurrent repos.

### Round 2 (2026-10-09): B2+B7, B8, B4, spec store, machine, capacity. All six accepted.

1. The dashboard is the only place the operator acts; a chat session is for thinking and
   reads the same queue. A run puts prose nowhere else.
2. The controller merges a green PR by rule; per-project "ask me first" switch (ADR 0003).
3. The overwatch role is retired. Second opinion on a wait is on demand (advisor). No LLM
   watches runs by default.
4. Spec artifacts stay in git (in-repo or separate store repo).
5. One machine. Dashboard reachable on the LAN. Homelab not a target.
6. Always on: Launch means enqueue; the controller starts runs when there is capacity, keeps
   going with the browser closed, pauses and resumes around the usage limit. No chaining.

### Round 3 (2026-10-10): scope, roadmap. Both accepted.

1. Control plane only. The document pipeline (templates, EARS, adversarial rounds, v4 cap,
   review-task gate, spec-lint) is kept as is and not reopened.
2. Specs 16 to 21 are re-planned from scratch against the controller. Closed specs are
   history; numbers carry no meaning.

### Round 4 (2026-10-10): appetite and order. All four accepted (ADR 0005).

3. Strangler in this repo. The controller is a module of the dashboard server.
4. Order: (a) deletion pass, (b) controller takes the outer loop and spawns the existing
   supervisor once per phase, (c) phase loops inlined one at a time, implementation first,
   then documents, then retro and close-out, (d) roadmap re-planned on what remains.
5. (a), (b) and the first inlined phase by hand in briefed sessions; dogfood from there.
6. tradr and jobsync keep running on the current harness; no new spec in this repo starts
   on it.

### Round 5 (2026-10-10): the advisor. All seven accepted (ADR 0006).

1. The chat is a Claude Code session (terminal, app, or phone via Remote Control) with the
   harness's context, not a chat pane in the dashboard. The dashboard offers "open advisor".
2. One role, two entries: the conversation and the one-shot second opinion share a brain.
3. At hello: the state of the world (compiled by the controller) plus tools to drill into
   anything live across all projects and the harness's own docs.
4. A registry of named sources (website repo, writing folder, other systems) the advisor
   sees at hello. What is on that list today: not yet answered, no rush.
5. It may do anything the operator can do in the dashboard, only on his word in the
   conversation, each action recorded as the advisor's on his behalf; plus ordinary coding
   work in any project.
6. A durable notebook across conversations. The controller never reads it.
7. Alive only while in use. No standing watcher.

Matthew's note on 3: he has ideas for how the state of the world is kept efficient,
progressive, updated, searchable and organised (graph generators, indices, and so on).
**Loop him in for a research and design session before that mechanism is designed.** It is
not part of step (b).

Frontier empty 2026-10-10. Decided by me, not asked: the name and npm package stay until the
controller is the product; renaming is cosmetic and can wait.

## 5. Decisions so far

- ADR 0001: one operator, several projects; legacy surfaces removed.
- ADR 0002: a run speaks to the operator only through a wait; one headless run path.
- Glossary started: operator, project, spec, spec store, run, wait, gate, harness.
- Quality ranking (round 1, answer 5).
- ADR 0003: merge by rule, per-project "ask me first".
- ADR 0004: the controller is an always-on process outside Claude Code; overwatch retired.
- ADR 0005: rework in place; controller inside the dashboard server; order (a) to (d).
- ADR 0006: the advisor is never in the path of a run; one role, two entries.
- Glossary: advisor widened; state of the world, source added.
- Glossary: controller, launch, advisor added. Term conflict noted: today's `sdd-continue`
  skill is called "the supervisor"; after this the controller routes and "supervisor" is
  avoided.

## 6. The plan (revised 2026-10-10 after the adversarial review)

| Step | Delivers | By | Doc |
| --- | --- | --- | --- |
| (0) roadmap freeze | specs 16 to 21 parked under a "superseded" heading in `decomposition.md`, INDEX regenerated, HANDOFF header says so; a stray "continue the sdd process" has nothing to start | hand, one commit on main | this section |
| (a) deletion pass | pure deletions in three or four PRs: extension; plugins and mirrors; legacy modules and routes; frontend residue. The two one-line fixes and the e2e rewrite in a separate small PR with tests | hand | section 7 |
| (b) controller outer loop + document loop | queue, launch = enqueue, liveness, waits (gate A, gate B, retro plan), merge by rule with `ask` on the harness repo, usage-window pause, auth, watchdog, cancel. The controller runs the three document phases itself (drafter, reviewer, reviser, checker, adjudicator as steps). For implementation, retro and close-out it spawns today's supervisor unchanged: implementation already ends at the PR, retro already stops headless at a DRAFT plan, close-out already starts from an APPROVED plan. The document orchestrator agent is retired | hand | `docs/controller-design.md` |
| (c2) implementation loop | implementer, test author, verifier, adjudicator as steps; PR checks loop; impl orchestrator retired | hand, then dogfood | same |
| (c3) retro and close-out loops | retro compile and analyst steps; close-out as the task loop over plan items; both orchestrators retired | harness | same |
| (adv) the advisor | the `sdd-advisor` skill, sources, notebook, cross-project tools, staged actions confirmed in the dashboard | after (b); state-of-the-world design session with Matthew first | design §16 |
| (d) tidy and re-plan | supervisor skill, hooks, pointer, transcribed scripts deleted; roadmap re-planned | harness | new decomposition section |

Why documents before implementation: the document loop proves the fresh-process-with-schema
mechanism and the waits on the loop with no irreversible git; implementation carries bash,
push, PR and merge and waits one step for that proof. Why no supervisor bridge: the
supervisor never stops at a gate when unattended, so making it stop would build spec 16
into a skill that step (d) deletes. With the document phases in the controller, the
supervisor's remaining phases already have headless stop points.

## 7. Step (a) brief: the deletion pass

Three or four PRs of pure deletions (extension; plugins and mirrors; legacy modules and
routes; frontend residue), each reviewable on its own, merge commits. No behaviour change on
the harness path in any of them. Build, typecheck and tests green at the end. Everything below is
from `docs/foundation-review-codemap.md`; check each line against the current tree before
deleting, because the map is as of 1f76bb3.

Delete:

1. `vscode-extension/` and every reference to it (README, package scripts, CI jobs).
2. `plugins/`, `.claude-plugin/marketplace.json`, `scripts/sync-plugin-assets.cjs`,
   `scripts/check-plugin-*.cjs` and the `version` script hook that calls them. Give
   `harness/` its own `.claude-plugin/plugin.json` so it can be loaded with `--plugin-dir`
   later. In every `harness/agents/*.md` grant list keep only `mcp__spec-workflow__<tool>`;
   drop the two plugin-prefixed ids. Remove the plugin drift check in `harness-source.sh`
   and the close-out rule that resyncs `plugins/`.
3. The three guide tools (`spec-workflow-guide`, `steering-guide`, `decomposition-guide`),
   all of `src/prompts/`, the steering templates in `src/markdown/`, and their registrations
   and tests.
4. `src/dashboard/adversarial-runner.ts`, `task-review-runner.ts`, `job-scheduler.ts`,
   `settings-manager.ts`, `execution-history-manager.ts`, `adversarial-display-state.ts`,
   `src/dashboard/parser.ts`, `src/core/archive-service.ts`,
   `src/core/implementation-log-migrator.ts` (and its call in `workspace-initializer.ts`),
   `src/config.ts`, with their tests. Confirm `JobScheduler` no longer starts in
   `multi-server.ts`.
5. In `multi-server.ts`: every route and WebSocket broadcast the shell does not call (the
   map lists the line ranges; the shell calls ten endpoints and six topics). The one catch:
   `e2e/worktree-shared.spec.ts` calls the PUT task-status route; rewrite that test to set
   the state through `log-implementation` or drop the assertion, do not keep the route.
6. Frontend: the i18n stack and the 11 locales (`validate:i18n` leaves `npm run build`),
   the notifications module, the changelog modal and routes, the LanguageSelector, and the
   `overview-rows` / `overview-todos` types and the HUD read in `overview-watch.ts`.
7. `containers/`, the Docker section and the MCP client matrix in the README. The README
   says what the product is now (one paragraph), how to run it from the checkout, and
   points at `docs/SDD-HARNESS.md`.

Keep: `SPEC_WORKFLOW_HOME` and `~/.spec-workflow-mcp/` (launch records, logs, registry),
`approvals` storage and its `reject` and `delete` actions, the npm publish workflow (unused,
harmless), `docs/` as is.

In a separate small PR with tests, not inside a deletion: grant `log-implementation` to
`sdd-adjudicator`; make the tasks phase write `phase.end result=gate-b` so the Now page's
gate-B wait can fire; rewrite the e2e test that used the PUT task-status route.

Done when: `npm run build`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e:worktree` are
green; the dashboard starts and shows the live tradr run; a `--watch` on a tradr ledger
renders as before; `git diff --stat main` shows deletions of roughly 36k lines and no
change under `src/core/parser*`, `src/tools/review-*`, `src/tools/spec-lint*`,
`src/watch/`.

## 9. Adversarial review (2026-10-10)

Report: `docs/foundation-review-adversarial.md`. Dispositions:

| Finding | Disposition |
| --- | --- |
| Auto-merge on the harness repo plus self-rebuild bricks the controller (blocker) | Accepted. The harness repo defaults to `merge: ask` (ADR 0003 amended). Self-restart is a staged build with a boot smoke test; the old build keeps running on failure (design §2). |
| No authentication on the LAN dashboard and the advisor API (blocker) | Accepted. Design §12 Access: loopback by default, shared secret on every mutating route and on the advisor endpoint, required on the LAN too. |
| Roadmap not frozen before (a) (blocker) | Accepted. New step (0). |
| Implementation should not be the first inlined phase | Accepted. Documents first (plan table). |
| Step (b) "wrap the supervisor" is a throwaway bridge | Accepted. (b) now inlines the document loop and spawns the unchanged supervisor for the rest. |
| Split step (a); lift the fixes out | Accepted (section 7). |
| Advisor "on the operator's word" is prose, not a mechanism | Accepted in design (§16: actions are staged and confirmed in the dashboard; sources are data). Round 6 asks Matthew to confirm, since it narrows round 5 answer 5. |
| Watchdog, test harness, budget cap, cancel | Accepted (design §2, §9, §13). |
| "Resume is cheap" is wrong for usage pauses; the self-rebuild swaps `dist/` under a live tradr run | Accepted. Claim dropped; cost to quantify in the prototypes; the post-merge hold waits on any run sharing the checkout, including legacy pointer lines. |

### Round 6 (2026-10-10): the questions the review surfaced. All seven accepted.

1. Switch-off events, never automatic: a merge that breaks main or loses data; a run touching
   a repo it was not launched for. Tokens over a ceiling is a wait, not a switch-off.
2. Only Matthew reaches the dashboard and the advisor, from this machine and his phone.
   Loopback by default, secret on everything, LAN opt-in.
3. The advisor stages an action with its reason; Matthew confirms with one click in the
   dashboard. It never executes from the chat.
4. Overnight bad build: the last good build keeps every other project running; one error
   wait names the commit.
5. Empty roadmap: idle, one notification. The harness never picks its own work.
6. jobscout falls off the harness unless it gets a GitHub remote.
7. Step (0) done in this session.

### Progress log

- 2026-10-10 step (0) done: `8fa7327` parks specs 16-21 in
  `.spec-workflow/spec-decomposition/superseded-2026-10-10.md`, rewrites the HANDOFF routing
  header, regenerates INDEX (routing: all-on-disk-complete, no backticked slug without a
  directory left in decomposition.md). `e7aef0c` commits the foundation docs, ADRs and
  glossary. Both on main, pushed.
- 2026-10-10 step (a) in flight: four worktrees under `.claude/worktrees/`, branches
  `chore/delete-vscode-extension`, `chore/delete-plugin-mirrors`,
  `chore/delete-legacy-server`, `chore/delete-frontend-residue`. Merge order: extension,
  plugins, frontend, legacy server; rebase on conflicts (package.json build script,
  multi-server.ts). The gate-B `phase.end` fix is dropped: step (b) replaces the gate path.
  The adjudicator grant fix is its own one-line PR after the plugins PR merges.
- 2026-10-10 PR #89 merged (`cd78b3b`): VS Code extension, containers, README client matrix,
  29.5k lines. Not yet pulled into the main checkout (tradr run live).
- 2026-10-10 PR #90 merged (`1b604d8`): plugins/, marketplace, sync scripts, 64 duplicate
  agent tool ids, the plugin drift check; `harness/.claude-plugin/plugin.json` added.
  CLAUDE.md (gitignored, local) trimmed by hand and pointed at the foundation docs.
- 2026-10-10 PR #91 merged (`080510c`): the adjudicator `log-implementation` grant. Its first CI
  run failed on `registry-lock.test.ts:195` (expected exit, got enter), a timing-flaky lock test;
  the rerun passed. Worth a look when the controller test harness is built.
- 2026-10-10 PR #92 merged (`856129c`): i18n stack, 11 locales, notifications, changelog
  modal and routes, the HUD read and `overview-todos`. Left for a later tidy: `howler` and
  `@heroicons/react` are now unused dependencies; `scripts/copy-static.cjs` keeps a no-op
  locales block; `overview-rows` stays because the shell's live refresh is armed by it.
- 2026-10-10 PR #93 merged (`599ff80`): guide tools, prompts, archive service, log migrator,
  legacy runners and managers, 1,650 lines of dead routes and eight broadcasts, the unconsumed
  WebSocket `initial` message; e2e rewritten to use `TaskStateStore.recordBase`. Kept on
  purpose: `src/dashboard/parser.ts` (still feeds `deferrals-update` and the shell detail; its
  API differs from `core/parser`) and the steering templates (copied on every MCP connect).
- **Step (a) complete 2026-10-10.** Five PRs (#89-#93), about 56,000 lines removed, 440 added.
  Main pulled and rebuilt in the checkout. Harness sessions and the dashboard need a restart
  by Matthew to pick up the new agent files and server.
- Found on the way, not acted on: the tradr `security-hardening` run (run-20261009-164212)
  died without `run.end`; its pointer line in `~/.local/state/sdd/active-run` is stale and
  blocks Launch for tradr until Matthew removes it or presses Stop in the dashboard. A test
  wrote a fixture launch record (run id 2026-01-01) into the real `~/.spec-workflow-mcp/
  harness/launches/`; the controller test harness must sandbox the home.
- 2026-10-11: Matthew restarted the harness sessions and the dashboard (port 5000 now runs
  the new `dist/`). The stale tradr pointer line was removed on his instruction (no process,
  no `run.end`). A leftover dev dashboard from the `dashboard-shell` worktree still listens on
  port 5090. All step (a) worktrees removed. Seven-day window reset 09:00 MDT.
- 2026-10-11 step (b) started: `docs/controller-tasks.md` (T1-T11). T1 `step`, T2 `state`,
  T3 `ledger` building in parallel on branches `feat/controller-step`, `-state`, `-ledger`.
- 2026-10-11 T2 merged (PR #94, `358676a`): `src/controller/state.ts`, 14 tests;
  `sddHome()` added to `state-files.ts`; store lock reuses `registry-lock`.
- 2026-10-11 T1 merged (PR #95): `src/controller/step.ts`, `scripts/stub-claude.mjs`, 18
  tests, real stream-json fixtures from the prototype run.
- 2026-10-11 T3 merged (PR #96): `src/controller/ledger.ts`, 12 tests, render-identical to a
  real close-out ledger through `render.ts`.
- 2026-10-11 T5a merged (PR #97): `src/controller/phases/document.ts`, 7 stub scenarios;
  gate hooks and the v4 cap left as T5b seams.
- 2026-10-11 T4 merged (PR #98): `src/controller/waits.ts`, three routes, `controller-waits`
  on the shell feed, Now page answer sheets (live Playwright pass).
- 2026-10-11 T5b merged (PR #99, `4c975d8`; its CI had to be re-triggered by a re-push): `phases/gates.ts` (gate A ranking and five-question cap,
  gate B veto list via `harness gate class-a`), the v4 cap with adjudicator and checker,
  the standoff rule, re-entry idempotence; 7 new tests. T6 building; T7, T8, T9 started in
  parallel (branches `feat/controller-merge`, `-access`, `-service`). All four builders were
  cut off by the five-hour usage window on 2026-10-11 afternoon and resumed on 2026-10-12.
- 2026-10-12 T6 merged (PR #100, `f0cc4b1`): `controller.ts`, `runs.ts`, launch = enqueue,
  the supervisor bridge, crash recovery, cancel and discard, T5b's gates wired; 2 CI runs
  (the `registry-lock` flake again). T10 and a flake fix started; T7-T9 still building.
- 2026-10-12 T9 merged (PR #102, `f54f15d`): `/api/health`, `--smoke`, `sdd-service.sh`,
  `sdd-watchdog.sh` with timer, `sdd-self-update.sh` (refuses while a step or a legacy
  pointer line is live; stages, smoke-boots, swaps). Nothing installed yet.
- 2026-10-12 T7 PR #101: conflicted with #100 on `scripts/stub-gh.mjs` (both created it);
  resolved as one stub (T7 behaviour with `STUB_GH_SCRIPT`, T6 behaviour without), rebased,
  tests green, merged on the CI rerun (`1479a1a`; the lock flake a third time). Lesson: a PR
  that is DIRTY against main never gets a CI run.
- 2026-10-12 follow-ups started: the merge stage wired into the run loop (`feat/controller-
  merge-wiring`), T11 docs (`feat/controller-docs`). T11's retirement of the document
  orchestrator and the document-phase skill moves to step (d): tradr and jobsync still run
  document phases on the old harness until they move to the controller.
- 2026-10-12 T8 merged (PR #103, `76b91d2`): `src/controller/access.ts`, loopback default,
  `--host` opt-in, bearer or session cookie, login panel; rebased over T9 (import conflicts).
- 2026-10-12 T11 docs merged (PR #104, `98fc788`): "The controller" in `docs/SDD-HARNESS.md`,
  README bullet, glossary terms step, slot, window; task statuses in `controller-tasks.md`.
- 2026-10-12 merge-stage wiring merged (PR #105, `f661401`): `merging` run status, the merge
  stage between implementation and retro, re-entry on the ask path.
- 2026-10-12 T10 merged (PR #106, `fa88788`): `controller-activity` topic, run log tail and
  rate-limit routes, Launch guards from the controller, Runs queue group with Cancel and
  Discard, Run page "Live now", Usage window bars, `merging` chip.
- 2026-10-12 flake fix merged (PR #107, `87b8af0`): `step.ts` resolved before its log stream
  flushed (a real bug, fixed); `registry-lock.ts` stale-break double-acquisition window
  narrowed (re-check dev, ino, mtime), not closable with POSIX primitives; the test now asserts
  one breaker, every critical section once, clean leftovers, instead of strict ordering.
  **Judgement call for Matthew**: the residual window is a rare lost registry entry; the
  registry moves to the harness home later, which is where to close it properly.
- **Step (b) code-complete 2026-10-12.** PRs #94-#107 (T1-T10, T11 docs, the merge wiring,
  the flake fix); no open PRs; main built at `87b8af0`. Not yet done: the done-when (design
  §13 (b)), a real fixture run through the controller. Needs Matthew: restart the dashboard
  on the new build (or install the service), sign in with `~/.local/state/sdd/secret`, and a
  fixture project with a GitHub remote to launch.
- 2026-10-12 done-when started: the service is installed and active (`sdd-controller`, new
  build, secret in place, controller API 401 without a session). Fixture repo
  `madmatt112/sdd-fixture` (private) created by the session with Matthew's go: one Node
  module, `npm test`, a store with `agent-rules.md` (`merge: auto`), steering docs, one spec
  `greeting-endpoint`. Registered as project `_Dgt_snFrWSyYP-0`; run `run-20261012-191315`
  launched through the controller (`POST .../harness/launch` needs the full setup body:
  spec, worktree, gates, supervisorModel, roles). Found and cleaned: route and controller
  tests had written run and wait records into the real home; fix PR in flight
  (`fix/tests-never-touch-real-home`).
- 2026-10-12 19:17Z fixture run reached gate A (wait `w-d90ffff1`, 5 ranked decisions, 2
  recorded without asking) after the drafter step (requirements v1, 1,352 words) and a lint-fix
  reviser step, both committed in the fixture's store; worktree `feat/greeting-endpoint`
  created. Two defects to fix after the run: `run.json` token totals stay 0 although every
  `spawn.end` row carries usage; step logs are written to `controller-steps/` inside the spec
  dir (design §3 puts them in the home; check they are at least gitignored). Waiting on
  Matthew to answer gate A on the Now page.
- 2026-10-12 PR #108 (test-home guard): `vitest.setup.ts` gives every worker temp homes;
  `stateHome()`/`controllerHome()` throw under vitest when they resolve to the real home.
  The launcher test had leaked 665 junk launch records into
  `~/.spec-workflow-mcp/harness/launches/`; archived to `launches-junk-2026-10-12.tar.gz`
  beside the directory and removed. Two real records remain.

## 8. Pointers

- Controller design: `docs/controller-design.md`
- Code map: `docs/foundation-review-codemap.md`; adversarial review: `docs/foundation-review-adversarial.md`
- ADRs: `docs/adr/0001` to `0006`; terms: `GLOSSARY.md`
- Trigger memo: `docs/overwatch-role-and-headless.md`
- Dashboard redesign: `docs/dashboard-redesign.md`
- Efficiency plan and decisions: `docs/harness-efficiency-plan.md`, memory `harness-efficiency-decisions`
- Roadmap: `.spec-workflow/spec-decomposition/decomposition.md` (specs 1-21, build order)
- Fixed assumptions (2026-10-07): Claude Code + Claude subscription only; mechanisms in
  deterministic code, the model only for judgement and prose; the harness is opinionated.
