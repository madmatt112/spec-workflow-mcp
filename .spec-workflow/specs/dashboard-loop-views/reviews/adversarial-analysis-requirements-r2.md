# Adversarial Analysis — dashboard-loop-views/requirements (v2, round 2)

Round 2. Attacked the v2 deltas first (the five accepted R1 fixes + the lint pass), then applied an
unused lens: **AC1↔AC7 save/render consistency and the path-free sourcing of each saved field.**
Primary surface this phase: completeness, ambiguity, scope. Fresh lens mandated: none.

## Deltas attacked first (all five R1 fixes verified against code)

Every citation the v2 delta wrote was read at both ends in the worktree:

- **R1-1 (AC3 close date).** `parseHandoffPhaseRows` is at `src/watch/ledger.ts:202` and reads the
  `## Phase log` rows with no date window (ledger.ts:202-218). `src/dashboard/shell/spec-rows.ts:92`
  is the closed rule `phaseRows.some(r => r.phase==='closeout' && r.result==='closed')`, also
  unwindowed. The 7-day `now-model` citation is gone. **Fix correct; R1-1 resolved.**
- **R1-2 (NFR cache).** `readAgentRules` (`run-setup.ts:66-127`) reads via `readIfExists`→`readFileSync`
  (47-52), uncached. NFR now says ledgers/HANDOFF through `FileCache`, `agent-rules.md` through
  `readAgentRules` as one uncached read per project per request, matching AC9. **Fix correct; R1-2
  resolved.**
- **R1-3 (AC1/AC3 CI-state flow).** `evaluate` (`merge.ts:291-372`) reads workflow runs (314,323-337),
  commit statuses (318,331-337) and `mergeable` (348), and returns only `MergeEvaluation`. AC1/AC3 now
  say the *extended* `evaluate` returns CI state + `mergeable` ("what it already read"), classified by
  the rule `readCiState` (`merge.ts:390-430`) embodies, carried to `save`, no second read. Consistent
  with D1 and AC12. **Fix correct; R1-3 resolved.** (Nit for design, not a finding: AC3 scopes CI state
  to runs+statuses, so the implementer must keep a CI-only pending flag distinct from `evaluate`'s
  combined `pending`, which folds in `mergeable=UNKNOWN`.)
- **R1-4 (AC6 three shapes).** `ControllerRunRow`/`toRow` at `runs.ts:1175-1196` ✓, server
  `ControllerRun` at `src/dashboard/shell/types.ts:137-150` ✓, frontend copy at
  `src/dashboard_frontend/src/modules/shell/types.ts:167-179` ✓. All three enumerated. **Fix correct;
  R1-4 resolved.**
- **R1-5 (AgentRules / create / update).** `AgentRules` at `run-setup.ts:31-43` ✓, `create` at
  `deferral-storage.ts:218-259` ✓, `update` mutable-field list at `deferral-storage.ts:310-329` ✓ (the
  list has no `owner` today; AC3 correctly requires it added). **Fix correct; R1-5 resolved.**

Close-out path citation also checked: `mergeByRule` for a close-out PR is at `runs.ts:912`, inside
AC1's cited `908-915`, and `runCloseoutMergeStep` holds `run` and calls `save` (919,929,933). ✓
`save` at `runs.ts:521-526` ✓. The lint pass changed nothing (0 fixed) and introduced no defect.

**No MUST_FIX in the deltas; no fix-induced regression. The five fixes are accurate and complete.**

## Finding R2-1 — AC1 saves "the repository name"; AC7 never renders it, and no path-free source is named (SHOULD_FIX, Novel, carried)

- **AC1** saves per PR read: "the PR number, **the repository name**, the PR web URL when known, the CI
  state, …". **AC7** (the only render AC) lists PR number (link), CI chip, `mergeable`, verdict,
  reasons, read time — **the repository name is saved but never shown.**
- D2 pulls *every close-out PR the rule read* into the panel (AC2, AC5 keep them side by side). Those
  PRs live in different repositories (`runCloseoutMergeStep` runs each `p.repoDir`, `runs.ts:910-911`).
  With AC7 as written, a panel showing a run's own PR plus two close-out PR rows gives the operator no
  way to tell which repository each row belongs to — the exact disambiguation D2 added to scope.
