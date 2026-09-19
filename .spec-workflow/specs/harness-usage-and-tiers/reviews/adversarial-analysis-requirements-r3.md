# Adversarial Analysis — harness-usage-and-tiers/requirements (v3), Round 3

Attack surface: completeness, ambiguity, scope. Deltas attacked first (the v3 rewrites of
Req 5 criterion 4 and Req 4 criterion 7 that answered R2-1/R2-2/R2-3), then the fresh lens
the prompt named: re-read every criterion-4 citation into `src/watch/ledger.ts` at both
ends of its range and check it describes what the code actually does, and re-run the
question-gates fixture against the new wording.

## What I checked and how

- Read the memory file, the round-2 analysis, `codebase-context.md`, `agent-rules.md`, and
  the target document end to end.
- Re-read `src/watch/ledger.ts:188-324` in full — the run scope (`:200-202`), the
  `spawn.end` pairing (`:240-247`), the `spawn.usage` fold and its start-less synthesis
  (`:250-291`), the token read/assign (`:266`, `:271`), and `tokensTotal` (`:316`).
- Re-read `src/watch/render.ts:55-84` and `:180-211` (the head line at `:203`, the width
  math at `:201-202`), `src/watch/__tests__/render.test.ts:43-64` (`:53`/`:56`),
  `src/tools/harness.ts:27-121` (enum `:46`, dispatch `:109-120`, `required`/`additionalProperties`
  `:94-95`), and `tsconfig.json:8` (root, `rootDir: ./src`).
- Probed the `question-gates` ledger raw (per-agent `spawn.start`/`spawn.end`/`spawn.usage`
  counts, digit vs non-digit tokens, chronological ordering). Confirmed:
  - 23 digit rows sum **1,963,320** (1 `spawn.end` = analyst 45,675; 22 `spawn.usage`).
  - The analyst: 1 `spawn.start`, 2 `spawn.end` (undefined at 01:10:28, `45675` at 01:10:49),
    0 `spawn.usage` — matches criterion 4.
  - Start-less agents: `sdd-reviewer` 0 start / 7 numeric usage / 7 non-digit end;
    `sdd-checker` 0 start / 2 numeric usage / 2 non-digit end;
    **`sdd-verifier` 0 start / 1 non-numeric usage (`na`) / 1 non-digit end.**
  - Started multi-spawn agents (`sdd-drafter`, `sdd-implementer`) are ordered
    start→end→usage per spawn, so criterion 4's "up to its next `spawn.start`" windowing
    pairs correctly on this fixture.
  - The 14 `unknown`/`na`/`0` rows Req 5.9 names are all `spawn.usage`
    (drafter 1, reviser 5, implementer 7, verifier 1); the 44 absent-token rows are all
    `spawn.end`.

### The v3 fixes verify sound in arithmetic

Walking criterion 4 over the fixture yields exactly Req 5.9's total: analyst 45,675
(`spawn.end`, later end wins) + drafter/reviser/implementer digit `spawn.usage` (fallback,
started agents) + reviewer 7 + checker 2 start-less digit `spawn.usage` = 23 rows,
1,963,320. **R2-1 and R2-2 are resolved for the token total.** Req 4.7 (R2-3) now pins the
full rendered line fitting 80 columns without wrapping — a real, non-vacuous invariant that
replaces the `Math.max(16,…)` tautology. **R2-3 is resolved.** The delta's citations into
`render.ts`, `harness.ts` and `tsconfig.json:8` are accurate at both ends. The two open
lint items hold: `tsconfig.json` sits at the repo root (verified `:8` = `rootDir`), and the
line-165 hits are v2 history prose, not requirement defects.

The round breaks on two seams the criterion-4 rewrite opened in `src/watch/ledger.ts`.

## Findings

### R3-1 — Criterion 4 attributes a start-less `spawn.end` synthesis to a `buildModel` fold that only synthesizes from `spawn.usage` (MUST_FIX) — Compounding; Compounds: R2-2

Req 5.4 (line 78, written by the R2-2 fix) states:

> "when the agent has none, an otherwise-unclaimed `spawn.usage` row (or a digit-carrying
> `spawn.end` row) SHALL count as its own spawn — the synthesis `buildModel`'s fold
> performs today for a start-less worker (`src/watch/ledger.ts:275-290`)."

The em-dash clause claims `buildModel`'s fold at `:275-290` performs this synthesis for a
start-less worker, and the SHALL it explains includes "a digit-carrying `spawn.end` row."
That is a false claim about the code:

- The synthesis at `:275-290` lives inside the `spawn.usage` loop, gated at `:258`
  (`if (e.type !== 'spawn.usage') continue;`). It runs for **`spawn.usage` rows only**.
- A start-less `spawn.end` is handled at `:240-247`: `const open = spawns.find(...)` finds
  no open same-agent node (there is no `spawn.start`), so the `if (open)` body is skipped
  and the row is **dropped**. There is no synthesis path for `spawn.end` anywhere in
  `buildModel`.

So `buildModel` does **not** count a start-less digit `spawn.end` as its own spawn — it
loses it. An implementer told to "do what `buildModel:275-290` does for a start-less worker"
produces code that drops such a row, contradicting the criterion's own SHALL. The
criterion's own closing summary confirms the mismatch: it lists the adopted fold behaviours
as "the `spawn.usage` token fallback and the start-less synthesis (`:250-291`)" — both
`spawn.usage`-based — and never names a `spawn.end` synthesis. The parenthetical
`spawn.end` rule is a report-only behaviour with a false `buildModel` citation.

