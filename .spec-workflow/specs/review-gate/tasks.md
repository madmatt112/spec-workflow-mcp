# Tasks Document

Dependency order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10. Tasks 1-4 add one field and three leaf modules nothing calls yet; 5 wires them into the new handler, 6 exposes it through `review-task`, 7 adds the end-to-end test; 8 and 9 edit the harness, each regenerating `plugins/` in the same commit; 10 updates the docs. Every task leaves `npx tsc --noEmit` clean and every existing suite green; the full suite runs once, at the completion gate.

- [x] 1. Add `reviewer` to `TaskReview` and its markdown round-trip
  - File: src/types.ts
  - File: src/core/task-review-manager.ts
  - File: src/core/__tests__/task-review-manager.test.ts
  - File: src/tools/__tests__/get-task-review.test.ts
  - Add `reviewer?: 'gate' | 'agent'` to `TaskReview` (`src/types.ts:253-262`); `reviewToMarkdown` writes `reviewer: ${review.reviewer ?? 'agent'}` after the `verdict:` line (`src/core/task-review-manager.ts:195`); `parseReviewMarkdown` reads `get('reviewer')` (`:243-246`) and returns `'gate'` or `'agent'` in the object at `:307` (D7, D31)
  - Existing asserts: `task-review-manager.test.ts` checks frontmatter with `toContain` (`:200-203`) and fields by equality; `get-task-review.test.ts:85-96` checks fields by equality; neither asserts a value this change alters
  - Purpose: Tell gate-recorded from agent-recorded reviews; `get-task-review`, `spec-status` and the dashboard routes carry the field with no code change
  - _Leverage: src/core/task-review-manager.ts:108-132, src/core/__tests__/task-review-manager.test.ts:149-206, src/tools/__tests__/get-task-review.test.ts:85-96_
  - _Requirements: 5.3, 5.4, 5.5, 5.6_
  - _Prompt: Task: Add the optional `reviewer` field per requirement 5.3, write it on every new review file and parse it with `agent` as the default; extend the round-trip suite (`reviewer: 'gate'` round-trips; a file without the key parses `agent`; a save without `reviewer` serialises `agent`) and add one `get-task-review` case asserting `data.review.reviewer` | Restrictions: Do not change `validateVerdictConsistency`, `getNextVersion`, `get-task-review`'s `nextSteps`, `spec-status` or the dashboard routes; no other frontmatter key moves | Success: `npx tsc --noEmit` clean; `npx vitest run src/core/__tests__/task-review-manager.test.ts src/tools/__tests__/get-task-review.test.ts` green, existing and new cases_

- [x] 2. Add `computeRangeStats` beside `computeTaskDiff`
  - File: src/core/task-diff.ts
  - File: src/core/__tests__/task-diff.test.ts
  - Export `RangeSelector`, `RangeStatsResult` and `computeRangeStats(root, range)` per design Component 5: repo check, ref resolve (an unborn `HEAD` is an empty ok result), commit mode `git -c core.quotePath=false log --first-parent -1 --numstat --format= --no-renames`, ref mode `diff --numstat --no-renames` plus `ls-files --others --exclude-standard` with a newline count per untracked file (D16-D18); `touched` is returned whole, never capped (R4-1)
  - Existing asserts: the `computeTaskDiff` cases (`:76` onward) are untouched and nothing they assert changes; new cases use `gitInit`/`gitCommitAll` (`:31-41`) and `installPassthrough` (`:43`) around the `execFile` mock (`:3-9`)
  - Purpose: Touched paths and line counts over the selected range, every changed file, not only logged ones
  - _Leverage: src/core/task-diff.ts:36-48 (`runGit`), src/core/task-diff.ts:263-291 (`parseNumstat`), src/core/git-utils.ts:45-51_
  - _Requirements: 1.4, 8.3_
  - _Prompt: Task: Implement `computeRangeStats` per requirement 1.4 and design Component 5, reusing the file-private `runGit` and `parseNumstat`; add cases for a root, a later and a merge commit (first-parent only), `baseRef` with committed, uncommitted and untracked changes, an ignored file excluded, a rename as two paths, no repository and a bad ref each `ok: false` with the design's message, and an unborn `HEAD` as an empty ok result | Restrictions: Do not edit `computeTaskDiff`, `runGit` or `parseNumstat`; keep every existing export's signature; no cap on `touched` | Success: `npx tsc --noEmit` clean; `npx vitest run src/core/__tests__/task-diff.test.ts` green, existing and new cases_

