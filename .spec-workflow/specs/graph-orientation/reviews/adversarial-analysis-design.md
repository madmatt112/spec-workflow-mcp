# Adversarial Analysis — graph-orientation/design (v1)

First review of the design. Requirements are approved at v3; this attacks the design deltas
against those requirements, the codebase it cites, and one fresh lens: **wire contracts across
the supervisor → orchestrator → tooling boundary**.

## What I checked and how

- **Every cited artifact, both ends of the range.** Read `src/tools/harness.ts`
  (`briefAction` 547-655, the missing-value rule 617-631, the fill 633-635, `values` schema 76,
  `usageAction` 1072-1093, `readSpecLedger` 1029-1064), `src/watch/usage.ts` (`UsageCell`/shapes
  13-34, `buildUsageReport` 113-218, `reduceSpawn` window loop 282-293, `emptyCell`/`addCell`
  75-92, `formatOne` 361-373, `formatCompare` 375-410), `src/watch/ledger.ts` (`ActivityEvent`
  26-36, `parseJsonl` 176-189), the supervisor skill (66-116, 224-247, 262-269, 320-327), the
  three orchestrator skills at every cited launch-key / standing-rule / loop range, `briefs.md`
  (1-4, 50-59, 136-208, 386-409), `formats.md` (170-204), the activity hook
  (`sdd-activity.sh` 126-179), the docs (`TOOLS-REFERENCE.md` 547-579, `SDD-HARNESS.md`
  253-264), and the five test anchors (`harness.test.ts:165/523-538/587-598`,
  `usage.test.ts:8-11/320-355`, `providers-map.test.ts:17-34`, `sdd-cache-ttl.sh:1-22`).
  **All citations resolve, all ranges are the correct anchors, all described behaviours match
  the code.** No misstated artifact.
- **Re-probed the graphify CLI** the design's feasibility rests on (the context file is
  drafter-written/unreviewed): `graphify 0.9.35`; `explain "noSuchSymbolXyz"` prints
  "No node matching" and exits 0; `path`/`explain`/`query` all take `--graph <path>`;
  `query --budget 800 --graph <abs>` runs from any cwd, exits 0, truncates at the budget;
  `update <path>` documents `--force` / `GRAPHIFY_FORCE=1`. Every `## Probes` line the design
  leans on holds. (The stale live graph even returned `UsageReport loc=L22` when the type is at
  `usage.ts:33` — which is exactly the staleness the design's "file:line is a hint, confirm it"
  rule and freshness line exist to catch. The premise is sound.)
- **Traced the wires end to end.** Producer→consumer shapes agree at every hop.

## Wire-contract trace (fresh lens) — result: consistent

- **Launch lines (supervisor → orchestrators).** `fact` prints `GRAPH:`/`GRAPH_BEHIND:`/
  `GRAPH_BUILT_AT:` (C1); the supervisor keeps them (C2, after roots) and re-emits them after
  `LAUNCHER:` in the launch block (`SKILL.md:241` confirmed); each orchestrator's launch-key
  list (`document 8-12`, `implementation 14-19`, `closeout 14-20`) gains the same three keys.
  Names, order and the `none`/`n/a` collapse all agree.
- **`run.start` row (supervisor → ledger).** Adds `graph`/`graphBehind` only when `GRAPH` is a
  path, post-refresh value, matching Req 1 AC8 and formats.md:194. `LedgerEvent`'s index
  signature (`ledger.ts:23`) absorbs the new keys with no renderer change. Confirmed no code
  *reads* these keys — they are a write-only ledger record, which is what Req 1 AC8 asks for
  (pre-spec shape when `none`). The prompt's framing that "the usage column consumes run.start"
  is not how the design works, and the design is correct: the usage graph column reads
  `harness-activity.jsonl`, never `run.start`.
