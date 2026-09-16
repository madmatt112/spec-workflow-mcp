# Adversarial Analysis — harness-bookkeeping/requirements (v1, round 1)

First review. Primary surface: completeness, ambiguity, scope. Fresh lens: the wire
contracts that cross the plugin/server boundary — `harness orient`/`brief` inputs and
outputs, the `spawn.start`/`spawn.end` events the hooks write, the usage event the
orchestrator writes, and the ledger JSONL the `--watch` renderer and the phase-log
renderer read.

## What I checked and how

- Read the whole document, the decomposition entry 6 with `## Build order`,
  `## Boundary notes` and `## Open question deferred to spec 2`, `codebase-context.md`
  and `agent-rules.md`.
- Read in full, both ends of every load-bearing range: `src/watch/ledger.ts` (1-345),
  `src/watch/render.ts:62-211`, `harness/hooks/sdd-activity.sh` (1-69),
  `harness/hooks/hooks.json`, `harness/skills/sdd-continue/SKILL.md` (1-272),
  `harness/skills/sdd-continue/references/formats.md` (1-199),
  `harness/skills/sdd-document-phase/SKILL.md:1-90`, `.../references/briefs.md:1-60`,
  `harness/skills/sdd-implementation-phase/SKILL.md:44-93`,
  `harness/skills/sdd-closeout-phase/SKILL.md:1-90`, `src/tools/spec-status.ts:60-114`,
  `src/tools/spec-index.ts:60-131`, `src/tools/spec-lint.ts:20-69`,
  `src/core/task-parser.ts:150-179`, `docs/step-0-answers.md`.
- Re-verified the citations the v1 lint commit touched (the `## Changes since` diff): the
  lint pass only reworded prose (unbackticked `harness-events.jsonl`, "orient and brief
  actions", "the harness tool"); no citation target moved. `SKILL.md:56-77`,
  `ledger.ts:188-338`, `spec-index.ts:75-89`, `index-generator.ts:44-72`,
  `formats.md:52-67`, `spec-lint.ts:26-40`, `task-parser.ts:153-356`,
  `spec-status.ts:69-79`, `approval-records.ts:19-77` all resolve and mean what the
  sentences claim.

Most citations are accurate. The findings below are contract gaps and one internal
contradiction, not bad paths.

## Findings

### R1-1 — MUST_FIX — Hook-written spawn events cannot carry the `role` and `result` the "same spawn view" promises

Requirement 3.1 puts `spawn.start` on the `PreToolUse` hook with "role ... derived from
the brief filename"; 3.2 puts `spawn.end` on `SubagentStop`; 3.3 removes both from the
orchestrator. Requirement 4 (user story and AC 4.2) then promises `--watch` shows "the
same phases, spawns and token totals" and "the same spawn view." These cannot both hold.

- The role strings the orchestrator writes today carry a version, round or batch that is
  not in any brief filename: `formats.md:191` lists `review v3`, `fix ci e2e round 1`,
  `implement harness batch 1`; `sdd-closeout-phase/SKILL.md:44-46` adds
  `verify <class> batch <b>`, `fix <class> batch <b> round <r>`. A brief file named
  `reviews/adversarial-prompt-requirements.md` or `impl-brief-task-13.md` carries no
  version and no round, so a filename-derived role degrades to something coarser than
  today's.
- `SubagentStop` carries no structured result. `docs/step-0-answers.md` answer 2 lists
  the payload fields (`agent_type`, `agent_id`, `cwd`, `last_assistant_message`,
  `stop_reason`, ...) — there is no `tool_input` and no report. Today `spawn.end` carries
  `result` = the VERDICT / VERIFY / logged line / PHASE value (`formats.md:192`,
  `sdd-continue/SKILL.md:181`). A hook cannot reproduce it.
- Both fields are shown in the view. `render.ts:203` renders `s.role`; `render.ts:207-208`
  renders `-> <result>` for a finished worker; `render.ts:184` derives the pass/fail mark
  from `s.result` (`/fail|fix-required|error|escalate/i`). Drop `result` and a
  fix-required reviewer renders `+` (ok) instead of `x`. `ledger.ts:301` puts both in the
  ticker.

So the new path produces a materially different spawn view, contradicting 4.2. The
document must decide where `role` (with version/round/batch) and `result` come from —
most likely the orchestrator's usage event must carry them, which then narrows the
"orchestrator only routes" claim in the Introduction and must be stated.

### R1-2 — SHOULD_FIX — The target file, the usage-event shape and the spawn↔usage join key are all unspecified

The central mechanism of Requirements 3 and 4 has no wire contract.

- **Which file does the hook append `spawn.start`/`spawn.end` to?** The hook writes
  `harness-activity.jsonl` today (`sdd-activity.sh:28`). But `buildModel` reads spawns
  only from the ledger `runEvents` (`ledger.ts:228`), and 4.1 states the old-format spawn
  events live "in the harness-events.jsonl file." The two files have incompatible shapes:
  `ActivityEvent` (`ledger.ts:22-32`) has `event: 'tool'|'agent.start'|'agent.stop'` and
  no `type`, `role`, `phase`, `task` or `round`; `LedgerEvent` (`ledger.ts:14-20`) has
  `type` plus arbitrary string keys. A `spawn.start` only fits the ledger shape. The
  document never says the hook writes to `harness-events.jsonl`, and if it does, the
  concurrent-write relationship with the orchestrator's own event-script appends to the
  same file is unstated.
- **The usage event is undefined.** 3.5 and 4.2 introduce "one usage event per spawn"
  the renderer must "sum ... per spawn," but the event's `type`, its keys and its join
  key to a spawn are not given. `buildModel` has no branch for a usage event today; tokens
  come from `spawn.end` (`ledger.ts:245`) or a windowed `agent.stop` (`ledger.ts:265`).
  The serial one-worker-at-a-time execution model (`sdd-implementation-phase` per-task
  loop; `sdd-closeout-phase/SKILL.md:24` "One worker at a time") makes an agent+time-window
  join workable, but the document should say so; without a stated key, 3.5/4.2 are not
  testable.

### R1-3 — SHOULD_FIX — Supervisor→orchestrator (level-1) spawn events are neither moved nor kept

`formats.md:198-199`: "The supervisor also writes `spawn.start`/`spawn.end` for each
orchestrator it spawns." Requirement 3.3 removes the writes from the *orchestrator* only
and is silent on the *supervisor*. The hook cannot cover the gap: 3.1 fires only when the
Agent prompt "carries a brief path," and orchestrators are launched with the routing
prompt of `sdd-continue/SKILL.md:157-178` (`SPEC`/`PHASE`/roots), not a brief file. So
level-1 spawns (`SpawnNode.level` 1, `ledger.ts:76-77`, rendered specially at
`render.ts:108-114`) would vanish unless the supervisor keeps hand-writing them. The
document must state that the supervisor's orchestrator spawn events are unchanged (or say
how the hook produces them). As written, whoever implements this can reasonably delete
them.

