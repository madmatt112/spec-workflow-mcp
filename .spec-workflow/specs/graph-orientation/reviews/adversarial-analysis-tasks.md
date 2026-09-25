# Adversarial Analysis — graph-orientation/tasks (v1), Round 1

Attack surface: atomicity, ordering, coverage. Fresh lens: the sub-agent that
receives only the task prompt (self-containment, cross-task pins, assertion-update
completeness, checkable completion criteria; intra-document artefact shape).

First review of the tasks document. The `## Changes since` delta was the v1 lint
pass, which only widened four bare-filename citations to full paths (tasks 5, 6, 7,
9) and left every line number unchanged. All four re-verified below. The document has
already survived three requirements adversarial rounds and a lint pass; this analysis
found no MUST_FIX and no SHOULD_FIX.

## What I checked and how

### Changed citations (the v1 lint delta) — all correct
- Task 5: `harness/skills/sdd-continue/references/formats.md:194` — line 194 is the
  `run.start` ledger-key row. Correct anchor for adding `graph`, `graphBehind`.
- Task 6: `harness/skills/sdd-document-phase/references/briefs.md` (two uses) — the
  `## Codebase context` text is at :50-59, the round-section fence at :141-208, the
  narrow-check fence at :390-409. Ranges resolve.
- Task 7: `docs/TOOLS-REFERENCE.md:566-568` is the `brief` bullet, `:574-579` the
  `usage` bullet, `:551-553` the "five actions" statement; `docs/SDD-HARNESS.md:253-264`
  is `## Workspace contract`. All correct.
- Task 9: `harness/skills/sdd-implementation-phase/references/briefs.md:12-15` — the
  "a `cd` inside a script … is how commits into the spec store are made" pattern.
  Correct anchor for the scratch-dir commit script.

### L-1 through L-24 (citation-identifier warning on line 35) — rejection upheld
The lint flagged that the identifiers named earlier in task 3's `_Prompt` (`UsageCell`,
`emptyCell`, `addCell`, `windowPhase`, `reduceSpawn`, `isGraphCall`, `applyGraphCounts`,
`cmpPhase`) do not appear at the two cited assertion lines. Verified both cited lines:
`src/watch/__tests__/usage.test.ts:333` is the compare-table header assertion and
`src/tools/__tests__/harness.test.ts:533` is the `res.data.report.total` full-cell
`toEqual` literal — i.e. exactly the assertions the task must update, cited as such.
The identifiers are covered by the task's `_Leverage` (usage.ts:13-34 for `UsageCell`,
:75-92 for `emptyCell`/`addCell`, :283-292 for the window loop, :106-111 for `cmpPhase`).
The rule conflated an assertion-to-update citation with an identifier-definition
citation. The rejection is correct; not re-opened.

### Coverage — every design component and every requirement AC maps to a task
- Components: C1→T1, C3→T2, C5→T3+T4, C2→T5, C4→T6+T7, C6→T8, C7→T9, in-loop
  scenarios→T10. All seven mapped (tasks.md:4).
- Requirement ACs, traced one by one: R1 1.1-1.8 (T1/T5), R2 2.1-2.7 (T1/T5/T7),
  R3 3.1-3.8 (T2), R4 4.1-4.5 (T6/T7), R5 5.1-5.4 (T6), R6 6.1-6.8 (T3/T4),
  R7 7.1-7.4 (T8/T9/T10). No AC is unclaimed; no task claims an AC outside its scope.

### Ordering and intra-document artefact shape — no dangling bridge or stub
- T2 exports `codeGraphSection`; T6 (later) calls it. T3 exports `applyGraphCounts`;
  T4 (later) wires it into `usageAction`. T1 writes `sdd-graph.sh`; T5 (later) copies
  it; T7 (later) runs the scratch copy. Every consumer follows its producer. D2/D4
  claim "no bridge needed" — verified: no artefact is used before it is defined, and
  no stub is named that a later task must remove.
- Cross-task pins are resolved by "read its name from the code" rather than a brittle
  literal: T4 reads the fold function's name from `src/watch/usage.ts`; T5 reads the
  script name from `references/`; T7 reads the copied script's name. Sound.

### Atomicity of the heavy task (T3) — assertion accounting is complete
The primary atomicity risk is T3 adding `graph` to `UsageCell` and breaking every
full-cell literal and every compare-table string in one commit.
- `windowPhase` extraction is clean: `reduceSpawn(s, phaseStarts, phaseEnds)` already
  receives both arrays (usage.ts:239), so lifting the loop at :283-292 into
  `windowPhase(at, phaseStarts, phaseEnds)` and calling it from `reduceSpawn` and
  `applyGraphCounts` needs no signature threading. `applyGraphCounts` mirrors the
  existing anthropic-only cache attribution (usage.ts:179-187) onto cell / phase.total /
  phase.providers.anthropic / report.total / report.providers.anthropic, once per row —
  no double count, since report.total is the row-wise sum, not a re-sum of phases.
