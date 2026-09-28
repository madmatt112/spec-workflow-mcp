# Adversarial Review Memory — tasks

Last updated: 2026-09-28 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — first round)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (MUST_FIX)** — Task 19 `_Prompt` cites
  `harness/skills/sdd-document-phase/references/briefs.md:12-15` (the drafter `## Job`
  section, no commit-script content). The lint pass expanded a correct bare
  `briefs.md:12-15` to the wrong skill's file; the supporting content and the task's own
  `_Leverage` line are `harness/skills/sdd-implementation-phase/references/briefs.md:12-15`
  ("A `cd` inside a script file run with `bash` … that is how commits into the spec store
  are made"). Fix: retarget the `_Prompt` citation to the implementation-phase briefs.md.

## Patterns & Themes

- The v1 lint commit was the only delta. 16 of 17 "fixes" (bare→absolute citation
  expansion) verified correct; one regressed to a wrong-but-resolvable path. Lesson: a
  citation-path check cannot catch a wrong file that still exists — content must be read.
- Producer→consumer narrative references (task 3→4/7, task 6→10) are not forward artefact
  uses; the bridge-missing warnings on them are false positives. Do not re-raise.
- Frontend tasks (11-13) and harness prose tasks (16-17) legitimately carry no `Test:`
  line: `src/dashboard_frontend/**` is excluded from tsc and vitest; SKILL/formats are
  grep + plugin-validate verified.
- Carried gaps: the 409 in-flight-race loser is closed (D1, tasks 5+10, `LaunchError.step`
  gains `admission`); the R2-3 spawn-to-record window is scoped/accepted residual, not
  closed.
- No new external dependency (gate B) and no over-reach past requirements (gate C) in any
  task. All C1-C10 covered; all `_Requirements` ids resolve.

## Guidance for Next Review

- Confirm R1-1 fixed: task 19 `_Prompt` should cite
  `harness/skills/sdd-implementation-phase/references/briefs.md:12-15`.
- Do NOT re-open L-2, L-3, L-7 (bridge warnings) — assessed sound this round.
- If the round has no new delta beyond the R1-1 fix, spot-check that no other `_Prompt`
  bare-citation expansion regressed, then converge.
- Non-delta code citations (ledger.ts:294, 53-84, 157-182, 38-44; index-generator.ts:44-82;
  multi-server.ts:1965-1989; spec-routing-deriver.ts:20-30) were confirmed real this round
  where load-bearing; no need to re-verify unless a fresh lens touches them.
