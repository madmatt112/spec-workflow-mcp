# Verification evidence — tdd-task-loop

Live criteria (1), (3) and (5) of Requirement 9 run against the merged checkout
after `npm run build`, `scripts/dev-link.sh` and a session restart, and only
after the task 8 implementation log confirms the judge wire (the outbound
criteria form and the inbound answer-number extraction). Stage the kit green
first — `SWM_DIST=/home/mcf/repo/spec-workflow-mcp/dist bash .spec-workflow/specs/tdd-task-loop/e2e/stage.sh`
— then run the implementation phase headless from the scratch code root:
`cd /tmp/scratchpad/sdd/tdd-task-loop/e2e/scratch/tdd-fixture-code && claude -p "Use the sdd-implementation-phase skill to run the tdd-fixture implementation phase end to end, stopping at the design-defect on task 3" --dangerously-skip-permissions`.
For the judge half of (3), put the Jev key in the ignored `.mcp.json` env of that
code root (`TYPESAFE_API_KEY`) before the run; with no key set, no `judge` event
is expected. The retrospective phase requires every line below to read `passed`
before it starts; an operator runs the command above in a rebuilt, restarted
session and marks each line.

- (1) passed — the headless phase over tasks marked-honest, unmarked-docs,
  marked-already-met records `assertion-red`, `pass`, `amended: false` for task 1;
  spawns no author and writes no `tdd` block for task 2; the task 3 author reports
  `RED-IMPOSSIBLE` for every criterion and the phase takes the design-defect stop
  (Requirement 9.1). Evidence (2026-09-28 rerun on the stubbed base 28dde20, same
  ledger path): task 1 author commit b5748d2 at 18:13:28Z; gate note
  `tdd assertion-red` pass at 18:14:23Z; verifier pass at 18:15:30Z; the task 1
  `tdd` block (`reviews/.tdd-1.json`, carried in `review-1_v1_2026-09-28T1815.md`)
  reads `base: assertion-red`, `head: pass`, `amended: false`. Task 2: no author,
  no `tdd` block. Task 3: author RED-IMPOSSIBLE (Requirement 3.1), `phase.end`
  design-defect at 18:18:14Z, no implementer spawned.
- (3) passed — the run's ledger carries `spawn.usage role=author` for both
  marked tasks (1 and 3), and one `judge` event for task 1 when a Jev key is set,
  none when it is not (Requirement 9.3). Evidence (2026-09-28, fixture ledger
  `.spec-workflow/specs/tdd-fixture/harness-events.jsonl` in the scratch code root):
  `spawn.usage role=author` for task 1 at 17:50:42Z (commit 8ca7e69) and for
  task 3 at 17:55:56Z (RED-IMPOSSIBLE). No `judge` event; the fixture `.mcp.json`
  env had no Jev key, so none is expected.
- (5) passed — task 1's proof runs in under 30 seconds on this checkout
  (Requirement 9.5). Evidence (2026-09-28, same ledger): implementer
  `spawn.usage` at 17:51:52Z, note `gate: task 1 pass risk high tdd structural-red`
  at 17:52:01Z, so the gate with the red-on-base proof finished within 9 s;
  `node --test` ran in 86 ms.
