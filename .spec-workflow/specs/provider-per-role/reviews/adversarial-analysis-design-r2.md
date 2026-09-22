# Adversarial Analysis — provider-per-role/design (v2)

Attack order per the prompt: (1) the two v2 deltas (R1-1 E2E rewrite, R1-2 Component 6
`!=` note, plus the Error Handling 8 wording trim); (2) the fresh lens — every prescribed
test checked against the installed runner and the real test files at both ends of each
range, and the preflight/escalate safety mechanism against Req 6 crit 1/6/7.

## What I read (ground)

Design v2 (whole); requirements v5 (Req 6, Req 7 in full); the round-1 analysis and the
rolling memory; `codebase-context.md`. Code, both ends of every cited range:
`src/watch/usage.ts:13-45,249-298`; `src/watch/ledger.ts:94-114,142-163`;
`src/watch/__tests__/usage.test.ts:1-90,195-283`; `ledger.test.ts:245-274`;
`render.test.ts:40-64,118-135`; `index.test.ts:78-96`;
`src/tools/__tests__/harness.test.ts:460-535`;
`src/__tests__/hook-spawn-events.test.ts:30-100`; `harness/hooks/sdd-activity.sh:11-27,32-49,106-123`;
`harness/skills/sdd-implementation-phase/SKILL.md:84-210` and `references/briefs.md:5-51`;
`harness/skills/sdd-continue/SKILL.md:71-86,236-265` and `references/formats.md:119-135`.
Installed runner: **vitest 4.0.16** (`node_modules/.bin/vitest`), `vitest.config.ts`
includes `src/**/*.{test,spec}.{js,ts}`, `globals: true`, node env. Local node v24; CI node 20.

## Deltas since v1 — verified, no new defect

**R1-1 (E2E paragraph, line 185).** The new clause reads "Without the key, task 1 halts the
spec (Req 6 crit 7); (1) and (4) need the key, not a deferred half." The v1 false claim (a
keyless session defers (1)/(4) through `sdd-implementation-phase/SKILL.md:201-210`) is gone,
and the `:201-210` citation is removed. The design took R1-1's option (b) — the key is
required to build the spec, no deferral. Cross-check against the other scenarios: (2) is
all-anthropic (no key), (3) deliberately unsets the key to test the roots-step refusal, so
only (1)/(4) need the key. Consistent; no scenario now contradicts the new clause. **Clear.**

**R1-2 (Component 6, line 77).** The added clause "`!=` depends on DeepSeek's echoed
`message.model` (Component 7)" is accurate: `SpawnNode.model` is set from `spawn.end.model`
= `MESSAGE_MODEL` (the child transcript's `message.model`, `ledger.ts:276-287`,
`sdd-activity.sh:37-49`), and the `!=` fires on `s.model !== profile.model`. When DeepSeek
echoes the alias `claude-opus-4-8`, a reviewer (profile `claude-opus-4-8`) on
`deepseek-v4-pro` reads equal → no `!=`. The render.test.ts:122-132 unit assertion
(`actual deepseek deepseek-v4-pro !=`) uses a synthetic ledger where the test author fixes
`message.model=deepseek-v4-pro`, so the unit test is not hostage to the real echo; the E2E
(1) asserts `spawn.end.model` equals the recorded string, echo-agnostic. **Clear.**

**Error Handling 8 wording trim.** "…or the key is unset in the preflight task" →
"…or the key is unset". Item 8 is still scoped to the preflight (it cites Req 6 crit 6-7,
and the runtime key-unset case is item 2). Slight loss of precision, no meaning change.
**Not a finding.**

**Lint commit (4be83df).** The two bare `usage.test.ts` citations on the Unit line gained
their `src/watch/__tests__/` prefix; both point at the empty-report block (263-267, literal
at 266) and the fixture block (270-283). Verified both ranges hold what the design claims.

## Fresh lens — prescribed tests and the safety mechanism

**Unit tests, both ends of every range:**
- `usage.test.ts:263-267` — the empty-report `toEqual` is on **line 266**
  (`{ spec, runs, phases: [], total, kinds }`). Adding a **required** `providers:
  UsageByProvider` to `UsageReport`/`UsagePhase` (Data Models) breaks exactly this one
  full-object assertion; the design lists it (and Scope note line 213). I scanned every
  `toEqual` in `usage.test.ts` and `harness.test.ts`: the rest are `UsageCell`, phase-name,
  or `UsageDelta` sub-object comparisons (lines 49,60,71,113,122,131,201,215) and
  `data.report.total/.runs` field access — none carry a full `UsageReport`/`UsagePhase`, so
  the new required field breaks nothing else. **Accurate and complete.**
- `usage.test.ts:270-283` (fixture keeps `4,554,189`), `ledger.test.ts:251-263` (spawn.end
  field-copy test), `render.test.ts:122-132` (the `!=` tier test), `index.test.ts:82-94`
  (the `--once` frame), `harness.test.ts:519-530` (review-gate-shape ledger) — every range
  resolves to exactly the test the design names. `index.test.ts:82-94` survives the header
  change because its fixture has no `provider` key → deepseek `D=0` → `tokens 1.6M` prints
  with no suffix, and the `tokens 0`/`tokens -` branches key on `tokensTotal` unchanged. **Clear.**

