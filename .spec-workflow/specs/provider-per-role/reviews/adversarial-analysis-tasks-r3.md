# Adversarial Analysis — provider-per-role/tasks (v3), round 3

Primary attack surface: atomicity, ordering, coverage. Fresh lens: the sub-agent that
receives only the task prompt — each `_Prompt:` read as an implementer who sees nothing
else, hunting for a pinned signature/label/helper/path another task creates and for
success criteria the implementer cannot check from the prompt alone. Deltas (the R2-1 /
R2-2 / R2-3 fixes and the v3 lint commit) attacked first.

## What I checked and how

- **The R2-1 fix's core claim — the orchestrator holds `deferrals`.** Read
  `harness/agents/sdd-implementation-orchestrator.md` whole: the tool list runs to line 42,
  and lines **31-33 are the three plugin-prefixed `deferrals` MCP names**. The v3 citation
  `sdd-implementation-orchestrator.md:31-33` is **correct**. (The r2 analysis's claim that
  the orchestrator "does not include `deferrals`" was drawn from reading only `:9-17`; the
  full list does hold it. So the v3 fix identified a *real* permitted writer — the hard R2-1
  MUST_FIX is genuinely resolved on that axis.)
- **The implementer's flags and bars.** `sdd-implementer.md:34` — the implementer *may*
  report `AFFECTS-FUTURE-SPECS: <one line>`; `:35` — it is barred from `deferrals`. Both
  correct. `briefs.md:41` (may report AFFECTS-FUTURE-SPECS), `:43-45` (RETRO categories
  include `gotcha`), `:49` (barred from deferrals) — all correct.
- **The routing the fix leans on.** `SKILL.md:104` — `AFFECTS-FUTURE-SPECS ⇒ **Deferral
  bar**`; `SKILL.md:167-175` — the Deferral bar itself. Read the bar in full (see R3-2).
- **The R2-2 fix.** `formats.md:119-121` retro categories = gotcha, bug, tool-error,
  mcp-deficiency, harness-defect, misunderstanding, inefficiency, doc-gap, model-behaviour,
  ruling, escalation, cleanup, deviation. `gotcha` is in **both** the implementer brief
  list (`briefs.md:43-45`) and the `retro.sh` list, so the orchestrator's retro-log call
  with the implementer's `gotcha` category succeeds. R2-2 fix is **sound**.
- **The R2-3 fix and its citation.** Read `decomposition.md:341-350` (the **A subprocess
  spawn path** bullet, holding the superseded `--model` DeepSeek-name at 344 and
  `ANTHROPIC_MODEL` at 346) and `:377-387` (the **End-to-end verification** section, holding
  superseded scenario (4) "with a `note`" at 383-384). The substance of R2-3 is right: the
  step-8 verifier greps and takes 377-387, which contains 383-384 but not 344/346. But the
  *citation* on line 119 is defective — see R3-1.
- **SKILL.md length.** `wc -l` = **320 lines**, so any `SKILL.md:383-384` / `:344` / `:346`
  reference is out of bounds.
- **Fresh-lens cross-task signature check.** Traced the launcher call signature across
  tasks 1, 5, 6, 10 (`bash <LAUNCHER|sdd-launch.sh> <agent> "<message>"`), the `SDD_*`
  export set (tasks 1, 2, 5), the `@deepseek` cell / `anthropic N deepseek N` format (tasks
  7, 8, 9, 10 sc.4), and the (b)-row read (tasks 1 → 4). All consistent; no task pins a
  label another task contradicts.

## Findings

### R3-1 (MUST_FIX, fix-induced, Compounds R2-3) — line 119's bare line-refs bind to `SKILL.md` and resolve out of bounds

The R2-3 fix rewrote the Scope note at `tasks.md:119`. The clause reads:

> …takes only its **End-to-end verification** section
> (`…/decomposition.md:377-387`, `…/SKILL.md:190-191`), which reads the superseded
> scenario (4) wording at `:383-384`; the entry's other superseded wording at `:344,346`
> sits in a different bullet…

