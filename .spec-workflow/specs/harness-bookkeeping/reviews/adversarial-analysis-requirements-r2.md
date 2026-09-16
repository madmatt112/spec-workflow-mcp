# Adversarial Analysis — harness-bookkeeping/requirements (v2, round 2)

Primary surface: completeness, ambiguity, scope. Deltas attacked first (the R1-1…R1-8
fixes recorded in the v2 Revision History), then the fresh lens named for this round:
the cost of touching an existing component — for every requirement that changes `--watch`
rendering, the hooks, or the HANDOFF `## Phase log` table, does it protect the behaviour
and the rendered artifacts the decomposition entry says must keep working?

## What I checked and how

- Re-read the full v2 document, the round-1 analysis, and the rolling memory.
- Read both ends of every citation the v2 delta and the lint commit (`dc627db`) added or
  moved: `harness/hooks/sdd-activity.sh:61-63` (and the whole hook, 1-69),
  `src/watch/render.ts:180-208` and the ticker render at `:169-172`,
  `src/watch/ledger.ts:138`, `:206-211`, `:209-211` and the ticker source `:296-315`,
  `src/watch/index.ts:65`, `harness/skills/sdd-continue/references/formats.md:52-67`,
  `:69-81`, `:169-181`, `:185-199`, `harness/skills/sdd-continue/SKILL.md:139-143`,
  `:157-175`, `:180-199`, `harness/skills/sdd-closeout-phase/SKILL.md:16-17`, `:24`,
  `:44`, `harness/skills/sdd-document-phase/SKILL.md:44-77`,
  `src/core/index-generator.ts:44-72`, `src/tools/spec-index.ts:75-89`.
- Verdict on the deltas' citations: every path/line the v2 delta added resolves and the
  cited artifact says what the sentence claims. No MUST_FIX from a misstated artifact
  this round. The findings below are semantic completeness/scope gaps in the fixes, not
  bad paths.

The round-1 findings are all marked Accepted in the Revision History and each landed a
concrete change. The gaps below are what those changes left uncovered.

## Findings

### R2-1 — SHOULD_FIX — Compounds R1-1 — The ticker is a rendered spawn artifact the "same spawn view" fix still does not cover

The R1-1 fix moved the precise `role`, `result` and `tokens` onto the orchestrator's
`spawn.usage` event and pinned the renderer change to `src/watch/render.ts:180-208`
(4.2 — the `agentLines` spawn block). But that is not the only place the renderer paints
`role` and `result`. The ticker builds its spawn lines in `src/watch/ledger.ts:300-301`:

```
e.type === 'spawn.start' || e.type === 'spawn.end' ? `${e.agent ?? ''}  ${e.role ?? ''}${e.result ? `  -> ${e.result}` : ''}` :
```

and renders them at `src/watch/render.ts:171`. Under the new path:

- `spawn.start` (hook) carries only the coarse filename role → the ticker line degrades
  from today's `sdd-reviewer  review v3` to `sdd-reviewer  review`.
- `spawn.end` (hook) carries neither `role` nor `result` (wire-contract table, only
  `agent`) → the ticker line loses both, where today `spawn.end` shows
  `sdd-reviewer  review v3  -> converged 0/0/1`.
- `spawn.usage` is not one of the ticker's event branches (`ledger.ts:300-308` handles
  `spawn.start`/`spawn.end`/`task.*`/`round`/`phase.*`/`run.end`/`note` only), so it
  renders as a bare `spawn.usage` line with empty detail; its precise role/result/tokens
  never appear.

The memory's R1-1 named the ticker (`ledger.ts:301`) explicitly, but the v2 fix scoped
4.2 to `render.ts:180-208` and left the ticker out. No criterion covers it. Either widen
4.2 to name the ticker source (`ledger.ts:296-315`) and add a `spawn.usage` branch there,
or the ticker is a rendered artifact that changes with no requirement behind it.

### R2-2 — SHOULD_FIX — Compounds R1-4 — Requirement 5.4's `interrupted` trigger contradicts both the supervisor rule it cites and `--watch`'s live-phase rule

5.4 was added to preserve the `interrupted` row R1-4 said would be lost. But the trigger
it invents does not match the behaviour it claims to preserve, and it collides with
Requirement 4.

- **Wrong trigger.** 5.4 fires on "a `phase.start` with no matching `phase.end`." The
  supervisor's actual rule (`sdd-continue/SKILL.md:139-143`, the cited source) is
  different: before dispatching *implementation*, it compares the `## <spec> —
  implementation` **State row** against the `## Phase log` table and writes `interrupted`
  only when the State row records more tasks done than the last phase-log row. It is
  implementation-only and driven by two HANDOFF sections, not by a ledger
  phase.start/phase.end mismatch.
- **Marks a live phase interrupted.** An unclosed `phase.start` is exactly what
  `buildModel` treats as the **live phase** (`src/watch/ledger.ts:216-224`), guarded by
  `!runEnd`. 5.4 has no run-ended guard. Because phase-log generation is exposed as a
  server tool (D3), any call while a run is live — or `--watch` itself — would write an
  `interrupted` row for the phase that is merely in progress. The same ledger state is
  then "live" under Requirement 4 and "interrupted" under Requirement 5.4.