- [x] 3. Add the check runner
  - File: src/core/check-runner.ts
  - File: src/core/__tests__/check-runner.test.ts
  - Export `CHECK_TIMEOUT_MS`, `CHECK_MAX_BUFFER`, `CheckResult`, `runChecks(root, commands, opts?)` and `lastLine(stdout, stderr)` per design Component 6: `child_process.exec` per command, awaited in order, `cwd: root`, env `{ ...scrubbedGitEnv(), FORCE_COLOR: '0', NO_COLOR: '1' }`, `killSignal: 'SIGTERM'`; expiry (`error.killed`, `signal === 'SIGTERM'`, `code === null`) is `timeout`, a numeric `error.code` is `fail` with that exit code, `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` is `fail` with `exitCode: null`, `error === null` is `pass`
  - The taxonomy was probed on node v24.13.0 (design Component 6); CI runs node 20 (`.github/workflows/ci.yml:20`), the runtime the test's assertions target (R4-2); assert only `killed`, `signal`, `code` and the status mapping, nothing version-specific
  - Purpose: Run the caller's named checks with one 200-character output line each (D10, D22)
  - _Leverage: src/core/git-utils.ts:45-51, src/core/typecheck.ts:187 (env shape)_
  - _Requirements: 1.3, 4.1, 4.4, NFR Security_
  - _Prompt: Task: Implement the check runner per requirement 4.4 and design Component 6; test pass, non-zero exit, timeout (`node -e "setTimeout(()=>{}, 5000)"` with `timeoutMs: 100`), `lastLine`'s last-non-empty-line choice and 200-character cut, and sequential order | Restrictions: Only the strings in `commands` run; no parallelism; nothing but the one line leaves the module; the test must hold on node 20, the CI runtime | Success: `npx tsc --noEmit` clean; `npx vitest run src/core/__tests__/check-runner.test.ts` green_

- [x] 4. Add the gate rules module
  - File: src/core/gate-rules.ts
  - File: src/core/__tests__/gate-rules.test.ts
  - Export the constants, `parseSensitivePaths`, `isSensitivePath`, `taskBlock`, `taskNamesTests`, `isTestPath`, `worstTypecheckState`, `scoreRisk`, `decideGate` and `truncateLine` per design Components 3-4 and the two rule tables in Data Models; `parseSensitivePaths` reads bullets under `## Sensitive paths` to the next `## ` line, strips backticks, whitespace and `./`, returns `null` with no heading or bullet (D26)
  - `scoreRisk` and `decideGate` take the full touched list; `MAX_TOUCHED_LISTED` is a display constant the handler applies after the rules run, never before (R4-1)
  - Purpose: One pure module of tunable constants and predicates, one unit test per rule (3.4); typecheck states arrive as `{ kind }` so `core` never imports `tools`
  - _Leverage: src/core/task-parser.ts:112 (`lineNumber`), src/core/task-parser.ts:167-175 (checkbox regex, block end), src/core/typecheck.ts:8-15, src/core/hygiene-signals.ts:4-9, .spec-workflow/agent-rules.md:43-52 (a real six-bullet list)_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.6_
  - _Prompt: Task: Implement the rules module per requirements 2-4 and design Component 4: one `it` per row of both rule tables; `parseSensitivePaths` for heading absent, no bullet, backticks, a non-bullet line, a `dir/` prefix entry, an exact entry; `isTestPath`; `taskBlock` (a heading does not bound, a checkbox line does); `worstTypecheckState` order; a sensitive path at index 150 of a 200-path list still fires rule a | Restrictions: Pure functions only, no I/O, no import from `src/tools/`; do not read `agent-rules.md` here, the handler passes its text; the rules read every touched path, uncapped | Success: `npx tsc --noEmit` clean; `npx vitest run src/core/__tests__/gate-rules.test.ts` green with a case per rule and constant_