Both `:383-384` and `:344,346` are **bare line-refs**. By the citation binding rule (a
bare ref attaches to the nearest preceding path), they bind to
`harness/skills/sdd-implementation-phase/SKILL.md:190-191`, not to `decomposition.md`. The
file is 320 lines, so `SKILL.md:383-384`, `SKILL.md:344` and `SKILL.md:346` are all out of
bounds. `spec-lint` machine-caught the range one as **L-1** (`citation-range`, error); the
two single-line refs `:344,346` bind the same wrong way and are the same defect, just not
range-checked. The intended file for all three is `decomposition.md` (383-384 within the
377-387 verification section; 344/346 in the 341-350 subprocess-spawn bullet — both
verified present and reading as claimed).

Failure scenario: any tool or reader resolving citations follows the binding rule to a
non-existent SKILL.md range. Fix: make both refs explicit —
`decomposition.md:383-384` and `decomposition.md:344,346` — or reorder so
`decomposition.md:377-387` is the nearest preceding path. Low-effort, but an out-of-bounds
citation range is a misstated artifact.

### R3-2 (SHOULD_FIX, fix-induced, Compounds R2-1) — the Deferral bar does not guarantee the `verification`-tagged deferral the fix asserts

The R2-1 fix moved the deferral writer to the orchestrator (correct — it holds `deferrals`)
and has task 10 report `AFFECTS-FUTURE-SPECS:` instead of filing the record itself. Task
10's prompt (`tasks.md:100`), D5 (`:108`) and the Scope note (`:118`) then assert the
orchestrator "routes that flag through the Deferral bar (`SKILL.md:167-175`) **into one
record tagged `verification`** with that command as `revisitCriteria`."

The cited Deferral bar (`SKILL.md:167-175`) does not support that. It is a **discretionary
three-part gate**: a discovery becomes a `deferrals add` record "only if all three hold: a
symptom …, a trigger …, and enough weight …"; and "anything that fails the bar but is worth
knowing **goes into the HANDOFF section as a gotcha**." Two gaps:

1. **No `verification` tag.** The bar's field list is generic ("tags"); the word
   `verification` never appears in it. The only place the harness deterministically emits a
   `verification`-tagged deferral for a "needs a restart to verify" half is the step-8
   completion-gate path — `SKILL.md:207`, `VERIFY: pass (deferred: <id>)` — which task 10
   *deliberately bypasses* ("not the step-8 verifier of `…SKILL.md:201-209`").
2. **Not guaranteed to be filed at all.** The three-part judgment may route the discovery to
   HANDOFF-as-gotcha rather than a `deferrals` record.

This matters because the whole re-run mechanism keys on the tag: the project's own runbook
(`CLAUDE.md`) resolves deferred verification with `deferrals list tag=verification`. If the
orchestrator files task 10's discovery as a HANDOFF gotcha, or a differently-tagged /
untagged deferral, the supervisor/orchestrator halves are invisible to that sweep and never
re-run after the session restart — the exact "deferred verification silently never happens"
failure R1-2/R2-1 were about, re-created one layer up in the orchestrator. Fix: either
route task 10 through the step-8 `VERIFY: pass (deferred: <id>)` path that tags
`verification` by contract, or state in task 10 / D5 that the orchestrator files the
Deferral-bar record **with tag `verification`** explicitly (and stop asserting the bar does
so on its own).

### R3-3 (MINOR, fix-induced, Novel) — task 10's Prompt body and Success line disagree on how many `AFFECTS-FUTURE-SPECS` lines

The Prompt body says report "`AFFECTS-FUTURE-SPECS: <one line>` … into **one record**"
(one line, one record, one command that itself enumerates the deepseek / anthropic /
key-unset conditions). The Success line says "carries **one `AFFECTS-FUTURE-SPECS:` line
per deferred half**" — and the same prompt has just named three "supervisor halves of
(1)-(3)." So the self-check reads as three lines while the mechanism reads as one. An
implementer seeing only this prompt cannot tell whether to emit one flag line or three, and
"one record" then does not line up with "one per half." Wording only; pick one count.
(Not a keep-alive finding on its own.)

## Attack on the deltas (dispositions)

- **R2-1 fix — landed on the hard axis, gap on the tag.** The permitted writer is real
  (orchestrator holds `deferrals`, `:31-33`), and task 10's Success line no longer names a
  record id the implementer cannot see — it now self-checks only its own report, which the
  implementer *can* verify from the prompt alone. The unsatisfiable-success-line MUST_FIX is
  fixed. Residual: R3-2 (the `verification` tag / filing is not guaranteed by the cited bar).