- **Sourcing trap.** The only repo identifiers in hand are `repoDir` (a filesystem path, forbidden on
  the wire by AC6 and the Security NFR, design §17) and `PullRequest.url` (optional —
  `findPullRequest` trusts a known number with no `gh` call and no url, `merge.ts:188-217`, and
  `PR_VIEW_FIELDS`, `merge.ts:38-39`, reads neither a url nor any owner/repo field). So `evaluate` does
  **not** "already read" a repository name, unlike the CI state and `mergeable` the R1-3 fix added.
- **Failure scenario:** the implementer, told to "save the repository name" with no named source, saves
  `repoDir` — leaking `/home/mcf/repo/…` onto the LAN against AC6/§17; a reviewer may miss it because
  the field is labelled "repository name," not `repoDir`. The safe alternative (basename of `repoDir`,
  or extending `PR_VIEW_FIELDS` to read `headRepository`/`url` in the same `evaluate` call) is nowhere
  stated.
- **Fix:** either drop "the repository name" from AC1 (if the panel will not show it), or add it to
  AC7's rendered row *and* name a path-free source that needs no second GitHub read (repo display name
  resolved server-side from `repoDir`'s last segment, or the same extend-`evaluate` route R1-3 opened).

## Minor notes (recorded; do not keep the loop alive)

- **M1 (ambiguity).** AC3 says "the date of the HANDOFF closeout/closed row" (singular), but
  `parseHandoffPhaseRows` returns every matching row; a reopened-then-reclosed spec has more than one.
  Say which (newest). Relatedly, AC10 orders "newest close date first" while AC12 keeps null-close-date
  rows in the table — their sort position is undefined.
- **M2 (documented approximation; Compounds the R1-1 theme).** A spec closed only by a `CLOSED` retro
  plan with no HANDOFF closeout row (AC2's second closed path) falls to AC3's "newest `ts` in the
  ledger" — last activity, not a close date — mis-dating its trend point. AC3 documents this fallback
  and D9 acknowledges older specs lack run-end rows, so it is a stated choice, not a hidden defect.
  Worth a design note, not a requirements block.

## Top risks / gaps (3)

1. **SHOULD_FIX (R2-1)** — AC1 mandates saving "the repository name"; AC7 never renders it and no
   path-free source is named. Implementer either ships a dead field or leaks `repoDir` onto the LAN
   against AC6/§17. Reconcile AC1↔AC7 and name the source.
2. **MINOR (M1)** — AC3 does not say which closeout row's date wins when several exist; null-close-date
   rows have no defined position in AC10's "newest first" table.
3. **MINOR (M2)** — plan-closed-only specs date from the newest ledger `ts` (documented fallback,
   mis-dates the trend point for that population).

## Top 3 conclusions to challenge

1. **AC1's field list is the authority for the panel's data.** It is not aligned with AC7's render list:
   "the repository name" is saved but unshown. One of the two ACs is wrong. Reverse: make the saved set
   equal the rendered set plus only what AC5's ordering needs.
2. **"The merge rule read it, so the controller already has it" (D1) now covers every panel field.** True
   after R1-3 for CI state + `mergeable`, but **false for the repository name and (for a trusted-number
   PR) the url** — `PR_VIEW_FIELDS` reads neither. D1's "already in hand" premise still has a hole.
3. **AC6/Security ("no filesystem path on the wire") fully protects the panel.** It states the rule but,
   paired with an unsourced "repository name," it sets a trap rather than closing it; the safe source
   must be named, not merely the unsafe one forbidden.

## What's missing — do before acting

- Reconcile AC1's saved fields with AC7's rendered fields; delete or render "the repository name," and
  for the multi-repo close-out case decide whether the operator must see the repo.
- Name a path-free, no-second-read source for any repo label the panel keeps.
- A tie-break for multiple closeout rows and a defined table position for null-close-date rows.

## Clean areas (checked, fine)

All five R1 fixes are accurate and resolve their findings. Scope still matches decomposition entry 23;
cut entries 17/18 stay excluded and the baseline value stays deferred to the operator. The deferral
owner plumbing (create/update/reindex/schema, the read-only page, the index-signature frontend type)
is sound and not re-raised. The W fold tie to the `usage` action, the FileCache/`readAgentRules` split,
the three-shape wire enumeration, series-colour determinism, and the empty-state (AC15) are all sound.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
