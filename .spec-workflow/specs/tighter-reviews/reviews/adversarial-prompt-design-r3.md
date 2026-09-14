# Adversarial Review — `tighter-reviews/design.md` (round 3)

You are a senior staff engineer with deep expertise in Node.js subprocess orchestration, TypeScript build tooling internals (`tsc --noEmit`, project-references, buildinfo), filesystem semantics across Linux/macOS/Windows, JSON config parsing under partial-write conditions, and prompt-engineering for LLM review pipelines. Your job here is **not** to validate this design or affirm its progress. Two prior adversarial rounds have already pushed the document forward. Your job is to find what's still wrong, what the v2-fix patches broke, what the v3 design papered over, and what new attack surface the v3 changes introduced.

Treat this design with hostility. The author has accepted dozens of v1 and v2 findings and is feeling good about the document. That is exactly when subtle, second-order issues survive — load-bearing assumptions hidden inside accepted fixes, lifecycle invariants no one verified, edge cases that two rounds of review didn't anticipate. Tear into them.

The target is `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/design.md`. Read it carefully. Then read `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/requirements.md` for the contract the design is supposed to implement.

## Prior Review Context

This is review round 3. The cumulative memory is at `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-memory-design.md` — read it before starting. Summary:

**What's been resolved (don't re-derive these):**
- `Promise.allSettled` shell with internal `loadSettings` read-throw containment (covers `EBUSY`/`EACCES`/`EISDIR`/`ELOOP`/JSON-parse) — the v2 critical "synchronous prelude is unprotected" issue is closed.
- `unwrap*` rejections produce structurally-distinct degradation states: `reason: 'rejection'` for typecheck, `rejection: { message }` field for diff/hygiene. `'no-parseable-output'` retains its R2.9-only meaning.
- `runProjectTypecheck` creates `.spec-workflow/.cache/` via `mkdir({ recursive: true })` before spawning tsc.
- Concurrent-prepare against same project is documented unsupported (no advisory lock); recovery path stated.
- Bidirectional drift test (Direction A: R4 → fixtures, Direction B: fixtures → R4) with NFC/dash/quote normalization and empty-extraction guard. R4.10 explicitly states "R4 is authoritative; fixtures are derived."
- Cross-axis composite-pin fixtures expanded from 2 to 4 (now covering both maximally- and partially-degraded states).
- R4.6 prose split into R4.6a (feature-disabled, no manual-scan ask) and R4.6b (other unavailable, retains manual-scan ask).
- `validateAllFiles` boundary helper for malformed `allFiles` input.
- `features.typecheck` non-boolean warn; `resolveRunnerModel` non-string `model` warn (symmetric).
- Pinned malformed-warn message format including the parser/IO error tail.
- Closure-capture of resolved model for retry consistency, structurally enforcing R3.9.
- 7th typecheck-axis pin (`success-with-diagnostics-and-partial-coverage`) added.
- `cliArgs` forward-compat punted explicitly rather than overclaimed.
- Track-A interim sentinel regression test (`# INTERIM:` marker check).
- `data.typecheckResults[0]` hardcoding in R4.4–R4.7 prose now acknowledged as schema-vs-prose coupling that future multi-config spec must update in lockstep.

**Still unresolved going into round 3:**
- `.gitignore` deliverable for `.spec-workflow/.cache/`. Cross-machine commits of `tsc.tsbuildinfo` will silently force rebuilds or error.
- Suffix/prefix semantic ambiguity for `id_rsa` vs `id_rsareadme.md`, double-extension `things.lock.ts` — pinned by tests but not stated as a contract.
- Two-warning-per-file-edit malformed-warn semantics (low-priority, carrying forward).

**Classify every finding as:**
- **Novel**: Not raised in v1 or v2.
- **Compounding**: Deepens or extends a prior finding (cite which).
- **Recurring**: Same issue v1 or v2 already raised that hasn't been resolved (cite which) — escalate severity, since two rounds of review missed or accepted it.

The bar for novelty is high. Most of the v2 architectural concerns are addressed. Focus on second-order consequences, lifecycle assumptions, and surface area introduced by the v3 fixes themselves.

## Analysis Dimensions

### 1. Lifecycle and structural assumptions of the v3 fixes

The v2 review forced several architectural changes. Each rests on assumptions that may not hold under realistic runtime.