- [x] 5. Add `handleGate` in `src/tools/review-gate.ts`
  - File: src/tools/review-gate.ts
  - File: src/tools/__tests__/review-gate.test.ts
  - Implement the ten steps of design Component 2 with the exports of tasks 1-4: root check, task or item mode, `filesOnly` (D23), `agent-rules.md` read (ENOENT ⇒ `null`), range stats, typecheck and hygiene over touched paths absolutised under `root` (D30), checks, rules, `truncateLine` once per reason, `saveReview` with `reviewer: 'gate'` for task mode `pass`/`low` only, no prepare marker; return `GateData`, `nextSteps`, `projectContext`
  - `data.touched.paths` is cut to 100 for display only, after every rule has seen the whole list (R4-1); no dispatch exists yet, so the test calls `handleGate` directly (bridge; task 6 adds the dispatch case)
  - Purpose: The gate end to end, one response shape for task and item calls
  - _Leverage: src/tools/review-task.ts:54-73 and :79-113 (exported), :347-366, :431-432, :493-498; src/core/task-parser.ts:153; src/dashboard/implementation-log-manager.ts:461; src/core/path-utils.ts:208-210; src/tools/__tests__/review-task.test.ts:13-20, :94-112; src/core/__tests__/task-diff.test.ts:31-41_
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 4.5, 5.1, 5.2, 7.2, 9.1_
  - _Prompt: Task: Implement `handleGate` per requirements 1.2-1.8 and design Component 2, calling the range function task 2 exports, the runner task 3 exports and the rules task 4 exports; cover in `review-gate.test.ts`, using an `.spec-workflow/agent-rules.md` fixture whose `## Sensitive paths` entry does not match the touched file (rule a); for the pass/low and record-after-gate cases, no rule but a may sit armed — write a `tasks.md` task block that does not match `/\b(tests?)\b/i` (not the `review-task.test.ts:79-87` exemplar's "Success: Tests pass" line) or else touch a path satisfying `isTestPath` (rule c), keep the diff non-empty and under 200 changed lines (rules b, d), mock typecheck (`:13-20`) to return `success-clean-full` or `unavailable-feature-disabled` (rule e), and leave hygiene unmocked so it cannot reject (rule g): a task gate with `baseRef` ⇒ `pass`/`low`, a review file with `reviewer: gate` and no `.prepare-` marker; an item gate (`taskId: 'P3'`, `commit`) ⇒ no review file; files-only with one missing path ⇒ `fail`, `stats: null`, `typecheck.kind === 'skipped'`, `hygiene` `{}`; each Error Handling cause 1-6 ⇒ `success: false`; an extra touched path with `files` given ⇒ `file-outside-list`; a gate `pass`/`low`, then `prepare`, then `record` ⇒ `version: 2`; every `reasons` and `checks[].output` string at most 200 characters; no `diff` key in `data`; more than 100 touched paths ⇒ `touched.total` is the full count and a sensitive path sorted past position 100 still scores `high` | Restrictions: Do not edit `review-task.ts`, import its exports only; no diff body, file contents or extra output lines in the response; `saveReview` in one call; the test calls `handleGate` directly, not the tool dispatch | Success: `npx tsc --noEmit` clean; `npx vitest run src/tools/__tests__/review-gate.test.ts` green_

- [x] 6. Expose `gate` through `review-task`
  - File: src/tools/review-task.ts
  - File: src/tools/__tests__/review-task.test.ts
  - Add `'gate'` to the `action` enum (`:179-183`), the optional `baseRef`, `commit`, `checks`, `files`, `root` properties (`:178-223`), a `gate` bullet under "Two actions" (`:160-162`), and a dispatch branch (`:251-260`) calling the handler task 5 exports; `required` stays `['action', 'specName', 'taskId']` (`:224`); the unknown-action message names all three actions (D32)
  - Existing asserts: `review-task.test.ts` asserts no schema, description or unknown-action text, so nothing it asserts exactly changes; no bridge to remove, task 5's direct-call test stays valid
  - Purpose: The tool accepts `gate` beside `prepare` and `record`, both unchanged
  - _Leverage: src/tools/review-task.ts:232-261, src/tools/root-selection.ts:202-221, src/tools/__tests__/review-task.test.ts:63-113_
  - _Requirements: 1.1, 8.1, 8.2_
  - _Prompt: Task: Wire `action: "gate"` per requirement 1.1 and design Component 1, and add one dispatch case to `review-task.test.ts` (a files-only `gate` call — `taskId` absent from `tasks.md`, `files` set, no `commit`/`baseRef`, so it takes the files-only path per D23 with no git needed — reaches the handler and returns `data.gate`; an unknown action is still `success: false`) | Restrictions: Touch only the enum, the new properties, the description bullet, the dispatch and the unknown-action message; `handlePrepare`, `handleRecord`, the methodology and the byte-pinned constants (`:743-791`) stay byte-identical; `required` unchanged | Success: `npx tsc --noEmit` clean; `npx vitest run src/tools/__tests__/review-task.test.ts src/tools/__tests__/review-gate.test.ts` green_

- [x] 7. Add the end-to-end gate test
  - File: src/tools/__tests__/review-gate.e2e.test.ts
  - One temp dir as both roots, `gitInit`, a `.gitignore` ignoring `.spec-workflow`, `.spec-workflow/agent-rules.md` whose `## Sensitive paths` names `src/auth.ts`, `.spec-workflow/adversarial-settings.json` with `features.typecheck: false` (`src/core/adversarial-settings.ts:54-57`, `:195-197`), `tasks.md` with tasks 1-3 `[-]`, commit `C0` (D29, R2-2, R3-2)
  - Existing asserts: `spec-status.test.ts:80-89` is the fixture pattern only; nothing there changes; `reviewCoverage` sits in `data` (`src/tools/spec-status.ts:224`)
  - Purpose: The decomposition entry's verification scenario as a vitest test, run by `npm test -- --run` on CI (node 20)
  - _Leverage: src/core/__tests__/task-diff.test.ts:31-41, src/tools/__tests__/review-task.test.ts:94-112, src/tools/__tests__/spec-status.test.ts:80-89, src/tools/spec-status.ts:154-193_
  - _Requirements: 9.2_
  - _Prompt: Task: Write the three-task scenario per requirement 9.2 and the design's End-to-end strategy, with the fixture's task-1 and task-3 blocks not matching `/\b(tests?)\b/i` (rule c stays silent since `docs/a.md`/`docs/b.md` are non-test paths): (1) `docs/a.md` logged, gate with `baseRef: C0` ⇒ `pass`, `low`, `recorded` set, `get-task-review` returns `reviewer: 'gate'`, commit `C1`; (2) edit `src/auth.ts`, logged, gate with `baseRef: C1` ⇒ `high` with `sensitive-path: src/auth.ts`, `recorded: null`, then `prepare`/`record` `pass` ⇒ version 1, commit `C2`; (3) `docs/b.md`, logged, gate with `baseRef: C2` and a `node -e` check that prints `boom` and exits 1 ⇒ `fail`, `checks[0].output === 'boom'`, no review file; re-gate with a passing check ⇒ `pass`, `recorded` set; mark all `[x]`; `specStatusHandler` ⇒ `data.reviewCoverage.reviewed === 3` | Restrictions: Go through `reviewTaskHandler`, `getTaskReviewHandler` and `specStatusHandler`, never the internals; no typecheck mock, the settings file disables it; no network | Success: `npx vitest run src/tools/__tests__/review-gate.e2e.test.ts` green on node 20 and 24; the full `npm run build` and `npm test -- --run` belong to the completion gate_

- [x] 8. Route the implementation skill on the gate
  - File: harness/skills/sdd-implementation-phase/SKILL.md
  - File: harness/skills/sdd-implementation-phase/references/briefs.md
  - File: harness/agents/sdd-verifier.md
  - File: harness/agents/sdd-implementation-orchestrator.md
  - File: plugins/*/agents, plugins/*/skills (regenerated)
  - Edits per design Component 8: ledger note and `outcome=gate` (`SKILL.md:40-51`); Pick records `HEAD` as the base ref (`:71-72`; a Step-0 `[-]` task has none, `:59-61`); step 4 becomes Gate with three routes (`:84-88`); gate fails count against the cap, terminus re-runs failing checks, a post-checks `success: false` takes the resume escape (`:89-96`, `sdd-closeout-phase/SKILL.md:96-98`); gate fix brief (`briefs.md:66-82`); `## Gate results` and line 124 reworded in the verifier brief (`:112-131`); narrow brief (`:133-137`); `sdd-verifier.md:26`; `tools` gains the three `review-task` names (`sdd-implementation-orchestrator.md:9-36`, pattern `sdd-verifier.md:12-14`)
  - `PickRow.outcome` is a free string (`src/watch/ledger.ts:94-99`, `:279-281`), so `outcome=gate` needs no server change; no test reads `harness/`
  - Purpose: Gate first; verifier only on high risk; ledger counts skipped spawns
  - _Leverage: harness/skills/sdd-implementation-phase/SKILL.md:8-12, :126-139, :159-178, :214-224 (untouched); scripts/sync-plugin-assets.cjs:1-12_
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_
  - _Prompt: Task: Make the implementation-phase edits per requirement 6 and design Component 8, then run `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets` and `claude plugin validate . --strict`, committing the `plugins/` copies with the source | Restrictions: Edit `harness/` only, never `plugins/` by hand; leave the completion gate, PR checks gate and Repair untouched; the skill assembles `checks` from the task block and `agent-rules.md`, omitting a bare typecheck command (D2); no gate result carries file contents into the orchestrator | Success: The three commands exit 0; step 4 names `action: gate`, all three routes and the ledger note; `sdd-verifier.md:26` and `briefs.md:124` no longer say to run the task's checks yourself_

- [x] 9. Gate close-out items
  - File: harness/skills/sdd-closeout-phase/SKILL.md
  - File: harness/skills/sdd-closeout-phase/references/briefs.md
  - File: harness/agents/sdd-closeout-orchestrator.md
  - File: plugins/*/agents, plugins/*/skills (regenerated)
  - Edits per design Component 9: ledger note per item gate (`SKILL.md:39-50`); step 3b Gate per `done <sha>` item with `commit`, `root`, `files` and the class's checks (`:118-120`, `briefs.md:5-14`); a `home` item passes `files` only, one naming no path gets no call (D24); Verify spawns only for `harness`/`code` items at `pass`/`high` (`:121-124`); gate-fail items enter the fix brief (`:125-131`); `to-do`/`skipped` items skip the gate (`:132-135`); `## Gate results` and the no-re-run sentence in the verify brief (`briefs.md:112-138`); `gate:` accepted in the fix brief (`:140-158`); `tools` gains the three `review-task` names (`sdd-closeout-orchestrator.md:9-24`)
  - No test reads `harness/`
  - Purpose: `store` and `home` items never see a verifier; `harness` and `code` items route as tasks do
  - _Leverage: harness/skills/sdd-closeout-phase/SKILL.md:66-72 (class table), harness/skills/sdd-closeout-phase/references/briefs.md:44-60 (one sha per item), harness/agents/sdd-verifier.md:12-14_
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 6.7_
  - _Prompt: Task: Make the close-out edits per requirement 7 and design Component 9, then run `node scripts/sync-plugin-assets.cjs`, `npm run check:plugin-assets` and `claude plugin validate . --strict`, committing the `plugins/` copies with the source | Restrictions: Edit `harness/` only; keep the class table, landing, commit script and PR step as they are; a `store` or `home` item is `ok` on `gate: pass` whatever its risk; the tool never receives `files: []` | Success: The three commands exit 0; step 3b names `action: gate` per item; the verify step spawns nothing when no `harness`/`code` item is `pass`/`high`_

- [x] 10. Document the gate
  - File: docs/TOOLS-REFERENCE.md
  - File: docs/SDD-HARNESS.md
  - `review-task` (`docs/TOOLS-REFERENCE.md:399-437`): the `action` row (`:411`) gains `'gate'`, rows for `baseRef`, `commit`, `checks`, `files`, `root`, and a Gate paragraph naming every `data` field and the routing rules; `get-task-review` (`:439-453`) mentions `reviewer`; `docs/SDD-HARNESS.md:75-78` gains "the gate runs first; `sdd-verifier` only on `risk: high`", `:98-113` the item-gate sentence, `:233-238` a third machine-read bullet for `## Sensitive paths`
  - No version bump in this PR (9.5); `npm run check:plugin-assets` re-run once here as the last check
  - Purpose: The docs match the shipped tool and skills
  - _Leverage: docs/SDD-HARNESS.md:225-240 (the `agent-rules.md` section), .spec-workflow/agent-rules.md:43-52_
  - _Requirements: 9.3, 9.4, 9.5_
  - _Prompt: Task: Update both documents per requirement 9.3 and design Component 10 so every `gate` argument, every `data` field and the three routes appear once each | Restrictions: Docs only; no code, harness or manifest change; no bare angle brackets outside code spans | Success: `npm run check:plugin-assets` exits 0; `docs/TOOLS-REFERENCE.md` lists `'prepare' | 'record' | 'gate'` for `action` and every new parameter; `docs/SDD-HARNESS.md` lists three machine-read lines_

## Scope notes

- R4-1 is absorbed by tasks 2, 4 and 5: the rules read the full touched list; only `data.touched.paths` is cut to 100, for display.
- R4-2 is absorbed by task 3: node 20 (`.github/workflows/ci.yml:20`) is the runtime the assertions target; the local probe ran on node v24.13.0 and no node 20 is installed here (`fnm list`: v22, v24), so CI is the check.
- Nothing the decomposition entry lists is cut. The dashboard frontend, `## Checks` parsing from `agent-rules.md` (D2), the version bump (9.5) and Windows verification stay out, as the design's Scope notes say.
- `npm run build` and `npm test -- --run` run once, at the completion gate (agent-rules Checks), not per task.

## Decisions taken in this document

- D32 — Unknown-action message: keep `Use "prepare" or "record".` or name all three actions; chosen name all three, in task 6, because no test asserts the text.
- D33 — Task order: leaf modules first (1-4), then handler, dispatch, e2e, harness, docs; or vertical slices; chosen leaf-first so every step compiles and no task needs a stub.
- D34 — Task 5's test calls `handleGate` directly, or stubs the dispatch; chosen the direct call because the function is a plain export and the dispatch case belongs to task 6.
- D35 — Plugin copies regenerate in tasks 8 and 9, each in the same commit as its `harness/` edits (agent-rules Checks), or once in task 10; chosen per task, since `check:plugin-assets` must pass after every commit.
- D36 — The two orchestrator `tools` lists (6.7): one task or split by agent; chosen split, task 8 the implementation orchestrator and task 9 the close-out orchestrator, so each harness task is self-contained.
- D37 — Node 20 probe: install node 20 through fnm now, or name it as the target and let CI assert; chosen the latter, no network install during drafting.

## Revision History

- **v1** (2026-09-14) — Initial draft.
- **v2** (2026-09-14) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/2/1).
  - **R1-1 — Accepted (SHOULD_FIX).** Task 5's `_Prompt` now requires a `.spec-workflow/agent-rules.md` fixture whose `## Sensitive paths` entry doesn't match the touched file, for both the pass/low case and the record-after-gate case, so `sensitive` isn't `null` and rule a doesn't fire.
  - **R1-2 — Accepted (SHOULD_FIX).** Task 6's dispatch case is now a files-only item call (`taskId` absent from `tasks.md`, `files` set, no `commit`/`baseRef`), which takes the files-only path per D23 and needs no git repo or `computeRangeStats` mock.
  - **R1-3 — Accepted (MINOR).** Task 1's citation for the `toContain` frontmatter checks corrected from `:195-198` (file-read setup) to `:200-203` (the actual assertions).
