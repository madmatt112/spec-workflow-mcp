# Adversarial Review — question-gates/tasks v2 (Round 2)

Second review of the tasks document. Primary attack surface: **atomicity, ordering, coverage**.
Fresh lens this round: **the cost of touching an existing component** — for every task that edits
an existing file, does it account for the tests, fixtures, plugin copies and skill/agent consumers
the change disturbs, and would its Success line catch a regression in them?

Delta under attack: the v2 Revision History records R1-1 (resume recheck added to task 6 + design
Component 5), R1-2 (unresolvable Revision-History paths un-fenced), R1-3 (task-2 task-parser range
corrected), and rejects R1-4/R1-5. Per the prompt, R1-1's resume-recheck wording was attacked hardest.

Every cited artifact below was read at both ends of every range.

## What I verified clean (show-the-work)

### The R1-1 resume recheck is real, consistent and implementable (attacked hardest)

- **Citation `harness/skills/sdd-continue/SKILL.md:122` is exact.** Line 122 is literally step 3
  rule 4: `4. Requirements missing or not approved ⇒ document phase **requirements**.` Task 6's
  Leverage (`:122`), body ("step 3 rule 4 re-checks the receipt before dispatching") and Prompt
  ("At step 3 rule 4 (`…:122`), before dispatching phase requirements") all name the correct line.
