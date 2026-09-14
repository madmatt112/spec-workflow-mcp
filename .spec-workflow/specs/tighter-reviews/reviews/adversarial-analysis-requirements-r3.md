# Adversarial Analysis — `tighter-reviews` Requirements (v3)

Subject: `/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/tighter-reviews/requirements.md`
Reviewer posture: senior staff engineer, focus on parsers/heuristics/process boundaries the determinism now relies on.
Prior context: see `adversarial-memory-requirements.md`. v3 attacks the new load-bearing pieces (R1.11 heuristic, `--listFiles` parsing, R4.3/R4.5 wording, R3 cumulative complexity, mandatory sequencing, R4.10 brittleness, denylist negative space).

---

## 1. R1.11 `diffPossiblyStale` — the heuristic false-negatives the *typical* partial-commit flow

**Classification:** Recurring (memory §Unresolved flagged the heuristic was unexamined; v3 confirms the central defect). **Severity: critical.**

R1.11 fires when the latest implementation-log entry timestamp is *older* than the most recent HEAD commit timestamp. This catches "agent committed, then triggered review without re-logging" — but it does not catch the case the directive R4.3 prose actually describes ("partial-commit").

Walk the typical agent flow:

1. Agent edits A, B, C.
2. Agent writes log entry (`log_time = T1`).
3. Agent runs `git commit -m '...' -- A` to commit only A. New HEAD has `commit_time = T2 > T1`.
4. Agent does NOT re-touch the log. B, C are still uncommitted.
5. Review is triggered.

In this flow `log_time (T1) < HEAD_commit_time (T2)` → heuristic fires correctly. **Good.**

Now walk the more common workflow this codebase actually emits (the standard agent loop in spec-workflow-mcp):

1. Agent edits A, B, C.
2. Agent commits all of them via `git commit -- A B C`. Commit time `T1`.
3. Agent appends/updates the implementation log entry referencing the commit. `log_time = T2 > T1`.
4. Reviewer is triggered.
5. `git diff HEAD --` is empty. R1.4 path: `data.diff = ""`, R4.2 diff-empty fires. The reviewer is told "the changes were already committed before review … read every file in `filesToReview`" — fine, this is correct.

Now the failure case. Agent does step 2 with only A:

1. Agent edits A, B, C.
2. Agent commits A only. `commit_time = T1`.
3. Agent updates the log entry covering A, B, C. `log_time = T2 > T1`.
4. Reviewer triggered.
5. `git diff HEAD --` returns hunks for B, C only (A is committed and clean against HEAD).
6. R1.11 evaluates: `log_time (T2) > HEAD_commit_time (T1)` → **`diffPossiblyStale = false`**. Heuristic does NOT fire.
7. R4.3 is not emitted. Reviewer is told via R4.1: "read the diff first." The diff covers B, C. A's diff has been silently elided. The reviewer believes they have an authoritative view of the task's changes. **They do not.**

This is the central partial-commit failure mode — the one R4.3 prose explicitly names ("the rest of the changes are already in `HEAD` and not represented here") — and the heuristic is structurally wrong-direction for the agent flow this codebase produces. The spec uses log-after-commit as evidence the diff is fresh; in reality, log-after-commit is the agent's standard hygiene and it occurs in *both* the partial-commit and the full-commit cases. R1.11 is biased toward catching the rare flow (commit-after-log without re-logging) and structurally blind to the common one (partial-commit with the log updated last).

A timestamp comparison cannot distinguish "log written after a partial commit" from "log written after a full commit" because the timestamps are identical in both. The signal needed is *content*: does the latest commit on HEAD touch any path in `allFiles`? If yes, those paths' contributions are not in `git diff HEAD --` and the diff is partial. The spec rejected `git status` cross-check as a separate spec — but the same piece of orthogonal git evidence (`git log --name-only HEAD ^prev_log_commit -- <allFiles pathspec>`) is what makes R1.11 actually correct, and it's neither in scope nor in the punted "implementation-log validation" follow-up.

Adjacent failure modes that compound:

- **`--amend` / `rebase` reset commit timestamp** but preserve author timestamp. The spec doesn't say which `git log` format the heuristic reads. If `%ct` (committer time): an amend touches a single line of A, doesn't change the actual code, and the heuristic flips to "stale" → spurious R4.3 emission. If `%at` (author time): an amend that materially rewrites HEAD is invisible to the heuristic.
- **Detached-HEAD review of older work**: user checks out an older commit to inspect a past task. HEAD's `commit_time` is OLD, log entry's `log_time` is NEW → `diffPossiblyStale = true` always. R4.3 always fires. The reviewer is steered toward `filesToReview` even though the diff is exactly what they want to see (it shows the task's hunks against the parent of the checked-out commit's predecessor, depending on what they checked out — the point is the heuristic is irrelevant in this flow).
- **Repos with no commits** (fresh `git init`, first task). `git log -1 HEAD` fails. Spec is silent on whether this is the "no commits" branch of R1.4 (degrade to diff-empty) or whether `diffPossiblyStale` is `false` by default. Code paths will diverge by implementation.
- **Clock skew across container boundaries.** The implementation log file's recorded timestamp is wherever the agent ran (often a container/sandbox/WSL2). The git commit timestamp is wherever `git commit` ran (host, often a different clock). WSL2 clocks drift after host suspend/resume by tens of seconds; CI runners and host machines diverge routinely. With no skew tolerance defined, a 5-second host-vs-container offset flips the heuristic randomly.
- **Timezone/serialization**: implementation log entries are JSON; git timestamps are integers (Unix). Comparison is fine if both are normalized to epoch seconds, but the spec doesn't pin the comparison primitive. If the log stores ISO8601 strings with local TZ and the parser misinterprets, the comparison silently corrupts.

