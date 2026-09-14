# Adversarial Analysis — review-gate/design (v2)

Round 2. Target: `.spec-workflow/specs/review-gate/design.md` (v2). Read against the
approved requirements (v4), the codebase-context map, the memory file, and the R1 analysis.
Environment matches the design's probes: git 2.43.0, node v24.13.0.

Delta attacked first (v2 Revision History: R1-1 command replacement, R1-2 filesOnly item
scope, R1-3 truncateLine wiring, R1-4 files normalisation, Decisions/Testing compression).
Fresh lens: the cost of touching existing components — their tests, fixtures and e2e
assumptions.

## Delta re-probe and what is fine

- **R1-1 command re-probed, counts correct.** On a fresh repo I built a root, an ordinary
  and a `--no-ff` merge commit. `git log --first-parent -1 --numstat --format= --no-renames <c>`
  returned `3\t0\tbase.txt` (root, full add), `1\t0\tbase.txt` (ordinary), and `1\t0\tsidefile.txt`
  (merge) — identical to `git diff <M>^1 <M>`. No sha header, no leading blank line, so
  `parseNumstat`'s `:277` skip is indeed moot. The counts R1-1 fixed are correct.
- **R1-2 closed.** `filesOnly = mode === 'item' && !commit && !baseRef && files.length > 0`
  (step 3) now carries the item-mode guard; a task-mode call with only `files` drops to
  step 5's git path. No task-mode call can bank a `low` pass without pre-computations.
- **R1-3 closed.** Step 8 maps `reasons` through `truncateLine`, named the sole site.
  `data.checks[].output` is capped by `lastLine` (D22). AC 1.7 is now wired.
- **R1-4 closed.** Rules d/e normalise `files` like `touched` (forward-slash, root-relative,
  `./` stripped).
- **Compression lost nothing load-bearing.** Every D-number referenced in the body
  (D2, D7, D15–D31) still exists in the Decisions list; the Testing Strategy still names a
  test per rule row, the range-diff cases, the reviewer round-trip, and the e2e.
- **`TYPECHECK_STATE_RANK` covers every kind.** All seven variants of
  `TypecheckMethodologyState` (`src/tools/review-task.ts:45-52`) appear in the rank array;
  `unavailable-other`/`timeout` rank lowest (0,1), so rule e fires exactly when any result
  is one of them, and `unavailable-feature-disabled` (rank 5) never trips it. No -1 lookup.
- **Existing tests survive the shape changes.** `task-review-manager.test.ts` uses
  `toContain` on frontmatter, not exact-string/snapshot, so the new `reviewer:` line does
  not break the round-trip or the classification-count tests. `review-task.test.ts` calls
  the handler by action and never snapshots `inputSchema` or the description, so the new
  `gate` enum value / property block / description bullet break nothing.
  `get-task-review.test.ts` reads named fields off `data.review`; the added `reviewer` is
  additive. `adversarial-review.test.ts` is a different tool. No drift/snapshot test pins
  the `review-task` schema or `TOOLS-REFERENCE.md`.

## RE-DECIDED / closed rulings respected

RE-DECIDED 1.4 (D17) and RE-DECIDED 3.1 (D21 rule g) are permitted refinements and are not
re-opened. R2-2 below is not a re-litigation of "include untracked files" — it is a
distinct, unstated environmental assumption that the D17 ruling's rationale (which addressed
only the HEAD-fallback path) did not reach.

## Findings

### R2-1 — SHOULD_FIX — the R1-1 replacement dropped `core.quotePath=false`; `touched` now mixes quoted and raw encodings (Compounding)

The R1-1 fix replaced the commit-mode command but silently dropped the
`-c core.quotePath=false` that the v1 command carried. Component 5 (design.md:80-83) now
specifies three git invocations that all feed one `touched` set with two different path
encodings:

- commit: `git log --first-parent -1 --numstat --format= --no-renames <commit>` — **no flag**
- baseRef tracked: `git -c core.quotePath=false diff --numstat --no-renames <baseRef>` — **flag**
- baseRef untracked: `git ls-files --others --exclude-standard` — **no flag**

Probed on git 2.43.0 with a path `src/café.ts`:

```
# commit mode (no flag)              -> "src/caf\303\251.ts"   (C-quoted, wrapped in quotes)
# -c core.quotePath=false            -> src/café.ts            (raw UTF-8)
# ls-files --others (no flag)        -> "src/na\303\257ve.ts"  (C-quoted)
# -c core.quotePath=false ls-files   -> src/naïve.ts           (raw UTF-8)
```

