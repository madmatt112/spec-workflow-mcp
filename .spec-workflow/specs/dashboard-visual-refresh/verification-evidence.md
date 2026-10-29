# Verification evidence — dashboard-visual-refresh

## Before/after view acceptance (Requirement 7.3)

An operator reviews each pair in `screenshots/before/` and `screenshots/after/` and marks
it `passed`. The retrospective does not open until every line below reads `passed`
(agent-rules, Fixtures and live verification).

- now: pending
- runs: pending
- run: pending
- specs: pending
- usage: pending
- deferrals: pending

## Invariants (merge base vs branch)

`BASE` is the merge base of `HEAD` and `main` (`git merge-base HEAD main`, confirmed
identical against both the local `main` ref and `origin/main`).

```
BASE=33ef6fa1a8d225463f1c59329531a48c00c43487
HEAD=2c6ba50304ac431ed2c3605fd494b4ca05a44506
```

- **Requirement 6.2** — `grep -rhoE '(data-testid|role|aria-[a-z-]+)=("[^"]*"|\{([^{}]|\{[^}]*\})*\})' src/dashboard_frontend/src`,
  sorted and uniqued: **ok** — 100 attribute-and-value strings, identical set on base and
  branch.
- **Requirement 6.3** — `git diff --name-only $BASE $HEAD` outside `src/dashboard_frontend/`,
  `e2e/` and this spec's directory: three new vitest files appear
  (`src/dashboard/__tests__/frontend-build.test.ts`, `frontend-style-scan.test.ts`,
  `frontend-tokens.test.ts`) — allowed by the requirement's "new tests" carve-out, confirmed
  absent at `BASE`. Four more paths appear outside the allowed set:
  `.spec-workflow/spec-decomposition/INDEX.md`, `.spec-workflow/spec-decomposition/decomposition.md`,
  `.spec-workflow/specs/approval-durability-and-routing/deferred.json` and
  `.../requirements.md`. Traced to commit `88c54845` ("docs(sdd): undefer
  dashboard-visual-refresh, cull approval-durability"), a pre-implementation roadmap commit
  that landed on this branch before task 1 and touches no `src/` or server file — not
  introduced by tasks 1-6. Recorded per agent-rules D9 (a result outside the expected set is
  a retro finding, not a silent pass and not a merge block), not re-checked as a violation of
  this task's own work.
- **Requirement 6.4** — every file present at `BASE` under `e2e/` and every `BASE` vitest
  test file (`*.test.ts`/`*.spec.ts` under `src/`): **ok** — none has a diff between `BASE`
  and `HEAD`.
- **Requirement 6.6** — `package.json` lines 56-108 (`dependencies`/`devDependencies`):
  **ok** — byte-identical on base and branch.
- **Requirement 6.7** — `src/dashboard_frontend/src/assets/fonts`: **ok** — no diff.
- **Requirement 6.1** — the `<Route>` elements in `App.tsx`: **ok** — the same 7 elements,
  same paths, same order, on base and branch (`grep -o '<Route[^>]*/>'` on each). `git diff -w`
  shows the only non-whitespace change is a width-cap wrapper `<div>` added around `<Routes>`
  (task 3, Requirement 5.4) — no route added, removed or reordered.
- **Requirement 5.1** — `grep -rnE '(min-\[|max-\[|@media[^{]*width)' src/dashboard_frontend/src`:
  **ok** — no hits.
- **Requirement 3.4** — `ThemeProvider.tsx`: **ok**, unchanged since base; default theme is
  `'dark'` (`useState<Theme>(() => ... || 'dark')`, line 16) and the persisted key is
  `'theme'` (`localStorage.getItem('theme')` / `.setItem('theme', theme)`, lines 15/21). The
  theme control and its label (`Theme`, `Dark`/`Light`) are present in `Gear.tsx:69-71`.
- **NFR Performance** — built stylesheet size, `npm run build:dashboard` on the branch vs. a
  `vite build` of the `BASE` tree with the same `node_modules`: branch
  `src/dashboard_frontend/dist/assets/index-ZG-AdvJz.css` = 24,584 bytes; base
  `index-xtv18QdG.css` = 54,578 bytes. **ok** — branch is smaller than base.

## Full checks (Requirement 7.4)

Run on this branch:

- `npm run build` — green (tsc, then `vite build` + `copy-static`).
- `npx tsc --noEmit` — green, no type errors.
- `npm test -- --run` — 142/145 files, 2299/2306 tests pass. 5 tests across 3 files fail
  (`src/dashboard/__tests__/project-manager-durable.test.ts`, `src/tools/__tests__/log-implementation.test.ts`,
  `src/tools/__tests__/projectPath.test.ts`). None of these 3 files is under
  `src/dashboard_frontend/`, none was edited by this spec (confirmed by the Requirement 6.4
  check above), and the same failures reproduce identically running the same files against
  the `BASE` tree with the same `node_modules` (`git archive $BASE` extraction) — pre-existing,
  not a regression from tasks 1-6. One further `project-manager-durable.test.ts` assertion is
  flaky (passes on some runs, fails on others) under both base and branch, consistent with a
  pre-existing timing dependency, not this spec's change.
- `npm run test:e2e:worktree` — green: 27 passed, 6 skipped (the opt-in `capture` block,
  skipped because `SCREENSHOT_SET`/`SCREENSHOT_DIR` are unset on this run; the after set was
  captured in a separate run with those variables set, see below). No existing test edited.

## After-set capture (Requirements 7.1, 7.2)

`SCREENSHOT_SET=after SCREENSHOT_DIR=.spec-workflow/specs/dashboard-visual-refresh/screenshots npx playwright test -c playwright.worktree.config.ts e2e/worktree-visual.spec.ts -g "captures the"`
— 6/6 passed. `screenshots/after/` holds 18 files: `{now,runs,run,specs,usage,deferrals}-{light,dark}.png`
(12) and `{now,runs,run,specs,usage,deferrals}-dark-375.png` (6).
