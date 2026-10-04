# Document-phase convergence checks

The checks and corrective passes the core skill routes to from Step 2 item 8 (an
`iterate` with fuel at round 2 or later, or at D ≥ 4), from the SHOULD_FIX-only route
(**Step 4b**), and from a Step 0 `nextStep` of **Step 4a** or **Step 4b**. Round 1 goes
straight to Step 3: no check here can fire then. Every brief comes from a `harness`
`brief` server kind, and all bookkeeping — ledger rows, retro entries, commits, document
edits — goes through `book.sh` as the core skill's **Bookkeeping** rule describes.

## Standoff check

A standoff is one finding that the reviewer marks **Recurring** and **MUST_FIX**, and
that the reviser **rejected in the two most recent consecutive rounds**. Detect it with
your rejection tally and `grep -n -i 'recurring' <analysis>`.

When you find one, rule on it yourself: accept or reject on the merits, in one
paragraph. Append to the document's Revision History, under the current version's
line, one bullet `- **Ruling — <finding id>: <accepted | rejected>.** <reason>`
(through `book.sh` `edit`). Append a retro-log entry through `book.sh` (`retro`,
`ruling`). Add the finding to the "Closed by ruling" list (the reviewer's
`closedByRuling` value and the reviser's) for every later round of this phase. If you
accepted it, it becomes a finding for the next reviser brief.

## Circling check

Review is circling when the substantive findings — every MUST_FIX and SHOULD_FIX — of
the two most recent consecutive rounds all concern one requirement or one rule: the round
is re-litigating that single item against a fixture, where an adjudication resolves it
faster than another review round. It needs two rounds, so it cannot fire on round 1.
Detect it from the two analyses' finding lines (`grep -n -E 'MUST_FIX|SHOULD_FIX'
<analysis>` for round `A` and round `A-1`) and the requirement or rule each names; the
condition holds only when both rounds name the same single item and nothing else.

When it holds, adjudicate that item instead of spawning another review round. This may
fire before D ≥ 4; the v4 cap in the Cap convergence check and Step 4a is unchanged.

1. Call `harness` `brief` with `template: adjudicator`, `specName: <SPEC>`, and `values`
   carrying `path: reviews/adjudication-brief-<PHASE>-r<A>.md`, `items` (every open
   MUST_FIX and SHOULD_FIX for that requirement or rule by id, title and severity, one per
   line), `phase: <PHASE>`, `docPath: <document path>`, `D: <D>` (the reviewed version),
   `analysisPath: <r<A> analysis path>`, `mustFix: <open MUST_FIX count>`, `shouldFix:
   <open SHOULD_FIX count>`, `specDir: <spec dir>`, `memoryPath: <memory file path>`,
   `codeRoot: <CODE_ROOT>`, and the graph values when `GRAPH` is a path.
2. Spawn `sdd-adjudicator` with `Read and execute the instructions in <brief path>`. After
   its report write one `spawn.usage` carrying `role="adjudication r<A>"` and its result
   through `book.sh` (`event`).
3. Spot-check: `grep -n -E '^- \*\*v<D+1>\*\*' <document>` finds the new line.
4. From the report's `ruled-out` key, list the **ruled-out SHOULD_FIX** items (id and
   title); keep them as carried items for the HANDOFF section in Step 6.
5. Checkpoint commit through `book.sh` (`commit`): `docs(sdd): <SPEC> <PHASE> v<D+1>
   circling adjudication`.
6. Append a retro-log entry through `book.sh` (`retro`, `inefficiency`: review circled one
   item for two rounds; every item id with `fixed` or `ruled out`).
7. D = D + 1. Go to Step 4b (narrow check on the adjudicated items), then Step 5.

## Cap convergence check

At the cap — an `iterate` with fuel at D ≥ 4 — a converging run earns one more review
round instead of an adjudicator spawn. Grant it, once per phase, only when the last
round's `MUST_FIX` count strictly decreased from the round before it (compare the two
most recent `round` ledger `verdict=` counts, or your per-round task list). When it
decreased and the extra round is not yet spent: note in your task list that the cap's
one extra round is spent, then run the **Standoff check** and Step 3 — a normal revise
and review round. Otherwise — `MUST_FIX` flat or rising, or the extra round already
spent — go to Step 4a. The extra round still obeys `BUDGET` (Step 2, item 1) (retro P11/G3).

## Step 4a — Cap: corrective pass at v(D+1)

Reached when the fourth reviewed version (or a later one) still has `MUST_FIX` or
`SHOULD_FIX` above zero. Nothing reviews the corrective version again.

1. Call `harness` `brief` with `template: adjudicator`, `specName: <SPEC>`, and `values`
   carrying `path: reviews/adjudication-brief-<PHASE>.md`, `items` (every open MUST_FIX and
   SHOULD_FIX from the r<A> analysis by id, title and severity; `grep -n -E
   'MUST_FIX|SHOULD_FIX' <r<A> analysis>` gives the lines, read only those), `phase:
   <PHASE>`, `docPath: <document path>`, `D: <D>` (the reviewed version), `analysisPath:
   <r<A> analysis path>`, `mustFix: <open MUST_FIX count>`, `shouldFix: <open SHOULD_FIX
   count>`, `specDir: <spec dir>`, `memoryPath: <memory file path>`, `codeRoot:
   <CODE_ROOT>`, and the graph values when `GRAPH` is a path.
2. Spawn `sdd-adjudicator` with `Read and execute the instructions in <brief path>`.
3. Spot-check: `grep -n -E '^- \*\*v<D+1>\*\*' <document>` finds the line and it
   contains `Post-cap corrective pass`.
4. From the report's `ruled-out` key, list the **ruled-out SHOULD_FIX** items (id and
   title). They are the carried items for the next phase: keep them for the HANDOFF section
   in Step 6. Also carry every MINOR from the r<A> analysis the cap leaves unaddressed —
   rejected only because the word cap forbids the extra words — by id and title with the
   reason `word cap` (retro P11).
5. Checkpoint commit through `book.sh` (`commit`): `docs(sdd): <SPEC> <PHASE> v<D+1>
   post-cap corrective pass`.
6. Append a retro-log entry through `book.sh` (`retro`, `inefficiency`: cap hit; every item
   id with `fixed` or `ruled out`).
7. D = D + 1. Go to Step 4b.

## Step 4b — Narrow check

1. Call `adversarial-review` (no `verdictBlock`); keep `promptOutputPath`,
   `analysisOutputPath`. Call `harness` `brief` with `template: checker`, `specName:
   <SPEC>`, and `values` carrying `path: <promptOutputPath>` (write mode, over the
   scaffold), `phase: <PHASE>`, `items` (the items the corrective pass fixed — Step 4a's
   adjudicated items, the Circling check's adjudicated items, or the SHOULD_FIX-only pass's
   SHOULD_FIX items, one per line `<id> — <title>`), `specDir: <spec dir>`, `codeRoot:
   <CODE_ROOT>`, `D: <D>` (the corrective version the pass produced), `docPath: <document
   path>`, `analysisPath: <r<A> analysis path>`, `analysisOutputPath: <the
   analysisOutputPath this call's adversarial-review returned>`, and the graph values when
   `GRAPH` is a path. The server writes the narrow-check prompt and appends the code graph
   block; you do not read the prompt file.
2. Spawn `sdd-checker` per the standing spawn rule, with exactly `Read and execute the
   instructions in <promptOutputPath>` as the launch message.
3. Read the checker's report block. If it lacks its block the checker stalled: spawn it
   once more from the same prompt file; a second report still missing its block ⇒
   `PHASE: error`. Never accept a `verified` key without its `analysis` file. From the
   `analysis` path, read `grep -n '^VERIFIED:' <analysis>` and, if present, the lines from
   `## Deferred findings` to the end (`sed -n '/^## Deferred findings/,$p'`). Copy each
   deferred finding into the retro log through `book.sh` (`retro`, `gotcha`, evidence = the
   analysis path).
4. Go to Step 5. Approval always follows the narrow check, whatever `k/n` says; the
   count goes into the approval response.
