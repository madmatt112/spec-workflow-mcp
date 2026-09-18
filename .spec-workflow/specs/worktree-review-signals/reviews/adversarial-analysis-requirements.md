# Adversarial Analysis — worktree-review-signals/requirements (v2, Round 1)

Primary attack surface: completeness, ambiguity, scope. Fresh lens: wire contracts
across a boundary (router, response shapes, enum values, client state). Deltas since the
v1 checkpoint (the v1→v2 lint pass) attacked first.

## What I verified in code (work shown)

Read both ends of every cited range that carries weight. Correct as cited:
`multi-server.ts:1417-1477` (status route; note it builds the tasks path from
`project.projectPath`, and `project.workspacePath` is available on `ProjectContext`,
`project-manager.ts:14`); `task-diff.ts:9-15/30-32/50-62/149-248` (runGit returns only
`{stdout, ok}`; `!ok` arm at 191-193 returns an empty diff with no rejection);
`typecheck.ts:17-47` (union), `:141-152`, `:188` (spawn site), `:478`
(`ERR_CHILD_PROCESS_STDIO_MAXBUFFER` detection), `:51` (the 16 MB `MAX_BUFFER`);
`review-task.ts:317-321` (`hasNoReviewableFiles`), `:345-346`, `:348-536`
(`data` literal 494-511, `nextSteps` 512-520, `projectContext` 521-526), `:675`
(unconditional header), `:806-819` (`R4_6B` names six reasons, omits `wrapper-config`);
`log-implementation.ts:297-429` (`selectRoots` destructures workflow root only at 316,
entry literal 376-388); `git-utils.ts:101` (`normalizeIdentityPath`); `types.ts:288-296`
(`toMCPResponse`→`encode`); `path-utils.ts:208-210` (`getWorkflowRoot`);
`review-gate.ts:207` (`baseRef ?? 'HEAD'`); `adversarial-review.ts:54/61/157`,
`adversarial-runner.ts:49/116-128`; `task-review-runner.ts:66-91/96/177/204/272/287`
(destructure at 177 is exactly six fields, none diff-related; the runner reads
`prepareResponse.data` **in-process**, never TOON-decoded). `package.json` declares 37 +
15 = 52 deps (matches AC2 and the Performance NFR); `optionalDependencies` is empty.
`.spec-workflow/specs/tighter-reviews/requirements.md` **is** tracked (`git ls-files`
lists it; `git check-ignore` exits 1), so Req 2 AC8's claim that the drift test
(`review-task.test.ts:1458-1501`) runs in CI "contrary to the comment at :1455-1457" is
true. R4.2a (154-156) and R4.6b (184-186) cited correctly.

**Req 6 AC1 empirically reproduced.** Built the real methodology
(`buildReviewMethodology`, empty-diff + `tsc-not-found` inputs) and ran it through the
installed `@toon-format/toon@0.8.0`: `decode(encode({ methodology }))` throws
`RangeError: Expected 0 inline array items, but got 1`; the first half round-trips; a
nested object shaped like `executionContext` round-trips. The document's central premise
for Req 6 is sound (methodology measured at 3,705 chars vs the doc's 3,702 — a harmless
input-dependent rounding, not a finding).

## Findings

### R1-1 — MUST_FIX — Req 1 AC10 bare `:30` now resolves to `typecheck.ts:30`, where `MAX_BUFFER` is absent (delta-introduced)

The v2 lint pass inserted `(src/core/typecheck.ts:478)` into the AC10 sentence, between
`ERR_CHILD_PROCESS_STDIO_MAXBUFFER` and "against the 16 MB `MAX_BUFFER` at `:30`". This
document resolves a bare `:N` against the **nearest preceding full path** (cf. AC6's
`:183-184` inheriting `task-diff.ts`, and Req 4 AC1's `:521-526` inheriting
`review-task.ts`). The nearest preceding path is now `typecheck.ts`, so `:30` reads as
`typecheck.ts:30` — a comment line about `'rejection'`. `MAX_BUFFER` is **not** there:
in `typecheck.ts` it is at line 51, and the 16 MB buffer the sentence actually means (the
git-diff overflow) is `task-diff.ts:30`. The machine agrees: open warning **L-2** lists
the cited ranges as `task-diff.ts:191-193, typecheck.ts:478, typecheck.ts:30,
task-diff.ts:115` and reports `MAX_BUFFER` absent. `MAX_BUFFER` is an existing identifier
the criterion claims lives in the cited range but does not — a citation defect by the
round's own rule, and one the lint pass introduced. Fix: re-anchor to
`src/core/task-diff.ts:30` explicitly (a citation edit, no prose added).

### R1-2 — MUST_FIX — the per-task record's key granularity contradicts itself; read literally, cross-workspace attribution (Req 3 AC6 / Req 7 AC3) cannot fire

