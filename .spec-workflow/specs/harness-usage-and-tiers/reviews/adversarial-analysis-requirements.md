# Adversarial Analysis — harness-usage-and-tiers/requirements (v1), Round 1

First review. Attack surface: completeness, ambiguity, scope. Fresh lens: wire contracts
across the boundary (JSONL ledger event shape written by the hook and orchestrators, the
`harness` tool action/parameter contract, watch-view render inputs, transcript fields the
usage extraction reads).

## What I checked and how

- Read the target document end to end, `codebase-context.md`, `agent-rules.md`, and the
  decomposition entry (`.spec-workflow/spec-decomposition/decomposition.md:240-323`).
- Verified every citation the v1 lint commit changed (the whole `## Changes since` diff) at
  both ends of each range against the real files:
  - `harness/hooks/sdd-activity.sh` — line 37 (`(^|:)sdd-` test), 11-27 (pointer), 63-65/69
    (`agent.stop`, activity append), 78 (brief-path match), 83-85 (`spawn.end` skips
    `-orchestrator`), 19-31 (pointer resolve + exports). All accurate.
  - `src/watch/ledger.ts` — 14-20 (`LedgerEvent` value type), 34-38 (`AgentProfile`), 40-53
    (`AGENT_PROFILES`, 11 entries, checker absent), 63-78 (`SpawnNode`), 129-142
    (`parseJsonl`), 188 (`buildModel`), 200-202 (last-run scope), 238 (orchestrator by name),
    240-247 (pairing, tokens coerce at 245), 250-291 (usage fold), 271 (fold overrides
    tokens), 316 (`tokensTotal`). All accurate.
  - `src/watch/render.ts` — 60 (`PHASE_ORDER`), 79 (header total), 180-211 / 203 (agent
    line, `profile?.model ?? ''`, fixed widths). Accurate.
  - `src/tools/harness.ts` — 27-101 (tool def), 46 (enum), 103-121 (dispatch), 673-683
    (`phase-log` `safeJoin`). Accurate.
  - `scripts/sync-plugin-assets.cjs` — 86-91/102-105 (`--check` drift). Accurate.
  - Test citations `src/__tests__/hook-spawn-events.test.ts:9-11,110-116`,
    `src/watch/__tests__/render.test.ts:53,56`, `src/watch/__tests__/ledger.test.ts:169-226`.
    Accurate.
  - Docs `docs/TOOLS-REFERENCE.md:547-570` (says "three actions", `gate` absent),
    `docs/SDD-HARNESS.md:284-298` (Fable-xhigh policy row), `:325-328` (orchestrator-recorded
    tokens), `harness/skills/sdd-continue/references/formats.md:193-194,200-201`. Accurate.
- Re-probed the load-bearing ledger numbers (context file is drafter-written, unreviewed):
  - question-gates: 23 digit-string token rows summing **1,963,320**, 14 non-digit rows,
    two run ids with one `run.start`; `buildModel().tokensTotal` **1,185,572**; the analyst
    has two `spawn.end` rows (01:10:28 no tokens, 01:10:49 `45675`). Matches Req 5.5 / 5.9.
  - review-gate: 59 digit-string `spawn.end` rows summing **6,324,447**; `buildModel`
    **6,324,447**. Matches Req 7.1.
  - Confirmed 12 agent files; `agent-profiles.json` does not exist yet; `copy-static.cjs`
    copies only `src/markdown` and `src/locales` into `dist/`; `PHASE_ORDER` is a
    non-exported `const` in `render.ts`.

The v1 lint pass was thorough: every changed citation is correct, and every probe number
reproduces. No misstated artifact, no false claim about the codebase. Findings below are
completeness/ambiguity gaps, not citation errors.

## Findings

### R1-1 — `agent-profiles.json` is generated at `harness/` but no criterion ships it into `dist/` (SHOULD_FIX)

