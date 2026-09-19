# Adversarial Analysis — harness-usage-and-tiers/requirements (v2), Round 2

Attack surface: completeness, ambiguity, scope. Deltas attacked first (the six accepted
R1 fixes the v2 delta wrote), then the fresh lens the prompt named: read each new/rewritten
acceptance criterion cold, as the sub-agent that receives only the criteria, and build a
truth table of the stated cases — especially Req 5 criterion 4's spawn-identity counting
against the double-`spawn.end` fixture.

## What I checked and how

- Read the memory file, the round-1 analysis, `codebase-context.md`, `agent-rules.md`, and
  the target document end to end.
- Verified every citation the v2 delta introduced or changed, both ends of each range:
  - `scripts/copy-static.cjs:45-61` — copies `src/markdown`→`dist/markdown` and
    `src/locales`→`dist/locales`; the extension point Req 3.7 names is accurate.
  - `src/core/workspace-initializer.ts:9` — `const __dirname = dirname(fileURLToPath(import.meta.url))`;
    the resolution pattern Req 3.7 cites is real.
  - `src/watch/render.ts:60` (`const PHASE_ORDER`, non-exported), `:202` (`- agentW - 46`,
    `Math.max(16, …)`), `:203` (`padRight(profile?.model ?? '', 11)`). Req 4.7 and Req 5.2
    citations accurate (46 slack, 11-wide model column, 16 floor).
  - `src/tools/harness.ts:46` (enum), `:49-92` (properties), `:95` (`additionalProperties: false`),
    `:109-120` (dispatch switch). Req 5.1/5.3 citations accurate; `compareSpecName` is
    correctly absent (a forward parameter).
  - `src/watch/ledger.ts:188` (`buildModel` start), `:200-202` (last-run scope), `:241`
    (pairing keeps the first open node), `:250-291` (the `spawn.usage` fold). All accurate.
    Note `buildModel` extends past 291; the `188-291` range in Req 5.4 covers the
    pairing+fold portion, not the whole function — a partial but not false range.
  - `docs/SDD-HARNESS.md:288` groups "Supervisor (main session), the four orchestrators,
    `sdd-drafter`, `sdd-adjudicator`, `sdd-retro-analyst`" in the Fable-xhigh row; `:325-328`
    orchestrator-recorded tokens. Req 6.2 citations accurate.
- Re-probed only the question-gates ledger structure (not the totals the memory pins as
  verified), because Req 5.4 makes new structural claims. Confirmed against the raw file:
  - The analyst: one `spawn.start` (01:06:19), `spawn.end` no-tokens (01:10:28), `spawn.end`
    `45675` (01:10:49) — exactly the "one spawn.start, two spawn.end" of Req 5.4/5.9.
  - Digit-carrying rows: **1** `spawn.end` (analyst, 45,675) + **22** `spawn.usage`
    (1,917,645) = 23 rows, 1,963,320.
  - `spawn.start` counts per agent: `sdd-reviewer` **0** start / 7 numeric usage;
    `sdd-checker` **0** start / 2 numeric usage; `sdd-verifier` 0 start / 1 usage. Nine
    numeric closing rows (903,976 tokens) have **no** same-agent `spawn.start`.
  - Per-agent digit source: `sdd-drafter`, `sdd-reviser`, `sdd-implementer` carry a
    `spawn.start` but all their tokens sit on `spawn.usage` (0 digit-carrying `spawn.end`);
    only the analyst has a digit-carrying `spawn.end`.

The lint rejections the prompt flagged (L-12 `vitest`, L-24 `compareSpecName`, L-25
`buildModel`) hold: each names a downstream consumer or a not-yet-added token that is
correctly absent from the cited range. No citation error in the v2 delta.

The delta's clean fixes: Req 2.1 reword (R1-6) no longer collides with Req 2.3; Req 3.7
(R1-1) states a coherent two-step module-relative resolution — dist copy one level up
(`dist/watch`→`dist/agent-profiles.json`), else `harness/` two levels up
(`src/watch`→root→`harness/agent-profiles.json`) — that a build and a `vitest` run both
satisfy; Req 5.2/5.3 (R1-5) name the `PHASE_ORDER` export and the `compareSpecName`
schema seat; Req 6.2 (R1-4) splits the supervisor out. Those five are sound.

The sixth fix — the Req 5.4 rewrite (R1-2) — is where the round breaks.

## Findings

### R2-1 — Req 5.4's rewritten token-source rule names only `spawn.end`, so the report cannot reach Req 5.9's mandated 1,963,320 (MUST_FIX) — Compounding; Compounds: R1-2

