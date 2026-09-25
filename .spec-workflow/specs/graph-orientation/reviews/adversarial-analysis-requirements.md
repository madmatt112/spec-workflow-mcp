# Adversarial Analysis — graph-orientation/requirements (v1), Round 1

Attack surface: completeness, ambiguity, scope. Fresh lens: wire contracts across a
boundary (router, values passed to `brief`, response/ledger shapes, orchestrator state).

## What I verified in code (both ends of every cited range)

All citations resolve and are accurate — no misstated artifact, so no automatic MUST_FIX
from the deltas:

- `harness/skills/sdd-continue/SKILL.md:66-94` (roots), `:224-247` (launch prompt, `CODE_ROOT`
  at line 232), `:320-327` (worktree rule) — all correct.
- `src/tools/harness.ts:17-27` (doc comment "spawns no child process"), `:28-49` (tool def,
  `brief` in the enum at 49), `:485-535` (`BRIEF_TEMPLATES`, five templates, no reviewer/checker),
  `:547-655` (`briefAction` fills `{{key}}` from `values`), `:617-631` (missing-value rule) — all correct.
- `src/watch/usage.ts:277-296` (phase attribution + return), `:361-410` (`formatOne`+`formatCompare`) — correct.
  Confirmed `usageAction` (1072-1093) reads only `harness-events.jsonl` via `readSpecLedger` (1029-1064);
  `buildUsageReport` is a pure fold with no file reads (module doc 1-9).
- `harness/skills/sdd-document-phase/references/briefs.md:50-59` (Codebase context), `:136-208`
  (round section, skill text), `:386-409` (narrow-check prompt, skill text) — correct; consistent with D7.
- `harness/skills/sdd-implementation-phase/SKILL.md:84-159` (per-task loop), `harness/skills/sdd-closeout-phase/SKILL.md:120-159`
  (batch loop), `.gitignore:166-167`, `docs/TOOLS-REFERENCE.md:547-579`, `docs/SDD-HARNESS.md:253-264` — correct.

Load-bearing external probe (D1, R2 AC4/AC5) re-checked and it **holds**: `graphify update`
runs `_rebuild_code` (`watch.py:949-1035`); a no-change rebuild returns `True` → CLI exit 0
(`watch.py:1485-1500`, `:1608-1610`; `cli.py:1980-1996`) while leaving `built_at_commit`
unmoved. So "trust exit 0, set behind to 0" (R2 AC4) is grounded. `cli.py:1976` prints
"no LLM needed" — Security NFR grounded.

Lint dispositions (prompt L-1..L-17, all rejected as to-be-built names) **hold**: `GRAPH`,
`graph`, `graphBuiltAt`, `graphBehind`, `explain`, `query` are genuinely absent from every
cited range today, and `grep -rl graphify harness/ src/` finds nothing.

The v1 lint pass changed only citations (added `:224-247`, `:28-49`, `:547-655`; `277-294`→`277-296`)
and a Revision History line. Every changed citation is accurate — the delta introduced no defect.

## Findings

### R1-1 (SHOULD_FIX) — Under worktree-per-change the graph the implementer/verifier use is the *main checkout's stale* graph, and R2 AC2's per-task refresh is dead; only the close-out case is disclosed

`agent-rules.md:5` sets `worktree-per-change: required`, and the worktree rule
(`sdd-continue/SKILL.md:320-327`, confirmed by `docs/SDD-HARNESS.md:262-264`) enters a
`feat/<spec>` worktree *before the first implementation spawn*. So during the whole
implementation phase `CODE_ROOT` is the worktree, and:

- R2 AC2's condition "`CODE_ROOT` is the main checkout" is **never true** — the per-task
  `graphify update` never runs. This is the identical situation the doc calls out for
  close-out in D12 ("does not fire today … land in a retro worktree"), but for
  implementation it is **not disclosed**. R2's own user story ("I want the graph rebuilt
  after code commits … so that a `file:line` from the graph matches the tree I read") is
  the promise that goes unmet.
