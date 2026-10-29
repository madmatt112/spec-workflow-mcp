# Adversarial Analysis — run-pause/requirements (v2, round 2)

Primary surface: completeness, ambiguity, scope. Deltas attacked first; one fresh lens
(crash-recovery / restart ordering) applied after. Prior round's three findings
(R1-1/R1-2/R1-3) were all accepted and are verified fixed below.

## Deltas since 116ac6e4 — verified

- **R1-1 fix — correct.** R1 AC3 now anchors `run-not-found` at `src/dashboard/multi-server.ts:814`;
  line 814 is `if (!run) return reply.code(404).send({ error: 'run-not-found' });` (cancel route body).
  R4 AC6 now anchors `not-paused` at `:823`; line 823 is
  `if (run === null) return reply.code(409).send({ error: 'not-paused' });` (resume route body). Both land on the artifact.
- **R1-2 fix — mechanism sound.** R4 AC2 names the `merge` cursor (`stepKind: 'merge'`) as the durable
  re-entry marker. Verified: `runOnce`'s `resumingMerge` (`src/controller/runs.ts:779-781`) is
  `status === 'merging' || (!hasMerged(...) && (cursor?.stepKind === 'merge' || hasMergeWait))`. After an
  operator pause the status is `paused` and the PR is unmerged, so `cursor.stepKind === 'merge'` carries
  re-entry. The `blocked` path at `:689-691` sets exactly this cursor (`:679-691` cite correct). R3 AC3's
  claim that a `not-ready` merging run keeps a `stepKind: 'implementation'` cursor is correct: the
  implementation decision sets it at `:926` and `not-ready` (`:677`) never rewrites it.
- **R1-3 fix — correct.** `ControllerRunRow` (`RunsPage.tsx:209-233`) is a stateless function component
  with no `useState`/error element; the panel's error line is `RunsPage.tsx:321`
  (`{error && <p ...>{error}</p>}`). Both cites in the rewritten R6 AC2 are accurate, and the render
  location is deferred in Scope notes. Consistent.

No delta regressed a prior-agreed anchor. All v2 citations check out.

## Finding

### R2-1 — R3 AC3 pauses a `merging` run but is silent on `resumeAt` (SHOULD_FIX, Compounding, carried)
`Compounds: R1-2` (same `merging → paused` seam).

A status-`merging` run always carries `resumeAt: nextMergeCheck(deps)` = now + 30 s
(`src/controller/runs.ts:677`, `:726`; `MERGE_POLL_INTERVAL_MS = 30_000`, `src/controller/merge.ts:25`).
R3 AC3 says to "make it `paused` with reason `operator` at once" and set the merge cursor, but — unlike
R3 AC2, which for a usage-paused run explicitly says "clear `resumeAt`" — R3 AC3 never mentions `resumeAt`.

The asymmetry is dangerous because `merging` is the one live status that carries a near-future `resumeAt`.
`isStartable` (`src/controller/controller.ts:336-339`) treats a `paused` run as startable once
`resumeAt <= now`, whatever the reason. Failure scenario: operator pauses a `merging` run to run
`sdd-self-update.sh`; an implementer who follows R3 AC2's stated pattern leaves `resumeAt` on the write;
30 s later the paused-operator run is startable, `schedule` (`:323-324`) starts it and clears
`pauseReason`, and the merge re-check fires mid-deploy — the exact auto-merge-during-deploy that D9 exists
to prevent, and a direct violation of the Reliability NFR ("an operator pause has no `resumeAt` and SHALL
never end by itself").

The document as a whole does state the right outcome (the NFR governs), so this is a completeness gap, not
a flat contradiction — hence SHOULD_FIX, not MUST_FIX. Fix: R3 AC3 SHALL clear `resumeAt` on the paused
write (match R3 AC2 and R2 AC2's "no `resumeAt`"). The v2 delta edited this AC to add the cursor clause
and had the chance to close this at the same time.

## Fresh lens — crash-recovery / restart ordering (R5 AC3–AC5) — checked, sound

- R5 AC3 (running, step alive): `recover` re-attaches and `startDrive`s on step exit
  (`controller.ts:263-268,277-289`); applying the pause at the boundary then depends on the R2 AC3 stop
  check plus the R5 AC1 on-disk pending flag. Consistent.
- R5 AC4 (running, step gone): `recover` calls `startDrive` immediately, so the "paused without spawning a
  step" outcome must be enforced at `runOnce` entry — stated as an outcome, mechanism left to design.
  A re-run from the cursor on Resume loses nothing (the dead step's result was never durably acted on).
  No requirements defect.
- R5 AC5 (waiting, wait answered while down): `recover` → `resumeIfWaitAnswered` → `onWaitChange`
  (`controller.ts:291-293,369-392`), the same path R3 AC4 already modifies to write `paused`/`operator`
  instead of `queued`. Consistent; no new seam.

## Top risks / gaps

1. **R3 AC3 leaves `resumeAt` on a paused-from-merging run** (R2-1): a 30 s self-resume mid-deploy,
   defeating D9 and the Reliability NFR. SHOULD_FIX.
2. No others. Both response-body anchors (R1-1) and the merge re-entry marker (R1-2) are now correct;
   the frontend error surface (R1-3) is correctly deferred.

## Top conclusions to challenge

1. **R3 AC3 "make it `paused` with reason `operator` at once."** Reverse the assumption that "make it
   paused" implies the full no-`resumeAt` write here. Because R3 AC2 spells out "clear `resumeAt`" one AC
   earlier, silence in AC3 reads as "keep it" — and merging is precisely the status that has one. State it.
2. **Everything else in the deltas holds.** The merge-cursor mechanism is genuinely implementable against
   `resumingMerge`, and the deferral of the row error location is legitimate. Do not re-litigate.

## What's missing — before acting

- One clause in R3 AC3: the paused write clears `resumeAt` (so the 30 s merge poll cannot resume an
  operator pause). Nothing else.

## Verdict block

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```

`iterate` because SHOULD_FIX = 1.
