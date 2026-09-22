# Adversarial Analysis — provider-per-role/requirements (v3, round 2)

Round 2. Round 1 accepted all nine findings and rewrote the document; v3 is under review.
spec-lint reported 0 findings on v3, so I trusted `path:line` resolution and attacked
meaning. I read both ends of every citation the round-1 delta introduced or leans on:
`SKILL.md:56,63-67,71-72,76-86,190-208,270-282`, `agent-profiles.json:47-51`,
`decomposition.md:248-258,340-387`. Attack order per the round prompt: the v3 deltas first
(the round-1 fixes), then the fresh lens — a cold read for internal contradictions and a
truth table of the run lifecycle and the preflight matrix.

Round 1 used the wire-contract lens across the three boundaries. This round I did not repeat
it; I built the case table and checked that every acceptance criterion, NFR and decision
agrees after the churn. The delta is mostly clean: R1-1 (D2 split), R1-3 (refusal ordering at
the roots step, verified against `SKILL.md:71-72` vs the `76-86` ledger block — the check sits
before the run id / `event.sh` / pointer line / `run.start`, correct), R1-5 (`HARNESS_REPO`,
`SKILL.md:204`, accurate), and R1-6 (worktree entry is implementation-only, `SKILL.md:270-282`,
accurate) all hold. M1's fresh-uuid clause is sound. One fix, R1-2, propagated only half-way
and left a contradiction; two smaller seams follow it.

---

## 1. The R1-2 fix (claude-* alias) collides with the "message.model is a DeepSeek name" claims

The round-1 fix for R1-2 changed Req 2 criterion 5 and 6 so the launcher passes the `claude-*`
alias the endpoint maps (`--model claude-opus-4-8`, `ANTHROPIC_MODEL` the same alias), never
the DeepSeek name. That correctly kills the silent-downgrade path. But the same delta left
untouched three clauses that assert the child's transcript `message.model` **is a DeepSeek
name**, and it did not close R1-2's own second half (the preflight measures `message.model`
but asserts nothing about it). The result is a live internal contradiction.

- **R2-1 (MUST_FIX) — `fix-induced`, `Compounds: R1-2`. The launcher now requests
  `claude-opus-4-8`, yet the credential proof and the end-to-end assertion both require the
  response `message.model` to come back a DeepSeek name — a fact the document never settles and
  the R1-2 change makes doubtful.**
  - Req 2 crit 5/6 (lines 37-38, R1-2 delta): request carries `--model claude-opus-4-8` and
    `ANTHROPIC_MODEL=claude-opus-4-8`.
  - Req 4 crit 4 (line 67, untouched): "preflight (a) SHALL show the session's Anthropic
    credential was not used (**the child's transcript `message.model` is a DeepSeek name**)."
    This is the *entire* proof mechanism for credential isolation.
  - Req 7 crit 1 (line 105, reworded but kept): the `spawn.end` carries "**a DeepSeek model
    name**" — an E2E assertion.
  - Req 3 crit 1 (line 51): `spawn.start` writes `model=<requested DeepSeek name>` (= the map's
    `deepseek-v4-pro`); Req 3 crit 2 (line 52): `spawn.end` writes the actual `message.model`.
  - The settled endpoint facts (`decomposition.md:255-258`) describe only *routing*
    (`claude-opus*`→`deepseek-v4-pro`); they say nothing about what the response `model` field
    contains. The document itself treats `message.model` as unknown-until-measured — Req 6 crit
    2 "the record SHALL include message.model", with no pass/fail on its value.
  - Failure scenario: DeepSeek's Anthropic-compatible endpoint echoes the **requested** model
    string (the common behaviour), so `message.model = claude-opus-4-8`. Then (i) Req 7 crit 1's
    test fails on a *correct* DeepSeek run because the model name is not a DeepSeek name; (ii)
    Req 3's own rows disagree — `spawn.start` says `deepseek-v4-pro`, `spawn.end` says
    `claude-opus-4-8`; (iii) worst, Req 4 crit 4's proof collapses: an Anthropic run and a
    DeepSeek run would *both* report `claude-opus-4-8`, so `message.model` can no longer show
    the Anthropic credential was not used. A leaked `ANTHROPIC_API_KEY` in the child would be
    invisible to the one check that is supposed to catch it. Before R1-2 the request carried
    `deepseek-v4-pro`, so the echo would at least *look* like a DeepSeek name; the alias fix
    removed that coincidence without repairing the proof.
  - And preflight (a) does **not** catch it: its pass condition (Req 6 crit 2) is only "analysis
    file exists and ends with the verdict block." So (a) passes while `message.model` is
    `claude-opus-4-8` and every downstream "DeepSeek name" claim is silently false — exactly the
    gap R1-2 flagged, re-manifested through the accepted fix.
  - Resolve by making `message.model` a defined preflight probe with a branch, and rewriting
    Req 4 crit 4's credential proof to rest on a signal that survives the alias (e.g.
    `ANTHROPIC_API_KEY` absent in the child's environment plus a controlled
    claude-alias-on-Anthropic baseline to compare `message.model` against), and conditioning Req
    7 crit 1's "DeepSeek model name" assertion on the measured behaviour rather than asserting
    it. Do not leave two clauses asserting a value the same document schedules to discover.
  - ESCALATE judgement: this is a flaw in the *verification method* of a requirements document,
    not a live secret exposure — the key handling itself (env only, never stored, child never
    carries `ANTHROPIC_API_KEY`) is unchanged and the preflight is the venue to settle it. No
    human ruling is needed now. `ESCALATE: none`.

