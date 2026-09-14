# Adversarial Analysis — review-gate/requirements (v3)

Round: R3. Primary lens: completeness, ambiguity, scope. Fresh lens this round: the
cost of touching an existing component — for every existing artifact the document says
changes, its tests, fixtures, callers, and whether Requirement 8's "SHALL NOT change"
list stays consistent with what Requirements 1–7 and 9 actually require. Attack order:
the v3 deltas first, then the fresh lens.

## Delta verification (attacked first)

The v3 Revision History records five round-2 dispositions (R2-1 MUST_FIX and R2-2..R2-5),
all accepted. I re-read both ends of every citation the v3 delta added or moved.

- **AC 1.3 / 1.6 `src/tools/review-task.ts:45-52` — citation correct.** 45-52 is the
  `TypecheckMethodologyState` union (7 members, `success-clean-full` … `timeout`). The
  document's "new `{ kind: 'skipped' }` … added at 45-52" is a genuine extension of this
  union. Accurate as a pointer — but the extension has an unnamed cost (R3-1).
- **AC 1.2 R2-1 fix — matches the code.** `runProjectTypecheck(workspacePath,
  workflowRoot, allFiles, {enabled})` (`typecheck.ts:124-140`): the first arg "governs
  every root use that determines which tree tsc sees" (130), the second "owns the cache
  directory and the `.gitignore` entry" (137). `review-task.ts:437-439` confirms diff and
  typecheck compile the workspace; the workflow root "owns only the shared cache directory
  and the `.gitignore` entry". AC 1.2's "`root` is the pre-computations' working tree; the
  workflow root stays `runProjectTypecheck`'s second argument" is now consistent with 1.3.
  **R2-1 resolved.**
- **AC 1.3 `:431-449` / `:440-449` — correct.** 431 loads settings; 440-449 is the
  `Promise.allSettled` of typecheck+hygiene+diff and the three unwraps. The v3 rewording
  ("the two `prepare` runs today" = typecheck/hygiene; diff = a new range function)
  matches. **R2-5(a) resolved.**
