# Tasks Document

Document version: v1

Dependency order: run the tasks in number order. The chains are 1 → 2 → 3 → 4, 5 → 6 → 7, 8 → 9, 10 → 11, 12 → 13, 15 → 16 → 17 → 18 and 19 → 20; tasks 14, 21 and 22 stand alone; task 23 runs last. Each task leaves `npx tsc --noEmit` and every vitest suite green, and each task that changes a tile updates the `e2e/worktree-board.spec.ts` cases it moves. Line citations are to base `7a24a3b7`; where an earlier task here edited the file, the named symbol is the anchor and the implementer re-resolves the line.

- [x] 1. Keep a durable display name in the project list
  - File: src/controller/state.ts
  - File: src/controller/__tests__/state.test.ts
  - Test: src/controller/__tests__/state.test.ts — `setProjectDisplayName(id, displayName)`
  - Test: src/controller/__tests__/state.test.ts — `rememberProject(project, now)`
  - Note: `state.test.ts` keeps every asserted value; a row with no display name is unchanged.
  - Purpose: One operator-set name that re-registration cannot touch.
  - _Leverage: src/controller/state.ts:256-266, src/controller/state.ts:610-616, src/controller/state.ts:619-628_
  - _Requirements: 1.3_
  - _Prompt: Task: Per design C1 and design D1 (requirement 1 AC 3), add `displayName?: string` to `KnownProject` (`src/controller/state.ts:256-266`). Export `shownName` and `setProjectDisplayName` as design C1 pins them, the second under `withProjectsLock` (`:610-616`). `rememberProject` (`:619-628`) keeps an existing row's `displayName` | Restrictions: Do not change `src/core/project-registry.ts` (design C1); keep the sort by `name`; never write a `displayName` key on a row that has none | Success: `shownName` returns `displayName` when set and `name` when not; `setProjectDisplayName` stores a name and returns true; `null` removes the key and returns true; an unknown id returns false and writes nothing; `rememberProject` on a named row keeps `displayName` and refreshes `name` and `seen`; `rememberProject` on an unnamed row adds no key; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/state.test.ts` pass_

- [x] 2. Apply the display name to contexts and the push text
  - File: src/dashboard/project-manager.ts
  - File: src/advisor/push.ts
  - File: src/dashboard/__tests__/project-manager-durable.test.ts
  - File: src/advisor/__tests__/push.test.ts
  - Test: src/dashboard/__tests__/project-manager-durable.test.ts — `ProjectManager.setDisplayName(projectId, displayName)`
  - Test: src/advisor/__tests__/push.test.ts — `createWait(input)` with a `WaitPusher` running
  - Note: both test files keep every asserted value. Requirement 1 AC 4 and AC 5 hold at base: regression guards.
  - Purpose: Every page that reads the context gets the name with no page edit.
  - _Leverage: src/dashboard/project-manager.ts:112-167, src/dashboard/project-manager.ts:233-236, src/advisor/push.ts:88-96_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - _Prompt: Task: Per design C1 (requirement 1 AC 1 to AC 5), add `ProjectManager.setDisplayName`: the setter task 1 exports, then `syncWithRegistry()`. `syncOnce` maps id to display name from `remembered` (`src/dashboard/project-manager.ts:115`) and applies it where it sets `existing.projectName` (`:145`) and where a new context takes `entry.projectName` (`:152`, `:216`). `addProject` still remembers the generated name as `name` (`:233-236`), so a display name must not reach that write. `src/advisor/push.ts:92` returns the name helper task 1 exports | Restrictions: Do not edit `src/core/project-registry.ts`, `src/advisor/summary.ts` or `src/advisor/mcp-endpoint.ts` (design C1, Scope notes); the remembered `name` stays generated | Success: after `setDisplayName`, `getProjectsList()` shows the name; a re-registration followed by a sync keeps it (AC 2); a remembered row with no registry entry shows it, including on a fresh `ProjectManager` (AC 3); `projects.json` `name` stays the generated value after a sync; clearing restores the generated name (AC 4, regression guard); the project id does not change (AC 5, regression guard); a pushed wait for a named project equals `buildMessage(wait, displayName, false)`; a project with no display name pushes its `name` (regression guard); `npx tsc --noEmit` and `npx vitest run src/dashboard/__tests__/project-manager-durable.test.ts src/advisor/__tests__/push.test.ts` pass_

- [x] 3. Add the display-name route
  - File: src/dashboard/multi-server.ts
  - File: src/dashboard/__tests__/harness-routes.test.ts
  - Test: src/dashboard/__tests__/harness-routes.test.ts — `POST /api/projects/:projectId/display-name`
  - Note: `harness-routes.test.ts` keeps every asserted value.
  - Purpose: The operator sets a name with no code change.
  - _Leverage: src/dashboard/multi-server.ts:507-509, src/dashboard/multi-server.ts:620-632_
  - _Requirements: 1.7_
  - _Prompt: Task: Per design C1, Data Models and design D2 (requirement 1 AC 7), add `POST /api/projects/:projectId/display-name` beside `GET /api/projects/list`, calling the method task 2 adds. Trim a string body; an empty result clears the name | Restrictions: Follow the status and error table in design Data Models exactly; add no other route | Success: a string answers 200 `{ success: true }` and `/api/projects/list` shows it; `null` and a blank string each answer 200 and clear it; a number answers 400 `display-name-invalid`; 61 characters after trim answer 400 and 60 answer 200; a control character answers 400; an unknown id answers 404 `project-not-found`; a live project with no `projects.json` row answers 404 `project-not-remembered`; `npx tsc --noEmit` and `npx vitest run src/dashboard/__tests__/harness-routes.test.ts` pass_

