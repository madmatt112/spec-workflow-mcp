# Retrospective — project-bootstrap

Compiled 2026-10-21 by the retro compiler from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

This was a clean run: 11 tasks, 0 fix rounds, 0 adjudications, 0 escalations, 0
rulings, 0 deferrals added. Most sections below are therefore `None found.` The
findings that exist come from the adversarial document loop (which caught real
reasoning defects before implementation) and from ledger bookkeeping.

## Gotchas

- **F1 — doctor's gh check reads node-20 callback error fields directly, not runCommand.**
  CI runs node 20, local node is 24; the token check classifies `killed`/`code`/
  `ENOENT` straight off the execFile callback (per design D10) rather than through the
  shared `runCommand`, to stay on fields the node-20 docs guarantee. Evidence:
  Implementation Logs/task-8_2026-10-21T0050 (checkToken, D10); agent-rules.md node-20
  clause. Frequency: once this spec; recurs across specs (see Repeat patterns). Cost:
  design effort, unknown.
- **F2 — expandTilde was copied into the new cli module, not imported, to keep arg
  parsing pure.** `parseInitArgs`/`parseDoctorArgs` do no I/O and are not exported from
  index.ts; the tilde helper was duplicated so the parser stayed side-effect-free.
  Evidence: get-task-review task 6 v2 summary. Frequency: once. Cost: trivial.

## Product bugs found

None found. No bug reached product code; the one behavioural defect was caught in the
requirements phase (see F4).

## Tool and MCP errors or deficiencies

None found.

## Harness defects

- **F3 — spawn.start outnumbers spawn.end/spawn.usage by one (47 vs 46).** The ledger
  holds 47 `spawn.start` rows but 46 `spawn.end` and 46 `spawn.usage`; the retro log and
  HANDOFF both report 46 spawns. One spawn's end/usage is unobserved — a floor, not an
  exact count, exactly as agent-rules warns. Evidence:
  harness-events.jsonl type counts (47/46/46); retrospective-log.md 2026-10-21T01:23:08Z
  ("46 spawns"). Frequency: once this spec; same class as earlier floor findings (see
  Repeat patterns). Cost: none to the run; distorts any spawn accounting read as exact.

## Prompt misunderstandings

- **F4 — requirements v2 carried an unreachable IF-clause that falsely tied `--host` to
  the resolved URL host.** Req 5 AC 2 (v2) said init SHALL NOT send the secret when the
  resolved URL's host is non-loopback "because the dashboard was bound with a
  non-localhost `--host`" — but the session URL is a hardcoded `http://localhost:` and
  both fallbacks are `127.0.0.1` literals, so the branch can never execute and the
  parenthetical was wrong. Caught as R2-1 MUST_FIX and reframed to "loopback by
  construction" in v3. Evidence:
  reviews/adversarial-analysis-requirements-r3.md (R2-1 resolved). Frequency: once. Cost:
  1 extra requirements round (v3); requirements ran 3 rounds total.

## Inefficiencies

- **F5 — tasks 6 and 9 drew a verifier agent review though the gate labelled them risk
  low.** Gate notes record "task 6 pass risk low" and "task 9 pass risk low", yet both
  got a second (agent/verifier) review v2; HANDOFF's Verifier-skipped list is 1,2,3,4,5,
  10,11, so 6,7,8,9 were verified. Tasks 7,8 were risk high (new module); 6,9 appear to
  be the new-module structural-red → verifier default firing despite the low gate label,
  which the tasks-phase decomposition did not state as an expected verifier count up
  front. Evidence: harness-events.jsonl gate notes (6/9 "risk low"); HANDOFF
  Verifier-skipped line; agent-rules.md new-module routing clause. Frequency: 2 tasks.
  Cost: ~2 verifier spawns.

## Documentation gaps

- **F6 — the exit-2 remedy line is imprecise for a LAN-only dashboard bind.** When the
  dashboard is bound to a specific non-loopback interface (`--host 192.168.1.5`), the
  session file still records `http://localhost:`, so init's POST is refused and exit 2's
  failure line points the operator at `scripts/sdd-service.sh install` — but the
  controller is running, just not on loopback, so the remedy is mildly wrong. Accepted
  knowingly as an out-of-scope MINOR. Evidence:
  reviews/adversarial-analysis-requirements-r3.md ("Noted, not raised"). Frequency: once.
  Cost: wording nicety only.

## Model behaviour

- **F7 — the adversarial reviewer correctly reversed its own prior finding against ground
  truth.** The round-2 tasks and round-3 requirements analyses re-checked each prior
  SHOULD_FIX/MUST_FIX against the fix diff and the cited source lines (e.g.
  multi-server.ts:349-356, security-utils.ts:51-54) before converging, rather than
  re-raising. Clean convergence at 3/2/2 rounds. Evidence:
  reviews/adversarial-analysis-tasks-r2.md and -requirements-r3.md (fix-induced
  re-checks). Frequency: document phase. Cost: positive — avoided churn.

## Process deviations and rulings

None found. 0 adjudications, 0 escalations, 0 rulings; merge was coordinator-approved per
the `merge: ask` rule (harness-events.jsonl note "merge answered by coordinator: merge").

## Decisions the harness made for the human

None found. Gate A (4 design questions + posture) and Gate B (plan approval) were both
answered by the operator; the merge was approved by the coordinator, not decided
silently. Evidence: gate-a.json; questions.md; harness-events.jsonl "gate-a/gate-b
answered by operator", "merge answered by coordinator".

## Repeat patterns

- **F1 repeats review-gate F1 (and harness-control-pane).** Node 20 is the CI runtime
  while local is 22/24, forcing child_process field discipline and node-20 design probes.
  Evidence here: Implementation Logs/task-8 (D10); earlier:
  review-gate/retrospective.md F1 (lines 14-19); harness-control-pane/retrospective.md
  (node-20 probe note, line 94). References both ends.
- **F3 repeats lean-orchestrators F3 and agent-cache-ttl F5.** Spawn counts in the ledger
  are a floor, not a total; a class of spawn end/usage events goes unobserved. Evidence
  here: harness-events.jsonl 47/46; earlier: lean-orchestrators/retrospective.md F3
  (reviewer spawns record no spawn.start), agent-cache-ttl/retrospective.md F5
  (first-yield spawn.end undercount), dashboard-shell F11, graph-orientation (floor
  caveat, line 14).

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | requirements, design, tasks, implementation |
| Versions per phase | requirements v3, design v2, tasks v2 |
| Review rounds | requirements 3, design 2, tasks 2; implementation: gate on all 11, verifier on 6,7,8,9 |
| Fix rounds | 0 |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 0 |
| Deferrals added | 0 (16 open project-wide) |
| Spawns | 46 (ledger floor; 47 spawn.start — see F3) |
| TDD | 9 tasks: assertion-red 2, structural-red 7, vacuous 0 |
| PR | #161 (merged) |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs' findings,
each proposed for promotion into a steering document or agent-rules.md, with the rule text as
it would be written.
