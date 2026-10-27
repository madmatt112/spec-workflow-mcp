# Adversarial Analysis — advisor/tasks (v1, round 1)

Primary surface: atomicity, ordering, coverage. Fresh lens: none (first review).
Code read under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/advisor`; spec store under `.spec-workflow`.

## What I verified (so I am not guessing)

Every structural citation I could reach is accurate:
- `writeJsonAtomic` is module-private at `state.ts:298`; `WaitRecord` 163-178 with `advice?: string` at 176; `attachAdvice(id, advice)` single-arg at `waits.ts:119-126`; `answerWait` at 90.
- `access.ts`: `loadOrCreateSecret` 40-67, `isAuthorized` 130-137, `makeRequireAccess` 156 (single `secret`), loopback exemption 166-171, `installAccessControl` 191, login 194-203, 401 body 177.
- `controller.ts`: `onWaitChange` 339 (returns early unless answered — advice alone is inert), `windowBlock` 373-388, `start()` 98 returns `Promise<boolean>`.
- `multi-server.ts`: launch route body 604-635, answer unknown-question check 649-657, advice route 663-670.
- `loadRole` `step.ts:230-243` (reads frontmatter + profile), `mergeByRule` 695, `openRunLedger` 95, `bootstrapCommand` `index.ts:129-131` + routing 394-398, `NowPage.tsx:534` is the legacy `wait.advice` render.
- Count-change greps are correct: task 2 `"toHaveLength(10)\|10 keys\|ten agent"` hits `agent-profiles.test.ts:6,23,24` and `ledger.test.ts:103`; retro findings really are `- **F…` lines under `## ` level-2 headings.
- Design components C1–C13 all map to tasks; all 7 action kinds, all 12 read tools, every requirement thread (1–11, NFRs) appears in a `_Requirements` line.

The dependency chain (modules → store → executors → routes → endpoint → opinion → pusher → entry → browser → docs → e2e) has no backward edge: every `tasks N export` reference points at a lower-numbered task.

## Attacked topics

### 1. The `controller-actions` feed path to the browser (tasks 12 and 17)

- **Challenge the claim that task 17 can satisfy "the staged group … updated from the controller-actions feed message" with `NowPage.tsx` as its only File.** The browser receives feed messages through `ShellProvider.tsx`, which subscribes per message type (`subscribe('controller-activity', …)` at `ShellProvider.tsx:103`), stores each in React state (`controllerActivity`, line 64/94/149) and exposes it on `ShellContextType`. `NowPage` reads `useShell()`, not `useWs()`. A new `controller-actions` message needs a new subscription, a new `controllerActions` state and a new context field in `ShellProvider.tsx` and `ShellContextType` — none of which is in task 12's or task 17's File list.
- **Stress-test the assumption that the opinion precedent covers this.** The opinion (task 3) rides inside the existing `WaitRecord`, so it reaches the browser on the already-wired `controller-waits` feed — task 3 correctly touches only the two `types.ts` files. Staged actions are a *separate* list with no existing feed, state or context, so that precedent does not apply; the gap is specific to `controller-actions`.
- **Attack the silent-drop risk.** Because D5 gives task 17 no frontend unit test (only `build:dashboard` + the server-side e2e), an implementer who lists the staged group from a one-shot `GET /api/controller/actions` fetch and skips the feed subscription ships a group that never live-updates, and nothing fails. `grep controllerActions src/dashboard_frontend` returns nothing today, so the whole consumption path is new and unowned.
- **Directive:** give one task (17, or a split of 12) explicit ownership of `src/dashboard_frontend/src/modules/shell/types.ts` (the `ShellMessage` union), `ShellProvider.tsx` (subscription + `controllerActions` state + `ShellContextType` field), with those files in its File list and a prompt line, or state that the group is fetch-only and drop "updated from the feed".

### 2. Task 12's File list vs. what it must compile (ordering/coverage)

