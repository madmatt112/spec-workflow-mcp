# Adversarial Analysis — dashboard-project-list/tasks (v1, round 1)

Primary attack surface: **atomicity, ordering, coverage**. First review, so no deltas
precede v1 except the lint pass. I re-verified the lint-changed lines first (the whole
`## Changes since` section), then applied a full atomicity/ordering/coverage lens.

## What I checked, and how

- **Every code citation the tasks make, both ends of each range**, against the worktree
  tree. All resolve:
  - Task 1: `git-utils.ts` `gitCapture` 64-71, `normalizeIdentityPath` 101-112,
    `gitCommonDirAbsolute` 133-139 (`mainTree` = parent of `normalizeIdentityPath(resolve(ws,raw))`
    reproduces this exactly), `resolveGitRoot` 214-252 (shared-root override), `isGitWorktree`
    260-270 (non-`.git` test). The reimplementation matches the helpers it declines to call.
  - Task 4: `cleanupStaleProjects` 474-504, dead-pid rule 479-496, `registry-lock.test.ts`
    held-lock pattern 293-306 (that test uses `timeoutMs:200`; the task's call uses the 5000 ms
    default, hence the 15000 ms per-test timeout — consistent, D4).
  - Task 5: `rememberProject`/`forgetProject` 460-474 (both currently unlocked),
    `withStoreLock` 559-570 (the throw-on-miss model the new `withProjectsLock` copies). Grep
    confirms the ONLY callers of both are in `project-manager.ts` (addProject 242, addProjectByPath
    376, removeProjectById 392), so "no other caller changes" holds.
  - Task 6: `ProjectContext` 11-22 confirms `workflowRootPath` is the **original/untranslated**
    workflow root (the field getProjectsList adds); `getProjectsList` 301-313 returns only
    `projectPath`; `removeProjectById` 389-393 current order is removeProject→unregister→forget
    (task reverses to forget→unregister→sync, dropping removeProject). Durable-test line 87 reads
    `toBe(2)` and line 115 reads `toEqual([id])` — both as the task states they change.
  - Task 7: `CLI_FLAGS` 164-177 (no `--no-register` yet; BOOLEAN_FLAGS derives automatically),
    `parseArguments` return 206-221, help OPTIONS 37-65, `server.initialize` 160-165 (4 params),
    registration block 185-195, `stop` 280-306 guarded by `registeredProjectId` at 289,
    index-args.test.ts boolean-list 167-169 and rejection loop 172, CONFIGURATION.md rows 20-21
    and boolean sentence 29. All present.
  - Task 8: `runCases`/inline server 141-198 (`args:[dist/index.js, fixture.root]` at 194 — the
    flag appends after the root), `runner.test.ts` writeScript 90 / makeLiveCheckout 99 /
    stub-step case 162, `server.ts` stdin-end 234-236, `vitest.setup.ts` per-worker
    SPEC_WORKFLOW_HOME 24. `tsx` is a real devDependency (^4.7.0, used by `npm run dev`) — **no
    new dependency, no gate-b**.
  - Tasks 9/10: `shell-feed.ts` flush 84-142, spec-row loop 94-101, waits/runs reads 103-115;
    `now-model.ts` `buildNowModel` 186-219 (return object gains `sidebar:[]`); server `NowModel`
    62-69; shell-feed stubs 127-134 and 337-342 (neither sets a workflow root). `Wait` (14) and
    `LiveRunRow` (28) both carry `projectId`, so `buildSidebarRows` keying `now.waits`/`now.live`
    by project id is implementable.
  - Task 12: `frontend-style-scan.test.ts` exists (R5 AC8 guard valid).
- **Requirement coverage**: every AC R1.1–R7.5 is tagged on at least one task. R3 AC2 is the one
  AC on no `_Requirements:` line; task 8 and the design both carry it as a by-construction
  invariant (only the dashboard writes `projects.json`, none runs in that test). `coverage-*`
  lint passed; acceptable.
- **Success-clause coverage (retro P7)**: for all 12 implementing tasks, every test the `Task:`
  body names also appears in the `Success:` clause. No silent drop.
- **`Test:` seams**: each call exists in design interfaces (`linkedWorktreeInfo`, `computeFolds`,
  `isPathMissing`, `cleanupStaleProjects(isMissing)`, `pruneMissingProjects`, `buildSidebarRows`,
  `groupByStore`) or is the e2e test itself; class names `ProjectRegistry`/`ProjectManager`
  confirmed. Success criteria are assertable with requirement-stated values.
