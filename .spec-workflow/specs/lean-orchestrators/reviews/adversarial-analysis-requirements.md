# Adversarial Analysis — lean-orchestrators/requirements (v1, round 1)

Primary attack surface: completeness, ambiguity, scope. Fresh lens: wire contracts
across the four boundaries the prompt names (orchestrator→worker brief, worker→orchestrator
fixed-shape report, `EVENT_SCRIPT` ledger rows, `harness usage` output shape).

## Deltas since the previous checkpoint

The diff from `d70b83c` touches only the Revision History: it adds the lint-pass
sub-bullet recording the rejection of L-1…L-5. Those rejections are closed rulings and
are not re-opened. I re-verified the meaning of each rejection and agree: `base`, `harness`,
`orient`, `implementation` are document-defined source/tool/action/phase names, not symbols
the citations claim. No substantive content changed, so the delta surface is empty; the
findings below come from the fresh lens over the whole of v1.

## What I verified in the codebase

- Baseline W reproduces exactly. Computing W = input + 1.25·cw5m + 2·cw1h + 0.1·read +
  5·output over the last `spawn.end` per `agentId` in
  `.spec-workflow/specs/tdd-task-loop/harness-events.jsonl` gives 4 document-orchestrator
  spawns = 4.50M W and 1 implementation-orchestrator spawn = 2.68M W — the document's
  numbers (line 13). `task.done` = 17 in the main implementation run. Accurate.
- Skill-structure claims in Req 3.1/3.2 are exact. Every heading of
  `harness/skills/sdd-document-phase/SKILL.md` and
  `harness/skills/sdd-implementation-phase/SKILL.md` is accounted for as keep-or-move.
- Citations spot-checked and correct: `sdd-activity.sh:68-98` (readUsage dedupes by
  message.id), `:135-142` (subagentTranscript derivation), `:220-236` (spawn.end keys,
  spawn.report), `usage.ts:365-367` (`(+N unknown)` cell), `harness.ts:41-43` ("reads only
  the spec store; it never spawns a process"), `harness.ts:490-491` (verbatim brief porting
  is a deferred follow-up), `sdd-continue/SKILL.md:291` (`20 tasks`), `:379-380` (runaway
  guard), impl `SKILL.md:252-267` (Budget fires only while open tasks remain), doc
  `SKILL.md:185-187` (reviewer re-spawn-once on a missing verdict file).
- Both baseline specs carry a `harness-activity.jsonl` with `session`+`agentId`; the Claude
  projects dir resolves to `~/.claude/projects/`.

## Findings

### R1-1 — Transcript-location contract is underspecified on the consumer (usage) side — SHOULD_FIX

Req 1.3 says the transcript "SHALL be located from the activity rows' `session` and
`agentId` ... as `<projects dir>/<any project>/<session>/subagents/agent-<agentId>.jsonl`,
the same derivation the hook uses (`harness/hooks/sdd-activity.sh:135-142`)." It is *not*
the same derivation, and three pieces of the contract are left undefined:

1. **`<projects dir>` is never defined.** The hook never computes it — it takes
   `path.dirname(transcript_path)` straight from the live hook payload (`:140-141`). The
   `usage` action has no payload; `usageAction` only has `workflowRoot` from
   `selectRoots` (`src/tools/harness.ts:1215-1217`). So the server must independently
   resolve `~/.claude/projects` (honouring `CLAUDE_CONFIG_DIR`/home overrides). The
   requirement states no rule for this, so the implementer guesses.
2. **`<any project>` is a new behaviour the hook does not have.** The hook knows the exact
   project directory; the usage action must *glob every project subdir* to find a matching
   `<session>/subagents/agent-<agentId>.jsonl`. This is load-bearing for Req 2.1's
   `trading-rules` baseline, whose transcripts live under a *different* project slug
   (`-home-mcf-repo-tradr-hosted`), not the one Req 2.3 names. The "same derivation the
   hook uses" wording hides this and the NFR Security line ("read only ... validated
   `session` and `agentId`", "read no other path") does not cover directory enumeration.
3. **`session` join is unspecified.** `spawn.end` rows carry `agentId` but **not**
   `session` (confirmed: sample row has no `session` key); `session` lives only in
   `harness-activity.jsonl` (`src/watch/ledger.ts:26-36`). So the breakdown must join
   events→activity by `agentId` to recover `session`. Req 1.7 handles "transcript missing
   or unreadable" but there is no failure path for "no activity row / `session` not
   resolvable" — a baseline copied without its activity file would fall through
   undefined behaviour rather than `sources unknown`.

