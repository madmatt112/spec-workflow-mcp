# Adversarial Review Memory — Requirements
Last updated: 2026-04-28 (after v2 review)

## Cumulative Findings Summary

### Accepted

#### From v1
- **diffStats source ambiguity**: spec mandates `git diff --numstat` as canonical (R1.7).
- **Cascading errors filtered hides root causes**: all diagnostics returned, `inScope: boolean` tagged (R2.3).
- **Dead `severity: 'warning'` union member**: dropped; tsc errors-only documented (R2.3).
- **Category misclassification of type errors**: `category: 'hygiene'` (R4.4).
- **Methodology directive text missing**: now embedded verbatim in §R4 with composite-pin tests.
- **Binary / lockfile / generated-artifact handling**: explicit denylist (R1.5).
- **Secrets/PII denylist**: covered (R1.5), shared with hygiene signals.
- **Token-budget cap on diff**: 500 lines/file, 50,000 bytes total, `diffTruncated` (R1.8).
- **Diagnostic volume cap**: 100-entry cap (R2.13).
- **Cold-cache cross-contamination from `--incremental`**: dedicated `--tsBuildInfoFile` (R2.1).
- **`tsc` non-zero with no parseable output**: distinguished as `'no-parseable-output'` (R2.9).
- **Process termination on timeout**: SIGTERM → 2s grace → SIGKILL (R2.11).
- **`cwd` / env contamination**: `GIT_OPTIONAL_LOCKS=0` (R1.10), `FORCE_COLOR=0; NO_COLOR=1` (R2.14).
- **Wider diff context**: `-U10` (R1.1).
- **`Promise.all` seam landed up front**: Track A lands the shell.