- **Ordering**: 1–5 (leaf pieces) → 6 (wires them) → 7 → 8 (needs the flag) → 9 → 10 (both edit
  `flush`, disjoint regions) → 11 → 12 (needs task-10 server rows + the frontend type copy the
  task-11 Bridge defers) → 13 (gate). Sound. The task-11 Bridge line and the backtick-wrapped
  `Test:` lines (the only v1 deltas) are accurate.

## Topics attacked

1. **Task 6 atomicity (the big wire-up).** It reworks `initialize`, deletes two loaders,
   rewrites `syncWithRegistry`, adds serialization + 100 ms debounce, changes
   `addProjectByPath`/`removeProjectById`/`getProjectsList`, and owns 9 scenarios. Challenged as
   over-large — but splitting it would create non-green intermediate states (e.g. deleting
   `loadRememberedProjects` without the reconcile replacement breaks `initialize`). It is the
   minimal cohesive integration unit; the preamble already plans a verifier for it.
2. **Tasks 4/5 "no caller, behaviour unchanged".** Challenged: both wrap existing,
   actively-called functions in a lock NOW. Observable list behaviour is unchanged in normal
   operation (lock acquired), and the new predicate/throw paths are inert until task 6 — so the
   claim holds in substance, but the "no caller" phrasing is loose (MINOR R1-2).
3. **Task 9 representative rule vs. the stubs.** `groupByStore` picks the project whose
   `originalProjectPath == workflowRootPath`; the shell-feed stubs set neither. For existing
   one-project-per-store stubs the fallback (name→id) picks the sole project, so spec-row ids are
   unchanged — consistent with "no asserted value changed".
4. **Task 10 fills `sidebar` after `buildNowModel`.** `buildNowModel` runs at flush:92 before
   waits/runs are read at 103-115; the task mutates the already-built `nowModel.sidebar` after
   115 and before `shell-now` is sent at 133. Feasible. No existing shell-feed test deep-equals
   the shell-now `data` (they read `.data.waits`/types only), so the new key breaks nothing.
5. **Task 7 value-rejection framing.** The body says `--no-register=1 is rejected by the existing
   loop at 172`; that loop tests `=true`/`=false`, not `=1`. The parser (index.ts:240) does
   reject any `=value` on a boolean, and the registry-driven loop auto-covers the new flag's
   `=true`/`=false` — so the outcome is correct, only the example value is imprecise (MINOR R1-1).

## Findings

- **R1-1 (MINOR, Novel) — Task 7 value-rejection example is imprecise.** The body claims
  `--no-register=1 is rejected by the existing loop at 172`, but that loop asserts only `=true`
  and `=false`. Correct outcome (parser rejects every `=value`; the loop auto-covers the new
  flag), wrong exemplar. Reword to `--no-register=true/=false rejected by the loop at 172`.
- **R1-2 (MINOR, Novel) — Preamble "with no caller" overstates tasks 4/5.** Both modify
  functions that have live callers and add lock acquisition / throw-on-lock-miss. Observable
  behaviour is unchanged, but the phrasing reads as "inert code"; tighten to "the new predicate
  path is inert until task 6."

Neither causes rework; implementers reach the correct result from the Success clauses either way.

## Top 3 risks/gaps

1. Task 6 is the single highest-risk unit (central reconcile, 9 scenarios). Already flagged for a
   verifier — no change needed, just the top watch item.
2. Tasks 11 and 12 share one e2e file with different harness shapes (11: two worktrees, no main;
   12: main + one worktree + seeded run/wait). D2 pins one shared setup; sequential mutation is
   workable but is the most brittle test surface. Not a defect.
3. R3 AC2 is proven only by construction, never asserted. Acceptable (no writer runs), but it is
   the one AC with no red test behind it.

## Top 3 conclusions to challenge — and why each stands

1. "Behaviour is unchanged until task 6" — substantially true for observable behaviour; only the
   locking phrasing is loose (R1-2).
2. "No `-Test:` seam for task 13" (D7) — correct: a measurement task whose pass criterion is the
   suites running green cannot red before the code exists; implementer-only is right.
3. "`--no-register=1` rejected by the loop at 172" — the conclusion (value form rejected) is
   right; the mechanism cited is slightly off (R1-1).

## What's missing before acting

Nothing blocking. Optional polish: the two MINOR rewordings above.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
