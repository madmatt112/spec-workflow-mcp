# Adversarial Analysis — harness-usage-and-tiers/requirements (v4), Round 4

Attack surface: completeness, ambiguity, scope. Deltas attacked first (the v4 rewrite of
Req 5 criterion 4 that answered R3-1/R3-2), then the fresh lens the prompt named: a cold
read for internal contradictions across the whole document and a truth table of Req 5's
token states (`unknown` / `na` / `0` / absent) and the all-runs scope, checked for mutual
consistency and against Req 5.9's mandated fixture totals.

## What I checked and how

- Read the memory file, the round-3 analysis, `codebase-context.md`, `agent-rules.md`, and
  the target document end to end.
- Re-read `src/watch/ledger.ts:185-324` in full to verify the v4 delta's `buildModel`
  citations at both ends: the run scope (`:200-202`), the `spawn.end` pairing (`:240-247`),
  the `spawn.usage` fold and its start-less synthesis (`:250-291`, gate `:258`, body
  `:275-290`), the token read/assign (`:266`, `:271`), the first-closing-row pairing (`:241`).
- Re-probed the `question-gates` ledger raw (188 rows): per-agent spawn.start/end/usage
  counts, digit vs non-digit token classification, and the exact token value on every
  `spawn.end` and `spawn.usage`.
- Ran the criterion-4 algorithm as written over every run and counted the spec total and the
  number of spawns that carry no digit tokens (the "unknown" spawns D8 / Req 5.9 govern).

### The v4 delta (R3-1, R3-2) verifies sound

- **R3-1 is fixed and its code claims are true.** The synthesis at `:275-290` sits inside
  `if (e.type !== 'spawn.usage') continue;` (`:258`), so it fires on `spawn.usage` only —
  the criterion now says exactly that. A start-less `spawn.end` reaches `:241`
  (`spawns.find(s => s.agent === e.agent && !s.endedAt && ms(s.startedAt) <= ms(e.ts))`),
  finds no open node (the spawn.end loop runs before any usage node exists), and the `if
  (open)` body at `:242-246` is skipped, so the row is dropped — again exactly as the
  criterion now states. Every cited range checks at both ends.
- **R3-2 is fixed and matches the fixture.** `sdd-reviewer` has 0 start / 7 digit
  `spawn.usage`, `sdd-checker` 0 / 2 digit, `sdd-verifier` 0 / 1 `na` — all confirmed in the
  raw ledger. The fold synthesizes one node per unmatched usage row (each new node is added
  to `usageClaimed`, so the next same-agent usage row cannot match it and synthesizes its
  own), so "one spawn per `spawn.usage` row" is the fold's real behaviour. Verifier's `na`
  → `unknown` tokens is correct.
- **The load-bearing total is right.** Walking the algorithm over all runs yields exactly
  **1,963,320** (23 digit rows: analyst `spawn.end` 45,675 + 22 digit `spawn.usage`). The
  later analyst `spawn.end` (45,675 at 01:10:49) is the digit-carrying one, so "later end
  wins" holds. R2-1/R2-2/R3-1/R3-2 are all resolved for the total.

The round breaks on the token-state truth table the fresh lens was told to build.

## Findings

### R4-1 — Req 5.4's "absent" token-state clause makes 21 unknown marks on question-gates, not the 14 Req 5.9 mandates; the criterion contradicts itself and Req 5.9 (MUST_FIX) — Novel

Req 5.4 (line 78) states the unknown-spawn rule:

> "A spawn whose only values are `unknown`, `na`, `0` or absent counts one spawn and no
> tokens; such a cell prints `<sum> (+n unknown)` (D8); `unknown` appears only where a source
> row says so."

D8 (line 134) reads the same way: "An unknown spawn shows as `<sum> (+n unknown)` in its
cell." So an "unknown spawn" — one whose only values are `unknown`, `na`, `0` **or absent** —
contributes to the `(+n unknown)` mark on its cell.

Req 5.9 (line 83) pins the flagship outcome: the total is 1,963,320 "with `unknown` marks on
the cells of its **14** `unknown`, `na` and `0` rows."

These conflict on the actual fixture. I classified every `spawn.end` token in
`question-gates`: **44 are absent** (no `tokens` key), 1 is a digit (the analyst, 45,675),
and 0 are `unknown`/`na`/`0`. The seven orchestrator spawns each hold a `spawn.start` (with a
`phase`) and a `spawn.end` with an absent `tokens` key, and carry **no** `spawn.usage`:

- `sdd-document-orchestrator` — 3 spawns (requirements, design, tasks), each end `result`
  `approved`, no tokens key.
- `sdd-implementation-orchestrator` — 1 spawn, end `complete`, no tokens key.
- `sdd-retro-orchestrator` — 1 spawn, end `retro-ready`, no tokens key.
- `sdd-closeout-orchestrator` — 2 spawns, ends `error` / `closed`, no tokens key.

Each of these seven spawns is, verbatim, "a spawn whose only values are … absent," so Req 5.4
clause 1 + D8 make each an unknown spawn that prints `(+n unknown)`. Running the algorithm as
written yields **21** unknown-marked spawns: the 14 worker rows (drafter 1, reviser 5,
implementer 7, verifier 1) **plus** the 7 absent-only orchestrator spawns. That fails Req
5.9's `14` on the spec's own flagship acceptance test.