- Compare-string assertions: the two-arg `formatUsageTable` calls sit at usage.test.ts
  lines 330, 351, 466; their compare-string assertions are 333, 335, 336, 337 / 352,
  353 / 467 — exactly the seven T3 lists. The only five-dash absent-side line (335) and
  all four `delta spawns` lines (336, 337, 352, 353) are in the list. Complete.
- One-report substrings (300, 301, 302, 303, 304, 305, 417, 426, 427, 428, 439, 440,
  451-454) are `toContain` prefixes that survive appending ` | <graph>` before the
  `  orch`/kinds text; T3's claim that they "stay unedited and still match" holds.
- Full-cell literals needing manual `graph: 0`: `grep -n cacheUnknownGap` over the two
  test files returns usage.test.ts:10 (the `ce` helper), :382 (a `ce(...)` call), and
  harness.test.ts:533, 596, 597. The usage.test.ts cells all flow through `ce`, so
  editing `ce` covers them (including the whole-report `toEqual` at :474 and :180);
  only harness.test.ts:533/596/597 need hand-editing — exactly T3's list. `emptyCell`
  (usage.ts:75-77) is the sole `UsageCell` constructor in source, so adding `graph: 0`
  there keeps `tsc` clean.
- T2/T4/T6 each assert "no existing assertion changes value"; verified: no existing
  brief call passes a graph value (byte-identical output), and no existing usage test
  writes a `harness-activity.jsonl`, so `applyGraphCounts` is a no-op on them.

### Fresh lens (prompt-only sub-agent) — prompts hold up
- T1's `fact`/`refresh` behaviour is spelled inline plus a full inline list of test
  cases; the happy-path exact format leans on "the three design C1 lines", but design
  is a required implementer read and the test cases pin the values. Acceptable.
- T2's five-template enumeration grep `^  [a-z]*: \[` returns exactly the five
  `BRIEF_TEMPLATES` (486, 495, 507, 516, 525). The missing-freshness check message,
  the separator rule, and the append condition are all stated. Templates end in a
  trailing `\n`, so the separator is always `\n` (one blank line) — consistent with
  the "ends with one blank line then the section" test.
- Completion criteria are checkable: T5 `grep -c GRAPH_BUILT_AT >= 2` and the
  formats.md `graphBehind` grep; T6 the vitest drift-guard plus `grep -c "code graph
  block" >= 2`; T8 the two single-line greps; T9 `grep -c '^- (.) pending' == 3`;
  T10 the four exit-0 checks and the node import of `dist/tools/harness.js`. Skill-edit
  tasks (T5, T7) can only be grep-checked for text presence; their live behaviour is
  correctly deferred to the tracked evidence file (T9) and scenarios (2)/(3)/(4).
- Scenario (5) passes `{ projectPath: R, workspacePath: R }` with R = the spec-store
  repo root; `ToolContext` carries both fields (harness.test.ts:22) and `usageAction`
  resolves `.spec-workflow` under `projectPath`, so the ledger/activity path resolves
  to the real store. Sound (D5).

### Gate B / Gate C
- No task introduces a new external dependency: `graphify` already ships in this
  environment (the global PreToolUse nudge, `.graphifyignore`, `graphify-out/`), and
  its use was approved in requirements R2 and NFR Security. No `[gate-b]`.
- No task exceeds the approved requirements: each maps to specific ACs and stays inside
  the design's component bounds. No `[gate-c]`.

## Top risks/gaps
None rising to SHOULD_FIX. The one soft spot — skill-edit tasks (T5, T7) whose only
in-loop proof is a text-presence grep — is inherent to prose artefacts and is correctly
mitigated by the deferred live-evidence scenarios in T9 and the D7/D14 disclosures that
the graph a worker reads during implementation stays the (stale) main-checkout graph.

## Conclusions to challenge — none reversed
- D1 (split the usage column into T3 fold + T4 wiring): upheld; the fold must edit the
  tool's cell literals in one commit, and the per-prompt word budget excludes the
  prompt, so T3's long prompt is within cap.
- D2/D4 (order chosen so no bridge is needed): upheld; producer-before-consumer verified
  for all four cross-task artefacts.
- D8 (scenario (5) checks data totals + header, not each cell): upheld; the compare
  side's `graph` total is 0 by the agent-cache-ttl activity probe, and the header
  proves the column prints.

## What's missing before acting
Nothing blocking. Proceed to implementation in the stated order (1→2→3→4→5→6→7→8→9→10).

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
