R4-1: addressed — Req 5.4 now marks a spawn only when a row states `unknown`/`na` (absent key = no mark, `0` = known zero, never marked); Req 5.9 (14 unknown/na marks, 44 spawns, 7 unmarked orchestrator spawns) and D8 restated to match; independently replayed against `.spec-workflow/specs/question-gates/harness-events.jsonl` and confirmed 44 spawns, 1,963,320 tokens, 14 marks.
R4-2: addressed — Req 5.5 now defines the header run count as distinct `run` values over every row read, not `run.start` rows; confirmed against the question-gates ledger: 2 distinct run ids, 1 `run.start` row.

VERIFIED: 2/2

## Deferred findings
(none)
