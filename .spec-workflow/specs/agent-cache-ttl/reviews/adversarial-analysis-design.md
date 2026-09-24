# Adversarial Analysis — agent-cache-ttl/design (v1), Round 1

Reviewer lens: feasibility, consistency, edge cases. Fresh lens: wire contracts across the
`spawn.end` → usage-reducer → `UsageCell` → `harness usage` boundary.

## What I checked and how

I read the target design in full, the codebase-context map, decomposition entry 13
(`.spec-workflow/spec-decomposition/decomposition.md:394-464`), the approved requirements
(v4), and every code artifact the document cites — both ends of each range:

- Hook: `harness/hooks/sdd-activity.sh` (whole file); `harness/hooks/hooks.json:27-37`
  (SubagentStop registration + 5 s timeout — accurate).
- Build script: `scripts/sync-plugin-assets.cjs` (`buildProfiles` 85-110, per-line split
  94-97, object literal 107, unconditional `main()` 166 — accurate; the per-line split
  stores `experimental` = `"{ cacheTtl: 1h }"`, and `/cacheTtl:([^}]*)\}/`.trim() → `"1h"`
  as C2/Req 1.4 claim).
- Watch: `src/watch/render.ts:192,218-227` (declared text 220, `padRight(declared,23)` 226),
  `src/watch/ledger.ts:18-24,38-42,51-78` (index-signature `LedgerEvent`; profile validity
  65-69; copy 70), `src/watch/__tests__/render.test.ts:55` (current `declared claude-opus-4-8
  high +actual`).
- Usage fold: `src/watch/usage.ts` (whole file — `UsageCell` 13, `emptyCell` 57-59, `addCell`
  65-69, `ReducedSpawn` 48-55, `reduceSpawn` 186-242, aggregation 131-156, report totals
  168-181, `formatOne` 288-299, `formatCompare` 301-330, `pair` 310), `src/tools/harness.ts:1063-1084`
  (`usageAction` passes `data.report`/`compare` through unchanged — accurate).
- Live-verification substrate: `scripts/dev-link.sh` (whole file — `REPO` derived from `$0`
  at 18; `CLAUDE_DIR` honours `CLAUDE_CONFIG_DIR` at 19; agent/skill links 37-38; hook
  registration 50-64), `.mcp.json:1-12`, `sdd-activity.sh:28-29,96,140,157` (shared `ts`).
- Supervisor/format: `SKILL.md:33-56` (Step 0), `:100-102` (run.start call), `:153-156`
  (Step 3 rule 1, retrospective route), `references/formats.md:179,194,199` (event.sh split
  at first `=`; run.start / spawn.end key rows). All accurate.

**Every cited path, line range, signature and behaviour in the document is correct**, including
the 12 citations the lint pass repointed (L-1 hooks.json:27-37, L-4 render.ts:192, L-7/8
usage.ts:57-59/65-69, L-10 ./.mcp.json:1-12, L-11/12 sdd-activity.sh:28-29/140/157). No
misstated-artifact MUST_FIX.

## The four re-decided requirement literals — all rulings: refinement (closed)

- **Req 1.5 (profile test in `src/__tests__`, loaded via exports + main-guard).** REFINEMENT.
  `vitest.config.ts:7` includes only `src/**` (context line 66, verified), so a test "beside
  the script" as the requirement literally wrote cannot run. Relocating to `src/__tests__` and
  driving `buildProfiles`/`cacheTtlOf` through `module.exports` preserves the requirement's
  intent (an independent extraction check, not a `check:plugin-assets` re-run) and is the only
  runnable location. D4 records it. No action.
- **Req 5.2.5 (user settings from `CLAUDE_CONFIG_DIR` when set, else `~/.claude`).** REFINEMENT.
  It is a strict superset of the requirement literal: identical when the variable is unset
  (the real supervisor session), and it reads `$H/settings.json` only when set — exactly the
  file Claude Code itself reads in that case. It is *required* for the design's own C8
  verification to be self-consistent (a probe reading `~/.claude` during a `CLAUDE_CONFIG_DIR=$H`
  session would report the wrong environment). D6 records it, and step 3's `FORCE_PROMPT_CACHING_5M`
  match short-circuits before settings in scenario (5) anyway. No action.
