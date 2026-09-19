# Adversarial Analysis — worktree-review-signals/requirements (v3, Round 2)

Primary attack surface: completeness, ambiguity, scope. Fresh lens for this round: a cold
read for internal contradictions plus a truth table of the stated cases — every
combination of record-key, workspace, base-provenance and typecheck-outcome checked for
exactly one stated behavior across Req 1, 3, 4 and 7. Round 1 used the wire-contracts
lens; not repeated. Deltas since v2 (the R1-1..R1-4 fixes) attacked first.

## What I verified in code (work shown)

Read both ends of every range the v3 delta touched. All delta citations are exact:

- **R1-1 (AC 10 re-anchor).** `MAX_BUFFER = 16 * 1024 * 1024` is at `src/core/task-diff.ts:30`
  (the 16 MB git-diff buffer), and `TOTAL_BYTE_CAP = 50_000` at `:32`. The bare `:30`
  from v2 now reads `src/core/task-diff.ts:30` explicitly — the correct file and line.
  `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` is detected at `src/core/typecheck.ts:478`
  (`const overflow = errCode === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER';`) — exact. The `!ok`
  arm at `task-diff.ts:191-193` returns `{ diff:'', stats:undefined, skippedPaths, truncated:false }`
  with no rejection — exact. R1-1 is closed correctly.