Req 1 AC1 records a base "keyed by spec, task ID **and the project's translated workspace
path**"; Req 1 AC4 says prepare "SHALL read the record for the reviewing workspace only,
never **another workspace's record** for the same task." That language describes
per-(spec, taskId, workspace) records. But Req 3 AC6 requires, when work is logged in
workspace A and reviewed from workspace B, that prepare in B read attribution whose
`loggedWorkspace` is A and return `mismatch` (Req 7 AC3). `log-implementation` runs in A
(Req 3 AC1 records A's path). If records are keyed by workspace, A's attribution lives in
A's record; B, reading "the reviewing workspace only, never another workspace's record,"
sees no attribution → `unknown`, not `mismatch`. The two ACs cannot both hold under a
per-workspace record. D3 ("one per-task record ... one owner per field") implies the
intended shape — one file per (spec, taskId), base as a per-workspace map, attribution as
a single shared field — but no acceptance criterion states which fields are per-workspace
and which are shared, and AC1/AC4's wording actively points the other way. This is exactly
the two-writers-one-file coupling the decomposition (`decomposition.md:5-8, 46`) split this
spec out to specify. Fix: state the record's file key and internal structure in the ACs,
and reword AC4 to scope "reviewing workspace only" to the **base entry**, not the whole
record.

### R1-3 — SHOULD_FIX — AC10 requires naming/distinguishing the git-failure cause, but `runGit` discards it

AC10 requires the diff to "classify as `rejected` with a message **naming the observed
cause**," specifically distinguishing `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`. But `runGit`
(`task-diff.ts:50-62`) resolves `{ stdout, ok: !err }` and throws `err`/`err.code` away;
the cited `!ok` arm (`:191-193`) has no cause to name and cannot tell overflow from any
other failure. Satisfying AC10 forces a signature change to the **shared** helper that
both the diff and numstat calls use (`:186-189`) — a change the document does not mention,
though it is otherwise exact about signatures ("`computeTaskDiff` gains a base parameter").
An implementer wiring AC10 into the existing arm will emit a generic message and fail the
"naming the observed cause" clause. Fix: an AC (or Migration note) stating `runGit` must
surface the failure cause.

### R1-4 — SHOULD_FIX — provenance value `recorded` is used across the boundary but never defined by Req 1, and Req 4 AC5 specifies no behavior for it

Req 1 names two provenance values: `head-expected` (AC7) and `head-degraded` (AC8). The
success case — a recorded base that passes the ancestry check and is diffed from (AC6) —
is never assigned a provenance value. The value `recorded` appears only in Req 7 AC1
("provenance `recorded`") and the Migration bullet. Req 4 AC5, which drives per-provenance
disclosure, branches on `head-expected` and `head-degraded` only; it says nothing about
`recorded`, so the normal, most common case has no defined rendering (fact vs directive).
An enum value asserted in the verification requirement but undefined in the requirement
that produces it, with no disclosure behavior, is an incomplete wire contract. Fix: add an
AC to Req 1 assigning `recorded` to the validated-base case and extend Req 4 AC5 to cover
it.

## Citation-identifier warnings handed to me (L-1..L-34): adjudication

Rule applied: an identifier the criterion **introduces as new behavior** is not a defect;
an identifier the criterion claims **already exists in the cited range** is. Only **L-2 is
a defect** (see R1-1). All others are new fields/values this spec adds, or linter
mis-association of a name to an inline citation meant for a different symbol, and are **not
defects**: L-1/L-11 (`HEAD` the record will hold — new), L-3..L-7 (`dependencies` etc. —
the new probe; `typescript`/`vitest` are cited to `package.json`, not `:188`), L-8/L-10
(`observed` — new field), L-9 (`success` — the criterion says the arms must NOT yield it),
L-12..L-15 (`match`/`mismatch`/`unknown` — new states; `handlePrepare` mis-associated with
the `normalizeIdentityPath` citation), L-16..L-28 (`executionContext` and the six
destructure fields — new to those sites), L-29 (`E2BIG` — an empirical claim, not a
symbol), L-30 (`executionContext` — new), L-31 (`empty` — names the resulting state at its
producing site), L-32 (`nextSteps` — the disclosure's second render site), L-33
(`executionContext` — hypothetical probe shape), L-34 (`recorded` — new provenance, not yet
in the e2e file).

## Top 5 risks / gaps

1. Record-structure contradiction breaks the headline mismatch feature if implemented
   literally (R1-2).
2. Delta-introduced citation defect misdirects the reader to a comment line (R1-1).
3. The git-failure cause is unreachable through the shared `runGit`, so AC10's "name the
   cause" is not satisfiable without an unstated helper change (R1-3).
4. The `recorded` provenance value has no defining AC and no disclosure behavior (R1-4).
5. Effectiveness ceiling: AC3 concedes no MCP tool sets `in-progress`, so on the dominant
   path (direct `tasks.md` edits) **no base is ever recorded** and committed work still
   reviews from `HEAD`. The benefit reaches only dashboard-driven transitions.

## Top 3 conclusions to challenge

1. **D1 (record only at the dashboard status route) delivers the spec's headline value.**
   Code evidence: there is no MCP `in-progress` setter, and the SDD flow marks tasks
   through `tasks.md` edits, which record nothing (AC3). For the stated audience — agents
   in parallel worktrees — the "committed work reviews as an empty diff" defect the spec
   exists to fix is left unsolved on the path they actually use. Gate A delegated D1; I do
   not demand reversal, but the disclosure understates that the fix misses the common case.
2. **D3 resolves the two-writers coupling.** It names the store but not the read/merge
   contract. Without the per-workspace-vs-shared field split in the ACs (R1-2), the coupling
   the decomposition flagged as the lead cross-component defect is still unresolved at the
   requirements level.
3. **Req 6's mechanism can be safely deferred (D8).** The premise is sound (I reproduced
   the RangeError), but Req 4 adds `executionContext` to the same response Req 6 must make
   round-trip. Whatever fix Req 6 chooses (JSON fallback, different carrier, library patch)
   must also carry the new nested object; neither requirement states the dependency, so the
   deferral hides a sequencing constraint.

## What's missing before design

- The record's on-disk schema: file key, per-workspace base map, shared attribution,
  read/merge rules, and overwrite semantics when `in-progress` is re-marked
  (`completed`→`in-progress` rework re-records a base; unspecified).
- The full provenance enum and its per-value disclosure behavior, `recorded` included.
- The `runGit` return-shape change AC10 depends on.
- The stated dependency between Req 4 (adds `executionContext`) and Req 6 (encoding fix).

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 2
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