- Challenge the claim that **closure-captured model in runner construction** structurally guarantees R3.9 retry consistency. Pin down: when, exactly, is a runner constructed in `multi-server.ts`? Once per session? Per request? Per review-phase? If runners are reconstructed between initial and retry (which the design does NOT explicitly forbid), the closure capture is ceremonial — every reconstruction reads the cache afresh and the "same model" guarantee evaporates.
- Stress-test the claim that **`loadSettings` internal try/catch covers all I/O failure modes**. The design lists `EBUSY`, `EACCES`, `EISDIR`, `ELOOP`. What about `EMFILE` (process FD limit), `ENOTDIR` (a path component is a file), `ETXTBSY`, `ESTALE` (NFS), `EROFS` (read-only mount during recovery), or platform-specific errors on WSL2/Windows? The "any other I/O error" catch-all is asserted in prose — verify the design actually says the catch is a generic `try/catch (e)` rather than a per-errno enumeration.
- Probe **`validateAllFiles` placement**. It runs *before* `Promise.allSettled` (line 230–236), so if `path.resolve` or any of its internal logic throws on truly pathological input (a string with a NUL byte, a path longer than `PATH_MAX`, certain URL-shaped strings), the entire prepare aborts before the safety net engages. The function description (lines 246–252) doesn't list a `try/catch`. This is the same architectural pattern the v2 reviewer flagged for `loadSettings`.
- Examine whether **the `unwrap*` rejection-warn-once log** can swallow important diagnostics. Design line 260 says rejection paths "log once per process via the same warn-once mechanism as `loadSettings`." But the warn-once mechanism in `loadSettings` is keyed on `(absPath, mtime, size)`. What's the warn-once key for a rejected utility? If it's per-process per-utility, the second through Nth rejections never log — even if the rejection reasons differ.
- Question the **lifecycle of the in-process settings cache**. The cache is described as "in-process only, not persisted." But MCP servers can run as long-lived daemons. Over a multi-day session, does the cache grow unboundedly across multiple `projectPath` values? Is there an LRU bound? If a user works in dozens of repos in one session, the cache holds dozens of entries indefinitely.

### 2. The `unwrap*` and shape changes — caller fanout

`unwrapHygiene` changes hygiene's return type from `HygieneSignal[]` to `{ signals; rejection? }`. Design line 259 mentions this is a "structural change" but says callers "see the array via `data.hygieneSignals = unwrapped.signals`."

- Find the gap between the design's claim that callers are insulated and the reality. Every consumer of `computeHygieneSignals` (not just `handlePrepare`) sees the new shape. Are there other callers? Tests? Dashboard code? The `Code Reuse Analysis` section (line 37) names `computeHygieneSignals` as "extended" — but extended public-shape changes are not the same as denylist filtering, which was the originally-stated extension.
- Probe whether **`unwrapDiff` and `unwrapHygiene`'s rejection-field shape is symmetric** with the typecheck rejection. Typecheck returns `{ status: 'unavailable', reason: 'rejection', rejectionMessage }` — embedded in the existing union. Diff and hygiene return a **new top-level field** `rejection: { message }`. Asymmetric error-shape representation across utilities makes downstream consumers (dashboard, methodology directives) write per-utility branching code. Is this asymmetry justified, or did it sneak in to avoid changing existing field shapes?
- Challenge the methodology directive coverage of these new states. R4.6b was extended (line 178 in requirements.md) to include `'rejection'` as one of the unavailable reasons. But what about a `computeTaskDiff` rejection? The diff path's rejection produces an empty diff with `rejection: { message }` — and falls through to **R4.2 (diff-empty)**, which says "the implementation log is out of sync with the working tree, or this is not a git repository." The reviewer is *misled* into thinking the diff was structurally empty when in fact a utility threw. The diff-empty directive doesn't distinguish "no changes" from "diff utility crashed."

### 3. Multi-config and forward-compat boundaries

Design line 318 explicitly says `typecheckResults[0]` is hardcoded in R4 prose, and a future multi-config spec must update R4 in lockstep.