Fix: define `<projects dir>` and its override; state the "scan all project dirs" rule and
bound it; add the events→activity `session` join and fold an unresolvable `session` into
the same `sources unknown` path as Req 1.7.

### R1-2 — Req 3.3/3.4 "no whole read of references/briefs.md" is under-scoped against the actual template set — SHOULD_FIX

Req 3.3 mandates that *"Every brief, prompt section and standing brief an orchestrator
writes SHALL come from `harness` `brief`"* and that *no* orchestrator reads
`references/briefs.md` whole. But `BRIEF_TEMPLATES` (`src/tools/harness.ts:493-544`) has
only six kinds — `drafter`, `reviser`, `adjudicator`, `verifier`, `implementer`,
`test-author`. The document-phase `references/briefs.md` contains eight brief/prompt
blocks: Drafter, Gate-A re-spawn, **Round section** (appended to the reviewer scaffold),
Reviser, **Lint brief**, Adjudication, **Narrow-check prompt**, and **Code graph block**.
The skills today still pull *fields* for these out of `references/briefs.md` and pass them
as `values` (doc `SKILL.md:93,179,214,253,305`; impl `SKILL.md:152,225,238,468`), and some
are written whole from `references/briefs.md` with no template at all (gate-A brief
`:159`, round section + code-graph `:176-179`, narrow-check `:301-305`).

Consequences the requirement does not resolve:
- The **kept** Step 2 (review round) and Lint step depend on the round section, code-graph
  block and lint-brief text from `references/briefs.md`. Removing the whole read without
  first creating those server templates breaks a kept step. The requirement enumerates
  only the two standing briefs (3.4) as new `brief` work and never names the round
  section, code-graph block, lint, gate-A or narrow-check templates, nor the missing
  `reviewer`/`checker` kinds from Req 5's role list — so the design/tasks phase is handed
  an unsized migration under a single untestable "every ... SHALL come from `harness`
  `brief`."
- Req 3.3's premise, "the server templates do not yet carry the fixed brief text," is
  imprecise: the templates do carry the fixed skeleton; what is deferred (per the cited
  comment `:490-491`) is porting the *verbatim field text*. The AC should be stated in
  those terms.

Fix: enumerate every brief/prompt kind that must become a `harness brief` template (incl.
round section, code-graph block, lint, gate-A, narrow-check, reviewer, checker) or
explicitly exclude the ones Req 3.1 instead moves to on-demand reference files, and make
the "no whole read" AC testable against that enumerated set.

### R1-3 — Batched bookkeeping has no partial-failure / idempotency contract — SHOULD_FIX

