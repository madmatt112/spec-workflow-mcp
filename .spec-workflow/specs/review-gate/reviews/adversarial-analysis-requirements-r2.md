# Adversarial Analysis — review-gate/requirements (v2)

Round: R2. Primary lens: completeness, ambiguity, scope. Fresh lens this round: a cold
read for internal contradictions plus a truth table over (gate pass|fail) × (risk
low|high) × (task names tests|not) × (sensitive path|not) × (files-only item|git-repo
task). Attack order: the v2 deltas first, then the fresh lens.

## Delta verification (attacked first)

The v2 Revision History records eight round-1 dispositions, all accepted. I re-read both
ends of every citation the delta added or changed. Result of the citation spot-check:

- **AC 3.3 re-cite `task-parser.ts:174-298` — correct; R1-1 resolved.** Line 174 is
  `const lineNumber = checkboxIndices[idx];`, 175 is
  `const endLine = idx < checkboxIndices.length - 1 ? checkboxIndices[idx + 1] : lines.length;`,
  and the metadata loop (`for (let lineIdx = lineNumber + 1; lineIdx < endLine; …)`) runs
  to `endLine`, closing near 297. The block is bounded by the next *checkbox*, and the
  revised prose ("headings between two tasks do not bound it") now matches. Clean.
- **AC 6.5 `sdd-verifier.md:26` — correct; R1-5 resolved.** Line 26 is the "For a task
  review" standing bullet and contains "run the task's checks yourself". AC 6.5's line-124
  citation into the impl verifier brief is also correct ("   Run the task's checks
  yourself."). But see R2-3 for the interaction it creates.
- **AC 7.6 `sdd-closeout-phase/SKILL.md:121-124` and `references/briefs.md:112-138` —
  correct; R1-3 resolved.** 121-124 is the close-out Verify step; 112-138 is the verify
  brief template, which today lists every item and says "run the checks listed". See R2-4.
- **AC 4.6 `typecheck.ts:124-140` — correct; R1-4 resolved.** The signature returns
  `Promise<TypecheckResult[]>` and 4.6 now states the per-result reduction.
- **AC 1.2 `root-selection.ts:202-209` — citation correct**, but the sentence it adds
  contradicts AC 1.3. See R2-1.
- **AC 6.3 terminus, AC 7.7 close-out ledger note — citations
  (`SKILL.md:89-96`, plan `164-167`) correct; R1-6/R1-7 addressed.** But R2-3 flags an
  unresolved interaction of the terminus with the R1-5 fix.

No misstated artifact in the delta. All eight round-1 fixes land as claimed. The new
findings below are all consequences of the delta fixes not fully closing.

## Attack topics and directives

### Topic A — AC 1.2 "root governs only git, checks and `data.touched`" vs AC 1.3
- Challenge the word "only" in AC 1.2: AC 1.3 runs the typecheck and the hygiene scan
  "in `root`", so `root` also governs two things 1.2's exhaustive list omits.
- Stress-test the close-out case where `root` ≠ the context workspace: class `code`
  lands in `MAIN_CHECKOUT`, class `harness` in `HARNESS_REPO` (`SKILL.md:66-72`), neither
  the spec-store checkout. Under 1.2 the typecheck/hygiene would run against the wrong
  tree.
- Force one statement of which tree `runProjectTypecheck(workspacePath, workflowRoot,…)`
  compiles and which `root` it receives; today prepare passes `(workspacePath, projectPath,…)`
  (`review-task.ts:441`).

### Topic B — The files-only item gate (AC 1.3 carve-out) vs the AC 1.6 response contract
- Challenge that the R1-2 carve-out is complete: AC 1.3 skips the three pre-computations
  for a files-only item gate, but AC 1.6 still mandates `data.stats`, `data.typecheck`,
  `data.hygiene` and `data.touched` on every response.
- Stress-test a class `home` gate (`files`, no `commit`): `data.stats.filesChanged` has no
  git source, `data.typecheck` is a union `kind` with no value for "skipped",
  `data.touched` (1.4) comes from git that never ran.
- Force a defined value (null / zero / a sentinel `kind`) for each field on the files-only
  path, since 1.7's drift rule has the orchestrator read the response.

### Topic C — The gate-fail terminus (AC 6.3) vs the changed verifier rule (AC 6.5)
- Challenge that AC 6.3 "reuses the same cap path unchanged": the cap path's narrow
  verification (`SKILL.md:93-95`) runs `prepare`/`record` under the verifier standing
  rule at line 26, which AC 6.5 changes to "run only checks the gate did not run".
- Stress-test the terminus trigger: the gate fails because a task's *own* checks fail; the
  terminus verifier is then told not to run exactly those checks.
- Force a statement of whether the terminus narrow verifier re-runs the failing gate
  checks (it must, to confirm the adjudicator's resolution) or not (per the new rule).

### Topic D — Close-out Verify step for an all-low batch (AC 7.4 vs AC 7.6)
- Challenge that AC 7.6 fully edits `SKILL.md:121-124`: it drops store/home items and, for
  a high-risk batch, briefs only high-risk items — but never says the Verify spawn is
  skipped when no high-risk item remains.
- Stress-test a class `code` batch whose items all pass at `risk: low` (7.4 ⇒ each `ok`):
  the unedited step 4 unconditionally spawns `sdd-verifier`; 7.6 gives it nothing to brief.
- Force the skip condition into 7.6 so the token saving actually lands for low-risk code
  and harness batches.

## Findings

### R2-1 — MUST_FIX — AC 1.2 contradicts AC 1.3 on what `root` governs — Compounding
AC 1.2 (a v2 addition) states: "`root` governs only git, checks and `data.touched`." AC
1.3 states the gate "SHALL run, in `root`, the three pre-computations … the project
typecheck (`typecheck.ts:124-140`), the hygiene scan (`hygiene-signals.ts:46-50`) and diff
statistics." The typecheck and the hygiene scan are neither "git", "checks", nor
"`data.touched`", yet 1.3 runs them in `root`. The two acceptance criteria enumerate
`root`'s scope incompatibly. This is not cosmetic: in close-out, `root` is the batch's
landing root (AC 7.1) — `MAIN_CHECKOUT` for class `code`, `HARNESS_REPO` for class
`harness` (`SKILL.md:66-72`) — which is not the context workspace. An implementer who
takes 1.2 literally threads `root` into git/checks/`data.touched` only and leaves
`runProjectTypecheck` / `computeHygieneSignals` pointed at the context workspace
(`review-task.ts:441,443` pass `workspacePath`), so a close-out `code` gate typechecks and
hygiene-scans the spec-store checkout instead of the landed change — a false gate result.
The memory's guidance predicted exactly this thread ("re-check the typecheck/workflow-root
arguments for close-out … a coherent second root when `root` is a foreign repo").
Fix: correct AC 1.2 to say `root` is the working tree for the pre-computations, git,
checks and `data.touched`, and that only `agent-rules.md` (2.1) and the review store (5)
come from the workflow root; and state which value the gate passes as `runProjectTypecheck`'s
second (`workflowRoot`) argument when `root` is foreign.

### R2-2 — SHOULD_FIX — Files-only item gate leaves the AC 1.6 response contract undefined — Compounding
The R1-2 fix carved a files-only item gate out of AC 1.3: "the gate SHALL skip these three
pre-computations and run only `checks` plus the path-existence check (4.1e)." But AC 1.6
still requires every response to carry `data.stats` (`filesChanged`, `linesAdded`,
`linesRemoved`), `data.typecheck` (a methodology-state `kind`, `review-task.ts:45-52`),
`data.hygiene` (signal counts) and `data.touched` (git-derived, 1.4). For a class `home`
gate (`files`, no `commit`, no `baseRef`) none of those has a source: git never ran, the
typecheck and hygiene scan were skipped. AC 7.2 pins only `data.risk` (low, not scored);
the other four fields are undefined. `data.stats.filesChanged: 0` would be a lie for a home
item that edited files; `data.typecheck` has no union member for "skipped". The harness
home path (7.2/7.3/7.7) does not read these fields, so this will not wedge the flow, but
the tool's response schema is unspecified for a whole class of calls and the end-to-end
fixture (9.2) cannot assert them. Fix: state each field's value on the files-only path
(e.g. `data.stats: null`, `data.typecheck: { kind: 'unavailable-feature-disabled' }` or a
new `skipped` kind, `data.hygiene: {}`, `data.touched` = the listed `files`).

### R2-3 — SHOULD_FIX — The terminus verifier is told not to run the checks it exists to verify — Compounding
AC 6.3 defines the terminus: after three gate fails, "adjudicator, then one narrow verifier
round via `prepare`/`record` — the sole exception to 'gate fail spawns no verifier.'" That
narrow round is the existing cap path (`SKILL.md:93-95`: `sdd-adjudicator`, then "one
narrow verification … `review-task` `prepare` and `record` again"), and every `prepare`/
`record` task review runs under the verifier's standing rule at `sdd-verifier.md:26`, which
AC 6.5 changes to "run only checks the gate did not run." The terminus fires *because* the
task's own checks keep failing (a red test, or the D8 whole-file `debugger` wedge from
R1-7). So the terminus verifier — the loop's only exit — is instructed to skip exactly the
failing checks it needs to run to confirm the adjudicator's resolution. AC 6.3 (verify the
mechanical fix) and AC 6.5 (don't re-run gate checks) collide on this one path. Fix: state
in AC 6.3 that the terminus narrow verifier re-runs the gate's failing checks (an explicit
carve-out from the 6.5 rule), or that the adjudicator's disposition is final without a
re-run.

### R2-4 — SHOULD_FIX — Close-out Verify spawn is not made conditional for all-low batches — Compounding
AC 7.6 edits the close-out Verify step (`SKILL.md:121-124`) to "drop `store`/`home` items
(7.3) and, for a high-risk batch, brief only the high-risk items." It never says the Verify
spawn is *skipped* when, after dropping `store`/`home`, no high-risk `harness`/`code` item
remains. Concrete case: a class `code` batch of two items, both `gate: pass`, `risk: low`.
AC 7.4 makes each item `ok` with no verifier, but step 4 (`SKILL.md:121-124`) today
unconditionally writes a verify brief and spawns `sdd-verifier`; 7.6 leaves that spawn in
place with an empty item list. An implementer following the ACs literally either spawns a
verifier that reviews nothing or must infer the skip from 7.4 — the exact "behaviour
described, edits not named" asymmetry the memory flagged. This is where close-out's largest
saving sits (a low-risk code batch should cost zero verifier spawns). Fix: state in 7.6
that the Verify step spawns no verifier when the post-drop high-risk set is empty, parallel
to 6.4.

### R2-5 — MINOR — Two imprecisions worth a line each
(a) AC 1.3 calls the range diff one of "the three pre-computations `prepare` runs today
(`review-task.ts:440-449`)", but AC 8.3 and AC 1.4 make the gate's diff a *new* range
function beside `computeTaskDiff` (working-tree-vs-`HEAD`); only the typecheck and hygiene
are literally reused. Reword 1.3 so "prepare runs today" attaches only to the two reused
pre-computations. (b) AC 9.2 case (1) "a Markdown-only edit ⇒ `pass`, `low`" holds only if
the fixture's typecheck returns `success` or `feature-disabled`; a Markdown-only change
with typecheck `unavailable` for any other reason is `risk: high` (3.1e). Name the fixture's
typecheck posture. Neither keeps the loop alive on its own.

## Fresh-lens truth-table result

I walked every cell of (gate pass|fail) × (risk low|high) × (names tests|not) ×
(sensitive|not) × (files-only|git task). The routing lattice is otherwise sound: gate
fail ⇒ no record (4.5) + fix round (6.3); pass+low+task ⇒ record `reviewer: gate` (5.1) +
complete `outcome=gate` (6.4); pass+high ⇒ no record (5.2) + verifier (6.5); files-only
item ⇒ no record (1.5) + store/home route (7.3). The four recording paths are disjoint and
total, and every recorded verdict, ledger note (6.6/7.7) and skill next step is determined
— **except** where R2-1 (which tree the pre-computations use) and R2-2 (the files-only
response fields) leave a cell undetermined, and R2-3/R2-4 where two criteria determine the
same cell incompatibly. The word/test-file rule (3.3), sensitive-path override for home
(7.2 over 3.1a), and the empty-diff → high → verifier path (3.1d/D11/6.5) all resolve to
exactly one path.

## Top 5 risks / gaps

1. R2-1 — a close-out `code`/`harness` gate typechecks and hygiene-scans the spec-store
   checkout instead of the landed change, producing a false gate verdict on real code.
2. R2-3 — the gate-fail loop's only exit verifies without running the failing check, so a
   persistent mechanical fail (red test, pre-existing `debugger`) closes on no evidence.
3. R2-2 — the files-only (`home`) gate — the whole point of the R1-2 carve-out — has an
   undefined response schema for four of its `data` fields.
4. R2-4 — a low-risk close-out batch still spawns a verifier, so the close-out saving the
   plan counts (step 4, `plan:164-167`) does not actually land for all-low batches.
5. Standing (R1 top-3 #3, unchanged): a resumed `[-]` task has no `baseRef` and is forced
   to `risk: high` (6.1/3.1f) — every interruption returns spend toward the baseline.

## Top 3 conclusions to challenge or reverse

1. AC 1.2: "`root` governs only git, checks and `data.touched`." Reverse. `root` must also
   be the working tree for the typecheck and hygiene scan (AC 1.3), or close-out reviews
   the wrong repository. The "only" is false as written.
2. The implied conclusion that the R1-2 carve-out fully specifies the item gate. Challenge:
   1.3 removed the pre-computations from the files-only path but 1.6 still demands their
   outputs; the item-gate response is under-specified, not done.
3. AC 6.3: the terminus "reuses the same cap path unchanged." Challenge: the path is *not*
   unchanged — AC 6.5 rewrote the verifier rule that path runs under, and the rewrite
   disables the terminus verify for the gate-fail case it must handle.

## What's missing (do before acting on this document)

- Correct AC 1.2's `root` scope and state the `runProjectTypecheck` `workflowRoot`
  argument for a foreign close-out `root` (R2-1).
- Define the files-only item-gate values of `data.stats`, `data.typecheck`, `data.hygiene`
  and `data.touched` (R2-2).
- State whether the terminus narrow verifier re-runs the failing gate checks (R2-3).
- State the skip condition for the close-out Verify spawn when no high-risk item remains
  (R2-4).

## Word budget note

The document is at 3,499/3,500 words; R2-1/R2-2/R2-4 each need a clause. Cut source: the
Scope-notes bullet "This repository's `agent-rules.md` already has a `## Sensitive paths`
list; no change needed" (14 words) duplicates AC 2.1's citation and the codebase context,
and the D12 restatement in Scope notes ("The completion gate and PR checks gate stay as
they are (Decided)") duplicates AC 6.8. Reclaim the words there.

## Verdict

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 3
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
