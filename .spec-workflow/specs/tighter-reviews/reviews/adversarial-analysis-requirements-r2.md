# Adversarial Analysis — `tighter-reviews` Requirements (v2)

Target: `requirements.md` (post-v1-revision, with new R3).
Memory consulted: `adversarial-memory-requirements.md`.

Findings are classified as **Novel**, **Compounding**, or **Recurring**. Recurring findings are escalated.

---

## 1. Requirement 3 — Per-runner model selection

R3 is brand new and has had no adversarial pass. It is also the requirement most likely to ship a wedge that future work has to chip out.

### 1.1 The precedence matrix is under-specified at the type boundaries — **Novel**

R3.1–R3.5 read like a clean cascade ("specific overrides general; legacy fills in the gaps"). The matrix is much messier than the prose admits:

- **Empty string.** R3.6 says non-string values are "ignored as if absent." Empty string `""` is a string and therefore not ignored. What does the dashboard pass? `--model ""` to the `claude` CLI is almost certainly an error or a no-op. The user who explicitly wrote `"models": { "adversarial": "" }` clearly meant something — most likely "disable the override and fall back to legacy" — but R3.5's precedence rule says `models.adversarial` takes precedence, so the empty string wins and the runner crashes or silently uses CLI default. There is no third "explicitly cleared" branch.
- **`models` as a string.** R3.6 covers `models` not being an object. A user typo like `"models": "claude-opus-4-7"` (forgetting the per-runner shape) is silently ignored — but the legacy `model` field also might not be set, so both runners get `undefined` and the user sees no error, no warning surfaced anywhere visible, just a behavior change. The "single warning, one per malformed-load event" (see §1.4) is a server-log event the user almost never sees.
- **Truthy non-string `models.<runner>`.** R3.6 covers `models.<runner>` not being a string (numbers, arrays, nested objects). Fine. But it does not cover `models` having extra unrecognized keys (`models.codeReview`, `models.adversarial2`). Are those silently ignored, warned about, or rejected? The spec is silent. This matters because a future `tighter-reviews-2` spec that adds a third runner will want to extend `models` — and the silent-ignore default determines whether old servers running a newer config crash or coast.
- **`null` vs. absent.** Standard JSON gotcha. `"models": null` is not an object (R3.6 path) but is also not "absent" (R3.2 path). The two precedence rules give different outcomes; the spec picks neither.

These edge cases will all surface in the wild within months because users author this file by hand.

### 1.2 Settings-read timing is unspecified — **Novel**

R3.8 mandates "one settings-read helper, called by every site that constructs runner options." That tells you *where* the helper is called but not *when* the file is read.

Three plausible models, each with a different bug:
- **Read once at server startup.** Editing `adversarial-settings.json` while the dashboard is up has no effect until restart. Users will edit the file mid-session and be confused when the model doesn't change.
- **Read on every runner construction.** Then a malformed file (R3.6) emits a warning per request, not "one per malformed-load event" as R3.6 promises. The promised quietness is a lie.
- **Read on file-mtime change.** Adds an fs.watch and a debounce concern that the spec does not mention.

The retry path at `multi-server.ts:950` makes this worse: an in-flight retry that re-reads settings can pick up a different model than the original attempt, producing a single review whose two phases used different models. The spec's "use the same precedence logic" instruction does not address this.

### 1.3 File name vs. file scope is a discoverability bug, not a renaming-cost decision — **Novel**

The OOS note says renaming `adversarial-settings.json` is "a churn-cost we don't pay." This frames it as cost-vs-benefit on the rename. It is not. It is a discoverability bug:

- The file is now the configuration surface for both runners.
- A user who installs the package and wants to set the task-review model will search docs for "task review model" or grep their working tree for `taskReview`. They will not find a file called `adversarial-settings.json`.
- The R3.7 escape hatch ("documentation surfaces the new shape as preferred") doesn't help — R3 doesn't own a docs deliverable, and there's no requirement that the file's name or its in-file documentation reflect its broader role.

This compounds with the v1 finding pattern of "out-of-scope deferrals are growing": the rename was punted to save churn, but the cost of *not* renaming is silent — users will simply fail to discover the feature.

