# Adversarial Review — `tighter-reviews` Requirements (v2)

You are a principal engineer with deep experience in TypeScript build systems, Git plumbing, MCP server design, and review-pipeline tooling. You have shipped tooling like this in production and watched it fail in ways that surprised the original authors. Your job on this review is to **tear this requirements document apart**. You are not here to validate it, restate its claims charitably, or congratulate it on what it got right. You are here to find what is still wrong, what is newly wrong because of recent edits, and what will fail in production in the specific ways production actually fails.

The target document is `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/requirements.md`. Read it in full before forming any conclusions.

## Prior Review Context

This is the second adversarial pass on this requirements document. A v1 review identified a long list of issues, and the requirements were significantly revised in response. Before you start, read `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-memory-requirements.md` in full. The memory file enumerates:

- v1 findings the spec **accepted** and now reflects (do not re-discover these as if they are new — the diff-stats source ambiguity, cascading-error filtering, dead `severity: 'warning'` member, type-error category, methodology directive text absence, binary/lockfile/secrets denylist gaps, token-budget caps, cold-cache cross-contamination, process-kill semantics, env contamination, and concurrency-shell sequencing have all been addressed).
- v1 findings the spec **partially** accepted (monorepo handling now produces `typecheckUnavailable` reason codes but still does not type-check anything in those projects; partial-commit drift is acknowledged as a coverage constraint but does not get its own methodology branch; track independence is hedged but still claimed in the introduction; LLM still triages `introducedByThisTask` — no `git blame` tagging).
- v1 findings explicitly **out of scope** in this spec (per-diagnostic blame tagging, submodule/symlink handling, multi-config typecheck, feature-flag rollout, Windows hardening).
- v1 findings still **unresolved** (empty-`typecheckDiagnostics` coverage silence, methodology test pinning collisions, schema validator breakage, diagnostic deduplication, non-empty-but-incomplete diff after partial commits, rename detection with explicit pathspec).
- A brand-new **Requirement 3** (per-runner model selection in `adversarial-settings.json`) that was not present in v1 and has had no adversarial pass.

Classify every finding you produce as one of:

- **Novel** — not identified in any prior review.
- **Compounding** — builds on or deepens a prior finding (cite the prior finding by phrase or location).
- **Recurring** — the same issue v1 raised, still not resolved. Escalate severity. Recurring findings count more, not less.

Do not waste paragraphs re-litigating settled issues. If you discover a settled issue was settled in a way that is itself broken, that is a Compounding finding — say so explicitly.

## Analysis Dimensions

### 1. Requirement 3 — Per-runner model selection (NEW SURFACE; no prior review)

R3 introduces `models: { adversarial?: string; taskReview?: string }` alongside the legacy top-level `model` field, with precedence rules, malformed-config tolerance, a single settings-read helper, and an out-of-scope note that the file name `adversarial-settings.json` will not be renamed despite now governing both runners. Attack angles:

- **Precedence ordering under partial config.** R3.1–R3.5 specify five precedence rules. Stress-test the matrix: legacy `model` + only `models.adversarial` set, legacy `model` + `models: {}`, legacy `model` set + `models.adversarial: ""` (empty string — is empty string "absent" or "set to empty"? what does the CLI do with `--model ""`?), `models` set as a string instead of an object, `models.adversarial` set to a non-string but truthy value (number, array, object). The spec's "ignored as if absent" rule (R3.6) collides with empty-string semantics that may differ between "absent" and "the user explicitly disabled override."
- **Settings-read race / staleness.** R3.8 says the retry path at `multi-server.ts:950` uses the same precedence. But the spec is silent on **when** settings are read — once at server startup, once per request, once per runner-construction call? If the user edits `adversarial-settings.json` between an adversarial run and a task review, do they get mixed model behavior? Does an in-flight retry pick up an edited file? The single helper (R3.8) does not by itself answer this.
- **File-name vs. file-scope mismatch.** Out-of-scope explicitly preserves the name `adversarial-settings.json`. The file now governs **both** runners. New users opening the file to configure task-review models will not find it where they expect. Attack: this is not a renaming-cost decision, it is a discoverability decision being papered over.
- **Per-runner CLI / cliArgs explicitly out of scope.** A user who wants Opus for adversarial and Haiku for task review may also want different `cliArgs` (e.g. higher max-tokens for Opus, lower for Haiku to enforce a brevity bound). The spec defers this with no migration story for when it inevitably gets requested. Will the eventual `cliArgs: { adversarial?, taskReview? }` shape collide with the `models: {...}` shape? Has the spec considered grouping (`adversarial: { model, cli, cliArgs }, taskReview: { ... }`) which would scale better than parallel sibling maps?
- **Malformed-config logging volume.** R3.6 says "log a single warning (one per malformed-load event)." But the dashboard reads settings on every runner construction — does "one per malformed-load event" mean one per process lifetime, one per file mtime change, one per request? Otherwise a malformed file emits a warning storm.
- **Interaction with retry path (`multi-server.ts:950`).** The retry path is for adversarial. The spec mandates the same precedence helper there. But the adversarial retry case is exactly when the user might want **different** behavior — e.g. retry with a smaller model to save tokens after a failed Opus run. Spec does not say whether retry-with-cheaper is a use case to support or to reject; just mandates "same logic."
- **Test surface for R3.** R3 is a config-shape change with five precedence rules, a tolerance rule, and two callsites (initial + retry). The spec does not mandate tests pinning the precedence matrix. Hygiene-signal precedent (cited elsewhere in the spec) had pinned methodology strings; R3 has no analog. Methodology drift risk is now mirrored as precedence-rule drift risk.

