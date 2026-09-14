# Adversarial Analysis: `tighter-reviews/design.md`

Scope: failure modes, leaky abstractions, and unenforced contracts. I read both `requirements.md` and `design.md` before writing this. Where the design satisfies the requirement, I say so and move on; where it doesn't, that's a finding.

---

## 1. The `Promise.all` orchestration shell in `handlePrepare`

### 1a. The three utilities are not independent — `loadSettings` is a synchronous prelude

```ts
const settings = loadSettings(projectPath);          // sync, blocks event loop
const [diffResult, typecheckResults, hygieneSignals] = await Promise.all([...]);
```

`loadSettings` is **synchronous** (the design specifies `loadSettings(projectPath: string): AdversarialSettings` returning a value, not a Promise — see `adversarial-settings.ts` interface). On the **first call in a process**, there is no cache: the helper does a `statSync` + `readFileSync` + `JSON.parse`, all blocking. R3.7's "< 5 ms per call" estimate assumes a warm cache. The very first prepare after MCP startup pays:

- WSL2 mounting Windows volumes (9p protocol): single `statSync` is 2–8 ms; `readFileSync` of even a small JSON adds 3–10 ms. **First-call wall-clock: 5–20 ms of blocked event loop.**
- If an editor is mid-rewrite of `adversarial-settings.json` via non-atomic write (some Windows editors), `readFileSync` can return mid-rewrite content and `JSON.parse` throws — **outside the cache layer**. The design says malformed JSON returns `{}`, but only if the catch is in `loadSettings`; the design doesn't show the implementation, just the contract. This needs to be pinned.

Most users won't notice 20ms. But the design's perf claim ("settings read negligible") is overstated for first-prepare-after-startup, which is the **typical** user path, not the edge case.

### 1b. "None throw out of `handlePrepare`" is a contract, not a mechanism

`Promise.all` is **fail-fast**: if any promise rejects, the rejection propagates and resolved values from the other promises are discarded. The design's "none throw" claim is asserted in the architecture section but not enforced. Vectors that bypass it:

1. **`realpathSync.native` ENOENT inside `runProjectTypecheck`'s normalization step (R2.4)** — sync, throws synchronously. Where is this caught? The design says runProjectTypecheck "never throws" but doesn't show the catch boundary. If normalization is inline in the main path and the catch is at the top of the function, fine. If normalization is in a helper that's `.then()`'d off the tsc execFile, the synchronous throw inside a then-callback becomes a rejection — handled. If it's in a top-level `for` loop after the await, it propagates.
2. **`execFile` rejection that the catch missed** — e.g., `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` (see §3 below) is a different rejection shape than non-zero exit. If the catch only handles `error.code === 'ENOENT'` and exit codes, the buffer error escapes.
3. **`path.resolve` on a malformed input** — doesn't throw normally, but if `allFiles` contains a non-string due to a corrupted implementation log, `path.resolve(undefined)` throws TypeError synchronously. No place in the design specifies validating `allFiles` element shape.

**Blast radius of any one escape: the entire prepare response fails.** `Promise.all` doesn't degrade — it rejects. The design should use `Promise.allSettled` and convert each rejection to the documented absent-with-reason state. This is a one-line change with high reliability payoff and zero downside; the current `Promise.all` choice quietly inverts the design's stated reliability posture.

### 1c. Track A interim placeholder is a contract leak

```ts
Promise.resolve(emptyDiff)  // Track A interim
```

If Track B is delayed past the documented one-week window and a downstream consumer (dashboard, an external client of the MCP response) starts depending on `data.diff === ""` meaning "no changes", they bake in the interim semantics. When Track B lands and `data.diff === ""` starts meaning "really no changes" (vs. "Track B not yet shipped"), the consumer's logic flips. The methodology directive R4.2 conflates both states deliberately, but a non-LLM consumer reading the structured field directly has no signal. Design should either:
- Explicitly omit `data.diff` from the response in Track A (forcing consumers to handle absence), or
- Add a `data.diffSource: 'computed' | 'placeholder'` in Track A that gets removed in Track B.

Neither is in the design.

### 1d. Settings load is the global serialization point

If `adversarial-settings.json` is held by an editor's atomic-rename operation on Windows / WSL Windows-mount, `readFileSync` can throw `EBUSY` or `EACCES` for tens of milliseconds. The design has no retry, no deadline. **Every utility starts after settings — this is the single critical-path serialization point**, and it's the one read that's fully synchronous.

---

## 2. Path denylist semantics

### 2a. The "guarantees identical match behavior" justification is wrong

> "Utility Modularity: denylist match logic is one module consumed by two callers (diff, hygiene), guaranteeing identical behavior."

A common module guarantees identical behavior **regardless of the matcher implementation**. `picomatch` would also produce identical behavior at both call sites if both call sites import the same `picomatch` instance. The real reason for inventing the semantics is unstated — likely "no new runtime dependencies" (NFR section confirms this). But the cost of inventing is real:

- `*.lock` suffix as written matches `Cargo.lock` (intended) but also matches `mylockfile.lock` (probably intended) and ALSO matches files like `things.lock.ts` if the suffix logic is "basename ends with `.lock`". The design's match semantics says "basename suffixes" but does not specify whether suffix matches the entire trailing token or just any trailing substring. `picomatch` would express this unambiguously as `*.lock` (single extension) vs `*.lock.*`.
- `id_rsa` prefix matches `id_rsa.pub` (intended), `id_rsa_backup` (intended), and `id_rsareadme.md` (probably not intended — there's no separator requirement).
- `secrets` path-segment matches `node_modules/some-vendor-pkg/secrets/...` even though the project author has no control over vendor file naming. This is intended to be safe (denylist on review surface, not security boundary), but it means **vendor source under `node_modules` getting reviewed at all is the real bug** — and the design doesn't acknowledge that vendored paths leak into `allFiles` if the implementation log records them.

Recommendation: at minimum, pin the suffix/prefix semantics with concrete tests showing intended-vs-not at the boundary (separator-required vs free-form). Without tests, the inventor's intent will silently disagree with the next contributor's reading.

### 2b. The fixture-exception attack is realistic and unmitigated

The construction in the prompt is correct:

```
src/__tests__/__fixtures__/leaked.env
```

- `__tests__` and `__fixtures__` are both in `TEST_FIXTURE_SEGMENTS`.
- The fixture exception **overrides** the basename rule.
- Result: `.env` content surfaces in `data.diff` and is sent to the reviewing LLM.

The design's implicit defense is "if it's in the repo, it's already public." This is wrong in three ways:
1. **Private repos exist.** A fixture committed to a private repo is not public. The reviewer LLM (or any artifact persistence path — the design mentions hygiene-signals being scanned, the dashboard rendering the diff, possibly external review tools) is now a different trust boundary than the repo itself.
2. **Pre-receive hooks may scan for secrets in commits**, but the fixture exception specifically defeats the diff-time redaction that would have prevented the LLM from seeing the secret even if the commit landed.
3. **The motivating use case** ("a PR modifying `path-denylist.ts` itself would silently exclude the new fixtures it adds") is solved more narrowly: the exception could apply *only* to test files that don't match the secret-suffix patterns (`.env`, `.pem`, `.key`, `id_rsa*`). The current rule is "any segment in TEST_FIXTURE_SEGMENTS keeps the file regardless," which is over-broad.

**Mitigation needed**: the test-fixture exception should be a **carve-out from the path-segment denylist only** (`secrets`, `credentials`, `.aws`, `.kube`, `.docker`), not from the basename/suffix/prefix rules. A fixture path with basename `.env` should still be redacted; a fixture path under `__fixtures__/credentials/...` should be kept.

### 2c. Case-folding rules are inconsistent and Linux-broken

Three sources of truth:

1. **R1.5 exact basenames**: "case-insensitive on case-insensitive volumes."
2. **R1.5 path-segments**: "case-insensitive" (unconditional).
3. **Design match-semantics**: "case-folded" (no qualification).

On Linux production:
- File `Secrets/config.json` — **path-segment** rule fires (case-insensitive) → denylisted. ✓
- File `.ENV` (uppercase basename) — **exact basename** rule on Linux (case-sensitive volume) → does NOT match `.env` → **kept in diff**.
- The design's "case-folded" claim suggests it would match. R1.5 says it wouldn't.

This is a real semantic gap. On Linux, a file literally named `.ENV` (which a user could create, rare but legal) bypasses redaction. The exact-basename list should be unconditionally case-folded for the secret-bearing entries — the volume-case nuance applies to filename collision avoidance, not to denylist matching, where false-positives (matching uppercase) are harmless.

### 2d. Two interfaces for one decision

`isDenylisted` and `partitionPaths` are both exported. Design says diff uses `partitionPaths`, hygiene uses... actually the design says hygiene calls `partitionPaths(files).skipped` too. So both call sites use `partitionPaths` today. Then **why is `isDenylisted` exported at all?** It's an attractive nuisance: a future caller will reach for the per-element function, do its own filtering, and miss whatever normalization `partitionPaths` does. Either:

- Remove `isDenylisted` from the public surface (only export `partitionPaths`), or
- Document the normalization invariants both must share (and pin them with a property-based test asserting `partitionPaths(xs).kept === xs.filter(x => !isDenylisted(x).denylisted)` for arbitrary `xs`).

The design exports both with no consistency contract.

### 2e. Typecheck doesn't apply the denylist — and leaks paths anyway

The design is explicit: "`path-denylist` is **not** applied to typecheck — tsc decides what to compile via `tsconfig`." OK on the compile decision. But:

- `data.typecheckResults[0].coverage.compiled` and `coverage.excluded` are arrays of **absolute file paths**. If the project has `src/secrets/credentials.ts` (non-binary, non-secret-extension), it's compiled by tsc. The path appears in `coverage.compiled`. The reviewer LLM sees the path. Diagnostics, if any, include the full absolute path plus the identifier names from the error message.
- `data.skippedPaths` (from R1.7) lists denylisted paths from the diff side. The reviewer might compare `coverage.compiled` against `skippedPaths` to figure out denylisted files — which exactly defeats the redaction intent for paths that ended up in both.

**This is a real inconsistency.** The design acknowledges it implicitly ("tsc decides what to compile") but doesn't address the *output* leak. A minimal fix: filter `coverage.compiled` and `coverage.excluded` and the `diagnostics[].file` arrays through the denylist before returning, even though the compile itself isn't filtered. Diagnostics on denylisted files become a single `'denylisted-paths-suppressed: N files'` summary line.

---

## 3. Truncation, buffers, and `tsc --listFiles`

### 3a. Diff truncation is order-dependent and unfair

Yes, this is a real concern. `git diff` returns files in pathspec order (or alphabetical for the default ordering). The byte budget is consumed **first-come-first-served**:

```
a-huge.ts: 200 hunks, 40 KB → consumed
b-medium.ts: 50 hunks, 9 KB → consumed (49 KB total)
c-tiny.ts: 5 hunks, 1.5 KB → would push to 50.5 KB → REPLACED with truncation marker
```

`c-tiny.ts` is 5 lines and gets the truncation marker, while `a-huge.ts` gets full hunks. The reviewer reads everything about the unrelated huge change and gets nothing about the small one.

The error message — `<diff truncated: <file> exceeded per-file/total cap>` — is ambiguous: did this file blow the per-file cap (its own fault), or did it lose the budget race (someone else's fault)? The reviewer can't tell.

**Fix:** either (a) per-file pre-budget allocation (`50000 / numKept` floor with rebalancing for small files), or (b) make the truncation message specific (`per-file cap exceeded` vs `total budget exhausted, this file was truncated despite being small`). The design specifies neither.

### 3b. `--listFiles` output and `maxBuffer`

This is the strongest concrete bug in the design. `execFile`'s default `maxBuffer` is **1 MB combined stdout+stderr**. The design specifies the timeout (30s) and env (`FORCE_COLOR=0 NO_COLOR=1`) but **does not specify `maxBuffer`**.

Sizing on a real monorepo:
- 5,000 source files × average path length 90 chars = 450 KB of `--listFiles` output.
- 10,000 files (large monorepo): 900 KB. **One blocked-by-bumper away from breaking.**
- Plus diagnostics: each unparsed-pretty diagnostic is one line, ~150 chars; 100 diagnostics = ~15 KB. Negligible relative to listFiles.
- Plus deep paths in pnpm-style monorepos (workspace symlinks resolved): paths can be 200+ chars. 5,000 × 200 = 1 MB. **Crosses the threshold on a normal monorepo.**

When exceeded, `execFile` rejects with `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` and the process is killed mid-output. The design's `'no-parseable-output'` reason is for the case where tsc exits cleanly with empty listFiles — that catch may not match the buffer-overflow rejection shape. **If the catch is `error.code === 'ETIMEDOUT'` for timeout and signature-matches non-zero exit otherwise, the buffer error escapes as an unhandled rejection.**

**Required fix in design:** specify `maxBuffer: 16 * 1024 * 1024` (16 MB) on the tsc invocation, document the threshold, and add a fallback path for when the buffer error fires (degrade to `'no-parseable-output'` with a distinct sub-reason).

### 3c. `--listFiles` and diagnostics interleave on stdout

tsc emits both diagnostics and `--listFiles` paths to stdout. The parser must distinguish them. With `--pretty false`:

- Diagnostic format: `path/to/file.ts(LINE,COL): error TSCODE: message`
- listFiles entry: `path/to/file.ts` (one per line, absolute, no parens-comma marker)

The marker is the `(N,M):` substring. Mostly unambiguous, but:

- **Multi-line diagnostic messages**: tsc emits "related information" diagnostics across multiple lines. Even with `--pretty false`, error chains can span lines (e.g., "  Type 'Foo' is not assignable to type 'Bar'." continuation). The continuation line has no `(N,M):` marker. If the parser's heuristic is "line without `(N,M):` is a listFiles entry," continuations get classified as compiled paths — polluting the compiled set with substrings like `Type 'Foo' is not assignable to type 'Bar'.`.
- **Error messages containing absolute paths**: `Cannot find module '/abs/path/to/foo' or its corresponding type declarations.` That `/abs/path/to/foo` is on the error line (with `(N,M):` marker, OK), but if tsc wraps long messages, the path lands on a continuation line.

The design says "parse diagnostics and `--listFiles` output" without specifying the parser. **The parser specification is missing, and silent corruption of the compiled set is the failure mode.** Recommend: parse diagnostics first using a strict regex (`^(.+?)\((\d+),(\d+)\): (error|warning) TS(\d+): (.+)$`), then treat remaining lines as listFiles **only if they match an absolute-path-shaped pattern**, drop everything else.

### 3d. 100-diagnostic cap and cascade masking

The "in-scope first, then out-of-scope" sort handles one cascade pattern but breaks on the inverse:

- **Scenario**: real bug is in-scope file `a.ts` — a missed export of a type. The in-scope diagnostic count is 0 (the export omission isn't itself a tsc error from `a.ts`'s perspective; `a.ts` looks fine). Out-of-scope `b.ts`, `c.ts`, ... import the missing type — 150 cascade errors, all out-of-scope. Cap fires at 100 out-of-scope, 50 dropped. Reviewer sees 100 out-of-scope errors with no in-scope context. They reasonably triage these as "pre-existing, not introduced by task" because no in-scope diagnostic points to them. **The bug is missed.**

Pure in-scope-first sort assumes the upstream cause is in-scope and emits diagnostics there. When the cause is "in-scope file failed to *emit* something downstreams need," the cause has no diagnostic. Grouping-by-cause (TS code + originating identifier) would help — emit one representative per cluster — but that's complex.

A cheaper mitigation: when truncation fires AND `coverage.compiled` includes any in-scope file with **zero in-scope diagnostics but high out-of-scope diagnostic density on files that import from it**, surface a warning. The design doesn't address this and probably shouldn't try to in v1, but the methodology should at least **acknowledge** the cascade-from-silent-cause failure mode in R4.4.

### 3e. Per-file vs total cap interaction

Per-file cap: 500 added+removed lines (counted from numstat? from the diff body? design doesn't say).
Total cap: 50,000 bytes of diff body **including `-U10` context**.

A single file with 480 changed lines (under per-file cap) but in 30 small hunks — each hunk has 20 lines context above and below. 30 hunks × 40 lines context + 480 changed = 1,680 lines × ~60 bytes = ~100 KB. **Total cap fires, per-file cap doesn't.** Message says "exceeded per-file/total cap" — accurate but uninformative.

The two caps interact in undocumented ways. Design needs to specify:
1. Per-file cap is on changed lines (numstat) — this is what R1.9 implies but doesn't state.
2. Total cap firing on a file that didn't blow per-file cap should produce a distinct message.
3. Order of evaluation: per-file first (drop hunks of giant files), then total (truncate remaining files in order).

---

## 4. Path normalization on the typecheck coverage hot path

### 4a. `realpathSync.native` blocks the event loop

The design uses sync. On a project with 5,000 source files (all of `--listFiles` plus the dozens in `allFiles`):

- **macOS APFS local SSD**: ~100 µs per realpath → 500 ms total. Noticeable but tolerable.
- **WSL2 mounting Windows volumes via 9p**: 2–10 ms per realpath → **10–50 seconds of blocked event loop**. This is on top of the tsc invocation that already took N seconds. The dashboard's Node event loop is frozen. Other MCP requests block.
- **NFS-mounted source trees** (some monorepos): 5–20 ms per realpath → 25–100 seconds.

`fs.promises.realpath` doesn't help under the same blocking semantics — Node's libuv thread pool defaults to 4 threads, so concurrency tops out at 4× speedup. But 5x to 8x with `Promise.all` is real, and crucially **the event loop stays free** for other handlers.

**Required fix**: switch to `fs.promises.realpath` and `Promise.all` over chunks (say, 100 paths per chunk to avoid `EMFILE`).

### 4b. macOS APFS case-sensitive volumes

`process.platform === 'darwin'` always treats macOS as case-insensitive. APFS supports case-sensitive volumes (created via `diskutil apfs createVolume ... "Case-sensitive APFS"`), commonly used by:
- Docker for Mac volume mounts.
- Linux-compat development containers.
- Developers building Linux binaries who need case-sensitive paths.

Failure: developer with case-sensitive APFS has both `Foo.ts` and `foo.ts` (legal). Both case-fold to `foo.ts`. Set membership collapses two distinct files into one, breaking coverage. The fixture for symlink behavior doesn't pin this — symlinks and case-sensitivity are orthogonal axes.

**Fix**: detect case sensitivity per-volume via a probe (create a temp file, stat the upper-case form). The design's R2.4 acknowledges "OR by reading the platform's reported case sensitivity if a more reliable signal is available" — but doesn't commit to it. Commit to it.

### 4c. Duplicate paths from symlink+target pairs in `allFiles`

The design says coverage arrays use original `allFiles` paths. If `allFiles` contains both `/path/foo` and `/path/symlink-to-foo` (which both `realpath` to the same canonical path), the set ops dedup on normalized form but the **output** uses original paths. Design doesn't specify whether output dedupes or preserves both. If preserved: reviewer sees both, gets confused. If deduped: reviewer doesn't see one of the recorded paths, may miss it.

This isn't a major bug but it's an unspecified output shape. Pin it: dedupe by normalized form, preserve first-seen original.

### 4d. ENOENT during normalization

If `allFiles` includes `/path/deleted.ts` (deleted between log-implementation and prepare), `realpathSync.native` throws synchronously. The design doesn't specify the catch boundary. Possible failure modes:

1. **Catch at the top of runProjectTypecheck**: the entire utility returns `{ status: 'unavailable', reason: 'no-parseable-output' }`. **Wrong reason** — the parse worked, the path is just gone. Better: skip the path silently, or include it in `coverage.excluded` with a sub-reason.
2. **No catch**: rejection propagates through `Promise.all`, kills entire prepare (see §1b).

The design needs to specify per-path try/catch around normalization with a documented degradation (treat unresolvable paths as `excluded`, log once, continue).

---

## 5. Settings cache: `(mtime, size)` keying and the warn-once rule

### 5a. Cross-process divergence: how realistic?

The design dismisses it. Realistic scenarios:
- User runs the dashboard process AND a separate CLI invocation against the same workspace. Two processes, two caches.
- MCP server restart (host crash, machine sleep) clears all caches.
- User opens two Claude clients in different terminals targeting same workspace.

Within a single MCP host instance, the cache primarily serves R3.9 (retry uses same model as initial). That's the **load-bearing use**. The cross-process divergence note in the design is correct as written — flagged, not a v1 concern.

### 5b. `(mtime, size)` collision: real, recoverable only by restart

Construction:
```
T1: edit settings.adversarial.model = "claude-opus-4-7"  (15 chars)
    → mtime=T, size=N.   load → parse OK.
T2: same second, edit settings.adversarial.model = "claude-opus-4-6"  (15 chars)
    → mtime=T (same second), size=N (same).   cache hit → returns T1's parse.
```

Until `(mtime, size)` advances, the cache serves stale forever. User recovery options:
1. Edit the file to change its size (add a comment, whitespace) — but the JSON parser may reject comments; whitespace works.
2. `touch` the file to advance mtime past the current second.
3. Restart the MCP server.

None of these are obvious to a user who just changed the model name and wonders why the new model isn't being used. **A naive content-hash fallback** (cheap: hash 1 KB of JSON) would close this. The design's "size differs at identical mtime" handles different-length edits but not same-length.

**Required addition**: either (a) document this collision case in user-facing docs as a known cache-miss recovery path, or (b) hash the file content as a third cache key. The latter is ~10 lines of code.

### 5c. Warn-once-then-rewarn semantics

> "Two warnings for the same logical malformation"

The design's behavior:
1. User has malformed `adversarial.model`. Warning emitted once. Flag set.
2. User edits — fixes typo but introduces a new malformation. `(mtime, size)` advances. Flag clears. Warning emitted again.
3. User edits — file still malformed but in a different way. `(mtime, size)` advances. Warning emitted a third time.

Each warning is correct (each edit is a fresh signal), but it surfaces as "Claude is repeatedly complaining about my settings." Not a hard issue. Lower priority than 5b.

### 5d. First-prepare-after-startup: cache claim is overstated

R3.7 specifies "< 5 ms per call" but the first call has no cache. The first prepare in a process pays full read+parse. For users whose first action after dashboard startup is a review, this is the typical case. The cost is small (~5-15ms for a small JSON file) but the design's "negligible" framing implicitly assumes warm cache. Worth a sentence acknowledging the cold path.

---

## 6. Methodology directive ordering and the Track-A interim pin

### 6a. Numbering scheme is unspecified

R4.8 says diff directives precede everything; existing items 1–8; item 9 hygiene; item 10 typecheck. Where is the diff directive numbered?

Options the design doesn't choose between:
- Diff is "item 0" — reads weird.
- Diff is unnumbered prose at the top — looks like a section header, may be skimmed past.
- Diff renumbers everything (diff = 1, existing 1–8 → 2–9, hygiene = 10, typecheck = 11) — breaks the existing items 9/10 references.
- Diff is numbered as a "preamble" or labeled section — most likely, but unspecified.

The fixture pins are the source of truth, so whichever scheme the fixture uses wins. But the design's R4.8 description ("diff first, items 1–8 unchanged, item 9 hygiene, item 10 typecheck") implies item numbering is preserved AND diff is somehow first — these are in tension. **Resolve in design before fixtures get written**, otherwise the first contributor to author the fixtures decides the rendered scheme by accident.

### 6b. Track A interim fixtures: assumes Track B lands fast

> "Track A's PR commits interim composite-pin fixtures... Track B's PR deletes them."

If Track A needs a follow-up PR (parser bug, test fix, anything), the Track A fix must update the interim fixtures. The design's "either update fixtures in same PR, or update both together" guidance applies, but it doesn't address the policy if Track A needs **two** PRs before Track B. The interim fixtures get edited in PR #2, which means Track B's PR now deletes a more recent set of pins than it expected. Mostly fine, but worth saying:

> If Track A iterates more than once before Track B starts, the interim fixtures travel with Track A's HEAD; Track B deletes whatever is current at its merge base.

Also: between Track A and Track B, the interim fixture text describes the methodology a developer reading the repo will see. That methodology has no diff directive. A developer onboarding to the project during this window will read the interim fixture and form a wrong mental model. Not a blocker, but warrants a comment header in the interim fixture: `// INTERIM: Track-A-only state. Track B replaces this. Do not treat as the steady-state methodology.`

### 6c. "Fixtures are right" inverts authority

> "If R4 prose drifts from the fixtures, the fixtures are right — update R4 prose to match in the same PR."

R4 is the **contract**; fixtures are the **implementation artifact** (what the code emits). Inverting authority means a contributor can silently rewrite the contract by editing a fixture file — the test still passes (it's pinned to the fixture), so CI doesn't catch it.

**Failure scenario**: contributor changes `success-clean-full.txt` fixture from "Read the diff first." to "Start by reading the diff." for stylistic reasons. Their PR updates the fixture and the test passes. R4.1 still says "Read the diff first." — it's now drifted. A different contributor reads R4.1 to understand the contract, sees one thing; reads the fixture (the actual emitted text), sees another. The codebase is internally inconsistent.

A no-cost mitigation: a single test that reads `requirements.md` and asserts each R4.x verbatim block appears as a substring in at least one fixture. Detects drift without enforcing strict equivalence. The design rejects build-time consistency checks ("would be over-engineered") — fair, but a single regex test is not over-engineering.

### 6d. Axis-by-axis pinning misses interaction effects

The counter-example the prompt asks for:

- **Typecheck-partial-coverage directive (R4.5)** tells the reviewer: "manually scan excluded files for type errors."
- **Diff-empty directive (R4.2)** tells the reviewer: "read every file in `filesToReview` and evaluate against the task's described changes."

If both fire (typecheck succeeds with partial coverage AND diff is empty because changes were already committed):

- R4.2 says read all files in `filesToReview`.
- R4.5 says manually scan files in `coverage.excluded` (a subset of filesToReview).

The instructions are **redundant** (R4.2 subsumes R4.5's manual-scan instruction) but not contradictory. A reviewer following both literally re-reads excluded files twice. Not catastrophic, but the directives are "deterministic-pre-check, triage these signals" framing — when both pre-checks fail simultaneously, the reviewer is being told to do everything manually with extra steps.

A more interesting interaction: **timeout (R4.7) + diff-truncated**. R4.7 says "manually scan modified TS files." Diff-truncated says "read full file for truncated paths." If both apply to the same file, the reviewer gets two manual-fallback instructions for the same file, framed differently. Not actually contradictory but rhetorically redundant.

The axis-by-axis pinning won't surface either of these. The design's defense — "interactions between simultaneous-degradations are not a separate concern" — is the claim under challenge. A single combined-degradation fixture (timeout + diff-truncated, or partial-coverage + diff-empty) would not multiply the pin count by 15× but would catch redundancy/contradiction. **Add 2 cross-axis fixtures, not all 15.**

---

## 7. "Never breaks the build" and degraded-surface signaling

### 7a. No escalation on persistent failure

Every prepare against a project with broken tsc emits R4.6. Forever. The reviewer is told once, twice, ten times that typecheck is unavailable. The signal becomes background noise; the reviewer eventually skims past it.

**Argument for fail-loud**: a project that has invested in type-checking as a hard precondition for review should escalate — refuse to prepare, surface the actual tsc error to the user, force them to fix it.

**Argument against (design's implicit position)**: review must work even when type-checking can't. Availability > correctness.

The right answer is probably **per-project opt-in**: a `features.typecheckRequired: true` setting that flips the degradation to a hard error. The design doesn't offer this. With only on/off (`features.typecheck: true | false`), a project that wants typecheck to work cannot signal "typecheck is required" to the system. They get either soft degradation (current default) or no typecheck (explicit disable).

### 7b. No structured tag for typecheck degradation

The fast-reviews hygiene-signal pattern uses structured tags the dashboard renders. Typecheck degradation is **prose only** — embedded in the methodology string. The dashboard cannot render a banner or a status indicator; the LLM is the only consumer that processes the directive.

This means:
1. The human reviewer (looking at the dashboard) has no visual signal that this review's typecheck is degraded.
2. The reviewing LLM might forget to surface the degradation in its summary (R4.5/R4.6 ask for it but there's no enforcement).
3. Telemetry/logging cannot easily count "how often does typecheck degrade" — would require parsing the methodology string.

Recommendation: add `data.typecheckResults[0].status` (already structured), surface a corresponding dashboard pill, and have R4.5/R4.6 reference the structured field by name so the LLM has a concrete shape to mention.

### 7c. Timeout discoverability

Every prepare on a too-large project takes ≥30s. User has no signal that turning off typecheck would restore sub-second prepare. The kill switch (`features.typecheck: false`) exists but is not surfaced in the timeout directive.

**Easy fix**: R4.7 should mention the kill switch by name. "If this timeout recurs, set `features.typecheck: false` in `.spec-workflow/adversarial-settings.json` to disable typecheck pre-computation." Two sentences, high-leverage.

---

## 8. Test strategy gaps

### 8a. Wall-clock concurrency assertion is flaky

> "assert wall-clock < sum of synthetic delays"

CI under load has nondeterministic scheduling. Disk contention, GC pauses, libuv thread pool contention all serialize work that should be concurrent. False failures are inevitable.

**Better assertion**: spy on the start-times of the three utilities. Use vitest's `vi.fn()` wrappers; assert all three were *invoked* before any completed (`startedAt[i] < completedAt[j]` for all pairs). This proves concurrent dispatch without relying on actual wall-clock.

Even better: assert that mocked utilities can resolve in arbitrary order without breaking the result shape — semantic concurrency, not timing concurrency.

### 8b. Manual E2E for R3 mid-session edits is unreliable

The R3 manual E2E tests behavior — mid-session edit takes effect — that the cache makes ambiguous from the user's perspective. The tester edits the file:
- If `(mtime, size)` advanced past cache → edit takes effect.
- If `(mtime, size)` collided → cache hit → edit ignored.

The tester sees "edit was/wasn't applied" but cannot tell which path the cache took. They might conclude the cache is broken when it's actually working, or vice versa.

**Required**: an automated test for R3 mid-session edits that programmatically advances mtime by `utimes()` to force cache miss, edits the file in-place, and asserts the new value resolves. Manual E2E is inadequate for this requirement.

### 8c. Composite pins on Windows with `core.autocrlf=true`

Fixture files committed to git, checked out on Windows with `core.autocrlf=true`, get CRLF line endings. The pin compares with `.trimEnd()` per line and unified `\n`. Walk through:
1. Build emits methodology with `\n` line endings (Node).
2. Fixture file read via `fs.readFileSync` returns CRLF as-is.
3. `.split('\n')` on the fixture leaves `\r` at end of each line. `.trimEnd()` strips it.
4. Comparison passes? Yes — both sides are now arrays of lines with no trailing whitespace.

OK — but the design says "byte-equality after `.trimEnd()` per line and `\n` line endings." If the comparison is `Buffer.compare` or strict `===` on the joined string, CRLF fixtures fail. If it's line-by-line after trim, fine. **The design doesn't specify which.** Pin it.

### 8d. Property-based testing for the path-denylist matcher

The matcher has ~15 distinct rules:
- 14 exact basenames
- 7 suffixes
- 4 prefixes
- 5 path-segment matches
- Plus 5 fixture-exception segments (negation rule)
- Plus case-folding (volume-conditional for basenames, unconditional for segments)

Hand-written tests will exercise each rule once. Interaction edges are unavoidable: a path like `node_modules/secrets/key.pem` matches the path-segment rule (`secrets`) AND the suffix rule (`*.pem`). What if a fixture exception wraps it: `__tests__/secrets/key.pem` — fixture wins, but does that override BOTH the segment and suffix rules? The design says yes. Property test: `forall path: isFixturePath(path) → !isDenylisted(path).denylisted`.

The matcher is **security-relevant** (it gates secret redaction). Hand-written cases will miss interaction edges. **A 30-line fast-check property test catches what 50 hand-written cases miss.** Strongly recommended.

---

## Closing Deliverables

### Top 5 risks/gaps (ranked by likelihood × blast radius)

1. **`Promise.all` fail-fast wipes the entire prepare response on any utility throw.**
   *Decision:* using `Promise.all` (design.md:201) instead of `Promise.allSettled`.
   *Failure:* a single un-caught synchronous throw inside `realpathSync` normalization, a `JSON.parse` of malformed settings outside the cache, or `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` on `--listFiles`, causes `handlePrepare` to reject. The whole review breaks instead of degrading to "typecheck unavailable."
   *Fix:* use `Promise.allSettled`, catch each rejection at the orchestration boundary, convert to the documented absent-with-reason state. One-line change.

2. **`maxBuffer` not specified for `tsc --listFiles`; large monorepos break.**
   *Decision:* design specifies timeout, env, `--pretty false`, but not `maxBuffer`. Default 1 MB.
   *Failure:* on monorepos with ~5,000+ source files (or pnpm workspaces with deep paths), `--listFiles` exceeds 1 MB, execFile rejects with `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`. The catch may not handle this rejection shape; if it doesn't, see risk 1. If it does, the user gets `'no-parseable-output'` with no indication that a config knob would fix it.
   *Fix:* specify `maxBuffer: 16 * 1024 * 1024` and add a distinct sub-reason for buffer-overflow.

3. **`realpathSync.native` blocks the event loop on monorepos.**
   *Decision:* R2.4 normalizes via `fs.realpathSync.native` (sync). Applied to `--listFiles` output (potentially thousands of paths).
   *Failure:* on WSL2 mounting Windows or NFS-backed source trees, 5,000 paths × 5–20 ms = 25–100 seconds of blocked event loop. The dashboard's other handlers freeze. Worst case observed by a user: prepare appears to hang, dashboard becomes unresponsive.
   *Fix:* switch to `fs.promises.realpath` and `Promise.all` (chunked to avoid `EMFILE`).

4. **Test-fixture exception bypasses secret-bearing basename rules.**
   *Decision:* R1.6 keeps any path under `__tests__`, `__fixtures__`, etc., regardless of denylist match.
   *Failure:* `src/__tests__/__fixtures__/.env` containing real credentials surfaces in `data.diff`, sent to the LLM and any artifact-persistence path. Realistic in private repos with careless commits.
   *Fix:* limit the exception to path-segment denylist entries (`secrets`, `credentials`, `.aws`, `.kube`, `.docker`); preserve basename/suffix/prefix rules for `.env`, `.pem`, `.key`, `id_rsa*` even under fixtures.

5. **`(mtime, size)` cache collision strands users on stale settings.**
   *Decision:* R3.7 keys cache on `(mtime, size)`; same-second same-size edits collide.
   *Failure:* user fixes a model-name typo (e.g., `claude-opus-4-7` → `claude-opus-4-6`, both 15 chars) within the same filesystem second; cache returns prior parse forever. User has no obvious recovery — restart MCP, `touch` the file, or add whitespace. Spec says R3 documentation lands in this PR; if the user-facing doc doesn't list this gotcha, support burden shifts to "why is my model not changing."
   *Fix:* either add a content hash as a third cache key (~10 lines), or document the collision and recovery path in user-facing docs.

### Top 3 conclusions to challenge or reverse

1. **"`Promise.all` keeps wall-clock prepare bounded by max(diff, typecheck), not sum."**
   - Wall-clock is also bounded by the **synchronous prelude** (`loadSettings` on first call: 5–20 ms blocking; up to seconds on a contended Windows mount). The prelude is unmeasured and unbounded.
   - Wall-clock is also bounded by the **post-completion normalization** (§4a — sync `realpathSync.native` over thousands of paths is up to seconds of blocked event loop AFTER the typecheck child returns). The bound is `max(diff, typecheck) + normalization` for typecheck, and that normalization is sync.
   - The "max not sum" claim is true for the three async utilities in the middle. It's not true for the prepare end-to-end latency. **Reframe**: "concurrent execution of the three utilities themselves; pre/post sync work adds linearly."

2. **"The denylist guarantees identical match behavior at both call sites."**
   - This is a property of using a shared module, not a property of the matcher's correctness. The same guarantee holds with any matcher implementation. The real load-bearing claim — "the matcher's invented semantics are correct for the intended set of paths" — is unstated and unverified. Two exported entry points (`isDenylisted`, `partitionPaths`) without a consistency test means a future caller can pick either and produce divergent behavior. The "guarantee" is rhetorical, not enforced.

3. **"The settings cache makes reads negligible (< 5 ms per call)."**
   - True after first call. **First call has no cache** and pays full sync read+parse cost (~5–20 ms typical, up to seconds under filesystem contention). The first prepare after MCP startup is the typical user path, not the edge case. The "< 5 ms" claim is for warm-cache reads only; cold-cache cost is structurally different and unmeasured.

### What's missing — concrete work before code starts

1. **`maxBuffer` specification for `execFile` invocations** — both `git diff` and `tsc`. Recommend 16 MB. Document what happens on overflow.
2. **`Promise.allSettled` instead of `Promise.all`** in `handlePrepare`'s orchestration shell, with explicit per-utility rejection-to-degradation conversion. Specify the catch-and-convert as part of each utility's contract OR at the orchestrator.
3. **Numbering scheme for the rendered methodology** — is the diff directive item 0, unnumbered preamble, item 1 (renumbering everything else), or labeled section? Pick one before fixtures get authored.
4. **Per-volume case-sensitivity probe on macOS** — `process.platform === 'darwin'` is wrong on case-sensitive APFS volumes. Probe via temp-file stat at startup; cache the result per project root.
5. **Spec parser algorithm for tsc stdout** — distinguish diagnostics from `--listFiles` entries, including handling of multi-line continuation diagnostics and absolute-path-shaped substrings within error messages.
6. **Switch path normalization from sync to async** — `fs.promises.realpath` with `Promise.all` chunked at 100 paths, with per-path `try/catch` for ENOENT. Specify the degradation: unresolvable paths go to `coverage.excluded`.
7. **Recovery path for `(mtime, size)` cache collision** — either content-hash third key, or a user-facing doc note plus a `mcp tool: spec-workflow:reload-settings` escape hatch.
8. **Diff truncation fairness** — per-file pre-budget allocation OR distinct truncation messages (`per-file cap exceeded` vs `total budget exhausted, this file truncated despite size`).
9. **Denylist filtering of typecheck output paths** — `coverage.compiled`, `coverage.excluded`, and `diagnostics[].file` should be filtered through the denylist before serialization, even though the compile itself isn't. Closes the path-leak inconsistency.
10. **R3 mid-session-edit automated test** — the cache makes manual E2E unreliable; automated test that programmatically advances mtime via `utimes()` and asserts re-parse is required.
11. **Methodology spec-vs-fixture drift detection** — single regex test that asserts each R4.x verbatim block appears in at least one fixture. ~20 lines, detects silent prose drift.
12. **Property-based test for the denylist matcher** — fast-check, ~30 lines. Fixture-exception negation rule is the highest-leverage property.
13. **Fail-loud escalation policy** for projects that consider type-checking a hard precondition — `features.typecheckRequired: true` setting that flips R4.6 from soft directive to hard prepare-fail. The current binary kill-switch can't express "typecheck is required."
14. **Surface the typecheck kill-switch by name in R4.7** — the timeout directive should tell the user how to disable typecheck if the timeout recurs. Two sentences, high-leverage.
15. **Cross-axis composite-pin fixtures** — at least 2 fixtures combining degradations (e.g., `partial-coverage + diff-empty`, `timeout + diff-truncated`) to catch directive redundancy/contradiction. Doesn't multiply pin count by 15×; adds 2.
