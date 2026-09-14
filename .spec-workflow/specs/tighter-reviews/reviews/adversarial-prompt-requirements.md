# Adversarial Review — `tighter-reviews` Requirements

You are a senior staff engineer with deep experience in MCP server design, TypeScript tooling internals, and review-loop ergonomics for agent-driven workflows. You have shipped review pipelines that were undone by exactly the kind of "obviously-fine" assumptions baked into spec documents like this one. Your job here is **not** to validate this spec. Your job is to **tear it apart** — surface every gap, every unstated assumption, every failure mode the author waved past, and every place where the acceptance criteria are loose enough to drive a truck through.

Read the requirements at:
`/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/requirements.md`

Then attack it along the following dimensions. Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on.

## 1. Diff Semantics and Coverage (Requirement 1)

- Challenge the assumption that `git diff HEAD --` against `filesModified ∪ filesCreated` captures "the task's changes." Enumerate scenarios where it doesn't: partial commits during the task, files modified-then-reverted, renames/moves (does git show them as add+delete with these arguments?), files staged but not committed, files unstaged with mixed staged/unstaged hunks, submodule paths, symlinks.
- Stress-test R1.1's path-filter behavior. The implementation log records logical paths the agent claims it touched. What happens when the agent's log is wrong (claimed a file it didn't modify, or modified a file it didn't claim)? The diff will silently under- or over-report — find the user-visible consequences.
- Challenge R1.3's "fall back to current full-file reading" branch. Empty diff is ambiguous: it can mean "all committed already" (real changes exist, just not in working tree) **or** "nothing was actually changed" (log is stale). The methodology treats both the same. Identify when this misleads the reviewer.
- Probe R1.5's claim that aligning diff paths to `allFiles` makes "diff coverage match signal coverage." Hygiene signals operate per-file; diff hunks span lines. A file in `allFiles` with zero diff hunks contributes to signals but not diff — does the methodology handle that asymmetry? What about a hunk that touches lines outside what hygiene signals examined?
- Attack the binary-file and large-file cases. Lockfiles, generated TS declarations, snapshot files, images. Does R1 specify a size cap? What's the token budget impact when a generated bundle gets included? `git diff` on a 50k-line lockfile change is worse than reading the file.
- R1.6's `diffStats` is computed "from the diff output (or from `git diff --numstat` run alongside)." Pick one — running diff twice doubles latency and risks divergence. Identify the consequences of leaving this ambiguous.

## 2. Typecheck Invocation and Diagnostic Fidelity (Requirement 2)

- Attack R2.1's invocation: `tsc --noEmit -p <projectPath> --incremental`. Enumerate the projects this breaks on: monorepos with multiple `tsconfig.json` files, project references (`tsc -b` is the correct invocation, not `-p`), `tsconfig.json` that isn't named `tsconfig.json` (e.g. `tsconfig.build.json`), projects where the root `tsconfig.json` is a thin wrapper that excludes `src/`. In each case, what does the reviewer see?
- Challenge the `--incremental` choice. R2 mandates it but `.tsbuildinfo` is sensitive to flag changes — adding `--noEmit` to a project that normally builds with emit will invalidate the cache on first run, blowing the 5-second incremental budget. Find the disclosure failure: the spec promises < 5s incremental but doesn't acknowledge the cold-cache cost on first integration.
- Tear apart R2.3's "filter diagnostics to `allFiles`." TypeScript errors cascade — a type error in file A often manifests as diagnostics in file B that imports it. Filtering to changed files hides the upstream cause. Identify the case where the reviewer sees a confusing downstream diagnostic with no context for why it fired.
- R2.2's diagnostic shape claims `severity: 'error' | 'warning'`. `tsc` does not emit warnings under `--noEmit`; it emits errors and "suggestions" (only with `--pretty` flags). What populates `'warning'`? Either it's dead code in the type definition or the spec is wrong about what tsc produces.
- Challenge R2.4's directive to "promote real bugs to findings with `category: 'spec-compliance'`." A type error introduced by the task is a **code defect**, not a spec-compliance failure. Misclassifying it pollutes the finding category and undermines downstream consumers of the review output. Find the precedent in the existing review-task code that this contradicts.
- R2.7 says non-zero tsc exit is fine because diagnostics caused it. What about non-zero exit caused by config errors (TS5xxx series), missing dependencies, or a broken `tsconfig.json`? These also exit non-zero but produce no useful per-file diagnostics — the reviewer will see an empty array and assume the code is clean.
- Attack the timeout in R2.8. 30 seconds is fine for a small project but is a routine cold-start time on a 100k-LOC monorepo. The methodology mentions it "did not complete" — but does it tell the reviewer to **manually run tsc**, or does it just shrug? Identify the silent-success failure mode where the reviewer treats incomplete coverage as complete.

## 3. Concurrency, Latency, and Process Hygiene (Requirements 1 + 2, NFRs)