- **v3** (2026-09-14) — Round-2 adversarial response (adversarial-analysis-tasks-r2.md, verdict iterate 0/1/1).
  - **R2-1 — Accepted (SHOULD_FIX).** Task 5's `_Prompt` now states the full precondition set for the pass/low and record-after-gate cases: a `tasks.md` task block that does not match `/\b(tests?)\b/i` or a touched test path (rule c), a non-empty sub-200-line diff (rules b, d), a typecheck mock returning `success-clean-full` or `unavailable-feature-disabled` (rule e), and hygiene left unmocked so it cannot reject (rule g) — not rule a alone.
  - **R2-2 — Accepted (MINOR).** The record-after-gate case now reads "a gate `pass`/`low`, then `prepare`, then `record` ⇒ `version: 2`", naming the marker-writing `prepare` call a literal two-call reading omitted.
- **v4** (2026-09-14) — Round-3 adversarial response (adversarial-analysis-tasks-r3.md, verdict iterate 0/1/0).
  - **R3-1 — Accepted (SHOULD_FIX).** Task 7's `_Prompt` now states that the fixture's task-1 and task-3 blocks do not match `/\b(tests?)\b/i`, so risk rule c stays silent for the non-test paths `docs/a.md` and `docs/b.md` and cases 1 and 3's `pass`/`low`/`recorded` outcomes (and `reviewCoverage.reviewed === 3`) are reachable, mirroring the precondition task 5's `_Prompt` already states.
