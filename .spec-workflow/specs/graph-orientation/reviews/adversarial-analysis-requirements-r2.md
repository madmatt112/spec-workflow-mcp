# Adversarial Analysis — graph-orientation/requirements (v2), Round 2

Attack surface: completeness, ambiguity, scope. Deltas attacked first (Revision History v2:
R1-1..R1-6 fixes + v2 lint). Fresh lens: a cold read for internal contradictions and a
truth table of the stated cases (freshness triggers vs the run-start fact; graph-column
scope vs "every worker"; worktree caveats D12/D14 vs R2's refresh criteria; every case —
present/absent/stale/behind, worktree vs non-worktree, Agent-tool vs DeepSeek — has one
defined behaviour).

## What I verified in code (both ends of every delta-touched range)

- `harness/skills/sdd-continue/SKILL.md:108-110` (new in R2 AC1) — this is the `run.start`
  row write (`bash <event.sh> run.start model=… codeRoot=<cwd> …`). Citation accurate. The
  refresh can precede it: R1 resolves the graph at step 1 roots (`:66-94`), the run-ledger
  block (`:96-116`) runs "after step 2" and ends at the `run.start` line. R1-2 fix lands correctly.
- `src/tools/harness.ts:1072-1093` (new in R6 AC4) — `usageAction` reads only
  `harness-events.jsonl` via `readSpecLedger` (1029-1064) and calls the pure
  `buildUsageReport`. `src/watch/usage.ts:113-218` (new in R6 AC4) — `buildUsageReport` is a
  pure fold, no file reads. AC4's "the join lives in `usageAction`, `buildUsageReport` SHALL
  NOT read the activity file" is grounded. R1-4 fix correct.
- `harness/hooks/sdd-activity.sh:126-128` (new in R6 AC8) — records only agents whose
  `agent_type` matches `(^|:)sdd-` (line 127 `process.exit(0)` otherwise); line 128 strips
  the prefix to the bare name. Citation accurate. DeepSeek workers confirmed to run via the
  Bash launcher (`sdd-document-phase/SKILL.md:27-31`: `bash <LAUNCHER> <agent> …`, foreground),
  a separate process, so no hook fires — AC8 sentence 1 is sound.
- `src/watch/usage.ts:366,399` (new in R6 AC8) — these are `agent.endsWith('@deepseek') ? 0
  : c.spawns`, computing the cache-spawn denominator; the `@deepseek` **keying** is at
  `usage.ts:159` (`agentKey = anthropic ? r.agent : \`${r.agent}@deepseek\``). See R2-2.
- `.../graphify/watch.py:842-907` (`_check_shrink`) and `:1374` (`rebuilt_sources |=
  set(deleted_paths)`), `cli.py:1976-1996` (update → `_rebuild_code` → `sys.exit(1)` on
  False). See R2-1 — the R2 AC1 pin, D8/AC6 reword and D14 disclosure are otherwise sound;
  the Reliability shrink-guard line is not.
- `harness/skills/sdd-continue/SKILL.md:320-327` (worktree rule) — enters a worktree before
  the first implementation spawn whenever `agent-rules.md` carries `worktree-per-change:
  required` (which it does, `agent-rules.md:5`). See R2-3.

Truth-table result: the present / absent / behind / unknown, worktree vs non-worktree, and
Agent-tool vs DeepSeek cases each resolve to exactly one behaviour, with the exceptions
below. No `run.start`-must-be-first invariant exists (`buildUsageReport` sorts by `ts` and
ignores `note` rows; `formats.md:204` lets any actor write a `note`), so the R1-2 pin does
not create a note-ordering contradiction.

## Findings

### R2-1 (MUST_FIX, fix-induced, Compounds: R1-5) — Compounding — the Reliability shrink-guard line is a false claim about graphify's behaviour; an ordinary code deletion refreshes without `--force`

The v2 Reliability line (requirements.md:118) states: "A commit that deletes code shrinks
the graph; the refresh's shrink guard then exits non-zero because Requirement 2 AC 7 forbids
`--force`, so Requirement 2 AC 5 keeps the previous `GRAPH_BEHIND` and the graph stays behind
HEAD until a human runs a forced rebuild outside this spec."

