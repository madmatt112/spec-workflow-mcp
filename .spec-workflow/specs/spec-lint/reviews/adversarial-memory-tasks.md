# Adversarial Review Memory — tasks
Last updated: 2026-09-14 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1).** `checkTaskWords`, `checkCoverage`, `checkBridges` were pinned to
  `TaskBlock[]` (+cap/components), but `TaskBlock` (design.md:166) carries no text.
  Fixed in v2: tasks 5, 6, 7 now say the three functions take the document's `lines`
  alongside task 2's blocks. Verified sound in round 2 — task 7 is ordered after 5/6, so
  it reads their concrete signatures and the unpinned parameter order cannot break `tsc`.
- **R1-2 (MINOR, v1).** Requirement 10.1 owned no task `_Requirements:` line. Fixed in v2:
  `10.1` added to tasks 3, 4, 5, 6. (Residual: tasks 1, 2 and 10.5 still untraced — see
  R2-1.)
- **R1-3 (MINOR, v1).** `LintCaps` key is `task`; handler must use `caps.task`, not
  `caps[phase]`. Fixed in v2: task 7 prompt names `caps.task` explicitly. Correct.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R2-1 — MINOR — Compounding (round 2).** The R1-2 fix added `10.1` to tasks 3-6 but not
  tasks 1 and 2, which also create new modules with suites (10.1's "beside each new module"
  clause), and the document's own D2 (tasks.md:129) names 10.1 as the reason task 1 has a
  suite while task 1's `_Requirements:` omits it. Same untraced pattern for 10.5 (plugin
  checks realised in tasks 9-11, cited only by task 12). Traceability only; not filed yet
  to the reviser.

## Patterns & Themes

- The v2 delta was clean: all three R1 fixes are factually correct against the code and
  the design, and the delta introduced no new claim error. Round-2 verified the tool count
  (12→13), the `TaskBlock` shape, the `caps.task` mapping and every task word count (<150).
- The one recurring soft spot is traceability of the "meta" requirements (10.1 tests beside
  each module, 10.5 plugin checks per harness edit): the work is always present in the
  Success criteria, but the `_Requirements:` lines under-cite the tasks that realise them.
  This has now surfaced twice (R1-2, R2-1) and stays MINOR.
- Intra-document shape consistency is strong: every export name, parameter set and return
  shape a later task consumes matches its definition, and each definition matches the design
  component it implements (the only deliberate divergence is the R1-1-accepted stale
  2-param signatures in design Component 6/7, a closed ruling).
- The design.md was intentionally left with the pre-fix signatures (R1-1 ruling); do not
  re-raise that as a tasks defect — it is closed.

## Guidance for Next Review

- The document is implementable as written; verdict converged (0/0/1). A further round is
  only warranted if the reviser touches a rule, a signature or the e2e expected sets.
- Do not re-verify: the tool count probe (12→13), the orchestrator `spec-lint` count (0→3),
  all harness line anchors (confirmed rounds 1-2), the R1-1/R1-2/R1-3 fixes, atomicity and
  ordering, requirement/component coverage.
- If a new delta touches tasks 5/6/7, re-check that the `lines` data path and the
  downstream-ordering argument still hold. If it touches any rule, re-check task 8's exact
  per-phase finding sets. If R2-1 is addressed, confirm the `_Requirements:` edits do not
  disturb the word-cap counts.
- Rejected findings: none. Re-raise only with new evidence, marked Recurring.
