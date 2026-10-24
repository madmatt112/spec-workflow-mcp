# Retrospective plan — harness-evals

Status: CLOSED
Date: 2026-10-24

## Approved proposals

- **P1 (F1) — Fresh eval fixture repo needs a repo-level git identity.** The cause (the
  fixture builder assumed a global git identity that CI does not have) is already removed:
  `bc2b89ae` sets a repo-local `user.name`/`user.email` in `src/evals/fixture.ts` before the
  commit. No further change needed for this fixture. The general shape — any harness-authored
  script that `git init`s a repo must set a repo-local identity — is a one-spec occurrence;
  leave it as a watch item, not a rule yet.
  Target: product code.
  Effort: S. Risk: low: fix already shipped and green on CI.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — The self-update BASE line must call `/usr/bin/git`.** The line is already pinned
  (`248f223b`). But this is the third spec where a bare `git`/`diff` in harness or script text
  was silently rewritten by the shell hook, and agent-rules.md already carries the rule
  ("Use `/usr/bin/git` in scripts") — it is unenforced, so scripts keep slipping. Smallest
  durable fix: a repo check that greps `scripts/` and `harness/` for a bare `git`/`diff` call
  not prefixed by `/usr/bin/`, wired into the existing check set. See Graduation G2.
  Target: server code / project checks.
  Effort: M. Risk: low: a grep check, false positives tunable by skip-regex.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — Eval selector over-marks `provisional`.** The shipped `--dry-run` selector marks
  a case provisional on any brief-source change, not only when that change is the sole reason
  (diverges from R3 AC6). Shipped knowingly; today only the CLI preview reads the flag, so no
  downstream consumer is wrong yet. Tracked as `d-3a26cd7c`.
  Target: product code.
  Effort: S. Risk: low: localized selector logic, covered by the dry-run preview.
  Prerequisites: none.
  DECISION NEEDED: yes. Fix the over-marking now, or leave it deferred until a real consumer
  reads the flag?
  - Option A — Leave `d-3a26cd7c` deferred; fix when the first non-preview consumer lands. (recommended)
  - Option B — Fix now to match R3 AC6 (narrow the provisional rule to sole-cause changes).
  - Option C — Amend R3 AC6 to match the shipped behaviour and close the deferral as intended.

- **P4 (F4) — `fixture.test.ts` leaves-no-parent test is not concurrency-safe.** It diffs the
  global `os.tmpdir()` listing, so a parallel test can make it flake. Smallest change that
  removes the cause: assert only on the absence of the fixture's own `eval-fixture-` prefixed
  entries instead of the whole-directory diff. Tracked as `d-afcd942d`.
  Target: product code (test).
  Effort: S. Risk: low: a test-only change, no production behaviour touched.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — `file-outside-list` gate unsatisfiable when the File: list is incomplete.** Task
  11 seeded a fixture tree on disk whose paths were absent from the task's File: list, so the
  gate failed every round until the decomposition was patched. This spec fixed it by amending
  the File: list; the pattern now appears in five specs (see Graduation G1). The question is
  which surface owns the durable fix.
  Target: project decomposition conventions / harness review gate.
  Effort: M. Risk: medium: a gate change could mask a genuinely stray edit if scoped too wide.
  Prerequisites: none.
  DECISION NEEDED: yes. Where should the recurring unsatisfiable-gate loop be stopped?
  - Option A — Decomposition rule only: a task that seeds a fixture/generated tree lists every
    such path (or its declared dir) in File:, enforced at the tasks-phase review. (recommended)
  - Option B — Gate change only: `file-outside-list` exempts paths under a task-declared
    fixture/generated directory.
  - Option C — Both: the decomposition declares the fixture dir and the gate reads that
    declaration as the exemption.