### R1-4 — SHOULD_FIX — Ledger-rendered phase log drops the `interrupted` row and never states write-vs-return

Requirement 5.2 stops the supervisor hand-writing phase-log rows and explicitly targets
`sdd-continue/SKILL.md:139-143` — which is the *interrupted-row* path: "When its State
row is ahead of the `## Phase log` table ... write the missing phase-log row with Result
`interrupted`." But phase rows are built from `phase.end` events (`ledger.ts:209-211`), and
an interrupted phase has a `phase.start` with no `phase.end`. So a run that advances tasks
and dies mid-phase produces no ledger row, and 5.2 removes the only code that wrote the
`interrupted` row — a regression the document does not acknowledge. 5.3's "rendering SHALL
start at the first `phase.start`" also mis-describes the source (rows come from
`phase.end`, not `phase.start`).

Separately, Requirement 5 never says whether the renderer *writes* `HANDOFF.md` (the way
`spec-index` writes INDEX, its own analogy) or *returns* rows for the supervisor to write,
nor how it preserves the routing header (`formats.md:69-78`) and the orchestrator-owned
`## <spec> — <stage>` sections (`formats.md:80-81`) that share the file, nor how it decides
which existing hand-written rows are "before the ledger existed" (5.3) versus rows it
should regenerate.

### R1-5 — SHOULD_FIX — The close-out budget in 6.1 contradicts its cited source

Requirement 6.1: "THE close-out skill budget SHALL cover all items of a class in one
spawn (`harness/skills/sdd-closeout-phase/SKILL.md:16-17`)." The cited line reads
"`all items`: one spawn works every open item of **every** class." Per-class and
all-classes are different budgets, and one worker cannot land every class in one spawn:
`store` commits to `SPEC_STORE_REPO`, `harness` to `HARNESS_REPO`, `code` opens a PR on
`MAIN_CHECKOUT`, `home` edits `~/.claude` (`SKILL.md:68-74`), and the spawn roles are
per-class-and-batch (`SKILL.md:44` `implement <class> batch <b>`). So the requirement
text, its citation and the skill's own batch model describe three different things. Design
cannot pick a budget from this.