### 1.4 "One warning per malformed-load event" is undefined — **Novel**

R3.6 says "log a single warning (one per malformed-load event) but SHALL NOT fail the request." What is an "event"?

If the dashboard reads settings on every runner construction (most likely, see §1.2), and the file is malformed, every request generates a warning. That is a log storm, not a single warning. If the spec means "one per file-mtime change" or "one per process lifetime," it should say so. Leaving this ambiguous lets the implementer pick whichever is easiest, which will almost certainly be "warn on every parse."

### 1.5 R3 forecloses on a clean per-runner shape for future overrides — **Novel**

The OOS note explicitly defers per-runner `cli` and `cliArgs` to a future spec. When that spec lands, the file shape is wedged between two incompatible scaling patterns:

- **Parallel sibling maps**: `models: {...}, cliArgs: {...}, cli: {...}`. Adds a new top-level key per setting. As the per-runner surface grows, the file fragments by *setting type* instead of *runner*, and the user has to read three keys to understand "what does the adversarial runner actually do?"
- **Grouped per-runner**: `adversarial: { model, cli, cliArgs }, taskReview: {...}`. Reads naturally but is *not* the shape R3 just shipped.

The spec picks the first shape without acknowledging the lock-in. When users start asking for `cliArgs.taskReview` (likely within months — Haiku and Opus want different `--max-tokens`), the maintainer faces a choice between (a) shipping the parallel-siblings shape that doesn't scale, (b) shipping a *third* shape and supporting all three legacy paths, or (c) a breaking change. The spec should at least acknowledge this and make a choice.

### 1.6 Retry-with-different-model is unspecified — **Novel**

R3.8 mandates the retry path uses the same precedence as the initial path. The retry path is *exactly* where users may want different behavior — the natural use case is "Opus failed, retry with a cheaper model so we don't burn another $5 on the same crash." The spec mandates "same logic" without acknowledging this is a real product question. Pick one: either retries are intentionally identical (justify why) or they're a separate config knob (defer it explicitly). Don't pretend the question doesn't exist.

### 1.7 No test pinning for the precedence matrix — **Compounding** (deepens v1 "methodology drift" pattern)

The v1 review pushed methodology directives into pinned test strings to prevent drift. R3 introduces five precedence rules + a tolerance rule + two callsites + a single-helper abstraction — and the spec does not require corresponding pinned tests. The drift risk that motivated string-pinning for methodology now applies to precedence, with no analog mitigation. A future PR that "simplifies" the helper can flip `models.adversarial` taking precedence over legacy `model` to the reverse, and nothing fails CI.

---

## 2. Coverage gaps that survived v1

### 2.1 Empty `typecheckDiagnostics: []` still indistinguishable from "tsconfig excluded the file" — **Recurring** (escalate)

v1 raised this; the spec's response was R2.6 (unavailable-with-reason) and R2.7 (no-parseable-output). Neither addresses the case where tsc *did* run successfully but the in-scope file was excluded by tsconfig `"exclude"` or never reached via the `"include"` graph.

Concrete failure: a project sets `"exclude": ["**/*.generated.ts"]`. The user generates a TypeScript client file, modifies it, and runs review. `tsc --noEmit` succeeds, `typecheckDiagnostics: []`, no `typecheckUnavailable` flag. The methodology emits *no* directive (R2.5 explicitly says no directive on empty). The reviewer sees clean signal where there is none.

The fix v1 implicitly suggested — `tsc --listFiles` or `--explainFiles` to surface the actual coverage set — was rejected without rationale. This is the same false-confidence failure mode that motivated the entire deterministic-shift thesis. Recurring without resolution. Escalate: the spec is now claiming "silent under-coverage is impossible to miss" (NFR Usability) while leaving this exact silent under-coverage open.

### 2.2 Non-empty-but-incomplete diff has no methodology branch — **Recurring** (escalate)

v1 raised the partial-commit case. The spec's response was the Coverage constraints note ("users who commit mid-task will see incomplete diffs and the methodology directs them to fall back to full-file reading"). Read R1.2 carefully — the four conditions for falling back to full-file reading are:

- (a) structural change (rename / split / refactor)
- (b) hunks span >50% of file
- (c) need surrounding invariants
- (d) `data.skippedPaths` lists a relevant file

**Partial-commit drift is none of these.** The methodology has no language pointing the reviewer at "the diff might be authoritative-looking but stale because of a mid-task commit." The Coverage constraints note tells the *user* about this; it does not tell the *reviewer LLM* anything, because the methodology never emits a directive about it.

This is the same defect, unfixed, given a documentation veneer. Escalate.

### 2.3 Rename detection still unspecified — **Recurring**

The spec mandates `git diff -U10 HEAD --` with absolute paths as pathspec (R1.1). It is silent on `-M` / `--find-renames` / `--diff-filter`. With explicit pathspec, git's rename detection is heuristic and pathspec-scoped: if `filesCreated` contains the new path but the old path is not in the pathspec (because the implementation log records only created/modified, not deleted), the deletion is invisible. The reviewer sees a bare 200-line addition with no context that it was a rename of an existing 200-line file.

The methodology's diff-present directive references "rename" as a structural-change trigger — but the diff format the spec produces will rarely surface renames as such. The directive's "rename" trigger is undetectable from the data the spec actually returns. Recurring; spec should either mandate `-M` plus an audit of the pathspec (include both old and new paths if `filesCreated` has the new and any deleted file with the same content), or remove "rename" from the directive's trigger list as misleading.

### 2.4 `allFiles` is the single coverage anchor for three independent computations — **Compounding** (deepens v1 "single coverage anchor" critique)