**The R1.11 heuristic should be reversed or replaced.** The simplest correct version: compare the set of paths in `git log` from the implementation log's recorded commit (or first task-touching commit) through HEAD to `allFiles`. If any task path appears in HEAD ancestry past the log's commit reference, mark stale. This is content-based, not timestamp-based, and gives the right answer.

---

## 2. `--listFiles` parsing — symlinks and case-insensitive FS produce systemic false `coverage.excluded`

**Classification:** Compounding on §2 (memory flagged parsing reliability unexamined). **Severity: high.**

R2.4 sets `coverage.compiled = allFiles ∩ listFilesOutput` and `coverage.excluded = allFiles \ listFilesOutput`. The set operation is path-string equality. Three concrete cases break it:

### 2a. Symlinks in pnpm/yarn-workspace monorepos (the most likely deployment target)

pnpm symlinks workspace packages into `node_modules`. A typical layout:

```
/repo/packages/foo/src/index.ts        ← agent edits this; allFiles records this absolute path
/repo/node_modules/foo  →  /repo/packages/foo  (symlink)
```

When tsc is invoked with `tsconfig.json` referencing `node_modules/foo` (transitively, via a dependency import), `--listFiles` emits the **realpath**: `/repo/packages/foo/src/index.ts`. This is the *same* file as `allFiles` recorded — `compiled` will report it correctly *only by luck*, depending on whether the path entered the program graph through the realpath or the symlink path.

A more reliable break: the agent writes a file under a symlinked directory (`/some/symlinked/dir/x.ts` where the symlink target is `/real/path/x.ts`). `allFiles` records whatever `path.resolve()` produced from the agent's CWD. tsc emits the realpath. Set difference says `excluded`. R4.5 fires. Reviewer is told "manually scan x.ts for type errors" — when tsc compiled x.ts cleanly under a different name.

### 2b. Case-insensitive filesystems

macOS APFS (default), Windows NTFS, WSL2 mounts. Agent records `src/Foo.ts`; tsc canonicalizes to `src/foo.ts` (or vice versa). Set membership fails for purely cosmetic case differences. `coverage.excluded` populates with files tsc actually checked. R4.5 spuriously fires.

### 2c. tsc's `--listFiles` includes the program's full file set, NOT only files in `allFiles`

R2.4 says `coverage.compiled` is `allFiles ∩ listFilesOutput`. Fine. But the implementation must intersect with `allFiles` — if the implementation accidentally drops the intersection step and reports `listFilesOutput` directly, `compiled` includes thousands of unrelated files. The spec doesn't show a normalized-comparison algorithm and doesn't pin a test fixture covering symlinks/case. The R3.10-style precedence pinning is absent for R2.4.

### 2d. `--listFiles` + `--incremental` interaction is undefined

`--listFiles` emits the program file set. With `--incremental` and a populated tsbuildinfo, tsc *skips type-checking* files that haven't changed but **still parses them into the program**, so they appear in `--listFiles`. The current spec assumes this is the case (otherwise the cache would invalidate coverage). But if a future tsc build optimizes `--listFiles` to only emit re-parsed files (a not-unreasonable perf change), `coverage.compiled` becomes "files re-checked this run" and every cache hit produces a fully spurious `coverage.excluded`. The spec doesn't pin a tsc version range or test the cache-warm path.

### 2e. Silent parse failure on a clean exit

R2.9 catches non-zero-exit-with-zero-diagnostics. It does NOT catch: tsc exits 0, `--listFiles` output is malformed/truncated/missing for whatever reason (output buffering, captured stderr-on-stdout interleave, locale-specific output). In that case `compiled = []`, `excluded = allFiles`, R4.5 fires for the entire task → reviewer is told "manually scan everything." This is the exact regression the spec was trying to prevent (re-introducing the LLM-hunting workload), now triggered silently.

R2.4 needs (a) realpath/case normalization on both sides of the set operation, (b) a test fixture covering symlinked workspace paths, (c) a defined fallback when `--listFiles` produces zero parseable lines (treat as `'no-parseable-output'` rather than reporting full coverage as excluded).

---

## 3. R4.3 silently overstates evidence; R4.5 silently degrades coverage; R4.1↔R4.3 contradict