The fixture does not exercise it (no start-less digit `spawn.end` exists in question-gates:
reviewer/checker/verifier all have `endDigit=0`), so the total is unaffected. But the
citation is a false behavioural claim about a cited artifact, which the standing directive
makes an automatic MUST_FIX, and it is exactly the "false claim about the ledger fold" this
round was told to look for. Fix: either drop the "(or a digit-carrying `spawn.end` row)"
parenthetical, or state it as the report's own rule and stop attributing it to
`buildModel:275-290` (which synthesizes only from `spawn.usage`).

### R3-2 — Criterion 4's start-less worked rule ("one spawn per numeric `spawn.usage` row") omits the start-less non-numeric case (`sdd-verifier`), risking 13 of the 14 unknown marks Req 5.9 mandates (SHOULD_FIX) — Compounding; Compounds: R2-2

Criterion 4 opens with a general clause — "an otherwise-unclaimed `spawn.usage` row … SHALL
count as its own spawn" (no numeric qualifier) — then narrows to a worked rule naming only
two agents: "`sdd-reviewer` (…seven numeric `spawn.usage` rows) and `sdd-checker` (…two
numeric `spawn.usage` rows) each get **one spawn per numeric `spawn.usage` row**."

`question-gates` has a third start-less agent the worked rule never names: **`sdd-verifier`,
with 0 `spawn.start`, one `spawn.end` (no digits) and one `spawn.usage` = `na`.** Its only
non-dropped trace is a start-less **non-numeric** `spawn.usage`. The general clause makes it
one unknown spawn (and `buildModel`'s fold synthesizes exactly that node), but the worked
rule — read literally as "one spawn per **numeric** usage row" — gives verifier **zero**
spawns, because it has zero numeric usage rows. The two statements conflict for this exact
fixture row.

This matters because Req 5.9 pins not only the 1,963,320 total but "`unknown` marks on the
cells of its **14** `unknown`, `na` and `0` rows." Verifier's `na` usage is one of those 14
(the other 13 are drafter/reviser/implementer non-numeric usage that fold onto **started**
spawns, so they are safe). An implementer who codes the start-less path from the worked rule
drops verifier and reports **13** unknown marks against Req 5.9's 14. The total is
unaffected (verifier = 0 tokens), but the criterion-4-vs-criterion-9 mismatch is real and
fixture-grounded. Fix: reconcile the general clause with the worked rule — a start-less
`spawn.usage` becomes its own spawn whether or not it carries digits — and add
`sdd-verifier` (start-less, one `na` usage → one unknown spawn) as the worked non-numeric
case alongside reviewer and checker.

## Top 3 risks/gaps

1. **A false `buildModel` citation in the delta** (R3-1). Criterion 4 leans on the fold's
   real behaviour by name; the one place it over-reaches — attributing start-less
   `spawn.end` synthesis to `:275-290` — is code that never runs for `spawn.end`. It
   misleads the implementer even though the fixture masks it.
2. **The start-less worked example is one agent short** (R3-2). It names the two numeric
   start-less agents and omits the non-numeric one (`sdd-verifier`), so the criterion's own
   flagship fixture can be implemented to Req 5.9's total but not its 14-mark clause.
3. **The token total is now correct, and that is the load-bearing number.** Both v3 MUST_FIX
   fixes reach 1,963,320. The residue is completeness/accuracy on the edges (a start-less
   `spawn.end` that the store never has; a single `na` verifier row), not the core sum.

## Top 3 conclusions to challenge or reverse

1. **"the synthesis `buildModel`'s fold performs today for a start-less worker" covers a
   digit-carrying `spawn.end`.** Reverse: the fold synthesizes only for `spawn.usage`
   (`:258` gate, `:275-290` body); a start-less `spawn.end` is dropped at `:240-247`.
2. **"each get one spawn per numeric `spawn.usage` row" is the start-less rule.** It is only
   the rule for the two agents whose usage rows are all numeric. The rule is "one spawn per
   otherwise-unclaimed `spawn.usage` row," numeric or not — verifier proves it.
3. **The report "adopts `buildModel`'s fold behaviours … the `spawn.usage` token fallback."**
   Fair as a *read* (`:266`/`:271` do read and assign the usage digits), but note the fold
   at `:271` *overrides* end tokens with usage tokens, the opposite of the report's
   end-wins-over-usage rule; the criterion handles this via Req 7.2, so it is consistent —
   flagged only so the "adopts" language is not mistaken for verbatim reuse.

## What is missing before acting on this document

- Criterion 4 corrected so its `buildModel` attribution matches the fold (R3-1): the
  start-less synthesis is `spawn.usage`-only; the `spawn.end` case, if kept, is the report's
  own rule, not `buildModel`'s.
- Criterion 4's start-less worked set completed (R3-2): add `sdd-verifier` as the
  start-less non-numeric case and reconcile "otherwise-unclaimed `spawn.usage` row" (all)
  with "one spawn per numeric `spawn.usage` row" (subset), so the report yields all 14
  unknown marks Req 5.9 requires, not 13.

## Scope check

No scope drift. The v3 delta stays inside decomposition entry 8; deferrals to specs 9/10
(per-run effort, per-role provider, the step-4 non-token columns) remain out. Both findings
are internal to Req 5.4's own algorithm; no new surface.

ESCALATE: none. `harness/hooks/` is sensitive and the document already flags the hook change
as high risk; this round's findings are correctness/completeness in a read-only report — no
security, data, money or compliance issue for a human now.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
