# Adversarial Review Memory — design
Last updated: 2026-04-29 (after v3 review)

## Cumulative Findings Summary

### Accepted

**From v1 (carried through):**
- Promise.all → Promise.allSettled with `unwrap*` helpers.
- `maxBuffer: 16 * 1024 * 1024` for both `git diff` and `tsc`; `'output-overflow'` sub-reason.
- Async `fs.promises.realpath` in chunks of 100; ENOENT bucketed as `coverage.excluded`.
- Test-fixture exception narrowed to path-segment rule only.
- Case-folding rules per category (secret-bearing always; lock/binary platform-conditional; path-segments unconditional).
- `isDenylisted` removed from public surface.
- Typecheck output denylist filtering of `compiled`/`excluded`/`diagnostics[].file`.
- Two distinct diff-truncation messages (per-file vs total-budget).
- tsc stdout parser two-pass design specified.
- `'no-parseable-output'` covers both R2.9 sub-cases.
- R4.7 names `features.typecheck: false` kill switch.
- Bidirectional spec-vs-fixture drift test.
- Concurrency assertion via spies.
- Automated R3 mid-session-edit test via `utimes()`.
- Composite-pin normalization (CRLF, NFC, dash, quote, whitespace-collapse).
- "max not sum" reframed; pre/post sync work adds linearly.
- Cold-cache settings load 5–15 ms cold, <1 ms warm.
- Diff is unnumbered `**Read first:**` preamble; typecheck is item 10.

**From v2 (carried through):**
- `loadSettings` read-throw containment: try/catch around statSync/readFileSync covering EBUSY/EACCES/EISDIR/ELOOP/JSON-parse.
- Distinct `'rejection'` sub-reason for typecheck unwrap; `rejection: { message }` field for diff/hygiene.
- `runProjectTypecheck` does `mkdir({ recursive: true })` for `.spec-workflow/.cache/` before spawning tsc.
- `typecheckResults[0]` hardcoding acknowledged with explicit forward-compat boundary.
- R4.10 explicitly says "R4 is authoritative; fixtures are derived."
- `cliArgs` forward-compat decision punted explicitly.
- Cross-axis fixtures expanded to 4.
- R4.6 prose split (R4.6a feature-disabled vs R4.6b other unavailable).
- `validateAllFiles` boundary helper exists with warn-once.
- `features.typecheck` non-boolean warn (symmetric with non-string `model` warn).
- Settings malformed-warn pinned format.
- Track-A interim sentinel regression test.
- `resolveRunnerModel` non-string `model` warn.
- Cold-cache integration test.
- R4.4 + R4.5 simultaneous emission fixture (7th typecheck-axis pin).
- `unwrap*` rejection-path tests for all three utilities.