**Classification:** Novel (R4.3 prose strength), Compounding (R4.5 framing parallels v2 §3.4 for R4.6), Novel (R4.1↔R4.3 composition). **Severity: high collectively.**

### 3a. R4.3 makes claims the heuristic cannot support

> "the rest of the changes are already in `HEAD` and not represented here."

`diffPossiblyStale` is a timestamp comparison, not evidence that committed task changes exist. The directive turns a soft signal into a confident narrative. Possible realities the directive misrepresents:

- HEAD advanced via an unrelated `git commit --allow-empty --message "checkpoint"`. No task-touched paths in HEAD. The directive says the rest is in HEAD — it isn't.
- HEAD advanced via `git commit --amend`. No new content. Directive misframes.
- HEAD advanced via a merge that brought in someone else's unrelated work. Directive tells the reviewer to read `filesToReview` and compare against the implementation log — they will see uncommitted code and assume the merge content is "the rest of the task's changes."

The directive should hedge: "HEAD has advanced since the implementation log; some of the task's work may be committed and therefore absent from `data.diff`."

### 3b. R4.5 silently degrades — the same regression v2 §3.4 caught for R4.6

R4.6 (typecheck-unavailable) and R4.7 (timed-out) explicitly say "**This is a degraded review surface** … operating in pre-spec methodology mode … surface this degradation in your review summary." This framing was the v2 fix.

R4.5 (partial coverage) was added in the same revision and **does not have this framing**. It says "Manually scan the listed paths for type errors and structural issues. The `compiled` list is the trustworthy coverage set." That's it. No "degraded surface", no "pre-spec methodology mode", no "surface this in your summary." For the reviewer, R4.5's manual-scan instruction is indistinguishable from a routine reading task — they will not flag the per-file coverage gap to the human reviewer.

The author applied the v2 framing fix to two of three "tsc didn't help here" branches and missed the third. The fix is mechanical: add the same three sentences.

### 3c. R4.1 and R4.3 give contradictory primary instructions

When `data.diff` is non-empty AND `diffPossiblyStale = true`, both R4.1 and R4.3 are emitted (R1.11: "*in addition to* the diff-present directive"). They tell the reviewer different things:

- R4.1: "**Read the diff first.** Read it before opening any file from `filesToReview`. Open files from `filesToReview` only when (a/b/c)."
- R4.3: "Open the files in `filesToReview` and compare against the implementation log's described changes — the diff is a partial view, **not the authoritative one** for this review."

R4.1 says diff is primary, files are conditional. R4.3 says files are primary, diff is non-authoritative. The composition produces a directive pair that contradicts on the source-of-truth question. The reviewer (LLM) will pick one essentially at random — and the resolution is precisely the kind of methodology drift the composite-pin tests are supposed to prevent. But the pin only catches that the *strings* are emitted; it cannot catch that the *combined meaning* is incoherent.

The spec must pick the precedence at design time: when stale, R4.3 OVERRIDES R4.1's "diff first" framing, OR R4.3's prose is rewritten to layer on top of R4.1 ("diff first remains correct for the hunks present; *additionally* check `filesToReview` for committed-but-not-shown changes"). Pick one in spec, in writing, and pin it.

### 3d. R4.4 (c) "spurious" undermines the deterministic-shift thesis

> "(c) spurious."

`tsc --noEmit` rarely emits false positives — and the cases where it does (e.g., a stale tsbuildinfo, an environment-typing mismatch, a `// @ts-expect-error` interaction) are ones where the *fix* is to investigate the type system, not to dismiss the diagnostic. Offering "spurious" as a triage bucket without a definition gives the LLM a license to silently drop diagnostics it doesn't understand. The deterministic-shift thesis is "tsc found this; please triage it" — adding "or just decide it's wrong" reverts to LLM-judgment exactly where determinism is strongest.

The clause should be removed, or constrained to a defined case ("prior `// @ts-expect-error` directive applies" / "the diagnostic targets a path the task did not modify and it persists from prior code") with the demand that the reviewer cite which case they're invoking.

---

## 4. Cumulative R3 + `features` complexity is operationally unowned

**Classification:** Compounding on memory's "configuration sprawl" theme. **Severity: medium.**

R3's edge-case resolution is individually defensible. Cumulatively, the contract a user must hold to predict their effective config is now:

- Two precedence shapes (grouped + legacy).
- Three nullability semantics (absent / null / empty-string).
- One "non-object → ignored with warning" rule.
- One "unknown keys silently ignored" rule.
- Mtime-keyed in-process cache.
- Once-per-process malformed-warn flag, cleared on mtime change.
- Two runners (adversarial / taskReview) with the rules applied independently.
- A `features` block whose schema is undefined.

A user reading `adversarial-settings.json` cannot determine, from the file alone, what `AdversarialRunner.run` will receive. They must also know: whether the in-process cache holds a stale parse, whether the file's mtime advanced, whether the warning has already fired this process, what reading order the dashboard process and the CLI process applied. R3 needs an effective-config diagnostic (`mcp tool: spec-workflow:effective-config` or equivalent) to be operationally usable. The spec doesn't include one and doesn't acknowledge the gap.