Hygiene scan, diff pathspec, and typecheck `inScope` tagging all derive from `allFiles = filesModified ∪ filesCreated` per the implementation log. If the agent under-reports modified files (already known to happen — that's what the partial-commit case is downstream of), all three computations narrow in lockstep. The reviewer sees a coherent-looking response across three signals that are all blind to the same set of files. There is no orthogonal check: a `git status` snapshot taken at prepare time would surface working-tree changes the implementation log missed, and the spec does not include one.

---

## 3. Methodology directive text quality

The directives are now load-bearing. Each one has wording bugs.

### 3.1 R1.2 diff-present directive — ambiguous structural triggers — **Novel**

Two specific failures:

- **"the change is structural (rename, file split, large refactor)."** The reviewer is told to detect renames from the diff, but as §2.3 establishes, the spec's pathspec'd `git diff` will not reliably emit `R` rename markers. The reviewer must therefore detect renames from semantic patterns (similar code blocks across files), which is exactly the hunting workload the spec was supposed to eliminate. The directive asks for a detection the data shape can't support.
- **"hunks span more than half the file."** Half *post-edit* or *pre-edit*? Adding 50 lines to a 100-line file produces hunks covering 33% of the post-edit file (50/150) and 50% of the pre-edit (50/100). Deleting 60 lines from a 100-line file produces hunks at 60% pre / 150% post (nonsensical). The threshold is undefined for the most common asymmetric edits. The reviewer has to invent a denominator. Pin the semantics: probably "added+removed lines / max(pre-edit lines, post-edit lines)" — but say so.

### 3.2 R1.3/R1.4 diff-empty fallback — embedded shell with placeholder — **Novel**

The directive embeds: `git log -p HEAD -3 -- <filesToReview>`.

- `<filesToReview>` is a JSON array in the response. The reviewer is an LLM. It must convert the array to shell-safe arguments. For paths with spaces, parentheses, or shell metacharacters this requires correct quoting. The directive is pseudo-shell; it does not specify whether the reviewer should `xargs -0`, quote each path, or use `--` as a separator.
- Worse: `filesToReview` is bounded by the same `allFiles` set that already failed to produce a diff. If the reason the diff was empty is "agent under-reported modifications," `filesToReview` is *also* under-populated. The fallback chain is "diff was empty? read these files" — but the file list is wrong for the same reason. The directive implicitly trusts a list whose untrustworthiness is the most likely cause of the diff being empty in the first place.

### 3.3 R2.4 typecheck-present — asks for an undecidable distinction — **Recurring** (escalate)

The directive instructs the reviewer to mark each in-scope diagnostic as (a) introduced by this task → finding, (b) pre-existing → note, or (c) spurious. The spec rejected `git blame` tagging as out of scope, so the reviewer is making the introduced-vs-pre-existing call by hand.

The "use `inScope: false` entries as upstream context" suggestion is undecidable in the most common case: a reviewer with 100 in-scope and 0 out-of-scope diagnostics cannot tell from the response alone whether (a) tsc found nothing wrong upstream, so this task is the source, or (b) nothing upstream uses these symbols, so there's no upstream context to surface. The directive asks the reviewer to draw a conclusion from the *absence* of out-of-scope signal, but the absence is equally consistent with two opposite causes.

This is the v1 "re-LLM-ifying via reviewer triage of introduced vs. pre-existing" finding (memory's Partially Accepted §4) restated as a directive. The spec acknowledged the trade but the directive doesn't acknowledge that the reviewer is being asked to do something the data doesn't support.

### 3.4 R2.6 typecheck-unavailable — degrades to the very behavior the spec was built to replace — **Novel**

The directive: "manually scan them for type errors and structural problems the typechecker would have caught: missing return types, implicit `any`, mismatched property shapes, unsafe casts."

This is a verbatim restatement of the LLM-hunting workload the introduction promised to eliminate ("the current methodology asks the reviewer to look for 'wrong patterns, deprecated approaches, missing error handling' ... pre-running tsc ... lets the reviewer triage flagged lines instead of hunting for them"). When typecheck is unavailable — which on monorepos and project-references projects is the common case, not the rare one — the spec degrades silently to the original behavior with no acknowledgement that it has done so.

The directive should at least name this regression so the user knows the review they just got is no better than pre-spec on this dimension.

### 3.5 R2.8 typecheck-timed-out — assumes a terminal that doesn't exist — **Novel**

The directive: "Either run `tsc --noEmit` yourself in a separate terminal..."

Most review subagents run in non-interactive contexts (CI, MCP server, background process). They have no terminal. The "or manually scan" fallback is the same regression as §3.4. The "separate terminal" suggestion is a no-op for the topology that prepare actually runs in. This is worse on large monorepos because that's exactly where the timeout fires.

### 3.6 No spec on how the new directives compose with item-9 hygiene directive — **Recurring**

v1 noted (memory Unresolved §2): the spec doesn't enumerate which existing pinned strings change vs. which are augmented. The new diff-present directive ("Read the diff first") is a re-ordering instruction that semantically conflicts with the existing item-9 hygiene directive (which is referenced in `src/tools/__tests__/review-task.test.ts:100` per v1). Are reviewers expected to (a) read the diff first and *then* check hygiene, (b) read hygiene first and use diff for triage, (c) use both as parallel inputs? The spec doesn't say, and the directives are pinned in isolation.

When track A or B lands, the test suite will pin five new strings *next to* the existing item-9 pinned string. Whoever wrote the existing test will not have anticipated the diff-first instruction. The composite methodology emitted to the LLM will read like two voices talking past each other. Recurring without resolution.

---

## 4. Cross-track structural integrity

### 4.1 Track C touches the same file as A and B — merge contention is not "independent" — **Novel**

The introduction calls track C "independent of A and B (touches `multi-server.ts` settings-read paths and runner option types, not `handlePrepare` or methodology)." But `handlePrepare` lives in `multi-server.ts` (per the introduction's own `multi-server.ts:782-783, 1737` reference). Three tracks all editing the same large file at overlapping seams produce PR-level merge friction even when the seams are logically distinct.

"Can land in any order" understates the cost. If C lands first, A's PR rebases over the new helper signature; if A lands first, C has to thread the helper through whatever Promise.all shell A introduced. The spec's "sequencing convenience suggests landing C last" is a hint, not a constraint, and as written the implementer is free to interleave.

### 4.2 The "single helper" abstraction in R3.8 has an unstable scope — **Compounding** (deepens §1.5)

R3.8 introduces `resolveRunnerModel`. If any future setting becomes per-runner (cliArgs being the obvious next request), the "single helper" either (a) grows to `resolveRunnerSetting(settings, runner, key)`, breaking the existing call signature, (b) splits into a parallel helper per setting type, duplicating the precedence logic, or (c) gets replaced wholesale by a "load runner config" helper that returns a struct. None of these is a small change. The spec's "no duplicated precedence logic across the file" NFR is brittle on contact with the OOS deferrals.

### 4.3 Track A in isolation produces an observable methodology change before track B — **Recurring** (escalate, deepens v1 "track independence" finding)

Memory Partially Accepted §3 notes the spec still hedges "tracks A and B are functionally complete on their own." Track A alone:

- Adds three typecheck directives to `buildReviewMethodology`.
- Does not add the diff-first directive (R1.2).
- Methodology pinned tests change in shape.

Track B then ships a *second* methodology rewrite that adds two diff directives and re-orders the reviewer's instructions ("Read the diff first" replaces or precedes typecheck triage). External consumers of `buildReviewMethodology` output (any tooling that captures the methodology string for analytics, replay, or audit) see two non-additive shape changes in two PRs. The spec's "purely additive" framing is wrong for the methodology surface even if the data shape is additive.

### 4.4 Test pinning across PRs is undefined — **Novel**

The spec says directives are pinned "mirroring `fast-reviews` task 8(b)" but does not say:

- Whether existing pinned tests (item-9 hygiene) need updates when track A lands.
- Whether the typecheck directive pinning should pin *just the new strings* or pin the *full composite methodology output*.
- Whether track B's diff directives, which conceptually precede typecheck in reviewer ordering, change the position of the typecheck pin.

These are concrete decisions a reviewer of the design doc should be able to read off the spec. They aren't there.

---

## 5. Out-of-scope blast radius

Count the OOS items: multi-config typecheck, per-diagnostic blame tagging, submodule/symlink handling, Windows hardening, feature-flag rollout, deprecation of legacy `model`, file rename, per-runner CLI/cliArgs. Eight deferrals, shipping on by default with no rollback knob.

### 5.1 Compound coverage void in the realistic worst case — **Novel**

A realistic user: a TypeScript monorepo with `"references"` (project references), Windows host (npm-installed `tsc.cmd`), a review subagent that committed half the task before prepare ran, and a `models.taskReview: "claude-haiku-4-5"` config to save tokens. What does this user get?

- Typecheck unavailable, reason `'project-references'` (correctly reported).
- Diff non-empty but stale because of the partial commit (incorrectly framed as authoritative — see §2.2).
- Process termination of any spawned subprocess is governed by a SIGTERM contract that Windows handles unpredictably (OOS).
- No feature flag to disable any of this; on by default.
- Task review now uses Haiku, applied to a much-degraded review surface (typecheck blind, diff stale, no upstream context).

Each of the eight OOS items is individually reasonable to defer. Their *interaction* in a worst-case user environment is a review that looks complete but is structurally compromised, with no warning more visible than reason codes the reviewer LLM may or may not surface to the human.

### 5.2 "Ships on by default, consistent with `fast-reviews`" — the precedent doesn't hold — **Novel**

The spec rejects feature-flag rollout citing `fast-reviews`. Two material differences:

- `fast-reviews` did not change methodology directive text in non-additive ways; this spec does (track A → track B reorder).
- `fast-reviews` did not gate every prepare on a 30-second tsc subprocess; this spec does. A user with a slow `tsc` startup (large project, cold disk cache, antivirus scanning `node_modules`) now pays up to 30 seconds *added to every prepare*. This is a perf regression that needs an opt-out.

The risk profile differs enough that the precedent doesn't transfer. Either justify the difference or add a flag.

### 5.3 Forward compatibility of the response shape with OOS items — **Novel**

The spec adds `typecheckUnavailable: true` and `typecheckUnavailableReason` as a flat pair. When multi-config monorepo support eventually lands, the natural shape is per-config: some configs ran clean, some timed out, some are unavailable for different reasons. The flat pair is not forward-compatible — it can't represent "config A succeeded, config B timed out" without a schema break.

The spec should either (a) ship the v1 shape as `typecheckResults: TypecheckResult[]` (length 1 in v1, extensible) so the future spec doesn't require a schema break, or (b) explicitly accept that the future monorepo spec will be a schema break and call this out so consumers can plan.

Same issue applies to `diff: string` (single string for the whole project) when partial monorepo support lands — eventually you want per-config or per-package diffs, and a string field cannot evolve into a map without a break.

### 5.4 R3.7's "documentation surfaces the new shape as preferred" has no owner — **Novel**

R3.7 punts to documentation. No requirement covers updating the dashboard UI, the README, or in-tree docs to surface the `models` shape. A new user opening `adversarial-settings.json` (or its docs page) will see the legacy `model` field and never learn `models` exists. R3 should at minimum require a doc update or a dashboard hint, otherwise the feature ships invisibly.

---

## Top 5 risks or gaps

1. **Empty `typecheckDiagnostics: []` is still indistinguishable from tsconfig-excluded coverage.** (R2.5) — **Recurring (escalated).** Failure: project with `"exclude": ["**/*.generated.ts"]`, user modifies a generated client file, tsc returns clean, methodology emits no directive, reviewer believes file is type-checked. Spec's NFR Usability ("silent under-coverage is impossible to miss") is contradicted by R2.5 itself. Fix: require a coverage manifest (e.g. `tsc --listFiles` intersected with `allFiles`) or emit a directive on empty when not all in-scope files were compiled.

2. **R3 precedence matrix has undefined behavior at `null`, empty string, and unrecognized keys.** (R3.5, R3.6) — **Novel.** Failure: user writes `"models": { "adversarial": "" }` to "clear" the override; `""` wins under R3.5 precedence and the runner gets `--model ""`, which crashes or no-ops. No warning surfaces because R3.6 only catches non-strings. Fix: define empty-string semantics, define `models: null` semantics, define unknown-key behavior.

3. **Non-empty-but-incomplete diff has no methodology branch.** (R1.2 / Coverage constraints) — **Recurring (escalated).** Failure: agent commits half the task before prepare runs; diff reflects only the uncommitted half but looks authoritative. R1.2's four fallback triggers (a–d) do not include partial-commit drift. Reviewer reads the partial diff and approves. Coverage-constraints note tells the *user* about this; it does not instruct the *reviewer*. Fix: third methodology branch ("diff present but possibly stale — verify against `git log -p HEAD~3..HEAD --` for the same paths") or include a `diffCommitsBehind` signal in the response.

4. **R2.6 and R2.8 directives degrade silently to the LLM-hunting workload the spec was built to eliminate.** (R2.6, R2.8) — **Novel.** Failure: monorepo project, typecheck unavailable, directive tells reviewer to "manually scan them for type errors" — same workload as pre-spec, but presented as the spec's recommended fallback. On large projects (timeout case) the directive suggests "a separate terminal" the reviewer does not have. Fix: either acknowledge the regression in-directive ("Pre-spec methodology applies for this review — type-error coverage is unverified") or invest in the OOS items that make typecheck available more often.

5. **R3 settings-read timing is unspecified, and the retry path can pick up edits mid-review.** (R3.8) — **Novel.** Failure: user edits `adversarial-settings.json` between adversarial run start and retry; retry uses different model than the original attempt; review trace mixes two models without surfacing this. Or: dashboard re-reads on every request, and a malformed file produces a log storm despite R3.6's "single warning" promise. Fix: pin read-timing semantics (one-shot at startup with explicit `reload` MCP call, or read-per-request with an in-process cache keyed by mtime).

## Top 3 conclusions to challenge or reverse

### 1. "Tracks A, B, and C can land in any order" — **Recurring**

**Spec's claim:** Track sequencing is convenience-only; A and B share `Promise.all` seam (A lands first as convention) and C is independent.

**Counter-argument:** All three tracks edit `multi-server.ts`. Track A lands a new `Promise.all` shell + 3 methodology directives + new response fields. Track B re-orders the methodology and adds 2 more directives. Track C threads a settings helper through every runner-construction site. The first PR to land changes the file in ways the other two have to rebase across. More importantly, the methodology directive ordering is *semantically* coupled across A and B — a user who runs reviews against the in-between state (A merged, B not yet) gets a methodology that tells them to triage typecheck diagnostics with no diff-first instruction, which produces a different review than either pre-spec or post-spec.

**Proposed reversal:** Mandate sequencing (A → B → C) as a requirement, not convention. Specify that B's methodology PR re-pins A's directive strings if the ordering shifts.

### 2. "Ships on by default, consistent with `fast-reviews`" — **Novel**

**Spec's claim:** Out of Scope §5 — feature flag / shadow rollout is unnecessary because `fast-reviews` shipped this way.

**Counter-argument:** `fast-reviews` did not (a) change reviewer methodology directives in non-additive ways, (b) gate every prepare on a 30-second subprocess that touches the project's `node_modules/.bin/tsc`, or (c) introduce a per-runner config shape with five precedence rules. The risk surface differs enough that the precedent does not transfer. The first user with a slow tsc startup pays a 30-second prepare regression on every review with no opt-out.

**Proposed reversal:** Add a single boolean kill switch (`features.tighterReviews: false` in `adversarial-settings.json`) that disables the diff and typecheck pre-computation, restoring pre-spec behavior. R3 can stay on by default — it's purely additive at the data shape and runtime cost.

### 3. "Per-runner overrides are limited to `model` because cli/cliArgs would be churn" — **Novel**

**Spec's claim:** OOS §8 — `cli` and `cliArgs` remain global; per-runner `model` is enough.

**Counter-argument:** The natural follow-up request is per-runner `cliArgs`: Opus and Haiku want different `--max-tokens`, different temperatures, different thinking budgets. When that lands, the parallel-sibling shape (`models: {...}, cliArgs: {...}`) does not compose naturally. The grouped shape (`adversarial: { model, cliArgs }, taskReview: {...}`) does. R3 has wedged the file into the worse of two shapes.

**Proposed reversal:** Either (a) ship R3 with the grouped shape from the start (`adversarial: { model? }, taskReview: { model? }` with a documented extension point), or (b) explicitly call out that the parallel-siblings shape is a known short-term trade and the next per-runner setting will require a config migration.

## What's missing — work to be done before this spec moves to design

- **R3 read-timing contract.** Specify when `adversarial-settings.json` is parsed (startup-once, per-request, mtime-watched), what the retry path's read semantics are, and what "one warning per malformed-load event" means in operational terms.
- **R3 precedence at type boundaries.** Define behavior for `models` as `null`, `models.<runner>` as `""`, and unknown keys under `models`. Pin with tests.
- **Test pinning for R3 precedence matrix.** Mirror the methodology-directive pinning approach so future PRs can't silently flip precedence.
- **Coverage-listing field for typecheck.** A `typecheckCoverage: { compiled: string[], excluded: string[] }` (or equivalent) so empty `typecheckDiagnostics: []` distinguishes "ran clean over all in-scope" from "in-scope file was excluded by tsconfig."
- **Third methodology branch for partial/stale diff.** Either a `diffCommitsBehind` signal or an explicit "diff may be stale" directive; the current Coverage constraints note does not reach the reviewer.
- **Rename detection.** Decide on `-M` / `--find-renames` behavior, expand pathspec to include both old and new paths when implementation log lacks deletion records, or remove "rename" from R1.2's structural-change trigger list.
- **Methodology directive composition spec.** Enumerate which existing pinned strings (notably item-9 hygiene at `src/tools/__tests__/review-task.test.ts:100`) interact with the five new directives, and pin the composite ordering — not the individual strings in isolation.
- **Forward-compatible response shape for OOS items.** Re-shape `typecheckUnavailable` / `typecheckUnavailableReason` as `typecheckResults: TypecheckResult[]` (length 1 today) so multi-config monorepo support is additive, not a schema break. Same audit for `diff: string`.
- **Owner for R3 documentation.** Either a docs deliverable in R3 itself, a dashboard hint, or an explicit follow-up ticket — otherwise R3 ships invisibly to new users.
- **Rollback knob.** Single feature-flag boolean to disable diff + typecheck pre-computation, gating only the on-by-default risk (R1, R2). R3 can remain unflagged.
- **Acknowledge directive regression in R2.6 / R2.8.** Either rework the directives so they don't restate the pre-spec hunting workload, or include in-directive language acknowledging the degradation so the reviewer surfaces it.
- **Define the "half the file" denominator in R1.2.** "Hunks span more than half the file" is undefined for asymmetric edits; pin which line count is the denominator.