So a non-ASCII (or `"`/`\`/high-bit) path lands in `touched` as `"src/caf\303\251.ts"` from
commit mode or from an untracked file, but as `src/café.ts` from a tracked baseRef change.
`touched` is never unquoted (only `files` is normalised, Data Models). Consequences:

- **Sensitive match under-reports.** `isSensitivePath("\"src/caf\\303\\251.ts\"", entries)`
  compares a quoted string against a raw entry; a sensitive non-ASCII path in commit mode
  (close-out's primary mode, AC 7.1) escapes the gate — a false negative in the gate's core
  risk control (AC 2.3 mandates forward-slash comparison).
- **Spurious `file-outside-list`.** Rule d normalises `files` to `src/café.ts`, which never
  equals the quoted `touched` entry → `gate: fail` (AC 4.1d).
- **Garbled `data.touched`** shown to agents/dashboard.

Fix: add `-c core.quotePath=false` to the commit-mode `git log` and the `git ls-files`
invocations (matching the baseRef diff), or unquote `touched` before any comparison.
ESCALATE: none — the live `agent-rules.md` sensitive list is all ASCII, so no realistic
security hole today.

### R2-2 — SHOULD_FIX — baseRef untracked inclusion pollutes `touched`/`stats` with any non-ignored file under `root`; the store-exclusion assumption is unstated and the e2e fixture omits it (Novel)

Component 5 (baseRef path) unions `git ls-files --others --exclude-standard` into `touched`
and adds each untracked file's line count to `stats` (D18). `--exclude-standard` honours
`.gitignore`, so this is only sane when `root` gitignores everything that is not the code
change. The design never states that assumption. Two concrete failures:

1. **E2e feasibility (fresh lens).** The Testing Strategy e2e is "one temp dir is both
   roots; gitInit; `.spec-workflow/agent-rules.md` …; commit `C0` adds `src/auth.ts`."
   Nothing gitignores or commits the spec store. So every gated case's baseRef diff picks
   up `.spec-workflow/agent-rules.md`, `adversarial-settings.json`, `tasks.md`, the
   implementation logs and the gate's own recorded review as untracked files. They enter
   `data.touched` and `data.stats.filesChanged`/line counts. Case 1's `low` and
   `reviewCoverage.reviewed === 3` then hold only while the accumulating store stays under
   200 lines — a fixture-fragile pass, and `data.touched` is semantically wrong (the store
   is not the code change). The fixture must gitignore `.spec-workflow` (verified: this repo
   ships `.spec-workflow` in `.gitignore` and tracks zero store files, which is why the real
   flow works — but the e2e recreates a bare repo without that line).
2. **Real-flow robustness.** The harness calls the gate with a real `baseRef` on every task
   (D3/6.1) — the primary path, which the D17 ruling's HEAD-fallback rationale never
   covered. In any project that leaves a large untracked/unignored tree under `root`
   (a non-ignored spec store, generated output, a scratch dir), the line-count rule b sees
   it and forces `risk: high` on every task, spawning the verifier every time and defeating
   the "about a third fewer tokens" goal that justifies the whole spec.

Fix: state that the gate scores the code change only, that `root` must gitignore the spec
store and generated artifacts, and add the `.gitignore` step (or commit the store before
`C0`) to the e2e fixture.

### R2-3 — MINOR — D13's new file creates a circular import back into `review-task.ts` (Novel)

D13 puts `handleGate` in a new `src/tools/review-gate.ts`, but step 5 reuses
`computeTypecheckMethodologyState` and `unwrapTypecheck`/`unwrapHygiene`/`unwrapDiff`
(`src/tools/review-task.ts:54-73`, `:79-113`), while Component 1 makes `review-task.ts`
import `handleGate` from `review-gate.ts`. That is a `review-task ↔ review-gate` import
cycle. It is benign (all references are call-time functions, so ESM resolves it), but the
design does not acknowledge it; a future top-level use of either export would break load
order. Either note it, or re-home the shared `unwrap*`/`compute*` helpers in a neutral
module.

## Top 3 risks/gaps

1. Commit-mode and ls-files `touched` entries are C-quoted while baseRef-tracked entries are
   raw (R2-1): sensitive-path false negatives and spurious `file-outside-list` for
   non-ASCII/special paths, on close-out's primary (`commit`) path.
2. baseRef untracked inclusion pollutes `touched`/`stats` with any non-ignored file under
   `root` (R2-2): a fixture-fragile e2e and, in a project without a clean gitignore, all
   tasks forced high — the token goal lost.
3. `review-task ↔ review-gate` import cycle from D13 (R2-3): benign now, unacknowledged.

## Top 3 conclusions to challenge

1. **"correct for a merge, an ordinary and a root commit — R1-1" (design.md:81).** Correct
   for the *counts*, but the command silently regressed the path encoding by dropping
   `core.quotePath=false`; `touched` is no longer encoding-consistent with the baseRef diff.
2. **The e2e as written ("commit C0 adds src/auth.ts", design.md:213).** Challenge: without
   gitignoring the spec store, the baseRef diff counts the store's own files; the asserted
   `low`/coverage outcomes are fixture-fragile and `touched` is polluted.
3. **D13 "byte-pinned review-task.ts changes only in schema and dispatch."** True for
   review-task.ts, but the split forces a back-import cycle the design does not name.

## What's missing before acting

- Add `-c core.quotePath=false` to the commit-mode `git log` and the `git ls-files`
  invocations (or unquote `touched`), so every producer of `touched` uses one encoding.
- State the gate's environmental assumption (scores the code change; `root` must ignore the
  spec store and generated artifacts) and add the `.gitignore` step to the e2e fixture.
- Acknowledge (or design out) the `review-task ↔ review-gate` import cycle.

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
