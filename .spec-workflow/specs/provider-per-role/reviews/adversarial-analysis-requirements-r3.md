# Adversarial Analysis — provider-per-role/requirements (v4, round 3)

Round 3, on doc v4. Attack order per the round prompt: the v4 delta first (the R2-1
three-point settlement), then the fresh lens — every cited artifact re-read at both ends of
its range. Round 1 used the wire-contract lens, round 2 the cold-read truth table; I used
neither.

Fresh-lens sweep (both ends read, meaning confirmed): `decomposition.md:248-258,327-391`
(model mapping and the two "Decided"/scenario bullets the Scope notes cite),
`SKILL.md:58-72,76-86,190-208,226-234,270-282`, `formats.md:5-17,123-135,163-198`,
`sdd-document-phase/SKILL.md:23-27,44-52,156-164`, `briefs.md:125-176,225`,
`agent-profiles.json:45-62`, `sdd-reviewer.md:1-13`, `sdd-checker.md:1-13`,
`sdd-activity.sh:1-49,104-123`, `usage.ts:13-23,76-101`, `ledger.ts:94-114,262-289`,
`render.ts:67-79,200-211`, `harness-events.jsonl:104-105`, `step-0-answers.md:1-17`,
`SDD-HARNESS.md:263-282`. Every `path:line` resolves and every sentence matches its lines.

**L-1 (citation-identifier warning, line 149) — checked, no finding.** The Scope note cites
`decomposition.md:344,346` for "`--model` the DeepSeek name" / "`ANTHROPIC_MODEL` set to the
same name." `--model` the DeepSeek name is at :344; `ANTHROPIC_MODEL set to the same name` is
at :346. Both lines are in the citation. The lint check flagged `ANTHROPIC_MODEL` as absent
from :371-373 and :344 but the token sits at :346, which the `:344,346` citation groups. The
citation is accurate; meaning holds. Drop nothing.

R2-3 (Scope note line 149) and R2-4 (Reliability NFR line 123 now separates the missing
launcher from the no-row start refusals) are applied and correct in v4. R2-2's Req 2 crit 5 is
now contingent ("whose acceptance Requirement 6 criterion 5 preflights"), not settled. The
delta is clean on those three. The R2-1 settlement is **not** consistent — see below.

---

## 1. The R2-1 settlement: preflight (a) validates a `--model` the launcher is forbidden to use

