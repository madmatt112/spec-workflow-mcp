# Adversarial Analysis — agent-cache-ttl/requirements (v3), round 2

Second adversarial review. Primary surface: completeness, ambiguity, scope. Fresh lens for
this round: a cold read for internal contradictions plus a truth table of the stated
cases — enumerating every acceptance criterion in Requirements 1–6 and building the case
table for the cache-tier / unknown / dash / gap-rewrite outputs to find a pair of criteria
that cannot both hold. The v3 delta (R1-1..R1-6 fixes) was attacked first.

## What I checked and how

- Read the v3 target in full, the memory file, the round-1 analysis, `codebase-context.md`,
  and decomposition entry 13 (`.spec-workflow/spec-decomposition/decomposition.md:394-464`).
- Re-verified both ends of every code range the v3 delta touches or cites:
  `scripts/sync-plugin-assets.cjs:76-128` (the generic per-line split at 93-98 and the
  `:107` object literal), `src/watch/usage.ts` (whole file — `UsageCell`, `reduceSpawn`,
  `buildUsageReport`, `formatOne`/`formatCompare`, and the `providers.anthropic.spawns` /
  `report.providers.anthropic.spawns` fields crit 6 now names), `src/watch/render.ts:44-58,
  192-234` (`padRight` pads-not-truncates; the tier line at 226 is `padRight(declared, 23)`),
  `src/watch/ledger.ts:38-42,51-78` (`AgentProfile { model, effort, role }`;
  `loadAgentProfiles` drops extra keys at 70), the three orchestrator frontmatters (model
  line 4, effort line 5 in each), `harness/skills/sdd-continue/SKILL.md:33-107`,
  `harness/skills/sdd-continue/references/formats.md:160-208`.
- Counted the agent files: 12 top-level `.md`, no subdirectories, so Req 1 crit 2's "other
  nine" is exact (12 − 3).