### 4a. mtime cache breaks on second-resolution filesystems — concrete, reproducible

WSL2 mounting Windows filesystems (`/mnt/c/...`) reports mtime at 1-second resolution (sometimes 2-second on FAT-derived FS). NFS clients on default-mount have similar behavior. The failure mode:

1. User saves `adversarial-settings.json` at `T=1700000000.123`. mtime rounded to `1700000000`.
2. Cache stores `(mtime=1700000000, parsed=<old>)`.
3. User edits the file at `T=1700000000.890`. mtime rounded to `1700000000`. **No change.**
4. Cache hit. The new content is silently ignored for the lifetime of the process.

The "warn on malformed-load" semantics make this worse: if the user's edit is to *fix* a malformed file, the malformed parse stays in the cache. The user thinks the fix is live and the warning has been silenced — but the actual cause (still-broken file) re-emerges later because nothing actually re-read the file.

R3.7 needs a fallback signal: if mtime is identical but file size differs, re-parse. Or compare a content hash. Or fall back to age-based eviction (re-parse after 60s regardless). The spec is silent.

### 4b. `features` is undocumented in R3

The example config (line 38) shows `"features": { "typecheck": true }`. The kill switch is referenced in NFR Reliability and R2.8 (reason `'feature-disabled'`). But:

- `features` is not in §R3's acceptance criteria. R3.5's edge-case rules (null/empty-string/non-object/unknown-keys) do not mention `features`.
- Is `features` schema closed (only `typecheck`) or open (forward-compatible like the runner blocks)?
- What if `features = null`? `features = "yes"`? `features.typecheck = ""` (empty string — the runner blocks treat this as "explicitly cleared")? The spec doesn't say.
- The R3.7 settings-read cache covers `features` implicitly (it's a top-level field of the same file), but the spec never says so. If a future change adds `features.diff: false`, will the existing cache + warn semantics carry over, or does `features` get its own treatment?

R3 and the `features` block need to be unified under one set of rules, with `features` keys subject to the same null/empty/unknown-key semantics as runner blocks (or with explicit deviation called out).

### 4c. Cross-process cache is unspecified

NFR Code Architecture says "in-process only, not persisted." Two MCP server instances watching the same file have independent caches and independent once-per-process warning flags. The user fixes a malformed file → instance A's cache evicts on mtime change and reads cleanly; instance B's cache has not been hit since the fix and continues to use the malformed parse until its next request. Cross-process behavior under file edits is undefined. Probably fine for v1, but the spec should explicitly say "behavior across processes is independent; users running multiple servers may see divergent runs until both processes have re-read post-edit."

---

## 5. Mandatory track sequencing has no enforcement and no escape valve

**Classification:** Recurring, escalating. Memory §Unresolved flagged this, v3 confirms. **Severity: medium-high (process risk).**

The spec promotes A→B→C from convention to mandate. It does not specify:

### 5a. Enforcement

What stops a developer from landing Track B against current `main` while Track A's PR is still open? Nothing in the spec. Possible enforcement vectors not specified:

- CODEOWNERS rule blocking changes to `buildReviewMethodology` until track A's PR landed.
- A pre-merge CI job that checks for the existence of Track-A pin before allowing Track-B pin to land.
- Branch protection requiring a label.
- Code review knowledge alone.

A mandate without an enforcement mechanism is a convention with confident wording. The spec should pick at least one mechanism and list it.

### 5b. Emergency-fix escape valve

A security patch or production hotfix to `multi-server.ts`'s `handlePrepare` (e.g., a path-traversal in one of the existing fields) needs to land between Track A and Track B. The mandate forbids it. The spec should specify: emergency fixes that don't touch `buildReviewMethodology` and that don't add response-shape fields are exempt; the composite-pin tests must still pass; existing pins remain valid.

### 5c. Track-A-stuck-in-CI scenario

Track A's PR fails CI for a week (flaky tsc test on a less-common Node version, dependency upgrade, etc.). Track B is otherwise ready. The mandate says B can't land. The escape valve is unspecified. Acceptable: "Track A must merge first; if Track A's merge is blocked beyond N days, the team may re-sequence, in which case Track B's PR re-pins the composite directly without the interim Track-A-only pin." Pick a rule.

### 5d. Track-A defect requiring redesign

If Track A's review identifies a defect requiring redesign (e.g., the `--listFiles` parsing concerns above), Track B is blocked indefinitely while A is rewritten. Or Track B has to be rebased onto whatever A becomes. The spec offers no path to ship B against current `main` if A is in extended rework.

### 5e. R4.9 interim composite is observable to external consumers

R4.9 frames the interim composite as "the correct output for that intermediate code state." But any external consumer of `buildReviewMethodology`'s output — replay tooling that snapshots methodology for audit, telemetry that hashes the composite, downstream MCP clients that pin against expected output — sees a real shape change at Track A's merge and another at Track B's merge. The spec dismisses this as fine ("correct output"); it isn't fine for a consumer that holds a hash of the composite. The Out of Scope section punts external-consumer migration runway as a free externality. If external consumers exist (the spec doesn't enumerate), they need a versioned methodology header or a release-notes entry per track.

---

## 6. R4.10 composite-pin brittleness — cardinality and retirement undefined

**Classification:** Compounding on memory §Unresolved (composite-pin brittleness vs. value). **Severity: medium.**

### 6a. Cardinality

Track A scenarios: 4 (typecheck-present, partial-coverage, unavailable, timed-out). Track B scenarios per the spec: "each of the above PLUS diff-present, diff-empty, diff-stale" — implying 4 × 3 = 12 minimum if each typecheck scenario crosses with each diff scenario, but more if `diffPossiblyStale` is independent of empty/non-empty (which it is) and `diffTruncated` is independent (which it is). The full cross-product is ≥ 24 scenarios, every one of which must be regenerated when any single directive's wording changes. A typo fix in R4.4 cascades to every Track-A scenario AND every Track-B scenario.

The spec does not pin which scenarios are mandatory vs. nice-to-have. It does not bound the cross-product. R4.10 should either (a) explicitly enumerate the N required scenarios with a justification for the choice, or (b) define an axis-by-axis test pattern (one pin per typecheck state with a fixed diff state, one pin per diff state with a fixed typecheck state) so the matrix grows linearly, not multiplicatively.

### 6b. Track-A pin retirement

R4.9 says "Track B's PR replaces it with the full composite" but doesn't say *delete the Track-A-only pin* or *keep it as a regression test for an out-of-tree fork that hasn't moved past Track A*. The spec must pick:

- **Delete on Track-B merge**: simpler test surface, no retired artifacts. Track-A pins exist only between A's merge and B's merge.
- **Keep as a regression artifact**: only meaningful if any downstream consumer ships at the Track-A code state. Adds permanent dead test fixtures.

Pick one explicitly.

### 6c. Whitespace/formatting brittleness

Composite output is a single string. Trailing newlines, list-marker style (`- ` vs `* `), bullet indentation, joining-newlines between directives — every cosmetic change breaks every pin. The spec doesn't say whether the composite is compared via `===` (every byte significant) or via a normalized form (e.g., trim trailing whitespace, normalize line endings). Pick a normalization strategy, or accept that every cosmetic refactor of `buildReviewMethodology` is a cross-track PR.

### 6d. Fixture-origin tautology

Where does the canonical "expected" composite come from? The spec doesn't say:

- **Generated from `buildReviewMethodology`** (snapshot test): the test asserts that the function's output equals what the function emitted on capture. This is tautological for catching regressions in *intent* — it only catches accidental changes after the snapshot was taken, not the original intent.
- **Hand-authored**: the test asserts the function emits exactly what a human wrote. This catches intent regressions but creates two sources of truth (the directive in R4.x and the fixture file), with their own drift.

The spec should pick: hand-authored fixtures, derived from the literal R4.x directive prose, with a build-time check that R4.x prose in the spec source matches the test fixtures. Otherwise the pin is structurally vulnerable to either tautology or drift.

---

## 7. Denylist negative space (R1.5) — concrete omissions

**Classification:** Compounding on memory's "negative space matters." **Severity: medium.**

The list closes the v1 gap (shared with hygiene). Omissions that produce concrete leaks:

### 7a. Cross-language lockfiles not matching `*.lock`

- `go.sum` (Go module checksums) — not `.lock`-suffixed.
- `poetry.lock` — IS `.lock`-suffixed. ✓
- `Pipfile.lock` — not `.lock`-suffixed.
- `Gemfile.lock` — not `.lock`-suffixed.
- `composer.lock` — IS `.lock`-suffixed. ✓
- `mix.lock` — IS `.lock`-suffixed. ✓
- `Cargo.lock` — IS `.lock`-suffixed. ✓

Three concrete leaks: `go.sum`, `Pipfile.lock` (which is suffixed but pattern-matching is case-sensitive — both `Pipfile.lock` and `Gemfile.lock` should match `*.lock` in case-insensitive matchers, but are not guaranteed in case-sensitive ones), `Gemfile.lock`. Add `Gemfile.lock`, `Pipfile.lock`, `go.sum` explicitly.

### 7b. Auth-bearing dotfiles outside the secret patterns

None of the following are in the denylist:

- `.npmrc` (with `_authToken=...` lines).
- `.netrc` (machine/login/password tuples).
- `.pypirc` (PyPI upload credentials).
- `.docker/config.json` (auth tokens base64'd).
- `.aws/credentials` (the file the AWS CLI consults).
- `.kube/config` (cluster credentials, certificates).
- `.gitconfig` if remote URLs embed credentials (`https://user:pass@host`).

These are common to commit by accident and `.env`/`.pem`/`.key` patterns won't catch them. Add the explicit set.

### 7c. Build outputs and caches

- `dist/`, `build/`, `.next/`, `.turbo/`, `coverage/`, `node_modules/` — gitignored normally, but the diff path doesn't depend on gitignore status (it depends on the agent's `allFiles`). If a project commits a `dist/` snapshot for any reason, it lands in the diff. The token-cap (R1.8) clamps the volume but doesn't make build-output noise *useful* to a reviewer.

Less critical than 7a/7b — these are not security-bearing — but the spec's "denylist applies to hygiene as well" creates noise in hygiene signals if e.g. a `dist/bundle.js` `console.log` shows up.

### 7d. TypeScript build artifacts

`*.tsbuildinfo` is not denylisted. The spec carefully isolates the review-driven tsbuildinfo to `.spec-workflow/.cache/tsc.tsbuildinfo`, but the project's own `.tsbuildinfo` may be anywhere and may end up in `allFiles` if the agent edited it (rare, but possible — e.g., from a corruption-recovery fix). It is binary-ish and uninformative.

### 7e. Pathspec semantics divergence between git and the hygiene utility

`git diff -- ':(glob)**/secrets/**'` requires the `:(glob)` magic prefix to make `**` match across path components. Without it, git's pathspec-style wildcards behave like shell glob. The spec doesn't say which form is passed. If the diff utility passes `**/secrets/**` raw, git interprets `**` as `*` and the secret directory survives only if it's a direct child.

The hygiene utility (existing code) almost certainly uses minimatch or a custom matcher — both treat `**` as cross-component. The same pattern string therefore matches different sets of files depending on which utility evaluates it. The denylist must be expressed in *one* matcher and translated; or the spec must define the matcher semantics for both call sites.

### 7f. Test-fixture false positives

Fixtures named `id_rsa.test.pem`, `test-secret.env`, `*credentials*.test.ts` in this codebase's own tests will be denylisted. The reviewer of a change to *the denylist itself* will get a diff that excludes the test fixture for the change — invisible to review. Stress-test the change to `path-denylist.ts`: any PR adding a fixture that matches the denylist removes that file from its own diff, hiding the change being made.

The denylist needs an exception path for test fixtures (e.g., `**/__tests__/**`, `**/*.test.*`, `**/fixtures/**` opt-out), or the spec must accept that denylist-modifying PRs can't review themselves through the diff path.

---

## 8. Forward-compatibility claims and OOS deferrals

**Classification:** Compounding on v2 §5.4 (R3 docs ownership). **Severity: low-medium.**

### 8a. Future grouped-shape ambiguity for global `cli`

NFR Code Architecture: "cli/cliArgs are still global." The example config has `"cli": "claude"` at top level. When a future spec adds per-runner `cli`, the global `cli` becomes ambiguous: does the global default still apply when a runner doesn't specify, and does an empty string under `adversarial.cli` mean "explicitly cleared, fall back to global"? The forward-compatibility claim needs the resolution rule embedded *now*, before the per-runner cli arrives — otherwise the next spec inherits the same R3.5-style edge-case discovery process from scratch.

Pin in this spec: the future per-runner `cli` resolves through the same precedence as `model` (per-runner > global > undefined → CLI default). One sentence in §Configuration shape.

### 8b. "Implementation-log validation" follow-up — placeholder?

Coverage constraints reference a future "implementation-log validation" spec that closes the `git status` cross-check gap. The current spec accepts `allFiles` as the single coverage anchor for hygiene/diff/typecheck. If that follow-up never materializes (or is years out), the v2 §2.4 "single coverage anchor" gap is permanent, and §1's R1.11 false-negative on partial commits is permanent (because the right fix needs the cross-check).

The spec should either (a) commit to the follow-up with a tracking issue, or (b) acknowledge that `allFiles` may be permanently the only anchor and that R1.11's heuristic is the permanent partial-commit signal, with the §1 caveats accepted as known holes.

### 8c. Schema validator break risk for new optional fields

Memory §Unresolved flagged this. Still silent in v3. The spec adds six new optional fields (`diff`, `diffStats`, `skippedPaths`, `diffTruncated`, `diffPossiblyStale`, `typecheckResults`) to the prepare response. Whether external MCP consumers (other servers, replay tools, dashboards in third-party forks) handle additive properties depends on each consumer's response-validation policy. There is no migration note, no schema version bump, no consumer survey. The spec should either explicitly note "MCP response schema is permissive (additional properties allowed); all known consumers tolerate additive fields" or accept that some consumers will break and list them.

---

## Top 5 risks or gaps

1. **R1.11 false-negatives the typical partial-commit flow** (R1.11 / R4.3). **Recurring.** The agent's standard "edit → partial-commit → update log" pattern produces `log_time > HEAD_commit_time`, so the staleness flag never fires, but the diff is partial. R4.3 is therefore unreachable in the very case it was designed for. **Failure scenario:** agent commits A only, updates the log, triggers review; reviewer is shown a B/C-only diff and told via R4.1 it is authoritative. **Fix:** replace the timestamp heuristic with a content-based check (e.g., does HEAD ancestry past the log's referenced commit touch any path in `allFiles`?), or accept R1.11 as catching only a narrow case and rename the field accordingly.

2. **`--listFiles` set comparison breaks on symlinks and case-insensitive FS** (R2.4 / R4.5). **Compounding.** pnpm-style symlinked workspace layouts emit realpaths from tsc but the agent records the symlink path. macOS/Windows case-folding diverges. `coverage.excluded` populates with files tsc did check; R4.5 fires; reviewer told to manually scan files that were already verified. **Fix:** R2.4 must specify path normalization (`fs.realpathSync` + case-fold on case-insensitive volumes) on both sides of the set operation, with a fixture covering symlinked workspaces.

3. **R4.5 silently degrades the partial-coverage case** (R4.5). **Compounding** on v2 §3.4. R4.6/R4.7 carry "this is a degraded review surface / pre-spec methodology mode / surface this in your summary"; R4.5 does not. Reviewer manually scans without flagging the per-file gap to the human. **Fix:** add the same three-sentence framing to R4.5.

4. **R4.1 ↔ R4.3 give contradictory primary instructions** when `diffPossiblyStale = true` and the diff is non-empty (R4.1 / R4.3). **Novel.** R4.1 says diff first, files conditional; R4.3 says files primary, diff non-authoritative. The composite-pin tests assert the *strings* compose; they cannot detect that the *meanings* fight. **Fix:** define precedence in spec — when stale, R4.3 supersedes R4.1's "diff first" framing OR R4.3 is rewritten to layer on top of R4.1 ("diff remains correct for hunks present; *additionally* check files for committed-but-not-shown changes").

5. **Mandatory track sequencing has no enforcement mechanism and no escape valve** (Track sequencing section). **Recurring**, escalating. The mandate is asserted but no CI rule, CODEOWNERS rule, or branch protection rule is specified. Emergency fixes between tracks, Track-A-stuck-in-CI scenarios, and Track-A-redesign scenarios are unaddressed. **Fix:** pick one enforcement mechanism (CODEOWNERS on `buildReviewMethodology`, or a CI guard that checks for a Track-A pin existence before allowing a Track-B pin update); define an emergency-fix carve-out (changes that don't touch `buildReviewMethodology` and don't extend the response shape are exempt); define the rebase-rule when Track A is blocked beyond N days.

---

## Top 3 conclusions to challenge or reverse

### 1. "Compare implementation log timestamp to HEAD commit timestamp" is the right partial-commit signal — REVERSE.

The spec's framing treats R1.11 as the partial-commit guard. It is not. It catches a different (rarer) failure: agent committed without re-logging. The typical partial-commit flow — agent commits a subset of changed files and updates the log — produces `log_time > HEAD_commit_time` and silently passes the heuristic. The signal is structurally pointed in the wrong direction for the workflow this codebase emits.

The reversal: either (a) accept R1.11 catches only "committed-without-relog" and rename the field/directive to reflect that narrower meaning (e.g., `headAdvancedSinceLog: true`, with a directive that says "HEAD has advanced since the log; the diff may not reflect committed work"), or (b) replace the heuristic with a content-based check using `git log --name-only` from the log's referenced commit (or the implementation log's recorded commit ID — which the log writer can capture cheaply at commit time) through HEAD, intersected with `allFiles`. The latter is the correct partial-commit signal and removes the timestamp comparison entirely.