The criterion is also self-contradictory. Its closing clause — "`unknown` appears only where a
source row says so" — points the other way: an absent `tokens` key is no source row saying
`unknown`, so under that clause the 7 orchestrator spawns get **no** mark and the count is 14.
Clause 1 (with "or absent" and the `(+n unknown)` print) and the closing clause cannot both
hold; they produce 21 vs 14 on the same fixture. An implementer who codes the explicit,
worked clause 1 / D8 rule ships 21 and fails Req 5.9; one who codes the terse closing clause
ships 14. The document must pick one and say it unambiguously.

The `0` state has the same defect latent (not exercised here — question-gates has zero `0`
rows, so Req 5.9's "and `0`" is itself vacuous for this fixture). A `0` token is a **digit
string** (`/^[0-9]+$/` matches `0`), so the token-source rule ("`tokens` SHALL come from a
`spawn.usage` digit string") reads it as a known zero and Req 5.9's "sum of its 23
digit-string rows" would count a `0` row among the digit rows — yet clause 1 lists `0` as a
no-token unknown spawn that prints `(+n unknown)`. The store holds 27 `0`-token rows on other
specs (`codebase-context.md:87`), so on any ledger the report runs over (Req 5's story is "one
spec or two," any spec), a `0` row is double-classified: summed as a digit row **and** marked
unknown. The sum is unaffected (0 either way), but the mark count is wrong.

Fix: define the unknown mark on exactly one boundary. The consistent choice is the closing
clause — a cell's `(+n unknown)` counts only spawns whose token **source row states**
`unknown` or `na` (source-stated no-value); an absent `tokens` key contributes to the spawn
count and 0 tokens but **no** mark, and a `0` digit string is a known zero (summed, not
marked). Then drop "or absent" and "`0`" from clause 1's `(+n unknown)` trigger, and drop
"and `0`" from Req 5.9 (or keep it only if a `0` row is deliberately marked). This is the
"four token states checked against Req 5.9's mandated fixture totals" the round was told to
run: `absent` fails it today.

### R4-2 — Req 5.5's mandated header "run count" is undefined when a covered run has no `run.start`; question-gates gives 1 or 2 with no rule to choose (SHOULD_FIX) — Novel

Req 5.5 (line 79): "The report SHALL cover every run in the ledger, not only the last
`run.start` … `question-gates` carries rows of `run-20260916-225339` with no `run.start` …
The header SHALL state the run count."

The fixture has two distinct `run` ids (`run-20260916-194812`, `run-20260916-225339`) but
only **one** `run.start` event (confirmed: `run.start` count = 1). The criterion mandates a
header value — "the run count" — but never says how to derive it. Counting `run.start` events
gives **1** (misleading, since the report deliberately sums two runs' data); counting distinct
`run` ids gives **2**. Both are defensible from the text, and the criterion's own example is
the exact case that splits them. An implementer can ship either header on the flagship
fixture; the mandated output is not pinned.

Fix: state that the run count is the number of distinct `run` ids the report aggregates
(so `question-gates` reads 2), not the number of `run.start` events.

## Top 3 risks/gaps

1. **The flagship acceptance test (Req 5.9) fails under the criterion's own worked rule**
   (R4-1). Req 5.4 clause 1 + D8 mark 21 spawns unknown; Req 5.9 demands 14. This is the
   load-bearing verification scenario, and the two criteria disagree on the fixture the
   document itself commits to.
2. **The token-state model conflates three different things** (R4-1). `unknown`/`na`
   (source-stated no-value), `0` (source-stated zero), and absent (no source value) are one
   bucket in clause 1 but three different truths; the `(+n unknown)` mark and the "sum of
   digit-string rows" total both need a single, stated boundary.
3. **A mandated header value is unpinned** (R4-2). "The run count" has two defensible values
   on the flagship fixture with no rule to choose.

## Top 3 conclusions to challenge or reverse

1. **"A spawn whose only values are … absent … prints `<sum> (+n unknown)`."** Reverse for the
   mark: an absent `tokens` key is not a source row saying `unknown`. On question-gates this
   marks 7 orchestrator spawns that Req 5.9 does not count. Keep them in the spawn count, drop
   them from the mark.
2. **"`unknown` marks on the cells of its 14 … rows" is what the algorithm yields.** It is not
   — the algorithm as written yields 21. The `14` follows only from the closing clause, which
   contradicts clause 1.
3. **`0` is an unknown/no-token state.** `0` is a digit string the token-source rule reads as a
   known zero; treating it as unknown double-classifies it (summed and marked). The store has
   27 `0` rows, so this is not hypothetical on non-fixture ledgers.

## What is missing before acting on this document

- Req 5.4 corrected so the `(+n unknown)` mark has exactly one definition (source-stated
  `unknown`/`na`), with absent handled as count-but-no-mark and `0` handled as a known zero;
  Req 5.9's "14 … `unknown`, `na` and `0` rows" reconciled to whatever that definition yields
  (14 for question-gates, and drop the vacuous "and `0`").
- Req 5.5's "run count" defined as distinct `run` ids so the mandated header is deterministic.

## Scope check

No scope drift. Both findings are internal to Req 5 (the usage report, decomposition entry 8);
deferrals to specs 9/10 remain out. R4-1 is a consistency defect across Req 5.4 / D8 / Req 5.9;
R4-2 is an underspecified output in Req 5.5. No new surface.

ESCALATE: none. The report is a read-only tool over an existing ledger; these are
correctness/consistency defects, not security, data, money or compliance issues for a human
now.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