- **Three-document consistency holds.** Requirements Req 2 AC 7 second sentence (`requirements.md:39`:
  "WHEN step 3 (`…:122`) finds that receipt unanswered THEN … re-ask or fall to `record` … instead
  of re-spawning `MODE: normal` straight to round 1"), design v3-amended Component 5 "Resume recheck"
  (`design.md:75`) and task 6's Prompt/Success all state the same behaviour with the same citation.
  Design's Revision History carries the matching `v3 amended` line (`design.md:160`). R1-1 is
  **resolved**, not recurring.
- **The control flow is sound.** Gate A fires after requirements v1 (Step 1), before the review
  rounds, so on interruption `spec-status` reports requirements *not approved* → rule 4 fires →
  requirements dispatch. Without the recheck the orchestrator orients to Step 2 and never re-emits
  `gate-a` (Req 2 AC 3 / design Component 4), so round 1 would run on v1 unanswered. Inserting the
  recheck *before* the dispatch is the only point that catches it. The "receipt unanswered" guard
  correctly distinguishes the first-ever requirements run (no receipt), an interrupted gate A
  (receipt present, unanswered) and a resume after an answered gate A (receipt answered). `gate-a.json`
  is written by the drafter before the orchestrator returns `gate-a`, which is before the receipt,
  so the recheck's `gate get slot=a` always finds the triples present.

### The other two accepted deltas are accurate

- **R1-3 (task 2 Leverage range).** `parseTasksFromMarkdown` is defined at `src/core/task-parser.ts:153`
  and its body closes at `356`; `taskBlock` is at `365-385`. The corrected `153-356,365-385` resolves
  at both ends. (Aside, not a tasks finding: design Component 2 still cites the *old* `108-128` at
  `design.md:50` — that is the approved design's stale citation, out of scope here.)
- **R1-2 (Revision-History paths).** The current Revision History (tasks.md:87-99) carries no bare
  `file:line` citation; directory-only mentions (`harness/agents/`, `harness/skills/…/`) and the one
  qualified `…/SKILL.md:122` all resolve. The prompt confirms `citation-path` reported no open finding
  on v2. The "19 fixed" lint-green claim holds.

### Fresh lens: existing components the deltas touch

- **Task 2 (`src/tools/harness.ts`).** The Success claim "no existing assertion in that file changes
  (none pins the action enum or the unknown-action message)" is **true**: `harness.test.ts` only
  exercises `action: 'orient' | 'brief' | 'phase-log'`; no test asserts on the `enum` array (`harness.ts:41`)
  or the `default` "Unknown action" branch (`harness.ts:97-98`). No snapshot/schema test imports
  `harnessTool` anywhere in `src/`. Adding optional `op/slot/payload` under `additionalProperties: false`
  (`harness.ts:76`) is exactly what lets an MCP client pass them, and existing calls omit them, so no
  existing assertion breaks. Consumer coverage accounted for.
- **Task 3 (`formats.md` PHASE enum).** The only full PHASE-enum copies in `harness/` are `formats.md`
  (edited) and the supervisor dispatch loop in `sdd-continue/SKILL.md` (edited by task 6);
  `sdd-retrospective/SKILL.md` only *emits* `retro-ready`, it is not a full enum listing. The
  document-orchestrator carries no PHASE enum (confirms design D5). No vitest test reads `formats.md`.
  Task 3 misses no enum copy.
- **Task 4 (`sdd-drafter.md` frontmatter).** The drafter's `tools:` block (lines 7-13) holds no MCP
  tool today; the reviser grant it mirrors has exactly three forms
  (`mcp__spec-workflow__`, `mcp__plugin_spec-workflow-mcp_spec-workflow__`,
  `mcp__plugin_spec-workflow-mcp-with-dashboard_spec-workflow__`, `sdd-reviser.md:14-16`), so task 4's
  "three plugin-prefixed forms" is the right count. No vitest test asserts the drafter's tool list.
- **Tasks 3-6 do not affect the vitest suites.** No vitest test reads the real `harness/agents` or
  `harness/skills` prose; the harness tests use temp-dir fixtures. `sync-plugin-assets.cjs` copies
  `harness/{agents,skills,commands,hooks}` to each plugin root, and every harness/ task's Success line
  runs `sync-plugin-assets.cjs` + `check:plugin-assets` + `claude plugin validate . --strict`. The
  plugin-copy consumer is accounted for on each task.

### Closed rulings left closed

- L-7 (bridge-missing, warning) — rejection upheld by ruling; no new evidence, not re-raised.
- R1-4 (task 5 atomicity) and R1-5 ("external write" keyword) — rejected in v2; no new evidence.
- Ordering DAG, coverage matrix, D1/D5 — verified in round 1; the v2 delta adds no new dependency
  edge (the recheck consumes only task 2's `gate get` and task 6's own receipt).

## Topics attacked

### 1. Task 6 resume-recheck clause (`tasks.md:63,68`) — the R1-1 delta

- Challenged the citation `SKILL.md:122`: it is exactly step 3 rule 4 — accurate.
- Stress-tested the "receipt unanswered" guard against first-run / interrupted / answered-resume
  states: it distinguishes all three; no false re-ask, no silent skip.
- Traced whether the recheck belongs in the routing table vs the dispatch loop: Req 2 AC 7 pins it to
  step 3, and the interrupted orchestrator would never re-emit `gate-a`, so pre-dispatch is the only
  workable point. Consistent with design Component 5.

### 2. Task 2 "no existing assertion changes" claim (`tasks.md:31`)

- Stress-tested the enum/unknown-action claim against `harness.test.ts`: no test pins either; claim true.
- Probed for a hidden schema/snapshot consumer of `harnessTool`: none in `src/`.

### 3. Task 3 completeness of the PHASE-enum edit (`tasks.md:39`)

- Challenged "so no copy is missed": grep confirms only `formats.md` + `sdd-continue/SKILL.md` hold the
  full enum; the orchestrator wrapper holds none (D5). No missed copy.

### 4. Tasks 3-6 "prose changes … do not affect the vitest suites" (`tasks.md:7`)

- Challenged whether any test reads harness prose: none does; the claim and the plugin-sync Success
  lines cover the only real consumer (the `plugins/` copies).

## Findings

None at MUST_FIX or SHOULD_FIX. The v2 delta introduced no claim error, no contradiction and no
coverage regression; the fresh lens surfaced no unaccounted test, fixture or consumer.

Two non-blocking observations, deliberately **not** raised as findings (each would re-open a closed
ruling or belong to another document):

- Design Component 2 (`design.md:50`) still cites `parseTasksFromMarkdown` at the stale `108-128`
  that tasks R1-3 corrected in *this* document to `153-356`. That is a defect in the approved design,
  not the tasks doc; the tasks doc is now correct and an implementer using it is unaffected.
- The resume recheck keys off the best-effort `questions.md` receipt, so an interruption in the narrow
  window between the orchestrator returning `gate-a` and the receipt write leaves no signal to recheck.
  This is the receipt-based mechanism the *requirements* fixed in Req 2 AC 7 (R3-2, closed); the tasks
  doc faithfully implements it. Not re-opened.

## Closing deliverables

### Top risks/gaps to watch (none are blockers)

1. Cross-document citation drift: the design's stale `parseTasksFromMarkdown:108-128` now disagrees
   with the corrected tasks range — worth a design touch-up at the next design pass, not here.
2. Best-effort receipt window (above) — an accepted requirements property, not a tasks gap.
3. Task 5 remains the largest single task (gate A + gate B in one commit); rejected as R1-4 and not
   re-raised, but it is still the change most likely to hide a partial implementation in review.

### Top 3 conclusions — all hold, none to reverse

1. "Task 6 resolves an interrupted gate A at step 3 rule 4" — verified against Req 2 AC 7, design
   Component 5 and `SKILL.md:122`. Keep.
2. "No existing assertion in `harness.test.ts` changes" (task 2) — verified against the test file. Keep.
3. D1/D5 ordering and no-orchestrator-edit — re-confirmed against the tree; the delta adds no edge. Keep.

### What's missing before acting

Nothing blocks implementation. The one cross-document cleanup (design's stale task-parser range)
should be logged for the design's next revision but does not gate the tasks doc.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