#### From v2
- **R3 precedence at type boundaries (v2 §1.1)**: empty string treated as "explicitly cleared" → fallback to legacy; `null` treated as absent; non-object types ignored with warning; unknown keys silently ignored for forward-compat (R3.5).
- **Settings-read timing unspecified (v2 §1.2)**: spec now mandates per-request read with mtime-keyed in-process cache (R3.7).
- **"One warning per malformed-load event" undefined (v2 §1.4)**: now defined as once per process lifetime, cleared on mtime change (R3.7).
- **R3 grouped vs flat shape (v2 §1.5)**: spec pivoted to grouped shape (`adversarial: { model }, taskReview: { model }`) — forward-compatible with future per-runner `cliArgs`/`cli` overrides without a config migration. Rationale embedded in Configuration shape section.
- **Retry-with-different-model unspecified (v2 §1.6)**: R3.9 explicitly states retry uses same model for telemetry/billing consistency; per-retry overrides moved to Out of Scope.
- **No test pinning for precedence matrix (v2 §1.7)**: R3.10 mandates pinned tests covering all precedence cases.
- **Empty typecheckDiagnostics indistinguishable from excluded (v2 §2.1, recurring)**: R2.1 now invokes `--listFiles`, R2.4 returns `coverage.compiled` and `coverage.excluded`, R4.5 emits typecheck-partial-coverage directive.
- **Non-empty-but-incomplete diff no methodology branch (v2 §2.2, recurring)**: R1.11 introduces `diffPossiblyStale` boolean, computed by comparing implementation log timestamp against latest HEAD commit timestamp. R4.3 emits diff-stale directive.
- **R1.2 half-the-file denominator ambiguous (v2 §3.1)**: R4.1 now defines `(addedLines + removedLines) / max(preEditLines, postEditLines)`.
- **Rename detection / R1.2 rename trigger (v2 §2.3, §3.1, recurring)**: R1.1 adds `-M`. R4.1 explicitly removes "rename" from fallback triggers and tells the reviewer not to rely on diff for rename detection (with rationale: explicit pathspec defeats git's rename detection).
- **Diff-empty fallback embedded shell (v2 §3.2)**: R4.2 now contains prose only; no shell commands embedded.
- **R2.6 typecheck-unavailable degrades silently (v2 §3.4)**: R4.6 now explicitly names regression: "This is a degraded review surface" / "pre-spec methodology mode" / "surface this degradation in your review summary."
- **R2.8 timed-out assumes a terminal (v2 §3.5)**: R4.7 removes "separate terminal" suggestion; now mirrors R4.6 degradation language.
- **Methodology composition with item-9 hygiene (v2 §3.6, recurring)**: R4.8 now enumerates composition: diff directives precede everything, typecheck directives sit alongside hygiene as item 10, item-9 hygiene retains its position.
- **Track sequencing — merge contention and isolation methodology change (v2 §4.1, §4.3, recurring)**: spec promotes track sequencing from convention to **mandatory** (Track sequencing section). A→B→C is required. R4.9 documents interim Track-A-only methodology state as a committed pin, not a deprecated artifact.
- **Test pinning across PRs (v2 §4.4)**: R4.10 enumerates exact composite-pin scenarios per track.
- **Forward-compatible response shape (v2 §5.3)**: `typecheckResults: TypecheckResult[]` (length 1 v1, extensible) discriminated union over `status`. R2.2.
- **R3 docs no owner (v2 §5.4)**: R3.11 mandates README/docs/comment updates ship with R3 PR.
- **Coverage anchor `allFiles` (v2 §2.4)**: now explicitly stated in Coverage constraints section as the single anchor for hygiene/diff/typecheck. Cross-check against working tree explicitly punted to a future "implementation-log validation" spec.
- **Kill switch (v2 §5.2 partial)**: `features.typecheck: false` short-circuits typecheck (NFR Reliability). Diff has no kill switch (justified by sub-200ms perf).

### Partially Accepted

- **Re-LLM-ifying introduced-vs-pre-existing typecheck triage (v1, v2 §3.3 recurring)**: R4.4 still asks reviewer to mark each in-scope diagnostic as introduced/pre-existing/spurious. The `inScope` axis added in v1 is now joined by `coverage` in v2's revisions, but the introduced-vs-pre-existing call remains LLM-judgment. Rejected as out of scope; not directly mitigated.
- **Track A in isolation produces methodology change (v2 §4.3)**: addressed via mandatory sequencing + R4.9 committed-pin framing for interim state. The interim composite is still observable to any external consumer of `buildReviewMethodology` between Track A merge and Track B merge.
- **Compound coverage worst case (v2 §5.1)**: most components addressed (project-references reason, diffPossiblyStale, partial-coverage directive). Windows process-termination edge cases remain OOS.
- **Single helper unstable scope (v2 §4.2)**: NFR Code Architecture acknowledges as technical debt — "the cost is bounded and accepted; we are not pre-designing for the unwritten spec."
- **File name vs scope discoverability (v2 §1.3)**: R3.11 now mandates docs deliverable. Rename of `adversarial-settings.json` still Out of Scope. The discoverability concern is mitigated by docs but not eliminated — users grepping the filename for "task review" will still miss it.
- **Ships on by default precedent (v2 §5.2)**: typecheck has a kill switch; diff and R3 do not. Partial concession.

### Rejected (or explicitly Out of Scope)

#### From v1
- Per-diagnostic `git blame` for `introducedByThisTask` tagging.
- Submodule / symlink diff handling.
- Multi-config / monorepo typecheck via `tsc -b`.
- Feature flag / shadow-mode rollout (typecheck has a kill switch; diff and R3 do not).
- Windows-specific process termination edge cases.

#### From v2
- Per-retry model overrides (v2 §1.6) — explicitly OOS.
- Rename of `adversarial-settings.json` (v2 §1.3) — explicitly OOS, mitigated by R3.11 docs.
- `git status` orthogonal coverage check (v2 §2.4) — punted to future "implementation-log validation" spec.
- `diff: string` reshaping for future multi-config support — accepted future schema break.
- Deprecation of legacy top-level `model` field — accepted indefinitely.
- Per-runner `cli`/`cliArgs` — grouped shape designed to absorb without migration.

### Unresolved

- **Schema validator break risk for new optional fields** (v1, never re-litigated): spec adds many new optional fields (`diff`, `diffStats`, `skippedPaths`, `diffTruncated`, `diffPossiblyStale`, `typecheckResults`) without confirming external MCP consumers accept additional response properties. No migration note. Still silent.
- **Diagnostic deduplication** (v1): only a count cap (R2.13). A 200-diagnostic cascade from one root-cause type change still dominates the cap.
- **`diffPossiblyStale` heuristic correctness (newly introduced in v2 revision)**: R1.11 compares the implementation log entry timestamp to the most recent HEAD commit timestamp. Vulnerable to clock skew (CI vs local), edited git history (`git commit --amend` resets commit time), implementation logs that are written *before* the commit, and the case where multiple tasks share an implementation log. Not yet adversarially examined.
- **`coverage.compiled` / `coverage.excluded` parsing reliability**: depends on parsing `tsc --listFiles` output, which is undocumented and historically subject to tsc-version drift. Not adversarially examined.
- **Track sequencing as mandatory creates a different problem**: A→B→C is now a hard requirement, but the spec doesn't address what happens when an emergency fix needs to land in `multi-server.ts` between track PRs, or when track A's PR review takes weeks while track B is ready. Newly elevated mandate, no escape valve.
- **Composite-pin tests' brittleness vs. value**: pinning the *full composite output* (R4.10) of `buildReviewMethodology` makes any directive wording change a multi-track concern. The spec doesn't address how a typo fix in a directive ships, or how interim Track-A pin gets retired cleanly.

## Patterns & Themes

- **The deterministic-shift thesis is now broadly applied — but its inverse failure mode (deterministic computation has its own coverage gaps) is the new attack surface.** v1 attacked the LLM-hunting workload; v2 attacked the determinism's coverage gaps (empty diagnostics ≠ ran clean, partial commits, rename detection); v3 should attack the *parsers and heuristics* the determinism now relies on (--listFiles output format, timestamp comparison logic, denylist completeness, mtime-keyed cache correctness).
- **Each iteration adds load-bearing string content (directives, reason codes, error messages).** v1 made directives mandatory; v2 added partial-coverage / diff-stale / degradation framing. The text is now a contract enforced by tests. Wording bugs and ambiguities at this level are not stylistic — they propagate into reviewer behavior. Attack the new strings.
- **Coverage-vs-availability framing has now been mostly resolved at the surface level**, but the cost is configuration sprawl: `features.typecheck`, four `unavailable` reasons, two coverage lists, three precedence rules, three nullability semantics, mandatory sequencing. The complexity itself is a defect candidate — humans configuring or reviewing this can no longer hold the contract in their heads.
- **Out-of-scope deferrals are now bounded**: v1 had ~5 OOS items, v2 added 3, v3 should not find new OOS deferrals being silently introduced. Watch for new OOS items disguised as "Future spec" references.
- **Mandatory track sequencing replaces "tracks are independent"** but introduces its own rigidity. The fix to one structural defect (silent methodology drift between tracks) creates a new one (no flexibility for emergency fixes or staggered rollouts).

## Guidance for Next Review

### Focus areas for v3

1. **The new R1.11 `diffPossiblyStale` heuristic.** Timestamp comparison between implementation log entry and HEAD commit. Examine: clock skew (UTC vs local TZ on log file), `git commit --amend` resetting commit timestamp, implementation log written *before* commit (race window), shared implementation log across multiple tasks (one task done, another in progress), shallow clones where HEAD commit timestamp may be wrong, repos without commits. Each case is a way the heuristic gives the wrong answer.
2. **The `--listFiles` parsing in R2.1, R2.4.** tsc's `--listFiles` output format is undocumented and parser-fragile. Examine: tsc version compatibility, paths with whitespace, paths with shell-meta characters, paths that resolve through symlinks (so the listed path differs from `allFiles`'s path), case-insensitive filesystems where path comparison fails, the interaction between `--listFiles` and `--incremental` when there's a stale tsbuildinfo.
3. **The configuration complexity.** R3 now has five edge-case rules at type boundaries, two precedence shapes (grouped + legacy), three nullability semantics, mtime-keyed caching, once-per-process warning suppression. Attack: can a user reason about what their config does without reading the spec? What's the failure mode when the cache and the file disagree (e.g., file edited but mtime not advanced because of fs precision)? Network filesystems with second-resolution mtime?
4. **Mandatory track sequencing as a hard requirement.** What's the cost of "must land A before B before C"? Emergency fix scenario, staggered review timelines, what happens if track A's tests fail in CI for a week and track B is ready. Is the trade-off (silent methodology drift between tracks → mandatory sequencing) actually the right one, or does it solve a small problem by introducing a larger process problem?
5. **Composite-pin test brittleness.** R4.10 pins the *full composite output* of `buildReviewMethodology` for representative inputs. A typo fix in any directive cascades to all pinned scenarios. The interim Track-A pin (R4.9) needs explicit retirement when Track B lands. Examine: how does a one-character directive fix ship? Does the test architecture cope with the cardinality of pinned scenarios (Track A: 4 scenarios; Track B: 7+; Track C: identity)?
6. **Denylist completeness.** R1.5's denylist is now load-bearing for both diff and hygiene. Examine: dotfiles not covered (`.npmrc` with auth tokens, `.aws/credentials`), language-specific lock files missing (Cargo.lock, go.sum, poetry.lock, Gemfile.lock), build outputs (dist/, build/), test fixtures that mimic secret-bearing patterns. Negative space matters.
7. **Carryover unresolved items.** Schema validator break risk for added optional response fields (no migration note). Diagnostic deduplication beyond count cap.