- **Challenge the claim that task 12's four Files are enough.** `shell-feed.ts:122` builds `const messages: ShellMessage[]`; adding `{ type: 'controller-actions', … }` requires the server `ShellMessage` union in `src/dashboard/shell/types.ts:212` to gain the member or `npx tsc --noEmit` fails. That file is not in task 12's File list.
- **Stress-test the grep as the fix path.** The task leans on `grep "quintet\|'controller-activity'"` and "update every other hit". That grep does hit `types.ts:212` and `ShellProvider.tsx:103/112`, but the camelCase state var (`controllerActivity`) and `ShellContextType` field are not matched, so the grep alone does not describe the full plumbing — and the File list, which is meant to be authoritative here (task 3 lists all four of its files), is incomplete.
- **Mitigation noted:** the `tsc clean` gate forces the server-union edit, so this half is compiler-caught — hence MINOR, not SHOULD_FIX. The frontend half (topic 1) is not compiler-caught.

### 3. Task atomicity (tasks 10 and 16)

- **Stress-test task 10's size.** It ships `stageAction/listActions/confirmAction/dismissAction/actionEvents` + four executors (answer, deferral, decomposition, backlog) + the `checkAnswerKeys` extraction + a "not built" bridge. This is large, but D4 deliberately splits merge/deploy/launch into task 11 and the bridge keeps task 10 green; the four store-local executors share one store and lock. Defensible — not a finding.
- **Stress-test task 16's size.** `runAdvisorCommand` (dirs, seed, UUID, three 0600 files, spawn, session lifecycle) + `advisor commit` + the open route + `index.ts` routing is a lot, but it is one component (C10) and no sub-piece is independently testable. Defensible.
- **Attack the task-6 finding format** (counts "- **F" lines under level-2 headings): confirmed against real retrospectives (`harness-evals/retrospective.md` headings `## Gotchas` … `## Model behaviour`, findings `- **F1 — …`). Fine.

### 4. Success-clause coverage and Test lines (retro P7)

- Every `Test:` line resolves to a call the design interfaces or the task's own prompt introduces (`appendEvent`, `attachAdvice(id,advice,opinion)`, `makeRequireAccess(secret,advisorSecret)`, `seedSources`, `buildTallies`, `buildSummary`, `startSecondOpinion`, `registerAdvisorMcp`, `runAdvisorCommand`, the e2e route pair). No `Task:` body names a test its `Success:` clause omits.
- **One miss:** task 3 adds "an exported opinion-status setter" routed through the queue, but its `Success:` clause asserts only `attachAdvice`+`answerWait`+the queue race; the status setter is first exercised in task 14. MINOR — the setter is covered downstream and `tsc` proves the export.

## Top risks

1. **(SHOULD_FIX) The `controller-actions` live-update path to `NowPage` is owned by no task.** Task 17 (File list: `NowPage.tsx` only) promises a staged group updated from the feed, but the subscription/state/context plumbing in `ShellProvider.tsx` and the frontend `ShellMessage` union are unlisted; with no frontend test, a fetch-only implementation ships silently.
2. **(MINOR) Task 12 must edit `src/dashboard/shell/types.ts` (server `ShellMessage` union) to compile, but it is not in the File list** — compiler-caught via the `tsc` gate, so low rework, but the authoritative File list is wrong.
3. **(MINOR) Task 3's opinion-status setter is exported but not asserted in task 3's `Success:`** — covered by task 14; a value safely left there.

## Top 3 conclusions to challenge or reverse

1. **"task 3's two-`types.ts` pattern generalises to the browser."** Reverse for staged actions: opinions ride the existing wait record and feed; staged actions need an all-new feed→state→context path that no task owns.
2. **"the count-change greps fully scope the edits."** Partly reverse: the greps catch message-type string hits but not the camelCase state/context plumbing a new feed message needs; File lists, not greps, should carry that scope.
3. **"D5 (no frontend test) is cost-free."** Challenge: with no frontend assertion, the only guard on task 17's feed wiring is a human reading the prompt — exactly where the unowned plumbing (risk 1) slips through.

## What's missing before acting

- Assign the `controller-actions` frontend consumption path (frontend `ShellMessage` union, `ShellProvider` subscription + state + `ShellContextType`) to a task, with those files in its File list.
- Add `src/dashboard/shell/types.ts` to task 12's File list.
- Optionally fold an opinion-status-setter assertion into task 3's `Success:` or note the deferral to task 14.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
