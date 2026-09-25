# Adversarial Analysis — graph-orientation/requirements (v3), Round 3

Attack surface: completeness, ambiguity, scope. Deltas attacked first (Revision History v3:
R2-1..R2-3 fixes + v3 lint, which fixed 0 and changed no citation). Fresh lens for this round:
every cited artifact touched by the v3 delta re-read at both ends of its range, and the
graphify/usage.ts vendor-behaviour facts checked against their source rather than inferred
from a call site (the exact miss that produced round 2's two MUST_FIX).

## What I verified in code (both ends of every delta-touched range)

### v3 rewrite 1 — the Reliability shrink-guard line (requirements.md:118), fixes R2-1

The v3 line reads: "A `graphify update` that loses nodes from source files it did not
re-extract this run — an interrupted or partial extraction, not an ordinary code deletion —
trips the refresh's shrink guard and exits non-zero; because Requirement 2 AC 7 forbids
`--force`, Requirement 2 AC 5 then keeps the previous `GRAPH_BEHIND` until a human reruns the
update or forces a rebuild outside this spec. A commit that only deletes code does not trip the
guard: the guard accounts for the deleted paths and the refresh exits 0."

Read end to end against installed graphify 0.9.35:

- `_check_shrink` (`watch.py:842-907`) returns True (proceed, no `--force`) whenever every
  *lost* node is accounted — `not source_file`, or `source_file in rebuilt_sources`
  (`:886-897`). It returns False (refuse) only on an unexplained loss: a lost node whose
  `source_file` is not in the re-extracted set, and only when there is a net node-count
  shrink (`len(new_nodes) < len(existing_nodes)`, `:884`). Its docstring names the trigger as
  "SILENT shrinkage from failed extraction chunks (a half-written semantic pass)."
- Both update call sites fold the deletions into the accounted set before the guard:
  `rebuilt_sources |= set(deleted_paths)` (`watch.py:1374`), then pass `rebuilt_sources` and
  `had_explicit_deletions=bool(deleted_paths)` to `_check_shrink` at `:1418-1423` (no-cluster)
  and `:1612-1618` (clustered). So the lost nodes of a deletion-only commit are all accounted →
  guard returns True → write proceeds.
- Exit code: `_rebuild_code` returning False reaches `cli.py:1980-1996` — `ok = _rebuild_code(...)`;
  `if not ok: ... sys.exit(1)`. So a refused shrink is exit 1, and a normal/deletion refresh is
  exit 0 (the "no change" branch also exits 0, `watch.py:1607-1610`).

The v3 line is now precise: the partial-extraction wedge is the real non-zero-exit trigger, a
deletion-only commit exits 0, and R2 AC7's no-`--force` rule is what leaves the wedge stuck.
R2-1 is resolved. No new claim error.

### v3 rewrite 2 — R6 AC8's `@deepseek` keying and undercount (requirements.md:93), fixes R2-2

The v3 clause reads: "The spawns column is not scoped the same way: it keys a non-Anthropic
role apart with a `@deepseek` suffix (`src/watch/usage.ts:159`) but still counts its real
spawns from `spawn.start` events, so a DeepSeek reviewer or checker row prints a non-zero
`spawns` count alongside `graph=0`, undercounting that role's graph use in the retrospective
comparison."

- `usage.ts:159` is exactly the keying: `const agentKey = anthropic ? r.agent : \`${r.agent}@deepseek\`;`.
  Citation now correct (round 2 had the wrong lines 366/399, which only zero the cache-spawn
  denominator).
- The `@deepseek`-keyed cell's `spawns` is incremented at `:166` (`cell.spawns += 1`) once per
  reduced spawn, and reduced spawns originate from `spawn.start` events (`:129-132`).
  `formatOne` prints the real count `grp(c.spawns)` (`:367`); the graph column (to be added)
  reads 0 for a separate-process worker because no `sdd`-prefixed activity row exists
  (`sdd-activity.sh:126-128`). So a DeepSeek reviewer/checker row does show `spawns>0, graph=0`.
- The "same scope" false-equivalence is gone and replaced with an explicit undercount
  statement. R2-2 is resolved. No new claim error.

### v3 rewrite 3 — scenario-4 fixture + widened deferral (requirements.md:103-104), fixes R2-3

- The worktree rule (`sdd-continue/SKILL.md:320-323`) enters a worktree only "if `agent-rules.md`
  exists and contains the line `worktree-per-change: required`." A fixture checkout whose
  `agent-rules.md` omits that line therefore never enters a worktree, and an implementer commit
  lands in the non-worktree `CODE_ROOT` — exactly the `CODE_ROOT is the main checkout` condition
  R2 AC2 needs. Accurate.
- The widened R7 AC3 deferral ("or needs a fixture checkout that departs from this repo's
  `worktree-per-change: required` rule") is backed by `agent-rules.md:77-80`: "A live-verification
  scenario that cannot run inside the normal loop stays `pending` ... Do not close it with a
  silent harness decision." A worktree-config departure is a "cannot run inside the normal loop"
  case, so the deferral route fits. R2-3 is resolved.

### Other load-bearing citations spot-checked at both ends (fresh lens)

- `harness.ts:617-631` (R3 AC6/D8, missing-value rule) — the rule scans only `{{(\w+)}}`
  matches in the body (`:620`) and fails on missing required placeholders (`:622-631`). This
  confirms R3 AC7's claim that graph values, not being `{{key}}` placeholders, are never checked
  by it, so the graph-values check must be a new one. Accurate.
- `usage.ts:277-296` (R6 AC3, phase attribution) — comment (e) at `:277` uses `phaseKey` else
  the live-phase window else `'unknown'` (`:293`), returned at `:296`. R6 AC3's "the phase whose
  live window contains the row's `ts` ... else to phase `unknown`" reuses the live-window branch
  correctly for activity rows (which carry no `phaseKey`). Accurate.
- `harness.ts:28-49` (R3 AC1) — tool definition and the action enum containing `brief` (`:49`).
  Accurate.
- `briefs.md:50-59` (R5 AC1, `## Codebase context`) — heading at `:50`, "reads it first" at
  `:59`; existing rule already says "Cite only after reading both ends of the range" (`:57`),
  consistent with R5 AC1/AC3. Accurate.
- `agent-rules.md:5` = `worktree-per-change: required`; `.gitignore:166-167`, `sdd-activity.sh:126-128`
  and the graphify probes (`explain` exits 0 on no match; `query --budget`; code-only, no LLM)
  match the codebase-context probes. Accurate.

Result: the v3 delta introduced no new claim error, and the three round-2 findings are all
resolved against the real code. This is the pattern the prompt warned about ("every MUST_FIX
after round 1 is a claim error introduced by the previous delta") — checked directly, and the
delta is clean this round.

## Findings

No MUST_FIX. No SHOULD_FIX. Two MINOR observations, neither of which keeps the loop alive
(both are values safely left to a later phase).

### R3-1 (MINOR, Novel) — the `graph` column's position in the table row is unspecified

R6 AC4 (requirements.md:89) requires "a `graph` column on every phase-agent row, every phase
total and the spec total," and R6 AC7 says "only the header and row shapes gain the `graph`
column," but neither states where the column sits relative to the existing
`spawns | tokens | cw5m | cw1h | gapRewrites` order (`usage.ts:362`). This is a formatting
value safely settled in design/tasks; it changes no behaviour and does not block. Note only.

### R3-2 (MINOR, Novel) — scenario-4's fixture prerequisites beyond the worktree line are implicit

R7 AC4 (requirements.md:104) pins the fixture to "a checkout whose `agent-rules.md` omits the
`worktree-per-change: required` line," which is the necessary condition. For R2 AC2 to actually
fire, the same fixture also needs graphify on PATH, a `graphify-out/graph.json` present (so
`GRAPH` is a path), and a real per-task implementer report. These are implied by "run the
decomposition entry's scenarios" and belong in `verification-evidence.md`/design, so this is a
completeness note, not a defect in the requirements text. Note only.

## Top 3 risks / gaps

The document is clean on the primary attack surface this round. The residual risks are the two
MINOR notes above (column position, fixture prerequisites), both deferrable. No completeness,
ambiguity or scope gap rises to SHOULD_FIX: every stated case (present/absent/behind/unknown
graph, worktree vs non-worktree, Agent-tool vs DeepSeek, deletion vs partial-extraction refresh)
now resolves to exactly one defined behaviour with a correct code citation.

## Top 3 conclusions to challenge or reverse

None this round. The three round-2 conclusions the document reversed (deletion trips the guard;
spawns and graph "same scope"; the restart-only deferral gate) were each reversed correctly and
verified against source. I found no standing conclusion in v3 that the code contradicts.

## What's missing — before acting on this document

- Nothing that blocks. In design/tasks, fix the `graph` column position (R3-1) and spell out
  scenario-4's full fixture kit (R3-2, into `verification-evidence.md`).

ESCALATE: none — the spec still touches only harness briefs, launch lines, a usage column and a
local code-only CLI (`graphify update`: AST, no LLM, no key); no money, secrets, auth, deletion
or legal surface (D13 holds).

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