- **R2-2 fix — sound.** `RETRO: gotcha` is authorised in both category lists; the
  orchestrator's `## Escalate` branch (task 3) keeps `escalation` and has `retro.sh`'s full
  set. No crack.
- **R2-3 fix — substance sound, citation defective.** The verifier-reads-only-377-387
  ruling is accurate; the sentence carrying it has the out-of-bounds bare refs (R3-1).
- **v3 lint commit (4027247)** — the bare-path expansions (`sdd-implementer.md:35`,
  `SKILL.md:100-106`, `SKILL.md:167-175`, `SKILL.md:190-191`,
  `briefs.md:43-45`) all resolve to real, on-point ranges. The one regression it introduced
  is the mis-prefixed `:383-384` (R3-1), which the lint pass itself flagged as L-1.

## Fresh lens — implementer sees only the prompt

- **Cross-task pins are consistent.** Launcher signature (`bash … <agent> "<message>"`),
  the nine `SDD_*` exports, `SDD_PROVIDERS`, the `@deepseek` cell and `anthropic N deepseek
  N` totals, and the alias mapping (`claude-opus-4-8`↔`deepseek-v4-pro`,
  `claude-sonnet-5`↔`deepseek-flash`) are pinned the same way in every task that names them.
  No task asserts a label or path another task creates differently.
- **Success criteria are self-checkable** for tasks 1-9 (each ends in a `grep`/`bash -n`/
  `vitest`/`tsc`/`--watch` the implementer runs) and — after the R2-1 fix — for task 10's
  own report (it no longer has to confirm an orchestrator-side deferral id). The only
  prompt-alone weaknesses are R3-2 (a claim about what the *orchestrator* does that the
  implementer cannot and need not verify, but which the doc overstates) and R3-3 (the count
  ambiguity).
- **Soft, carried, not raised:** task 4's implementer hard-codes `ELIGIBLE` from a free-text
  read of deepseek-preflight.md's (b) row (no machine-pinned "answered" token); it is a
  build-time human read the prompt directs and the test re-reads the record, so it holds.
  Pre-existing, not a v3 delta.

## Top risks / gaps

1. **R3-1** — line 119's bare refs resolve to a non-existent `SKILL.md` range (L-1).
2. **R3-2** — task 10's deferred halves may never be filed as a `verification` deferral, so
   `deferrals list tag=verification` misses them and they are never re-run post-restart.
3. **R3-3** — task 10's own success check is ambiguous about the flag-line count.

## Top 3 conclusions to challenge

1. **Task 10 / D5 / Scope note: the orchestrator "routes that flag through the Deferral bar
   into one record tagged `verification`."** Challenge: the cited bar (`SKILL.md:167-175`)
   is discretionary and names no `verification` tag; the deterministic tag comes only from
   the step-8 path task 10 refuses to use. The guarantee is asserted, not mechanised. (R3-2)
2. **Scope note `:119`: the verifier "reads the superseded scenario (4) wording at
   `:383-384`."** Challenge: as written, that ref (and `:344,346`) points at `SKILL.md`, not
   `decomposition.md` — out of bounds. (R3-1)
3. **Task 10 Success: "one `AFFECTS-FUTURE-SPECS:` line per deferred half."** Challenge: the
   Prompt body says one line, one record. Reverse one of them. (R3-3)

## What's missing before acting

- A deterministic tie from task 10's `AFFECTS-FUTURE-SPECS` line to a `verification`-tagged
  deferral: either use the step-8 `VERIFY: pass (deferred: <id>)` path, or make the
  orchestrator's Deferral-bar record's `verification` tag explicit in the task (not an
  assumed side effect of the bar).
- Both line-119 bare refs given an explicit `decomposition.md` prefix.
- One consistent count for task 10's flag lines / deferral records.

## Gate B / Gate C

No task introduces a new external dependency (the DeepSeek `claude -p` vendor path is
approved by Requirements 2/4/6; no new npm package). No `[gate-b:T…]`. No task exceeds the
approved requirements: task 3's `ESCALATE` flag serves Req 6.6; task 10's self-reported
deferral serves Req 7 verification (the defect is the routing, R3-2, not new scope). No
`[gate-c:T…]`.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
