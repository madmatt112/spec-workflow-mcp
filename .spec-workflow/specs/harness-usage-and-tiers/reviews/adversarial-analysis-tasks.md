# Adversarial Analysis — harness-usage-and-tiers/tasks (v1), Round 1

Reviewer lens this round: the sub-agent that receives only a task's `_Prompt:` line.
Primary attack surface: atomicity, ordering, coverage. Gate B/C judged against the
approved requirements.

## What I checked, and how

- **The delta first (`## Changes since ba1711a`).** Four citation edits from the lint
  pass, all re-verified against the tree:
  - `./tsconfig.json:8` (task 1 restrictions) — line 8 is `"rootDir": "./src"`. The
    lint-pass claim "rootDir is confirmed present at ./tsconfig.json:8" is accurate; the
    dot-slash is the checker's requirement for a directory-less path.
  - `./vitest.config.ts:7` (task 5 Leverage and Restrictions) — line 7 is
    `include: ['src/**/*.{test,spec}.{js,ts}']`; a `.jsonl` under `src/` is genuinely not
    collected. Accurate.
  - Scope-notes carried item, `src/watch/ledger.ts:305-311` — the doc flags design's
    `:305-311` as a span slip and gives the true range `:293-314` (comment :293-296, loop
    :297-314, fill :308-309). Verified: the `agent.stop` fill is at ledger.ts:308-309.
    Accurate, and task 2's prompt points the implementer at the code range, not design's.
  - Revision-History lint-pass bullet — the four fixes described match the tree; the 78
    rejected `citation-identifier` warnings are forward references or correctly-located
    existing symbols. Spot-checked `SpawnNode` (ledger.ts:63-78), `AGENT_PROFILES`
    (ledger.ts:40-53), `agentLines`/`bad` (render.ts:180-211, palette :12/:18),
    `writeLedger` (harness.test.ts:228-229), `safeJoin`/`getSpecPath` (path-utils.ts
    :183-214). All hold.
- **Every code artefact each task cites**, both ends of the range: sync-plugin-assets /
  copy-static targets, ledger.ts (:14-20, :34-53, :63-78, :183-186, :240-247, :266-271,
  :293-316), render.ts (:1, :60, :180-211), the three watch test files, harness.ts
  (:17, :29-40, :46, :49-52, :95, :109-120, :640-713), harness.test.ts (:12-29,
  :228-229, :246-376), the hook and hooks.json, hook-spawn-events.test.ts, all five
  SKILL.md files + formats.md, SDD-HARNESS.md and TOOLS-REFERENCE.md.
- **The decomposition entry** (`decomposition.md:259-324`): scope matches — usage from
  transcript, generated tiers, `harness usage`, tier change recorded not re-applied.
  Nothing cut, nothing added.
- **Fixture arithmetic and render reachability** for task 5, traced through buildModel
  and render.ts by hand.

## Topics attacked

### 1. Citation accuracy in the skill edits (task 8)
- Challenged task 8's `:47-50`, `:57-60`, `:48-51`, `:117-118`, `:146`, `:35-40` against
  design/requirements, which cite `:46-48`, `:53-57`, `:46-49`, `:114-116`, `:144`,
  `:33-39`. Result: the tasks doc is *more* accurate than design — the skills have shifted
  a few lines, and each tasks citation lands exactly on the current `tokens=<n>` clause
  ("through 'without it'"), the "and tokens" phrase (line 118), and the "from its report"
  line (146). No miscitation.
- Stress-tested the task 8 completeness grep. Ran
  `grep -rn "footer\|tokens=\|subagent_tokens" harness/skills`: 11 hits. Every hit except
  the two attribution-footer lines (closeout:170, briefs.md:233) falls inside a span task
  8 edits. The success criterion is achievable.
- Verified the two doc completeness greps: "the four orchestrators" and "hook payloads
  carry no usage" each occur exactly once in SDD-HARNESS.md (lines 288, 327), both inside
  spans task 8 rewrites; "three actions" occurs once in TOOLS-REFERENCE.md (line 552),
  inside task 6's rewrite span.

### 2. Fixture consistency and render reachability (task 5)
- Recomputed the usage totals: 1,209,120 + 1,736,029 + 604,010 + 1,005,030 = 4,554,189
  (reviewer `unknown` = 0); 5 spawns; orch share 2,741,059 / 4,554,189 = 60.2%; one phase.
  All match the asserted numbers.
