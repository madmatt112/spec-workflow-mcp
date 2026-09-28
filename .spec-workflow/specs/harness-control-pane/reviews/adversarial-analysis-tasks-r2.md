# Adversarial Analysis — harness-control-pane/tasks (v2)

Round 2. Primary attack surface: atomicity, ordering, coverage. Fresh lens this round:
the cost of touching an existing component (its tests, fixtures, query keys, i18n keys,
e2e assumptions, route lists, nav lists). Deltas attacked first (the v2 change is the
R1-1 citation fix in task 19's `_Prompt`), then the fresh lens over every task that
edits an existing file. Round 1's sub-agent-prompt lens was not repeated.

## Delta verification (Changes since 4b03be5 — fix-induced re-check of R1-1)

The v2 diff is one content change plus Revision History bullets: task 19's `_Prompt`
citation retargeted from `harness/skills/sdd-document-phase/references/briefs.md:12-15`
to `harness/skills/sdd-implementation-phase/references/briefs.md:12-15`.

Scoped to the fix's diff against the requirement it must satisfy (R1-1: the `_Prompt`
citation must support the commit-script instruction and match the `_Leverage` line):

- `harness/skills/sdd-implementation-phase/references/briefs.md:12-15` reads: "Code root:
  … Spec store: … A `cd` inside a script file run with `bash` is fine; that is how commits
  into the spec store are made." That is exactly the content the `_Prompt` clause "commit
  it in the spec store repo with a script … that changes into that repo" depends on.
- The task 19 `_Leverage` line already cites the same file/range. `_Prompt` and
  `_Leverage` now agree.
- The old target, `harness/skills/sdd-document-phase/references/briefs.md:12-15`, is the
  drafter `## Job` block ("Write v1 of `<document path>` … No file contents.") — no
  commit-script content, confirming R1-1 was a real defect and the fix removed it.

R1-1 is correctly closed. The delta introduced no new defect. No `fix-induced` finding.

## Fresh lens — cost of touching each existing file

Every task that edits an existing file was checked for: does it name the assertion sites
it touches, does it tell the implementer to keep existing assertions, and does any
existing suite silently break under the stated ordering.

- **Task 1** (edits `src/core/index-generator.ts` + `src/core/__tests__/index-generator.test.ts`).
  Pure refactor: `snapshot()` runs the entry loop, `categorize` (line 66) and
  `deriveRouting` (line 67); `generate()` calls it then runs render (68), mkdir (70) and
  write (72) and "returns the same result object as today". The cited ranges `:44-67`
  and `:68-72` are accurate against the file. `generate()` still returns `IndexResult`
  (counts); `snapshot()` returns the arrays. Restriction pins "no existing assertion …
  changes value" and forbids touching `render`/`categorize`/`mentionIndex`/`deriveRouting`.
  `PathUtils.getIndexPath` exists (path-utils.ts:245); the constructor takes `projectPath`.
  Safe.
- **Tasks 9, 10** (edit `src/dashboard/multi-server.ts`). Additive only: optional `views`
  on `WebSocketConnection`, optional `harness?` on `MultiDashboardOptions`, four new
  message cases, a reconcile after the existing `subscribe` (a no-op for a viewless
  connection). Restriction names `multi-server.test.ts` and "every other dashboard test
  pass unedited with no assertion value changed". Safe.
- **Task 14** (edits `sdd-providers.sh` + `src/__tests__/providers-map.test.ts`).
  Restriction: "Every existing case in … providers-map.test.ts keeps its exact expected
  values unedited"; one-argument mode "output and refusal order are unchanged". The
  `plugins/` copy is covered by `check:plugin-assets`. Safe.