- [x] 4. Rename in the gear and name the project on action tiles
  - File: src/dashboard_frontend/src/modules/shell/Gear.tsx
  - File: src/dashboard_frontend/src/modules/shell/tiles.tsx
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: e2e/worktree-board.spec.ts
  - Test: e2e/worktree-board.spec.ts — `page.getByTestId('project-name-save-' + projectId).click()`
  - Note: existing e2e values stay. `(R5 AC1)` at `e2e/worktree-board.spec.ts:871` seeds an unregistered project, so its raw id still shows: regression guard. The new POST relies on the Origin rewrite in `src/dashboard_frontend/vite.config.ts:28-31`, which needs no edit.
  - Purpose: Where the operator sets a name, and the last page that printed an id.
  - _Leverage: src/dashboard_frontend/src/modules/shell/Gear.tsx:75-93, src/dashboard_frontend/src/modules/shell/harness.tsx:11-24, src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:106, src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280, src/dashboard_frontend/src/modules/shell/HomePage.tsx:121-128_
  - _Requirements: 1.1, 1.6, 1.7_
  - _Prompt: Task: Per design C1 (requirement 1 AC 1, AC 6, AC 7), give each gear project row `project-rename-<id>`, input `project-name-input-<id>` and `project-name-save-<id>`. Save posts through `callHarness` (`src/dashboard_frontend/src/modules/shell/harness.tsx:11`), then calls `refreshProjects` (`src/dashboard_frontend/src/modules/projects/ProjectProvider.tsx:106`) and closes. On failure it shows the route's error and keeps the input open (design Error Handling 6). `ActionTile` takes `projectName: (id: string) => string`; `actionTarget` (`src/dashboard_frontend/src/modules/shell/tiles.tsx:276-280`) prints it for `t.project`; `HomePage` passes its existing lookup (`:59-62`). Run `npx playwright install chromium` first | Restrictions: Keep the rename controls outside the row's `label` (`src/dashboard_frontend/src/modules/shell/Gear.tsx:78-90`), so the switch name does not change; add no other gear control | Success: saving a name shows it in the gear row and on a wait tile of that project with no reload; a 61-character save shows `display-name-invalid` with the input still open; saving an empty value restores the generated name; a staged action on a registered named project shows the name and not the id; an action on an unknown project shows the id (regression guard); `npx vitest run src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_

- [x] 5. Build the launch guard module
  - File: src/dashboard/harness/launch-guard.ts
  - File: src/dashboard/harness/run-setup.ts
  - File: src/dashboard/harness/types.ts
  - File: src/dashboard_frontend/src/modules/harness/types.ts
  - File: src/dashboard/harness/__tests__/launch-guard.test.ts
  - Test: src/dashboard/harness/__tests__/launch-guard.test.ts — `specFileList(workflowRoot, spec)`
  - Test: src/dashboard/harness/__tests__/launch-guard.test.ts — `evaluateLaunchGuard(spec, project, storeProjects)`
  - Note: new module, no caller yet. `run-setup.test.ts` keeps every asserted value.
  - Purpose: Compare a spec's files with each store project's code root.
  - _Leverage: src/dashboard/harness/run-setup.ts:23, src/dashboard/harness/run-setup.ts:230-239, src/core/task-parser.ts:332-345, src/dashboard/harness/types.ts:31-41, src/dashboard_frontend/src/modules/harness/types.ts:58_
  - _Requirements: 2.3, 2.6, 2.7, 2.8, NFR Performance, NFR Security_
  - _Prompt: Task: Per design C2, Data Models, design D4, D5 and D6 (requirement 2 AC 3, AC 6, AC 7, AC 8), create `launch-guard.ts` with `specFileList`, `evaluateLaunchGuard`, `GuardProject` and `LaunchGuard`. Add exported `decompositionEntry` to `src/dashboard/harness/run-setup.ts` using `DECOMPOSITION_HEADING` (`:23`). Add optional `guard` to `SetupView` in both type files | Restrictions: `existsSync` only: no git call, no model call (NFR Performance); `buildSetupView` does not change | Success: with `tasks.md`, the list is the union of `task.files`, source `tasks`; a `tasks.md` with no `File:` entries gives `no-list` and reads no decomposition; with no `tasks.md`, backticked tokens holding a `/` are read with a trailing `:n` or `:n-n` suffix removed, source `decomposition`; a bare `tiles.tsx` is dropped; no entry gives source `none`, `no-list`; each filter drops its path: absolute, a `..` segment, leading `~`, whitespace, `*`, `<`, leading `.spec-workflow/`; all filtered gives `no-list`; a path no store project holds leaves `compared`; another project holding strictly more gives `warn` with `useProject`; equal counts give `clear`; a tie among holders breaks on `projectName`; a path under two roots counts for both; `compared` 0 gives `clear` with no `useProject`; `listed`, `compared` and `held` are exact; `npx tsc --noEmit` and `npx vitest run src/dashboard/harness/__tests__/launch-guard.test.ts src/dashboard/harness/__tests__/run-setup.test.ts` pass_

- [x] 6. Set the guard on the setup route
  - File: src/dashboard/multi-server.ts
  - File: src/dashboard/__tests__/harness-routes.test.ts
  - Test: src/dashboard/__tests__/harness-routes.test.ts — `GET /api/projects/:projectId/harness/setup`
  - Note: `harness-routes.test.ts` keeps every asserted value. Requirement 2 AC 10 holds at base: regression guard.
  - Purpose: The tile learns the verdict; `launchSpec` and `enqueue` never see it.
  - _Leverage: src/dashboard/multi-server.ts:620-632, src/dashboard/multi-server.ts:105-132_
  - _Requirements: 2.3, 2.7, 2.9, 2.10_
  - _Prompt: Task: Per design C2 "Route" (requirement 2 AC 3, AC 7, AC 9), set `view.guard` after `launchBlock`, only while `view.launchable` is set, from what task 5 exports. `storeProjects` is `getAllProjects()` filtered on `projectPath === project.projectPath`. A `try/catch` leaves `guard` unset | Restrictions: Change neither `buildSetupView`, `launchSpec` nor the launch route (AC 10); no path enters `SetupView` | Success: the design's no-`tasks.md` check passes: in a two-project fixture store with no spec directory and a decomposition entry naming one path that exists only under the app root, infra answers `state: 'warn'`, `source: 'decomposition'`, `compared: 1`, `held: 0`, `useProject` the app id, and app answers `state: 'clear'`, `held: 1`; with a `tasks.md` listing a file only under the app root, infra warns with `source: 'tasks'`; a `tasks.md` that cannot be read (a directory at that path) answers 200 with `guard` unset (AC 9); a blocked launch has no `guard`; the launch POST body and result are unchanged (regression guard); `npx tsc --noEmit` and `npx vitest run src/dashboard/__tests__/harness-routes.test.ts` pass_

- [ ] 7. Show one guarded Next tile per project
  - File: src/dashboard_frontend/src/modules/shell/board.ts
  - File: src/dashboard_frontend/src/modules/shell/tiles.tsx
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: src/dashboard/shell/__tests__/board-view.test.ts
  - File: e2e/worktree-board.spec.ts
  - Test: src/dashboard/shell/__tests__/board-view.test.ts — `nextProjects(projects, enabled)`
  - Test: src/dashboard/shell/__tests__/board-view.test.ts — `launchPress(view, armedSpec)`
  - Test: e2e/worktree-board.spec.ts — `page.getByTestId('next-launch-' + projectId).click()`
  - Note: asserted values change at, at least, `src/dashboard/shell/__tests__/board-view.test.ts:634-690` and e2e `(R8 AC2)` `e2e/worktree-board.spec.ts:2372`, `:2397`; widen to every assertion the change touches. Requirement 2 AC 5: regression guard.
  - Purpose: The tile names its repository and stops a wrong launch.
  - _Leverage: src/dashboard_frontend/src/modules/shell/board.ts:61-76, src/dashboard_frontend/src/modules/shell/tiles.tsx:245-273, src/dashboard_frontend/src/modules/shell/HomePage.tsx:180-197, src/dashboard_frontend/src/modules/shell/harness.tsx:40-52, e2e/worktree-board.spec.ts:304-316_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.9_
  - _Prompt: Task: Per design C2 "Next tiles" and "`NextTile`" and requirements D2 (requirement 2 AC 1 to AC 5), `nextProjects` becomes `projects.filter((p) => enabled(p.projectId))`; drop the unused `storeGroups` import. `NextTile` gains `codeRoot` and `useProject?`, which `HomePage` resolves from `projects`, and renders `next-code-root-<id>`. It reads the guard field task 5 adds. On `warn`: tone `warning` and `next-guard-<id>` with design's text. On `no-list`: `next-guard-<id>` reads `No file list to compare`. Add pure `launchPress(view, armedSpec)` to `board.ts`, returning `'arm'` or `'launch'`, and drive local `armedSpec` with it. The armed button is `danger`, reading `Launch anyway`. For e2e, extend `registerSharedStoreProjects` (`e2e/worktree-board.spec.ts:304-316`) with a decomposition entry naming a file under one root; tap POSTs with `page.on('request', ...)`. Run `npx playwright install chromium` first | Restrictions: `onLaunch` stays the only launch path, so the body stays `buildLaunchInput(view)` (AC 4); no route change | Success: two enabled projects on one store give two projects and a disabled one is left out; `launchPress` gives `'launch'` with no guard, on `clear` and on `no-list`, `'arm'` on `warn` unarmed or armed for another spec, and `'launch'` on `warn` armed for this spec; each tile shows its code root; the project lacking the file shows `0 of 1 spec files are under` its root and the other project's name and root, tone `warning`; the holder shows no warning; after the first warned press, wait for `Launch anyway`, then launch POSTs are 0; the second press makes one POST with the `buildLaunchInput` body; an unwarned tile launches on one press (regression guard); a spec with no list shows `No file list to compare` and launches on one press; a view with no `guard` shows no warning (AC 9); `npx vitest run src/dashboard/shell/__tests__/board-view.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_

