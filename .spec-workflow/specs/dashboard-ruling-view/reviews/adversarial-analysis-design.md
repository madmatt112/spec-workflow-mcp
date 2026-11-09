# Adversarial Analysis — dashboard-ruling-view/design (v1), round 1

Primary surface: feasibility, consistency, edge cases. Deltas since `3a36efa5` are the
lint pass only (directory-prefix citations, 5 bare-filename repairs, 3 prose de-ticks); I
re-verified each changed citation against code first, then applied a fresh feasibility and
edge-case lens to the whole document. Rulings in the Revision History are closed.

## What I verified (deltas first)

Every citation the lint commit touched resolves to its real symbol and range:

- `implementation.ts`: `ImplementationPhaseOutcome` 124-144, schemas 152-182, `stop` 566-578,
  orient/vanished 622-635, `runTask` 649, `taskCommits` 668-669, SEAM-DEFECT 703-704, implementer
  flag 787-788, never-logged `error` 795, gate note 848, fix-round flag 945-947,
  `routeImplementerFlags` 960-1005, `isTddMarked` 256-259 — all correct.
- `runs.ts`: `waitAnd` 622-631, `escalationRulings` 1188-1204, `handleImplementationOutcome`
  1242-1309 (ruling 1259-1271, security 1283-1289, fresh retry 1296-1301, error wait 1303-1307),
  document escalation 1359-1364 — all correct. The error-question task tag does not leak into
  briefs: `escalationRulings` filters `kind === 'escalation'`, the error wait is `kind === 'error'`.
- `waits.ts`: `createWait` 98-118, `answerWait` 127-155, `listWaitsForWire` 241-243, `gateSection`
  260-272, `upsertSection` 295-302, `noteText` 305-309 — all correct. `upsertSection`'s
  `startsWith('## ' + heading)` keys on `## <kind> <wait id>`; 8-hex wait ids are equal-length, so
  no prefix collision — a later ruling section cannot replace an earlier one (R6 AC 6 holds).
- `multi-server.ts`: `readWait` import at 45, answer route 701-715 (returns `{ok:true}` → the new
  `answer` stage reads `running`, not failed). `state.ts` `WaitRecord` 207-226, `readRun` 414-416.
  `task-parser.ts` `parseTasksFromMarkdown` 194, `taskBlock` 424-444, `promptStructured` 143-169.
  `review-gate.ts` 73-74 (`gate`/`risk`). `types.ts` `TaskReview` 297-308, `ReviewFinding` 242-251.
- Frontend: `AnswerSheet.tsx` 45-78 / 85-90 / 200-209 / 210-260 / 254-257 / 277-292 / 307-317,
  `stage.ts` 13 / 55-70 / 73-96 / 106-123, `useStages.ts` 24-49, `HomePage.tsx` 60-63 / 148-171,
  `board.ts` `mergeRead` 152-163 / `compactAge` 184-195, `tiles.tsx:90` (`text-display tabular-nums`),
  `controller.ts` 645-676 / 660 / 662-668 / 671-673 — all correct.
- Probes (C6): I re-ran both scripts in `/tmp/scratchpad/sdd/dashboard-ruling-view/`.
  `execFile timeout:300` on `sleep 5` → `killed:true, signal:SIGTERM, code:null`; `maxBuffer`
  overflow → `code:ERR_CHILD_PROCESS_STDIO_MAXBUFFER` with `killed` **falsy**. So the two failures
  are distinguishable (maxBuffer by `code`, timeout by `killed`) — C6's three-way error mapping is
  implementable. `git cat-file -e` → 0 present / 128 missing; `show --format=%h%x00%s` → short hash,
  NUL, subject, blank line, patch, and `Binary files /dev/null and b/b.bin differ`. All confirmed.

Data-model completeness and error-branch-shape rules are satisfied: `WaitTaskRow`/`WaitDiff`
enumerate every field of their `ok` arms (not union-only); both GET routes pin discriminant +
status (404 `wait-not-found`, else 200 with a state tag); the answer-stage 30 s timeout pins its
`failed` discriminant and reason (Error Handling 4). No unpinned race-loser branch.

## Attack 1 — C6 / Data Models: the "7 characters" short-hash claim

