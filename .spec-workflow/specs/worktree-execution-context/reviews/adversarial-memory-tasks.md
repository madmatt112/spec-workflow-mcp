# Adversarial Review Memory — tasks
Last updated: 2026-07-30 (after v2 review)

## Cumulative Findings Summary

### Accepted
_(No user response recorded yet for either round. The entries below are findings the **document
itself** resolved between v1 and v2 — treated as accepted-in-substance and verified closed at v2.)_

- **Missing dependency graph** (v1): a `_Depends:_` line was added to every task. Graph is
  acyclic; numeric order is a valid topological order. Closed in structure — but see Unresolved
  (the field is not parseable by this repo's tooling).
- **No fixture task** (v1): task 1 now builds the unit-level git fixture and owns R7 AC 1,
  including `-c protocol.file.allow=always`. Closed in ownership; see Unresolved for capability
  gaps.
- **Parity test scheduled last** (v1): task 2 is now a front-loaded characterization test at
  position 2 with an explicit "must pass on the unmodified tree" restriction. Closed in form;
  see Unresolved for the maintenance gap.
- **Registry lock at position 16** (v1): moved to position 4, before the change that creates the
  race. Task 4 now names the ENOENT-vs-EEXIST case, rejects `isProcessAlive`, requires
  `mtime`-based staleness and an atomic rename-aside break, and forbids throwing. Closed.
- **`AdversarialRunner` contradiction between old tasks 13 and 14** (v1): resolved via R5 AC 5's
  private-spawn-helper form; tasks 6 and 7 now carry it consistently. Closed.
- **Typecheck undercount and shared `tsbuildinfo`** (v1): task 10 now enumerates all five root
  uses, requires the second parameter, keys the cache file per workspace, and lists
  `typecheck.test.ts` with its twenty-five call sites. Closed (one line-number drift remains).
- **`index-args.test.ts` untested parse change / wrong assertion count** (v1): task 5 now lists
  the file and correctly says three call-graph assertions (requirements.md still says four).
  Closed in tasks.md.
- **`isGitWorktree` unscrubbed** (v1): task 3 now names all three git calls in `git-utils.ts`.
  Closed.
- **`filesToReview` shape split across three tasks** (v1): merged into task 9 with the
  options-object conversion sequenced first. Closed, and the sequencing argument is correct.
- **Sync/async `validateProjectPath`** (v1): resolved — validation moved into `initialize`,
  falling back with a log rather than throwing. Closed.
- **`--flag=value` semantics** (v1): resolved to loud rejection naming the bare form, for all
  three booleans. Closed.

### Partially Accepted
- **R5 AC 9 / R5 AC 10 coverage** (v1): genuinely guarded by task 16 via R7 AC 9, with a
  falsifiable mutation-style criterion. But no `_Requirements:_` line cites `5.9` or `5.10`, so
  a mechanical traceability sweep still shows a gap.
- **All-drop disclosure must be actionable** (v1): R4 AC 20 and task 11 were strengthened from
  "add a note" to "replace both instructions" — but they enumerate two of four read-every-file
  sites and miss the two that are golden-pinned. Partially closed; see Recurring.

### Rejected
_(None — no user response has been recorded for v1 or v2.)_

### Unresolved
- **Task 8 ends build-red.** `safeRealpath`'s move + return change breaks `validateAllFiles`
  (`review-task.ts:49`, `:64-70`) and four `safeRealpath` assertions. R7 AC 6 (ten call sites,
  two `warnOnce` assertions, containment warning text) is cited by no task. **v2, highest
  severity.**
- **17-fixture golden pin + two-way drift test on `buildReviewMethodology`.** Tasks 11 and 12
  both must break it; neither names a test file or a fixture. Drift test skips in CI, runs
  locally. **v2.**
- **`playwright.worktree.config.ts:14` `testMatch` pins the old spec file**, so task 15/15.1's
  new suite never runs under `test:e2e:worktree` and *does* run under `test:e2e` without
  `SPEC_WORKFLOW_HOME` isolation. Neither task lists either config. **v2.**
- **Task 15's harness does not commit to concurrent start**, which 15.1's registry-lock scenario
  requires (`startMcpServers` barriers on `waitForProjects(1)`). **v2.**
- **Six route sites, four `ProjectContext` path fields, one disambiguating warning.**
  translated vs untranslated is undecided for five of six slots. **v2.**
- **`_Depends:` is not a field `task-parser.ts` recognizes**; it lands in
  `implementationDetails`, which never reaches `taskContext` or any `_Prompt:` text. **v2.**
- **Task 2's `projectId` assertion is expected to fail at task 14 by design** (Migration), on a
  machine-dependent basis, with no stated rule for distinguishing that from a regression.
  Task 9 — the largest parity risk — carries no parity criterion. **v2.**
- **Task 1's fixture capabilities do not cover tasks 3 and 8**: no second unrelated repository,
  no two non-git directories, no `.spec-workflow` seeding under the main repo, no per-worktree
  file create/delete, no symlinked *workflow* root. **v2.**
- **Tasks 7, 11, 12, 13 have behavioural success criteria and no test file.** Recurrence of v1's
  rejection of old task 3. **v2, escalated.**
- **`{} as ToolContext` at `spec-index.test.ts:79`** violates R3 AC 4 and is invisible to task
  6's stated enumeration mechanism (`tsc`). **v2.**
- **Line-number drift not corrected from v1**: `task-review-runner.ts:281` (actual `:283`) and
  `typecheck.ts:153` for the spawn cwd (actual `:154`). **Escalated at v2.**
- **Count errors**: header says "Fourteen tasks" (eighteen checkboxes); task 6 says "ten files"
  (nine). **v2.**
- **Mis-citation**: task 17 cites `7.7` (an `index-args.test.ts` criterion); task 10 cites `4.6`
  (a Migration/docs criterion) with no matching success criterion. **v2.**
- **Registry lock residual dropped.** The design acknowledged that `unregisterProject`,
  `unregisterProjectById` and `cleanupStaleProjects` remain unlocked writers; tasks.md carries
  no such note, and task 14 adds a new call path through one of them. **v2.**
- **Decisions dressed as deliverables**: task 13's "state whether [the memo cache] is bounded"
  and task 14's "decide explicitly whether `readRegistry:106`…" have no verifiable artifact.
  Six such instructions exist, not two. **v2.**

## Patterns & Themes

- **Fixes migrate the defect one layer out rather than closing it.** v1 found the all-drop
  disclosure was cosmetic; v2 finds the replacement covers two of four instruction sites. v1
  found no dependency field; v2 finds a dependency field the parser does not read. v1 found the
  parity test scheduled last; v2 finds it scheduled first with no owner for keeping it green.
  Every round, the prose about the problem grows and the enumerated site list stays one short.
- **The document's authority is exact counts, and roughly one count per round is wrong.** v1
  caught "four assertions" (three) and the three-vs-five typecheck root uses. v2 catches
  "Fourteen tasks" (eighteen), "ten files" (nine), and two line references v1 had already
  corrected but which were never propagated from requirements.md/design.md into tasks.md.
  **Citations flow downward from requirements → design → tasks and are never re-derived.**
- **Test infrastructure is the systematic blind spot.** Four tasks have behavioural criteria and
  no test file. Three separate committed test artifacts — the 17 methodology fixtures, the eight
  `task-review-runner.test.ts` prepare mocks, and the `overrides.typecheck` positional signature
  in `review-task.test.ts:874` — are invalidated by tasks that list neither the file nor the
  artifact. All three are invisible to `tsc` because the surrounding types are `any`.
- **"Indivisible" is asserted where the compiler forces it and omitted where it also would.**
  Task 6 proves indivisibility empirically and then merges non-coupled work into it; task 8
  asserts indivisibility for the half it names and splits the half the compiler actually forces.
- **The document reasons well about single call sites and poorly about *sets* of call sites.**
  Every finding about "there are N sites, not M" recurs: git invocation sites (2→3), typecheck
  root uses (3→5), adversarial routes (2→4), read-every-file instructions (2→4), path fields per
  route slot (1→2).

## Guidance for Next Review

**Focus areas**
1. **Re-derive every remaining count and line number against the tree, including ones a prior
   round confirmed.** `:281`/`:283` and `:153`/`:154` were correct in v1's analysis and wrong in
   v2's document — corrections do not propagate.
2. **Follow every changed value into its committed test artifacts**, especially untyped ones:
   golden fixtures, `vi.mock` factories with `...args`, and mocked response `data` objects. This
   is where three of v2's five top risks live and where `tsc` gives no signal.
3. **For each task, ask "where does this assertion live?" before "is this assertion right?"**
   Four tasks currently have nowhere to put theirs.
4. **Check whether a fix enumerates all instances of the pattern it names.** The recurring shape
   is N-1 sites listed. Apply it to any new enumeration the next revision introduces.
5. **Check runner/config wiring for new test files** — a new spec file, fixture directory or
   test helper needs a config that will execute it. `playwright.worktree.config.ts` and
   `vitest`'s include globs are both worth a look.
6. **Verify that anything the design acknowledged as a residual survives into tasks.md.** The
   registry-lock residual was dropped in translation; check whether others were.

**Well covered — do not re-examine**
- The `ToolContext` 19/20 error split and the indivisibility of the twenty construction sites.
  Verified empirically at v2; the claim is exact.
- The `_Depends:` graph's acyclicity and topological validity. Verified.
- Task 4's lock design (ENOENT vs EEXIST, `isProcessAlive` rejection, `mtime` staleness, atomic
  break, no-throw). Grounded and complete against the code.
- Task 10's five typecheck root uses, required second parameter, and per-workspace cache key.
- Task 9's options-object-before-field-insertion sequencing and its `new Set` / `.map` analysis.
- Task 3's three-git-call scrub in `git-utils.ts`.
- The four dashboard route line numbers and `ProjectContext`'s field inventory — re-verified at
  v2, unchanged since v1.
