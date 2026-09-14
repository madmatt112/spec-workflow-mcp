# Adversarial Review Memory — requirements
Last updated: 2026-09-13 (after v4 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — AC 3.3 misstated the parser span. Fixed v2; verified R2/R4. Closed.
- **R1-2 (MUST_FIX, v1)** — home/files-only item gate forbidden by AC 1.3/1.8. Fixed v2.
- **R1-3 (SHOULD_FIX, v1)** — no close-out verify-brief/step edit. Fixed v2: AC 7.6.
- **R1-4 (SHOULD_FIX, v1)** — typecheck-array reduction undefined. Fixed v2: AC 4.6.
- **R1-5 (SHOULD_FIX, v1)** — verifier standing rule `sdd-verifier.md:26` unedited. Fixed v2: AC 6.5.
- **R1-6 (SHOULD_FIX, v1)** — no close-out ledger note. Fixed v2: AC 7.7.
- **R1-7 (SHOULD_FIX, v1)** — no terminus for a persistent gate fail. Fixed v2: AC 6.3.
- **R1-8 (MINOR, v1)** — `root`/`projectPath` interaction unstated. Fixed v2: AC 1.2.
- **R2-1 (MUST_FIX, v2)** — AC 1.2 "`root` governs only git/checks/`data.touched`"
  contradicted AC 1.3. Fixed v3; verified R3 against `typecheck.ts:124-140` /
  `review-task.ts:437-449`. Closed.
- **R2-2 (SHOULD_FIX, v2)** — files-only response fields undefined. Fixed v3: AC 1.3. Closed.
- **R2-3 (SHOULD_FIX, v2)** — terminus verifier told to skip failing checks. Fixed v3: AC 6.3
  carve-out; line-26 vs line-28 scoping verified R3. Closed.
- **R2-4 (SHOULD_FIX, v2)** — close-out Verify spawn not conditional. Fixed v3: AC 7.6. Closed.
- **R2-5 (MINOR, v2)** — (a) range-diff mislabelled a prepare pre-computation; (b) AC 9.2
  typecheck posture unnamed. Both fixed v3. Closed.
- **R3-1 (SHOULD_FIX, v3)** — adding `{kind:'skipped'}` to the `TypecheckMethodologyState`
  union (`:45-52`) would have broken the exhaustive `renderTypecheckDirective` switch
  (`:793-810`), TS2366. Fixed v4: `skipped` kept OUT of the union; `data.typecheck` is a
  distinct boundary value. **Verified R4** against `:45-52` (7-member union) and `:793-810`
  (7-case switch, no default, `:string|null`). Closed.
- **R3-2 (SHOULD_FIX, v3)** — AC 9.2 "all three reviewed" unreachable (gate records only
  pass+low+task). Fixed v4: task 2 via `prepare`/`record` (5.2), task 3 via fix+re-gate
  (5.1). **Verified R4** against `spec-status.ts:184-191` (`getLatestReview` per task); no
  contradiction with case 3's "no review file exists". Closed.
- **R3-3 (MINOR, v3)** — terminus brief edit location uncited. Fixed v4: AC 6.3 cites
  `briefs.md:133-137`. **Verified R4** — that range is the narrow-verification paragraph.
  Closed.

### Partially Accepted
- (none)

### Rejected
- (none across R1–R4)

### Unresolved
- **R4-1 — MINOR (Novel)** — AC 9.2 names per-case risk outcomes but not the range inputs
  (`baseRef`/`commit`) that yield them; case 1 "pass, low" is only reachable with a
  `baseRef`, else 3.1f forces `high`. Net-zero wording fix.
- **R4-2 — MINOR (Novel)** — AC 7.1 permits a `home` item with zero `files`; AC 7.2 assumes
  non-empty, and the empty case sits unrouted between AC 1.3 (trivial pass) and AC 1.5/1.8
  (`success:false`), with no AC 7.3 branch for a gate that could not run. Edge (a `home`
  item normally names its target).

## Patterns & Themes

- v4 is the first fully clean delta: all three R3 fixes verified sound against code, and
  every one of ~45 `path:line` citations re-read at both ends matched. The document's
  citations have been accurate every round; the historical error classes were (a) cross-AC
  consistency, (b) unnamed required edits to shared code, (c) acceptance assertions the
  recording lattice cannot produce — all now closed.
- Remaining residue is completeness of the AC 9.2 fixture inputs (R4-1) and one close-out
  edge (R4-2), both MINOR. No MUST_FIX/SHOULD_FIX open.
- The R3-1 lesson held: when a change extends a `type X = {kind:...}|...` union, grep every
  exhaustive `switch` consumer. v4's fix (keep the new kind out of the shared union) is the
  cleaner of the two options R3 offered.

## Guidance for Next Review

- The document is converged (0 MUST_FIX, 0 SHOULD_FIX). If a v5 is produced only to absorb
  R4-1/R4-2, confirm the AC 9.2 range-input wording and the `home`-empty-`files` branch, and
  check no word-budget cut damaged a load-bearing clause.
- Well-covered, do not re-mine: the parser span (R1-1, re-verified R4), the risk/recording
  lattice (R2 truth table), R2-1's tree/workflow-root threading, line-26/28 verifier scope,
  the `TypecheckMethodologyState` union + `renderTypecheckDirective` cost (R3-1, closed), the
  reviewer-field round-trip cost (`toContain`-based tests), and all plan/step-0/decomposition
  citations.
- If deltas are thin next round, the only unused lens is tasks/design-phase readiness:
  whether each Decision D1–D12 still holds against the amended ACs, and whether a close-out
  gate running `sync-plugin-assets.cjs` (mutates `plugins/`) squares with the Security NFR's
  "run only the commands in `checks`" posture.
