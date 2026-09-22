# Adversarial Analysis — provider-per-role/tasks (v2), round 2

Primary attack surface: atomicity, ordering, coverage. Fresh lens: the cost of touching
an existing component — every task that edits `src/watch/*` or names an existing test
file, checked against the exact values those suites assert and the ordering that keeps
them green. Deltas attacked first (R1-1..R1-4 fixes + the v2 lint commit).

## What I checked and how

- Re-verified every citation the v2 delta introduced or the lint commit rewrote:
  - `.spec-workflow/specs/provider-per-role/design.md:113-121` — the nine `SDD_*` exports
    task 1 now names, in order. **Correct** (body 113, event-script 114, spec-dir 115,
    run 116, spec 117, code-root 118, store-repo 119, harness-repo 120, providers 121).
  - `.spec-workflow/spec-decomposition/decomposition.md:344,346,383-384` — 344/346 are the
    superseded launcher `--model`/`ANTHROPIC_MODEL` bullets (in **Delivers**), 383-384 the
    superseded scenario (4). Lines exist and read as claimed (see R2-3 on which the step-8
    verifier actually reads).
  - `harness/skills/sdd-implementation-phase/SKILL.md:84-99` (per-task loop, step 2 spawns
    `sdd-implementer` unconditionally), `:107-109` (verification-only: no gate, skip step
    4, spawn no verifier, checks fold to step 8), `:201-209` (deferred verification half).
    All accurate.
  - `harness/agents/sdd-implementer.md:15-20` — the `deferrals` tool **is** declared (18-20).
    But see R2-1: lines 35 and the standing brief forbid using it.
- Fresh lens on tasks 7/8: read `src/watch/usage.ts:253-298`, `usage.test.ts:222-283`,
  `harness.test.ts:515-534`, `render.test.ts:118-135`, and the codebase-context ranges for
  ledger/render. Confirmed the "one rewritten assertion / no numeric value" claims hold.
- Traced the deferral-writing path across `sdd-implementer.md`, `briefs.md:5-51`,
  `sdd-implementation-orchestrator.md:9-17`, and the step-8 gate.

## Findings

### R2-1 (MUST_FIX, fix-induced, Recurring/Compounds R1-2) — Task 10's implementer is barred from `deferrals`, so the R1-2 fix has no writer

The v2 response to R1-2 replaced the unrouted `VERIFY:`/deferred-report line with a new
mechanism: task 10's own implementer files the deferrals directly. D5 (`tasks.md:108`):
"the supervisor/orchestrator halves it cannot exercise this run are filed with the
`deferrals` tool that implementer already has (`sdd-implementer.md:15-20`)"; task 10's
prompt (`tasks.md:100`): "call `deferrals` `add` yourself for each … and name each
record's id in the report."

That mechanism cannot fire. The `sdd-implementer` agent's standing rules forbid it in two
places the agent reads and obeys:
- `harness/agents/sdd-implementer.md:35` — "Never touch `tasks.md`, approvals,
  **deferrals**, HANDOFF or INDEX."
- `harness/skills/sdd-implementation-phase/references/briefs.md:49` (the standing brief the
  implementer is told to "read and obey" first) — "Do not touch `tasks.md`, approvals,
  **deferrals**, HANDOFF or INDEX."

D5 cites only the tool declaration (`:15-20`) and missed the prohibition. So an implementer
obeying its own rules will not call `deferrals add`; the "supervisor/orchestrator halves
are filed" claim (`tasks.md:118`, D5) has no valid executor, and task 10's Success line
("name each `deferrals` record's id this task added") is unsatisfiable. There is no
fallback writer: the implementation orchestrator's tool list
(`harness/agents/sdd-implementation-orchestrator.md:9-17` — Read, Grep, Glob, Bash, Edit,
Write, Agent, TodoWrite) does **not** include `deferrals`. This is exactly the R1-2 gap
(the deferral has no writer) re-created by the fix that claimed to close it — hence
Recurring, escalated to MUST_FIX. Fix: either have task 10 report `AFFECTS-FUTURE-SPECS:`
/ a flag the orchestrator routes into a deferral (the existing deferral-bar path), or carve
an explicit, task-scoped exception into the implementer instructions for this one
verification task — and reconcile it with the `outcome=gate` marking a `File: none` task
receives at step 8.

### R2-2 (SHOULD_FIX, Compounds R1-1) — `RETRO: escalation` is not a category the implementer is told it may use