- Pressure-test whether this acknowledgment is sufficient. The drift test enforces R4 prose ↔ fixture text, but does not enforce R4 prose ↔ schema reality. A future spec that adds multi-config could update `typecheckResults` to `length > 1`, run all tests green (because fixtures still pin the index-0 prose), and ship a methodology that ignores N-1 configs. The acknowledgment is in prose; the enforcement is not.
- Probe the `cliArgs` forward-compat punt (line 297–298 in requirements, line 332–334 in design). The design says "Array-typed extensions like `cliArgs` will require an explicit empty-array semantics decision when added." But this leaves the **per-runner `cli`** (string-typed) extension as the *only* explicitly-named forward-compat case. What about per-runner `timeout` (number)? Per-runner `env` (object)? Per-runner `enabled` (boolean, e.g. enable/disable a runner)? The forward-compat ladder ("non-empty string > legacy global > undefined") is type-specific and only addresses strings. Booleans, numbers, and objects each have their own "absent vs explicit zero/false/empty" ambiguity that's unaddressed.
- Examine whether the **schema vs prose coupling** is documented anywhere mechanically. The drift test catches R4-vs-fixture; nothing catches R4-vs-schema-shape.

### 4. Drift test, fixture, and methodology composition

The bidirectional drift test was a v2 ask, now landed. It has new failure modes.

- Stress-test **Direction B's substring-derivability**. The test says "every directive sentence in any fixture must be derivable from at least one R4.x block. Derivable = the sentence appears as a substring of an R4.x block." This is an extremely tight contract. A fixture author who paraphrases a directive (e.g. line-wraps differently, splits a sentence at a comma instead of a period, abbreviates `data.typecheckResults[0]` to `typecheckResults[0]` for terseness) will fail the test. Either the test is brittle on innocent edits, or fixture authors are forced to copy R4 prose verbatim — which makes the fixture redundant with R4.
- Probe the **empty-extraction guard's coverage gap**. The guard fires if either side extracts zero blocks. But what if R4 has 7 blocks and the extractor returns 5 (two were reformatted to a code-block style the extractor doesn't recognize)? Both sides have non-zero extractions, the guard doesn't fire, and the two missed blocks are silently absent from the test coverage.
- Challenge the **comparison normalization completeness**. NFC, em-dash → hyphen, smart quotes → straight. What about: non-breaking spaces (` `) introduced by editors, ellipsis character (`…`) vs three dots, soft hyphens (`­`), zero-width spaces, BOM at the start of a fixture file, trailing-whitespace differences after `.trimEnd()` on lines that contained only whitespace? The normalization catches the most common drift but not the long tail.
- Examine the **4 cross-axis fixtures' coverage**. The selection rationale (lines 386–389 in requirements) is "maximally and partially degraded states." But composite output is constructed by string concatenation of directive blocks. Concatenation correctness in a 4-fixture sample doesn't generalize — it's possible for two specific directives to produce a contradiction in a 5th combination not covered. Identify which combinations are *uncovered* and whether any of them produce a contradictory or absurd composite.
- Stress-test the **Track-A interim sentinel test**. The marker is `# INTERIM:`. What if a future fixture file legitimately contains a code-comment example that mentions `# INTERIM:`? Or what if a docstring describes the historical Track-A interim state? The regex match is overly broad, and the test is now a tripwire that future authors will accidentally trigger.

### 5. External-process invocation semantics

The design specifies `git diff -U10 -M HEAD --` and `git diff --numstat HEAD --` as separate invocations.