- [ ] 8. Read decisions and target documents from the plan
  - File: src/tools/harness.ts
  - File: src/tools/__tests__/harness.test.ts
  - Test: src/tools/__tests__/harness.test.ts — `parsePlanDecisions(content)`
  - Test: src/tools/__tests__/harness.test.ts — `answerChoosesNoChange(answer)`
  - Test: src/tools/__tests__/harness.test.ts — `classifyTarget(block)`
  - Note: `harness.test.ts` and `src/controller/phases/__tests__/closeout.test.ts:139-155` keep every asserted value.
  - Purpose: The parsers the close-out flow needs.
  - _Leverage: src/tools/harness.ts:485-517, src/tools/harness.ts:541-561, src/controller/runs.ts:340-363_
  - _Requirements: 3.1, 3.5, 3.7_
  - _Prompt: Task: Per design C3 and design D7 (requirement 3 AC 1, AC 5, AC 7), add and export `parsePlanDecisions`, `itemTarget` and `answerChoosesNoChange` to `src/tools/harness.ts`, and make `classifyTarget` (`:541-542`) read `itemTarget`. Verify design's illustrative regex against the table below, not the reverse | Restrictions: Change no class rule in `classifyTarget`; the match stays narrow on purpose (design C3) | Success: `parsePlanDecisions` maps ids to answers inside `## Decisions` only, splits at the last ` → `, and gives no entry for an empty answer or `no answer`; `itemTarget` reads `Target:` and `Target document:`; a block with `Target document:` naming `agent-rules.md` classifies `store`; `answerChoosesNoChange` is true for `No change — the rule already requires`, `leave it; agents correctly flag`, `Option A: no change`, `no`, `none`, `skip` and `n/a`; it is false for `keep the design-defect stop but trigger it on the first verdict`, `drop the two moved paths` and `add the 30/60s per-user limiter`; `npx tsc --noEmit` and `npx vitest run src/tools/__tests__/harness.test.ts src/controller/phases/__tests__/closeout.test.ts` pass_

- [ ] 9. Act on recorded answers in the close-out
  - File: src/controller/phases/closeout.ts
  - File: src/controller/phases/__tests__/closeout.test.ts
  - Test: src/controller/phases/__tests__/closeout.test.ts — `runCloseoutPhase(ctx)`
  - Note: `closeout.test.ts` keeps every asserted value: its plans record no answer. Requirement 3 AC 8 holds at base: regression guard.
  - Purpose: An approved answer is built or reported, never skipped as unchosen.
  - _Leverage: src/controller/phases/closeout.ts:262-266, src/controller/phases/closeout.ts:362-375, src/controller/phases/closeout.ts:404, src/controller/phases/closeout.ts:490, src/controller/phases/closeout.ts:526, src/controller/phases/closeout.ts:633_
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - _Prompt: Task: Per design C3 "Flow in `runCloseoutPhase`", design D7 and requirements D4 (requirement 3), `openItems` (`src/controller/phases/closeout.ts:262-266`) adds `answer` from the parser task 8 exports. Add the no-change step before Step 1. Change Step 1 (`:362-375`, with `:368` reading the target helper task 8 exports), `itemsText` (`:404`), the verifier text (`:490`), `findingsText` (`:526`) and the final line (`:633`) as design states. `itemPaths` keeps the raw block | Restrictions: The reverts (`:585-625`) do not change (AC 6); an unanswered item keeps its base line and retro entry | Success: a plan shaped like option-lifecycle-events never writes `skipped — no change chosen` for P6, P11, G1 or G2; P6's batch brief carries `Recorded decision:` and the answer (AC 3), as do the verifier and fix briefs; P11 (class `none`, answered) gets `to-do (human) — recorded decision:` with the answer and the reason, and joins the to-dos (AC 4); an answer of any class that chooses no change gets `skipped — ` and the answer, with no step spawned (AC 5); an answered item that does not land gets `to-do (human) — ` and its reason, its commit reverted (AC 6); G1 and G2 go to the store batch (AC 7); an unanswered no-change item stays `skipped — no change chosen` (AC 8, regression guard); `no answer` counts as not recorded (AC 1); `npx tsc --noEmit` and `npx vitest run src/controller/phases/__tests__/closeout.test.ts` pass_

