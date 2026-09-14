# Adversarial Review — `tighter-reviews` Requirements (v3)

You are a senior staff engineer with deep experience in build tooling, git internals, TypeScript compiler integration, and the operational behavior of long-running developer-tools servers. Your job is to tear apart the requirements document at:

`/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/requirements.md`

You are not here to validate the design or pat the author on the back. You are here to find the failure modes the author missed. Be specific, cite concrete failure scenarios, and reverse conclusions where the author got it wrong.

---

## Prior Review Context

This is the **third** adversarial review of this requirements document. Two prior reviews identified ~25 substantive issues, the majority of which the author addressed in the current draft. Detailed memory:

`/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-memory-requirements.md`

**Summary of prior outcomes:**

- v1 attacked the *thesis* (deterministic shift, denylists, process safety, response shape choices). Most concrete v1 findings shipped: denylist composition, token caps, `Promise.all` seam, SIGTERM escalation, env contamination guards, dedicated tsbuildinfo, `--numstat` for stats.
- v2 attacked the *coverage gaps and configuration boundaries*: empty diagnostics ≠ ran clean, partial-commit diffs, R3 precedence at null/empty/unknown-key boundaries, settings-read timing, methodology directive composition with item-9 hygiene, track-merge contention. Most v2 findings shipped: `--listFiles`-derived `coverage.compiled`/`coverage.excluded` (R2.4) and partial-coverage directive (R4.5); `diffPossiblyStale` flag (R1.11) and diff-stale directive (R4.3); R3 edge-case semantics (R3.5: empty string fallback, null absent, unknown keys ignored); per-request settings read with mtime cache and once-per-process warnings (R3.7); grouped config shape pivoted from flat `models: {...}`; rename removed from R4.1 fallback triggers; mandatory track sequencing; composite-pin test enumeration (R4.10); R3 docs deliverable in same PR (R3.11).

**What is now off-limits unless you have a genuinely novel angle:** diffstats source, severity union, category-for-type-errors, cascading-error inScope tagging, *existence* of methodology directives, process-kill signal escalation, FORCE_COLOR for tsc, Promise.all seam, grouped-vs-flat R3 shape, retry-uses-same-model, rename as a fallback trigger, diff-empty embedded shell, R3 read timing/cache/warning semantics, R3 docs ownership, track sequencing as convention vs. mandate (the mandate has been chosen — attack its *consequences*, not the choice).

**Classification.** For every finding you produce, classify it as:
- **Novel** — not identified in any prior review.
- **Compounding** — deepens or builds on a prior finding (cite which one).
- **Recurring** — the same issue was raised in v1 or v2 and is still present; escalate severity and explain why the current mitigation is insufficient.

The previous reviewer was thorough. If you are tempted to re-discover an already-settled issue, stop and pick something the prior reviewers missed.

---

## Analysis Dimensions

### 1. The new `diffPossiblyStale` heuristic (R1.11) is more fragile than it looks

R1.11 sets `data.diffPossiblyStale: true` when the implementation log's latest entry timestamp is older than the most recent HEAD commit timestamp. This is a load-bearing signal — R4.3's diff-stale directive is the spec's only mechanism for the partial-commit case. Find the failure modes:

- Challenge whether timestamps from two unrelated systems (a JSON log file's recorded time vs. git's commit timestamp) can be compared meaningfully. Examine clock skew between the agent process that wrote the log and the developer's git config (TZ, system clock drift, CI containers vs. local).
- Stress-test interactions with git history rewrites: `git commit --amend` (rewrites commit time on amend), `git rebase`, `git filter-branch`. After any rewrite, the commit timestamp can be older than the implementation log entry while the actual code state is newer.
- Examine the race window: the agent writes the implementation log entry, *then* runs `git commit`. There is a window where the log timestamp is older than the commit it just made. Does the heuristic false-positive here?
- Consider implementation logs shared across multiple tasks (one task complete-and-committed, another in progress). The "latest entry for the task" qualifier helps — but is the per-task scoping reliable? What if the agent appends to the log mid-task without an intermediate commit?
- Examine repos with no commits, shallow clones with truncated history, `--allow-empty` commits, detached-HEAD review sessions. Each is a way the heuristic returns nonsense.
- The directive R4.3 says "open the files in `filesToReview` and compare against the implementation log's described changes — the diff is a partial view." But `filesToReview` is itself derived from `allFiles`, which the partial-commit case implies may be stale. Is the fallback chain self-consistent?

