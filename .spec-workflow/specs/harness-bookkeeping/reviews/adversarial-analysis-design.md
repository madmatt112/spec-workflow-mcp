# Adversarial Analysis — harness-bookkeeping/design (v1)

Round 1. Primary surface: feasibility, consistency, edge cases. Fresh lens: wire
contracts across a boundary (hook → ledger → fold → render). Deltas since `fac6bea`
attacked first, then the fresh lens.

## What I checked and how

- Read the whole design (v1), `requirements.md` (v3), `codebase-context.md`, decomposition
  entry 6 (`decomposition.md:131-164`), and `agent-rules.md`.
- Read both ends of every code range the v1 diff added or widened:
  `src/tools/root-selection.ts:202-221` (selectRoots — correct), `src/core/task-parser.ts:153-356`
  and `:164-176` (parseTasksFromMarkdown / checkboxIndices / endLine bounds — correct),
  `src/tools/spec-status.ts:37-114` (`:69-79` deriveSpecStatus + deriveDocumentApprovalStates
  usage — correct), `src/watch/ledger.ts:14-32` (LedgerEvent/ActivityEvent — correct),
  `:129-142` (parseJsonl torn tail — correct), `:63-78` (SpawnNode — correct), `:188-248`
  (buildModel head + spawn-pairing loop), `:273` (tokensTotal), `:300-301` (ticker detail),
  `src/watch/render.ts:180-211` (agentLines), `src/watch/index.ts:35-39` (handoffPath — correct),
  `src/types.ts:58-76` (ToolContext — correct), `decomposition.md:152-161` (e2e scenarios — correct).
- Traced the boundary: `harness/hooks/sdd-activity.sh`, `hooks.json`, the event script and
  event table `harness/skills/sdd-continue/references/formats.md:154-199`, every worker-launch
  site in `sdd-document-phase/SKILL.md`, `sdd-implementation-phase/SKILL.md`,
  `sdd-closeout-phase/SKILL.md`, and the brief filenames in
  `sdd-document-phase/references/briefs.md`.

The added/widened citations in the diff are all accurate or acceptably broadened; no
misstated artifact. The lint-rejected L-findings are correctly rejected (plain-English
backticks, design-coined field names, Node stdlib, enum/column literals, or artifacts
cited in Component 5). Nothing to re-raise there.

## Findings

### R1-1 — Prompt-launched workers vanish from `--watch`; contradicts the Overview (MUST_FIX)

The Overview (line 5) and Requirement 4.2 pin the invariant: "Nothing in the phase, spawn
or token totals `--watch` renders changes." Components 5, 6 and 7 break it for every worker
that is **not** launched from a `*-brief*` file.

Mechanism, end to end:
- Component 7 drops `spawn.start`/`spawn.end` for **all** workers ("drop `spawn.start`/`spawn.end`
  for workers"; Requirement 3.3 is unconditional).
- Component 5's hook only writes `spawn.start` "on `PreToolUse` whose `tool_input.prompt`
  contains a brief path" and derives `role` from "the brief filename stem before `-brief`".
- But the reviewer is spawned with `Read and execute the instructions in <promptOutputPath>`
  where the file is `reviews/adversarial-prompt-<PHASE>.md` (`sdd-document-phase/SKILL.md:136`);
  the checker with the narrow-check prompt (`adversarial-prompt-<PHASE>-r<N>.md`, `:211`); the
  end-to-end verifier with `verify-e2e.md` (`sdd-implementation-phase/SKILL.md:174-177`); the
  close-out verifier with `closeout-verify-<class>-<b>-r<r>.md` and the close-out adjudicator
  with `closeout-adjudication-<class>-<b>.md` (`sdd-closeout-phase/SKILL.md:138,146`). **None of
  those filenames contains `-brief`.**
- So the hook writes no `spawn.start`/`spawn.end` for them, the orchestrator wrote none
  either, and Component 6's fold ("folds each `spawn.usage` onto the matching `SpawnNode`")
  has no node to fold onto — the design never says what happens to an unmatched `spawn.usage`.
  The event is dropped.

Result on the new path: the reviewer, checker, e2e verifier, close-out verifier and close-out
adjudicator — all `level: 2` spawns that render today (`src/watch/render.ts:121`) and whose
tokens are summed today (`src/watch/ledger.ts:273`) — disappear from the spawn block and drop
out of `tokensTotal`. Today these spawns are written by the orchestrator with tokens
(`sdd-document-phase/SKILL.md:46`, Lint step `:117`). This is a change in the spawn view and
the token total, which the Overview and Requirement 4.2 say must not change. The e2e scenarios
do not catch it: scenario 3 tests only "a brief path in its prompt" and scenario 4 runs on
**old** ledgers.

Fix direction the design must choose and state: either the fold synthesizes a node from an
orphan `spawn.usage` (so prompt-launched workers still render and count), or the hook's
detection/role rule is widened to the "Read and execute the instructions in `<path>`" prompt
shape (not just `*-brief*`), or the orchestrator keeps writing `spawn.start`/`spawn.end` for
prompt-launched workers. Whichever, D3's rationale "the filename already names the role" only
holds for `*-brief*` files and must be scoped accordingly. Related: "the five brief kinds"
(Scope notes / D2) is never enumerated, and Component 3 never pins the brief output-filename
convention the hook depends on.

### R1-2 — Reliability path only covers "run completes," not "worker dropped from the view" (SHOULD_FIX)

Error Handling #5 says a "missing event script or hook: the phase still completes; a missing
ledger never stops a run." True for run completion, but it conflates that with the render
contract. After the change, a worker's visibility and its tokens depend entirely on the hook
firing (`spawn.start` on `PreToolUse`, `spawn.end` on `SubagentStop`). The `PreToolUse`/
`SubagentStop` hooks carry a 5-second timeout (`harness/hooks/hooks.json:12,22,31`); a timed-out
or otherwise-missed hook now silently removes that worker's line and its tokens from
`--watch`, because the orchestrator no longer writes the fallback event. Requirement 4 says
the spawn and token totals must not change. The design should state what a dropped hook event
does to the view (worker missing, tokens under-counted) rather than framing a missing hook as
purely benign. This bites hardest exactly when this spec ships: `CLAUDE.md` requires the plugin
to be reinstalled and sessions restarted after a `harness/` change, so there is a window where
the hook seam is not yet live.

### R1-3 — `orient`'s `D` rule omits the "exists, no Revision History ⇒ D = 1" branch (SHOULD_FIX)

Component 2: "`D` is the highest `v<n>` in the `<phase>.md` Revision History (0 when the file
is absent, matching 1.4)." The Step 0 that `orient` must reproduce (Requirement 1.1 cites
`sdd-document-phase/SKILL.md:56-77`) has a third case at `:59-60`: "If the document exists but
has no Revision History, D is 1." The design's rule returns `D: 0` (next step "draft v1",
Error Handling #1) for a document that exists without a history, where the skill returns `D: 1`.
Narrow in practice (drafters always write the v1 line), but `orient`'s whole contract is to
equal Step 0, and this case is not one of the seven fixtures (Requirement 1.7), so tests will
not surface the divergence. State the `D = 1` branch, or state explicitly that `orient` treats
a history-less existing document as `D = 0` and why that is acceptable.

