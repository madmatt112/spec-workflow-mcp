# Adversarial Analysis — review-gate/design (v1)

Round 1. Target: `.spec-workflow/specs/review-gate/design.md` (v1). Checked against the
approved requirements (v4), the decomposition entry (`### 4. review-gate`), and the
codebase the document cites. Fresh lens applied: cold read for internal contradictions
plus a truth table of `scoreRisk`/`decideGate` against the ACs, and a live probe of the
git commands Component 5 specifies.

## What I verified (and is fine)

- **Artifact citations are almost all exact.** I read both ends of every cited range:
  the dispatch and schema of `src/tools/review-task.ts` (`:160-162`, `:179-183`,
  `:178-223`, `:224`, `:251-260`), `handlePrepare` (`:347-366`, `:431-432`, `:440-449`,
  `:493-498`), `handleRecord` (`:532-582`, `:585-603`), `task-review-manager.ts`
  (`saveReview :108-132`/`:126`, `reviewToMarkdown :185-234`/`verdict:` at `:195`,
  `parseReviewMarkdown :236-311`/`get() :243-246`/return object `:307`,
  `getNextVersion :62-66`, `validateVerdictConsistency :10-27`, marker `:71-103`),
  `types.ts` `TaskReview :253-262`, `typecheck.ts` (`:8-15`, `:17-47`, `:49`,
  `:124-140`, env `:187`), `hygiene-signals.ts` (`:4-19`, `:21-44`, `:46-50`),
  `task-parser.ts` (`lineNumber :112`, `:153`, checkbox `:167`, `endLine :175`, metadata
  loop), `task-diff.ts` (`runGit :36-48`, `computeTaskDiff :135-234`, `parseNumstat
  :263-291`/`:277`), `path-utils.ts :208-210`, `root-selection.ts :51-56`/`:202-221`,
  `git-utils.ts :45-51`, `adversarial-settings.ts :61-141`/`:183-206`,
  `get-task-review.ts :106`/`:129`, `spec-status.ts :179-193`, `ledger.ts
  :94-99`/`:281`, `implementation-log-manager.ts :461`, and the harness edits
  (`sdd-verifier.md:26`, impl `briefs.md:66-82`/`:112-131`/line 124/`:133-137`, closeout
  `SKILL.md:66-72`/`:118-131`, closeout `briefs.md:5-14`/`:112-158`, both orchestrator
  tool lists, `SDD-HARNESS.md:75-78`/`:233-238`, `TOOLS-REFERENCE.md:399-453`). None of
  these is misstated.
- **`runProjectTypecheck` always returns ≥1 result** (every early return is a
  single-element array), so `worstTypecheckState(results.map(...))` never sees an empty
  array. No latent crash there.
- **The `scoreRisk`/`decideGate` truth table is well-formed.** `gate` and `risk` are two
  independent "any rule fires" reductions, so every input yields exactly one `gate` and
  one `risk`. Rules a–g map cleanly onto ACs 3.1(a-f) and 4.1(a-e); `console/todo/fixme`
  and `unavailable/timeout` are correctly excluded from `decideGate`. The
  `TYPECHECK_STATE_RANK` ordering makes "worst state is `unavailable-other`/`timeout`"
  equivalent to AC 4.6's per-result "any result unavailable/timeout" (nothing ranks below
  those two). Rule-b diagnostics are read per-result from raw `TypecheckResult` (in
  `core`), so no `core`→`tools` import is forced.
- **NO_LIST_REASON**, `parseSensitivePaths` end/normalisation, and `isSensitivePath`
  prefix/exact matching agree with AC 2.2-2.4 and parse the live six-bullet list (whose
  prose line under the heading is correctly ignored).

## RE-DECIDED judgments requested by the prompt

