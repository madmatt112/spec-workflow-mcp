# Adversarial Analysis — harness-bookkeeping/tasks (v2)

Round 2. Primary attack surface: atomicity, ordering, coverage.
Fresh lens: the cost of touching an existing component (its tests, fixtures, callers).

## What I checked and how

Attacked the v2 deltas first (Revision History v2: R1-1 partial, R1-2, R1-3, Lint pass),
then applied the fresh lens to every task that edits existing code.

- Re-verified the one citation the v2 lint commit changed
  (`harness/skills/sdd-continue/SKILL.md:180-199`, the L-25 bare→full-path fix): the range
  spans the orchestrator `spawn.start`/`spawn.end` (`:180-183`) **and** the `PHASE:`-result
  handling that writes one HANDOFF phase row per result (`:185-199`). Range is real; label
  is imprecise (see R2-1).
- R1-1 partial fix (task 3 "registering each under a stable `template` name that task 7's
  `brief` calls pass verbatim"; Scope note reword): the producer/consumer name contract is
  now pinned and checked by task 7's grep done-condition ("list task 3's template names and
  grep each `brief` call against them"). The five-vs-seven reconciliation stays rejected with
  recorded reasoning (design Component 5 = hook-detection axis; D2 = template set). No new
  evidence to reopen it — the grep now makes a name mismatch fail loud at task-7 time rather
  than at runtime. Accepted as adequate.
- R1-3 fix (intro reword): "tasks 5 and 6 are build-independent — task 6 handles the events
  task 5 writes" is accurate; the compile/suite claim is now correctly scoped away from
  tasks 7 and 8. Clean.
- Fresh lens, each existing-code task:
  - Task 1 (`src/core/task-parser.ts` + `task-parser-progress.test.ts`): additive export;
    "do not change `parseTasksFromMarkdown`/`parseTaskProgress`", "leave its existing
    assertions unchanged". Well-guarded.
  - Task 2 (`src/tools/index.ts` registry): verified the array holds 13 tools today
    (`index.ts:18-31`) and the switch 13 cases (`:40-82`); no test asserts `registerTools()`
    length or the tool set (`registerTools` is consumed only at `src/server.ts:112`, `:265`);
    no check enforces the `docs/TOOLS-REFERENCE.md` "13 tools" word against the registry
    (`package.json` has only `check:plugin-version`/`check:plugin-assets`). So task 2
    registering the 14th tool before task 8 updates the doc breaks no suite — the "every
    existing suite green at that step" claim holds, and 13→14 is right.
  - Task 5 (`harness/hooks/sdd-activity.sh`): no existing test references the script,
    `PreToolUse`, or `SubagentStop` (grepped `src`/`test`); "keep the existing activity
    writes intact" cannot regress an existing suite.
  - Task 6 (`src/watch/ledger.ts`/`render.ts` + tests): the new `spawn.usage` fold and the
    ticker branch on the `:300-308` ternary are purely additive; old ledgers carry no
    `spawn.usage`, so the new pass folds nothing and `tokensTotal`/render are unchanged
    (4.1). "New cases only, alter no value existing tests assert" holds.
  - Task 7 (skills): no existing suite covers skill content; verified by
    `check:plugin-assets` + `plugin validate --strict` + the new grep done-conditions.
    This is where the fresh lens and the coverage lens meet R2-1.

Deltas carry no wrong path, range, signature or behaviour in changed code lines. The one
substantive problem is a coverage miss the v2 delta entrenched.

## Findings

### R2-1 — SHOULD_FIX — Compounding (Compounds: R1-2) — Task 7 covers only half of Requirement 5.2: it never retires the supervisor's per-result phase-row writes at `SKILL.md:187-193`

Task 7 lists Requirement 5.2 in its `_Requirements` line and its prompt says:

> "In sdd-continue stop hand-writing `## Phase log` rows
> (`harness/skills/sdd-continue/SKILL.md:139-143`) and call the `phase-log` action, keeping
> the supervisor's orchestrator `spawn.start`/`spawn.end`
> (`harness/skills/sdd-continue/SKILL.md:180-199`)."

But Requirement 5.2 is explicit that the supervisor hand-writes phase-log rows in **two**
places: "THE supervisor skill SHALL no longer hand-write phase-log rows
(`harness/skills/sdd-continue/SKILL.md:139-143`, `:187-193`)." Design Component 7 agrees:
line 73 groups both ranges under "stops hand-writing phase-log rows … keeping the
supervisor's orchestrator `spawn.start`/`spawn.end` (`SKILL.md:139-143`, `:180-199`)."

`SKILL.md:187-193` is the dispatch loop's per-`PHASE:`-result path — the normal-operation
writer:
- `:187` "`approved` or `complete`: write one HANDOFF phase row."
- `:189-191` "`closed`: write one HANDOFF phase row (`closeout`, `items <n>/<n>`, `closed`)."
- `:193` "`resume`: write a HANDOFF row …"

Per `codebase-context.md` and `formats.md:52-67`, a "HANDOFF phase row" **is** a
`## Phase log` table row. So `:187-193` is the primary path that populates the phase log in
every normal run; `:139-143` is only the rarer interrupted-recovery write.

Task 7, as written, tells a prompt-only implementer to (a) replace `:139-143` with a
`phase-log` call and (b) **keep `:180-199` wholesale** — and `:187-193` sits inside
`:180-199`. The grep done-condition checks only `:139-143`
("a `harness phase-log` call replaces the hand-written `## Phase log` row
(`SKILL.md:139-143`)"). So a subagent executing task 7 literally leaves the per-result
phase-row writes in place, and no done-condition catches it.

Concrete failure: after task 7 ships, `sdd-continue` still writes a `## Phase log` row on
every `approved`/`complete`/`closed`/`resume` result **and** calls `phase-log`, which
regenerates the whole block from `phase.end` events. The block is now double-sourced: a hand
row plus a ledger-derived row for the same phase. Requirement 5.2 is unmet, and the
phase-log-from-ledger goal (Requirement 5) is defeated for the exact rows that matter most.

This lands in the task-7 text the R1-2 fix rewrote (the grep done-condition that cites only
`:139-143`), so it Compounds R1-2 — R1-2 gave task 7 content-level checks but the checks and
the removal instruction both omit `:187-193`. It borders MUST_FIX because the task instruction
("keep `:180-199`") directly contradicts the requirement it claims to satisfy (`:187-193`
must be retired); I rate it SHOULD_FIX because the requirement is implementable and the fix is
a scoped addition.

Fix: extend task 7's removal instruction and its grep done-condition to `SKILL.md:187-193` —
the supervisor stops hand-writing a phase row per `PHASE:` result and relies on the
`phase-log` action, while keeping only the orchestrator `spawn.start`/`spawn.end` at
`:180-183`. Cite `:180-183` (spawns) and `:187-193` (retire) separately so "keep `:180-199`"
no longer sweeps in the rows 5.2 retires.

## Top risks / gaps

1. Requirement 5.2 half-covered (R2-1): task 7 retires only the `:139-143` interrupted-row
   write and keeps the `:187-193` per-result phase-row writes, so the phase log ends up
   double-sourced (hand rows + ledger-derived rows) and 5.2 is not met — with no check to
   catch it.
2. Everything else on the primary surface holds: components 1-7 and requirement ACs each map
   to a task (4.3 and 5.5 are e2e, correctly at the gate), the dependency chain compiles at
   each step, the two not-implemented bridges are removed by their pointing tasks, and the
   fresh lens found every existing-code task correctly fenced from its existing suites.

## Top 3 conclusions to challenge or reverse

1. **Task 7's `_Requirements: … 5.2 …` mapping.** Challenge. The prompt and the grep
   done-condition only reach the `:139-143` half of 5.2; the `:187-193` half is not
   instructed and is actively fenced out by "keep `:180-199`". The claim of 5.2 coverage is
   overstated.
2. **"keeping the supervisor's orchestrator `spawn.start`/`spawn.end`
   (`SKILL.md:180-199`)".** Challenge the range. `:180-199` is not only spawn writes; it
   contains the `:187-193` phase-row writes that 5.2 and design Component 7 require retiring.
   Split the citation into `:180-183` (keep) and `:187-193` (retire).
3. **R1-1 partial ("stable `template` name … pass verbatim").** Accept, do not reverse. The
   grep-against-task-3's-names done-condition converts the old runtime `success:false` risk
   into a fail-loud task-7 check; the five-vs-seven reconciliation stays closed with no new
   evidence.

## What's missing before acting

- Add `SKILL.md:187-193` to task 7's removal instruction and its per-skill grep
  done-condition, so the supervisor's per-`PHASE:`-result phase-row writes are retired (or
  explicitly justified as kept) and Requirement 5.2 is fully covered and checkable.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