Req 3.1 writes `harness/agent-profiles.json`. Req 3.4 requires the *published package*
(`files: dist/**/*`, README, CHANGELOG, LICENSE) to carry the profiles. D4 says they
"ship inside `dist/` and `ledger.ts` resolves them relative to its own module." But nothing
connects the two: `harness/` is not in `files`, and `copy-static.cjs` (the only build copy
step) copies only `src/markdown` and `src/locales` into `dist/` — verified. No acceptance
criterion names the step that copies `harness/agent-profiles.json` into `dist/`.

Failure scenario: an implementer satisfies Req 3.1 by writing to `harness/` only. `dist/`
ships without the file, so every `npx ... --watch` on another machine hits Req 3.5 and
renders empty model/effort columns — silently, forever. The headline goal ("`npx` users see
declared tiers", D4) fails with no error.

Second, related gap: the resolution base is unspecified for three contexts — generated at
`harness/`, shipped at `dist/`, and read during `vitest` from the `src/` tree. If `ledger.ts`
resolves relative to its module via `import.meta.url`, tests running from `src/watch/` look
for the file next to `src/watch/`, not `harness/`, so `render.test.ts:53/56` (Req 4.6, which
assert the new generated values) cannot find it. Pin: the canonical `dist/` location, the
copy step, and how dev/test resolve the file.

### R1-2 — Usage-report summation and "spawn" identity are underspecified for the double-`spawn.end` case that appears in the verification fixture (SHOULD_FIX)

Req 5 is the point of the spec (the number specs 9 and 10 are judged on), yet its counting
contract is ambiguous exactly where it is exercised.

1. Contradiction in Req 5.4: "every digit-string row SHALL be counted exactly once" versus
   "tokens SHALL come from a `spawn.end` ... else from the `spawn.usage` folded onto the same
   spawn." For a spawn carrying a digit string on *both* rows, the first clause counts both,
   the second counts only `spawn.end`. Req 7.2 says `spawn.end` wins. State one rule; the
   "counted exactly once" wording is a trap even though "no ledger has both" today.

2. "Spawn" identity is undefined for the case the doc itself uses to verify (Req 5.9,
   question-gates): the analyst has one `spawn.start` but **two** `spawn.end` rows (one with
   no tokens at 01:10:28, one `45675` at 01:10:49) — I confirmed both exist and that
   `buildModel` drops the second (`1,185,572` shown vs `1,963,320` in the file). The report
   must count this as **one** spawn but **45,675** tokens. Req 5.4's per-agent/per-phase
   "spawn count" column has no rule that yields 1 here rather than 2. Buildmodel's fold
   (`ledger.ts:250-291`, cited by 5.4) cannot be reused as-is: it is last-run-scoped (5.5
   needs all runs) and its pairing at `:241` is precisely what drops the row. The report
   needs its own summation + spawn-identity definition, written out, with this fixture as the
   worked example.

### R1-3 — The render row cannot fit full model ids plus a new actual column at the cited layout (SHOULD_FIX)

Req 3.3 switches declared model to the full id (`claude-opus-4-8`, 15 chars; `claude-fable-5-1`,
16). Req 4.2/4.3 add an *actual* model column beside declared. Req 4.5 gives a concrete,
testable verification: an orchestrator row shows declared `claude-opus-4-8 high` and actual
`claude-opus-4-8`. But the cited extension point `render.ts:180-211` / `:203` uses a fixed
model column width of **11** (`padRight(profile?.model ?? '', 11)`) and a hardcoded
fixed-column slack of **46** in the role-width formula. `padRight` pads but never truncates,
so a 15–16 char id overflows the 11-wide slot and shifts every column after it; a second
model column blows the 46-char budget and drives `roleW` under its 16-char floor on an
80-column terminal. No criterion re-budgets the row. Req 4.3 delegates only the diff *mark*
to design, not the column layout. Call out the layout re-budget so 4.5 does not ship a
misaligned row.

### R1-4 — The model-policy table's supervisor row cannot come from `agent-profiles.json` (MINOR)

Req 6.2 requires `docs/SDD-HARNESS.md:284-298` to "match the agent files" and "name
`harness/agent-profiles.json` as the generated source." But line 288 groups the *supervisor*
(main session) with the orchestrators and analyst. The supervisor has no agent file and is
not in the generated profiles (Scope note: its tokens are not even captured). The updated
table must split the supervisor out and describe its tier separately; "the generated source"
does not cover it.

### R1-5 — `PHASE_ORDER` reuse and the second-spec parameter are unnamed contract details (MINOR)

Req 5.2 orders phases by `PHASE_ORDER` (`render.ts:60`), which is a non-exported `const`
used only inside `render.ts` — the `harness` tool must export or duplicate it. Req 5.3's
second-spec parameter (D12) is unnamed, and the tool schema sets `additionalProperties:
false` (harness.ts:95), so a new property must be declared. Both are design-resolvable but
worth naming so the boundary is explicit.

### R1-6 — Req 2.1 wording collides with Req 2.3 on which keys a `spawn.usage` carries (MINOR)

Req 2.1 says "The orchestrator's `spawn.usage` row SHALL keep `agent`, `role`, `result`,
`phase`, and `task` or `round`." Req 2.3 says the supervisor writes the orchestrator's
`spawn.usage` with only `(agent, role, result)`. These are consistent only if 2.1 means the
*worker* row an orchestrator writes (which needs `phase` because the hook's worker
`spawn.start` carries none) and 2.3 means the *orchestrator* row the supervisor writes (whose
`phase` comes from the supervisor's `spawn.start`). Reword 2.1 to "the worker `spawn.usage`
row an orchestrator writes" so the two rows are not confused.

## Top 3 risks/gaps

1. **Profiles never reach `dist/`** (R1-1): the flagship "declared tiers on any machine"
   outcome fails silently for every `npx` user because no criterion ships the generated file.
2. **The core number is underspecified where it is verified** (R1-2): the usage report's
   counting and spawn-identity rules do not resolve the double-`spawn.end` fixture in Req 5.9,
   and buildModel's fold cannot be reused.
3. **The watch row cannot hold what Req 4.5 verifies** (R1-3): full ids + an actual column
   overflow the cited fixed-width layout.

## Top 3 conclusions to challenge or reverse

1. **D4 — "profiles ship inside `dist/`" is asserted, not delivered.** The decision lists
   options and picks "ship inside dist, resolve relative to module," but neither D4 nor any
   criterion states the copy step or the dev/test resolution base. Reverse toward naming the
   copy (extend `copy-static.cjs` or the build) and the resolution base for dev, test and
   dist explicitly.
2. **Req 5.4 — reusing buildModel's fold is implied but wrong.** The report needs all-run
   scope (5.5) and must keep the second `spawn.end` (5.4/5.9), both of which buildModel
   (`:200-202`, `:241`) actively defeats. State the report's own algorithm.
3. **Req 4 — "show declared beside actual" assumes the existing row can carry it.** It
   cannot at width 11 / slack 46. Either re-budget the row in the requirement or hand the
   whole row layout to design, not just the mark.

## What is missing before acting on this document

- A criterion (or design task) fixing `agent-profiles.json`'s canonical `dist/` location,
  the copy-into-dist build step, and dev/test resolution (R1-1).
- The usage report's summation algorithm and spawn-identity rule, independent of buildModel,
  worked through the question-gates double-`spawn.end` fixture (R1-2).
- The render row's column budget for full model ids plus the actual column (R1-3).
- Minor cleanups: split the supervisor from the model-policy source (R1-4); export/name
  `PHASE_ORDER` and the second-spec parameter (R1-5); disambiguate Req 2.1 vs 2.3 (R1-6).

## Scope check against the decomposition

The document matches decomposition entry 8: usage from the transcript, single-writer hook,
declared tiers from frontmatter, `harness usage` report, tier change verified not re-applied,
old ledgers keep rendering. No scope creep detected; the deferrals (per-run effort, per-role
provider, step-4's non-token columns) are correctly pushed to specs 9/10. Nothing cut that
the entry required.

ESCALATE: none. (`harness/hooks/` is a sensitive path, which the document already flags as
high risk at the review gate; no security, data, money or compliance issue needs a human now.)

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
