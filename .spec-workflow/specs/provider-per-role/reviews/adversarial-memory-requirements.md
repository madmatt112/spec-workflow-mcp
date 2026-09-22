# Adversarial Review Memory — requirements

Last updated: 2026-09-22 (after v3 review — round 3, on doc v4)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v3)** — D2 split: start-refusal (no row, D5) vs mid-run missing-launcher
  (`PHASE: error`, Req 2 crit 4). Fixed in v3.
- **R1-2 (SHOULD_FIX, v3)** — Req 2 crit 5/6 pass the `claude-*` alias, not the DeepSeek name.
  Fixed in v3 — but the response-side model contract was left unreconciled (R2-1, then R3-1).
- **R1-3 (SHOULD_FIX, v3)** — D5 map/key checks finish at the roots step before run id / event.sh
  / pointer line / run.start. Verified. Correct.
- **R1-4 (SHOULD_FIX, v3)** — Scope note records decomposition scenario 4 "with a note"; Req 7
  "as written" = the outcome. Fixed in v3.
- **R1-5 (SHOULD_FIX, v3)** — Req 2 crit 1 adds `HARNESS_REPO` (`SKILL.md:204`). Verified.
- **R1-6 (SHOULD_FIX, v3)** — Req 2 crit 7 rewritten for main-checkout document-phase context.
  Verified against `SKILL.md:270-282`.
- **R1-7 (SHOULD_FIX, v3)** — Req 2 crit 5's `agent-profiles.json` rationale reworded. Fixed in
  v3; the "ignored" wording was itself problematic (R2-2), now made contingent in v4.
- **M1 (MINOR, v3)** — Req 3 crit 3 requires a fresh `--session-id` per launcher call. Fixed.
- **M2 (MINOR, v3)** — fifth machine-read line count word; implementation-phase follow-through.
- **R2-1 (MUST_FIX, v4)** — Req 4 crit 4 credential proof re-based on `ANTHROPIC_API_KEY`
  absence; Req 6 crit 2 makes `message.model` a preflight-measured fact; Req 7 crit 1 asserts the
  recorded value. Credential half is sound. **But the settlement is inconsistent — see R3-1.**
- **R2-2 (SHOULD_FIX, v4)** — Req 2 crit 5 `--agents` key acceptance now contingent on Req 6 crit
  5's preflight, not settled. Applied.
- **R2-3 (MINOR, v4)** — Scope note records `decomposition.md:344,346,371-373` stale wording.
  Applied (line 149). L-1 lint warning on this line is a FALSE POSITIVE: `ANTHROPIC_MODEL` sits
  at :346, which the `:344,346` citation includes.
- **R2-4 (MINOR, v4)** — Reliability NFR (line 123) separates the missing-launcher `PHASE: error`
  case from the no-row start refusals. Applied.

### Partially Accepted
- (none)

### Rejected
- (none — rounds 1, 2 and 3 opened no rejections)