- Traced the `--once` last-run frame: run 2 total 604,010 + 1,005,030 = 1,609,040 →
  `tokens 1.6M`. The closed orchestrator still renders because render.ts:114 pushes
  `agentLines(orch, …)` unconditionally in a live phase; role "requirements phase,
  spawn 2", `1.0M tok`, tier `declared claude-opus-4-8 high` / `actual claude-opus-4-8`,
  no `!=` (models match). The reviser, the only other rendered worker, also matches its
  profile, so "no `!=`" holds. Assertions are reachable given tasks 2 and 3.

### 3. Ordering and the protected test cases (tasks 2, 3)
- Verified task 2's line-271 change (`&& match.tokens === undefined`) is inert against
  ledger.test.ts:169-226: the fold case (:169-183) folds onto a token-less spawn.end
  (still fills); the synthesized-node case (:185-207) and the old-ledger case (:209-218)
  never hit the new guard. "Passes without edits" holds.
- Confirmed `PHASE_ORDER` is a module-private `const` at render.ts:60 used only at :86,
  :87, :162, and imported by no test — so task 2's move to ledger.ts breaks no import.
- Confirmed AGENT_PROFILES is imported only by render.ts:1, so task 3 keeping the export
  name preserves that import; and render.test.ts's model assertions live only at lines 53,
  56, 104 — the three task 3 names to update. No stray assertion breaks.

### 4. Coverage and gate B/C (all tasks)
- Every requirement maps to a task (Req 1→7; 2→8; 3→1,3; 4→3,5; 5→4,6; 6→1,8; 7→2 with
  D7 deferral). No task exceeds the approved requirements (no gate-c), and no task adds an
  external dependency — the hook, generator and fold use only node builtins already in use
  (no gate-b).

### 5. Frontmatter assumptions (task 1)
- Verified all 12 agent files have `model` on line 4 and `effort` on line 5 (single-line
  `description` on line 3, `color` on line 6), so task 1's test assertion "model and
  effort equal lines 4-5" is safe for every key; `sdd-checker` is `claude-sonnet-5` /
  `high`; every `description` begins `SDD <role>:`, so the `role` regex resolves for all
  twelve. 12 agent files confirmed.

## Findings

**R1-1 — MINOR.** Fresh lens: read alone, task 3's `_Prompt` (loader default candidates
`../agent-profiles.json`, `../../harness/agent-profiles.json`) and task 5's `_Prompt`
(`--once` asserting `declared claude-opus-4-8 high`) do not restate that task 1 must have
generated and committed `harness/agent-profiles.json` first — the "12 keys" ledger case
and the tier-line frame both fail on an empty `{}` table otherwise. The document's
Dependency-order paragraph (line 7) names this bridge explicitly ("task 1 generates
`harness/agent-profiles.json`, which task 3's loader reads under vitest"), so an
implementer running tasks in order is unaffected. No fix required.

**R1-2 — MINOR.** Test-placement drift, not a coverage gap: design's Testing Strategy
(design.md:178) assigns the Req 5.4 start-less cases ("a start-less `spawn.end` dropped, a
start-less `spawn.usage` counted once") to `harness.test.ts` (task 6); the tasks doc tests
them only in `usage.test.ts` (task 4). Since the tool calls the pure fold, testing the rule
once at the fold is sufficient and matches D2's rationale. Harmless.

## Closing deliverables

- **Top risks/gaps (short doc, 3):** (1) none blocking — the two above are MINOR; (2) the
  cross-task file bridges (task 1→3→5 generated file; task 4→6 exports; task 5→6 fixture)
  are all named in the document body even where the `_Prompt` line omits them; (3) task 8
  and task 6 both restate count words and lists, and each carries the finding-command grep
  the agent-rules require. No risk rises to SHOULD_FIX.
- **Top 3 conclusions to challenge — none reverse.** The Component-3 split across tasks 2
  and 3 (D1), the single-fixture design (D8), and the same-PR hook/skills pairing (D5) each
  survived the atomicity/ordering attack: the split avoids a double render-test rewrite, the
  fixture is reachable in both the usage and `--once` paths, and one PR is intrinsic to a
  single implementation phase.
- **What's missing before acting:** nothing. The document is implementable as written; the
  only prerequisite is running the tasks in the stated order.

ESCALATE: none

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
