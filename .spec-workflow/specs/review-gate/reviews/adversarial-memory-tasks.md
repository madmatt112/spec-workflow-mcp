# Adversarial Review Memory — tasks
Last updated: 2026-09-14 (after v4 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1→v2)** — Task 5's pass/low case needed an `agent-rules.md` fixture with a
  non-matching `## Sensitive paths` list so rule a doesn't fire. v2 added it. Superseded by R2-1.
- **R1-2 (SHOULD_FIX, v1→v2)** — Task 6's dispatch case retargeted to a files-only item call so it
  skips git/`computeRangeStats` per D23. Resolved.
- **R1-3 (MINOR, v1→v2)** — Task 1's `toContain` citation corrected `:195-198` → `:200-203`. Resolved,
  and re-verified in v4: `task-review-manager.test.ts:200-203` are the `criticalCount/warningCount/
  infoCount/verdict` `toContain` asserts.
- **R2-1 (SHOULD_FIX, v2→v3)** — Task 5's pass/low + record-after-gate cases needed the full
  precondition set (rule c block text, rules b/d diff, rule e typecheck mock, rule g hygiene), not
  rule a alone. v3 named them. VERIFIED RESOLVED (v3, re-walked v4).
- **R2-2 (MINOR, v2→v3)** — Task 5's record-after-gate case now names the intervening `prepare`
  (gate → prepare → record ⇒ v2). VERIFIED RESOLVED.
- **R3-1 (SHOULD_FIX, v3→v4, Compounding on R2-1/R1-1)** — Task 7's e2e cases 1/3 and `reviewed === 3`
  asserted `pass`/`low`/recorded without constraining the fixture's task-1/task-3 block text, so rule
  c would fire if a block named tests. v4 delta added "task-1 and task-3 blocks not matching
  `/\b(tests?)\b/i`". **VERIFIED RESOLVED in v4:** all seven risk rules and five gate rules walked for
  cases 1 and 3 — `pass`/`low`/recorded reachable; case 2 correctly unconstrained (rule a dominates);
  `reviewCoverage.reviewed === 3` reachable (shape confirmed at `spec-status.ts:154-197`).

### Partially Accepted
- (none outstanding)

### Rejected
- (none)

### Unresolved
- (none) — the tasks document is converged as of v4 (0 MUST_FIX, 0 SHOULD_FIX).

## Patterns & Themes
- **Test-recipe fixtures under-specified relative to the asserted `pass`/`low`/recorded verdict —
  RECURRING across rounds 1-3, now CLOSED.** R1-1 (rule a), R2-1 (rules c/e), R3-1 (rule c in task 7).
  The drafter fixed the named task's recipe but left the *sibling* task with the identical latent
  constraint. Every `pass`/`low` or `gate: pass` fixture in the document has now been checked against
  all risk rules a-g and gate rules a-e; the last live instance (task 7) was fixed in v4. No unstated
  `pass`/`low` precondition remains.
- **The delta is always the risk.** Each round's real finding sat in the just-changed text or its
  untouched sibling. v4's delta is itself clean and — for the first time — closes the pattern rather
  than relocating it, because task 7 was the last fixture asserting a `low` verdict.
- **Additive changes to existing components remain genuinely low-cost.** `reviewer` on `TaskReview`
  flows through `saveReview` (`Omit<…>` param), `reviewToMarkdown`, `parseReviewMarkdown`,
  `get-task-review` and `spec-status` with no signature edit and breaks no existing assertion
  (`toContain` round-trip, findings-only `get-task-review` case). Confirmed again in v4.
- **Intra-document shape consistency holds (v4 lens).** Every artefact an earlier task defines
  (reviewer field, `computeRangeStats` result, `runChecks`/`CheckResult`, the `gate-rules` exports,
  the tool schema, `computeTypecheckMethodologyState`→`worstTypecheckState`) is consumed by later
  tasks at the exact name/signature/return/field shape the earlier prompt and the design pin.
  `TYPECHECK_STATE_RANK` covers all seven `kind` values. The one bridge (task 5's direct-call test)
  has task 6's matching disposition; no dangling stub/cast.

## Guidance for Next Review
- The document is converged. Do **not** re-derive: task 5's eight-case truth table, task 7's e2e cases
  (all reachable in v4), the additive-field cost (no suite breaks), the R1-2 files-only dispatch,
  R4-1/R4-2 delta absorption, or the full citation set (clean four rounds).
- If any task changes again, re-walk only the changed text against risk rules a-g and gate rules a-e,
  and re-check its cross-task shapes.
- **Only fresh lens still unspent:** the harness routing state machine end to end (tasks 8-9) — the
  cap-of-3 interaction between gate fails, the adjudicator terminus and the narrow-verify re-run — and
  whether the item-mode `gate` call in close-out passes a `specName` (schema-required) for items not
  in `tasks.md`. These are asserted only by prose/command-exit success, never truth-tabled or
  shape-checked against the required schema. Worth one pass if the harness tasks are re-opened; not a
  gap in the current document.
- Re-raise a rejected finding only with new evidence, marked Recurring. No rejected findings exist.
