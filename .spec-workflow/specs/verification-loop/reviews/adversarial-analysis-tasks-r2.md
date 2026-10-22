# Adversarial Analysis — verification-loop/tasks (v2, round 2)

Primary surface: atomicity, ordering, coverage. Fresh lens: none (per prompt).
Scope: v2 deltas attacked first (the three R1 fixes in the Revision History), then a full Task-body→Success parity sweep (retro P7) across all 14 tasks, grounded in the class-(a) item shape the route consumes.

## Verification performed (what I checked and how)

- **Delta set (the `## Changes since c326ca7` diff) — three edits, all in prose.** No citation was added or moved; round 1 already re-verified every delta anchor against the tree, so no re-verification was owed. The edits:
  1. Header parenthetical `(12 needs 5, 9 and 10)` → `(12 needs 5, 9, 10 and 11)` (R1-3 fix).
  2. Task 8 Task body + Success: a fifth `routeForTask` case added (R1-1 fix).
  3. Task 9 regression-guard label `R2 AC 11` → `R2 AC 10 and 11` (R1-2 fix).
- **Delta 1 — header dependency annotation.** T12 inserts design C6 flow steps 2-4 "between the e2e pass and the HANDOFF write" (markers T11 creates) and its `retry`-spawns-no-e2e test relies on T11's `e2ePassStands` skip. The parenthetical now reads `5, 9, 10 and 11`. Correct; R1-3 closed.
- **Delta 3 — T9 guard relabel.** R2 AC 10 governs non-task implementer steps (repair, reconcile, merge fix, security fix); R2 AC 11 governs the test author, verifier and adjudicator. The guard lists "the test author, verifier and repair steps." After the relabel, repair maps to AC 10 and the test author/verifier to AC 11 — each listed step now sits under the right criterion. Correct as far as it goes (see residual note below). R1-2's repair-mislabel half is closed.
- **Delta 2 — T8 fifth case.** Grounded in `src/controller/phases/gates.ts:345-351` (`ClassAItem` = `{ taskId, title, kind: 'sensitive-path'|'keyword', reason, score }`) and `src/core/veto-rules.ts:65-101` (`computeClassA` emits one `sensitive-path` item per matching task, tagged with that task's id). This is the delta that still carries a gap — see R2-1.
- **Retro-P7 parity sweep (Task body → Success), all 14 tasks.** For every task I checked that each test the `Task:` body names reappears in `Success:` (the clause the test author writes from). T1 (six kinds, pending, head/base), T2 (diff + temp-repo cases), T3 (list/dedupe/none/unreadable + R4 AC 7 guard), T4 (chip + no-chip), T5 (four variants — Success references "the lines listed in Task", resolvable), T6 (eligibility/history/four endings/start note/brief), T7 (round/two-endings/trailer/retry/close-out guard), T9 (sonnet+opus argv/spawn rows/one note/guard), T10–T13 all pass parity. Only T8 carries a residual (R2-1).
- **Gate B / Gate C.** No task adds an external dependency (all reuse `execFileSync`+`scrubbedGitEnv`, the `gh`/`claude` stubs, `loadRole`, the existing brief machinery). No task does more than its approved requirements ask. No `[gate-b]`/`[gate-c]` tags.

## Attack topics

### 1. T8's fifth case underspecifies the item kind (the R1-1 fix is cosmetically, not substantively, complete)
- Challenge the claim that the R1-1 fix closes the task-id scoping gap. Round 1's accepted fix proposed, verbatim, "a **`sensitive-path`** item whose `taskId` is another task returns the `sdd-test-author` profile and `no sensitive-path flag`." The reviser wrote "**an item** whose `taskId` is another task is ignored" in both the Task body and the Success clause — dropping the `sensitive-path` qualifier.
- Stress-test what the fifth case proves without that qualifier. `routeForTask` ignores an item for two distinct reasons: kind (a `keyword` item is ignored, R2 AC 3, case 2) and taskId (a `sensitive-path` item for another task is ignored, R2 AC 1). Only a `sensitive-path` item scoped to another task exercises the taskId filter. The test author writes to the `Success:` clause (retro P7) and the clause pins only `taskId = other` and the expected output; nothing forbids a `keyword` item, which satisfies the clause while being redundant with case 2.
- Trace the blast radius, grounded: on a real spec with one sensitive task, `computeClassA` returns a single `sensitive-path` item whose `taskId` is that task. A `routeForTask` that returns the `sdd-implementer` (Opus) profile whenever **any** `sensitive-path` item is present — ignoring `taskId` — passes cases 1-4 and passes case 5 if case 5 is written with a `keyword` item. Every non-sensitive task then runs its implementer on Opus. That is the exact cost regression R2 exists to prevent, shipping with a green suite.
- Confirm the source of the gap is tasks.md, not design: design C5 Testing Strategy (`design.md:171`) names only four cases; the fifth exists only in tasks.md. So the fix, and its incompleteness, originate here.

### 2. T9 adjudicator residual after the relabel (known-safe, noted not re-raised)
- Observe that the relabel corrected the repair attribution but left AC 11's third step — the `sdd-adjudicator` — unnamed in the guard. The label now reads "R2 AC 10 and 11", claiming AC 11 coverage, yet the guard lists only two of AC 11's three steps (test author, verifier).
- Weigh it down: the adjudicator call site (`implementation.ts:1108`) is a completion-gate step T9 does not touch; R2 AC 11 is "verified, not red-first," so it holds by construction, and the design Testing Strategy (`design.md:178`) likewise names only "repair and reconcile keep the profile." This is the same MINOR traceability nit as R1-2, now a known-safe residual. Not re-raised — a MINOR does not keep the loop alive, and R1-2 was accepted at that severity.

### 3. Atomicity / ordering (re-confirmed, no change)
- The v2 deltas touched no task boundary or dependency edge beyond the header annotation. Every producer→consumer edge (T3←T1,T2; T4←T3; T6←T1,T5; T7←T6; T9←T8; T11←T10; T12←T5,T9,T10,T11; T13←T12) remains satisfied by the linear order; T12's `security-open` bridge (D4) keeps the tree green before T13. No finding.

## Findings

**R2-1 — SHOULD_FIX — T8's fifth case does not pin the item to `sensitive-path`, so the task-id scoping test can be written without teeth (Compounds: R1-1; fix-induced).**
The v2 R1-1 fix added a fifth `routeForTask` case to T8's Task body and Success clause, but as "an item whose `taskId` is another task" with no kind. The test author writes from `Success:`; the clause pins `taskId = other` and output `sdd-test-author`/`no sensitive-path flag` but not the item's kind.
Failure scenario: the test author constructs the fifth case with a `keyword` item (taskId = another task). It satisfies the Success clause. The implementer writes `routeForTask` so that the presence of any `sensitive-path` item returns the `sdd-implementer` (Opus) profile, ignoring `taskId`. All five cases pass — case 5's `keyword` item is ignored by kind, not by taskId — and T8 is marked done. On a real spec with one sensitive task (`computeClassA` → one `sensitive-path` item for that task), every non-sensitive task's implementer now runs on Opus, defeating R2.
Fix-induced re-check (scoped to the fix's diff vs R2 AC 1 "no `sensitive-path` item **for that task**"): insert `sensitive-path` before "item" in both the Task body ("a `sensitive-path` item whose `taskId` is another task is ignored…") and the Success clause ("the other-task **`sensitive-path`** item returning the `sdd-test-author` profile…"), exactly as round 1 proposed.

## Top 3 risks/gaps
1. **R2-1** — the one gap that can still ship a wrong, cost-regressing `routeForTask` with a green suite. R1-1 was meant to close it; the fix added the case but not the qualifier that gives the case teeth.
2. T9's AC 11 adjudicator remains unguarded (topic 2) — safe by construction, design omits it too; a line in a later live check, not a blocker.
3. The T7 window/cancel guard and the AC 11 adjudicator are instructed/invariant but unasserted (carried from round 1) — tolerable, worth a live-run line.

## Top 3 conclusions to challenge
1. **"R1-1 is resolved" (Revision History v2).** Reverse: the case was added but its item kind was left open; a `keyword` item satisfies the clause and misses the taskId bug. See R2-1.
2. **"relabelled… so each named step sits under the criterion that governs it" (R1-2 response).** Half-reverse: the three *listed* steps now map correctly, but AC 11's adjudicator — a step the criterion governs — is still absent from the guard. Known-safe, not re-raised.
3. **The header "(12 needs 5, 9, 10 and 11)".** Hold: T12 genuinely needs all four; R1-3 is correctly closed.

## What's missing (before acting)
- Pin the T8 fifth case's item to `sensitive-path` (R2-1). This is the one change that must precede implementation of T8 so the test author writes a test with teeth.
- Nothing else blocks: ordering is sound, coverage is complete, the parity sweep is clean except T8, citations are unchanged from the verified v1 set, and no task touches a `## Sensitive paths` entry.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
