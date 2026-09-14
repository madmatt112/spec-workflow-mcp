# Adversarial Review (round 2) — `tighter-reviews/design.md`

You are a senior systems engineer with deep experience in Node.js process orchestration, TypeScript tooling internals, and review-pipeline reliability. You are reviewing a design document for the second time after a prior round of adversarial review forced substantive revisions. Your job is **not** to validate that the revisions are sound — your job is to find what the prior reviewer missed, what the revisions broke or weakened, and what the design still papers over.

Be hostile to claims of completeness. Be hostile to "this was deferred to v2" as a substitute for solving the problem. Treat every "explicitly handled" sentence as a place where the handling may be incomplete or wrong-shape.

## Prior Review Context

This is a v2 review. A v1 adversarial review of an earlier design produced 5 ranked risks, 3 conclusions to reverse, and 15 concrete pre-implementation work items. The design has been substantially revised in response. **Most v1 findings were accepted and the design changed accordingly** — see `adversarial-memory-design.md` for the full categorized record.

**Highlights of what was Accepted (don't re-discover these):**

- `Promise.all` → `Promise.allSettled` with per-utility `unwrap*` rejection-to-degradation conversion.
- `maxBuffer: 16 * 1024 * 1024` specified for both `git diff` and `tsc`. Buffer-overflow gets distinct `'output-overflow'` sub-reason.
- Path normalization switched from `realpathSync.native` to `fs.promises.realpath`, chunked at 100 with per-path `try/catch` for ENOENT.
- Test-fixture exception narrowed to a path-segment carve-out only — basename/suffix/prefix rules still fire under fixture paths.
- Case-folding split per category: secret-bearing always-fold; lock/binary platform-conditional; path-segment unconditionally-insensitive.
- `isDenylisted` no longer exported; only `partitionPaths`.
- Typecheck output (compiled/excluded/diagnostics) filtered through denylist with `suppressedDenylistedFiles` count.
- Diff truncation has two distinct messages (per-file cap vs total budget exhaustion).
- tsc stdout parser specified as two strict passes (diagnostic regex first, absolute-path shape second).
- R4.7 names the `features.typecheck: false` kill switch.
- Cross-axis composite-pin fixtures added (2 of them, not 15).
- Spec-vs-fixture drift test added.
- Concurrency assertion replaced with `vi.fn()` start-time spies.
- R3 mid-session-edit test now uses `utimes()` programmatically.
- Methodology numbering: diff is unnumbered "**Read first:**" preamble; existing items 1–8 unchanged; item 9 hygiene; item 10 typecheck.

**What was deferred to "Out of Scope (v2)" of the feature (i.e., still unaddressed but acknowledged):**

- Content-hash third cache key for `(mtime, size)` collisions.
- Per-volume case-sensitivity probe on macOS APFS.
- `features.typecheckRequired: true` fail-loud setting.
- `fast-check` property tests for the denylist matcher.
- Structured dashboard tag for typecheck degradation.

**What is still Unresolved:**

- Settings load `EBUSY`/`EACCES` on Windows atomic-rename (no explicit handling specified).
- "Fixtures are right when they drift" inverts contract authority despite the new drift test.
- Warn-once-per-edit-cycle malformed-warn semantics produce noise on rapid fix-rebreak cycles.

**Your job in this round:** focus on **novel issues** and **compounding issues** introduced by the v1 fixes. Do not re-derive the accepted findings unless you can show the v2 design's resolution is itself broken. Each finding you produce must be classified as:

- **Novel** — not identified in v1.
- **Compounding** — builds on or deepens a v1 finding (often: "the fix introduced a new failure mode").
- **Recurring** — the v1 finding was supposed to be addressed but wasn't, or was addressed in a way that doesn't actually solve the problem.

---

## Analysis Dimensions

### 1. The `unwrap*` helpers and the orchestrator boundary

The v1 `Promise.all` → `Promise.allSettled` switch is a real improvement, but the design now relies on three `unwrap*` helpers (`unwrapDiff`, `unwrapTypecheck`, `unwrapHygiene`) to convert rejections to degraded states. These helpers are described in prose only. Attack:

- Stress-test the rejection-shape-to-degradation-state mapping. A rejected `runProjectTypecheck` becomes `[{ status: 'unavailable', reason: 'no-parseable-output' }]`. Is `'no-parseable-output'` the right sub-reason for *all* possible rejections (parser bug, normalization throw, denylist module throw, an OOM during tagging)? Or does picking that one sub-reason hide whatever actually failed?
- Examine the "logs the rejection reason once per process for debuggability" claim. Does this share the warn-once mechanism with `loadSettings`'s malformed-warn flag? If so, two distinct logical events (settings malformed vs typecheck rejected) compete for the same flag and one suppresses the other.
- The `unwrap*` helpers must themselves never throw. What happens if constructing the degradation object throws (e.g., a refactor adds a getter that depends on uninitialized state)? The orchestrator's safety net has its own safety net problem.
- The `Promise.resolve(emptyDiff)` placeholder in Track A's interim state interacts with `Promise.allSettled` differently than `Promise.all` — it's always `fulfilled`, so the `unwrapDiff` rejection path is never exercised during Track A. Test coverage of the rejection path doesn't ship until Track B. Examine whether this leaves a window where the rejection path could regress silently.

### 2. The spec-vs-fixture drift test and "fixtures are right" tension

The new ~20-line drift test reads `requirements.md`, extracts each R4.x verbatim block (delimited by `>` block-quote markers), and asserts each appears as a substring in at least one fixture under `__fixtures__/methodology/`. Tear this apart:

- **Substring presence is a one-way assertion.** The test catches "R4 block deleted from fixtures" but does not catch "fixtures contain prose not present in R4." The "fixtures are right when they drift" framing in R4.10 is therefore still operative — a fixture can grow content the spec never authorized, and the drift test passes.
- **Block-quote delimiter brittleness.** The test depends on `>` block-quote markers to extract R4 prose. A future contributor reformats R4.5 to use a different delimiter style (e.g., a fenced code block, an indented paragraph) and silently breaks the extractor. The test still passes vacuously (zero blocks extracted, zero substring assertions to fail).
- **Whitespace and formatting normalization.** The R4 block prose contains `data.typecheckResults[0]` (with backticks) and the fixture renders the same prose, but a fixture that uses a different quoting style (smart quotes from a copy-paste, em-dash vs hyphen) breaks the substring match. Does the test normalize, or does it require byte-exact substring? If exact, the test is brittle in a way that punishes innocent edits.
- **Directive removal scenario.** R4.7 is removed from R4 by a future spec edit. The corresponding fixture continues to render the timeout directive. The substring test passes (R4 has no R4.7 block to assert presence of). The fixture is now unauthorized prose — undetected.
- **Two fixtures contradict each other.** R4.5 prose appears in `success-partial-coverage.txt`. A different fixture (`timeout.txt`) accidentally also contains R4.5 prose due to copy-paste error. The substring test passes (R4.5 appears somewhere). The fixture set is now internally inconsistent.

### 3. Settings parsing under partial-write and unusual file shapes

The design specifies malformed-JSON handling (return `{}`, warn once per `(mtime, size)`). Push harder:

- **Read-throws cases.** `readFileSync` can throw `EBUSY`, `EACCES` (Windows atomic-rename mid-write), `EISDIR` (someone replaces the file with a directory), `ELOOP` (symlink cycle). The design says malformed JSON returns `{}` but doesn't address read-side throws. Does `loadSettings` itself throw out of the synchronous path, killing the orchestrator's prelude? V1 §1d raised this; v2 design did not explicitly answer.
- **Truncated mid-write file.** Editor saves a 200-byte file as a 0-byte truncate followed by 200-byte append. Between truncate and append, a read sees an empty file. `JSON.parse('')` throws. Caught? Probably. But the cache then stores `{}` keyed on `(mtime=now, size=0)`. The same-second editor finishes the append: cache evicts on size mismatch — fine. Now the corner case: editor saves a 0-byte file *intentionally*. Cache stores `{}`. User writes the real settings 0.5s later, lands at same-second mtime, different size. Cache evicts. OK. But what about a file that *was* 200 bytes, edited to also be 200 bytes (same model name length, different content)? Same-second + same-size collision (the deferred v1 §5b case). Walk through the warn-flag clearing semantics under this collision.
- **JSON with BOM, trailing comma, or comments.** `adversarial-settings.json` is JSON, not JSONC. Editors that auto-insert BOM (Notepad on Windows) produce a file `JSON.parse` rejects with "Unexpected token". Design returns `{}`. User has no signal that BOM is the problem. Same for trailing comma. The "warn once" message text — does it surface the parser error or just say "malformed"? Design doesn't specify the warning text.
- **`features` block edge cases.** Design says `features.typecheck` of any non-boolean is treated as absent (defaults to `true`). What about `features.typecheck: 0` vs `features.typecheck: 1`? Both non-boolean. Both treated as absent. Both keep typecheck enabled. A user who wrote `0` thinking they disabled it won't get a warning — `features.typecheck: 0` is "ignored as absent" silently. Compare to the explicit `false` path. Is silent ignoring of plausible-looking values worse than the explicit-`false` path?

### 4. Methodology composition under multi-axis degradation

The design ships 2 cross-axis fixtures (`partial-coverage + diff-empty`, `timeout + diff-truncated`). v1 §6d's critique was that the axis-by-axis pinning misses interaction effects. The v2 fix adds *only two* fixtures. Attack:

- **Why these two and not others?** What about `unavailable + diff-truncated`? `success-with-diagnostics + diff-empty`? `timeout + diff-empty`? The selection of two fixtures is arbitrary unless justified. A specific concern: `timeout + diff-truncated` and `partial-coverage + diff-empty` both pair the most degraded states. Less-degraded combinations may have subtler redundancy issues that these two pins miss.
- **`feature-disabled` as a degradation axis.** When `features.typecheck: false`, methodology emits R4.6 (`reason: 'feature-disabled'`). R4.6's prose says "manually scan the modified TypeScript files." But the user explicitly opted out. The directive contradicts the user's preference. Examine whether R4.6 should have a distinct prose branch when the reason is `feature-disabled` vs `tsc-not-found` — the user's intent is different in the two cases.
- **Diff-empty + feature-disabled + partial-coverage**: triple degradation possible? Actually no — `feature-disabled` means typecheck didn't run, so `coverage` doesn't exist. But the prose interactions between `feature-disabled` (opt-out) and `diff-empty` (reviewer must read full files) push the user toward a workflow that contradicts their typecheck opt-out. Is this rhetorically consistent?
- **R4.5 + R4.4 simultaneous emission**: when typecheck succeeds with both diagnostics AND partial coverage, R4.4 and R4.5 are both emitted. R4.4 directs the reviewer to triage diagnostics. R4.5 directs the reviewer to manually scan excluded files. Are the two instructions composable, or does R4.5's "manually scan for type errors" duplicate R4.4's "type-system smells tsc can't catch"? The reviewer reads both and gets confused about which scan is which.

### 5. The `tsc.tsbuildinfo` cache and its environment

The dedicated `--tsBuildInfoFile <projectPath>/.spec-workflow/.cache/tsc.tsbuildinfo` is good isolation. Stress-test it:

- **Concurrent prepare invocations** against the same project. Two MCP server instances, each running `handlePrepare` simultaneously, both write to the same `tsc.tsbuildinfo`. tsc's incremental build assumes exclusive access to the buildinfo file. What happens? Possible outcomes: corrupted buildinfo (silent), one tsc invocation overwrites the other's results mid-write (silent partial corruption), or one tsc errors out with EBUSY (handled? probably not, since this isn't `git`/`readFileSync` — it's `tsc` writing internally).
- **`.spec-workflow/.cache/` directory creation.** Does anything in `runProjectTypecheck` create the directory before tsc runs? If tsc writes to a non-existent directory, it errors. The design doesn't specify directory creation. First-run after spec-workflow setup may fail until the cache dir exists.
- **`.gitignore` and the cache.** `.spec-workflow/.cache/` should be gitignored. If the user's `.gitignore` doesn't exclude it, the buildinfo file gets committed. On a different machine, the buildinfo is for a different filesystem layout. tsc may misbehave or error. Does spec-workflow add the gitignore entry, or does the user have to know?
- **Hygiene scanning of the cache.** `computeHygieneSignals` runs against `allFiles` from the impl log, not the workspace. So the buildinfo isn't scanned. But what if a future change to hygiene scans more broadly? The cache is large, binary-ish JSON — it would noise up hygiene results. The design doesn't pin the boundary.
- **Stale buildinfo across spec-workflow upgrades.** A user upgrades their project's `tsc` (transitively, via `npm install`). The buildinfo file format is tsc-version-specific. Stale buildinfo from a prior tsc version causes the next run to silently rebuild from scratch — fine, just slow. But what if it causes parse errors that surface as `'no-parseable-output'`? The user sees typecheck unavailable with no clear cause.

### 6. The `multi-server.ts` retry semantics and `resolveRunnerModel`

R3.9: "Retry intentionally uses the same model as the original attempt to keep per-review telemetry/billing consistent." The settings-read cache (R3.7) is the mechanism. Stress-test:

- **Cache miss between initial and retry.** User edits `adversarial-settings.json` between the initial attempt's `loadSettings` call and the retry's `loadSettings` call. The `(mtime, size)` advances. Cache evicts. Retry reads fresh settings → potentially a different model. R3.9 says retry "uses the same model" but the *mechanism* relies on cache hit, which is invalidated by user edit. The intent and the mechanism diverge. Examine whether R3.9 should pin the model at runner construction (capture the resolved model into a closure) rather than relying on the cache.
- **Process restart between retries.** If retry happens after MCP server restart (unusual but possible in dev workflows), the cache is empty. Initial attempt's model and retry's model can diverge. Documented? Probably not.
- **Settings file deleted between initial and retry.** `loadSettings` finds the file gone. Returns... what? `{}`? The design doesn't say. `resolveRunnerModel` then falls through to `undefined`. Retry runs with no `--model` flag while the initial attempt used the configured model. Telemetry inconsistency.
- **`null` and type-coercion edges in `resolveRunnerModel`.** Design covers `adversarial === null`, `adversarial.model === ""`, `adversarial = "bare-string"`. What about `adversarial: { model: null }`? `adversarial: { model: 42 }` (number)? `adversarial: { model: ["claude-opus-4-7"] }` (array)? The R3.5 rules say "non-string `model` are all treated as absent." But the design doesn't specify whether non-string `model` values produce a malformed-warn or are silently ignored. R3.5 says "logs a malformed-load warning" for non-object `settings[runner]` — but not for non-string `settings[runner].model`. Is this asymmetry intentional?

### 7. Coverage-anchor and `allFiles` assumptions

The design treats `allFiles` from the implementation log as authoritative. Stress-test:

- **`allFiles` containing non-string elements.** If the implementation log is corrupted and `allFiles` contains `null`, `undefined`, or a number, `partitionPaths` and `path.resolve` may throw. Where is `allFiles` element-shape validated? The design doesn't specify validation at the `handlePrepare` boundary.
- **`allFiles` with relative paths.** Are paths in `allFiles` always absolute? The design refers to "absolute paths" in R1.1 ("in-scope absolute paths as pathspec"). If a path is relative, what happens? Implicit `path.resolve(projectPath, relPath)`? Or pass relative as pathspec? The design doesn't say.
- **`allFiles` containing paths outside `projectPath`.** Test fixture: implementation log records `/etc/passwd` as a "modified file." `git diff` ignores it (outside repo). Hygiene scans it. typecheck's `inScope` tagging treats it as in-scope. The boundary check is implicit.
- **`allFiles` empty.** What does `handlePrepare` do? Does it short-circuit, run with empty pathspec (which means "all files" in git), or return early? The design's `handlePrepare` description doesn't have an early-exit for empty `allFiles`.
- **Duplicate paths in `allFiles`.** `filesModified ∪ filesCreated` may produce duplicates if a file was both modified and created (rare but possible across multiple agent steps). Does dedup happen, and at what stage?

### 8. Forward-compat claims in the data shape and config

The design claims `typecheckResults: TypecheckResult[]` is forward-compatible for multi-config support, and `adversarial-settings.json`'s grouped shape is forward-compatible for per-runner `cliArgs`/`cli`. Examine these claims with hostile attention:

- **`typecheckResults.length` always 1 in v1.** A future v2 adds multi-config — `typecheckResults.length` becomes N. Any consumer that did `typecheckResults[0]` (which the methodology directives R4.4–R4.7 all do, by name) is now wrong: they look only at the first config's result. The "forward-compat" claim is true at the *schema* level but breaks the *methodology semantics*. R4.4 would need to fan out across all configs. The directives R4.4–R4.7 all say `data.typecheckResults[0]` literally — that's prose, not code, and it bakes in a v1 assumption.
- **`adversarial: { model }` extending to `adversarial: { model, cliArgs, cli }`.** The forward-compat is real, but the precedence ladder is currently single-knob. When `cliArgs` is added, will it use the same per-runner-overrides-legacy-global ladder? The design says yes (R3.6 forward-compat note). But `cliArgs` is an array, not a string. "Empty string falls back to legacy" doesn't generalize — what does "empty array" mean? Is `cliArgs: []` an explicit clear (use no CLI args) or an absent value (fall back to legacy)? The design doesn't pin the array-vs-string semantic divergence.
- **`features` block as forward-compat surface.** Unknown keys ignored silently. A future `features.diff: false` that disables the diff path would also need a kill-switch directive (analogous to R4.6/R4.7 for typecheck). But the methodology composition doesn't have a clear extension point — adding `diffState: 'disabled'` would require a new branch in `buildReviewMethodology`. Forward-compat for adding feature flags is not the same as forward-compat for adding feature-disabled directives.

### 9. The "Out of Scope (v2)" list as risk transfer

The design has a substantial Out of Scope (v2) section. This is a risk-transfer artifact: each item is a known issue acknowledged but not solved. Examine whether the *current* design's correctness depends on any of these items:

- **Content-hash third cache key**: documented as "user `touch` the file or restart MCP server." The README documentation deliverable (R3.11) is supposed to call this out. Does R3.11 actually require this in the README, or is it implicit?
- **APFS case-sensitive volumes**: `process.platform === 'darwin'` always treats macOS as case-insensitive. A developer with case-sensitive APFS has both `Foo.ts` and `foo.ts` legally; both case-fold to `foo.ts`; set membership collapses. The design says "v1 ships the platform default." But the test suite — does it test on a case-sensitive volume? If not, the failure mode ships untested.
- **`features.typecheckRequired: true`**: the absence forces every project to live with soft degradation. No way for a project to express "typecheck is required for review." The kill-switch is binary.
- **Property-based test for matcher**: the matcher is security-relevant. v1 §8d argued strongly for this. The deferral is "fast-check is a new dev dependency." But the design adds boundary tests instead. Examine whether the boundary tests actually cover the interaction edges (fixture-exception ∩ secret-suffix, path-segment ∩ basename, prefix ∩ separator-required-or-not).

### 10. Test coverage gaps the design glosses over

- **Track A interim fixtures**: design says the fixtures get committed in Track A and *deleted* in Track B. Examine: between Track A and Track B, what happens if a Track A iteration (PR #2 fixing a bug) needs to update fixtures? The design says "if Track A iterates more than once before Track B, interim fixtures travel with Track A's HEAD; Track B deletes whatever is current at its merge base." Is there a CI check that the interim fixtures are *deleted* (not just left untouched) in Track B's PR? If not, drift is possible.
- **`Promise.allSettled` rejection-path test**: design specifies one such test ("stub `runProjectTypecheck` to throw synchronously; assert `handlePrepare` resolves with degraded typecheck and rest intact"). What about the diff and hygiene rejection paths? Each `unwrap*` helper should be tested for the rejection branch, but the design only explicitly calls out one.
- **Concurrent prepare invocation tests**: are there integration tests that simulate two `handlePrepare` calls running simultaneously against the same project (sharing the tsc buildinfo cache)? The design's concurrency tests are about utilities-within-one-prepare, not prepare-vs-prepare.
- **Cold-cache settings-load integration test**: design notes cold first-call cost is 5–15 ms. Is there a test that asserts the cold-cache path works end-to-end (fresh process, no prior cache, prepare succeeds within a reasonable bound)?

---

## Closing Deliverables

Conclude your analysis with:

- **Top 5 risks/gaps** (ranked by likelihood × blast radius). Each must be classified as Novel, Compounding, or Recurring. Cite specific design decisions and failure scenarios.
- **Top 3 conclusions to challenge or reverse**, with specific reasoning. Examples: a defended-but-thin justification, a deferral that actually blocks v1, a forward-compat claim that doesn't survive scrutiny.
- **What's missing** — concrete pre-implementation work items the design still skips.

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine — including v1 findings the design correctly resolved — say so briefly and move on. Do not waste space re-deriving findings already classified as Accepted in the prior round.

Where you find something Recurring (a v1 finding the v2 design failed to actually fix), escalate severity and explain why the v2 resolution is inadequate.

## Output

Write your analysis to:
`/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/reviews/adversarial-analysis-design-r2.md`