The installed graphify (0.9.35) does the opposite for a plain deletion:

- `_rebuild_code` folds the deleted paths into the re-extracted set:
  `rebuilt_sources |= set(deleted_paths)` (`watch.py:1374`), and passes `rebuilt_sources`
  to `_check_shrink` at both call sites (`:1418-1421` no-cluster, `:1612-1616` clustered).
- `_check_shrink` (`watch.py:842-907`) returns **True** (proceed, no `--force`) when every
  lost node is *accounted* — `source_file` in `rebuilt_sources` or no `source_file`
  (`:886-897`). Its own docstring: "This lets a plain `graphify update` after deleting a
  function refresh the graph without `--force` (#1116 left stale nodes write-blocked even
  though build dropped them)."
- The guard returns False (→ `_rebuild_code` returns False → `cli.py` `sys.exit(1)`) only on
  **unexplained** shrinkage: a lost node from a file *not* re-extracted this run (a half-
  written / failed extraction chunk), or a dropped semantic/doc node. `graphify update` is
  code-only (AST, no LLM — `cli.py:1976`), so the realistic trigger is a crashed extraction,
  not a code deletion.

So the premise ("a commit that deletes code → shrink guard exits non-zero") and the
conclusion ("graph stays behind HEAD until a forced rebuild") are both wrong: a deletion
commit refreshes the graph and exits 0, and R2 AC4 (behind → 0) applies. Round 1's R1-5
inferred the behaviour from the call site (`watch.py:1612-1618`) without reading
`_check_shrink`; the v2 delta encoded that error into the document, and the v2 lint then
removed the (out-of-repo) citation, leaving an uncited false claim. Note R2 AC4/AC5 are
themselves correct about exit codes — only this Reliability line is false. Fix: delete the
line, or rewrite it around the real wedge case (an interrupted/partial `graphify update`
that drops nodes from files it did not touch), which is what the no-`--force` rule actually
leaves stuck.

### R2-2 (MUST_FIX, fix-induced, Compounds: R1-3) — Compounding — R6 AC8 misstates `usage.ts:366,399` and claims a scope the spawns column does not have

R6 AC8 (requirements.md:93) ends: "so the `graph` column is scoped to Agent-tool
(Anthropic-routed) workers, the same scope the spawns column already keys apart with a
`@deepseek` suffix (`src/watch/usage.ts:366,399`)." Two errors:

1. Wrong line range for the described behaviour. The `@deepseek` **keying** happens at
   `usage.ts:159` (`const agentKey = anthropic ? r.agent : \`${r.agent}@deepseek\``, inside
   `buildUsageReport`). Lines 366/399 do **not** key anything apart — they read
   `agent.endsWith('@deepseek')` to zero `anthropicSpawns`, a denominator used only for the
   cache columns (`cacheStr`). Citing 366/399 for "keys apart with a `@deepseek` suffix" is a
   wrong-artifact citation.
2. Not "the same scope." The spawns column **includes** DeepSeek workers: their
   `sdd-<role>@deepseek` rows carry real spawn counts from the orchestrator-written
   `spawn.start` events (`buildUsageReport` 129-166), which fire regardless of Agent-tool vs
   separate process. The graph column **excludes** them (no activity row → 0). So a DeepSeek
   reviewer/checker prints `spawns > 0` but `graph = 0`. That is the opposite of "the same
   scope," and it silently understates exactly the per-role graph-use comparison R6's user
   story asks for ("compare tokens and graph use per role against `agent-cache-ttl`") for the
   heaviest-graph roles when they run off-Anthropic. R1-3 flagged this understatement; the v2
   fix disclosed the separate-process case (AC8 sentence 1, correct) but then justified it
   with a false equivalence that masks the gap instead of naming it.

Fix: cite `usage.ts:159` for the keying; drop "the same scope" and state plainly that a
DeepSeek/non-Agent-tool role shows `graph = 0` alongside a non-zero `spawns` count, so the
retro comparison undercounts graph use for those roles.