### 2. R4.4's "(c) spurious" classification is harmless — REVERSE.

The spec offers "spurious" as a triage bucket alongside "real bug" and "pre-existing" without defining what makes a tsc diagnostic spurious. tsc's false-positive rate is low; the cases where users informally label a diagnostic "spurious" are usually misdiagnoses (stale tsbuildinfo, environment typing mismatch, an unrelated `// @ts-expect-error` interaction).

The clause invites the LLM to dismiss diagnostics it doesn't understand — the exact LLM-judgment regression the deterministic-shift thesis was built to remove. Either delete (c) entirely (force triage into "real" or "pre-existing"), or constrain (c) to defined cases and require the reviewer to cite the case explicitly.

### 3. R4.9 frames the interim Track-A composite as "not a deprecated artifact" — PARTIALLY REVERSE.

The framing is correct *internally* (the interim is the right output for the interim code). But the framing dismisses external-consumer migration runway. Any consumer that holds a hash of `buildReviewMethodology`'s output (audit logging, replay, downstream MCP client validation) sees a real shape change at Track A's merge and another at Track B's merge — two breaking changes within the spec's own rollout window.

Reverse the framing toward acknowledgement: the interim composite is the correct output for the interim code state AND it constitutes a methodology-shape change for any consumer that pins composite output. Add: a methodology version field (or release-notes entry) for each track's PR; or make the interim Track-A pin retire mechanically when Track B lands so external consumers see at most one version transition; or explicitly enumerate that the only methodology consumer is the test suite (and therefore the external-consumer concern is theoretical).

