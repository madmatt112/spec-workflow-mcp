# Adversarial Analysis — tdd-task-loop/design (v1), round 1

Directive review. Attack surface: feasibility, consistency, edge cases. Fresh lens:
wire contracts across producer→consumer boundaries. No prior version exists (diff
empty), so this is a first-pass ground-up read. Every cited artifact below was read
at both ends of its range.

## What was checked and how

- Read the target design, the requirements (v4), the decomposition entry for
  `tdd-task-loop`, `agent-rules.md`, and the drafter-written `codebase-context.md`.
- Confirmed each design citation against the code: `task-parser.ts` (108-128, 279-332,
  365-385), `check-runner.ts` (1-104), `gate-rules.ts` (79-99, 192-198, 280-365,
  396-454), `task-diff.ts` (69-86), `git-utils.ts` (45-51), `review-gate.ts` (47-70,
  102-106, 160-368), `review-task.ts` (245-312), `harness.ts` (480-538, 600-689),
  `task-review-manager.ts` (71-313), `types.ts` (253-263), `spec-status.ts` (175-225),
  `multi-server.ts` (1928-1988), `TasksPage.tsx` (515-524, 1364-1406),
  `agent-profiles.test.ts` (1-53), `sync-plugin-assets.cjs` (85-134), `lint-tasks.ts`
  (274-298), `lint-types.ts` (1-63), `spec-lint.ts` (155-187), `typecheck.ts` (238-243),
  the two research docs (jev 32-54/310-337, tdd 340-356), SDD-HARNESS.md (18-23,
  309-321) and `sdd-implementer.md` (1-12).
- Ran the count-word grep the design prescribes to test it against reality.

Result: **every code citation in the design and context file is accurate** — paths,
line ranges, signatures and described behaviour all match. `runGit`/`GitRun` are
correctly described as *currently private, to be exported* (D10), not as already
exported. Spec 12's `## Code graph` machinery is already merged in `harness.ts`
(600-689), matching the build order. This is an unusually well-grounded document; the
findings below are gaps in unstated wires and one prescribed command, not misstatements.

## Re-decided literal ruling (required by the round prompt)

**R3 AC4 — `redTests` is an optional key defaulting to `''`.** Ruling: **refinement
(closed).** Requirements v3 R2-2 already fixed that the implementer slot is "filled for
every task and empty when unmarked" and that "an empty string passes the required
check." Design D3 + Component 5 (`OPTIONAL_BRIEF_KEYS = new Set(['redTests'])`,
default `''` before the missing-value check at `harness.ts:661-675`) is the *mechanism*
for that decided behaviour, not a widening. It preserves the title-only implementer
calls at `harness.test.ts:170-172` and `247-253`, which the requirement already
promised keep passing. No new latitude is introduced.

## Attack topics and directive bullets

### 1. The Jev judge wire (Component 11, Data Models `JudgeAnswers`/`JudgeResult`)

- Challenge the claim that the judge's *response* shape is settled. The cited source
  `jev-integration-research.md:38-42` shows `answers: { "<id>": { ... } }` — the inner
  answer object is a literal placeholder. The design flags only the *outbound*
  score-question `criteria` form as unprobed; it presents the *inbound* per-question
  numeric answer (`tautological` 0..1, `asserts_criteria` 0..2) as known.
- Stress-test the fail-open story against the spec's own verification. Fail-open means
  a wrong wire yields `judged: null` silently — but R9 AC3 requires "one `judge` event
  … when a key is set" and R7 AC7 requires `judged` to carry the four answers. If the
  inner-answer extraction is guessed wrong, both never fire and the entire "Jev in
  shadow" deliverable produces zero data — the data whose purpose is to set a later
  spec's thresholds.
- Challenge "the implementing task copies it from those docs" (Component 11). The docs
  do not contain the concrete score-question `criteria` JSON *or* the answer-object
  fields — both are ellipses. There is no source to copy from, and TypeSafe is
  early-access (jev doc 1.4), so no key is available to probe either.

### 2. Count-word maintenance (Component 13, R8 AC1-2)

