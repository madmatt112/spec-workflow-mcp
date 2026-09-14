# Adversarial Analysis — review-gate/requirements (v4)

Round: R4. Primary lens: completeness, ambiguity, scope. Fresh lens this round: every
`path:line` / `path:start-end` citation re-opened and its first and last line confirmed
against the document's claim, prioritising citations the v2/v3/v4 deltas added or moved.
Attack order: the v4 deltas (R3-1, R3-2, R3-3) first, then the citation sweep and a
completeness pass.

## Delta verification (attacked first)

The v4 Revision History records three round-3 dispositions (R3-1, R3-2, R3-3), all
accepted. I re-read both ends of every citation the fix touched and traced each fix into
the code.

- **R3-1 — resolved and sound.** AC 1.3 now says `data.typecheck` on the files-only path
  is `{ kind: 'skipped' }` "(not added to the union at `src/tools/review-task.ts:45-52`)";
  AC 1.6 types it "`TypecheckMethodologyState`, `src/tools/review-task.ts:45-52`, or
  files-only `{ kind: 'skipped' }`". Verified: 45-52 is exactly the seven-member
  `TypecheckMethodologyState` union (line 45 `export type …`, line 52 `| { kind: 'timeout' };`).
  `renderTypecheckDirective` at `:793-810` is still a `switch (state.kind)` over the same
  seven members, `no default`, no trailing return, declared `: string | null`. Keeping
  `skipped` out of the union leaves the switch exhaustive, so TS2366 does not fire and the
  first build stays green (Requirement 9). The gate never feeds `{ kind: 'skipped' }` to
  `renderTypecheckDirective` (that renderer serves `prepare`/verifier methodology only), so
  the widened response-boundary type introduces no new exhaustive consumer. Fix is correct.
- **R3-2 — resolved and consistent.** AC 9.2 now gives task 2 a review via `prepare`/
  `record` (5.2) and task 3 a review via fix-and-re-gate (5.1). `spec-status` review
  coverage counts a completed task as reviewed when `getLatestReview(task.id)` is non-null
  (`src/tools/spec-status.ts:184-191`, verified: the per-completed-task loop, `reviewed++`
  when `latest` truthy). All three tasks now leave a review file, so "reports all three
  reviewed once completed" is reachable. No contradiction with case 3's "no review file
  exists" (that assertion is the pre-fix state; the record follows the fix). Fix is correct.
