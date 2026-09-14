# Adversarial Review Memory — design

Last updated: 2026-09-14 (after v4 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 — MUST_FIX (v1).** Commit-mode `diff-tree -m --first-parent` showed all parents;
  replaced in v2 with `git log --first-parent -1 --numstat --format= --no-renames`.
  Re-probed through v3; counts correct for root/ordinary/merge; no sha header, no leading
  blank line, `parseNumstat:277` never fires.
- **R1-2 — MUST_FIX (v1).** `filesOnly` item-mode-guarded (step 3, D23).
- **R1-3 — SHOULD_FIX (v1).** `truncateLine` at step 8, sole site; `checks[].output` via
  `lastLine`.
- **R1-4 — MINOR (v1).** Rules d/e normalise `files` like `touched`.
- **R1-5 — MINOR (v1).** Whole-file `debugger` scan on prose store items flagged; unfixed
  by choice (Scope note, 4.1c).
- **R2-1 — SHOULD_FIX (v2).** `-c core.quotePath=false` on commit `git log` and
  `git ls-files`; all three producers of `touched` emit raw UTF-8 (git 2.43.0). Closed.
- **R2-2 — SHOULD_FIX (v2).** Component 5 states the gitignore assumption; e2e adds a
  `.gitignore`. Completed by R3-2.
- **R2-3 — MINOR (v2).** D13 names the `review-task ↔ review-gate` import cycle; benign,
  call-time only. Confirmed.
- **R3-1 — SHOULD_FIX (v3).** `computeRangeStats` now runs the repo check
  (`rev-parse --show-toplevel`) as a separate call *before* the resolve
  (`rev-parse --verify <ref>^{commit}`); the two failure messages are distinguished by
  which call failed, not by error text `runGit` never surfaces. The unreachable
  `handleGate` probe is gone. **v4 re-verified closed** (runGit still `{stdout, ok:!err}`;
  ordering is what makes it work).
- **R3-2 — MINOR (v3).** `C0` commits `.gitignore`; it no longer re-enters `touched`.
  v4 verified.
- **R3-3 — MINOR (v3).** Resolve message names `commit`/`baseRef`/`HEAD`. v4 verified.
- **R3-4 — MINOR (v3).** Component 8 `:89-96` routes a post-checks `success:false` to
  `sdd-closeout-phase/SKILL.md:96-98`'s resume escape (real mechanism). v4 verified.
- **R3-5 — MINOR (v3).** Unborn `HEAD` ⇒ clean empty range ⇒ rules d+f fire ⇒ `high`
  (D12/AC 6.1). v4 verified; residual (untracked pre-first-commit not counted) accepted.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved (raised v4, awaiting user response)
- **R4-1 — MINOR (Novel).** The 100-path display cap (`MAX_TOUCHED_LISTED`, D27) is not
  explicitly separated from rule evaluation. Rules a (sensitive-path) and d
  (file-outside-list) read "`touched`"; the doc never states they use the full
  `RangeStatsResult.touched` while only `GateData.touched.paths` is capped. Natural
  implementation is safe; a wrong reading is a sensitive-path bypass for a change with
  100+ files under 200 lines. Backstopped by rule b in nearly all cases. Add one Data
  Models line.
- **R4-2 — MINOR (Novel).** Exec error taxonomy (Component 6, Error Handling 7) is probed
  on node v24.13.0 but asserted on CI node 20 (`ci.yml:20`). Behaviours stable across
  20/24; name node 20 as the runtime the taxonomy must hold on.

## Patterns & Themes
- The delta-regression pattern (a fix on one axis breaking another) has **not** recurred
  since v2. v4's R3-1..R3-5 fixes are all behaviourally correct and introduce no false
  codebase claim. The R3-1 fix is notable: it resolved a genuine reachability +
  distinguishability gap by *ordering two probes* rather than widening `runGit`'s lossy
  `{stdout, ok}` contract — the root cause the memory flagged. That contract is untouched
  and no longer load-bearing for the error split.
- Citations are exact across four rounds. The v4 fresh lens (both ends of every range,
  new-symbol clash check, reused-signature check) found **zero** misstated artifacts
  across ~40 citations in ~20 files, and confirmed none of the new symbols/files clash
  with the tree. This axis is exhausted.
- Remaining gaps are presentation/spec-clarity, not mechanism: the display-cap wording
  (R4-1) and a probe-env note (R4-2). Both MINOR; neither keeps the loop alive.

## Guidance for Next Review
- If a v5 exists, attack only its delta. R4-1/R4-2 are MINOR — verify they were addressed
  or explicitly deferred; do not re-mine them at higher severity without new evidence.
- Do **not** re-mine (well-covered, verified): git-flag/encoding correctness (R1-1, R2-1);
  the `scoreRisk`/`decideGate` truth tables; `TYPECHECK_STATE_RANK` incl. `feature-disabled`
  at a non-worst rank; the check-runner exec taxonomy (timeout/maxBuffer/nonzero/missing);
  review-store atomicity and `saveReview` return shape; the import cycle; the repo-check /
  resolve ordering (R3-1); unborn HEAD (R3-5); every `path:line` citation (all re-read).
- Closed rulings (do not re-open): RE-DECIDED 1.4 (D17), RE-DECIDED 3.1 (D21 rule g);
  R1-1..R1-5, R2-1..R2-3, R3-1..R3-5 accepted/verified.
- Re-raise a rejected finding only with new evidence, marked Recurring.
- If nothing new survives scrutiny, converging is the correct result — the document has
  been stable and citation-exact for four rounds.
