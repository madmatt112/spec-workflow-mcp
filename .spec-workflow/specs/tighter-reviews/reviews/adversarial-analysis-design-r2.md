# Adversarial Analysis (round 2) — `tighter-reviews/design.md`

Reviewing design v2 against `adversarial-memory-design.md`. Findings classified **Novel** / **Compounding** / **Recurring**, with severity escalated where v1 issues were not actually fixed.

The v2 design accepted the bulk of v1's findings well — the `Promise.allSettled` shell, the two-pass tsc parser, the platform-conditional case-folding split, the chunked async `realpath`, and the disambiguated truncation messaging are all genuine improvements and correctly resolved. **Those are not re-derived here.** What follows is what the v2 fixes broke, weakened, papered over, or never fixed in the first place.

---

## Top 5 Risks/Gaps

### Risk 1 — `loadSettings` is in the synchronous prelude and is *outside* the `Promise.allSettled` safety net (Recurring, escalated)

**Severity: Critical.** The whole point of v2's orchestrator-boundary contract is "every utility's rejection is converted to a degraded state — `handlePrepare` never throws." But the design (line 219–226) puts the call:

```ts
const settings = loadSettings(projectPath);          // synchronous, no try/catch
const settled = await Promise.allSettled([ ... ]);
```

`loadSettings` does `statSync` + `readFileSync` — both can throw `EBUSY`, `EACCES`, `EISDIR`, `ELOOP`. None of these are JSON-parse failures, so the documented "malformed → return `{}` and warn" path does not catch them. A throw here kills `handlePrepare` *before* `Promise.allSettled` runs, defeating the entire safety-net design.

This is **v1 §1d, escalated**. v1 flagged it; v2 listed it as "Unresolved" in `adversarial-memory-design.md` but then *moved settings loading into the prelude*, making the unresolved bug structurally worse. The v2 architecture diagram (line 53–73) shows `Promise.allSettled` catching utility failures — but the very next prose says "Pre-work (settings load…) add linearly on top of that bound" without acknowledging it's also outside the safety net.

**Failure scenario:** User on Windows saves `.spec-workflow/adversarial-settings.json` from VS Code mid-prepare. The atomic-rename window exposes `EBUSY`. `loadSettings` throws. `handlePrepare` rejects with an uncaught exception. The MCP response is whatever the harness does with rejected promises — at best a generic error, at worst no response at all. The "never throws" contract is a lie under realistic editor activity.

**Why escalating to Critical:** v1 noted this as a corner case. v2 made architectural decisions (the synchronous-prelude pattern) that depend on the corner case not happening.

---

### Risk 2 — `unwrap*` rejection-to-degradation mapping collapses every typecheck failure to `'no-parseable-output'` (Novel/Compounding)

**Severity: High.** Design line 228 specifies:

```
unwrapTypecheck(settled[1]);     // rejection → [{ status: 'unavailable', reason: 'no-parseable-output' }]
```

`runProjectTypecheck` is a 13-step pipeline (interface lines 156–177): tsconfig probe, child spawn, two-pass parser, async realpath chunked across 100s of files, denylist filter, diagnostic tagging, cap-and-truncate. A rejection can come from any of those steps. They all become `'no-parseable-output'` — which already has a real meaning (clean exit + zero listFiles, or non-zero exit + zero diagnostics, per R2.9).

Operator looking at the dashboard cannot distinguish:
- tsc actually emitted unparseable output (the legitimate use), vs
- the `path-denylist` module threw (refactor regression), vs
- `fs.promises.realpath` rejected outside the per-path try/catch (e.g., the chunking helper itself), vs
- a TypeError in the diagnostic tagger from a malformed regex match group.

The v2 `unwrap*` design is meant to convert thrown contracts to degradation states, but reusing an existing reason-code overloads it. **The "warn-once log of the rejection reason" is the only diagnostic signal** — and design line 231 says it shares the `loadSettings` warn-once mechanism (see Risk 5).

**Specific fix needed:** introduce a distinct `reason: 'rejection'` (or `'unexpected'`) sub-reason that means "the utility's never-throws contract was violated." Capture the error message text in a debug field if any — `'no-parseable-output'` should be reserved for what R2.9 says it means.

**Compounding** because v1 §1b accepted `Promise.allSettled` as the fix; v2's specific implementation of the conversion mapping introduces a new failure-mode-conflation problem v1 didn't anticipate.