- Stress-test the prescribed command `grep -rn -i twelve scripts src docs harness`
  against the tree. It is both over- and under-inclusive (evidence below).
- Challenge whether R8 AC2's "count word updated" for the worker list is reachable
  through the stated mechanism: the word is "Eight" (`SDD-HARNESS.md:21`), which the
  grep never surfaces.

### 3. The gate→proof→block seam (Components 7-9)

- Stress-test where the gate obtains `tests[]` (with seams) to build `data.tdd.seams`
  and the judge's `testLines`. The `tdd` argument carries only `testFiles` + `redCommit`.
- Stress-test `saveReview`'s new unconditional sidecar read as a shared method used by
  every spec/task.
- Challenge the reuse of the design-defect stop for an author `SEAM-DEFECT`.

## Findings

### R1-1 — Inbound judge answer wire is unprobed and unflagged (SHOULD_FIX)

The design flags the outbound score-question `criteria` form as unprobed (Scope notes:
"Not probed: the judge's score-question wire form … a mismatch takes the fail-open
path"). But the *inbound* wire — how `judge.ts` reads each question's number out of
`answers["<id>"]` — is equally undefined and is presented as settled in Data Models
(`JudgeAnswers`). The cited doc (`jev-integration-research.md:38-42`) shows only
`answers: { "<id>": { ... } }`. Because the judge is shadow + fail-open, a wrong guess
does not crash; it silently returns `null` forever, so **R9 AC3 ("one `judge` event …
when a key is set") and R7 AC7 can never pass**, and the spec's sole purpose for Jev —
gathering shadow data to set later thresholds — yields nothing. Fix: flag the
answer-extraction shape as unprobed alongside the criteria form, and state the
implementing task must confirm both against a live key or the `@typesafe-ai/sdk` types
(jev doc 1.3 says the SDK "infer[s] the answer shape from the questions") before any
judge event is treated as evidence.

### R1-2 — Prescribed count-word command is unreliable (SHOULD_FIX)

Component 13 says "the count words follow (`grep -rn -i twelve scripts src docs
harness`)". Running it returns three hits:
- `scripts/sync-plugin-assets.cjs:91` — "the twelve agent frontmatters" (should change)
- `src/__tests__/agent-profiles.test.ts:6` — "the twelve agent frontmatters" (should change)
- `docs/SDD-HARNESS.md:133` — "More than **twelve spawns** for one class" (a budget
  figure that must **not** change to thirteen — false positive)

Meanwhile the worker-count word R8 AC2 requires updated is "**Eight** worker agents"
(`SDD-HARNESS.md:21`), which `grep twelve` never finds; nor does it find the numeral
`12` in the profile-test assertion or the `it()` label "the other nine". `agent-rules.md`
("gives the command that finds every member") is not satisfied. Relying on this command
risks a wrong edit (line 133) and a missed one (line 21 → R8 AC2 unmet). Fix: give a
command that targets the members that actually change (e.g. an alternation over
`eight|nine|twelve|thirteen` plus the `12`/`13` numerals in the test) and name the
false positive to leave alone.

### R1-3 — `classifyRed` misclassification risk in shadow data (MINOR)

`classifyRed` scans the combined stdout+stderr for the four structural markers and
downgrades to `structural-red` if any appears. A genuine assertion failure whose diff
or asserted error message contains e.g. "is not a function" (plausible when a test
asserts on an error string) records `structural-red`, inflating risk and the dashboard
line and skewing the very shadow measurement the spec collects. Direction is safe (only
raises risk, never fails or lowers). The marker list and "classify full stdout+stderr"
are fixed by R4 AC9 (closed over three rounds), so this is noted as an inherited
data-quality risk, not a re-opening of that rule.

### R1-4 — Gate's source of `seams`/`testLines` left implicit (MINOR)

`data.tdd.seams` (R4 AC13) and the judge's `testLines` (Component 11) come from the
parsed task's `tests[]`, but the `tdd` argument carries only `testFiles`+`redCommit`.
The gate must re-parse `tasks.md` for `tests[]` (it already parses it at
`review-gate.ts:161`). Component 8 never states this step. Implementable, but a
task-writer could miss it. State the re-parse and the `testFiles`→`tests[]` match.

### R1-5 — Design-defect stop wording assumes the implementer (MINOR)

The reused stop (`SKILL.md:209-216`) reports `REASON: <the defect … from the
implementer's flag>`. Component 12 routes an author `SEAM-DEFECT` (and full
`RED-IMPOSSIBLE`) through it "with no implementer", so the reason must be sourced from
the *author's* flag. The design does not note this wording adjustment.

### R1-6 — Stale per-task `.tdd-<id>.json` sidecar could mis-attach (MINOR)

Component 9 makes `saveReview` attach the sidecar to any review "when either exists".
If `tasks.md` is edited mid-spec so a previously-marked task id becomes unmarked, a
lingering sidecar would attach a stale `tdd` block to the unmarked task's next review
(and count it in `tddCoverage`). Rare, but the sidecar has no run/commit stamp to guard
against it.

## Top 5 risks/gaps

1. **Jev produces no shadow data** (R1-1). The inbound answer wire is unspecified and
   unprobeable pre-key; fail-open converts that into silent `null`s, so R9 AC3/R7 AC7
   quietly fail and the deliverable's purpose is unmet.
2. **Doc/count drift ships** (R1-2). The prescribed grep both misfires and misses,
   leaving "Eight worker agents" stale (R8 AC2) or corrupting the "twelve spawns"
   budget line.
3. **Shadow-measurement noise** (R1-3). Assertion failures with structural substrings
   record as `structural-red`, biasing the first spec's data.
4. **Implicit gate re-parse** (R1-4). The seam/testLines wire is real but unstated.
5. **Sidecar lifecycle** (R1-6). No stamp guards a stale per-task proof file.

## Top 3 conclusions to challenge or reverse

1. **"a mismatch takes the fail-open path" (Scope notes) is sufficient for Jev.**
   Reverse: fail-open protects the *gate verdict*, but it does not protect the Jev
   *deliverable* or its verification (R9 AC3). Treat the judge as unverifiable in this
   spec unless a key + wire confirmation is in scope, or explicitly move the judge event
   out of the closing verification's required set.
2. **"the implementing task copies it from those docs" (Component 11).** Challenge:
   the docs hold placeholders, not the concrete criteria/answer JSON, so nothing is
   copyable; the task will guess. Name the SDK types as the real source of truth or
   accept `judged: null` for the whole spec.
3. **"the count words follow (grep … twelve …)" (Component 13).** Reverse: the command
   does not enumerate the members; the enumerated prose ("nine workers", "12→13",
   "other nine→ten") is the reliable part and the grep should be corrected or dropped.

## What's missing (do before acting)

- A stated, sourced answer-extraction contract for `judge.ts` (which field of
  `answers["<id>"]` holds the number for a noul vs a score question), plus a decision on
  whether a live-key wire check is in scope for this spec or deferred with the judge
  event dropped from R9 AC3's required set.
- A corrected count-word find command and an explicit "do not change line 133" note.
- One sentence in Component 8 pinning the gate's `tasks.md` re-parse for `tests[]` and
  the `testFiles`→`seams` match.
- A note that the design-defect stop's reason text is author-sourced on the
  `SEAM-DEFECT` path.

## Notes for the record

- Data Models completeness: satisfied. Every requirement-referenced result object
  (`TddBlock`, `TddCoverage`, `JudgeResult`, `JudgeAnswers`, `JudgeInput`, `ProofResult`,
  `TddArgs`, `TaskTest`) has enumerated fields; `GateData` is an existing object extended
  additively, not given via union arms. No MUST_FIX there.
- Data egress: sending this public repo's test files + criteria to TypeSafe is a closed
  requirements decision (D3) and the DPA/consent question is already an open gate-A item
  in the decomposition (open (c)); no new escalation.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 4
DESIGN_READY: no
ESCALATE: none
```
