# Adversarial Analysis — dashboard-deploy/tasks (v1, round 1)

First review of the tasks document. Primary attack surface: **atomicity, ordering, coverage**.
Deltas attacked first (the lint-pass `## Changes since c761f42a`), then a fresh lens on File-list
scope and gate-C scope-creep. Requirements (v5) and design (v3) rulings are closed and not reopened.

## What I checked, and how

- **Every lint-pass delta, line by line, against the code.** Component-label insertions
  (`C1.`→`C2.` etc.) are prose-equivalent to the pre-lint text; none change meaning. Citation-path
  fixes verified against the real files: `./vitest.config.ts:8-9` (include/exclude, frontend
  skipped ✓), `./tsconfig.json:19-20` (include/exclude ✓), `./playwright.worktree.config.ts:52-56`
  (the `--dashboard` webServer env block ✓), `src/dashboard_frontend/src/modules/shell/pause.ts:1`
  (the extension-less `import … from './types'` that would trip TS2835 under node16 — claim holds ✓).
- **The "task N"→"a later task" bridge-missing fixes.** Confirmed each dropped forward number still
  points correctly: task 3→"onStart/cancel a later task" = task 4; task 5→"isStartable/pause/… a
  later task" = task 6; task 6→"route that maps the sentinel a later task" = task 9. (git's hunk
  headers mislabel these as task 4/3; the +/- bodies are tasks 5/3 — not a document defect.)
- **Requirement coverage.** Mapped all 53 ACs + 3 NFRs to tasks; every AC is covered and every task
  carries a `_Requirements:` line. Component coverage C1(2,3,4) C2(1) C3(5,6) C4(7,8) C5(2) C6(9)
  C7(10) C8(10,11) C9(12,13) C10(12,13) all present, matching Scope notes.
- **Ordering.** The chain `1→2→3→4→5→6→9→14→15`, `7→8→14`, `2→{10,11}`, `{10,12}→13` is conservative
  and complete. Verified the one subtle edge: `recover` (`controller.ts:353`) funnels an answered
  wait through `resumeIfWaitAnswered`→`onWaitChange`, so task 5's single guard at `:546` covers both
  the live-answer and recovery paths (R4 AC6) — no separate `:352-353` edit is missing. The
  `resumeNow` sentinel widening in task 6 compiles at the base resume route (`:833-839` only does
  `===` checks) and the truthy-fall-through intermediate state is unreachable (nothing presses
  before task 9).
- **Atomicity.** The three two-task splits (coordinator 3/4, controller 5/6, script 7/8) are
  justified by D30; the long Success lines name sub-cases distinctly (no collapsed sub-cases).
- **`Test:` seams & success-clause coverage.** Every `Test:` call resolves to this/earlier task or
  the design; each Task-body behaviour re-appears in its Success clause (one near-miss below).

## Findings

### R1-1 — MINOR — Novel — `[gate-c:T9]` — `SDD_DEPLOY_DISABLED` is scope beyond the approved docs
`grep` confirms `SDD_DEPLOY_DISABLED` is in neither requirements.md nor design.md. R3 AC8 gives
`--smoke` as the only disable path; the design's `deployDisabled` option is driven solely by smoke.
Task 9 adds a **second production disable path** (`process.env.SDD_DEPLOY_DISABLED === '1'`) and
task 13 sets it in `./playwright.worktree.config.ts`. The document declares it honestly ("Added
beyond design … Design's seeded e2e cannot work without it", D27), and it is low-risk (opt-in),
but it does more than the approved requirements ask, so it is carried to the human gate C. Not a
rework item.

### R1-2 — MINOR — Novel — task 7 Success does not name the `wait` stage write (R2 AC1 sub-case)
R2 AC1 requires the script to write `stage: 'wait'` before the in-flight check (`:81`). Task 7's
Success asserts the logged sequence `build, smoke, gate, swap, restart`→`done`; the `wait` write is
unnamed. In practice the controller's press already seeds `stage: 'wait'`, so the script's write is
idempotent/unobservable through the stage seams, and design C4 "Stage calls" (cited by the prompt)
still forces the implementer to emit it. Low value to assert; no rework.

### R1-3 — MINOR — Novel — task 12 cites whole C9/C10 while deferring three of their modules
Task 12 cites "C9 … and C10"; C9/C10 name `RunsPage.tsx:341`, `ShellProvider.tsx`,
`WebSocketProvider.tsx` and `DeployControl.tsx` as write locations, none in task 12's File list
(its restriction defers them to task 13, which does list them). This is the document's **uniform**
convention for multi-task component splits (task 3 cites all of C1 yet defers onStart/cancel to
task 4; same for C3→5/6, C4→7/8), so it is consistent and not a lost or out-of-scope edit — noted
only because the agent-rules file-scope gate reads citations literally.

## Conclusions to challenge (and why they survive)

1. *"Each task leaves tsc and every existing suite green."* — Survives. The coordinator has no
   caller until task 5, nothing presses until task 9, the 7th shell message's frontend handler
   lands in 12/13 (unknown types are ignored), and the resume-sentinel intermediate state is
   unreachable. Verified against the base route and feed code.
2. *"Every design component has a task."* — Survives. All of C1–C10 map to a task and every
   requirement AC is covered; no task lacks a requirement.
3. *"The dependency chain is complete."* — Survives. The one load-bearing implicit edge (recovery
   path for R4 AC6) is covered by the single `onWaitChange` guard because `recover` routes through
   it; all other edges are conservative.

## What's missing before acting
Nothing blocking. The human gate C should rule on the `SDD_DEPLOY_DISABLED` switch (R1-1); the
tasks are otherwise ready to implement in number order.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