- [ ] 10. Add the task-file patcher and its ledger row
  - File: src/core/task-parser.ts
  - File: src/controller/ledger.ts
  - File: src/watch/ledger.ts
  - File: src/core/__tests__/task-parser-tests.test.ts
  - File: src/controller/__tests__/ledger.test.ts
  - Test: src/core/__tests__/task-parser-tests.test.ts — `addTaskFiles(content, taskId, files)`
  - Test: src/controller/__tests__/ledger.test.ts — `openRunLedger(options).filePatch(fields)`
  - Note: both test files keep every asserted value; add the row to the round-trip list at `src/controller/__tests__/ledger.test.ts:118`.
  - Purpose: A patch changes one list and leaves a parseable trace.
  - _Leverage: src/core/task-parser.ts:332-345, src/core/task-parser.ts:424-444, src/controller/ledger.ts:53-73, src/watch/ledger.ts:419-428_
  - _Requirements: 4.2, 4.3_
  - _Prompt: Task: Per design C4, Data Models and design D14 (requirement 4 AC 2, AC 3), add `addTaskFiles` to `src/core/task-parser.ts`, using the bounds of `taskBlock` (`:424-444`). Add `filePatch` to `RunLedger` (`src/controller/ledger.ts:53-73`), writing row type `file-list.patch`, and a render arm in `src/watch/ledger.ts:419-428` | Restrictions: Match `File:` lines by their bullet, so a `_Prompt:` holding the word never matches; change no other line | Success: a new `File:` line follows the task's last `File:` or `Files:` line at its indent; with no `File:` line it follows the checkbox line; the parser then lists the file; every other line is byte-identical; two files give two lines; an unknown task returns `undefined`; a path with a comma, a parenthesis or whitespace returns `undefined`; the row holds `task`, `round`, `file` and `reason` as strings; the watch ticker renders the row with non-empty text; `npx tsc --noEmit` and `npx vitest run src/core/__tests__/task-parser-tests.test.ts src/controller/__tests__/ledger.test.ts src/watch/__tests__/ledger.test.ts` pass_

- [ ] 11. Patch the file list on a REQUIRED report
  - File: src/controller/phases/implementation.ts
  - File: src/tools/brief-templates.ts
  - File: harness/agents/sdd-implementer.md
  - File: src/controller/phases/__tests__/implementation.test.ts
  - File: src/tools/__tests__/harness.test.ts
  - Test: src/controller/phases/__tests__/implementation.test.ts — `runImplementationPhase(ctxFor(fx))`
  - Test: src/tools/__tests__/harness.test.ts — `harnessHandler({ action: 'brief', template: 'fix' })`
  - Note: both test files keep every asserted value; `src/controller/phases/__tests__/implementation.test.ts:484` is the AC 7 regression guard. AC 4 and AC 8 hold at base: regression guards.
  - Purpose: A genuine off-list file no longer waits on the operator.
  - _Leverage: src/controller/phases/implementation.ts:826-842, src/controller/phases/implementation.ts:880-893, src/controller/phases/implementation.ts:912, src/controller/phases/implementation.ts:921-947, src/tools/brief-templates.ts:797-807, harness/agents/sdd-implementer.md:31_
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, NFR Reliability_
  - _Prompt: Task: Per design C4 "Flow", "Failure" and "Text" and requirements D3 (requirement 4), add `fileListPatch` and the optional trailing `gateReasons` parameter of `routeImplementerFlags`. `src/controller/phases/implementation.ts:912` passes `gate.reasons` only when `variant === 'gate'`; `:754` passes nothing. At the `REQUIRED` branch (`:929-936`), after the `DESIGN-DEFECT` check, patch with what task 10 exports, write the row, append to `task.files` and return `undefined`, so `:805-807` gates the same commit. Rewrite `src/tools/brief-templates.ts:803-804` and `harness/agents/sdd-implementer.md:31` to say a `REQUIRED` report adds the file and the gate reruns with no wait | Restrictions: Keep the `REQUIRED:` prefix and the self-exemption ban; do not change `src/core/gate-rules.ts` or `harness/evals/`; add no eval role (AC 10) | Success: with a stub fix round, a sole `file-outside-list` gate and a `REQUIRED:` flag naming that file, `tasks.md` gains one `File:` line, the spec store commits, one `file-list.patch` row holds task, round, file and reason, the task re-gates and completes, and no wait opens; two listed files patch together; a mixed gate stops `design-defect`; a flag file outside the reasons stops; a verifier round stops; a first-pass `REQUIRED:` stops; a path the patcher refuses (`src/a(b).ts`) leaves `tasks.md` unchanged, writes a `note` and stops; a high-risk re-gate reaches the verifier (AC 5); a patch at the cap goes to the adjudicator (AC 6); a round with no flag keeps P8 (AC 7, regression guard); the rendered round-1 fix brief states the gate reruns and no longer says `escalates immediately`; `npx tsc --noEmit` and `npx vitest run src/controller/phases/__tests__/implementation.test.ts src/tools/__tests__/harness.test.ts` pass_

- [ ] 12. Label review findings and add the drafting-only reviser
  - File: src/tools/adversarial-review.ts
  - File: src/tools/brief-templates.ts
  - File: src/tools/__tests__/adversarial-review.test.ts
  - File: src/tools/__tests__/harness.test.ts
  - Test: src/tools/__tests__/adversarial-review.test.ts — `adversarialReviewHandler({ specName, phase, verdictBlock: true }, context)`
  - Test: src/tools/__tests__/harness.test.ts — `harnessHandler({ action: 'brief', template: 'reviser' })`
  - Note: both test files keep every asserted value. Find the variant count with `grep -n "four variants\|should-fix-only" src/tools/brief-templates.ts src/tools/__tests__/harness.test.ts`; update each count word.
  - Purpose: The reviewer states what the cap reads.
  - _Leverage: src/tools/adversarial-review.ts:318-325, src/tools/brief-templates.ts:457-462, src/tools/__tests__/harness.test.ts:943_
  - _Requirements: 5.1_
  - _Prompt: Task: Per design C5 and design D8 (requirement 5 AC 1), add one bullet to `HARNESS_VERDICT_SECTION` (`src/tools/adversarial-review.ts:318-325`): the AC 1 definition, and a `[drafting] ` or `[design] ` prefix required on every MUST_FIX and SHOULD_FIX, in the analysis and the report arrays. `renderReviser` gains the descriptor `Drafting-only corrective pass.` for variant `drafting-only` (`src/tools/brief-templates.ts:457-462`) | Restrictions: `REVIEWER_SCHEMA` stays plain strings; keep the verdict block field names and order | Success: a `verdictBlock` prompt holds both prefixes and names a wrong citation, a stale count, wording and a lint failure as drafting defects; a prompt with no `verdictBlock` holds neither; a reviser brief with variant `drafting-only` carries `Drafting-only corrective pass.`; the other reviser variants render as before (regression guard); `npx tsc --noEmit` and `npx vitest run src/tools/__tests__/adversarial-review.test.ts src/tools/__tests__/harness.test.ts` pass_