### 2. `--listFiles` parsing reliability (R2.1, R2.4)

R2.1 mandates `tsc --noEmit ... --listFiles --pretty false` and uses the output to derive `coverage.compiled` and `coverage.excluded`. This is the spec's answer to v2's "empty diagnostics ≠ ran clean" critique. Attack the parsing:

- Challenge the assumption that `--listFiles` output format is stable across tsc versions the user might have installed. Find concrete cases where output format has shifted (e.g. `--listFiles` output interleaves with diagnostics; resolved-path normalization differs across tsc versions; relative vs. absolute path emission). The spec is silent on tsc-version compatibility.
- Stress-test path comparison between `--listFiles` output and `allFiles`. `--listFiles` emits resolved paths (after symlink resolution); `allFiles` is whatever the implementation log recorded. On macOS-default case-insensitive HFS+/APFS or Windows, comparison can succeed or fail in surprising ways. Symlinks in node_modules or in a monorepo's package layout produce two different absolute paths for the same file.
- Examine what happens when `--listFiles` succeeds but its output is interleaved with diagnostic output, error messages, or progress indicators. The spec assumes the parser cleanly separates the two streams. Is the assumption justified? Where exactly does the format spec live?
- Consider the interaction between `--listFiles` output and the `--incremental`/tsbuildinfo cache. If the cache is reused, does `--listFiles` still emit the full program file set, or only files that were re-checked?
- The `coverage.compiled` and `coverage.excluded` lists are now consumed by R4.5's partial-coverage directive. If parsing fails silently (e.g. emits an empty `compiled` list), the directive falsely claims no files were compiled, telling the reviewer to manually scan everything — the same regression the spec was trying to fix.

### 3. The `diffPossiblyStale` directive (R4.3) and the `coverage.excluded` directive (R4.5) — wording attacks

The two new directives added in this revision are now load-bearing. Attack the strings themselves:

- R4.3 says "the rest of the changes are already in `HEAD` and not represented here." This is a strong claim the heuristic cannot actually substantiate — `diffPossiblyStale` is set on a *timestamp comparison*, not on actual evidence that committed changes exist. The directive overstates what the signal proves.
- R4.5 instructs the reviewer to "manually scan the listed paths for type errors and structural issues." This is the same regression v2 §3.4 caught for R4.6 (typecheck-unavailable degrading to LLM hunting). The spec applied the "this is a degraded review surface" framing to R4.6/R4.7 but *did not* apply it to R4.5. The partial-coverage case is silently degraded with no acknowledgement to the reviewer that they're being asked to do pre-spec work for the excluded files.
- Examine whether R4.3 and R4.1 conflict. R4.1 instructs "Read the diff first." R4.3 (which is emitted in addition to R4.1 when stale) instructs "open the files in `filesToReview` and compare against the implementation log's described changes — the diff is a partial view, not the authoritative one." Two directives composed give the reviewer contradictory primary instructions about which artifact is the source of truth. Pick which one wins, in spec, not at LLM-runtime.
- R4.4's "(c) spurious" classification is asked of the reviewer with no definition of what makes a tsc diagnostic spurious. tsc rarely emits false positives; this clause invites the LLM to hand-wave away findings it doesn't understand. Examine whether this clause does more harm than good.

### 4. Configuration complexity and operability of R3 + features

R3's edge-case semantics resolved most of v2's specific complaints, but the cumulative complexity is a new defect candidate. Attack the operator experience:

- A user reading their `adversarial-settings.json` cannot tell from the file alone what their effective config is. Precedence depends on which fields are present, whether legacy `model` is set, whether sub-objects are null/empty/object/string, whether the runner cache has stale parsed state. Challenge the claim that this is operationally usable without a `--print-effective-config` or equivalent diagnostic.
- The mtime-keyed cache (R3.7) assumes mtime advances when the user edits the file. Several common cases violate this: editors that write atomically by replacing the file (mtime changes — fine) vs. editors that write in place on filesystems with second-resolution mtime (a within-second edit may not advance mtime). Network filesystems (NFS, SMB, WSL2 mounts of Windows filesystems) have known mtime-precision issues. The "settings-read cache" can hand back stale parsed config indefinitely on these setups.
- The "warn once per process lifetime, cleared on mtime change" semantics (R3.7) interacts with the cache: if the cache says the mtime hasn't changed, the warning isn't re-emitted, but if a fix-then-rebreak happens within the same mtime tick, the user gets *no warning at all*.
- The `features.typecheck: false` kill switch is documented but `features` as a top-level config block is undocumented in the spec's example config (line 38 in requirements.md shows `"features": { "typecheck": true }`). Where does the documentation for `features` live? Is the schema for `features` open-ended (other future kill switches), or is `typecheck` the only knob?
- Examine the failure mode where two MCP server instances watch the same `adversarial-settings.json` (e.g. dashboard + CLI). Each has its own cache, its own once-per-process warning. The "operationally quiet" promise of R3.7 is local to one process; cross-process behavior is unspecified.

### 5. Mandatory track sequencing as a hard requirement — operational consequences

The "Track sequencing (mandatory)" section promotes A→B→C from convention to a hard requirement. This is the right call for the *technical* defect (silent methodology drift between tracks), but it introduces process-level rigidity the spec doesn't address. Find the cracks:

- An emergency fix to `multi-server.ts` — say a security patch in `handlePrepare` — must land between tracks. The fix is unrelated to A/B/C but touches the file. Does it merge? Is it permitted to ship under the mandatory sequencing rule? The spec is silent.
- Track A's PR fails CI for a week (e.g. tests flake on a dependency upgrade). Track B is otherwise ready. The spec's mandate says B can't land until A does. What's the escape valve?
- A reviewer of Track A discovers a defect that requires re-design. Is Track B blocked indefinitely? The spec offers no "skip the rework, ship B against current `main`" path.
- The mandate is enforced by *what mechanism*? CI doesn't know about track ordering. Code review knowledge? File a CODEOWNERS rule? The spec asserts a mandate without specifying its enforcement, which usually means it isn't enforced.
- R4.9 says the interim Track-A composite is "not a deprecated artifact — it is the correct output for that intermediate code state." But any external consumer of `buildReviewMethodology` output (telemetry, audit logs, replay tooling) sees a real shape change between A and B. The spec dismisses this as fine; examine whether it actually is.

### 6. Composite-pin test architecture brittleness (R4.10)

R4.10 mandates pinning the *full composite output* of `buildReviewMethodology` for representative inputs. Per-track scenarios are enumerated. This is a deliberate brittleness — every directive change cascades through every pinned scenario. Attack the consequences:

- A typo fix in a single word of R4.4 (typecheck-present) requires updating every Track-A pin scenario AND every Track-B pin scenario. Multiply by the number of typecheck-result shapes. Examine the cardinality and the developer cost — and whether this brittleness is proportional to the value of catching unintentional drift.
- The interim Track-A pin (R4.9) needs explicit retirement when Track B lands. The spec says "Track B's PR replaces it with the full composite" but does not say *delete the Track-A pin* vs. *keep it as a regression test*. Pick one in spec.
- Pinned tests assert against the composite. If `buildReviewMethodology` is refactored (e.g. helper extraction), the public output is the contract — fine. But if the composition order is internally re-shuffled in a way that produces semantically equivalent output but textually different (e.g. a trailing newline, a list-marker change), every pin breaks for no reviewer-visible reason.
- Test-fixture generation: where does the canonical "expected" composite come from? If it's generated from the implementation, the test is tautological. If it's hand-authored, drift between hand-authored fixture and emitted directive is the same brittleness back in a different file. The spec should pick one.