- **Wrong state value.** 5.4 says emit "the state from the `phase.start`
  (`formats.md:189`)." That line defines `phase.start` `state` as the entry snapshot
  (`tasks a/b … at entry`). The supervisor's interrupted row records the *advanced* State
  row (more tasks done). So the emitted row would show the entry count, not the ahead
  count the row is meant to capture — different content from "the row the supervisor
  writes today."

Add a run-ended (or prior-run) guard, restate the trigger as the State-row-ahead
comparison the source actually uses, and pin which state value the row carries.

### R2-3 — SHOULD_FIX — Novel — Requirement 5 renders one spec's rows into a `## Phase log` table shared by every spec, with no rule to preserve the others

The `## Phase log` table is a **single shared table** in HANDOFF.md with a `Spec` column
(`formats.md:56-57`, `:65`); `parseHandoffPhaseRows` returns only the current spec's rows
by filtering `cells[1] !== spec` (`src/watch/ledger.ts:157`). Requirement 5 renders
per-spec — 5.1 "rendered for a spec," reading `specs/<spec>/harness-events.jsonl`
(`src/watch/index.ts:65`) — and instructs the renderer to "write only the `## Phase log`
block, leaving the routing header … and the `## <spec> — <stage>` sections … unchanged."
It lists what to preserve but omits the other specs' rows inside that same block. An
implementer who rebuilds the block from one spec's `phase.end` events clobbers every other
spec's phase-log history in the shared file. This is a data-loss path in HANDOFF.md that
no criterion guards. 5.1 must state that rows for other specs in the block are preserved
(regenerate/replace only the rows whose `Spec` cell is this spec).

### R2-4 — SHOULD_FIX — Novel — Requirement 3 moves spawn events into a second file the hook does not write today, and never says the hook keeps its activity writes

`harness/hooks/sdd-activity.sh` writes exactly one file — `harness-activity.jsonl`
(line 28) — and its events are `tool`/`agent.start`/`agent.stop` shaped
(`event`, not `type`; `ActivityEvent`, `ledger.ts:22-32`). Requirement 3.1/3.2 now
require the same hook to append `spawn.start`/`spawn.end` **to `harness-events.jsonl`**
in `LedgerEvent` shape (`type`/`run`/`spec`, `ledger.ts:14-20`). Two gaps the change does
not protect:

- The hook must now write two files in two shapes; the document never notes the hook
  writes to a file it does not open today, nor that the spawn events must carry
  `type`/`run`/`spec` (the ledger shape), not the activity `event` key.
- Nothing says the hook keeps emitting its activity events. Those feed the live view the
  Introduction promises is unchanged: the `last tool` line and the age badge
  (`render.ts:188-196`, `:205-206`) and the `agent.stop` token fallback
  (`ledger.ts:265`, ticker `:311-314`). The Reliability NFR and 4.1 pin only *old*
  ledgers; no criterion protects the live activity view for new runs. An implementer
  rewriting the hook per Requirement 3 can drop the activity writes and break the live
  badge with nothing failing.

## Top 5 risks / gaps

1. The ticker loses `role` and `result` and shows a blank `spawn.usage` line on the new
   path; 4.2's renderer criterion stops at `agentLines` (R2-1).
2. Requirement 5.4 would stamp a live, in-progress phase as `interrupted`, contradicting
   the live-phase rule Requirement 4 relies on (R2-2).
3. Per-spec phase-log rendering into a spec-shared table can wipe other specs' history
   from HANDOFF.md (R2-3).
4. The hook's move to a second file leaves its existing activity writes — and the live
   view they feed — unprotected (R2-4).
5. 5.4's `interrupted` row would carry the entry-state snapshot, not the advanced
   task count the supervisor's row records (part of R2-2).

## Top 3 conclusions to challenge or reverse

1. **"same role, result and per-spawn token total it renders today (`render.ts:180-208`)"
   (4.2).** The citation is too narrow. `role` and `result` are also rendered by the
   ticker (`ledger.ts:300-301` → `render.ts:171`); pinning only `agentLines` leaves a
   second rendered surface uncovered (R2-1).
2. **"preserving the row the supervisor writes today" (5.4).** Reverse this framing. The
   rule 5.4 writes is not the supervisor's rule — different trigger, different scope,
   different state value — and it fights `--watch`'s live-phase handling (R2-2).
3. **"write only the `## Phase log` block, leaving the routing header and the sections
   unchanged" (5.1).** Incomplete: the block itself is shared across specs, so "leaving
   the block's other-spec rows unchanged" is the load-bearing preservation clause, and it
   is missing (R2-3).

## What's missing — before design

- A ticker criterion: name `ledger.ts:296-315` alongside `render.ts:180-208`, and require
  a `spawn.usage` branch so the ticker's spawn lines keep their precise role/result.
- A corrected 5.4: a run-ended/prior-run guard, the real State-row-ahead trigger, and the
  state value the `interrupted` row carries.
- A preservation clause in 5.1 for other specs' rows in the shared `## Phase log` table.
- An explicit statement that the hook keeps its `harness-activity.jsonl` writes and that
  the new spawn events are ledger-shaped (`type`/`run`/`spec`) in `harness-events.jsonl`.

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 4
MINOR: 0
DESIGN_READY: no
ESCALATE: none
