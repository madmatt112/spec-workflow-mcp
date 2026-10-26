# Codebase context — advisor

## Design sources
- docs/adr/0006-advisor-never-in-the-path.md:1-29 — ADR 0006 and its 2026-10-26 amendment (coordination in conversation, staged merge and deploy, push per wait)
- docs/controller-design.md:148-166 — §7 waits: record shape, kinds, "second opinion" control, one push per wait
- docs/controller-design.md:294-336 — §16 the advisor: entries, state of the world, tools, sources, notebook, lifetime, model
- docs/controller-design.md:338-345 — §17 access: loopback bind, shared secret, `sdd advisor` reads it from the home
- docs/overwatch-role-and-headless.md:192-194 — where the retired overwatch state and `owctl` live (outside the repo)

## Controller home and records
- src/dashboard/harness/state-files.ts:26-29 — `sddHome`: `$SDD_HOME` else `<state home>/sdd`
- src/controller/state.ts:130-137 — `WaitKind` union (gate-a, gate-b, retro-plan, merge, escalation, error, question)
- src/controller/state.ts:162-178 — `WaitRecord`; `advice` is an optional string
- src/controller/state.ts:238-243 — `controllerHome`
- src/controller/state.ts:297-303 — `writeJsonAtomic`: temp file then rename
- src/controller/state.ts:535-546 — `withStoreLock`: one file lock per spec store, in the home

## Waits
- src/controller/waits.ts:61 — `waitEvents` emitter, in-process only
- src/controller/waits.ts:63-81 — `createWait`: writes the record, emits `change`
- src/controller/waits.ts:90-116 — `answerWait`: stores answers with `by`, renders questions.md for gates, appends a `note` row
- src/controller/waits.ts:118-126 — `attachAdvice`: sets `advice`, writes, emits; touches no run
- src/controller/controller.ts:339-362 — `onWaitChange`: an answered wait requeues its run; advice alone does nothing
- scripts/sdd-watchdog.sh:185-201 — the watchdog writes an `error` wait from a separate node process
- scripts/sdd-watchdog.sh:203-212 — the watchdog's only alert channel today: notify-send plus that wait

## Dashboard server routes
- src/dashboard/multi-server.ts:604-635 — Launch route: enqueue through the controller
- src/dashboard/multi-server.ts:641-643 — GET waits for the wire
- src/dashboard/multi-server.ts:645-661 — answer route; refuses unknown question ids
- src/dashboard/multi-server.ts:663-670 — advice route: body `{ advice }`, no caller in the repo
- src/controller/access.ts:40-67 — `loadOrCreateSecret`: one 0600 secret file in the home
- src/controller/access.ts:129-137 — `isAuthorized`: Bearer secret or session cookie
- src/controller/access.ts:156-180 — `makeRequireAccess`: secret on every mutating and `/api/controller/` request
- src/dashboard/harness/hub.ts:39-51 — the hub listens to wait, run and activity events for pushes to browsers
- src/dashboard/shell/types.ts:151 — server-side wire wait `advice?: string`

## Controller runs, steps and merge
- src/controller/controller.ts:98-112 — `start`: lock, recover, subscribe, tick
- src/controller/controller.ts:145-179 — `enqueue`: the launch admission the staged launch would call
- src/controller/step.ts:94-135 — `StepSpec`: role, brief, worktree, schema, mcpConfig, model override
- src/controller/step.ts:230-243 — `loadRole`: agent file under `harness/agents/` plus `agent-profiles.json`
- src/controller/step.ts:350 — `runStep`: one headless `claude` process per step
- src/controller/merge.ts:695-778 — `mergeByRule`: evaluate, ask-wait, `gh pr merge`, post-merge, `pr.merged`
- src/controller/merge.ts:729-753 — the `merge: ask` branch: a `merge` wait with options merge or hold
- scripts/sdd-self-update.sh:1-24 — the deploy: staged build, smoke boot, evals, swap, restart
- harness/agent-profiles.json:14-19 — drafter tier: claude-opus-5-5, effort high

## Tallies inputs
- src/dashboard/shell/usage-rows.ts:33-84 — W and W per task per closed spec from ledgers and HANDOFF
- src/dashboard/shell/now-model.ts:1-8 — Now page model over every project (waits, live runs)
- src/core/deferral-storage.ts:150-152 — deferral `owner` parsed as matthew or harness

## CLI entry
- src/index.ts:129-131 — `bootstrapCommand`: only `init` and `doctor` are subcommands
- src/index.ts:394-398 — subcommand routing before argument parsing
- src/bootstrap/cli.ts:176-204 — `runBootstrapCommand`: init or doctor dispatch

## Dashboard frontend
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:34-43 — `notifyWait`: browser notification per new wait
- src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:68-92 — seen-id set so a reload does not re-notify
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:529-539 — answer sheet renders `wait.advice` as text
- src/dashboard_frontend/src/modules/shell/types.ts:172 — browser-side wait `advice?: string`