## 2. The R1-7 fix asserts the `--agents` model/effort keys are "ignored" — the same clause the preflight is scheduled to probe

- **R2-2 (SHOULD_FIX) — `Compounds: R1-7`.** Round 1 rejected the "declared model and effort for
  the ledger" rationale as wrong; the fix reworded Req 2 crit 5 (line 37) to say
  `agent-profiles.json` "feeds the `--agents` JSON's **ignored** `model`/`effort` keys." Two
  problems in the new wording:
  - If the keys are ignored, the launcher does not *need* `agent-profiles.json` to build a
    working `--agents` definition — the agent file already supplies `tools` and body. The stated
    purpose undermines the stated dependency, so an implementer cannot tell whether to wire
    `agent-profiles.json` into the launcher at all. (The Compatibility NFR line 127 still says
    `agent-profiles.json` "keeps its shape," implying it matters.)
  - Worse, "accepts these keys" and "the keys are ignored" are precisely what Req 6 crit 5
    schedules the preflight to discover: "whether `--agents` accepts `tools` and `model` keys …
    whether declared `effort` reaches DeepSeek (expected ignored)." So Req 2 crit 5 builds the
    launcher on an assumption (`--agents` accepts and ignores a `model` key) that the same
    document says is not yet proven. If the preflight finds `--agents` rejects a `model` key, the
    launcher built to crit 5 emits invalid `--agents` JSON. State the dependency as contingent on
    the preflight, or drop `agent-profiles.json` from the launcher and let the agent file be the
    sole source of the `--agents` definition.

## 3. The launcher `--model` contract and one refusal clause now diverge from the decomposition, unrecorded

- **R2-3 (MINOR) — `Compounds: R1-2, R1-4`.** Round 1 (R1-4) established that where the spec
  diverges from the decomposition's wording it records the divergence (Scope note line 148 flags
  decomposition scenario 4's stale "with a note"). The R1-2 fix created a second, larger
  divergence that is **not** recorded: `decomposition.md:344,346` states the launcher passes
  "`--model` the DeepSeek name" and "`ANTHROPIC_MODEL` set to the same name" — the exact contract
  Req 2 crit 5/6 now reverses. And the decomposition's "Decided" bullet
  (`decomposition.md:371-373`) still reads "A DeepSeek role with no key **refuses at `run.start`
  with a `note`**," which conflicts with D5 twice over (no ledger row; refusal *before*
  `run.start`, not *at* it) — yet the Scope note flags only scenario 4 at 383-384, not this
  bullet. The requirements are self-consistent and grounded in the settled facts (256-258), so
  this is traceability, not a functional defect; but a designer cross-reading the decomposition
  meets a launcher contract and a refusal contract that contradict the requirements. Extend the
  Scope note to record both, as the R1-4 fix did for scenario 4.

## 4. The Reliability NFR still lumps the missing launcher with the start-refusals R1-1 split apart

- **R2-4 (MINOR) — `Compounds: R1-1`.** R1-1 was accepted to split the missing-launcher case
  (mid-run `PHASE: error`, which *does* write ledger rows, Req 2 crit 4) from the start-refusal
  cases (no ledger row, D5). The Reliability NFR (line 123) was edited by the same delta but
  keeps the conflation: "a missing key, **launcher** or bad map row stops the run; a start
  refusal writes no ledger row." A reader taking the NFR alone can place the missing launcher in
  the same no-row group as the key/map cases, contradicting D2 and Req 2 crit 4. The criteria are
  authoritative so the risk is low, but the summary line should name the launcher case as the
  mid-run `PHASE: error` path, not group it with the start refusals.