- **R3-3 — resolved, citation accurate.** AC 6.3 now cites
  `harness/skills/sdd-implementation-phase/references/briefs.md:133-137`. Verified: 133-137
  is the narrow-verification paragraph ("The narrow verification after adjudication
  (`verify-brief-task-<N>-narrow.md`) adds: 'Verify only the findings listed below …
  Record the review the same way. …'"), i.e. the exact template the terminus verifier uses,
  and it sits outside AC 6.5's edited 112-131 range. Fix is correct.

No misstated artifact in the v4 delta. As in R2 and R3, the delta citations are accurate.

## Fresh-lens result — every cited artifact re-read at both ends (checked clean)

I opened each range below and confirmed the first and last line matches the claim:

- `review-task.ts` — `179-183` action enum `['prepare','record']`; `224` `required:
  ['action','specName','taskId']`; `251-260` action dispatch; `45-52` typecheck union;
  `54-73` `computeTypecheckMethodologyState`; `357-366` implementation-log requirement;
  `440-449` the three concurrent pre-computations (typecheck/hygiene/`computeTaskDiff`);
  `463-499` prepare response `data`; `521-569` record validations; `743-791` byte-pinned
  R4 prose constants; `793-810` `renderTypecheckDirective`. All accurate.
- `task-review-manager.ts` — `62-66` `getNextVersion`; `71-103` marker write/check/remove
  (removal ignores a missing marker, so AC 5.1's "SHALL NOT require or leave a prepare
  marker" holds for the direct `saveReview` path); `108-132` `saveReview`; `185-234`
  serializer (ends `return md;`); `236-311` parser (`get()` returns `''` for a missing key,
  so AC 5.3/D7's "no key ⇒ `reviewer: agent`" is a real default the parser must add — the
  current `307` return object omits `reviewer`). All accurate.
- `types.ts:253-262` `TaskReview` — eight fields, no `reviewer` (correct, needs the field).
- `get-task-review.ts:103-113 / 126-141` — both return the whole `review` in `data.review`;
  `reviewer` travels automatically, nextSteps unchanged. Accurate.
- `typecheck.ts` — `8-15` `TypecheckDiagnostic` with `inScope`; `17-47` `TypecheckResult`
  (`feature-disabled` at 39); `49` `TIMEOUT_MS = 30_000`; `124-140` `runProjectTypecheck`.
  `hygiene-signals.ts:4-19` (four patterns) and `46-50` (`computeHygieneSignals`). Accurate.
- `task-diff.ts` — `135-234` `computeTaskDiff` (135 signature, 234 closing `}`, next fn at
  236, so AC 8.3's "new function beside `computeTaskDiff`" range is exact); `169-170` the
  `git diff -U10 -M HEAD` / `--numstat` pathspec. `git-utils.ts:45-50` `scrubbedGitEnv()`.
  Accurate.
- `task-parser.ts:174-298` — `endLine` (line 175) is the *next checkbox index*, and the
  metadata loop runs `lineNumber+1 … endLine`. This confirms AC 3.3's precise claim that
  the block runs "through the line before the next checkbox line — headings … do not bound
  it". Accurate.
- `root-selection.ts:202-209` `selectRoots` (no override ⇒ both roots from context);
  `spec-status.ts:179-193` review-coverage loop. Accurate.
- Harness: `sdd-verifier.md:12-14` (three `review-task` names), `:26` ("For a task
  review …") vs the separate E2E rule at `:28`; impl `SKILL.md` per-task loop `71-72`,
  `77-79`, `84-88`, `89-96`, `97-102`, completion gate `126-139`; impl `briefs.md:112-131`
  (line 124 "Run the task's checks yourself"), `133-137` (narrow brief); close-out
  `SKILL.md:66-72`/`118-120`/`121-124`/`125-131`/`132-135`, `briefs.md:5-14` (checks per
  class) and `112-138` (verify brief). All accurate.
- Scope sources: `plan:176` ("R1 Deterministic gate …"), `plan:8-9` (goal), `plan:126-128`
  (conservative default), `plan:164-167` (step 4 measures skipped spawns); decomposition
  entry 4 `64-100`. All accurate.

## Attack topics and directives

### Topic A — AC 9.2 states outcomes but not the range inputs that produce them
- Challenge that case (1) "Markdown-only edit ⇒ `pass`, `low`" is reachable: `risk` is
  `low` only if the gate call carries `baseRef` or `commit`; with a bare `specName`+`taskId`
  call, AC 3.1f (task, all of `baseRef`/`commit`/`files` absent) forces `high`.
- Stress-test that all three cases silently assume a range argument the AC never names.

### Topic B — `home` item with no path in its text or `Target:` line (AC 7.1/7.2)
- Challenge the assumption that every `home` item yields a non-empty `files`.
- Stress-test the boundary between AC 1.3's files-only path (skip pre-computations, trivial
  pass) and AC 1.5/1.8's "an item gate SHALL require `commit` or `files`" (→ `success:false`)
  when `files` resolves empty; AC 7.3 has no branch for a gate that could not run.

### Topic C — decomposition case-2 fidelity (checked, not a defect)
- The decomposition's e2e case 2 asks the fixture to prove "the implementation skill's
  verifier brief for it carries the gate's results"; AC 9.2 case 2 verifies risk `high`
  plus a `prepare`/`record`. This is not a gap: the "brief carries the results" behaviour is
  skill orchestration (AC 6.5), which a vitest tool-test cannot exercise, and the payload
  fields it copies (`data.reasons/stats/touched/typecheck`) are produced by R3/R4 rules
  that AC 9.1 unit-tests. Correctly separated; no finding.

## Findings

### R4-1 — MINOR — AC 9.2 names per-case risk outcomes but not the range inputs that yield them — Novel
AC 9.2 case (1) expects "`pass`, `low`" for a Markdown-only edit. Risk is `low` only when
the gate call supplies `baseRef` or `commit`; otherwise AC 3.1f (`taskId` is a task and
`baseRef`, `commit`, `files` all absent) forces `high`, and case 1 fails. The AC states no
range argument for any of the three cases, so a literal reading ("call gate with
`specName` and `taskId`") produces `high` everywhere. Low cost — 3.1f is prominently
defined and any implementer will pass a `baseRef` — but the acceptance test's own inputs
are unstated. **Fix (no net words):** in AC 9.2 replace "a Markdown-only edit ⇒" with "a
Markdown-only edit gated with a `baseRef` ⇒". No cut needed (net zero).

### R4-2 — MINOR — `home` item with no named path leaves the item gate under-specified — Novel
AC 7.1 sets `files` = "any paths the item's text or `Target:` line names"; "any" permits
zero. AC 7.2 then relies on a non-empty `files` ("the gate SHALL check that every listed
path exists under `root`"). With empty `files`, no `commit`, no `baseRef`, the call sits on
the seam between AC 1.3's files-only path (skip pre-computations, no checks for `home` per
`briefs.md:5-14`, trivial `pass`) and AC 1.5/1.8's "an item gate SHALL require `commit` or
`files`" (→ `success:false`), and AC 7.3 defines no branch for a gate that could not run.
In practice a `home` item resolves to that class only because its target names
memory/CLAUDE.md/settings (else it is class `none`, "unclear target"), so a path is
normally derivable — hence MINOR, not a live blocker. **Fix:** state in AC 7.2 that a
`home` item with no named path closes as today without a gate call (mirroring 7.5), or that
empty `files` is treated as the files-only trivial pass.

## Top 3 risks / gaps

1. **R4-1** — the one named e2e test can be coded to the letter and still fail case 1,
   because AC 9.2 omits the `baseRef`/`commit` that keeps risk `low`. Cheap wording fix.
2. **R4-2** — a `home` close-out item that names no path has undefined gate behaviour and
   no routing branch. Edge, but genuinely unspecified.
3. **Standing (unchanged from R2/R3):** a resumed `[-]` task has no `baseRef` and is forced
   to `risk: high` (6.1/3.1f); every interruption spends a verifier against the baseline.
   Accepted design cost, not a defect.

## Top 3 conclusions to challenge or reverse

1. AC 9.2's implicit conclusion that the case outcomes fully specify the test. Challenge:
   they specify outputs, not the range inputs; case 1 needs a `baseRef` to be `low` (R4-1).
2. AC 7.2's conclusion that a `home` item always presents a `files` list. Challenge: AC 7.1
   allows zero paths, and the empty case is unrouted (R4-2).
3. (Not reversed) The R3-1 fix's conclusion that leaving `skipped` out of the union avoids
   touching methodology code. Confirmed correct against `:45-52` and `:793-810`.

## What's missing (do before acting on this document)

- Name the range argument (a `baseRef` or `commit`) for AC 9.2's three cases, or at least
  case 1, so the e2e test's inputs are unambiguous (R4-1).
- Define the `home` item gate when no path is named — trivial pass or close-as-today (R4-2).
- Nothing else. The v4 deltas are sound, every citation re-read matches the code, and the
  risk/recording lattice, root threading, verifier-scope, and cost-of-touch analyses from
  R1–R3 remain valid.

## Word budget note

Document is 3,491/3,500 words (`wc -w`). Both findings are MINOR and neither is required to
converge. R4-1's fix is net-zero (word swap). R4-2's fix adds ~12 words; if taken, reclaim
them from D10's tail ("last output line") or D11's justification, per the R3 note.

## Verdict

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