- Worse: R1 AC1 resolves `GRAPH` to `<main checkout>/graphify-out/graph.json` for a
  worktree, and R2 AC6 forbids updating it from the worktree. The main checkout's graph
  does **not contain the worktree's new/changed symbols** (they live on `feat/<spec>`,
  unmerged). So `graphify explain "<newSymbol>"` returns "No node matching" (R3 AC3 → fall
  back to a cold read) for exactly the code the implementer and verifier are working on,
  and any `file:line` for a file the task edited is stale. `GRAPH_BEHIND` only grows.
- Verification blind spot: scenario (4) / R7 AC4 ("an implementer commit … `built_at_commit`
  moves to HEAD") can only pass in a **non-worktree** fixture, because the refresh it exercises
  is dead in a worktree. The headline freshness path is therefore never verified for how the
  harness actually runs on this machine.

Fix direction: state (as D12 does for close-out) that R2 AC2 does not fire under
worktree-per-change; decide and record what value the graph delivers during implementation
(stale, read-only, new symbols absent) and whether the fixture for scenario (4) must be
non-worktree — and whether that is representative.

### R1-2 (SHOULD_FIX) — `run.start` (R1 AC8) needs the *post-refresh* `graphBehind`, but R2 AC1 only pins the refresh to "before the first orchestrator spawn", which is after `run.start`

R1 AC8: `run.start` carries `graph=<path>` and `graphBehind=<n | unknown>` "(the value
after any Requirement 2 refresh)". R2 AC1: the run-start refresh runs "after Requirement 1
and **before the first orchestrator spawn**". In the skill, `run.start` is written in the
Run-ledger step (`sdd-continue/SKILL.md:108-110`), well before the first orchestrator spawn
(the launch prompt at `:224-247`). Read literally, a design can satisfy R2 AC1 by refreshing
just before the spawn — after `run.start` is already written — so `run.start` records a
pre-refresh (stale, or per D9 not-yet-resolved) `graphBehind`, violating R1 AC8. The two
criteria are only jointly satisfiable under an unstated ordering. Tighten R2 AC1 to
"before the `run.start` write" (or state that resolution+refresh precede `run.start`).

### R1-3 (SHOULD_FIX) — R6's `graph` column silently omits DeepSeek-routed workers, which are exactly the named-eligible code readers

R6's user story is "how many graphify calls each agent made … per role". The count comes
from `harness-activity.jsonl`, written by `sdd-activity.sh`, which records **only** subagents
whose `agent_type` matches `sdd-` (`sdd-activity.sh:126-127`) and requires `SDD_ACTIVITY_FILE`.
`provider-per-role` (decomposition spec 10) routes `sdd-reviewer` and `sdd-checker` — code
readers that will call `graphify` — through a separate `claude -p` child process, not the
Agent tool; spec 10 states "no plugin hook fires in the parent for a separate process."
A top-level `claude -p` child has no `sdd-` `agent_type`, so its Bash calls are not logged.
The report also keys DeepSeek agents as `sdd-reviewer@deepseek` (`usage.ts:366,399`) while an
activity row's `agent` is the bare `sdd-reviewer`, so even a logged call would mis-attribute.
Net: route the most-spawned reader to DeepSeek and its graph use reads 0. R6 never scopes
this. Add a sentence scoping the `graph` column to Agent-tool (anthropic) workers, matching
how `usage.ts` already special-cases `@deepseek`.

### R1-4 (MINOR) — R6's data-shape/attribution wire is a two-file join over an inline rule; call it out for design

R6 AC4 requires `data.report` (a `UsageReport`) to carry the counts and the tables to print
a `graph` column; AC3 reuses "the rule `src/watch/usage.ts:277-296`". But that rule is inline
in `buildUsageReport`'s per-*spawn* path over the **events** ledger, using `phaseStarts`/`phaseEnds`.
A graph call is an **activity**-file row with a `ts` and no `phaseKey`. Attributing it needs
the events-derived phase windows joined to the activity rows, and the inline rule extracted
to a reusable function; `buildUsageReport` (called directly by spec 9 per its doc comment)
must stay pure, so the merge belongs in `usageAction`. Implementable and adequately specified
at requirements level, but flag the join so design does not assume `buildUsageReport` produces
the counts.