- [ ] 13. End doc review after a drafting-only round 1
  - File: src/controller/phases/document.ts
  - File: src/controller/phases/__tests__/document.test.ts
  - Test: src/controller/phases/__tests__/document.test.ts — `runDocumentPhase(ctx)`
  - Note: `document.test.ts` keeps every asserted value: existing stubs carry no prefix, so they read as design. Requirement 5 AC 3 and AC 5 hold at base: regression guards.
  - Purpose: A run stops paying for a second review of wording.
  - _Leverage: src/controller/phases/document.ts:452-468, src/controller/phases/document.ts:522-523, src/controller/phases/document.ts:861-864, src/controller/phases/document.ts:883-903_
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - _Prompt: Task: Per design C5 "Flow" and "Order", design D8 and D9, and requirements D1 and D8 (requirement 5), export `isDraftingDefect` from `src/controller/phases/document.ts`, widen `reviserStep`'s variant (`:452-454`) to the one task 12 renders, and add the cap after `openMustFix` (`:883`) and before the converged check (`:885-888`), with the note text design states | Restrictions: Test `ledgerRoundCount() === 1`, not `reviewRounds` (`:345`), which resets on re-entry; leave round 2 and later as they are (AC 6) | Success: for each of requirements, design and tasks, an all-`[drafting]` round 1 on v1 holding MUST_FIX and SHOULD_FIX items runs one reviser, the lint step and one narrow check over all items, then approves v2 with no second reviewer (AC 2); the note `review cap: round 1 drafting-only, 2 item(s), v2 approved` is in the ledger (AC 7); one `[design]` item runs the base loop (AC 3, regression guard); an unlabelled item runs the base loop (AC 4); an `escalate` round escalates (AC 5, regression guard); a round 1 with no items approves with no reviser (regression guard); a re-entered phase whose ledger holds a prior round does not cap; `npx tsc --noEmit` and `npx vitest run src/controller/phases/__tests__/document.test.ts` pass_

- [ ] 14. Put G1 and G2 in the agent rules
  - File: .spec-workflow/agent-rules.md
  - Note: implementer-only, no test seam: requirement 6 AC 2 holds at base, and the rule text has no behaviour that can go red. All listed paths sit under `.spec-workflow/`, so the phase runs no gate (`isVerificationOnly`). `run-setup.test.ts` keeps every asserted value.
  - Purpose: The operator's graduated rules are in force.
  - _Leverage: .spec-workflow/agent-rules.md:24-39, .spec-workflow/agent-rules.md:51-55, src/dashboard/harness/run-setup.ts:72-141_
  - _Requirements: 6.1, 6.2_
  - _Prompt: Task: Per design C6 and requirements D13 (requirement 6 AC 1), add two bullets after line 39, the end of `## Checks` in `.spec-workflow/agent-rules.md`, before `## Git`. Their words are lines 143-148 and lines 155-159 of /home/mcf/repo/tradr-hosted/.spec-workflow/specs/option-lifecycle-events/retrospective-plan.md, with the `> ` markers removed. Write through scratch and `cp` (`.spec-workflow/agent-rules.md:51-55`) | Restrictions: Change no other line; no bullet starts with a key `readAgentRules` reads; edit nothing in the tradr-hosted store | Success: `grep -c 'no implementer commit can clear it' .spec-workflow/agent-rules.md` and `grep -c 'cannot be made to fail first' .spec-workflow/agent-rules.md` each print 1; the bullets match the source lines word for word; `/usr/bin/git diff --stat` shows one file with additions only; `npx vitest run src/dashboard/harness/__tests__/run-setup.test.ts` passes (AC 2, regression guard)_

- [ ] 15. Make abandoned final on disk
  - File: src/controller/state.ts
  - File: src/controller/runs.ts
  - File: src/controller/controller.ts
  - File: src/controller/__tests__/state.test.ts
  - File: src/controller/__tests__/runs.test.ts
  - Test: src/controller/__tests__/state.test.ts — `writeRun(record, opts)`
  - Test: src/controller/__tests__/runs.test.ts — `runOnce(deps(fx, { ensureWorktree }), runId)`
  - Note: both test files keep every asserted value. The terminal-status cases at `src/controller/__tests__/state.test.ts:186` and `src/controller/__tests__/pause-request.test.ts:71`, `:191`, `:203` write over `running` in a fresh home, so they hold.
  - Purpose: No late write can replace `abandoned`.
  - _Leverage: src/controller/state.ts:431-473, src/controller/state.ts:475-503, src/controller/runs.ts:429-435, src/controller/runs.ts:566-571, src/controller/controller.ts:806-813_
  - _Requirements: 7.3, 7.4_
  - _Prompt: Task: Per design C7 "Status guard" and design D10 (requirement 7 AC 3, AC 4), `writeRunLocked` (`src/controller/state.ts:431-463`) reads disk first for terminal writes too, and writes nothing and returns `false` when disk is `abandoned` and `record.status` is not. `writeRun` resolves that boolean; `updateRun` passes through it. `save` and `patchRun` (`src/controller/runs.ts:566-571`, `:429-435`) emit `change` only when written, and a dropped `save` returns the disk record. `Controller.save` (`src/controller/controller.ts:806-813`) does the same, because design Error Handling 3 allows no `change` for a dropped write | Restrictions: Terminal writes keep clearing `pauseRequested`, `holdBy` and `lastActivity`; `writeLastActivityLocked` does not change | Success: a `running`, `waiting`, `queued`, `done` or `error` write over `abandoned` resolves `false` and leaves the record byte-identical; an `abandoned` write over `abandoned` resolves `true`; a first write and any write over a non-abandoned run resolve `true`; an `updateRun` that sets `running` on an abandoned run returns the abandoned record; a run abandoned on disk during `ensureWorktree` stays `abandoned`, with no `change` event carrying `running` (AC 3); `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/state.test.ts src/controller/__tests__/runs.test.ts src/controller/__tests__/pause-request.test.ts src/controller/__tests__/paused-at.test.ts` pass_

