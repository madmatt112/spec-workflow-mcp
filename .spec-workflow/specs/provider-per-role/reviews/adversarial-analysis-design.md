# Adversarial Analysis — provider-per-role/design (v1)

First review. Attack order: (1) the deltas since the `3603033` checkpoint (the lint pass on
the Testing Strategy paragraph), (2) rule the two re-decided requirement literals, (3) the
fresh lens — wire contracts across the launcher/ledger/fold/render boundary.

## What I read (ground)

Design doc; requirements v5; decomposition §10 and the settled DeepSeek preamble
(`decomposition.md:255-258`); `agent-rules.md`; `src/watch/usage.ts` (whole),
`src/watch/ledger.ts:1-170,255-429`, `src/watch/render.ts:55-84,176-218`,
`src/tools/harness.ts:1055-1085`; `harness/hooks/sdd-activity.sh:1-126`;
`harness/skills/sdd-continue/references/formats.md` (retro/event/table);
`harness/skills/sdd-continue/SKILL.md:49-52,71-86,190-208,245-250`; document-phase and
orchestrator ranges; implementation-phase `:100-106,177-184,195-212`; `agent-profiles.json`;
`sdd-reviewer.md`; `sync-plugin-assets.cjs:17-22`; the four watch/usage test files.
Re-probed the CLI: `claude --version` = **2.1.280** (matches the doc); `claude -p --help`
shows `--allowedTools/--tools <tools...>` with "**Comma or space-separated list**".

## Deltas since 3603033 (lint pass) — clear

The lint pass only touched the Testing Strategy: bare ranges got filenames, the
out-of-bounds `:519-530` was re-pointed to `harness.test.ts`, and one cite widened to
`:201-210`. All verified on meaning:
- `harness.test.ts:519-530` is the `usage reads an old review-gate-shape ledger` test
  (digit `tokens` on `spawn.end`, asserts `total.tokens`); the design's added
  `data.report.providers` with `deepseek` zero fits it. Correct re-point.
- `sdd-implementation-phase/SKILL.md:201-210` is the deferred-verification block; the widen
  covers the `VERIFY: pass (deferred)` + `deferrals ... tagged verification` text. Correct
  range (but see R1-1 for the *meaning* mismatch when the blocker is a key, not a tool).
- Spot-checked the rejected citation-identifier tokens (PROVIDERS, LAUNCHER, deepseek): each
  is the design's own new vocabulary at an insertion point, not a claim a cited range
  already holds it. No genuinely wrong citation in the sample.

## Rulings on the two re-decided literals

- **Req 2 crit 5 / D4 (`--agents` `model` = request alias, not profile model) — REFINEMENT
  (closed).** The map can put a role on a model whose alias differs from its profile
  (checker→v4-pro alias `claude-opus-4-8` ≠ profile `claude-sonnet-5`; reviewer→flash alias
  `claude-sonnet-5` ≠ profile `claude-opus-4-8`). Aligning the JSON `model` with `--model`
  removes a two-input disagreement; the key is "expected ignored" anyway; effort still from
  the profile. This *narrows*, adds no scope. Not a widening.
- **Req 2 crit 7 / D9 (`--add-dir` when the store is outside the code root) — REFINEMENT
  (closed).** Req 2 crit 7 says "not needed" on the premise that document-phase roles run
  from the main-checkout cwd where the store lives. That premise breaks in the shared-root
  layout (`SPEC_WORKFLOW_SHARED_ROOT`, tradr), where the store is a separate repo: a `claude
  -p` child cwd'd at the code root cannot read the review prompt or write the analysis there
  without `--add-dir`. D9 fulfils the requirement's *intent* ("read the spec store and write
  under `reviews/`") in a layout the requirement overlooked, and restores parity with the
  single-repo case (where cwd already grants that access — no net-new capability vs the
  Security NFR, whose real teeth are `--strict-mcp-config`/no MCP). Grounded, flagged
  RE-DECIDED. Not a widening.

## Fresh lens — wire contracts (traced end to end, sound)

I traced every producer field to its consumer and found the contract holds:
- **`event.sh` `run`/`spec`:** the per-run `event.sh` bakes in `SDD_RUN`/`SDD_SPEC` and
  re-exports them before the node writer, so launcher rows carry the correct run/spec
  regardless of `launch.sh`'s own exports. No mismatch.
- **`provider` propagation:** launcher writes `provider=deepseek` on both `spawn.start` and
  `spawn.end`; `reduceSpawn`/`SpawnNode` read `spawn.end` else start else default
  `anthropic`; `spawn.usage` (unchanged, no `provider`) does not clobber it (usage.ts folds
  it into the same open spawn; ledger.ts sets tokens only when unset). **No double-count**:
  for a DeepSeek worker the three rows (launcher start+end, orchestrator `spawn.usage`)
  collapse to one spawn in both folds, tokens taken from the digit `spawn.end`.
- **defaults:** `providers=none` is only ever the *map* string on `run.start` (consumed by
  `ledger.ts` `RunModel.providers` and the render "providers" line, gated `!== 'none'` and
  set); `anthropic` is only ever the *spawn* default. No row writes `provider=none`; the two
  defaults never cross.
- **header/table asymmetry:** the usage table appends `anthropic N  deepseek N`
  unconditionally (Req 5.3); the watch header appends `deepseek D` only when D>0 (Req 5.5).
  For old ledgers A==tokensTotal, D==0 → header byte-identical (review-gate/index regressions
  hold). Existing formatted-table assertions are `toContain` prefixes and `toEqual` on
  `UsageCell`/phase-name/delta sub-objects — none break; only the empty-report full-object
  `toEqual` needs the `providers` key, which the design lists.