- **Activity hook → usage graph column.** `sdd-activity.sh:138-151` writes `event:"tool"`,
  `tool:d.tool_name` (`"Bash"` for Bash), `summary:i.command` (whitespace-collapsed, ≤160),
  `agent:sdd-*`. `isGraphCall` consumes exactly those fields with a regex anchored at the
  command token, so the orchestrator's `graphify update` (a refresh) and the supervisor's
  (main-session, unrecorded) never false-count, and only `explain|query|path` count. Agent
  keys line up with `spawn.start` agent keys; DeepSeek rows (`@deepseek`, unrecorded by the
  hook) correctly read `graph=0` (Req 6 AC8). Counts go to `providers.anthropic`, consistent
  with the hook only seeing Anthropic Agent-tool workers (D9).
- **`brief` values → `codeGraphSection`.** `values.graph` path triggers the new missing-value
  check (styled on 617-631, at 568) and the append (at 633-635); absent/`none`/non-string
  leaves the byte-identical output (Req 3 AC5). `behind !== '0'` gates the hint line at both the
  tool and the briefs.md mirror; the drift test compares the mirror to
  `codeGraphSection('<GRAPH>','<GRAPH_BUILT_AT>','<GRAPH_BEHIND>')` where the placeholder
  `!== '0'`, so the hint line is present in both — consistent.

## D8 ruling (requested)

**`refinement` (closed).** Req 6 AC2 literally says the summary "names graphify explain/query/
path". D8's regex `/(^|[\s;&|(])graphify\s+(explain|query|path)\b/` narrows that to a command
token, excluding a quoted `"graphify explain"` inside a `grep`. This narrowing is faithful to
the requirement's own stated intent — requirements D4 already excludes "a row naming a
graphify-out path … a raw read, not a graph call". Extending that principle to a grep of the
phrase counts fewer rows, in the direction the requirement authorized. Not a widening; no
finding.

## Findings

### R1-1 — Testing Strategy misses a breaking compare-row assertion — MINOR
The design's usage.test.ts update plan (Testing Strategy) names only the `ce` helper
(`usage.test.ts:8-11`) and the compare-table block (`usage.test.ts:320-355`). Inserting the
`graph` cell into `pair()` breaks a compare-row string assertion **outside** that block, in the
`formatUsageTable — cache columns` describe:
`usage.test.ts:467` — `expect(text).toContain('… | 1,000 | 10 | 20 | 2 | 1 | 1,000 | unknown | unknown | unknown')`.
The graph cell turns `… | 2 | 1 | …` into `… | 2 | 0 | 1 | …`, so the substring no longer
matches. The design's `grep -n "cacheUnknownGap"` finder catches cell literals, not string
assertions. Impact is low: end-to-end scenario (6) runs `npm test`, which fails on this until
fixed. (I confirmed no analogous one-report total-row string assertion breaks: the phase/spec
total assertions in that block match a prefix that ends before the inserted `| <graph>`, and
`harness.test.ts` message assertions are all prefix `toContain`s.)

### R1-2 — `windowPhase` pseudo-call arity mismatch — MINOR
C5 declares `windowPhase(at, phaseStarts, phaseEnds)` (design line 105) but the
`applyGraphCounts` prose calls it `windowPhase(ms(ts))` (design line 111), dropping the two
window arguments. It is shorthand and the signature is unambiguous, but state the call with its
arguments so the extraction of the current inline loop (`usage.ts:282-293`) is not
mis-implemented as reading module state.