- [ ] 16. Write abandoned before the signal and refuse the step
  - File: src/controller/step.ts
  - File: src/controller/runs.ts
  - File: src/advisor/tallies.ts
  - File: src/controller/__tests__/step.test.ts
  - File: src/controller/__tests__/runs.test.ts
  - File: src/advisor/__tests__/tallies.test.ts
  - Test: src/controller/__tests__/step.test.ts — `runStep(spec)`
  - Test: src/controller/__tests__/runs.test.ts — `cancelRun(deps, runId)`
  - Test: src/controller/__tests__/runs.test.ts — `stepLifecycle(deps, runId).onStepSpawn(step)`
  - Test: src/advisor/__tests__/tallies.test.ts — `buildTallies(q)` over a `spawn.usage` row with result `cancelled`
  - Note: all three test files keep every asserted value. Requirement 7 AC 6 holds at base: regression guard.
  - Purpose: One step guard covers all five `runStep` sites.
  - _Leverage: src/controller/step.ts:72-78, src/controller/step.ts:353, src/controller/step.ts:518-526, src/controller/runs.ts:418-423, src/controller/runs.ts:456-464, src/controller/runs.ts:1380-1400, src/advisor/tallies.ts:29_
  - _Requirements: 7.1, 7.4, 7.6_
  - _Prompt: Task: Per design C7 "Order change", "Step guard", "Spawn race", Data Models and design D10 (requirement 7 AC 1, AC 4, AC 6), `cancelRun` (`src/controller/runs.ts:1380-1400`) writes `abandoned` first, then signals the pid it read. `StepClassification` gains `'cancelled'`; `runStep` first resolves the skipped `StepResult` with no spawn for a `spec.runId` whose disk status is `abandoned`. Add `runCancelled(deps, runId)` to `runs.ts` as design states; `stepLifecycle.onStepSpawn` (`:456-464`) calls it, signals the new pid and records nothing when true. Add `'cancelled'` to `STEP_CLASSIFICATIONS` (`src/advisor/tallies.ts:29`), or a skip tallies as `unknown` | Restrictions: A `runStep` with no `runId` (evals, advisor) spawns as at base; the worktree, branch and PR stay (AC 6) | Success: for an abandoned run `runStep` starts no process and resolves `classification: 'cancelled'`, `isError: true`, `subtype: 'cancelled'`, `numTurns: 0`; a running run and a spec with no `runId` spawn (regression guard); at `cancelRun`'s first `process.kill`, the disk record reads `abandoned` with no `inFlight`; a live step is still stopped; a cancel keeps worktree and branch (regression guard); `onStepSpawn` on a cancelled run signals the pid and writes no `inFlight`, for `isCancelled` true and for disk `abandoned` with `isCancelled` false (AC 4); a `cancelled` row tallies under `cancelled`; `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/step.test.ts src/controller/__tests__/runs.test.ts src/advisor/__tests__/tallies.test.ts` pass_

- [ ] 17. Refuse a wait on an abandoned run
  - File: src/controller/waits.ts
  - File: src/controller/controller.ts
  - File: src/controller/__tests__/waits.test.ts
  - File: src/controller/__tests__/controller.test.ts
  - Test: src/controller/__tests__/waits.test.ts — `createWait(input)`
  - Test: src/controller/__tests__/controller.test.ts — `controller.enqueue(input)` with a `mcpConfigFor` that throws `RunAbandonedError`
  - Note: both test files keep every asserted value: `createWait` on an id with no record still succeeds. Requirement 7 AC 7 holds at base: regression guard.
  - Purpose: One wait guard covers `waitAnd`, both gates and the merge wait.
  - _Leverage: src/controller/waits.ts:87-104, src/controller/controller.ts:592-604, src/controller/controller.ts:611-638, src/controller/merge.ts:732, src/controller/phases/gates.ts:169, src/controller/phases/gates.ts:256_
  - _Requirements: 7.2, 7.4, 7.5, 7.7_
  - _Prompt: Task: Per design C7 "Wait guard", Data Models and design D11 (requirement 7 AC 2, AC 5), add and export `RunAbandonedError` in `src/controller/waits.ts`. `createWait` (`:87-104`) throws it, before any write, for a run whose disk status is `abandoned`. `Controller.drive` (`src/controller/controller.ts:592-604`) ends quietly on that class: no `console.error`, no `openCrashWait`, and `finally` and the reschedule still run | Restrictions: `createWait` for a run with no record behaves as at base; a wait already open stays (design Scope notes) | Success: `createWait` on an abandoned run rejects with `code: 'run-abandoned'` and writes no wait record; on a running run and on an unknown id it writes the wait (regression guard); a drive ending in `RunAbandonedError` logs no error and opens no wait; any other throw still opens the crash wait (regression guard); a cancelled run's crash opens none (AC 7, regression guard); `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/waits.test.ts src/controller/__tests__/controller.test.ts` pass_

- [ ] 18. Stop the driver on every cancel path
  - File: src/controller/runs.ts
  - File: src/controller/phases/document.ts
  - File: src/controller/__tests__/runs.test.ts
  - File: src/controller/__tests__/liveness-e2e.test.ts
  - Test: src/controller/__tests__/liveness-e2e.test.ts — `controller.cancel(id)`
  - Test: src/controller/__tests__/runs.test.ts — `runOnce(deps(fx), runId)`
  - Note: both test files keep every asserted value; `src/controller/__tests__/runs.test.ts:447` still pauses a held run.
  - Purpose: No retry, wait or status write follows a cancel.
  - _Leverage: src/controller/runs.ts:418-423, src/controller/runs.ts:754, src/controller/runs.ts:846-851, src/controller/runs.ts:868, src/controller/runs.ts:989, src/controller/runs.ts:1024, src/controller/runs.ts:1345-1347, src/controller/phases/document.ts:201-206_
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - _Prompt: Task: Per design C7 "Driver checks" and requirements D7 (requirement 7 AC 1 to AC 5), use the helper task 16 adds in `stopReason` (`src/controller/runs.ts:419`), the loop top (`:868`) and the merge round (`:754`). `runOnce` returns after its first read for an `abandoned` run, before `ensureWorktree` and the `running` write (`:846-851`). `handleCloseoutOutcome`, `handleImplementationOutcome`, `handleRetrospectiveOutcome` and `handleDocumentOutcome` return `'stop'` first when cancelled; `handleDocumentOutcome` checks again after its retry (`:1347`), and `runMergeStageStep` on entry (`:1024`). Both document `shouldStop` lambdas (`:989`, `:1345`) return `'cancelled'` before `'operator'`. Correct the comment at `src/controller/phases/document.ts:201-206` | Restrictions: The usage window stays out of the document stop (requirements D7); pause behaviour does not change | Success: a cancel during a document step leaves `abandoned`, one `claude -p` spawn, no wait and no retry, and the status holds at a later read; the same holds with the in-memory set empty (`isCancelled` false, disk `abandoned`) (AC 4); a step failure after a cancel opens no `error` or `escalation` wait in each of the four phases (AC 2); `runOnce` on an abandoned run calls no `ensureWorktree` and writes no `running` (AC 3); a run cancelled at the merge stage opens no wait and writes no status (AC 5); a held run still pauses (regression guard); `npx tsc --noEmit` and `npx vitest run src/controller/__tests__/runs.test.ts src/controller/__tests__/liveness-e2e.test.ts` pass_