- **transcript locator:** child cwd = `SDD_CODE_ROOT`, `--session-id SID`, no
  `--no-session-persistence`, `CLAUDE_CONFIG_DIR`/`HOME` not overridden → transcript at
  `CFG/projects/SLUG/SID.jsonl`; `XDG_STATE_HOME=STATE` moves only the SDD pointer file (hook
  early-exit), not the Claude transcript. `readUsage` copy sums it. Sound, and preflight (a)
  is the real proof.
- **`--tools`:** comma-joining is accepted by the CLI (help: "Comma or space-separated").
  Not a defect.

## Findings

### R1-1 — SHOULD_FIX — The keyless build/verify lifecycle is contradictory and rests on a mechanism scoped to tools, not keys

The design gives one trigger (an unset `DEEPSEEK_API_KEY`) two incompatible outcomes and
never says which applies when:
- **Preflight (task 1) escalates on an unset key.** Component 7: "The preflight task reports
  `ESCALATE:` on a failed (a) **and on an unset key**". Error Handling 8: "(a) fails **or
  the key is unset** ... `PHASE: escalate` ... **no later task runs until a human rules**."
- **Testing E2E claims a keyless session defers.** "Without the key in the session, (1) and
  (4) are the deferred half per `harness/skills/sdd-implementation-phase/SKILL.md:201-210`,
  tagged `verification`."

These cannot both hold for a from-scratch run on a keyless machine — which is exactly this
machine (`codebase-context.md:107`: "Shell of this drafter: `DEEPSEEK_API_KEY` unset"). If
the preflight is task 1 and escalates without a key, tasks 2..N never run, the completion
gate is never reached, and the "deferred half" is unreachable. Worse, everything after the
preflight — the `usage.ts`/`ledger.ts`/`render.ts` provider split, the docs, and all their
unit tests — needs **no key at all**, yet none of it gets built.

The `:201-210` mechanism the E2E leans on is scoped to "a skill or tool **this spec adds**
that the running session or server still lacks" (load-order: fixed by a rebuild + restart).
A missing `DEEPSEEK_API_KEY` is neither a skill nor a tool, and a restart does not supply it
— the operator must set it. So the deferred record's `revisitCriteria` ("re-run once the
checkout is rebuilt and the session restarted") would never be satisfiable if the blocker is
the key. Deferring a key-dependent scenario through a restart-oriented valve is a category
error.

Fix direction: distinguish the two lifecycle points explicitly. Either (a) let the preflight
**defer** (not escalate) when the key is merely *absent* — reserving `ESCALATE` for a *run*
(a) that produced wrong results — so the key-independent code and its tests build and only
the DeepSeek proof waits for a keyed session; or (b) state plainly that a key is **required**
to build this spec at all and drop the "deferred half without the key" claim. Either way, if
the key-absent verification is deferred, its `revisitCriteria` must name "with
`DEEPSEEK_API_KEY` set", not just a restart.

### R1-2 — MINOR — The watch `!=` substitution mark is silently contingent on an unprobed `message.model`

The tier line's `!=` fires on `s.model !== profile.model` (`render.ts:209`), and
`SpawnNode.model` comes from `spawn.end` = the child transcript's `message.model`
(Component 6, Req 7 crit 1). If DeepSeek echoes the request *alias* rather than
`deepseek-v4-pro` (Req 6 crit 2 admits either), then a reviewer (declared `claude-opus-4-8`)
on `deepseek-v4-pro` (alias `claude-opus-4-8`) yields `s.model == profile.model` → **no
`!=`**, even though the run is on DeepSeek. The `deepseek` provider prefix still signals it,
and the design's example assumes `message.model=deepseek-v4-pro`, but the design nowhere
notes the `!=` mark is contingent on the preflight-measured string. Display-only; preflight
resolves the value. Worth one line in Component 6 or D8.

## Closing deliverables

**Top 3 risks/gaps**
1. R1-1: the keyless machine (this one) escalates at task 1 and builds nothing; the E2E
   "deferred half" is unreachable and mis-scoped to a tool/restart mechanism.
2. The launcher's whole DeepSeek contract (transcript shape/location, auth via
   `ANTHROPIC_AUTH_TOKEN` alone, `--agents` key acceptance, `auto`+`prompts none` still
   letting the child Write its analysis) is *assumed* until preflight (a) runs; the launcher
   unit test uses a stub `claude` that writes where the launcher expects, so it cannot catch
   a real SLUG/transcript or permission mismatch. Correct by design, but the spec's
   correctness genuinely hinges on preflight (a) — R1-1 must not strand it.
3. R1-2: contingent `!=` semantics.

**Top 3 conclusions to challenge**
1. "Without the key ... (1) and (4) are the deferred half" — challenged by R1-1; the
   preflight escalate blocks reaching the gate, and the cited mechanism does not cover keys.
2. Error Handling 8 folding "unset key" into the same `ESCALATE`/block path as "(a) fails" —
   an absent key is a not-yet-provable state, not a proven failure; treating them identically
   is what blocks the key-independent build.
3. Nothing else to reverse: the fold, default, header/table, and transcript-locator wiring
   is internally consistent and matches the code.

**What's missing before acting**
- One explicit statement of the key-absent lifecycle (build vs preflight vs completion gate),
  reconciling Component 7 / Error Handling 8 with the Testing E2E deferred half, and a
  `revisitCriteria` that names the key when the key is the blocker.
- A one-line note that the watch `!=` depends on the preflight-measured `message.model`.

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