---

### Risk 3 — `.spec-workflow/.cache/` directory creation and `.gitignore` are unspecified (Novel)

**Severity: High; certainty: 1.0 it bites the first user.** Design line 161 specifies `--tsBuildInfoFile <projectPath>/.spec-workflow/.cache/tsc.tsbuildinfo`. **Nothing in the design creates that directory.** tsc errors out if the directory doesn't exist (it writes the buildinfo file, not its parent). Behavior on first-run after spec-workflow setup:

1. `runProjectTypecheck` spawns tsc.
2. tsc tries to write `.spec-workflow/.cache/tsc.tsbuildinfo`.
3. Parent dir doesn't exist → tsc fails or emits a diagnostic to stderr.
4. Either no buildinfo gets written (subsequent runs are full rebuilds — performance degradation, silent), or tsc exits non-zero and the user sees `'no-parseable-output'`.

Compounding sub-issue: the design doesn't specify `.gitignore` for `.spec-workflow/.cache/`. If a user commits the buildinfo file (`git add .spec-workflow/`), the file lands in the repo with absolute paths in it. On a different machine, tsc encounters absolute paths it can't resolve and silently does a full rebuild (best case) or errors out (worst case).

**Specific fixes needed:**
1. `runProjectTypecheck` does `await fs.promises.mkdir(cacheDir, { recursive: true })` before spawn.
2. The README deliverable (R3.11) gains a section: "Add `.spec-workflow/.cache/` to your `.gitignore`." Or, better, the prepare flow auto-appends the entry if missing (with a comment header so it's obvious who wrote it).

**Concurrent-prepare corruption is the deeper version of this:** two MCP server instances against the same project both write to the same `tsc.tsbuildinfo`. tsc assumes exclusive access. There's no advisory lock specified. At minimum the design must state "concurrent prepare invocations against the same project corrupt the buildinfo and are unsupported." Ideally a flock-style mutex on the cache file.

---

### Risk 4 — `data.typecheckResults[0]` is hardcoded into the methodology directive prose (Novel/Compounding)

**Severity: High at the v2-multi-config moment; medium today.** Design line 318 claims the `TypecheckResult[]` shape is forward-compatible:

> Length is always 1 in v1; future multi-config support adds entries without a schema break.

The schema is forward-compatible. The **methodology prose is not.** R4.4 (requirements.md:157), R4.5 (:163), R4.6 (:167), R4.7 (:171) all literally embed `data.typecheckResults[0]` in the verbatim directive that the LLM reads. When v2 ships multi-config and `typecheckResults.length === N`, the directives still tell the reviewer to look at index 0 only. The reviewer trusts the directive verbatim — it's the *contract* between this MCP and the LLM. The v1-frozen prose silently ignores N-1 of the configs.

The drift test does not catch this. The drift test asserts substring presence of R4.x blocks in fixtures — it does not validate that `[0]` is still semantically correct.

This is a **forward-compat-claim-that-doesn't-survive-scrutiny**, which the prompt explicitly invites. The schema is forward-compat. The methodology prose, the consumer of the schema, is not.

**Specific fix needed:** either pin "v1 ships single-config-only and the multi-config feature flag is a v3 with a coordinated R4 prose update" as an explicit non-goal in the design, OR change R4.4–R4.7 prose to refer to "each entry in `data.typecheckResults`" so the prose is iteration-shaped today and survives N>1 tomorrow without a directive rewrite.

---

### Risk 5 — Drift test is one-way and "fixtures are right" is still in the spec (Recurring, not actually fixed)

**Severity: High.** v2 added the ~20-line drift test. Memory marks it Accepted. But the *original* problem in v1 §6c was that R4.10 says "the fixtures are right" — i.e., the contract authority is inverted. v2 added a substring-presence test that catches one direction (R4 → fixtures) and ignored the other direction.

Failure modes the v2 fix doesn't catch:

1. **Fixture-only prose**: a fixture grows a sentence not in any R4 block. Substring test passes (R4 is still substring-present), but the LLM is now reading authoritative directives that were never reviewed in the spec.
2. **Block-quote delimiter brittle**: a future R4.5 reformat from `> ` block-quote to fenced code block produces zero extracted blocks. Test passes vacuously. **Compounding** with R4.5 specifically because R4.5's prose contains backticks and arrays — exactly the prose most likely to be reformatted.
3. **Directive deletion**: R4.7 removed from R4 by a future spec edit; fixture still renders the timeout directive. Test passes (no R4.7 block to assert). The fixture is now unauthorized prose — **undetected**.
4. **Whitespace/encoding**: a fixture that uses smart quotes from a copy-paste, em-dash vs hyphen, or trailing-whitespace differences breaks substring match. The current test does not specify whitespace normalization. Either the test is brittle (innocent edits break it) or it's permissive (drifts pass).

`adversarial-memory-design.md` correctly classifies this in "Unresolved." It should be classified there with severity escalated, not as Accepted.

**Specific fix needed:** the drift test must be two-way (extract from fixtures and assert in R4, extract from R4 and assert in fixtures), with whitespace/Unicode normalization documented; AND the R4.10 "fixtures are right" sentence must be reversed to "if R4 prose drifts from the fixtures, R4 is right — update fixtures, not requirements."

---

## Top 3 Conclusions to Challenge/Reverse

### Conclusion 1 — Reverse: "`Promise.allSettled` enforces the never-throws contract at the orchestrator boundary"

This is currently positioned (design line 51, Architecture; line 409, NFR Reliability) as a structural guarantee. **It isn't.** `loadSettings(projectPath)` runs synchronously *before* the `Promise.allSettled` and is not wrapped in `try/catch`. An EBUSY/EACCES/EISDIR throw from `readFileSync` exits `handlePrepare` with an unhandled exception. The contract is enforced for three utilities; the prelude is unprotected. Either move `loadSettings` inside the `allSettled` call (turn it into an async utility with its own degradation state), or wrap the prelude in a top-level try/catch that converts read-throws to `{}` + warn. The current design implies coverage it doesn't have.

### Conclusion 2 — Challenge: the choice of *two specific* cross-axis fixtures

Design line 385 specifies `partial-coverage + diff-empty` and `timeout + diff-truncated`. The justification is "these catch directive redundancy/contradiction." But why these two and not, e.g., `unavailable + diff-truncated` (where R4.6's "manually scan modified TypeScript files" composes against the truncated-diff "read full file for truncated paths" directive — the user is told both to manually scan AND to read full files, with overlapping but non-identical instructions)? Or `success-with-diagnostics + diff-empty` (where R4.4's "open the diagnostic file" composes against "diff was empty so read every file" — does the reviewer prioritize diagnostic files or all files)?

The selection is arbitrary. The design hand-waves with "these two pairs the most degraded states." But less-degraded states have *subtler* redundancy issues that maximally-degraded fixtures don't surface, because the prose for highly-degraded states is already long and verbose enough that one more directive doesn't structurally collide. **The choice should be defended on what redundancy each pair surfaces, not on degradation severity.** Or expand to 4 fixtures covering the underspecified pairs.

### Conclusion 3 — Reverse: forward-compat for `cliArgs` extension

Design line 124 (Code Reuse, R3.6 forward-compat note) claims `adversarial: { model } → adversarial: { model, cliArgs, cli }` extension is forward-compatible via the same precedence ladder. But `cliArgs` is `string[]`, not `string`. The current ladder treats empty-string as "fall back to legacy." `cliArgs: []` is then ambiguous: is it "explicitly clear, use no CLI args" or "absent, fall back to legacy `settings.cliArgs`"? The design doesn't pin which. This isn't an academic concern: `cliArgs: []` is exactly what a user would write to disable inherited CLI args from legacy. If it's treated as absent, the user's explicit intent is silently ignored. Either pin "empty array means absent" with a warn (consistent with empty-string), or pin "empty array means explicit clear" (different from string; document the asymmetry). The forward-compat claim is unfounded until this is decided.

---

## What's Missing — Concrete Pre-Implementation Work Items

1. **`loadSettings` read-throw handling.** Wrap `statSync`/`readFileSync` in `try/catch` for `EBUSY`/`EACCES`/`EISDIR`/`ELOOP`. Return `{}` + warn-once, same as malformed JSON. Or move the call inside `Promise.allSettled`. Without this, Risk 1 is unmitigated.

2. **`unwrap*` distinct rejection sub-reason.** Add `reason: 'rejection'` (or similar) to the typecheck `unavailable` union. Don't collapse to `'no-parseable-output'`. Capture the error.message text for the warn-once log. Apply analogous changes to `unwrapDiff` (currently emits empty diff with no signal that a rejection occurred) and `unwrapHygiene` (currently emits `[]` indistinguishable from a clean repo).

3. **`unwrap*` rejection-path tests for all three utilities.** Design line 382 specifies a test for `runProjectTypecheck` rejection only. Add equivalents for `computeTaskDiff` and `computeHygieneSignals`. Otherwise two-thirds of the safety net is untested.

4. **`runProjectTypecheck` creates `.spec-workflow/.cache/`.** `await fs.promises.mkdir(cacheDir, { recursive: true })` before tsc spawn. First-run typecheck-success test is currently architecturally impossible without this.

5. **`.gitignore` for `.spec-workflow/.cache/`.** Either documented in README (R3.11 deliverable) or auto-appended on first prepare.

6. **Concurrent-prepare buildinfo isolation.** Either an advisory file lock on `tsc.tsbuildinfo`, or an explicit "unsupported, corrupts cache" note in the design and a debug-log warning on detected concurrent invocation. Currently silent corruption.

7. **R3.9 retry consistency: capture the resolved model into a closure at runner construction.** Don't rely on the cache to give the same answer twice. `loadSettings` cache is `(mtime, size)`-keyed and invalidates under user edit; R3.9's promise that retry uses the same model is broken under that scenario today.

8. **R4.6 prose branch on `reason: 'feature-disabled'`.** The user opted out of typecheck. Telling them "manually scan the modified TypeScript files" contradicts their explicit preference. Different prose for `feature-disabled` vs the other unavailable reasons.

9. **`allFiles` element validation at `handlePrepare` boundary.** Pin behavior for: non-string elements, relative paths, paths outside `projectPath`, empty array, duplicates. Currently these are implicit/undefined and `path.resolve`/`partitionPaths` may throw on the first three.

10. **`features.typecheck: 0` (and other non-boolean-but-truthy/falsy values) warn when ignored.** Design says "anything else → `true`." A user who wrote `0` thinking they disabled typecheck gets no signal. Match the asymmetry note in `resolveRunnerModel` for `settings[runner].model` non-string values — neither is documented to warn.

11. **Settings malformed-warn message text.** Specify what the warning says. If it surfaces the parser error, BOM/trailing-comma users get a signal. If it just says "malformed," they don't.

12. **CI check that Track-A interim fixtures are deleted in Track B's PR.** Design relies on Track B's PR deleting them. No mechanical assertion. Add a test asserting no fixture file contains the `# INTERIM:` header marker after Track B merges. (The marker is the natural anchor.)

13. **Drift test: two-way, with whitespace normalization.** Extract R4 blocks from requirements AND directive-block content from each fixture; assert subset relationship in *both* directions. Normalize whitespace and Unicode (NFC, em-dash → hyphen, smart quotes → straight). Otherwise the test is either vacuous on innocent reformats or brittle on whitespace.

14. **R4.10's "fixtures are right" reversed to "requirements is authoritative."** With the drift test in place and bidirectional, the authority inversion is no longer needed as a fallback. Currently the spec text and the test still disagree about which side is canonical.

15. **Stale buildinfo detection.** Document recovery path: tsc parse errors from version-mismatched buildinfo should surface as a distinct reason (`'stale-buildinfo'`) so the user can `rm .spec-workflow/.cache/tsc.tsbuildinfo`. Otherwise `'no-parseable-output'` becomes a catch-all that masks several distinct failure modes.

16. **`resolveRunnerModel` warn for non-string `settings[runner].model` values.** R3.5 logs malformed-warn for non-object `settings[runner]`. Asymmetry: non-string `model` is silent. `adversarial: { model: 42 }` should warn. Either both warn or both don't; the asymmetry is under-justified.

17. **Cold-cache settings-load integration test.** Design notes 5–15 ms cold first-call cost but specifies no test for the cold-cache path end-to-end. A regression that doubles cold-cache cost ships undetected.

18. **R4.4 + R4.5 simultaneous emission is not in the axis-by-axis or cross-axis fixtures.** Design's cross-axis pairs both involve diff-axis variation; the typecheck-axis pair `success-with-diagnostics + partial-coverage` (both R4.4 and R4.5 emit, and both reference manual scanning) is not pinned. Add this fixture or document why it's not a redundancy concern.
