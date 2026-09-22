# Adversarial Review Memory — tasks
Last updated: 2026-09-22 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — "halts the spec" was false this run; v2 restated it as a
  human-mediated stop (no automatic halt; task 3's branch not loaded). Fix accepted.
- **R1-3 (MINOR, v1)** — Req 3.5/4.1/4.5 map to no `_Requirements:` line; v2 added a Scope
  note naming them as restriction-carried negative constraints. Accepted.
- **R1-4 (MINOR, v1)** — task 1 named only 4 of 9 `SDD_*` exports; v2 names all nine
  (matches `design.md:113-121`). Accepted.

### Partially Accepted
- **R1-2 (SHOULD_FIX, v1)** — D5's "verifier brief carries corrected outcomes" premise
  removed and the decomposition-grep concession recorded (accepted by ruling). BUT the
  substitute mechanism (task 10's implementer files its own deferrals) is broken — see
  R2-1. Wiring corrected scenarios into the step-8 grep slot NOT accepted (closed ruling).

### Rejected
- Wiring task 10's scenarios into the step-8 completion-gate grep slot (R1-2 sub-part) —
  would edit the decomposition entry; requirements Scope notes ruled to record, not
  re-decide. Closed.
- Lint L-1/L-33 (bridge-missing, narrative), L-6 + the citation-identifier class (new
  artifacts / correctly-cited-elsewhere) — rejected both lint passes. Closed.

### Unresolved (raised v2, awaiting reviser)
- **R2-1 (MUST_FIX, fix-induced, Recurring/Compounds R1-2)** — task 10 / D5 tell the
  `sdd-implementer` to `call deferrals add yourself`, but the implementer is forbidden to
  touch deferrals (`sdd-implementer.md:35`, `briefs.md:49`); the implementation
  orchestrator lacks the `deferrals` tool (`sdd-implementation-orchestrator.md:9-17`). The
  R1-2 "no writer" gap re-created. Success line unsatisfiable.
- **R2-2 (SHOULD_FIX, Compounds R1-1)** — task 1's `RETRO: escalation` uses a category the
  implementer brief's list (`briefs.md:43-45`) does not include; `escalation` is only a
  `retro.sh` category (`formats.md:119-121`). The R1-1 human-visible-record safety leans
  on it.
- **R2-3 (MINOR, Compounds R1-2)** — Scope note `:119`/D5 say the step-8 verifier "reads
  the superseded wording at `decomposition.md:344,346,383-384`"; it reads only the
  verification scenario (377-387), which excludes 344/346 (those are in **Delivers**).

## Patterns & Themes
- **The drafter keeps mis-modelling which agent executes a step and what that agent may
  do.** R1-1/R1-2 (v1) failed on "which loaded skill does X"; R2-1 (v2) fails on "which
  tool/permission the executing agent has." Same axis. Every claim of the form "task N /
  the implementer / the orchestrator files/routes/reports X" must be checked against the
  executing agent's declared tools AND its standing prohibitions (agent frontmatter +
  standing brief), not just tool availability.
- Two RETRO category lists exist (implementer brief `briefs.md:43-45` vs `retro.sh`
  `formats.md:119-121`); the spec relies on `escalation` crossing that boundary (R2-2).
- Citation hygiene remains strong: all v2 delta citations and lint-corrected paths verify;
  no misstated-artifact MUST_FIX. Tasks 7/8 test-impact claims ("one rewritten assertion,
  no numeric value") verified true.
- Coverage (8/8 components, requirement IDs) is complete after R1-3.

## Guidance for Next Review
- Re-check R2-1 hardest: a fix is real only if the deferral (or its replacement) has an
  agent that is both tooled AND permitted to write it in the implementation phase. Reject a
  reword that keeps the implementer as the deferral writer. Reconcile with `outcome=gate`.
- Re-check R2-2: does the fix let `escalation` reach `retro.sh` from an implementer (add to
  the brief list, or use a listed category)? Do not accept a wording that still emits a
  category the implementer is not told it may use.
- R2-3 is a one-line citation trim; MINOR, will not keep the loop alive alone.
- Closed by ruling — do not re-open: Req 2 crit 5 (`--agents model` = request alias); Req 2
  crit 7 (`--add-dir` when store repo outside code root); R2-1/compare-mode pair placement
  (task 7/D3, end-of-line after delta); the step-8-grep-slot wiring sub-part of R1-2.
- Well-covered, no re-examination needed: citation ranges (all verified twice), tasks 7/8
  regression safety, component/requirement coverage, task-1 bundle size (D1, closed).
