# Adversarial Analysis — agent-cache-ttl/tasks (v1), Round 1

Attack surface this round: **Atomicity, ordering, coverage.** Fresh lens: **the sub-agent
that receives one task prompt in isolation.** Deltas attacked first (the v1 lint-pass diff
from `2249dd0`), then the fresh lens across all nine tasks.

## What I checked and how

- Read the target `tasks.md` (v1), `codebase-context.md`, `requirements.md` (v4),
  `design.md` (v1), decomposition entry 13, and `agent-rules.md`.
- Re-verified every citation the v1 lint commit touched (the whole `## Changes since`
  section) against the real files, both ends of each range:
  - `src/watch/render.ts` — `agentLines` at :192, `declared` text at :220, pad
    `padRight(declared, 23)` at :226, `padRight`/`stripAnsi` at :51-58. Task 3's repointed
    range `:192-234` and its pad rewrite are accurate.
  - `src/watch/__tests__/render.test.ts` — :55 (`declared claude-opus-4-8 high +actual`,
    implementation orchestrator), :59 (`xhigh`, implementer, unedited), :155-167 (80-column
    case, `sdd-implementer`). All match the task's claims.
  - `harness/skills/sdd-continue/references/formats.md` — :194 is the `run.start` row,
    :199 is the `spawn.end` row, :170-182 is `event.sh` (splits at first `=`). Task 4/8
    full-path citations correct.
  - `./.mcp.json:1-12` — 12-line stdio-server file, args `dist/index.js`. Correct.
  - `harness/skills/.../briefs.md:12-15` — the "commit into the spec store from a `cd`
    script" text. Correct for task 7.
  - `src/watch/__tests__/usage.test.ts:49`, `src/tools/__tests__/harness.test.ts:478` —
    both resolve to real cell/total `toEqual` assertions; task 5's path prefixes are correct.
- Verified the bridge-language additions map to real downstream work: task 1↔3 (AgentProfile
  gains `cacheTtl`, loader stops dropping it), task 7↔8 (evidence file ↔ Step 3 check).
- Verified the load-bearing non-delta citations that gate task classification and the
  highest-risk task: `sdd-implementation-phase/SKILL.md:108-117` (verification-only-task rule,
  task 7), hook `readUsage` :41-64 dedupe map and `spawn.end` rows :157/:160 (task 4),
  `SKILL.md` Step 0 (four items, no count word), `:100-102` run.start, `:153-156` retro route
  (task 8), `sync-plugin-assets.cjs` `buildProfiles` :85-110, object literal :107, `main();`
  :166 (task 1), `agent-profiles.test.ts` and `ledger.test.ts:101-105` (ordering).

Every cited artifact matches the document. No misstated path, range, or behaviour in the deltas.

## Rulings on the three re-decided design literals (refinement vs widening)

1. **Render pad `Math.max(23, len+1)` vs design's fixed 24 — REFINEMENT (closed).**
   Today's pad is `padRight(declared, 23)`. Design C3's `Math.max(24, …)` would widen every
   *default* tier line to 24 columns, changing it from today and breaking the 80-column case
   (`render.test.ts:162`) — a direct violation of Req 2.3 ("default tier line unchanged"). The
   drafter's `Math.max(23, len+1)` holds default lines at 23 while guaranteeing the separating
   space Req 2.4/R1-4 require for the 23-char `claude-opus-4-8 high 1h`. The design literal was
   wrong; the drafter corrected it toward the requirement. Closed.
2. **"Profile without `cacheTtl`" case moves from render test to loader test — REFINEMENT
   (closed).** `render` reads `AGENT_PROFILES = loadAgentProfiles()` once at import from the
   generated file, where every agent now carries the key, so a render test cannot exercise a
   keyless profile without mocking. The loader test takes a fixture file (D3). Correct.
3. **`recompute.mjs` falls back to `~/.claude/projects`, failing an unfound row — REFINEMENT
   (closed).** Directed by design review R1-1; `recompute.mjs` is scratch-only (not shipped),
   and "a missing transcript must never read as pass" is a safety tightening, not new surface.

## Topics attacked

### 1. Task 1 → task 2/3 ordering and the "loader drops the extra key" claim
- Challenge the claim that task 1 keeps `agent-profiles.test.ts` green "because the loader
  drops the extra key": that test reads `harness/agent-profiles.json` **directly**
  (`agent-profiles.test.ts:20`, never through `loadAgentProfiles`), so the loader rationale
  does not apply to it. It survives task 1 for a different reason — the "12 keys" check counts
  *agents* (still 12), the model/effort checks ignore `cacheTtl`, and "re-serialises byte for
  byte" (`:39-41`) is a pure `JSON.parse`→`JSON.stringify` round-trip that passes with any
  extra key. Outcome is correct; the stated reason conflates two tests. (Finding R1-1, MINOR.)
- Stress-test the byte-identity gate: confirmed `buildProfiles` writes
  `JSON.stringify(profiles, null, 2) + '\n'` with `cacheTtl` as the fourth inserted key, and
  the test round-trips that exact form — green. No hidden break.