### 7. Denylist completeness (R1.5) — negative-space attack

R1.5's denylist is now applied to both diff and hygiene (closes a v1 gap). The list is concrete: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `*.lock`, `*.snap`, `*.min.js`, `*.min.css`, `*.map`, `.env`, `.env.*`, `*.pem`, `*.key`, `id_rsa*`, `id_ed25519*`, `**/secrets/**`, `**/credentials/**`. Attack the omissions:

- Cross-language lock files: `Cargo.lock`, `go.sum`, `poetry.lock`, `Pipfile.lock`, `Gemfile.lock`, `composer.lock`, `mix.lock`. Mostly caught by `*.lock` — but `go.sum`, `poetry.lock`, `Pipfile.lock`, and `Gemfile.lock` aren't `.lock`-suffixed.
- Auth-bearing dotfiles outside the patterns: `.npmrc` (with `_authToken`), `.netrc`, `.pypirc`, `.docker/config.json`, `.aws/credentials`, `.kube/config`, `.gitconfig` with embedded credentials in remote URLs.
- Common ignored build outputs and caches: `dist/`, `build/`, `.next/`, `.turbo/`, `coverage/`, `node_modules/`. None of these are denylisted explicitly, though `gitignore` typically excludes them. Stress-test the case where the user has *committed* one of these by accident.
- TypeScript build artifacts: `*.tsbuildinfo` (the spec's own dedicated tsbuildinfo lives in `.spec-workflow/.cache/`, but the project's own one might also exist and be in the diff).
- Test-fixture content that *mimics* secret-bearing patterns (e.g. tests for the denylist itself, or test fixtures with mock keys) — false positives that strip legitimate review content.
- Examine whether `**/secrets/**` and `**/credentials/**` use the same pathspec semantics across `git diff -- <pathspec>` and the hygiene-utility's matcher. Pathspec syntax is git-specific; if the hygiene utility uses `minimatch` or a custom matcher, the same pattern can match different sets of files.

### 8. New OOS items and forward-compatibility claims

The Out of Scope (v1) section is now eight items (originally five). Forward-compatibility claims attached to several items deserve scrutiny:

- "diff: string reshaping for future multi-config support" — accepts a future schema break. Examine whether external consumers (other MCP servers, CLI tools that consume the response) get any migration runway, or whether this future spec just breaks them.
- The grouped R3 shape claim (Configuration shape section) says it "extends naturally" to per-runner `cliArgs`, `cli`. Examine whether this is actually true: when `cli` becomes per-runner, the `cli` field at the top level (currently `"cli": "claude"`) becomes ambiguous — does the global default still apply when a runner doesn't specify? The spec says yes implicitly (NFR Code Architecture: cli/cliArgs are still global) but doesn't pin the resolution rule for the *future* mixed case.
- The "implementation-log validation" follow-up spec referenced for `git status` cross-check — is it actually planned, or is it a placeholder? The spec accepts `allFiles` at face value as the single coverage anchor; if the follow-up never materializes, the v2 §2.4 "single coverage anchor" critique remains permanently unmitigated.

---

## Closing Deliverables

End your analysis with:

1. **Top 5 risks or gaps**, each citing the requirement section, classified as Novel / Compounding / Recurring, with a concrete failure scenario the spec does not handle.
2. **Top 3 conclusions to challenge or reverse**, with specific reasoning. Identify decisions where the spec's framing or mitigation is wrong, not merely incomplete.
3. **What's missing** — the work that should be done before this spec moves to design. Be specific: "define X behavior at Y boundary" beats "spec is incomplete."

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on. Do not pad with praise. Your job is the gaps; the author can defend the parts that are working.

Write your analysis to:

`/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-analysis-requirements-r3.md`
