# Adversarial Analysis — verification-loop/tasks (v1, round 1)

Primary surface: atomicity, ordering, coverage. Fresh lens: none (per prompt).
Scope: first review of tasks.md; delta citations re-verified; whole document attacked for coverage/ordering/atomicity against requirements.md, design.md and the decomposition entry (§26).

## Verification performed (what I checked and how)

- **Delta citations (the `## Changes since` set) — all correct.** Read both ends of every anchor the lint commit added:
  `evaluatePullRequest` is at `src/controller/merge.ts:319`; the reason-push loop is `:357-405`; the `!evaluation.ready` return is `:588-591`; `mergeByRule` is `:568`. `runMergeStageStep` is `src/controller/runs.ts:611`, its `case 'blocked'` is `:669-682`. `handleImplementationOutcome` is `:1015-1056`, `escalationRulings` `:997-1008`, the `runImplementationPhase` call (where `securityAnswers` is threaded) `:859-867`, the generic error wait `:1050-1055`. `RunPage.tsx` path prefix and the `harness.test.ts` Test-line backticks are cosmetic. No misstated artifact in the delta.
- **Test-line anchors.** `READY_VIEW` has no `baseRefName` at `merge.test.ts:59`; `expect(result).toEqual({ ready: true, reasons: [] })` at `:172`; the fixture `## Sensitive paths` lists `- package.json` at `implementation.test.ts:104`. All confirmed.
- **Reused seams.** The CI log-tail pattern (`gh run view <id> --log-failed`, tailed, saved as `ci-<name>-r<round>.log`) is at `implementation.ts:1117-1126`; the INFRA re-run `gh run rerun <id> --failed` at `:1143-1148`; `RunLedger` carries `path`, `note`, `prMerged` (so `Pick<RunLedger,'prMerged'|'note'|'path'>` in T3 is valid); `completionGate` is a nested closure inside `runImplementationPhase`, so the `classAItems` closure T9 adds is visible to the T12 security loop; the abandon cancel path at `controller.ts:353-358` fires for any `escalation` wait answered `abandon` (so R3 AC 9 abandon works); `sdd-implementer`=opus-4-8/xhigh, `sdd-test-author`=sonnet-5/high.
- **Coverage map.** Every R1–R5 AC lands in a task; every design component C1–C9 is implemented; R1 AC 13 is the only AC with no task, and the scope note justifies it (no task changes the PR checks gate). Reverse direction clean (every task cites a requirement).
- **Ordering.** Every cross-task dependency edge (T3←T1,T2; T4←T3; T6←T1,T5; T7←T6; T9←T8; T11←T10; T12←T5,T9,T10; T13←T12) is satisfied by the linear order. No consumer precedes its producer. T12's `security-open` bridge (D4) keeps the tree green before T13 lands.

## Attack topics

### 1. Success-clause coverage of T8 `routeForTask` (retro P7)
- Challenge the claim that T8's `Success:` clause is complete: the `Task:` body names **five** test scenarios (sensitive-path item for the task; keyword-only items; no items; `null`; **an item for another task is ignored**) but `Success:` commits to only "the four cases." The fifth — the task-id scoping test — is silently dropped, because the test-author writes to the `Success:` clause.
- Stress-test what the four surviving cases actually prove: cases 1–4 each use at most one item whose `taskId` matches the queried task (or none, or `null`). A `routeForTask` that ignores `taskId` and returns the implementer profile whenever **any** `sensitive-path` item exists passes all four. Only the dropped fifth case catches it.
- Trace the blast radius: R2 AC 1 routes on "no `sensitive-path` item **for that task**." If the task-id filter ships untested and wrong, a spec with a single sensitive task routes **every** task's implementer to Opus — the exact cost regression R2 exists to prevent.
- Confirm the design did not ask for the fifth case either: design C6/C5 Testing Strategy lists only "a sensitive item, keyword-only items, no items, `null`" (four). The Task body added the fifth; the Success clause did not follow it, so the gap originates in tasks.md, not design.

### 2. T9 regression guard vs R2 AC 11
- Challenge the guard's wording: T9's guard is labelled "R2 AC 11" but lists "the test author, verifier and **repair** steps." R2 AC 11 names `sdd-test-author`, `sdd-verifier` and `sdd-**adjudicator**`; "repair" is an AC 10 step, not AC 11. The adjudicator's keep-profile clause of AC 11 is unguarded.
- Weigh the real risk down: the adjudicator call site (`implementation.ts:1108`) is not modified by T9 (design C5 passes it no override), and AC 11 is "verified, not red-first," so it holds by construction; the design Testing Strategy also omits the adjudicator. This is a wording/traceability nit, not a behavioural hole — T9 does cover AC 10's repair (it is in T9's `_Requirements`).