- Confirmed the loader rationale IS correct for `ledger.test.ts:104` (via `loadAgentProfiles`,
  which drops `cacheTtl` until task 3 adds it to `AgentProfile`): stays `{model,effort,role}`
  at tasks 1-2, gains `cacheTtl: 'default'` at task 3. Ordering is sound.

### 2. Fresh lens — cross-task pins read in isolation
- Task 8 pins task 6's script only by "read its name in
  `harness/skills/sdd-continue/references/`". That directory already holds several scripts
  (`sdd-providers.sh`, `sdd-launch.sh`, `harness-source.sh`, `truncate-ledger.sh`, …); the
  prompt in isolation names no way to disambiguate the new one beyond the filename's meaning.
  The name `sdd-cache-ttl.sh` matches the "Cache lifetime" preflight, so a competent agent
  picks it — but the pin is discovery-by-guess, not a citation. (Finding R1-2, MINOR.)
- Task 3's completion check (`render.test.ts:55` → `…high 1h +actual`) cannot pass until the
  profiles file carries `1h` (task 2) and the loader keeps it (task 3's own edit). The
  `_Prompt:` does not restate this precondition; it lives only in the document preamble. Not a
  defect — the implementation orchestrator dispatches tasks in listed order — but it is the
  one place a mis-ordered spawn would fail opaquely. Checked, judged acceptable.
- Task 5's `reduceSpawn` reads `cacheWrite5m`/`cacheWrite1h`/`gapRewrites` that task 4 writes;
  both are pinned to the same names by requirements 3.1/4.1 and the Data Models block, and
  task 5 tests them with its own fixtures, so isolation does not break the pin. Clean.

### 3. Coverage — components, requirements, scenarios
- C1-C8 each map to exactly one task (header line 4); every task carries a `_Requirements:`
  line; every requirement criterion is allocated (Req 1 → tasks 1+2; Req 2 → 3; Req 3 → 4;
  Req 4 → 5; Req 5 → 6+8; Req 6 → 7+9). All six verification scenarios are allocated: (1)(2)(3)(5)
  to the task-7 kit + operator run, (4)(6) to task 9. No orphan task, no uncovered criterion.
- Req 3.7 (unparseable timestamp ⇒ `gapRewrites` unknown, write sums kept) is implemented in
  task 4's prompt but has no dedicated test case — the enumerated test list (Req 3.11 and the
  task) omits it. This gap is inherited verbatim from the approved requirements/design test
  strategy, not introduced by the tasks doc, so it is not a tasks-phase finding. Noted only.

### 4. Gate B / Gate C sweep
- Gate B (new external dependency): none. Tasks 1, 6, 7 use only node builtins
  (`createRequire`, `execFileSync`, `fs`, `os`); no npm dependency added anywhere.
- Gate C (does more than the approved requirements ask): none. The recompute fallback,
  the pad choice, and the retro block all trace to approved requirements/design decisions
  (R1-1, Req 2.4/D6, Req 6.7/D10). No task exceeds its requirement set.

## Top risks/gaps

1. **Imprecise rationale in task 1** couples `agent-profiles.test.ts` to a loader behaviour
   it never exercises. Low blast radius (the test is green regardless), but a future editor
   who trusts the stated reason could mis-reason about that file. (R1-1, MINOR.)
2. **Task 8's script-name discovery is ambiguous in isolation** — resolved only by the
   filename's semantics, not by any citation. (R1-2, MINOR.)
3. No dedicated test for Req 3.7 — inherited from approved upstream, not actionable here.

## Top conclusions to challenge

1. "The loader drops the extra key" as the reason **both** `agent-profiles.test.ts` and
   `ledger.test.ts` stay green — half-true; reverse to name the round-trip reason for the
   former. (Does not change any implementation step.)
2. That task 8 needs no script name because the implementer "reads its name" — challenge:
   the references directory is not single-entry; the design already fixes `sdd-cache-ttl.sh`,
   so nothing is lost by naming it.
3. That the pad literal was a free design choice — it was not; design C3's 24 was a latent
   Req 2.3 violation the tasks doc silently corrects. Worth stating as a correction, which the
   doc's D2 already does.

## What's missing (before acting)

- Nothing blocking. Optionally: name `sdd-cache-ttl.sh` in task 8 and correct the task-1
  rationale wording. Both are MINOR and safe to leave to implementation.

## Findings

- **R1-1 (MINOR)** — Task 1 prompt: "src/__tests__/agent-profiles.test.ts and
  src/watch/__tests__/ledger.test.ts assert no value this task changes: the loader drops the
  extra key" applies the loader rationale to `agent-profiles.test.ts`, which reads the profiles
  file directly (`agent-profiles.test.ts:20`) and passes by round-trip serialisation, not by
  the loader. Outcome correct; wording imprecise. No rework caused.
- **R1-2 (MINOR)** — Task 8 prompt identifies task 6's script only as "read its name in
  `harness/skills/sdd-continue/references/`", a directory with multiple scripts. Disambiguation
  rests on the filename's meaning (`sdd-cache-ttl.sh`), not on any citation. Low risk.

No MUST_FIX. No SHOULD_FIX. Gate B: none. Gate C: none.

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
