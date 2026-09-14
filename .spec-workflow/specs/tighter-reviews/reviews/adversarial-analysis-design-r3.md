# Adversarial Analysis — `tighter-reviews/design.md` (round 3)

The v3 fixes substantively close most of v2's architectural objections. The remaining surface is in second-order consequences: lifecycle ambiguities introduced by closure capture, the new `unwrap*` rejection shape's interaction with R4 prose, sub-cases inside accepted helpers (`validateAllFiles`, the tsc parser), and observability gaps in the warn-once channel. Most findings below sit inside fixes the author has already accepted — that is precisely the territory the prompt asked to attack.

---

## 1. `validateAllFiles` is the new unprotected synchronous prelude

**Classification:** Novel (Compounding on v2 Risk 1, the `loadSettings` containment pattern).

**Where:** design.md:230, 244–251.

**Failure scenario.** `validateAllFiles` runs *before* `loadSettings` and *before* `Promise.allSettled`. Step 3 calls `path.resolve(projectPath, file)`. `path.resolve` on Node throws synchronously on:

- A path containing a NUL byte (`"foo\0bar.ts"` → `TypeError: Path must be a string without null bytes`).
- Non-string elements that survive step 2's drop (e.g. `Symbol`-coerced values, BigInt — step 2's "drop non-string" wording leaves coercion semantics unspecified).
- Strings exceeding `PATH_MAX` after resolution on POSIX, or that cross Windows path-length limits when `projectPath` is itself long.

A malformed implementation log (which is exactly the input contract `validateAllFiles` is meant to defend against) can cause `handlePrepare` to throw out of the synchronous prelude — the same architectural defect v2 closed for `loadSettings`. The design wraps `loadSettings` in a try/catch but the new `validateAllFiles` helper is described in 6 prose steps with no try/catch contract.

**Why this is more than theoretical:** the design at line 230 places `validateAllFiles` *outside* the `Promise.allSettled` shell. Even an exception inside `validateAllFiles` propagates out of `handlePrepare`, destroying the "never fails the prepare" reliability claim the design otherwise upholds.

**Concrete fix.** Either (a) wrap each per-element step (3 + 4) in try/catch and bucket throw cases into the warn-once "dropped invalid entry" log, or (b) move `validateAllFiles` *inside* an outer try/catch that defaults the result to `[]` and warns. Option (a) is preferable because it preserves valid entries when one is malformed. Add a test: `validateAllFiles(['ok.ts', 'bad\0.ts'], projectPath)` returns `['ok.ts']` plus warn.

---

## 2. R4.2 silently misrepresents diff-utility rejection

**Classification:** Novel.

**Where:** design.md:257 (`unwrapDiff` rejection produces `{ diff: '', ... }`), requirements.md:154 (R4.2 prose).

