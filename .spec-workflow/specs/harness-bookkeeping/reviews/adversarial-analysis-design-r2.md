# Adversarial Analysis — harness-bookkeeping/design (v2)

Round 2. Primary surface: feasibility, consistency, edge cases. Fresh lens: a cold read
for internal contradictions plus a truth table of the `spawn.usage` join, per the round
prompt. Attacked the v2 delta (R1-1/R1-2/R1-3/M1/M2 fixes, the Component 6 synthesis pass)
first, then applied the truth table.

## What I checked and how

- Read the v2 delta text (the `## Changes since 21edb33` diff and the `## Lint commit f871e5d`
  diff) and the whole design v2, the round-1 analysis, and the rolling memory.
- Read both ends of every code range the v2 delta added or re-pointed:
  `src/watch/ledger.ts` in full (spawn-pairing loop `226-248`, unmatched-`spawn.end` drop
  `241-242`, activity join `254-271`, `tokensTotal` `273`, ticker branch `300-301`),
  `src/watch/render.ts:62-211` (live-phase worker filter `121`, `agentLines` `180-211`),
  `harness/hooks/hooks.json` (the 5-second timeouts on lines `11`, `22`, `33`),
  `harness/hooks/sdd-activity.sh` (agent-name derivation, `SubagentStop` path),
  `harness/skills/sdd-continue/references/formats.md:150-199` (event script `169-181`,
  string-valued writes `178`, event table),
  `harness/skills/sdd-document-phase/SKILL.md:53-77` (Step 0 `D`-rule, decision table),
  `:120-218` (reviewer `136`, reviser `163-164`, adjudicator `191-195`, checker `211`),
  `harness/skills/sdd-implementation-phase/SKILL.md:44-182` (implementer/verifier/adjudicator/
  e2e-verifier launches), `harness/skills/sdd-closeout-phase/SKILL.md:54-85`, `:100-153`
  (byClass buckets, batch implementer / verifier / fix / adjudicator launches).