- **MUST_FIX [drafting] (M1).** Data Models states: "`DiffCommit.hash` is 7 characters: `%h` for a
  found commit, else the stored hash's first 7." The `%h` half is a **false behaviour claim**. In
  this repo `git show --format=%h HEAD` returns an **8-character** abbreviation
  (`3be9964a`), because git's `core.abbrev` default grows the short hash past 7 for uniqueness as the
  object count rises; it is not fixed at 7. Failure scenario: a found commit renders an 8-char hash
  while the `else` arm slices a rebased/not-found hash to exactly 7, so the view shows
  mismatched-length hashes, and any length assertion a test author derives from this sentence
  ("7 characters") passes only on a tiny fixture repo and misdescribes production. Fix is wording:
  state the found hash is git's abbreviated short hash (≥ 7) and align the not-found arm's length
  (no requirement, design choice or scope changes).

## Attack 2 — C2 ruling evidence: scope of the report and the review

- Challenge whether every stop that a worker caused carries its report. C2 sets `ev.report` only at
  703-704, 787-788 and 945-947. The P8 file-outside-list design-defect stop (870-875), the gate-tool
  `error` stop (843) and any adjudicator-driven stop set no `ev.report`; their `detail` is
  review-only or absent. This is consistent — R2 AC 5 scopes the report to `routeImplementerFlags`
  and the SEAM-DEFECT, and those stops are not worker-flag stops — so the view correctly falls back
  to the diff + wait text. Not a defect; recorded so a later round does not re-raise it.
- Stress-test `latest = getLatestReview(task.id)`. The method is `async` (task-review-manager.ts
  182-185); the wrapper is `async` and "a throw reads as `null`" pins the try/catch, so the missing
  `await` in the prose is implementable, and it matches Error Handling 2. Fine.
- Confirm `commits` order: `taskCommits` already excludes `redCommit` (668-669 `.filter(c !== redCommit)`)
  and `rulingCommits` prepends `red` and dedupes — no double red, oldest first (R2 AC 4). Fine.

## Attack 3 — C5 riskFromLedger regex against the real note

- Stress-test the regex `^gate: task <id> \S+ risk (low|medium|high)\b` against the live note at
  848: `gate: task N <pass|fail> risk <R>[ round n][ tdd ...][: reasons]`. `\S+` consumes the
  verdict, ` risk <R>` captures, `\b` closes it — matches. The trailing space in `task <id> `
  blocks `task 1` from matching a `task 11` note; dotted ids (`1.1`) are regex-escaped. Sound.
- Challenge "newest wins across all runs" (D8): the ledger is append-only, so the last matching line
  is newest. Sound.

## Attack 4 — C9 retained view / the `answer` stage

- Stress-test R1 AC 7 ("return to board when the wait leaves for a reason other than this view's own
  answer"), which the requirements marked a base invariant at `HomePage.tsx:149-152` — C9 rewrites
  that derivation. The new rule ("live wait, else the snapshot only while `stages.stages` holds the
  key, else null") still returns to the board for an answered-elsewhere/expired/disabled wait,
  because the `wait:<id>` stage key exists only after *this* view presses Answer. The invariant is
  preserved; the rewrite is covered only by the e2e, not a unit test, but that is acceptable (the
  pure `ruling.ts`/`stage.ts` seams are unit-tested, the wiring is a browser case). Not a defect.
- Confirm `resolved` stays exhaustive: adding `case 'answer'` to the switch (no `default`, boolean
  return) keeps TS happy; `advance`'s `confirm`-only branch does not touch `answer`, so the generic
  running→done + 30 s-timeout path applies. Sound.

## Attack 5 — decomposition "should address" coverage

All four named points are addressed: detail/diff caps (D4, C2, C6), rebase-spanning commits (C6
`cat-file -e` → not-found, R4 AC 6), document-phase `error` layout (C8 `taskless`, R5 AC 7),
design-defect-vs-security layout (C8 `rulingLayout`). The `NowPage.tsx`→`AnswerSheet.tsx` and
`waitAnd`-location discrepancies the entry names are called out in Scope notes. No scope gap.

## Closing deliverables

**Top risks/gaps (ranked):**
1. M1 — the `%h` = 7-character behaviour claim is false in this repo (8 chars). [MUST_FIX, drafting]
2. (fine) C9's retained-view rewrite of an R1-AC-7 base invariant rests on the e2e alone — low risk
   because the answered-elsewhere path still clears the key; no change asked.
3. (fine) `readWaitDiff`'s shared budget leaves the `remaining ≤ 0` guard implicit; a timeout kill
   returns `unreadable` and ends the request before that matters. Implementation detail.

**Top 3 conclusions to challenge:** none reverse. The three I pressed — report-scope (C2), the
retained-view invariant (C9), and the two-way execFile failure discrimination (C6) — each held up
against code and a live probe.

**What's missing before acting:** only the M1 wording fix. Everything else the document carries
toward tasks is grounded: citations, probes, data-model shapes and error-branch discriminants all
verify.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