---

## Truth table — the cases hold except where noted

| Case | Ledger effect | Consistent? |
|------|---------------|-------------|
| Refused at start (missing key / bad map row) | no run id, no `event.sh`, no pointer line, no `run.start` (D5, roots step) | yes — R1-3 fix verified against `SKILL.md:71-72` vs `76-86` |
| Mid-run missing launcher | orchestrator `PHASE: error`, rows written (Req 2 crit 4) | criteria yes; **NFR line 123 blurs it (R2-4)** |
| Clean DeepSeek run | launcher writes `spawn.start`+`spawn.end`; `message.model` on end | **model-name identity unsettled (R2-1)** |
| Clean Anthropic (map explicit or absent) | today's shape, no `provider` key; prompt-launched reviewer/checker keeps the known no-`spawn.start` gap (Scope note line 149) | yes |
| Preflight (a) fails | `PHASE: escalate`, spec blocked (Req 6 crit 6, D8) | yes |
| Preflight (a) passes but `message.model` ≠ DeepSeek name | (a) still passes; Req 4 crit 4 / Req 7 crit 1 silently false | **no — R2-1** |
| Preflight (b) pass/fail | reviser eligible / stays Anthropic (Req 6 crit 4) | yes |

The prompt named a preflight "(c)"; the document defines only (a) and (b) plus five recorded
probes (Req 6 crit 5). No (c) exists — the wording in the prompt is loose, not a missing case.

## Top 3 risks / gaps

1. **R2-1 (MUST_FIX)** — the credential-isolation proof (Req 4 crit 4) and the E2E model-name
   assertion (Req 7 crit 1) both require `message.model` to be a DeepSeek name, but the R1-2 alias
   fix makes the request carry `claude-opus-4-8`; if the endpoint echoes the request the proof
   voids and the test fails on a correct run. The doc never settles the response model field and
   the preflight does not gate on it.
2. **R2-2 (SHOULD_FIX)** — Req 2 crit 5 states the `--agents` `model`/`effort` keys are "ignored"
   and reads `agent-profiles.json` to fill them, while Req 6 crit 5 schedules the preflight to
   discover whether `--agents` accepts those keys at all; the launcher is built on an unproven
   schema assumption.
3. **R2-3 (MINOR)** — the launcher `--model`/`ANTHROPIC_MODEL` contract and one refusal bullet
   now contradict the decomposition (`decomposition.md:344,346,371-373`) with no Scope note,
   though the doc records the twin divergence at scenario 4.

## Top 3 conclusions to challenge or reverse

1. **"The child's transcript `message.model` is a DeepSeek name" (Req 4 crit 4, Req 7 crit 1).**
   Reverse to a measured fact. After R1-2 the request carries a `claude-*` alias; the response
   model field is unproven and probably echoes the request. The credential proof must not depend
   on it.
2. **"`agent-profiles.json` feeds the `--agents` JSON's ignored keys" (Req 2 crit 5).** Either
   the keys are load-bearing (schema-required) — then "ignored" is wrong and the values matter —
   or they are truly ignored — then the launcher does not need `agent-profiles.json`. Pick one;
   do not assert a settled answer to a question the preflight is scheduled to ask.
3. **Preflight (a)'s pass condition (Req 6 crit 2).** "Analysis file exists and ends with the
   verdict block" is too weak to protect the accounting and the credential claim the whole spec
   rests on; it must also assert the provider actually served the run.

## What's missing before acting on this document

- Reconcile the request-side alias (Req 2 crit 5/6) with the three response-side "DeepSeek name"
  claims (Req 3 crit 1-2, Req 4 crit 4, Req 7 crit 1): decide what `message.model` is expected to
  be, make it a preflight probe with a branch, and re-base the credential proof on a signal that
  survives the alias.
- Settle whether the launcher needs `agent-profiles.json` at all, contingent on the Req 6 crit 5
  probe of `--agents` key acceptance.
- Record the launcher-contract and refusal-timing divergences from `decomposition.md`
  (344/346/371-373) in Scope notes, as R1-4 did for scenario 4.
- Fix the Reliability NFR to keep the missing-launcher (`PHASE: error`, rows written) case out of
  the start-refusal (no-row) group.

ESCALATE: none — the credential handling itself (env only; never in store, ledger, HANDOFF or
commit; child never carries `ANTHROPIC_API_KEY`) is unchanged. R2-1 is a flaw in the *proof
method* for that isolation, resolvable by a spec edit and the preflight; no live secret,
destructive action, or money/legal surface a human must review now.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