**Integration tests:** `hook-spawn-events.test.ts:36-41` is the `execFileSync` `runHook`
pattern; `:58-94` is the fixture transcript (two models, `expectedModel =
'claude-opus-4-8+claude-sonnet-5'`, `writeTranscript(at?)` writing to a caller-chosen path).
Both support the prescribed `launcher.test.ts` stub-claude construction. The node-20
guaranteed-fields list (`execFileSync` `input`/`env`/`cwd`, error `status`/`stdout`, `fs`
read/write/`existsSync`) is stable. **Feasible.**

**Safety mechanism (Component 7, Error Handling 8) vs Req 6 crit 1/6/7:**
- crit 1 (preflight is task 1, recorded to `docs/deepseek-preflight.md`): Component 7 states both. ✓
- crit 6 ((a) fails → `PHASE: escalate`, no later task): the escalate branch is added at
  `sdd-implementation-phase/SKILL.md:100-106` (the flags block) reusing the design-defect
  revert-and-report shape (`:177-184`); `escalation` is a real retro category
  (`formats.md:121`); the supervisor stops the whole run on `PHASE: escalate`
  (`sdd-continue/SKILL.md:247-248`: "write a HANDOFF row, print REASON, and stop … exit").
  A missing key genuinely halts before task 2: the launcher body refuses with exit 2
  **before** `spawn.start` when `DEEPSEEK_API_KEY` is empty (Component 3 step 1), the
  implementer reports `ESCALATE:`, the supervisor exits. ✓
- crit 7 (key unset → report and stop, no fabricated outcome): Component 7 "writing no
  outcome"; the failure is still recorded via the escalate machinery (HANDOFF row, `REASON`,
  retro `escalation`). R1-1's Revision-History ruling already closed the claim that
  Component 7 / Error Handling 8 match both crit 6 and crit 7; not re-opened. ✓

The keyless-build consequence R1-1 raised (on this machine `DEEPSEEK_API_KEY` is unset, so
task 1 escalates and even the key-independent folds/docs never build) is now the design's
explicit, accepted behaviour and is mandated by the closed requirements (Req 6 crit 1 + 7).
Not a design defect — a requirement consequence. **Not re-litigated.**

Spot-checked the rejected citation-identifier tokens at lines 55 (`SID`), 77
(`providers VALUE`), 135 (`ALIAS`), 213 (`providers`): each is the design's own new
vocabulary at an insertion point, not a claim a range already holds it. False positives, as
both lint passes ruled.

## Findings

### R2-1 — MINOR — Novel (refines R1's "table assertions do not break") — Compare-mode provider-pair placement is under-specified and the literal reading breaks unlisted assertions

Component 5 says `formatOne` "appends `  anthropic N  deepseek N` … to each phase total
line and the spec total line" and `formatCompare` "appends the pair **after each spec's
total cell**." The one-spec example (line 160) puts the pair at the **end** of the line,
after the kinds string. Compare mode has two total cells and a `delta` suffix per total line
(`usage.ts:294,297`), and the existing test asserts the full lines by `toContain`:

- `usage.test.ts:258`: `requirements | total | 1 | 100 | 1 | 250  delta spawns 0 tokens 150`
- `usage.test.ts:259`: `total |  | 1 | 100 | 2 | 290  delta spawns 1 tokens 190`

If an implementer reads "after each spec's total cell" literally and inserts each pair
immediately after that spec's tokens cell (before the `delta`), both substrings stop
appearing contiguously and these two assertions fail — yet the design's Testing Strategy
does **not** list `usage.test.ts` compare block (222-260 / `formatCompare` 271-298) among
the tests that change. If instead the pairs are appended at line end (matching the one-spec
example), the `toContain` prefixes still hold and the change is additive. The design gives no
compare example and no Data Models entry to disambiguate. Fix: one clause stating the pair is
appended at the end of each total line, after the `delta` text (so 258-259 pass unchanged and
the new compare assertion is a pure add), or list the compare block as a changed test.

## Closing deliverables

**Top 3 risks/gaps**
1. R2-1: compare-mode pair placement ambiguity; the literal reading silently breaks
   `usage.test.ts:258-259`, which the Testing Strategy does not flag as changed. MINOR.
2. Residual (not a new finding, correctly deferred by design): the entire DeepSeek wire
   contract — transcript shape/location, `ANTHROPIC_AUTH_TOKEN`-only auth, `--agents` key
   acceptance, `auto`+`prompts none` letting the child Write, `message.model` echo — is
   proven only by preflight (a); the stub-`claude` `launcher.test.ts` cannot catch a real
   mismatch. Sound by design; flagged so any future weakening of preflight (a) is treated as
   high-risk.
3. Nothing else. The delta text is accurate, the prescribed tests cite real ranges and run
   under the installed vitest 4, and the preflight/escalate halt is grounded end to end.

**Top 3 conclusions to challenge — and the verdict after challenging**
1. "task 1 halts the spec … (1) and (4) need the key" (R1-1 fix) — challenged against (2)
   and (3); holds. The three keyless-relevant scenarios are consistent.
2. "`!=` depends on DeepSeek's echoed `message.model`" (R1-2 fix) — challenged against the
   render unit test and E2E (1); holds. Unit uses a synthetic model, E2E is echo-agnostic.
3. Component 7 collapses crit 6 (record the failure) and crit 7 (no fabricated outcome) into
   one "writing no outcome / ESCALATE" path — challenged; the failure is still recorded via
   the escalate machinery, and R1-1's Revision-History ruling already closed this. Not reversed.

**What's missing before acting**
- One clause fixing the compare-mode total-line layout (R2-1). Everything else the round-2
  scope covers is present and code-accurate.

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