### Minor notes (not loop-keeping)

- **M1 — range widening lost precision.** Component 6 / D3 cite `src/watch/ledger.ts:188-248`
  for "the spawn-pairing loop" and "an unmatched `spawn.end` is dropped." The loop is `:226-248`
  and the drop is `:241-242`; `188` is the `buildModel` signature. Not false (both are inside
  the range), but `:228-248` / `:241` were tighter. Cosmetic.
- **M2 — under-pinned shapes.** Close-out `orient` returns `byClass` (Data Models line 89)
  with no shape; the close-out Step 0 line needs the five buckets `none/store/harness/code/home`
  (`sdd-closeout-phase/SKILL.md:84`), and the `HARNESS_REPO: none ⇒ harness→to-do` adjustment
  (`:78`) is a launch-time value the server cannot see. The fold must coerce `Number(tokens)`
  (the event script writes all values as strings, `formats.md:178`) before `tokensTotal`
  (`src/watch/ledger.ts:273`) sums them; the design leaves the coercion and the fold's insertion
  point (before `:273` and before the ticker) implicit. Both are safe to settle in tasks.

## Top 3 risks/gaps

1. Prompt-launched workers (reviewer, checker, e2e/close-out verifier, close-out adjudicator)
   drop out of the spawn view and token total on the new path — R1-1.
2. The render contract now hinges on a best-effort, timeout-bounded hook with no
   orchestrator fallback, and the design calls a missing hook benign — R1-2.
3. `orient` is specified to *match* Step 0 but omits one of Step 0's `D` branches — R1-3.

## Top 3 conclusions to challenge or reverse

1. **"Nothing in the spawn or token totals `--watch` renders changes" (Overview).** Reverse
   as written: on the new path it is false for every prompt-launched worker. Either restore
   the invariant (fold synthesizes a node / widen hook detection) or downgrade the claim and
   name the spawns that stop rendering.
2. **D3 "the filename already names the role."** Challenge: it names the role only for
   `*-brief*` files; several worker launch prompts point at `adversarial-prompt-*`,
   `verify-e2e.md`, `closeout-verify-*`, `closeout-adjudication-*`. The premise does not cover
   the worker set.
3. **Error Handling #5 "a missing ledger never stops a run" as sufficient reliability.**
   Challenge: run-completion is not the render contract Requirement 4 pins; a dropped hook
   event now degrades the view silently.

## What's missing before acting on this document

- A stated rule for an unmatched `spawn.usage` (synthesize a node, or drop and accept the
  view change) and for prompt-launched workers, so Requirement 4.2 holds on the new path.
- An enumeration of "the five brief kinds" and the brief output-filename convention Component 5
  relies on, tied to how the hook detects "a brief path" and derives `role`.
- The `D = 1`-without-history branch in `orient`, or an explicit ruling that it is out of scope.
- `byClass`'s shape and where the `HARNESS_REPO` class adjustment happens.

VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 2
MINOR: 2
DESIGN_READY: no
ESCALATE: none
