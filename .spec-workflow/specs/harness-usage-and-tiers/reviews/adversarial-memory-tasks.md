# Adversarial Review Memory — tasks

Last updated: 2026-09-21 (Round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — first round; verdict converged with no MUST_FIX/SHOULD_FIX)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MINOR)** — Fresh lens: task 3's and task 5's `_Prompt` lines do not restate
  that task 1's `harness/agent-profiles.json` must be committed first for their "12 keys"
  and tier-line assertions; the Dependency-order paragraph (tasks.md line 7) names the
  bridge, so a sequential implementer is unaffected. No fix required.
- **R1-2 (MINOR)** — Test-placement drift: design.md:178 assigns the Req 5.4 start-less
  cases to harness.test.ts (task 6); tasks tests them only in usage.test.ts (task 4).
  Behavior is covered once at the fold; harmless.

## Patterns & Themes

- The tasks document is exceptionally well-grounded. All cited line ranges verify against
  the tree at both ends; the skill-edit citations (task 8) are *more* precise than design's
  (skills shifted a few lines since design was written), landing exactly on the current
  `tokens=<n>` clauses.
- Completeness greps in tasks 6 and 8 were checked against the live tree: every
  `tokens=`/`footer`/`subagent_tokens` hit in harness/skills except the two allowed
  attribution-footer lines is inside an edited span; "the four orchestrators", "hook
  payloads carry no usage", and "three actions" each occur exactly once, all inside
  rewritten spans.
- Fixture arithmetic (task 5) is internally consistent: 4,554,189 total, 5 spawns, one
  phase, orch 60.2%, `--once` 1.6M — all reachable through buildModel + render.ts:114.
- Ordering is sound: task 2's line-271 guard is inert against ledger.test.ts:169-226;
  PHASE_ORDER is a private const used only in render.ts (safe to move); AGENT_PROFILES is
  imported only by render.ts:1 (safe to keep the export name).
- No gate-b (no new external dependency) and no gate-c (no task exceeds the approved
  requirements) findings.

## Guidance for Next Review

- The delta this round was only four lint citation fixes plus the Revision-History bullet;
  all verified. Future rounds: re-verify only citations a new lint/revision commit changes.
- Do NOT re-open: the Component-3 split (D1), single-fixture design (D8), same-PR pairing
  (D5), the two design-phase rulings inherited (Req 4.7 two-line agent entry; Req 5.4 / D6
  "states unknown" = any non-digit tokens value).
- If a later version touches the fixture numbers, re-run the arithmetic:
  drafter 1,209,120 + orch1 1,736,029 + reviser 604,010 + orch2 1,005,030 = 4,554,189;
  run-2 last-run scope = 1,609,040 → tokens 1.6M.
- Verified frontmatter fact: all 12 agent files have model on line 4, effort on line 5;
  sdd-checker = claude-sonnet-5 / high; every description begins `SDD <role>:`.
- The two MINORs above do not gate approval; only escalate if a future revision breaks the
  dependency chain 1→3→5 or the task 4→6 export bridge.