The v2 rewrite of Req 5.4 (accepted fix for R1-2) states the token source as:
"Per spawn, `tokens` SHALL come from a `spawn.end` row carrying a digit string;
`spawn.end` wins over `spawn.usage` when both carry one (Req 7.2), and the later
`spawn.end` wins between two." The only handling of `spawn.usage` is as the *loser* of a
tie. There is no clause that reads a `spawn.usage` digit string when the `spawn.end`
carries none. The v1 wording had that fallback ("else from the `spawn.usage` folded onto
the same spawn"); the R1-2 rewrite deleted it.

Failure scenario, on the fixture the document itself pins (Req 5.9, question-gates):
of the 23 digit-string rows summing 1,963,320, exactly **one** is a `spawn.end`
(the analyst, 45,675); the other **22** (1,917,645 tokens, 97.7%) are `spawn.usage`.
Every worker's tokens — `sdd-drafter`, `sdd-reviser`, `sdd-implementer` (which have a
`spawn.start`) and `sdd-reviewer`, `sdd-checker` (which do not) — sit on `spawn.usage`,
because the old hook wrote a token-less `spawn.end` and the orchestrator wrote the count on
`spawn.usage`. An implementer following Req 5.4 literally reads only the digit-carrying
`spawn.end` and reports **45,675** for question-gates — a 42x miss against the **1,963,320**
Req 5.9 makes a hard `SHALL`. Req 5.4 and Req 5.9 contradict each other.

This is the exact behaviour `buildModel`'s fold already gets right (`src/watch/ledger.ts:266`,
`:271`, `:285` read `spawn.usage` tokens). The R1-2 rewrite said the report "SHALL NOT reuse
`buildModel`" to escape its last-run scope and its pairing drop — correct goals — but in
rejecting the fold it dropped the fold's `spawn.usage`-token read too. Restore an explicit
"when no `spawn.end` on the spawn carries a digit string, take the `spawn.usage` digit
string" source rule (this is what Req 7.3 already requires for the watch view, and Req 5.9
requires for the report).

### R2-2 — Req 5.4 identifies a spawn by its `spawn.start` row, but the flagship fixture's largest contributors have none (MUST_FIX) — Compounding; Compounds: R1-2

Req 5.4 opens: "A spawn is identified by its `spawn.start` row; every `spawn.end` or
`spawn.usage` row for the same agent up to its next `spawn.start` closes the same spawn."
An agent with closing rows but **no** opening `spawn.start` has, under this definition, no
spawn to close — the criterion states no synthesis rule for it.

Failure scenario, on the same fixture: `sdd-reviewer` has **0** `spawn.start` rows but 7
numeric `spawn.usage` rows, and `sdd-checker` has **0** `spawn.start` but 2 numeric
`spawn.usage`. Nine numeric closing rows — **903,976 tokens, 46% of question-gates** — are
orphaned by the "identified by its `spawn.start`" rule, plus `sdd-verifier`'s start-less
spawn (1 row, dropped from the spawn count). These are reviewers and checkers that the hook
never wrote a `spawn.start` for (no brief-path prompt, `harness/hooks/sdd-activity.sh:78`),
so the orchestrator's `spawn.usage` is the only trace of the spawn.

Again `buildModel` handles this and Req 5.4 threw it away: the fold comment at
`src/watch/ledger.ts:250-255` names "a prompt-launched worker … or a **dropped
spawn.start**" and lines 275-290 synthesize a level-2 node so `render` and `tokensTotal`
still see it. Req 5.4 needs its own synthesis rule: a `spawn.usage` (or token-carrying
`spawn.end`) with no matching `spawn.start` SHALL still count as one spawn and carry its
tokens. Without it, even after R2-1 is fixed the report loses 46% of question-gates and
fails Req 5.9. R2-1 and R2-2 are independent: R2-1 loses the drafter/reviser/implementer
`spawn.usage` tokens (which *have* a `spawn.start`), R2-2 loses the reviewer/checker tokens
(which do not); both must be fixed.

Truth table for Req 5.4 (spawn = the row group; per the criterion as written):

| Row group | 5.4 verdict | Req 5.9 needs | Match |
| --- | --- | --- | --- |
| start + end(digits) | 1 spawn, tokens=end | 1, end value | yes (analyst winning end) |
| start + end(no digits) + end(digits) | 1 spawn, later end | 1, 45,675 | yes (analyst) |
| start + end(no digits) + usage(digits) | 1 spawn, tokens **0** | 1, usage value | **no — R2-1** (drafter/reviser/implementer) |
| **no** start + end(no digits) + usage(digits) | **not a spawn** | 1, usage value | **no — R2-2** (reviewer/checker) |
| start + end + usage(both digits) | end wins | end | yes (none on store) |
| only unknown/na/0 | 1 spawn, 0 tok, (+n unknown) | same | yes |