### R2-3 (SHOULD_FIX, fix-induced, Compounds: R1-1) — Compounding — R7 AC4 mandates a non-worktree scenario-4 fixture, but the spec never says how it runs under `worktree-per-change: required`, and R7 AC3's deferral does not cover it

R7 AC4 (requirements.md:104) now requires scenario (4)'s fixture to "make an implementer
commit in a non-worktree `CODE_ROOT`," since D14 establishes R2 AC2 fires only there. But
`agent-rules.md:5` sets `worktree-per-change: required`, and the worktree rule
(`sdd-continue/SKILL.md:320-327`) enters a worktree before the first implementation spawn
"if `agent-rules.md` exists and contains the line `worktree-per-change: required`." So in
this repo the implementation phase is **always** a worktree — R2 AC2 never fires and
scenario (4) cannot be produced by the normal loop. The only non-worktree path is a fixture
repo whose `agent-rules.md` omits that line (the worktree rule is guarded on it), which the
spec never states.

R7 AC3's deferral is scoped to a scenario that "needs a harness run in a rebuilt and
restarted session" — a session-restart concern, not a worktree-config concern. Scenario (4)
needs both (new code) *and* a non-worktree checkout, and `agent-rules.md:80` forbids closing
it "with a silent harness decision." Net: scenario (4)'s execution environment is
unspecified, so the verifier must improvise (a fixture repo without the worktree line, or a
manual commit + manual `graphify update` that bypasses the R2 AC2 orchestrator trigger
entirely). Fix: state that scenario (4) runs against a fixture whose `agent-rules.md` omits
`worktree-per-change` (so R2 AC2's orchestrator path actually executes), and widen R7 AC3's
deferral to cover a scenario that cannot run under this repo's worktree rule.

## Top 3 risks / gaps

1. The Reliability section asserts a graph-wedge on code deletions that the installed
   graphify explicitly prevents; anyone reading it will mis-model the tool and may add a
   needless manual-rebuild step for the common deletion case (R2-1).
2. The per-role `graph` column reads 0 for DeepSeek reviewer/checker even when they used the
   graph, and R6 AC8 frames that as "the same scope" as spawns — masking the very
   cross-provider comparison R6 exists to serve (R2-2).
3. Scenario (4) — the only end-to-end proof that the freshness refresh moves `built_at_commit`
   — cannot run in this repo's worktree-per-change loop, and the spec neither specifies its
   non-worktree fixture nor routes it through a deferral that fits (R2-3).

## Top 3 conclusions to challenge or reverse

1. Reverse "the refresh's shrink guard then exits non-zero because Requirement 2 AC 7 forbids
   `--force`" (Reliability). A deletion commit passes the guard and refreshes at exit 0;
   the no-`--force` rule only wedges an *unexplained* shrink (a crashed extraction).
2. Reverse "the same scope the spawns column already keys apart with a `@deepseek` suffix"
   (R6 AC8). The spawns column shows DeepSeek rows with counts; the graph column shows 0 for
   them — a strictly narrower, not identical, scope.
3. Challenge R7 AC3's "rebuilt and restarted session" as the deferral gate for scenario (4).
   The scenario's blocker is a worktree-config departure, not a session restart, so the gate
   as worded does not actually catch it.

## What's missing — before acting on this document

- Correct or delete the Reliability shrink-guard line (real wedge = partial/failed
  extraction, not deletion).
- Fix R6 AC8's `usage.ts` citation (keying is at :159) and replace the "same scope" claim
  with an explicit undercount warning for non-Agent-tool roles.
- Specify scenario (4)'s non-worktree fixture (a repo without `worktree-per-change`) and a
  deferral route that fits a worktree-config departure.

ESCALATE: none — the spec still touches only harness briefs, launch lines, a usage column and
a local code-only CLI (`graphify update`: AST, no LLM, no key); no money, secrets, auth,
deletion or legal surface (D13 holds). The two MUST_FIX are documentation-accuracy defects in
delta prose, not security or data holes.

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