- **P6 (F6) — Whole-phase new-module TDD drove a high verifier/spawn count.** 63 spawns across
  16 tasks, but the run was clean (0 in-loop fix rounds, 0 implementation adjudications) and
  agent-rules.md already requires the tasks-phase decomposition to state the expected verifier
  count up front for an all-new-module phase, which the HANDOFF did. The spend was planned, not
  wasted. No change needed.
  Target: harness agents (no change).
  Effort: S. Risk: low: rule already in place and followed.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — Design specified no distinct error message, making a task-14 AC red-impossible.**
  "Recognized flag, missing value" and "unrecognized flag" both hit the script's catch-all
  `exit 2`, so the AC passed at base and was kept as a regression guard. The existing
  tdd-regression-guard rule already covers this reclassification, and there is no user-facing
  need for a distinct message. Keep it as a regression guard; no change needed. If a distinct
  message is ever wanted, that is a new requirement, not a retro fix.
  Target: design/decomposition (no change).
  Effort: S. Risk: low: current behaviour is intentional and tested.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — Requirements needed a SHOULD_FIX-only corrective pass at v4.** Requirements ran
  the full four rounds (should-fix-only verdicts, then converged) and closed with a corrective
  pass at the v4 cap, with no rulings. This is the designed cap behaviour — a corrective pass
  at the cap is the normal close, not a defect — and it cost one pass. No change needed.
  Target: harness skills (no change).
  Effort: S. Risk: low: within designed cap mechanics.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — Task 16 shipped unreviewed.** reviewCoverage is 15/16 (task 16 unreviewed) while
  logCoverage is 16/16, so a task reached the PR with no review record. The merge gate did not
  catch the gap. Smallest fix: make the merge gate assert `reviewCoverage == logCoverage` and
  stop (or escalate) on a mismatch, rather than relying on the HANDOFF Coverage line being read
  by a human.
  Target: harness skills (merge/verification gate).
  Effort: M. Risk: medium: a hard gate could block a legitimately exempt verification-only task
  unless the exemption is explicit.
  Prerequisites: none.
  DECISION NEEDED: yes. How strict should review coverage be at the merge gate?
  - Option A — Gate fails on any `reviewCoverage < logCoverage` unless each unreviewed task is
    an explicitly declared exemption; the orchestrator must review or escalate the miss. (recommended)
  - Option B — Keep the current behaviour (coverage reported, not gated) and treat this as a
    one-off to note.
  - Option C — Warn-only: the gate surfaces the mismatch loudly but still allows the merge.

- **P10 (F10) — Both info-findings were filed as harness-owned deferrals rather than
  escalated.** The harness recorded F3 and F4 as `owner: harness` deferrals and let the merge
  proceed, which is exactly the D9 rule (a known weakness is a tracked finding, not a merge
  block). Working as designed; the deferrals carry the findings to this retro, where P3 and P4
  disposition them. No change needed.
  Target: harness agents (no change).
  Effort: S. Risk: low: matches the standing D9 rule.
  Prerequisites: none.
  DECISION NEEDED: no.

- **G1 — Fixture-seeding tasks must declare every seeded path (file-outside-list gate).**
  Seen in five specs (harness-evals F5; dashboard-shell F3; harness-usage-and-tiers F3;
  dashboard-loop-views F4/F5). The `file-outside-list` gate rejects a run it cannot pass when a
  task writes fixture or generated files whose paths (or dir globs, trailing slashes) are
  absent from or malformed in the task's File: list. Rule text, for agent-rules.md
  (Documents section):

  > A task that seeds a fixture or generated tree on disk lists every path it writes in its
  > File: list, as a declared directory where a glob is unavoidable (no bare trailing slash).
  > The tasks-phase review rejects a fixture-seeding task whose File: list omits a path the
  > task writes, and the `file-outside-list` gate treats a declared fixture directory as
  > in-list.

  Target document: `.spec-workflow/agent-rules.md`.

- **G2 — Harness and script text must use `/usr/bin/git`, enforced by a check.** Seen in three
  specs (harness-evals F2; spec-lint; tdd-task-loop F5/F8). The Git rule already tells authors
  to use `/usr/bin/git`, but nothing enforces it, so harness/self-update/script lines keep
  slipping and are only caught after the shell hook rewrites them. Rule text, for the Checks
  section of agent-rules.md:

  > A repo check greps `scripts/` and `harness/` for a bare `git` or `diff` invocation not
  > prefixed by `/usr/bin/`, and fails the change until each is pinned to the absolute path
  > (skip-regex for comments and prose). Any change under those paths runs this check.

  Target document: `.spec-workflow/agent-rules.md` (Checks), with the check added to the
  project's check set.

## Decisions

- P3: Fix the over-marking now, or leave it deferred until a real consumer reads the flag? → 
- P5: Where should the recurring unsatisfiable-gate loop be stopped? → a task that seeds a fixture/generated tree lists every such path (or its declared dir) in File:, enforced at the tasks-phase review. (recommended)
- P9: How strict should review coverage be at the merge gate? → the gate surfaces the mismatch loudly but still allows the merge.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P6: skipped — no change chosen
- P7: skipped — no change chosen
- P8: skipped — no change chosen
- P10: skipped — no change chosen
- G1: skipped — no change chosen
- G2: skipped — no change chosen
- P5: done — 12a1ac8b24da8af8af2a999cdf48887b7a25a453
- P2: done — 05b83bcb5af8cf1cf4407393db44ecbe87c13a8f
- P9: done — 29809b5d933e9190c93ba59e4b6fc7572fd3e12b
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/177
- P1: skipped — No change needed; fix already shipped in bc2b89ae, left as watch item (not a rule yet)
- P3: to-do (human) — Decision needed (human) between options A/B/C; recommended A leaves d-3a26cd7c deferred with no code change. Cannot decide or touch deferrals.
- P4: done — e812a53bf5df9a352eb8bb9c71bbf3f9df0f0efe