### 3. Dependency-order annotation for T12
- Challenge the parenthetical "(12 needs 5, 9 and 10)": T12 also directly needs **T11**. T12 inserts design C6 flow steps 2-4 "between the e2e pass and the HANDOFF write" — markers T11 creates — and T12's `retry`-spawns-no-e2e test relies on T11's `e2ePassStands` skip. The annotation names non-adjacent deps (5, 9) and re-states 10 but omits the adjacent 11.
- Note why it is not a build risk: the linear chain `10 → 11 → 12 → 13` already sequences 11 before 12, so nothing breaks; the omission is only an incomplete dependency statement.

### 4. Atomicity of T12 (the whole security loop in one task)
- Stress-test whether T12 is over-scoped: it implements the entire `readSecurityState`-driven state machine (pass, fix rounds, adjudicator, two rechecks, escalate, await-answer, per-suspicion deferrals, and the accept/retry/epoch outputs into Gotchas/PR body/retro). Verdict: acceptable. The loop is a thin dispatch over the pure reader T10 exports, the machine-verified `task-words` rule passed on v1, and decomposition D3 deliberately split only the e2e record (T11) off. No finding.

### 5. The merge-fix guard ordering (T7)
- Stress-test the premise that T7 must re-check cancel/token-cap/`windowBlock()` before spawning: confirmed — the merge resume path runs before those checks in `runOnce` (`runs.ts:746-771`), so a fix-round spawn started from the merge stage would bypass them. T7's prompt instructs this re-check. Note only that neither `Success:` nor any R1 AC asserts "a blocked window pauses with no round," so the guard is instructed but untested; low severity (no dedicated AC). No separate finding.

## Findings

**R1-1 — SHOULD_FIX — T8 `Success:` drops the task-id scoping test (Novel).**
T8 `Task:` names five `routeForTask` cases; `Success:` says "the four cases," omitting "an item for another task is ignored." The dropped case is the only one that exercises the `taskId` filter.
Failure scenario: the implementer writes `routeForTask` so that the presence of any `sensitive-path` item returns the implementer (Opus) profile, ignoring `taskId`. All four Success cases pass and the task is marked done. On a real spec with one sensitive task, every non-sensitive task's implementer now runs on Opus, defeating R2 (the cost goal). Fix: add the fifth case to `Success:` (e.g. "a `sensitive-path` item whose `taskId` is another task returns the `sdd-test-author` profile and `no sensitive-path flag`") — or state "the five cases."

**R1-2 — MINOR — T9 regression guard mislabels AC 11 (Novel).**
The guard cites R2 AC 11 but lists "repair" in place of the adjudicator; AC 11's adjudicator clause is not guarded. Holds by construction and the design omits it too, so behaviourally safe. Fix: either name the adjudicator for the AC 11 guard, or split the label so "repair" is attributed to AC 10.

**R1-3 — MINOR — T12 dependency annotation omits T11 (Novel).**
"(12 needs 5, 9 and 10)" should read "5, 9, 10 and 11." No build impact (the linear chain covers it); fix for accuracy.

## Top 3 risks/gaps
1. **R1-1** — the only gap that can ship a wrong, cost-regressing implementation that still passes every written test.
2. The security-loop window/cancel guard (T7, topic 5) and the AC 11 adjudicator (R1-2) are instructed/assumed but not asserted — tolerable because each is an invariant or design-level safety, but worth a line in a later live check.
3. T12's breadth: cohesive but the single largest surface; if the live run ever needs to bisect a security-loop defect, the one-task granularity gives no intermediate green point between "state reader" (T10) and "whole loop" (T12).

## Top 3 conclusions to challenge
1. **"the four cases" (T8 Success).** Reverse: it is five; the fifth is the one that matters. See R1-1.
2. **T9's "test author, verifier and repair steps keep their profiles" = R2 AC 11.** Reverse: AC 11 is test-author/verifier/adjudicator; repair is AC 10. The mapping is mislabelled though not behaviourally wrong.
3. **The dependency header's "(12 needs 5, 9 and 10)".** Reverse: T12 also needs T11 directly; the enumeration is incomplete.

## What's missing (before acting)
- Fix R1-1 so the test-author writes the task-id scoping case; this is the one change that must precede implementation of T8/T9.
- Optionally tighten the two MINOR traceability items (R1-2, R1-3) in the same pass.
- Nothing else blocks: coverage is complete, ordering is sound, citations verify, and no task touches a `## Sensitive paths` entry (the header's verifier-spend claim holds — only T2, T6, T8, T10 add new modules → high risk → verifier).

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