All v2 delta citations are accurate. R1-3's new `D = 1` branch matches
`sdd-document-phase/SKILL.md:56-60` verbatim. M2's `byClass` buckets `{ none, store, harness,
code, home }` and the `HARNESS_REPO: none ⇒ harness→to-do` note match
`sdd-closeout-phase/SKILL.md:70-78`, `:84-85`. M1's `:226-248` / `:241-242` tightening is
correct. Error Handling #6's 5-second timeouts are on `hooks.json:11`, `:22`, `:33`. The
`Number(tokens)` coercion matches the string-valued event script (`formats.md:178`) and the
existing `spawn.end` handling (`ledger.ts:245`). No new citation error; no MUST_FIX from the
delta's artifacts. The 29 open citation-identifier warnings are settled false positives as the
prompt records.

## The join truth table (fresh lens)

Per the round prompt, every join case a `--watch` run can see, given: the hook now writes
`spawn.start` **only** for a brief path (Component 5), the hook writes `spawn.end` for **every**
non-orchestrator `sdd-*` `SubagentStop` (Component 5, unconditional), and the orchestrator
writes one `spawn.usage` per worker (Component 7). Worker token truth now lives **only** on
`spawn.usage`: the hook `spawn.end` carries no `tokens`/`result` (Component 5 shape
`{ ts, type, run, spec, agent }`).

| Case | Events for the worker | Design outcome | Correct? |
| --- | --- | --- | --- |
| A. brief-launched, unique agent | `spawn.start` + `spawn.end` (no tokens) + `spawn.usage` | pairing makes one node; fold sets tokens/role/result on it once | yes — no double count |
| B. prompt-launched, unique agent | `spawn.end` (no tokens) + `spawn.usage`; no `spawn.start` | no matching node ⇒ synthesize level-2 node | yes |
| C. orphan `spawn.usage` (dropped `spawn.start`) | `spawn.usage` only | synthesize | yes |
| D. `spawn.start`/`end` but no `spawn.usage` | node with coarse role, **no tokens** | renders, token under-count (see note) | old-ledger path fine (4.1); new-ledger dropped-usage under-counts |
| **E. prompt-launched, agent reused from an earlier brief-launched worker** | `spawn.end` + `spawn.usage`; no `spawn.start` **of its own** | its `spawn.usage` folds onto the **stale earlier** node; **no synthesis** | **NO — R2-1** |

Case A does not double-count and no worker ever gets both a paired node and a synthesized
node (synthesis fires only "when no `spawn.start` matches"), so the fresh lens finds no
double-count and no double-render. It finds the opposite: case E drops a node entirely.

## Findings

### R2-1 — A prompt-launched worker whose agent was already spawned brief-launched folds onto the stale node and vanishes; the R1-1 fix does not cover agent reuse (MUST_FIX) — Compounds: R1-1

The v2 delta closed R1-1 by having Component 6 synthesize a node "**When no `spawn.start`
matches**" (design.md:66). The synthesis condition is too weak. "Matching `SpawnNode`" is
defined as "same `agent`, `spawn.start` at or before the usage `ts`, nearest open-or-latest"
(design.md:66). A **closed, already-folded** node of the same agent still satisfies that rule,
so when a prompt-launched worker shares its agent type with an **earlier brief-launched**
worker in the same run, the prompt-launched worker's `spawn.usage` folds onto the earlier
node and **no synthesis happens**. The worker gets no node of its own.

Two guaranteed real occurrences:

1. **`sdd-verifier`.** The per-task high-risk verifier is brief-launched —
   `verify-brief-task-<N>.md`, `Spawn sdd-verifier` (`sdd-implementation-phase/SKILL.md:114-118`)
   — so the hook writes its `spawn.start` and `buildModel` makes a node. Later, at the
   completion gate, the end-to-end verifier is prompt-launched — `verify-e2e.md`, `Spawn
   sdd-verifier` (`:174-177`) — with **no** brief path, so the hook writes no `spawn.start`.
   Its `spawn.usage` (agent `sdd-verifier`) finds the closed per-task-verifier node
   (`spawn.start` at or before the usage `ts`, "nearest ... latest") and folds onto it. The
   e2e verifier synthesizes nothing.
2. **`sdd-implementer`.** In close-out, the batch implementer is brief-launched —
   `closeout-brief-<class>-<b>.md`, `Spawn sdd-implementer` (`sdd-closeout-phase/SKILL.md:117-120`).
   A fix round spawns a fresh `sdd-implementer` prompt-launched from `closeout-fix-<class>-<b>-r<r>.md`
   (`:141-143`), no brief path. Its `spawn.usage` folds onto the closed batch node; no synthesis.

Result on the new path, exactly the R1-1 failure the delta claimed to close:
- The reused-agent worker (e2e verifier, close-out fix implementer) leaves the spawn block —
  it has no `SpawnNode` — and its tokens leave `tokensTotal` (`src/watch/ledger.ts:273`),
  because the stale node already had tokens from its own `spawn.usage` and the fold only sets
  fields "when the node lacks them" (design.md:66).
- Worse, the fold "overwriting `role` with the precise value" (design.md:66) has no such guard,
  so the earlier worker's node is **relabelled** — the task-5 verifier row now reads role
  "end-to-end verification". One worker vanishes and another is mislabelled from a single
  orphan `spawn.usage`.

This changes the spawn view and the token total, which the Overview (line 5) and Requirement
4.2 forbid. Today (old ledger) the e2e verifier and the close-out fix implementer are distinct
nodes with tokens, written by the orchestrator on `spawn.end` (`formats.md:191-192`;
`sdd-implementation-phase/SKILL.md:51-54`).

Root cause: the events carry **no spawn-instance key** — the hook `spawn.start` is
`{ ts, type, run, spec, agent, role }` with no `phase`/`task`/`round` (design.md:60), so
`agent` + time window is the only join key, and "nearest open-or-latest" **must** match closed
nodes for the normal brief case to work at all (the hook `spawn.end` fires on `SubagentStop`,
i.e. before the orchestrator reads the report and writes `spawn.usage`, so a brief node is
already closed at fold time). The same "or-latest" clause that case A needs is what mis-folds
case E. `agent` + time cannot both (a) fold a late-closed brief node and (b) synthesize a
reused-agent prompt-launched worker.

Fix direction the design must choose and state: make synthesis fire whenever no **unconsumed**
matching node exists (one `spawn.usage` per node, then synthesize), or carry a correlation key
(`task`/`round`/`phase`) on the hook `spawn.start` and match on it, or keep the orchestrator's
`spawn.start`/`spawn.end` for the reused-agent prompt-launched workers (e2e verifier, close-out
fix implementer) so they never depend on synthesis. Whichever, guard the `role` overwrite so a
mis-targeted fold cannot relabel a node.

### Minor

- **M-R2-1 (MINOR).** Component 5's brief-vs-prompt enumeration is incomplete and hides the
  agent reuse behind R2-1. It lists brief-launched as "drafter, lint/reviser, close-out batch
  implementer" but the implementation-phase implementer (`impl-brief-task-<N>.md`), high-risk
  verifier (`verify-brief-task-<N>.md`), adjudicator (`adjudication-brief-task-<N>.md`,
  `sdd-implementation-phase/SKILL.md:85-88`, `:114-118`, `:126-128`) and document-phase
  adjudicator (`adjudication-brief-<PHASE>.md`, `sdd-document-phase/SKILL.md:191-195`) are all
  brief-launched too and are omitted. They are handled correctly by the brief-path branch, so
  this is prose imprecision, not a second bug — but the omission is why the `sdd-verifier` /
  `sdd-implementer` reuse in R2-1 is easy to miss.

- **Case D note (not loop-keeping).** A brief-launched worker whose `spawn.usage` is dropped
  renders with only the coarse filename-stem role and **zero** tokens, since the hook
  `spawn.end` carries none. This is not a reliability regression versus today (token truth was
  already one orchestrator write, formerly `spawn.end.tokens`), so it is not a finding; but
  Error Handling #6 covers only the inverse (dropped `spawn.start`/`spawn.end`), and a one-line
  note that a dropped `spawn.usage` under-counts would complete the table.

## Top 3 risks/gaps

1. Reused-agent prompt-launched workers (e2e verifier vs per-task verifier; close-out fix
   implementer vs batch implementer) fold onto a stale node instead of synthesizing — they
   vanish from the spawn view and `tokensTotal`, and relabel the node they hit. R2-1.
2. The join has no spawn-instance key; `agent` + "nearest open-or-latest" cannot both fold a
   late-closed brief node and synthesize a reused-agent orphan. R2-1 root cause.
3. The `role` overwrite in the fold is unguarded, so a mis-targeted fold corrupts a correct
   node's role. R2-1.

## Top 3 conclusions to challenge or reverse

1. **"this keeps the Overview invariant on the new path" (Component 6, design.md:66).** Reverse
   as written: it holds only when every prompt-launched worker's agent is unique within the
   run. It is false for `sdd-verifier` (e2e vs per-task) and `sdd-implementer` (close-out fix
   vs batch).
2. **"When no `spawn.start` matches ... synthesizes" is a sufficient orphan rule.** Challenge:
   "matches" against `agent` + time also matches an unrelated, already-consumed earlier spawn
   of the same agent, so the orphan is never recognised as an orphan.
3. **The R1-1 fix is complete (Revision History v2, R1-1 Accepted).** Challenge: it lists the
   six prompt-launched workers by name but does not test whether any of their agent types is
   also spawned brief-launched earlier in the same run — two of them are.

## What's missing before acting on this document

- A synthesis rule that fires on an **unconsumed**-node basis (or a spawn-instance key on the
  hook `spawn.start`), so a reused-agent prompt-launched worker gets its own node and tokens.
- A guard on the fold's `role` overwrite so a mis-targeted fold cannot relabel a node.
- A one-line Error Handling note for a dropped `spawn.usage` (case D under-count).

VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: no
ESCALATE: none
