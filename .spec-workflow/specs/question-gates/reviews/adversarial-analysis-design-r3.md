# Narrow check — question-gates/design v3, round 3

Scope: verify only that R2-1, R2-2, R2-3 (adversarial-analysis-design-r2.md) were
addressed in v3, fixed or ruled out under the v3 Revision History line.

- R2-1: addressed — Component 3's re-spawn no longer says "rewrites only that triple";
  it now has the drafter re-read the lint-corrected `## Decisions taken in this
  document` section, re-extract and re-rank the full set of up to five decisions (as it
  did for v1), and re-`put` the complete `{ items: GateADecision[] }`, so `gate put
  slot=a`'s whole-file overwrite (`src/tools/harness.ts:600-611`) no longer drops the
  other decisions. v3 Revision History confirms the deleted clause and the fix.
- R2-2: addressed — Component 4's gate-A bullet now states a trigger built only from
  data the orchestrator already holds without a body read: `LINT.findings` minus
  `LINT.open` (kept on the task list per `harness/skills/sdd-document-phase/SKILL.md`
  Lint step items 2 and 7, confirmed at lines 104-107 and 117-119 — the design cites
  102-105,117-119, a 2-line drift on the first range), each finding's 1-based `line`
  (`src/core/lint-types.ts:17-24`, confirmed), compared against the Decisions section's
  line range from a permitted `grep -n '^#'` read. This stays within the standing rule
  at `SKILL.md:20-22` (confirmed: "Nothing else," "never the whole document").
- R2-3: addressed — Component 4's gate-B bullet no longer has the orchestrator read
  `tasks.md`/`requirements.md`. It now routes classes (b)/(c) through the tasks-phase
  reviewer (tags `[gate-b:T<id>]`/`[gate-c:T<id>]` findings via the same `## This round`
  injection point Step 1 item 3 uses for `RE-DECIDED`, confirmed at `SKILL.md:80-85` and
  the round-prompt build at `:127-131`) and reviser (states Accepted/Rejected reasoning
  per the existing disposition-rule bullet shape, confirmed at
  `harness/skills/sdd-document-phase/references/briefs.md:204-206`), then collects kept
  (Rejected) tags via `grep -n -E '\[gate-(b|c):'` on Revision History lines — the same
  tracking Step 3 item 4 does for the standoff tally, confirmed at `SKILL.md:167-168`.
  `VetoCandidateItem` is added to Data Models and the class-(a) fold paragraph is
  updated to match. Component 4's Purpose line ("assemble gate B without ever reading
  the document body") is now consistent with the method.

VERIFIED: 3/3

## Deferred findings
- Component 4's gate-A bullet cites `harness/skills/sdd-document-phase/SKILL.md:102-105`
  for where `LINT.findings`/`LINT.open` are kept on the task list; the actual
  `LINT = { checks, findings }` assignment and numbering sit at lines 104-107 in the
  current file (102-105 covers the `spec-lint`-unavailable branch instead). Citation
  drift only — the substance of R2-2's fix is unaffected.
