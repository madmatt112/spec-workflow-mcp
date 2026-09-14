# Adversarial Review — `tighter-reviews/design.md` (round 4)

You are a senior staff engineer with deep experience in long-running Node.js daemons, JSON schema evolution, TypeScript tooling internals, cross-platform path semantics, and the operational realities of multi-handler HTTP servers maintaining durable state. You have been brought in cold to tear apart a design document that has already survived three adversarial review rounds. The author is convinced the remaining surface is small. **Your job is to find what they missed, not to validate what they got right.**

The target document is at `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/design.md`. The corresponding requirements are at `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/requirements.md`. Read both before attacking.

The spec covers three tracks: **Track A** (pre-computed `tsc --noEmit` diagnostics surfaced in `review-task prepare`), **Track B** (a diff-first review context replacing whole-file reading), and **Track C** (per-runner model selection in `adversarial-settings.json`). Each track lands behind structured methodology directives (R4.x) and produces additive `data` fields on the prepare response. The orchestration wraps three async utilities in `Promise.allSettled` with `unwrap*` helpers that convert rejections into structurally-distinct degraded states. The author has invested heavily in reliability claims: "no I/O throw escapes," "structural guarantees not coding conventions," "single source of truth for precedence."

## Prior Review Context

Three prior rounds have already happened. Their findings — and the v4 design's responses — are summarized in `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-memory-design.md`. **Read that memory file before attacking.** The most relevant facts:

- **v3 review found 12 issues; the v4 design has named-resolved every one.** This includes `validateAllFiles` per-element try/catch, R4.2a/R4.2b split, tsc multi-line continuation parsing, `(utility, error.message)` warn-once key, `partitionPaths` segment splitting on both `/` and `\`, realpath-based inside-projectPath check, `EXPECTED_R4_BLOCK_COUNT = 8`, whitespace-run collapse normalization, distinctive Track-A interim marker, and an entirely re-architected Track C using **annotation persistence** instead of closure capture.
- **Track C went through three architectures in three rounds** (per-callsite resolution → closure capture → annotation persistence). The v4 architecture is wholly new surface area. Pry hard there.
- **Areas well-covered (do not re-examine in depth)**: Promise.allSettled orchestration, `loadSettings` read-throw containment, `validateAllFiles` existence as a helper, the v4 R4.2a/R4.2b prose split as a concept, the v4 typecheck Pass 1 continuation absorption as a concept, the existence of an `EXPECTED_R4_BLOCK_COUNT` constant, the existence of cross-platform separator splitting in `partitionPaths`. Don't re-discover that these mechanisms exist; instead, find ways they fail or interact poorly.
- **Carry-forward unresolved**: `.gitignore` for `.spec-workflow/.cache/`, multi-config R4 prose lockstep enforcement, concurrent-prepare silent corruption observability, two-warning-per-file-edit malformed-warn semantics. Re-mention only if you find new severity escalation.

**Classify every finding** as one of:
- **Novel**: Not identified in any prior review.
- **Compounding**: Builds on or deepens a prior finding (cite which round and item).
- **Recurring**: Same issue identified before, still unresolved — escalate severity and explain why the v4 design's response is insufficient.

Re-discovering a finding the v4 design has already addressed is a failure mode for this round. If you believe a finding still applies despite the v4 design's response, you must explain *why* the response is incomplete or incorrect — not just restate the original concern.

## Analysis Dimensions

### 1. Annotation persistence as Track C's new mechanism

This mechanism replaces closure capture entirely. It is the largest architectural change in v4 and the most likely place for novel findings.

- Challenge the claim that "annotation persistence is a structural guarantee, not cache coincidence" (design.md:9, 47). The annotation is a JSON-encoded string field on `Approval`. Stamp the annotation, then invoke the runner. What is the failure mode if `stampAnnotationRunnerOptions` succeeds but `runner.run(...)` is invoked under a different code path that happens to construct a fresh `RunnerOptions` (e.g., an integration test stub, a future callsite)? The "structural" guarantee is enforced by which code path, exactly?
- Stress-test concurrent initial-review requests for the same approvalId. Two requests arrive in quick succession. Both call `stampAnnotationRunnerOptions` with potentially different resolved models (settings file edited between resolutions). What does `approval.annotations` look like after both writes? What does the *next* retry observe? Is there a last-write-wins guarantee, or is this undefined?
- The design says "the retry handler SHALL NOT mutate `runnerOptions` — only the initial handler writes; retry only reads" (design.md:432). What enforces this beyond convention? What if a future spec adds a `retryStartedAt` field that the retry handler does write — does that touch `runnerOptions`? Are there schema-level boundaries or is this purely social contract?
- Probe the read-time JSON parse failure path. The retry handler reads `parseApprovalAnnotation(approval.annotations)`. What if the annotation string is corrupted (encoding bug, partial write, manual edit)? The design's error scenario #16 covers *write* failure. The *read* failure path is unspecified — does retry crash? Fall back to legacy? Log? The R3.9 contract is silent on this.
- Challenge the field name `runnerOptions`. It is generic. A future spec wanting per-task overrides may want the same name with different semantics. The design at line 432 says "Unknown keys under `runnerOptions` are silently ignored (forward-compat for future per-runner persisted fields)" — but this collides with the case where a future spec adds `runnerOptions.attempt` or `runnerOptions.budget` that the v4 retry handler should *not* silently ignore.
- Examine the warn-once key for legacy-annotation fallback (`'multi-server:retry-legacy-annotation' + approvalId`, design.md:359). In a long-running daemon serving many legacy approvals, this fires once per approvalId per process. What is "many" in practice? If it's hundreds of legacy approvals per day, the warn-once key shape may need to be coarser (per-process-once after first occurrence) — but coarser dedup loses the diagnostic signal.

### 2. `validateAllFiles` realpath subtleties beyond the v3 fix

The v4 design at lines 234, 246, 264–265 introduces realpath-based inside-projectPath checking. The v3 review caught the basic symlink-pointing-outside case. The v4 design says the `try/catch` "wraps every fallible step." Probe what's actually inside vs outside the `try/catch`.

- The `safeRealpath(projectPath)` call at design.md:234 is **outside** the per-element loop's try/catch. If `realpathSync` on `projectPath` throws ELOOP (symlink loop), EACCES, or ENAMETOOLONG, what catches it? `safeRealpath` is described as "catches ENOENT and returns undefined" — what about other errors? Is `validateAllFiles` actually exception-safe in this case, or does it throw out of `handlePrepare` despite the v3 fix?
- Walk through Windows reparse-point semantics. `realpathSync` on Windows handles junctions, symlinks, and other reparse-point types differently. Some are followed; some aren't. A junction inside `projectPath` pointing outside *might* still resolve to a path that "looks inside" because realpath stops at the junction boundary in some Node versions. Is the v4 inside-projectPath check correct on Windows, or is the design implicitly POSIX-only?
- TOCTOU between `validateAllFiles` and the consumer utility. `validateAllFiles` realpaths a path; ten microseconds later `git diff` operates on the path. If a symlink is replaced or a junction redirected mid-prepare, git operates on a now-different file. Is this a security concern (e.g., a malicious agent racing the prepare flow to make git diff a file outside the project)? Or accepted noise?
- The safeRealpath ENOENT case ("files deleted between log-implementation and prepare don't break validation") — when `realpathSync` returns undefined, the **original `resolved` path** is used for the inside-projectPath comparison. If the original path *happens* to start with `realProjectPath + path.sep`, it passes the check. But the original path may be a symlink whose target was outside; we just couldn't realpath it because the file is gone. Does the design correctly fail-safe (drop) in this ambiguous case, or fail-open (keep)?

### 3. tsc Pass 1 continuation parser correctness

The v4 design at design.md:174 introduces continuation-line absorption. The v3 review caught that continuations were dropped. The v4 fix could over-absorb or misclassify.

- Walk through tsc output where a *non-continuation* line happens to start with whitespace. Some tsc outputs emit `   /usr/local/lib/foo.ts` (indented absolute path in pretty=false rare configurations) or relative paths like `   src/foo.ts:42`. The Pass 1 rule "starts with whitespace AND not absolute-path-shaped" — does a relative path get absorbed as a continuation? The path-shape regex (`^[A-Za-z]:[\\/]` or `^/`) is absolute-only.
- TS2418 / TS2417 emit "related diagnostic from..." continuation blocks that *are* themselves diagnostic-shaped (`src/bar.ts(10,5): error TS...`). Pass 1's stop rule means these start a new diagnostic. Is this correct — they appear as separate top-level diagnostics with no link to the parent? The reviewer triages them as independent type errors when they are in fact related context for a single error.
- Unicode in paths. The path-shape regex `^[A-Za-z]` (Windows) doesn't match drive letters from non-ASCII locales (rare but possible). The POSIX regex `^/` is fine. But a path starting with non-ASCII directory names — does Pass 2 correctly include these in listFiles output, or does the path-shape check exclude them?
- Pass 2 is "lines not consumed by Pass 1." If Pass 1 absorbs a line as continuation that *should* have been listFiles output, that path is silently dropped from `coverage.compiled`. Verify: tsc with `--listFiles` interleaves listFiles output with diagnostics in some configurations (depending on internal file iteration order). Walk through a fixture where a continuation absorption boundary lies adjacent to a listFiles emission.
- The 100-diagnostic cap with truncation. After Pass 1 absorbs continuation, what counts as a "diagnostic" for cap purposes — the head only, or the full multi-line? If it's the head, an in-scope diagnostic with 8 continuation lines uses one slot. But the resulting `message` field is potentially huge. Is there a per-diagnostic message size cap? A 10 KB message field times 100 diagnostics is 1 MB of payload in the prepare response.

### 4. `EXPECTED_R4_BLOCK_COUNT` lockstep enforcement and drift-test architecture

The v4 design at line 495 encodes `EXPECTED_R4_BLOCK_COUNT = 8`. The v3 review caught the silent partial-loss case. The v4 fix relies on author discipline.

- Challenge the claim that the constant prevents drift. The lockstep discipline says "update the constant when adding/removing R4.x blocks." A future author adds R4.3 (re-introduced as some new staleness signal) and forgets to update the constant. The drift test fails — *which* block is missing? The test message is "extractor returned 9, expected 8." The author then has to count blocks manually. Is there test output that names the new block?
- The extractor matches "both `> ...` block-quote and ` ```...``` ` fenced-block delimiters." The R4 prose currently uses block-quote exclusively. If a future R4.x is written as a numbered list (e.g., `1. **Read the diff first.** ...`), neither delimiter matches, the extractor returns 7, the constant says 8 — the test fails. The author may then flip the constant to 7 to make the test pass, silently losing one directive's coverage. Is there a defense beyond "the test fails so someone investigates"?
- The whitespace-run collapse normalization (v4 fix for v3 Finding 7) absorbs reflow. But it also absorbs paragraph breaks: `**Read first:**\n\n` becomes `**Read first:** `. If a fixture splits a multi-paragraph directive by paragraph break and R4 has it as a single paragraph (or vice versa), the comparison succeeds when it shouldn't have. Is the directive boundary detection at line 491 (delimited by `**Read first:**`, item-9, item-10 markers) robust to collapsed paragraph breaks?
- The two-way drift test in Direction B requires every fixture sentence to appear as substring of *some* R4.x block. With 8 R4.x blocks, a sentence may match in an R4.x block that isn't *the one the fixture was generated from*. A fixture for R4.6a contains a sentence that happens to also appear in R4.6b. Direction B passes. But the fixture may have been mis-generated (R4.6a content placed in R4.6b's fixture file), and Direction B doesn't detect the misplacement.

### 5. Composition of the new R4.2b directive with cross-axis fixtures

The v4 design adds R4.2b for diff-utility rejection. Cross-axis fixtures (R4.10) cover four combinations. None covers `diff-rejected + typecheck-{rejection,timeout,partial-coverage}`.

- Stress-test the maximally-degraded state: both diff and typecheck reject in the same prepare. The methodology composes R4.2b ("surface the rejection in your review summary, quote `data.diffRejection.message`") with R4.6b's "rejection" reason ("surface this degradation in your review summary"). Two surfacing asks. Does the reviewer surface both rejections, or does one ask cancel the other? The composite-pin tests don't cover this.
- The four cross-axis fixtures are: `success-partial-coverage + diff-empty`, `timeout + diff-truncated`, `unavailable-other + diff-truncated`, `success-with-diagnostics + diff-empty`. None of them probes R4.2b. The v4 design added R4.2b to mirror R4.6b's split, but the cross-axis fixture *list* wasn't extended in lockstep. Is this a fixture-coverage gap, or is single-axis pinning sufficient?
- The v4 R4.2b prose says "this is a degraded review surface, not a benign empty diff." The R4.5 partial-coverage prose says "you are operating in pre-spec methodology mode for the excluded files." The R4.7 timeout prose says "operate in pre-spec methodology mode for type-checking." Three different rhetorical framings of "fall back to manual." When two compose, are they consistent? A cross-axis fixture for `diff-rejected + partial-coverage` would either reveal redundancy ("manually scan files" said twice) or contradiction.

### 6. `partitionPaths` cross-platform splitting edge cases

The v4 design fixed cross-platform path-segment splitting (v3 Finding 8). Probe the edges of the fix.

- Windows drive letter. `C:\proj\secrets\foo.json` split on both `/` and `\` yields `['C:', 'proj', 'secrets', 'foo.json']`. The `'C:'` segment — is it ever case-folded and compared against a denylist entry? If a future denylist entry is `'c:'` (lowercase, intended to denylist a directory named `c:`), the drive letter accidentally matches. Conversely, if a path on Linux happens to contain a directory named `aws:` (legal on Linux), it splits as `['aws:']` — does this segment accidentally match the `.aws` denylist entry?
- UNC paths on Windows. `\\server\share\secrets\foo.json` split on both separators yields `['', '', 'server', 'share', 'secrets', 'foo.json']` — empty leading segments. Does the path-segment matcher correctly handle empty segments? Does an empty-string denylist entry (which shouldn't exist but might be introduced via a typo or config bug) accidentally match every path?
- Symlinks on Linux pointing across a device boundary or a mount point. If `validateAllFiles` realpaths the entry, the realpath crosses the mount and produces a path like `/mnt/foreign-fs/secrets/foo.json`. Does `partitionPaths` correctly identify `secrets` as a denylisted segment? Or does the realpath transform mask the segment match because the original path had `secrets` in a different position?
- The case-folding rules state "secret-bearing always; lock/binary platform-conditional; path-segments unconditional." On case-insensitive macOS APFS volumes (deferred concern in v1), are lock-file matches case-folded? The v4 design says "case-folded only on case-insensitive volumes" — but volume detection by `process.platform === 'darwin'` is wrong (APFS volumes can be case-sensitive too). Is this a recurring concern with new severity?

### 7. Operational concerns at scale: long-running daemons and observability gaps

The MCP server runs as a daemon. Many findings in prior rounds touched daemon behavior. Probe what's left.

- The `.spec-workflow/.cache/` directory is created by the typecheck utility but no setup step adds it to `.gitignore` (recurring unresolved). A user committing `.spec-workflow/.cache/tsc.tsbuildinfo` cross-machine hits stale buildinfo on another machine and gets `'no-parseable-output'` (silently degraded). The fix is one line in the install/setup path. Why is this still unaddressed in v4? Is the rejection reasoning in prior memory still valid given the design now actively writes to this directory?
- Concurrent prepare against same project — silent corruption with documented recovery is `rm <projectPath>/.spec-workflow/.cache/tsc.tsbuildinfo`. **How does the user detect corruption?** tsc emits a buildinfo-related warning to stderr and rebuilds; the prepare flow doesn't surface this to the user. Silent corruption + silent rebuild = user discovers nothing wrong, but typecheck took 30s on every prepare. Is "documented unsupported" sufficient when the failure mode is unobservable?
- The 30s timeout SIGTERM → 2s grace → SIGKILL escalation. On Windows, `process.kill('SIGTERM')` is `TerminateProcess`, which is *immediate*, not graceful. The 2-second grace is a no-op. The v1 Out of Scope says "deeper Windows hardening is a v2 concern," but the contract claim "SIGTERM → 2-second grace → SIGKILL" is unverifiable on Windows. Should the design state this is POSIX-only, or claim cross-platform with the Windows degradation explicit?
- Memory growth in the settings cache. `loadSettings` caches by `(absPath, mtime, size)`. In a long-running daemon serving multiple project paths, the cache grows unbounded. Is there an eviction policy? A multi-project daemon serving 100 projects accumulates 100 cache entries; at 4 KB JSON each, this is 400 KB — small. But the warn-once flags are also keyed per absPath; that's 100 boolean flags. Acceptable, but is it bounded?

## Closing Deliverables

Conclude your analysis with:

- **Top 5 risks/gaps**, ranked by severity. For each: classification (Novel / Compounding / Recurring), location (file:line), the failure scenario, and a concrete fix. Severity ranking should reflect both probability and blast radius.
- **Top 3 conclusions to challenge or reverse.** Quote the conclusion verbatim from design.md or requirements.md, then state what should replace it and why.
- **What's missing** — concrete pre-implementation work items. Each item should be actionable: a contract to pin, a test to add, a sentence to insert into the design.

Be specific and concrete. Cite failure scenarios, not abstract risks. Quote line numbers. If something is actually fine, say so briefly and move on. The author has earned the benefit of the doubt on the well-covered surface; spend your attention on the new surface and the carry-forward gaps.

Write your analysis to `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-analysis-design-r4.md`.
