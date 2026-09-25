# Adversarial Review Memory — requirements
Last updated: 2026-09-25 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — implementation per-task refresh dead under worktree-per-change
  (mirrors close-out D12); scenario (4) sharpened non-worktree. v2 added D14 + R7 AC4. Resolved.
- **R1-2 (SHOULD_FIX, v1)** — run-start refresh pinned before the `run.start` write. v2 R2 AC1
  + citation `sdd-continue/SKILL.md:108-110`. Verified correct in v2.
- **R1-3 (SHOULD_FIX, v1)** — usage `graph` column omits separately-routed provider workers.
  v2 added R6 AC8; the fix introduced a false-scope claim (R2-2), which v3 fixed. Resolved.
- **R1-4 (MINOR, v1)** — graph count is a two-file join, must live in `usageAction` not the
  pure `buildUsageReport`. v2 R6 AC4 + citations. Verified correct in v2.
- **R1-5 (MINOR, v1)** — shrink-guard + no-`--force` wedge disclosed in Reliability; the fix
  encoded a FALSE claim (R2-1), which v3 fixed. Resolved.
- **R1-6 (MINOR, v1)** — R3 AC6/D8 reworded "styled on" the missing-value rule. Verified in v2
  and re-verified in v3 (`harness.ts:617-631` scans only `{{key}}` placeholders → graph values
  need a new check, R3 AC7). Resolved.
- **R2-1 (MUST_FIX, fix-induced, v2)** — Reliability line falsely said a code-deletion commit
  trips the shrink guard. **v3 rewrote it (requirements.md:118) around the partial-extraction
  wedge and stated a deletion-only commit exits 0. Re-verified in v3 against `watch.py:842-907`,
  `:1374`, `:1418-1423`, `:1612-1618`, `cli.py:1980-1996`. RESOLVED — accurate.**
- **R2-2 (MUST_FIX, fix-induced, v2)** — R6 AC8 cited wrong lines for `@deepseek` keying and
  claimed spawns/graph share a scope. **v3 fixed the citation to `usage.ts:159` and replaced
  the false equivalence with an explicit undercount statement. Re-verified in v3 (`:159` keying,
  `:166` real spawn count, `:367` prints it, `sdd-activity.sh:126-128` no row → graph=0).
  RESOLVED — accurate.**
- **R2-3 (SHOULD_FIX, fix-induced, v2)** — scenario-4 fixture / deferral gap. **v3 pinned the
  fixture to a checkout whose `agent-rules.md` omits `worktree-per-change: required` and widened
  the R7 AC3 deferral. Re-verified in v3 (`sdd-continue/SKILL.md:320-323` guard,
  `agent-rules.md:5` sets the line, `agent-rules.md:77-80` backs the deferral). RESOLVED.**

### Partially Accepted
- (none)

### Rejected
- (none — rounds 1, 2 and 3 rejected nothing)

### Unresolved
- (none) — all R1 and R2 findings resolved as of v3.

### New in v3 (round 3) — MINOR, do not keep the loop alive
- **R3-1 (MINOR, Novel)** — `graph` column position in the usage row is unspecified (R6 AC4/AC7);
  a formatting value for design.
- **R3-2 (MINOR, Novel)** — scenario-4 fixture prerequisites beyond the omitted worktree line
  (graphify on PATH, a `graph.json`, a real implementer report) are implicit; belongs in
  `verification-evidence.md`/design.

## Patterns & Themes
- **The fix-induced-error pattern broke this round.** Rounds 1→2 each turned an accepted fix
  into a fresh MUST_FIX (R1-5→R2-1, R1-3→R2-2). v3's three rewrites were all checked at the
  function body / exact line and are accurate — the delta is clean. The convergence signal is
  that the two behavioural rewrites (graphify guard, usage keying) survived a source re-read.
- **External-tool behaviour verified at the body, not the call site.** The lesson from R2-1
  held: `_check_shrink`'s per-source `_accounted` logic (`watch.py:886-897`) plus the
  `deleted_paths` fold (`:1374`) is what makes the v3 claim true; reading only the call site
  would still mislead.
- **Worktree seam finally closed for verification.** R1-1 → R2-3 → v3's fixture/deferral pinning
  now gives scenario (4) a defined environment and a fitting deferral route.

## Guidance for Next Review
- Requirements phase is converged (0/0 at round 3). If a v4 is spawned, attack only new deltas.
- Well-covered, do not re-open without new evidence: the graphify shrink-guard behaviour
  (deletion exits 0; partial extraction wedges), the `@deepseek` keying at `usage.ts:159` and
  the graph-column undercount, the scenario-4 fixture/deferral, the run.start pin (R1-2), the
  usageAction join (R1-4), the styled-on missing-value reword (R1-6), D14/D12 worktree
  disclosures, and all lint dispositions (to-be-built names).
- Carry R3-1 (column position) and R3-2 (fixture prerequisites) into the design/tasks review as
  the only open loose ends, both MINOR.