### R1-3 — Close-out refresh condition is stricter than Req 2 AC3 (dormant) — MINOR
C4 close-out (design line 92) gates the refresh on "that root is `CODE_ROOT` and `WORKTREE` is
`no`", while Req 2 AC3 gates on "the batch's landing root is the main checkout". Because
`WORKTREE: no` ⇒ `CODE_ROOT` = main checkout, the design's rule additionally demands the
landing root equal the orchestrator's own cwd. Today both never fire (harness/`code` batches
land in a `chore/<SPEC>-retro` worktree — `closeout SKILL.md:113-116`, D12), so the
implemented rule is correct-by-being-inert. But in the exact future D12 anticipates ("a change
to the close-out landing root would make it fire"), a landing root of the main checkout while
the orchestrator sits in a `feat/`/retro worktree would satisfy the requirement yet fail the
design's condition. If the rule is worth keeping (D12), phrase it as the requirement does —
gate on the landing root, which is also the `graphify update` target the same sentence already
names.

## Top risks / gaps

1. **A stale graph shipped to workers during implementation (already disclosed, worth
   re-stating).** Under this repo's `worktree-per-change: required`, `WORKTREE` is `yes` for the
   whole implementation phase, so neither the run-start refresh nor the per-task refresh fires
   (D14); workers get the main checkout's graph, missing every symbol the task just added, and
   fall back to cold reads for their own edits. This is correct per Req 2 AC6 and disclosed, but
   it means the headline "freshness by tooling" delivers **nothing on the dogfooding path** —
   the only path where the refresh is exercised is the scenario-4 fixture that strips the
   worktree rule. Reviewers of the *value* of this spec should weigh that the refresh half is
   effectively untested in normal use.
2. **`graphify update` lock/timeout under the 100 s cap.** `update` blocks on a per-repo flock
   (`watch.py:158-164`). The design handles a timeout as a note-and-continue, but if the global
   PreToolUse nudge or a manual `graphify watch` holds the lock, a run-start refresh can burn up
   to 100 s before degrading. Acceptable, but the 100 s figure (D2) is justified by a *13.4 s*
   no-contention probe, not a contended one.
3. **Test-update completeness (R1-1).** The enumerated plan under-specifies the string
   assertions the new column touches; the safety net is `npm test`, not the design's list.
4. **Latent close-out condition divergence (R1-3).** Dormant, but a trap for whoever later
   moves the close-out landing root.
5. **`run.start` graph keys are write-only.** Nothing reads `graph`/`graphBehind` off the row;
   they exist for the ledger record only. Fine per Req 1 AC8, but if a later spec expects to
   drive behaviour off them, that wire does not yet exist.

## Top 3 conclusions to challenge

1. **D2 — "100 s fits the Bash tool default and an update took 13.4 s."** The 13.4 s was
   201-commits-behind, uncontended, on this 2,713-node graph. tradr's graph is 8,531 nodes; a
   contended or larger update is unmeasured. The conclusion (100 s is ample) is probably right
   but is generalised from one data point. Not blocking — the timeout degrades safely.
2. **D7 — "a later launch prompt can state a stale count; the effect is only that graph lines
   read as hints."** Accepted as designed, but note the compounding effect with risk 1: on the
   worktree path the count is *always* stale (never refreshed), so "reads as hints" is the
   permanent state, not an edge case. The design is honest about this; the challenge is whether
   the freshness machinery earns its complexity when it is dormant on the main path.
3. **The premise that the usage `graph` column measures graph *adoption*.** It counts only
   Anthropic Agent-tool workers (Req 6 AC8, correctly). In a run with DeepSeek reviewers/
   checkers (spec 10, which lands before this one in build order), those roles' graph use is
   invisible while their spawns are counted — the retro comparison against `agent-cache-ttl`
   understates graph use for exactly the most-spawned role. Disclosed in Req 6 AC8; reversing it
   is out of scope (the hook is a sensitive path), but the retro reader must know the column is
   an Anthropic-only lower bound.

## What's missing (before implementation)

- Add `usage.test.ts:467` (and a scan of the whole `formatUsageTable — cache columns` block)
  to the test-update list, or replace the enumerated ranges with "every `toContain` on a table
  row/header in `usage.test.ts` and `harness.test.ts`".
- State the close-out refresh condition in the requirement's terms (landing root), or note
  explicitly that the design deliberately narrows it and why.
- Nothing else. The design is implementable as written; the wire contracts are sound and the
  citations are accurate.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
