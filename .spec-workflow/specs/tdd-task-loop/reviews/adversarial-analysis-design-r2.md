# Adversarial Analysis — tdd-task-loop/design (v2), round 2

Directive review. Attack surface: feasibility, consistency, edge cases. Deltas since
v1 attacked first, then the fresh lens: the solo implementer holding only this design
and the code it cites, checking every producer→consumer shape the design must pin on
both sides. Every cited artifact below was read at both ends of its range.

## What was checked and how

- Read the v1→v2 diff and the lint commit from the round prompt, the memory file, and
  the round-1 analysis. The v2 deltas are the six R1 responses plus a lint trim of one
  Overview sentence (no citation moved).
- Re-verified every claim the v2 delta wrote against code:
  - **R1-4 fix (Component 8 step 3 + Reuses).** `src/tools/review-gate.ts:161` is
    `const task = parseTasksFromMarkdown(tasksContent).tasks.find((t) => t.id === taskId)`
    — the parse is already run and `task` is in scope for the whole handler, so step 3
    reads `task.tests` with no re-parse. Reuses `161-186 (tasks parse, task find and
    mode)` is accurate.
  - **R1-5 fix (Component 12).** `harness/skills/sdd-implementation-phase/SKILL.md:209-216`
    is the "Design defect" stop; line 215-216 reads `REASON: <the defect, one line, from
    the implementer's flag>`. The design's note that the author `SEAM-DEFECT` path must
    source the reason from the author's flag is correct and the citation is exact.
  - **R1-1 fix (Component 11 + Scope notes).** `docs/jev-integration-research.md:38-42`
    shows `criteria: ...` (outbound placeholder) and `answers: { "<id>": { ... } }`
    (inbound placeholder); line 45-46 documents `@typesafe-ai/sdk` (Node 20+, "TypeScript
    types infer the answer shape from the questions"). The "jev doc 1.3" citation is
    accurate.
  - **R1-2 fix (Component 13).** Ran the prescribed find command verbatim. It returns
    seven hits: `sync-plugin-assets.cjs:91`, `agent-profiles.test.ts:6/23/24/39`,
    `SDD-HARNESS.md:21`, `SDD-HARNESS.md:133`. Six are real edits (including
    `SDD-HARNESS.md:21` "Eight **worker** agents", matched by the `worker\*\* agents`
    pattern) and `SDD-HARNESS.md:133` "twelve spawns" is the one false positive the design
    names to leave. The count and the named false positive are both correct.
  - **Error Handling 5 (R1-6 fix)** matches D2/Component 9: the stale-sidecar mis-attach
    is recorded as an accepted limitation, no run stamp added.
- Fresh lens — the four producer→consumer seams the round prompt named:
  - `TaskTest {path,seam}` → `data.tdd.seams: Record<string,string>` and
    `JudgeInput.testLines: TaskTest[]`. Pinned: gate matches `tests[]` to `testFiles` by
    path; `seams[path]=seam`; no key when unmatched. Both consumers take `TaskTest[]`.
  - `TddBlock` → review markdown fence → back out. Writer does `JSON.stringify(block)` in
    a `json` fence; parser does `JSON.parse`. Symmetric. Verified `parseReviewMarkdown`
    (`task-review-manager.ts:237-313`) still parses frontmatter/summary/findings
    unchanged: the appended `## TDD proof` is absorbed into the last finding's block but
    matches none of the `- **Issue:/File:/…**` field patterns, so findings are intact.
  - `data.tdd` → routes → dashboard row. List/version/summary routes
    (`multi-server.ts:1931-1988`); summary reads `loadAllReviews()` (markdown only), so
    `tdd` is present once `saveReview` attaches the sidecar (D2's high-risk path).
    `TasksPage.tsx:521` state `{verdict,version}` gains `tdd`; the row reads
    `base/head/amended/testFiles.length`, all TddBlock fields. Consistent.
  - `ProofResult.redText: Record<string,string>` → `JudgeInput.redText` → `state.test_files`.
    Identical type; pinned.
- Data Models completeness: unchanged from round 1 — every requirement-referenced result
  object (`TddBlock`, `TddCoverage`, `JudgeResult`, `JudgeAnswers`, `JudgeInput`,
  `ProofResult`, `TddArgs`, `TaskTest`) has enumerated fields; `GateData` is extended
  additively. No object given only through union arms.
- Library-capability lens: the only new API claim is `@typesafe-ai/sdk` types inferring
  the answer shape — cited to and backed by jev doc 1.3, and offered only as a
  confirmation *source* for the implementing task (with a live key as the alternative),
  not asserted as settled behaviour carried into implementation. judge.ts still uses "no
  SDK" at runtime, which is not in tension with inspecting the package's types at dev
  time.

## Delta verdict

All six R1 responses are substantive and every v2 claim is grounded. The two R1
SHOULD_FIX items are resolved, not merely reworded:

- **R1-1 (inbound Jev wire).** The v2 flag is honest and sufficient. The design no
  longer presents the answer extraction as settled; it flags both wires as
  placeholder-only in the docs, names a real keyless confirmation source (the published
  SDK types) plus a live-key alternative, and gates the R9 AC3 judge event behind that
  confirmation. This is exactly the accepted resolution. Not recurring.
- **R1-2 (count-word command).** The new command is member-complete: it surfaces all six
  edits and isolates the single false positive by line. Verified by execution. Resolved.

No fix-induced claim error was found in the v2 delta.

## Findings

### R2-1 — `testFiles`↔`tests[]` match does not pin path form (MINOR, Compounding R1-4)

Component 8 step 3 matches the parsed task's `tests[]` to the gate's `testFiles` "by
path" to build `data.tdd.seams` and the judge's `testLines`. Neither the design nor
`parseTestLine` pins a normalization (relative vs. absolute, leading `./`) shared by the
tasks.md `- Test:` path and the `testFiles` the skill passes at gate time (Component 12
step 4). If the two path strings differ, the match silently yields no `seams` key and an
empty `testLines`, so the dashboard shows `0 file(s)` seams and the judge loses its
per-test seam context — a quiet degradation, not a crash (fail-open direction). One skill
authors both sides, so the realistic risk is low; a one-clause note that both use the
tasks.md path string verbatim would close it. Does not keep the loop alive.

## Top risks/gaps (short doc)

1. Only the MINOR path-form under-pin (R2-1) remains, and it degrades gracefully. No
   MUST_FIX or SHOULD_FIX stands after the v2 responses.
2. The Jev deliverable is now correctly conditional (judge event counts toward R9 AC3
   only after Component 11's confirmation). If neither a live key nor the SDK types are
   reachable in-spec, that scenario stays shadow-only — which the design and requirements
   already accept.
3. No open cross-artifact seam: all four producer→consumer shapes are pinned on both
   ends and verified against code.

## Conclusions challenged

- Round 1's two SHOULD_FIX conclusions (inbound wire unflagged; grep unreliable) are both
  reversed by verified v2 text — no residual to escalate.
- The "Not probed" scope note is now sufficient for the Jev deliverable, because it moves
  the judge event out of R9 AC3's unconditional set rather than relying on fail-open to
  satisfy verification.

## What's missing (optional, before acting)

- One clause in Component 8 (or Component 1) stating the `testFiles`↔`tests[]` match uses
  the tasks.md `- Test:` path string verbatim (R2-1). Not blocking.

## Notes for the record

- Rulings left closed and not re-opened: R4 AC9 classification rule; R3 AC4 `redTests`
  optional-default refinement.
- Data egress remains a closed requirements decision with an existing open gate-A item;
  no new escalation.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
