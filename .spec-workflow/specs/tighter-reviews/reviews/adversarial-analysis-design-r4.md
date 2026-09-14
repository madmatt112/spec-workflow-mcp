# Adversarial Analysis — `tighter-reviews/design.md` (round 4)

Reviewer perspective: senior staff engineer, daemon/state/TS-tooling-internals lens. Prior rounds (v1–v3) and the v4 design's responses are documented in `adversarial-memory-design.md`. The v4 design has named-resolved every v3 finding; this review attacks the new surface (annotation persistence, the per-element realpath wrapper, the Pass-1 continuation parser, `EXPECTED_R4_BLOCK_COUNT`) and the carry-forward unresolved items, looking for new severity rather than re-discovery.

## Findings by Dimension

### 1. Annotation persistence (Track C v4 — largest new surface)

**1a. Annotation read-failure path is fully unspecified — Novel, HIGH severity.**
design.md:354 says `const annotation = parseApprovalAnnotation(approval.annotations);` then reads `annotation.runnerOptions?.model`. Error scenario #16 (design.md:471) covers `stampAnnotationRunnerOptions` *write* failure. **Read failure is silent on the page.** If the annotation string is corrupted (encoding bug, partial write from a prior crash, a manual edit, schema-evolution conflict with a future field), `parseApprovalAnnotation` throws inside the retry handler. There is no `try/catch`, no warn-once key, no documented degradation. Two concrete failure modes:
- The retry HTTP handler returns 500 to the dashboard. The user observes "retry crashed." The structural reliability claim ("no I/O throw escapes") was scoped to `handlePrepare`'s prelude; the multi-server retry route is now *the* fragile spot.
- If `parseApprovalAnnotation` is wrapped in a try/catch elsewhere in `multi-server.ts` (existing call at multi-server.ts:896 per design's claim), then the retry handler silently bypasses model resolution entirely and runs with `model: undefined`. The R3.9 contract — "retry uses same model as initial" — is broken with no log signal.

**Fix:** Specify in design Error Scenario #16 (or a new #17) that `parseApprovalAnnotation` is wrapped at the retry callsite; throw → `warnOnce('multi-server:retry-annotation-parse-failure', approvalId, err.message)` + fall through to legacy `resolveRunnerModel` path. Pin a test that corrupts `approval.annotations` and asserts retry still succeeds with the legacy-fallback model.

**1b. Concurrent initial-review for same approvalId — Novel/Compounding (Memory note 96), MEDIUM-HIGH severity.**
The design assumes "stamp BEFORE runner.run" gives retry the right model. design.md:332–348. But two concurrent `POST /approvals/:id/adversarial-review` requests:
1. Both call `loadSettings` (different mtimes possible if a settings edit landed between the two reads — rare but legal).
2. Both call `stampAnnotationRunnerOptions` with potentially different resolved models.
3. Both call `runner.run` — two jobs spawn.

**The annotation reflects last-write-wins with no documented merge strategy.** The retry then reads whichever stamp won, which may not match the model `runner.run` was actually invoked with for the *first* job (whose run is now in-flight). Worse: if the existing approval-decision handler also writes to `approval.annotations` (it presumably writes `decision`/`trigger`/`jobId`), Track C's stamp may clobber a concurrent decision-handler write — silent decision-metadata loss. The design's claim "annotation persistence is a structural guarantee" only holds for serialized writes; concurrency is not addressed.

**Fix:** Add a multi-server section explicitly stating annotation writes are read-modify-write atomic OR documenting that two concurrent initial-reviews for the same approvalId is rejected at the route layer (e.g. via an existing approval-state check). Without this, the "structural guarantee" claim is overstated.

**1c. `runnerOptions.model === null` (explicit JSON null) flows unfiltered — Novel, LOW-MEDIUM severity.**
design.md:355 checks `annotation.runnerOptions?.model !== undefined`. JSON does not have an `undefined` literal — only `null` and "key absent." If a future write or a manual edit produces `"runnerOptions": { "model": null }`, the check passes (`null !== undefined`), and `null` flows to `runner.run({ model: null })`. The design's assertion "model: undefined → CLI default" is only true for the absent-key case. Whether the runner tolerates `null` is unspecified — design.md:39 says "already accept `model?: string`," which TypeScript treats as `string | undefined`, so `null` would coerce to `--model null` on the CLI in many shellings.

**Fix:** The check at design.md:355 should be `typeof annotation.runnerOptions?.model === 'string' && annotation.runnerOptions.model !== ''` — symmetric with the empty-string-falls-back rule from R3.5.

**1d. `runnerOptions` is too generic a key — Novel, LOW severity (forward-compat).**
design.md:432 "Unknown keys under `runnerOptions` are silently ignored." But the *key* `runnerOptions` itself is generic. A future spec wanting per-task overrides may want `runnerOptions` with different semantics (e.g. `runnerOptions.attempt`, `runnerOptions.budget`, `runnerOptions.toolset`). Track C has now claimed the namespace. The retry handler that "silently ignores unknown keys" might silently ignore a future field that should not be ignored.

**Fix:** Either rename to `trackC.runnerOptions` / `modelPin.runnerOptions` (explicit namespacing) or document that `runnerOptions` is a Track-C-owned channel and future per-runner-persisted fields must coordinate with the Track-C reader.

### 2. `validateAllFiles` realpath subtleties

**2a. `safeRealpath(projectPath)` lives OUTSIDE the per-element try/catch — Compounding (v3 Risk 1, Memory note 101), HIGH severity.**
design.md:234 — the `realProjectPath` resolution happens BEFORE the for-loop. `safeRealpath` is described (design.md:265) as "catches realpathSync ENOENT and returns undefined." It does NOT catch `ELOOP` (symlink loop), `EACCES` (permission denied on a parent directory), or `ENAMETOOLONG`. If `projectPath` itself has any of these conditions — a misconfigured worktree, a CI environment with a sandboxed read-only mount, a Linux setup with a permission gate above projectPath — `validateAllFiles` throws before entering the loop. The v4 fix (per-element try/catch) does not catch this; the synchronous prelude *can* still escape.

**The design's claim at line 55 "synchronous prelude cannot escape" is false in this exact case.** This is the v3 finding, fixed for per-element steps but not for the projectPath realpath.

**Fix:** Wrap `safeRealpath(projectPath)` in a try/catch (or extend `safeRealpath` to swallow ELOOP/EACCES/ENAMETOOLONG with warn-once); fall back to `projectPath` literal if realpath fails. Add a test covering ELOOP on projectPath.

**2b. Fail-OPEN behavior when target is deleted — Novel, MEDIUM severity.**
design.md:265 says "files deleted between log-implementation and prepare don't break validation" — when `safeRealpath` returns undefined, the original `resolved` path is used for the inside-projectPath check (design.md:246). If the original is `<projectPath>/foo` and `foo` was a symlink whose target was outside projectPath but the file is now gone, the original path *still starts with* `realProjectPath + sep`. The check passes. The path is kept.

This is **fail-open** for the security-adjacent symlink-points-outside check. The v4 design's stated fix for v3 Finding 12 ("symlinks pointing outside are correctly excluded") does not hold for the deleted-target case. The malicious or adversarial flow is: agent stamps a symlink at log-implementation time pointing outside projectPath; deletes the target before `prepare`; validateAllFiles cannot realpath, falls back to original-path prefix check, keeps the entry; downstream `git diff` runs against the dangling symlink (probably empty), but the security envelope is broken in principle.

**Fix:** When `safeRealpath` returns undefined for an *entry* (not projectPath), drop the entry rather than fall back to original-path prefix. The "deleted file" case loses an entry but the security claim holds. Document that `safeRealpath` undefined → drop, not keep.

**2c. Windows reparse-point semantics implicitly POSIX — Recurring (Memory note 103), MEDIUM severity.**
The design doesn't disambiguate `realpathSync` behavior on Windows junctions vs symlinks vs other reparse points. Different Node versions handle these differently; some junctions resolve through, some stop at the boundary. The inside-projectPath check on Windows is **not equivalent** to the POSIX check. Either claim cross-platform with the Windows degradation explicit, or scope the symlink-safety claim to POSIX.

**Fix:** Add a one-paragraph "POSIX-only" note in §Components/validateAllFiles, or test against Windows junctions in the integration suite.

### 3. tsc Pass 1 continuation parser

**3a. Indented RELATIVE paths get absorbed as continuation — Novel, MEDIUM severity.**
design.md:174 — Pass 1 absorbs lines "starting with whitespace AND not matching an absolute-path shape." The path-shape regex is absolute-only (`^[A-Za-z]:[\\/]` or `^/`). Some tsc configurations, wrapper invocations, or non-standard shell pipes emit indented relative paths in `--listFiles` output (`   src/foo.ts`, `  packages/utils/foo.ts:42`). These are:
- Whitespace-prefixed → match Pass 1's continuation rule.
- Not absolute-path-shaped → don't trigger Pass 1's stop rule.

**Result:** the relative path is absorbed into the prior diagnostic's `message`, silently dropped from `coverage.compiled` (so inScope tagging breaks), and silently inflates the message size.

**Fix:** Either tighten Pass 1 to require the continuation line *not* contain `\.(ts|tsx|js|jsx)(:|$)` shapes, OR add a `--listFiles`-specific marker check, OR add a fixture covering tsc output with indented relative paths to the test suite. The current regex is too permissive on the negative side.

**3b. TS2418/TS2417 related-info is duplicated as a top-level diagnostic — Novel, LOW-MEDIUM severity.**
tsc emits "related diagnostic from..." as continuation that is itself diagnostic-shaped (`src/bar.ts(10,5): error TS...`). Pass 1's stop rule says "stops appending when it hits another diagnostic-pattern line" — so the related-info line *starts a new diagnostic*. The reviewer sees two top-level diagnostics with no link between them; triages them as independent; double-counts against the 100-cap.

**Fix:** Either acknowledge in the design that related-info diagnostics are emitted as siblings (and add a regression test pinning this expectation), or detect "related diagnostic from..." prefix and absorb. Acknowledgment is sufficient.

**3c. No per-diagnostic message size cap — Novel, MEDIUM severity (payload bloat).**
After Pass 1 absorbs continuation lines, a single diagnostic's `message` field can be arbitrarily large. TS2345/TS2322 type-expansion lines for deeply nested generics commonly run 20+ lines. 100 diagnostics × 10 KB each = 1 MB of `message` payload in the prepare response. The MCP response shape is permissive; nothing today caps a single diagnostic's message. The 100-cap addresses count, not size.

**Fix:** Add a per-diagnostic message size cap (suggest 4 KB, with a `<truncated>` marker) inside `runProjectTypecheck` after Pass 1 completes. Document the cap.

### 4. `EXPECTED_R4_BLOCK_COUNT` lockstep enforcement

**4a. Drift test failure message doesn't name the missing block — Novel, LOW severity.**
design.md:495. When the extractor returns a count differing from the constant, the test fails with `extractor returned N, expected 8`. The author then has to count blocks manually to find which one broke. With 8 nearly-identical block-quote starts, this is non-trivial.

**Fix:** Have the extractor also emit the *names* of matched blocks (e.g. by capturing the first sentence of each); the test asserts `Array.from(extractedBlocks.keys()).sort()` equals an expected name array. Failure pinpoints the missing/extra block by name.

**4b. Whitespace-collapse absorbs paragraph-break disambiguation — Compounding (Memory note 114), LOW-MEDIUM severity.**
The whitespace-run-collapse normalization (v4 fix for v3 Finding 7) treats `\n\n` (paragraph break) and ` ` (single space) as equivalent. Direction B extracts directive blocks "delimited by paragraph breaks between `**Read first:**`, item-9, item-10 markers" (requirements.md:222). After whitespace-collapse, paragraph breaks are gone. A fixture with R4.5 split across two paragraphs vs R4.5 written as one paragraph in requirements.md normalize identically. The drift test passes when it should arguably fail (or vice versa, depending on which side has the boundary).

**Fix:** Apply the boundary-detection step BEFORE whitespace-collapse normalization. The block extractor should split on `\n\n` first, then normalize each block's interior whitespace.

**4c. Future R4.x written as a numbered list bypasses the extractor — Novel, MEDIUM severity (silent coverage loss).**
The extractor matches `> ` block-quote and ` ``` ` fenced-block delimiters (design.md:495 / requirements.md:221). A future R4.x written as `1. **Read X first.** ...` (numbered list) matches neither delimiter. The extractor returns 7. The constant says 8. Test fails. The author, fighting an unrelated CI failure, flips the constant to 7 to land their PR. **The new directive's coverage is silently dropped** with no enforcement that the constant reduction was intentional.

**Fix:** The constant change should require a paired test-file change that explicitly re-derives the count (e.g. `expectBlockNames(['R4.1', 'R4.2a', ...])` rather than `expectCount(8)`). Naming the blocks makes "I lost a block to a delimiter change" obvious in code review.

### 5. R4.2b composition with cross-axis fixtures

**5a. Maximally-degraded `diff-rejected + typecheck-rejection` is unpinned — Novel/Compounding (Memory note 108), MEDIUM severity.**
The four cross-axis fixtures (R4.10, requirements.md:208–212) are: `success-partial-coverage + diff-empty`, `timeout + diff-truncated`, `unavailable-other + diff-truncated`, `success-with-diagnostics + diff-empty`. **None pins a `diff-rejected` cross-state.** The new R4.2b directive composes with R4.6b ("surface this degradation in your review summary") to produce two surfacing asks. The prose redundancy/contradiction the cross-axis matrix is designed to catch is not exercised for the most-degraded combination.

**Fix:** Add a 5th cross-axis fixture: `diff-rejected + typecheck-rejection`. This is the maximally-degraded prepare and the one most likely to leak rhetorical contradiction or duplicated "manually scan" guidance.

**5b. Three rhetorical framings of "fall back to manual" are not normalized — Novel, LOW severity.**
- R4.2a/R4.2b: "Read every file in `filesToReview`."
- R4.5: "Manually scan them for type errors and structural issues."
- R4.6b: "Manually scan the modified TypeScript files for type errors and structural problems."
- R4.7: "Manually scan the modified TypeScript files."

When R4.5 + R4.6b compose (partial-coverage + other-unavailable, an edge case the schema allows but the cross-axis matrix doesn't pin), the reviewer reads "manually scan excluded files" then "manually scan modified TypeScript files" — overlapping but distinct sets. Cognitive load increases; the reviewer may scan the excluded set twice.

**Fix:** Pin a fixture for `success-partial-coverage + unavailable-other`. The fixture authoring step itself will reveal the rhetorical overlap and motivate prose alignment.

### 6. `partitionPaths` cross-platform splitting edges

**6a. Windows drive letter `C:` as a segment — Novel/Compounding (Memory note 110), LOW severity.**
`C:\proj\secrets\foo.json` split on both `/` and `\` yields `['C:', 'proj', 'secrets', 'foo.json']`. The `'C:'` segment passes through the path-segment matcher. Path-segment matches are unconditionally case-insensitive (design.md:110). If a future denylist entry contains `':'` or a typo introduces `'c:'`, the drive letter accidentally matches every Windows path. Conversely, on Linux a directory named `aws:` (legal) splits as `['aws:']` — does not match `.aws` (different segment), so this exact case is fine, but the principle is that drive letters and reparse markers leak into segment comparison.

**Fix:** Strip drive letters before segmentation (`/^[A-Za-z]:/`) when on Windows, or document that denylist entries containing `:` are reserved.

**6b. UNC path empty leading segments — Novel, LOW severity.**
`\\server\share\secrets\foo.json` split yields `['', '', 'server', 'share', 'secrets', 'foo.json']`. Empty strings as segments — does the matcher early-out on empty? If a malformed denylist entry is `''`, every path matches. This is defense-in-depth: a denylist entry should never be empty, but a config-loading bug or misuse could produce one.

**Fix:** `partitionPaths` should filter out empty-string segments before comparison; the denylist constructor should reject empty entries.

**6c. macOS APFS case-sensitivity probe — Recurring (Memory note "v1 §4b"), LOW severity, no escalation.**
Still deferred to v2. The `process.platform === 'darwin'` proxy is wrong for case-sensitive APFS volumes. This is the same finding as before; no new severity.

### 7. Operational concerns

**7a. `.gitignore` for `.spec-workflow/.cache/` — Recurring (Memory note 113, also v2 missing #5), MEDIUM severity, ESCALATING.**
The v4 design *actively writes* to `.spec-workflow/.cache/` from `runProjectTypecheck` (design.md:170). The carry-forward concern was "user might commit the cache file." Now there is a code path that *creates* the directory on every prepare. The probability that a user discovers the directory in their working tree and `git add`'s it is materially higher than in v1. The fix remains one line in the install/setup path. The previous rejection rationale ("not addressed") is weaker now that the cache directory is unconditionally created.

**Fix:** Add an installer/setup hook that appends `.spec-workflow/.cache/` to the project's `.gitignore` if missing, OR document this as a manual step in the user-facing README in the same PR as Track A. The doc deliverable already exists for Track C (R3.11); extend it to cover this.

**7b. Concurrent prepare silent corruption is unobservable — Recurring (Memory note 79), MEDIUM severity.**
design.md:182 says "documented unsupported." But the failure mode — typecheck takes 30s on every subsequent prepare because tsc keeps rebuilding from a corrupted buildinfo — surfaces nowhere. The user observes nothing wrong. Latency degradation without a user-visible signal violates the spec's reliability stance ("reviewer is told they are operating in a degraded surface; silent under-coverage is not possible," requirements.md:264). For *coverage* this is enforced; for *latency* it is not.

**Fix:** Detect a buildinfo-related warning on stderr and surface it in the response, e.g. `data.typecheckWarning: 'tsbuildinfo rebuild — concurrent prepare suspected'`. R4.6b prose notes the cause.

**7c. Windows SIGTERM grace is a no-op — Compounding (Memory note 115), LOW severity (scoped out).**
design.md:171 says "30 s timeout (SIGTERM → 2 s grace → SIGKILL)." On Windows, `process.kill('SIGTERM')` is `TerminateProcess`, immediate. The 2-second grace is a no-op. The contract is unverifiable on Windows. Out of Scope at requirements.md:279 says "Windows-specific process termination edge cases" are v2, but the *contract* claim is platform-agnostic. Either scope the contract or weaken the claim.

**Fix:** Append "(POSIX; Windows behavior is `TerminateProcess`-immediate, deeper handling deferred to v2)" at design.md:171.

**7d. Settings cache and warn-once flag growth — Novel, LOW severity (bounded but not documented as bounded).**
`loadSettings` cache and warn-once flags are keyed per absPath. A multi-project daemon serving 100 projects has ~100 entries — about 400 KB JSON + 100 booleans, acceptable. Not a real risk; a sentence acknowledging the bound would resolve.

**Fix:** Add a one-line non-functional requirement: "Settings cache size is O(unique projectPaths served per process); no eviction policy is required at v1 scale."

## Top 5 Risks (Severity-Ranked)

| # | Severity | Classification | Location | Failure | Fix |
|---|----------|---------------|----------|---------|-----|
| 1 | HIGH | Compounding (v3 Risk 1, Memory 101) | design.md:234 | `safeRealpath(projectPath)` lives outside the per-element try/catch; ELOOP/EACCES/ENAMETOOLONG on `projectPath` rethrow out of `validateAllFiles`. The "synchronous prelude cannot escape" claim (design.md:55) is false. | Wrap the projectPath realpath call (or extend `safeRealpath` to swallow ELOOP/EACCES/ENAMETOOLONG with warn-once). Fall back to literal `projectPath`. Add a test fixture for ELOOP on projectPath. |
| 2 | HIGH | Novel | design.md:354 | Annotation read-failure is unspecified. `parseApprovalAnnotation` throw on a corrupted annotation crashes retry (or silently bypasses model resolution if wrapped elsewhere). R3.9 is broken with no log signal. | Wrap `parseApprovalAnnotation` at the retry callsite; throw → warn-once + legacy-fallback path. Pin a test that corrupts `approval.annotations` and asserts retry succeeds with re-resolved model. |
| 3 | MEDIUM-HIGH | Novel/Compounding (Memory 96) | design.md:332–348 | Two concurrent `POST /approvals/:id/adversarial-review` for the same approvalId have undefined annotation last-write semantics; the existing decision-handler may concurrently write the same annotation and lose its writes to the Track-C stamp. | Specify whether annotation writes are read-modify-write atomic, or document/enforce that two concurrent initial-reviews per approvalId is rejected at the route layer. |
| 4 | MEDIUM | Novel | design.md:264–265 | `safeRealpath` ENOENT fallback uses original path for inside-projectPath check; a symlink with deleted target whose target was outside the project passes the prefix check (fail-OPEN). Breaks the v4 symlink-safety claim. | When `safeRealpath` returns undefined for an *entry*, drop the entry. Only `projectPath` realpath should fall back. |
| 5 | MEDIUM | Novel | design.md:174 | Pass 1 continuation rule absorbs indented relative paths (`   src/foo.ts:42`), silently dropping them from `coverage.compiled` and inflating the parent diagnostic's `message`. | Tighten Pass 1's continuation rule to reject lines containing `\.(ts|tsx|js|jsx)(:|$)` shapes regardless of leading whitespace, or pin a fixture covering indented-relative-path tsc output. |

## Top 3 Conclusions to Challenge or Reverse

**1. Quote (design.md:9):**
> "This makes 'retry uses initial's model' a structural guarantee even across server restarts, settings-file edits, and cache invalidations between initial and retry."

**Replace with:** This makes "retry uses initial's model" structural for the *single-write, sequential, parse-clean* case. The guarantee does NOT cover (a) two concurrent initial-reviews for the same approvalId (last-write-wins, undefined which job's model is observed by retry), (b) a corrupted `approval.annotations` JSON string read by the retry handler, or (c) a future-spec writer that uses the `runnerOptions` key for a different purpose. These are known gaps requiring explicit handling — not "structural guarantees."

**Why:** The current claim oversells. Three orthogonal failure modes (concurrency, parse failure, namespace collision) each break the structural guarantee. Naming the gaps — even as "out of scope" — preserves credibility.

---

**2. Quote (design.md:55):**
> "The synchronous prelude cannot escape unless the underlying Node runtime throws in a way that isn't catchable, which is not a v1 concern."

**Replace with:** The synchronous prelude inside `validateAllFiles`'s per-element loop cannot escape via a per-element step. The `safeRealpath(projectPath)` call at line 234 lives *outside* the loop and only catches ENOENT. ELOOP, EACCES, ENAMETOOLONG, or any other realpath error on `projectPath` itself rethrows out of the helper. v1 hardens to: wrap the projectPath realpath call (or extend `safeRealpath` to swallow non-ENOENT errors with warn-once and fall back to the literal path).

**Why:** The current claim is precisely the kind of optimistic structural assertion that v3 review escalated against. The fix is mechanical and one-line.

---

**3. Quote (design.md:326):**
> "R4.2b directive surfaces the rejection explicitly via `data.diffRejection.message`. Mirrors R4.6b's treatment of typecheck `'rejection'`."

**Replace with:** R4.2b mirrors R4.6b's *prose* split. The matrix protection that R4.6b enjoys — a cross-axis fixture pinning its composition with adjacent typecheck states — does NOT extend to R4.2b. The R4.10 cross-axis list (requirements.md:208–212) chose its four pins before R4.2b existed and was not revisited. The maximally-degraded `diff-rejected + typecheck-rejection` composite — exactly the case where two "surface this in your review summary" asks compose — is the unpinned hole the cross-axis matrix was created to catch.

**Why:** The "mirrors R4.6b" claim implies parity of test coverage. The test coverage is not at parity. Either narrow the claim to "prose split parity" or add the missing cross-axis fixture.

## What's Missing — Pre-Implementation Work Items

1. **Specify annotation read-failure semantics.** Add an Error Scenario #17 to design.md §Error Handling: `parseApprovalAnnotation` throw at retry → `warnOnce('multi-server:retry-annotation-parse-failure', approvalId, err.message)` → fall through to legacy-fallback `resolveRunnerModel`. Add an integration test that writes `{ "runnerOptions": "not-an-object" }` (or a bad-JSON string) into `approval.annotations` and asserts retry succeeds with re-resolved model + warn-once log.

2. **Specify annotation concurrent-write semantics.** Add a paragraph to §Components/multi-server.ts: state whether `stampAnnotationRunnerOptions` is read-modify-write atomic with respect to other annotation writers (decision-handler, retry handler). If atomicity is *not* guaranteed, document that two concurrent initial-reviews for the same approvalId is undefined behavior at v1, and either (a) reject the second request at route entry, or (b) accept silent last-write-wins as the contract.

3. **Wrap `safeRealpath(projectPath)` for ELOOP/EACCES/ENAMETOOLONG.** Either extend `safeRealpath` to swallow these + warn-once, or move the projectPath realpath inside a try/catch in `validateAllFiles`. Add a fixture test for ELOOP on projectPath.

4. **Tighten the entry-side `safeRealpath` ENOENT branch to drop, not keep.** design.md:265 — when `safeRealpath` returns undefined for a per-entry resolved path, drop the entry instead of falling back to original-path prefix check. Update the comment; add a test for "symlink whose target was deleted, target was outside projectPath."

5. **Add a 5th cross-axis fixture.** Pin `diff-rejected + typecheck-rejection` (and optionally `diff-rejected + timeout`). Update `EXPECTED_CROSS_AXIS_FIXTURE_COUNT` in lockstep with R4.10.

6. **Per-diagnostic message size cap.** After Pass 1, cap each diagnostic's `message` to 4 KB with a `<...truncated>` marker. Document in design.md §typecheck.ts behavior step 7. Pin a fixture with a 30-line type-expansion diagnostic asserting cap behavior.

7. **Tighten Pass 1 continuation rule for relative paths.** Add a fixture test that feeds tsc-style output containing indented relative paths and asserts the relative paths reach `coverage.compiled`, not the prior diagnostic's `message`.

8. **Pin annotation `runnerOptions.model === null` behavior.** Update design.md:355 check to `typeof model === 'string' && model !== ''`. Add a test for explicit-null annotation; assert legacy-fallback fires.

9. **Make `EXPECTED_R4_BLOCK_COUNT` a name-list, not an integer.** Replace `EXPECTED_R4_BLOCK_COUNT = 8` with `EXPECTED_R4_BLOCK_NAMES = ['R4.1','R4.2a','R4.2b','R4.4','R4.5','R4.6a','R4.6b','R4.7']`. Test asserts extracted block-name set equals the expected set; future renames or delimiter-change losses surface by name in the failure message.

10. **`.gitignore` deliverable for `.spec-workflow/.cache/`.** Recurring with escalating severity: v4 unconditionally creates the directory. Either add an installer hook OR add this directory to the user-facing README setup section as a manual step. Land in the same PR as Track A.

11. **Concurrent-prepare latency observability.** Surface a `data.typecheckWarning` field when tsc emits buildinfo-rebuild stderr noise; reference in R4.6b prose so the reviewer is told the cause when latency is degraded.

12. **Scope the SIGTERM grace claim.** Append "(POSIX; Windows behavior is `TerminateProcess`-immediate)" to design.md:171 and the matching requirements.md:103 location. Stops the v2 Out-of-Scope item from contradicting a v1 contract claim.

---

**Summary.** v4 has resolved every named v3 concern, but the new annotation-persistence surface and the per-element realpath wrapper carry novel failure modes that are at the same severity as the issues v3 flagged. Two structural reliability claims (design.md:9 "structural guarantee even across…" and design.md:55 "synchronous prelude cannot escape") are demonstrably overstated. The cross-axis test matrix grew a 4th diff-axis state (R4.2b) without growing its cross-axis pin set. The three highest-severity items (validateAllFiles projectPath realpath, annotation read-failure path, concurrent initial-review semantics) are each one-paragraph design fixes; none requires architectural change.