### R1-5 (MINOR) — the shrink guard plus R2 AC7's "no `--force`" wedges the graph after a deletion-heavy commit

`_rebuild_code` refuses to shrink the graph without `--force` (`_check_shrink`, `watch.py:1612-1618`
→ returns `False` → CLI exit 1). R2 AC7 forbids `--force`. So a commit that removes code
(node count drops) makes `graphify update` exit non-zero; R2 AC5 then keeps the old
`GRAPH_BEHIND` and writes a note, and the graph stays behind until a human force-rebuilds.
D6 covers the graceful-degradation intent, but the specific trap (deletions can never be
picked up by the harness's refresh) is undisclosed. Worth one line in Reliability or D6.

### R1-6 (MINOR) — R3 AC6 cites the missing-value rule it cannot reuse

R3 AC6 fails a brief when `values.graph` is a path but `graphBuiltAt`/`graphBehind` are
absent, "as the missing-value rule does (`src/tools/harness.ts:617-631`)". But that rule
only checks `{{placeholder}}` keys, and R3 AC7 requires the graph values **not** be
placeholders. So the existing rule will not fire for them — R3 AC6 is a **new** check that
merely mimics the style. The "as … does" phrasing implies a code reuse that cannot happen
literally; reword to "in the same manner (fail naming them, write no file)".

## Top 5 risks / gaps

1. Implementation- and close-out-phase workers run in worktrees against a stale main-checkout
   graph that lacks their new code; R2 AC2 is dead and the freshness promise is unmet and
   unverified for real runs (R1-1).
2. `run.start` may record a stale/absent `graphBehind` because the refresh is pinned only to
   "before the first spawn," not "before `run.start`" (R1-2).
3. The per-role `graph` count omits DeepSeek-routed readers — the named-eligible reviewer and
   checker — so a cross-provider retro comparison silently understates graph use (R1-3).
4. The `graph`-count fold is an un-flagged two-file join (activity rows × events-derived phase
   windows) over an inline rule; design could wrongly hang it on the pure `buildUsageReport` (R1-4).
5. Deletion-heavy commits + "no `--force`" permanently wedge the graph behind HEAD until a
   manual rebuild (R1-5).

## Top 3 conclusions to challenge

1. "This makes every SDD worker that touches code start from the graph" (Introduction).
   Reverse for the implementation/close-out worker: in a worktree it gets the main
   checkout's graph, which has neither its new symbols nor a refresh, so it falls back to
   cold reads for the very code it changes. The delivered value is concentrated in the
   document phase (drafter/reviewer in the main checkout), not "every worker".
2. R2's user story — "the graph rebuilt after code commits … so a `file:line` matches the
   tree I read". Under this project's own worktree-per-change rule this never happens during
   implementation. D12 already concedes the analogous close-out case; the same concession is
   owed here, or the scope should say the per-task refresh targets non-worktree projects only.
3. R1 AC8's "(the value after any Requirement 2 refresh)". This assumes an ordering R2 AC1
   does not require. Either pull the refresh before `run.start` explicitly, or accept that
   `run.start` carries the pre-refresh count and drop the parenthetical.

## What's missing — do before acting on this document

- A disclosed decision on implementation-phase graph value under worktree-per-change (mirror
  D12), and whether scenario (4)'s fixture must be non-worktree and is representative.
- A tightened ordering statement pinning the run-start refresh before the `run.start` write.
- A scope sentence for R6 on DeepSeek-routed workers (activity log records only `sdd-`
  Agent-tool subagents), and the `@deepseek` agent-key handling for the `graph` column.
- One Reliability/D6 line on the shrink-guard-plus-no-`--force` staleness trap.
- Reword R3 AC6 so it does not claim to reuse a placeholder-only rule for non-placeholder values.

ESCALATE: none — the spec touches briefs, launch lines, a usage column and a local code-only
CLI (`graphify update`: AST, no LLM, no key); no money, secrets, auth, deletion or legal surface (D13 holds).

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