- **AC 6.3 terminus / AC 6.5 rule (`sdd-verifier.md:26`) — checked, clean.** Line 26 is
  scoped `"For a task review:"`; the end-to-end rule is a *separate* standing bullet at
  line 28 ("run the scenario and every check in the suite … Do not skip one because
  per-task reviews passed"). The AC 6.5 rewrite of line 26 therefore does **not** leak
  into the completion-gate / E2E verifier (AC 6.8). The memory's open worry for the R2-3
  fix is cleared.
- **AC 7.6 `SKILL.md:121-124`, `references/briefs.md:112-138` — correct.** 121-124 is the
  close-out Verify step; 112-138 is the close-out Verify brief ("run the checks listed",
  123). The R2-4 conditional-spawn clause is present. **R2-4 resolved.**
- **AC 9.2 typecheck posture — pinned.** "typecheck `feature-disabled` in the fixture" is
  now stated. **R2-5(b) resolved** — but a different clause in the same AC is unreachable
  (R3-2).
- **`root-selection.ts:202-209`, `typecheck.ts:124-140` — signatures/behaviour as cited.**

No misstated artifact in the v3 delta. As in R2, the delta citations are accurate; the
live issues are cross-AC consistency and the cost of touching shared code.

## Attack topics and directives

### Topic A — Extending `TypecheckMethodologyState` (AC 1.3/1.6) vs the "methodology SHALL NOT change" claim (AC 8.1)
- Challenge AC 1.3's instruction to add `{ kind: 'skipped' }` at `review-task.ts:45-52`:
  the union has one exhaustive consumer with an explicit return type.
- Stress-test `renderTypecheckDirective` (`:793-810`): a `switch (state.kind)` with 7
  cases, no `default`, no trailing return, declared `: string | null`, under
  `tsconfig strict: true`, compiled by the `build` script's `tsc`.
- Force AC 8.1 (or 1.3) to name the `renderTypecheckDirective` edit, or to specify a
  distinct `data.typecheck` type that does not extend the shared union.

### Topic B — The end-to-end fixture's coverage assertion (AC 9.2)
- Challenge "spec-status reports all three reviewed once completed" against the recording
  lattice: only pass+low+task records (AC 5.1).
- Stress-test case (2) sensitive-path⇒high: AC 5.2 records nothing; case (3) fail: AC 4.5
  records nothing and AC 9.2 itself says "no review file exists".
- Force the fixture to state how tasks 2 and 3 acquire reviews before the spec-status
  assertion, or scope that assertion to task 1.

### Topic C — The terminus brief edit location (AC 6.3)
- Challenge that AC 6.3 gives the terminus instruction a home: the narrow-verify brief is
  a distinct template (`briefs.md:133-137`) outside AC 6.5's cited 112-131 range.

## Findings

### R3-1 — SHOULD_FIX — Adding `{ kind: 'skipped' }` to the shared union breaks `renderTypecheckDirective`, an edit the document never names — Novel
AC 1.3 requires `data.typecheck` on the files-only path to be "a new `{ kind: 'skipped' }`
(added at `src/tools/review-task.ts:45-52`)", and AC 1.6 types `data.typecheck` as "the
methodology state kind, `src/tools/review-task.ts:45-52`". Lines 45-52 are the
`TypecheckMethodologyState` union. That union has exactly one exhaustive consumer:
`renderTypecheckDirective(state: TypecheckMethodologyState): string | null`
(`src/tools/review-task.ts:793-810`) — a `switch (state.kind)` over all 7 current members,
**no `default`, no trailing return**. `tsconfig.json` sets `strict: true`, and the
`build` script runs `tsc`. Add an 8th member and the switch stops being exhaustive: the
`skipped` path falls through to the end of a function whose declared return type excludes
`undefined`, so `tsc` fails with TS2366 ("Function lacks ending return statement and
return type does not include 'undefined'"). The build goes red on the first push, directly
against Requirement 9's user story ("so that the PR is green on the first push"). AC 8.1
pins "the methodology text and its byte-pinned constants (`:743-791`) SHALL NOT change" —
true for 743-791, but it lulls the implementer into thinking the methodology code is
untouched, when the union extension forces a one-line edit in the switch at 793-810 that
no AC names. (The existing drift tests are safe — `FIXTURE_INPUTS`/`buildReviewMethodology`
are keyed by filename and never feed `skipped`, and `computeTypecheckMethodologyState`
never produces it — so only the compile step breaks.) **Fix:** add to AC 8.1 (or AC 1.3)
that `renderTypecheckDirective` (`:793-810`) gains `case 'skipped' ⇒ null`; or specify
`data.typecheck` uses `TypecheckMethodologyState | { kind: 'skipped' }` at the gate
response boundary and does **not** extend the shared union at 45-52 (then no methodology
code is touched at all — cleaner). The doc is at the 3,500 cap: reclaim ~15 words by
trimming a decision rationale, e.g. D10's tail ("the typecheck cache and test runners
collide together", 8 words) or D11's tail ("a no-op change is not a mechanical defect an
implementer can fix", 12 words).

### R3-2 — SHOULD_FIX — AC 9.2's "spec-status reports all three reviewed once completed" is unreachable for the high-risk and fail tasks from the gate alone — Novel
`spec-status` review coverage (`src/tools/spec-status.ts:184-191`) counts a completed task
as reviewed only when `getLatestReview(task.id)` returns non-null — i.e. a review file
exists. The gate records a review only for pass+low+task (AC 5.1). Walk the three fixture
cases AC 9.2 defines:
- (1) Markdown-only edit ⇒ pass, low ⇒ records `reviewer: gate`. Reviewed. ✓
- (2) touching the sensitive path ⇒ high ⇒ AC 5.2 "the gate SHALL record nothing". No file.
- (3) failing check ⇒ gate fail ⇒ AC 4.5/5.1 record nothing, and AC 9.2 itself asserts
  "no review file exists".
So for spec-status to report tasks 2 and 3 as reviewed, the fixture must create reviews
for them by other means — a verifier-style `prepare`+`record` for the high-risk task 2,
and (for task 3) fixing the check, re-gating to pass, then recording — none of which AC 9.2
states. As written the AC asks the test to assert both "no review file exists" / "high"
only (cases 2–3) **and** "all three reviewed once completed"; those cannot both hold from
the gate. An implementer either writes a test that cannot pass or silently invents the
missing verifier-record steps, diverging from the spec. **Fix:** state that the fixture
records verifier reviews (`prepare`+`record`) for the high-risk and post-fix tasks before
the coverage assertion, or scope the coverage assertion to the gate-reviewed task only.

### R3-3 — MINOR — The terminus brief edit (AC 6.3) has no cited template location — Compounding (on R2-3)
AC 6.3's v3 clause requires the terminus narrow verifier's brief to "tell the verifier to
re-run the checks that were failing when the terminus fired". The narrow-verify brief is a
distinct template — `harness/skills/sdd-implementation-phase/references/briefs.md:133-137`
("Verify only the findings listed below … Record the review the same way") — which sits
outside AC 6.5's cited edit range (`briefs.md:112-131`). No AC cites 133-137, so the
implementer must infer where the "re-run the failing checks" line lands. Low cost (6.3
states the behaviour), but the same "behaviour described, edit not named" asymmetry the
memory has flagged three times. **Fix:** cite `briefs.md:133-137` in AC 6.3.

## Fresh-lens result — cost of touching existing components (checked clean)

For each existing artifact the document changes, I found its tests/callers and confirmed
the document is consistent, except where noted above:

- **`review-task` tool + schema** (`:152-230`): adds `gate` to the enum and five args. No
  test snapshots `inputSchema` or the `enum`/`required` arrays (`review-task.test.ts` uses
  targeted `action:'prepare'|'record'` calls). Non-breaking.
- **`TypecheckMethodologyState`** (`:45-52`): the one cost is R3-1.
- **`TaskReview` + `reviewer`** (`types.ts:253-262`, `task-review-manager.ts:185-234`
  serializer, `236-311` parser): the existing `task-review-manager.test.ts` asserts
  frontmatter with `toContain` (not exact-block or `toEqual`) and already has a
  `classification` round-trip + backward-compat precedent (lines 207-264), so adding an
  optional field and a `reviewer:` frontmatter line breaks no existing test. `get-task-review`
  returns the whole `review` object (`:106,129`), so `reviewer` travels automatically; the
  test asserts named fields only. Consistent.
- **`spec-status` reviewed derivation** (`:179-193`): unchanged; a gate-recorded review is
  a normal file `getLatestReview` finds. Accurate — but see R3-2 for the fixture's misuse.
- **Dashboard review endpoints** (`multi-server.ts:1913-1944`): both go through
  `TaskReviewManager`; the version endpoint returns the full `review` (1940). Consistent
  with AC 5.5.
- **Dashboard runner** (`task-review-runner.ts:164-177`): calls `prepare` only, unchanged.
  AC 8.1 accurate.
- **Two skills + brief templates, `sdd-verifier.md`**: line-26 vs line-28 scoping makes
  the AC 6.5 rewrite safe for E2E (see delta section). `harness/`→`plugins/` copy (AC 9.4)
  is a generated mirror; consistent.

Requirement 8's "SHALL NOT change" list is consistent with Requirements 1–7/9 **except**
that extending the union at 45-52 forces the switch edit at 793-810 that 8.1's framing
implies stays put (R3-1).

## Top 3 risks / gaps

1. **R3-1** — the build is red on the first push: the document's own instruction (extend
   the union at 45-52) breaks the exhaustive `renderTypecheckDirective` switch at 793-810,
   an edit no AC names. Defeats Requirement 9's whole purpose.
2. **R3-2** — the one end-to-end acceptance test cannot be written to pass as specified:
   "all three reviewed" requires review files the gate never creates for the high-risk and
   fail tasks.
3. **Standing (unchanged from R2 #5):** a resumed `[-]` task has no `baseRef` and is forced
   to `risk: high` (6.1/3.1f); every interruption spends a verifier against the baseline.

## Top 3 conclusions to challenge or reverse

1. AC 8.1's implied conclusion that the methodology code stays untouched. Reverse:
   extending `TypecheckMethodologyState` forces `renderTypecheckDirective` (793-810) to
   gain a case, or the type must not be shared.
2. AC 9.2's conclusion that the fixture proves review coverage. Challenge: it proves
   coverage only for the pass+low task; cases 2 and 3 leave no review, so "all three
   reviewed" needs steps the AC omits.
3. AC 6.3's implicit conclusion that the terminus instruction has an obvious home.
   Challenge: it lands in `briefs.md:133-137`, which no AC cites.

## What's missing (do before acting on this document)

- Name the `renderTypecheckDirective` (`:793-810`) edit, or make `data.typecheck` a
  distinct type that does not extend the union at 45-52 (R3-1).
- State how the AC 9.2 fixture records reviews for the high-risk and fail tasks before
  asserting "all three reviewed", or scope the assertion to task 1 (R3-2).
- Cite `briefs.md:133-137` in AC 6.3 (R3-3).

## Word budget note

The document is at 3,500/3,500 words (verified with `wc -w`). R3-1 and R3-3 each need a
clause. Cut source: a decision rationale tail — D10 ("the typecheck cache and test runners
collide together") or D11 ("a no-op change is not a mechanical defect an implementer can
fix"); the decision itself survives without its justification. R3-2's fix can replace an
existing clause in AC 9.2 rather than add words.

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