### Areas that have been well-covered (don't re-litigate unless genuinely novel)

- Diffstats source pick (settled — `--numstat`).
- Severity union (settled — errors only).
- Category for type-error findings (settled — `'hygiene'`).
- Cascading-error inScope tagging (settled).
- Binary / lockfile / secrets denylist *composition* (the *contents* are still in scope per #6 above).
- Methodology directive *existence* (now mandatory text). Attack the *new* wording (R4.3, R4.5, R4.6, R4.7), not the *presence*.
- Process-kill signal escalation.
- tsc env contamination on FORCE_COLOR.
- Promise.all seam.
- R3 grouped-vs-flat shape (settled — grouped won).
- R3 retry uses same model (settled — explicitly OOS for per-retry).
- "Rename" as a structural-change trigger in R4.1 (settled — explicitly removed).
- Diff-empty embedded-shell concern (settled — prose only).
- R3.7 timing (settled — per-request, mtime-cached, once-per-process warnings).
- R3.11 docs ownership (settled — ships with R3 PR).
- Track sequencing convention vs. mandate (settled — mandatory; attack the *consequences* of the mandate, not the choice).

### Classification reminder

Classify each finding as:
- **Novel**: not identified in any prior review.
- **Compounding**: deepens or builds on a prior finding.
- **Recurring**: same issue identified before but not yet resolved — escalate severity.