---

## What's missing — pre-design work

Concrete items the spec must specify before moving to design:

1. **Define which `git log` timestamp R1.11 reads** (`%ct` / `%at`). State the implication for amend/rebase explicitly: "amends and rebases that update committer time will flip the heuristic without reflecting code-state change." Or replace R1.11 entirely with a content-based check (per §1 / Top-5 #1).

2. **Define a clock-skew tolerance** for R1.11 (e.g., "ignore differences smaller than 60 seconds"). Without one, container/host clock drift produces random heuristic flips.

3. **Define behavior in repos with no commits.** Specify whether R1.11 evaluates as `false`, `undefined`, or routes to R1.4's no-git-repo path.

4. **Specify path normalization for R2.4 set operations.** State that both sides of `coverage.compiled = allFiles ∩ listFilesOutput` are normalized via `fs.realpathSync` and case-folded on case-insensitive volumes, with a fixture covering pnpm-style symlinked workspaces.

5. **Define `--listFiles` parse failure on clean exit.** Specify: when `tsc` exits 0 but `--listFiles` produces zero parseable lines, return `{ status: 'unavailable', reason: 'no-parseable-output' }` rather than `{ status: 'success', coverage: { compiled: [], excluded: allFiles } }`.

6. **Pin a tsc version range** the spec supports. State which `--listFiles` output format is assumed and what happens when tsc is older/newer than the supported range (degrade to `'no-parseable-output'`).

7. **Add the R4.5 degradation framing.** Three sentences mirroring R4.6/R4.7.

8. **Define R4.1 ↔ R4.3 precedence in spec.** One paragraph picking which directive's source-of-truth framing wins when both are emitted.

9. **Define R4.4(c) "spurious"** with an enumerated list of cases, or remove the clause.

10. **Specify the `features` schema rules under R3.** Whether `features` is closed (only `typecheck`) or open (forward-compatible), and which of R3.5's null/empty/non-object/unknown-key rules apply.

11. **Define an mtime-cache fallback** for filesystems with second-resolution mtime (NFS, SMB, WSL2 mounts of Windows volumes). Options: re-parse if file size differs at identical mtime; re-parse after a wall-clock TTL; compare a content hash on identical mtime.

12. **Define cross-process cache behavior** explicitly. One sentence: "Caches are per-process; users running multiple servers may see divergent runs until each process re-reads after edit."

13. **Specify the enforcement mechanism for mandatory track sequencing.** CODEOWNERS, CI guard, branch protection — pick one.

14. **Specify the emergency-fix carve-out** for changes between tracks. (Changes that don't touch `buildReviewMethodology` and don't extend the prepare response shape ship without re-pinning the composite.)

15. **Specify the Track-A-blocked-in-CI escape valve.** ("If Track A is blocked beyond N days, Track B may re-pin the composite directly; the interim Track-A pin is skipped.")

16. **Specify Track-A pin retirement on Track-B merge.** Pick: delete the interim pin when Track B lands, OR keep it as a regression artifact.

17. **Specify the composite-pin scenario set explicitly** in R4.10. Either enumerate the N required scenarios with rationale, or define an axis-by-axis test pattern that grows the matrix linearly rather than as a cross-product.

18. **Specify composite-pin normalization.** Whether the test asserts byte equality or normalized equality (trim trailing whitespace, normalize line endings), and where the canonical fixture comes from (hand-authored tied to R4.x prose with a build-time consistency check).

19. **Add cross-language lockfiles and auth dotfiles to R1.5.** Specifically: `Gemfile.lock`, `Pipfile.lock`, `go.sum`, `.npmrc`, `.netrc`, `.pypirc`, `.docker/config.json`, `.aws/credentials`, `.kube/config`.

20. **Define the matcher semantics for R1.5 patterns** at both the `git diff -- <pathspec>` and `computeHygieneSignals` call sites. (e.g., "patterns are evaluated by minimatch in both contexts; the diff utility translates to git pathspec via `:(glob)` magic prefix.")

21. **Define a denylist exception for test fixtures** (`**/__tests__/**`, `**/fixtures/**`, etc.) so PRs modifying the denylist itself are reviewable through the diff path.

22. **Pin the future-`cli` resolution rule** in the §Configuration shape forward-compatibility claim. (Per-runner `cli` resolves through the same precedence as `model`.)

23. **Decide on the "implementation-log validation" follow-up**: commit to it with a tracking issue, or accept `allFiles` as the permanent single anchor and document that R1.11's partial-commit gap is permanent.

24. **Add a schema-version note** for the prepare response or commit to "additional properties allowed; new optional fields ship without a version bump." Either explicit; the current silent-additive approach has a known break risk that has now persisted across two reviews.

25. **Add an effective-config diagnostic** (e.g., `mcp tool: spec-workflow:effective-config`) so users can resolve their R3 + `features` contract without re-deriving the precedence/cache/warn semantics from spec. The cumulative complexity is not operationally usable without one.
