# Adversarial Review Memory — requirements

Last updated: 2026-09-27 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — R6 anchor `TasksPage.tsx:1364-1406`, AC3 names the always-shown
  task row not the `verdict !== 'pass'` expander. Resolved (verified v2).
- **R1-2 (SHOULD_FIX, v1)** — R4 AC9 classifies the full captured stdout/stderr, not the
  one-line `runChecks` output. Resolved.
- **R1-3 (SHOULD_FIX, v1)** — R3 AC4 names the injection channel. Resolved via R2-2.
- **R1-4 (SHOULD_FIX, v1)** — R4 AC14 scopes "command" to the two agent-rules keys, git
  plumbing excepted. Resolved.
- **R1-5 (MINOR, v1)** — R4 AC13 derives `seams` from the parsed task's `tests[]`. Resolved
  at requirement level (residue tracked as R3-2).
- **R1-6 (MINOR, v1)** — malformed `Test:` line stays `implementationDetails`. Fix induced
  R2-1; both now resolved by v3.
- **R2-1 (MUST_FIX, fix-induced, Compounds R1-6, v2)** — AC1/AC3 double-answered one line.
  **RESOLVED in v3**: AC1 gained "a test path by the gate's test-path rule"; AC3 dropped the
  qualifier and simplified the non-promotion clause. AC1 = ¬(AC3) by De Morgan — a clean
  partition. `isTestPath` (`gate-rules.ts:193-198`) is pure and importable at parse time;
  R1's Anchors already cite `gate-rules.ts:192-198`. Verified v3.
- **R2-2 (SHOULD_FIX, fix-induced, Compounds R1-3, v2)** — required implementer slot broke the
  unmarked brief. **RESOLVED in v3**: AC4 slot "filled for every task and empty when unmarked";
  `harness.ts:666` treats only `undefined`/`null` as missing, so an empty string writes the
  kill-switch brief. AC8 dropped "write no red section." Verified v3.
- **R2-3 (MINOR, v2)** — `seams` no-entry case. **Addressed in v3** ("none for a path without
  an entry"); datatype still loose — see R3-2.
- **R2-4 (MINOR, partially accepted, v2)** — R8 AC3 now states the implementer red-tests slot
  is internal. Resolved.

### Partially Accepted
- **R2-4** — user rules the slot an internal fill, not a TOOLS-REFERENCE surface (v3).

### Rejected
- (none)

### Unresolved
- **R3-1 (SHOULD_FIX, Recurring/carried)** — the `test-author` brief carries no channel to
  `<spec dir>` or `<CODE_ROOT>`, but R2 AC4 requires reading `requirements.md`/`design.md`/
  `codebase-context.md` and R2 AC10 requires committing in the code root. R2 AC2 requires only
  `path`/`title`/`job`; the read-and-obey line points at the spec-store `agent-rules.md`
  (`harness.ts:525-534,627,636`), which on tradr is a different root from the code root
  (`SPEC_WORKFLOW_SHARED_ROOT`). Implementer/verifier reach spec context through a standing
  brief that names the roots (`briefs.md:117`); the author has none. Escalated from the v1/v2
  unnumbered design-note. Fix: carry `<spec dir>`+`<CODE_ROOT>` via a required value, a
  standing-brief pointer, or an explicit `job`-carries-them statement.
- **R3-2 (MINOR, Compounds R2-3)** — AC13 "none for a path without an entry" leaves `seams`'
  datatype undefined (positional array with null holes vs map without the key); R5 AC6 needs
  the review-markdown round-trip total. Pin in design.
- **Design-must-resolve (carried, not numbered)** — R5 AC7 + D10: cross-call persistence of
  "the latest proof" between the gate and `review-task record` (`review-task.ts:858`); no
  store/key named. Likely satisfiable via the gate's own review record
  (`review-gate.ts:328-344`), so a design WHERE, not a requirements defect.

## Patterns & Themes

- **v3 broke the fix-induced streak.** v2 and v1 fixes each re-opened the seam they touched
  (R2-1 from R1-6, R2-2 from R1-3). The v3 delta resolved R2-1..R2-4 with **no** new
  fix-induced MUST_FIX/SHOULD_FIX. Delta-first attack came up clean this round.
- **The worker/brief boundary is the durable weak seam.** v1 flagged the server/orchestrator
  wire; v2 the required-placeholder break; v3 the test-author's missing root/spec-dir channel.
  Every new agent or injected field needs its channel named explicitly.
- Citations remain clean across all three rounds; no misstated artifact in any delta.

## Guidance for Next Review

- If R3-1 is addressed, confirm the chosen channel (required value vs standing-brief pointer
  vs `job` statement) actually reaches `<spec dir>` AND `<CODE_ROOT>`, and that it does not
  re-introduce a required-placeholder break for the unmarked path (`harness.ts:666`).
- If R3-2 is pinned, confirm the `seams` shape round-trips through `reviewToMarkdown`/
  `parseReviewMarkdown` (`task-review-manager.ts:185-313`) unchanged (R5 AC6).
- Well-covered, do not re-mine: R1 AC1/AC3 partition (R2-1, now closed), the implementer empty
  slot (R2-2, closed), R6 render gate (R1-1), AC9 full-output (R1-2), AC14 command scope
  (R1-4), base/head enumeration and risk-tier truth table.
- Fresh lenses used: v1 wire contracts; v2 internal-contradiction truth table; v3
  sub-agent-with-only-the-prompt (state/channel resolvability). Unused: base-worktree
  failure/rollback (`finally` cleanup, `git worktree prune` racing a concurrent gate), and the
  cost of editing the sensitive `review-task.ts` (forces a verifier on its own tasks).