- **RE-DECIDED 1.4 (D17, HEAD fallback via the baseRef path, untracked included):
  PERMITTED REFINEMENT.** The HEAD fallback only occurs in task mode with no
  baseRef/commit/files, where rule f forces `risk: high` unconditionally. Including
  untracked files cannot flip that outcome, errs conservative, and collapses two code
  paths into one. The one observable divergence (a `debugger` in an untracked new file
  can fail the gate) is itself conservative. No conflict with an approved AC in practice.
- **RE-DECIDED 3.1 (D21, rule g hygiene-rejection ⇒ high): PERMITTED REFINEMENT.** NFR
  Reliability already requires every degraded input to resolve to `risk: high`; a hygiene
  rejection is a degraded input. It is near-unreachable (`scanFile` swallows per-file
  errors, so `computeHygieneSignals` rarely rejects), but harmless and aligned.

## Findings

### R1-1 — MUST_FIX — `-m --first-parent` does not give a first-parent-only diff (Novel)

Component 5 specifies commit-mode range as
`git -c core.quotePath=false diff-tree --numstat -r --root --no-renames -m --first-parent <commit>`
and the Testing Strategy asserts "a merge commit (first parent only)". This is a false
claim about git behaviour (git 2.43.0, the version in the design's own probe). Live probe
on a merge `M` whose first parent added `mainfile.txt` and whose second parent added
`sidefile.txt`:

```
$ git diff-tree --numstat -r --root --no-renames -m --first-parent <M>
<sha>
1	0	sidefile.txt
<sha>
1	0	mainfile.txt      <-- second-parent delta; should not appear
```

The true first-parent diff (`git diff <M>^1 <M>`) is `sidefile.txt` alone. `-m
--first-parent` produced output identical to `-m` alone; `--first-parent` without `-m`
printed nothing. So `--first-parent` has no effect on `diff-tree -m` here — the command
emits every parent's diff and repeats the sha header once per section.

Consequences when a merge sha reaches commit mode (a `commit` is a public tool input, and
close-out passes arbitrary item shas): `parseNumstat` sets `filesChanged` once per numstat
line, so it counts 2 where the first-parent diff is 1; a file that differs from *both*
parents is line-double-counted (the `perFile` Map dedupes the path but `filesChanged`/
`linesAdded`/`linesRemoved` accumulate per line); and `touched` gains files
(`mainfile.txt`) that are not in the first-parent diff. Wrong `stats` feeds rule b
(line-count) and wrong `touched` feeds rule a (sensitive-path), rule d (file-outside-list)
and `isTestPath`/rule c. A correct first-parent-and-root command exists and was verified:
`git log --first-parent -1 --numstat --format= --no-renames <commit>` yields exactly
`sidefile.txt` for the merge and `base.txt` for a root commit (and emits no sha header, so
the `:277` skip is moot). Fix the command and the merge test's expectation.

### R1-2 — MUST_FIX — files-only detection ignores task/item mode; a task gate can record a pass with zero checks (Novel)

Component 2 step 3 defines `filesOnly = !commit && !baseRef && files.length > 0` with no
task/item guard, and step 6 makes the files-only path skip typecheck, hygiene and the diff,
set `stats = null`, and the risk table then "Files-only skips `scoreRisk` and reports
`low` (7.2)". Step 2 puts a call into **task mode** whenever `taskId` names a task and a
log exists — it does not require `baseRef`/`commit`/`files`. So a task-mode call carrying
only `files` (no `baseRef`, no `commit`) satisfies `filesOnly`, takes the files-only path,
forces `risk: low`, and — being task mode, `gate: pass`, `risk: low` — **records a
`reviewer: gate` pass with no typecheck, no hygiene, no diff, and no sensitive-path
scoring** (step 9).

This contradicts approved AC 3.1(a) (a task touching a sensitive path SHALL be `high`) and
the "files-only **item** gate" scoping of AC 1.3 / 7.2, and it opens a
record-a-pass-without-verification path. The document's own prose already treats
files-only as item-only ("reports `low` (7.2)", "Item mode sets c and f false"), so this
is an internal contradiction between the stated intent and the detection logic. Restrict
`filesOnly` to item mode (task not found), or force any task-mode call lacking a git range
onto the HEAD-fallback (rule f) path.

### R1-3 — SHOULD_FIX — the 200-char cap on `data.reasons` is defined but never wired (Novel)

AC 1.7 requires every `data.reasons` string ≤ 200 chars, and `GateData` annotates
`reasons` as "at most 200 chars". Component 4 defines `truncateLine(s)` "(1.7)", but no
step states where it is applied. `scoreRisk`/`decideGate` are specified as pure functions
returning reason strings, and step 8 just concatenates them (`reasons = [...verdict.reasons,
...risk.reasons]`); nothing truncates. Rule a's template
`check-failed: <command> exit <code> — <output>` concatenates a caller command string
(which can be a long scoped `npx vitest ...` line) with an output already allowed up to 200
chars, so the assembled line routinely exceeds 200 and violates AC 1.7. State that every
`data.reasons` entry passes through `truncateLine` (and name the site: inside each rule, or
at response assembly).

### R1-4 — MINOR — rule d compares `files` and `touched` with no stated normalisation (Novel)

`decideGate` rule d fires when "`files` given and a `touched` path is not in it".
`touched` paths are git-normalised (forward-slash, relative to `root`); `files` is
caller-supplied and `isSensitivePath` is the only place normalisation (strip backticks /
leading `./`) is specified. A `files` entry written `./src/foo.ts` or as an absolute path
will never equal the git-relative `touched` entry, producing a spurious `file-outside-list`
failure. Specify the same forward-slash/relative normalisation for the rule-d comparison.

### R1-5 — MINOR — whole-file `debugger` scan can spuriously fail store/home doc items (Novel)

`computeHygieneSignals`→`scanFile` scans any readable file line-by-line for
`/\bdebugger\b/`, regardless of extension. A close-out `store`/`home` item whose commit or
listed file is Markdown that contains the token "debugger" in prose (plausible in this
repo's own harness/spec docs) trips `decideGate` rule c → `gate: fail` → a fix round, even
though `store`/`home` items are meant to close trivially. Note the limitation or scope the
`debugger` rule to code-like paths for item gates.

## Top 5 risks/gaps

1. Merge/commit range command over-reports (R1-1): wrong `stats`/`touched` on any merge
   sha; the merge test would fail against real git.
2. Files-only path is reachable in task mode (R1-2): records an unverified `pass`,
   contradicting AC 3.1(a).
3. `data.reasons` can exceed the AC 1.7 200-char cap because `truncateLine` is unwired
   (R1-3).
4. Rule-d and rule-a path comparisons assume a normalisation that is only specified for
   `isSensitivePath` (R1-4).
5. Hygiene `debugger` is whole-file and prose-blind (R1-5).

## Top 3 conclusions to challenge or reverse

1. **"a merge commit (first parent only)"** — reverse. The chosen `diff-tree -m
   --first-parent` shows all parents (probe above). Use `git log --first-parent -1
   --numstat --format=`.
2. **"Files-only skips `scoreRisk` and reports `low`"** applied through a mode-agnostic
   detector — challenge. It must be gated on item mode, or a task gate can bank a low pass
   with no checks.
3. **"reasons … at most 200 chars"** — challenge. Nothing in the flow enforces it;
   `truncateLine` exists but is never called.

## What's missing before acting on this document

- Replace the commit-mode git command with a first-parent-correct, root-safe one and fix
  the merge-commit test's expected `touched`/`stats`.
- Add an item-mode guard to `filesOnly` (or reroute task-mode-no-range to the HEAD
  fallback) so no task gate records a pass without running the pre-computations.
- State the exact site where every `data.reasons` line is truncated to 200 chars.
- Specify path normalisation for the rule-d `files`↔`touched` comparison.
- Acknowledge the whole-file `debugger` scan's effect on store/home doc items.

## Verdict

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
