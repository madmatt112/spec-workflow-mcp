# Adversarial Review Memory — design

Last updated: 2026-09-25 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — first round)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MINOR)** — Testing Strategy's usage.test.ts update plan names only the `ce` helper
  (8-11) and the compare block (320-355); it misses `usage.test.ts:467`, a compare-row
  `toContain` in the `formatUsageTable — cache columns` describe that breaks when the `graph`
  cell is inserted (`| 2 | 1 |` → `| 2 | 0 | 1 |`). `grep -n "cacheUnknownGap"` finds cell
  literals, not string assertions. `npm test` (scenario 6) is the real safety net.
- **R1-2 (MINOR)** — C5 declares `windowPhase(at, phaseStarts, phaseEnds)` (line 105) but the
  `applyGraphCounts` prose calls `windowPhase(ms(ts))` (line 111), dropping the two window args.
  Shorthand; state the call with args so the loop extraction (`usage.ts:282-293`) is not
  mis-read as module state.
- **R1-3 (MINOR)** — Close-out refresh condition (line 92, "that root is CODE_ROOT and WORKTREE
  is no") is stricter than Req 2 AC3 ("landing root is the main checkout"). Both never fire
  today (D12: harness/code batches land in a retro worktree), so the implemented rule is inert
  and correct now. Diverges only in the D12-anticipated future landing-root change. Phrase it on
  the landing root (which is also the `graphify update` target).

## Patterns & Themes

- The design is unusually tight: every code citation (path, range, behaviour) verified accurate;
  every producer→consumer wire (launch lines, run.start, activity→graph column, brief values→
  codeGraphSection) shape-agrees end to end. Findings are all MINOR polish, not gaps.
- The graphify CLI probes in the context file all re-verified true (v0.9.35; explain exits 0 on
  no-match; `--graph`/`--budget` on read calls; `GRAPHIFY_FORCE=1` == `--force`). The live graph
  is 201 commits behind and returned a wrong `loc=` — which validates the design's core caution
  (file:line is a hint, confirm the range).
- Recurring theme to watch: the **refresh half of the spec is dormant on the dogfooding path**
  (worktree-per-change ⇒ WORKTREE=yes ⇒ no refresh, D12/D14). Reviewers should keep weighing
  whether the freshness machinery earns its complexity given it only runs on the scenario-4
  fixture that strips the worktree rule.
- Test-literal churn from the new `UsageCell.graph` field is the main mechanical risk; the
  design uses a grep finder for cell literals but string-row assertions need a wider net.

## Guidance for Next Review

- D8 was ruled **refinement (closed)** this round — do not re-open.
- Rulings in the doc's Revision History (requirements v1-v3 lint/adversarial) are closed.
- If a v2 lands: attack the deltas first. Confirm any new/changed test-update enumeration
  actually covers the one-report AND compare string assertions in both `usage.test.ts` and
  `harness.test.ts` (R1-1). Re-check R1-3 phrasing if the close-out refresh condition is touched.
- Fresh lenses not yet used: failure-mode ordering (what happens if the scratch cp fails but the
  refresh is attempted anyway); the `graphify update` lock/contention path under concurrent
  runs; the byte-identical-output guarantee (Req 3 AC5) across all five templates when
  `agent-rules.md` is absent (the read-and-obey line drop interacts with the append separator).
- Verify remaining un-read anchors if leaned on next round: `harness.test.ts:600-620` fixture
  test, `usage.ts:75-92` addCell (must gain `graph`), `formatCompare` provPair rows.
