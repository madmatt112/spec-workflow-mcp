# Adversarial Analysis — advisor/design (v2, Round 2)

Attacked the v2 deltas first (Revision History v2: the R1 dispositions + lint pass),
then applied a consistency lens over the new Data Models block against the
requirement ACs it serves. Every new/changed citation was read end-to-end against
the tree under `.claude/worktrees/advisor`.

## The v2 deltas verified against the tree

- **R1-1 "fix" is correct — and R1-1 itself was a false finding.** The tree shows the
  window threshold assigned at `controller.ts:85-86`
  (`this.windowThreshold = opts.windowThreshold ?? …`), `windowBlock()` at `373-388`,
  and `onRateLimit` at `413`. The v2 citations read exactly those. R1 claimed 87-88 /
  375-390 (off-by-two); **codebase-context.md L73-74 carry the same off-by-two**, but
  the design overrode them with the right numbers. No regression; nothing to re-open.
- **R1-3 fix (C8 no-run merge) is sound.** `MergeTarget` (`merge.ts:542-551`) has exactly
  the six fields the design now supplies (`pr, runId, projectId, spec, questionId, label`);
  `openRunLedger` is the exported writer at `ledger.ts:95` and always writes
  `<specDir>/harness-events.jsonl`, so rooting it at `advisor/actions/id/` really does put
  the `pr.merged` row outside any `specs/*/harness-events.jsonl` — the tallies reader (C5)
  never scans it. Claim holds.
- **R1-5 fix (C7 onRateLimit note) is accurate.** `onRateLimit` is an optional `StepSpec`
  field (`step.ts:128`) wired only in `runDeps()` (`controller.ts:413`); a direct `runStep`
  for the opinion bypasses it, so the "lag accepted" note is true.
- **C7 runStep call is feasible.** `StepSpec` really has `maxTurns` (104), `schema` (116),
  `mcpConfig` (114) and `noSessionPersistence` (118); the design names only real fields.
- **Data Models additions type-check.** `windows: { fiveHour?: RateLimitFile['fiveHour']; … }`
  indexes the real `RateLimitFile` (`state.ts:194-201`). `AdvisorSummary`, `Tallies`, `Hit`
  and `SearchResult` all enumerate fields (no union-arms-only object) — R1-2's Data-Models
  gap is closed; the Req 2/3/4 response trio is now pinned.

## Topics attacked

### 1. `AdvisorSummary.sources` vs Requirement 8 AC 3 (the new R1-2 shape)

- **Challenge the field choice.** Data Models pins `sources: { name: string; location: string }[]`,
  but Requirement 8 AC 1 gives a source four parts — `name`, `kind`, `location`, and "one
  line saying what it is" (the field `about` in `SourcesFile`). AC 3 says the advisor "list
  the sources **by name and line**", and C4's own prose cites it: "sources by name and line
  (Requirement 8 AC 3)". "line" is AC 1's one-line description, i.e. `about` — not `location`.
- **Stress-test the day-one case.** `seedSources()` (C9) writes JobSync with `location ""`
  until the operator fills in the MCP url. A summary built from `{ name, location }` renders
  "JobSync — " (blank) instead of its one-line description. The type pins the wrong member
  of the source record for what AC 3 asks the summary to show.
- The type and the AC the design itself cites disagree on which field the summary carries;
  that forces a guess at implementation time (show `location`, or `about`, or both). → **R2-1**.

### 2. `AdvisorSummary.week: Tallies` — singular name, multi-week type

- **Challenge the shape.** Req 2 AC 1 wants "this week's tallies"; the field is named `week`
  (singular) but typed as the full `Tallies`, whose only member is `weeks: Record<ISOWeek, …>`
  — the whole multi-week container. The implementer populates it with a one-entry
  `buildTallies({from,to})` result and `renderSummary` digs `week.weeks[thisWeekKey]`.
- It type-checks and implements, so this is a naming/altitude smell, not a correctness hole —
  but a reader expects `week` to hold one week's cells, not the map. → **R2-2 (MINOR)**.

## Top risks / gaps

1. **R2-1 (SHOULD_FIX, Compounding R1-2, fix-induced).** `AdvisorSummary.sources` carries
   `location`, but Requirement 8 AC 3 ("by name and line") and C4's prose call for the
   one-line description (`about`); day-one JobSync (`location ""`) would render a blank
   source line. Pin `about` (or `about` + `location`) or re-word the AC citation.
2. **R2-2 (MINOR, Compounding R1-2, fix-induced).** `week: Tallies` names a single week but
   types the full multi-week container; implementable, but the name misleads.

(No third/fourth/fifth risk manufactured: the rest of the v2 delta — citations, MergeTarget,
openRunLedger, onRateLimit, the StepSpec feasibility, and the Data-Models trio — verified
clean. A padded list would be noise.)

## Top conclusions to challenge or reverse

1. **"R1-1 — Accepted (the lint pass corrected the exact lines)."** Keep the current lines
   (85-86 / 373-388 / 413): they match the tree. R1-1 and codebase-context.md L73-74 are the
   ones that are off-by-two — do not let a later round "correct" the design back to 87-88.
2. **`AdvisorSummary.sources: { name, location }`** — reverse to the field AC 3 names
   (`about`), or state in C4 why location is shown instead.

## What's missing before acting

- Decide and pin which source field the summary shows (`about` vs `location`), per Req 8 AC 3.
- Optional: rename `week` to hold one ISO-week's cells (`Tallies['weeks'][string]`) or document
  that it holds a single-key `Tallies`.

## Verdict block

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0; R2-1 (SHOULD_FIX) keeps it open.