The v2 R1-1 fix rests the current-run safety on a visible record: "a human reading the
retro entry decides whether to continue" (`tasks.md:7`), the retro entry being the
`RETRO: escalation` line task 1 emits on a failed (a) or unset key. But the implementer's
authoritative category list — `harness/skills/sdd-implementation-phase/references/briefs.md:43-45`
— is "gotcha, bug, tool-error, mcp-deficiency, harness-defect, misunderstanding,
inefficiency, doc-gap, model-behaviour"; `escalation` is **absent**. `escalation` is only a
`retro.sh`/supervisor category (`formats.md:119-121`), not one the implementer's brief
authorises. An implementer treating its brief's list as closed may drop or substitute the
category, and the human-visible retro entry the R1-1 fix depends on may not be written as
stated. (Task 10's parallel `RETRO: bug` is fine — `bug` is in the list.) This is carried
text, but the v2 R1-1 fix newly makes the whole no-automatic-halt safety argument lean on
it. Fix: add `escalation` to the implementer brief's category list, or have task 1 report
under a listed category.

### R2-3 (MINOR, Compounds R1-2) — the Scope note overstates what the step-8 verifier reads

`tasks.md:119` (new v2 Scope note) and D5 say the step-8 verifier "greps the decomposition
entry for its Scenario section and reads the superseded wording at
`decomposition.md:344,346,383-384`." The step-8 gate takes only the *verification scenario*
(`SKILL.md:190-197`: "take its verification scenario") = decomposition `**End-to-end
verification.**` at lines 377-387. That range contains 383-384 (superseded scenario 4) but
**not** 344/346, which live in the **Delivers** section (lines 341-350) the verifier never
reads into its brief. The accepted disposition is unchanged (this stays closed by the
requirements ruling); only the citation is imprecise. Trim 344/346 from the "reads"
clause, or split the sentence so 344/346 describe the entry, not what the verifier reads.

## Attack on the deltas (dispositions verified)

- **R1-1 fix — sound.** The Dependency-order paragraph and the Scope note now state the
  human-mediated stop honestly (no automatic halt this run; no later task checks task 1's
  outcome). The one crack is the category name the record uses — R2-2.
- **R1-2 fix — the reword is clean but the new mechanism is broken (R2-1).** D5's false
  "verifier brief carries the corrected outcomes" premise is gone, and the doc now openly
  concedes the step-8 verifier greps the superseded wording (accepted by ruling). But the
  substitute writer for the deferrals cannot execute — the fix did not land.
- **R1-3 fix — sound.** New Scope note (`:120`) names Req 3.5 / 4.1 / 4.5 as
  restriction-carried negative constraints with the enforcing tasks. Accurate.
- **R1-4 fix — sound.** Task 1 now names all nine `SDD_*` exports; matches
  `design.md:113-121` exactly.
- **v2 lint commit** — the four bare-path corrections (`design.md`, three `SKILL.md`,
  `decomposition.md`) all resolve to real files/ranges. No citation regressed.

## Fresh lens — cost of touching existing components (tasks 7, 8): clean

- **Task 7 (`usage.ts`).** Adding `providers` to `UsageReport`/`UsagePhase` breaks exactly
  one full-object assertion — the empty-report `toEqual` at `usage.test.ts:263-267` — which
  the task rewrites. The one-spec (`:222-241`) and two-spec (`:243-261`) suites are all
  `toContain` substrings that survive the appended `  anthropic N  deepseek N` (placed
  after the delta text per D3/R2-1); the fixture case (`:270-283`) uses property/`toContain`
  checks, so `4_554_189`, `orch 60.2%` and the new `providers` assertions coexist. The
  `harness.test.ts:519-530` case reads `data.report.total.*` (not `toEqual`), so the added
  provider case is additive. Claim holds.
- **Task 8 (`ledger.ts`, `render.ts`).** The fixture and review-gate ledgers carry no
  `provider`, so `tokensByProvider.anthropic == tokensTotal` and `.deepseek == 0`: the
  header prints `tokens 1.6M` / `tokens 6.3M` with no `deepseek` suffix, and the tier line
  prints `actual <model>`. `render.test.ts:42-62,122-132`, `ledger.test.ts:251-273` and
  `index.test.ts:82-94` pass unedited. Claim holds.
- **Ordering.** Task 7 reads `provider` off ledger rows, not off task 8's `SpawnNode`, so
  7→8 has no hidden edge; both suites stay green at each step.

## Top risks / gaps

1. R2-1 — the deferral-filing mechanism the R1-2 fix introduced has no permitted executor;
   task 10's Success criterion is unsatisfiable as written.
2. R2-2 — the R1-1 safety record depends on a RETRO category the implementer brief does not
   list.
3. R2-3 — a citation in the new Scope note overstates the verifier's read set.

## Top 3 conclusions to challenge

1. **D5: task 10's halves "are filed with the `deferrals` tool that implementer already
   has."** Reverse: the implementer is explicitly barred from touching deferrals
   (`sdd-implementer.md:35`, `briefs.md:49`), and no orchestrator in the implementation
   phase holds the tool. (R2-1)
2. **`tasks.md:7`: a failed (a)/unset key is carried by "the retro entry" a human reads.**
   Challenge: the entry's category (`escalation`) is not one the implementer's brief
   authorises, so the record may not be written as stated. (R2-2)
3. **`tasks.md:119`: the step-8 verifier "reads the superseded wording at 344,346,…".**
   Challenge: the verifier reads only the verification scenario (377-387); 344/346 are not
   in it. (R2-3)

## What is missing before acting

- A permitted writer for task 10's `verification` deferrals: route through the existing
  deferral-bar flag the orchestrator already handles, or an explicit task-scoped exception
  to the implementer's "never touch deferrals" rule — plus reconciliation with the
  `outcome=gate` marking a `File: none` task actually receives.
- Alignment of the implementer's RETRO category list with the `escalation` category task 1
  emits (or a listed category in task 1).

## Gate B / Gate C

No task introduces a new external dependency (the DeepSeek vendor path is approved; no new
npm package). No `[gate-b:T…]`. No task exceeds the approved requirements — task 10's
self-filed deferrals are an implementation of Req 7 verification, not new scope (the defect
is that the chosen executor cannot do it, R2-1, not that it does more than asked). No
`[gate-c:T…]`.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