### 2. Coverage gaps that survived v1 — recurring or compounding

The v1 review surfaced a class of "the diagnostic-or-diff *says* something specific, but the underlying coverage is silently partial" failures. Several were narrowed but not closed. Attack each surviving gap:

- **Empty `typecheckDiagnostics: []` still cannot be distinguished from "files were excluded by `tsconfig`."** R2.5 emits no directive when empty. R2.6 only fires for the four named unavailable reasons. A tsconfig with `"exclude": ["**/*.generated.ts"]` covering an in-scope file leaves no signal. Recurring: v1 listed this as case #2 of the false-confidence taxonomy. The spec did not add a coverage-listing field. Quantify what could go silently uncovered.
- **Non-empty-but-incomplete diff after a partial commit.** The Coverage constraints section acknowledges this and instructs users to fall back to full-file reading. But the methodology only branches on diff-empty vs. diff-present — there is no third "diff present but stale" branch. The directive in R1.2 tells the reviewer to **read the diff first** and use full files only when (a) structural change, (b) hunks span >50%, (c) surrounding invariants needed, (d) skipped paths relevant. *Partial commit is not in the (a)-(d) list.* The reviewer has no instruction to detect or react to this case.
- **Rename detection with explicit pathspec.** v1 identified that `git diff HEAD -- <pathspec>` defeats rename detection. The revised spec mentions `-U10` and a denylist but is silent on `-M` / `--find-renames` / `--diff-filter`. Verify whether the spec's invocation will actually surface renames usefully, or whether `filesCreated`-only logging produces 200-line add+200-line delete pairs as noise.
- **`allFiles` as a hard pre-filter for both diff and typecheck.** Hygiene signals scan files line-by-line; diff hunks span lines; typecheck cascades through imports. The spec keeps `allFiles` as the single anchor for all three. If the agent under-reports its modified files, all three pre-computations are coverage-narrow in lockstep. The reviewer has no way to detect this from response shape alone.

### 3. Methodology directive text quality

The spec now embeds five exact directive strings, pinned by tests. They are load-bearing — if the wording is bad, the deterministic improvement upstream is wasted. Attack each directive's wording for ambiguity, conflict, or LLM-misinterpretation:

- **Diff-present directive (R1.2).** It tells the reviewer to read full files when "the change is structural (rename, file split, large refactor)." How is the reviewer expected to **detect** "rename" when the spec's pathspec invocation may not even surface renames as `R` in the diff? "Hunks span more than half the file" — half the file post-edit, or pre-edit? Adding 50 lines to a 100-line file produces hunks covering 33% post-edit and 100% pre-edit. The directive's semantics differ.
- **Diff-empty fallback (R1.3, R1.4).** It tells the reviewer to inspect "the latest commits on the current branch with `git log -p HEAD -3 -- <filesToReview>`." This embeds a specific shell invocation in the directive — but `<filesToReview>` is a placeholder the reviewer must substitute. If the reviewer is an LLM, will it pass a JSON array as shell arguments correctly? Will it quote paths with spaces? The directive is pseudo-shell, not exact syntax.
- **Typecheck-present directive (R2.4).** It says to promote "real bugs introduced by this task" to `category: 'hygiene'` and *not* file pre-existing diagnostics as findings. But the spec did **not** adopt `git blame` tagging, so the reviewer is making this judgment by hand. The directive says to use `inScope: false` entries as upstream context — a reviewer with 100 in-scope and 0 out-of-scope diagnostics has no way to tell whether the absence of upstream signal means "tsc didn't see anything upstream" or "this task is the upstream cause."
- **Typecheck-unavailable directive (R2.6).** It tells the reviewer to "manually scan them for type errors." This is exactly the LLM-hunting workload the spec's introduction promised to eliminate. When typecheck is unavailable, the spec degrades to the very behavior it was built to replace. There is no acknowledgement of that regression in the directive itself.
- **Typecheck-timed-out directive (R2.8).** It says "Either run `tsc --noEmit` yourself in a separate terminal..." Most review subagents run in non-interactive contexts with no terminal. The directive offloads work to a reviewer who in many topologies cannot do it. This is a hidden failure mode where on large monorepos the directive is a no-op suggestion.

