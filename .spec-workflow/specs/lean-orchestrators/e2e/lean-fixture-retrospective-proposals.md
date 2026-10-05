# Retrospective proposals — lean-fixture

One proposal per finding, in the format from `retrospective.md`. F4 and F6 are
positive findings and need no change; they are recorded below for completeness.

- **P1 (F1) — Make an empty sensitive-paths list mean "none sensitive", not "all
  sensitive".** The completion gate currently treats every path as sensitive when no
  sensitive-paths list is configured, so every task scored risk "high" and the field
  carried no signal. Flip the default so a missing or empty list yields risk "low" for
  ordinary source paths, and reserve "high" for paths that match a configured list.
  Target: harness skills or agents (completion gate scoring).
  Effort: S. Risk: low: a quiet gate on an unconfigured repo is safer than a gate that
  always cries wolf; configured repos are unaffected.
  Prerequisites: none.
  DECISION NEEDED: yes. How should the gate behave when no sensitive-paths list exists?
  - A. Flip the default to "none sensitive" (risk low). *(recommended)*
  - B. Keep "all sensitive" but require every repo to ship a sensitive-paths list, failing
    the gate loudly when it is absent.
  - C. Leave as-is and document that "high" is meaningless without a list.

- **P2 (F2) — Mark the decomposition's harness-artifact e2e points as verified in the
  spec store, not the code store.** End-to-end points 1 (ledger spawn rows) and 2
  (`harness usage` sources) reference artifacts that never ship in the fixture code repo,
  so the e2e verifier burned a spawn reconciling them out-of-scope. Label those points in
  the decomposition as checked against the spec/harness store, leaving only point 3
  (`npm test`) for the code-store e2e gate.
  Target: project steering, templates or decomposition conventions.
  Effort: S. Risk: low: a labelling change to the decomposition's e2e section.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — Have per-task criteria cite only the criteria that task can satisfy.**
  Every task cited all of 7.1–7.7, but 7.2/7.4/7.6 are whole-file criteria only the final
  task can meet, so task 1 had to flag them RED-IMPOSSIBLE. In the tasks template and
  decomposition conventions, require each task to map only reachable criteria and attach
  whole-file criteria to the final task (or a dedicated integration task).
  Target: project steering, templates or decomposition conventions (tasks template).
  Effort: S. Risk: low: tighter mapping removes a recurring false RED, costs nothing.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — No change; record the clean convergence as the expected baseline.** All
  phases converged early with 0 fix rounds, 0 adjudications, 0 deferrals. This is the
  desired behaviour for a small, well-decomposed spec; nothing to fix.
  Target: none.
  Effort: S. Risk: low: no action.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — Give the implementation phase a clean "no git remote" path.** The phase
  expects to push and open a PR, but the fixture repo has no remote, so the PR step was
  silently skipped. Add an explicit branch in the implementation agent: when no remote
  exists, record PR status "none (no remote)" and continue without treating it as a gap.
  Target: harness skills or agents (implementation phase PR step).
  Effort: S. Risk: low: makes an already-tolerated case explicit and auditable.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — No change; the code-point convention worked.** All six helpers used the
  string iterator / spread for code-point handling and no UTF-16 split bug slipped
  through. The design pins (D1, D3) did their job; keep them.
  Target: none.
  Effort: S. Risk: low: no action.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — No change; the "no human" gates are the configured headless behaviour.**
  Gate A, gate B, and the e2e out-of-scope ruling were all recorded without a human
  because `agent-rules.md` sets `gates: record` for this headless fixture. That is the
  intended fixture mode, so no change is needed. If silent auto-rulings on real specs are
  a concern, that is a separate policy question for the gate design, not this fixture.
  Target: none (fixture is behaving as configured).
  Effort: S. Risk: low: no action.
  Prerequisites: none.
  DECISION NEEDED: no.

## Graduation candidates

No patterns qualify yet. Graduation requires a pattern seen in two or more specs'
findings, and `lean-fixture` is the only spec in the store with a retrospective
(retrospective.md "Repeat patterns: None found"). Revisit after a second spec completes.
Two findings to watch for recurrence, with draft rule text ready if they repeat:

- **(watch, from F1) Gate risk must be meaningful.** Candidate rule for agent-rules.md:
  "When no sensitive-paths list is configured, the completion gate scores ordinary source
  paths risk low; `high` is reserved for paths matching a configured list."
- **(watch, from F3) Per-task criteria must be reachable.** Candidate rule for the tasks
  template / steering: "Each task cites only the acceptance criteria it can satisfy on its
  own; whole-file or integration criteria are attached to the final task."