Req 6.1 collapses the task close — checkbox `[x]`, `task.done`, retro-log entry, HANDOFF
State row, spec-store commit — into *one* call, and the pick (checkbox `[-]`, `task.pick`,
HEAD capture) into one. Today these are independent, individually recoverable calls (impl
`SKILL.md:252-264`). Req 6.6 gives the *signal* ("exit non-zero naming the step that
failed; treat as today's failed step") but not the *state* after a half-applied batch: if
the script edits `[x]` and appends `task.done` but the commit fails, or the commit
succeeds but the retro-log append fails, the run is left in a state that does not map onto
"today's failed step" (today each was its own call). Re-running the batch could then
double-append a `task.done` row — which directly violates the single-row-per-event
expectation Req 6.5 relies on ("`--watch` and `harness usage` read the new run as they
read the baseline") and the ledger floor rule (`agent-rules.md:84-97`).

Fix: require the batch scripts to be idempotent (or checkpoint which steps completed) and
state the orchestrator's recovery for each partial-failure point, so a re-run cannot
produce duplicate ledger rows or a committed-but-unlogged task.

### R1-4 — Req 7 restart accounting: ambiguous guard input and an unaccounted extra spawn — SHOULD_FIX

Two gaps in the lifetime changes:

1. **Runaway guard input is ambiguous (7.3).** "the larger of 12 and ceil(open tasks /
   BUDGET) + 4 spawns" does not say *when* "open tasks" is read. The current guard counts
   spawns across the whole run (`sdd-continue/SKILL.md:379-380`). If "open tasks" is
   re-evaluated per check it shrinks as tasks close, so the allowance drops mid-phase and
   the guard can trip spuriously (phase aborts as `error`); if it is read once at phase
   start it is stable. Pin the evaluation point.
2. **Req 7.5 adds a restart that gate-A accounting (D1) does not name.** Today Budget does
   not fire when the budget-filling task is also the last open task — the same spawn runs
   the completion gate (impl `SKILL.md:265-267`). Req 7.5 makes that boundary report
   `PHASE: resume` → a fresh spawn runs *only* the completion gate: a net extra orchestrator
   restart in that case. The Alignment section (line 9) says "every cut that adds
   orchestrator restarts is a recorded decision for gate A," and D1 records only "about
   three restarts" for the 5-task budget; it does not mention this conditional extra spawn.
   Record it, or justify why it is free.

### R1-5 — Scenario-1 verification depends on ephemeral real transcripts — MINOR

Req 1.6 (decomposition scenario 1) requires running the breakdown on the *real*
`tdd-task-loop` transcripts and matching W within 1%. Those transcripts date 2026-09-27/28;
Req 2.3 states transcripts age out (oldest kept was 2026-09-13 on 2026-10-02), and Req 2.3
only speaks of the swm project dir, not the `tradr-hosted` dir that holds the
`trading-rules` transcripts. If implementation lands weeks later the scenario-1 inputs may
be gone. Req 2.1 already captures `baseline-sources.md` as the first impl task after Req 1;
align the scenario-1 evidence capture with that same early point (or snapshot the
transcripts) so the AC stays verifiable.

### R1-6 — Req 7.1 "today 20" is stated in more places than the one cited — MINOR

Req 7.1 cites only `sdd-continue/SKILL.md:291`, but the number 20 (and a rationale that
assumes it) also appears at impl `SKILL.md:16` and `:17-20` ("The 20-task budget assumes
the reduced orchestrator context this harness produces..."). Changing 20→5 there is not a
digit swap — the rationale contradicts Req 7's premise that the context still grows too
much, so it must be rewritten. The `agent-rules.md:63-69` count-grep rule covers this at
tasks phase, but the requirement should flag that the rationale text changes too.

### R1-7 — Req 3.5 constrains only the document orchestrator's cleanup.md reads — MINOR

Req 3.5 limits *the document orchestrator* to reading `references/cleanup.md` in Step 6
and the first commit-script step. But the **implementation** orchestrator also reads the
document-phase `references/cleanup.md` — for `spec-edit.mjs` and the spec-store commit
script (impl `SKILL.md:51-58`). Req 6 moves the close/pick into per-run batch scripts,
which overlaps that usage. The requirement does not say whether the impl orchestrator's
cleanup.md reads survive, are replaced by the Req 6 scripts, or are newly constrained.
Resolve the overlap.

## Top 5 risks / gaps

1. The `harness usage` → transcript read has no defined projects-dir resolution, project
   scan, or events→activity `session` join (R1-1) — the central new mechanism is not
   wireable as written.
2. "No whole read of `references/briefs.md` / every brief from `harness brief`" is a large,
   un-enumerated template migration that can break kept steps (R1-2).
3. Batched bookkeeping trades per-call recoverability for a partial-failure state with no
   idempotency contract, risking duplicate ledger rows (R1-3).
4. Restart accounting (guard input + 7.5 extra spawn) is ambiguous and partly outside the
   gate-A record the Alignment section demands (R1-4).
5. The headline acceptance test (scenario 1) hangs on transcripts that the spec itself says
   disappear (R1-5).

## Top 3 conclusions to challenge

1. **"the same derivation the hook uses" (Req 1.3).** Reverse: it is a materially
   *different* derivation on the read side (no payload, a projects-dir scan, a `session`
   join). Treating them as identical is why `<projects dir>` and the `session` join went
   unspecified.
2. **"the server templates do not yet carry the fixed brief text" (Req 3.3).** Challenge:
   six templates already carry the skeleton; the real work is porting verbatim field text
   *and* creating templates that do not exist yet (round section, code-graph, lint,
   gate-A, narrow-check). The AC understates the scope.
3. **D1's wall-clock story ("about three restarts ... stays within the wall-clock rule").**
   Challenge: Req 7.5 adds a conditional completion-gate-only spawn and the 5-task budget's
   restart count varies with task count; the single "three restarts" figure does not bound
   the worst case the gate-A rule is meant to catch.

## What's missing before acting on this document

- A consumer-side spec for transcript location: projects-dir source + override, the
  all-projects scan rule, the events→activity `session` join, and a failure path for an
  absent activity row (fold into Req 1.7's `sources unknown`).
- An enumerated list of which `references/briefs.md` blocks become `harness brief`
  templates vs. move to on-demand reference files, so Req 3.3's "no whole read" is testable.
- Idempotency / partial-failure recovery rules for the Req 6 batch scripts.
- A pinned evaluation point for the runaway-guard "open tasks" input, and a gate-A record
  for the Req 7.5 extra spawn.
- An early, transcript-independent capture of the scenario-1 evidence.

ESCALATE: none. The new transcript read is scoped by validated `session`/`agentId` and a
fixed projects dir; no secrets, auth, money or destructive action is involved.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 4
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
