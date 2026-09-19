# Adversarial Analysis — harness-usage-and-tiers/design (v1), Round 1

Scope this round: the delta from `b1f0864` (the lint pass — re-verified every changed
citation), the two re-decided requirement literals (Req 4.7, Req 5.4), the decomposition
entry 8, and the named fresh lens: **wire contracts across the hook → ledger fold →
readers boundary**. Code read at both ends of every range cited below.

## Deltas re-verified (lint pass, `## Changes since`)

The lint pass only qualified bare/short citations (added file prefixes, `parseJsonl
(src/watch/ledger.ts:129)`). I re-read each newly-qualified target: `sdd-activity.sh:83`
and `:65` (guard + `d.usage.tokens` read), `ledger.ts:240-247`, `:245`, `:271`, `:316`,
`:129-142`, `:226-291`, `render.ts:203`, `:188`, `:16-19`, `:44-58`, the test paths, and
the harness.ts ranges — all correct. The 60 rejected `citation-identifier` warnings I
spot-checked (`buildProfiles`, `loadAgentProfiles`, `usageAction`, `buildUsageReport`,
`readUsage`, the four new `SpawnNode` kinds) are all genuinely new/proposed symbols, not
claims that a symbol already exists in the cited range. No citation-identifier MUST_FIX.

## Findings

### R1-1 — MUST_FIX — The skill edit ranges are cut short of the token-write text, leaving `tokens=unknown` instructions the whole spec exists to remove

Component 7 pins the supervisor edit at `harness/skills/sdd-continue/SKILL.md:213-217`
and says "each edit replaces the cited span," then claims: "afterwards only the two
unrelated `attribution footer` hits remain."

I ran the design's own member-finding grep. The supervisor's token-write instruction is a
single paragraph that runs **213 through 220**, not 213-217:

- L215: `result=<PHASE value> tokens=<n>`
- L217: "footer count any more"
- L220: "Only when two further tool rounds pass with no notification write `tokens=unknown`."

Replacing only :213-217 leaves L218-220 intact — a dangling "...so write `spawn.end`
after it lands..." plus a live instruction to **write `tokens=unknown`**. So after the
specified edits `grep -rn "footer\|tokens=" harness/skills` still returns
`sdd-continue/SKILL.md:220`. The design's grep-clean claim is false, and the residual
line violates Req 1.9 ("no skill, agent or script writes `tokens` on any ledger row after
this spec") and Req 2.3 (the supervisor writes `spawn.usage`, not `spawn.end`).

The design's own Scope note compounds this: it declares the model pre-flight at
`:219-227` "untouched." But `**Model pre-flight.**` actually starts at **L222** (verified);
L219-220 are the tail of the spawn-write paragraph and carry the `tokens=unknown`
instruction. Marking 219-227 "untouched" freezes the leftover in place.

Same pattern, second instance: the retro edit is pinned `:35-38`
(`sdd-retrospective/SKILL.md`) but the token-write text runs to **L39** ("`unknown` only
if two more tool rounds pass without it") — the requirement itself cited `:33-39`. That
tail is left dangling.

Also a wrong citation feeding the same false claim: the closeout attribution-footer
reference is cited `sdd-closeout-phase/SKILL.md:168`; the actual line is **170** (the
codebase-context probe carried the same off-by-2). So "the two footer hits remain at
:168, :233" names a line that does not hold the footer.

Fix: extend the sdd-continue span to :213-220 and the retro span to :35-39, correct the
closeout citation to :170, and re-derive the "afterwards" grep claim.

### R1-2 — SHOULD_FIX — The tier line overflows 80 columns for a two-model (`+`-joined) worker actual, a case the design elsewhere supports

Component 4 pins the head line to exactly 80 (`sdd-implementation-orchestrator`), then
claims the tier line is "longest 66 characters" and "within 80 columns (Req 4.2, 4.3,
4.5, 4.7)." That width budget ignores the `+`-joined actual model the design supports
everywhere else: D3/Req 1.2 build `model` as distinct `message.model` values joined with
`+`; the hook test asserts "model as the two ids joined with `+`"; and the tier line
itself flags a `+`-joined model (`a +-joined model is flagged`).

Tier line: `${indent}   ${dim('declared')} ${padRight(declared, 23)}${dim('actual')} ${actual}${flag}`.
For a **level-2 worker** (`indent` = 5, `src/watch/render.ts:181`) whose transcript
recorded two models — e.g. `sdd-implementer` with actual
`claude-opus-4-8+claude-sonnet-5` (31 chars), declared `claude-opus-4-8` → `!=` flag:

  5 + 3 + 8 + 1 + 23 + 6 + 1 + 31 + 3 = **81** > 80.

Single-model actuals fit (level-2 tops out at ~65). Orchestrators are level-1
(indent 2) and top out at 78, so they never trip it. The design's width-80 render test
uses only single-model fixture actuals (Component 8: `claude-sonnet-5`,
`claude-opus-4-8`), so the overflow is neither budgeted nor tested. Either cap/wrap the
actual column or account for the 31-char `+`-joined width in the budget.

### R1-3 — MINOR — The tool's own `description` action list is left stale

Component 6 adds `usage` to the enum and default message and says the tool `description`
(`src/tools/harness.ts:29-40`) "gains one sentence," but the description's opening line —
"orient, brief, phase-log and gate for the orchestrator skills" — lists four actions and
is not updated to include `usage`. Agent-rules requires count/list text to be re-derived.
Minor, but ships an inconsistent tool surface.

### R1-4 — MINOR — `SpawnNode` gains four kinds no consumer reads, and one Overview citation stays bare

`SpawnNode` gains `input/output/cacheWrite/cacheRead` (Req 4.1, populated by the
:240-247 pairing), but no reader consumes them: `render.ts` head/tier lines and
`tokensTotal` use only `tokens`/`model`, and `usage.ts` reads the kinds straight off the
raw `LedgerEvent` rows, not off `SpawnNode`. The fields are requirement-mandated dead
weight (defensible if held for spec 9, but say so). Separately, the Overview's
`the phase-log read pattern (:658-683)` stays bare after the last-cited file was
`src/watch/ledger.ts` (389 lines) — it means `harness.ts:658-683`; Component 6 qualifies
it, the Overview does not.

## Rulings on the two re-decided literals

- **Req 4.7 (two-line agent entry, each within 80 cols): REFINEMENT — closed.** Req 4.7
  delegates widths to design ("Design owns the new widths") and only binds "the full
  rendered line ... fitting within 80 columns without wrapping." Two lines, each ≤80,
  honors that; D1's rationale (a 31-char name plus two full ids cannot share 80 columns
  with the role) is sound. This ruling does not immunize the width math — see R1-2, which
  is about the execution, not the two-line decision.