- [ ] 19. Show true phase, run age and health tone on run tiles
  - File: src/dashboard_frontend/src/modules/shell/board.ts
  - File: src/dashboard_frontend/src/modules/shell/tiles.tsx
  - File: src/dashboard/shell/__tests__/board-view.test.ts
  - File: e2e/worktree-board.spec.ts
  - Test: src/dashboard/shell/__tests__/board-view.test.ts — `runTone(run, waits, now)`
  - Test: e2e/worktree-board.spec.ts — `page.getByTestId('run-age-' + runId)`
  - Note: existing values stay: `ageTone` tests keep, and `baseRun` has no `phase`. Requirement 8 AC 3 and 10 AC 4 hold at base: regression guards.
  - Purpose: The operator can trust a run tile.
  - _Leverage: src/dashboard_frontend/src/modules/shell/board.ts:90-117, src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150, src/dashboard_frontend/src/modules/shell/tiles.tsx:165-174, src/controller/runs.ts:1495-1500_
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 10.1, 10.2, 10.3, 10.4_
  - _Prompt: Task: Per design C8, C10 and requirements D10 and D11 (requirements 8 and 10), add `runTone` to `board.ts` and use it in place of `ageTone` at `src/dashboard_frontend/src/modules/shell/tiles.tsx:149-150`. Join `[run.phase, run.stepKind, run.task]` in the step line (`:165-169`) and add `run-age-<id>` reading `run ` and `compactAge(now - Date.parse(run.created))`. Run `npx playwright install chromium` first | Restrictions: The step age stays; wait and action tiles keep `ageTone`; read only the run's own row, never a ledger | Success: `runTone` is `danger` for a stalled run whatever its dot; `warning` for a not-stalled run with an `amber` or a `red` dot; `neutral` for `green` and `grey`; a healthy `requirements` run created 2 minutes ago, on a project with an older run of the same store, shows `requirements` and `run 2m`; a run with no `phase` shows no phase text (AC 4); the step age still shows; a healthy run created 2 hours ago has `data-tone` `neutral`; a stalled run has `danger`; `(R4 AC2)` and `(D12)` tones hold (regression guard); `npx vitest run src/dashboard/shell/__tests__/board-view.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_

- [ ] 20. Split the Running band from a quiet stopped band
  - File: src/dashboard_frontend/src/modules/shell/board.ts
  - File: src/dashboard_frontend/src/modules/shell/tiles.tsx
  - File: src/dashboard_frontend/src/modules/shell/HomePage.tsx
  - File: src/dashboard/shell/__tests__/board-view.test.ts
  - File: e2e/worktree-board.spec.ts
  - Test: src/dashboard/shell/__tests__/board-view.test.ts — `stopped(runs, enabled, now)`
  - Test: e2e/worktree-board.spec.ts — `page.locator('[data-testid^="band-"]')`
  - Note: asserted values change at, at least, `src/dashboard/shell/__tests__/board-view.test.ts:521-535` and the band test at e2e `e2e/worktree-board.spec.ts:348-358`; widen to every assertion the change touches. Requirement 9 AC 4 holds at base: regression guard.
  - Purpose: The Running count means what it says.
  - _Leverage: src/dashboard_frontend/src/modules/shell/board.ts:35-59, src/dashboard_frontend/src/modules/shell/HomePage.tsx:18-39, src/dashboard_frontend/src/modules/shell/HomePage.tsx:163-197, src/dashboard_frontend/src/modules/shell/tiles.tsx:170-194_
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - _Prompt: Task: Per design C9 "Interfaces", "Placement", "Quieter weight", "How long an abandoned run stays", design D12 and requirements D9 (requirement 9 AC 1 to AC 5), `running` returns moving runs in the base order and takes no `now`. Add `stopped`, `Band`'s `quiet` and `hideWhenEmpty`, `RunTile`'s `quiet`, and `band-stopped` after `band-next`. Update the three-band comment at `src/dashboard_frontend/src/modules/shell/HomePage.tsx:41-46`. Run `npx playwright install chromium` first | Restrictions: `stoppedAdmitted` and `runControls` do not change; no time limit on an abandoned run (AC 5) | Success: `running` drops a stopped run and keeps the base order; `stopped` holds admitted runs, newest `updated` first, and drops a disabled project's run; with one running, one done and one abandoned run, each stopped run with its branch present, `band-running` holds only the running run and `band-stopped` the other two (the decomposition's scenario 8); the bands order needs you, running, next, stopped; with `band-next` visible and no stopped run, `band-stopped` has count 0; its heading has `text-xs` and `font-medium`; a quiet tile shows `run-status-<id>` reading `done`, `abandoned` or `error`, with no display-size age and no dot row; Discard still works there (AC 4, regression guard); an abandoned run stays with its branch present (AC 5, regression guard); `npx vitest run src/dashboard/shell/__tests__/board-view.test.ts src/dashboard/__tests__/frontend-style-scan.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` pass_

- [ ] 21. Protect a branch a later run reused
  - File: src/controller/runs.ts
  - File: src/controller/controller.ts
  - File: src/controller/__tests__/runs.test.ts
  - File: src/controller/__tests__/controller.test.ts
  - File: e2e/worktree-board.spec.ts
  - Test: src/controller/__tests__/runs.test.ts — `listRunsForWire(driven, branchRead)`
  - Test: src/controller/__tests__/controller.test.ts — `controller.discard(runId)`
  - Note: the vitest values stay: seeds at `src/controller/__tests__/runs.test.ts:946`, `:1000` and `src/controller/__tests__/controller.test.ts:2458` share one `created`. The e2e seed changes, as the prompt says.
  - Purpose: Discard of an old run cannot delete a newer run's branch.
  - _Leverage: src/controller/runs.ts:1410-1436, src/controller/runs.ts:1482-1488, src/controller/runs.ts:1490-1511, src/controller/controller.ts:388, src/dashboard/multi-server.ts:817-823_
  - _Requirements: 9.6_
  - _Prompt: Task: Per design C9 "Reused branch" and design D13 (requirement 9 AC 6), export `branchReused` from `src/controller/runs.ts`. `toRow` (`:1490-1511`) sets `discardAllowed` and `branchPresent` as design states, with no branch read for a reused run. `Controller.discard`'s guard (`src/controller/controller.ts:388`) gains the same test. In e2e `(R7 AC7)`, `baseRun` calls `isoAgo` per run, so the moving run can read later and the stopped tile would leave the band: give both runs at `e2e/worktree-board.spec.ts:2071-2078` one `created` | Restrictions: `branchHeld` and `discardRun` do not change | Success: a run with a later `created`, the same `codeRoot` and the same non-empty `branch`, in any status, makes the older row `discardAllowed: false`, `branchPresent: false`, and its branch read is not called; an equal `created`, a different `codeRoot`, an empty `branch` and the later run itself are not reused; `discard` of an older run whose reuser is `done` answers `'branch-in-use'`, deletes no branch, closes no PR and leaves the record unchanged; `npx tsc --noEmit`, `npx vitest run src/controller/__tests__/runs.test.ts src/controller/__tests__/controller.test.ts` and `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts -g "R7 AC7"` pass_

