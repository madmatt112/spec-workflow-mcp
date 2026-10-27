# Adversarial Analysis — advisor/tasks (v2, round 2)

Primary surface: atomicity, ordering, coverage. Fresh lens for this round: none (per prompt).
Delta attacked first per standing directive. Code read under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor`.

## Delta under review (Revision History v2)

v2 is the round-1 adversarial response. Three fixes + a lint pass. I scoped each as a fix-induced re-check against the finding it must satisfy, not a whole-document re-review.

### R1-1 (SHOULD_FIX accepted) — browser consumption of `controller-actions` — re-check: CLOSED
Task 17's File list now adds `src/dashboard_frontend/src/modules/shell/types.ts` and `ShellProvider.tsx`; its prompt names the four pieces the v1 analysis demanded: the frontend `ShellMessage` union member, a subscription, a `controllerActions` state and a `ShellContextType` field, read in `NowPage` through `useShell()`. Verified against the real files:
- Frontend `ShellMessage` union at `types.ts:224-229` (5 members today) — citation accurate.
- `ShellContextType` at `ShellProvider.tsx:22-32`; `controllerActivity` state at line 64; the subscribe block at 99-104 (`controller-activity` subscribe at 103, inside the range). All accurate; the leverage pattern is real.
The live-update path now has an owner. Fix complete.

### R1-2 (MINOR accepted) — server `ShellMessage` union + grep narrowing — re-check: CLOSED
Task 12 File list now carries `src/dashboard/shell/types.ts`; prompt adds the member to the server union (`types.ts:207-212`, accurate). Grep narrowed to `src/dashboard`. Verified the split is clean: `grep -rn "quintet\|'controller-activity'" src/dashboard` hits only server files (`shell-feed.ts:76,127`, `types.ts:212`, `shell-feed.test.ts:275,284,299`); the sibling `src/dashboard_frontend` is NOT reached, so the two frontend hits (`ShellProvider.tsx:103,112`, `types.ts:229`) stay with task 17. No double-ownership, no orphan.

### R1-3 (MINOR partial) — opinion-status setter assertion — re-check: CLOSED
Task 3 Success now asserts "the opinion-status setter started together with an answerWait on one id serialises through the queue and leaves the answer intact." Assertable through the `waits.test.ts` seam (the setter is exported); the setter's first downstream use stays in task 14, as the finding allowed.

### Lint pass — spot-checked
L-8/L-15 fixes and the rule-11 suppressions concern tokens v1 already ruled on; no re-open.

## Ordering between task 12 and task 17 (the new seam)
Task 12 (server) emits a 6th feed topic from that task on; task 17 (frontend) adds the subscription later. Between them the frontend `useWs` dispatch simply has no handler for `controller-actions`, so the unsubscribed type is ignored — no runtime error, tree stays green. Ordering holds.

## One fresh grounding check (not a delta)
`StagedAction` (design.md:111-120) is path-free: `target` is `{project?, spec?, pr?, wait?}` — names/ids, no filesystem path. So task 12 sending the action list over the feed leaks no path to the browser, and the frontend hand-copy task 17 adds is an ordinary path-free wire shape, same as `ControllerWait`.

## Findings

- **M2-1 (MINOR, Compounding: R1-1).** Task 17 must add a frontend hand-copy of the staged-action wire shape (to render `kind/target/reason/conversation/outcome`); the File list covers `types.ts` and the union-member addition implies it, but neither names the hand-copy type. The `build:dashboard` tsc gate forces the shape to exist and be internally consistent, and the shape is path-free, so the only residual risk is field drift from the server copy — the project-wide accepted "keep in step by hand" convention (same for `ControllerWait`/`ControllerRun`), not advisor-specific. Non-blocking; noted for the implementer.

## Top risks
1. None blocking. The one open item (M2-1) is a convention-level note, compiler-forced to exist and path-safe.

## Top conclusions — holding, not reversed
- "The v2 delta closes R1-1 with task 17 owning the frontend path." Holds: File list + prompt + verified citations all line up.
- "The narrowed grep keeps server and frontend edits with their owning tasks." Holds: the `src/dashboard` directory does not reach `src/dashboard_frontend`.

## What's missing before acting
- Nothing blocking. Optionally name the frontend staged-action wire shape in task 17's prompt (M2-1).

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