- **Req 5.4 / D6 ("states unknown" = any non-digit `tokens`, not only `unknown`/`na`):
  REFINEMENT — closed.** On every ledger on this store the only non-digit token values
  are `unknown`, `na` and the digit `0` (codebase-context probe), so D6 and the
  requirement literal produce identical marks on all real data. D6 diverges only on a
  hypothetical future junk value, and only in the safe direction (mark, never drop),
  matching the requirement's own intent ("the spawn count stays honest," "a future junk
  value must be marked, not dropped"). Component 5 rule (d) correctly still leaves the
  no-`tokens`-key orchestrator spawns unmarked, so it does not widen the mark set that
  Req 5.9 fixed at 14.

## Fresh lens — wire contract, hook → fold → readers

Traced each `spawn.end` field end to end. `ts/type/run/agent` read by both `buildModel`
and `usage.ts`; `tokens` (string, or `"unknown"`) coerced with `Number` at
`ledger.ts:245`/`:266`/`:271` (NaN → undefined, so the unknown path never sums) and
read as `/^\d+$/` in `usage.ts` rule (c); `model` written as-is, read by the tier line
`actual` and by `usage.ts`; the activity row carries `tokens` as a **number** while the
ledger row carries it as a **string**, and each reader matches its own type
(`ledger.ts:308` expects number, `:245` coerces string) — intentional and consistent.
The line-271 change (`&& match.tokens === undefined`) makes a digit `spawn.end` win over a
later `spawn.usage` (Req 7.2) without breaking `ledger.test.ts:169-218`: none of those
cases has both a digit `spawn.end` and a digit `spawn.usage` on one spawn. The
orchestrator path (guard removed → hook writes `spawn.end` in the supervisor session,
supervisor writes `spawn.usage`, exactly one supervisor `spawn.start`) folds cleanly.
Only wire mismatch found: the four kinds on `SpawnNode` are produced but never consumed
(R1-4). The contract otherwise holds.

## Closing deliverables

### Top risks/gaps

1. Residual `tokens=unknown` supervisor instruction survives the specified skill edits and
   the "untouched" pre-flight range (R1-1) — breaks the spec's single-writer guarantee.
2. Tier line silently overflows 80 columns for a `+`-joined worker actual (R1-2).
3. The design's asserted grep outcome is false, so scenario 5 / the verifier will trip on
   an artifact the design says is clean (R1-1).
4. Stale tool `description` action list (R1-3).
5. Dead `SpawnNode` kinds — carried, never rendered or summed (R1-4).

### Top 3 conclusions to challenge or reverse

1. **"afterwards only the two unrelated attribution footer hits remain."** False as
   scoped: `sdd-continue/SKILL.md:220` (`tokens=unknown`) survives edits pinned to
   :213-217. Reverse the edit spans, not the claim.
2. **"longest 66 characters ... within 80 columns."** Reverse: a supported `+`-joined
   two-model worker actual makes the level-2 tier line 81 columns.
3. **Model pre-flight is `:219-227`, untouched.** The pre-flight starts at L222; L219-220
   belong to the spawn-write paragraph and must change. Re-scope the boundary.

### What's missing before acting

- A corrected edit map for the token-write passages (sdd-continue :213-220,
  retro :35-39, closeout footer :170) and a re-run of the design's own grep to prove it.
- A tier-line width budget (or a truncation rule) that accounts for the 31-char
  `+`-joined actual, plus a render test at width 80 that exercises a two-model worker.
- A one-line note on whether the `SpawnNode` kinds are intentionally held for spec 9.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
