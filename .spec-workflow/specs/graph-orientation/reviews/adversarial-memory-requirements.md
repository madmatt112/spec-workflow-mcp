# Adversarial Review Memory — requirements
Last updated: 2026-09-25 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — implementation per-task refresh dead under worktree-per-change
  (mirrors close-out D12); scenario (4) sharpened non-worktree. v2 added D14 + R7 AC4.
- **R1-2 (SHOULD_FIX, v1)** — run-start refresh pinned before the `run.start` write. v2 R2 AC1
  + citation `sdd-continue/SKILL.md:108-110`. Verified correct in v2.
- **R1-3 (SHOULD_FIX, v1)** — usage `graph` column omits separately-routed provider workers.
  v2 added R6 AC8. **Fix introduced a false-scope claim — see R2-2 (unresolved).**
- **R1-4 (MINOR, v1)** — graph count is a two-file join, must live in `usageAction` not the
  pure `buildUsageReport`. v2 R6 AC4 + citations. Verified correct in v2.
- **R1-5 (MINOR, v1)** — shrink-guard + no-`--force` wedge disclosed in Reliability.
  **Fix encoded a FALSE claim about graphify — see R2-1 (the finding is wrong; deletions
  refresh without `--force`).**
- **R1-6 (MINOR, v1)** — R3 AC6/D8 reworded "styled on" the missing-value rule. Verified in v2.

### Partially Accepted
- (none)

### Rejected
- (none — round 1 rejected nothing; round 2 rejected nothing)

### Unresolved (raised in v2, round 2)
- **R2-1 (MUST_FIX, fix-induced, Compounds R1-5)** — Reliability line (requirements.md:118)
  falsely says a code-deletion commit trips the shrink guard and wedges the graph. `_check_shrink`
  (`watch.py:842-907`) accounts for deleted paths (`rebuilt_sources |= set(deleted_paths)`,
  `watch.py:1374`) and returns True → refresh at exit 0, no `--force`. Real wedge = an
  unexplained/partial-extraction shrink, not a deletion. R1-5 was based on the same wrong premise.
- **R2-2 (MUST_FIX, fix-induced, Compounds R1-3)** — R6 AC8 cites `usage.ts:366,399` for the
  `@deepseek` keying, but keying is at `usage.ts:159`; 366/399 only zero the cache-spawn
  denominator. And "the same scope the spawns column already keys apart" is false: spawns
  INCLUDES deepseek rows (real counts from spawn.start events), graph EXCLUDES them (0). A
  deepseek reviewer/checker shows spawns>0, graph=0 — undercounts R6's comparison.
- **R2-3 (SHOULD_FIX, fix-induced, Compounds R1-1)** — R7 AC4 mandates a non-worktree scenario-4
  fixture, but `agent-rules.md:5` requires worktree-per-change and `sdd-continue/SKILL.md:320-327`
  enters a worktree, so R2 AC2/scenario 4 can only run in a fixture repo without that line —
  never stated. R7 AC3's deferral is scoped to "rebuilt and restarted session," not a
  worktree-config departure; `agent-rules.md:80` forbids silent close.

## Patterns & Themes
- **Fix-induced claim errors are the round-2 story.** Two of six accepted round-1 fixes wrote
  prose that misstates the codebase: R1-5's Reliability line (R2-1) and R1-3's AC8 justification
  (R2-2). Both are the "MUST_FIX after round 1 = a claim error introduced by the previous delta"
  pattern the prompt warned about.
- **External-tool behaviour must be read at the function body, not the call site.** R1-5 (and
  round 1) judged the shrink guard from `watch.py:1612-1618` without reading `_check_shrink`
  (842-907); the accounting for deleted paths reverses the conclusion.
- **Worktree seam still the structural blind spot.** R2-3 is the third worktree-related gap
  (after R1-1's dead refresh); the verification story does not yet fit worktree-per-change.
- **Provider-per-role scope keeps biting the usage column.** R1-3 → R2-2; the `@deepseek`
  key/scope mismatch is subtle and the disclosure prose keeps getting it slightly wrong.

## Guidance for Next Review
- Re-verify R2-1: confirm the Reliability line is deleted or rewritten around a
  partial-extraction wedge (NOT a deletion). If a citation returns, it must be to
  `_check_shrink` (`watch.py:842-907`), read at both ends.
- Re-verify R2-2: R6 AC8 must cite `usage.ts:159` for keying and must not claim spawns/graph
  share a scope; check for an explicit deepseek-undercount note.
- Re-verify R2-3: scenario (4)'s fixture environment and deferral route are specified.
- Well-covered, do not re-open without new evidence: R1-2 (run.start pin), R1-4 (usageAction
  join), R1-6 (styled-on reword), D14 disclosure, the D1/`graphify update` exit-0 probe, the
  deepseek = separate-process routing (`sdd-document-phase/SKILL.md:27-31`), and all lint
  dispositions (to-be-built names). Citations other than the two in R2-1/R2-2 are accurate.