- **Req 6.2 (probe agent pair copying the orchestrator's frontmatter, not the orchestrator).**
  REFINEMENT. `sdd-cache-probe.md` copies the branch's `experimental:`/`model:`/`effort:` lines
  by `grep` from `<checkout>/harness/agents/sdd-document-orchestrator.md`, so it exercises the
  same `cacheTtl: 1h` line under a deterministic 660 s worker-induced gap. It proves the same
  property scenario (2) asserts (`gapRewrites` 0, read ≥ 90 % of prefix) without depending on a
  non-deterministic natural gap or the real orchestrator's phase skill. D2 records it. No action.
- **Req 6.7 (pre-merge isolated session replacing the mandated rebuilt-harness restart).**
  REFINEMENT. The requirement's operative gate — the retrospective reads
  `verification-evidence.md` and requires four `passed` — is kept verbatim (C7, Step 3 rule 1),
  and the file created at implementation with four `pending` lines still blocks the retrospective
  even if the operator skips the pre-merge run. D9 keeps that block as the backstop and only
  moves *when* the four scenarios run (after the PR opens, before merge) so a failure is fixed on
  the same branch instead of a second PR. The mechanism produces the same tracked evidence. See
  the binding-constraint check below for why it exercises the branch, not main. No action.

## Binding constraint — pre-merge verification exercises the BRANCH's `cacheTtl: 1h`

Confirmed sound. `e2e-setup.sh` runs `CLAUDE_CONFIG_DIR=$H bash <checkout>/scripts/dev-link.sh`.
`dev-link.sh:18` sets `REPO=$(cd "$(dirname "$0")/.." && pwd -P)` — i.e. `<checkout>` (the
worktree), and `:37` links `"$REPO"/harness/agents/*.md` into `$CLAUDE_DIR/agents`
(`=$H/agents`, via `:19`). So the scratch home symlinks the **branch's** orchestrator files and
registers the **branch's** hook (`:50-64`), and the launch commands run `CLAUDE_CONFIG_DIR=$H
claude …`. This sidesteps the `~/.claude/agents/sdd-*` → main symlink entirely: a session on
`$H` never reads main's `harness/agents`. The recorded evidence is written to the **real** spec
store (`--write /home/mcf/.../.spec-workflow/specs/agent-cache-ttl/verification-evidence.md`) and
committed by the operator (not the worktree-isolated agent, so the `.spec-workflow` write-guard
does not apply), which is the same file the post-merge retrospective reads. The evidence blocks
the **retrospective**, not the PR (the PR may merge on scenarios 4/6 alone per Req 6.7) — the
document is consistent with that.

## Fresh lens — wire contract, `spawn.end` → columns

Traced field by field; it agrees end to end.

- Hook writes `cacheWrite5m` / `cacheWrite1h` / `gapRewrites` as `"digits" | "unknown"` on
  `spawn.end` (C4, Data Model, formats.md:199 addition). `LedgerEvent` (`ledger.ts:18-24`) has a
  `[key:string]: string|undefined` index signature, so the reducer may read them untyped — good.
- `reduceSpawn` maps that one row to `ReducedSpawn.cache = { w5m, w1h, gap, unknownWrite,
  unknownGap }`, with at most one of `unknownWrite`/`unknownGap` set (write-unknown ⇒ gap 0 and
  `unknownGap` stays 0; write-known-gap-unknown ⇒ `unknownGap` 1). No-digit-`tokens` row ⇒
  `unknownWrite` 1.
- Aggregation adds `cache` to the agent cell, `ph.total` and `ph.providers.anthropic` only when
  `provider === 'anthropic'`; DeepSeek adds nothing (incl. `cacheUnknownWrite`), so a
  `@deepseek` cell stays 0 and `cacheCols(count=0)` prints `- - -`. Report totals add the same
  five fields; `addCell` covers all eight.
- `cacheCols` gate matches Req 4.6 exactly: write columns `unknown` iff `cacheUnknownWrite ===
  anthropicSpawns` else `grp(sum)` (partial-unknown writes are summed silently — Req 4.6 mandates
  this, so it is not a defect); gap column `unknown` iff `cacheUnknownWrite + cacheUnknownGap ===
  anthropicSpawns` else `grp(gap) (+N unknown)` with `N = cacheUnknownWrite + cacheUnknownGap`.
- The Anthropic-count source per cell (own `spawns` sans `@deepseek`; `ph.providers.anthropic.spawns`;
  `report.providers.anthropic.spawns`) is consistent with which spawns contributed cache.
- The crit-6 total-cell collapse (all-DeepSeek ⇒ `-`) and `formatCompare` five-dash absent cell
  (`- | - | - | - | -`) agree with carried notes 1/3 and Req 4.4/4.7.

No contradiction found on the boundary.

## Findings (all MINOR — do not keep the loop alive)

- **R1-1 (MINOR).** `recompute.mjs` reconstructs the subagent transcript path as
  `$H/projects/*/SESSION/subagents/agent-AGENTID.jsonl`. The binary probe the document records
  (C8 Dependencies; context line 92) verified `CLAUDE_CONFIG_DIR` only for the *settings*
  location and the absolute-path requirement — not for the projects/transcript directory. If
  Claude Code writes session transcripts under `~/.claude/projects` regardless of
  `CLAUDE_CONFIG_DIR`, scenario (3)'s independent recompute finds nothing. `recompute.mjs` is a
  scratch tool an implementer can re-glob at run time, so this is not a design blocker, but the
  assumption is load-bearing for scenario (3) and unprobed. Add one probe line before relying on it.
- **R1-2 (MINOR).** C8's stated invariant ("without touching `~/.claude`") and D1 ("leaves other
  sessions alone") understate what the live scenarios touch. With no `XDG_STATE_HOME`/`HOME`
  override, scenarios (1)/(2)/(5) append to the real `${XDG_STATE_HOME:-$HOME/.local/state}/sdd/
  active-run` and leave `spawn-ends` markers under real `~/.local/state`. `--clear-pointer` scoped
  to `$ROOT` (a unique `/tmp` path) makes this safe for concurrent real runs, but the framing is
  inaccurate and the markers are left as litter. Reword the invariant to "without touching
  `~/.claude`, and touching machine state only under `$ROOT`-scoped pointer lines."
- **R1-3 (MINOR).** Naming seam: `ReducedSpawn.cache` uses `{ w5m, w1h, gap, unknownWrite,
  unknownGap }` while the destination `UsageCell` uses `{ cacheWrite5m, cacheWrite1h, gapRewrites,
  cacheUnknownWrite, cacheUnknownGap }`. "Add `cache` to the agent cell" and "`addCell` covers all
  eight" hide a five-field remap; a reader could mistake it for a direct spread. Align the names or
  state the mapping in one line.

## Top 3 risks / gaps

1. Scenario (3) recompute depends on transcripts landing under `$H/projects` (R1-1) — the one
   unprobed link in the otherwise well-grounded C8 chain.
2. The whole pre-merge evidence path is operator-driven and multi-step (login, four scenario
   runs with exact exit conditions, pointer probe/clear between each, `--write`, commit). A
   skipped or mis-sequenced step yields `pending`/`failed` lines; the retrospective block
   catches that (fails safe), but it will surprise the operator late. This is inherent to the
   chosen approach, not a defect.
3. Scenario (1)'s exit condition ("first `PHASE:` line or gate A") must occur after at least one
   worker `spawn.end` exists for the "worker shows 5m" half; at gate A the requirements
   orchestrator has spawned workers, so this holds, but it is timing-dependent, not structural.

## Top 3 conclusions to challenge (none reversed)

1. D9 (run live scenarios pre-merge, not on a post-merge restart). Challenged: it deviates from
   Req 6.7's literal "rebuilt-harness restart." Upheld: it keeps the retrospective block verbatim,
   exercises the branch via `CLAUDE_CONFIG_DIR`, and produces identical tracked evidence — an
   equal-or-stronger mechanism.
2. D6 (read user settings from `CLAUDE_CONFIG_DIR`). Challenged as widening Req 5.2.5. Upheld: a
   superset that is necessary for the design's own verification to report the right environment
   and matches Claude Code's real read location.
3. D2 (probe pair instead of the real orchestrator for scenario 2). Challenged as not testing
   "that orchestrator." Upheld: the probe carries the branch's own `cacheTtl` line and gives a
   deterministic > 10 min gap; scenario (1) still exercises the real orchestrator.

## What is missing before acting

- One probe confirming subagent transcripts land under `$CLAUDE_CONFIG_DIR/projects` (R1-1),
  recorded beside the existing C8 binary probe.
- A one-line reword of the C8/D1 isolation claim to name the `~/.local/state` pointer/marker
  touch (R1-2).

These are MINOR; none blocks implementation.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