### Unresolved (round 3, on doc v4)
- **R3-1 (MUST_FIX, Compounds: R2-1, fix-induced)** — preflight (a) (Req 6 crit 2) runs
  `--model deepseek-v4-pro`, a value the launcher is forbidden to send (Req 2 crit 5, "never the
  DeepSeek name") and which the settled facts (`decomposition.md:255-258`, "any other name →
  deepseek-flash") route to `deepseek-flash`. The v4 R2-1 fix then made preflight (a) the oracle
  for Req 7 crit 1's real run, which sends `--model claude-opus-4-8`. So (i) the gating probe
  validates a forbidden path on the wrong model (D7 void); (ii) if the endpoint echoes the
  request, Req 7 crit 1 fails on a correct run; (iii) within preflight (a) `--model` and
  `ANTHROPIC_MODEL` name different models. Surviving DeepSeek-name assumption: Req 7 crit 1 +
  Req 3 crit 1 require `spawn.start`.model (map name `deepseek-v4-pro`) to "match what preflight
  recorded" (`message.model`), i.e. still assume `message.model == deepseek-v4-pro`. Preflight
  (a)'s pass gate is file+verdict only; `message.model` equality is recorded, never gated.
- **R3-2 (SHOULD_FIX, Recurring [r2 conclusion #3], Compounds: R2-2)** — preflight (a) passes on
  "file + verdict block" alone (Req 6 crit 2). Every launcher-critical fact (Req 6 crit 5's five
  probes: auth, `--agents` keys, transcript location + `--session-id`, child hooks, effort;
  plus `message.model`) is recorded with no consequence branch, except (a)-fails→escalate,
  (b)→reviser eligibility, child-hooks→disable. If the transcript-location/`--session-id` probe
  fails, (a) still passes, the spec ships, and every DeepSeek `spawn.end` reads `tokens=unknown`,
  defeating Requirement 5. New evidence vs r2: the v4 delta added Req 7 crit 1 and the launcher
  transcript locator as load-bearing consumers of (a)'s ungated output.

## Patterns & Themes

- **Assert-what-you-also-probe / half-swept fixes (persistent, now three rounds).** The dominant
  pattern from r2 recurs at r3, one layer deeper. R1-2 fixed the launcher's `--model` to the
  alias but left preflight (a) on the DeepSeek name; R2-1's fix built the E2E oracle on that
  same un-swept preflight. Each accepted fix reconciled the clause it named and left the
  *consumer* of the changed value unreconciled. For round 4: when a fix changes what a value is
  (here `message.model` / `--model`), check EVERY place that value is produced (preflight) and
  consumed (spawn rows, E2E oracle, credential proof) — not only the clause the finding named.
- **Preflight gating is the soft spot.** The one gate (a) that blocks the spec (D8) has a pass
  condition (file+verdict) far weaker than the facts D7 says it secures. Attack the gap between
  what a preflight *records* and what it *blocks on*.
- Citations remain accurate. spec-lint clean but for L-1 (false positive, resolved). Both ends
  of every cited range re-read in r3 (fresh lens); `path:line` resolution is trustworthy —
  attack meaning and internal consistency, not resolution.

## Guidance for Next Review

- Confirm R3-1 is resolved by a REAL reconciliation, not another relabel: preflight (a) must
  probe with the launcher's own `--model` alias (`claude-opus-4-8`), and `message.model` must
  have ONE defined expectation that Req 7 crit 1 can check — with `spawn.start`.model (map name)
  and `spawn.end`.model (observed) treated as the different values they are. Do NOT accept "Req 7
  asserts what preflight recorded" as a fix while the two runs send different `--model` values;
  that is the same non-fix R1-2→R2-1 already produced twice.
- Confirm R3-2: does any Req 6 crit 5 probe that falsifies a Req 2/Req 3 launcher assumption now
  cause a block, or is (a)'s pass condition strengthened to require a located, parsed transcript?
- Well-covered, do not re-mine: refusal ordering (R1-3), worktree/main-checkout (R1-6),
  `HARNESS_REPO` (R1-5), fresh session-id (M1), the D2 split / Reliability NFR (R1-1, R2-4), the
  Scope-note decomposition divergences (R1-4, R2-3, incl. L-1 false positive), R2-2 contingency.
  Credential handling itself (env-only, `ANTHROPIC_API_KEY` absent, Req 4 crit 4) is sound.
- Lenses spent: r1 wire-contracts, r2 cold-read truth table, r3 both-ends citation re-read. A
  round 4 needing a fresh angle: failure/partial-failure paths, or each prescribed test verified
  as a writable assertion against the installed CLI (`claude -p` flag behaviour).
- Rulings closed by revision history / Gate A: refuse-never-fall-back, refused-at-start writes no
  row, failed preflight blocks the spec, Anthropic total is the headline, provider-map location.
  Attack their internal consistency only, not their merits.