**From v3 (resolved in v4 design):**
- **Risk 1 — `validateAllFiles` unprotected (v3 #1, compounding v2 Risk 1)**: v4 adds per-element try/catch around every fallible step (typecheck/non-string drop, `path.resolve` throw on NUL byte / Symbol / BigInt, realpath ENOENT). All bucket as warn-once "dropped invalid entry." Synchronous prelude is now structurally safe.
- **Risk 2 — R4.2 silently misrepresents diff rejection (v3 #2)**: v4 splits R4.2 into R4.2a (benign empty) and R4.2b (utility-rejection). `diffState: 'rejected'` variant added with `message` field. Mirrors R4.6's split.
- **Risk 3 — closure-capture lifecycle ambiguity (v3 #3, #9)**: v4 fundamentally redesigned Track C. **Annotation persistence replaces closure capture.** Initial handler stamps `runnerOptions.model` into the approval annotation; retry handler reads from annotation. Single-resolution pin: `resolveRunnerModel` called exactly once per (approval, runner). Tests assert callCount===1 (initial+retry) or callCount===2 (legacy retry path).
- **Risk 4 — `unwrap*` warn-once key collapse (v3 #4)**: v4 keys on `(utility, error.message)`. Distinct error causes get distinct logs.
- **Risk 5 — tsc multi-line continuation dropped (v3 #5)**: v4 Pass 1 walks continuation lines (whitespace-prefixed, not absolute-path-shaped) into preceding diagnostic's `message`, joined with `\n`. Fixture test added.
- **Finding 6 — empty-extraction guard at zero only**: v4 encodes `EXPECTED_R4_BLOCK_COUNT = 8` (R4.1, R4.2a, R4.2b, R4.4, R4.5, R4.6a, R4.6b, R4.7). Test fails on inequality.
- **Finding 7 — Direction B substring too tight**: v4 adds whitespace-run collapse to single space on both sides of comparison; absorbs line-wrap and reflow without softening detection of new sentences.
- **Finding 8 — `partitionPaths` cross-platform separator (recurring)**: v4 specifies splitting on both `/` and `\` regardless of platform. Cross-platform agent → reviewer can't bypass via separator choice.
- **Finding 9 — long-running daemon runner staleness**: v4 makes `RunnerOptions` constructed per-handler-invocation, not per-server-boot. Runner instances stay long-lived singletons; only options vary per request.
- **Finding 10 — R4.4 "run tsc yourself" undeliverable**: v4 reworded to "note this gap explicitly in your review summary so the human reviewer knows to check the omitted entries manually." Capability-agnostic. Also removed "spurious" triage bucket.
- **Finding 11 — Track-A interim marker too generic**: v4 changed marker to `# SPEC-WORKFLOW:TRACK-A:INTERIM-PIN`.
- **Finding 12 — symlinked workspace `validateAllFiles`**: v4 realpaths both entry and `projectPath` before prefix comparison. Symlinks pointing outside `projectPath` are correctly excluded.
- **Diff-staleness R1.11 timestamp heuristic**: removed in v4 as structurally wrong-direction; partial-commit case documented as known limitation; correct fix deferred to a "implementation-log validation" follow-up spec.

### Partially Accepted
- **Suffix/prefix semantic ambiguity (v1 §2a)**: boundary tests added but contract for `id_rsa` vs `id_rsareadme.md` and double-extension `things.lock.ts` is still inferred from tests rather than stated. Carried forward.
- **Property-based test for matcher (v1 §8d)**: deferred to v2/Out of Scope.
- **Per-volume case-sensitivity probe on macOS (v1 §4b)**: deferred.
- **Structured dashboard tag for typecheck degradation (v1 §7b)**: UI concern, out of scope.
- **Fail-loud escalation policy (v1 §7a)**: deferred as `features.typecheckRequired: true`.

### Rejected
- **Content-hash third cache key (v1 §5b)**: deferred; recovery is `touch` or restart.
- **Cascade-from-silent-cause warning (v1 §3d)**: not addressed.
- **`.gitignore` auto-append for `.spec-workflow/.cache/` (v2 missing #5)**: not addressed.
- **Stale buildinfo distinct reason (v2 missing #15)**: rejected; covered by `'no-parseable-output'`.
- **Advisory file lock on `tsc.tsbuildinfo` (v2 missing #6)**: explicitly rejected; documented unsupported.

### Unresolved
- **Two-warning-per-file-edit malformed-warn semantics (v1 §5c)**: still not addressed.
- **`.gitignore` deliverable for `.spec-workflow/.cache/`**: a user who commits `.spec-workflow/.cache/tsc.tsbuildinfo` cross-machine still hits silent rebuild or errors. Not addressed in v4.
- **Multi-config R4 prose lockstep enforcement**: design says "future spec must update R4 prose" but no mechanical enforcement when the day comes.
- **Concurrent prepare against same project**: silent corruption + silent rebuild; no detection. Documented unsupported but failure mode is unobservable to users.

## Patterns & Themes

- **Each round resolves the prior round's structural concerns by introducing structural mechanisms.** v1 noted "never throws" was contract-by-convention; v2 added Promise.allSettled + unwrap*; v3 closed the synchronous-prelude hole; v4 closed `validateAllFiles`. Each round shifted reliability from convention to structure.
- **Track C went through three architectures in three rounds.** v1: per-callsite resolution. v2: closure-capture at runner construction. v3 review surfaced lifecycle ambiguity. v4: annotation persistence (durable, restart-survivable, structurally observable). The v4 design abandoned closure capture entirely — runners are long-lived singletons; options are per-handler-invocation; the cross-handler channel is the approval annotation.
- **Methodology prose is increasingly conditional.** v1 had R4.1–R4.7. v2 split R4.6. v3 split R4.2. v4 has 8 R4.x blocks. Each split was driven by an "X reason silently misrepresents Y to the reviewer" finding. The pattern: any time a structurally-distinct degraded state is added (rejection, feature-disabled, etc.) the corresponding reviewer-facing prose should be split.
- **Forward-compat claims are being narrowed honestly each round.** `cliArgs` array semantics, multi-config R4 prose lockstep, per-volume case-sensitivity — each is now explicitly punted rather than implicitly claimed.
- **The v4 surface area is large — eight R4.x directives, three utilities, four route handlers, an annotation schema extension.** Some surface area was not in v3 review's scope: annotation schema migration, schema parse failures, write-time concurrency. v4 review should focus there.

## Guidance for Next Review

The v4 design has resolved every named v3 finding. Re-examination should focus on:

### Focus areas (likely to surface novel findings)

- **Annotation persistence as a new failure surface (Track C v4)**: this is a wholly new mechanism not present in v1–v3. Specifically:
  - **Annotation write atomicity**: design says "stamp into the annotation BEFORE invoking the runner." But what if `stampAnnotationRunnerOptions` and the runner-spawn race? What if two initial-review requests for the same approvalId hit concurrently? Two stamps, two `runner.run` calls, two jobIds — does the annotation reflect the last write or the first? Does the retry pick up the right model?
  - **Annotation schema extension and existing parsers**: the existing annotation is a JSON-encoded string. Other consumers may parse this string. Adding `runnerOptions` may surprise dashboards or downstream tools that strict-validate. Are all existing consumers verified to ignore unknown keys?
  - **Annotation read-time JSON parse failures**: if `parseApprovalAnnotation(approval.annotations)` throws (corrupted annotation, encoding bug, race during write), what does retry do? The design says the retry handler "reads" — does it have its own try/catch? The design's error scenario #16 covers write failure; what about read failure?
  - **`stampAnnotationRunnerOptions` failure scenario #16**: design says retry "treats this as the legacy-annotation case (graceful degrade to re-resolve)." But the warn-once is keyed by what? `(approvalId, jobId)`? `(approvalId)`? If a long-running daemon serves many approvals each with stamp failures, the warn-once dedup behavior matters.
- **`validateAllFiles` realpath subtleties**:
  - **Symlink loops**: `realpathSync` on a symlink loop throws ELOOP. design.md:265 says `safeRealpath` catches ENOENT — does it also catch ELOOP? If not, `validateAllFiles` rethrows from a per-element step that *was* in try/catch but the outer realpath call (line 234, `safeRealpath(projectPath)`) is *outside* the per-element try/catch. A symlink loop on `projectPath` itself crashes prepare.
  - **TOCTOU between realpath and the consumer utility**: `validateAllFiles` realpaths a file, downstream `git diff` is invoked with the realpath'd version. If the symlink is replaced mid-prepare, git operates on a now-different file. Is this a v1 concern or accepted noise?
  - **Inconsistent realpath behavior on Windows junctions vs symlinks vs reparse points**: `realpathSync` on Windows handles all three differently. The design says "realpath the entry and projectPath before the prefix comparison" but doesn't disambiguate Windows reparse-point semantics. A Windows junction inside `projectPath` pointing outside *might* still appear inside after realpath, depending on the reparse type.
- **tsc multi-line continuation parser edge cases (Risk 5 fix)**:
  - **"Whitespace-prefixed AND not absolute-path-shaped"** is the rule. But tsc emits some output that is whitespace-prefixed AND happens to start with a path-shape after some indentation: `"    /usr/local/lib/foo.ts"` in pretty=false mode is unlikely but `"  src/foo.ts:42"` (relative path) starts with whitespace and has no absolute-path shape. Could this be misclassified as a continuation line and absorbed into the prior diagnostic's message, hiding it from listFiles output?
  - **TS2418/TS2417 "Type X is not assignable" with a related-info indented block**: tsc sometimes emits "Related diagnostic from..." continuation lines that are themselves diagnostic-shaped (`src/bar.ts(10,5): error TS...`). Pass 1's "stops at another diagnostic-pattern line" rule means these *do not* get absorbed — they start a new diagnostic. Is that the intent? The reviewer sees two diagnostics where the second is "related info" not a real error.
  - **Unicode in messages**: type names with non-ASCII identifiers, or paths with Unicode segments (CJK, emoji). The path-shape regex `^[A-Za-z]:[\\/]` (Windows) and `^/` (POSIX) doesn't account for tsc emitting non-ASCII paths. Are continuation lines correctly excluded from listFiles output when paths contain non-ASCII?
- **R4.2a vs R4.2b composition with cross-axis fixtures**: design adds a 4th diff-axis pin (`diff-rejected`), but the cross-axis fixture list (R4.10) has only the four cross-axis pins. None of them is `diff-rejected + typecheck-{rejection,timeout,partial-coverage}`. If both diff and typecheck reject in the same prepare, the methodology composes R4.2b ("surface the rejection in your review summary, quote message") with R4.6b ("surface this degradation in your review summary"). Two surfacing asks. Are they both expected to fire? Is there redundancy that needs explicit pinning?
- **`EXPECTED_R4_BLOCK_COUNT = 8` lockstep enforcement**: the constant is updated when adding/removing R4.x blocks. v4 added R4.2a/R4.2b (count 7→8). What if a future spec adds R4.3 back (e.g. a different staleness signal)? The lockstep discipline depends on the author remembering. Is there any test that asserts the constant matches the actual count of `> ` block-quote-prefixed paragraphs in requirements.md? Or is it manually maintained?
- **`partitionPaths` segment splitting on both `/` and `\` — Windows drive letter and UNC paths**: a Windows path `C:\proj\secrets\foo.json` split on both separators yields `['C:', 'proj', 'secrets', 'foo.json']`. Does `'C:'` accidentally match a denylist segment if a user happens to name a directory `c:`? UNC paths (`\\server\share\secrets\foo.json`) split yields `['', '', 'server', 'share', 'secrets', ...]` with empty leading segments. Are empty segments handled? Do they ever match a denylist entry by accident if the entry is `''`?
- **`features.typecheck: false` with non-empty `typecheckResults` array**: design says length is always 1 in v1, but the v4 typecheck unavailable union enumerates `'feature-disabled'` as a reason. Is the array still length 1 when feature is disabled? If yes, what's the `tsconfigPath` field set to (the file may not exist or be parseable)? The design says `tsconfigPath: string` is required on every variant.
- **Annotation legacy fallback warn-once key**: design.md:359 logs `warnOnce('multi-server:retry-legacy-annotation', approvalId, ...)`. The warn-once key includes `approvalId` — so each legacy approval logs once per process. In a daemon serving many legacy approvals, this is many warns. Acceptable noise level? Or should it dedup at coarser granularity?
- **`.spec-workflow/.cache/` directory not gitignored (recurring unresolved)**: still not addressed in v4. The cache directory is created by the typecheck utility but no setup step adds it to `.gitignore`. A user committing `.spec-workflow/.cache/tsc.tsbuildinfo` cross-machine hits a stale buildinfo on another machine and gets `'no-parseable-output'` (silently degraded). The fix is one line in the install/setup path.
- **Composite-pin normalization absorbs too much**: whitespace-run collapse to single space. If a fixture has "Read the diff first.  Read it before opening any file." and R4.1 has "Read the diff first. Read it before opening any file." (one space vs two), normalization collapses both. But it also collapses "diff-first" (hyphen-separated single token) vs "diff first" (two tokens) the same way? Actually no — that's not whitespace. But a fixture with `**Read first:**\n\n` (paragraph break) vs R4.1 single line — both normalize to `**Read first:**` followed by content with single space. Is the directive boundary detection robust if Direction B sees content with collapsed paragraph breaks?
- **30-second SIGTERM → 2s grace → SIGKILL on Windows**: Node's `process.kill` on Windows doesn't have real signals; SIGTERM is implemented as `TerminateProcess` (immediate, not graceful). The 2-second grace is a no-op on Windows. The design says "Windows-specific process termination edge cases" are out of scope (requirements.md:283), but the contract claim is unverifiable on Windows.
- **`--listFiles` output between diagnostics**: tsc emits `--listFiles` output to stdout *after* diagnostics in some configurations, and *interleaved* in others (depending on internal file iteration order). Pass 2 is "lines not consumed by Pass 1." Does Pass 2 correctly handle the case where listFiles output is interleaved with diagnostics that span multiple lines (Pass 1 absorbs continuation; Pass 2 then sees a path that *would* have been listFiles output but is now context-discarded by Pass 1's continuation-absorption)? Tested fixture covers this?
- **`runnerOptions.model === undefined` case in annotation**: design says `runnerOptions.model` is optional within `runnerOptions` because resolveRunnerModel may return undefined (CLI default). In the annotation, this serializes as `{ "runnerOptions": {} }` (with no `model` key). Retry reads `annotation.runnerOptions?.model !== undefined` — checks for the key being present, not for the field being non-undefined explicitly. JSON serialization conflates `undefined` (omitted) with `not provided`. If a future write explicitly sets `model: null` (a buggy write), the check passes (`null !== undefined`) and `null` flows to `runner.run({ model: null })`. Does the runner tolerate `null`?
- **Annotation field collision**: the design says the existing annotation is a JSON string with fields like `decision`, `trigger`, `jobId`. Adding `runnerOptions` is forward-compat for new code. But what if a future spec wants to add `runnerOptions` for a different purpose (e.g., per-task overrides)? The field name is now claimed by Track C. Should it be more specific (`adversarialRunnerOptions`, `taskReviewRunnerOptions`)?

### Areas well-covered (don't re-examine deeply)

- `Promise.allSettled` orchestration choice + `loadSettings` read-throw containment (v3-resolved)
- `validateAllFiles` per-element try/catch contract (v4-resolved)
- R4.2a/R4.2b prose split mirroring R4.6 (v4-resolved)
- Track C closure-capture → annotation-persistence redesign (v4-resolved structurally)
- `unwrap*` warn-once key on `(utility, error.message)` (v4-resolved)
- tsc multi-line continuation absorption in Pass 1 (v4-resolved at the design level)
- `EXPECTED_R4_BLOCK_COUNT = 8` constant (v4-resolved)
- Whitespace-run collapse normalization (v4-resolved)
- `partitionPaths` cross-platform separator splitting (v4-resolved)
- Track-A interim marker token uniqueness (v4-resolved)
- `validateAllFiles` realpath-based inside-projectPath check (v4-resolved at the design level)
- "Spurious" triage bucket removal in R4.4 (v4-resolved)

### Classification directive for v4 reviewer

Each finding must be classified as one of:
- **Novel**: Not identified in any prior review.
- **Compounding**: Builds on or deepens a prior finding.
- **Recurring**: Same issue identified before but not yet resolved — severity should escalate.