The v4 fix for R2-1 placed the response-model contract at three points: Req 4 crit 4
(credential proof rests on `ANTHROPIC_API_KEY` absence), Req 6 crit 2 (preflight (a) "SHALL
state whether `message.model` … equals the requested `--model` value"), and Req 7 crit 1
(the E2E ledger assertion is "`model` matching what preflight (a) recorded"). The credential
half is sound: Req 4 crit 4 no longer leans on `message.model`. But the settlement made
preflight (a) the oracle for the ledger's model, and preflight (a) runs a **different**
`--model` than the launcher — so the oracle measures the wrong request.

- **R3-1 (MUST_FIX) — `fix-induced`, `Compounds: R2-1`. Preflight (a) is defined with
  `--model deepseek-v4-pro` (Req 6 crit 2, line 92), but the launcher is forbidden from ever
  passing that value (Req 2 crit 5, line 37: `--model` = the `claude-*` alias, "never the
  DeepSeek name"). The v4 fix then made preflight (a)'s recorded `message.model` the oracle
  for Req 7 crit 1's real-run assertion. The two runs send different `--model` values, so the
  oracle can never be trusted, and per the document's own settled facts preflight (a) probes
  the wrong model.**

  - Req 6 crit 2 (line 92): preflight (a) = `claude -p … --model deepseek-v4-pro`, recording
    "whether `message.model` … equals the requested `--model` value" (i.e. whether
    `message.model == deepseek-v4-pro`).
  - Req 2 crit 5 (line 37): the launcher passes `--model claude-opus-4-8` for a reviewer
    mapped to `deepseek-v4-pro`, "never the DeepSeek name." Req 2 crit 6 (line 38):
    `ANTHROPIC_MODEL` = the same alias, `claude-opus-4-8`.
  - The settled endpoint facts the document relies on (`decomposition.md:255-258`, re-read):
    the endpoint maps `claude-opus*`→`deepseek-v4-pro`, `claude-sonnet*`/`claude-haiku*`→
    `deepseek-flash`, **and any other name silently to `deepseek-flash`.** `deepseek-v4-pro`
    is "any other name" — it is not a `claude-*` string. So `--model deepseek-v4-pro` routes to
    `deepseek-flash`. This is the exact fact that produced the R1-2 alias fix; preflight (a)
    contradicts the reasoning behind Req 2 crit 5.
  - Failure scenario A (preflight probes the wrong model): preflight (a) runs the reviewer on
    `deepseek-flash`, not `deepseek-v4-pro`. Its recorded `message.model` and usage describe a
    model the launcher never uses. D7's promise — "the launcher is built on tested behaviour" —
    is void; the one gating probe validates a forbidden path.
  - Failure scenario B (the oracle fails on a correct run): the launcher run sends `--model
    claude-opus-4-8`; preflight (a) sent `--model deepseek-v4-pro`. If the endpoint echoes the
    requested string, preflight records `message.model = deepseek-v4-pro` while the real run's
    `spawn.end` carries `message.model = claude-opus-4-8`. Req 7 crit 1's "`model` matching what
    preflight (a) recorded" then fails on a correct DeepSeek run.
  - Within preflight (a) itself the model signal is contradictory: `--model deepseek-v4-pro` on
    the CLI but `ANTHROPIC_MODEL=claude-opus-4-8` in "the environment of Requirement 2
    criterion 6." One invocation, two different model names; which the endpoint honours is
    undefined and unrecorded.
  - The surviving "DeepSeek name" assumption the prompt asked about: **yes, one survives.** Req 7
    crit 1 applies "`model` matching what preflight (a) recorded" to **both** `spawn.start` and
    `spawn.end`, but Req 3 crit 1 (line 51) fixes `spawn.start`'s `model` = the map's requested
    DeepSeek name (`deepseek-v4-pro`), while Req 3 crit 2 (line 52) sets `spawn.end`'s `model` =
    the observed `message.model`. For both rows to "match what preflight recorded," preflight's
    `message.model` must equal `deepseek-v4-pro` — i.e. Req 7 crit 1 still assumes the response
    model is the DeepSeek name, the assumption R2-1 was accepted to remove.
  - The pass/fail question the prompt asked: preflight (a)'s pass condition (Req 6 crit 2) is
    only "analysis file exists in that format and ends with the verdict block." The
    `message.model` equality is **recorded, never gated** — a no-op for pass/fail. So (a) passes
    while `message.model` is anything at all, and Req 7 crit 1 then asserts equality against a
    value (i) measured under the wrong `--model` and (ii) never required to be sane.
  - Resolve by running preflight (a) with the launcher's own `--model` (the `claude-*` alias),
    not `deepseek-v4-pro`, so the probe measures the launcher's real request; and by deciding a
    single defined expectation for `message.model` (record the value, and state the rule Req 7
    crit 1 checks against — spawn.start's map-name vs spawn.end's observed value are not the
    same thing and cannot both "match" one recorded value). Do not keep preflight (a) on a
    `--model` the launcher may never send.
  - ESCALATE judgement: `none`. The credential handling is unchanged and sound (env only; child
    never carries `ANTHROPIC_API_KEY`; Req 4 crit 4 now rests on that absence). R3-1 is a flaw
    in the verification method and the model-routing setup of the preflight, fixable by a spec
    edit; no live secret, money, or legal surface.

## 2. Preflight (a)'s pass gate is too weak to protect the launcher facts it is meant to prove

- **R3-2 (SHOULD_FIX) — `Recurring` (round-2 conclusion #3, unresolved), `Compounds: R2-2`.**
  Req 6's User Story and D7 promise the launcher "is built on tested behaviour," and D8 makes a
  failed preflight (a) block the whole spec. But Req 6 crit 2's pass condition is only "analysis
  file exists + verdict block." Every launcher-design fact the preflight is supposed to secure is
  recorded with **no consequence branch**: Req 6 crit 5 records five probes "one line each"
  (auth path, `--agents` key acceptance, transcript location + whether `--session-id` fixes the
  name, child hooks, effort), and Req 6 crit 2 records `message.model`, yet only (a)-fails
  (→escalate, crit 6), (b) (→reviser eligibility, crit 4) and the child-hooks probe (Req 3 crit 4
  "else the design disables them") have a defined outcome.
  - Concrete rework scenario: the launcher's whole accounting rests on locating the child
    transcript deterministically via `--session-id` at `~/.claude/projects/<cwd slug>/<session
    id>.jsonl` (Req 3 crit 3). If the transcript-location probe (Req 6 crit 5) finds
    `--session-id` does not fix the filename, preflight (a) still **passes** (a review file with
    a verdict block was produced), the spec proceeds, and every real DeepSeek `spawn.end` reads
    `tokens=unknown` (Req 3 crit 2's fallback) — defeating Requirement 5, the reason the spec
    exists. Nothing in Req 6 turns that probe result into a block or a design change.
  - This is r2's third "conclusion to challenge" (the pass condition "must also assert the
    provider actually served the run"), never given a finding number and not touched by the v4
    delta. New evidence for re-raising: the v4 settlement added two consumers of preflight (a)'s
    output — Req 7 crit 1 (the ledger oracle) and, via crit 5, the launcher's transcript locator
    — so the weak gate now has load-bearing downstream dependents it did not have at r2.
  - Resolve by giving the launcher-critical probes a defined branch (block/escalate on a probe
    that falsifies a Req 2/Req 3 assumption), or by strengthening (a)'s pass condition to assert
    the transcript was found and parsed with numeric usage, not merely that a review file exists.

---

## Truth table — the R2-1 settlement cases

| Case | Expected by doc | Consistent? |
|------|-----------------|-------------|
| Launcher run | `--model claude-opus-4-8` → `deepseek-v4-pro`; `spawn.end` model = observed `message.model` | request side yes |
| Preflight (a) | `--model deepseek-v4-pro` → (settled facts) `deepseek-flash`; records `message.model` | **no — wrong model, wrong request (R3-1)** |
| Req 7 crit 1 oracle | `spawn.start`+`spawn.end` model "match what preflight (a) recorded" | **no — two model semantics vs one recorded value; measured under a different `--model` (R3-1)** |
| Preflight (a) pass gate | file exists + verdict block | passes even when launcher facts are falsified (R3-2) |
| Credential proof (Req 4 crit 4) | rests on `ANTHROPIC_API_KEY` absence | yes — settled correctly |
| Missing launcher (Reliability NFR) | mid-run `PHASE: error`, rows written | yes — R2-4 applied |
| Scope-note decomposition divergences | 344/346/371-373 recorded | yes — R2-3 applied; L-1 false positive |

## Top 3 risks / gaps

1. **R3-1 (MUST_FIX)** — preflight (a) runs `--model deepseek-v4-pro`, a value the launcher is
   forbidden to send (Req 2 crit 5) and which the settled facts map to `deepseek-flash`; the v4
   fix then made that preflight the oracle for Req 7 crit 1's real run, which sends
   `claude-opus-4-8`. The gating probe validates a forbidden path on the wrong model, and the
   E2E assertion can fail on a correct run.
2. **R3-2 (SHOULD_FIX)** — preflight (a) passes on "file + verdict block" alone; the launcher
   facts it is supposed to prove (transcript location, `--agents` keys, `message.model`) are
   recorded with no block, so a spec built on a falsified assumption ships and the accounting
   the spec exists for silently reads `unknown`.
3. **Ambiguity in Req 7 crit 1** — "`model` matching what preflight (a) recorded" is applied to
   both ledger rows, but `spawn.start`.model (map name) and `spawn.end`.model (observed) are
   different values; and Req 6 crit 2 records a *boolean* ("whether … equals"), not the model
   string the assertion needs to match. (Folded into R3-1.)

## Top 3 conclusions to challenge or reverse

1. **"Preflight (a) proves the launcher's behaviour" (D7).** It cannot: it uses a `--model` the
   launcher never sends and passes without checking any launcher-critical fact. Run it with the
   launcher's real `--model` alias and gate on the facts the launcher depends on.
2. **"Req 7 crit 1 asserts the preflight-recorded value" resolves R2-1.** It does not: the
   recorded value comes from a different request and is a boolean, not a model string; and the
   assertion still implicitly requires `message.model == deepseek-v4-pro` for the `spawn.start`
   row.
3. **`message.model` needs no defined expectation, only recording (Req 6 crit 2).** With Req 7
   crit 1 now consuming it as an oracle, an undefined expectation is a test that cannot be
   written as stated.

## What's missing before acting on this document

- Reconcile preflight (a)'s `--model` with the launcher's: probe with the `claude-*` alias the
  launcher uses, or state explicitly why the probe uses a different model and how Req 7 crit 1
  compares across the two.
- Define one rule for `message.model`: record the value, decide the expected relationship to
  the requested alias, and write Req 7 crit 1 to check `spawn.end` (observed) separately from
  `spawn.start` (map name).
- Give the launcher-critical Req 6 crit 5 probes a defined consequence, or strengthen (a)'s
  pass condition to include a located, parsed transcript with numeric usage.

ESCALATE: none — credential handling is unchanged (env only; never in store, ledger, HANDOFF or
commit; child never carries `ANTHROPIC_API_KEY`; Req 4 crit 4 rests on that absence). R3-1 is a
flaw in the preflight's model-routing and the E2E oracle, resolvable by a spec edit; no live
secret, destructive action, or money/legal surface a human must review now.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