- R2.9 mandates concurrent execution via `Promise.all`. With a 30s tsc timeout and a 200ms diff target, what happens to the diff response when tsc is hung? Is the diff returned at 200ms, or does the user wait 30s for both? `Promise.all` rejects on first reject — what does that mean when both utilities are designed not to throw? Find the spec gap.
- The NFR says "external-process failures degrade to feature absent." But a hung `tsc` process holds file handles and CPU. If the timeout fires (R2.8), is the process killed or orphaned? Is `execFile`'s `signal: 'SIGTERM'` enough on Windows? Find the resource-leak scenario.
- Probe the working-directory and env-var assumptions. Does `git diff` run with `cwd: projectPath`? What if `projectPath` is a worktree, not the main checkout? What env vars are stripped/preserved when invoking `tsc` — particularly `NODE_OPTIONS`, `TS_NODE_PROJECT`, or shell aliases the user has overriding `tsc`?
- The NFR claims "no new npm packages" because tsc is invoked via the project's own resolution. But "the project" means the user's project, which may not depend on TypeScript at all — yet `handlePrepare` is part of `spec-workflow-mcp`'s server. What if the MCP server's own tsc is on PATH but the target project's isn't? The diagnostics could be from a tsc version that doesn't match the project's tsconfig syntax.

## 4. Methodology Surface and Reviewer Behavior (R1.2, R2.4, R2.5, NFR Usability)

- The spec adds two new methodology directives but doesn't show their wording. R1.2 says "read `data.diff` first and use `filesToReview` only for surrounding context." This conflicts with how reviewers historically navigate code — they often want full-file context to evaluate naming, structure, and architectural fit. Find the cases where diff-only review misses class-of-bugs (e.g. a small change that breaks an invariant maintained elsewhere in the file).
- Attack the "surrounding context" hand-wave. Standard `git diff` context is 3 lines. For a refactor that splits a 200-line function, 3 lines of context is useless. Does the spec specify `-U<n>` for larger context? If not, the reviewer is told to read the full file *only when the diff hunks don't show enough* — but the diff doesn't tell the reviewer what's missing.
- R2.4's directive ("triage each diagnostic — real bug, pre-existing, or spurious") puts the LLM in exactly the role the spec claims to be removing. The whole pitch was "shift work from LLM to deterministic code." Pre-existing vs. introduced is a judgment call requiring full code understanding. Identify what's actually saved here vs. what's just relabeled.
- R2.5 says no directive when diagnostics are empty. But empty can mean "no errors" or "tsc didn't actually examine the file" (e.g. excluded by tsconfig). The reviewer will assume the former. Find the false-confidence failure.
- The NFR says directives "read as concrete reviewer instructions, not prose" but the spec gives no examples. Without exemplars, the implementer will write whatever feels right — review quality regression risk.

## 5. Backward Compatibility and Cross-Track Coupling (NFR, Introduction)

- The introduction claims "the two tracks are independent and can ship as parallel PRs," but R2.9 explicitly couples them via `Promise.all`. Identify the integration risk: track 2 ships first, track 1 follows, and the concurrency wiring has to be retrofitted.
- The NFR promises additive data shape with new optional fields. Existing consumers of the review-task response (the dashboard, any external integrations) will see new fields. Are there schema validators downstream that reject unknown fields? The spec doesn't enumerate consumers — find the breakage risk.
- The methodology change in R1.2 is **not** additive. It rewords existing reviewer instructions. Any prompt-engineering work that depends on the current methodology's exact text (e.g. golden tests, A/B comparisons of review quality) breaks. Find the regression-risk gap.

## 6. Out-of-Scope and Missing Coverage

- The spec covers TypeScript projects only. What about JS-with-JSDoc projects (`checkJs: true`)? Mixed-language repos (TS + Python)? The spec is silent — the reviewer gets no help on those.
- No mention of how diagnostics are deduplicated when the same line has multiple type errors. The shape is a flat array; large diagnostic counts (hundreds on a refactor that breaks one type) flood the response.
- No mention of secrets/PII risk in diff output. A reviewer-facing diff that includes a developer's accidentally-committed `.env` change could leak credentials into LLM context. Hygiene-signals likely already has precedent — does this spec inherit those guards?
- Token-budget accounting is absent. The spec's stated motivation is reducing input tokens, but it never bounds the new fields. A 10k-line diff is worse than the original full-file approach — when does the "shorter loop" promise stop holding?
- No rollout/feature-flag plan. If the new methodology directives degrade review quality on a class of tasks, how is that detected and rolled back?

## Closing Deliverables

Conclude your analysis with:

- **Top 5 risks or gaps** — ordered by severity, each with a concrete failure scenario and the user-visible symptom.
- **Top 3 conclusions to challenge or reverse** — name the specific claim from the requirements doc, state your counter-position, and give the reasoning.
- **What's missing** — work that should be done before this spec moves to design (e.g. concrete methodology text, monorepo handling decision, cross-track dependency clarification, token-budget caps, etc.).

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on.

Write your analysis to:
`/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-analysis-requirements.md`