- Probe **buffer specifications**. `maxBuffer: 16 * 1024 * 1024` is specified for both git diff and tsc (lines 128, 168). What about `git diff --numstat`? The design says line 128 covers "both invocations" — verify both are `git diff` flavors and `--numstat` is included. What's the worst-case numstat output size for a repo with thousands of files in pathspec? Could it overflow before the unified-diff?
- Examine the **`maxBuffer` overflow path for diff**. Line 133 lists the failure modes that produce `{ diff: '', stats: undefined, ... }`: includes `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`. But what if `--numstat` overflows while the unified diff stays under the cap? Then `diffStats` is missing while `diff` is present — the design doesn't pin behavior here. Is that a degraded-but-OK state, or does the whole utility return empty?
- Probe **process termination semantics on Windows**. SIGTERM-then-SIGKILL is a POSIX pattern. On Windows, `child_process` translates SIGTERM differently (it calls `TerminateProcess` immediately, no graceful path). The 2-second grace period is meaningless on Windows. Out of Scope (v1) says "Windows-specific process termination edge cases" are deferred — but the kill path is the *primary* failure-recovery mechanism for tsc timeout. Deferring it leaves the user with no working timeout escape on Windows.
- Stress-test the **`GIT_OPTIONAL_LOCKS=0` propagation**. The design says it's set on both git diff invocations. But `process.env` may already contain `GIT_OPTIONAL_LOCKS` set to a different value by a parent process (e.g. a CI environment that explicitly enables them). The spread `{ ...process.env, GIT_OPTIONAL_LOCKS: '0' }` overwrites — confirm. Then ask: is overwriting the user's parent-env intentional, or should it only set when unset?
- Examine **tsc stdout parsing** under multi-line diagnostics. The two-pass parser regex (line 173) requires `^(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)$` on a single line. tsc emits multi-line diagnostics for some errors (TS2345 with type expansions can wrap to 5+ lines). Pass 1 catches the head; Pass 2's "absolute-path shape" filter discards the continuation lines. But the *diagnostic text* (the full multi-line message) is truncated to the first line. The reviewer reads "Argument of type 'X' is not assignable to parameter of type 'Y'." with no expansion. For tricky type errors, the truncated message is useless.

### 6. Settings parsing, caching, and warn semantics

- Probe the **warn-once flag's invalidation semantics**. The design says (line 209) "Warn-once flag is per `(absPath)`, cleared when `(mtime, size)` advances." But `(mtime, size)` advances on **every successful read** that produces a new tuple — including a successful read with valid JSON. So the warn-once flag is cleared on a fix. This is good. But what about: user writes invalid JSON → warn fires → user fixes → mtime advances, warn flag clears → user writes a *different* malformed value → warn fires again. That's correct. But what about: user writes invalid JSON A → warn fires → user writes invalid JSON B (mtime advances, size differs) → warn re-fires for B. Now the user is inundated with warnings for every save in their broken-JSON state.
- Challenge the **cold-cache cost regression test bound**. Design line 410 says "timed first call, assert under (e.g.) 50 ms on a synthesized 4 KB JSON (regression bound, not absolute SLA)." 50 ms on a 4 KB file is a permissive bound. A real regression that doubles the cost (to ~30 ms) ships green. Is the 50 ms bound informed by anything other than "well within tolerable"? A tighter bound or a multi-factor regression check (e.g. "no more than 2x the baseline") would catch real degradation.
- Examine the **`(mtime, size)` cache key under filesystem clock skew**. NFS, SMB, WSL2 mounts can return mtimes that go backwards under clock skew (rare but documented). If the cache stores `(mtime=100)` and a subsequent read returns `(mtime=99)` (stale clock), is that treated as "different tuple → re-read" or "same? cached"? The design says "both must match" — different, so re-read. But the rebuild semantics aren't specified: does the cache evict the entry, or just bypass it for this call?
- Probe **`features` block extension under the same precedence rules as `model`**. Design treats `features` as an object with boolean keys. R3.12 (in requirements, not design) says unknown keys under `features` are silently ignored. But the design's `isTypecheckEnabled` reads `settings.features?.typecheck === false` — the `?.` chains through `features` being null/undefined/non-object. What if `features` is `42` (number, not object)? `(42)?.typecheck` is `undefined` — fine. What about `features: ["typecheck"]` (array)? Arrays are objects in JS, `["typecheck"].typecheck` is `undefined` — fine. The runtime is forgiving, but the malformed-warn for non-object `features` (R3.12) requires explicit type-check that the design doesn't mention in `loadSettings` or `isTypecheckEnabled`.

### 7. Methodology directive composition under realistic LLM behavior

The methodology directives are read by an LLM that has been told they are authoritative. The design pins composite output but does not validate that the resulting directives are *coherent* to a reading agent.