Rows 3 and 4 are every non-analyst worker in question-gates. The two green "analyst" rows
carry 45,675 of the 1,963,320 total.

### R2-3 — Req 4.7's pinned invariant is vacuous; it does not guard the line-overflow failure R1-3 raised (SHOULD_FIX) — Compounding; Compounds: R1-3

Req 4.7 (accepted fix for R1-3) ends: "Design owns the new widths; this criterion only pins
`roleW`'s 16-character floor holding on an 80-column terminal with both model columns shown."
But `roleW = Math.max(16, Math.min(30, width - indent.length - agentW - 46))`
(`src/watch/render.ts:202`): the `Math.max(16, …)` makes `roleW >= 16` hold
**unconditionally**, on any width, with or without a second model column. A test that
asserts "`roleW >= 16`" can never fail, so the one thing the criterion pins tests nothing.

The failure R1-3 named is not `roleW` dropping below 16 — it is the *total line* overflowing
80 columns (and wrapping) once a second ~16-wide model column is added while `roleW` stays
clamped at its 16 floor. That is exactly the state the vacuous pin permits: `roleW` "holds"
at 16 and the line wraps. An implementer can ship a wrapping row and pass Req 4.7. Pin the
invariant that matters: the full rendered agent line (indent + agent + declared model +
effort + actual model + role + duration + badge + tokens) SHALL fit within 80 columns with
both model columns shown, or hand the whole line layout — not just "the widths" — to design
with a fit test.

## Top 3 risks/gaps

1. **The core deliverable computes the wrong number on its own fixture** (R2-1, R2-2). Req
   5.4, rewritten this round, reports 45,675 for question-gates where Req 5.9 mandates
   1,963,320 — because it reads tokens only from `spawn.end` and identifies spawns only by
   `spawn.start`, and 97.7% of that ledger's tokens are on `spawn.usage`, 46% of them on
   start-less reviewer/checker spawns. This is the number specs 9 and 10 are judged on.
2. **The R1-2 fix removed the two `buildModel` behaviours the report actually needs.**
   Rejecting `buildModel` was right for its last-run scope and pairing drop; it was wrong to
   drop the fold's `spawn.usage`-token read and its start-less synthesis. State them
   explicitly as the report's own rules.
3. **Req 4.7 gives false assurance** (R2-3): its testable clause is a tautology, so the
   layout overflow R1-3 raised can still ship.

## Top 3 conclusions to challenge or reverse

1. **"This is the report's own algorithm … not a reuse of `buildModel`" (Req 5.4).** The
   report must reproduce two of `buildModel`'s behaviours verbatim (`spawn.usage` tokens
   when `spawn.end` has none; synthesize a spawn for a start-less closing row). The
   criterion should adopt those two behaviours by name while dropping only the last-run
   scope and the first-open-node pairing. As written it drops all three.
2. **"A spawn is identified by its `spawn.start` row" (Req 5.4).** False for the store's
   real data: reviewers and checkers have `spawn.usage`/`spawn.end` but no `spawn.start`.
   Reverse to: a spawn is identified by its opening `spawn.start` **or**, absent one, by an
   otherwise-unclaimed closing row for the agent.
3. **"Pins `roleW`'s 16-character floor holding" (Req 4.7).** Reverse to a whole-line fit
   assertion; the floor is enforced by `Math.max` and proves nothing.

## What is missing before acting on this document

- Req 5.4 rewritten so its worked fixture (question-gates, Req 5.9) actually yields
  1,963,320: an explicit `spawn.usage`-fallback token source (R2-1) and a start-less-spawn
  synthesis rule (R2-2), with the reviewer/checker rows as the worked example alongside the
  analyst.
- Req 4.7 rephrased to pin the rendered line width, not the tautological `roleW` floor (R2-3).

## Scope check

No scope drift. The deltas stay inside decomposition entry 8; deferrals to specs 9/10
(per-run effort, per-role provider, the step-4 non-token columns) remain out. The `usage`
action is read-only through `safeJoin`; no new surface added.

ESCALATE: none. `harness/hooks/` is sensitive and the document already flags the hook change
as high risk; the round's findings are correctness/completeness in a read-only report, no
security, data, money or compliance issue for a human now.

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
