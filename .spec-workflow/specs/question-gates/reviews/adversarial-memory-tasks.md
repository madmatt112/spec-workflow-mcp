# Adversarial Review Memory — tasks
Last updated: 2026-09-16 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 — SHOULD_FIX** (v1): task 6 covered only Req 2 AC 7's receipt write, not its step-3 resume
  recheck. Fixed in v2 — resume clause added to task 6 body/Leverage(`SKILL.md:122`)/Prompt/Success
  and to design Component 5 (v3 amended). **Verified resolved in v2 review**: citation `:122` is
  exactly step 3 rule 4; requirements/design/tasks agree; control flow is implementable. Not recurring.
- **R1-2 — SHOULD_FIX** (v1): five unresolvable bare paths in the v1 Lint-pass Revision-History
  bullet. Fixed in v2 by un-fencing to prose. **Verified resolved**: no open `citation-path` on v2;
  Revision History carries no bare `file:line`.
- **R1-3 — MINOR** (v1): task 2 Leverage cited task-parser type range not the function. Fixed to
  `153-356,365-385`. **Verified accurate** at both ends.

### Partially Accepted
(none)

### Rejected
- **R1-4 — MINOR** (v1): task 5 bundles gate A + gate B. Rejected — one-task-per-component (D1); the
  two are independently coded/tested in one commit with no shared data/ordering. No new evidence in v2.
- **R1-5 — MINOR** (v1): "external write" keyword has no pinned regex. Rejected — design D7/NFR
  Reliability leave it implementer-tunable; task 1 requires each keyword tested. No new evidence in v2.
- **L-7** (lint, warning, bridge-missing): rejected by ruling across v1 and v2; upheld.

### Unresolved
(none — v2 is converged: MUST_FIX 0, SHOULD_FIX 0)

## Patterns & Themes

- **Round-2 delta was clean.** Every artifact the v2 response wrote (R1-1 resume recheck, R1-2 path
  un-fencing, R1-3 range) resolves against the tree and is consistent across requirements/design/tasks.
  No new claim error was introduced — the failure mode "the previous delta introduces the next MUST_FIX"
  did not occur here.
- **Cross-document citation drift is the only residual.** tasks R1-3 corrected `parseTasksFromMarkdown`
  to `153-356`, but design Component 2 (`design.md:50`) still cites the stale `108-128`. That is a
  *design* defect, not a tasks finding; logged as an observation only.
- **Fresh-lens (cost-of-touching) came up empty.** No vitest test pins the harness action enum or the
  unknown-action message; no test reads harness prose; the only PHASE-enum copies are `formats.md` +
  `sdd-continue/SKILL.md`; the drafter's three-form MCP grant matches the reviser. Every disturbed
  consumer (the `plugins/` copies) is covered by each harness/ task's sync + check Success line.

## Guidance for Next Review

- The document is converged. If a round 3 is forced, do **not** re-open: R1-1 (verified resolved),
  R1-2 (verified resolved), R1-3 (verified accurate), R1-4/R1-5 (rejected, no new evidence), L-7,
  D1/D5, ordering DAG, coverage matrix, the harness-test enum/unknown-action claim, PHASE-enum copies.
- Two lenses now spent: "sub-agent with only the prompt" (round 1) and "cost of touching an existing
  component" (round 2). A round-3 lens, if needed, could be the gate-B veto-tag pipeline end to end
  (reviewer title tag → reviser Revision-History bullet → orchestrator grep → `put` slot b): does a
  dropped or malformed `[gate-b:Tid]` tag silently vanish a veto class? This spans design Component 4
  and task 5, and no prior round has traced a malformed-tag failure.
- Only remaining real-world nit worth a design-side (not tasks-side) touch-up: design Component 2's
  stale `parseTasksFromMarkdown:108-128` citation.
