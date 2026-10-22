# Adversarial Review Memory — design

Last updated: 2026-10-22 (after v2 / round 2 review)

## Cumulative Findings Summary

### Accepted
- (none responded to yet by the reviser via Revision History)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (MUST_FIX) — fixed in working tree, re-verified round 2.** Override deferral own-id in
  `body.context`. Reviser moved to a two-write `create` (empty body) + `update(id,{context})`
  (`deferral-storage.ts:229-270`, `:321-342`); `revisitTrigger`/`body.{decision,revisitCriteria}`
  now supplied. Residue: R2-1.
- **R1-2 (SHOULD_FIX) — fixed, re-verified round 2.** Selector reason 5 now `git archive target
  harness/evals/<id> | tar -x` into a temp `caseDir` (git 2.43.0 subpath extraction confirmed by
  probe), builds the fixture from it, removes it.
- **R1-3 (MINOR) — fixed.** Case-author contract stated (design line 159); drafter's six keys,
  `docPath`↔grader `doc`, `closeout-standing.commitScript` all pinned.
- **R1-4 (MINOR) — fixed.** `Fixture = { root, parent, bases }` added to Data Models.
- **R1-5 (MINOR) — fixed.** Exit-1 summary text pinned for EH6 (no-summary fallback) and EH9
  (deferral write fail). Residue: R2-2.
- **R2-1 (MINOR, Compounding on R1-1)** — `create` recipe (PC5) still omits the required
  non-optional `supersedes` field; `Omit<>` keeps it, both callers pass `supersedes: null`. Verbatim
  transcription won't compile. Trivial, TS-enforced → MINOR, not SHOULD_FIX.
- **R2-2 (MINOR, Novel)** — EH9 `<id>` ambiguous (case id vs deferral id) and unavailable on a
  `create` failure (no id returned); `update`-failure leaves an orphaned deferral + no dedup on
  `['eval-override']`.
- **R2-3 (MINOR, Novel)** — grader `repo` arg → `FixtureView.bases` key convention unstated (is root
  `"."`/`f.root`; worktree `"landing"`/`".claude/worktrees/landing"`).

## Patterns & Themes

- The document stays exceptionally well-grounded: across two rounds no misstated artifact. Every
  code/library claim (deferral CRUD, StepSpec options, git-archive subpath, brief-template required
  keys) probed true at the installed version.
- Round-1's two recurring seams (reuse-an-API-without-pinning-the-full-call; selector's git-only view
  colliding with code that needs files) are both resolved. The round-2 residue is one notch smaller:
  trivially-null required fields and error-message wording, not missing contracts.
- Remaining soft spots cluster on the deferral create/update error surface (field completeness,
  failure-branch id, orphan/idempotency) and one unpinned grader↔fixture key convention — all MINOR.

## Guidance for Next Review

- The design is converged (0/0). A further round is only warranted if the reviser edits the deferral
  recipe or the gate error branches; scope any re-check to that diff.
- If re-touched: confirm `supersedes: null` is added to the `create` recipe (R2-1); confirm EH9
  `<id>` is disambiguated to the case id and the `update`-failure orphan is addressed (R2-2); confirm
  the `bases` key convention is stated or explicitly left to tests (R2-3).
- Well-covered, do not re-mine: the git-archive materialisation, the two-write deferral mechanics,
  StepSpec option names, brief-template required-key lists, the Fixture/FixtureView shapes, the gate
  exit-code matrix — all verified at both ends.
- Lint rule 11 suppresses the design-level identifier false positives (L-2–L-25); do not re-raise.
- Closed by ruling: none.