- **Tasks 11, 12, 13** (edit `WebSocketProvider.tsx`, `App.tsx`,
  `PageNavigationSidebar.tsx`, `locales/en.json`). No vitest covers the frontend
  (`vitest.config.ts:7-8`). The e2e suite (`test:e2e` = playwright, a separate script
  from `npm test`) navigates the same shell, but its nav selectors are anchored
  (`getByRole('link', { name: /^Specs$/i })`, `/^Approvals$/i`), and every `toHaveCount`
  assertion targets dropdown items, `spec-table-row-*` and `approval-item-*` — never nav
  items or routes. No screenshot/snapshot test exists; no test imports the locale files.
  Adding a `/harness` and `/overview` route, two nav items and en-only keys is additive
  and breaks nothing. `validate-i18n.js` only checks interpolation-variable consistency
  across locales (:43-78), so en-only keys pass; `fallbackLng: 'en'` covers the other ten
  locales at runtime. Safe.
- **Tasks 16, 17, 18** (edit `sdd-continue/SKILL.md`, `formats.md`, four phase
  `SKILL.md`, `docs/SDD-HARNESS.md`). Prose; no test asserts their line counts or key
  lists. Added `run.start` keys (`overrides`, `setup`) appear only when a run applies the
  file, and `buildModel` ignores unknown JSONL keys, so a run with no file behaves as
  today (Req 2.11). Verified by grep + `claude plugin validate --strict`. Safe.

The document's global claim (line 6) that "no task adds or removes … a counted list
member … that another file asserts" holds: tasks 12/13 do add `navigationItems` members,
but nothing asserts that list's length.

## Findings

### R2-1 — Task 13's dependency on task 12 is unstated in the dependency order — MINOR (Novel, carried)

The dependency-order paragraph (line 6) says only "tasks 12 and 13 use tasks 10 and 11",
grouping 12 and 13 as siblings with the same upstream. But task 13's `_Prompt` places its
nav item "after the task 12 item" and both tasks edit the same three files (`App.tsx`,
`PageNavigationSidebar.tsx`, `en.json`). Task 13 therefore has an implicit file-level
dependency on task 12 that the narrative omits — a missing dependency edge under the
ordering attack surface. Impact is low: tasks run in numeric order (12 before 13), both
are build-only frontend tasks, and the worst case of ignoring the edge is a cosmetic
nav-item order, not a functional break or a suite failure. Record the 13→12 edge for
completeness; it does not gate implementation.

## Atomicity / coverage (assessed, no finding)

- Task 5 is large (admission + launch steps 1–5 + liveness + its test matrix), but D3
  deliberately split the launcher into tasks 5 and 6 for exactly this reason; the split
  is bounded and sound. No over- or under-sized task found.
- Component coverage is unchanged from v1 (line 4 maps C1–C10 to tasks 1–18; 19–20 carry
  the Testing Strategy). `coverage-component` was machine-clean. No hole.
- No new external dependency (gate B) and no over-reach past the approved requirements
  (gate C) in any task; the v2 delta touched neither. No `[gate-b]`/`[gate-c]` finding.

## Test: lines

The v2 delta touched no `Test:` line. Round 1 verified all twelve calls exist in the
design interfaces or an earlier/this task's prompt and are assertable with requirement
values. Re-confirmed unchanged. No miss.

## Top risks / gaps

1. None blocking. The one delta (R1-1) is correctly fixed and matches its `_Leverage`.
2. R2-1 (MINOR): the 13→12 edge is implicit; numeric order enforces it.
3. No cost-of-touching break: every existing suite (vitest and the separate e2e suite)
   stays green under additive edits with anchored selectors.

## Top conclusions to challenge

1. **"No task needs a bridge … each uses only artefacts an earlier task creates" (line
   6).** Holds for the fresh lens too — every edited file's existing tests are named or
   uncovered; no forward artefact use introduced.
2. **The R1-1 lint-regression is closed.** True: `_Prompt` and `_Leverage` now cite the
   same, content-supporting range.
3. **"No task changes a count or a length that another file asserts" (line 6).** Verified
   against the e2e and vitest suites: the only counted lists edited (nav items, locale
   keys, run.start keys) are asserted nowhere.

## What's missing before acting

Nothing blocking. Optionally add the 13→12 dependency edge to the ordering paragraph
(R2-1, MINOR). No structural, atomicity, coverage, ordering, gate-B/gate-C, or
cost-of-touching gap requires work before implementation.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