- **R1-3 (Migration runGit note).** `runGit` occupies exactly `src/core/task-diff.ts:50-62`
  and resolves `{ stdout, ok: !err }`, discarding `err`/`err.code` — confirming the v2
  premise. The new Migration clause "`runGit` … gains an error-cause field (Requirement 1
  AC 10)" names the exact helper and range. R1-3 is closed at the Migration level, which is
  adequate for a requirements doc: AC 10 states the requirement ("naming the observed
  cause"), Migration acknowledges the helper change it depends on.
- **R1-4 (`recorded` provenance).** AC 6 now assigns `recorded` to the validated-base diff;
  AC 5 (Req 4) now renders `head-expected` **or** `recorded` as a fact with no directive;
  Req 7 AC 1 and Migration use `recorded`. The provenance enum is now complete
  (`recorded`, `head-expected`, `head-degraded`) and each value has a defined disclosure
  behavior in AC 5. R1-4 is closed.
- **R1-2 (record schema).** Req 3 AC 3 now states the schema in prose ("one record per task,
  base keyed by workspace and attribution shared"); AC 4 (Req 1) now scopes "the reviewing
  workspace only" to "the base entry" and states attribution is read regardless of
  workspace. The hard contradiction from R1-2 is resolved. One residual wording gap remains
  (R2-1, below).
- **Supporting citations.** `ProjectContext.workspacePath` is `project-manager.ts:14`
  (exact); the status route is the `PUT …/tasks/:taskId/status` handler at
  `multi-server.ts:1417` handling `'in-progress'` (exact); the `data` literal is
  `review-task.ts:494-511`, the `computeTaskDiff` production caller `:473` (exact);
  `TypecheckResult` (`typecheck.ts:17-47`) has `success`, `unavailable` (reasons include
  `tsc-not-found`, `feature-disabled`) and `timeout` — so AC 5's "unavailable or timeout"
  covers the `tsc-not-found` reason without a gap. Body word count ≈ 3,495, at the stated
  cap.

### Lint findings handed to me for judgment (L-2, L-35..L-38)

Rule applied: an identifier the criterion **introduces as new behavior** is not a defect;
one it claims **already exists in the cited range** is.

- **L-2** (line 24 / AC 6, `'recorded'` absent from `task-diff.ts:149-248`, `:183-184`,
  `review-task.ts:473`): **not a defect.** `recorded` is the new provenance value R1-4
  assigned; the criterion introduces it, it does not claim it already lives in
  `computeTaskDiff` or its caller.
- **L-35..L-38** (line 130 / Migration, `'computeTaskDiff'`, `'TypecheckResult'`,
  `'observed'`, `'executionContext'` absent from `task-diff.ts:50-62`): **not defects —
  linter mis-association.** The sentence's only inline citation is `(src/core/task-diff.ts:50-62)`
  attached to `runGit`; the four other symbols sit in separate clauses with no citation and
  are each cited to their real homes elsewhere (`computeTaskDiff` at `149-248` in AC 6,
  `TypecheckResult` at `typecheck.ts:17-47` in Req 2 AC 9, `executionContext` in Req 4
  AC 1). The linter binds them to the nearest inline path. None claims to exist at `50-62`.

No lint finding in this round is a citation defect, so no automatic MUST_FIX.

## Truth table (fresh lens)

Base provenance for reviewing workspace **W**, given the schema (one per-task file; base a
workspace-keyed map; attribution shared):

| State of the record | Provenance | AC |
|---|---|---|
| File missing / unreadable / malformed | `head-expected` | Req 3 AC 9 |
| File present, no base entry keyed to W | `head-expected` | Req 1 AC 7 (see R2-1) |
| File present, base entry for W validates ancestry | `recorded` | Req 1 AC 6 |
| File present, base entry for W fails ancestry | `head-degraded` | Req 1 AC 8 |

Attribution state (independent of base):

| Condition | State | AC |
|---|---|---|
| No file / malformed | `unknown` | Req 3 AC 9 |
| File present, no attribution written | `unknown` | Req 3 AC 6 |
| Attribution path == W (post `normalizeIdentityPath`) | `match` | Req 3 AC 6 |
| Attribution path != W | `mismatch` | Req 3 AC 6/7, Req 7 AC 3 |

Cross-product spot checks (all coherent): logged A / reviewed B, dashboard-started A only →
(`head-expected` base, `mismatch` attribution); dashboard-started B + logged B →
(`recorded`, `match`); dashboard-started B + logged A → (`recorded`, `mismatch`). Typecheck
outcome is orthogonal and folds into AC 5's fact/directive split cleanly (`success` →
fact; every `unavailable` reason incl. `tsc-not-found` and `timeout` → directive). **Every
cell has exactly one stated behavior — provided AC 7's "record for the reviewing workspace"
is read as "base entry for W."** That proviso is R2-1.

## Findings

### R2-1 — MINOR — AC 5/7/8 still call the per-workspace base "the record"; the (file-present, no-base-for-W) cell is stated only under the base-entry reading — Compounding R1-2

The R1-2 fix introduced a two-level vocabulary: **the record** = one per-task file
(Req 3 AC 3, Req 3 AC 9 "the record is missing, unreadable or malformed"), and **the base
entry** = the per-workspace element AC 4 now reads ("the base entry for the reviewing
workspace only"). But the sibling provenance criteria were not migrated to that vocabulary:
AC 7 still says "IF **no record** exists for **the reviewing workspace**," AC 8 "IF **the
record** fails the ancestry check," AC 5 "WHEN **a recorded base** is used." Read against
AC 3/AC 9, "the record" is the whole file — which exists whenever any workspace has a base
or attribution. So an implementer who binds `record = readRecord(spec, taskId)` (as AC 3
"one record per task" invites) and writes `if (!record) provenance = 'head-expected'` never
takes that branch for the headline case (A dashboard-started, B reviewing): the file
exists, `record.bases[B]` is `undefined`, and no criterion in the "record" reading names
that outcome. Failure scenario: B's prepare falls through AC 6/7/8 with an undefined base.
The document does provide the correct answer elsewhere — AC 4's "base entry for the
reviewing workspace" primes the base-entry reading, and AC 3 keys the base by workspace, so
a careful reader lands on `head-expected` — which is why this is MINOR, not a live gap.
Fix (no net words added; a substitution): in AC 7 "no **base entry** exists for the
reviewing workspace," AC 8 "IF the **base entry** fails the ancestry check," AC 5 "WHEN a
recorded **base entry** is used," matching the vocabulary AC 3/AC 4 established.

### R2-2 — MINOR — D9 still frames the no-directive decision around `head-expected` only, after AC 5 added `recorded` — Compounding R1-4

R1-4 added `recorded` to AC 5's "rendered as a fact with no qualify-your-verdict
instruction" arm, but the decision that governs that arm, D9 ("`head-expected` is a fact
with no directive … a signal that fires on every review carries no information"), still
names only `head-expected`. No contradiction (D9 does not require `recorded` to carry a
directive), but the decision log now under-describes the rule the ACs implement. Fix
(substitution): D9 "`head-expected` and `recorded` are facts with no directive." Purely
cosmetic; does not block design.

## Top 3 risks / gaps

1. **R2-1** — the provenance branch for the headline "logged A / reviewed B" case is
   unambiguous only if you read AC 7's "record" as "base entry"; a literal reading keyed on
   AC 3's "one record per task" leaves that cell unnamed. Cosmetic to a careful reader, but
   it sits on the one seam the decomposition split this spec to own.
2. **Effectiveness ceiling (carried, still true, not a defect).** AC 3 concedes no MCP tool
   sets `in-progress`, so on the dominant path (direct `tasks.md` edits) no base is ever
   recorded and committed work still reviews from `HEAD`. Gate A delegated D1; the
   disclosure is honest about it. Noted, not re-raised as a finding.
3. **D9/AC 5 drift (R2-2)** — decision log lags the acceptance criteria after R1-4.

## Top 3 conclusions to challenge or reverse

1. **The v3 fixes fully closed R1-1..R1-4.** Three of four are closed cleanly. R1-2 is
   substantively closed (the schema is stated, the hard contradiction gone) but the fix was
   not propagated to AC 5/7/8, leaving the vocabulary internally split (R2-1). Challenge:
   "Accepted (MUST_FIX)" for R1-2 should have carried the sibling ACs along.
2. **The truth table is complete.** It is — under the base-entry reading. The only way it
   is incomplete is the literal-record reading R2-1 describes, and the document supplies
   enough (AC 3 keys base by workspace; AC 4 reads a "base entry") to force the right
   reading. So the requirement set is design-ready.
3. **`recorded` is safe to render as a plain fact (AC 5, D9).** Defensible: it is the
   success case, and AC 11 already tells the reviewer the diff spans base→working tree so
   committed changes are included. No reversal warranted.

## What's missing before design

Nothing blocking. The record schema, the full provenance enum with per-value disclosure,
the `runGit` cause channel, and the Req 4 ↔ Req 6 encoding dependency (raised R1, standing)
are all now stated or acknowledged. The two residuals (R2-1, R2-2) are vocabulary
propagation the reviser can fold into any later touch; neither changes the design surface.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
```