For each, also test whether the directive **conflicts** with existing pinned methodology text (e.g. the item-9 hygiene directive at `src/tools/__tests__/review-task.test.ts:100` referenced in v1).

### 4. Cross-track structural integrity (revisited and extended for track C)

v1 attacked the "tracks are independent" claim. The spec retreated partially: it now mandates the `Promise.all` shell lands first in track A, and adds a third track C (per-runner model selection) said to be "independent of A and B." Attack the new structure:

- **Track C file collisions.** Track C touches "`multi-server.ts` settings-read paths and runner option types." Tracks A and B touch `handlePrepare`, which lives in `multi-server.ts` (per the introduction's `multi-server.ts:782-783, 1737` reference). Multiple tracks editing the same large file at overlapping seams means PR-level merge contention even when they are logically independent. The spec hand-waves "can land in any order."
- **Track C silently re-reads settings.** R3.8 introduces a settings-read helper used at every runner-construction site. Tracks A and B add prepare-side response fields; if any of those become settings-driven later (e.g. a config flag for `tsc` invocation, which v1 asked for and the spec rejected), the helper's scope creeps. The "single helper" abstraction is brittle if the file is destined to grow.
- **Methodology builder ownership.** Track A introduces methodology directives for typecheck (3 of them); track B introduces directives for diff (2 of them); track C introduces no directive but does change runner behavior. If `buildReviewMethodology` is co-owned by tracks A and B, what does the test pinning look like when track A lands first with typecheck directives and the existing item-9 hygiene directive is still pinned alongside? Spec says directives are pinned by tests "mirroring `fast-reviews` task 8(b)" but does not say whether the existing pinned tests need updates or whether new tests are appended.
- **Sequencing claim vs. coverage.** "Tracks A and B are functionally complete on their own." Track A alone with no diff means the response advertises typecheck diagnostics but the reviewer is still reading whole files (R1's diff is absent). The methodology in track A's first PR will not include the diff-first directive. After track B ships, the methodology shifts to diff-first. The methodology change between the two PRs is observable to consumers and is **not** purely additive at the prompt layer (v1 finding, partially accepted).

### 5. Out-of-scope blast radius

Count the explicit Out-of-Scope items in the v1 spec: multi-config typecheck, per-diagnostic blame tagging, submodule/symlink handling, Windows hardening, feature-flag rollout, deprecation of legacy `model`, file rename, per-runner CLI/cliArgs. Together they describe a v1 that ships **on by default**, with **no rollback**, into ecosystems that **will hit each of these gaps** within the first weeks. Attack:

- **Compound coverage void.** For a user with a project-references monorepo on Windows whose review subagent committed half a task before prepare ran, the spec degrades to: typecheck unavailable (correctly reported), diff present but stale (incorrectly framed as authoritative), no feature flag to disable, no Windows-specific kill semantics if tsc somehow did start, and the user's `models.taskReview` Haiku setting now applies to a much-degraded review surface.
- **Rollout safety.** Spec rejects feature-flag rollout, citing `fast-reviews` precedent. But `fast-reviews` did not change methodology directive text in non-additive ways, and did not gate every prepare on a 30s tsc timeout. The risk profile differs.
- **Migration path for the rejections.** Several OOS items will be requested by users (rename, monorepo, blame). The spec adds shape-incompatible fields (`typecheckUnavailable`, `typecheckUnavailableReason`) that constrain how those features can be added later without further shape changes. Has the spec evaluated whether the response shape is forward-compatible with the OOS work?
- **Documentation surface for the rejections.** R3.7 says no automatic migration of legacy `model` to new `models` shape, "documentation surfaces the new shape as preferred." But the spec does not own a docs deliverable, and no requirement covers "updating the dashboard / README to explain the precedence ordering and which subagent uses which field." A new user reading the existing `adversarial-settings.json` docs will not know `models` exists.

## Closing Deliverables

End your analysis with:

### Top 5 risks or gaps
Ordered by severity, with a concrete failure scenario for each. Cite specific requirement IDs (e.g. "R1.2", "R3.6"). For each, mark its classification: **Novel**, **Compounding**, or **Recurring**.

### Top 3 conclusions to challenge or reverse
For each, state the spec's claim, the counter-argument, and the proposed reversal. Include the classification.

### What's missing — work to be done before this spec moves to design
Bullet list. Prioritize items whose absence would silently degrade review quality or block the OOS items from being added later without backward-incompatible response-shape changes.

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on. Do not pad with praise. Recurring findings are a signal that the spec author is not internalizing the criticism — escalate them and explain why the proposed mitigation in the spec is insufficient.

## Output

Write your analysis to `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-analysis-requirements-r2.md`. Do not modify any other files.