**Failure scenario.** When `computeTaskDiff` rejects (the never-throws contract is violated), `unwrapDiff` returns `{ diff: '', stats: undefined, skippedPaths: [], truncated: false, rejection: { message } }`. `buildReviewMethodology` is called with `diffState: 'empty'` (the `rejection` field doesn't change the diff state — see design.md:288 `diffState: 'present' | 'present-truncated' | 'empty'`, no `'rejected'` variant). R4.2's diff-empty directive fires verbatim:

> Either the task changes were already committed before review, the implementation log is out of sync with the working tree, or this is not a git repository.

The reviewer is told one of three innocuous causes. None of them is "the diff utility crashed." The structurally-distinct `rejection: { message }` field on the response data is *only* visible if the methodology directive surfaces it — it doesn't, because R4.2 prose isn't conditional on the rejection field.

**Compare and contrast the typecheck side.** R4.6b explicitly enumerates `'rejection'` as one of the unavailable reasons it covers (requirements.md:176). The user-visible directive *does* tell the reviewer `data.typecheckResults[0].reason` says why and `'rejection'` is one of the listed reasons. The diff side has the field but no prose.

**Concrete fix.** Either (a) add a fourth `diffState: 'rejected'` variant with a new R4.2-rejection directive ("Diff utility rejected unexpectedly: <message>; treat as if no diff is available and read full files; surface the rejection in the review summary"), or (b) extend R4.2's prose to mention "or the diff utility rejected (see `data.diff.rejection.message` if present)." Option (a) is the design-consistent choice given the typecheck precedent.

---

## 3. Closure-capture lifecycle is asserted but not pinned to a single construction site

**Classification:** Novel (Compounding on v2 missing #7 / R3.9 acceptance).

**Where:** design.md:45 (four callsites), 309–319 (closure capture description).

**Failure scenario.** The integration-points block enumerates **four** callsites:

> lines 780–791 (adversarial initial), 948–959 (adversarial retry), 1730–1742 (task-review initial), 1774–1786 (task-review retry). All four sites use `resolveRunnerModel(settings, runner)`.

Then design.md:319 claims:

> The retry paths use the **closure-captured** model from runner construction, not a fresh resolve.

These two statements are in tension. If all four callsites call `resolveRunnerModel`, the retry sites resolve afresh — the closure capture is ceremonial. If only two callsites (the initial ones) call `resolveRunnerModel` and the retries reference a captured value, the sentence "all four sites use `resolveRunnerModel`" is wrong.

The design example at lines 313–316 shows a pattern (`const adversarialModel = resolveRunnerModel(...)` then both initial and retry use the same `adversarialRunOpts` constant), but this is illustrative — it does not pin *where* in `multi-server.ts` the construction happens, nor does it forbid future edits that re-resolve at retry time.

**Why this matters.** R3.9 is a structural guarantee per the design's own framing. A structural guarantee survives refactoring; a coding-convention guarantee does not. The design needs to say: there is exactly **one** `resolveRunnerModel` call per (review-session, runner), and the retry callsite references the same options object — not "use the closure-captured model" as a phrase the implementer must remember.

**Concrete fix.** Add to the design: "The closure-capture is enforced by having `runner.run(...)` accept the resolved options as an argument *only at construction*. Subsequent retry calls reference the same `RunnerOptions` object via closure capture; there is no path in `multi-server.ts` where retry constructs a new `RunnerOptions`. A test asserts that the retry call uses the same model as the initial call when the cache is invalidated mid-review (the existing R3.9 test) AND that `resolveRunnerModel` is invoked exactly twice per review (once per runner), not four times."

---

## 4. `unwrap*` warn-once key collapses heterogeneous rejection causes

**Classification:** Novel.

**Where:** design.md:260 ("log once per process via the same warn-once mechanism as `loadSettings`").

**Failure scenario.** The `loadSettings` warn-once flag is keyed on `(absPath, mtime, size)` (design.md:209). It clears when the tuple advances. For `unwrap*` rejections, there is no `(absPath, mtime, size)` tuple — the rejection comes from a utility's internal throw with arbitrary cause. The design says "the same warn-once mechanism" but doesn't specify the key.

The likely implementation reading is "per-utility, per-process" — i.e., `diffRejectionWarned: boolean`, `typecheckRejectionWarned: boolean`, `hygieneRejectionWarned: boolean`. Once any rejection of a given utility logs, all subsequent rejections of that utility *with different error causes* are silently swallowed in the same process.

**Why this matters in practice.** MCP servers run as long-lived daemons. Over a multi-day session:

- First diff rejection: `EMFILE` (process FD limit hit) → logged.
- Second diff rejection (5 min later): `ENOMEM` from execFile spawn → silently swallowed.
- Third diff rejection (2 hr later): real bug in the diff utility's path partitioning → silently swallowed.

The user sees "diff didn't work" and one stale warning from hours earlier. The third (real) bug never reaches them.

**Concrete fix.** Key the `unwrap*` warn-once on `(utility, error.message)` or `(utility, error.code)` — heterogeneous causes get distinct logs. Or, if 3-deep nesting of warn-once keys is overkill, drop warn-once for utility rejections entirely and log every one — utility rejections should be rare enough that the noise budget can absorb them, unlike `loadSettings` where a single broken JSON file is read on every prepare.

---

## 5. tsc multi-line diagnostic continuation is silently dropped

**Classification:** Novel.

**Where:** design.md:172–173 (two-pass parser).

**Failure scenario.** Pass 1's regex `^(.+?)\((\d+),(\d+)\): error TS(\d+): (.+)$` captures only single-line diagnostics. tsc emits multi-line diagnostics for some error families:

- TS2345 with full type expansion (commonly 4–10 lines for nested generics).
- TS2741 missing-property errors with the type difference enumerated.
- TS2322 not-assignable errors where the source/target types are large.

Example tsc output (real):

```
src/foo.ts(42,15): error TS2345: Argument of type '{ a: number; b: string; }' is not assignable to parameter of type 'never'.
  Object literal may only specify known properties, and 'a' does not exist in type 'never'.
```

Pass 1 captures line 1: message field becomes `Argument of type '...' is not assignable to parameter of type 'never'.`. Pass 2 then sees the continuation line (`  Object literal may only specify known properties...`) — it's not absolute-path-shaped, so it's discarded.

The reviewer sees the truncated head. For a complex generic mismatch, the head is the *least* informative part — the expansion lines are where the actual bug is.

**Why two prior rounds missed this.** The two-pass parser was added in v1 to defend against absolute-path-in-error-message false positives in the listFiles set. That defense works. The collateral damage to multi-line message text was never the focus.

**Concrete fix.** Pass 1's loop should consume continuation lines (lines that start with whitespace AND are not absolute-path-shaped) into the preceding diagnostic's `message` field, joining with `\n`. Pass 2 sees only lines that are neither diagnostics nor continuations. Add a fixture: a tsc invocation that produces a TS2345 with multi-line expansion; assert the parsed diagnostic's `message` contains both the head and the expansion.

---

## 6. Empty-extraction guard fails closed only at zero, not on partial loss

**Classification:** Novel.

**Where:** design.md:435 / requirements.md:220 (Two-way drift test, empty-extraction guard).

**Failure scenario.** The guard fires only if either side extracts **zero** blocks. If R4 has 7 directives and the extractor returns 5 (because two were edited into a code-block style the regex doesn't recognize, or wrapped into a longer paragraph that spans block-quote → prose → block-quote and the joiner fails), both sides extract non-zero counts. The guard passes. The two missed blocks are silently absent from Direction A coverage. Drift between R4 and fixtures in those two blocks is undetectable.

This is a real concern because R4.x prose is the kind of thing future authors edit casually (typo fix, wording refinement) without considering the extractor's delimiter expectations.

**Concrete fix.** Encode the *expected count* of R4 blocks (currently 7: R4.1, R4.2, R4.4, R4.5, R4.6a, R4.6b, R4.7) as a constant in the test. Guard fails if the extractor returns ≠ 7. Update the constant when adding/removing R4.x blocks in the same PR — same lockstep discipline as the typecheckResults[0] coupling acknowledgment. This converts "delimiter format change" into a hard test failure rather than a silent coverage gap.

---

## 7. Direction B substring-derivability is too tight to absorb innocent edits

**Classification:** Novel (extending memory's noted concern about brittleness).

**Where:** requirements.md:218 / design.md:434.

**Failure scenario.** Direction B requires every fixture sentence to be a contiguous substring of an R4.x block (after normalization). The following innocent edits all fail the test:

- A fixture author splits R4.4's long sentence at a comma instead of period: `"Focus on entries with inScope: true. These touch files this task modified..."` — original was `"Focus on entries with inScope: true — these touch files this task modified..."`. Em-dash → hyphen normalization handles `—` → `-` but not the `. ` reflow.
- A fixture line-wraps a long sentence at 80 cols (introducing a `\n` mid-sentence). After `.trimEnd()` per line and joining, the resulting string has `\n` where R4 has space.
- A fixture abbreviates `data.typecheckResults[0]` to `typecheckResults[0]` for terseness in a constrained-width context.

In each case the *intent* matches R4 perfectly, but the substring check fails. The author then has two options: (a) revert the fixture to verbatim R4, making the fixture redundant with R4 except for compositional assembly, or (b) update R4 to match the fixture, treating the fixture as authoritative — which contradicts R4.10's explicit "R4 is authoritative."

**Why memory's hint is escalated to novel concern.** Memory framed this as "fragile to delimiter changes; protected by the empty-extraction guard." The empty-extraction guard does not protect Direction B at all (it only protects against extractor returning zero). Direction B's brittleness is a maintenance burden that future authors will hit, and the fallback (paraphrase rather than verbatim) breaks the test.

**Concrete fix.** Soften Direction B from "substring of R4.x block" to "every multi-token n-gram (n=4) of the fixture sentence appears in some R4.x block." This catches genuine fixture-only growth (whole new sentences) while tolerating reflow and minor abbreviation. Alternatively, normalize whitespace runs to single spaces on both sides before substring check — that absorbs line-wrap differences without softening detection of new content.

---

## 8. `partitionPaths` cross-platform path-separator handling is unspecified

**Classification:** Recurring (memory raised this; unresolved in v3).

**Where:** design.md:101 ("path-segment match").

**Failure scenario.** A repo developed cross-platform: an agent on Linux records `secrets/foo.json` in the implementation log (forward slash). User runs prepare on Windows. `path.resolve('C:/proj', 'secrets/foo.json')` returns `C:\proj\secrets\foo.json` (backslash). `partitionPaths` then needs to detect `secrets` as a path segment.

The design says "path-segment match" but doesn't pin whether segments are split by `path.sep`, by `/`, or by both. If the implementation splits on `path.sep` only, on Linux a Windows-style path `secrets\foo.json` (recorded by an agent on Windows, reviewed on Linux) is treated as a single basename `secrets\foo.json` — the `secrets` path segment match never fires. The denylist silently misses secret-bearing paths in the cross-platform case.

**This is a security-adjacent bug.** The denylist exists for a reason; bypass conditions matter.

**Concrete fix.** Specify in `partitionPaths`: "path segments are derived by splitting the input on both `/` and `\` characters, regardless of platform." Add tests with mixed separators: `partitionPaths(['/proj/secrets\\foo.json'])` on Linux skips. `partitionPaths(['C:/proj/secrets/foo.json'])` on Windows skips.

---

## 9. Closure-capture vs runner re-construction in long-running daemons

**Classification:** Novel.

**Where:** design.md:309–319.

**Failure scenario.** The closure capture protects against cache invalidation between *initial* and *retry* of a single review. It does not protect against the user editing settings and triggering a *new* review. That's correct — new review, new resolution, expected.

But: if `multi-server.ts` reuses runners across multiple reviews (a long-running daemon serving repeated `review-task` calls), the runner's closure-captured model could be **stale across reviews**. The user's setting edit is reflected in `loadSettings` cache invalidation, but the runner's closure has the old value.

The design doesn't say "runners are constructed per-review" or "runners are constructed per-session." It says "runners capture the resolved model at construction" (line 9, line 319). If construction is once per server start, the closure traps the boot-time model permanently — settings edits never apply until restart.

**Concrete fix.** Either pin "runners are constructed per-review (per `review-task action: prepare` invocation)" explicitly, or add a `runner.refreshOptions()` path that re-resolves between reviews but not between initial+retry within the same review. The current design protects retry consistency at the cost of leaving inter-review staleness undefined.

---

## 10. R4.4 "run tsc yourself" is undeliverable to a sandboxed reviewer

**Classification:** Novel.

**Where:** requirements.md:160 (R4.4 prose: "If the result is `truncated: true`, run `tsc --noEmit` yourself to see the full list").

**Failure scenario.** The reviewer is an LLM in a constrained agentic context. Some review configurations (e.g. claude-haiku without code execution permissions, or any reviewer with `Bash` permissions denied) cannot invoke `tsc`. The directive degrades silently to a no-op the user doesn't see.

The methodology has no capability check. If the reviewer cannot run shell commands, "run tsc yourself" is dead text that the reviewer reads and (most likely) skips, leaving the truncated list unaddressed.

**Concrete fix.** Either (a) raise the cap to a value where truncation is rare in practice (current cap is 100; raising to 500 with `truncated: true` only when truly unbounded would be more pragmatic), or (b) reword R4.4 to "If `truncated: true`, request a follow-up review on the omitted files" — a reviewer-capability-agnostic fallback that places the burden on the human reviewer to do the additional run.

---

## 11. Track-A interim sentinel marker is too generic

**Classification:** Recurring (memory explicitly raised this; not addressed in v3).

**Where:** design.md:436 / requirements.md:222 (`# INTERIM:` regression test).

**Failure scenario.** The marker `# INTERIM:` is a YAML/Python comment fragment. A future fixture file that legitimately contains a code-comment example mentioning `# INTERIM:` (e.g., a fixture testing an interim methodology pre-spec) trips the test as a false positive. The collision risk is low but real, and the test is now a tripwire that future authors will misdiagnose as a sentinel violation rather than a marker collision.

**Concrete fix.** Use a more distinctive token: `# SPEC-WORKFLOW:TRACK-A:INTERIM-PIN` or similar. The longer string is unlikely to appear in any other context.

---

## 12. Symlinked workspace + `validateAllFiles` semantics

**Classification:** Novel.

**Where:** design.md:248–249 (`validateAllFiles` step 4), 175 (R2.4 normalization).

**Failure scenario.** A pnpm workspace has `<projectPath>/packages/foo/src/index.ts` as a symlink to `<projectPath>/../external/lib.ts`. The literal path `<projectPath>/packages/foo/src/index.ts` resolves *inside* `projectPath` per `path.resolve`, so `validateAllFiles` keeps it. Downstream:

- `git diff --` invoked with the symlink path: git follows the symlink and diffs the *target*. The target is outside `projectPath`. The diff is real but the file is not under the project's review scope.
- `tsc --listFiles`: tsc emits the realpath'd target. After R2.4 normalization, the path is outside `allFiles` (which contains the symlink path, not the target). The file lands in `coverage.excluded` even though tsc actually compiled it.

The composite signal: the diff shows changes in file X; the typecheck reports file X was *not* compiled. The reviewer is told "manually scan X" (R4.5) when in fact tsc did check it — just under a different path.

**Concrete fix.** Either (a) make `validateAllFiles` realpath inputs and compare against `realpath(projectPath)` for the inside-or-outside check, or (b) document in R4.5 that "excluded" can include symlinked-realpath cases and the reviewer should cross-reference `compiled` for paths matching by realpath. Option (a) is structurally cleaner.

---

## Closing Deliverables

### Top 5 Risks (ranked by severity)

1. **`validateAllFiles` is unprotected against `path.resolve` synchronous throws** (Novel/Compounding on v2 Risk 1). NUL-byte path or non-string-coerced input from a malformed implementation log throws out of `handlePrepare`, breaking the never-fail prepare contract. **Fix:** wrap `path.resolve` per element in try/catch; bucket throws into the warn-once "dropped invalid entry" log.

2. **R4.2 diff-empty directive misrepresents diff-utility rejection** (Novel). When `unwrapDiff` returns `{ diff: '', rejection: { message } }`, R4.2 fires unchanged and tells the reviewer "no changes / not a repo / out-of-sync log." The actual cause (utility crashed) is invisible. **Fix:** add a `diffState: 'rejected'` variant with a rejection-distinguishing directive, mirroring R4.6b's treatment of typecheck `'rejection'` reason.

3. **Closure-capture lifecycle is unspecified across the four callsites** (Novel/Compounding on R3.9). Design.md:45 enumerates four callsites that "use `resolveRunnerModel`" while design.md:319 claims retries use "closure-captured model from runner construction" — these are in tension. The structural guarantee is only structural if there's exactly one resolve per (review, runner). **Fix:** pin in design that `resolveRunnerModel` is invoked twice per review (once per runner), retries reference the same `RunnerOptions` object via closure; add a test asserting `resolveRunnerModel` call count.

4. **`unwrap*` warn-once key collapses heterogeneous rejection causes** (Novel). Long-running daemons surface only the first rejection per utility; subsequent rejections with different errors are silently swallowed. The "same warn-once mechanism as `loadSettings`" is a copy-paste of an inappropriate key shape. **Fix:** key on `(utility, error.message)` or drop warn-once for `unwrap*` rejections entirely (rare events; noise budget absorbs them).

5. **tsc multi-line diagnostic continuation lines silently dropped** (Novel). Pass 2's path-shape filter discards type-expansion continuation lines for TS2345/TS2322/TS2741. The reviewer reads only the truncated head — the least informative part of complex generic errors. **Fix:** Pass 1 consumes continuation lines (whitespace-prefixed, not absolute-path-shaped) into the preceding diagnostic's `message`, joined with `\n`.

### Top 3 Conclusions to Challenge or Reverse

1. **Design.md:260 — "log once per process via the same warn-once mechanism as `loadSettings`."** Reverse: the `loadSettings` warn-once mechanism is keyed on `(absPath, mtime, size)`, which has no analogue for utility rejections. Replace with: "Logged on every distinct `(utility, error.message)` tuple per process; deduped only when the same utility throws the same message repeatedly."

2. **Design.md:319 — "the captured model still applies."** Reverse the implicit "construction is implicit and works correctly" framing. Replace with: "There is exactly one `resolveRunnerModel` invocation per (review, runner). Both initial and retry callsites reference the resolved value via the same `RunnerOptions` object. A test asserts call count is 2 per review (1 per runner), not 4."

3. **Requirements.md:218 / design.md:434 — "every directive sentence in any fixture must be derivable from at least one R4.x block. 'Derivable' = the sentence appears as a substring of an R4.x block."** Reverse the substring contract — it forces verbatim copy and breaks under innocent reflow. Replace with: "Every contiguous 4-token n-gram of every fixture sentence appears in some R4.x block, after whitespace-collapse and NFC+dash+quote normalization." This catches genuine fixture-only growth without flagging line-wrap or comma/period reflow.

### What's Missing (concrete pre-implementation work items)

- **Try/catch contract for `validateAllFiles`** (Risk 1). Each per-element step (resolve, inside-projectPath check) needs to be exception-tolerant; a single bad entry shouldn't kill prepare.
- **Diff-rejection methodology directive** (Risk 2). Add a `diffState: 'rejected'` variant in `TypecheckMethodologyState`'s peer enum, with a rejection-distinguishing R4.2-rejection directive in requirements.md.
- **Single-resolution pin for closure capture** (Risk 3). Document in design that `resolveRunnerModel` is called once per (review, runner); add a test that asserts the count.
- **`unwrap*` warn-once key spec** (Risk 4). Pin the key as `(utility, error.message)` or drop dedup entirely for rejections.
- **tsc multi-line continuation handling in Pass 1** (Risk 5). Add a fixture: real TS2345 multi-line output; assert parsed `message` includes both head and expansion lines.
- **`partitionPaths` separator-handling spec** (Finding 8). Specify segments split on both `/` and `\`; test with mixed-separator paths cross-platform.
- **Empty-extraction guard with expected-count constant** (Finding 6). Encode `EXPECTED_R4_BLOCK_COUNT = 7` in the drift test; guard fails on inequality, forcing lockstep edits.
- **Symlinked workspace handling in `validateAllFiles`** (Finding 12). Either realpath inputs and compare to realpath(projectPath), or document that symlinked-realpath cases can produce coverage-excluded false positives.
- **R4.4 "run tsc yourself" reword for capability-constrained reviewers** (Finding 10). Either raise the cap or reword the directive to a reviewer-capability-agnostic fallback.
- **Track-A interim marker upgrade to a distinctive token** (Finding 11). `# SPEC-WORKFLOW:TRACK-A:INTERIM-PIN` or similar.

The unresolved memory items (`.gitignore` for `.spec-workflow/.cache/`, suffix/prefix semantic ambiguity contract, two-warning-per-file-edit malformed-warn) are not escalated here — they remain as carried-forward at unchanged severity.