- Stress-test **R4.6a vs R4.6b composition with the diff directive**. Cross-axis fixture #2 is `unavailable-other + diff-truncated`. R4.6b says "manually scan the modified TypeScript files." R4.1's truncation clause says "If `data.diffTruncated` is true, read the full file for the truncated paths." Both directives ask for file reading. R4.6b says *all* modified TS files; R4.1 says *only* truncated paths. The reviewer is told "do this larger thing AND this smaller subset thing" — is that redundant, or is the reviewer expected to do exactly the union? The design pins the composite via fixture but doesn't reason about whether the union is coherent.
- Probe **R4.6a (feature-disabled) under partial-typecheck-coverage**. Design line 297 says R4.5 partial-coverage emits "IN ADDITION" to the typecheck-present directive. But if `status === 'unavailable'` with `reason: 'feature-disabled'`, there's no `coverage` field and R4.5 doesn't fire. The new fixture combination `unavailable-feature-disabled + partial-coverage` is structurally impossible — fine. But is `unavailable-other + partial-coverage` possible? The design's union types say no (only `'success'` has `coverage`). Verify the composite-pin doesn't accidentally test an impossible state.
- Challenge **R4.4's "If `truncated: true`, run `tsc --noEmit` yourself"** instruction. The design (line 184) caps diagnostics at 100 and sets `truncated: true`. The directive tells the reviewer to run tsc themselves. But the reviewer is an LLM in a constrained agentic context — does it have shell access? Can it actually run tsc? The directive assumes a capability the methodology doesn't verify. If the reviewer is a sandboxed agent, the directive is meaningless and degrades to a no-op the user doesn't see.
- Examine **the R4.2 diff-empty directive vs partial-commit silent-coverage gap**. Coverage constraints (requirements line 25) document the partial-commit case as a known limitation. R4.2 says "the task changes were already committed before review" as one possibility — but does the directive *correctly equip* the reviewer to handle partial commits? If file A was committed and B/C are uncommitted, `data.diff` shows B/C only. The reviewer reads `filesToReview` (which contains all three) plus the diff (which shows two). Are they correctly identifying that file A has no diff coverage? R4.2's prose mentions "implementation log is out of sync" but doesn't surface "some files in `filesToReview` may have no `diff` content because they were already committed."

### 8. Cross-spec and external-system interactions

- Probe **`.spec-workflow/.cache/tsc.tsbuildinfo` interactions** with external systems. Does it interact with `.gitignore` (carries over from v2 — explicitly **not addressed** in v3 design)? With `tsc`'s own incremental cache logic if the user runs `tsc --build` directly? With dependency caching in CI (cache hit on `.spec-workflow/.cache/` resurrects a cross-tsc-version buildinfo that emits parse errors)?
- Examine **what happens when the user runs `tsc --noEmit` themselves while a prepare is in-flight**. Two writers to the same buildinfo path. Same as concurrent-prepare, but the second writer is the user's own command. Recovery is the same (`rm` the buildinfo) but detection is harder — the user doesn't know prepare is running.
- Probe **`partitionPaths` behavior when called concurrently from two places** (diff utility and hygiene utility, both part of `Promise.allSettled`). The function is described as pure with `node:path` only as a dependency — should be safe for concurrent calls. But verify the design actually documents this. If `TEST_FIXTURE_SEGMENTS` is a `readonly` array (it is, per line 99), this is fine. If any internal state is mutated, race conditions exist.
- Stress-test **interaction between `validateAllFiles`'s "drop paths outside `projectPath`" rule and symlinked workspaces** (pnpm). A symlinked workspace points outside the project root (`../shared/lib.ts`). `validateAllFiles` resolves the path via `path.resolve` and checks against `projectPath` — it does *not* call `realpath`. So the symlink target is irrelevant; the check is on the literal resolved path. A path like `<projectPath>/packages/foo/src/index.ts` that's a symlink to `../../../external/lib.ts` passes `validateAllFiles` (the literal path is inside `projectPath`). But then `partitionPaths`, `git diff`, and `tsc --listFiles` may return *post-realpath* paths that fall outside. Is this a problem, or is it the intended relaxed semantics?

## Closing Deliverables

Conclude your analysis with:

1. **Top 5 risks/gaps** (ranked by severity, each with: classification — Novel / Compounding / Recurring; specific failure scenario; concrete fix). Pull no punches: if a v2 fix introduced a new problem, escalate it.
2. **Top 3 conclusions to challenge or reverse**. Cite the specific design line you are reversing and what should replace it.
3. **What's missing** — concrete pre-implementation work items the design has not surfaced. Skip items already in the memory's "Unresolved" section unless severity should escalate.

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on. Do not re-derive findings already accepted in the memory file. Do not pad with praise.

## Where to Write Your Analysis

Write your analysis to:

`/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-analysis-design-r3.md`