- [ ] 22. Line up the Deploy control
  - File: src/dashboard_frontend/src/modules/shell/DeployControl.tsx
  - File: e2e/worktree-board.spec.ts
  - Test: e2e/worktree-board.spec.ts — `page.getByTestId('deploy-button').boundingBox()`
  - Note: existing e2e values stay.
  - Purpose: The top bar reads as one row.
  - _Leverage: src/dashboard_frontend/src/modules/shell/DeployControl.tsx:57, src/dashboard_frontend/src/modules/shell/TopBar.tsx:28_
  - _Requirements: 11.1, 11.2_
  - _Prompt: Task: Per design C11 (requirement 11), remove `mb-3` at `src/dashboard_frontend/src/modules/shell/DeployControl.tsx:57`. Add a Playwright box check at 1280 px. Run `npx playwright install chromium` first | Restrictions: Change no other class; `TopBar.tsx` does not change | Success: at 1280 px the vertical centre of `deploy-button` is within 1 px of the centre of `nav-home`; `grep -n 'mb-3' src/dashboard_frontend/src/modules/shell/DeployControl.tsx` finds nothing; `npx playwright test -c playwright.worktree.config.ts e2e/worktree-board.spec.ts` passes_

- [ ] 23. Record the live scenarios and resolve the deferrals
  - File: .spec-workflow/specs/decisions-and-launch-guard/verification-evidence.md
  - File: .spec-workflow/deferrals/d-83cc3ac1.md
  - File: .spec-workflow/deferrals/d-37e510db.md
  - File: .spec-workflow/deferrals/d-4f6a6271.md
  - File: .spec-workflow/deferrals/d-aaf54e29.md
  - Note: implementer-only, no test seam: its success is a file and four records, so nothing can go red first. All listed paths sit under `.spec-workflow/`, so the phase runs no gate.
  - Purpose: The two live scenarios gate the retrospective and the queue matches what shipped.
  - _Leverage: .spec-workflow/specs/dashboard-board/verification-evidence.md:1-10, .spec-workflow/agent-rules.md:172-179_
  - _Requirements: 1.8, 6.3_
  - _Prompt: Task: Per design C1 "Deploy step", C6 "Deferrals" and Testing Strategy "Live" (requirement 1 AC 8, requirement 6 AC 3), write `verification-evidence.md` in the dashboard-board file's format: a preamble saying the automated cases live in the unit, integration and browser suites and every line must read `passed` before the retrospective opens. Then one `pending` line for scenario 1: after the deploy, the operator names the project at `/home/mcf/repo/tradr` `tradr app` and the one at `/home/mcf/repo/tradr-hosted` `tradr infra`, and no page shows `tradr-hosted · tradr`. One `pending` line for scenario 6: a cancel during a live step leaves the run `abandoned`, with no second `claude -p`, no new wait and no status change in the next 60 seconds. State that the orchestrator relocates the file to the main spec store at the merge gate. Then call the `deferrals` tool with action `resolve` and `resolvedInSpec: decisions-and-launch-guard` for `d-83cc3ac1`, `d-37e510db`, `d-4f6a6271` and `d-aaf54e29`; the last note says it covers the launch half only. Design C6 assigns this to this task, so it is the named exception to the implementer's rule against touching deferrals | Restrictions: No code change; do not run a scenario, restart the service or set a name; resolve no other deferral; do not touch `d-c3c57b89` | Success: the file exists with the preamble, the two `pending` lines and the relocation step; `deferrals` `get` reads `resolved` for all four ids; the `d-aaf54e29` resolution names the launch half_

## Scope notes

- Carried from design: none.
- Every design component has a task: C1 (1 to 4, 23), C2 (5 to 7), C3 (8, 9), C4 (10, 11), C5 (12, 13), C6 (14, 23), C7 (15 to 18), C8 (19), C9 (20, 21), C10 (19), C11 (22).
- Decomposition scenarios: 1 and 6 are live lines in task 23, with 6 also in task 18; 2 is in tasks 6 and 7; 3 in task 9; 4 in task 11; 5 in task 13; 7 and 9 in task 19; 8 in task 20; 10 in task 22.
- No task touches a sensitive path. Expect at least three verifiers: task 5 adds a module, and tasks 3 and 6 hit `isWiringTask` (`src/controller/phases/implementation.ts:266-272`).
- Tasks 14 and 23 are implementer-only; all their listed paths sit under `.spec-workflow/`, so `isVerificationOnly` (`src/controller/phases/implementation.ts:275-278`) skips the gate and the verifier.
- Added beyond design: `launchPress` (D16), `Controller.save` in the emit rule (D17), the `STEP_CLASSIFICATIONS` entry (D19), the seed fix in `(R7 AC7)` (D20).
- The ESLint Success check is left out (D15). The harness sync checks are left out of task 11 (D18).
- Cut: nothing from the decomposition entry. Out of scope, as requirements and design set: the eval `file-outside-list-emits-tasks-patch`, the no-PR half of `d-aaf54e29`, the recreated spec folder of `d-4f6a6271`, retro P11, the advisor listing and summary names, and a wait already open at a cancel.

## Decisions taken in this document

- D15 — The standing ESLint Success check: options were listing it or leaving it out; chosen leaving it out because this repository has no ESLint binary, config or dependency, so the check would red every task, as the dashboard-deploy spec found.
- D16 — How the two-press rule is unit tested: options were the browser suite alone, or a small pure helper beside the board model; chosen the helper because the vitest run renders no React, and the browser suite still proves the wiring.
- D17 — Which writers stop emitting on a dropped write: options were the two the design names, or also the controller's own save; chosen all three because the design's error handling allows no change event for a dropped write, and an answered wait reaches that third writer.
- D18 — The harness checks for the implementer agent text: options were listing them or leaving them out; chosen leaving them out because the sync script, the plugin copies and the plugin manifest no longer exist in this repository, though the agent rules still name them.
- D19 — The advisor's failure tally for a skipped step: options were leaving the list alone or adding the new class; chosen adding it, because a skip would otherwise count as an unknown failure.
- D20 — How the existing branch-held browser test survives the reuse rule: options were dropping the test or pinning both seeds to one creation time; chosen pinning, because a stopped run with a live holder of equal age still shows the quiet line.
- D21 — The first home of the cancelled-run check: options were the spawn-race task or the driver task; chosen the spawn-race task, because it runs first and needs the check, and the driver task reuses it.
- D22 — The browser scenario for the launch guard: options were a task file or a decomposition entry; chosen a decomposition entry because the fixture store already seeds one and needs no spec directory, and the route test covers both sources.
- D23 — The deferral resolve in the last task: options were the implementer or the supervisor at close; chosen the implementer because the design assigns it to the last task, so the prompt names the exception to the implementer's standing rule.

## Revision History

- **v1** (2026-11-07) — Initial draft.
  - **Lint pass.** 21 fixed; rejected: none.
