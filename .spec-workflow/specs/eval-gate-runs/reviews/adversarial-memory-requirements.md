# Adversarial Review Memory — requirements
Last updated: 2026-11-04 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1→v2)** — R1 AC1 brief-reason citations were rotated; v2 inlined each
  (`brief <template>`:153, `brief source`:200, `brief: base render unavailable`:131). Verified fixed.
- **R1-2 (MUST_FIX, v1→v2)** — R2 AC1/AC2 contradicted R3 AC5's override exit-0; v2 added the
  "no `--eval-override` names that case" carve-out + `gate.ts:74`. Verified fixed (see R2-1 tail).
- **R1-3 (MINOR, v1→v2)** — R4 AC1 implied provisional⟺1 run; v2 shows a provisional `case`
  line reads `(provisional): 3 runs`. Verified.
- **R1-4 (MINOR, v1→v2)** — dropped the vacuous "no further step call" clause from R2 AC1/AC2.
- **R1-5 (MINOR, v1→v2)** — R2 AC5 now says the error wait carries the gate summary (failing
  case, or on exit-2 the bad override). Verified against `sdd-self-update.sh:252-258` + gate exit-2.
- **R1-6 (MINOR, v1→v2)** — scope note on the dry-run range (`HEAD..origin/main`) vs gate range.

### Partially Accepted
- none.

### Rejected
- none.

### Unresolved (raised this round)
- **R2-1 (MINOR, Novel / Compounds R1-2, fix-induced)** — R2 AC1/AC2 "SHALL exit 1" is preempted
  by the `passedOverrides` exit-2 check (`gate.ts:66-72`) when a *different* override names a
  passed case in the same run. Deploy still blocked, story holds; wording precision only, does
  not gate. Not yet responded to by the author.

## Patterns & Themes
- v2 is citation-clean: every added/changed line verifies at both ends. The R1 MUST_FIXes were
  fixed the code-true way (reorder to the real `select.ts` lines; mirror `gate.ts:74`).
- The only recurring soft spot is override/exit-code interaction: R2's stories keep being
  written as if only one override and one outcome exist. R1-2 closed the same-case clash; R2-1
  is the residue (a *different* override's exit-2 beating the exit-1 THEN).
- R3 AC4's "no outside reader, keep v:1" claim is verified true (grep of non-test consumers:
  only `runner.ts` writes/reads the eval record). The record-shape lens is exhausted.
- The gate→runner wire (one record, mixed per-case counts, uniform `runs` kept for other
  callers, direct-run default 3) remains bounded at requirements altitude; carried to design.

## Guidance for Next Review
- Requirements phase is converged (0/0, DESIGN_READY yes). No further requirements round needed
  unless the author re-opens.
- At design, confirm `runCases` gains a per-case count path that preserves R1 AC6 (direct=3)
  and R1 AC7 (uniform `runs`), and that the gate wires an `onLine` for R3 AC1 without breaking
  `cli.ts` which prints nothing for the gate today.
- Do not re-till: brief-reason partition (total/disjoint), the record shape, the dry-run range
  caveat — all covered. If probing R2-1 further, scope it to `gate.ts:45-72` precedence only.