### R1-6 — SHOULD_FIX — `orient` cannot reproduce Step 0's first branch because its inputs omit `MODE`

Requirement 1.1 says `orient` is "called for a document phase ... with a spec name" and
returns "the next step, matching the decision the document Step 0 makes." The document
Step 0 decision is `sdd-document-phase/SKILL.md:65-75`, and its first, highest-priority
branch is "`MODE: revision` ⇒ Step R." `orient`'s stated inputs are spec name + phase —
no `MODE` — so it cannot return the revision-mode next step, and none of AC 1.7's five
fixtures exercises revision, so the doc's own tests would not catch it. Either add `MODE`
to the `orient` input contract or scope 1.1 to normal mode and state that the orchestrator
overlays revision itself.

### R1-7 — MINOR — "20 tasks in one spawn" (6.1) is ambiguous

The implementation orchestrator spawns one implementer per task (per-task loop). "Cover 20
tasks in one spawn" reads as one worker doing 20; the intent is the orchestrator's budget
before it reports `resume`. Reword to name the orchestrator invocation.

### R1-8 — MINOR — Parser block (2.2) differs from today's hand-extracted block

2.2 requires the brief's task block to equal the parser's block byte for byte
(`task-parser.ts:153-356`), whose block "runs to the next checkbox index"
(`task-parser.ts:173-176`). The current implementer skill extracts "every line ... to the
next task line **or heading**" (`sdd-implementation-phase/SKILL.md:86-87`). A `##` heading
between tasks would be included by the parser but excluded today. Self-consistent with the
verification, but a behavioural change worth a one-line note in scope.

## Top 5 risks / gaps

1. The "same spawn view" promise (R4.2) is not deliverable from hook-written events that
   lose `role` fidelity and `result` entirely (R1-1).
2. No stated file, event shape or join key for the hook spawn events and the orchestrator
   usage event — the spec's core mechanism (R1-2).
3. Level-1 orchestrator spawn events fall in the gap between "orchestrator stops writing"
   and "hook only fires on brief paths" (R1-3).
4. The `interrupted` phase-log row is silently lost when the supervisor stops hand-writing
   rows and the ledger has only `phase.end` (R1-4).
5. The close-out budget requirement contradicts its own citation and the skill's batch
   model (R1-5).

## Top 3 conclusions to challenge or reverse

1. **"The watch renderer merges the two files as it does today" (decomposition) / 4.2
   "same spawn view."** Reverse the assumption that today's renderer is unchanged. Moving
   spawn events to hooks strips `role` and `result` (R1-1) and changes which file spawns
   are read from (R1-2); `buildModel` and `agentLines` need real changes, and 4.2 as
   phrased is unachievable. State the renderer changes as requirements, not as invariants.
2. **"The orchestrator only routes" (Introduction).** Challenge it. To keep the spawn view
   whole the orchestrator must still emit `role`, `result` and `tokens` per spawn in its
   usage event (R1-1, R1-2). That is most of the per-spawn bookkeeping it does today, so
   the context saving is smaller than the Introduction claims; say what is actually moved.
3. **"Everything else the entry lists ... is in scope above" (Scope notes).** The
   supervisor's orchestrator spawn writes (R1-3) and the `interrupted` row (R1-4) are
   listed by neither the entry nor the requirements, yet both are load-bearing for the
   `--watch` and HANDOFF outputs the entry names. Coverage is not as complete as claimed.

## What's missing — do before design

- A wire-contract table for the new events: for `spawn.start`, `spawn.end` and the usage
  event, name the file, the JSON keys, who writes each, and the key that joins a usage
  event to its spawn.
- A ruling on `role`/`result` fidelity: either the orchestrator's usage event carries
  them (and the Introduction is corrected) or the view degrades (and 4.2 is rewritten).
- The supervisor's disposition: does it keep writing orchestrator `spawn.start`/`spawn.end`,
  or does the hook produce them from the routing prompt?
- The phase-log renderer's contract: writes vs returns; interrupted-phase handling;
  header/section preservation; the rule that separates pre-ledger hand rows from
  ledger-covered rows.
- `orient`'s full input list against every Step 0 branch it claims to reproduce (`MODE`,
  and confirm approval-state inputs for implementation/close-out).
- The intended close-out budget (per class, all classes, or batched) reconciled with
  `SKILL.md:16-17` and `:44`.

VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 5
MINOR: 2
DESIGN_READY: no
ESCALATE: none