- Cross-checked the delta's numbers: decomposition says "the three orchestrator roles made
  92 of the 95 rewrites after a gap" and "about 35% less" — the Alignment paragraph's "92 of
  95" and "35%" are faithful. `providers.anthropic.spawns` and `report.providers.anthropic
  .spawns` both exist on `UsagePhase` / `UsageReport` (`usage.ts:16-24`), so crit 6's cited
  count sources are real (not a MUST_FIX artifact error).

## The R1-1 rewrite (Req 6 crit 7 + D10) — attacked first, and it holds

The v3 rewrite retargets the block from the pre-merge "ready for review" transition to the
post-merge retrospective start. Traced against this machine's merge-first build model
(CLAUDE.md; `.spec-workflow/agent-rules.md`):

- No clause now gates a pre-merge transition on post-merge evidence. Crit 7 lets the PR
  "open, be reviewed and merge on scenarios (4) and (6) alone"; (4)/(6) are runnable in the
  gate session, so opening/merge are reachable.
- The post-merge block ("The spec's retrospective phase SHALL NOT start until a rebuilt-harness
  restart has run them and recorded evidence") is satisfiable: after merge → build → restart,
  the changed hook/agents/skill are live, a restarted session runs (1),(2),(3),(5), then the
  retrospective starts. No deadlock.
- "mandatory" is not weakened to "deferred": the live half is a hard precondition of the
  retrospective, and the only normative "defer" text left is the rejected option inside D10.
  Scenarios (4)/(6) are byte-unchanged from v1/v2.
- D10 agrees with crit 7 ("The block targets the spec's post-merge retrospective start …, not
  v2's pre-merge 'ready for review' state").

R1-1 is resolved. The one residue is who records the live-half evidence and where — see
R2-3 (MINOR).

## Topics attacked

### 1. Req 4 crit 6 — the `unknown` collapse on a just-rewritten clause (the R1-3 fix)
- Truth-table the equality test `cacheUnknown == count` at its boundaries: a total cell with
  zero Anthropic spawns gives `0 == 0`.
- Stress-test crit 6 against crit 4 (DeepSeek adds nothing to `cacheUnknown`) for an
  all-DeepSeek phase or run.
- Cross the crit-6 collapse with Req 3 crit 7 and Req 4 crit 2: `cacheUnknown` is incremented
  for two different unknown kinds, but crit 6 blanks all three columns off the one counter.

### 2. Req 1 crit 4 / crit 5 — the extraction and its independent test (the R1-2 fix)
- Re-derive the extraction: `experimental` value is `{ cacheTtl: 1h }`; "the token between
  `cacheTtl:` and the next `}`, trimmed" yields `1h`. Correct, and crit 5 pins `"1h"`
  independently of the self-referential `check:plugin-assets`. Resolved.

### 3. Req 2 crit 4 — the tier-line separator at pad width (the R1-4 fix)
- `claude-opus-4-8 high 1h` is exactly 23 chars, so `padRight(declared, 23)` adds no space;
  crit 4 now requires "a separating space kept even at the pad width" and hands the width to
  design. Resolved.

### 4. Req 5 crit 2.2 / crit 4 / crit 6 (the R1-5, R1-6 fixes)
- Numeric three-component version compare stated; `unknown` warning split from the override
  warning; the crit-6 test now stages the code-root fixture and all three settings tiers and
  crit 2.5 defines the code root. Resolved.

## Findings

### R2-1 — SHOULD_FIX — Novel; Compounds R1-3 — Req 4 crit 6 prints `unknown` for an all-DeepSeek total
Crit 6 now says a total cell's count is `ph.providers.anthropic.spawns` (or
`report.providers.anthropic.spawns`) and that the three cache columns print `unknown` when
`cacheUnknown` **equals** that count. Consider a phase — or a whole run — whose spawns are all
DeepSeek. DeepSeek adds nothing to `cacheUnknown` (crit 4), so `cacheUnknown = 0`, and
`ph.providers.anthropic.spawns = 0`. The equality `0 == 0` fires, so the phase-total and
grand-total cache columns print `unknown`. That is wrong: there is no Anthropic spawn for the
cache lifetime to be unknown about, and `unknown` reads as "Anthropic cache data exists but
could not be read." The honest output is `-` (matching crit 4's DeepSeek dash convention) or
`0`. The bug bites a **keyed** ledger with an all-DeepSeek phase; crit 8 masks it on the old
`provider-per-role` ledger (which wants every total `unknown` anyway), and the `provider-per-role`
comparison in scenario (4) is exactly a mixed/DeepSeek-heavy ledger, so the trigger is not
hypothetical. The v3 rewrite of crit 6 introduced the precise `providers.anthropic.spawns`
count and left the `== 0` boundary unguarded. Fix: require the count to be above 0 before
collapsing to `unknown`, and state what an all-DeepSeek total prints.

### R2-2 — SHOULD_FIX — Novel; Compounds R1-3 — Req 3 crit 7 and Req 4 crit 2/6 cannot both hold: known writes shown as `unknown`
`cacheUnknown` is one counter fed by two different unknown kinds. Req 4 crit 2: a spawn whose
row "has no digit string in one of `cacheWrite5m`, `cacheWrite1h`" counts 1 in `cacheUnknown`
(writes unknown); **and** a spawn where "only `gapRewrites` is not a digit string" *also* counts
1 in `cacheUnknown` while its two write sums are added (writes **known**). The second kind is
exactly the Req 3 crit 7 row — cache split present, timestamp unparseable — which crit 7
deliberately keeps `cacheWrite5m`/`cacheWrite1h` as their real sums because they are trustworthy.
But crit 6 blanks **all three** columns to `unknown` whenever `cacheUnknown == count`. So a cell
whose spawns are all crit-7 rows (writes known, only gaps unknown) prints `unknown` for
`cw5m`/`cw1h` and discards write sums crit 7 and crit 2 told the fold to keep. This is the
truth-table pair that cannot both hold: crit 7 says those two columns are known and kept; crit 6
says display them `unknown`. It is not the safe direction the Reliability NFR intends ("never a
partial sum shown as known") — it is the reverse, a known sum hidden — and it defeats the spec's
stated purpose ("prove the saving per spawn / per phase") for a case the spec itself anticipates
(crit 7 exists only for it). The grand total is affected too: an all-crit-7 run prints `unknown`
for `cw5m`/`cw1h` over real, non-zero sums. Fix: gate each column's `unknown` on its own
unknown kind — collapse `cw5m`/`cw1h` only when the writes are actually unknown, and let a
gap-only-unknown cell keep its write sums (with `gapRewrites` `unknown` or `(+N unknown)`), or
split `cacheUnknown` into a write-unknown count and a gap-unknown count. Mixed cells already work
via crit 6's second branch; only the `cacheUnknown == count` branch is wrong.

### R2-3 — MINOR — Compounds R1-1 — Req 6 crit 7 names no record for the live-half evidence
The rewrite fixed the deadlock but still does not say where the (1),(2),(3),(5) evidence from
the rebuilt-harness restart is recorded, in what artifact, or what check the retrospective runs
to confirm it before it starts. "recorded evidence" is the whole gate, yet the gated-on artifact
is unnamed. This does not keep the loop alive on its own; name the record (e.g. a tracked
verification note the retrospective reads) so the block is checkable rather than a convention.

## Top 3 risks / gaps

1. The report's `unknown` collapse (R2-1, R2-2) is where the feature's headline number — the
   5m-vs-1h split and the gap-rewrite count — is read, and both crit-6 boundaries produce a
   misleading or data-losing cell on inputs the spec itself sets up (an all-DeepSeek total; a
   timestamp-only-unknown spawn). This is the exact column the retro judges the spec by.
2. `cacheUnknown` is overloaded (writes-unknown + gap-unknown) and crit 6 drives all three
   columns off it — a design seam, not a wording slip; the fix needs a split counter or a
   per-column rule, so it should land in requirements, not be discovered in implementation.
3. Residual: the live-half completion record (R2-3) is a convention with no named artifact.

## Top 3 conclusions to challenge

1. **"`cacheUnknown` equal to its Anthropic spawn count ⇒ print `unknown`" is now well-defined
   (Req 4 crit 6).** It is well-sourced for the count but wrong at two boundaries: `0 == 0`
   for an all-DeepSeek total (R2-1) and an all-known-writes/all-unknown-gaps cell (R2-2).
2. **The three cache columns share one collapse rule.** They should not: writes and gap-rewrites
   have independent unknown states (Req 3 crit 6 vs crit 7). Give `gapRewrites` its own unknown
   handling so a known write sum is never blanked.
3. **The R1-1 gate is only "reworded".** Reviewed in full: the mechanism is now satisfiable on
   this machine. Reverse the round-1 concern — crit 7 is fine; only the unnamed evidence record
   (R2-3) remains.

## What is missing before acting on this document

- A per-column `unknown` rule (or a split `cacheUnknown`) so a gap-only-unknown cell keeps its
  known write sums (R2-2), and a `count > 0` guard plus a stated all-DeepSeek-total output
  (R2-1).
- The named artifact and owner for the post-merge live-half evidence the retrospective gates on
  (R2-3).

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```

`iterate` — two SHOULD_FIX on Req 4 crit 6 (the all-DeepSeek `0 == 0` collapse, and the
known-writes-shown-as-unknown conflict with Req 3 crit 7 / Req 4 crit 2) block convergence.
The R1-1 Gate A rewrite and the other five round-1 fixes are verified resolved.