## Design-phase additions: controller
- src/controller/state.ts:109-128 — `PrRead`: one merge-pass read of a PR, path-free
- src/controller/state.ts:194-201 — `RateLimitFile`: `fiveHour` and `sevenDay` windows
- src/controller/state.ts:254-256 — `runStepsDir`: a run's step stream logs
- src/controller/state.ts:427-429 — `readProjects`: the durable project list in the home
- src/controller/state.ts:479-482 — `isProcessAlive`: pid plus start time
- src/controller/waits.ts:128-132 — `listOpenWaits`: open waits, newest first
- src/controller/waits.ts:143-145 — `listWaitsForWire`: strips `specDir`
- src/controller/controller.ts:87-88 — window threshold from options or env
- src/controller/controller.ts:375-390 — `windowBlock`: private usage-window check
- src/controller/step.ts:71-77 — `StepClassification` union
- src/controller/step.ts:372-374 — `--mcp-config` always with `--strict-mcp-config`
- src/controller/merge.ts:136-150 — `MergeStageDeps`: rules, specDir, stepLogDir, ledger
- src/controller/merge.ts:160-163 — `readMergeRules`
- src/controller/merge.ts:542-551 — `MergeTarget`
- src/controller/ledger.ts:53-73 — `RunLedger` writer interface
- src/controller/ledger.ts:130-143 — `spawn.end` row: agent, tokens, usage split
- src/controller/ledger.ts:145-153 — `spawn.usage` row: agent, role, result, phase
- src/controller/ledger.ts:233-245 — `checkpoint`: stage given paths and commit, through a serialize lock
- src/controller/phases/document.ts:375 — document phase writes the CLI subtype as `spawn.usage` result

## Design-phase additions: access and server
- src/controller/access.ts:168-171 — loopback read exemption skipped under `/api/controller/`
- src/controller/access.ts:177 — the 401 body
- src/controller/access.ts:194-203 — login compares only the operator secret
- src/dashboard/multi-server.ts:230-231 — secret loaded and access hook installed
- src/dashboard/multi-server.ts:338-344 — controller start in the server
- src/dashboard/multi-server.ts:649-657 — answer route's unknown-question check
- src/server.ts:255-268 — low-level MCP `Server` ListTools and CallTool handlers
- src/core/dashboard-session.ts:153-177 — `peekDashboardSession`: running dashboard url, no writes
- src/dashboard/shell/shell-feed.ts:121-129 — shell feed topics incl. `controller-waits`
- src/dashboard/harness/hub.ts:45-51 — hub listeners that re-arm the shell feed
- src/dashboard/harness/overview-watch.ts:24-29 — chokidar `WATCH_OPTS`
- src/dashboard/harness/overview-watch.ts:247-248 — chokidar `add`/`change`/`unlink` handlers

## Design-phase additions: stores and scripts
- src/core/deferral-storage.ts:229-270 — `DeferralStorage.create`
- scripts/stub-claude.mjs:1-30 — canned `claude` stream for tests
- scripts/stub-gh.mjs:1-86 — canned `gh` for tests
- harness/agents/sdd-drafter.md:1-12 — agent file frontmatter shape (name, model, effort, tools)

## Tasks-phase additions: controller and waits
- src/controller/controller.ts:373-388 — `windowBlock` (corrects the 375-390 line above)
- src/controller/controller.ts:73 — `active`: private run-slot set
- src/controller/controller.ts:98 — `start()` returns false when another controller holds the lock
- src/controller/controller.ts:412-413 — `runDeps` wires `windowBlock` and `onRateLimit`
- src/controller/state.ts:94-99 — `RunRecord.prReads`: PR reads live on the run
- src/controller/state.ts:343 — `listRuns`
- src/controller/state.ts:372-397 — `listWaits`, `readWait`, `writeWait`
- src/controller/state.ts:298 — `writeJsonAtomic` (not exported at base)
- src/controller/waits.ts:119-126 — `attachAdvice` (advice string only at base)

## Tasks-phase additions: access and server
- src/controller/access.ts:191-209 — `installAccessControl`: hook plus login/logout routes
- src/dashboard/multi-server.ts:341 — `controller.start()` call; return value ignored at base
- src/dashboard/multi-server.ts:646-661 — answer route
- src/index.ts:391-398 — `init`/`doctor` routing before argument parsing

## Tasks-phase additions: tests a task changes
- src/__tests__/agent-profiles.test.ts:23-24 — asserts 10 profile keys
- src/watch/__tests__/ledger.test.ts:101-105 — asserts 10 profile keys
- src/dashboard/shell/__tests__/shell-feed.test.ts:275-284 — pins the five feed messages in order
- src/controller/__tests__/waits.test.ts:172-193 — `attachAdvice` tests
- src/dashboard/__tests__/controller-waits-routes.test.ts:147-157 — advice route test
- src/dashboard/__tests__/access-routes.test.ts:78-89 — loopback GET under `/api/controller/` needs auth

## Tasks-phase additions: harness and build
- harness/agents/sdd-drafter.md:1-12 — model on line 4, effort on line 5 (the profile test reads those lines)
- scripts/copy-static.cjs:64-71 — copies `agent-profiles.json` to `dist/`; no plugins/ dir or plugin-assets script at base
- vitest.config.ts:8-9 — vitest includes `src/**` tests and excludes `src/dashboard_frontend/**`
- package.json:31 — `build:dashboard`: vite build of the frontend

## Tasks-phase additions: frontend
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:288 — `DetailText`
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:351 — `AnswerSheet`
- src/dashboard_frontend/src/modules/shell/NowPage.tsx:367 — answer POST fetch
