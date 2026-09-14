# Adversarial Analysis — `tighter-reviews` Requirements

## 1. Diff Semantics and Coverage (Requirement 1)

**R1.1 / `git diff HEAD --` against the modified-files filter does not capture "the task's changes."** The implementation log records *what the agent claims it did*, and `HEAD` is whatever commit happens to be at the tip when prepare runs. That intersection is wrong in several common cases:

- **Partial commits during the task.** The agent committed half the work mid-task. `git diff HEAD --` shows only the uncommitted half. The reviewer reads a diff that omits the just-landed commit, then grades the task against a partial picture. R1.3 explicitly treats this as "fall back to full-file reading," but the diff is *non-empty* — it just covers a fraction. The methodology in R1.2 will direct the reviewer to the diff and use full files only for "surrounding context that the diff hunks do not show," and the missing hunks are silently invisible.
- **Modify-then-revert.** Agent edits `foo.ts`, then reverts. `filesModified` still lists `foo.ts`, but `git diff` shows nothing for it. R1.3 hits the empty-diff branch and the methodology behaves as if the agent never touched the file — but the log claims it did, and the reviewer is supposed to grade the log.
- **Renames and moves.** `git diff HEAD -- <pathlist>` against an explicit pathlist defeats rename detection. Git's rename detection is heuristic and pathspec-scoped; passing both old and new paths usually shows them as add+delete with no `R` similarity score, so the reviewer sees a 200-line deletion and a 200-line addition instead of a rename. If the log only recorded the *new* path under `filesCreated` (which is the typical agent behavior), the deletion of the old path won't be in the diff at all.
- **Staged-but-not-committed and mixed-staged hunks.** `git diff` (without `--cached`) shows unstaged only; `git diff HEAD` shows working-tree-vs-HEAD. If the agent staged some hunks (e.g. ran a partial `git add -p`), `git diff HEAD --` does include those, so this case is OK — but the spec doesn't say which form is being used. R1.1 says "git diff HEAD --" so I'll trust that, but the spec should be explicit that `--cached` is not the right invocation.
- **Submodules.** `git diff HEAD -- <submodule-path>` shows the gitlink change (commit-hash diff), not the inner-tree diff. The reviewer sees `Subproject commit a1b2c3..d4e5f6` and gets no useful signal. The spec is silent.
- **Symlinks.** Modifying a symlink target shows as a single-line content diff of the symlink itself; if the log records the symlink path the diff is fine. If the log records the symlink's *target*, the working tree at that target may not have changed and the diff is empty for the wrong reason.

**R1.1 — log-vs-reality drift.** The path-filter is a hard pre-filter. If the agent claimed `src/a.ts` but actually edited `src/b.ts`, the diff omits the real change and the reviewer is told the diff is the source of truth (R1.2). The opposite — agent claims `src/a.ts` but didn't touch it — is harmless (empty hunks). The asymmetry matters: the spec is making the diff a primary input but pinning its coverage to a self-reported list. Hygiene signals have the same problem but they're just *signals* — diffs are positioned as the **canonical reading source** in R1.2.

**R1.3 / empty-diff ambiguity.** "Empty diff" conflates three different states:

1. All task changes already committed past `HEAD` — false (there's nothing past HEAD).
2. All task changes already committed *into* HEAD (task finished, then HEAD was advanced by another tool/agent before prepare ran) — `git diff HEAD --` is empty even though the task did real work.
3. The log is stale or wrong, and nothing was changed in the listed files.

R1.3 says "fall back to current full-file reading directive byte-for-byte." That fallback works for case 2 (full files contain the changes). It fails for the partial-commit-during-task scenario from R1.1: half the changes are in a recent commit, half are in the working tree. The diff is non-empty (so the fallback doesn't fire), but it's incomplete. The methodology has no third branch.

**R1.5 / signal-vs-diff coverage.** The claim that aligning `allFiles` makes "diff coverage match signal coverage" is shallow. Hygiene signals scan files line-by-line and report per-file findings. Diff hunks span lines. A file in `allFiles` whose content was modified but whose hygiene-signal scan finds nothing still appears in the diff. A file in `allFiles` whose content was *not* modified (working tree clean for it) contributes zero to the diff but is fully scanned for signals. The methodology directive in R1.2 ("read `data.diff` first") tells the reviewer the diff is the primary surface — but signals can fire on files the diff says nothing about, and the reviewer has no instruction for reconciling that asymmetry.

The deeper issue: hygiene signals fire on **pre-existing** lines too (an old `TODO` in an unmodified region of a touched file). The diff shows only the modified region. The reviewer who reads "diff first" will see the signal but no diff context for it and can't tell whether the agent introduced it.

**Binary and large files.** R1 specifies no size cap. Concretely:

- A `package-lock.json` change after `npm install` is routinely 10k+ lines. `git diff HEAD -- package-lock.json` produces a unified diff that is *worse* than reading the file (you read the changes plus the full hunk context plus diff metadata). Token budget is blown.
- Generated `.d.ts` bundles, snapshot test files (`__snapshots__/*.snap`), minified assets — all the same.
- Binary files: `git diff` emits `Binary files a/foo.png and b/foo.png differ`. Harmless but useless.

The spec needs an explicit binary skip and a per-file or total line cap, plus a documented behavior when the cap is exceeded (truncate? skip the file? emit a marker?). Hygiene-signals has `MAX_FILE_SIZE = 1 MiB`; diff has no analog.

**R1.6 / diffStats ambiguity.** "Computed from the diff output (or from `git diff --numstat` run alongside)" is a coin flip baked into the spec. Parsing unified diff for line counts works but requires implementing the parser correctly (handling `\ No newline at end of file`, file mode changes, binary markers). Running `git diff --numstat` is correct and trivial but doubles latency and racy if the working tree changes between the two invocations. Pick one in the requirements; otherwise two reviewers reading two implementations will disagree on `linesAdded` for the same task.

## 2. Typecheck Invocation and Diagnostic Fidelity (Requirement 2)

**R2.1 / wrong invocation for real-world projects.**

- **Project references / monorepos.** `tsc -p <projectPath>` typechecks one config. Project references require `tsc -b <projectPath>` to walk the graph. `-p` against a root config that uses `references` will type-check zero files (the root is just a graph entry point). Reviewer sees an empty `typecheckDiagnostics` and assumes the task is type-clean.
- **Non-default config name.** Many projects use `tsconfig.build.json`, `tsconfig.eslint.json`, etc. `tsc --noEmit -p <projectPath>` resolves to `<projectPath>/tsconfig.json`. If the modified files are in a subproject with its own config, none of them are typechecked.
- **Root config is a thin wrapper that excludes `src/`.** Real pattern: a root `tsconfig.json` with `"files": []` and `"references": [...]`. R2.1's invocation typechecks nothing.
- **Workspace packages.** `pnpm` / `yarn` workspaces typically have one tsconfig per package. Modified files split across packages will be typechecked under whichever single config R2.1 picks — at best a subset, at worst zero.

The spec needs to either (a) acknowledge it only covers the simple single-config-at-root case and document the no-op fallback for everything else, or (b) discover and run multiple configs.

**R2 — `--incremental` cold-cache disclosure failure.** `.tsbuildinfo` is invalidated when compiler flags change. Adding `--noEmit` to a project that normally builds with `tsc -b` (emit on) will cause `--incremental` to do a *full* recompile on first run — the very scenario the 5s incremental budget is meant to cover, blown out to a 30s timeout (R2.8). The spec promises < 5s incremental but the **first** prepare run after this feature ships will hit cold-cache rebuild times across the user's project. Worse, because R2 stores its build info in the same `.tsbuildinfo` location (or fights for it), running `--noEmit` then a normal `tsc -b` will alternate-invalidate the cache, regressing both build and review performance. Spec needs a dedicated `--tsBuildInfoFile <reviews-cache-path>` (or equivalent) so review-driven runs don't poison the user's project build cache.

**R2.3 / cascading errors filtered out.** TypeScript diagnostics propagate through imports. A return-type mismatch in `lib/foo.ts` (not in `allFiles`) commonly surfaces as a `TS2322` in `app/bar.ts` (in `allFiles`) where `bar` consumes the value. Filtering to `allFiles` keeps the symptom and discards the cause. The reviewer sees:

> `app/bar.ts:42 TS2322: Type 'string | undefined' is not assignable to type 'string'.`

— and no diagnostic in `lib/foo.ts` explaining where the `undefined` came from. R2.4 then asks the reviewer to triage "real bug introduced by this task vs. pre-existing vs. spurious" — but the upstream evidence has been discarded. The reviewer either re-runs tsc themselves (defeating the point) or guesses.

A safer design: include all diagnostics, but mark each as `inScope: boolean` based on `allFiles` membership. R1.2 / R2.4 directives can then tell the reviewer to focus on in-scope but read out-of-scope as context.

**R2.2 / `severity: 'warning'` is dead code.** `tsc --noEmit` produces *errors* (`TSxxxx`) and, with `--strict` family flags, more errors. It does not emit warnings — those are an editor convention (`Diagnostic.category` in the language service). `tsc` exits 0 for clean, non-zero for any diagnostic, all of which are errors. So `severity: 'warning'` is unreachable in this design unless the implementation conjures warnings from somewhere else (e.g. promoting "suggestion" diagnostics, which require the language service, not `tsc --noEmit`). Either drop `'warning'` from the union or document the exact source. Dead union members are how shape-mismatched test fixtures get written and slip past the reviewer.

**R2.4 / category misclassification.** The codebase has exactly two finding categories (`src/types.ts:203`, `src/tools/review-task.ts:76`): `'spec-compliance'` and `'hygiene'`. Hygiene signals (the precedent R2 cites) promote findings to `category: 'hygiene'` — see `src/tools/review-task.ts:423`: *"Promote real leftovers to findings with `category: 'hygiene'`."* R2.4 promotes type errors to `category: 'spec-compliance'`. That's an arbitrary fit:

- A type error introduced by the task is a **code defect**. It's not "this implementation deviates from the spec"; it's "this code doesn't compile."
- `'spec-compliance'` already carries semantic weight — it's about whether the implementation matches the requirements doc. Mixing in compile failures dilutes the signal for downstream consumers (the dashboard, anything filtering review output by category).
- The hygiene precedent argues for either a third category (`'defect'` / `'compile'`) or, less ideally, `'hygiene'` since the discipline is similar (deterministic check, surface for triage). `'spec-compliance'` is the worst of the three options.

This is contradicted by the explicit pattern in `src/tools/review-task.ts:425`: hygiene signals get their own category. R2.4 should follow suit.

**R2.4 / re-LLM-ifying the work.** "Triage each diagnostic — real bug introduced by this task, pre-existing, or spurious" is exactly the kind of judgment call the introduction promises to remove. Pre-existing-vs-introduced is determined by `git blame` on the diagnostic's line, which is *deterministic*. The spec should have prepare run `git blame` against the diagnostic's file/line and tag each diagnostic with `introducedByThisTask: boolean | 'unknown'` (unknown when blame is ambiguous, e.g. line was modified but not added). Then the methodology directive shrinks to "review the introduced ones; the pre-existing ones are FYI." That's a real shift; R2.4 as written just relabels LLM work.

**R2.5 / false-confidence on empty diagnostics.** Empty `typecheckDiagnostics` can mean:

1. tsc ran, scanned all `allFiles`, found no errors. ✅
2. tsc ran but tsconfig `exclude` covers some/all `allFiles`. The files were never typechecked. ❌
3. tsc ran on a wrapper tsconfig that types nothing (R2.1 case). ❌
4. tsc produced diagnostics but the parser dropped them (parse bug). ❌
5. All diagnostics were filtered out by R2.3's `allFiles` filter (cascading-error case). ❌ (or partially)

R2.5 says no directive when empty. The reviewer assumes case 1. Cases 2–5 are silent failures. Minimum viable fix: prepare must report which files in `allFiles` were *actually* covered by tsc's program (`tsc --listFiles`-style), and emit a directive when coverage is partial.

**R2.7 / non-zero exit ≠ diagnostics-present.** `tsc` non-zero exits include:

- `TS5xxx`: config errors (`error TS5023: Unknown compiler option ...`). No per-file diagnostics produced.
- `TS6xxx`: no input files matched, parse errors in tsconfig.
- Missing dependencies (`Cannot find module '@foo/bar'`) — these *are* per-file `TS2307` and would be parsed, but they often dwarf the actual changes.
- OOM or process crash.

R2.7 says "non-zero exit is fine because diagnostics caused it." The reviewer sees `typecheckDiagnostics: []` (nothing to parse from a config error) and assumes case 1 from R2.5. Spec needs to differentiate: parse what came back, but if zero diagnostics parsed and exit code is non-zero, set `typecheckDiagnostics: null` and emit a "typecheck did not produce usable output" methodology directive (parallel to R2.8's timeout flag).

**R2.8 / 30s timeout silent partial.** On a 100k-LOC monorepo, 30 seconds is well below cold-cache `tsc --noEmit` time (real numbers: 60–180s is typical). R2.8 says set `typecheckTimedOut: true` and "the methodology surfaces this." The methodology text isn't shown — the spec needs to mandate (a) the directive *explicitly* tells the reviewer to manually run tsc, and (b) the directive distinguishes "didn't run" from "ran clean," because the dashboard / consumers will treat `typecheckDiagnostics: undefined` and `typecheckTimedOut: true` very differently from `typecheckDiagnostics: []`.

## 3. Concurrency, Latency, and Process Hygiene

**R2.9 / `Promise.all` semantics vs. the spec's "degrade to absent" principle.** `Promise.all` rejects on first reject. If either utility throws, the other's result is discarded by the awaiter (though it still completes). The spec's reliability NFR says utilities "never throw out of `handlePrepare`" — fine, that means both resolve. But the diff utility resolves at ~200ms; the typecheck at up to 30s. `Promise.all` waits for the slowest. So even though diff is "ready" in 200ms, prepare's response is gated on typecheck. The spec's "wall-clock prepare latency = max(diff, typecheck)" is correct in the success case but it means **every** prepare call now pays typecheck latency. There's no "stream the diff while typecheck runs" path, and no "skip typecheck if it's clearly cold" early-out.

**Process leak on timeout.** R2.8 fires the timeout, but the spec doesn't say *how*. `execFile` with a `timeout` option sends SIGTERM by default. On Linux/macOS, `tsc` (Node process) handles SIGTERM and exits. On **Windows**, SIGTERM is simulated as `TerminateProcess` — the process dies but child processes spawned by `tsc` (rare but possible with project references) may orphan. More importantly, if the user's wrapper is `tsc` from a shell alias (`pnpm exec tsc` -> a node wrapper -> tsc), SIGTERM hits the wrapper; the inner process may keep running. The spec needs `killSignal: 'SIGKILL'` after a grace period, or a `detached: true` + process group kill.

**`cwd` and worktrees.** Spec doesn't say `git diff` runs with `cwd: projectPath`. If `projectPath` is a worktree (git worktrees, or a non-default checkout), `git diff` works fine because git resolves the worktree from `cwd`. If `projectPath` is a path *inside* a worktree (subdirectory), `git diff HEAD -- <absolute-path>` works. If `projectPath` is a symlinked path, behavior depends on git's symlink handling. Spec should mandate `cwd: projectPath` and absolute paths in pathspec. Currently silent.

**Env-var contamination.** `tsc` honors several env vars: `NODE_OPTIONS` (e.g. `--max-old-space-size=8192` — without this, large projects OOM), `TS_NODE_PROJECT` (irrelevant for plain tsc but indicates a confused environment), `FORCE_COLOR` (pollutes diagnostic parsing if unhandled). Spec doesn't say what env is passed. `execFile` defaults to `process.env`, which inherits everything from the MCP server's process. If the user runs the MCP server with their dev shell's env, tsc gets dev-shell env. If the server runs detached (e.g. as a daemon), tsc gets a stripped env and may OOM on a project that builds fine in the dev shell.

**Whose `tsc` is on PATH.** R2.6 says "neither in `node_modules/.bin` nor on PATH." The spec implies a search order: project-local first, global second. But the MCP server (`spec-workflow-mcp`) has its own `tsconfig` and likely its own dev dependency on `typescript`. If `node_modules/.bin/tsc` resolution starts from `cwd: projectPath`, fine. If it starts from the server's install dir (e.g. via `require.resolve('typescript')`), the *server's* tsc runs against the *user's* tsconfig. If the server pins `typescript@5.4` and the user's project uses `typescript@5.6` syntax (`using` declarations, etc.), the user's tsconfig parses fine but the source code emits parse errors. The reviewer sees noise. Spec must mandate resolution-from-projectPath only.

## 4. Methodology Surface and Reviewer Behavior

**R1.2 / "diff first" misses class-of-bugs.** Reviewing only the diff plus 3 lines of context catches local mistakes (off-by-ones, typos, obvious misuses) and misses:

- Invariant violations elsewhere in the file. A diff that adds `if (user.role === 'admin') ...` may break an invariant maintained by code 50 lines below ("only one admin check per request"). 3 lines of context don't show it.
- Naming consistency. The diff renames a parameter; 17 callers in the file aren't shown.
- Refactor splits. A 200-line function split into three. The diff shows the new functions; the call sites in unmodified regions of the same file are 3-line-context away.
- Architectural fit. Reviewer can't tell if the new code lives at the right layer without seeing what's next to it.

R1.2's "use `filesToReview` only for surrounding context that the diff hunks do not show" puts the burden on the reviewer to *know* when the diff is insufficient — without telling them what the diff is missing. Standard `git diff` is `-U3`. Reviewers historically want `-U10` or `-U20` for non-trivial changes. Spec should mandate a context size (`-U10` is a reasonable default) and *explicitly* tell the reviewer to read the full file when the diff hunks span >50% of the file's lines or when the change is structural (renames, splits, moves).

**R1.2 / breaks existing methodology golden tests.** `src/tools/__tests__/review-task.test.ts:100` pins a literal string for the existing item-9 hygiene directive. A similar pin almost certainly exists or will exist for the new items 1-8. R1.2 *rewords* existing reviewer instructions (the "read the files" directive becomes "read the diff"); this is a non-additive methodology change. The introduction's claim that the change is additive is wrong on this axis. Any consumer pinned to current methodology text breaks. Track 1 is **not** additive at the prompt layer.

**R2.4 / no exemplar text in the spec.** The NFR requires "concrete reviewer instructions, not prose," but the spec gives zero example wording. The implementer will write whatever feels right and the directive will drift over iterations. Spec must include the exact directive text (or a tight template) for at least:

- Diff present (R1.2)
- Diff empty fallback (R1.3)
- Typecheck diagnostics present (R2.4)
- Typecheck timed out (R2.8)
- Typecheck unavailable (R2.6)

Without these, "directive quality" is a black box and review regression risk is high.

## 5. Backward Compatibility and Cross-Track Coupling

**Tracks aren't independent.** R2.9 mandates concurrent execution via `Promise.all`. If track 2 ships first (typecheck only, no concurrency wiring needed because diff isn't present yet), then track 1 lands and the wiring is added retroactively. The retrofit point is `handlePrepare`, where both utility calls live. If track 2 ships with a synchronous-style invocation (`await runProjectTypecheck(...)`), track 1's diff has to be slotted in either before (sequential — blows the latency budget) or in parallel (refactor required). The spec's claim of independence is wrong on the integration point. Either:

- Land an empty `Promise.all` shell as a no-op refactor first, or
- Call out the dependency: track 2 first, then track 1's PR includes the parallelization.

**Schema validators.** New optional fields (`diff`, `diffStats`, `typecheckDiagnostics`, `typecheckTimedOut`) extend the response shape. Internal consumers in this repo are easy to enumerate (`task-review-runner.ts`, dashboard); external consumers (anyone who has wired up this MCP server in their own agent harness, the Claude Code MCP layer, etc.) are not. JSON Schema validators with `additionalProperties: false` will reject unknown fields. The spec must either confirm no consumer enforces strict schema, or add a migration note.

## 6. Out-of-Scope and Missing Coverage

- **JS-with-JSDoc projects.** `checkJs: true` projects are real and typecheck via tsc just fine. Spec covers them implicitly (tsc with the project's tsconfig will check them) but the introduction frames track 2 as "TypeScript projects." Mixed-language repos (TS + Python + Go) get nothing for the non-TS files; spec should call this out.
- **Diagnostic dedup / volume cap.** A refactor that breaks one widely-used type emits 200+ diagnostics on the same root cause. The spec response carries them all flat. Spec needs a per-response cap (say, 100 diagnostics) with a `truncated: true` flag, mirroring how hygiene signals would handle the same case (it doesn't — `computeHygieneSignals` has no cap either; that's a separate gap but worth noting).
- **Secrets/PII in diff.** A `.env` change in the working tree, accidentally on the modified-files list, gets dumped into `data.diff` and into LLM context. Hygiene signals don't currently scan `.env` (no precedent guard). Diff has no equivalent guard. Spec needs an explicit denylist (`.env*`, `*.pem`, `*.key`, `id_rsa*`, `**/secrets/**`) for diff and probably for hygiene signals too.
- **Token-budget accounting.** The motivation is "stop paying tokens for unchanged lines." But a 10k-line lockfile diff is worse than the original full-file approach, and the spec sets no upper bound on diff size. The promise of "shorter loop" silently inverts on lockfile-heavy tasks. Spec needs a documented total-diff-size cap (e.g. 50k bytes or 1k lines) with truncation behavior.
- **No rollout / feature flag.** If the new methodology degrades review quality on, say, refactor tasks (where diff-first review misses architectural issues), there's no way to detect and revert. Spec should mandate either a config flag (off by default for one release) or a side-by-side metric (review-finding count delta).

## Closing Deliverables

### Top 5 risks or gaps (ordered by severity)

1. **Diff under-coverage from log-vs-reality drift and partial commits (R1.1, R1.3).** The diff is positioned as the canonical reading source (R1.2) but its coverage is bounded by a self-reported file list and the working tree's current state. *Failure scenario:* agent commits half the work mid-task, prepare runs, diff shows the uncommitted half, methodology tells reviewer to use the diff first. Reviewer grades against half the changes. *Symptom:* tasks pass review with significant unreviewed code in HEAD.

2. **Wrong tsc invocation for monorepos and project references (R2.1).** `-p` against a project-references root config typechecks zero files. *Scenario:* user's repo has root `tsconfig.json` with `"references"` and per-package configs; modified files are in a subpackage. *Symptom:* `typecheckDiagnostics: []`, R2.5 emits no directive, reviewer concludes the code is type-clean while it's actually never been checked.

3. **Cascading-error filtering hides root causes (R2.3).** Filtering diagnostics to `allFiles` discards the upstream cause when a type error in an unmodified dependency manifests as a diagnostic in a modified file. *Scenario:* task modifies a consumer; a separately-broken provider (or a provider broken by the task in a file the agent didn't log) emits a type that the consumer can't accept. Reviewer sees the consumer's `TS2322` with no upstream context. *Symptom:* triage churn; reviewer either re-runs tsc themselves (defeating the feature) or files a wrong finding against the consumer.

4. **`Promise.all` blocks every prepare on the slowest of (200ms diff, up-to-30s typecheck) (R2.9).** No early-return for the diff. *Scenario:* small diff-only tasks now wait for a cold-cache tsc on a large monorepo. *Symptom:* review-loop latency regression on the very tasks the feature is meant to speed up. Cold-cache cost from the `--incremental` flag-change invalidation (R2 silent on this) makes the first run after rollout especially bad.

5. **Category misclassification of type errors as `'spec-compliance'` (R2.4).** The codebase's two-category taxonomy uses `'hygiene'` for the analogous deterministic-precomputed-then-triaged pattern. Spec contradicts that precedent without justification. *Scenario:* dashboard or downstream consumer filters findings by category; type-error findings drown out actual spec deviations. *Symptom:* category becomes a meaningless catch-all; existing hygiene/spec-compliance distinction degrades.

### Top 3 conclusions to challenge or reverse

1. **Claim: "the two tracks are independent and can ship as parallel PRs" (Introduction).** Counter: R2.9 explicitly requires the typecheck and diff to share `Promise.all` wiring inside `handlePrepare`. The methodology in R1.2 is non-additive (rewords existing reviewer instructions), which means the track 1 prompt change collides with any methodology-pinned tests added by track 2. Reverse to: "Track 1 (diff) and track 2 (typecheck) share the prepare-handler concurrency seam and the methodology builder; they must be sequenced or co-designed, not shipped in parallel."

2. **Claim: "diagnostics are filtered to `allFiles`" (R2.3).** Counter: cascading errors mean the in-scope diagnostic is the symptom, not the cause. Filtering destroys the evidence the reviewer needs to triage. Reverse to: "Return all diagnostics, tag each with `inScope: boolean`. The methodology directs the reviewer to focus on `inScope=true` and use `inScope=false` as upstream context."

3. **Claim: "type-error findings get `category: 'spec-compliance'`" (R2.4).** Counter: contradicts the established hygiene-signals precedent (`category: 'hygiene'` for deterministic-precomputed-then-triaged findings) cited in the spec's own NFRs. Type errors are code defects, not spec deviations. Reverse to: either introduce a third category (`'defect'`/`'compile'`) or, as a smaller change, reuse `'hygiene'` for parity with the analogous mechanism. `'spec-compliance'` is the wrong choice.

### What's missing — work to be done before this spec moves to design

- **Concrete methodology directive text** for all five branches (diff present, diff empty, typecheck present, typecheck timed out, typecheck unavailable). Without exemplar text the NFR is unenforceable.
- **Monorepo / project-references handling decision**: pick one — (a) document single-config-at-root only and explicitly `null` out diagnostics for everything else, (b) discover and run multiple configs, or (c) use `tsc -b` and accept the different invocation semantics.
- **Cross-track dependency clarification** in the introduction: which track lands first, where the `Promise.all` seam goes, whether methodology golden tests are co-updated.
- **Token-budget caps and truncation behavior** for diff (per-file and total), for diagnostic count, and for binary-file handling. Pick concrete numbers.
- **Secrets/PII denylist** for the diff path filter, with the same coverage applied to hygiene signals (separate gap but should be addressed jointly).
- **Process-kill semantics** for typecheck timeout (signal, grace period, Windows behavior), and **env / cwd contract** for both child processes.
- **Diagnostics-shape decisions**: drop `'warning'` from the severity union or document its source; distinguish "tsc ran clean" from "tsc emitted no parseable output despite non-zero exit" (R2.7) at the response-shape level, not just the methodology level.
- **diffStats source**: pick parser-of-diff-output OR `--numstat`, not both.
- **Coverage reporting**: response should say which `allFiles` paths were actually covered by the tsc program (defeats the R2.5 false-confidence failure). Same for diff coverage when partial commits split the change set.
- **`introducedByThisTask` tagging** via `git blame` per diagnostic, so R2.4's triage call shrinks to a deterministic check rather than re-introducing LLM judgment work.
- **Rollout gate**: feature flag or shadow-mode comparison so methodology-quality regressions are detectable.
